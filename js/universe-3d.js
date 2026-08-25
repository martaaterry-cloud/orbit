// ==========================================================================
// ORBIT · Controlador del Universo 3D (Firmamento y Constelaciones en Three.js)
// ==========================================================================

(function() {
  'use strict';

  let universeScene = null;
  let isInitialized = false;
  let constellationsGroup = null;

  // Profundidad determinista por región/colección
  const REGION_DEPTH = {
    'norte': 0,        // Primer Cielo (Sector frontal central)
    'zodiaco': -2.2,   // Zodiaco (Capa intermedia)
    'invierno': -4.5,  // Cielo de Invierno
    'profundo': -7.0   // Espacio Profundo
  };

  function buildCosmicBackground(sceneInstance) {
    const bgGroup = new THREE.Group();

    // 1. Bóveda celeste oscura infinita
    const skyGeo = new THREE.SphereGeometry(140, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x04060a,
      side: THREE.BackSide
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    bgGroup.add(skyMesh);

    // 2. Campo estelar tenue de fondo
    const starCount = 750;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const bgPalettes = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xf0f4f8),
      new THREE.Color(0xfff5e6),
      new THREE.Color(0xdbe6f5)
    ];

    for (let i = 0; i < starCount; i++) {
      const phi = Math.acos(1 - 2 * Math.random());
      const theta = Math.random() * Math.PI * 2;
      const r = 100 + Math.random() * 30;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const col = bgPalettes[Math.floor(Math.random() * bgPalettes.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.65
    });
    const bgStars = new THREE.Points(starGeo, starMat);
    bgGroup.add(bgStars);

    sceneInstance.add(bgGroup);
  }

  function getConstellationState(c, d) {
    const total = Number(d.lifetimeStars || 0);
    const unlockedSkies = (typeof skyRegionsList !== 'undefined') ? skyRegionsList.filter(r => (d.unlockedRegions && d.unlockedRegions.includes(r.id)) || r.id === 'cielo-1') : [];
    const allUnlockedCols = unlockedSkies.map(r => r.col);

    // Comprobar si la región está desbloqueada
    const isRegionUnlocked = allUnlockedCols.length === 0 || allUnlockedCols.includes(c.collection);

    if (!isRegionUnlocked) {
      return { status: 'locked', progress: 0.0 };
    }

    if (d.claimed && d.claimed[c.id]) {
      return { status: 'claimed', progress: 1.0 };
    }

    if (total >= c.need) {
      return { status: 'discovered', progress: 1.0 };
    }

    // Calcular si es la siguiente en progreso
    const allAvailable = (typeof constellationDefs !== 'undefined') ? constellationDefs.filter(item => allUnlockedCols.includes(item.collection)) : [];
    allAvailable.sort((a, b) => a.need - b.need);
    const next = allAvailable.find(item => total < item.need);

    if (next && next.id === c.id) {
      const idx = allAvailable.indexOf(c);
      const prevNeed = idx > 0 ? allAvailable[idx - 1].need : 0;
      const progress = Math.max(0, Math.min(1, (total - prevNeed) / (c.need - prevNeed)));
      return { status: 'in-progress', progress };
    }

    return { status: 'locked', progress: 0.0 };
  }

  function buildConstellationMesh(c, state) {
    const group = new THREE.Group();
    const scale = ((c.size || 120) / 120) * 0.018;

    // Posición espacial 3D
    group.position.x = (c.x - 50) * 0.12;
    group.position.y = -(c.y - 50) * 0.12;
    group.position.z = REGION_DEPTH[c.collection] !== undefined ? REGION_DEPTH[c.collection] : 0;
    group.rotation.z = -THREE.MathUtils.degToRad(c.rot || 0);

    // 1. Puntos de estrellas locales
    const stars = c.stars || [];
    const starPositions = [];
    const starCoordsById = new Map();
    const starCoordsByIndex = [];

    stars.forEach((s, idx) => {
      const lx = (s.x - 50) * scale;
      const ly = -(s.y - 50) * scale;
      const lz = 0;
      starPositions.push(lx, ly, lz);
      const coord = [lx, ly, lz];
      starCoordsByIndex.push(coord);
      if (s.id) {
        starCoordsById.set(s.id, coord);
      }
      starCoordsById.set(idx, coord);
      starCoordsById.set(String(idx), coord);
    });

    if (starPositions.length > 0) {
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));

      let starColor = 0x555d6b;
      let starSize = 0.9;
      let starOpacity = 0.35;

      if (state.status === 'claimed') {
        starColor = 0xffffff;
        starSize = 1.4;
        starOpacity = 1.0;
      } else if (state.status === 'discovered') {
        starColor = 0xffebd6;
        starSize = 1.25;
        starOpacity = 0.92;
      } else if (state.status === 'in-progress') {
        starColor = 0xf4eee4;
        starSize = 1.1;
        starOpacity = 0.80;
      }

      const starMat = new THREE.PointsMaterial({
        color: starColor,
        size: starSize,
        transparent: true,
        opacity: starOpacity
      });
      const starPoints = new THREE.Points(starGeo, starMat);
      group.add(starPoints);
    }

    // 2. Aristas conectoras (LineSegments)
    const edges = c.edges || [];
    const linePositions = [];

    edges.forEach(([a, b]) => {
      let pA = starCoordsById.get(a);
      let pB = starCoordsById.get(b);

      if (!pA && typeof a === 'number') pA = starCoordsByIndex[a];
      if (!pB && typeof b === 'number') pB = starCoordsByIndex[b];

      if (pA && pB) {
        linePositions.push(pA[0], pA[1], pA[2], pB[0], pB[1], pB[2]);
      }
    });

    if (linePositions.length > 0) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

      let lineColor = 0x2e3440;
      let lineOpacity = 0.15;

      if (state.status === 'claimed') {
        lineColor = 0xffffff;
        lineOpacity = 0.85;
      } else if (state.status === 'discovered') {
        lineColor = 0xffe2c4;
        lineOpacity = 0.65;
      } else if (state.status === 'in-progress') {
        lineColor = 0xded4c2;
        lineOpacity = 0.40;
      }

      const lineMat = new THREE.LineBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: lineOpacity
      });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      group.add(lines);
    }

    // 3. Hitbox invisible esférica para raycast interactivo
    const hitRadius = Math.max(0.65, scale * 45);
    const hitGeo = new THREE.SphereGeometry(hitRadius, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.userData = { constellationId: c.id, name: c.name };
    group.add(hitMesh);

    return { group, hitMesh };
  }

  function renderConstellations(sceneInstance) {
    if (!sceneInstance || typeof constellationDefs === 'undefined') return;

    // Si ya existía un grupo previo, eliminarlo
    if (constellationsGroup) {
      sceneInstance.remove(constellationsGroup);
      sceneInstance.clearInteractiveObjects();
    }

    constellationsGroup = new THREE.Group();
    const d = (typeof load === 'function') ? load() : {};

    constellationDefs.forEach(c => {
      const state = getConstellationState(c, d);
      const { group, hitMesh } = buildConstellationMesh(c, state);
      constellationsGroup.add(group);
      sceneInstance.registerInteractiveObject(hitMesh);
    });

    sceneInstance.add(constellationsGroup);
    sceneInstance.invalidate();
  }

  function initUniverse3D() {
    if (!window.Orbit3D) {
      console.warn('[Universe 3D] Motor Orbit3D no disponible.');
      return;
    }

    // Si ya existe la instancia, reanudarla y sincronizar
    if (isInitialized && universeScene) {
      universeScene.resume();
      renderConstellations(universeScene);
      return;
    }

    // Crear la instancia de escena 3D a través de Orbit3D Core
    universeScene = Orbit3D.createScene({
      containerId: 'universeHeroScene',
      canvasId: 'universeCanvas',
      fallbackId: 'universeFallbackMessage',
      camera: {
        type: 'pan-zoom',
        fov: 45,
        zoomZ: 14.0,
        minZoom: 3.5,
        maxZoom: 28.0,
        minPanX: -10.0,
        maxPanX: 10.0,
        minPanY: -10.0,
        maxPanY: 10.0
      },
      onObjectClick: function(hit) {
        const constId = hit.object && hit.object.userData ? hit.object.userData.constellationId : null;
        if (constId && typeof verFichaConstelacion === 'function') {
          verFichaConstelacion(constId);
        }
      }
    });

    if (!universeScene.scene) return;

    buildCosmicBackground(universeScene);
    renderConstellations(universeScene);

    isInitialized = true;
  }

  function pauseUniverse3D() {
    if (universeScene) {
      universeScene.pause();
    }
  }

  function resizeUniverse3D() {
    if (universeScene) {
      universeScene.resize();
    }
  }

  function refreshUniverse3D() {
    if (universeScene) {
      renderConstellations(universeScene);
    }
  }

  // Exportar API global para integración con Orbit
  window.initUniverse3D = initUniverse3D;
  window.pauseUniverse3D = pauseUniverse3D;
  window.resizeUniverse3D = resizeUniverse3D;
  window.refreshUniverse3D = refreshUniverse3D;

})();
