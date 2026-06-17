// ─── Voice Accountant (AI) ───
// "Premi e parla": registra audio → Whisper (STT) → GPT con strumenti per
// eseguire operazioni o rispondere a domande → risposta vocale (TTS).

import { d, fullSave } from './state.js';
import { showToast, escapeHtml } from './modals.js';
import { t, getLang } from './i18n.js';
import { parseDateIT } from './date-utils.js';
import { autoCreateFatturaIfNeeded, getFatturaStatus } from './fatture.js';

const KEY_STORAGE = 'cassa_openai_key';
const CHAT_MODEL = 'gpt-4o-mini';
const STT_MODEL = 'whisper-1';
const TTS_MODEL = 'tts-1';

// ─── Stato runtime ───
let mediaRecorder = null;
let audioChunks = [];
let micStream = null;
let isRecording = false;
let busy = false;
let pendingActions = null;          // azioni in attesa di conferma
let history = [];                   // turni conversazione [{role, content}]
let speechPrimed = false;

const getKey = () => localStorage.getItem(KEY_STORAGE);
const lang = () => (getLang() === 'zh' ? 'zh' : 'it');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ─── Helper date ───
function todayIT() {
  return new Date().toLocaleDateString('it-IT');
}
function isoToIT(iso) {
  if (!iso) return todayIT();
  const m = String(iso).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return todayIT();
  return String(m[3]).padStart(2, '0') + '/' + String(m[2]).padStart(2, '0') + '/' + m[1];
}
const euro = (n) => Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';

// ─── Apertura / chiusura pannello ───
export function openVoiceAssistant() {
  const overlay = document.getElementById('voice-overlay');
  if (!overlay) return;
  overlay.classList.add('show');

  if (!getKey()) {
    setStatus(t('voice.needKey'));
    addBubble('assistant', t('voice.needKeyLong'));
  } else if (history.length === 0) {
    setStatus(t('voice.tapToSpeak'));
    addBubble('assistant', t('voice.greeting'));
  } else {
    setStatus(t('voice.tapToSpeak'));
  }
}

export function closeVoiceAssistant() {
  const overlay = document.getElementById('voice-overlay');
  if (overlay) overlay.classList.remove('show');
  if (isRecording) stopRecording(true);
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}
}

export function closeVoiceOutside(e) {
  if (e.target === document.getElementById('voice-overlay')) closeVoiceAssistant();
}

// ─── Microfono (toggle premi/parla) ───
export async function toggleVoiceRecording() {
  if (busy) return;
  if (!getKey()) {
    showToast(t('voice.needKey'), 'warn');
    return;
  }
  primeSpeech();
  if (isRecording) {
    stopRecording(false);
  } else {
    await startRecording();
  }
}

function pickMime() {
  if (!window.MediaRecorder) return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
  for (const ty of types) {
    try { if (MediaRecorder.isTypeSupported(ty)) return ty; } catch (_) {}
  }
  return '';
}

async function startRecording() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    showToast(t('voice.micDenied'), 'warn');
    addBubble('assistant', t('voice.micDenied'));
    return;
  }
  const mime = pickMime();
  try {
    mediaRecorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
  } catch (e) {
    mediaRecorder = new MediaRecorder(micStream);
  }
  audioChunks = [];
  mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) audioChunks.push(e.data); };
  mediaRecorder.onstop = onRecordingStop;
  mediaRecorder.start();
  isRecording = true;
  setMicState('recording');
  setStatus(t('voice.listening'));
}

function stopRecording(cancel) {
  if (!mediaRecorder) return;
  if (cancel) mediaRecorder.onstop = () => stopTracks();
  try { mediaRecorder.stop(); } catch (_) {}
  isRecording = false;
  setMicState(cancel ? 'idle' : 'thinking');
  if (!cancel) setStatus(t('voice.transcribing'));
}

function stopTracks() {
  if (micStream) { micStream.getTracks().forEach(tr => tr.stop()); micStream = null; }
}

