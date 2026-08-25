// ==========================================================================
// ORBIT · Controlador Específico del Observatorio Terrestre 3D
// ==========================================================================

(function() {
  'use strict';

  let observatoryScene = null;
  let isInitialized = false;

  function buildObservatoryEnvironment(sceneInstance) {
    // 1. Terreno 3D bajo el observatorio
    const groundGroup = new THREE.Group();

    // Suelo montañoso principal (plataforma circular con acabado mate noche/roca)
    const groundGeo = new THREE.CircleGeometry(16, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x130c22,
      roughness: 0.94,
      metalness: 0.06,
      flatShading: true
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.88;
    groundGroup.add(groundMesh);

    // Anillo sutil de contorno del mirador
    const rimGeo = new THREE.RingGeometry(2.4, 2.55, 32);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xfcc2cd,
      opacity: 0.20,
      transparent: true,
      side: THREE.DoubleSide
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = -Math.PI / 2;
    rimMesh.position.y = -0.87;
    groundGroup.add(rimMesh);

    sceneInstance.add(groundGroup);

    // 2. Iluminación armónica con la estética nocturna terrestre de Orbit
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    sceneInstance.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffe4ea, 0x180f2d, 1.1);
    sceneInstance.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff5ea, 1.7);
    dirLight.position.set(4, 9, 6);
    sceneInstance.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xfcc2cd, 1.3);
    rimLight.position.set(-5, 4, -4);
    sceneInstance.add(rimLight);
  }

  function mountObservatoryModel(gltf, bounds, sceneInstance) {
    const modelRoot = gltf.scene;

    if (bounds.maxDim > 0) {
      const targetScale = 1.6 / bounds.maxDim;
      modelRoot.scale.setScalar(targetScale);

      modelRoot.position.x = -bounds.center.x * targetScale;
      modelRoot.position.y = (-bounds.center.y * targetScale) - 0.15;
      modelRoot.position.z = -bounds.center.z * targetScale;
    }

    const pivotGroup = new THREE.Group();
    pivotGroup.add(modelRoot);
    sceneInstance.add(pivotGroup);
    sceneInstance.invalidate();
  }

  function initObservatory3D() {
    if (!window.Orbit3D) {
      console.warn('[Observatory 3D] Motor Orbit3D no disponible.');
      return;
    }

    // Si ya existe la instancia, reanudarla y ajustar tamaño
    if (isInitialized && observatoryScene) {
      observatoryScene.resume();
      return;
    }

    // Crear la instancia de escena 3D a través de Orbit3D Core
    observatoryScene = Orbit3D.createScene({
      containerId: 'observatoryHeroScene',
      canvasId: 'observatoryCanvas',
      fallbackId: 'observatoryFallbackMessage',
      camera: {
        type: 'orbital',
        fov: 42,
        radius: 5.2,
        azimuth: 0.45,
        elevation: 0.14,
        minElevation: 0.04,
        maxElevation: 0.55
      }
    });

    if (!observatoryScene.scene) return;

    buildObservatoryEnvironment(observatoryScene);

    const modelUrl = 'assets/models/observatory.glb?v=1.3.30';
    Orbit3D.loadGLB(
      modelUrl,
      function(gltf, bounds) {
        mountObservatoryModel(gltf, bounds, observatoryScene);
      },
      function(err) {
        console.warn('[Observatory 3D] Error cargando modelo:', err);
      }
    );

    isInitialized = true;
  }

  function pauseObservatory3D() {
    if (observatoryScene) {
      observatoryScene.pause();
    }
  }

  function resizeObservatory3D() {
    if (observatoryScene) {
      observatoryScene.resize();
    }
  }

  // Exportar API global para integración con Orbit
  window.initObservatory3D = initObservatory3D;
  window.pauseObservatory3D = pauseObservatory3D;
  window.resizeObservatory3D = resizeObservatory3D;

})();
