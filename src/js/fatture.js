// ─── Fatture (Invoice Tracking) ───

import {
  d, fullSave, fattureFilter, editingFatturaId,
  setFattureFilter, setEditingFatturaId
} from './state.js';
import { showToast, showConfirm, closeModal, escapeHtml } from './modals.js';
import { toISODate } from './date-utils.js';

export function calcAllFattureCash() {
  if (!d.fatture || d.fatture.length === 0) return;

  const expByFattNum = {};
  const expByName = {};

  d.log.forEach(entry => {
    if (!entry.v || entry.a >= 0) return;
    const match = String(entry.v).match(/^Fornitore:\s*(.+?)(\s*\(|$)/i);
    if (!match) return;
    const amount = Math.abs(entry.a);

    if (entry.fatt) {
      const numKey = entry.fatt.trim().toLowerCase();
      expByFattNum[numKey] = (expByFattNum[numKey] || 0) + amount;
    } else {
      const name = match[1].trim().toLowerCase();
      expByName[name] = (expByName[name] || 0) + amount;
    }
  });

  // Pass 1: match by invoice number
  d.fatture.forEach(f => {
    f.pagCash = 0;
    if (f.numero) {
      const numKey = f.numero.trim().toLowerCase();
      if (expByFattNum[numKey]) {
        const maxCash = Math.max(0, f.importo - (f.pagBonifico || 0));
        f.pagCash = Math.round(Math.min(expByFattNum[numKey], maxCash) * 100) / 100;
        expByFattNum[numKey] = Math.max(0, expByFattNum[numKey] - f.pagCash);
      }
    }
    f.pagato = f.pagCash + (f.pagBonifico || 0);
    f.nonPagato = Math.max(0, Math.round((f.importo - f.pagato) * 100) / 100);
  });

  // Pass 2: match by supplier name
  const fattureByAzienda = {};
  d.fatture.forEach(f => {
    if (f.nonPagato <= 0) return;
    const key = (f.azienda || '').trim().toLowerCase();
    if (!fattureByAzienda[key]) fattureByAzienda[key] = [];
    fattureByAzienda[key].push(f);
  });

  Object.keys(fattureByAzienda).forEach(aziendaKey => {
    let available = expByName[aziendaKey] || 0;
    if (available <= 0) return;
    const fatture = fattureByAzienda[aziendaKey].sort((a, b) =>
      (a.dataArrivo || '').localeCompare(b.dataArrivo || '')
    );
    fatture.forEach(f => {
      const maxCash = Math.max(0, f.importo - (f.pagBonifico || 0) - f.pagCash);
      const cashForThis = Math.min(available, maxCash);
      f.pagCash = Math.round((f.pagCash + cashForThis) * 100) / 100;
      f.pagato = f.pagCash + (f.pagBonifico || 0);
      f.nonPagato = Math.max(0, Math.round((f.importo - f.pagato) * 100) / 100);
      available -= cashForThis;
    });
  });
}

export function autoCreateFatturaIfNeeded(fornitore, importo, data, fatturaNum) {
  if (!d.fatture) d.fatture = [];

  if (fatturaNum) {
    const byNum = d.fatture.find(f =>
      f.numero && f.numero.trim().toLowerCase() === fatturaNum.trim().toLowerCase()
    );
    if (byNum) return;
  }

  const isoDate = data.includes('/') ?
    data.split('/')[2] + '-' + data.split('/')[1] + '-' + data.split('/')[0] :
    data;
  d.fatture.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    dataArrivo: isoDate,
    azienda: fornitore.trim(),
    numero: fatturaNum || '',
    importo: importo,
    pagCash: 0,
    pagBonifico: 0,
    pagato: 0,
    nonPagato: importo,
    ciclo: '',
    scadenza: '',
    note: 'Creata automaticamente'
  });
}

export function updateFattureAziendaList() {
  const dl = document.getElementById('fatt-azienda-list');
  if (!dl) return;
  dl.innerHTML = (d.fornitori || []).map(f => '<option value="' + escapeHtml(f) + '">').join('');
}

