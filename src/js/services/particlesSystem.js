/* eslint-disable no-param-reassign, no-plusplus, space-infix-ops, no-trailing-spaces */
import * as BAS from 'three-bas';
import * as THREE from 'three';
import { Power1, TweenMax } from 'gsap';
import Chuncks from './chunks';
import xRayVertex from '../shaders/xRay.vert';
import xRayFrag from '../shaders/xRay.frag';


class ParticleSystem {
    constructor(mainBrain, brainParticles, memories) {
        this.chuncks = new Chuncks();
        this.brainParticles = brainParticles;
        this.memories = memories;
        this.mainBrain = mainBrain;
        this.particlesStartColor = new THREE.Color(0xffffff);
        this.particlesColor = new THREE.Color(0xffffff);
        const { xRayEffect, systemPoints } = this.init();
        this.particles = systemPoints;
        this.xRay = xRayEffect;
    }

    static getLoadingPoints() {
        const geometry = new THREE.RingBufferGeometry(100, 40, 150, 150, 20);
        return geometry.attributes.position.array;
    }

    init() {
        const duration = 1.0;
        const maxPointDelay = 0.3;

        const originalPoints = this.brainParticles.attributes.position.array;
        const originalCount = originalPoints.length / 3;
        const multiplier = 1; // 1x particle density multiplier for subtle idle atmosphere
        const count = originalCount * multiplier;
        const brainPoints = new Float32Array(count * 3);

        for (let i = 0; i < originalCount; i++) {
            const x = originalPoints[i * 3 + 0];
            const y = originalPoints[i * 3 + 1];
            const z = originalPoints[i * 3 + 2];
            for (let j = 0; j < multiplier; j++) {
                const idx = (i * multiplier + j) * 3;
                if (j === 0) {
                    brainPoints[idx + 0] = x;
                    brainPoints[idx + 1] = y;
                    brainPoints[idx + 2] = z;
                } else {
                    // Spread coordinates extremely tightly to make the particles blend into a solid surface
                    brainPoints[idx + 0] = x + THREE.Math.randFloatSpread(0.6);
                    brainPoints[idx + 1] = y + THREE.Math.randFloatSpread(0.6);
                    brainPoints[idx + 2] = z + THREE.Math.randFloatSpread(0.6);
                }
            }
        }

        const me = this;
        const geometry = new BAS.PointBufferGeometry(count);

        const loadingCircle = ParticleSystem.getLoadingPoints();
        geometry.createAttribute('aStartLoading', 3, (data, index, num) => {
            const startVec3 = new THREE.Vector3();
            // Modulo ensures that extra particles wrap around the loading circle instead of falling back to 0,0
            const circleIdx = (index * 3) % loadingCircle.length;
            startVec3.x = loadingCircle[circleIdx + 0] || 0.0;
            startVec3.y = loadingCircle[circleIdx + 1] || 0.0;
            startVec3.z = THREE.Math.randFloat(-80.0, 1500.0);
            startVec3.toArray(data);
        });

        const color = new THREE.Color();
        const color70 = new THREE.Color(0x8BE9FD); // Cyan-blue (70%)
        const color25 = new THREE.Color(0x00C2FF); // Saturated Cyan (25%) - replaced D8FFFF to reduce white glow
        const color5 = new THREE.Color(0xFF007F); // Neon Magenta sparkle (5%) - replaced white completely

        geometry.createAttribute('aStartColor', 3, (data, index) => {
            const modVal = index % 100;
            if (modVal < 5) {
                color.copy(color5);
            } else if (modVal < 30) {
                color.copy(color25);
            } else {
                color.copy(color70);
            }
            color.toArray(data);
        });

        geometry.createAttribute('scale', 1, (data) => {
            data[0] = THREE.Math.randFloat(200.0, 400.0);
        });

        geometry.createAttribute('aEndColor', 3, (data, index) => {
            const modVal = index % 100;
            if (modVal < 5) {
                color.copy(color5);
            } else if (modVal < 30) {
                color.copy(color25);
            } else {
                color.copy(color70);
            }
            color.toArray(data);
        });

        geometry.createAttribute('aEndPos', 3, (data, index) => {
            const startVec3 = new THREE.Vector3();
            startVec3.x = brainPoints[(index * 3) + 0];
            startVec3.y = brainPoints[(index * 3) + 1];
            startVec3.z = brainPoints[(index * 3) + 2];
            startVec3.toArray(data);
        });

        this.totalDuration = duration + maxPointDelay;

        geometry.createAttribute('aDelayDuration', 3, (data) => {
            data[0] = Math.random() * maxPointDelay;
            data[1] = duration;
        });


        const geometry2 = new BAS.PointBufferGeometry(count);

        geometry2.createAttribute('position', 3, (data, index) => {
            const startVec3 = new THREE.Vector3();
            startVec3.x = brainPoints[(index * 3) + 0];
            startVec3.y = brainPoints[(index * 3) + 1];
            startVec3.z = brainPoints[(index * 3) + 2];
            startVec3.toArray(data);
        });


        const material = new BAS.PointsAnimationMaterial({
            // transparent: true,
            // blending: THREE.AdditiveBlending,
            vertexColors: THREE.VertexColors,
            depthWrite: false,

            blending: THREE.AdditiveBlending,
            depthTest: true,
            transparent: true,
            uniforms: {
                uTime: { type: 'f', value: 0 },
                uProgress: { type: 'float', value: 0.0 },
                uAngle: { type: 'f', value: 1.0 },
                uPointSizeEffect: { type: 'f', value: 0.1 },
                uColor: { value: new THREE.Color(0xffffff) },
            },
            defines: {
                // USE_SIZEATTENUATION: false, // Change size of the particle depending of the camera
            },
            uniformValues: {
                size: 2.8,
                scale: 400,
            },
            vertexFunctions: [
                BAS.ShaderChunk.ease_expo_in_out,
                BAS.ShaderChunk.quaternion_rotation,
                this.chuncks.rotate,
                this.chuncks.random,
                this.chuncks.noise,
            ],

            vertexParameters: [
                'uniform float uTime;',
                'uniform float uPointSizeEffect;',
                'uniform float uProgress;',
                'uniform float uAngle;',
                'attribute vec2 aDelayDuration;',
                'attribute vec3 aStartLoading;',
                'attribute vec3 aStartPos;',
                'attribute vec3 aEndPos;',
                'attribute vec3 aStartColor;',
                'attribute vec3 aEndColor;',
                'attribute float aStartOpacity;',
                'attribute float aEndOpacity;',

            ],
            varyingParameters: [
                `
          varying vec3 vParticle;
          varying vec3 vEndPos;
          varying vec3 vStartLoading;
          `,
            ],
            // this chunk is injected 1st thing in the vertex shader main() function
            // variables declared here are available in all subsequent chunks
            vertexInit: [
                // calculate a progress value between 0.0 and 1.0 based on the vertex delay and duration, and the uniform time
                'float tProgress = clamp(uProgress - aDelayDuration.x, 0.0, aDelayDuration.y) / aDelayDuration.y;',
                // // ease the progress using one of the available easing functions
                'tProgress = easeExpoInOut(tProgress);',
                // 'tProgress = uProgress;'
                // 'if(test){ tProgress = 0.0; } else { tProgress = 1.0 ;}'
            ],
            // this chunk is injected before all default position calculations (including the model matrix multiplication)
            vertexPosition: [`
        // linearly interpolate between the start and end position based on tProgress
        // and add the value as a delta
 
         if(tProgress < 0.5){ 
         vec2 pos = vec2(aStartLoading.xy*5.0);

        // Use the noise function
        float n = noise(aStartLoading.yx);
     vec2 test;
      if(mod(aStartLoading.x, 2.0) < 0.2){
            test = rotate2D(aStartLoading.xy, PI*2.0 * uTime * uAngle * n);
             transformed += vec3(test.x, test.y, aStartLoading.z * n);
        }else if (mod(aStartLoading.x, 2.0) >= 0.2 && mod(aStartLoading.x, 2.0) < 1.5){
            test = rotate2D(aStartLoading.xy + n, PI*2.0 * uTime * 0.05 * uAngle * n);
            transformed += vec3(test.x, test.y, aStartLoading.z * n);
        }else {
            test = rotate2D(aStartLoading.xy + n, PI*2.0 * uTime * 0.01 * uAngle * n);
            transformed += vec3(test.x, test.y , aStartLoading.z * n);
        }
        }else{
        
  
        //Brain Particles
           transformed += mix(aStartLoading, aEndPos, tProgress);
        }   
        `,
            ],
            // this chunk is injected before all default color calculations
            vertexColor: [
                // linearly interpolate between the start and end position based on tProgress
                // and add the value as a delta
                ` 
         vParticle = aEndPos;
         
        vEndPos = aEndPos;
        vStartLoading = aStartLoading;
        `,
            ],

            fragmentParameters: [

                'uniform float uTime;',
                'uniform vec3 uColor;',
            ],
            // convert the point (default is square) to circle shape, make sure transparent of material is true
            // you can create more shapes: https://thebookofshaders.com/07/
            fragmentShape: [
                `
        float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
        // Solid core with a glowing edge so overlapping particles blend into a solid mesh
        float pct = smoothstep(0.48, 0.15, distanceToCenter);
        vec3 color = vec3(1.0) * gl_FragColor.rgb;
        gl_FragColor = vec4(color, pct * gl_FragColor.a * 0.015);

       `],

        });

        const xRayMaterial = new THREE.ShaderMaterial({
            uniforms: {
                c: { type: 'f', value: 1.0 },
                p: { type: 'f', value: 4.5 },
                glowColor: { type: 'c', value: new THREE.Color(0x00F7FF) },
                viewVector: { type: 'v3', value: new THREE.Vector3(0, 0, 0) },
                lightningTexture: { type: 't', value: this.mainBrain.loaders.brainXRayLight },
                offsetY: { type: 'f', value: 0.3 },
                uTime: { type: 'f', value: 0.0 },
            },
            vertexShader: xRayVertex,
            fragmentShader: xRayFrag,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
        });

        const systemPoints = new THREE.Points(geometry, material);

        const xRayGeometry = new THREE.Geometry().fromBufferGeometry(this.mainBrain.endPointsCollections);
        xRayGeometry.computeFaceNormals();
        xRayGeometry.mergeVertices();
        xRayGeometry.computeVertexNormals();

        const xRayEffect = new THREE.Mesh(xRayGeometry, xRayMaterial);

        // systemPoints.visible = false;
        // system.scale.multiplyScalar(1.05);
        systemPoints.castShadow = true;
        systemPoints.frustumCulled = false;
        // systemPoints.visible = false;

        // // depth material is used for directional & spot light shadows
        // systemPoints.customDepthMaterial = BAS.Utils.createDepthAnimationMaterial(material);
        // // distance material is used for point light shadows
        systemPoints.customDistanceMaterial = BAS.Utils.createDistanceAnimationMaterial(material);

        systemPoints.customDepthMaterial = new THREE.ShaderMaterial({
            vertexShader: material.vertexShader,
            fragmentShader: material.fragmentShader,
            uniforms: material.uniforms,
        });

        return { xRayEffect, systemPoints };
    }


