import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Maximize2,
  Minimize2,
  Eye,
  RotateCcw,
  Bot,
  Sun,
  Layers,
  Sparkles,
  Info,
  Compass,
  Zap,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export interface SolarBlockData {
  id: string;
  row: string;
  col: number;
  soiling: number;
  isCleaning: boolean;
  lastCleaned: string;
  ratedOutputKw: number;
  dustType: 'Fine Sand' | 'Airborne Dust' | 'Bird Droppings' | 'Pollen' | string;
}

interface SolarFarm3DViewProps {
  blocks: any[];
  selectedBlock: any | null;
  onSelectBlock: (block: any) => void;
  dustStormActive: boolean;
  morningDewActive: boolean;
  cleanAllInProgress: boolean;
  windSpeed: number;
}

export const SolarFarm3DView: React.FC<SolarFarm3DViewProps> = ({
  blocks,
  selectedBlock,
  onSelectBlock,
  dustStormActive,
  morningDewActive,
  cleanAllInProgress,
  windSpeed
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'overview' | 'focus' | 'robot' | 'sun'>('overview');
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [sunAngleElevation, setSunAngleElevation] = useState<number>(45); // Degrees

  // Refs for Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const tableMeshesRef = useRef<Map<string, {
    group: THREE.Group;
    panelMesh: THREE.Mesh;
    soilingMesh: THREE.Mesh;
    borderMesh: THREE.LineSegments;
    labelSprite: THREE.Sprite;
  }>>(new Map());
  const robotMeshRef = useRef<THREE.Group | null>(null);
  const dustParticlesRef = useRef<THREE.Points | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Camera Orbit state
  const orbitStateRef = useRef({
    radius: 36,
    theta: Math.PI / 4, // azimuth
    phi: Math.PI / 3,   // elevation
    target: new THREE.Vector3(0, 0, 0),
    isPointerDown: false,
    prevPointerX: 0,
    prevPointerY: 0,
    button: 0
  });

  // Procedural Photovoltaic Texture Generator
  const solarPanelTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Deep Monocrystalline Silicon Blue Gradient
      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, '#0a2347');
      grad.addColorStop(0.5, '#071833');
      grad.addColorStop(1, '#051226');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Grid wafer cells (6x10 grid on each panel)
      ctx.strokeStyle = '#1e3a5f';
      ctx.lineWidth = 2;
      const cellW = 512 / 6;
      const cellH = 512 / 10;
      for (let x = 0; x <= 512; x += cellW) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      for (let y = 0; y <= 512; y += cellH) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }

      // Silver Busbars (conductive lines)
      ctx.strokeStyle = 'rgba(200, 225, 255, 0.4)';
      ctx.lineWidth = 1.2;
      for (let x = cellW / 3; x <= 512; x += cellW) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      for (let x = (cellW * 2) / 3; x <= 512; x += cellW) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 420;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071526);
    scene.fog = new THREE.FogExp2(0x071526, 0.015);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 300);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Clear previous canvas if any
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x7da4d4, 0.7);
    scene.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0x99ccff, 0x3d2b1f, 0.45);
    scene.add(hemisphereLight);

    const sunLight = new THREE.DirectionalLight(0xfff3d1, 1.8);
    sunLight.position.set(25, 35, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.bias = -0.0008;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // 5. Desert Ground Plane & Access Roads
    const groundGeo = new THREE.PlaneGeometry(120, 100, 32, 32);
    // Sand material with desert hue
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x141f2d,
      roughness: 0.95,
      metalness: 0.05
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.1;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Subtle desert access road grid lines
    const gridHelper = new THREE.GridHelper(90, 30, 0x22374e, 0x172636);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // 6. Build 24 Solar Tables (6 columns x 4 rows)
    const tableGroup = new THREE.Group();
    scene.add(tableGroup);

    const tableWidth = 3.6;
    const tableLength = 2.2;
    const tiltRad = (23 * Math.PI) / 180; // 23 degree tilt facing south (Bikaner optimal)

    const rowSpacing = 6.0;
    const colSpacing = 4.8;
    const startX = -((6 - 1) * colSpacing) / 2;
    const startZ = -((4 - 1) * rowSpacing) / 2;

    const rows = ['A', 'B', 'C', 'D'];

    rows.forEach((rowLetter, rIdx) => {
      for (let c = 1; c <= 6; c++) {
        const blockId = `${rowLetter}${c}`;
        const posX = startX + (c - 1) * colSpacing;
        const posZ = startZ + rIdx * rowSpacing;

        const blockGroup = new THREE.Group();
        blockGroup.position.set(posX, 0, posZ);
        blockGroup.name = blockId;

        // Mounting Structure: 4 Steel Posts & Torque Tube
        const steelMat = new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.4,
          metalness: 0.8
        });

        // Posts
        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8);
        const post1 = new THREE.Mesh(postGeo, steelMat);
        post1.position.set(-tableWidth * 0.35, 0.7, -0.4);
        post1.castShadow = true;
        const post2 = new THREE.Mesh(postGeo, steelMat);
        post2.position.set(tableWidth * 0.35, 0.7, -0.4);
        post2.castShadow = true;

        const frontPostGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8);
        const post3 = new THREE.Mesh(frontPostGeo, steelMat);
        post3.position.set(-tableWidth * 0.35, 0.35, 0.4);
        post3.castShadow = true;
        const post4 = new THREE.Mesh(frontPostGeo, steelMat);
        post4.position.set(tableWidth * 0.35, 0.35, 0.4);
        post4.castShadow = true;

        blockGroup.add(post1, post2, post3, post4);

        // Torque Tube
        const tubeGeo = new THREE.BoxGeometry(tableWidth * 0.9, 0.1, 0.1);
        const tube = new THREE.Mesh(tubeGeo, steelMat);
        tube.position.set(0, 0.85, 0);
        blockGroup.add(tube);

        // Solar Panel Table Assembly (Tilted at 23 degrees)
        const panelPivot = new THREE.Group();
        panelPivot.position.set(0, 0.9, 0);
        panelPivot.rotation.x = tiltRad;

        // Base Panel Mesh
        const panelGeo = new THREE.BoxGeometry(tableWidth, 0.04, tableLength);
        const panelMat = new THREE.MeshStandardMaterial({
          map: solarPanelTexture,
          roughness: 0.15,
          metalness: 0.85,
          color: 0xffffff
        });
        const panelMesh = new THREE.Mesh(panelGeo, panelMat);
        panelMesh.castShadow = true;
        panelMesh.receiveShadow = true;
        panelMesh.userData = { blockId };
        panelPivot.add(panelMesh);

        // Soiling Dust Overlay Mesh (Sitting slightly above panel surface)
        const soilingGeo = new THREE.PlaneGeometry(tableWidth * 0.98, tableLength * 0.98);
        const soilingMat = new THREE.MeshStandardMaterial({
          color: 0xd4a373,
          roughness: 0.95,
          transparent: true,
          opacity: 0.15,
          depthWrite: false
        });
        const soilingMesh = new THREE.Mesh(soilingGeo, soilingMat);
        soilingMesh.rotation.x = -Math.PI / 2;
        soilingMesh.position.y = 0.025;
        soilingMesh.userData = { blockId };
        panelPivot.add(soilingMesh);

        // Highlight Outline Border
        const edges = new THREE.EdgesGeometry(panelGeo);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.3
        });
        const borderMesh = new THREE.LineSegments(edges, lineMat);
        panelPivot.add(borderMesh);

        blockGroup.add(panelPivot);

        // 3D Canvas Text Sprite Label (Floating Block ID)
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 128;
        labelCanvas.height = 64;
        const lctx = labelCanvas.getContext('2d');
        if (lctx) {
          lctx.fillStyle = 'rgba(10, 30, 60, 0.85)';
          lctx.strokeStyle = '#38bdf8';
          lctx.lineWidth = 3;
          lctx.roundRect(4, 4, 120, 56, 10);
          lctx.fill();
          lctx.stroke();

          lctx.fillStyle = '#ffffff';
          lctx.font = 'bold 26px "JetBrains Mono", monospace';
          lctx.textAlign = 'center';
          lctx.textBaseline = 'middle';
          lctx.fillText(blockId, 64, 32);
        }
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMat = new THREE.SpriteMaterial({ map: labelTexture, depthTest: false, transparent: true });
        const labelSprite = new THREE.Sprite(labelMat);
        labelSprite.scale.set(1.4, 0.7, 1);
        labelSprite.position.set(0, 2.3, 0);
        blockGroup.add(labelSprite);

        tableGroup.add(blockGroup);

        tableMeshesRef.current.set(blockId, {
          group: blockGroup,
          panelMesh,
          soilingMesh,
          borderMesh,
          labelSprite
        });
      }
    });

    // 7. Autonomous Cleaning Robot 3D Model
    const robotGroup = new THREE.Group();
    robotGroup.name = 'AutonomousCleanerBot';

    // Robot Main Chassis
    const chassisGeo = new THREE.BoxGeometry(0.7, 0.16, 0.45);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.8
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.castShadow = true;
    robotGroup.add(chassis);

    // Microfiber Roller Brush (Green & Silver cylinder)
    const rollerGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.65, 16);
    const rollerMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.9
    });
    const roller = new THREE.Mesh(rollerGeo, rollerMat);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(0, -0.05, 0.26);
    robotGroup.add(roller);

    // Dual Caterpillar Rubber Tracks
    const trackGeo = new THREE.BoxGeometry(0.1, 0.12, 0.5);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
    const leftTrack = new THREE.Mesh(trackGeo, trackMat);
    leftTrack.position.set(-0.35, -0.04, 0);
    const rightTrack = new THREE.Mesh(trackGeo, trackMat);
    rightTrack.position.set(0.35, -0.04, 0);
    robotGroup.add(leftTrack, rightTrack);

    // Sensor LIDAR Dome & Solar PV Top Panel
    const domeGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.08, 12);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.1 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0, 0.12, 0);
    robotGroup.add(dome);

    // Glowing LED status beacon
    const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ledBeacon = new THREE.Mesh(ledGeo, ledMat);
    ledBeacon.position.set(0, 0.18, 0);
    robotGroup.add(ledBeacon);

    // Robot Headlight spot
    const headlight = new THREE.SpotLight(0x38bdf8, 2, 8, Math.PI / 6, 0.5);
    headlight.position.set(0, 0.05, 0.28);
    headlight.target.position.set(0, -0.5, 2);
    robotGroup.add(headlight);
    robotGroup.add(headlight.target);

    // Position robot initially at Block A3
    robotGroup.position.set(-startX, 1.05, -startZ);
    robotGroup.rotation.x = tiltRad;
    scene.add(robotGroup);
    robotMeshRef.current = robotGroup;

    // 8. Dynamic 3D Dust Particle System
    const particleCount = 1800;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 80;
      particlePositions[i * 3 + 1] = Math.random() * 20;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      particleVelocities[i * 3] = 0.1 + Math.random() * 0.2; // wind blow X
      particleVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xd4a373,
      size: 0.18,
      transparent: true,
      opacity: 0.25,
      blending: THREE.NormalBlending
    });
    const dustParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(dustParticles);
    dustParticlesRef.current = dustParticles;

    // 9. Initial Camera Position
    updateCameraPosition();

    // 10. Animation Loop
    let clock = new THREE.Clock();
    let robotProgress = 0;
    let robotDirection = 1;

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Animate Particles (Desert Dust Wind)
      if (dustParticlesRef.current) {
        const positions = dustParticlesRef.current.geometry.attributes.position.array as Float32Array;
        const speedMultiplier = dustStormActive ? 2.8 : Math.max(0.4, windSpeed / 20);

        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] += particleVelocities[i * 3] * speedMultiplier;
          positions[i * 3 + 1] += Math.sin(elapsed + i) * 0.01;
          positions[i * 3 + 2] += particleVelocities[i * 3 + 2] * speedMultiplier;

          // Wrap around boundary
          if (positions[i * 3] > 40) positions[i * 3] = -40;
          if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 18;
          if (positions[i * 3 + 1] > 22) positions[i * 3 + 1] = 0.5;
          if (positions[i * 3 + 2] > 40) positions[i * 3 + 2] = -40;
          if (positions[i * 3 + 2] < -40) positions[i * 3 + 2] = 40;
        }
        dustParticlesRef.current.geometry.attributes.position.needsUpdate = true;

        // Dust Storm Visual Intensity
        const mat = dustParticlesRef.current.material as THREE.PointsMaterial;
        mat.opacity = dustStormActive ? 0.75 : 0.22;
        mat.size = dustStormActive ? 0.35 : 0.16;
      }

      // Animate Autonomous Cleaning Robot Crawler
      if (robotMeshRef.current) {
        // Look for any active cleaning block or critical block
        const targetBlock = blocks.find(b => b.isCleaning) || blocks.find(b => b.soiling > 25) || blocks[2];
        const blockMeshEntry = tableMeshesRef.current.get(targetBlock.id);

        if (blockMeshEntry) {
          const tablePos = blockMeshEntry.group.position;
          
          if (targetBlock.isCleaning || cleanAllInProgress) {
            // Crawling motion across the solar table
            robotProgress += delta * 0.8 * robotDirection;
            if (robotProgress > 1) {
              robotProgress = 1;
              robotDirection = -1;
            } else if (robotProgress < -1) {
              robotProgress = -1;
              robotDirection = 1;
            }

            // Move robot across table length and width
            const sweepX = robotProgress * (tableWidth * 0.38);
            const sweepZ = Math.sin(elapsed * 4) * (tableLength * 0.32);

            robotMeshRef.current.position.set(
              tablePos.x + sweepX,
              tablePos.y + 0.95,
              tablePos.z + sweepZ
            );

            // Spin roller brush
            roller.rotation.x += delta * 20;

            // Pulse beacon light blue
            ledMat.color.setHex(0x38bdf8);
            ledBeacon.scale.setScalar(1 + Math.sin(elapsed * 10) * 0.25);
          } else {
            // Idle parked at docking position
            robotMeshRef.current.position.set(
              tablePos.x + tableWidth * 0.36,
              tablePos.y + 0.95,
              tablePos.z - tableLength * 0.35
            );
            ledMat.color.setHex(0x10b981); // Green idle beacon
            ledBeacon.scale.setScalar(1);
          }
        }
      }

      // Update camera smooth movement if orbiting or focusing
      updateCameraPosition();

      renderer.render(scene, camera);
    };

    animate();

    // 11. Handle Resize
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 420;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      renderer.dispose();
    };
  }, []);

  // Update Block Materials & Dust Layer when blocks data changes
  useEffect(() => {
    blocks.forEach(block => {
      const entry = tableMeshesRef.current.get(block.id);
      if (!entry) return;

      const { soilingMesh, borderMesh, labelSprite } = entry;
      const soilingMat = soilingMesh.material as THREE.MeshStandardMaterial;
      const borderMat = borderMesh.material as THREE.LineBasicMaterial;

      // Color coding & Opacity based on soiling %
      if (block.isCleaning) {
        soilingMat.opacity = 0.05;
        soilingMat.color.setHex(0x38bdf8);
        borderMat.color.setHex(0x38bdf8);
        borderMat.opacity = 0.95;
      } else if (block.soiling > 25) {
        // Critical sand crust
        soilingMat.opacity = Math.min(0.85, 0.35 + (block.soiling / 100) * 0.9);
        soilingMat.color.setHex(0xc2410c); // Dark terracotta sand
        borderMat.color.setHex(0xf43f5e);
        borderMat.opacity = 0.85;
      } else if (block.soiling >= 10) {
        // Moderate desert dust
        soilingMat.opacity = 0.2 + (block.soiling / 100) * 0.6;
        soilingMat.color.setHex(0xd97706); // Amber dust
        borderMat.color.setHex(0xf59e0b);
        borderMat.opacity = 0.5;
      } else {
        // Clean sparkling silicon
        soilingMat.opacity = 0.05;
        soilingMat.color.setHex(0x10b981);
        borderMat.color.setHex(0x10b981);
        borderMat.opacity = 0.3;
      }

      // Selected block pulse / highlight
      const isSelected = selectedBlock?.id === block.id;
      const isHovered = hoveredBlockId === block.id;

      if (isSelected || isHovered) {
        borderMat.color.setHex(0x38bdf8);
        borderMat.opacity = 1.0;
        labelSprite.scale.set(1.8, 0.9, 1);
      } else {
        labelSprite.scale.set(1.4, 0.7, 1);
      }
    });
  }, [blocks, selectedBlock, hoveredBlockId]);

  // Adjust Sun Angle Elevation based on slider/preset
  useEffect(() => {
    if (!sunLightRef.current) return;
    const rad = (sunAngleElevation * Math.PI) / 180;
    const dist = 45;
    sunLightRef.current.position.set(
      Math.cos(rad) * dist,
      Math.sin(rad) * dist,
      25
    );
  }, [sunAngleElevation]);

  // Camera Orbit & Presets calculation
  const updateCameraPosition = () => {
    const camera = cameraRef.current;
    if (!camera) return;

    const orbit = orbitStateRef.current;

    // Constrain phi (elevation) to prevent flipping
    orbit.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, orbit.phi));
    orbit.radius = Math.max(12, Math.min(75, orbit.radius));

    const x = orbit.target.x + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
    const y = orbit.target.y + orbit.radius * Math.cos(orbit.phi);
    const z = orbit.target.z + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);

    camera.position.set(x, y, z);
    camera.lookAt(orbit.target);
  };

  // Camera Preset Switcher
  const handleSetCameraPreset = (mode: 'overview' | 'focus' | 'robot' | 'sun') => {
    setCameraMode(mode);
    const orbit = orbitStateRef.current;

    if (mode === 'overview') {
      orbit.radius = 36;
      orbit.theta = Math.PI / 4;
      orbit.phi = Math.PI / 3.4;
      orbit.target.set(0, 1.2, 0);
    } else if (mode === 'focus') {
      const targetId = selectedBlock?.id || 'A3';
      const entry = tableMeshesRef.current.get(targetId);
      if (entry) {
        const p = entry.group.position;
        orbit.target.set(p.x, p.y + 1, p.z);
        orbit.radius = 11;
        orbit.theta = Math.PI / 3;
        orbit.phi = Math.PI / 4.2;
      }
    } else if (mode === 'robot') {
      if (robotMeshRef.current) {
        const p = robotMeshRef.current.position;
        orbit.target.set(p.x, p.y, p.z);
        orbit.radius = 9;
        orbit.theta = Math.PI / 2.2;
        orbit.phi = Math.PI / 3.8;
      }
    } else if (mode === 'sun') {
      orbit.radius = 42;
      orbit.theta = Math.PI / 6;
      orbit.phi = Math.PI / 5;
      orbit.target.set(0, 0, 0);
      setSunAngleElevation(65);
    }
  };

  // Mouse & Touch Orbit Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    orbitStateRef.current.isPointerDown = true;
    orbitStateRef.current.prevPointerX = e.clientX;
    orbitStateRef.current.prevPointerY = e.clientY;
    orbitStateRef.current.button = e.button;
    setIsOrbiting(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const orbit = orbitStateRef.current;
    if (orbit.isPointerDown) {
      const dx = e.clientX - orbit.prevPointerX;
      const dy = e.clientY - orbit.prevPointerY;
      orbit.prevPointerX = e.clientX;
      orbit.prevPointerY = e.clientY;

      if (orbit.button === 0) {
        // Orbit rotation
        orbit.theta -= dx * 0.007;
        orbit.phi -= dy * 0.007;
      } else if (orbit.button === 2) {
        // Pan
        const panSpeed = orbit.radius * 0.001;
        orbit.target.x -= dx * panSpeed;
        orbit.target.z -= dy * panSpeed;
      }
    } else {
      // Raycasting for block hover
      raycastBlock(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    orbitStateRef.current.isPointerDown = false;
    setIsOrbiting(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    orbitStateRef.current.radius += e.deltaY * 0.03;
  };

  // Raycast to find block under pointer
  const raycastBlock = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const panelMeshes: THREE.Mesh[] = [];
    tableMeshesRef.current.forEach(v => panelMeshes.push(v.panelMesh));

    const intersects = raycaster.intersectObjects(panelMeshes, false);
    if (intersects.length > 0) {
      const hitBlockId = intersects[0].object.userData?.blockId;
      if (hitBlockId) {
        setHoveredBlockId(hitBlockId);
        return;
      }
    }
    setHoveredBlockId(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const panelMeshes: THREE.Mesh[] = [];
    tableMeshesRef.current.forEach(v => panelMeshes.push(v.panelMesh));

    const intersects = raycaster.intersectObjects(panelMeshes, false);
    if (intersects.length > 0) {
      const hitBlockId = intersects[0].object.userData?.blockId;
      const found = blocks.find(b => b.id === hitBlockId);
      if (found) {
        onSelectBlock(found);
      }
    }
  };

  const activeHoveredBlock = useMemo(() => {
    if (!hoveredBlockId) return null;
    return blocks.find(b => b.id === hoveredBlockId) || null;
  }, [hoveredBlockId, blocks]);

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[440px] sm:h-[480px]'
      }`}
    >
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onClick={handleClick}
        onContextMenu={e => e.preventDefault()}
      />

      {/* Top Left HUD: Plant & Robot Status */}
      <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-2 z-10">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white backdrop-blur shadow-lg space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-bold tracking-tight font-mono text-[11px] text-cyan-300">
              3D DIGITAL TWIN · BIKANER 10 MW
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-300 font-mono">
            <span>Tilt: 23° South</span>
            <span>·</span>
            <span>24 Tables Active</span>
            <span>·</span>
            <span className="text-emerald-400">60 FPS WebGL</span>
          </div>
        </div>

        {/* Live Robot Telemetry Pill */}
        <div className="bg-blue-950/85 border border-blue-800/80 rounded-lg px-3 py-1.5 text-xs text-blue-100 backdrop-blur shadow-md flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <div className="text-[10px] font-mono leading-tight">
            <span className="font-bold text-white">Bot Alpha-1: </span>
            <span className={cleanAllInProgress ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
              {cleanAllInProgress ? 'Active Scrubbing (0.4 m/s)' : 'Docked (Standby)'}
            </span>
          </div>
        </div>
      </div>

      {/* Top Right HUD: Camera Angle Preset Buttons & Fullscreen */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 flex items-center gap-1 backdrop-blur shadow-lg">
          <button
            type="button"
            onClick={() => handleSetCameraPreset('overview')}
            title="Field Overview Angle"
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-colors flex items-center gap-1 ${
              cameraMode === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span className="hidden sm:inline">Overview</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetCameraPreset('focus')}
            title="Focus On Selected Block"
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-colors flex items-center gap-1 ${
              cameraMode === 'focus'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span className="hidden sm:inline">Focus</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetCameraPreset('robot')}
            title="Follow Robot Cleaner"
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-colors flex items-center gap-1 ${
              cameraMode === 'robot'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bot className="w-3 h-3" />
            <span className="hidden sm:inline">Robot Cam</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetCameraPreset('sun')}
            title="Desert Sun Angle"
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-colors flex items-center gap-1 ${
              cameraMode === 'sun'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sun className="w-3 h-3" />
            <span className="hidden sm:inline">Sun Angle</span>
          </button>
        </div>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter 3D Fullscreen'}
          className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-lg"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Hovered Block Interactive Telemetry Badge */}
      {activeHoveredBlock && (
        <div className="absolute bottom-14 left-3 pointer-events-none z-10 bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 text-white backdrop-blur shadow-2xl space-y-1 font-mono text-xs w-56 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1">
            <span className="font-bold text-amber-400">Block {activeHoveredBlock.id}</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                activeHoveredBlock.soiling > 25
                  ? 'bg-rose-500/30 text-rose-300'
                  : activeHoveredBlock.soiling >= 10
                  ? 'bg-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/30 text-emerald-300'
              }`}
            >
              {activeHoveredBlock.isCleaning ? 'Scrubbing' : activeHoveredBlock.soiling > 25 ? 'Critical' : 'Nominal'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[9px]">Soiling:</span>
              <span className="font-bold">{activeHoveredBlock.soiling}%</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">Dust Type:</span>
              <span className="font-semibold text-slate-200 truncate block">{activeHoveredBlock.dustType}</span>
            </div>
          </div>
          <p className="text-[9px] text-cyan-300 pt-1 border-t border-slate-800">
            Click panel to dispatch spot robot
          </p>
        </div>
      )}

      {/* Bottom Floating Control Strip: Interaction Helper & Sun Elevation */}
      <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
        <div className="bg-slate-900/85 border border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-300 backdrop-blur shadow-md flex items-center gap-2">
          <span>Left Drag: Orbit</span>
          <span>·</span>
          <span>Right Drag: Pan</span>
          <span>·</span>
          <span>Scroll: Zoom</span>
          <span>·</span>
          <span>Click: Select</span>
        </div>

        {/* Sun Angle Slider Widget */}
        <div className="pointer-events-auto bg-slate-900/85 border border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-300 backdrop-blur shadow-md flex items-center gap-2">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Solar Elevation:</span>
          <input
            type="range"
            min="15"
            max="80"
            value={sunAngleElevation}
            onChange={e => setSunAngleElevation(Number(e.target.value))}
            className="w-20 accent-amber-500 cursor-pointer h-1 bg-slate-700 rounded-lg"
          />
          <span className="font-bold text-amber-300">{sunAngleElevation}°</span>
        </div>
      </div>
    </div>
  );
};