export function getFatturaStatus(f) {
  if (f.nonPagato <= 0) return 'pagata';
  if (f.scadenza) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(f.scadenza); due.setHours(0, 0, 0, 0);
    if (due < today) return 'scaduta';
    const diff = (due - today) / (1000 * 60 * 60 * 24);
    if (diff <= 7) return 'in_scadenza';
  }
  return 'aperta';
}

export function openFatturaSheet(id) {
  setEditingFatturaId(id || null);
  const overlay = document.getElementById('fattura-overlay');
  const title = document.getElementById('fattura-sheet-title');
  const btn = document.getElementById('fatt-save-btn');

  updateFattureAziendaList();

  if (id) {
    const f = d.fatture.find(x => x.id === id);
    if (!f) return;
    title.textContent = 'Modifica Fattura';
    btn.textContent = 'Aggiorna';
    document.getElementById('fatt-data-arrivo').value = f.dataArrivo || '';
    document.getElementById('fatt-numero').value = f.numero || '';
    document.getElementById('fatt-azienda').value = f.azienda || '';
    document.getElementById('fatt-importo').value = f.importo || '';
    document.getElementById('fatt-bonifico').value = f.pagBonifico || '';
    document.getElementById('fatt-ciclo').value = f.ciclo || '';
    document.getElementById('fatt-scadenza').value = f.scadenza || '';
    document.getElementById('fatt-note').value = f.note || '';
  } else {
    title.textContent = 'Nuova Fattura';
    btn.textContent = 'Salva';
    document.getElementById('fatt-data-arrivo').value = toISODate(new Date());
    document.getElementById('fatt-numero').value = '';
    document.getElementById('fatt-azienda').value = '';
    document.getElementById('fatt-importo').value = '';
    document.getElementById('fatt-bonifico').value = '';
    document.getElementById('fatt-ciclo').value = '';
    document.getElementById('fatt-scadenza').value = '';
    document.getElementById('fatt-note').value = '';
  }
  overlay.classList.add('show');
}

export function closeFatturaSheet() {
  document.getElementById('fattura-overlay').classList.remove('show');
  setEditingFatturaId(null);
}

export function closeFatturaOutside(e) {
  if (e.target === e.currentTarget) closeFatturaSheet();
}

export function saveFattura() {
  const azienda = document.getElementById('fatt-azienda').value.trim();
  const importo = parseFloat(document.getElementById('fatt-importo').value) || 0;

  if (!azienda) { showToast('Inserisci il nome dell\'azienda', 'warn'); return; }
  if (importo <= 0) { showToast('Inserisci un importo valido', 'warn'); return; }

  const pagBonifico = parseFloat(document.getElementById('fatt-bonifico').value) || 0;

  const fattura = {
    id: editingFatturaId || Date.now(),
    dataArrivo: document.getElementById('fatt-data-arrivo').value,
    azienda: azienda,
    numero: document.getElementById('fatt-numero').value.trim(),
    importo: importo,
    pagCash: 0,
    pagBonifico: pagBonifico,
    pagato: pagBonifico,
    nonPagato: Math.max(0, importo - pagBonifico),
    ciclo: document.getElementById('fatt-ciclo').value,
    scadenza: document.getElementById('fatt-scadenza').value,
    note: document.getElementById('fatt-note').value.trim()
  };

  if (editingFatturaId) {
    const idx = d.fatture.findIndex(x => x.id === editingFatturaId);
    if (idx >= 0) d.fatture[idx] = fattura;
  } else {
    d.fatture.push(fattura);
  }

  fullSave();
  closeFatturaSheet();
  showToast(editingFatturaId ? 'Fattura aggiornata' : 'Fattura aggiunta', 'check');
}

export function deleteFattura(id) {
  showConfirm('Elimina Fattura', 'Vuoi eliminare questa fattura?', () => {
    d.fatture = d.fatture.filter(x => x.id !== id);
    fullSave();
    closeFatturaDetail();
    showToast('Fattura eliminata', 'check');
  });
}

export function filterFatture(filter, targetBtn) {
  setFattureFilter(filter);
  document.querySelectorAll('#fatt-filter .segment-btn').forEach(b => b.classList.remove('active'));
  if (targetBtn) targetBtn.classList.add('active');
  renderFatture();
}

