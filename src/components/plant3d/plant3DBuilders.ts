import * as THREE from 'three';
import { EquipmentUnit, ProcessStream, UnitType } from '../../types/simulation';
import { NozzlePort, RenderMode, VisualColorMode } from './plant3DTypes';

export interface Unit3DMetadata {
  unit: EquipmentUnit;
  inletNozzles: THREE.Vector3[];
  outletNozzles: THREE.Vector3[];
  inletPorts?: NozzlePort[];
  outletPorts?: NozzlePort[];
  group: THREE.Group;
  beaconLight?: THREE.Mesh;
  statusMaterial?: THREE.MeshStandardMaterial;
}

// Materials Cache & Helpers
const createPBRMaterial = (color: number | string, roughness = 0.4, metalness = 0.6, transparent = false, opacity = 1.0) => {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
    transparent,
    opacity,
  });
};

export const COMMON_MATERIALS = {
  carbonSteel: createPBRMaterial('#4a5568', 0.35, 0.75),
  stainlessSteel: createPBRMaterial('#cbd5e1', 0.25, 0.85),
  insulatedJacket: createPBRMaterial('#94a3b8', 0.5, 0.3),
  castIron: createPBRMaterial('#334155', 0.6, 0.5),
  safetyYellow: createPBRMaterial('#eab308', 0.4, 0.2),
  safetyRed: createPBRMaterial('#ef4444', 0.3, 0.2),
  safetyBlue: createPBRMaterial('#3b82f6', 0.3, 0.3),
  furnaceRefractory: createPBRMaterial('#78350f', 0.8, 0.1),
  concreteFoundation: createPBRMaterial('#475569', 0.85, 0.05),
  brassBronze: createPBRMaterial('#d97706', 0.3, 0.8),
  catalystBed: createPBRMaterial('#059669', 0.5, 0.2, true, 0.85),
  glassLiquid: createPBRMaterial('#38bdf8', 0.1, 0.1, true, 0.65),
  grating: createPBRMaterial('#64748b', 0.7, 0.4),
};

/**
 * 2D Canvas coordinate mapping to 3D plant layout space
 */
export function mapCanvasTo3D(x: number, y: number): THREE.Vector3 {
  const scale = 0.045;
  const offsetX = -25;
  const offsetZ = -10;
  return new THREE.Vector3(x * scale + offsetX, 0, y * scale + offsetZ);
}

/**
 * 3D plant layout coordinate mapping back to 2D canvas coordinates
 */
export function map3DToCanvas(posX: number, posZ: number): { x: number; y: number } {
  const scale = 0.045;
  const offsetX = -25;
  const offsetZ = -10;
  return {
    x: Math.round((posX - offsetX) / scale),
    y: Math.round((posZ - offsetZ) / scale),
  };
}

/**
 * Status beacon color helper
 */
export function getStatusColor(status: string): number {
  switch (status) {
    case 'converged':
    case 'solved':
      return 0x10b981; // emerald green
    case 'calculating':
      return 0xf59e0b; // amber
    case 'diverged':
      return 0xef4444; // red
    default:
      return 0x64748b; // gray
  }
}

/**
 * Add a status beacon to the top of an equipment unit
 */
function addStatusBeacon(group: THREE.Group, unit: EquipmentUnit, topY: number): { beaconMesh: THREE.Mesh; mat: THREE.MeshStandardMaterial } {
  const beaconPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8),
    COMMON_MATERIALS.stainlessSteel
  );
  beaconPole.position.set(0, topY + 0.25, 0);
  group.add(beaconPole);

  const mat = new THREE.MeshStandardMaterial({
    color: getStatusColor(unit.status),
    emissive: getStatusColor(unit.status),
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), mat);
  beacon.position.set(0, topY + 0.55, 0);
  beacon.userData = { type: 'beacon', unitId: unit.id };
  group.add(beacon);

  return { beaconMesh: beacon, mat };
}

/**
 * Add foundation pad under equipment
 */
function addFoundationPad(group: THREE.Group, width: number, length: number, height = 0.3): void {
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, length),
    COMMON_MATERIALS.concreteFoundation
  );
  pad.position.set(0, height / 2, 0);
  pad.castShadow = true;
  pad.receiveShadow = true;
  group.add(pad);

  // Grout line
  const grout = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.95, 0.05, length * 0.95),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 })
  );
  grout.position.set(0, height + 0.025, 0);
  group.add(grout);
}

/**
 * Build 3D Centrifugal Pump
 */
export function buildPump3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  const group = new THREE.Group();
  group.userData = { type: 'equipment', id: unit.id, unitType: 'pump' };

  addFoundationPad(group, 2.4, 1.4, 0.25);

  // Pump casing / volute
  const voluteMat = renderMode === 'x-ray'
    ? createPBRMaterial('#0284c7', 0.3, 0.6, true, 0.4)
    : COMMON_MATERIALS.castIron;
  
  const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 24), voluteMat);
  volute.rotation.x = Math.PI / 2;
  volute.position.set(-0.4, 0.75, 0);
  volute.castShadow = true;
  group.add(volute);

  // Volute spiral nose
  const spiral = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 0.4, 16), voluteMat);
  spiral.position.set(-0.55, 0.9, 0);
  group.add(spiral);

  // Suction nozzle (axial inlet, X- direction)
  const suctionNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 16), COMMON_MATERIALS.carbonSteel);
  suctionNozzle.rotation.z = Math.PI / 2;
  suctionNozzle.position.set(-0.9, 0.75, 0);
  group.add(suctionNozzle);

  // Suction flange
  const suctionFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16), COMMON_MATERIALS.stainlessSteel);
  suctionFlange.rotation.z = Math.PI / 2;
  suctionFlange.position.set(-1.1, 0.75, 0);
  group.add(suctionFlange);

  // Discharge nozzle (top vertical outlet, Y+ direction)
  const dischargeNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 16), COMMON_MATERIALS.carbonSteel);
  dischargeNozzle.position.set(-0.4, 1.2, 0);
  group.add(dischargeNozzle);

  // Discharge flange
  const dischargeFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), COMMON_MATERIALS.stainlessSteel);
  dischargeFlange.position.set(-0.4, 1.45, 0);
  group.add(dischargeFlange);

  // Electric Motor (TEFC induction motor with cooling fins)
  const motorBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.95, 24),
    COMMON_MATERIALS.safetyBlue
  );
  motorBody.rotation.z = Math.PI / 2;
  motorBody.position.set(0.6, 0.75, 0);
  motorBody.castShadow = true;
  group.add(motorBody);

  // Motor Fan Cowl
  const fanCowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.2, 24),
    COMMON_MATERIALS.castIron
  );
  fanCowl.rotation.z = Math.PI / 2;
  fanCowl.position.set(1.15, 0.75, 0);
  group.add(fanCowl);

  // Shaft Coupling Guard
  const couplingGuard = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.35, 16),
    COMMON_MATERIALS.safetyYellow
  );
  couplingGuard.rotation.z = Math.PI / 2;
  couplingGuard.position.set(0.05, 0.75, 0);
  group.add(couplingGuard);

  // Motor Terminal Box
  const tbox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.25), COMMON_MATERIALS.castIron);
  tbox.position.set(0.6, 1.25, 0.25);
  group.add(tbox);

  const { beaconMesh, mat: statusMaterial } = addStatusBeacon(group, unit, 1.55);

  return {
    unit,
    inletNozzles: [new THREE.Vector3(-1.14, 0.75, 0), new THREE.Vector3(-1.8, 0.75, 0)],
    outletNozzles: [new THREE.Vector3(-0.4, 1.49, 0)],
    inletPorts: [
      {
        id: 'suction',
        streamId: 'S-101',
        position: new THREE.Vector3(-1.14, 0.75, 0),
        direction: new THREE.Vector3(-1, 0, 0),
        flangeRadius: 0.26,
      },
      {
        id: 'recycle_inlet',
        streamId: 'S-106',
        position: new THREE.Vector3(-1.8, 0.75, 0),
        direction: new THREE.Vector3(0, 1, 0),
        flangeRadius: 0.22,
      },
    ],
    outletPorts: [
      {
        id: 'discharge',
        streamId: 'S-102',
        position: new THREE.Vector3(-0.4, 1.49, 0),
        direction: new THREE.Vector3(0, 1, 0),
        flangeRadius: 0.22,
      },
    ],
    group,
    beaconLight: beaconMesh,
    statusMaterial,
  };
}

