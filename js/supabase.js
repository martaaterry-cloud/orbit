// Integración con Supabase - Autenticación Multiusuario, Registro y Sincronización Segura
const SUPABASE_URL = 'https://wquknalzykitgdkxoysu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ctuEoowcWJs2yaGDOyoK1g_BsQKIVFh';

// Configuración de Cloudflare Turnstile para protección de registro y login por username
const TURNSTILE_SITE_KEY = 'PENDING_TURNSTILE_SITE_KEY';
let turnstileLoginWidgetId = null;
let turnstileSignupWidgetId = null;
let turnstileLoginToken = '';
let turnstileSignupToken = '';

function isTurnstileConfigured() {
  return typeof TURNSTILE_SITE_KEY === 'string' &&
    TURNSTILE_SITE_KEY.trim() !== '' &&
    TURNSTILE_SITE_KEY !== 'PENDING_TURNSTILE_SITE_KEY';
}

function initTurnstileWidgets() {
  if (!isTurnstileConfigured()) return;
  if (typeof window === 'undefined' || typeof window.turnstile === 'undefined') {
    setTimeout(initTurnstileWidgets, 400);
    return;
  }

  const loginContainer = document.getElementById('turnstile-login-container');
  if (loginContainer && turnstileLoginWidgetId === null) {
    try {
      turnstileLoginWidgetId = window.turnstile.render('#turnstile-login-container', {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        size: 'flexible',
        callback: (token) => { turnstileLoginToken = token; },
        'expired-callback': () => { turnstileLoginToken = ''; },
        'error-callback': () => { turnstileLoginToken = ''; }
      });
    } catch (e) {}
  }

  const signupContainer = document.getElementById('turnstile-signup-container');
  if (signupContainer && turnstileSignupWidgetId === null) {
    try {
      turnstileSignupWidgetId = window.turnstile.render('#turnstile-signup-container', {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        size: 'flexible',
        callback: (token) => { turnstileSignupToken = token; },
        'expired-callback': () => { turnstileSignupToken = ''; },
        'error-callback': () => { turnstileSignupToken = ''; }
      });
    } catch (e) {}
  }
}

function resetTurnstile(mode) {
  if (typeof window === 'undefined' || typeof window.turnstile === 'undefined') return;
  try {
    if ((mode === 'login' || !mode) && turnstileLoginWidgetId !== null) {
      window.turnstile.reset(turnstileLoginWidgetId);
      turnstileLoginToken = '';
    }
    if ((mode === 'signup' || !mode) && turnstileSignupWidgetId !== null) {
      window.turnstile.reset(turnstileSignupWidgetId);
      turnstileSignupToken = '';
    }
  } catch (e) {}
}

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
    return null;
  }
}

function updateCloudHeaderStatus(status) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('headerCloudBtn');
  if (!btn) return;

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (offline) {
    btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="color:#c27d38;"><path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0-1 7h-.5a5 5 0 0 0 0 10h14.5M1 1l22 22"/></svg>`;
    btn.title = 'Sin conexión (modo local)';
    return;
  }

  if (status === 'saving') {
    btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="color:#2e7d32; animation:photoSpin 1s linear infinite;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M12 12v4M10 14l2-2 2 2"/></svg>`;
    btn.title = 'Guardando en la nube…';
  } else if (status === 'error' || status === 'conflict') {
    btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="color:#c27d38;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="12" y1="12" x2="12" y2="15"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>`;
    btn.title = 'Aviso de sincronización';
  } else {
    btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="color:#2e7d32;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="8.5 14.5 11 17 15.5 11.5" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>`;
    btn.title = 'Nube conectada y sincronizada';
  }
}

