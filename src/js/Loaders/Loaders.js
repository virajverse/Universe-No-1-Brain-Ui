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
        this.loadingManager.onProgress = this.handlerProgress.bind(this);
        this.loadingManager.onError = this.handlerError.bind(this);
        this.loadingManager.onStart = this.handlerStart.bind(this);
        this.loadBrainTextures();
        this.loadTextures();
        this.loadOBJsAsync();
    }

    addBootLog(text, isError = false) {
        const term = document.getElementById('boot-terminal-lines');
        if (term) {
            const line = document.createElement('div');
            line.style.color = isError ? '#FF3D00' : '#85F7FF';
            line.style.margin = '2px 0';
            line.style.fontFamily = 'monospace';
            line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
            term.appendChild(line);
            term.scrollTop = term.scrollHeight;
        }
    }

    handlerStart() {
        this.addBootLog('INITIATING ASSETS SECURE FETCH...');
        const statusEl = document.getElementById('boot-status');
        if (statusEl) statusEl.textContent = 'FETCHING ASSETS...';
    }

    handlerProgress(url, itemsLoaded, itemsTotal) {
        const pct = Math.round((itemsLoaded / itemsTotal) * 100);
        const bar = document.getElementById('boot-progress-bar');
        const percentEl = document.getElementById('boot-percent');
        const statusEl = document.getElementById('boot-status');

        if (bar) bar.style.width = `${pct}%`;
        if (percentEl) percentEl.textContent = `${pct}%`;

        const fileName = url.substring(url.lastIndexOf('/') + 1);
        if (statusEl) statusEl.textContent = `FETCHING: ${fileName}`;

        this.addBootLog(`LOADED: ${fileName} (${itemsLoaded}/${itemsTotal})`);
    }

    handlerLoad() {
        this.addBootLog('ALL SYSTEM ASSETS SECURELY CACHED.');
        const bar = document.getElementById('boot-progress-bar');
        const percentEl = document.getElementById('boot-percent');
        const statusEl = document.getElementById('boot-status');

        if (bar) bar.style.width = '100%';
        if (percentEl) percentEl.textContent = '100%';
        if (statusEl) statusEl.textContent = 'FETCH COMPLETE.';

        setTimeout(() => {
            this.startAnimation();
        }, 800);
    }

    handlerError(url) {
        const fileName = url.substring(url.lastIndexOf('/') + 1);
        this.addBootLog(`ERROR LOADING: ${fileName}`, true);
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