/**
 * Build 3D Shell-and-Tube Heat Exchanger (TEMA BEU)
 */
export function buildHeatex3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  const group = new THREE.Group();
  group.userData = { type: 'equipment', id: unit.id, unitType: 'heatex' };

  addFoundationPad(group, 4.2, 2.0, 0.3);

  // Twin support saddles
  [-1.2, 1.2].forEach((xPos) => {
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 1.6), COMMON_MATERIALS.carbonSteel);
    saddle.position.set(xPos, 0.7, 0);
    group.add(saddle);
  });

  const shellLength = 3.6;
  const shellRadius = 0.75;

  // Main shell cylinder
  const shellMat = renderMode === 'x-ray'
    ? createPBRMaterial('#38bdf8', 0.3, 0.5, true, 0.35)
    : COMMON_MATERIALS.insulatedJacket;

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(shellRadius, shellRadius, shellLength, 32),
    shellMat
  );
  shell.rotation.z = Math.PI / 2;
  shell.position.set(0, 1.5, 0);
  shell.castShadow = true;
  group.add(shell);

  // Internal tube bundle (visible in x-ray mode)
  if (renderMode === 'x-ray') {
    const tubeBundle = new THREE.Mesh(
      new THREE.CylinderGeometry(shellRadius * 0.7, shellRadius * 0.7, shellLength * 0.9, 16),
      COMMON_MATERIALS.brassBronze
    );
    tubeBundle.rotation.z = Math.PI / 2;
    tubeBundle.position.set(0, 1.5, 0);
    group.add(tubeBundle);
  }

  // Channel Head (left side) with flanged connection
  const channelFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.15, 32), COMMON_MATERIALS.carbonSteel);
  channelFlange.rotation.z = Math.PI / 2;
  channelFlange.position.set(-shellLength / 2 - 0.08, 1.5, 0);
  group.add(channelFlange);

  const channelHead = new THREE.Mesh(new THREE.CylinderGeometry(shellRadius, shellRadius, 0.8, 32), COMMON_MATERIALS.carbonSteel);
  channelHead.rotation.z = Math.PI / 2;
  channelHead.position.set(-shellLength / 2 - 0.5, 1.5, 0);
  group.add(channelHead);

  // Channel head dome cap
  const channelCap = new THREE.Mesh(new THREE.SphereGeometry(shellRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), COMMON_MATERIALS.carbonSteel);
  channelCap.rotation.z = Math.PI / 2;
  channelCap.position.set(-shellLength / 2 - 0.9, 1.5, 0);
  group.add(channelCap);

  // Rear floating head cover (right side)
  const rearFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.15, 32), COMMON_MATERIALS.carbonSteel);
  rearFlange.rotation.z = Math.PI / 2;
  rearFlange.position.set(shellLength / 2 + 0.08, 1.5, 0);
  group.add(rearFlange);

  const rearCap = new THREE.Mesh(new THREE.SphereGeometry(shellRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), COMMON_MATERIALS.carbonSteel);
  rearCap.rotation.z = -Math.PI / 2;
  rearCap.position.set(shellLength / 2 + 0.15, 1.5, 0);
  group.add(rearCap);

  // Shell inlet/outlet nozzles (top & bottom)
  // Tube side inlet (channel head side, bottom)
  const tubeInlet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16), COMMON_MATERIALS.carbonSteel);
  tubeInlet.position.set(-shellLength / 2 - 0.5, 0.9, 0);
  group.add(tubeInlet);

  const tubeInFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16), COMMON_MATERIALS.stainlessSteel);
  tubeInFlange.position.set(-shellLength / 2 - 0.5, 0.65, 0);
  group.add(tubeInFlange);

  // Tube side outlet (channel head side, top)
  const tubeOutlet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16), COMMON_MATERIALS.carbonSteel);
  tubeOutlet.position.set(-shellLength / 2 - 0.5, 2.1, 0);
  group.add(tubeOutlet);

  const tubeOutFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16), COMMON_MATERIALS.stainlessSteel);
  tubeOutFlange.position.set(-shellLength / 2 - 0.5, 2.35, 0);
  group.add(tubeOutFlange);

  // Shell side inlet (top right)
  const shellInlet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16), COMMON_MATERIALS.carbonSteel);
  shellInlet.position.set(1.2, 2.45, 0);
  group.add(shellInlet);

  const shellInFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 16), COMMON_MATERIALS.stainlessSteel);
  shellInFlange.position.set(1.2, 2.7, 0);
  group.add(shellInFlange);

  // Shell side outlet (bottom left)
  const shellOutlet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16), COMMON_MATERIALS.carbonSteel);
  shellOutlet.position.set(-1.0, 0.55, 0);
  group.add(shellOutlet);

  const shellOutFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 16), COMMON_MATERIALS.stainlessSteel);
  shellOutFlange.position.set(-1.0, 0.3, 0);
  group.add(shellOutFlange);

  const { beaconMesh, mat: statusMaterial } = addStatusBeacon(group, unit, 2.75);

  const tubeInPos = new THREE.Vector3(-shellLength / 2 - 0.5, 0.61, 0);
  const tubeOutPos = new THREE.Vector3(-shellLength / 2 - 0.5, 2.39, 0);
  const shellInPos = new THREE.Vector3(1.2, 2.74, 0);
  const shellOutPos = new THREE.Vector3(-1.0, 0.26, 0);

  return {
    unit,
    inletNozzles: [tubeInPos, shellInPos],
    outletNozzles: [tubeOutPos, shellOutPos],
    inletPorts: [
      {
        id: 'tube_in',
        streamId: 'S-102',
        position: tubeInPos,
        direction: new THREE.Vector3(0, -1, 0),
        flangeRadius: 0.25,
      },
      {
        id: 'shell_in',
        streamId: 'S-105',
        position: shellInPos,
        direction: new THREE.Vector3(0, 1, 0),
        flangeRadius: 0.27,
      },
    ],
    outletPorts: [
      {
        id: 'tube_out',
        streamId: 'S-103',
        position: tubeOutPos,
        direction: new THREE.Vector3(0, 1, 0),
        flangeRadius: 0.25,
      },
      {
        id: 'shell_out',
        streamId: 'S-105b',
        position: shellOutPos,
        direction: new THREE.Vector3(0, -1, 0),
        flangeRadius: 0.27,
      },
    ],
    group,
    beaconLight: beaconMesh,
    statusMaterial,
  };
}

/**
 * Build 3D Fired Charge Furnace / Heater
 */
