import React, { useState, useMemo } from 'react';
import { ChemicalComponent, EventLogEntry, ProcessStream, UnitSystem, EquipmentUnit } from '../types/simulation';
import { formatFlow, formatPres, formatTemp } from '../engine/thermoEngine';
import { ConvergenceIterationRecord } from '../engine/solver/recycleSolver';
import { StructuredEngineeringReport, exportReportToMarkdown } from '../engine/reporting/engineeringReportGenerator';
import { runEngineeringTestSuite, TestSuiteSummary } from '../engine/tests/engineeringTestSuite';
import { ProcessValidationReport } from '../engine/validation/processValidator';
import { SimulationResult } from '../engine/solver/simulationManager';
import {
  ReportType,
  REPORT_TYPES,
  buildEngineeringReport,
  exportReportToCSV,
  exportReportToJSON,
  triggerFileDownload,
  getDefaultProjectMetadata,
  ENGINEERING_DISCLAIMER,
} from '../engine/reporting/engineeringReportEngine';

interface DiagnosticConsoleProps {
  logs: EventLogEntry[];
  streams: ProcessStream[];
  components: ChemicalComponent[];
  unitSystem: UnitSystem;
  selectedStreamId: string | null;
  onSelectStream: (id: string) => void;
  massResidual: number;
  energyResidual: number;
  convergenceHistory?: ConvergenceIterationRecord[];
  isSolving?: boolean;
  engineeringReport?: StructuredEngineeringReport | null;
  validationReport?: ProcessValidationReport | null;
  simulationResult?: SimulationResult | null;
  units?: EquipmentUnit[];
  onTriggerSolve?: () => void;
  onOpenReportsStudio?: () => void;
}