    update(deltaTime, camera, brain) {
        this.particles.material.uniforms.uTime.value = deltaTime;
        this.xRay.material.uniforms.viewVector.value = new THREE.Vector3().subVectors(camera.position, brain.position);
        this.xRay.material.uniforms.uTime.value = deltaTime;

        // Interactive Zoom Reaction: lerps size/speed based on proximity to core
        const distance = camera.position.distanceTo(brain.position);
        if (distance < 450) {
            // Speed up wave angle noise & increase point size when zooming in
            this.particles.material.uniforms.uPointSizeEffect.value = THREE.Math.lerp(this.particles.material.uniforms.uPointSizeEffect.value, 1.8, 0.08);
            this.particles.material.uniforms.uAngle.value = THREE.Math.lerp(this.particles.material.uniforms.uAngle.value, 3.2, 0.08);
            
            // Pulse X-Ray outline intensity brighter
            this.xRay.material.uniforms.c.value = THREE.Math.lerp(this.xRay.material.uniforms.c.value, 1.0, 0.08);
            this.xRay.material.uniforms.p.value = THREE.Math.lerp(this.xRay.material.uniforms.p.value, 3.0, 0.08);
        } else {
            // Restore normal parameters when zooming out
            this.particles.material.uniforms.uPointSizeEffect.value = THREE.Math.lerp(this.particles.material.uniforms.uPointSizeEffect.value, 0.1, 0.08);
            this.particles.material.uniforms.uAngle.value = THREE.Math.lerp(this.particles.material.uniforms.uAngle.value, 1.0, 0.08);
            
            this.xRay.material.uniforms.c.value = THREE.Math.lerp(this.xRay.material.uniforms.c.value, 1.0, 0.08);
            this.xRay.material.uniforms.p.value = THREE.Math.lerp(this.xRay.material.uniforms.p.value, 4.5, 0.08);
        }
    }

