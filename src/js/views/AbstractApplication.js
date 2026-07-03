import * as THREE from "three";
import io from "socket.io-client";
import "three/examples/js/controls/OrbitControls";
import "three/examples/js/modifiers/BufferSubdivisionModifier";
import Stats from "three/examples/js/libs/stats.min";
import {
  EffectComposer,
  RenderPass,
  BloomPass,
  MaskPass,
} from "postprocessing";

class AbstractApplication {
  constructor() {
    this.a_camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    this.a_camera.position.z = 1000;

    this.a_scene = new THREE.Scene();
    this.a_scene.background = new THREE.Color("#020617");

    this.a_blurScene = new THREE.Scene();
    this.a_bloomScene = new THREE.Scene();

    this.a_scene.fog = new THREE.Fog(0x020617, 300, 1300);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.isMobile = isMobile;

    this.a_renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      preserveDrawingBuffer: false,
      logarithmicDepthBuffer: true,
    });
    this.a_renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.2) : Math.min(window.devicePixelRatio, 2.0));
    this.a_renderer.setSize(window.innerWidth, window.innerHeight);
    this.a_renderer.sortObjects = false;
    this.a_renderer.setClearColor(0x00000, 0.0);

    this.a_renderer.shadowMap.enabled = true;
    this.a_renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.a_renderer.gammaInput = true;
    this.a_renderer.gammaOutput = true;
    this.a_renderer.shadowDepthMaterialSide = THREE.BackSide;

    this.composer = new EffectComposer(this.a_renderer, {
      stencilBuffer: true,
      depthTexture: true,
    });

    // PASSES
    this.renderPass = new RenderPass(this.scene, this.camera);
    //this.renderPass.renderToScreen = true;
    this.composer.addPass(this.renderPass);


    this.bloomPass = new BloomPass({
      resolutionScale: 0.5,
      resolution: 2.0,
      intensity: 0.45,
      distinction: 9.0,
      blend: true,
    });

    this.bloomPass.renderToScreen = true;
    this.composer.addPass(this.bloomPass);

    this.blurMask = new MaskPass(this.blurScene, this.camera);
    this.renderPass2 = new RenderPass(this.blurScene, this.camera);

    document.body.appendChild(this.a_renderer.domElement);

    this.stats = AbstractApplication.initStats(document.body);

    this.orbitControls = new THREE.OrbitControls(
      this.camera,
      this.a_renderer.domElement
    );
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05; // High-quality smooth damping
    this.orbitControls.minPolarAngle = Math.PI / 6; // Limit vertical rotation to 30 degrees
    this.orbitControls.maxPolarAngle = Math.PI * 5 / 6; // Limit vertical rotation to 150 degrees
    this.orbitControls.enableZoom = true;
    this.orbitControls.zoomSpeed = 0.1;
    this.orbitControls.panSpeed = 0.1;
    this.orbitControls.minDistance = 50;
    this.orbitControls.maxDistance = 2500;
    this.orbitControls.autoRotate = false;
    this.orbitControls.autoRotateSpeed = 1.0;
    this.orbitControls.rotateSpeed = 0.1;
    this.orbitControls.screenSpacePanning = true;

    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    window.addEventListener("mousemove", this.onMouseMove.bind(this), false);
  }

  get renderer() {
    return this.a_renderer;
  }

  get camera() {
    return this.a_camera;
  }

  get scene() {
    return this.a_scene;
  }

  get blurScene() {
    return this.a_blurScene;
  }
  get bloomScene() {
    return this.a_bloomScene;
  }

  static initStats(render) {
    const stats = new Stats();
    stats.setMode(0);
    stats.domElement.style.position = "absolute";
    stats.domElement.style.left = "0px";
    stats.domElement.style.tip = "0px";
    stats.domElement.style.display = "none"; // Hide stats completely
    render.appendChild(stats.domElement);
    return stats;
  }

  static onMouseMove(e) {}
  onWindowResize() {
    this.a_camera.aspect = window.innerWidth / window.innerHeight;
    this.a_camera.updateProjectionMatrix();

    this.a_renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate(timestamp) {
    requestAnimationFrame(this.animate.bind(this));
    this.a_renderer.render(this.a_scene, this.a_camera);
  }
}

export default AbstractApplication;
