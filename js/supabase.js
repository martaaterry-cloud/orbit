// Integración con Supabase - Autenticación y Sincronización Automática Segura
const SUPABASE_URL = 'https://wquknalzykitgdkxoysu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ctuEoowcWJs2yaGDOyoK1g_BsQKIVFh';

let supabaseClient = null;
let currentCloudUser = null;
let syncDebounceTimer = null;
let foregroundSyncTimer = null;
let isSyncing = false;
let pendingSync = false;
let hasConflict = false;

if (typeof window !== 'undefined') {
  window.isApplyingCloudState = false;
}

function getSupabase() {
  if (!supabaseClient && typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

// Caché en memoria durante la sesión activa para URLs firmadas (no persistido)
const signedUrlCache = new Map();

async function getPhotoSignedUrl(photoPath) {
  if (!photoPath) return null;
  const now = Date.now();
  if (signedUrlCache.has(photoPath)) {
    const item = signedUrlCache.get(photoPath);
    if (item && item.expiresAt > now + 60000) {
      return item.url;
    }
  }

  const sb = typeof getSupabase === 'function' ? getSupabase() : null;
  if (!sb) return null;

  try {
    const { data, error } = await sb.storage
      .from('orbit-media')
      .createSignedUrl(photoPath, 7200);

    if (error || !data?.signedUrl) {
      return null;
    }

    signedUrlCache.set(photoPath, {
      url: data.signedUrl,
      expiresAt: now + (7100 * 1000)
    });
    return data.signedUrl;
  } catch (err) {
    console.warn('Excepción obteniendo signedUrl:', err);
    return null;
  }
}

function updateSyncStatus(status) {
  if (typeof document === 'undefined') return;
  const statusText = document.getElementById('cloudStatusText');
  const statusDot = document.getElementById('cloudStatusDot');
  const statusBadge = document.getElementById('cloudStatusBadge');
  if (!statusText) return;

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (offline) {
    statusText.textContent = 'Sin conexión';
    if (statusDot) statusDot.style.background = '#c27d38';
    if (statusBadge) {
      statusBadge.style.color = '#c27d38';
      statusBadge.style.borderColor = 'rgba(194,125,56,0.25)';
      statusBadge.style.background = 'rgba(194,125,56,0.08)';
    }
    return;
  }

  if (status === 'conflict') {
    statusText.textContent = 'Cambios pendientes de revisar';
    if (statusDot) statusDot.style.background = '#c27d38';
    if (statusBadge) {
      statusBadge.style.color = '#c27d38';
      statusBadge.style.borderColor = 'rgba(194,125,56,0.25)';
      statusBadge.style.background = 'rgba(194,125,56,0.08)';
    }
  } else if (status === 'saving') {
    statusText.textContent = 'Nube · Guardando…';
    if (statusDot) statusDot.style.background = '#2e7d32';
    if (statusBadge) {
      statusBadge.style.color = '#2e7d32';
      statusBadge.style.borderColor = 'rgba(46,125,50,0.2)';
      statusBadge.style.background = 'rgba(46,125,50,0.08)';
    }
  } else if (status === 'error') {
    statusText.textContent = 'Error de sincronización';
    if (statusDot) statusDot.style.background = '#c27d38';
    if (statusBadge) {
      statusBadge.style.color = '#c27d38';
      statusBadge.style.borderColor = 'rgba(194,125,56,0.25)';
      statusBadge.style.background = 'rgba(194,125,56,0.08)';
    }
  } else if (status === 'synced') {
    statusText.textContent = 'Nube conectada · Sincronizado';
    if (statusDot) statusDot.style.background = '#2e7d32';
    if (statusBadge) {
      statusBadge.style.color = '#2e7d32';
      statusBadge.style.borderColor = 'rgba(46,125,50,0.2)';
      statusBadge.style.background = 'rgba(46,125,50,0.08)';
    }
  } else {
    statusText.textContent = 'Nube conectada';
    if (statusDot) statusDot.style.background = '#2e7d32';
    if (statusBadge) {
      statusBadge.style.color = '#2e7d32';
      statusBadge.style.borderColor = 'rgba(46,125,50,0.2)';
      statusBadge.style.background = 'rgba(46,125,50,0.08)';
    }
  }
}

function updateAppAuthState(user, isOffline = false) {
  if (typeof document === 'undefined') return;
  const authScreen = document.getElementById('authScreen');
  const mainApp = document.getElementById('mainApp');
  const userEmailEl = document.getElementById('cloudUserEmail');
  const offlineNotice = document.getElementById('authOfflineNotice');

  currentCloudUser = user || null;
  const knownUser = localStorage.getItem('orbitKnownUser');
  const offline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);

  if (user) {
    localStorage.setItem('orbitKnownUser', user.email || 'true');
    if (authScreen) authScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    if (userEmailEl) userEmailEl.textContent = user.email || '';
    updateSyncStatus(offline ? 'offline' : (hasConflict ? 'conflict' : 'synced'));
  } else if (knownUser && offline) {
    if (authScreen) authScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    if (userEmailEl) userEmailEl.textContent = knownUser !== 'true' ? knownUser : '';
    updateSyncStatus('offline');
  } else {
    if (authScreen) authScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
    if (userEmailEl) userEmailEl.textContent = '';
    if (offlineNotice) offlineNotice.style.display = offline ? 'block' : 'none';
  }
}

async function supabaseLogin(email, password) {
  const sb = getSupabase();
  if (!sb) {
    if (typeof toast === 'function') toast('Servicio de nube no disponible');
    return false;
  }
  const loginBtn = document.getElementById('cloudLoginBtn');
  if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Entrando…'; }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Entrar en Orbit'; }

  if (error) {
    if (typeof toast === 'function') toast(error.message || 'Error al iniciar sesión');
    return false;
  }
  if (typeof toast === 'function') toast('Bienvenida a Orbit');
  localStorage.setItem('orbitKnownUser', email);
  updateAppAuthState(data.session?.user || null);
  if (data.session) {
    autoSyncOnInit(data.session);
  }
  return true;
}

