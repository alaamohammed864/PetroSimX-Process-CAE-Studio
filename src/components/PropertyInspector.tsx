import React, { useState } from 'react';
import { EquipmentUnit, UnitSystem } from '../types/simulation';

interface PropertyInspectorProps {
  selectedUnit: EquipmentUnit;
  unitSystem: UnitSystem;
  onUpdateEquilibrium: (param: string, value: number) => void;
  onUpdateGeometry: (param: string, value: number) => void;
  onUpdateUnitSpec?: (specField: string, value: any) => void;
  onReintegrateOde: () => void;
  onOpenSensitivityCurves: () => void;
  onExportMatrix: () => void;
  isIntegrating: boolean;
  onClose?: () => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedUnit,
  unitSystem,
  onUpdateEquilibrium,
  onUpdateGeometry,
  onUpdateUnitSpec,
  onReintegrateOde,
  onOpenSensitivityCurves,
  onExportMatrix,
  isIntegrating,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'specs' | 'kinetics' | 'catalyst'>('specs');
  const [editingField, setEditingField] = useState<string | null>(null);

  const { geometry, equilibrium, kinetics, catalyst, type } = selectedUnit;

  // Icon selector based on equipment type
  const getUnitIcon = (unitType: string) => {
    switch (unitType) {
      case 'column':
      case 'absorber':
      case 'stripper':
        return 'view_column';
      case 'heatex':
        return 'device_thermostat';
      case 'furnace':
        return 'local_fire_department';
      case 'pump':
        return 'mode_fan';
      case 'compressor':
        return 'speed';
      case 'valve':
        return 'valve';
      case 'three_phase_separator':
      case 'liquid_liquid_separator':
      case 'vessel':
        return 'water_damage';
      case 'reactor':
      default:
        return 'science';
    }
  };

