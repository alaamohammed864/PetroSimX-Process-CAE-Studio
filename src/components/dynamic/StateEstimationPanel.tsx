import React, { useState } from 'react';
import { StateEstimationResult, DynamicProcessVariable } from '../../types/dynamic';

interface StateEstimationPanelProps {
  estimates: Record<string, StateEstimationResult>;
  variables: Record<string, DynamicProcessVariable>;
}

export const StateEstimationPanel: React.FC<StateEstimationPanelProps> = ({
  estimates,
  variables,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'HEALTHY' | 'ANOMALIES'>('ALL');

  const estimateList: StateEstimationResult[] = Object.values(estimates);

  const filteredList = estimateList.filter((est) => {
    if (filter === 'HEALTHY') return est.healthStatus === 'HEALTHY';
    if (filter === 'ANOMALIES') return est.healthStatus !== 'HEALTHY';
    return true;
  });

  const getStatusBadge = (status: StateEstimationResult['healthStatus']) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="px-2 py-0.5 rounded bg-[#1bbd85]/20 text-[#4edea3] font-bold text-[10.5px]">
            HEALTHY
          </span>
        );
      case 'DRIFT_DETECTED':
        return (
          <span className="px-2 py-0.5 rounded bg-[#ffb95f]/20 text-[#ffddb8] font-bold text-[10.5px] animate-pulse">
            DRIFT DETECTED
          </span>
        );
      case 'SENSOR_SUSPECT':
        return (
          <span className="px-2 py-0.5 rounded bg-[#ff5449]/20 text-[#ff8077] font-bold text-[10.5px]">
            SENSOR SUSPECT
          </span>
        );
      case 'MODEL_MISMATCH':
        return (
          <span className="px-2 py-0.5 rounded bg-[#ff8077]/20 text-[#ff8077] font-bold text-[10.5px]">
            MODEL MISMATCH
          </span>
        );
    }
  };

  return (
    <div className="bg-[#131b2e] border border-[#3d494c]/30 rounded p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#3d494c]/30">
        <div>
          <h3 className="text-sm font-bold text-[#dae2fd] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-base">psychology</span>
            Digital Twin State Estimator &amp; Sensor Reconciliation
          </h3>
          <p className="text-xs text-[#869397] mt-0.5">
            Continuously compares incoming telemetry measurements with first-principles dynamic model states to detect instrumentation drift and process fouling.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex rounded bg-[#0b1326] p-0.5 border border-[#3d494c]/40 text-xs font-mono">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filter === 'ALL'
                ? 'bg-[#171f33] text-[#4cd7f6] font-bold'
                : 'text-[#869397] hover:text-[#dae2fd]'
            }`}
          >
            All ({estimateList.length})
          </button>
          <button
            onClick={() => setFilter('HEALTHY')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filter === 'HEALTHY'
                ? 'bg-[#171f33] text-[#4edea3] font-bold'
                : 'text-[#869397] hover:text-[#dae2fd]'
            }`}
          >
            Healthy
          </button>
          <button
            onClick={() => setFilter('ANOMALIES')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filter === 'ANOMALIES'
                ? 'bg-[#171f33] text-[#ff8077] font-bold'
                : 'text-[#869397] hover:text-[#dae2fd]'
            }`}
          >
            Anomalies
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
          <div className="text-[10px] text-[#869397] uppercase">Reconciled Tags</div>
          <div className="text-base font-bold text-[#dae2fd] mt-0.5">{estimateList.length} Process Points</div>
          <div className="text-[9.5px] text-[#869397]">Active Kalman Observer</div>
        </div>

        <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
          <div className="text-[10px] text-[#869397] uppercase">Average Model Confidence</div>
          <div className="text-base font-bold text-[#4edea3] mt-0.5">
            {(
              (estimateList.reduce((acc, e) => acc + e.confidenceScore, 0) /
                Math.max(1, estimateList.length)) *
              100
            ).toFixed(1)}%
          </div>
          <div className="text-[9.5px] text-[#869397]">State covariance bound &lt; 0.05</div>
        </div>

        <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
          <div className="text-[10px] text-[#869397] uppercase">Max Innovation Residual</div>
          <div className="text-base font-bold text-[#ffddb8] mt-0.5">
            {Math.max(...estimateList.map((e) => e.residualInnovation)).toFixed(3)}
          </div>
          <div className="text-[9.5px] text-[#869397]">|Measured - Predicted|</div>
        </div>

        <div className="bg-[#171f33] p-2.5 rounded border border-[#3d494c]/30">
          <div className="text-[10px] text-[#869397] uppercase">Integrity Status</div>
          <div className="text-base font-bold text-[#4cd7f6] mt-0.5">
            {estimateList.every((e) => e.healthStatus === 'HEALTHY') ? 'NORMAL' : 'MONITORING'}
          </div>
          <div className="text-[9.5px] text-[#869397]">ISO 13374 Condition Health</div>
        </div>
      </div>

      {/* State Estimation Table */}
      <div className="overflow-x-auto border border-[#3d494c]/30 rounded">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#171f33] text-[#869397] text-[10px] uppercase border-b border-[#3d494c]/30">
            <tr>
              <th className="p-2.5">Tag &amp; Description</th>
              <th className="p-2.5 text-right">Raw Measured (y)</th>
              <th className="p-2.5 text-right">Model ODE (x̂)</th>
              <th className="p-2.5 text-right">Reconciled (x*)</th>
              <th className="p-2.5 text-right">Residual (Δ)</th>
              <th className="p-2.5 text-center">Confidence</th>
              <th className="p-2.5 text-center">Diagnostic Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3d494c]/20 bg-[#0b1326]">
            {filteredList.map((est) => {
              const v = variables[est.tag];
              const unit = v ? v.unit : '';
              return (
                <tr key={est.tag} className="hover:bg-[#171f33]/50 transition-colors">
                  <td className="p-2.5">
                    <span className="font-bold text-[#4cd7f6]">{est.tag}</span>
                    <span className="text-[11px] text-[#869397] ml-2">{v ? v.name : ''}</span>
                  </td>
                  <td className="p-2.5 text-right font-bold text-[#ffddb8]">
                    {est.rawMeasured.toFixed(1)} <span className="text-[10px] text-[#869397]">{unit}</span>
                  </td>
                  <td className="p-2.5 text-right text-[#dae2fd]">
                    {est.modelPredicted.toFixed(1)} <span className="text-[10px] text-[#869397]">{unit}</span>
                  </td>
                  <td className="p-2.5 text-right font-bold text-[#4edea3]">
                    {est.reconciledState.toFixed(1)} <span className="text-[10px] text-[#869397]">{unit}</span>
                  </td>
                  <td className="p-2.5 text-right">
                    <span
                      className={`font-semibold ${
                        est.residualInnovation > 2.0 ? 'text-[#ff8077]' : 'text-[#869397]'
                      }`}
                    >
                      {est.residualInnovation.toFixed(3)}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-12 h-1.5 bg-[#171f33] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4edea3]"
                          style={{ width: `${est.confidenceScore * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#869397]">
                        {(est.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="p-2.5 text-center">{getStatusBadge(est.healthStatus)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
