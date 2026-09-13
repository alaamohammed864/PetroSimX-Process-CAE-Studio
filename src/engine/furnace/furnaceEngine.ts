/**
 * Fired Heater / Process Furnace Engineering Engine
 * Features: Radiant & Convective Sections, Combustion Stoichiometry, Fuel Gas & Fuel Oil Blends,
 * Thermal Efficiency (LHV), Flue Gas Emissions (CO2, NOx, SO2), and Tube Skin Temperature Estimation
 */

import { StreamCalculationResult, calculateStreamStateFromPH } from '../stream/streamCalculator';

export type FurnaceFuelType = 'natural_gas' | 'refinery_fuel_gas' | 'fuel_oil_hfo' | 'hydrogen_blend_50';

export interface FurnaceDetailedSpec {
  outletTargetTempC: number;
  pressureDropBar?: number;
  fuelType?: FurnaceFuelType;
  excessAirPct?: number; // e.g. 15% - 25%
  thermalEfficiencyPct?: number; // e.g. 88% on LHV basis
  radiantAbsorbedFraction?: number; // e.g. 0.65 in radiant, 0.35 in convection
  maxAllowableTubeSkinTempC?: number; // e.g. 560 °C
}

export interface FlueGasEmissionData {
  stackTempC: number;
  excessO2Pct: number;
  flueGasFlowKgH: number;
  co2MassEmissionKgH: number;
  co2MassEmissionTonDay: number;
  noxEmissionMgNm3: number;
  so2EmissionKgH: number;
  flueGasMoleComposition: {
    n2: number;
    co2: number;
    h2o: number;
    o2: number;
    so2?: number;
  };
}

export interface FurnaceDetailedResult {
  processOutletStream: StreamCalculationResult;
  absorbedDutyKW: number;
  absorbedDutyMW: number;
  firedDutyMW: number;
  radiantDutyMW: number;
  convectiveDutyMW: number;
  thermalEfficiencyPct: number;
  fuelConsumptionKgH: number;
  fuelConsumptionNm3H: number;
  estimatedMaxTubeSkinTempC: number;
  cokingRisk: boolean;
  flueGas: FlueGasEmissionData;
  validationWarnings: string[];
  validationErrors: string[];
  equationsUsed: string[];
}

/**
 * Fuel properties database (LHV in MJ/kg, Density in kg/Nm3, C/H ratio)
 */
const FUEL_PROPERTIES: Record<
  FurnaceFuelType,
  { name: string; lhv_MJ_kg: number; density_kg_Nm3: number; c_mass_frac: number; h_mass_frac: number; s_mass_frac: number }
> = {
  natural_gas: {
    name: 'Pipeline Natural Gas (95% CH4)',
    lhv_MJ_kg: 47.8,
    density_kg_Nm3: 0.72,
    c_mass_frac: 0.74,
    h_mass_frac: 0.24,
    s_mass_frac: 0.0,
  },
  refinery_fuel_gas: {
    name: 'Refinery Fuel Gas (RFG with H2/C1-C4)',
    lhv_MJ_kg: 44.5,
    density_kg_Nm3: 0.88,
    c_mass_frac: 0.70,
    h_mass_frac: 0.21,
    s_mass_frac: 0.005,
  },
  fuel_oil_hfo: {
    name: 'Heavy Fuel Oil / Vacuum Residue Blend',
    lhv_MJ_kg: 40.2,
    density_kg_Nm3: 0.98,
    c_mass_frac: 0.86,
    h_mass_frac: 0.11,
    s_mass_frac: 0.025,
  },
  hydrogen_blend_50: {
    name: 'Decarbonized H2 Fuel Blend (50 mol% H2)',
    lhv_MJ_kg: 62.0,
    density_kg_Nm3: 0.45,
    c_mass_frac: 0.42,
    h_mass_frac: 0.58,
    s_mass_frac: 0.0,
  },
};

/**
 * Solves Detailed Fired Heater / Furnace
 */
