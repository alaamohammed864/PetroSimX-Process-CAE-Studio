/**
 * PetroSimX Numerical Process Optimization Engine
 * Supports multi-objective formulation, bounded decision variables, non-linear constraints,
 * and robust derivative-free algorithms (Nelder-Mead, Coordinate Search, Golden Section).
 *
 * CRITICAL ENGINEERING RULE:
 * Never claim an optimization result is valid if the underlying process model failed to converge.
 */

import { EquipmentUnit, ProcessStream, ChemicalComponent } from '../../types/simulation';
import {
  OptimizationObjective,
  OptimizationObjectiveType,
  DecisionVariable,
  OptimizationConstraint,
  OptimizationSolverSettings,
  OptimizationIterationRecord,
  OptimizationReport,
  SensitivityMetrics,
} from '../../types/optimization';
import { runSteadyStateSimulation } from '../solver/simulationManager';
import { extractFlowsheetMetrics } from './metricExtractor';

/**
 * Standard Available Optimization Objectives
 */
export const AVAILABLE_OBJECTIVES: OptimizationObjective[] = [
  {
    id: 'min_energy',
    name: 'Minimize Energy Consumption',
    type: 'min_energy',
    description: 'Minimizes combined thermal duties (furnace + reboiler) and compression electrical work.',
    formula: 'Min F(x) = Q_furnace [MW] + Q_reboiler [MW] + W_compressor [MW]',
    unit: 'MW',
    direction: 'minimize',
  },
  {
    id: 'max_production',
    name: 'Maximize Production Rate',
    type: 'max_production',
    description: 'Maximizes finished aromatic product mass flow rate exiting separation train.',
    formula: 'Max F(x) = m_product_out [kg/h]',
    unit: 'kg/h',
    direction: 'maximize',
  },
  {
    id: 'max_conversion',
    name: 'Maximize Reactant Conversion',
    type: 'max_conversion',
    description: 'Drives maximum catalytic conversion of feed naphthenes and paraffins.',
    formula: 'Max F(x) = (Feed_in - Unreacted_out) / Feed_in × 100%',
    unit: '%',
    direction: 'maximize',
  },
  {
    id: 'min_emissions',
    name: 'Minimize Carbon CO₂ Emissions',
    type: 'min_emissions',
    description: 'Minimizes greenhouse gas emissions from fuel gas firing and grid electricity.',
    formula: 'Min F(x) = CO2_fuel_combustion + CO2_grid_power [kg/h]',
    unit: 'kg/h',
    direction: 'minimize',
  },
  {
    id: 'min_cost',
    name: 'Minimize Operating Expenses (OPEX)',
    type: 'min_cost',
    description: 'Minimizes hourly utility costs including fuel gas, cooling water, and power.',
    formula: 'Min F(x) = Cost_fuel + Cost_power + Cost_catalyst [$/h]',
    unit: '$/h',
    direction: 'minimize',
  },
  {
    id: 'max_yield',
    name: 'Maximize Product Yield',
    type: 'max_yield',
    description: 'Maximizes yield percentage of valuable liquid reformate relative to intake feed.',
    formula: 'Max F(x) = (Mass_liquid_product / Mass_fresh_feed) × 100%',
    unit: '%',
    direction: 'maximize',
  },
  {
    id: 'max_margin',
    name: 'Maximize Net Operating Margin',
    type: 'max_margin',
    description: 'Maximizes gross economic spread: (Product Value - Feedstock Cost - Utility Cost).',
    formula: 'Max F(x) = Revenue_products - Cost_feedstock - Cost_utilities [$/h]',
    unit: '$/h',
    direction: 'maximize',
  },
];

/**
 * Standard Default Decision Variables
 */
