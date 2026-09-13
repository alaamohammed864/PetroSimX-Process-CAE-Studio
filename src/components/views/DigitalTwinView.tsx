import React, { useState, useEffect } from 'react';
import { EquipmentUnit, ProcessStream, UnitSystem } from '../../types/simulation';
import { formatFlow, formatPres, formatTemp } from '../../engine/thermoEngine';

interface DigitalTwinViewProps {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  unitSystem: UnitSystem;
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({
  units,
  streams,
  unitSystem,
}) => {
  const [telemetryNoise, setTelemetryNoise] = useState(0);

  // Simulate real-time sensor jitter & DCS telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetryNoise((Math.random() - 0.5) * 0.4);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const s104 = streams.find((s) => s.id === 'S-104') || streams[3];
  const s105 = streams.find((s) => s.id === 'S-105') || streams[4];
  const s106 = streams.find((s) => s.id === 'S-106') || streams[5];

  const rInletTemp = s104.tempC + telemetryNoise * 2;
  const rEffluentTemp = s105.tempC - telemetryNoise * 1.5;
  const rPressure = s104.presBar + telemetryNoise * 0.2;
  const rDeltaP = Math.max(0.5, 1.86 + telemetryNoise * 0.1);

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto font-mono text-[11px] select-none">
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#4cd7f6] text-[13px] font-bold">
            <span className="material-symbols-outlined text-[18px]">sensors</span>
            <span>DIGITAL TWIN TELEMETRY &amp; DCS HARDWARE INTERFACE</span>
          </div>
          <p className="text-[#869397] text-[10px] mt-0.5">
            Real-time OPC-UA / Modbus TCP industrial telemetry link with safety interlocks and alarm thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#1bbd85]/20 border border-[#4edea3]/30">
          <div className="w-2 h-2 rounded-full bg-[#4edea3] animate-ping" />
          <span className="text-[#4edea3] font-bold text-[10.5px]">OPC-UA STREAM: ONLINE (10 Hz)</span>
        </div>
      </div>

      {/* Critical Process Alarms & Indicators */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-1">
          <span className="text-[#869397] text-[9.5px]">TIC-104 (Rx Charge Temp)</span>
          <div className="text-[18px] font-bold text-[#ffddb8]">{formatTemp(rInletTemp, unitSystem)}</div>
          <div className="flex items-center justify-between text-[9px] text-[#4edea3]">
            <span>SP: 510.0 °C</span>
            <span>ALARM HI: 535 °C</span>
          </div>
        </div>

        <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-1">
          <span className="text-[#869397] text-[9.5px]">PIC-104 (Reactor Inlet Pres)</span>
          <div className="text-[18px] font-bold text-[#dae2fd]">{formatPres(rPressure, unitSystem)}</div>
          <div className="flex items-center justify-between text-[9px] text-[#4edea3]">
            <span>SP: 82.5 bar</span>
            <span>PSV SET: 95.0 bar</span>
          </div>
        </div>

        <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-1">
          <span className="text-[#869397] text-[9.5px]">PDIT-101 (Bed ΔP Differential)</span>
          <div className="text-[18px] font-bold text-[#ffb4ab]">{rDeltaP.toFixed(2)} bar</div>
          <div className="flex items-center justify-between text-[9px] text-[#ffddb8]">
            <span>Clean: 1.20 bar</span>
            <span>Fouled: &gt; 3.0 bar</span>
          </div>
        </div>

        <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-1">
          <span className="text-[#869397] text-[9.5px]">FIC-106 (H2 Recycle Rate)</span>
          <div className="text-[18px] font-bold text-[#acedff]">{formatFlow(s106.flowKgH, unitSystem)}</div>
          <div className="flex items-center justify-between text-[9px] text-[#4edea3]">
            <span>H2:HC: 650 Nm³/m³</span>
            <span>Min: 450 Nm³/m³</span>
          </div>
        </div>
      </div>

      {/* Real-time Telemetry Trend Visualizer */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#dae2fd] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[16px]">show_chart</span>
            Live DCS Strip Chart - Reactor Exotherm &amp; Quench Dynamics
          </span>
          <span className="text-[#869397] text-[10px]">Sample Interval: 1.0 sec</span>
        </div>

        <div className="h-44 w-full bg-[#060e20] rounded p-2 border border-[#3d494c]/30 relative overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 800 140" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1="35" x2="800" y2="35" stroke="#3d494c" strokeDasharray="3,3" strokeWidth="0.8" />
            <line x1="0" y1="70" x2="800" y2="70" stroke="#3d494c" strokeDasharray="3,3" strokeWidth="0.8" />
            <line x1="0" y1="105" x2="800" y2="105" stroke="#3d494c" strokeDasharray="3,3" strokeWidth="0.8" />

            {/* Simulated Live Trend Line 1: Inlet Temp */}
            <path
              d="M 0 50 Q 150 45, 300 52 T 600 48 T 800 50"
              fill="none"
              stroke="#ffb95f"
              strokeWidth="2"
            />

            {/* Simulated Live Trend Line 2: Effluent Temp */}
            <path
              d="M 0 95 Q 200 90, 400 98 T 700 92 T 800 95"
              fill="none"
              stroke="#4edea3"
              strokeWidth="2"
            />
          </svg>

          <div className="absolute top-2 left-4 flex items-center gap-4 text-[9.5px]">
            <div className="flex items-center gap-1 text-[#ffb95f]">
              <div className="w-3 h-0.5 bg-[#ffb95f]"></div>
              <span>Charge Temp: {rInletTemp.toFixed(1)} °C</span>
            </div>
            <div className="flex items-center gap-1 text-[#4edea3]">
              <div className="w-3 h-0.5 bg-[#4edea3]"></div>
              <span>Effluent Temp: {rEffluentTemp.toFixed(1)} °C</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
