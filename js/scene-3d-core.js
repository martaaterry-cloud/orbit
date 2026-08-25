// ==========================================================================
// ORBIT · Motor 3D Centralizado y Reactivo (Three.js Core)
// ==========================================================================

(function() {
  'use strict';

  // Caché global de modelos GLB en memoria
  const modelCache = new Map();

  // Registro de escenas activas
  const activeScenes = new Set();
  let currentActiveScene = null;

  // Comprobar soporte de WebGL de forma segura
  function isWebGLSupported() {
    try {
      const canvas = document.createElement('canvas');
      return Boolean(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  }

  // Calcular límites geométricos y centro
  function computeBounds(object3D) {
    const box = new THREE.Box3().setFromObject(object3D);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    return { box, center, size, maxDim };
  }

  // Cargador GLB centralizado con caché
  function loadGLB(url, onSuccess, onError) {
    if (modelCache.has(url)) {
      const cached = modelCache.get(url);
      if (onSuccess) onSuccess(cached.gltf, cached.bounds);
      return;
    }

    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
      if (onError) onError(new Error('THREE.GLTFLoader no está disponible.'));
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
      url,
      function(gltf) {
        const bounds = computeBounds(gltf.scene);
        modelCache.set(url, { gltf, bounds });
        if (onSuccess) onSuccess(gltf, bounds);
      },
      undefined,
      function(err) {
        console.warn('[Orbit3D] Error cargando modelo GLB:', url, err);
        if (onError) onError(err);
      }
    );
  }

  // Clase que gestiona una instancia de Escena 3D
  class SceneInstance {
    constructor(options = {}) {
      this.options = options;
      this.container = document.getElementById(options.containerId);
      this.canvas = document.getElementById(options.canvasId);
      this.fallback = options.fallbackId ? document.getElementById(options.fallbackId) : null;

      this.scene = null;
      this.camera = null;
      this.renderer = null;

      // Parámetros de Cámara Orbital
      const camOpt = options.camera || {};
      this.cameraType = camOpt.type || 'orbital';
      this.fov = camOpt.fov || 42;
      this.orbitRadius = camOpt.radius || 5.2;
      this.orbitAzimuth = camOpt.azimuth !== undefined ? camOpt.azimuth : 0.45;
      this.orbitElevation = camOpt.elevation !== undefined ? camOpt.elevation : 0.14;
      this.minElevation = camOpt.minElevation !== undefined ? camOpt.minElevation : 0.04;
      this.maxElevation = camOpt.maxElevation !== undefined ? camOpt.maxElevation : 0.55;
      this.target = camOpt.target ? new THREE.Vector3(...camOpt.target) : new THREE.Vector3(0, 0, 0);

      // Scheduler reactivo
      this.isFrameRequested = false;
      this.isPaused = false;
      this.isDragging = false;
      this.startX = 0;
      this.startY = 0;

      this._init();
    }

    _init() {
      if (!this.container || !this.canvas) return;

      if (!isWebGLSupported() || typeof THREE === 'undefined') {
        console.warn('[Orbit3D] WebGL o Three.js no disponible.');
        if (this.fallback) this.fallback.style.display = 'flex';
        if (this.canvas) this.canvas.style.display = 'none';
        return;
      }

      this.scene = new THREE.Scene();

      const width = this.container.clientWidth || window.innerWidth || 360;
      const height = this.container.clientHeight || window.innerHeight || 600;

      this.camera = new THREE.PerspectiveCamera(this.fov, width / height, 0.1, 1000);
      this.updateCamera();

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height, false);
      this.renderer.outputEncoding = THREE.sRGBEncoding;

      this._setupInteraction();
      this._setupResizeListener();

      activeScenes.add(this);
      currentActiveScene = this;

      if (this.fallback) this.fallback.style.display = 'none';
      if (this.canvas) {
        this.canvas.style.display = 'block';
        this.canvas.style.opacity = '1';
      }

      this.invalidate();
    }

    updateCamera() {
      if (!this.camera) return;

      if (this.cameraType === 'orbital') {
        this.camera.position.x = this.orbitRadius * Math.cos(this.orbitElevation) * Math.sin(this.orbitAzimuth);
        this.camera.position.y = this.orbitRadius * Math.sin(this.orbitElevation);
        this.camera.position.z = this.orbitRadius * Math.cos(this.orbitElevation) * Math.cos(this.orbitAzimuth);
        this.camera.lookAt(this.target);
      }
    }

    _setupInteraction() {
      if (!this.container || this.container._orbitPointerInit) return;
      this.container._orbitPointerInit = true;

      this.container.addEventListener('pointerdown', (e) => {
        if (e.target.closest && (e.target.closest('button') || e.target.closest('.modal') || e.target.closest('.observatory-bottom-dock'))) return;
        this.isDragging = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        try { this.container.setPointerCapture(e.pointerId); } catch (_) {}
      });

      this.container.addEventListener('pointermove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        this.startX = e.clientX;
        this.startY = e.clientY;

        if (this.cameraType === 'orbital') {
          this.orbitAzimuth -= dx * 0.008;
          this.orbitElevation = Math.max(this.minElevation, Math.min(this.maxElevation, this.orbitElevation + dy * 0.006));
          this.updateCamera();
          this.invalidate();
        }
      });

      const onEnd = (e) => {
        if (!this.isDragging) return;
        this.isDragging = false;
        try { this.container.releasePointerCapture(e.pointerId); } catch (_) {}
      };

      this.container.addEventListener('pointerup', onEnd);
      this.container.addEventListener('pointercancel', onEnd);
    }

    _setupResizeListener() {
      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize);
    }

    // Scheduler de Render Reactivo (solo renderiza cuando es necesario)
    invalidate() {
      if (this.isPaused || this.isFrameRequested || !this.renderer || !this.scene || !this.camera) return;

      this.isFrameRequested = true;
      requestAnimationFrame(() => {
        this.isFrameRequested = false;
        if (!this.isPaused && this.renderer && this.scene && this.camera) {
          if (typeof this.options.onRender === 'function') {
            this.options.onRender();
          }
          this.renderer.render(this.scene, this.camera);
        }
      });
    }

    add(object) {
      if (this.scene && object) {
        this.scene.add(object);
        this.invalidate();
      }
    }

    remove(object) {
      if (this.scene && object) {
        this.scene.remove(object);
        this.invalidate();
      }
    }

    resize() {
      if (!this.renderer || !this.camera || !this.container) return;
      const width = this.container.clientWidth || window.innerWidth || 360;
      const height = this.container.clientHeight || window.innerHeight || 600;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
      this.invalidate();
    }

    pause() {
      this.isPaused = true;
    }

    resume() {
      if (this.isPaused) {
        this.isPaused = false;
        currentActiveScene = this;
        this.resize();
        this.invalidate();
      }
    }

    dispose() {
      this.pause();
      if (this._onResize) {
        window.removeEventListener('resize', this._onResize);
      }
      if (this.renderer) {
        this.renderer.dispose();
      }
      activeScenes.delete(this);
      if (currentActiveScene === this) currentActiveScene = null;
    }
  }

  // API Global Orbit3D
  window.Orbit3D = {
    isWebGLSupported,
    computeBounds,
    loadGLB,
    createScene: function(options) {
      return new SceneInstance(options);
    },
    pauseAll: function() {
      activeScenes.forEach(s => s.pause());
    },
    invalidateActive: function() {
      if (currentActiveScene) currentActiveScene.invalidate();
    }
  };

})();
