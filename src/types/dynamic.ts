/**
 * Dynamic Simulation & Digital Twin Type Definitions
 * Supporting time-dependent ODE modeling, PID loops, disturbance injections,
 * and data connector abstraction layers (OPC UA, MQTT, REST, WebSocket, CSV).
 */

export type ProcessVariableType =
  | 'pressure'
  | 'temperature'
  | 'flow'
  | 'level'
  | 'composition'
  | 'valve_position'
  | 'pump_speed'
  | 'compressor_speed';

export type AlarmSeverity = 'NORMAL' | 'LOW_LOW' | 'LOW' | 'HIGH' | 'HIGH_HIGH' | 'DEVIATION';

export interface AlarmThresholds {
  ll?: number; // Low-Low (Trip)
  l?: number;  // Low (Warning)
  h?: number;  // High (Warning)
  hh?: number; // High-High (Trip)
  deviationMax?: number; // Max allowable |SP - PV|
}

export interface DynamicProcessVariable {
  id: string;
  tag: string;             // e.g. 'PT-101', 'TT-104', 'LT-101', 'FT-102', 'FV-101'
  name: string;            // Descriptive name
  type: ProcessVariableType;
  unit: string;            // 'bar', '°C', 'kg/h', '%', 'rpm'
  value: number;           // Current dynamic value
  steadyStateValue: number;// Baseline steady-state reference
  minRange: number;        // Transmitter scale min
  maxRange: number;        // Transmitter scale max
  unitId?: string;         // Associated equipment ID
  streamId?: string;       // Associated stream ID
  alarms: AlarmThresholds;
  alarmState: AlarmSeverity;
  history: Array<{ time: number; value: number }>;
}

export type ControllerMode = 'AUTO' | 'MANUAL' | 'CASCADE';
export type ControllerAction = 'DIRECT' | 'REVERSE'; // Direct: PV > SP -> OP increases (e.g. cooling); Reverse: PV < SP -> OP increases (e.g. heating)

export interface PIDController {
  id: string;
  tag: string;             // e.g. 'TIC-104', 'PIC-101', 'LIC-101', 'SIC-201'
  name: string;
  mode: ControllerMode;
  action: ControllerAction;
  
  // Linkages
  pvTag: string;           // Process variable tag
  mvTag: string;           // Manipulated variable tag (valve or speed)
  
  // Process values
  setPoint: number;        // Target setpoint in PV units
  processVariable: number; // Current measured PV
  outputPercent: number;   // Current OP (0.0 to 100.0%)
  manualOutput: number;    // Manual OP when mode === 'MANUAL'
  
  // Tuning parameters
  kp: number;              // Proportional gain (or 100/PB)
  tiSec: number;           // Integral reset time (seconds)
  tdSec: number;           // Derivative rate time (seconds)
  derivativeFilterN: number; // Low-pass filter on derivative (typically 8-12)
  
  // Output limits & Anti-windup
  outputMin: number;       // e.g. 0.0%
  outputMax: number;       // e.g. 100.0%
  antiWindup: boolean;
  
  // Internal controller states
  integralSum: number;
  lastError: number;
  lastPv: number;
  filteredDerivative: number;
  
  // Historical trend
  history: Array<{ time: number; sp: number; pv: number; op: number }>;
}

export type DisturbanceType =
  | 'feed_flow'
  | 'feed_temp'
  | 'pressure'
  | 'valve'
  | 'utility_cooling'
  | 'utility_steam';

export type DisturbanceProfile =
  | 'step'
  | 'ramp'
  | 'pulse'
  | 'sine_wave'
  | 'noise';

export interface SimulationDisturbance {
  id: string;
  name: string;
  type: DisturbanceType;
  profile: DisturbanceProfile;
  targetTag: string;       // The PV or process state affected
  magnitude: number;       // Step change (+/- delta) or amplitude
  startTimeSec: number;    // Activation simulation time (s)
  durationSec: number;     // Active duration (s)
  rampRate?: number;       // For ramp profile: rate per second
  frequencyHz?: number;    // For sine wave: Hz
  active: boolean;         // Currently toggled active
  appliedDelta: number;    // Currently applied disturbance offset
}

export type ConnectorProtocol =
  | 'SIMULATION_INTERNAL'
  | 'CSV_HISTORIAN_REPLAY'
  | 'WEBSOCKET_CLIENT'
  | 'OPC_UA'
  | 'MQTT'
  | 'REST_API'
  | 'HISTORIAN_SQL';

export type ConnectorStatus =
  | 'ACTIVE_STREAMING'
  | 'PAUSED'
  | 'DISCONNECTED'
  | 'REPLAYING'
  | 'STANDBY_CONFIGURED'
  | 'COMMUNICATION_ERROR';

export interface TagQuality {
  value: number;
  quality: 'GOOD' | 'UNCERTAIN' | 'BAD';
  timestamp: string;
  source: 'SIMULATED' | 'REPLAY' | 'PHYSICAL_CONNECTOR';
}

export interface TelemetryPacket {
  packetId: number;
  timestamp: string;       // ISO 8601
  simulationTimeSec: number;
  protocol: ConnectorProtocol;
  isSimulated: boolean;    // Always true for browser simulation/mock
  connectorName: string;
  tags: Record<string, TagQuality>;
}

export interface StateEstimationResult {
  tag: string;
  rawMeasured: number;     // From telemetry
  modelPredicted: number;  // From first-principles ODE simulation
  reconciledState: number; // Kalman-filtered estimate
  residualInnovation: number; // |measured - predicted|
  confidenceScore: number; // 0.0 to 1.0
  healthStatus: 'HEALTHY' | 'DRIFT_DETECTED' | 'SENSOR_SUSPECT' | 'MODEL_MISMATCH';
}

export interface DynamicSimulationState {
  timeSec: number;
  dtSec: number;           // Integration step size (e.g. 0.2s to 1.0s)
  speedMultiplier: number; // 1x, 2x, 5x, 10x
  status: 'RUNNING' | 'PAUSED' | 'STEPPING' | 'RESET';
  
  variables: Record<string, DynamicProcessVariable>;
  controllers: Record<string, PIDController>;
  disturbances: SimulationDisturbance[];
  
  // Data connector
  activeConnector: ConnectorProtocol;
  connectorStatus: ConnectorStatus;
  isSimulatedSource: boolean;
  
  // Telemetry buffer & State estimation
  latestPacket?: TelemetryPacket;
  stateEstimates: Record<string, StateEstimationResult>;
  
  // Alarms
  activeAlarms: Array<{
    id: string;
    tag: string;
    description: string;
    severity: AlarmSeverity;
    timestamp: string;
    acknowledged: boolean;
    value: number;
    threshold: number;
  }>;
}
