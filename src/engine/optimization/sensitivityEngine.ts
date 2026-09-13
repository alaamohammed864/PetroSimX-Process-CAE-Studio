/**
 * PetroSimX Sensitivity Analysis Engine
 * Automates multi-case parametric sweeps, evaluates process convergence,
 * calculates statistical metrics, and provides export capabilities.
 */

import { EquipmentUnit, ProcessStream, ChemicalComponent } from '../../types/simulation';
import {
  SensitivityVariableDefinition,
  SensitivityRunCase,
  SensitivityStudyResult,
  SensitivityMetrics,
} from '../../types/optimization';
import { runSteadyStateSimulation } from '../solver/simulationManager';
import { extractFlowsheetMetrics } from './metricExtractor';

/**
 * Standard Catalog of Sensitivity Input Variables for PetroSimX
 */
export const STANDARD_SENSITIVITY_VARIABLES: SensitivityVariableDefinition[] = [
  {
    id: 'var_reactor_temp',
    name: 'Reactor Inlet Temperature',
    category: 'temperature',
    targetType: 'unit',
    targetId: 'R-101',
    propertyKey: 'equilibrium.inletTempC',
    minValue: 480.0,
    maxValue: 535.0,
    defaultValue: 512.0,
    stepCount: 11,
    unit: '°C',
    description: 'Reformer catalytic fixed-bed inlet temperature governing endothermic dehydrogenation rates.',
  },
  {
    id: 'var_reactor_pres',
    name: 'Reactor Operating Pressure',
    category: 'pressure',
    targetType: 'unit',
    targetId: 'R-101',
    propertyKey: 'equilibrium.operatingPresBar',
    minValue: 15.0,
    maxValue: 38.0,
    defaultValue: 28.0,
    stepCount: 10,
    unit: 'bar',
    description: 'System pressure affecting thermodynamic equilibrium toward aromatic reformate.',
  },
  {
    id: 'var_feed_flow',
    name: 'Fresh Feed Mass Flow Rate',
    category: 'flow',
    targetType: 'stream',
    targetId: 'S-101',
    propertyKey: 'flowKgH',
    minValue: 30000.0,
    maxValue: 65000.0,
    defaultValue: 45000.0,
    stepCount: 8,
    unit: 'kg/h',
    description: 'Plant intake throughput testing hydraulic and heat transfer limits.',
  },
  {
    id: 'var_treat_ratio',
    name: 'H2:HC Treat Gas Ratio',
    category: 'flow',
    targetType: 'unit',
    targetId: 'R-101',
    propertyKey: 'equilibrium.h2hcTreatRatioNm3M3',
    minValue: 450.0,
    maxValue: 850.0,
    defaultValue: 650.0,
    stepCount: 9,
    unit: 'Nm³/m³',
    description: 'Recycle hydrogen treat ratio controlling catalyst coking deactivation.',
  },
  {
    id: 'var_reflux_ratio',
    name: 'Debutanizer Reflux Ratio',
    category: 'refluxRatio',
    targetType: 'unit',
    targetId: 'C-101',
    propertyKey: 'columnSpec.refluxRatio',
    minValue: 1.2,
    maxValue: 4.5,
    defaultValue: 2.5,
    stepCount: 10,
    unit: 'R/R_min',
    description: 'Fraction of condensed liquid returned to column top to control light end purity.',
  },
  {
    id: 'var_furnace_duty',
    name: 'Furnace F-101 Duty',
    category: 'temperature',
    targetType: 'unit',
    targetId: 'F-101',
    propertyKey: 'equilibrium.dutyMW',
    minValue: 5.0,
    maxValue: 14.0,
    defaultValue: 8.5,
    stepCount: 10,
    unit: 'MW',
    description: 'Pre-heat radiant thermal duty firing fuel gas.',
  },
  {
    id: 'var_lhsv_space_vel',
    name: 'Catalyst LHSV Space Velocity',
    category: 'catalyst',
    targetType: 'unit',
    targetId: 'R-101',
    propertyKey: 'equilibrium.lhsvSpaceVelH1',
    minValue: 1.0,
    maxValue: 3.5,
    defaultValue: 1.8,
    stepCount: 9,
    unit: 'h⁻¹',
    description: 'Liquid Hourly Space Velocity determining residence time on catalyst beds.',
  },
];

