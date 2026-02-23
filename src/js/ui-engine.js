// ─── UI Engine ───

import {
  d, fullSave, selectedDate, editingDay,
  setEditingDay
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { formatDateDisplay, toISODate, parseDateIT, calcSaldoAtDate } from './date-utils.js';
import { renderPendingList } from './expense.js';
import { renderRubriche } from './rubrica.js';
import { renderFatture } from './fatture.js';
import { renderAnticipi } from './anticipi.js';
import { t, getLang } from './i18n.js';

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
        <div class="day-summary-name">${escapeHtml(l.v)}</div>
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
  if (incassi.length > 0) {
    lines.push('\u2501\u2501 ' + t('day.shareIncassi') + ' \u2501\u2501');
    incassi.forEach(l => {
      // Parse Z and POS from description like "Incasso Cash (Z:1500 POS:300)"
      const zMatch = l.v.match(/Z:([\d.,]+)/);
      const posMatch = l.v.match(/POS:([\d.,]+)/);
      if (zMatch && posMatch) {
        const z = parseFloat(zMatch[1].replace(',', '.'));
        const pos = parseFloat(posMatch[1].replace(',', '.'));
        const name = l.v.replace(/\s*\(Z:.*\)/, '').trim();
        lines.push(name);
        lines.push('  Z: ' + fmtEur(z) + '\u20AC - POS: ' + fmtEur(pos) + '\u20AC = ' + fmtEur(l.a) + '\u20AC');
      } else {
        lines.push('+ ' + fmtEur(l.a) + '\u20AC  ' + l.v);
      }
    });
    lines.push('');
  }

  // ━━ Uscite ━━
  if (uscite.length > 0) {
    lines.push('\u2501\u2501 ' + t('day.shareUscite') + ' \u2501\u2501');
    uscite.forEach(l => {
      lines.push('- ' + fmtEur(Math.abs(l.a)) + '\u20AC  ' + l.v);
    });
    lines.push('');
  }

  // ━━━━━━━━━━━━━
  lines.push('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
  const rimasto = Math.round((totalIncassi + totalUscite) * 100) / 100;
  lines.push(t('day.shareRemaining') + ': ' + (rimasto >= 0 ? '+' : '') + fmtEur(rimasto) + '\u20AC');
  lines.push(t('day.endBalance') + ': \u20AC' + fmtEur(saldoCum));
  lines.push(t('day.totalCash') + ': \u20AC' + fmtEur(d.saldo));

  return lines.join('\n');
}

export async function shareDay() {
  const dateStr = selectedDate.toLocaleDateString('it-IT');
  const dayLogs = d.log.filter(l => l.d === dateStr);
  if (dayLogs.length === 0) return;

  const text = generateDayText(dateStr, dayLogs);

  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('day.copied'), 'check');
    } catch {
      showToast(t('day.copied'), 'check');
    }
  }
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
  showConfirm(t('day.deleteTitle'), t('day.deleteMsg', { name: escapeHtml(entry.v) }), () => {
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

  const reversed = d.log.slice().reverse();
  let html = '';
  let lastDate = '';

  reversed.forEach((l, ri) => {
    const origIndex = d.log.length - 1 - ri;
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
          <div class="history-name">${escapeHtml(l.v)}</div>
          <div class="history-date">${escapeHtml(l.d)}</div>
        </div>
        <div class="history-amount ${isIncome ? 'positive' : 'negative'}">
          ${isIncome ? '+' : ''}${l.a.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC
        </div>
        <button class="history-delete" data-action="deleteLog" data-index="${origIndex}" data-name="${escapeHtml(l.v)}">
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
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i + 1 === n));
  ui();
}

export function toggleSettings() {
  document.getElementById('settings-page').classList.toggle('open');
  updateOcrStatus();
}

// ─── OCR Settings ───

export function updateOcrStatus() {
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
  updateOcrStatus();
  showToast(t('ocr.configured'), 'check');
}

export function removeOcrKey() {
  localStorage.removeItem('cassa_openai_key');
  updateOcrStatus();
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
  renderAnticipi();
}

export function updateHeaderDate() {
  const now = new Date();
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const locale = getLang() === 'zh' ? 'zh-CN' : 'it-IT';
  const formatted = now.toLocaleDateString(locale, opts);
  document.getElementById('header-date').textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
