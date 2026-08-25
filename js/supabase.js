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
let currentSyncConflict = null;
let lastCloudSyncSuccessTime = null;
let lastCloudBackupTime = null;
let syncProtectionReason = '';
let currentSyncState = 'synced';

function getCurrentSyncConflict() {
  return currentSyncConflict;
}

if (typeof window !== 'undefined') {
  window.isApplyingCloudState = false;
}

function formatRelativeTime(ts) {
  if (!ts) return 'pendiente';
  const diff = Date.now() - ts;
  if (diff < 30000) return 'hace un momento';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function getCloudSyncSummary() {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  let status = currentSyncState;
  if (offline) status = 'offline';
  else if (hasConflict) status = 'conflict';

  let title = 'Tus datos están seguros';
  let subtitle = 'Todo guardado · Copias activas';

  if (status === 'offline') {
    title = 'Modo sin conexión';
    subtitle = 'Trabajando en este dispositivo';
  } else if (status === 'saving') {
    title = 'Guardando en la nube…';
    subtitle = 'Sincronizando cambios con tu cuenta';
  } else if (status === 'conflict') {
    title = 'Cambios pendientes de revisar';
    subtitle = 'Protección de datos activa · Sin pérdidas';
  } else if (status === 'error' || status === 'session_expired') {
    title = 'Atención requerida';
    subtitle = status === 'session_expired' ? 'Sesión caducada · Vuelve a entrar' : 'Reintentando conexión con la nube';
  } else if (lastCloudSyncSuccessTime) {
    title = 'Tus datos están seguros';
    subtitle = `Sincronizado ${formatRelativeTime(lastCloudSyncSuccessTime)} · Copias activas`;
  }

  return {
    status,
    hasConflict,
    conflictReason: syncProtectionReason,
    title,
    subtitle,
    lastSyncText: lastCloudSyncSuccessTime ? formatRelativeTime(lastCloudSyncSuccessTime) : 'reciente',
    lastBackupText: lastCloudBackupTime ? formatRelativeTime(lastCloudBackupTime) : 'activa'
  };
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
  currentSyncState = status;
  if (typeof document === 'undefined') return;
  updateCloudHeaderStatus(status);

  const summary = getCloudSyncSummary();

  // 1. Tarjeta en la pantalla de Ajustes
  const cardTitle = document.getElementById('cloudCardTitle');
  const cardSubtitle = document.getElementById('cloudCardSubtitle');
  const cardIconWrap = document.getElementById('cloudCardIconWrap');
  if (cardTitle) cardTitle.textContent = summary.title;
  if (cardSubtitle) cardSubtitle.textContent = summary.subtitle;

  if (cardIconWrap) {
    if (summary.status === 'saving') {
      cardIconWrap.style.color = '#2e7d32';
      cardIconWrap.innerHTML = `<svg class="icon" viewBox="0 0 24 24" style="animation:photoSpin 1s linear infinite;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M12 12v4M10 14l2-2 2 2"/></svg>`;
    } else if (summary.status === 'conflict' || summary.status === 'error' || summary.status === 'offline') {
      cardIconWrap.style.color = '#c27d38';
      cardIconWrap.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="12" y1="12" x2="12" y2="15"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>`;
    } else {
      cardIconWrap.style.color = '#2e7d32';
      cardIconWrap.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="8.5 14.5 11 17 15.5 11.5" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>`;
    }
  }

  // 2. Elementos del Modal de Detalles de Nube
  const modalStatusBadge = document.getElementById('cloudModalStatusBadge');
  const modalStatusDot = document.getElementById('cloudModalStatusDot');
  const modalStatusText = document.getElementById('cloudModalStatusText');
  const modalSyncTime = document.getElementById('cloudModalSyncTime');
  const modalBackupTime = document.getElementById('cloudModalBackupTime');
  const modalConflictBox = document.getElementById('cloudModalConflictBox');
  const modalConflictDesc = document.getElementById('cloudModalConflictDesc');

  if (modalStatusText) {
    if (summary.status === 'offline') {
      modalStatusText.textContent = 'Sin conexión';
      if (modalStatusDot) modalStatusDot.style.background = '#c27d38';
      if (modalStatusBadge) {
        modalStatusBadge.style.color = '#c27d38';
        modalStatusBadge.style.borderColor = 'rgba(194,125,56,0.25)';
        modalStatusBadge.style.background = 'rgba(194,125,56,0.08)';
      }
    } else if (summary.status === 'conflict') {
      modalStatusText.textContent = customMessage || 'Cambios pendientes de revisar';
      if (modalStatusDot) modalStatusDot.style.background = '#c27d38';
      if (modalStatusBadge) {
        modalStatusBadge.style.color = '#c27d38';
        modalStatusBadge.style.borderColor = 'rgba(194,125,56,0.25)';
        modalStatusBadge.style.background = 'rgba(194,125,56,0.08)';
      }
    } else if (summary.status === 'saving') {
      modalStatusText.textContent = 'Guardando en la nube…';
      if (modalStatusDot) modalStatusDot.style.background = '#2e7d32';
      if (modalStatusBadge) {
        modalStatusBadge.style.color = '#2e7d32';
        modalStatusBadge.style.borderColor = 'rgba(46,125,50,0.2)';
        modalStatusBadge.style.background = 'rgba(46,125,50,0.08)';
      }
    } else if (summary.status === 'error' || summary.status === 'session_expired') {
      modalStatusText.textContent = summary.status === 'session_expired' ? 'Sesión expirada' : 'Error de sincronización';
      if (modalStatusDot) modalStatusDot.style.background = '#c27d38';
      if (modalStatusBadge) {
        modalStatusBadge.style.color = '#c27d38';
        modalStatusBadge.style.borderColor = 'rgba(194,125,56,0.25)';
        modalStatusBadge.style.background = 'rgba(194,125,56,0.08)';
      }
    } else {
      modalStatusText.textContent = 'Sincronizado';
      if (modalStatusDot) modalStatusDot.style.background = '#2e7d32';
      if (modalStatusBadge) {
        modalStatusBadge.style.color = '#2e7d32';
        modalStatusBadge.style.borderColor = 'rgba(46,125,50,0.2)';
        modalStatusBadge.style.background = 'rgba(46,125,50,0.08)';
      }
    }
  }

  if (modalSyncTime) modalSyncTime.textContent = summary.lastSyncText;
  if (modalBackupTime) modalBackupTime.textContent = summary.lastBackupText;

  if (modalConflictBox) {
    if (summary.hasConflict) {
      modalConflictBox.style.display = 'block';
      if (modalConflictDesc) {
        modalConflictDesc.textContent = summary.conflictReason || 'Se ha pausado la sincronización automática preventiva para evitar sobreescrituras accidentales. Ambas versiones están protegidas.';
      }
    } else {
      modalConflictBox.style.display = 'none';
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
  const offline = isOffline || (typeof navigator !== 'undefined' && navigator.onLine === false);

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
        save(d, false, userId);
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
function safeApplyCloudState(cloudData, cloudTimer, cloudUpdatedAt, userId, options = {}) {
  const uid = userId || currentCloudUser?.id || (typeof getOrbitActiveUserId === 'function' ? getOrbitActiveUserId() : null);
  if (!uid || !cloudData) {
    return { ok: false, status: 'error', reason: 'no_user_or_data' };
  }

  const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : `orbitV9:${uid}`;
  const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : `orbitTimer:${uid}`;
  const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', uid) : `orbitLocalUpdatedAt:${uid}`;
  const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : `orbitLastCloudUpdatedAt:${uid}`;
  const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : `orbitHasUnsyncedChanges:${uid}`;

  let currentLocalData = null;
  let currentLocalTimer = null;
  try { currentLocalData = JSON.parse(localStorage.getItem(v9Key)); } catch (e) {}
  try { currentLocalTimer = JSON.parse(localStorage.getItem(timerKey)); } catch (e) {}

  // GUARDIA DE REDUCCIÓN SOSPECHOSA (salvo que sea restauración intencionada explícita):
  if (!options.forceRestore && currentLocalData && typeof detectSuspiciousReduction === 'function') {
    const reductionCheck = detectSuspiciousReduction(currentLocalData, cloudData);
    if (reductionCheck.isSuspicious) {
      console.warn('[SYNC GUARD] Reducción sospechosa detectada de NUBE a LOCAL. Bloqueando descarga automática.', reductionCheck.reasons);
      hasConflict = true;
      syncProtectionReason = reductionCheck.reasons.join(' ');
      currentSyncConflict = {
        type: 'suspicious_reduction_cloud_to_local',
        reason: syncProtectionReason,
        localData: currentLocalData,
        localTimer: currentLocalTimer,
        localUpdatedAt: localStorage.getItem(localUpKey) || null,
        cloudData: cloudData,
        cloudTimer: cloudTimer,
        cloudUpdatedAt: cloudUpdatedAt,
        localMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(currentLocalData) : {},
        cloudMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(cloudData) : {},
        detectedAt: Date.now()
      };
      updateSyncStatus('conflict', 'Cambios pendientes de revisar');
      return {
        ok: false,
        status: 'conflict',
        reason: 'suspicious_reduction_detected',
        details: reductionCheck.reasons
      };
    }
  }

  // Respaldo del estado local previo si contiene datos reales
  if (currentLocalData && typeof isOrbitStateVirginOrEmpty === 'function' && !isOrbitStateVirginOrEmpty(currentLocalData)) {
    createPreSyncBackup(uid, options.forceRestore ? 'restore_backup' : 'cloud_apply', currentLocalData, currentLocalTimer);
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
    currentSyncConflict = null;
    syncProtectionReason = '';
    lastCloudSyncSuccessTime = Date.now();

    if (typeof load === 'function') load(uid);
    if (typeof render === 'function') render();
    if (typeof syncUrgeTimer === 'function') syncUrgeTimer();
    if (typeof renderArchive === 'function') renderArchive();

    return { ok: true, status: 'applied' };
  } catch (e) {
    return { ok: false, status: 'error', reason: e.message };
  } finally {
    if (typeof window !== 'undefined') window.isApplyingCloudState = false;
  }
}

// Sincronización automática al iniciar, recuperar foco o conexión
async function autoSyncOnInit(session) {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    updateSyncStatus('offline');
    return { ok: false, status: 'offline' };
  }

  const validSession = await ensureValidSession();
  if (!validSession || !validSession.user) {
    return { ok: false, status: 'no_session' };
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
      return { ok: false, status: 'error', error };
    }

    const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : `orbitV9:${uid}`;
    const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : `orbitTimer:${uid}`;
    const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', uid) : `orbitLocalUpdatedAt:${uid}`;
    const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : `orbitLastCloudUpdatedAt:${uid}`;
    const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : `orbitHasUnsyncedChanges:${uid}`;

    let localData = null;
    try { localData = JSON.parse(localStorage.getItem(v9Key)); } catch (e) {}
    if (!localData && typeof load === 'function') localData = load(uid);

    let localTimer = null;
    try {
      const rawTimer = localStorage.getItem(timerKey);
      if (rawTimer) localTimer = JSON.parse(rawTimer);
    } catch (e) {}

    const isLocalVirgin = typeof isOrbitStateVirginOrEmpty === 'function'
      ? isOrbitStateVirginOrEmpty(localData)
      : false;

    const hasCloudRow = Boolean(cloudRow && cloudRow.orbit_data && typeof cloudRow.orbit_data === 'object');
    const isCloudVirgin = hasCloudRow && typeof isOrbitStateVirginOrEmpty === 'function'
      ? isOrbitStateVirginOrEmpty(cloudRow.orbit_data)
      : false;
    const hasRealCloudData = hasCloudRow && !isCloudVirgin;

    const lastKnownCloud = localStorage.getItem(cloudUpKey);
    const lastKnownCloudTime = lastKnownCloud ? new Date(lastKnownCloud).getTime() : 0;
    const hasUnsynced = localStorage.getItem(unsyncKey) === 'true';

    // CASO 1: Dispositivo nuevo / local virgen / sin sync previa Y la nube tiene datos reales -> DESCARGAR SIEMPRE
    if ((isLocalVirgin || lastKnownCloudTime === 0) && hasRealCloudData && !hasUnsynced) {
      const applyRes = safeApplyCloudState(cloudRow.orbit_data, cloudRow.orbit_timer, cloudRow.updated_at, uid);
      if (applyRes && applyRes.ok) {
        updateSyncStatus('synced');
      }
      return applyRes;
    }

    // CASO 2: La nube NO tiene datos reales Y local tiene progreso real -> SUBIR LOCAL
    if (!hasRealCloudData && !isLocalVirgin) {
      return await performAutoUpload();
    }

    // CASO 3: Ambos están vírgenes
    if (isLocalVirgin && !hasRealCloudData) {
      localStorage.setItem(unsyncKey, 'false');
      hasConflict = false;
      currentSyncConflict = null;
      syncProtectionReason = '';
      updateSyncStatus('synced');
      return { ok: true, status: 'synced_virgin' };
    }

    // CASO 4: Ambos tienen datos reales -> Comparar marcas de tiempo
    const cloudUpdatedAt = cloudRow.updated_at;
    const cloudTime = new Date(cloudUpdatedAt).getTime();

    const isCloudNewer = lastKnownCloudTime > 0
      ? cloudTime > (lastKnownCloudTime + 1000)
      : false;

    // Conflicto potencial: La nube cambió remotamente Y este cliente tiene cambios locales no sincronizados
    if (isCloudNewer && hasUnsynced && !isLocalVirgin) {
      if (typeof compareOrbitStateContent === 'function') {
        const contentComp = compareOrbitStateContent(localData, cloudRow.orbit_data);
        const reductionCheck = typeof detectSuspiciousReduction === 'function'
          ? detectSuspiciousReduction(localData, cloudRow.orbit_data)
          : { isSuspicious: false };

        // CASO A: Autorresolución NUBE -> LOCAL
        // Todo el contenido significativo local está contenido en nube, la nube es más reciente, no hay reducción sospechosa y nube tiene igual o mayor progreso monotónico
        if (
          (contentComp.status === 'local_is_subset_of_cloud' || contentComp.status === 'identical') &&
          !reductionCheck.isSuspicious &&
          !contentComp.localHasStrictlyHigherMonotonic
        ) {
          console.log('[AUTO_RECONCILE] Nube contiene todo el contenido local y es más reciente. Aplicando nube -> local automáticamente.');
          createPreSyncBackup(uid, 'auto_reconcile_cloud', localData, localTimer);
          try { await sb.rpc('create_manual_state_snapshot', { p_label: 'auto_reconcile_cloud' }); } catch(e) {}
          const applyRes = safeApplyCloudState(cloudRow.orbit_data, cloudRow.orbit_timer, cloudUpdatedAt, uid, { forceRestore: true });
          if (applyRes && applyRes.ok) {
            localStorage.setItem(cloudUpKey, cloudUpdatedAt);
            localStorage.setItem(unsyncKey, 'false');
            hasConflict = false;
            currentSyncConflict = null;
            syncProtectionReason = '';
            lastCloudSyncSuccessTime = Date.now();
            updateSyncStatus('synced');
            return { ok: true, status: 'auto_reconciled_cloud' };
          }
        }
      }

      // Si no cumple las condiciones de contención estricta (divergencia real o reducción):
      hasConflict = true;
      syncProtectionReason = 'La versión en la nube contiene cambios remotos y tienes cambios locales sin sincronizar.';
      currentSyncConflict = {
        type: 'remote_newer_with_local_unsynced',
        reason: syncProtectionReason,
        localData: localData,
        localTimer: localTimer,
        localUpdatedAt: localStorage.getItem(localUpKey) || null,
        cloudData: cloudRow.orbit_data,
        cloudTimer: cloudRow.orbit_timer,
        cloudUpdatedAt: cloudUpdatedAt,
        localMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(localData) : {},
        cloudMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(cloudRow.orbit_data) : {},
        detectedAt: Date.now()
      };
      updateSyncStatus('conflict', 'Cambios pendientes de revisar');
      return { ok: false, status: 'conflict', reason: 'remote_newer_with_local_unsynced' };
    }

    // Nube más nueva y local sin cambios pendientes -> Descargar
    if (isCloudNewer && !hasUnsynced) {
      const applyRes = safeApplyCloudState(cloudRow.orbit_data, cloudRow.orbit_timer, cloudUpdatedAt, uid);
      if (applyRes && applyRes.ok) {
        updateSyncStatus('synced');
      }
      return applyRes;
    }

    // Local con cambios pendientes y nube no ha cambiado -> Subir
    if (hasUnsynced && !isCloudNewer) {
      return await performAutoUpload();
    }

    // Ambos sincronizados y coherentes
    localStorage.setItem(cloudUpKey, cloudUpdatedAt);
    localStorage.setItem(unsyncKey, 'false');
    hasConflict = false;
    currentSyncConflict = null;
    syncProtectionReason = '';
    lastCloudSyncSuccessTime = Date.now();
    updateSyncStatus('synced');
    return { ok: true, status: 'synced' };
  } catch (err) {
    updateSyncStatus('error');
    return { ok: false, status: 'error', error: err.message };
  }
}

// Programar subida automática con debounce (1500 ms)
function scheduleCloudSync() {
  const activeUid = currentCloudUser?.id || (typeof getOrbitActiveUserId === 'function' ? getOrbitActiveUserId() : null);
  if (!activeUid || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  if (typeof window !== 'undefined' && window.isApplyingCloudState) return;
  if (hasConflict) return;

  updateSyncStatus('saving');
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    performAutoUpload();
  }, 1500);
}

// Subida automática a Supabase con guardias anti-pisado y detección de reducción
async function performAutoUpload() {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    updateSyncStatus('offline');
    return { ok: false, status: 'offline' };
  }
  if (typeof window !== 'undefined' && window.isApplyingCloudState) {
    return { ok: false, status: 'busy' };
  }

  const validSession = await ensureValidSession();
  if (!validSession || !validSession.user) {
    return { ok: false, status: 'no_session' };
  }
  currentCloudUser = validSession.user;
  const uid = validSession.user.id;

  if (isSyncing) {
    pendingSync = true;
    return { ok: false, status: 'queued' };
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
      return { ok: false, status: 'error', error: checkErr };
    }

    const hasRealCloudData = Boolean(
      cloudCheck &&
      cloudCheck.orbit_data &&
      typeof isOrbitStateVirginOrEmpty === 'function' &&
      !isOrbitStateVirginOrEmpty(cloudCheck.orbit_data)
    );

    // GUARDIA 1: Estado local virgen jamás sobreescribe nube con datos reales
    if (isLocalVirgin && hasRealCloudData) {
      console.warn('[SYNC GUARD] Intento de sobreescribir nube con estado virgen bloqueado. Descargando datos de la nube.');
      isSyncing = false;
      const applyRes = safeApplyCloudState(cloudCheck.orbit_data, cloudCheck.orbit_timer, cloudCheck.updated_at, uid);
      if (applyRes && applyRes.ok) {
        updateSyncStatus('synced');
      }
      return applyRes;
    }

    // GUARDIA 2: Reducción sospechosa de LOCAL a NUBE
    if (hasRealCloudData && typeof detectSuspiciousReduction === 'function') {
      const reductionCheck = detectSuspiciousReduction(cloudCheck.orbit_data, orbitData);
      if (reductionCheck.isSuspicious) {
        console.warn('[SYNC GUARD] Reducción sospechosa detectada de LOCAL a NUBE. Bloqueando subida automática.', reductionCheck.reasons);
        hasConflict = true;
        syncProtectionReason = reductionCheck.reasons.join(' ');
        currentSyncConflict = {
          type: 'suspicious_reduction_local_to_cloud',
          reason: syncProtectionReason,
          localData: orbitData,
          localTimer: orbitTimer,
          localUpdatedAt: localStorage.getItem(localUpKey) || null,
          cloudData: cloudCheck.orbit_data,
          cloudTimer: cloudCheck.orbit_timer,
          cloudUpdatedAt: cloudCheck.updated_at,
          localMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(orbitData) : {},
          cloudMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(cloudCheck.orbit_data) : {},
          detectedAt: Date.now()
        };
        isSyncing = false;
        updateSyncStatus('conflict', 'Cambios pendientes de revisar');
        return {
          ok: false,
          status: 'conflict',
          reason: 'suspicious_reduction_detected',
          details: reductionCheck.reasons
        };
      }
    }

    // GUARDIA 3: Conflicto por timestamp (nube más nueva con cambios locales pendientes)
    if (cloudCheck && cloudCheck.updated_at) {
      const cloudTime = new Date(cloudCheck.updated_at).getTime();
      const lastKnownCloud = localStorage.getItem(cloudUpKey);
      const lastKnownCloudTime = lastKnownCloud ? new Date(lastKnownCloud).getTime() : 0;
      const hasUnsynced = localStorage.getItem(unsyncKey) === 'true';

      if (lastKnownCloudTime > 0 && cloudTime > (lastKnownCloudTime + 1000) && hasUnsynced && !isLocalVirgin) {
        if (typeof compareOrbitStateContent === 'function') {
          const contentComp = compareOrbitStateContent(orbitData, cloudCheck.orbit_data);
          const reductionCheck = typeof detectSuspiciousReduction === 'function'
            ? detectSuspiciousReduction(orbitData, cloudCheck.orbit_data)
            : { isSuspicious: false };

          // CASO A: Nube contiene todo lo local -> Autorresolver Nube -> Local
          if (
            (contentComp.status === 'local_is_subset_of_cloud' || contentComp.status === 'identical') &&
            !reductionCheck.isSuspicious &&
            !contentComp.localHasStrictlyHigherMonotonic
          ) {
            console.log('[AUTO_RECONCILE] Subida detectó nube más completa. Aplicando nube -> local automáticamente.');
            isSyncing = false;
            createPreSyncBackup(uid, 'auto_reconcile_cloud', orbitData, orbitTimer);
            try { await sb.rpc('create_manual_state_snapshot', { p_label: 'auto_reconcile_cloud' }); } catch(e) {}
            const applyRes = safeApplyCloudState(cloudCheck.orbit_data, cloudCheck.orbit_timer, cloudCheck.updated_at, uid, { forceRestore: true });
            if (applyRes && applyRes.ok) {
              localStorage.setItem(cloudUpKey, cloudCheck.updated_at);
              localStorage.setItem(unsyncKey, 'false');
              hasConflict = false;
              currentSyncConflict = null;
              syncProtectionReason = '';
              lastCloudSyncSuccessTime = Date.now();
              updateSyncStatus('synced');
              return { ok: true, status: 'auto_reconciled_cloud' };
            }
          }

          // CASO B: Local contiene todo lo de la nube y no hay reducción sospechosa -> Autorresolver Local -> Nube
          if (
            contentComp.status === 'cloud_is_subset_of_local' &&
            !contentComp.cloudHasStrictlyHigherMonotonic
          ) {
            console.log('[AUTO_RECONCILE] Local contiene todo lo de la nube con adiciones. Subiendo local -> nube.');
            try { await sb.rpc('create_manual_state_snapshot', { p_label: 'pre_auto_reconcile_local' }); } catch(e) {}
            // Continúa hacia la subida normal abajo
          } else {
            // Hay divergencia real (datos exclusivos en ambos lados) -> Bloquear con conflicto manual
            hasConflict = true;
            syncProtectionReason = 'La versión en la nube ha sido actualizada remotamente y tienes cambios locales pendientes.';
            currentSyncConflict = {
              type: 'remote_newer_with_local_unsynced',
              reason: syncProtectionReason,
              localData: orbitData,
              localTimer: orbitTimer,
              localUpdatedAt: localStorage.getItem(localUpKey) || null,
              cloudData: cloudCheck.orbit_data,
              cloudTimer: cloudCheck.orbit_timer,
              cloudUpdatedAt: cloudCheck.updated_at,
              localMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(orbitData) : {},
              cloudMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(cloudCheck.orbit_data) : {},
              detectedAt: Date.now()
            };
            isSyncing = false;
            updateSyncStatus('conflict', 'Cambios pendientes de revisar');
            return {
              ok: false,
              status: 'conflict',
              reason: 'remote_newer_with_local_unsynced'
            };
          }
        } else {
          hasConflict = true;
          syncProtectionReason = 'La versión en la nube ha sido actualizada remotamente y tienes cambios locales pendientes.';
          currentSyncConflict = {
            type: 'remote_newer_with_local_unsynced',
            reason: syncProtectionReason,
            localData: orbitData,
            localTimer: orbitTimer,
            localUpdatedAt: localStorage.getItem(localUpKey) || null,
            cloudData: cloudCheck.orbit_data,
            cloudTimer: cloudCheck.orbit_timer,
            cloudUpdatedAt: cloudCheck.updated_at,
            localMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(orbitData) : {},
            cloudMetrics: typeof getOrbitStateMetrics === 'function' ? getOrbitStateMetrics(cloudCheck.orbit_data) : {},
            detectedAt: Date.now()
          };
          isSyncing = false;
          updateSyncStatus('conflict', 'Cambios pendientes de revisar');
          return {
            ok: false,
            status: 'conflict',
            reason: 'remote_newer_with_local_unsynced'
          };
        }
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
      console.error('[AUTO_UPLOAD] Error al sincronizar con Supabase:', upsertErr);
      updateSyncStatus('error');
      return { ok: false, status: 'error', error: upsertErr };
    } else {
      const confirmedTime = upsertData?.updated_at || nowIso;
      localStorage.setItem(cloudUpKey, confirmedTime);
      localStorage.setItem(unsyncKey, 'false');
      hasConflict = false;
      syncProtectionReason = '';
      lastCloudSyncSuccessTime = Date.now();
      updateSyncStatus('synced');
      return { ok: true, status: 'uploaded', updated_at: confirmedTime };
    }
  } catch (err) {
    console.error('[AUTO_UPLOAD] Excepción en subida:', err);
    isSyncing = false;
    updateSyncStatus('error');
    return { ok: false, status: 'exception', error: err.message };
  } finally {
    if (pendingSync) {
      pendingSync = false;
      scheduleCloudSync();
    }
  }
}

