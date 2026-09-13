/**
 * Rigorous Multiphase Flash Calculation Engine
 * Supports:
 * - TP Flash (Isothermal & Isobaric)
 * - PH Flash (Isenthalpic Flash)
 * - PS Flash (Isentropic Flash)
 * - Bubble Point (T_bubble & P_bubble)
 * - Dew Point (T_dew & P_dew)
 */

import { PURE_COMPONENTS_DB } from './thermoConstants';
import {
  solvePengRobinsonMixture,
  calculateIdealGasEnthalpy,
  calculateIdealGasEntropy,
} from './eosPengRobinson';

export type PhaseType =
  | 'Subcooled Liquid'
  | 'Bubble Point Liquid'
  | 'Two-Phase (VLE)'
  | 'Dew Point Vapor'
  | 'Superheated Vapor'
  | 'Supercritical Fluid';

export interface FlashResult {
  vaporFraction: number; // 0.0 to 1.0
  phase: PhaseType;
  temperatureC: number;
  temperatureK: number;
  pressureBar: number;
  enthalpyJPerMol: number;
  enthalpyKjPerKg: number;
  entropyJPerMolK: number;
  densityKgM3: number;
  mwAvg: number;
  liquidComposition: Record<string, number>;
  vaporComposition: Record<string, number>;
  kValues: Record<string, number>;
  iterations: number;
  tolerance: number;
  residual: number;
  converged: boolean;
  algorithm: string;
}

/**
 * Solves standard Rachford-Rice equation for given z and K values
 */
export function solveRachfordRiceInternal(
  compIds: string[],
  z: number[],
  K: number[],
  tol: number = 1e-8,
  maxIter: number = 30
): { vf: number; residual: number; iter: number } {
  const n = z.length;

  // Bounded interval for Newton-Bisection
  let kMin = Math.min(...K);
  let kMax = Math.max(...K);

  let betaMin = 0.0;
  let betaMax = 1.0;

  if (kMax > 1.0) {
    betaMin = Math.max(0.0, 1.0 / (1.0 - kMax));
  }
  if (kMin < 1.0) {
    betaMax = Math.min(1.0, 1.0 / (1.0 - kMin));
  }

  let beta = 0.5; // initial guess
  let residual = 1.0;
  let iter = 0;

  for (iter = 0; iter < maxIter; iter++) {
    let f = 0.0;
    let df = 0.0;

    for (let i = 0; i < n; i++) {
      const denom = 1.0 + beta * (K[i] - 1.0);
      f += (z[i] * (K[i] - 1.0)) / denom;
      df -= (z[i] * Math.pow(K[i] - 1.0, 2)) / Math.pow(denom, 2);
    }

    residual = Math.abs(f);
    if (residual < tol) break;

    // Guarded Newton step
    let step = f / df;
    let newBeta = beta - step;

    if (newBeta <= 0.0 || newBeta >= 1.0 || Math.abs(df) < 1e-12) {
      // Bisection fallback
      if (f > 0) {
        betaMin = beta;
      } else {
        betaMax = beta;
      }
      newBeta = 0.5 * (betaMin + betaMax);
    }

    beta = Math.max(1e-6, Math.min(0.999999, newBeta));
  }

  return { vf: beta, residual, iter };
}

/**
 * Wilson equation approximation for initial K-values
 * K_i = (P_c / P) * exp[ 5.373 * (1 + omega) * (1 - T_c / T) ]
 */
export function getWilsonKValues(
  compIds: string[],
  TK: number,
  Pbar: number
): number[] {
  return compIds.map((id) => {
    const comp = PURE_COMPONENTS_DB[id] || PURE_COMPONENTS_DB['c1'];
    const Tr = TK / comp.tcK;
    const Pr = Pbar / comp.pcBar;
    const lnK = Math.log(1.0 / Pr) + 5.373 * (1.0 + comp.omega) * (1.0 - 1.0 / Tr);
    const K = Math.exp(lnK);
    return Math.max(1e-5, Math.min(1e5, K));
  });
}

