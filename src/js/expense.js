// ─── Expense Sheet ───

import {
  d, pendingExpenses, expCat, expSelectedVoice,
  setExpCat, setExpSelectedVoice,
  setModalCat, setEditingItem
} from './state.js';
import { showToast, escapeHtml } from './modals.js';
import { t } from './i18n.js';
import { parseImporto } from './money.js';
export function openExpenseSheet() {
  setExpCat('fornitori');
  setExpSelectedVoice(null);
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-free-name').value = '';
  document.getElementById('exp-note').value = '';
  document.getElementById('exp-fattura-num').value = '';
  svuotaRicercaVoci();
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
  // La ricerca vale per la categoria in cui e' stata scritta: restando,
  // cambiando categoria si vedeva un elenco vuoto senza capire perche'.
  svuotaRicercaVoci();
  updateExpSegments();
  renderExpVoices();
}

export function updateExpSegments() {
  const btns = document.querySelectorAll('#exp-segments .segment-btn');
  const cats = ['fornitori', 'stipendi', 'abit', 'libera', 'reso'];
  btns.forEach((btn, i) => btn.classList.toggle('active', cats[i] === expCat));
  // La riga scorre: se la tipologia scelta e' oltre il bordo va portata in
  // vista, altrimenti si apre la scheda senza vedere qual e' selezionata.
  // scrollIntoView la porta a filo del bordo destro, cioe' dentro la
  // sfumatura: si scorre di quei pochi pixel in piu' perche' ne esca.
  const scelta = [...btns].find(b => b.classList.contains('active'));
  const riga = document.getElementById('exp-segments');
  if (scelta && riga && scelta.scrollIntoView) {
    scelta.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const SFUMATURA = 24;
    const rr = riga.getBoundingClientRect();
    const rs = scelta.getBoundingClientRect();
    const avanzo = rr.right - rs.right;
    if (avanzo < SFUMATURA) riga.scrollLeft += SFUMATURA - avanzo;
  }

  // Render custom category chips
  const customContainer = document.getElementById('exp-custom-cats');
  if (customContainer) {
    customContainer.innerHTML = (d.customCats || []).map(cc =>
      `<button class="segment-btn ${expCat === 'custom:' + cc.name ? 'active' : ''}"
               data-action="switchExpCat" data-cat="custom:${escapeHtml(cc.name)}">
        ${cc.emoji ? cc.emoji + ' ' : ''}${escapeHtml(cc.name)}
      </button>`
    ).join('');
    customContainer.style.display = (d.customCats || []).length > 0 ? 'flex' : 'none';
  }

  const voicesSection = document.getElementById('exp-voices-section');
  const freeWrap = document.getElementById('free-name-wrap');
  const isCustom = expCat.startsWith('custom:');

  document.getElementById('exp-fattura-wrap').style.display = expCat === 'fornitori' ? 'block' : 'none';

  if (expCat === 'libera' || isCustom || expCat === 'reso') {
    voicesSection.style.display = 'none';
    freeWrap.classList.add('open');
    // Un reso al cliente di solito non ha un nome da scrivere: il campo resta
    // per annotare chi o perche', ma non chiede niente.
    const campoLibero = document.getElementById('exp-free-name');
    campoLibero.placeholder = t(expCat === 'reso' ? 'exp.resoPlaceholder' : 'exp.descPlaceholder');
    setTimeout(() => campoLibero.focus(), 100);
  } else {
    voicesSection.style.display = 'block';
    freeWrap.classList.remove('open');
  }
}

// Scelta della voce: il campo mostra quella scelta, l'elenco compare solo
// quando lo si tocca. Con una rubrica lunga scorrere un <select> era scomodo,
// ma tenere l'elenco sempre aperto occupava mezza scheda per niente.
const VOCI_MOSTRATE = 6;
let vociAperte = false;

function campoVoci() {
  return document.getElementById('exp-voice-search');
}

function svuotaRicercaVoci() {
  const campo = campoVoci();
  if (campo) campo.value = '';
  vociAperte = false;
}

export function apriElencoVoci() {
  if (expCat === 'libera' || expCat === 'reso' || expCat.startsWith('custom:')) return;
  vociAperte = true;
  const campo = campoVoci();
  // Il campo contiene la voce gia' scelta: selezionandola per intero, la prima
  // lettera digitata la sostituisce invece di accodarsi.
  if (campo && campo.value) campo.select();
  renderExpVoices();
}

export function chiudiElencoVoci() {
  if (!vociAperte) return;
  vociAperte = false;
  renderExpVoices();
}

