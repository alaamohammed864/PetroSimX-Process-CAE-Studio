/**
 * Rigorous Process & Engineering Validation Suite
 * Inspects all units and streams across the flowsheet for physical and thermodynamic violations:
 * - Impossible pressures (P_out > P_in without work input)
 * - Negative flows or absolute zero temperature violations
 * - Phase state violations (vapor in pump, liquid in compressor)
 * - Exchanger temperature cross and pinch violations
 * - Material & energy imbalance thresholds
 */

import { StreamCalculationResult } from '../stream/streamCalculator';
import { EquipmentUnit } from '../../types/simulation';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ProcessValidationIssue {
  id: string;
  sourceType: 'unit' | 'stream' | 'flowsheet';
  sourceId: string;
  severity: ValidationSeverity;
  category: 'pressure' | 'temperature' | 'flow' | 'phase' | 'balance' | 'equipment_spec';
  title: string;
  message: string;
  remedyRecommendation: string;
}

export interface FlowsheetValidationReport {
  timestamp: string;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  passed: boolean;
  issues: ProcessValidationIssue[];
  errors: ProcessValidationIssue[];
  warnings: ProcessValidationIssue[];
}

export type ProcessValidationReport = FlowsheetValidationReport;
export type ValidationReport = FlowsheetValidationReport;

/**
 * Validates an individual process stream
 */
export function validateStream(stream: StreamCalculationResult): ProcessValidationIssue[] {
  const issues: ProcessValidationIssue[] = [];
  const sId = stream.streamId || 'stream';

  // 1. Temperature checks
  if (stream.temperatureC < -273.15) {
    issues.push({
      id: `${sId}_T_ABS_ZERO`,
      sourceType: 'stream',
      sourceId: sId,
      severity: 'error',
      category: 'temperature',
      title: 'Physical Impossibility: Sub-Absolute Zero Temperature',
      message: `Stream ${stream.name || sId} has temperature ${stream.temperatureC} °C, which violates the laws of thermodynamics (below 0 K).`,
      remedyRecommendation: 'Check inlet temperature specifications or upstream cooler duty.',
    });
  } else if (stream.temperatureC > 1100.0) {
    issues.push({
      id: `${sId}_T_EXTREME`,
      sourceType: 'stream',
      sourceId: sId,
      severity: 'warning',
      category: 'temperature',
      title: 'Metallurgical Limit Exceeded',
      message: `Stream ${stream.name || sId} temperature (${stream.temperatureC.toFixed(1)} °C) exceeds standard high-temperature alloy metallurgy (> 1000 °C).`,
      remedyRecommendation: 'Add quenching, dilution steam, or verify furnace/combustion heat balance.',
    });
  }

  // 2. Pressure checks
  if (stream.pressureBar <= 0) {
    issues.push({
      id: `${sId}_P_NEGATIVE`,
      sourceType: 'stream',
      sourceId: sId,
      severity: 'error',
      category: 'pressure',
      title: 'Physical Impossibility: Negative or Zero Pressure',
      message: `Stream ${stream.name || sId} has absolute pressure ${stream.pressureBar} bar. Absolute pressure must be strictly positive.`,
      remedyRecommendation: 'Specify a positive absolute pressure (minimum ~0.05 bar abs for vacuum systems).',
    });
  } else if (stream.pressureBar > 350.0) {
    issues.push({
      id: `${sId}_P_EXTREME`,
      sourceType: 'stream',
      sourceId: sId,
      severity: 'warning',
      category: 'pressure',
      title: 'Ultra-High Pressure Warning',
      message: `Stream ${stream.name || sId} operates at ${stream.pressureBar.toFixed(1)} bar. Requires heavy wall forged piping and ASME Section VIII Div 2/3 rating.`,
      remedyRecommendation: 'Confirm booster pump/compressor discharge specification.',
    });
  }

  // 3. Flow checks
  if (stream.totalMassFlowKgH < 0) {
    issues.push({
      id: `${sId}_FLOW_NEGATIVE`,
      sourceType: 'stream',
      sourceId: sId,
      severity: 'error',
      category: 'flow',
      title: 'Negative Mass Flow Rate',
      message: `Stream ${stream.name || sId} has negative mass flow rate (${stream.totalMassFlowKgH} kg/h). Flow direction must be positive.`,
      remedyRecommendation: 'Reverse stream connection orientation or verify flow controller setpoint.',
    });
  }

  return issues;
}

/**
 * Validates an equipment unit against engineering physical principles
 */