export const DEFAULT_DECISION_VARIABLES: DecisionVariable[] = [
  {
    id: 'dv_reactor_temp',
    name: 'Reactor Inlet Temperature (T_in)',
    targetType: 'unit',
    targetId: 'R-101',
    propertyKey: 'equilibrium.inletTempC',
    lowerBound: 490.0,
    upperBound: 530.0,
    initialValue: 512.0,
    currentValue: 512.0,
    stepSize: 1.0,
    unit: '°C',
  },
  {
    id: 'dv_treat_ratio',
    name: 'H2:HC Treat Gas Ratio',
    targetType: 'unit',
    targetId: 'R-101',
    propertyKey: 'equilibrium.h2hcTreatRatioNm3M3',
    lowerBound: 500.0,
    upperBound: 800.0,
    initialValue: 650.0,
    currentValue: 650.0,
    stepSize: 15.0,
    unit: 'Nm³/m³',
  },
  {
    id: 'dv_reactor_pres',
    name: 'Reactor Operating Pressure',
    targetType: 'unit',
    targetId: 'R-101',
    propertyKey: 'equilibrium.operatingPresBar',
    lowerBound: 20.0,
    upperBound: 35.0,
    initialValue: 28.0,
    currentValue: 28.0,
    stepSize: 0.5,
    unit: 'bar',
  },
];

/**
 * Standard Default Process Constraints
 */
export const DEFAULT_OPTIMIZATION_CONSTRAINTS: OptimizationConstraint[] = [
  {
    id: 'const_bed_peak_temp',
    name: 'Max Bed Peak Temperature',
    metricKey: 'peakTemperatureC',
    operator: '<=',
    threshold: 535.0,
    unit: '°C',
    penaltyWeight: 1000.0,
    description: 'Metallurgical creep and catalyst sintering threshold.',
    enabled: true,
  },
  {
    id: 'const_bed_dp',
    name: 'Max Bed Pressure Drop ΔP',
    metricKey: 'maxPressureDropBar',
    operator: '<=',
    threshold: 2.5,
    unit: 'bar',
    penaltyWeight: 5000.0,
    description: 'Compressor discharge hydraulic head limit and bed crushing stress.',
    enabled: true,
  },
  {
    id: 'const_furnace_duty',
    name: 'Max Furnace Radiant Duty',
    metricKey: 'furnaceDutyMW',
    operator: '<=',
    threshold: 12.0,
    unit: 'MW',
    penaltyWeight: 2000.0,
    description: 'Fired heater maximum burner rating and tube skin temperature.',
    enabled: true,
  },
  {
    id: 'const_min_yield',
    name: 'Min Product Yield Spec',
    metricKey: 'productYieldPct',
    operator: '>=',
    threshold: 78.0,
    unit: '%',
    penaltyWeight: 800.0,
    description: 'Minimum commercial liquid recovery specifications.',
    enabled: true,
  },
  {
    id: 'const_max_co2',
    name: 'Greenhouse Gas CO₂ Ceiling',
    metricKey: 'co2EmissionsKgH',
    operator: '<=',
    threshold: 4200.0,
    unit: 'kg/h',
    penaltyWeight: 50.0,
    description: 'Environmental permit emissions ceiling.',
    enabled: false,
  },
];

/**
 * Maps decision variable vector x to flowsheet models
 */
