#!/usr/bin/env node
/**
 * scripts/validate-constellations.js
 * Script de validación geométrica, estructural y económica del catálogo de constelaciones de Orbit.
 * Ejecución: node scripts/validate-constellations.js
 */

const path = require('path');
const ConstellationUtils = require('../js/constellation-utils.js');
const { rawConstellationCatalog, constellationDefs } = require('../data/constellations.js');

console.log('\n🌟 =========================================================');
console.log('🌌 ORBIT · VALIDADOR DE ARQUITECTURA DE CONSTELACIONES');
console.log('=========================================================\n');

let totalErrors = 0;
let totalWarnings = 0;

// 1. Validar el catálogo crudo (raw)
console.log('📋 Validando catálogo original (`rawConstellationCatalog`)...');
const rawResult = ConstellationUtils.validateConstellationCatalog(rawConstellationCatalog);

console.log(`Total constelaciones: ${rawResult.total}`);
console.log('Distribución por región:');
Object.entries(rawResult.countsByRegion).forEach(([region, count]) => {
  console.log(`  • ${region.padEnd(10)}: ${count} constelaciones`);
});

if (rawResult.errors.length > 0) {
  console.error('\n❌ ERRORES EN CATÁLOGO RAW:');
  rawResult.errors.forEach(err => console.error(`  ✖ ${err}`));
  totalErrors += rawResult.errors.length;
}

if (rawResult.warnings.length > 0) {
  console.warn('\n⚠️ ADVERTENCIAS EN CATÁLOGO RAW:');
  rawResult.warnings.forEach(warn => console.warn(`  ▲ ${warn}`));
  totalWarnings += rawResult.warnings.length;
}

// 2. Validar cada constelación normalizada en detalle
console.log('\n🔍 Verificación individual de geometría y aristas normalizadas:');
constellationDefs.forEach((c) => {
  const starCount = c.stars ? c.stars.length : 0;
  const edgeCount = c.edges ? c.edges.length : 0;
  const semanticCount = c.semanticEdges ? c.semanticEdges.length : 0;

  let detailErrors = [];

  // Chequeo de aristas fuera de rango
  c.edges.forEach(([a, b], idx) => {
    if (a < 0 || a >= starCount || b < 0 || b >= starCount) {
      detailErrors.push(`Arista ${idx} con índices fuera de límites: [${a}, ${b}] (total estrellas: ${starCount})`);
    }
  });

  // Chequeo de coordenadas NaN o corruptas
  c.pts.forEach(([x, y], idx) => {
    if (isNaN(x) || isNaN(y)) {
      detailErrors.push(`Coordenada NaN en estrella ${idx}: [${x}, ${y}]`);
    }
  });

  if (detailErrors.length > 0) {
    console.error(`  ❌ [${c.id}] ${c.name} (${c.collection})`);
    detailErrors.forEach(err => console.error(`      ✖ ${err}`));
    totalErrors += detailErrors.length;
  } else {
    console.log(`  ✅ [${c.id.padEnd(14)}] ${c.name.padEnd(14)} | ${c.collection.padEnd(8)} | ${starCount} estrellas | ${edgeCount} aristas | ${c.need} ★ need`);
  }
});

// 3. Resumen final
console.log('\n=========================================================');
if (totalErrors === 0) {
  console.log(`🎉 VALIDACIÓN EXITOSA: 0 errores, ${totalWarnings} advertencias.`);
  console.log('✨ Todas las geometrías, aristas y regiones cumplen el contrato de Orbit.');
  console.log('=========================================================\n');
  process.exit(0);
} else {
  console.error(`💥 FALLO DE VALIDACIÓN: Se encontraron ${totalErrors} errores.`);
  console.log('=========================================================\n');
  process.exit(1);
}
