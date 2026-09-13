import React, { useState, useEffect, useRef } from 'react';
import { EquipmentUnit, ProcessStream, ChemicalComponent, UnitSystem } from '../../types/simulation';
import {
  localDb,
  ProjectRecord,
  ProjectVersionRecord,
  RecoverySnapshotRecord,
} from '../../engine/storage/indexedDbClient';
import {
  exportPetxProjectFile,
  parseAndValidatePetxFile,
  validateProjectBeforeSave,
  PetroSimXProjectPackage,
} from '../../engine/storage/projectFileManager';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: ProjectRecord;
  units: EquipmentUnit[];
  streams: ProcessStream[];
  components: ChemicalComponent[];
  simulationResult: any;
  unitSystem: UnitSystem;
  onLoadProject: (pkg: {
    project: ProjectRecord;
    units: EquipmentUnit[];
    streams: ProcessStream[];
    components: ChemicalComponent[];
  }) => void;
  onUpdateCurrentProject: (updated: Partial<ProjectRecord>) => void;
}

type TabType = 'saved-projects' | 'new-project' | 'import-export' | 'version-history' | 'storage-health';

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  units,
  streams,
  components,
  simulationResult,
  unitSystem,
  onLoadProject,
  onUpdateCurrentProject,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('saved-projects');
  const [projectsList, setProjectsList] = useState<ProjectRecord[]>([]);
  const [versionsList, setVersionsList] = useState<ProjectVersionRecord[]>([]);
  const [storageStats, setStorageStats] = useState<{ usedBytes: number; quotaBytes: number; percentUsed: number }>({
    usedBytes: 0,
    quotaBytes: 0,
    percentUsed: 0,
  });

  // New project state
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectAuthor, setNewProjectAuthor] = useState('');
  const [newProjectFacility, setNewProjectFacility] = useState('Process Area 100');
  const [newProjectTemplate, setNewProjectTemplate] = useState<'current' | 'blank' | 'ammonia' | 'distillation'>('current');

  // Version snapshot state
  const [commitNote, setCommitNote] = useState('');
  const [versionNumber, setVersionNumber] = useState('v1.1.0');

  // Overwrite safety dialog
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<(() => Promise<void>) | null>(null);
  const [overwriteTargetName, setOverwriteTargetName] = useState('');

  // Status feedback
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen, currentProject.id]);

  const refreshData = async () => {
    try {
      const projs = await localDb.getAllProjects();
      setProjectsList(projs);

      const versions = await localDb.getVersionsForProject(currentProject.id);
      setVersionsList(versions);

      const stats = await localDb.getStorageEstimate();
      setStorageStats(stats);
    } catch (err) {
      console.error('Error refreshing project manager data:', err);
    }
  };

  const showNotification = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 5000);
  };

  // --- SAVE CURRENT PROJECT WITH PRE-VALIDATION & OVERWRITE SAFETY ---
  const handleSaveCurrentProject = async (isSaveAsCopy = false) => {
    setIsProcessing(true);

    const validation = validateProjectBeforeSave(currentProject, units, streams, components);
    if (!validation.isValid) {
      showNotification(`Pre-save validation failed: ${validation.errors.join('; ')}`, 'error');
      setIsProcessing(false);
      return;
    }

    const targetId = isSaveAsCopy ? `proj-${Date.now()}` : currentProject.id;
    const targetName = isSaveAsCopy ? `${currentProject.name} (Copy)` : currentProject.name;

    // Check if target name or ID conflicts with another existing project
    const existing = projectsList.find((p) => (p.name.toLowerCase() === targetName.toLowerCase() && p.id !== currentProject.id));
    if (existing && !isSaveAsCopy) {
      setOverwriteTargetName(targetName);
      setPendingSaveAction(() => async () => {
        await executeSaveProject(targetId, targetName);
      });
      setShowOverwriteModal(true);
      setIsProcessing(false);
      return;
    }

    await executeSaveProject(targetId, targetName);
    setIsProcessing(false);
  };

  const executeSaveProject = async (id: string, name: string) => {
    try {
      const now = new Date().toISOString();
      const updatedRecord: ProjectRecord = {
        ...currentProject,
        id,
        name,
        unitCount: units.length,
        streamCount: streams.length,
        lastConverged: simulationResult?.converged ?? true,
        updatedAt: now,
      };

      await localDb.saveProject(updatedRecord);
      await localDb.saveCase({
        id: `case-${id}`,
        projectId: id,
        name: 'Base Case Flowsheet',
        updatedAt: now,
        units,
        streams,
        components,
      });

      onUpdateCurrentProject(updatedRecord);
      await refreshData();
      showNotification(`Project "${name}" successfully saved to local IndexedDB.`, 'success');
      setShowOverwriteModal(false);
    } catch (err: any) {
      showNotification(`Failed to save project: ${err?.message || 'IndexedDB write error'}`, 'error');
    }
  };

  // --- CREATE NEW VERSION SNAPSHOT ---
  const handleCreateVersion = async () => {
    if (!commitNote.trim()) {
      showNotification('Please provide a commit note describing this engineering revision.', 'warning');
      return;
    }

    try {
      const newVersion: ProjectVersionRecord = {
        id: `ver-${Date.now()}`,
        projectId: currentProject.id,
        version: versionNumber,
        timestamp: new Date().toISOString(),
        commitNote,
        author: currentProject.author || 'Process Engineer',
        snapshot: {
          units: JSON.parse(JSON.stringify(units)),
          streams: JSON.parse(JSON.stringify(streams)),
          components: JSON.parse(JSON.stringify(components)),
          metadata: { ...currentProject },
        },
      };

      await localDb.createVersionSnapshot(newVersion);
      setCommitNote('');
      await refreshData();
      showNotification(`Version checkpoint ${versionNumber} archived in local database.`, 'success');
    } catch (err: any) {
      showNotification(`Failed to create version: ${err?.message}`, 'error');
    }
  };

  // --- RESTORE VERSION SNAPSHOT ---
  const handleRestoreVersion = (ver: ProjectVersionRecord) => {
    if (confirm(`Restore project to version ${ver.version} (${new Date(ver.timestamp).toLocaleString()})? Current unsaved modifications will be replaced.`)) {
      onLoadProject({
        project: {
          ...currentProject,
          ...ver.snapshot.metadata,
          updatedAt: new Date().toISOString(),
        },
        units: ver.snapshot.units,
        streams: ver.snapshot.streams,
        components: ver.snapshot.components,
      });
      showNotification(`Restored project state from version ${ver.version}.`, 'success');
      onClose();
    }
  };

  // --- EXPORT .PETX FILE ---
  const handleExportPetx = () => {
    try {
      const { filename, checksum } = exportPetxProjectFile(
        currentProject,
        units,
        streams,
        components,
        simulationResult
      );
      showNotification(`Exported native project file: ${filename} (Checksum: ${checksum})`, 'success');
    } catch (err: any) {
      showNotification(`Export failed: ${err?.message}`, 'error');
    }
  };

  // --- IMPORT .PETX FILE ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportWarnings([]);

    const res = await parseAndValidatePetxFile(file);
    if (!res.success || !res.projectPackage) {
      showNotification(`Import rejected: ${res.error}`, 'error');
      setIsProcessing(false);
      return;
    }

    if (res.warnings.length > 0) {
      setImportWarnings(res.warnings);
    }

    const pkg = res.projectPackage;
    onLoadProject({
      project: pkg.project,
      units: pkg.flowsheet.units,
      streams: pkg.flowsheet.streams,
      components: pkg.flowsheet.components || components,
    });

    // Also persist imported project to local IndexedDB
    try {
      await localDb.saveProject(pkg.project);
      await localDb.saveCase({
        id: `case-${pkg.project.id}`,
        projectId: pkg.project.id,
        name: 'Imported Flowsheet',
        updatedAt: new Date().toISOString(),
        units: pkg.flowsheet.units,
        streams: pkg.flowsheet.streams,
        components: pkg.flowsheet.components,
      });
      await refreshData();
    } catch (err) {
      console.warn('Could not auto-cache imported project in DB:', err);
    }

    showNotification(`Successfully imported and validated ${file.name}.`, 'success');
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- OPEN AN EXISTING PROJECT FROM LOCAL DB ---
  const handleOpenLocalProject = async (proj: ProjectRecord) => {
    try {
      const simCase = await localDb.getCaseForProject(proj.id);
      if (!simCase) {
        showNotification(`No flowsheet model found for project ${proj.name}.`, 'warning');
        return;
      }

      onLoadProject({
        project: proj,
        units: simCase.units,
        streams: simCase.streams,
        components: simCase.components,
      });

      showNotification(`Loaded project "${proj.name}".`, 'success');
      onClose();
    } catch (err: any) {
      showNotification(`Failed to open project: ${err?.message}`, 'error');
    }
  };

  // --- DELETE PROJECT ---
  const handleDeleteProject = async (id: string, name: string) => {
    if (id === currentProject.id) {
      showNotification('Cannot delete the currently active project.', 'warning');
      return;
    }

    if (confirm(`Are you sure you want to permanently delete project "${name}" from local storage?`)) {
      try {
        await localDb.deleteProject(id);
        await refreshData();
        showNotification(`Project "${name}" removed from local database.`, 'success');
      } catch (err: any) {
        showNotification(`Failed to delete project: ${err?.message}`, 'error');
      }
    }
  };

  // --- CREATE NEW PROJECT ---
  const handleCreateNewProject = async () => {
    if (!newProjectName.trim()) {
      showNotification('Project name cannot be blank.', 'warning');
      return;
    }

    const newId = `proj-${Date.now()}`;
    const newProj: ProjectRecord = {
      id: newId,
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || 'New Chemical Process CAE Model',
      author: newProjectAuthor.trim() || 'Process Engineer',
      facility: newProjectFacility.trim() || 'Plant Section',
      revision: 'A',
      version: '1.0.0',
      unitSystem: unitSystem,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unitCount: newProjectTemplate === 'blank' ? 0 : units.length,
      streamCount: newProjectTemplate === 'blank' ? 0 : streams.length,
    };

    let templateUnits = units;
    let templateStreams = streams;
    if (newProjectTemplate === 'blank') {
      templateUnits = [];
      templateStreams = [];
    }

    try {
      await localDb.saveProject(newProj);
      await localDb.saveCase({
        id: `case-${newId}`,
        projectId: newId,
        name: 'Initial Flowsheet',
        updatedAt: new Date().toISOString(),
        units: templateUnits,
        streams: templateStreams,
        components,
      });

      onLoadProject({
        project: newProj,
        units: templateUnits,
        streams: templateStreams,
        components,
      });

      showNotification(`Created project "${newProj.name}".`, 'success');
      onClose();
    } catch (err: any) {
      showNotification(`Failed to create project: ${err?.message}`, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans">
      <div className="w-full max-w-4xl bg-[#131b2e] border border-[#3d494c] rounded-xl shadow-2xl flex flex-col max-h-[85vh] text-[#dae2fd] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#0b1326] border-b border-[#3d494c]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#4cd7f6]/20 border border-[#4cd7f6]/40 flex items-center justify-center text-[#4cd7f6]">
              <span className="material-symbols-outlined text-[20px]">folder_managed</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide uppercase text-white">
                  PetroSimX Project &amp; Offline Storage Studio
                </h2>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-[#005234] text-[#4edea3] border border-[#4edea3]/30">
                  INDEXEDDB ACTIVE
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#869397]">
                Active Project: <span className="text-[#4cd7f6] font-semibold">{currentProject.name}</span> ({currentProject.version || 'v1.0.0'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSaveCurrentProject(false)}
              className="flex items-center gap-1 px-3 py-1 bg-[#4cd7f6] hover:bg-[#38bde6] text-[#003643] text-xs font-mono font-bold rounded shadow-sm transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">save</span>
              <span>SAVE TO DB</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-[#869397] hover:text-white hover:bg-[#171f33]"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Bar */}
        {actionMessage && (
          <div className={`px-4 py-2 text-xs font-mono flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-[#005234]/80 text-[#4edea3] border-b border-[#4edea3]/30'
              : actionMessage.type === 'error'
              ? 'bg-[#93000a]/80 text-[#ffb4ab] border-b border-[#ffb4ab]/30'
              : 'bg-[#ffb95f]/20 text-[#ffddb8] border-b border-[#ffb95f]/30'
          }`}>
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="text-[10px] uppercase font-bold ml-2">Dismiss</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#3d494c]/40 bg-[#171f33] px-4 text-xs font-mono">
          <button
            onClick={() => setActiveTab('saved-projects')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-semibold transition-all ${
              activeTab === 'saved-projects'
                ? 'border-[#4cd7f6] text-[#4cd7f6] bg-[#131b2e]'
                : 'border-transparent text-[#869397] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">inventory_2</span>
            <span>Local Projects ({projectsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('new-project')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-semibold transition-all ${
              activeTab === 'new-project'
                ? 'border-[#4cd7f6] text-[#4cd7f6] bg-[#131b2e]'
                : 'border-transparent text-[#869397] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">add_circle</span>
            <span>New Project Wizard</span>
          </button>

          <button
            onClick={() => setActiveTab('import-export')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-semibold transition-all ${
              activeTab === 'import-export'
                ? 'border-[#4cd7f6] text-[#4cd7f6] bg-[#131b2e]'
                : 'border-transparent text-[#869397] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">import_export</span>
            <span>.PETX Native Files</span>
          </button>

          <button
            onClick={() => setActiveTab('version-history')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-semibold transition-all ${
              activeTab === 'version-history'
                ? 'border-[#4cd7f6] text-[#4cd7f6] bg-[#131b2e]'
                : 'border-transparent text-[#869397] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">history</span>
            <span>Revision Checkpoints ({versionsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('storage-health')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-semibold transition-all ${
              activeTab === 'storage-health'
                ? 'border-[#4cd7f6] text-[#4cd7f6] bg-[#131b2e]'
                : 'border-transparent text-[#869397] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">database</span>
            <span>Offline Diagnostics</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#0b1326]">
          {/* TAB 1: SAVED PROJECTS */}
          {activeTab === 'saved-projects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Local IndexedDB Database Catalog
                  </h3>
                  <p className="text-xs text-[#869397]">
                    Projects stored locally in your browser sandbox. Fully persistent across sessions and offline work.
                  </p>
                </div>
                <button
                  onClick={() => handleSaveCurrentProject(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c] text-xs font-mono text-[#dae2fd]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Save Copy of Current</span>
                </button>
              </div>

              {projectsList.length === 0 ? (
                <div className="p-8 text-center bg-[#131b2e] rounded-lg border border-[#3d494c]/30 space-y-2">
                  <span className="material-symbols-outlined text-[32px] text-[#869397]">inventory_2</span>
                  <p className="text-xs text-[#dae2fd]">No saved projects found in local storage.</p>
                  <button
                    onClick={() => handleSaveCurrentProject(false)}
                    className="px-3 py-1.5 bg-[#4cd7f6] text-[#003643] text-xs font-bold font-mono rounded"
                  >
                    Save Current Flowsheet as Project
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {projectsList.map((p) => {
                    const isCurrent = p.id === currentProject.id;
                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-lg border transition-all flex items-center justify-between ${
                          isCurrent
                            ? 'bg-[#171f33] border-[#4cd7f6]/60 shadow-md'
                            : 'bg-[#131b2e] border-[#3d494c]/40 hover:border-[#3d494c]'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{p.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#283552] text-[#4cd7f6]">
                              {p.version || 'v1.0.0'} (Rev {p.revision || '0'})
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#005234] text-[#4edea3]">
                                ACTIVE WORKSPACE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#bcc9cd] line-clamp-1">{p.description || 'No description provided.'}</p>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-[#869397]">
                            <span>Author: {p.author || 'Engineer'}</span>
                            <span>Facility: {p.facility || 'Area'}</span>
                            <span>Units: {p.unitCount ?? '—'}</span>
                            <span>Streams: {p.streamCount ?? '—'}</span>
                            <span>Updated: {new Date(p.updatedAt).toLocaleDateString()} {new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isCurrent && (
                            <button
                              onClick={() => handleOpenLocalProject(p)}
                              className="px-2.5 py-1 rounded bg-[#4cd7f6]/20 hover:bg-[#4cd7f6]/30 text-[#4cd7f6] text-xs font-mono font-bold border border-[#4cd7f6]/50"
                              title="Load this project into workspace"
                            >
                              OPEN
                            </button>
                          )}
                          <button
                            onClick={() => {
                              // Export directly
                              exportPetxProjectFile(p, units, streams, components, simulationResult);
                            }}
                            className="p-1.5 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] border border-[#3d494c]"
                            title="Export as .petx file"
                          >
                            <span className="material-symbols-outlined text-[15px]">download</span>
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => handleDeleteProject(p.id, p.name)}
                              className="p-1.5 rounded bg-[#171f33] hover:bg-[#93000a]/30 text-[#ffb4ab] border border-[#3d494c]"
                              title="Delete from local database"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NEW PROJECT WIZARD */}
          {activeTab === 'new-project' && (
            <div className="max-w-xl mx-auto space-y-4 font-mono text-xs">
              <div className="border-b border-[#3d494c]/40 pb-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Create New Process Engineering Project
                </h3>
                <p className="text-[11px] text-[#869397] font-sans">
                  Configure simulation metadata and initial flowsheet template.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-[#bcc9cd] mb-1 font-bold">Project Designation / Name *</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., Ethylbenzene Dehydrogenation Plant Rev 3"
                    className="w-full bg-[#171f33] border border-[#3d494c] rounded px-3 py-1.5 text-[#dae2fd] text-xs focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#bcc9cd] mb-1">Process Description &amp; Scope</label>
                  <textarea
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    rows={2}
                    placeholder="Process objectives, design basis, operating pressure range..."
                    className="w-full bg-[#171f33] border border-[#3d494c] rounded px-3 py-1.5 text-[#dae2fd] text-xs focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#bcc9cd] mb-1">Responsible Engineer</label>
                    <input
                      type="text"
                      value={newProjectAuthor}
                      onChange={(e) => setNewProjectAuthor(e.target.value)}
                      placeholder="e.g., Lead Process Modeler"
                      className="w-full bg-[#171f33] border border-[#3d494c] rounded px-3 py-1.5 text-[#dae2fd] text-xs focus:outline-none focus:border-[#4cd7f6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#bcc9cd] mb-1">Facility / Area Tag</label>
                    <input
                      type="text"
                      value={newProjectFacility}
                      onChange={(e) => setNewProjectFacility(e.target.value)}
                      placeholder="e.g., Area 300 - Reaction Section"
                      className="w-full bg-[#171f33] border border-[#3d494c] rounded px-3 py-1.5 text-[#dae2fd] text-xs focus:outline-none focus:border-[#4cd7f6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-[#bcc9cd] mb-1 font-bold">Initial Flowsheet Template</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewProjectTemplate('current')}
                      className={`p-2.5 rounded text-left border transition-all ${
                        newProjectTemplate === 'current'
                          ? 'border-[#4cd7f6] bg-[#4cd7f6]/10 text-white'
                          : 'border-[#3d494c] bg-[#171f33] text-[#869397]'
                      }`}
                    >
                      <span className="font-bold block text-[11px]">Clone Current Canvas</span>
                      <span className="text-[10px] font-sans">Retain all {units.length} units and {streams.length} streams</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewProjectTemplate('blank')}
                      className={`p-2.5 rounded text-left border transition-all ${
                        newProjectTemplate === 'blank'
                          ? 'border-[#4cd7f6] bg-[#4cd7f6]/10 text-white'
                          : 'border-[#3d494c] bg-[#171f33] text-[#869397]'
                      }`}
                    >
                      <span className="font-bold block text-[11px]">Blank Canvas</span>
                      <span className="text-[10px] font-sans">Start from scratch with clean flowsheet grid</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#3d494c]/40 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('saved-projects')}
                  className="px-3 py-1.5 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#bcc9cd]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewProject}
                  className="px-4 py-1.5 rounded bg-[#4cd7f6] hover:bg-[#38bde6] text-[#003643] font-bold"
                >
                  Create &amp; Initialize Project
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: .PETX NATIVE FILES (IMPORT & EXPORT) */}
          {activeTab === 'import-export' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  PetroSimX Native Project Interchange (.petx)
                </h3>
                <p className="text-xs text-[#869397]">
                  Export or import self-contained engineering project archives containing equipment specifications, stream matrices, kinetic ODE parameters, and cryptographic verification checksums.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="bg-[#131b2e] border border-[#3d494c]/40 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#4edea3]">
                      <span className="material-symbols-outlined text-[20px]">file_download</span>
                      <h4 className="font-bold text-sm">Export .PETX Archive</h4>
                    </div>
                    <p className="text-xs text-[#bcc9cd]">
                      Packages the active project metadata, {units.length} equipment units, {streams.length} streams, and {components.length} components into a verified JSON package.
                    </p>
                    <div className="bg-[#0b1326] p-2.5 rounded font-mono text-[10px] text-[#869397] space-y-0.5 border border-[#3d494c]/30">
                      <div>File Extension: <span className="text-[#dae2fd]">.petx</span></div>
                      <div>Format Identifier: <span className="text-[#dae2fd]">PETROSIMX_PROJECT</span></div>
                      <div>Schema Version: <span className="text-[#dae2fd]">v1</span></div>
                      <div>Integrity Algorithm: <span className="text-[#4edea3]">CRC32 Hash Checksum</span></div>
                    </div>
                  </div>

                  <button
                    onClick={handleExportPetx}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded bg-[#005234] hover:bg-[#006e46] text-[#4edea3] font-mono text-xs font-bold border border-[#4edea3]/40 shadow-sm"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Download Native .PETX File</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="bg-[#131b2e] border border-[#3d494c]/40 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#4cd7f6]">
                      <span className="material-symbols-outlined text-[20px]">file_upload</span>
                      <h4 className="font-bold text-sm">Import &amp; Validate .PETX</h4>
                    </div>
                    <p className="text-xs text-[#bcc9cd]">
                      Upload an existing .petx file. Built-in pre-flight audits detect file corruption, verify checksums, and prevent malformed data from loading.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".petx,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {importWarnings.length > 0 && (
                      <div className="p-2 bg-[#ffb95f]/15 border border-[#ffb95f]/30 rounded text-[10px] font-mono text-[#ffddb8] space-y-1">
                        <span className="font-bold block">Validation Warnings:</span>
                        {importWarnings.map((w, idx) => (
                          <div key={idx}>• {w}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded bg-[#4cd7f6]/20 hover:bg-[#4cd7f6]/30 text-[#4cd7f6] font-mono text-xs font-bold border border-[#4cd7f6]/50 shadow-sm"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">folder_open</span>
                    <span>{isProcessing ? 'Validating File...' : 'Select .PETX File to Load'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VERSION HISTORY & CHECKPOINTS */}
          {activeTab === 'version-history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Project Version History &amp; Revision Snapshots
                  </h3>
                  <p className="text-xs text-[#869397]">
                    Create immutable checkpoints for this project to record engineering design modifications or compare alternatives.
                  </p>
                </div>
              </div>

              {/* Create Checkpoint Form */}
              <div className="p-3.5 bg-[#131b2e] border border-[#3d494c]/40 rounded-lg space-y-2.5 font-mono text-xs">
                <span className="font-bold text-white block">Archive New Revision Checkpoint</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#869397] mb-1">Version Tag</label>
                    <input
                      type="text"
                      value={versionNumber}
                      onChange={(e) => setVersionNumber(e.target.value)}
                      placeholder="e.g. v1.1.0"
                      className="w-full bg-[#171f33] border border-[#3d494c] rounded px-2.5 py-1 text-[#dae2fd]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-[#869397] mb-1">Engineering Change Log / Note</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commitNote}
                        onChange={(e) => setCommitNote(e.target.value)}
                        placeholder="e.g., Increased recycle ratio to 4.2 to achieve 98.5% recovery"
                        className="flex-1 bg-[#171f33] border border-[#3d494c] rounded px-2.5 py-1 text-[#dae2fd]"
                      />
                      <button
                        onClick={handleCreateVersion}
                        className="px-3 py-1 bg-[#4cd7f6] text-[#003643] font-bold rounded"
                        type="button"
                      >
                        Commit
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Checkpoints List */}
              {versionsList.length === 0 ? (
                <div className="p-6 text-center bg-[#131b2e] rounded-lg border border-[#3d494c]/30">
                  <p className="text-xs text-[#869397] font-mono">No revision snapshots archived yet for this project.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versionsList.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 bg-[#131b2e] border border-[#3d494c]/40 rounded-lg flex items-center justify-between font-mono text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#4cd7f6]">{v.version}</span>
                          <span className="text-[#869397] text-[10px]">
                            {new Date(v.timestamp).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#bcc9cd]">by {v.author}</span>
                        </div>
                        <p className="text-xs text-[#dae2fd] font-sans">{v.commitNote}</p>
                        <div className="text-[10px] text-[#869397]">
                          Elements: {v.snapshot.units.length} units, {v.snapshot.streams.length} streams
                        </div>
                      </div>

                      <button
                        onClick={() => handleRestoreVersion(v)}
                        className="px-2.5 py-1 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#ffddb8] border border-[#ffb95f]/40 text-xs font-bold"
                      >
                        Restore Snapshot
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: OFFLINE STORAGE & DIAGNOSTICS */}
          {activeTab === 'storage-health' && (
            <div className="space-y-4 font-mono text-xs">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  IndexedDB Storage Diagnostics &amp; Cache Control
                </h3>
                <p className="text-xs text-[#869397] font-sans">
                  Real-time status of local storage partitions and browser quota allocation.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#131b2e] border border-[#3d494c]/40 p-3 rounded-lg">
                  <span className="text-[10px] text-[#869397] block">STORAGE USAGE</span>
                  <strong className="text-lg text-white">
                    {(storageStats.usedBytes / (1024 * 1024)).toFixed(2)} MB
                  </strong>
                  <span className="text-[10px] text-[#4edea3] block mt-1">
                    Quota: {(storageStats.quotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                  </span>
                </div>

                <div className="bg-[#131b2e] border border-[#3d494c]/40 p-3 rounded-lg">
                  <span className="text-[10px] text-[#869397] block">LOCAL OBJECT STORES</span>
                  <strong className="text-lg text-[#4cd7f6]">9 Partitions</strong>
                  <span className="text-[10px] text-[#869397] block mt-1">
                    IndexedDB v2 (Active)
                  </span>
                </div>

                <div className="bg-[#131b2e] border border-[#3d494c]/40 p-3 rounded-lg">
                  <span className="text-[10px] text-[#869397] block">RECOVERY SNAPSHOTS</span>
                  <strong className="text-lg text-[#ffb95f]">Automatic (30s)</strong>
                  <span className="text-[10px] text-[#4edea3] block mt-1">
                    Crash Protection Enabled
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#131b2e] border border-[#3d494c]/40 rounded-lg space-y-2">
                <span className="font-bold text-white block">Offline Capability Status</span>
                <div className="space-y-1 text-[11px] text-[#bcc9cd]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[#4edea3]">check_circle</span>
                    <span>All thermodynamic cubic equations of state run 100% locally in browser memory.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[#4edea3]">check_circle</span>
                    <span>Wegstein numerical recycle solver and graph cycle detection execute offline.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[#4edea3]">check_circle</span>
                    <span>Background simulation calculations execute on dedicated Web Workers.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px] text-[#4edea3]">check_circle</span>
                    <span>Zero external telemetry or database calls required to simulate or design.</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={async () => {
                    if (confirm('Clear crash recovery snapshots cache? Saved projects will remain intact.')) {
                      await localDb.clearRecoverySnapshots();
                      await refreshData();
                      showNotification('Cleared recovery snapshot cache.', 'success');
                    }
                  }}
                  className="px-3 py-1.5 rounded bg-[#171f33] hover:bg-[#222a3d] border border-[#3d494c] text-[#bcc9cd]"
                >
                  Clear Temp Snapshots
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Overwrite Confirmation Dialog ("Never silently overwrite a project") */}
        {showOverwriteModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 font-sans">
            <div className="w-full max-w-md bg-[#171f33] border-2 border-[#ffb95f] rounded-xl p-5 shadow-2xl space-y-3 text-[#dae2fd]">
              <div className="flex items-center gap-2 text-[#ffb95f]">
                <span className="material-symbols-outlined text-[24px]">warning</span>
                <h3 className="text-sm font-bold uppercase tracking-wider">Never Silently Overwrite Confirmation</h3>
              </div>
              <p className="text-xs text-[#bcc9cd]">
                A project named <strong className="text-white">"{overwriteTargetName}"</strong> already exists in your local IndexedDB storage.
              </p>
              <p className="text-xs text-[#869397]">
                To safeguard engineering data integrity, please choose how you want to proceed:
              </p>
              <div className="space-y-2 pt-2 font-mono text-xs">
                <button
                  onClick={async () => {
                    // Overwrite with automated backup
                    await localDb.createVersionSnapshot({
                      id: `pre-overwrite-${Date.now()}`,
                      projectId: currentProject.id,
                      version: `Backup-${new Date().toLocaleTimeString()}`,
                      timestamp: new Date().toISOString(),
                      commitNote: 'Automatic backup before overwrite',
                      author: currentProject.author || 'System',
                      snapshot: {
                        units,
                        streams,
                        components,
                        metadata: currentProject,
                      },
                    });
                    if (pendingSaveAction) await pendingSaveAction();
                  }}
                  className="w-full py-2 bg-[#ffb95f] hover:bg-[#ffa726] text-[#2c1600] font-bold rounded transition-all text-center block"
                >
                  Create Backup Snapshot &amp; Overwrite
                </button>

                <button
                  onClick={async () => {
                    setShowOverwriteModal(false);
                    await handleSaveCurrentProject(true);
                  }}
                  className="w-full py-2 bg-[#131b2e] hover:bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/50 font-bold rounded transition-all text-center block"
                >
                  Save as Separate Copy
                </button>

                <button
                  onClick={() => setShowOverwriteModal(false)}
                  className="w-full py-1.5 text-[#869397] hover:text-white text-center block text-[11px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
