/**
 * PetroSimX Reactor Engineering Suite - Reaction & Reactor Data Models
 * Supports multi-phase kinetics, stoichiometric networks, and 6 reactor archetypes.
 */

export type ReactorModelType = 'CSTR' | 'PFR' | 'Batch' | 'Equilibrium' | 'Conversion' | 'Gibbs';
export type EnergyMode = 'Isothermal' | 'Adiabatic' | 'CooledHeated';
export type ReactionPhase = 'Gas' | 'Liquid' | 'Multiphase';
export type KineticModelType = 'PowerLaw' | 'Arrhenius' | 'Equilibrium' | 'ConversionBased' | 'Custom';

export interface ReactionStoichiometryItem {
  componentId: string;
  stoichiometricCoeff: number; // Negative for reactants, positive for products
  order?: number; // Reaction order exponent, defaults to |stoichiometricCoeff| for elementary
}

export interface ReactionDefinition {
  id: string;
  name: string;
  equation: string;
  phase: ReactionPhase;
  isReversible: boolean;
  kineticModel: KineticModelType;
  reactants: ReactionStoichiometryItem[];
  products: ReactionStoichiometryItem[];

  // Kinetic rate parameters (Arrhenius: k = A * T^n * exp(-Ea / (R * T)))
  preExponentialFactorA: number; // k0 in (mol/m3)^(1-n)/s
  activationEnergyKJPerMol: number; // Ea in kJ/mol
  temperatureExponentN?: number; // n in modified Arrhenius
  forwardOrders?: Record<string, number>; // componentId -> exponent

  // Reverse rate parameters if reversible
  reversePreExponentialFactorA?: number;
  reverseActivationEnergyKJPerMol?: number;
  reverseOrders?: Record<string, number>;

  // Thermodynamic properties
  heatOfReaction298KJPerMol: number; // Standard enthalpy of reaction at 298.15 K
  standardEntropyKJPerMolK?: number; // Standard entropy delta

  // Equilibrium constant expression: ln(Keq) = a + b/T + c*ln(T) + d*T
  equilibriumParams?: {
    a: number;
    b: number;
    c: number;
    d: number;
  };

  // Conversion-based specification (if kineticModel === 'ConversionBased')
  conversionSpec?: {
    limitingComponentId: string;
    conversionFraction: number; // e.g., 0.85 for 85%
  };

  // Catalyst specifics
  catalyst?: {
    type: string;
    loadingKgM3: number;
    activityFactor: number;
  };
}

export interface ReactorSpec {
  reactorType: ReactorModelType;
  volumeM3: number;
  lengthM: number;
  diameterM: number;
  operatingTemperatureC: number;
  operatingPressureBar: number;
  energyMode: EnergyMode;
  heatDutyKW?: number;
  ambientTemperatureC?: number;
  overallHeatTransferCoeffW_M2K?: number; // U in W/(m²·K)
  heatExchangeAreaM2?: number; // Area for cooling/heating jacket
  timeSpanSeconds?: number; // For Batch reactor integration time
  reactions: ReactionDefinition[];
  catalystBedVoidage?: number;
  catalystPelletDiameterMm?: number;
  catalystBulkDensityKgM3?: number;
  limitingComponentId?: string;
  targetProductComponentId?: string;
}

export interface ReactorProfiles {
  spatialSteps: number;
  volumeM3: number[];
  lengthM: number[];
  timeSeconds?: number[];
  temperatureC: number[];
  pressureBar: number[];
  conversionPct: number[];
  concentrationsKmolM3: Record<string, number[]>;
  molarFlowsKmolH: Record<string, number[]>;
  reactionRatesKmolM3S: Record<string, number[]>;
  selectivityPct?: number[];
}

export interface ReactorEngineeringResult {
  unitId: string;
  reactorType: ReactorModelType;
  converged: boolean;
  iterations: number;
  conversion: Record<string, number>; // componentId -> fraction [0..1]
  overallConversionPct: number;
  selectivity: Record<string, number>; // productComponentId -> fraction [0..1]
  yield: Record<string, number>; // productComponentId -> fraction [0..1]
  residenceTimeSec: number;
  heatDutyKW: number;
  heatOfReactionKW: number;
  pressureDropBar: number;
  materialBalanceResidualKgH: number;
  energyBalanceResidualKW: number;
  profiles?: ReactorProfiles;
  outletMolarFlowsKmolH: Record<string, number>;
  outletMassFlowsKgH: Record<string, number>;
  outletMoleFractions: Record<string, number>;
  outletTemperatureC: number;
  outletPressureBar: number;
  outletTotalMassFlowKgH: number;
  operatingConditions: {
    temperatureC: number;
    pressureBar: number;
    volumeM3: number;
    energyMode: EnergyMode;
  };
  validationErrors: string[];
  validationWarnings: string[];
}
