// ─── UI Engine ───

import {
  d, fullSave, selectedDate, editingDay,
  setEditingDay
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { formatDateDisplay, toISODate, parseDateIT, calcSaldoAtDate } from './date-utils.js';
import { renderPendingList } from './expense.js';
import { renderPendingDeposits } from './deposit.js';
import { renderRubriche } from './rubrica.js';
import { Store as HkStore } from './fatture-app/hk-store.js';
import { t, getLang, translateLogDesc, parseIncasso, isDeposito, parseDeposito } from './i18n.js';
import { parseImportoOrNull } from './money.js';
import { renderReport } from './report.js';
import { FattureApp } from './fatture-app/hk-app.js';
import { fornitoriUnificati } from './fatture-bridge.js';
import { provaChiave } from './voice-assistant.js';

export function updateDateDisplay() {
  document.getElementById('date-display-text').textContent = formatDateDisplay(selectedDate);
  document.getElementById('date-input-hidden').value = toISODate(selectedDate);
  const badge = document.getElementById('date-badge');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sel = new Date(selectedDate); sel.setHours(0, 0, 0, 0);
  badge.className = 'date-badge';
  if (sel < today) { badge.classList.add('past'); badge.textContent = t('date.past'); }
  else if (sel > today) { badge.classList.add('future'); badge.textContent = t('date.future'); }
  else { badge.classList.add('today'); }
  renderDaySummary();
}

export function renderDaySummary() {
  const el = document.getElementById('day-summary');
  const formEl = document.getElementById('registration-form');
  const dateStr = selectedDate.toLocaleDateString('it-IT');
  const dayLogs = d.log.filter(l => l.d === dateStr);
  const saldoCum = calcSaldoAtDate(selectedDate);
  const hasPastData = d.log.some(l => parseDateIT(l.d) <= selectedDate);

  if (dayLogs.length === 0) {
    formEl.style.display = 'block';
    setEditingDay(false);
    if (hasPastData) {
      el.style.display = 'block';
      el.innerHTML = `
        <div class="day-summary-card">
          <div class="day-summary-title">${t('day.noMovement') + escapeHtml(dateStr)}</div>
          <div class="day-summary-saldo">
            <span>${t('day.endBalance')}</span>
            <span style="font-weight:800; font-size:17px; color:${saldoCum >= 0 ? 'var(--blue)' : 'var(--red)'}">
              \u20AC ${saldoCum.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      `;
    } else {
      el.style.display = 'none';
    }
    return;
  }

  if (!editingDay) {
    formEl.style.display = 'none';
  }
  el.style.display = 'block';

  let total = 0;
  let rows = '';

  dayLogs.forEach((l) => {
    const isIncome = l.a >= 0;
    // Il deposito toglie contanti come un'uscita, ma non e' una spesa: si
    // legge subito che quei soldi sono in banca, non spesi.
    const deposito = isDeposito(l);
    const segno = isIncome ? 'income' : (deposito ? 'deposit' : 'expense');
    const tinta = isIncome ? 'positive' : (deposito ? 'deposit' : 'negative');
    total += l.a;
    const realIndex = d.log.indexOf(l);
    rows += `
      <div class="day-summary-row">
        <div class="day-summary-dot ${segno}"></div>
        <div class="day-summary-name">${escapeHtml(translateLogDesc(l.v))}</div>
        <div class="day-summary-amount ${tinta}">
          ${isIncome ? '+' : ''}${l.a.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC
        </div>
        ${editingDay ? `
          <button class="history-delete" data-action="deleteDayLog" data-index="${realIndex}" style="opacity:0.7;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        ` : ''}
      </div>
    `;
  });

  const editBtn = editingDay
    ? `<button class="btn-sm gray" data-action="stopEditDay" style="width:100%; margin-top:12px; text-align:center;">
        ${t('day.closeEdit')}
       </button>`
    : `<button class="btn-sm blue" data-action="startEditDay" style="width:100%; margin-top:12px; text-align:center;">
        <span style="display:flex; align-items:center; justify-content:center; gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          ${t('day.editDay')}
        </span>
       </button>`;

  const shareBtn = `<button class="btn-sm gray" data-action="shareDay" style="width:100%; margin-top:8px; text-align:center;">
    <span style="display:flex; align-items:center; justify-content:center; gap:6px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      ${t('day.share')}
    </span>
  </button>`;

  el.innerHTML = `
    <div class="day-summary-card">
      <div class="day-summary-title">${t('day.registeredOn') + escapeHtml(dateStr)}</div>
      ${rows}
      <div class="day-summary-total">
        <span>${t('day.total')}</span>
        <span style="color: ${total >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${total >= 0 ? '+' : ''}${total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC
        </span>
      </div>
      <div class="day-summary-saldo">
        <span>${t('day.endBalance')}</span>
        <span style="font-weight:800; font-size:17px; color:${saldoCum >= 0 ? 'var(--blue)' : 'var(--red)'}">
          \u20AC ${saldoCum.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      ${editBtn}
      ${shareBtn}
    </div>
  `;
}

function fmtEur(n) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── Il testo che si manda ai soci ───
   Ricalca la tabella che i soci rileggono ogni giorno, riga per riga: data,
   totale battuto, POS, contanti, saldo di ieri, le uscite e quanto resta.
   Niente altro, e i conti si verificano a vista:
     saldo di ieri + contanti - uscite = rimasto totale. */

/* I soci leggono i numeri come li scrivono sul loro foglio: punto decimale,
   due cifre, nessun separatore delle migliaia. In italiano restano invece
   nella forma di casa (1.234,56). */
function fmtShareNum(n) {
  return getLang() === 'zh' ? n.toFixed(2) : fmtEur(n);
}

function fmtShareDate(date) {
  if (getLang() === 'zh') return (date.getMonth() + 1) + ' \u6708 ' + date.getDate() + ' \u65E5';
  return date.toLocaleDateString('it-IT');
}

function generateDayText(dayLogs) {
  const saldoCum = calcSaldoAtDate(selectedDate);
  const yesterday = new Date(selectedDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const saldoYesterday = calcSaldoAtDate(yesterday);

  const incassi = dayLogs.filter(l => l.a >= 0);
  const negativi = dayLogs.filter(l => l.a < 0);
  const uscite = negativi.filter(l => !isDeposito(l));
  const depositi = negativi.filter(l => isDeposito(l));

  // Totale battuto e POS stanno dentro la descrizione dell'incasso
  // ("Incasso Contanti (TOTALE:4680.47 POS:2649.39)"); il contante e'
  // l'importo stesso della riga.
  let totZ = 0, totPos = 0, totCash = 0;
  incassi.forEach(l => {
    const desc = translateLogDesc(l.v);
    const zMatch = desc.match(/(?:Z|TOTALE|总计):([\d.,]+)/);
    const posMatch = desc.match(/POS:([\d.,]+)/);
    if (zMatch && posMatch) {
      totZ += parseFloat(zMatch[1].replace(',', '.'));
      totPos += parseFloat(posMatch[1].replace(',', '.'));
    } else {
      // Entrata senza distinzione fra carta e contante: tutta contante,
      // cosi' totale = POS + contanti torna comunque.
      totZ += l.a;
    }
    totCash += l.a;
  });
  const r2 = (n) => Math.round(n * 100) / 100;

  const lines = [];
  lines.push(fmtShareDate(selectedDate));
  lines.push(t('day.shareTotale') + ' ' + fmtShareNum(r2(totZ)));
  lines.push(t('day.sharePos') + ' ' + fmtShareNum(r2(totPos)));
  lines.push(t('day.shareTotalCash') + ' ' + fmtShareNum(r2(totCash)));
  lines.push(t('day.yesterdayBalance') + ' ' + fmtShareNum(saldoYesterday));

  // Le uscite: la prima accanto all'etichetta, come sul foglio, le altre
  // sotto. In una giornata senza uscite resta l'etichetta da sola, che sul
  // foglio c'e' lo stesso.
  const voce = (l, etichetta) => {
    let desc = translateLogDesc(l.v);
    // Il registro segna i versamenti con la stessa parola dell'etichetta:
    // ripeterla ("银行存款 - 1500.00  银行存款") non aggiunge nulla.
    if (etichetta && desc.indexOf(etichetta) === 0) desc = desc.slice(etichetta.length).trim();
    return '- ' + fmtShareNum(Math.abs(l.a)) + (desc ? '  ' + desc : '');
  };
  if (uscite.length === 0) {
    lines.push(t('day.shareUscite'));
  } else {
    lines.push(t('day.shareUscite') + ' ' + voce(uscite[0]));
    uscite.slice(1).forEach(l => lines.push(voce(l)));
  }

  // I versamenti in banca non sono spese, ma i contanti li tolgono dal
  // cassetto lo stesso: senza questa riga il conto in fondo non tornerebbe.
  // Compare solo nei giorni in cui ce ne sono.
  if (depositi.length > 0) {
    const etDep = t('day.shareDepositi');
    lines.push(etDep + ' ' + voce(depositi[0], etDep));
    depositi.slice(1).forEach(l => lines.push(voce(l, etDep)));
  }

  lines.push('');
  lines.push(t('day.shareRemainingTotal') + ' ' + fmtShareNum(saldoCum));

  return lines.join('\n');
}

let pendingShareText = '';

export function shareDay() {
  const dateStr = selectedDate.toLocaleDateString('it-IT');
  const dayLogs = d.log.filter(l => l.d === dateStr);
  if (dayLogs.length === 0) return;

  pendingShareText = generateDayText(dayLogs);
  document.getElementById('share-preview-text').textContent = pendingShareText;
  document.getElementById('share-preview-overlay').classList.add('show');
}

export function closeSharePreview() {
  document.getElementById('share-preview-overlay').classList.remove('show');
  pendingShareText = '';
}

export function closeSharePreviewOutside(e) {
  if (e.target === document.getElementById('share-preview-overlay')) closeSharePreview();
}

export async function copyShareText() {
  try {
    await navigator.clipboard.writeText(pendingShareText);
    showToast(t('day.copied'), 'check');
  } catch { /* ignore */ }
  closeSharePreview();
}

export async function confirmShare() {
  if (navigator.share) {
    navigator.share({ text: pendingShareText }).catch(() => {});
  } else {
    await copyShareText();
    return;
  }
  closeSharePreview();
}

export function startEditDay() {
  setEditingDay(true);
  document.getElementById('registration-form').style.display = 'block';
  renderDaySummary();
}

export function stopEditDay() {
  setEditingDay(false);
  document.getElementById('registration-form').style.display = 'none';
  renderDaySummary();
}

export function deleteDayLog(index) {
  const entry = d.log[index];
  showConfirm(t('day.deleteTitle'), t('day.deleteMsg', { name: escapeHtml(translateLogDesc(entry.v)) }), () => {
    d.saldo -= entry.a;
    d.log.splice(index, 1);
    fullSave();
    ui();
    showToast(t('day.deleted'), 'trash');
  });
}

export function renderHistory() {
  const el = document.getElementById('history');
  if (d.log.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">\uD83D\uDCCB</div><div class="empty-state-text">' + t('history.empty') + '</div></div>';
    return;
  }

  const searchInput = document.getElementById('history-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = [];
  for (let i = d.log.length - 1; i >= 0; i--) {
    const l = d.log[i];
    if (query && !translateLogDesc(l.v).toLowerCase().includes(query) && !l.d.includes(query)) continue;
    filtered.push({ entry: l, origIndex: i });
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">\uD83D\uDD0D</div><div class="empty-state-text">' + t('history.noResults') + '</div></div>';
    return;
  }

  // Le righe vanno raggruppate prima di scriverle: l'intestazione del giorno
  // porta il saldo della giornata, e per farlo deve conoscere le righe che
  // stanno sotto di lei.
  const giorni = [];
  filtered.forEach(riga => {
    const ultimo = giorni[giorni.length - 1];
    if (ultimo && ultimo.data === riga.entry.d) ultimo.righe.push(riga);
    else giorni.push({ data: riga.entry.d, righe: [riga] });
  });

  const euro = n => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC';

  let html = '';
  giorni.forEach(({ data, righe }) => {
    const totale = righe.reduce((s, r) => s + r.entry.a, 0);
    html += `<div class="history-date-header">
        <span>${escapeHtml(data)}</span>
        <span class="history-day-total ${totale >= 0 ? 'positive' : 'negative'}">${totale >= 0 ? '+' : ''}${euro(totale)}</span>
      </div>`;

    righe.forEach(({ entry: l, origIndex }) => {
      const isIncome = l.a >= 0;
      const deposito = isDeposito(l);
      const desc = translateLogDesc(l.v);
      // "Incasso Contanti (TOTALE:850 POS:210)" e' come lo scrive la macchina:
      // andava a capo su tre righe e si leggeva come una riga di log. Il nome
      // resta corto, il dettaglio scende sotto in piccolo.
      const inc = parseIncasso(desc);
      // Stesso trattamento per il deposito: il nome resta corto e la nota
      // ("versamento del mattino") scende sotto invece di essere troncata.
      const dep = deposito ? parseDeposito(desc) : null;
      const nome = inc ? t('fatt.incassoCash') : (dep ? t('dep.log') : desc);
      const dettaglio = inc
        ? `${t('excel.colTotal')} ${euro(inc.totale)} \u00B7 POS ${euro(inc.pos)}`
        : (dep && dep.nota ? dep.nota : '');
      html += `
      <div class="history-item">
        <div class="history-icon ${isIncome ? 'income' : (deposito ? 'deposit' : 'expense')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${deposito && !isIncome
              ? '<path d="M3 10h18L12 3 3 10Z"/><path d="M5 10v8m5-8v8m4-8v8m5-8v8"/><path d="M3 21h18"/>'
              : (isIncome ? '<path d="M12 19V5m0 0-7 7m7-7 7 7"/>' : '<path d="M12 5v14m0 0 7-7m-7 7-7-7"/>')}
          </svg>
        </div>
        <div class="history-info">
          <div class="history-name">${escapeHtml(nome)}</div>
          ${dettaglio ? `<div class="history-date">${escapeHtml(dettaglio)}</div>` : ''}
        </div>
        <div class="history-amount ${isIncome ? 'positive' : (deposito ? 'deposit' : 'negative')}">
          ${isIncome ? '+' : ''}${euro(l.a)}
        </div>
        <button class="history-delete" data-action="deleteLog" data-index="${origIndex}" data-name="${escapeHtml(nome)}" aria-label="${escapeHtml(t('history.deleteTitle'))}: ${escapeHtml(nome)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;
    });
  });
  el.innerHTML = html;
}