export function renderFatture() {
  calcAllFattureCash();
  updateFattureAziendaList();
  const container = document.getElementById('fatture-list');
  if (!d.fatture || d.fatture.length === 0) {
    container.innerHTML = '<div class="fattura-empty">Nessuna fattura registrata</div>';
    document.getElementById('fatt-da-pagare').textContent = '\u20AC 0';
    document.getElementById('fatt-scadenza-count').textContent = '0';
    return;
  }

  const sorted = [...d.fatture].sort((a, b) => {
    if (a.scadenza && b.scadenza) return new Date(a.scadenza) - new Date(b.scadenza);
    return (b.dataArrivo || '').localeCompare(a.dataArrivo || '');
  });

  let filtered = sorted;
  if (fattureFilter === 'aperte') filtered = sorted.filter(f => getFatturaStatus(f) !== 'pagata');
  else if (fattureFilter === 'pagate') filtered = sorted.filter(f => getFatturaStatus(f) === 'pagata');
  else if (fattureFilter === 'scadute') filtered = sorted.filter(f => getFatturaStatus(f) === 'scaduta');

  const totalUnpaid = d.fatture.reduce((s, f) => s + (f.nonPagato || 0), 0);
  const expiringCount = d.fatture.filter(f => {
    const st = getFatturaStatus(f);
    return st === 'scaduta' || st === 'in_scadenza';
  }).length;

  document.getElementById('fatt-da-pagare').textContent = '\u20AC ' + totalUnpaid.toLocaleString('it-IT', { minimumFractionDigits: 2 });
  document.getElementById('fatt-scadenza-count').textContent = expiringCount;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="fattura-empty">Nessuna fattura in questa categoria</div>';
    return;
  }

  container.innerHTML = filtered.map(f => {
    const status = getFatturaStatus(f);
    const dotClass = status === 'pagata' ? 'pagata' : (status === 'scaduta' ? 'scaduta' : 'aperta');
    const scadenzaStr = f.scadenza ? new Date(f.scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const arrivoStr = f.dataArrivo ? new Date(f.dataArrivo).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
    const metaParts = [];
    if (f.numero) metaParts.push('N\u00B0 ' + escapeHtml(f.numero));
    if (arrivoStr) metaParts.push(arrivoStr);
    if (scadenzaStr && status !== 'pagata') metaParts.push('Scad: ' + scadenzaStr);

    return `<div class="fattura-item" data-action="openFatturaDetail" data-id="${f.id}">
      <div class="fattura-status-dot ${dotClass}"></div>
      <div class="fattura-info">
        <div class="fattura-company">${escapeHtml(f.azienda)}</div>
        <div class="fattura-meta">${metaParts.join(' \u00B7 ')}</div>
      </div>
      <div class="fattura-amounts">
        <div class="fattura-total">\u20AC ${f.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        <div class="fattura-unpaid ${f.nonPagato <= 0 ? 'zero' : ''}">${f.nonPagato <= 0 ? 'Pagata' : 'Da pagare: \u20AC ' + f.nonPagato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
      </div>
    </div>`;
  }).join('');
}

