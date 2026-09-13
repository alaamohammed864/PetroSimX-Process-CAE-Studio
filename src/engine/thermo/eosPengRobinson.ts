/**
 * Peng-Robinson Equation of State (PR-EOS) Engine
 * With Boston-Mathias Supercritical Alpha Function and van der Waals Mixing Rules
 */

import { R_GAS, PURE_COMPONENTS_DB, getBinaryInteraction, PureComponentData } from './thermoConstants';

export interface EOSStateResult {
  zVapor: number;
  zLiquid: number;
  densityVaporKgM3: number;
  densityLiquidKgM3: number;
  fugacityCoeffsVapor: Record<string, number>;
  fugacityCoeffsLiquid: Record<string, number>;
  residualEnthalpyVaporJPerMol: number;
  residualEnthalpyLiquidJPerMol: number;
  residualEntropyVaporJPerMolK: number;
  residualEntropyLiquidJPerMolK: number;
}

export interface PurePRParameters {
  a: number; // Pa * (m^3 / mol)^2
  b: number; // m^3 / mol
  alpha: number;
  dalpha_dT: number;
  mw: number;
}

/**
 * Calculates pure component PR parameters at temperature T_K
 */
export function calculatePurePR(comp: PureComponentData, TK: number): PurePRParameters {
  const R = R_GAS;
  const Tc = comp.tcK;
  const Pc = comp.pcBar * 1e5; // Convert bar to Pa
  const Tr = TK / Tc;
  const omega = comp.omega;

  // Standard PR kappa
  let kappa = 0.37464 + 1.54226 * omega - 0.26992 * omega * omega;
  if (omega > 0.49) {
    // Graboski-Daubert modification for heavy hydrocarbons
    kappa = 0.379642 + 1.48503 * omega - 0.164423 * omega * omega + 0.016666 * Math.pow(omega, 3);
  }

  let alpha: number;
  let dalpha_dT: number;

  if (Tr <= 1.0) {
    const sqrtTr = Math.sqrt(Tr);
    const term = 1 + kappa * (1 - sqrtTr);
    alpha = term * term;
    dalpha_dT = -kappa * term / (sqrtTr * Tc);
  } else {
    // Boston-Mathias extrapolation for Tr > 1.0 (Hydrogen, Methane, etc.)
    const m = kappa;
    const d = 1 + (m / 2);
    const p = 0.5;
    const term = 1 + m * (1 - Math.sqrt(Tr)) - p * (1 - Tr) * (d - Tr);
    alpha = Math.max(0.01, term * term);
    dalpha_dT = 2 * term * (-m / (2 * Math.sqrt(Tr) * Tc) + p * (d - 2 * Tr + 1) / Tc);
  }

  const a0 = 0.45724 * Math.pow(R * Tc, 2) / Pc;
  const a = a0 * alpha;
  const b = 0.07780 * R * Tc / Pc;

  return {
    a,
    b,
    alpha,
    dalpha_dT: a0 * dalpha_dT,
    mw: comp.mw,
  };
}

/**
 * Solves cubic polynomial: Z^3 + c2*Z^2 + c1*Z + c0 = 0
 * Uses analytical Cardano formula for real roots.
 */
export function solveCubicRoots(c2: number, c1: number, c0: number): number[] {
  // Depressed cubic: y^3 + p*y + q = 0, where Z = y - c2/3
  const a = c2;
  const b = c1;
  const c = c0;

  const a_third = a / 3.0;
  const p = b - a * a_third;
  const q = c - a_third * b + 2.0 * Math.pow(a_third, 3);

  const half_q = q / 2.0;
  const third_p = p / 3.0;
  const D = Math.pow(half_q, 2) + Math.pow(third_p, 3); // Discriminant

  const roots: number[] = [];

  if (D > 1e-12) {
    // One real root
    const sqrtD = Math.sqrt(D);
    const u = Math.cbrt(-half_q + sqrtD);
    const v = Math.cbrt(-half_q - sqrtD);
    roots.push(u + v - a_third);
  } else if (Math.abs(D) <= 1e-12) {
    // Three real roots, at least two are equal
    const u = Math.cbrt(-half_q);
    roots.push(2 * u - a_third);
    roots.push(-u - a_third);
  } else {
    // Three distinct real roots (trigonometric method)
    const r = Math.sqrt(-Math.pow(third_p, 3));
    const phi = Math.acos(Math.max(-1.0, Math.min(1.0, -half_q / r)));
    const m = 2.0 * Math.cbrt(r);

    const r1 = m * Math.cos(phi / 3.0) - a_third;
    const r2 = m * Math.cos((phi + 2.0 * Math.PI) / 3.0) - a_third;
    const r3 = m * Math.cos((phi + 4.0 * Math.PI) / 3.0) - a_third;

    roots.push(r1, r2, r3);
  }

  // Filter out any NaN or non-finite roots and sort ascending
  return roots.filter((r) => Number.isFinite(r)).sort((x, y) => x - y);
}

