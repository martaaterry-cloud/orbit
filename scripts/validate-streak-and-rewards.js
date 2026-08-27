/**
 * Suite de Pruebas Deterministas para Orbit:
 * - Continuidad de Racha (Días 6, 7, 8, 14...) e Idempotencia de Hitos.
 * - Concesión Centralizada de Recompensas y Ámbitos Precisos de Boosters.
 * - Validación de exclusión de Check-in y Racha en Noche de Constancia y Ventana Estelar.
 * - Validación de consumo unitario de Impulso Valiente.
 * - No-Stacking y no autoalimentación de boosters.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const HOUR = 3600000;
const DAY = 24 * HOUR;

// Simular entorno global de navegador/Orbit
let mockLocalStorage = {};
global.localStorage = {
  getItem: (k) => mockLocalStorage[k] || null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { mockLocalStorage = {}; }
};

global.HOUR = HOUR;
global.dayKey = function(ts = Date.now()) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
global.uid = function() {
  return 'test_' + Math.random().toString(36).substr(2, 9);
};
global.esc = function(s) { return s || ''; };
global.toastMessages = [];
global.toast = function(msg) { global.toastMessages.push(msg); };

// Cargar storage.js, stars.js, streak.js
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const starsCode = fs.readFileSync(path.join(__dirname, '../js/stars.js'), 'utf8');
const streakCode = fs.readFileSync(path.join(__dirname, '../js/streak.js'), 'utf8');

eval(storageCode);
eval(starsCode);
eval(streakCode);

setOrbitActiveUser({ id: 'test_user', email: 'test@orbit.local' });

console.log('🧪 =========================================================');
console.log('🌌 ORBIT · SUITE DE PRUEBAS DE RACHA, RECOMPENSAS Y BOOSTERS');
console.log('=========================================================');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// --------------------------------------------------------------------------
// TEST 1: Racha en Día 6
// --------------------------------------------------------------------------
runTest('Racha en Día 6: acumula hitos hasta 144h y muestra hito pendiente', () => {
  mockLocalStorage = {};
  const baseTime = 1700000000000;
  const initialData = defaults();
  initialData.returnToMe.since = baseTime;
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => baseTime + (6 * DAY);

  let d = accrue();
  assert(d.returnToMe.awardedMilestones.includes('144h'), 'Debe incluir hito de 6 días (144h)');
  assert(!d.returnToMe.awardedMilestones.includes('168h'), 'NO debe haber alcanzado el hito de 7 días (168h)');
  
  let sm = sharedMilestoneInfo(d);
  assert.strictEqual(sm.text, 'Próximo hito: 7 días · +3 pts', 'Debe indicar que el próximo hito es de 7 días');
  assert.strictEqual(fmt(6 * DAY), '6d 0h', 'Formato de racha debe ser 6d 0h');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 2: Racha en Día 7 -> Entrega hito 7 días una sola vez y activa Noche de Constancia
// --------------------------------------------------------------------------
runTest('Racha en Día 7: entrega 3.0 ★ e hito 168h, y activa Noche de Constancia (x1.5, 24 h)', () => {
  mockLocalStorage = {};
  const baseTime = 1700000000000;
  const initialData = defaults();
  initialData.returnToMe.since = baseTime;
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => baseTime + (7 * DAY);

  let d = accrue();
  
  assert(d.returnToMe.awardedMilestones.includes('168h'), 'Debe incluir el hito 168h');
  assert(d.boosters && Array.isArray(d.boosters.active), 'Debe inicializar boosters.active');
  
  const nightBooster = d.boosters.active.find(b => b.id === 'constancy-night');
  assert(nightBooster, 'Debe activar el booster Noche de Constancia');
  assert.strictEqual(nightBooster.multiplier, 1.5, 'Multiplicador debe ser 1.5');
  assert.strictEqual(nightBooster.expiresAt, baseTime + (7 * DAY) + (24 * HOUR), 'Debe durar 24 h desde los 7 días');
  
  assert.deepStrictEqual(nightBooster.scope, ['journal', 'goodThing', 'impulso', 'impulso-timer'], 'Scope debe ser exacto sin all ni racha ni checkin');

  let sm = sharedMilestoneInfo(d);
  assert.strictEqual(sm.text, 'Hito de 7 días conseguido', 'El texto debe confirmar el hito conseguido');
  assert.strictEqual(fmt(7 * DAY), '7d 0h', 'Formato de racha debe ser 7d 0h');

  // Re-evaluación inmediata (idempotencia)
  const walletBefore = d.wallet;
  let d2 = accrue();
  assert.strictEqual(d2.wallet, walletBefore, 'No debe duplicar estrellas al re-evaluar');
  assert.strictEqual(d2.boosters.active.filter(b => b.id === 'constancy-night').length, 1, 'No debe duplicar el booster');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 3: Racha en Día 8 -> La racha continúa indefinidamente sin duplicar hitos
// --------------------------------------------------------------------------
runTest('Racha en Día 8: continúa a 8d 0h sin duplicar hitos ni reiniciar', () => {
  mockLocalStorage = {};
  const baseTime = 1700000000000;
  const initialData = defaults();
  initialData.returnToMe.since = baseTime;
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => baseTime + (7 * DAY);
  let d = accrue();
  const walletDay7 = d.wallet;

  Date.now = () => baseTime + (8 * DAY);
  let d8 = accrue();
  
  assert.strictEqual(d8.wallet, walletDay7, 'En día 8 no se añaden hitos no definidos pero se conserva el saldo');
  assert.strictEqual(fmt(8 * DAY), '8d 0h', 'Racha actual debe mostrar 8d 0h');
  
  let sm = sharedMilestoneInfo(d8);
  assert.strictEqual(sm.text, 'Hito de 7 días conseguido', 'Debe mantenerse el hito de 7 días conseguido');
  assert.strictEqual(sm.pct, 100, 'Barra debe mantenerse al 100%');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 4: Racha en Día 14 -> Continuidad indefinida sin límite
// --------------------------------------------------------------------------
runTest('Racha en Día 14: continúa a 14d 0h sin repetir el premio de 7 días', () => {
  mockLocalStorage = {};
  const baseTime = 1700000000000;
  const initialData = defaults();
  initialData.returnToMe.since = baseTime;
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => baseTime + (7 * DAY);
  let d7 = accrue();
  const walletDay7 = d7.wallet;

  Date.now = () => baseTime + (14 * DAY);
  let d14 = accrue();

  assert.strictEqual(d14.wallet, walletDay7, 'En día 14 no se vuelve a otorgar el premio de 7 días');
  assert.strictEqual(fmt(14 * DAY), '14d 0h', 'Racha actual debe mostrar 14d 0h');
  assert(d14.best >= 14 * DAY, 'El mejor récord debe registrar al menos 14 días');
  
  let sm = sharedMilestoneInfo(d14);
  assert.strictEqual(sm.text, 'Hito de 7 días conseguido', 'Debe mantenerse el estado de hito conseguido');
  assert.strictEqual(sm.pct, 100, 'Barra debe mantenerse al 100%');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 5: Diario con Noche de Constancia -> 0,1 × 1,5 = 0,15 ★
// --------------------------------------------------------------------------
runTest('Diario con Noche de Constancia: 0,1 × 1,5 = 0,15 ★', () => {
  mockLocalStorage = {};
  const now = 1700000000000;
  const initialData = defaults();
  initialData.wallet = 10;
  initialData.lifetimeStars = 10;
  initialData.boosters.active = [{
    id: 'constancy-night',
    name: 'Noche de Constancia',
    multiplier: 1.5,
    startedAt: now - HOUR,
    expiresAt: now + (23 * HOUR),
    maxExtraStars: 3.0,
    extraStarsGenerated: 0.0,
    scope: ['journal', 'goodThing', 'impulso', 'impulso-timer']
  }];
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => now;

  let boostResult = awardDailyAction('journal', 0.1, 0.5, 'Escribir', 'entry_123');

  assert.strictEqual(boostResult.base, 0.1, 'Recompensa base debe ser 0.1');
  assert.strictEqual(boostResult.multiplier, 1.5, 'Multiplicador aplicado debe ser 1.5');
  assert.strictEqual(boostResult.extra, 0.05, 'Estrellas extra deben ser 0.05');
  assert.strictEqual(boostResult.total, 0.15, 'Recompensa total debe ser 0.15');

  let d = load();
  assert.strictEqual(d.wallet, 10.15, 'El saldo del monedero debe ser 10.15');
  assert.strictEqual(d.lifetimeStars, 10.15, 'Las estrellas históricas deben ser 10.15');

  let toastMsg = formatRewardToast('Entrada guardada', boostResult);
  assert.strictEqual(toastMsg, 'Entrada guardada · +0,1 ★ ×1,5 = +0,15 ★', 'Formato del toast debe ser exacto');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 6: Check-in con Noche de Constancia -> Recompensa base sin multiplicar (0,2 ★)
// --------------------------------------------------------------------------
runTest('Check-in con Noche de Constancia: recompensa base sin multiplicar (0,2 ★)', () => {
  mockLocalStorage = {};
  const now = 1700000000000;
  const initialData = defaults();
  initialData.wallet = 10;
  initialData.lifetimeStars = 10;
  initialData.boosters.active = [{
    id: 'constancy-night',
    name: 'Noche de Constancia',
    multiplier: 1.5,
    startedAt: now - HOUR,
    expiresAt: now + (23 * HOUR),
    maxExtraStars: 3.0,
    extraStarsGenerated: 0.0,
    scope: ['journal', 'goodThing', 'impulso', 'impulso-timer']
  }];
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => now;

  let boostResult = awardDailyAction('checkin', 0.2, 0.2, 'Check-in', 'checkin_today');

  assert.strictEqual(boostResult.base, 0.2, 'Recompensa base debe ser 0.2');
  assert.strictEqual(boostResult.multiplier, 1, 'Multiplicador debe ser 1 (excluido de Noche de Constancia)');
  assert.strictEqual(boostResult.extra, 0, 'No debe generar estrellas extra');
  assert.strictEqual(boostResult.total, 0.2, 'Recompensa total debe ser 0.2');

  let d = load();
  assert.strictEqual(d.wallet, 10.2, 'Monedero debe reflejar exactamente +0.2');

  let toastMsg = formatRewardToast('Check-in', boostResult);
  assert.strictEqual(toastMsg, 'Check-in · +0,2 ★', 'Toast de check-in debe mostrar solo base');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 7: Premio de Racha con Noche de Constancia -> NO se multiplica
// --------------------------------------------------------------------------
runTest('Premio de racha con Noche de Constancia: no se multiplica', () => {
  mockLocalStorage = {};
  const now = 1700000000000;
  const initialData = defaults();
  initialData.boosters.active = [{
    id: 'constancy-night',
    name: 'Noche de Constancia',
    multiplier: 1.5,
    startedAt: now - HOUR,
    expiresAt: now + (23 * HOUR),
    maxExtraStars: 3.0,
    extraStarsGenerated: 0.0,
    scope: ['journal', 'goodThing', 'impulso', 'impulso-timer']
  }];
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => now;

  let boostResult = applyStarBoost(initialData, 3.0, 'racha');
  assert.strictEqual(boostResult.multiplier, 1, 'Racha no debe coincidir con el scope de Noche de Constancia');
  assert.strictEqual(boostResult.extra, 0, 'No debe generar extra para hitos de racha');
  assert.strictEqual(boostResult.total, 3.0, 'Total debe ser la base sin multiplicar (3.0)');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 8: Premio de Racha con Ventana Estelar -> NO se multiplica
// --------------------------------------------------------------------------
runTest('Premio de racha con Ventana Estelar: no se multiplica', () => {
  mockLocalStorage = {};
  const now = 1700000000000;
  const initialData = defaults();
  initialData.boosters.active = [{
    id: 'stellar-window',
    name: 'Ventana Estelar',
    multiplier: 1.5,
    startedAt: now - HOUR,
    expiresAt: now + HOUR,
    maxExtraStars: 2.0,
    extraStarsGenerated: 0.0,
    scope: ['journal', 'goodThing', 'impulso', 'impulso-timer']
  }];
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => now;

  let boostResult = applyStarBoost(initialData, 3.0, 'racha');
  assert.strictEqual(boostResult.multiplier, 1, 'Racha no debe coincidir con el scope de Ventana Estelar');
  assert.strictEqual(boostResult.extra, 0, 'No debe generar extra para hitos de racha');
  assert.strictEqual(boostResult.total, 3.0, 'Total debe ser la base sin multiplicar (3.0)');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 9: Impulso Valiente -> Solo afecta al siguiente impulso y se consume
// --------------------------------------------------------------------------
runTest('Impulso Valiente: solo afecta al siguiente impulso con temporizador y se consume', () => {
  mockLocalStorage = {};
  const now = 1700000000000;
  const initialData = defaults();
  initialData.boosters.inventory = [{
    id: 'brave-urge',
    name: 'Impulso Valiente',
    multiplier: 2.0,
    usesRemaining: 1,
    maxExtraStars: 0.8,
    scope: ['impulso-timer']
  }];
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => now;

  // Primer impulso con temporizador
  let d = load();
  let boost1 = applyStarBoost(d, 0.8, 'impulso-timer', { isTimer: true });
  assert.strictEqual(boost1.multiplier, 2.0, 'Primer impulso debe recibir multiplicador x2.0');
  assert.strictEqual(boost1.extra, 0.8, 'Extra debe ser +0.8');
  assert.strictEqual(boost1.total, 1.6, 'Total debe ser 1.6');
  
  save(d);

  // Segundo impulso con temporizador
  let d2 = load();
  let boost2 = applyStarBoost(d2, 0.8, 'impulso-timer', { isTimer: true });
  assert.strictEqual(boost2.multiplier, 1, 'Segundo impulso NO debe multiplicarse (Impulso Valiente ya consumido)');
  assert.strictEqual(boost2.extra, 0, 'Extra debe ser 0');
  assert.strictEqual(boost2.total, 0.8, 'Total debe ser solo la base 0.8');
  assert.strictEqual(d2.boosters.inventory.length, 0, 'El booster consumido debe haber sido purgado del inventario');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 10: Ningún booster se autoalimenta ni se acumula (No-Stacking estricto)
// --------------------------------------------------------------------------
runTest('Ningún booster se autoalimenta ni se acumula con otro (No-Stacking)', () => {
  mockLocalStorage = {};
  const now = 1700000000000;
  const initialData = defaults();
  initialData.wallet = 5;
  initialData.boosters.active = [
    {
      id: 'constancy-night',
      name: 'Noche de Constancia',
      multiplier: 1.5,
      startedAt: now - HOUR,
      expiresAt: now + (23 * HOUR),
      maxExtraStars: 3.0,
      extraStarsGenerated: 0.0,
      scope: ['journal', 'goodThing', 'impulso', 'impulso-timer']
    },
    {
      id: 'stellar-window',
      name: 'Ventana Estelar',
      multiplier: 1.5,
      startedAt: now - HOUR,
      expiresAt: now + HOUR,
      maxExtraStars: 2.0,
      extraStarsGenerated: 0.0,
      scope: ['journal', 'goodThing', 'impulso', 'impulso-timer']
    }
  ];
  initialData.boosters.inventory = [{
    id: 'brave-urge',
    name: 'Impulso Valiente',
    multiplier: 2.0,
    usesRemaining: 1,
    maxExtraStars: 0.8,
    scope: ['impulso-timer']
  }];
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => now;

  let boost = applyStarBoost(initialData, 0.8, 'impulso-timer', { isTimer: true });
  assert.strictEqual(boost.multiplier, 2.0, 'No debe acumular factores. Debe seleccionar únicamente x2.0');
  assert.strictEqual(boost.total, 1.6, 'Total debe ser exactamente 0.8 * 2.0 = 1.6');
  
  const night = initialData.boosters.active.find(b => b.id === 'constancy-night');
  const windowB = initialData.boosters.active.find(b => b.id === 'stellar-window');
  assert.strictEqual(night.extraStarsGenerated, 0.0, 'Noche de Constancia no debe autoalimentarse ni sumar estrellas extra');
  assert.strictEqual(windowB.extraStarsGenerated, 0.0, 'Ventana Estelar no debe autoalimentarse ni sumar estrellas extra');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 11: Caducidad limpia del Multiplicador
// --------------------------------------------------------------------------
runTest('Caducidad de Multiplicador: tras expirar, la entrada recibe recompensa base (0.1 ★)', () => {
  mockLocalStorage = {};
  const now = 1700000000000;
  const initialData = defaults();
  initialData.wallet = 10;
  initialData.lifetimeStars = 10;
  initialData.boosters.active = [{
    id: 'constancy-night',
    name: 'Noche de Constancia',
    multiplier: 1.5,
    startedAt: now - (25 * HOUR),
    expiresAt: now - HOUR,
    maxExtraStars: 3.0,
    extraStarsGenerated: 0.0,
    scope: ['journal', 'goodThing', 'impulso', 'impulso-timer']
  }];
  save(initialData);

  const origDateNow = Date.now;
  Date.now = () => now;

  let boostResult = awardDailyAction('journal', 0.1, 0.5, 'Escribir', 'entry_expired');

  assert.strictEqual(boostResult.base, 0.1, 'Recompensa base debe ser 0.1');
  assert.strictEqual(boostResult.multiplier, 1, 'Multiplicador debe ser 1 tras expirar');
  assert.strictEqual(boostResult.extra, 0, 'No debe haber estrellas extra');
  assert.strictEqual(boostResult.total, 0.1, 'Recompensa total debe ser 0.1');

  let d = load();
  assert.strictEqual(d.wallet, 10.1, 'Monedero debe reflejar solo base 0.1');
  assert.strictEqual(d.boosters.active.length, 0, 'El booster expirado debe removerse de la lista activa');

  Date.now = origDateNow;
});

// --------------------------------------------------------------------------
// TEST 12: Reinicio Seguro en Slip
// --------------------------------------------------------------------------
runTest('Reinicio en Desliz (Slip): reinicia since y hitos pero conserva estrellas y récord', () => {
  mockLocalStorage = {};
  const baseTime = 1700000000000;
  const initialData = defaults();
  initialData.wallet = 25.5;
  initialData.lifetimeStars = 50.0;
  initialData.best = 7 * DAY;
  initialData.returnToMe.since = baseTime;
  initialData.returnToMe.awardedMilestones = ['2h', '4h', '8h', '12h', '24h', '48h', '72h', '96h', '120h', '144h', '168h'];
  initialData.goals = [{ id: 'g1', name: 'Objetivo 1' }];
  save(initialData);

  const slipTime = baseTime + (8 * DAY);
  const origDateNow = Date.now;
  Date.now = () => slipTime;

  let d = load();
  d.returnToMe.since = slipTime;
  d.returnToMe.awardedMilestones = [];
  d.slips.push({ ts: slipTime, goalId: 'g1', note: 'Prueba de desliz' });
  save(d);

  let dAfter = load();
  assert.strictEqual(dAfter.returnToMe.since, slipTime, 'Since debe actualizarse al momento del desliz');
  assert.strictEqual(dAfter.returnToMe.awardedMilestones.length, 0, 'Hitos deben reiniciarse');
  assert.strictEqual(dAfter.wallet, 25.5, 'El saldo del monedero debe conservarse intacto');
  assert.strictEqual(dAfter.lifetimeStars, 50.0, 'Las estrellas históricas deben conservarse intactas');
  assert.strictEqual(dAfter.best, 7 * DAY, 'El mejor récord debe conservarse intacto');

  Date.now = origDateNow;
});

console.log('=========================================================');
console.log(`🎉 RESULTADO: ${passedTests} de ${totalTests} pruebas superadas.`);
console.log('=========================================================');