function applyDecisionVariables(
  units: EquipmentUnit[],
  streams: ProcessStream[],
  variables: DecisionVariable[],
  x: number[]
): { modifiedUnits: EquipmentUnit[]; modifiedStreams: ProcessStream[] } {
  const newUnits = JSON.parse(JSON.stringify(units)) as EquipmentUnit[];
  const newStreams = JSON.parse(JSON.stringify(streams)) as ProcessStream[];

  variables.forEach((dv, idx) => {
    // Project onto box bounds
    const val = Math.max(dv.lowerBound, Math.min(dv.upperBound, x[idx]));

    if (dv.targetType === 'stream') {
      const s = newStreams.find((item) => item.id === dv.targetId);
      if (s) {
        if (dv.propertyKey === 'flowKgH') s.flowKgH = val;
        if (dv.propertyKey === 'tempC') s.tempC = val;
        if (dv.propertyKey === 'presBar') s.presBar = val;
      }
    } else if (dv.targetType === 'unit') {
      const u = newUnits.find((item) => item.id === dv.targetId);
      if (u) {
        if (!u.equilibrium) {
          u.equilibrium = {
            inletTempC: 510,
            outletTempC: 495,
            operatingPresBar: 28,
            pressureDropBar: 1.5,
          };
        }
        if (dv.propertyKey === 'equilibrium.inletTempC') u.equilibrium.inletTempC = val;
        if (dv.propertyKey === 'equilibrium.operatingPresBar') u.equilibrium.operatingPresBar = val;
        if (dv.propertyKey === 'equilibrium.h2hcTreatRatioNm3M3') u.equilibrium.h2hcTreatRatioNm3M3 = val;
        if (dv.propertyKey === 'equilibrium.dutyMW') u.equilibrium.dutyMW = val;
        if (dv.propertyKey === 'equilibrium.lhsvSpaceVelH1') u.equilibrium.lhsvSpaceVelH1 = val;
        if (dv.propertyKey === 'columnSpec.refluxRatio' && u.columnSpec) u.columnSpec.refluxRatio = val;
      }
    }
  });

  return { modifiedUnits: newUnits, modifiedStreams: newStreams };
}

/**
 * Extracts raw objective metric value according to objective type
 */
function getRawObjective(metrics: SensitivityMetrics, objType: OptimizationObjectiveType): number {
  switch (objType) {
    case 'min_energy':
      return metrics.energyConsumptionMW;
    case 'max_production':
      return metrics.productionRateKgH;
    case 'max_conversion':
      return metrics.reactantConversionPct;
    case 'min_emissions':
      return metrics.co2EmissionsKgH;
    case 'min_cost':
      return metrics.operatingCostPerHour;
    case 'max_yield':
      return metrics.productYieldPct;
    case 'max_margin':
      return metrics.netOperatingMarginPerHour;
    default:
      return metrics.netOperatingMarginPerHour;
  }
}

/**
 * Core Evaluation Function:
 * Runs the real steady-state simulation, checks convergence, evaluates constraints,
 * and computes quadratic penalty for constraint violations.
 */
