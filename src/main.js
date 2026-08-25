// ─── Main Entry Point ───

import './style.css';
import './js/fatture-app/hk-app.css';
import './js/fatture-app/hk-host.css';
import { initPinLock, changePin } from './js/pin-lock.js';
import { setLang, applyLanguage, getLang, t } from './js/i18n.js';

import {
  d, fullSave,
  selectedDate, setSelectedDate, setEditingDay, setOnSaveCallback,
  isReadOnly
} from './js/state.js';

import { closeConfirm, closeModal, closeModalOutside, showToast } from './js/modals.js';

import { toISODate } from './js/date-utils.js';

import {
  initFirebase, connectCloud, disconnectCloud, forceSyncFromCloud,
  googleSignIn, setUiCallback as setFirebaseUiCallback, syncToCloud,
  addSharedEmail, removeSharedEmail, viewSharedData, exitSharedView,
  refreshShares, applyReadOnlyUI, renderShareUI,
  hasSharedDatasets, openDatasetMenu, closeDatasetMenu, updateDatasetSwitcher, updateAppTitle
} from './js/firebase-service.js';

import {
  ui, tab, toggleSettings, manualSaldo, confirmReset,
  updateDateDisplay, updateHeaderDate,
  startEditDay, stopEditDay, deleteDayLog,
  deleteLog, renderDaySummary, renderHistory, shareDay,
  closeSharePreview, closeSharePreviewOutside, copyShareText, confirmShare,
  renderCustomCatsSettings, addCustomCat, removeCustomCat,
  toggleDashboard,
  saveAziendaData,
  saveGeminiKey, removeGeminiKey
} from './js/ui-engine.js';

import {
  renderCasse, addCassa, removeCassa, registra
} from './js/casse.js';

import {
  openExpenseSheet, closeExpenseSheet, closeExpenseOutside,
  setQuickAmount, customAmount, switchExpCat,
  selectExpVoice, filterExpVoices, apriElencoVoci, chiudiElencoVoci, addNewVoiceFromSheet, addExpense,
  renderPendingList, removePending
} from './js/expense.js';

import {
  toggleRubrica, toggleRubricaPage, deleteItem, editItem, openModalRubrica, modalConfirm
} from './js/rubrica.js';

import { Store as HkStore } from './js/fatture-app/hk-store.js';
import { fornitoriUnificati, allineaRubricaFornitori } from './js/fatture-bridge.js';
import { setReportPreset, setReportCompare, toggleCompareMenu, closeCompareMenu } from './js/report.js';
import { FattureApp } from './js/fatture-app/hk-app.js';
import { initOfflineMode } from './js/offline-mode.js';
import {
  openVoiceAssistant, closeVoiceAssistant, closeVoiceOutside,
  toggleVoiceRecording, confirmVoiceAction, cancelVoiceAction
} from './js/voice-assistant.js';
import { openSearch, closeSearch, onSearchInput, searchResultTap } from './js/search.js';
import { openPdfReportSheet, closePdfReportSheet, closePdfReportOutside, printReport } from './js/pdf-report.js';

import {
  downloadTemplate, importExcel,
  closeExcelImport, confirmFileImport,
  downloadBackup, importBackup,
  exportMovimenti,
  checkAutoBackup, renderAutoBackupCard, triggerAutoBackupDownload, toggleAutoBackup
} from './js/excel-utils.js';

// Wire up callbacks: fullSave → syncToCloud + ui
// Ogni scrittura sull'archivio fatture: i fornitori nuovi entrano anche
// nella rubrica della cassa, e il cloud si allinea.
HkStore.setOnSave(() => { allineaRubricaFornitori(); syncToCloud(); });

setOnSaveCallback(() => { syncToCloud(); ui(); });
setFirebaseUiCallback(ui);