export function buildFurnace3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  const group = new THREE.Group();
  group.userData = { type: 'equipment', id: unit.id, unitType: 'furnace' };

  addFoundationPad(group, 3.8, 3.8, 0.35);

  // Radiant Box Firebox Casing
  const fireboxMat = renderMode === 'x-ray'
    ? createPBRMaterial('#f97316', 0.3, 0.4, true, 0.4)
    : COMMON_MATERIALS.furnaceRefractory;

  const firebox = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.8, 2.8), fireboxMat);
  firebox.position.set(0, 1.8, 0);
  firebox.castShadow = true;
  group.add(firebox);

  // Structural Steel Frame around firebox (beams & columns)
  const steelMat = COMMON_MATERIALS.safetyYellow;
  [-1.4, 1.4].forEach((x) => {
    [-1.4, 1.4].forEach((z) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.2, 0.16), steelMat);
      col.position.set(x, 1.8, z);
      group.add(col);
    });
  });

  // Convection Section (narrower upper box)
  const convection = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 2.0), COMMON_MATERIALS.carbonSteel);
  convection.position.set(0, 3.8, 0);
  group.add(convection);

  // Stack Breeching Transition
  const breeching = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.0, 0.8, 24), COMMON_MATERIALS.carbonSteel);
  breeching.position.set(0, 5.0, 0);
  group.add(breeching);

  // Tall Exhaust Flue Gas Stack
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, 4.0, 24), COMMON_MATERIALS.carbonSteel);
  stack.position.set(0, 7.4, 0);
  stack.castShadow = true;
  group.add(stack);

  // Stack Damper & Platform
  const stackPlatform = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 24), COMMON_MATERIALS.grating);
  stackPlatform.position.set(0, 8.5, 0);
  group.add(stackPlatform);

  // Burner Floor Manifold Piping
  const burnerManifold = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2.4), COMMON_MATERIALS.castIron);
  burnerManifold.position.set(0, 0.5, 0);
  group.add(burnerManifold);

  // Coil Process Inlet (Convection top inlet)
  const coilInlet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 16), COMMON_MATERIALS.stainlessSteel);
  coilInlet.rotation.z = Math.PI / 2;
  coilInlet.position.set(-1.3, 4.2, 0);
  group.add(coilInlet);

  const coilInletFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16), COMMON_MATERIALS.stainlessSteel);
  coilInletFlange.rotation.z = Math.PI / 2;
  coilInletFlange.position.set(-1.6, 4.2, 0);
  group.add(coilInletFlange);

  // Coil Process Outlet (Radiant bottom outlet - hot stream to reactor)
  const coilOutlet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16), COMMON_MATERIALS.stainlessSteel);
  coilOutlet.rotation.z = Math.PI / 2;
  coilOutlet.position.set(1.6, 1.2, 0);
  group.add(coilOutlet);

  const coilOutletFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), COMMON_MATERIALS.stainlessSteel);
  coilOutletFlange.rotation.z = Math.PI / 2;
  coilOutletFlange.position.set(1.9, 1.2, 0);
  group.add(coilOutletFlange);

  // Internal flame glow (visible in shaded or x-ray mode)
  const flameLight = new THREE.PointLight(0xff6600, 2.5, 6);
  flameLight.position.set(0, 1.4, 0);
  group.add(flameLight);

  const { beaconMesh, mat: statusMaterial } = addStatusBeacon(group, unit, 9.6);

  const inletPos = new THREE.Vector3(-1.64, 4.2, 0);
  const outletPos = new THREE.Vector3(1.94, 1.2, 0);

  return {
    unit,
    inletNozzles: [inletPos],
    outletNozzles: [outletPos],
    inletPorts: [
      {
        id: 'coil_in',
        streamId: 'S-103',
        position: inletPos,
        direction: new THREE.Vector3(-1, 0, 0),
        flangeRadius: 0.26,
      },
    ],
    outletPorts: [
      {
        id: 'coil_out',
        streamId: 'S-104',
        position: outletPos,
        direction: new THREE.Vector3(1, 0, 0),
        flangeRadius: 0.28,
      },
    ],
    group,
    beaconLight: beaconMesh,
    statusMaterial,
  };
}

/**
 * Build 3D Heavy-Wall Catalytic Fixed Bed Reactor (e.g. R-101)
 */
export function buildReactor3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  const group = new THREE.Group();
  group.userData = { type: 'equipment', id: unit.id, unitType: 'reactor' };

  addFoundationPad(group, 3.6, 3.6, 0.4);

  // Cylindrical Support Skirt
  const skirtHeight = 1.8;
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.35, skirtHeight, 32, 1, true),
    COMMON_MATERIALS.carbonSteel
  );
  skirt.position.set(0, skirtHeight / 2 + 0.4, 0);
  group.add(skirt);

  // Skirt Access Manway
  const manway = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16), COMMON_MATERIALS.carbonSteel);
  manway.rotation.x = Math.PI / 2;
  manway.position.set(0, 1.1, 1.3);
  group.add(manway);

  const reactorRadius = 1.2;
  const reactorHeight = 6.2;
  const baseY = skirtHeight + 0.4;

  // Reactor Shell Material (X-Ray allows seeing internal catalyst beds)
  const shellMat = renderMode === 'x-ray'
    ? createPBRMaterial('#059669', 0.25, 0.6, true, 0.35)
    : COMMON_MATERIALS.insulatedJacket;

  // Main Heavy-Wall Cylindrical Shell
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(reactorRadius, reactorRadius, reactorHeight, 32),
    shellMat
  );
  shell.position.set(0, baseY + reactorHeight / 2, 0);
  shell.castShadow = true;
  group.add(shell);

  // Top Hemispherical Head
  const topHead = new THREE.Mesh(
    new THREE.SphereGeometry(reactorRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    shellMat
  );
  topHead.position.set(0, baseY + reactorHeight, 0);
  group.add(topHead);

  // Bottom Hemispherical Head
  const bottomHead = new THREE.Mesh(
    new THREE.SphereGeometry(reactorRadius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    shellMat
  );
  bottomHead.position.set(0, baseY, 0);
  group.add(bottomHead);

  // Internal Dual Catalyst Beds (visible in X-Ray)
  if (renderMode === 'x-ray') {
    // Bed 1 (Top)
    const bed1 = new THREE.Mesh(
      new THREE.CylinderGeometry(reactorRadius * 0.9, reactorRadius * 0.9, 2.0, 24),
      COMMON_MATERIALS.catalystBed
    );
    bed1.position.set(0, baseY + 4.2, 0);
    group.add(bed1);

    // Bed 2 (Bottom)
    const bed2 = new THREE.Mesh(
      new THREE.CylinderGeometry(reactorRadius * 0.9, reactorRadius * 0.9, 2.2, 24),
      COMMON_MATERIALS.catalystBed
    );
    bed2.position.set(0, baseY + 1.6, 0);
    group.add(bed2);

    // Intermediate Quench Distributor
    const quenchRing = new THREE.Mesh(
      new THREE.TorusGeometry(reactorRadius * 0.75, 0.08, 12, 24),
      COMMON_MATERIALS.stainlessSteel
    );
    quenchRing.rotation.x = Math.PI / 2;
    quenchRing.position.set(0, baseY + 2.9, 0);
    group.add(quenchRing);
  }

  // Top Process Inlet Nozzle (Charge from furnace)
  const topInlet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.8, 16), COMMON_MATERIALS.stainlessSteel);
  topInlet.position.set(0, baseY + reactorHeight + reactorRadius + 0.3, 0);
  group.add(topInlet);

  // Top Inlet Flange
  const topFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16), COMMON_MATERIALS.carbonSteel);
  topFlange.position.set(0, baseY + reactorHeight + reactorRadius + 0.7, 0);
  group.add(topFlange);

  // Bottom Process Outlet Nozzle (Effluent to feed-effluent exchanger)
  const bottomOutlet = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.8, 16), COMMON_MATERIALS.stainlessSteel);
  bottomOutlet.position.set(0, baseY - 0.4, 0);
  group.add(bottomOutlet);

  const bottomFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16), COMMON_MATERIALS.carbonSteel);
  bottomFlange.position.set(0, baseY - 0.74, 0);
  group.add(bottomFlange);

  // External Ring Platforms & Ladders
  [baseY + 2.0, baseY + 4.8].forEach((platY) => {
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(reactorRadius + 0.8, reactorRadius + 0.8, 0.1, 24, 1, false, 0, Math.PI * 1.5),
      COMMON_MATERIALS.grating
    );
    platform.position.set(0, platY, 0);
    group.add(platform);

    const handrail = new THREE.Mesh(
      new THREE.TorusGeometry(reactorRadius + 0.8, 0.03, 8, 24, Math.PI * 1.5),
      COMMON_MATERIALS.safetyYellow
    );
    handrail.rotation.x = Math.PI / 2;
    handrail.position.set(0, platY + 0.9, 0);
    group.add(handrail);
  });

  const { beaconMesh, mat: statusMaterial } = addStatusBeacon(group, unit, baseY + reactorHeight + reactorRadius + 0.9);

  const topInletPos = new THREE.Vector3(0, baseY + reactorHeight + reactorRadius + 0.76, 0);
  const bottomOutletPos = new THREE.Vector3(0, baseY - 0.76, 0);

  return {
    unit,
    inletNozzles: [topInletPos],
    outletNozzles: [bottomOutletPos],
    inletPorts: [
      {
        id: 'reactor_inlet',
        streamId: 'S-104',
        position: topInletPos,
        direction: new THREE.Vector3(0, 1, 0),
        flangeRadius: 0.36,
      },
    ],
    outletPorts: [
      {
        id: 'reactor_outlet',
        streamId: 'S-105',
        position: bottomOutletPos,
        direction: new THREE.Vector3(0, -1, 0),
        flangeRadius: 0.36,
      },
    ],
    group,
    beaconLight: beaconMesh,
    statusMaterial,
  };
}