function updateSyncStatus(status, customMessage) {
  if (typeof document === 'undefined') return;
  updateCloudHeaderStatus(status);
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
    statusText.textContent = customMessage || 'Cambios pendientes de revisar';
    if (statusDot) statusDot.style.background = '#c27d38';
    if (statusBadge) {
      statusBadge.style.color = '#c27d38';
      statusBadge.style.borderColor = 'rgba(194,125,56,0.25)';
      statusBadge.style.background = 'rgba(194,125,56,0.08)';
    }
  } else if (status === 'saving') {
    statusText.textContent = customMessage || 'Nube · Guardando…';
    if (statusDot) statusDot.style.background = '#2e7d32';
    if (statusBadge) {
      statusBadge.style.color = '#2e7d32';
      statusBadge.style.borderColor = 'rgba(46,125,50,0.2)';
      statusBadge.style.background = 'rgba(46,125,50,0.08)';
    }
  } else if (status === 'error' || status === 'session_expired') {
    statusText.textContent = customMessage || (status === 'session_expired' ? 'Sesión expirada · Vuelve a entrar' : 'Error de sincronización');
    if (statusDot) statusDot.style.background = '#c27d38';
    if (statusBadge) {
      statusBadge.style.color = '#c27d38';
      statusBadge.style.borderColor = 'rgba(194,125,56,0.25)';
      statusBadge.style.background = 'rgba(194,125,56,0.08)';
    }
  } else if (status === 'synced') {
    statusText.textContent = customMessage || 'Nube conectada · Sincronizado';
    if (statusDot) statusDot.style.background = '#2e7d32';
    if (statusBadge) {
      statusBadge.style.color = '#2e7d32';
      statusBadge.style.borderColor = 'rgba(46,125,50,0.2)';
      statusBadge.style.background = 'rgba(46,125,50,0.08)';
    }
  } else {
    statusText.textContent = customMessage || 'Nube conectada';
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
  if (typeof setOrbitActiveUser === 'function') {
    setOrbitActiveUser(user || null);
  }

  const activeUserId = typeof getOrbitActiveUserId === 'function' ? getOrbitActiveUserId() : null;
  const offline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);

  if (user) {
    if (authScreen) authScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    if (userEmailEl) userEmailEl.textContent = user.email || '';
    updateSyncStatus(offline ? 'offline' : (hasConflict ? 'conflict' : 'synced'));
    if (typeof syncUserProfileFromCloud === 'function') {
      syncUserProfileFromCloud(user);
    }
    if (typeof render === 'function') {
      render();
    }

  } else if (activeUserId && offline) {
    let knownObj = null;
    try { knownObj = JSON.parse(localStorage.getItem('orbitKnownUser') || '{}'); } catch(e){}
    if (authScreen) authScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    if (userEmailEl) userEmailEl.textContent = knownObj?.email || '';
    updateSyncStatus('offline');
  } else {
    if (authScreen) authScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
    if (userEmailEl) userEmailEl.textContent = '';
    if (offlineNotice) offlineNotice.style.display = offline ? 'block' : 'none';
  }
}

function validatePasswordRequirements(password) {
  const p = String(password || '');
  if (p.length < 10) {
    return 'La contraseña debe tener al menos 10 caracteres.';
  }
  if (!/[a-z]/.test(p)) {
    return 'La contraseña debe incluir al menos una letra minúscula.';
  }
  if (!/[A-Z]/.test(p)) {
    return 'La contraseña debe incluir al menos una letra mayúscula.';
  }
  if (!/[0-9]/.test(p)) {
    return 'La contraseña debe incluir al menos un número.';
  }
  return null;
}

// Iniciar sesión con Email o Username
async function supabaseLogin(identifier, password) {
  const sb = getSupabase();
  if (!sb) {
    if (typeof toast === 'function') toast('Servicio de nube no disponible');
    return false;
  }
  const cleanId = String(identifier || '').trim();
  const cleanPass = String(password || '');

  if (!cleanId || !cleanPass) {
    if (typeof toast === 'function') toast('Introduce usuario/email y contraseña');
    return false;
  }

  // Si es login por username y Turnstile está configurado, exigir verificación
  if (!cleanId.includes('@') && isTurnstileConfigured() && !turnstileLoginToken) {
    if (typeof toast === 'function') toast('Por favor, completa la verificación de seguridad');
    return false;
  }

  // Capturar evidencia previa de identidad ANTES de cualquier mutación local
  const priorKnownIdentity = typeof localStorage !== 'undefined' ? localStorage.getItem('orbitKnownUser') : null;

  const loginBtn = document.getElementById('cloudLoginBtn');
  if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Entrando…'; }

  try {
    let session = null;
    let authError = null;

    if (cleanId.includes('@')) {
      // Login directo por Email
      const { data, error } = await sb.auth.signInWithPassword({
        email: cleanId.toLowerCase(),
        password: cleanPass
      });
      session = data?.session || null;
      authError = error;
    } else {
      // Login por Username mediante Supabase Edge Function aislada
      try {
        const payload = {
          username: cleanId.toLowerCase(),
          password: cleanPass
        };
        if (turnstileLoginToken) {
          payload.captcha_token = turnstileLoginToken;
        }

        const { data: edgeData, error: edgeErr } = await sb.functions.invoke('login-with-username', {
          body: payload
        });

        if (edgeErr || !edgeData?.session) {
          authError = edgeErr || new Error(edgeData?.error || 'Usuario o contraseña incorrectos.');
          resetTurnstile('login');
        } else {
          const { error: setErr } = await sb.auth.setSession(edgeData.session);
          if (setErr) {
            authError = setErr;
            resetTurnstile('login');
          } else {
            session = edgeData.session;
            resetTurnstile('login');
          }
        }
      } catch (invokeErr) {
        authError = new Error('No se pudo contactar con el servicio de autenticación por usuario.');
        resetTurnstile('login');
      }
    }

    if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Entrar en Orbit'; }

    if (authError || !session) {
      if (typeof toast === 'function') toast(authError?.message || 'Usuario o contraseña incorrectos');
      return false;
    }

    if (typeof toast === 'function') toast('Bienvenida a Orbit');
    
    // Migrar datos legacy comprobando evidencia previa ANTES de registrar la nueva identidad activa
    if (typeof migrateLegacyStorageIfVerified === 'function') {
      migrateLegacyStorageIfVerified(session.user, priorKnownIdentity);
    }
    if (typeof setOrbitActiveUser === 'function') {
      setOrbitActiveUser(session.user);
    }

    updateAppAuthState(session.user);
    autoSyncOnInit(session);
    return true;
  } catch (err) {
    if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Entrar en Orbit'; }
    resetTurnstile('login');
    if (typeof toast === 'function') toast('Error inesperado al iniciar sesión');
    return false;
  }
}

