// ─── Expense Sheet ───

import {
  d, pendingExpenses, expCat, expSelectedVoice,
  setExpCat, setExpSelectedVoice,
  setModalCat, setEditingItem
} from './state.js';
import { showToast, escapeHtml } from './modals.js';

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
  const cats = ['fornitori', 'stipendi', 'abit', 'libera'];
  btns.forEach((btn, i) => btn.classList.toggle('active', cats[i] === expCat));

  const voicesSection = document.getElementById('exp-voices-section');
  const freeWrap = document.getElementById('free-name-wrap');

  document.getElementById('exp-fattura-wrap').style.display = expCat === 'fornitori' ? 'block' : 'none';

  if (expCat === 'libera') {
    voicesSection.style.display = 'none';
    freeWrap.classList.add('open');
    setTimeout(() => document.getElementById('exp-free-name').focus(), 100);
  } else {
    voicesSection.style.display = 'block';
    freeWrap.classList.remove('open');
  }
}

export function renderExpVoices() {
  if (expCat === 'libera') return;

  const list = d[expCat] || [];
  const container = document.getElementById('exp-voices');

  container.innerHTML = list.map(n => {
    const sel = expSelectedVoice === n ? ' selected' : '';
    return `<button class="voice-chip${sel}" data-action="selectExpVoice" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`;
  }).join('') +
  `<button class="voice-chip new-voice" data-action="addNewVoiceFromSheet">+ Nuova</button>`;
}

export function selectExpVoice(name) {
  setExpSelectedVoice(expSelectedVoice === name ? null : name);
  renderExpVoices();
}

export function addNewVoiceFromSheet() {
  setModalCat(expCat);
  setEditingItem(null);
  const labels = { fornitori: 'Fornitore', stipendi: 'Stipendio', abit: 'Voce Abitudinaria' };
  document.getElementById('modal-title').textContent = 'Nuovo ' + (labels[expCat] || '');
  document.getElementById('modal-input').value = '';
  document.getElementById('modal-overlay').classList.add('show');
  setTimeout(() => document.getElementById('modal-input').focus(), 350);
}

export function addExpense() {
  const amount = parseFloat(document.getElementById('exp-amount').value);
  if (!amount || amount <= 0) {
    showToast('Inserisci un importo valido', 'warn');
    return;
  }

  let name, type;

  if (expCat === 'libera') {
    name = document.getElementById('exp-free-name').value.trim() || 'Spesa generica';
    type = 'Spesa';
  } else if (expSelectedVoice) {
    name = expSelectedVoice;
    type = expCat === 'fornitori' ? 'Fornitore' : (expCat === 'stipendi' ? 'Stipendio' : 'Spesa');
  } else {
    showToast('Seleziona una voce o usa "Libera"', 'warn');
    return;
  }

  const note = document.getElementById('exp-note').value.trim();
  const fatturaNum = expCat === 'fornitori' ? document.getElementById('exp-fattura-num').value.trim() : '';
  if (expCat === 'fornitori' && !fatturaNum) {
    showToast('Inserisci il numero fattura', 'warn');
    document.getElementById('exp-fattura-num').focus();
    return;
  }
  pendingExpenses.push({ name, cat: expCat, type, amount, note, fatturaNum });
  closeExpenseSheet();
  renderPendingList();
  showToast(name + ' - ' + amount.toLocaleString('it-IT', { minimumFractionDigits: 2 }) + '\u20AC aggiunta', 'check');
}

export function renderPendingList() {
  const el = document.getElementById('pending-list');

  if (pendingExpenses.length === 0) {
    el.innerHTML = '<div class="pending-empty">Nessuna spesa aggiunta</div>';
    return;
  }

  const total = pendingExpenses.reduce((s, e) => s + e.amount, 0);
  const iconLetters = { fornitori: 'F', stipendi: 'S', abit: 'A', libera: '?' };

  let html = '<div class="pending-list">';
  pendingExpenses.forEach((e, i) => {
    html += `
      <div class="pending-item">
        <div class="pending-icon ${e.cat}">${iconLetters[e.cat] || '?'}</div>
        <div class="pending-info">
          <div class="pending-name">${escapeHtml(e.name)}</div>
          <div class="pending-cat">${escapeHtml(e.type)}${e.fatturaNum ? ' \u00B7 Fatt. ' + escapeHtml(e.fatturaNum) : ''}${e.note ? ' \u00B7 ' + escapeHtml(e.note) : ''}</div>
        </div>
        <div class="pending-amount">-${e.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\u20AC</div>
        <button class="pending-remove" data-action="removePending" data-index="${i}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;
  });
  html += `
    <div class="pending-total">
      <span>Totale uscite</span>
      <span class="pending-total-amount">-${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\u20AC</span>
    </div>
  </div>`;
  el.innerHTML = html;
}

export function removePending(index) {
  const removed = pendingExpenses.splice(index, 1)[0];
  renderPendingList();
  showToast('"' + removed.name + '" rimossa', 'trash');
}
