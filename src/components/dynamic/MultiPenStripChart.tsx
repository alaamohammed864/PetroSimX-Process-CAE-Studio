import React, { useState, useMemo } from 'react';
import { PIDController, DynamicProcessVariable } from '../../types/dynamic';

interface MultiPenStripChartProps {
  controller: PIDController;
  pvVariable: DynamicProcessVariable;
  timeSec: number;
}

export const MultiPenStripChart: React.FC<MultiPenStripChartProps> = ({
  controller,
  pvVariable,
  timeSec,
}) => {
  const [windowSec, setWindowSec] = useState<number>(60);
  const [hoveredPoint, setHoveredPoint] = useState<{
    time: number;
    sp: number;
    pv: number;
    op: number;
  } | null>(null);

  // Filter history to current viewing window
  const windowHistory = useMemo(() => {
    const minTime = Math.max(0, timeSec - windowSec);
    return controller.history.filter((h) => h.time >= minTime);
  }, [controller.history, timeSec, windowSec]);

  // Determine PV Y-axis bounds
  const { minPv, maxPv } = useMemo(() => {
    if (windowHistory.length === 0) {
      return { minPv: pvVariable.minRange, maxPv: pvVariable.maxRange };
    }
    let min = Infinity;
    let max = -Infinity;
    windowHistory.forEach((pt) => {
      min = Math.min(min, pt.pv, pt.sp);
      max = Math.max(max, pt.pv, pt.sp);
    });

    const span = Math.max(2, max - min);
    const paddedMin = Math.floor(min - span * 0.15);
    const paddedMax = Math.ceil(max + span * 0.15);
    return { minPv: paddedMin, maxPv: paddedMax };
  }, [windowHistory, pvVariable]);

  const svgWidth = 720;
  const svgHeight = 260;
  const padLeft = 55;
  const padRight = 50;
  const padTop = 20;
  const padBottom = 35;

  const minTime = Math.max(0, timeSec - windowSec);
  const maxTime = Math.max(windowSec, timeSec);

  const scaleX = (t: number) => {
    if (maxTime === minTime) return padLeft;
    return padLeft + ((t - minTime) / (maxTime - minTime)) * (svgWidth - padLeft - padRight);
  };

  const scaleY_PV = (val: number) => {
    if (maxPv === minPv) return svgHeight / 2;
    return svgHeight - padBottom - ((val - minPv) / (maxPv - minPv)) * (svgHeight - padTop - padBottom);
  };

  const scaleY_OP = (opPct: number) => {
    // OP is 0 to 100%
    return svgHeight - padBottom - (opPct / 100) * (svgHeight - padTop - padBottom);
  };

  const pvPath = useMemo(() => {
    if (windowHistory.length < 2) return '';
    return windowHistory
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(pt.time).toFixed(1)} ${scaleY_PV(pt.pv).toFixed(1)}`)
      .join(' ');
  }, [windowHistory, minTime, maxTime, minPv, maxPv]);

  const spPath = useMemo(() => {
    if (windowHistory.length < 2) return '';
    return windowHistory
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(pt.time).toFixed(1)} ${scaleY_PV(pt.sp).toFixed(1)}`)
      .join(' ');
  }, [windowHistory, minTime, maxTime, minPv, maxPv]);

  const opPath = useMemo(() => {
    if (windowHistory.length < 2) return '';
    return windowHistory
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(pt.time).toFixed(1)} ${scaleY_OP(pt.op).toFixed(1)}`)
      .join(' ');
  }, [windowHistory, minTime, maxTime]);

  const currentError = Math.abs(controller.setPoint - controller.processVariable);

  return (
    <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 space-y-3">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#3d494c]/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-[#4cd7f6]">{controller.tag}</span>
            <span className="text-xs font-semibold text-[#dae2fd]">
              {controller.name} — Multi-Pen Real-Time Dynamic Response
            </span>
          </div>
          <p className="text-[11px] text-[#869397] font-mono mt-0.5">
            PV: {controller.pvTag} ({pvVariable.unit}) | MV: {controller.mvTag} (0-100% OP)
          </p>
        </div>

        {/* Window Selector & Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[#ffb95f]">
              <span className="w-3 h-0.5 bg-[#ffb95f] inline-block" /> PV (Process)
            </span>
            <span className="flex items-center gap-1.5 text-[#dae2fd]">
              <span className="w-3 h-0.5 border-b border-dashed border-[#dae2fd] inline-block" /> SP (Setpoint)
            </span>
            <span className="flex items-center gap-1.5 text-[#4cd7f6]">
              <span className="w-3 h-0.5 border-b border-dotted border-[#4cd7f6] inline-block" /> OP (Output %)
            </span>
          </div>

          <div className="flex rounded bg-[#0b1326] p-0.5 border border-[#3d494c]/40 text-[10.5px]">
            {[30, 60, 120, 300].map((w) => (
              <button
                key={w}
                onClick={() => setWindowSec(w)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  windowSec === w
                    ? 'bg-[#171f33] text-[#4cd7f6] font-bold'
                    : 'text-[#869397] hover:text-[#dae2fd]'
                }`}
              >
                {w}s
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Multi-Pen Canvas */}
      <div className="relative bg-[#0b1326] rounded border border-[#3d494c]/30 p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[280px]"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            if (relX >= padLeft && relX <= svgWidth - padRight) {
              const mouseT = minTime + ((relX - padLeft) / (svgWidth - padLeft - padRight)) * (maxTime - minTime);
              let closest = windowHistory[0];
              for (const pt of windowHistory) {
                if (Math.abs(pt.time - mouseT) < Math.abs(closest.time - mouseT)) {
                  closest = pt;
                }
              }
              setHoveredPoint(closest || null);
            }
          }}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Horizontal Grid Lines (PV scale) */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const y = padTop + frac * (svgHeight - padTop - padBottom);
            const pvVal = maxPv - frac * (maxPv - minPv);
            const opVal = 100 - frac * 100;
            return (
              <g key={`grid-y-${idx}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#1c253b"
                  strokeDasharray="3,3"
                />
                {/* Left Axis: PV */}
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  fill="#ffb95f"
                  fontSize="9.5"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {pvVal.toFixed(1)}
                </text>
                {/* Right Axis: OP % */}
                <text
                  x={svgWidth - padRight + 8}
                  y={y + 3.5}
                  fill="#4cd7f6"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="start"
                >
                  {opVal.toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* Vertical Time Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const x = padLeft + frac * (svgWidth - padLeft - padRight);
            const t = minTime + frac * (maxTime - minTime);
            return (
              <g key={`grid-x-${idx}`}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={svgHeight - padBottom}
                  stroke="#1c253b"
                  strokeDasharray="3,3"
                />
                <text
                  x={x}
                  y={svgHeight - padBottom + 16}
                  fill="#869397"
                  fontSize="9.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  T+{t.toFixed(0)}s
                </text>
              </g>
            );
          })}

          {/* SP Path (Dashed) */}
          {spPath && (
            <path
              d={spPath}
              fill="none"
              stroke="#dae2fd"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              opacity="0.8"
            />
          )}

          {/* OP Path (Dotted) */}
          {opPath && (
            <path
              d={opPath}
              fill="none"
              stroke="#4cd7f6"
              strokeWidth="1.8"
              strokeDasharray="2,2"
              opacity="0.85"
            />
          )}

          {/* PV Path (Solid) */}
          {pvPath && (
            <path
              d={pvPath}
              fill="none"
              stroke="#ffb95f"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Crosshair Cursor on Hover */}
          {hoveredPoint && (
            <g>
              <line
                x1={scaleX(hoveredPoint.time)}
                y1={padTop}
                x2={scaleX(hoveredPoint.time)}
                y2={svgHeight - padBottom}
                stroke="#dae2fd"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <circle
                cx={scaleX(hoveredPoint.time)}
                cy={scaleY_PV(hoveredPoint.pv)}
                r="4"
                fill="#ffb95f"
                stroke="#0b1326"
                strokeWidth="1.5"
              />
              <circle
                cx={scaleX(hoveredPoint.time)}
                cy={scaleY_OP(hoveredPoint.op)}
                r="3.5"
                fill="#4cd7f6"
                stroke="#0b1326"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Hovered Point Info Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-3 left-16 bg-[#171f33]/95 border border-[#3d494c]/60 rounded p-2 text-xs font-mono shadow-md backdrop-blur-sm pointer-events-none flex items-center gap-3">
            <span className="text-[#869397]">Time: <strong className="text-[#dae2fd]">{hoveredPoint.time.toFixed(1)}s</strong></span>
            <span className="text-[#ffb95f]">PV: <strong>{hoveredPoint.pv.toFixed(1)} {pvVariable.unit}</strong></span>
            <span className="text-[#dae2fd]">SP: <strong>{hoveredPoint.sp.toFixed(1)} {pvVariable.unit}</strong></span>
            <span className="text-[#4cd7f6]">OP: <strong>{hoveredPoint.op.toFixed(1)}%</strong></span>
          </div>
        )}
      </div>

      {/* Real-time Dynamic Response Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
          <div className="text-[10px] text-[#869397] uppercase">Current Tracking Error</div>
          <div className="mt-0.5 text-base font-bold text-[#dae2fd] flex items-baseline gap-1">
            <span>{currentError.toFixed(2)}</span>
            <span className="text-xs text-[#869397]">{pvVariable.unit}</span>
          </div>
          <div className="text-[9.5px] text-[#4edea3]">
            {currentError < 0.2 ? 'Zero Steady-State Offset' : 'Loop Converging'}
          </div>
        </div>

        <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
          <div className="text-[10px] text-[#869397] uppercase">Loop Action & Mode</div>
          <div className="mt-0.5 text-sm font-bold text-[#4cd7f6]">
            {controller.mode} / {controller.action}
          </div>
          <div className="text-[9.5px] text-[#869397]">
            MV: {controller.mvTag}
          </div>
        </div>

        <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
          <div className="text-[10px] text-[#869397] uppercase">Integral Reset &amp; Deriv</div>
          <div className="mt-0.5 text-sm font-bold text-[#ffddb8]">
            Ti = {controller.tiSec}s | Td = {controller.tdSec}s
          </div>
          <div className="text-[9.5px] text-[#869397]">
            Kp = {controller.kp}
          </div>
        </div>

        <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
          <div className="text-[10px] text-[#869397] uppercase">Output Saturation</div>
          <div className="mt-0.5 text-base font-bold text-[#4edea3]">
            {controller.outputPercent.toFixed(1)}%
          </div>
          <div className="text-[9.5px] text-[#869397]">
            {controller.outputPercent <= 0.1 || controller.outputPercent >= 99.9 ? 'SATURATED' : 'Within Linear Range'}
          </div>
        </div>
      </div>
    </div>
  );
};