// Registro de nueva cuenta con username único
async function supabaseSignUp(email, username, password) {
  const sb = getSupabase();
  if (!sb) {
    if (typeof toast === 'function') toast('Servicio de nube no disponible');
    return false;
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanEmail || !cleanEmail.includes('@')) {
    if (typeof toast === 'function') toast('Introduce un correo electrónico válido');
    return false;
  }

  const usernameRegex = /^[a-z0-9_]{3,20}$/;
  if (!usernameRegex.test(cleanUsername)) {
    if (typeof toast === 'function') toast('El nombre de usuario debe tener entre 3 y 20 caracteres (solo letras, números y guion bajo)');
    return false;
  }

  const passError = validatePasswordRequirements(cleanPassword);
  if (passError) {
    if (typeof toast === 'function') toast(passError);
    return false;
  }

  // Si Turnstile está configurado, exigir token antes de enviar registro
  if (isTurnstileConfigured() && !turnstileSignupToken) {
    if (typeof toast === 'function') toast('Por favor, completa la verificación de seguridad');
    return false;
  }

  const signupBtn = document.getElementById('cloudSignupBtn');
  if (signupBtn) { signupBtn.disabled = true; signupBtn.textContent = 'Creando cuenta…'; }

  try {
    const signUpOptions = {
      data: {
        username: cleanUsername,
        display_name: cleanUsername
      }
    };
    if (turnstileSignupToken) {
      signUpOptions.captchaToken = turnstileSignupToken;
    }

    const { data, error } = await sb.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: signUpOptions
    });

    if (signupBtn) { signupBtn.disabled = false; signupBtn.textContent = 'Crear mi cuenta'; }
    resetTurnstile('signup');

    if (error) {
      if (typeof toast === 'function') toast(error.message || 'Error al crear la cuenta');
      return false;
    }

    if (data.session) {
      if (typeof toast === 'function') toast('¡Cuenta creada con éxito!');
      const priorKnown = typeof localStorage !== 'undefined' ? localStorage.getItem('orbitKnownUser') : null;
      if (typeof migrateLegacyStorageIfVerified === 'function') {
        migrateLegacyStorageIfVerified(data.session.user, priorKnown);
      }
      if (typeof setOrbitActiveUser === 'function') {
        setOrbitActiveUser(data.session.user);
      }
      updateAppAuthState(data.session.user);
      autoSyncOnInit(data.session);
    } else {
      if (typeof toast === 'function') {
        toast('Cuenta registrada. Por favor, comprueba tu email para confirmarla antes de entrar.');
      }
      setAuthTab('login');
    }
    return true;
  } catch (err) {
    if (signupBtn) { signupBtn.disabled = false; signupBtn.textContent = 'Crear mi cuenta'; }
    resetTurnstile('signup');
    if (typeof toast === 'function') toast('Error de conexión al registrar cuenta');
    return false;
  }
}

// Recuperación de contraseña oficial
async function supabaseResetPassword(email) {
  const sb = getSupabase();
  if (!sb) return toast('Servicio en la nube no disponible');
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return toast('Introduce un correo válido');
  }

  try {
    const redirectUrl = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl
    });
    if (error) {
      return toast(error.message || 'No se pudo enviar el correo');
    }
    toast('Si el correo está registrado, recibirás un enlace de recuperación');
    closeModal('forgotPasswordModal');
  } catch (e) {
    toast('Error al solicitar recuperación');
  }
}

