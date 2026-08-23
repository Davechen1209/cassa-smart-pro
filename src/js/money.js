// ─── Lettura degli importi digitati ───
// I campi importo erano <input type="number">, che accetta solo il punto come
// separatore decimale: digitando "1234,56" il valore letto e' vuoto. Su un
// telefono italiano la tastiera decimale offre la virgola, quindi si finiva per
// scrivere "123456" e registrare 123.456 euro invece di 1.234,56 — in silenzio.
// Ora i campi sono di testo con tastiera numerica e passano di qui.
//
// Il parser e' quello dell'app fatture: gestisce "1.234,56", "1234,56",
// "1234.56" e il caso ambiguo "1.234", e distingue la convenzione italiana da
// quella cinese. Averne uno solo evita che le due meta' dell'app interpretino
// gli stessi tasti in modo diverso.

import { Store as HkStore } from './fatture-app/hk-store.js';
import { getLang } from './i18n.js';

/** Testo digitato -> euro. Restituisce 0 se non e' un importo valido. */
export function parseImporto(testo) {
  const cents = HkStore.parseAmount(testo, getLang() === 'zh' ? 'zh' : 'it');
  return cents == null ? 0 : cents / 100;
}

/** Come parseImporto, ma distingue "campo vuoto/non valido" da "zero". */
export function parseImportoOrNull(testo) {
  const cents = HkStore.parseAmount(testo, getLang() === 'zh' ? 'zh' : 'it');
  return cents == null ? null : cents / 100;
}
