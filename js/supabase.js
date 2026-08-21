// Integración con Supabase - Autenticación y Cliente
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

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabaseAuth);
  } else {
    initSupabaseAuth();
  }
}
