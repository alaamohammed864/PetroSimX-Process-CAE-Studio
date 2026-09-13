/**
 * Industrial-grade IndexedDB Storage Client for PetroSimX
 * Provides robust offline-first persistence for projects, simulation cases,
 * component databases, reaction models, simulation results, settings, and recovery snapshots.
 */

import { EquipmentUnit, ProcessStream, ChemicalComponent, UnitSystem } from '../../types/simulation';
import { SimulationResult } from '../solver/simulationManager';
import { EngineeringReportDocument } from '../reporting/engineeringReportEngine';

export const DB_NAME = 'petrosimx_offline_cae_db';
export const DB_VERSION = 2;

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  author: string;
  facility: string;
  revision: string;
  version: string;
  unitSystem: UnitSystem;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
  tags?: string[];
  unitCount?: number;
  streamCount?: number;
  lastConverged?: boolean;
}

export interface SimulationCaseRecord {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  updatedAt: string;
  units: EquipmentUnit[];
  streams: ProcessStream[];
  components: ChemicalComponent[];
  reactions?: any[];
  solverSettings?: {
    tolerance: number;
    maxIterations: number;
    method: string;
    dampingFactor: number;
  };
}

export interface ResultRecord {
  id: string;
  projectId: string;
  caseId?: string;
  timestamp: string;
  converged: boolean;
  iterations: number;
  executionTimeMs: number;
  massImbalanceKgH: number;
  energyImbalanceKW: number;
  summary: any;
}

export interface SettingsRecord {
  key: string;
  value: any;
  updatedAt: string;
}

export interface RecoverySnapshotRecord {
  id: string;
  projectId: string;
  timestamp: string;
  units: EquipmentUnit[];
  streams: ProcessStream[];
  components: ChemicalComponent[];
  projectName: string;
  autoSaveReason: string;
}

export interface ProjectVersionRecord {
  id: string;
  projectId: string;
  version: string;
  timestamp: string;
  commitNote: string;
  author: string;
  snapshot: {
    units: EquipmentUnit[];
    streams: ProcessStream[];
    components: ChemicalComponent[];
    metadata: Partial<ProjectRecord>;
  };
}

class IndexedDbClient {
  private dbPromise: Promise<IDBDatabase> | null = null;