/**
 * Solves PR-EOS mixture properties at T_K and P_bar for mole fraction vector z
 */
export function solvePengRobinsonMixture(
  TK: number,
  Pbar: number,
  composition: Record<string, number>
): EOSStateResult {
  const P_Pa = Pbar * 1e5;
  const R = R_GAS;

  const compIds = Object.keys(composition).filter((k) => (composition[k] ?? 0) > 1e-7);
  const z: number[] = [];
  let sumZ = 0;
  for (const id of compIds) {
    const val = composition[id];
    z.push(val);
    sumZ += val;
  }
  // Normalize mole fractions
  for (let i = 0; i < z.length; i++) {
    z[i] /= sumZ;
  }

  // Pure component parameters
  const pureParams: PurePRParameters[] = compIds.map((id) => {
    const data = PURE_COMPONENTS_DB[id] || PURE_COMPONENTS_DB['c1'];
    return calculatePurePR(data, TK);
  });

  const n = compIds.length;
  let am = 0;
  let bm = 0;
  let dam_dT = 0;
  let mwAvg = 0;

  // Cross parameters matrix a_ij
  const aCross: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    bm += z[i] * pureParams[i].b;
    mwAvg += z[i] * pureParams[i].mw;

    for (let j = 0; j < n; j++) {
      const kij = getBinaryInteraction(compIds[i], compIds[j]);
      const aij = Math.sqrt(pureParams[i].a * pureParams[j].a) * (1 - kij);
      aCross[i][j] = aij;
      am += z[i] * z[j] * aij;

      // Derivative with respect to T
      const da_ij_dT =
        0.5 *
        (1 - kij) *
        (pureParams[i].dalpha_dT * Math.sqrt(pureParams[j].a / pureParams[i].a) +
          pureParams[j].dalpha_dT * Math.sqrt(pureParams[i].a / pureParams[j].a));
      dam_dT += z[i] * z[j] * da_ij_dT;
    }
  }

  const A = (am * P_Pa) / Math.pow(R * TK, 2);
  const B = (bm * P_Pa) / (R * TK);

  // Cubic equation coefficients for Z:
  // Z^3 - (1 - B)*Z^2 + (A - 3*B^2 - 2*B)*Z - (A*B - B^2 - B^3) = 0
  const c2 = -(1 - B);
  const c1 = A - 3 * B * B - 2 * B;
  const c0 = -(A * B - B * B - Math.pow(B, 3));

  const allRoots = solveCubicRoots(c2, c1, c0);
  const validRoots = allRoots.filter((root) => root > B && root > 0.001);

  let zLiquid = validRoots.length > 0 ? validRoots[0] : 0.05;
  let zVapor = validRoots.length > 0 ? validRoots[validRoots.length - 1] : 0.95;

  // Fugacity coefficients calculation
  const fugacityV: Record<string, number> = {};
  const fugacityL: Record<string, number> = {};

  const sqrt2 = Math.SQRT2;
  const termSqrt = 2 * Math.SQRT2;

  const calculateLnPhi = (Zv: number) => {
    const lnPhiList: number[] = [];
    if (Zv <= B) {
      return compIds.map(() => 1.0);
    }
    const logZminusB = Math.log(Zv - B);
    const logArg = (Zv + (1 + sqrt2) * B) / (Zv + (1 - sqrt2) * B);
    const logRatio = Math.log(Math.max(1e-12, logArg));

    for (let i = 0; i < n; i++) {
      let sumCross = 0;
      for (let j = 0; j < n; j++) {
        sumCross += z[j] * aCross[i][j];
      }
      const bi_over_b = pureParams[i].b / bm;
      const lnPhi_i =
        bi_over_b * (Zv - 1) -
        logZminusB -
        (A / (termSqrt * B)) * ( (2 * sumCross) / am - bi_over_b ) * logRatio;
      lnPhiList.push(lnPhi_i);
    }
    return lnPhiList;
  };

  const lnPhiV = calculateLnPhi(zVapor);
  const lnPhiL = calculateLnPhi(zLiquid);

  for (let i = 0; i < n; i++) {
    fugacityV[compIds[i]] = Math.exp(lnPhiV[i]);
    fugacityL[compIds[i]] = Math.exp(lnPhiL[i]);
  }

  // Enthalpy departure (residual enthalpy): H - H_ideal
  const calculateResidualH = (Z: number) => {
    if (Z <= B) return 0;
    const logArg = (Z + (1 + sqrt2) * B) / (Z + (1 - sqrt2) * B);
    const logRatio = Math.log(Math.max(1e-12, logArg));
    return R * TK * (Z - 1) + ((TK * dam_dT - am) / (termSqrt * bm)) * logRatio;
  };

  // Entropy departure (residual entropy): S - S_ideal
  const calculateResidualS = (Z: number) => {
    if (Z <= B) return 0;
    const logArg = (Z + (1 + sqrt2) * B) / (Z + (1 - sqrt2) * B);
    const logRatio = Math.log(Math.max(1e-12, logArg));
    return R * Math.log(Math.max(1e-12, Z - B)) + (dam_dT / (termSqrt * bm)) * logRatio;
  };

  const residualEnthalpyV = calculateResidualH(zVapor);
  const residualEnthalpyL = calculateResidualH(zLiquid);
  const residualEntropyV = calculateResidualS(zVapor);
  const residualEntropyL = calculateResidualS(zLiquid);

  // Densities in kg/m^3: rho = (P * MW) / (Z * R * T)
  const vMolarV = (zVapor * R * TK) / P_Pa; // m^3 / mol
  const vMolarL = (zLiquid * R * TK) / P_Pa; // m^3 / mol

  const densityVapor = (mwAvg * 1e-3) / Math.max(1e-6, vMolarV);
  const densityLiquid = (mwAvg * 1e-3) / Math.max(1e-6, vMolarL);

  return {
    zVapor,
    zLiquid,
    densityVaporKgM3: Math.max(0.1, densityVapor),
    densityLiquidKgM3: Math.max(100, densityLiquid),
    fugacityCoeffsVapor: fugacityV,
    fugacityCoeffsLiquid: fugacityL,
    residualEnthalpyVaporJPerMol: residualEnthalpyV,
    residualEnthalpyLiquidJPerMol: residualEnthalpyL,
    residualEntropyVaporJPerMolK: residualEntropyV,
    residualEntropyLiquidJPerMolK: residualEntropyL,
  };
}