// Actualización de contraseña desde Ajustes
async function supabaseUpdatePassword(newPassword) {
  const sb = getSupabase();
  if (!sb || !currentCloudUser) return toast('Inicia sesión en la nube primero');
  const passError = validatePasswordRequirements(newPassword);
  if (passError) {
    return toast(passError);
  }
  try {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) return toast(error.message || 'Error al actualizar contraseña');
    toast('Contraseña actualizada correctamente');
  } catch (e) {
    toast('Error al actualizar contraseña');
  }
}

// Actualización de email desde Ajustes
async function supabaseUpdateEmail(newEmail) {
  const sb = getSupabase();
  if (!sb || !currentCloudUser) return toast('Inicia sesión en la nube primero');
  const clean = String(newEmail || '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) return toast('Introduce un email válido');
  try {
    const { error } = await sb.auth.updateUser({ email: clean });
    if (error) return toast(error.message || 'Error al cambiar email');
    toast('Solicitud enviada. Revisa ambos correos para confirmar el cambio.');
  } catch (e) {
    toast('Error al actualizar email');
  }
}

// Sincronización del perfil desde Supabase (fuente de verdad)
async function syncUserProfileFromCloud(user) {
  const sb = getSupabase();
  const userId = user?.id || currentCloudUser?.id || (typeof getOrbitActiveUserId === 'function' ? getOrbitActiveUserId() : null);
  if (!sb || !userId) return;

  try {
    const { data: profile, error } = await sb
      .from('profiles')
      .select('username, display_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !profile) return;

    let d = (typeof load === 'function') ? load() : null;
    if (d) {
      if (!d.profile) d.profile = {};
      let changed = false;
      if (profile.username && d.profile.username !== profile.username) {
        d.profile.username = profile.username;
        changed = true;
      }
      if (profile.display_name && d.profile.displayName !== profile.display_name) {
        d.profile.displayName = profile.display_name;
        changed = true;
      }
      if (changed && typeof save === 'function') {
        save(d);
        if (typeof renderProfile === 'function') renderProfile(d);
        if (typeof render === 'function') render();
      }
    }
  } catch (e) {}
}

// Actualización del perfil en Supabase (public.profiles) como fuente de verdad
async function supabaseUpdateProfile({ username, displayName }) {
  const sb = getSupabase();
  if (!sb || !currentCloudUser) {
    return { success: true, localOnly: true };
  }

  const updates = {
    updated_at: new Date().toISOString()
  };

  if (typeof username === 'string' && username.length > 0) {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return {
        success: false,
        error: 'El nombre de usuario debe tener entre 3 y 20 caracteres (solo letras, números y _)'
      };
    }
    updates.username = cleanUsername;
  }

  if (typeof displayName === 'string') {
    updates.display_name = displayName.trim() || (updates.username || 'Viajero Orbit');
  }

  try {
    const { error } = await sb
      .from('profiles')
      .update(updates)
      .eq('user_id', currentCloudUser.id);

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Ese nombre de usuario ya está en uso' };
      }
      return { success: false, error: error.message || 'Error al actualizar el perfil' };
    }

    return { success: true, updates };
  } catch (e) {
    return { success: false, error: 'Error de conexión al actualizar el perfil' };
  }
}

// Eliminación definitiva y segura de la cuenta y sus datos asociados
async function supabaseDeleteAccount() {
  const sb = getSupabase();
  if (!sb || !currentCloudUser) {
    if (typeof toast === 'function') toast('No hay sesión activa para eliminar');
    return false;
  }

  const userIdToDelete = currentCloudUser.id;
  const deleteBtn = document.getElementById('confirmDeleteAccountBtn');
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Eliminando cuenta permanentemente…';
  }

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Eliminar mi cuenta para siempre';
      }
      if (typeof toast === 'function') toast('Sesión no válida. Inicia sesión de nuevo');
      return false;
    }

    const { data, error } = await sb.functions.invoke('delete-account', {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error || !data?.success) {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Eliminar mi cuenta para siempre';
      }
      const errMsg = error?.message || data?.error || 'No se pudo eliminar la cuenta. Inténtalo de nuevo';
      if (typeof toast === 'function') toast(errMsg);
      return false;
    }

    // Servidor confirmó eliminación exitosa: purgar datos locales de este usuario
    if (typeof purgeLocalUserData === 'function') {
      purgeLocalUserData(userIdToDelete);
    }

    clearTimeout(syncDebounceTimer);
    clearTimeout(foregroundSyncTimer);
    hasConflict = false;
    signedUrlCache.clear();
    currentCloudUser = null;

    if (typeof resetTurnstile === 'function') {
      resetTurnstile();
    }

    await sb.auth.signOut().catch(() => {});

    if (typeof closeModal === 'function') {
      closeModal('deleteAccountModal');
    }
    const confirmInput = document.getElementById('deleteAccountConfirmInput');
    if (confirmInput) confirmInput.value = '';

    if (typeof toast === 'function') toast('Cuenta eliminada definitivamente');
    updateAppAuthState(null);
    return true;
  } catch (err) {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Eliminar mi cuenta para siempre';
    }
    if (typeof toast === 'function') toast('Error de conexión al eliminar la cuenta');
    return false;
  }
}

