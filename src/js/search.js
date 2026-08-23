// ─── Global Search ───

import { d } from './state.js';
import { escapeHtml } from './modals.js';
import { t, translateLogDesc } from './i18n.js';
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
    const desc = translateLogDesc(l.v || '');
    if (desc.toLowerCase().includes(q) || (l.d || '').includes(q)) {
      results.push({
        type: 'movimento',
        label: desc,
        sub: l.d + ' · ' + (l.a >= 0 ? '+' : '') +
          l.a.toLocaleString('it-IT', { minimumFractionDigits: 2 }) + '€',
        tab: 2
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

  return results;
}

const typeIcons = {
  movimento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  rubrica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
};

const typeLabels = {
  movimento: () => t('search.typeMovimento'),
  rubrica: () => t('search.typeRubrica'),
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
