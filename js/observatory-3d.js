// ==========================================================================
// ORBIT · Controlador Específico del Observatorio Terrestre 3D
// ==========================================================================

(function() {
  'use strict';

  let observatoryScene = null;
  let isInitialized = false;

  // Generador de textura de terreno procedural para superficie nocturna rica y orgánica
  function createProceduralTerrainTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Gradiente radial profundo integrado con la paleta azul-grafito de Orbit
    const radialGrad = ctx.createRadialGradient(256, 256, 12, 256, 256, 256);
    radialGrad.addColorStop(0.00, '#1c2432'); // Centro grafito azulado
    radialGrad.addColorStop(0.20, '#161e2a');
    radialGrad.addColorStop(0.45, '#101622');
    radialGrad.addColorStop(0.75, '#0a0d15');
    radialGrad.addColorStop(1.00, '#05070d'); // Borde exterior idéntico a la cúpula celeste
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Anillos topográficos concéntricos tenues para relieve sutil
    for (let r = 24; r < 240; r += 26) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.lineWidth = 1.2;
      const alpha = Math.max(0.015, (1 - r / 240) * 0.05);
      ctx.strokeStyle = `rgba(180, 205, 235, ${alpha})`;
      ctx.stroke();
    }

    // Grano mineral fino y estocástico (ruido sutil sin patrones repetitivos)
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    let seed = 1337;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const n = ((seed - 1) / 2147483646 - 0.5) * 12;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 1.1));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 1.25));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function buildObservatoryEnvironment(sceneInstance) {
    const envGroup = new THREE.Group();

    // Niebla atmosférica nocturna suave para fundir el horizonte con el cielo sin tapar el modelo
    if (sceneInstance.scene) {
      sceneInstance.scene.fog = new THREE.FogExp2(0x05070d, 0.014);
    }

    // 1. Cúpula Celeste Nocturna Invertida 3D (Azul-negro profundo)
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

      const ridge = Math.sin(theta * 3) * 0.7 + Math.cos(theta * 7) * 0.5 + Math.sin(theta * 11) * 0.3;
      const topY = -0.6 + Math.max(0, ridge) * 1.6;

      mountainPositions.push(baseRadius * sin, baseY, baseRadius * cos);
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

    // 4. Terreno 3D enriquecido con textura procedural y recepción de sombras
    const groundGeo = new THREE.CircleGeometry(32, 48);
    const groundTexture = createProceduralTerrainTexture();
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.90,
      metalness: 0.08,
      dithering: true
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.92;
    groundMesh.receiveShadow = true;
    envGroup.add(groundMesh);

    // 5. Plataforma arquitectónica escalonada de pizarra bajo el observatorio (Asentamiento firme)
    const platformGroup = new THREE.Group();

    // Nivel inferior de la base
    const baseStepGeo = new THREE.CylinderGeometry(1.58, 1.64, 0.035, 36);
    const baseStepMat = new THREE.MeshStandardMaterial({
      color: 0x121722,
      roughness: 0.88,
      metalness: 0.12
    });
    const baseStepMesh = new THREE.Mesh(baseStepGeo, baseStepMat);
    baseStepMesh.position.y = -0.91;
    baseStepMesh.receiveShadow = true;
    platformGroup.add(baseStepMesh);

    // Nivel superior de la base
    const topStepGeo = new THREE.CylinderGeometry(1.28, 1.34, 0.035, 36);
    const topStepMat = new THREE.MeshStandardMaterial({
      color: 0x18202d,
      roughness: 0.82,
      metalness: 0.18
    });
    const topStepMesh = new THREE.Mesh(topStepGeo, topStepMat);
    topStepMesh.position.y = -0.875;
    topStepMesh.receiveShadow = true;
    platformGroup.add(topStepMesh);

    // Anillo embellecedor metálico sutil
    const ringGeo = new THREE.RingGeometry(1.22, 1.28, 36);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x243244,
      roughness: 0.45,
      metalness: 0.60,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -0.856;
    ringMesh.receiveShadow = true;
    platformGroup.add(ringMesh);

    // 4 Balizas perimetrales discretas
    const beaconAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
    const beaconRadius = 1.45;
    const beaconBaseGeo = new THREE.CylinderGeometry(0.028, 0.035, 0.04, 12);
    const beaconBaseMat = new THREE.MeshStandardMaterial({
      color: 0x0f141c,
      roughness: 0.70,
      metalness: 0.30
    });
    const beaconCapGeo = new THREE.SphereGeometry(0.022, 10, 8);
    const beaconCapMat = new THREE.MeshBasicMaterial({
      color: 0x98d0f8
    });

    beaconAngles.forEach(ang => {
      const bx = Math.cos(ang) * beaconRadius;
      const bz = Math.sin(ang) * beaconRadius;

      const bBase = new THREE.Mesh(beaconBaseGeo, beaconBaseMat);
      bBase.position.set(bx, -0.89, bz);
      bBase.receiveShadow = true;
      platformGroup.add(bBase);

      const bCap = new THREE.Mesh(beaconCapGeo, beaconCapMat);
      bCap.position.set(bx, -0.865, bz);
      platformGroup.add(bCap);
    });

    envGroup.add(platformGroup);
    sceneInstance.add(envGroup);

    // 6. Iluminación Nocturna PBR Equilibrada y Sombras Lunares
    const ambientLight = new THREE.AmbientLight(0x0a101d, 0.36);
    sceneInstance.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x182438, 0x060810, 0.28);
    sceneInstance.add(hemiLight);

    const moonLight = new THREE.DirectionalLight(0xdce8f8, 1.35);
    moonLight.position.set(4.5, 7.5, 4.0);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 18;
    moonLight.shadow.camera.left = -2.6;
    moonLight.shadow.camera.right = 2.6;
    moonLight.shadow.camera.top = 2.6;
    moonLight.shadow.camera.bottom = -2.6;
    moonLight.shadow.bias = -0.0006;
    sceneInstance.add(moonLight);

    const rimLight = new THREE.DirectionalLight(0x3e5678, 0.48);
    rimLight.position.set(-5.0, 3.8, -4.5);
    sceneInstance.add(rimLight);
  }

  function mountObservatoryModel(gltf, bounds, sceneInstance) {
    const modelRoot = gltf.scene;

    // Preservar y ajustar los materiales PBR originales del GLB
    modelRoot.traverse(function(child) {
      if (child.isMesh && child.material) {
        child.castShadow = true;
        child.receiveShadow = true;

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const clonedMats = mats.map(function(origMat) {
          const mat = origMat.clone();

          // Espacios de color PBR estrictos
          if (mat.map) {
            mat.map.encoding = THREE.sRGBEncoding;
            mat.map.anisotropy = 4;
          }
          if (mat.emissiveMap) mat.emissiveMap.encoding = THREE.sRGBEncoding;
          if (mat.roughnessMap) mat.roughnessMap.encoding = THREE.LinearEncoding;
          if (mat.metalnessMap) mat.metalnessMap.encoding = THREE.LinearEncoding;
          if (mat.normalMap) mat.normalMap.encoding = THREE.LinearEncoding;

          // Ajustes específicos según la pieza
          if (child.name === 'SG-Window' || (mat.name && mat.name.includes('Window'))) {
            // Lente / Cristal frontal: reflejo azul-verdoso elegante
            mat.transparent = true;
            mat.opacity = 0.88;
            mat.color.setHex(0x388298);
            mat.emissive.setHex(0x0e2834);
            mat.roughness = 0.16;
            mat.metalness = 0.82;
          } else if (child.name && child.name.includes('Graviton')) {
            // Núcleo auxiliar
            mat.color.setHex(0x101e38);
            mat.emissive.setHex(0x08142a);
            mat.roughness = 0.35;
            mat.metalness = 0.55;
          } else {
            // Cúpula y estructura metálica principal
            mat.color.setHex(0xd4dde6);
            mat.roughness = 0.52;
            mat.metalness = 0.44;
          }

          mat.needsUpdate = true;
          return mat;
        });

        child.material = Array.isArray(child.material) ? clonedMats : clonedMats[0];
      }
    });

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

    // Crear la instancia de escena 3D a través de Orbit3D Core con soporte de sombras aislado
    observatoryScene = Orbit3D.createScene({
      containerId: 'observatoryHeroScene',
      canvasId: 'observatoryCanvas',
      fallbackId: 'observatoryFallbackMessage',
      shadows: true,
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

    const modelUrl = 'assets/models/observatory.glb?v=1.3.49';
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

