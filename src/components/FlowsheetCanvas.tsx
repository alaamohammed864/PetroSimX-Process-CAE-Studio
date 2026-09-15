import React, { useState, useRef } from 'react';
import { EquipmentUnit, ProcessStream, UnitSystem, UnitType } from '../types/simulation';
import { formatFlow, formatPres, formatTemp } from '../engine/thermoEngine';
import { FlowsheetContextMenu } from './FlowsheetContextMenu';
import { useI18n } from '../i18n/I18nContext';

interface FlowsheetCanvasProps {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  selectedUnitId: string;
  onSelectUnit: (id: string) => void;
  selectedStreamId: string | null;
  onSelectStream: (id: string) => void;
  unitSystem: UnitSystem;
  snapEnabled: boolean;
  onUpdateUnitPosition: (id: string, x: number, y: number) => void;
  onConnectUnits?: (sourceId: string, targetId: string) => void;
  onAutoLayout?: () => void;
  onOpen3DView?: () => void;
  onDeleteUnit?: (id: string) => void;
  onAddUnit?: (type: UnitType) => void;
  onAddStream?: () => void;
  onSolveFlowsheet?: () => void;
  onViewProfiles?: (id: string) => void;
  onViewHydraulics?: (id: string) => void;
}

export const FlowsheetCanvas: React.FC<FlowsheetCanvasProps> = ({
  units,
  streams,
  selectedUnitId,
  onSelectUnit,
  selectedStreamId,
  onSelectStream,
  unitSystem,
  snapEnabled,
  onUpdateUnitPosition,
  onConnectUnits,
  onAutoLayout,
  onOpen3DView,
  onDeleteUnit,
  onAddUnit,
  onAddStream,
  onSolveFlowsheet,
  onViewProfiles,
  onViewHydraulics,
}) => {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(1.0);
  const [showFlags, setShowFlags] = useState(true);
  const [showHeatGradient, setShowHeatGradient] = useState(false);
  const [isFlowAnimated, setIsFlowAnimated] = useState(true);
  const [orthoRouting, setOrthoRouting] = useState(true);
  const [mouseCoords, setMouseCoords] = useState({ x: 1420, y: 850 });
  const [isDraggingUnit, setIsDraggingUnit] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetUnit: EquipmentUnit | null } | null>(null);
  const [linkingSourceUnitId, setLinkingSourceUnitId] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [quickConnectSource, setQuickConnectSource] = useState('');
  const [quickConnectTarget, setQuickConnectTarget] = useState('');

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const selectedUnit = units.find((u) => u.id === selectedUnitId) || units[3];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / zoom);
      const y = Math.round((e.clientY - rect.top) / zoom);
      setMouseCoords({ x: x + 800, y: y + 400 });

      if (isDraggingUnit) {
        const snap = snapEnabled ? 10 : 1;
        const newX = Math.round((x - dragOffset.x) / snap) * snap;
        const newY = Math.round((y - dragOffset.y) / snap) * snap;
        onUpdateUnitPosition(isDraggingUnit, Math.max(20, newX), Math.max(20, newY));
      }
    }
  };

  const handleMouseDownUnit = (e: React.MouseEvent, unit: EquipmentUnit) => {
    if (e.button === 2) return; // Ignore right-click for dragging
    e.stopPropagation();

    // If currently in linking mode
    if (linkingSourceUnitId && onConnectUnits) {
      if (linkingSourceUnitId !== unit.id) {
        onConnectUnits(linkingSourceUnitId, unit.id);
      }
      setLinkingSourceUnitId(null);
      return;
    }

    onSelectUnit(unit.id);
    setIsDraggingUnit(unit.id);
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / zoom;
      const clickY = (e.clientY - rect.top) / zoom;
      setDragOffset({ x: clickX - unit.x, y: clickY - unit.y });
    }
  };

  const handlePortClick = (e: React.MouseEvent, unit: EquipmentUnit, portType: 'in' | 'out') => {
    e.stopPropagation();
    if (!onConnectUnits) return;

    if (!linkingSourceUnitId) {
      // Start linking from this unit
      setLinkingSourceUnitId(unit.id);
    } else {
      // Complete linking to this unit
      if (linkingSourceUnitId !== unit.id) {
        onConnectUnits(linkingSourceUnitId, unit.id);
      }
      setLinkingSourceUnitId(null);
    }
  };

  const handleContextMenuCanvas = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, targetUnit: null });
  };

  const handleContextMenuUnit = (e: React.MouseEvent, unit: EquipmentUnit) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectUnit(unit.id);
    setContextMenu({ x: e.clientX, y: e.clientY, targetUnit: unit });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((prev) => Math.min(2.5, Math.max(0.4, Number((prev + delta).toFixed(2)))));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingUnit(null);
  };

  // Helper stream finders
  const s101 = streams.find((s) => s.id === 'S-101');
  const s103 = streams.find((s) => s.id === 'S-103');
  const s104 = streams.find((s) => s.id === 'S-104');
  const s105 = streams.find((s) => s.id === 'S-105');
  const s106 = streams.find((s) => s.id === 'S-106');
  const s107 = streams.find((s) => s.id === 'S-107');

  // Dynamic positions of units
  const p101 = units.find((u) => u.id === 'P-101') || { x: 100, y: 200 };
  const e101 = units.find((u) => u.id === 'E-101') || { x: 220, y: 180 };
  const h101 = units.find((u) => u.id === 'H-101') || { x: 370, y: 175 };
  const r101 = units.find((u) => u.id === 'R-101') || { x: 530, y: 90 };
  const v101 = units.find((u) => u.id === 'V-101') || { x: 690, y: 170 };

  return (
    <section className="relative flex-1 flex flex-col bg-[#060e20] overflow-hidden select-none min-w-0">
      {/* Top Workspace Micro Status & Coordinate HUD Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#060e20] text-[#869397] font-mono text-[10px] border-b border-[#3d494c]/30">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[#4edea3]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
            TOPOLOGY: CLOSED-LOOP CONVERGED
          </span>
          <span>•</span>
          <span className="text-[#bcc9cd]">
            ACTIVE CELL: <strong className="text-[#4cd7f6] font-mono text-[11px]">{selectedUnit.id} [{selectedUnit.tag === 'R-101' ? 'Hydrotreater' : selectedUnit.name}]</strong>
          </span>
          <span>•</span>
          <span>TEAR CONVERGENCE: <span className="text-[#4edea3]">0.0003% RMS</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#ffddb8]">EOS: Peng-Robinson / Boston-Mathias</span>
          <span className="text-[#bcc9cd]">CANVAS: 2400 × 1600 mm</span>
          <div className="flex items-center gap-1 bg-[#222a3d] px-2 py-0.5 rounded text-[#4cd7f6]">
            <span className="material-symbols-outlined text-[12px]">grid_goldenratio</span>
            <span>{snapEnabled ? 'SNAP 16px' : 'FREE'}</span>
          </div>
        </div>
      </div>

      {/* Viewport Workspace */}
      <div
        ref={canvasContainerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenuCanvas}
        onWheel={handleWheel}
        className="relative w-full flex-1 overflow-auto bg-[#060e20]"
        style={{ minHeight: '520px' }}
      >
        {/* HUD Floating Toolstrip Overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 p-1 bg-[#171f33]/95 rounded border border-[#3d494c]/50 shadow-xl backdrop-blur">
          <button
            onClick={() => {}}
            className="px-2 py-1 bg-[#222a3d] text-[#4cd7f6] rounded flex items-center gap-1 font-mono text-[10px]"
            title="Select Pointer Tool"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">near_me</span>
            <span>POINTER</span>
          </button>
          <button
            onClick={() => setOrthoRouting(!orthoRouting)}
            className={`px-2 py-1 rounded flex items-center gap-1 font-mono text-[10px] transition-colors ${
              orthoRouting ? 'bg-[#222a3d] text-[#dae2fd]' : 'hover:bg-[#222a3d] text-[#bcc9cd]'
            }`}
            title="Connector Routing Mode"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">polyline</span>
            <span>ORTHO-ROUTE</span>
          </button>
          <button
            onClick={() => setShowFlags(!showFlags)}
            className={`px-2 py-1 rounded flex items-center gap-1 font-mono text-[10px] transition-colors ${
              showFlags ? 'bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/30' : 'text-[#bcc9cd] hover:bg-[#222a3d]'
            }`}
            title="Toggle Stream Callout Badges"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">label</span>
            <span>FLAGS: {showFlags ? 'ON' : 'OFF'}</span>
          </button>
          <button
            onClick={() => setShowHeatGradient(!showHeatGradient)}
            className={`px-2 py-1 rounded flex items-center gap-1 font-mono text-[10px] transition-colors ${
              showHeatGradient ? 'bg-[#ffb95f]/20 text-[#ffb95f] border border-[#ffb95f]/30' : 'text-[#bcc9cd] hover:bg-[#222a3d]'
            }`}
            title="Toggle Temperature Heatmap Gradient"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">thermostat</span>
            <span>GRADIENT</span>
          </button>

          <button
            onClick={() => setIsFlowAnimated(!isFlowAnimated)}
            className={`px-2 py-1 rounded flex items-center gap-1 font-mono text-[10px] transition-colors ${
              isFlowAnimated ? 'bg-[#1bbd85]/20 text-[#4edea3] border border-[#1bbd85]/40' : 'text-[#869397] hover:bg-[#222a3d]'
            }`}
            title="Toggle 2D Material Flow Particle Animation"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">
              {isFlowAnimated ? 'motion_photos_on' : 'motion_photos_paused'}
            </span>
            <span>FLOW: {isFlowAnimated ? 'ANIM' : 'PAUSED'}</span>
          </button>

          {/* Quick Connect Units Button */}
          {onConnectUnits && (
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="px-2 py-1 rounded flex items-center gap-1 font-mono text-[10px] bg-[#ffb95f]/20 text-[#ffb95f] hover:bg-[#ffb95f]/30 border border-[#ffb95f]/40 transition-colors"
              title="Connect two equipment units via process stream"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">cable</span>
              <span>CONNECT UNITS</span>
            </button>
          )}

          {/* Auto Layout CAD Button */}
          {onAutoLayout && (
            <button
              onClick={onAutoLayout}
              className="px-2 py-1 rounded flex items-center gap-1 font-mono text-[10px] bg-[#38bdf8]/20 text-[#38bdf8] hover:bg-[#38bdf8]/30 border border-[#38bdf8]/40 transition-colors"
              title="Auto-arrange all 2D equipment units to prevent overlapping"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
              <span>AUTO-ALIGN</span>
            </button>
          )}

          {onOpen3DView && (
            <button
              onClick={onOpen3DView}
              className="px-2 py-1 rounded flex items-center gap-1 font-mono text-[10px] bg-[#4cd7f6]/20 text-[#4cd7f6] hover:bg-[#4cd7f6]/30 border border-[#4cd7f6]/40 transition-colors"
              title="Launch 3D Process Plant CAE Visualization"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">view_in_ar</span>
              <span>3D PLANT</span>
            </button>
          )}

          <div className="w-px h-4 bg-[#3d494c]/40 mx-1"></div>

          <button
            onClick={() => setZoom((prev) => Math.min(2.0, prev + 0.1))}
            className="p-1 hover:bg-[#222a3d] text-[#bcc9cd] rounded"
            title="Zoom In"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">zoom_in</span>
          </button>
          <span className="font-mono text-[10px] px-1 text-[#dae2fd]">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.1))}
            className="p-1 hover:bg-[#222a3d] text-[#bcc9cd] rounded"
            title="Zoom Out"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">zoom_out</span>
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="p-1 hover:bg-[#222a3d] text-[#bcc9cd] rounded"
            title="Fit to 100%"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">fit_screen</span>
          </button>
        </div>

        {/* Quick Canvas Metrics HUD (Top Right) */}
        <div className="absolute top-2.5 right-2.5 z-20 bg-[#171f33]/90 px-3 py-1.5 rounded border border-[#3d494c]/40 shadow-lg flex items-center gap-3 font-mono text-[10px]">
          <div>
            <span className="text-[#869397]">FEED:</span>{' '}
            <span className="text-[#4cd7f6] font-bold">45,000 kg/h</span>
          </div>
          <div>
            <span className="text-[#869397]">REACTION TEMP:</span>{' '}
            <span className="text-[#ffb95f] font-bold">510.0 °C</span>
          </div>
          <div>
            <span className="text-[#869397]">NET DUTY:</span>{' '}
            <span className="text-[#4edea3] font-bold">+14.82 MW</span>
          </div>
        </div>

        {/* Interactive Stream Linking Mode Active Banner */}
        {linkingSourceUnitId && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-[#ffb95f] text-[#2c1600] px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-3 font-mono text-[11px] font-bold animate-pulse">
            <span className="material-symbols-outlined text-[16px]">cable</span>
            <span>LINKING: Click any target equipment to connect from {linkingSourceUnitId}</span>
            <button
              onClick={() => setLinkingSourceUnitId(null)}
              className="bg-[#2c1600] text-[#ffddb8] hover:text-white px-2 py-0.5 rounded text-[10px] font-mono"
              type="button"
            >
              CANCEL
            </button>
          </div>
        )}

        {/* Quick Connect Units Dialog Modal */}
        {isConnectModalOpen && onConnectUnits && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-96 bg-[#0f172a] border border-[#3d494c] rounded-xl shadow-2xl p-4 text-[#dae2fd] font-mono text-[11px] space-y-4">
              <div className="flex items-center justify-between border-b border-[#3d494c]/50 pb-2">
                <div className="flex items-center gap-2 text-[#ffb95f] font-bold text-[13px]">
                  <span className="material-symbols-outlined text-[18px]">cable</span>
                  <span>CONNECT EQUIPMENT UNITS</span>
                </div>
                <button
                  onClick={() => setIsConnectModalOpen(false)}
                  className="text-[#869397] hover:text-[#ffb4ab]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#869397] block mb-1">SOURCE EQUIPMENT (OUTLET):</label>
                  <select
                    value={quickConnectSource}
                    onChange={(e) => setQuickConnectSource(e.target.value)}
                    className="w-full bg-[#171f33] border border-[#3d494c] rounded px-2.5 py-1.5 text-[#dae2fd] focus:outline-none"
                  >
                    <option value="">-- Choose Source Unit --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.id} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#869397] block mb-1">TARGET EQUIPMENT (INLET):</label>
                  <select
                    value={quickConnectTarget}
                    onChange={(e) => setQuickConnectTarget(e.target.value)}
                    className="w-full bg-[#171f33] border border-[#3d494c] rounded px-2.5 py-1.5 text-[#dae2fd] focus:outline-none"
                  >
                    <option value="">-- Choose Target Unit --</option>
                    {units
                      .filter((u) => u.id !== quickConnectSource)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.id} - {u.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3d494c]/40">
                <button
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#869397] transition-colors"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (quickConnectSource && quickConnectTarget) {
                      onConnectUnits(quickConnectSource, quickConnectTarget);
                      setIsConnectModalOpen(false);
                      setQuickConnectSource('');
                      setQuickConnectTarget('');
                    }
                  }}
                  disabled={!quickConnectSource || !quickConnectTarget}
                  className="px-4 py-1.5 rounded bg-[#ffb95f] hover:bg-[#ffc98a] disabled:opacity-40 text-[#2c1600] font-bold transition-colors"
                  type="button"
                >
                  Connect Pipeline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scaled Flowsheet Area */}
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: '1000px',
            height: '520px',
          }}
          className="relative"
        >
          {/* SVG Vector Drawing */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="cad-grid-pattern" patternUnits="userSpaceOnUse" width="32" height="32">
                <circle cx="2" cy="2" r="0.8" fill="#4cd7f6" opacity="0.15"></circle>
                <circle cx="18" cy="18" r="0.6" fill="#869397" opacity="0.12"></circle>
              </pattern>
              <marker id="stream-arrow-cyan" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="6" refY="5" viewBox="0 0 10 10">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#4cd7f6"></path>
              </marker>
              <marker id="stream-arrow-orange" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="6" refY="5" viewBox="0 0 10 10">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#ffb95f"></path>
              </marker>
              <marker id="stream-arrow-green" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="6" refY="5" viewBox="0 0 10 10">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#4edea3"></path>
              </marker>
              <lineargradient id="catalyst-bed-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#171f33"></stop>
                <stop offset="50%" stopColor="#222a3d"></stop>
                <stop offset="100%" stopColor="#171f33"></stop>
              </lineargradient>
              <pattern id="catalyst-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45 0 0)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#4edea3" strokeWidth="1.2" opacity="0.3"></line>
              </pattern>

              {/* Thermal Gradient filter when enabled */}
              <linearGradient id="heat-thermal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4cd7f6" stopOpacity="0.4" />
                <stop offset="45%" stopColor="#ffb95f" stopOpacity="0.6" />
                <stop offset="70%" stopColor="#ee9800" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ff5722" stopOpacity="0.9" />
              </linearGradient>

              {/* 2D Process Stream Fluid Motion CSS Keyframes */}
              <style>{`
                @keyframes processFlowAnim {
                  from {
                    stroke-dashoffset: 28;
                  }
                  to {
                    stroke-dashoffset: 0;
                  }
                }
                .flow-dash-cyan {
                  stroke-dasharray: 6 10;
                  animation: processFlowAnim 1.0s linear infinite;
                }
                .flow-dash-orange {
                  stroke-dasharray: 6 10;
                  animation: processFlowAnim 1.2s linear infinite;
                }
                .flow-dash-green {
                  stroke-dasharray: 6 10;
                  animation: processFlowAnim 0.9s linear infinite;
                }
              `}</style>
            </defs>

            {/* Background CAD Grid */}
            <rect width="100%" height="100%" fill="url(#cad-grid-pattern)"></rect>

            {/* Optional Thermal Gradient Overlay */}
            {showHeatGradient && (
              <rect x="0" y="0" width="1000" height="520" fill="url(#heat-thermal-grad)" opacity="0.15" pointerEvents="none" />
            )}

            {/* ================= PROCESS STREAM PIPING (ORTHOGONAL) ================= */}
            {/* Stream S-101: Feed to Pump P-101 */}
            <path
              onClick={() => onSelectStream('S-101')}
              d={`M 20 ${p101.y + 20} L ${p101.x} ${p101.y + 20}`}
              fill="none"
              stroke={selectedStreamId === 'S-101' ? '#acedff' : '#4cd7f6'}
              strokeWidth={selectedStreamId === 'S-101' ? 3.5 : 2.5}
              markerEnd="url(#stream-arrow-cyan)"
              className="cursor-pointer hover:stroke-[#acedff]"
            ></path>
            {isFlowAnimated && (
              <path
                d={`M 20 ${p101.y + 20} L ${p101.x} ${p101.y + 20}`}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="flow-dash-cyan pointer-events-none opacity-90"
              />
            )}

            {/* Stream S-102: Pump P-101 to Exchanger E-101 Cold Side In */}
            <path
              onClick={() => onSelectStream('S-102')}
              d={`M ${p101.x + 40} ${p101.y + 20} L ${e101.x} ${e101.y + 40}`}
              fill="none"
              stroke={selectedStreamId === 'S-102' ? '#acedff' : '#4cd7f6'}
              strokeWidth={selectedStreamId === 'S-102' ? 3.5 : 2.5}
              markerEnd="url(#stream-arrow-cyan)"
              className="cursor-pointer hover:stroke-[#acedff]"
            ></path>
            {isFlowAnimated && (
              <path
                d={`M ${p101.x + 40} ${p101.y + 20} L ${e101.x} ${e101.y + 40}`}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="flow-dash-cyan pointer-events-none opacity-90"
              />
            )}

            {/* Stream S-103: Exchanger E-101 to Furnace H-101 */}
            <path
              onClick={() => onSelectStream('S-103')}
              d={`M ${e101.x + 70} ${e101.y + 40} L ${h101.x} ${h101.y + 45}`}
              fill="none"
              stroke={selectedStreamId === 'S-103' ? '#ffddb8' : '#ffb95f'}
              strokeWidth={selectedStreamId === 'S-103' ? 3.5 : 2.5}
              markerEnd="url(#stream-arrow-orange)"
              className="cursor-pointer hover:stroke-[#ffddb8]"
            ></path>
            {isFlowAnimated && (
              <path
                d={`M ${e101.x + 70} ${e101.y + 40} L ${h101.x} ${h101.y + 45}`}
                fill="none"
                stroke="#fff2dd"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="flow-dash-orange pointer-events-none opacity-90"
              />
            )}

            {/* Stream S-104: Furnace H-101 to Reactor R-101 Top */}
            <path
              onClick={() => onSelectStream('S-104')}
              d={`M ${h101.x + 70} ${h101.y + 45} L ${r101.x - 40} ${h101.y + 45} L ${r101.x - 40} ${r101.y + 30} L ${r101.x} ${r101.y + 30}`}
              fill="none"
              stroke={selectedStreamId === 'S-104' ? '#ffddb8' : '#ffb95f'}
              strokeWidth={selectedStreamId === 'S-104' ? 3.5 : 2.5}
              markerEnd="url(#stream-arrow-orange)"
              className="cursor-pointer hover:stroke-[#ffddb8]"
            ></path>
            {isFlowAnimated && (
              <path
                d={`M ${h101.x + 70} ${h101.y + 45} L ${r101.x - 40} ${h101.y + 45} L ${r101.x - 40} ${r101.y + 30} L ${r101.x} ${r101.y + 30}`}
                fill="none"
                stroke="#fff2dd"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="flow-dash-orange pointer-events-none opacity-90"
              />
            )}

            {/* Stream S-105: Reactor Effluent R-101 Bottom returning to E-101 Tube Hot Side In */}
            <path
              onClick={() => onSelectStream('S-105')}
              d={`M ${r101.x + 40} ${r101.y + 240} L ${r101.x + 40} 380 L ${e101.x + 35} 380 L ${e101.x + 35} ${e101.y + 70}`}
              fill="none"
              stroke={selectedStreamId === 'S-105' ? '#6ffbbe' : '#4edea3'}
              strokeWidth={selectedStreamId === 'S-105' ? 3.5 : 2.5}
              markerEnd="url(#stream-arrow-green)"
              className="cursor-pointer hover:stroke-[#6ffbbe]"
            ></path>
            {isFlowAnimated && (
              <path
                d={`M ${r101.x + 40} ${r101.y + 240} L ${r101.x + 40} 380 L ${e101.x + 35} 380 L ${e101.x + 35} ${e101.y + 70}`}
                fill="none"
                stroke="#e8fff4"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="flow-dash-green pointer-events-none opacity-90"
              />
            )}

            {/* Stream S-105b: Cooled Exchanger Effluent to Flash Drum V-101 */}
            <path
              d={`M ${e101.x + 35} ${e101.y} L ${e101.x + 35} 120 L ${v101.x + 10} 120 L ${v101.x + 10} ${v101.y + 30}`}
              fill="none"
              stroke="#4cd7f6"
              strokeWidth="2.5"
              markerEnd="url(#stream-arrow-cyan)"
            ></path>
            {isFlowAnimated && (
              <path
                d={`M ${e101.x + 35} ${e101.y} L ${e101.x + 35} 120 L ${v101.x + 10} 120 L ${v101.x + 10} ${v101.y + 30}`}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="flow-dash-cyan pointer-events-none opacity-90"
              />
            )}

            {/* Stream S-106: Overhead Vapor (Recycle gas) from V-101 */}
            <path
              onClick={() => onSelectStream('S-106')}
              d={`M ${v101.x + 30} ${v101.y} L ${v101.x + 30} 70 L 80 70 L 80 ${p101.y} L ${p101.x} ${p101.y}`}
              fill="none"
              stroke="#acedff"
              strokeDasharray="4,3"
              strokeWidth="2"
              markerEnd="url(#stream-arrow-cyan)"
              className="cursor-pointer hover:stroke-white"
            ></path>
            {isFlowAnimated && (
              <path
                d={`M ${v101.x + 30} ${v101.y} L ${v101.x + 30} 70 L 80 70 L 80 ${p101.y} L ${p101.x} ${p101.y}`}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="flow-dash-cyan pointer-events-none opacity-90"
              />
            )}

            {/* Stream S-107: Bottoms Product from V-101 */}
            <path
              onClick={() => onSelectStream('S-107')}
              d={`M ${v101.x + 30} ${v101.y + 120} L ${v101.x + 30} 370 L 850 370`}
              fill="none"
              stroke={selectedStreamId === 'S-107' ? '#ffddb8' : '#ffb95f'}
              strokeWidth="2.5"
              markerEnd="url(#stream-arrow-orange)"
              className="cursor-pointer hover:stroke-[#ffddb8]"
            ></path>
            {isFlowAnimated && (
              <path
                d={`M ${v101.x + 30} ${v101.y + 120} L ${v101.x + 30} 370 L 850 370`}
                fill="none"
                stroke="#fff2dd"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="flow-dash-orange pointer-events-none opacity-90"
              />
            )}

            {/* ================= DYNAMIC PROCESS STREAMS (User Request) ================= */}
            {streams
              .filter((s) => !['S-101', 'S-102', 'S-103', 'S-104', 'S-105', 'S-106', 'S-107'].includes(s.id))
              .map((s) => {
                const src = units.find((u) => u.outletStreamIds?.includes(s.id));
                const tgt = units.find((u) => u.inletStreamIds?.includes(s.id));
                if (!src || !tgt) return null;

                const srcWidth = src.width || (src.id === 'R-101' ? 70 : src.id === 'E-101' ? 70 : src.id === 'H-101' ? 70 : src.id === 'V-101' ? 60 : 40);
                const srcHeight = src.height || (src.id === 'R-101' ? 240 : 60);
                const tgtHeight = tgt.height || (tgt.id === 'R-101' ? 240 : 60);

                const startX = src.x + srcWidth;
                const startY = src.y + Math.round(srcHeight / 2);
                const endX = tgt.x;
                const endY = tgt.y + Math.round(tgtHeight / 2);

                const midX = Math.round((startX + endX) / 2);
                const isSelected = selectedStreamId === s.id;
                const pathD = orthoRouting
                  ? `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`
                  : `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

                return (
                  <g key={s.id}>
                    <path
                      onClick={() => onSelectStream(s.id)}
                      d={pathD}
                      fill="none"
                      stroke={isSelected ? '#acedff' : (s.color || '#4cd7f6')}
                      strokeWidth={isSelected ? 3.5 : 2.5}
                      markerEnd="url(#stream-arrow-cyan)"
                      className="cursor-pointer hover:stroke-[#acedff]"
                    />
                    {isFlowAnimated && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="flow-dash-cyan pointer-events-none opacity-90"
                      />
                    )}
                    {/* Stream Tag Badge in middle of pipe */}
                    <g
                      onClick={() => onSelectStream(s.id)}
                      className="cursor-pointer"
                      transform={`translate(${midX}, ${Math.round((startY + endY) / 2)})`}
                    >
                      <rect x="-18" y="-9" width="36" height="18" rx="4" fill="#0f172a" stroke={s.color || '#4cd7f6'} strokeWidth="1" />
                      <text x="0" y="3.5" fill="#dae2fd" fontFamily="JetBrains Mono" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                        {s.id}
                      </text>
                    </g>
                  </g>
                );
              })}

            {/* ================= UNIT OPERATION BLOCKS (CAD SCHEMATICS) ================= */}

            {/* 1. FEED PUMP P-101 */}
            <g
              onMouseDown={(e) => handleMouseDownUnit(e, units.find((u) => u.id === 'P-101')!)}
              onContextMenu={(e) => handleContextMenuUnit(e, units.find((u) => u.id === 'P-101')!)}
              className="cursor-pointer hover:opacity-95"
              transform={`translate(${p101.x}, ${p101.y})`}
            >
              {selectedUnitId === 'P-101' && (
                <rect x="-8" y="-8" width="56" height="56" rx="6" fill="#4cd7f6" fillOpacity="0.1" stroke="#4cd7f6" strokeWidth="1.5" strokeDasharray="3,3" />
              )}
              <circle cx="20" cy="20" r="18" fill="#171f33" stroke="#4cd7f6" strokeWidth="2"></circle>
              <polygon points="12,8 32,20 12,32" fill="#06b6d4" opacity="0.7"></polygon>
              <circle cx="20" cy="20" r="4" fill="#dae2fd"></circle>
              <text x="20" y="48" fill="#dae2fd" fontFamily="JetBrains Mono" fontSize="10" fontWeight="600" textAnchor="middle">P-101</text>
              <text x="20" y="58" fill="#869397" fontFamily="Inter" fontSize="8.5" textAnchor="middle">Feed Booster</text>
            </g>

            {/* 2. HEAT EXCHANGER E-101 (Shell & Tube) */}
            <g
              onMouseDown={(e) => handleMouseDownUnit(e, units.find((u) => u.id === 'E-101')!)}
              onContextMenu={(e) => handleContextMenuUnit(e, units.find((u) => u.id === 'E-101')!)}
              className="cursor-pointer hover:opacity-95"
              transform={`translate(${e101.x}, ${e101.y})`}
            >
              {selectedUnitId === 'E-101' && (
                <rect x="-8" y="-2" width="86" height="84" rx="6" fill="#4cd7f6" fillOpacity="0.1" stroke="#4cd7f6" strokeWidth="1.5" strokeDasharray="3,3" />
              )}
              {/* Shell Body */}
              <rect x="0" y="10" width="70" height="60" rx="6" fill="#171f33" stroke="#4cd7f6" strokeWidth="2"></rect>
              {/* Tube Bundle representation */}
              <line x1="8" y1="25" x2="62" y2="25" stroke="#ffb95f" strokeWidth="1.8"></line>
              <line x1="8" y1="40" x2="62" y2="40" stroke="#ffb95f" strokeWidth="1.8"></line>
              <line x1="8" y1="55" x2="62" y2="55" stroke="#ffb95f" strokeWidth="1.8"></line>
              <circle cx="35" cy="40" r="14" fill="#0b1326" stroke="#4edea3" strokeWidth="1.5" strokeDasharray="2,2"></circle>
              <text x="35" y="82" fill="#dae2fd" fontFamily="JetBrains Mono" fontSize="10" fontWeight="600" textAnchor="middle">E-101</text>
              <text x="35" y="92" fill="#869397" fontFamily="Inter" fontSize="8.5" textAnchor="middle">Feed-Effluent</text>
            </g>

            {/* 3. FIRED FURNACE H-101 */}
            <g
              onMouseDown={(e) => handleMouseDownUnit(e, units.find((u) => u.id === 'H-101')!)}
              onContextMenu={(e) => handleContextMenuUnit(e, units.find((u) => u.id === 'H-101')!)}
              className="cursor-pointer hover:opacity-95"
              transform={`translate(${h101.x}, ${h101.y})`}
            >
              {selectedUnitId === 'H-101' && (
                <rect x="-5" y="-5" width="80" height="95" rx="6" fill="#4cd7f6" fillOpacity="0.1" stroke="#4cd7f6" strokeWidth="1.5" strokeDasharray="3,3" />
              )}
              {/* Furnace Arch / Pentagonal Structure */}
              <path d="M 10 70 L 10 30 L 35 5 L 60 30 L 60 70 Z" fill="#171f33" stroke="#ffb95f" strokeWidth="2"></path>
              {/* Radiant Coil Symbol */}
              <path d="M 22 60 L 48 60 L 22 45 L 48 45 L 35 25" fill="none" stroke="#ee9800" strokeWidth="2"></path>
              <text x="35" y="85" fill="#dae2fd" fontFamily="JetBrains Mono" fontSize="10" fontWeight="600" textAnchor="middle">H-101</text>
              <text x="35" y="95" fill="#869397" fontFamily="Inter" fontSize="8.5" textAnchor="middle">14.8 MW</text>
            </g>

            {/* 4. CATALYTIC REACTOR R-101 (Hydrotreater) */}
            <g
              onMouseDown={(e) => handleMouseDownUnit(e, units.find((u) => u.id === 'R-101')!)}
              onContextMenu={(e) => handleContextMenuUnit(e, units.find((u) => u.id === 'R-101')!)}
              className="cursor-pointer"
              transform={`translate(${r101.x}, ${r101.y})`}
            >
              {/* Active Selection Halo Keyline */}
              {selectedUnitId === 'R-101' && (
                <rect x="-10" y="-10" width="100" height="265" rx="8" fill="#4cd7f6" fillOpacity="0.05" stroke="#4cd7f6" strokeWidth="1.5" strokeDasharray="4,4"></rect>
              )}

              {/* Cylindrical Reactor Shell */}
              <path d="M 10 30 C 10 10, 70 10, 70 30 L 70 210 C 70 230, 10 230, 10 210 Z" fill="#171f33" stroke="#4edea3" strokeWidth="2.5"></path>

              {/* Packed Catalyst Beds (Dual-Bed Hydrocracker) */}
              {/* Bed 1 */}
              <rect x="16" y="45" width="48" height="65" fill="url(#catalyst-bed-grad)"></rect>
              <rect x="16" y="45" width="48" height="65" fill="url(#catalyst-hatch)"></rect>

              {/* Bed 2 */}
              <rect x="16" y="130" width="48" height="65" fill="url(#catalyst-bed-grad)"></rect>
              <rect x="16" y="130" width="48" height="65" fill="url(#catalyst-hatch)"></rect>

              {/* Quench Gas Injector Ring */}
              <line x1="8" y1="120" x2="72" y2="120" stroke="#acedff" strokeWidth="2" strokeDasharray="3,2"></line>
              <circle cx="40" cy="120" r="3" fill="#4cd7f6"></circle>

              {/* Equipment Badge & Diagnostics Status Tag */}
              <rect x="5" y="240" width="70" height="18" rx="2" fill="#0b1326"></rect>
              <text x="40" y="253" fill="#4edea3" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" textAnchor="middle">R-101 [SOLVED]</text>
              <text x="40" y="267" fill="#dae2fd" fontFamily="Inter" fontSize="9" textAnchor="middle">Hydrotreater</text>
            </g>

            {/* 5. HIGH-PRESSURE FLASH DRUM V-101 */}
            <g
              onMouseDown={(e) => handleMouseDownUnit(e, units.find((u) => u.id === 'V-101')!)}
              onContextMenu={(e) => handleContextMenuUnit(e, units.find((u) => u.id === 'V-101')!)}
              className="cursor-pointer hover:opacity-95"
              transform={`translate(${v101.x}, ${v101.y})`}
            >
              {selectedUnitId === 'V-101' && (
                <rect x="-8" y="-5" width="76" height="150" rx="6" fill="#4cd7f6" fillOpacity="0.1" stroke="#4cd7f6" strokeWidth="1.5" strokeDasharray="3,3" />
              )}
              {/* Vessel with dished heads */}
              <path d="M 10 20 C 10 5, 50 5, 50 20 L 50 100 C 50 115, 10 115, 10 100 Z" fill="#171f33" stroke="#4cd7f6" strokeWidth="2"></path>
              {/* Liquid Level Representation */}
              <rect x="12" y="70" width="36" height="35" rx="2" fill="#06b6d4" fillOpacity="0.3"></rect>
              <line x1="12" y1="70" x2="48" y2="70" stroke="#4cd7f6" strokeWidth="1.5" strokeDasharray="3,2"></line>
              {/* Mist Eliminator Mesh Pad */}
              <rect x="15" y="25" width="30" height="6" fill="#869397" opacity="0.5"></rect>
              <text x="30" y="130" fill="#dae2fd" fontFamily="JetBrains Mono" fontSize="10" fontWeight="600" textAnchor="middle">V-101</text>
              <text x="30" y="140" fill="#869397" fontFamily="Inter" fontSize="8.5" textAnchor="middle">HP Flash Drum</text>
            </g>

            {/* 6. DYNAMICALLY PLACED EQUIPMENT UNITS */}
            {units
              .filter((u) => !['P-101', 'E-101', 'H-101', 'R-101', 'V-101'].includes(u.id))
              .map((u) => {
                const isSelected = selectedUnitId === u.id;
                return (
                  <g
                    key={u.id}
                    onMouseDown={(e) => handleMouseDownUnit(e, u)}
                    onContextMenu={(e) => handleContextMenuUnit(e, u)}
                    className="cursor-pointer hover:opacity-95"
                    transform={`translate(${u.x}, ${u.y})`}
                  >
                    {/* Selection halo */}
                    {isSelected && (
                      <rect
                        x="-6"
                        y="-6"
                        width={(u.width || 70) + 12}
                        height={(u.height || 70) + 26}
                        rx="6"
                        fill="#4cd7f6"
                        fillOpacity="0.12"
                        stroke="#4cd7f6"
                        strokeWidth="1.5"
                        strokeDasharray="3,3"
                      />
                    )}

                    {/* SVG Symbol per Unit Type */}
                    {u.type === 'column' || u.type === 'absorber' || u.type === 'stripper' ? (
                      <g>
                        {/* Fractionation Column Shell */}
                        <path
                          d="M 12 16 C 12 4, 48 4, 48 16 L 48 110 C 48 122, 12 122, 12 110 Z"
                          fill="#171f33"
                          stroke={u.type === 'column' ? '#ffddb8' : '#4cd7f6'}
                          strokeWidth="2"
                        />
                        {/* Internal Trays */}
                        <line x1="16" y1="30" x2="44" y2="30" stroke="#869397" strokeWidth="1.5" />
                        <line x1="16" y1="48" x2="44" y2="48" stroke="#869397" strokeWidth="1.5" />
                        <line x1="16" y1="66" x2="44" y2="66" stroke="#869397" strokeWidth="1.5" />
                        <line x1="16" y1="84" x2="44" y2="84" stroke="#869397" strokeWidth="1.5" />
                        <line x1="16" y1="100" x2="44" y2="100" stroke="#869397" strokeWidth="1.5" />
                        {/* Condenser circle */}
                        <circle cx="56" cy="12" r="7" fill="#0b1326" stroke="#4cd7f6" strokeWidth="1.2" />
                        {/* Reboiler circle */}
                        <circle cx="56" cy="115" r="7" fill="#0b1326" stroke="#ffb95f" strokeWidth="1.2" />
                      </g>
                    ) : u.type === 'three_phase_separator' || u.type === 'liquid_liquid_separator' ? (
                      <g>
                        {/* Horizontal vessel */}
                        <path
                          d="M 16 12 C 4 12, 4 48, 16 48 L 74 48 C 86 48, 86 12, 74 12 Z"
                          fill="#171f33"
                          stroke="#4edea3"
                          strokeWidth="2"
                        />
                        {/* Weir & boot */}
                        <line x1="50" y1="20" x2="50" y2="46" stroke="#4cd7f6" strokeWidth="1.5" />
                        <rect x="54" y="48" width="14" height="12" fill="#171f33" stroke="#4edea3" strokeWidth="1.5" />
                      </g>
                    ) : u.type === 'compressor' ? (
                      <g>
                        {/* Compressor trapezoid */}
                        <polygon points="10,10 50,22 50,48 10,60" fill="#171f33" stroke="#ffb95f" strokeWidth="2" />
                        <circle cx="30" cy="35" r="8" fill="#0b1326" stroke="#dae2fd" strokeWidth="1.5" />
                      </g>
                    ) : u.type === 'valve' ? (
                      <g>
                        {/* Control valve bowtie */}
                        <polygon points="10,20 40,40 40,20 10,40" fill="#171f33" stroke="#ffb4ab" strokeWidth="2" />
                        {/* Actuator stem & diaphragm */}
                        <line x1="25" y1="30" x2="25" y2="12" stroke="#ffb4ab" strokeWidth="1.8" />
                        <ellipse cx="25" cy="10" rx="10" ry="4" fill="#0b1326" stroke="#ffb4ab" strokeWidth="1.5" />
                      </g>
                    ) : (
                      <g>
                        <rect
                          x="0"
                          y="0"
                          width={u.width || 60}
                          height={u.height || 60}
                          rx="6"
                          fill="#171f33"
                          stroke="#4cd7f6"
                          strokeWidth="2"
                        />
                        <circle cx={(u.width || 60) / 2} cy={(u.height || 60) / 2} r="14" fill="#0b1326" stroke="#4edea3" strokeWidth="1.5" />
                      </g>
                    )}

                    {/* Tag and Subtitle */}
                    <text
                      x={(u.width || 60) / 2}
                      y={(u.type === 'column' || u.type === 'absorber' || u.type === 'stripper') ? 134 : (u.height || 60) + 14}
                      fill="#dae2fd"
                      fontFamily="JetBrains Mono"
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {u.id}
                    </text>
                    <text
                      x={(u.width || 60) / 2}
                      y={(u.type === 'column' || u.type === 'absorber' || u.type === 'stripper') ? 145 : (u.height || 60) + 24}
                      fill="#869397"
                      fontFamily="Inter"
                      fontSize="8.5"
                      textAnchor="middle"
                    >
                      {u.name.length > 14 ? u.name.slice(0, 14) + '…' : u.name}
                    </text>

                    {/* Inlet Port Connection Point (Left Side) */}
                    <g
                      onClick={(e) => handlePortClick(e, u, 'in')}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={0}
                        cy={((u.height || 60) / 2)}
                        r={linkingSourceUnitId ? 6 : 4}
                        fill={linkingSourceUnitId ? '#4cd7f6' : '#0b1326'}
                        stroke="#4cd7f6"
                        strokeWidth="1.8"
                      />
                      <title>Inlet Port (Click to connect pipeline)</title>
                    </g>

                    {/* Outlet Port Connection Point (Right Side) */}
                    <g
                      onClick={(e) => handlePortClick(e, u, 'out')}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={u.width || 60}
                        cy={((u.height || 60) / 2)}
                        r={linkingSourceUnitId === u.id ? 6 : 4}
                        fill={linkingSourceUnitId === u.id ? '#ffb95f' : '#0b1326'}
                        stroke="#ffb95f"
                        strokeWidth="1.8"
                      />
                      <title>Outlet Port (Click to link stream from this unit)</title>
                    </g>
                  </g>
                );
              })}
          </svg>

          {/* ================= DYNAMIC STREAM DATA FLAG OVERLAYS ================= */}
          {showFlags && (
            <>
              {/* Flag S-101 */}
              {s101 && (
                <div
                  onClick={() => onSelectStream('S-101')}
                  className={`absolute top-[240px] left-[15px] p-1.5 rounded shadow-lg border-l-2 font-mono text-[10px] w-28 cursor-pointer transition-all ${
                    selectedStreamId === 'S-101' ? 'bg-[#222a3d] border-[#4cd7f6] ring-1 ring-[#4cd7f6]' : 'bg-[#171f33]/95 border-[#4cd7f6] hover:bg-[#222a3d]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[#4cd7f6]">
                    <span>S-101</span>
                    <span className="text-[#bcc9cd] text-[9px]">FEED</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    T: <span className="text-[#ffddb8]">{formatTemp(s101.tempC, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    P: <span>{formatPres(s101.presBar, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    F: <span className="text-[#4edea3]">{formatFlow(s101.flowKgH, unitSystem)}</span>
                  </div>
                </div>
              )}

              {/* Flag S-103 */}
              {s103 && (
                <div
                  onClick={() => onSelectStream('S-103')}
                  className={`absolute top-[235px] left-[285px] p-1.5 rounded shadow-lg border-l-2 font-mono text-[10px] w-28 cursor-pointer transition-all ${
                    selectedStreamId === 'S-103' ? 'bg-[#222a3d] border-[#ffb95f] ring-1 ring-[#ffb95f]' : 'bg-[#171f33]/95 border-[#ffb95f] hover:bg-[#222a3d]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[#ffb95f]">
                    <span>S-103</span>
                    <span className="text-[#bcc9cd] text-[9px]">EXCH_OUT</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    T: <span className="text-[#ffddb8]">{formatTemp(s103.tempC, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    P: <span>{formatPres(s103.presBar, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    VF: <span className="text-[#4cd7f6]">{s103.vaporFraction.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Flag S-104 */}
              {s104 && (
                <div
                  onClick={() => onSelectStream('S-104')}
                  className={`absolute top-[75px] left-[430px] p-1.5 rounded shadow-lg border-l-2 font-mono text-[10px] w-28 cursor-pointer transition-all ${
                    selectedStreamId === 'S-104' ? 'bg-[#222a3d] border-[#ee9800] ring-1 ring-[#ee9800]' : 'bg-[#171f33]/95 border-[#ee9800] hover:bg-[#222a3d]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[#ee9800]">
                    <span>S-104</span>
                    <span className="text-[#4edea3] text-[9px]">RX_FEED</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    T: <span className="text-[#ffddb8]">{formatTemp(s104.tempC, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    P: <span>{formatPres(s104.presBar, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    VF: <span className="text-[#4cd7f6]">{s104.vaporFraction.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Flag S-105 */}
              {s105 && (
                <div
                  onClick={() => onSelectStream('S-105')}
                  className={`absolute top-[395px] left-[380px] p-1.5 rounded shadow-lg border-l-2 font-mono text-[10px] w-32 cursor-pointer transition-all ${
                    selectedStreamId === 'S-105' ? 'bg-[#222a3d] border-[#4edea3] ring-1 ring-[#4edea3]' : 'bg-[#171f33]/95 border-[#4edea3] hover:bg-[#222a3d]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[#4edea3]">
                    <span>S-105</span>
                    <span className="text-[9px]">EFFLUENT</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    T: <span className="text-[#ffddb8]">{formatTemp(s105.tempC, unitSystem)}</span> (ΔT -27.4)
                  </div>
                  <div className="text-[#dae2fd]">
                    P: <span>{formatPres(s105.presBar, unitSystem)}</span> (ΔP 1.9)
                  </div>
                  <div className="text-[#dae2fd]">
                    H2 Conv: <span className="text-[#4cd7f6]">94.2%</span>
                  </div>
                </div>
              )}

              {/* Flag S-106 Recycle */}
              {s106 && (
                <div
                  onClick={() => onSelectStream('S-106')}
                  className={`absolute top-[45px] left-[620px] p-1.5 rounded shadow-lg border-l-2 font-mono text-[10px] w-28 cursor-pointer transition-all ${
                    selectedStreamId === 'S-106' ? 'bg-[#222a3d] border-[#acedff] ring-1 ring-[#acedff]' : 'bg-[#171f33]/95 border-[#acedff] hover:bg-[#222a3d]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[#acedff]">
                    <span>S-106</span>
                    <span className="text-[9px]">H2 RECYCLE</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    T: <span className="text-[#ffddb8]">{formatTemp(s106.tempC, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    P: <span>{formatPres(s106.presBar, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    H2: <span className="text-[#4edea3]">91.4 mol%</span>
                  </div>
                </div>
              )}

              {/* Flag S-107 Bottoms */}
              {s107 && (
                <div
                  onClick={() => onSelectStream('S-107')}
                  className={`absolute top-[385px] left-[700px] p-1.5 rounded shadow-lg border-l-2 font-mono text-[10px] w-32 cursor-pointer transition-all ${
                    selectedStreamId === 'S-107' ? 'bg-[#222a3d] border-[#ffb95f] ring-1 ring-[#ffb95f]' : 'bg-[#171f33]/95 border-[#ffb95f] hover:bg-[#222a3d]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[#ffb95f]">
                    <span>S-107</span>
                    <span className="text-[9px]">REFORMATE</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    T: <span className="text-[#ffddb8]">{formatTemp(s107.tempC, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    F: <span>{formatFlow(s107.flowKgH, unitSystem)}</span>
                  </div>
                  <div className="text-[#dae2fd]">
                    SG: <span>0.784</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Canvas Footer Status Strip */}
      <div className="h-6 px-3 bg-[#171f33] flex items-center justify-between text-[#869397] font-mono text-[10px] border-t border-[#3d494c]/30">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[14px]">touch_app</span>
          <span className="text-[#dae2fd]">{selectedUnit.id} SELECTED (Type: {selectedUnit.name})</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Active Layer: Flowsheet_Base</span>
          <span>Zoom: {zoom.toFixed(2)}x</span>
          <span className="text-[#4edea3]">Status: Validated Topology</span>
          <span className="text-[#bcc9cd]">Cursor: X: {mouseCoords.x} Y: {mouseCoords.y}</span>
        </div>
      </div>

      {/* Engineering Context Menu */}
      {contextMenu && (
        <FlowsheetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetUnit={contextMenu.targetUnit}
          onClose={() => setContextMenu(null)}
          onInspect={(id) => onSelectUnit(id)}
          onRecalculate={() => onSolveFlowsheet?.()}
          onViewProfiles={onViewProfiles}
          onViewHydraulics={onViewHydraulics}
          onCenterUnit={(id) => {
            const u = units.find((item) => item.id === id);
            if (u && canvasContainerRef.current) {
              canvasContainerRef.current.scrollTo({
                left: Math.max(0, u.x * zoom - 300),
                top: Math.max(0, u.y * zoom - 200),
                behavior: 'smooth',
              });
            }
          }}
          onView3D={() => onOpen3DView?.()}
          onDeleteUnit={onDeleteUnit}
          onAddUnit={(type) => onAddUnit?.(type)}
          onAddStream={() => onAddStream?.()}
          onSolveFlowsheet={() => onSolveFlowsheet?.()}
          onZoomFit={() => setZoom(1.0)}
        />
      )}
    </section>
  );
};