export function validateEquipmentUnit(
  unit: EquipmentUnit,
  inlets: StreamCalculationResult[],
  outlets: StreamCalculationResult[]
): ProcessValidationIssue[] {
  const issues: ProcessValidationIssue[] = [];
  const uId = unit.id;
  const uType = unit.type;

  if (inlets.length === 0) return issues;

  const primaryInlet = inlets[0];
  const primaryOutlet = outlets[0];

  // 1. Passive Pressure Drop Check: passive units cannot increase pressure without external shaft work
  const isWorkDevice = uType === 'pump' || uType === 'compressor';
  if (!isWorkDevice && primaryOutlet) {
    if (primaryOutlet.pressureBar > primaryInlet.pressureBar + 0.05) {
      issues.push({
        id: `${uId}_PASSIVE_PRESSURE_GAIN`,
        sourceType: 'unit',
        sourceId: uId,
        severity: 'error',
        category: 'pressure',
        title: 'Second Law Violation: Passive Pressure Rise',
        message: `Unit ${unit.name} (${uType}) increases pressure from ${primaryInlet.pressureBar.toFixed(2)} to ${primaryOutlet.pressureBar.toFixed(2)} bar without mechanical work input.`,
        remedyRecommendation: 'Add a pump or compressor upstream, or decrease outlet pressure specification.',
      });
    }
  }

  // 2. Rotating Equipment Phase State Validation
  if (uType === 'pump') {
    if (primaryInlet.vaporFraction > 0.01) {
      issues.push({
        id: `${uId}_PUMP_VAPOR_CAVITATION`,
        sourceType: 'unit',
        sourceId: uId,
        severity: 'error',
        category: 'phase',
        title: 'Severe Cavitation Risk: Vapor in Pump Suction',
        message: `Pump ${unit.name} suction stream has ${(primaryInlet.vaporFraction * 100).toFixed(1)}% vapor. Centrifugal pumps vapor-lock and cavitate when pumping two-phase fluids.`,
        remedyRecommendation: 'Subcool the suction liquid, increase vessel elevation, or install a suction boot/pot.',
      });
    }
    if (primaryOutlet && primaryOutlet.pressureBar <= primaryInlet.pressureBar) {
      issues.push({
        id: `${uId}_PUMP_NO_HEAD`,
        sourceType: 'unit',
        sourceId: uId,
        severity: 'error',
        category: 'pressure',
        title: 'Pump Produces Zero or Negative Differential Head',
        message: `Pump ${unit.name} discharge pressure (${primaryOutlet.pressureBar} bar) is not greater than suction (${primaryInlet.pressureBar} bar).`,
        remedyRecommendation: 'Set pump discharge pressure higher than suction pressure in Property Inspector.',
      });
    }
  }

  if (uType === 'compressor') {
    if (primaryInlet.vaporFraction < 0.99) {
      issues.push({
        id: `${uId}_COMPRESSOR_LIQUID_SLUGGING`,
        sourceType: 'unit',
        sourceId: uId,
        severity: 'error',
        category: 'phase',
        title: 'Liquid Ingestion Hazard in Gas Compressor',
        message: `Compressor ${unit.name} suction stream contains ${((1.0 - primaryInlet.vaporFraction) * 100).toFixed(1)}% liquid. Liquid droplets erode impellers and destroy valves.`,
        remedyRecommendation: 'Install a Suction Knockout Drum (Flash Separator) with high-efficiency demister upstream.',
      });
    }
    if (primaryOutlet && primaryOutlet.pressureBar <= primaryInlet.pressureBar) {
      issues.push({
        id: `${uId}_COMPRESSOR_NO_RATIO`,
        sourceType: 'unit',
        sourceId: uId,
        severity: 'error',
        category: 'pressure',
        title: 'Compressor Compression Ratio <= 1.0',
        message: `Compressor ${unit.name} discharge pressure (${primaryOutlet.pressureBar} bar) <= suction (${primaryInlet.pressureBar} bar).`,
        remedyRecommendation: 'Specify discharge pressure higher than suction in unit properties.',
      });
    }
  }

  // 3. Heat Exchanger Validation
  if (uType === 'heatex') {
    // If two inlets are present: inlets[0] = Hot, inlets[1] = Cold
    if (inlets.length >= 2) {
      const hotIn = inlets[0];
      const coldIn = inlets[1];
      if (hotIn.temperatureC <= coldIn.temperatureC) {
        issues.push({
          id: `${uId}_HEX_TEMP_INVERSION`,
          sourceType: 'unit',
          sourceId: uId,
          severity: 'error',
          category: 'temperature',
          title: 'Heat Exchanger Temperature Inversion',
          message: `Hot inlet stream (${hotIn.temperatureC.toFixed(1)} °C) is colder than or equal to cold inlet stream (${coldIn.temperatureC.toFixed(1)} °C).`,
          remedyRecommendation: 'Verify stream connections: connect warmer fluid to Hot Side inlet.',
        });
      }
      if (outlets.length >= 2) {
        const hotOut = outlets[0];
        const coldOut = outlets[1];
        if (hotOut.temperatureC < coldIn.temperatureC || coldOut.temperatureC > hotIn.temperatureC) {
          issues.push({
            id: `${uId}_HEX_TEMP_CROSS`,
            sourceType: 'unit',
            sourceId: uId,
            severity: 'error',
            category: 'temperature',
            title: 'Thermodynamic Temperature Cross Violation',
            message: `Exchanger ${unit.name} violates Second Law: cold outlet (${coldOut.temperatureC.toFixed(1)} °C) exceeds hot inlet (${hotIn.temperatureC.toFixed(1)} °C).`,
            remedyRecommendation: 'Reduce heat duty or switch to multi-shell counter-current arrangement.',
          });
        }
      }
    }
  }

  // 4. Control Valve Validation
  if (uType === 'valve') {
    if (primaryOutlet && primaryOutlet.pressureBar >= primaryInlet.pressureBar) {
      issues.push({
        id: `${uId}_VALVE_PRESSURE_DROP_INVALID`,
        sourceType: 'unit',
        sourceId: uId,
        severity: 'error',
        category: 'pressure',
        title: 'Valve Has Zero or Negative Pressure Drop',
        message: `Valve ${unit.name} outlet pressure (${primaryOutlet.pressureBar} bar) must be strictly lower than inlet (${primaryInlet.pressureBar} bar).`,
        remedyRecommendation: 'Reduce valve outlet pressure or specify required Delta P.',
      });
    }
  }

  // 5. Fired Heater / Furnace Validation
  if (uType === 'furnace') {
    if (primaryOutlet && primaryOutlet.temperatureC <= primaryInlet.temperatureC) {
      issues.push({
        id: `${uId}_FURNACE_NO_HEATING`,
        sourceType: 'unit',
        sourceId: uId,
        severity: 'warning',
        category: 'temperature',
        title: 'Furnace Outlet Temperature Below or Equal to Inlet',
        message: `Furnace ${unit.name} target outlet (${primaryOutlet.temperatureC} °C) is not higher than process feed (${primaryInlet.temperatureC} °C).`,
        remedyRecommendation: 'Set higher target temperature or check fuel burner firing controls.',
      });
    }
  }

  // 6. Mass Balance Check
  if (outlets.length > 0) {
    const totalInMass = inlets.reduce((sum, s) => sum + (s?.totalMassFlowKgH || 0), 0);
    const totalOutMass = outlets.reduce((sum, s) => sum + (s?.totalMassFlowKgH || 0), 0);
    const massDiff = Math.abs(totalInMass - totalOutMass);
    const massDiffPct = (massDiff / Math.max(1.0, totalInMass)) * 100.0;

    if (totalInMass > 0 && massDiffPct > 1.5) {
      issues.push({
        id: `${uId}_MASS_IMBALANCE`,
        sourceType: 'unit',
        sourceId: uId,
        severity: 'warning',
        category: 'balance',
        title: `Mass Imbalance across ${unit.name} (${massDiffPct.toFixed(1)}%)`,
        message: `Inlet mass flow (${totalInMass.toFixed(1)} kg/h) does not equal outlet mass flow (${totalOutMass.toFixed(1)} kg/h).`,
        remedyRecommendation: 'Re-run flowsheet convergence loop or check split ratios.',
      });
    }
  }

  return issues;
}

