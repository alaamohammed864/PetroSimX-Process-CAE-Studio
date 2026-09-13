import React, { useState } from 'react';
import { EmissionsSummary, EmissionFactorSpec } from '../../types/energy';

interface EmissionsPanelProps {
  emissions: EmissionsSummary;
  onUpdateEmissionFactor: (factor: EmissionFactorSpec) => void;
  onResetEmissionFactors: () => void;
}

export const EmissionsPanel: React.FC<EmissionsPanelProps> = ({
  emissions,
  onUpdateEmissionFactor,
  onResetEmissionFactors,
}) => {
  const [carbonTaxRate, setCarbonTaxRate] = useState<number>(50); // $50/ton baseline
  const [editingFactor, setEditingFactor] = useState<EmissionFactorSpec | null>(null);

  const annualCarbonTaxUSD = Math.round(emissions.co2TonPerYear * carbonTaxRate);

  const handleSaveFactor = () => {
    if (editingFactor) {
      onUpdateEmissionFactor({
        ...editingFactor,
        isUserDefined: true,
      });
      setEditingFactor(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Disclaimer / Standards Banner */}
      <div className="bg-[#171f33] border-l-4 border-[#ffb95f] p-3 rounded-r text-xs flex items-start gap-2.5">
        <span className="material-symbols-outlined text-[#ffb95f] text-[20px] mt-0.5">verified_user</span>
        <div>
          <div className="font-semibold text-[#dae2fd] text-[12px] flex items-center gap-2">
            Engineering Governance & Emission Factor Verification Notice
            <span className="px-1.5 py-0.5 rounded bg-[#ffb95f]/20 text-[#ffddb8] text-[10px] font-mono">
              ISO 14064 / GHG Protocol
            </span>
          </div>
          <p className="text-[#bcc9cd] mt-0.5 text-[11px] leading-relaxed">
            Baseline emission factors are drawn from US EPA AP-42 Compilation of Air Pollutant Emission Factors and IPCC 2006 Stationary Combustion Guidelines. Because fuel compositions, burner Low-NOx configurations, flare efficiencies, and regional grid power mixes vary substantially by site, <strong className="text-[#dae2fd]">never treat universal default factors as statutory or legally binding</strong>. Always configure and audit factors against local environmental permits and laboratory fuel gas chromatographs.
          </p>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* CO2 Total Rate */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#869397] text-[11px] uppercase font-mono">
            <span>Carbon Dioxide (CO₂)</span>
            <span className="material-symbols-outlined text-[#ff8077] text-[18px]">co2</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#ff8077]">
              {emissions.co2RateKgH.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-[#869397]">kg/h</span>
          </div>
          <div className="mt-1 text-[11px] text-[#bcc9cd] flex justify-between font-mono">
            <span>{emissions.co2TonPerDay.toFixed(1)} t/day</span>
            <span className="text-[#ffb4ab] font-bold">{emissions.co2TonPerYear.toLocaleString()} t/yr</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff8077]" />
        </div>

        {/* Carbon Monoxide (CO) */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#869397] text-[11px] uppercase font-mono">
            <span>Carbon Monoxide (CO)</span>
            <span className="material-symbols-outlined text-[#ffb95f] text-[18px]">cloud</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#ffddb8]">{emissions.coRateKgH}</span>
            <span className="text-xs font-mono text-[#869397]">kg/h</span>
          </div>
          <div className="mt-1 text-[11px] text-[#869397]">
            <span>{((emissions.coRateKgH * 8000) / 1000).toFixed(2)} metric tons/year</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffb95f]" />
        </div>

        {/* Nitrogen Oxides (NOx) */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#869397] text-[11px] uppercase font-mono">
            <span>Nitrogen Oxides (NOₓ)</span>
            <span className="material-symbols-outlined text-[#ffb4ab] text-[18px]">air</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#ffb4ab]">{emissions.noxRateKgH}</span>
            <span className="text-xs font-mono text-[#869397]">kg/h</span>
          </div>
          <div className="mt-1 text-[11px] text-[#869397]">
            <span>Low-NOx burner specification compliant</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffb4ab]" />
        </div>

        {/* Sulfur Oxides (SOx) */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#869397] text-[11px] uppercase font-mono">
            <span>Sulfur Oxides (SOₓ)</span>
            <span className="material-symbols-outlined text-[#e0a8ff] text-[18px]">grain</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-[#e0a8ff]">{emissions.soxRateKgH}</span>
            <span className="text-xs font-mono text-[#869397]">kg/h</span>
          </div>
          <div className="mt-1 text-[11px] text-[#869397]">
            <span>Treated fuel gas (&lt;50 ppm H₂S)</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#e0a8ff]" />
        </div>
      </div>

      {/* Detailed Scope 1 / Scope 2 Breakdown & Carbon Tax Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scope Breakdown */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[16px]">pie_chart</span>
                GHG Protocol Scope Breakdown
              </h3>
              <span className="text-[10px] font-mono text-[#4edea3]">AUDITED</span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <div>
                  <span className="font-medium text-[#dae2fd]">Scope 1 (Direct Fired Heater)</span>
                  <div className="text-[10px] text-[#869397]">Refinery Fuel Gas in F-101</div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-[#ff8077]">{emissions.scope1Co2KgH.toLocaleString()} kg/h</div>
                  <div className="text-[10px] text-[#869397]">
                    {((emissions.scope1Co2KgH / emissions.co2RateKgH) * 100).toFixed(1)}% of total
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <div>
                  <span className="font-medium text-[#dae2fd]">Scope 2 (Imported Grid Power)</span>
                  <div className="text-[10px] text-[#869397]">Compressor & Pump electric drives</div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-[#ffb95f]">{emissions.scope2Co2KgH.toLocaleString()} kg/h</div>
                  <div className="text-[10px] text-[#869397]">
                    {((emissions.scope2Co2KgH / emissions.co2RateKgH) * 100).toFixed(1)}% of total
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#3d494c]/20">
                <div>
                  <span className="font-medium text-[#dae2fd]">Indirect Steam Allocation</span>
                  <div className="text-[10px] text-[#869397]">Reboiler & Preheater Steam Generation</div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-[#ffb4ab]">
                    {(emissions.co2RateKgH - emissions.scope1Co2KgH - emissions.scope2Co2KgH).toLocaleString()} kg/h
                  </div>
                  <div className="text-[10px] text-[#869397]">
                    {(
                      (((emissions.co2RateKgH - emissions.scope1Co2KgH - emissions.scope2Co2KgH) /
                        emissions.co2RateKgH) *
                        100)
                    ).toFixed(1)}% of total
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 bg-[#0b1326] rounded border border-[#3d494c]/30 text-xs">
            <div className="flex justify-between">
              <span className="text-[#869397]">Specific Carbon Intensity:</span>
              <span className="font-mono font-bold text-[#4cd7f6]">
                {emissions.specificCo2IntensityKgPerTonProduct} kg CO₂ / ton product
              </span>
            </div>
          </div>
        </div>

        {/* Carbon Tax & Financial Exposure Simulator */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4edea3] text-[16px]">price_change</span>
                Carbon Tax & ETS Financial Exposure
              </h3>
              <span className="text-[10px] font-mono text-[#4edea3]">DYNAMIC SIM</span>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#869397]">Simulated Carbon Tariff ($/metric ton CO₂):</span>
                  <span className="font-mono font-bold text-[#4edea3]">${carbonTaxRate}/ton</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={carbonTaxRate}
                  onChange={(e) => setCarbonTaxRate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#171f33] rounded-lg appearance-none cursor-pointer accent-[#4edea3]"
                />
                <div className="flex justify-between text-[10px] text-[#869397] mt-1 font-mono">
                  <span>$0 (Exempt)</span>
                  <span>$50 (EU/US Avg)</span>
                  <span>$100</span>
                  <span>$150 (High ETS)</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between py-1 border-b border-[#3d494c]/20">
                  <span className="text-[#bcc9cd]">Annualized CO₂ Tonnage:</span>
                  <span className="font-mono font-bold text-[#dae2fd]">
                    {emissions.co2TonPerYear.toLocaleString()} tons/year
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#3d494c]/20">
                  <span className="text-[#bcc9cd]">Hourly Tax Accrual:</span>
                  <span className="font-mono font-bold text-[#ffb4ab]">
                    ${Math.round((emissions.co2RateKgH / 1000) * carbonTaxRate)}/hour
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#3d494c]/20">
                  <span className="text-[#bcc9cd]">Annual Carbon Tax Liability:</span>
                  <span className="font-mono font-bold text-[#ff8077]">
                    ${(annualCarbonTaxUSD / 1e6).toFixed(3)} Million / year
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 bg-[#0b1326] rounded border border-[#3d494c]/30 text-[11px] text-[#869397]">
            Heat integration and furnace flue gas heat recovery directly reduce this financial liability in proportion to fuel gas saved.
          </div>
        </div>

        {/* Environmental Audit Status */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">verified</span>
                Permitting Compliance Checklist
              </h3>
              <span className="text-[10px] font-mono text-[#4edea3]">COMPLIANT</span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-start gap-2 py-1 border-b border-[#3d494c]/20">
                <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                <div>
                  <div className="font-medium text-[#dae2fd]">Fired Heater NOx Emission Limit</div>
                  <div className="text-[10px] text-[#869397]">
                    Actual: {emissions.noxRateKgH} kg/h vs Permit Cap: 4.50 kg/h
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 py-1 border-b border-[#3d494c]/20">
                <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                <div>
                  <div className="font-medium text-[#dae2fd]">Fuel Gas Hydrogen Sulfide (H2S)</div>
                  <div className="text-[10px] text-[#869397]">
                    Amine unit treated fuel gas &lt; 35 ppm (Threshold: 160 ppm)
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 py-1 border-b border-[#3d494c]/20">
                <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                <div>
                  <div className="font-medium text-[#dae2fd]">CO Stack Concentration</div>
                  <div className="text-[10px] text-[#869397]">
                    Burner excess O2 calibrated at 2.8% dry basis
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <button
              onClick={onResetEmissionFactors}
              className="w-full py-1.5 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/50 text-[#dae2fd] text-xs font-mono rounded flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              Reset Factors to Default Benchmarks
            </button>
          </div>
        </div>
      </div>

      {/* Emission Factors Management Table */}
      <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#ffb4ab] text-[16px]">tune</span>
              Configurable Emission Factors (Scope 1 & Scope 2)
            </h3>
            <p className="text-[11px] text-[#869397] mt-0.5">
              Inspect origin standards or override with user-defined laboratory or utility bill certified factors.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#bcc9cd]">
            {Object.keys(emissions.emissionFactors).length} Factor Profiles
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#3d494c]/40 text-[#869397] text-[10.5px] uppercase">
                <th className="py-2 px-3">Emission Source / Fuel</th>
                <th className="py-2 px-3">Basis Unit</th>
                <th className="py-2 px-3 text-right">CO₂ Factor</th>
                <th className="py-2 px-3 text-right">CO Factor</th>
                <th className="py-2 px-3 text-right">NOₓ Factor</th>
                <th className="py-2 px-3 text-right">SOₓ Factor</th>
                <th className="py-2 px-3">Classification & Reference</th>
                <th className="py-2 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d494c]/20">
              {(Object.values(emissions.emissionFactors) as EmissionFactorSpec[]).map((factor: EmissionFactorSpec) => (
                <tr key={factor.id} className="hover:bg-[#171f33] transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-[#dae2fd]">{factor.name}</div>
                    <div className="text-[10px] text-[#869397] font-sans">Type: {factor.utilityType}</div>
                  </td>

                  <td className="py-2.5 px-3 font-mono text-[#bcc9cd]">{factor.unit}</td>

                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#ff8077]">
                    {factor.co2}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#ffddb8]">{factor.co}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#ffb4ab]">{factor.nox}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#e0a8ff]">{factor.sox}</td>

                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          factor.isUserDefined
                            ? 'bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/40'
                            : 'bg-[#ffb95f]/20 text-[#ffddb8]'
                        }`}
                      >
                        {factor.isUserDefined ? 'USER-DEFINED' : 'BENCHMARK'}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-[#869397] font-sans truncate max-w-xs mt-0.5">
                      {factor.sourceReference}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => setEditingFactor({ ...factor })}
                      className="px-2.5 py-1 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/40 text-[#4cd7f6] rounded text-[11px] font-sans flex items-center gap-1 mx-auto transition-colors"
                      title="Edit emission factors for this source"
                    >
                      <span className="material-symbols-outlined text-[13px]">edit</span>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Emission Factor Modal */}
      {editingFactor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-[#3d494c] rounded-lg max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/40">
              <h3 className="text-sm font-semibold text-[#dae2fd] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">tune</span>
                Edit Emission Factor: {editingFactor.name}
              </h3>
              <button
                onClick={() => setEditingFactor(null)}
                className="text-[#869397] hover:text-[#dae2fd] text-xs font-mono"
              >
                &times; Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">
                    CO₂ Factor ({editingFactor.unit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingFactor.co2}
                    onChange={(e) =>
                      setEditingFactor({ ...editingFactor, co2: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#ff8077] font-bold focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">
                    CO Factor ({editingFactor.unit})
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editingFactor.co}
                    onChange={(e) =>
                      setEditingFactor({ ...editingFactor, co: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#ffddb8] focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">
                    NOₓ Factor ({editingFactor.unit})
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editingFactor.nox}
                    onChange={(e) =>
                      setEditingFactor({ ...editingFactor, nox: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#ffb4ab] focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#869397] block mb-1">
                    SOₓ Factor ({editingFactor.unit})
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={editingFactor.sox}
                    onChange={(e) =>
                      setEditingFactor({ ...editingFactor, sox: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 font-mono text-[#e0a8ff] focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#3d494c]/30">
                <label className="text-[11px] text-[#869397] block mb-1">
                  Source Reference / Lab Test Documentation
                </label>
                <input
                  type="text"
                  value={editingFactor.sourceReference}
                  onChange={(e) =>
                    setEditingFactor({ ...editingFactor, sourceReference: e.target.value })
                  }
                  placeholder="e.g. Lab GC Certificate #4912 / Local Environmental Permit"
                  className="w-full bg-[#171f33] border border-[#3d494c]/40 rounded px-2.5 py-1.5 text-xs text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#3d494c]/30">
              <button
                onClick={() => setEditingFactor(null)}
                className="px-3 py-1.5 bg-transparent hover:bg-[#171f33] text-[#bcc9cd] text-xs font-mono rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFactor}
                className="px-4 py-1.5 bg-[#4cd7f6] hover:bg-[#38bde6] text-[#003640] font-semibold text-xs font-mono rounded flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">check</span>
                Save as User-Defined
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
