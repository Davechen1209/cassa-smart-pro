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

function generateDayImage(dateStr, dayLogs) {
  const DPR = 2;
  const W = 420;
  const PAD = 24;
  const INNER = W - PAD * 2;

  const saldoCum = calcSaldoAtDate(selectedDate);
  let total = 0;
  dayLogs.forEach(l => { total += l.a; });
  total = Math.round(total * 100) / 100;

  // Colors
  const BG = '#F2F2F7';
  const CARD = '#FFFFFF';
  const TEXT = '#1C1C1E';
  const TEXT2 = '#3A3A3C';
  const TEXT3 = '#636366';
  const GRAY = '#8E8E93';
  const GREEN = '#34C759';
  const RED = '#FF3B30';
  const BLUE = '#007AFF';
  const SEP = 'rgba(60,60,67,0.12)';
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';

  // Pre-calculate height
  const HEADER_H = 70;
  const ROW_H = 42;
  const SUMMARY_H = 130; // totale + saldo + totale cassa
  const FOOTER_H = 40;
  const H = PAD + HEADER_H + dayLogs.length * ROW_H + SUMMARY_H + FOOTER_H + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Card with rounded corners
  const cardX = 12, cardY = 12, cardW = W - 24, cardH = H - 24, cardR = 20;
  ctx.beginPath();
  ctx.moveTo(cardX + cardR, cardY);
  ctx.lineTo(cardX + cardW - cardR, cardY);
  ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + cardR);
  ctx.lineTo(cardX + cardW, cardY + cardH - cardR);
  ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - cardR, cardY + cardH);
  ctx.lineTo(cardX + cardR, cardY + cardH);
  ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - cardR);
  ctx.lineTo(cardX, cardY + cardR);
  ctx.quadraticCurveTo(cardX, cardY, cardX + cardR, cardY);
  ctx.closePath();
  ctx.fillStyle = CARD;
  ctx.fill();
  // Card shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.restore();

  let y = PAD + 8;

  // Header: "Latina Shopping"
  ctx.fillStyle = TEXT;
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText('Latina Shopping', PAD, y + 18);

  // Date
  ctx.fillStyle = GRAY;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText(dateStr, PAD, y + 38);

  y += HEADER_H;

  // Separator
  ctx.fillStyle = SEP;
  ctx.fillRect(PAD, y - 10, INNER, 1);

  // Transaction rows
  dayLogs.forEach(l => {
    const isIncome = l.a >= 0;
    const dotColor = isIncome ? GREEN : RED;
    const amtColor = isIncome ? GREEN : RED;
    const sign = isIncome ? '+' : '';
    const amtStr = sign + fmtEur(l.a) + '\u20AC';

    // Dot
    ctx.beginPath();
    ctx.arc(PAD + 5, y + 6, 5, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();

    // Amount (right-aligned, draw first to know width)
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = amtColor;
    const amtW = ctx.measureText(amtStr).width;
    ctx.fillText(amtStr, PAD + INNER - amtW, y + 10);

    // Name (truncate if too long)
    ctx.font = `500 13px ${FONT}`;
    ctx.fillStyle = TEXT2;
    const maxNameW = INNER - amtW - 30;
    let name = l.v;
    while (ctx.measureText(name).width > maxNameW && name.length > 3) {
      name = name.slice(0, -4) + '...';
    }
    ctx.fillText(name, PAD + 18, y + 10);

    y += ROW_H;
  });

  // Separator before totals
  y += 4;
  ctx.fillStyle = SEP;
  ctx.fillRect(PAD, y, INNER, 1.5);
  y += 16;

  // Totale giorno
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(t('day.total'), PAD, y + 2);
  const totalStr = (total >= 0 ? '+' : '') + fmtEur(total) + '\u20AC';
  ctx.fillStyle = total >= 0 ? GREEN : RED;
  const totalW = ctx.measureText(totalStr).width;
  ctx.fillText(totalStr, PAD + INNER - totalW, y + 2);

  y += 30;

  // Saldo fine giornata
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = TEXT3;
  ctx.fillText(t('day.endBalance'), PAD, y + 2);
  const saldoStr = '\u20AC ' + fmtEur(saldoCum);
  ctx.font = `800 17px ${FONT}`;
  ctx.fillStyle = saldoCum >= 0 ? BLUE : RED;
  const saldoW = ctx.measureText(saldoStr).width;
  ctx.fillText(saldoStr, PAD + INNER - saldoW, y + 2);

  y += 30;

  // Totale cassa
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = TEXT3;
  ctx.fillText(t('day.totalCash'), PAD, y + 2);
  const cassaStr = '\u20AC ' + fmtEur(d.saldo);
  ctx.font = `800 17px ${FONT}`;
  ctx.fillStyle = d.saldo >= 0 ? BLUE : RED;
  const cassaW = ctx.measureText(cassaStr).width;
  ctx.fillText(cassaStr, PAD + INNER - cassaW, y + 2);

  y += 34;

  // Footer separator
  ctx.fillStyle = SEP;
  ctx.fillRect(PAD, y, INNER, 1);
  y += 16;

  // Footer branding
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = GRAY;
  ctx.fillText('Cassa Smart Pro', PAD, y + 2);

  return new Promise(resolve => {
    canvas.toBlob(resolve, 'image/png');
  });
}

export async function shareDay() {
  const dateStr = selectedDate.toLocaleDateString('it-IT');
  const dayLogs = d.log.filter(l => l.d === dateStr);
  if (dayLogs.length === 0) return;

  const blob = await generateDayImage(dateStr, dayLogs);
  const file = new File([blob], 'cassa-' + dateStr.replace(/\//g, '-') + '.png', { type: 'image/png' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: t('day.shareTitle') + dateStr }).catch(() => {});
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('day.downloaded'), 'check');
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
    document.getElementById('settings-panel').classList.remove('open');
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
