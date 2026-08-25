// ─── Excel Import/Export & Backup ───

import * as XLSX from 'xlsx';
import {
  d, fullSave, pendingExpenses, parsedImportData, importMode,
  setParsedImportData, setImportMode, isReadOnly
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { parseFlexDate } from './date-utils.js';
import { decodeCsvText, detectCsvSeparator, parseCsvMatrix } from './csv-parse.js';
import { t } from './i18n.js';

export function downloadTemplate() {
  const ws_data = [
    [t('excel.colDate'), t('excel.colTotal'), t('excel.colPos'), t('excel.colCash'), t('excel.colCashOut'), t('excel.colExpItem'), t('excel.colDeposit'), t('excel.colRefund')],
    ['17/02/2026', 1000, 500, 500, '', '', '', ''],
    ['17/02/2026', '', '', '', 120, 'Fornitore Rossi', '', ''],
    ['16/02/2026', 800, 300, 500, 200, 'Stipendio Mario', 50, ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimenti');
  XLSX.writeFile(wb, 'template-cassa.xlsx');
  showToast(t('backup.templateDone'), 'check');
}

const HEADER_KEYS = {
  date: ['日期', 'data', 'date', 'giorno'],
  expDesc: ['支出项目', 'descrizione', 'desc', 'voce', 'causale', 'nome'],
  totalZ: ['总金额', 'totale z', 'totale_z', 'totale'],
  pos: ['pos'],
  expAmount: ['现金支出', 'uscita', 'spesa', 'expense'],
  cash: ['现金', 'cash', 'contanti'],
  deposit: ['存钱', 'deposito', 'versamento'],
  refund: ['退钱', 'rimborso', 'reso', 'refund'],
  simpleAmount: ['importo', 'amount', 'valore'],
};

function normalizeHeader(h) {
  return String(h).replace(/^﻿/, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Prima passata sui titoli identici, poi su quelli che contengono la parola:
// cosi' "Contanti" non viene rubata da "Uscita Cash", che contiene "cash".
// Le colonne gia' assegnate escono dalla ricerca successiva.
function findCol(headers, keywords, used) {
  const free = used ? headers.filter(h => !used.has(h)) : headers;
  for (const h of free) {
    if (keywords.includes(normalizeHeader(h))) { if (used) used.add(h); return h; }
  }
  for (const h of free) {
    const lower = normalizeHeader(h);
    if (lower && keywords.some(k => lower.includes(k))) { if (used) used.add(h); return h; }
  }
  return null;
}

const HEADER_HINTS = Object.keys(HEADER_KEYS).reduce((all, k) => all.concat(HEADER_KEYS[k]), []);

function looksLikeHeader(cells) {
  return cells.some(c => {
    const v = normalizeHeader(c);
    return v !== '' && HEADER_HINTS.some(h => v === h || v.includes(h));
  });
}

// I CSV esportati da gestionali spesso hanno righe di intestazione libere prima
// della tabella: si parte dalla prima riga che assomiglia a dei titoli.
function csvToObjects(matrix) {
  let headerIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    if (looksLikeHeader(matrix[i])) { headerIdx = i; break; }
  }

  const seen = {};
  const headers = matrix[headerIdx].map((h, i) => {
    let name = String(h).replace(/^﻿/, '').trim() || 'col' + (i + 1);
    if (seen[name]) { seen[name]++; name = name + ' (' + seen[name] + ')'; }
    else seen[name] = 1;
    return name;
  });

  const out = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = {};
    headers.forEach((h, c) => { row[h] = matrix[i][c] !== undefined ? matrix[i][c] : ''; });
    out.push(row);
  }
  return out;
}

function parseRawDate(raw) {
  if (!raw) return new Date().toLocaleDateString('it-IT');
  if (raw instanceof Date) return raw.toLocaleDateString('it-IT');
  if (typeof raw === 'number') {
    const dt = new Date((raw - 25569) * 86400 * 1000);
    return dt.toLocaleDateString('it-IT');
  }
  return parseFlexDate(String(raw).trim());
}

function parseNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let s = String(val).trim();
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  s = s.replace(/[^0-9.\-]/g, '');
  return parseFloat(s) || 0;
}

function rowsToMovimenti(rows) {
  const headers = Object.keys(rows[0]);
  const used = new Set();
  const newData = [];

  const colDate = findCol(headers, HEADER_KEYS.date, used);
  const colExpDesc = findCol(headers, HEADER_KEYS.expDesc, used);
  const colTotalZ = findCol(headers, HEADER_KEYS.totalZ, used);
  const colPOS = findCol(headers, HEADER_KEYS.pos, used);
  const colExpAmount = findCol(headers, HEADER_KEYS.expAmount, used);
  const colCash = findCol(headers, HEADER_KEYS.cash, used);
  const colDeposit = findCol(headers, HEADER_KEYS.deposit, used);
  const colRefund = findCol(headers, HEADER_KEYS.refund, used);
  const colSimpleAmount = findCol(headers, HEADER_KEYS.simpleAmount, used);

  const matched = !!(colTotalZ || colCash || colExpAmount || colDeposit || colRefund || colSimpleAmount);
  const isSimpleFormat = colSimpleAmount && !colTotalZ && !colExpAmount;

  rows.forEach(row => {
    const dateStr = parseRawDate(colDate ? row[colDate] : null);

    if (isSimpleFormat) {
      const amount = parseNumber(row[colSimpleAmount]);
      if (amount === 0) return;
      const desc = colExpDesc ? String(row[colExpDesc] || t('excel.imported')).trim() : t('excel.imported');
      newData.push({ date: dateStr, desc, amount });
      return;
    }

    const totalZ = parseNumber(colTotalZ ? row[colTotalZ] : 0);
    const pos = parseNumber(colPOS ? row[colPOS] : 0);
    const cash = parseNumber(colCash ? row[colCash] : 0);
    const expAmt = parseNumber(colExpAmount ? row[colExpAmount] : 0);
    const expDesc = colExpDesc ? String(row[colExpDesc] || '').trim() : '';
    const deposit = parseNumber(colDeposit ? row[colDeposit] : 0);
    const refund = parseNumber(colRefund ? row[colRefund] : 0);

    let incomeAmount = 0;
    if (cash > 0) {
      incomeAmount = cash;
    } else if (totalZ > 0) {
      incomeAmount = totalZ - pos;
    }

    if (incomeAmount > 0) {
      const desc = totalZ > 0 ? t('fatt.incassoCash') + ' (Z:' + totalZ + ' POS:' + pos + ')' : t('fatt.incassoCash');
      newData.push({ date: dateStr, desc, amount: incomeAmount });
    }

    if (expAmt > 0) {
      const desc = expDesc || t('exp.genericExpense');
      newData.push({ date: dateStr, desc, amount: -Math.abs(expAmt) });
    }

    if (deposit > 0) {
      newData.push({ date: dateStr, desc: t('excel.deposit'), amount: -Math.abs(deposit) });
    }

    if (refund > 0) {
      newData.push({ date: dateStr, desc: t('excel.refund'), amount: -Math.abs(refund) });
    }
  });

  return { data: newData, matched, headers };
}

export function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  // I CSV non passano da SheetJS: leggendoli come foglio di calcolo "500,00"
  // diventa 50000 e "1.000,00" diventa 1. Li parsiamo noi come testo.
  const isCSV = /\.(csv|tsv|txt)$/i.test(file.name) || file.type === 'text/csv' || file.type === 'text/tab-separated-values';

  const reader = new FileReader();
  reader.onerror = function () { showToast(t('backup.readError'), 'warn'); };
  reader.onload = function (e) {
    try {
      let rows;

      if (isCSV) {
        const text = decodeCsvText(e.target.result);
        if (!text.trim()) { showToast(t('backup.fileEmpty'), 'warn'); return; }
        const sep = /\.tsv$/i.test(file.name) ? '\t' : detectCsvSeparator(text);
        const matrix = parseCsvMatrix(text, sep);
        if (matrix.length < 2) { showToast(t('backup.fileEmpty'), 'warn'); return; }
        rows = csvToObjects(matrix);
      } else {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      }

      if (rows.length === 0) { showToast(t('backup.fileEmpty'), 'warn'); return; }

      const parsed = rowsToMovimenti(rows);

      setImportMode('movimenti');
      setParsedImportData(parsed.data);

      if (parsed.data.length === 0) {
        if (!parsed.matched) {
          showToast(t('backup.noColumns', { cols: parsed.headers.slice(0, 6).join(', ') }), 'warn');
        } else {
          showToast(t('backup.noValidData'), 'warn');
        }
        return;
      }

      showImportPreview();
    } catch (err) {
      showToast(t('backup.fileError') + err.message, 'warn');
    }
  };
  reader.readAsArrayBuffer(file);
}

export function showImportPreview() {
  const preview = document.getElementById('import-preview');
  const summary = document.getElementById('import-summary');
  const incomes = parsedImportData.filter(r => r.amount > 0);
  const expenses = parsedImportData.filter(r => r.amount < 0);
  const totalIncome = incomes.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);
  const net = totalIncome + totalExpense;

  let html = '<div style="overflow-x:auto;"><table class="edit-table" style="margin-bottom:8px;"><thead><tr>';
  html += `<th>${t('excel.colDate')}</th><th>${t('excel.colDesc')}</th><th style="text-align:right;">${t('excel.colAmount')}</th></tr></thead><tbody>`;

  const showRows = parsedImportData.slice(0, 8);
  showRows.forEach(r => {
    const color = r.amount >= 0 ? 'var(--green)' : 'var(--red)';
    const sign = r.amount >= 0 ? '+' : '';
    html += `<tr>
      <td style="padding:8px; font-size:13px;">${escapeHtml(r.date)}</td>
      <td style="padding:8px; font-size:13px;">${escapeHtml(r.desc)}</td>
      <td style="padding:8px; font-size:13px; text-align:right; font-weight:600; color:${color};">${sign}${r.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC</td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  if (parsedImportData.length > 8) {
    html += `<div style="text-align:center; font-size:12px; color:var(--gray); margin-bottom:8px;">${t('backup.moreItems', { n: parsedImportData.length - 8 })}</div>`;
  }

  preview.innerHTML = html;

  summary.style.display = 'block';
  summary.innerHTML = `
    <div>${t('backup.totalItems', { n: parsedImportData.length })}</div>
    <div style="font-size:13px; margin-top:4px; color:var(--text3);">
      ${t('excel.incomes') + ':'} <span style="color:var(--green);">+${totalIncome.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC</span> |
      ${t('excel.expenses') + ':'} <span style="color:var(--red);">${totalExpense.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC</span> |
      ${t('excel.net') + ':'} <span style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'};">${net >= 0 ? '+' : ''}${net.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC</span>
    </div>
  `;

  document.getElementById('excel-overlay').classList.add('show');
}

export function closeExcelImport() {
  document.getElementById('excel-overlay').classList.remove('show');
  setParsedImportData([]);
}

export function confirmFileImport() {
  if (parsedImportData.length === 0) return;

  parsedImportData.forEach(r => {
    d.saldo += r.amount;
    d.log.push({ d: r.date, v: r.desc, a: r.amount });
  });
  const count = parsedImportData.length;
  fullSave();
  closeExcelImport();
  showToast(t('backup.imported', { n: count }), 'check');
}

export function exportMovimenti() {
  if (d.log.length === 0) { showToast(t('history.empty'), 'warn'); return; }

  const rows = [[t('excel.colDate'), t('excel.colDesc'), t('excel.colAmount')]];
  d.log.forEach(l => {
    rows.push([l.d, l.v, l.a]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimenti');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, 'movimenti-' + dateStr + '.xlsx');
  showToast(t('backup.exportDone'), 'check');
}

export async function downloadBackup() {
  const backup = {
    _app: 'CassaSmartPro',
    _version: 6,
    _date: new Date().toISOString(),
    saldo: d.saldo,
    fornitori: d.fornitori,
    stipendi: d.stipendi,
    abit: d.abit,
    log: d.log,
    anticipi: d.anticipi,
    customCats: d.customCats || []
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'cassa-backup-' + dateStr + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(t('backup.downloaded'), 'check');
}

// ─── Auto Backup ───

export function isAutoBackupEnabled() {
  const v = localStorage.getItem('cassa_auto_backup_enabled');
  return v === null ? true : v === 'true';
}

export function toggleAutoBackup() {
  localStorage.setItem('cassa_auto_backup_enabled', (!isAutoBackupEnabled()).toString());
  renderAutoBackupCard();
}

export function checkAutoBackup() {
  if (!isAutoBackupEnabled()) return;
  // In vista condivisa il dataset non e' nostro: niente backup automatico.
  if (isReadOnly()) return;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const unGiorno = 24 * 60 * 60 * 1000;
  const lastTs = parseInt(localStorage.getItem('cassa_auto_backup_ts') || '0', 10);
  // Senza timestamp il confronto partiva dal 1970: "sono passati sette
  // giorni" era vero al primo avvio in assoluto, e la prima cosa che l'app
  // faceva era proporre (prima: scaricare) un backup di un archivio appena
  // nato. Il conto parte da adesso.
  if (!lastTs) { localStorage.setItem('cassa_auto_backup_ts', Date.now().toString()); return; }
  if (Date.now() - lastTs <= sevenDays || d.log.length === 0) return;
  // Prima partiva da solo: due secondi dopo l'apertura il telefono si
  // ritrovava un file scaricato senza aver chiesto niente a nessuno. Ora lo
  // propone, e se la risposta e' no non torna a chiedere prima di domani.
  const chiestoIl = parseInt(localStorage.getItem('cassa_auto_backup_asked') || '0', 10);
  if (Date.now() - chiestoIl < unGiorno) return;
  setTimeout(() => {
    localStorage.setItem('cassa_auto_backup_asked', Date.now().toString());
    showConfirm(t('autoBackup.askTitle'), t('autoBackup.askMsg'), () => triggerAutoBackupDownload());
  }, 2000);
}

export async function triggerAutoBackupDownload() {
  await downloadBackup();
  localStorage.setItem('cassa_auto_backup_ts', Date.now().toString());
  renderAutoBackupCard();
}

export function renderAutoBackupCard() {
  const el = document.getElementById('auto-backup-status');
  if (!el) return;
  const ts = parseInt(localStorage.getItem('cassa_auto_backup_ts') || '0', 10);
  const enabled = isAutoBackupEnabled();
  const lastStr = ts ? new Date(ts).toLocaleDateString('it-IT') : t('autoBackup.never');
  el.innerHTML = `
    <div class="auto-backup-row">
      <span class="auto-backup-label">${t('autoBackup.lastLabel')}: <strong>${lastStr}</strong></span>
      <button class="toggle-switch ${enabled ? 'on' : ''}" data-action="toggleAutoBackup"
        role="switch" aria-checked="${enabled}" aria-label="${t('autoBackup.toggleAria')}"></button>
    </div>
    <button class="btn-sm blue" data-action="triggerManualBackup" style="width:100%;margin-top:12px;">
      ${t('autoBackup.manualBtn')}
    </button>`;
}

export function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const backup = JSON.parse(e.target.result);

      if (!backup._app || backup._app !== 'CassaSmartPro') {
        showToast(t('backup.invalidFile'), 'warn');
        return;
      }

      const movCount = (backup.log || []).length;
      const dateStr = backup._date ? new Date(backup._date).toLocaleDateString('it-IT') : '?';

      showConfirm(
        t('backup.restoreTitle'),
        t('backup.restoreMsg', { date: dateStr, n: movCount }),
        async () => {
          d.saldo = backup.saldo ?? 0;
          d.fornitori = backup.fornitori || [];
          d.stipendi = backup.stipendi || [];
          d.abit = backup.abit || [];
          d.log = backup.log || [];
          d.anticipi = backup.anticipi || [];
          d.customCats = backup.customCats || [];
          pendingExpenses.length = 0;
          fullSave();
          showToast(t('backup.restoreDone', { n: movCount }), 'check');
        }
      );
    } catch (err) {
      showToast(t('backup.readError'), 'warn');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
