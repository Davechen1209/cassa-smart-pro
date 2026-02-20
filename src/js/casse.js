// ─── Multi-Cassa ───

import {
  d, fullSave, casseList, casseNextId, pendingExpenses, selectedDate,
  setCasseList, setCasseNextId,
  anticipiNextId, setAnticipiNextId
} from './state.js';
import { showToast } from './modals.js';
import { autoCreateFatturaIfNeeded } from './fatture.js';
import { renderPendingList } from './expense.js';
import { t } from './i18n.js';

export function renderCasse() {
  const container = document.getElementById('casse-container');
  container.innerHTML = casseList.map((c, i) => `
    <div class="cassa-row">
      <div class="cassa-header">
        <div class="cassa-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          ${t('incassi.cassa')} ${i + 1}
        </div>
        ${casseList.length > 1 ? `
          <button class="cassa-remove" data-action="removeCassa" data-id="${c.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        ` : ''}
      </div>
      <div class="input-row">
        <div class="input-group">
          <label>${t('incassi.totaleZ')}</label>
          <input type="number" class="input-field" id="z-${c.id}" placeholder="0,00" inputmode="decimal">
        </div>
        <div class="input-group">
          <label>${t('incassi.pos')}</label>
          <input type="number" class="input-field" id="pos-${c.id}" placeholder="0,00" inputmode="decimal">
        </div>
      </div>
    </div>
  `).join('');
}

export function addCassa() {
  casseList.push({ id: casseNextId });
  setCasseNextId(casseNextId + 1);
  renderCasse();
}

export function removeCassa(id) {
  setCasseList(casseList.filter(c => c.id !== id));
  renderCasse();
}

export function getCasseData() {
  return casseList.map((c, i) => {
    const z = parseFloat(document.getElementById('z-' + c.id)?.value) || 0;
    const pos = parseFloat(document.getElementById('pos-' + c.id)?.value) || 0;
    return { name: t('incassi.cassa') + ' ' + (i + 1), z, pos, cash: z - pos };
  }).filter(c => c.z > 0);
}

export function registra() {
  const casse = getCasseData();
  const oggi = selectedDate.toLocaleDateString('it-IT');

  if (casse.length === 0 && pendingExpenses.length === 0) {
    showToast(t('uscite.noData'), 'warn');
    return;
  }

  let messages = [];

  casse.forEach(c => {
    d.saldo += c.cash;
    const label = casseList.length > 1 ? c.name + ' ' : '';
    d.log.push({ d: oggi, v: label + t('fatt.incassoCash') + ' (Z:' + c.z + ' POS:' + c.pos + ')', a: c.cash });
    messages.push(label + '+' + c.cash.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC');
  });

  pendingExpenses.forEach(e => {
    d.saldo -= e.amount;
    const desc = e.type + ': ' + e.name + (e.note ? ' (' + e.note + ')' : '');
    const logEntry = { d: oggi, v: desc, a: -e.amount };
    if (e.fatturaNum) logEntry.fatt = e.fatturaNum;
    d.log.push(logEntry);

    if (e.cat === 'fornitori' && e.name) {
      autoCreateFatturaIfNeeded(e.name, e.amount, oggi, e.fatturaNum);
    }

    if (e.cat === 'anticipo' && e.name) {
      d.anticipi.push({
        id: anticipiNextId,
        nome: e.name,
        importo: e.amount,
        data: oggi,
        note: e.note || '',
        restituito: false
      });
      setAnticipiNextId(anticipiNextId + 1);
    }
  });

  if (pendingExpenses.length > 0) {
    const totalExp = pendingExpenses.reduce((s, e) => s + e.amount, 0);
    messages.push(pendingExpenses.length + ' ' + t('uscite.expenses') + ': -' + totalExp.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC');
  }

  setCasseList([{ id: 1 }]);
  setCasseNextId(2);
  renderCasse();
  pendingExpenses.length = 0;
  renderPendingList();

  const btn = document.getElementById('btn-registra');
  btn.classList.add('success');
  btn.textContent = t('uscite.registered');
  setTimeout(() => {
    btn.classList.remove('success');
    btn.textContent = t('uscite.registra');
  }, 1500);

  fullSave();
  showToast(messages.join(' | '), 'check');
}
