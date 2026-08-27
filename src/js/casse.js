// ─── Multi-Cassa ───

import {
  d, fullSave, casseList, casseNextId, pendingExpenses, pendingDeposits, selectedDate,
  setCasseList, setCasseNextId
} from './state.js';
import { showToast } from './modals.js';
import { renderPendingList } from './expense.js';
import { renderPendingDeposits } from './deposit.js';
import { t } from './i18n.js';
import { parseImporto } from './money.js';
import { fattureDaSpese } from './fatture-bridge.js';

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
          <label for="z-${c.id}">${t('incassi.totaleZ')}</label>
          <input type="text" class="input-field" id="z-${c.id}" placeholder="0,00" inputmode="decimal">
        </div>
        <div class="input-group">
          <label for="pos-${c.id}">${t('incassi.pos')}</label>
          <input type="text" class="input-field" id="pos-${c.id}" placeholder="0,00" inputmode="decimal">
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
    const z = parseImporto(document.getElementById('z-' + c.id)?.value);
    const pos = parseImporto(document.getElementById('pos-' + c.id)?.value);
    return { name: t('incassi.cassa') + ' ' + (i + 1), z, pos, cash: z - pos };
  }).filter(c => c.z > 0);
}

export function registra() {
  const casse = getCasseData();
  const oggi = selectedDate.toLocaleDateString('it-IT');

  if (casse.length === 0 && pendingExpenses.length === 0 && pendingDeposits.length === 0) {
    showToast(t('uscite.noData'), 'warn');
    return;
  }

  let messages = [];

  casse.forEach(c => {
    d.saldo += c.cash;
    const label = casseList.length > 1 ? c.name + ' ' : '';
    d.log.push({ d: oggi, v: label + t('fatt.incassoCash') + ' (' + t('incassi.totaleLabel') + ':' + c.z + ' POS:' + c.pos + ')', a: c.cash });
    messages.push(label + '+' + c.cash.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC');
  });

  pendingExpenses.forEach(e => {
    d.saldo -= e.amount;
    // Quando il nome coincide con la tipologia (il reso al cliente senza altro
    // dettaglio) la riga diventerebbe "Reso al cliente: Reso al cliente".
    const testa = e.name && e.name !== e.type ? e.type + ': ' + e.name : e.type;
    const desc = testa + (e.note ? ' (' + e.note + ')' : '');
    const logEntry = { d: oggi, v: desc, a: -e.amount };
    if (e.fatturaNum) logEntry.fatt = e.fatturaNum;
    d.log.push(logEntry);


  });

  // Il deposito toglie contanti dalla cassa come un'uscita, ma il registro lo
  // contrassegna (dep) perche' i conti non lo scambino per una spesa: i soldi
  // non sono usciti, sono solo in banca.
  pendingDeposits.forEach(x => {
    d.saldo -= x.amount;
    const desc = t('dep.log') + (x.note ? ' (' + x.note + ')' : '');
    d.log.push({ d: oggi, v: desc, a: -x.amount, dep: true });
  });

  // Una spesa a fornitore e' una fattura pagata in contanti: compare da sola
  // nella tab Fatture, gia' saldata.
  const fattureCreate = fattureDaSpese(pendingExpenses, oggi);
  if (fattureCreate > 0) messages.push(t('bridge.fattureCreate', { n: fattureCreate }));

  if (pendingExpenses.length > 0) {
    const totalExp = pendingExpenses.reduce((s, e) => s + e.amount, 0);
    messages.push(pendingExpenses.length + ' ' + t('uscite.expenses') + ': -' + totalExp.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC');
  }

  if (pendingDeposits.length > 0) {
    const totDep = pendingDeposits.reduce((s, x) => s + x.amount, 0);
    messages.push(t('dep.title') + ': -' + totDep.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u20AC');
  }

  setCasseList([{ id: 1 }]);
  setCasseNextId(2);
  renderCasse();
  pendingExpenses.length = 0;
  renderPendingList();
  pendingDeposits.length = 0;
  renderPendingDeposits();

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
