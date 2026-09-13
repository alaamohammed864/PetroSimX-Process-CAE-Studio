/**
 * Control Valve & Pressure Relief Sizing Engine
 * Standards: ISA-75.01 / IEC 60534 Control Valve Flow Sizing
 * Features: Cv & Kv Calculations, Choked/Sonic Gas Flow, Cavitation Index, and Flashing Detection
 */

import { StreamCalculationResult, calculateStreamStateFromPH } from '../stream/streamCalculator';

export type ValveCharacteristic = 'equal_percentage' | 'linear' | 'quick_opening';

export interface ValveDetailedSpec {
  outletPressureBar: number;
  flowCoefficientCv?: number; // Rated Cv
  valveCharacteristic?: ValveCharacteristic;
  liquidRecoveryFactorFl?: number; // e.g. 0.90 for globe, 0.60 for ball/butterfly
  expansionFactorXt?: number; // Terminal pressure drop ratio e.g. 0.72
}

export interface ValveDetailedResult {
  outletStream: StreamCalculationResult;
  pressureDropBar: number;
  calculatedCv: number;
  calculatedKv: number;
  valveOpeningPct: number;
  flowRegime: 'liquid' | 'subcritical_gas' | 'choked_sonic_gas' | 'two_phase_flashing';
  cavitationIndexSigma: number;
  isChoked: boolean;
  isFlashing: boolean;
  isCavitating: boolean;
  jouleThomsonDeltaT_C: number;
  validationWarnings: string[];
  validationErrors: string[];
  equationsUsed: string[];
}

/**
 * Solves Detailed Control Valve
 */