async function evaluateTrialSolution(
  units: EquipmentUnit[],
  streams: ProcessStream[],
  components: ChemicalComponent[],
  variables: DecisionVariable[],
  objective: OptimizationObjective,
  constraints: OptimizationConstraint[],
  x: number[],
  evalCount: number,
  globalPenaltyMultiplier = 1.0
): Promise<{
  rawObjective: number;
  penalizedObjective: number;
  isFeasible: boolean;
  modelConverged: boolean;
  metrics: SensitivityMetrics;
  violations: { constraintId: string; name: string; violation: number }[];
  evaluatedUnits: EquipmentUnit[];
  evaluatedStreams: ProcessStream[];
}> {
  const { modifiedUnits, modifiedStreams } = applyDecisionVariables(units, streams, variables, x);

  const simResult = await runSteadyStateSimulation(modifiedUnits, modifiedStreams, components, {
    solverOptions: {
      tolerance: 1e-4,
      maxIterations: 25,
      method: 'Wegstein',
      dampingFactor: 0.65,
      wegsteinBounds: [-5.0, 0.0],
    },
  });

  const metrics = extractFlowsheetMetrics(simResult, modifiedUnits, modifiedStreams);
  const rawObj = getRawObjective(metrics, objective.id);

  // CRITICAL RULE:
  // If model fails to converge, heavily penalize and mark as infeasible
  if (!simResult.converged) {
    return {
      rawObjective: rawObj,
      penalizedObjective: objective.direction === 'minimize' ? 1e9 : -1e9,
      isFeasible: false,
      modelConverged: false,
      metrics,
      violations: [
        {
          constraintId: 'model_convergence',
          name: 'Flowsheet Convergence Failure',
          violation: 999.0,
        },
      ],
      evaluatedUnits: modifiedUnits,
      evaluatedStreams: modifiedStreams,
    };
  }

  // Evaluate Constraints
  const violations: { constraintId: string; name: string; violation: number }[] = [];
  let totalPenalty = 0;

  for (const c of constraints) {
    if (!c.enabled) continue;
    const actualVal = metrics[c.metricKey];
    let violation = 0;

    if (c.operator === '<=' && actualVal > c.threshold) {
      violation = actualVal - c.threshold;
    } else if (c.operator === '>=' && actualVal < c.threshold) {
      violation = c.threshold - actualVal;
    }

    if (violation > 0) {
      violations.push({
        constraintId: c.id,
        name: c.name,
        violation: parseFloat(violation.toFixed(3)),
      });
      // Quadratic penalty function
      totalPenalty += c.penaltyWeight * Math.pow(violation, 2) * globalPenaltyMultiplier;
    }
  }

  // Also penalize box bound violations
  variables.forEach((dv, idx) => {
    const val = x[idx];
    if (val < dv.lowerBound) {
      const v = dv.lowerBound - val;
      totalPenalty += 10000.0 * Math.pow(v, 2);
    } else if (val > dv.upperBound) {
      const v = val - dv.upperBound;
      totalPenalty += 10000.0 * Math.pow(v, 2);
    }
  });

  const isFeasible = violations.length === 0;

  // Sign convention for optimizer:
  // We formulate internal minimization of target:
  // If user wants to minimize: target = rawObj + totalPenalty
  // If user wants to maximize: target = -rawObj + totalPenalty
  const penalizedObjective =
    objective.direction === 'minimize' ? rawObj + totalPenalty : -rawObj + totalPenalty;

  return {
    rawObjective: parseFloat(rawObj.toFixed(2)),
    penalizedObjective: parseFloat(penalizedObjective.toFixed(3)),
    isFeasible,
    modelConverged: true,
    metrics,
    violations,
    evaluatedUnits: modifiedUnits,
    evaluatedStreams: modifiedStreams,
  };
}

/**
 * Runs the optimization solver using selected algorithm
 */
