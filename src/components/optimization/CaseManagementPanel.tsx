import React, { useState } from 'react';
import { EquipmentUnit, ProcessStream, UnitSystem } from '../../types/simulation';
import { ProcessCase, ProcessCaseSummary } from '../../types/optimization';
import {
  createDefaultBenchmarkCases,
  createCaseFromCurrentState,
  exportCaseComparisonToCSV,
} from '../../engine/optimization/caseManager';

interface CaseManagementPanelProps {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  unitSystem: UnitSystem;
  onApplyCaseToFlowsheet: (caseItem: ProcessCase) => void;
}

export const CaseManagementPanel: React.FC<CaseManagementPanelProps> = ({
  units,
  streams,
  onApplyCaseToFlowsheet,
}) => {
  const [cases, setCases] = useState<ProcessCase[]>(() =>
    createDefaultBenchmarkCases(units, streams)
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case_base');
  const [showNewCaseModal, setShowNewCaseModal] = useState<boolean>(false);
  const [newCaseName, setNewCaseName] = useState<string>('');
  const [newCaseDesc, setNewCaseDesc] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const baseCase = cases.find((c) => c.isBaseCase) || cases[0];

  // Capture Current Flowsheet as New Case
  const handleSaveCurrentAsCase = () => {
    // Compute quick summary from current units and streams
    let feedFlow = 0;
    let prodFlow = 0;
    streams.forEach((s) => {
      if (s.isFeedStream || s.id === 'S-101') feedFlow += s.flowKgH;
      if (s.isProductStream || s.id === 'S-106') prodFlow += s.flowKgH;
    });
    if (feedFlow === 0) feedFlow = 45000;
    if (prodFlow === 0) prodFlow = 38250;

    let furnaceDuty = 0;
    let compPower = 0;
    units.forEach((u) => {
      if (u.type === 'furnace' || u.type === 'heater') furnaceDuty += u.equilibrium?.dutyMW || 8.5;
      if (u.type === 'compressor') compPower += 1250;
    });
    if (furnaceDuty === 0) furnaceDuty = 8.5;
    if (compPower === 0) compPower = 1250;

    const summary: ProcessCaseSummary = {
      feedFlowKgH: feedFlow,
      productFlowKgH: prodFlow,
      productYieldPct: parseFloat(((prodFlow / feedFlow) * 100).toFixed(1)),
      conversionPct: 83.5,
      furnaceDutyMW: furnaceDuty,
      compressorPowerKW: compPower,
      reboilerDutyMW: 4.2,
      totalEnergyMW: parseFloat((furnaceDuty + 4.2 + compPower / 1000).toFixed(2)),
      co2EmissionsKgH: parseFloat(((furnaceDuty + 4.2) * 202 + compPower * 0.42).toFixed(0)),
      operatingCostPerHour: 495,
      netMarginPerHour: 4820,
      solverConverged: true,
      iterations: 8,
    };

    const caseName = newCaseName.trim() || `Case 0${cases.length}: Snapshot`;
    const newCase = createCaseFromCurrentState(
      caseName,
      newCaseDesc.trim() || 'Snapshot captured from active canvas state.',
      units,
      streams,
      summary,
      ['Snapshot', 'User Case']
    );

    setCases((prev) => [...prev, newCase]);
    setSelectedCaseId(newCase.id);
    setShowNewCaseModal(false);
    setNewCaseName('');
    setNewCaseDesc('');
    setToastMessage(`Created new case: "${caseName}"`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Duplicate a case
  const handleDuplicateCase = (c: ProcessCase) => {
    const dup: ProcessCase = {
      ...JSON.parse(JSON.stringify(c)),
      id: `case_${Date.now()}`,
      name: `${c.name} (Copy)`,
      isBaseCase: false,
      timestamp: new Date().toISOString(),
      tags: [...c.tags, 'Cloned'],
    };
    setCases((prev) => [...prev, dup]);
    setSelectedCaseId(dup.id);
    setToastMessage(`Duplicated case "${c.name}"`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Delete a case
  const handleDeleteCase = (caseId: string) => {
    if (cases.length <= 1) return;
    const target = cases.find((c) => c.id === caseId);
    if (target?.isBaseCase) {
      alert('Cannot delete the Base Case.');
      return;
    }
    setCases((prev) => prev.filter((c) => c.id !== caseId));
    if (selectedCaseId === caseId) {
      setSelectedCaseId('case_base');
    }
  };

  // Export comparison matrix
  const handleExportCSV = () => {
    const csv = exportCaseComparisonToCSV(cases);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `case_comparison_matrix_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Delta calculation helper
  const calcDelta = (val: number, baseVal: number, higherIsBetter = true) => {
    if (!baseVal || baseVal === 0) return null;
    const pct = ((val - baseVal) / baseVal) * 100;
    const isGood = higherIsBetter ? pct > 0 : pct < 0;
    return {
      pct: parseFloat(pct.toFixed(1)),
      isGood,
      sign: pct > 0 ? '+' : '',
    };
  };

  return (
    <div className="space-y-4 font-mono text-[11px] select-none">
      {/* Top Banner */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#ffb95f]/15 flex items-center justify-center text-[#ffb95f]">
            <span className="material-symbols-outlined text-[20px]">folder_copy</span>
          </div>
          <div>
            <div className="text-[#dae2fd] text-[13px] font-bold flex items-center gap-2">
              <span>PROCESS CASE STUDY &amp; SCENARIO MANAGEMENT</span>
              <span className="px-1.5 py-0.2 rounded bg-[#28344c] text-[#ffb95f] text-[9px] font-bold">
                {cases.length} STORED SCENARIOS
              </span>
            </div>
            <p className="text-[#869397] text-[10px]">
              Organize, evaluate, and compare plant operating modes: Base Case, High Severity, Debottlenecking, and Energy Conservation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {toastMessage && (
            <span className="text-[#4edea3] text-[10px] font-bold animate-pulse px-2 py-1 rounded bg-[#005234]/30 border border-[#4edea3]/40">
              {toastMessage}
            </span>
          )}
          <button
            onClick={() => setShowNewCaseModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4cd7f6] text-[#003640] font-bold rounded hover:opacity-90 active:scale-95 transition-all shadow"
          >
            <span className="material-symbols-outlined text-[15px]">add_circle</span>
            <span>CAPTURE CURRENT AS CASE</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1e2738] text-[#dae2fd] font-bold rounded border border-[#3d494c]/40 hover:bg-[#28344c] transition-all"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span>EXPORT MATRIX</span>
          </button>
        </div>
      </div>

      {/* Case Grid / Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {cases.map((c) => {
          const isSelected = c.id === selectedCaseId;
          const isBase = c.isBaseCase;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedCaseId(c.id)}
              className={`p-3 rounded border transition-all cursor-pointer space-y-2 relative ${
                isSelected
                  ? 'bg-[#1e2738] border-[#4cd7f6] shadow-md ring-1 ring-[#4cd7f6]/40'
                  : 'bg-[#131b2e] border-[#3d494c]/30 hover:border-[#3d494c]/70'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#dae2fd] text-[12px]">{c.name}</span>
                  </div>
                  <span className="text-[#869397] text-[9px] block">
                    {new Date(c.timestamp).toLocaleDateString()} {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    isBase ? 'bg-[#ffb95f]/20 text-[#ffb95f]' : 'bg-[#4cd7f6]/20 text-[#4cd7f6]'
                  }`}
                >
                  {isBase ? 'BASE CASE' : 'SCENARIO'}
                </span>
              </div>

              <p className="text-[#869397] text-[9.5px] line-clamp-2">
                {c.description}
              </p>

              {/* Key Quick KPIs */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#3d494c]/20 text-[9.5px]">
                <div>
                  <span className="text-[#869397] block">Yield:</span>
                  <span className="text-[#4cd7f6] font-bold">{c.summary.productYieldPct}%</span>
                </div>
                <div>
                  <span className="text-[#869397] block">Energy:</span>
                  <span className="text-[#ffb95f] font-bold">{c.summary.totalEnergyMW} MW</span>
                </div>
                <div>
                  <span className="text-[#869397] block">CO₂:</span>
                  <span className="text-[#ff7b72] font-bold">{c.summary.co2EmissionsKgH.toLocaleString()} kg/h</span>
                </div>
                <div>
                  <span className="text-[#869397] block">Margin:</span>
                  <span className="text-[#4edea3] font-bold">${c.summary.netMarginPerHour.toLocaleString()}/h</span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 pt-1">
                {c.tags.map((t, idx) => (
                  <span key={idx} className="px-1 py-0.2 rounded bg-[#060e20] text-[#869397] text-[8.5px]">
                    {t}
                  </span>
                ))}
              </div>

              {/* Action buttons inside card */}
              <div className="flex items-center justify-between pt-2 border-t border-[#3d494c]/20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyCaseToFlowsheet(c);
                    setToastMessage(`Loaded "${c.name}" onto active canvas.`);
                    setTimeout(() => setToastMessage(null), 3000);
                  }}
                  className="px-2 py-1 rounded bg-[#4edea3]/20 hover:bg-[#4edea3]/30 text-[#4edea3] font-bold text-[9px] flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[12px]">upload_file</span>
                  <span>Load to Canvas</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateCase(c);
                    }}
                    title="Duplicate Case"
                    className="p-1 text-[#869397] hover:text-[#dae2fd]"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  </button>
                  {!isBase && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCase(c.id);
                      }}
                      title="Delete Case"
                      className="p-1 text-[#869397] hover:text-[#ff7b72]"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
        <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[16px]">compare_arrows</span>
            <span className="text-[#dae2fd] font-bold">Side-by-Side Case Comparison Matrix (vs. Base Case)</span>
          </div>
          <span className="text-[#869397] text-[10px]">
            Colored tags indicate percentage improvement (+) or trade-off (-) relative to nominal Base Case.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-[#060e20] text-[#869397] border-b border-[#3d494c]/30">
              <tr>
                <th className="py-2 px-3">Process Parameter / KPI</th>
                <th className="py-2 px-2">Unit</th>
                {cases.map((c) => (
                  <th
                    key={c.id}
                    className={`py-2 px-3 text-right ${
                      c.id === selectedCaseId ? 'text-[#4cd7f6] font-bold bg-[#1e2738]/60' : ''
                    }`}
                  >
                    <div>{c.name}</div>
                    <div className="text-[8.5px] font-normal text-[#869397]">
                      {c.isBaseCase ? 'REFERENCE' : 'DELTA'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#3d494c]/20">
              {/* Product Yield */}
              <tr className="hover:bg-[#1e2738]/50">
                <td className="py-1.5 px-3 text-[#dae2fd] font-semibold">Liquid Product Yield</td>
                <td className="py-1.5 px-2 text-[#869397]">%</td>
                {cases.map((c) => {
                  const d = !c.isBaseCase ? calcDelta(c.summary.productYieldPct, baseCase.summary.productYieldPct, true) : null;
                  return (
                    <td key={c.id} className="py-1.5 px-3 text-right">
                      <span className="text-[#4cd7f6] font-bold">{c.summary.productYieldPct}%</span>
                      {d && (
                        <span className={`ml-1 text-[8.5px] px-1 py-0.2 rounded ${d.isGood ? 'bg-[#005234] text-[#4edea3]' : 'bg-[#93000a] text-[#ffb4ab]'}`}>
                          {d.sign}{d.pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Feed Throughput */}
              <tr className="hover:bg-[#1e2738]/50">
                <td className="py-1.5 px-3 text-[#dae2fd]">Feed Mass Throughput</td>
                <td className="py-1.5 px-2 text-[#869397]">kg/h</td>
                {cases.map((c) => {
                  const d = !c.isBaseCase ? calcDelta(c.summary.feedFlowKgH, baseCase.summary.feedFlowKgH, true) : null;
                  return (
                    <td key={c.id} className="py-1.5 px-3 text-right text-[#dae2fd]">
                      {c.summary.feedFlowKgH.toLocaleString()}
                      {d && d.pct !== 0 && (
                        <span className="ml-1 text-[8.5px] text-[#ffddb8]">({d.sign}{d.pct}%)</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Product Production Rate */}
              <tr className="hover:bg-[#1e2738]/50">
                <td className="py-1.5 px-3 text-[#dae2fd]">Finished Product Output</td>
                <td className="py-1.5 px-2 text-[#869397]">kg/h</td>
                {cases.map((c) => {
                  const d = !c.isBaseCase ? calcDelta(c.summary.productFlowKgH, baseCase.summary.productFlowKgH, true) : null;
                  return (
                    <td key={c.id} className="py-1.5 px-3 text-right text-[#dae2fd] font-semibold">
                      {c.summary.productFlowKgH.toLocaleString()}
                      {d && (
                        <span className={`ml-1 text-[8.5px] px-1 py-0.2 rounded ${d.isGood ? 'bg-[#005234] text-[#4edea3]' : 'bg-[#93000a] text-[#ffb4ab]'}`}>
                          {d.sign}{d.pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Conversion */}
              <tr className="hover:bg-[#1e2738]/50">
                <td className="py-1.5 px-3 text-[#dae2fd]">Reactant Conversion</td>
                <td className="py-1.5 px-2 text-[#869397]">%</td>
                {cases.map((c) => {
                  const d = !c.isBaseCase ? calcDelta(c.summary.conversionPct, baseCase.summary.conversionPct, true) : null;
                  return (
                    <td key={c.id} className="py-1.5 px-3 text-right text-[#7ee787]">
                      {c.summary.conversionPct}%
                      {d && (
                        <span className={`ml-1 text-[8.5px] px-1 py-0.2 rounded ${d.isGood ? 'bg-[#005234] text-[#4edea3]' : 'bg-[#93000a] text-[#ffb4ab]'}`}>
                          {d.sign}{d.pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Furnace Thermal Duty */}
              <tr className="hover:bg-[#1e2738]/50">
                <td className="py-1.5 px-3 text-[#dae2fd]">Furnace Radiant Duty (F-101)</td>
                <td className="py-1.5 px-2 text-[#869397]">MW</td>
                {cases.map((c) => {
                  const d = !c.isBaseCase ? calcDelta(c.summary.furnaceDutyMW, baseCase.summary.furnaceDutyMW, false) : null;
                  return (
                    <td key={c.id} className="py-1.5 px-3 text-right text-[#ff7b72]">
                      {c.summary.furnaceDutyMW}
                      {d && (
                        <span className={`ml-1 text-[8.5px] px-1 py-0.2 rounded ${d.isGood ? 'bg-[#005234] text-[#4edea3]' : 'bg-[#93000a] text-[#ffb4ab]'}`}>
                          {d.sign}{d.pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Total Energy */}
              <tr className="hover:bg-[#1e2738]/50">
                <td className="py-1.5 px-3 text-[#dae2fd] font-semibold">Total Energy Consumption</td>
                <td className="py-1.5 px-2 text-[#869397]">MW</td>
                {cases.map((c) => {
                  const d = !c.isBaseCase ? calcDelta(c.summary.totalEnergyMW, baseCase.summary.totalEnergyMW, false) : null;
                  return (
                    <td key={c.id} className="py-1.5 px-3 text-right text-[#ffb95f] font-bold">
                      {c.summary.totalEnergyMW}
                      {d && (
                        <span className={`ml-1 text-[8.5px] px-1 py-0.2 rounded ${d.isGood ? 'bg-[#005234] text-[#4edea3]' : 'bg-[#93000a] text-[#ffb4ab]'}`}>
                          {d.sign}{d.pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* CO2 Emissions */}
              <tr className="hover:bg-[#1e2738]/50">
                <td className="py-1.5 px-3 text-[#dae2fd]">CO₂ Equivalent Emissions</td>
                <td className="py-1.5 px-2 text-[#869397]">kg/h</td>
                {cases.map((c) => {
                  const d = !c.isBaseCase ? calcDelta(c.summary.co2EmissionsKgH, baseCase.summary.co2EmissionsKgH, false) : null;
                  return (
                    <td key={c.id} className="py-1.5 px-3 text-right text-[#ff7b72]">
                      {c.summary.co2EmissionsKgH.toLocaleString()}
                      {d && (
                        <span className={`ml-1 text-[8.5px] px-1 py-0.2 rounded ${d.isGood ? 'bg-[#005234] text-[#4edea3]' : 'bg-[#93000a] text-[#ffb4ab]'}`}>
                          {d.sign}{d.pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Operating Cost */}
              <tr className="hover:bg-[#1e2738]/50">
                <td className="py-1.5 px-3 text-[#dae2fd]">Operating Expenses (OPEX)</td>
                <td className="py-1.5 px-2 text-[#869397]">$/h</td>
                {cases.map((c) => {
                  const d = !c.isBaseCase ? calcDelta(c.summary.operatingCostPerHour, baseCase.summary.operatingCostPerHour, false) : null;
                  return (
                    <td key={c.id} className="py-1.5 px-3 text-right text-[#f0883e]">
                      ${c.summary.operatingCostPerHour.toLocaleString()}
                      {d && (
                        <span className={`ml-1 text-[8.5px] px-1 py-0.2 rounded ${d.isGood ? 'bg-[#005234] text-[#4edea3]' : 'bg-[#93000a] text-[#ffb4ab]'}`}>
                          {d.sign}{d.pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Net Operating Margin */}
              <tr className="hover:bg-[#1e2738]/50 bg-[#005234]/10">
                <td className="py-2 px-3 text-[#4edea3] font-bold">Net Operating Margin</td>
                <td className="py-2 px-2 text-[#4edea3] font-bold">$/h</td>
                {cases.map((c) => {
                  const d = !c.isBaseCase ? calcDelta(c.summary.netMarginPerHour, baseCase.summary.netMarginPerHour, true) : null;
                  return (
                    <td key={c.id} className="py-2 px-3 text-right text-[#4edea3] font-bold text-[11px]">
                      ${c.summary.netMarginPerHour.toLocaleString()}
                      {d && (
                        <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded ${d.isGood ? 'bg-[#005234] text-[#4edea3]' : 'bg-[#93000a] text-[#ffb4ab]'}`}>
                          {d.sign}{d.pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Convergence */}
              <tr className="hover:bg-[#1e2738]/50">
                <td className="py-1.5 px-3 text-[#869397]">Solver Convergence</td>
                <td className="py-1.5 px-2 text-[#869397]">-</td>
                {cases.map((c) => (
                  <td key={c.id} className="py-1.5 px-3 text-right">
                    <span className="text-[#4edea3] font-bold">
                      {c.summary.solverConverged ? `CONV (${c.summary.iterations} it)` : 'DIV'}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Creating New Case */}
      {showNewCaseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#171f33] border border-[#4cd7f6]/50 rounded p-4 max-w-md w-full space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-2">
              <span className="text-[#dae2fd] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">bookmark_add</span>
                <span>Capture Flowsheet Snapshot as Case</span>
              </span>
              <button
                onClick={() => setShowNewCaseModal(false)}
                className="text-[#869397] hover:text-[#dae2fd]"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[#869397] text-[10px] block font-semibold mb-1">
                  Case Name:
                </label>
                <input
                  type="text"
                  placeholder={`Case 0${cases.length}: Custom Scenario`}
                  value={newCaseName}
                  onChange={(e) => setNewCaseName(e.target.value)}
                  className="w-full bg-[#060e20] border border-[#3d494c]/40 text-[#dae2fd] rounded px-2.5 py-1.5 text-[11px] focus:border-[#4cd7f6] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#869397] text-[10px] block font-semibold mb-1">
                  Description / Operational Notes:
                </label>
                <textarea
                  placeholder="Record operating objectives, catalyst severity, or feed slate specifics..."
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-[#060e20] border border-[#3d494c]/40 text-[#dae2fd] rounded px-2.5 py-1.5 text-[11px] focus:border-[#4cd7f6] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3d494c]/30">
              <button
                onClick={() => setShowNewCaseModal(false)}
                className="px-3 py-1.5 rounded text-[#869397] hover:text-[#dae2fd]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrentAsCase}
                className="px-3 py-1.5 bg-[#4cd7f6] text-[#003640] font-bold rounded hover:opacity-90 transition-all"
              >
                Save Scenario Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
