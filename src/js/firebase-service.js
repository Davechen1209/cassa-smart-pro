// ─── Firebase Cloud Sync ───

import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, enableIndexedDbPersistence } from 'firebase/firestore';
import {
  d, save, STORAGE_KEY,
  firebaseDb, firebaseUser, cloudSyncEnabled, syncDebounceTimer,
  setFirebaseDb, setFirebaseUser, setCloudSyncEnabled, setSyncDebounceTimer
} from './state.js';
import { showToast, showConfirm } from './modals.js';

let _uiCallback = null;
export function setUiCallback(fn) { _uiCallback = fn; }

function callUi() {
  if (_uiCallback) _uiCallback();
}

export function setSyncStatus(status) {
  const dot = document.getElementById('sync-dot');
  dot.className = 'sync-dot';
  if (status === 'synced') {
    dot.classList.add('synced');
    dot.title = 'Cloud sincronizzato';
  } else if (status === 'syncing') {
    dot.classList.add('syncing');
    dot.title = 'Sincronizzazione in corso...';
  } else if (status === 'error') {
    dot.classList.add('error');
    dot.title = 'Errore di sincronizzazione';
  } else {
    dot.title = 'Cloud non connesso';
  }
}

export function parseFirebaseConfig(text) {
  try {
    let cleaned = text.trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
    // Extract key-value pairs manually
    const config = {};
    const pairs = cleaned.match(/(\w+)\s*:\s*["']([^"']+)["']/g);
    if (pairs) {
      pairs.forEach(p => {
        const m = p.match(/(\w+)\s*:\s*["']([^"']+)["']/);
        if (m) config[m[1]] = m[2];
      });
    }
    if (config.apiKey && config.projectId) return config;
    return null;
  } catch (e) {
    return null;
  }
}

export function updateCloudUI(connected) {
  document.getElementById('cloud-connected-ui').style.display = connected ? 'block' : 'none';
  document.getElementById('cloud-setup-ui').style.display = connected ? 'none' : 'block';
}

export function updateLastSyncTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('it-IT');
  const el = document.getElementById('cloud-last-sync');
  if (el) el.textContent = 'Ultimo sync: ' + dateStr + ' alle ' + timeStr;
}

export async function syncToCloud() {
  if (!cloudSyncEnabled || !firebaseDb || !firebaseUser) return;

  clearTimeout(syncDebounceTimer);
  setSyncDebounceTimer(setTimeout(async () => {
    setSyncStatus('syncing');
    try {
      await setDoc(doc(firebaseDb, 'users', firebaseUser.uid), {
        saldo: d.saldo,
        fornitori: d.fornitori,
        stipendi: d.stipendi,
        abit: d.abit,
        log: d.log,
        fatture: d.fatture || [],
        lastUpdate: serverTimestamp(),
        updatedAt: new Date().toISOString()
      });
      setSyncStatus('synced');
      updateLastSyncTime();
    } catch (err) {
      console.error('Sync error:', err);
      setSyncStatus('error');
    }
  }, 500));
}

export async function loadFromCloud() {
  if (!firebaseDb || !firebaseUser) return;

  try {
    const docSnap = await getDoc(doc(firebaseDb, 'users', firebaseUser.uid));
    if (docSnap.exists()) {
      const cloud = docSnap.data();
      const cloudLogLen = (cloud.log || []).length;
      const localLogLen = d.log.length;

      if (cloudLogLen > localLogLen || (cloudLogLen === localLogLen && cloud.saldo !== d.saldo)) {
        d.saldo = cloud.saldo ?? d.saldo;
        d.fornitori = cloud.fornitori || d.fornitori;
        d.stipendi = cloud.stipendi || d.stipendi;
        d.abit = cloud.abit || d.abit;
        d.log = cloud.log || d.log;
        d.fatture = cloud.fatture || d.fatture;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
        callUi();
      } else if (localLogLen > cloudLogLen) {
        await syncToCloud();
      }
    } else {
      await syncToCloud();
    }
  } catch (err) {
    console.error('Load from cloud error:', err);
  }
}

