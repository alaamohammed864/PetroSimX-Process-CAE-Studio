/**
 * PetroSimX Reaction Engine & Stoichiometry Kinetics Evaluator
 * Evaluates reaction rates, Arrhenius temperature dependencies, equilibrium constants,
 * conversions, selectivities, and yields.
 */

import { ReactionDefinition } from './reactionTypes';
import { PURE_COMPONENTS_DB } from '../thermo/thermoConstants';

export const UNIVERSAL_GAS_CONSTANT_R = 8.3144626; // J/(mol·K)

export interface ReactionRateEvaluation {
  reactionId: string;
  forwardRateConstantK: number;
  reverseRateConstantK: number;
  forwardRateKmolM3S: number;
  reverseRateKmolM3S: number;
  netRateKmolM3S: number;
  equilibriumConstantKeq: number;
  heatOfReactionKJPerMol: number;
}

/**
 * Computes forward and reverse rate constants using Arrhenius equation
 */
export function calculateRateConstant(
  A: number,
  EaKJPerMol: number,
  TK: number,
  n: number = 0
): number {
  if (TK <= 0) return 0;
  const exponent = (-EaKJPerMol * 1000.0) / (UNIVERSAL_GAS_CONSTANT_R * TK);
  const clampedExp = Math.max(-80, Math.min(50, exponent));
  const tempFactor = n !== 0 ? Math.pow(TK, n) : 1.0;
  return A * tempFactor * Math.exp(clampedExp);
}

/**
 * Calculates chemical equilibrium constant Keq at temperature T (Kelvin)
 */
export function calculateEquilibriumConstant(
  rxn: ReactionDefinition,
  TK: number
): number {
  if (rxn.equilibriumParams) {
    const { a, b, c, d } = rxn.equilibriumParams;
    const lnK = a + b / TK + c * Math.log(TK) + d * TK;
    return Math.exp(Math.max(-50, Math.min(50, lnK)));
  }

  // van 't Hoff approximation using standard enthalpy of reaction
  const dH_J = rxn.heatOfReaction298KJPerMol * 1000.0;
  const dS_J = (rxn.standardEntropyKJPerMolK ?? 0.0) * 1000.0;
  const dG_J = dH_J - TK * dS_J;
  const lnK = -dG_J / (UNIVERSAL_GAS_CONSTANT_R * TK);
  return Math.exp(Math.max(-50, Math.min(50, lnK)));
}

/**
 * Computes the Weisz-Prater / Thiele Modulus (phi) and internal catalyst effectiveness factor (eta)
 * for spherical or pellet catalyst particles:
 *   phi = (dp / 6) * sqrt(k * rho_p / D_eff)
 *   eta = (3 / phi) * [ (1 / tanh(phi)) - (1 / phi) ]
 *
 * References:
 *   - Fogler, Elements of Chemical Reaction Engineering (5th Ed.), Chapter 14: Diffusion and Reaction.
 *   - Technical Report Section 4.2.
 */
export function calculateThieleModulusAndEffectiveness(
  dpMeters: number,
  kRateConstant: number,
  rhoPelletKgM3: number,
  effectiveDiffusivityM2S: number = 2.5e-8
): { thieleModulusPhi: number; effectivenessFactorEta: number } {
  // Characteristic length for sphere: L_c = R/3 = d_p / 6
  const characteristicLength = Math.max(1e-6, dpMeters / 6.0);
  const Deff = Math.max(1e-12, effectiveDiffusivityM2S);
  const kEff = Math.max(1e-9, Math.abs(kRateConstant));
  const rhoP = Math.max(10.0, rhoPelletKgM3);

  const phi = characteristicLength * Math.sqrt((kEff * rhoP) / Deff);

  let eta = 1.0;
  if (phi < 1e-4) {
    // Limit as phi -> 0 (Taylor expansion: 1 - phi^2 / 15)
    eta = 1.0 - (phi * phi) / 15.0;
  } else if (phi > 35.0) {
    // Asymptotic strong diffusion resistance limit: eta -> 3 / phi
    eta = 3.0 / phi;
  } else {
    // Rigorous analytical solution for spherical pellet
    const tanhPhi = Math.tanh(phi);
    eta = (3.0 / phi) * ((1.0 / tanhPhi) - (1.0 / phi));
  }

  // Physical bounds: 0 < eta <= 1.0
  const clampedEta = Math.max(0.01, Math.min(1.0, eta));

  return {
    thieleModulusPhi: phi,
    effectivenessFactorEta: clampedEta,
  };
}

