import React, { useState } from 'react';
import { EquipmentUnit, ProcessStream, UnitSystem } from '../../types/simulation';
import { integrateReactorOde } from '../../engine/thermoEngine';
import { ReactionEditor } from '../reactors/ReactionEditor';

interface ReactorEngineeringViewProps {
  unit: EquipmentUnit;
  inletStream: ProcessStream;
  unitSystem: UnitSystem;
}

export const ReactorEngineeringView: React.FC<ReactorEngineeringViewProps> = ({
  unit,
  inletStream,
}) => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'editor' | 'ergun'>('profiles');
  const { profile, outletTempC, outletPresBar, conversionPct } = integrateReactorOde(unit, inletStream);

  return (
    <div className="p-3 space-y-3 max-w-7xl mx-auto font-mono text-[11px] select-none">
      {/* Top Banner */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-bold">
            <span className="material-symbols-outlined text-[18px]">propane_tank</span>
            <span>CATALYTIC FIXED-BED REACTOR &amp; KINETICS SUITE ({unit.tag || 'R-101'})</span>
          </div>
          <p className="text-[#869397] text-[10px] mt-0.5">
            Two-phase packed bed hydrotreating &amp; reforming with Langmuir-Hinshelwood and multi-reaction kinetics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[#869397] block text-[9px]">Conversion</span>
            <span className="text-[#4edea3] font-bold text-[13px]">{conversionPct}%</span>
          </div>
          <div className="text-right">
            <span className="text-[#869397] block text-[9px]">Outlet Temp</span>
            <span className="text-[#ffddb8] font-bold text-[13px]">{outletTempC} °C</span>
          </div>
          <div className="text-right">
            <span className="text-[#869397] block text-[9px]">Outlet Pres</span>
            <span className="text-[#dae2fd] font-bold text-[13px]">{outletPresBar} bar</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-[#131b2e] p-1 rounded border border-[#3d494c]/30 gap-1 text-[11px]">
        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'profiles'
              ? 'bg-[#222a3d] text-[#4cd7f6] font-bold border border-[#4cd7f6]/40'
              : 'text-[#bcc9cd] hover:text-[#dae2fd]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">linear_scale</span>
          <span>Axial Bed State Profiles (ODE15s)</span>
        </button>

        <button
          onClick={() => setActiveTab('editor')}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'editor'
              ? 'bg-[#222a3d] text-[#4cd7f6] font-bold border border-[#4cd7f6]/40'
              : 'text-[#bcc9cd] hover:text-[#dae2fd]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">science</span>
          <span>Reaction Kinetics Editor</span>
        </button>

        <button
          onClick={() => setActiveTab('ergun')}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'ergun'
              ? 'bg-[#222a3d] text-[#4cd7f6] font-bold border border-[#4cd7f6]/40'
              : 'text-[#bcc9cd] hover:text-[#dae2fd]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">straighten</span>
          <span>Ergun Bed Hydraulics &amp; Catalyst</span>
        </button>
      </div>

      {/* TAB 1: Axial Profiles */}
      {activeTab === 'profiles' && (
        <div className="grid grid-cols-12 gap-3">
          {/* Kinetic Rate Laws (Cols 1 to 6) */}
          <div className="col-span-12 md:col-span-6 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
            <span className="font-bold text-[#4cd7f6] flex items-center gap-1.5 border-b border-[#3d494c]/30 pb-1.5">
              <span className="material-symbols-outlined text-[16px]">dynamic_form</span>
              Langmuir-Hinshelwood Rate Laws &amp; Mechanism
            </span>

            <div className="space-y-2">
              {unit.kinetics?.map((rx, idx) => (
                <div key={rx.id} className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#ffddb8]">Reaction {idx + 1}: {rx.name}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] ${rx.type === 'Endo' ? 'bg-[#ffb95f]/20 text-[#ffb95f]' : 'bg-[#4edea3]/20 text-[#4edea3]'}`}>
                      {rx.type} (ΔH: {rx.deltaHKJPerMol > 0 ? `+${rx.deltaHKJPerMol}` : rx.deltaHKJPerMol} kJ/mol)
                    </span>
                  </div>
                  <div className="text-white text-[11px] font-semibold">{rx.equation}</div>
                  <div className="text-[#869397] text-[9.5px]">
                    Rate r = (k₁ · P_hc · P_h2 - k₂ · P_prod) / (1 + K_ads · P_total)²
                  </div>
                </div>
              ))}
            </div>

            {/* Operating Summary */}
            <div className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 space-y-1.5 text-[10px]">
              <span className="text-[#4edea3] font-bold block">Inlet Operating Specifications:</span>
              <div className="grid grid-cols-3 gap-2 text-[#dae2fd]">
                <div>Inlet Temp: <span className="text-[#ffddb8]">{unit.equilibrium.inletTempC.toFixed(1)} °C</span></div>
                <div>Pressure: <span>{unit.equilibrium.operatingPresBar.toFixed(1)} bar</span></div>
                <div>LHSV: <span>{unit.equilibrium.lhsvSpaceVelH1.toFixed(1)} h⁻¹</span></div>
              </div>
            </div>
          </div>

          {/* Axial Bed Profiles Table (Cols 7 to 12) */}
          <div className="col-span-12 md:col-span-6 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
            <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-1.5">
              <span className="font-bold text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">linear_scale</span>
                Integrated Bed Axial State Vector
              </span>
              <span className="text-[#869397] text-[9.5px]">Δz = 0.14 m</span>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="text-[#869397] border-b border-[#3d494c]/30">
                    <th className="py-1">Length z [m]</th>
                    <th className="py-1 text-right">Temp [°C]</th>
                    <th className="py-1 text-right">Pres [bar]</th>
                    <th className="py-1 text-right">Conv. [%]</th>
                    <th className="py-1 text-right">Reaction Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d494c]/20">
                  {profile.filter((_, i) => i % 2 === 0).map((pt) => (
                    <tr key={pt.zM} className={pt.zM === 2.7 ? 'bg-[#222a3d] font-bold text-[#acedff]' : 'hover:bg-[#222a3d]'}>
                      <td className="py-1 text-[#4cd7f6]">{pt.zM.toFixed(2)}</td>
                      <td className="py-1 text-right text-[#ffddb8]">{pt.tempC.toFixed(1)}</td>
                      <td className="py-1 text-right text-[#dae2fd]">{pt.presBar.toFixed(2)}</td>
                      <td className="py-1 text-right text-[#4edea3]">{pt.conversionPct}%</td>
                      <td className="py-1 text-right text-[#869397]">{pt.c6h6Rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Reaction Kinetics Editor */}
      {activeTab === 'editor' && (
        <ReactionEditor />
      )}

      {/* TAB 3: Ergun Pressure Drop & Bed Hydraulics */}
      {activeTab === 'ergun' && (
        <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
          <span className="font-bold text-[#4cd7f6] flex items-center gap-1.5 border-b border-[#3d494c]/30 pb-1.5">
            <span className="material-symbols-outlined text-[16px]">compress</span>
            Ergun Equation &amp; Catalyst Mechanics
          </span>

          <div className="bg-[#060e20] p-3 rounded border border-[#3d494c]/20 space-y-2 text-[10.5px]">
            <span className="text-[#4edea3] font-bold block">Ergun Momentum Balance for Packed Bed:</span>
            <div className="text-[#dae2fd] font-mono p-2 bg-[#131b2e] rounded border border-[#3d494c]/30">
              -dP/dz = 150 · [µ · (1 - ε)² / (d_p² · ε³)] · v_s + 1.75 · [ρ · (1 - ε) / (d_p · ε³)] · v_s²
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2 text-[10px]">
              <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block">Bed Voidage (ε)</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">{unit.geometry.bedVoidage}</span>
              </div>
              <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block">Pellet Diameter (d_p)</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">{unit.catalyst?.pelletDiameterMm || 2.5} mm</span>
              </div>
              <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block">Catalyst Volume</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">{unit.geometry.catalystVolumeM3.toFixed(1)} m³</span>
              </div>
              <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block">Bed Height</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">{unit.geometry.bedHeightM.toFixed(1)} m</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