// ─── Read-only guard ───
// Quando si guardano i dati condivisi da un altro utente ogni azione che
// modifica il dataset viene bloccata qui, in un punto solo.
const WRITE_ACTIONS = new Set([
  'manualSaldo', 'confirmReset', 'addCustomCat', 'removeCustomCat',
  'addCassa', 'removeCassa', 'registra',
  'openExpenseSheet', 'setQuickAmount', 'customAmount', 'switchExpCat',
  'selectExpVoice', 'addNewVoiceFromSheet', 'addExpense', 'removePending',
  'editItem', 'deleteItem', 'openModalRubrica', 'modalConfirm',
  'startEditDay', 'deleteDayLog', 'deleteLog',
  'openVoiceAssistant', 'toggleVoiceRecording', 'confirmVoiceAction',
  'saveAziendaData',
  'triggerImportFile', 'triggerExcelFile',
  'confirmFileImport', 'toggleAutoBackup',
  'forceSyncFromCloud',
  'addSharedEmail', 'removeSharedEmail', 'renameShop'
]);

// I comandi di scrittura non vanno solo bloccati: in sola lettura spariscono,
// cosi' il lettore non vede pulsanti che rispondono con un rifiuto. La regola
// e' generata qui da WRITE_ACTIONS perche' l'elenco resti uno solo, e come CSS
// (non come classe sui nodi) per sopravvivere ai re-render dinamici.
const readOnlyHideRule = document.createElement('style');
readOnlyHideRule.textContent =
  [...WRITE_ACTIONS].map(a => `body.readonly-mode [data-action="${a}"]`).join(',') +
  '{display:none !important;}';
document.head.appendChild(readOnlyHideRule);

function blockedInReadOnly(action) {
  if (!isReadOnly() || !WRITE_ACTIONS.has(action)) return false;
  showToast(t('share.readOnlyBlocked'), 'warn');
  return true;
}

