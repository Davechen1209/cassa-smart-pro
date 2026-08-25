// ─── Report ───
// Entrate/uscite di un periodo, confronto col periodo precedente equivalente,
// dettaglio per mese, per categoria e per giorno. Solo movimenti di cassa:
// le fatture hanno una loro sezione e qui non entrano.

import { d } from './state.js';
import { t, getLang, translateLogDesc, parseIncasso } from './i18n.js';
import { monthKeyOf, isoOf, parseDateIT, toISODate } from './date-utils.js';
import { escapeHtml } from './modals.js';

let preset = 'thisMonth';
let customFrom = null;
let customTo = null;
let compareMode = 'previous';   // 'previous' | 'lastYear' | 'customCompare'
let compareFrom = null;
let compareTo = null;
let compareMenuOpen = false;

const locale = () => (getLang() === 'zh' ? 'zh-CN' : 'it-IT');

function fmtEuro(n, decimals = 2) {
  return '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtShort(n) {
  return '€' + Math.round(n).toLocaleString('it-IT');
}
function startOfDay(dt) { const x = new Date(dt); x.setHours(0, 0, 0, 0); return x; }

// Sposta di `months` mesi tenendo il giorno, senza scavallare a inizio mese
// successivo quando il mese di arrivo e' piu' corto (31 gennaio -> 28 febbraio).
function addMonths(dt, months) {
  const day = dt.getDate();
  const x = new Date(dt.getFullYear(), dt.getMonth() + months, 1);
  x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return startOfDay(x);
}

// Ogni preset definisce sia il proprio intervallo sia quello con cui ha senso
// confrontarsi: per i mesi si torna indietro di mesi interi, non di giorni,
// altrimenti "1-20 agosto" finirebbe contro "12-31 luglio".
// Periodo principale. Il confronto e' scelto a parte (vedi compareRange):
// "quanto ho fatto quest'anno rispetto all'anno scorso" e "questo giorno
// rispetto allo stesso giorno del 2025" sono domande diverse dallo scorrimento
// automatico all'indietro, e vanno chieste esplicitamente.
function mainRange() {
  const today = startOfDay(new Date());
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  switch (preset) {
    case 'thisMonth':
      return { from: firstOfMonth, to: today };
    case 'lastMonth':
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: new Date(today.getFullYear(), today.getMonth(), 0)
      };
    case 'last3':
      return { from: new Date(today.getFullYear(), today.getMonth() - 2, 1), to: today };
    case 'thisYear':
      return { from: new Date(today.getFullYear(), 0, 1), to: today };
    default:
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : firstOfMonth,
        to: customTo ? startOfDay(new Date(customTo)) : today
      };
  }
}

// Lo scorrimento all'indietro di un periodo: per i preset mensili si torna
// indietro di mesi interi, non di giorni, altrimenti "1-21 agosto" finirebbe
// contro "11-31 luglio" invece che contro "1-21 luglio".
function previousRange(main) {
  switch (preset) {
    case 'thisMonth':
      return { from: addMonths(main.from, -1), to: addMonths(main.to, -1) };
    case 'lastMonth':
      return {
        from: new Date(main.from.getFullYear(), main.from.getMonth() - 1, 1),
        to: new Date(main.from.getFullYear(), main.from.getMonth(), 0)
      };
    case 'last3':
      return { from: addMonths(main.from, -3), to: addMonths(main.to, -3) };
    case 'thisYear':
      return { from: addMonths(main.from, -12), to: addMonths(main.to, -12) };
    default: {
      const days = Math.round((main.to - main.from) / 86400000) + 1;
      const to = new Date(main.from); to.setDate(to.getDate() - 1);
      const from = new Date(to); from.setDate(from.getDate() - days + 1);
      return { from: startOfDay(from), to: startOfDay(to) };
    }
  }
}

function compareRange(main) {
  if (compareMode === 'lastYear') {
    return { from: addMonths(main.from, -12), to: addMonths(main.to, -12) };
  }
  if (compareMode === 'customCompare') {
    const prev = previousRange(main);
    return {
      from: compareFrom ? startOfDay(new Date(compareFrom)) : prev.from,
      to: compareTo ? startOfDay(new Date(compareTo)) : prev.to
    };
  }
  return previousRange(main);
}

export function currentRange() {
  const main = mainRange();
  const cmp = compareRange(main);
  return { from: main.from, to: main.to, prevFrom: cmp.from, prevTo: cmp.to };
}

