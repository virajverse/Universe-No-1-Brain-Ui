/* eslint-disable no-param-reassign */
import * as THREE from "three";
import { Power4, TweenMax } from "gsap";
import "three/examples/js/BufferGeometryUtils";
import AbstractApplication from "./views/AbstractApplication";
import Loaders from "./Loaders/Loaders";
import BubblesAnimation from "./services/bubblesAnimation";
import ThinkingAnimation from "./services/thinkingAnimation";
import GUI from "./services/gui";
import Font from "./services/font";
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
    this.loaders = new Loaders(this.runAnimation.bind(this));
    this.memories = Memories;
    this.brainLines = [];
    this.brainMeshes = [];
    this.brainWireframes = [];
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
    this.brainBufferGeometries = [];
    this.brainLines = [];
    this.brainMeshes = [];

    // Defensive check to prevent crash during hot-reloads
    if (!this.loaders || !this.loaders.BRAIN_MODEL || typeof this.loaders.BRAIN_MODEL.traverse !== "function") {
      console.warn("BRAIN_MODEL is not fully loaded or initialized yet.");
      return;
    }

    const linesToAdd = [];
    const meshesToAdd = [];

    this.loaders.BRAIN_MODEL.traverse((child) => {
      if (child instanceof THREE.LineSegments) {
        this.memories.lines = {
          ...this.memories.lines,
          ...MainBrain.addLinesPath(child, this.memories),
        };
        // Instantiate custom transparent line basic material for zoom transitions
        child.material = new THREE.LineBasicMaterial({
          color: 0xBD00FF, // Starts with Cosmic Purple
          transparent: true,
          opacity: 0.35, // Set baseline opacity to fill particle gaps
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

      // Layer 2: Translucent Deep Space Purple Brain Surface / Outer Skin
      child.material = new THREE.MeshBasicMaterial({
        color: 0x13002E, // Deep space purple (removed white)
        transparent: true,
        opacity: 0.0, // Start invisible; fades to 0.04 after morph completes
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      this.brainMeshes.push(child);
      meshesToAdd.push(child);

      // Layer 3: Folds Wireframe Network Overlay
      const wireframeGeom = new THREE.WireframeGeometry(child.geometry);
      const wireframeMat = new THREE.LineBasicMaterial({
        color: 0x2A3D55, // Faint blue-grey in idle
        transparent: true,
        opacity: 0.0, // Start invisible; fades to 0.35 after morph completes
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const wireframe = new THREE.LineSegments(wireframeGeom, wireframeMat);
      wireframe.name = child.name;
      this.brainWireframes.push(wireframe);
      meshesToAdd.push(wireframe);

      this.brainBufferGeometries.push(child.geometry);

      this.memories = {
        ...this.memories,
        ...MainBrain.storeBrainVertices(child, this.memories),
      };
    });

    // Safely add children to the scene after traversal is complete
    linesToAdd.forEach(line => this.scene.add(line));
    meshesToAdd.forEach(mesh => this.scene.add(mesh));

    // Layer 6: Procedural breathing Inner Core spheres group
    this.innerCoreGroup = new THREE.Group();
    this.innerCoreSpheres = [];

    const coreColors = [0x7C3AED, 0xA855F7, 0x00E5FF];
    const coreSizes = [12, 7, 3];

    for (let k = 0; k < 3; k += 1) {
      const geom = new THREE.SphereGeometry(coreSizes[k], 32, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: coreColors[k],
        transparent: true,
        opacity: 0.0, // Start invisible, fade in with fadeSolidBrain()
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const sphere = new THREE.Mesh(geom, mat);
      this.innerCoreGroup.add(sphere);
      this.innerCoreSpheres.push(sphere);
    }
    this.scene.add(this.innerCoreGroup);

    this.endPointsCollections = THREE.BufferGeometryUtils.mergeBufferGeometries(
      this.brainBufferGeometries
    );
  }

  startIntro() {
    const progress = { p: 1000 };
    TweenMax.fromTo(
      progress,
      6.5,
      { p: 1000 },
      {
        p: 380,
        ease: Power4.easeInOut,
        onUpdate: () => {
          this.camera.position.z = progress.p;
        },
        onStart: () => {
          if (this.particlesSystem && typeof this.particlesSystem.transform === "function") {
            this.particlesSystem.transform(true);
          }
        },
        onComplete: () => {
          //hide xray
          if (this.particlesSystem && this.particlesSystem.xRay) {
            this.particlesSystem.xRay.material.uniforms.c.value = 1.0;
          }
          this.startAutoDemo();
        }
      }
    );
  }

  startAutoDemo() {
    let memoryCount = 1;
    if (this.particlesSystem && this.particlesSystem.xRay) {
      this.scene.add(this.particlesSystem.xRay);
    }
    let memoryTimer;
    const me = this;
    setTimeout(() => {
      //enable xRay Animation
      if (this.particlesSystem && typeof this.particlesSystem.isXRayActive === "function") {
        this.particlesSystem.isXRayActive(true);
        this.setCognitiveState("RECOVERY");
      }
      setTimeout(() => {
        //remove animation
        this.particlesSystem.isXRayActive(false);
        //Enable Memories
        memoryTimer = setInterval(() => {
          if (memoryCount < 5) {
            this.bubblesAnimation.updateSubSystem(memoryCount);

            // Sync dashboard states with active memory subsystems
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
            this.bubblesAnimation.updateSubSystem(0);
            this.setCognitiveState("THINKING");
            clearInterval(memoryTimer);

            // After the final transition completes, safely return to IDLE
            setTimeout(() => {
              this.setCognitiveState("IDLE");
            }, 5000);
          }
        }, 9000);
      }, 4000);
    }, 2000);
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
    this.gui = new GUI(this);
    this.addBrain();
    this.addParticlesSystem();
    this.font = new Font(this.loaders, this.scene);
    this.bubblesAnimation = new BubblesAnimation(this);
    this.bubblesAnimation.initAnimation();

    this.thinkingAnimation = new ThinkingAnimation(this);
    this.thinkingAnimation.initAnimation();

    // Set Background
    //this.scene.background = this.loaders.assets.get('sky');

    // Initialize default state
    this.setCognitiveState("IDLE");

    // Setup professional HTML control panel triggers
    const stateButtons = document.querySelectorAll(".state-btn");
    const activeDot = document.getElementById("active-state-dot");
    const activeLabel = document.getElementById("active-state-label");

    const stateColorsHex = {
      THINKING: "#A855F7",
      PREDICTING: "#00E5FF",
      LEARNING: "#00E676",
      DECISION: "#FFD600",
      EXECUTING: "#FF9800",
      ERROR: "#FF3D00",
      SLEEP: "#3B82F6",
      RECOVERY: "#93C5FD",
      IDLE: "#00F2FE"
    };

    stateButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const state = btn.getAttribute("data-state");

        // Update model engine
        this.setCognitiveState(state);

        // Update active class on buttons
        stateButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Update dashboard status bar
        if (activeLabel) {
          activeLabel.textContent = state;
        }
        if (activeDot) {
          activeDot.style.backgroundColor = stateColorsHex[state];
          activeDot.style.boxShadow = `0 0 12px ${stateColorsHex[state]}`;
        }
      });
    });

    if (activeDot) {
      activeDot.classList.add("pulse");
    }

    // Dynamic Obfuscated Signature Injection (Prevents text-based AI editor removal)
    try {
      const signatureCodes = [
        169, 32, 50, 48, 50, 54, 32, 86, 105, 114, 97, 106, 118,
        101, 114, 115, 101, 32, 124, 32, 84, 97, 108, 105, 121,
        111, 32, 84, 101, 99, 104, 110, 111, 108, 111, 103, 105,
        101, 115
      ];
      const signature = String.fromCharCode(...signatureCodes);

      // Inject to Dashboard footer
      const dashboard = document.getElementById("cognitive-dashboard");
      if (dashboard) {
        const footer = document.createElement("div");
        footer.className = "dashboard-footer";
        footer.textContent = signature;
        dashboard.appendChild(footer);
      }

      // Inject glowing credit to browser console on load
      console.log(
        `%c ${signature} | All Rights Reserved.`,
        "color: #00F2FE; font-weight: bold; font-size: 13px; font-family: sans-serif;"
      );
    } catch (e) {
      // Fail silently
    }

    this.startIntro();
    this.animate();
  }

  animate(timestamp) {
    this.orbitControls.update();
    this.orbitControls.autoRotateSpeed = this.gui.controls.rotationSpeed;

    // Camera handheld noise-like drift (applied subtly after update)
    const time = this.clock.getElapsedTime();
    this.camera.position.x += Math.sin(time * 0.5) * 0.4;
    this.camera.position.y += Math.cos(time * 0.4) * 0.3;

    this.deltaTime += this.clock.getDelta();

    this.particlesSystem.update(
      this.deltaTime,
      this.camera,
      this.particlesSystem.xRay
    );
    this.bubblesAnimation.update(this.camera, this.deltaTime);
    this.thinkingAnimation.update(this.camera, this.deltaTime);

    // Zoom reaction: calculate camera distance to origin and interpolate line segments
    const distance = this.camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const targetOpacity = distance < 380 ? THREE.Math.mapLinear(distance, 150, 380, 0.75, 0.35) : 0.35;
    const clampedOpacity = THREE.Math.clamp(targetOpacity, 0.35, 0.75);

    // Layer 5: Determine target synapse line color based on state
    const targetLineColor = new THREE.Color(0x006DFF); // Normal (Idle)
    if (this.cognitiveState === "DECISION") {
      targetLineColor.setHex(0xFFD600); // Decision Gold
    } else if (this.cognitiveState === "PREDICTING" || this.cognitiveState === "EXECUTING") {
      targetLineColor.setHex(0x00E5FF); // Pulse Cyan
    } else if (this.targetStateColors) {
      targetLineColor.setHex(this.targetStateColors.lines);
    }

    this.brainLines.forEach((line) => {
      line.material.opacity = THREE.Math.lerp(line.material.opacity, clampedOpacity, 0.08);
      line.material.color.lerp(targetLineColor, 0.08);
    });

    // Layer 2: Dynamic Brain Surface color matching the state
    if (this.brainMeshes && this.targetStateColors) {
      const surfaceColor = new THREE.Color(this.targetStateColors.primary);
      this.brainMeshes.forEach((mesh) => {
        mesh.material.color.lerp(surfaceColor, 0.08);
      });
    }

    // Layer 6: Dynamic Inner Core color matching the state
    if (this.innerCoreSpheres && this.innerCoreSpheres.length > 0 && this.targetStateColors) {
      this.innerCoreSpheres[0].material.color.lerp(new THREE.Color(this.targetStateColors.primary), 0.08); // Outer
      this.innerCoreSpheres[1].material.color.lerp(new THREE.Color(this.targetStateColors.secondary), 0.08); // Middle
      this.innerCoreSpheres[2].material.color.lerp(new THREE.Color(this.targetStateColors.secondary), 0.08); // Center
    }

    // Raycasting for hover on solid brain meshes to highlight Layer 3 Wireframe
    if (this.raycaster && this.brainMeshes.length > 0 && this.brainWireframes.length > 0) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.brainMeshes);

      // Reset all wireframe colors first to baseline (#2A3D55)
      this.brainWireframes.forEach((wire) => {
        wire.material.color.lerp(new THREE.Color(0x2A3D55), 0.15);
      });

      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object;
        const { name } = hoveredMesh; // e.g. 'process', 'semantic'
        // Highlight only the matching region wireframe
        this.brainWireframes.forEach((wire) => {
          if (wire.name.includes(name) || name.includes(wire.name)) {
            // Change wireframe color to Cyan #00E5FF on hover
            wire.material.color.lerp(new THREE.Color(0x00E5FF), 0.3);
          }
        });
      }
    }

    // Layer 6: Inner Core & Outer Mesh breathing scale animation
    const breathingScale = 1.0 + Math.sin(this.clock.getElapsedTime() * 2.2) * 0.03;
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
    if (this.innerCoreGroup) {
      const scale = 1.0 + Math.sin(this.clock.getElapsedTime() * 2.2) * 0.12;
      this.innerCoreGroup.scale.set(scale, scale, scale);
    }

    this.stats.update();
    requestAnimationFrame(this.animate.bind(this));

    //this.renderer.render(this.a_scene, this.a_camera);

    this.font.facingToCamera(this.camera);
    this.camera.updateProjectionMatrix();

    this.thinkingAnimation.flashing.geometry.verticesNeedUpdate = true;
    this.thinkingAnimation.flashing.geometry.attributes.position.needsUpdate = true;

    // composer or direct renderer (for mobile performance optimization)
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
  onMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
  onCanvasClick(event) {
    // Prevent raycasting if user is clicking on UI buttons or dashboard panel
    if (event.target.tagName === "BUTTON" || event.target.closest("#cognitive-dashboard")) {
      return;
    }
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
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

    // 1. Clean up existing 3D text label sprites
    if (this.font) {
      this.font.removeText(this.scene);
    }

    // 2. Identify target lobe and 3D label texts for this state
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

    // 3. Dynamic Camera Zoom, dimming, and text placement
    if (targetLobe) {
      // Find the mesh that belongs to this lobe
      const lobeMesh = this.brainMeshes.find(mesh => mesh.name.includes(targetLobe) || targetLobe.includes(mesh.name));
      if (lobeMesh) {
        lobeMesh.geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        lobeMesh.geometry.boundingBox.getCenter(center);

        // Translate local bounding center to world coordinates
        lobeMesh.updateMatrixWorld();
        center.applyMatrix4(lobeMesh.matrixWorld);

        // Zoom camera in towards the center of the targeted region
        TweenMax.to(this.camera.position, 2.5, {
          x: center.x * 0.9,
          y: center.y * 0.9,
          z: center.z + 160.0, // offset Z so the camera looks directly at the lobe
          ease: Power4.easeInOut,
          onUpdate: () => {
            if (this.orbitControls) {
              this.orbitControls.target.copy(center);
            }
          }
        });

        // Dim non-active brain surface meshes
        this.brainMeshes.forEach((mesh) => {
          const isActive = mesh.name.includes(targetLobe) || targetLobe.includes(mesh.name);
          TweenMax.to(mesh.material, 1.5, {
            opacity: isActive ? 0.08 : 0.01,
            ease: Power4.easeOut
          });
        });

        // Increase opacity of active wireframe, dim all others
        this.brainWireframes.forEach((wire) => {
          const isActive = wire.name.includes(targetLobe) || targetLobe.includes(wire.name);
          TweenMax.to(wire.material, 1.5, {
            opacity: isActive ? 0.85 : 0.03,
            ease: Power4.easeOut
          });
        });

        // Spawn 3D text sprites floating at vertical offsets from the lobe center
        if (this.font) {
          labelTexts.forEach((text, index) => {
            const textPos = new THREE.Vector3(
              center.x,
              center.y + 25.0 - (index * 12.0),
              center.z + 10.0
            );
            this.font.makeTextSprite(text, this.scene, textPos, 2.8);
          });
        }
      }
    } else {
      // Return camera to default overview zoom
      TweenMax.to(this.camera.position, 2.5, {
        x: 0,
        y: 0,
        z: 380.0,
        ease: Power4.easeInOut,
        onUpdate: () => {
          if (this.orbitControls) {
            this.orbitControls.target.set(0, 0, 0);
          }
        }
      });

      // Restore standard baseline opacities
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

    // State Color mapping definitions for rendering states
    const stateColors = {
      THINKING: {
        primary: 0x7C3AED,
        secondary: 0xA855F7,
        signal: 0xA855F7,
        core: 0x7C3AED,
        lines: 0x7C3AED,
        autoRotateSpeed: 1.2
      },
      PREDICTING: {
        primary: 0x00E5FF,
        secondary: 0x4DEFFF,
        signal: 0x00E5FF,
        core: 0x00E5FF,
        lines: 0x00E5FF,
        autoRotateSpeed: 1.5
      },
      LEARNING: {
        primary: 0x00E676,
        secondary: 0x7CFF9E,
        signal: 0x00E676,
        core: 0x00E676,
        lines: 0x00E676,
        autoRotateSpeed: 1.8
      },
      DECISION: {
        primary: 0xFFD600,
        secondary: 0xFFC107,
        signal: 0xFFD600,
        core: 0xFFD600,
        lines: 0xFFD600,
        autoRotateSpeed: 2.0
      },
      EXECUTING: {
        primary: 0xFF9800,
        secondary: 0xFFB74D,
        signal: 0xFF9800,
        core: 0xFF9800,
        lines: 0xFF9800,
        autoRotateSpeed: 2.5
      },
      ERROR: {
        primary: 0xFF3D00,
        secondary: 0xFF8A80,
        signal: 0xFF3D00,
        core: 0xFF3D00,
        lines: 0xFF3D00,
        autoRotateSpeed: 4.0
      },
      SLEEP: {
        primary: 0x1E3A8A,
        secondary: 0x3B82F6,
        signal: 0x1E3A8A,
        core: 0x1E3A8A,
        lines: 0x1E3A8A,
        autoRotateSpeed: 0.1
      },
      RECOVERY: {
        primary: 0x93C5FD,
        secondary: 0x00E5FF,
        signal: 0x93C5FD,
        core: 0x00E5FF,
        lines: 0x00E5FF,
        autoRotateSpeed: 0.8
      },
      IDLE: {
        primary: 0x0C0220,
        secondary: 0x1A083C,
        signal: 0x00F2FE,
        core: 0x7C3AED,
        lines: 0x006DFF,
        autoRotateSpeed: 0.5
      }
    };

    const cfg = stateColors[state] || stateColors.IDLE;
    this.targetStateColors = cfg;

    // Update uStateColor uniform for electrical signals in bubblesAnimation
    if (this.bubblesAnimation && this.bubblesAnimation.bubbles && this.bubblesAnimation.bubbles.material.uniforms.uStateColor) {
      this.bubblesAnimation.bubbles.material.uniforms.uStateColor.value.setHex(cfg.signal);
    }

    // Set rotation speed
    this.orbitControls.autoRotateSpeed = cfg.autoRotateSpeed;
    if (this.gui && this.gui.controls) {
      this.gui.controls.rotationSpeed = cfg.autoRotateSpeed;
    }

    // Layer 10: Set dynamic bloom intensity based on active state
    if (this.bloomPass) {
      if (state === "SLEEP") {
        this.bloomPass.intensity = 0.08;
      } else if (state === "ERROR") {
        this.bloomPass.intensity = 0.90;
      } else {
        this.bloomPass.intensity = 0.45;
      }
    }

    // Synchronize HTML UI dashboard panel if updated from dat.GUI or code
    const stateButtons = document.querySelectorAll(".state-btn");
    const activeDot = document.getElementById("active-state-dot");
    const activeLabel = document.getElementById("active-state-label");

    const stateColorsHex = {
      THINKING: "#A855F7",
      PREDICTING: "#00E5FF",
      LEARNING: "#00E676",
      DECISION: "#FFD600",
      EXECUTING: "#FF9800",
      ERROR: "#FF3D00",
      SLEEP: "#3B82F6",
      RECOVERY: "#93C5FD",
      IDLE: "#00F2FE"
    };

    if (stateButtons.length > 0) {
      stateButtons.forEach((btn) => {
        const btnState = btn.getAttribute("data-state");
        if (btnState === state) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }

    if (activeLabel) {
      activeLabel.textContent = state;
    }
    if (activeDot) {
      activeDot.style.backgroundColor = stateColorsHex[state];
      activeDot.style.boxShadow = `0 0 12px ${stateColorsHex[state]}`;
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
    return {
      x,
      y,
      z,
    };
  }
}

export default MainBrain;
