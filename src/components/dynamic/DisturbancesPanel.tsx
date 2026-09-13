import React, { useState } from 'react';
import { SimulationDisturbance, DisturbanceProfile, DisturbanceType } from '../../types/dynamic';

interface DisturbancesPanelProps {
  disturbances: SimulationDisturbance[];
  timeSec: number;
  onToggleDisturbance: (id: string, active: boolean) => void;
  onAddCustomDisturbance: (dist: SimulationDisturbance) => void;
  onResetDisturbances: () => void;
}

export const DisturbancesPanel: React.FC<DisturbancesPanelProps> = ({
  disturbances,
  timeSec,
  onToggleDisturbance,
  onAddCustomDisturbance,
  onResetDisturbances,
}) => {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('Custom Header Transient');
  const [customTarget, setCustomTarget] = useState('FT-101');
  const [customType, setCustomType] = useState<DisturbanceType>('feed_flow');
  const [customProfile, setCustomProfile] = useState<DisturbanceProfile>('step');
  const [customMag, setCustomMag] = useState(5000);
  const [customDuration, setCustomDuration] = useState(60);

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const newDist: SimulationDisturbance = {
      id: `dist-custom-${Date.now()}`,
      name: customName,
      type: customType,
      profile: customProfile,
      targetTag: customTarget,
      magnitude: customMag,
      startTimeSec: timeSec,
      durationSec: customDuration,
      active: true,
      appliedDelta: 0,
    };
    onAddCustomDisturbance(newDist);
    setShowCustomForm(false);
  };

  return (
    <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 space-y-4">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#3d494c]/30">
        <div>
          <h3 className="text-sm font-bold text-[#dae2fd] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffb95f] text-base">bolt</span>
            Process Disturbance Injection Engine
          </h3>
          <p className="text-xs text-[#869397] mt-0.5">
            Introduce dynamic perturbations (feed variations, header shocks, utility outages) to evaluate PID loop stability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="px-2.5 py-1 rounded bg-[#171f33] hover:bg-[#1c253b] border border-[#3d494c]/50 text-xs font-mono text-[#4cd7f6] flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">
              {showCustomForm ? 'close' : 'add'}
            </span>
            {showCustomForm ? 'Cancel' : 'New Disturbance'}
          </button>

          <button
            onClick={onResetDisturbances}
            className="px-2.5 py-1 rounded bg-[#171f33] hover:bg-[#1c253b] border border-[#3d494c]/50 text-xs font-mono text-[#869397] hover:text-[#dae2fd] transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Custom Disturbance Creator Modal/Form */}
      {showCustomForm && (
        <form
          onSubmit={handleCreateCustom}
          className="p-3 bg-[#0b1326] rounded border border-[#4cd7f6]/40 text-xs font-mono space-y-3"
        >
          <div className="font-bold text-[#4cd7f6] uppercase flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">tune</span>
            Configure Dynamic Disturbance Profile
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[#869397] text-[10px] uppercase block">Scenario Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-[#171f33] px-2 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/50 mt-1 focus:border-[#4cd7f6] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[#869397] text-[10px] uppercase block">Target Tag</label>
              <select
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                className="w-full bg-[#171f33] px-2 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/50 mt-1 focus:border-[#4cd7f6] focus:outline-none"
              >
                <option value="FT-101">FT-101 (Fresh Feed Flow kg/h)</option>
                <option value="TT-104">TT-104 (Furnace Coil Temp °C)</option>
                <option value="PT-101">PT-101 (Separator Pressure bar)</option>
                <option value="PV-101">PV-101 (Vent Valve Position %)</option>
                <option value="TT-105">TT-105 (Reactor Effluent Temp °C)</option>
                <option value="LT-101">LT-101 (Liquid Level %)</option>
              </select>
            </div>

            <div>
              <label className="text-[#869397] text-[10px] uppercase block">Signal Profile</label>
              <select
                value={customProfile}
                onChange={(e) => setCustomProfile(e.target.value as DisturbanceProfile)}
                className="w-full bg-[#171f33] px-2 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/50 mt-1 focus:border-[#4cd7f6] focus:outline-none"
              >
                <option value="step">Step Change (+/- Delta)</option>
                <option value="ramp">Linear Ramp Rate</option>
                <option value="pulse">Temporary Pulse</option>
                <option value="sine_wave">Harmonic Sine Wave</option>
                <option value="noise">Gaussian High-Frequency Noise</option>
              </select>
            </div>

            <div>
              <label className="text-[#869397] text-[10px] uppercase block">Magnitude / Delta</label>
              <input
                type="number"
                step="any"
                value={customMag}
                onChange={(e) => setCustomMag(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#171f33] px-2 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/50 mt-1 focus:border-[#4cd7f6] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[#869397] text-[10px] uppercase block">Duration (seconds)</label>
              <input
                type="number"
                value={customDuration}
                onChange={(e) => setCustomDuration(parseInt(e.target.value) || 10)}
                className="w-full bg-[#171f33] px-2 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/50 mt-1 focus:border-[#4cd7f6] focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-1.5 px-3 bg-[#4cd7f6] text-[#003640] rounded font-bold hover:bg-[#38bde6] transition-colors"
              >
                Inject Disturbance Now
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Preset Disturbances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {disturbances.map((dist) => {
          const elapsed = timeSec - dist.startTimeSec;
          const isCurrentlyActive = dist.active && elapsed >= 0 && elapsed <= dist.durationSec;
          const remaining = Math.max(0, dist.durationSec - Math.max(0, elapsed));

          return (
            <div
              key={dist.id}
              className={`p-3 rounded border transition-all ${
                isCurrentlyActive
                  ? 'bg-[#1e1c2e] border-[#ffb95f] ring-1 ring-[#ffb95f]/30'
                  : 'bg-[#171f33] border-[#3d494c]/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#dae2fd]">{dist.name}</div>
                  <div className="text-[10px] font-mono text-[#869397] mt-0.5">
                    Target: <strong className="text-[#4cd7f6]">{dist.targetTag}</strong> | Profile:{' '}
                    <strong className="capitalize text-[#ffddb8]">{dist.profile}</strong>
                  </div>
                </div>

                <button
                  onClick={() => onToggleDisturbance(dist.id, !dist.active)}
                  className={`px-2 py-1 rounded text-[10.5px] font-mono font-bold transition-colors ${
                    dist.active
                      ? 'bg-[#ff5449] text-white hover:bg-[#e0453b]'
                      : 'bg-[#0b1326] text-[#869397] hover:text-[#dae2fd] border border-[#3d494c]/40'
                  }`}
                >
                  {dist.active ? 'TRIGGERED' : 'INJECT'}
                </button>
              </div>

              {/* Status details & progress */}
              <div className="mt-2.5 pt-2 border-t border-[#3d494c]/20 flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#869397]">
                  Mag: <strong className="text-[#dae2fd]">{dist.magnitude > 0 ? `+${dist.magnitude}` : dist.magnitude}</strong>
                </span>

                {isCurrentlyActive ? (
                  <span className="flex items-center gap-1 text-[#ffb95f] font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-[#ffb95f]" />
                    Active ({remaining.toFixed(0)}s left)
                  </span>
                ) : dist.active && elapsed > dist.durationSec ? (
                  <span className="text-[#4edea3]">Completed</span>
                ) : (
                  <span className="text-[#869397]">Duration: {dist.durationSec}s</span>
                )}
              </div>

              {/* Real-time applied offset bar */}
              {isCurrentlyActive && (
                <div className="mt-2">
                  <div className="flex justify-between text-[9px] font-mono text-[#ffddb8] mb-0.5">
                    <span>Applied Transient Offset:</span>
                    <span>{dist.appliedDelta.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0b1326] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#ffb95f] transition-all"
                      style={{ width: `${(remaining / dist.durationSec) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
