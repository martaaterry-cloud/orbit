// ==========================================================================
// ORBIT · Controlador del Universo 3D (Firmamento y Constelaciones en Three.js)
// ==========================================================================

(function() {
  'use strict';

  let universeScene = null;
  let isInitialized = false;
  let constellationsGroup = null;
  let starTexture = null;
  let labelsList = [];
  let labelsContainer = null;
  const tempProjectVec = new THREE.Vector3();

  // Profundidad determinista por región/colección
  const REGION_DEPTH = {
    'norte': 0,        // Primer Cielo (Sector frontal central)
    'zodiaco': -2.2,   // Zodiaco (Capa intermedia)
    'invierno': -4.5,  // Cielo de Invierno
    'profundo': -7.0   // Espacio Profundo
  };

  // Textura circular procedural en memoria (círculo suave con centro brillante)
  function getStarTexture() {
    if (!starTexture && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.9)');
      grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.35)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 32, 0, Math.PI * 2);
      ctx.fill();

      starTexture = new THREE.CanvasTexture(canvas);
    }
    return starTexture;
  }

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

    // 2. Campo estelar tenue de fondo con estrellas circulares
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
      size: 0.42,
      map: getStarTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      opacity: 0.60
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

    // 1. Puntos de estrellas circulares locales
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

      let starColor = 0x4a5468;
      let starSize = 0.32;
      let starOpacity = 0.35;

      if (state.status === 'claimed') {
        starColor = 0xffffff;
        starSize = 0.58;
        starOpacity = 0.95;
      } else if (state.status === 'discovered') {
        starColor = 0xffebd6;
        starSize = 0.50;
        starOpacity = 0.88;
      } else if (state.status === 'in-progress') {
        starColor = 0xf4eee4;
        starSize = 0.44;
        starOpacity = 0.78;
      }

      const starMat = new THREE.PointsMaterial({
        color: starColor,
        size: starSize,
        map: getStarTexture(),
        transparent: true,
        depthWrite: false,
        opacity: starOpacity
      });
      const starPoints = new THREE.Points(starGeo, starMat);
      group.add(starPoints);
    }

    // 2. Aristas conectoras finas (LineSegments)
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

      let lineColor = 0x222a36;
      let lineOpacity = 0.12;

      if (state.status === 'claimed') {
        lineColor = 0xffffff;
        lineOpacity = 0.65;
      } else if (state.status === 'discovered') {
        lineColor = 0xffe2c4;
        lineOpacity = 0.45;
      } else if (state.status === 'in-progress') {
        lineColor = 0xded4c2;
        lineOpacity = 0.30;
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

    return { group, hitMesh, worldPos: group.position };
  }

  function updateLabelsProjection(sceneInstance) {
    if (!sceneInstance || !sceneInstance.camera || !labelsContainer || labelsList.length === 0) return;
    const camera = sceneInstance.camera;
    const width = sceneInstance.container.clientWidth || window.innerWidth || 360;
    const height = sceneInstance.container.clientHeight || window.innerHeight || 600;

    labelsList.forEach(item => {
      tempProjectVec.copy(item.worldPos);
      tempProjectVec.project(camera);

      // Si el punto queda detrás de la cámara o muy fuera de los bordes visibles
      if (tempProjectVec.z > 1.0 || tempProjectVec.x < -1.15 || tempProjectVec.x > 1.15 || tempProjectVec.y < -1.15 || tempProjectVec.y > 1.15) {
        item.element.style.display = 'none';
        return;
      }

      const screenX = (tempProjectVec.x * 0.5 + 0.5) * width;
      const screenY = (-tempProjectVec.y * 0.5 + 0.5) * height;

      item.element.style.display = 'block';
      item.element.style.left = `${Math.round(screenX)}px`;
      item.element.style.top = `${Math.round(screenY + 14)}px`;
    });
  }

  function renderConstellations(sceneInstance) {
    if (!sceneInstance || typeof constellationDefs === 'undefined') return;

    // Si ya existía un grupo previo, eliminarlo
    if (constellationsGroup) {
      sceneInstance.remove(constellationsGroup);
      sceneInstance.clearInteractiveObjects();
    }

    labelsContainer = document.getElementById('universeLabelsLayer');
    if (labelsContainer) {
      labelsContainer.innerHTML = '';
    }
    labelsList = [];

    constellationsGroup = new THREE.Group();
    const d = (typeof load === 'function') ? load() : {};

    constellationDefs.forEach(c => {
      const state = getConstellationState(c, d);
      const { group, hitMesh, worldPos } = buildConstellationMesh(c, state);
      constellationsGroup.add(group);
      sceneInstance.registerInteractiveObject(hitMesh);

      // Crear label proyectado solo para constelaciones no bloqueadas
      if (state.status !== 'locked' && labelsContainer) {
        const labelEl = document.createElement('div');
        labelEl.className = `universe-3d-label label-status-${state.status}`;
        labelEl.style.position = 'absolute';
        labelEl.style.transform = 'translate(-50%, -50%)';
        labelEl.style.pointerEvents = 'none';
        labelEl.style.fontSize = '10px';
        labelEl.style.fontWeight = '500';
        labelEl.style.letterSpacing = '0.04em';
        labelEl.style.whiteSpace = 'nowrap';
        labelEl.style.color = state.status === 'claimed' ? 'rgba(255, 255, 255, 0.95)' : (state.status === 'discovered' ? 'rgba(255, 235, 214, 0.85)' : 'rgba(230, 220, 205, 0.70)');
        labelEl.style.textShadow = '0 1px 3px rgba(0,0,0,0.85)';
        labelEl.textContent = `${c.name}${state.status === 'claimed' ? ' ✦' : ''}`;
        labelsContainer.appendChild(labelEl);

        labelsList.push({
          id: c.id,
          worldPos: worldPos.clone(),
          element: labelEl
        });
      }
    });

    sceneInstance.add(constellationsGroup);
    updateLabelsProjection(sceneInstance);
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
      onRender: function() {
        updateLabelsProjection(universeScene);
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
      updateLabelsProjection(universeScene);
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
