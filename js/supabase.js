// Integración con Supabase - Autenticación y Sincronización Automática Segura
const SUPABASE_URL = 'https://wquknalzykitgdkxoysu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ctuEoowcWJs2yaGDOyoK1g_BsQKIVFh';

let supabaseClient = null;
let currentCloudUser = null;
let syncDebounceTimer = null;
let isSyncing = false;
let pendingSync = false;

function getSupabase() {
  if (!supabaseClient && typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function updateSyncStatus(status) {
  if (typeof document === 'undefined') return;
  const statusEl = document.getElementById('cloudSyncStatus');
  if (statusEl) {
    statusEl.textContent = status ? ' · ' + status : '';
  }
}

function updateCloudUI(user) {
  if (typeof document === 'undefined') return;
  const loginForm = document.getElementById('cloudLoginForm');
  const loggedSection = document.getElementById('cloudLoggedSection');
  const userEmailEl = document.getElementById('cloudUserEmail');

  currentCloudUser = user || null;

  if (user) {
    if (loginForm) loginForm.style.display = 'none';
    if (loggedSection) loggedSection.style.display = 'block';
    if (userEmailEl) userEmailEl.textContent = user.email || 'Conectado';
  } else {
    if (loginForm) loginForm.style.display = 'block';
    if (loggedSection) loggedSection.style.display = 'none';
    if (userEmailEl) userEmailEl.textContent = '';
    updateSyncStatus('');
  }
}

async function supabaseLogin(email, password) {
  const sb = getSupabase();
  if (!sb) {
    if (typeof toast === 'function') toast('Servicio de nube no disponible');
    return false;
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (typeof toast === 'function') toast(error.message || 'Error al iniciar sesión');
    return false;
  }
  if (typeof toast === 'function') toast('Nube conectada');
  updateCloudUI(data.session?.user || null);
  if (data.session) {
    autoSyncOnInit(data.session);
  }
  return true;
}

async function supabaseLogout() {
  const sb = getSupabase();
  if (!sb) return;
  clearTimeout(syncDebounceTimer);
  const { error } = await sb.auth.signOut();
  if (error) {
    if (typeof toast === 'function') toast(error.message || 'Error al cerrar sesión');
    return;
  }
  if (typeof toast === 'function') toast('Sesión cerrada');
  updateCloudUI(null);
}

// Sincronización automática al iniciar o detectar sesión
async function autoSyncOnInit(session) {
  if (!session || !session.user) return;
  const sb = getSupabase();
  if (!sb) return;

  updateSyncStatus('Comprobando…');

  try {
    const { data, error } = await sb
      .from('orbit_state')
      .select('orbit_data, orbit_timer, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      console.warn('Error al comprobar estado en la nube:', error);
      updateSyncStatus('Nube conectada');
      return;
    }

    const localUpdatedAt = localStorage.getItem('orbitLocalUpdatedAt');
    const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;

    // 1. Si no hay datos en la nube y sí hay en local -> subir a la nube
    if (!data || !data.orbit_data || !data.updated_at) {
      performAutoUpload();
      return;
    }

    const cloudTime = new Date(data.updated_at).getTime();
    const timeDiff = cloudTime - localTime;

    // 2. Si la nube es más reciente (diferencia > 2 segundos) -> descargar
    if (timeDiff > 2000) {
      localStorage.setItem('orbitV9', JSON.stringify(data.orbit_data));
      if (data.orbit_timer) {
        localStorage.setItem('orbitTimer', JSON.stringify(data.orbit_timer));
      } else {
        localStorage.removeItem('orbitTimer');
      }
      localStorage.setItem('orbitLocalUpdatedAt', data.updated_at);

      if (typeof load === 'function') load();
      if (typeof render === 'function') render();
      if (typeof syncUrgeTimer === 'function') syncUrgeTimer();
      if (typeof renderArchive === 'function') renderArchive();

      updateSyncStatus('Sincronizado');
      return;
    }

    // 3. Si el estado local es más reciente (diferencia > 2 segundos) -> subir
    if (timeDiff < -2000) {
      performAutoUpload();
      return;
    }

    // 4. Si están prácticamente a la par -> sincronizado
    updateSyncStatus('Sincronizado');
  } catch (err) {
    console.error('Error en sincronización inicial:', err);
    updateSyncStatus('Nube conectada');
  }
}

// Programar subida automática con debounce (1.5 segundos)
function scheduleCloudSync() {
  if (!currentCloudUser) return;
  updateSyncStatus('Guardando…');
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    performAutoUpload();
  }, 1500);
}

async function performAutoUpload() {
  const sb = getSupabase();
  if (!sb) return;

  const { data: { session } } = await sb.auth.getSession();
  if (!session || !session.user) {
    updateCloudUI(null);
    return;
  }
  currentCloudUser = session.user;

  if (isSyncing) {
    pendingSync = true;
    return;
  }
  isSyncing = true;
  updateSyncStatus('Guardando…');

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

  const payload = {
    user_id: session.user.id,
    orbit_data: orbitData,
    orbit_timer: orbitTimer,
    updated_at: localIso
  };

  const { error } = await sb
    .from('orbit_state')
    .upsert(payload, { onConflict: 'user_id' });

  isSyncing = false;

  if (error) {
    console.warn('Error en subida automática:', error);
    updateSyncStatus('Error');
  } else {
    updateSyncStatus('Sincronizado');
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
  updateSyncStatus('Guardando…');

  const { error } = await sb
    .from('orbit_state')
    .upsert(payload, { onConflict: 'user_id' });

  if (uploadBtn) uploadBtn.disabled = false;

  if (error) {
    if (typeof toast === 'function') toast(error.message || 'Error al guardar en la nube');
    updateSyncStatus('Error');
    return false;
  }

  if (typeof toast === 'function') toast('Datos guardados en la nube');
  updateSyncStatus('Sincronizado');
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

  localStorage.setItem('orbitV9', JSON.stringify(data.orbit_data));

  if (data.orbit_timer) {
    localStorage.setItem('orbitTimer', JSON.stringify(data.orbit_timer));
  } else {
    localStorage.removeItem('orbitTimer');
  }

  if (data.updated_at) {
    localStorage.setItem('orbitLocalUpdatedAt', data.updated_at);
  }

  if (typeof toast === 'function') toast('Datos de la nube restaurados');
  updateSyncStatus('Sincronizado');

  if (typeof load === 'function') load();
  if (typeof render === 'function') render();
  if (typeof syncUrgeTimer === 'function') syncUrgeTimer();
  if (typeof renderArchive === 'function') renderArchive();

  return true;
}

async function initSupabaseAuth() {
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { data: { session } } = await sb.auth.getSession();
    updateCloudUI(session?.user || null);
    if (session) {
      autoSyncOnInit(session);
    }

    sb.auth.onAuthStateChange((event, session) => {
      updateCloudUI(session?.user || null);
      if (event === 'SIGNED_IN' && session) {
        autoSyncOnInit(session);
      }
    });
  } catch (err) {
    console.error('Error inicializando auth Supabase:', err);
  }
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
