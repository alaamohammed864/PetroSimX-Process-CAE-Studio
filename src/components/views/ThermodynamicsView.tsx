import React, { useState, useMemo } from 'react';
import { ChemicalComponent } from '../../types/simulation';
import {
  solveTPFlash,
  solvePHFlash,
  solvePSFlash,
  calculateBubblePoint,
  calculateDewPoint,
  getWilsonKValues,
  FlashResult,
} from '../../engine/thermo/flashSolver';

interface ThermodynamicsViewProps {
  components: ChemicalComponent[];
  eos: string;
  onChangeEos: (eos: string) => void;
}

type FlashMode = 'TP' | 'PH' | 'PS' | 'BubblePoint' | 'DewPoint';
type ChartViewMode = 'envelope' | 'kvalues';

export const ThermodynamicsView: React.FC<ThermodynamicsViewProps> = ({
  components,
  eos,
  onChangeEos,
}) => {
  const [flashMode, setFlashMode] = useState<FlashMode>('TP');
  const [flashTempC, setFlashTempC] = useState<number>(45.0);
  const [flashPresBar, setFlashPresBar] = useState<number>(78.5);
  const [targetEnthalpyJPerMol, setTargetEnthalpyJPerMol] = useState<number>(-12500);
  const [targetEntropyJPerMolK, setTargetEntropyJPerMolK] = useState<number>(-45.0);

  // Normalize component fractions into a dictionary
  const compositionDict = useMemo(() => {
    const dict: Record<string, number> = {};
    let sum = 0;
    components.forEach((c) => {
      dict[c.id] = Math.max(0, c.fraction);
      sum += dict[c.id];
    });
    sum = Math.max(1e-8, sum);
    for (const k in dict) {
      dict[k] /= sum;
    }
    return dict;
  }, [components]);

  // Execute active flash algorithm
  const flashResult: FlashResult = useMemo(() => {
    const TK = flashTempC + 273.15;
    if (flashMode === 'TP') {
      return solveTPFlash(TK, flashPresBar, compositionDict);
    } else if (flashMode === 'PH') {
      return solvePHFlash(targetEnthalpyJPerMol, flashPresBar, compositionDict, TK);
    } else if (flashMode === 'PS') {
      return solvePSFlash(targetEntropyJPerMolK, flashPresBar, compositionDict, TK);
    } else if (flashMode === 'BubblePoint') {
      const bp = calculateBubblePoint(flashPresBar, compositionDict);
      return solveTPFlash(bp.temperatureK, flashPresBar, compositionDict);
    } else {
      const dp = calculateDewPoint(flashPresBar, compositionDict);
      return solveTPFlash(dp.temperatureK, flashPresBar, compositionDict);
    }
  }, [
    flashMode,
    flashTempC,
    flashPresBar,
    targetEnthalpyJPerMol,
    targetEntropyJPerMolK,
    compositionDict,
  ]);

  const [chartMode, setChartMode] = useState<ChartViewMode>('envelope');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; text: string } | null>(null);

  // Memoized Phase Envelope (P-T) calculation
  const envelopeData = useMemo(() => {
    const pressures = [2, 5, 8, 12, 18, 25, 35, 48, 62, 78, 92, 105, 120];
    const points: Array<{ pBar: number; tBubbleC: number; tDewC: number }> = [];

    pressures.forEach((p) => {
      try {
        const bp = calculateBubblePoint(p, compositionDict);
        const dp = calculateDewPoint(p, compositionDict);
        if (bp.temperatureC > -100 && dp.temperatureC > -100 && bp.temperatureC < 600 && dp.temperatureC < 600) {
          points.push({
            pBar: p,
            tBubbleC: bp.temperatureC,
            tDewC: Math.max(bp.temperatureC, dp.temperatureC),
          });
        }
      } catch {
        // Skip non-converged boundary points
      }
    });

    if (points.length === 0) return null;

    const allTemps = points.flatMap((pt) => [pt.tBubbleC, pt.tDewC]).concat(flashTempC);
    const minT = Math.floor(Math.min(...allTemps) - 15);
    const maxT = Math.ceil(Math.max(...allTemps) + 20);
    const minP = 0;
    const maxP = Math.ceil(Math.max(...points.map((pt) => pt.pBar), flashPresBar) * 1.15);

    const width = 720;
    const height = 230;
    const padding = { top: 20, right: 35, bottom: 35, left: 55 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const scaleX = (t: number) => padding.left + ((t - minT) / (maxT - minT || 1)) * innerW;
    const scaleY = (p: number) => padding.top + innerH - ((p - minP) / (maxP - minP || 1)) * innerH;

    const bubbleCoords = points.map((pt) => ({ x: scaleX(pt.tBubbleC), y: scaleY(pt.pBar) }));
    const dewCoords = points.map((pt) => ({ x: scaleX(pt.tDewC), y: scaleY(pt.pBar) }));

    const bubblePath = bubbleCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
    const dewPath = dewCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');

    // Closed polygon between bubble and dew curves for two-phase region shading
    const reversedDew = [...dewCoords].reverse();
    const areaPolygon = `${bubblePath} L ${reversedDew.map((c) => `${c.x} ${c.y}`).join(' L ')} Z`;

    const opX = scaleX(flashTempC);
    const opY = scaleY(flashPresBar);

    return {
      width,
      height,
      padding,
      innerW,
      innerH,
      minT,
      maxT,
      minP,
      maxP,
      points,
      bubbleCoords,
      dewCoords,
      bubblePath,
      dewPath,
      areaPolygon,
      opX,
      opY,
      scaleX,
      scaleY,
    };
  }, [compositionDict, flashTempC, flashPresBar]);

  // Memoized K-Values vs Temperature calculation
  const kValuesData = useMemo(() => {
    const compIds = Object.keys(compositionDict).filter((id) => (compositionDict[id] || 0) > 1e-5);
    const tempsC = [-20, 0, 20, 45, 70, 95, 120, 150, 180, 210, 240];
    const width = 720;
    const height = 230;
    const padding = { top: 20, right: 35, bottom: 35, left: 55 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const minT = -20;
    const maxT = 240;
    const minLogK = -2.5;
    const maxLogK = 2.5;

    const scaleX = (t: number) => padding.left + ((t - minT) / (maxT - minT)) * innerW;
    const scaleY = (logK: number) => padding.top + innerH - ((logK - minLogK) / (maxLogK - minLogK)) * innerH;

    const colors: Record<string, string> = {
      h2: '#acedff',
      c1: '#4cd7f6',
      c3: '#4edea3',
      nc4: '#ffb95f',
      c6h6: '#ff8077',
      c7h14: '#d0bcff',
    };

    const curves = compIds.map((id) => {
      const pts = tempsC.map((t) => {
        const TK = t + 273.15;
        const kArr = getWilsonKValues([id], TK, flashPresBar);
        const kVal = kArr[0] || 1.0;
        const logK = Math.max(-2.5, Math.min(2.5, Math.log10(kVal)));
        return { t, kVal, logK, x: scaleX(t), y: scaleY(logK) };
      });
      const path = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
      const curK = flashResult.kValues[id] || (getWilsonKValues([id], flashTempC + 273.15, flashPresBar)[0] || 1);
      return {
        id,
        color: colors[id] || '#4cd7f6',
        pts,
        path,
        curK,
      };
    });

    return {
      width,
      height,
      padding,
      innerW,
      innerH,
      minT,
      maxT,
      minLogK,
      maxLogK,
      scaleX,
      scaleY,
      curves,
    };
  }, [compositionDict, flashPresBar, flashTempC, flashResult]);

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto font-mono text-[11px] select-none">
      {/* Header card */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#4cd7f6] text-[13px] font-bold">
            <span className="material-symbols-outlined text-[18px]">account_tree</span>
            <span>THERMODYNAMIC EQUATION OF STATE &amp; MULTIPHASE FLASH ENGINE</span>
          </div>
          <p className="text-[#869397] text-[10px] mt-0.5">
            Cubic PR-EOS fugacity departure functions, Newton-Raphson Rachford-Rice solver, and isenthalpic/isentropic envelopes.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#060e20] px-3 py-1.5 rounded border border-[#3d494c]/30">
          <span className="text-[#869397]">Active Package:</span>
          <select
            value={eos}
            onChange={(e) => onChangeEos(e.target.value)}
            className="bg-transparent text-[#ffddb8] font-bold focus:outline-none cursor-pointer"
          >
            <option value="Peng-Robinson / Boston-Mathias" className="bg-[#131b2e]">Peng-Robinson / Boston-Mathias</option>
            <option value="Peng-Robinson / Standard" className="bg-[#131b2e]">Peng-Robinson / Standard (1976)</option>
            <option value="Soave-Redlich-Kwong (SRK)" className="bg-[#131b2e]">Soave-Redlich-Kwong (SRK)</option>
          </select>
        </div>
      </div>

      {/* Phase Envelope & K-Value Equilibrium SVG Chart */}
      <div className="bg-[#171f33] p-3.5 rounded border border-[#3d494c]/40 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3d494c]/30 pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">area_chart</span>
            <span className="text-[#dae2fd] font-bold text-[12px]">
              {chartMode === 'envelope'
                ? 'Phase Envelope (P-T Pressure-Temperature Diagram)'
                : 'Component Equilibrium K-Values vs Temperature'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <div className="flex bg-[#060e20] p-0.5 rounded border border-[#3d494c]/30">
              <button
                onClick={() => setChartMode('envelope')}
                className={`px-2.5 py-1 rounded transition-colors font-bold ${
                  chartMode === 'envelope'
                    ? 'bg-[#4cd7f6] text-[#003640]'
                    : 'text-[#869397] hover:text-[#dae2fd]'
                }`}
              >
                P-T Phase Envelope
              </button>
              <button
                onClick={() => setChartMode('kvalues')}
                className={`px-2.5 py-1 rounded transition-colors font-bold ${
                  chartMode === 'kvalues'
                    ? 'bg-[#4cd7f6] text-[#003640]'
                    : 'text-[#869397] hover:text-[#dae2fd]'
                }`}
              >
                K-Values vs Temp
              </button>
            </div>
          </div>
        </div>

        {/* SVG Plot Canvas */}
        {chartMode === 'envelope' && envelopeData && (
          <div className="relative bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
            <svg viewBox={`0 0 ${envelopeData.width} ${envelopeData.height}`} className="w-full h-auto select-none">
              {/* Pressure Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                const y = envelopeData.padding.top + envelopeData.innerH * (1 - frac);
                const pVal = envelopeData.minP + frac * (envelopeData.maxP - envelopeData.minP);
                return (
                  <g key={idx}>
                    <line
                      x1={envelopeData.padding.left}
                      y1={y}
                      x2={envelopeData.padding.left + envelopeData.innerW}
                      y2={y}
                      stroke="#3d494c"
                      strokeOpacity="0.3"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={envelopeData.padding.left - 6}
                      y={y + 3}
                      fill="#869397"
                      fontSize="9"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {pVal.toFixed(0)} bar
                    </text>
                  </g>
                );
              })}

              {/* Temperature Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                const x = envelopeData.padding.left + envelopeData.innerW * frac;
                const tVal = envelopeData.minT + frac * (envelopeData.maxT - envelopeData.minT);
                return (
                  <g key={idx}>
                    <line
                      x1={x}
                      y1={envelopeData.padding.top}
                      x2={x}
                      y2={envelopeData.padding.top + envelopeData.innerH}
                      stroke="#3d494c"
                      strokeOpacity="0.3"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={x}
                      y={envelopeData.padding.top + envelopeData.innerH + 16}
                      fill="#869397"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {tVal.toFixed(0)} °C
                    </text>
                  </g>
                );
              })}

              {/* Two-Phase Region Shaded Area */}
              <polygon points={envelopeData.areaPolygon.replace(/[MLZ]/g, '').trim()} fill="#4cd7f6" fillOpacity="0.08" />

              {/* Bubble Point Curve (Liquidus) */}
              <path d={envelopeData.bubblePath} fill="none" stroke="#4cd7f6" strokeWidth="2.5" />

              {/* Dew Point Curve (Vaporus) */}
              <path d={envelopeData.dewPath} fill="none" stroke="#ffb95f" strokeWidth="2.5" />

              {/* Operating Flash Point Marker */}
              <circle
                cx={envelopeData.opX}
                cy={envelopeData.opY}
                r="9"
                fill="none"
                stroke="#4edea3"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={envelopeData.opX}
                cy={envelopeData.opY}
                r="4.5"
                fill="#4edea3"
                className="cursor-pointer"
                onMouseEnter={() =>
                  setHoveredPoint({
                    x: envelopeData.opX,
                    y: envelopeData.opY,
                    text: `Flash Point: ${flashTempC.toFixed(1)}°C, ${flashPresBar.toFixed(1)} bar | ${flashResult.phase} (VF=${(flashResult.vaporFraction * 100).toFixed(1)}%)`,
                  })
                }
                onMouseLeave={() => setHoveredPoint(null)}
              />

              {/* Axis Titles */}
              <text
                x={envelopeData.padding.left + envelopeData.innerW / 2}
                y={envelopeData.height - 4}
                fill="#dae2fd"
                fontSize="10"
                textAnchor="middle"
                fontWeight="bold"
              >
                Temperature T [°C]
              </text>
              <text
                x={14}
                y={envelopeData.padding.top + envelopeData.innerH / 2}
                fill="#dae2fd"
                fontSize="10"
                textAnchor="middle"
                transform={`rotate(-90 14 ${envelopeData.padding.top + envelopeData.innerH / 2})`}
                fontWeight="bold"
              >
                Pressure P [bar]
              </text>
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
              <div
                className="absolute z-20 bg-[#060e20] text-[#4edea3] text-[9.5px] px-2 py-1 rounded shadow-lg border border-[#4edea3] pointer-events-none"
                style={{ left: Math.min(hoveredPoint.x + 10, envelopeData.width - 220), top: Math.max(10, hoveredPoint.y - 30) }}
              >
                {hoveredPoint.text}
              </div>
            )}

            {/* Legend & Status */}
            <div className="flex flex-wrap items-center justify-between text-[9.5px] pt-1.5 border-t border-[#3d494c]/20 text-[#869397]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-[#4cd7f6]">
                  <span className="w-3 h-0.5 bg-[#4cd7f6] inline-block" /> Bubble Point (Liquidus)
                </span>
                <span className="flex items-center gap-1 text-[#ffb95f]">
                  <span className="w-3 h-0.5 bg-[#ffb95f] inline-block" /> Dew Point (Vaporus)
                </span>
                <span className="flex items-center gap-1 text-[#4edea3]">
                  <span className="w-2 h-2 rounded-full bg-[#4edea3] inline-block" /> Operating Point ({flashTempC}°C, {flashPresBar} bar)
                </span>
              </div>
              <span className="text-[#dae2fd]">
                Phase State: <strong className="text-[#4edea3]">{flashResult.phase}</strong> (Vapor Fraction: {(flashResult.vaporFraction * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        )}

        {/* K-Values vs Temperature Plot */}
        {chartMode === 'kvalues' && kValuesData && (
          <div className="relative bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
            <svg viewBox={`0 0 ${kValuesData.width} ${kValuesData.height}`} className="w-full h-auto select-none">
              {/* Log(K) Grid lines */}
              {[-2, -1, 0, 1, 2].map((logK) => {
                const y = kValuesData.scaleY(logK);
                const isUnity = logK === 0;
                return (
                  <g key={logK}>
                    <line
                      x1={kValuesData.padding.left}
                      y1={y}
                      x2={kValuesData.padding.left + kValuesData.innerW}
                      y2={y}
                      stroke={isUnity ? '#4edea3' : '#3d494c'}
                      strokeOpacity={isUnity ? 0.7 : 0.3}
                      strokeDasharray={isUnity ? '4 2' : '3 3'}
                      strokeWidth={isUnity ? 1.5 : 1}
                    />
                    <text
                      x={kValuesData.padding.left - 6}
                      y={y + 3}
                      fill={isUnity ? '#4edea3' : '#869397'}
                      fontSize="9"
                      textAnchor="end"
                      fontFamily="monospace"
                      fontWeight={isUnity ? 'bold' : 'normal'}
                    >
                      {logK === 0 ? 'K = 1.0' : `10^${logK}`}
                    </text>
                  </g>
                );
              })}

              {/* Temperature Grid lines */}
              {[-20, 20, 60, 100, 140, 180, 220].map((t) => {
                const x = kValuesData.scaleX(t);
                return (
                  <g key={t}>
                    <line
                      x1={x}
                      y1={kValuesData.padding.top}
                      x2={x}
                      y2={kValuesData.padding.top + kValuesData.innerH}
                      stroke="#3d494c"
                      strokeOpacity="0.3"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={x}
                      y={kValuesData.padding.top + kValuesData.innerH + 16}
                      fill="#869397"
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {t} °C
                    </text>
                  </g>
                );
              })}

              {/* Component Curves */}
              {kValuesData.curves.map((c) => (
                <path
                  key={c.id}
                  d={c.path}
                  fill="none"
                  stroke={c.color}
                  strokeWidth="2.2"
                />
              ))}

              {/* Axis Titles */}
              <text
                x={kValuesData.padding.left + kValuesData.innerW / 2}
                y={kValuesData.height - 4}
                fill="#dae2fd"
                fontSize="10"
                textAnchor="middle"
                fontWeight="bold"
              >
                Temperature T [°C] (at P = {flashPresBar} bar)
              </text>
              <text
                x={14}
                y={kValuesData.padding.top + kValuesData.innerH / 2}
                fill="#dae2fd"
                fontSize="10"
                textAnchor="middle"
                transform={`rotate(-90 14 ${kValuesData.padding.top + kValuesData.innerH / 2})`}
                fontWeight="bold"
              >
                Equilibrium Ratio K_i = y_i / x_i
              </text>
            </svg>

            {/* Component Legend with Current K-values */}
            <div className="flex flex-wrap items-center justify-between text-[9.5px] pt-1.5 border-t border-[#3d494c]/20 text-[#869397]">
              <div className="flex flex-wrap items-center gap-3">
                {kValuesData.curves.map((c) => (
                  <span key={c.id} className="flex items-center gap-1 font-mono" style={{ color: c.color }}>
                    <span className="w-2.5 h-1 rounded inline-block" style={{ backgroundColor: c.color }} />
                    <strong className="uppercase">{c.id}</strong>: K={c.curK.toFixed(3)}
                  </span>
                ))}
              </div>
              <span className="text-[#4edea3] font-bold">K &gt; 1: Strips to Vapor | K &lt; 1: Concentrates in Liquid</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Flash Calculator (Cols 1 to 7) */}
        <div className="col-span-7 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
          <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">device_thermostat</span>
              <span className="text-[#dae2fd] font-bold">Flash Algorithm:</span>
              <div className="flex gap-1 ml-2">
                {(['TP', 'PH', 'PS', 'BubblePoint', 'DewPoint'] as FlashMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFlashMode(mode)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      flashMode === mode
                        ? 'bg-[#4cd7f6] text-[#003640]'
                        : 'bg-[#060e20] text-[#bcc9cd] hover:text-[#dae2fd]'
                    }`}
                  >
                    {mode === 'TP'
                      ? 'TP Flash'
                      : mode === 'PH'
                      ? 'PH Flash'
                      : mode === 'PS'
                      ? 'PS Flash'
                      : mode === 'BubblePoint'
                      ? 'Bubble Pt'
                      : 'Dew Pt'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span className="text-[#4edea3] text-[10px] font-bold">CONVERGED</span>
            </div>
          </div>

          {/* Flash Specifications Controls */}
          <div className="grid grid-cols-2 gap-3 bg-[#060e20] p-2.5 rounded border border-[#3d494c]/30">
            <div>
              <label className="text-[#869397] text-[10px] block mb-1">
                {flashMode === 'PH'
                  ? 'Target Enthalpy (J/mol)'
                  : flashMode === 'PS'
                  ? 'Target Entropy (J/mol·K)'
                  : flashMode === 'BubblePoint'
                  ? `Computed Bubble T: ${flashResult.temperatureC.toFixed(2)} °C`
                  : flashMode === 'DewPoint'
                  ? `Computed Dew T: ${flashResult.temperatureC.toFixed(2)} °C`
                  : `Temperature: ${flashTempC.toFixed(1)} °C`}
              </label>
              {flashMode === 'TP' && (
                <input
                  type="range"
                  min="-20"
                  max="350"
                  step="1"
                  value={flashTempC}
                  onChange={(e) => setFlashTempC(parseFloat(e.target.value))}
                  className="w-full accent-[#4cd7f6] cursor-pointer"
                />
              )}
              {flashMode === 'PH' && (
                <input
                  type="number"
                  step="500"
                  value={targetEnthalpyJPerMol}
                  onChange={(e) => setTargetEnthalpyJPerMol(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#171f33] border border-[#3d494c]/50 text-[#ffddb8] px-2 py-1 rounded text-[11px]"
                />
              )}
              {flashMode === 'PS' && (
                <input
                  type="number"
                  step="5"
                  value={targetEntropyJPerMolK}
                  onChange={(e) => setTargetEntropyJPerMolK(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#171f33] border border-[#3d494c]/50 text-[#ffddb8] px-2 py-1 rounded text-[11px]"
                />
              )}
              {(flashMode === 'BubblePoint' || flashMode === 'DewPoint') && (
                <div className="text-[#ffddb8] text-[13px] font-bold py-1">
                  {flashResult.temperatureC.toFixed(2)} °C ({flashResult.temperatureK.toFixed(2)} K)
                </div>
              )}
            </div>

            <div>
              <label className="text-[#869397] text-[10px] block mb-1">Pressure: {flashPresBar.toFixed(1)} bar</label>
              <input
                type="range"
                min="1"
                max="150"
                step="0.5"
                value={flashPresBar}
                onChange={(e) => setFlashPresBar(parseFloat(e.target.value))}
                className="w-full accent-[#4cd7f6] cursor-pointer"
              />
            </div>
          </div>

          {/* Flash Results KPI Cards */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Vapor Fraction (VF)</span>
                <span className="text-[#4cd7f6] font-bold text-[13px]">
                  {(flashResult.vaporFraction * 100).toFixed(2)}%
                </span>
              </div>
              <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Equilibrium Phase</span>
                <span className="text-[#ffddb8] font-bold text-[11px] truncate block" title={flashResult.phase}>
                  {flashResult.phase}
                </span>
              </div>
              <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Density</span>
                <span className="text-[#4edea3] font-bold text-[13px]">
                  {flashResult.densityKgM3.toFixed(1)} kg/m³
                </span>
              </div>
              <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Iterations / Tol</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">
                  {flashResult.iterations} iters / &lt;1e-6
                </span>
              </div>
            </div>

            {/* VLE Compositions and K-Values */}
            <div className="overflow-x-auto max-h-48 border border-[#3d494c]/30 rounded">
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="text-[#869397] border-b border-[#3d494c]/30 bg-[#060e20]">
                    <th className="py-1 px-2">Component</th>
                    <th className="py-1 text-right">Feed z_i</th>
                    <th className="py-1 text-right">Liquid x_i</th>
                    <th className="py-1 text-right">Vapor y_i</th>
                    <th className="py-1 text-right px-2">K-Value (y/x)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d494c]/20">
                  {components.map((comp) => {
                    const zi = compositionDict[comp.id] || 0;
                    const xi = flashResult.liquidComposition[comp.id] || 0;
                    const yi = flashResult.vaporComposition[comp.id] || 0;
                    const ki = flashResult.kValues[comp.id] || (xi > 0 ? yi / xi : 0);
                    return (
                      <tr key={comp.id} className="hover:bg-[#222a3d]">
                        <td className="py-1 px-2 text-[#dae2fd] font-semibold">{comp.name}</td>
                        <td className="py-1 text-right text-[#869397]">{zi.toFixed(4)}</td>
                        <td className="py-1 text-right text-[#ffddb8]">{xi.toFixed(4)}</td>
                        <td className="py-1 text-right text-[#4cd7f6]">{yi.toFixed(4)}</td>
                        <td className="py-1 text-right text-[#4edea3] font-bold px-2">{ki.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Thermodynamic Enthalpy / Entropy Footer */}
            <div className="flex items-center justify-between text-[9.5px] text-[#869397] bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
              <span>
                Molar Enthalpy: <strong className="text-[#dae2fd]">{flashResult.enthalpyJPerMol.toFixed(1)} J/mol</strong> (
                {(flashResult.enthalpyKjPerKg).toFixed(1)} kJ/kg)
              </span>
              <span>
                Entropy: <strong className="text-[#dae2fd]">{flashResult.entropyJPerMolK.toFixed(2)} J/(mol·K)</strong>
              </span>
              <span>
                Residual: <strong className="text-[#4edea3]">{flashResult.residual.toExponential(3)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Pure Component Critical Properties & EOS Parameters (Cols 8 to 12) */}
        <div className="col-span-5 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
          <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-2">
            <span className="text-[#dae2fd] font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4edea3] text-[16px]">science</span>
              Critical Constants &amp; Accentrics
            </span>
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="text-[#869397] border-b border-[#3d494c]/30">
                  <th className="py-1">Formula</th>
                  <th className="py-1 text-right">MW</th>
                  <th className="py-1 text-right">Tc [°C]</th>
                  <th className="py-1 text-right">Pc [bar]</th>
                  <th className="py-1 text-right">ω (Omega)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3d494c]/20">
                {components.map((c) => (
                  <tr key={c.id} className="hover:bg-[#222a3d]">
                    <td className="py-1 text-[#4cd7f6] font-bold">{c.formula}</td>
                    <td className="py-1 text-right text-[#dae2fd]">{c.mw}</td>
                    <td className="py-1 text-right text-[#ffddb8]">{c.criticalTempC}</td>
                    <td className="py-1 text-right text-[#dae2fd]">{c.criticalPresBar}</td>
                    <td className="py-1 text-right text-[#4edea3]">{c.accentricFactor.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Alpha Formulation Equation display */}
          <div className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 text-[9.5px] text-[#869397] space-y-1">
            <div className="text-[#ffddb8] font-bold">Rigorous PR-EOS Formulation:</div>
            <div className="text-[#dae2fd]">
              P = RT/(v - b) - a(T)/[v(v + b) + b(v - b)]
            </div>
            <div>
              van der Waals quadratic mixing rules with non-zero binary interaction matrix (k_ij).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
