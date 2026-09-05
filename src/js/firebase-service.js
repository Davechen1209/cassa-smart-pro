// ─── Firebase Cloud Sync ───

import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs,
  arrayUnion, arrayRemove, serverTimestamp, enableIndexedDbPersistence
} from 'firebase/firestore';
import {
  d, save, STORAGE_KEY, SHARED_CACHE_KEY,
  firebaseDb, firebaseUser, cloudSyncEnabled, syncDebounceTimer,
  setFirebaseDb, setFirebaseUser, setCloudSyncEnabled, setSyncDebounceTimer,
  isReadOnly, getSharedView, setSharedView, replaceData
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { t } from './i18n.js';
import { FattureApp } from './fatture-app/hk-app.js';
import { Store as HkStore } from './fatture-app/hk-store.js';

// Configurazione Firebase integrata: usata di default su ogni nuova
// installazione, così non serve reincollarla su ogni telefono.
const EMBEDDED_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDdD88qV7hXldbqfRonoh0DFUf_FuiyZco",
  authDomain: "project-7840969229916873441.firebaseapp.com",
  projectId: "project-7840969229916873441",
  storageBucket: "project-7840969229916873441.firebasestorage.app",
  messagingSenderId: "693204890581",
  appId: "1:693204890581:web:bcfb36e341dfb0b53dc35c",
  measurementId: "G-18L69PJ1KW"
};

let _uiCallback = null;
export function setUiCallback(fn) { _uiCallback = fn; }


function callUi() {
  if (_uiCallback) _uiCallback();
}