export function deleteLog(index, name) {
  showConfirm(t('history.deleteTitle'), t('history.deleteMsg', { name }), () => {
    const amount = d.log[index].a;
    d.saldo -= amount;
    d.log.splice(index, 1);
    fullSave();
    ui();
    showToast(t('history.deleted'), 'trash');
  });
}

export function tab(n) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('s' + n).classList.add('active');
  // L'app fatture e' fatta di tabelle larghe: le altre tab restano nella
  // colonna da 500px, lei prende tutto lo spazio che c'e'.
  document.body.classList.toggle('tab-fatture', n === 5);
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.tab) === n));
  ui();
}

export function toggleSettings() {
  const open = document.getElementById('settings-page').classList.toggle('open');
  // I pulsanti flottanti (microfono, "+ Nuovo arrivo" delle fatture) vivono
  // sopra tutto: senza questo restavano appesi davanti alle impostazioni.
  document.body.classList.toggle('settings-open', open);
  renderCustomCatsSettings();
  renderAziendaSettings();
  renderOcrApiSettings();
  renderGeminiApiSettings();
}

// ─── Dati Azienda Settings ───

export function renderAziendaSettings() {
  const nomeEl = document.getElementById('azienda-nome');
  const pivaEl = document.getElementById('azienda-piva');
  if (!nomeEl || !pivaEl) return;
  nomeEl.value = d.aziendaData?.nome || '';
  pivaEl.value = d.aziendaData?.piva || '';
}

