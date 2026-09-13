import React from 'react';
import { UnitSystem, ViewTab } from '../types/simulation';

interface HeaderProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  unitSystem: UnitSystem;
  onUnitSystemChange: (system: UnitSystem) => void;
  isSolving: boolean;
  onSolve: () => void;
  onPause: () => void;
  onStep: () => void;
  onClearDiagnostics: () => void;
  onOpenUnitConverter: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onAddUnit: (type: 'reactor' | 'heatex' | 'furnace' | 'pump' | 'vessel' | 'column') => void;
  onAddStream: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onFitView: () => void;
  equationOfState: string;
  onChangeEos: (eos: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  unitSystem,
  onUnitSystemChange,
  isSolving,
  onSolve,
  onPause,
  onStep,
  onClearDiagnostics,
  onOpenUnitConverter,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onAddUnit,
  onAddStream,
  snapEnabled,
  onToggleSnap,
  onFitView,
  equationOfState,
  onChangeEos,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#060e20] flex flex-col border-b border-[#3d494c]/30 select-none">
      {/* 1. Title bar & System status */}
      <div className="h-7 px-2 flex items-center justify-between bg-[#060e20] border-b border-[#3d494c]/30">
        <div className="flex items-center gap-2">
          {/* macOS window control buttons */}
          <div className="flex items-center gap-1.5 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffb4ab]/80 hover:bg-[#ffb4ab] cursor-pointer" title="Close Workspace" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffb95f]/80 hover:bg-[#ffb95f] cursor-pointer" title="Minimize" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#4edea3]/80 hover:bg-[#4edea3] cursor-pointer" title="Expand Viewport" />
          </div>

          <div className="flex items-center gap-1.5 pl-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[15px]">account_tree</span>
            <span className="font-semibold tracking-tight text-[#dae2fd] uppercase text-[12px]">PETROSIMX</span>
            <span className="font-mono text-[10px] text-[#869397]">v4.8.2-PRO</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#171f33] px-2 py-0.5 rounded border border-[#3d494c]/40">
            <span className="font-mono text-[10.5px] text-[#4cd7f6]">[PROJECT-01: Hydrocracker_Preheat_Train.petx*]</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* EOS Selector */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131b2e] border border-[#3d494c]/30 text-[10.5px]">
            <span className="text-[#869397] font-mono">EOS:</span>
            <select
              value={equationOfState}
              onChange={(e) => onChangeEos(e.target.value)}
              className="bg-transparent text-[#dae2fd] font-mono text-[10.5px] focus:outline-none cursor-pointer"
            >
              <option value="Peng-Robinson / SRK" className="bg-[#131b2e]">Peng-Robinson / SRK</option>
              <option value="Peng-Robinson / Boston-Mathias" className="bg-[#131b2e]">Peng-Robinson / Boston-Mathias</option>
              <option value="SRK / Kabadi-Danner" className="bg-[#131b2e]">SRK / Kabadi-Danner</option>
              <option value="NRTL / Electrolyte" className="bg-[#131b2e]">NRTL / Electrolyte</option>
            </select>
          </div>

          {/* Solver Status Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1bbd85]/20 border border-[#4edea3]/30">
            <div className={`w-1.5 h-1.5 rounded-full ${isSolving ? 'bg-[#ffb95f] animate-ping' : 'bg-[#4edea3]'}`} />
            <span className={`font-mono text-[10px] ${isSolving ? 'text-[#ffb95f]' : 'text-[#4edea3]'}`}>
              {isSolving ? 'ITERATING (Wegstein)...' : 'CONVERGED (12ms)'}
            </span>
          </div>

          {/* Units System Selector */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131b2e] border border-[#3d494c]/30 text-[10.5px]">
            <span className="text-[#869397] font-mono">UNITS:</span>
            <select
              value={unitSystem}
              onChange={(e) => onUnitSystemChange(e.target.value as UnitSystem)}
              className="bg-transparent text-[#ffddb8] font-mono text-[10.5px] focus:outline-none cursor-pointer"
            >
              <option value="SI" className="bg-[#131b2e]">SI (bar, °C, kg/h)</option>
              <option value="Field" className="bg-[#131b2e]">Field (psi, °F, lb/h)</option>
              <option value="Metric" className="bg-[#131b2e]">Metric (kg/cm², °C, t/h)</option>
            </select>
          </div>

          {/* User Account */}
          <div className="w-5 h-5 rounded-full bg-[#4cd7f6] flex items-center justify-center text-[#003640] font-bold text-[10px]" title="Licensed to Senior Lead Process Engineer">
            <span className="material-symbols-outlined text-[13px]">person</span>
          </div>
        </div>
      </div>

      {/* 2. Navigation Module Ribbon */}
      <div className="h-6 px-2 flex items-center justify-between bg-[#131b2e] border-b border-[#3d494c]/20 text-[11px]">
        <nav className="flex items-center gap-0.5">
          {[
            { id: 'flowsheet-canvas', label: 'Flowsheet' },
            { id: '3d-plant-view', label: '3D Plant' },
            { id: 'column-design', label: 'Column Design' },
            { id: 'thermodynamics-engine', label: 'Thermodynamics' },
            { id: 'reactor-engineering', label: 'Reactors' },
            { id: 'sensitivity-optimization', label: 'Optimization' },
            { id: 'energy-utilities', label: 'Energy & Emissions' },
            { id: 'stream-matrix', label: 'Matrix Sheets' },
            { id: 'digital-twin-monitor', label: 'Digital Twin' },
          ].map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as ViewTab)}
                className={`px-2.5 py-0.5 transition-colors text-[11.5px] font-medium rounded-t ${
                  isActive
                    ? 'bg-[#222a3d] text-[#4cd7f6] border-t-2 border-[#4cd7f6]'
                    : 'text-[#bcc9cd] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-[#869397] font-mono text-[10px]">
          <span>MEM: 1.48 GB</span>
          <span>|</span>
          <span>THREADS: 16/16</span>
        </div>
      </div>

      {/* 3. Action Toolbar */}
      <div className="h-7 px-2 flex items-center gap-1 bg-[#060e20] border-b border-[#3d494c]/30 overflow-x-auto">
        <button
          onClick={onNewProject}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title="New Flowsheet"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">post_add</span>
        </button>
        <button
          onClick={onOpenProject}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title="Open Project (.petx)"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">folder_open</span>
        </button>
        <button
          onClick={onSaveProject}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title="Save Model"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
        </button>

        <div className="h-4 w-px bg-[#3d494c]/40 mx-1" />

        {/* SOLVE BUTTON */}
        <button
          onClick={onSolve}
          disabled={isSolving}
          className="flex items-center gap-1 px-2.5 py-0.5 bg-[#4cd7f6]/20 hover:bg-[#4cd7f6]/30 text-[#4cd7f6] border border-[#4cd7f6]/40 rounded font-mono text-[10.5px] font-semibold transition-all active:scale-95"
          title="Solve All (Run Simulation)"
          type="button"
        >
          <span className={`material-symbols-outlined text-[15px] ${isSolving ? 'animate-spin' : ''}`}>
            {isSolving ? 'refresh' : 'play_arrow'}
          </span>
          <span>SOLVE</span>
        </button>

        <button
          onClick={onPause}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title="Pause Calculation"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">pause</span>
        </button>

        <button
          onClick={onStep}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title="Step Iteration"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">redo</span>
        </button>

        <button
          onClick={onClearDiagnostics}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title="Clear Diagnostics Log"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">layers_clear</span>
        </button>

        <div className="h-4 w-px bg-[#3d494c]/40 mx-1" />

        {/* Unit Adders */}
        <button
          onClick={onAddStream}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px]"
          title="Add Material Stream"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#ffb95f]">trending_flat</span>
          <span>Stream</span>
        </button>

        <button
          onClick={() => onAddUnit('reactor')}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px]"
          title="Add Reactor Unit"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#4edea3]">propane_tank</span>
          <span>Reactor</span>
        </button>

        <button
          onClick={() => onAddUnit('heatex')}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px]"
          title="Add Heat Exchanger"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#4cd7f6]">sync_alt</span>
          <span>HeatEx</span>
        </button>

        <button
          onClick={() => onAddUnit('column')}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px]"
          title="Add Distillation Column"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#ffddb8]">view_column</span>
          <span>Column</span>
        </button>

        <div className="h-4 w-px bg-[#3d494c]/40 mx-1" />

        <button
          onClick={() => onTabChange(currentTab === '3d-plant-view' ? 'flowsheet-canvas' : '3d-plant-view')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10.5px] font-semibold transition-all ${
            currentTab === '3d-plant-view'
              ? 'bg-[#4cd7f6]/30 text-[#4cd7f6] border border-[#4cd7f6]'
              : 'hover:bg-[#171f33] text-[#4cd7f6] border border-[#4cd7f6]/40'
          }`}
          title="Switch to 3D Process Plant CAE Visualizer"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">view_in_ar</span>
          <span>3D PLANT</span>
        </button>

        <div className="h-4 w-px bg-[#3d494c]/40 mx-1" />

        <button
          onClick={onFitView}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title="Zoom Extents / Fit View"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">fit_screen</span>
        </button>

        <button
          onClick={onToggleSnap}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10.5px] transition-colors ${
            snapEnabled ? 'bg-[#171f33] text-[#4cd7f6] border border-[#4cd7f6]/40' : 'text-[#869397] hover:bg-[#171f33]'
          }`}
          title="Toggle Coordinate Snapping"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">grid_4x4</span>
          <span>{snapEnabled ? 'SNAP 10mm' : 'SNAP OFF'}</span>
        </button>

        <button
          onClick={onOpenUnitConverter}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title="Chemical Engineering Units Converter"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">calculate</span>
        </button>
      </div>
    </header>
  );
};