/**
 * Build 3D Pressure Vessel / Flash Drum (e.g. V-101)
 */
export function buildVessel3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  const group = new THREE.Group();
  group.userData = { type: 'equipment', id: unit.id, unitType: 'vessel' };

  addFoundationPad(group, 2.6, 2.6, 0.3);

  // Vertical skirt / 4 leg supports
  const skirtHeight = 1.4;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, skirtHeight, 0.18), COMMON_MATERIALS.carbonSteel);
    leg.position.set(Math.cos(angle) * 0.85, skirtHeight / 2 + 0.3, Math.sin(angle) * 0.85);
    group.add(leg);
  }

  const vesselRadius = 0.9;
  const vesselHeight = 3.6;
  const baseY = skirtHeight + 0.3;

  const vesselMat = renderMode === 'x-ray'
    ? createPBRMaterial('#0284c7', 0.2, 0.7, true, 0.35)
    : COMMON_MATERIALS.carbonSteel;

  // Main Shell
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(vesselRadius, vesselRadius, vesselHeight, 32), vesselMat);
  shell.position.set(0, baseY + vesselHeight / 2, 0);
  shell.castShadow = true;
  group.add(shell);

  // Dished 2:1 Ellipsoidal Heads
  const topHead = new THREE.Mesh(
    new THREE.SphereGeometry(vesselRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    vesselMat
  );
  topHead.scale.set(1, 0.6, 1);
  topHead.position.set(0, baseY + vesselHeight, 0);
  group.add(topHead);

  const bottomHead = new THREE.Mesh(
    new THREE.SphereGeometry(vesselRadius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    vesselMat
  );
  bottomHead.scale.set(1, 0.6, 1);
  bottomHead.position.set(0, baseY, 0);
  group.add(bottomHead);

  // Internal Liquid Level & Demister Pad (visible in X-Ray)
  if (renderMode === 'x-ray') {
    // Liquid hydrocarbon volume
    const liquidVolume = new THREE.Mesh(
      new THREE.CylinderGeometry(vesselRadius * 0.95, vesselRadius * 0.95, 1.4, 24),
      COMMON_MATERIALS.glassLiquid
    );
    liquidVolume.position.set(0, baseY + 0.7, 0);
    group.add(liquidVolume);

    // Demister mesh pad at top vapor space
    const demister = new THREE.Mesh(
      new THREE.CylinderGeometry(vesselRadius * 0.92, vesselRadius * 0.92, 0.25, 24),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, wireframe: true })
    );
    demister.position.set(0, baseY + vesselHeight - 0.5, 0);
    group.add(demister);
  }

  // Mixed Feed Inlet (Mid-height side nozzle with internal impingement baffle)
  const feedInlet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16), COMMON_MATERIALS.carbonSteel);
  feedInlet.rotation.z = Math.PI / 2;
  feedInlet.position.set(-vesselRadius - 0.3, baseY + vesselHeight * 0.6, 0);
  group.add(feedInlet);

  const feedInletFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), COMMON_MATERIALS.carbonSteel);
  feedInletFlange.rotation.z = Math.PI / 2;
  feedInletFlange.position.set(-vesselRadius - 0.6, baseY + vesselHeight * 0.6, 0);
  group.add(feedInletFlange);

  // Top Vapor Outlet (S-106 H2 Recycle gas)
  const vaporOutlet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16), COMMON_MATERIALS.carbonSteel);
  vaporOutlet.position.set(0, baseY + vesselHeight + 0.7, 0);
  group.add(vaporOutlet);

  const vaporFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), COMMON_MATERIALS.carbonSteel);
  vaporFlange.position.set(0, baseY + vesselHeight + 1.05, 0);
  group.add(vaporFlange);

  // Bottom Liquid Outlet (S-107 Stabilized reformate)
  const liquidOutlet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 16), COMMON_MATERIALS.carbonSteel);
  liquidOutlet.position.set(0, baseY - 0.7, 0);
  group.add(liquidOutlet);

  const liquidFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 16), COMMON_MATERIALS.carbonSteel);
  liquidFlange.position.set(0, baseY - 1.05, 0);
  group.add(liquidFlange);

  // Level Gauge Column on side
  const bridle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 12), COMMON_MATERIALS.stainlessSteel);
  bridle.position.set(vesselRadius + 0.3, baseY + 1.2, 0);
  group.add(bridle);

  const { beaconMesh, mat: statusMaterial } = addStatusBeacon(group, unit, baseY + vesselHeight + 1.1);

  const feedPos = new THREE.Vector3(-vesselRadius - 0.64, baseY + vesselHeight * 0.6, 0);
  const vaporPos = new THREE.Vector3(0, baseY + vesselHeight + 1.09, 0);
  const liquidPos = new THREE.Vector3(0, baseY - 1.09, 0);

  return {
    unit,
    inletNozzles: [feedPos],
    outletNozzles: [vaporPos, liquidPos],
    inletPorts: [
      {
        id: 'feed_in',
        streamId: 'S-105b',
        position: feedPos,
        direction: new THREE.Vector3(-1, 0, 0),
        flangeRadius: 0.28,
      },
    ],
    outletPorts: [
      {
        id: 'vapor_out',
        streamId: 'S-106',
        position: vaporPos,
        direction: new THREE.Vector3(0, 1, 0),
        flangeRadius: 0.28,
      },
      {
        id: 'liquid_out',
        streamId: 'S-107',
        position: liquidPos,
        direction: new THREE.Vector3(0, -1, 0),
        flangeRadius: 0.26,
      },
    ],
    group,
    beaconLight: beaconMesh,
    statusMaterial,
  };
}

/**
 * Build 3D Distillation / Fractionation Column
 */
