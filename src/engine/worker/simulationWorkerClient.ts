/**
 * Non-blocking Background Simulation Worker Client
 * Ensures long-running iterative calculations are executed on dedicated Web Workers,
 * maintaining responsive 60 FPS canvas rendering and preventing UI freeze.
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
  private worker: Worker | null = null;
  private activeRequestId = 0;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
          type: 'module',
        });
      } catch (e) {
        console.warn('Simulation Web Worker could not be initialized in this environment, using main thread fallback.', e);
        this.worker = null;
      }
    }
  }

  public cancel(): void {
    this.isCancelled = true;
    if (this.worker) {
      this.worker.terminate();
      this.initWorker();
    }
  }

  public getCancelled(): boolean {
    return this.isCancelled;
  }

  /**
   * Runs the simulation either via dedicated Web Worker or microtask-yielding fallback
   */
  public async execute(task: RunSimulationTask): Promise<SimulationResult> {
    this.isCancelled = false;
    const reqId = ++this.activeRequestId;

    // Use Web Worker if available
    if (this.worker) {
      return new Promise<SimulationResult>((resolve, reject) => {
        if (!this.worker) {
          // Fallback if worker disappeared
          this.executeFallback(task).then(resolve).catch(reject);
          return;
        }

        const handleMessage = (e: MessageEvent) => {
          const { type, id, progress, result, error } = e.data;
          if (id !== reqId) return;

          if (type === 'PROGRESS') {
            if (task.onProgress && !this.isCancelled) {
              task.onProgress(progress);
            }
          } else if (type === 'SUCCESS') {
            cleanup();
            resolve(result);
          } else if (type === 'ERROR') {
            cleanup();
            reject(new Error(error || 'Worker simulation error'));
          }
        };

        const handleError = (err: ErrorEvent) => {
          cleanup();
          console.warn('Simulation Worker encountered error, falling back to main thread:', err);
          this.executeFallback(task).then(resolve).catch(reject);
        };

        const cleanup = () => {
          if (this.worker) {
            this.worker.removeEventListener('message', handleMessage);
            this.worker.removeEventListener('error', handleError);
          }
        };

        this.worker.addEventListener('message', handleMessage);
        this.worker.addEventListener('error', handleError);

        this.worker.postMessage({
          type: 'RUN_SIMULATION',
          id: reqId,
          payload: {
            units: task.units,
            streams: task.streams,
            components: task.components,
            solverOptions: {
              tolerance: 1e-5,
              maxIterations: 35,
              method: 'Wegstein',
              dampingFactor: 0.65,
              wegsteinBounds: [-5.0, 0.0],
            },
          },
        });
      });
    }

    // Main thread fallback with microtask yielding
    return this.executeFallback(task);
  }

  private async executeFallback(task: RunSimulationTask): Promise<SimulationResult> {
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
        if (task.onProgress && !this.isCancelled) {
          task.onProgress(prog);
        }
      },
      shouldCancel: () => this.isCancelled,
    });
  }
}
