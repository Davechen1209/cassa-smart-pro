// ─── State Management ───

const STORAGE_KEY = 'cassa_v6';

let d = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  saldo: 0, fornitori: [], stipendi: [], abit: ['Pranzo', 'Treno'], log: [], fatture: []
};
if (!d.fatture) d.fatture = [];

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
let parsedImportData = [];

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
  parsedImportData,
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
export function setParsedImportData(val) { parsedImportData = val; }
export function setFirebaseDb(val) { firebaseDb = val; }
export function setFirebaseUser(val) { firebaseUser = val; }
export function setCloudSyncEnabled(val) { cloudSyncEnabled = val; }
export function setSyncDebounceTimer(val) { syncDebounceTimer = val; }
