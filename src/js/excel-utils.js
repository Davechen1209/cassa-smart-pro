// ─── Excel Import/Export & Backup ───

import * as XLSX from 'xlsx';
import {
  d, fullSave, pendingExpenses, parsedImportData, importMode,
  setParsedImportData, setImportMode
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { parseFlexDate } from './date-utils.js';
import { t } from './i18n.js';
import { getAllPdfs, storePdf } from './pdf-storage.js';

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

      if (rows.length === 0) { showToast(t('backup.fileEmpty'), 'warn'); return; }

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

      setImportMode('movimenti');
      setParsedImportData(newData);

      if (newData.length === 0) {
        showToast(t('backup.noValidData'), 'warn');
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

  if (importMode === 'fatture') {
    parsedImportData.forEach(r => {
      d.fatture.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        dataArrivo: r.dataArrivo || '',
        azienda: r.azienda || '',
        numero: r.numero || '',
        importo: r.importo || 0,
        tipoPagamento: r.tipoPagamento || '',
        numeroAssegno: '',
        ciclo: '',
        scadenza: r.scadenza || '',
        note: r.note || '',
        pagata: !!r.tipoPagamento,
        hasPdf: false
      });
    });
    const count = parsedImportData.length;
    fullSave();
    closeExcelImport();
    showToast(t('backup.importedFatture', { n: count }), 'check');
  } else {
    parsedImportData.forEach(r => {
      d.saldo += r.amount;
      d.log.push({ d: r.date, v: r.desc, a: r.amount });
    });
    const count = parsedImportData.length;
    fullSave();
    closeExcelImport();
    showToast(t('backup.imported', { n: count }), 'check');
  }
}

// ─── Fatture Excel Import ───

export function downloadFattureTemplate() {
  const ws_data = [
    [t('excel.colArrivalDate'), t('excel.colNumber'), t('excel.colSupplier'), t('excel.colAmount'), t('excel.colPaymentType'), t('excel.colDueDate'), t('excel.colNotes'), t('excel.colPaid')],
    ['2026-02-17', 'FT-001', 'Fornitore Rossi S.r.l.', 1500.00, 'bonifico', '2026-03-17', '', 'TRUE'],
    ['2026-02-18', 'FT-002', 'Azienda Bianchi', 800.50, '', '', 'Da pagare', ''],
    ['2026-02-19', 'FT-003', 'Trasporti Verdi', 2300.00, 'assegno', '2026-04-19', '', 'TRUE'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fatture');
  XLSX.writeFile(wb, 'template-fatture.xlsx');
  showToast(t('backup.templateDone'), 'check');
}

export function importFattureExcel(event) {
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

      if (rows.length === 0) { showToast(t('backup.fileEmpty'), 'warn'); return; }

      const headers = Object.keys(rows[0]);
      const newData = [];

      const colData = findCol(headers, ['data arrivo', 'data', 'date', 'giorno', '\u65E5\u671F']);
      const colNumero = findCol(headers, ['numero', 'num', 'n.', 'fattura']);
      const colAzienda = findCol(headers, ['azienda', 'fornitore', 'ragione sociale', 'nome', 'supplier']);
      const colImporto = findCol(headers, ['importo', 'amount', 'totale', 'valore']);
      const colTipo = findCol(headers, ['tipo pagamento', 'tipo', 'pagamento', 'payment']);
      const colScadenza = findCol(headers, ['scadenza', 'due date', 'deadline']);
      const colNote = findCol(headers, ['note', 'notes', 'descrizione', 'desc']);
      const colPagata = findCol(headers, ['pagata', 'paid', 'pagato', 'saldato']);

      if (!colAzienda && !colImporto) {
        showToast(t('backup.noValidData'), 'warn');
        return;
      }

      rows.forEach(row => {
        const azienda = colAzienda ? String(row[colAzienda] || '').trim() : '';
        const importo = parseNumber(colImporto ? row[colImporto] : 0);
        if (!azienda && importo === 0) return;

        const rawDate = colData ? row[colData] : null;
        let dataArrivo = '';
        if (rawDate) {
          if (rawDate instanceof Date) {
            dataArrivo = rawDate.toISOString().slice(0, 10);
          } else if (typeof rawDate === 'number') {
            const dt = new Date((rawDate - 25569) * 86400 * 1000);
            dataArrivo = dt.toISOString().slice(0, 10);
          } else {
            const s = String(rawDate).trim();
            if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
              dataArrivo = s;
            } else {
              const parsed = parseFlexDate(s);
              if (parsed) {
                const parts = parsed.split('/');
                dataArrivo = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
              }
            }
          }
        }

        let tipoPagamento = colTipo ? String(row[colTipo] || '').trim().toLowerCase() : '';
        if (tipoPagamento && !['contanti', 'bonifico', 'assegno'].includes(tipoPagamento)) {
          if (tipoPagamento.includes('bonif') || tipoPagamento.includes('bank')) tipoPagamento = 'bonifico';
          else if (tipoPagamento.includes('cont') || tipoPagamento.includes('cash')) tipoPagamento = 'contanti';
          else if (tipoPagamento.includes('asseg') || tipoPagamento.includes('check')) tipoPagamento = 'assegno';
          else tipoPagamento = '';
        }

        // Flag "Pagata": if TRUE and no tipoPagamento, default to contanti
        if (!tipoPagamento && colPagata) {
          const pagVal = String(row[colPagata] || '').trim().toLowerCase();
          if (pagVal === 'true' || pagVal === 'si' || pagVal === 'sì' || pagVal === '1' || pagVal === 'x' || pagVal === 'yes') {
            tipoPagamento = 'contanti';
          }
        }

        let scadenza = '';
        if (colScadenza && row[colScadenza]) {
          const rawScad = row[colScadenza];
          if (rawScad instanceof Date) {
            scadenza = rawScad.toISOString().slice(0, 10);
          } else if (typeof rawScad === 'number') {
            const dt = new Date((rawScad - 25569) * 86400 * 1000);
            scadenza = dt.toISOString().slice(0, 10);
          } else {
            const s = String(rawScad).trim();
            if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
              scadenza = s;
            } else {
              const parsed = parseFlexDate(s);
              if (parsed) {
                const parts = parsed.split('/');
                scadenza = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
              }
            }
          }
        }

        newData.push({
          dataArrivo,
          numero: colNumero ? String(row[colNumero] || '').trim() : '',
          azienda,
          importo: Math.abs(importo),
          tipoPagamento,
          scadenza,
          note: colNote ? String(row[colNote] || '').trim() : ''
        });
      });

      setImportMode('fatture');
      setParsedImportData(newData);

      if (newData.length === 0) {
        showToast(t('backup.noValidData'), 'warn');
        return;
      }

      showFattureImportPreview();
    } catch (err) {
      showToast(t('backup.fileError') + err.message, 'warn');
    }
  };
  reader.readAsArrayBuffer(file);
}

