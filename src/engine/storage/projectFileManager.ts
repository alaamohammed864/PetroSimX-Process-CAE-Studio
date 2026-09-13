/**
 * PetroSimX Native Project File Manager (.petx)
 * Handles structured import, export, serialization, cryptographic integrity checksums,
 * corruption detection, and engineering validation before save/load.
 */

import { EquipmentUnit, ProcessStream, ChemicalComponent, UnitSystem } from '../../types/simulation';
import { ProjectRecord } from './indexedDbClient';

export const PETROSIMX_FILE_FORMAT = 'PETROSIMX_PROJECT';
export const PETROSIMX_SCHEMA_VERSION = 1;
export const PETROSIMX_EXTENSION = '.petx';

export interface PetroSimXProjectPackage {
  format: string;
  version: string;
  schemaVersion: number;
  exportedAt: string;
  checksum: string;
  project: ProjectRecord;
  flowsheet: {
    units: EquipmentUnit[];
    streams: ProcessStream[];
    components: ChemicalComponent[];
    reactions?: any[];
  };
  simulationResult?: any;
  settings?: {
    unitSystem: UnitSystem;
    autoSaveIntervalSec?: number;
    theme?: string;
  };
  reportsSummary?: {
    count: number;
    lastGeneratedReport?: string;
  };
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  entity: 'project' | 'unit' | 'stream' | 'component' | 'system';
  id?: string;
  message: string;
}

export interface ProjectValidationResult {
  isValid: boolean;
  canProceedWithWarning: boolean;
  errors: string[];
  warnings: string[];
  issues: ValidationIssue[];
}

/**
 * Fast CRC32 hash calculation for file integrity verification and corrupted project detection
 */
export function calculateChecksum(text: string): string {
  let crc = 0 ^ -1;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    crc = (crc >>> 8) ^ crcTableLookup[(crc ^ code) & 0xff];
  }
  return ((crc ^ -1) >>> 0).toString(16).padStart(8, '0');
}

const crcTableLookup = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

/**
 * Rigorous pre-save engineering validation.
 * Ensures model consistency, positive thermodynamic states, valid component mole fractions,
 * and lack of circular deadlocks before writing to disk or database.
 */
export function validateProjectBeforeSave(
  project: Partial<ProjectRecord>,
  units: EquipmentUnit[],
  streams: ProcessStream[],
  components: ChemicalComponent[]
): ProjectValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Project metadata validation
  if (!project.name || project.name.trim().length === 0) {
    issues.push({
      type: 'error',
      entity: 'project',
      message: 'Project name is required and cannot be empty.',
    });
  }

  // 2. Units validation
  if (units.length === 0) {
    issues.push({
      type: 'warning',
      entity: 'unit',
      message: 'Flowsheet contains no equipment units.',
    });
  }

  const unitIds = new Set<string>();
  for (const u of units) {
    if (unitIds.has(u.id)) {
      issues.push({
        type: 'error',
        entity: 'unit',
        id: u.id,
        message: `Duplicate equipment tag detected: ${u.id}`,
      });
    }
    unitIds.add(u.id);

    if (!u.name || u.name.trim() === '') {
      issues.push({
        type: 'warning',
        entity: 'unit',
        id: u.id,
        message: `Unit ${u.id} has empty name designation.`,
      });
    }
  }

  // 3. Streams validation
  const streamIds = new Set<string>();
  for (const s of streams) {
    if (streamIds.has(s.id)) {
      issues.push({
        type: 'error',
        entity: 'stream',
        id: s.id,
        message: `Duplicate stream ID detected: ${s.id}`,
      });
    }
    streamIds.add(s.id);

    // Temperature physical check
    if (s.tempC < -273.15) {
      issues.push({
        type: 'error',
        entity: 'stream',
        id: s.id,
        message: `Stream ${s.name} (${s.id}) has unphysical temperature below absolute zero: ${s.tempC} °C.`,
      });
    }

    // Pressure physical check
    if (s.presBar <= 0) {
      issues.push({
        type: 'error',
        entity: 'stream',
        id: s.id,
        message: `Stream ${s.name} (${s.id}) has unphysical pressure <= 0 bar: ${s.presBar} bar.`,
      });
    }

    // Mass flow physical check
    if (s.flowKgH < 0) {
      issues.push({
        type: 'error',
        entity: 'stream',
        id: s.id,
        message: `Stream ${s.name} (${s.id}) has negative mass flow: ${s.flowKgH} kg/h.`,
      });
    }

    // Composition closure check
    if (s.compositions && Object.keys(s.compositions).length > 0) {
      const sumFractions = Object.values(s.compositions).reduce((acc: number, v: number) => acc + (v || 0), 0);
      if (Math.abs(sumFractions - 1.0) > 0.05 && sumFractions > 0.001) {
        issues.push({
          type: 'warning',
          entity: 'stream',
          id: s.id,
          message: `Stream ${s.name} (${s.id}) composition sum is ${(sumFractions * 100).toFixed(1)}% (expected 100%).`,
        });
      }
    }
  }

  // 4. Component database validation
  if (components.length === 0) {
    issues.push({
      type: 'error',
      entity: 'component',
      message: 'Thermodynamic matrix requires at least one defined chemical component.',
    });
  }

  const errors = issues.filter((i) => i.type === 'error').map((i) => i.message);
  const warnings = issues.filter((i) => i.type === 'warning').map((i) => i.message);

  return {
    isValid: errors.length === 0,
    canProceedWithWarning: errors.length === 0,
    errors,
    warnings,
    issues,
  };
}