// Cierre de sesión seguro con limpieza total de memoria y temporizadores
async function supabaseLogout() {
  const sb = getSupabase();
  clearTimeout(syncDebounceTimer);
  clearTimeout(foregroundSyncTimer);
  hasConflict = false;
  signedUrlCache.clear();

  if (typeof clearUrgeTimerMemory === 'function') {
    clearUrgeTimerMemory();
  }
  if (typeof clearActiveFormInputs === 'function') {
    clearActiveFormInputs();
  }

  currentCloudUser = null;
  if (typeof setOrbitActiveUser === 'function') {
    setOrbitActiveUser(null);
  }

  if (typeof resetTurnstile === 'function') {
    resetTurnstile();
  }

  if (sb) {
    await sb.auth.signOut().catch(() => {});
  }
  if (typeof toast === 'function') toast('Sesión cerrada');
  updateAppAuthState(null);
}


// Comprobación de errores de sesión expirada o token no autorizado
function isSessionExpiredError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '');
  const status = Number(err.status || 0);
  return (
    status === 401 ||
    code === 'PGRST301' ||
    code === '401' ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('token is expired') ||
    msg.includes('unauthorized') ||
    msg.includes('refresh_token_not_found')
  );
}

let hasNotifiedSessionExpiry = false;

// Verificación y renovación de sesión activa
async function ensureValidSession() {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session || !session.user) {
      const { data: refreshData, error: refreshError } = await sb.auth.refreshSession();
      if (refreshError || !refreshData?.session?.user) {
        updateAppAuthState(null);
        updateSyncStatus('session_expired');
        if (typeof toast === 'function' && !hasNotifiedSessionExpiry) {
          hasNotifiedSessionExpiry = true;
          toast('Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.');
        }
        return null;
      }
      hasNotifiedSessionExpiry = false;
      currentCloudUser = refreshData.session.user;
      return refreshData.session;
    }

    const expiresAt = (session.expires_at || 0) * 1000;
    if (expiresAt > 0 && (expiresAt - Date.now()) < 60000) {
      const { data: refreshData } = await sb.auth.refreshSession();
      if (refreshData?.session) {
        currentCloudUser = refreshData.session.user;
        return refreshData.session;
      }
    }

    hasNotifiedSessionExpiry = false;
    currentCloudUser = session.user;
    return session;
  } catch (err) {
    updateSyncStatus('error');
    return null;
  }
}

// Creación de copia de seguridad local antes de operaciones críticas
function createPreSyncBackup(userId, label, data, timer) {
  if (!userId || typeof localStorage === 'undefined' || !data) return;
  try {
    const backupKey = `orbit_backup_pre_${label}_${userId}_${Date.now()}`;
    const payload = {
      app: 'orbit',
      label,
      userId,
      savedAt: Date.now(),
      savedAtIso: new Date().toISOString(),
      orbitData: data || null,
      orbitTimer: timer || null
    };
    localStorage.setItem(backupKey, JSON.stringify(payload));
    cleanOldBackups(userId, label);
  } catch (e) {}
}

function cleanOldBackups(userId, label) {
  try {
    const prefix = `orbit_backup_pre_${label}_${userId}_`;
    const matching = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        matching.push(k);
      }
    }
    if (matching.length > 5) {
      matching.sort();
      const toRemove = matching.slice(0, matching.length - 5);
      toRemove.forEach(k => {
        try { localStorage.removeItem(k); } catch (e) {}
      });
    }
  } catch (e) {}
}

