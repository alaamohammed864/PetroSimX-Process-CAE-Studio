import React, { useEffect, useRef } from 'react';
import { EquipmentUnit, UnitType } from '../types/simulation';
import { useI18n } from '../i18n/I18nContext';

interface FlowsheetContextMenuProps {
  x: number;
  y: number;
  targetUnit: EquipmentUnit | null;
  onClose: () => void;
  onInspect: (unitId: string) => void;
  onRecalculate: (unitId: string) => void;
  onViewProfiles?: (unitId: string) => void;
  onViewHydraulics?: (unitId: string) => void;
  onCenterUnit?: (unitId: string) => void;
  onView3D?: (unitId: string) => void;
  onDeleteUnit?: (unitId: string) => void;
  onAddUnit: (type: UnitType) => void;
  onAddStream: () => void;
  onSolveFlowsheet: () => void;
  onZoomFit: () => void;
}

export const FlowsheetContextMenu: React.FC<FlowsheetContextMenuProps> = ({
  x,
  y,
  targetUnit,
  onClose,
  onInspect,
  onRecalculate,
  onViewProfiles,
  onViewHydraulics,
  onCenterUnit,
  onView3D,
  onDeleteUnit,
  onAddUnit,
  onAddStream,
  onSolveFlowsheet,
  onZoomFit,
}) => {
  const { t, language } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust positioning to avoid screen overflows
  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - 320);

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 min-w-[220px] bg-[#131b2e] border border-[#3d494c]/80 rounded-lg shadow-2xl py-1.5 text-xs text-[#dae2fd] select-none animate-fade-in backdrop-blur-md"
    >
      {targetUnit ? (
        <>
          <div className="px-3 py-1.5 border-b border-[#3d494c]/40 flex items-center justify-between bg-[#171f33]/60">
            <span className="font-mono font-bold text-[#4cd7f6]">{targetUnit.id}</span>
            <span className="text-[10px] text-[#869397] font-mono uppercase">{targetUnit.type}</span>
          </div>

          <button
            onClick={() => {
              onInspect(targetUnit.id);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] hover:text-[#4cd7f6] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] text-[#4cd7f6]">tune</span>
            <span>{t('context.inspect')}</span>
          </button>

          <button
            onClick={() => {
              onRecalculate(targetUnit.id);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] hover:text-[#4edea3] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] text-[#4edea3]">refresh</span>
            <span>{t('context.recalculate')}</span>
          </button>

          {targetUnit.type === 'reactor' && onViewProfiles && (
            <button
              onClick={() => {
                onViewProfiles(targetUnit.id);
                onClose();
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] hover:text-[#ffb95f] transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px] text-[#ffb95f]">show_chart</span>
              <span>{t('context.viewProfiles')}</span>
            </button>
          )}

          {targetUnit.type === 'column' && onViewHydraulics && (
            <button
              onClick={() => {
                onViewHydraulics(targetUnit.id);
                onClose();
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] hover:text-[#ffddb8] transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px] text-[#ffddb8]">view_column</span>
              <span>{t('context.trayHydraulics')}</span>
            </button>
          )}

          {onView3D && (
            <button
              onClick={() => {
                onView3D(targetUnit.id);
                onClose();
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] hover:text-[#4cd7f6] transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px] text-[#4cd7f6]">view_in_ar</span>
              <span>{t('context.viewIn3D')}</span>
            </button>
          )}

          <div className="my-1 border-t border-[#3d494c]/40" />

          {onDeleteUnit && (
            <button
              onClick={() => {
                onDeleteUnit(targetUnit.id);
                onClose();
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
              <span>{t('context.deleteUnit')}</span>
            </button>
          )}
        </>
      ) : (
        <>
          <div className="px-3 py-1 text-[10px] text-[#869397] font-mono uppercase tracking-wider border-b border-[#3d494c]/40">
            {language === 'ar' ? 'أوامر المخطط السريعة' : 'Flowsheet Actions'}
          </div>

          <button
            onClick={() => {
              onSolveFlowsheet();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-[#4cd7f6] hover:bg-[#4cd7f6]/10 font-medium transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">play_arrow</span>
            <span>{t('canvas.quickSolve')}</span>
          </button>

          <button
            onClick={() => {
              onAddStream();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] text-[#ffb95f]">trending_flat</span>
            <span>{t('context.addStream')}</span>
          </button>

          <div className="my-1 border-t border-[#3d494c]/40" />

          <button
            onClick={() => {
              onAddUnit('reactor');
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] text-[#4edea3]">propane_tank</span>
            <span>+ {t('header.addReactor')}</span>
          </button>

          <button
            onClick={() => {
              onAddUnit('heatex');
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] text-[#4cd7f6]">sync_alt</span>
            <span>+ {t('header.addHeatEx')}</span>
          </button>

          <button
            onClick={() => {
              onAddUnit('column');
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] text-[#ffddb8]">view_column</span>
            <span>+ {t('header.addColumn')}</span>
          </button>

          <button
            onClick={() => {
              onAddUnit('pump');
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px] text-[#38bdf8]">rotate_right</span>
            <span>+ Pump</span>
          </button>

          <div className="my-1 border-t border-[#3d494c]/40" />

          <button
            onClick={() => {
              onZoomFit();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[#222a3d] transition-colors text-[#bcc9cd]"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">fit_screen</span>
            <span>{t('header.fitView')}</span>
          </button>
        </>
      )}
    </div>
  );
};
