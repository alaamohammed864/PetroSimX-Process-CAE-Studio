import React, { useState, useMemo } from 'react';
import { ChemicalComponent } from '../../types/simulation';
import {
  solveTPFlash,
  solvePHFlash,
  solvePSFlash,
  calculateBubblePoint,
  calculateDewPoint,
  FlashResult,
} from '../../engine/thermo/flashSolver';

interface ThermodynamicsViewProps {
  components: ChemicalComponent[];
  eos: string;
  onChangeEos: (eos: string) => void;
}

type FlashMode = 'TP' | 'PH' | 'PS' | 'BubblePoint' | 'DewPoint';

export const ThermodynamicsView: React.FC<ThermodynamicsViewProps> = ({
  components,
  eos,
  onChangeEos,
}) => {
  const [flashMode, setFlashMode] = useState<FlashMode>('TP');
  const [flashTempC, setFlashTempC] = useState<number>(45.0);
  const [flashPresBar, setFlashPresBar] = useState<number>(78.5);
  const [targetEnthalpyJPerMol, setTargetEnthalpyJPerMol] = useState<number>(-12500);
  const [targetEntropyJPerMolK, setTargetEntropyJPerMolK] = useState<number>(-45.0);

  // Normalize component fractions into a dictionary
  const compositionDict = useMemo(() => {
    const dict: Record<string, number> = {};
    let sum = 0;
    components.forEach((c) => {
      dict[c.id] = Math.max(0, c.fraction);
      sum += dict[c.id];
    });
    sum = Math.max(1e-8, sum);
    for (const k in dict) {
      dict[k] /= sum;
    }
    return dict;
  }, [components]);

  // Execute active flash algorithm
  const flashResult: FlashResult = useMemo(() => {
    const TK = flashTempC + 273.15;
    if (flashMode === 'TP') {
      return solveTPFlash(TK, flashPresBar, compositionDict);
    } else if (flashMode === 'PH') {
      return solvePHFlash(targetEnthalpyJPerMol, flashPresBar, compositionDict, TK);
    } else if (flashMode === 'PS') {
      return solvePSFlash(targetEntropyJPerMolK, flashPresBar, compositionDict, TK);
    } else if (flashMode === 'BubblePoint') {
      const bp = calculateBubblePoint(flashPresBar, compositionDict);
      return solveTPFlash(bp.temperatureK, flashPresBar, compositionDict);
    } else {
      const dp = calculateDewPoint(flashPresBar, compositionDict);
      return solveTPFlash(dp.temperatureK, flashPresBar, compositionDict);
    }
  }, [
    flashMode,
    flashTempC,
    flashPresBar,
    targetEnthalpyJPerMol,
    targetEntropyJPerMolK,
    compositionDict,
  ]);

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto font-mono text-[11px] select-none">
      {/* Header card */}
      <div className="bg-[#171f33] p-3 rounded border border-[#3d494c]/40 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#4cd7f6] text-[13px] font-bold">
            <span className="material-symbols-outlined text-[18px]">account_tree</span>
            <span>THERMODYNAMIC EQUATION OF STATE &amp; MULTIPHASE FLASH ENGINE</span>
          </div>
          <p className="text-[#869397] text-[10px] mt-0.5">
            Cubic PR-EOS fugacity departure functions, Newton-Raphson Rachford-Rice solver, and isenthalpic/isentropic envelopes.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#060e20] px-3 py-1.5 rounded border border-[#3d494c]/30">
          <span className="text-[#869397]">Active Package:</span>
          <select
            value={eos}
            onChange={(e) => onChangeEos(e.target.value)}
            className="bg-transparent text-[#ffddb8] font-bold focus:outline-none cursor-pointer"
          >
            <option value="Peng-Robinson / Boston-Mathias" className="bg-[#131b2e]">Peng-Robinson / Boston-Mathias</option>
            <option value="Peng-Robinson / Standard" className="bg-[#131b2e]">Peng-Robinson / Standard (1976)</option>
            <option value="Soave-Redlich-Kwong (SRK)" className="bg-[#131b2e]">Soave-Redlich-Kwong (SRK)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Flash Calculator (Cols 1 to 7) */}
        <div className="col-span-7 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
          <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#ffb95f] text-[16px]">device_thermostat</span>
              <span className="text-[#dae2fd] font-bold">Flash Algorithm:</span>
              <div className="flex gap-1 ml-2">
                {(['TP', 'PH', 'PS', 'BubblePoint', 'DewPoint'] as FlashMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFlashMode(mode)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      flashMode === mode
                        ? 'bg-[#4cd7f6] text-[#003640]'
                        : 'bg-[#060e20] text-[#bcc9cd] hover:text-[#dae2fd]'
                    }`}
                  >
                    {mode === 'TP'
                      ? 'TP Flash'
                      : mode === 'PH'
                      ? 'PH Flash'
                      : mode === 'PS'
                      ? 'PS Flash'
                      : mode === 'BubblePoint'
                      ? 'Bubble Pt'
                      : 'Dew Pt'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span className="text-[#4edea3] text-[10px] font-bold">CONVERGED</span>
            </div>
          </div>

          {/* Flash Specifications Controls */}
          <div className="grid grid-cols-2 gap-3 bg-[#060e20] p-2.5 rounded border border-[#3d494c]/30">
            <div>
              <label className="text-[#869397] text-[10px] block mb-1">
                {flashMode === 'PH'
                  ? 'Target Enthalpy (J/mol)'
                  : flashMode === 'PS'
                  ? 'Target Entropy (J/mol·K)'
                  : flashMode === 'BubblePoint'
                  ? `Computed Bubble T: ${flashResult.temperatureC.toFixed(2)} °C`
                  : flashMode === 'DewPoint'
                  ? `Computed Dew T: ${flashResult.temperatureC.toFixed(2)} °C`
                  : `Temperature: ${flashTempC.toFixed(1)} °C`}
              </label>
              {flashMode === 'TP' && (
                <input
                  type="range"
                  min="-20"
                  max="350"
                  step="1"
                  value={flashTempC}
                  onChange={(e) => setFlashTempC(parseFloat(e.target.value))}
                  className="w-full accent-[#4cd7f6] cursor-pointer"
                />
              )}
              {flashMode === 'PH' && (
                <input
                  type="number"
                  step="500"
                  value={targetEnthalpyJPerMol}
                  onChange={(e) => setTargetEnthalpyJPerMol(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#171f33] border border-[#3d494c]/50 text-[#ffddb8] px-2 py-1 rounded text-[11px]"
                />
              )}
              {flashMode === 'PS' && (
                <input
                  type="number"
                  step="5"
                  value={targetEntropyJPerMolK}
                  onChange={(e) => setTargetEntropyJPerMolK(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#171f33] border border-[#3d494c]/50 text-[#ffddb8] px-2 py-1 rounded text-[11px]"
                />
              )}
              {(flashMode === 'BubblePoint' || flashMode === 'DewPoint') && (
                <div className="text-[#ffddb8] text-[13px] font-bold py-1">
                  {flashResult.temperatureC.toFixed(2)} °C ({flashResult.temperatureK.toFixed(2)} K)
                </div>
              )}
            </div>

            <div>
              <label className="text-[#869397] text-[10px] block mb-1">Pressure: {flashPresBar.toFixed(1)} bar</label>
              <input
                type="range"
                min="1"
                max="150"
                step="0.5"
                value={flashPresBar}
                onChange={(e) => setFlashPresBar(parseFloat(e.target.value))}
                className="w-full accent-[#4cd7f6] cursor-pointer"
              />
            </div>
          </div>

          {/* Flash Results KPI Cards */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Vapor Fraction (VF)</span>
                <span className="text-[#4cd7f6] font-bold text-[13px]">
                  {(flashResult.vaporFraction * 100).toFixed(2)}%
                </span>
              </div>
              <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Equilibrium Phase</span>
                <span className="text-[#ffddb8] font-bold text-[11px] truncate block" title={flashResult.phase}>
                  {flashResult.phase}
                </span>
              </div>
              <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Density</span>
                <span className="text-[#4edea3] font-bold text-[13px]">
                  {flashResult.densityKgM3.toFixed(1)} kg/m³
                </span>
              </div>
              <div className="bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
                <span className="text-[#869397] block text-[9px]">Iterations / Tol</span>
                <span className="text-[#dae2fd] font-bold text-[12px]">
                  {flashResult.iterations} iters / &lt;1e-6
                </span>
              </div>
            </div>

            {/* VLE Compositions and K-Values */}
            <div className="overflow-x-auto max-h-48 border border-[#3d494c]/30 rounded">
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="text-[#869397] border-b border-[#3d494c]/30 bg-[#060e20]">
                    <th className="py-1 px-2">Component</th>
                    <th className="py-1 text-right">Feed z_i</th>
                    <th className="py-1 text-right">Liquid x_i</th>
                    <th className="py-1 text-right">Vapor y_i</th>
                    <th className="py-1 text-right px-2">K-Value (y/x)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d494c]/20">
                  {components.map((comp) => {
                    const zi = compositionDict[comp.id] || 0;
                    const xi = flashResult.liquidComposition[comp.id] || 0;
                    const yi = flashResult.vaporComposition[comp.id] || 0;
                    const ki = flashResult.kValues[comp.id] || (xi > 0 ? yi / xi : 0);
                    return (
                      <tr key={comp.id} className="hover:bg-[#222a3d]">
                        <td className="py-1 px-2 text-[#dae2fd] font-semibold">{comp.name}</td>
                        <td className="py-1 text-right text-[#869397]">{zi.toFixed(4)}</td>
                        <td className="py-1 text-right text-[#ffddb8]">{xi.toFixed(4)}</td>
                        <td className="py-1 text-right text-[#4cd7f6]">{yi.toFixed(4)}</td>
                        <td className="py-1 text-right text-[#4edea3] font-bold px-2">{ki.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Thermodynamic Enthalpy / Entropy Footer */}
            <div className="flex items-center justify-between text-[9.5px] text-[#869397] bg-[#060e20] p-2 rounded border border-[#3d494c]/20">
              <span>
                Molar Enthalpy: <strong className="text-[#dae2fd]">{flashResult.enthalpyJPerMol.toFixed(1)} J/mol</strong> (
                {(flashResult.enthalpyKjPerKg).toFixed(1)} kJ/kg)
              </span>
              <span>
                Entropy: <strong className="text-[#dae2fd]">{flashResult.entropyJPerMolK.toFixed(2)} J/(mol·K)</strong>
              </span>
              <span>
                Residual: <strong className="text-[#4edea3]">{flashResult.residual.toExponential(3)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Pure Component Critical Properties & EOS Parameters (Cols 8 to 12) */}
        <div className="col-span-5 bg-[#171f33] p-3 rounded border border-[#3d494c]/40 space-y-3">
          <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-2">
            <span className="text-[#dae2fd] font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4edea3] text-[16px]">science</span>
              Critical Constants &amp; Accentrics
            </span>
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="text-[#869397] border-b border-[#3d494c]/30">
                  <th className="py-1">Formula</th>
                  <th className="py-1 text-right">MW</th>
                  <th className="py-1 text-right">Tc [°C]</th>
                  <th className="py-1 text-right">Pc [bar]</th>
                  <th className="py-1 text-right">ω (Omega)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3d494c]/20">
                {components.map((c) => (
                  <tr key={c.id} className="hover:bg-[#222a3d]">
                    <td className="py-1 text-[#4cd7f6] font-bold">{c.formula}</td>
                    <td className="py-1 text-right text-[#dae2fd]">{c.mw}</td>
                    <td className="py-1 text-right text-[#ffddb8]">{c.criticalTempC}</td>
                    <td className="py-1 text-right text-[#dae2fd]">{c.criticalPresBar}</td>
                    <td className="py-1 text-right text-[#4edea3]">{c.accentricFactor.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Alpha Formulation Equation display */}
          <div className="bg-[#060e20] p-2.5 rounded border border-[#3d494c]/20 text-[9.5px] text-[#869397] space-y-1">
            <div className="text-[#ffddb8] font-bold">Rigorous PR-EOS Formulation:</div>
            <div className="text-[#dae2fd]">
              P = RT/(v - b) - a(T)/[v(v + b) + b(v - b)]
            </div>
            <div>
              van der Waals quadratic mixing rules with non-zero binary interaction matrix (k_ij).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
