import React, { useState, useMemo } from 'react';
import { EquipmentUnit, ProcessStream, ChemicalComponent, UnitSystem } from '../../types/simulation';
import { SimulationResult } from '../../engine/solver/simulationManager';
import { ProcessValidationReport } from '../../engine/validation/processValidator';
import {
  ReportType,
  REPORT_TYPES,
  ProjectMetadata,
  EngineeringReportDocument,
  buildEngineeringReport,
  getDefaultProjectMetadata,
  exportReportToCSV,
  exportReportToJSON,
  triggerFileDownload,
  ENGINEERING_DISCLAIMER,
} from '../../engine/reporting/engineeringReportEngine';

interface EngineeringReportsViewProps {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  components: ChemicalComponent[];
  unitSystem: UnitSystem;
  simulationResult: SimulationResult | null;
  validationReport?: ProcessValidationReport | null;
  onNavigateToFlowsheet?: () => void;
}

export const EngineeringReportsView: React.FC<EngineeringReportsViewProps> = ({
  units,
  streams,
  components,
  unitSystem,
  simulationResult,
  validationReport,
  onNavigateToFlowsheet,
}) => {
  const [activeReportType, setActiveReportType] = useState<ReportType>('simulation');
  const [searchFilter, setSearchFilter] = useState('');
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [metadata, setMetadata] = useState<ProjectMetadata>(() => getDefaultProjectMetadata());

  // Generate the active report document
  const currentReport: EngineeringReportDocument = useMemo(() => {
    return buildEngineeringReport(
      activeReportType,
      simulationResult,
      units,
      streams,
      components,
      unitSystem,
      metadata,
      validationReport
    );
  }, [activeReportType, simulationResult, units, streams, components, unitSystem, metadata, validationReport]);

  const activeDef = REPORT_TYPES.find((r) => r.id === activeReportType) || REPORT_TYPES[0];

  // Actions
  const handlePrintPDF = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Standard window.print() was intercepted or restricted by container frame:', e);
      // Fallback for sandboxed or restricted iframe preview contexts
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const reportEl = document.querySelector('.printable-report-container');
        if (reportEl) {
          printWindow.document.write(`<!DOCTYPE html>
            <html>
              <head>
                <title>${currentReport.title}</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #111827; }
                  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
                  th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; font-size: 10pt; }
                  th { background-color: #f3f4f6; font-weight: bold; }
                </style>
              </head>
              <body>
                ${reportEl.outerHTML}
              </body>
            </html>`);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
      }
    }
  };

  const handleExportCSV = () => {
    const csvContent = exportReportToCSV(currentReport);
    const filename = `${metadata.projectName.replace(/\s+/g, '_')}_${activeReportType}_Report.csv`;
    triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
  };

  const handleExportJSON = () => {
    const jsonContent = exportReportToJSON(currentReport);
    const filename = `${metadata.projectName.replace(/\s+/g, '_')}_${activeReportType}_Report.json`;
    triggerFileDownload(jsonContent, filename, 'application/json;charset=utf-8;');
  };

  const handleCopyClipboard = () => {
    const summaryText = `[PETROSIMX ENGINEERING REPORT]\nTitle: ${currentReport.title}\nProject: ${metadata.projectName} (${metadata.revision})\nDate: ${metadata.simulationDate}\nLead Engineer: ${metadata.leadEngineer}\n\nEXECUTIVE SUMMARY:\n${currentReport.executiveSummary}\n\nKEY KPIS:\n${currentReport.kpis.map((k) => `${k.label}: ${k.value} ${k.unit || ''}`).join('\n')}\n\nDISCLAIMER:\n${ENGINEERING_DISCLAIMER}`;

    navigator.clipboard.writeText(summaryText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPTIMAL':
      case 'CONSERVED':
      case 'PASS':
        return 'text-[#4edea3] bg-[#005234]/40 border-[#4edea3]/40';
      case 'VERIFIED':
      case 'NORMAL':
      case 'COMPLIANT':
        return 'text-[#4cd7f6] bg-[#004e5d]/30 border-[#4cd7f6]/40';
      case 'WARNING':
      case 'CHECK_REQUIRED':
        return 'text-[#ffb95f] bg-[#ffb95f]/20 border-[#ffb95f]/40';
      case 'CRITICAL':
        return 'text-[#ffb4ab] bg-[#93000a]/50 border-[#ffb4ab]/50';
      case 'INFO':
      default:
        return 'text-[#bcc9cd] bg-[#171f33] border-[#3d494c]/50';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060e20] text-[#dae2fd] overflow-hidden">
      {/* 1. Control Toolbar (Hidden in Print) */}
      <div className="no-print bg-[#0b1326] border-b border-[#3d494c]/40 px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[#4cd7f6] font-mono text-[12px] font-bold">
            <span className="material-symbols-outlined text-[20px]">assignment</span>
            <span>ENGINEERING REPORT GENERATOR</span>
          </div>

          <div className="h-4 w-px bg-[#3d494c]/40 mx-1" />

          {/* Report Category & Type Selector */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="report-selector" className="text-[#869397] font-mono text-[11px]">
              REPORT:
            </label>
            <select
              id="report-selector"
              value={activeReportType}
              onChange={(e) => setActiveReportType(e.target.value as ReportType)}
              className="bg-[#131b2e] border border-[#3d494c]/60 text-[#ffddb8] font-mono text-[11px] rounded px-2 py-1 focus:outline-none focus:border-[#4cd7f6]"
            >
              {REPORT_TYPES.map((rep) => (
                <option key={rep.id} value={rep.id} className="bg-[#131b2e]">
                  {rep.title} ({rep.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditingMetadata(!isEditingMetadata)}
            className={`px-2.5 py-1 rounded font-mono text-[11px] flex items-center gap-1.5 transition-colors ${
              isEditingMetadata
                ? 'bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]'
                : 'bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] border border-[#3d494c]/40'
            }`}
            title="Edit Project Header & Title Block Metadata"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">badge</span>
            <span>Project Header</span>
          </button>

          <button
            onClick={handleCopyClipboard}
            className="px-2.5 py-1 bg-[#171f33] hover:bg-[#222a3d] text-[#bcc9cd] hover:text-[#dae2fd] border border-[#3d494c]/40 rounded font-mono text-[11px] flex items-center gap-1.5 transition-colors"
            title="Copy Report Executive Summary to Clipboard"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">
              {copySuccess ? 'done' : 'content_copy'}
            </span>
            <span>{copySuccess ? 'Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1 bg-[#171f33] hover:bg-[#222a3d] text-[#4edea3] border border-[#4edea3]/40 rounded font-mono text-[11px] flex items-center gap-1.5 transition-colors font-semibold"
            title="Export Formatted Engineering CSV Data Table"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">table_view</span>
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-2.5 py-1 bg-[#171f33] hover:bg-[#222a3d] text-[#ffddb8] border border-[#ffddb8]/40 rounded font-mono text-[11px] flex items-center gap-1.5 transition-colors font-semibold"
            title="Export Complete Structured Engineering JSON Document"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">data_object</span>
            <span>Export JSON</span>
          </button>

          <button
            onClick={handlePrintPDF}
            className="px-3 py-1 bg-[#4cd7f6]/20 hover:bg-[#4cd7f6]/30 text-[#4cd7f6] border border-[#4cd7f6] rounded font-mono text-[11px] flex items-center gap-1.5 font-bold transition-all shadow-sm active:scale-95"
            title="Print or Save as Publication-Quality PDF"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Metadata Editor Drawer (Collapsible) */}
      {isEditingMetadata && (
        <div className="no-print bg-[#131b2e] border-b border-[#3d494c]/40 p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-[11px] font-mono">
          <div>
            <label className="text-[#869397] block mb-1">PROJECT NAME:</label>
            <input
              type="text"
              value={metadata.projectName}
              onChange={(e) => setMetadata({ ...metadata, projectName: e.target.value })}
              className="w-full bg-[#060e20] border border-[#3d494c]/60 rounded px-2 py-1 text-[#dae2fd] focus:border-[#4cd7f6] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[#869397] block mb-1">FACILITY / AREA:</label>
            <input
              type="text"
              value={metadata.facility}
              onChange={(e) => setMetadata({ ...metadata, facility: e.target.value })}
              className="w-full bg-[#060e20] border border-[#3d494c]/60 rounded px-2 py-1 text-[#dae2fd] focus:border-[#4cd7f6] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[#869397] block mb-1">PROJECT NUMBER:</label>
            <input
              type="text"
              value={metadata.projectNumber}
              onChange={(e) => setMetadata({ ...metadata, projectNumber: e.target.value })}
              className="w-full bg-[#060e20] border border-[#3d494c]/60 rounded px-2 py-1 text-[#dae2fd] focus:border-[#4cd7f6] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[#869397] block mb-1">REVISION:</label>
            <input
              type="text"
              value={metadata.revision}
              onChange={(e) => setMetadata({ ...metadata, revision: e.target.value })}
              className="w-full bg-[#060e20] border border-[#3d494c]/60 rounded px-2 py-1 text-[#dae2fd] focus:border-[#4cd7f6] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[#869397] block mb-1">LEAD ENGINEER:</label>
            <input
              type="text"
              value={metadata.leadEngineer}
              onChange={(e) => setMetadata({ ...metadata, leadEngineer: e.target.value })}
              className="w-full bg-[#060e20] border border-[#3d494c]/60 rounded px-2 py-1 text-[#dae2fd] focus:border-[#4cd7f6] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[#869397] block mb-1">CLIENT / OWNER:</label>
            <input
              type="text"
              value={metadata.client}
              onChange={(e) => setMetadata({ ...metadata, client: e.target.value })}
              className="w-full bg-[#060e20] border border-[#3d494c]/60 rounded px-2 py-1 text-[#dae2fd] focus:border-[#4cd7f6] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 3. Main Split View: Left Report Index + Right Document Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Report Navigation Strip (10 Reports) */}
        <aside className="no-print w-64 bg-[#0b1326] border-r border-[#3d494c]/30 flex flex-col overflow-y-auto">
          <div className="p-3 border-b border-[#3d494c]/30 flex items-center justify-between">
            <span className="font-mono text-[10.5px] font-semibold tracking-wide text-[#869397]">
              AVAILABLE REPORTS (10)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#004e5d] text-[#4cd7f6]">
              PETRO-CAE
            </span>
          </div>

          <div className="flex-1 py-1">
            {REPORT_TYPES.map((rep) => {
              const isSelected = rep.id === activeReportType;
              return (
                <button
                  key={rep.id}
                  onClick={() => setActiveReportType(rep.id)}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-l-2 ${
                    isSelected
                      ? 'bg-[#171f33] text-[#4cd7f6] border-[#4cd7f6]'
                      : 'border-transparent text-[#bcc9cd] hover:bg-[#131b2e] hover:text-[#dae2fd]'
                  }`}
                  type="button"
                >
                  <span className={`material-symbols-outlined text-[18px] mt-0.5 ${isSelected ? 'text-[#4cd7f6]' : 'text-[#869397]'}`}>
                    {rep.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-medium leading-tight truncate">
                      {rep.title}
                    </div>
                    <div className="text-[9.5px] font-mono text-[#869397] mt-0.5 truncate">
                      {rep.category}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-[#131b2e] border-t border-[#3d494c]/30 text-[10px] font-mono text-[#869397]">
            <div>UNITS: {unitSystem} Standard</div>
            <div className="mt-0.5">CONVERGENCE: {currentReport.flowsheetSummary.converged ? 'VALIDATED' : 'CHECK'}</div>
            <div className="mt-1 text-[#4edea3]">● Deterministic CAE Engine</div>
          </div>
        </aside>

        {/* Right Side: The Printable Engineering Document Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#060e20] flex justify-center">
          <div className="printable-report-container w-full max-w-5xl bg-[#0b1326] border border-[#3d494c]/40 rounded-lg p-6 md:p-10 shadow-2xl flex flex-col gap-6">
            
            {/* Header Title Block */}
            <div className="border-b-2 border-[#4cd7f6]/60 pb-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-[#4cd7f6] uppercase font-bold">
                    <span>PETROSIMX ENGINEERING CLOUD</span>
                    <span>•</span>
                    <span>PROCESS SIMULATION REPORT</span>
                  </div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#dae2fd] mt-1 tracking-tight">
                    {currentReport.title}
                  </h1>
                  <p className="text-[12px] text-[#bcc9cd] mt-0.5">{currentReport.subtitle}</p>
                </div>

                <div className="bg-[#131b2e] border border-[#3d494c]/50 rounded p-2.5 font-mono text-[10px] min-w-[220px]">
                  <div className="flex justify-between">
                    <span className="text-[#869397]">DOC NO:</span>
                    <span className="text-[#dae2fd] font-semibold">{metadata.projectNumber}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[#869397]">REVISION:</span>
                    <span className="text-[#ffddb8] font-semibold">{metadata.revision}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[#869397]">DATE:</span>
                    <span className="text-[#dae2fd]">{metadata.simulationDate.split(',')[0]}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[#869397]">LEAD ENG:</span>
                    <span className="text-[#4cd7f6]">{metadata.leadEngineer.split(' ')[0]}</span>
                  </div>
                </div>
              </div>

              {/* Project Details Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-[#3d494c]/30 text-[10.5px] font-mono">
                <div>
                  <span className="text-[#869397]">PROJECT:</span>
                  <div className="text-[#dae2fd] font-medium truncate">{metadata.projectName}</div>
                </div>
                <div>
                  <span className="text-[#869397]">FACILITY:</span>
                  <div className="text-[#dae2fd] font-medium truncate">{metadata.facility}</div>
                </div>
                <div>
                  <span className="text-[#869397]">PROPERTY PACKAGE:</span>
                  <div className="text-[#ffddb8] font-medium truncate">{metadata.propertyPackage}</div>
                </div>
                <div>
                  <span className="text-[#869397]">SIMULATION ENGINE:</span>
                  <div className="text-[#4edea3] font-medium truncate">{metadata.modelVersion}</div>
                </div>
              </div>
            </div>

            {/* MANDATORY ENGINEERING DISCLAIMER BOX */}
            <div className="report-card p-3.5 bg-[#171f33]/90 border-l-4 border-[#ffb95f] rounded-r text-[11px] leading-relaxed">
              <div className="flex items-center gap-1.5 font-mono text-[#ffb95f] font-bold text-[10.5px] uppercase">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>ENGINEERING SIMULATION NOTICE &amp; DISCLAIMER</span>
              </div>
              <p className="mt-1 text-[#dae2fd]/90">
                <strong>{ENGINEERING_DISCLAIMER}</strong>
              </p>
            </div>

            {/* Executive Summary */}
            <div className="report-card">
              <h2 className="font-mono text-[12px] font-bold tracking-wider text-[#4cd7f6] uppercase border-b border-[#3d494c]/30 pb-1 mb-2">
                EXECUTIVE ENGINEERING SUMMARY
              </h2>
              <p className="text-[12.5px] leading-relaxed text-[#dae2fd]/95 text-justify">
                {currentReport.executiveSummary}
              </p>
            </div>

            {/* Key Performance Indicators (KPIs) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 report-card">
              {currentReport.kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="bg-[#131b2e] border border-[#3d494c]/40 rounded p-2.5 flex flex-col justify-between"
                >
                  <span className="text-[9.5px] font-mono text-[#869397] tracking-wider uppercase">
                    {kpi.label}
                  </span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-[16px] font-mono font-bold text-[#dae2fd]">{kpi.value}</span>
                    {kpi.unit && <span className="text-[9.5px] font-mono text-[#869397]">{kpi.unit}</span>}
                  </div>
                  <div className="mt-1.5">
                    <span
                      className={`report-badge text-[8.5px] font-mono px-1.5 py-0.5 rounded border ${getStatusBadge(
                        kpi.status
                      )}`}
                    >
                      {kpi.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Operating Conditions & Chemical Components */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 report-card">
              {/* Operating Conditions */}
              <div className="bg-[#131b2e] border border-[#3d494c]/40 rounded p-3">
                <h3 className="font-mono text-[11px] font-bold text-[#ffddb8] uppercase mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">speed</span>
                  <span>Operating Conditions &amp; Datum</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[10px]">
                    <thead>
                      <tr className="text-[#869397] border-b border-[#3d494c]/40">
                        <th className="py-1">Variable</th>
                        <th className="py-1">Value</th>
                        <th className="py-1">Unit</th>
                        <th className="py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3d494c]/20">
                      {currentReport.operatingConditionsSummary.map((row, i) => (
                        <tr key={i}>
                          <td className="py-1 text-[#dae2fd] font-sans">{row.variable}</td>
                          <td className="py-1 font-bold text-[#dae2fd]">{row.value}</td>
                          <td className="py-1 text-[#869397]">{row.unit}</td>
                          <td className="py-1">
                            <span className={`report-badge px-1 py-0.2 rounded border text-[8px] ${getStatusBadge(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chemical Components Slate */}
              <div className="bg-[#131b2e] border border-[#3d494c]/40 rounded p-3">
                <h3 className="font-mono text-[11px] font-bold text-[#4edea3] uppercase mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">scatter_plot</span>
                  <span>Chemical Species Slate ({currentReport.components.length})</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[10px]">
                    <thead>
                      <tr className="text-[#869397] border-b border-[#3d494c]/40">
                        <th className="py-1">Component</th>
                        <th className="py-1">Formula</th>
                        <th className="py-1">MW (g/mol)</th>
                        <th className="py-1">Tc (K)</th>
                        <th className="py-1">Pc (bar)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3d494c]/20">
                      {currentReport.components.map((c, i) => (
                        <tr key={i}>
                          <td className="py-1 text-[#dae2fd] font-sans">{c.name}</td>
                          <td className="py-1 text-[#4cd7f6]">{c.formula}</td>
                          <td className="py-1">{c.mw.toFixed(2)}</td>
                          <td className="py-1">{c.tcK.toFixed(1)}</td>
                          <td className="py-1">{c.pcBar.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Dynamic Report Sections with Standardized Tables (Variable | Value | Unit | Status) */}
            {currentReport.sections.map((section) => (
              <div key={section.id} className="report-card flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 border-b border-[#3d494c]/40 pb-1.5">
                  <div>
                    <h2 className="font-mono text-[12px] font-bold tracking-wider text-[#4cd7f6] uppercase">
                      {section.title}
                    </h2>
                    {section.description && (
                      <p className="text-[10.5px] text-[#bcc9cd] font-sans mt-0.5">{section.description}</p>
                    )}
                  </div>

                  {/* Filter box for large tables */}
                  {section.tableRows && section.tableRows.length > 5 && (
                    <div className="no-print flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-[#869397]">filter_alt</span>
                      <input
                        type="text"
                        placeholder="Filter rows..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="bg-[#131b2e] border border-[#3d494c]/50 rounded px-1.5 py-0.5 text-[10px] font-mono text-[#dae2fd] focus:outline-none focus:border-[#4cd7f6]"
                      />
                    </div>
                  )}
                </div>

                {section.tableRows && (
                  <div className="overflow-x-auto bg-[#131b2e] border border-[#3d494c]/40 rounded">
                    <table className="w-full text-left font-mono text-[10.5px]">
                      <thead>
                        <tr className="bg-[#171f33] text-[#869397] border-b border-[#3d494c]/50">
                          <th className="py-1.5 px-3">Variable / Parameter</th>
                          <th className="py-1.5 px-3">Value / Specifications</th>
                          <th className="py-1.5 px-3">Unit / Metric</th>
                          <th className="py-1.5 px-3">Status</th>
                          <th className="py-1.5 px-3">Engineering Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3d494c]/20">
                        {section.tableRows
                          .filter((row) =>
                            searchFilter
                              ? row.variable.toLowerCase().includes(searchFilter.toLowerCase()) ||
                                String(row.value).toLowerCase().includes(searchFilter.toLowerCase()) ||
                                (row.notes && row.notes.toLowerCase().includes(searchFilter.toLowerCase()))
                              : true
                          )
                          .map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#171f33]/40 transition-colors">
                              <td className="py-1.5 px-3 text-[#dae2fd] font-medium font-sans">
                                {row.variable}
                              </td>
                              <td className="py-1.5 px-3 text-[#ffddb8] font-bold">{row.value}</td>
                              <td className="py-1.5 px-3 text-[#869397]">{row.unit}</td>
                              <td className="py-1.5 px-3">
                                <span
                                  className={`report-badge inline-block text-[8.5px] px-1.5 py-0.5 rounded border ${getStatusBadge(
                                    row.status
                                  )}`}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-[#bcc9cd] text-[10px] font-sans">
                                {row.notes || '-'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {/* TRACEABILITY MATRIX (MANDATORY REQUIREMENT) */}
            <div className="report-card">
              <div className="border-b border-[#3d494c]/40 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5 font-mono text-[12px] font-bold tracking-wider text-[#4edea3] uppercase">
                  <span className="material-symbols-outlined text-[16px]">account_tree</span>
                  <span>CALCULATION TRACEABILITY AUDIT MATRIX</span>
                </div>
                <p className="text-[10.5px] text-[#bcc9cd] font-sans mt-0.5">
                  Every calculated engineering metric traced directly from Primary Input through Calculation Model, Governing Equation, and Verified Result.
                </p>
              </div>

              <div className="overflow-x-auto bg-[#131b2e] border border-[#3d494c]/40 rounded">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead>
                    <tr className="bg-[#171f33] text-[#869397] border-b border-[#3d494c]/50">
                      <th className="py-1.5 px-3">Calculated Parameter</th>
                      <th className="py-1.5 px-3">Primary Input Source</th>
                      <th className="py-1.5 px-3">Calculation Model</th>
                      <th className="py-1.5 px-3">Governing Equation / Standard</th>
                      <th className="py-1.5 px-3">Numerical Result</th>
                      <th className="py-1.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3d494c]/20">
                    {currentReport.traceabilityMatrix.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#171f33]/40">
                        <td className="py-1.5 px-3 font-medium text-[#dae2fd] font-sans">
                          {item.calculatedParameter}
                        </td>
                        <td className="py-1.5 px-3 text-[#bcc9cd] font-sans">{item.inputSource}</td>
                        <td className="py-1.5 px-3 text-[#4cd7f6]">{item.calculationModel}</td>
                        <td className="py-1.5 px-3 text-[#ffddb8] font-bold">{item.equationReference}</td>
                        <td className="py-1.5 px-3 text-[#dae2fd]">{item.numericalResult}</td>
                        <td className="py-1.5 px-3">
                          <span
                            className={`report-badge inline-block text-[8.5px] px-1.5 py-0.5 rounded border ${getStatusBadge(
                              item.verificationStatus
                            )}`}
                          >
                            {item.verificationStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Convergence & Diagnostics Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 report-card">
              {/* Solver Convergence */}
              <div className="bg-[#131b2e] border border-[#3d494c]/40 rounded p-3 text-[11px] font-mono">
                <h3 className="font-bold text-[#4cd7f6] uppercase mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">sync</span>
                  <span>Solver Numerical Convergence</span>
                </h3>
                <div className="space-y-1 text-[#dae2fd]">
                  <div className="flex justify-between">
                    <span className="text-[#869397]">Convergence Algorithm:</span>
                    <span>{currentReport.convergenceInformation.algorithm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#869397]">Iterations Completed:</span>
                    <span className="text-[#4edea3] font-bold">
                      {currentReport.convergenceInformation.iterations} / {currentReport.convergenceInformation.maxIterations}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#869397]">Relative Tolerance:</span>
                    <span>{currentReport.convergenceInformation.convergenceTolerance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#869397]">Final Mass Residual:</span>
                    <span className="text-[#4edea3]">
                      {currentReport.convergenceInformation.finalResidualMassKgH.toFixed(4)} kg/h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#869397]">Final Energy Residual:</span>
                    <span className="text-[#4edea3]">
                      {currentReport.convergenceInformation.finalResidualEnergyKW.toFixed(3)} kW
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#869397]">Tear Streams:</span>
                    <span className="text-[#ffddb8]">{currentReport.convergenceInformation.tearStreams.join(', ')}</span>
                  </div>
                </div>
              </div>

              {/* Engineering Assumptions */}
              <div className="bg-[#131b2e] border border-[#3d494c]/40 rounded p-3 text-[10.5px]">
                <h3 className="font-mono font-bold text-[#ffddb8] uppercase mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">checklist</span>
                  <span>Documented Engineering Assumptions</span>
                </h3>
                <ol className="list-decimal pl-4 space-y-1 text-[#dae2fd]/90">
                  {currentReport.engineeringAssumptions.map((asm, idx) => (
                    <li key={idx}>{asm}</li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Warnings and Diagnostics */}
            {currentReport.warningsAndDiagnostics.length > 0 && (
              <div className="report-card bg-[#131b2e] border border-[#3d494c]/40 rounded p-3 text-[10.5px]">
                <h3 className="font-mono font-bold text-[#869397] uppercase mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">info</span>
                  <span>Diagnostics, Warnings &amp; Rule Audits</span>
                </h3>
                <div className="space-y-1">
                  {currentReport.warningsAndDiagnostics.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span
                        className={`report-badge font-mono text-[8px] px-1 py-0.2 rounded border ${
                          w.level === 'ERROR'
                            ? 'text-[#ffb4ab] bg-[#93000a]/50 border-[#ffb4ab]'
                            : w.level === 'WARN'
                            ? 'text-[#ffb95f] bg-[#ffb95f]/20 border-[#ffb95f]'
                            : 'text-[#4cd7f6] bg-[#004e5d]/30 border-[#4cd7f6]'
                        }`}
                      >
                        {w.level}
                      </span>
                      <span className="text-[#dae2fd]">{w.message}</span>
                      {w.source && <span className="text-[#869397] font-mono">[{w.source}]</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formal Engineering Review & Sign-Off Stamp Block */}
            <div className="page-break-inside-avoid border-t-2 border-[#3d494c]/60 pt-4 mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[10px] font-mono">
              <div className="border border-[#3d494c]/40 p-2.5 rounded bg-[#131b2e]">
                <div className="text-[#869397]">ORIGINATOR / PREPARED BY:</div>
                <div className="text-[#dae2fd] font-bold mt-1">{metadata.leadEngineer}</div>
                <div className="text-[#869397] mt-2">Sign: _______________________</div>
                <div className="text-[#869397] mt-0.5">Date: {metadata.simulationDate.split(',')[0]}</div>
              </div>

              <div className="border border-[#3d494c]/40 p-2.5 rounded bg-[#131b2e]">
                <div className="text-[#869397]">CHECKED / TECHNICAL REVIEW:</div>
                <div className="text-[#dae2fd] font-bold mt-1">Senior Lead Chemical / Process Auditor</div>
                <div className="text-[#869397] mt-2">Sign: _______________________</div>
                <div className="text-[#869397] mt-0.5">Status: VERIFIED (ISO 9001)</div>
              </div>

              <div className="border border-[#3d494c]/40 p-2.5 rounded bg-[#131b2e]">
                <div className="text-[#869397]">CLIENT / FACILITY APPROVAL:</div>
                <div className="text-[#dae2fd] font-bold mt-1">{metadata.client}</div>
                <div className="text-[#869397] mt-2">Sign: _______________________</div>
                <div className="text-[#4edea3] mt-0.5 font-bold">RELEASE FOR DETAILED DESIGN</div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center font-mono text-[9px] text-[#869397] pt-2 border-t border-[#3d494c]/20">
              PETROSIMX CLOUD PROCESS ENGINEERING SYSTEM • ALL RIGHTS RESERVED • CONFIDENTIAL SIMULATION DATA •
              PAGE 1 OF 1
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