export function setSyncStatus(status) {
  const dot = document.getElementById('sync-dot');
  dot.className = 'sync-dot';
  if (status === 'synced') {
    dot.style.display = 'inline-block';
    dot.classList.add('synced');
    dot.title = t('cloud.synced');
  } else if (status === 'syncing') {
    dot.style.display = 'inline-block';
    dot.classList.add('syncing');
    dot.title = t('cloud.syncing');
  } else if (status === 'error') {
    dot.style.display = 'inline-block';
    dot.classList.add('error');
    dot.title = t('cloud.syncError');
  } else {
    dot.style.display = 'none';
    dot.title = t('app.cloudDisconnected');
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
  if (el) el.textContent = t('cloud.lastSync') + ' ' + dateStr + ' ' + timeStr;
}

async function writeToCloud() {
  setSyncStatus('syncing');
  try {
    // merge: true — cosi' il campo sharedWith (gestito a parte) non viene
    // mai cancellato da un salvataggio dei dati.
    await setDoc(doc(firebaseDb, 'users', firebaseUser.uid), {
      saldo: d.saldo,
      fornitori: d.fornitori,
      stipendi: d.stipendi,
      abit: d.abit,
      log: d.log,
      anticipi: d.anticipi || [],
      // L'archivio fatture ha un suo storage: viaggia come campo a parte.
      fattureApp: HkStore.records(),
      // Le fatture cancellate: senza questo elenco una fattura tolta qui
      // tornerebbe viva alla prima fusione con la copia del cloud.
      fattureDeleted: HkStore.deletedList(),
      customCats: d.customCats || [],
      aziendaData: d.aziendaData || {},
      shopName: d.shopName || '',
      ownerEmail: normalizeEmail(firebaseUser.email),
      ownerName: firebaseUser.displayName || '',
      lastUpdate: serverTimestamp(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    setSyncStatus('synced');
    updateLastSyncTime();
  } catch (err) {
    console.error('Sync error:', err);
    setSyncStatus('error');
  }
}

export async function syncToCloud() {
  if (!cloudSyncEnabled || !firebaseDb || !firebaseUser) return;
  // In vista condivisa i dati non sono nostri: non si scrive mai.
  if (isReadOnly()) return;

  clearTimeout(syncDebounceTimer);
  setSyncDebounceTimer(setTimeout(() => {
    setSyncDebounceTimer(null);
    writeToCloud();
  }, 500));
}

/* Il salvataggio nel cloud aspetta mezzo secondo per non scrivere a ogni
   tasto. Se l'app viene chiusa (o mandata in secondo piano sul telefono)
   dentro quel mezzo secondo, quella scrittura non parte piu': segnavi una
   fattura come pagata e nel cloud restava da pagare. Qui l'attesa viene
   saltata e si scrive subito. */
export function flushPendingSync() {
  if (!cloudSyncEnabled || !firebaseDb || !firebaseUser) return;
  if (isReadOnly()) return;
  if (!syncDebounceTimer) return;
  clearTimeout(syncDebounceTimer);
  setSyncDebounceTimer(null);
  writeToCloud();
}

let appHidingWatched = false;
function watchAppHiding() {
  if (appHidingWatched) return;
  appHidingWatched = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSync();
  });
  // pagehide copre la chiusura della scheda e il ritorno indietro su iOS,
  // dove visibilitychange non sempre arriva.
  window.addEventListener('pagehide', () => flushPendingSync());
}

export async function loadFromCloud() {
  if (!firebaseDb || !firebaseUser) return;
  if (isReadOnly()) return;

  try {
    const docSnap = await getDoc(doc(firebaseDb, 'users', firebaseUser.uid));
    if (docSnap.exists()) {
      const cloud = docSnap.data();
      mySharedWith = (cloud.sharedWith || []).slice();
      const cloudLogLen = (cloud.log || []).length;
      const localLogLen = d.log.length;

      // L'archivio fatture ha una vita sua e non segue le sorti del registro
      // di cassa: segnare una fattura come pagata non allunga il log e non
      // cambia il saldo, quindi le regole qui sotto non lo vedrebbero mai.
      // Prima si fondono le due copie riga per riga (vince la modifica piu'
      // recente), poi si guarda se il cloud va aggiornato.
      const fatture = HkStore.mergeRemote(cloud.fattureApp, { deleted: cloud.fattureDeleted });
      const fattureDaSalire = !HkStore.equalsRecords(cloud.fattureApp);

      if (cloudLogLen > localLogLen || (cloudLogLen === localLogLen && cloud.saldo !== d.saldo)) {
        d.saldo = cloud.saldo ?? d.saldo;
        d.fornitori = cloud.fornitori || d.fornitori;
        d.stipendi = cloud.stipendi || d.stipendi;
        d.abit = cloud.abit || d.abit;
        d.log = cloud.log || d.log;
        d.anticipi = cloud.anticipi || d.anticipi;
        d.customCats = cloud.customCats || d.customCats;
        d.aziendaData = cloud.aziendaData || d.aziendaData;
        if (cloud.shopName) d.shopName = cloud.shopName;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
        callUi();
      }
      if (localLogLen > cloudLogLen || fattureDaSalire) {
        await syncToCloud();
      }
      if (fatture.changed) {
        FattureApp.render();
        callUi();
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
  if (isReadOnly()) { showToast(t('share.readOnlyBlocked'), 'warn'); return; }

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
      d.anticipi = cloud.anticipi || [];
      HkStore.applyRemote(cloud.fattureApp || []);
      d.customCats = cloud.customCats || [];
      d.aziendaData = cloud.aziendaData || {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      callUi();
      setSyncStatus('synced');
      showToast(t('cloud.reloaded'), 'check');
    } else {
      showToast(t('cloud.noData'), 'warn');
      setSyncStatus('synced');
    }
    updateLastSyncTime();
  } catch (err) {
    setSyncStatus('error');
    showToast(t('cloud.connError') + err.message, 'warn');
  }
}

export async function initFirebase() {
  const storedConfig = localStorage.getItem('cassa_firebase_config');
  watchAppHiding();

  try {
    // Se l'utente ha salvato una config personalizzata la usa, altrimenti
    // ricade su quella integrata nell'app.
    const config = storedConfig ? JSON.parse(storedConfig) : EMBEDDED_FIREBASE_CONFIG;

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

    // Check redirect result first (for mobile sign-in flow)
    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        await afterSignIn(result.user);
        showToast(t('cloud.connectedAs') + result.user.displayName, 'check');
        return;
      }
    } catch (e) {
      // No redirect result
    }

    // Listen for auth state restoration (persisted session from IndexedDB)
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Session restored — user is already signed in
        if (firebaseUser && firebaseUser.uid === user.uid) return; // already handled
        await afterSignIn(user);
      } else if (!firebaseUser) {
        // No session — show sign-in UI
        stopSharedListener();
        updateCloudUI(false);
        applyReadOnlyUI();
        showLoginUI();
      }
    });
  } catch (err) {
    console.error('Firebase init error:', err);
    setSyncStatus('error');
    updateCloudUI(false);
    showToast(t('cloud.connError') + err.message, 'warn');
  }
}

