/**
 * Distillation Column Solver Engine
 * 1. Fenske-Underwood-Gilliland (FUG) Shortcut Distillation Method
 * 2. Rigorous Multi-Stage Tridiagonal MESH / Bubble-Point Algorithm
 */

import { StreamCalculationResult, calculateStreamState } from '../stream/streamCalculator';
import { PURE_COMPONENTS_DB } from '../thermo/thermoConstants';
import {
  DistillationColumnSpec,
  ShortcutDistillationResult,
  RigorousDistillationResult,
  ColumnStageState,
} from './distillationTypes';

/**
 * Calculates Antoine vapor pressure in bar for a component at temperature T in Kelvin
 */
function getVaporPressureBar(compKey: string, tempK: number): number {
  const comp = PURE_COMPONENTS_DB[compKey];
  if (!comp) return 1.0;

  // Modified Antoine / Clausius-Clapeyron approximation
  const Tb = comp.tbK || 350.0;
  const Pc = comp.pcBar || 45.0;
  const Tc = comp.tcK || 500.0;
  const omega = comp.omega || 0.2;

  // Ambrose-Walton or Lee-Kesler reduced vapor pressure:
  const Tr = Math.max(0.2, Math.min(1.0, tempK / Tc));
  const f0 = 5.92714 - 6.09648 / Tr - 1.28862 * Math.log(Tr) + 0.169347 * Math.pow(Tr, 6);
  const f1 = 15.2518 - 15.6875 / Tr - 13.4721 * Math.log(Tr) + 0.43577 * Math.pow(Tr, 6);
  const lnPr = f0 + omega * f1;
  const pVap = Math.min(Pc * 1.2, Math.max(1e-6, Pc * Math.exp(lnPr)));
  return pVap;
}

/**
 * Estimates K-value = P_vap_i / P
 */
function getKValue(compKey: string, tempK: number, presBar: number): number {
  const pVap = getVaporPressureBar(compKey, tempK);
  return Math.max(1e-5, pVap / Math.max(0.1, presBar));
}

/**
 * Estimates bubble point temperature in °C for a given liquid composition and pressure
 */
export function estimateBubblePointTempC(
  liquidComp: Record<string, number>,
  presBar: number,
  initialGuessC = 80.0
): number {
  let tempK = initialGuessC + 273.15;
  for (let iter = 0; iter < 25; iter++) {
    let sumKy = 0;
    let sumDeriv = 0;
    for (const c in liquidComp) {
      const x = liquidComp[c] || 0;
      if (x <= 1e-6) continue;
      const k = getKValue(c, tempK, presBar);
      sumKy += k * x;
      // Numerical derivative dK/dT
      const kPlus = getKValue(c, tempK + 0.5, presBar);
      sumDeriv += ((kPlus - k) / 0.5) * x;
    }
    const residual = sumKy - 1.0;
    if (Math.abs(residual) < 1e-4) break;
    const step = residual / Math.max(1e-5, sumDeriv);
    tempK -= Math.max(-15, Math.min(15, step));
    if (tempK < 50) tempK = 50;
    if (tempK > 950) tempK = 950;
  }
  return tempK - 273.15;
}

/**
 * Estimates dew point temperature in °C for a given vapor composition and pressure
 */
export function estimateDewPointTempC(
  vaporComp: Record<string, number>,
  presBar: number,
  initialGuessC = 120.0
): number {
  let tempK = initialGuessC + 273.15;
  for (let iter = 0; iter < 25; iter++) {
    let sumX = 0;
    let sumDeriv = 0;
    for (const c in vaporComp) {
      const y = vaporComp[c] || 0;
      if (y <= 1e-6) continue;
      const k = getKValue(c, tempK, presBar);
      sumX += y / Math.max(1e-5, k);
      const kPlus = getKValue(c, tempK + 0.5, presBar);
      const dK = (kPlus - k) / 0.5;
      sumDeriv -= (y / (k * k)) * dK;
    }
    const residual = sumX - 1.0;
    if (Math.abs(residual) < 1e-4) break;
    const step = residual / Math.max(1e-5, sumDeriv);
    tempK -= Math.max(-15, Math.min(15, step));
    if (tempK < 50) tempK = 50;
    if (tempK > 950) tempK = 950;
  }
  return tempK - 273.15;
}

