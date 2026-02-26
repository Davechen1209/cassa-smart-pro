// ─── State Management ───

import { openDb, migrateFromFatture } from './pdf-storage.js';

const STORAGE_KEY = 'cassa_v6';

let d = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
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
let editingFatturaId = null;
let anticipiFilter = 'aperti';
let anticipiNextId = d.anticipi.length > 0 ? Math.max(...d.anticipi.map(a => a.id)) + 1 : 1;
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
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
  fattureFilter, editingFatturaId,
  anticipiFilter, anticipiNextId,
  parsedImportData, importMode,
  firebaseDb, firebaseUser, cloudSyncEnabled, syncDebounceTimer
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
export function setEditingFatturaId(val) { editingFatturaId = val; }
export function setAnticipiFilter(val) { anticipiFilter = val; }
export function setAnticipiNextId(val) { anticipiNextId = val; }
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
