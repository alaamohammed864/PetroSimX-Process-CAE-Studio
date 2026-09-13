/**
 * PetroSimX Standard Reaction Sets & Catalytic Packages
 * Industrial reactions with verified Arrhenius kinetics and thermodynamic enthalpies.
 */

import { ReactionDefinition } from './reactionTypes';

export const DEFAULT_REACTIONS_DB: Record<string, ReactionDefinition> = {
  // Reaction 1: Hydrodealkylation (HDA) of Toluene to Benzene + Methane
  toluene_hda: {
    id: 'toluene_hda',
    name: 'Toluene Hydrodealkylation (HDA)',
    equation: 'C7H8 + H2 -> C6H6 + CH4',
    phase: 'Gas',
    isReversible: false,
    kineticModel: 'Arrhenius',
    reactants: [
      { componentId: 'c7h8', stoichiometricCoeff: -1, order: 1 },
      { componentId: 'h2', stoichiometricCoeff: -1, order: 0.5 },
    ],
    products: [
      { componentId: 'c6h6', stoichiometricCoeff: 1, order: 0 },
      { componentId: 'c1', stoichiometricCoeff: 1, order: 0 },
    ],
    preExponentialFactorA: 3.5e6, // (m3/kmol)^0.5 / s
    activationEnergyKJPerMol: 215.0, // 215 kJ/mol
    temperatureExponentN: 0,
    forwardOrders: {
      c7h8: 1.0,
      h2: 0.5,
    },
    heatOfReaction298KJPerMol: -41.2, // Exothermic (-41.2 kJ/mol)
    catalyst: {
      type: 'Pt/Al2O3 Bifunctional',
      loadingKgM3: 450.0,
      activityFactor: 1.0,
    },
  },

  // Reaction 2: Methylcyclohexane Dehydrogenation to Toluene
  mch_dehydrogenation: {
    id: 'mch_dehydrogenation',
    name: 'Methylcyclohexane Dehydrogenation',
    equation: 'C7H14 <=> C7H8 + 3 H2',
    phase: 'Gas',
    isReversible: true,
    kineticModel: 'Equilibrium',
    reactants: [
      { componentId: 'c7h14', stoichiometricCoeff: -1, order: 1 },
    ],
    products: [
      { componentId: 'c7h8', stoichiometricCoeff: 1, order: 1 },
      { componentId: 'h2', stoichiometricCoeff: 3, order: 3 },
    ],
    preExponentialFactorA: 1.2e8,
    activationEnergyKJPerMol: 138.0,
    temperatureExponentN: 0,
    forwardOrders: {
      c7h14: 1.0,
    },
    reverseOrders: {
      c7h8: 1.0,
      h2: 3.0,
    },
    reversePreExponentialFactorA: 4.8e4,
    reverseActivationEnergyKJPerMol: 95.0,
    heatOfReaction298KJPerMol: 205.0, // Endothermic (+205 kJ/mol)
    standardEntropyKJPerMolK: 0.365,
    equilibriumParams: {
      a: 46.15,
      b: -25100.0,
      c: -4.12,
      d: 0.0012,
    },
    catalyst: {
      type: 'Pt-Sn / gamma-Alumina Reforming Catalyst',
      loadingKgM3: 520.0,
      activityFactor: 1.0,
    },
  },

  // Reaction 3: Benzene Hydrogenation
  benzene_hydrogenation: {
    id: 'benzene_hydrogenation',
    name: 'Benzene Hydrogenation',
    equation: 'C6H6 + 3 H2 <=> C6H12',
    phase: 'Gas',
    isReversible: true,
    kineticModel: 'Arrhenius',
    reactants: [
      { componentId: 'c6h6', stoichiometricCoeff: -1, order: 1 },
      { componentId: 'h2', stoichiometricCoeff: -3, order: 1 },
    ],
    products: [
      { componentId: 'c6h6', stoichiometricCoeff: 1, order: 0 }, // Product representation
    ],
    preExponentialFactorA: 8.9e7,
    activationEnergyKJPerMol: 55.0,
    temperatureExponentN: 0,
    heatOfReaction298KJPerMol: -206.0, // Strongly exothermic
    catalyst: {
      type: 'Raney Nickel / Support',
      loadingKgM3: 600.0,
      activityFactor: 1.0,
    },
  },

  // Reaction 4: Methane Steam Reforming
  smr_reaction: {
    id: 'smr_reaction',
    name: 'Steam Methane Reforming',
    equation: 'CH4 + H2O <=> CO + 3 H2',
    phase: 'Gas',
    isReversible: true,
    kineticModel: 'Equilibrium',
    reactants: [
      { componentId: 'c1', stoichiometricCoeff: -1, order: 1 },
      { componentId: 'h2o', stoichiometricCoeff: -1, order: 1 },
    ],
    products: [
      { componentId: 'h2', stoichiometricCoeff: 3, order: 3 },
    ],
    preExponentialFactorA: 4.2e6,
    activationEnergyKJPerMol: 240.0,
    heatOfReaction298KJPerMol: 206.2,
    catalyst: {
      type: 'Ni/Al2O3 Reformer Pellets',
      loadingKgM3: 750.0,
      activityFactor: 1.0,
    },
  },
};
