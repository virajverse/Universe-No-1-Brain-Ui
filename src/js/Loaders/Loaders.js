import * as THREE from 'three';
import 'three/examples/js/loaders/OBJLoader';

class Loaders {
    constructor(startAnimation, onModelLoaded) {
        this.BRAIN_MODEL = null;
        this.brainXRayLight = {};
        this.assets = new Map();
        this.loadingManager = new THREE.LoadingManager();
        this.startAnimation = startAnimation;
        this.onModelLoaded = onModelLoaded;
        this.loadingManager.onLoad = this.handlerLoad.bind(this);
        this.loadingManager.onProgress = this.handlerProgress;
        this.loadingManager.onError = this.handlerError;
        this.loadingManager.onStart = this.handlerStart;
        this.loadBrainTextures();
        this.loadTextures();
        this.loadOBJsAsync();
    }

    static handlerStart() {
        console.log('Starting');
    }
    static handlerProgress(url, itemsLoaded, itemsTotal) {
        console.log(`Loading file: ${url}.\nLoaded ${itemsLoaded} of ${itemsTotal} files.`);
    }
    handlerLoad() {
        console.log('loading Complete!');
        this.startAnimation();
    }
    static handlerError(url) {
        console.log(`There was an error loading ${url}`);
    }

    loadOBJsAsync() {
        const loader = new THREE.OBJLoader(this.loadingManager);
        loader.load('static/models/BrainUVs.obj', (model) => {
            this.BRAIN_MODEL = model;
            if (this.onModelLoaded) {
                this.onModelLoaded(model);
            }
        });
    }

    loadTextures() {
        const loader = new THREE.TextureLoader(this.loadingManager);
        loader.load('static/textures/spark1.png', (t) => {
            this.spark = t;
        });
    }

    loadBrainTextures() {
        const loader = new THREE.TextureLoader(this.loadingManager);
        loader.load('static/textures/brainXRayLight.png', (t) => {
            this.brainXRayLight = t;
        });
    }
}

export default Loaders;
