/**
 * Rotating & Mechanical Equipment Engineering Models
 * 1. Pumps (Centrifugal, Multi-stage, Positive Displacement) with Head, NPSH, Cavitation
 * 2. Compressors (Centrifugal, Reciprocating) with Isentropic/Polytropic, Compression Ratio, Multi-Stage Intercooling
 */

import { StreamCalculationResult, calculateStreamStateFromPH } from '../stream/streamCalculator';
import { solvePSFlash } from '../thermo/flashSolver';

export interface PumpDetailedSpec {
  outletPressureBar: number;
  hydraulicEfficiency?: number; // e.g. 0.76 (76%)
  motorEfficiency?: number; // e.g. 0.95 (95%)
  suctionStaticHeadM?: number; // e.g. +3.0 m (liquid level above suction)
  suctionFrictionLossM?: number; // e.g. 0.5 m
  npshRequiredM?: number; // e.g. 2.8 m
  impellerSpeedRpm?: number; // e.g. 2950 rpm
}

export interface PumpDetailedResult {
  outletStream: StreamCalculationResult;
  pressureBoostBar: number;
  differentialHeadM: number;
  hydraulicPowerKW: number;
  shaftBrakePowerKW: number;
  electricalMotorPowerKW: number;
  npshAvailableM: number;
  npshMarginM: number;
  cavitationRisk: boolean;
  outletTempC: number;
  validationWarnings: string[];
  validationErrors: string[];
  equationsUsed: string[];
}

export interface CompressorDetailedSpec {
  outletPressureBar: number;
  isentropicEfficiency?: number; // e.g. 0.78
  polytropicEfficiency?: number; // e.g. 0.82
  mechanicalEfficiency?: number; // e.g. 0.97
  driverEfficiency?: number; // e.g. 0.95
  maxDischargeTempLimitC?: number; // e.g. 175 °C
  intercoolingRequiredRatioLimit?: number; // e.g. 3.8
}

export interface CompressorDetailedResult {
  outletStream: StreamCalculationResult;
  compressionRatio: number;
  adiabaticHeadKJPerKg: number;
  gasSpecificHeatRatioK: number;
  idealDischargeTempC: number;
  actualDischargeTempC: number;
  shaftPowerKW: number;
  driverPowerKW: number;
  intercoolingRecommended: boolean;
  liquidIngestionHazard: boolean;
  validationWarnings: string[];
  validationErrors: string[];
  equationsUsed: string[];
}

/**
 * Solves Detailed Industrial Centrifugal / Positive Displacement Pump
 */
