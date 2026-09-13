/**
 * Background Simulation Web Worker
 * Offloads heavy numerical recycle iterations, matrix operations, and ODE integrations
 * from the main browser thread to ensure 60 FPS UI responsiveness.
 */

import { runSteadyStateSimulation } from '../solver/simulationManager';

self.onmessage = async (e: MessageEvent) => {
  const { type, id, payload } = e.data;

  if (type === 'RUN_SIMULATION') {
    try {
      const result = await runSteadyStateSimulation(
        payload.units,
        payload.streams,
        payload.components,
        {
          solverOptions: payload.solverOptions || {
            tolerance: 1e-5,
            maxIterations: 35,
            method: 'Wegstein',
            dampingFactor: 0.65,
            wegsteinBounds: [-5.0, 0.0],
          },
          onProgress: (prog) => {
            self.postMessage({
              type: 'PROGRESS',
              id,
              progress: prog,
            });
          },
        }
      );

      self.postMessage({
        type: 'SUCCESS',
        id,
        result,
      });
    } catch (err: any) {
      self.postMessage({
        type: 'ERROR',
        id,
        error: err?.message || 'Calculation failed in simulation worker.',
      });
    }
  }
};
