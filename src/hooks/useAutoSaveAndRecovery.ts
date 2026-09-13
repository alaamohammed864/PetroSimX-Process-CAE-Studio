import { useEffect, useState, useRef } from 'react';
import { EquipmentUnit, ProcessStream, ChemicalComponent } from '../types/simulation';
import { localDb, ProjectRecord, RecoverySnapshotRecord } from '../engine/storage/indexedDbClient';

interface UseAutoSaveAndRecoveryProps {
  currentProject: ProjectRecord;
  units: EquipmentUnit[];
  streams: ProcessStream[];
  components: ChemicalComponent[];
  onRestoreSnapshot: (snapshot: RecoverySnapshotRecord) => void;
  autoSaveIntervalMs?: number;
}

export function useAutoSaveAndRecovery({
  currentProject,
  units,
  streams,
  components,
  onRestoreSnapshot,
  autoSaveIntervalMs = 30000,
}: UseAutoSaveAndRecoveryProps) {
  const [pendingRecovery, setPendingRecovery] = useState<RecoverySnapshotRecord | null>(null);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const unitsRef = useRef(units);
  const streamsRef = useRef(streams);
  const componentsRef = useRef(components);
  const projectRef = useRef(currentProject);

  useEffect(() => {
    unitsRef.current = units;
    streamsRef.current = streams;
    componentsRef.current = components;
    projectRef.current = currentProject;
  }, [units, streams, components, currentProject]);

  // 1. Startup Recovery Check
  useEffect(() => {
    async function checkRecovery() {
      try {
        const latest = await localDb.getLatestRecoverySnapshot();
        if (!latest) return;

        const snapshotTime = new Date(latest.timestamp).getTime();
        const projectSaveTime = new Date(currentProject.updatedAt || 0).getTime();

        // If snapshot is newer by more than 10 seconds and has equipment
        if (snapshotTime > projectSaveTime + 10000 && latest.units.length > 0) {
          // Check if contents actually differ
          if (
            latest.units.length !== units.length ||
            latest.streams.length !== streams.length ||
            latest.projectName !== currentProject.name
          ) {
            setPendingRecovery(latest);
          }
        }
      } catch (err) {
        console.warn('Could not check recovery snapshots:', err);
      }
    }

    checkRecovery();
  }, [currentProject.id]);

  // 2. Periodic Auto-Save
  useEffect(() => {
    const interval = setInterval(async () => {
      // Don't auto-save if flowsheet is empty
      if (unitsRef.current.length === 0) return;

      try {
        setIsSaving(true);
        const now = new Date().toISOString();
        const snapshot: RecoverySnapshotRecord = {
          id: `rec-${projectRef.current.id}-${Date.now()}`,
          projectId: projectRef.current.id,
          timestamp: now,
          projectName: projectRef.current.name,
          units: JSON.parse(JSON.stringify(unitsRef.current)),
          streams: JSON.parse(JSON.stringify(streamsRef.current)),
          components: JSON.parse(JSON.stringify(componentsRef.current)),
          autoSaveReason: 'Periodic 30s auto-save checkpoint',
        };

        await localDb.saveRecoverySnapshot(snapshot);
        setLastAutoSaveTime(now);
      } catch (e) {
        console.warn('Auto-save snapshot error:', e);
      } finally {
        setIsSaving(false);
      }
    }, autoSaveIntervalMs);

    return () => clearInterval(interval);
  }, [autoSaveIntervalMs]);

  const acceptRecovery = () => {
    if (pendingRecovery) {
      onRestoreSnapshot(pendingRecovery);
      setPendingRecovery(null);
    }
  };

  const dismissRecovery = async () => {
    if (pendingRecovery) {
      await localDb.clearRecoverySnapshots(pendingRecovery.projectId);
      setPendingRecovery(null);
    }
  };

  return {
    pendingRecovery,
    lastAutoSaveTime,
    isSaving,
    acceptRecovery,
    dismissRecovery,
  };
}
