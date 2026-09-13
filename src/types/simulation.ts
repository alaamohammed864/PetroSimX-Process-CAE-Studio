import { ReactorSpec, ReactorEngineeringResult } from '../engine/reactors/reactionTypes';
import { DistillationColumnSpec, RigorousDistillationResult, ThreePhaseSeparatorSpec } from '../engine/separation/distillationTypes';
import { AbsorberSpec, StripperSpec } from '../engine/separation/absorberEngine';
import { HeatExchangerDetailedSpec } from '../engine/heatex/heatExchangerModels';
import { PumpDetailedSpec, CompressorDetailedSpec } from '../engine/rotating/rotatingEquipment';
import { ValveDetailedSpec } from '../engine/valves/valveEngine';
import { FurnaceDetailedSpec } from '../engine/furnace/furnaceEngine';

export type UnitType = 
  | 'pump' 
  | 'heatex' 
  | 'furnace' 
  | 'reactor' 
  | 'vessel' 
  | 'column' 
  | 'absorber'
  | 'stripper'
  | 'three_phase_separator'
  | 'liquid_liquid_separator'
  | 'splitter'
  | 'valve' 
  | 'compressor';

export type UnitStatus = 'converged' | 'solved' | 'calculating' | 'diverged' | 'unsolved';

export interface EquipmentGeometry {
  catalystVolumeM3: number;
  internalDiamM: number;
  bedVoidage: number;
  bedHeightM: number;
  shellDiamM?: number;
  tubeCount?: number;
  tubeLengthM?: number;
}

export interface OperationalEquilibrium {
  inletTempC: number;
  outletTempC: number;
  operatingPresBar: number;
  pressureDropBar: number;
  lhsvSpaceVelH1?: number;
  h2hcTreatRatioNm3M3?: number;
  dutyMW?: number;
  efficiencyPct?: number;
}

export interface KineticReaction {
  id: string;
  name: string;
  equation: string;
  deltaHKJPerMol: number;
  type: 'Endo' | 'Exo';
  k0: string;
  activationEnergyKJPerMol: number;
}

export interface CatalystProperties {
  type: string;
  pelletDiameterMm: number;
  bulkDensityKgM3: number;
  activeSurfaceAreaM2G: number;
  deactivationRatePer1000h: number;
}

export interface EquipmentUnit {
  id: string;
  name: string;
  type: UnitType;
  tag: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: UnitStatus;
  geometry: EquipmentGeometry;
  equilibrium: OperationalEquilibrium;
  kinetics?: KineticReaction[];
  catalyst?: CatalystProperties;
  reactorSpec?: ReactorSpec;
  reactorResults?: ReactorEngineeringResult;
  columnSpec?: DistillationColumnSpec;
  columnResult?: RigorousDistillationResult;
  heatexSpec?: HeatExchangerDetailedSpec;
  furnaceSpec?: FurnaceDetailedSpec;
  pumpSpec?: PumpDetailedSpec;
  compressorSpec?: CompressorDetailedSpec;
  valveSpec?: ValveDetailedSpec;
  absorberSpec?: AbsorberSpec;
  stripperSpec?: StripperSpec;
  threePhaseSpec?: ThreePhaseSeparatorSpec;
  inletStreamIds: string[];
  outletStreamIds: string[];
}

export interface ProcessStream {
  id: string;
  name: string;
  tag: string;
  phase: 'Liquid' | 'Vapor' | 'Mixed (0.14)' | 'Mixed' | 'Vapor (H2)' | string;
  tempC: number;
  presBar: number;
  flowKgH: number;
  mw: number;
  enthalpyKjKg: number;
  vaporFraction: number;
  densityKgM3: number;
  color: string;
  isRecycle?: boolean;
  compositions: Record<string, number>; // componentId -> molFraction
}

export interface ChemicalComponent {
  id: string;
  name: string;
  formula: string;
  fraction: number;
  mw: number;
  criticalTempC: number;
  criticalPresBar: number;
  accentricFactor: number;
}

export interface EventLogEntry {
  id: string;
  time: string;
  type: 'info' | 'warn' | 'success' | 'step';
  message: string;
}

export type UnitSystem = 'SI' | 'Field' | 'Metric';
export type ViewTab = 
  | 'flowsheet-canvas' 
  | '3d-plant-view'
  | 'column-design' 
  | 'thermodynamics-engine' 
  | 'reactor-engineering' 
  | 'sensitivity-optimization' 
  | 'energy-utilities'
  | 'stream-matrix' 
  | 'digital-twin-monitor';