export function saveAziendaData() {
  d.aziendaData = {
    nome: document.getElementById('azienda-nome').value.trim(),
    piva: document.getElementById('azienda-piva').value.trim()
  };
  fullSave();
  showToast(t('azienda.saved'), 'check');
}

// ─── OCR API Key Settings ───

export function renderOcrApiSettings() {
  const key = localStorage.getItem('cassa_openai_key');
  const configured = document.getElementById('ocr-configured');
  const setup = document.getElementById('ocr-setup');
  if (!configured || !setup) return;
  if (key) {
    configured.style.display = 'block';
    setup.style.display = 'none';
  } else {
    configured.style.display = 'none';
    setup.style.display = 'block';
  }
}

export function saveOcrKey() {
  const input = document.getElementById('ocr-api-key');
  const key = input.value.trim();
  if (!key) return;
  localStorage.setItem('cassa_openai_key', key);
  input.value = '';
  renderOcrApiSettings();
  showToast(t('ocr.configured'), 'check');
}

export function removeOcrKey() {
  localStorage.removeItem('cassa_openai_key');
  renderOcrApiSettings();
}

// ─── Gemini API Key Settings (contabile vocale gratis) ───

export function renderGeminiApiSettings() {
  const key = localStorage.getItem('cassa_gemini_key');
  const configured = document.getElementById('gemini-configured');
  const setup = document.getElementById('gemini-setup');
  if (!configured || !setup) return;
  if (key) {
    configured.style.display = 'block';
    setup.style.display = 'none';
  } else {
    configured.style.display = 'none';
    setup.style.display = 'block';
  }
}

