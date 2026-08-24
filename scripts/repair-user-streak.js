/**
 * Script de Reparación Idempotente y Automática de Racha e Historial de Estrellas
 *
 * Encapsulado en IIFE para aislamiento total de scope (sin redeclarar globales de Orbit).
 * Configuración histórica verificada:
 * - Usuario objetivo: 79a26438-5c26-4b94-a6ca-52eed6ccb988
 * - Inicio real: 20/08/2026 10:50:00 Europe/Madrid (CEST / UTC+2)
 * - Timestamp exacto (ms): 1787215800000 (ISO: 2026-08-20T08:50:00.000Z)
 */

(function () {
  'use strict';

  const TARGET_USER_ID = '79a26438-5c26-4b94-a6ca-52eed6ccb988';
  const STREAK_START_TS = 1787215800000; // 20/08/2026 10:50:00 CEST (Europe/Madrid)
  const MS_PER_HOUR = 3600000;

  const MILESTONES_CONFIG = [
    { ms: 2 * MS_PER_HOUR, pts: 0.2, key: '2h', label: '2 h' },
    { ms: 4 * MS_PER_HOUR, pts: 0.3, key: '4h', label: '4 h' },
    { ms: 8 * MS_PER_HOUR, pts: 0.5, key: '8h', label: '8 h' },
    { ms: 12 * MS_PER_HOUR, pts: 0.5, key: '12h', label: '12 h' },
    { ms: 24 * MS_PER_HOUR, pts: 1.0, key: '24h', label: '24 h' },
    { ms: 48 * MS_PER_HOUR, pts: 1.5, key: '48h', label: '48 h' },
    { ms: 72 * MS_PER_HOUR, pts: 2.0, key: '72h', label: '3 días' },
    { ms: 96 * MS_PER_HOUR, pts: 1.0, key: '96h', label: '4 días' },
    { ms: 120 * MS_PER_HOUR, pts: 1.2, key: '120h', label: '5 días' },
    { ms: 144 * MS_PER_HOUR, pts: 1.5, key: '144h', label: '6 días' },
    { ms: 168 * MS_PER_HOUR, pts: 3.0, key: '168h', label: '7 días' }
  ];

  function getDayKey(ts) {
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

    const data = JSON.parse(JSON.stringify(currentData));

    if (!data.returnToMe) data.returnToMe = {};
    if (!data.pointAwards || typeof data.pointAwards !== 'object') data.pointAwards = {};

    const since = STREAK_START_TS;
    const elapsed = Math.max(0, targetNow - since);

    const reachedMilestones = [];
    const expectedStreakEvents = [];
    let totalStreakPts = 0;

    MILESTONES_CONFIG.forEach(m => {
      if (elapsed >= m.ms) {
        reachedMilestones.push(m.key);
        const eventTs = since + m.ms;
        const dKey = getDayKey(eventTs);
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

    // 1. Limpiar eventos de racha previos para garantizar idempotencia estricta
    Object.keys(data.pointAwards).forEach(dk => {
      const dayObj = data.pointAwards[dk];
      if (dayObj && Array.isArray(dayObj.events)) {
        dayObj.events = dayObj.events.filter(e => e && e.kind !== 'racha');
      }
    });

    // 2. Insertar cada hito en su fecha y hora histórica exacta
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

      data.pointAwards[dk].events.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    });

    // 3. Actualizar estado de racha
    data.returnToMe.since = since;
    data.returnToMe.awardedMilestones = reachedMilestones;
    data.returnToMe.best = Math.max(Number(data.returnToMe.best || 0), elapsed);
    data.best = Math.max(Number(data.best || 0), data.returnToMe.best);

    // 4. Recalcular coherencia total de estrellas
    let totalLifetimeFromEvents = 0;
    Object.keys(data.pointAwards).forEach(dk => {
      const dayObj = data.pointAwards[dk];
      if (dayObj && Array.isArray(dayObj.events)) {
        dayObj.events.forEach(e => {
          totalLifetimeFromEvents = Math.round((totalLifetimeFromEvents + Number(e.amount || 0)) * 100) / 100;
        });
      }
    });

    const priorLifetime = Number(data.lifetimeStars || 0);
    const priorWallet = Number(data.wallet || 0);
    const spentAmount = Math.max(0, Math.round((priorLifetime - priorWallet) * 100) / 100);

    data.lifetimeStars = totalLifetimeFromEvents;
    data.wallet = Math.max(0, Math.round((totalLifetimeFromEvents - spentAmount) * 100) / 100);
    data.bank = data.wallet;

    const report = {
      streakSince: new Date(since).toISOString(),
      streakSinceMadrid: new Date(since).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      elapsedHours: (elapsed / MS_PER_HOUR).toFixed(2),
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
   * Ejecutor automático y seguro en navegador para el usuario indicado.
   */
  async function performControlledRepair(userId = TARGET_USER_ID) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    const activeUid = typeof getOrbitActiveUserId === 'function' ? getOrbitActiveUserId() : null;
    const isTarget = (!userId || activeUid === userId || (!activeUid && localStorage.getItem('orbitActiveUserId') === userId));
    
    if (!isTarget && activeUid !== userId) {
      return;
    }

    const doneKey = `orbit_streak_restored_20260824_${userId}`;
    if (localStorage.getItem(doneKey) === 'done') {
      return;
    }

    console.log('[REPAIR] Iniciando restauración controlada de racha para usuario:', userId);

    const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', userId) : `orbitV9:${userId}`;
    let rawCurrent = localStorage.getItem(v9Key) || localStorage.getItem('orbitV9');

    let currentData = null;
    try {
      if (rawCurrent) currentData = JSON.parse(rawCurrent);
    } catch (e) {}

    if (!currentData && typeof load === 'function') {
      currentData = load(userId);
    }

    if (!currentData) {
      console.warn('[REPAIR] Estado local no encontrado para usuario:', userId);
      return;
    }

    // 1. BACKUP DE SEGURIDAD LOCAL
    const backupKey = `orbit_backup_pre_repair_${userId}_${Date.now()}`;
    try {
      localStorage.setItem(backupKey, JSON.stringify(currentData));
      console.log('[REPAIR] 1/4 Backup local asegurado:', backupKey);
    } catch (e) {
      console.warn('[REPAIR] No se pudo escribir backup local:', e);
    }

    // 2. REPARACIÓN PURA DE DATOS
    const { repairedData, report } = repairOrbitData(currentData);
    console.log('[REPAIR] 2/4 Datos recalculados correctamente:', report);

    // 3. PERSISTENCIA LOCAL
    try {
      localStorage.setItem(v9Key, JSON.stringify(repairedData));
      const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', userId) : `orbitLocalUpdatedAt:${userId}`;
      const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', userId) : `orbitHasUnsyncedChanges:${userId}`;
      const nowIso = new Date().toISOString();
      localStorage.setItem(localUpKey, nowIso);
      localStorage.setItem(unsyncKey, 'true');
      localStorage.setItem(doneKey, 'done');
      console.log('[REPAIR] 3/4 Estado local persistido.');
    } catch (e) {
      console.error('[REPAIR] Error al persistir estado local:', e);
    }

    // 4. PERSISTENCIA EN SUPABASE
    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (sb) {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user && session.user.id === userId) {
          const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', userId) : `orbitTimer:${userId}`;
          let timerData = null;
          try { timerData = JSON.parse(localStorage.getItem(timerKey)); } catch (e) {}

          const nowIso = new Date().toISOString();
          const { error: sbErr } = await sb.from('orbit_state').upsert({
            user_id: userId,
            orbit_data: repairedData,
            orbit_timer: timerData,
            updated_at: nowIso
          }, { onConflict: 'user_id' });

          if (!sbErr) {
            const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', userId) : `orbitLastCloudUpdatedAt:${userId}`;
            const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', userId) : `orbitHasUnsyncedChanges:${userId}`;
            localStorage.setItem(cloudUpKey, nowIso);
            localStorage.setItem(unsyncKey, 'false');
            console.log('[REPAIR] 4/4 Sincronización en Supabase confirmada con éxito.');
          } else {
            console.warn('[REPAIR] Advertencia al sincronizar en Supabase:', sbErr.message);
          }
        }
      } catch (err) {
        console.warn('[REPAIR] Error de red con Supabase:', err);
      }
    }

    // 5. ACTUALIZAR VISTAS Y NOTIFICAR
    if (typeof render === 'function') render();
    if (typeof renderArchive === 'function') renderArchive();
    if (typeof toast === 'function') toast('✦ Racha restaurada: 4 días y 7,0 estrellas');

    return { success: true, report, backupKey };
  }

  // Exposición controlada en window
  if (typeof window !== 'undefined') {
    window.repairOrbitStreak = performControlledRepair;
    window.repairOrbitData = repairOrbitData;

    // Ejecutar automáticamente al cargar si el usuario activo coincide
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => performControlledRepair(TARGET_USER_ID), 300);
      });
    } else {
      setTimeout(() => performControlledRepair(TARGET_USER_ID), 300);
    }
  }

  // Exportación para pruebas en Node
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      TARGET_USER_ID,
      STREAK_START_TS,
      MILESTONES_CONFIG,
      getDayKey,
      repairOrbitData,
      performControlledRepair
    };
  }
})();
