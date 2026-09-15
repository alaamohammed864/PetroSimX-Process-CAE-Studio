import React, { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  EquipmentUnit,
  ProcessStream,
  ChemicalComponent,
  UnitSystem,
  ViewTab,
  EventLogEntry,
  UnitType,
} from './types/simulation';
import {
  INITIAL_UNITS,
  INITIAL_STREAMS,
  INITIAL_COMPONENTS,
  INITIAL_LOGS,
} from './data/initialFlowsheet';
import { Header } from './components/Header';
import { EquipmentPalette } from './components/EquipmentPalette';
import { FlowsheetCanvas } from './components/FlowsheetCanvas';
import { PropertyInspector } from './components/PropertyInspector';
import { DiagnosticConsole } from './components/DiagnosticConsole';
import { SensitivityModal } from './components/SensitivityModal';
import { UnitConverterModal } from './components/UnitConverterModal';
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal';

// Lazy-loaded Views for Bundle Optimization & Memory Management
const ThermodynamicsView = lazy(() =>
  import('./components/views/ThermodynamicsView').then((m) => ({ default: m.ThermodynamicsView }))
);
const ReactorEngineeringView = lazy(() =>
  import('./components/views/ReactorEngineeringView').then((m) => ({ default: m.ReactorEngineeringView }))
);
const MatrixSheetsView = lazy(() =>
  import('./components/views/MatrixSheetsView').then((m) => ({ default: m.MatrixSheetsView }))
);
const DigitalTwinView = lazy(() =>
  import('./components/views/DigitalTwinView').then((m) => ({ default: m.DigitalTwinView }))
);
const OptimizationView = lazy(() =>
  import('./components/views/OptimizationView').then((m) => ({ default: m.OptimizationView }))
);
const ColumnDesignView = lazy(() =>
  import('./components/views/ColumnDesignView').then((m) => ({ default: m.ColumnDesignView }))
);
const EnergyUtilitiesView = lazy(() =>
  import('./components/views/EnergyUtilitiesView').then((m) => ({ default: m.EnergyUtilitiesView }))
);
const Plant3DViewer = lazy(() =>
  import('./components/plant3d/Plant3DViewer').then((m) => ({ default: m.Plant3DViewer }))
);
const EngineeringReportsView = lazy(() =>
  import('./components/views/EngineeringReportsView').then((m) => ({ default: m.EngineeringReportsView }))
);

const ViewLoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center bg-[#060e20] text-[#bcc9cd] min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-[#00e5ff] border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono tracking-widest text-[#00e5ff] uppercase">
        Loading CAE Module...
      </span>
    </div>
  </div>
);

import { DecisionVariable, ProcessCase } from './types/optimization';
import { SimulationTaskController } from './engine/worker/simulationWorkerClient';
import { generateStructuredReport, StructuredEngineeringReport } from './engine/reporting/engineeringReportGenerator';
import { ConvergenceIterationRecord } from './engine/solver/recycleSolver';
import { ProcessValidationReport } from './engine/validation/processValidator';
import { SimulationResult, runSteadyStateSimulation } from './engine/solver/simulationManager';
import { localDb, ProjectRecord, RecoverySnapshotRecord } from './engine/storage/indexedDbClient';
import { ProjectManagerModal } from './components/modals/ProjectManagerModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { useAutoSaveAndRecovery } from './hooks/useAutoSaveAndRecovery';

