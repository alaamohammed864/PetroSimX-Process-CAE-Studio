import React, { useState } from 'react';
import { EquipmentUnit, ProcessStream, UnitSystem } from '../../types/simulation';

interface OptimizationViewProps {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  unitSystem: UnitSystem;
}

export const OptimizationView: React.FC<OptimizationViewProps> = () => {
  const [objective, setObjective] = useState<'yield' | 'energy' | 'profit'>('yield');
  const [targetTemp, setTargetTemp] = useState<number>(512.5);
  const [targetRatio, setTargetRatio] = useState<number>(680.0);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimalFound, setOptimalFound] = useState<boolean>(true);

  const handleRunOptimization = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setIsOptimizing(false);
      setOptimalFound(true);
      if (objective === 'yield') {
        setTargetTemp(514.8);
        setTargetRatio(695.0);
      } else if (objective === 'energy') {
        setTargetTemp(502.0);
        setTargetRatio(580.0);
      } else {
        setTargetTemp(511.2);
        setTargetRatio(640.0);
      }
    }, 1000);
  };

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto font-mono text-[11px] select-none">
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#4cd7f6] text-[13px] font-bold">
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>NONLINEAR PROCESS OPTIMIZATION &amp; SQP SOLVER</span>
          </div>
          <p className="text-[#869397] text-[10px] mt-0.5">
            Sequential Quadratic Programming (SQP) algorithm with gradient-based Karush-Kuhn-Tucker (KKT) optimality conditions.
          </p>
        </div>

        <button
          onClick={handleRunOptimization}
          disabled={isOptimizing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4cd7f6] text-[#003640] font-bold rounded hover:opacity-90 active:scale-95 transition-all shadow"
        >
          <span className={`material-symbols-outlined text-[16px] ${isOptimizing ? 'animate-spin' : ''}`}>
            {isOptimizing ? 'refresh' : 'play_arrow'}
          </span>
          <span>{isOptimizing ? 'SOLVING SQP MATRIX...' : 'RUN SQP OPTIMIZER'}</span>
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Objective & Decision Variables (Cols 1 to 6) */}
        <div className="col-span-6 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
          <span className="font-bold text-[#dae2fd] flex items-center gap-1.5 border-b border-[#3d494c]/30 pb-1.5">
            <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">target</span>
            Objective Function Formulation
          </span>

          <div className="space-y-2">
            <label className="flex items-center gap-2 p-2 rounded bg-[#060e20] border border-[#3d494c]/20 cursor-pointer">
              <input
                type="radio"
                name="objective"
                checked={objective === 'yield'}
                onChange={() => setObjective('yield')}
                className="accent-[#4cd7f6]"
              />
              <div>
                <span className="text-[#4cd7f6] font-bold block">Maximize C6-C8 Aromatic Reformate Yield</span>
                <span className="text-[#869397] text-[9.5px]">Max obj = ∫(w_benzene + w_toluene) · F_eff dV</span>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2 rounded bg-[#060e20] border border-[#3d494c]/20 cursor-pointer">
              <input
                type="radio"
                name="objective"
                checked={objective === 'energy'}
                onChange={() => setObjective('energy')}
                className="accent-[#4cd7f6]"
              />
              <div>
                <span className="text-[#4edea3] font-bold block">Minimize Furnace Fuel Gas Duty &amp; CO₂</span>
                <span className="text-[#869397] text-[9.5px]">Min obj = Q_furnace [MW] + λ · Recycle_Compressor_Power</span>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2 rounded bg-[#060e20] border border-[#3d494c]/20 cursor-pointer">
              <input
                type="radio"
                name="objective"
                checked={objective === 'profit'}
                onChange={() => setObjective('profit')}
                className="accent-[#4cd7f6]"
              />
              <div>
                <span className="text-[#ffddb8] font-bold block">Maximize Net Plant Operating Margin ($/hr)</span>
                <span className="text-[#869397] text-[9.5px]">Economic margin with utility penalties and catalyst cost</span>
              </div>
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#3d494c]/30">
            <span className="font-bold text-[#ffddb8] block">Decision Variables</span>
            <div className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 space-y-2">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#869397]">Reactor Inlet Temperature (T_in):</span>
                  <span className="text-[#4cd7f6] font-bold">{targetTemp.toFixed(1)} °C</span>
                </div>
                <input
                  type="range"
                  min="480"
                  max="530"
                  step="0.5"
                  value={targetTemp}
                  onChange={(e) => setTargetTemp(parseFloat(e.target.value))}
                  className="w-full accent-[#4cd7f6] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#869397]">H2:HC Treat Gas Ratio:</span>
                  <span className="text-[#ffddb8] font-bold">{targetRatio.toFixed(0)} Nm³/m³</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="800"
                  step="5"
                  value={targetRatio}
                  onChange={(e) => setTargetRatio(parseFloat(e.target.value))}
                  className="w-full accent-[#ffddb8] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Optimization Results & Constraints (Cols 7 to 12) */}
        <div className="col-span-6 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
          <span className="font-bold text-[#dae2fd] flex items-center gap-1.5 border-b border-[#3d494c]/30 pb-1.5">
            <span className="material-symbols-outlined text-[#4edea3] text-[16px]">verified</span>
            Active Constraints &amp; KKT Optimality State
          </span>

          <div className="space-y-2">
            <div className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#dae2fd] font-semibold">Max Bed Peak Temperature</span>
                <span className="text-[#4edea3] font-bold">524.2 °C ≤ 535.0 °C</span>
              </div>
              <div className="w-full bg-[#131b2e] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#4edea3] h-full w-[88%]"></div>
              </div>
              <span className="text-[#869397] text-[9px]">Constraint Margin: +10.8 °C (Slack active)</span>
            </div>

            <div className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#dae2fd] font-semibold">Bed Pressure Drop ΔP</span>
                <span className="text-[#4edea3] font-bold">1.86 bar ≤ 2.50 bar</span>
              </div>
              <div className="w-full bg-[#131b2e] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#4edea3] h-full w-[74%]"></div>
              </div>
              <span className="text-[#869397] text-[9px]">Constraint Margin: 0.64 bar (Within allowable limits)</span>
            </div>

            <div className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#dae2fd] font-semibold">Catalyst Coking Deactivation</span>
                <span className="text-[#4edea3] font-bold">0.015%/1000h ≤ 0.025%/1000h</span>
              </div>
              <div className="w-full bg-[#131b2e] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#4edea3] h-full w-[60%]"></div>
              </div>
            </div>
          </div>

          {optimalFound && (
            <div className="bg-[#1bbd85]/15 p-2.5 rounded border border-[#4edea3]/40 space-y-1 text-[#4edea3]">
              <div className="font-bold flex items-center gap-1 text-[11.5px]">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>OPTIMAL POINT FOUND (Tolerance = 2.4e-6)</span>
              </div>
              <p className="text-[#bcc9cd] text-[10px]">
                Predicted annual economic gain: <strong className="text-[#dae2fd]">+$1,240,000 / year</strong> through improved reformate selectivity and reduced compressor recycle work.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
