/**
 * Absorber and Stripper Column Solver
 * Uses Kremser-Brown-Saunders Analytical Equations & Stage Equilibrium
 */

import { StreamCalculationResult, calculateStreamState } from '../stream/streamCalculator';
import { PURE_COMPONENTS_DB } from '../thermo/thermoConstants';

export interface AbsorberSpec {
  numberOfStages: number; // e.g. 15 trays or packed depth equivalent
  operatingPressureBar: number;
  pressureDropBar?: number;
  temperatureC?: number;
  stageEfficiency?: number; // e.g. 0.65
}

export interface AbsorberResult {
  overheadVaporStream: StreamCalculationResult;
  bottomsLiquidStream: StreamCalculationResult;
  recoveryFractions: Record<string, number>;
  absorptionFactors: Record<string, number>;
  richGasFlowKgH: number;
  leanGasFlowKgH: number;
  richLiquidFlowKgH: number;
  leanLiquidFlowKgH: number;
  dutyKW: number;
  warnings: string[];
}

export interface StripperSpec {
  numberOfStages: number;
  operatingPressureBar: number;
  pressureDropBar?: number;
  reboiled?: boolean; // Reboiled stripper vs steam/gas stripper
  strippingGasRatio?: number; // Gas to liquid molar ratio V/L
}

export interface StripperResult {
  overheadVaporStream: StreamCalculationResult;
  strippedBottomsStream: StreamCalculationResult;
  strippingFractions: Record<string, number>;
  strippingFactors: Record<string, number>;
  dutyKW: number;
  warnings: string[];
}

/**
 * Solves Counter-Current Gas-Liquid Absorber Column
 * Inlets: inlets[0] = Gas Feed (bottom inlet), inlets[1] = Lean Liquid Solvent (top inlet)
 */
