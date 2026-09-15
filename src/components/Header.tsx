import React, { useState } from 'react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="relative shrink-0 w-full z-40 bg-[#060e20] flex flex-col border-b border-[#3d494c]/30 select-none">
      {/* 1. Title bar & System status */}
      <div className="h-8 sm:h-7 px-2 sm:px-3 flex items-center justify-between bg-[#060e20] border-b border-[#3d494c]/30">
        <div className="flex items-center gap-2 min-w-0">
          {/* macOS window control buttons (desktop only) */}
          <div className="hidden sm:flex items-center gap-1.5 px-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffb4ab]/80 hover:bg-[#ffb4ab] cursor-pointer" title="Close Workspace" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffb95f]/80 hover:bg-[#ffb95f] cursor-pointer" title="Minimize" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#4edea3]/80 hover:bg-[#4edea3] cursor-pointer" title="Expand Viewport" />
          </div>

          <div className="flex items-center gap-1.5 pl-0 sm:pl-2 shrink-0">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[16px] sm:text-[15px]">account_tree</span>
            <span className="font-bold tracking-tight text-[#dae2fd] uppercase text-[12px] sm:text-[12px]">PETROSIMX</span>
            <span className="hidden xl:inline font-mono text-[9px] text-[#4cd7f6]/90 bg-[#4cd7f6]/10 px-1.5 py-0.5 rounded border border-[#4cd7f6]/30">
              Process Simulation &amp; Reactor Engineering Suite
            </span>
            <span className="hidden lg:inline-flex items-center gap-1 font-mono text-[9px] text-[#ffddb8] bg-[#ffddb8]/10 px-1.5 py-0.5 rounded border border-[#ffddb8]/30">
              <span className="material-symbols-outlined text-[11px] text-[#ffddb8]">badge</span>
              <span>DEV: ENG ALAA MOHAMMED</span>
            </span>
          </div>

          <button
            onClick={onOpenProjectManager}
            className="flex items-center gap-1 bg-[#171f33] hover:bg-[#222a3d] px-1.5 sm:px-2 py-0.5 rounded border border-[#3d494c]/40 text-left transition-colors min-w-0"
            title={t('header.projectManager')}
            type="button"
          >
            <span className="material-symbols-outlined text-[12px] text-[#4cd7f6] shrink-0">inventory_2</span>
            <span className="font-mono text-[10px] sm:text-[10.5px] text-[#4cd7f6] max-w-[130px] sm:max-w-[240px] truncate">
              [{projectName}.petx]
            </span>
          </button>
        </div>

        {/* Desktop Controls Ribbon */}
        <div className="hidden lg:flex items-center gap-2">
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

        {/* Mobile / Tablet Compact Header Tools */}
        <div className="flex lg:hidden items-center gap-1.5">
          {/* Mobile Solver Status dot */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1bbd85]/20 border border-[#4edea3]/30">
            <div className={`w-1.5 h-1.5 rounded-full ${isSolving ? 'bg-[#ffb95f] animate-ping' : 'bg-[#4edea3]'}`} />
            <span className={`font-mono text-[9.5px] ${isSolving ? 'text-[#ffb95f]' : 'text-[#4edea3]'}`}>
              {isSolving ? 'Iter' : 'OK'}
            </span>
          </div>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#131b2e] border border-[#3d494c]/40 text-[10px] font-mono text-[#dae2fd]"
            title={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
            type="button"
          >
            <span className="font-semibold">{language === 'en' ? 'العربية' : 'EN'}</span>
          </button>

          {/* Quick Solve Icon Button */}
          <button
            onClick={onSolve}
            disabled={isSolving}
            className="p-1 px-1.5 bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/40 rounded font-mono text-[10px] flex items-center gap-0.5 font-bold"
            title="Solve Flowsheet"
            type="button"
          >
            <span className={`material-symbols-outlined text-[14px] ${isSolving ? 'animate-spin' : ''}`}>
              {isSolving ? 'refresh' : 'play_arrow'}
            </span>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1 rounded bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/60 text-[#4cd7f6] flex items-center justify-center transition-colors"
            title="Toggle Engineering Studio Menu"
            type="button"
            aria-label="Open Studio Menu"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Module Ribbon (Horizontally scrollable on mobile/tablet) */}
      <div className="h-7 sm:h-6 px-2 flex items-center justify-between bg-[#131b2e] border-b border-[#3d494c]/20 text-[11px] overflow-x-auto no-scrollbar scroll-smooth">
        <nav className="flex items-center gap-0.5 shrink-0">
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
                className={`px-2.5 py-1 sm:py-0.5 transition-colors text-[11px] sm:text-[11.5px] font-medium rounded-t shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#222a3d] text-[#4cd7f6] border-t-2 border-[#4cd7f6] font-bold'
                    : 'text-[#bcc9cd] hover:bg-[#171f33] hover:text-[#dae2fd]'
                }`}
                type="button"
              >
                {t(tab.labelKey, tab.defaultLabel)}
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-2 text-[#869397] font-mono text-[10px] shrink-0 pl-3">
          <span>
            {typeof performance !== 'undefined' && (performance as any).memory
              ? `HEAP: ${Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))} MB`
              : 'HEAP: OPTIMAL'}
          </span>
          <span>|</span>
          <span>THREADS: {typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8}</span>
        </div>
      </div>

      {/* 3. Action Toolbar (Horizontally scrollable on mobile/tablet) */}
      <div className="h-8 sm:h-7 px-2 flex items-center gap-1 bg-[#060e20] border-b border-[#3d494c]/30 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth">
        <button
          onClick={onNewProject}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded shrink-0"
          title={t('header.newProject')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">post_add</span>
        </button>
        <button
          onClick={onOpenProject}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded shrink-0"
          title={t('header.openProject')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">folder_open</span>
        </button>
        <button
          onClick={onSaveProject}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded shrink-0"
          title={t('header.saveProject')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
        </button>

        <div className="h-4 w-px bg-[#3d494c]/40 mx-1 shrink-0" />

        {/* SOLVE BUTTON */}
        <button
          onClick={onSolve}
          disabled={isSolving}
          className="flex items-center gap-1 px-2.5 py-1 sm:py-0.5 bg-[#4cd7f6]/20 hover:bg-[#4cd7f6]/30 text-[#4cd7f6] border border-[#4cd7f6]/40 rounded font-mono text-[10.5px] font-semibold transition-all active:scale-95 shrink-0"
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
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded shrink-0"
          title={t('header.pause')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">pause</span>
        </button>

        <button
          onClick={onStep}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded shrink-0"
          title={t('header.step')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">redo</span>
        </button>

        <button
          onClick={onClearDiagnostics}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded shrink-0"
          title={t('header.clearLogs')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">layers_clear</span>
        </button>

        <div className="h-4 w-px bg-[#3d494c]/40 mx-1 shrink-0" />

        {/* Unit Adders */}
        <button
          onClick={onAddStream}
          className="flex items-center gap-1 px-1.5 py-1 sm:py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px] shrink-0"
          title="Add Material Stream"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#ffb95f]">trending_flat</span>
          <span>{t('header.addStream')}</span>
        </button>

        <button
          onClick={() => onAddUnit('reactor')}
          className="flex items-center gap-1 px-1.5 py-1 sm:py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px] shrink-0"
          title="Add Reactor Unit"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#4edea3]">propane_tank</span>
          <span>{t('header.addReactor')}</span>
        </button>

        <button
          onClick={() => onAddUnit('heatex')}
          className="flex items-center gap-1 px-1.5 py-1 sm:py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px] shrink-0"
          title="Add Heat Exchanger"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#4cd7f6]">sync_alt</span>
          <span>{t('header.addHeatEx')}</span>
        </button>

        <button
          onClick={() => onAddUnit('column')}
          className="flex items-center gap-1 px-1.5 py-1 sm:py-0.5 hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] rounded font-mono text-[10.5px] shrink-0"
          title="Add Distillation Column"
          type="button"
        >
          <span className="material-symbols-outlined text-[15px] text-[#ffddb8]">view_column</span>
          <span>{t('header.addColumn')}</span>
        </button>

        <div className="h-4 w-px bg-[#3d494c]/40 mx-1 shrink-0" />

        <button
          onClick={() => onTabChange(currentTab === '3d-plant-view' ? 'flowsheet-canvas' : '3d-plant-view')}
          className={`flex items-center gap-1 px-2 py-1 sm:py-0.5 rounded font-mono text-[10.5px] font-semibold transition-all shrink-0 ${
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
          className={`flex items-center gap-1 px-2 py-1 sm:py-0.5 rounded font-mono text-[10.5px] font-semibold transition-all shrink-0 ${
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

        <div className="h-4 w-px bg-[#3d494c]/40 mx-1 shrink-0" />

        <button
          onClick={onFitView}
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded shrink-0"
          title={t('header.fitView')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">fit_screen</span>
        </button>

        <button
          onClick={onToggleSnap}
          className={`flex items-center gap-1 px-1.5 py-1 sm:py-0.5 rounded font-mono text-[10.5px] transition-colors shrink-0 ${
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
          className="p-1 hover:bg-[#171f33] hover:text-[#dae2fd] text-[#bcc9cd] rounded shrink-0"
          title={t('header.unitConverter')}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">calculate</span>
        </button>
      </div>

      {/* Mobile Drawer / Off-Canvas Studio Settings Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-start bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm mx-auto bg-[#131b2e] border-b border-[#3d494c] shadow-2xl p-4 font-mono text-[11px] space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#3d494c]/50 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">tune</span>
                <span className="font-bold text-[#dae2fd] text-[13px]">PETROSIMX STUDIO CONTROLS</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 text-[#869397] hover:text-white rounded hover:bg-[#171f33]"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Project Quick Actions */}
            <div className="space-y-1.5">
              <span className="text-[#869397] text-[10px] uppercase font-bold block">Project Management</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenProjectManager?.();
                  }}
                  className="flex items-center gap-1.5 p-2 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/40 rounded text-[#4cd7f6]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_managed</span>
                  <span>Project Studio</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onSaveProject();
                  }}
                  className="flex items-center gap-1.5 p-2 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/40 rounded text-[#4edea3]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Save Project</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onNewProject();
                  }}
                  className="flex items-center gap-1.5 p-2 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/40 rounded text-[#ffddb8]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">post_add</span>
                  <span>New Flowsheet</span>
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenProject();
                  }}
                  className="flex items-center gap-1.5 p-2 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/40 rounded text-[#dae2fd]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  <span>Open File</span>
                </button>
              </div>
            </div>

            {/* Simulation Thermodynamic Model */}
            <div className="space-y-1.5">
              <span className="text-[#869397] text-[10px] uppercase font-bold block">Equation of State (EOS)</span>
              <select
                value={equationOfState}
                onChange={(e) => onChangeEos(e.target.value)}
                className="w-full bg-[#171f33] border border-[#3d494c]/60 text-[#dae2fd] rounded p-2 focus:border-[#4cd7f6] focus:outline-none"
              >
                <option value="Peng-Robinson / SRK">Peng-Robinson / SRK</option>
                <option value="Peng-Robinson / Boston-Mathias">Peng-Robinson / Boston-Mathias</option>
                <option value="SRK / Kabadi-Danner">SRK / Kabadi-Danner</option>
                <option value="NRTL / Electrolyte">NRTL / Electrolyte</option>
              </select>
            </div>

            {/* Engineering Units System */}
            <div className="space-y-1.5">
              <span className="text-[#869397] text-[10px] uppercase font-bold block">Unit Conventions</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['SI', 'Field', 'Metric'] as UnitSystem[]).map((sys) => (
                  <button
                    key={sys}
                    onClick={() => onUnitSystemChange(sys)}
                    className={`py-1.5 px-2 rounded border text-center transition-all ${
                      unitSystem === sys
                        ? 'bg-[#4cd7f6] text-[#003640] font-bold border-[#4cd7f6]'
                        : 'bg-[#171f33] text-[#dae2fd] border-[#3d494c]/40'
                    }`}
                    type="button"
                  >
                    {sys}
                  </button>
                ))}
              </div>
            </div>

            {/* Studio Tools & Preferences */}
            <div className="space-y-1.5">
              <span className="text-[#869397] text-[10px] uppercase font-bold block">App Preferences &amp; Tools</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    toggleTheme();
                  }}
                  className="flex items-center gap-1.5 p-2 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/40 rounded text-[#dae2fd]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#ffb95f]">
                    {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                  </span>
                  <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenUnitConverter();
                  }}
                  className="flex items-center gap-1.5 p-2 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/40 rounded text-[#dae2fd]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#4cd7f6]">calculate</span>
                  <span>Unit Converter</span>
                </button>

                {onOpenShortcuts && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenShortcuts();
                    }}
                    className="flex items-center gap-1.5 p-2 bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c]/40 rounded text-[#dae2fd]"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#ffddb8]">keyboard</span>
                    <span>Hotkeys Reference</span>
                  </button>
                )}

                <div className="p-2 bg-[#171f33] border border-[#3d494c]/40 rounded flex items-center justify-center">
                  <PWAInstallButton />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#3d494c]/40 text-center text-[10px] text-[#869397]">
              PETROSIMX CAE • Lic. Eng Alaa Mohammed
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

