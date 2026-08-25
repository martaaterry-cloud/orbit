// ==========================================================================
// ORBIT · Controlador del Universo 3D (Firmamento, Grandes Regiones Cósmicas y Constelaciones)
// ==========================================================================

(function() {
  'use strict';

  let universeScene = null;
  let isInitialized = false;
  let constellationsGroup = null;
  let regionsGroup = null;
  let starTexture = null;
  let nebulaTexture = null;
  let labelsList = [];
  let labelsContainer = null;
  let focusedRegionId = null;
  const tempProjectVec = new THREE.Vector3();

  // Profundidad determinista por región/colección
  const REGION_DEPTH = {
    'norte': 0,        // Primer Cielo
    'zodiaco': -2.0,   // Zodiaco
    'invierno': -3.5,  // Cielo de Invierno
    'profundo': -6.0   // Espacio Profundo
  };

  // Coordenadas espaciales deterministas encuadradas para móvil (disposición 2x2 armónica)
  const REGIONS_CONFIG = [
    {
      id: 'cielo-1',
      name: 'Primer cielo',
      roman: 'I',
      col: 'norte',
      pos: { x: -1.7, y: 3.2, z: 0.0 },
      seed: 104729,
      type: 'nebula-cool-blue',
      // Azul/blanco frío suave (tonos orgánicos sin saturación excesiva)
      colorUnlocked: [0x5078be, 0x8ab4e8, 0xcce0fa],
      colorLocked: [0x161e2b, 0x111620]
    },
    {
      id: 'zodiaco',
      name: 'Zodiaco',
      roman: 'II',
      col: 'zodiaco',
      pos: { x: 1.7, y: 3.0, z: -2.0 },
      seed: 1299709,
      type: 'nebula-gold-belt',
      // Crema/dorado apagado muy sutil (nada naranja fuerte, estructura alargada)
      colorUnlocked: [0x8c7850, 0xc8b482, 0xf0e0ba],
      colorLocked: [0x201e26, 0x16151c]
    },
    {
      id: 'orion',
      name: 'Cielo de invierno',
      roman: 'III',
      col: 'invierno',
      pos: { x: -1.7, y: -2.8, z: -3.5 },
      seed: 786433,
      type: 'nebula-ice-crystal',
      // Azul hielo cristalino/blanco suave
      colorUnlocked: [0x4a8094, 0x7ec0d4, 0xc2ecf8],
      colorLocked: [0x141f26, 0x0f171d]
    },
    {
      id: 'profundo',
      name: 'Espacio profundo',
      roman: 'IV',
      col: 'profundo',
      pos: { x: 1.7, y: -3.0, z: -6.0 },
      seed: 982451653,
      type: 'gravitational-void',
      // Azul-negro/violeta muy oscuro sin magenta fuerte
      colorUnlocked: [0x221a38, 0x161426, 0x362c54],
      colorLocked: [0x100e16, 0x0a090e]
    }
  ];

  // Generador pseudo-aleatorio determinista por semilla fija
  function createSeededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

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

  // Textura radial procedural suave para nebulosas orgánicas
  function getNebulaTexture() {
    if (!nebulaTexture && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.20, 'rgba(255, 255, 255, 0.65)');
      grad.addColorStop(0.48, 'rgba(255, 255, 255, 0.20)');
      grad.addColorStop(0.78, 'rgba(255, 255, 255, 0.04)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(64, 64, 64, 0, Math.PI * 2);
      ctx.fill();

      nebulaTexture = new THREE.CanvasTexture(canvas);
    }
    return nebulaTexture;
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
      size: 0.40,
      map: getStarTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      opacity: 0.55
    });
    const bgStars = new THREE.Points(starGeo, starMat);
    bgGroup.add(bgStars);

    sceneInstance.add(bgGroup);
  }

  function getConstellationState(c, d) {
    const total = Number(d.lifetimeStars || 0);
    const unlockedSkies = (typeof skyRegionsList !== 'undefined') ? skyRegionsList.filter(r => (d.unlockedRegions && d.unlockedRegions.includes(r.id)) || r.id === 'cielo-1') : [];
    const allUnlockedCols = unlockedSkies.map(r => r.col);

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

    group.position.x = (c.x - 50) * 0.12;
    group.position.y = -(c.y - 50) * 0.12;
    group.position.z = REGION_DEPTH[c.collection] !== undefined ? REGION_DEPTH[c.collection] : 0;
    group.rotation.z = -THREE.MathUtils.degToRad(c.rot || 0);

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

    const hitRadius = Math.max(0.65, scale * 45);
    const hitGeo = new THREE.SphereGeometry(hitRadius, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.userData = { type: 'constellation', constellationId: c.id, name: c.name };
    group.add(hitMesh);

    return { group, hitMesh, worldPos: group.position };
  }

  // 4 Grandes Formaciones Cósmicas Procedurales y Orgánicas (Calibradas sin quemados)
  function buildRegionMesh(regConfig, isUnlocked) {
    const group = new THREE.Group();
    group.position.set(regConfig.pos.x, regConfig.pos.y, regConfig.pos.z);
    const rng = createSeededRandom(regConfig.seed);

    if (regConfig.type === 'gravitational-void') {
      // Espacio Profundo: Centro oscuro, halo tenue violeta/azul-negro, disco fino de polvo
      const haloTex = getNebulaTexture();
      const starTex = getStarTexture();

      // 1. Halo difuso violeta/azul-negro (NormalBlending suave)
      const haloMat = new THREE.SpriteMaterial({
        map: haloTex,
        color: isUnlocked ? regConfig.colorUnlocked[0] : regConfig.colorLocked[0],
        transparent: true,
        opacity: isUnlocked ? 0.32 : 0.08,
        depthWrite: false
      });
      const haloSprite = new THREE.Sprite(haloMat);
      haloSprite.scale.set(3.8, 3.8, 1);
      group.add(haloSprite);

      // 2. Halo interno tenue de lente gravitacional
      const lensMat = new THREE.SpriteMaterial({
        map: haloTex,
        color: isUnlocked ? regConfig.colorUnlocked[2] : regConfig.colorLocked[1],
        transparent: true,
        opacity: isUnlocked ? 0.20 : 0.05,
        depthWrite: false
      });
      const lensSprite = new THREE.Sprite(lensMat);
      lensSprite.scale.set(2.4, 2.4, 1);
      group.add(lensSprite);

      // 3. Núcleo oscuro profundo
      const coreCanvas = document.createElement('canvas');
      coreCanvas.width = 64;
      coreCanvas.height = 64;
      const cCtx = coreCanvas.getContext('2d');
      const cGrad = cCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      cGrad.addColorStop(0, 'rgba(2, 3, 7, 0.98)');
      cGrad.addColorStop(0.65, 'rgba(3, 4, 10, 0.92)');
      cGrad.addColorStop(0.85, 'rgba(5, 7, 15, 0.50)');
      cGrad.addColorStop(1, 'rgba(6, 8, 18, 0)');
      cCtx.fillStyle = cGrad;
      cCtx.beginPath();
      cCtx.arc(32, 32, 32, 0, Math.PI * 2);
      cCtx.fill();

      const coreTex = new THREE.CanvasTexture(coreCanvas);
      const coreMat = new THREE.SpriteMaterial({
        map: coreTex,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
      });
      const coreSprite = new THREE.Sprite(coreMat);
      coreSprite.scale.set(1.9, 1.9, 1);
      group.add(coreSprite);

      // 4. Disco tenue de partículas orbitales
      const starCount = isUnlocked ? 45 : 15;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const angle = rng() * Math.PI * 2;
        const rad = 0.9 + rng() * 1.4;
        const x = Math.cos(angle) * rad;
        const y = Math.sin(angle) * (rad * 0.45);
        const z = (rng() - 0.5) * 0.35;
        starPos[i * 3] = x;
        starPos[i * 3 + 1] = y;
        starPos[i * 3 + 2] = z;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        size: 0.28,
        map: starTex,
        color: isUnlocked ? 0x8a7fb8 : 0x2e2c3d,
        transparent: true,
        opacity: isUnlocked ? 0.55 : 0.18,
        depthWrite: false
      });
      group.add(new THREE.Points(starGeo, starMat));

    } else {
      // Nebulosas procedurales: Primer cielo, Zodiaco, Cielo de invierno
      const nebTex = getNebulaTexture();
      const starTex = getStarTexture();

      const cloudCount = isUnlocked ? 12 : 5;
      const palette = isUnlocked ? regConfig.colorUnlocked : regConfig.colorLocked;

      // 1. Sprites volumétricos suaves con NormalBlending para evitar quemar luz
      for (let i = 0; i < cloudCount; i++) {
        const col = palette[Math.floor(rng() * (palette.length - 1))];
        const op = isUnlocked ? (0.07 + rng() * 0.08) : (0.02 + rng() * 0.03);

        const sMat = new THREE.SpriteMaterial({
          map: nebTex,
          color: col,
          transparent: true,
          opacity: op,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(sMat);

        let ox, oy, oz, scaleX, scaleY;
        if (regConfig.type === 'nebula-gold-belt') {
          // Estructura alargada para Zodiaco
          const t = (rng() - 0.5) * 4.2;
          const normalOffset = (rng() - 0.5) * 1.4;
          ox = t * 0.94 - normalOffset * 0.34;
          oy = t * 0.34 + normalOffset * 0.94;
          oz = (rng() - 0.5) * 0.6;
          scaleX = 2.2 + rng() * 1.4;
          scaleY = 1.8 + rng() * 1.1;
        } else {
          // Distribución radial / orgánica calibrada a 20-30% de pantalla
          const angle = rng() * Math.PI * 2;
          const rad = rng() * 1.35;
          ox = Math.cos(angle) * rad;
          oy = Math.sin(angle) * rad;
          oz = (rng() - 0.5) * 0.5;
          scaleX = 2.4 + rng() * 1.3;
          scaleY = 2.4 + rng() * 1.3;
        }

        sprite.position.set(ox, oy, oz);
        sprite.scale.set(scaleX, scaleY, 1);
        group.add(sprite);
      }

      // 2. Núcleo difuso suave (suave y atmosférico)
      const coreMat = new THREE.SpriteMaterial({
        map: nebTex,
        color: palette[palette.length - 1],
        transparent: true,
        opacity: isUnlocked ? 0.15 : 0.04,
        depthWrite: false
      });
      const coreSprite = new THREE.Sprite(coreMat);
      coreSprite.scale.set(2.4, 2.4, 1);
      group.add(coreSprite);

      // 3. Cúmulo de partículas estelares tenues dentro de la nebulosa
      const starCount = isUnlocked ? 48 : 16;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        let sx, sy, sz;
        if (regConfig.type === 'nebula-gold-belt') {
          const t = (rng() - 0.5) * 4.4;
          const normalOffset = (rng() - 0.5) * 1.5;
          sx = t * 0.94 - normalOffset * 0.34;
          sy = t * 0.34 + normalOffset * 0.94;
          sz = (rng() - 0.5) * 0.7;
        } else {
          const angle = rng() * Math.PI * 2;
          const rad = rng() * 1.7;
          sx = Math.cos(angle) * rad;
          sy = Math.sin(angle) * rad;
          sz = (rng() - 0.5) * 0.6;
        }
        starPos[i * 3] = sx;
        starPos[i * 3 + 1] = sy;
        starPos[i * 3 + 2] = sz;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        size: 0.30,
        map: starTex,
        color: isUnlocked ? 0xffffff : 0x3d4856,
        transparent: true,
        opacity: isUnlocked ? 0.58 : 0.18,
        depthWrite: false
      });
      group.add(new THREE.Points(starGeo, starMat));
    }

    // Hitbox invisible para clic/tap reactivo bien delimitado
    const hitGeo = new THREE.SphereGeometry(2.5, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.userData = { type: 'region', regionId: regConfig.id, name: regConfig.name, isUnlocked };
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

      if (tempProjectVec.z > 1.0) {
        item.element.style.display = 'none';
        return;
      }

      let screenX = (tempProjectVec.x * 0.5 + 0.5) * width;
      let screenY = (-tempProjectVec.y * 0.5 + 0.5) * height;

      // Margen horizontal de seguridad moderado sin forzar el badge hacia el centro
      const marginX = 24;
      screenX = Math.max(marginX, Math.min(width - marginX, screenX));

      // Margen vertical de seguridad (debajo de UNIVERSO y encima de la toolbar inferior)
      const minTop = 56;
      const maxTop = height - 72;
      screenY = Math.max(minTop, Math.min(maxTop, screenY + (item.isRegion ? 36 : 14)));

      item.element.style.display = 'flex';
      item.element.style.left = `${Math.round(screenX)}px`;
      item.element.style.top = `${Math.round(screenY)}px`;
    });
  }

  function renderUniverseScene(sceneInstance) {
    if (!sceneInstance) return;

    if (constellationsGroup) {
      sceneInstance.remove(constellationsGroup);
    }
    if (regionsGroup) {
      sceneInstance.remove(regionsGroup);
    }
    sceneInstance.clearInteractiveObjects();

    labelsContainer = document.getElementById('universeLabelsLayer');
    if (labelsContainer) {
      labelsContainer.innerHTML = '';
    }
    labelsList = [];

    // Permitir navegación libre y controlada en el Universo general
    sceneInstance.setPanZoomEnabled(true);

    const d = (typeof load === 'function') ? load() : {};

    // 1. Renderizar Grandes Formaciones Cósmicas 3D de las 4 Regiones
    regionsGroup = new THREE.Group();
    REGIONS_CONFIG.forEach(reg => {
      const isUnlocked = (d.unlockedRegions && d.unlockedRegions.includes(reg.id)) || reg.id === 'cielo-1';
      const { group, hitMesh, worldPos } = buildRegionMesh(reg, isUnlocked);
      regionsGroup.add(group);
      sceneInstance.registerInteractiveObject(hitMesh);

      // Label discreto HTML proyectado de la región (debajo de la formación)
      if (labelsContainer) {
        const badgeEl = document.createElement('div');
        badgeEl.className = `universe-3d-region-badge ${isUnlocked ? 'unlocked' : 'locked'}`;

        const lockSvg = `<svg class="icon" viewBox="0 0 24 24" style="width:11px; height:11px; stroke:currentColor; stroke-width:2; vertical-align:-1px; margin-right:3px;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

        badgeEl.innerHTML = `${!isUnlocked ? lockSvg : ''}${reg.name} · ${reg.roman}`;
        labelsContainer.appendChild(badgeEl);

        labelsList.push({
          id: `region-${reg.id}`,
          worldPos: worldPos.clone(),
          element: badgeEl,
          isRegion: true
        });
      }
    });
    sceneInstance.add(regionsGroup);

    // 2. En vista general (focusedRegionId === null), las constelaciones se mantienen ocultas
    if (typeof constellationDefs !== 'undefined') {
      constellationsGroup = new THREE.Group();

      if (focusedRegionId !== null) {
        constellationDefs.forEach(c => {
          const state = getConstellationState(c, d);
          const { group, hitMesh, worldPos } = buildConstellationMesh(c, state);
          constellationsGroup.add(group);
          sceneInstance.registerInteractiveObject(hitMesh);

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
              element: labelEl,
              isRegion: false
            });
          }
        });
      }

      sceneInstance.add(constellationsGroup);
    }

    updateLabelsProjection(sceneInstance);
    sceneInstance.invalidate();
  }

  function initUniverse3D() {
    if (!window.Orbit3D) {
      console.warn('[Universe 3D] Motor Orbit3D no disponible.');
      return;
    }

    if (isInitialized && universeScene) {
      universeScene.resume();
      renderUniverseScene(universeScene);
      return;
    }

    universeScene = Orbit3D.createScene({
      containerId: 'universeHeroScene',
      canvasId: 'universeCanvas',
      fallbackId: 'universeFallbackMessage',
      enablePanZoom: true, // Exploración libre de las regiones
      camera: {
        type: 'pan-zoom',
        fov: 45,
        zoomZ: 17.0,
        minZoom: 8.0,
        maxZoom: 24.0,
        panX: 0,
        panY: 0,
        minPanX: -4.5,
        maxPanX: 4.5,
        minPanY: -5.0,
        maxPanY: 5.0
      },
      onRender: function() {
        updateLabelsProjection(universeScene);
      },
      onObjectClick: function(hit) {
        if (!hit || !hit.object || !hit.object.userData) return;
        const uData = hit.object.userData;

        if (uData.type === 'region' && uData.regionId) {
          if (typeof verFichaRegion === 'function') {
            verFichaRegion(uData.regionId);
          }
        } else if (uData.type === 'constellation' && uData.constellationId) {
          if (typeof verFichaConstelacion === 'function') {
            verFichaConstelacion(uData.constellationId);
          }
        }
      }
    });

    if (!universeScene.scene) return;

    buildCosmicBackground(universeScene);
    renderUniverseScene(universeScene);

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
      renderUniverseScene(universeScene);
    }
  }

  // Preparación para futura fase de enfoque y viaje de cámara a una región
  function focusRegion(regionId) {
    const reg = REGIONS_CONFIG.find(r => r.id === regionId);
    if (!reg || !universeScene) return;
    if (typeof verFichaRegion === 'function') {
      verFichaRegion(regionId);
    }
  }

  // Exportar API global para integración con Orbit
  window.initUniverse3D = initUniverse3D;
  window.pauseUniverse3D = pauseUniverse3D;
  window.resizeUniverse3D = resizeUniverse3D;
  window.refreshUniverse3D = refreshUniverse3D;
  window.focusRegion = focusRegion;

})();

