import React, { useState, useMemo } from 'react';
import { PinchStream, PinchAnalysisResult } from '../../types/energy';
import { runPinchAnalysis } from '../../engine/energy/pinchEngine';

interface HeatIntegrationPanelProps {
  streams: PinchStream[];
  initialDeltaTmin?: number;
}

export const HeatIntegrationPanel: React.FC<HeatIntegrationPanelProps> = ({
  streams,
  initialDeltaTmin = 10,
}) => {
  const [deltaTmin, setDeltaTmin] = useState<number>(initialDeltaTmin);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  // Re-run pinch analysis reactively when deltaTmin changes
  const pinchResult: PinchAnalysisResult = useMemo(() => {
    return runPinchAnalysis(streams, deltaTmin);
  }, [streams, deltaTmin]);

  // Scaler for SVG Composite Curves
  const { hotCompositeCurve, coldCompositeCurve } = pinchResult;

  const maxH = useMemo(() => {
    const hotMaxH = hotCompositeCurve.length > 0 ? hotCompositeCurve[hotCompositeCurve.length - 1].h : 20;
    const coldMaxH = coldCompositeCurve.length > 0 ? coldCompositeCurve[coldCompositeCurve.length - 1].h : 20;
    return Math.max(hotMaxH, coldMaxH, 25);
  }, [hotCompositeCurve, coldCompositeCurve]);

  const minT = useMemo(() => {
    let min = 0;
    streams.forEach((s) => {
      min = Math.min(min, s.tinC, s.toutC);
    });
    return Math.max(0, Math.floor(min / 10) * 10);
  }, [streams]);

  const maxT = useMemo(() => {
    let max = 500;
    streams.forEach((s) => {
      max = Math.max(max, s.tinC, s.toutC);
    });
    return Math.ceil(max / 50) * 50;
  }, [streams]);

  const svgWidth = 600;
  const svgHeight = 280;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 40;

  const scaleX = (h: number) => {
    return padLeft + (h / maxH) * (svgWidth - padLeft - padRight);
  };

  const scaleY = (t: number) => {
    return svgHeight - padBottom - ((t - minT) / (maxT - minT)) * (svgHeight - padTop - padBottom);
  };

  const hotSvgPath = useMemo(() => {
    if (hotCompositeCurve.length < 2) return '';
    return hotCompositeCurve
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.h).toFixed(1)} ${scaleY(p.t).toFixed(1)}`)
      .join(' ');
  }, [hotCompositeCurve, maxH, minT, maxT]);

  const coldSvgPath = useMemo(() => {
    if (coldCompositeCurve.length < 2) return '';
    return coldCompositeCurve
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.h).toFixed(1)} ${scaleY(p.t).toFixed(1)}`)
      .join(' ');
  }, [coldCompositeCurve, maxH, minT, maxT]);

  return (
    <div className="space-y-4">
      {/* Header & Pinch Controls */}
      <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffb95f] text-[18px]">schema</span>
            Pinch Technology & Heat Integration Engine
          </h2>
          <p className="text-xs text-[#869397] mt-0.5">
            Linnhoff Problem Table Algorithm targeting minimum heating/cooling utilities, pinch temperatures, and maximum heat recovery (MER).
          </p>
        </div>

        {/* ΔTmin Slider Control */}
        <div className="bg-[#171f33] px-4 py-2.5 rounded border border-[#3d494c]/40 flex items-center gap-4">
          <div>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[11px] text-[#869397] font-mono uppercase">Minimum Approach (ΔTmin):</span>
              <span className="text-sm font-mono font-bold text-[#4cd7f6]">{deltaTmin}°C</span>
            </div>
            <input
              type="range"
              min="5"
              max="35"
              step="1"
              value={deltaTmin}
              onChange={(e) => setDeltaTmin(parseInt(e.target.value))}
              className="w-44 h-1.5 bg-[#0b1326] rounded-lg appearance-none cursor-pointer accent-[#4cd7f6] mt-1"
            />
          </div>

          <div className="text-right pl-3 border-l border-[#3d494c]/30">
            <div className="text-[10px] text-[#869397] uppercase">Pinch Temp</div>
            <div className="text-sm font-mono font-bold text-[#ffddb8]">
              {pinchResult.pinchTempC}°C
            </div>
          </div>
        </div>
      </div>

      {/* Pinch Key Targets Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Hot Pinch / Cold Pinch */}
        <div className="bg-[#171f33] border border-[#3d494c]/30 rounded p-3">
          <div className="text-[10.5px] font-mono text-[#869397] uppercase">Pinch Location</div>
          <div className="mt-1 flex items-baseline gap-1 text-[#ffddb8]">
            <span className="text-xl font-mono font-bold">{pinchResult.pinchTempC}°C</span>
          </div>
          <div className="mt-1 text-[10px] text-[#869397] flex justify-between font-mono">
            <span>Hot: {pinchResult.hotPinchTempC}°C</span>
            <span>Cold: {pinchResult.coldPinchTempC}°C</span>
          </div>
        </div>

        {/* Min Hot Utility Qh,min */}
        <div className="bg-[#171f33] border border-[#3d494c]/30 rounded p-3">
          <div className="text-[10.5px] font-mono text-[#869397] uppercase">Min Hot Utility (Qh,min)</div>
          <div className="mt-1 flex items-baseline gap-1 text-[#ffb95f]">
            <span className="text-xl font-mono font-bold">{pinchResult.qhMinMW}</span>
            <span className="text-xs font-mono text-[#869397]">MW</span>
          </div>
          <div className="mt-1 text-[10px] text-[#4edea3] font-mono">
            Savings: -{pinchResult.potentialHeatingSavingsMW} MW
          </div>
        </div>

        {/* Min Cold Utility Qc,min */}
        <div className="bg-[#171f33] border border-[#3d494c]/30 rounded p-3">
          <div className="text-[10.5px] font-mono text-[#869397] uppercase">Min Cold Utility (Qc,min)</div>
          <div className="mt-1 flex items-baseline gap-1 text-[#4cd7f6]">
            <span className="text-xl font-mono font-bold">{pinchResult.qcMinMW}</span>
            <span className="text-xs font-mono text-[#869397]">MW</span>
          </div>
          <div className="mt-1 text-[10px] text-[#4edea3] font-mono">
            Savings: -{pinchResult.potentialCoolingSavingsMW} MW
          </div>
        </div>

        {/* Maximum Energy Recovery (MER) */}
        <div className="bg-[#171f33] border border-[#3d494c]/30 rounded p-3">
          <div className="text-[10.5px] font-mono text-[#869397] uppercase">Max Energy Recovery</div>
          <div className="mt-1 flex items-baseline gap-1 text-[#4edea3]">
            <span className="text-xl font-mono font-bold">{pinchResult.maxEnergyRecoveryMW}</span>
            <span className="text-xs font-mono text-[#869397]">MW</span>
          </div>
          <div className="mt-1 text-[10px] text-[#869397]">Direct Cross-Exchange Target</div>
        </div>

        {/* Annualized Cost Savings */}
        <div className="bg-[#171f33] border border-[#3d494c]/30 rounded p-3">
          <div className="text-[10.5px] font-mono text-[#869397] uppercase">Potential Annual Savings</div>
          <div className="mt-1 flex items-baseline gap-1 text-[#4edea3]">
            <span className="text-xl font-mono font-bold">
              ${(pinchResult.potentialAnnualCostSavingsUSD / 1e6).toFixed(2)}M
            </span>
            <span className="text-xs font-mono text-[#869397]">/yr</span>
          </div>
          <div className="mt-1 text-[10px] text-[#869397]">Fuel Gas & Cooling Power</div>
        </div>
      </div>

      {/* Composite Curves Graph & Utility Target Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Composite Curves SVG */}
        <div className="lg:col-span-2 bg-[#131b2e] border border-[#3d494c]/30 rounded p-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[16px]">show_chart</span>
                Hot & Cold Composite Curves (T-H Diagram)
              </h3>
              <p className="text-[11px] text-[#869397]">
                Enthalpy Flow (H, MW) vs Temperature (T, °C) with closest vertical approach equal to ΔTmin ({deltaTmin}°C).
              </p>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-[#ff8077]">
                <span className="w-2.5 h-0.5 bg-[#ff8077] inline-block" /> Hot Composite
              </span>
              <span className="flex items-center gap-1 text-[#4cd7f6]">
                <span className="w-2.5 h-0.5 bg-[#4cd7f6] inline-block" /> Cold Composite
              </span>
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="mt-3 relative bg-[#0b1326] rounded border border-[#3d494c]/20 p-2 overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto max-h-[300px]"
            >
              {/* Grid lines */}
              {[100, 200, 300, 400, 500].map((t) => (
                <g key={`grid-y-${t}`}>
                  <line
                    x1={padLeft}
                    y1={scaleY(t)}
                    x2={svgWidth - padRight}
                    y2={scaleY(t)}
                    stroke="#222a3d"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={padLeft - 8}
                    y={scaleY(t) + 4}
                    fill="#869397"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {t}°C
                  </text>
                </g>
              ))}

              {[5, 10, 15, 20, 25].map((h) => (
                <g key={`grid-x-${h}`}>
                  <line
                    x1={scaleX(h)}
                    y1={padTop}
                    x2={scaleX(h)}
                    y2={svgHeight - padBottom}
                    stroke="#222a3d"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={scaleX(h)}
                    y={svgHeight - padBottom + 14}
                    fill="#869397"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {h}MW
                  </text>
                </g>
              ))}

              {/* Pinch indicator line */}
              <line
                x1={padLeft}
                y1={scaleY(pinchResult.pinchTempC)}
                x2={svgWidth - padRight}
                y2={scaleY(pinchResult.pinchTempC)}
                stroke="#ffddb8"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text
                x={svgWidth - padRight - 5}
                y={scaleY(pinchResult.pinchTempC) - 5}
                fill="#ffddb8"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="end"
              >
                Pinch: {pinchResult.pinchTempC}°C
              </text>

              {/* Hot Composite Path */}
              {hotSvgPath && (
                <path
                  d={hotSvgPath}
                  fill="none"
                  stroke="#ff8077"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Cold Composite Path */}
              {coldSvgPath && (
                <path
                  d={coldSvgPath}
                  fill="none"
                  stroke="#4cd7f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Hot and Cold Utility Brackets */}
              <text
                x={scaleX(pinchResult.qcMinMW / 2)}
                y={svgHeight - padBottom + 28}
                fill="#4cd7f6"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
                fontWeight="bold"
              >
                Qc,min = {pinchResult.qcMinMW} MW
              </text>
            </svg>
          </div>
        </div>

        {/* Current vs Pinch Target Utilities Comparison */}
        <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4edea3] text-[16px]">compare_arrows</span>
                Utility Optimization Potential
              </h3>
              <span className="text-[10px] font-mono text-[#4edea3]">TARGET</span>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Hot Utility Comparison */}
              <div>
                <div className="flex justify-between text-[#bcc9cd] mb-1">
                  <span>Hot Utility (Heating Demand)</span>
                  <span className="font-mono text-[#ffddb8]">
                    {pinchResult.qhMinMW} MW / {pinchResult.currentHotUtilityMW} MW
                  </span>
                </div>
                <div className="h-4 bg-[#0b1326] rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-[#ff8077]/40 absolute left-0 top-0"
                    style={{ width: '100%' }}
                    title={`Current: ${pinchResult.currentHotUtilityMW} MW`}
                  />
                  <div
                    className="h-full bg-[#4edea3] absolute left-0 top-0"
                    style={{
                      width: `${Math.min(100, (pinchResult.qhMinMW / pinchResult.currentHotUtilityMW) * 100)}%`,
                    }}
                    title={`Target: ${pinchResult.qhMinMW} MW`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#869397] mt-1">
                  <span>Target: {pinchResult.qhMinMW} MW</span>
                  <span className="text-[#4edea3] font-bold">
                    Save {pinchResult.potentialHeatingSavingsMW} MW ({Math.round((pinchResult.potentialHeatingSavingsMW / pinchResult.currentHotUtilityMW) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Cold Utility Comparison */}
              <div>
                <div className="flex justify-between text-[#bcc9cd] mb-1">
                  <span>Cold Utility (Cooling Demand)</span>
                  <span className="font-mono text-[#4cd7f6]">
                    {pinchResult.qcMinMW} MW / {pinchResult.currentColdUtilityMW} MW
                  </span>
                </div>
                <div className="h-4 bg-[#0b1326] rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-[#4cd7f6]/40 absolute left-0 top-0"
                    style={{ width: '100%' }}
                    title={`Current: ${pinchResult.currentColdUtilityMW} MW`}
                  />
                  <div
                    className="h-full bg-[#4edea3] absolute left-0 top-0"
                    style={{
                      width: `${Math.min(100, (pinchResult.qcMinMW / pinchResult.currentColdUtilityMW) * 100)}%`,
                    }}
                    title={`Target: ${pinchResult.qcMinMW} MW`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#869397] mt-1">
                  <span>Target: {pinchResult.qcMinMW} MW</span>
                  <span className="text-[#4edea3] font-bold">
                    Save {pinchResult.potentialCoolingSavingsMW} MW ({Math.round((pinchResult.potentialCoolingSavingsMW / pinchResult.currentColdUtilityMW) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 bg-[#0b1326] rounded border border-[#3d494c]/30 text-xs space-y-1 text-[#869397]">
            <div className="flex justify-between text-[#dae2fd]">
              <span>Current Primary Energy:</span>
              <span className="font-mono font-bold">{pinchResult.currentHotUtilityMW} MW</span>
            </div>
            <div className="flex justify-between text-[#4edea3]">
              <span>Pinch Minimum Requirement:</span>
              <span className="font-mono font-bold">{pinchResult.qhMinMW} MW</span>
            </div>
            <div className="flex justify-between text-[#ffb4ab] pt-1 border-t border-[#3d494c]/20">
              <span>Potential Annual Cash Savings:</span>
              <span className="font-mono font-bold">
                ${(pinchResult.potentialAnnualCostSavingsUSD / 1e6).toFixed(2)}M / yr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Extracted Process Streams Table */}
      <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4cd7f6] text-[16px]">waves</span>
              Flowsheet Extracted Thermal Process Streams
            </h3>
            <p className="text-[11px] text-[#869397] mt-0.5">
              Automatic extraction of hot streams (requiring cooling) and cold streams (requiring heating) from flowheet unit operations.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#bcc9cd]">
            {streams.length} Stream Profiles
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#3d494c]/40 text-[#869397] text-[10.5px] uppercase">
                <th className="py-2 px-3">Stream Identifier</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3 text-right">Supply Temp (Tin)</th>
                <th className="py-2 px-3 text-right">Target Temp (Tout)</th>
                <th className="py-2 px-3 text-right">Duty (MW)</th>
                <th className="py-2 px-3 text-right">Heat Capacity (m·Cp)</th>
                <th className="py-2 px-3">Associated Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d494c]/20">
              {streams.map((s) => (
                <tr
                  key={s.id}
                  className={`hover:bg-[#171f33] transition-colors cursor-pointer ${
                    selectedStreamId === s.id ? 'bg-[#171f33]' : ''
                  }`}
                  onClick={() => setSelectedStreamId(s.id)}
                >
                  <td className="py-2 px-3 font-bold text-[#dae2fd]">{s.name}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium uppercase ${
                        s.type === 'hot'
                          ? 'bg-[#ff8077]/20 text-[#ff8077]'
                          : 'bg-[#4cd7f6]/20 text-[#4cd7f6]'
                      }`}
                    >
                      {s.type}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-[#dae2fd]">
                    {s.tinC}°C
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-[#dae2fd]">
                    {s.toutC}°C
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-[#ffddb8]">
                    {s.dutyMW.toFixed(2)} MW
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-[#bcc9cd]">
                    {s.mCpMWK.toFixed(3)} MW/°C
                  </td>
                  <td className="py-2 px-3 font-mono text-[#4cd7f6]">{s.sourceUnitId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heat Integration Opportunities & Exchanger Matching */}
      <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#3d494c]/30">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#dae2fd] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4edea3] text-[16px]">lightbulb</span>
              Ranked Heat Integration Opportunities & Retrofit Matches
            </h3>
            <p className="text-[11px] text-[#869397] mt-0.5">
              Techno-economic heat exchanger pairing proposals strictly respecting pinch rules (no heat transfer across pinch).
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#4edea3]">
            {pinchResult.opportunities.length} Actionable Projects
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {pinchResult.opportunities.map((opp) => (
            <div
              key={opp.id}
              className="bg-[#171f33] border border-[#3d494c]/40 rounded p-3 text-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#dae2fd] text-[12px]">{opp.title}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      opp.priority === 'High'
                        ? 'bg-[#4edea3]/20 text-[#4edea3]'
                        : 'bg-[#ffb95f]/20 text-[#ffddb8]'
                    }`}
                  >
                    {opp.priority} PRIORITY
                  </span>
                </div>
                <p className="text-[#bcc9cd] text-[11px] mt-1 leading-relaxed">{opp.description}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-[#3d494c]/20 flex items-center justify-between text-[11px]">
                <div className="text-[#869397]">
                  Duty Reduction: <strong className="text-[#4cd7f6]">{opp.potentialSavingMW} MW</strong>
                </div>
                <div className="font-mono font-bold text-[#4edea3]">
                  +${opp.estimatedAnnualSavingsUSD.toLocaleString()} / year
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
