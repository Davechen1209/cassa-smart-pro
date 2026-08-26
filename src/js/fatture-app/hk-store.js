/* Storage layer: localStorage persistence, seed bootstrap, CRUD, money helpers, status engine. */
export const Store = (function () {
  "use strict";

  var KEY = "huokuan.app.v1";
  var CORRUPT_KEY = "huokuan.app.v1.corrupt";
  var DEFAULT_BANK_URL = "https://www.inbank.it/go/99999"; // user's home banking; editable in Dati

  /* ---------- cloud e vista condivisa ---------- */
  // L'archivio di chi guarda i dati di un altro sta in una chiave separata,
  // come fa la cassa con cassa_v6 / cassa_v6_shared: i propri dati non vengono
  // mai toccati mentre si e' in vista condivisa.
  var SHARED_KEY = "huokuan.app.v1.shared";
  var sharedMode = false;
  var onSaveHook = null;
  // Mentre si applica cio' che arriva dal cloud non si risale al cloud:
  // altrimenti ogni ricezione farebbe partire una scrittura.
  var applyingRemote = false;

  function activeKey() {
    return sharedMode ? SHARED_KEY : KEY;
  }

  function setSharedMode(on) {
    var next = !!on;
    if (next === sharedMode) return;
    sharedMode = next;
    if (!sharedMode) {
      try { localStorage.removeItem(SHARED_KEY); } catch (e) { /* ignore */ }
    }
    load();
  }

  function setOnSave(fn) {
    onSaveHook = fn;
  }

  // Sostituisce i record con quelli arrivati dal cloud, conservando le
  // preferenze locali (lingua, link della banca) che sono di questo device.
  function applyRemote(records) {
    applyingRemote = true;
    try {
      var meta = state.meta;
      var used = {};
      var i = 0;
      state.records = (records || []).map(function (r) {
        i++;
        var rec = normalizeRecord(r, i);
        if (used[rec.id]) {
          var n = i;
          while (used["r" + String(n).padStart(4, "0")]) n++;
          rec.id = "r" + String(n).padStart(4, "0");
        }
        used[rec.id] = true;
        return rec;
      });
      state.meta = meta;
      state.meta.nextId = maxIdNum(state.records) + 1;
      save();
    } finally {
      applyingRemote = false;
    }
  }

  /* ---------- money helpers (integer cents) ---------- */

  function toCents(euros) {
    var n = Number(euros);
    if (!isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function fromCents(cents) {
    return (cents | 0) === cents ? cents / 100 : Number(cents) / 100;
  }

  /* Accepts "1.234,56", "1234,56", "1234.56", "1234" -> cents (integer) or null if invalid.
     Optional locale ("it" default, "zh"): decides which separator is the thousands
     separator in the ambiguous "1.234" / "1,234" case (it: dot groups, zh: comma groups). */
  function parseAmount(str, locale) {
    if (typeof str === "number") return isFinite(str) ? Math.round(str * 100) : null;
    if (str == null) return null;
    var s = String(str).trim().replace(/[€\s ]/g, "");
    if (!s) return null;
    var neg = false;
    if (s.charAt(0) === "-") { neg = true; s = s.slice(1); }
    if (!/^[\d.,]+$/.test(s)) return null;
    var zh = locale === "zh";
    var thouChar = zh ? "," : ".";
    var decChar = zh ? "." : ",";
    var lastComma = s.lastIndexOf(",");
    var lastDot = s.lastIndexOf(".");
    var sep = Math.max(lastComma, lastDot);
    var intPart, decPart;
    if (sep === -1) {
      intPart = s; decPart = "";
    } else {
      var tail = s.slice(sep + 1);
      // If the last separator is the locale's grouping char, the tail is exactly 3 digits
      // and the locale's decimal char is absent, it is ambiguous ("1.234" it / "1,234" zh):
      // treat as thousands separator.
      if (s.charAt(sep) === thouChar && s.indexOf(decChar) === -1 && tail.length === 3 &&
          (s.indexOf(thouChar) !== sep || /^\d{1,3}$/.test(s.slice(0, sep).split(thouChar).join("")))) {
        intPart = s; decPart = "";
      } else {
        intPart = s.slice(0, sep); decPart = tail;
      }
    }
    intPart = intPart.replace(/[.,]/g, "");
    if (decPart && !/^\d{1,4}$/.test(decPart)) return null;
    if (!/^\d*$/.test(intPart)) return null;
    if (!intPart && !decPart) return null;
    var decCents = decPart ? Math.round(parseInt((decPart + "000").slice(0, 3), 10) / 10) : 0;
    var cents = (parseInt(intPart || "0", 10) * 100) + decCents;
    if (!isFinite(cents)) return null;
    return neg ? -cents : cents;
  }

  /* ---------- dates ---------- */

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function addDaysISO(iso, days) {
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function diffDaysISO(a, b) { // b - a in days
    var pa = a.split("-"), pb = b.split("-");
    var da = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]);
    var db = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }

  function isValidISO(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  /* ---------- status engine ---------- */
  /* Record uses euros (numbers) for amount/paidCash/paidOther; all math via cents. */

  function recCents(rec) {
    var amount = toCents(rec.amount || 0);
    var paid = toCents(rec.paidCash || 0) + toCents(rec.paidOther || 0);
    return { amount: amount, paid: paid, unpaid: amount - paid };
  }

  function computeStatus(rec, today) {
    today = today || todayISO();
    var c = recCents(rec);
    if (c.unpaid <= 0) return "paid";
    var overdue = false;
    if (rec.dueDate && isValidISO(rec.dueDate)) {
      if (rec.dueDate < today) overdue = true;
    } else if (rec.oldDebt) {
      overdue = true;
    }
    if (overdue) return "overdue";
    if (c.paid > 0 && c.paid < c.amount) return "partial";
    return "open";
  }

  function dedupKey(rec) {
    return String(rec.supplier || "").trim().toLowerCase() + "|" +
      (rec.arrivalDate || "") + "|" +
      toCents(rec.amount || 0) + "|" +
      String(rec.invoice || "").trim().toLowerCase();
  }

  /* ---------- persistence ---------- */

  var state = null;
  var corruptRecovered = false;
  var quotaError = false;

  function blankState() {
    return { records: [], meta: { schemaVersion: 1, nextId: 1, lang: null, seedBannerCount: null, bankUrl: DEFAULT_BANK_URL } };
  }

  /* I pagamenti datati: [{ date: "YYYY-MM-DD", cash, other }].
     paidCash/paidOther restano i totali che comandano — tutto il resto del
     programma li legge — e questi sono il dettaglio di quando sono entrati.
     Un archivio che viene da prima non ha date: quella parte di pagato resta
     "senza data" ed e' la differenza fra i totali e la somma di qui, cosi'
     i conti tornano sempre senza inventare un giorno che nessuno ha scritto. */
  function normalizePayments(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (p) {
      if (!p || typeof p !== "object") return;
      if (!isValidISO(p.date)) return;
      var cash = toCents(p.cash || 0);
      var other = toCents(p.other || 0);
      if (cash === 0 && other === 0) return;
      out.push({ date: p.date, cash: fromCents(cash), other: fromCents(other) });
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }

  /* Quanto del pagato porta una data. */
  function paidDatedCents(rec) {
    return normalizePayments(rec && rec.payments).reduce(function (s, p) {
      return s + toCents(p.cash) + toCents(p.other);
    }, 0);
  }

  /* Pagato in un intervallo, per i report. */
  function paidInRangeCents(rec, fromISO, toISO) {
    return normalizePayments(rec && rec.payments).reduce(function (s, p) {
      if (p.date < fromISO || p.date > toISO) return s;
      return s + toCents(p.cash) + toCents(p.other);
    }, 0);
  }

  /* Somma un pagamento datato al record, tenendo allineati i totali. */
  function conPagamento(rec, dateISO, cents, metodo) {
    var upd = {};
    for (var k in rec) upd[k] = rec[k];
    if (metodo === "cash") upd.paidCash = (toCents(rec.paidCash) + cents) / 100;
    else upd.paidOther = (toCents(rec.paidOther) + cents) / 100;
    var lista = normalizePayments(rec.payments).slice();
    if (isValidISO(dateISO) && cents > 0) {
      lista.push({
        date: dateISO,
        cash: metodo === "cash" ? cents / 100 : 0,
        other: metodo === "cash" ? 0 : cents / 100
      });
    }
    upd.payments = lista;
    return upd;
  }

  /* Il modulo cambia i totali a mano: qui il dettaglio datato viene riportato
     dentro i totali nuovi. Se il pagato cresce, la differenza diventa un
     pagamento con la data indicata; se cala, si tagliano i piu' recenti. */
  function riconciliaPagamenti(payments, nuovoPagatoCents, dataDelta, metodo) {
    var lista = normalizePayments(payments).slice();
    var datati = lista.reduce(function (s, p) { return s + toCents(p.cash) + toCents(p.other); }, 0);
    var diff = nuovoPagatoCents - datati;
    if (diff > 0) {
      if (isValidISO(dataDelta)) {
        lista.push({
          date: dataDelta,
          cash: metodo === "cash" ? diff / 100 : 0,
          other: metodo === "cash" ? 0 : diff / 100
        });
      }
      return normalizePayments(lista);
    }
    // il pagato e' sceso sotto quanto risulta datato: si tolgono gli ultimi
    var daTogliere = -diff;
    for (var i = lista.length - 1; i >= 0 && daTogliere > 0; i--) {
      var pc = toCents(lista[i].cash), po = toCents(lista[i].other);
      var tot = pc + po;
      if (tot <= daTogliere) { daTogliere -= tot; lista.splice(i, 1); continue; }
      var resta = tot - daTogliere;
      var quotaCash = Math.min(pc, resta);
      lista[i] = { date: lista[i].date, cash: quotaCash / 100, other: (resta - quotaCash) / 100 };
      daTogliere = 0;
    }
    return normalizePayments(lista);
  }

  function normalizeRecord(r, idNum) {
    return {
      id: typeof r.id === "string" && /^r\d{4,}$/.test(r.id) ? r.id : ("r" + String(idNum).padStart(4, "0")),
      arrivalDate: isValidISO(r.arrivalDate) ? r.arrivalDate : null,
      supplier: String(r.supplier == null ? "" : r.supplier),
      invoice: String(r.invoice == null ? "" : r.invoice),
      amount: fromCents(toCents(r.amount || 0)),
      paidCash: fromCents(toCents(r.paidCash || 0)),
      paidOther: fromCents(toCents(r.paidOther || 0)),
      terms: String(r.terms == null ? "" : r.terms),
      dueDate: isValidISO(r.dueDate) ? r.dueDate : null,
      notes: String(r.notes == null ? "" : r.notes),
      oldDebt: !!r.oldDebt,
      checkNo: String(r.checkNo == null ? "" : r.checkNo),
      payments: normalizePayments(r.payments),
      createdAt: typeof r.createdAt === "string" ? r.createdAt : todayISO()
    };
  }

  function validState(s) {
    return s && typeof s === "object" && Array.isArray(s.records) && s.meta && typeof s.meta === "object";
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(activeKey()); } catch (e) { raw = null; }
    if (raw != null) {
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      if (validState(parsed)) {
        state = parsed;
        if (!state.meta.nextId || typeof state.meta.nextId !== "number") {
          state.meta.nextId = maxIdNum(state.records) + 1;
        }
        // bankUrl: undefined = never configured -> apply default; null = cleared on purpose -> respect it
        if (!("bankUrl" in state.meta)) state.meta.bankUrl = DEFAULT_BANK_URL;
        return;
      }
      // corrupt payload: keep aside, start clean
      try { localStorage.setItem(CORRUPT_KEY, raw); } catch (e) { /* ignore */ }
      corruptRecovered = true;
    }
    state = blankState();
    // seed bootstrap — skipped after corrupt-storage recovery: the banner promises a
    // clean archive, and silently re-seeding the bundled snapshot would mask the loss.
    if (!corruptRecovered && window.SEED_DATA && Array.isArray(window.SEED_DATA.records) && window.SEED_DATA.records.length) {
      var i = 0;
      state.records = window.SEED_DATA.records.map(function (r) {
        i++;
        return normalizeRecord(r, i);
      });
      state.meta.nextId = maxIdNum(state.records) + 1;
      state.meta.seedBannerCount = state.records.length;
      state.meta.seedImportedOn = window.SEED_DATA.importedOn || null;
    }
    save();
  }

  /* ---------- seed refresh (a newer app/seed.js than the one this archive came from) ---------- */

  function seedRefreshPending() {
    var sd = window.SEED_DATA;
    if (corruptRecovered) return false;
    if (!sd || !Array.isArray(sd.records) || !sd.records.length || !sd.importedOn) return false;
    if (state.meta.seedImportedOn === sd.importedOn) return false;
    if (state.meta.seedRefreshDeclined === sd.importedOn) return false;
    return true;
  }

  function applySeedRefresh() {
    var sd = window.SEED_DATA;
    if (!sd || !Array.isArray(sd.records)) return;
    // keep the archive being replaced recoverable
    try { localStorage.setItem(KEY + ".pre-seed-backup", JSON.stringify(state)); } catch (e) { /* ignore */ }
    replaceAll(sd.records, true);
    state.meta.seedImportedOn = sd.importedOn || null;
    save();
  }

  function declineSeedRefresh() {
    state.meta.seedRefreshDeclined = window.SEED_DATA ? window.SEED_DATA.importedOn : null;
    save();
  }

  function maxIdNum(records) {
    var max = 0;
    for (var i = 0; i < records.length; i++) {
      var m = /^r(\d+)$/.exec(records[i].id || "");
      if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
    }
    return max;
  }

  function save() {
    try {
      localStorage.setItem(activeKey(), JSON.stringify(state));
      quotaError = false;
      // Salvataggio riuscito: il cloud puo' allinearsi. Non durante
      // l'applicazione di dati remoti, ne' in vista condivisa: quei record
      // non sono nostri.
      if (onSaveHook && !applyingRemote && !sharedMode) onSaveHook();
    } catch (e) {
      quotaError = true;
    }
  }

  /* ---------- CRUD ---------- */

  function nextIdStr() {
    var id = "r" + String(state.meta.nextId).padStart(4, "0");
    state.meta.nextId++;
    return id;
  }

  function addRecord(data) {
    var rec = normalizeRecord(data, state.meta.nextId);
    rec.id = nextIdStr();
    rec.createdAt = todayISO();
    state.records.push(rec);
    save();
    return rec;
  }

  function updateRecord(id, data) {
    var idx = indexOf(id);
    if (idx === -1) return null;
    var old = state.records[idx];
    var rec = normalizeRecord(data, 0);
    rec.id = old.id;
    rec.createdAt = old.createdAt;
    state.records[idx] = rec;
    save();
    return rec;
  }

  function deleteRecord(id) {
    var idx = indexOf(id);
    if (idx === -1) return null;
    var rec = state.records.splice(idx, 1)[0];
    save();
    return { record: rec, index: idx };
  }

  function restoreRecord(rec, index) {
    var idx = Math.max(0, Math.min(index == null ? state.records.length : index, state.records.length));
    state.records.splice(idx, 0, rec);
    save();
  }

  function getRecord(id) {
    var idx = indexOf(id);
    return idx === -1 ? null : state.records[idx];
  }

  function indexOf(id) {
    for (var i = 0; i < state.records.length; i++) {
      if (state.records[i].id === id) return i;
    }
    return -1;
  }

  function replaceAll(records, keepMeta) {
    var lang = state.meta.lang;
    state = blankState();
    if (keepMeta) state.meta.lang = lang;
    var used = {};
    var i = 0;
    state.records = (records || []).map(function (r) {
      i++;
      var rec = normalizeRecord(r, i);
      if (used[rec.id]) { // duplicate id in the file: assign the next free sequential id
        var n = i;
        while (used["r" + String(n).padStart(4, "0")]) n++;
        rec.id = "r" + String(n).padStart(4, "0");
      }
      used[rec.id] = true;
      return rec;
    });
    state.meta.nextId = maxIdNum(state.records) + 1;
    save();
  }

  /* Secondary dedup key (supplier|amount|invoice, dates ignored) for rows with a real
     invoice number: catches re-imports where only the dates were edited/derived. */
  function altDedupKey(rec) {
    var inv = String(rec.invoice || "").trim().toLowerCase();
    if (!inv) return null;
    return String(rec.supplier || "").trim().toLowerCase() + "|" + toCents(rec.amount || 0) + "|" + inv;
  }

  function importRecords(rows, skipDuplicates) {
    var existing = {}, existingAlt = {};
    if (skipDuplicates) {
      state.records.forEach(function (r) {
        existing[dedupKey(r)] = true;
        var ak = altDedupKey(r);
        if (ak) existingAlt[ak] = true;
      });
    }
    var imported = 0, skipped = 0;
    rows.forEach(function (row) {
      var key = dedupKey(row);
      var ak = altDedupKey(row);
      if (skipDuplicates && (existing[key] || (ak && existingAlt[ak]))) { skipped++; return; }
      var rec = normalizeRecord(row, state.meta.nextId);
      rec.id = nextIdStr();
      rec.createdAt = todayISO();
      state.records.push(rec);
      existing[key] = true;
      if (ak) existingAlt[ak] = true;
      imported++;
    });
    save();
    return { imported: imported, skipped: skipped };
  }

  function storageBytes() {
    try {
      var raw = localStorage.getItem(KEY) || "";
      return raw.length * 2; // UTF-16 chars
    } catch (e) { return 0; }
  }

  load();

  return {
    KEY: KEY,
    setSharedMode: setSharedMode,
    setOnSave: setOnSave,
    applyRemote: applyRemote,
    state: function () { return state; },
    records: function () { return state.records; },
    meta: function () { return state.meta; },
    save: save,
    load: load,
    addRecord: addRecord,
    updateRecord: updateRecord,
    deleteRecord: deleteRecord,
    restoreRecord: restoreRecord,
    getRecord: getRecord,
    replaceAll: replaceAll,
    importRecords: importRecords,
    toCents: toCents,
    fromCents: fromCents,
    parseAmount: parseAmount,
    recCents: recCents,
    normalizePayments: normalizePayments,
    paidDatedCents: paidDatedCents,
    paidInRangeCents: paidInRangeCents,
    conPagamento: conPagamento,
    riconciliaPagamenti: riconciliaPagamenti,
    computeStatus: computeStatus,
    dedupKey: dedupKey,
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    diffDaysISO: diffDaysISO,
    isValidISO: isValidISO,
    storageBytes: storageBytes,
    corruptRecovered: function () { return corruptRecovered; },
    quotaError: function () { return quotaError; },
    seedRefreshPending: seedRefreshPending,
    applySeedRefresh: applySeedRefresh,
    declineSeedRefresh: declineSeedRefresh
  };
})();