export const DiagnosticConsole: React.FC<DiagnosticConsoleProps> = ({
  logs,
  streams,
  components,
  unitSystem,
  selectedStreamId,
  onSelectStream,
  massResidual,
  energyResidual,
  convergenceHistory = [],
  isSolving = false,
  engineeringReport = null,
  validationReport = null,
  simulationResult = null,
  units = [],
  onTriggerSolve,
  onOpenReportsStudio,
}) => {
  const [activeTab, setActiveTab] = useState<
    'solver' | 'convergence' | 'reports' | 'validation' | 'verification' | 'streams' | 'compositions'
  >('solver');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [testResults, setTestResults] = useState<TestSuiteSummary | null>(() => runEngineeringTestSuite());
  const [copyReportSuccess, setCopyReportSuccess] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('simulation');

  const liveReportDoc = useMemo(() => {
    return buildEngineeringReport(
      selectedReportType,
      simulationResult,
      units,
      streams,
      components,
      unitSystem,
      getDefaultProjectMetadata(),
      validationReport
    );
  }, [selectedReportType, simulationResult, units, streams, components, unitSystem, validationReport]);

  const handleRunTests = () => {
    const res = runEngineeringTestSuite();
    setTestResults(res);
  };

  const handleCopyMarkdownReport = () => {
    if (engineeringReport) {
      const md = exportReportToMarkdown(engineeringReport);
      navigator.clipboard.writeText(md).then(() => {
        setCopyReportSuccess(true);
        setTimeout(() => setCopyReportSuccess(false), 2500);
      });
    } else {
      const text = `${liveReportDoc.title}\n${liveReportDoc.executiveSummary}\n\nDisclaimer: ${ENGINEERING_DISCLAIMER}`;
      navigator.clipboard.writeText(text).then(() => {
        setCopyReportSuccess(true);
        setTimeout(() => setCopyReportSuccess(false), 2500);
      });
    }
  };

  const handleConsoleExportCSV = () => {
    const csv = exportReportToCSV(liveReportDoc);
    triggerFileDownload(csv, `PetroSimX_${selectedReportType}_Report.csv`, 'text/csv;charset=utf-8;');
  };

  const handleConsoleExportJSON = () => {
    const json = exportReportToJSON(liveReportDoc);
    triggerFileDownload(json, `PetroSimX_${selectedReportType}_Report.json`, 'application/json;charset=utf-8;');
  };

  return (
    <section className="bg-[#131b2e] flex flex-col border-t border-[#3d494c]/30 select-none">
      {/* Tab Strip & Diagnostic Status Bar */}
      <div className="h-8 px-2 bg-[#171f33] flex items-center justify-between border-b border-[#3d494c]/20">
        <div className="flex items-center gap-1 font-mono text-[10px] overflow-x-auto no-scrollbar scroll-smooth min-w-0">
          <button
            onClick={() => {
              setActiveTab('solver');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded-t transition-colors whitespace-nowrap ${
              activeTab === 'solver' && !isCollapsed
                ? 'bg-[#060e20] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            Solver Diagnostics
          </button>

          <button
            onClick={() => {
              setActiveTab('convergence');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded-t transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'convergence' && !isCollapsed
                ? 'bg-[#060e20] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            <span>Recycle Convergence Monitor</span>
            {convergenceHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#004e5d] text-[#4cd7f6] text-[8.5px]">
                {convergenceHistory.length} iters
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('reports');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded-t transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'reports' && !isCollapsed
                ? 'bg-[#060e20] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            <span>Engineering Balances &amp; Report</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
          </button>

          <button
            onClick={() => {
              setActiveTab('validation');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded-t transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'validation' && !isCollapsed
                ? 'bg-[#060e20] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            <span>Process Diagnostics &amp; Rules</span>
            {validationReport && validationReport.errors.length > 0 ? (
              <span className="px-1.5 py-0.2 rounded bg-[#93000a] text-[#ffb4ab] text-[8.5px] font-bold">
                {validationReport.errors.length} ERR
              </span>
            ) : validationReport && validationReport.warnings.length > 0 ? (
              <span className="px-1.5 py-0.2 rounded bg-[#ffb95f]/20 text-[#ffb95f] text-[8.5px] font-bold">
                {validationReport.warnings.length} WARN
              </span>
            ) : (
              <span className="px-1 py-0.2 rounded bg-[#005234] text-[#4edea3] text-[8.5px] font-bold">CLEAN</span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('verification');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded-t transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'verification' && !isCollapsed
                ? 'bg-[#060e20] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            <span>Verification Tests ({testResults ? testResults.total : 16})</span>
            <span className="px-1 py-0.2 rounded bg-[#005234] text-[#4edea3] text-[8.5px] font-bold">
              {testResults && testResults.failed > 0 ? `${testResults.failed} FAIL` : 'PASS'}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('streams');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded-t transition-colors whitespace-nowrap ${
              activeTab === 'streams' && !isCollapsed
                ? 'bg-[#060e20] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            Streams ({streams.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('compositions');
              setIsCollapsed(false);
            }}
            className={`px-2.5 py-1 rounded-t transition-colors whitespace-nowrap ${
              activeTab === 'compositions' && !isCollapsed
                ? 'bg-[#060e20] text-[#4cd7f6] font-semibold border-t-2 border-[#4cd7f6]'
                : 'text-[#bcc9cd] hover:text-[#dae2fd]'
            }`}
            type="button"
          >
            Compositions
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] text-[#869397] shrink-0 ml-2">
          {isSolving && (
            <div className="flex items-center gap-1 text-[#ffb95f] animate-pulse">
              <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
              <span className="hidden sm:inline">SOLVING...</span>
            </div>
          )}
          <span className="hidden sm:inline">
            MASS: <strong className="text-[#4edea3] font-bold">{massResidual.toFixed(2)} kg/h</strong>
          </span>
          <span className="hidden lg:inline">
            ENERGY: <strong className="text-[#4edea3] font-bold">{energyResidual.toFixed(2)} kW</strong>
          </span>
          <span className="hidden xl:inline-block text-[#ffddb8] bg-[#ffddb8]/10 px-1.5 py-0.5 rounded border border-[#ffddb8]/20 text-[9px] font-semibold">
            LEAD ENG: ENG ALAA MOHAMMED
          </span>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hover:text-[#dae2fd] text-[#869397] p-0.5 rounded"
            title={isCollapsed ? 'Expand Dock' : 'Collapse Dock'}
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">
              {isCollapsed ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>
      </div>

      {/* Dock Content Area */}
      {!isCollapsed && (
        <div className="bg-[#060e20] p-2 max-h-56 lg:max-h-52 overflow-y-auto">
          {/* 1. SOLVER DIAGNOSTICS TAB */}
          {activeTab === 'solver' && (
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-2">
              <div className="w-full lg:col-span-5 bg-[#171f33] p-2 rounded border border-[#3d494c]/30 font-mono text-[10px] flex flex-col gap-1 overflow-y-auto max-h-44">
                <div className="flex items-center justify-between text-[#869397] text-[9px] pb-1 border-b border-[#3d494c]/30">
                  <span>EVENT LOG [SEQUENTIAL MODULAR SOLVER]</span>
                  <span>{logs.length} EVENTS</span>
                </div>
                <div className="text-[#869397] font-mono text-[10px] leading-relaxed flex flex-col gap-0.5">
                  {logs.map((log) => (
                    <p key={log.id} className="text-[#dae2fd]/90">
                      <span
                        className={
                          log.type === 'step'
                            ? 'text-[#ffb95f]'
                            : log.type === 'success'
                            ? 'text-[#4edea3] font-bold'
                            : log.type === 'warn'
                            ? 'text-[#ffb4ab]'
                            : 'text-[#4cd7f6]'
                        }
                      >
                        [{log.time}]
                      </span>{' '}
                      {log.message}
                    </p>
                  ))}
                </div>
              </div>

              <div className="w-full lg:col-span-7 bg-[#171f33] p-2 rounded border border-[#3d494c]/30 overflow-x-auto max-h-44">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead>
                    <tr className="text-[#869397] border-b border-[#3d494c]/30 text-[9.5px] uppercase">
                      <th className="pb-1">Stream</th>
                      <th className="pb-1">Phase</th>
                      <th className="pb-1 text-right">Temp [{unitSystem === 'Field' ? '°F' : '°C'}]</th>
                      <th className="pb-1 text-right">Pres [{unitSystem === 'Field' ? 'psi' : 'bar'}]</th>
                      <th className="pb-1 text-right">Flow [{unitSystem === 'Field' ? 'lb/h' : 'kg/h'}]</th>
                      <th className="pb-1 text-right">MW</th>
                      <th className="pb-1 text-right">Enthalpy [kJ/kg]</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3d494c]/20 text-[10px]">
                    {streams.slice(0, 6).map((st) => {
                      const isSelected = selectedStreamId === st.id;
                      return (
                        <tr
                          key={st.id}
                          onClick={() => onSelectStream(st.id)}
                          className={`hover:bg-[#222a3d] cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#222a3d] font-bold' : ''
                          }`}
                        >
                          <td className="py-1 font-bold text-[#4cd7f6]">{st.id}</td>
                          <td className="py-1 text-[#bcc9cd]">{st.phase}</td>
                          <td className="py-1 text-right text-[#ffddb8]">
                            {unitSystem === 'Field' ? (st.tempC * 9 / 5 + 32).toFixed(2) : st.tempC.toFixed(2)}
                          </td>
                          <td className="py-1 text-right text-[#dae2fd]">
                            {unitSystem === 'Field' ? (st.presBar * 14.5038).toFixed(2) : st.presBar.toFixed(2)}
                          </td>
                          <td className="py-1 text-right text-[#4edea3]">
                            {unitSystem === 'Field' ? (st.flowKgH * 2.20462).toFixed(1) : st.flowKgH.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </td>
                          <td className="py-1 text-right text-[#dae2fd]">{st.mw.toFixed(2)}</td>
                          <td className="py-1 text-right text-[#bcc9cd]">
                            {st.enthalpyKjKg > 0 ? `+${st.enthalpyKjKg.toFixed(1)}` : st.enthalpyKjKg.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. RECYCLE CONVERGENCE MONITOR TAB */}
          {activeTab === 'convergence' && (
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-3 max-h-56 lg:max-h-44 overflow-y-auto">
              {/* Left Summary Box */}
              <div className="w-full lg:col-span-4 bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30 font-mono text-[10px] space-y-2">
                <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-1">
                  <span className="text-[#dae2fd] font-bold">RECYCLE LOOP ARCHITECTURE</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#004e5d] text-[#4cd7f6] text-[9px] font-bold">
                    TARJAN SCC
                  </span>
                </div>
                <div className="space-y-1 text-[#869397]">
                  <div className="flex justify-between">
                    <span>Tear Stream Tag:</span>
                    <strong className="text-[#ffb95f]">S-106 (H2 Recycle)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Acceleration Method:</span>
                    <strong className="text-[#dae2fd]">Bounded Wegstein</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Convergence Tolerance:</span>
                    <strong className="text-[#4edea3]">&lt; 1.00e-5</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Allowed Iterations:</span>
                    <strong className="text-[#dae2fd]">35</strong>
                  </div>
                </div>

                {onTriggerSolve && (
                  <button
                    onClick={onTriggerSolve}
                    disabled={isSolving}
                    className="w-full py-1.5 bg-[#4cd7f6] text-[#003640] font-bold rounded hover:opacity-90 active:scale-95 transition-all text-center"
                  >
                    {isSolving ? 'Solving Process...' : 'Execute Steady-State Run'}
                  </button>
                )}
              </div>

              {/* Right Iteration History Table */}
              <div className="w-full lg:col-span-8 bg-[#171f33] p-2 rounded border border-[#3d494c]/30 overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead>
                    <tr className="text-[#869397] border-b border-[#3d494c]/30 text-[9px] uppercase">
                      <th className="pb-1">Iter (k)</th>
                      <th className="pb-1">Acceleration</th>
                      <th className="pb-1 text-right">Wegstein Factor (q)</th>
                      <th className="pb-1 text-right">Max Residual</th>
                      <th className="pb-1 text-right">ΔFlow [kg/h]</th>
                      <th className="pb-1 text-right">ΔTemp [°C]</th>
                      <th className="pb-1 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3d494c]/20">
                    {convergenceHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-[#869397]">
                          Press "Execute Steady-State Run" or "Solve" on the top ribbon to view iteration history.
                        </td>
                      </tr>
                    ) : (
                      convergenceHistory.map((rec) => {
                        const isFinal = rec.maxResidual < 1e-4;
                        return (
                          <tr key={rec.iteration} className="hover:bg-[#222a3d]">
                            <td className="py-1 font-bold text-[#dae2fd]">#{rec.iteration}</td>
                            <td className="py-1 text-[#bcc9cd]">{rec.accelerationMethod}</td>
                            <td className="py-1 text-right text-[#ffddb8]">
                              {rec.wegsteinQ !== undefined ? rec.wegsteinQ.toFixed(3) : '0.000'}
                            </td>
                            <td className="py-1 text-right font-bold text-[#4cd7f6]">
                              {rec.maxResidual.toExponential(3)}
                            </td>
                            <td className="py-1 text-right text-[#dae2fd]">
                              {rec.flowResidualKgH.toFixed(2)}
                            </td>
                            <td className="py-1 text-right text-[#dae2fd]">
                              {rec.temperatureResidualC.toFixed(3)}
                            </td>
                            <td className="py-1 text-center">
                              {isFinal ? (
                                <span className="text-[#4edea3] font-bold">CONVERGED</span>
                              ) : (
                                <span className="text-[#ffb95f]">ITERATING</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. ENGINEERING BALANCES & REPORTS TAB */}
          {activeTab === 'reports' && (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {/* Header with Report Selector & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#3d494c]/30">
                <div className="flex items-center gap-2">
                  <span className="text-[#dae2fd] font-bold text-[11px] font-mono">
                    ENGINEERING REPORT:
                  </span>
                  <select
                    value={selectedReportType}
                    onChange={(e) => setSelectedReportType(e.target.value as ReportType)}
                    className="bg-[#171f33] border border-[#3d494c]/60 text-[#4cd7f6] font-mono text-[10.5px] rounded px-2 py-0.5 focus:outline-none focus:border-[#4cd7f6]"
                  >
                    {REPORT_TYPES.map((rep) => (
                      <option key={rep.id} value={rep.id} className="bg-[#131b2e]">
                        {rep.title} ({rep.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopyMarkdownReport}
                    className="px-2 py-0.5 bg-[#171f33] hover:bg-[#222a3d] text-[#bcc9cd] hover:text-[#dae2fd] rounded text-[10px] font-mono border border-[#3d494c]/40 transition-all flex items-center gap-1"
                    title="Copy Summary & Disclaimer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                    <span>{copyReportSuccess ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={handleConsoleExportCSV}
                    className="px-2 py-0.5 bg-[#171f33] hover:bg-[#222a3d] text-[#4edea3] rounded text-[10px] font-mono border border-[#4edea3]/30 transition-all flex items-center gap-1 font-semibold"
                    title="Export CSV Data Table"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[12px]">table_view</span>
                    <span>CSV</span>
                  </button>

                  <button
                    onClick={handleConsoleExportJSON}
                    className="px-2 py-0.5 bg-[#171f33] hover:bg-[#222a3d] text-[#ffddb8] rounded text-[10px] font-mono border border-[#ffddb8]/30 transition-all flex items-center gap-1 font-semibold"
                    title="Export JSON Structured Document"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[12px]">data_object</span>
                    <span>JSON</span>
                  </button>

                  {onOpenReportsStudio && (
                    <button
                      onClick={onOpenReportsStudio}
                      className="px-2.5 py-0.5 bg-[#4cd7f6]/20 hover:bg-[#4cd7f6]/30 text-[#4cd7f6] rounded text-[10px] font-mono font-bold border border-[#4cd7f6] transition-all flex items-center gap-1 shadow-sm"
                      title="Open Fullscreen Engineering Reports Studio"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      <span>Full Report Studio &amp; PDF</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Disclaimer Notice */}
              <div className="p-1.5 bg-[#171f33] border-l-2 border-[#ffb95f] rounded-r text-[9.5px] font-mono text-[#dae2fd]/85 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-[#ffb95f] shrink-0">verified</span>
                <span>{ENGINEERING_DISCLAIMER}</span>
              </div>

              {/* Report Summary & KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[10px]">
                {/* Executive Summary */}
                <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30 flex flex-col justify-between">
                  <div>
                    <span className="text-[#869397] font-mono block text-[9px] uppercase font-bold">
                      {liveReportDoc.title}
                    </span>
                    <p className="text-[10px] text-[#dae2fd] mt-1 line-clamp-3">
                      {liveReportDoc.executiveSummary}
                    </p>
                  </div>
                  <div className="mt-2 pt-1 border-t border-[#3d494c]/30 text-[9px] font-mono text-[#869397] flex justify-between">
                    <span>Engine: {liveReportDoc.metadata.modelVersion}</span>
                    <span className="text-[#4edea3]">CONVERGED</span>
                  </div>
                </div>

                {/* KPIs */}
                <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30 space-y-1">
                  <span className="text-[#869397] font-mono block text-[9px] uppercase font-bold">
                    Key Performance Indicators
                  </span>
                  {liveReportDoc.kpis.slice(0, 3).map((kpi, kIdx) => (
                    <div key={kIdx} className="flex justify-between font-mono text-[9.5px]">
                      <span className="text-[#bcc9cd]">{kpi.label}:</span>
                      <strong className="text-[#dae2fd]">{kpi.value} {kpi.unit || ''}</strong>
                    </div>
                  ))}
                </div>

                {/* Primary Data Table Preview */}
                <div className="col-span-2 bg-[#171f33] p-2 rounded border border-[#3d494c]/30 overflow-x-auto">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#869397] font-mono block text-[9px] uppercase font-bold">
                      {liveReportDoc.sections[0]?.title || 'Performance Metrics'}
                    </span>
                    <span className="text-[9px] font-mono text-[#4cd7f6]">
                      {liveReportDoc.sections[0]?.tableRows?.length || 0} variables
                    </span>
                  </div>
                  <table className="w-full text-left font-mono text-[9.5px]">
                    <thead>
                      <tr className="text-[#869397] border-b border-[#3d494c]/20">
                        <th className="pb-0.5">Variable</th>
                        <th className="pb-0.5 text-right">Value</th>
                        <th className="pb-0.5 text-right">Unit</th>
                        <th className="pb-0.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3d494c]/20">
                      {liveReportDoc.sections[0]?.tableRows?.slice(0, 4).map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="py-0.5 font-sans text-[#dae2fd] truncate max-w-[140px]">{row.variable}</td>
                          <td className="py-0.5 text-right font-bold text-[#ffddb8]">{row.value}</td>
                          <td className="py-0.5 text-right text-[#869397]">{row.unit}</td>
                          <td className="py-0.5 text-right">
                            <span className={`px-1 py-0.2 rounded text-[8px] border ${
                              row.status === 'OPTIMAL' || row.status === 'CONSERVED' || row.status === 'PASS'
                                ? 'text-[#4edea3] bg-[#005234]/40 border-[#4edea3]/40'
                                : 'text-[#4cd7f6] bg-[#004e5d]/30 border-[#4cd7f6]/40'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PROCESS VALIDATION & DIAGNOSTIC RULES TAB */}
          {activeTab === 'validation' && (
            <div className="space-y-2 max-h-44 overflow-y-auto font-mono text-[10px]">
              <div className="flex items-center justify-between pb-1 border-b border-[#3d494c]/30">
                <div className="flex items-center gap-2">
                  <span className="text-[#dae2fd] font-bold text-[11px]">
                    PROCESS INTEGRITY &amp; ENGINEERING RULE COMPLIANCE AUDIT
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    validationReport && validationReport.passed
                      ? 'bg-[#005234] text-[#4edea3]'
                      : 'bg-[#93000a] text-[#ffb4ab]'
                  }`}>
                    {validationReport && validationReport.passed ? 'RULES SATISFIED' : 'NON-COMPLIANCE DETECTED'}
                  </span>
                </div>
              </div>

              {(!validationReport || (validationReport.errors.length === 0 && validationReport.warnings.length === 0)) ? (
                <div className="p-3 bg-[#171f33] rounded border border-[#3d494c]/30 text-center text-[#4edea3]">
                  <span className="material-symbols-outlined text-[20px] block mb-1">verified</span>
                  <span>All process streams and unit operations conform to 1st &amp; 2nd Laws of Thermodynamics. No temperature crosses, negative flows, or overpressures detected.</span>
                </div>
              ) : (
                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-2">
                  {/* Errors & Warnings list */}
                  <div className="w-full lg:col-span-8 space-y-1">
                    {validationReport.errors.map((err, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-[#93000a]/20 border border-[#ffb4ab]/40 text-[#ffb4ab] flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-[15px] shrink-0">error</span>
                        <div>
                          <span className="font-bold uppercase tracking-wider text-[9px] block">CRITICAL ERROR [{err.category}]</span>
                          <span>{err.message}</span>
                          {err.sourceId && <span className="text-[#dae2fd] ml-1">({err.sourceId})</span>}
                          {err.remedyRecommendation && (
                            <div className="text-[#dae2fd] text-[9px] mt-0.5 opacity-90">
                              → Recommended Action: {err.remedyRecommendation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {validationReport.warnings.map((warn, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-[#ffb95f]/15 border border-[#ffb95f]/30 text-[#ffddb8] flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-[15px] shrink-0 text-[#ffb95f]">warning</span>
                        <div>
                          <span className="font-bold uppercase tracking-wider text-[9px] block text-[#ffb95f]">WARNING [{warn.category}]</span>
                          <span>{warn.message}</span>
                          {warn.sourceId && <span className="text-[#dae2fd] ml-1">({warn.sourceId})</span>}
                          {warn.remedyRecommendation && (
                            <div className="text-[#dae2fd] text-[9px] mt-0.5 opacity-90">
                              → Recommended Action: {warn.remedyRecommendation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Equipment Diagnostics Table */}
                  <div className="w-full lg:col-span-4 bg-[#171f33] p-2 rounded border border-[#3d494c]/30">
                    <span className="text-[#869397] block text-[9px] uppercase mb-1">Equipment Integrity Checks</span>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {validationReport.issues.filter((i) => i.sourceType === 'unit').map((issue, idx) => (
                        <div key={idx} className="border-b border-[#3d494c]/20 pb-0.5">
                          <span className="text-[#4cd7f6] font-bold block">{issue.sourceId}:</span>
                          <span className="text-[#bcc9cd] block text-[9px] leading-tight pl-1">
                            • {issue.title}
                          </span>
                        </div>
                      ))}
                      {validationReport.issues.filter((i) => i.sourceType === 'unit').length === 0 && (
                        <span className="text-[#4edea3] text-[9px] italic block">All units structurally sound.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. VERIFICATION TESTS TAB */}
          {activeTab === 'verification' && (
            <div className="space-y-2 max-h-44 overflow-y-auto">
              <div className="flex items-center justify-between pb-1 border-b border-[#3d494c]/30">
                <div className="flex items-center gap-2">
                  <span className="text-[#dae2fd] font-bold text-[11px]">
                    ENGINEERING EQUATION &amp; NUMERICAL SOLVER VALIDATION BENCHMARKS
                  </span>
                  {testResults && (
                    <span className="text-[10px] text-[#4edea3] font-bold">
                      [{testResults.passed} / {testResults.total} TESTS PASSED in {testResults.durationMs.toFixed(1)} ms]
                    </span>
                  )}
                </div>
                <button
                  onClick={handleRunTests}
                  className="px-2.5 py-1 bg-[#005234] hover:bg-[#006842] text-[#4edea3] rounded text-[10px] font-bold transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">play_arrow</span>
                  <span>Run Verification Suite</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[9.5px]">
                  <thead>
                    <tr className="text-[#869397] border-b border-[#3d494c]/30 uppercase">
                      <th className="pb-1">Test ID</th>
                      <th className="pb-1">Category</th>
                      <th className="pb-1">Engineering Benchmark Description</th>
                      <th className="pb-1">Expected Standard</th>
                      <th className="pb-1">Measured Value</th>
                      <th className="pb-1 text-right">Execution</th>
                      <th className="pb-1 text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3d494c]/20">
                    {testResults?.results.map((test) => (
                      <tr key={test.id} className="hover:bg-[#222a3d]">
                        <td className="py-1 font-bold text-[#4cd7f6]">{test.id}</td>
                        <td className="py-1 text-[#bcc9cd]">{test.category}</td>
                        <td className="py-1 text-[#dae2fd]">{test.name}</td>
                        <td className="py-1 text-[#869397]">{test.expected}</td>
                        <td className="py-1 text-[#ffddb8]">{test.actual}</td>
                        <td className="py-1 text-right text-[#dae2fd]">{test.executionTimeMs.toFixed(2)} ms</td>
                        <td className="py-1 text-center">
                          {test.passed ? (
                            <span className="px-1.5 py-0.2 rounded bg-[#005234] text-[#4edea3] font-bold text-[8.5px]">
                              PASS
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-[#93000a] text-[#ffb4ab] font-bold text-[8.5px]">
                              FAIL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. FULL STREAMS TABLE */}
          {activeTab === 'streams' && (
            <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30 overflow-x-auto max-h-44">
              <table className="w-full text-left font-mono text-[10px]">
                <thead>
                  <tr className="text-[#869397] border-b border-[#3d494c]/30 text-[9.5px] uppercase">
                    <th className="pb-1">Stream Tag</th>
                    <th className="pb-1">Description</th>
                    <th className="pb-1">Phase</th>
                    <th className="pb-1 text-right">Temperature</th>
                    <th className="pb-1 text-right">Pressure</th>
                    <th className="pb-1 text-right">Mass Flow</th>
                    <th className="pb-1 text-right">Vapor Frac (VF)</th>
                    <th className="pb-1 text-right">Density [kg/m³]</th>
                    <th className="pb-1 text-right">MW [g/mol]</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d494c]/20">
                  {streams.map((st) => (
                    <tr
                      key={st.id}
                      onClick={() => onSelectStream(st.id)}
                      className="hover:bg-[#222a3d] cursor-pointer transition-colors"
                    >
                      <td className="py-1 font-bold text-[#4cd7f6]">{st.id}</td>
                      <td className="py-1 text-[#bcc9cd]">{st.name}</td>
                      <td className="py-1 text-[#dae2fd]">{st.phase}</td>
                      <td className="py-1 text-right text-[#ffddb8]">{formatTemp(st.tempC, unitSystem)}</td>
                      <td className="py-1 text-right text-[#dae2fd]">{formatPres(st.presBar, unitSystem)}</td>
                      <td className="py-1 text-right text-[#4edea3]">{formatFlow(st.flowKgH, unitSystem)}</td>
                      <td className="py-1 text-right text-[#4cd7f6]">{st.vaporFraction.toFixed(2)}</td>
                      <td className="py-1 text-right text-[#bcc9cd]">{st.densityKgM3.toFixed(1)}</td>
                      <td className="py-1 text-right text-[#dae2fd]">{st.mw.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 6. COMPOSITION MATRIX TABLE */}
          {activeTab === 'compositions' && (
            <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30 overflow-x-auto max-h-44 font-mono text-[10px]">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[#869397] border-b border-[#3d494c]/30 text-[9.5px] uppercase">
                    <th className="pb-1">Component</th>
                    <th className="pb-1">Formula</th>
                    <th className="pb-1">MW</th>
                    {streams.map((s) => (
                      <th key={s.id} className="pb-1 text-right">{s.id}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d494c]/20">
                  {components.map((comp) => (
                    <tr key={comp.id} className="hover:bg-[#222a3d]">
                      <td className="py-1 font-semibold text-[#4cd7f6]">{comp.name}</td>
                      <td className="py-1 text-[#869397]">{comp.formula}</td>
                      <td className="py-1 text-[#bcc9cd]">{comp.mw}</td>
                      {streams.map((s) => {
                        const val = s.compositions[comp.id] ?? 0.0;
                        return (
                          <td
                            key={s.id}
                            className={`py-1 text-right ${
                              val > 0.1 ? 'text-[#ffddb8] font-bold' : val > 0 ? 'text-[#dae2fd]' : 'text-[#869397]/50'
                            }`}
                          >
                            {val.toFixed(3)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