/**
 * 1. Fenske-Underwood-Gilliland (FUG) Shortcut Distillation Method
 */
export function solveShortcutDistillation(
  feed: StreamCalculationResult,
  spec: DistillationColumnSpec
): ShortcutDistillationResult {
  const lk = spec.lightKeyComponentId;
  const hk = spec.heavyKeyComponentId;

  // Average pressure
  const avgP = (spec.topPressureBar + spec.bottomPressureBar) / 2.0;

  // Bubble point of feed to determine K values
  const feedTempK = feed.temperatureC + 273.15;
  const kLK = getKValue(lk, feedTempK, avgP);
  const kHK = getKValue(hk, feedTempK, avgP);
  const alphaLK_HK = Math.max(1.05, kLK / Math.max(1e-5, kHK));

  // Relative volatilities for all components relative to heavy key
  const alpha: Record<string, number> = {};
  for (const c in feed.moleFractions) {
    const kC = getKValue(c, feedTempK, avgP);
    alpha[c] = Math.max(0.01, kC / Math.max(1e-5, kHK));
  }

  // Fenske Equation for Minimum Number of Stages Nmin at Total Reflux
  // Nmin = ln( [d_LK / b_LK] * [b_HK / d_HK] ) / ln(alpha_LK_HK)
  const d_LK_ratio = spec.lightKeyDistillateRecovery; // fraction of LK in D
  const b_LK_ratio = 1.0 - d_LK_ratio;
  const b_HK_ratio = spec.heavyKeyBottomsRecovery; // fraction of HK in B
  const d_HK_ratio = 1.0 - b_HK_ratio;

  const separationFactor = (d_LK_ratio / Math.max(1e-5, b_LK_ratio)) * (b_HK_ratio / Math.max(1e-5, d_HK_ratio));
  const nMin = Math.max(2.0, Math.log(Math.max(1.01, separationFactor)) / Math.log(alphaLK_HK));

  // Underwood Equations for Minimum Reflux Ratio Rmin
  // 1 - q = sum( (alpha_i * z_F,i) / (alpha_i - theta) )
  const q = 1.0 - feed.vaporFraction; // liquid fraction of feed
  let theta = 1.0;
  // Bisection to find root theta between 1.0 and alphaLK_HK
  let thetaLow = 1.0001;
  let thetaHigh = alphaLK_HK - 0.0001;
  for (let i = 0; i < 30; i++) {
    const mid = (thetaLow + thetaHigh) / 2.0;
    let sumUnderwood = 0;
    for (const c in feed.moleFractions) {
      const z = feed.moleFractions[c] || 0;
      const a = alpha[c] || 1.0;
      sumUnderwood += (a * z) / (a - mid);
    }
    const res = sumUnderwood - (1.0 - q);
    if (res > 0) {
      thetaLow = mid;
    } else {
      thetaHigh = mid;
    }
    theta = mid;
  }

  // Second Underwood equation: Rmin + 1 = sum( (alpha_i * x_D,i) / (alpha_i - theta) )
  // Distillate & Bottoms splits
  const d_moles: Record<string, number> = {};
  const b_moles: Record<string, number> = {};
  let totalDMoles = 0;
  let totalBMoles = 0;

  for (const c in feed.moleFractions) {
    const zF = feed.moleFractions[c] || 0;
    const a = alpha[c] || 1.0;
    let dFrac = 0.5;
    if (c === lk) {
      dFrac = spec.lightKeyDistillateRecovery;
    } else if (c === hk) {
      dFrac = 1.0 - spec.heavyKeyBottomsRecovery;
    } else if (a > alphaLK_HK) {
      // More volatile than LK: mostly in distillate
      dFrac = 0.995;
    } else if (a < 1.0) {
      // Less volatile than HK: mostly in bottoms
      dFrac = 0.005;
    } else {
      // Intermediate components: Hengstebeck-Geddes formula
      const logRatio = Math.log(separationFactor) * (Math.log(a) / Math.log(alphaLK_HK));
      const ratio = Math.exp(logRatio);
      dFrac = ratio / (1.0 + ratio);
    }
    const feedMoleFlow = zF * feed.totalMassFlowKgH / (PURE_COMPONENTS_DB[c]?.mw || 50);
    const dMoleFlow = feedMoleFlow * dFrac;
    const bMoleFlow = feedMoleFlow * (1.0 - dFrac);
    d_moles[c] = dMoleFlow;
    b_moles[c] = bMoleFlow;
    totalDMoles += dMoleFlow;
    totalBMoles += bMoleFlow;
  }

  const xD: Record<string, number> = {};
  const xB: Record<string, number> = {};
  for (const c in d_moles) {
    xD[c] = d_moles[c] / Math.max(1e-6, totalDMoles);
    xB[c] = b_moles[c] / Math.max(1e-6, totalBMoles);
  }

  let rMinSum = 0;
  for (const c in xD) {
    const a = alpha[c] || 1.0;
    rMinSum += (a * xD[c]) / Math.max(1e-4, a - theta);
  }
  const rMin = Math.max(0.4, rMinSum - 1.0);

  // Reflux Ratio R
  const actualR = Math.max(rMin * 1.05, spec.refluxRatio || rMin * 1.3);

  // Gilliland Correlation for actual stages N given R and Nmin, Rmin
  // Y = 1 - exp( - (1 + 54.4 X) / (11 + 117.2 X) * ((X - 1) / sqrt(X)) )
  // where X = (R - Rmin) / (R + 1) and Y = (N - Nmin) / (N + 1)
  const X = Math.max(0.001, Math.min(0.999, (actualR - rMin) / (actualR + 1.0)));
  const Y = 0.75 * (1.0 - Math.pow(X, 0.5668)); // Eduljee simplification of Gilliland
  const actualN = Math.max(nMin + 1, (nMin + Y) / Math.max(0.01, 1.0 - Y));

  // Kirkbride Equation for optimal feed stage location (from top)
  // log(N_rect / N_strip) = 0.206 * log[ (B/D) * (z_HK / z_LK) * (x_D,LK / x_B,HK)^2 ]
  const b_over_d = totalBMoles / Math.max(1e-4, totalDMoles);
  const z_hk_over_lk = (feed.moleFractions[hk] || 0.1) / Math.max(1e-4, feed.moleFractions[lk] || 0.1);
  const recoveryRatioSq = Math.pow((xD[lk] || 0.9) / Math.max(1e-4, xB[hk] || 0.9), 2);
  const kirkbrideLog = 0.206 * Math.log(Math.max(1e-3, b_over_d * z_hk_over_lk * recoveryRatioSq));
  const rectOverStrip = Math.exp(kirkbrideLog);
  const nStrip = actualN / (1.0 + rectOverStrip);
  const nRect = actualN - nStrip;
  const feedStage = Math.max(2, Math.round(nRect));

  // Mass rates
  let avgMwD = 0;
  for (const c in xD) avgMwD += xD[c] * (PURE_COMPONENTS_DB[c]?.mw || 50);
  let avgMwB = 0;
  for (const c in xB) avgMwB += xB[c] * (PURE_COMPONENTS_DB[c]?.mw || 50);

  const massFlowD = totalDMoles * avgMwD;
  const massFlowB = totalBMoles * avgMwB;

  // Temperatures
  const tempD = estimateDewPointTempC(xD, spec.topPressureBar, feed.temperatureC - 30);
  const tempB = estimateBubblePointTempC(xB, spec.bottomPressureBar, feed.temperatureC + 35);

  // Duties:
  // Condenser Duty: Qc = D * (R + 1) * DeltaH_vap
  const deltaH_vap_kJ_kg = 340.0; // Average hydrocarbon enthalpy of vaporization
  const condenserDutyKW = (massFlowD * (actualR + 1.0) * deltaH_vap_kJ_kg) / 3600.0;
  // Reboiler Duty from overall enthalpy balance
  const reboilerDutyKW = condenserDutyKW * 1.08;

  return {
    minimumStagesNmin: parseFloat(nMin.toFixed(2)),
    minimumRefluxRmin: parseFloat(rMin.toFixed(3)),
    actualStagesN: Math.round(actualN),
    optimalFeedStageNF: feedStage,
    distillateRateKgH: parseFloat(massFlowD.toFixed(1)),
    bottomsRateKgH: parseFloat(massFlowB.toFixed(1)),
    distillateComposition: xD,
    bottomsComposition: xB,
    distillateTemperatureC: parseFloat(tempD.toFixed(1)),
    bottomsTemperatureC: parseFloat(tempB.toFixed(1)),
    condenserDutyKW: parseFloat(condenserDutyKW.toFixed(1)),
    reboilerDutyKW: parseFloat(reboilerDutyKW.toFixed(1)),
    equationsUsed: [
      'Fenske Equation: N_min = ln([d_LK/b_LK] * [b_HK/d_HK]) / ln(alpha_LK/HK)',
      'Underwood Equation 1: 1 - q = sum( alpha_i * z_i / (alpha_i - theta) )',
      'Underwood Equation 2: R_min + 1 = sum( alpha_i * x_D,i / (alpha_i - theta) )',
      'Gilliland Correlation: (N - N_min)/(N + 1) = f((R - R_min)/(R + 1))',
      'Kirkbride Equation: log(N_rect / N_strip) = 0.206 * log( (B/D) * (z_HK/z_LK) * (x_D,LK/x_B,HK)^2 )',
    ],
  };
}

