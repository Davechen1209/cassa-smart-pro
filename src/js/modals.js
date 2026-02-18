// ─── Modals, Toast, Confirm ───

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function showToast(text, type) {
  const toast = document.getElementById('toast');
  const iconEl = document.getElementById('toast-icon');
  const textEl = document.getElementById('toast-text');
  const icons = { check: '\u2705', trash: '\uD83D\uDDD1\uFE0F', warn: '\u26A0\uFE0F' };
  iconEl.textContent = icons[type] || '\u2705';
  textEl.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

export function showConfirm(title, msg, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-yes').onclick = () => {
    closeConfirm();
    if (callback) callback();
  };
  document.getElementById('confirm-overlay').classList.add('show');
}

export function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('show');
}

export function openModal(title, value) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-input').value = value || '';
  document.getElementById('modal-overlay').classList.add('show');
  setTimeout(() => document.getElementById('modal-input').focus(), 350);
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

export function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}