function updateUserDisplay(user) {
  const connectedText = document.querySelector('.cloud-connected-text');
  if (connectedText && user.displayName) {
    connectedText.textContent = t('cloud.connectedAs') + user.displayName;
  }
}

function showLoginUI() {
  const setupUi = document.getElementById('cloud-setup-ui');
  if (setupUi) {
    setupUi.innerHTML = `
      <div class="cloud-disconnected">
        <div class="cloud-disconnected-dot"></div>
        <div class="cloud-disconnected-text">${t('cloud.loginToSync')}</div>
      </div>
      <div class="cloud-info">${t('cloud.loginInfo')}</div>
      <div class="cloud-actions">
        <button class="btn-sm blue" data-action="googleSignIn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          ${t('cloud.loginGoogle')}
        </button>
      </div>
      <div class="cloud-divider">${t('cloud.or')}</div>
      <div class="cloud-actions">
        <button class="btn-sm red" data-action="disconnectCloud" style="flex:1;">${t('cloud.removeConfig')}</button>
      </div>
    `;
  }
}

export async function googleSignIn() {
  const auth = getAuth();
  const provider = new GoogleAuthProvider();

  try {
    // Try popup first (works on desktop)
    const result = await signInWithPopup(auth, provider);
    await afterSignIn(result.user);
    showToast(t('cloud.connectedAs') + result.user.displayName, 'check');
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      // Fallback to redirect (works on mobile)
      await signInWithRedirect(auth, provider);
    } else {
      console.error('Google sign in error:', err);
      showToast(t('cloud.loginError') + err.message, 'warn');
    }
  }
}

export function connectCloud() {
  const textarea = document.getElementById('firebase-config-input');
  const config = parseFirebaseConfig(textarea.value);

  if (!config) {
    showToast(t('cloud.invalidConfig'), 'warn');
    return;
  }

  localStorage.setItem('cassa_firebase_config', JSON.stringify(config));
  textarea.value = '';
  showToast(t('cloud.connecting'), 'check');
  initFirebase();
}

export function disconnectCloud() {
  showConfirm(t('cloud.disconnectTitle'), t('cloud.disconnectMsg'), () => {
    localStorage.removeItem('cassa_firebase_config');
    stopSharedListener();
    if (isReadOnly()) setSharedView(null);
    mySharedWith = [];
    receivedShares = [];
    applyReadOnlyUI();
    setCloudSyncEnabled(false);
    setFirebaseDb(null);
    setFirebaseUser(null);
    const apps = getApps();
    apps.forEach(app => deleteApp(app));
    setSyncStatus('disconnected');
    updateCloudUI(false);
    showToast(t('cloud.disconnected'), 'check');
  });
}

// ─────────────────────────────────────────────────────────────
// Condivisione dati: il proprietario autorizza altri account Google
// per email; gli invitati vedono i dati in tempo reale, in sola lettura.
// ─────────────────────────────────────────────────────────────