    isXRayActive(status) {
        if (status) {
            const progress = { p: 0.0 };
            TweenMax.fromTo(progress, 3.0, { p: 3.0 }, {
                p: 5.0,
                ease: Power1.easeIn,
                onUpdate: () => {
                    this.xRay.material.uniforms.offsetY.value = Math.sin(progress.p);
                },
                onComplete: () => {
                },
            });
        } else {
            const progress = { p: 1.0 };
            TweenMax.fromTo(progress, 3.0, { p: 5.0 }, {
                p: 3.0,
                ease: Power1.easeIn,
                onUpdate: () => {
                    this.xRay.material.uniforms.offsetY.value = Math.sin(progress.p);
                },
            });
        }
    }

    updateTransitioning(val) {
        this.particles.material.uniforms.uProgress.value = val;
        if (this.particles.customDepthMaterial && this.particles.customDepthMaterial.uniforms) {
            this.particles.customDepthMaterial.uniforms.uProgress.value = val;
        }
        if (this.particles.customDistanceMaterial && this.particles.customDistanceMaterial.uniforms) {
            this.particles.customDistanceMaterial.uniforms.uProgress.value = val;
        }
    }

    transform(status) {
        if (status) {
            const progress = { p: 0.0 };
            TweenMax.fromTo(progress, 5.9, { p: 0.0 }, {
                p: 1.5,
                ease: Power1.easeIn,
                onUpdate: () => {
                    this.updateTransitioning(progress.p);
                },
                onComplete: () => {
                    this.mainBrain.orbitControls.maxDistance = 700;
                    this.updateTransitioning(1.5);
                    this.mainBrain.fadeSolidBrain(true);
                },
            });
        } else {
            const progress = { p: 1.0 };
            TweenMax.fromTo(progress, 2.0, { p: 1.0 }, {
                p: 0.5,
                ease: Power1.easeIn,
                onUpdate: () => {
                    this.updateTransitioning(progress.p);
                },
            });
        }
    }
}

export default ParticleSystem;