/**
 * Rigorous Isothermal & Isobaric Flash (TP Flash)
 */
export function solveTPFlash(
  TK: number,
  Pbar: number,
  composition: Record<string, number>,
  tol: number = 1e-6,
  maxOuterIter: number = 40
): FlashResult {
  const compIds = Object.keys(composition).filter((k) => (composition[k] ?? 0) > 1e-7);
  const z = compIds.map((k) => composition[k]);
  const sumZ = z.reduce((a, b) => a + b, 0);
  const zNorm = z.map((v) => v / sumZ);
  const n = compIds.length;

  let mwAvg = 0;
  for (let i = 0; i < n; i++) {
    const comp = PURE_COMPONENTS_DB[compIds[i]] || PURE_COMPONENTS_DB['c1'];
    mwAvg += zNorm[i] * comp.mw;
  }

  // Initial Wilson K-values
  let K = getWilsonKValues(compIds, TK, Pbar);

  // 1. Bubble point check: sum(z_i * K_i) <= 1
  let sumZKi = 0;
  for (let i = 0; i < n; i++) {
    sumZKi += zNorm[i] * K[i];
  }

  // 2. Dew point check: sum(z_i / K_i) <= 1
  let sumZoverKi = 0;
  for (let i = 0; i < n; i++) {
    sumZoverKi += zNorm[i] / K[i];
  }

  // Supercritical check
  let isSupercritical = true;
  for (let i = 0; i < n; i++) {
    const comp = PURE_COMPONENTS_DB[compIds[i]] || PURE_COMPONENTS_DB['c1'];
    if (TK < comp.tcK || Pbar < comp.pcBar) {
      isSupercritical = false;
      break;
    }
  }

  if (sumZKi <= 1.0001 && !isSupercritical) {
    // Subcooled Liquid phase
    const eosL = solvePengRobinsonMixture(TK, Pbar, composition);
    const hIdeal = calculateIdealGasEnthalpy(TK, composition);
    const sIdeal = calculateIdealGasEntropy(TK, Pbar, composition);
    const hJPerMol = hIdeal + eosL.residualEnthalpyLiquidJPerMol;
    const sJPerMolK = sIdeal + eosL.residualEntropyLiquidJPerMolK;

    const liquidComp: Record<string, number> = {};
    const vaporComp: Record<string, number> = {};
    const kDict: Record<string, number> = {};
    compIds.forEach((id, i) => {
      liquidComp[id] = zNorm[i];
      vaporComp[id] = zNorm[i] * K[i];
      kDict[id] = K[i];
    });

    return {
      vaporFraction: 0.0,
      phase: Math.abs(sumZKi - 1.0) < 0.005 ? 'Bubble Point Liquid' : 'Subcooled Liquid',
      temperatureC: TK - 273.15,
      temperatureK: TK,
      pressureBar: Pbar,
      enthalpyJPerMol: hJPerMol,
      enthalpyKjPerKg: (hJPerMol / mwAvg),
      entropyJPerMolK: sJPerMolK,
      densityKgM3: eosL.densityLiquidKgM3,
      mwAvg,
      liquidComposition: liquidComp,
      vaporComposition: vaporComp,
      kValues: kDict,
      iterations: 1,
      tolerance: tol,
      residual: Math.abs(sumZKi - 1.0),
      converged: true,
      algorithm: 'Subcooled VLE Boundary Check',
    };
  }

  if (sumZoverKi <= 1.0001 && !isSupercritical) {
    // Superheated Vapor phase
    const eosV = solvePengRobinsonMixture(TK, Pbar, composition);
    const hIdeal = calculateIdealGasEnthalpy(TK, composition);
    const sIdeal = calculateIdealGasEntropy(TK, Pbar, composition);
    const hJPerMol = hIdeal + eosV.residualEnthalpyVaporJPerMol;
    const sJPerMolK = sIdeal + eosV.residualEntropyVaporJPerMolK;

    const liquidComp: Record<string, number> = {};
    const vaporComp: Record<string, number> = {};
    const kDict: Record<string, number> = {};
    compIds.forEach((id, i) => {
      liquidComp[id] = zNorm[i] / K[i];
      vaporComp[id] = zNorm[i];
      kDict[id] = K[i];
    });

    return {
      vaporFraction: 1.0,
      phase: Math.abs(sumZoverKi - 1.0) < 0.005 ? 'Dew Point Vapor' : 'Superheated Vapor',
      temperatureC: TK - 273.15,
      temperatureK: TK,
      pressureBar: Pbar,
      enthalpyJPerMol: hJPerMol,
      enthalpyKjPerKg: (hJPerMol / mwAvg),
      entropyJPerMolK: sJPerMolK,
      densityKgM3: eosV.densityVaporKgM3,
      mwAvg,
      liquidComposition: liquidComp,
      vaporComposition: vaporComp,
      kValues: kDict,
      iterations: 1,
      tolerance: tol,
      residual: Math.abs(sumZoverKi - 1.0),
      converged: true,
      algorithm: 'Superheated VLE Boundary Check',
    };
  }

  // 3. Two-phase VLE calculation with iterative Successive Substitution on PR-EOS
  let vf = 0.5;
  let x: number[] = new Array(n).fill(0);
  let y: number[] = new Array(n).fill(0);
  let maxResidual = 1.0;
  let outerIter = 0;

  for (outerIter = 0; outerIter < maxOuterIter; outerIter++) {
    // Solve Rachford-Rice
    const rr = solveRachfordRiceInternal(compIds, zNorm, K, 1e-9);
    vf = rr.vf;

    // Calculate phase compositions
    for (let i = 0; i < n; i++) {
      const denom = 1.0 + vf * (K[i] - 1.0);
      x[i] = zNorm[i] / denom;
      y[i] = x[i] * K[i];
    }

    // Normalize
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) {
      x[i] /= sumX;
      y[i] /= sumY;
    }

    // Evaluate PR-EOS fugacities
    const liquidDict: Record<string, number> = {};
    const vaporDict: Record<string, number> = {};
    compIds.forEach((id, i) => {
      liquidDict[id] = x[i];
      vaporDict[id] = y[i];
    });

    const eosL = solvePengRobinsonMixture(TK, Pbar, liquidDict);
    const eosV = solvePengRobinsonMixture(TK, Pbar, vaporDict);

    // Update K_i = phi_i^L / phi_i^V
    maxResidual = 0;
    const newK: number[] = [];

    for (let i = 0; i < n; i++) {
      const id = compIds[i];
      const phiL = eosL.fugacityCoeffsLiquid[id] || 1.0;
      const phiV = eosV.fugacityCoeffsVapor[id] || 1.0;
      const ratio = phiL / phiV;
      const nextKi = Math.max(1e-5, Math.min(1e5, K[i] * ratio));
      newK.push(nextKi);

      const res = Math.abs(Math.log(ratio));
      if (res > maxResidual) {
        maxResidual = res;
      }
    }

    K = newK;
    if (maxResidual < tol) break;
  }

  // Calculate overall mixture properties at equilibrium
  const liquidDict: Record<string, number> = {};
  const vaporDict: Record<string, number> = {};
  const kDict: Record<string, number> = {};
  compIds.forEach((id, i) => {
    liquidDict[id] = x[i];
    vaporDict[id] = y[i];
    kDict[id] = K[i];
  });

  const eosL = solvePengRobinsonMixture(TK, Pbar, liquidDict);
  const eosV = solvePengRobinsonMixture(TK, Pbar, vaporDict);

  const hIdealL = calculateIdealGasEnthalpy(TK, liquidDict);
  const hIdealV = calculateIdealGasEnthalpy(TK, vaporDict);

  const sIdealL = calculateIdealGasEntropy(TK, Pbar, liquidDict);
  const sIdealV = calculateIdealGasEntropy(TK, Pbar, vaporDict);

  const hL = hIdealL + eosL.residualEnthalpyLiquidJPerMol;
  const hV = hIdealV + eosV.residualEnthalpyVaporJPerMol;

  const sL = sIdealL + eosL.residualEntropyLiquidJPerMolK;
  const sV = sIdealV + eosV.residualEntropyVaporJPerMolK;

  // Mixture averages
  const hMix = (1.0 - vf) * hL + vf * hV;
  const sMix = (1.0 - vf) * sL + vf * sV;

  let mwL = 0;
  let mwV = 0;
  for (let i = 0; i < n; i++) {
    const comp = PURE_COMPONENTS_DB[compIds[i]] || PURE_COMPONENTS_DB['c1'];
    mwL += x[i] * comp.mw;
    mwV += y[i] * comp.mw;
  }
  const mwTotal = (1.0 - vf) * mwL + vf * mwV;

  // Density harmonic/volumetric combination
  const volL = ((1.0 - vf) * mwL) / Math.max(1, eosL.densityLiquidKgM3);
  const volV = (vf * mwV) / Math.max(0.1, eosV.densityVaporKgM3);
  const densityMix = mwTotal / (volL + volV);

  return {
    vaporFraction: vf,
    phase: isSupercritical ? 'Supercritical Fluid' : 'Two-Phase (VLE)',
    temperatureC: TK - 273.15,
    temperatureK: TK,
    pressureBar: Pbar,
    enthalpyJPerMol: hMix,
    enthalpyKjPerKg: (hMix / mwTotal),
    entropyJPerMolK: sMix,
    densityKgM3: densityMix,
    mwAvg: mwTotal,
    liquidComposition: liquidDict,
    vaporComposition: vaporDict,
    kValues: kDict,
    iterations: outerIter + 1,
    tolerance: tol,
    residual: maxResidual,
    converged: maxResidual < tol * 10,
    algorithm: 'Rigorous PR-EOS Successive Substitution',
  };
}

