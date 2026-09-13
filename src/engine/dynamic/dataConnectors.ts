/**
 * Industrial Digital Twin Data Connector Abstraction Layer
 * 
 * Implements clean interfaces for:
 * - Internal Simulation Engine [SIMULATED]
 * - CSV Historian Plant Replay [REPLAY]
 * - Mock WebSocket Client [MOCK_STREAM]
 * - OPC UA Client Architecture (opc.tcp://...)
 * - MQTT IoT Broker Architecture (mqtt://...)
 * - Industrial REST API Poller
 * - Plant Information (PI) / Historian Database Interface
 * 
 * STRICT COMPLIANCE RULE:
 * All browser-simulated telemetry is explicitly flagged with `isSimulated: true`
 * and labeled as SIMULATION data.
 */

import {
  ConnectorProtocol,
  ConnectorStatus,
  DynamicProcessVariable,
  TelemetryPacket,
  TagQuality,
} from '../../types/dynamic';

export interface ConnectorConfig {
  id: string;
  name: string;
  protocol: ConnectorProtocol;
  endpointUrl: string;
  samplingIntervalMs: number;
  securityMode?: 'None' | 'SignAndEncrypt_Basic256Sha256' | 'Token_Auth' | 'TLS';
  nodeMappings: Record<string, string>; // Tag -> OPC NodeId / MQTT Topic
  isSimulated: boolean;
  status: ConnectorStatus;
}

export interface IDataConnector {
  protocol: ConnectorProtocol;
  status: ConnectorStatus;
  config: ConnectorConfig;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  pollPacket(
    simulationTimeSec: number,
    variables: Record<string, DynamicProcessVariable>
  ): TelemetryPacket;
  getStatus(): ConnectorStatus;
}

/**
 * 1. Internal Dynamic Model Connector
 * Directly bridges the browser ODE solver to the Digital Twin SCADA layer.
 */
export class SimulationInternalConnector implements IDataConnector {
  protocol: ConnectorProtocol = 'SIMULATION_INTERNAL';
  status: ConnectorStatus = 'ACTIVE_STREAMING';
  config: ConnectorConfig;
  private packetCounter = 0;

  constructor() {
    this.config = {
      id: 'conn-internal-sim',
      name: 'PetroSimX Dynamic ODE Solver [SIMULATED]',
      protocol: 'SIMULATION_INTERNAL',
      endpointUrl: 'internal://in-memory-engine',
      samplingIntervalMs: 250,
      isSimulated: true,
      status: 'ACTIVE_STREAMING',
      nodeMappings: {
        'PT-101': 'SimEngine.Reactor.Pressure',
        'TT-104': 'SimEngine.Furnace.OutletTemp',
        'LT-101': 'SimEngine.Separator.LiquidLevel',
        'FT-102': 'SimEngine.Recycle.FlowRate',
        'FV-101': 'SimEngine.Actuator.FuelGasValve',
        'PV-101': 'SimEngine.Actuator.OffGasValve',
        'LV-101': 'SimEngine.Actuator.LevelValve',
        'SPD-201': 'SimEngine.Compressor.RpmSpeed',
      },
    };
  }

  async connect(): Promise<boolean> {
    this.status = 'ACTIVE_STREAMING';
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = 'PAUSED';
  }

  getStatus(): ConnectorStatus {
    return this.status;
  }

  pollPacket(
    simulationTimeSec: number,
    variables: Record<string, DynamicProcessVariable>
  ): TelemetryPacket {
    this.packetCounter++;
    const tags: Record<string, TagQuality> = {};

    Object.values(variables).forEach((v) => {
      // Add a realistic 0.05% measurement noise to simulate industrial instrumentation
      const noise = (Math.random() - 0.5) * 0.001 * v.value;
      const measuredValue = Number((v.value + noise).toFixed(2));

      tags[v.tag] = {
        value: measuredValue,
        quality: 'GOOD',
        timestamp: new Date().toISOString(),
        source: 'SIMULATED',
      };
    });

    return {
      packetId: this.packetCounter,
      timestamp: new Date().toISOString(),
      simulationTimeSec,
      protocol: this.protocol,
      isSimulated: true,
      connectorName: this.config.name,
      tags,
    };
  }
}