export function openFatturaDetail(id) {
  calcAllFattureCash();
  const f = d.fatture.find(x => x.id === id);
  if (!f) return;

  const status = getFatturaStatus(f);
  const statusLabel = status === 'pagata' ? 'Pagata' : (status === 'scaduta' ? 'Scaduta' : (status === 'in_scadenza' ? 'In scadenza' : 'Da pagare'));
  const statusColor = status === 'pagata' ? 'var(--green)' : (status === 'scaduta' ? 'var(--red)' : 'var(--orange)');

  const arrivoStr = f.dataArrivo ? new Date(f.dataArrivo).toLocaleDateString('it-IT') : '-';
  const scadenzaStr = f.scadenza ? new Date(f.scadenza).toLocaleDateString('it-IT') : '-';
  const cicloStr = f.ciclo && f.ciclo !== 'custom' ? f.ciclo + ' giorni' : (f.ciclo === 'custom' ? 'Personalizzato' : '-');

  document.getElementById('fattura-detail-title').innerHTML = escapeHtml(f.azienda) + ' <span style="font-size:13px;color:' + statusColor + ';font-weight:600;">' + statusLabel + '</span>';

  document.getElementById('fattura-detail-content').innerHTML = `
    <div class="fattura-detail-row"><span class="fattura-detail-label">N\u00B0 Fattura</span><span class="fattura-detail-value">${escapeHtml(f.numero || '-')}</span></div>
    <div class="fattura-detail-row"><span class="fattura-detail-label">Data arrivo</span><span class="fattura-detail-value">${arrivoStr}</span></div>
    <div class="fattura-detail-row"><span class="fattura-detail-label">Importo totale</span><span class="fattura-detail-value">\u20AC ${f.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span></div>
    <div class="fattura-detail-row"><span class="fattura-detail-label">Pag. contanti <span style="font-size:10px;color:var(--gray2);">(auto)</span></span><span class="fattura-detail-value">\u20AC ${(f.pagCash || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span></div>
    <div class="fattura-detail-row"><span class="fattura-detail-label">Bonifico/Assegno</span><span class="fattura-detail-value">\u20AC ${(f.pagBonifico || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span></div>
    <div class="fattura-detail-row"><span class="fattura-detail-label">Totale pagato</span><span class="fattura-detail-value" style="color:var(--green)">\u20AC ${(f.pagato || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span></div>
    <div class="fattura-detail-row"><span class="fattura-detail-label">Non pagato</span><span class="fattura-detail-value" style="color:${f.nonPagato > 0 ? 'var(--red)' : 'var(--green)'}">\u20AC ${(f.nonPagato || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span></div>
    <div class="fattura-detail-row"><span class="fattura-detail-label">Ciclo pagamento</span><span class="fattura-detail-value">${cicloStr}</span></div>
    <div class="fattura-detail-row"><span class="fattura-detail-label">Scadenza</span><span class="fattura-detail-value" style="color:${status === 'scaduta' ? 'var(--red)' : 'inherit'}">${scadenzaStr}</span></div>
    ${f.note ? '<div class="fattura-detail-row"><span class="fattura-detail-label">Note</span><span class="fattura-detail-value">' + escapeHtml(f.note) + '</span></div>' : ''}
    <div class="fattura-actions-row">
      <button class="btn-sm blue" data-action="editFattura" data-id="${f.id}">Modifica</button>
      ${f.nonPagato > 0 ? '<button class="btn-sm" style="background:var(--green);color:white;" data-action="registerPayment" data-id="' + f.id + '">Bonifico/Assegno</button>' : ''}
      <button class="btn-sm red" data-action="deleteFattura" data-id="${f.id}">Elimina</button>
    </div>
  `;

  document.getElementById('fattura-detail-overlay').classList.add('show');
}

export function closeFatturaDetail() {
  document.getElementById('fattura-detail-overlay').classList.remove('show');
}

export function closeFatturaDetailOutside(e) {
  if (e.target === e.currentTarget) closeFatturaDetail();
}

export function registerPayment(id) {
  closeFatturaDetail();
  const f = d.fatture.find(x => x.id === id);
  if (!f) return;

  const remaining = f.nonPagato || 0;
  document.getElementById('modal-title').textContent = 'Registra Bonifico/Assegno';
  document.getElementById('modal-input').value = remaining.toFixed(2);
  document.getElementById('modal-input').type = 'number';
  document.getElementById('modal-input').placeholder = 'Importo bonifico/assegno...';
  document.getElementById('modal-input').setAttribute('inputmode', 'decimal');

  const confirmBtn = document.getElementById('modal-overlay').querySelector('.btn-sm.blue');
  confirmBtn.textContent = 'Registra';

  window._paymentModalHandler = () => {
    const val = parseFloat(document.getElementById('modal-input').value) || 0;
    if (val <= 0) { showToast('Inserisci un importo valido', 'warn'); return; }
    f.pagBonifico = (f.pagBonifico || 0) + val;
    fullSave();
    closeModal();
    showToast('Pagamento registrato: \u20AC ' + val.toFixed(2), 'check');
    window._paymentModalHandler = null;
    document.getElementById('modal-input').type = 'text';
    confirmBtn.textContent = 'Aggiungi';
  };

  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('modal-input').focus();
}
