// ─── Main Entry Point ───

import './style.css';
import { initPinLock } from './js/pin-lock.js';

import {
  selectedDate, setSelectedDate, setEditingDay, setOnSaveCallback
} from './js/state.js';

import { closeConfirm, closeModal, closeModalOutside } from './js/modals.js';

import { toISODate } from './js/date-utils.js';

import {
  initFirebase, connectCloud, disconnectCloud, forceSyncFromCloud,
  setUiCallback as setFirebaseUiCallback, syncToCloud
} from './js/firebase-service.js';

import {
  ui, tab, toggleSettings, manualSaldo, confirmReset,
  updateDateDisplay, updateHeaderDate,
  startEditDay, stopEditDay, deleteDayLog,
  deleteLog, renderDaySummary, shareDay
} from './js/ui-engine.js';

import {
  renderCasse, addCassa, removeCassa, registra
} from './js/casse.js';

import {
  openExpenseSheet, closeExpenseSheet, closeExpenseOutside,
  setQuickAmount, customAmount, switchExpCat,
  selectExpVoice, addNewVoiceFromSheet, addExpense,
  renderPendingList, removePending
} from './js/expense.js';

import {
  toggleRubrica, deleteItem, editItem, openModalRubrica, modalConfirm
} from './js/rubrica.js';

import {
  openFatturaSheet, closeFatturaSheet, closeFatturaOutside,
  saveFattura, deleteFattura, filterFatture,
  openFatturaDetail, closeFatturaDetail, closeFatturaDetailOutside,
  registerPayment
} from './js/fatture.js';

import {
  downloadTemplate, importExcel,
  closeExcelImport, confirmFileImport,
  downloadBackup, importBackup
} from './js/excel-utils.js';

// Wire up callbacks: fullSave → syncToCloud + ui
setOnSaveCallback(() => { syncToCloud(); ui(); });
setFirebaseUiCallback(ui);

// ─── Event Delegation ───
document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;

  switch (action) {
    // Tabs
    case 'tab': tab(Number(btn.dataset.tab)); break;

    // Settings
    case 'toggleSettings': toggleSettings(); break;
    case 'manualSaldo': manualSaldo(); break;
    case 'confirmReset': confirmReset(); break;

    // Date
    case 'shiftDate':
      setEditingDay(false);
      selectedDate.setDate(selectedDate.getDate() + Number(btn.dataset.days));
      updateDateDisplay();
      break;
    case 'openDatePicker':
      document.getElementById('date-input-hidden').showPicker();
      break;

    // Casse
    case 'addCassa': addCassa(); break;
    case 'removeCassa': removeCassa(Number(btn.dataset.id)); break;
    case 'registra': registra(); break;

    // Expenses
    case 'openExpenseSheet': openExpenseSheet(); break;
    case 'closeExpenseSheet': closeExpenseSheet(); break;
    case 'setQuickAmount': setQuickAmount(Number(btn.dataset.amount)); break;
    case 'customAmount': customAmount(); break;
    case 'switchExpCat': switchExpCat(btn.dataset.cat); break;
    case 'selectExpVoice': selectExpVoice(btn.dataset.name); break;
    case 'addNewVoiceFromSheet': addNewVoiceFromSheet(); break;
    case 'addExpense': addExpense(); break;
    case 'removePending': removePending(Number(btn.dataset.index)); break;

    // Rubriche
    case 'toggleRubrica': toggleRubrica(btn.dataset.cat); break;
    case 'editItem': editItem(btn.dataset.cat, Number(btn.dataset.index)); break;
    case 'deleteItem': deleteItem(btn.dataset.cat, Number(btn.dataset.index), btn.dataset.name); break;
    case 'openModalRubrica': openModalRubrica(btn.dataset.cat); break;
    case 'closeModal': closeModalOutside(e); break;
    case 'modalConfirm': modalConfirm(); break;
    case 'modalCancel': closeModal(); break;

    // Confirm dialog
    case 'closeConfirm': closeConfirm(); break;

    // Day edit
    case 'startEditDay': startEditDay(); break;
    case 'stopEditDay': stopEditDay(); break;
    case 'deleteDayLog': deleteDayLog(Number(btn.dataset.index)); break;
    case 'shareDay': shareDay(); break;

    // History
    case 'deleteLog': deleteLog(Number(btn.dataset.index), btn.dataset.name); break;

    // Fatture
    case 'openFatturaSheet': openFatturaSheet(btn.dataset.id ? Number(btn.dataset.id) : undefined); break;
    case 'closeFatturaSheet': closeFatturaSheet(); break;
    case 'saveFattura': saveFattura(); break;
    case 'deleteFattura': deleteFattura(Number(btn.dataset.id)); break;
    case 'filterFatture': filterFatture(btn.dataset.filter, btn); break;
    case 'openFatturaDetail': openFatturaDetail(Number(btn.dataset.id)); break;
    case 'closeFatturaDetail': closeFatturaDetail(); break;
    case 'editFattura':
      openFatturaSheet(Number(btn.dataset.id));
      closeFatturaDetail();
      break;
    case 'registerPayment': registerPayment(Number(btn.dataset.id)); break;

    // Cloud
    case 'connectCloud': connectCloud(); break;
    case 'disconnectCloud': disconnectCloud(); break;
    case 'forceSyncFromCloud': forceSyncFromCloud(); break;

    // Backup
    case 'downloadBackup': downloadBackup(); break;
    case 'triggerImportFile': document.getElementById('import-file').click(); break;
    case 'downloadTemplate': downloadTemplate(); break;
    case 'triggerExcelFile': document.getElementById('excel-file').click(); break;
    case 'closeExcelImport': closeExcelImport(); break;
    case 'confirmFileImport': confirmFileImport(); break;
  }
});

// Overlay click-to-close
document.getElementById('expense-overlay').addEventListener('click', closeExpenseOutside);
document.getElementById('modal-overlay').addEventListener('click', closeModalOutside);
document.getElementById('fattura-overlay').addEventListener('click', closeFatturaOutside);
document.getElementById('fattura-detail-overlay').addEventListener('click', closeFatturaDetailOutside);

// Keyboard events
document.getElementById('modal-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') modalConfirm();
});

document.getElementById('exp-free-name').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') addExpense();
});

// Date picker
document.getElementById('date-input-hidden').addEventListener('change', function () {
  if (this.value) {
    setEditingDay(false);
    const parts = this.value.split('-');
    setSelectedDate(new Date(parts[0], parts[1] - 1, parts[2]));
    updateDateDisplay();
  }
});

// Fattura ciclo auto-calc
document.getElementById('fatt-ciclo').addEventListener('change', function () {
  if (this.value && this.value !== 'custom') {
    const arrivo = document.getElementById('fatt-data-arrivo').value;
    if (arrivo) {
      const dt = new Date(arrivo);
      dt.setDate(dt.getDate() + parseInt(this.value));
      document.getElementById('fatt-scadenza').value = toISODate(dt);
    }
  }
});

// File inputs
document.getElementById('import-file').addEventListener('change', importBackup);
document.getElementById('excel-file').addEventListener('change', importExcel);

// ─── Init ───
initPinLock();
updateHeaderDate();
updateDateDisplay();
renderCasse();
initFirebase();
ui();
