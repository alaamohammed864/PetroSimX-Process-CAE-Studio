/**
 * PetroSimX Case Management Engine
 * Creates, clones, stores, and compares multiple simulation cases (Base Case, Case 01, Case 02, etc.)
 */

import { EquipmentUnit, ProcessStream } from '../../types/simulation';
import { ProcessCase, ProcessCaseSummary } from '../../types/optimization';

/**
 * Generates initial benchmark process cases for the platform
 */
export function createDefaultBenchmarkCases(
  baseUnits: EquipmentUnit[],
  baseStreams: ProcessStream[]
): ProcessCase[] {
  // 1. Base Case
  const baseCase: ProcessCase = {
    id: 'case_base',
    name: 'Base Case (Design Nominal)',
    description: 'Nominal commercial steady-state operation at 45,000 kg/h intake and 512.0 °C reactor inlet.',
    timestamp: new Date().toISOString(),
    isBaseCase: true,
    units: JSON.parse(JSON.stringify(baseUnits)),
    streams: JSON.parse(JSON.stringify(baseStreams)),
    tags: ['Design Nominal', 'Standard Metallurgy', 'Verified'],
    summary: {
      feedFlowKgH: 45000,
      productFlowKgH: 38250,
      productYieldPct: 85.0,
      conversionPct: 82.5,
      furnaceDutyMW: 8.5,
      compressorPowerKW: 1250,
      reboilerDutyMW: 4.2,
      totalEnergyMW: 13.95,
      co2EmissionsKgH: 3090,
      operatingCostPerHour: 485,
      netMarginPerHour: 4725,
      solverConverged: true,
      iterations: 8,
    },
  };

  // 2. Case 01: High Severity (Max Aromatics & RON)
  const case01Units = JSON.parse(JSON.stringify(baseUnits)) as EquipmentUnit[];
  const case01Streams = JSON.parse(JSON.stringify(baseStreams)) as ProcessStream[];
  const r101_c1 = case01Units.find((u) => u.id === 'R-101');
  if (r101_c1 && r101_c1.equilibrium) {
    r101_c1.equilibrium.inletTempC = 524.0;
    r101_c1.equilibrium.operatingPresBar = 25.0;
    r101_c1.equilibrium.h2hcTreatRatioNm3M3 = 720.0;
  }
  const case01: ProcessCase = {
    id: 'case_01',
    name: 'Case 01: High Severity Reformate',
    description: 'Elevated reactor inlet temperature (+12 °C) maximizing dehydrogenation conversion and RON.',
    timestamp: new Date().toISOString(),
    isBaseCase: false,
    units: case01Units,
    streams: case01Streams,
    tags: ['High Severity', 'Max Octane', 'Higher Duty'],
    summary: {
      feedFlowKgH: 45000,
      productFlowKgH: 39600,
      productYieldPct: 88.0,
      conversionPct: 91.2,
      furnaceDutyMW: 10.2,
      compressorPowerKW: 1420,
      reboilerDutyMW: 4.5,
      totalEnergyMW: 16.12,
      co2EmissionsKgH: 3560,
      operatingCostPerHour: 560,
      netMarginPerHour: 5210,
      solverConverged: true,
      iterations: 11,
    },
  };

  // 3. Case 02: Low Carbon & Energy Conservation
  const case02Units = JSON.parse(JSON.stringify(baseUnits)) as EquipmentUnit[];
  const case02Streams = JSON.parse(JSON.stringify(baseStreams)) as ProcessStream[];
  const r101_c2 = case02Units.find((u) => u.id === 'R-101');
  if (r101_c2 && r101_c2.equilibrium) {
    r101_c2.equilibrium.inletTempC = 498.0;
    r101_c2.equilibrium.operatingPresBar = 30.0;
    r101_c2.equilibrium.h2hcTreatRatioNm3M3 = 540.0;
  }
  const case02: ProcessCase = {
    id: 'case_02',
    name: 'Case 02: Low Energy Eco-Mode',
    description: 'Reduced furnace fuel firing and lower recycle gas circulation to minimize Scope 1 emissions.',
    timestamp: new Date().toISOString(),
    isBaseCase: false,
    units: case02Units,
    streams: case02Streams,
    tags: ['Low Carbon', 'Energy Saving', 'Reduced Emissions'],
    summary: {
      feedFlowKgH: 45000,
      productFlowKgH: 36900,
      productYieldPct: 82.0,
      conversionPct: 74.8,
      furnaceDutyMW: 6.8,
      compressorPowerKW: 980,
      reboilerDutyMW: 3.8,
      totalEnergyMW: 11.58,
      co2EmissionsKgH: 2560,
      operatingCostPerHour: 405,
      netMarginPerHour: 4310,
      solverConverged: true,
      iterations: 7,
    },
  };

  // 4. Case 03: Debottlenecked +15% Throughput
  const case03Units = JSON.parse(JSON.stringify(baseUnits)) as EquipmentUnit[];
  const case03Streams = JSON.parse(JSON.stringify(baseStreams)) as ProcessStream[];
  const s101_c3 = case03Streams.find((s) => s.id === 'S-101');
  if (s101_c3) s101_c3.flowKgH = 51750;
  const case03: ProcessCase = {
    id: 'case_03',
    name: 'Case 03: +15% Hydraulic Capacity',
    description: 'Throughput stretch to 51,750 kg/h feed testing column vapor loading and pump discharge margins.',
    timestamp: new Date().toISOString(),
    isBaseCase: false,
    units: case03Units,
    streams: case03Streams,
    tags: ['High Throughput', 'Debottlenecking', 'Hydraulic Stretch'],
    summary: {
      feedFlowKgH: 51750,
      productFlowKgH: 43850,
      productYieldPct: 84.7,
      conversionPct: 81.0,
      furnaceDutyMW: 9.75,
      compressorPowerKW: 1440,
      reboilerDutyMW: 4.85,
      totalEnergyMW: 16.04,
      co2EmissionsKgH: 3550,
      operatingCostPerHour: 555,
      netMarginPerHour: 5480,
      solverConverged: true,
      iterations: 9,
    },
  };

  return [baseCase, case01, case02, case03];
}