export function buildColumn3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  const group = new THREE.Group();
  group.userData = { type: 'equipment', id: unit.id, unitType: 'column' };

  addFoundationPad(group, 4.0, 4.0, 0.45);

  const columnRadius = 1.1;
  const columnHeight = 11.5;
  const skirtHeight = 2.0;
  const baseY = skirtHeight + 0.45;

  // Skirt support
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(columnRadius, columnRadius * 1.15, skirtHeight, 32), COMMON_MATERIALS.carbonSteel);
  skirt.position.set(0, skirtHeight / 2 + 0.45, 0);
  group.add(skirt);

  const colMat = renderMode === 'x-ray'
    ? createPBRMaterial('#38bdf8', 0.25, 0.6, true, 0.35)
    : COMMON_MATERIALS.insulatedJacket;

  // Tall Column Cylinder
  const columnBody = new THREE.Mesh(new THREE.CylinderGeometry(columnRadius, columnRadius, columnHeight, 32), colMat);
  columnBody.position.set(0, baseY + columnHeight / 2, 0);
  columnBody.castShadow = true;
  group.add(columnBody);

  // Top and Bottom Dished Heads
  const topHead = new THREE.Mesh(new THREE.SphereGeometry(columnRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), colMat);
  topHead.position.set(0, baseY + columnHeight, 0);
  group.add(topHead);

  const bottomHead = new THREE.Mesh(new THREE.SphereGeometry(columnRadius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), colMat);
  bottomHead.position.set(0, baseY, 0);
  group.add(bottomHead);

  // Internal Trays (visible in X-Ray)
  if (renderMode === 'x-ray') {
    const numTrays = 16;
    for (let i = 1; i <= numTrays; i++) {
      const trayY = baseY + (columnHeight / (numTrays + 1)) * i;
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(columnRadius * 0.95, columnRadius * 0.95, 0.05, 24), COMMON_MATERIALS.stainlessSteel);
      tray.position.set(0, trayY, 0);
      group.add(tray);
    }
  }

  // External Ring Platforms at multiple elevations
  [baseY + 3.0, baseY + 6.5, baseY + 10.0].forEach((platY) => {
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(columnRadius + 0.9, columnRadius + 0.9, 0.1, 24, 1, false, 0, Math.PI * 1.5),
      COMMON_MATERIALS.grating
    );
    platform.position.set(0, platY, 0);
    group.add(platform);

    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(columnRadius + 0.9, 0.035, 8, 24, Math.PI * 1.5),
      COMMON_MATERIALS.safetyYellow
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.set(0, platY + 0.9, 0);
    group.add(rail);
  });

  // Vertical Caged Safety Ladder
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.1, columnHeight + skirtHeight, 0.45), COMMON_MATERIALS.safetyYellow);
  ladder.position.set(-columnRadius - 0.25, (columnHeight + skirtHeight) / 2 + 0.45, 0);
  group.add(ladder);

  // Nozzles
  // Feed inlet (middle)
  const feedNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16), COMMON_MATERIALS.carbonSteel);
  feedNozzle.rotation.z = Math.PI / 2;
  feedNozzle.position.set(columnRadius + 0.3, baseY + columnHeight * 0.5, 0);
  group.add(feedNozzle);

  // Overhead vapor line (top)
  const overheadNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.8, 16), COMMON_MATERIALS.carbonSteel);
  overheadNozzle.position.set(0, baseY + columnHeight + columnRadius + 0.4, 0);
  group.add(overheadNozzle);

  // Bottoms liquid line (bottom)
  const bottomsNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 16), COMMON_MATERIALS.carbonSteel);
  bottomsNozzle.position.set(0, baseY - 0.5, 0);
  group.add(bottomsNozzle);

  // Reboiler draw / return nozzles
  const rebDraw = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16), COMMON_MATERIALS.carbonSteel);
  rebDraw.rotation.z = Math.PI / 2;
  rebDraw.position.set(-columnRadius - 0.25, baseY + 0.8, 0);
  group.add(rebDraw);

  const { beaconMesh, mat: statusMaterial } = addStatusBeacon(group, unit, baseY + columnHeight + columnRadius + 1.2);

  const feedInPos = new THREE.Vector3(columnRadius + 0.6, baseY + columnHeight * 0.5, 0);
  const vaporOutPos = new THREE.Vector3(0, baseY + columnHeight + columnRadius + 0.8, 0);
  const liquidOutPos = new THREE.Vector3(0, baseY - 0.8, 0);

  return {
    unit,
    inletNozzles: [feedInPos],
    outletNozzles: [vaporOutPos, liquidOutPos],
    inletPorts: [
      {
        id: 'feed_in',
        position: feedInPos,
        direction: new THREE.Vector3(1, 0, 0),
        flangeRadius: 0.28,
      },
    ],
    outletPorts: [
      {
        id: 'overhead_vapor',
        position: vaporOutPos,
        direction: new THREE.Vector3(0, 1, 0),
        flangeRadius: 0.32,
      },
      {
        id: 'bottoms_liquid',
        position: liquidOutPos,
        direction: new THREE.Vector3(0, -1, 0),
        flangeRadius: 0.28,
      },
    ],
    group,
    beaconLight: beaconMesh,
    statusMaterial,
  };
}

/**
 * Build 3D Multi-Stage Centrifugal Gas Compressor
 */
export function buildCompressor3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  const group = new THREE.Group();
  group.userData = { type: 'equipment', id: unit.id, unitType: 'compressor' };

  addFoundationPad(group, 3.2, 1.8, 0.35);

  const compMat = renderMode === 'x-ray'
    ? createPBRMaterial('#10b981', 0.3, 0.6, true, 0.4)
    : COMMON_MATERIALS.castIron;

  // Split casing barrel body
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 1.2, 24), compMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(-0.6, 0.95, 0);
  barrel.castShadow = true;
  group.add(barrel);

  // Electric Motor / Steam Turbine Driver
  const driver = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 24), COMMON_MATERIALS.safetyBlue);
  driver.rotation.z = Math.PI / 2;
  driver.position.set(0.8, 0.95, 0);
  driver.castShadow = true;
  group.add(driver);

  // Coupling & Speed Increaser Gearbox
  const gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.6), COMMON_MATERIALS.castIron);
  gearbox.position.set(0.1, 0.95, 0);
  group.add(gearbox);

  // Gas Suction Nozzle (axial or bottom/side)
  const suction = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16), COMMON_MATERIALS.carbonSteel);
  suction.position.set(-0.8, 1.5, 0);
  group.add(suction);

  // Gas Discharge Nozzle (tangential)
  const discharge = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 16), COMMON_MATERIALS.carbonSteel);
  discharge.rotation.z = Math.PI / 2;
  discharge.position.set(-1.2, 0.95, 0);
  group.add(discharge);

  // Lube Oil Console Skid
  const lubeSkid = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.5), COMMON_MATERIALS.safetyYellow);
  lubeSkid.position.set(0, 0.5, 0.65);
  group.add(lubeSkid);

  const { beaconMesh, mat: statusMaterial } = addStatusBeacon(group, unit, 1.85);

  const compInPos = new THREE.Vector3(-0.8, 1.8, 0);
  const compOutPos = new THREE.Vector3(-1.5, 0.95, 0);

  return {
    unit,
    inletNozzles: [compInPos],
    outletNozzles: [compOutPos],
    inletPorts: [
      {
        id: 'suction',
        position: compInPos,
        direction: new THREE.Vector3(0, 1, 0),
        flangeRadius: 0.28,
      },
    ],
    outletPorts: [
      {
        id: 'discharge',
        position: compOutPos,
        direction: new THREE.Vector3(-1, 0, 0),
        flangeRadius: 0.24,
      },
    ],
    group,
    beaconLight: beaconMesh,
    statusMaterial,
  };
}

/**
 * Build 3D Control / Block Valve
 */
export function buildValve3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  const group = new THREE.Group();
  group.userData = { type: 'equipment', id: unit.id, unitType: 'valve' };

  addFoundationPad(group, 1.4, 1.2, 0.2);

  const valveMat = COMMON_MATERIALS.castIron;

  // Globe valve body (spherical middle with two opposing conical reducers)
  const bodyCenter = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), valveMat);
  bodyCenter.position.set(0, 0.7, 0);
  group.add(bodyCenter);

  // Inlet cone
  const inletCone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.35, 16), valveMat);
  inletCone.rotation.z = Math.PI / 2;
  inletCone.position.set(-0.25, 0.7, 0);
  group.add(inletCone);

  // Outlet cone
  const outletCone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.35, 16), valveMat);
  outletCone.rotation.z = -Math.PI / 2;
  outletCone.position.set(0.25, 0.7, 0);
  group.add(outletCone);

  // Flanges
  [-0.45, 0.45].forEach((x) => {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), COMMON_MATERIALS.carbonSteel);
    flange.rotation.z = Math.PI / 2;
    flange.position.set(x, 0.7, 0);
    group.add(flange);
  });

  // Bonnet & Stem
  const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.45, 16), COMMON_MATERIALS.carbonSteel);
  bonnet.position.set(0, 1.05, 0);
  group.add(bonnet);

  // Pneumatic Diaphragm Actuator (Top Dome)
  const actuatorDome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.35, 24),
    COMMON_MATERIALS.safetyRed
  );
  actuatorDome.position.set(0, 1.45, 0);
  group.add(actuatorDome);

  // Valve Position Indicator / Handwheel
  const positioner = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.15), COMMON_MATERIALS.stainlessSteel);
  positioner.position.set(0.2, 1.25, 0);
  group.add(positioner);

  const { beaconMesh, mat: statusMaterial } = addStatusBeacon(group, unit, 1.8);

  const valveInPos = new THREE.Vector3(-0.5, 0.7, 0);
  const valveOutPos = new THREE.Vector3(0.5, 0.7, 0);

  return {
    unit,
    inletNozzles: [valveInPos],
    outletNozzles: [valveOutPos],
    inletPorts: [
      {
        id: 'valve_in',
        position: valveInPos,
        direction: new THREE.Vector3(-1, 0, 0),
        flangeRadius: 0.32,
      },
    ],
    outletPorts: [
      {
        id: 'valve_out',
        position: valveOutPos,
        direction: new THREE.Vector3(1, 0, 0),
        flangeRadius: 0.32,
      },
    ],
    group,
    beaconLight: beaconMesh,
    statusMaterial,
  };
}

/**
 * Build 3D Atmospheric Storage Tank (API 650)
 */
