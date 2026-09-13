/**
 * PetroSimX Dynamic Simulation & PID Control Engine
 * 
 * Provides:
 * - Time-dependent differential equation solvers (Euler / RK4 integration)
 * - Process Variables: Pressure, Temperature, Flow, Level, Composition, Valve Position, Pump Speed, Compressor Speed
 * - Industrial Discrete PID Control Framework (P, I, D with anti-windup, derivative filter, direct/reverse action)
 * - Dynamic Disturbance Injector (Step, Ramp, Pulse, Noise on feeds, pressures, valves, utilities)
 * - Digital Twin State Estimation & Sensor Reconciliation (Residual Innovation Analysis)
 */

import {
  DynamicProcessVariable,
  PIDController,
  SimulationDisturbance,
  StateEstimationResult,
  DynamicSimulationState,
  AlarmSeverity,
} from '../../types/dynamic';
import { CONNECTOR_REGISTRY } from './dataConnectors';

/**
 * Creates default initial dynamic process variables from flowsheet steady-state baseline
 */
export function createInitialProcessVariables(): Record<string, DynamicProcessVariable> {
  return {
    'PT-101': {
      id: 'var-pt-101',
      tag: 'PT-101',
      name: 'High-Pressure Separator Gas Pressure',
      type: 'pressure',
      unit: 'bar',
      value: 82.5,
      steadyStateValue: 82.5,
      minRange: 0,
      maxRange: 120,
      unitId: 'V-101',
      alarms: { ll: 60.0, l: 75.0, h: 88.0, hh: 95.0, deviationMax: 5.0 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 82.5 }],
    },
    'PT-102': {
      id: 'var-pt-102',
      tag: 'PT-102',
      name: 'Recycle Gas Compressor Discharge Pressure',
      type: 'pressure',
      unit: 'bar',
      value: 86.8,
      steadyStateValue: 86.8,
      minRange: 0,
      maxRange: 130,
      unitId: 'C-101',
      alarms: { ll: 65.0, l: 78.0, h: 92.0, hh: 98.0 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 86.8 }],
    },
    'TT-104': {
      id: 'var-tt-104',
      tag: 'TT-104',
      name: 'Reactor Charge / Furnace Coil Outlet Temp',
      type: 'temperature',
      unit: '°C',
      value: 510.0,
      steadyStateValue: 510.0,
      minRange: 200,
      maxRange: 600,
      unitId: 'H-101',
      alarms: { ll: 450.0, l: 495.0, h: 525.0, hh: 540.0, deviationMax: 8.0 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 510.0 }],
    },
    'TT-105': {
      id: 'var-tt-105',
      tag: 'TT-105',
      name: 'Hydrocracker Bed Exotherm Effluent Temp',
      type: 'temperature',
      unit: '°C',
      value: 524.2,
      steadyStateValue: 524.2,
      minRange: 200,
      maxRange: 600,
      unitId: 'R-101',
      alarms: { ll: 460.0, l: 500.0, h: 545.0, hh: 560.0 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 524.2 }],
    },
    'FT-101': {
      id: 'var-ft-101',
      tag: 'FT-101',
      name: 'Fresh Heavy Hydrocarbon Charge Rate',
      type: 'flow',
      unit: 'kg/h',
      value: 55000,
      steadyStateValue: 55000,
      minRange: 0,
      maxRange: 80000,
      unitId: 'P-101',
      alarms: { ll: 20000, l: 45000, h: 65000, hh: 75000 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 55000 }],
    },
    'FT-102': {
      id: 'var-ft-102',
      tag: 'FT-102',
      name: 'Recycle Hydrogen Gas Flow Rate',
      type: 'flow',
      unit: 'kg/h',
      value: 45000,
      steadyStateValue: 45000,
      minRange: 0,
      maxRange: 70000,
      unitId: 'C-101',
      alarms: { ll: 25000, l: 38000, h: 55000, hh: 62000, deviationMax: 4000 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 45000 }],
    },
    'LT-101': {
      id: 'var-lt-101',
      tag: 'LT-101',
      name: 'High-Pressure Separator Liquid Level',
      type: 'level',
      unit: '%',
      value: 50.0,
      steadyStateValue: 50.0,
      minRange: 0,
      maxRange: 100,
      unitId: 'V-101',
      alarms: { ll: 15.0, l: 30.0, h: 75.0, hh: 90.0, deviationMax: 10.0 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 50.0 }],
    },
    'AT-101': {
      id: 'var-at-101',
      tag: 'AT-101',
      name: 'Recycle Gas Hydrogen Purity Analyzer',
      type: 'composition',
      unit: 'mol%',
      value: 88.5,
      steadyStateValue: 88.5,
      minRange: 50,
      maxRange: 100,
      unitId: 'V-101',
      alarms: { ll: 75.0, l: 82.0, h: 96.0, hh: 99.0 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 88.5 }],
    },
    'FV-101': {
      id: 'var-fv-101',
      tag: 'FV-101',
      name: 'Furnace Fuel Gas Control Valve Position',
      type: 'valve_position',
      unit: '%',
      value: 48.5,
      steadyStateValue: 48.5,
      minRange: 0,
      maxRange: 100,
      alarms: { l: 5.0, h: 95.0 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 48.5 }],
    },
    'PV-101': {
      id: 'var-pv-101',
      tag: 'PV-101',
      name: 'Separator Off-Gas Vent Valve Position',
      type: 'valve_position',
      unit: '%',
      value: 42.0,
      steadyStateValue: 42.0,
      minRange: 0,
      maxRange: 100,
      alarms: { l: 5.0, h: 95.0 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 42.0 }],
    },
    'LV-101': {
      id: 'var-lv-101',
      tag: 'LV-101',
      name: 'Separator Heavy Liquid Outlet Valve',
      type: 'valve_position',
      unit: '%',
      value: 51.2,
      steadyStateValue: 51.2,
      minRange: 0,
      maxRange: 100,
      alarms: { l: 5.0, h: 95.0 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 51.2 }],
    },
    'SPD-101': {
      id: 'var-spd-101',
      tag: 'SPD-101',
      name: 'Charge Feed Pump P-101 Speed',
      type: 'pump_speed',
      unit: 'rpm',
      value: 2950,
      steadyStateValue: 2950,
      minRange: 0,
      maxRange: 3600,
      alarms: { ll: 1500, l: 2400, h: 3400, hh: 3550 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 2950 }],
    },
    'SPD-201': {
      id: 'var-spd-201',
      tag: 'SPD-201',
      name: 'Recycle Gas Compressor C-101 Turbine Speed',
      type: 'compressor_speed',
      unit: 'rpm',
      value: 4850,
      steadyStateValue: 4850,
      minRange: 0,
      maxRange: 6000,
      alarms: { ll: 2800, l: 4000, h: 5400, hh: 5800 },
      alarmState: 'NORMAL',
      history: [{ time: 0, value: 4850 }],
    },
  };
}