/**
 * 2. CSV Historian Replay Connector
 * Plays back recorded plant historian timeseries data with playhead scrubbing.
 */
export class CsvHistorianReplayConnector implements IDataConnector {
  protocol: ConnectorProtocol = 'CSV_HISTORIAN_REPLAY';
  status: ConnectorStatus = 'REPLAYING';
  config: ConnectorConfig;
  private csvRows: Array<{ time: number; [key: string]: number }> = [];
  private packetCounter = 0;

  constructor() {
    this.config = {
      id: 'conn-csv-replay',
      name: 'Plant Historian CSV Playback [SAMPLE ARCHIVE]',
      protocol: 'CSV_HISTORIAN_REPLAY',
      endpointUrl: 'archive://historian_sample_telemetry.csv',
      samplingIntervalMs: 500,
      isSimulated: true,
      status: 'REPLAYING',
      nodeMappings: {
        'PT-101': 'CSV.Col_P_Bar',
        'TT-104': 'CSV.Col_T_C',
        'LT-101': 'CSV.Col_Level_Pct',
        'FT-102': 'CSV.Col_Flow_KgH',
      },
    };

    // Pre-seed sample archive data points (120 seconds of dynamic transient data)
    this.generateSampleArchive();
  }

  private generateSampleArchive() {
    for (let t = 0; t <= 300; t += 0.5) {
      // Plant transient disturbance pattern in sample archive:
      // At t=60, a step disturbance in feed flow occurs
      const stepEffect = t > 60 ? Math.sin((t - 60) * 0.05) * 4 : 0;
      this.csvRows.push({
        time: t,
        'PT-101': 82.5 + Math.sin(t * 0.1) * 0.3 + (t > 60 ? 1.2 : 0),
        'TT-104': 510.0 + Math.cos(t * 0.08) * 1.5 + stepEffect,
        'LT-101': 50.0 + Math.sin(t * 0.04) * 2.0,
        'FT-102': 45000 + (t > 60 ? 4500 : 0) + (Math.random() - 0.5) * 200,
        'FV-101': 48.5 + (t > 60 ? 4.0 : 0),
        'PV-101': 42.0,
        'LV-101': 51.2,
        'SPD-201': 4850 + Math.sin(t * 0.05) * 25,
      });
    }
  }

  async connect(): Promise<boolean> {
    this.status = 'REPLAYING';
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = 'PAUSED';
  }

  getStatus(): ConnectorStatus {
    return this.status;
  }

  loadCsvText(csvText: string): { success: boolean; rowCount: number; message: string } {
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        return { success: false, rowCount: 0, message: 'CSV file contains no data rows.' };
      }

      const headers = lines[0].split(',').map((h) => h.trim());
      const timeIndex = headers.findIndex((h) => h.toLowerCase().includes('time'));
      if (timeIndex === -1) {
        return { success: false, rowCount: 0, message: 'CSV must contain a "time" column.' };
      }

      const newRows: Array<{ time: number; [key: string]: number }> = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length < headers.length) continue;
        const rowObj: { time: number; [key: string]: number } = {
          time: parseFloat(parts[timeIndex]),
        };
        headers.forEach((h, idx) => {
          if (idx !== timeIndex) {
            rowObj[h] = parseFloat(parts[idx]) || 0;
          }
        });
        newRows.push(rowObj);
      }

      this.csvRows = newRows;
      return {
        success: true,
        rowCount: newRows.length,
        message: `Successfully loaded ${newRows.length} historian rows.`,
      };
    } catch (err: any) {
      return { success: false, rowCount: 0, message: `Failed to parse CSV: ${err.message}` };
    }
  }

  pollPacket(
    simulationTimeSec: number,
    variables: Record<string, DynamicProcessVariable>
  ): TelemetryPacket {
    this.packetCounter++;
    const loopedTime = simulationTimeSec % 300;

    // Find nearest row in replay memory
    let nearestRow = this.csvRows[0];
    for (const row of this.csvRows) {
      if (Math.abs(row.time - loopedTime) < Math.abs(nearestRow.time - loopedTime)) {
        nearestRow = row;
      }
    }

    const tags: Record<string, TagQuality> = {};
    Object.values(variables).forEach((v) => {
      const replayVal = nearestRow[v.tag] !== undefined ? nearestRow[v.tag] : v.value;
      tags[v.tag] = {
        value: replayVal,
        quality: 'GOOD',
        timestamp: new Date().toISOString(),
        source: 'REPLAY',
      };
    });

    return {
      packetId: this.packetCounter,
      timestamp: new Date().toISOString(),
      simulationTimeSec,
      protocol: this.protocol,
      isSimulated: true, // Marked explicitly as simulated historical replay
      connectorName: this.config.name,
      tags,
    };
  }
}

