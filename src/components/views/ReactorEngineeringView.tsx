import React, { useState, useMemo } from 'react';
import { EquipmentUnit, ProcessStream, UnitSystem } from '../../types/simulation';
import { integrateReactorOde } from '../../engine/thermoEngine';
import { ReactionEditor } from '../reactors/ReactionEditor';

interface ReactorEngineeringViewProps {
  unit: EquipmentUnit;
  inletStream: ProcessStream;
  unitSystem: UnitSystem;
}

export const ReactorEngineeringView: React.FC<ReactorEngineeringViewProps> = ({
  unit,
  inletStream,
}) => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'editor' | 'ergun'>('profiles');
  const [chartMetric, setChartMetric] = useState<'temp_conv' | 'temp_pres' | 'rate'>('temp_conv');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; pt: ReturnType<typeof integrateReactorOde>['profile'][0] } | null>(null);

  const { profile, outletTempC, outletPresBar, conversionPct } = integrateReactorOde(unit, inletStream);

  const chartData = useMemo(() => {
    if (!profile || profile.length === 0) return null;

    const width = 860;
    const height = 240;
    const padding = { top: 25, right: 65, bottom: 45, left: 65 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const maxZ = Math.max(0.1, unit.geometry?.bedHeightM || profile[profile.length - 1].zM || 5.4);
    const scaleX = (z: number) => padding.left + (z / maxZ) * innerW;

    // Temperature scale
    const temps = profile.map((p) => p.tempC);
    const minTemp = Math.floor(Math.min(...temps) - 5);
    const maxTemp = Math.ceil(Math.max(...temps) + 5);
    const rangeTemp = Math.max(1, maxTemp - minTemp);
    const scaleYTemp = (t: number) => padding.top + innerH - ((t - minTemp) / rangeTemp) * innerH;

    // Conversion scale (0 to maxConv%)
    const rawMaxConv = Math.max(...profile.map((p) => p.conversionPct));
    const maxConv = Math.max(10, Math.ceil(rawMaxConv > 80 ? 100 : rawMaxConv * 1.25));
    const scaleYConv = (c: number) => padding.top + innerH - (c / maxConv) * innerH;

    // Pressure scale
    const pressures = profile.map((p) => p.presBar);
    const minPres = Math.max(0, Math.floor(Math.min(...pressures) - 0.5));
    const maxPres = Math.ceil(Math.max(...pressures) + 0.5);
    const rangePres = Math.max(0.1, maxPres - minPres);
    const scaleYPres = (p: number) => padding.top + innerH - ((p - minPres) / rangePres) * innerH;

    // Reaction rate scale
    const rates = profile.map((p) => p.c6h6Rate);
    const maxRate = Math.max(1e-4, Math.max(...rates) * 1.15);
    const scaleYRate = (r: number) => padding.top + innerH - (r / maxRate) * innerH;

    const tempCoords = profile.map((p) => ({ x: scaleX(p.zM), y: scaleYTemp(p.tempC), pt: p }));
    const convCoords = profile.map((p) => ({ x: scaleX(p.zM), y: scaleYConv(p.conversionPct), pt: p }));
    const presCoords = profile.map((p) => ({ x: scaleX(p.zM), y: scaleYPres(p.presBar), pt: p }));
    const rateCoords = profile.map((p) => ({ x: scaleX(p.zM), y: scaleYRate(p.c6h6Rate), pt: p }));

    const tempPath = tempCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
    const convPath = convCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
    const presPath = presCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
    const ratePath = rateCoords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');

    return {
      width,
      height,
      padding,
      innerW,
      innerH,
      maxZ,
      minTemp,
      maxTemp,
      maxConv,
      minPres,
      maxPres,
      maxRate,
      scaleX,
      tempCoords,
      convCoords,
      presCoords,
      rateCoords,
      tempPath,
      convPath,
      presPath,
      ratePath,
    };
  }, [profile, unit.geometry?.bedHeightM]);

  return (
    <div className="p-3 space-y-3 max-w-7xl mx-auto font-mono text-[11px] select-none">
      {/* Top Banner */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-bold">
            <span className="material-symbols-outlined text-[18px]">propane_tank</span>
            <span>CATALYTIC FIXED-BED REACTOR &amp; KINETICS SUITE ({unit.tag || 'R-101'})</span>
          </div>
          <p className="text-[#869397] text-[10px] mt-0.5">
            Two-phase packed bed hydrotreating &amp; reforming with Langmuir-Hinshelwood and multi-reaction kinetics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[#869397] block text-[9px]">Conversion</span>
            <span className="text-[#4edea3] font-bold text-[13px]">{conversionPct}%</span>
          </div>
          <div className="text-right">
            <span className="text-[#869397] block text-[9px]">Outlet Temp</span>
            <span className="text-[#ffddb8] font-bold text-[13px]">{outletTempC} °C</span>
          </div>
          <div className="text-right">
            <span className="text-[#869397] block text-[9px]">Outlet Pres</span>
            <span className="text-[#dae2fd] font-bold text-[13px]">{outletPresBar} bar</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-[#131b2e] p-1 rounded border border-[#3d494c]/30 gap-1 text-[11px]">
        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'profiles'
              ? 'bg-[#222a3d] text-[#4cd7f6] font-bold border border-[#4cd7f6]/40'
              : 'text-[#bcc9cd] hover:text-[#dae2fd]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">linear_scale</span>
          <span>Axial Bed State Profiles (ODE15s)</span>
        </button>

        <button
          onClick={() => setActiveTab('editor')}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'editor'
              ? 'bg-[#222a3d] text-[#4cd7f6] font-bold border border-[#4cd7f6]/40'
              : 'text-[#bcc9cd] hover:text-[#dae2fd]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">science</span>
          <span>Reaction Kinetics Editor</span>
        </button>

        <button
          onClick={() => setActiveTab('ergun')}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'ergun'
              ? 'bg-[#222a3d] text-[#4cd7f6] font-bold border border-[#4cd7f6]/40'
              : 'text-[#bcc9cd] hover:text-[#dae2fd]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">straighten</span>
          <span>Ergun Bed Hydraulics &amp; Catalyst</span>
        </button>
      </div>

      {/* TAB 1: Axial Profiles */}
      {activeTab === 'profiles' && (
        <div className="grid grid-cols-12 gap-3">
          {/* Axial Bed State Profiles SVG Chart (Span 12) */}
          {chartData && (
            <div className="col-span-12 bg-[#171f33] p-3.5 rounded border border-[#3d494c]/40 space-y-2.5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3d494c]/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ffb95f] text-[18px]">show_chart</span>
                  <div>
                    <span className="text-[#dae2fd] font-bold text-[12px]">
                      AXIAL CATALYST BED STATE TRAJECTORY T(z), P(z) &amp; X(z)
                    </span>
                    <p className="text-[#869397] text-[10px]">
                      Stiff ODE15s numerical integration of energy, momentum (Ergun) and multi-reaction kinetics along reactor length
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px]">
                  <div className="flex bg-[#060e20] p-0.5 rounded border border-[#3d494c]/30">
                    <button
                      onClick={() => setChartMetric('temp_conv')}
                      className={`px-2.5 py-1 rounded font-bold transition-colors ${
                        chartMetric === 'temp_conv'
                          ? 'bg-[#ffb95f] text-[#2c1600]'
                          : 'text-[#869397] hover:text-[#dae2fd]'
                      }`}
                    >
                      Temp &amp; Conversion
                    </button>
                    <button
                      onClick={() => setChartMetric('temp_pres')}
                      className={`px-2.5 py-1 rounded font-bold transition-colors ${
                        chartMetric === 'temp_pres'
                          ? 'bg-[#ffb95f] text-[#2c1600]'
                          : 'text-[#869397] hover:text-[#dae2fd]'
                      }`}
                    >
                      Temp &amp; Pressure Drop
                    </button>
                    <button
                      onClick={() => setChartMetric('rate')}
                      className={`px-2.5 py-1 rounded font-bold transition-colors ${
                        chartMetric === 'rate'
                          ? 'bg-[#ffb95f] text-[#2c1600]'
                          : 'text-[#869397] hover:text-[#dae2fd]'
                      }`}
                    >
                      Reaction Rate
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20">
                <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} className="w-full h-auto select-none">
                  {/* Horizontal Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                    const y = chartData.padding.top + chartData.innerH * (1 - frac);
                    return (
                      <g key={idx}>
                        <line
                          x1={chartData.padding.left}
                          y1={y}
                          x2={chartData.padding.left + chartData.innerW}
                          y2={y}
                          stroke="#3d494c"
                          strokeOpacity="0.3"
                          strokeDasharray="3 3"
                        />

                        {/* Left Y-Axis: Temperature */}
                        <text
                          x={chartData.padding.left - 8}
                          y={y + 3.5}
                          fill="#ffddb8"
                          fontSize="9.5"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {(chartData.minTemp + frac * (chartData.maxTemp - chartData.minTemp)).toFixed(0)} °C
                        </text>

                        {/* Right Y-Axis based on Metric */}
                        {chartMetric === 'temp_conv' && (
                          <text
                            x={chartData.padding.left + chartData.innerW + 8}
                            y={y + 3.5}
                            fill="#4edea3"
                            fontSize="9.5"
                            textAnchor="start"
                            fontFamily="monospace"
                          >
                            {(frac * chartData.maxConv).toFixed(0)}%
                          </text>
                        )}

                        {chartMetric === 'temp_pres' && (
                          <text
                            x={chartData.padding.left + chartData.innerW + 8}
                            y={y + 3.5}
                            fill="#4cd7f6"
                            fontSize="9.5"
                            textAnchor="start"
                            fontFamily="monospace"
                          >
                            {(chartData.minPres + frac * (chartData.maxPres - chartData.minPres)).toFixed(1)} bar
                          </text>
                        )}

                        {chartMetric === 'rate' && (
                          <text
                            x={chartData.padding.left + chartData.innerW + 8}
                            y={y + 3.5}
                            fill="#acedff"
                            fontSize="9.5"
                            textAnchor="start"
                            fontFamily="monospace"
                          >
                            {(frac * chartData.maxRate).toFixed(2)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Vertical Length Gridlines (Z = 0, 1, 2, 3, 4, 5 m) */}
                  {[0, 1, 2, 3, 4, 5].map((zVal) => {
                    if (zVal > chartData.maxZ) return null;
                    const x = chartData.scaleX(zVal);
                    return (
                      <g key={`z-${zVal}`}>
                        <line
                          x1={x}
                          y1={chartData.padding.top}
                          x2={x}
                          y2={chartData.padding.top + chartData.innerH}
                          stroke="#3d494c"
                          strokeOpacity="0.25"
                          strokeDasharray="2 2"
                        />
                        <text
                          x={x}
                          y={chartData.padding.top + chartData.innerH + 16}
                          fill="#dae2fd"
                          fontSize="9.5"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {zVal.toFixed(1)} m
                        </text>
                      </g>
                    );
                  })}

                  {/* Quench Injection vertical marker at z = 2.7m */}
                  {chartData.maxZ >= 2.7 && (
                    <g>
                      <line
                        x1={chartData.scaleX(2.7)}
                        y1={chartData.padding.top - 5}
                        x2={chartData.scaleX(2.7)}
                        y2={chartData.padding.top + chartData.innerH}
                        stroke="#acedff"
                        strokeDasharray="3 3"
                        strokeWidth="1.5"
                      />
                      <rect
                        x={chartData.scaleX(2.7) - 60}
                        y={chartData.padding.top - 18}
                        width="120"
                        height="14"
                        rx="3"
                        fill="#171f33"
                        stroke="#acedff"
                        strokeWidth="0.8"
                      />
                      <text
                        x={chartData.scaleX(2.7)}
                        y={chartData.padding.top - 8}
                        fill="#acedff"
                        fontSize="8.5"
                        textAnchor="middle"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        Quench Injection (z=2.7m)
                      </text>
                    </g>
                  )}

                  {/* Primary Curve: Temperature */}
                  <path d={chartData.tempPath} fill="none" stroke="#ffb95f" strokeWidth="2.5" />

                  {/* Secondary Curve: Conversion or Pressure or Rate */}
                  {chartMetric === 'temp_conv' && (
                    <path d={chartData.convPath} fill="none" stroke="#4edea3" strokeWidth="2.2" strokeDasharray="4 2" />
                  )}

                  {chartMetric === 'temp_pres' && (
                    <path d={chartData.presPath} fill="none" stroke="#4cd7f6" strokeWidth="2.2" strokeDasharray="3 2" />
                  )}

                  {chartMetric === 'rate' && (
                    <path d={chartData.ratePath} fill="none" stroke="#acedff" strokeWidth="2.2" />
                  )}

                  {/* Data Points on Hover */}
                  {chartData.tempCoords.map((c, i) => (
                    <circle
                      key={`pt-${i}`}
                      cx={c.x}
                      cy={c.y}
                      r="3.5"
                      fill="#ffb95f"
                      stroke="#060e20"
                      strokeWidth="1.2"
                      className="cursor-pointer hover:r-5 transition-all"
                      onMouseEnter={() => setHoveredPoint({ x: c.x, y: c.y, pt: c.pt })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  ))}

                  {/* Axis Title Labels */}
                  <text
                    x={16}
                    y={chartData.padding.top + chartData.innerH / 2}
                    fill="#ffddb8"
                    fontSize="10"
                    textAnchor="middle"
                    transform={`rotate(-90 16 ${chartData.padding.top + chartData.innerH / 2})`}
                    fontWeight="bold"
                  >
                    Bed Temperature [°C]
                  </text>

                  {chartMetric === 'temp_conv' && (
                    <text
                      x={chartData.width - 16}
                      y={chartData.padding.top + chartData.innerH / 2}
                      fill="#4edea3"
                      fontSize="10"
                      textAnchor="middle"
                      transform={`rotate(90 ${chartData.width - 16} ${chartData.padding.top + chartData.innerH / 2})`}
                      fontWeight="bold"
                    >
                      Aromatic Conversion X(z) [%]
                    </text>
                  )}

                  {chartMetric === 'temp_pres' && (
                    <text
                      x={chartData.width - 16}
                      y={chartData.padding.top + chartData.innerH / 2}
                      fill="#4cd7f6"
                      fontSize="10"
                      textAnchor="middle"
                      transform={`rotate(90 ${chartData.width - 16} ${chartData.padding.top + chartData.innerH / 2})`}
                      fontWeight="bold"
                    >
                      Pressure P(z) [bar]
                    </text>
                  )}

                  {chartMetric === 'rate' && (
                    <text
                      x={chartData.width - 16}
                      y={chartData.padding.top + chartData.innerH / 2}
                      fill="#acedff"
                      fontSize="10"
                      textAnchor="middle"
                      transform={`rotate(90 ${chartData.width - 16} ${chartData.padding.top + chartData.innerH / 2})`}
                      fontWeight="bold"
                    >
                      Rate r_c6h6 [mol/m³·s]
                    </text>
                  )}

                  <text
                    x={chartData.padding.left + chartData.innerW / 2}
                    y={chartData.height - 8}
                    fill="#869397"
                    fontSize="10"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    Axial Bed Coordinate z [m] (Catalyst Length)
                  </text>
                </svg>

                {/* Hover Tooltip */}
                {hoveredPoint && (
                  <div
                    className="absolute z-20 bg-[#171f33] text-[#dae2fd] text-[10px] p-2.5 rounded shadow-xl border border-[#3d494c] pointer-events-none min-w-[180px]"
                    style={{
                      left: Math.min(hoveredPoint.x + 10, chartData.width - 200),
                      top: Math.max(10, hoveredPoint.y - 60),
                    }}
                  >
                    <div className="font-bold text-[#ffddb8] border-b border-[#3d494c]/30 pb-0.5">
                      z = {hoveredPoint.pt.zM.toFixed(2)} m
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1 font-mono text-[9.5px]">
                      <div>Temp: <span className="text-[#ffddb8] font-bold">{hoveredPoint.pt.tempC.toFixed(1)} °C</span></div>
                      <div>Pres: <span className="text-[#4cd7f6]">{hoveredPoint.pt.presBar.toFixed(2)} bar</span></div>
                      <div>Conv: <span className="text-[#4edea3] font-bold">{hoveredPoint.pt.conversionPct}%</span></div>
                      <div>Rate: <span className="text-[#acedff]">{hoveredPoint.pt.c6h6Rate}</span></div>
                    </div>
                  </div>
                )}

                {/* Legend & Stats Footer */}
                <div className="flex flex-wrap items-center justify-between text-[9.5px] pt-1.5 border-t border-[#3d494c]/20 text-[#869397]">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-[#ffb95f]">
                      <span className="w-3 h-0.5 bg-[#ffb95f] inline-block" /> Temperature T(z)
                    </span>
                    {chartMetric === 'temp_conv' && (
                      <span className="flex items-center gap-1 text-[#4edea3]">
                        <span className="w-3 h-0.5 bg-[#4edea3] border-b border-dashed inline-block" /> Conversion X(z)
                      </span>
                    )}
                    {chartMetric === 'temp_pres' && (
                      <span className="flex items-center gap-1 text-[#4cd7f6]">
                        <span className="w-3 h-0.5 bg-[#4cd7f6] border-b border-dashed inline-block" /> Pressure P(z)
                      </span>
                    )}
                    {chartMetric === 'rate' && (
                      <span className="flex items-center gap-1 text-[#acedff]">
                        <span className="w-3 h-0.5 bg-[#acedff] inline-block" /> Rate of Reaction
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[#acedff]">
                      <span className="w-2.5 h-2.5 border border-dashed border-[#acedff] inline-block" /> Quench Inter-stage
                    </span>
                  </div>
                  <span className="font-mono text-[#dae2fd]">
                    Bed Height: {unit.geometry?.bedHeightM || 5.4} m | ΔT_bed: {(outletTempC - unit.equilibrium.inletTempC).toFixed(1)} °C
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Kinetic Rate Laws (Cols 1 to 6) */}
          <div className="col-span-12 md:col-span-6 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
            <span className="font-bold text-[#4cd7f6] flex items-center gap-1.5 border-b border-[#3d494c]/30 pb-1.5">
              <span className="material-symbols-outlined text-[16px]">dynamic_form</span>
              Langmuir-Hinshelwood Rate Laws &amp; Mechanism
            </span>

            <div className="space-y-2">
              {unit.kinetics?.map((rx, idx) => (
                <div key={rx.id} className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#ffddb8]">Reaction {idx + 1}: {rx.name}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] ${rx.type === 'Endo' ? 'bg-[#ffb95f]/20 text-[#ffb95f]' : 'bg-[#4edea3]/20 text-[#4edea3]'}`}>
                      {rx.type} (ΔH: {rx.deltaHKJPerMol > 0 ? `+${rx.deltaHKJPerMol}` : rx.deltaHKJPerMol} kJ/mol)
                    </span>
                  </div>
                  <div className="text-white text-[11px] font-semibold">{rx.equation}</div>
                  <div className="text-[#869397] text-[9.5px]">
                    Rate r = (k₁ · P_hc · P_h2 - k₂ · P_prod) / (1 + K_ads · P_total)²
                  </div>
                </div>
              ))}
            </div>

            {/* Operating Summary */}
            <div className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 space-y-1.5 text-[10px]">
              <span className="text-[#4edea3] font-bold block">Inlet Operating Specifications:</span>
              <div className="grid grid-cols-3 gap-2 text-[#dae2fd]">
                <div>Inlet Temp: <span className="text-[#ffddb8]">{unit.equilibrium.inletTempC.toFixed(1)} °C</span></div>
                <div>Pressure: <span>{unit.equilibrium.operatingPresBar.toFixed(1)} bar</span></div>
                <div>LHSV: <span>{unit.equilibrium.lhsvSpaceVelH1.toFixed(1)} h⁻¹</span></div>
              </div>
            </div>
          </div>

          {/* Axial Bed Profiles Table (Cols 7 to 12) */}
          <div className="col-span-12 md:col-span-6 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
            <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-1.5">
              <span className="font-bold text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">linear_scale</span>
                Integrated Bed Axial State Vector
              </span>
              <span className="text-[#869397] text-[9.5px]">Δz = 0.14 m</span>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="text-[#869397] border-b border-[#3d494c]/30">
                    <th className="py-1">Length z [m]</th>
                    <th className="py-1 text-right">Temp [°C]</th>
                    <th className="py-1 text-right">Pres [bar]</th>
                    <th className="py-1 text-right">Conv. [%]</th>
                    <th className="py-1 text-right">Reaction Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d494c]/20">
                  {profile.filter((_, i) => i % 2 === 0).map((pt) => (
                    <tr key={pt.zM} className={pt.zM === 2.7 ? 'bg-[#222a3d] font-bold text-[#acedff]' : 'hover:bg-[#222a3d]'}>
                      <td className="py-1 text-[#4cd7f6]">{pt.zM.toFixed(2)}</td>
                      <td className="py-1 text-right text-[#ffddb8]">{pt.tempC.toFixed(1)}</td>
                      <td className="py-1 text-right text-[#dae2fd]">{pt.presBar.toFixed(2)}</td>
                      <td className="py-1 text-right text-[#4edea3]">{pt.conversionPct}%</td>
                      <td className="py-1 text-right text-[#869397]">{pt.c6h6Rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Reaction Kinetics Editor */}
      {activeTab === 'editor' && (
        <ReactionEditor />
      )}

      {/* TAB 3: Ergun Pressure Drop & Bed Hydraulics */}
      {activeTab === 'ergun' && (
        <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
          <span className="font-bold text-[#4cd7f6] flex items-center gap-1.5 border-b border-[#3d494c]/30 pb-1.5">
            <span className="material-symbols-outlined text-[16px]">compress</span>
            Ergun Equation &amp; Catalyst Mechanics
          </span>

          <div className="bg-[#060e20] p-3 rounded border border-[#3d494c]/20 space-y-2 text-[10.5px]">
            <span className="text-[#4edea3] font-bold block">Ergun Momentum Balance for Packed Bed:</span>
            <div className="text-[#dae2fd] font-mono p-2 bg-[#131b2e] rounded border border-[#3d494c]/30">
              -dP/dz = 150 · [µ · (1 - ε)² / (d_p² · ε³)] · v_s + 1.75 · [ρ · (1 - ε) / (d_p · ε³)] · v_s²
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2 text-[10px]">
              <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block">Bed Voidage (ε)</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">{unit.geometry.bedVoidage}</span>
              </div>
              <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block">Pellet Diameter (d_p)</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">{unit.catalyst?.pelletDiameterMm || 2.5} mm</span>
              </div>
              <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block">Catalyst Volume</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">{unit.geometry.catalystVolumeM3.toFixed(1)} m³</span>
              </div>
              <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block">Bed Height</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">{unit.geometry.bedHeightM.toFixed(1)} m</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