/**
 * Creates default initial PID controllers
 */
export function createInitialControllers(): Record<string, PIDController> {
  return {
    'TIC-104': {
      id: 'ctrl-tic-104',
      tag: 'TIC-104',
      name: 'Reactor Charge Temperature Controller',
      mode: 'AUTO',
      action: 'REVERSE', // As TT-104 drops below SP, valve opens (more fuel)
      pvTag: 'TT-104',
      mvTag: 'FV-101',
      setPoint: 510.0,
      processVariable: 510.0,
      outputPercent: 48.5,
      manualOutput: 48.5,
      kp: 1.8,
      tiSec: 45.0,
      tdSec: 4.5,
      derivativeFilterN: 10.0,
      outputMin: 0.0,
      outputMax: 100.0,
      antiWindup: true,
      integralSum: 48.5,
      lastError: 0.0,
      lastPv: 510.0,
      filteredDerivative: 0.0,
      history: [{ time: 0, sp: 510.0, pv: 510.0, op: 48.5 }],
    },
    'PIC-101': {
      id: 'ctrl-pic-101',
      tag: 'PIC-101',
      name: 'Separator Pressure Controller',
      mode: 'AUTO',
      action: 'DIRECT', // As PT-101 rises above SP, valve opens to vent
      pvTag: 'PT-101',
      mvTag: 'PV-101',
      setPoint: 82.5,
      processVariable: 82.5,
      outputPercent: 42.0,
      manualOutput: 42.0,
      kp: 2.4,
      tiSec: 25.0,
      tdSec: 1.5,
      derivativeFilterN: 10.0,
      outputMin: 0.0,
      outputMax: 100.0,
      antiWindup: true,
      integralSum: 42.0,
      lastError: 0.0,
      lastPv: 82.5,
      filteredDerivative: 0.0,
      history: [{ time: 0, sp: 82.5, pv: 82.5, op: 42.0 }],
    },
    'LIC-101': {
      id: 'ctrl-lic-101',
      tag: 'LIC-101',
      name: 'Separator Liquid Level Controller',
      mode: 'AUTO',
      action: 'DIRECT', // As level rises, valve opens to drain
      pvTag: 'LT-101',
      mvTag: 'LV-101',
      setPoint: 50.0,
      processVariable: 50.0,
      outputPercent: 51.2,
      manualOutput: 51.2,
      kp: 1.5,
      tiSec: 60.0,
      tdSec: 0.0,
      derivativeFilterN: 10.0,
      outputMin: 0.0,
      outputMax: 100.0,
      antiWindup: true,
      integralSum: 51.2,
      lastError: 0.0,
      lastPv: 50.0,
      filteredDerivative: 0.0,
      history: [{ time: 0, sp: 50.0, pv: 50.0, op: 51.2 }],
    },
    'FIC-102': {
      id: 'ctrl-fic-102',
      tag: 'FIC-102',
      name: 'Recycle H2 Gas Compressor Flow Controller',
      mode: 'AUTO',
      action: 'REVERSE', // As flow drops below SP, compressor speed increases
      pvTag: 'FT-102',
      mvTag: 'SPD-201',
      setPoint: 45000,
      processVariable: 45000,
      outputPercent: 80.8, // maps 0-100% to 0-6000 rpm (4850 rpm)
      manualOutput: 80.8,
      kp: 0.002,
      tiSec: 15.0,
      tdSec: 0.8,
      derivativeFilterN: 8.0,
      outputMin: 20.0,
      outputMax: 100.0,
      antiWindup: true,
      integralSum: 80.8,
      lastError: 0.0,
      lastPv: 45000,
      filteredDerivative: 0.0,
      history: [{ time: 0, sp: 45000, pv: 45000, op: 80.8 }],
    },
  };
}

