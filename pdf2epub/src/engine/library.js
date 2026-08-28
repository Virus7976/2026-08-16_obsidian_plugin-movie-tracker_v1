// On-device library. Finished books live in IndexedDB so the page can be
// closed and come back to later, and they expire on their own.

const DB_NAME = 'pdf2epub';
const DB_VERSION = 1;
const STORE = 'books';

export const RETENTIONS = {
  '6h': 6 * 3600e3,
  '24h': 24 * 3600e3,
  '3d': 3 * 24 * 3600e3,
  'never': Infinity,
};

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('expiresAt', 'expiresAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, run) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      let result;
      Promise.resolve(run(store)).then((r) => { result = r; }, reject);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('aborted'));
    });
  } finally {
    db.close();
  }
}

const request = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export function isSupported() {
  return typeof indexedDB !== 'undefined';
}

/** @returns {Promise<Array>} records, newest first, without their file payloads */
export async function listBooks() {
  const all = await tx('readonly', (store) => request(store.getAll()));
  return all
    .map(({ data, cipherData, ...rest }) => rest)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getBook(id) {
  return tx('readonly', (store) => request(store.get(id)));
}

export async function putBook(record) {
  return tx('readwrite', (store) => request(store.put(record)));
}

export async function deleteBook(id) {
  return tx('readwrite', (store) => request(store.delete(id)));
}

export async function clearBooks() {
  return tx('readwrite', (store) => request(store.clear()));
}

/** Drop everything past its expiry. Returns how many went. */
export async function purgeExpired(now = Date.now()) {
  return tx('readwrite', async (store) => {
    const all = await request(store.getAll());
    let removed = 0;
    for (const record of all) {
      if (record.expiresAt && record.expiresAt <= now) {
        store.delete(record.id);
        removed += 1;
      }
    }
    return removed;
  });
}

/** Roughly how much room the browser is giving us, for the storage note. */
export async function usage() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage: used, quota } = await navigator.storage.estimate();
    return { used, quota };
  } catch {
    return null;
  }
}

/**
 * Ask the browser not to evict this origin's data under storage pressure.
 * Silently a no-op where unsupported — it is a request, not a guarantee.
 */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && navigator.storage?.persist) {
      return (await navigator.storage.persisted()) || (await navigator.storage.persist());
    }
  } catch { /* not available */ }
  return false;
}
