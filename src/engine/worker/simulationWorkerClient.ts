/**
 * Non-blocking Background Simulation Worker Client
 * Ensures long-running iterative calculations yield to the event loop,
 * maintaining responsive 60 FPS canvas rendering with cancellation support.
 */

import { EquipmentUnit, ProcessStream, ChemicalComponent } from '../../types/simulation';
import { runSteadyStateSimulation, SimulationResult } from '../solver/simulationManager';

export interface RunSimulationTask {
  units: EquipmentUnit[];
  streams: ProcessStream[];
  components: ChemicalComponent[];
  onProgress?: (progress: {
    iteration: number;
    maxIterations: number;
    currentUnitId: string;
    residual: number;
    statusMessage: string;
  }) => void;
}

export class SimulationTaskController {
  private isCancelled = false;

  public cancel(): void {
    this.isCancelled = true;
  }

  public getCancelled(): boolean {
    return this.isCancelled;
  }

  /**
   * Runs the simulation asynchronously with incremental microtask yielding
   */
  public async execute(task: RunSimulationTask): Promise<SimulationResult> {
    this.isCancelled = false;

    // Yield execution to the browser thread first
    await new Promise((resolve) => setTimeout(resolve, 10));

    return runSteadyStateSimulation(task.units, task.streams, task.components, {
      solverOptions: {
        tolerance: 1e-5,
        maxIterations: 35,
        method: 'Wegstein',
        dampingFactor: 0.65,
        wegsteinBounds: [-5.0, 0.0],
      },
      onProgress: (prog) => {
        if (task.onProgress) {
          task.onProgress(prog);
        }
      },
      shouldCancel: () => this.isCancelled,
    });
  }
}