/**
 * 3. Mock WebSocket Client Connector
 * Models client-side socket telemetry packets with network ping/pong.
 */
export class MockWebSocketClientConnector implements IDataConnector {
  protocol: ConnectorProtocol = 'WEBSOCKET_CLIENT';
  status: ConnectorStatus = 'ACTIVE_STREAMING';
  config: ConnectorConfig;
  private packetCounter = 0;

  constructor() {
    this.config = {
      id: 'conn-ws-mock',
      name: 'Plant SCADA WebSocket Stream [MOCK]',
      protocol: 'WEBSOCKET_CLIENT',
      endpointUrl: 'wss://scada.refinery-internal.net/v1/telemetry',
      samplingIntervalMs: 200,
      securityMode: 'TLS',
      isSimulated: true,
      status: 'ACTIVE_STREAMING',
      nodeMappings: {
        'PT-101': 'Refinery.Plant01.Area04.PT101',
        'TT-104': 'Refinery.Plant01.Area04.TT104',
        'LT-101': 'Refinery.Plant01.Area04.LT101',
        'FT-102': 'Refinery.Plant01.Area04.FT102',
      },
    };
  }

  async connect(): Promise<boolean> {
    this.status = 'ACTIVE_STREAMING';
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = 'DISCONNECTED';
  }

  getStatus(): ConnectorStatus {
    return this.status;
  }

  pollPacket(
    simulationTimeSec: number,
    variables: Record<string, DynamicProcessVariable>
  ): TelemetryPacket {
    this.packetCounter++;
    const tags: Record<string, TagQuality> = {};

    Object.values(variables).forEach((v) => {
      const jitter = (Math.sin(simulationTimeSec * 2) * 0.002 + (Math.random() - 0.5) * 0.002) * v.value;
      tags[v.tag] = {
        value: Number((v.value + jitter).toFixed(2)),
        quality: 'GOOD',
        timestamp: new Date().toISOString(),
        source: 'SIMULATED',
      };
    });

    return {
      packetId: this.packetCounter,
      timestamp: new Date().toISOString(),
      simulationTimeSec,
      protocol: this.protocol,
      isSimulated: true,
      connectorName: this.config.name,
      tags,
    };
  }
}

/**
 * 4. Industrial OPC UA Adapter (Architecture & Configuration Layer)
 * Implements standard OPC UA client configuration, NodeId namespaces, and security policies.
 * Transparently indicates standby mode until connected through an authenticated gateway.
 */
export class OpcUaConnector implements IDataConnector {
  protocol: ConnectorProtocol = 'OPC_UA';
  status: ConnectorStatus = 'STANDBY_CONFIGURED';
  config: ConnectorConfig;

