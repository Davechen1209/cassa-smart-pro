// ─── Depositi in banca ───
// I contanti portati in banca escono dalla cassa esattamente come un'uscita,
// ma non sono una spesa: restano soldi nostri, solo altrove. Percio' hanno una
// sezione propria e nei conti non finiscono mai fra le uscite (vedi
// isDeposito in i18n.js, usato da report, PDF, riepilogo del giorno).

import { pendingDeposits } from './state.js';
import { showToast, escapeHtml } from './modals.js';
import { t } from './i18n.js';
import { parseImporto } from './money.js';

function fmtEuro(n) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function openDepositSheet() {
  document.getElementById('dep-amount').value = '';
  document.getElementById('dep-note').value = '';
  document.getElementById('deposit-overlay').classList.add('show');
  setTimeout(() => document.getElementById('dep-amount').focus(), 350);
}

export function closeDepositSheet() {
  document.getElementById('deposit-overlay').classList.remove('show');
}

export function closeDepositOutside(e) {
  if (e.target === document.getElementById('deposit-overlay')) closeDepositSheet();
}

// I tagli dei depositi non sono quelli delle spese: in banca si portano
// mazzette, non cinque euro.
export function setDepositAmount(val) {
  document.getElementById('dep-amount').value = val;
}

export function customDepositAmount() {
  const el = document.getElementById('dep-amount');
  el.value = '';
  el.focus();
}

export function addDeposit() {
  const amount = parseImporto(document.getElementById('dep-amount').value);
  if (!amount || amount <= 0) {
    showToast(t('exp.invalidAmount'), 'warn');
    return;
  }
  const note = document.getElementById('dep-note').value.trim();
  pendingDeposits.push({ amount, note });
  closeDepositSheet();
  renderPendingDeposits();
  showToast(fmtEuro(amount) + '€' + t('dep.added'), 'check');
}

export function removePendingDeposit(index) {
  const tolto = pendingDeposits.splice(index, 1)[0];
  renderPendingDeposits();
  showToast(fmtEuro(tolto.amount) + '€' + t('dep.removed'), 'trash');
}

export function renderPendingDeposits() {
  const el = document.getElementById('pending-deposits');
  if (!el) return;

  if (pendingDeposits.length === 0) {
    el.innerHTML = '<div class="pending-empty">' + t('dep.noPending') + '</div>';
    return;
  }

  const totale = pendingDeposits.reduce((s, x) => s + x.amount, 0);
  let html = '<div class="pending-list">';
  pendingDeposits.forEach((x, i) => {
    html += `
      <div class="pending-item deposito">
        <div class="pending-icon deposito">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18L12 3 3 10Z"/><path d="M5 10v8m5-8v8m4-8v8m5-8v8"/><path d="M3 21h18"/></svg>
        </div>
        <div class="pending-info">
          <!-- Sopra c'e' gia' il titolo della sezione: la riga porta la nota
               quando c'e', altrimenti ripeterebbe due volte la stessa frase. -->
          <div class="pending-name">${escapeHtml(x.note || t('dep.log'))}</div>
        </div>
        <div class="pending-amount">-${fmtEuro(x.amount)}€</div>
        <button class="pending-remove" data-action="removePendingDeposit" data-index="${i}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;
  });
  html += `
    <div class="pending-total deposito">
      <span>${t('dep.total')}</span>
      <span class="pending-total-amount">-${fmtEuro(totale)}€</span>
    </div>
  </div>`;
  el.innerHTML = html;
}