async function supabaseLogout() {
  const sb = getSupabase();
  localStorage.removeItem('orbitKnownUser');
  clearTimeout(syncDebounceTimer);
  clearTimeout(foregroundSyncTimer);
  hasConflict = false;
  if (sb) {
    await sb.auth.signOut().catch(() => {});
  }
  if (typeof toast === 'function') toast('Sesión cerrada');
  updateAppAuthState(null);
}

// Aplicar estado de la nube evitando bucles y marcando cambios pendientes en false
function safeApplyCloudState(cloudData, cloudTimer, cloudUpdatedAt) {
  if (typeof window !== 'undefined') window.isApplyingCloudState = true;
  try {
    localStorage.setItem('orbitV9', JSON.stringify(cloudData));
    if (cloudTimer) {
      localStorage.setItem('orbitTimer', JSON.stringify(cloudTimer));
    } else {
      localStorage.removeItem('orbitTimer');
    }
    if (cloudUpdatedAt) {
      localStorage.setItem('orbitLocalUpdatedAt', cloudUpdatedAt);
      localStorage.setItem('orbitLastCloudUpdatedAt', cloudUpdatedAt);
    }
    localStorage.setItem('orbitHasUnsyncedChanges', 'false');
    hasConflict = false;

    if (typeof load === 'function') load();
    if (typeof render === 'function') render();
    if (typeof syncUrgeTimer === 'function') syncUrgeTimer();
    if (typeof renderArchive === 'function') renderArchive();
  } finally {
    if (typeof window !== 'undefined') window.isApplyingCloudState = false;
  }
}

// Sincronización automática al iniciar, recuperar foco o conexión
async function autoSyncOnInit(session) {
  if (!session || !session.user) return;
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

  try {
    const { data, error } = await sb
      .from('orbit_state')
      .select('orbit_data, orbit_timer, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      console.warn('Error al verificar estado en Supabase:', error);
      updateSyncStatus('error');
      return;
    }

    let localUpdatedAt = localStorage.getItem('orbitLocalUpdatedAt');
    if (!localUpdatedAt) {
      localUpdatedAt = new Date().toISOString();
      localStorage.setItem('orbitLocalUpdatedAt', localUpdatedAt);
    }
    const hasUnsynced = localStorage.getItem('orbitHasUnsyncedChanges') === 'true';

    // Caso D: No existe fila en la nube -> crearla con el estado local actual
    if (!data || !data.orbit_data || !data.updated_at) {
      performAutoUpload();
      return;
    }

    const cloudUpdatedAt = data.updated_at;
    const cloudTime = new Date(cloudUpdatedAt).getTime();
    const lastKnownCloud = localStorage.getItem('orbitLastCloudUpdatedAt');
    const lastKnownCloudTime = lastKnownCloud ? new Date(lastKnownCloud).getTime() : 0;
    const localTime = new Date(localUpdatedAt).getTime();

    // ¿La nube ha cambiado desde la última versión que este dispositivo conoció?
    const isCloudNewer = lastKnownCloudTime > 0 
      ? cloudTime > (lastKnownCloudTime + 1000) 
      : cloudTime > (localTime + 1000);

    // Conflicto REAL: La nube cambió Y este contexto local tiene cambios no sincronizados
    if (isCloudNewer && hasUnsynced) {
      hasConflict = true;
      updateSyncStatus('conflict');
      return;
    }

    // Caso A: La nube es más nueva y el contexto local NO tiene cambios pendientes -> Descargar
    if (isCloudNewer && !hasUnsynced) {
      safeApplyCloudState(data.orbit_data, data.orbit_timer, cloudUpdatedAt);
      updateSyncStatus('synced');
      return;
    }

    // Caso B: El contexto local tiene cambios pendientes y la nube no ha cambiado remotamente -> Subir
    if (hasUnsynced && !isCloudNewer) {
      performAutoUpload();
      return;
    }

    // Caso C: Ambos están al día y sin cambios pendientes
    localStorage.setItem('orbitLastCloudUpdatedAt', cloudUpdatedAt);
    localStorage.setItem('orbitHasUnsyncedChanges', 'false');
    hasConflict = false;
    updateSyncStatus('synced');
  } catch (err) {
    console.error('Error en sincronización inicial:', err);
    updateSyncStatus('error');
  }
}

