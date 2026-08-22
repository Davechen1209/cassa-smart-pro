// ─── Voice Accountant (AI) ───
// "Premi e parla": registra audio → Google Gemini (gratis) per trascrizione +
// function calling → esegue operazioni o risponde a domande → voce di risposta
// con la sintesi vocale del browser (TTS gratuito).

import { d, fullSave } from './state.js';
import { showToast, escapeHtml } from './modals.js';
import { t, getLang } from './i18n.js';
import { parseDateIT } from './date-utils.js';

// Google Gemini (piano gratuito).
const KEY_STORAGE = 'cassa_gemini_key';
// Modelli provati in ordine: se il primo non è disponibile sulla chiave, prova il successivo.
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
let workingModel = null; // memorizza il primo modello che ha funzionato

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
  let step = 'STT';
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
    step = 'AI';
    await think(text.trim());
  } catch (e) {
    console.error('[voice] error (' + step + '):', e);
    const where = step === 'STT' ? t('voice.transcribing') : t('voice.thinking');
    addBubble('assistant', t('voice.error') + '\n\n⚠️ [' + where + '] ' + ((e && e.message) || 'errore sconosciuto'));
    setStatus(t('voice.tapToSpeak'));
  } finally {
    setMicState('idle');
    busy = false;
  }
}

// ─── Chiamata Gemini (con fallback di modello) ───
function geminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts || [];
  return parts.filter(p => typeof p.text === 'string').map(p => p.text).join(' ').trim();
}

async function postGemini(model, body) {
  const url = GEMINI_BASE + model + ':generateContent?key=' + encodeURIComponent(getKey());
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    // Errore di rete / CORS / offline
    const err = new Error('Rete non raggiungibile (Gemini). Controlla la connessione.');
    err.network = true;
    throw err;
  }
  if (res.ok) return res.json();
  let detail = '';
  try { detail = (await res.json())?.error?.message || ''; } catch (_) {}
  const err = new Error(detail || ('HTTP ' + res.status));
  err.status = res.status;
  err.modelIssue = res.status === 404 || /not found|not supported|unsupported|model/i.test(detail);
  throw err;
}

async function callGemini(body) {
  // Se conosciamo già un modello funzionante, usiamo quello.
  const order = workingModel ? [workingModel, ...GEMINI_MODELS.filter(m => m !== workingModel)] : GEMINI_MODELS;
  let lastErr = null;
  for (const model of order) {
    try {
      const json = await postGemini(model, body);
      workingModel = model;
      return json;
    } catch (e) {
      lastErr = e;
      // Riprova con un altro modello solo se è un problema di disponibilità del modello.
      if (e.modelIssue) continue;
      throw e;
    }
  }
  throw lastErr || new Error('Gemini error');
}

// ─── Audio → WAV (PCM 16-bit, mono): formato compatibile con Gemini su iPhone e desktop ───
async function blobToWavBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    try { ctx.close(); } catch (_) {}
  }
  const len = decoded.length;
  const channels = [];
  for (let c = 0; c < decoded.numberOfChannels; c++) channels.push(decoded.getChannelData(c));
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let c = 0; c < channels.length; c++) s += channels[c][i];
    mono[i] = s / channels.length;
  }
  const sampleRate = decoded.sampleRate;
  const dataSize = len * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  let o = 0;
  const ws = (str) => { for (let i = 0; i < str.length; i++) view.setUint8(o++, str.charCodeAt(i)); };
  ws('RIFF'); view.setUint32(o, 36 + dataSize, true); o += 4; ws('WAVE'); ws('fmt ');
  view.setUint32(o, 16, true); o += 4; view.setUint16(o, 1, true); o += 2; view.setUint16(o, 1, true); o += 2;
  view.setUint32(o, sampleRate, true); o += 4; view.setUint32(o, sampleRate * 2, true); o += 4;
  view.setUint16(o, 2, true); o += 2; view.setUint16(o, 16, true); o += 2; ws('data');
  view.setUint32(o, dataSize, true); o += 4;
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2;
  }
  const bytes = new Uint8Array(ab);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// ─── Trascrizione (Gemini, audio multimodale) ───
async function transcribe(blob) {
  const b64 = await blobToWavBase64(blob);
  const json = await callGemini({
    contents: [{
      role: 'user',
      parts: [
        { text: 'Trascrivi esattamente questo audio. Rispondi SOLO con il testo trascritto, senza virgolette né commenti.' },
        { inlineData: { mimeType: 'audio/wav', data: b64 } }
      ]
    }],
    generationConfig: { temperature: 0 }
  });
  return geminiText(json);
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
    + 'Hai a disposizione gli strumenti per eseguire operazioni (registrare incassi, spese, ecc.). '
    + 'Quando l\'utente chiede di registrare/aggiungere/pagare qualcosa, chiama lo strumento giusto. '
    + 'Se manca un dato essenziale (es. l\'importo), NON inventarlo: chiedi all\'utente. '
    + 'Per le domande sui conti (saldo, spese del mese...) rispondi usando i DATI forniti, senza chiamare strumenti. '
    + 'Tutti gli importi sono in euro. Oggi e ' + todayIT() + '.';
}

// Converte le definizioni strumenti (formato OpenAI) in functionDeclarations Gemini.
function geminiFunctionDeclarations() {
  return tools().map(tl => ({
    name: tl.function.name,
    description: tl.function.description,
    parameters: upcaseSchemaTypes(tl.function.parameters)
  }));
}

function upcaseSchemaTypes(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = Array.isArray(schema) ? [] : {};
  for (const k in schema) {
    if (k === 'type' && typeof schema[k] === 'string') out[k] = schema[k].toUpperCase();
    else if (k === 'properties' && schema[k] && typeof schema[k] === 'object') {
      out[k] = {};
      for (const p in schema[k]) out[k][p] = upcaseSchemaTypes(schema[k][p]);
    } else if (k === 'items') out[k] = upcaseSchemaTypes(schema[k]);
    else out[k] = schema[k];
  }
  return out;
}

// ─── "Cervello": chiamata a Gemini con function calling ───
async function think(userText) {
  history.push({ role: 'user', content: userText });
  if (history.length > 12) history = history.slice(-12);

  const contents = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }]
  }));

  const json = await callGemini({
    systemInstruction: {
      parts: [{ text: systemPrompt() + '\n\nDATI CONTABILI ATTUALI (JSON):\n' + JSON.stringify(buildSnapshot()) }]
    },
    contents,
    tools: [{ functionDeclarations: geminiFunctionDeclarations() }],
    generationConfig: { temperature: 0.2 }
  });

  const parts = json?.candidates?.[0]?.content?.parts || [];
  const actions = parts
    .filter(p => p.functionCall && p.functionCall.name)
    .map(p => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
  const textMsg = parts.filter(p => typeof p.text === 'string').map(p => p.text).join(' ').trim();

  if (actions.length > 0) {
    if (textMsg) addBubble('assistant', textMsg);
    proposeActions(actions);
  } else {
    const answer = textMsg || t('voice.notUnderstood');
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
        return t('voice.res.spesa').replace('{importo}', euro(importo)).replace('{nome}', label);
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
