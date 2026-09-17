import React, { useState, useMemo } from 'react';
import { ChemicalComponent, ProcessStream, UnitSystem } from '../../types/simulation';
import { formatFlow, formatPres, formatTemp } from '../../engine/thermoEngine';

interface MatrixSheetsViewProps {
  streams: ProcessStream[];
  components: ChemicalComponent[];
  unitSystem: UnitSystem;
}

type PlotMetricMode = 'temp_pres' | 'flow_vf' | 'compositions';

export const MatrixSheetsView: React.FC<MatrixSheetsViewProps> = ({
  streams,
  components,
  unitSystem,
}) => {
  const [metricMode, setMetricMode] = useState<PlotMetricMode>('temp_pres');
  const [hoveredStream, setHoveredStream] = useState<{ x: number; y: number; stream: ProcessStream } | null>(null);

  const handleExportCsv = () => {
    let csv = `Stream,Name,Phase,Temp[C],Pres[bar],Flow[kg/h],MW,Enthalpy[kJ/kg],VF,Density[kg/m3],` +
      components.map((c) => `x_${c.name}`).join(',') + `\n`;

    streams.forEach((s) => {
      const compVals = components.map((c) => (s.compositions[c.id] ?? 0).toFixed(4)).join(',');
      csv += `${s.id},"${s.name}",${s.phase},${s.tempC},${s.presBar},${s.flowKgH},${s.mw},${s.enthalpyKjKg},${s.vaporFraction},${s.densityKgM3},${compVals}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Heat_and_Material_Balance_Matrix.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Memoized SVG Profile Calculation across Stream Sequence
  const plotData = useMemo(() => {
    if (streams.length === 0) return null;

    const width = 860;
    const height = 240;
    const padding = { top: 25, right: 65, bottom: 45, left: 65 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    // X coordinates along stream sequence
    const stepX = innerW / Math.max(1, streams.length - 1);
    const pointsX = streams.map((_, idx) => padding.left + idx * stepX);

    // Temp & Pres scaling
    const temps = streams.map((s) => s.tempC);
    const minTemp = Math.floor(Math.min(...temps) * 0.9 - 10);
    const maxTemp = Math.ceil(Math.max(...temps) * 1.1 + 10);
    const rangeTemp = Math.max(1, maxTemp - minTemp);

    const pressures = streams.map((s) => s.presBar);
    const minPres = Math.max(0, Math.floor(Math.min(...pressures) * 0.9 - 2));
    const maxPres = Math.ceil(Math.max(...pressures) * 1.15 + 2);
    const rangePres = Math.max(1, maxPres - minPres);

    // Flow & VF scaling
    const flows = streams.map((s) => s.flowKgH);
    const minFlow = 0;
    const maxFlow = Math.ceil(Math.max(...flows) * 1.15);
    const rangeFlow = Math.max(1, maxFlow - minFlow);

    const scaleYTemp = (t: number) => padding.top + innerH - ((t - minTemp) / rangeTemp) * innerH;
    const scaleYPres = (p: number) => padding.top + innerH - ((p - minPres) / rangePres) * innerH;
    const scaleYFlow = (f: number) => padding.top + innerH - ((f - minFlow) / rangeFlow) * innerH;
    const scaleYVF = (vf: number) => padding.top + innerH - vf * innerH;

    const tempCoords = streams.map((s, i) => ({ x: pointsX[i], y: scaleYTemp(s.tempC), s }));
    const presCoords = streams.map((s, i) => ({ x: pointsX[i], y: scaleYPres(s.presBar), s }));
    const flowCoords = streams.map((s, i) => ({ x: pointsX[i], y: scaleYFlow(s.flowKgH), s }));
    const vfCoords = streams.map((s, i) => ({ x: pointsX[i], y: scaleYVF(s.vaporFraction), s }));

    const tempPath = tempCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
    const presPath = presCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
    const flowPath = flowCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
    const vfPath = vfCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');

    const compColors: Record<string, string> = {
      h2: '#acedff',
      c1: '#4cd7f6',
      c3: '#4edea3',
      nc4: '#ffb95f',
      c6h6: '#ff8077',
      c7h14: '#d0bcff',
    };

    const compCurves = components.map((comp) => {
      const pts = streams.map((s, i) => {
        const frac = s.compositions[comp.id] ?? 0;
        const y = padding.top + innerH - frac * innerH;
        return { x: pointsX[i], y, frac, s };
      });
      const path = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
      return {
        id: comp.id,
        name: comp.name,
        formula: comp.formula,
        color: compColors[comp.id] || '#4cd7f6',
        pts,
        path,
      };
    });

    return {
      width,
      height,
      padding,
      innerW,
      innerH,
      pointsX,
      minTemp,
      maxTemp,
      minPres,
      maxPres,
      minFlow,
      maxFlow,
      tempCoords,
      presCoords,
      flowCoords,
      vfCoords,
      tempPath,
      presPath,
      flowPath,
      vfPath,
      scaleYTemp,
      scaleYPres,
      scaleYFlow,
      scaleYVF,
      compCurves,
    };
  }, [streams, components]);

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto font-mono text-[11px] select-none">
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#4cd7f6] text-[13px] font-bold">
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            <span>HEAT &amp; MATERIAL BALANCE (H&amp;MB) MATRIX SHEETS</span>
          </div>
          <p className="text-[#869397] text-[10px] mt-0.5">
            Full plant stream table with thermodynamic properties and individual chemical component fractions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4cd7f6] text-[#003640] font-bold rounded hover:opacity-90 active:scale-95 transition-all shadow"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Stream Sequence Property Profile Chart */}
      {plotData && (
        <div className="bg-[#171f33] p-3.5 rounded border border-[#3d494c]/40 space-y-2.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3d494c]/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">show_chart</span>
              <div>
                <span className="text-[#dae2fd] font-bold text-[12px]">
                  STREAM SEQUENCE PROPERTY TRAJECTORY
                </span>
                <p className="text-[#869397] text-[10px]">
                  Hydraulic and thermodynamic state evolution across sequential process stream nodes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex bg-[#060e20] p-0.5 rounded border border-[#3d494c]/30">
                <button
                  onClick={() => setMetricMode('temp_pres')}
                  className={`px-2.5 py-1 rounded font-bold transition-colors ${
                    metricMode === 'temp_pres'
                      ? 'bg-[#4cd7f6] text-[#003640]'
                      : 'text-[#869397] hover:text-[#dae2fd]'
                  }`}
                >
                  T-P Profile
                </button>
                <button
                  onClick={() => setMetricMode('flow_vf')}
                  className={`px-2.5 py-1 rounded font-bold transition-colors ${
                    metricMode === 'flow_vf'
                      ? 'bg-[#4cd7f6] text-[#003640]'
                      : 'text-[#869397] hover:text-[#dae2fd]'
                  }`}
                >
                  Flow &amp; Vapor Frac
                </button>
                <button
                  onClick={() => setMetricMode('compositions')}
                  className={`px-2.5 py-1 rounded font-bold transition-colors ${
                    metricMode === 'compositions'
                      ? 'bg-[#4cd7f6] text-[#003640]'
                      : 'text-[#869397] hover:text-[#dae2fd]'
                  }`}
                >
                  Composition Profile
                </button>
              </div>
            </div>
          </div>

          <div className="relative bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20">
            <svg viewBox={`0 0 ${plotData.width} ${plotData.height}`} className="w-full h-auto select-none">
              {/* Horizontal Gridlines based on Mode */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                const y = plotData.padding.top + plotData.innerH * (1 - frac);
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

                    {metricMode === 'temp_pres' && (
                      <>
                        {/* Left Y Axis: Temp */}
                        <text
                          x={plotData.padding.left - 8}
                          y={y + 3.5}
                          fill="#ffddb8"
                          fontSize="9.5"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {(plotData.minTemp + frac * (plotData.maxTemp - plotData.minTemp)).toFixed(0)} °C
                        </text>
                        {/* Right Y Axis: Pres */}
                        <text
                          x={plotData.padding.left + plotData.innerW + 8}
                          y={y + 3.5}
                          fill="#4cd7f6"
                          fontSize="9.5"
                          textAnchor="start"
                          fontFamily="monospace"
                        >
                          {(plotData.minPres + frac * (plotData.maxPres - plotData.minPres)).toFixed(1)} bar
                        </text>
                      </>
                    )}

                    {metricMode === 'flow_vf' && (
                      <>
                        {/* Left Y Axis: Flow */}
                        <text
                          x={plotData.padding.left - 8}
                          y={y + 3.5}
                          fill="#4edea3"
                          fontSize="9.5"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {(plotData.minFlow + frac * (plotData.maxFlow - plotData.minFlow)).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg/h
                        </text>
                        {/* Right Y Axis: VF */}
                        <text
                          x={plotData.padding.left + plotData.innerW + 8}
                          y={y + 3.5}
                          fill="#4cd7f6"
                          fontSize="9.5"
                          textAnchor="start"
                          fontFamily="monospace"
                        >
                          {(frac * 1.0).toFixed(2)} VF
                        </text>
                      </>
                    )}

                    {metricMode === 'compositions' && (
                      <>
                        <text
                          x={plotData.padding.left - 8}
                          y={y + 3.5}
                          fill="#869397"
                          fontSize="9.5"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {(frac * 1.0).toFixed(2)}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

              {/* Vertical Gridlines & Stream ID labels on X Axis */}
              {plotData.pointsX.map((x, idx) => {
                const s = streams[idx];
                return (
                  <g key={s.id}>
                    <line
                      x1={x}
                      y1={plotData.padding.top}
                      x2={x}
                      y2={plotData.padding.top + plotData.innerH}
                      stroke="#3d494c"
                      strokeOpacity="0.25"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={x}
                      y={plotData.padding.top + plotData.innerH + 16}
                      fill="#dae2fd"
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {s.id}
                    </text>
                    <text
                      x={x}
                      y={plotData.padding.top + plotData.innerH + 28}
                      fill={s.phase === 'Vapor' ? '#ffddb8' : s.phase === 'Liquid' ? '#4cd7f6' : '#4edea3'}
                      fontSize="8"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {s.phase.substring(0, 3)}
                    </text>
                  </g>
                );
              })}

              {/* Plot Curves based on mode */}
              {metricMode === 'temp_pres' && (
                <>
                  {/* Temperature Polyline */}
                  <path d={plotData.tempPath} fill="none" stroke="#ffb95f" strokeWidth="2.5" />
                  {/* Pressure Polyline */}
                  <path d={plotData.presPath} fill="none" stroke="#4cd7f6" strokeWidth="2.5" />

                  {/* Temperature Data Dots */}
                  {plotData.tempCoords.map((c, i) => (
                    <circle
                      key={`t-${i}`}
                      cx={c.x}
                      cy={c.y}
                      r="4.5"
                      fill="#ffb95f"
                      stroke="#060e20"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:r-6 transition-all"
                      onMouseEnter={() => setHoveredStream({ x: c.x, y: c.y, stream: c.s })}
                      onMouseLeave={() => setHoveredStream(null)}
                    />
                  ))}

                  {/* Pressure Data Dots */}
                  {plotData.presCoords.map((c, i) => (
                    <circle
                      key={`p-${i}`}
                      cx={c.x}
                      cy={c.y}
                      r="4"
                      fill="#4cd7f6"
                      stroke="#060e20"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:r-6 transition-all"
                      onMouseEnter={() => setHoveredStream({ x: c.x, y: c.y, stream: c.s })}
                      onMouseLeave={() => setHoveredStream(null)}
                    />
                  ))}
                </>
              )}

              {metricMode === 'flow_vf' && (
                <>
                  {/* Flow Polyline */}
                  <path d={plotData.flowPath} fill="none" stroke="#4edea3" strokeWidth="2.5" />
                  {/* VF Polyline */}
                  <path d={plotData.vfPath} fill="none" stroke="#4cd7f6" strokeWidth="2" strokeDasharray="4 2" />

                  {plotData.flowCoords.map((c, i) => (
                    <circle
                      key={`f-${i}`}
                      cx={c.x}
                      cy={c.y}
                      r="4"
                      fill="#4edea3"
                      stroke="#060e20"
                      strokeWidth="1.5"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredStream({ x: c.x, y: c.y, stream: c.s })}
                      onMouseLeave={() => setHoveredStream(null)}
                    />
                  ))}

                  {plotData.vfCoords.map((c, i) => (
                    <circle
                      key={`vf-${i}`}
                      cx={c.x}
                      cy={c.y}
                      r="3.5"
                      fill="#4cd7f6"
                      stroke="#060e20"
                      strokeWidth="1.5"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredStream({ x: c.x, y: c.y, stream: c.s })}
                      onMouseLeave={() => setHoveredStream(null)}
                    />
                  ))}
                </>
              )}

              {metricMode === 'compositions' && (
                <>
                  {plotData.compCurves.map((curve) => (
                    <g key={curve.id}>
                      <path d={curve.path} fill="none" stroke={curve.color} strokeWidth="2" />
                      {curve.pts.map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r="3"
                          fill={curve.color}
                          stroke="#060e20"
                          strokeWidth="1"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredStream({ x: pt.x, y: pt.y, stream: pt.s })}
                          onMouseLeave={() => setHoveredStream(null)}
                        />
                      ))}
                    </g>
                  ))}
                </>
              )}

              {/* Axis Label Descriptions */}
              {metricMode === 'temp_pres' && (
                <>
                  <text
                    x={16}
                    y={plotData.padding.top + plotData.innerH / 2}
                    fill="#ffddb8"
                    fontSize="10"
                    textAnchor="middle"
                    transform={`rotate(-90 16 ${plotData.padding.top + plotData.innerH / 2})`}
                    fontWeight="bold"
                  >
                    Temperature [°C]
                  </text>
                  <text
                    x={plotData.width - 16}
                    y={plotData.padding.top + plotData.innerH / 2}
                    fill="#4cd7f6"
                    fontSize="10"
                    textAnchor="middle"
                    transform={`rotate(90 ${plotData.width - 16} ${plotData.padding.top + plotData.innerH / 2})`}
                    fontWeight="bold"
                  >
                    Pressure [bar]
                  </text>
                </>
              )}

              {metricMode === 'flow_vf' && (
                <>
                  <text
                    x={16}
                    y={plotData.padding.top + plotData.innerH / 2}
                    fill="#4edea3"
                    fontSize="10"
                    textAnchor="middle"
                    transform={`rotate(-90 16 ${plotData.padding.top + plotData.innerH / 2})`}
                    fontWeight="bold"
                  >
                    Mass Flow Rate [kg/h]
                  </text>
                  <text
                    x={plotData.width - 16}
                    y={plotData.padding.top + plotData.innerH / 2}
                    fill="#4cd7f6"
                    fontSize="10"
                    textAnchor="middle"
                    transform={`rotate(90 ${plotData.width - 16} ${plotData.padding.top + plotData.innerH / 2})`}
                    fontWeight="bold"
                  >
                    Vapor Fraction [0-1]
                  </text>
                </>
              )}

              {metricMode === 'compositions' && (
                <text
                  x={16}
                  y={plotData.padding.top + plotData.innerH / 2}
                  fill="#dae2fd"
                  fontSize="10"
                  textAnchor="middle"
                  transform={`rotate(-90 16 ${plotData.padding.top + plotData.innerH / 2})`}
                  fontWeight="bold"
                >
                  Mole Fraction (z_i)
                </text>
              )}
            </svg>

            {/* Hover Tooltip */}
            {hoveredStream && (
              <div
                className="absolute z-20 bg-[#171f33] text-[#dae2fd] text-[10px] p-2.5 rounded shadow-xl border border-[#3d494c] pointer-events-none min-w-[200px]"
                style={{
                  left: Math.min(hoveredStream.x + 10, plotData.width - 220),
                  top: Math.max(10, hoveredStream.y - 65),
                }}
              >
                <div className="font-bold text-[#4cd7f6] flex justify-between">
                  <span>{hoveredStream.stream.id} : {hoveredStream.stream.name}</span>
                  <span className="text-[#869397]">{hoveredStream.stream.phase}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 font-mono text-[9.5px]">
                  <div>T: <span className="text-[#ffddb8]">{hoveredStream.stream.tempC.toFixed(1)} °C</span></div>
                  <div>P: <span className="text-[#4cd7f6]">{hoveredStream.stream.presBar.toFixed(2)} bar</span></div>
                  <div>Flow: <span className="text-[#4edea3]">{Math.round(hoveredStream.stream.flowKgH).toLocaleString()} kg/h</span></div>
                  <div>VF: <span className="text-[#dae2fd]">{hoveredStream.stream.vaporFraction.toFixed(2)}</span></div>
                  <div>MW: <span className="text-[#dae2fd]">{hoveredStream.stream.mw.toFixed(1)}</span></div>
                  <div>ρ: <span className="text-[#869397]">{hoveredStream.stream.densityKgM3.toFixed(1)} kg/m³</span></div>
                </div>
              </div>
            )}

            {/* Sub-Legend */}
            <div className="flex flex-wrap items-center justify-between text-[9.5px] pt-1.5 border-t border-[#3d494c]/20 text-[#869397]">
              {metricMode === 'temp_pres' && (
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-[#ffb95f]">
                    <span className="w-3 h-0.5 bg-[#ffb95f] inline-block" /> Temperature (°C)
                  </span>
                  <span className="flex items-center gap-1 text-[#4cd7f6]">
                    <span className="w-3 h-0.5 bg-[#4cd7f6] inline-block" /> Pressure (bar)
                  </span>
                  <span className="text-[#dae2fd]">
                    Sequence of {streams.length} streams through plant circuit
                  </span>
                </div>
              )}

              {metricMode === 'flow_vf' && (
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-[#4edea3]">
                    <span className="w-3 h-0.5 bg-[#4edea3] inline-block" /> Mass Flow (kg/h)
                  </span>
                  <span className="flex items-center gap-1 text-[#4cd7f6]">
                    <span className="w-3 h-0.5 bg-[#4cd7f6] border-b border-dashed inline-block" /> Vapor Fraction
                  </span>
                </div>
              )}

              {metricMode === 'compositions' && (
                <div className="flex flex-wrap items-center gap-3">
                  {plotData.compCurves.map((c) => (
                    <span key={c.id} className="flex items-center gap-1 font-mono" style={{ color: c.color }}>
                      <span className="w-2.5 h-1 rounded inline-block" style={{ backgroundColor: c.color }} />
                      {c.formula}
                    </span>
                  ))}
                </div>
              )}

              <span className="text-[#869397]">Interactive node hover reveals detailed stream properties</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 overflow-x-auto shadow-xl">
        <table className="w-full text-left text-[10.5px]">
          <thead>
            <tr className="text-[#869397] border-b border-[#3d494c]/30 uppercase text-[9.5px]">
              <th className="py-2 px-2">Stream</th>
              <th className="py-2 px-2">Phase</th>
              <th className="py-2 px-2 text-right">Temp</th>
              <th className="py-2 px-2 text-right">Pressure</th>
              <th className="py-2 px-2 text-right">Mass Flow</th>
              <th className="py-2 px-2 text-right">Vapor Frac.</th>
              <th className="py-2 px-2 text-right">MW</th>
              <th className="py-2 px-2 text-right">Enthalpy</th>
              <th className="py-2 px-2 text-right">Density</th>
              {components.map((c) => (
                <th key={c.id} className="py-2 px-2 text-right text-[#4cd7f6]">{c.formula}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3d494c]/20">
            {streams.map((st) => (
              <tr key={st.id} className="hover:bg-[#222a3d] transition-colors">
                <td className="py-2 px-2 font-bold text-[#4cd7f6]">{st.id}</td>
                <td className="py-2 px-2 text-[#bcc9cd]">{st.phase}</td>
                <td className="py-2 px-2 text-right text-[#ffddb8]">{formatTemp(st.tempC, unitSystem)}</td>
                <td className="py-2 px-2 text-right text-[#dae2fd]">{formatPres(st.presBar, unitSystem)}</td>
                <td className="py-2 px-2 text-right text-[#4edea3]">{formatFlow(st.flowKgH, unitSystem)}</td>
                <td className="py-2 px-2 text-right text-[#4cd7f6]">{st.vaporFraction.toFixed(2)}</td>
                <td className="py-2 px-2 text-right text-[#dae2fd]">{st.mw.toFixed(2)}</td>
                <td className="py-2 px-2 text-right text-[#bcc9cd]">
                  {st.enthalpyKjKg > 0 ? `+${st.enthalpyKjKg.toFixed(1)}` : st.enthalpyKjKg.toFixed(1)} kJ/kg
                </td>
                <td className="py-2 px-2 text-right text-[#869397]">{st.densityKgM3.toFixed(1)} kg/m³</td>
                {components.map((c) => {
                  const val = st.compositions[c.id] ?? 0;
                  return (
                    <td
                      key={c.id}
                      className={`py-2 px-2 text-right ${
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
    </div>
  );
};