export async function forceSyncFromCloud() {
  if (!firebaseDb || !firebaseUser) return;

  setSyncStatus('syncing');
  try {
    const docSnap = await getDoc(doc(firebaseDb, 'users', firebaseUser.uid));
    if (docSnap.exists()) {
      const cloud = docSnap.data();
      d.saldo = cloud.saldo ?? 0;
      d.fornitori = cloud.fornitori || [];
      d.stipendi = cloud.stipendi || [];
      d.abit = cloud.abit || [];
      d.log = cloud.log || [];
      d.fatture = cloud.fatture || [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      callUi();
      setSyncStatus('synced');
      showToast('Dati ricaricati dal cloud', 'check');
    } else {
      showToast('Nessun dato trovato nel cloud', 'warn');
      setSyncStatus('synced');
    }
    updateLastSyncTime();
  } catch (err) {
    setSyncStatus('error');
    showToast('Errore: ' + err.message, 'warn');
  }
}

export async function initFirebase() {
  const storedConfig = localStorage.getItem('cassa_firebase_config');
  if (!storedConfig) {
    updateCloudUI(false);
    return;
  }

  try {
    const config = JSON.parse(storedConfig);

    let app;
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }

    const db = getFirestore(app);
    setFirebaseDb(db);

    try {
      await enableIndexedDbPersistence(db);
    } catch (e) {
      // Multi-tab or already enabled
    }

    const auth = getAuth(app);

    // Check if user is already signed in
    if (auth.currentUser) {
      setFirebaseUser(auth.currentUser);
      setCloudSyncEnabled(true);
      updateCloudUI(true);
      updateUserDisplay(auth.currentUser);
      setSyncStatus('syncing');
      await loadFromCloud();
      setSyncStatus('synced');
      updateLastSyncTime();
      return;
    }

    // Check redirect result (for mobile)
    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        setFirebaseUser(result.user);
        setCloudSyncEnabled(true);
        updateCloudUI(true);
        updateUserDisplay(result.user);
        setSyncStatus('syncing');
        await loadFromCloud();
        setSyncStatus('synced');
        updateLastSyncTime();
        showToast('Connesso come ' + result.user.displayName, 'check');
        return;
      }
    } catch (e) {
      // No redirect result
    }

    // Not signed in yet — show setup UI with Google button
    updateCloudUI(false);
    // Show that config is saved but need to sign in
    const setupUi = document.getElementById('cloud-setup-ui');
    if (setupUi) {
      setupUi.innerHTML = `
        <div class="cloud-disconnected">
          <div class="cloud-disconnected-dot"></div>
          <div class="cloud-disconnected-text">Accedi per sincronizzare</div>
        </div>
        <div class="cloud-info">Accedi con il tuo account Google per sincronizzare i dati tra tutti i tuoi dispositivi.</div>
        <div class="cloud-actions">
          <button class="btn-sm blue" data-action="googleSignIn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Accedi con Google
          </button>
        </div>
        <div class="cloud-divider">oppure</div>
        <div class="cloud-actions">
          <button class="btn-sm red" data-action="disconnectCloud" style="flex:1;">Rimuovi configurazione</button>
        </div>
      `;
    }
  } catch (err) {
    console.error('Firebase init error:', err);
    setSyncStatus('error');
    updateCloudUI(false);
    showToast('Errore connessione cloud: ' + err.message, 'warn');
  }
}

function updateUserDisplay(user) {
  const connectedText = document.querySelector('.cloud-connected-text');
  if (connectedText && user.displayName) {
    connectedText.textContent = 'Connesso come ' + user.displayName;
  }
}

export async function googleSignIn() {
  const auth = getAuth();
  const provider = new GoogleAuthProvider();

  try {
    // Try popup first (works on desktop)
    const result = await signInWithPopup(auth, provider);
    setFirebaseUser(result.user);
    setCloudSyncEnabled(true);
    updateCloudUI(true);
    updateUserDisplay(result.user);
    setSyncStatus('syncing');
    await loadFromCloud();
    setSyncStatus('synced');
    updateLastSyncTime();
    showToast('Connesso come ' + result.user.displayName, 'check');
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      // Fallback to redirect (works on mobile)
      await signInWithRedirect(auth, provider);
    } else {
      console.error('Google sign in error:', err);
      showToast('Errore accesso: ' + err.message, 'warn');
    }
  }
}

export function connectCloud() {
  const textarea = document.getElementById('firebase-config-input');
  const config = parseFirebaseConfig(textarea.value);

  if (!config) {
    showToast('Configurazione non valida. Controlla il formato.', 'warn');
    return;
  }

  localStorage.setItem('cassa_firebase_config', JSON.stringify(config));
  textarea.value = '';
  showToast('Connessione al cloud in corso...', 'check');
  initFirebase();
}

export function disconnectCloud() {
  showConfirm('Disconnetti Cloud', 'I dati locali rimarranno salvati. Vuoi disconnettere la sincronizzazione cloud?', () => {
    localStorage.removeItem('cassa_firebase_config');
    setCloudSyncEnabled(false);
    setFirebaseDb(null);
    setFirebaseUser(null);
    const apps = getApps();
    apps.forEach(app => deleteApp(app));
    setSyncStatus('disconnected');
    updateCloudUI(false);
    showToast('Cloud disconnesso', 'check');
  });
}
