/* eslint-disable no-param-reassign, space-infix-ops, space-before-blocks, no-plusplus */
import * as THREE from "three";
import { Power4, TweenMax } from "gsap";
import "three/examples/js/BufferGeometryUtils";
import AbstractApplication from "./views/AbstractApplication";
import Loaders from "./Loaders/Loaders";
import ParticleSystem from "./services/particlesSystem";
import Memories from "./data/memories.json";

class MainBrain extends AbstractApplication {
  constructor() {
    super();

    this.clock = new THREE.Clock();
    this.addBrain = this.addBrain.bind(this);
    this.addFloor();
    this.addIllumination();

    this.deltaTime = 0;
    this.particlesColor = new THREE.Color(0xffffff);
    this.particlesStartColor = new THREE.Color(0xffffff);
    this.memories = Memories;
    this.brainLines = [];
    this.brainMeshes = [];
    this.brainWireframes = [];
    this.brainBufferGeometries = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(999.0, 999.0);
    window.addEventListener("mousemove", this.onMouseMove.bind(this), false);
    window.addEventListener("click", this.onCanvasClick.bind(this), false);
    window.addEventListener("keydown", this.onKeyDown.bind(this), false);
    this.memorySelected = [
      "analytic",
      "episodic",
      "process",
      "semantic",
      "affective",
    ];
    this.frame = 0;
    this.frameName = 0;
    this.isRecording = false;
    this.cognitiveState = "IDLE";
    this.targetStateColors = null;

    // Subsystem live telemetry state cache
    this.isTelemetryWSConnected = false;
    this.backendAutoOff = true;
    this.backendMode = "ui-only";
    this.logicalTick = 0;
    this.telemetryData = {
      cpu_usage_pct: 12.0,
      ram_usage_mb: 138.0,
      awareness_rate: 0.85,
      attention_rate: 0.72,
      learning_rate: 0.50,
      regions: {
        executive: { frequency_hz: 120.0, latency_ms: 4.8, queue_backlog: 0 },
        working_memory: { frequency_hz: 240.0, latency_ms: 2.4, queue_backlog: 0 },
        values: { frequency_hz: 60.0, latency_ms: 12.6, queue_backlog: 0 },
        goals: { frequency_hz: 30.0, latency_ms: 15.2, queue_backlog: 0 },
        identity: { frequency_hz: 10.0, latency_ms: 3.2, queue_backlog: 0 },
        prediction: { frequency_hz: 45.0, latency_ms: 18.4, queue_backlog: 0 },
        language: { frequency_hz: 90.0, latency_ms: 5.1, queue_backlog: 0 },
        ltm: { frequency_hz: 25.0, latency_ms: 22.5, queue_backlog: 0 },
        world_model: { frequency_hz: 15.0, latency_ms: 35.2, queue_backlog: 0 },
        perception: { frequency_hz: 360.0, latency_ms: 1.8, queue_backlog: 0 },
        attention: { frequency_hz: 300.0, latency_ms: 2.1, queue_backlog: 0 },
        learning: { frequency_hz: 10.0, latency_ms: 45.0, queue_backlog: 0 },
        device_adapters: { frequency_hz: 1000.0, latency_ms: 0.8, queue_backlog: 0 }
      }
    };

    // Define coordinates scaled up (radius ~46-49) to clear center space
    this.pExecutive = new THREE.Vector3(-18, 39, 23); // Left Frontal
    this.pAttention = new THREE.Vector3(-20, 39, -20); // Top Parietal
    this.pPrediction = new THREE.Vector3(20, 36, 26); // Right Front
    this.pPerception = new THREE.Vector3(-28, 13, -36); // Back (Occipital Lobe)
    this.pWorldModel = new THREE.Vector3(43, 13, 20); // Mid-right inner cortical wall
    this.pWorkingMemory = new THREE.Vector3(-34, 16, 29); // Left Frontal (dlPFC)
    this.pGoals = new THREE.Vector3(0, 20, 44); // Center frontal (Medial Frontal)
    this.pLTM = new THREE.Vector3(-42, -20, -13); // Left Lower Temporal
    this.pValues = new THREE.Vector3(20, -13, 42); // Center-Right Front
    this.pLanguage = new THREE.Vector3(-44, -7, 20); // Left Side (Temporal)
    this.pIdentity = new THREE.Vector3(13, -20, 39); // Medial center inner wall
    this.pLearning = new THREE.Vector3(-20, -36, -26); // Bottom Rear
    this.pDeviceAdapters = new THREE.Vector3(0, -42, -20); // Bottom Brainstem / Cerebellum

    // Legacy labels compatibility aliases
    this.pMemory = this.pLTM;
    this.pReasoning = this.pWorldModel;

    // Setup backend telemetry socket listener
    this.setupTelemetryWS();

    this.loaders = new Loaders(
      this.runAnimation.bind(this),
      model => this.onBrainModelLoaded(model)
    );
  }