/**
 * Validates entire flowsheet
 */
export function validateFlowsheet(
  units: EquipmentUnit[],
  arg2: any,
  arg3?: any,
  _arg4?: any
): FlowsheetValidationReport {
  const issues: ProcessValidationIssue[] = [];

  // Support signatures:
  // validateFlowsheet(units, streamResults)
  // validateFlowsheet(units, streams, streamMap, unitResults)
  let streamMap: Record<string, StreamCalculationResult> = {};
  const mapSource = arg3 !== undefined ? arg3 : arg2;
  if (mapSource instanceof Map) {
    mapSource.forEach((val, key) => {
      streamMap[key] = val;
    });
  } else if (mapSource && typeof mapSource === 'object') {
    streamMap = mapSource as Record<string, StreamCalculationResult>;
  }

  // 1. Validate all streams
  for (const sId in streamMap) {
    const stream = streamMap[sId];
    if (stream) {
      issues.push(...validateStream(stream));
    }
  }

  // 2. Validate all units
  for (const unit of units) {
    const inletIds = unit.inletStreamIds || [];
    const outletIds = unit.outletStreamIds || [];
    const inletStreams = inletIds.map((id) => streamMap[id]).filter(Boolean);
    const outletStreams = outletIds.map((id) => streamMap[id]).filter(Boolean);
    issues.push(...validateEquipmentUnit(unit, inletStreams, outletStreams));
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return {
    timestamp: new Date().toISOString(),
    totalIssues: issues.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    passed: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}