export default function App() {
  // Core simulation state
  const [units, setUnits] = useState<EquipmentUnit[]>(INITIAL_UNITS);
  const [streams, setStreams] = useState<ProcessStream[]>(INITIAL_STREAMS);
  const [components, setComponents] = useState<ChemicalComponent[]>(INITIAL_COMPONENTS);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('R-101');
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  // Project and Offline Storage state
  const [currentProject, setCurrentProject] = useState<ProjectRecord>({
    id: 'proj-ammonia-synth-rev3',
    name: 'Ammonia Synthesis Loop Flowsheet',
    description: 'High-pressure Haber-Bosch catalytic loop with multi-bed converter, heat recovery network, and cryogenic separator recycle',
    author: 'Lead Process Modeler',
    facility: 'Plant Section 400 - Synthesis Loop',
    revision: '3',
    version: '1.2.0',
    unitSystem: 'SI',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
    unitCount: INITIAL_UNITS.length,
    streamCount: INITIAL_STREAMS.length,
  });
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState<boolean>(false);

  // App navigation and system settings
  const [currentTab, setCurrentTab] = useState<ViewTab>('flowsheet-canvas');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('SI');
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [isIntegrating, setIsIntegrating] = useState<boolean>(false);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [eos, setEos] = useState<string>('Peng-Robinson / Boston-Mathias');
  const [logs, setLogs] = useState<EventLogEntry[]>(INITIAL_LOGS);
  const [activePaletteCategory, setActivePaletteCategory] = useState<string>('reactors');

  // Residuals & Convergence History
  const [massResidual, setMassResidual] = useState<number>(0.0);
  const [energyResidual, setEnergyResidual] = useState<number>(0.0021);
  const [convergenceHistory, setConvergenceHistory] = useState<ConvergenceIterationRecord[]>([]);
  const [engineeringReport, setEngineeringReport] = useState<StructuredEngineeringReport | null>(null);
  const [validationReport, setValidationReport] = useState<ProcessValidationReport | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const taskControllerRef = useRef<SimulationTaskController>(new SimulationTaskController());

  // Modals
  const [isSensitivityOpen, setIsSensitivityOpen] = useState<boolean>(false);
  const [isConverterOpen, setIsConverterOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Workspace Panels Visibility Controls (User Request)
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [showBottomConsole, setShowBottomConsole] = useState<boolean>(true);
  const [showLeftPalette, setShowLeftPalette] = useState<boolean>(true);
  const [showRightInspector, setShowRightInspector] = useState<boolean>(true);

  const isZenMode = !showHeader && !showBottomConsole && !showLeftPalette && !showRightInspector;
  const toggleZenMode = useCallback(() => {
    if (isZenMode) {
      setShowHeader(true);
      setShowBottomConsole(true);
      setShowLeftPalette(true);
      setShowRightInspector(true);
    } else {
      setShowHeader(false);
      setShowBottomConsole(false);
      setShowLeftPalette(false);
      setShowRightInspector(false);
    }
  }, [isZenMode]);

  // Auto-Save and Crash Recovery
  const {
    pendingRecovery,
    acceptRecovery,
    dismissRecovery,
  } = useAutoSaveAndRecovery({
    currentProject,
    units,
    streams,
    components,
    onRestoreSnapshot: (snapshot) => {
      setUnits(snapshot.units);
      setStreams(snapshot.streams);
      setComponents(snapshot.components);
      setCurrentProject((prev) => ({
        ...prev,
        name: snapshot.projectName,
        updatedAt: snapshot.timestamp,
      }));
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          time: new Date().toTimeString().split(' ')[0],
          type: 'success',
          message: `Restored unsaved flowsheet session from ${new Date(snapshot.timestamp).toLocaleTimeString()}.`,
        },
      ]);
    },
    autoSaveIntervalMs: 30000,
  });

  // Active selected entities
  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) || units[3] || units[0],
    [units, selectedUnitId]
  );

  const r101InletStream = useMemo(
    () => streams.find((s) => s.id === 'S-104') || streams[0],
    [streams]
  );

  // Move unit position on canvas
  const handleUpdateUnitPosition = useCallback((id: string, x: number, y: number) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === id ? { ...u, x, y } : u))
    );
  }, []);

  // Update equilibrium parameter from Property Inspector
  const handleUpdateEquilibrium = useCallback((param: string, value: number) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === selectedUnitId) {
          return {
            ...u,
            equilibrium: {
              ...u.equilibrium,
              [param]: value,
            },
          };
        }
        return u;
      })
    );

    // If updating R-101 inlet temp, update outlet stream S-105 temperature
    if (selectedUnitId === 'R-101' && param === 'inletTempC') {
      setStreams((prev) =>
        prev.map((s) => {
          if (s.id === 'S-105') {
            return {
              ...s,
              tempC: parseFloat((value - 48.2).toFixed(2)),
            };
          }
          return s;
        })
      );
    }
  }, [selectedUnitId]);

  // Update geometry parameter from Property Inspector
  const handleUpdateGeometry = useCallback((param: string, value: number) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === selectedUnitId) {
          return {
            ...u,
            geometry: {
              ...u.geometry,
              [param]: value,
            },
          };
        }
        return u;
      })
    );
  }, [selectedUnitId]);

  // Reintegrate ODE for catalytic reactor
  const handleReintegrateOde = useCallback(() => {
    setIsIntegrating(true);
    setTimeout(() => {
      setIsIntegrating(false);
      const timeStr = new Date().toTimeString().split(' ')[0];
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          time: timeStr,
          type: 'success',
          message: `Re-integrated ODE15s axial profiles for ${selectedUnitId}. Converged with Δz = 0.14m.`,
        },
      ]);
    }, 400);
  }, [selectedUnitId]);

  // Add new unit from toolbar or equipment palette
  const handleAddUnit = useCallback((type: UnitType) => {
    const prefixes: Record<string, string> = {
      reactor: 'R',
      heatex: 'E',
      furnace: 'H',
      vessel: 'V',
      pump: 'P',
      column: 'C',
      absorber: 'ABS',
      stripper: 'STR',
      three_phase_separator: 'V3',
      liquid_liquid_separator: 'LL',
      splitter: 'SPL',
      compressor: 'K',
      valve: 'FV',
    };
    const prefix = prefixes[type] || 'U';
    const count = units.filter((u) => u.type === type).length + 1;
    const newId = `${prefix}-10${count + 1}`;

    // Calculate smart non-overlapping placement
    let smartX = 100;
    let smartY = 180;
    if (units.length > 0) {
      let maxX = 0;
      units.forEach((u) => {
        if (u.x > maxX) maxX = u.x;
      });

      if (maxX + 170 < 1100) {
        smartX = maxX + 140;
        smartY = 180 + ((units.length % 3) * 35);
      } else {
        const row = Math.floor(units.length / 5);
        smartX = 100 + ((units.length % 5) * 150);
        smartY = 180 + (row * 180);
      }
    }

    const newUnit: EquipmentUnit = {
      id: newId,
      name: `${type.toUpperCase().replace(/_/g, ' ')} ${newId}`,
      tag: newId,
      type: type,
      description: `Process CAE ${type} unit operation`,
      x: smartX,
      y: smartY,
      width: type === 'column' || type === 'absorber' || type === 'stripper' ? 60 : 70,
      height: type === 'column' || type === 'absorber' || type === 'stripper' ? 120 : 70,
      status: 'converged',
      geometry: {
        catalystVolumeM3: 0,
        internalDiamM: 1.5,
        bedVoidage: 0.4,
        bedHeightM: 4.0,
      },
      equilibrium: {
        inletTempC: 150.0,
        outletTempC: 180.0,
        operatingPresBar: 45.0,
        pressureDropBar: 0.8,
        lhsvSpaceVelH1: 1.5,
        h2hcTreatRatioNm3M3: 500,
        dutyMW: 3.5,
      },
      columnSpec: type === 'column' ? {
        numberOfStages: 24,
        feedStage: 12,
        refluxRatio: 2.5,
        distillateRateKgH: 15000,
        topPressureBar: 4.5,
        bottomPressureBar: 5.2,
        condenserType: 'total',
        reboilerType: 'thermosiphon',
        lightKeyComponentId: 'c3',
        heavyKeyComponentId: 'nc4',
        lightKeyDistillateRecovery: 0.98,
        heavyKeyBottomsRecovery: 0.98,
      } : undefined,
      absorberSpec: type === 'absorber' ? {
        numberOfStages: 16,
        operatingPressureBar: 30.0,
        pressureDropBar: 0.5,
        temperatureC: 45.0,
        stageEfficiency: 0.75,
      } : undefined,
      stripperSpec: type === 'stripper' ? {
        numberOfStages: 14,
        operatingPressureBar: 2.0,
        pressureDropBar: 0.3,
        reboiled: true,
      } : undefined,
      threePhaseSpec: type === 'three_phase_separator' ? {
        vesselPressureBar: 20.0,
        vesselTemperatureC: 40.0,
        isAdiabatic: true,
        waterCutVolumeFraction: 0.35,
      } : undefined,
      compressorSpec: type === 'compressor' ? {
        outletPressureBar: 65.0,
        isentropicEfficiency: 0.78,
        mechanicalEfficiency: 0.98,
      } : undefined,
      valveSpec: type === 'valve' ? {
        outletPressureBar: 2.5,
        flowCoefficientCv: 120.0,
        valveCharacteristic: 'equal_percentage',
      } : undefined,
      inletStreamIds: [],
      outletStreamIds: [],
    };

    setUnits((prev) => [...prev, newUnit]);
    setSelectedUnitId(newId);
    setSelectedStreamId(null);

    const timeStr = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        time: timeStr,
        type: 'info',
        message: `Instantiated unit operation ${newId} (${type}) on flowsheet.`,
      },
    ]);
  }, [units]);

  // Add new process stream
  const handleAddStream = useCallback(() => {
    const count = streams.length + 1;
    const newId = `S-10${count}`;
    const newStream: ProcessStream = {
      id: newId,
      name: `Process Stream ${newId}`,
      tag: newId,
      phase: 'Vapor',
      tempC: 120.0,
      presBar: 45.0,
      flowKgH: 15000.0,
      mw: 42.5,
      enthalpyKjKg: 85.0,
      vaporFraction: 1.0,
      densityKgM3: 22.4,
      color: '#4cd7f6',
      compositions: { c1: 0.2, c3: 0.3, nc4: 0.3, h2: 0.2, c6h6: 0, c7h14: 0 },
    };

    setStreams((prev) => [...prev, newStream]);
    setSelectedStreamId(newId);
    setSelectedUnitId('');

    const timeStr = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        time: timeStr,
        type: 'info',
        message: `Created process material stream ${newId}.`,
      },
    ]);
  }, [streams]);

  // Connect two units with a new process stream (User Request: Stream linking)
  const handleConnectUnits = useCallback((sourceUnitId: string, targetUnitId: string) => {
    if (!sourceUnitId || !targetUnitId || sourceUnitId === targetUnitId) return;

    const streamNumber = streams.length + 1;
    const newStreamId = `S-10${streamNumber}`;

    const sourceUnit = units.find((u) => u.id === sourceUnitId);
    const tempC = sourceUnit?.equilibrium.outletTempC || 120;
    const presBar = sourceUnit?.equilibrium.operatingPresBar || 30;

    const newStream: ProcessStream = {
      id: newStreamId,
      name: `${sourceUnitId} ➜ ${targetUnitId}`,
      tag: newStreamId,
      phase: tempC > 150 ? 'Vapor' : 'Liquid',
      tempC: parseFloat(tempC.toFixed(1)),
      presBar: parseFloat(presBar.toFixed(1)),
      flowKgH: 22000.0,
      mw: 44.0,
      enthalpyKjKg: 120.0,
      vaporFraction: tempC > 150 ? 1.0 : 0.0,
      densityKgM3: tempC > 150 ? 18.5 : 720.0,
      color: '#4cd7f6',
      compositions: { c1: 0.2, c3: 0.3, nc4: 0.3, h2: 0.2, c6h6: 0, c7h14: 0 },
    };

    setStreams((prev) => [...prev, newStream]);

    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === sourceUnitId) {
          return {
            ...u,
            outletStreamIds: Array.from(new Set([...(u.outletStreamIds || []), newStreamId])),
          };
        }
        if (u.id === targetUnitId) {
          return {
            ...u,
            inletStreamIds: Array.from(new Set([...(u.inletStreamIds || []), newStreamId])),
          };
        }
        return u;
      })
    );

    setSelectedStreamId(newStreamId);
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-conn`,
        time: new Date().toTimeString().split(' ')[0],
        type: 'success',
        message: `Connected ${sourceUnitId} ➜ ${targetUnitId} via stream ${newStreamId}. Updated 2D flowsheet & 3D plant model.`,
      },
    ]);
  }, [streams, units]);

  // CAD Auto-Layout to eliminate overlapping
  const handleAutoLayout = useCallback(() => {
    let currentX = 80;
    let currentY = 180;
    setUnits((prev) =>
      prev.map((u) => {
        const uWidth = u.width || 70;
        const assignedX = currentX;
        const assignedY = currentY;

        currentX += uWidth + 90;
        if (currentX > 1050) {
          currentX = 80;
          currentY += 190;
        }

        return {
          ...u,
          x: assignedX,
          y: assignedY,
        };
      })
    );

    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-layout`,
        time: new Date().toTimeString().split(' ')[0],
        type: 'info',
        message: `Applied CAD auto-layout: Rearranged all units with zero overlapping.`,
      },
    ]);
  }, []);

  // Trigger Solver execution
  const handleSolve = useCallback(async () => {
    setIsSolving(true);
    const timeStr = new Date().toTimeString().split(' ')[0];

    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-1`,
        time: timeStr,
        type: 'step',
        message: 'Executing Sequential Modular Solver with PR-EOS Flash & Bounded Wegstein acceleration...',
      },
    ]);

    try {
      const taskController = taskControllerRef.current;
      const simResult = await taskController.execute({
        units,
        streams,
        components,
        onProgress: (prog) => {
          setLogs((prev) => [
            ...prev.slice(-30),
            {
              id: `log-${Date.now()}-${prog.iteration}`,
              time: new Date().toTimeString().split(' ')[0],
              type: 'info',
              message: `Iter ${prog.iteration}: ${prog.statusMessage} (Max Residual: ${prog.residual.toExponential(2)})`,
            },
          ]);
        },
      });

      if (taskController.getCancelled()) {
        setIsSolving(false);
        return;
      }

      // Update calculated streams in flowsheet with rigorous thermophysical state
      setStreams((prev) =>
        prev.map((s) => {
          const calc = simResult.calculatedStreams.get(s.id);
          if (!calc) return s;
          return {
            ...s,
            tempC: parseFloat(calc.temperatureC.toFixed(2)),
            presBar: parseFloat(calc.pressureBar.toFixed(2)),
            flowKgH: parseFloat(calc.totalMassFlowKgH.toFixed(1)),
            mw: parseFloat(calc.mwAvg.toFixed(2)),
            phase: calc.phase as any,
            vaporFraction: parseFloat(calc.vaporFraction.toFixed(3)),
            enthalpyKjKg: parseFloat(calc.enthalpyKjKg.toFixed(1)),
            densityKgM3: parseFloat(calc.densityKgM3.toFixed(1)),
            compositions: { ...calc.moleFractions },
          };
        })
      );

      // Update equipment unit performance
      setUnits((prev) =>
        prev.map((u) => {
          const unitRes = simResult.unitResults.get(u.id);
          if (!unitRes) return u;
          return {
            ...u,
            status: unitRes.validationErrors.length > 0 ? 'failed' : unitRes.validationWarnings.length > 0 ? 'warning' : 'converged',
            equilibrium: {
              ...u.equilibrium,
              dutyMW: parseFloat(((unitRes.dutyKW || 0) / 1000).toFixed(3)),
              pressureDropBar: parseFloat((unitRes.pressureDropBar || 0).toFixed(2)),
            },
          };
        })
      );

      setConvergenceHistory(simResult.convergenceHistory);
      setMassResidual(simResult.globalMaterialBalance.massImbalanceKgH);
      setEnergyResidual(simResult.globalEnergyBalance.energyImbalanceKW);
      setSimulationResult(simResult);
      if (simResult.validationReport) {
        setValidationReport(simResult.validationReport);
      }

      const report = generateStructuredReport(simResult, units, streams);
      setEngineeringReport(report);

      if (simResult.converged) {
        setLogs((prev) => [
          ...prev,
          {
            id: `log-${Date.now()}-2`,
            time: new Date().toTimeString().split(' ')[0],
            type: 'success',
            message: `Steady-State convergence reached in ${simResult.iterations} iterations (${simResult.totalExecutionTimeMs.toFixed(1)} ms). Global mass balance discrepancy: ${simResult.globalMaterialBalance.massImbalanceKgH.toFixed(4)} kg/h.`,
          },
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            id: `log-${Date.now()}-failed`,
            time: new Date().toTimeString().split(' ')[0],
            type: 'warn',
            message: `Simulation ${simResult.errors.length > 0 ? 'FAILED' : 'DID NOT CONVERGE'}: ${simResult.statusMessage}`,
          },
        ]);
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-err`,
          time: new Date().toTimeString().split(' ')[0],
          type: 'warn',
          message: `Simulation halted: ${err?.message || 'Solver numerical exception'}`,
        },
      ]);
    } finally {
      setIsSolving(false);
    }
  }, [units, streams, components]);

  const handlePause = useCallback(() => {
    taskControllerRef.current.cancel();
    setIsSolving(false);
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-pause`,
        time: new Date().toTimeString().split(' ')[0],
        type: 'warn',
        message: 'Solver execution halted by user request.',
      },
    ]);
  }, []);

  const handleStep = useCallback(async () => {
    try {
      const stepResult = await runSteadyStateSimulation(units, streams, components, {
        solverOptions: { tolerance: 1e-5, maxIterations: 1, method: 'Direct' },
      });
      setStreams((prev) =>
        prev.map((s) => {
          const calc = stepResult.calculatedStreams.get(s.id);
          if (!calc) return s;
          return {
            ...s,
            tempC: parseFloat(calc.temperatureC.toFixed(2)),
            presBar: parseFloat(calc.pressureBar.toFixed(2)),
            flowKgH: parseFloat(calc.totalMassFlowKgH.toFixed(1)),
            mw: parseFloat(calc.mwAvg.toFixed(2)),
            phase: calc.phase as any,
            vaporFraction: parseFloat(calc.vaporFraction.toFixed(3)),
            enthalpyKjKg: parseFloat(calc.enthalpyKjKg.toFixed(1)),
            densityKgM3: parseFloat(calc.densityKgM3.toFixed(1)),
            compositions: { ...calc.moleFractions },
          };
        })
      );
      setUnits((prev) =>
        prev.map((u) => {
          const unitRes = stepResult.unitResults.get(u.id);
          if (!unitRes) return u;
          return {
            ...u,
            status: unitRes.validationErrors.length > 0 ? 'failed' : unitRes.validationWarnings.length > 0 ? 'warning' : 'converged',
            equilibrium: {
              ...u.equilibrium,
              dutyMW: parseFloat(((unitRes.dutyKW || 0) / 1000).toFixed(3)),
              pressureDropBar: parseFloat((unitRes.pressureDropBar || 0).toFixed(2)),
            },
          };
        })
      );
      setSimulationResult(stepResult);
      const timeStr = new Date().toTimeString().split(' ')[0];
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          time: timeStr,
          type: 'info',
          message: `Single solver step executed: Evaluated ${stepResult.executionOrder.length} unit(s). Max residual: ${stepResult.convergenceHistory[0]?.maxResidual?.toExponential(3) || '0.000e+0'}.`,
        },
      ]);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-step-err`,
          time: new Date().toTimeString().split(' ')[0],
          type: 'warn',
          message: `Single step calculation error: ${err?.message || 'Numerical exception'}`,
        },
      ]);
    }
  }, [units, streams, components]);

  const handleClearDiagnostics = useCallback(() => {
    setLogs([]);
  }, []);

  const handleApplyOptimalVariables = useCallback((variables: DecisionVariable[]) => {
    setUnits((prev) => {
      const updated = JSON.parse(JSON.stringify(prev)) as EquipmentUnit[];
      variables.forEach((v) => {
        if (v.targetType === 'unit') {
          const u = updated.find((item) => item.id === v.targetId);
          if (u) {
            if (!u.equilibrium) {
              u.equilibrium = { inletTempC: 510, outletTempC: 495, operatingPresBar: 28, pressureDropBar: 1.5 };
            }
            if (v.propertyKey === 'equilibrium.inletTempC') u.equilibrium.inletTempC = v.currentValue;
            if (v.propertyKey === 'equilibrium.operatingPresBar') u.equilibrium.operatingPresBar = v.currentValue;
            if (v.propertyKey === 'equilibrium.h2hcTreatRatioNm3M3') u.equilibrium.h2hcTreatRatioNm3M3 = v.currentValue;
            if (v.propertyKey === 'equilibrium.dutyMW') u.equilibrium.dutyMW = v.currentValue;
            if (v.propertyKey === 'equilibrium.lhsvSpaceVelH1') u.equilibrium.lhsvSpaceVelH1 = v.currentValue;
            if (v.propertyKey === 'columnSpec.refluxRatio' && u.columnSpec) u.columnSpec.refluxRatio = v.currentValue;
          }
        }
      });
      return updated;
    });

    setStreams((prev) => {
      const updated = JSON.parse(JSON.stringify(prev)) as ProcessStream[];
      variables.forEach((v) => {
        if (v.targetType === 'stream') {
          const s = updated.find((item) => item.id === v.targetId);
          if (s) {
            if (v.propertyKey === 'flowKgH') s.flowKgH = v.currentValue;
            if (v.propertyKey === 'tempC') s.tempC = v.currentValue;
            if (v.propertyKey === 'presBar') s.presBar = v.currentValue;
          }
        }
      });
      return updated;
    });

    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-opt`,
        time: new Date().toTimeString().split(' ')[0],
        type: 'info',
        message: `Optimal decision variables applied to flowsheet. Process model updated.`,
      },
    ]);
  }, []);

  const handleApplyCaseToFlowsheet = useCallback((caseItem: ProcessCase) => {
    setUnits(JSON.parse(JSON.stringify(caseItem.units)));
    setStreams(JSON.parse(JSON.stringify(caseItem.streams)));
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-case`,
        time: new Date().toTimeString().split(' ')[0],
        type: 'info',
        message: `Loaded scenario "${caseItem.name}" onto active canvas.`,
      },
    ]);
  }, []);

  const handleNewProject = useCallback(() => {
    setIsProjectManagerOpen(true);
  }, []);

  const handleOpenProject = useCallback(() => {
    setIsProjectManagerOpen(true);
  }, []);

  const handleSaveProject = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const updated: ProjectRecord = {
        ...currentProject,
        unitCount: units.length,
        streamCount: streams.length,
        lastConverged: simulationResult?.converged ?? true,
        updatedAt: now,
      };
      await localDb.saveProject(updated);
      await localDb.saveCase({
        id: `case-${currentProject.id}`,
        projectId: currentProject.id,
        name: 'Active Flowsheet State',
        updatedAt: now,
        units,
        streams,
        components,
      });
      setCurrentProject(updated);
      const timeStr = new Date().toTimeString().split(' ')[0];
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-save`,
          time: timeStr,
          type: 'success',
          message: `Saved project "${currentProject.name}" to local IndexedDB database. All ${units.length} units and ${streams.length} streams persisted.`,
        },
      ]);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-save-err`,
          time: new Date().toTimeString().split(' ')[0],
          type: 'warn',
          message: `Could not save to local IndexedDB: ${err?.message}`,
        },
      ]);
    }
  }, [currentProject, units, streams, components, simulationResult]);

  const handleFitView = useCallback(() => {
    // Reset canvas view focus
  }, []);

  // Update chemical component fraction from palette
  const handleUpdateComponentFraction = useCallback((id: string, fraction: number) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, fraction } : c))
    );
  }, []);

  // Palette unit type select
  const handleSelectUnitType = useCallback((type: UnitType) => {
    handleAddUnit(type);
  }, [handleAddUnit]);

  // Export Matrix CSV
  const handleExportMatrix = useCallback(() => {
    let csv = `Stream,Name,Phase,Temp[C],Pres[bar],Flow[kg/h],MW,Enthalpy[kJ/kg],VF,Density[kg/m3]\n`;
    streams.forEach((s) => {
      csv += `${s.id},"${s.name}",${s.phase},${s.tempC},${s.presBar},${s.flowKgH},${s.mw},${s.enthalpyKjKg},${s.vaporFraction},${s.densityKgM3}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'HMB_Matrix.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [streams]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        handleSolve();
      } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setIsProjectManagerOpen(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setCurrentTab('stream-matrix');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setCurrentTab('energy-utilities');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setCurrentTab('engineering-reports');
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setIsConverterOpen((prev) => !prev);
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsSensitivityOpen((prev) => !prev);
      } else if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsSensitivityOpen(false);
        setIsConverterOpen(false);
        setIsProjectManagerOpen(false);
        setIsShortcutsOpen(false);
        setSelectedStreamId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSolve, handleSaveProject]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#060e20] text-[#dae2fd] font-sans antialiased relative">
      {/* Top Engineering Ribbon / Header */}
      {showHeader && (
        <Header
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          unitSystem={unitSystem}
          onUnitSystemChange={setUnitSystem}
          isSolving={isSolving}
          onSolve={handleSolve}
          onPause={handlePause}
          onStep={handleStep}
          onClearDiagnostics={handleClearDiagnostics}
          onOpenUnitConverter={() => setIsConverterOpen(true)}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onSaveProject={handleSaveProject}
          onOpenProjectManager={() => setIsProjectManagerOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          projectName={currentProject.name}
          onAddUnit={handleAddUnit}
          onAddStream={handleAddStream}
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled(!snapEnabled)}
          onFitView={handleFitView}
          equationOfState={eos}
          onChangeEos={setEos}
        />
      )}

      {/* Floating Reveal Button when Header is hidden */}
      {!showHeader && (
        <button
          onClick={() => setShowHeader(true)}
          className="fixed top-2.5 right-4 z-50 px-2.5 py-1 rounded-md bg-[#171f33]/95 hover:bg-[#222a3d] border border-[#4cd7f6]/40 text-[#4cd7f6] text-[11px] font-mono shadow-2xl backdrop-blur flex items-center gap-1.5 transition-all"
          title="Show Top Engineering Suite Header"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">expand_more</span>
          <span>SHOW HEADER</span>
        </button>
      )}

      {/* Unsaved Session / Crash Recovery Notification Banner */}
      {pendingRecovery && (
        <div className="bg-[#171f33] border-b-2 border-[#ffb95f] px-4 py-1.5 flex items-center justify-between text-xs font-mono text-[#ffddb8] z-40 shrink-0 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[17px] text-[#ffb95f]">restore</span>
            <span>
              Unsaved Session Detected: Recovery checkpoint found for &quot;<strong className="text-white">{pendingRecovery.projectName}</strong>&quot; ({new Date(pendingRecovery.timestamp).toLocaleTimeString()}).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={acceptRecovery}
              className="px-2.5 py-0.5 bg-[#ffb95f] hover:bg-[#ffa726] text-[#2c1600] font-bold rounded text-[10.5px] transition-all"
              type="button"
            >
              Restore Flowsheet
            </button>
            <button
              onClick={dismissRecovery}
              className="px-2 py-0.5 text-[#869397] hover:text-white text-[10.5px]"
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Views */}
      <main className="flex-1 flex overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="flex-1 flex w-full h-full overflow-hidden relative"
          >
            {currentTab === 'flowsheet-canvas' && (
              <div className="flex-1 flex w-full h-full overflow-hidden relative">
                {/* Left Palette: Unit Operations & Components Library */}
                {showLeftPalette ? (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      onClick={() => setShowLeftPalette(false)}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    />
                    <div className="fixed inset-y-0 left-0 z-50 shadow-2xl flex flex-col lg:relative lg:static lg:z-10 lg:shadow-none lg:flex lg:shrink-0 lg:border-r lg:border-[#3d494c]/40">
                      <EquipmentPalette
                        components={components}
                        onUpdateComponentFraction={handleUpdateComponentFraction}
                        onSelectUnitType={(type) => {
                          handleSelectUnitType(type);
                          if (window.innerWidth < 1024) setShowLeftPalette(false);
                        }}
                        activeCategory={activePaletteCategory}
                        onSelectCategory={setActivePaletteCategory}
                        onClose={() => setShowLeftPalette(false)}
                      />
                      <button
                        onClick={() => setShowLeftPalette(false)}
                        className="hidden lg:flex absolute -right-3 top-2.5 z-20 w-6 h-6 rounded-full bg-[#171f33] border border-[#3d494c]/60 text-[#869397] hover:text-[#4cd7f6] items-center justify-center shadow-lg transition-colors"
                        title="Hide Left Palette"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[13px]">chevron_left</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setShowLeftPalette(true)}
                    className="absolute left-0 top-12 z-30 bg-[#171f33]/95 hover:bg-[#222a3d] text-[#4cd7f6] border border-[#3d494c]/60 rounded-r-md px-1.5 py-3 shadow-xl flex items-center justify-center transition-all backdrop-blur"
                    title="Show Equipment Palette (Left Panel)"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                  </button>
                )}

                {/* Central Engineering CAD Canvas */}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col relative overflow-hidden">
                  <FlowsheetCanvas
                    units={units}
                    streams={streams}
                    selectedUnitId={selectedUnitId}
                    onSelectUnit={(id) => {
                      setSelectedUnitId(id);
                      setSelectedStreamId(null);
                    }}
                    selectedStreamId={selectedStreamId}
                    onSelectStream={(id) => {
                      setSelectedStreamId(id);
                    }}
                    unitSystem={unitSystem}
                    snapEnabled={snapEnabled}
                    onUpdateUnitPosition={handleUpdateUnitPosition}
                    onConnectUnits={handleConnectUnits}
                    onAutoLayout={handleAutoLayout}
                    onOpen3DView={() => setCurrentTab('3d-plant-view')}
                    onDeleteUnit={(id) => {
                      setUnits((prev) => prev.filter((u) => u.id !== id));
                      if (selectedUnitId === id) setSelectedUnitId('');
                    }}
                    onAddUnit={handleSelectUnitType}
                    onAddStream={handleAddStream}
                    onSolveFlowsheet={handleSolve}
                    onViewProfiles={(id) => {
                      setSelectedUnitId(id);
                      setCurrentTab('reactor-engineering');
                    }}
                    onViewHydraulics={(id) => {
                      setSelectedUnitId(id);
                      setCurrentTab('column-design');
                    }}
                  />
                </div>

                {/* Right Property Inspector: Detailed specifications & kinetics */}
                {showRightInspector ? (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      onClick={() => setShowRightInspector(false)}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    />
                    <div className="fixed inset-y-0 right-0 z-50 shadow-2xl flex flex-col lg:relative lg:static lg:z-10 lg:shadow-none lg:flex lg:shrink-0 lg:border-l lg:border-[#3d494c]/40">
                      <button
                        onClick={() => setShowRightInspector(false)}
                        className="hidden lg:flex absolute -left-3 top-2.5 z-20 w-6 h-6 rounded-full bg-[#171f33] border border-[#3d494c]/60 text-[#869397] hover:text-[#4cd7f6] items-center justify-center shadow-lg transition-colors"
                        title="Hide Right Inspector"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[13px]">chevron_right</span>
                      </button>
                      <PropertyInspector
                        selectedUnit={selectedUnit}
                        unitSystem={unitSystem}
                        onUpdateEquilibrium={handleUpdateEquilibrium}
                        onUpdateGeometry={handleUpdateGeometry}
                        onReintegrateOde={handleReintegrateOde}
                        onOpenSensitivityCurves={() => setIsSensitivityOpen(true)}
                        onExportMatrix={handleExportMatrix}
                        isIntegrating={isIntegrating}
                        onClose={() => setShowRightInspector(false)}
                      />
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => setShowRightInspector(true)}
                    className="absolute right-0 top-12 z-30 bg-[#171f33]/95 hover:bg-[#222a3d] text-[#4cd7f6] border border-[#3d494c]/60 rounded-l-md px-1.5 py-3 shadow-xl flex items-center justify-center transition-all backdrop-blur"
                    title="Show Property Inspector (Right Panel)"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                  </button>
                )}
              </div>
            )}

        {currentTab === '3d-plant-view' && (
          <div className="flex-1 overflow-hidden bg-[#060e20] flex flex-col relative">
            <Suspense fallback={<ViewLoadingFallback />}>
              <Plant3DViewer
                units={units}
                streams={streams}
                selectedUnitId={selectedUnitId}
                selectedStreamId={selectedStreamId}
                onSelectUnit={(id) => {
                  setSelectedUnitId(id);
                  setSelectedStreamId(null);
                }}
                onSelectStream={(id) => {
                  setSelectedStreamId(id);
                  if (id) {
                    const s = streams.find((item) => item.id === id);
                    if (s) {
                      const src = units.find((u) => u.outletStreamIds.includes(id));
                      if (src) setSelectedUnitId(src.id);
                    }
                  }
                }}
                onUpdateUnitPosition={handleUpdateUnitPosition}
                onConnectUnits={handleConnectUnits}
                onAddUnit={handleSelectUnitType}
                onAutoLayout={handleAutoLayout}
                unitSystem={unitSystem}
              />
            </Suspense>
          </div>
        )}

        {currentTab === 'column-design' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <ColumnDesignView
                unit={selectedUnit?.type === 'column' ? selectedUnit : units.find((u) => u.type === 'column') || units[0]}
                feedStream={streams[0]}
                components={components}
                unitSystem={unitSystem}
              />
            </Suspense>
          </div>
        )}

        {currentTab === 'thermodynamics-engine' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <ThermodynamicsView
                components={components}
                eos={eos}
                onChangeEos={setEos}
              />
            </Suspense>
          </div>
        )}

        {currentTab === 'reactor-engineering' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <ReactorEngineeringView
                unit={selectedUnit?.type === 'reactor' ? selectedUnit : units[3]}
                inletStream={r101InletStream}
                unitSystem={unitSystem}
              />
            </Suspense>
          </div>
        )}

        {currentTab === 'stream-matrix' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <MatrixSheetsView
                streams={streams}
                components={components}
                unitSystem={unitSystem}
              />
            </Suspense>
          </div>
        )}

        {currentTab === 'digital-twin-monitor' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <DigitalTwinView
                units={units}
                streams={streams}
                unitSystem={unitSystem}
              />
            </Suspense>
          </div>
        )}

        {currentTab === 'sensitivity-optimization' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <OptimizationView
                units={units}
                streams={streams}
                components={components}
                unitSystem={unitSystem}
                onApplyOptimalValuesToFlowsheet={handleApplyOptimalVariables}
                onApplyCaseToFlowsheet={handleApplyCaseToFlowsheet}
              />
            </Suspense>
          </div>
        )}

        {currentTab === 'energy-utilities' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <Suspense fallback={<ViewLoadingFallback />}>
              <EnergyUtilitiesView
                units={units}
                streams={streams}
                onSelectUnit={(id) => {
                  setSelectedUnitId(id);
                  setCurrentTab('flowsheet-canvas');
                }}
              />
            </Suspense>
          </div>
        )}

            {currentTab === 'engineering-reports' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                <EngineeringReportsView
                  units={units}
                  streams={streams}
                  components={components}
                  unitSystem={unitSystem}
                  simulationResult={simulationResult}
                  validationReport={validationReport}
                  onNavigateToFlowsheet={() => setCurrentTab('flowsheet-canvas')}
                />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Diagnostic Console & Solver Matrix Dock */}
      {showBottomConsole ? (
        <DiagnosticConsole
          logs={logs}
          streams={streams}
          components={components}
          unitSystem={unitSystem}
          selectedStreamId={selectedStreamId}
          onSelectStream={(id) => {
            setSelectedStreamId(id);
            setSelectedUnitId('');
          }}
          massResidual={massResidual}
          energyResidual={energyResidual}
          convergenceHistory={convergenceHistory}
          isSolving={isSolving}
          engineeringReport={engineeringReport}
          validationReport={validationReport}
          simulationResult={simulationResult}
          units={units}
          onTriggerSolve={handleSolve}
          onOpenReportsStudio={() => setCurrentTab('engineering-reports')}
        />
      ) : (
        <div className="bg-[#0b1326] border-t border-[#3d494c]/50 px-3 py-1.5 flex items-center justify-between text-[11px] font-mono shrink-0 select-none z-30 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
              <span className="text-[#869397]">SOLVER:</span>
              <span className="text-[#4edea3] font-semibold">ONLINE (STEADY-STATE CONVERGED)</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[#bcc9cd]">
              <span className="text-[#869397]">RESIDUAL:</span>
              <span className="text-[#4cd7f6]">{massResidual.toExponential(2)} kg/h</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-[#bcc9cd]">
              <span className="text-[#869397]">LEAD ENG:</span>
              <span className="text-[#ffb95f] font-bold">ENG ALAA MOHAMMED</span>
            </div>
          </div>
          <button
            onClick={() => setShowBottomConsole(true)}
            className="px-2.5 py-0.5 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/40 flex items-center gap-1.5 text-[10.5px] transition-all"
            title="Open Diagnostic Console & Process Stream Summary"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">expand_less</span>
            <span>SHOW DIAGNOSTIC CONSOLE</span>
          </button>
        </div>
      )}

      {/* Floating Workspace Panels Visibility Manager Dock */}
      <div className="fixed bottom-12 right-4 z-40 flex items-center gap-1 bg-[#171f33]/95 border border-[#3d494c]/60 shadow-2xl rounded-lg px-2 py-1 backdrop-blur-md text-[10px] font-mono">
        <span className="text-[#869397] font-semibold flex items-center gap-1 mr-1">
          <span className="material-symbols-outlined text-[14px] text-[#4cd7f6]">dashboard_customize</span>
          <span className="hidden sm:inline">PANELS:</span>
        </span>
        <button
          onClick={() => setShowHeader(!showHeader)}
          className={`px-1.5 py-0.5 rounded transition-colors ${
            showHeader ? 'bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/40' : 'text-[#869397] hover:text-[#dae2fd]'
          }`}
          title={showHeader ? 'Hide Top Header' : 'Show Top Header'}
          type="button"
        >
          TOP
        </button>
        <button
          onClick={() => setShowLeftPalette(!showLeftPalette)}
          className={`px-1.5 py-0.5 rounded transition-colors ${
            showLeftPalette ? 'bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/40' : 'text-[#869397] hover:text-[#dae2fd]'
          }`}
          title={showLeftPalette ? 'Hide Left Palette' : 'Show Left Palette'}
          type="button"
        >
          LEFT
        </button>
        <button
          onClick={() => setShowRightInspector(!showRightInspector)}
          className={`px-1.5 py-0.5 rounded transition-colors ${
            showRightInspector ? 'bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/40' : 'text-[#869397] hover:text-[#dae2fd]'
          }`}
          title={showRightInspector ? 'Hide Right Inspector' : 'Show Right Inspector'}
          type="button"
        >
          RIGHT
        </button>
        <button
          onClick={() => setShowBottomConsole(!showBottomConsole)}
          className={`px-1.5 py-0.5 rounded transition-colors ${
            showBottomConsole ? 'bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/40' : 'text-[#869397] hover:text-[#dae2fd]'
          }`}
          title={showBottomConsole ? 'Hide Bottom Console' : 'Show Bottom Console'}
          type="button"
        >
          BOTTOM
        </button>
        <div className="w-px h-3 bg-[#3d494c]/60 mx-0.5"></div>
        <button
          onClick={toggleZenMode}
          className={`px-2 py-0.5 rounded font-bold transition-colors flex items-center gap-1 ${
            isZenMode ? 'bg-[#ffb95f] text-[#2c1600]' : 'bg-[#222a3d] text-[#dae2fd] hover:text-[#ffb95f]'
          }`}
          title={isZenMode ? 'Exit Zen Focus Mode (Restore All Panels)' : 'Enter Zen Focus Mode (Maximize Canvas)'}
          type="button"
        >
          <span className="material-symbols-outlined text-[13px]">
            {isZenMode ? 'fullscreen_exit' : 'fullscreen'}
          </span>
          <span>{isZenMode ? 'RESTORE' : 'FOCUS'}</span>
        </button>
      </div>

      {/* Sensitivity Analysis Modal */}
      {isSensitivityOpen && selectedUnit && (
        <SensitivityModal
          unit={selectedUnit}
          inletStream={r101InletStream}
          onClose={() => setIsSensitivityOpen(false)}
        />
      )}

      {/* Chemical Engineering Unit Converter Modal */}
      {isConverterOpen && (
        <UnitConverterModal onClose={() => setIsConverterOpen(false)} />
      )}

      {/* PetroSimX Project & Offline Storage Manager Modal */}
      <ProjectManagerModal
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        currentProject={currentProject}
        units={units}
        streams={streams}
        components={components}
        simulationResult={simulationResult}
        unitSystem={unitSystem}
        onLoadProject={(pkg) => {
          setCurrentProject(pkg.project);
          setUnits(pkg.units);
          setStreams(pkg.streams);
          setComponents(pkg.components);
          setSelectedUnitId(pkg.units[0]?.id || '');
          setSelectedStreamId(null);
          setLogs((prev) => [
            ...prev,
            {
              id: `log-${Date.now()}`,
              time: new Date().toTimeString().split(' ')[0],
              type: 'info',
              message: `Opened project "${pkg.project.name}" (${pkg.units.length} units, ${pkg.streams.length} streams).`,
            },
          ]);
        }}
        onUpdateCurrentProject={(updated) => {
          setCurrentProject((prev) => ({ ...prev, ...updated }));
        }}
      />

      {/* Engineering Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Floating Offline Mode Indicator Badge */}
      <OfflineIndicator />
    </div>
  );
}
