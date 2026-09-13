import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1 text-[10px] font-mono text-[#4edea3] bg-[#005234]/30 px-2 py-0.5 rounded border border-[#4edea3]/30" title="Running in Standalone Native Application Mode">
        <span className="material-symbols-outlined text-[13px]">offline_pin</span>
        <span className="font-semibold uppercase tracking-wider">APP INSTALLED</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={async () => {
          setInstalling(true);
          try {
            await install();
          } finally {
            setInstalling(false);
          }
        }}
        disabled={installing}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#4cd7f6]/20 hover:bg-[#4cd7f6]/30 text-[#4cd7f6] text-[11px] font-mono font-bold border border-[#4cd7f6]/60 transition-all shadow-sm active:scale-95 ${className}`}
        title="Install PetroSimX as Standalone Desktop / Mobile Application"
        type="button"
      >
        <span className="material-symbols-outlined text-[14px]">download_for_offline</span>
        <span>{installing ? 'INSTALLING...' : 'INSTALL PWA'}</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] text-[11px] font-mono border border-[#3d494c]/60 transition-all ${className}`}
          title="Install PetroSimX on iOS Home Screen"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">ios_share</span>
          <span>INSTALL APP</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans">
            <div className="w-full max-w-sm rounded-xl bg-[#131b2e] border border-[#3d494c] p-6 shadow-2xl text-[#dae2fd]">
              <div className="flex items-center justify-between pb-3 border-b border-[#3d494c]/40 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#4cd7f6]/20 border border-[#4cd7f6]/50 flex items-center justify-center text-[#4cd7f6]">
                    <span className="material-symbols-outlined text-[18px]">engineering</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Install PetroSimX</h3>
                    <p className="text-[10px] text-[#869397] font-mono">Offline-First PWA Setup</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-[#869397] hover:text-white"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#bcc9cd]">
                <p>To run PetroSimX as a native standalone app on iPhone or iPad:</p>
                <ol className="list-decimal list-inside space-y-2 text-[#dae2fd] bg-[#0b1326] p-3 rounded-lg border border-[#3d494c]/40">
                  <li>
                    Tap the <strong className="text-white">Share</strong> button (
                    <span className="inline-flex align-middle text-[#4cd7f6]">
                      <span className="material-symbols-outlined text-[14px]">ios_share</span>
                    </span>
                    ) in Safari.
                  </li>
                  <li>
                    Scroll down and select <strong className="text-[#4edea3]">Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-white">Add</strong> in top right to launch offline without browser borders.
                  </li>
                </ol>
                <p className="text-[11px] text-[#869397]">
                  All thermodynamic solvers, simulation matrices, and local projects will remain available without internet.
                </p>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded bg-[#4cd7f6] hover:bg-[#38bde6] py-2 text-xs font-bold text-[#003643] uppercase tracking-wider transition-colors"
                type="button"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback button to educate user on standalone availability
  return (
    <button
      onClick={() => {
        alert(
          'PetroSimX is a Progressive Web App (PWA). If your browser does not trigger the native prompt automatically, use your browser address bar menu ("Install App" or "Add to Home Screen") to run offline.'
        );
      }}
      className={`flex items-center gap-1 px-2 py-0.5 rounded bg-[#171f33]/80 hover:bg-[#222a3d] text-[#869397] hover:text-[#4cd7f6] text-[10px] font-mono border border-[#3d494c]/40 transition-all ${className}`}
      title="PWA Offline Application Capable"
      type="button"
    >
      <span className="material-symbols-outlined text-[12px]">offline_pin</span>
      <span>PWA READY</span>
    </button>
  );
};