export function solveDetailedFurnace(
  unitId: string,
  feed: StreamCalculationResult,
  spec: FurnaceDetailedSpec
): FurnaceDetailedResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const equations = [
    'Absorbed Process Duty: Q_abs = m_dot * (H_out - H_in)',
    'Fired Duty (LHV): Q_fired = Q_abs / (eta_th / 100)',
    'Fuel Mass Rate: m_fuel = Q_fired / LHV_fuel',
    'Stoichiometric Combustion: C + O2 -> CO2, 4H + O2 -> 2H2O, S + O2 -> SO2',
    'Flue Gas Flow: m_flue = m_fuel + m_air_total',
    'Radiant Tube Skin Temp: T_skin = T_fluid_out + Flux / (alpha_inside)',
  ];

  const targetTempC = spec.outletTargetTempC;
  if (targetTempC <= feed.temperatureC) {
    errors.push(
      `Furnace ${unitId}: Target outlet temperature (${targetTempC} °C) must be higher than process feed (${feed.temperatureC} °C).`
    );
  }

  const dP = spec.pressureDropBar ?? 0.85;
  const pOut = Math.max(0.2, feed.pressureBar - dP);

  // 1. Estimate Process Enthalpy Rise
  // Cp average estimation
  const cpFluid = Math.max(2.0, (feed.enthalpyKjKg / Math.max(1, feed.temperatureC + 273.15)) * 1.6);
  const deltaT = Math.max(1.0, targetTempC - feed.temperatureC);
  const deltaH_approx_kJ_kg = cpFluid * deltaT;
  const targetEnthalpy = feed.enthalpyKjKg + deltaH_approx_kJ_kg;

  // Compute Process Outlet Stream
  const outlet = calculateStreamStateFromPH(
    `${unitId}_PROCESS_OUT`,
    targetEnthalpy,
    pOut,
    feed.totalMassFlowKgH,
    feed.moleFractions
  );

  // Absorbed Duty
  const absorbedDutyKW = feed.totalMassFlowKgS * (outlet.enthalpyKjKg - feed.enthalpyKjKg);
  const absorbedDutyMW = Math.max(0.01, absorbedDutyKW / 1000.0);

  // 2. Combustion & Fuel Calculations
  const fuelType = spec.fuelType || 'refinery_fuel_gas';
  const fuel = FUEL_PROPERTIES[fuelType] || FUEL_PROPERTIES.refinery_fuel_gas;
  const efficiency = spec.thermalEfficiencyPct ?? 88.0;
  const firedDutyMW = absorbedDutyMW / (efficiency / 100.0);
  const firedDutyMJH = firedDutyMW * 3600.0;

  // Mass flow of fuel kg/h
  const fuelKgH = firedDutyMJH / fuel.lhv_MJ_kg;
  const fuelNm3H = fuelKgH / fuel.density_kg_Nm3;

  // Split into Radiant and Convective sections
  const radFrac = spec.radiantAbsorbedFraction ?? 0.65;
  const radiantDutyMW = absorbedDutyMW * radFrac;
  const convDutyMW = absorbedDutyMW * (1.0 - radFrac);

  // 3. Combustion Stoichiometry & Flue Gas Emissions
  // O2 required: C (12) requires 32 O2 -> 2.667 kg O2 / kg C
  // H (1) requires 8 O2 -> 8.0 kg O2 / kg H
  // S (32) requires 32 O2 -> 1.0 kg O2 / kg S
  const cKgH = fuelKgH * fuel.c_mass_frac;
  const hKgH = fuelKgH * fuel.h_mass_frac;
  const sKgH = fuelKgH * fuel.s_mass_frac;

  const o2StoichKgH = cKgH * (32.0 / 12.0) + hKgH * 8.0 + sKgH * 1.0;
  const excessAirFrac = (spec.excessAirPct ?? 20.0) / 100.0;
  const o2TotalKgH = o2StoichKgH * (1.0 + excessAirFrac);
  const o2ExcessKgH = o2StoichKgH * excessAirFrac;

  // Air contains 23.2 mass % O2, 76.8 mass % N2
  const airTotalKgH = o2TotalKgH / 0.232;
  const n2TotalKgH = airTotalKgH * 0.768;

  // Flue gas products (kg/h):
  const co2KgH = cKgH * (44.0 / 12.0);
  const h2oKgH = hKgH * 9.0;
  const so2KgH = sKgH * 2.0;
  const flueGasMassKgH = fuelKgH + airTotalKgH;

  // Molar composition of flue gas
  const molesCO2 = co2KgH / 44.0;
  const molesH2O = h2oKgH / 18.0;
  const molesSO2 = so2KgH / 64.0;
  const molesO2 = o2ExcessKgH / 32.0;
  const molesN2 = n2TotalKgH / 28.0;
  const totalFlueMoles = molesCO2 + molesH2O + molesSO2 + molesO2 + molesN2;

  const yCO2 = molesCO2 / totalFlueMoles;
  const yH2O = molesH2O / totalFlueMoles;
  const yO2 = molesO2 / totalFlueMoles;
  const yN2 = molesN2 / totalFlueMoles;
  const ySO2 = molesSO2 / totalFlueMoles;

  // Stack temperature: typically 160 °C with air preheater
  const stackTempC = 165.0;
  const co2TonPerDay = (co2KgH * 24.0) / 1000.0;
  const noxMgNm3 = fuelType === 'fuel_oil_hfo' ? 180.0 : 65.0; // Low-NOx burner estimate

  // 4. Tube Skin Temperature & Coking Limit
  // Average radiant heat flux ~35,000 W/m2. DeltaT across boundary layer and metal wall is ~45 - 65 °C.
  const deltaTSkin = 55.0;
  const maxSkinTempC = outlet.temperatureC + deltaTSkin;
  const maxAllowableSkin = spec.maxAllowableTubeSkinTempC ?? 560.0;
  let cokingRisk = false;

  if (maxSkinTempC > maxAllowableSkin) {
    cokingRisk = true;
    warnings.push(
      `Tube Skin Temperature Limit Exceeded! Estimated skin temperature (${maxSkinTempC.toFixed(1)} °C) exceeds metallurgical limit (${maxAllowableSkin} °C). Severe coking and rupture hazard.`
    );
  }

  if (outlet.vaporFraction > 0.85 && feed.vaporFraction < 0.2) {
    warnings.push(
      `High vaporization in furnace coils (${(outlet.vaporFraction * 100).toFixed(1)}% vapor). Two-phase slug flow regimes and dryout risks should be evaluated.`
    );
  }

  return {
    processOutletStream: outlet,
    absorbedDutyKW: parseFloat(absorbedDutyKW.toFixed(1)),
    absorbedDutyMW: parseFloat(absorbedDutyMW.toFixed(3)),
    firedDutyMW: parseFloat(firedDutyMW.toFixed(3)),
    radiantDutyMW: parseFloat(radiantDutyMW.toFixed(3)),
    convectiveDutyMW: parseFloat(convDutyMW.toFixed(3)),
    thermalEfficiencyPct: efficiency,
    fuelConsumptionKgH: parseFloat(fuelKgH.toFixed(1)),
    fuelConsumptionNm3H: parseFloat(fuelNm3H.toFixed(1)),
    estimatedMaxTubeSkinTempC: parseFloat(maxSkinTempC.toFixed(1)),
    cokingRisk,
    flueGas: {
      stackTempC,
      excessO2Pct: parseFloat((yO2 * 100.0).toFixed(2)),
      flueGasFlowKgH: parseFloat(flueGasMassKgH.toFixed(1)),
      co2MassEmissionKgH: parseFloat(co2KgH.toFixed(1)),
      co2MassEmissionTonDay: parseFloat(co2TonPerDay.toFixed(2)),
      noxEmissionMgNm3: noxMgNm3,
      so2EmissionKgH: parseFloat(so2KgH.toFixed(2)),
      flueGasMoleComposition: {
        n2: parseFloat(yN2.toFixed(4)),
        co2: parseFloat(yCO2.toFixed(4)),
        h2o: parseFloat(yH2O.toFixed(4)),
        o2: parseFloat(yO2.toFixed(4)),
        so2: parseFloat(ySO2.toFixed(4)),
      },
    },
    validationWarnings: warnings,
    validationErrors: errors,
    equationsUsed: equations,
  };
}
