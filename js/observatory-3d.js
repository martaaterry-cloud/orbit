// ==========================================================================
// ORBIT · Controlador Específico del Observatorio Terrestre 3D
// ==========================================================================

(function() {
  'use strict';

  let observatoryScene = null;
  let isInitialized = false;

  function buildObservatoryEnvironment(sceneInstance) {
    const envGroup = new THREE.Group();

    // 1. Cúpula Celeste Nocturna Invertida 3D (Azul-negro profundo muy oscuro)
    const skyGeo = new THREE.SphereGeometry(180, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x05070d,
      side: THREE.BackSide
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    envGroup.add(skyMesh);

    // 2. Campo Estelar 3D Discreto (Predominio blanco y crema tenue)
    const starCount = 850;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const starPalettes = [
      new THREE.Color(0xffffff), // Blanco puro
      new THREE.Color(0xf6f8fa), // Blanco estelar suave
      new THREE.Color(0xfff8ee), // Crema muy tenue
      new THREE.Color(0xdde8f5)  // Azul frío muy sutil
    ];

    for (let i = 0; i < starCount; i++) {
      const phi = Math.acos(1 - 2 * Math.random());
      const theta = Math.random() * Math.PI * 2;
      const r = 150 + Math.random() * 25;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.max(-6, r * Math.cos(phi));
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const col = starPalettes[Math.floor(Math.random() * starPalettes.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.85,
      vertexColors: true,
      transparent: true,
      opacity: 0.78
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    envGroup.add(starPoints);

    // 3. Relieve Montañoso Distante Low-Poly (Siluetas terrestres lejanas)
    const mountainSegments = 48;
    const mountainPositions = [];
    const mountainIndices = [];
    const baseRadius = 85;
    const baseY = -2.8;

    for (let i = 0; i <= mountainSegments; i++) {
      const theta = (i / mountainSegments) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);

      // Variación orgánica de cumbre montañosa
      const ridge = Math.sin(theta * 3) * 0.7 + Math.cos(theta * 7) * 0.5 + Math.sin(theta * 11) * 0.3;
      const topY = -0.6 + Math.max(0, ridge) * 1.6;

      // Base inferior
      mountainPositions.push(baseRadius * sin, baseY, baseRadius * cos);
      // Cumbre superior
      mountainPositions.push((baseRadius - 2) * sin, topY, (baseRadius - 2) * cos);
    }

    for (let i = 0; i < mountainSegments; i++) {
      const i0 = i * 2;
      const i1 = i * 2 + 1;
      const i2 = (i + 1) * 2;
      const i3 = (i + 1) * 2 + 1;

      mountainIndices.push(i0, i2, i1);
      mountainIndices.push(i1, i2, i3);
    }

    const mountainGeo = new THREE.BufferGeometry();
    mountainGeo.setAttribute('position', new THREE.Float32BufferAttribute(mountainPositions, 3));
    mountainGeo.setIndex(mountainIndices);
    mountainGeo.computeVertexNormals();

    const mountainMat = new THREE.MeshBasicMaterial({
      color: 0x06080e,
      side: THREE.BackSide
    });
    const mountainMesh = new THREE.Mesh(mountainGeo, mountainMat);
    envGroup.add(mountainMesh);

    // 4. Terreno 3D bajo el observatorio (Cumbre de roca y pizarra neutra oscura)
    const groundGeo = new THREE.CircleGeometry(16, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.88;
    envGroup.add(groundMesh);

    sceneInstance.add(envGroup);

    // 5. Iluminación Natural Nocturna (Neutro/Frío sin dominantes rosas)
    const ambientLight = new THREE.AmbientLight(0xdde5f0, 0.95);
    sceneInstance.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x607898, 0x14161a, 0.85);
    sceneInstance.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xe8f0f8, 1.45);
    dirLight.position.set(4, 9, 6);
    sceneInstance.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x8ca4c0, 0.75);
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

    const modelUrl = 'assets/models/observatory.glb?v=1.3.39';
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
