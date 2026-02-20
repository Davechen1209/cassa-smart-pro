// ─── Anticipi (Cash Advances) ───

import {
  d, fullSave, selectedDate,
  anticipiFilter,
  setAnticipiFilter
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { t } from './i18n.js';

export function renderAnticipi() {
  const list = d.anticipi || [];
  const open = list.filter(a => !a.restituito);
  const totalOpen = open.reduce((s, a) => s + a.importo, 0);

  // Summary card
  document.getElementById('ant-total').textContent = '\u20AC ' + totalOpen.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('ant-count').textContent = open.length;

  // Filter
  const filtered = anticipiFilter === 'aperti' ? list.filter(a => !a.restituito)
    : anticipiFilter === 'rimborsati' ? list.filter(a => a.restituito)
    : list;

  const container = document.getElementById('anticipi-list');
  if (filtered.length === 0) {
    container.innerHTML = '<div class="pending-empty">' + t('ant.empty') + '</div>';
    return;
  }

  container.innerHTML = filtered.map(a => `
    <div class="anticipo-row${a.restituito ? ' repaid' : ''}">
      <div class="anticipo-dot ${a.restituito ? 'repaid' : 'open'}"></div>
      <div class="anticipo-info">
        <div class="anticipo-name">${escapeHtml(a.nome)}</div>
        <div class="anticipo-meta">${a.data}${a.note ? ' \u00B7 ' + escapeHtml(a.note) : ''}</div>
      </div>
      <div class="anticipo-amount">${a.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC</div>
      ${!a.restituito ? `
        <button class="anticipo-repay" data-action="repayAnticipo" data-id="${a.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
        </button>
      ` : ''}
    </div>
  `).join('');

  // Also render in Registra tab
  renderOpenAnticipi();
}

export function renderOpenAnticipi() {
  const open = (d.anticipi || []).filter(a => !a.restituito);
  const section = document.getElementById('open-anticipi-section');

  if (open.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  document.getElementById('open-ant-badge').textContent = open.length;

  const container = document.getElementById('open-anticipi-list');
  container.innerHTML = open.map(a => `
    <div class="anticipo-row">
      <div class="anticipo-dot open"></div>
      <div class="anticipo-info">
        <div class="anticipo-name">${escapeHtml(a.nome)}</div>
        <div class="anticipo-meta">${a.data}${a.note ? ' \u00B7 ' + escapeHtml(a.note) : ''}</div>
      </div>
      <div class="anticipo-amount">${a.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u20AC</div>
      <button class="anticipo-repay" data-action="repayAnticipo" data-id="${a.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
      </button>
    </div>
  `).join('');
}

export function filterAnticipi(filter, btn) {
  setAnticipiFilter(filter);
  document.querySelectorAll('#ant-filter .segment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAnticipi();
}

export function repayAnticipo(id) {
  const ant = d.anticipi.find(a => a.id === id);
  if (!ant) return;

  showConfirm(
    t('ant.repayTitle'),
    t('ant.repayMsg', { name: ant.nome, amount: ant.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }),
    () => {
      ant.restituito = true;
      const oggi = selectedDate.toLocaleDateString('it-IT');
      d.saldo += ant.importo;
      d.log.push({ d: oggi, v: t('ant.logRepay') + ': ' + ant.nome, a: ant.importo });
      fullSave();
      showToast(t('ant.repaid', { name: ant.nome }), 'check');
    }
  );
}

export function getOpenAnticipiForName(nome) {
  return (d.anticipi || []).filter(a => !a.restituito && a.nome === nome);
}