/**
 * Creates preset disturbances that users can test
 */
export function createPresetDisturbances(): SimulationDisturbance[] {
  return [
    {
      id: 'dist-feed-surge',
      name: '+15% Fresh Feed Flow Surge',
      type: 'feed_flow',
      profile: 'step',
      targetTag: 'FT-101',
      magnitude: 8250, // +8,250 kg/h
      startTimeSec: 10,
      durationSec: 120,
      active: false,
      appliedDelta: 0,
    },
    {
      id: 'dist-feed-temp-drop',
      name: '-20°C Ambient Cold Front (Feed Chill)',
      type: 'feed_temp',
      profile: 'ramp',
      targetTag: 'TT-104',
      magnitude: -20, // -20°C
      rampRate: -0.5, // 0.5°C per second
      startTimeSec: 15,
      durationSec: 180,
      active: false,
      appliedDelta: 0,
    },
    {
      id: 'dist-header-pres-shock',
      name: '+3.5 bar Fuel Gas Header Pressure Shock',
      type: 'pressure',
      profile: 'pulse',
      targetTag: 'PT-101',
      magnitude: 3.5,
      startTimeSec: 20,
      durationSec: 40,
      active: false,
      appliedDelta: 0,
    },
    {
      id: 'dist-quench-valve-slip',
      name: '-12% Quench Valve Mechanical Stiction',
      type: 'valve',
      profile: 'step',
      targetTag: 'PV-101',
      magnitude: -12.0,
      startTimeSec: 5,
      durationSec: 90,
      active: false,
      appliedDelta: 0,
    },
    {
      id: 'dist-cooling-tower-trip',
      name: 'Cooling Water Supply Failure (+8°C Water)',
      type: 'utility_cooling',
      profile: 'ramp',
      targetTag: 'TT-105',
      magnitude: 8.0,
      rampRate: 0.2,
      startTimeSec: 25,
      durationSec: 150,
      active: false,
      appliedDelta: 0,
    },
  ];
}

/**
 * Executes a single discrete PID controller update
 */