// ─── Event Delegation ───
document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  // L'app fatture innestata ha una sua delega su document e usa nomi di
  // azione propri: 'tab' e' anche il suo (le viste interne), e finiva qui
  // dentro con data-tab assente, disattivando tutte le sezioni.
  if (btn.closest('.hk-app')) return;

  const action = btn.dataset.action;
  if (blockedInReadOnly(action)) return;

  // Ogni voce del selettore dataset chiude il menu che l'ha lanciata.
  if (btn.closest('#dataset-menu')) closeDatasetMenu();

  switch (action) {
    // Tabs
    case 'tab': tab(Number(btn.dataset.tab)); break;

    // Settings
    case 'toggleSettings': toggleSettings(); break;
    case 'manualSaldo': manualSaldo(); break;
    case 'confirmReset': confirmReset(); break;
    case 'setLang': setLang(btn.dataset.lang); updateHeaderDate(); updateDateDisplay(); renderCasse(); applyReadOnlyUI(); renderShareUI(); FattureApp.setLang(btn.dataset.lang); ui(); break;
    case 'changePin': changePin(); break;
    case 'toggleDashboard': toggleDashboard(); break;
    case 'openSearch': openSearch(); break;
    case 'closeSearch': closeSearch(); break;
    case 'searchResultTap': searchResultTap(Number(btn.dataset.index)); break;
    case 'addCustomCat': addCustomCat(); break;
    case 'removeCustomCat': removeCustomCat(Number(btn.dataset.index)); break;

    // Date
    case 'shiftDate':
      setEditingDay(false);
      selectedDate.setDate(selectedDate.getDate() + Number(btn.dataset.days));
      updateDateDisplay();
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
    case 'toggleRubricaPage': toggleRubricaPage(); break;
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
    case 'closeSharePreview': closeSharePreview(); break;
    case 'copyShareText': copyShareText().catch(console.error); break;
    case 'confirmShare': confirmShare().catch(console.error); break;

    // History
    case 'deleteLog': deleteLog(Number(btn.dataset.index), btn.dataset.name); break;
    case 'reportPreset': setReportPreset(btn.dataset.preset); break;
    case 'reportCompare': setReportCompare(btn.dataset.mode); break;
    case 'toggleCompareMenu': toggleCompareMenu(); break;

    // Voice accountant
    case 'openVoiceAssistant': openVoiceAssistant(); break;
    case 'closeVoiceAssistant': closeVoiceAssistant(); break;
    case 'toggleVoiceRecording': toggleVoiceRecording(); break;
    case 'confirmVoiceAction': confirmVoiceAction(); break;
    case 'cancelVoiceAction': cancelVoiceAction(); break;
    // Settings sections
    case 'toggleSettingsSection': {
      const section = btn.closest('.settings-section');
      if (section) section.classList.toggle('open');
      break;
    }

    // PDF / AI
    case 'saveAziendaData': saveAziendaData(); break;
    case 'saveGeminiKey': saveGeminiKey(); break;
    case 'removeGeminiKey': removeGeminiKey(); break;

    // Cloud
    case 'connectCloud': connectCloud(); break;
    case 'disconnectCloud': disconnectCloud(); break;
    case 'forceSyncFromCloud': forceSyncFromCloud(); break;
    case 'googleSignIn': googleSignIn(); break;

    // Condivisione dati
    case 'addSharedEmail': addSharedEmail().catch(console.error); break;
    case 'removeSharedEmail': removeSharedEmail(btn.dataset.email); break;
    case 'viewSharedData': viewSharedData(btn.dataset.uid); break;
    case 'exitSharedView': exitSharedView(); break;
    case 'renameShop': startRenameTitle(); break;
    case 'refreshShares': refreshShares().catch(console.error); break;

    // Backup
    case 'downloadBackup': downloadBackup().catch(console.error); break;
    case 'triggerImportFile': document.getElementById('import-file').click(); break;
    case 'downloadTemplate': downloadTemplate(); break;
    case 'triggerExcelFile': document.getElementById('excel-file').click(); break;
    case 'exportMovimenti': exportMovimenti(); break;
    case 'openPdfReport': openPdfReportSheet(); break;
    case 'closePdfReport': closePdfReportSheet(); break;
    case 'printReport': printReport(); break;
    case 'closeExcelImport': closeExcelImport(); break;
    case 'confirmFileImport': confirmFileImport(); break;
    case 'toggleAutoBackup': toggleAutoBackup(); break;
    case 'triggerManualBackup': triggerAutoBackupDownload().catch(console.error); break;
  }
});

// Overlay click-to-close
document.getElementById('expense-overlay').addEventListener('click', closeExpenseOutside);
document.getElementById('modal-overlay').addEventListener('click', closeModalOutside);
document.getElementById('pdf-report-overlay').addEventListener('click', closePdfReportOutside);
document.getElementById('share-preview-overlay').addEventListener('click', closeSharePreviewOutside);
document.getElementById('voice-overlay').addEventListener('click', closeVoiceOutside);

// Voice select dropdown
// Ricerca fra le voci: filtra man mano che si scrive.
document.getElementById('exp-voice-search').addEventListener('input', filterExpVoices);
document.getElementById('exp-voice-search').addEventListener('focus', apriElencoVoci);

// Fuori dal selettore l'elenco si richiude: resta aperto solo finche' serve.
document.addEventListener('click', (e) => {
  if (!e.target.closest('#exp-voices-section')) chiudiElencoVoci();
});
document.getElementById('exp-voice-search').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { chiudiElencoVoci(); e.target.blur(); }
});

// Esc chiude cio' che e' aperto. Prima l'unica via d'uscita era il pulsante
// giusto: se una finestra copriva lo schermo e il pulsante era fuori vista,
// da tastiera non se ne usciva. Si chiude solo la piu' esterna aperta.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const aperti = [
    'search-overlay', 'confirm-overlay', 'modal-overlay', 'excel-overlay',
    'share-preview-overlay', 'pdf-report-overlay', 'voice-overlay',
    'expense-overlay', 'dataset-menu-overlay',
  ];
  for (const id of aperti) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('show')) {
      el.classList.remove('show');
      e.preventDefault();
      return;
    }
  }
  const impostazioni = document.getElementById('settings-page');
  if (impostazioni && impostazioni.classList.contains('open')) {
    impostazioni.classList.remove('open');
    document.body.classList.remove('settings-open');
  }
});

