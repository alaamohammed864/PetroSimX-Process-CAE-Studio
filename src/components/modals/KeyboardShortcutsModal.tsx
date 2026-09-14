import React from 'react';
import { useI18n } from '../../i18n/I18nContext';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  descEn: string;
  descAr: string;
  category: 'simulation' | 'navigation' | 'canvas' | 'tools';
}

const SHORTCUTS: ShortcutItem[] = [
  { key: 'F5 / Ctrl + Enter', descEn: 'Run Steady-State Simulation (Solve)', descAr: 'حل ومحاكاة المخطط التتابعي', category: 'simulation' },
  { key: 'Ctrl + S', descEn: 'Save Project to Local IndexedDB', descAr: 'حفظ المشروع في قاعدة البيانات المحلية', category: 'tools' },
  { key: 'Ctrl + O', descEn: 'Open Project Manager (.petx)', descAr: 'إدارة واستيراد المشاريع', category: 'tools' },
  { key: 'Ctrl + M', descEn: 'View Stream Property Matrix', descAr: 'عرض جدول موازنة التيارات الشامل', category: 'navigation' },
  { key: 'Ctrl + E', descEn: 'Open Energy & Emissions Studio', descAr: 'استوديو الطاقة والانبعاثات', category: 'navigation' },
  { key: 'Ctrl + R', descEn: 'Open Engineering Reports & Audits', descAr: 'تقارير الهندسة والتدقيق', category: 'navigation' },
  { key: 'Ctrl + Shift + U', descEn: 'Open Units Converter', descAr: 'محول الوحدات الهندسية الكيميائية', category: 'tools' },
  { key: 'Ctrl + Shift + S', descEn: 'Open Sensitivity Analysis Curves', descAr: 'نافذة تحليل الحساسية', category: 'simulation' },
  { key: 'Scroll Wheel', descEn: 'Smooth Canvas Zoom (Centered)', descAr: 'تكبير وتصغير سلس للمخطط', category: 'canvas' },
  { key: 'Right Click', descEn: 'Open Context Action Menu', descAr: 'قائمة الأوامر السريعة بالزر الأيمن', category: 'canvas' },
  { key: 'Escape', descEn: 'Close Dialogs / Deselect Active Unit', descAr: 'إلغاء التحديد أو إغلاق النوافذ', category: 'canvas' },
  { key: '?', descEn: 'Toggle Keyboard Shortcuts Reference', descAr: 'عرض قائمة اختصارات لوحة المفاتيح', category: 'tools' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { language, t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#131b2e] border border-[#3d494c]/60 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-[#dae2fd]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#171f33] border-b border-[#3d494c]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">keyboard</span>
            <div>
              <h2 className="font-semibold text-sm text-[#dae2fd] tracking-wide">
                {language === 'ar' ? 'اختصارات لوحة المفاتيح الهندسية' : 'Engineering Keyboard Shortcuts'}
              </h2>
              <p className="text-[11px] text-[#869397] font-mono">PETROSIMX Workstation Hotkeys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#222a3d] text-[#869397] hover:text-[#dae2fd] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {SHORTCUTS.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-[#060e20]/60 rounded border border-[#3d494c]/30 hover:border-[#4cd7f6]/40 transition-colors"
              >
                <span className="text-xs text-[#bcc9cd] font-medium pr-2">
                  {language === 'ar' ? item.descAr : item.descEn}
                </span>
                <kbd className="px-2 py-0.5 bg-[#222a3d] text-[#4cd7f6] border border-[#3d494c]/60 rounded font-mono text-[11px] font-semibold whitespace-nowrap shadow-sm">
                  {item.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#171f33] border-t border-[#3d494c]/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#869397]">
              {language === 'ar' ? 'اضغط Esc في أي وقت للإغلاق' : 'Press Esc anytime to dismiss'}
            </span>
            <span className="text-[10px] font-mono text-[#ffddb8] bg-[#ffddb8]/10 px-1.5 py-0.5 rounded border border-[#ffddb8]/20">
              Dev: ENG ALAA MOHAMMED
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#4cd7f6]/20 hover:bg-[#4cd7f6]/30 text-[#4cd7f6] border border-[#4cd7f6]/40 rounded text-xs font-semibold font-mono transition-colors"
            type="button"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