// Aplicar estado de la nube de forma segura y aislada por usuario
function safeApplyCloudState(cloudData, cloudTimer, cloudUpdatedAt, userId) {
  const uid = userId || currentCloudUser?.id || (typeof getOrbitActiveUserId === 'function' ? getOrbitActiveUserId() : null);
  if (!uid || !cloudData) return;

  const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : `orbitV9:${uid}`;
  const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : `orbitTimer:${uid}`;
  const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', uid) : `orbitLocalUpdatedAt:${uid}`;
  const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : `orbitLastCloudUpdatedAt:${uid}`;
  const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : `orbitHasUnsyncedChanges:${uid}`;

  // Respaldo del estado local previo si contiene datos reales
  let currentLocalData = null;
  let currentLocalTimer = null;
  try { currentLocalData = JSON.parse(localStorage.getItem(v9Key)); } catch (e) {}
  try { currentLocalTimer = JSON.parse(localStorage.getItem(timerKey)); } catch (e) {}
  if (currentLocalData && typeof isOrbitStateVirginOrEmpty === 'function' && !isOrbitStateVirginOrEmpty(currentLocalData)) {
    createPreSyncBackup(uid, 'cloud_apply', currentLocalData, currentLocalTimer);
  }

  if (typeof window !== 'undefined') window.isApplyingCloudState = true;
  try {
    localStorage.setItem(v9Key, JSON.stringify(cloudData));
    if (cloudTimer) {
      localStorage.setItem(timerKey, JSON.stringify(cloudTimer));
    } else {
      localStorage.removeItem(timerKey);
    }
    if (cloudUpdatedAt) {
      localStorage.setItem(localUpKey, cloudUpdatedAt);
      localStorage.setItem(cloudUpKey, cloudUpdatedAt);
    }
    localStorage.setItem(unsyncKey, 'false');
    hasConflict = false;

    if (typeof load === 'function') load(uid);
    if (typeof render === 'function') render();
    if (typeof syncUrgeTimer === 'function') syncUrgeTimer();
    if (typeof renderArchive === 'function') renderArchive();
  } finally {
    if (typeof window !== 'undefined') window.isApplyingCloudState = false;
  }
}

