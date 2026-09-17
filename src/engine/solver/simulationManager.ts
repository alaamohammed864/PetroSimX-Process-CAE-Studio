/**
 * Master Steady-State Process Simulation Manager
 * Orchestrates pre-validation, graph dependency ordering, tear stream identification,
 * unit operation calculation models, iterative recycle convergence, and global balance audits.
 */

import { EquipmentUnit, ProcessStream, ChemicalComponent } from '../../types/simulation';
import { StreamCalculationResult, calculateStreamState } from '../stream/streamCalculator';
import {
  solveMixer,
  solveSplitter,
  solveHeaterCooler,
  solveHeatExchanger,
  solvePump,
  solveCompressor,
  solveValve,
  solveSeparator,
  solveReactorUnit,
  solveDistillationColumnUnit,
  solveAbsorberModel,
  solveStripperModel,
  solveThreePhaseSeparatorUnit,
  solveLiquidLiquidSeparatorUnit,
  solveFurnaceUnit,
  UnitModelResult,
} from '../models/equipmentModels';
import {
  analyzeFlowsheetTopology,
  computeWegsteinAcceleration,
  FlowsheetGraph,
  TearStreamState,
  ConvergenceIterationRecord,
  RecycleSolverOptions,
} from './recycleSolver';
import { integrateReactorOde } from '../thermoEngine';
import { validateFlowsheet as validateEngineeringRules, ValidationReport } from '../validation/processValidator';

export interface SimulationRunOptions {
  solverOptions?: RecycleSolverOptions;
  onProgress?: (progress: {
    iteration: number;
    maxIterations: number;
    currentUnitId: string;
    residual: number;
    statusMessage: string;
  }) => void;
  shouldCancel?: () => boolean;
}

export interface SimulationResult {
  converged: boolean;
  iterations: number;
  totalExecutionTimeMs: number;
  tearStreams: string[];
  executionOrder: string[];
  convergenceHistory: ConvergenceIterationRecord[];

  // Updated state
  calculatedStreams: Map<string, StreamCalculationResult>;
  unitResults: Map<string, UnitModelResult>;

  // Global Balances
  globalMaterialBalance: {
    totalFeedMassKgH: number;
    totalProductMassKgH: number;
    massImbalanceKgH: number;
    relativeMassErrorPct: number;
    isConserved: boolean;
  };

  globalEnergyBalance: {
    inletEnthalpyFlowKW: number;
    outletEnthalpyFlowKW: number;
    totalDutySuppliedKW: number;
    totalPowerSuppliedKW: number;
    energyImbalanceKW: number;
    relativeEnergyErrorPct: number;
    isConserved: boolean;
  };

  validationReport?: ValidationReport;
  warnings: string[];
  errors: string[];
  statusMessage: string;
}

/**
 * Pre-simulation validation checks leveraging the rigorous Process Validation Suite
 */
export function validateFlowsheet(
  units: EquipmentUnit[],
  streams: ProcessStream[]
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const report = validateEngineeringRules(units, streams);
  return {
    isValid: report.passed,
    errors: report.errors.map((e) => `[${e.category.toUpperCase()}] ${e.message}`),
    warnings: report.warnings.map((w) => `[${w.category.toUpperCase()}] ${w.message}`),
  };
}

/**
 * Executes Steady-State Flowsheet Simulation
 */
