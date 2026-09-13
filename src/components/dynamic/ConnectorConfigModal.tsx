import React, { useState } from 'react';
import { ConnectorProtocol } from '../../types/dynamic';
import { CONNECTOR_REGISTRY, CsvHistorianReplayConnector } from '../../engine/dynamic/dataConnectors';

interface ConnectorConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConnector: ConnectorProtocol;
  onSelectConnector: (protocol: ConnectorProtocol) => void;
}

export const ConnectorConfigModal: React.FC<ConnectorConfigModalProps> = ({
  isOpen,
  onClose,
  activeConnector,
  onSelectConnector,
}) => {
  const [selectedProto, setSelectedProto] = useState<ConnectorProtocol>(activeConnector);
  const [csvStatusMessage, setCsvStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const connector = CONNECTOR_REGISTRY[selectedProto];
  const config = connector.config;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const csvConnector = CONNECTOR_REGISTRY.CSV_HISTORIAN_REPLAY as CsvHistorianReplayConnector;
      const res = csvConnector.loadCsvText(text);
      setCsvStatusMessage(res.message);
      if (res.success) {
        setSelectedProto('CSV_HISTORIAN_REPLAY');
        onSelectConnector('CSV_HISTORIAN_REPLAY');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    let csv = 'time,PT-101,TT-104,LT-101,FT-102,FV-101,PV-101,LV-101,SPD-201\n';
    for (let t = 0; t <= 120; t += 1) {
      const p = (82.5 + Math.sin(t * 0.1) * 0.4 + (t > 40 ? 1.5 : 0)).toFixed(2);
      const temp = (510.0 + Math.cos(t * 0.08) * 1.8 + (t > 40 ? -5 : 0)).toFixed(1);
      const lvl = (50.0 + Math.sin(t * 0.05) * 1.2).toFixed(1);
      const flw = (45000 + (t > 40 ? 3000 : 0)).toFixed(0);
      csv += `${t},${p},${temp},${lvl},${flw},48.5,42.0,51.2,4850\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plant_historian_sample_telemetry.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#131b2e] border border-[#3d494c]/60 rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#171f33] border-b border-[#3d494c]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#4cd7f6] text-xl">hub</span>
            <div>
              <h2 className="text-sm font-bold text-[#dae2fd]">
                Industrial Digital Twin Data Connector Configuration
              </h2>
              <p className="text-xs text-[#869397]">
                Configure data sources, plant historian replay, and protocol adapters.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#869397] hover:text-[#dae2fd] hover:bg-[#1c253b] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Mandatory Transparency Notice */}
        <div className="px-4 py-2.5 bg-[#171f33]/80 border-b border-[#3d494c]/30 text-xs font-mono flex items-start gap-2 text-[#ffddb8]">
          <span className="material-symbols-outlined text-[#ffb95f] text-base shrink-0 mt-0.5">
            info
          </span>
          <div>
            <strong>DATA PROVENANCE &amp; SIMULATION NOTICE:</strong> Browser client applications operate in a sandboxed runtime. Telemetry streams are explicitly tagged as{' '}
            <span className="px-1 py-0.5 rounded bg-[#0b1326] text-[#4cd7f6] font-bold">
              [SIMULATION]
            </span>{' '}
            or{' '}
            <span className="px-1 py-0.5 rounded bg-[#0b1326] text-[#ffddb8] font-bold">
              [REPLAY]
            </span>
            . External protocols (OPC UA, MQTT) run in verified standby architecture mode unless bridged via an authorized local enterprise edge agent.
          </div>
        </div>

        {/* Content body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs font-mono">
          {/* Protocol Selection Tabs */}
          <div>
            <label className="text-[10.5px] text-[#869397] uppercase block mb-1.5 font-bold">
              Select Active Telemetry Protocol
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'SIMULATION_INTERNAL', label: 'PetroSimX ODE Engine', tag: 'SIMULATED' },
                { id: 'CSV_HISTORIAN_REPLAY', label: 'CSV Historian Replay', tag: 'REPLAY' },
                { id: 'WEBSOCKET_CLIENT', label: 'WebSocket Stream', tag: 'MOCK STREAM' },
                { id: 'OPC_UA', label: 'OPC Foundation (UA)', tag: 'STANDBY' },
                { id: 'MQTT', label: 'Industrial MQTT', tag: 'STANDBY' },
                { id: 'REST_API', label: 'DCS REST Poller', tag: 'STANDBY' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProto(p.id as ConnectorProtocol)}
                  className={`p-2.5 rounded text-left border transition-all ${
                    selectedProto === p.id
                      ? 'bg-[#171f33] border-[#4cd7f6] ring-1 ring-[#4cd7f6]/40 text-[#dae2fd]'
                      : 'bg-[#0b1326] border-[#3d494c]/30 text-[#869397] hover:border-[#3d494c]/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{p.label}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-[#131b2e] text-[#4cd7f6]">
                      {p.tag}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-[#869397] mt-1">
                    {p.id === activeConnector ? '● CURRENTLY ACTIVE' : 'Click to inspect'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Inspector for selected protocol */}
          <div className="p-3 bg-[#0b1326] rounded border border-[#3d494c]/40 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
              <div>
                <span className="font-bold text-[#dae2fd] text-sm">{config.name}</span>
                <div className="text-[10px] text-[#869397] mt-0.5">
                  Protocol: {config.protocol} | Sampling Interval: {config.samplingIntervalMs}ms
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  config.status === 'ACTIVE_STREAMING'
                    ? 'bg-[#1bbd85]/20 text-[#4edea3]'
                    : config.status === 'REPLAYING'
                    ? 'bg-[#4cd7f6]/20 text-[#4cd7f6]'
                    : 'bg-[#ffb95f]/20 text-[#ffddb8]'
                }`}
              >
                {config.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#869397] uppercase block">Endpoint URI</label>
                <input
                  type="text"
                  readOnly
                  value={config.endpointUrl}
                  className="w-full bg-[#171f33] px-2 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/40 mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#869397] uppercase block">Security Mode</label>
                <input
                  type="text"
                  readOnly
                  value={config.securityMode || 'Standard In-Memory Sandbox'}
                  className="w-full bg-[#171f33] px-2 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/40 mt-1"
                />
              </div>
            </div>

            {/* Special controls for CSV Replay */}
            {selectedProto === 'CSV_HISTORIAN_REPLAY' && (
              <div className="p-3 bg-[#171f33] rounded border border-[#3d494c]/40 space-y-2">
                <div className="font-bold text-[#dae2fd] flex items-center justify-between">
                  <span>Historian CSV Dataset Management</span>
                  <button
                    onClick={handleDownloadSampleCsv}
                    className="text-[#4cd7f6] hover:underline text-[11px] flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">download</span>
                    Download Sample CSV
                  </button>
                </div>
                <p className="text-[11px] text-[#869397]">
                  Upload a CSV file containing columns: <code className="text-[#dae2fd]">time, PT-101, TT-104, LT-101, FT-102...</code>
                </p>

                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-[#4cd7f6] text-[#003640] rounded font-bold cursor-pointer hover:bg-[#38bde6] transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">upload_file</span>
                    Upload Historian CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {csvStatusMessage && (
                    <span className="text-[#4edea3] text-xs">{csvStatusMessage}</span>
                  )}
                </div>
              </div>
            )}

            {/* Node ID Mappings Table */}
            <div>
              <div className="text-[10px] text-[#869397] uppercase font-bold mb-1">
                Transmitter Tag &harr; Industrial Namespace Mappings
              </div>
              <div className="bg-[#171f33] rounded border border-[#3d494c]/30 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#131b2e] text-[#869397] text-[9.5px] uppercase">
                    <tr>
                      <th className="p-2">Transmitter Tag</th>
                      <th className="p-2">Target NodeId / Topic Path</th>
                      <th className="p-2 text-right">Direction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3d494c]/20">
                    {Object.entries(config.nodeMappings).map(([tag, node]) => (
                      <tr key={tag} className="hover:bg-[#1c253b]/50">
                        <td className="p-2 font-bold text-[#4cd7f6]">{tag}</td>
                        <td className="p-2 text-[#dae2fd]">{node}</td>
                        <td className="p-2 text-right text-[#869397]">INBOUND &larr;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#171f33] border-t border-[#3d494c]/40 flex items-center justify-between">
          <div className="text-xs font-mono text-[#869397]">
            Active Connector:{' '}
            <strong className="text-[#4cd7f6]">{CONNECTOR_REGISTRY[activeConnector].config.name}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#0b1326] border border-[#3d494c]/50 text-xs font-mono text-[#869397] hover:text-[#dae2fd] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSelectConnector(selectedProto);
                onClose();
              }}
              className="px-4 py-1.5 rounded bg-[#4cd7f6] text-[#003640] text-xs font-mono font-bold hover:bg-[#38bde6] transition-colors"
            >
              Switch Active Connector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
