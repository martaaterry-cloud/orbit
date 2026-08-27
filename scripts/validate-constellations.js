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

// 3. Pruebas de progresión unificada y monotonía para Casiopea y Lira
console.log('\n📊 Verificación de progresión unificada (0%, 25%, 50%, 75%, 100%):');

const testCases = ['cassiopeia', 'lyra'];
const progressSteps = [0.0, 0.25, 0.50, 0.75, 1.0];

testCases.forEach((targetId) => {
  const c = constellationDefs.find(x => x.id === targetId);
  if (!c) {
    console.error(`  ❌ No se encontró la constelación ${targetId}`);
    totalErrors++;
    return;
  }

  console.log(`\n  Constelación: ${c.name} (${c.id}) - ${c.stars.length} estrellas, ${c.edges.length} aristas:`);
  let prevEdgeCount = -1;

  progressSteps.forEach((p) => {
    const res = ConstellationUtils.computeConstellationProgress(c, p);
    const percentStr = `${Math.round(p * 100)}%`.padStart(4);

    // 1. A 0% debe haber 0 aristas ganadas
    if (p === 0.0 && res.activeEdgeCount !== 0) {
      console.error(`    ✖ A 0% se esperaban 0 aristas activas, se obtuvieron ${res.activeEdgeCount}`);
      totalErrors++;
    }

    // 2. A 100% deben aparecer todas las aristas y estrellas
    if (p === 1.0 && (res.activeEdgeCount !== c.edges.length || res.activeNodeIndices.size !== c.stars.length)) {
      console.error(`    ✖ A 100% se esperaban todas las aristas (${c.edges.length}) y estrellas (${c.stars.length}), se obtuvieron ${res.activeEdgeCount} aristas y ${res.activeNodeIndices.size} estrellas`);
      totalErrors++;
    }

    // 3. Monotonía: el número de aristas activas nunca disminuye
    if (res.activeEdgeCount < prevEdgeCount) {
      console.error(`    ✖ Ruptura de monotonía en ${percentStr}: ${res.activeEdgeCount} < ${prevEdgeCount}`);
      totalErrors++;
    }
    prevEdgeCount = res.activeEdgeCount;

    // 4. Casiopea al 75% debe tener exactamente 3 aristas
    if (c.id === 'cassiopeia' && p === 0.75 && res.activeEdgeCount !== 3) {
      console.error(`    ✖ Casiopea al 75% esperaba 3 aristas, obtuvo ${res.activeEdgeCount}`);
      totalErrors++;
    }

    console.log(`    • ${percentStr} -> ${res.activeEdgeCount}/${c.edges.length} aristas | ${res.activeNodeIndices.size}/${c.stars.length} estrellas iluminadas`);
  });

  // 5. Verificación de integridad geométrica específica
  if (c.id === 'cassiopeia') {
    if (c.stars.length !== 5 || c.edges.length !== 4) {
      console.error(`    ✖ Casiopea debe tener exactamente 5 estrellas y 4 aristas`);
      totalErrors++;
    }
    if (c.rot !== -45) {
      console.error(`    ✖ Casiopea esperaba rot: -45 para orientación diagonal, obtuvo rot: ${c.rot}`);
      totalErrors++;
    }
  }

  if (c.id === 'lyra') {
    if (c.stars.length !== 5 || c.edges.length !== 5 || c.rot !== -5) {
      console.error(`    ✖ Lira ha sufrido modificaciones no permitidas`);
      totalErrors++;
    }
  }
});

// 4. Prueba explícita del caso real de usuario para Casiopea (11.3 estrellas)
console.log('\n🎯 Verificación de Caso Real de Usuario: Casiopea con 11.3 estrellas:');
const casiopeaDef = constellationDefs.find(x => x.id === 'cassiopeia');
const prevNeed = 8;
const need = 15;
const lifetimeStars = 11.3;
const localProgress = (lifetimeStars - prevNeed) / (need - prevNeed); // ≈ 0.47142857

const realCaseRes = ConstellationUtils.computeConstellationProgress(casiopeaDef, localProgress);
console.log(`  • Estrellas acumuladas : ${lifetimeStars} ★`);
console.log(`  • Tramo                : [${prevNeed} ★ -> ${need} ★]`);
console.log(`  • Progreso local       : ${(localProgress * 100).toFixed(2)}% (${localProgress.toFixed(6)})`);
console.log(`  • Aristas activas      : ${realCaseRes.activeEdgeCount} de ${casiopeaDef.edges.length}`);
console.log(`  • Estrellas activas    : ${realCaseRes.activeNodeIndices.size} de ${casiopeaDef.stars.length}`);

if (realCaseRes.activeEdgeCount !== 2) {
  console.error(`  ❌ ERROR: Casiopea con 11.3 ★ debía dar exactamente 2 de 4 aristas, pero dio ${realCaseRes.activeEdgeCount}`);
  totalErrors++;
} else {
  console.log(`  ✅ CORRECTO: Casiopea muestra exactamente 2 de 4 aristas (Math.round(0.4714 * 4) = 2)`);
}

// 5. Resumen final
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