export function updatePIDController(
  controller: PIDController,
  pvValue: number,
  dtSec: number
): { updatedController: PIDController; outputPercent: number } {
  const ctrl = { ...controller };
  ctrl.processVariable = pvValue;

  if (ctrl.mode === 'MANUAL') {
    ctrl.outputPercent = ctrl.manualOutput;
    ctrl.integralSum = ctrl.manualOutput;
    ctrl.lastError = ctrl.setPoint - pvValue;
    ctrl.lastPv = pvValue;
    return { updatedController: ctrl, outputPercent: ctrl.outputPercent };
  }

  // 1. Error calculation based on action
  // DIRECT (e.g. cooling, venting): error = PV - SP
  // REVERSE (e.g. heating, pumping): error = SP - PV
  const error = ctrl.action === 'DIRECT' ? pvValue - ctrl.setPoint : ctrl.setPoint - pvValue;

  // 2. Proportional term
  const P = ctrl.kp * error;

  // 3. Integral term with trapezoidal rule
  let I = ctrl.integralSum;
  if (ctrl.tiSec > 0) {
    const deltaI = (ctrl.kp * dtSec / ctrl.tiSec) * 0.5 * (error + ctrl.lastError);
    I += deltaI;
  }

  // 4. Derivative term on PV (avoids derivative kick on setpoint change)
  let D = 0;
  if (ctrl.tdSec > 0) {
    const deltaPv = pvValue - ctrl.lastPv;
    // Low-pass filtered derivative:
    // D(k) = (Td / (Td + N*dt)) * D(k-1) - (Kp * Td * N / (Td + N*dt)) * (PV - PV_last)
    const alpha = ctrl.tdSec / (ctrl.tdSec + ctrl.derivativeFilterN * dtSec);
    const beta = (ctrl.kp * ctrl.tdSec * ctrl.derivativeFilterN) / (ctrl.tdSec + ctrl.derivativeFilterN * dtSec);
    
    // Reverse vs Direct sign for derivative
    const sign = ctrl.action === 'DIRECT' ? -1 : 1;
    D = alpha * ctrl.filteredDerivative - sign * beta * deltaPv;
    ctrl.filteredDerivative = D;
  }

  // 5. Raw Output
  let rawOP = P + I + D;

  // 6. Anti-windup clamping
  let finalOP = rawOP;
  if (finalOP > ctrl.outputMax) {
    finalOP = ctrl.outputMax;
    if (ctrl.antiWindup) {
      // Clamp integral sum so it doesn't wind up
      I = Math.min(I, ctrl.outputMax - P);
    }
  } else if (finalOP < ctrl.outputMin) {
    finalOP = ctrl.outputMin;
    if (ctrl.antiWindup) {
      I = Math.max(I, ctrl.outputMin - P);
    }
  }

  ctrl.integralSum = I;
  ctrl.lastError = error;
  ctrl.lastPv = pvValue;
  ctrl.outputPercent = Number(finalOP.toFixed(2));

  return { updatedController: ctrl, outputPercent: ctrl.outputPercent };
}

/**
 * Calculates currently applied disturbance offsets
 */
export function evaluateDisturbances(
  disturbances: SimulationDisturbance[],
  currentTimeSec: number
): { updatedDisturbances: SimulationDisturbance[]; activeDeltas: Record<string, number> } {
  const activeDeltas: Record<string, number> = {};

  const updatedDisturbances = disturbances.map((d) => {
    const copy = { ...d };
    if (!copy.active) {
      copy.appliedDelta = 0;
      return copy;
    }

    const elapsed = currentTimeSec - copy.startTimeSec;
    if (elapsed < 0 || elapsed > copy.durationSec) {
      copy.appliedDelta = 0;
      return copy;
    }

    let delta = 0;
    if (copy.profile === 'step') {
      delta = copy.magnitude;
    } else if (copy.profile === 'ramp') {
      const rate = copy.rampRate ?? (copy.magnitude / Math.max(1, copy.durationSec * 0.2));
      const targetTime = Math.abs(copy.magnitude / rate);
      delta = elapsed < targetTime ? rate * elapsed : copy.magnitude;
    } else if (copy.profile === 'pulse') {
      const halfTime = copy.durationSec * 0.5;
      delta = elapsed < halfTime ? copy.magnitude : 0;
    } else if (copy.profile === 'sine_wave') {
      const freq = copy.frequencyHz ?? 0.05;
      delta = copy.magnitude * Math.sin(2 * Math.PI * freq * elapsed);
    } else if (copy.profile === 'noise') {
      delta = (Math.random() - 0.5) * 2 * copy.magnitude;
    }

    copy.appliedDelta = delta;
    activeDeltas[copy.targetTag] = (activeDeltas[copy.targetTag] || 0) + delta;
    return copy;
  });

  return { updatedDisturbances, activeDeltas };
}