  setupTelemetryWS() {
    if (this.backendAutoOff) {
      this.isTelemetryWSConnected = false;
      this.backendMode = "ui-only";
      return;
    }

    try {
      this.telemetryWS = new WebSocket("ws://localhost:8080/telemetry");
      this.telemetryWS.onopen = () => {
        this.isTelemetryWSConnected = true;
        console.log("Telemetry WS Server link established.");
      };
      this.telemetryWS.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.parseTelemetryPayload(payload);

          // Dynamic Cognitive state visual mapping based on EventBus payload
          if (payload.event_type) {
            let targetState = "IDLE";
            const evt = payload.event_type.toLowerCase();
            if (evt.includes("perception") || evt.includes("sensor")) {
              targetState = "PREDICTING";
            } else if (evt.includes("attention") || evt.includes("workspace") || evt.includes("memory")) {
              targetState = "THINKING";
            } else if (evt.includes("decision") || evt.includes("intent") || evt.includes("goal")) {
              targetState = "DECISION";
            } else if (evt.includes("learn") || evt.includes("adapt")) {
              targetState = "LEARNING";
            } else if (evt.includes("execute") || evt.includes("action") || evt.includes("motor")) {
              targetState = "EXECUTING";
            } else if (evt.includes("error") || evt.includes("fail") || evt.includes("alert")) {
              targetState = "ERROR";
            }

            if (targetState !== "IDLE") {
              this.setCognitiveState(targetState);
              if (this.stateRevertTimer) clearTimeout(this.stateRevertTimer);
              this.stateRevertTimer = setTimeout(() => {
                this.setCognitiveState("IDLE");
              }, 2200);
            }
          }

          // Print telemetry logs
          if (payload.log_line) {
            console.log(payload.log_line);
          }
        } catch (err) {
          // Silent catch
        }
      };
      this.telemetryWS.onclose = () => {
        this.isTelemetryWSConnected = false;
        console.warn("Telemetry WS link disconnected. Fallback simulation active.");
        setTimeout(() => this.setupTelemetryWS(), 5000);
      };
    } catch (e) {
      this.isTelemetryWSConnected = false;
      setTimeout(() => this.setupTelemetryWS(), 5000);
    }
  }

  addConsoleLog(message, level = "info") {
    const terminal = document.getElementById("boot-terminal-lines");
    if (terminal) {
      const line = document.createElement("div");
      line.style.color = level === "warning" ? "#FFD600" : "#85F7FF";
      line.style.margin = "2px 0";
      line.style.fontFamily = "monospace";
      line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      terminal.appendChild(line);
      terminal.scrollTop = terminal.scrollHeight;
    }

    if (level === "warning") {
      console.warn(message);
    } else {
      console.log(message);
    }
  }

  addFloor() {
    const geometry = new THREE.PlaneBufferGeometry(20000, 20000);
    const material = new THREE.MeshPhongMaterial({
      color: 0x000000,
      opacity: 0.1,
      transparent: true,
    });
    this.plane = new THREE.Mesh(geometry, material);
    this.plane.receiveShadow = true;
    this.plane.position.y = -160;
    this.plane.rotation.x = -0.5 * Math.PI;
    this.scene.add(this.plane);
  }

  addIllumination() {
    this.ambienlight = new THREE.AmbientLight(0xb8c5cf, 0);
    this.scene.add(this.ambienlight);

    this.spotLight = new THREE.SpotLight(
      0xb8c5cf,
      1.45,
      175,
      Math.PI / 2,
      0.0,
      0.0
    );
    this.spotLight.position.set(0, 500, -10);
    this.spotLight.castShadow = true;

    this.spotLight.castShadow = true;
    this.spotLight.shadow = new THREE.LightShadow(
      new THREE.PerspectiveCamera(
        54,
        window.innerWidth / window.innerHeight,
        1,
        2000
      )
    );
    this.spotLight.shadow.bias = -0.000222;
    this.spotLight.shadow.mapSize.width = 1024;
    this.spotLight.shadow.mapSize.height = 1024;

    this.scene.add(this.spotLight);
    this.spotLightHelper = new THREE.SpotLightHelper(this.spotLight);
  }

  addBrain() {
    this.innerCoreGroup = new THREE.Group();
    this.innerCoreSpheres = [];

    const coreColors = [0x7C3AED, 0xA855F7, 0x00E5FF];
    const coreSizes = [12, 7, 3];

    for (let k = 0; k < 3; k += 1) {
      const geom = new THREE.SphereGeometry(coreSizes[k], 32, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: coreColors[k],
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const sphere = new THREE.Mesh(geom, mat);
      this.innerCoreGroup.add(sphere);
      this.innerCoreSpheres.push(sphere);
    }
    this.scene.add(this.innerCoreGroup);

    this.addNeuralVeins();
    this.lSystemGroup = new THREE.Group();
    this.scene.add(this.lSystemGroup);

    // Smoothly fade in concentric core spheres immediately
    this.innerCoreSpheres.forEach((sphere, idx) => {
      let targetOpacity = 0.25;
      if (idx === 0) targetOpacity = 0.08;
      else if (idx === 1) targetOpacity = 0.15;
      TweenMax.to(sphere.material, 1.5, { opacity: targetOpacity });
    });
  }

  onBrainModelLoaded(model) {
    if (!model) return;

    const lobeCenters = [
      { name: "executive", center: this.pExecutive },
      { name: "attention", center: this.pAttention },
      { name: "prediction", center: this.pPrediction },
      { name: "perception", center: this.pPerception },
      { name: "world_model", center: this.pWorldModel },
      { name: "working_memory", center: this.pWorkingMemory },
      { name: "goals", center: this.pGoals },
      { name: "ltm", center: this.pLTM },
      { name: "values", center: this.pValues },
      { name: "language", center: this.pLanguage },
      { name: "identity", center: this.pIdentity },
      { name: "learning", center: this.pLearning },
      { name: "motor", center: this.pDeviceAdapters }
    ];

    const linesToAdd = [];
    const meshesToAdd = [];

    model.traverse((child) => {
      if (child instanceof THREE.LineSegments) {
        this.memories.lines = {
          ...this.memories.lines,
          ...MainBrain.addLinesPath(child, this.memories),
        };

        const positionAttr = child.geometry.attributes.position;
        if (positionAttr && positionAttr.count) {
          const colors = [];
          for (let i = 0; i < positionAttr.count; i += 1) {
            const vx = positionAttr.getX(i);
            const vy = positionAttr.getY(i);
            const vz = positionAttr.getZ(i);
            const vPos = new THREE.Vector3(vx, vy, vz);

            let closestLobe = "process";
            let minDist = Infinity;
            lobeCenters.forEach((info) => {
              const d = vPos.distanceTo(info.center);
              if (d < minDist) {
                minDist = d;
                closestLobe = info.name;
              }
            });

            const color = new THREE.Color();
            if (closestLobe.includes("semantic")) {
              color.setHex(0x006DFF);
            } else if (closestLobe.includes("analytic") || closestLobe.includes("episodic")) {
              color.setHex(0xBD00FF);
            } else if (closestLobe.includes("affective")) {
              color.setHex(0x00E5FF);
            } else if (closestLobe.includes("cerebellum") || closestLobe.includes("bridge") || closestLobe.includes("amygdala")) {
              color.setHex(0xE040FB);
            } else {
              color.setHex(0xFFFFFF);
            }
            colors.push(color.r, color.g, color.b);
          }
          child.geometry.addAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
        }

        child.material = new THREE.LineBasicMaterial({
          vertexColors: THREE.VertexColors,
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        this.brainLines.push(child);
        linesToAdd.push(child);
      }
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      child.geometry.verticesNeedUpdate = true;

      let meshBaseColorHex = 0x13002E;
      let baseColorHex = 0x2A3D55;

      if (child.name.includes("semantic") || child.name.includes("episodic")) {
        meshBaseColorHex = 0x001D4E;
        baseColorHex = 0x006DFF;
      } else if (child.name.includes("analytic") || child.name.includes("process")) {
        meshBaseColorHex = 0x2A003E;
        baseColorHex = 0xBD00FF;
      } else if (child.name.includes("affective")) {
        meshBaseColorHex = 0x002A3E;
        baseColorHex = 0x00E5FF;
      } else if (child.name.includes("cerebellum") || child.name.includes("bridge") || child.name.includes("amygdala")) {
        meshBaseColorHex = 0x2E002A;
        baseColorHex = 0xE040FB;
      } else {
        meshBaseColorHex = 0x3E3E3E;
        baseColorHex = 0xFFFFFF;
      }

      child.material = new THREE.MeshBasicMaterial({
        color: meshBaseColorHex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      child.userData = { baseColor: new THREE.Color(meshBaseColorHex) };
      this.brainMeshes.push(child);
      meshesToAdd.push(child);

      const wireframeGeom = new THREE.WireframeGeometry(child.geometry);
      const wireframeMat = new THREE.LineBasicMaterial({
        color: baseColorHex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const wireframe = new THREE.LineSegments(wireframeGeom, wireframeMat);
      wireframe.name = child.name;
      wireframe.userData = { baseColor: new THREE.Color(baseColorHex) };
      this.brainWireframes.push(wireframe);
      meshesToAdd.push(wireframe);

      this.brainBufferGeometries.push(child.geometry);

      this.memories = {
        ...this.memories,
        ...MainBrain.storeBrainVertices(child, this.memories),
      };
    });

    linesToAdd.forEach(line => this.scene.add(line));
    meshesToAdd.forEach(mesh => this.scene.add(mesh));

    this.endPointsCollections = THREE.BufferGeometryUtils.mergeBufferGeometries(
      this.brainBufferGeometries
    );
    this.addParticlesSystem();

    // Smoothly fade in wireframes and meshes
    this.brainWireframes.forEach((wire) => {
      TweenMax.to(wire.material, 2.0, { opacity: 0.35 });
    });
    this.brainLines.forEach((line) => {
      TweenMax.to(line.material, 2.0, { opacity: 0.35 });
    });
    this.brainMeshes.forEach((mesh) => {
      TweenMax.to(mesh.material, 2.0, { opacity: 0.04 });
    });
    if (this.particlesSystem && this.particlesSystem.particles) {
      this.particlesSystem.particles.material.opacity = 0.0;
      TweenMax.to(this.particlesSystem.particles.material, 2.0, { opacity: 0.85 });
    }
  }

  addNeuralVeins() {
    this.neuralVeins = [];
    this.neuralVeinProgress = [];
    this.neuralVeinPaths = [];
    this.neuralVeinColors = [];
    this.neuralPackets = [];

    // Define standard biological node colors
    const nodeColors = {
      executive: 0xBD00FF, // Magenta/Purple
      attention: 0x00F2FE, // Teal
      prediction: 0xFFAE59, // Orange/Gold
      perception: 0x00E5FF, // Cyan
      world_model: 0xBD00FF, // Purple
      working_memory: 0x006DFF, // Blue
      goals: 0xFF3D00, // Red
      ltm: 0x3B82F6, // Deep Blue
      values: 0xFF5252, // Red/Pink
      language: 0xFFF176, // Yellow
      identity: 0xFFD600, // Gold
      learning: 0x32CD32, // Green
      motor: 0xFFFFFF // White
    };

    const nodes = [
      { id: "executive", pos: this.pExecutive },
      { id: "attention", pos: this.pAttention },
      { id: "prediction", pos: this.pPrediction },
      { id: "perception", pos: this.pPerception },
      { id: "world_model", pos: this.pWorldModel },
      { id: "working_memory", pos: this.pWorkingMemory },
      { id: "goals", pos: this.pGoals },
      { id: "ltm", pos: this.pLTM },
      { id: "values", pos: this.pValues },
      { id: "language", pos: this.pLanguage },
      { id: "identity", pos: this.pIdentity },
      { id: "learning", pos: this.pLearning },
      { id: "motor", pos: this.pDeviceAdapters }
    ];

    const connections = [
      ["executive", "attention"],
      ["executive", "prediction"],
      ["executive", "working_memory"],
      ["executive", "goals"],
      ["attention", "perception"],
      ["attention", "working_memory"],
      ["prediction", "world_model"],
      ["prediction", "goals"],
      ["perception", "world_model"],
      ["perception", "language"],
      ["world_model", "ltm"],
      ["working_memory", "ltm"],
      ["working_memory", "language"],
      ["goals", "values"],
      ["ltm", "values"],
      ["ltm", "learning"],
      ["values", "identity"],
      ["language", "identity"],
      ["identity", "learning"],
      ["learning", "motor"],
      ["motor", "executive"]
    ];

    connections.forEach((conn) => {
      const n1 = nodes.find(n => n.id === conn[0]);
      const n2 = nodes.find(n => n.id === conn[1]);
      if (n1 && n2) {
        const curve = this.createBezierCurve(n1.pos, n2.pos);
        const tubeGeom = new THREE.TubeGeometry(curve, 24, 0.22, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: nodeColors[conn[0]] || 0x00E5FF,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const tube = new THREE.Mesh(tubeGeom, tubeMat);
        this.scene.add(tube);
        this.neuralVeins.push(tube);

        this.neuralVeinPaths.push(curve);
        this.neuralVeinProgress.push(Math.random());
        this.neuralVeinColors.push(nodeColors[conn[0]] || 0x00E5FF);
      }
    });

    const center = new THREE.Vector3(0, 0, 0);

    nodes.forEach((node) => {
      const mid = new THREE.Vector3().addVectors(node.pos, center).multiplyScalar(0.5);
      const controlPoint = new THREE.Vector3(
        mid.x + (Math.random() - 0.5) * 8,
        mid.y + (Math.random() - 0.5) * 8,
        mid.z + (Math.random() - 0.5) * 8
      );
      const curve = new THREE.QuadraticBezierCurve3(node.pos, controlPoint, center);
      const tubeGeom = new THREE.TubeGeometry(curve, 24, 0.22, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: nodeColors[node.id] || 0xBD00FF,
        transparent: true,
        opacity: 0.10,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const tube = new THREE.Mesh(tubeGeom, tubeMat);
      this.scene.add(tube);
      this.neuralVeins.push(tube);

      this.neuralVeinPaths.push(curve);
      this.neuralVeinProgress.push(Math.random());
      this.neuralVeinColors.push(nodeColors[node.id] || 0x00E5FF);
    });

    this.nodeSpheres = [];

    nodes.forEach((node) => {
      const color = nodeColors[node.id] || 0x00E5FF;

      const geom = new THREE.SphereGeometry(1.6, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sphere = new THREE.Mesh(geom, mat);
      sphere.position.copy(node.pos);
      sphere.renderOrder = 100;
      this.scene.add(sphere);
      this.nodeSpheres.push(sphere);

      const ringGeom = new THREE.RingGeometry(2.0, 2.7, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.copy(node.pos);
      this.scene.add(ring);

      sphere.userData = {
        ring,
        baseScale: 1.0,
        color,
        id: node.id
      };
    });

    this.neuralVeinPaths.forEach((path, idx) => {
      const geom = new THREE.SphereGeometry(0.7, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: this.neuralVeinColors[idx] || 0x00E5FF,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const packet = new THREE.Mesh(geom, mat);
      packet.position.copy(path.getPointAt(this.neuralVeinProgress[idx]));
      packet.renderOrder = 100;
      this.scene.add(packet);
      this.neuralPackets.push(packet);
    });
  }

  createBezierCurve(start, end) {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(end, start);
    const offset = new THREE.Vector3(-dir.z, dir.y, dir.x).normalize().multiplyScalar(dir.length() * 0.05);
    const controlPoint = new THREE.Vector3().addVectors(mid, offset);

    return new THREE.QuadraticBezierCurve3(start, controlPoint, end);
  }

  static addLinesPath(mesh, memories) {
    const keys = Object.keys(memories.lines);
    keys.map((l) => {
      if (mesh.name.includes(l)) {
        memories.lines[l] = mesh.geometry.attributes.position.array;
        return memories.lines;
      }
      return [];
    });
  }

  static storeBrainVertices(mesh, memories) {
    const keys = Object.keys(memories);
    keys.map((m) => {
      if (mesh.name.includes(m)) {
        if (memories[m].length) {
          memories[m].push(mesh.geometry);
          memories[m] = [
            THREE.BufferGeometryUtils.mergeBufferGeometries(memories[m]),
          ];
          return memories;
        }
        return memories[m].push(mesh.geometry);
      }
      return [];
    });
  }

  runAnimation() {
    this.addBrain();

    this.setCognitiveState("IDLE");

    // Setup professional HTML control panel triggers
    this.stateButtons = document.querySelectorAll(".state-btn");
    this.activeLabel = document.getElementById("active-state-label");

    if (this.stateButtons) {
      this.stateButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const state = btn.getAttribute("data-state");
          this.setCognitiveState(state);
        });
      });
    }

    const toggleBtn = document.getElementById("btn-toggle-interact");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.raycastInteractActive = !this.raycastInteractActive;
        if (this.raycastInteractActive) {
          toggleBtn.textContent = "Interact: ON";
          toggleBtn.style.background = "rgba(0, 229, 255, 0.15)";
          toggleBtn.style.borderColor = "#00E5FF";
          toggleBtn.style.color = "#85F7FF";
        } else {
          toggleBtn.textContent = "Interact: OFF";
          toggleBtn.style.background = "rgba(220, 50, 50, 0.15)";
          toggleBtn.style.borderColor = "#ff5252";
          toggleBtn.style.color = "#ff8a80";
        }
      });
    }

    const rotationBtn = document.getElementById("btn-toggle-rotation");
    if (rotationBtn) {
      rotationBtn.addEventListener("click", () => {
        if (this.orbitControls) {
          this.orbitControls.autoRotate = !this.orbitControls.autoRotate;
          if (this.orbitControls.autoRotate) {
            rotationBtn.textContent = "Spin: ON";
            rotationBtn.style.background = "rgba(0, 229, 255, 0.15)";
            rotationBtn.style.borderColor = "#00E5FF";
            rotationBtn.style.color = "#85F7FF";
          } else {
            rotationBtn.textContent = "Spin: OFF";
            rotationBtn.style.background = "rgba(220, 50, 50, 0.15)";
            rotationBtn.style.borderColor = "#ff5252";
            rotationBtn.style.color = "#ff8a80";
          }
        }
      });
    }

    // Setup interactive HTML anatomical label click handlers
    const labels = [
      "label-perception", "label-attention", "label-working-memory", "label-long-term-memory",
      "label-world-model", "label-prediction", "label-goals", "label-values",
      "label-executive", "label-learning", "label-identity", "label-language",
      "label-device-adapters"
    ];

    labels.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          this.inspectSubsystem(id);
        });
      }
    });


    try {
      const signatureCodes = [
        169, 32, 50, 48, 50, 56, 32, 86, 105, 114, 97, 106, 118,
        101, 114, 115, 101, 32, 124, 32, 84, 97, 108, 105, 121,
        111, 32, 84, 101, 99, 104, 110, 111, 108, 111, 103, 105,
        101, 115
      ];
      const signature = String.fromCharCode(...signatureCodes);
      const dashboard = document.getElementById("cognitive-dashboard");
      if (dashboard) {
        const footer = document.createElement("div");
        footer.className = "dashboard-footer";
        footer.textContent = signature;
        dashboard.appendChild(footer);
      }
      console.log(
        `%c ${signature} | All Rights Reserved.`,
        "color: #00F2FE; font-weight: bold; font-size: 13px; font-family: sans-serif;"
      );
    } catch (e) {
      // Silent catch
    }

    this.animate();

    // 1. Synthetic high-fidelity boot sequence logs
    const addBootLog = (text, delay) => {
      setTimeout(() => {
        const term = document.getElementById('boot-terminal-lines');
        if (term) {
          const line = document.createElement('div');
          line.style.color = '#85F7FF';
          line.style.margin = '2px 0';
          line.style.fontFamily = 'monospace';
          line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
          term.appendChild(line);
          term.scrollTop = term.scrollHeight;
        }
      }, delay);
    };

    addBootLog("VALIDATING COGNITIVE ARCHITECTURE BLUEPRINTS...", 150);
    addBootLog("BACKEND AUTO-OFF. RUNNING UI-ONLY MODE...", 350);
    addBootLog("MAPPING 13 COGNITIVE SYSTEM LOBES...", 550);
    addBootLog("INJECTING PROCEDURAL DNA SEED: 829103...", 750);
    addBootLog("BOOT SUCCESSFUL. ENGAGING VISUAL EXPERIENCE...", 950);

    // 2. Trigger HUD panels cascading slide-in and fade overlay out
    setTimeout(() => {
      const overlay = document.getElementById('hud-boot-overlay');
      if (overlay) {
        overlay.classList.add('boot-fade-out');
        setTimeout(() => overlay.remove(), 800);
      }

      // Slide and fade top frame
      setTimeout(() => {
        const topEl = document.getElementById('console-top');
        if (topEl) {
          topEl.style.transform = 'translate3d(0, 0, 0)';
          topEl.style.opacity = '1';
        }
      }, 100);

      // Slide and fade left frame
      setTimeout(() => {
        const leftEl = document.getElementById('console-left');
        if (leftEl) {
          leftEl.style.transform = 'translate3d(0, 0, 0)';
          leftEl.style.opacity = '1';
        }
      }, 350);

      // Fade in floating region labels
      setTimeout(() => {
        const labelsContainer = document.getElementById('floating-labels-container');
        if (labelsContainer) {
          labelsContainer.style.opacity = '1';
        }
      }, 600);

      // Start WebGL intro zoom & camera orbit rotation
      this.startIntro();
    }, 1200);
  }

  startIntro() {
    const progress = { p: 1200, angle: Math.PI };
    TweenMax.fromTo(
      progress,
      6.0,
      { p: 1200, angle: Math.PI },
      {
        p: 380,
        angle: 0.0,
        ease: Power4.easeInOut,
        onUpdate: () => {
          // Circular horizontal orbit combined with vertical curve
          this.camera.position.x = Math.sin(progress.angle) * progress.p;
          this.camera.position.z = Math.cos(progress.angle) * progress.p;
          this.camera.position.y = 200.0 * (progress.p / 1200.0);
          this.camera.lookAt(new THREE.Vector3(0, 0, 0));
          if (this.orbitControls) {
            this.orbitControls.update();
          }
        },
        onStart: () => {
          if (this.particlesSystem && typeof this.particlesSystem.transform === "function") {
            this.particlesSystem.transform(true);
          }
        },
        onComplete: () => {
          this.startAutoDemo();
        }
      }
    );
  }

  startAutoDemo() {
    let memoryCount = 1;
    let memoryTimer;
    setTimeout(() => {
      if (this.particlesSystem && this.particlesSystem.xRay) {
        this.particlesSystem.xRay.visible = false;
      }
      if (this.particlesSystem && typeof this.particlesSystem.isXRayActive === "function") {
        this.setCognitiveState("RECOVERY");
      }
      setTimeout(() => {
        this.particlesSystem.isXRayActive(false);
        memoryTimer = setInterval(() => {
          if (memoryCount < 5) {
            if (memoryCount === 1) {
              this.setCognitiveState("PREDICTING");
            } else if (memoryCount === 2) {
              this.setCognitiveState("EXECUTING");
            } else if (memoryCount === 3) {
              this.setCognitiveState("LEARNING");
            } else if (memoryCount === 4) {
              this.setCognitiveState("DECISION");
            }
            memoryCount += 1;
          } else {
            this.setCognitiveState("THINKING");
            clearInterval(memoryTimer);
            setTimeout(() => {
              this.setCognitiveState("IDLE");
            }, 5000);
          }
        }, 9000);
      }, 4000);
    }, 2000);
  }

  onMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  onCanvasClick(event) {
    if (event.target.tagName === "BUTTON" || event.target.closest("#cognitive-dashboard")) {
      return;
    }
    if (!this.raycastInteractActive) {
      return;
    }
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Raycast clicked 13 Node Spheres first (Subsystem Selector)
    if (this.nodeSpheres) {
      const nodeIntersects = this.raycaster.intersectObjects(this.nodeSpheres);
      if (nodeIntersects.length > 0) {
        const clickedSphere = nodeIntersects[0].object;
        const nodeId = clickedSphere.userData.id;

        const labelMap = {
          executive: "label-executive",
          attention: "label-attention",
          prediction: "label-prediction",
          perception: "label-perception",
          world_model: "label-world-model",
          working_memory: "label-working-memory",
          goals: "label-goals",
          values: "label-values",
          language: "label-language",
          identity: "label-identity",
          learning: "label-learning",
          motor: "label-device-adapters",
          ltm: "label-long-term-memory"
        };

        const labelId = labelMap[nodeId];
        if (labelId) {
          this.inspectSubsystem(labelId);

          const targetPos = clickedSphere.position.clone();
          TweenMax.to(this.camera.position, 1.5, {
            x: targetPos.x * 1.5,
            y: targetPos.y * 1.5,
            z: targetPos.z * 1.5 + 40.0,
            ease: Power4.easeInOut,
            onUpdate: () => {
              if (this.orbitControls) {
                this.orbitControls.target.copy(targetPos);
              }
            }
          });
        }
        return;
      }
    }

    // 2. Otherwise, raycast solid brain meshes (lobe level zoom)
    const intersects = this.raycaster.intersectObjects(this.brainMeshes);
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const { name } = clickedMesh;

      let targetState = "IDLE";
      if (name.includes("process") || name.includes("analytic")) {
        targetState = this.cognitiveState === "THINKING" ? "DECISION" : "THINKING";
      } else if (name.includes("semantic") || name.includes("episodic")) {
        targetState = this.cognitiveState === "LEARNING" ? "RECOVERY" : "LEARNING";
      } else if (name.includes("affective")) {
        targetState = "PREDICTING";
      } else if (name.includes("cerebellum")) {
        targetState = "EXECUTING";
      } else if (name.includes("bridge") || name.includes("amygdala")) {
        targetState = "ERROR";
      }

      this.setCognitiveState(targetState);
    }
  }

  onKeyDown(event) {
    if (event.key === "Escape") {
      this.setCognitiveState("IDLE");
    }
  }

  addParticlesSystem() {
    this.particlesSystem = new ParticleSystem(
      this,
      this.endPointsCollections,
      this.memories
    );
    this.scene.add(this.particlesSystem.particles);
  }

  fadeSolidBrain(show) {
    this.brainMeshes.forEach((mesh) => {
      const targetOpacity = show ? 0.04 : 0.0;
      TweenMax.to(mesh.material, 3.0, {
        opacity: targetOpacity,
        ease: Power4.easeOut
      });
    });
    this.brainWireframes.forEach((wire) => {
      const targetOpacity = show ? 0.35 : 0.0;
      TweenMax.to(wire.material, 3.0, {
        opacity: targetOpacity,
        ease: Power4.easeOut
      });
    });
    if (this.innerCoreSpheres && this.innerCoreSpheres.length > 0) {
      this.innerCoreSpheres.forEach((sphere, idx) => {
        let targetOpacity = 0.0;
        if (show) {
          if (idx === 0) targetOpacity = 0.08;
          else if (idx === 1) targetOpacity = 0.15;
          else targetOpacity = 0.25;
        }
        TweenMax.to(sphere.material, 3.0, {
          opacity: targetOpacity,
          ease: Power4.easeOut
        });
      });
    }
  }

  setCognitiveState(state) {
    this.cognitiveState = state;

    if (this.stateButtons) {
      this.stateButtons.forEach((btn) => {
        const btnState = btn.getAttribute("data-state");
        if (btnState === state) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }

    if (this.activeLabel) {
      this.activeLabel.textContent = state;
      const stateColorsHex = {
        THINKING: "#BD00FF",
        PREDICTING: "#00E5FF",
        LEARNING: "#006DFF",
        DECISION: "#FFD600",
        EXECUTING: "#FFFFFF",
        ERROR: "#FF3D00",
        SLEEP: "#3B82F6",
        RECOVERY: "#93C5FD",
        IDLE: "#00F2FE"
      };
      if (stateColorsHex[state]) {
        this.activeLabel.style.color = stateColorsHex[state];
      }
    }

    let targetLobe = null;
    let labelTexts = [];

    if (state === "THINKING") {
      targetLobe = "process";
      labelTexts = ["EXECUTIVE SYSTEM", "SCHEDULER Ticks", "PROCESSING QUEUE: ACTIVE"];
    } else if (state === "DECISION") {
      targetLobe = "analytic";
      labelTexts = ["DECISION ENGINE", "WINNER PATH PULSING", "REWARDS & RISKS RESOLVED"];
    } else if (state === "LEARNING") {
      targetLobe = "semantic";
      labelTexts = ["LEARNING SYSTEM", "NEURAL GROWTH IN PROGRESS", "WEIGHTS OPTIMIZING"];
    } else if (state === "RECOVERY") {
      targetLobe = "episodic";
      labelTexts = ["EPISODIC RECOVERY", "CONSOLIDATION ACTIVE", "HEALTH CONTRACT: GREEN"];
    } else if (state === "PREDICTING") {
      targetLobe = "affective";
      labelTexts = ["PREDICTION ENGINE", "SCENARIO BRANCHING", "PROBABILITY TREES"];
    } else if (state === "EXECUTING") {
      targetLobe = "cerebellum";
      labelTexts = ["DEVICE ADAPTERS", "ACTUATORS BINDING", "IP LINK ESTABLISHED"];
    } else if (state === "ERROR") {
      targetLobe = "amygdala";
      labelTexts = ["CRITICAL ALARM", "BUDGET OVERRUNS DETECTED", "SAFE MODE ACTIVE"];
    }

    this.activeLobe = targetLobe;

    if (targetLobe) {
      const lobeMesh = this.brainMeshes.find(mesh => mesh.name.includes(targetLobe) || targetLobe.includes(mesh.name));
      if (lobeMesh) {
        lobeMesh.geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        lobeMesh.geometry.boundingBox.getCenter(center);
        lobeMesh.updateMatrixWorld();
        center.applyMatrix4(lobeMesh.matrixWorld);

        this.brainMeshes.forEach((mesh) => {
          const isActive = mesh.name.includes(targetLobe) || targetLobe.includes(mesh.name);
          TweenMax.to(mesh.material, 1.5, {
            opacity: isActive ? 0.08 : 0.01,
            ease: Power4.easeOut
          });
        });

        this.brainWireframes.forEach((wire) => {
          const isActive = wire.name.includes(targetLobe) || targetLobe.includes(wire.name);
          TweenMax.to(wire.material, 1.5, {
            opacity: isActive ? 0.85 : 0.03,
            ease: Power4.easeOut
          });
        });

        // Removed 3D text sprites to prevent visual clutter in the 3D space
      }
    } else {
      this.brainMeshes.forEach((mesh) => {
        TweenMax.to(mesh.material, 2.5, {
          opacity: 0.04,
          ease: Power4.easeOut
        });
      });

      this.brainWireframes.forEach((wire) => {
        TweenMax.to(wire.material, 2.5, {
          opacity: 0.35,
          ease: Power4.easeOut
        });
      });
    }

    const stateColors = {
      THINKING: {
 primary: 0x7C3AED, secondary: 0xA855F7, signal: 0xA855F7, core: 0x7C3AED, lines: 0x7C3AED, autoRotateSpeed: 1.2
},
      PREDICTING: {
 primary: 0x00E5FF, secondary: 0x4DEFFF, signal: 0x00E5FF, core: 0x00E5FF, lines: 0x00E5FF, autoRotateSpeed: 1.5
},
      LEARNING: {
 primary: 0x00E676, secondary: 0x7CFF9E, signal: 0x00E676, core: 0x00E676, lines: 0x00E676, autoRotateSpeed: 1.8
},
      DECISION: {
 primary: 0xFFD600, secondary: 0xFFC107, signal: 0xFFD600, core: 0xFFD600, lines: 0xFFD600, autoRotateSpeed: 2.0
},
      EXECUTING: {
 primary: 0xFF9800, secondary: 0xFFB74D, signal: 0xFF9800, core: 0xFF9800, lines: 0xFF9800, autoRotateSpeed: 2.5
},
      ERROR: {
 primary: 0xFF3D00, secondary: 0xFF8A80, signal: 0xFF3D00, core: 0xFF3D00, lines: 0xFF3D00, autoRotateSpeed: 4.0
},
      SLEEP: {
 primary: 0x1E3A8A, secondary: 0x3B82F6, signal: 0x1E3A8A, core: 0x1E3A8A, lines: 0x1E3A8A, autoRotateSpeed: 0.1
},
      RECOVERY: {
 primary: 0x93C5FD, secondary: 0x00E5FF, signal: 0x93C5FD, core: 0x00E5FF, lines: 0x00E5FF, autoRotateSpeed: 0.8
},
      IDLE: {
 primary: 0x0C0220, secondary: 0x1A083C, signal: 0x00F2FE, core: 0x7C3AED, lines: 0x006DFF, autoRotateSpeed: 0.5
}
    };

    const cfg = stateColors[state] || stateColors.IDLE;
    this.targetStateColors = cfg;

    this.orbitControls.autoRotateSpeed = cfg.autoRotateSpeed;

    if (this.bloomPass) {
      if (state === "SLEEP") {
        this.bloomPass.intensity = 0.08;
      } else if (state === "ERROR") {
        this.bloomPass.intensity = 0.90;
      } else {
        this.bloomPass.intensity = 0.45;
      }
    }
  }

  inspectSubsystem(labelId) {
    const details = {
      "label-executive": {
        name: "EXECUTIVE CORTEX",
        lobe: "Left Frontal Lobe",
        latency: "4.8ms",
        backpressure: "0%",
        freq: "120Hz",
        queue: "0",
        adapters: ["- compatibility.py", "- arbitrator.py", "- capability.py"]
      },
      "label-working-memory": {
        name: "WORKING MEMORY",
        lobe: "Left Frontal Lobe (dlPFC)",
        latency: "2.4ms",
        backpressure: "0%",
        freq: "240Hz",
        queue: "0",
        adapters: ["- working_memory.py", "- stubs/memory_stub.py"]
      },
      "label-values": {
        name: "VALUE SYSTEM",
        lobe: "Left-Mid Frontal Lobe (vmPFC)",
        latency: "12.6ms",
        backpressure: "0%",
        freq: "60Hz",
        queue: "1",
        adapters: ["- value/value.py", "- resolver.py"]
      },
      "label-goals": {
        name: "GOAL SYSTEM",
        lobe: "Medial Frontal Lobe (ACC)",
        latency: "15.2ms",
        backpressure: "5%",
        freq: "30Hz",
        queue: "2",
        adapters: ["- goal/goal.py", "- arbitrator.py"]
      },
      "label-identity": {
        name: "IDENTITY CORE",
        lobe: "Medial Center (PCC)",
        latency: "3.2ms",
        backpressure: "0%",
        freq: "10Hz",
        queue: "0",
        adapters: ["- identity/identity.py", "- self.py"]
      },
      "label-prediction": {
        name: "PREDICTION ENGINE",
        lobe: "Right Frontal Lobe (OFC)",
        latency: "18.4ms",
        backpressure: "8%",
        freq: "45Hz",
        queue: "3",
        adapters: ["- prediction/prediction.py", "- capability.py"]
      },
      "label-language": {
        name: "LANGUAGE SYSTEM",
        lobe: "Left Temporal Lobe (Broca/Wernicke)",
        latency: "5.1ms",
        backpressure: "0%",
        freq: "90Hz",
        queue: "0",
        adapters: ["- language/language.py", "- system_interfaces.py"]
      },
      "label-long-term-memory": {
        name: "LONG-TERM MEMORY",
        lobe: "Left Lower Temporal Lobe (Hippocampus)",
        latency: "22.5ms",
        backpressure: "12%",
        freq: "25Hz",
        queue: "5",
        adapters: ["- long_term_memory/ltm.py", "- stubs/vector_stub.py"]
      },
      "label-world-model": {
        name: "WORLD MODEL",
        lobe: "Mid-Right Boundary (TPO Association)",
        latency: "35.2ms",
        backpressure: "18%",
        freq: "15Hz",
        queue: "8",
        adapters: ["- world_model/world.py", "- discovery.py"]
      },
      "label-perception": {
        name: "PERCEPTION SYSTEM",
        lobe: "Occipital Lobe (Visual Cortex)",
        latency: "1.8ms",
        backpressure: "0%",
        freq: "360Hz",
        queue: "0",
        adapters: ["- perception/perception.py", "- device_adapters.py"]
      },
      "label-attention": {
        name: "ATTENTION SYSTEM",
        lobe: "Upper Parietal Cortex",
        latency: "2.1ms",
        backpressure: "0%",
        freq: "300Hz",
        queue: "0",
        adapters: ["- attention/attention.py", "- arbitrator.py"]
      },
      "label-learning": {
        name: "LEARNING SYSTEM",
        lobe: "Bottom Rear Left (Midbrain VTA)",
        latency: "45.0ms",
        backpressure: "25%",
        freq: "10Hz",
        queue: "12",
        adapters: ["- learning/learning.py", "- capability.py"]
      },
      "label-device-adapters": {
        name: "MOTOR SYSTEM",
        lobe: "Bottom Center (Cerebellum)",
        latency: "0.8ms",
        backpressure: "0%",
        freq: "1000Hz",
        queue: "0",
        adapters: ["- device_adapters.py", "- compatibility.py"]
      }
    };

    const data = details[labelId];
    if (!data) return;

    const emptyPanel = document.getElementById("inspector-empty");
    const contentPanel = document.getElementById("inspector-content");
    if (emptyPanel && contentPanel) {
      emptyPanel.style.display = "none";
      contentPanel.style.display = "flex";
    }

    const nameEl = document.getElementById("inspector-name");
    const lobeEl = document.getElementById("inspector-lobe");
    const latencyEl = document.getElementById("inspector-latency");
    const backpressureEl = document.getElementById("inspector-backpressure");
    const freqEl = document.getElementById("inspector-freq");
    const queueEl = document.getElementById("inspector-queue");

    if (nameEl) nameEl.innerText = data.name;
    if (lobeEl) lobeEl.innerText = data.lobe;
    if (latencyEl) latencyEl.innerText = data.latency;
    if (backpressureEl) backpressureEl.innerText = data.backpressure;
    if (freqEl) freqEl.innerText = data.freq;
    if (queueEl) queueEl.innerText = data.queue;

    const adaptersDiv = document.getElementById("inspector-adapters");
    if (adaptersDiv) {
      adaptersDiv.innerHTML = data.adapters.map(a => `<div>${a}</div>`).join("");
    }

    const sensoryFeedDiv = document.getElementById("inspector-sensory-feed");
    if (sensoryFeedDiv) {
      if (labelId === "label-perception") {
        sensoryFeedDiv.style.display = "block";
      } else {
        sensoryFeedDiv.style.display = "none";
      }
    }
  }


  updateConsoleUI() {
    if (!this.logicalTick) this.logicalTick = 0;

    // If not connected to WebSocket, update logicalTick and rates procedurally (for fallback demo)
    if (!this.isTelemetryWSConnected) {
      this.logicalTick += 1;

      const elap = this.clock.getElapsedTime();
      this.telemetryData.cpu_usage_pct = 20.0 + Math.sin(elap * 0.2) * 10.0 + Math.random() * 5.0;
      this.telemetryData.ram_usage_mb = 280.0 + Math.cos(elap * 0.1) * 20.0;

      const getProceduralVal = (current, minVal, maxVal) => Math.max(minVal, Math.min(maxVal, current + (Math.random() - 0.5) * 5));
      this.telemetryData.awareness_rate = getProceduralVal((this.telemetryData.awareness_rate || 0.85) * 100, 50, 100) / 100;
      this.telemetryData.attention_rate = getProceduralVal((this.telemetryData.attention_rate || 0.72) * 100, 50, 100) / 100;
      this.telemetryData.learning_rate = getProceduralVal((this.telemetryData.learning_rate || 0.50) * 100, 30, 100) / 100;
    }

    const tickEl = document.getElementById("console-tick");
    if (tickEl) tickEl.innerText = this.logicalTick;

    const monoEl = document.getElementById("clock-monotonic");
    if (monoEl) {
      monoEl.innerText = `${this.clock.getElapsedTime().toFixed(3)}s`;
    }

    const cpuEl = document.getElementById("system-cpu");
    if (cpuEl) {
      cpuEl.innerText = `${Math.round(this.telemetryData.cpu_usage_pct)}%`;
    }
    const ramEl = document.getElementById("system-ram");
    if (ramEl) {
      ramEl.innerText = `${Math.round(this.telemetryData.ram_usage_mb)}MB`;
    }

    const awarenessBar = document.getElementById("meter-awareness");
    if (awarenessBar) {
      const val = (this.telemetryData.awareness_rate || 0.85) * 100;
      awarenessBar.style.width = `${val.toFixed(1)}%`;
    }
    const attentionBar = document.getElementById("meter-attention");
    if (attentionBar) {
      const val = (this.telemetryData.attention_rate || 0.72) * 100;
      attentionBar.style.width = `${val.toFixed(1)}%`;
    }
    const learningBar = document.getElementById("meter-learning");
    if (learningBar) {
      const val = (this.telemetryData.learning_rate || 0.50) * 100;
      learningBar.style.width = `${val.toFixed(1)}%`;
    }

    // Dynamic Subsystem Inspector updater
    const contentPanel = document.getElementById("inspector-content");
    const nameEl = document.getElementById("inspector-name");
    if (contentPanel && contentPanel.style.display !== "none" && nameEl) {
      const activeName = nameEl.innerText.toUpperCase();

      let regionKey = null;
      const regionNamesMap = {
        "EXECUTIVE CORTEX": "executive",
        "WORKING MEMORY": "working_memory",
        "VALUE SYSTEM": "values",
        "GOAL SYSTEM": "goals",
        "IDENTITY CORE": "identity",
        "PREDICTION ENGINE": "prediction",
        "LANGUAGE SYSTEM": "language",
        "LONG-TERM MEMORY": "ltm",
        "WORLD MODEL": "world_model",
        "PERCEPTION SYSTEM": "perception",
        "ATTENTION SYSTEM": "attention",
        "LEARNING SYSTEM": "learning",
        "MOTOR SYSTEM": "device_adapters"
      };

      regionKey = regionNamesMap[activeName];

      if (regionKey && this.telemetryData.regions[regionKey]) {
        const live = this.telemetryData.regions[regionKey];
        const latencyEl = document.getElementById("inspector-latency");
        const backpressureEl = document.getElementById("inspector-backpressure");
        const freqEl = document.getElementById("inspector-freq");
        const queueEl = document.getElementById("inspector-queue");

        if (latencyEl) latencyEl.innerText = `${live.latency_ms.toFixed(1)}ms`;
        if (freqEl) freqEl.innerText = `${live.frequency_hz.toFixed(1)}Hz`;
        if (queueEl) queueEl.innerText = live.queue_backlog;

        if (backpressureEl) {
          const bp = Math.min(100, Math.max(0, live.queue_backlog * 10));
          backpressureEl.innerText = `${bp}%`;
          if (bp > 50) {
            backpressureEl.style.color = "#FF3D00";
          } else if (bp > 20) {
            backpressureEl.style.color = "#FFD600";
          } else {
            backpressureEl.style.color = "#32CD32";
          }
        }
      }
    }

    if (Math.random() > 0.995 && !this.isTelemetryWSConnected) {
      const messages = [
        "EventBus: Announce normal priority task resolved.",
        "Clock: Turn domain synchronized.",
        "Perception: Registered sensor feed calibration success.",
        "Attention: Shift weight values to active context.",
        "LTM: Cached search index keys.",
        "Compatibility: IPC serial package transmitted.",
        "Executive: Dispatch cycle stage 12 to Motor System."
      ];
      const levels = ["info", "info", "info", "warning", "info", "info", "info"];
      const rIdx = Math.floor(Math.random() * messages.length);

      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `[${hrs}:${mins}:${secs}]`;
      this.addConsoleLog(`${timeStr} ${messages[rIdx]}`, levels[rIdx]);
    }
  }

  parseTelemetryPayload(payload) {
    if (!payload) return;

    if (payload.cpu_usage_pct !== undefined) {
      this.telemetryData.cpu_usage_pct = payload.cpu_usage_pct;
    } else if (payload.system_status && payload.system_status.cpu_usage_pct !== undefined) {
      this.telemetryData.cpu_usage_pct = payload.system_status.cpu_usage_pct;
    }

    if (payload.ram_usage_mb !== undefined) {
      this.telemetryData.ram_usage_mb = payload.ram_usage_mb;
    } else if (payload.system_status && payload.system_status.ram_usage_mb !== undefined) {
      this.telemetryData.ram_usage_mb = payload.system_status.ram_usage_mb;
    }

    if (payload.awareness_rate !== undefined) {
      this.telemetryData.awareness_rate = payload.awareness_rate;
    }
    if (payload.attention_rate !== undefined) {
      this.telemetryData.attention_rate = payload.attention_rate;
    }
    if (payload.learning_rate !== undefined) {
      this.telemetryData.learning_rate = payload.learning_rate;
    }
    if (payload.tick_count !== undefined) {
      this.logicalTick = payload.tick_count;
    }

    const regions = payload.regions || payload.metrics;
    if (regions) {
      Object.keys(regions).forEach((regionName) => {
        if (this.telemetryData.regions[regionName]) {
          this.telemetryData.regions[regionName].frequency_hz = regions[regionName].frequency_hz;
          this.telemetryData.regions[regionName].latency_ms = regions[regionName].latency_ms;
          this.telemetryData.regions[regionName].queue_backlog = regions[regionName].queue_backlog || 0;
        }
      });
    }
  }

  updateHTMLRegionLabels() {
    const labels = [
      { id: "label-perception", pos: this.pPerception },
      { id: "label-attention", pos: this.pAttention },
      { id: "label-working-memory", pos: this.pWorkingMemory },
      { id: "label-long-term-memory", pos: this.pLTM },
      { id: "label-world-model", pos: this.pWorldModel },
      { id: "label-prediction", pos: this.pPrediction },
      { id: "label-goals", pos: this.pGoals },
      { id: "label-values", pos: this.pValues },
      { id: "label-executive", pos: this.pExecutive },
      { id: "label-learning", pos: this.pLearning },
      { id: "label-identity", pos: this.pIdentity },
      { id: "label-language", pos: this.pLanguage },
      { id: "label-device-adapters", pos: this.pDeviceAdapters }
    ];

    if (!this.camera) return;

    labels.forEach((label) => {
      const el = document.getElementById(label.id);
      if (el && label.pos) {
        const tempV = new THREE.Vector3().copy(label.pos);
        tempV.project(this.camera);
        const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
        const y = (tempV.y * -0.5 + 0.5) * window.innerHeight;

        el.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0)`;

        if (tempV.z > 1) {
          el.style.opacity = "0";
          el.style.display = "none";
        } else {
          el.style.opacity = "1";
          el.style.display = "flex";
        }
      }
    });
  }

  animate() {
    this.orbitControls.update();

    const time = this.clock.getElapsedTime();
    this.camera.position.x += Math.sin(time * 0.5) * 0.4;
    this.camera.position.y += Math.cos(time * 0.4) * 0.3;

    this.deltaTime += this.clock.getDelta();

    if (this.particlesSystem) {
      this.particlesSystem.update(
        this.deltaTime,
        this.camera,
        this.particlesSystem.xRay
      );
    }

    const distance = this.camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const targetOpacity = distance < 380 ? THREE.Math.mapLinear(distance, 150, 380, 0.75, 0.35) : 0.35;
    const clampedOpacity = THREE.Math.clamp(targetOpacity, 0.35, 0.75);

    const targetLineColor = new THREE.Color(0x006DFF);
    if (this.cognitiveState === "DECISION") {
      targetLineColor.setHex(0xFFD600);
    } else if (this.cognitiveState === "PREDICTING" || this.cognitiveState === "EXECUTING") {
      targetLineColor.setHex(0x00E5FF);
    } else if (this.targetStateColors) {
      targetLineColor.setHex(this.targetStateColors.lines);
    }

    this.brainLines.forEach((line) => {
      line.material.opacity = THREE.Math.lerp(line.material.opacity, clampedOpacity, 0.08);
      line.material.color.lerp(targetLineColor, 0.08);
    });

    const idlePrimary = new THREE.Color(0x0C0220);
    const idleSecondary = new THREE.Color(0x2A3D55);

    if (this.brainMeshes) {
      this.brainMeshes.forEach((mesh) => {
        const isActive = this.activeLobe && (mesh.name.includes(this.activeLobe) || this.activeLobe.includes(mesh.name));
        if (isActive && this.targetStateColors) {
          mesh.material.color.lerp(new THREE.Color(this.targetStateColors.primary), 0.08);
        } else {
          const baseColor = (mesh.userData && mesh.userData.baseColor) ? mesh.userData.baseColor : idlePrimary;
          mesh.material.color.lerp(baseColor, 0.08);
        }
      });
    }

    if (this.brainWireframes) {
      this.brainWireframes.forEach((wire) => {
        const isActive = this.activeLobe && (wire.name.includes(this.activeLobe) || this.activeLobe.includes(wire.name));
        if (isActive && this.targetStateColors) {
          wire.material.color.lerp(new THREE.Color(this.targetStateColors.secondary), 0.08);
        } else {
          const baseColor = (wire.userData && wire.userData.baseColor) ? wire.userData.baseColor : idleSecondary;
          wire.material.color.lerp(baseColor, 0.08);
        }
      });
    }

    if (this.innerCoreGroup) {
      const scale = 1.0 + Math.sin(time * 2.2) * 0.12;
      this.innerCoreGroup.scale.set(scale, scale, scale);
    }

    if (this.innerCoreSpheres && this.innerCoreSpheres.length > 0 && this.targetStateColors) {
      this.innerCoreSpheres[0].material.color.lerp(new THREE.Color(this.targetStateColors.primary), 0.08);
      this.innerCoreSpheres[1].material.color.lerp(new THREE.Color(this.targetStateColors.secondary), 0.08);
      this.innerCoreSpheres[2].material.color.lerp(new THREE.Color(this.targetStateColors.secondary), 0.08);
    }

    if (this.raycaster && this.brainMeshes.length > 0 && this.brainWireframes.length > 0) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.brainMeshes);

      this.brainWireframes.forEach((wire) => {
        const isActive = this.activeLobe && (wire.name.includes(this.activeLobe) || this.activeLobe.includes(wire.name));
        if (!isActive) {
          wire.material.color.lerp(new THREE.Color(0x2A3D55), 0.15);
        }
      });

      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object;
        const { name } = hoveredMesh;
        this.brainWireframes.forEach((wire) => {
          const isActive = this.activeLobe && (wire.name.includes(this.activeLobe) || this.activeLobe.includes(wire.name));
          if (!isActive && (wire.name.includes(name) || name.includes(wire.name))) {
            wire.material.color.lerp(new THREE.Color(0x00E5FF), 0.3);
          }
        });
      }
    }

    const breathingScale = 1.0 + Math.sin(time * 2.2) * 0.03;
    if (this.brainMeshes) {
      this.brainMeshes.forEach((mesh) => {
        mesh.scale.set(breathingScale, breathingScale, breathingScale);
      });
    }
    if (this.brainWireframes) {
      this.brainWireframes.forEach((wire) => {
        wire.scale.set(breathingScale, breathingScale, breathingScale);
      });
    }

    if (this.neuralPackets && this.neuralVeinPaths) {
      for (let i = 0; i < this.neuralPackets.length; i += 1) {
        let t = this.neuralVeinProgress[i] + 0.004;
        if (t > 1.0) t = 0.0;
        this.neuralVeinProgress[i] = t;
        const pos = this.neuralVeinPaths[i].getPointAt(t);
        this.neuralPackets[i].position.copy(pos);
      }
    }

    if (this.nodeSpheres) {
      this.nodeSpheres.forEach((sphere) => {
        const { ring } = sphere.userData;
        if (ring && this.camera) {
          ring.lookAt(this.camera.position);
        }
        const pulse = 1.0 + Math.sin(time * 3.5 + sphere.position.x) * 0.12;
        sphere.scale.set(pulse, pulse, pulse);
        if (ring) {
          ring.scale.set(pulse, pulse, pulse);
        }
      });
    }

    this.updateConsoleUI();
    this.updateHTMLRegionLabels();
    this.stats.update();
    requestAnimationFrame(this.animate.bind(this));

    this.camera.updateProjectionMatrix();

    if (this.isMobile) {
      this.renderer.render(this.a_scene, this.a_camera);
    } else {
      this.composer.render();
    }

    if (this.isRecording) {
      if (this.frame > 10) {
        this.socket.emit("render-frame", {
          frame: (this.frameName += 1),
          file: document.querySelector("canvas").toDataURL(),
        });
      }
      this.frame += 1;
    }
  }

  static getRandomPointOnSphere(r) {
    const u = THREE.Math.randFloat(0, 1);
    const v = THREE.Math.randFloat(0, 1);
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = r * Math.sin(theta) * Math.sin(phi);
    const y = r * Math.cos(theta) * Math.sin(phi);
    const z = r * Math.cos(phi);
    return { x, y, z };
  }
}

export default MainBrain;
