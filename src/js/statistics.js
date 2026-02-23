// ─── Statistics Module ───

import { d } from './state.js';
import { t, getLang } from './i18n.js';

export function renderStatistics() {
  const container = document.getElementById('stats-content');
  if (!container) return;

  if (d.log.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--gray); padding:20px; font-size:13px;">' + t('history.empty') + '</div>';
    return;
  }

  // Group by month
  const months = {};
  d.log.forEach(l => {
    const key = l.d ? l.d.substring(0, 7) : null; // YYYY-MM
    if (!key) return;
    if (!months[key]) months[key] = { income: 0, expense: 0 };
    if (l.a >= 0) months[key].income += l.a;
    else months[key].expense += Math.abs(l.a);
  });

  // Get last 6 months sorted
  const sortedMonths = Object.keys(months).sort().slice(-6);
  const maxVal = Math.max(...sortedMonths.map(m => Math.max(months[m].income, months[m].expense)), 1);

  // Category breakdown (expenses only, current month)
  const now = new Date();
  const curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const categories = {};
  let totalExpense = 0;
  d.log.forEach(l => {
    if (l.a >= 0 || !l.d || !l.d.startsWith(curMonth)) return;
    const amt = Math.abs(l.a);
    totalExpense += amt;
    // Extract category from description (type: name format)
    const colonIdx = l.v.indexOf(':');
    const cat = colonIdx > 0 ? l.v.substring(0, colonIdx).trim() : t('exp.genericExpense');
    categories[cat] = (categories[cat] || 0) + amt;
  });

  // Sort categories by amount desc
  const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Category colors
  const catColors = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF'];

  // Current month totals
  const curMonthData = months[curMonth] || { income: 0, expense: 0 };
  const net = curMonthData.income - curMonthData.expense;

  // Format month name
  function monthName(ym) {
    const [y, m] = ym.split('-');
    const dt = new Date(y, m - 1, 1);
    const lang = getLang() === 'zh' ? 'zh-CN' : 'it-IT';
    return dt.toLocaleDateString(lang, { month: 'short' }).replace('.', '');
  }

  function fmt(n) {
    return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // Build HTML
  let html = '';

  // Monthly summary cards
  html += '<div class="stats-summary">';
  html += '<div class="stats-sum-card green"><div class="stats-sum-label">' + t('day.shareIncassi') + '</div><div class="stats-sum-value">€' + fmt(curMonthData.income) + '</div></div>';
  html += '<div class="stats-sum-card red"><div class="stats-sum-label">' + t('day.shareUscite') + '</div><div class="stats-sum-value">€' + fmt(curMonthData.expense) + '</div></div>';
  html += '<div class="stats-sum-card ' + (net >= 0 ? 'blue' : 'orange') + '"><div class="stats-sum-label">' + t('stats.net') + '</div><div class="stats-sum-value">' + (net >= 0 ? '+' : '') + '€' + fmt(net) + '</div></div>';
  html += '</div>';

  // Monthly bar chart
  if (sortedMonths.length > 1) {
    html += '<div class="stats-section-title">' + t('stats.monthlyTrend') + '</div>';
    html += '<div class="stats-chart">';
    sortedMonths.forEach(m => {
      const incPct = (months[m].income / maxVal * 100).toFixed(1);
      const expPct = (months[m].expense / maxVal * 100).toFixed(1);
      html += '<div class="stats-bar-group">';
      html += '<div class="stats-bars">';
      html += '<div class="stats-bar green" style="height:' + incPct + '%"></div>';
      html += '<div class="stats-bar red" style="height:' + expPct + '%"></div>';
      html += '</div>';
      html += '<div class="stats-bar-label">' + monthName(m) + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Legend
    html += '<div class="stats-legend">';
    html += '<span class="stats-legend-item"><span class="stats-dot green"></span>' + t('day.shareIncassi') + '</span>';
    html += '<span class="stats-legend-item"><span class="stats-dot red"></span>' + t('day.shareUscite') + '</span>';
    html += '</div>';
  }

  // Category breakdown
  if (sortedCats.length > 0) {
    html += '<div class="stats-section-title">' + t('stats.categories') + '</div>';
    sortedCats.forEach((cat, i) => {
      const pct = totalExpense > 0 ? (cat[1] / totalExpense * 100).toFixed(0) : 0;
      const color = catColors[i % catColors.length];
      html += '<div class="stats-cat-row">';
      html += '<div class="stats-cat-name">' + cat[0] + '</div>';
      html += '<div class="stats-cat-bar-wrap"><div class="stats-cat-bar" style="width:' + pct + '%; background:' + color + ';"></div></div>';
      html += '<div class="stats-cat-amount">€' + fmt(cat[1]) + ' <span class="stats-cat-pct">' + pct + '%</span></div>';
      html += '</div>';
    });
  }

  container.innerHTML = html;
}

export function toggleStats() {
  const content = document.getElementById('stats-content');
  const chevron = document.getElementById('stats-chevron');
  if (!content) return;
  const open = content.style.display !== 'none';
  content.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(90deg)';
  if (!open) renderStatistics();
}
