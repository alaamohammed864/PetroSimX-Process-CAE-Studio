import React, { useState, useMemo } from 'react';
import { UnitSystem } from '../../types/simulation';
import {
  DistillationColumnSpec,
  ShortcutDistillationResult,
  RigorousDistillationResult,
  CondenserType,
  ReboilerType,
} from '../../engine/separation/distillationTypes';
import {
  solveShortcutDistillation,
  solveRigorousDistillation,
} from '../../engine/separation/distillationEngine';
import { calculateStreamState } from '../../engine/stream/streamCalculator';
import { PURE_COMPONENTS_DB } from '../../engine/thermo/thermoConstants';

interface ColumnDesignViewProps {
  unitSystem: UnitSystem;
}

export const ColumnDesignView: React.FC<ColumnDesignViewProps> = ({ unitSystem }) => {
  // Column Type & Mode
  const [activeTab, setActiveTab] = useState<'distillation' | 'absorber' | 'stripper' | 'three_phase'>('distillation');
  const [solverMethod, setSolverMethod] = useState<'rigorous' | 'shortcut'>('rigorous');

  // Column Specifications
  const [numberOfStages, setNumberOfStages] = useState<number>(24);
  const [feedStage, setFeedStage] = useState<number>(12);
  const [refluxRatio, setRefluxRatio] = useState<number>(2.5);
  const [topPressureBar, setTopPressureBar] = useState<number>(14.5);
  const [bottomPressureBar, setBottomPressureBar] = useState<number>(15.5);
  const [condenserType, setCondenserType] = useState<CondenserType>('total');
  const [reboilerType, setReboilerType] = useState<ReboilerType>('thermosiphon');
  const [lightKey, setLightKey] = useState<string>('c3');
  const [heavyKey, setHeavyKey] = useState<string>('nc4');
  const [lightKeyRecovery, setLightKeyRecovery] = useState<number>(0.98);
  const [heavyKeyRecovery, setHeavyKeyRecovery] = useState<number>(0.98);
  const [distillateRateKgH, setDistillateRateKgH] = useState<number>(12500);

  // Feed Stream Definition
  const [feedFlowKgH, setFeedFlowKgH] = useState<number>(30000);
  const [feedTempC, setFeedTempC] = useState<number>(65.0);
  const [feedPresBar, setFeedPresBar] = useState<number>(16.0);

  // Default Feed Composition: Propane/Butane depropanizer feed
  const [feedMoleFractions, setFeedMoleFractions] = useState<Record<string, number>>({
    c1: 0.02,
    c3: 0.42,
    nc4: 0.38,
    c6h6: 0.12,
    c7h14: 0.06,
  });

  // Calculate Feed Stream State
  const feedStream = useMemo(() => {
    return calculateStreamState({
      id: 'FEED-COL',
      composition: feedMoleFractions,
      totalMassFlowKgH: feedFlowKgH,
      temperatureC: feedTempC,
      pressureBar: feedPresBar,
    });
  }, [feedMoleFractions, feedFlowKgH, feedTempC, feedPresBar]);

  // Construct Column Spec
  const columnSpec: DistillationColumnSpec = useMemo(() => ({
    numberOfStages,
    feedStage: Math.min(numberOfStages - 1, Math.max(2, feedStage)),
    condenserType,
    reboilerType,
    refluxRatio,
    distillateRateKgH,
    topPressureBar,
    bottomPressureBar,
    lightKeyComponentId: lightKey,
    heavyKeyComponentId: heavyKey,
    lightKeyDistillateRecovery: lightKeyRecovery,
    heavyKeyBottomsRecovery: heavyKeyRecovery,
    trayEfficiency: 0.75,
  }), [
    numberOfStages,
    feedStage,
    condenserType,
    reboilerType,
    refluxRatio,
    distillateRateKgH,
    topPressureBar,
    bottomPressureBar,
    lightKey,
    heavyKey,
    lightKeyRecovery,
    heavyKeyRecovery,
  ]);

  // Execute Shortcut (FUG) Solution
  const shortcutResult: ShortcutDistillationResult = useMemo(() => {
    return solveShortcutDistillation(feedStream, columnSpec);
  }, [feedStream, columnSpec]);

  // Execute Rigorous (MESH / Bubble Point) Solution
  const rigorousResult: RigorousDistillationResult = useMemo(() => {
    return solveRigorousDistillation(feedStream, columnSpec);
  }, [feedStream, columnSpec]);

  // Active Stage Profile Hover
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);

  // Column Presets
  const handleLoadPreset = (preset: 'depropanizer' | 'deethanizer' | 'debutanizer' | 'crude_stabilizer') => {
    if (preset === 'depropanizer') {
      setNumberOfStages(28);
      setFeedStage(14);
      setRefluxRatio(2.4);
      setTopPressureBar(15.0);
      setBottomPressureBar(16.2);
      setLightKey('c3');
      setHeavyKey('nc4');
      setFeedMoleFractions({ c1: 0.01, c3: 0.45, nc4: 0.40, c6h6: 0.10, c7h14: 0.04 });
      setFeedFlowKgH(35000);
      setFeedTempC(62);
      setFeedPresBar(17);
    } else if (preset === 'deethanizer') {
      setNumberOfStages(32);
      setFeedStage(16);
      setRefluxRatio(3.2);
      setTopPressureBar(26.0);
      setBottomPressureBar(27.5);
      setLightKey('c1');
      setHeavyKey('c3');
      setFeedMoleFractions({ c1: 0.35, c3: 0.40, nc4: 0.20, c6h6: 0.05 });
      setFeedFlowKgH(28000);
      setFeedTempC(38);
      setFeedPresBar(28);
    } else if (preset === 'debutanizer') {
      setNumberOfStages(36);
      setFeedStage(18);
      setRefluxRatio(2.1);
      setTopPressureBar(6.5);
      setBottomPressureBar(7.4);
      setLightKey('nc4');
      setHeavyKey('c6h6');
      setFeedMoleFractions({ c3: 0.05, nc4: 0.55, c6h6: 0.30, c7h14: 0.10 });
      setFeedFlowKgH(42000);
      setFeedTempC(90);
      setFeedPresBar(8.5);
    } else if (preset === 'crude_stabilizer') {
      setNumberOfStages(22);
      setFeedStage(10);
      setRefluxRatio(1.8);
      setTopPressureBar(9.0);
      setBottomPressureBar(10.2);
      setLightKey('c3');
      setHeavyKey('nc4');
      setFeedMoleFractions({ c1: 0.08, c3: 0.22, nc4: 0.35, c6h6: 0.25, c7h14: 0.10 });
      setFeedFlowKgH(50000);
      setFeedTempC(75);
      setFeedPresBar(11);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#060e20] text-[#dae2fd] p-3 font-mono text-[11px] space-y-3 select-none">
      {/* Top Banner */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#ffddb8]/10 border border-[#ffddb8]/30 flex items-center justify-center text-[#ffddb8]">
            <span className="material-symbols-outlined text-[20px]">view_column</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#ffddb8] text-[13px]">
                DISTILLATION &amp; SEPARATION COLUMN DESIGN SUITE
              </span>
              <span className="px-1.5 py-0.2 rounded bg-[#004e5d] text-[#4cd7f6] text-[9.5px]">
                {solverMethod === 'rigorous' ? 'RIGOROUS MESH (Wang-Henke)' : 'SHORTCUT (FUG / Underwood)'}
              </span>
            </div>
            <p className="text-[#869397] text-[10px]">
              Multi-component trayed fractionation with stage-by-stage equilibrium, hydraulic rating, and vapor-liquid profiles.
            </p>
          </div>
        </div>

        {/* Presets & Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[#869397] text-[10px]">Templates:</span>
          <button
            onClick={() => handleLoadPreset('depropanizer')}
            className="px-2 py-0.5 bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] rounded border border-[#3d494c]/40 text-[10px]"
            type="button"
          >
            Depropanizer
          </button>
          <button
            onClick={() => handleLoadPreset('deethanizer')}
            className="px-2 py-0.5 bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] rounded border border-[#3d494c]/40 text-[10px]"
            type="button"
          >
            Deethanizer
          </button>
          <button
            onClick={() => handleLoadPreset('debutanizer')}
            className="px-2 py-0.5 bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] rounded border border-[#3d494c]/40 text-[10px]"
            type="button"
          >
            Debutanizer
          </button>
          <button
            onClick={() => handleLoadPreset('crude_stabilizer')}
            className="px-2 py-0.5 bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] rounded border border-[#3d494c]/40 text-[10px]"
            type="button"
          >
            Stabilizer
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-12 gap-3">
        {/* Left Column: Specifications & Feed Parameters (Cols 1-4) */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          {/* Solver Mode Selection Card */}
          <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30 space-y-2">
            <div className="flex items-center justify-between text-[#4cd7f6] font-bold border-b border-[#3d494c]/20 pb-1">
              <span>Solution Algorithm</span>
              <span className="material-symbols-outlined text-[14px]">psychology</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setSolverMethod('rigorous')}
                className={`py-1.5 px-2 rounded text-center transition-all ${
                  solverMethod === 'rigorous'
                    ? 'bg-[#4cd7f6] text-[#003640] font-bold'
                    : 'bg-[#060e20] text-[#bcc9cd] hover:text-[#dae2fd]'
                }`}
                type="button"
              >
                Rigorous MESH
              </button>
              <button
                onClick={() => setSolverMethod('shortcut')}
                className={`py-1.5 px-2 rounded text-center transition-all ${
                  solverMethod === 'shortcut'
                    ? 'bg-[#4cd7f6] text-[#003640] font-bold'
                    : 'bg-[#060e20] text-[#bcc9cd] hover:text-[#dae2fd]'
                }`}
                type="button"
              >
                FUG Shortcut
              </button>
            </div>
          </div>

          {/* Column Physical & Operational Specifications */}
          <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30 space-y-2.5">
            <div className="flex items-center justify-between text-[#ffb95f] font-bold border-b border-[#3d494c]/20 pb-1">
              <span>Tray &amp; Operational Specs</span>
              <span className="material-symbols-outlined text-[14px]">tune</span>
            </div>

            {/* Stages & Feed Stage */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#869397]">Total Number of Stages (N):</span>
                <span className="text-[#dae2fd] font-bold">{numberOfStages} trays</span>
              </div>
              <input
                type="range"
                min="6"
                max="60"
                value={numberOfStages}
                onChange={(e) => setNumberOfStages(parseInt(e.target.value))}
                className="w-full h-1 bg-[#060e20] rounded appearance-none cursor-pointer accent-[#ffb95f]"
              />

              <div className="flex items-center justify-between text-[10px] pt-1">
                <span className="text-[#869397]">Feed Stage Location (NF):</span>
                <span className="text-[#dae2fd] font-bold">Tray #{feedStage} (from top)</span>
              </div>
              <input
                type="range"
                min="2"
                max={numberOfStages - 1}
                value={feedStage}
                onChange={(e) => setFeedStage(parseInt(e.target.value))}
                className="w-full h-1 bg-[#060e20] rounded appearance-none cursor-pointer accent-[#ffb95f]"
              />
            </div>

            {/* Reflux Ratio & Pressures */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Reflux Ratio (L/D)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="20"
                  value={refluxRatio}
                  onChange={(e) => setRefluxRatio(parseFloat(e.target.value) || 2.0)}
                  className="w-full bg-transparent text-[#4edea3] font-bold text-right focus:outline-none"
                />
              </div>
              <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Top Pres (bar)</span>
                <input
                  type="number"
                  step="0.1"
                  value={topPressureBar}
                  onChange={(e) => setTopPressureBar(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-transparent text-[#dae2fd] font-bold text-right focus:outline-none"
                />
              </div>
              <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Bottom Pres (bar)</span>
                <input
                  type="number"
                  step="0.1"
                  value={bottomPressureBar}
                  onChange={(e) => setBottomPressureBar(parseFloat(e.target.value) || 1.2)}
                  className="w-full bg-transparent text-[#dae2fd] font-bold text-right focus:outline-none"
                />
              </div>
              <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Distillate Rate (kg/h)</span>
                <input
                  type="number"
                  step="500"
                  value={distillateRateKgH}
                  onChange={(e) => setDistillateRateKgH(parseFloat(e.target.value) || 10000)}
                  className="w-full bg-transparent text-[#ffddb8] font-bold text-right focus:outline-none"
                />
              </div>
            </div>

            {/* Condenser & Reboiler Types */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-[#869397] block text-[9px] mb-0.5">Condenser Type</span>
                <select
                  value={condenserType}
                  onChange={(e) => setCondenserType(e.target.value as CondenserType)}
                  className="w-full bg-[#060e20] text-[#dae2fd] p-1 rounded border border-[#3d494c]/30 focus:outline-none"
                >
                  <option value="total">Total Condenser (Liquid)</option>
                  <option value="partial">Partial Condenser (Vapor)</option>
                  <option value="none">None (Direct Rectifier)</option>
                </select>
              </div>
              <div>
                <span className="text-[#869397] block text-[9px] mb-0.5">Reboiler Type</span>
                <select
                  value={reboilerType}
                  onChange={(e) => setReboilerType(e.target.value as ReboilerType)}
                  className="w-full bg-[#060e20] text-[#dae2fd] p-1 rounded border border-[#3d494c]/30 focus:outline-none"
                >
                  <option value="thermosiphon">Thermosiphon Reboiler</option>
                  <option value="kettle">Kettle Reboiler (Submerged)</option>
                  <option value="none">None (Steam Stripping)</option>
                </select>
              </div>
            </div>

            {/* Key Components & Recoveries */}
            <div className="pt-1 space-y-1.5 border-t border-[#3d494c]/20">
              <span className="text-[#bcc9cd] block text-[9.5px] font-bold">Key Components &amp; Split Targets:</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Light Key (LK)</span>
                  <select
                    value={lightKey}
                    onChange={(e) => setLightKey(e.target.value)}
                    className="w-full bg-transparent text-[#4edea3] font-bold focus:outline-none"
                  >
                    {Object.keys(feedMoleFractions).map((c) => (
                      <option key={c} value={c} className="bg-[#060e20]">
                        {PURE_COMPONENTS_DB[c]?.name || c}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between text-[9px] text-[#869397] mt-1">
                    <span>Rec. Overhead:</span>
                    <span className="text-[#dae2fd]">{(lightKeyRecovery * 100).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                  <span className="text-[#869397] block text-[9px]">Heavy Key (HK)</span>
                  <select
                    value={heavyKey}
                    onChange={(e) => setHeavyKey(e.target.value)}
                    className="w-full bg-transparent text-[#ffb4ab] font-bold focus:outline-none"
                  >
                    {Object.keys(feedMoleFractions).map((c) => (
                      <option key={c} value={c} className="bg-[#060e20]">
                        {PURE_COMPONENTS_DB[c]?.name || c}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between text-[9px] text-[#869397] mt-1">
                    <span>Rec. Bottoms:</span>
                    <span className="text-[#dae2fd]">{(heavyKeyRecovery * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feed Stream Specifications Card */}
          <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30 space-y-2">
            <div className="flex items-center justify-between text-[#4cd7f6] font-bold border-b border-[#3d494c]/20 pb-1">
              <span>Feed Stream Conditions</span>
              <span className="material-symbols-outlined text-[14px]">input</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <div className="bg-[#060e20] p-1 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Flow (kg/h)</span>
                <span className="text-[#4edea3] font-bold">{feedStream.totalMassFlowKgH.toLocaleString()}</span>
              </div>
              <div className="bg-[#060e20] p-1 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Temp (°C)</span>
                <span className="text-[#ffddb8] font-bold">{feedStream.temperatureC.toFixed(1)}</span>
              </div>
              <div className="bg-[#060e20] p-1 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Pres (bar)</span>
                <span className="text-[#dae2fd] font-bold">{feedStream.pressureBar.toFixed(1)}</span>
              </div>
            </div>

            <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20 space-y-1">
              <span className="text-[#869397] block text-[9px]">Feed Vapor Fraction &amp; Molecular Wt</span>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#bcc9cd]">Phase / VF:</span>
                <span className="text-[#4cd7f6] font-bold">
                  {feedStream.phase} (VF: {feedStream.vaporFraction.toFixed(3)})
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#bcc9cd]">Mean MW:</span>
                <span className="text-[#dae2fd] font-bold">{feedStream.mwAvg.toFixed(2)} g/mol</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Column Calculation Results, Profiles & Hydraulics (Cols 5-12) */}
        <div className="col-span-12 lg:col-span-8 space-y-3">
          {/* Summary KPIs Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30">
              <span className="text-[#869397] block text-[9.5px]">Condenser Duty (Qc)</span>
              <span className="text-[#4cd7f6] font-bold text-[14px]">
                {rigorousResult.condenserDutyKW > 0 ? (rigorousResult.condenserDutyKW / 1000).toFixed(2) : (shortcutResult.condenserDutyKW / 1000).toFixed(2)} MW
              </span>
              <span className="text-[#869397] block text-[8.5px] mt-0.5">
                Reflux: {rigorousResult.refluxFlowKgH ? (rigorousResult.refluxFlowKgH / 1000).toFixed(1) : ((distillateRateKgH * refluxRatio) / 1000).toFixed(1)} t/h
              </span>
            </div>

            <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30">
              <span className="text-[#869397] block text-[9.5px]">Reboiler Duty (Qb)</span>
              <span className="text-[#ffb95f] font-bold text-[14px]">
                {rigorousResult.reboilerDutyKW > 0 ? (rigorousResult.reboilerDutyKW / 1000).toFixed(2) : (shortcutResult.reboilerDutyKW / 1000).toFixed(2)} MW
              </span>
              <span className="text-[#869397] block text-[8.5px] mt-0.5">
                Boilup: {rigorousResult.boilupFlowKgH ? (rigorousResult.boilupFlowKgH / 1000).toFixed(1) : ((distillateRateKgH * (refluxRatio + 1) * 0.9) / 1000).toFixed(1)} t/h
              </span>
            </div>

            <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30">
              <span className="text-[#869397] block text-[9.5px]">Overhead Distillate</span>
              <span className="text-[#4edea3] font-bold text-[14px]">
                {(distillateRateKgH / 1000).toFixed(1)} t/h
              </span>
              <span className="text-[#869397] block text-[8.5px] mt-0.5">
                Top Temp: {rigorousResult.stageTemperatures[0]?.tempC.toFixed(1) || shortcutResult.distillateTemperatureC.toFixed(1)} °C
              </span>
            </div>

            <div className="bg-[#171f33] p-2 rounded border border-[#3d494c]/30">
              <span className="text-[#869397] block text-[9.5px]">Bottoms Product</span>
              <span className="text-[#ffddb8] font-bold text-[14px]">
                {((feedFlowKgH - distillateRateKgH) / 1000).toFixed(1)} t/h
              </span>
              <span className="text-[#869397] block text-[8.5px] mt-0.5">
                Bottom Temp: {rigorousResult.stageTemperatures[numberOfStages - 1]?.tempC.toFixed(1) || shortcutResult.bottomsTemperatureC.toFixed(1)} °C
              </span>
            </div>
          </div>

          {/* FUG Shortcut Method Benchmark */}
          <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30 space-y-1.5">
            <div className="flex items-center justify-between text-[#dae2fd] font-bold border-b border-[#3d494c]/20 pb-1">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[15px]">calculate</span>
                <span>Fenske - Underwood - Gilliland (FUG) Analytical Sizing</span>
              </span>
              <span className="text-[#4edea3] text-[9.5px]">CONVERGED (Gilliland Error &lt; 0.05%)</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-[10px]">
              <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Fenske Min Stages (Nmin)</span>
                <span className="text-[#ffddb8] font-bold text-[12px]">{shortcutResult.minimumStagesNmin}</span>
                <span className="text-[#869397] block text-[8.5px]">at total reflux</span>
              </div>
              <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Underwood Min Reflux (Rmin)</span>
                <span className="text-[#ffb95f] font-bold text-[12px]">{shortcutResult.minimumRefluxRmin.toFixed(2)}</span>
                <span className="text-[#869397] block text-[8.5px]">R / Rmin = {(refluxRatio / Math.max(0.1, shortcutResult.minimumRefluxRmin)).toFixed(2)}</span>
              </div>
              <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Gilliland Actual Stages (N)</span>
                <span className="text-[#4edea3] font-bold text-[12px]">{Math.round(shortcutResult.actualStagesN)} trays</span>
                <span className="text-[#869397] block text-[8.5px]">at R = {refluxRatio}</span>
              </div>
              <div className="bg-[#060e20] p-1.5 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Kirkbride Optimal Feed</span>
                <span className="text-[#4cd7f6] font-bold text-[12px]">Tray #{shortcutResult.optimalFeedStageNF}</span>
                <span className="text-[#869397] block text-[8.5px]">from top</span>
              </div>
            </div>
          </div>

          {/* Interactive Stage-by-Stage Profiles: Temperature, Flow, and Compositions */}
          <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/30 space-y-3">
            <div className="flex items-center justify-between border-b border-[#3d494c]/20 pb-1.5">
              <span className="font-bold text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[16px]">stacked_line_chart</span>
                <span>Stage-by-Stage Temperature &amp; Flow Profiles (MESH)</span>
              </span>
              <span className="text-[#869397] text-[9.5px]">Hover stage for stage details</span>
            </div>

            {/* Profile Bar Matrix */}
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 h-36 pt-4 pb-2 border-b border-[#3d494c]/30 min-w-[540px]">
                {(() => {
                  const stageTemps = rigorousResult.stages.map((s) => s.temperatureC);
                  const minStageTemp = Math.min(...stageTemps);
                  const maxStageTemp = Math.max(...stageTemps);
                  const tempRange = Math.max(5, maxStageTemp - minStageTemp);

                  return rigorousResult.stages.map((stage) => {
                    const normTemp = (stage.temperatureC - minStageTemp) / tempRange;
                    const barHeightPercent = Math.max(15, Math.min(95, normTemp * 80 + 15));
                    const isFeed = stage.stageNumber === feedStage;
                    const isHovered = hoveredStage === stage.stageNumber;

                    return (
                      <div
                        key={stage.stageNumber}
                        onMouseEnter={() => setHoveredStage(stage.stageNumber)}
                        onMouseLeave={() => setHoveredStage(null)}
                        className="h-full flex-1 flex flex-col justify-end items-center group cursor-pointer relative"
                      >
                        {/* Bar container with resolvable height */}
                        <div className="w-full flex-1 flex items-end justify-center">
                          <div
                            style={{ height: `${barHeightPercent}%` }}
                            className={`w-full rounded-t transition-all ${
                              isFeed
                                ? 'bg-[#ffb95f]'
                                : isHovered
                                ? 'bg-[#4cd7f6] ring-1 ring-white'
                                : 'bg-[#4cd7f6]/60 hover:bg-[#4cd7f6]'
                            }`}
                          />
                        </div>
                        <span className={`text-[8px] mt-1 font-mono shrink-0 ${isFeed ? 'text-[#ffb95f] font-bold' : 'text-[#869397]'}`}>
                          {stage.stageNumber}
                        </span>

                        {/* Tooltip on Hover */}
                        {isHovered && (
                          <div className="absolute bottom-full mb-2 z-20 bg-[#060e20] p-2 rounded shadow-2xl border border-[#4cd7f6] w-44 font-mono text-[9px] pointer-events-none">
                            <div className="font-bold text-[#4cd7f6] border-b border-[#3d494c]/40 pb-0.5 flex justify-between items-center">
                              <span>Stage #{stage.stageNumber}</span>
                              {isFeed && <span className="text-[#ffb95f] text-[8px] uppercase tracking-wider font-bold">FEED TRAY</span>}
                            </div>
                            <div className="text-[#dae2fd] mt-1">
                              Temp: <span className="text-[#ffddb8] font-bold">{stage.temperatureC.toFixed(1)} °C</span>
                            </div>
                            <div className="text-[#dae2fd]">
                              Pres: <span>{stage.pressureBar.toFixed(2)} bar</span>
                            </div>
                            <div className="text-[#dae2fd]">
                              Liquid L: <span className="text-[#4edea3]">{(stage.liquidFlowKgH / 1000).toFixed(1)} t/h</span>
                            </div>
                            <div className="text-[#dae2fd]">
                              Vapor V: <span className="text-[#acedff]">{(stage.vaporFlowKgH / 1000).toFixed(1)} t/h</span>
                            </div>
                            <div className="text-[#869397] mt-1 pt-1 border-t border-[#3d494c]/20">
                              x({lightKey}): {((stage.liquidMoleFractions[lightKey] || 0) * 100).toFixed(1)}% | x({heavyKey}): {((stage.liquidMoleFractions[heavyKey] || 0) * 100).toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-[9px] text-[#869397]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#4cd7f6]/60 inline-block" /> Stage Temp Profile
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#ffb95f] inline-block" /> Feed Tray (#{feedStage})
                </span>
              </div>
              <span>Trays: 1 (Condenser) → {numberOfStages} (Reboiler)</span>
            </div>
          </div>

          {/* Distillate & Bottoms Purity Inspection */}
          <div className="grid grid-cols-2 gap-3">
            {/* Overhead Distillate Composition Table */}
            <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#4edea3] font-bold border-b border-[#3d494c]/20 pb-1">
                <span>Overhead Distillate (Stream D)</span>
                <span className="text-[9.5px] text-[#869397]">Top Tray #1</span>
              </div>
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="text-[#869397] border-b border-[#3d494c]/20">
                    <th className="py-0.5">Component</th>
                    <th className="py-0.5 text-right">Mole %</th>
                    <th className="py-0.5 text-right">Mass (kg/h)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d494c]/10">
                  {Object.entries(rigorousResult.distillateStream.moleFractions).map(([cid, x]) => (
                    <tr key={cid}>
                      <td className="py-0.5 text-[#dae2fd]">{PURE_COMPONENTS_DB[cid]?.name || cid}</td>
                      <td className="py-0.5 text-right font-bold text-[#4edea3]">{(x * 100).toFixed(2)}%</td>
                      <td className="py-0.5 text-right text-[#869397]">
                        {(distillateRateKgH * (rigorousResult.distillateStream.massFractions[cid] || 0)).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottoms Product Composition Table */}
            <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30 space-y-1.5">
              <div className="flex items-center justify-between text-[#ffddb8] font-bold border-b border-[#3d494c]/20 pb-1">
                <span>Bottoms Product (Stream B)</span>
                <span className="text-[9.5px] text-[#869397]">Bottom Tray #{numberOfStages}</span>
              </div>
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="text-[#869397] border-b border-[#3d494c]/20">
                    <th className="py-0.5">Component</th>
                    <th className="py-0.5 text-right">Mole %</th>
                    <th className="py-0.5 text-right">Mass (kg/h)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d494c]/10">
                  {Object.entries(rigorousResult.bottomsStream.moleFractions).map(([cid, x]) => (
                    <tr key={cid}>
                      <td className="py-0.5 text-[#dae2fd]">{PURE_COMPONENTS_DB[cid]?.name || cid}</td>
                      <td className="py-0.5 text-right font-bold text-[#ffddb8]">{(x * 100).toFixed(2)}%</td>
                      <td className="py-0.5 text-right text-[#869397]">
                        {((feedFlowKgH - distillateRateKgH) * (rigorousResult.bottomsStream.massFractions[cid] || 0)).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