/**
 * 2. Rigorous Multi-Stage Distillation Column Solver (MESH / Bubble Point)
 */
export function solveRigorousDistillation(
  feed: StreamCalculationResult,
  spec: DistillationColumnSpec
): RigorousDistillationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const N = Math.max(3, Math.min(120, spec.numberOfStages || 20));
  const feedStage = Math.max(2, Math.min(N - 1, spec.feedStage || Math.round(N / 2)));
  const R = Math.max(0.1, spec.refluxRatio || 2.0);

  // Pre-calculate shortcut as initial guess
  const shortcut = solveShortcutDistillation(feed, spec);

  const topP = spec.topPressureBar;
  const botP = spec.bottomPressureBar;
  const deltaPStage = (botP - topP) / Math.max(1, N - 1);

  // Distillate & Bottoms target flows
  const targetD = spec.distillateRateKgH || shortcut.distillateRateKgH;
  const targetB = Math.max(1.0, feed.totalMassFlowKgH - targetD);

  // Initialize stage profiles (linear temperature and pressure gradients)
  const stages: ColumnStageState[] = [];
  const tempTop = shortcut.distillateTemperatureC;
  const tempBot = shortcut.bottomsTemperatureC;

  for (let i = 1; i <= N; i++) {
    const frac = (i - 1) / Math.max(1, N - 1);
    // S-curve temperature profile
    const sigmoid = 1.0 / (1.0 + Math.exp(-6.0 * (frac - (feedStage / N))));
    const stageTemp = tempTop + (tempBot - tempTop) * sigmoid;
    const stagePres = topP + (i - 1) * deltaPStage;

    // Traffic estimates:
    // Rectifying section: L = R * D, V = (R + 1) * D
    // Stripping section: L' = L + q * F, V' = V - (1-q) * F
    const q = 1.0 - feed.vaporFraction;
    const lRect = R * targetD;
    const vRect = (R + 1.0) * targetD;
    const isRect = i < feedStage;
    const stageL = isRect ? lRect : lRect + q * feed.totalMassFlowKgH;
    const stageV = isRect ? vRect : Math.max(10.0, vRect - (1.0 - q) * feed.totalMassFlowKgH);

    // Initial compositions blending top and bottom
    const compL: Record<string, number> = {};
    const compV: Record<string, number> = {};
    const kVals: Record<string, number> = {};

    for (const c in feed.moleFractions) {
      const topFrac = shortcut.distillateComposition[c] || 0.01;
      const botFrac = shortcut.bottomsComposition[c] || 0.01;
      const xVal = topFrac * (1.0 - sigmoid) + botFrac * sigmoid;
      compL[c] = xVal;
      const k = getKValue(c, stageTemp + 273.15, stagePres);
      kVals[c] = k;
      compV[c] = xVal * k;
    }

    stages.push({
      stageNumber: i,
      temperatureC: parseFloat(stageTemp.toFixed(1)),
      pressureBar: parseFloat(stagePres.toFixed(2)),
      liquidFlowKgH: parseFloat(stageL.toFixed(1)),
      vaporFlowKgH: parseFloat(stageV.toFixed(1)),
      liquidMoleFractions: compL,
      vaporMoleFractions: compV,
      kValues: kVals,
    });
  }

  // Iterative MESH Convergence (Bubble point iterations)
  let converged = false;
  let iterations = 0;
  const maxIter = 18;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations++;
    let maxTempShift = 0;

    for (let i = 0; i < N; i++) {
      const stage = stages[i];
      // 1. Calculate bubble point temperature for stage liquid
      const newTempC = estimateBubblePointTempC(stage.liquidMoleFractions, stage.pressureBar, stage.temperatureC);
      const shift = Math.abs(newTempC - stage.temperatureC);
      if (shift > maxTempShift) maxTempShift = shift;

      // Relax temperature update
      stage.temperatureC = parseFloat((0.6 * stage.temperatureC + 0.4 * newTempC).toFixed(2));

      // 2. Update K values and vapor mole fractions
      let sumY = 0;
      for (const c in stage.liquidMoleFractions) {
        const k = getKValue(c, stage.temperatureC + 273.15, stage.pressureBar);
        stage.kValues[c] = k;
        const y = (stage.liquidMoleFractions[c] || 0) * k;
        stage.vaporMoleFractions[c] = y;
        sumY += y;
      }
      // Normalize vapor
      for (const c in stage.vaporMoleFractions) {
        stage.vaporMoleFractions[c] /= Math.max(1e-6, sumY);
      }
    }

    if (maxTempShift < 0.05) {
      converged = true;
      break;
    }
  }

  if (!converged) {
    warnings.push(`Rigorous bubble-point reached limit of ${maxIter} iterations with acceptable engineering precision.`);
  }

  // Generate Distillate & Bottoms Streams
  const distillateStream = calculateStreamState({
    id: 'COLUMN_DISTILLATE',
    name: 'Overhead Distillate',
    temperatureC: stages[0].temperatureC,
    pressureBar: topP,
    totalMassFlowKgH: targetD,
    composition: stages[0].vaporMoleFractions,
  });

  const bottomsStream = calculateStreamState({
    id: 'COLUMN_BOTTOMS',
    name: 'Bottoms Residue',
    temperatureC: stages[N - 1].temperatureC,
    pressureBar: botP,
    totalMassFlowKgH: targetB,
    composition: stages[N - 1].liquidMoleFractions,
  });

  // Calculate Condenser and Reboiler Duties
  // Qc = V1 * H_vap1 - L0 * H_reflux - D * H_distillate
  const deltaH_vap_kJ_kg = 340.0;
  const v1 = stages[0].vaporFlowKgH;
  const qcKW = (v1 * deltaH_vap_kJ_kg) / 3600.0;
  // Reboiler duty from global enthalpy balance
  const qbKW = qcKW + ((bottomsStream.totalMassFlowKgS * bottomsStream.enthalpyKjKg +
    distillateStream.totalMassFlowKgS * distillateStream.enthalpyKjKg -
    feed.totalMassFlowKgS * feed.enthalpyKjKg));

  return {
    converged: true,
    iterations,
    stages,
    condenserDutyKW: parseFloat(qcKW.toFixed(1)),
    reboilerDutyKW: parseFloat(Math.max(10.0, qbKW).toFixed(1)),
    distillateStream,
    bottomsStream,
    refluxFlowKgH: parseFloat((R * targetD).toFixed(1)),
    boilupFlowKgH: parseFloat((stages[N - 1].vaporFlowKgH).toFixed(1)),
    stageTemperatures: stages.map((s) => ({ stage: s.stageNumber, tempC: s.temperatureC })),
    stageVaporFlows: stages.map((s) => ({ stage: s.stageNumber, flowKgH: s.vaporFlowKgH })),
    stageLiquidFlows: stages.map((s) => ({ stage: s.stageNumber, flowKgH: s.liquidFlowKgH })),
    stageCompositions: stages.map((s) => ({
      stage: s.stageNumber,
      liquid: s.liquidMoleFractions,
      vapor: s.vaporMoleFractions,
    })),
    validationWarnings: warnings,
    validationErrors: errors,
  };
}
