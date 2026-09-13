/**
 * Comprehensive Stream Property & State Calculator
 * Evaluates full thermophysical, extensive, and intensive state variables.
 */

import { PURE_COMPONENTS_DB } from '../thermo/thermoConstants';
import { solveTPFlash, solvePHFlash, FlashResult, PhaseType } from '../thermo/flashSolver';
import { ProcessStream } from '../../types/simulation';

export interface StreamCalculationResult {
  streamId: string;
  name: string;
  tag: string;

  // Intensive state
  temperatureC: number;
  temperatureK: number;
  pressureBar: number;
  phase: PhaseType;
  vaporFraction: number; // 0.0 (subcooled liquid) to 1.0 (superheated vapor)
  densityKgM3: number;
  mwAvg: number;
  enthalpyKjKg: number;
  enthalpyJPerMol: number;
  entropyJPerMolK: number;

  // Compositions
  moleFractions: Record<string, number>;
  massFractions: Record<string, number>;

  // Extensive flows
  totalMassFlowKgH: number;
  totalMassFlowKgS: number;
  totalMolarFlowKmolH: number;
  totalMolarFlowMolS: number;
  totalVolumetricFlowM3H: number;
  totalVolumetricFlowM3S: number;

  // Component breakdown
  componentMolarFlowKmolH: Record<string, number>;
  componentMassFlowKgH: Record<string, number>;

  // Liquid and Vapor phase splits (if two-phase VLE)
  liquidMoleFractions?: Record<string, number>;
  vaporMoleFractions?: Record<string, number>;
  kValues?: Record<string, number>;

  // Diagnostic Validation
  isValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];
}

export interface StreamInputSpec {
  id: string;
  name?: string;
  tag?: string;
  temperatureC: number;
  pressureBar: number;
  totalMassFlowKgH?: number;
  totalMolarFlowKmolH?: number;
  composition: Record<string, number>; // mole fractions
}

/**
 * Validates stream specification inputs
 */