export function solveAbsorber(
  unitId: string,
  gasFeed: StreamCalculationResult,
  liquidSolvent: StreamCalculationResult,
  spec: AbsorberSpec
): AbsorberResult {
  const warnings: string[] = [];
  const N = Math.max(2, spec.numberOfStages || 10);
  const pCol = spec.operatingPressureBar || gasFeed.pressureBar;
  const dP = spec.pressureDropBar || 0.15;
  const eff = spec.stageEfficiency || 0.70;

  // Operating temperature (average of gas and liquid inlets)
  const opTempC = spec.temperatureC !== undefined
    ? spec.temperatureC
    : (gasFeed.temperatureC + liquidSolvent.temperatureC) / 2.0;
  const tempK = opTempC + 273.15;

  // Gas and Liquid molar flow rates (kmol/h)
  const gasMW = gasFeed.mwAvg || 20.0;
  const liqMW = liquidSolvent.mwAvg || 120.0;
  const V_kmol_h = gasFeed.totalMassFlowKgH / Math.max(1.0, gasMW);
  const L_kmol_h = liquidSolvent.totalMassFlowKgH / Math.max(1.0, liqMW);

  const recovery: Record<string, number> = {};
  const absorptionFactors: Record<string, number> = {};
  const overheadMoles: Record<string, number> = {};
  const bottomsMoles: Record<string, number> = {};

  let totalOverheadMoles = 0;
  let totalBottomsMoles = 0;

  // Combine component keys
  const allCompKeys = Array.from(
    new Set([...Object.keys(gasFeed.moleFractions), ...Object.keys(liquidSolvent.moleFractions)])
  );

  for (const c of allCompKeys) {
    const comp = PURE_COMPONENTS_DB[c];
    const Pc = comp?.pcBar || 45.0;
    const Tc = comp?.tcK || 420.0;
    const omega = comp?.omega || 0.15;
    const Tr = Math.max(0.2, Math.min(1.0, tempK / Tc));
    const lnPr = 5.92714 - 6.09648 / Tr - 1.28862 * Math.log(Tr) + omega * (15.2518 - 15.6875 / Tr);
    const pVap = Math.min(Pc * 1.5, Math.max(1e-5, Pc * Math.exp(lnPr)));
    const K = Math.max(1e-4, pVap / Math.max(0.1, pCol));

    // Absorption factor A = L / (K * V)
    const A = (L_kmol_h) / Math.max(1e-4, K * V_kmol_h);
    absorptionFactors[c] = parseFloat(A.toFixed(3));

    // Kremser Absorption Equation: fraction absorbed E_A = (A^(N+1) - A) / (A^(N+1) - 1)
    let fracAbsorbed = 0;
    if (Math.abs(A - 1.0) < 1e-3) {
      fracAbsorbed = N / (N + 1.0);
    } else {
      fracAbsorbed = (Math.pow(A, N + 1) - A) / Math.max(1e-4, Math.pow(A, N + 1) - 1.0);
    }
    fracAbsorbed = Math.max(0.0, Math.min(0.999, fracAbsorbed * eff));
    recovery[c] = parseFloat(fracAbsorbed.toFixed(4));

    // Gas inlet moles of c
    const yIn = gasFeed.moleFractions[c] || 0;
    const gasMolesIn = yIn * V_kmol_h;

    // Liquid inlet moles of c
    const xIn = liquidSolvent.moleFractions[c] || 0;
    const liqMolesIn = xIn * L_kmol_h;

    // Absorbed amount
    const molesAbsorbed = gasMolesIn * fracAbsorbed;
    const molesInOverhead = gasMolesIn - molesAbsorbed;
    const molesInBottoms = liqMolesIn + molesAbsorbed;

    overheadMoles[c] = molesInOverhead;
    bottomsMoles[c] = molesInBottoms;
    totalOverheadMoles += molesInOverhead;
    totalBottomsMoles += molesInBottoms;
  }

  // Mole fractions
  const yOverhead: Record<string, number> = {};
  const xBottoms: Record<string, number> = {};
  let mwOverhead = 0;
  let mwBottoms = 0;

  for (const c of allCompKeys) {
    const mw = PURE_COMPONENTS_DB[c]?.mw || 50.0;
    const yFrac = overheadMoles[c] / Math.max(1e-6, totalOverheadMoles);
    const xFrac = bottomsMoles[c] / Math.max(1e-6, totalBottomsMoles);
    yOverhead[c] = yFrac;
    xBottoms[c] = xFrac;
    mwOverhead += yFrac * mw;
    mwBottoms += xFrac * mw;
  }

  const overheadMassKgH = totalOverheadMoles * mwOverhead;
  const bottomsMassKgH = totalBottomsMoles * mwBottoms;

  const overheadVaporStream = calculateStreamState({
    id: `${unitId}_OVERHEAD`,
    name: `${unitId} Clean Gas`,
    temperatureC: opTempC - 2.0,
    pressureBar: pCol - dP,
    totalMassFlowKgH: overheadMassKgH,
    composition: yOverhead,
  });

  const bottomsLiquidStream = calculateStreamState({
    id: `${unitId}_BOTTOMS`,
    name: `${unitId} Rich Solvent`,
    temperatureC: opTempC + 3.5, // Exothermic absorption heat
    pressureBar: pCol,
    totalMassFlowKgH: bottomsMassKgH,
    composition: xBottoms,
  });

  // Exothermic heat of absorption ~250 kJ/kg absorbed
  const massAbsorbedKgH = gasFeed.totalMassFlowKgH - overheadMassKgH;
  const heatDutyKW = (Math.max(0, massAbsorbedKgH) * 250.0) / 3600.0;

  return {
    overheadVaporStream,
    bottomsLiquidStream,
    recoveryFractions: recovery,
    absorptionFactors,
    richGasFlowKgH: gasFeed.totalMassFlowKgH,
    leanGasFlowKgH: overheadMassKgH,
    richLiquidFlowKgH: bottomsMassKgH,
    leanLiquidFlowKgH: liquidSolvent.totalMassFlowKgH,
    dutyKW: parseFloat(heatDutyKW.toFixed(1)),
    warnings,
  };
}

/**
 * Solves Stripper / Desorber Column
 * Inlets: inlets[0] = Rich Liquid Feed (top inlet), inlets[1] = Stripping Vapor / Steam (bottom inlet)
 */