  return (
    <aside className="w-80 max-w-[90vw] h-full shrink-0 bg-[#171f33] border-l border-[#3d494c]/30 flex flex-col overflow-y-auto select-none">
      {/* Inspector Header */}
      <div className="p-2.5 bg-[#222a3d] flex flex-col gap-1 border-b border-[#3d494c]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
              {getUnitIcon(type)}
            </span>
            <span className="font-semibold text-[13px] text-[#dae2fd]">
              {selectedUnit.id} SPECIFICATION
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-[#1bbd85]/20 text-[#4edea3] font-mono text-[10px] border border-[#4edea3]/30">
              {selectedUnit.status === 'converged' ? 'CONVERGED' : selectedUnit.status.toUpperCase()}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded text-[#869397] hover:text-white hover:bg-[#171f33] transition-colors"
                title="Close Inspector"
                type="button"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-mono text-[#869397] truncate">{selectedUnit.name}</span>
          <span className="font-mono text-[#4cd7f6] uppercase tracking-wider text-[9px]">{type}</span>
        </div>
      </div>

      {/* Tab Strip (Visible for Reactors, simplified for other equipment) */}
      {type === 'reactor' ? (
        <div className="flex bg-[#060e20] font-mono text-[10px] border-b border-[#3d494c]/30">
          <button
            onClick={() => setActiveTab('specs')}
            className={`flex-1 py-1.5 px-2 text-center transition-colors ${
              activeTab === 'specs'
                ? 'bg-[#171f33] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            Specs &amp; Geom
          </button>
          <button
            onClick={() => setActiveTab('kinetics')}
            className={`flex-1 py-1.5 px-2 text-center transition-colors ${
              activeTab === 'kinetics'
                ? 'bg-[#171f33] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            Kinetics ({kinetics?.length || 2})
          </button>
          <button
            onClick={() => setActiveTab('catalyst')}
            className={`flex-1 py-1.5 px-2 text-center transition-colors ${
              activeTab === 'catalyst'
                ? 'bg-[#171f33] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            Catalyst
          </button>
        </div>
      ) : (
        <div className="flex bg-[#060e20] font-mono text-[10px] border-b border-[#3d494c]/30 px-2 py-1 text-[#4cd7f6] font-bold">
          Equipment Parameters &amp; Operation Specs
        </div>
      )}

      <div className="p-2.5 flex flex-col gap-3 font-sans text-[11.5px] flex-1">
        {/* ================= TYPE 1: DISTILLATION COLUMN ================= */}
        {type === 'column' && (
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#ffddb8] font-bold text-[11px]">
                <span>Fractionation Tower Specs</span>
                <span className="material-symbols-outlined text-[14px]">view_column</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Stages (N)</span>
                  <span className="text-[#dae2fd] font-bold">{selectedUnit.columnSpec?.numberOfStages || 24} trays</span>
                </div>
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Feed Tray</span>
                  <span className="text-[#dae2fd] font-bold">Tray #{selectedUnit.columnSpec?.feedStage || 12}</span>
                </div>
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Reflux Ratio (L/D)</span>
                  <span className="text-[#4edea3] font-bold">{selectedUnit.columnSpec?.refluxRatio || 2.5}</span>
                </div>
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Condenser</span>
                  <span className="text-[#4cd7f6] font-bold uppercase">{selectedUnit.columnSpec?.condenserType || 'Total'}</span>
                </div>
              </div>
            </div>

            {/* Operating Performance */}
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#4cd7f6] font-bold text-[11px]">
                <span>Thermal Duties &amp; Hydraulics</span>
                <span className="material-symbols-outlined text-[14px]">bolt</span>
              </div>
              <table className="w-full text-left text-[10px]">
                <tbody className="divide-y divide-[#3d494c]/20">
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Condenser Duty (Qc)</td>
                    <td className="py-1 text-right text-[#4cd7f6] font-bold">
                      {selectedUnit.columnResult?.condenserDutyKW ? (selectedUnit.columnResult.condenserDutyKW / 1000).toFixed(2) : '3.85'} MW
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Reboiler Duty (Qb)</td>
                    <td className="py-1 text-right text-[#ffb95f] font-bold">
                      {selectedUnit.columnResult?.reboilerDutyKW ? (selectedUnit.columnResult.reboilerDutyKW / 1000).toFixed(2) : '4.18'} MW
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Top Pressure</td>
                    <td className="py-1 text-right text-[#dae2fd]">
                      {selectedUnit.columnSpec?.topPressureBar || 14.5} bar
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Bottom Pressure</td>
                    <td className="py-1 text-right text-[#dae2fd]">
                      {selectedUnit.columnSpec?.bottomPressureBar || 15.5} bar
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TYPE 2: ABSORBER & STRIPPER ================= */}
        {(type === 'absorber' || type === 'stripper') && (
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#4cd7f6] font-bold text-[11px]">
                <span>Mass Transfer Column Specs</span>
                <span className="material-symbols-outlined text-[14px]">swap_vert</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Stages</span>
                  <span className="text-[#dae2fd] font-bold">{selectedUnit.absorberSpec?.numberOfStages || selectedUnit.stripperSpec?.numberOfStages || 16} trays</span>
                </div>
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Oper. Pressure</span>
                  <span className="text-[#dae2fd] font-bold">{equilibrium.operatingPresBar.toFixed(1)} bar</span>
                </div>
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">ΔP Column</span>
                  <span className="text-[#ffb4ab] font-bold">{equilibrium.pressureDropBar.toFixed(2)} bar</span>
                </div>
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Target Solvent</span>
                  <span className="text-[#4edea3] font-bold">{selectedUnit.absorberSpec?.targetSolvent || 'Amine / Gas Oil'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TYPE 3: THREE-PHASE SEPARATOR & DECANTER ================= */}
        {(type === 'three_phase_separator' || type === 'liquid_liquid_separator' || type === 'vessel') && (
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#4edea3] font-bold text-[11px]">
                <span>Multiphase Vessel Sizing</span>
                <span className="material-symbols-outlined text-[14px]">water_damage</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Pressure</span>
                  <span className="text-[#dae2fd] font-bold">{equilibrium.operatingPresBar.toFixed(1)} bar</span>
                </div>
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Temperature</span>
                  <span className="text-[#ffddb8] font-bold">{equilibrium.inletTempC.toFixed(1)} °C</span>
                </div>
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Retention Time</span>
                  <span className="text-[#4cd7f6] font-bold">{selectedUnit.threePhaseSpec?.residenceTimeMin || 8.0} min</span>
                </div>
                <div className="bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">L/D Aspect Ratio</span>
                  <span className="text-[#dae2fd] font-bold">3.0 (Horizontal)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TYPE 4: HEAT EXCHANGER ================= */}
        {type === 'heatex' && (
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#4cd7f6] font-bold text-[11px]">
                <span>TEMA Shell &amp; Tube Exchanger</span>
                <span className="material-symbols-outlined text-[14px]">device_thermostat</span>
              </div>
              <table className="w-full text-left text-[10px]">
                <tbody className="divide-y divide-[#3d494c]/20">
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Heat Duty</td>
                    <td className="py-1 text-right text-[#4edea3] font-bold">{equilibrium.dutyMW ? equilibrium.dutyMW.toFixed(2) : '18.5'} MW</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Hot Inlet / Outlet</td>
                    <td className="py-1 text-right text-[#ffddb8]">365.0 → 210.0 °C</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Cold Inlet / Outlet</td>
                    <td className="py-1 text-right text-[#4cd7f6]">40.0 → 225.0 °C</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">LMTD</td>
                    <td className="py-1 text-right text-[#dae2fd]">48.2 °C</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Overall U</td>
                    <td className="py-1 text-right text-[#dae2fd]">450 W/(m²·K)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TYPE 5: FIRED HEATER / FURNACE ================= */}
        {type === 'furnace' && (
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#ffb95f] font-bold text-[11px]">
                <span>Direct Fired Furnace Specs</span>
                <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
              </div>
              <table className="w-full text-left text-[10px]">
                <tbody className="divide-y divide-[#3d494c]/20">
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Absorbed Duty</td>
                    <td className="py-1 text-right text-[#ffb95f] font-bold">{equilibrium.dutyMW ? equilibrium.dutyMW.toFixed(2) : '24.5'} MW</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Thermal Efficiency</td>
                    <td className="py-1 text-right text-[#4edea3] font-bold">89.0 %</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Target Outlet Temp</td>
                    <td className="py-1 text-right text-[#ffddb8] font-bold">{equilibrium.outletTempC.toFixed(1)} °C</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Fuel Type</td>
                    <td className="py-1 text-right text-[#dae2fd]">Refinery Fuel Gas</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Excess Air</td>
                    <td className="py-1 text-right text-[#dae2fd]">15.0 %</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TYPE 6: PUMPS & COMPRESSORS ================= */}
        {(type === 'pump' || type === 'compressor') && (
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#4edea3] font-bold text-[11px]">
                <span>{type === 'pump' ? 'Centrifugal Pump Performance' : 'Centrifugal Compressor'}</span>
                <span className="material-symbols-outlined text-[14px]">settings_input_component</span>
              </div>
              <table className="w-full text-left text-[10px]">
                <tbody className="divide-y divide-[#3d494c]/20">
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Discharge Pressure</td>
                    <td className="py-1 text-right text-[#4cd7f6] font-bold">{equilibrium.operatingPresBar.toFixed(1)} bar</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Shaft Power</td>
                    <td className="py-1 text-right text-[#ffddb8] font-bold">{equilibrium.dutyMW ? (equilibrium.dutyMW * 1000).toFixed(0) : '850'} kW</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Isentropic Efficiency</td>
                    <td className="py-1 text-right text-[#4edea3] font-bold">{equilibrium.efficiencyPct || 82.0} %</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Cavitation Margin (NPSH)</td>
                    <td className="py-1 text-right text-[#4edea3] font-bold">+3.2 m (SAFE)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TYPE 7: CONTROL VALVE ================= */}
        {type === 'valve' && (
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#4cd7f6] font-bold text-[11px]">
                <span>Control Valve Sizing (ISA-75.01)</span>
                <span className="material-symbols-outlined text-[14px]">valve</span>
              </div>
              <table className="w-full text-left text-[10px]">
                <tbody className="divide-y divide-[#3d494c]/20">
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Pressure Drop (ΔP)</td>
                    <td className="py-1 text-right text-[#ffb4ab] font-bold">{Math.abs(equilibrium.pressureDropBar).toFixed(2)} bar</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Required Flow Coeff Cv</td>
                    <td className="py-1 text-right text-[#4edea3] font-bold">142.5 gpm/psi^0.5</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-[#bcc9cd]">Choked Flow Status</td>
                    <td className="py-1 text-right text-[#4edea3]">Subcritical (No Choke)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TYPE 8: CATALYTIC REACTOR (Default tabs) ================= */}
        {type === 'reactor' && activeTab === 'specs' && (
          <>
            {/* Physical Dimensions Card */}
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 flex flex-col gap-1.5 font-mono">
              <div className="flex items-center justify-between text-[11px] text-[#ffb95f]">
                <span>Geometry Parameters</span>
                <span className="material-symbols-outlined text-[14px]">straighten</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="flex flex-col bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397]">Catalyst Volume</span>
                  <span className="text-[#dae2fd] font-bold">{geometry.catalystVolumeM3.toFixed(2)} m³</span>
                </div>
                <div className="flex flex-col bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397]">Internal Diam.</span>
                  <span className="text-[#dae2fd] font-bold">{geometry.internalDiamM.toFixed(2)} m</span>
                </div>
                <div className="flex flex-col bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397]">Bed Voidage (ε)</span>
                  <span className="text-[#dae2fd] font-bold">{geometry.bedVoidage.toFixed(3)}</span>
                </div>
                <div className="flex flex-col bg-[#171f33] p-1 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397]">Bed Height</span>
                  <span className="text-[#dae2fd] font-bold">{geometry.bedHeightM.toFixed(2)} m</span>
                </div>
              </div>
            </div>

            {/* Operating State Table */}
            <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 flex flex-col gap-1.5 font-mono">
              <div className="flex items-center justify-between text-[11px] text-[#4cd7f6]">
                <span>Operational Equilibrium</span>
                <span className="material-symbols-outlined text-[14px]">tune</span>
              </div>

              <table className="w-full text-left text-[10px]">
                <tbody className="divide-y divide-[#3d494c]/20">
                  <tr className="py-1">
                    <td className="py-1 text-[#bcc9cd]">Inlet Temp</td>
                    <td className="py-1 text-right text-[#ffddb8] font-bold cursor-pointer hover:text-white" onClick={() => setEditingField('inletTempC')}>
                      {editingField === 'inletTempC' ? (
                        <input
                          type="number"
                          defaultValue={equilibrium.inletTempC}
                          onBlur={(e) => {
                            onUpdateEquilibrium('inletTempC', parseFloat(e.target.value) || 510);
                            setEditingField(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onUpdateEquilibrium('inletTempC', parseFloat((e.target as HTMLInputElement).value) || 510);
                              setEditingField(null);
                            }
                          }}
                          autoFocus
                          className="w-16 bg-[#131b2e] text-[#4cd7f6] border border-[#4cd7f6] rounded px-1 text-right"
                        />
                      ) : (
                        equilibrium.inletTempC.toFixed(2)
                      )}
                    </td>
                    <td className="py-1 pl-1 text-[#869397]">°C</td>
                  </tr>
                  <tr className="py-1">
                    <td className="py-1 text-[#bcc9cd]">Outlet Temp</td>
                    <td className="py-1 text-right text-[#ffddb8] font-bold">{equilibrium.outletTempC.toFixed(2)}</td>
                    <td className="py-1 pl-1 text-[#869397]">°C</td>
                  </tr>
                  <tr className="py-1">
                    <td className="py-1 text-[#bcc9cd]">Operating Pres.</td>
                    <td className="py-1 text-right text-[#dae2fd]">{equilibrium.operatingPresBar.toFixed(2)}</td>
                    <td className="py-1 pl-1 text-[#869397]">bar</td>
                  </tr>
                  <tr className="py-1">
                    <td className="py-1 text-[#bcc9cd]">Pressure Drop ΔP</td>
                    <td className="py-1 text-right text-[#ffb4ab] font-bold">{equilibrium.pressureDropBar.toFixed(2)}</td>
                    <td className="py-1 pl-1 text-[#869397]">bar</td>
                  </tr>
                  <tr className="py-1">
                    <td className="py-1 text-[#bcc9cd]">LHSV Space Vel.</td>
                    <td className="py-1 text-right text-[#dae2fd]">{equilibrium.lhsvSpaceVelH1.toFixed(2)}</td>
                    <td className="py-1 pl-1 text-[#869397]">h⁻¹</td>
                  </tr>
                  <tr className="py-1">
                    <td className="py-1 text-[#bcc9cd]">H2:HC Treat Ratio</td>
                    <td className="py-1 text-right text-[#4cd7f6] font-bold">{equilibrium.h2hcTreatRatioNm3M3.toFixed(1)}</td>
                    <td className="py-1 pl-1 text-[#869397]">Nm³/m³</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {type === 'reactor' && activeTab === 'kinetics' && (
          <div className="space-y-2 font-mono text-[10px]">
            <div className="text-[#869397] text-[10px] pb-1 uppercase tracking-wider">
              Catalytic Reaction Mechanisms
            </div>
            {kinetics ? (
              kinetics.map((rx) => (
                <div key={rx.id} className="bg-[#060e20] p-2 rounded border border-[#3d494c]/30 space-y-1">
                  <div className="flex items-center justify-between text-[#4cd7f6] font-bold">
                    <span>{rx.name}</span>
                    <span className={`px-1 py-0.2 rounded text-[9px] ${rx.type === 'Endo' ? 'bg-[#ffb95f]/20 text-[#ffb95f]' : 'bg-[#4edea3]/20 text-[#4edea3]'}`}>
                      {rx.type}
                    </span>
                  </div>
                  <div className="text-white text-[11px] font-semibold">{rx.equation}</div>
                  <div className="grid grid-cols-2 gap-1 text-[#869397] text-[9px] pt-1">
                    <div>ΔH_rx: {rx.deltaHKJPerMol} kJ/mol</div>
                    <div>E_act: {rx.activationEnergyKJPerMol} kJ/mol</div>
                    <div>Pre-exp k0: {rx.k0}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-[#869397] text-[10px]">No chemical reactions defined for this unit type.</div>
            )}
          </div>
        )}

        {type === 'reactor' && activeTab === 'catalyst' && (
          <div className="space-y-2 font-mono text-[10px]">
            <div className="text-[#869397] text-[10px] pb-1 uppercase tracking-wider">
              Catalyst Loading &amp; Degradation
            </div>
            {catalyst ? (
              <div className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/30 space-y-2">
                <div>
                  <span className="text-[#869397] block text-[9px]">Catalyst Formulation</span>
                  <span className="text-[#4cd7f6] font-bold text-[11px]">{catalyst.type}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-[#869397] block text-[9px]">Pellet Diameter</span>
                    <span className="text-[#dae2fd]">{catalyst.pelletDiameterMm} mm extrudate</span>
                  </div>
                  <div>
                    <span className="text-[#869397] block text-[9px]">Bulk Density</span>
                    <span className="text-[#dae2fd]">{catalyst.bulkDensityKgM3} kg/m³</span>
                  </div>
                  <div>
                    <span className="text-[#869397] block text-[9px]">BET Surface Area</span>
                    <span className="text-[#dae2fd]">{catalyst.activeSurfaceAreaM2G} m²/g</span>
                  </div>
                  <div>
                    <span className="text-[#869397] block text-[9px]">Coke Deactivation</span>
                    <span className="text-[#ffb4ab]">{(catalyst.deactivationRatePer1000h * 100).toFixed(2)}% / 1000h</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[#869397] text-[10px]">No catalyst packed in this unit operation.</div>
            )}
          </div>
        )}

        {/* Action Control Center */}
        <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-[#3d494c]/30">
          <button
            onClick={onReintegrateOde}
            disabled={isIntegrating}
            className="w-full py-1.5 bg-[#4cd7f6] text-[#003640] font-bold font-mono text-[11px] rounded flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 shadow transition-all"
            type="button"
          >
            <span className={`material-symbols-outlined text-[16px] ${isIntegrating ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isIntegrating ? 'CALCULATING PERFORMANCE...' : 'RE-CALCULATE UNIT OPERATION'}</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onOpenSensitivityCurves}
              className="py-1 bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] font-mono text-[10px] rounded text-center border border-[#3d494c]/30 transition-colors"
              type="button"
            >
              Sens. Curves
            </button>
            <button
              onClick={onExportMatrix}
              className="py-1 bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] font-mono text-[10px] rounded text-center border border-[#3d494c]/30 transition-colors"
              type="button"
            >
              Export Matrix
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