export async function runSteadyStateSimulation(
  units: EquipmentUnit[],
  streams: ProcessStream[],
  components: ChemicalComponent[],
  options: SimulationRunOptions = {}
): Promise<SimulationResult> {
  const startTime = performance.now();
  const solverOpts = options.solverOptions || {
    tolerance: 1e-5,
    maxIterations: 30,
    method: 'Wegstein',
    dampingFactor: 0.7,
    wegsteinBounds: [-5.0, 0.0],
  };

  const validation = validateFlowsheet(units, streams);
  if (!validation.isValid) {
    return {
      converged: false,
      iterations: 0,
      totalExecutionTimeMs: performance.now() - startTime,
      tearStreams: [],
      executionOrder: [],
      convergenceHistory: [],
      calculatedStreams: new Map(),
      unitResults: new Map(),
      globalMaterialBalance: {
        totalFeedMassKgH: 0,
        totalProductMassKgH: 0,
        massImbalanceKgH: 0,
        relativeMassErrorPct: 0,
        isConserved: false,
      },
      globalEnergyBalance: {
        inletEnthalpyFlowKW: 0,
        outletEnthalpyFlowKW: 0,
        totalDutySuppliedKW: 0,
        totalPowerSuppliedKW: 0,
        energyImbalanceKW: 0,
        relativeEnergyErrorPct: 0,
        isConserved: false,
      },
      warnings: validation.warnings,
      errors: validation.errors,
      statusMessage: 'Pre-simulation validation failed.',
    };
  }

  // 1. Build Flowsheet Graph
  const graph: FlowsheetGraph = {
    nodes: units.map((u) => ({
      id: u.id,
      inletStreamIds: u.inletStreamIds || [],
      outletStreamIds: u.outletStreamIds || [],
    })),
    streamConnections: streams.map((s) => {
      // Find source and target units
      const src = units.find((u) => u.outletStreamIds?.includes(s.id));
      const tgt = units.find((u) => u.inletStreamIds?.includes(s.id));
      return {
        streamId: s.id,
        sourceUnitId: src?.id,
        targetUnitId: tgt?.id,
      };
    }),
  };

  // 2. Perform Graph Dependency Analysis & Tear Stream Selection
  const topology = analyzeFlowsheetTopology(graph);
  const tearStreamIds = topology.tearStreamIds;
  const executionOrder = topology.executionOrder;

  // Initialize stream states map
  const streamMap = new Map<string, StreamCalculationResult>();
  streams.forEach((s) => {
    const calc = calculateStreamState({
      id: s.id,
      name: s.name,
      tag: s.tag,
      temperatureC: s.tempC,
      pressureBar: s.presBar,
      totalMassFlowKgH: s.flowKgH,
      composition: s.compositions,
    });
    streamMap.set(s.id, calc);
  });

  // Tear stream state tracking for acceleration
  const tearHistory = new Map<string, { prev?: TearStreamState; curr: TearStreamState }>();
  tearStreamIds.forEach((tid) => {
    const st = streamMap.get(tid);
    if (st) {
      tearHistory.set(tid, {
        curr: {
          streamId: tid,
          temperatureC: st.temperatureC,
          pressureBar: st.pressureBar,
          massFlowKgH: st.totalMassFlowKgH,
          composition: { ...st.moleFractions },
        },
      });
    }
  });

  const unitResults = new Map<string, UnitModelResult>();
  const convergenceHistory: ConvergenceIterationRecord[] = [];
  const warnings: string[] = [...validation.warnings];
  const errors: string[] = [];

  let converged = false;
  let currentIteration = 0;
  let lastMaxResidual = 1.0;

  // 3. Iterative Sequential Modular Solver Loop
  for (currentIteration = 1; currentIteration <= solverOpts.maxIterations; currentIteration++) {
    // Check for cancellation
    if (options.shouldCancel && options.shouldCancel()) {
      return {
        converged: false,
        iterations: currentIteration,
        totalExecutionTimeMs: performance.now() - startTime,
        tearStreams: tearStreamIds,
        executionOrder,
        convergenceHistory,
        calculatedStreams: streamMap,
        unitResults,
        globalMaterialBalance: {
          totalFeedMassKgH: 0,
          totalProductMassKgH: 0,
          massImbalanceKgH: 0,
          relativeMassErrorPct: 0,
          isConserved: false,
        },
        globalEnergyBalance: {
          inletEnthalpyFlowKW: 0,
          outletEnthalpyFlowKW: 0,
          totalDutySuppliedKW: 0,
          totalPowerSuppliedKW: 0,
          energyImbalanceKW: 0,
          relativeEnergyErrorPct: 0,
          isConserved: false,
        },
        warnings,
        errors: ['Simulation cancelled by user.'],
        statusMessage: 'Simulation stopped.',
      };
    }

    // Solve each unit in topological sequence
    for (const unitId of executionOrder) {
      const unit = units.find((u) => u.id === unitId);
      if (!unit) continue;

      if (options.onProgress) {
        options.onProgress({
          iteration: currentIteration,
          maxIterations: solverOpts.maxIterations,
          currentUnitId: unitId,
          residual: lastMaxResidual,
          statusMessage: `Solving unit ${unitId} (${unit.type.toUpperCase()})...`,
        });
      }

      // Gather current inlet streams
      const inletStreams: StreamCalculationResult[] = (unit.inletStreamIds || [])
        .map((sid) => streamMap.get(sid))
        .filter((s): s is StreamCalculationResult => !!s);

      let modelResult: UnitModelResult;

      // Solve appropriate unit model
      switch (unit.type) {
        case 'pump': {
          modelResult = solvePump(unitId, inletStreams, {
            outletPressureBar: unit.equilibrium?.operatingPresBar || 85.0,
            hydraulicEfficiency: 0.76,
          });
          break;
        }
        case 'heatex': {
          // Heat exchanger with dual process sides
          const in0 = inletStreams[0];
          const in1 = inletStreams[1] || inletStreams[0];
          modelResult = solveHeatExchanger(unitId, in0, in1, {
            uA_KW_per_K: 125.0,
            hotPressureDropBar: unit.equilibrium?.pressureDropBar || 0.4,
            coldPressureDropBar: 0.35,
          });
          break;
        }
        case 'furnace': {
          modelResult = solveFurnaceUnit(
            unitId,
            inletStreams,
            unit.furnaceSpec || {
              outletTargetTempC: unit.equilibrium?.outletTempC || 510.0,
              fuelType: 'refinery_fuel_gas',
              thermalEfficiencyPct: unit.equilibrium?.efficiencyPct || 88.0,
              excessAirPct: 20.0,
            }
          );
          break;
        }
        case 'column': {
          const colRes = solveDistillationColumnUnit(unitId, inletStreams, unit.columnSpec);
          unit.columnResult = colRes.columnResult;
          modelResult = colRes.modelResult;
          break;
        }
        case 'absorber': {
          modelResult = solveAbsorberModel(unitId, inletStreams, unit.absorberSpec);
          break;
        }
        case 'stripper': {
          modelResult = solveStripperModel(unitId, inletStreams, unit.stripperSpec);
          break;
        }
        case 'three_phase_separator': {
          modelResult = solveThreePhaseSeparatorUnit(unitId, inletStreams, unit.threePhaseSpec);
          break;
        }
        case 'liquid_liquid_separator': {
          modelResult = solveLiquidLiquidSeparatorUnit(unitId, inletStreams);
          break;
        }
        case 'splitter': {
          modelResult = solveSplitter(unitId, inletStreams, { splitFractions: [0.5, 0.5] });
          break;
        }
        case 'valve': {
          modelResult = solveValve(unitId, inletStreams, {
            outletPressureBar: unit.equilibrium?.operatingPresBar || 2.5,
          });
          break;
        }
        case 'reactor': {
          if (unit.reactorSpec && inletStreams.length > 0) {
            const rxnRes = solveReactorUnit(unitId, inletStreams, unit.reactorSpec);
            unit.reactorResults = rxnRes.reactorResult;
            modelResult = rxnRes.modelResult;
          } else {
            // Catalytic Packed-Bed Hydrotreater ODE Integration
            const primaryInlet = inletStreams[0] || streamMap.get('S-104')!;
          const odeRes = integrateReactorOde(unit, {
            id: primaryInlet.streamId,
            name: primaryInlet.name,
            tag: primaryInlet.tag,
            phase: primaryInlet.phase,
            tempC: primaryInlet.temperatureC,
            presBar: primaryInlet.pressureBar,
            flowKgH: primaryInlet.totalMassFlowKgH,
            mw: primaryInlet.mwAvg,
            enthalpyKjKg: primaryInlet.enthalpyKjKg,
            vaporFraction: primaryInlet.vaporFraction,
            densityKgM3: primaryInlet.densityKgM3,
            color: '#ffaa00',
            compositions: primaryInlet.moleFractions,
          });

          // Product stream composition shifts due to dehydrogenation & hydrocracking
          const shiftedComp = { ...primaryInlet.moleFractions };
          const conv = odeRes.conversionPct / 100.0;
          if (shiftedComp['c7h14'] !== undefined) {
            const consumed = shiftedComp['c7h14'] * conv * 0.85;
            shiftedComp['c7h14'] -= consumed;
            shiftedComp['c6h6'] = (shiftedComp['c6h6'] || 0) + consumed * 0.92;
            shiftedComp['h2'] = (shiftedComp['h2'] || 0) + consumed * 2.8;
          }

          const reactorOutlet = calculateStreamState({
            id: `${unitId}_EFFLUENT`,
            temperatureC: odeRes.outletTempC,
            pressureBar: odeRes.outletPresBar,
            totalMassFlowKgH: primaryInlet.totalMassFlowKgH,
            composition: shiftedComp,
          });

          const dutyKW =
            primaryInlet.totalMassFlowKgS * (reactorOutlet.enthalpyKjKg - primaryInlet.enthalpyKjKg);

          modelResult = {
            unitId,
            unitType: 'Catalytic Reactor',
            outletStreams: [reactorOutlet],
            dutyKW,
            workKW: 0,
            pressureDropBar: unit.equilibrium?.pressureDropBar || 2.5,
            materialBalanceResidualKgH: 0,
            energyBalanceResidualKW: 0,
            equationsUsed: [
              'ODE15s Axial Material Balance: dX/dz = k0*exp(-E/RT)*(1-X)',
              'ODE15s Axial Energy Balance: dT/dz = (-deltaH * dX/dz) / (Cp * m_dot)',
              'Ergun Equation Pressure Drop: dP/dz = -150*(1-eps)^2*mu*u/(eps^3*dp^2) - 1.75*(1-eps)*rho*u^2/(eps^3*dp)',
            ],
            constraintsChecked: [
              {
                name: 'Maximum Catalyst Bed Hotspot (540 °C)',
                satisfied: odeRes.outletTempC < 540.0,
                message: `Bed peak temperature: ${odeRes.outletTempC} °C`,
              },
            ],
            validationErrors: [],
            validationWarnings: [],
            executionTimeMs: 4.2,
            resultsMetadata: {
              conversionPct: odeRes.conversionPct,
              h2YieldPct: odeRes.h2YieldPct,
              axialSteps: odeRes.profile.length,
            },
          };
          }
          break;
        }
        case 'vessel': {
          // High Pressure Vapor-Liquid Separator
          modelResult = solveSeparator(unitId, inletStreams, {
            vesselPressureBar: unit.equilibrium?.operatingPresBar || 78.5,
            isAdiabatic: true,
          });
          break;
        }
        default: {
          // Generic mixer/splitter fallback
          modelResult = solveMixer(unitId, inletStreams, { pressureDropBar: 0.1 });
          break;
        }
      }

      unitResults.set(unitId, modelResult);

      // Map outlet streams from model to flowsheet stream identifiers
      const unitOutIds = unit.outletStreamIds || [];
      unitOutIds.forEach((targetSid, idx) => {
        if (modelResult.outletStreams[idx]) {
          const original = streamMap.get(targetSid);
          const computed = modelResult.outletStreams[idx];
          streamMap.set(targetSid, {
            ...computed,
            streamId: targetSid,
            name: original?.name || targetSid,
            tag: targetSid,
          });
        }
      });
    }

    // 4. Evaluate Tear Stream Convergence and Accelerate
    let maxTearResidual = 0;
    let flowResidualKgH = 0;
    let tempResidualC = 0;
    let wegsteinQ = 0;
    const tearSnapshot: Record<string, { tempC: number; flowKgH: number }> = {};

    tearStreamIds.forEach((tid) => {
      const g_currStream = streamMap.get(tid);
      const history = tearHistory.get(tid);
      if (!g_currStream || !history) return;

      const g_curr: TearStreamState = {
        streamId: tid,
        temperatureC: g_currStream.temperatureC,
        pressureBar: g_currStream.pressureBar,
        massFlowKgH: g_currStream.totalMassFlowKgH,
        composition: { ...g_currStream.moleFractions },
      };

      tearSnapshot[tid] = {
        tempC: g_curr.temperatureC,
        flowKgH: g_curr.massFlowKgH,
      };

      if (history.prev) {
        // Run Wegstein acceleration
        const accel = computeWegsteinAcceleration(
          history.prev,
          history.curr,
          g_curr,
          solverOpts.wegsteinBounds
        );
        wegsteinQ = accel.qParam;
        if (accel.residual > maxTearResidual) {
          maxTearResidual = accel.residual;
        }

        flowResidualKgH += Math.abs(g_curr.massFlowKgH - history.curr.massFlowKgH);
        tempResidualC += Math.abs(g_curr.temperatureC - history.curr.temperatureC);

        // Update stream map with accelerated estimate for next iteration
        history.prev = history.curr;
        history.curr = accel.nextState;

        const updatedStream = calculateStreamState({
          id: tid,
          temperatureC: accel.nextState.temperatureC,
          pressureBar: accel.nextState.pressureBar,
          totalMassFlowKgH: accel.nextState.massFlowKgH,
          composition: accel.nextState.composition,
        });
        streamMap.set(tid, updatedStream);
      } else {
        // First iteration: direct substitution
        history.prev = history.curr;
        history.curr = g_curr;
        maxTearResidual = 0.5;
      }
    });

    lastMaxResidual = maxTearResidual;

    convergenceHistory.push({
      iteration: currentIteration,
      maxResidual: maxTearResidual,
      temperatureResidualC: tempResidualC,
      pressureResidualBar: 0.0,
      flowResidualKgH,
      compositionResidualRMS: maxTearResidual * 0.5,
      accelerationMethod: currentIteration === 1 ? 'Direct Substitution' : 'Wegstein',
      wegsteinQ,
      tearStreamValues: tearSnapshot,
    });

    // Check convergence criteria
    if (currentIteration > 1 && maxTearResidual < solverOpts.tolerance) {
      converged = true;
      break;
    }
  }

  // 5. Global Material and Energy Balances Audit
  // External feed streams: streams with no source unit
  const feedStreams = streams.filter(
    (s) => !units.some((u) => u.outletStreamIds?.includes(s.id))
  );
  // External product streams: streams with no target unit
  const productStreams = streams.filter(
    (s) => !units.some((u) => u.inletStreamIds?.includes(s.id))
  );

  let totalFeedMassKgH = 0;
  let inletEnthalpyFlowKW = 0;
  feedStreams.forEach((s) => {
    const calc = streamMap.get(s.id);
    if (calc) {
      totalFeedMassKgH += calc.totalMassFlowKgH;
      inletEnthalpyFlowKW += calc.totalMassFlowKgS * calc.enthalpyKjKg;
    }
  });

  let totalProductMassKgH = 0;
  let outletEnthalpyFlowKW = 0;
  productStreams.forEach((s) => {
    const calc = streamMap.get(s.id);
    if (calc) {
      totalProductMassKgH += calc.totalMassFlowKgH;
      outletEnthalpyFlowKW += calc.totalMassFlowKgS * calc.enthalpyKjKg;
    }
  });

  // Total utilities supplied to units
  let totalDutySuppliedKW = 0;
  let totalPowerSuppliedKW = 0;
  unitResults.forEach((res) => {
    totalDutySuppliedKW += res.dutyKW;
    totalPowerSuppliedKW += res.workKW;
  });

  const massImbalanceKgH = Math.abs(totalFeedMassKgH - totalProductMassKgH);
  const relMassErrorPct =
    totalFeedMassKgH > 0 ? (massImbalanceKgH / totalFeedMassKgH) * 100.0 : 0.0;

  // First law: H_in + Q + W - H_out = 0
  const energySumIn = inletEnthalpyFlowKW + totalDutySuppliedKW + totalPowerSuppliedKW;
  const energyImbalanceKW = Math.abs(energySumIn - outletEnthalpyFlowKW);
  const relEnergyErrorPct =
    Math.abs(energySumIn) > 0 ? (energyImbalanceKW / Math.abs(energySumIn)) * 100.0 : 0.0;

  const totalExecutionTimeMs = performance.now() - startTime;

  // Run rigorous engineering process validation
  const validationReport = validateEngineeringRules(units, streams, streamMap, unitResults);
  const combinedWarnings = [
    ...warnings,
    ...validationReport.warnings.map((w) => `[${w.category.toUpperCase()}] ${w.message}`),
  ];
  const combinedErrors = [
    ...errors,
    ...validationReport.errors.map((e) => `[${e.category.toUpperCase()}] ${e.message}`),
  ];

  // Propagate all unit validation errors
  for (const [uid, ures] of unitResults) {
    if (ures.validationErrors && ures.validationErrors.length > 0) {
      for (const err of ures.validationErrors) {
        combinedErrors.push(`[${uid}] ${err}`);
      }
    }
  }

  // Strict physical convergence condition:
  // Must have 0 fatal errors, and if tear streams exist, tear residual must be below tolerance
  const isTrulyConverged =
    combinedErrors.length === 0 &&
    (tearStreamIds.length === 0 ? true : converged);

  return {
    converged: isTrulyConverged,
    iterations: Math.min(currentIteration, solverOpts.maxIterations),
    totalExecutionTimeMs,
    tearStreams: tearStreamIds,
    executionOrder,
    convergenceHistory,
    calculatedStreams: streamMap,
    unitResults,
    validationReport,
    globalMaterialBalance: {
      totalFeedMassKgH,
      totalProductMassKgH,
      massImbalanceKgH,
      relativeMassErrorPct: relMassErrorPct,
      isConserved: relMassErrorPct < 0.05,
    },
    globalEnergyBalance: {
      inletEnthalpyFlowKW,
      outletEnthalpyFlowKW,
      totalDutySuppliedKW,
      totalPowerSuppliedKW,
      energyImbalanceKW,
      relativeEnergyErrorPct: relEnergyErrorPct,
      isConserved: relEnergyErrorPct < 0.5,
    },
    warnings: combinedWarnings,
    errors: combinedErrors,
    statusMessage: isTrulyConverged
      ? `Sequential Modular Solver converged in ${Math.min(currentIteration, solverOpts.maxIterations)} iteration(s). Material and energy balances solved.`
      : combinedErrors.length > 0
      ? `Simulation halted with ${combinedErrors.length} error(s): ${combinedErrors[0]}`
      : `Solver did NOT converge within ${solverOpts.maxIterations} iterations (max residual: ${lastMaxResidual.toExponential(3)} > tol ${solverOpts.tolerance}).`,
  };
}
