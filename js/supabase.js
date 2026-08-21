// Integración con Supabase - Autenticación y Sincronización Manual
const SUPABASE_URL = 'https://wquknalzykitgdkxoysu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ctuEoowcWJs2yaGDOyoK1g_BsQKIVFh';

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
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
  return true;
}

async function supabaseLogout() {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.auth.signOut();
  if (error) {
    if (typeof toast === 'function') toast(error.message || 'Error al cerrar sesión');
    return;
  }
  if (typeof toast === 'function') toast('Sesión cerrada');
  updateCloudUI(null);
}

function updateCloudUI(user) {
  if (typeof document === 'undefined') return;
  const loginForm = document.getElementById('cloudLoginForm');
  const loggedSection = document.getElementById('cloudLoggedSection');
  const userEmailEl = document.getElementById('cloudUserEmail');

  if (user) {
    if (loginForm) loginForm.style.display = 'none';
    if (loggedSection) loggedSection.style.display = 'block';
    if (userEmailEl) userEmailEl.textContent = user.email || 'Conectado';
  } else {
    if (loginForm) loginForm.style.display = 'block';
    if (loggedSection) loggedSection.style.display = 'none';
    if (userEmailEl) userEmailEl.textContent = '';
  }
}

async function initSupabaseAuth() {
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { data: { session } } = await sb.auth.getSession();
    updateCloudUI(session?.user || null);

    sb.auth.onAuthStateChange((event, session) => {
      updateCloudUI(session?.user || null);
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
  try {
    orbitData = JSON.parse(localStorage.getItem('orbitV9'));
  } catch (e) {
    if (typeof load === 'function') orbitData = load();
  }
  if (!orbitData && typeof load === 'function') orbitData = load();

  let orbitTimer = null;
  try {
    const rawTimer = localStorage.getItem('orbitTimer');
    if (rawTimer) orbitTimer = JSON.parse(rawTimer);
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
