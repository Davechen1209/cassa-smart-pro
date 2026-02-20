// ─── Expense Sheet ───

import {
  d, pendingExpenses, expCat, expSelectedVoice,
  setExpCat, setExpSelectedVoice,
  setModalCat, setEditingItem
} from './state.js';
import { showToast, escapeHtml } from './modals.js';
import { t } from './i18n.js';
import { getOpenAnticipiForName } from './anticipi.js';

export function openExpenseSheet() {
  setExpCat('fornitori');
  setExpSelectedVoice(null);
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-free-name').value = '';
  document.getElementById('exp-note').value = '';
  document.getElementById('exp-fattura-num').value = '';
  updateExpSegments();
  renderExpVoices();
  document.getElementById('expense-overlay').classList.add('show');
  setTimeout(() => document.getElementById('exp-amount').focus(), 350);
}

export function openExpenseAnticipo() {
  openExpenseSheet();
  switchExpCat('anticipo');
}

export function closeExpenseSheet() {
  document.getElementById('expense-overlay').classList.remove('show');
  setExpSelectedVoice(null);
}

export function closeExpenseOutside(e) {
  if (e.target === document.getElementById('expense-overlay')) closeExpenseSheet();
}

export function setQuickAmount(val) {
  document.getElementById('exp-amount').value = val;
}

export function customAmount() {
  const el = document.getElementById('exp-amount');
  el.value = '';
  el.focus();
}

export function switchExpCat(cat) {
  setExpCat(cat);
  setExpSelectedVoice(null);
  updateExpSegments();
  renderExpVoices();
}

export function updateExpSegments() {
  const btns = document.querySelectorAll('#exp-segments .segment-btn');
  const cats = ['fornitori', 'stipendi', 'abit', 'anticipo', 'libera'];
  btns.forEach((btn, i) => btn.classList.toggle('active', cats[i] === expCat));

  const voicesSection = document.getElementById('exp-voices-section');
  const freeWrap = document.getElementById('free-name-wrap');

  document.getElementById('exp-fattura-wrap').style.display = expCat === 'fornitori' ? 'block' : 'none';

  if (expCat === 'libera') {
    voicesSection.style.display = 'none';
    freeWrap.classList.add('open');
    setTimeout(() => document.getElementById('exp-free-name').focus(), 100);
  } else if (expCat === 'anticipo') {
    voicesSection.style.display = 'block';
    freeWrap.classList.add('open');
    document.getElementById('exp-free-name').placeholder = t('ant.freeNamePlaceholder');
  } else {
    voicesSection.style.display = 'block';
    freeWrap.classList.remove('open');
  }
}

export function renderExpVoices() {
  if (expCat === 'libera') return;

  const list = expCat === 'anticipo' ? (d.stipendi || []) : (d[expCat] || []);
  const container = document.getElementById('exp-voices');

  container.innerHTML = list.map(n => {
    const sel = expSelectedVoice === n ? ' selected' : '';
    return `<button class="voice-chip${sel}" data-action="selectExpVoice" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`;
  }).join('') +
  `<button class="voice-chip new-voice" data-action="addNewVoiceFromSheet">${t('exp.newVoice')}</button>`;
}

export function selectExpVoice(name) {
  setExpSelectedVoice(expSelectedVoice === name ? null : name);
  renderExpVoices();

  // Show anticipi warning for stipendi
  const warnEl = document.getElementById('exp-anticipi-warn');
  if (warnEl) warnEl.remove();
  if (expCat === 'stipendi' && expSelectedVoice) {
    const openAnts = getOpenAnticipiForName(expSelectedVoice);
    if (openAnts.length > 0) {
      const total = openAnts.reduce((s, a) => s + a.importo, 0);
      const warn = document.createElement('div');
      warn.id = 'exp-anticipi-warn';
      warn.className = 'anticipi-warn';
      warn.textContent = t('ant.hasOpen', {
        name: expSelectedVoice,
        amount: total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      });
      document.getElementById('exp-voices-section').appendChild(warn);
    }
  }
}

export function addNewVoiceFromSheet() {
  setModalCat(expCat);
  setEditingItem(null);
  const labels = { fornitori: t('rub.newFornitore'), stipendi: t('rub.newStipendio'), abit: t('rub.newVoce') };
  document.getElementById('modal-title').textContent = labels[expCat] || '';
  document.getElementById('modal-input').value = '';
  document.getElementById('modal-overlay').classList.add('show');
  setTimeout(() => document.getElementById('modal-input').focus(), 350);
}

export function addExpense() {
  const amount = parseFloat(document.getElementById('exp-amount').value);
  if (!amount || amount <= 0) {
    showToast(t('exp.invalidAmount'), 'warn');
    return;
  }

  let name, type;

  if (expCat === 'libera') {
    name = document.getElementById('exp-free-name').value.trim() || t('exp.genericExpense');
    type = t('exp.expense');
  } else if (expCat === 'anticipo') {
    const freeName = document.getElementById('exp-free-name').value.trim();
    name = expSelectedVoice || freeName;
    if (!name) {
      showToast(t('ant.selectName'), 'warn');
      return;
    }
    type = t('ant.logAdvance');
  } else if (expSelectedVoice) {
    name = expSelectedVoice;
    type = expCat === 'fornitori' ? t('exp.fornitore') : (expCat === 'stipendi' ? t('exp.stipendio') : t('exp.expense'));
  } else {
    showToast(t('exp.selectOrFree'), 'warn');
    return;
  }

  const note = document.getElementById('exp-note').value.trim();
  const fatturaNum = expCat === 'fornitori' ? document.getElementById('exp-fattura-num').value.trim() : '';
  if (expCat === 'fornitori' && !fatturaNum) {
    showToast(t('exp.enterFattNum'), 'warn');
    document.getElementById('exp-fattura-num').focus();
    return;
  }
  pendingExpenses.push({ name, cat: expCat, type, amount, note, fatturaNum });
  closeExpenseSheet();
  renderPendingList();
  showToast(name + ' - ' + amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC' + t('exp.added'), 'check');
}

export function renderPendingList() {
  const el = document.getElementById('pending-list');

  if (pendingExpenses.length === 0) {
    el.innerHTML = '<div class="pending-empty">' + t('exp.noPending') + '</div>';
    return;
  }

  const total = pendingExpenses.reduce((s, e) => s + e.amount, 0);
  const iconLetters = { fornitori: 'F', stipendi: 'S', abit: 'A', anticipo: '$', libera: '?' };

  let html = '<div class="pending-list">';
  pendingExpenses.forEach((e, i) => {
    html += `
      <div class="pending-item">
        <div class="pending-icon ${e.cat}">${iconLetters[e.cat] || '?'}</div>
        <div class="pending-info">
          <div class="pending-name">${escapeHtml(e.name)}</div>
          <div class="pending-cat">${escapeHtml(e.type)}${e.fatturaNum ? ' \u00B7 ' + t('exp.fatt') + escapeHtml(e.fatturaNum) : ''}${e.note ? ' \u00B7 ' + escapeHtml(e.note) : ''}</div>
        </div>
        <div class="pending-amount">-${e.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC</div>
        <button class="pending-remove" data-action="removePending" data-index="${i}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;
  });
  html += `
    <div class="pending-total">
      <span>${t('exp.totalExpenses')}</span>
      <span class="pending-total-amount">-${total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC</span>
    </div>
  </div>`;
  el.innerHTML = html;
}

export function removePending(index) {
  const removed = pendingExpenses.splice(index, 1)[0];
  renderPendingList();
  showToast('"' + removed.name + '"' + t('exp.removed'), 'trash');
}