// Sincronización automática al iniciar, recuperar foco o conexión
async function autoSyncOnInit(session) {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    updateSyncStatus('offline');
    return;
  }

  const validSession = await ensureValidSession();
  if (!validSession || !validSession.user) {
    return;
  }

  const uid = validSession.user.id;
  currentCloudUser = validSession.user;

  if (typeof migrateLegacyStorageIfVerified === 'function') {
    migrateLegacyStorageIfVerified(validSession.user);
  }
  if (typeof syncUserProfileFromCloud === 'function') {
    syncUserProfileFromCloud(validSession.user);
  }

  try {
    let { data: cloudRow, error } = await sb
      .from('orbit_state')
      .select('orbit_data, orbit_timer, updated_at')
      .eq('user_id', uid)
      .maybeSingle();

    if (error && isSessionExpiredError(error)) {
      const refreshed = await ensureValidSession();
      if (refreshed) {
        const retryRes = await sb
          .from('orbit_state')
          .select('orbit_data, orbit_timer, updated_at')
          .eq('user_id', uid)
          .maybeSingle();
        cloudRow = retryRes.data;
        error = retryRes.error;
      }
    }

    if (error) {
      updateSyncStatus('error');
      return;
    }

    const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : `orbitV9:${uid}`;
    const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : `orbitLastCloudUpdatedAt:${uid}`;
    const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : `orbitHasUnsyncedChanges:${uid}`;

    let localData = null;
    try { localData = JSON.parse(localStorage.getItem(v9Key)); } catch (e) {}
    if (!localData && typeof load === 'function') localData = load(uid);

    const isLocalVirgin = typeof isOrbitStateVirginOrEmpty === 'function'
      ? isOrbitStateVirginOrEmpty(localData)
      : false;

    const hasCloudRow = Boolean(cloudRow && cloudRow.orbit_data && typeof cloudRow.orbit_data === 'object');
    const isCloudVirgin = hasCloudRow && typeof isOrbitStateVirginOrEmpty === 'function'
      ? isOrbitStateVirginOrEmpty(cloudRow.orbit_data)
      : false;
    const hasRealCloudData = hasCloudRow && !isCloudVirgin;

    // CASO 1: Dispositivo nuevo / local virgen Y la nube tiene datos reales -> DESCARGAR SIEMPRE
    if (isLocalVirgin && hasRealCloudData) {
      safeApplyCloudState(cloudRow.orbit_data, cloudRow.orbit_timer, cloudRow.updated_at, uid);
      updateSyncStatus('synced');
      return;
    }

    // CASO 2: La nube NO tiene datos reales Y local tiene progreso real -> SUBIR LOCAL
    if (!hasRealCloudData && !isLocalVirgin) {
      await performAutoUpload();
      return;
    }

    // CASO 3: Ambos están vírgenes
    if (isLocalVirgin && !hasRealCloudData) {
      localStorage.setItem(unsyncKey, 'false');
      hasConflict = false;
      updateSyncStatus('synced');
      return;
    }

    // CASO 4: Ambos tienen datos reales -> Comparar marcas de tiempo
    const cloudUpdatedAt = cloudRow.updated_at;
    const cloudTime = new Date(cloudUpdatedAt).getTime();
    const lastKnownCloud = localStorage.getItem(cloudUpKey);
    const lastKnownCloudTime = lastKnownCloud ? new Date(lastKnownCloud).getTime() : 0;
    const hasUnsynced = localStorage.getItem(unsyncKey) === 'true';

    const isCloudNewer = lastKnownCloudTime > 0
      ? cloudTime > (lastKnownCloudTime + 1000)
      : false;

    // Conflicto REAL: La nube cambió remotamente Y este cliente tiene cambios locales no sincronizados
    if (isCloudNewer && hasUnsynced && !isLocalVirgin) {
      hasConflict = true;
      updateSyncStatus('conflict');
      return;
    }

    // Nube más nueva y local sin cambios pendientes -> Descargar
    if (isCloudNewer && !hasUnsynced) {
      safeApplyCloudState(cloudRow.orbit_data, cloudRow.orbit_timer, cloudUpdatedAt, uid);
      updateSyncStatus('synced');
      return;
    }

    // Local con cambios pendientes y nube no ha cambiado -> Subir
    if (hasUnsynced && !isCloudNewer) {
      await performAutoUpload();
      return;
    }

    // Ambos sincronizados y coherentes
    localStorage.setItem(cloudUpKey, cloudUpdatedAt);
    localStorage.setItem(unsyncKey, 'false');
    hasConflict = false;
    updateSyncStatus('synced');
  } catch (err) {
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

// Subida automática a Supabase con guardias anti-pisado
async function performAutoUpload() {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    updateSyncStatus('offline');
    return;
  }
  if (typeof window !== 'undefined' && window.isApplyingCloudState) return;

  const validSession = await ensureValidSession();
  if (!validSession || !validSession.user) {
    return;
  }
  currentCloudUser = validSession.user;
  const uid = validSession.user.id;

  if (isSyncing) {
    pendingSync = true;
    return;
  }
  isSyncing = true;
  updateSyncStatus('saving');

  try {
    const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : `orbitV9:${uid}`;
    const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : `orbitTimer:${uid}`;
    const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', uid) : `orbitLocalUpdatedAt:${uid}`;
    const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : `orbitLastCloudUpdatedAt:${uid}`;
    const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : `orbitHasUnsyncedChanges:${uid}`;

    let orbitData = null;
    try { orbitData = JSON.parse(localStorage.getItem(v9Key)); } catch (e) {}
    if (!orbitData && typeof load === 'function') orbitData = load(uid);

    const isLocalVirgin = typeof isOrbitStateVirginOrEmpty === 'function'
      ? isOrbitStateVirginOrEmpty(orbitData)
      : false;

    let orbitTimer = null;
    try {
      const raw = localStorage.getItem(timerKey);
      if (raw) orbitTimer = JSON.parse(raw);
    } catch (e) {}

    // 1. Verificar estado actual de la nube antes de cualquier sobreescritura
    let { data: cloudCheck, error: checkErr } = await sb
      .from('orbit_state')
      .select('orbit_data, orbit_timer, updated_at')
      .eq('user_id', uid)
      .maybeSingle();

    if (checkErr && isSessionExpiredError(checkErr)) {
      const refreshed = await ensureValidSession();
      if (refreshed) {
        const retryRes = await sb
          .from('orbit_state')
          .select('orbit_data, orbit_timer, updated_at')
          .eq('user_id', uid)
          .maybeSingle();
        cloudCheck = retryRes.data;
        checkErr = retryRes.error;
      }
    }

    if (checkErr) {
      isSyncing = false;
      updateSyncStatus('error');
      return;
    }

    const hasRealCloudData = Boolean(
      cloudCheck &&
      cloudCheck.orbit_data &&
      typeof isOrbitStateVirginOrEmpty === 'function' &&
      !isOrbitStateVirginOrEmpty(cloudCheck.orbit_data)
    );

    // GUARDIA ANTI-PISADO ESTRICTA:
    // Un estado local virgen jamás puede sobrescribir una nube que tiene datos reales
    if (isLocalVirgin && hasRealCloudData) {
      console.warn('[SYNC GUARD] Intento de sobreescribir nube con estado virgen bloqueado. Descargando datos de la nube.');
      isSyncing = false;
      safeApplyCloudState(cloudCheck.orbit_data, cloudCheck.orbit_timer, cloudCheck.updated_at, uid);
      updateSyncStatus('synced');
      return;
    }

    // Guardia de conflicto: Nube modificada remotamente mientras local tiene cambios no vírgenes
    if (cloudCheck && cloudCheck.updated_at) {
      const cloudTime = new Date(cloudCheck.updated_at).getTime();
      const lastKnownCloud = localStorage.getItem(cloudUpKey);
      const lastKnownCloudTime = lastKnownCloud ? new Date(lastKnownCloud).getTime() : 0;
      const hasUnsynced = localStorage.getItem(unsyncKey) === 'true';

      if (lastKnownCloudTime > 0 && cloudTime > (lastKnownCloudTime + 1000) && hasUnsynced && !isLocalVirgin) {
        hasConflict = true;
        isSyncing = false;
        updateSyncStatus('conflict');
        return;
      }
    }

    // 2. Backup de seguridad antes de la subida
    createPreSyncBackup(uid, 'cloud_upload', orbitData, orbitTimer);

    const nowIso = new Date().toISOString();
    localStorage.setItem(localUpKey, nowIso);

    const payload = {
      user_id: uid,
      orbit_data: orbitData,
      orbit_timer: orbitTimer,
      updated_at: nowIso
    };

    let { data: upsertData, error: upsertErr } = await sb
      .from('orbit_state')
      .upsert(payload, { onConflict: 'user_id' })
      .select('updated_at')
      .maybeSingle();

    if (upsertErr && isSessionExpiredError(upsertErr)) {
      const refreshed = await ensureValidSession();
      if (refreshed) {
        const retryRes = await sb
          .from('orbit_state')
          .upsert(payload, { onConflict: 'user_id' })
          .select('updated_at')
          .maybeSingle();
        upsertData = retryRes.data;
        upsertErr = retryRes.error;
      }
    }

    isSyncing = false;

    if (upsertErr) {
      updateSyncStatus('error');
    } else {
      const confirmedTime = upsertData?.updated_at || nowIso;
      localStorage.setItem(cloudUpKey, confirmedTime);
      localStorage.setItem(unsyncKey, 'false');
      hasConflict = false;
      updateSyncStatus('synced');
    }
  } catch (err) {
    isSyncing = false;
    updateSyncStatus('error');
  }

  if (pendingSync) {
    pendingSync = false;
    scheduleCloudSync();
  }
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
        if (typeof setOrbitActiveUser === 'function') setOrbitActiveUser(null);
        updateAppAuthState(null);
      } else if (session?.user) {
        if (typeof setOrbitActiveUser === 'function') setOrbitActiveUser(session.user);
        updateAppAuthState(session.user);
        if (event === 'SIGNED_IN') {
          autoSyncOnInit(session);
        }
      }
    });
  } catch (err) {
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

  if (typeof initTurnstileWidgets === 'function') {
    initTurnstileWidgets();
  }
}