// Email autorizzate da me (io proprietario).
let mySharedWith = [];
// Dataset che altri hanno condiviso con me: [{ uid, email, name, shopName }]
let receivedShares = [];
// Disiscrizione dal listener realtime della vista condivisa.
let sharedUnsub = null;

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Sequenza comune a tutti i percorsi di login (popup, redirect, sessione
// ripristinata): stato cloud, dati, elenco condivisioni, UI.
async function afterSignIn(user) {
  setFirebaseUser(user);
  setCloudSyncEnabled(true);
  updateCloudUI(true);
  updateUserDisplay(user);
  setSyncStatus('syncing');

  const view = getSharedView();
  if (view) {
    // Stavamo guardando i dati di un altro utente: riaggancia il listener.
    HkStore.setSharedMode(true);
    startSharedListener(view);
  } else {
    await loadFromCloud();
  }

  setSyncStatus('synced');
  updateLastSyncTime();
  applyReadOnlyUI();
  await loadReceivedShares();
  renderShareUI();
}

// ─── Lato proprietario: gestione degli invitati ───

export async function addSharedEmail() {
  if (!firebaseDb || !firebaseUser) return;
  if (isReadOnly()) { showToast(t('share.readOnlyBlocked'), 'warn'); return; }

  const input = document.getElementById('share-email-input');
  const email = normalizeEmail(input ? input.value : '');

  if (!isValidEmail(email)) { showToast(t('share.invalidEmail'), 'warn'); return; }
  if (email === normalizeEmail(firebaseUser.email)) { showToast(t('share.cannotShareSelf'), 'warn'); return; }
  if (mySharedWith.includes(email)) { showToast(t('share.alreadyShared'), 'warn'); return; }

  try {
    await setDoc(doc(firebaseDb, 'users', firebaseUser.uid), {
      sharedWith: arrayUnion(email),
      ownerEmail: normalizeEmail(firebaseUser.email),
      ownerName: firebaseUser.displayName || ''
    }, { merge: true });
    mySharedWith.push(email);
    if (input) input.value = '';
    renderShareUI();
    showToast(t('share.added'), 'check');
  } catch (err) {
    console.error('Add share error:', err);
    showToast(t('share.error') + err.message, 'warn');
  }
}

export function removeSharedEmail(email) {
  if (!firebaseDb || !firebaseUser) return;
  if (isReadOnly()) { showToast(t('share.readOnlyBlocked'), 'warn'); return; }

  showConfirm(t('share.removeTitle'), t('share.removeMsg') + email, async () => {
    try {
      await setDoc(doc(firebaseDb, 'users', firebaseUser.uid), {
        sharedWith: arrayRemove(email)
      }, { merge: true });
      mySharedWith = mySharedWith.filter(e => e !== email);
      renderShareUI();
      showToast(t('share.removed'), 'check');
    } catch (err) {
      console.error('Remove share error:', err);
      showToast(t('share.error') + err.message, 'warn');
    }
  });
}

// ─── Lato invitato: dataset condivisi con me ───

async function loadReceivedShares() {
  receivedShares = [];
  if (!firebaseDb || !firebaseUser) return;

  const myEmail = normalizeEmail(firebaseUser.email);
  if (!myEmail) return;

  try {
    const q = query(collection(firebaseDb, 'users'), where('sharedWith', 'array-contains', myEmail));
    const snap = await getDocs(q);
    snap.forEach(docSnap => {
      if (docSnap.id === firebaseUser.uid) return;
      const data = docSnap.data();
      receivedShares.push({
        uid: docSnap.id,
        email: data.ownerEmail || '',
        name: data.ownerName || '',
        shopName: data.shopName || ''
      });
    });
  } catch (err) {
    // Regole Firestore non ancora aggiornate, o offline: non è fatale.
    console.warn('Load received shares error:', err);
  }
}

export async function refreshShares() {
  await loadReceivedShares();
  renderShareUI();
  showToast(t('share.refreshed'), 'check');
}


export function viewSharedData(uid) {
  const owner = receivedShares.find(s => s.uid === uid);
  if (!owner) return;

  setSharedView({ uid: owner.uid, email: owner.email, name: owner.name, shopName: owner.shopName });
  // Prima di agganciare il listener: da qui in poi l'archivio fatture scrive
  // sulla copia condivisa, mai su quella propria.
  HkStore.setSharedMode(true);
  applyReadOnlyUI();
  setSyncStatus('syncing');
  startSharedListener(getSharedView());
  renderShareUI();
  callUi();
  showToast(t('share.nowViewing') + (owner.shopName || owner.name || owner.email), 'check');
}

export function exitSharedView() {
  if (!isReadOnly()) return;
  stopSharedListener();
  setSharedView(null);
  HkStore.setSharedMode(false);
  applyReadOnlyUI();
  renderShareUI();
  callUi();
  setSyncStatus('syncing');
  loadFromCloud().then(() => {
    setSyncStatus('synced');
    updateLastSyncTime();
    callUi();
  });
  showToast(t('share.backToMine'), 'check');
}

function stopSharedListener() {
  if (sharedUnsub) { sharedUnsub(); sharedUnsub = null; }
}

// Listener realtime sul documento del proprietario: ogni modifica che lui
// salva arriva qui senza bisogno di riaprire l'app.
function startSharedListener(view) {
  stopSharedListener();
  if (!firebaseDb || !view) return;

  sharedUnsub = onSnapshot(doc(firebaseDb, 'users', view.uid), (snap) => {
    if (!snap.exists()) {
      showToast(t('share.revoked'), 'warn');
      exitSharedView();
      return;
    }
    replaceData(snap.data());
    HkStore.applyRemote(snap.data().fattureApp || []);
    FattureApp.render();
    localStorage.setItem(SHARED_CACHE_KEY, JSON.stringify(d));
    updateAppTitle();
    setSyncStatus('synced');
    updateLastSyncTime();
    callUi();
  }, (err) => {
    console.error('Shared listener error:', err);
    // Permesso revocato dal proprietario, o regole non aggiornate.
    if (err.code === 'permission-denied') {
      showToast(t('share.revoked'), 'warn');
      exitSharedView();
    } else {
      setSyncStatus('error');
    }
  });
}

// ─── UI ───

// Banner + classe sul body: la classe serve al CSS per nascondere i comandi
// di modifica, il blocco vero delle azioni è nel guard di main.js.
export function applyReadOnlyUI() {
  // La tab fatture ha una delega tutta sua: va avvisata a parte.
  FattureApp.setReadOnly(isReadOnly());
  updateAppTitle();
  const view = getSharedView();
  document.body.classList.toggle('readonly-mode', !!view);

  const banner = document.getElementById('readonly-banner');
  if (!banner) return;

  if (view) {
    const who = view.shopName || view.name || view.email || '';
    banner.style.display = 'flex';
    banner.innerHTML = `
      <span class="readonly-banner-text">${escapeHtml(t('share.viewingBanner') + who)}</span>
      <button class="btn-sm gray" data-action="exitSharedView">${escapeHtml(t('share.exit'))}</button>
    `;
  } else {
    banner.style.display = 'none';
    banner.innerHTML = '';
  }
}

export function renderShareUI() {
  // Il selettore sul titolo mostra lo stesso elenco: si aggiorna insieme.
  updateDatasetSwitcher();

  const card = document.getElementById('share-card');
  if (!card) return;

  if (!firebaseUser) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const ownerUi = document.getElementById('share-owner-ui');
  const receivedUi = document.getElementById('share-received-ui');
  const readOnly = isReadOnly();

  if (ownerUi) {
    // In vista condivisa la lista degli invitati non è la nostra: si nasconde
    // per non far credere di stare modificando i permessi altrui.
    ownerUi.style.display = readOnly ? 'none' : 'block';
    const list = document.getElementById('share-list');
    if (list) {
      list.innerHTML = mySharedWith.length === 0
        ? `<div class="share-empty">${escapeHtml(t('share.noneYet'))}</div>`
        : mySharedWith.map(email => `
            <div class="share-row">
              <span class="share-row-email">${escapeHtml(email)}</span>
              <span class="share-row-role">${escapeHtml(t('share.roleViewer'))}</span>
              <button class="share-row-remove" data-action="removeSharedEmail" data-email="${escapeHtml(email)}" aria-label="${escapeHtml(t('share.remove'))}">&times;</button>
            </div>`).join('');
    }
  }

  if (receivedUi) {
    const view = getSharedView();
    let html = `<div class="share-subtitle">${escapeHtml(t('share.receivedTitle'))}</div>`;

    if (receivedShares.length === 0) {
      html += `<div class="share-empty">${escapeHtml(t('share.noneReceived'))}</div>`;
    } else {
      html += receivedShares.map(sh => {
        const label = sh.shopName || sh.name || sh.email;
        const active = view && view.uid === sh.uid;
        return `
          <div class="share-row">
            <span class="share-row-email">${escapeHtml(label)}${sh.email && label !== sh.email ? `<small>${escapeHtml(sh.email)}</small>` : ''}</span>
            ${active
              ? `<button class="btn-sm gray" data-action="exitSharedView">${escapeHtml(t('share.exit'))}</button>`
              : `<button class="btn-sm blue" data-action="viewSharedData" data-uid="${escapeHtml(sh.uid)}">${escapeHtml(t('share.view'))}</button>`}
          </div>`;
      }).join('');
    }

    html += `<div class="cloud-actions"><button class="btn-sm gray" data-action="refreshShares">${escapeHtml(t('share.refresh'))}</button></div>`;
    receivedUi.innerHTML = html;
  }
}

// ─── Selettore dataset ancorato al titolo ───
// Scegliere quali dati guardare e' l'azione piu' frequente per chi legge dati
// altrui: sta sul titolo, non in fondo alle impostazioni.

const CHECK_SVG = '<svg class="dataset-menu-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

export function hasSharedDatasets() {
  return receivedShares.length > 0;
}

// Il nome della propria attivita' vive in localStorage: in vista condivisa `d`
// contiene i dati del proprietario, non i nostri.
function myShopName() {
  try {
    const mine = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return mine.shopName || '';
  } catch (e) {
    return '';
  }
}

// Il chevron appare solo se c'e' davvero una scelta da fare; altrimenti il
// titolo resta quello che era, un campo per rinominare l'attivita'.
export function updateDatasetSwitcher() {
  const chevron = document.getElementById('app-title-chevron');
  if (chevron) chevron.style.display = hasSharedDatasets() ? 'inline-block' : 'none';
}

export function renderDatasetMenu() {
  const menu = document.getElementById('dataset-menu');
  if (!menu) return;

  const view = getSharedView();
  let html = `<div class="dataset-menu-label">${escapeHtml(t('share.switchLabel'))}</div>`;

  const mineActive = !view;
  html += `
    <button class="dataset-menu-item${mineActive ? ' active' : ''}" role="menuitem" data-action="exitSharedView">
      ${CHECK_SVG.replace('dataset-menu-check', 'dataset-menu-check' + (mineActive ? '' : ' hidden'))}
      <span class="dataset-menu-text">${escapeHtml(t('share.myData'))}${myShopName() ? `<small>${escapeHtml(myShopName())}</small>` : ''}</span>
    </button>`;

  receivedShares.forEach(sh => {
    const label = sh.shopName || sh.name || sh.email;
    const active = !!view && view.uid === sh.uid;
    html += `
      <button class="dataset-menu-item${active ? ' active' : ''}" role="menuitem" data-action="viewSharedData" data-uid="${escapeHtml(sh.uid)}">
        ${CHECK_SVG.replace('dataset-menu-check', 'dataset-menu-check' + (active ? '' : ' hidden'))}
        <span class="dataset-menu-text">${escapeHtml(label)}${sh.email && label !== sh.email ? `<small>${escapeHtml(sh.email)}</small>` : ''}</span>
      </button>`;
  });

  if (receivedShares.length === 0) {
    html += `<div class="dataset-menu-empty">${escapeHtml(t('share.noneReceived'))}</div>`;
  }

  html += '<div class="dataset-menu-sep"></div>';
  if (!isReadOnly()) {
    html += `<button class="dataset-menu-item secondary" role="menuitem" data-action="renameShop">${escapeHtml(t('share.rename'))}</button>`;
  }
  html += `<button class="dataset-menu-item secondary" role="menuitem" data-action="refreshShares">${escapeHtml(t('share.refresh'))}</button>`;

  menu.innerHTML = html;
}

export function openDatasetMenu() {
  const overlay = document.getElementById('dataset-menu-overlay');
  if (!overlay) return;
  renderDatasetMenu();
  overlay.classList.add('show');
  document.getElementById('app-title-tap')?.classList.add('open');
}

export function closeDatasetMenu() {
  document.getElementById('dataset-menu-overlay')?.classList.remove('show');
  document.getElementById('app-title-tap')?.classList.remove('open');
}


// Il titolo e' anche il selettore del dataset: deve dire quali dati stai
// guardando. Se il proprietario non ha dato un nome all'attivita' si ricade
// sul suo nome o sulla sua email, non sul nome generico dell'app.
export function updateAppTitle() {
  const el = document.getElementById('app-title');
  if (!el) return;
  const view = getSharedView();
  el.textContent = d.shopName
    || (view ? (view.shopName || view.name || view.email) : '')
    || t('app.title');
}