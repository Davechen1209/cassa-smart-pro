// ─── UI Engine ───

import {
  d, fullSave, selectedDate, editingDay,
  setEditingDay
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { formatDateDisplay, toISODate, parseDateIT, calcSaldoAtDate } from './date-utils.js';
import { renderPendingList } from './expense.js';
import { renderRubriche } from './rubrica.js';
import { renderFatture, updateFattureTabBadge } from './fatture.js';
import { t, getLang, translateLogDesc } from './i18n.js';
import { renderReport } from './report.js';
import { FattureApp } from './fatture-app/hk-app.js';

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
    total += l.a;
    const realIndex = d.log.indexOf(l);
    rows += `
      <div class="day-summary-row">
        <div class="day-summary-dot ${isIncome ? 'income' : 'expense'}"></div>
        <div class="day-summary-name">${escapeHtml(translateLogDesc(l.v))}</div>
        <div class="day-summary-amount ${isIncome ? 'positive' : 'negative'}">
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

function generateDayText(dateStr, dayLogs) {
  const saldoCum = calcSaldoAtDate(selectedDate);
  const yesterday = new Date(selectedDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const saldoYesterday = calcSaldoAtDate(yesterday);
  const incassi = dayLogs.filter(l => l.a >= 0);
  const uscite = dayLogs.filter(l => l.a < 0);

  let totalIncassi = 0;
  let totalUscite = 0;
  incassi.forEach(l => { totalIncassi += l.a; });
  uscite.forEach(l => { totalUscite += l.a; });
  totalIncassi = Math.round(totalIncassi * 100) / 100;
  totalUscite = Math.round(totalUscite * 100) / 100;

  const lines = [];
  lines.push(t('day.shareTitle') + dateStr);
  lines.push('');

  // ━━ Incassi ━━
  let totalContanti = 0;
  if (incassi.length > 0) {
    lines.push('\u2501\u2501 ' + t('day.shareIncassi') + ' \u2501\u2501');
    incassi.forEach(l => {
      const desc = translateLogDesc(l.v);
      // Parse Z and POS from description like "Incasso Cash (TOTALE:1500 POS:300)"
      const zMatch = desc.match(/(?:Z|TOTALE|总计):([\d.,]+)/);
      const posMatch = desc.match(/POS:([\d.,]+)/);
      if (zMatch && posMatch) {
        const z = parseFloat(zMatch[1].replace(',', '.'));
        const pos = parseFloat(posMatch[1].replace(',', '.'));
        const name = desc.replace(/\s*\((?:Z|TOTALE|总计):.*\)/, '').trim();
        lines.push(name);
        lines.push('  ' + t('incassi.totaleLabel') + ': ' + fmtEur(z) + '\u20AC - POS: ' + fmtEur(pos) + '\u20AC = ' + fmtEur(l.a) + '\u20AC');
        totalContanti += (z - pos);
      } else {
        lines.push('+ ' + fmtEur(l.a) + '\u20AC  ' + desc);
        totalContanti += l.a;
      }
    });
    lines.push('');
  }

  // ━━ Uscite ━━
  if (uscite.length > 0) {
    lines.push('\u2501\u2501 ' + t('day.shareUscite') + ' \u2501\u2501');
    uscite.forEach(l => {
      lines.push('- ' + fmtEur(Math.abs(l.a)) + '\u20AC  ' + translateLogDesc(l.v));
    });
    lines.push('');
  }

  // ━━━━━━━━━━━━━
  lines.push('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
  totalContanti = Math.round(totalContanti * 100) / 100;
  lines.push(t('day.shareTotalCash') + ': ' + fmtEur(totalContanti) + '\u20AC');
  const rimasto = Math.round((totalIncassi + totalUscite) * 100) / 100;
  lines.push(t('day.shareRemaining') + ': ' + (rimasto >= 0 ? '+' : '') + fmtEur(rimasto) + '\u20AC');
  lines.push(t('day.endBalance') + ': \u20AC' + fmtEur(saldoCum));
  lines.push(t('day.yesterdayBalance') + ': \u20AC' + fmtEur(saldoYesterday));

  return lines.join('\n');
}

let pendingShareText = '';

export function shareDay() {
  const dateStr = selectedDate.toLocaleDateString('it-IT');
  const dayLogs = d.log.filter(l => l.d === dateStr);
  if (dayLogs.length === 0) return;

  pendingShareText = generateDayText(dateStr, dayLogs);
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

  let html = '';
  let lastDate = '';

  filtered.forEach(({ entry: l, origIndex }) => {
    if (l.d !== lastDate) {
      lastDate = l.d;
      html += `<div class="history-date-header">${escapeHtml(l.d)}</div>`;
    }
    const isIncome = l.a >= 0;
    html += `
      <div class="history-item">
        <div class="history-icon ${isIncome ? 'income' : 'expense'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            ${isIncome ? '<path d="M12 19V5m0 0-7 7m7-7 7 7"/>' : '<path d="M12 5v14m0 0 7-7m-7 7-7-7"/>'}
          </svg>
        </div>
        <div class="history-info">
          <div class="history-name">${escapeHtml(translateLogDesc(l.v))}</div>
          <div class="history-date">${escapeHtml(l.d)}</div>
        </div>
        <div class="history-amount ${isIncome ? 'positive' : 'negative'}">
          ${isIncome ? '+' : ''}${l.a.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC
        </div>
        <button class="history-delete" data-action="deleteLog" data-index="${origIndex}" data-name="${escapeHtml(translateLogDesc(l.v))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;
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
  document.getElementById('settings-page').classList.toggle('open');
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

export function manualSaldo() {
  const n = parseFloat(document.getElementById('set-saldo').value);
  if (!isNaN(n)) {
    d.saldo = n;
    fullSave();
    ui();
    document.getElementById('set-saldo').value = '';
    document.getElementById('settings-page').classList.remove('open');
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
      d.fatture = [];
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
  renderRubriche();
  renderHistory();
  renderDaySummary();
  renderFatture();
  updateFattureTabBadge();
  renderDashboard();

  // Il Report ricalcola su tutto lo storico: si rigenera solo quando la sua
  // tab e' davvero a schermo, non a ogni salvataggio.
  if (document.getElementById('s4')?.classList.contains('active')) renderReport();

  // L'app fatture ha un suo ciclo di render: si disegna quando la sua tab e' a schermo.
  if (document.getElementById('s5')?.classList.contains('active')) FattureApp.render();
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

  // 2. Fatture da pagare con scadenza questo mese
  const fattureMese = (d.fatture || []).filter(f => {
    if (f.pagata) return false;
    if (!f.scadenza) return false;
    const dt = new Date(f.scadenza);
    return dt.getMonth() === curMonth && dt.getFullYear() === curYear;
  });
  const fattureTotal = fattureMese.reduce((s, f) => s + (f.importo || 0), 0);

  // 3. Spese del mese (al di fuori delle fatture)
  let speseExtra = 0;
  d.log.forEach(l => {
    if (!l.d || l.a >= 0) return;
    const parts = l.d.split('/');
    if (parts.length === 3) {
      const lm = parts[2] + '-' + parts[1];
      if (lm === curMonthKey) speseExtra += Math.abs(l.a);
    }
  });

  // 4. Fatture scadute non saldate
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fattureScadute = (d.fatture || []).filter(f => {
    if (f.pagata) return false;
    if (!f.scadenza) return false;
    const dt = new Date(f.scadenza); dt.setHours(0, 0, 0, 0);
    return dt < today;
  });
  const scaduteTotal = fattureScadute.reduce((s, f) => s + (f.importo || 0), 0);

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