function setAuthTab(tab) {
  const loginTab = document.getElementById('authTabLogin');
  const signupTab = document.getElementById('authTabSignup');
  const loginForm = document.getElementById('authLoginForm');
  const signupForm = document.getElementById('authSignupForm');

  if (tab === 'signup') {
    if (loginTab) loginTab.classList.remove('active');
    if (signupTab) signupTab.classList.add('active');
    if (loginForm) loginForm.style.display = 'none';
    if (signupForm) signupForm.style.display = 'flex';
  } else {
    if (signupTab) signupTab.classList.remove('active');
    if (loginTab) loginTab.classList.add('active');
    if (signupForm) signupForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'flex';
  }

  if (typeof initTurnstileWidgets === 'function') {
    initTurnstileWidgets();
  }
}

function handleCloudLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const idInput = document.getElementById('cloudLoginIdentifier');
  const passInput = document.getElementById('cloudLoginPassword');
  const identifier = idInput ? idInput.value.trim() : '';
  const password = passInput ? passInput.value : '';

  if (!identifier || !password) {
    if (typeof toast === 'function') toast('Introduce usuario/email y contraseña');
    return;
  }

  supabaseLogin(identifier, password);
}

function handleCloudSignupSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const emailInput = document.getElementById('cloudSignupEmail');
  const usernameInput = document.getElementById('cloudSignupUsername');
  const passInput = document.getElementById('cloudSignupPassword');
  const passRepeatInput = document.getElementById('cloudSignupPasswordRepeat');

  const email = emailInput ? emailInput.value.trim() : '';
  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passInput ? passInput.value : '';
  const passwordRepeat = passRepeatInput ? passRepeatInput.value : '';

  if (!email || !username || !password || !passwordRepeat) {
    if (typeof toast === 'function') toast('Completa todos los campos para registrarte');
    return;
  }

  if (password !== passwordRepeat) {
    if (typeof toast === 'function') toast('Las contraseñas no coinciden');
    return;
  }

  supabaseSignUp(email, username, password);
}

function handleForgotPasswordSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const emailInput = document.getElementById('forgotPasswordEmail');
  const email = emailInput ? emailInput.value.trim() : '';
  if (!email) {
    if (typeof toast === 'function') toast('Introduce tu correo electrónico');
    return;
  }
  supabaseResetPassword(email);
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
