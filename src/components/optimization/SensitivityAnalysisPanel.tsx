import React, { useState, useMemo } from 'react';
import { EquipmentUnit, ProcessStream, ChemicalComponent, UnitSystem } from '../../types/simulation';
import {
  SensitivityVariableDefinition,
  SensitivityStudyResult,
  SensitivityMetrics,
} from '../../types/optimization';
import {
  STANDARD_SENSITIVITY_VARIABLES,
  runSensitivityStudy,
  exportSensitivityToCSV,
  exportSensitivityToJSON,
} from '../../engine/optimization/sensitivityEngine';

interface SensitivityAnalysisPanelProps {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  components: ChemicalComponent[];
  unitSystem: UnitSystem;
}

const METRIC_LABELS: Record<keyof SensitivityMetrics, { label: string; unit: string; color: string }> = {
  netOperatingMarginPerHour: { label: 'Net Operating Margin', unit: '$/h', color: '#4edea3' },
  productYieldPct: { label: 'Product Yield', unit: '%', color: '#4cd7f6' },
  energyConsumptionMW: { label: 'Total Energy Consumption', unit: 'MW', color: '#ffb95f' },
  co2EmissionsKgH: { label: 'CO₂ Emissions', unit: 'kg/h', color: '#ff7b72' },
  productionRateKgH: { label: 'Production Rate', unit: 'kg/h', color: '#d2a8ff' },
  operatingCostPerHour: { label: 'Operating Expenses', unit: '$/h', color: '#f0883e' },
  reactantConversionPct: { label: 'Reactant Conversion', unit: '%', color: '#7ee787' },
  peakTemperatureC: { label: 'Peak Bed Temperature', unit: '°C', color: '#ffa657' },
  maxPressureDropBar: { label: 'Max Pressure Drop', unit: 'bar', color: '#79c0ff' },
  furnaceDutyMW: { label: 'Furnace F-101 Duty', unit: 'MW', color: '#ff7b72' },
  compressorPowerKW: { label: 'Compressor Power', unit: 'kW', color: '#56d364' },
  reboilerDutyMW: { label: 'Reboiler Duty', unit: 'MW', color: '#e3b341' },
};

