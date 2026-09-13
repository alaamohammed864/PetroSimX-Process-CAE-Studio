import React, { useState } from 'react';
import { EquipmentUnit, ProcessStream } from '../types/simulation';
import { integrateReactorOde } from '../engine/thermoEngine';

interface SensitivityModalProps {
  unit: EquipmentUnit;
  inletStream: ProcessStream;
  onClose: () => void;
}

export const SensitivityModal: React.FC<SensitivityModalProps> = ({
  unit,
  inletStream,
  onClose,
}) => {
  const [testInletTemp, setTestInletTemp] = useState(unit.equilibrium.inletTempC);
  const [testPres, setTestPres] = useState(unit.equilibrium.operatingPresBar);

  const testUnit: EquipmentUnit = {
    ...unit,
    equilibrium: {
      ...unit.equilibrium,
      inletTempC: testInletTemp,
      operatingPresBar: testPres,
    },
  };

  const { profile, outletTempC, conversionPct, h2YieldPct } = integrateReactorOde(testUnit, inletStream);

  // Generate sensitivity sweep: T from 480 to 530 C
  const sweepData = [480, 490, 500, 510, 520, 530].map((t) => {
    const sweepUnit = { ...unit, equilibrium: { ...unit.equilibrium, inletTempC: t } };
    const res = integrateReactorOde(sweepUnit, inletStream);
    return { temp: t, conv: res.conversionPct, outTemp: res.outletTempC };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#171f33] border border-[#3d494c] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 py-2.5 bg-[#222a3d] border-b border-[#3d494c]/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">ssid_chart</span>
            <span className="font-mono font-bold text-[13px] text-[#dae2fd]">
              {unit.id} PARAMETRIC SENSITIVITY &amp; AXIAL BED PROFILES
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#869397] hover:text-white rounded hover:bg-[#171f33]"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 font-mono text-[11px]">
          {/* Controls row */}
          <div className="grid grid-cols-3 gap-3 bg-[#060e20] p-3 rounded border border-[#3d494c]/30">
            <div>
              <label className="text-[#869397] text-[10px] block mb-1">Inlet Temperature: {testInletTemp.toFixed(1)} °C</label>
              <input
                type="range"
                min="470"
                max="540"
                step="1"
                value={testInletTemp}
                onChange={(e) => setTestInletTemp(parseFloat(e.target.value))}
                className="w-full accent-[#4cd7f6] cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[#869397] text-[10px] block mb-1">Operating Pressure: {testPres.toFixed(1)} bar</label>
              <input
                type="range"
                min="60"
                max="100"
                step="0.5"
                value={testPres}
                onChange={(e) => setTestPres(parseFloat(e.target.value))}
                className="w-full accent-[#4cd7f6] cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-around bg-[#131b2e] p-2 rounded border border-[#3d494c]/20">
              <div className="text-center">
                <span className="text-[#869397] block text-[9px]">Conv. Rate</span>
                <span className="text-[#4edea3] font-bold text-[13px]">{conversionPct}%</span>
              </div>
              <div className="text-center">
                <span className="text-[#869397] block text-[9px]">Outlet Temp</span>
                <span className="text-[#ffddb8] font-bold text-[13px]">{outletTempC} °C</span>
              </div>
              <div className="text-center">
                <span className="text-[#869397] block text-[9px]">H2 Yield</span>
                <span className="text-[#4cd7f6] font-bold text-[13px]">{h2YieldPct}%</span>
              </div>
            </div>
          </div>

          {/* Axial Bed 1 & Bed 2 Temperature Profile Chart */}
          <div className="bg-[#060e20] p-3 rounded border border-[#3d494c]/30 space-y-2">
            <div className="flex items-center justify-between text-[#dae2fd]">
              <span className="font-bold">Axial Bed Temperature Profile T(z) &amp; Quench Injection</span>
              <span className="text-[#869397] text-[10px]">Bed Height: {unit.geometry.bedHeightM} m</span>
            </div>

            {/* SVG Chart visualization */}
            <div className="h-44 w-full relative bg-[#131b2e] rounded p-2 border border-[#3d494c]/20">
              <svg className="w-full h-full" viewBox="0 0 700 140" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="40" y1="20" x2="680" y2="20" stroke="#3d494c" strokeDasharray="2,2" strokeWidth="1" />
                <line x1="40" y1="70" x2="680" y2="70" stroke="#3d494c" strokeDasharray="2,2" strokeWidth="1" />
                <line x1="40" y1="120" x2="680" y2="120" stroke="#3d494c" strokeDasharray="2,2" strokeWidth="1" />

                {/* Quench vertical marker */}
                <line x1="360" y1="10" x2="360" y2="130" stroke="#acedff" strokeDasharray="3,3" strokeWidth="1.5" />
                <text x="365" y="25" fill="#acedff" fontSize="9" fontFamily="JetBrains Mono">Quench Injection (z = 2.7m)</text>

                {/* Temperature curve */}
                <path
                  d={profile.reduce((acc, pt, idx) => {
                    const x = 40 + (pt.zM / unit.geometry.bedHeightM) * 640;
                    // Scale temp from 460 - 540 C to y (120 - 20)
                    const y = 120 - ((pt.tempC - 460) / 80) * 100;
                    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                  }, '')}
                  fill="none"
                  stroke="#ffb95f"
                  strokeWidth="2.5"
                />

                {/* Conversion curve */}
                <path
                  d={profile.reduce((acc, pt, idx) => {
                    const x = 40 + (pt.zM / unit.geometry.bedHeightM) * 640;
                    // Scale conversion from 0 - 100% to y (120 - 20)
                    const y = 120 - (pt.conversionPct / 100) * 100;
                    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                  }, '')}
                  fill="none"
                  stroke="#4edea3"
                  strokeWidth="2"
                  strokeDasharray="4,2"
                />
              </svg>

              {/* Legend */}
              <div className="absolute top-2 left-12 flex items-center gap-4 text-[9.5px]">
                <div className="flex items-center gap-1 text-[#ffb95f]">
                  <div className="w-3 h-0.5 bg-[#ffb95f]"></div>
                  <span>Temperature T(z) [°C]</span>
                </div>
                <div className="flex items-center gap-1 text-[#4edea3]">
                  <div className="w-3 h-0.5 bg-[#4edea3] border-t border-dashed"></div>
                  <span>Aromatic Conversion X(z) [%]</span>
                </div>
              </div>
            </div>
          </div>

          {/* Temperature Sweep Sensitivity Table */}
          <div className="bg-[#060e20] p-3 rounded border border-[#3d494c]/30 space-y-1.5">
            <span className="font-bold text-[#4cd7f6] block">Parametric Sweep: Inlet Temperature Sensitivity Matrix</span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="text-[#869397] border-b border-[#3d494c]/30">
                    <th className="py-1">Inlet Temp [°C]</th>
                    <th className="py-1">Outlet Temp [°C]</th>
                    <th className="py-1">Bed Temp Drop ΔT [°C]</th>
                    <th className="py-1">Conversion [%]</th>
                    <th className="py-1">Predicted C6H6 Yield</th>
                    <th className="py-1">Coking Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d494c]/20">
                  {sweepData.map((row) => (
                    <tr key={row.temp} className={row.temp === Math.round(testInletTemp) ? 'bg-[#222a3d] font-bold text-[#4cd7f6]' : 'hover:bg-[#171f33]'}>
                      <td className="py-1">{row.temp}.0</td>
                      <td className="py-1 text-[#ffddb8]">{row.outTemp.toFixed(2)}</td>
                      <td className="py-1 text-[#ffb4ab]">{(row.temp - row.outTemp).toFixed(2)}</td>
                      <td className="py-1 text-[#4edea3]">{row.conv}%</td>
                      <td className="py-1 text-[#dae2fd]">{(row.conv * 0.42).toFixed(1)} wt%</td>
                      <td className="py-1 text-[#869397]">
                        {row.temp > 520 ? <span className="text-[#ffb4ab]">Elevated</span> : <span className="text-[#4edea3]">Low / Nominal</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#222a3d] border-t border-[#3d494c]/30 flex items-center justify-between">
          <span className="text-[#869397] text-[10px]">Numerical Solver: 4th Order Runge-Kutta / ODE15s with Variable Step Size</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#4cd7f6] text-[#003640] font-bold rounded hover:opacity-90 transition-opacity"
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