/**
 * Clones and applies a variable value to flowsheet model
 */
function applyVariableValue(
  units: EquipmentUnit[],
  streams: ProcessStream[],
  variable: SensitivityVariableDefinition,
  value: number
): { modifiedUnits: EquipmentUnit[]; modifiedStreams: ProcessStream[] } {
  const newUnits = JSON.parse(JSON.stringify(units)) as EquipmentUnit[];
  const newStreams = JSON.parse(JSON.stringify(streams)) as ProcessStream[];

  if (variable.targetType === 'stream') {
    const s = newStreams.find((item) => item.id === variable.targetId);
    if (s) {
      if (variable.propertyKey === 'flowKgH') {
        s.flowKgH = value;
      } else if (variable.propertyKey === 'tempC') {
        s.tempC = value;
      } else if (variable.propertyKey === 'presBar') {
        s.presBar = value;
      }
    }
  } else if (variable.targetType === 'unit') {
    const u = newUnits.find((item) => item.id === variable.targetId);
    if (u) {
      if (!u.equilibrium) {
        u.equilibrium = {
          inletTempC: 510,
          outletTempC: 495,
          operatingPresBar: 28,
          pressureDropBar: 1.5,
        };
      }
      if (variable.propertyKey === 'equilibrium.inletTempC') {
        u.equilibrium.inletTempC = value;
      } else if (variable.propertyKey === 'equilibrium.operatingPresBar') {
        u.equilibrium.operatingPresBar = value;
      } else if (variable.propertyKey === 'equilibrium.dutyMW') {
        u.equilibrium.dutyMW = value;
      } else if (variable.propertyKey === 'equilibrium.lhsvSpaceVelH1') {
        u.equilibrium.lhsvSpaceVelH1 = value;
      } else if (variable.propertyKey === 'equilibrium.h2hcTreatRatioNm3M3') {
        u.equilibrium.h2hcTreatRatioNm3M3 = value;
      } else if (variable.propertyKey === 'columnSpec.refluxRatio') {
        if (!u.columnSpec) {
          u.columnSpec = {
            numberOfStages: 24,
            feedStage: 12,
            condenserType: 'total',
            reboilerType: 'kettle',
            refluxRatio: value,
            distillateRateKgH: 15000,
            topPressureBar: 4.5,
            bottomPressureBar: 5.2,
            lightKeyComponentId: 'c3',
            heavyKeyComponentId: 'nc4',
            lightKeyDistillateRecovery: 0.98,
            heavyKeyBottomsRecovery: 0.98,
          };
        } else {
          u.columnSpec.refluxRatio = value;
        }
      }
    }
  }

  return { modifiedUnits: newUnits, modifiedStreams: newStreams };
}

/**
 * Runs a multi-case sensitivity study across the specified range and steps
 */