export const SensitivityAnalysisPanel: React.FC<SensitivityAnalysisPanelProps> = ({
  units,
  streams,
  components,
}) => {
  const [selectedVarId, setSelectedVarId] = useState<string>(STANDARD_SENSITIVITY_VARIABLES[0].id);
  const [minValue, setMinValue] = useState<number>(STANDARD_SENSITIVITY_VARIABLES[0].minValue);
  const [maxValue, setMaxValue] = useState<number>(STANDARD_SENSITIVITY_VARIABLES[0].maxValue);
  const [stepCount, setStepCount] = useState<number>(STANDARD_SENSITIVITY_VARIABLES[0].stepCount);

  const [primaryMetric, setPrimaryMetric] = useState<keyof SensitivityMetrics>('netOperatingMarginPerHour');
  const [secondaryMetric, setSecondaryMetric] = useState<keyof SensitivityMetrics | 'none'>('energyConsumptionMW');

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number; val: number } | null>(null);
  const [studyResult, setStudyResult] = useState<SensitivityStudyResult | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  // Handle changing variable definition
  const handleSelectVariable = (varId: string) => {
    setSelectedVarId(varId);
    const def = STANDARD_SENSITIVITY_VARIABLES.find((v) => v.id === varId);
    if (def) {
      setMinValue(def.minValue);
      setMaxValue(def.maxValue);
      setStepCount(def.stepCount);
    }
  };

  const activeVarDef = useMemo(() => {
    const base = STANDARD_SENSITIVITY_VARIABLES.find((v) => v.id === selectedVarId) || STANDARD_SENSITIVITY_VARIABLES[0];
    return {
      ...base,
      minValue,
      maxValue,
      stepCount,
    };
  }, [selectedVarId, minValue, maxValue, stepCount]);

  // Execute Sweep
  const handleRunSweep = async () => {
    setIsRunning(true);
    setProgress({ current: 0, total: stepCount, val: minValue });

    try {
      const res = await runSensitivityStudy(
        activeVarDef,
        units,
        streams,
        components,
        primaryMetric,
        (current, total, val) => {
          setProgress({ current, total, val });
        }
      );
      setStudyResult(res);
    } catch (err: any) {
      console.error('Sensitivity sweep error:', err);
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  // Run initial study once if none exists
  React.useEffect(() => {
    if (!studyResult && !isRunning) {
      handleRunSweep();
    }
  }, []);

  // Export handlers
  const handleExportCSV = () => {
    if (!studyResult) return;
    const csv = exportSensitivityToCSV(studyResult);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensitivity_${studyResult.variable.id}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!studyResult) return;
    const json = exportSensitivityToJSON(studyResult);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensitivity_${studyResult.variable.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTable = () => {
    if (!studyResult) return;
    const csv = exportSensitivityToCSV(studyResult);
    navigator.clipboard.writeText(csv);
    setCopyNotification('Copied to clipboard!');
    setTimeout(() => setCopyNotification(null), 2500);
  };

  // Compute SVG Plot Geometry
  const plotData = useMemo(() => {
    if (!studyResult || studyResult.runs.length === 0) return null;

    const runs = studyResult.runs;
    const xVals = runs.map((r) => r.inputValue);
    const y1Vals = runs.map((r) => r.metrics[primaryMetric]);
    const y2Vals = secondaryMetric !== 'none' ? runs.map((r) => r.metrics[secondaryMetric]) : [];

    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const rangeX = maxX - minX || 1;

    const minY1 = Math.min(...y1Vals);
    const maxY1 = Math.max(...y1Vals);
    const rangeY1 = maxY1 - minY1 || 1;

    const minY2 = y2Vals.length > 0 ? Math.min(...y2Vals) : 0;
    const maxY2 = y2Vals.length > 0 ? Math.max(...y2Vals) : 1;
    const rangeY2 = maxY2 - minY2 || 1;

    const width = 640;
    const height = 260;
    const padding = { top: 25, right: secondaryMetric !== 'none' ? 65 : 30, bottom: 40, left: 65 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const pointsY1 = runs.map((r, i) => {
      const cx = padding.left + ((r.inputValue - minX) / rangeX) * innerW;
      const cy = padding.top + innerH - ((r.metrics[primaryMetric] - minY1) / rangeY1) * innerH;
      return { cx, cy, run: r, index: i };
    });

    const pointsY2 = y2Vals.length > 0
      ? runs.map((r, i) => {
          const cx = padding.left + ((r.inputValue - minX) / rangeX) * innerW;
          const cy = padding.top + innerH - ((r.metrics[secondaryMetric as keyof SensitivityMetrics] - minY2) / rangeY2) * innerH;
          return { cx, cy, run: r, index: i };
        })
      : [];

    const path1 = pointsY1.map((p, i) => (i === 0 ? `M ${p.cx} ${p.cy}` : `L ${p.cx} ${p.cy}`)).join(' ');
    const path2 = pointsY2.map((p, i) => (i === 0 ? `M ${p.cx} ${p.cy}` : `L ${p.cx} ${p.cy}`)).join(' ');

    return {
      width,
      height,
      padding,
      innerW,
      innerH,
      minX,
      maxX,
      minY1,
      maxY1,
      minY2,
      maxY2,
      pointsY1,
      pointsY2,
      path1,
      path2,
    };
  }, [studyResult, primaryMetric, secondaryMetric]);

  return (
    <div className="space-y-4 font-mono text-[11px] select-none">
      {/* Top Banner & Control Bar */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#4cd7f6]/15 flex items-center justify-center text-[#4cd7f6]">
            <span className="material-symbols-outlined text-[20px]">show_chart</span>
          </div>
          <div>
            <div className="text-[#dae2fd] text-[13px] font-bold flex items-center gap-2">
              <span>SENSITIVITY ANALYSIS &amp; PARAMETRIC SWEEPS</span>
              <span className="px-1.5 py-0.2 rounded bg-[#005234] text-[#4edea3] text-[9px] font-bold">
                STEADY-STATE ENSEMBLE
              </span>
            </div>
            <p className="text-[#869397] text-[10px]">
              Perform one-dimensional parameter variation studies across operating boundaries with rigorous convergence checking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunSweep}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4cd7f6] text-[#003640] font-bold rounded hover:opacity-90 active:scale-95 transition-all shadow"
          >
            <span className={`material-symbols-outlined text-[16px] ${isRunning ? 'animate-spin' : ''}`}>
              {isRunning ? 'refresh' : 'play_arrow'}
            </span>
            <span>{isRunning ? `EVALUATING ${progress?.current}/${progress?.total}...` : 'RUN SENSITIVITY SWEEP'}</span>
          </button>
        </div>
      </div>

      {/* Sweep Configuration Box */}
      <div className="grid grid-cols-12 gap-3 bg-[#131b2e] p-3 rounded border border-[#3d494c]/30">
        {/* Variable Selector (Cols 1-4) */}
        <div className="col-span-12 md:col-span-4 space-y-1">
          <label className="text-[#869397] text-[10px] block uppercase font-semibold">
            Input Variable Target:
          </label>
          <select
            value={selectedVarId}
            onChange={(e) => handleSelectVariable(e.target.value)}
            disabled={isRunning}
            className="w-full bg-[#1e2738] border border-[#3d494c]/40 text-[#dae2fd] rounded px-2 py-1.5 text-[11px] focus:border-[#4cd7f6] focus:outline-none"
          >
            {STANDARD_SENSITIVITY_VARIABLES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} [{v.unit}] ({v.targetId})
              </option>
            ))}
          </select>
          <p className="text-[#869397] text-[9.5px] italic pt-0.5">
            {activeVarDef.description}
          </p>
        </div>

        {/* Min Value (Cols 5-6) */}
        <div className="col-span-6 md:col-span-2 space-y-1">
          <label className="text-[#869397] text-[10px] block uppercase font-semibold">
            Min Value [{activeVarDef.unit}]:
          </label>
          <input
            type="number"
            value={minValue}
            onChange={(e) => setMinValue(parseFloat(e.target.value) || 0)}
            disabled={isRunning}
            className="w-full bg-[#1e2738] border border-[#3d494c]/40 text-[#ffddb8] font-bold rounded px-2 py-1.5 text-[11px] focus:border-[#4cd7f6] focus:outline-none"
          />
        </div>

        {/* Max Value (Cols 7-8) */}
        <div className="col-span-6 md:col-span-2 space-y-1">
          <label className="text-[#869397] text-[10px] block uppercase font-semibold">
            Max Value [{activeVarDef.unit}]:
          </label>
          <input
            type="number"
            value={maxValue}
            onChange={(e) => setMaxValue(parseFloat(e.target.value) || 0)}
            disabled={isRunning}
            className="w-full bg-[#1e2738] border border-[#3d494c]/40 text-[#4edea3] font-bold rounded px-2 py-1.5 text-[11px] focus:border-[#4cd7f6] focus:outline-none"
          />
        </div>

        {/* Steps (Cols 9-10) */}
        <div className="col-span-6 md:col-span-2 space-y-1">
          <label className="text-[#869397] text-[10px] block uppercase font-semibold">
            Number of Steps:
          </label>
          <select
            value={stepCount}
            onChange={(e) => setStepCount(parseInt(e.target.value))}
            disabled={isRunning}
            className="w-full bg-[#1e2738] border border-[#3d494c]/40 text-[#4cd7f6] font-bold rounded px-2 py-1.5 text-[11px] focus:border-[#4cd7f6] focus:outline-none"
          >
            <option value="5">5 Steps (Quick)</option>
            <option value="8">8 Steps</option>
            <option value="11">11 Steps (Standard)</option>
            <option value="16">16 Steps (Fine)</option>
            <option value="21">21 Steps (High Res)</option>
          </select>
        </div>

        {/* Step Preview (Cols 11-12) */}
        <div className="col-span-6 md:col-span-2 space-y-1">
          <label className="text-[#869397] text-[10px] block uppercase font-semibold">
            Step Size Δ:
          </label>
          <div className="bg-[#060e20] border border-[#3d494c]/20 rounded px-2 py-1.5 text-[#dae2fd] font-bold">
            {stepCount > 1 ? ((maxValue - minValue) / (stepCount - 1)).toFixed(2) : 0} {activeVarDef.unit}
          </div>
        </div>
      </div>

      {/* Realtime Progress Bar */}
      {isRunning && progress && (
        <div className="bg-[#171f33] p-2.5 rounded border border-[#4cd7f6]/40 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#4cd7f6] font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
              <span>Running Simulation {progress.current} of {progress.total}</span>
            </span>
            <span className="text-[#dae2fd]">
              Current Input: <strong className="text-[#ffddb8]">{progress.val} {activeVarDef.unit}</strong>
            </span>
          </div>
          <div className="w-full bg-[#060e20] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#4cd7f6] h-full transition-all duration-150"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary Statistics Bar (Min, Max, Average, Best Case) */}
      {studyResult && (
        <div className="grid grid-cols-12 gap-3">
          {/* Min Metric */}
          <div className="col-span-6 md:col-span-3 bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
            <span className="text-[#869397] block text-[9px] uppercase">
              Minimum {METRIC_LABELS[primaryMetric]?.label}
            </span>
            <span className="text-[#ffb95f] font-bold text-[14px] block mt-0.5">
              {studyResult.summaryStats.minVal.toLocaleString()} {METRIC_LABELS[primaryMetric]?.unit}
            </span>
            <span className="text-[#869397] text-[9px]">Across parametric range</span>
          </div>

          {/* Max Metric */}
          <div className="col-span-6 md:col-span-3 bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
            <span className="text-[#869397] block text-[9px] uppercase">
              Maximum {METRIC_LABELS[primaryMetric]?.label}
            </span>
            <span className="text-[#4cd7f6] font-bold text-[14px] block mt-0.5">
              {studyResult.summaryStats.maxVal.toLocaleString()} {METRIC_LABELS[primaryMetric]?.unit}
            </span>
            <span className="text-[#869397] text-[9px]">Peak operating limit</span>
          </div>

          {/* Average Metric */}
          <div className="col-span-6 md:col-span-3 bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
            <span className="text-[#869397] block text-[9px] uppercase">
              Average {METRIC_LABELS[primaryMetric]?.label}
            </span>
            <span className="text-[#dae2fd] font-bold text-[14px] block mt-0.5">
              {studyResult.summaryStats.avgVal.toLocaleString()} {METRIC_LABELS[primaryMetric]?.unit}
            </span>
            <span className="text-[#869397] text-[9px]">Mean ensemble response</span>
          </div>

          {/* Best Case */}
          <div className="col-span-6 md:col-span-3 bg-[#171f33] p-2.5 rounded border border-[#4edea3]/50 bg-[#005234]/10">
            <div className="flex items-center justify-between">
              <span className="text-[#4edea3] block text-[9px] uppercase font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">stars</span>
                <span>Best Operating Case (#{studyResult.summaryStats.bestCaseIndex})</span>
              </span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-[#4edea3]/20 text-[#4edea3] font-bold">
                OPTIMAL
              </span>
            </div>
            <span className="text-[#4edea3] font-bold text-[14px] block mt-0.5">
              {studyResult.summaryStats.bestMetricValue.toLocaleString()} {METRIC_LABELS[primaryMetric]?.unit}
            </span>
            <span className="text-[#dae2fd] text-[9px]">
              At {activeVarDef.name} = <strong className="text-[#ffddb8]">{studyResult.summaryStats.bestInputValue} {activeVarDef.unit}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Chart & Curves Section */}
      <div className="grid grid-cols-12 gap-3">
        {/* Interactive SVG Plot (Cols 1 to 8) */}
        <div className="col-span-12 lg:col-span-8 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-2">
          {/* Plot Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3d494c]/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[#dae2fd] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[16px]">stacked_line_chart</span>
                <span>Response Curves (X/Y Parametric Plot)</span>
              </span>
            </div>

            {/* Primary & Secondary Metric Selectors */}
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4edea3]"></span>
                <span className="text-[#869397]">Primary (Y1):</span>
                <select
                  value={primaryMetric}
                  onChange={(e) => setPrimaryMetric(e.target.value as keyof SensitivityMetrics)}
                  className="bg-[#060e20] text-[#4edea3] font-bold border border-[#3d494c]/30 rounded px-1.5 py-0.5 text-[10px]"
                >
                  {Object.entries(METRIC_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label} [{v.unit}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffb95f]"></span>
                <span className="text-[#869397]">Secondary (Y2):</span>
                <select
                  value={secondaryMetric}
                  onChange={(e) => setSecondaryMetric(e.target.value as any)}
                  className="bg-[#060e20] text-[#ffb95f] font-bold border border-[#3d494c]/30 rounded px-1.5 py-0.5 text-[10px]"
                >
                  <option value="none">None (Single Curve)</option>
                  {Object.entries(METRIC_LABELS)
                    .filter(([k]) => k !== primaryMetric)
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} [{v.unit}]
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* SVG Plot Canvas */}
          {plotData ? (
            <div className="relative overflow-x-auto bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
              <svg viewBox={`0 0 ${plotData.width} ${plotData.height}`} className="w-full h-auto select-none">
                {/* Grid lines horizontal */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                  const y = plotData.padding.top + plotData.innerH * (1 - frac);
                  const y1Val = plotData.minY1 + frac * (plotData.maxY1 - plotData.minY1);
                  const y2Val = plotData.minY2 + frac * (plotData.maxY2 - plotData.minY2);
                  return (
                    <g key={idx}>
                      <line
                        x1={plotData.padding.left}
                        y1={y}
                        x2={plotData.padding.left + plotData.innerW}
                        y2={y}
                        stroke="#3d494c"
                        strokeOpacity="0.3"
                        strokeDasharray="3 3"
                      />
                      {/* Left axis label (Y1) */}
                      <text
                        x={plotData.padding.left - 8}
                        y={y + 3}
                        fill="#4edea3"
                        fontSize="9"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {y1Val > 1000 ? (y1Val / 1000).toFixed(1) + 'k' : y1Val.toFixed(1)}
                      </text>
                      {/* Right axis label (Y2) */}
                      {secondaryMetric !== 'none' && (
                        <text
                          x={plotData.padding.left + plotData.innerW + 8}
                          y={y + 3}
                          fill="#ffb95f"
                          fontSize="9"
                          textAnchor="start"
                          fontFamily="monospace"
                        >
                          {y2Val > 1000 ? (y2Val / 1000).toFixed(1) + 'k' : y2Val.toFixed(1)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Grid lines vertical */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                  const x = plotData.padding.left + plotData.innerW * frac;
                  const xVal = plotData.minX + frac * (plotData.maxX - plotData.minX);
                  return (
                    <g key={idx}>
                      <line
                        x1={x}
                        y1={plotData.padding.top}
                        x2={x}
                        y2={plotData.padding.top + plotData.innerH}
                        stroke="#3d494c"
                        strokeOpacity="0.25"
                      />
                      <text
                        x={x}
                        y={plotData.padding.top + plotData.innerH + 16}
                        fill="#869397"
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {xVal.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis title */}
                <text
                  x={plotData.padding.left + plotData.innerW / 2}
                  y={plotData.height - 8}
                  fill="#dae2fd"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {activeVarDef.name} [{activeVarDef.unit}]
                </text>

                {/* Curve 1 (Primary Y1) */}
                <path d={plotData.path1} fill="none" stroke="#4edea3" strokeWidth="2.5" />

                {/* Curve 2 (Secondary Y2) */}
                {secondaryMetric !== 'none' && (
                  <path d={plotData.path2} fill="none" stroke="#ffb95f" strokeWidth="2" strokeDasharray="4 2" />
                )}

                {/* Points on Curve 1 */}
                {plotData.pointsY1.map((p) => {
                  const isHovered = hoveredPointIndex === p.index;
                  const isBest = studyResult?.summaryStats.bestCaseIndex === p.run.caseIndex;
                  return (
                    <g
                      key={p.index}
                      onMouseEnter={() => setHoveredPointIndex(p.index)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={p.cx}
                        cy={p.cy}
                        r={isBest ? 6 : isHovered ? 5 : 3.5}
                        fill={isBest ? '#4edea3' : '#171f33'}
                        stroke="#4edea3"
                        strokeWidth={isBest ? 3 : 2}
                      />
                      {isBest && (
                        <circle
                          cx={p.cx}
                          cy={p.cy}
                          r={10}
                          fill="none"
                          stroke="#4edea3"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                          opacity="0.7"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Hover Tooltip inside SVG */}
                {hoveredPointIndex !== null && plotData.pointsY1[hoveredPointIndex] && (
                  <g>
                    {(() => {
                      const pt = plotData.pointsY1[hoveredPointIndex];
                      const run = pt.run;
                      const tx = Math.min(plotData.width - 160, Math.max(70, pt.cx - 75));
                      const ty = Math.max(10, pt.cy - 70);
                      return (
                        <g>
                          <line
                            x1={pt.cx}
                            y1={plotData.padding.top}
                            x2={pt.cx}
                            y2={plotData.padding.top + plotData.innerH}
                            stroke="#4cd7f6"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                            opacity="0.8"
                          />
                          <rect
                            x={tx}
                            y={ty}
                            width="155"
                            height="58"
                            rx="4"
                            fill="#171f33"
                            stroke="#4cd7f6"
                            strokeWidth="1"
                            opacity="0.95"
                          />
                          <text x={tx + 8} y={ty + 14} fill="#dae2fd" fontSize="9" fontWeight="bold">
                            Case {run.caseIndex}: {run.inputValue} {activeVarDef.unit}
                          </text>
                          <text x={tx + 8} y={ty + 28} fill="#4edea3" fontSize="9">
                            {METRIC_LABELS[primaryMetric]?.label}: {run.metrics[primaryMetric].toLocaleString()}{' '}
                            {METRIC_LABELS[primaryMetric]?.unit}
                          </text>
                          {secondaryMetric !== 'none' && (
                            <text x={tx + 8} y={ty + 42} fill="#ffb95f" fontSize="9">
                              {METRIC_LABELS[secondaryMetric]?.label}:{' '}
                              {run.metrics[secondaryMetric as keyof SensitivityMetrics].toLocaleString()}{' '}
                              {METRIC_LABELS[secondaryMetric]?.unit}
                            </text>
                          )}
                          <text x={tx + 8} y={ty + 54} fill={run.converged ? '#4edea3' : '#ff7b72'} fontSize="8">
                            {run.converged ? '✓ Converged' : '⚠ Diverged'} ({run.iterations} iters)
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}
              </svg>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-[#869397]">
              No study data available. Click "RUN SENSITIVITY SWEEP" to calculate.
            </div>
          )}
        </div>

        {/* Legend & Selected Point Inspector (Cols 9 to 12) */}
        <div className="col-span-12 lg:col-span-4 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
          <span className="text-[#dae2fd] font-bold flex items-center gap-1 border-b border-[#3d494c]/30 pb-1.5">
            <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">info</span>
            Operating Point Inspector
          </span>

          {studyResult ? (
            <div className="space-y-2">
              {(() => {
                const inspectIndex =
                  hoveredPointIndex !== null ? hoveredPointIndex : studyResult.summaryStats.bestCaseIndex - 1;
                const inspectRun = studyResult.runs[inspectIndex] || studyResult.runs[0];
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
                      <div>
                        <span className="text-[#869397] text-[9px] block">Inspected Case:</span>
                        <span className="text-[#dae2fd] font-bold text-[12px]">
                          Case #{inspectRun.caseIndex}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[#869397] text-[9px] block">Parameter Value:</span>
                        <span className="text-[#ffddb8] font-bold text-[12px]">
                          {inspectRun.inputValue} {activeVarDef.unit}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 bg-[#060e20] p-2 rounded border border-[#3d494c]/20 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-[#869397]">Product Yield:</span>
                        <span className="text-[#4cd7f6] font-bold">{inspectRun.metrics.productYieldPct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869397]">Production Rate:</span>
                        <span className="text-[#dae2fd] font-bold">{inspectRun.metrics.productionRateKgH.toLocaleString()} kg/h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869397]">Reactant Conversion:</span>
                        <span className="text-[#7ee787] font-bold">{inspectRun.metrics.reactantConversionPct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869397]">Total Energy:</span>
                        <span className="text-[#ffb95f] font-bold">{inspectRun.metrics.energyConsumptionMW} MW</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869397]">CO₂ Emissions:</span>
                        <span className="text-[#ff7b72] font-bold">{inspectRun.metrics.co2EmissionsKgH.toLocaleString()} kg/h</span>
                      </div>
                      <div className="flex justify-between border-t border-[#3d494c]/30 pt-1">
                        <span className="text-[#869397]">Operating Cost:</span>
                        <span className="text-[#f0883e] font-bold">${inspectRun.metrics.operatingCostPerHour.toLocaleString()}/h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#869397]">Net Operating Margin:</span>
                        <span className="text-[#4edea3] font-bold text-[11px]">${inspectRun.metrics.netOperatingMarginPerHour.toLocaleString()}/h</span>
                      </div>
                    </div>

                    {/* Convergence & Safety Warnings */}
                    <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/20 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#869397]">Solver Convergence:</span>
                        <span className={`font-bold ${inspectRun.converged ? 'text-[#4edea3]' : 'text-[#ff7b72]'}`}>
                          {inspectRun.converged ? `CONVERGED (${inspectRun.iterations} iters)` : 'DIVERGED'}
                        </span>
                      </div>
                      {inspectRun.warnings.length > 0 ? (
                        <div className="text-[#ffb95f] text-[9px] pt-1">
                          {inspectRun.warnings.map((w, idx) => (
                            <div key={idx}>⚠ {w}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[#4edea3] text-[9px]">✓ All thermodynamic and hydraulic constraints satisfied.</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-[#869397] text-[10px]">Select and run a sweep to inspect operating points.</div>
          )}
        </div>
      </div>

      {/* Results Table & Export Bar */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3d494c]/30 pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4edea3] text-[16px]">table_chart</span>
            <span className="text-[#dae2fd] font-bold">Comprehensive Multi-Case Results Table</span>
          </div>

          <div className="flex items-center gap-2">
            {copyNotification && (
              <span className="text-[#4edea3] text-[10px] font-bold animate-pulse">
                {copyNotification}
              </span>
            )}
            <button
              onClick={handleCopyTable}
              disabled={!studyResult}
              className="px-2.5 py-1 bg-[#1e2738] hover:bg-[#28344c] text-[#dae2fd] rounded border border-[#3d494c]/40 flex items-center gap-1 text-[10px]"
            >
              <span className="material-symbols-outlined text-[13px]">content_copy</span>
              <span>Copy CSV</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={!studyResult}
              className="px-2.5 py-1 bg-[#1e2738] hover:bg-[#28344c] text-[#4cd7f6] rounded border border-[#4cd7f6]/40 flex items-center gap-1 text-[10px]"
            >
              <span className="material-symbols-outlined text-[13px]">download</span>
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              disabled={!studyResult}
              className="px-2.5 py-1 bg-[#1e2738] hover:bg-[#28344c] text-[#ffddb8] rounded border border-[#ffddb8]/40 flex items-center gap-1 text-[10px]"
            >
              <span className="material-symbols-outlined text-[13px]">data_object</span>
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-[#060e20] text-[#869397] border-b border-[#3d494c]/30 sticky top-0">
              <tr>
                <th className="py-1.5 px-2">Case</th>
                <th className="py-1.5 px-2">{activeVarDef.name} [{activeVarDef.unit}]</th>
                <th className="py-1.5 px-2">Status</th>
                <th className="py-1.5 px-2 text-right">Yield [%]</th>
                <th className="py-1.5 px-2 text-right">Prod. [kg/h]</th>
                <th className="py-1.5 px-2 text-right">Total Energy [MW]</th>
                <th className="py-1.5 px-2 text-right">CO₂ [kg/h]</th>
                <th className="py-1.5 px-2 text-right">OPEX [$/h]</th>
                <th className="py-1.5 px-2 text-right font-bold text-[#4edea3]">Net Margin [$/h]</th>
                <th className="py-1.5 px-2 text-right">Peak Bed T [°C]</th>
                <th className="py-1.5 px-2 text-right">Max ΔP [bar]</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d494c]/20">
              {studyResult?.runs.map((r) => {
                const isBest = studyResult.summaryStats.bestCaseIndex === r.caseIndex;
                return (
                  <tr
                    key={r.caseIndex}
                    className={`hover:bg-[#1e2738] transition-colors ${
                      isBest ? 'bg-[#005234]/20 font-semibold' : ''
                    }`}
                  >
                    <td className="py-1 px-2 text-[#4cd7f6] flex items-center gap-1">
                      <span>#{r.caseIndex}</span>
                      {isBest && (
                        <span className="text-[#4edea3] text-[11px] font-bold">★</span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-[#ffddb8] font-bold">{r.inputValue}</td>
                    <td className="py-1 px-2">
                      <span
                        className={`px-1 py-0.2 rounded text-[9px] ${
                          r.converged ? 'bg-[#005234] text-[#4edea3]' : 'bg-[#93000a] text-[#ffb4ab]'
                        }`}
                      >
                        {r.converged ? 'CONV' : 'DIV'}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right text-[#dae2fd]">{r.metrics.productYieldPct}%</td>
                    <td className="py-1 px-2 text-right text-[#dae2fd]">{r.metrics.productionRateKgH.toLocaleString()}</td>
                    <td className="py-1 px-2 text-right text-[#ffb95f]">{r.metrics.energyConsumptionMW}</td>
                    <td className="py-1 px-2 text-right text-[#ff7b72]">{r.metrics.co2EmissionsKgH.toLocaleString()}</td>
                    <td className="py-1 px-2 text-right text-[#f0883e]">${r.metrics.operatingCostPerHour.toLocaleString()}</td>
                    <td className="py-1 px-2 text-right text-[#4edea3] font-bold">
                      ${r.metrics.netOperatingMarginPerHour.toLocaleString()}
                    </td>
                    <td className="py-1 px-2 text-right text-[#dae2fd]">{r.metrics.peakTemperatureC}</td>
                    <td className="py-1 px-2 text-right text-[#dae2fd]">{r.metrics.maxPressureDropBar}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
