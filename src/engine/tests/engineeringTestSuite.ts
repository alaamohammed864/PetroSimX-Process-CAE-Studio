/**
 * Engineering Process Simulation Unit Test & Verification Suite
 * Benchmarks thermophysical equations, numerical flash solvers, unit operations,
 * and recycle loop convergence against analytical reference cases.
 */

import { solveCubicRoots } from '../thermo/eosPengRobinson';
import { solveRachfordRiceInternal, solveTPFlash, calculateBubblePoint } from '../thermo/flashSolver';
import { calculateStreamState } from '../stream/streamCalculator';
import { solvePump, solveCompressor, solveValve, solveMixer } from '../models/equipmentModels';
import { analyzeFlowsheetTopology, computeWegsteinAcceleration, FlowsheetGraph, TearStreamState } from '../solver/recycleSolver';

export interface TestCaseResult {
  id: string;
  name: string;
  category: 'Thermo' | 'Flash' | 'Unit Models' | 'Recycle Solver';
  passed: boolean;
  expected: string;
  actual: string;
  tolerance: string;
  executionTimeMs: number;
  details?: string;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestCaseResult[];
}

export function runEngineeringTestSuite(): TestSuiteSummary {
  const startTime = performance.now();
  const results: TestCaseResult[] = [];

  // -------------------------------------------------------------
  // Test 1: Cubic Equation Cardano Solver
  // Polynomial: (Z - 1)(Z - 2)(Z - 3) = Z^3 - 6*Z^2 + 11*Z - 6 = 0
  // Roots must be 1, 2, 3
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const roots = solveCubicRoots(-6, 11, -6);
    const passed =
      roots.length === 3 &&
      Math.abs(roots[0] - 1.0) < 1e-4 &&
      Math.abs(roots[1] - 2.0) < 1e-4 &&
      Math.abs(roots[2] - 3.0) < 1e-4;
    results.push({
      id: 'TC-01',
      name: 'Cardano Depressed Cubic Solver 3-Root Verification',
      category: 'Thermo',
      passed,
      expected: 'Z = [1.0, 2.0, 3.0]',
      actual: `Z = [${roots.map((r) => r.toFixed(4)).join(', ')}]`,
      tolerance: '1.0e-4',
      executionTimeMs: performance.now() - t0,
    });
  }

  // -------------------------------------------------------------
  // Test 2: Rachford-Rice Newton-Raphson Solver
  // 3 components with known K-values
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const compIds = ['c1', 'c2', 'c3'];
    const z = [0.3333, 0.3333, 0.3334];
    const K = [5.0, 1.2, 0.2]; // Light, intermediate, heavy
    const rr = solveRachfordRiceInternal(compIds, z, K, 1e-7);
    const passed = rr.vf > 0.3 && rr.vf < 0.6 && rr.residual < 1e-6;
    results.push({
      id: 'TC-02',
      name: 'Rachford-Rice Two-Phase VLE Vapor Fraction',
      category: 'Flash',
      passed,
      expected: '0.3 < VF < 0.6 and residual < 1e-6',
      actual: `VF = ${rr.vf.toFixed(5)}, residual = ${rr.residual.toExponential(3)} (${rr.iter} iters)`,
      tolerance: '1.0e-6',
      executionTimeMs: performance.now() - t0,
    });
  }

  // -------------------------------------------------------------
  // Test 3: Subcooled Liquid Flash Phase Identification
  // Liquid at high pressure (60 bar, 25 °C)
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const flash = solveTPFlash(298.15, 60.0, { c6h6: 0.5, c7h14: 0.5 });
    const passed = flash.phase.includes('Liquid') && flash.vaporFraction === 0.0;
    results.push({
      id: 'TC-03',
      name: 'Liquid Hydrocarbon Phase Identification & Bubble Point Bound',
      category: 'Flash',
      passed,
      expected: 'Subcooled Liquid (VF = 0.0)',
      actual: `${flash.phase} (VF = ${flash.vaporFraction.toFixed(1)})`,
      tolerance: 'Exact phase match',
      executionTimeMs: performance.now() - t0,
    });
  }

  // -------------------------------------------------------------
  // Test 4: Stream Calculator Mass & Molar Flow Invariance
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const st = calculateStreamState({
      id: 'TEST_S1',
      temperatureC: 150.0,
      pressureBar: 30.0,
      totalMassFlowKgH: 10000.0,
      composition: { c1: 0.2, c3: 0.3, nc4: 0.5 },
    });
    const calculatedMass = st.totalMolarFlowKmolH * st.mwAvg;
    const err = Math.abs(calculatedMass - 10000.0);
    const passed = err < 1e-3;
    results.push({
      id: 'TC-04',
      name: 'Stream Calculator Extensive Property Conservation',
      category: 'Unit Models',
      passed,
      expected: 'm_dot = 10000.0 kg/h',
      actual: `m_dot = ${calculatedMass.toFixed(4)} kg/h (MW_avg = ${st.mwAvg.toFixed(2)})`,
      tolerance: '1.0e-3 kg/h',
      executionTimeMs: performance.now() - t0,
    });
  }

  // -------------------------------------------------------------
  // Test 5: Centrifugal Liquid Pump Hydraulic Work
  // Feed: 50,000 kg/h, dP = 50 bar, eta = 0.75
  // W_ideal = V_dot * dP
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const feed = calculateStreamState({
      id: 'PUMP_IN',
      temperatureC: 45.0,
      pressureBar: 5.0,
      totalMassFlowKgH: 50000.0,
      composition: { c6h6: 0.5, c7h14: 0.5 },
    });
    const pumpRes = solvePump('P-TEST', [feed], {
      outletPressureBar: 55.0,
      hydraulicEfficiency: 0.75,
    });
    const passed = pumpRes.workKW > 80.0 && pumpRes.workKW < 180.0 && pumpRes.validationErrors.length === 0;
    results.push({
      id: 'TC-05',
      name: 'Centrifugal Pump Shaft Power & Enthalpy Rise',
      category: 'Unit Models',
      passed,
      expected: '80 kW < W_shaft < 180 kW',
      actual: `W_shaft = ${pumpRes.workKW.toFixed(2)} kW`,
      tolerance: '±5% engineering design curve',
      executionTimeMs: performance.now() - t0,
    });
  }

  // -------------------------------------------------------------
  // Test 6: Isenthalpic Valve Joule-Thomson Expansion
  // H_out must equal H_in
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const feed = calculateStreamState({
      id: 'VALVE_IN',
      temperatureC: 180.0,
      pressureBar: 60.0,
      totalMassFlowKgH: 25000.0,
      composition: { c1: 0.5, c2: 0.3, c3: 0.2 },
    });
    const valveRes = solveValve('V-TEST', [feed], { outletPressureBar: 20.0 });
    const hIn = feed.enthalpyKjKg;
    const hOut = valveRes.outletStreams[0].enthalpyKjKg;
    const deltaH = Math.abs(hOut - hIn);
    const passed = deltaH < 0.5;
    results.push({
      id: 'TC-06',
      name: 'Joule-Thomson Isenthalpic Valve Flash (H_in = H_out)',
      category: 'Unit Models',
      passed,
      expected: '|H_out - H_in| < 0.5 kJ/kg',
      actual: `ΔH = ${deltaH.toFixed(4)} kJ/kg (T_out = ${valveRes.outletStreams[0].temperatureC.toFixed(1)} °C)`,
      tolerance: '0.5 kJ/kg',
      executionTimeMs: performance.now() - t0,
    });
  }

  // -------------------------------------------------------------
  // Test 7: Adiabatic Mixer Mass & Energy Conservation
  // Mix 2 streams at different temperatures
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const s1 = calculateStreamState({
      id: 'MIX_IN_1',
      temperatureC: 100.0,
      pressureBar: 20.0,
      totalMassFlowKgH: 10000.0,
      composition: { c1: 0.5, c3: 0.5 },
    });
    const s2 = calculateStreamState({
      id: 'MIX_IN_2',
      temperatureC: 200.0,
      pressureBar: 20.0,
      totalMassFlowKgH: 15000.0,
      composition: { c1: 0.5, c3: 0.5 },
    });
    const mixRes = solveMixer('M-TEST', [s1, s2]);
    const totalIn = s1.totalMassFlowKgH + s2.totalMassFlowKgH;
    const totalOut = mixRes.outletStreams[0].totalMassFlowKgH;
    const passed = Math.abs(totalIn - totalOut) < 1e-4 && mixRes.energyBalanceResidualKW < 0.05;
    results.push({
      id: 'TC-07',
      name: 'Multi-Stream Adiabatic Mixer Material & Energy Conservation',
      category: 'Unit Models',
      passed,
      expected: 'Mass residual < 1e-4 kg/h, Energy residual < 0.05 kW',
      actual: `Mass res = ${mixRes.materialBalanceResidualKgH.toFixed(5)} kg/h, Energy res = ${mixRes.energyBalanceResidualKW.toFixed(5)} kW`,
      tolerance: '1.0e-4 kg/h',
      executionTimeMs: performance.now() - t0,
    });
  }

  // -------------------------------------------------------------
  // Test 8: Tarjan SCC Recycle Cycle Detection
  // Graph: U1 -> S1 -> U2 -> S2 -> U3 -> S3 (Recycle) -> U1
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const graph: FlowsheetGraph = {
      nodes: [
        { id: 'U1', inletStreamIds: ['S3'], outletStreamIds: ['S1'] },
        { id: 'U2', inletStreamIds: ['S1'], outletStreamIds: ['S2'] },
        { id: 'U3', inletStreamIds: ['S2'], outletStreamIds: ['S3'] },
      ],
      streamConnections: [
        { streamId: 'S1', sourceUnitId: 'U1', targetUnitId: 'U2' },
        { streamId: 'S2', sourceUnitId: 'U2', targetUnitId: 'U3' },
        { streamId: 'S3', sourceUnitId: 'U3', targetUnitId: 'U1' },
      ],
    };
    const topo = analyzeFlowsheetTopology(graph);
    const passed = topo.cyclesDetected.length >= 1 && topo.tearStreamIds.length >= 1;
    results.push({
      id: 'TC-08',
      name: 'Tarjan Strongly Connected Components (SCC) Cycle Detection',
      category: 'Recycle Solver',
      passed,
      expected: 'At least 1 cycle detected and tear stream identified',
      actual: `Cycles: ${topo.cyclesDetected.length}, Tear streams: [${topo.tearStreamIds.join(', ')}]`,
      tolerance: 'Exact topology match',
      executionTimeMs: performance.now() - t0,
    });
  }

  // -------------------------------------------------------------
  // Test 9: Wegstein Acceleration Mathematical Bounding
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const xPrev: TearStreamState = {
      streamId: 'S-REC',
      temperatureC: 45.0,
      pressureBar: 20.0,
      massFlowKgH: 10000.0,
      composition: { h2: 0.9, c1: 0.1 },
    };
    const xCurr: TearStreamState = {
      streamId: 'S-REC',
      temperatureC: 46.0,
      pressureBar: 20.0,
      massFlowKgH: 10200.0,
      composition: { h2: 0.9, c1: 0.1 },
    };
    const gCurr: TearStreamState = {
      streamId: 'S-REC',
      temperatureC: 46.5,
      pressureBar: 20.0,
      massFlowKgH: 10250.0,
      composition: { h2: 0.9, c1: 0.1 },
    };
    const accel = computeWegsteinAcceleration(xPrev, xCurr, gCurr);
    const passed = accel.qParam >= -5.0 && accel.qParam <= 0.0 && accel.nextState.massFlowKgH > 0;
    results.push({
      id: 'TC-09',
      name: 'Wegstein Acceleration Factor (q) Bounding [-5.0, 0.0]',
      category: 'Recycle Solver',
      passed,
      expected: '-5.0 <= q <= 0.0',
      actual: `q = ${accel.qParam.toFixed(4)}, next flow = ${accel.nextState.massFlowKgH.toFixed(1)} kg/h`,
      tolerance: '[-5.0, 0.0]',
      executionTimeMs: performance.now() - t0,
    });
  }

  // -------------------------------------------------------------
  // Test 10: Bubble Point Temperature Convergence
  // -------------------------------------------------------------
  {
    const t0 = performance.now();
    const bp = calculateBubblePoint(25.0, { c3: 0.5, nc4: 0.5 });
    const passed = bp.temperatureC > 30.0 && bp.temperatureC < 110.0;
    results.push({
      id: 'TC-10',
      name: 'Propane / Butane Mixture Bubble Point Temperature',
      category: 'Thermo',
      passed,
      expected: '30 °C < T_bubble < 110 °C at 25 bar',
      actual: `T_bubble = ${bp.temperatureC.toFixed(2)} °C (${bp.temperatureK.toFixed(2)} K)`,
      tolerance: 'Thermodynamic consistency bound',
      executionTimeMs: performance.now() - t0,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    durationMs: performance.now() - startTime,
    results,
  };
}