export function solveDetailedValve(
  unitId: string,
  feed: StreamCalculationResult,
  spec: ValveDetailedSpec
): ValveDetailedResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const equations = [
    'Joule-Thomson Isenthalpic Flash: H_out = H_in at P_out',
    'Liquid Flow Sizing: Cv = Q_gpm * sqrt(SG / Delta_P_psi)',
    'Gas Flow Sizing: Cv = W_lb_h / (63.3 * Y * sqrt(x * P1_psia * rho1))',
    'Cavitation Index: sigma = (P_out - P_vap) / (P_in - P_out)',
    'Flashing Criterion: P_out <= P_vap',
  ];

  const pIn = feed.pressureBar;
  const pOut = spec.outletPressureBar;

  if (pOut >= pIn) {
    errors.push(`Valve ${unitId}: Outlet pressure (${pOut} bar) must be strictly lower than inlet (${pIn} bar).`);
  }

  const dP_bar = Math.max(0.01, pIn - pOut);
  const dP_psi = dP_bar * 14.5038;
  const p1_psia = pIn * 14.5038;

  // 1. Isenthalpic flash calculation
  const outlet = calculateStreamStateFromPH(
    `${unitId}_OUTLET`,
    feed.enthalpyKjKg,
    pOut,
    feed.totalMassFlowKgH,
    feed.moleFractions
  );

  const deltaT = outlet.temperatureC - feed.temperatureC;

  // 2. Phase Regime and Valve Sizing (Cv & Kv)
  const isVapor = feed.vaporFraction > 0.95;
  const isLiquid = feed.vaporFraction < 0.05;
  const isTwoPhase = !isVapor && !isLiquid;
  const flashingOccurs = isLiquid && outlet.vaporFraction > 0.01;

  let calculatedCv = 0;
  let flowRegime: 'liquid' | 'subcritical_gas' | 'choked_sonic_gas' | 'two_phase_flashing' = 'liquid';
  let isChoked = false;

  // Specific gravity relative to water
  const rhoWater = 1000.0;
  const sgLiquid = Math.max(0.4, feed.densityKgM3 / rhoWater);

  // Volumetric flow gpm
  const qM3H = feed.totalVolumetricFlowM3S * 3600.0;
  const qGpm = qM3H * 4.40287;
  const wLbH = feed.totalMassFlowKgH * 2.20462;

  const FL = spec.liquidRecoveryFactorFl ?? 0.88;
  const xT = spec.expansionFactorXt ?? 0.72;

  // Cavitation check for liquid
  const pVapEstimate = pIn * Math.max(0.05, Math.min(0.9, feed.vaporFraction > 0 ? 1.0 : 0.4));
  const sigma = (pOut - pVapEstimate) / Math.max(0.01, dP_bar);
  let isCavitating = false;

  if (isLiquid) {
    // Liquid sizing per IEC 60534:
    // Choked dP limit: DeltaP_max = FL^2 * (P1 - F_F * P_v)
    const ff = 0.96 - 0.28 * Math.sqrt(Math.max(0.01, pVapEstimate / 40.0));
    const dP_max_bar = Math.pow(FL, 2) * (pIn - ff * pVapEstimate);

    if (dP_bar >= dP_max_bar) {
      isChoked = true;
      flowRegime = 'two_phase_flashing';
      calculatedCv = qGpm * Math.sqrt(sgLiquid / (dP_max_bar * 14.5038));
      warnings.push(`Choked liquid flow! Pressure drop exceeds terminal cavitation limit (${dP_bar.toFixed(2)} > ${dP_max_bar.toFixed(2)} bar).`);
    } else {
      calculatedCv = qGpm * Math.sqrt(sgLiquid / Math.max(0.1, dP_psi));
      flowRegime = 'liquid';
    }

    if (sigma < 1.5 && !flashingOccurs) {
      isCavitating = true;
      warnings.push(`Cavitation warning! Cavitation index sigma = ${sigma.toFixed(2)} (< 1.5). Severe erosion and vibration hazard.`);
    }
  } else if (isVapor) {
    // Gas sizing per ISA-75.01:
    const x = dP_bar / Math.max(0.1, pIn);
    const k = 1.30;
    const Fk = k / 1.40;
    const x_choked = Fk * xT;

    if (x >= x_choked) {
      isChoked = true;
      flowRegime = 'choked_sonic_gas';
      const Y = 0.667; // Choked expansion factor
      const rhoLbsFt3 = (feed.densityKgM3 * 0.062428);
      calculatedCv = wLbH / (63.3 * Y * Math.sqrt(x_choked * p1_psia * rhoLbsFt3));
      warnings.push(`Sonic choked gas velocity across valve trim (x = ${x.toFixed(2)} >= ${x_choked.toFixed(2)}). Acoustic noise and vibration limits apply.`);
    } else {
      flowRegime = 'subcritical_gas';
      const Y = 1.0 - x / (3.0 * x_choked);
      const rhoLbsFt3 = (feed.densityKgM3 * 0.062428);
      calculatedCv = wLbH / (63.3 * Y * Math.sqrt(x * p1_psia * rhoLbsFt3));
    }
  } else {
    flowRegime = 'two_phase_flashing';
    // Two-phase homogeneous equilibrium
    calculatedCv = (qGpm * 1.4) * Math.sqrt(sgLiquid / Math.max(0.1, dP_psi));
  }

  if (flashingOccurs) {
    flowRegime = 'two_phase_flashing';
    warnings.push(`Flashing occurs downstream of valve (${(outlet.vaporFraction * 100).toFixed(1)}% vapor generated). Hardened trim (Stellite/tungsten carbide) recommended.`);
  }

  // Kv = Cv / 1.156
  const calculatedKv = calculatedCv / 1.156;

  // Rated Cv and percentage opening
  const ratedCv = spec.flowCoefficientCv || (calculatedCv * 1.35); // 75% opening at normal design
  const cvRatio = Math.max(0.01, Math.min(1.0, calculatedCv / Math.max(1e-4, ratedCv)));

  // Characteristic opening
  const char = spec.valveCharacteristic || 'equal_percentage';
  let openingPct = 70.0;
  if (char === 'linear') {
    openingPct = cvRatio * 100.0;
  } else if (char === 'equal_percentage') {
    // R = 50 rangeability
    const R = 50.0;
    openingPct = (Math.log(cvRatio * R) / Math.log(R)) * 100.0;
  } else {
    openingPct = Math.sqrt(cvRatio) * 100.0;
  }
  openingPct = Math.max(5.0, Math.min(100.0, openingPct));

  return {
    outletStream: outlet,
    pressureDropBar: parseFloat(dP_bar.toFixed(2)),
    calculatedCv: parseFloat(calculatedCv.toFixed(1)),
    calculatedKv: parseFloat(calculatedKv.toFixed(1)),
    valveOpeningPct: parseFloat(openingPct.toFixed(1)),
    flowRegime,
    cavitationIndexSigma: parseFloat(sigma.toFixed(2)),
    isChoked,
    isFlashing: flashingOccurs,
    isCavitating,
    jouleThomsonDeltaT_C: parseFloat(deltaT.toFixed(2)),
    validationWarnings: warnings,
    validationErrors: errors,
    equationsUsed: equations,
  };
}