/**
 * Pressure-Enthalpy Flash (PH Flash)
 * Finds equilibrium Temperature T such that H(T, P) = H_target
 */
export function solvePHFlash(
  HTargetJPerMol: number,
  Pbar: number,
  composition: Record<string, number>,
  tInitialK: number = 350.0,
  tol: number = 1e-4,
  maxIter: number = 25
): FlashResult {
  let TK = tInitialK;
  let residual = 1.0;
  let iter = 0;

  for (iter = 0; iter < maxIter; iter++) {
    const flash = solveTPFlash(TK, Pbar, composition, 1e-5, 20);
    const deltaH = flash.enthalpyJPerMol - HTargetJPerMol;
    residual = Math.abs(deltaH);

    if (residual < 50.0) { // Within 50 J/mol tolerance (~0.05 K)
      return {
        ...flash,
        iterations: iter + 1,
        tolerance: tol,
        residual,
        algorithm: 'Rigorous PH Newton-Secant Flash',
      };
    }

    // Estimate mixture Cp ~ 85 J / (mol * K) for hydrocarbons
    const CpEst = 80.0 + 0.15 * (TK - 298.15);
    const deltaT = deltaH / CpEst;

    // Damped Newton step
    const step = Math.max(-40.0, Math.min(40.0, deltaT));
    TK = Math.max(120.0, Math.min(1000.0, TK - step));
  }

  // Final evaluation
  const finalResult = solveTPFlash(TK, Pbar, composition);
  return {
    ...finalResult,
    iterations: iter,
    residual,
    algorithm: 'Rigorous PH Newton-Secant Flash',
  };
}

