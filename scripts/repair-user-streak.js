/**
 * Script de Reparación Idempotente de Racha e Historial de Estrellas
 *
 * Propósito: Restaurar la racha real histórica y reconstruir pointAwards, wallet y lifetimeStars
 * sin boosters retroactivos, garantizando idempotencia total y creando un backup de seguridad previo.
 *
 * Configuración histórica verificada:
 * - Inicio real: 20/08/2026 10:50:00 Europe/Madrid (CEST / UTC+2)
 * - Timestamp exacto (ms): 1787215800000 (ISO: 2026-08-20T08:50:00.000Z)
 */

const HOUR = 3600000;
const REAL_STREAK_START_TS = 1787215800000; // 20/08/2026 10:50:00 CEST

const MILESTONES_CONFIG = [
  { ms: 2 * HOUR, pts: 0.2, key: '2h', label: '2 h' },
  { ms: 4 * HOUR, pts: 0.3, key: '4h', label: '4 h' },
  { ms: 8 * HOUR, pts: 0.5, key: '8h', label: '8 h' },
  { ms: 12 * HOUR, pts: 0.5, key: '12h', label: '12 h' },
  { ms: 24 * HOUR, pts: 1.0, key: '24h', label: '24 h' },
  { ms: 48 * HOUR, pts: 1.5, key: '48h', label: '48 h' },
  { ms: 72 * HOUR, pts: 2.0, key: '72h', label: '3 días' },
  { ms: 96 * HOUR, pts: 1.0, key: '96h', label: '4 días' },
  { ms: 120 * HOUR, pts: 1.2, key: '120h', label: '5 días' },
  { ms: 144 * HOUR, pts: 1.5, key: '144h', label: '6 días' },
  { ms: 168 * HOUR, pts: 3.0, key: '168h', label: '7 días' }
];

