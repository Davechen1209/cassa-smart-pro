// ─── PIN Lock ───

const CORRECT_PIN = '141219';
const MAX_ATTEMPTS = 5;
const STORAGE_KEY = 'cassa_pin_blocked';
const ATTEMPTS_KEY = 'cassa_pin_attempts';

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
  updateDots();
  updateAttemptsDisplay();

  // Keypad clicks
  document.getElementById('pin-pad').addEventListener('click', (e) => {
    const btn = e.target.closest('.pin-key');
    if (!btn || blocked) return;

    const key = btn.dataset.key;

    if (key !== undefined) {
      if (currentInput.length < 6) {
        currentInput += key;
        updateDots();
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 150);

        if (currentInput.length === 6) {
          setTimeout(checkPin, 200);
        }
      }
    }
  });

  // Delete button
  document.getElementById('pin-del').addEventListener('click', () => {
    if (blocked) return;
    if (currentInput.length > 0) {
      currentInput = currentInput.slice(0, -1);
      updateDots();
    }
  });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('show') || blocked) return;
    if (e.key >= '0' && e.key <= '9' && currentInput.length < 6) {
      currentInput += e.key;
      updateDots();
      if (currentInput.length === 6) setTimeout(checkPin, 200);
    } else if (e.key === 'Backspace') {
      currentInput = currentInput.slice(0, -1);
      updateDots();
    }
  });
}

function checkPin() {
  const overlay = document.getElementById('pin-overlay');
  const dotsContainer = document.getElementById('pin-dots');

  if (currentInput === CORRECT_PIN) {
    // Success
    attempts = 0;
    localStorage.setItem(ATTEMPTS_KEY, '0');
    sessionStorage.setItem('pin_unlocked', 'true');
    dotsContainer.classList.add('success');
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 400);
    }, 500);
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
    }, 500);
  }
}

function showBlocked() {
  const overlay = document.getElementById('pin-overlay');
  overlay.classList.add('show');
  document.getElementById('pin-title')?.remove();
  document.getElementById('pin-subtitle').textContent = 'Accesso bloccato permanentemente';
  document.getElementById('pin-subtitle').classList.add('blocked');
  document.getElementById('pin-dots').style.display = 'none';
  document.getElementById('pin-pad').style.display = 'none';
  document.getElementById('pin-attempts').textContent = 'Troppi tentativi errati';
  document.getElementById('pin-attempts').classList.add('blocked');
  document.querySelector('.pin-icon').textContent = '⛔';
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
    el.textContent = `${remaining} tentatv${remaining === 1 ? 'o' : 'i'} rimanent${remaining === 1 ? 'e' : 'i'}`;
  }
}