// Crear copia de seguridad manual en la nube (server-side snapshot con protecciones)
async function createCloudSnapshotNow(label) {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    if (typeof toast === 'function') toast('Se requiere conexión a Internet');
    return { ok: false, error: 'offline' };
  }

  // GUARDIA 1: Si hay conflicto activo, no permitir snapshot manual
  if (hasConflict) {
    if (typeof toast === 'function') toast('Antes de crear una copia, revisa los cambios pendientes.');
    return { ok: false, error: 'has_conflict' };
  }

  const validSession = await ensureValidSession();
  if (!validSession || !validSession.user) {
    if (typeof toast === 'function') toast('Inicia sesión en la nube primero');
    return { ok: false, error: 'no_session' };
  }

  const uid = validSession.user.id;
  const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : `orbitV9:${uid}`;
  const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : `orbitTimer:${uid}`;
  const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : `orbitHasUnsyncedChanges:${uid}`;

  let localData = null, localTimer = null;
  try { localData = JSON.parse(localStorage.getItem(v9Key)); } catch (e) {}
  try { localTimer = JSON.parse(localStorage.getItem(timerKey)); } catch (e) {}
  const hasUnsynced = localStorage.getItem(unsyncKey) === 'true';

  // GUARDIA 2: Leer el estado actual de la nube para validación previa
  const { data: cloudRow, error: fetchErr } = await sb
    .from('orbit_state')
    .select('orbit_data, orbit_timer, updated_at')
    .eq('user_id', uid)
    .maybeSingle();

  if (fetchErr || !cloudRow || !cloudRow.orbit_data) {
    if (typeof toast === 'function') toast('No se pudo verificar el estado en la nube.');
    return { ok: false, error: 'cloud_fetch_error' };
  }

  // GUARDIA 3: Comprobar que local no tenga información exclusiva pendiente de subir
  if (localData && typeof compareOrbitStateContent === 'function') {
    const comp = compareOrbitStateContent(localData, cloudRow.orbit_data);
    if (hasUnsynced || comp.localExclusiveCount > 0) {
      if (typeof toast === 'function') toast('Orbit ha detectado que todavía hay datos pendientes de sincronizar o revisar. Tus datos no se han modificado.');
      return { ok: false, error: 'pending_unsynced_data' };
    }

    // GUARDIA 4: Comprobar que la nube no tenga una reducción sospechosa frente a local
    if (typeof detectSuspiciousReduction === 'function') {
      const reductionCheck = detectSuspiciousReduction(localData, cloudRow.orbit_data);
      if (reductionCheck.isSuspicious) {
        if (typeof toast === 'function') toast('Esta versión parece contener menos información de la esperada. Orbit ha evitado guardarla como copia segura.');
        return { ok: false, error: 'suspicious_reduction' };
      }
    }
  }

  // Respaldo local de seguridad preventivo
  createPreSyncBackup(uid, 'manual_snapshot', localData, localTimer);

  try {
    const { data, error } = await sb.rpc('create_manual_state_snapshot', {
      p_label: String(label || 'manual_backup').slice(0, 30)
    });

    if (error) {
      console.warn('[MANUAL_SNAPSHOT] Error rechazado por backend:', error);
      if (typeof toast === 'function') toast('Esta versión parece contener menos información de la esperada. Orbit ha evitado guardarla como copia segura.');
      return { ok: false, error: error.message };
    }

    lastCloudBackupTime = Date.now();
    if (typeof toast === 'function') toast('✦ Copia segura creada en la nube');
    updateSyncStatus(hasConflict ? 'conflict' : 'synced');
    return { ok: true, data };
  } catch (err) {
    if (typeof toast === 'function') toast('Error de conexión al crear copia');
    return { ok: false, error: err.message };
  }
}

