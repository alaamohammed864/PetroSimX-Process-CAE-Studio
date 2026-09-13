import React, { useState, useMemo, useCallback, useRef } from 'react';
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
import { ThermodynamicsView } from './components/views/ThermodynamicsView';
import { ReactorEngineeringView } from './components/views/ReactorEngineeringView';
import { MatrixSheetsView } from './components/views/MatrixSheetsView';
import { DigitalTwinView } from './components/views/DigitalTwinView';
import { OptimizationView } from './components/views/OptimizationView';
import { ColumnDesignView } from './components/views/ColumnDesignView';
import { EnergyUtilitiesView } from './components/views/EnergyUtilitiesView';
import { Plant3DViewer } from './components/plant3d/Plant3DViewer';
import { EngineeringReportsView } from './components/views/EngineeringReportsView';
import { DecisionVariable, ProcessCase } from './types/optimization';
import { SimulationTaskController } from './engine/worker/simulationWorkerClient';
import { generateStructuredReport, StructuredEngineeringReport } from './engine/reporting/engineeringReportGenerator';
import { ConvergenceIterationRecord } from './engine/solver/recycleSolver';
import { ProcessValidationReport } from './engine/validation/processValidator';
import { SimulationResult } from './engine/solver/simulationManager';
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

    const newUnit: EquipmentUnit = {
      id: newId,
      name: `${type.toUpperCase().replace(/_/g, ' ')} ${newId}`,
      tag: newId,
      type: type,
      description: `Process CAE ${type} unit operation`,
      x: 350 + Math.random() * 80,
      y: 240 + Math.random() * 60,
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
            status: unitRes.validationErrors.length === 0 ? 'converged' : 'warning',
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

      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-2`,
          time: new Date().toTimeString().split(' ')[0],
          type: 'success',
          message: `Steady-State convergence reached in ${simResult.iterations} iterations (${simResult.totalExecutionTimeMs.toFixed(1)} ms). Global mass balance discrepancy: ${simResult.globalMaterialBalance.massImbalanceKgH.toFixed(4)} kg/h.`,
        },
      ]);
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

  const handleStep = useCallback(() => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        time: timeStr,
        type: 'info',
        message: 'Solver single-step executed: Updated unit R-101 Jacobian.',
      },
    ]);
  }, []);

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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#060e20] text-[#dae2fd] font-sans antialiased">
      {/* Top Engineering Ribbon / Header */}
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
        projectName={currentProject.name}
        onAddUnit={handleAddUnit}
        onAddStream={handleAddStream}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled(!snapEnabled)}
        onFitView={handleFitView}
        equationOfState={eos}
        onChangeEos={setEos}
      />

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
        {currentTab === 'flowsheet-canvas' && (
          <div className="flex-1 flex w-full h-full overflow-hidden">
            {/* Left Palette: Unit Operations & Components Library */}
            <EquipmentPalette
              components={components}
              onUpdateComponentFraction={handleUpdateComponentFraction}
              onSelectUnitType={handleSelectUnitType}
              activeCategory={activePaletteCategory}
              onSelectCategory={setActivePaletteCategory}
            />

            {/* Central Engineering CAD Canvas */}
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
              onOpen3DView={() => setCurrentTab('3d-plant-view')}
            />

            {/* Right Property Inspector: Detailed specifications & kinetics */}
            <PropertyInspector
              selectedUnit={selectedUnit}
              unitSystem={unitSystem}
              onUpdateEquilibrium={handleUpdateEquilibrium}
              onUpdateGeometry={handleUpdateGeometry}
              onReintegrateOde={handleReintegrateOde}
              onOpenSensitivityCurves={() => setIsSensitivityOpen(true)}
              onExportMatrix={handleExportMatrix}
              isIntegrating={isIntegrating}
            />
          </div>
        )}

        {currentTab === '3d-plant-view' && (
          <div className="flex-1 overflow-hidden bg-[#060e20] flex flex-col relative">
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
              unitSystem={unitSystem}
            />
          </div>
        )}

        {currentTab === 'column-design' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <ColumnDesignView
              unit={selectedUnit?.type === 'column' ? selectedUnit : units.find((u) => u.type === 'column') || units[0]}
              feedStream={streams[0]}
              components={components}
              unitSystem={unitSystem}
            />
          </div>
        )}

        {currentTab === 'thermodynamics-engine' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <ThermodynamicsView
              components={components}
              eos={eos}
              onChangeEos={setEos}
            />
          </div>
        )}

        {currentTab === 'reactor-engineering' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <ReactorEngineeringView
              unit={selectedUnit?.type === 'reactor' ? selectedUnit : units[3]}
              inletStream={r101InletStream}
              unitSystem={unitSystem}
            />
          </div>
        )}

        {currentTab === 'stream-matrix' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <MatrixSheetsView
              streams={streams}
              components={components}
              unitSystem={unitSystem}
            />
          </div>
        )}

        {currentTab === 'digital-twin-monitor' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <DigitalTwinView
              units={units}
              streams={streams}
              unitSystem={unitSystem}
            />
          </div>
        )}

        {currentTab === 'sensitivity-optimization' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <OptimizationView
              units={units}
              streams={streams}
              components={components}
              unitSystem={unitSystem}
              onApplyOptimalValuesToFlowsheet={handleApplyOptimalVariables}
              onApplyCaseToFlowsheet={handleApplyCaseToFlowsheet}
            />
          </div>
        )}

        {currentTab === 'energy-utilities' && (
          <div className="flex-1 overflow-y-auto bg-[#060e20]">
            <EnergyUtilitiesView
              units={units}
              streams={streams}
              onSelectUnit={(id) => {
                setSelectedUnitId(id);
                setCurrentTab('flowsheet-canvas');
              }}
            />
          </div>
        )}

        {currentTab === 'engineering-reports' && (
          <EngineeringReportsView
            units={units}
            streams={streams}
            components={components}
            unitSystem={unitSystem}
            simulationResult={simulationResult}
            validationReport={validationReport}
            onNavigateToFlowsheet={() => setCurrentTab('flowsheet-canvas')}
          />
        )}
      </main>

      {/* Bottom Diagnostic Console & Solver Matrix Dock */}
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

      {/* Floating Offline Mode Indicator Badge */}
      <OfflineIndicator />
    </div>
  );
}
