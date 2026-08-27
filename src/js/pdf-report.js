// ─── Monthly PDF Report ───

import { d } from './state.js';
import { t, getLang, translateLogDesc, parseIncasso, isDeposito } from './i18n.js';
import { Store as HkStore } from './fatture-app/hk-store.js';
import { escapeHtml } from './modals.js';

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
  // I depositi in banca escono dalla cassa ma non sono spese: si contano a
  // parte, altrimenti gonfiano le uscite e falsano il netto.
  const depositi = monthLogs.filter(isDeposito);
  const expenses = monthLogs.filter(l => l.a < 0 && !isDeposito(l));
  // Come nella tab Report: il registro salva i soli contanti, il totale Z e il
  // POS stanno nella descrizione. Prima qui "Totale incassi" sommava gli
  // importi di riga, cioe' i contanti: stessa etichetta della tab, numero
  // diverso, per lo stesso mese.
  const perIncasso = l => { const inc = parseIncasso(l.v); return inc || { totale: l.a, pos: 0, cash: l.a }; };
  const totalIncome = income.reduce((s, l) => s + perIncasso(l).totale, 0);
  const totalCash = income.reduce((s, l) => s + perIncasso(l).cash, 0);
  const totalPos = income.reduce((s, l) => s + perIncasso(l).pos, 0);
  const totalExpenses = expenses.reduce((s, l) => s + Math.abs(l.a), 0);
  // In cassa entrano i contanti e le uscite si pagano di tasca: il netto e'
  // quello, ed e' l'unico che torna col saldo.
  const net = totalCash - totalExpenses;
  const totalDepositi = depositi.reduce((s2, l) => s2 + Math.abs(l.a), 0);
  const restaInCassa = net - totalDepositi;

  // Category breakdown
  const catMap = {};
  expenses.forEach(l => {
    const translated = translateLogDesc(l.v);
    const ci = translated.indexOf(':');
    const cat = ci > 0 ? translated.substring(0, ci).trim() : t('exp.genericExpense');
    catMap[cat] = (catMap[cat] || 0) + Math.abs(l.a);
  });
  const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);


  const fmt = n => '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ─── Fatture del mese ───
  // Restano un libro a parte dai movimenti di cassa: una fattura pagata in
  // contanti e' gia' un'uscita nel registro, e sommarla anche qui la
  // conterebbe due volte. Il mese si conta sulla data di arrivo; residuo e
  // scaduto sono fotografie di oggi, e sono etichettati come tali.
  const oggiISO = HkStore.todayISO();
  const inMese = iso => typeof iso === 'string' && iso.slice(0, 7) === curMonthKey;
  const euro = c => c / 100;
  const fattureMese = HkStore.records()
    .filter(r => inMese(r.arrivalDate))
    .sort((a, b) => String(a.arrivalDate).localeCompare(String(b.arrivalDate)));
  const totFatture = fattureMese.reduce((s2, r) => s2 + euro(HkStore.recCents(r).amount), 0);
  const residuoMese = fattureMese.reduce((s2, r) => s2 + euro(HkStore.recCents(r).unpaid), 0);
  // Pagamenti del mese: ora i pagamenti portano una data, quindi si possono
  // elencare. Quelli senza data (registrati prima o importati) restano fuori.
  const primoDelMese = curMonthKey + '-01';
  const ultimoDelMese = curMonthKey + '-31';
  const pagamentiMese = [];
  HkStore.records().forEach(r => {
    HkStore.normalizePayments(r.payments).forEach(p => {
      if (p.date < primoDelMese || p.date > ultimoDelMese) return;
      pagamentiMese.push({ data: p.date, fornitore: r.supplier, fattura: r.invoice, importo: p.cash + p.other });
    });
  });
  pagamentiMese.sort((a, b) => a.data.localeCompare(b.data));
  const totPagamentiMese = pagamentiMese.reduce((s2, p) => s2 + p.importo, 0);

  const scadute = HkStore.records()
    .filter(r => HkStore.computeStatus(r, oggiISO) === 'overdue')
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const residuoScaduto = scadute.reduce((s2, r) => s2 + euro(HkStore.recCents(r).unpaid), 0);
  const dataIT = iso => {
    if (typeof iso !== 'string' || iso.length < 10) return '';
    const [y, m, g] = iso.split('-');
    return g + '/' + m + '/' + y;
  };

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
          <tr><td>${t('report.totalTakings')}</td><td class="print-amount positive">${fmt(totalIncome)}</td></tr>
          <tr><td>${t('report.cash')}</td><td class="print-amount">${fmt(totalCash)}</td></tr>
          <tr><td>${t('excel.colPos')}</td><td class="print-amount">${fmt(totalPos)}</td></tr>
          <tr><td>${t('day.shareUscite')}</td><td class="print-amount negative">${fmt(totalExpenses)}</td></tr>
          <tr class="print-total-row"><td>${t('stats.net')} (${t('report.nettoFormula')})</td><td class="print-amount ${net >= 0 ? 'positive' : 'negative'}">${fmt(net)}</td></tr>
          ${totalDepositi > 0 ? `<tr><td>${t('pdf.depositi')} (${depositi.length})</td><td class="print-amount">${fmt(totalDepositi)}</td></tr>` : ''}
          ${totalDepositi > 0 ? `<tr><td>${t('report.depRestano')}</td><td class="print-amount ${restaInCassa >= 0 ? 'positive' : 'negative'}">${fmt(restaInCassa)}</td></tr>` : ''}
          ${fattureMese.length > 0 ? `<tr><td>${t('report.fattArrivate')} (${fattureMese.length})</td><td class="print-amount">${fmt(totFatture)}</td></tr>` : ''}
          ${totPagamentiMese > 0 ? `<tr><td>${t('pdf.fattPagamenti')}</td><td class="print-amount">${fmt(totPagamentiMese)}</td></tr>` : ''}
          ${residuoScaduto > 0 ? `<tr><td>${t('report.fattScadute')} · ${t('report.fattAOggi')}</td><td class="print-amount negative">${fmt(residuoScaduto)}</td></tr>` : ''}
        </table>
      </div>

      ${sortedCats.length > 0 ? `
      <div class="print-section">
        <div class="print-section-title">${t('pdf.expenseCategories')}</div>
        <table class="print-table">
          ${sortedCats.map(([cat, amt]) => `<tr><td>${cat}</td><td class="print-amount">${fmt(amt)}</td></tr>`).join('')}
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
              <td>${translateLogDesc(l.v)}</td>
              <td class="print-amount ${l.a >= 0 ? 'positive' : 'negative'}">${fmt(l.a)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${fattureMese.length > 0 ? `
      <div class="print-section">
        <div class="print-section-title">${t('report.fattTitolo')} (${fattureMese.length})</div>
        <table class="print-table">
          <thead><tr>
            <th>${t('excel.colArrivalDate')}</th><th>${t('excel.colSupplier')}</th><th>${t('excel.colNumber')}</th>
            <th class="print-amount">${t('excel.colAmount')}</th>
            <th class="print-amount">${t('pdf.fattPagato')}</th>
            <th class="print-amount">${t('pdf.fattResiduo')}</th>
            <th>${t('excel.colDueDate')}</th>
          </tr></thead>
          <tbody>
            ${fattureMese.map(r => { const c = HkStore.recCents(r); return `<tr>
              <td>${dataIT(r.arrivalDate)}</td>
              <td>${escapeHtml(r.supplier)}</td>
              <td>${escapeHtml(r.invoice)}</td>
              <td class="print-amount">${fmt(euro(c.amount))}</td>
              <td class="print-amount">${fmt(euro(c.paid))}</td>
              <td class="print-amount ${c.unpaid > 0 ? 'negative' : ''}">${fmt(euro(c.unpaid))}</td>
              <td>${dataIT(r.dueDate)}</td>
            </tr>`; }).join('')}
          </tbody>
          <tfoot><tr class="print-total-row">
            <td colspan="3">${t('report.total')}</td>
            <td class="print-amount">${fmt(totFatture)}</td>
            <td class="print-amount">${fmt(totFatture - residuoMese)}</td>
            <td class="print-amount">${fmt(residuoMese)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>` : ''}

      ${pagamentiMese.length > 0 ? `
      <div class="print-section">
        <div class="print-section-title">${t('pdf.fattPagamenti')} (${pagamentiMese.length})</div>
        <table class="print-table">
          <thead><tr>
            <th>${t('excel.colDate')}</th><th>${t('excel.colSupplier')}</th><th>${t('excel.colNumber')}</th>
            <th class="print-amount">${t('excel.colAmount')}</th>
          </tr></thead>
          <tbody>
            ${pagamentiMese.map(p => `<tr>
              <td>${dataIT(p.data)}</td>
              <td>${escapeHtml(p.fornitore)}</td>
              <td>${escapeHtml(p.fattura)}</td>
              <td class="print-amount">${fmt(p.importo)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr class="print-total-row">
            <td colspan="3">${t('report.total')}</td>
            <td class="print-amount">${fmt(totPagamentiMese)}</td>
          </tr></tfoot>
        </table>
      </div>` : ''}

      ${scadute.length > 0 ? `
      <div class="print-section">
        <div class="print-section-title">${t('report.fattScadute')} — ${t('report.fattAOggi')} (${scadute.length})</div>
        <table class="print-table">
          <thead><tr>
            <th>${t('excel.colDueDate')}</th><th>${t('excel.colSupplier')}</th><th>${t('excel.colNumber')}</th>
            <th class="print-amount">${t('pdf.fattResiduo')}</th>
          </tr></thead>
          <tbody>
            ${scadute.map(r => `<tr>
              <td>${dataIT(r.dueDate)}</td>
              <td>${escapeHtml(r.supplier)}</td>
              <td>${escapeHtml(r.invoice)}</td>
              <td class="print-amount negative">${fmt(euro(HkStore.recCents(r).unpaid))}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr class="print-total-row">
            <td colspan="3">${t('report.total')}</td>
            <td class="print-amount negative">${fmt(residuoScaduto)}</td>
          </tr></tfoot>
        </table>
      </div>` : ''}

      <div class="print-footer">${t('pdf.currentBalance')}: ${fmt(d.saldo)}</div>
    </div>`;
}
