import { EquipmentUnit, ProcessStream, UnitSystem } from '../../types/simulation';
import { DynamicSimulationState } from '../../types/dynamic';

export type VisualColorMode = 'phase' | 'temperature' | 'pressure' | 'status';

export type CameraPreset = 'isometric' | 'top' | 'front' | 'side' | 'first-person';

export type RenderMode = 'realistic' | 'x-ray' | 'thermal' | 'wireframe';

export interface Plant3DViewerProps {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  selectedUnitId?: string;
  selectedStreamId?: string | null;
  onSelectUnit?: (id: string) => void;
  onSelectStream?: (id: string | null) => void;
  unitSystem: UnitSystem;
  dynamicState?: DynamicSimulationState;
  onClose?: () => void; // If in modal/overlay mode
}

export interface Equipment3DPosition {
  x: number;
  y: number;
  z: number;
  scale: [number, number, number];
  rotationY: number;
}

export interface NozzlePosition {
  worldPos: [number, number, number];
  direction: [number, number, number];
  type: 'inlet' | 'outlet';
}

export interface PipePoint {
  x: number;
  y: number;
  z: number;
}
