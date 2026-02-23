// ─── Global Search ───

import { d } from './state.js';
import { escapeHtml } from './modals.js';
import { t } from './i18n.js';
import { tab } from './ui-engine.js';

let debounceTimer = null;
let lastResults = [];

export function openSearch() {
  document.getElementById('search-overlay').classList.add('show');
  setTimeout(() => document.getElementById('search-input').focus(), 100);
}

export function closeSearch() {
  document.getElementById('search-overlay').classList.remove('show');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
  lastResults = [];
}

export function onSearchInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const query = document.getElementById('search-input').value.trim();
    if (query.length < 1) {
      document.getElementById('search-results').innerHTML = '';
      lastResults = [];
      return;
    }
    lastResults = performSearch(query);
    renderSearchResults(lastResults);
  }, 300);
}

function performSearch(query) {
  const q = query.toLowerCase();
  const results = [];

  // Search d.log
  d.log.forEach(l => {
    if ((l.v || '').toLowerCase().includes(q) || (l.d || '').includes(q)) {
      results.push({
        type: 'movimento',
        label: l.v,
        sub: l.d + ' · ' + (l.a >= 0 ? '+' : '') +
          l.a.toLocaleString('it-IT', { minimumFractionDigits: 2 }) + '€',
        tab: 3
      });
    }
  });

  // Search d.fatture
  (d.fatture || []).forEach(f => {
    if ((f.azienda || '').toLowerCase().includes(q) || (f.numero || '').toLowerCase().includes(q)) {
      results.push({
        type: 'fattura',
        label: f.azienda || '-',
        sub: (f.numero ? 'N° ' + f.numero + ' · ' : '') +
          '€ ' + (f.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 }),
        tab: 4
      });
    }
  });

  // Search rubriche
  ['fornitori', 'stipendi', 'abit'].forEach(cat => {
    (d[cat] || []).forEach(name => {
      if (name.toLowerCase().includes(q)) {
        results.push({
          type: 'rubrica',
          label: name,
          sub: t('search.in') + ' ' + t('rub.' + cat),
          tab: 0 // rubrica page
        });
      }
    });
  });

  // Search d.anticipi
  (d.anticipi || []).forEach(a => {
    if ((a.nome || '').toLowerCase().includes(q)) {
      results.push({
        type: 'anticipo',
        label: a.nome || '-',
        sub: '€ ' + (a.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 }),
        tab: 2
      });
    }
  });

  return results;
}

const typeIcons = {
  movimento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  fattura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  rubrica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  anticipo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>',
};

const typeLabels = {
  movimento: () => t('search.typeMovimento'),
  fattura: () => t('search.typeFattura'),
  rubrica: () => t('search.typeRubrica'),
  anticipo: () => t('search.typeAnticipo'),
};

function renderSearchResults(results) {
  const container = document.getElementById('search-results');
  if (results.length === 0) {
    container.innerHTML = `<div class="search-empty"><div style="font-size:32px;opacity:0.35;">🔍</div><div>${t('search.noResults')}</div></div>`;
    return;
  }

  const groups = {};
  results.forEach(r => {
    if (!groups[r.type]) groups[r.type] = [];
    groups[r.type].push(r);
  });

  let html = '';
  Object.keys(groups).forEach(type => {
    html += `<div class="search-group-label">${typeLabels[type]()}</div>`;
    groups[type].slice(0, 8).forEach((r, idx) => {
      const gi = results.indexOf(r);
      html += `
        <div class="search-result-item" data-action="searchResultTap" data-index="${gi}">
          <div class="search-result-icon ${type}">${typeIcons[type]}</div>
          <div class="search-result-info">
            <div class="search-result-label">${escapeHtml(r.label)}</div>
            <div class="search-result-sub">${escapeHtml(r.sub)}</div>
          </div>
        </div>`;
    });
  });
  container.innerHTML = html;
}

export function searchResultTap(index) {
  const r = lastResults[index];
  if (!r) return;
  closeSearch();
  if (r.tab > 0) tab(r.tab);
}