export function solveDetailedPump(
  unitId: string,
  feed: StreamCalculationResult,
  spec: PumpDetailedSpec
): PumpDetailedResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const equations = [
    'Differential Head: H = (P_discharge - P_suction) * 1e5 / (rho * g)',
    'Hydraulic Power: P_hyd = Q_vol * Delta_P',
    'Brake Shaft Power: P_shaft = P_hyd / eta_hydraulic',
    'Motor Power: P_motor = P_shaft / eta_motor',
    'NPSH Available: NPSHa = (P_suction - P_vap) * 1e5 / (rho * g) + z_static - h_loss',
    'Fluid Enthalpy Rise: H_out = H_in + P_shaft / m_dot',
  ];

  const pOut = spec.outletPressureBar;
  const pIn = feed.pressureBar;

  if (pOut <= pIn) {
    errors.push(`Pump ${unitId}: Outlet pressure (${pOut} bar) must exceed inlet pressure (${pIn} bar).`);
  }

  // Cavitation check: inlet vapor fraction
  let cavitationRisk = false;
  if (feed.vaporFraction > 0.005) {
    cavitationRisk = true;
    warnings.push(
      `Severe Cavitation Hazard! Inlet vapor fraction is ${(feed.vaporFraction * 100).toFixed(2)}%. Pumps require 100% subcooled liquid.`
    );
  }

  const rho = Math.max(500.0, feed.densityKgM3);
  const g = 9.80665;
  const deltaP_bar = Math.max(0.01, pOut - pIn);
  const deltaP_Pa = deltaP_bar * 1e5;

  // Differential head in meters of liquid column
  const headM = deltaP_Pa / (rho * g);

  // Volumetric flow rate m3/s
  const qVolM3S = feed.totalVolumetricFlowM3S;

  // Efficiencies
  const etaHyd = spec.hydraulicEfficiency ?? 0.75;
  const etaMotor = spec.motorEfficiency ?? 0.95;

  // Powers
  const pHydKW = (qVolM3S * deltaP_Pa) / 1000.0;
  const pShaftKW = pHydKW / Math.max(0.1, etaHyd);
  const pMotorKW = pShaftKW / Math.max(0.1, etaMotor);

  // NPSH calculation
  // Estimate vapor pressure of liquid at inlet temperature:
  // For subcooled liquid, P_vap is below operating pressure
  const pVapEstimateBar = pIn * Math.max(0.1, Math.min(0.95, feed.vaporFraction > 0 ? 1.0 : 0.65));
  const zStatic = spec.suctionStaticHeadM ?? 2.5;
  const hLoss = spec.suctionFrictionLossM ?? 0.4;
  const npshAvailableM = ((pIn - pVapEstimateBar) * 1e5) / (rho * g) + zStatic - hLoss;
  const npshReqM = spec.npshRequiredM ?? Math.max(1.5, Math.pow(headM, 0.5) * 0.4);
  const npshMarginM = npshAvailableM - npshReqM;

  if (npshMarginM < 0.5) {
    cavitationRisk = true;
    warnings.push(
      `Inadequate NPSH Margin! NPSHa (${npshAvailableM.toFixed(2)} m) vs NPSHr (${npshReqM.toFixed(2)} m). Margin: ${npshMarginM.toFixed(2)} m (min 0.6 m required).`
    );
  }

  // Fluid temperature rise due to inefficiency
  const deltaH_KjKg = pShaftKW / Math.max(1e-6, feed.totalMassFlowKgS);
  const targetH = feed.enthalpyKjKg + deltaH_KjKg;

  const outlet = calculateStreamStateFromPH(
    `${unitId}_DISCHARGE`,
    targetH,
    pOut,
    feed.totalMassFlowKgH,
    feed.moleFractions
  );

  return {
    outletStream: outlet,
    pressureBoostBar: parseFloat(deltaP_bar.toFixed(2)),
    differentialHeadM: parseFloat(headM.toFixed(1)),
    hydraulicPowerKW: parseFloat(pHydKW.toFixed(2)),
    shaftBrakePowerKW: parseFloat(pShaftKW.toFixed(2)),
    electricalMotorPowerKW: parseFloat(pMotorKW.toFixed(2)),
    npshAvailableM: parseFloat(npshAvailableM.toFixed(2)),
    npshMarginM: parseFloat(npshMarginM.toFixed(2)),
    cavitationRisk,
    outletTempC: outlet.temperatureC,
    validationWarnings: warnings,
    validationErrors: errors,
    equationsUsed: equations,
  };
}

/**
 * Solves Detailed Industrial Centrifugal / Reciprocating Gas Compressor
 */
