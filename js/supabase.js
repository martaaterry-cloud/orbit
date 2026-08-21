// Integración con Supabase - Autenticación en Entrada y Respaldo Manual
const SUPABASE_URL = 'https://wquknalzykitgdkxoysu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ctuEoowcWJs2yaGDOyoK1g_BsQKIVFh';

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function updateAppAuthState(user, isOffline = false) {
  if (typeof document === 'undefined') return;
  const authScreen = document.getElementById('authScreen');
  const mainApp = document.getElementById('mainApp');
  const userEmailEl = document.getElementById('cloudUserEmail');
  const statusText = document.getElementById('cloudStatusText');
  const statusDot = document.getElementById('cloudStatusDot');
  const statusBadge = document.getElementById('cloudStatusBadge');
  const offlineNotice = document.getElementById('authOfflineNotice');

  const knownUser = localStorage.getItem('orbitKnownUser');
  const offline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);

  if (user) {
    localStorage.setItem('orbitKnownUser', user.email || 'true');
    if (authScreen) authScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    if (userEmailEl) userEmailEl.textContent = user.email || '';
    if (statusText) statusText.textContent = offline ? 'Sin conexión' : 'Nube conectada';
    if (statusDot) statusDot.style.background = offline ? '#c27d38' : '#2e7d32';
    if (statusBadge) {
      statusBadge.style.color = offline ? '#c27d38' : '#2e7d32';
      statusBadge.style.borderColor = offline ? 'rgba(194,125,56,0.25)' : 'rgba(46,125,50,0.2)';
      statusBadge.style.background = offline ? 'rgba(194,125,56,0.08)' : 'rgba(46,125,50,0.08)';
    }
  } else if (knownUser && offline) {
    // Sesión conocida previamente pero sin conexión a Internet: permitir seguir usando Orbit localmente
    if (authScreen) authScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    if (userEmailEl) userEmailEl.textContent = knownUser !== 'true' ? knownUser : '';
    if (statusText) statusText.textContent = 'Sin conexión';
    if (statusDot) statusDot.style.background = '#c27d38';
    if (statusBadge) {
      statusBadge.style.color = '#c27d38';
      statusBadge.style.borderColor = 'rgba(194,125,56,0.25)';
      statusBadge.style.background = 'rgba(194,125,56,0.08)';
    }
  } else {
    // Sin sesión activa ni conocida: mostrar pantalla de acceso
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
  return true;
}

async function supabaseLogout() {
  const sb = getSupabase();
  localStorage.removeItem('orbitKnownUser');
  if (sb) {
    await sb.auth.signOut().catch(() => {});
  }
  if (typeof toast === 'function') toast('Sesión cerrada');
  updateAppAuthState(null);
}

async function initSupabaseAuth() {
  const sb = getSupabase();
  if (!sb) {
    // Si no carga Supabase JS pero hay usuario conocido, no bloquear el acceso local
    updateAppAuthState(null);
    return;
  }

  try {
    const { data: { session } } = await sb.auth.getSession();
    updateAppAuthState(session?.user || null);

    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('orbitKnownUser');
        updateAppAuthState(null);
      } else if (session?.user) {
        updateAppAuthState(session.user);
      }
    });
  } catch (err) {
    console.warn('Error verificando sesión de Supabase (posible offline):', err);
    updateAppAuthState(null, true);
  }

  window.addEventListener('online', () => {
    sb.auth.getSession().then(({ data: { session } }) => {
      updateAppAuthState(session?.user || null, false);
    }).catch(() => updateAppAuthState(null, true));
  });

  window.addEventListener('offline', () => {
    updateAppAuthState(null, true);
  });
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

// Subida manual a la nube
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
  try { orbitData = JSON.parse(localStorage.getItem('orbitV9')); } catch (e) {}
  if (!orbitData && typeof load === 'function') orbitData = load();

  let orbitTimer = null;
  try {
    const raw = localStorage.getItem('orbitTimer');
    if (raw) orbitTimer = JSON.parse(raw);
  } catch (e) {}

  const nowIso = new Date().toISOString();
  const payload = {
    user_id: session.user.id,
    orbit_data: orbitData,
    orbit_timer: orbitTimer,
    updated_at: nowIso
  };

  const uploadBtn = document.getElementById('cloudUploadBtn');
  if (uploadBtn) uploadBtn.disabled = true;

  const { error } = await sb
    .from('orbit_state')
    .upsert(payload, { onConflict: 'user_id' });

  if (uploadBtn) uploadBtn.disabled = false;

  if (error) {
    if (typeof toast === 'function') toast(error.message || 'Error al guardar en la nube');
    return false;
  }

  if (typeof toast === 'function') toast('Datos guardados en la nube');
  return true;
}

// Recuperación manual desde la nube
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

  if (typeof toast === 'function') toast('Datos de la nube restaurados');

  if (typeof load === 'function') load();
  if (typeof render === 'function') render();
  if (typeof syncUrgeTimer === 'function') syncUrgeTimer();
  if (typeof renderArchive === 'function') renderArchive();

  return true;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabaseAuth);
  } else {
    initSupabaseAuth();
  }
}