async function onRecordingStop() {
  const blob = new Blob(audioChunks, { type: (mediaRecorder && mediaRecorder.mimeType) || 'audio/webm' });
  stopTracks();
  if (!blob.size) { setMicState('idle'); setStatus(t('voice.tapToSpeak')); return; }

  busy = true;
  try {
    const text = await transcribe(blob);
    if (!text || !text.trim()) {
      setStatus(t('voice.notUnderstood'));
      setMicState('idle');
      busy = false;
      return;
    }
    addBubble('user', text.trim());
    setStatus(t('voice.thinking'));
    await think(text.trim());
  } catch (e) {
    console.error('[voice] error:', e);
    addBubble('assistant', t('voice.error'));
    setStatus(t('voice.tapToSpeak'));
  } finally {
    setMicState('idle');
    busy = false;
  }
}

// ─── Trascrizione (Whisper) ───
async function transcribe(blob) {
  const type = blob.type || '';
  const ext = type.includes('mp4') || type.includes('aac') ? 'mp4'
    : type.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file', blob, 'audio.' + ext);
  form.append('model', STT_MODEL);
  form.append('language', lang());
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + getKey() },
    body: form
  });
  if (!res.ok) throw new Error('STT ' + res.status);
  const json = await res.json();
  return json.text || '';
}

// ─── Snapshot dati per il contesto AI ───
function buildSnapshot() {
  const now = new Date();
  const curKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');

  const agg = { [curKey]: { incassi: 0, spese: 0 }, [prevKey]: { incassi: 0, spese: 0 } };
  (d.log || []).forEach(l => {
    if (!l.d) return;
    const p = l.d.split('/');
    if (p.length !== 3) return;
    const k = p[2] + '-' + p[1];
    if (!agg[k]) return;
    if (l.a >= 0) agg[k].incassi += l.a; else agg[k].spese += Math.abs(l.a);
  });

  const fatture = (d.fatture || []).map(f => ({
    azienda: f.azienda, numero: f.numero || '', importo: f.importo,
    dataArrivo: f.dataArrivo || '', scadenza: f.scadenza || '',
    tipoPagamento: f.tipoPagamento || '', stato: getFatturaStatus(f)
  }));
  const nonPagate = fatture.filter(f => f.stato !== 'pagata');

  const recentLog = (d.log || []).slice(-80).map(l => ({ data: l.d, descrizione: l.v, importo: l.a }));

  return {
    oggi: todayIT(),
    saldo_cassa: round2(d.saldo),
    azienda: d.aziendaData || {},
    fornitori: d.fornitori || [],
    stipendi: d.stipendi || [],
    voci_abituali: d.abit || [],
    categorie_personalizzate: (d.customCats || []).map(c => c.name),
    mese_corrente: { mese: curKey, incassi: round2(agg[curKey].incassi), spese: round2(agg[curKey].spese) },
    mese_precedente: { mese: prevKey, incassi: round2(agg[prevKey].incassi), spese: round2(agg[prevKey].spese) },
    fatture_non_pagate: nonPagate,
    totale_da_pagare: round2(nonPagate.reduce((s, f) => s + (f.importo || 0), 0)),
    ultimi_movimenti: recentLog
  };
}