function logsBetween(from, to) {
  return (d.log || []).filter(l => {
    if (!l.d) return false;
    const dt = parseDateIT(l.d);
    if (isNaN(dt)) return false;
    const day = startOfDay(dt);
    return day >= from && day <= to;
  });
}

// Un'entrata vale il TOTALE battuto, non il solo contante: il contante e'
// TOTALE - POS ed e' l'unico che muove il saldo, ma un report di incassi che
// ignorasse il POS descriverebbe meno della meta' del giro (51% nello storico
// reale). Le entrate senza dettaglio POS valgono per intero come contante.
function incomeOf(l) {
  const inc = parseIncasso(l.v);
  if (inc) return inc;
  return { totale: l.a, pos: 0, cash: l.a };
}

function emptyBucket() {
  return { income: 0, pos: 0, cash: 0, expense: 0 };
}

function accumulate(bucket, l) {
  if (l.a >= 0) {
    const inc = incomeOf(l);
    bucket.income += inc.totale;
    bucket.pos += inc.pos;
    bucket.cash += inc.cash;
  } else {
    bucket.expense += Math.abs(l.a);
  }
}

function withNet(bucket) {
  return { ...bucket, net: bucket.income - bucket.expense };
}

function totals(logs) {
  const b = emptyBucket();
  logs.forEach(l => accumulate(b, l));
  return { ...withNet(b), count: logs.length };
}

function groupBy(logs, keyFn) {
  const map = {};
  logs.forEach(l => {
    const k = keyFn(l);
    if (!k) return;
    if (!map[k]) map[k] = emptyBucket();
    accumulate(map[k], l);
  });
  return Object.keys(map).sort().map(k => ({ key: k, ...withNet(map[k]) }));
}

function byMonth(logs) {
  return groupBy(logs, l => monthKeyOf(l.d));
}

// Giorni con almeno un movimento: la media si fa sui giorni lavorati, non sui
// giorni di calendario, altrimenti chiusure e festivi la falsano.
function byDay(logs) {
  return groupBy(logs, l => isoOf(l.d));
}

function byWeekday(logs) {
  const sums = Array.from({ length: 7 }, () => ({ income: 0, days: new Set() }));
  logs.forEach(l => {
    const dt = parseDateIT(l.d);
    if (isNaN(dt)) return;
    const wd = dt.getDay();
    if (l.a >= 0) sums[wd].income += incomeOf(l).totale;
    sums[wd].days.add(isoOf(l.d));
  });
  return sums.map((s, i) => ({ weekday: i, avg: s.days.size ? s.income / s.days.size : 0 }));
}

// Categoria = quello che sta prima dei ':' nella descrizione ("Fornitori: Tizio").
function categoryOf(l) {
  const translated = translateLogDesc(l.v || '');
  const i = translated.indexOf(':');
  return i > 0 ? translated.substring(0, i).trim() : t('exp.genericExpense');
}

