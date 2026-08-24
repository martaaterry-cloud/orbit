// Integración con Supabase - Autenticación Multiusuario, Registro y Sincronización Segura
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

function updateSyncStatus(status) {
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
        const { data: edgeData, error: edgeErr } = await sb.functions.invoke('login-with-username', {
          body: { username: cleanId.toLowerCase(), password: cleanPass }
        });

        if (edgeErr || !edgeData?.session) {
          authError = edgeErr || new Error(edgeData?.error || 'Usuario o contraseña incorrectos.');
        } else {
          const { error: setErr } = await sb.auth.setSession(edgeData.session);
          if (setErr) {
            authError = setErr;
          } else {
            session = edgeData.session;
          }
        }
      } catch (invokeErr) {
        authError = new Error('No se pudo contactar con el servicio de autenticación por usuario.');
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

  const signupBtn = document.getElementById('cloudSignupBtn');
  if (signupBtn) { signupBtn.disabled = true; signupBtn.textContent = 'Creando cuenta…'; }

  try {
    const { data, error } = await sb.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          username: cleanUsername,
          display_name: cleanUsername
        }
      }
    });

    if (signupBtn) { signupBtn.disabled = false; signupBtn.textContent = 'Crear mi cuenta'; }

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

// Actualización de username desde Ajustes
async function supabaseUpdateUsername(newUsername) {
  const sb = getSupabase();
  if (!sb || !currentCloudUser) return toast('Inicia sesión en la nube primero');
  const clean = String(newUsername || '').trim().toLowerCase();
  const usernameRegex = /^[a-z0-9_]{3,20}$/;
  if (!usernameRegex.test(clean)) {
    return toast('El usuario debe tener entre 3 y 20 caracteres (solo letras, números y _)');
  }

  try {
    const { error } = await sb
      .from('profiles')
      .update({ username: clean, updated_at: new Date().toISOString() })
      .eq('user_id', currentCloudUser.id);

    if (error) {
      if (error.code === '23505') {
        return toast('Ese nombre de usuario ya está en uso');
      }
      return toast('Error al actualizar nombre de usuario');
    }

    let d = (typeof load === 'function') ? load() : null;
    if (d) {
      if (!d.profile) d.profile = {};
      d.profile.username = clean;
      if (typeof save === 'function') save(d);
    }
    toast('Nombre de usuario actualizado');
    if (typeof renderProfile === 'function') renderProfile(d);
  } catch (e) {
    toast('Error al actualizar usuario');
  }
}

// Cierre de sesión seguro con limpieza total de memoria y temporizadores
async function supabaseLogout() {
  const sb = getSupabase();
  clearTimeout(syncDebounceTimer);
  clearTimeout(foregroundSyncTimer);
  hasConflict = false;
  signedUrlCache.clear();

  currentCloudUser = null;
  if (typeof setOrbitActiveUser === 'function') {
    setOrbitActiveUser(null);
  }

  if (sb) {
    await sb.auth.signOut().catch(() => {});
  }
  if (typeof toast === 'function') toast('Sesión cerrada');
  updateAppAuthState(null);
}