export function solveStripper(
  unitId: string,
  richLiquid: StreamCalculationResult,
  strippingGas: StreamCalculationResult,
  spec: StripperSpec
): StripperResult {
  const warnings: string[] = [];
  const N = Math.max(2, spec.numberOfStages || 8);
  const pCol = spec.operatingPressureBar || richLiquid.pressureBar;
  const dP = spec.pressureDropBar || 0.12;

  const opTempC = (richLiquid.temperatureC + strippingGas.temperatureC) / 2.0;
  const tempK = opTempC + 273.15;

  const liqMW = richLiquid.mwAvg || 100.0;
  const gasMW = strippingGas.mwAvg || 18.0; // e.g. steam or stripping gas
  const L_kmol_h = richLiquid.totalMassFlowKgH / Math.max(1.0, liqMW);
  const V_kmol_h = strippingGas.totalMassFlowKgH / Math.max(1.0, gasMW);

  const strippingFractions: Record<string, number> = {};
  const strippingFactors: Record<string, number> = {};
  const overheadMoles: Record<string, number> = {};
  const bottomsMoles: Record<string, number> = {};

  let totalOverheadMoles = 0;
  let totalBottomsMoles = 0;

  const allCompKeys = Array.from(
    new Set([...Object.keys(richLiquid.moleFractions), ...Object.keys(strippingGas.moleFractions)])
  );

  for (const c of allCompKeys) {
    const comp = PURE_COMPONENTS_DB[c];
    const Pc = comp?.pcBar || 45.0;
    const Tc = comp?.tcK || 420.0;
    const omega = comp?.omega || 0.15;
    const Tr = Math.max(0.2, Math.min(1.0, tempK / Tc));
    const lnPr = 5.92714 - 6.09648 / Tr - 1.28862 * Math.log(Tr) + omega * (15.2518 - 15.6875 / Tr);
    const pVap = Math.min(Pc * 1.5, Math.max(1e-5, Pc * Math.exp(lnPr)));
    const K = Math.max(1e-4, pVap / Math.max(0.1, pCol));

    // Stripping factor S = (K * V) / L
    const S = (K * V_kmol_h) / Math.max(1e-4, L_kmol_h);
    strippingFactors[c] = parseFloat(S.toFixed(3));

    // Kremser Stripping Equation: E_S = (S^(N+1) - S) / (S^(N+1) - 1)
    let fracStripped = 0;
    if (Math.abs(S - 1.0) < 1e-3) {
      fracStripped = N / (N + 1.0);
    } else {
      fracStripped = (Math.pow(S, N + 1) - S) / Math.max(1e-4, Math.pow(S, N + 1) - 1.0);
    }
    fracStripped = Math.max(0.0, Math.min(0.999, fracStripped));
    strippingFractions[c] = parseFloat(fracStripped.toFixed(4));

    const xIn = richLiquid.moleFractions[c] || 0;
    const liqMolesIn = xIn * L_kmol_h;
    const yIn = strippingGas.moleFractions[c] || 0;
    const gasMolesIn = yIn * V_kmol_h;

    const molesStripped = liqMolesIn * fracStripped;
    const molesInBottoms = liqMolesIn - molesStripped;
    const molesInOverhead = gasMolesIn + molesStripped;

    overheadMoles[c] = molesInOverhead;
    bottomsMoles[c] = molesInBottoms;
    totalOverheadMoles += molesInOverhead;
    totalBottomsMoles += molesInBottoms;
  }

  const yOverhead: Record<string, number> = {};
  const xBottoms: Record<string, number> = {};
  let mwOverhead = 0;
  let mwBottoms = 0;

  for (const c of allCompKeys) {
    const mw = PURE_COMPONENTS_DB[c]?.mw || 50.0;
    const yFrac = overheadMoles[c] / Math.max(1e-6, totalOverheadMoles);
    const xFrac = bottomsMoles[c] / Math.max(1e-6, totalBottomsMoles);
    yOverhead[c] = yFrac;
    xBottoms[c] = xFrac;
    mwOverhead += yFrac * mw;
    mwBottoms += xFrac * mw;
  }

  const overheadMassKgH = totalOverheadMoles * mwOverhead;
  const bottomsMassKgH = totalBottomsMoles * mwBottoms;

  const overheadVaporStream = calculateStreamState({
    id: `${unitId}_STRIP_VAP`,
    name: `${unitId} Stripped Vapor`,
    temperatureC: opTempC - 4.0,
    pressureBar: pCol - dP,
    totalMassFlowKgH: overheadMassKgH,
    composition: yOverhead,
  });

  const strippedBottomsStream = calculateStreamState({
    id: `${unitId}_STRIP_BOT`,
    name: `${unitId} Lean Bottoms`,
    temperatureC: opTempC + 1.0,
    pressureBar: pCol,
    totalMassFlowKgH: bottomsMassKgH,
    composition: xBottoms,
  });

  // Endothermic stripping duty
  const massStrippedKgH = overheadMassKgH - strippingGas.totalMassFlowKgH;
  const dutyKW = (Math.max(0, massStrippedKgH) * 280.0) / 3600.0;

  return {
    overheadVaporStream,
    strippedBottomsStream,
    strippingFractions,
    strippingFactors,
    dutyKW: parseFloat(dutyKW.toFixed(1)),
    warnings,
  };
}
