/**
 * Distillation and Separation Types
 * Supports Shortcut (Fenske-Underwood-Gilliland) and Rigorous Stage-by-Stage (MESH / Wang-Henke)
 */

import { StreamCalculationResult } from '../stream/streamCalculator';

export type CondenserType = 'total' | 'partial' | 'none';
export type ReboilerType = 'kettle' | 'thermosiphon' | 'none';
export type ColumnSolverMethod = 'shortcut_fug' | 'rigorous_bubble_point' | 'tridiagonal_mesh';

export interface DistillationColumnSpec {
  numberOfStages: number; // e.g. 24 trays
  feedStage: number; // 1-indexed from top (e.g. 12)
  condenserType: CondenserType;
  reboilerType: ReboilerType;
  refluxRatio: number; // R = L / D (e.g. 2.5)
  distillateRateKgH?: number; // Target distillate mass rate
  bottomsRateKgH?: number;
  topPressureBar: number;
  bottomPressureBar: number;
  lightKeyComponentId: string; // Key for shortcut e.g. 'c3'
  heavyKeyComponentId: string; // Key for shortcut e.g. 'nc4'
  lightKeyDistillateRecovery: number; // e.g. 0.98
  heavyKeyBottomsRecovery: number; // e.g. 0.98
  trayEfficiency?: number; // Murphree tray efficiency, e.g. 0.75
}

export interface ColumnStageState {
  stageNumber: number; // 1 = Condenser, N = Reboiler
  temperatureC: number;
  pressureBar: number;
  liquidFlowKgH: number;
  vaporFlowKgH: number;
  liquidMoleFractions: Record<string, number>;
  vaporMoleFractions: Record<string, number>;
  kValues: Record<string, number>;
}

export interface ShortcutDistillationResult {
  minimumStagesNmin: number; // Fenske equation
  minimumRefluxRmin: number; // Underwood equation
  actualStagesN: number; // Gilliland correlation
  optimalFeedStageNF: number; // Kirkbride correlation
  distillateRateKgH: number;
  bottomsRateKgH: number;
  distillateComposition: Record<string, number>;
  bottomsComposition: Record<string, number>;
  distillateTemperatureC: number;
  bottomsTemperatureC: number;
  condenserDutyKW: number;
  reboilerDutyKW: number;
  equationsUsed: string[];
}

export interface RigorousDistillationResult {
  converged: boolean;
  iterations: number;
  stages: ColumnStageState[];
  condenserDutyKW: number;
  reboilerDutyKW: number;
  distillateStream: StreamCalculationResult;
  bottomsStream: StreamCalculationResult;
  refluxFlowKgH: number;
  boilupFlowKgH: number;
  stageTemperatures: { stage: number; tempC: number }[];
  stageVaporFlows: { stage: number; flowKgH: number }[];
  stageLiquidFlows: { stage: number; flowKgH: number }[];
  stageCompositions: { stage: number; liquid: Record<string, number>; vapor: Record<string, number> }[];
  validationWarnings: string[];
  validationErrors: string[];
}

export interface ThreePhaseSeparatorSpec {
  vesselPressureBar: number;
  vesselTemperatureC?: number;
  isAdiabatic: boolean;
  waterCutVolumeFraction?: number; // Water fraction in feed
  hydrocarbonLightDensityKgM3?: number;
  weirHeightM?: number;
  residenceTimeMin?: number;
}

export interface ThreePhaseSeparatorResult {
  vaporStream: StreamCalculationResult;
  lightLiquidStream: StreamCalculationResult; // Hydrocarbon phase
  heavyLiquidStream: StreamCalculationResult; // Aqueous / Free Water phase
  vaporFraction: number;
  oilFraction: number;
  waterFraction: number;
  dropletSettlingVelocityMPerS: number;
  retentionTimeMin: number;
  vesselDiameterM: number;
  vesselLengthM: number;
}