// Aplicar estado de la nube de forma segura y aislada por usuario
function safeApplyCloudState(cloudData, cloudTimer, cloudUpdatedAt, userId) {
  const uid = userId || currentCloudUser?.id || (typeof getOrbitActiveUserId === 'function' ? getOrbitActiveUserId() : null);
  if (!uid) return;

  if (typeof window !== 'undefined') window.isApplyingCloudState = true;
  try {
    const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : 'orbitV9';
    const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : 'orbitTimer';
    const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', uid) : 'orbitLocalUpdatedAt';
    const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : 'orbitLastCloudUpdatedAt';
    const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : 'orbitHasUnsyncedChanges';

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
  if (!session || !session.user) return;
  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

  const uid = session.user.id;
  if (typeof migrateLegacyStorageIfVerified === 'function') {
    migrateLegacyStorageIfVerified(session.user);
  }

  try {
    const { data, error } = await sb
      .from('orbit_state')
      .select('orbit_data, orbit_timer, updated_at')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      updateSyncStatus('error');
      return;
    }

    const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', uid) : 'orbitLocalUpdatedAt';
    const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : 'orbitLastCloudUpdatedAt';
    const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : 'orbitHasUnsyncedChanges';

    let localUpdatedAt = localStorage.getItem(localUpKey);
    if (!localUpdatedAt) {
      localUpdatedAt = new Date().toISOString();
      localStorage.setItem(localUpKey, localUpdatedAt);
    }
    const hasUnsynced = localStorage.getItem(unsyncKey) === 'true';

    // Caso D: No existe fila en la nube -> crearla con el estado local actual del usuario
    if (!data || !data.orbit_data || !data.updated_at) {
      performAutoUpload();
      return;
    }

    const cloudUpdatedAt = data.updated_at;
    const cloudTime = new Date(cloudUpdatedAt).getTime();
    const lastKnownCloud = localStorage.getItem(cloudUpKey);
    const lastKnownCloudTime = lastKnownCloud ? new Date(lastKnownCloud).getTime() : 0;
    const localTime = new Date(localUpdatedAt).getTime();

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
      safeApplyCloudState(data.orbit_data, data.orbit_timer, cloudUpdatedAt, uid);
      updateSyncStatus('synced');
      return;
    }

    // Caso B: El contexto local tiene cambios pendientes y la nube no ha cambiado remotamente -> Subir
    if (hasUnsynced && !isCloudNewer) {
      performAutoUpload();
      return;
    }

    // Caso C: Ambos están al día y sin cambios pendientes
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
  const uid = session.user.id;

  if (isSyncing) {
    pendingSync = true;
    return;
  }
  isSyncing = true;
  updateSyncStatus('saving');

  try {
    const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : 'orbitV9';
    const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : 'orbitTimer';
    const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', uid) : 'orbitLocalUpdatedAt';
    const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : 'orbitLastCloudUpdatedAt';
    const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : 'orbitHasUnsyncedChanges';

    let orbitData = null;
    try { orbitData = JSON.parse(localStorage.getItem(v9Key)); } catch (e) {}
    if (!orbitData && typeof load === 'function') orbitData = load(uid);

    let orbitTimer = null;
    try {
      const raw = localStorage.getItem(timerKey);
      if (raw) orbitTimer = JSON.parse(raw);
    } catch (e) {}

    let localIso = localStorage.getItem(localUpKey);
    if (!localIso) {
      localIso = new Date().toISOString();
      localStorage.setItem(localUpKey, localIso);
    }

    // Verificar si la nube cambió remotamente antes de sobrescribir
    const { data: cloudCheck } = await sb
      .from('orbit_state')
      .select('updated_at')
      .eq('user_id', uid)
      .maybeSingle();

    if (cloudCheck && cloudCheck.updated_at) {
      const cloudTime = new Date(cloudCheck.updated_at).getTime();
      const lastKnownCloud = localStorage.getItem(cloudUpKey);
      const lastKnownCloudTime = lastKnownCloud ? new Date(lastKnownCloud).getTime() : 0;
      const hasUnsynced = localStorage.getItem(unsyncKey) === 'true';

      if (lastKnownCloudTime > 0 && cloudTime > (lastKnownCloudTime + 1000) && hasUnsynced) {
        hasConflict = true;
        isSyncing = false;
        updateSyncStatus('conflict');
        return;
      }
    }

    const payload = {
      user_id: uid,
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
      updateSyncStatus('error');
    } else {
      const confirmedTime = upsertData?.updated_at || localIso;
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
  const uid = session.user.id;
  const v9Key = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitV9', uid) : 'orbitV9';
  const timerKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitTimer', uid) : 'orbitTimer';
  const localUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLocalUpdatedAt', uid) : 'orbitLocalUpdatedAt';
  const cloudUpKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitLastCloudUpdatedAt', uid) : 'orbitLastCloudUpdatedAt';
  const unsyncKey = typeof getUserStorageKey === 'function' ? getUserStorageKey('orbitHasUnsyncedChanges', uid) : 'orbitHasUnsyncedChanges';

  let orbitData = null;
  try { orbitData = JSON.parse(localStorage.getItem(v9Key)); } catch (e) { if (typeof load === 'function') orbitData = load(uid); }
  if (!orbitData && typeof load === 'function') orbitData = load(uid);

  let orbitTimer = null;
  try {
    const raw = localStorage.getItem(timerKey);
    if (raw) orbitTimer = JSON.parse(raw);
  } catch (e) {}

  const nowIso = new Date().toISOString();
  localStorage.setItem(localUpKey, nowIso);

  const payload = {
    user_id: uid,
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
  localStorage.setItem(cloudUpKey, confirmedTime);
  localStorage.setItem(unsyncKey, 'false');
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
  const uid = session.user.id;

  const restoreBtn = document.getElementById('cloudRestoreBtn');
  if (restoreBtn) restoreBtn.disabled = true;

  const { data, error } = await sb
    .from('orbit_state')
    .select('orbit_data, orbit_timer, updated_at')
    .eq('user_id', uid)
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

  safeApplyCloudState(data.orbit_data, data.orbit_timer, data.updated_at, uid);

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
