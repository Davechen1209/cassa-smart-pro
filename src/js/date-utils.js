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
  return cumulative;
}

export function parseFlexDate(str) {
  let m;
  m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[3];
  m = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) return m[3].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[1];
  return str;
}