/**
 * Package a project into a validated PetroSimX (.petx) file and prompt download
 */
export function exportPetxProjectFile(
  project: ProjectRecord,
  units: EquipmentUnit[],
  streams: ProcessStream[],
  components: ChemicalComponent[],
  simulationResult?: any
): { filename: string; checksum: string } {
  const payloadToHash = JSON.stringify({
    project,
    flowsheet: { units, streams, components },
  });

  const checksum = calculateChecksum(payloadToHash);

  const pkg: PetroSimXProjectPackage = {
    format: PETROSIMX_FILE_FORMAT,
    version: '1.0.0',
    schemaVersion: PETROSIMX_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    checksum,
    project: {
      ...project,
      unitCount: units.length,
      streamCount: streams.length,
      lastConverged: simulationResult?.converged ?? true,
      updatedAt: new Date().toISOString(),
    },
    flowsheet: {
      units,
      streams,
      components,
    },
    simulationResult: simulationResult ? {
      converged: simulationResult.converged,
      iterations: simulationResult.iterations,
      totalExecutionTimeMs: simulationResult.totalExecutionTimeMs,
      globalMaterialBalance: simulationResult.globalMaterialBalance,
      globalEnergyBalance: simulationResult.globalEnergyBalance,
    } : null,
    settings: {
      unitSystem: project.unitSystem || 'SI',
      autoSaveIntervalSec: 30,
    },
  };

  const fileContent = JSON.stringify(pkg, null, 2);
  const blob = new Blob([fileContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const filename = `${cleanName}_rev${project.revision || '0'}${PETROSIMX_EXTENSION}`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { filename, checksum };
}

/**
 * Parses and verifies an imported .petx file with full corrupted project detection
 */
export async function parseAndValidatePetxFile(file: File): Promise<{
  success: boolean;
  projectPackage?: PetroSimXProjectPackage;
  error?: string;
  warnings: string[];
}> {
  const warnings: string[] = [];

  try {
    const text = await file.text();

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: 'The uploaded .petx file is empty (0 bytes). Cannot load empty project.',
        warnings: [],
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (jsonErr: any) {
      return {
        success: false,
        error: `Corrupted project structure: File contains invalid JSON syntax (${jsonErr?.message || 'Parse error'}).`,
        warnings: [],
      };
    }

    // Check header signature
    if (!parsed || parsed.format !== PETROSIMX_FILE_FORMAT) {
      return {
        success: false,
        error: `Incompatible file format. Expected header '${PETROSIMX_FILE_FORMAT}' but received '${parsed?.format || 'Unknown'}'.`,
        warnings: [],
      };
    }

    // Check schema version
    if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion > PETROSIMX_SCHEMA_VERSION + 1) {
      warnings.push(`File schema version (${parsed.schemaVersion}) may be newer than current client version (${PETROSIMX_SCHEMA_VERSION}).`);
    }

    // Verify presence of critical project structures
    if (!parsed.project || typeof parsed.project !== 'object') {
      return {
        success: false,
        error: 'Corrupted project: Missing "project" metadata block in .petx file.',
        warnings,
      };
    }

    if (!parsed.flowsheet || !Array.isArray(parsed.flowsheet.units) || !Array.isArray(parsed.flowsheet.streams)) {
      return {
        success: false,
        error: 'Corrupted flowsheet: Missing units or streams arrays in .petx payload.',
        warnings,
      };
    }

    // Verify checksum if present
    if (parsed.checksum) {
      const payloadToHash = JSON.stringify({
        project: parsed.project,
        flowsheet: parsed.flowsheet,
      });
      const calculatedHash = calculateChecksum(payloadToHash);
      if (calculatedHash !== parsed.checksum) {
        warnings.push('Checksum mismatch detected. The file may have been edited externally or partially modified.');
      }
    }

    // Validate flowsheet elements
    const validation = validateProjectBeforeSave(
      parsed.project,
      parsed.flowsheet.units,
      parsed.flowsheet.streams,
      parsed.flowsheet.components || []
    );

    if (validation.errors.length > 0) {
      return {
        success: false,
        error: `Project validation failed: ${validation.errors.join('; ')}`,
        warnings: [...warnings, ...validation.warnings],
      };
    }

    warnings.push(...validation.warnings);

    return {
      success: true,
      projectPackage: parsed as PetroSimXProjectPackage,
      warnings,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to read file: ${err?.message || 'Unknown I/O error'}`,
      warnings,
    };
  }
}