export function saveGeminiKey() {
  const input = document.getElementById('gemini-api-key');
  const key = input.value.trim();
  if (!key) return;
  localStorage.setItem('cassa_gemini_key', key);
  input.value = '';
  renderGeminiApiSettings();
  showToast(t('ocr.configured'), 'check');
}

export function removeGeminiKey() {
  localStorage.removeItem('cassa_gemini_key');
  renderGeminiApiSettings();
}

/* Chiede a Google se la chiave funziona davvero, e scrive l'esito qui sotto
   invece che in un avviso che sparisce: quando qualcosa non va, questa riga
   e' quella da leggere (e da riferire). */
export async function provaGeminiKey() {
  const out = document.getElementById('gemini-test-result');
  const btn = document.querySelector('[data-action="provaGeminiKey"]');
  if (out) {
    out.style.display = 'block';
    out.style.color = '';
    out.textContent = t('gemini.testing');
  }
  if (btn) btn.disabled = true;
  const esito = await provaChiave();
  if (btn) btn.disabled = false;
  if (!out) return;
  if (esito.ok) {
    out.style.color = 'var(--green)';
    out.textContent = t('gemini.testOk', { m: esito.modello });
  } else {
    out.style.color = 'var(--red)';
    out.textContent = esito.messaggio + (esito.dettaglio ? ' — ' + esito.dettaglio : '');
  }
}

