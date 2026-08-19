// ─── State Management ───

import { openDb, migrateFromFatture } from './pdf-storage.js';

const STORAGE_KEY = 'cassa_v6';
// Cache locale dei dati di un altro utente, mostrati in sola lettura.
// Tenuta separata da STORAGE_KEY per non toccare mai i dati propri.
const SHARED_CACHE_KEY = 'cassa_v6_shared';
const SHARED_VIEW_KEY = 'cassa_shared_view';

// Quando valorizzato: { uid, email, name } del proprietario di cui stiamo
// guardando i dati. Null = stiamo guardando i nostri (modifica consentita).
let sharedView = null;
try {
  const raw = localStorage.getItem(SHARED_VIEW_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid) sharedView = parsed;
  }
} catch (e) {
  localStorage.removeItem(SHARED_VIEW_KEY);
}

function activeStorageKey() {
  return sharedView ? SHARED_CACHE_KEY : STORAGE_KEY;
}

export function isReadOnly() {
  return !!sharedView;
}

let d = JSON.parse(localStorage.getItem(activeStorageKey())) || {
  saldo: 0, fornitori: [], stipendi: [], abit: ['Pranzo', 'Treno'], log: [], fatture: []
};
if (!d.fatture) d.fatture = [];
if (!d.anticipi) d.anticipi = [];
if (!d.customCats) d.customCats = [];
if (!d.aziendaData) d.aziendaData = {};

let casseList = [{ id: 1 }];
let casseNextId = 2;
let pendingExpenses = [];
let expCat = 'fornitori';
let expSelectedVoice = null;
let openRubriche = {};
let confirmCallback = null;
let editingItem = null;
let modalCat = null;
let selectedDate = new Date();
let editingDay = false;
let fattureFilter = 'tutte';
let fattureSort = 'data';
let editingFatturaId = null;
let parsedImportData = [];
let importMode = 'movimenti'; // 'movimenti' or 'fatture'

// Firebase state
let firebaseDb = null;
let firebaseUser = null;
let cloudSyncEnabled = false;
let syncDebounceTimer = null;

let _onSaveCallback = null;
export function setOnSaveCallback(fn) { _onSaveCallback = fn; }

function save() {
  const key = activeStorageKey();
  try {
    localStorage.setItem(key, JSON.stringify(d));
  } catch (e) {
    // localStorage full — emergency: strip any remaining PDF blobs
    console.warn('[save] localStorage full, stripping blobs...', e);
    (d.fatture || []).forEach(f => { delete f.pdf; delete f.foto; });
    localStorage.setItem(key, JSON.stringify(d));
  }
}

// Sostituisce l'intero dataset in place: `d` e' importato come binding vivo
// da mezza applicazione, quindi non va mai riassegnato.
export function replaceData(obj) {
  Object.keys(d).forEach(k => delete d[k]);
  Object.assign(d, {
    saldo: 0, fornitori: [], stipendi: [], abit: [], log: [],
    fatture: [], anticipi: [], customCats: [], aziendaData: {}
  }, obj || {});
}

// Entra/esce dalla vista dei dati condivisi da un altro utente.
// `view` = { uid, email, name } oppure null per tornare ai propri dati.
export function setSharedView(view) {
  sharedView = view && view.uid ? view : null;
  if (sharedView) {
    localStorage.setItem(SHARED_VIEW_KEY, JSON.stringify(sharedView));
  } else {
    localStorage.removeItem(SHARED_VIEW_KEY);
    localStorage.removeItem(SHARED_CACHE_KEY);
  }
  replaceData(JSON.parse(localStorage.getItem(activeStorageKey())) || {});
}

export function getSharedView() {
  return sharedView;
}

export function fullSave() {
  save();
  if (_onSaveCallback) _onSaveCallback();
}

function resetData() {
  d.saldo = 0;
  d.fornitori = [];
  d.stipendi = [];
  d.abit = [];
  d.log = [];
  d.fatture = [];
  d.anticipi = [];
  d.customCats = [];
  d.aziendaData = {};
  pendingExpenses = [];
  save();
}

export {
  d, save, resetData, STORAGE_KEY,
  casseList, casseNextId,
  pendingExpenses,
  expCat, expSelectedVoice,
  openRubriche,
  confirmCallback,
  editingItem, modalCat,
  selectedDate, editingDay,
  fattureFilter, fattureSort, editingFatturaId,
  parsedImportData, importMode,
  firebaseDb, firebaseUser, cloudSyncEnabled, syncDebounceTimer,
  SHARED_CACHE_KEY
};

// Setters for reassignable variables
export function setCasseList(val) { casseList = val; }
export function setCasseNextId(val) { casseNextId = val; }
export function setPendingExpenses(val) { pendingExpenses = val; }
export function setExpCat(val) { expCat = val; }
export function setExpSelectedVoice(val) { expSelectedVoice = val; }
export function setConfirmCallback(val) { confirmCallback = val; }
export function setEditingItem(val) { editingItem = val; }
export function setModalCat(val) { modalCat = val; }
export function setSelectedDate(val) { selectedDate = val; }
export function setEditingDay(val) { editingDay = val; }
export function setFattureFilter(val) { fattureFilter = val; }
export function setFattureSort(val) { fattureSort = val; }
export function setEditingFatturaId(val) { editingFatturaId = val; }
export function setParsedImportData(val) { parsedImportData = val; }
export function setImportMode(val) { importMode = val; }
export function setFirebaseDb(val) { firebaseDb = val; }
export function setFirebaseUser(val) { firebaseUser = val; }
export function setCloudSyncEnabled(val) { cloudSyncEnabled = val; }
export function setSyncDebounceTimer(val) { syncDebounceTimer = val; }

// ─── PDF Storage Migration (localStorage → IndexedDB) ───
export async function initPdfStorage() {
  try {
    await openDb();
    const needsMigration = d.fatture.some(f => f.pdf || f.foto);
    if (needsMigration) {
      const count = await migrateFromFatture(d.fatture);
      if (count > 0) {
        d.fatture.forEach(f => {
          if (f.pdf || f.foto) {
            f.hasPdf = true;
            delete f.pdf;
            delete f.foto;
          }
        });
        try {
          save();
        } catch (e) {
          // localStorage might be full — force strip all blobs
          d.fatture.forEach(f => { delete f.pdf; delete f.foto; });
          try { save(); } catch (_) { /* truly full */ }
        }
        console.log(`[PDF migration] moved ${count} PDFs to IndexedDB`);
      }
    }
  } catch (err) {
    console.error('[PDF storage] IndexedDB unavailable:', err);
  }
}