function byCategory(logs) {
  const map = {};
  logs.filter(l => l.a < 0).forEach(l => {
    const c = categoryOf(l);
    map[c] = (map[c] || 0) + Math.abs(l.a);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function getReportData() {
  const r = currentRange();
  const logs = logsBetween(r.from, r.to);
  const prevLogs = logsBetween(r.prevFrom, r.prevTo);
  const days = byDay(logs);
  const sorted = [...days].sort((a, b) => b.income - a.income);
  return {
    range: r,
    now: totals(logs),
    prev: totals(prevLogs),
    months: byMonth(logs),
    categories: byCategory(logs),
    days,
    best: sorted[0] || null,
    worst: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    weekdays: byWeekday(logs)
  };
}

// ─── Rendering ───

const PRESETS = ['thisMonth', 'lastMonth', 'last3', 'thisYear', 'custom'];
const COMPARE_MODES = ['previous', 'lastYear', 'customCompare'];

function monthLabel(key, long = false) {
  const [y, m] = key.split('-');
  return new Date(y, m - 1, 1)
    .toLocaleDateString(locale(), long ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' })
    .replace('.', '');
}

function dayLabel(iso) {
  const [y, m, dd] = iso.split('-');
  return new Date(y, m - 1, dd).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }).replace('.', '');
}

function rangeLabel(r) {
  const o = { day: 'numeric', month: 'short', year: 'numeric' };
  return r.from.toLocaleDateString(locale(), o).replace('.', '') + ' – ' + r.to.toLocaleDateString(locale(), o).replace('.', '');
}

// Variazione rispetto al periodo precedente. Senza una base non esiste una
// percentuale sensata: in quel caso si mostra solo il valore assoluto.
function deltaHtml(now, prev, higherIsBetter = true) {
  const diff = now - prev;
  if (Math.abs(diff) < 0.005) {
    return `<div class="report-delta flat">${t('report.noChange')}</div>`;
  }
  const good = higherIsBetter ? diff > 0 : diff < 0;
  const arrow = diff > 0 ? '↑' : '↓';
  const pct = prev > 0 ? ` (${diff > 0 ? '+' : ''}${(diff / prev * 100).toFixed(0)}%)` : '';
  return `<div class="report-delta ${good ? 'good' : 'bad'}">${arrow} ${fmtShort(Math.abs(diff))}${pct}</div>`;
}

function dateInputs(idPrefix, fromVal, toVal) {
  return `
    <div class="report-custom-range">
      <label>${t('report.from')}<input type="date" id="${idPrefix}-from" class="input-field" value="${fromVal || ''}"></label>
      <label>${t('report.to')}<input type="date" id="${idPrefix}-to" class="input-field" value="${toVal || ''}"></label>
    </div>`;
}

// Una riga sola che scorre in orizzontale: i preset restano tutti a un tocco
// senza occupare mezzo schermo prima del primo numero.
function renderPeriodBar() {
  const chips = PRESETS.map(p =>
    `<button class="report-chip${preset === p ? ' active' : ''}" data-action="reportPreset" data-preset="${p}">${t('report.preset.' + p)}</button>`
  ).join('');

  return `
    <div class="card report-period-card">
      <div class="report-chips-scroll"><div class="report-chips">${chips}</div></div>
      ${preset === 'custom' ? dateInputs('report', customFrom, customTo) : ''}
      <div class="report-range-label">${rangeLabel(currentRange())}</div>
    </div>`;
}

// Il controllo del confronto sta dove se ne legge il risultato: il badge sotto
// le card e' anche il pulsante per cambiarlo.
function renderCompareControl(data) {
  const items = COMPARE_MODES.map(m => `
    <button class="report-compare-item${compareMode === m ? ' active' : ''}" data-action="reportCompare" data-mode="${m}">
      <svg class="report-compare-check${compareMode === m ? '' : ' hidden'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      ${t('report.compare.' + m)}
    </button>`).join('');

  return `
    <div class="report-compare-note">
      <div class="report-compare-wrap${compareMenuOpen ? ' open' : ''}">
        <button class="report-compare-badge" data-action="toggleCompareMenu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3v12"/><path d="m21 11-4 4-4-4"/><path d="M7 21V9"/><path d="m3 13 4-4 4 4"/></svg>
          ${t('report.comparedTo')} <strong>${rangeLabel({ from: data.range.prevFrom, to: data.range.prevTo })}</strong>
          <svg class="report-compare-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="report-compare-menu">
          <div class="report-compare-menu-label">${t('report.compareLabel')}</div>
          ${items}
        </div>
      </div>
    </div>
    ${compareMode === 'customCompare' ? `<div class="report-compare-dates">${dateInputs('report-cmp', compareFrom, compareTo)}</div>` : ''}`;
}

function renderSummary(data) {
  const { now, prev } = data;
  return `
    <div class="report-summary">
      <div class="report-sum-card green">
        <div class="report-sum-label">${t('report.totalTakings')}</div>
        <div class="report-sum-value">${fmtShort(now.income)}</div>
        ${deltaHtml(now.income, prev.income, true)}
      </div>
      <div class="report-sum-card red">
        <div class="report-sum-label">${t('day.shareUscite')}</div>
        <div class="report-sum-value">${fmtShort(now.expense)}</div>
        ${deltaHtml(now.expense, prev.expense, false)}
      </div>
      <div class="report-sum-card ${now.net >= 0 ? 'blue' : 'orange'}">
        <div class="report-sum-label">${t('stats.net')}</div>
        <div class="report-sum-value">${now.net >= 0 ? '+' : '−'}${fmtShort(Math.abs(now.net))}</div>
        ${deltaHtml(now.net, prev.net, true)}
      </div>
    </div>
    ${renderCompareControl(data)}`;
}

// "Quanto del totale e' POS": la barra impilata risponde a colpo d'occhio,
// le cifre sotto danno il dettaglio.
function renderMix(data) {
  const { income, pos, cash } = data.now;
  if (income <= 0) return '';
  const posPct = pos / income * 100;
  const prevPosPct = data.prev.income > 0 ? data.prev.pos / data.prev.income * 100 : null;
  const shift = prevPosPct === null ? '' :
    `<div class="report-mix-shift">${t('report.posBefore')} ${prevPosPct.toFixed(0)}%</div>`;

  return `
    <div class="card">
      <div class="report-section-title">${t('report.mix')}</div>
      <div class="report-mix-bar">
        <div class="report-mix-seg cash" style="width:${(100 - posPct).toFixed(1)}%"></div>
        <div class="report-mix-seg pos" style="width:${posPct.toFixed(1)}%"></div>
      </div>
      <div class="report-mix-rows">
        <div class="report-mix-row">
          <span class="report-dot cash"></span>
          <span class="report-mix-name">${t('report.cash')}</span>
          <span class="report-mix-val">${fmtShort(cash)}<small>${(100 - posPct).toFixed(0)}%</small></span>
        </div>
        <div class="report-mix-row">
          <span class="report-dot pos"></span>
          <span class="report-mix-name">${t('incassi.pos')}</span>
          <span class="report-mix-val">${fmtShort(pos)}<small>${posPct.toFixed(0)}%</small></span>
        </div>
      </div>
      ${shift}
    </div>`;
}

function renderMonthTable(data) {
  if (data.months.length < 2) return '';
  const row = (label, b, cls) => `
    <tr>
      <td class="report-th-month${cls || ''}">${label}</td>
      <td class="report-num green">${fmtShort(b.income)}</td>
      <td class="report-num pos">${fmtShort(b.pos)}<small>${b.income > 0 ? (b.pos / b.income * 100).toFixed(0) + '%' : '–'}</small></td>
      <td class="report-num red">${fmtShort(b.expense)}</td>
      <td class="report-num ${b.net >= 0 ? 'blue' : 'orange'}">${b.net >= 0 ? '+' : '−'}${fmtShort(Math.abs(b.net))}</td>
    </tr>`;
  return `
    <div class="card">
      <div class="report-section-title">${t('report.monthByMonth')}</div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead><tr>
            <th>${t('report.month')}</th>
            <th class="report-num">${t('report.totalTakings')}</th>
            <th class="report-num">${t('report.ofWhichPos')}</th>
            <th class="report-num">${t('day.shareUscite')}</th>
            <th class="report-num">${t('stats.net')}</th>
          </tr></thead>
          <tbody>${data.months.map(m => row(monthLabel(m.key), m)).join('')}</tbody>
          <tfoot>${row(t('report.total'), data.now)}</tfoot>
        </table>
      </div>
    </div>`;
}

function renderTrend(data) {
  // Sotto i due mesi il grafico mensile non direbbe nulla: si mostrano i giorni.
  const series = data.months.length >= 2
    ? data.months.map(m => ({ label: monthLabel(m.key), ...m }))
    : data.days.slice(-14).map(day => ({ label: dayLabel(day.key), ...day }));
  if (series.length < 2) return '';

  const max = Math.max(...series.map(s => Math.max(s.income, s.expense)), 1);
  // Quattordici colonne su un telefono danno 19px a testa, e "12 ago" ne
  // chiede 39: le etichette uscivano tutte tagliate a meta'. Se ne scrive
  // una ogni tanto, sempre compresa l'ultima, e quelle scritte si leggono.
  const passo = Math.max(1, Math.ceil(series.length / 5));
  const bars = series.map((s, i) => {
    const conEtichetta = i % passo === 0 || i === series.length - 1;
    return `
    <div class="report-bar-group">
      <div class="report-bars">
        <div class="report-bar green" style="height:${(s.income / max * 100).toFixed(1)}%" title="${s.label}: ${fmtEuro(s.income)}"></div>
        <div class="report-bar red" style="height:${(s.expense / max * 100).toFixed(1)}%" title="${s.label}: ${fmtEuro(s.expense)}"></div>
      </div>
      <div class="report-bar-label">${conEtichetta ? s.label : ''}</div>
    </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="report-section-title">${data.months.length >= 2 ? t('stats.monthlyTrend') : t('report.dailyTrend')}</div>
      <div class="report-chart">${bars}</div>
      <div class="report-legend">
        <span class="report-legend-item"><span class="report-dot green"></span>${t('report.totalTakings')}</span>
        <span class="report-legend-item"><span class="report-dot red"></span>${t('day.shareUscite')}</span>
      </div>
    </div>`;
}

function renderCategories(data) {
  if (data.categories.length === 0) return '';
  const total = data.now.expense;
  const colors = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE'];
  const rows = data.categories.slice(0, 6).map(([cat, amt], i) => {
    const pct = total > 0 ? (amt / total * 100) : 0;
    return `
      <div class="report-cat-row">
        <div class="report-cat-name">${escapeHtml(cat)}</div>
        <div class="report-cat-bar-wrap"><div class="report-cat-bar" style="width:${pct.toFixed(0)}%; background:${colors[i % colors.length]};"></div></div>
        <div class="report-cat-amount">${fmtShort(amt)} <span class="report-cat-pct">${pct.toFixed(0)}%</span></div>
      </div>`;
  }).join('');
  return `
    <div class="card">
      <div class="report-section-title">${t('report.categories')}</div>
      ${rows}
    </div>`;
}

function renderAverages(data) {
  const worked = data.days.length;
  if (worked === 0) return '';
  const avgIn = data.now.income / worked;
  const avgOut = data.now.expense / worked;

  const wd = data.weekdays;
  const maxWd = Math.max(...wd.map(w => w.avg), 1);
  // getDay() parte da domenica: qui la settimana si legge da lunedi.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const names = order.map(i => new Date(2024, 0, 7 + i).toLocaleDateString(locale(), { weekday: 'short' }).replace('.', ''));
  const wdBars = order.map((i, k) => `
    <div class="report-bar-group">
      <div class="report-bars"><div class="report-bar blue" style="height:${(wd[i].avg / maxWd * 100).toFixed(1)}%" title="${fmtEuro(wd[i].avg)}"></div></div>
      <div class="report-bar-label">${names[k]}</div>
    </div>`).join('');

  const dayCard = (label, day, cls) => day ? `
    <div class="report-day-card">
      <div class="report-day-label">${label}</div>
      <div class="report-day-date">${dayLabel(day.key)}</div>
      <div class="report-day-value ${cls}">${fmtShort(day.income)}</div>
    </div>` : '';

  return `
    <div class="card">
      <div class="report-section-title">${t('report.averages')}</div>
      <div class="report-avg-row">
        <div class="report-avg"><span>${t('report.avgIncome')}</span><strong class="green">${fmtEuro(avgIn)}</strong></div>
        <div class="report-avg"><span>${t('report.avgExpense')}</span><strong class="red">${fmtEuro(avgOut)}</strong></div>
        <div class="report-avg"><span>${t('report.workedDays')}</span><strong>${worked}</strong></div>
      </div>
      ${data.best ? `<div class="report-days">${dayCard(t('report.bestDay'), data.best, 'green')}${dayCard(t('report.worstDay'), data.worst, 'orange')}</div>` : ''}
      <div class="report-section-title sub">${t('report.byWeekday')}</div>
      <div class="report-chart small">${wdBars}</div>
    </div>`;
}

export function renderReport() {
  const container = document.getElementById('report-content');
  if (!container) return;

  const data = getReportData();
  let html = renderPeriodBar();

  if (data.now.count === 0) {
    html += `<div class="card report-empty">${t('report.emptyPeriod')}</div>`;
  } else {
    html += renderSummary(data);
    html += renderMix(data);
    html += renderMonthTable(data);
    html += renderTrend(data);
    html += renderCategories(data);
    html += renderAverages(data);
  }

  container.innerHTML = html;

  // Gli input data non passano dalla delega sui click: si riagganciano qui,
  // dopo ogni render che li ha ricreati.
  bindDateInput('report-from', v => { customFrom = v; });
  bindDateInput('report-to', v => { customTo = v; });
  bindDateInput('report-cmp-from', v => { compareFrom = v; });
  bindDateInput('report-cmp-to', v => { compareTo = v; });
}

function bindDateInput(id, apply) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', () => { apply(el.value); renderReport(); });
}

export function setReportPreset(p) {
  preset = p;
  if (p === 'custom' && !customFrom) {
    const m = currentRange();
    customFrom = toISODate(m.from);
    customTo = toISODate(m.to);
  }
  renderReport();
}

export function setReportCompare(mode) {
  compareMode = mode;
  compareMenuOpen = false;
  // Si parte dal periodo che il confronto automatico avrebbe scelto: da li' si
  // aggiusta, invece di trovarsi due campi vuoti.
  if (mode === 'customCompare' && !compareFrom) {
    const r = currentRange();
    compareFrom = toISODate(r.prevFrom);
    compareTo = toISODate(r.prevTo);
  }
  renderReport();
}

export function toggleCompareMenu() {
  compareMenuOpen = !compareMenuOpen;
  renderReport();
}

// Chiamata a ogni click fuori dal menu: senza la guardia rigenererebbe il
// report a ogni tocco qualsiasi nella pagina.
export function closeCompareMenu() {
  if (!compareMenuOpen) return;
  compareMenuOpen = false;
  renderReport();
}