// Keyboard events
document.getElementById('modal-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !blockedInReadOnly('modalConfirm')) modalConfirm();
});

document.getElementById('exp-free-name').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !blockedInReadOnly('addExpense')) addExpense();
});

// Invio dai campi della spesa: il fuoco parte sull'importo, ed era l'unico
// da cui premere Invio non faceva nulla.
['exp-amount', 'exp-note'].forEach((id) => {
  document.getElementById(id).addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !blockedInReadOnly('addExpense')) addExpense();
  });
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

// File inputs
document.getElementById('import-file').addEventListener('change', (e) => {
  if (!blockedInReadOnly('triggerImportFile')) importBackup(e);
});
document.getElementById('excel-file').addEventListener('change', (e) => {
  if (!blockedInReadOnly('triggerExcelFile')) importExcel(e);
});
document.getElementById('history-search').addEventListener('input', () => renderHistory());
document.getElementById('search-input').addEventListener('input', onSearchInput);

// ─── Titolo: selettore dataset + rinomina ───
// Con dei dataset condivisi disponibili il titolo diventa il selettore di
// "quali dati sto guardando"; la rinomina resta, dentro quel menu. Senza
// condivisioni non c'e' niente da scegliere e il tap rinomina come prima.
const appTitleEl = document.getElementById('app-title');
updateAppTitle();

function startRenameTitle() {
  if (isReadOnly()) return;
  appTitleEl.contentEditable = 'true';
  appTitleEl.style.borderBottom = '1px dashed var(--blue)';
  appTitleEl.style.outline = 'none';
  appTitleEl.focus();
  // Select all text
  const range = document.createRange();
  range.selectNodeContents(appTitleEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

document.getElementById('app-title-tap').addEventListener('click', () => {
  // Durante la rinomina il tap serve a posizionare il cursore, non a riaprire.
  if (appTitleEl.isContentEditable) return;
  if (hasSharedDatasets()) { openDatasetMenu(); return; }
  startRenameTitle();
});

document.getElementById('dataset-menu-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDatasetMenu();
});

// Il menu del confronto vive dentro il report, non ha un overlay proprio:
// si chiude al primo click che cade fuori dal suo contenitore.
document.addEventListener('click', (e) => {
  if (!e.target.closest('.report-compare-wrap')) closeCompareMenu();
});

function saveTitle() {
  if (isReadOnly()) return;
  appTitleEl.contentEditable = 'false';
  appTitleEl.style.borderBottom = '1px dashed transparent';
  const name = appTitleEl.textContent.trim();
  if (name) {
    d.shopName = name;
  } else {
    delete d.shopName;
    appTitleEl.textContent = t('app.title');
  }
  fullSave();
}

appTitleEl.addEventListener('blur', saveTitle);
appTitleEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); appTitleEl.blur(); }
  if (e.key === 'Escape') {
    appTitleEl.textContent = d.shopName || t('app.title');
    appTitleEl.blur();
  }
});

// ─── Init ───
(async () => {
  initPinLock();
  applyLanguage();
  applyReadOnlyUI();
  updateDatasetSwitcher();
  // I fornitori che esistono solo fra le fatture entrano in rubrica anche
  // per gli archivi gia' esistenti, non solo alla prossima modifica.
  allineaRubricaFornitori();
  updateAppTitle();
  updateHeaderDate();
  updateDateDisplay();
  renderCasse();
  initFirebase();
  initOfflineMode();
  renderAutoBackupCard();
  checkAutoBackup();
  ui();
})();
