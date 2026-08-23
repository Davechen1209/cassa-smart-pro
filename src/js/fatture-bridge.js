// ─── Ponte fra la cassa e l'archivio fatture ───
// Una spesa a fornitore registrata nella tab Registra esce dalla cassa in
// contanti: nell'archivio fatture le corrisponde una fattura gia' saldata.
// La regola sta qui e non dentro registra(), perche' la stessa spesa puo'
// arrivare anche dal contabile vocale e le due strade devono comportarsi
// allo stesso modo.

import { d, save } from './state.js';
import { Store as HkStore } from './fatture-app/hk-store.js';
import { I18N } from './fatture-app/hk-i18n.js';
import { getLang } from './i18n.js';

// "DD/MM/YYYY" -> "YYYY-MM-DD". Le date del log stanno nel primo formato,
// l'archivio fatture nel secondo.
function toISO(dateIT) {
  const p = String(dateIT || '').split('/');
  if (p.length !== 3) return null;
  return p[2] + '-' + p[1] + '-' + p[0];
}

// I termini sono testo libero mostrato tal quale: si prende dal dizionario
// dell'app fatture, cosi' seguono la lingua scelta.
function termineContanti() {
  const dict = I18N[getLang()] || I18N.it;
  return dict['method.contanti'] || 'Contanti';
}

/**
 * Registra la fattura corrispondente a una spesa pagata in contanti.
 * Restituisce il record creato, oppure null se non c'era nulla da creare
 * (dati insufficienti, o fattura gia' presente).
 */
export function fatturaDaSpesaContanti({ fornitore, importo, dataIT, numeroFattura, nota }) {
  const nome = String(fornitore || '').trim();
  const arrivalDate = toISO(dataIT);
  if (!nome || !(importo > 0) || !arrivalDate) return null;

  const invoice = String(numeroFattura || '').trim();

  const nuovo = {
    arrivalDate,
    supplier: nome,
    invoice,
    amount: importo,
    // Pagata per intero e in contanti: e' uscita dalla cassa in questo istante.
    paidCash: importo,
    paidOther: 0,
    terms: termineContanti(),
    dueDate: arrivalDate,
    notes: String(nota || ''),
    oldDebt: false,
    checkNo: ''
  };

  // Doppioni: stesso fornitore, stessa data, stesso importo, stesso numero.
  // Il vecchio sistema confrontava solo il numero fattura, e cosi' due spese
  // senza numero finivano sempre per essere considerate distinte.
  const chiave = HkStore.dedupKey(nuovo);
  const esiste = HkStore.records().some(r => HkStore.dedupKey(r) === chiave);
  if (esiste) return null;

  return HkStore.addRecord(nuovo);
}

/**
 * Applica la regola a un elenco di spese in attesa: solo quelle a fornitore
 * diventano fatture. Stipendi e spese abituali non lo sono.
 * Restituisce quante fatture ha creato.
 */
export function fattureDaSpese(spese, dataIT) {
  let creati = 0;
  (spese || []).forEach(e => {
    if (e.cat !== 'fornitori') return;
    const rec = fatturaDaSpesaContanti({
      fornitore: e.name,
      importo: e.amount,
      dataIT,
      numeroFattura: e.fatturaNum,
      nota: e.note
    });
    if (rec) creati++;
  });
  return creati;
}

/**
 * Rubriche fornitori unificate.
 * Erano due elenchi separati: quello della cassa (d.fornitori) e quello che
 * l'app fatture ricava dai propri record. Aggiungendo un fornitore da una
 * parte, dall'altra non compariva.
 */

/** Tutti i fornitori conosciuti, da entrambe le parti, senza doppioni. */
export function fornitoriUnificati() {
  const visti = new Map();
  const aggiungi = (nome) => {
    const n = String(nome || '').trim();
    if (!n) return;
    const k = n.toLowerCase();
    if (!visti.has(k)) visti.set(k, n);
  };
  (d.fornitori || []).forEach(aggiungi);
  HkStore.records().forEach(r => aggiungi(r.supplier));
  return [...visti.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Porta nella rubrica della cassa i fornitori che esistono solo fra le
 * fatture. Restituisce quanti ne ha aggiunti.
 */
export function allineaRubricaFornitori() {
  const presenti = new Set((d.fornitori || []).map(n => n.trim().toLowerCase()));
  let aggiunti = 0;
  HkStore.records().forEach(r => {
    const nome = String(r.supplier || '').trim();
    if (!nome) return;
    if (presenti.has(nome.toLowerCase())) return;
    presenti.add(nome.toLowerCase());
    if (!d.fornitori) d.fornitori = [];
    d.fornitori.push(nome);
    aggiunti++;
  });
  if (aggiunti > 0) {
    d.fornitori.sort((a, b) => a.localeCompare(b));
    save();
  }
  return aggiunti;
}