export async function runProcessOptimization(
  units: EquipmentUnit[],
  streams: ProcessStream[],
  components: ChemicalComponent[],
  objective: OptimizationObjective,
  decisionVariables: DecisionVariable[],
  constraints: OptimizationConstraint[],
  settings: OptimizationSolverSettings,
  onProgress?: (record: OptimizationIterationRecord) => void
): Promise<OptimizationReport> {
  const n = decisionVariables.length;
  const x0 = decisionVariables.map((dv) => dv.currentValue);

  let evalCount = 0;
  const iterationHistory: OptimizationIterationRecord[] = [];

  // 1. Initial Evaluation
  evalCount++;
  const initEval = await evaluateTrialSolution(
    units,
    streams,
    components,
    decisionVariables,
    objective,
    constraints,
    x0,
    evalCount,
    settings.penaltyWeight
  );

  const initRecord: OptimizationIterationRecord = {
    iteration: 0,
    evaluationCount: evalCount,
    candidateX: [...x0],
    variableValues: decisionVariables.map((dv, idx) => ({
      id: dv.id,
      name: dv.name,
      value: parseFloat(x0[idx].toFixed(2)),
      unit: dv.unit,
    })),
    rawObjectiveValue: initEval.rawObjective,
    penalizedObjectiveValue: initEval.penalizedObjective,
    isFeasible: initEval.isFeasible,
    modelConverged: initEval.modelConverged,
    metrics: initEval.metrics,
    violations: initEval.violations,
    statusMessage: 'Initial Baseline Flowsheet Evaluated',
  };
  iterationHistory.push(initRecord);
  if (onProgress) onProgress(initRecord);

  let bestX = [...x0];
  let bestPenalized = initEval.penalizedObjective;
  let bestRaw = initEval.rawObjective;
  let bestMetrics = initEval.metrics;
  let bestFeasible = initEval.isFeasible;
  let bestConverged = initEval.modelConverged;

  const maxIter = Math.max(3, Math.min(60, settings.maxIterations || 20));

  // ==========================================
  // ALGORITHM: NELDER-MEAD DOWNHILL SIMPLEX
  // ==========================================
  if (settings.algorithm === 'nelder_mead' || n >= 2) {
    // Construct initial simplex of (n + 1) vertices
    const simplex: { x: number[]; f: number; raw: number; feasible: boolean; metrics: SensitivityMetrics; converged: boolean }[] = [];
    simplex.push({
      x: [...x0],
      f: initEval.penalizedObjective,
      raw: initEval.rawObjective,
      feasible: initEval.isFeasible,
      metrics: initEval.metrics,
      converged: initEval.modelConverged,
    });

    for (let i = 0; i < n; i++) {
      const xi = [...x0];
      const range = decisionVariables[i].upperBound - decisionVariables[i].lowerBound;
      const step = (decisionVariables[i].stepSize || range * 0.08);
      xi[i] = Math.min(decisionVariables[i].upperBound, xi[i] + step);

      evalCount++;
      const eval_i = await evaluateTrialSolution(
        units,
        streams,
        components,
        decisionVariables,
        objective,
        constraints,
        xi,
        evalCount,
        settings.penaltyWeight
      );

      simplex.push({
        x: xi,
        f: eval_i.penalizedObjective,
        raw: eval_i.rawObjective,
        feasible: eval_i.isFeasible,
        metrics: eval_i.metrics,
        converged: eval_i.modelConverged,
      });

      if (eval_i.penalizedObjective < bestPenalized && eval_i.modelConverged) {
        bestPenalized = eval_i.penalizedObjective;
        bestX = [...xi];
        bestRaw = eval_i.rawObjective;
        bestMetrics = eval_i.metrics;
        bestFeasible = eval_i.isFeasible;
        bestConverged = eval_i.modelConverged;
      }
    }

    // Nelder-Mead loop
    const alpha = 1.0; // reflection
    const gamma = 2.0; // expansion
    const rho = 0.5; // contraction
    const sigma = 0.5; // shrink

    for (let iter = 1; iter <= maxIter; iter++) {
      // Yield to event loop
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Sort simplex vertices by f ascending
      simplex.sort((a, b) => a.f - b.f);

      const best = simplex[0];
      const worst = simplex[n];
      const secondWorst = simplex[n - 1];

      // Update best overall
      if (best.f < bestPenalized && best.converged) {
        bestPenalized = best.f;
        bestX = [...best.x];
        bestRaw = best.raw;
        bestMetrics = best.metrics;
        bestFeasible = best.feasible;
        bestConverged = best.converged;
      }

      // Check convergence diameter
      let maxDist = 0;
      for (let i = 1; i <= n; i++) {
        let dist = 0;
        for (let j = 0; j < n; j++) {
          dist += Math.pow((simplex[i].x[j] - simplex[0].x[j]) / (decisionVariables[j].upperBound - decisionVariables[j].lowerBound), 2);
        }
        if (dist > maxDist) maxDist = dist;
      }
      if (Math.sqrt(maxDist) < settings.tolerance && iter > 3) {
        break;
      }

      // Compute centroid of all vertices except worst
      const centroid: number[] = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          centroid[j] += simplex[i].x[j];
        }
      }
      for (let j = 0; j < n; j++) {
        centroid[j] /= n;
      }

      // 1. Reflection
      const xr: number[] = [];
      for (let j = 0; j < n; j++) {
        const val = centroid[j] + alpha * (centroid[j] - worst.x[j]);
        xr.push(Math.max(decisionVariables[j].lowerBound, Math.min(decisionVariables[j].upperBound, val)));
      }
      evalCount++;
      const eval_r = await evaluateTrialSolution(
        units,
        streams,
        components,
        decisionVariables,
        objective,
        constraints,
        xr,
        evalCount,
        settings.penaltyWeight
      );

      let accepted = false;
      let actionMsg = 'Reflection';

      if (eval_r.penalizedObjective < secondWorst.f && eval_r.penalizedObjective >= best.f) {
        simplex[n] = {
          x: xr,
          f: eval_r.penalizedObjective,
          raw: eval_r.rawObjective,
          feasible: eval_r.isFeasible,
          metrics: eval_r.metrics,
          converged: eval_r.modelConverged,
        };
        accepted = true;
        actionMsg = 'Simplex Reflection accepted';
      } else if (eval_r.penalizedObjective < best.f) {
        // 2. Expansion
        const xe: number[] = [];
        for (let j = 0; j < n; j++) {
          const val = centroid[j] + gamma * (xr[j] - centroid[j]);
          xe.push(Math.max(decisionVariables[j].lowerBound, Math.min(decisionVariables[j].upperBound, val)));
        }
        evalCount++;
        const eval_e = await evaluateTrialSolution(
          units,
          streams,
          components,
          decisionVariables,
          objective,
          constraints,
          xe,
          evalCount,
          settings.penaltyWeight
        );

        if (eval_e.penalizedObjective < eval_r.penalizedObjective) {
          simplex[n] = {
            x: xe,
            f: eval_e.penalizedObjective,
            raw: eval_e.rawObjective,
            feasible: eval_e.isFeasible,
            metrics: eval_e.metrics,
            converged: eval_e.modelConverged,
          };
          actionMsg = 'Simplex Expansion accepted';
        } else {
          simplex[n] = {
            x: xr,
            f: eval_r.penalizedObjective,
            raw: eval_r.rawObjective,
            feasible: eval_r.isFeasible,
            metrics: eval_r.metrics,
            converged: eval_r.modelConverged,
          };
          actionMsg = 'Simplex Reflection preserved';
        }
        accepted = true;
      } else {
        // 3. Contraction
        const xc: number[] = [];
        for (let j = 0; j < n; j++) {
          const val = centroid[j] + rho * (worst.x[j] - centroid[j]);
          xc.push(Math.max(decisionVariables[j].lowerBound, Math.min(decisionVariables[j].upperBound, val)));
        }
        evalCount++;
        const eval_c = await evaluateTrialSolution(
          units,
          streams,
          components,
          decisionVariables,
          objective,
          constraints,
          xc,
          evalCount,
          settings.penaltyWeight
        );

        if (eval_c.penalizedObjective < worst.f) {
          simplex[n] = {
            x: xc,
            f: eval_c.penalizedObjective,
            raw: eval_c.rawObjective,
            feasible: eval_c.isFeasible,
            metrics: eval_c.metrics,
            converged: eval_c.modelConverged,
          };
          accepted = true;
          actionMsg = 'Simplex Contraction accepted';
        }
      }

      // 4. Shrink (if reflection & contraction failed)
      if (!accepted) {
        actionMsg = 'Simplex Shrink around vertex 0';
        for (let i = 1; i <= n; i++) {
          for (let j = 0; j < n; j++) {
            simplex[i].x[j] = simplex[0].x[j] + sigma * (simplex[i].x[j] - simplex[0].x[j]);
          }
          evalCount++;
          const eval_s = await evaluateTrialSolution(
            units,
            streams,
            components,
            decisionVariables,
            objective,
            constraints,
            simplex[i].x,
            evalCount,
            settings.penaltyWeight
          );
          simplex[i].f = eval_s.penalizedObjective;
          simplex[i].raw = eval_s.rawObjective;
          simplex[i].feasible = eval_s.isFeasible;
          simplex[i].metrics = eval_s.metrics;
          simplex[i].converged = eval_s.modelConverged;
        }
      }

      simplex.sort((a, b) => a.f - b.f);
      if (simplex[0].f < bestPenalized && simplex[0].converged) {
        bestPenalized = simplex[0].f;
        bestX = [...simplex[0].x];
        bestRaw = simplex[0].raw;
        bestMetrics = simplex[0].metrics;
        bestFeasible = simplex[0].feasible;
        bestConverged = simplex[0].converged;
      }

      const iterRecord: OptimizationIterationRecord = {
        iteration: iter,
        evaluationCount: evalCount,
        candidateX: [...bestX],
        variableValues: decisionVariables.map((dv, idx) => ({
          id: dv.id,
          name: dv.name,
          value: parseFloat(bestX[idx].toFixed(2)),
          unit: dv.unit,
        })),
        rawObjectiveValue: bestRaw,
        penalizedObjectiveValue: bestPenalized,
        isFeasible: bestFeasible,
        modelConverged: bestConverged,
        metrics: bestMetrics,
        violations: [],
        statusMessage: `${actionMsg} (Iter ${iter}/${maxIter})`,
      };
      iterationHistory.push(iterRecord);
      if (onProgress) onProgress(iterRecord);
    }
  } else {
    // ===================================================
    // ALGORITHM: 1D GOLDEN SECTION LINE SEARCH
    // ===================================================
    let a = decisionVariables[0].lowerBound;
    let b = decisionVariables[0].upperBound;
    const phi = (1 + Math.sqrt(5)) / 2;
    const resphi = 2 - phi;

    let x1 = a + resphi * (b - a);
    let x2 = b - resphi * (b - a);

    evalCount++;
    const f1 = await evaluateTrialSolution(
      units,
      streams,
      components,
      decisionVariables,
      objective,
      constraints,
      [x1],
      evalCount,
      settings.penaltyWeight
    );

    evalCount++;
    const f2 = await evaluateTrialSolution(
      units,
      streams,
      components,
      decisionVariables,
      objective,
      constraints,
      [x2],
      evalCount,
      settings.penaltyWeight
    );

    for (let iter = 1; iter <= maxIter; iter++) {
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (f1.penalizedObjective < f2.penalizedObjective) {
        b = x2;
        x2 = x1;
        // re-evaluate x1
        x1 = a + resphi * (b - a);
        evalCount++;
        const newF1 = await evaluateTrialSolution(
          units,
          streams,
          components,
          decisionVariables,
          objective,
          constraints,
          [x1],
          evalCount,
          settings.penaltyWeight
        );
        if (newF1.penalizedObjective < bestPenalized && newF1.modelConverged) {
          bestPenalized = newF1.penalizedObjective;
          bestX = [x1];
          bestRaw = newF1.rawObjective;
          bestMetrics = newF1.metrics;
          bestFeasible = newF1.isFeasible;
          bestConverged = newF1.modelConverged;
        }
      } else {
        a = x1;
        x1 = x2;
        x2 = b - resphi * (b - a);
        evalCount++;
        const newF2 = await evaluateTrialSolution(
          units,
          streams,
          components,
          decisionVariables,
          objective,
          constraints,
          [x2],
          evalCount,
          settings.penaltyWeight
        );
        if (newF2.penalizedObjective < bestPenalized && newF2.modelConverged) {
          bestPenalized = newF2.penalizedObjective;
          bestX = [x2];
          bestRaw = newF2.rawObjective;
          bestMetrics = newF2.metrics;
          bestFeasible = newF2.isFeasible;
          bestConverged = newF2.modelConverged;
        }
      }

      const iterRecord: OptimizationIterationRecord = {
        iteration: iter,
        evaluationCount: evalCount,
        candidateX: [...bestX],
        variableValues: decisionVariables.map((dv, idx) => ({
          id: dv.id,
          name: dv.name,
          value: parseFloat(bestX[idx].toFixed(2)),
          unit: dv.unit,
        })),
        rawObjectiveValue: bestRaw,
        penalizedObjectiveValue: bestPenalized,
        isFeasible: bestFeasible,
        modelConverged: bestConverged,
        metrics: bestMetrics,
        violations: [],
        statusMessage: `Golden Section bracket [${a.toFixed(1)}, ${b.toFixed(1)}]`,
      };
      iterationHistory.push(iterRecord);
      if (onProgress) onProgress(iterRecord);

      if (Math.abs(b - a) < settings.tolerance) {
        break;
      }
    }
  }

  // Final evaluation of the optimal solution
  const finalEval = await evaluateTrialSolution(
    units,
    streams,
    components,
    decisionVariables,
    objective,
    constraints,
    bestX,
    evalCount + 1,
    settings.penaltyWeight
  );

  // Calculate percentage improvement
  const rawInit = initEval.rawObjective;
  const rawOpt = finalEval.rawObjective;
  let improvementPct = 0;
  if (objective.direction === 'minimize') {
    improvementPct = rawInit > 0 ? ((rawInit - rawOpt) / rawInit) * 100 : 0;
  } else {
    improvementPct = rawInit > 0 ? ((rawOpt - rawInit) / rawInit) * 100 : 0;
  }

  const netEconomicGainPerHour = finalEval.metrics.netOperatingMarginPerHour - initEval.metrics.netOperatingMarginPerHour;

  const engineeringWarnings: string[] = [];
  if (!finalEval.modelConverged) {
    engineeringWarnings.push('CRITICAL: Optimal point failed to satisfy steady-state process model convergence!');
  }
  if (!finalEval.isFeasible) {
    engineeringWarnings.push(`WARNING: Solution has ${finalEval.violations.length} active constraint violations.`);
  }
  if (finalEval.metrics.peakTemperatureC > 530.0) {
    engineeringWarnings.push('Thermal warning: Peak temperature approaches metallurgical creep limit.');
  }

  // Update slack in constraints list
  const reportConstraints = constraints.map((c) => {
    const curVal = finalEval.metrics[c.metricKey];
    let slack = 0;
    let isViolated = false;
    if (c.operator === '<=') {
      slack = c.threshold - curVal;
      isViolated = curVal > c.threshold;
    } else {
      slack = curVal - c.threshold;
      isViolated = curVal < c.threshold;
    }
    return {
      ...c,
      currentValue: parseFloat(curVal.toFixed(2)),
      slack: parseFloat(slack.toFixed(2)),
      isViolated,
    };
  });

  return {
    timestamp: new Date().toISOString(),
    objective,
    solverSettings: settings,
    initialCase: {
      x: [...x0],
      variableValues: decisionVariables.map((dv, idx) => ({
        id: dv.id,
        name: dv.name,
        value: parseFloat(x0[idx].toFixed(2)),
        unit: dv.unit,
      })),
      rawObjectiveValue: initEval.rawObjective,
      metrics: initEval.metrics,
    },
    optimizedCase: {
      x: [...bestX],
      variableValues: decisionVariables.map((dv, idx) => ({
        id: dv.id,
        name: dv.name,
        value: parseFloat(bestX[idx].toFixed(2)),
        unit: dv.unit,
      })),
      rawObjectiveValue: finalEval.rawObjective,
      metrics: finalEval.metrics,
    },
    decisionVariables: decisionVariables.map((dv, idx) => ({
      ...dv,
      currentValue: parseFloat(bestX[idx].toFixed(2)),
    })),
    constraints: reportConstraints,
    iterations: iterationHistory.length,
    evaluationsCount: evalCount,
    convergenceStatus: !finalEval.modelConverged
      ? 'infeasible_diverged'
      : finalEval.isFeasible
      ? 'optimal_converged'
      : 'suboptimal_max_iter',
    modelConverged: finalEval.modelConverged,
    improvementPct: parseFloat(improvementPct.toFixed(2)),
    netEconomicGainPerHour: parseFloat(netEconomicGainPerHour.toFixed(1)),
    engineeringWarnings,
    iterationHistory,
  };
}
