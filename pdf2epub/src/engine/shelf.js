// The shelf: saving finished books, reading them back, and moving the whole
// library in and out of the passcode lock.

import * as library from './library.js';
import * as vault from './vault.js';

const uuid = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const EPUB = 'application/epub+zip';

/** Store a finished conversion. `key` is null when no lock is set. */
export async function saveBook(result, { retentionMs, key }) {
  const now = Date.now();
  const meta = {
    title: result.report.title,
    author: result.report.author,
    filename: result.filename,
    report: result.report,
  };

  const base = {
    id: uuid(),
    createdAt: now,
    expiresAt: Number.isFinite(retentionMs) ? now + retentionMs : 0,
    size: result.blob.size,
    encrypted: !!key,
  };

  if (!key) {
    await library.putBook({ ...base, meta, cover: result.cover || null, data: result.blob });
    return base.id;
  }

  const [m, d] = await Promise.all([
    vault.encryptJson(key, meta),
    vault.encryptBlob(key, result.blob),
  ]);
  const c = result.cover ? await vault.encryptBlob(key, result.cover) : null;
  await library.putBook({
    ...base,
    metaCipher: m.cipher, metaIv: m.iv,
    dataCipher: d.cipher, dataIv: d.iv,
    coverCipher: c?.cipher || null, coverIv: c?.iv || null,
  });
  return base.id;
}

async function readMeta(record, key) {
  if (!record.encrypted) return { meta: record.meta, cover: record.cover || null };
  if (!key) return null;
  const meta = await vault.decryptJson(key, record.metaCipher, record.metaIv);
  const cover = record.coverCipher
    ? await vault.decryptBlob(key, record.coverCipher, record.coverIv, 'image/jpeg')
    : null;
  return { meta, cover };
}

/** Everything on the shelf, newest first, with covers ready to display. */
export async function listShelf(key) {
  await library.purgeExpired();
  const records = await library.listBooks();
  const out = [];
  for (const record of records) {
    try {
      const opened = await readMeta(record, key);
      if (!opened) continue;
      out.push({
        id: record.id,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        size: record.size,
        encrypted: record.encrypted,
        ...opened.meta,
        cover: opened.cover,
      });
    } catch {
      // A record we cannot read is one the current key does not own; skip it.
    }
  }
  return out;
}

/** Pull a book's EPUB back out, ready to download or preview. */
export async function openBook(id, key) {
  const record = await library.getBook(id);
  if (!record) return null;
  if (!record.encrypted) {
    return { blob: record.data, filename: record.meta.filename, report: record.meta.report, cover: record.cover || null };
  }
  const meta = await vault.decryptJson(key, record.metaCipher, record.metaIv);
  const blob = await vault.decryptBlob(key, record.dataCipher, record.dataIv, EPUB);
  const cover = record.coverCipher
    ? await vault.decryptBlob(key, record.coverCipher, record.coverIv, 'image/jpeg')
    : null;
  return { blob, filename: meta.filename, report: meta.report, cover };
}

/** Encrypt everything already on the shelf, when the lock is switched on. */
export async function encryptShelf(key) {
  const records = await library.listBooks();
  for (const summary of records) {
    const record = await library.getBook(summary.id);
    if (!record || record.encrypted) continue;
    const [m, d] = await Promise.all([
      vault.encryptJson(key, record.meta),
      vault.encryptBlob(key, record.data),
    ]);
    const c = record.cover ? await vault.encryptBlob(key, record.cover) : null;
    await library.putBook({
      id: record.id,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      size: record.size,
      encrypted: true,
      metaCipher: m.cipher, metaIv: m.iv,
      dataCipher: d.cipher, dataIv: d.iv,
      coverCipher: c?.cipher || null, coverIv: c?.iv || null,
    });
  }
}

/** Put everything back in the clear, when the lock is switched off. */
export async function decryptShelf(key) {
  const records = await library.listBooks();
  for (const summary of records) {
    const record = await library.getBook(summary.id);
    if (!record || !record.encrypted) continue;
    const meta = await vault.decryptJson(key, record.metaCipher, record.metaIv);
    const data = await vault.decryptBlob(key, record.dataCipher, record.dataIv, EPUB);
    const cover = record.coverCipher
      ? await vault.decryptBlob(key, record.coverCipher, record.coverIv, 'image/jpeg')
      : null;
    await library.putBook({
      id: record.id,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      size: record.size,
      encrypted: false,
      meta, cover, data,
    });
  }
}

export const removeBook = library.deleteBook;
export const clearShelf = library.clearBooks;
export const purge = library.purgeExpired;
export const shelfUsage = library.usage;
export const keepStored = library.requestPersistence;
export { RETENTIONS } from './library.js';