  public async getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported in this runtime environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // 1. Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 2. Simulation Cases store
        if (!db.objectStoreNames.contains('simulationCases')) {
          const caseStore = db.createObjectStore('simulationCases', { keyPath: 'id' });
          caseStore.createIndex('projectId', 'projectId', { unique: false });
          caseStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 3. Components store
        if (!db.objectStoreNames.contains('components')) {
          const compStore = db.createObjectStore('components', { keyPath: 'id' });
          compStore.createIndex('formula', 'formula', { unique: false });
          compStore.createIndex('name', 'name', { unique: false });
        }

        // 4. Reactions store
        if (!db.objectStoreNames.contains('reactions')) {
          const rxnStore = db.createObjectStore('reactions', { keyPath: 'id' });
          rxnStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // 5. Simulation Results store
        if (!db.objectStoreNames.contains('results')) {
          const resultStore = db.createObjectStore('results', { keyPath: 'id' });
          resultStore.createIndex('projectId', 'projectId', { unique: false });
          resultStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 6. Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // 7. Reports store
        if (!db.objectStoreNames.contains('reports')) {
          const reportStore = db.createObjectStore('reports', { keyPath: 'id' });
          reportStore.createIndex('projectId', 'projectId', { unique: false });
          reportStore.createIndex('reportType', 'reportType', { unique: false });
          reportStore.createIndex('generatedAt', 'generatedAt', { unique: false });
        }

        // 8. Recovery Snapshots store
        if (!db.objectStoreNames.contains('recoverySnapshots')) {
          const recoveryStore = db.createObjectStore('recoverySnapshots', { keyPath: 'id' });
          recoveryStore.createIndex('projectId', 'projectId', { unique: false });
          recoveryStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 9. Project Versions store
        if (!db.objectStoreNames.contains('projectVersions')) {
          const versionStore = db.createObjectStore('projectVersions', { keyPath: 'id' });
          versionStore.createIndex('projectId', 'projectId', { unique: false });
          versionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });

    return this.dbPromise;
  }

  // --- Generic Transaction Helpers ---
  private async executeTx<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest | Promise<T>
  ): Promise<T> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      const request = operation(store);
      if (request instanceof Promise) {
        request.then(resolve).catch(reject);
        return;
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Project CRUD ---
  public async getAllProjects(): Promise<ProjectRecord[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();
      req.onsuccess = () => {
        const projs = (req.result || []) as ProjectRecord[];
        // Sort newest first
        projs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(projs);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async getProject(id: string): Promise<ProjectRecord | null> {
    return this.executeTx('projects', 'readonly', (store) => store.get(id));
  }

  public async saveProject(project: ProjectRecord): Promise<void> {
    await this.executeTx('projects', 'readwrite', (store) => store.put(project));
  }

  public async deleteProject(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'simulationCases', 'recoverySnapshots', 'projectVersions'], 'readwrite');
      tx.objectStore('projects').delete(id);
      
      // Cleanup associated cases
      const caseStore = tx.objectStore('simulationCases');
      const caseIndex = caseStore.index('projectId');
      const caseReq = caseIndex.openKeyCursor(IDBKeyRange.only(id));
      caseReq.onsuccess = () => {
        const cursor = caseReq.result;
        if (cursor) {
          caseStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Simulation Case CRUD ---
  public async getCaseForProject(projectId: string): Promise<SimulationCaseRecord | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('simulationCases', 'readonly');
      const store = tx.objectStore('simulationCases');
      const index = store.index('projectId');
      const req = index.getAll(IDBKeyRange.only(projectId));
      req.onsuccess = () => {
        const list = req.result as SimulationCaseRecord[];
        if (list && list.length > 0) {
          // Sort newest updated
          list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          resolve(list[0]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async saveCase(simCase: SimulationCaseRecord): Promise<void> {
    await this.executeTx('simulationCases', 'readwrite', (store) => store.put(simCase));
  }

  // --- Versioning Snapshot CRUD ---
  public async createVersionSnapshot(versionRecord: ProjectVersionRecord): Promise<void> {
    await this.executeTx('projectVersions', 'readwrite', (store) => store.put(versionRecord));
  }

  public async getVersionsForProject(projectId: string): Promise<ProjectVersionRecord[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projectVersions', 'readonly');
      const store = tx.objectStore('projectVersions');
      const index = store.index('projectId');
      const req = index.getAll(IDBKeyRange.only(projectId));
      req.onsuccess = () => {
        const list = (req.result || []) as ProjectVersionRecord[];
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Automatic Recovery Snapshots ---
  public async saveRecoverySnapshot(snapshot: RecoverySnapshotRecord): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recoverySnapshots', 'readwrite');
      const store = tx.objectStore('recoverySnapshots');
      store.put(snapshot);

      // Keep only last 5 recovery snapshots per project to conserve space
      const index = store.index('projectId');
      const req = index.getAll(IDBKeyRange.only(snapshot.projectId));
      req.onsuccess = () => {
        const items = req.result as RecoverySnapshotRecord[];
        if (items.length > 5) {
          items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const toDelete = items.slice(0, items.length - 5);
          for (const old of toDelete) {
            store.delete(old.id);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getLatestRecoverySnapshot(projectId?: string): Promise<RecoverySnapshotRecord | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recoverySnapshots', 'readonly');
      const store = tx.objectStore('recoverySnapshots');
      const req = store.getAll();
      req.onsuccess = () => {
        let items = (req.result || []) as RecoverySnapshotRecord[];
        if (projectId) {
          items = items.filter((i) => i.projectId === projectId);
        }
        if (items.length === 0) {
          resolve(null);
          return;
        }
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(items[0]);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async clearRecoverySnapshots(projectId?: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recoverySnapshots', 'readwrite');
      const store = tx.objectStore('recoverySnapshots');
      if (!projectId) {
        store.clear();
        tx.oncomplete = () => resolve();
      } else {
        const index = store.index('projectId');
        const req = index.openKeyCursor(IDBKeyRange.only(projectId));
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve();
      }
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Reports CRUD ---
  public async saveReport(report: EngineeringReportDocument & { id: string; projectId: string }): Promise<void> {
    await this.executeTx('reports', 'readwrite', (store) => store.put(report));
  }

  public async getReportsForProject(projectId: string): Promise<any[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reports', 'readonly');
      const store = tx.objectStore('reports');
      const index = store.index('projectId');
      const req = index.getAll(IDBKeyRange.only(projectId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Settings CRUD ---
  public async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const res = await this.executeTx<SettingsRecord | undefined>('settings', 'readonly', (store) => store.get(key));
      return res ? (res.value as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  public async setSetting<T>(key: string, value: T): Promise<void> {
    const record: SettingsRecord = {
      key,
      value,
      updatedAt: new Date().toISOString(),
    };
    await this.executeTx('settings', 'readwrite', (store) => store.put(record));
  }

  // --- Storage Quota and Stats ---
  public async getStorageEstimate(): Promise<{ usedBytes: number; quotaBytes: number; percentUsed: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 1;
        return {
          usedBytes: used,
          quotaBytes: quota,
          percentUsed: Math.min(100, Math.round((used / quota) * 100)),
        };
      } catch {
        // ignore
      }
    }
    return { usedBytes: 0, quotaBytes: 0, percentUsed: 0 };
  }
}

export const localDb = new IndexedDbClient();