export function validateStreamInputs(input: StreamInputSpec): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const TK = input.temperatureC + 273.15;
  if (TK <= 0) {
    errors.push(`Invalid temperature: ${input.temperatureC} °C (${TK.toFixed(1)} K) is below absolute zero.`);
  } else if (TK < 200) {
    warnings.push(`Cryogenic temperature: ${input.temperatureC} °C (< 200 K). Check for solids/hydrates.`);
  } else if (TK > 1200) {
    warnings.push(`Extremely high temperature: ${input.temperatureC} °C (> 1200 K). Metallurgy limits exceeded.`);
  }

  if (input.pressureBar <= 0) {
    errors.push(`Invalid pressure: ${input.pressureBar} bar must be strictly positive.`);
  } else if (input.pressureBar > 350) {
    warnings.push(`Ultra-high pressure: ${input.pressureBar} bar. Dense fluid compressibility effects dominant.`);
  }

  const massFlow = input.totalMassFlowKgH ?? 0;
  const molarFlow = input.totalMolarFlowKmolH ?? 0;
  if (massFlow < 0 || molarFlow < 0) {
    errors.push(`Stream flow rate cannot be negative.`);
  }

  // Check composition
  let sumZ = 0;
  for (const id in input.composition) {
    const zi = input.composition[id];
    if (zi < 0) {
      errors.push(`Negative mole fraction for component '${id}': ${zi}`);
    }
    sumZ += Math.max(0, zi);
  }

  if (sumZ <= 1e-6) {
    errors.push(`Composition sum is zero or undefined.`);
  } else if (Math.abs(sumZ - 1.0) > 0.05) {
    warnings.push(`Composition sum is ${(sumZ * 100).toFixed(2)}% (renormalized to 100%).`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Rigorously calculates all chemical engineering stream properties
 */
export function calculateStreamState(input: StreamInputSpec): StreamCalculationResult {
  const validation = validateStreamInputs(input);
  const TK = Math.max(10, input.temperatureC + 273.15);
  const Pbar = Math.max(0.01, input.pressureBar);

  // Normalize mole fractions
  let sumZ = 0;
  const normZ: Record<string, number> = {};
  for (const id in input.composition) {
    const zi = Math.max(0, input.composition[id]);
    sumZ += zi;
  }
  sumZ = Math.max(1e-8, sumZ);
  for (const id in input.composition) {
    normZ[id] = Math.max(0, input.composition[id]) / sumZ;
  }

  // Calculate average molecular weight: MW_avg = sum(z_i * MW_i)
  let mwAvg = 0;
  for (const id in normZ) {
    const comp = PURE_COMPONENTS_DB[id] || PURE_COMPONENTS_DB['c1'];
    mwAvg += normZ[id] * comp.mw;
  }
  mwAvg = Math.max(2.0, mwAvg);

  // Mass fractions: w_i = (z_i * MW_i) / MW_avg
  const massFractions: Record<string, number> = {};
  for (const id in normZ) {
    const comp = PURE_COMPONENTS_DB[id] || PURE_COMPONENTS_DB['c1'];
    massFractions[id] = (normZ[id] * comp.mw) / mwAvg;
  }

  // Determine total mass and molar flow
  let totalMassFlowKgH = 0;
  let totalMolarFlowKmolH = 0;

  if (input.totalMassFlowKgH !== undefined && input.totalMassFlowKgH > 0) {
    totalMassFlowKgH = input.totalMassFlowKgH;
    totalMolarFlowKmolH = totalMassFlowKgH / mwAvg;
  } else if (input.totalMolarFlowKmolH !== undefined && input.totalMolarFlowKmolH > 0) {
    totalMolarFlowKmolH = input.totalMolarFlowKmolH;
    totalMassFlowKgH = totalMolarFlowKmolH * mwAvg;
  } else {
    totalMassFlowKgH = 1000.0; // Default 1000 kg/h
    totalMolarFlowKmolH = totalMassFlowKgH / mwAvg;
  }

  const totalMassFlowKgS = totalMassFlowKgH / 3600.0;
  const totalMolarFlowMolS = (totalMolarFlowKmolH * 1000.0) / 3600.0;

  // Component breakdown
  const componentMolarFlowKmolH: Record<string, number> = {};
  const componentMassFlowKgH: Record<string, number> = {};
  for (const id in normZ) {
    componentMolarFlowKmolH[id] = totalMolarFlowKmolH * normZ[id];
    componentMassFlowKgH[id] = totalMassFlowKgH * massFractions[id];
  }

  // Execute Rigorous TP Flash for phase equilibrium, enthalpy, entropy & density
  const flash: FlashResult = solveTPFlash(TK, Pbar, normZ);

  const densityKgM3 = Math.max(0.1, flash.densityKgM3);
  const totalVolumetricFlowM3H = totalMassFlowKgH / densityKgM3;
  const totalVolumetricFlowM3S = totalMassFlowKgS / densityKgM3;

  return {
    streamId: input.id,
    name: input.name || input.id,
    tag: input.tag || input.id,
    temperatureC: input.temperatureC,
    temperatureK: TK,
    pressureBar: Pbar,
    phase: flash.phase,
    vaporFraction: flash.vaporFraction,
    densityKgM3,
    mwAvg,
    enthalpyKjKg: flash.enthalpyKjPerKg,
    enthalpyJPerMol: flash.enthalpyJPerMol,
    entropyJPerMolK: flash.entropyJPerMolK,
    moleFractions: normZ,
    massFractions,
    totalMassFlowKgH,
    totalMassFlowKgS,
    totalMolarFlowKmolH,
    totalMolarFlowMolS,
    totalVolumetricFlowM3H,
    totalVolumetricFlowM3S,
    componentMolarFlowKmolH,
    componentMassFlowKgH,
    liquidMoleFractions: flash.liquidComposition,
    vaporMoleFractions: flash.vaporComposition,
    kValues: flash.kValues,
    isValid: validation.isValid,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
  };
}

/**
 * Calculates stream state from Enthalpy and Pressure (Isenthalpic / PH flash)
 */
export function calculateStreamStateFromPH(
  id: string,
  targetEnthalpyKjKg: number,
  pressureBar: number,
  totalMassFlowKgH: number,
  composition: Record<string, number>
): StreamCalculationResult {
  // Approximate average MW
  let sumZ = 0;
  let mwAvgEst = 0;
  for (const c in composition) {
    const comp = PURE_COMPONENTS_DB[c] || PURE_COMPONENTS_DB['c1'];
    mwAvgEst += composition[c] * comp.mw;
    sumZ += composition[c];
  }
  mwAvgEst = sumZ > 0 ? mwAvgEst / sumZ : 44.0;
  const targetEnthalpyJPerMol = targetEnthalpyKjKg * mwAvgEst;

  const phResult = solvePHFlash(targetEnthalpyJPerMol, pressureBar, composition);

  return calculateStreamState({
    id,
    temperatureC: phResult.temperatureC,
    pressureBar,
    totalMassFlowKgH,
    composition,
  });
}
