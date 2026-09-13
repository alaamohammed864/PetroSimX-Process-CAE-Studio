/**
 * Advanced Heat Exchanger Engineering Engine
 * Rigorous Shell & Tube, Plate-Frame, and Counter-Current Exchanger Calculations
 * Features: LMTD with FT Correction Factor, Fouling Resistances, Area & UA Sizing, and Temperature Cross Detection
 */

import { StreamCalculationResult, calculateStreamStateFromPH } from '../stream/streamCalculator';

export type ExchangerType = 'shell_and_tube_1_2' | 'counter_current' | 'plate_frame' | 'air_cooler';

export interface HeatExchangerDetailedSpec {
  exchangerType?: ExchangerType;
  uA_KW_per_K?: number; // Overall conductance
  overallU_W_m2_K?: number; // Overall heat transfer coefficient e.g. 450 W/(m2*K)
  heatTransferAreaM2?: number; // Surface area e.g. 280 m2
  tubeFoulingFactor_m2_K_W?: number; // e.g. 0.00035 m2*K/W for crude/hydrocarbon
  shellFoulingFactor_m2_K_W?: number; // e.g. 0.00020 m2*K/W
  hotPressureDropBar?: number;
  coldPressureDropBar?: number;
  minApproachTempC?: number; // e.g. 10 °C
  hotSideTargetTempC?: number; // If operating in rating/temperature target mode
  coldSideTargetTempC?: number;
}

export interface HeatExchangerDetailedResult {
  hotOutletStream: StreamCalculationResult;
  coldOutletStream: StreamCalculationResult;
  dutyKW: number;
  dutyMW: number;
  lmtdC: number;
  ftCorrectionFactor: number;
  effectiveLmtdC: number;
  cleanU_W_m2_K: number;
  fouledU_W_m2_K: number;
  calculatedAreaM2: number;
  calculatedUA_kW_K: number;
  hotPressureDropBar: number;
  coldPressureDropBar: number;
  hotApproachDeltaT1_C: number;
  coldApproachDeltaT2_C: number;
  temperatureCrossDetected: boolean;
  foulingResistanceRatioPct: number;
  validationWarnings: string[];
  validationErrors: string[];
  equationsUsed: string[];
}

/**
 * Calculates FT Geometry Correction Factor for 1-2 Shell & Tube Exchanger
 * P = (t2 - t1) / (T1 - t1)
 * R = (T1 - T2) / (t2 - t1)
 */
export function calculateFtCorrectionFactor(
  T1_hotIn: number,
  T2_hotOut: number,
  t1_coldIn: number,
  t2_coldOut: number
): { ft: number; warning?: string } {
  const numeratorP = t2_coldOut - t1_coldIn;
  const denominatorP = T1_hotIn - t1_coldIn;
  if (Math.abs(denominatorP) < 1e-4) return { ft: 1.0 };

  const P = Math.max(0.01, Math.min(0.99, numeratorP / denominatorP));
  const R = Math.max(0.01, (T1_hotIn - T2_hotOut) / Math.max(1e-4, t2_coldOut - t1_coldIn));

  // If R * P >= 1, extreme temperature cross
  if (P * R >= 0.99) {
    return { ft: 0.70, warning: 'Severe temperature cross in 1-shell pass. Multi-shell passes required.' };
  }

  const sqrtTerm = Math.sqrt(Math.max(0.001, R * R + 1.0));
  const num = sqrtTerm * Math.log((1.0 - P) / (1.0 - P * R));
  const den = (R - 1.0) * Math.log(
    (2.0 - P * (R + 1.0 - sqrtTerm)) / Math.max(1e-4, 2.0 - P * (R + 1.0 + sqrtTerm))
  );

  let ft = 1.0;
  if (!isNaN(num) && !isNaN(den) && Math.abs(den) > 1e-4) {
    ft = Math.max(0.5, Math.min(1.0, num / den));
  }
  return { ft: parseFloat(ft.toFixed(3)) };
}

/**
 * Solves Detailed Industrial Heat Exchanger
 */
