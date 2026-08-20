// ─── Date Utilities ───

import { d } from './state.js';

export function toISODate(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function formatDateDisplay(date) {
  const opts = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' };
  const s = date.toLocaleDateString('it-IT', opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isToday(date) {
  const t = new Date();
  return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
}

export function parseDateIT(str) {
  const p = str.split('/');
  return new Date(p[2], p[1] - 1, p[0]);
}

export function calcSaldoAtDate(targetDate) {
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);
  let base = d.saldo;
  d.log.forEach(l => { base -= l.a; });
  let cumulative = base;
  d.log.forEach(l => {
    if (parseDateIT(l.d) <= end) cumulative += l.a;
  });
  return Math.round(cumulative * 100) / 100;
}

export function parseFlexDate(str) {
  let m;
  m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[3];
  m = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) return m[3].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[1];
  return str;
}

// Le date del log sono sempre in formato DD/MM/YYYY. Chi deve raggruppare per
// mese usa questo helper: `substring(0, 7)` sembra dare "YYYY-MM" ma su
// "01/06/2025" produce "01/06/2", una chiave per giorno invece che per mese.
export function monthKeyOf(dateStr) {
  const p = String(dateStr || '').split('/');
  if (p.length !== 3) return null;
  return p[2] + '-' + p[1];
}

// "DD/MM/YYYY" -> "YYYY-MM-DD", per confronti e ordinamenti lessicografici.
export function isoOf(dateStr) {
  const p = String(dateStr || '').split('/');
  if (p.length !== 3) return null;
  return p[2] + '-' + p[1] + '-' + p[0];
}
