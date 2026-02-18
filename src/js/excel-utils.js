// ─── Excel Import/Export & Backup ───

import * as XLSX from 'xlsx';
import {
  d, fullSave, pendingExpenses, parsedImportData,
  setParsedImportData
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { parseFlexDate } from './date-utils.js';

export function downloadTemplate() {
  const ws_data = [
    ['\u65E5\u671F', '\u603B\u91D1\u989D', 'POS', '\u73B0\u91D1', '\u73B0\u91D1\u652F\u51FA', '\u652F\u51FA\u9879\u76EE', '\u5B58\u94B1', '\u9000\u94B1'],
    ['17/02/2026', 1000, 500, 500, '', '', '', ''],
    ['17/02/2026', '', '', '', 120, 'Fornitore Rossi', '', ''],
    ['16/02/2026', 800, 300, 500, 200, 'Stipendio Mario', 50, ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimenti');
  XLSX.writeFile(wb, 'template-cassa.xlsx');
  showToast('Template scaricato! Compilalo e ricaricalo', 'check');
}

function findCol(headers, keywords) {
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (keywords.some(k => lower === k || lower.includes(k))) return h;
  }
  return null;
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

export function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) { showToast('File vuoto', 'warn'); return; }

      const headers = Object.keys(rows[0]);
      const newData = [];

      const colDate = findCol(headers, ['\u65E5\u671F', 'data', 'date', 'giorno']);
      const colTotalZ = findCol(headers, ['\u603B\u91D1\u989D', 'totale z', 'totale_z']);
      const colPOS = findCol(headers, ['pos']);
      const colCash = findCol(headers, ['\u73B0\u91D1', 'cash', 'contanti']);
      const colExpAmount = findCol(headers, ['\u73B0\u91D1\u652F\u51FA', 'uscita', 'spesa', 'expense']);
      const colExpDesc = findCol(headers, ['\u652F\u51FA\u9879\u76EE', 'descrizione', 'desc', 'voce', 'causale', 'nome']);
      const colDeposit = findCol(headers, ['\u5B58\u94B1', 'deposito', 'versamento']);
      const colRefund = findCol(headers, ['\u9000\u94B1', 'rimborso', 'reso', 'refund']);
      const colSimpleAmount = findCol(headers, ['importo', 'amount', 'valore']);

      const isSimpleFormat = colSimpleAmount && !colTotalZ && !colExpAmount;

      rows.forEach(row => {
        const dateStr = parseRawDate(colDate ? row[colDate] : null);

        if (isSimpleFormat) {
          const amount = parseNumber(row[colSimpleAmount]);
          if (amount === 0) return;
          const desc = colExpDesc ? String(row[colExpDesc] || 'Importato').trim() : 'Importato';
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
          const desc = totalZ > 0 ? 'Incasso Cash (Z:' + totalZ + ' POS:' + pos + ')' : 'Incasso';
          newData.push({ date: dateStr, desc, amount: incomeAmount });
        }

        if (expAmt > 0) {
          const desc = expDesc || 'Spesa';
          newData.push({ date: dateStr, desc, amount: -Math.abs(expAmt) });
        }

        if (deposit > 0) {
          newData.push({ date: dateStr, desc: 'Deposito', amount: -Math.abs(deposit) });
        }

        if (refund > 0) {
          newData.push({ date: dateStr, desc: 'Reso cliente', amount: -Math.abs(refund) });
        }
      });

      setParsedImportData(newData);

      if (newData.length === 0) {
        showToast('Nessun dato valido trovato', 'warn');
        return;
      }

      showImportPreview();
    } catch (err) {
      showToast('Errore lettura file: ' + err.message, 'warn');
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
  html += '<th>Data</th><th>Descrizione</th><th style="text-align:right;">Importo</th></tr></thead><tbody>';

  const showRows = parsedImportData.slice(0, 8);
  showRows.forEach(r => {
    const color = r.amount >= 0 ? 'var(--green)' : 'var(--red)';
    const sign = r.amount >= 0 ? '+' : '';
    html += `<tr>
      <td style="padding:8px; font-size:13px;">${escapeHtml(r.date)}</td>
      <td style="padding:8px; font-size:13px;">${escapeHtml(r.desc)}</td>
      <td style="padding:8px; font-size:13px; text-align:right; font-weight:600; color:${color};">${sign}${r.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\u20AC</td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  if (parsedImportData.length > 8) {
    html += `<div style="text-align:center; font-size:12px; color:var(--gray); margin-bottom:8px;">...e altri ${parsedImportData.length - 8} movimenti</div>`;
  }

  preview.innerHTML = html;

  summary.style.display = 'block';
  summary.innerHTML = `
    <div>${parsedImportData.length} movimenti totali</div>
    <div style="font-size:13px; margin-top:4px; color:var(--text3);">
      Incassi: <span style="color:var(--green);">+${totalIncome.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\u20AC</span> |
      Uscite: <span style="color:var(--red);">${totalExpense.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\u20AC</span> |
      Netto: <span style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'};">${net >= 0 ? '+' : ''}${net.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\u20AC</span>
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
  showToast(count + ' movimenti importati!', 'check');
}

export function downloadBackup() {
  const backup = {
    _app: 'CassaSmartPro',
    _version: 6,
    _date: new Date().toISOString(),
    saldo: d.saldo,
    fornitori: d.fornitori,
    stipendi: d.stipendi,
    abit: d.abit,
    log: d.log,
    fatture: d.fatture
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
  showToast('Backup scaricato! Salvalo in un posto sicuro', 'check');
}

export function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const backup = JSON.parse(e.target.result);

      if (!backup._app || backup._app !== 'CassaSmartPro') {
        showToast('File non valido: non e\' un backup di Cassa Smart Pro', 'warn');
        return;
      }

      const movCount = (backup.log || []).length;
      const dateStr = backup._date ? new Date(backup._date).toLocaleDateString('it-IT') : '?';

      showConfirm(
        'Ripristina Backup',
        'Backup del ' + dateStr + ' con ' + movCount + ' movimenti. I dati attuali verranno sostituiti. Continuare?',
        () => {
          d.saldo = backup.saldo ?? 0;
          d.fornitori = backup.fornitori || [];
          d.stipendi = backup.stipendi || [];
          d.abit = backup.abit || [];
          d.log = backup.log || [];
          d.fatture = backup.fatture || [];
          pendingExpenses.length = 0;
          fullSave();
          showToast('Dati ripristinati! ' + movCount + ' movimenti caricati', 'check');
        }
      );
    } catch (err) {
      showToast('Errore nella lettura del file', 'warn');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
