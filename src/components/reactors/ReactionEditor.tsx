import React, { useState } from 'react';
import { ReactionDefinition, ReactionPhase, KineticModelType } from '../../engine/reactors/reactionTypes';
import { DEFAULT_REACTIONS_DB } from '../../engine/reactors/defaultReactions';
import { PURE_COMPONENTS_DB } from '../../engine/thermo/thermoConstants';

interface ReactionEditorProps {
  onApplyReaction?: (reaction: ReactionDefinition) => void;
}

export const ReactionEditor: React.FC<ReactionEditorProps> = ({ onApplyReaction }) => {
  const [reactionsList, setReactionsList] = useState<ReactionDefinition[]>(() =>
    Object.values(DEFAULT_REACTIONS_DB)
  );
  const [selectedReactionId, setSelectedReactionId] = useState<string>(reactionsList[0]?.id || 'toluene_hda');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Active Reaction in Editor
  const activeReaction = reactionsList.find((r) => r.id === selectedReactionId) || reactionsList[0];

  // Editable Form State
  const [name, setName] = useState<string>(activeReaction?.name || '');
  const [equation, setEquation] = useState<string>(activeReaction?.equation || '');
  const [phase, setPhase] = useState<ReactionPhase>(activeReaction?.phase || 'Gas');
  const [kineticModel, setKineticModel] = useState<KineticModelType>(activeReaction?.kineticModel || 'Arrhenius');
  const [isReversible, setIsReversible] = useState<boolean>(activeReaction?.isReversible || false);
  const [preExpA, setPreExpA] = useState<number>(activeReaction?.preExponentialFactorA || 1.0e6);
  const [activationEnergy, setActivationEnergy] = useState<number>(activeReaction?.activationEnergyKJPerMol || 120.0);
  const [tempExponent, setTempExponent] = useState<number>(activeReaction?.temperatureExponentN || 0);
  const [heatOfReaction, setHeatOfReaction] = useState<number>(activeReaction?.heatOfReaction298KJPerMol || -50.0);
  
  // Reverse Parameters
  const [reversePreExpA, setReversePreExpA] = useState<number>(activeReaction?.reversePreExponentialFactorA || 5.0e4);
  const [reverseActivationEnergy, setReverseActivationEnergy] = useState<number>(activeReaction?.reverseActivationEnergyKJPerMol || 170.0);

  // Catalyst State
  const [catalystType, setCatalystType] = useState<string>(activeReaction?.catalyst?.type || 'Pt/Al2O3 Bifunctional');
  const [catalystLoading, setCatalystLoading] = useState<number>(activeReaction?.catalyst?.loadingKgM3 || 450.0);
  const [catalystActivity, setCatalystActivity] = useState<number>(activeReaction?.catalyst?.activityFactor || 1.0);

  // Reactants & Products
  const [reactants, setReactants] = useState(activeReaction?.reactants || [
    { componentId: 'c7h8', stoichiometricCoeff: -1, order: 1 },
    { componentId: 'h2', stoichiometricCoeff: -1, order: 0.5 },
  ]);
  const [products, setProducts] = useState(activeReaction?.products || [
    { componentId: 'c6h6', stoichiometricCoeff: 1, order: 0 },
    { componentId: 'c1', stoichiometricCoeff: 1, order: 0 },
  ]);

  // Test Condition for Rate Evaluation
  const [evalTempC, setEvalTempC] = useState<number>(480);
  const [evalPresBar, setEvalPresBar] = useState<number>(35);

  // Compute Current Rate Constant k(T) = A * (T_K)^n * exp(-Ea / (R * T_K))
  const R_GAS = 8.314462618e-3; // kJ/(mol·K)
  const evalTempK = evalTempC + 273.15;
  const kForward = preExpA * Math.pow(evalTempK, tempExponent) * Math.exp(-activationEnergy / (R_GAS * evalTempK));
  const kReverse = isReversible
    ? reversePreExpA * Math.exp(-reverseActivationEnergy / (R_GAS * evalTempK))
    : 0;

  // Sync Form when selecting a different reaction
  const handleSelectReaction = (rx: ReactionDefinition) => {
    setSelectedReactionId(rx.id);
    setName(rx.name);
    setEquation(rx.equation);
    setPhase(rx.phase);
    setKineticModel(rx.kineticModel);
    setIsReversible(rx.isReversible);
    setPreExpA(rx.preExponentialFactorA);
    setActivationEnergy(rx.activationEnergyKJPerMol);
    setTempExponent(rx.temperatureExponentN || 0);
    setHeatOfReaction(rx.heatOfReaction298KJPerMol);
    setReversePreExpA(rx.reversePreExponentialFactorA || 1.0e4);
    setReverseActivationEnergy(rx.reverseActivationEnergyKJPerMol || 150.0);
    setCatalystType(rx.catalyst?.type || 'Generic Solid Catalyst');
    setCatalystLoading(rx.catalyst?.loadingKgM3 || 500);
    setCatalystActivity(rx.catalyst?.activityFactor || 1.0);
    setReactants(rx.reactants);
    setProducts(rx.products);
    setIsCreatingNew(false);
  };

  const handleSaveCurrent = () => {
    const updated: ReactionDefinition = {
      id: isCreatingNew ? `custom_rx_${Date.now()}` : selectedReactionId,
      name,
      equation,
      phase,
      kineticModel,
      isReversible,
      preExponentialFactorA: preExpA,
      activationEnergyKJPerMol: activationEnergy,
      temperatureExponentN: tempExponent,
      heatOfReaction298KJPerMol: heatOfReaction,
      reversePreExponentialFactorA: isReversible ? reversePreExpA : undefined,
      reverseActivationEnergyKJPerMol: isReversible ? reverseActivationEnergy : undefined,
      reactants,
      products,
      catalyst: {
        type: catalystType,
        loadingKgM3: catalystLoading,
        activityFactor: catalystActivity,
      },
    };

    setReactionsList((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });

    setSelectedReactionId(updated.id);
    setIsCreatingNew(false);
    if (onApplyReaction) onApplyReaction(updated);
  };

  const handleAddNewReaction = () => {
    setIsCreatingNew(true);
    setName('New Catalytic Reaction');
    setEquation('A + B -> C');
    setPhase('Gas');
    setKineticModel('Arrhenius');
    setIsReversible(false);
    setPreExpA(1.5e7);
    setActivationEnergy(135.0);
    setTempExponent(0);
    setHeatOfReaction(-65.0);
    setReactants([
      { componentId: 'c7h8', stoichiometricCoeff: -1, order: 1 },
      { componentId: 'h2', stoichiometricCoeff: -1, order: 1 },
    ]);
    setProducts([{ componentId: 'c6h6', stoichiometricCoeff: 1, order: 0 }]);
  };

  return (
    <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3 font-mono text-[11px]">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-2">
        <div className="flex items-center gap-2 text-[#4edea3] font-bold text-[12px]">
          <span className="material-symbols-outlined text-[18px]">science</span>
          <span>REACTION KINETICS &amp; CATALYST EDITOR</span>
        </div>
        <button
          onClick={handleAddNewReaction}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#4cd7f6] text-[#003640] rounded font-bold hover:opacity-90 transition-all text-[10.5px]"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">add_circle</span>
          <span>NEW REACTION</span>
        </button>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Reaction Directory (Cols 1-4) */}
        <div className="col-span-12 md:col-span-4 space-y-2">
          <span className="text-[#869397] block text-[9.5px] uppercase">Reaction Library ({reactionsList.length})</span>
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {reactionsList.map((rx) => {
              const isSelected = rx.id === selectedReactionId;
              return (
                <div
                  key={rx.id}
                  onClick={() => handleSelectReaction(rx)}
                  className={`p-2 rounded border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#222a3d] border-[#4cd7f6] text-[#4cd7f6]'
                      : 'bg-[#060e20] border-[#3d494c]/30 text-[#bcc9cd] hover:border-[#4cd7f6]/60'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <span className="truncate">{rx.name}</span>
                    <span className={`text-[9px] px-1 py-0.2 rounded ${rx.isReversible ? 'bg-[#ffb95f]/20 text-[#ffb95f]' : 'bg-[#4edea3]/20 text-[#4edea3]'}`}>
                      {rx.isReversible ? 'REV' : 'IRREV'}
                    </span>
                  </div>
                  <div className="text-[#dae2fd] text-[10px] mt-0.5 truncate">{rx.equation}</div>
                  <div className="flex items-center justify-between text-[#869397] text-[8.5px] mt-1">
                    <span>Ea: {rx.activationEnergyKJPerMol} kJ/mol</span>
                    <span>ΔH: {rx.heatOfReaction298KJPerMol} kJ/mol</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reaction Parameter Editor (Cols 5-12) */}
        <div className="col-span-12 md:col-span-8 space-y-3 bg-[#060e20] p-3 rounded border border-[#3d494c]/30">
          {/* Reaction Header Information */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[#869397] block text-[9px] mb-0.5">Reaction Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#171f33] text-[#dae2fd] p-1.5 rounded border border-[#3d494c]/30 font-bold focus:outline-none focus:border-[#4cd7f6]"
              />
            </div>
            <div>
              <span className="text-[#869397] block text-[9px] mb-0.5">Chemical Stoichiometric Equation</span>
              <input
                type="text"
                value={equation}
                onChange={(e) => setEquation(e.target.value)}
                className="w-full bg-[#171f33] text-[#4cd7f6] p-1.5 rounded border border-[#3d494c]/30 font-bold focus:outline-none focus:border-[#4cd7f6]"
              />
            </div>
          </div>

          {/* Phase, Mechanism & Reversibility */}
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="text-[#869397] block text-[9px] mb-0.5">Reaction Phase</span>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as ReactionPhase)}
                className="w-full bg-[#171f33] text-[#dae2fd] p-1.5 rounded border border-[#3d494c]/30 focus:outline-none"
              >
                <option value="Gas">Gas Phase</option>
                <option value="Liquid">Liquid Phase</option>
                <option value="Multiphase">Multiphase (Trickle-Bed)</option>
              </select>
            </div>
            <div>
              <span className="text-[#869397] block text-[9px] mb-0.5">Kinetic Rate Law</span>
              <select
                value={kineticModel}
                onChange={(e) => setKineticModel(e.target.value as KineticModelType)}
                className="w-full bg-[#171f33] text-[#dae2fd] p-1.5 rounded border border-[#3d494c]/30 focus:outline-none"
              >
                <option value="Arrhenius">Arrhenius Power-Law</option>
                <option value="Equilibrium">Thermodynamic Equilibrium (ln Keq)</option>
                <option value="ConversionBased">Fixed Conversion %</option>
                <option value="Custom">Langmuir-Hinshelwood / LHHW</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer bg-[#171f33] p-1.5 rounded border border-[#3d494c]/30">
                <input
                  type="checkbox"
                  checked={isReversible}
                  onChange={(e) => setIsReversible(e.target.checked)}
                  className="accent-[#4cd7f6]"
                />
                <span className="text-[#dae2fd] font-bold">Reversible (⇄)</span>
              </label>
            </div>
          </div>

          {/* Arrhenius Kinetic Parameters */}
          <div className="p-2.5 bg-[#171f33] rounded border border-[#3d494c]/30 space-y-2">
            <span className="text-[#ffb95f] font-bold block text-[10.5px]">
              Forward Arrhenius Parameters: k_f(T) = A · T^n · exp(-Ea / RT)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[#869397] block text-[9px]">Pre-exponential Factor A</span>
                <input
                  type="number"
                  step="any"
                  value={preExpA}
                  onChange={(e) => setPreExpA(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-[#060e20] text-[#dae2fd] p-1 rounded border border-[#3d494c]/30 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[#869397] block text-[9px]">Activation Energy Ea (kJ/mol)</span>
                <input
                  type="number"
                  step="1"
                  value={activationEnergy}
                  onChange={(e) => setActivationEnergy(parseFloat(e.target.value) || 100)}
                  className="w-full bg-[#060e20] text-[#dae2fd] p-1 rounded border border-[#3d494c]/30 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[#869397] block text-[9px]">Temp Exponent n</span>
                <input
                  type="number"
                  step="0.1"
                  value={tempExponent}
                  onChange={(e) => setTempExponent(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#060e20] text-[#dae2fd] p-1 rounded border border-[#3d494c]/30 focus:outline-none"
                />
              </div>
            </div>

            {/* Reverse Kinetics if Reversible */}
            {isReversible && (
              <div className="pt-2 border-t border-[#3d494c]/20 space-y-1">
                <span className="text-[#ffddb8] font-bold block text-[10px]">
                  Reverse Arrhenius Parameters: k_r(T) = A_rev · exp(-Ea_rev / RT)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#869397] block text-[9px]">Reverse A_rev</span>
                    <input
                      type="number"
                      step="any"
                      value={reversePreExpA}
                      onChange={(e) => setReversePreExpA(parseFloat(e.target.value) || 1.0)}
                      className="w-full bg-[#060e20] text-[#dae2fd] p-1 rounded border border-[#3d494c]/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[#869397] block text-[9px]">Reverse Ea_rev (kJ/mol)</span>
                    <input
                      type="number"
                      step="1"
                      value={reverseActivationEnergy}
                      onChange={(e) => setReverseActivationEnergy(parseFloat(e.target.value) || 150)}
                      className="w-full bg-[#060e20] text-[#dae2fd] p-1 rounded border border-[#3d494c]/30 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Enthalpy & Catalyst Information */}
          <div className="grid grid-cols-2 gap-2">
            {/* Heat of Reaction */}
            <div className="p-2 bg-[#171f33] rounded border border-[#3d494c]/30 space-y-1">
              <span className="text-[#869397] block text-[9px]">Heat of Reaction ΔH_rx,298 (kJ/mol)</span>
              <input
                type="number"
                step="0.1"
                value={heatOfReaction}
                onChange={(e) => setHeatOfReaction(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#060e20] text-[#ffddb8] font-bold p-1 rounded border border-[#3d494c]/30 focus:outline-none"
              />
              <span className={`text-[9px] block ${heatOfReaction < 0 ? 'text-[#ffb95f]' : 'text-[#4edea3]'}`}>
                {heatOfReaction < 0 ? 'Exothermic (releases heat)' : 'Endothermic (absorbs heat)'}
              </span>
            </div>

            {/* Catalyst Info */}
            <div className="p-2 bg-[#171f33] rounded border border-[#3d494c]/30 space-y-1">
              <span className="text-[#869397] block text-[9px]">Catalyst Package &amp; Loading</span>
              <input
                type="text"
                value={catalystType}
                onChange={(e) => setCatalystType(e.target.value)}
                placeholder="e.g. CoMo / Al2O3"
                className="w-full bg-[#060e20] text-[#4cd7f6] p-1 rounded border border-[#3d494c]/30 focus:outline-none text-[10px]"
              />
              <div className="grid grid-cols-2 gap-1 pt-1 text-[9px]">
                <div>
                  <span className="text-[#869397]">Loading (kg/m³):</span>
                  <input
                    type="number"
                    value={catalystLoading}
                    onChange={(e) => setCatalystLoading(parseFloat(e.target.value) || 500)}
                    className="w-full bg-[#060e20] text-[#dae2fd] px-1 rounded border border-[#3d494c]/30"
                  />
                </div>
                <div>
                  <span className="text-[#869397]">Activity Factor:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={catalystActivity}
                    onChange={(e) => setCatalystActivity(parseFloat(e.target.value) || 1.0)}
                    className="w-full bg-[#060e20] text-[#dae2fd] px-1 rounded border border-[#3d494c]/30"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Rate Evaluation Sandbox */}
          <div className="p-2 bg-[#171f33] rounded border border-[#3d494c]/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#869397] text-[9.5px]">Test at T =</span>
              <input
                type="number"
                value={evalTempC}
                onChange={(e) => setEvalTempC(parseFloat(e.target.value) || 500)}
                className="w-14 bg-[#060e20] text-[#ffddb8] px-1 py-0.5 rounded border border-[#3d494c]/30 text-center"
              />
              <span className="text-[#869397] text-[9.5px]">°C | P =</span>
              <input
                type="number"
                value={evalPresBar}
                onChange={(e) => setEvalPresBar(parseFloat(e.target.value) || 30)}
                className="w-14 bg-[#060e20] text-[#dae2fd] px-1 py-0.5 rounded border border-[#3d494c]/30 text-center"
              />
              <span className="text-[#869397] text-[9.5px]">bar</span>
            </div>

            <div className="text-right">
              <span className="text-[#869397] block text-[9px]">Forward k_f(T):</span>
              <span className="text-[#4edea3] font-bold">{kForward.toExponential(3)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#3d494c]/20">
            <button
              onClick={handleSaveCurrent}
              className="px-4 py-1.5 bg-[#4edea3] text-[#003640] rounded font-bold hover:opacity-90 transition-all flex items-center gap-1.5 text-[11px]"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">check_circle</span>
              <span>APPLY REACTION TO SIMULATOR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