export function buildStorageTank3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  const group = new THREE.Group();
  group.userData = { type: 'equipment', id: unit.id, unitType: 'storage_tank' };

  addFoundationPad(group, 5.5, 5.5, 0.3);

  const tankRadius = 2.4;
  const tankHeight = 4.2;

  const tankMat = renderMode === 'x-ray'
    ? createPBRMaterial('#cbd5e1', 0.4, 0.3, true, 0.35)
    : COMMON_MATERIALS.stainlessSteel;

  // Main Cylinder Shell
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(tankRadius, tankRadius, tankHeight, 32), tankMat);
  shell.position.set(0, tankHeight / 2 + 0.3, 0);
  shell.castShadow = true;
  group.add(shell);

  // Conical / Dome Roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(tankRadius * 1.02, 0.8, 32), COMMON_MATERIALS.carbonSteel);
  roof.position.set(0, tankHeight + 0.7, 0);
  group.add(roof);

  // Roof Railing
  const roofRail = new THREE.Mesh(
    new THREE.TorusGeometry(tankRadius * 0.9, 0.03, 8, 32),
    COMMON_MATERIALS.safetyYellow
  );
  roofRail.rotation.x = Math.PI / 2;
  roofRail.position.set(0, tankHeight + 0.7, 0);
  group.add(roofRail);

  // Spiral Exterior Staircase (Represented by helical ring segments)
  const stairSteps = 16;
  for (let i = 0; i < stairSteps; i++) {
    const angle = (i / stairSteps) * Math.PI * 1.4;
    const y = 0.3 + (i / stairSteps) * tankHeight;
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.2), COMMON_MATERIALS.grating);
    step.position.set(Math.cos(angle) * (tankRadius + 0.25), y, Math.sin(angle) * (tankRadius + 0.25));
    step.rotation.y = -angle;
    group.add(step);
  }

  // Inlet nozzle (side)
  const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16), COMMON_MATERIALS.carbonSteel);
  inlet.rotation.z = Math.PI / 2;
  inlet.position.set(-tankRadius - 0.3, 1.2, 0);
  group.add(inlet);

  // Outlet suction nozzle (bottom with vortex breaker)
  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16), COMMON_MATERIALS.carbonSteel);
  outlet.rotation.z = Math.PI / 2;
  outlet.position.set(tankRadius + 0.3, 0.8, 0);
  group.add(outlet);

  const { beaconMesh, mat: statusMaterial } = addStatusBeacon(group, unit, tankHeight + 1.2);

  const tankInPos = new THREE.Vector3(-tankRadius - 0.6, 1.2, 0);
  const tankOutPos = new THREE.Vector3(tankRadius + 0.6, 0.8, 0);

  return {
    unit,
    inletNozzles: [tankInPos],
    outletNozzles: [tankOutPos],
    inletPorts: [
      {
        id: 'tank_in',
        position: tankInPos,
        direction: new THREE.Vector3(-1, 0, 0),
        flangeRadius: 0.28,
      },
    ],
    outletPorts: [
      {
        id: 'tank_out',
        position: tankOutPos,
        direction: new THREE.Vector3(1, 0, 0),
        flangeRadius: 0.3,
      },
    ],
    group,
    beaconLight: beaconMesh,
    statusMaterial,
  };
}

/**
 * Universal Equipment 3D Factory
 */
export function buildEquipment3D(unit: EquipmentUnit, renderMode: RenderMode): Unit3DMetadata {
  switch (unit.type as string) {
    case 'pump':
      return buildPump3D(unit, renderMode);
    case 'heatex':
      return buildHeatex3D(unit, renderMode);
    case 'furnace':
      return buildFurnace3D(unit, renderMode);
    case 'reactor':
      return buildReactor3D(unit, renderMode);
    case 'vessel':
    case 'three_phase_separator':
    case 'liquid_liquid_separator':
      return buildVessel3D(unit, renderMode);
    case 'column':
    case 'absorber':
    case 'stripper':
      return buildColumn3D(unit, renderMode);
    case 'compressor':
      return buildCompressor3D(unit, renderMode);
    case 'valve':
      return buildValve3D(unit, renderMode);
    case 'storage_tank':
      return buildStorageTank3D(unit, renderMode);
    default:
      return buildVessel3D(unit, renderMode);
  }
}

/**
 * Color mapping for Process Streams
 */
export function getStreamColor(stream: ProcessStream, colorMode: VisualColorMode): number {
  if (colorMode === 'temperature') {
    // Thermal heatmap scale: <40°C cyan/blue, 100°C yellow, 300°C orange, >500°C crimson
    const t = stream.tempC;
    if (t <= 40) return 0x38bdf8; // sky blue
    if (t <= 120) return 0x4edea3; // mint / green
    if (t <= 250) return 0xfacc15; // yellow
    if (t <= 450) return 0xf97316; // orange
    return 0xef4444; // deep crimson red
  }

  if (colorMode === 'pressure') {
    // Pressure scale: <10 bar cyan, 30 bar green, 60 bar amber, >80 bar purple
    const p = stream.presBar;
    if (p <= 10) return 0x38bdf8;
    if (p <= 40) return 0x10b981;
    if (p <= 75) return 0xf59e0b;
    return 0xa855f7; // purple / high pressure
  }

  // Default: Phase or stream defined color
  if (stream.isRecycle) return 0xacedff;
  if (stream.phase.includes('Vapor')) return 0x4edea3;
  if (stream.phase.includes('Liquid')) return 0x38bdf8;
  if (stream.phase.includes('Mixed')) return 0xffb95f;

  return 0x38bdf8;
}

/**
 * Resolves the precise nozzle connection port for a given stream on an equipment unit
 */
export function getUnitPort(
  meta: Unit3DMetadata,
  type: 'inlet' | 'outlet',
  stream: ProcessStream,
  streamIndex = 0
): { worldPos: THREE.Vector3; direction: THREE.Vector3; flangeRadius: number } {
  meta.group.updateMatrixWorld(true);
  const ports = type === 'inlet' ? meta.inletPorts : meta.outletPorts;
  const legacyList = type === 'inlet' ? meta.inletNozzles : meta.outletNozzles;

  if (ports && ports.length > 0) {
    // 1. Direct streamId match
    const matched = ports.find((p) => p.streamId === stream.id || p.id.toLowerCase() === stream.id.toLowerCase());
    if (matched) {
      const worldPos = matched.position.clone().applyMatrix4(meta.group.matrixWorld);
      const worldDir = matched.direction.clone().transformDirection(meta.group.matrixWorld).normalize();
      return { worldPos, direction: worldDir, flangeRadius: matched.flangeRadius };
    }

    // 2. Specific equipment port logic
    if (meta.unit.type === 'heatex') {
      if (type === 'inlet') {
        const isHot = stream.tempC > 200 || stream.id === 'S-105';
        const port = isHot ? (ports[1] || ports[0]) : ports[0];
        const worldPos = port.position.clone().applyMatrix4(meta.group.matrixWorld);
        const worldDir = port.direction.clone().transformDirection(meta.group.matrixWorld).normalize();
        return { worldPos, direction: worldDir, flangeRadius: port.flangeRadius };
      } else {
        const isTubeOut = stream.id === 'S-103' || stream.tempC > 150;
        const port = isTubeOut ? ports[0] : (ports[1] || ports[0]);
        const worldPos = port.position.clone().applyMatrix4(meta.group.matrixWorld);
        const worldDir = port.direction.clone().transformDirection(meta.group.matrixWorld).normalize();
        return { worldPos, direction: worldDir, flangeRadius: port.flangeRadius };
      }
    }

    if (meta.unit.type === 'vessel' || meta.unit.type === 'column' || meta.unit.type === 'three_phase_separator') {
      if (type === 'outlet') {
        const isVapor = stream.vaporFraction > 0.5 || stream.phase.toLowerCase().includes('vapor') || stream.id === 'S-106';
        const port = isVapor ? ports[0] : (ports[1] || ports[0]);
        const worldPos = port.position.clone().applyMatrix4(meta.group.matrixWorld);
        const worldDir = port.direction.clone().transformDirection(meta.group.matrixWorld).normalize();
        return { worldPos, direction: worldDir, flangeRadius: port.flangeRadius };
      }
    }

    // 3. Fallback based on stream index
    const streamList = type === 'inlet' ? meta.unit.inletStreamIds : meta.unit.outletStreamIds;
    const sIdx = Math.max(0, streamList.indexOf(stream.id));
    const port = ports[sIdx % ports.length];
    const worldPos = port.position.clone().applyMatrix4(meta.group.matrixWorld);
    const worldDir = port.direction.clone().transformDirection(meta.group.matrixWorld).normalize();
    return { worldPos, direction: worldDir, flangeRadius: port.flangeRadius };
  }

  const localPos = (legacyList && legacyList[streamIndex % legacyList.length]) || new THREE.Vector3(0, 1.5, 0);
  const worldPos = localPos.clone().applyMatrix4(meta.group.matrixWorld);
  return { worldPos, direction: new THREE.Vector3(0, 1, 0), flangeRadius: 0.24 };
}

