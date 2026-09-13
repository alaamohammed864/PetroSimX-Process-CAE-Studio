import React, { useState, useMemo } from 'react';
import { EquipmentUnit, ProcessStream } from '../../types/simulation';
import { UtilityDefinition, EmissionFactorSpec } from '../../types/energy';
import { INITIAL_UTILITIES, DEFAULT_EMISSION_FACTORS } from '../../data/initialUtilities';
import { calculatePlantEnergyAndEmissions } from '../../engine/energy/energyEngine';
import { extractPinchStreams, runPinchAnalysis } from '../../engine/energy/pinchEngine';
import { EnergyDashboard } from '../energy/EnergyDashboard';
import { UtilitySystemPanel } from '../energy/UtilitySystemPanel';
import { EmissionsPanel } from '../energy/EmissionsPanel';
import { HeatIntegrationPanel } from '../energy/HeatIntegrationPanel';
import { EnergyReportingPanel } from '../energy/EnergyReportingPanel';

interface EnergyUtilitiesViewProps {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  onSelectUnit?: (unitId: string) => void;
}

type EnergySubTab = 'dashboard' | 'utilities' | 'pinch' | 'emissions' | 'reports';

export const EnergyUtilitiesView: React.FC<EnergyUtilitiesViewProps> = ({
  units,
  streams,
  onSelectUnit,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<EnergySubTab>('dashboard');
  const [utilities, setUtilities] = useState<UtilityDefinition[]>(INITIAL_UTILITIES);
  const [emissionFactors, setEmissionFactors] = useState<Record<string, EmissionFactorSpec>>(
    DEFAULT_EMISSION_FACTORS
  );
  const [ambientTempC, setAmbientTempC] = useState<number>(25);
  const [insulationCondition, setInsulationCondition] = useState<'Good' | 'Average' | 'Degraded'>('Good');
  const [deltaTmin] = useState<number>(10);

  // Calculate comprehensive energy & emissions balance
  const assessment = useMemo(() => {
    return calculatePlantEnergyAndEmissions(
      units,
      streams,
      utilities,
      emissionFactors,
      ambientTempC,
      insulationCondition
    );
  }, [units, streams, utilities, emissionFactors, ambientTempC, insulationCondition]);

  // Extract pinch streams & run analysis
  const pinchStreams = useMemo(() => {
    return extractPinchStreams(units, streams);
  }, [units, streams]);

  const pinchResult = useMemo(() => {
    return runPinchAnalysis(pinchStreams, deltaTmin);
  }, [pinchStreams, deltaTmin]);

  const handleUpdateUtility = (updated: UtilityDefinition) => {
    setUtilities((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const handleResetUtilities = () => {
    setUtilities(INITIAL_UTILITIES);
  };

  const handleUpdateEmissionFactor = (factor: EmissionFactorSpec) => {
    setEmissionFactors((prev) => ({
      ...prev,
      [factor.id]: factor,
    }));
  };

  const handleResetEmissionFactors = () => {
    setEmissionFactors(DEFAULT_EMISSION_FACTORS);
  };

  return (
    <div className="flex-1 bg-[#060e20] text-[#dae2fd] overflow-y-auto p-4 space-y-4">
      {/* Top Banner Ribbon */}
      <div className="bg-[#131b2e] border border-[#3d494c]/40 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#ffb95f]/20 border border-[#ffb95f]/40 flex items-center justify-center text-[#ffb95f]">
            <span className="material-symbols-outlined text-[22px]">energy_program_saving</span>
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-[#dae2fd] flex items-center gap-2">
              Plant Energy, Utilities & Carbon Emissions Engine
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/30">
                API 560 / ISO 50001 / GHG Scope 1-2
              </span>
            </h1>
            <p className="text-xs text-[#869397] mt-0.5">
              Rigorous thermo-mechanical energy balance, utility supply tariffs, pinch heat recovery analysis, and emissions reporting.
            </p>
          </div>
        </div>

        {/* Global Key Quick Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <div className="text-[10px] text-[#869397] uppercase">Primary Energy</div>
            <div className="font-bold text-[#ffddb8] text-sm">{assessment.summary.totalPrimaryEnergyMW} MW</div>
          </div>
          <div className="w-px h-7 bg-[#3d494c]/40" />
          <div className="text-right">
            <div className="text-[10px] text-[#869397] uppercase">Hourly OpEx</div>
            <div className="font-bold text-[#4edea3] text-sm">${assessment.summary.hourlyEnergyCost}/h</div>
          </div>
          <div className="w-px h-7 bg-[#3d494c]/40" />
          <div className="text-right">
            <div className="text-[10px] text-[#869397] uppercase">CO₂ Rate</div>
            <div className="font-bold text-[#ff8077] text-sm">
              {assessment.emissions.co2RateKgH.toLocaleString()} kg/h
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Ribbon */}
      <div className="flex items-center gap-1 border-b border-[#3d494c]/30 text-xs font-medium pb-1">
        {[
          { id: 'dashboard', label: 'Energy Dashboard & Balance', icon: 'dashboard' },
          { id: 'utilities', label: 'Utility System & Tariffs', icon: 'factory' },
          { id: 'pinch', label: 'Pinch Heat Integration (MER)', icon: 'schema' },
          { id: 'emissions', label: 'Emissions Framework (CO₂/CO/NOₓ/SOₓ)', icon: 'co2' },
          { id: 'reports', label: 'Reports & Export Dossier', icon: 'description' },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as EnergySubTab)}
              className={`px-3 py-2 rounded-t font-sans transition-all flex items-center gap-1.5 text-xs ${
                isActive
                  ? 'bg-[#171f33] text-[#4cd7f6] border-b-2 border-[#4cd7f6] font-semibold'
                  : 'text-[#bcc9cd] hover:bg-[#131b2e] hover:text-[#dae2fd]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-View Renderers */}
      {activeSubTab === 'dashboard' && (
        <EnergyDashboard
          assessment={assessment}
          onSelectUnit={onSelectUnit}
          ambientTempC={ambientTempC}
          onChangeAmbientTemp={setAmbientTempC}
          insulationCondition={insulationCondition}
          onChangeInsulation={setInsulationCondition}
        />
      )}

      {activeSubTab === 'utilities' && (
        <UtilitySystemPanel
          utilities={assessment.utilities}
          onUpdateUtility={handleUpdateUtility}
          onResetUtilities={handleResetUtilities}
        />
      )}

      {activeSubTab === 'pinch' && (
        <HeatIntegrationPanel streams={pinchStreams} initialDeltaTmin={deltaTmin} />
      )}

      {activeSubTab === 'emissions' && (
        <EmissionsPanel
          emissions={assessment.emissions}
          onUpdateEmissionFactor={handleUpdateEmissionFactor}
          onResetEmissionFactors={handleResetEmissionFactors}
        />
      )}

      {activeSubTab === 'reports' && (
        <EnergyReportingPanel assessment={assessment} pinchResult={pinchResult} />
      )}
    </div>
  );
};