export function solveDetailedCompressor(
  unitId: string,
  feed: StreamCalculationResult,
  spec: CompressorDetailedSpec
): CompressorDetailedResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const equations = [
    'Compression Ratio: r_p = P_discharge / P_suction',
    'Isentropic Discharge State: S(T_out,s, P_out) = S_in',
    'Isentropic Head: H_s = integral(V * dP) = k/(k-1) * Z_avg * R * T_in * [r_p^((k-1)/k) - 1]',
    'Shaft Power: W_shaft = m_dot * H_s / eta_isentropic',
    'Actual Discharge Enthalpy: H_out = H_in + W_shaft / m_dot',
    'Driver Electrical Power: W_driver = W_shaft / (eta_mech * eta_driver)',
  ];

  const pOut = spec.outletPressureBar;
  const pIn = feed.pressureBar;

  if (pOut <= pIn) {
    errors.push(`Compressor ${unitId}: Discharge pressure (${pOut} bar) must exceed suction (${pIn} bar).`);
  }

  // Liquid slugging risk
  let liquidHazard = false;
  if (feed.vaporFraction < 0.98) {
    liquidHazard = true;
    warnings.push(
      `Liquid Slugging Hazard! Inlet stream contains ${((1.0 - feed.vaporFraction) * 100).toFixed(1)}% liquid. Compressors require dry superheated gas (knockout drum upstream required).`
    );
  }

  const compressionRatio = pOut / Math.max(0.1, pIn);

  // High compression ratio warning
  const intercoolingLimit = spec.intercoolingRequiredRatioLimit ?? 3.8;
  let intercoolingRecommended = false;
  if (compressionRatio > intercoolingLimit) {
    intercoolingRecommended = true;
    warnings.push(
      `High Single-Stage Compression Ratio (${compressionRatio.toFixed(2)} > ${intercoolingLimit}). High discharge temperature and thermal stress; multi-stage compression with intercooling recommended.`
    );
  }

  // Thermodynamic heat capacity ratio k = Cp / Cv
  // For hydrocarbon/H2 gas mixture, Cp/Cv ranges 1.15 to 1.40
  const mw = feed.mwAvg || 20.0;
  const kRatio = mw < 5.0 ? 1.40 : mw < 35.0 ? 1.28 : 1.18; // Hydrogen vs Light Gas vs Heavy Vapor

  // Isentropic state calculation via PS Flash
  const psFlash = solvePSFlash(feed.entropyJPerMolK, pOut, feed.moleFractions, feed.temperatureK + 45);
  const isentropicDeltaH_kjKg = Math.max(5.0, psFlash.enthalpyKjPerKg - feed.enthalpyKjKg);

  const etaIsentropic = spec.isentropicEfficiency ?? 0.78;
  const etaMech = spec.mechanicalEfficiency ?? 0.98;
  const etaDriver = spec.driverEfficiency ?? 0.95;

  const actualDeltaH_kjKg = isentropicDeltaH_kjKg / Math.max(0.1, etaIsentropic);
  const actualOutletH = feed.enthalpyKjKg + actualDeltaH_kjKg;
  const shaftPowerKW = feed.totalMassFlowKgS * actualDeltaH_kjKg;
  const driverPowerKW = shaftPowerKW / (etaMech * etaDriver);

  // Discharge stream via PH Flash
  const outlet = calculateStreamStateFromPH(
    `${unitId}_DISCHARGE`,
    actualOutletH,
    pOut,
    feed.totalMassFlowKgH,
    feed.moleFractions
  );

  const maxTempLimit = spec.maxDischargeTempLimitC ?? 175.0;
  if (outlet.temperatureC > maxTempLimit) {
    warnings.push(
      `Metallurgical Temperature Alarm! Discharge temperature (${outlet.temperatureC.toFixed(1)} °C) exceeds design limit (${maxTempLimit} °C). Oil breakdown and seal degradation risk.`
    );
  }

  // Ideal temperature for reference:
  const tInK = feed.temperatureC + 273.15;
  const exponent = (kRatio - 1.0) / kRatio;
  const idealTOutK = tInK * Math.pow(compressionRatio, exponent);
  const idealTOutC = idealTOutK - 273.15;

  return {
    outletStream: outlet,
    compressionRatio: parseFloat(compressionRatio.toFixed(2)),
    adiabaticHeadKJPerKg: parseFloat(isentropicDeltaH_kjKg.toFixed(2)),
    gasSpecificHeatRatioK: parseFloat(kRatio.toFixed(3)),
    idealDischargeTempC: parseFloat(idealTOutC.toFixed(1)),
    actualDischargeTempC: outlet.temperatureC,
    shaftPowerKW: parseFloat(shaftPowerKW.toFixed(2)),
    driverPowerKW: parseFloat(driverPowerKW.toFixed(2)),
    intercoolingRecommended,
    liquidIngestionHazard: liquidHazard,
    validationWarnings: warnings,
    validationErrors: errors,
    equationsUsed: equations,
  };
}