export function solveDetailedHeatExchanger(
  unitId: string,
  hotInlet: StreamCalculationResult,
  coldInlet: StreamCalculationResult,
  spec: HeatExchangerDetailedSpec
): HeatExchangerDetailedResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const equations = [
    'Heat Duty: Q = m_dot_hot * (H_hot,in - H_hot,out) = m_dot_cold * (H_cold,out - H_cold,in)',
    'Log Mean Temperature Difference: LMTD = (dt1 - dt2) / ln(dt1 / dt2)',
    'Corrected LMTD: Delta_T_eff = FT * LMTD',
    'Heat Transfer Sizing: A = Q / (U_fouled * Delta_T_eff)',
    'Overall Resistance: 1/U_fouled = 1/U_clean + R_f_tube + R_f_shell',
  ];

  // 1. Initial Checks & Temperature Cross Check
  if (hotInlet.temperatureC <= coldInlet.temperatureC) {
    errors.push(
      `Thermodynamic violation! Hot stream temperature (${hotInlet.temperatureC} °C) is cooler than or equal to cold stream (${coldInlet.temperatureC} °C).`
    );
  }

  const dPHot = spec.hotPressureDropBar ?? 0.35;
  const dPCold = spec.coldPressureDropBar ?? 0.30;
  const minApproach = spec.minApproachTempC ?? 10.0;

  // 2. Determine Heat Transfer Duty Q
  // Maximum thermodynamic limit Q_max = min(C_hot, C_cold) * (T_hot,in - T_cold,in)
  const cpHot = Math.max(1.8, (hotInlet.enthalpyKjKg / Math.max(1, hotInlet.temperatureC + 273.15)) * 1.5);
  const cpCold = Math.max(2.1, (coldInlet.enthalpyKjKg / Math.max(1, coldInlet.temperatureC + 273.15)) * 1.5);
  const cDotHot = hotInlet.totalMassFlowKgS * cpHot;
  const cDotCold = coldInlet.totalMassFlowKgS * cpCold;
  const cMin = Math.min(cDotHot, cDotCold);
  const maxTempDiff = Math.max(0, hotInlet.temperatureC - coldInlet.temperatureC);
  const qMaxKW = cMin * maxTempDiff;

  let actualDutyKW = 0;

  if (spec.hotSideTargetTempC !== undefined) {
    // Mode A: Specified hot side outlet temperature
    const targetTHot = Math.max(coldInlet.temperatureC + 2.0, spec.hotSideTargetTempC);
    const deltaT = hotInlet.temperatureC - targetTHot;
    actualDutyKW = Math.max(1.0, Math.min(qMaxKW * 0.98, hotInlet.totalMassFlowKgS * cpHot * deltaT));
  } else if (spec.coldSideTargetTempC !== undefined) {
    // Mode B: Specified cold side outlet temperature
    const targetTCold = Math.min(hotInlet.temperatureC - 2.0, spec.coldSideTargetTempC);
    const deltaT = targetTCold - coldInlet.temperatureC;
    actualDutyKW = Math.max(1.0, Math.min(qMaxKW * 0.98, coldInlet.totalMassFlowKgS * cpCold * deltaT));
  } else if (spec.uA_KW_per_K !== undefined || (spec.overallU_W_m2_K && spec.heatTransferAreaM2)) {
    // Mode C: NTU Rating method
    const UA = spec.uA_KW_per_K || ((spec.overallU_W_m2_K! * spec.heatTransferAreaM2!) / 1000.0);
    const ntu = UA / Math.max(0.1, cMin);
    const Cr = Math.max(0.05, Math.min(1.0, cMin / Math.max(0.1, Math.max(cDotHot, cDotCold))));
    // Counter-flow effectiveness formula:
    let epsilon = 0.5;
    if (Math.abs(Cr - 1.0) < 1e-3) {
      epsilon = ntu / (1.0 + ntu);
    } else {
      epsilon = (1.0 - Math.exp(-ntu * (1.0 - Cr))) / (1.0 - Cr * Math.exp(-ntu * (1.0 - Cr)));
    }
    actualDutyKW = Math.max(10.0, Math.min(qMaxKW * 0.96, epsilon * qMaxKW));
  } else {
    // Default: 68% thermal effectiveness
    actualDutyKW = qMaxKW * 0.68;
  }

  // 3. Compute Outlets via Rigorous Enthalpy Flash
  const hotEnthalpyOut = hotInlet.enthalpyKjKg - actualDutyKW / Math.max(1e-4, hotInlet.totalMassFlowKgS);
  const coldEnthalpyOut = coldInlet.enthalpyKjKg + actualDutyKW / Math.max(1e-4, coldInlet.totalMassFlowKgS);

  const hotOutlet = calculateStreamStateFromPH(
    `${unitId}_HOT_OUT`,
    hotEnthalpyOut,
    Math.max(0.1, hotInlet.pressureBar - dPHot),
    hotInlet.totalMassFlowKgH,
    hotInlet.moleFractions
  );

  const coldOutlet = calculateStreamStateFromPH(
    `${unitId}_COLD_OUT`,
    coldEnthalpyOut,
    Math.max(0.1, coldInlet.pressureBar - dPCold),
    coldInlet.totalMassFlowKgH,
    coldInlet.moleFractions
  );

  // 4. Approach Temperatures & LMTD
  // In counter-current: dt1 = T_hot,in - T_cold,out, dt2 = T_hot,out - T_cold,in
  const dt1 = hotInlet.temperatureC - coldOutlet.temperatureC;
  const dt2 = hotOutlet.temperatureC - coldInlet.temperatureC;

  let temperatureCross = false;
  if (dt1 <= 0 || dt2 <= 0) {
    temperatureCross = true;
    warnings.push(
      `Temperature Cross Detected! (Approach dt1=${dt1.toFixed(1)} °C, dt2=${dt2.toFixed(1)} °C). Outlet cold stream is hotter than hot stream outlet.`
    );
  }

  const dt1Clamped = Math.max(0.5, dt1);
  const dt2Clamped = Math.max(0.5, dt2);
  let lmtd = (dt1Clamped - dt2Clamped) / Math.log(dt1Clamped / dt2Clamped);
  if (isNaN(lmtd) || !isFinite(lmtd) || Math.abs(dt1Clamped - dt2Clamped) < 0.1) {
    lmtd = (dt1Clamped + dt2Clamped) / 2.0;
  }

  // 5. FT Correction Factor
  const exType = spec.exchangerType || 'shell_and_tube_1_2';
  let ft = 1.0;
  if (exType === 'shell_and_tube_1_2') {
    const ftRes = calculateFtCorrectionFactor(
      hotInlet.temperatureC,
      hotOutlet.temperatureC,
      coldInlet.temperatureC,
      coldOutlet.temperatureC
    );
    ft = ftRes.ft;
    if (ftRes.warning) warnings.push(ftRes.warning);
    if (ft < 0.75) {
      warnings.push(`FT correction factor is low (${ft.toFixed(3)} < 0.75). Poor heat recovery efficiency; consider multiple shells in series.`);
    }
  }

  const effLmtd = lmtd * ft;

  // 6. Overall Heat Transfer Coefficient with Fouling
  const rfTube = spec.tubeFoulingFactor_m2_K_W ?? 0.00035;
  const rfShell = spec.shellFoulingFactor_m2_K_W ?? 0.00020;
  const cleanU = spec.overallU_W_m2_K ?? 550.0; // W/m2*K

  // 1/U_fouled = 1/U_clean + R_f_total
  const rFoulingTotal = rfTube + rfShell;
  const rClean = 1.0 / cleanU;
  const rFouled = rClean + rFoulingTotal;
  const fouledU = 1.0 / rFouled; // W/m2*K
  const foulingPct = (rFoulingTotal / rFouled) * 100.0;

  // Heat transfer area required
  // A = Q / (U * effLmtd) = (actualDutyKW * 1000) / (fouledU * effLmtd)
  const calcAreaM2 = Math.max(1.0, (actualDutyKW * 1000.0) / (fouledU * Math.max(0.5, effLmtd)));
  const calcUA_kW_K = (fouledU * calcAreaM2) / 1000.0;

  if (dt1 < minApproach || dt2 < minApproach) {
    warnings.push(
      `Pinch warning: Terminal approach temperature (${Math.min(dt1, dt2).toFixed(1)} °C) is below recommended minimum approach (${minApproach} °C). High surface area required.`
    );
  }

  return {
    hotOutletStream: hotOutlet,
    coldOutletStream: coldOutlet,
    dutyKW: parseFloat(actualDutyKW.toFixed(1)),
    dutyMW: parseFloat((actualDutyKW / 1000.0).toFixed(3)),
    lmtdC: parseFloat(lmtd.toFixed(2)),
    ftCorrectionFactor: ft,
    effectiveLmtdC: parseFloat(effLmtd.toFixed(2)),
    cleanU_W_m2_K: parseFloat(cleanU.toFixed(1)),
    fouledU_W_m2_K: parseFloat(fouledU.toFixed(1)),
    calculatedAreaM2: parseFloat(calcAreaM2.toFixed(1)),
    calculatedUA_kW_K: parseFloat(calcUA_kW_K.toFixed(2)),
    hotPressureDropBar: dPHot,
    coldPressureDropBar: dPCold,
    hotApproachDeltaT1_C: parseFloat(dt1.toFixed(1)),
    coldApproachDeltaT2_C: parseFloat(dt2.toFixed(1)),
    temperatureCrossDetected: temperatureCross,
    foulingResistanceRatioPct: parseFloat(foulingPct.toFixed(1)),
    validationWarnings: warnings,
    validationErrors: errors,
    equationsUsed: equations,
  };
}
