import * as THREE from 'three';
import { EquipmentUnit, ProcessStream, UnitSystem, UnitType } from '../../types/simulation';
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
  onUpdateUnitPosition?: (id: string, x: number, y: number) => void;
  onConnectUnits?: (sourceId: string, targetId: string) => void;
  onAddUnit?: (type: UnitType) => void;
  onAutoLayout?: () => void;
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

export interface NozzlePort {
  id: string;
  streamId?: string;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  flangeRadius: number;
}

export interface PipePoint {
  x: number;
  y: number;
  z: number;
}
