// ─── Fatture (Invoice Tracking) ───

import {
  d, fullSave, fattureFilter, editingFatturaId,
  setFattureFilter, setEditingFatturaId
} from './state.js';
import { showToast, showConfirm, escapeHtml } from './modals.js';
import { toISODate } from './date-utils.js';
import { t } from './i18n.js';
import { jsPDF } from 'jspdf';

let pendingPdf = null;

// ─── Document Scanner: Photo → PDF ───

function scanEnhance(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = 1.4;
  const brightness = 10;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness));
  }
  ctx.putImageData(imageData, 0, 0);
}

function imageToCanvas(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 2048;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        scanEnhance(canvas);
        resolve(canvas);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function canvasToPdf(canvas) {
  const w = canvas.width, h = canvas.height;
  const isPortrait = h >= w;
  const pdf = new jsPDF({ orientation: isPortrait ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 5;
  const ratio = Math.min((pageW - margin * 2) / w, (pageH - margin * 2) / h);
  const imgW = w * ratio, imgH = h * ratio;
  const x = (pageW - imgW) / 2, y = (pageH - imgH) / 2;
  const jpegData = canvas.toDataURL('image/jpeg', 0.85);
  pdf.addImage(jpegData, 'JPEG', x, y, imgW, imgH);
  return pdf.output('datauristring');
}

// ─── AI Invoice Data Extraction ───

async function extractInvoiceData(jpegBase64) {
  const apiKey = localStorage.getItem('cassa_openai_key');
  if (!apiKey) return null;

  const azienda = d.aziendaData || {};
  let contextLine = '';
  if (azienda.nome || azienda.piva) {
    contextLine = `I dati dell'ACQUIRENTE/CLIENTE (da IGNORARE) sono: Nome: "${azienda.nome || ''}", P.IVA: "${azienda.piva || ''}". `;
  }

  const prompt = contextLine +
    'Analizza questa fattura/ricevuta. Estrai SOLO i dati del FORNITORE/VENDITORE (NON quelli dell\'acquirente/cliente). ' +
    'Rispondi SOLO con un oggetto JSON valido, senza markdown o altro testo. ' +
    'Campi: {"azienda":"nome del fornitore","numero":"numero fattura","importo":0,"data":"YYYY-MM-DD","tipoPagamento":"contanti|bonifico|assegno","note":""}. ' +
    'Se un campo non è leggibile lascialo vuoto o 0.';

  try {
    const base64 = jpegBase64.replace(/^data:image\/\w+;base64,/, '');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64, detail: 'low' } }
          ]
        }]
      })
    });

    if (!res.ok) return null;
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error('AI extraction error:', e);
    return null;
  }
}

function applyExtractedData(data) {
  if (!data) return;
  const setIfEmpty = (id, val) => {
    const el = document.getElementById(id);
    if (el && !el.value && val) el.value = val;
  };
  setIfEmpty('fatt-azienda', data.azienda);
  setIfEmpty('fatt-numero', data.numero);
  if (data.importo > 0) setIfEmpty('fatt-importo', data.importo);
  if (data.data) setIfEmpty('fatt-data-arrivo', data.data);
  if (data.tipoPagamento) {
    const el = document.getElementById('fatt-tipo-pagamento');
    if (el && !el.value) {
      el.value = data.tipoPagamento;
      // Trigger assegno group toggle
      el.dispatchEvent(new Event('change'));
    }
  }
  if (data.note) setIfEmpty('fatt-note', data.note);
}

export function triggerFatturaPhoto() {
  document.getElementById('fatt-photo-input').click();
}