export async function runSensitivityStudy(
  variable: SensitivityVariableDefinition,
  units: EquipmentUnit[],
  streams: ProcessStream[],
  components: ChemicalComponent[],
  selectedYMetric: keyof SensitivityMetrics = 'netOperatingMarginPerHour',
  onProgress?: (completed: number, total: number, currentVal: number) => void
): Promise<SensitivityStudyResult> {
  const steps = Math.max(3, Math.min(50, variable.stepCount || 10));
  const minVal = variable.minValue;
  const maxVal = variable.maxValue;
  const stepSize = (maxVal - minVal) / (steps - 1);

  const runs: SensitivityRunCase[] = [];

  for (let i = 0; i < steps; i++) {
    const inputVal = parseFloat((minVal + i * stepSize).toFixed(3));
    if (onProgress) {
      onProgress(i + 1, steps, inputVal);
    }

    // Yield small tick to keep UI responsive
    await new Promise((resolve) => setTimeout(resolve, 8));

    const { modifiedUnits, modifiedStreams } = applyVariableValue(units, streams, variable, inputVal);

    const startTime = performance.now();
    const simResult = await runSteadyStateSimulation(modifiedUnits, modifiedStreams, components, {
      solverOptions: {
        tolerance: 1e-4,
        maxIterations: 25,
        method: 'Wegstein',
        dampingFactor: 0.65,
        wegsteinBounds: [-5.0, 0.0],
      },
    });
    const execTime = performance.now() - startTime;

    const metrics = extractFlowsheetMetrics(simResult, modifiedUnits, modifiedStreams);

    const warnings: string[] = [];
    if (!simResult.converged) {
      warnings.push('Process model recycle loop failed to achieve numerical convergence within tolerance.');
    }
    if (metrics.peakTemperatureC > 535.0) {
      warnings.push(`Metallurgical alert: Bed peak temperature (${metrics.peakTemperatureC} °C) exceeds alloy rating.`);
    }
    if (metrics.maxPressureDropBar > 2.5) {
      warnings.push(`Hydraulic alert: Bed pressure drop (${metrics.maxPressureDropBar} bar) indicates excessive friction or fouling risk.`);
    }

    runs.push({
      caseIndex: i + 1,
      inputValue: inputVal,
      converged: simResult.converged,
      iterations: simResult.iterations,
      executionTimeMs: parseFloat(execTime.toFixed(1)),
      metrics,
      warnings,
    });
  }

  // Calculate Summary Statistics
  const validRuns = runs.filter((r) => r.converged);
  const metricValues = (validRuns.length > 0 ? validRuns : runs).map((r) => r.metrics[selectedYMetric]);

  const minMetricVal = Math.min(...metricValues);
  const maxMetricVal = Math.max(...metricValues);
  const avgMetricVal = metricValues.reduce((a, b) => a + b, 0) / metricValues.length;

  // Best case determination:
  // For cost and emissions and energy: lower is better
  // For yield, margin, production, conversion: higher is better
  const lowerIsBetter =
    selectedYMetric === 'energyConsumptionMW' ||
    selectedYMetric === 'co2EmissionsKgH' ||
    selectedYMetric === 'operatingCostPerHour' ||
    selectedYMetric === 'furnaceDutyMW' ||
    selectedYMetric === 'compressorPowerKW' ||
    selectedYMetric === 'reboilerDutyMW';

  let bestIndex = 0;
  let bestVal = lowerIsBetter ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  runs.forEach((r, idx) => {
    if (!r.converged) return; // Never consider non-converged case as best!
    const v = r.metrics[selectedYMetric];
    if (lowerIsBetter) {
      if (v < bestVal) {
        bestVal = v;
        bestIndex = idx;
      }
    } else {
      if (v > bestVal) {
        bestVal = v;
        bestIndex = idx;
      }
    }
  });

  if (!Number.isFinite(bestVal)) {
    bestVal = metricValues[0] || 0;
    bestIndex = 0;
  }

  return {
    variable,
    runs,
    selectedYMetric,
    summaryStats: {
      minVal: parseFloat(minMetricVal.toFixed(2)),
      maxVal: parseFloat(maxMetricVal.toFixed(2)),
      avgVal: parseFloat(avgMetricVal.toFixed(2)),
      bestCaseIndex: runs[bestIndex]?.caseIndex || 1,
      bestInputValue: runs[bestIndex]?.inputValue || 0,
      bestMetricValue: parseFloat(bestVal.toFixed(2)),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Exports sensitivity study results as CSV text
 */
export function exportSensitivityToCSV(result: SensitivityStudyResult): string {
  const headers = [
    'Case_Number',
    `${result.variable.name.replace(/ /g, '_')}_[${result.variable.unit}]`,
    'Status',
    'Iterations',
    'Yield_[%]',
    'Production_[kg/h]',
    'Total_Energy_[MW]',
    'CO2_Emissions_[kg/h]',
    'Operating_Cost_[$/h]',
    'Net_Margin_[$/h]',
    'Conversion_[%]',
    'Peak_Bed_Temp_[C]',
    'Max_DP_[bar]',
  ];

  const rows = result.runs.map((r) => [
    r.caseIndex,
    r.inputValue,
    r.converged ? 'CONVERGED' : 'DIVERGED',
    r.iterations,
    r.metrics.productYieldPct,
    r.metrics.productionRateKgH,
    r.metrics.energyConsumptionMW,
    r.metrics.co2EmissionsKgH,
    r.metrics.operatingCostPerHour,
    r.metrics.netOperatingMarginPerHour,
    r.metrics.reactantConversionPct,
    r.metrics.peakTemperatureC,
    r.metrics.maxPressureDropBar,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Exports sensitivity study results as formatted JSON
 */
export function exportSensitivityToJSON(result: SensitivityStudyResult): string {
  return JSON.stringify(result, null, 2);
}
