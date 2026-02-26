// ─── PDF Storage (IndexedDB) ───
// Stores fattura PDF/photo blobs in IndexedDB to avoid localStorage size limits.

const DB_NAME = 'cassa_pdfs';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

let _dbPromise = null;

export function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

export async function storePdf(fatturaId, base64) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ id: fatturaId, data: base64 });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getPdf(fatturaId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(fatturaId);
    req.onsuccess = () => resolve(req.result ? req.result.data : null);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deletePdf(fatturaId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(fatturaId);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllPdfs() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const map = new Map();
      (req.result || []).forEach(entry => map.set(entry.id, entry.data));
      resolve(map);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function migrateFromFatture(fatture) {
  let count = 0;
  for (const f of fatture) {
    const blob = f.pdf || f.foto;
    if (blob && f.id) {
      try {
        await storePdf(f.id, blob);
        count++;
      } catch (err) {
        console.error('[PDF migration] failed for fattura', f.id, err);
      }
    }
  }
  return count;
}