/**
 * Evaluates net reaction rates for a given reaction given component concentrations (kmol/m³)
 */
export function evaluateReactionRate(
  rxn: ReactionDefinition,
  concentrationsKmolM3: Record<string, number>,
  TK: number,
  catalystEffectiveness: number = 1.0
): ReactionRateEvaluation {
  const kf = calculateRateConstant(
    rxn.preExponentialFactorA,
    rxn.activationEnergyKJPerMol,
    TK,
    rxn.temperatureExponentN ?? 0
  );

  // Compute forward driving force: prod(C_i ^ order_i)
  let forwardDrivingForce = 1.0;
  for (const item of rxn.reactants) {
    const order = rxn.forwardOrders?.[item.componentId] ?? item.order ?? Math.abs(item.stoichiometricCoeff);
    const conc = Math.max(0, concentrationsKmolM3[item.componentId] || 0.0);
    forwardDrivingForce *= Math.pow(conc, order);
  }

  const rf = kf * forwardDrivingForce * catalystEffectiveness;

  let kr = 0;
  let rr = 0;
  const Keq = calculateEquilibriumConstant(rxn, TK);

  if (rxn.isReversible) {
    let reverseDrivingForce = 1.0;
    for (const item of rxn.products) {
      const order = rxn.reverseOrders?.[item.componentId] ?? item.order ?? Math.abs(item.stoichiometricCoeff);
      const conc = Math.max(0, concentrationsKmolM3[item.componentId] || 0.0);
      reverseDrivingForce *= Math.pow(conc, order);
    }

    if (rxn.reversePreExponentialFactorA !== undefined && rxn.reverseActivationEnergyKJPerMol !== undefined) {
      kr = calculateRateConstant(
        rxn.reversePreExponentialFactorA,
        rxn.reverseActivationEnergyKJPerMol,
        TK,
        0
      );
    } else {
      // Thermodynamic consistency: kr = kf / Keq
      kr = Keq > 1e-12 ? kf / Keq : 0;
    }

    rr = kr * reverseDrivingForce * catalystEffectiveness;
  }

  // Heat of reaction at temperature T
  const dH_T = rxn.heatOfReaction298KJPerMol; // Simplified constant Cp or standard enthalpy

  return {
    reactionId: rxn.id,
    forwardRateConstantK: kf,
    reverseRateConstantK: kr,
    forwardRateKmolM3S: rf,
    reverseRateKmolM3S: rr,
    netRateKmolM3S: rf - rr,
    equilibriumConstantKeq: Keq,
    heatOfReactionKJPerMol: dH_T,
  };
}

/**
 * Calculates net species generation rates R_i = sum(nu_ij * r_j) in kmol/(m³·s)
 */
export function calculateSpeciesGenerationRates(
  reactions: ReactionDefinition[],
  concentrationsKmolM3: Record<string, number>,
  TK: number,
  catalystEffectiveness: number = 1.0
): {
  speciesRatesKmolM3S: Record<string, number>;
  reactionRates: ReactionRateEvaluation[];
  totalHeatGenerationKW_M3: number;
} {
  const speciesRatesKmolM3S: Record<string, number> = {};
  const reactionRates: ReactionRateEvaluation[] = [];
  let totalHeatGenKW_M3 = 0;

  for (const rxn of reactions) {
    const rateEval = evaluateReactionRate(rxn, concentrationsKmolM3, TK, catalystEffectiveness);
    reactionRates.push(rateEval);

    const rNet = rateEval.netRateKmolM3S;

    // Reactants (negative stoichiometric coefficients)
    for (const item of rxn.reactants) {
      const nu = item.stoichiometricCoeff < 0 ? item.stoichiometricCoeff : -item.stoichiometricCoeff;
      speciesRatesKmolM3S[item.componentId] = (speciesRatesKmolM3S[item.componentId] || 0) + nu * rNet;
    }

    // Products (positive stoichiometric coefficients)
    for (const item of rxn.products) {
      const nu = item.stoichiometricCoeff > 0 ? item.stoichiometricCoeff : Math.abs(item.stoichiometricCoeff);
      speciesRatesKmolM3S[item.componentId] = (speciesRatesKmolM3S[item.componentId] || 0) + nu * rNet;
    }

    // Heat generated by this reaction: (-DeltaH) * r_net in kJ/(m³·s) = kW/m³
    totalHeatGenKW_M3 += (-rateEval.heatOfReactionKJPerMol) * rNet;
  }

  return {
    speciesRatesKmolM3S,
    reactionRates,
    totalHeatGenerationKW_M3: totalHeatGenKW_M3,
  };
}

