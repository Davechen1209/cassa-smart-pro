// ─── Firebase Cloud Sync ───

import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
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
    // Convert JS object literal to valid JSON
    cleaned = cleaned.replace(/(\w+)\s*:/g, '"$1":');
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
    cleaned = cleaned.replace(/'/g, '"');
    const config = JSON.parse(cleaned);
    if (config && config.apiKey && config.projectId) return config;
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
    const userCred = await signInAnonymously(auth);
    setFirebaseUser(userCred.user);

    setCloudSyncEnabled(true);
    updateCloudUI(true);
    setSyncStatus('syncing');

    await loadFromCloud();

    setSyncStatus('synced');
    updateLastSyncTime();
  } catch (err) {
    console.error('Firebase init error:', err);
    setSyncStatus('error');
    updateCloudUI(false);
    showToast('Errore connessione cloud: ' + err.message, 'warn');
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
