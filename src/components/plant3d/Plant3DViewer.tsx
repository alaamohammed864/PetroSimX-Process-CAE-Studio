import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Plant3DViewerProps,
  RenderMode,
  VisualColorMode,
  CameraPreset,
} from './plant3DTypes';
import {
  buildEquipment3D,
  buildPipeRun,
  buildGroundAndRacks,
  mapCanvasTo3D,
  Unit3DMetadata,
  getStreamColor,
  getUnitPort,
} from './plant3DBuilders';
import { formatFlow, formatPres, formatTemp } from '../../engine/thermoEngine';
import { EquipmentUnit, ProcessStream } from '../../types/simulation';

interface FlowParticle {
  mesh: THREE.Mesh;
  path: THREE.CurvePath<THREE.Vector3>;
  t: number;
  speed: number;
}

/**
 * Rigorously disposes Three.js materials and associated WebGL textures
 */
function disposeThreeMaterial(mat: THREE.Material): void {
  const matAny = mat as unknown as Record<string, unknown>;
  const textureSlots = [
    'map',
    'lightMap',
    'bumpMap',
    'normalMap',
    'specularMap',
    'envMap',
    'alphaMap',
    'aoMap',
    'displacementMap',
    'emissiveMap',
    'gradientMap',
    'metalnessMap',
    'roughnessMap',
  ];

  for (const slot of textureSlots) {
    const tex = matAny[slot];
    if (tex && typeof (tex as { dispose?: () => void }).dispose === 'function') {
      (tex as { dispose: () => void }).dispose();
    }
  }
  mat.dispose();
}

/**
 * Traverses an Object3D hierarchy and systematically frees GPU geometries and materials
 */
function disposeThreeHierarchy(node: THREE.Object3D): void {
  for (let i = node.children.length - 1; i >= 0; i--) {
    disposeThreeHierarchy(node.children[i]);
  }

  if (node instanceof THREE.Mesh) {
    if (node.geometry) {
      node.geometry.dispose();
    }

    if (node.material) {
      if (Array.isArray(node.material)) {
        for (const m of node.material) {
          disposeThreeMaterial(m);
        }
      } else {
        disposeThreeMaterial(node.material);
      }
    }
  }

  if (node.parent) {
    node.parent.remove(node);
  }
}