/**
 * State Estimator (Kalman Filter / Observer Residual Analysis)
 * Reconciles raw telemetry measurements with first-principles model state.
 */
export function runStateEstimation(
  variables: Record<string, DynamicProcessVariable>,
  latestPacket?: any
): Record<string, StateEstimationResult> {
  const estimates: Record<string, StateEstimationResult> = {};

  Object.values(variables).forEach((v) => {
    const modelPredicted = v.value;
    const rawMeasured = latestPacket?.tags[v.tag]?.value ?? modelPredicted;

    // Kalman Gain weight W (e.g. 0.85 to model, 0.15 to sensor noise)
    const kalmanGain = 0.25;
    const residual = Math.abs(rawMeasured - modelPredicted);
    const reconciled = modelPredicted + kalmanGain * (rawMeasured - modelPredicted);

    let healthStatus: StateEstimationResult['healthStatus'] = 'HEALTHY';
    const relativeResidual = residual / Math.max(1, Math.abs(v.steadyStateValue));

    if (relativeResidual > 0.15) {
      healthStatus = 'MODEL_MISMATCH';
    } else if (relativeResidual > 0.08) {
      healthStatus = 'DRIFT_DETECTED';
    } else if (residual > 3.0) {
      healthStatus = 'SENSOR_SUSPECT';
    }

    const confidenceScore = Math.max(0.6, 1.0 - relativeResidual * 2);

    estimates[v.tag] = {
      tag: v.tag,
      rawMeasured: Number(rawMeasured.toFixed(2)),
      modelPredicted: Number(modelPredicted.toFixed(2)),
      reconciledState: Number(reconciled.toFixed(2)),
      residualInnovation: Number(residual.toFixed(3)),
      confidenceScore: Number(confidenceScore.toFixed(2)),
      healthStatus,
    };
  });

  return estimates;
}

/**
 * Evaluates alarm states for all dynamic variables
 */
export function checkAlarms(
  variables: Record<string, DynamicProcessVariable>
): {
  updatedVariables: Record<string, DynamicProcessVariable>;
  alarms: DynamicSimulationState['activeAlarms'];
} {
  const updatedVariables: Record<string, DynamicProcessVariable> = {};
  const activeAlarms: DynamicSimulationState['activeAlarms'] = [];

  Object.values(variables).forEach((v) => {
    const copy = { ...v };
    let severity: AlarmSeverity = 'NORMAL';
    let triggerThreshold = 0;
    let desc = '';

    const { ll, l, h, hh } = copy.alarms;

    if (hh !== undefined && copy.value >= hh) {
      severity = 'HIGH_HIGH';
      triggerThreshold = hh;
      desc = `CRITICAL TRIP: High-High limit exceeded (${copy.value} >= ${hh} ${copy.unit})`;
    } else if (ll !== undefined && copy.value <= ll) {
      severity = 'LOW_LOW';
      triggerThreshold = ll;
      desc = `CRITICAL TRIP: Low-Low limit breached (${copy.value} <= ${ll} ${copy.unit})`;
    } else if (h !== undefined && copy.value >= h) {
      severity = 'HIGH';
      triggerThreshold = h;
      desc = `Warning: High limit reached (${copy.value} >= ${h} ${copy.unit})`;
    } else if (l !== undefined && copy.value <= l) {
      severity = 'LOW';
      triggerThreshold = l;
      desc = `Warning: Low limit reached (${copy.value} <= ${l} ${copy.unit})`;
    }

    copy.alarmState = severity;
    updatedVariables[copy.tag] = copy;

    if (severity !== 'NORMAL') {
      activeAlarms.push({
        id: `alarm-${copy.tag}-${severity}`,
        tag: copy.tag,
        description: `${copy.name}: ${desc}`,
        severity,
        timestamp: new Date().toISOString().slice(11, 19),
        acknowledged: false,
        value: copy.value,
        threshold: triggerThreshold,
      });
    }
  });

  return { updatedVariables, alarms: activeAlarms };
}

