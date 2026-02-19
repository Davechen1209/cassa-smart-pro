// ─── Rubriche ───

import {
  d, fullSave, openRubriche,
  editingItem, modalCat,
  setEditingItem, setModalCat,
  expCat, expSelectedVoice, setExpSelectedVoice
} from './state.js';
import { showToast, showConfirm, closeModal, escapeHtml } from './modals.js';
import { renderExpVoices } from './expense.js';
import { t } from './i18n.js';

export function toggleRubrica(cat) {
  openRubriche[cat] = !openRubriche[cat];
  renderRubriche();
}

export function renderRubriche() {
  ['fornitori', 'stipendi', 'abit'].forEach(cat => {
    const list = d[cat];
    document.getElementById('rub-count-' + cat).textContent = list.length + ' ' + (list.length === 1 ? t('rub.voce_one') : t('rub.voce_other'));

    const isOpen = openRubriche[cat];
    const itemsEl = document.getElementById('rub-items-' + cat);
    const chevEl = document.getElementById('chev-' + cat);

    chevEl.classList.toggle('open', !!isOpen);
    itemsEl.classList.toggle('open', !!isOpen);

    if (isOpen) {
      const catLabel = cat === 'fornitori' ? t('rub.addFornitore') : (cat === 'stipendi' ? t('rub.addStipendio') : t('rub.addVoce'));
      itemsEl.innerHTML = list.map((n, i) => `
        <div class="rubrica-item">
          <span class="rubrica-item-name">${escapeHtml(n)}</span>
          <div class="rubrica-item-actions">
            <button class="rubrica-item-btn edit" data-action="editItem" data-cat="${cat}" data-index="${i}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button class="rubrica-item-btn delete" data-action="deleteItem" data-cat="${cat}" data-index="${i}" data-name="${escapeHtml(n)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `).join('') + `
        <div class="rubrica-add-row" data-action="openModalRubrica" data-cat="${cat}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8m-4-4v8"/></svg>
          ${catLabel}
        </div>
      `;
    }
  });
}

export function deleteItem(cat, index, name) {
  showConfirm(t('rub.deleteTitle'), t('rub.deleteMsg', { name }), () => {
    d[cat].splice(index, 1);
    fullSave();
    showToast(t('rub.deleted', { name }), 'trash');
  });
}

export function editItem(cat, index) {
  setEditingItem({ cat, index });
  setModalCat(null);
  document.getElementById('modal-title').textContent = t('rub.rename');
  document.getElementById('modal-input').value = d[cat][index];
  document.getElementById('modal-overlay').classList.add('show');
  setTimeout(() => {
    document.getElementById('modal-input').focus();
    document.getElementById('modal-input').select();
  }, 350);
}

export function openModalRubrica(cat) {
  setModalCat(cat);
  setEditingItem(null);
  const labels = { fornitori: t('rub.newFornitore'), stipendi: t('rub.newStipendio'), abit: t('rub.newVoce') };
  document.getElementById('modal-title').textContent = labels[cat] || '';
  document.getElementById('modal-input').value = '';
  document.getElementById('modal-overlay').classList.add('show');
  setTimeout(() => document.getElementById('modal-input').focus(), 350);
}

export function modalConfirm() {
  if (window._paymentModalHandler) { window._paymentModalHandler(); return; }
  const val = document.getElementById('modal-input').value.trim();
  if (!val) return;

  if (editingItem) {
    const old = d[editingItem.cat][editingItem.index];
    d[editingItem.cat][editingItem.index] = val;
    showToast(t('rub.renamed', { old, 'new': val }), 'check');
    setEditingItem(null);
  } else if (modalCat) {
    d[modalCat].push(val);
    if (document.getElementById('expense-overlay').classList.contains('show') && modalCat === expCat) {
      setExpSelectedVoice(val);
      renderExpVoices();
    }
    showToast(t('rub.added', { name: val }), 'check');
  }
  closeModal();
  fullSave();
}