/**
 * Creates companion weld-neck flange bolted flush to the equipment nozzle face
 */
function createCompanionFlange(pos: THREE.Vector3, dir: THREE.Vector3, flangeRadius: number): THREE.Mesh {
  const flangeGeo = new THREE.CylinderGeometry(flangeRadius, flangeRadius, 0.08, 16);
  const flangeMat = COMMON_MATERIALS.stainlessSteel;
  const flangeMesh = new THREE.Mesh(flangeGeo, flangeMat);

  const normDir = dir.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(normDir.dot(up)) < 0.999) {
    flangeMesh.quaternion.setFromUnitVectors(up, normDir);
  } else if (normDir.y < 0) {
    flangeMesh.rotation.x = Math.PI;
  }
  flangeMesh.position.copy(pos).add(normDir.clone().multiplyScalar(0.04));
  flangeMesh.castShadow = true;
  return flangeMesh;
}

/**
 * Removes redundant points and collinear intermediate nodes
 */
function cleanWaypoints(rawPoints: THREE.Vector3[]): THREE.Vector3[] {
  if (rawPoints.length <= 2) return rawPoints;
  const pts: THREE.Vector3[] = [rawPoints[0].clone()];

  for (let i = 1; i < rawPoints.length; i++) {
    const prev = pts[pts.length - 1];
    const curr = rawPoints[i];
    if (prev.distanceTo(curr) > 0.04) {
      pts.push(curr.clone());
    }
  }

  if (pts.length <= 2) return pts;
  const simplified: THREE.Vector3[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const pPrev = simplified[simplified.length - 1];
    const pCurr = pts[i];
    const pNext = pts[i + 1];

    const d1 = pCurr.clone().sub(pPrev).normalize();
    const d2 = pNext.clone().sub(pCurr).normalize();

    if (d1.dot(d2) < 0.999) {
      simplified.push(pCurr);
    }
  }
  simplified.push(pts[pts.length - 1]);
  return simplified;
}

/**
 * Generates an ANSI B16.9 standard filleted curve path with smooth elbow curvature
 */
function buildFilletedCurvePath(points: THREE.Vector3[]): { curvePath: THREE.CurvePath<THREE.Vector3>; renderPoints: THREE.Vector3[] } {
  const path = new THREE.CurvePath<THREE.Vector3>();
  if (points.length <= 2) {
    if (points.length === 2) {
      path.add(new THREE.LineCurve3(points[0], points[1]));
    }
    return { curvePath: path, renderPoints: points };
  }

  const renderPoints: THREE.Vector3[] = [points[0]];
  let currentStart = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];

    const vIn = corner.clone().sub(prev);
    const vOut = next.clone().sub(corner);
    const lenIn = vIn.length();
    const lenOut = vOut.length();

    const maxR = Math.min(0.35, Math.min(lenIn, lenOut) * 0.45);

    if (maxR > 0.05) {
      const dIn = vIn.clone().normalize();
      const dOut = vOut.clone().normalize();

      const p1 = corner.clone().sub(dIn.clone().multiplyScalar(maxR));
      const p2 = corner.clone().add(dOut.clone().multiplyScalar(maxR));

      if (currentStart.distanceTo(p1) > 0.01) {
        path.add(new THREE.LineCurve3(currentStart, p1));
        renderPoints.push(p1);
      }

      const fillet = new THREE.QuadraticBezierCurve3(p1, corner, p2);
      path.add(fillet);
      renderPoints.push(corner);
      renderPoints.push(p2);

      currentStart = p2;
    } else {
      path.add(new THREE.LineCurve3(currentStart, corner));
      renderPoints.push(corner);
      currentStart = corner;
    }
  }

  const finalEnd = points[points.length - 1];
  if (currentStart.distanceTo(finalEnd) > 0.01) {
    path.add(new THREE.LineCurve3(currentStart, finalEnd));
    renderPoints.push(finalEnd);
  }

  return { curvePath: path, renderPoints };
}

/**
 * Build 3D Pipe Run with ANSI filleted orthogonal routing and companion flanges
 */
export function buildPipeRun(
  start: THREE.Vector3,
  end: THREE.Vector3,
  stream: ProcessStream,
  colorMode: VisualColorMode,
  pipeRadius = 0.08,
  startDir: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
  endDir: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
  streamIndex = 0
): { mesh: THREE.Group; path: THREE.CurvePath<THREE.Vector3>; points: THREE.Vector3[] } {
  let rawPoints: THREE.Vector3[] = [];

  const sId = stream.id;

  if (sId === 'S-101') {
    // Feed battery limit to pump suction (straight horizontal run along X axis)
    rawPoints = [start.clone(), end.clone()];
  } else if (sId === 'S-102') {
    // P-101 discharge to E-101 tube bottom inlet
    const zOffset = -0.7;
    rawPoints = [
      start.clone(),
      new THREE.Vector3(start.x, 2.2, start.z),
      new THREE.Vector3(start.x, 2.2, start.z + zOffset),
      new THREE.Vector3(end.x, 2.2, start.z + zOffset),
      new THREE.Vector3(end.x, 0.25, start.z + zOffset),
      new THREE.Vector3(end.x, 0.25, end.z),
      end.clone(),
    ];
  } else if (sId === 'S-103') {
    // E-101 tube top outlet to Furnace convection inlet
    const zOffset = -0.6;
    rawPoints = [
      start.clone(),
      new THREE.Vector3(start.x, end.y, start.z),
      new THREE.Vector3(start.x, end.y, start.z + zOffset),
      new THREE.Vector3(end.x - 1.0, end.y, start.z + zOffset),
      new THREE.Vector3(end.x - 1.0, end.y, end.z),
      end.clone(),
    ];
  } else if (sId === 'S-104') {
    // Furnace radiant bottom outlet to Reactor top charge inlet
    const bridgeY = 11.4;
    rawPoints = [
      start.clone(),
      new THREE.Vector3(start.x + 1.2, start.y, start.z),
      new THREE.Vector3(start.x + 1.2, bridgeY, start.z),
      new THREE.Vector3(end.x, bridgeY, end.z),
      new THREE.Vector3(end.x, end.y + 0.5, end.z),
      end.clone(),
    ];
  } else if (sId === 'S-105') {
    // Reactor bottom effluent to E-101 shell top inlet
    const zCorridor = start.z + 1.4;
    rawPoints = [
      start.clone(),
      new THREE.Vector3(start.x, 0.6, start.z),
      new THREE.Vector3(start.x, 0.6, zCorridor),
      new THREE.Vector3(end.x, 0.6, zCorridor),
      new THREE.Vector3(end.x, 3.8, zCorridor),
      new THREE.Vector3(end.x, 3.8, end.z),
      new THREE.Vector3(end.x, end.y + 0.4, end.z),
      end.clone(),
    ];
  } else if (sId === 'S-105b') {
    // E-101 shell bottom outlet to V-101 mixed feed inlet
    const zRack = start.z + 0.8;
    rawPoints = [
      start.clone(),
      new THREE.Vector3(start.x, 0.25, start.z),
      new THREE.Vector3(start.x, 0.25, zRack),
      new THREE.Vector3(start.x, 3.2, zRack),
      new THREE.Vector3(end.x - 1.2, 3.2, zRack),
      new THREE.Vector3(end.x - 1.2, end.y, zRack),
      new THREE.Vector3(end.x - 1.2, end.y, end.z),
      end.clone(),
    ];
  } else if (sId === 'S-106') {
    // V-101 top vapor to P-101 suction recycle
    const upperRackY = 7.2;
    const zVaporRack = start.z - 1.6;
    rawPoints = [
      start.clone(),
      new THREE.Vector3(start.x, upperRackY, start.z),
      new THREE.Vector3(start.x, upperRackY, zVaporRack),
      new THREE.Vector3(end.x, upperRackY, zVaporRack),
      new THREE.Vector3(end.x, upperRackY, end.z),
      new THREE.Vector3(end.x, end.y + 0.6, end.z),
      end.clone(),
    ];
  } else if (sId === 'S-107') {
    // V-101 bottom liquid to East Battery Limit product manifold
    const zExport = start.z + 0.6;
    rawPoints = [
      start.clone(),
      new THREE.Vector3(start.x, 0.25, start.z),
      new THREE.Vector3(start.x, 0.25, zExport),
      new THREE.Vector3(start.x, 0.8, zExport),
      new THREE.Vector3(end.x - 0.8, 0.8, zExport),
      new THREE.Vector3(end.x - 0.8, 0.8, end.z),
      end.clone(),
    ];
  } else {
    // Universal Industrial Manhattan Router
    const sNorm = startDir.clone().normalize();
    const eNorm = endDir.clone().normalize();
    const stubStart = start.clone().add(sNorm.clone().multiplyScalar(0.7));
    const stubEnd = end.clone().add(eNorm.clone().multiplyScalar(0.7));
    const zRack = 0 + ((streamIndex % 5) - 2) * 0.6;
    const yRack = Math.max(3.2, Math.max(start.y, end.y) + 0.8);

    rawPoints = [
      start.clone(),
      stubStart.clone(),
      new THREE.Vector3(stubStart.x, yRack, stubStart.z),
      new THREE.Vector3(stubStart.x, yRack, zRack),
      new THREE.Vector3(stubEnd.x, yRack, zRack),
      new THREE.Vector3(stubEnd.x, yRack, stubEnd.z),
      stubEnd.clone(),
      end.clone(),
    ];
  }

  const cleaned = cleanWaypoints(rawPoints);
  const { curvePath, renderPoints } = buildFilletedCurvePath(cleaned);

  const tubularSegments = Math.max(32, cleaned.length * 16);
  const geometry = new THREE.TubeGeometry(curvePath, tubularSegments, pipeRadius, 14, false);
  const color = getStreamColor(stream, colorMode);

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: 0.75,
    roughness: 0.3,
  });

  const tubeMesh = new THREE.Mesh(geometry, material);
  tubeMesh.castShadow = true;
  tubeMesh.receiveShadow = true;

  const pipeGroup = new THREE.Group();
  pipeGroup.userData = { type: 'pipe', id: stream.id, stream };
  pipeGroup.add(tubeMesh);

  // Companion weld-neck flanges at connection faces
  const startFlange = createCompanionFlange(start, startDir, pipeRadius * 1.55);
  const endFlange = createCompanionFlange(end, endDir.clone().negate(), pipeRadius * 1.55);
  pipeGroup.add(startFlange);
  pipeGroup.add(endFlange);

  return { mesh: pipeGroup, path: curvePath, points: renderPoints };
}