export async function handleFatturaPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  const spinner = document.getElementById('scan-spinner');
  if (spinner) spinner.style.display = 'flex';

  try {
    const canvas = await imageToCanvas(file);
    const jpegBase64 = canvas.toDataURL('image/jpeg', 0.85);

    // Run PDF generation + AI extraction in parallel
    const pdfPromise = Promise.resolve(canvasToPdf(canvas));
    const aiPromise = extractInvoiceData(jpegBase64).catch(() => null);

    const [pdfResult, aiResult] = await Promise.all([pdfPromise, aiPromise]);

    pendingPdf = pdfResult;
    const preview = document.getElementById('fatt-pdf-preview');
    if (preview) preview.style.display = 'flex';

    if (aiResult) {
      applyExtractedData(aiResult);
      showToast(t('ocr.extracted'), 'check');
    } else {
      showToast(t('fatt.scanDone'), 'check');
    }
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

export function removeFatturaPhoto() {
  pendingPdf = null;
  document.getElementById('fatt-pdf-preview').style.display = 'none';
  document.getElementById('fatt-photo-input').value = '';
}

export function downloadFatturaPdf(id) {
  const f = d.fatture.find(x => x.id === id);
  if (!f) return;
  const pdfData = f.pdf || f.foto;
  if (!pdfData) { showToast(t('fatt.noPdf'), 'warn'); return; }

  const fileName = 'fattura_' + (f.azienda || 'doc').replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_') + (f.numero ? '_' + f.numero : '') + '.pdf';

  if (pdfData.startsWith('data:application/pdf')) {
    // It's a PDF data URI — download directly
    const link = document.createElement('a');
    link.href = pdfData;
    link.download = fileName;
    link.click();
  } else {
    // Legacy: it's a photo (base64 JPEG) — convert to PDF on the fly
    const img = new Image();
    img.onload = () => {
      const isPortrait = img.height >= img.width;
      const pdf = new jsPDF({ orientation: isPortrait ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const ratio = Math.min((pageW - margin * 2) / img.width, (pageH - margin * 2) / img.height);
      const imgW = img.width * ratio;
      const imgH = img.height * ratio;
      pdf.addImage(pdfData, 'JPEG', (pageW - imgW) / 2, (pageH - imgH) / 2, imgW, imgH);
      pdf.save(fileName);
    };
    img.src = pdfData;
  }
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
    pdf: null,
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

    // PDF/Photo
    if (f.pdf || f.foto) {
      pendingPdf = f.pdf || f.foto;
      document.getElementById('fatt-pdf-preview').style.display = 'flex';
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
  pendingPdf = null;
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
    pdf: pendingPdf || null,
    foto: null,
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
  renderDueWarningCard();
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

  if (f.pdf || f.foto) {
    rows += `<div class="fattura-detail-row">
      <span class="fattura-detail-label">${t('fatt.pdfLabel')}</span>
      <button class="btn-sm blue" data-action="downloadFatturaPdf" data-id="${f.id}" style="font-size:13px;padding:6px 14px;">
        <span style="display:flex;align-items:center;gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          ${t('fatt.downloadPdf')}
        </span>
      </button>
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

// ─── Due Date Notifications ───

export function getUpcomingDueFatture() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  return (d.fatture || []).filter(f => {
    if (f.pagata === true) return false;
    if (!f.scadenza) return false;
    const due = new Date(f.scadenza); due.setHours(0, 0, 0, 0);
    return due <= in7;
  }).sort((a, b) => (a.scadenza || '').localeCompare(b.scadenza || ''));
}

export function updateFattureTabBadge() {
  const badge = document.getElementById('fatture-tab-badge');
  if (!badge) return;
  const upcoming = getUpcomingDueFatture();
  if (upcoming.length > 0) {
    badge.textContent = upcoming.length;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

export function renderDueWarningCard() {
  const container = document.getElementById('fatt-due-warning');
  if (!container) return;
  const upcoming = getUpcomingDueFatture();
  if (upcoming.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const items = upcoming.slice(0, 5).map(f => {
    const due = new Date(f.scadenza); due.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    const isOverdue = daysLeft < 0;
    const label = isOverdue
      ? t('fatt.overdue', { n: Math.abs(daysLeft) })
      : (daysLeft === 0 ? t('fatt.dueToday') : t('fatt.dueInDays', { n: daysLeft }));
    return `
      <div class="due-warning-item" data-action="openFatturaDetail" data-id="${f.id}">
        <div class="due-warning-dot ${isOverdue ? 'overdue' : 'soon'}"></div>
        <div class="due-warning-info">
          <div class="due-warning-name">${escapeHtml(f.azienda || '-')}</div>
          <div class="due-warning-date">${label}</div>
        </div>
        <div class="due-warning-amount">€ ${(f.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
      </div>`;
  }).join('');
  container.innerHTML = `
    <div class="due-warning-header">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:15px;height:15px;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>${t('fatt.dueWarningTitle', { n: upcoming.length })}</span>
    </div>
    ${items}`;
}
