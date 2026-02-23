// ─── Offline Mode Indicator ───
import { t } from './i18n.js';
import { showToast } from './modals.js';

export function initOfflineMode() {
  updateOfflineIndicator();

  window.addEventListener('online', () => {
    updateOfflineIndicator();
    showToast(t('offline.backOnline'), 'check');
  });

  window.addEventListener('offline', () => {
    updateOfflineIndicator();
  });
}

function updateOfflineIndicator() {
  const isOnline = navigator.onLine;
  const banner = document.getElementById('offline-banner');
  const dot = document.getElementById('offline-dot');

  if (banner) banner.style.display = isOnline ? 'none' : 'flex';
  if (dot) dot.style.display = isOnline ? 'none' : 'inline-block';
}
