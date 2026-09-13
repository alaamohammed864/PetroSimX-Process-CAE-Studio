/**
 * Types and Data Contracts for Process Optimization, Sensitivity Analysis, and Case Management
 */

import { EquipmentUnit, ProcessStream } from './simulation';

export type SensitivityVariableCategory =
  | 'temperature'
  | 'pressure'
  | 'flow'
  | 'refluxRatio'
  | 'conversion'
  | 'catalyst';

export interface SensitivityVariableDefinition {
  id: string;
  name: string;
  category: SensitivityVariableCategory;
  targetType: 'unit' | 'stream';
  targetId: string;
  propertyKey: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  stepCount: number;
  unit: string;
  description: string;
}

export interface SensitivityMetrics {
  productionRateKgH: number;
  energyConsumptionMW: number;
  co2EmissionsKgH: number;
  operatingCostPerHour: number;
  netOperatingMarginPerHour: number;
  productYieldPct: number;
  reactantConversionPct: number;
  peakTemperatureC: number;
  maxPressureDropBar: number;
  furnaceDutyMW: number;
  compressorPowerKW: number;
  reboilerDutyMW: number;
}

export interface SensitivityRunCase {
  caseIndex: number;
  inputValue: number;
  converged: boolean;
  iterations: number;
  executionTimeMs: number;
  metrics: SensitivityMetrics;
  warnings: string[];
}

export interface SensitivityStudyResult {
  variable: SensitivityVariableDefinition;
  runs: SensitivityRunCase[];
  selectedYMetric: keyof SensitivityMetrics;
  summaryStats: {
    minVal: number;
    maxVal: number;
    avgVal: number;
    bestCaseIndex: number;
    bestInputValue: number;
    bestMetricValue: number;
  };
  timestamp: string;
}

export type OptimizationObjectiveType =
  | 'min_energy'
  | 'max_production'
  | 'max_conversion'
  | 'min_emissions'
  | 'min_cost'
  | 'max_yield'
  | 'max_margin';

export interface OptimizationObjective {
  id: OptimizationObjectiveType;
  name: string;
  type: OptimizationObjectiveType;
  description: string;
  formula: string;
  unit: string;
  direction: 'minimize' | 'maximize';
}

export interface DecisionVariable {
  id: string;
  name: string;
  targetType: 'unit' | 'stream';
  targetId: string;
  propertyKey: string;
  lowerBound: number;
  upperBound: number;
  initialValue: number;
  currentValue: number;
  stepSize: number;
  unit: string;
}

export interface OptimizationConstraint {
  id: string;
  name: string;
  metricKey: keyof SensitivityMetrics;
  operator: '<=' | '>=';
  threshold: number;
  unit: string;
  penaltyWeight: number;
  description: string;
  enabled: boolean;
  currentValue?: number;
  slack?: number;
  isViolated?: boolean;
}

export type OptimizationAlgorithm =
  | 'nelder_mead'
  | 'coordinate_search'
  | 'golden_section'
  | 'gradient_descent';

export interface OptimizationSolverSettings {
  algorithm: OptimizationAlgorithm;
  maxIterations: number;
  tolerance: number;
  penaltyWeight: number;
  finiteDiffDeltaPct: number;
}

export interface OptimizationIterationRecord {
  iteration: number;
  evaluationCount: number;
  candidateX: number[];
  variableValues: { id: string; name: string; value: number; unit: string }[];
  rawObjectiveValue: number;
  penalizedObjectiveValue: number;
  isFeasible: boolean;
  modelConverged: boolean;
  metrics: SensitivityMetrics;
  violations: { constraintId: string; name: string; violation: number }[];
  statusMessage: string;
}

export interface OptimizationReport {
  timestamp: string;
  objective: OptimizationObjective;
  solverSettings: OptimizationSolverSettings;
  initialCase: {
    x: number[];
    variableValues: { id: string; name: string; value: number; unit: string }[];
    rawObjectiveValue: number;
    metrics: SensitivityMetrics;
  };
  optimizedCase: {
    x: number[];
    variableValues: { id: string; name: string; value: number; unit: string }[];
    rawObjectiveValue: number;
    metrics: SensitivityMetrics;
  };
  decisionVariables: DecisionVariable[];
  constraints: OptimizationConstraint[];
  iterations: number;
  evaluationsCount: number;
  convergenceStatus: 'optimal_converged' | 'suboptimal_max_iter' | 'infeasible_diverged';
  modelConverged: boolean;
  improvementPct: number;
  netEconomicGainPerHour: number;
  engineeringWarnings: string[];
  iterationHistory: OptimizationIterationRecord[];
}

export interface ProcessCaseSummary {
  feedFlowKgH: number;
  productFlowKgH: number;
  productYieldPct: number;
  conversionPct: number;
  furnaceDutyMW: number;
  compressorPowerKW: number;
  reboilerDutyMW: number;
  totalEnergyMW: number;
  co2EmissionsKgH: number;
  operatingCostPerHour: number;
  netMarginPerHour: number;
  solverConverged: boolean;
  iterations: number;
}

export interface ProcessCase {
  id: string;
  name: string;
  description: string;
  timestamp: string;
  isBaseCase: boolean;
  units: EquipmentUnit[];
  streams: ProcessStream[];
  summary: ProcessCaseSummary;
  tags: string[];
}