export const Plant3DViewer: React.FC<Plant3DViewerProps> = ({
  units,
  streams,
  selectedUnitId,
  selectedStreamId,
  onSelectUnit,
  onSelectStream,
  onUpdateUnitPosition,
  onConnectUnits,
  onAddUnit,
  onAutoLayout,
  unitSystem,
  dynamicState,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport & Rendering states
  const [renderMode, setRenderMode] = useState<RenderMode>('realistic');
  const [colorMode, setColorMode] = useState<VisualColorMode>('phase');
  const [isFlowAnimated, setIsFlowAnimated] = useState<boolean>(true);
  const [showTags, setShowTags] = useState<boolean>(true);
  const [showPipeRacks, setShowPipeRacks] = useState<boolean>(true);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [hoveredEntity, setHoveredEntity] = useState<{ type: 'unit' | 'stream'; id: string; name: string } | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState<number>(0);
  const [moveStepMeters, setMoveStepMeters] = useState<number>(1.0);
  const [targetUnitToConnect, setTargetUnitToConnect] = useState<string>('');
  const [isAddBlockMenuOpen, setIsAddBlockMenuOpen] = useState<boolean>(false);

  // References for Three.js engine
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const unitMetasRef = useRef<Map<string, Unit3DMetadata>>(new Map());
  const pipeMeshesRef = useRef<Map<string, { mesh: THREE.Object3D; path: THREE.CurvePath<THREE.Vector3> }>>(new Map());
  const particlesRef = useRef<FlowParticle[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const highlightBoxRef = useRef<THREE.BoxHelper | null>(null);

  // Active selected entities
  const activeUnit = useMemo(() => units.find((u) => u.id === selectedUnitId), [units, selectedUnitId]);
  const activeStream = useMemo(() => streams.find((s) => s.id === selectedStreamId), [streams, selectedStreamId]);

  // Handle Camera Presets
  const applyCameraPreset = useCallback((preset: CameraPreset) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    switch (preset) {
      case 'isometric':
        camera.position.set(-18, 14, 22);
        controls.target.set(0, 2, 0);
        break;
      case 'top':
        camera.position.set(0, 35, 0.1);
        controls.target.set(0, 0, 0);
        break;
      case 'front':
        camera.position.set(0, 6, 28);
        controls.target.set(0, 3, 0);
        break;
      case 'side':
        camera.position.set(28, 6, 0);
        controls.target.set(0, 3, 0);
        break;
      case 'first-person':
        camera.position.set(-12, 1.8, 8);
        controls.target.set(0, 2, 0);
        break;
    }
    controls.update();
  }, []);

  // Focus Camera on Selected Unit
  const focusOnUnit = useCallback((unitId: string) => {
    const meta = unitMetasRef.current.get(unitId);
    if (!meta || !cameraRef.current || !controlsRef.current) return;

    const unitPos = meta.group.position;
    const controls = controlsRef.current;
    const camera = cameraRef.current;

    controls.target.copy(unitPos).add(new THREE.Vector3(0, 2, 0));
    camera.position.set(unitPos.x - 6, unitPos.y + 5, unitPos.z + 8);
    controls.update();
  }, []);

  // Move unit in 3D space by delta meters and sync back to 2D canvas
  const handleMoveUnit3D = useCallback((deltaX3D: number, deltaZ3D: number) => {
    if (!activeUnit || !onUpdateUnitPosition) return;
    const deltaCanvasX = Math.round(deltaX3D / 0.045);
    const deltaCanvasY = Math.round(deltaZ3D / 0.045);
    const newX = Math.max(30, activeUnit.x + deltaCanvasX);
    const newY = Math.max(30, activeUnit.y + deltaCanvasY);
    onUpdateUnitPosition(activeUnit.id, newX, newY);
  }, [activeUnit, onUpdateUnitPosition]);

  // Update selection highlight box
  useEffect(() => {
    if (!sceneRef.current) return;

    if (highlightBoxRef.current) {
      sceneRef.current.remove(highlightBoxRef.current);
      highlightBoxRef.current.dispose();
      highlightBoxRef.current = null;
    }

    if (selectedUnitId && unitMetasRef.current.has(selectedUnitId)) {
      const meta = unitMetasRef.current.get(selectedUnitId)!;
      const box = new THREE.BoxHelper(meta.group, 0x4cd7f6);
      (box.material as THREE.LineBasicMaterial).linewidth = 2;
      sceneRef.current.add(box);
      highlightBoxRef.current = box;
    } else if (selectedStreamId && pipeMeshesRef.current.has(selectedStreamId)) {
      const pipeEntry = pipeMeshesRef.current.get(selectedStreamId)!;
      const box = new THREE.BoxHelper(pipeEntry.mesh, 0xfacc15);
      (box.material as THREE.LineBasicMaterial).linewidth = 2;
      sceneRef.current.add(box);
      highlightBoxRef.current = box;
    }
  }, [selectedUnitId, selectedStreamId]);

  // Main Three.js Scene Setup & Rebuilding
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060e20);
    scene.fog = new THREE.FogExp2(0x060e20, 0.015);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.2, 1000);
    camera.position.set(-18, 14, 22);
    cameraRef.current = camera;

    // Safe WebGL context test
    const testContext =
      canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!testContext) {
      setWebglError('WebGL context is not supported or was blocked by the browser environment.');
      return;
    }

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      setWebglError(null);
    } catch (err) {
      console.warn('WebGLRenderer initialization failed:', err);
      setWebglError('WebGL renderer could not be initialized.');
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglError('WebGL context was lost. Click "Reload 3D Engine" to restore rendering.');
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't go below ground
    controls.minDistance = 2;
    controls.maxDistance = 120;
    controls.target.set(0, 2, 0);
    controlsRef.current = controls;

    // Lighting (Sunlight + Ambient sky fill + Reflected ground bounce)
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.55);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(30, 45, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -35;
    dirLight.shadow.camera.right = 35;
    dirLight.shadow.camera.top = 35;
    dirLight.shadow.camera.bottom = -35;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const blueFillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    blueFillLight.position.set(-25, 20, -25);
    scene.add(blueFillLight);

    // Build Equipment in 3D Space
    unitMetasRef.current.clear();
    const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

    units.forEach((unit) => {
      const meta = buildEquipment3D(unit, renderMode);
      const pos = mapCanvasTo3D(unit.x, unit.y);
      meta.group.position.copy(pos);

      // Expand bounds
      bounds.minX = Math.min(bounds.minX, pos.x - 3);
      bounds.maxX = Math.max(bounds.maxX, pos.x + 3);
      bounds.minZ = Math.min(bounds.minZ, pos.z - 3);
      bounds.maxZ = Math.max(bounds.maxZ, pos.z + 3);

      scene.add(meta.group);
      meta.group.updateMatrixWorld(true);
      unitMetasRef.current.set(unit.id, meta);
    });

    // Build Ground and Structural Pipe Racks
    if (showPipeRacks) {
      buildGroundAndRacks(scene, bounds);
    }

    // Build Connecting Pipes and Particle Streams
    pipeMeshesRef.current.clear();
    particlesRef.current = [];

    // Particle geometry & shared material for flow visualization
    const particleGeo = new THREE.SphereGeometry(0.20, 16, 16);

    // Battery limit stations coordinates
    const westBatteryPos = new THREE.Vector3(-22.6, 0.75, 0);
    const eastBatteryPos = new THREE.Vector3(15.6, 0.8, 0);

    streams.forEach((stream, streamIndex) => {
      // Find source unit (which has this stream in outletStreamIds)
      const sourceUnit = units.find((u) => u.outletStreamIds.includes(stream.id));
      // Find destination unit (which has this stream in inletStreamIds)
      const destUnit = units.find((u) => u.inletStreamIds.includes(stream.id));

      let worldStart: THREE.Vector3 | null = null;
      let worldEnd: THREE.Vector3 | null = null;
      let startDir = new THREE.Vector3(1, 0, 0);
      let endDir = new THREE.Vector3(-1, 0, 0);

      const sourceMeta = sourceUnit ? unitMetasRef.current.get(sourceUnit.id) : null;
      const destMeta = destUnit ? unitMetasRef.current.get(destUnit.id) : null;

      if (sourceMeta) {
        const port = getUnitPort(sourceMeta, 'outlet', stream, streamIndex);
        worldStart = port.worldPos;
        startDir = port.direction;
      } else {
        // External battery limit feed (e.g. S-101 raw crude / feed)
        worldStart = westBatteryPos.clone();
        startDir = new THREE.Vector3(1, 0, 0);
      }

      if (destMeta) {
        const port = getUnitPort(destMeta, 'inlet', stream, streamIndex);
        worldEnd = port.worldPos;
        endDir = port.direction;
      } else {
        // External battery limit export (e.g. S-107 bottoms product)
        worldEnd = eastBatteryPos.clone();
        endDir = new THREE.Vector3(1, 0, 0);
      }

      if (worldStart && worldEnd) {
        const { mesh, path } = buildPipeRun(
          worldStart,
          worldEnd,
          stream,
          colorMode,
          0.09,
          startDir,
          endDir,
          streamIndex
        );
        scene.add(mesh);
        pipeMeshesRef.current.set(stream.id, { mesh, path });

        // Add animated high-visibility luminous flow particles along the pipe
        const particleColor = getStreamColor(stream, colorMode);
        const particleMat = new THREE.MeshStandardMaterial({
          color: particleColor,
          emissive: particleColor,
          emissiveIntensity: 0.95,
          roughness: 0.2,
          metalness: 0.3,
        });

        // 4 particles spaced along the pipe run for continuous fluid flow visualization
        const numParticles = 4;
        for (let p = 0; p < numParticles; p++) {
          const particleMesh = new THREE.Mesh(particleGeo, particleMat);
          scene.add(particleMesh);

          // Flow speed proportional to mass flow rate
          const speed = Math.max(0.002, Math.min(0.01, (stream.flowKgH / 50000) * 0.005));

          particlesRef.current.push({
            mesh: particleMesh,
            path,
            t: p / numParticles,
            speed,
          });
        }
      }
    });

    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let found = false;
      for (const hit of intersects) {
        let current: THREE.Object3D | null = hit.object;
        while (current && current !== scene) {
          if (current.userData?.type === 'equipment') {
            const u = units.find((item) => item.id === current?.userData.id);
            if (u) {
              setHoveredEntity({ type: 'unit', id: u.id, name: `${u.tag} - ${u.name}` });
              canvas.style.cursor = 'pointer';
              found = true;
              break;
            }
          } else if (current.userData?.type === 'pipe') {
            const s = current.userData.stream as ProcessStream;
            if (s) {
              setHoveredEntity({ type: 'stream', id: s.id, name: `${s.tag} (${s.name})` });
              canvas.style.cursor = 'pointer';
              found = true;
              break;
            }
          }
          current = current.parent;
        }
        if (found) break;
      }

      if (!found) {
        setHoveredEntity(null);
        canvas.style.cursor = 'default';
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let current: THREE.Object3D | null = hit.object;
        while (current && current !== scene) {
          if (current.userData?.type === 'equipment') {
            const uId = current.userData.id;
            onSelectUnit?.(uId);
            onSelectStream?.(null);
            return;
          }
          if (current.userData?.type === 'pipe') {
            const sId = current.userData.id;
            onSelectStream?.(sId);
            return;
          }
          current = current.parent;
        }
      }
    };

    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('click', handleClick);

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(container);

    // Animation Render Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Damped controls
      controls.update();

      // Flow particle animation
      if (isFlowAnimated) {
        particlesRef.current.forEach((p) => {
          p.t = (p.t + p.speed) % 1.0;
          const pos = p.path.getPointAt(p.t);
          if (pos) {
            p.mesh.position.copy(pos);
          }
        });
      }

      // Pulse status beacon lights
      unitMetasRef.current.forEach((meta) => {
        if (meta.beaconLight && meta.statusMaterial) {
          const isCalculating = meta.unit.status === 'calculating';
          const isDiverged = meta.unit.status === 'diverged';

          if (isCalculating) {
            meta.statusMaterial.emissiveIntensity = 0.5 + Math.sin(elapsed * 8) * 0.4;
          } else if (isDiverged) {
            meta.statusMaterial.emissiveIntensity = 0.6 + Math.sin(elapsed * 12) * 0.5;
          } else {
            meta.statusMaterial.emissiveIntensity = 0.8;
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup on unmount or re-render
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      resizeObserver.disconnect();
      controls.dispose();

      // Systematic GPU memory freeing
      disposeThreeHierarchy(scene);

      if (highlightBoxRef.current) {
        highlightBoxRef.current.geometry?.dispose();
        if (Array.isArray(highlightBoxRef.current.material)) {
          highlightBoxRef.current.material.forEach((m) => m.dispose());
        } else {
          highlightBoxRef.current.material?.dispose();
        }
        highlightBoxRef.current = null;
      }

      renderer.dispose();
      // Important: Do not invoke renderer.forceContextLoss() here, which permanently damages the canvas WebGL context across React re-mounts
      scene.clear();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, [units, streams, renderMode, colorMode, showPipeRacks, isFlowAnimated, onSelectUnit, onSelectStream, canvasKey]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] flex flex-col bg-[#060e20] text-[#dae2fd] select-none overflow-hidden"
    >
      {/* Top 3D Control Ribbon */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none gap-2">
        {/* Left Toolbar: Camera Views & Render Modes */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0f172a]/85 backdrop-blur-md border border-[#3d494c]/50 shadow-lg pointer-events-auto max-w-[calc(100vw-50px)] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 pr-2 border-r border-[#3d494c]/40">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[16px] pl-1">view_in_ar</span>
            <span className="font-bold text-[11px] text-[#dae2fd]">3D PLANT CAE</span>
          </div>

          {/* Camera Presets */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => applyCameraPreset('isometric')}
              className="px-2 py-1 text-[10.5px] font-mono rounded hover:bg-[#1e293b] text-[#bcc9cd] hover:text-[#dae2fd] transition-colors"
              title="Isometric 3D View"
            >
              ISO
            </button>
            <button
              onClick={() => applyCameraPreset('top')}
              className="px-2 py-1 text-[10.5px] font-mono rounded hover:bg-[#1e293b] text-[#bcc9cd] hover:text-[#dae2fd] transition-colors"
              title="Top Plan View"
            >
              PLAN
            </button>
            <button
              onClick={() => applyCameraPreset('front')}
              className="px-2 py-1 text-[10.5px] font-mono rounded hover:bg-[#1e293b] text-[#bcc9cd] hover:text-[#dae2fd] transition-colors"
              title="Front Elevation View"
            >
              ELEV
            </button>
            <button
              onClick={() => applyCameraPreset('side')}
              className="px-2 py-1 text-[10.5px] font-mono rounded hover:bg-[#1e293b] text-[#bcc9cd] hover:text-[#dae2fd] transition-colors"
              title="Side Elevation View"
            >
              SIDE
            </button>
          </div>

          <div className="w-[1px] h-4 bg-[#3d494c]/40" />

          {/* Render Mode (Realistic / X-Ray / Thermal) */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRenderMode('realistic')}
              className={`px-2 py-1 text-[10.5px] font-medium rounded transition-colors ${
                renderMode === 'realistic' ? 'bg-[#1bbd85]/30 text-[#4edea3] border border-[#4edea3]/40' : 'text-[#869397] hover:text-[#dae2fd]'
              }`}
            >
              Realistic
            </button>
            <button
              onClick={() => setRenderMode('x-ray')}
              className={`px-2 py-1 text-[10.5px] font-medium rounded transition-colors ${
                renderMode === 'x-ray' ? 'bg-[#0284c7]/30 text-[#38bdf8] border border-[#38bdf8]/40' : 'text-[#869397] hover:text-[#dae2fd]'
              }`}
              title="See inside vessels, columns, and catalyst beds"
            >
              X-Ray Shell
            </button>
          </div>

          <div className="w-[1px] h-4 bg-[#3d494c]/40" />

          {/* Color Gradient Mode */}
          <div className="flex items-center gap-1.5 px-1 text-[10.5px]">
            <span className="text-[#869397]">Color:</span>
            <select
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value as VisualColorMode)}
              className="bg-[#171f33] border border-[#3d494c]/40 text-[#dae2fd] text-[10.5px] rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
            >
              <option value="phase">Phase (Liq/Vap)</option>
              <option value="temperature">Thermal Heatmap</option>
              <option value="pressure">Pressure Gradient</option>
            </select>
          </div>

          <div className="w-[1px] h-4 bg-[#3d494c]/40" />

          {/* Flow Animation Toggle */}
          <button
            onClick={() => setIsFlowAnimated(!isFlowAnimated)}
            className={`p-1 rounded text-[11px] transition-colors ${
              isFlowAnimated ? 'text-[#4edea3] bg-[#1bbd85]/20' : 'text-[#869397] hover:text-[#dae2fd]'
            }`}
            title={isFlowAnimated ? 'Pause Flow Particle Animation' : 'Start Flow Particle Animation'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isFlowAnimated ? 'motion_photos_on' : 'motion_photos_paused'}
            </span>
          </button>

          {/* Structural Racks Toggle */}
          <button
            onClick={() => setShowPipeRacks(!showPipeRacks)}
            className={`p-1 rounded text-[11px] transition-colors ${
              showPipeRacks ? 'text-[#ffddb8] bg-[#ffddb8]/10' : 'text-[#869397] hover:text-[#dae2fd]'
            }`}
            title="Toggle Structural Racks & Foundation"
          >
            <span className="material-symbols-outlined text-[16px]">grid_goldenratio</span>
          </button>

          {/* Focus selected unit */}
          {selectedUnitId && (
            <button
              onClick={() => focusOnUnit(selectedUnitId)}
              className="px-2 py-1 text-[10.5px] font-mono rounded bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/40 hover:bg-[#4cd7f6]/30 transition-colors"
              title="Focus camera on selected equipment"
            >
              Focus {selectedUnitId}
            </button>
          )}

          {/* Add 3D Block Dropdown */}
          {onAddUnit && (
            <div className="relative">
              <button
                onClick={() => setIsAddBlockMenuOpen(!isAddBlockMenuOpen)}
                className="px-2 py-1 text-[10.5px] font-bold font-mono rounded bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/40 hover:bg-[#4edea3]/30 transition-colors flex items-center gap-1"
                title="Insert New 3D Equipment Block"
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">add_box</span>
                <span>+ ADD 3D BLOCK</span>
              </button>
              {isAddBlockMenuOpen && (
                <div className="absolute top-full mt-1.5 left-0 w-48 bg-[#0f172a] border border-[#3d494c] rounded-lg shadow-2xl py-1 z-30 font-mono text-[10.5px]">
                  {[
                    { type: 'reactor', label: 'Catalytic Reactor' },
                    { type: 'column', label: 'Distillation Column' },
                    { type: 'vessel', label: 'Flash Drum / Vessel' },
                    { type: 'heatex', label: 'Heat Exchanger' },
                    { type: 'furnace', label: 'Process Furnace' },
                    { type: 'pump', label: 'Feed Pump' },
                    { type: 'compressor', label: 'Compressor' },
                    { type: 'three_phase_separator', label: '3-Phase Separator' },
                    { type: 'valve', label: 'Control Valve' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      onClick={() => {
                        onAddUnit(item.type as any);
                        setIsAddBlockMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#1e293b] text-[#dae2fd] hover:text-[#4cd7f6] transition-colors"
                      type="button"
                    >
                      + {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Auto Align CAD button */}
          {onAutoLayout && (
            <button
              onClick={onAutoLayout}
              className="px-2 py-1 text-[10.5px] font-mono rounded bg-[#ffb95f]/20 text-[#ffb95f] border border-[#ffb95f]/40 hover:bg-[#ffb95f]/30 transition-colors flex items-center gap-1"
              title="Auto-arrange all 3D units with zero overlapping"
              type="button"
            >
              <span className="material-symbols-outlined text-[13px]">auto_fix_high</span>
              <span>AUTO-ALIGN</span>
            </button>
          )}
        </div>

        {/* Right Toolbar: Close button if modal */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#0f172a]/85 backdrop-blur-md border border-[#3d494c]/50 text-[#bcc9cd] hover:text-[#ffb4ab] pointer-events-auto transition-colors"
            title="Close 3D Viewport"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {/* Main Three.js Canvas or WebGL fallback notification */}
      {webglError ? (
        <div className="w-full h-full flex-1 flex flex-col items-center justify-center p-8 bg-[#0a1120] text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
            <span className="material-symbols-outlined text-[36px]">videogame_asset_off</span>
          </div>
          <h3 className="text-[16px] font-bold text-[#dae2fd] mb-2 font-mono tracking-tight">
            3D Plant CAE WebGL Diagnostics
          </h3>
          <p className="text-[12px] text-[#869397] max-w-md mb-6 leading-relaxed">
            {webglError} You can restore the 3D viewport canvas or continue plant design in the 2D Flowsheet view.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setWebglError(null);
                setCanvasKey((k) => k + 1);
              }}
              className="px-4 py-2 rounded-lg bg-[#4cd7f6] text-[#003640] font-bold text-[12px] hover:bg-[#72e2ff] transition-all flex items-center gap-2 shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Restore 3D Graphics Engine
            </button>
          </div>
        </div>
      ) : (
        <canvas
          key={canvasKey}
          ref={canvasRef}
          className="w-full h-full flex-1 cursor-grab active:cursor-grabbing outline-none"
        />
      )}

      {/* Hover Entity Label (Floating bottom center) */}
      {hoveredEntity && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#0f172a]/90 backdrop-blur-md border border-[#4cd7f6]/40 text-[#4cd7f6] font-mono text-[11px] shadow-lg pointer-events-none flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4cd7f6] animate-ping" />
          <span>{hoveredEntity.name}</span>
          <span className="text-[#869397] text-[10px]">(Click to inspect)</span>
        </div>
      )}

      {/* Dynamic Thermal / Pressure Color Legend */}
      <div className="absolute bottom-3 left-3 p-2 rounded-lg bg-[#0f172a]/85 backdrop-blur-md border border-[#3d494c]/40 font-mono text-[10px] text-[#bcc9cd] pointer-events-none shadow-md">
        {colorMode === 'temperature' && (
          <div className="space-y-1">
            <div className="text-[10.5px] font-bold text-[#dae2fd]">Thermal Gradient (°C)</div>
            <div className="w-48 h-2 rounded-sm bg-gradient-to-r from-[#38bdf8] via-[#facc15] to-[#ef4444]" />
            <div className="flex justify-between text-[#869397]">
              <span>&lt;40°C</span>
              <span>250°C</span>
              <span>&gt;500°C</span>
            </div>
          </div>
        )}

        {colorMode === 'pressure' && (
          <div className="space-y-1">
            <div className="text-[10.5px] font-bold text-[#dae2fd]">Operating Pressure (bar)</div>
            <div className="w-48 h-2 rounded-sm bg-gradient-to-r from-[#38bdf8] via-[#10b981] via-[#f59e0b] to-[#a855f7]" />
            <div className="flex justify-between text-[#869397]">
              <span>10 bar</span>
              <span>45 bar</span>
              <span>&gt;85 bar</span>
            </div>
          </div>
        )}

        {colorMode === 'phase' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
              <span>Liquid</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#4edea3]" />
              <span>Vapor</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffb95f]" />
              <span>Mixed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#acedff]" />
              <span>Recycle H2</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Help HUD (Bottom Right) */}
      <div className="hidden md:flex absolute bottom-3 right-3 p-2 rounded-lg bg-[#0f172a]/85 backdrop-blur-md border border-[#3d494c]/40 font-mono text-[9.5px] text-[#869397] pointer-events-none items-center gap-3">
        <span>Orbit: <strong className="text-[#dae2fd]">Left Drag</strong></span>
        <span>•</span>
        <span>Pan: <strong className="text-[#dae2fd]">Right Drag</strong></span>
        <span>•</span>
        <span>Zoom: <strong className="text-[#dae2fd]">Scroll</strong></span>
        <span>•</span>
        <span>Select: <strong className="text-[#dae2fd]">Click</strong></span>
      </div>

      {/* Selected Entity Details Drawer (Overlay Right) */}
      {(activeUnit || activeStream) && (
        <div className="absolute top-14 right-2 sm:right-3 w-80 max-w-[calc(100vw-20px)] max-h-[85%] overflow-y-auto rounded-xl bg-[#0f172a]/95 backdrop-blur-lg border border-[#3d494c]/60 p-3.5 shadow-2xl font-mono text-[11px] space-y-3 pointer-events-auto">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#3d494c]/40 pb-2">
            <div>
              <div className="flex items-center gap-1.5 text-[#4cd7f6] font-bold text-[12px]">
                <span className="material-symbols-outlined text-[16px]">
                  {activeUnit ? 'precision_manufacturing' : 'swap_calls'}
                </span>
                <span>{activeUnit ? activeUnit.tag : activeStream?.tag}</span>
              </div>
              <div className="text-[10px] text-[#869397] mt-0.5">
                {activeUnit ? activeUnit.name : activeStream?.name}
              </div>
            </div>

            <button
              onClick={() => {
                onSelectUnit?.('');
                onSelectStream?.(null);
              }}
              className="text-[#869397] hover:text-[#ffb4ab] p-1"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>

          {/* If Equipment Unit Selected */}
          {activeUnit && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-[#869397]">Equipment Type:</span>
                <span className="text-[#ffddb8] uppercase font-bold">{activeUnit.type}</span>
              </div>

              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-[#869397]">Solver Status:</span>
                <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-[#1bbd85]/20 text-[#4edea3]">
                  {activeUnit.status.toUpperCase()}
                </span>
              </div>

              <div className="p-2 rounded bg-[#171f33] border border-[#3d494c]/30 space-y-1">
                <div className="text-[10px] text-[#869397] font-bold">OPERATIONAL EQUILIBRIUM</div>
                <div className="flex justify-between text-[10.5px]">
                  <span>Inlet Temp:</span>
                  <span className="text-[#dae2fd]">{formatTemp(activeUnit.equilibrium.inletTempC, unitSystem)}</span>
                </div>
                <div className="flex justify-between text-[10.5px]">
                  <span>Outlet Temp:</span>
                  <span className="text-[#ffddb8]">{formatTemp(activeUnit.equilibrium.outletTempC, unitSystem)}</span>
                </div>
                <div className="flex justify-between text-[10.5px]">
                  <span>Operating Pres:</span>
                  <span className="text-[#dae2fd]">{formatPres(activeUnit.equilibrium.operatingPresBar, unitSystem)}</span>
                </div>
                <div className="flex justify-between text-[10.5px]">
                  <span>Pressure Drop (ΔP):</span>
                  <span className="text-[#ffb4ab]">{activeUnit.equilibrium.pressureDropBar.toFixed(2)} bar</span>
                </div>
                {activeUnit.equilibrium.dutyMW !== undefined && (
                  <div className="flex justify-between text-[10.5px]">
                    <span>Duty:</span>
                    <span className="text-[#4cd7f6]">{activeUnit.equilibrium.dutyMW.toFixed(2)} MW</span>
                  </div>
                )}
              </div>

              {/* Geometry Specs */}
              {activeUnit.geometry && (
                <div className="p-2 rounded bg-[#171f33] border border-[#3d494c]/30 space-y-1 text-[10.5px]">
                  <div className="text-[10px] text-[#869397] font-bold">MECHANICAL GEOMETRY</div>
                  {activeUnit.geometry.internalDiamM > 0 && (
                    <div className="flex justify-between">
                      <span>Internal Diameter:</span>
                      <span className="text-[#dae2fd]">{activeUnit.geometry.internalDiamM} m</span>
                    </div>
                  )}
                  {activeUnit.geometry.catalystVolumeM3 > 0 && (
                    <div className="flex justify-between">
                      <span>Catalyst Volume:</span>
                      <span className="text-[#4edea3]">{activeUnit.geometry.catalystVolumeM3} m³</span>
                    </div>
                  )}
                  {activeUnit.geometry.bedHeightM > 0 && (
                    <div className="flex justify-between">
                      <span>Bed Height:</span>
                      <span className="text-[#dae2fd]">{activeUnit.geometry.bedHeightM} m</span>
                    </div>
                  )}
                  {activeUnit.geometry.tubeCount && (
                    <div className="flex justify-between">
                      <span>Exchanger Tubes:</span>
                      <span className="text-[#dae2fd]">{activeUnit.geometry.tubeCount} tubes</span>
                    </div>
                  )}
                </div>
              )}

              {/* Connected Streams */}
              <div className="text-[10px] space-y-1">
                <span className="text-[#869397]">Connected Process Streams:</span>
                <div className="flex flex-wrap gap-1">
                  {activeUnit.inletStreamIds.map((sid) => (
                    <button
                      key={sid}
                      onClick={() => onSelectStream?.(sid)}
                      className="px-1.5 py-0.5 rounded bg-[#171f33] border border-[#3d494c]/40 text-[#4cd7f6] hover:bg-[#222a3d]"
                      type="button"
                    >
                      In: {sid}
                    </button>
                  ))}
                  {activeUnit.outletStreamIds.map((sid) => (
                    <button
                      key={sid}
                      onClick={() => onSelectStream?.(sid)}
                      className="px-1.5 py-0.5 rounded bg-[#171f33] border border-[#3d494c]/40 text-[#ffddb8] hover:bg-[#222a3d]"
                      type="button"
                    >
                      Out: {sid}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3D Spatial Position & Movement Controller (User Request) */}
              {onUpdateUnitPosition && (
                <div className="p-2.5 rounded-lg bg-[#171f33] border border-[#4cd7f6]/30 space-y-2 text-[10.5px]">
                  <div className="flex items-center justify-between font-bold text-[#4cd7f6]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">open_with</span>
                      <span>3D SPATIAL POSITION</span>
                    </span>
                    <span className="text-[9.5px] text-[#bcc9cd]">
                      [{(activeUnit.x * 0.045 - 25).toFixed(1)}m, {(activeUnit.y * 0.045 - 10).toFixed(1)}m]
                    </span>
                  </div>

                  {/* Step Distance Selector */}
                  <div className="flex items-center justify-between text-[10px] text-[#869397]">
                    <span>Step Distance:</span>
                    <div className="flex gap-1">
                      {[0.5, 1.0, 2.5].map((step) => (
                        <button
                          key={step}
                          onClick={() => setMoveStepMeters(step)}
                          className={`px-1.5 py-0.5 rounded ${
                            moveStepMeters === step
                              ? 'bg-[#4cd7f6] text-[#003640] font-bold'
                              : 'bg-[#222a3d] text-[#dae2fd] hover:bg-[#2e3950]'
                          }`}
                          type="button"
                        >
                          {step}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* D-Pad Movement Controller */}
                  <div className="flex flex-col items-center gap-1 py-1">
                    <button
                      onClick={() => handleMoveUnit3D(0, -moveStepMeters)}
                      className="w-20 py-1 bg-[#222a3d] hover:bg-[#4cd7f6]/20 hover:text-[#4cd7f6] border border-[#3d494c] rounded flex items-center justify-center gap-1 font-mono text-[10px]"
                      title="Move North (-Z)"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                      <span>NORTH</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMoveUnit3D(-moveStepMeters, 0)}
                        className="w-20 py-1 bg-[#222a3d] hover:bg-[#4cd7f6]/20 hover:text-[#4cd7f6] border border-[#3d494c] rounded flex items-center justify-center gap-1 font-mono text-[10px]"
                        title="Move West (-X)"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                        <span>WEST</span>
                      </button>
                      <div className="w-8 h-8 rounded-full bg-[#0b1326] border border-[#4cd7f6]/40 flex items-center justify-center text-[#4cd7f6] font-bold text-[9px]">
                        3D
                      </div>
                      <button
                        onClick={() => handleMoveUnit3D(moveStepMeters, 0)}
                        className="w-20 py-1 bg-[#222a3d] hover:bg-[#4cd7f6]/20 hover:text-[#4cd7f6] border border-[#3d494c] rounded flex items-center justify-center gap-1 font-mono text-[10px]"
                        title="Move East (+X)"
                        type="button"
                      >
                        <span>EAST</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </div>
                    <button
                      onClick={() => handleMoveUnit3D(0, moveStepMeters)}
                      className="w-20 py-1 bg-[#222a3d] hover:bg-[#4cd7f6]/20 hover:text-[#4cd7f6] border border-[#3d494c] rounded flex items-center justify-center gap-1 font-mono text-[10px]"
                      title="Move South (+Z)"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                      <span>SOUTH</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Connect 3D Pipeline Tool (User Request) */}
              {onConnectUnits && (
                <div className="p-2.5 rounded-lg bg-[#171f33] border border-[#ffb95f]/30 space-y-2 text-[10.5px]">
                  <div className="flex items-center gap-1 font-bold text-[#ffb95f]">
                    <span className="material-symbols-outlined text-[15px]">cable</span>
                    <span>CONNECT PIPELINE TO UNIT</span>
                  </div>
                  <div className="text-[10px] text-[#869397]">
                    Route and connect a stream from <strong className="text-[#dae2fd]">{activeUnit.id}</strong> to:
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={targetUnitToConnect}
                      onChange={(e) => setTargetUnitToConnect(e.target.value)}
                      className="flex-1 bg-[#0b1326] border border-[#3d494c] rounded px-2 py-1 text-[#dae2fd] text-[10px] focus:outline-none"
                    >
                      <option value="">-- Select Target Equipment --</option>
                      {units
                        .filter((u) => u.id !== activeUnit.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.id} ({u.name})
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => {
                        if (targetUnitToConnect) {
                          onConnectUnits(activeUnit.id, targetUnitToConnect);
                          setTargetUnitToConnect('');
                        }
                      }}
                      disabled={!targetUnitToConnect}
                      className="px-2.5 py-1 bg-[#ffb95f] hover:bg-[#ffc98a] disabled:opacity-40 disabled:hover:bg-[#ffb95f] text-[#2c1600] font-bold rounded text-[10.5px] transition-colors shrink-0"
                      type="button"
                    >
                      LINK
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* If Process Stream Selected */}
          {activeStream && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-[#869397]">Stream Phase:</span>
                <span className="text-[#4edea3] font-bold">{activeStream.phase}</span>
              </div>

              <div className="p-2 rounded bg-[#171f33] border border-[#3d494c]/30 space-y-1 text-[10.5px]">
                <div className="text-[10px] text-[#869397] font-bold">THERMODYNAMIC STATE</div>
                <div className="flex justify-between">
                  <span>Temperature:</span>
                  <span className="text-[#ffddb8]">{formatTemp(activeStream.tempC, unitSystem)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pressure:</span>
                  <span className="text-[#dae2fd]">{formatPres(activeStream.presBar, unitSystem)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mass Flow:</span>
                  <span className="text-[#4cd7f6]">{formatFlow(activeStream.flowKgH, unitSystem)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vapor Fraction:</span>
                  <span className="text-[#dae2fd]">{activeStream.vaporFraction.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Molecular Weight:</span>
                  <span className="text-[#dae2fd]">{activeStream.mw.toFixed(2)} g/mol</span>
                </div>
                <div className="flex justify-between">
                  <span>Density:</span>
                  <span className="text-[#dae2fd]">{activeStream.densityKgM3.toFixed(1)} kg/m³</span>
                </div>
              </div>

              {/* Component Compositions */}
              <div className="p-2 rounded bg-[#171f33] border border-[#3d494c]/30 space-y-1 text-[10px]">
                <div className="text-[9.5px] text-[#869397] font-bold">MOLE FRACTIONS</div>
                {Object.entries(activeStream.compositions).map(([comp, frac]) => (
                  <div key={comp} className="flex justify-between">
                    <span className="text-[#869397] uppercase">{comp}:</span>
                    <span className="text-[#dae2fd]">{(Number(frac) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