// Programar subida automática con debounce (1500 ms)
function scheduleCloudSync() {
  if (!currentCloudUser || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  if (typeof window !== 'undefined' && window.isApplyingCloudState) return;
  if (hasConflict) return;

  updateSyncStatus('saving');
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    performAutoUpload();
  }, 1500);
}

// Subida automática a Supabase
async function performAutoUpload() {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  if (typeof window !== 'undefined' && window.isApplyingCloudState) return;

  const { data: { session } } = await sb.auth.getSession();
  if (!session || !session.user) {
    updateAppAuthState(null);
    return;
  }
  currentCloudUser = session.user;

  if (isSyncing) {
    pendingSync = true;
    return;
  }
  isSyncing = true;
  updateSyncStatus('saving');

  try {
    let orbitData = null;
    try { orbitData = JSON.parse(localStorage.getItem('orbitV9')); } catch (e) {}
    if (!orbitData && typeof load === 'function') orbitData = load();

    let orbitTimer = null;
    try {
      const raw = localStorage.getItem('orbitTimer');
      if (raw) orbitTimer = JSON.parse(raw);
    } catch (e) {}

    let localIso = localStorage.getItem('orbitLocalUpdatedAt');
    if (!localIso) {
      localIso = new Date().toISOString();
      localStorage.setItem('orbitLocalUpdatedAt', localIso);
    }

    // Verificar si la nube cambió remotamente antes de sobrescribir
    const { data: cloudCheck } = await sb
      .from('orbit_state')
      .select('updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (cloudCheck && cloudCheck.updated_at) {
      const cloudTime = new Date(cloudCheck.updated_at).getTime();
      const lastKnownCloud = localStorage.getItem('orbitLastCloudUpdatedAt');
      const lastKnownCloudTime = lastKnownCloud ? new Date(lastKnownCloud).getTime() : 0;
      const hasUnsynced = localStorage.getItem('orbitHasUnsyncedChanges') === 'true';

      if (lastKnownCloudTime > 0 && cloudTime > (lastKnownCloudTime + 1000) && hasUnsynced) {
        hasConflict = true;
        isSyncing = false;
        updateSyncStatus('conflict');
        return;
      }
    }

    const payload = {
      user_id: session.user.id,
      orbit_data: orbitData,
      orbit_timer: orbitTimer,
      updated_at: localIso
    };

    const { data: upsertData, error } = await sb
      .from('orbit_state')
      .upsert(payload, { onConflict: 'user_id' })
      .select('updated_at')
      .maybeSingle();

    isSyncing = false;

    if (error) {
      console.warn('Error en subida automática:', error);
      updateSyncStatus('error');
    } else {
      const confirmedTime = upsertData?.updated_at || localIso;
      localStorage.setItem('orbitLastCloudUpdatedAt', confirmedTime);
      localStorage.setItem('orbitHasUnsyncedChanges', 'false');
      hasConflict = false;
      updateSyncStatus('synced');
    }
  } catch (err) {
    isSyncing = false;
    console.warn('Excepción en subida automática:', err);
    updateSyncStatus('error');
  }

  if (pendingSync) {
    pendingSync = false;
    scheduleCloudSync();
  }
}

