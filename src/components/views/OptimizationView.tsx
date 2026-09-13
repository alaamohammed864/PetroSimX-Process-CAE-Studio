import React, { useState } from 'react';
import { EquipmentUnit, ProcessStream, ChemicalComponent, UnitSystem } from '../../types/simulation';
import { DecisionVariable, ProcessCase } from '../../types/optimization';
import { SensitivityAnalysisPanel } from '../optimization/SensitivityAnalysisPanel';
import { OptimizationPanel } from '../optimization/OptimizationPanel';
import { CaseManagementPanel } from '../optimization/CaseManagementPanel';

interface OptimizationViewProps {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  components: ChemicalComponent[];
  unitSystem: UnitSystem;
  onApplyOptimalValuesToFlowsheet?: (variables: DecisionVariable[]) => void;
  onApplyCaseToFlowsheet?: (caseItem: ProcessCase) => void;
}

export const OptimizationView: React.FC<OptimizationViewProps> = ({
  units,
  streams,
  components,
  unitSystem,
  onApplyOptimalValuesToFlowsheet,
  onApplyCaseToFlowsheet,
}) => {
  const [activeTab, setActiveTab] = useState<'optimization' | 'sensitivity' | 'cases'>('optimization');

  const handleApplyOptimalValues = (vars: DecisionVariable[]) => {
    if (onApplyOptimalValuesToFlowsheet) {
      onApplyOptimalValuesToFlowsheet(vars);
    }
  };

  const handleApplyCase = (c: ProcessCase) => {
    if (onApplyCaseToFlowsheet) {
      onApplyCaseToFlowsheet(c);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto font-mono text-[11px] select-none">
      {/* Sub-Navigation Ribbon */}
      <div className="flex bg-[#131b2e] p-1 rounded border border-[#3d494c]/30 gap-1 text-[11px]">
        <button
          onClick={() => setActiveTab('optimization')}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'optimization'
              ? 'bg-[#222a3d] text-[#4cd7f6] font-bold border border-[#4cd7f6]/40 shadow-sm'
              : 'text-[#bcc9cd] hover:text-[#dae2fd]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">tune</span>
          <span>Process Optimization &amp; Solvers</span>
        </button>

        <button
          onClick={() => setActiveTab('sensitivity')}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'sensitivity'
              ? 'bg-[#222a3d] text-[#4edea3] font-bold border border-[#4edea3]/40 shadow-sm'
              : 'text-[#bcc9cd] hover:text-[#dae2fd]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">show_chart</span>
          <span>Sensitivity Analysis &amp; Curves</span>
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`flex-1 py-1.5 px-3 rounded text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'cases'
              ? 'bg-[#222a3d] text-[#ffb95f] font-bold border border-[#ffb95f]/40 shadow-sm'
              : 'text-[#bcc9cd] hover:text-[#dae2fd]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[15px]">folder_copy</span>
          <span>Case Study Scenarios &amp; Matrix</span>
        </button>
      </div>

      {/* Tab 1: Optimization Framework */}
      {activeTab === 'optimization' && (
        <OptimizationPanel
          units={units}
          streams={streams}
          components={components}
          unitSystem={unitSystem}
          onApplyOptimalValuesToFlowsheet={handleApplyOptimalValues}
        />
      )}

      {/* Tab 2: Sensitivity Analysis */}
      {activeTab === 'sensitivity' && (
        <SensitivityAnalysisPanel
          units={units}
          streams={streams}
          components={components}
          unitSystem={unitSystem}
        />
      )}

      {/* Tab 3: Case Management */}
      {activeTab === 'cases' && (
        <CaseManagementPanel
          units={units}
          streams={streams}
          unitSystem={unitSystem}
          onApplyCaseToFlowsheet={handleApplyCase}
        />
      )}
    </div>
  );
};