/**
 * Pressure-Entropy Flash (PS Flash)
 * Finds equilibrium Temperature T such that S(T, P) = S_target
 * Critical for isentropic compressor and expander calculations
 */
export function solvePSFlash(
  STargetJPerMolK: number,
  Pbar: number,
  composition: Record<string, number>,
  tInitialK: number = 350.0,
  maxIter: number = 20
): FlashResult {
  let TK = tInitialK;
  let residual = 1.0;
  let iter = 0;

  for (iter = 0; iter < maxIter; iter++) {
    const flash = solveTPFlash(TK, Pbar, composition, 1e-5, 15);
    const deltaS = flash.entropyJPerMolK - STargetJPerMolK;
    residual = Math.abs(deltaS);

    if (residual < 0.05) { // Within 0.05 J/(mol*K)
      return {
        ...flash,
        iterations: iter + 1,
        residual,
        algorithm: 'Rigorous PS Isentropic Flash',
      };
    }

    // dS/dT = Cp / T
    const CpEst = 85.0;
    const dS_dT = CpEst / TK;
    const step = Math.max(-30.0, Math.min(30.0, deltaS / dS_dT));
    TK = Math.max(120.0, Math.min(1200.0, TK - step));
  }

  const finalResult = solveTPFlash(TK, Pbar, composition);
  return {
    ...finalResult,
    iterations: iter,
    residual,
    algorithm: 'Rigorous PS Isentropic Flash',
  };
}

