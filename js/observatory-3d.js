// ==========================================================================
// ORBIT · Controlador de Escena 3D Inmersiva para el Observatorio (Three.js)
// ==========================================================================

(function() {
  'use strict';

  let scene, camera, renderer, modelRoot, animFrameId;
  let isInitialized = false;
  let isLoading = false;
  let isDragging = false;
  let startX = 0, startY = 0;
  let targetRotY = 0.45;
  let targetRotX = 0.12;
  let currentRotY = 0.45;
  let currentRotX = 0.12;
  let autoRotate = true;
  let idleTimer = null;
  let cachedGLTF = null;

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

  function resizeRenderer() {
    if (!renderer || !camera) return;
    const container = document.getElementById('observatoryHeroScene');
    if (!container) return;
    const width = container.clientWidth || window.innerWidth || 360;
    const height = container.clientHeight || window.innerHeight || 600;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function renderLoop() {
    if (!renderer || !scene || !camera) return;

    if (autoRotate && !isDragging) {
      targetRotY += 0.0025;
    }

    // Interpolación suave (lerp)
    currentRotY += (targetRotY - currentRotY) * 0.08;
    currentRotX += (targetRotX - currentRotX) * 0.08;

    if (modelRoot) {
      modelRoot.rotation.y = currentRotY;
      modelRoot.rotation.x = currentRotX;
    }

    renderer.render(scene, camera);
    animFrameId = requestAnimationFrame(renderLoop);
  }

  function setupInteraction(container) {
    if (!container || container._has3DPointerListeners) return;
    container._has3DPointerListeners = true;

    container.addEventListener('pointerdown', (e) => {
      // Ignorar si el puntero toca botones o modales
      if (e.target.closest && (e.target.closest('button') || e.target.closest('.modal') || e.target.closest('.observatory-bottom-dock'))) return;
      isDragging = true;
      autoRotate = false;
      clearTimeout(idleTimer);
      startX = e.clientX;
      startY = e.clientY;
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
    });

    container.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      targetRotY += dx * 0.012;
      targetRotX = Math.max(-0.30, Math.min(0.50, targetRotX + dy * 0.008));
    });

    const endDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      try { container.releasePointerCapture(e.pointerId); } catch (_) {}
      
      // Reactivar rotación automática tras 3.5s de inactividad
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        autoRotate = true;
      }, 3500);
    };

    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', resizeRenderer);
  }

  function initObservatory3D() {
    const container = document.getElementById('observatoryHeroScene');
    const canvas = document.getElementById('observatoryCanvas');
    const fallbackMsg = document.getElementById('observatoryFallbackMessage');

    if (!container || !canvas) return;

    // 1. Validar WebGL y librerías de Three.js
    if (!isWebGLSupported() || typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
      console.warn('[Observatory 3D] WebGL o Three.js no disponible.');
      if (fallbackMsg) fallbackMsg.style.display = 'flex';
      if (canvas) canvas.style.display = 'none';
      return;
    }

    // 2. Si ya está inicializado, reanudar loop y ajustar tamaño
    if (isInitialized) {
      resizeRenderer();
      if (!animFrameId) {
        renderLoop();
      }
      return;
    }

    // 3. Crear escena Three.js
    scene = new THREE.Scene();

    const width = container.clientWidth || window.innerWidth || 360;
    const height = container.clientHeight || window.innerHeight || 600;
    camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 0.45, 5.0);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;

    // 4. Iluminación armónica con la estética nocturna terrestre de Orbit
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffe4ea, 0x180f2d, 1.1);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff5ea, 1.7);
    dirLight.position.set(4, 9, 6);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xfcc2cd, 1.3);
    rimLight.position.set(-5, 4, -4);
    scene.add(rimLight);

    // 5. Cargar modelo GLB (o reusar cache en memoria)
    if (cachedGLTF) {
      mountModel(cachedGLTF, fallbackMsg, canvas);
    } else if (!isLoading) {
      isLoading = true;
      const loader = new THREE.GLTFLoader();
      const modelUrl = 'assets/models/observatory.glb?v=1.3.25';

      loader.load(
        modelUrl,
        function(gltf) {
          isLoading = false;
          cachedGLTF = gltf;
          mountModel(gltf, fallbackMsg, canvas);
        },
        undefined,
        function(err) {
          isLoading = false;
          console.warn('[Observatory 3D] Error al cargar modelo GLB:', err);
          if (fallbackMsg) fallbackMsg.style.display = 'flex';
          if (canvas) canvas.style.display = 'none';
        }
      );
    }

    setupInteraction(container);
    isInitialized = true;
    renderLoop();
  }

  function mountModel(gltf, fallbackMsg, canvas) {
    if (!scene) return;

    // Clonar o añadir el objeto a la escena
    modelRoot = gltf.scene;

    // Centrar automáticamente la geometría
    const box = new THREE.Box3().setFromObject(modelRoot);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim > 0) {
      const targetScale = 4.8 / maxDim;
      modelRoot.scale.setScalar(targetScale);

      modelRoot.position.x = -center.x * targetScale;
      modelRoot.position.y = (-center.y * targetScale) - 0.15;
      modelRoot.position.z = -center.z * targetScale;
    }

    const pivotGroup = new THREE.Group();
    pivotGroup.add(modelRoot);
    scene.add(pivotGroup);
    modelRoot = pivotGroup;

    // Activar canvas y ocultar mensaje fallback
    if (fallbackMsg) fallbackMsg.style.display = 'none';
    if (canvas) {
      canvas.style.display = 'block';
      canvas.style.opacity = '1';
    }
  }

  function pauseObservatory3D() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  // Exportar API global para integración con Orbit
  window.initObservatory3D = initObservatory3D;
  window.pauseObservatory3D = pauseObservatory3D;
  window.resizeObservatory3D = resizeRenderer;

})();