/**
 * Creates a new custom case from current flowsheet state
 */
export function createCaseFromCurrentState(
  name: string,
  description: string,
  units: EquipmentUnit[],
  streams: ProcessStream[],
  summary: ProcessCaseSummary,
  tags: string[] = ['User Snapshot']
): ProcessCase {
  return {
    id: `case_${Date.now()}`,
    name: name || `Case ${new Date().toLocaleTimeString()}`,
    description: description || 'User custom flowsheet operating state snapshot.',
    timestamp: new Date().toISOString(),
    isBaseCase: false,
    units: JSON.parse(JSON.stringify(units)),
    streams: JSON.parse(JSON.stringify(streams)),
    summary,
    tags,
  };
}

/**
 * Exports case comparison matrix to CSV
 */
export function exportCaseComparisonToCSV(cases: ProcessCase[]): string {
  const base = cases.find((c) => c.isBaseCase) || cases[0];
  const headers = [
    'Metric',
    'Unit',
    ...cases.map((c) => c.name.replace(/,/g, '')),
  ];

  const metricsRow = [
    ['Feed Rate', 'kg/h', ...cases.map((c) => c.summary.feedFlowKgH)],
    ['Product Rate', 'kg/h', ...cases.map((c) => c.summary.productFlowKgH)],
    ['Product Yield', '%', ...cases.map((c) => c.summary.productYieldPct)],
    ['Reactant Conversion', '%', ...cases.map((c) => c.summary.conversionPct)],
    ['Furnace Duty', 'MW', ...cases.map((c) => c.summary.furnaceDutyMW)],
    ['Compressor Power', 'kW', ...cases.map((c) => c.summary.compressorPowerKW)],
    ['Reboiler Duty', 'MW', ...cases.map((c) => c.summary.reboilerDutyMW)],
    ['Total Energy Consumption', 'MW', ...cases.map((c) => c.summary.totalEnergyMW)],
    ['CO2 Emissions', 'kg/h', ...cases.map((c) => c.summary.co2EmissionsKgH)],
    ['Operating Cost', '$/h', ...cases.map((c) => c.summary.operatingCostPerHour)],
    ['Net Margin', '$/h', ...cases.map((c) => c.summary.netMarginPerHour)],
    ['Solver Status', '-', ...cases.map((c) => (c.summary.solverConverged ? 'CONVERGED' : 'DIVERGED'))],
    ['Solver Iterations', 'count', ...cases.map((c) => c.summary.iterations)],
  ];

  return [headers.join(','), ...metricsRow.map((r) => r.join(','))].join('\n');
}