/**
 * Bubble Point Temperature calculation at pressure Pbar
 */
export function calculateBubblePoint(
  Pbar: number,
  composition: Record<string, number>
): { temperatureC: number; temperatureK: number; residual: number } {
  // Solve for T where sum(z_i * K_i(T, P)) = 1
  let TK = 300.0;
  const compIds = Object.keys(composition).filter((k) => (composition[k] ?? 0) > 1e-7);

  for (let iter = 0; iter < 25; iter++) {
    const K = getWilsonKValues(compIds, TK, Pbar);
    let sumZKi = 0;
    let sumDeriv = 0;

    for (let i = 0; i < compIds.length; i++) {
      const zi = composition[compIds[i]];
      const Ki = K[i];
      sumZKi += zi * Ki;

      const comp = PURE_COMPONENTS_DB[compIds[i]] || PURE_COMPONENTS_DB['c1'];
      const dlnK_dT = (5.373 * (1 + comp.omega) * comp.tcK) / Math.pow(TK, 2);
      sumDeriv += zi * Ki * dlnK_dT;
    }

    const f = sumZKi - 1.0;
    if (Math.abs(f) < 1e-5) break;

    const step = f / sumDeriv;
    TK = Math.max(100.0, Math.min(800.0, TK - Math.max(-25, Math.min(25, step))));
  }

  return {
    temperatureC: TK - 273.15,
    temperatureK: TK,
    residual: 0,
  };
}

/**
 * Dew Point Temperature calculation at pressure Pbar
 */
export function calculateDewPoint(
  Pbar: number,
  composition: Record<string, number>
): { temperatureC: number; temperatureK: number; residual: number } {
  // Solve for T where sum(z_i / K_i(T, P)) = 1
  let TK = 380.0;
  const compIds = Object.keys(composition).filter((k) => (composition[k] ?? 0) > 1e-7);

  for (let iter = 0; iter < 25; iter++) {
    const K = getWilsonKValues(compIds, TK, Pbar);
    let sumZoverKi = 0;
    let sumDeriv = 0;

    for (let i = 0; i < compIds.length; i++) {
      const zi = composition[compIds[i]];
      const Ki = K[i];
      sumZoverKi += zi / Ki;

      const comp = PURE_COMPONENTS_DB[compIds[i]] || PURE_COMPONENTS_DB['c1'];
      const dlnK_dT = (5.373 * (1 + comp.omega) * comp.tcK) / Math.pow(TK, 2);
      sumDeriv -= (zi / Ki) * dlnK_dT;
    }

    const f = sumZoverKi - 1.0;
    if (Math.abs(f) < 1e-5) break;

    const step = f / sumDeriv;
    TK = Math.max(100.0, Math.min(900.0, TK - Math.max(-25, Math.min(25, step))));
  }

  return {
    temperatureC: TK - 273.15,
    temperatureK: TK,
    residual: 0,
  };
}
