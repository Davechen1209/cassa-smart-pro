// ─── Fatture (Invoice Tracking) ───

import {
  d, fullSave, fattureFilter, editingFatturaId,
  setFattureFilter, setEditingFatturaId
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { toISODate } from './date-utils.js';
import { t } from './i18n.js';

let pendingPhoto = null;

// ─── OCR via OpenAI GPT-4o-mini ───

async function ocrFattura(base64DataUrl) {
  const apiKey = localStorage.getItem('cassa_openai_key');
  if (!apiKey) return null;

  const spinner = document.getElementById('ocr-spinner');
  if (spinner) spinner.style.display = 'flex';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Estrai i dati da questa fattura italiana. Rispondi SOLO con un oggetto JSON valido, senza markdown o altro testo. Campi: {"numero":"","azienda":"","importo":0,"data":"YYYY-MM-DD","tipoPagamento":"contanti|bonifico|assegno","note":""}. Se un campo non è leggibile lascialo vuoto o 0.' },
            { type: 'image_url', image_url: { url: base64DataUrl } }
          ]
        }],
        max_tokens: 300
      })
    });

    if (res.status === 401) {
      showToast(t('ocr.invalidKey'), 'warn');
      return null;
    }

    if (!res.ok) {
      showToast(t('ocr.error'), 'warn');
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse JSON from response (handle possible markdown wrapping)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) {
      showToast(t('ocr.error'), 'warn');
    } else {
      showToast(t('ocr.networkError'), 'warn');
    }
    return null;
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

function applyOcrResult(result) {
  if (!result) return;

  if (result.numero) document.getElementById('fatt-numero').value = result.numero;
  if (result.azienda) document.getElementById('fatt-azienda').value = result.azienda;
  if (result.importo && result.importo > 0) document.getElementById('fatt-importo').value = result.importo;
  if (result.data) document.getElementById('fatt-data-arrivo').value = result.data;
  if (result.tipoPagamento && ['contanti', 'bonifico', 'assegno'].includes(result.tipoPagamento)) {
    document.getElementById('fatt-tipo-pagamento').value = result.tipoPagamento;
    toggleAssegnoGroup();
  }
  if (result.note) document.getElementById('fatt-note').value = result.note;

  showToast(t('ocr.success'), 'check');
}

// ─── Photo helpers ───

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function triggerFatturaPhoto() {
  document.getElementById('fatt-photo-input').click();
}

export async function handleFatturaPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  pendingPhoto = await compressImage(file);
  const preview = document.getElementById('fatt-photo-preview');
  document.getElementById('fatt-photo-img').src = pendingPhoto;
  preview.style.display = 'block';

  // OCR: auto-fill fields if API key is configured
  const result = await ocrFattura(pendingPhoto);
  applyOcrResult(result);
}

export function removeFatturaPhoto() {
  pendingPhoto = null;
  document.getElementById('fatt-photo-preview').style.display = 'none';
  document.getElementById('fatt-photo-img').src = '';
  document.getElementById('fatt-photo-input').value = '';
}

// ─── Assegno group toggle ───

export function toggleAssegnoGroup() {
  const tipo = document.getElementById('fatt-tipo-pagamento').value;
  const group = document.getElementById('fatt-assegno-group');
  group.style.display = tipo === 'assegno' ? '' : 'none';
  if (tipo !== 'assegno') {
    document.getElementById('fatt-numero-assegno').value = '';
  }
}

// ─── Retrocompat: old fatture still work ───