/**
 * Battery Limit Tie-In Stations (Feed & Product Manifolds)
 */
export function buildBatteryLimits(scene: THREE.Scene): { westStationPos: THREE.Vector3; eastStationPos: THREE.Vector3 } {
  const stationMat = COMMON_MATERIALS.castIron;

  // West Battery Limit (Feed Station)
  const westX = -23.0;
  const westPad = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 2.4), COMMON_MATERIALS.concreteFoundation);
  westPad.position.set(westX, 0.125, 0);
  scene.add(westPad);

  // Feed riser stanchions & manifold header
  [-0.6, 0.6].forEach((z) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 12), stationMat);
    post.position.set(westX, 0.4, z);
    scene.add(post);
  });

  const westHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.8, 16), COMMON_MATERIALS.carbonSteel);
  westHeader.position.set(westX, 0.75, 0);
  scene.add(westHeader);

  // Tie-in nozzle pointing East
  const westNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 16), COMMON_MATERIALS.carbonSteel);
  westNozzle.rotation.z = Math.PI / 2;
  westNozzle.position.set(westX + 0.2, 0.75, 0);
  scene.add(westNozzle);

  // Handwheel valve
  const westValveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 16), COMMON_MATERIALS.safetyRed);
  westValveWheel.position.set(westX + 0.1, 1.1, 0);
  scene.add(westValveWheel);

  // East Battery Limit (Product Export Station)
  const eastX = 16.0;
  const eastPad = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 2.4), COMMON_MATERIALS.concreteFoundation);
  eastPad.position.set(eastX, 0.125, 0);
  scene.add(eastPad);

  [-0.6, 0.6].forEach((z) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 12), stationMat);
    post.position.set(eastX, 0.4, z);
    scene.add(post);
  });

  const eastHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.8, 16), COMMON_MATERIALS.carbonSteel);
  eastHeader.position.set(eastX, 0.8, 0);
  scene.add(eastHeader);

  const eastNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 16), COMMON_MATERIALS.carbonSteel);
  eastNozzle.rotation.z = Math.PI / 2;
  eastNozzle.position.set(eastX - 0.2, 0.8, 0);
  scene.add(eastNozzle);

  const eastValveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 16), COMMON_MATERIALS.safetyRed);
  eastValveWheel.position.set(eastX - 0.1, 1.15, 0);
  scene.add(eastValveWheel);

  return {
    westStationPos: new THREE.Vector3(westX + 0.4, 0.75, 0),
    eastStationPos: new THREE.Vector3(eastX - 0.4, 0.8, 0),
  };
}

/**
 * Ground Grid, Paving, Dual-Tier Pipe Racks, and Battery Limit Stations
 */
export function buildGroundAndRacks(scene: THREE.Scene, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
  // Concrete Ground Pavement
  const width = Math.max(90, (bounds.maxX - bounds.minX) * 2.0);
  const depth = Math.max(60, (bounds.maxZ - bounds.minZ) * 2.5);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  const groundGeo = new THREE.PlaneGeometry(width, depth);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.9,
    metalness: 0.1,
  });

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, -0.01, centerZ);
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid Lines
  const gridHelper = new THREE.GridHelper(width, 45, 0x1e293b, 0x0f172a);
  gridHelper.position.set(centerX, 0, centerZ);
  scene.add(gridHelper);

  // Dual-Tier Elevated Structural Steel Pipe Racks
  const rackMat = COMMON_MATERIALS.safetyYellow;
  const steelMat = COMMON_MATERIALS.carbonSteel;
  const rackZ = centerZ;

  const startRackX = Math.min(-20, bounds.minX - 2);
  const endRackX = Math.max(14, bounds.maxX + 2);

  for (let x = startRackX; x <= endRackX; x += 6) {
    // Twin vertical H-column bents (height = 7.4m)
    [-2.2, 2.2].forEach((zOffset) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 7.4, 0.22), rackMat);
      post.position.set(x, 3.7, rackZ + zOffset);
      post.castShadow = true;
      scene.add(post);
    });

    // Lower Tier Cross Beam (Y = 3.2m)
    const lowerBeam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 4.6), rackMat);
    lowerBeam.position.set(x, 3.2, rackZ);
    lowerBeam.castShadow = true;
    scene.add(lowerBeam);

    // Upper Tier Cross Beam (Y = 7.0m)
    const upperBeam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 4.6), rackMat);
    upperBeam.position.set(x, 7.0, rackZ);
    upperBeam.castShadow = true;
    scene.add(upperBeam);
  }

  // Longitudinal stringers connecting the bents
  const stringerLength = endRackX - startRackX + 2;
  const stringerCenterX = (startRackX + endRackX) / 2;

  [-2.2, 2.2].forEach((zOffset) => {
    // Lower tier stringer
    const lowerStringer = new THREE.Mesh(new THREE.BoxGeometry(stringerLength, 0.18, 0.18), steelMat);
    lowerStringer.position.set(stringerCenterX, 3.2, rackZ + zOffset);
    scene.add(lowerStringer);

    // Upper tier stringer
    const upperStringer = new THREE.Mesh(new THREE.BoxGeometry(stringerLength, 0.18, 0.18), steelMat);
    upperStringer.position.set(stringerCenterX, 7.0, rackZ + zOffset);
    scene.add(upperStringer);
  });

  // Battery limit tie-in stations
  buildBatteryLimits(scene);
}
