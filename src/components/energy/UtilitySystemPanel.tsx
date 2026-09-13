import React, { useState } from 'react';
import { UtilityDefinition } from '../../types/energy';

interface UtilitySystemPanelProps {
  utilities: UtilityDefinition[];
  onUpdateUtility: (updated: UtilityDefinition) => void;
  onResetUtilities: () => void;
}

export const UtilitySystemPanel: React.FC<UtilitySystemPanelProps> = ({
  utilities,
  onUpdateUtility,
  onResetUtilities,
}) => {
  const [editingUtility, setEditingUtility] = useState<UtilityDefinition | null>(null);

  const totalHourlyCost = utilities.reduce((sum, u) => sum + u.costPerHour, 0);
  const totalAnnualCost = totalHourlyCost * 8000;

  const handleSaveEdit = () => {
    if (editingUtility) {
      onUpdateUtility(editingUtility);
      setEditingUtility(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">factory</span>
            Plant Utility Distribution Network & Tariffs
          </h2>
          <p className="text-xs text-[#869397] mt-0.5">
            Configure utility stream supply/return operating conditions, thermal capacities, tariff rates, and monitor real-time flowsheet draw.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#171f33] px-3 py-1.5 rounded border border-[#3d494c]/40 text-right">
            <div className="text-[10px] text-[#869397] uppercase">Total Utility Cost</div>
            <div className="text-sm font-mono font-bold text-[#4edea3]">
              ${totalHourlyCost.toFixed(2)}/h <span className="text-[10px] text-[#869397]">(${(totalAnnualCost / 1e6).toFixed(2)}M/yr)</span>
            </div>
          </div>

          <button
            onClick={onResetUtilities}
            className="px-3 py-1.5 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/50 text-[#dae2fd] text-xs font-mono rounded flex items-center gap-1.5 transition-colors"
            title="Revert all utility streams to default industrial benchmark values"
          >
            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Utilities Table */}
      <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#3d494c]/40 text-[#869397] text-[10.5px] uppercase">
                <th className="py-2 px-3">Utility Name</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3 text-right">Supply / Return</th>
                <th className="py-2 px-3 text-right">Pressure</th>
                <th className="py-2 px-3 text-right">Enthalpy / Cp</th>
                <th className="py-2 px-3 text-right">Unit Tariff</th>
                <th className="py-2 px-3 text-right">Current Consumption</th>
                <th className="py-2 px-3 text-right">Cost Rate ($/h)</th>
                <th className="py-2 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d494c]/20">
              {utilities.map((u) => (
                <tr key={u.id} className="hover:bg-[#171f33] transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-[#dae2fd] flex items-center gap-1.5">
                      <span
                        className={`material-symbols-outlined text-[15px] ${
                          u.category === 'cooling'
                            ? 'text-[#4cd7f6]'
                            : u.category === 'heating'
                            ? 'text-[#ffb95f]'
                            : u.category === 'fuel'
                            ? 'text-[#ff9955]'
                            : 'text-[#ffb4ab]'
                        }`}
                      >
                        {u.category === 'cooling'
                          ? 'ac_unit'
                          : u.category === 'heating'
                          ? 'local_fire_department'
                          : u.category === 'fuel'
                          ? 'gas_meter'
                          : 'bolt'}
                      </span>
                      {u.name}
                    </div>
                    <div className="text-[10px] text-[#869397] font-sans mt-0.5">{u.description}</div>
                  </td>

                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans uppercase font-medium ${
                        u.category === 'cooling'
                          ? 'bg-[#4cd7f6]/20 text-[#4cd7f6]'
                          : u.category === 'heating'
                          ? 'bg-[#ffb95f]/20 text-[#ffddb8]'
                          : u.category === 'fuel'
                          ? 'bg-[#ff9955]/20 text-[#ff9955]'
                          : 'bg-[#ffb4ab]/20 text-[#ffb4ab]'
                      }`}
                    >
                      {u.category}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono text-[#dae2fd]">
                    {u.supplyTempC}°C &rarr; {u.returnTempC}°C
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono text-[#bcc9cd]">
                    {u.pressureBar} bar
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono text-[#bcc9cd]">
                    {u.enthalpyOrCpValue} {u.enthalpyOrCpUnit}
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#ffddb8]">
                    ${u.unitCost} / {u.costUnit}
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#dae2fd]">
                    {u.consumptionRate.toLocaleString()} {u.consumptionUnit}
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#4edea3]">
                    ${u.costPerHour.toFixed(2)}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => setEditingUtility({ ...u })}
                      className="px-2 py-1 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/40 text-[#4cd7f6] rounded text-[11px] font-sans flex items-center gap-1 mx-auto transition-colors"
                      title="Edit operating conditions, cost, or emission factors"
                    >
                      <span className="material-symbols-outlined text-[13px]">tune</span>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Utility Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Steam Network Summary */}
        <div className="bg-[#171f33] border border-[#3d494c]/30 rounded p-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#ffb95f] font-semibold uppercase text-[11px] mb-2">
            <span className="material-symbols-outlined text-[16px]">water_drop</span>
            Steam Headers (HP / MP / LP)
          </div>
          <div className="space-y-1 text-[#bcc9cd]">
            <div className="flex justify-between">
              <span>HP Steam (40 bar):</span>
              <span className="font-mono text-[#dae2fd]">
                {utilities.find((u) => u.type === 'hp_steam')?.consumptionRate ?? 0} ton/h
              </span>
            </div>
            <div className="flex justify-between">
              <span>MP Steam (15 bar):</span>
              <span className="font-mono text-[#dae2fd]">
                {utilities.find((u) => u.type === 'mp_steam')?.consumptionRate ?? 0} ton/h
              </span>
            </div>
            <div className="flex justify-between">
              <span>LP Steam (3.5 bar):</span>
              <span className="font-mono text-[#dae2fd]">
                {utilities.find((u) => u.type === 'lp_steam')?.consumptionRate ?? 0} ton/h
              </span>
            </div>
          </div>
        </div>

        {/* Cooling Water Network */}
        <div className="bg-[#171f33] border border-[#3d494c]/30 rounded p-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#4cd7f6] font-semibold uppercase text-[11px] mb-2">
            <span className="material-symbols-outlined text-[16px]">cyclone</span>
            Cooling Tower Circulation
          </div>
          <div className="space-y-1 text-[#bcc9cd]">
            <div className="flex justify-between">
              <span>CW Circulation:</span>
              <span className="font-mono text-[#dae2fd]">
                {utilities.find((u) => u.type === 'cooling_water')?.consumptionRate ?? 0} m³/h
              </span>
            </div>
            <div className="flex justify-between">
              <span>Supply / Return:</span>
              <span className="font-mono text-[#dae2fd]">25°C &rarr; 35°C (ΔT=10°C)</span>
            </div>
            <div className="flex justify-between">
              <span>Pumping Cost:</span>
              <span className="font-mono text-[#4edea3]">
                ${utilities.find((u) => u.type === 'cooling_water')?.costPerHour.toFixed(2) ?? 0}/h
              </span>
            </div>
          </div>
        </div>

        {/* Fired Fuel Gas System */}
        <div className="bg-[#171f33] border border-[#3d494c]/30 rounded p-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#ff9955] font-semibold uppercase text-[11px] mb-2">
            <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
            Refinery Fuel Gas (RFG)
          </div>
          <div className="space-y-1 text-[#bcc9cd]">
            <div className="flex justify-between">
              <span>Firing Rate:</span>
              <span className="font-mono text-[#dae2fd]">
                {utilities.find((u) => u.type === 'fuel_gas')?.consumptionRate ?? 0} kg/h
              </span>
            </div>
            <div className="flex justify-between">
              <span>Lower Heating Value:</span>
              <span className="font-mono text-[#dae2fd]">48.5 MJ/kg</span>
            </div>
            <div className="flex justify-between">
              <span>Hourly Fuel Expense:</span>
              <span className="font-mono text-[#4edea3]">
                ${utilities.find((u) => u.type === 'fuel_gas')?.costPerHour.toFixed(2) ?? 0}/h
              </span>
            </div>
          </div>
        </div>

        {/* Electrical Grid Draw */}
        <div className="bg-[#171f33] border border-[#3d494c]/30 rounded p-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#ffb4ab] font-semibold uppercase text-[11px] mb-2">
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            Electric Motor Drives
          </div>
          <div className="space-y-1 text-[#bcc9cd]">
            <div className="flex justify-between">
              <span>Substation Load:</span>
              <span className="font-mono text-[#dae2fd]">
                {utilities.find((u) => u.type === 'electricity')?.consumptionRate ?? 0} kW
              </span>
            </div>
            <div className="flex justify-between">
              <span>Power Tariff:</span>
              <span className="font-mono text-[#dae2fd]">$85.00 / MWh</span>
            </div>
            <div className="flex justify-between">
              <span>Hourly Power Bill:</span>
              <span className="font-mono text-[#4edea3]">
                ${utilities.find((u) => u.type === 'electricity')?.costPerHour.toFixed(2) ?? 0}/h
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Utility Modal */}
      {editingUtility && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-[#3d494c] rounded-lg max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/40">
              <h3 className="text-sm font-semibold text-[#dae2fd] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">tune</span>
                Edit Utility: {editingUtility.name}
              </h3>
              <button
                onClick={() => setEditingUtility(null)}
                className="text-[#869397] hover:text-[#dae2fd] text-xs font-mono"
              >
                &times; Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">Supply Temperature (°C)</label>
                  <input
                    type="number"
                    value={editingUtility.supplyTempC}
                    onChange={(e) =>
                      setEditingUtility({ ...editingUtility, supplyTempC: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">Return Temperature (°C)</label>
                  <input
                    type="number"
                    value={editingUtility.returnTempC}
                    onChange={(e) =>
                      setEditingUtility({ ...editingUtility, returnTempC: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">Operating Pressure (bar)</label>
                  <input
                    type="number"
                    value={editingUtility.pressureBar}
                    onChange={(e) =>
                      setEditingUtility({ ...editingUtility, pressureBar: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">
                    Enthalpy / Cp ({editingUtility.enthalpyOrCpUnit})
                  </label>
                  <input
                    type="number"
                    value={editingUtility.enthalpyOrCpValue}
                    onChange={(e) =>
                      setEditingUtility({ ...editingUtility, enthalpyOrCpValue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">
                    Tariff Rate ($ / {editingUtility.costUnit})
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editingUtility.unitCost}
                    onChange={(e) =>
                      setEditingUtility({ ...editingUtility, unitCost: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#4edea3] font-bold focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">Tariff Unit Designation</label>
                  <input
                    type="text"
                    value={editingUtility.costUnit}
                    onChange={(e) =>
                      setEditingUtility({ ...editingUtility, costUnit: e.target.value })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#3d494c]/30">
                <label className="text-[11px] text-[#869397] block mb-1">Stream Notes & Specification</label>
                <textarea
                  value={editingUtility.description}
                  onChange={(e) =>
                    setEditingUtility({ ...editingUtility, description: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 text-xs text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#3d494c]/30">
              <button
                onClick={() => setEditingUtility(null)}
                className="px-3 py-1.5 bg-transparent hover:bg-[#171f33] text-[#bcc9cd] text-xs font-mono rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-[#4cd7f6] hover:bg-[#38bde6] text-[#003640] font-semibold text-xs font-mono rounded flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">check</span>
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