/**
 * Calculates Ideal Gas Enthalpy in J/mol at T_K relative to 298.15 K
 */
export function calculateIdealGasEnthalpy(TK: number, composition: Record<string, number>): number {
  const Tref = 298.15;
  let hIdeal = 0;
  let sumZ = 0;

  for (const id in composition) {
    const zi = composition[id];
    if (zi <= 0) continue;
    sumZ += zi;
    const comp = PURE_COMPONENTS_DB[id] || PURE_COMPONENTS_DB['c1'];
    const [A, B, C, D] = comp.cpCoeffs;

    // Integral of (A + B*T + C*T^2 + D*T^3) dT from Tref to T
    const deltaT = TK - Tref;
    const deltaT2 = Math.pow(TK, 2) - Math.pow(Tref, 2);
    const deltaT3 = Math.pow(TK, 3) - Math.pow(Tref, 3);
    const deltaT4 = Math.pow(TK, 4) - Math.pow(Tref, 4);

    const hi = A * deltaT + (B / 2) * deltaT2 + (C / 3) * deltaT3 + (D / 4) * deltaT4;
    hIdeal += zi * hi;
  }

  return sumZ > 0 ? hIdeal / sumZ : 0;
}

/**
 * Calculates Ideal Gas Entropy in J/(mol * K) at T_K and P_bar relative to 298.15 K, 1.01325 bar
 */
export function calculateIdealGasEntropy(TK: number, Pbar: number, composition: Record<string, number>): number {
  const Tref = 298.15;
  const Pref = 1.01325;
  const R = R_GAS;
  let sIdeal = 0;
  let sumZ = 0;

  for (const id in composition) {
    const zi = composition[id];
    if (zi <= 0) continue;
    sumZ += zi;
    const comp = PURE_COMPONENTS_DB[id] || PURE_COMPONENTS_DB['c1'];
    const [A, B, C, D] = comp.cpCoeffs;

    // Integral of (A/T + B + C*T + D*T^2) dT from Tref to T
    const lnTratio = Math.log(TK / Tref);
    const deltaT = TK - Tref;
    const deltaT2 = Math.pow(TK, 2) - Math.pow(Tref, 2);
    const deltaT3 = Math.pow(TK, 3) - Math.pow(Tref, 3);

    const si_temp = A * lnTratio + B * deltaT + (C / 2) * deltaT2 + (D / 3) * deltaT3;
    // Pressure correction and mixing entropy
    const si = si_temp - R * Math.log(Math.max(1e-4, Pbar / Pref)) - R * Math.log(Math.max(1e-6, zi));
    sIdeal += zi * si;
  }

  return sumZ > 0 ? sIdeal / sumZ : 0;
}