// ─── Definizione strumenti (function calling) ───
function tools() {
  return [
    {
      type: 'function',
      function: {
        name: 'registra_incasso',
        description: 'Registra un incasso di cassa (entrata). Il contante che entra in cassa = totale - pos. Aumenta il saldo.',
        parameters: {
          type: 'object',
          properties: {
            totale: { type: 'number', description: 'Incasso totale del giorno in euro (scontrino/totale Z)' },
            pos: { type: 'number', description: 'Quota pagata con carta/POS in euro. 0 se non specificato.' },
            data: { type: 'string', description: 'Data in formato YYYY-MM-DD. Vuoto = oggi.' }
          },
          required: ['totale']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'aggiungi_spesa',
        description: 'Registra una spesa/uscita realmente pagata. Riduce il saldo di cassa. Per pagamenti a fornitori usa categoria "fornitori".',
        parameters: {
          type: 'object',
          properties: {
            importo: { type: 'number', description: 'Importo della spesa in euro' },
            categoria: { type: 'string', enum: ['fornitori', 'stipendi', 'abituale', 'libera'], description: 'Tipo di spesa' },
            nome: { type: 'string', description: 'Nome del fornitore / dipendente / voce di spesa' },
            nota: { type: 'string', description: 'Nota opzionale' },
            numero_fattura: { type: 'string', description: 'Numero fattura, solo per categoria fornitori' },
            data: { type: 'string', description: 'Data YYYY-MM-DD. Vuoto = oggi.' }
          },
          required: ['importo', 'categoria']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'crea_fattura',
        description: 'Registra una fattura ricevuta da un fornitore (da pagare o gia pagata). NON cambia il saldo: serve solo a tenere traccia nella sezione Fatture. Per un pagamento in contanti immediato usa invece aggiungi_spesa.',
        parameters: {
          type: 'object',
          properties: {
            fornitore: { type: 'string', description: 'Nome del fornitore' },
            importo: { type: 'number', description: 'Importo della fattura in euro' },
            numero: { type: 'string', description: 'Numero fattura' },
            data: { type: 'string', description: 'Data fattura YYYY-MM-DD. Vuoto = oggi.' },
            scadenza: { type: 'string', description: 'Data di scadenza YYYY-MM-DD' },
            tipo_pagamento: { type: 'string', enum: ['contanti', 'bonifico', 'assegno'] },
            pagata: { type: 'boolean', description: 'true se gia pagata' }
          },
          required: ['fornitore', 'importo']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'segna_fattura_pagata',
        description: 'Segna come pagata una fattura gia esistente, identificandola per numero e/o fornitore.',
        parameters: {
          type: 'object',
          properties: {
            fornitore: { type: 'string' },
            numero: { type: 'string' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'imposta_saldo',
        description: 'Imposta o corregge manualmente il saldo di cassa al valore indicato.',
        parameters: {
          type: 'object',
          properties: { saldo: { type: 'number', description: 'Nuovo saldo di cassa in euro' } },
          required: ['saldo']
        }
      }
    }
  ];
}

function systemPrompt() {
  const replyLang = lang() === 'zh' ? 'cinese (中文)' : 'italiano';
  return 'Sei il contabile personale dell\'utente dentro l\'app "Cassa Smart Pro", un gestionale di cassa. '
    + 'Parli in ' + replyLang + ', in modo breve, cordiale e diretto: la tua risposta verra letta ad alta voce, quindi niente elenchi lunghi, niente markdown, frasi parlate. '
    + 'Hai a disposizione gli strumenti per eseguire operazioni (registrare incassi, spese, fatture, ecc.). '
    + 'Quando l\'utente chiede di registrare/aggiungere/pagare qualcosa, chiama lo strumento giusto. '
    + 'Se manca un dato essenziale (es. l\'importo), NON inventarlo: chiedi all\'utente. '
    + 'Per le domande sui conti (saldo, spese del mese, fatture da pagare...) rispondi usando i DATI forniti, senza chiamare strumenti. '
    + 'Tutti gli importi sono in euro. Oggi e ' + todayIT() + '.';
}

// ─── "Cervello": chiamata al modello ───
async function think(userText) {
  history.push({ role: 'user', content: userText });
  if (history.length > 12) history = history.slice(-12);

  const messages = [
    { role: 'system', content: systemPrompt() },
    { role: 'system', content: 'DATI CONTABILI ATTUALI (JSON):\n' + JSON.stringify(buildSnapshot()) },
    ...history
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getKey() },
    body: JSON.stringify({ model: CHAT_MODEL, temperature: 0.2, messages, tools: tools(), tool_choice: 'auto' })
  });
  if (!res.ok) throw new Error('chat ' + res.status);
  const json = await res.json();
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new Error('no message');

  const calls = msg.tool_calls || [];
  if (calls.length > 0) {
    // Azioni proposte → richiedono conferma
    const actions = calls.map(c => {
      let args = {};
      try { args = JSON.parse(c.function.arguments || '{}'); } catch (_) {}
      return { name: c.function.name, args };
    }).filter(a => a.name);
    if (msg.content) addBubble('assistant', msg.content);
    proposeActions(actions);
  } else {
    const answer = (msg.content || '').trim() || t('voice.notUnderstood');
    history.push({ role: 'assistant', content: answer });
    addBubble('assistant', answer);
    speak(answer);
    setStatus(t('voice.tapToSpeak'));
  }
}

// ─── Conferma azioni ───
function describeAction(a) {
  const g = a.args || {};
  switch (a.name) {
    case 'registra_incasso': {
      const cash = round2((g.totale || 0) - (g.pos || 0));
      return t('voice.act.incasso')
        .replace('{cash}', euro(cash))
        .replace('{tot}', euro(g.totale || 0))
        .replace('{pos}', euro(g.pos || 0));
    }
    case 'aggiungi_spesa':
      return t('voice.act.spesa')
        .replace('{importo}', euro(g.importo || 0))
        .replace('{nome}', g.nome || g.categoria || '');
    case 'crea_fattura':
      return t('voice.act.fattura')
        .replace('{importo}', euro(g.importo || 0))
        .replace('{fornitore}', g.fornitore || '');
    case 'segna_fattura_pagata':
      return t('voice.act.pagata').replace('{rif}', g.numero || g.fornitore || '');
    case 'imposta_saldo':
      return t('voice.act.saldo').replace('{saldo}', euro(g.saldo || 0));
    default:
      return a.name;
  }
}

function proposeActions(actions) {
  pendingActions = actions;
  const box = document.getElementById('voice-confirm');
  if (!box) return;
  const list = actions.map(a => '<div class="voice-confirm-item">• ' + escapeHtml(describeAction(a)) + '</div>').join('');
  box.innerHTML =
    '<div class="voice-confirm-q">' + escapeHtml(t('voice.confirmTitle')) + '</div>'
    + list
    + '<div class="voice-confirm-actions">'
    + '<button class="voice-btn cancel" data-action="cancelVoiceAction">' + escapeHtml(t('voice.cancel')) + '</button>'
    + '<button class="voice-btn ok" data-action="confirmVoiceAction">' + escapeHtml(t('voice.confirm')) + '</button>'
    + '</div>';
  box.style.display = 'block';
  setStatus(t('voice.confirmTitle'));
  speak(t('voice.confirmSpoken'));
  scrollConvo();
}

export function cancelVoiceAction() {
  pendingActions = null;
  hideConfirm();
  addBubble('assistant', t('voice.cancelled'));
  speak(t('voice.cancelled'));
  setStatus(t('voice.tapToSpeak'));
}

export function confirmVoiceAction() {
  if (!pendingActions) return;
  const results = pendingActions.map(a => execAction(a.name, a.args));
  pendingActions = null;
  hideConfirm();
  fullSave();
  const msg = results.filter(Boolean).join(' ');
  const spoken = msg || t('voice.done');
  history.push({ role: 'assistant', content: spoken });
  addBubble('assistant', spoken);
  speak(spoken);
  setStatus(t('voice.tapToSpeak'));
}

function hideConfirm() {
  const box = document.getElementById('voice-confirm');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}

// ─── Esecutori azioni ───
function execAction(name, args) {
  const g = args || {};
  try {
    switch (name) {
      case 'registra_incasso': {
        const tot = round2(g.totale || 0);
        const pos = round2(g.pos || 0);
        const cash = round2(tot - pos);
        const dateIT = isoToIT(g.data);
        d.saldo = round2(d.saldo + cash);
        d.log.push({ d: dateIT, v: t('fatt.incassoCash') + ' (' + t('incassi.totaleLabel') + ':' + tot + ' POS:' + pos + ')', a: cash });
        return t('voice.res.incasso').replace('{cash}', euro(cash));
      }
      case 'aggiungi_spesa': {
        const importo = round2(g.importo || 0);
        if (importo <= 0) return t('voice.res.invalid');
        const catMap = { fornitori: 'fornitori', stipendi: 'stipendi', abituale: 'abit', libera: 'libera' };
        const cat = catMap[g.categoria] || 'libera';
        const nome = (g.nome || '').trim();
        const dateIT = isoToIT(g.data);
        const typeLabel = cat === 'fornitori' ? t('exp.fornitore')
          : cat === 'stipendi' ? t('exp.stipendio') : t('exp.expense');
        const label = nome || t('exp.genericExpense');
        const desc = typeLabel + ': ' + label + (g.nota ? ' (' + g.nota + ')' : '');
        const entry = { d: dateIT, v: desc, a: -importo };
        if (g.numero_fattura) entry.fatt = String(g.numero_fattura).trim();
        d.saldo = round2(d.saldo - importo);
        d.log.push(entry);
        // Mantieni le rubriche aggiornate
        if (nome && (cat === 'fornitori' || cat === 'stipendi' || cat === 'abit')) {
          if (!d[cat]) d[cat] = [];
          if (!d[cat].some(x => x.toLowerCase() === nome.toLowerCase())) {
            d[cat].push(nome);
            d[cat].sort((a, b) => a.localeCompare(b));
          }
        }
        if (cat === 'fornitori' && nome) {
          autoCreateFatturaIfNeeded(nome, importo, dateIT, g.numero_fattura ? String(g.numero_fattura).trim() : '');
        }
        return t('voice.res.spesa').replace('{importo}', euro(importo)).replace('{nome}', label);
      }
      case 'crea_fattura': {
        const importo = round2(g.importo || 0);
        const fornitore = (g.fornitore || '').trim();
        if (!fornitore || importo <= 0) return t('voice.res.invalid');
        if (!d.fatture) d.fatture = [];
        d.fatture.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          dataArrivo: g.data ? String(g.data) : new Date().toISOString().slice(0, 10),
          azienda: fornitore,
          numero: g.numero ? String(g.numero) : '',
          importo: importo,
          tipoPagamento: g.tipo_pagamento || 'contanti',
          numeroAssegno: '',
          ciclo: '',
          scadenza: g.scadenza ? String(g.scadenza) : '',
          note: '',
          hasPdf: false,
          pagata: g.pagata === true
        });
        if (fornitore) {
          if (!d.fornitori) d.fornitori = [];
          if (!d.fornitori.some(x => x.toLowerCase() === fornitore.toLowerCase())) {
            d.fornitori.push(fornitore);
            d.fornitori.sort((a, b) => a.localeCompare(b));
          }
        }
        return t('voice.res.fattura').replace('{importo}', euro(importo)).replace('{fornitore}', fornitore);
      }
      case 'segna_fattura_pagata': {
        const num = (g.numero || '').trim().toLowerCase();
        const forn = (g.fornitore || '').trim().toLowerCase();
        let target = null;
        if (num) target = (d.fatture || []).find(f => f.numero && f.numero.trim().toLowerCase() === num && !f.pagata);
        if (!target && forn) {
          const cand = (d.fatture || []).filter(f => (f.azienda || '').trim().toLowerCase() === forn && !f.pagata);
          cand.sort((a, b) => (b.dataArrivo || '').localeCompare(a.dataArrivo || ''));
          target = cand[0];
        }
        if (!target) return t('voice.res.notFound');
        target.pagata = true;
        return t('voice.res.pagata').replace('{fornitore}', target.azienda || '');
      }
      case 'imposta_saldo': {
        d.saldo = round2(g.saldo || 0);
        return t('voice.res.saldo').replace('{saldo}', euro(d.saldo));
      }
      default:
        return '';
    }
  } catch (e) {
    console.error('[voice] execAction', name, e);
    return t('voice.error');
  }
}

// ─── Sintesi vocale (TTS) ───
function primeSpeech() {
  if (speechPrimed || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    speechPrimed = true;
  } catch (_) {}
}

function speak(text) {
  if (!text || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang() === 'zh' ? 'zh-CN' : 'it-IT';
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

// ─── UI helpers ───
function setStatus(text) {
  const el = document.getElementById('voice-status');
  if (el) el.textContent = text;
}

function setMicState(state) {
  const btn = document.getElementById('voice-mic-btn');
  if (!btn) return;
  btn.classList.remove('recording', 'thinking');
  if (state === 'recording') btn.classList.add('recording');
  else if (state === 'thinking') btn.classList.add('thinking');
}

function addBubble(role, text) {
  const wrap = document.getElementById('voice-conversation');
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'voice-bubble ' + (role === 'user' ? 'user' : 'assistant');
  div.textContent = text;
  wrap.appendChild(div);
  scrollConvo();
}

function scrollConvo() {
  const wrap = document.getElementById('voice-conversation');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}