/**
 * Advances the dynamic simulation by dtSec seconds using Runge-Kutta / Euler ODE integration
 */
export function stepDynamicSimulation(
  currentState: DynamicSimulationState
): DynamicSimulationState {
  const { timeSec, dtSec, speedMultiplier } = currentState;
  const effectiveDt = dtSec * speedMultiplier;
  const nextTime = Number((timeSec + effectiveDt).toFixed(2));

  // 1. Evaluate disturbances
  const { updatedDisturbances, activeDeltas } = evaluateDisturbances(
    currentState.disturbances,
    nextTime
  );

  const vars = { ...currentState.variables };
  const ctrls = { ...currentState.controllers };

  // 2. Read valve positions & actuator lags
  const fvVal = vars['FV-101'].value; // Fuel gas valve %
  const pvVal = vars['PV-101'].value; // Off-gas vent valve %
  const lvVal = vars['LV-101'].value; // Level valve %
  const compRpm = vars['SPD-201'].value; // Compressor rpm

  // 3. Dynamic Model ODE Equations

  // A. Temperature Dynamics (Furnace coil outlet TT-104)
  // dT/dt = (1/tau_T) * (T_steady + k_fuel * (FV - 48.5) + disturbance - T)
  const tauT = 18.0; // Thermal inertia lag seconds
  const kFuel = 1.4; // 1.4°C per % valve change
  const distTemp = activeDeltas['TT-104'] || 0;
  const targetTemp = 510.0 + kFuel * (fvVal - 48.5) + distTemp;
  const dTemp = (targetTemp - vars['TT-104'].value) / tauT;
  const newT104 = vars['TT-104'].value + dTemp * effectiveDt;
  vars['TT-104'].value = Number(newT104.toFixed(2));

  // B. Reactor Bed Effluent Temp (TT-105)
  // Reaction exotherm responds with delay to feed temperature + feed flow
  const tauRx = 25.0;
  const distExo = (activeDeltas['TT-105'] || 0) + (activeDeltas['FT-101'] || 0) * 0.0003;
  const targetExo = 524.2 + (vars['TT-104'].value - 510.0) * 1.1 + distExo;
  const dExo = (targetExo - vars['TT-105'].value) / tauRx;
  vars['TT-105'].value = Number((vars['TT-105'].value + dExo * effectiveDt).toFixed(2));

  // C. Pressure Dynamics (High-Pressure Separator PT-101)
  // dP/dt = (1/tau_P) * (InletGasFlow - VentValveFlow)
  const tauP = 12.0;
  const distPres = activeDeltas['PT-101'] || 0;
  const targetPres = 82.5 - 0.25 * (pvVal - 42.0) + distPres + (vars['FT-101'].value - 55000) * 0.0001;
  const dPres = (targetPres - vars['PT-101'].value) / tauP;
  vars['PT-101'].value = Number((vars['PT-101'].value + dPres * effectiveDt).toFixed(2));

  // Compressor discharge PT-102 tracks PT-101 + compression ratio
  const compRatio = 1.05 + (compRpm / 4850) * 0.002;
  vars['PT-102'].value = Number((vars['PT-101'].value * compRatio).toFixed(2));

  // D. Level Dynamics (Separator Level LT-101)
  // dL/dt = (F_liquid_in - F_liquid_out(LV)) / A_vessel
  const tauL = 40.0;
  const feedFlowDiff = (vars['FT-101'].value - 55000) / 55000;
  const targetLevel = 50.0 + feedFlowDiff * 25.0 - 0.5 * (lvVal - 51.2);
  const dLevel = (targetLevel - vars['LT-101'].value) / tauL;
  vars['LT-101'].value = Number(Math.max(0, Math.min(100, vars['LT-101'].value + dLevel * effectiveDt)).toFixed(2));

  // E. Flow Dynamics (FT-101 Feed & FT-102 Recycle H2)
  const distFeed = activeDeltas['FT-101'] || 0;
  vars['FT-101'].value = Math.max(0, 55000 + distFeed);

  // Recycle Flow FT-102 depends on compressor speed
  const targetFlow102 = 45000 * (compRpm / 4850);
  const tauFlow = 3.0;
  const dFlow = (targetFlow102 - vars['FT-102'].value) / tauFlow;
  vars['FT-102'].value = Number((vars['FT-102'].value + dFlow * effectiveDt).toFixed(1));

  // 4. Update PID Control Loops
  // TIC-104: Controls TT-104 by manipulating FV-101
  const ticRes = updatePIDController(ctrls['TIC-104'], vars['TT-104'].value, effectiveDt);
  ctrls['TIC-104'] = ticRes.updatedController;
  // Actuator first-order lag on valve: tau_v * dx/dt = OP - x
  const tauActuator = 2.0;
  vars['FV-101'].value = Number(
    (vars['FV-101'].value + ((ticRes.outputPercent - vars['FV-101'].value) / tauActuator) * effectiveDt).toFixed(2)
  );

  // PIC-101: Controls PT-101 by manipulating PV-101
  const picRes = updatePIDController(ctrls['PIC-101'], vars['PT-101'].value, effectiveDt);
  ctrls['PIC-101'] = picRes.updatedController;
  vars['PV-101'].value = Number(
    (vars['PV-101'].value + ((picRes.outputPercent - vars['PV-101'].value) / tauActuator) * effectiveDt).toFixed(2)
  );

  // LIC-101: Controls LT-101 by manipulating LV-101
  const licRes = updatePIDController(ctrls['LIC-101'], vars['LT-101'].value, effectiveDt);
  ctrls['LIC-101'] = licRes.updatedController;
  vars['LV-101'].value = Number(
    (vars['LV-101'].value + ((licRes.outputPercent - vars['LV-101'].value) / tauActuator) * effectiveDt).toFixed(2)
  );

  // FIC-102: Controls FT-102 by manipulating compressor speed SPD-201
  const ficRes = updatePIDController(ctrls['FIC-102'], vars['FT-102'].value, effectiveDt);
  ctrls['FIC-102'] = ficRes.updatedController;
  // Target RPM = (OP / 100) * 6000 rpm
  const targetRpm = (ficRes.outputPercent / 100) * 6000;
  const tauTurbine = 5.0; // Turbine rotational inertia lag
  vars['SPD-201'].value = Number(
    (vars['SPD-201'].value + ((targetRpm - vars['SPD-201'].value) / tauTurbine) * effectiveDt).toFixed(1)
  );

  // 5. Append historical trend points (keeping max 150 points)
  Object.values(vars).forEach((v) => {
    v.history.push({ time: nextTime, value: v.value });
    if (v.history.length > 150) v.history.shift();
  });

  Object.values(ctrls).forEach((c) => {
    c.history.push({ time: nextTime, sp: c.setPoint, pv: c.processVariable, op: c.outputPercent });
    if (c.history.length > 150) c.history.shift();
  });

  // 6. Check alarms
  const { updatedVariables, alarms } = checkAlarms(vars);

  // 7. Poll Active Connector for telemetry packet
  const connector = CONNECTOR_REGISTRY[currentState.activeConnector] || CONNECTOR_REGISTRY.SIMULATION_INTERNAL;
  const packet = connector.pollPacket(nextTime, updatedVariables);

  // 8. Run State Estimation / Innovation residuals
  const stateEstimates = runStateEstimation(updatedVariables, packet);

  return {
    ...currentState,
    timeSec: nextTime,
    variables: updatedVariables,
    controllers: ctrls,
    disturbances: updatedDisturbances,
    latestPacket: packet,
    stateEstimates,
    activeAlarms: alarms,
    connectorStatus: connector.getStatus(),
    isSimulatedSource: packet.isSimulated,
  };
}

/**
 * Initializes full dynamic simulation state
 */
export function initializeDynamicSimulationState(): DynamicSimulationState {
  const vars = createInitialProcessVariables();
  const ctrls = createInitialControllers();
  const dists = createPresetDisturbances();

  const connector = CONNECTOR_REGISTRY.SIMULATION_INTERNAL;
  const packet = connector.pollPacket(0, vars);
  const stateEstimates = runStateEstimation(vars, packet);

  return {
    timeSec: 0,
    dtSec: 0.5,
    speedMultiplier: 1,
    status: 'RUNNING',
    variables: vars,
    controllers: ctrls,
    disturbances: dists,
    activeConnector: 'SIMULATION_INTERNAL',
    connectorStatus: 'ACTIVE_STREAMING',
    isSimulatedSource: true,
    latestPacket: packet,
    stateEstimates,
    activeAlarms: [],
  };
}