export function manualSaldo() {
  const n = parseImportoOrNull(document.getElementById('set-saldo').value);
  if (n !== null) {
    d.saldo = n;
    fullSave();
    ui();
    document.getElementById('set-saldo').value = '';
    document.getElementById('settings-page').classList.remove('open');
    document.body.classList.remove('settings-open');
    showToast(t('saldo.updated'), 'check');
  }
}

export function confirmReset() {
  showConfirm(t('settings.resetTitle'), t('settings.resetMsg'), () => {
    showConfirm(t('settings.resetConfirm2'), t('settings.resetMsg2'), () => {
      d.saldo = 0;
      d.fornitori = [];
      d.stipendi = [];
      d.abit = [];
      d.log = [];
      d.anticipi = [];
      fullSave();
      ui();
      showToast(t('settings.resetDone'), 'check');
    });
  });
}

export function ui() {
  const formatted = d.saldo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('main-saldo').textContent = '\u20AC ' + formatted;

  const trendText = document.getElementById('trend-text');
  const trendEl = document.getElementById('saldo-trend');
  if (d.log.length > 0) {
    const last = d.log[d.log.length - 1];
    const isPositive = last.a >= 0;
    trendEl.querySelector('svg').innerHTML = isPositive
      ? '<path d="M12 19V5m0 0-7 7m7-7 7 7"/>'
      : '<path d="M12 5v14m0 0 7-7m-7 7-7-7"/>';
    trendText.textContent = (isPositive ? '+' : '') + last.a.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC';
  } else {
    trendText.textContent = '--';
  }

  renderPendingList();
  renderPendingDeposits();
  renderRubriche();
  renderHistory();
  renderDaySummary();
  renderDashboard();

  // Il Report ricalcola su tutto lo storico: si rigenera solo quando la sua
  // tab e' davvero a schermo, non a ogni salvataggio.
  if (document.getElementById('s4')?.classList.contains('active')) renderReport();

  // L'app fatture ha un suo ciclo di render: si disegna quando la sua tab e' a schermo.
  if (document.getElementById('s5')?.classList.contains('active')) {
    // I suggerimenti del fornitore includono anche chi sta solo in rubrica.
    FattureApp.setFornitoriEsterni(fornitoriUnificati());
    FattureApp.render();
  }
}