// Subida manual
async function uploadToCloud() {
  const sb = getSupabase();
  if (!sb) {
    if (typeof toast === 'function') toast('Servicio de nube no disponible');
    return false;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (!session || !session.user) {
    if (typeof toast === 'function') toast('Inicia sesión en la nube primero');
    return false;
  }

  let orbitData = null;
  try { orbitData = JSON.parse(localStorage.getItem('orbitV9')); } catch (e) { if (typeof load === 'function') orbitData = load(); }
  if (!orbitData && typeof load === 'function') orbitData = load();

  let orbitTimer = null;
  try {
    const raw = localStorage.getItem('orbitTimer');
    if (raw) orbitTimer = JSON.parse(raw);
  } catch (e) {}

  const nowIso = new Date().toISOString();
  localStorage.setItem('orbitLocalUpdatedAt', nowIso);

  const payload = {
    user_id: session.user.id,
    orbit_data: orbitData,
    orbit_timer: orbitTimer,
    updated_at: nowIso
  };

  const uploadBtn = document.getElementById('cloudUploadBtn');
  if (uploadBtn) uploadBtn.disabled = true;
  updateSyncStatus('saving');

  const { data: upsertData, error } = await sb
    .from('orbit_state')
    .upsert(payload, { onConflict: 'user_id' })
    .select('updated_at')
    .maybeSingle();

  if (uploadBtn) uploadBtn.disabled = false;

  if (error) {
    if (typeof toast === 'function') toast(error.message || 'Error al guardar en la nube');
    updateSyncStatus('error');
    return false;
  }

  const confirmedTime = upsertData?.updated_at || nowIso;
  localStorage.setItem('orbitLastCloudUpdatedAt', confirmedTime);
  localStorage.setItem('orbitHasUnsyncedChanges', 'false');
  hasConflict = false;
  if (typeof toast === 'function') toast('Datos guardados en la nube');
  updateSyncStatus('synced');
  return true;
}

// Recuperación manual
async function restoreFromCloud() {
  const sb = getSupabase();
  if (!sb) {
    if (typeof toast === 'function') toast('Servicio de nube no disponible');
    return false;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (!session || !session.user) {
    if (typeof toast === 'function') toast('Inicia sesión en la nube primero');
    return false;
  }

  const restoreBtn = document.getElementById('cloudRestoreBtn');
  if (restoreBtn) restoreBtn.disabled = true;

  const { data, error } = await sb
    .from('orbit_state')
    .select('orbit_data, orbit_timer, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (restoreBtn) restoreBtn.disabled = false;

  if (error) {
    if (typeof toast === 'function') toast(error.message || 'Error al leer de la nube');
    return false;
  }

  if (!data || !data.orbit_data) {
    if (typeof toast === 'function') toast('No hay datos guardados en la nube todavía');
    return false;
  }

  const dateStr = data.updated_at ? new Date(data.updated_at).toLocaleString('es-ES') : '';
  const ok = confirm(`¿Restaurar los datos guardados en la nube${dateStr ? ` (${dateStr})` : ''}?\n\nEsta acción reemplazará los datos locales en este dispositivo.`);
  if (!ok) return false;

  safeApplyCloudState(data.orbit_data, data.orbit_timer, data.updated_at);

  if (typeof toast === 'function') toast('Datos de la nube restaurados');
  updateSyncStatus('synced');
  return true;
}

function handleForegroundTrigger() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  clearTimeout(foregroundSyncTimer);
  foregroundSyncTimer = setTimeout(() => {
    const sb = getSupabase();
    if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        updateAppAuthState(session.user);
        autoSyncOnInit(session);
      }
    }).catch(() => {});
  }, 400);
}

async function initSupabaseAuth() {
  const sb = getSupabase();
  if (!sb) {
    updateAppAuthState(null);
    return;
  }

  try {
    const { data: { session } } = await sb.auth.getSession();
    updateAppAuthState(session?.user || null);
    if (session) {
      autoSyncOnInit(session);
    }

    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('orbitKnownUser');
        updateAppAuthState(null);
      } else if (session?.user) {
        updateAppAuthState(session.user);
        if (event === 'SIGNED_IN') {
          autoSyncOnInit(session);
        }
      }
    });
  } catch (err) {
    console.warn('Error verificando sesión de Supabase:', err);
    updateAppAuthState(null, true);
  }

  window.addEventListener('online', handleForegroundTrigger);
  window.addEventListener('offline', () => {
    updateAppAuthState(null, true);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') handleForegroundTrigger();
  });

  window.addEventListener('pageshow', handleForegroundTrigger);
  window.addEventListener('focus', handleForegroundTrigger);
}

function handleCloudLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const emailInput = document.getElementById('cloudEmail');
  const passInput = document.getElementById('cloudPassword');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passInput ? passInput.value : '';

  if (!email || !password) {
    if (typeof toast === 'function') toast('Introduce email y contraseña');
    return;
  }

  supabaseLogin(email, password);
}

function handleCloudLogout() {
  supabaseLogout();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabaseAuth);
  } else {
    initSupabaseAuth();
  }
}