export function renderExpVoices() {
  if (expCat === 'libera' || expCat === 'reso') return;

  const contenitore = document.getElementById('exp-voice-results');
  if (!contenitore) return;

  if (!vociAperte) {
    contenitore.innerHTML = '';
    return;
  }

  const lista = d[expCat] || [];
  const campo = campoVoci();
  const scritto = (campo ? campo.value : '').trim();
  // Se nel campo c'e' esattamente la voce gia' scelta non e' una ricerca:
  // riaprendo l'elenco si vuole rivedere tutto, non solo quella riga.
  const cerca = (scritto && scritto !== expSelectedVoice) ? scritto.toLowerCase() : '';

  // Chi corrisponde meglio prima: chi inizia con quello che hai scritto.
  const trovate = lista
    .filter(n => !cerca || n.toLowerCase().includes(cerca))
    .sort((a, b) => {
      if (!cerca) return 0;
      const ia = a.toLowerCase().startsWith(cerca) ? 0 : 1;
      const ib = b.toLowerCase().startsWith(cerca) ? 0 : 1;
      return ia - ib;
    });

  if (lista.length === 0) {
    contenitore.innerHTML = '<div class="voice-empty">' + escapeHtml(t('exp.noVoices')) + '</div>';
    return;
  }
  if (trovate.length === 0) {
    contenitore.innerHTML = '<div class="voice-empty">' + escapeHtml(t('exp.noMatch')) + '</div>';
    return;
  }

  const mostrate = trovate.slice(0, VOCI_MOSTRATE);
  let html = mostrate.map(n => {
    const scelta = expSelectedVoice === n;
    return '<button type="button" class="voice-row' + (scelta ? ' selected' : '') + '"' +
      ' data-action="selectExpVoice" data-name="' + escapeHtml(n) + '">' +
      '<span class="voice-row-name">' + escapeHtml(n) + '</span>' +
      (scelta ? '<span class="voice-row-check">✓</span>' : '') +
      '</button>';
  }).join('');

  const restanti = trovate.length - mostrate.length;
  if (restanti > 0) {
    html += '<div class="voice-more">' + escapeHtml(t('exp.moreVoices', { n: restanti })) + '</div>';
  }
  contenitore.innerHTML = html;
}

export function selectExpVoice(name) {
  setExpSelectedVoice(name || null);
  // Scelta fatta: il campo mostra il nome e l'elenco si richiude.
  const campo = campoVoci();
  if (campo) campo.value = name || '';
  vociAperte = false;
  renderExpVoices();
}

export function filterExpVoices() {
  vociAperte = true;
  renderExpVoices();
}

export function addNewVoiceFromSheet() {
  const actualCat = expCat;
  setModalCat(actualCat);
  setEditingItem(null);
  const labels = { fornitori: t('rub.newFornitore'), stipendi: t('rub.newStipendio'), abit: t('rub.newVoce') };
  document.getElementById('modal-title').textContent = labels[actualCat] || '';
  document.getElementById('modal-input').value = '';
  document.getElementById('modal-overlay').classList.add('show');
  setTimeout(() => document.getElementById('modal-input').focus(), 350);
}

export function addExpense() {
  const amount = parseImporto(document.getElementById('exp-amount').value);
  if (!amount || amount <= 0) {
    showToast(t('exp.invalidAmount'), 'warn');
    return;
  }

  let name, type;

  if (expCat.startsWith('custom:')) {
    const catName = expCat.slice(7);
    name = document.getElementById('exp-free-name').value.trim() || t('exp.genericExpense');
    type = catName;
  } else if (expCat === 'reso') {
    // Senza nome la voce e' semplicemente "Reso al cliente": il registro poi
    // non ripete due volte la stessa parola.
    name = document.getElementById('exp-free-name').value.trim() || t('exp.reso');
    type = t('exp.reso');
  } else if (expCat === 'libera') {
    name = document.getElementById('exp-free-name').value.trim() || t('exp.genericExpense');
    type = t('exp.expense');
  } else if (expSelectedVoice) {
    name = expSelectedVoice;
    type = expCat === 'fornitori' ? t('exp.fornitore') : (expCat === 'stipendi' ? t('exp.stipendio') : t('exp.expense'));
  } else {
    showToast(t('exp.selectOrFree'), 'warn');
    return;
  }

  const note = document.getElementById('exp-note').value.trim();
  const fatturaNum = expCat === 'fornitori' ? document.getElementById('exp-fattura-num').value.trim() : '';
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
  const iconLetters = { fornitori: 'F', stipendi: 'S', abit: 'A', libera: '?', reso: 'R' };
  // Build icon map for custom cats
  (d.customCats || []).forEach(cc => { iconLetters['custom:' + cc.name] = cc.emoji || '★'; });

  let html = '<div class="pending-list">';
  pendingExpenses.forEach((e, i) => {
    html += `
      <div class="pending-item">
        <div class="pending-icon ${e.cat}">${iconLetters[e.cat] || '?'}</div>
        <div class="pending-info">
          <div class="pending-name">${escapeHtml(e.name)}</div>
          <div class="pending-cat">${e.name === e.type ? '' : escapeHtml(e.type)}${e.fatturaNum ? (e.name === e.type ? '' : ' \u00B7 ') + t('exp.fatt') + escapeHtml(e.fatturaNum) : ''}${e.note ? (e.name === e.type && !e.fatturaNum ? '' : ' \u00B7 ') + escapeHtml(e.note) : ''}</div>
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