export function updateHeaderDate() {
  const now = new Date();
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const locale = getLang() === 'zh' ? 'zh-CN' : 'it-IT';
  const formatted = now.toLocaleDateString(locale, opts);
  document.getElementById('header-date').textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// ─── Dashboard ───

export function renderDashboard() {
  const container = document.getElementById('dashboard-content');
  if (!container || container.style.display === 'none') return;

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const curMonthKey = curYear + '-' + String(curMonth + 1).padStart(2, '0');

  // 1. Totale in cassa
  const saldo = d.saldo;

  // 2. e 4. Fatture: i dati non stanno piu' in d.fatture ma nell'archivio
  // dell'app fatture, che tiene anche i pagamenti parziali. Il residuo e' cio'
  // che conta qui, non l'importo pieno della fattura.
  const oggiISO = new Date().getFullYear() + '-' +
    String(new Date().getMonth() + 1).padStart(2, '0') + '-' +
    String(new Date().getDate()).padStart(2, '0');
  const daPagare = HkStore.records().filter(r => HkStore.computeStatus(r, oggiISO) !== 'paid');
  const residuo = r => HkStore.fromCents(HkStore.recCents(r).unpaid);

  const fattureMese = daPagare.filter(r => (r.dueDate || '').slice(0, 7) === curMonthKey);
  const fattureTotal = fattureMese.reduce((s, r) => s + residuo(r), 0);

  const fattureScadute = daPagare.filter(r => HkStore.computeStatus(r, oggiISO) === 'overdue');
  const scaduteTotal = fattureScadute.reduce((s, r) => s + residuo(r), 0);

  // 3. Spese del mese
  let speseExtra = 0;
  d.log.forEach(l => {
    if (!l.d || l.a >= 0) return;
    // Un deposito non e' una spesa del mese: sposta i contanti, non li consuma.
    if (isDeposito(l)) return;
    const parts = l.d.split('/');
    if (parts.length === 3) {
      const lm = parts[2] + '-' + parts[1];
      if (lm === curMonthKey) speseExtra += Math.abs(l.a);
    }
  });

  const fmt = n => '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rowStyle = 'display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(255,255,255,0.15); border-radius:10px; backdrop-filter:blur(4px);';
  const labelStyle = 'font-size:12px; font-weight:600; color:rgba(255,255,255,0.85); letter-spacing:0.3px;';
  const valStyle = 'font-size:15px; font-weight:800; color:#fff;';
  const subStyle = 'font-size:11px; color:rgba(255,255,255,0.6); margin-top:1px;';
  const warnDot = fattureScadute.length > 0 ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff4444;margin-right:6px;"></span>' : '';

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="${rowStyle}">
        <div>
          <div style="${labelStyle}">${t('dash.fattureMese')}</div>
          <div style="${subStyle}">${fattureMese.length} ${t('dash.invoices')}</div>
        </div>
        <div style="${valStyle}">${fmt(fattureTotal)}</div>
      </div>
      <div style="${rowStyle}">
        <div>
          <div style="${labelStyle}">${warnDot}${t('dash.fattureScadute')}</div>
          <div style="${subStyle}">${fattureScadute.length} ${t('dash.invoices')}</div>
        </div>
        <div style="${valStyle} ${fattureScadute.length > 0 ? 'color:#ff6b6b;' : ''}">${fmt(scaduteTotal)}</div>
      </div>
      <div style="${rowStyle}">
        <div style="${labelStyle}">${t('dash.speseExtra')}</div>
        <div style="${valStyle}">${fmt(speseExtra)}</div>
      </div>
    </div>`;
}

export function toggleDashboard() {
  const content = document.getElementById('dashboard-content');
  const chevron = document.getElementById('dashboard-chevron');
  if (!content) return;
  const open = content.style.display !== 'none';
  content.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
  if (!open) renderDashboard();
}

// ─── Custom Categories Settings ───

export function renderCustomCatsSettings() {
  const el = document.getElementById('custom-cats-list');
  if (!el) return;
  if ((d.customCats || []).length === 0) {
    el.innerHTML = '<div class="pending-empty">' + t('customCats.empty') + '</div>';
    return;
  }
  el.innerHTML = d.customCats.map((cc, i) => `
    <div class="custom-cat-row">
      <span class="custom-cat-emoji">${cc.emoji || ''}</span>
      <span class="custom-cat-name">${escapeHtml(cc.name)}</span>
      <button class="history-delete" data-action="removeCustomCat" data-index="${i}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px;"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
}

export function addCustomCat() {
  const emoji = document.getElementById('new-cat-emoji').value.trim();
  const name = document.getElementById('new-cat-name').value.trim();
  if (!name) { showToast(t('customCats.enterName'), 'warn'); return; }
  if (!d.customCats) d.customCats = [];
  d.customCats.push({ name, emoji });
  document.getElementById('new-cat-emoji').value = '';
  document.getElementById('new-cat-name').value = '';
  fullSave();
  renderCustomCatsSettings();
  showToast(t('customCats.added', { name }), 'check');
}

export function removeCustomCat(index) {
  d.customCats.splice(index, 1);
  fullSave();
  renderCustomCatsSettings();
}
