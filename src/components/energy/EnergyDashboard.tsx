import React from 'react';
import { CompleteEnergyAssessment } from '../../engine/energy/energyEngine';

interface EnergyDashboardProps {
  assessment: CompleteEnergyAssessment;
  onSelectUnit?: (unitId: string) => void;
  ambientTempC: number;
  onChangeAmbientTemp: (temp: number) => void;
  insulationCondition: 'Good' | 'Average' | 'Degraded';
  onChangeInsulation: (condition: 'Good' | 'Average' | 'Degraded') => void;
}

export const EnergyDashboard: React.FC<EnergyDashboardProps> = ({
  assessment,
  onSelectUnit,
  ambientTempC,
  onChangeAmbientTemp,
  insulationCondition,
  onChangeInsulation,
}) => {
  const { summary, equipmentRanking, heatLoss } = assessment;

  return (
    <div className="space-y-5">
      {/* 1. Executive Energy KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Heating Duty */}
        <div className="bg-[#171f33] border border-[#3d494c]/40 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#869397] uppercase tracking-wider">Total Heating Duty</span>
            <span className="material-symbols-outlined text-[#ffb95f] text-[18px]">local_fire_department</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#ffddb8]">{summary.heatingDutyMW}</span>
            <span className="text-[11px] font-mono text-[#869397]">MW</span>
          </div>
          <div className="mt-1 text-[10px] text-[#869397] flex justify-between">
            <span>Furnace: {summary.furnaceDutyMW} MW</span>
            <span>Reb: {summary.reboilerDutyMW} MW</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffb95f]/40" />
        </div>

        {/* Total Cooling Duty */}
        <div className="bg-[#171f33] border border-[#3d494c]/40 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#869397] uppercase tracking-wider">Total Cooling Duty</span>
            <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">ac_unit</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#4cd7f6]">{summary.coolingDutyMW}</span>
            <span className="text-[11px] font-mono text-[#869397]">MW</span>
          </div>
          <div className="mt-1 text-[10px] text-[#869397] flex justify-between">
            <span>Condenser: {summary.condenserDutyMW} MW</span>
            <span>Cooler: {(summary.coolingDutyMW - summary.condenserDutyMW).toFixed(1)} MW</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4cd7f6]/40" />
        </div>

        {/* Electrical Power */}
        <div className="bg-[#171f33] border border-[#3d494c]/40 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#869397] uppercase tracking-wider">Electrical Power</span>
            <span className="material-symbols-outlined text-[#ffdbcd] text-[18px]">bolt</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#ffb4ab]">{summary.electricalPowerMW}</span>
            <span className="text-[11px] font-mono text-[#869397]">MW</span>
          </div>
          <div className="mt-1 text-[10px] text-[#869397] flex justify-between">
            <span>Pumps: {summary.pumpPowerMW} MW</span>
            <span>Comp: {summary.compressorPowerMW} MW</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffb4ab]/40" />
        </div>

        {/* Net Operating Cost */}
        <div className="bg-[#171f33] border border-[#3d494c]/40 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#869397] uppercase tracking-wider">Energy OpEx Rate</span>
            <span className="material-symbols-outlined text-[#4edea3] text-[18px]">payments</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#4edea3]">${summary.hourlyEnergyCost}</span>
            <span className="text-[11px] font-mono text-[#869397]">/h</span>
          </div>
          <div className="mt-1 text-[10px] text-[#869397]">
            <span>${(summary.annualEnergyCost / 1_000_000).toFixed(2)}M / year (8,000h)</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4edea3]/40" />
        </div>

        {/* Specific Energy Intensity */}
        <div className="bg-[#171f33] border border-[#3d494c]/40 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#869397] uppercase tracking-wider">Energy Intensity</span>
            <span className="material-symbols-outlined text-[#a0c8d7] text-[18px]">speed</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#dae2fd]">{summary.energyIntensityGjPerTonProduct}</span>
            <span className="text-[11px] font-mono text-[#869397]">GJ/t</span>
          </div>
          <div className="mt-1 text-[10px] text-[#869397]">
            <span>{summary.energyIntensityKwhPerBblProduct} kWh/bbl reformate</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#a0c8d7]/40" />
        </div>

        {/* Process Heat Losses */}
        <div className="bg-[#171f33] border border-[#3d494c]/40 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#869397] uppercase tracking-wider">Total Heat Loss</span>
            <span className="material-symbols-outlined text-[#ff8077] text-[18px]">heat_pump</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#ff8077]">{heatLoss.totalHeatLossMW}</span>
            <span className="text-[11px] font-mono text-[#869397]">MW</span>
          </div>
          <div className="mt-1 text-[10px] text-[#869397]">
            <span>{heatLoss.lossPercentageOfPrimaryEnergy}% of primary input</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff8077]/40" />
        </div>
      </div>

      {/* 2. Detailed Balance Breakdown & Heat Loss Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Thermal Balance Breakdown */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[16px]">balance</span>
                Plant Thermal Balance Summary
              </h3>
              <span className="text-[10px] font-mono text-[#4edea3]">CONVERGED</span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ffb95f]" />
                  Fired Furnace Charge (F-101)
                </span>
                <span className="font-mono text-[#ffddb8] font-medium">{summary.furnaceDutyMW} MW</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ff9955]" />
                  Column Reboiler Duty (C-101 Reb)
                </span>
                <span className="font-mono text-[#ffddb8] font-medium">{summary.reboilerDutyMW} MW</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ffc47f]" />
                  Exchanger Preheaters (Steam / Process)
                </span>
                <span className="font-mono text-[#ffddb8] font-medium">
                  {(summary.heatingDutyMW - summary.furnaceDutyMW - summary.reboilerDutyMW).toFixed(2)} MW
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20 bg-[#171f33]/60 px-1 rounded">
                <span className="text-[#dae2fd] font-semibold">Total Gross Heating Demand</span>
                <span className="font-mono text-[#ffb95f] font-bold">{summary.heatingDutyMW} MW</span>
              </div>

              <div className="pt-2" />

              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#4cd7f6]" />
                  Column Overhead Condenser (C-101)
                </span>
                <span className="font-mono text-[#a0c8d7] font-medium">{summary.condenserDutyMW} MW</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#70b0cc]" />
                  Product Trim Coolers
                </span>
                <span className="font-mono text-[#a0c8d7] font-medium">
                  {(summary.coolingDutyMW - summary.condenserDutyMW).toFixed(2)} MW
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20 bg-[#171f33]/60 px-1 rounded">
                <span className="text-[#dae2fd] font-semibold">Total Cooling Utility Demand</span>
                <span className="font-mono text-[#4cd7f6] font-bold">{summary.coolingDutyMW} MW</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 bg-[#0b1326] rounded border border-[#3d494c]/30 text-[11px] text-[#869397] space-y-1">
            <div className="flex justify-between">
              <span>Feed Processing Rate:</span>
              <span className="font-mono text-[#dae2fd]">{summary.feedThroughputKgH.toLocaleString()} kg/h</span>
            </div>
            <div className="flex justify-between">
              <span>Finished Reformate Product:</span>
              <span className="font-mono text-[#dae2fd]">{summary.productThroughputKgH.toLocaleString()} kg/h</span>
            </div>
          </div>
        </div>

        {/* Electrical & Rotating Equipment Power Balance */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ffb4ab] text-[16px]">electric_meter</span>
                Electrical Power Distribution
              </h3>
              <span className="text-[10px] font-mono text-[#ffb4ab]">3-PHASE 4160V/480V</span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ff8077]" />
                  Recycle Gas Compressor (K-101)
                </span>
                <span className="font-mono text-[#ffb4ab] font-medium">
                  {summary.compressorPowerMW} MW ({(summary.compressorPowerMW * 1000).toFixed(0)} kW)
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ffb95f]" />
                  Charge & Booster Pumps (P-101/P-102)
                </span>
                <span className="font-mono text-[#ffb4ab] font-medium">
                  {summary.pumpPowerMW} MW ({(summary.pumpPowerMW * 1000).toFixed(0)} kW)
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20 bg-[#171f33]/60 px-1 rounded">
                <span className="text-[#dae2fd] font-semibold">Total Electric Power Load</span>
                <span className="font-mono text-[#ffb4ab] font-bold">{summary.electricalPowerMW} MW</span>
              </div>
            </div>

            {/* Power Visual Distribution Bar */}
            <div className="mt-4">
              <div className="text-[11px] text-[#869397] mb-1 flex justify-between">
                <span>Power Allocation</span>
                <span>Compressor: 87% | Pumps: 13%</span>
              </div>
              <div className="h-3 w-full bg-[#0b1326] rounded-full overflow-hidden flex">
                <div className="h-full bg-[#ff8077]" style={{ width: '87%' }} title="Compressors 87%" />
                <div className="h-full bg-[#ffb95f]" style={{ width: '13%' }} title="Pumps 13%" />
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 bg-[#0b1326] rounded border border-[#3d494c]/30 text-[11px] text-[#869397] space-y-1">
            <div className="flex justify-between">
              <span>Grid Tariffs Applied:</span>
              <span className="font-mono text-[#dae2fd]">$85.00 / MWh ($0.085/kWh)</span>
            </div>
            <div className="flex justify-between">
              <span>Electricity Cost Rate:</span>
              <span className="font-mono text-[#ffb4ab]">
                ${(summary.electricalPowerMW * 1000 * 0.085).toFixed(2)}/h
              </span>
            </div>
          </div>
        </div>

        {/* Heat Loss Analysis & Insulation Audit */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ff8077] text-[16px]">thermostat</span>
                Heat-Loss & Insulation Audit
              </h3>
              <span className="text-[10px] font-mono text-[#ffddb8]">API 560</span>
            </div>

            {/* Ambient & Condition Controls */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10.5px] text-[#869397] block mb-0.5">Ambient Temp (°C)</label>
                <input
                  type="number"
                  value={ambientTempC}
                  onChange={(e) => onChangeAmbientTemp(parseFloat(e.target.value) || 25)}
                  className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2 py-1 font-mono text-xs text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                />
              </div>

              <div>
                <label className="text-[10.5px] text-[#869397] block mb-0.5">Insulation Quality</label>
                <select
                  value={insulationCondition}
                  onChange={(e) => onChangeInsulation(e.target.value as any)}
                  className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2 py-1 font-mono text-xs text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                >
                  <option value="Good">Good (Refurbished)</option>
                  <option value="Average">Average (Nominal)</option>
                  <option value="Degraded">Degraded (Damaged)</option>
                </select>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between py-0.5 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd]">Furnace Thermal Eff.</span>
                <span className="font-mono text-[#4edea3] font-medium">{heatLoss.furnaceThermalEfficiencyPct}%</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd]">Furnace Stack Loss</span>
                <span className="font-mono text-[#ffddb8]">{heatLoss.furnaceStackLossMW} MW</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd]">Casing Radiation</span>
                <span className="font-mono text-[#ffddb8]">{heatLoss.furnaceRadiantLossMW} MW</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#3d494c]/20">
                <span className="text-[#bcc9cd]">Vessel/Piping Losses</span>
                <span className="font-mono text-[#ffddb8]">
                  {(heatLoss.equipmentSurfaceConvectionRadiationMW + heatLoss.pipingConvectionRadiationLossMW).toFixed(2)} MW
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 bg-[#0b1326] rounded border border-[#3d494c]/30 text-[11px] text-[#869397] space-y-1">
            <div className="flex justify-between text-[#ffb4ab]">
              <span>Annual Cost of Dissipated Heat:</span>
              <span className="font-mono font-bold">${heatLoss.annualCostOfLossesUSD.toLocaleString()}/yr</span>
            </div>
            <div className="flex justify-between text-[#4edea3]">
              <span>Potential Insulation Upgrade Saving:</span>
              <span className="font-mono font-medium">{heatLoss.potentialInsulationRecoveryMW} MW</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Equipment Duty Ranking Table */}
      <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">format_list_numbered</span>
              Equipment Thermal & Power Ranking (Largest Consumers)
            </h3>
            <p className="text-[11px] text-[#869397] mt-0.5">
              Ranked descending by absolute continuous duty load across thermal and electrical services.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#bcc9cd]">
            {equipmentRanking.length} Active Unit Operations
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#3d494c]/40 text-[#869397] text-[10.5px] uppercase">
                <th className="py-1.5 px-2">Rank</th>
                <th className="py-1.5 px-2">Tag</th>
                <th className="py-1.5 px-2">Name</th>
                <th className="py-1.5 px-2">Type</th>
                <th className="py-1.5 px-2 text-right">Duty (MW)</th>
                <th className="py-1.5 px-2 text-right">Plant Share</th>
                <th className="py-1.5 px-2">Assigned Utility</th>
                <th className="py-1.5 px-2 text-right">Utility Flow</th>
                <th className="py-1.5 px-2 text-right">Cost Rate ($/h)</th>
                <th className="py-1.5 px-2 text-right">CO2 (kg/h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d494c]/20">
              {equipmentRanking.map((item, idx) => (
                <tr
                  key={item.unitId}
                  className="hover:bg-[#171f33] transition-colors cursor-pointer"
                  onClick={() => onSelectUnit && onSelectUnit(item.unitId.split('-')[0])}
                >
                  <td className="py-2 px-2 text-[#869397]">{idx + 1}</td>
                  <td className="py-2 px-2 font-bold text-[#4cd7f6]">{item.unitTag}</td>
                  <td className="py-2 px-2 text-[#dae2fd]">{item.unitName}</td>
                  <td className="py-2 px-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans ${
                        item.category === 'heating'
                          ? 'bg-[#ffb95f]/20 text-[#ffddb8]'
                          : item.category === 'cooling'
                          ? 'bg-[#4cd7f6]/20 text-[#4cd7f6]'
                          : 'bg-[#ffb4ab]/20 text-[#ffb4ab]'
                      }`}
                    >
                      {item.category.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-[#dae2fd]">
                    {item.dutyMW.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[11px] text-[#bcc9cd]">{item.percentageOfPlantTotal}%</span>
                      <div className="w-12 h-1.5 bg-[#0b1326] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            item.category === 'heating'
                              ? 'bg-[#ffb95f]'
                              : item.category === 'cooling'
                              ? 'bg-[#4cd7f6]'
                              : 'bg-[#ffb4ab]'
                          }`}
                          style={{ width: `${Math.min(100, item.percentageOfPlantTotal * 2.5)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-[#bcc9cd]">{item.assignedUtilityName}</td>
                  <td className="py-2 px-2 text-right text-[#bcc9cd]">
                    {item.utilityRate.toFixed(1)} {item.utilityRateUnit}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold text-[#4edea3]">
                    ${item.costPerHour.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right text-[#ffb4ab]">
                    {Math.round(item.co2EmissionsKgH).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