// Consultar historial de versiones desde Supabase
async function fetchStateHistory(limit = 50) {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { ok: false, error: 'offline' };
  }

  const validSession = await ensureValidSession();
  if (!validSession || !validSession.user) {
    return { ok: false, error: 'no_session' };
  }

  try {
    const safeLimit = Math.max(1, Math.min(Number(limit || 50), 100));
    const { data, error } = await sb.rpc('get_my_orbit_state_history', {
      p_limit: safeLimit
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, history: data || [] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Restaurar versión específica desde el historial
async function restoreFromCloudHistory(historyId) {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    if (typeof toast === 'function') toast('Se requiere conexión a Internet');
    return { ok: false, error: 'offline' };
  }

  if (!historyId) {
    return { ok: false, error: 'no_history_id' };
  }

  const validSession = await ensureValidSession();
  if (!validSession || !validSession.user) {
    if (typeof toast === 'function') toast('Inicia sesión en la nube primero');
    return { ok: false, error: 'no_session' };
  }

  const uid = validSession.user.id;

  try {
    // 1. Invocar RPC segura en servidor que restaura la fila orbit_state
    const { data, error } = await sb.rpc('restore_orbit_state_from_history', {
      p_history_id: historyId
    });

    if (error) {
      if (typeof toast === 'function') toast(error.message || 'Error al restaurar versión');
      return { ok: false, error: error.message };
    }

    // 2. Leer la fila restaurada para aplicarla localmente con bypass de reducción
    const { data: updatedRow, error: fetchErr } = await sb
      .from('orbit_state')
      .select('orbit_data, orbit_timer, updated_at')
      .eq('user_id', uid)
      .maybeSingle();

    if (fetchErr || !updatedRow) {
      if (typeof toast === 'function') toast('Versión restaurada en la nube. Recargando…');
      setTimeout(() => location.reload(), 400);
      return { ok: true };
    }

    const applyRes = safeApplyCloudState(
      updatedRow.orbit_data,
      updatedRow.orbit_timer,
      updatedRow.updated_at,
      uid,
      { forceRestore: true }
    );

    if (applyRes && applyRes.ok) {
      hasConflict = false;
      syncProtectionReason = '';
      lastCloudSyncSuccessTime = Date.now();
      updateSyncStatus('synced');
      if (typeof toast === 'function') toast('✦ Versión restaurada correctamente');
      if (typeof closeModal === 'function') {
        closeModal('cloudHistoryModal');
        closeModal('cloudDetailsModal');
      }
    }

    return { ok: true };
  } catch (err) {
    if (typeof toast === 'function') toast('Error inesperado al restaurar');
    return { ok: false, error: err.message };
  }
}

// Resolver conflicto adoptando conscientemente la versión de la NUBE
async function resolveConflictUsingCloud() {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    if (typeof toast === 'function') toast('Se requiere conexión a Internet');
    return { ok: false, error: 'offline' };
  }

  const validSession = await ensureValidSession();
  if (!validSession || !validSession.user) {
    if (typeof toast === 'function') toast('Inicia sesión en la nube primero');
    return { ok: false, error: 'no_session' };
  }

  const uid = validSession.user.id;
  const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : `orbitV9:${uid}`;
  const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : `orbitTimer:${uid}`;
  const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : `orbitLastCloudUpdatedAt:${uid}`;
  const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : `orbitHasUnsyncedChanges:${uid}`;

  let cloudData = currentSyncConflict?.cloudData;
  let cloudTimer = currentSyncConflict?.cloudTimer;
  let cloudUpdatedAt = currentSyncConflict?.cloudUpdatedAt;

  // Si por alguna razón no tenemos los datos en memoria, consultarlos frescos de Supabase
  if (!cloudData) {
    const { data: cloudRow, error: fetchErr } = await sb
      .from('orbit_state')
      .select('orbit_data, orbit_timer, updated_at')
      .eq('user_id', uid)
      .maybeSingle();

    if (fetchErr || !cloudRow || !cloudRow.orbit_data) {
      if (typeof toast === 'function') toast('No se pudo obtener la versión de la nube');
      return { ok: false, error: 'cloud_data_not_found' };
    }
    cloudData = cloudRow.orbit_data;
    cloudTimer = cloudRow.orbit_timer;
    cloudUpdatedAt = cloudRow.updated_at;
  }

  // 1. Snapshot server-side preventivo de la nube antes de cualquier cambio
  try {
    await sb.rpc('create_manual_state_snapshot', { p_label: 'pre_resolve_cloud' });
  } catch (e) {}

  // 2. Aplicar la versión de la nube en local con { forceRestore: true }
  // Esto creará un backup local pre-sync de los datos que estaban en este dispositivo
  const applyRes = safeApplyCloudState(cloudData, cloudTimer, cloudUpdatedAt, uid, { forceRestore: true });
  if (!applyRes || !applyRes.ok) {
    if (typeof toast === 'function') toast('Error al aplicar la versión de la nube');
    return applyRes;
  }

  // 3. Limpiar conflicto y sincronizar estado
  hasConflict = false;
  currentSyncConflict = null;
  syncProtectionReason = '';
  localStorage.setItem(unsyncKey, 'false');
  if (cloudUpdatedAt) localStorage.setItem(cloudUpKey, cloudUpdatedAt);

  lastCloudSyncSuccessTime = Date.now();
  updateSyncStatus('synced');
  if (typeof toast === 'function') toast('✦ Versión de la nube aplicada correctamente');

  if (typeof closeModal === 'function') {
    closeModal('cloudConflictModal');
    closeModal('cloudDetailsModal');
  }

  return { ok: true, status: 'resolved_using_cloud' };
}

// Resolver conflicto conservando conscientemente este DISPOSITIVO
async function resolveConflictUsingLocal() {
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    if (typeof toast === 'function') toast('Se requiere conexión a Internet');
    return { ok: false, error: 'offline' };
  }

  const validSession = await ensureValidSession();
  if (!validSession || !validSession.user) {
    if (typeof toast === 'function') toast('Inicia sesión en la nube primero');
    return { ok: false, error: 'no_session' };
  }

  const uid = validSession.user.id;
  const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : `orbitV9:${uid}`;
  const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : `orbitTimer:${uid}`;
  const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', uid) : `orbitLocalUpdatedAt:${uid}`;
  const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : `orbitLastCloudUpdatedAt:${uid}`;
  const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : `orbitHasUnsyncedChanges:${uid}`;

  let localData = currentSyncConflict?.localData;
  if (!localData) {
    try { localData = JSON.parse(localStorage.getItem(v9Key)); } catch (e) {}
    if (!localData && typeof load === 'function') localData = load(uid);
  }

  let localTimer = currentSyncConflict?.localTimer;
  if (!localTimer) {
    try {
      const raw = localStorage.getItem(timerKey);
      if (raw) localTimer = JSON.parse(raw);
    } catch (e) {}
  }

  if (!localData) {
    if (typeof toast === 'function') toast('No se encontraron datos en este dispositivo');
    return { ok: false, error: 'local_data_empty' };
  }

  // 1. Guardar copia previa server-side de la nube antes de sobreescribirla
  try {
    await sb.rpc('create_manual_state_snapshot', { p_label: 'pre_resolve_local' });
  } catch (e) {}

  // 2. Backup local de seguridad
  createPreSyncBackup(uid, 'conflict_resolve_local', localData, localTimer);

  // 3. Subir el estado local a la nube (forzando actualización consciente)
  const nowIso = new Date().toISOString();
  localStorage.setItem(localUpKey, nowIso);

  const payload = {
    user_id: uid,
    orbit_data: localData,
    orbit_timer: localTimer,
    updated_at: nowIso
  };

  updateSyncStatus('saving');

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

  if (upsertErr) {
    console.error('[RESOLVE_LOCAL] Error al actualizar nube con estado local:', upsertErr);
    updateSyncStatus('error');
    if (typeof toast === 'function') toast('Error al guardar en la nube. Tus datos locales siguen protegidos.');
    return { ok: false, status: 'error', error: upsertErr.message };
  }

  // 4. Confirmación exitosa en Supabase: Limpiar conflicto
  const confirmedTime = upsertData?.updated_at || nowIso;
  localStorage.setItem(cloudUpKey, confirmedTime);
  localStorage.setItem(unsyncKey, 'false');
  hasConflict = false;
  currentSyncConflict = null;
  syncProtectionReason = '';
  lastCloudSyncSuccessTime = Date.now();
  updateSyncStatus('synced');
  if (typeof toast === 'function') toast('✦ Nube actualizada con los datos de este dispositivo');

  if (typeof closeModal === 'function') {
    closeModal('cloudConflictModal');
    closeModal('cloudDetailsModal');
  }

  if (typeof render === 'function') render();
  return { ok: true, status: 'resolved_using_local', updated_at: confirmedTime };
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
