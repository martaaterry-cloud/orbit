/**
 * Constellation Utils - Orbit
 * Sistema de normalización, validación geométrica y utilidades para el catálogo de constelaciones.
 * Funciona de forma isomórfica (Navegador y Node.js).
 */

(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ConstellationUtils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // Regiones y colecciones admitidas en Orbit
  const VALID_COLLECTIONS = ['norte', 'zodiaco', 'invierno', 'profundo'];
  const REGION_COLLECTION_MAP = {
    'cielo-1': 'norte',
    'norte': 'norte',
    'zodiaco': 'zodiaco',
    'orion': 'invierno',
    'invierno': 'invierno',
    'profundo': 'profundo'
  };

  /**
   * Normaliza una definición de constelación a partir de formato antiguo o nuevo.
   * Garantiza que el objeto devuelto disponga de:
   * - stars: Array de objetos { id, x, y, name }
   * - pts: Array de coordenadas [x, y] (para retrocompatibilidad directa de render)
   * - edges: Array de pares de índices numéricos [[0, 1], ...]
   * - semanticEdges: Array de pares de IDs [['starA', 'starB'], ...]
   * - collection: clave unificada de región
   * - campos de economía y textos asegurados
   *
   * @param {Object} raw - Definición en formato semántico o numérico
   * @returns {Object} Constelación normalizada y segura
   */
  function normalizeConstellation(raw) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const id = String(raw.id || '').trim();
    const name = String(raw.name || id || 'Sin nombre').trim();
    const rawCol = String(raw.collection || raw.region || raw.sky || 'norte').trim().toLowerCase();
    const collection = REGION_COLLECTION_MAP[rawCol] || 'norte';

    // 1. Normalizar estrellas
    let stars = [];
    let starIdMap = new Map();

    if (Array.isArray(raw.stars) && raw.stars.length > 0) {
      stars = raw.stars.map((s, idx) => {
        if (Array.isArray(s)) {
          const starId = `s${idx}`;
          const starObj = { id: starId, x: Number(s[0]) || 0, y: Number(s[1]) || 0 };
          starIdMap.set(starId, idx);
          starIdMap.set(idx, idx);
          return starObj;
        } else if (s && typeof s === 'object') {
          const starId = s.id ? String(s.id).trim() : `s${idx}`;
          const starObj = {
            id: starId,
            x: Number(s.x !== undefined ? s.x : (s[0] !== undefined ? s[0] : 0)),
            y: Number(s.y !== undefined ? s.y : (s[1] !== undefined ? s[1] : 0)),
            name: s.name ? String(s.name) : undefined,
            mag: s.mag !== undefined ? Number(s.mag) : undefined
          };
          starIdMap.set(starId, idx);
          starIdMap.set(idx, idx);
          return starObj;
        }
        const fallbackId = `s${idx}`;
        starIdMap.set(fallbackId, idx);
        starIdMap.set(idx, idx);
        return { id: fallbackId, x: 0, y: 0 };
      });
    } else if (Array.isArray(raw.pts) && raw.pts.length > 0) {
      stars = raw.pts.map((pt, idx) => {
        const starId = `s${idx}`;
        starIdMap.set(starId, idx);
        starIdMap.set(idx, idx);
        return {
          id: starId,
          x: Array.isArray(pt) ? Number(pt[0]) || 0 : Number(pt.x) || 0,
          y: Array.isArray(pt) ? Number(pt[1]) || 0 : Number(pt.y) || 0
        };
      });
    }

    // pts en formato numérico [x, y] para renderizadores SVG
    const pts = stars.map(s => [s.x, s.y]);

    // 2. Normalizar aristas (edges) tanto numéricas como semánticas
    const indexEdges = [];
    const semanticEdges = [];
    const seenEdgeKeys = new Set();

    if (Array.isArray(raw.edges)) {
      raw.edges.forEach(edge => {
        if (!Array.isArray(edge) || edge.length < 2) return;
        const [aRaw, bRaw] = edge;

        let idxA = typeof aRaw === 'number' ? aRaw : starIdMap.get(String(aRaw));
        let idxB = typeof bRaw === 'number' ? bRaw : starIdMap.get(String(bRaw));

        // Si no se encuentra como ID exacto pero aRaw es numérico como string
        if (idxA === undefined && !isNaN(Number(aRaw))) idxA = Number(aRaw);
        if (idxB === undefined && !isNaN(Number(bRaw))) idxB = Number(bRaw);

        if (idxA !== undefined && idxB !== undefined && idxA >= 0 && idxA < stars.length && idxB >= 0 && idxB < stars.length) {
          if (idxA === idxB) return; // evitar auto-bucles
          const minIdx = Math.min(idxA, idxB);
          const maxIdx = Math.max(idxA, idxB);
          const edgeKey = `${minIdx}-${maxIdx}`;

          if (!seenEdgeKeys.has(edgeKey)) {
            seenEdgeKeys.add(edgeKey);
            indexEdges.push([idxA, idxB]);
            const idA = stars[idxA].id || `s${idxA}`;
            const idB = stars[idxB].id || `s${idxB}`;
            semanticEdges.push([idA, idB]);
          }
        }
      });
    }

    // 3. Economía y metadatos
    const need = typeof raw.need === 'number' ? raw.need : 10;
    const cost = typeof raw.cost === 'number' ? raw.cost : 1;
    const desc = raw.desc ? String(raw.desc) : '';
    const myth = raw.myth ? String(raw.myth) : '';
    const extra = raw.extra ? String(raw.extra) : undefined;

    // 4. Layout en Universo
    const x = typeof raw.x === 'number' ? raw.x : 50;
    const y = typeof raw.y === 'number' ? raw.y : 50;
    const size = typeof raw.size === 'number' ? raw.size : 120;
    const rot = typeof raw.rot === 'number' ? raw.rot : 0;

    return {
      id,
      name,
      collection,
      stars,
      pts,
      edges: indexEdges,
      semanticEdges,
      need,
      cost,
      desc,
      myth,
      x,
      y,
      size,
      rot,
      ...(extra ? { extra } : {})
    };
  }

  /**
   * Valida una definición individual de constelación.
   * @param {Object} raw - Constelación
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  function validateConstellation(raw) {
    const errors = [];
    const warnings = [];

    if (!raw || typeof raw !== 'object') {
      return { valid: false, errors: ['La constelación debe ser un objeto no nulo.'], warnings };
    }

    // 1. Validar ID
    if (!raw.id || typeof raw.id !== 'string' || !raw.id.trim()) {
      errors.push('Falta el campo obligatorio "id" o no es un string válido.');
    } else if (!/^[a-z0-9-_]+$/i.test(raw.id.trim())) {
      warnings.push(`El id "${raw.id}" contiene caracteres poco recomendados (usa letras minúsculas, números y guiones).`);
    }

    // 2. Validar Nombre
    if (!raw.name || typeof raw.name !== 'string' || !raw.name.trim()) {
      errors.push(`[${raw.id || 'sin-id'}] Falta el campo "name".`);
    }

    // 3. Validar Colección/Región
    const col = raw.collection || raw.region || raw.sky;
    if (!col || !REGION_COLLECTION_MAP[String(col).toLowerCase()]) {
      errors.push(`[${raw.id}] Colección "${col}" inválida. Permitidas: ${VALID_COLLECTIONS.join(', ')} o alias de región.`);
    }

    // 4. Validar Estrellas
    const hasStars = Array.isArray(raw.stars) && raw.stars.length > 0;
    const hasPts = Array.isArray(raw.pts) && raw.pts.length > 0;

    if (!hasStars && !hasPts) {
      errors.push(`[${raw.id}] La constelación no tiene estrellas definidas ("stars" o "pts").`);
      return { valid: errors.length === 0, errors, warnings };
    }

    const starList = hasStars ? raw.stars : raw.pts;
    const starIds = new Set();

    starList.forEach((s, idx) => {
      let sx, sy, sid;
      if (Array.isArray(s)) {
        sx = s[0];
        sy = s[1];
        sid = `s${idx}`;
      } else if (s && typeof s === 'object') {
        sx = s.x !== undefined ? s.x : s[0];
        sy = s.y !== undefined ? s.y : s[1];
        sid = s.id !== undefined ? String(s.id).trim() : `s${idx}`;
      } else {
        errors.push(`[${raw.id}] Estrella en índice ${idx} tiene un formato inválido.`);
        return;
      }

      if (typeof sx !== 'number' || isNaN(sx) || typeof sy !== 'number' || isNaN(sy)) {
        errors.push(`[${raw.id}] Estrella "${sid}" (índice ${idx}) tiene coordenadas no numéricas o NaN: x=${sx}, y=${sy}.`);
      } else {
        if (sx < 0 || sx > 100 || sy < 0 || sy > 100) {
          warnings.push(`[${raw.id}] Estrella "${sid}" tiene coordenadas fuera del rango estándar [0, 100]: (${sx}, ${sy}).`);
        }
      }

      if (starIds.has(sid)) {
        errors.push(`[${raw.id}] ID de estrella duplicado: "${sid}".`);
      }
      starIds.add(sid);
    });

    // 5. Validar Aristas (Edges)
    if (!Array.isArray(raw.edges) || raw.edges.length === 0) {
      warnings.push(`[${raw.id}] La constelación no tiene aristas ("edges") definidas.`);
    } else {
      const seenEdges = new Set();
      raw.edges.forEach((edge, eIdx) => {
        if (!Array.isArray(edge) || edge.length < 2) {
          errors.push(`[${raw.id}] Arista en índice ${eIdx} no es un par válido: ${JSON.stringify(edge)}.`);
          return;
        }

        const [a, b] = edge;

        // Comprobar existencia
        let aExists = false;
        let bExists = false;

        if (typeof a === 'number') {
          aExists = a >= 0 && a < starList.length;
        } else {
          aExists = starIds.has(String(a));
        }

        if (typeof b === 'number') {
          bExists = b >= 0 && b < starList.length;
        } else {
          bExists = starIds.has(String(b));
        }

        if (!aExists) {
          errors.push(`[${raw.id}] Arista ${eIdx} referencia estrella de inicio inexistente: ${JSON.stringify(a)}.`);
        }
        if (!bExists) {
          errors.push(`[${raw.id}] Arista ${eIdx} referencia estrella de fin inexistente: ${JSON.stringify(b)}.`);
        }

        if (a === b) {
          errors.push(`[${raw.id}] Arista ${eIdx} es un auto-bucle con la misma estrella: ${JSON.stringify(a)}.`);
        }

        // Comprobar duplicadas
        const normKey = [String(a), String(b)].sort().join('<->');
        if (seenEdges.has(normKey)) {
          warnings.push(`[${raw.id}] Arista duplicada entre ${a} y ${b}.`);
        }
        seenEdges.add(normKey);
      });
    }

    // 6. Validar Economía
    if (raw.need === undefined || typeof raw.need !== 'number' || isNaN(raw.need) || raw.need < 0) {
      warnings.push(`[${raw.id}] Requisito "need" ausente o no numérico (se asignará default).`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Valida un catálogo completo de constelaciones.
   * @param {Array} catalog - Lista de constelaciones
   * @returns {{ valid: boolean, total: number, countsByRegion: Object, errors: string[], warnings: string[] }}
   */
  function validateConstellationCatalog(catalog) {
    const errors = [];
    const warnings = [];
    const countsByRegion = { norte: 0, zodiaco: 0, invierno: 0, profundo: 0 };
    const seenIds = new Set();

    if (!Array.isArray(catalog)) {
      return {
        valid: false,
        total: 0,
        countsByRegion,
        errors: ['El catálogo debe ser un Array.'],
        warnings
      };
    }

    catalog.forEach((item, idx) => {
      if (!item) {
        errors.push(`Elemento en índice ${idx} es nulo o indefinido.`);
        return;
      }

      if (item.id) {
        if (seenIds.has(item.id)) {
          errors.push(`ID de constelación duplicado en catálogo: "${item.id}".`);
        }
        seenIds.add(item.id);
      }

      const res = validateConstellation(item);
      if (!res.valid) {
        errors.push(...res.errors);
      }
      if (res.warnings.length > 0) {
        warnings.push(...res.warnings);
      }

      const norm = normalizeConstellation(item);
      if (norm && norm.collection && countsByRegion[norm.collection] !== undefined) {
        countsByRegion[norm.collection]++;
      }
    });

    return {
      valid: errors.length === 0,
      total: catalog.length,
      countsByRegion,
      errors,
      warnings
    };
  }

  return {
    VALID_COLLECTIONS,
    REGION_COLLECTION_MAP,
    normalizeConstellation,
    validateConstellation,
    validateConstellationCatalog
  };
}));
