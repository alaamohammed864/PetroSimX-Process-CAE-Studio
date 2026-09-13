import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (showReconnected) {
    return (
      <div className="fixed bottom-12 right-6 z-50 flex items-center gap-2 rounded-lg bg-[#005234] border border-[#4edea3]/50 px-3.5 py-2 text-xs font-mono text-[#4edea3] shadow-2xl animate-fade-in">
        <span className="material-symbols-outlined text-[16px]">wifi</span>
        <span>Network reconnected. Offline changes safely preserved in local database.</span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="fixed bottom-12 right-6 z-50 flex items-center gap-2.5 rounded-lg bg-[#171f33] border border-[#ffb95f] px-3.5 py-2 text-xs font-mono text-[#ffb95f] shadow-2xl">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffb95f] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ffb95f]"></span>
      </span>
      <div className="flex flex-col">
        <span className="font-bold tracking-wider uppercase text-[10px]">OFFLINE MODE ACTIVE</span>
        <span className="text-[10.5px] text-[#dae2fd]">
          Operating completely offline. IndexedDB storage and local CAE solvers enabled.
        </span>
      </div>
    </div>
  );
};