export function calcAllFattureCash() {
  if (!d.fatture || d.fatture.length === 0) return;

  // Only process old-schema fatture that have pagBonifico/nonPagato fields
  const oldFatture = d.fatture.filter(f => 'pagBonifico' in f || 'nonPagato' in f);
  if (oldFatture.length === 0) return;

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

  oldFatture.forEach(f => {
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

  const fattureByAzienda = {};
  oldFatture.forEach(f => {
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
    tipoPagamento: 'contanti',
    numeroAssegno: '',
    pagata: true,
    foto: null
  });
}

export function updateFattureAziendaList() {
  const dl = document.getElementById('fatt-azienda-list');
  if (!dl) return;
  dl.innerHTML = (d.fornitori || []).map(f => '<option value="' + escapeHtml(f) + '">').join('');
}

export function getFatturaStatus(f) {
  // Explicit pagata flag (new schema)
  if (f.pagata === true) return 'pagata';
  // Old schema retrocompat
  if ('nonPagato' in f && f.nonPagato <= 0) return 'pagata';
  if (f.scadenza) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(f.scadenza); due.setHours(0, 0, 0, 0);
    if (due < today) return 'scaduta';
    const diff = (due - today) / (1000 * 60 * 60 * 24);
    if (diff <= 7) return 'in_scadenza';
  }
  return 'aperta';
}

export function markFatturaPaid(id) {
  const f = d.fatture.find(x => x.id === id);
  if (!f) return;
  f.pagata = true;
  fullSave();
  closeFatturaDetail();
  renderFatture();
  showToast(t('fatt.markedPaid'), 'check');
}

export function markFatturaUnpaid(id) {
  const f = d.fatture.find(x => x.id === id);
  if (!f) return;
  f.pagata = false;
  fullSave();
  closeFatturaDetail();
  renderFatture();
  showToast(t('fatt.markedUnpaid'), 'check');
}

// ─── Sheet open/close ───

export function openFatturaSheet(id) {
  setEditingFatturaId(id || null);
  const overlay = document.getElementById('fattura-overlay');
  const title = document.getElementById('fattura-sheet-title');
  const btn = document.getElementById('fatt-save-btn');

  updateFattureAziendaList();

  if (id) {
    const f = d.fatture.find(x => x.id === id);
    if (!f) return;
    title.textContent = t('fatt.edit');
    btn.textContent = t('fatt.update');
    document.getElementById('fatt-data-arrivo').value = f.dataArrivo || '';
    document.getElementById('fatt-numero').value = f.numero || '';
    document.getElementById('fatt-azienda').value = f.azienda || '';
    document.getElementById('fatt-importo').value = f.importo || '';
    document.getElementById('fatt-tipo-pagamento').value = f.tipoPagamento || '';
    document.getElementById('fatt-numero-assegno').value = f.numeroAssegno || '';
    document.getElementById('fatt-ciclo').value = f.ciclo || '';
    document.getElementById('fatt-scadenza').value = f.scadenza || '';
    document.getElementById('fatt-note').value = f.note || '';
    toggleAssegnoGroup();

    // Photo
    if (f.foto) {
      pendingPhoto = f.foto;
      document.getElementById('fatt-photo-img').src = f.foto;
      document.getElementById('fatt-photo-preview').style.display = 'block';
    } else {
      removeFatturaPhoto();
    }
  } else {
    title.textContent = t('fatt.new');
    btn.textContent = t('fatt.save');
    document.getElementById('fatt-data-arrivo').value = toISODate(new Date());
    document.getElementById('fatt-numero').value = '';
    document.getElementById('fatt-azienda').value = '';
    document.getElementById('fatt-importo').value = '';
    document.getElementById('fatt-tipo-pagamento').value = '';
    document.getElementById('fatt-numero-assegno').value = '';
    document.getElementById('fatt-ciclo').value = '';
    document.getElementById('fatt-scadenza').value = '';
    document.getElementById('fatt-note').value = '';
    document.getElementById('fatt-assegno-group').style.display = 'none';
    removeFatturaPhoto();
  }
  overlay.classList.add('show');
}

export function closeFatturaSheet() {
  document.getElementById('fattura-overlay').classList.remove('show');
  setEditingFatturaId(null);
  pendingPhoto = null;
}

export function closeFatturaOutside(e) {
  if (e.target === e.currentTarget) closeFatturaSheet();
}

// ─── Save ───

export function saveFattura() {
  const azienda = document.getElementById('fatt-azienda').value.trim();
  const importo = parseFloat(document.getElementById('fatt-importo').value) || 0;
  const tipoPagamento = document.getElementById('fatt-tipo-pagamento').value;
  const numeroAssegno = document.getElementById('fatt-numero-assegno').value.trim();

  if (!azienda) { showToast(t('fatt.enterFornitore'), 'warn'); return; }
  if (importo <= 0) { showToast(t('fatt.invalidAmount'), 'warn'); return; }
  if (tipoPagamento === 'assegno' && !numeroAssegno) { showToast(t('fatt.enterAssegno'), 'warn'); return; }

  // Preserve existing pagata flag when editing
  const existing = editingFatturaId ? d.fatture.find(x => x.id === editingFatturaId) : null;
  const fattura = {
    id: editingFatturaId || Date.now(),
    dataArrivo: document.getElementById('fatt-data-arrivo').value,
    azienda: azienda,
    numero: document.getElementById('fatt-numero').value.trim(),
    importo: importo,
    tipoPagamento: tipoPagamento,
    numeroAssegno: tipoPagamento === 'assegno' ? numeroAssegno : '',
    ciclo: document.getElementById('fatt-ciclo').value,
    scadenza: document.getElementById('fatt-scadenza').value,
    note: document.getElementById('fatt-note').value.trim(),
    foto: pendingPhoto || null,
    pagata: existing ? existing.pagata : false
  };

  if (editingFatturaId) {
    const idx = d.fatture.findIndex(x => x.id === editingFatturaId);
    if (idx >= 0) d.fatture[idx] = fattura;
  } else {
    d.fatture.push(fattura);
  }

  fullSave();
  closeFatturaSheet();
  showToast(editingFatturaId ? t('fatt.updated') : t('fatt.added'), 'check');
}

// ─── Delete ───

export function deleteFattura(id) {
  showConfirm(t('fatt.deleteTitle'), t('fatt.deleteMsg'), () => {
    d.fatture = d.fatture.filter(x => x.id !== id);
    fullSave();
    closeFatturaDetail();
    showToast(t('fatt.deleted'), 'check');
  });
}

// ─── Filter & Render ───

export function filterFatture(filter, targetBtn) {
  setFattureFilter(filter);
  document.querySelectorAll('#fatt-filter .segment-btn').forEach(b => b.classList.remove('active'));
  if (targetBtn) targetBtn.classList.add('active');
  renderFatture();
}

function tipoPagamentoLabel(tipo) {
  if (tipo === 'contanti') return t('fatt.contanti');
  if (tipo === 'bonifico') return t('fatt.bonifico');
  if (tipo === 'assegno') return t('fatt.assegno');
  return '-';
}

export function renderFatture() {
  calcAllFattureCash();
  updateFattureAziendaList();
  const container = document.getElementById('fatture-list');
  if (!d.fatture || d.fatture.length === 0) {
    container.innerHTML = '<div class="fattura-empty">' + t('fatt.empty') + '</div>';
    document.getElementById('fatt-da-pagare').textContent = '\u20AC 0';
    document.getElementById('fatt-scadenza-count').textContent = '0';
    return;
  }

  const sorted = [...d.fatture].sort((a, b) =>
    (b.dataArrivo || '').localeCompare(a.dataArrivo || '')
  );

  let filtered = sorted;
  if (fattureFilter === 'aperte') filtered = sorted.filter(f => getFatturaStatus(f) !== 'pagata');
  else if (fattureFilter === 'pagate') filtered = sorted.filter(f => getFatturaStatus(f) === 'pagata');
  else if (fattureFilter === 'scadute') filtered = sorted.filter(f => getFatturaStatus(f) === 'scaduta');

  // Stats: count unpaid amounts
  const totalUnpaid = d.fatture.reduce((s, f) => {
    if (f.nonPagato > 0) return s + f.nonPagato; // old schema
    if (getFatturaStatus(f) !== 'pagata') return s + (f.importo || 0); // new schema
    return s;
  }, 0);
  const expiringCount = d.fatture.filter(f => {
    const st = getFatturaStatus(f);
    return st === 'scaduta' || st === 'in_scadenza';
  }).length;

  document.getElementById('fatt-da-pagare').textContent = '\u20AC ' + totalUnpaid.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('fatt-scadenza-count').textContent = expiringCount;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="fattura-empty">' + t('fatt.emptyFilter') + '</div>';
    return;
  }

  container.innerHTML = filtered.map(f => {
    const status = getFatturaStatus(f);
    const dotClass = status === 'pagata' ? 'pagata' : (status === 'scaduta' ? 'scaduta' : 'aperta');
    const arrivoStr = f.dataArrivo ? new Date(f.dataArrivo).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
    const metaParts = [];
    if (f.numero) metaParts.push('N\u00B0 ' + escapeHtml(f.numero));
    if (arrivoStr) metaParts.push(arrivoStr);
    if (f.tipoPagamento) metaParts.push(tipoPagamentoLabel(f.tipoPagamento));

    // Status text
    let rightText;
    if ('nonPagato' in f) {
      // Old schema
      rightText = f.nonPagato > 0 ? t('fatt.unpaid') + '\u20AC ' + f.nonPagato.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : t('fatt.paid');
    } else {
      rightText = status === 'pagata' ? t('fatt.paid') : t('fatt.unpaidLabel');
    }

    return `<div class="fattura-item" data-action="openFatturaDetail" data-id="${f.id}">
      <div class="fattura-status-dot ${dotClass}"></div>
      <div class="fattura-info">
        <div class="fattura-company">${escapeHtml(f.azienda)}</div>
        <div class="fattura-meta">${metaParts.join(' \u00B7 ')}</div>
      </div>
      <div class="fattura-amounts">
        <div class="fattura-total">\u20AC ${f.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="fattura-unpaid zero">${rightText}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── Detail view ───

export function openFatturaDetail(id) {
  calcAllFattureCash();
  const f = d.fatture.find(x => x.id === id);
  if (!f) return;

  const status = getFatturaStatus(f);
  const arrivoStr = f.dataArrivo ? new Date(f.dataArrivo).toLocaleDateString('it-IT') : '-';

  document.getElementById('fattura-detail-title').innerHTML = escapeHtml(f.azienda);

  let rows = '';
  rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.numero')}</span><span class="fattura-detail-value">${escapeHtml(f.numero || '-')}</span></div>`;
  rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.data')}</span><span class="fattura-detail-value">${arrivoStr}</span></div>`;
  rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.importo')}</span><span class="fattura-detail-value">\u20AC ${f.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`;

  if (f.tipoPagamento) {
    rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.tipoPagamento')}</span><span class="fattura-detail-value">${tipoPagamentoLabel(f.tipoPagamento)}</span></div>`;
    if (f.tipoPagamento === 'assegno' && f.numeroAssegno) {
      rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.numAssegno')}</span><span class="fattura-detail-value">${escapeHtml(f.numeroAssegno)}</span></div>`;
    }
  } else {
    // Old schema: show legacy payment info
    rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.legacyCash')} <span style="font-size:10px;color:var(--gray2);">${t('fatt.legacyAuto')}</span></span><span class="fattura-detail-value">\u20AC ${(f.pagCash || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`;
    rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.legacyBonifico')}</span><span class="fattura-detail-value">\u20AC ${(f.pagBonifico || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`;
    rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.legacyUnpaid')}</span><span class="fattura-detail-value" style="color:${f.nonPagato > 0 ? 'var(--red)' : 'var(--green)'}">\u20AC ${(f.nonPagato || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`;
  }

  const cicloStr = f.ciclo && f.ciclo !== 'custom' ? f.ciclo + t('fatt.days') : (f.ciclo === 'custom' ? t('fatt.custom') : '-');
  const scadenzaStr = f.scadenza ? new Date(f.scadenza).toLocaleDateString('it-IT') : '-';
  rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.cicloPagamento')}</span><span class="fattura-detail-value">${cicloStr}</span></div>`;
  rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.scadenza')}</span><span class="fattura-detail-value">${scadenzaStr}</span></div>`;
  if (f.note) {
    rows += `<div class="fattura-detail-row"><span class="fattura-detail-label">${t('fatt.note')}</span><span class="fattura-detail-value">${escapeHtml(f.note)}</span></div>`;
  }

  if (f.foto) {
    rows += `<div class="fattura-detail-row" style="flex-direction:column;align-items:flex-start;gap:8px;">
      <span class="fattura-detail-label">${t('fatt.fotoLabel')}</span>
      <img src="${f.foto}" alt="Foto fattura" class="fattura-detail-photo" onclick="window.open(this.src)">
    </div>`;
  }

  // Mark as paid/unpaid button
  if (status === 'pagata') {
    rows += `<div style="margin-top:12px;"><button class="btn-sm gray" data-action="markFatturaUnpaid" data-id="${f.id}" style="width:100%;">${t('fatt.markUnpaid')}</button></div>`;
  } else {
    rows += `<div style="margin-top:12px;"><button class="btn-sm green" data-action="markFatturaPaid" data-id="${f.id}" style="width:100%; background:var(--green); color:#fff;">${t('fatt.markPaid')}</button></div>`;
  }

  rows += `<div class="fattura-actions-row">
    <button class="btn-sm blue" data-action="editFattura" data-id="${f.id}">${t('fatt.modifica')}</button>
    <button class="btn-sm red" data-action="deleteFattura" data-id="${f.id}">${t('fatt.elimina')}</button>
  </div>`;

  document.getElementById('fattura-detail-content').innerHTML = rows;
  document.getElementById('fattura-detail-overlay').classList.add('show');
}

export function closeFatturaDetail() {
  document.getElementById('fattura-detail-overlay').classList.remove('show');
}

export function closeFatturaDetailOutside(e) {
  if (e.target === e.currentTarget) closeFatturaDetail();
}
