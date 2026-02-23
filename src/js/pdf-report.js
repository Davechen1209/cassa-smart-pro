// ─── Monthly PDF Report ───

import { d } from './state.js';
import { t, getLang } from './i18n.js';

export function openPdfReportSheet() {
  const now = new Date();
  document.getElementById('pdf-report-month').value =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  document.getElementById('pdf-report-overlay').classList.add('show');
}

export function closePdfReportSheet() {
  document.getElementById('pdf-report-overlay').classList.remove('show');
}

export function closePdfReportOutside(e) {
  if (e.target === e.currentTarget) closePdfReportSheet();
}

export function printReport() {
  const monthVal = document.getElementById('pdf-report-month').value;
  if (!monthVal) return;
  const [year, month] = monthVal.split('-').map(Number);
  buildPrintArea(year, month);
  closePdfReportSheet();
  setTimeout(() => window.print(), 200);
}

function buildPrintArea(year, month) {
  const locale = getLang() === 'zh' ? 'zh-CN' : 'it-IT';
  const monthName = new Date(year, month - 1, 1)
    .toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const curMonthKey = year + '-' + String(month).padStart(2, '0');

  // Filter logs for this month
  const monthLogs = d.log.filter(l => {
    if (!l.d) return false;
    const parts = l.d.split('/');
    if (parts.length !== 3) return false;
    return parts[2] + '-' + parts[1] === curMonthKey;
  });

  const income = monthLogs.filter(l => l.a >= 0);
  const expenses = monthLogs.filter(l => l.a < 0);
  const totalIncome = income.reduce((s, l) => s + l.a, 0);
  const totalExpenses = expenses.reduce((s, l) => s + Math.abs(l.a), 0);
  const net = totalIncome - totalExpenses;

  // Category breakdown
  const catMap = {};
  expenses.forEach(l => {
    const ci = l.v.indexOf(':');
    const cat = ci > 0 ? l.v.substring(0, ci).trim() : t('exp.genericExpense');
    catMap[cat] = (catMap[cat] || 0) + Math.abs(l.a);
  });
  const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  // Fatture for this month
  const monthFatture = (d.fatture || []).filter(f => {
    if (!f.dataArrivo) return false;
    return f.dataArrivo.startsWith(curMonthKey);
  });

  const fmt = n => '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const el = document.getElementById('print-area');
  el.innerHTML = `
    <div class="print-report">
      <div class="print-header">
        <div class="print-app-name">Cassa Smart Pro</div>
        <div class="print-month">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</div>
        <div class="print-generated">${t('pdf.generated')}: ${new Date().toLocaleDateString(locale)}</div>
      </div>

      <div class="print-section">
        <div class="print-section-title">${t('pdf.summary')}</div>
        <table class="print-table">
          <tr><td>${t('dash.monthIncome')}</td><td class="print-amount positive">${fmt(totalIncome)}</td></tr>
          <tr><td>${t('dash.monthExpenses')}</td><td class="print-amount negative">${fmt(totalExpenses)}</td></tr>
          <tr class="print-total-row"><td>${t('stats.net')}</td><td class="print-amount ${net >= 0 ? 'positive' : 'negative'}">${fmt(net)}</td></tr>
        </table>
      </div>

      ${sortedCats.length > 0 ? `
      <div class="print-section">
        <div class="print-section-title">${t('pdf.expenseCategories')}</div>
        <table class="print-table">
          ${sortedCats.map(([cat, amt]) => `<tr><td>${cat}</td><td class="print-amount">${fmt(amt)}</td></tr>`).join('')}
        </table>
      </div>` : ''}

      ${monthFatture.length > 0 ? `
      <div class="print-section">
        <div class="print-section-title">${t('pdf.invoices')} (${monthFatture.length})</div>
        <table class="print-table">
          <thead><tr><th>${t('fatt.fornitore')}</th><th>${t('fatt.numero')}</th><th class="print-amount">${t('fatt.importo')}</th><th>${t('pdf.status')}</th></tr></thead>
          <tbody>
            ${monthFatture.map(f => `<tr>
              <td>${f.azienda || '-'}</td>
              <td>${f.numero || '-'}</td>
              <td class="print-amount">${fmt(f.importo || 0)}</td>
              <td>${f.pagata ? t('fatt.paid') : t('fatt.unpaidLabel')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${monthLogs.length > 0 ? `
      <div class="print-section">
        <div class="print-section-title">${t('search.typeMovimento')} (${monthLogs.length})</div>
        <table class="print-table">
          <thead><tr><th>${t('excel.colDate')}</th><th>${t('excel.colDesc')}</th><th class="print-amount">${t('excel.colAmount')}</th></tr></thead>
          <tbody>
            ${monthLogs.map(l => `<tr>
              <td>${l.d}</td>
              <td>${l.v}</td>
              <td class="print-amount ${l.a >= 0 ? 'positive' : 'negative'}">${fmt(l.a)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <div class="print-footer">${t('pdf.currentBalance')}: ${fmt(d.saldo)}</div>
    </div>`;
}