/**
 * Computes Conversion, Selectivity, and Yield
 */
export function calculateReactorPerformanceMetrics(
  inletMolarFlowsKmolH: Record<string, number>,
  outletMolarFlowsKmolH: Record<string, number>,
  reactions: ReactionDefinition[],
  specifiedLimitingId?: string,
  specifiedTargetProductId?: string
): {
  limitingComponentId: string;
  conversions: Record<string, number>;
  overallConversionPct: number;
  selectivities: Record<string, number>;
  yields: Record<string, number>;
} {
  const conversions: Record<string, number> = {};
  let limitingId = specifiedLimitingId;

  // Auto-detect limiting reactant if not provided
  if (!limitingId) {
    let minFlow = Infinity;
    for (const rxn of reactions) {
      for (const item of rxn.reactants) {
        const flow = inletMolarFlowsKmolH[item.componentId] || 0;
        if (flow > 0 && flow < minFlow) {
          minFlow = flow;
          limitingId = item.componentId;
        }
      }
    }
  }

  if (!limitingId) {
    limitingId = Object.keys(inletMolarFlowsKmolH)[0] || 'c6h6';
  }

  // Calculate component conversions
  for (const compId in inletMolarFlowsKmolH) {
    const fIn = inletMolarFlowsKmolH[compId] || 0;
    const fOut = outletMolarFlowsKmolH[compId] || 0;
    if (fIn > 1e-6) {
      conversions[compId] = Math.max(0, Math.min(1.0, (fIn - fOut) / fIn));
    } else {
      conversions[compId] = 0;
    }
  }

  const overallConvPct = (conversions[limitingId] || 0) * 100.0;

  // Calculate Selectivities & Yields
  const selectivities: Record<string, number> = {};
  const yields: Record<string, number> = {};

  const fLimIn = inletMolarFlowsKmolH[limitingId] || 0;
  const fLimOut = outletMolarFlowsKmolH[limitingId] || 0;
  const deltaLimConsumed = Math.max(1e-8, fLimIn - fLimOut);

  // Default stoich ratio
  let nuLim = 1;
  for (const rxn of reactions) {
    const match = rxn.reactants.find((r) => r.componentId === limitingId);
    if (match) {
      nuLim = Math.abs(match.stoichiometricCoeff);
      break;
    }
  }

  for (const compId in outletMolarFlowsKmolH) {
    const fProdIn = inletMolarFlowsKmolH[compId] || 0;
    const fProdOut = outletMolarFlowsKmolH[compId] || 0;
    const deltaProdFormed = Math.max(0, fProdOut - fProdIn);

    if (deltaProdFormed > 1e-6 && compId !== limitingId) {
      // Find stoichiometric coefficient for this product
      let nuProd = 1;
      for (const rxn of reactions) {
        const match = rxn.products.find((p) => p.componentId === compId);
        if (match) {
          nuProd = Math.abs(match.stoichiometricCoeff);
          break;
        }
      }

      // S = (Delta Moles Product / nu_prod) / (Delta Moles Limiting Reactant / nu_lim)
      const sel = (deltaProdFormed / nuProd) / (deltaLimConsumed / nuLim);
      selectivities[compId] = Math.max(0, Math.min(1.0, sel));

      // Y = S * X
      const yld = (deltaProdFormed / nuProd) / Math.max(1e-8, fLimIn / nuLim);
      yields[compId] = Math.max(0, Math.min(1.0, yld));
    }
  }

  return {
    limitingComponentId: limitingId,
    conversions,
    overallConversionPct: overallConvPct,
    selectivities,
    yields,
  };
}
