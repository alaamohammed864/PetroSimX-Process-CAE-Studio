import React, { useState } from 'react';
import { PIDController, DynamicProcessVariable } from '../../types/dynamic';

interface LoopFaceplateCardProps {
  controller: PIDController;
  pvVariable: DynamicProcessVariable;
  mvVariable: DynamicProcessVariable;
  onUpdateController: (updated: PIDController) => void;
  onSelectForTrend: (controllerTag: string) => void;
  isSelectedForTrend: boolean;
}

export const LoopFaceplateCard: React.FC<LoopFaceplateCardProps> = ({
  controller,
  pvVariable,
  mvVariable,
  onUpdateController,
  onSelectForTrend,
  isSelectedForTrend,
}) => {
  const [isTuningOpen, setIsTuningOpen] = useState(false);
  const [tempSp, setTempSp] = useState(controller.setPoint.toString());
  const [tempKp, setTempKp] = useState(controller.kp.toString());
  const [tempTi, setTempTi] = useState(controller.tiSec.toString());
  const [tempTd, setTempTd] = useState(controller.tdSec.toString());

  const error = controller.setPoint - controller.processVariable;
  const absError = Math.abs(error);

  const handleApplySp = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempSp);
    if (!isNaN(val)) {
      onUpdateController({ ...controller, setPoint: val });
    }
  };

  const handleToggleMode = (mode: 'AUTO' | 'MANUAL') => {
    onUpdateController({
      ...controller,
      mode,
      manualOutput: controller.outputPercent,
    });
  };

  const handleManualOpChange = (newOp: number) => {
    onUpdateController({
      ...controller,
      manualOutput: newOp,
      outputPercent: newOp,
    });
  };

  const handleSaveTuning = () => {
    const kp = parseFloat(tempKp);
    const ti = parseFloat(tempTi);
    const td = parseFloat(tempTd);
    if (!isNaN(kp) && !isNaN(ti) && !isNaN(td)) {
      onUpdateController({
        ...controller,
        kp,
        tiSec: Math.max(0.1, ti),
        tdSec: Math.max(0, td),
      });
      setIsTuningOpen(false);
    }
  };

  // Status color based on alarm
  const getAlarmBadge = () => {
    switch (pvVariable.alarmState) {
      case 'HIGH_HIGH':
        return <span className="px-1.5 py-0.5 rounded bg-[#ff5449]/20 text-[#ff8077] font-bold text-[10px] animate-pulse">TRIP (HH)</span>;
      case 'LOW_LOW':
        return <span className="px-1.5 py-0.5 rounded bg-[#ff5449]/20 text-[#ff8077] font-bold text-[10px] animate-pulse">TRIP (LL)</span>;
      case 'HIGH':
        return <span className="px-1.5 py-0.5 rounded bg-[#ffb95f]/20 text-[#ffddb8] font-bold text-[10px]">WARN (HI)</span>;
      case 'LOW':
        return <span className="px-1.5 py-0.5 rounded bg-[#ffb95f]/20 text-[#ffddb8] font-bold text-[10px]">WARN (LO)</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded bg-[#1bbd85]/20 text-[#4edea3] font-bold text-[10px]">NORMAL</span>;
    }
  };

  return (
    <div
      className={`bg-[#131b2e] rounded border transition-all ${
        isSelectedForTrend
          ? 'border-[#4cd7f6] ring-1 ring-[#4cd7f6]/40 shadow-lg'
          : 'border-[#3d494c]/30 hover:border-[#3d494c]/60'
      }`}
    >
      {/* Header bar */}
      <div className="p-3 bg-[#171f33] border-b border-[#3d494c]/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectForTrend(controller.tag)}
            className={`w-2.5 h-2.5 rounded-full ${isSelectedForTrend ? 'bg-[#4cd7f6]' : 'bg-[#3d494c]'} hover:bg-[#4cd7f6] transition-colors`}
            title="Click to display on main trend"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#4cd7f6] text-sm">{controller.tag}</span>
              <span className="text-[10px] font-mono text-[#869397] uppercase">({controller.action})</span>
            </div>
            <div className="text-[11px] text-[#dae2fd] font-medium truncate max-w-[210px]">
              {controller.name}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getAlarmBadge()}
          <div className="flex rounded bg-[#0b1326] p-0.5 border border-[#3d494c]/40 text-[10px] font-mono">
            <button
              onClick={() => handleToggleMode('AUTO')}
              className={`px-2 py-0.5 rounded ${
                controller.mode === 'AUTO'
                  ? 'bg-[#4cd7f6] text-[#003640] font-bold'
                  : 'text-[#869397] hover:text-[#dae2fd]'
              }`}
            >
              AUTO
            </button>
            <button
              onClick={() => handleToggleMode('MANUAL')}
              className={`px-2 py-0.5 rounded ${
                controller.mode === 'MANUAL'
                  ? 'bg-[#ffb95f] text-[#482900] font-bold'
                  : 'text-[#869397] hover:text-[#dae2fd]'
              }`}
            >
              MAN
            </button>
          </div>
        </div>
      </div>

      {/* Main Process Gauges & Readouts */}
      <div className="p-3 space-y-3">
        {/* Process Variable (PV) Display */}
        <div className="bg-[#0b1326] p-2.5 rounded border border-[#3d494c]/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-[#869397] uppercase block">
              Measured PV: {controller.pvTag}
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-mono font-bold text-[#ffddb8]">
                {controller.processVariable.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-[#869397]">{pvVariable.unit}</span>
            </div>
          </div>

          {/* PV Bar visualization */}
          <div className="w-24 text-right">
            <div className="text-[9.5px] font-mono text-[#869397] mb-1">Scale</div>
            <div className="h-2 w-full bg-[#171f33] rounded-full overflow-hidden relative">
              <div
                className="h-full bg-[#ffb95f] transition-all duration-300"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      ((controller.processVariable - pvVariable.minRange) /
                        (pvVariable.maxRange - pvVariable.minRange)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[8.5px] font-mono text-[#869397] mt-0.5">
              <span>{pvVariable.minRange}</span>
              <span>{pvVariable.maxRange}</span>
            </div>
          </div>
        </div>

        {/* Setpoint (SP) & Tracking Error */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30">
            <div className="text-[10px] text-[#869397] uppercase flex items-center justify-between">
              <span>Target SP</span>
              <span className="text-[#4cd7f6]">{pvVariable.unit}</span>
            </div>
            <form onSubmit={handleApplySp} className="flex items-center gap-1 mt-1">
              <input
                type="number"
                step="0.1"
                value={tempSp}
                onChange={(e) => setTempSp(e.target.value)}
                onBlur={handleApplySp}
                className="w-full bg-[#0b1326] px-1.5 py-0.5 rounded text-sm font-bold text-[#4cd7f6] border border-[#3d494c]/40 focus:border-[#4cd7f6] focus:outline-none"
              />
            </form>
          </div>

          <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30">
            <div className="text-[10px] text-[#869397] uppercase">Control Error (e)</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`text-sm font-bold ${
                  absError > 5 ? 'text-[#ff8077]' : absError > 1 ? 'text-[#ffddb8]' : 'text-[#4edea3]'
                }`}
              >
                {error > 0 ? `+${error.toFixed(2)}` : error.toFixed(2)}
              </span>
              <span className="text-[10px] text-[#869397]">{pvVariable.unit}</span>
            </div>
            <div className="text-[9.5px] text-[#869397] mt-0.5">
              {absError < 0.5 ? 'On Target' : `${absError.toFixed(1)} ${pvVariable.unit} dev`}
            </div>
          </div>
        </div>

        {/* Manipulated Variable (MV / Output OP %) */}
        <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#869397] text-[10.5px]">
              Actuator Output (OP): <strong className="text-[#dae2fd]">{controller.mvTag}</strong>
            </span>
            <span className="font-bold text-[#dae2fd] text-sm">
              {controller.outputPercent.toFixed(1)}%
            </span>
          </div>

          {/* OP Progress Bar or Manual Slider */}
          {controller.mode === 'MANUAL' ? (
            <div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={controller.outputPercent}
                onChange={(e) => handleManualOpChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-[#0b1326] rounded appearance-none cursor-pointer accent-[#ffb95f]"
              />
              <div className="flex justify-between text-[9px] font-mono text-[#ffb95f]">
                <span>MANUAL OVERRIDE ACTIVE</span>
                <span>Slide to adjust OP</span>
              </div>
            </div>
          ) : (
            <div className="h-2 w-full bg-[#0b1326] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4cd7f6] transition-all duration-200"
                style={{ width: `${Math.max(0, Math.min(100, controller.outputPercent))}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] font-mono text-[#869397]">
            <span>Actuator Val: {mvVariable.value.toFixed(1)} {mvVariable.unit}</span>
            <span>Anti-Windup: Active</span>
          </div>
        </div>

        {/* PID Tuning Drawer Toggle */}
        <div className="pt-1 border-t border-[#3d494c]/20 flex items-center justify-between text-[11px] font-mono">
          <button
            onClick={() => setIsTuningOpen(!isTuningOpen)}
            className="text-[#4cd7f6] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">
              {isTuningOpen ? 'expand_less' : 'tune'}
            </span>
            {isTuningOpen ? 'Hide PID Tuning' : 'Tune PID (P, I, D)'}
          </button>

          <span className="text-[10px] text-[#869397]">
            Kp: {controller.kp} | Ti: {controller.tiSec}s | Td: {controller.tdSec}s
          </span>
        </div>

        {/* Expandable Tuning Drawer */}
        {isTuningOpen && (
          <div className="p-3 bg-[#0b1326] rounded border border-[#3d494c]/30 text-xs font-mono space-y-2 mt-2">
            <div className="text-[10.5px] font-bold text-[#dae2fd] uppercase pb-1 border-b border-[#3d494c]/30">
              Discrete Controller Parameters
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9.5px] text-[#869397] uppercase block">Gain (Kp)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempKp}
                  onChange={(e) => setTempKp(e.target.value)}
                  className="w-full bg-[#171f33] px-1.5 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/50 focus:border-[#4cd7f6] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[9.5px] text-[#869397] uppercase block">Integral Ti (s)</label>
                <input
                  type="number"
                  step="1"
                  value={tempTi}
                  onChange={(e) => setTempTi(e.target.value)}
                  className="w-full bg-[#171f33] px-1.5 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/50 focus:border-[#4cd7f6] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[9.5px] text-[#869397] uppercase block">Deriv Td (s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempTd}
                  onChange={(e) => setTempTd(e.target.value)}
                  className="w-full bg-[#171f33] px-1.5 py-1 rounded text-xs text-[#dae2fd] border border-[#3d494c]/50 focus:border-[#4cd7f6] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[9px] text-[#869397]">Derivative Filter N = 10</span>
              <button
                onClick={handleSaveTuning}
                className="px-3 py-1 bg-[#4cd7f6] text-[#003640] rounded font-semibold text-[11px] hover:bg-[#38bde6] transition-colors"
              >
                Apply Parameters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