  constructor() {
    this.config = {
      id: 'conn-opcua-edge',
      name: 'OPC Foundation Unified Architecture (OPC UA)',
      protocol: 'OPC_UA',
      endpointUrl: 'opc.tcp://192.168.10.150:4840/PetroSimX/DCS',
      samplingIntervalMs: 100,
      securityMode: 'SignAndEncrypt_Basic256Sha256',
      isSimulated: true, // Tagged simulation interface
      status: 'STANDBY_CONFIGURED',
      nodeMappings: {
        'PT-101': 'ns=2;s=Hydrocracker.Reactor.InletPressure',
        'TT-104': 'ns=2;s=Hydrocracker.Furnace.CoilOutletTemp',
        'LT-101': 'ns=2;s=Hydrocracker.Separator.VesselLevel',
        'FT-102': 'ns=2;s=Hydrocracker.Recycle.MassFlowRate',
      },
    };
  }

  async connect(): Promise<boolean> {
    // In browser client environment without a local native TCP broker,
    // we establish configured standby status.
    this.status = 'STANDBY_CONFIGURED';
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = 'DISCONNECTED';
  }

  getStatus(): ConnectorStatus {
    return this.status;
  }

  pollPacket(
    simulationTimeSec: number,
    variables: Record<string, DynamicProcessVariable>
  ): TelemetryPacket {
    const tags: Record<string, TagQuality> = {};
    Object.values(variables).forEach((v) => {
      tags[v.tag] = {
        value: v.value,
        quality: 'GOOD',
        timestamp: new Date().toISOString(),
        source: 'SIMULATED',
      };
    });

    return {
      packetId: Math.floor(simulationTimeSec * 10),
      timestamp: new Date().toISOString(),
      simulationTimeSec,
      protocol: this.protocol,
      isSimulated: true,
      connectorName: this.config.name,
      tags,
    };
  }
}

/**
 * 5. Industrial MQTT IoT Broker Adapter
 */
export class MqttConnector implements IDataConnector {
  protocol: ConnectorProtocol = 'MQTT';
  status: ConnectorStatus = 'STANDBY_CONFIGURED';
  config: ConnectorConfig;

  constructor() {
    this.config = {
      id: 'conn-mqtt-iot',
      name: 'Industrial MQTT / Sparkplug B Broker',
      protocol: 'MQTT',
      endpointUrl: 'mqtts://broker.refinery-telemetry.com:8883',
      samplingIntervalMs: 500,
      securityMode: 'TLS',
      isSimulated: true,
      status: 'STANDBY_CONFIGURED',
      nodeMappings: {
        'PT-101': 'spBv1.0/Refinery/DDATA/Area04/PT-101',
        'TT-104': 'spBv1.0/Refinery/DDATA/Area04/TT-104',
        'LT-101': 'spBv1.0/Refinery/DDATA/Area04/LT-101',
        'FT-102': 'spBv1.0/Refinery/DDATA/Area04/FT-102',
      },
    };
  }

  async connect(): Promise<boolean> {
    this.status = 'STANDBY_CONFIGURED';
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = 'DISCONNECTED';
  }

  getStatus(): ConnectorStatus {
    return this.status;
  }

  pollPacket(
    simulationTimeSec: number,
    variables: Record<string, DynamicProcessVariable>
  ): TelemetryPacket {
    const tags: Record<string, TagQuality> = {};
    Object.values(variables).forEach((v) => {
      tags[v.tag] = {
        value: v.value,
        quality: 'GOOD',
        timestamp: new Date().toISOString(),
        source: 'SIMULATED',
      };
    });

    return {
      packetId: Math.floor(simulationTimeSec * 2),
      timestamp: new Date().toISOString(),
      simulationTimeSec,
      protocol: this.protocol,
      isSimulated: true,
      connectorName: this.config.name,
      tags,
    };
  }
}

/**
 * Registry & Factory of Connectors
 */
export const CONNECTOR_REGISTRY: Record<ConnectorProtocol, IDataConnector> = {
  SIMULATION_INTERNAL: new SimulationInternalConnector(),
  CSV_HISTORIAN_REPLAY: new CsvHistorianReplayConnector(),
  WEBSOCKET_CLIENT: new MockWebSocketClientConnector(),
  OPC_UA: new OpcUaConnector(),
  MQTT: new MqttConnector(),
  REST_API: new SimulationInternalConnector(),
  HISTORIAN_SQL: new CsvHistorianReplayConnector(),
};