function showFattureImportPreview() {
  const preview = document.getElementById('import-preview');
  const summary = document.getElementById('import-summary');
  const total = parsedImportData.reduce((s, r) => s + r.importo, 0);

  let html = '<div style="overflow-x:auto;"><table class="edit-table" style="margin-bottom:8px;"><thead><tr>';
  html += '<th>' + t('excel.colDate') + '</th><th>' + t('fatt.fornitore') + '</th><th>' + t('fatt.numero') + '</th><th style="text-align:right;">' + t('excel.colAmount') + '</th></tr></thead><tbody>';

  const showRows = parsedImportData.slice(0, 8);
  showRows.forEach(r => {
    html += '<tr>';
    html += '<td style="padding:8px; font-size:13px;">' + escapeHtml(r.dataArrivo) + '</td>';
    html += '<td style="padding:8px; font-size:13px;">' + escapeHtml(r.azienda) + '</td>';
    html += '<td style="padding:8px; font-size:13px;">' + escapeHtml(r.numero) + '</td>';
    html += '<td style="padding:8px; font-size:13px; text-align:right; font-weight:600;">' + r.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  if (parsedImportData.length > 8) {
    html += '<div style="text-align:center; font-size:12px; color:var(--gray); margin-bottom:8px;">' + t('backup.moreItems', { n: parsedImportData.length - 8 }) + '</div>';
  }

  preview.innerHTML = html;

  summary.style.display = 'block';
  summary.innerHTML = '<div>' + t('backup.totalFatture', { n: parsedImportData.length }) + '</div>' +
    '<div style="font-size:13px; margin-top:4px; color:var(--text3);">' +
    t('excel.colAmount') + ': <span style="font-weight:600;">' + total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC</span></div>';

  document.getElementById('excel-overlay').classList.add('show');
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
  // Fetch all PDFs from IndexedDB and reattach to fatture copy for backup
  let pdfMap = new Map();
  try { pdfMap = await getAllPdfs(); } catch (e) { /* IDB unavailable */ }

  const fattureWithPdfs = (d.fatture || []).map(f => {
    if (f.hasPdf && pdfMap.has(f.id)) {
      return { ...f, pdf: pdfMap.get(f.id) };
    }
    return { ...f };
  });

  const backup = {
    _app: 'CassaSmartPro',
    _version: 6,
    _date: new Date().toISOString(),
    saldo: d.saldo,
    fornitori: d.fornitori,
    stipendi: d.stipendi,
    abit: d.abit,
    log: d.log,
    fatture: fattureWithPdfs,
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
  const lastTs = parseInt(localStorage.getItem('cassa_auto_backup_ts') || '0', 10);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - lastTs > sevenDays && d.log.length > 0) {
    setTimeout(() => triggerAutoBackupDownload(), 2000);
  }
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
      <button class="toggle-switch ${enabled ? 'on' : ''}" data-action="toggleAutoBackup"></button>
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
          // Store PDFs from backup into IndexedDB, strip from fatture
          const fatture = backup.fatture || [];
          for (const f of fatture) {
            const blob = f.pdf || f.foto;
            if (blob && f.id) {
              try { await storePdf(f.id, blob); } catch (e) { /* IDB error */ }
              f.hasPdf = true;
              delete f.pdf;
              delete f.foto;
            }
          }

          d.saldo = backup.saldo ?? 0;
          d.fornitori = backup.fornitori || [];
          d.stipendi = backup.stipendi || [];
          d.abit = backup.abit || [];
          d.log = backup.log || [];
          d.fatture = fatture;
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