function getDayKeyFromTs(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Función pura que repara y devuelve un objeto de datos de Orbit coherente e idempotente.
 * @param {Object} currentData - Objeto orbitV9 actual.
 * @param {number} [targetNow] - Timestamp de referencia (por defecto Date.now()).
 * @returns {{ repairedData: Object, report: Object }}
 */
function repairOrbitData(currentData, targetNow = Date.now()) {
  if (!currentData || typeof currentData !== 'object') {
    throw new Error('El objeto de datos proporcionado no es válido');
  }

  // Clon profundo para no mutar el original en caso de error
  const data = JSON.parse(JSON.stringify(currentData));

  // 1. Validar / inicializar estructuras base
  if (!data.returnToMe) data.returnToMe = {};
  if (!data.pointAwards || typeof data.pointAwards !== 'object') data.pointAwards = {};

  const since = REAL_STREAK_START_TS;
  const elapsed = Math.max(0, targetNow - since);

  // 2. Determinar hitos alcanzados según el tiempo transcurrido real
  const reachedMilestones = [];
  const expectedStreakEvents = [];
  let totalStreakPts = 0;

  MILESTONES_CONFIG.forEach(m => {
    if (elapsed >= m.ms) {
      reachedMilestones.push(m.key);
      const eventTs = since + m.ms;
      const dKey = getDayKeyFromTs(eventTs);
      totalStreakPts = Math.round((totalStreakPts + m.pts) * 100) / 100;
      expectedStreakEvents.push({
        ts: eventTs,
        amount: m.pts,
        kind: 'racha',
        label: 'Volver a mí · ' + (m.label || m.key),
        key: m.key,
        dayKey: dKey,
        refId: null
      });
    }
  });

  // 3. Limpiar eventos de racha existentes en pointAwards para evitar duplicidades
  Object.keys(data.pointAwards).forEach(dk => {
    const dayObj = data.pointAwards[dk];
    if (dayObj && Array.isArray(dayObj.events)) {
      dayObj.events = dayObj.events.filter(e => e && e.kind !== 'racha');
    }
  });

  // 4. Inyectar cada hito en su fecha y hora histórica exacta
  expectedStreakEvents.forEach(ev => {
    const dk = ev.dayKey;
    if (!data.pointAwards[dk]) {
      data.pointAwards[dk] = { limits: {}, actions: {}, events: [] };
    }
    if (!Array.isArray(data.pointAwards[dk].events)) {
      data.pointAwards[dk].events = [];
    }

    data.pointAwards[dk].events.push({
      ts: ev.ts,
      amount: ev.amount,
      kind: 'racha',
      label: ev.label,
      refId: null
    });

    // Ordenar cronológicamente los eventos del día
    data.pointAwards[dk].events.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  });

  // 5. Actualizar estado de racha
  data.returnToMe.since = since;
  data.returnToMe.awardedMilestones = reachedMilestones;
  data.returnToMe.best = Math.max(Number(data.returnToMe.best || 0), elapsed);
  data.best = Math.max(Number(data.best || 0), data.returnToMe.best);

  // 6. Recalcular coherencia total de estrellas (lifetimeStars, wallet, bank)
  let totalLifetimeFromEvents = 0;
  Object.keys(data.pointAwards).forEach(dk => {
    const dayObj = data.pointAwards[dk];
    if (dayObj && Array.isArray(dayObj.events)) {
      dayObj.events.forEach(e => {
        totalLifetimeFromEvents = Math.round((totalLifetimeFromEvents + Number(e.amount || 0)) * 100) / 100;
      });
    }
  });

  // Calcular gasto previo de recompensas para mantener coherentemente la cartera
  const priorLifetime = Number(data.lifetimeStars || 0);
  const priorWallet = Number(data.wallet || 0);
  const spentAmount = Math.max(0, Math.round((priorLifetime - priorWallet) * 100) / 100);

  data.lifetimeStars = totalLifetimeFromEvents;
  data.wallet = Math.max(0, Math.round((totalLifetimeFromEvents - spentAmount) * 100) / 100);
  data.bank = data.wallet;

  const report = {
    streakSince: new Date(since).toISOString(),
    streakSinceMadrid: new Date(since).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
    elapsedHours: (elapsed / HOUR).toFixed(2),
    reachedMilestones,
    streakStarsAdded: totalStreakPts,
    totalLifetimeStars: data.lifetimeStars,
    walletStars: data.wallet,
    eventsByDay: {}
  };

  expectedStreakEvents.forEach(ev => {
    if (!report.eventsByDay[ev.dayKey]) report.eventsByDay[ev.dayKey] = [];
    report.eventsByDay[ev.dayKey].push({
      milestone: ev.key,
      amount: ev.amount,
      madridTime: new Date(ev.ts).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
    });
  });

  return { repairedData: data, report };
}

/**
 * Ejecutor en navegador: Realiza backup en localStorage, aplica la reparación y actualiza la UI y Supabase.
 */
async function executeBrowserRepair(userId = '79a26438-5c26-4b94-a6ca-52eed6ccb988') {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.error('Este método debe ejecutarse en el entorno de navegador de Orbit.');
    return;
  }

  const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', userId) : `orbitV9:${userId}`;
  const rawCurrent = localStorage.getItem(v9Key) || localStorage.getItem('orbitV9');

  let currentData = null;
  try {
    if (rawCurrent) currentData = JSON.parse(rawCurrent);
  } catch (e) {}

  if (!currentData && typeof load === 'function') {
    currentData = load(userId);
  }

  if (!currentData) {
    console.error('No se pudo encontrar el estado actual de Orbit.');
    return;
  }

  // 1. BACKUP DE SEGURIDAD
  const backupKey = `orbit_backup_pre_repair_${userId}_${Date.now()}`;
  localStorage.setItem(backupKey, JSON.stringify(currentData));
  console.log(`[1/4] Backup local creado con clave: ${backupKey}`);

  // 2. REPARACIÓN
  const { repairedData, report } = repairOrbitData(currentData);
  console.log('[2/4] Datos reparados con éxito. Informe de racha:', report);

  // 3. GUARDADO LOCAL
  localStorage.setItem(v9Key, JSON.stringify(repairedData));
  const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', userId) : `orbitLocalUpdatedAt:${userId}`;
  const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', userId) : `orbitHasUnsyncedChanges:${userId}`;
  const nowIso = new Date().toISOString();
  localStorage.setItem(localUpKey, nowIso);
  localStorage.setItem(unsyncKey, 'true');

  // 4. SINCRONIZACIÓN CON SUPABASE SI ESTÁ DISPONIBLE
  const sb = typeof getSupabase === 'function' ? getSupabase() : null;
  if (sb) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user && session.user.id === userId) {
        console.log('[3/4] Subiendo estado reparado a Supabase orbit_state…');
        const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', userId) : `orbitTimer:${userId}`;
        let timerData = null;
        try { timerData = JSON.parse(localStorage.getItem(timerKey)); } catch(e){}

        const { error: sbErr } = await sb.from('orbit_state').upsert({
          user_id: userId,
          orbit_data: repairedData,
          orbit_timer: timerData,
          updated_at: nowIso
        }, { onConflict: 'user_id' });

        if (sbErr) {
          console.warn('[AVISO] No se pudo guardar en Supabase inmediatamente:', sbErr.message);
        } else {
          const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', userId) : `orbitLastCloudUpdatedAt:${userId}`;
          localStorage.setItem(cloudUpKey, nowIso);
          localStorage.setItem(unsyncKey, 'false');
          console.log('[4/4] Sincronización en Supabase confirmada.');
        }
      }
    } catch (err) {
      console.warn('[AVISO] Error al intentar sync con Supabase:', err);
    }
  }

  // 5. ACTUALIZAR VISTAS
  if (typeof render === 'function') render();
  if (typeof renderArchive === 'function') renderArchive();
  if (typeof toast === 'function') toast('✦ Racha histórica y estrellas restauradas');

  return { success: true, report, backupKey };
}

if (typeof window !== 'undefined') {
  window.repairOrbitStreak = executeBrowserRepair;
  window.repairOrbitData = repairOrbitData;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REAL_STREAK_START_TS,
    MILESTONES_CONFIG,
    getDayKeyFromTs,
    repairOrbitData,
    executeBrowserRepair
  };
}
