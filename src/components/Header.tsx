import React from 'react';
import { UnitSystem, ViewTab } from '../types/simulation';
import { PWAInstallButton } from './pwa/PWAInstallButton';
import { useI18n } from '../i18n/I18nContext';
import { useAppTheme } from '../theme/ThemeContext';

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
  onOpenShortcuts?: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onOpenProjectManager?: () => void;
  projectName?: string;
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
  onOpenShortcuts,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onOpenProjectManager,
  projectName = 'Ammonia Synthesis Loop Flowsheet',
  onAddUnit,
  onAddStream,
  snapEnabled,
  onToggleSnap,
  onFitView,
  equationOfState,
  onChangeEos,
}) => {
  const { t, language, setLanguage } = useI18n();
  const { theme, toggleTheme } = useAppTheme();

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
            <span className="font-bold tracking-tight text-[#dae2fd] uppercase text-[12px]">PETROSIMX</span>
            <span className="hidden xl:inline font-mono text-[9px] text-[#4cd7f6]/90 bg-[#4cd7f6]/10 px-1.5 py-0.5 rounded border border-[#4cd7f6]/30">
              Process Simulation &amp; Reactor Engineering Suite
            </span>
          </div>

          <button
            onClick={onOpenProjectManager}
            className="flex items-center gap-1.5 bg-[#171f33] hover:bg-[#222a3d] px-2 py-0.5 rounded border border-[#3d494c]/40 text-left transition-colors"
            title={t('header.projectManager')}
            type="button"
          >
            <span className="material-symbols-outlined text-[12px] text-[#4cd7f6]">inventory_2</span>
            <span className="font-mono text-[10.5px] text-[#4cd7f6] max-w-[280px] truncate">[{projectName}.petx]</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Language Switcher (EN / العربية) */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#131b2e] hover:bg-[#1e273d] border border-[#3d494c]/40 text-[10.5px] font-mono text-[#dae2fd] transition-colors"
            title={language === 'en' ? 'Switch to Arabic (العربية)' : 'التبديل إلى الإنجليزية (English)'}
            type="button"
          >
            <span className="material-symbols-outlined text-[13px] text-[#4cd7f6]">translate</span>
            <span className="font-semibold">{language === 'en' ? 'العربية' : 'EN'}</span>
          </button>

          {/* Theme Toggle (Dark / Light) */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#131b2e] hover:bg-[#1e273d] border border-[#3d494c]/40 text-[10.5px] font-mono text-[#dae2fd] transition-colors"
            title={theme === 'dark' ? t('header.themeLight') : t('header.themeDark')}
            type="button"
          >
            <span className="material-symbols-outlined text-[13px] text-[#ffb95f]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="hidden sm:inline uppercase text-[9.5px]">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          {/* EOS Selector */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131b2e] border border-[#3d494c]/30 text-[10.5px]">
            <span className="text-[#869397] font-mono">{t('header.eos')}</span>
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
              {isSolving ? t('header.iterating') : t('header.converged')}
            </span>
          </div>

          {/* Units System Selector */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131b2e] border border-[#3d494c]/30 text-[10.5px]">
            <span className="text-[#869397] font-mono">{t('header.units')}</span>
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

          {/* Keyboard Shortcuts Button */}
          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="w-5 h-5 rounded bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/50 flex items-center justify-center text-[#4cd7f6] font-mono font-bold text-[11px] transition-colors"
              title={t('header.shortcuts')}
              type="button"
            >
              ?
            </button>
          )}

          {/* User Account */}
          <div className="w-5 h-5 rounded-full bg-[#4cd7f6] flex items-center justify-center text-[#003640] font-bold text-[10px]" title="Licensed Process CAE Workstation">
            <span className="material-symbols-outlined text-[13px]">person</span>
          </div>
        </div>
      </div>

      {/* 2. Navigation Module Ribbon */}
      <div className="h-6 px-2 flex items-center justify-between bg-[#131b2e] border-b border-[#3d494c]/20 text-[11px]">
        <nav className="flex items-center gap-0.5">
          {[
            { id: 'flowsheet-canvas', labelKey: 'tab.flowsheet', defaultLabel: 'Flowsheet' },
            { id: '3d-plant-view', labelKey: 'tab.3dPlant', defaultLabel: '3D Plant' },
            { id: 'column-design', labelKey: 'tab.columnDesign', defaultLabel: 'Column Design' },
            { id: 'thermodynamics-engine', labelKey: 'tab.thermodynamics', defaultLabel: 'Thermodynamics' },
            { id: 'reactor-engineering', labelKey: 'tab.reactors', defaultLabel: 'Reactors' },
            { id: 'sensitivity-optimization', labelKey: 'tab.optimization', defaultLabel: 'Optimization' },
            { id: 'energy-utilities', labelKey: 'tab.energyEmissions', defaultLabel: 'Energy & Emissions' },
            { id: 'engineering-reports', labelKey: 'tab.reports', defaultLabel: 'Reports & Audits' },
            { id: 'stream-matrix', labelKey: 'tab.matrixSheets', defaultLabel: 'Matrix Sheets' },
            { id: 'digital-twin-monitor', labelKey: 'tab.digitalTwin', defaultLabel: 'Digital Twin' },
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
                {t(tab.labelKey, tab.defaultLabel)}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-[#869397] font-mono text-[10px]">
          <span>
            {typeof performance !== 'undefined' && (performance as any).memory
              ? `HEAP: ${Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))} MB`
              : 'HEAP: OPTIMAL'}
          </span>
          <span>|</span>
          <span>THREADS: {typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8}</span>
        </div>
      </div>

      {/* 3. Action Toolbar */}
      <div className="h-7 px-2 flex items-center gap-1 bg-[#060e20] border-b border-[#3d494c]/30 overflow-x-auto">
        <button
          onClick={onNewProject}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title={t('header.newProject')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">post_add</span>
        </button>
        <button
          onClick={onOpenProject}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title={t('header.openProject')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">folder_open</span>
        </button>
        <button
          onClick={onSaveProject}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title={t('header.saveProject')}
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
          title={t('header.solveTooltip')}
          type="button"
        >
          <span className={`material-symbols-outlined text-[15px] ${isSolving ? 'animate-spin' : ''}`}>
            {isSolving ? 'refresh' : 'play_arrow'}
          </span>
          <span>{t('header.solve')}</span>
        </button>

        <button
          onClick={onPause}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title={t('header.pause')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">pause</span>
        </button>

        <button
          onClick={onStep}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title={t('header.step')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">redo</span>
        </button>

        <button
          onClick={onClearDiagnostics}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title={t('header.clearLogs')}
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
          <span>{t('header.addStream')}</span>
        </button>

        <button
          onClick={() => onAddUnit('reactor')}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px]"
          title="Add Reactor Unit"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#4edea3]">propane_tank</span>
          <span>{t('header.addReactor')}</span>
        </button>

        <button
          onClick={() => onAddUnit('heatex')}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px]"
          title="Add Heat Exchanger"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#4cd7f6]">sync_alt</span>
          <span>{t('header.addHeatEx')}</span>
        </button>

        <button
          onClick={() => onAddUnit('column')}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px]"
          title="Add Distillation Column"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#ffddb8]">view_column</span>
          <span>{t('header.addColumn')}</span>
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

        <button
          onClick={() => onTabChange(currentTab === 'engineering-reports' ? 'flowsheet-canvas' : 'engineering-reports')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10.5px] font-semibold transition-all ${
            currentTab === 'engineering-reports'
              ? 'bg-[#4edea3]/30 text-[#4edea3] border border-[#4edea3]'
              : 'hover:bg-[#171f33] text-[#4edea3] border border-[#4edea3]/40'
          }`}
          title="Open Professional Engineering Reports Studio"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">assignment</span>
          <span>REPORTS</span>
        </button>

        <div className="h-4 w-px bg-[#3d494c]/40 mx-1" />

        <button
          onClick={onFitView}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title={t('header.fitView')}
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
          <span>{snapEnabled ? t('header.snapOn') : t('header.snapOff')}</span>
        </button>

        <button
          onClick={onOpenUnitConverter}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded"
          title={t('header.unitConverter')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">calculate</span>
        </button>
      </div>
    </header>
  );
};

