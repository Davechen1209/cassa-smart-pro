import { t } from './i18n.js';
import { showToast } from './modals.js';

// ─── PIN Lock ───

const DEFAULT_PIN = '141219';
const PIN_KEY = 'cassa_pin';
const MAX_ATTEMPTS = 5;
const STORAGE_KEY = 'cassa_pin_blocked';
const ATTEMPTS_KEY = 'cassa_pin_attempts';

function getPin() {
  return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
}

let currentInput = '';
let attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0');
let blocked = localStorage.getItem(STORAGE_KEY) === 'true';

export function initPinLock() {
  const overlay = document.getElementById('pin-overlay');
  if (!overlay) return;

  if (blocked) {
    showBlocked();
    return;
  }

  // Check if already unlocked this session
  if (sessionStorage.getItem('pin_unlocked') === 'true') {
    overlay.remove();
    return;
  }

  overlay.classList.add('show');
  rebuildDots();
  updateDots();
  updateAttemptsDisplay();

  const pad = document.getElementById('pin-pad');
  const delBtn = document.getElementById('pin-del');

  // Use touchstart for instant response on mobile, click as fallback
  const tapEvent = 'ontouchstart' in window ? 'touchstart' : 'click';

  pad.addEventListener(tapEvent, (e) => {
    if (blocked) return;
    const btn = e.target.closest('.pin-key');
    if (!btn) return;

    // Prevent ghost click after touchstart
    if (tapEvent === 'touchstart') e.preventDefault();

    const key = btn.dataset.key;
    if (key === undefined) return;

    const pinLen = getPin().length;
    if (currentInput.length < pinLen) {
      currentInput += key;
      updateDots();

      // Instant visual feedback
      btn.classList.add('pressed');
      requestAnimationFrame(() => {
        setTimeout(() => btn.classList.remove('pressed'), 80);
      });

      if (currentInput.length === pinLen) {
        // Check immediately, no artificial delay
        requestAnimationFrame(checkPin);
      }
    }
  }, { passive: false });

  // Delete button — same approach
  delBtn.addEventListener(tapEvent, (e) => {
    if (blocked) return;
    if (tapEvent === 'touchstart') e.preventDefault();
    if (currentInput.length > 0) {
      currentInput = currentInput.slice(0, -1);
      updateDots();
    }
  }, { passive: false });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('show') || blocked) return;
    const pinLen = getPin().length;
    if (e.key >= '0' && e.key <= '9' && currentInput.length < pinLen) {
      currentInput += e.key;
      updateDots();
      if (currentInput.length === pinLen) requestAnimationFrame(checkPin);
    } else if (e.key === 'Backspace') {
      currentInput = currentInput.slice(0, -1);
      updateDots();
    }
  });
}

function checkPin() {
  const overlay = document.getElementById('pin-overlay');
  const dotsContainer = document.getElementById('pin-dots');

  if (currentInput === getPin()) {
    // Success — fast unlock
    attempts = 0;
    localStorage.setItem(ATTEMPTS_KEY, '0');
    sessionStorage.setItem('pin_unlocked', 'true');
    dotsContainer.classList.add('success');
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 300);
    }, 300);
  } else {
    // Wrong PIN
    attempts++;
    localStorage.setItem(ATTEMPTS_KEY, String(attempts));

    if (attempts >= MAX_ATTEMPTS) {
      blocked = true;
      localStorage.setItem(STORAGE_KEY, 'true');
      showBlocked();
      return;
    }

    dotsContainer.classList.add('shake');
    setTimeout(() => {
      dotsContainer.classList.remove('shake');
      currentInput = '';
      updateDots();
      updateAttemptsDisplay();
    }, 400);
  }
}

function showBlocked() {
  const overlay = document.getElementById('pin-overlay');
  overlay.classList.add('show');
  document.getElementById('pin-title')?.remove();
  document.getElementById('pin-subtitle').textContent = t('pin.blocked');
  document.getElementById('pin-subtitle').classList.add('blocked');
  document.getElementById('pin-dots').style.display = 'none';
  document.getElementById('pin-pad').style.display = 'none';
  document.getElementById('pin-attempts').textContent = t('pin.tooMany');
  document.getElementById('pin-attempts').classList.add('blocked');
  document.querySelector('.pin-icon').textContent = '⛔';
}

function rebuildDots() {
  const container = document.getElementById('pin-dots');
  if (!container) return;
  const pinLen = getPin().length;
  container.innerHTML = '';
  for (let i = 0; i < pinLen; i++) {
    const dot = document.createElement('span');
    dot.className = 'pin-dot';
    container.appendChild(dot);
  }
}

function updateDots() {
  const dots = document.querySelectorAll('#pin-dots .pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < currentInput.length);
  });
}

function updateAttemptsDisplay() {
  const el = document.getElementById('pin-attempts');
  if (attempts > 0 && attempts < MAX_ATTEMPTS) {
    const remaining = MAX_ATTEMPTS - attempts;
    el.textContent = remaining + ' ' + (remaining === 1 ? t('pin.remaining_one') : t('pin.remaining_other'));
  }
}

export function changePin() {
  const oldInput = document.getElementById('pin-old');
  const newInput = document.getElementById('pin-new');
  const confirmInput = document.getElementById('pin-confirm');
  if (!oldInput || !newInput || !confirmInput) return;

  const oldVal = oldInput.value.trim();
  const newVal = newInput.value.trim();
  const confirmVal = confirmInput.value.trim();

  if (oldVal !== getPin()) {
    showToast(t('pin.wrongOld'), 'warn');
    return;
  }
  if (newVal.length < 4 || newVal.length > 8) {
    showToast(t('pin.invalidLength'), 'warn');
    return;
  }
  if (newVal !== confirmVal) {
    showToast(t('pin.noMatch'), 'warn');
    return;
  }

  localStorage.setItem(PIN_KEY, newVal);
  oldInput.value = '';
  newInput.value = '';
  confirmInput.value = '';
  showToast(t('pin.changed'), 'check');
}
