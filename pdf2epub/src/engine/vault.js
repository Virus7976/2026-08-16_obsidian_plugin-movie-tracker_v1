// Passcode lock for the on-device library.
//
// There is no server and no account here: the passcode derives an AES-GCM key
// that encrypts every stored book. Nothing but a random salt and a short
// verifier is written down, so without the passcode the stored bytes are
// unreadable — including by anyone who opens the browser's storage inspector.
// It protects the library on this device; it is not a login.

const SETTINGS_KEY = 'pdf2epub.lock.v1';
const ITERATIONS = 250000;
const VERIFIER_TEXT = 'pdf2epub-unlocked';

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = {
  to: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  from: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function deriveKey(passcode, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function lockSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  } catch {
    return null;
  }
}

export const isLockSet = () => !!lockSettings();

/** Turn the lock on. Returns the live key so the session can carry on. */
export async function createLock(passcode) {
  if (!passcode || passcode.length < 4) throw new Error('Use at least 4 characters.');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(passcode, salt);
  const verifier = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(VERIFIER_TEXT));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    salt: b64.to(salt),
    iv: b64.to(iv),
    verifier: b64.to(verifier),
    createdAt: Date.now(),
  }));
  return key;
}

/** @returns {Promise<CryptoKey|null>} null when the passcode is wrong */
export async function unlock(passcode) {
  const settings = lockSettings();
  if (!settings) return null;
  const key = await deriveKey(passcode, b64.from(settings.salt));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64.from(settings.iv) },
      key,
      b64.from(settings.verifier),
    );
    return dec.decode(plain) === VERIFIER_TEXT ? key : null;
  } catch {
    return null; // AES-GCM refuses to authenticate a wrong key
  }
}

/** Removing the lock cannot decrypt what is already stored, so callers must
 *  clear the library at the same time. */
export function removeLock() {
  localStorage.removeItem(SETTINGS_KEY);
}

export async function encryptBlob(key, blob) {
  const iv = randomBytes(12);
  const data = blob instanceof Blob ? await blob.arrayBuffer() : blob;
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { cipher, iv: b64.to(iv) };
}

export async function decryptBlob(key, cipher, iv, type) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.from(iv) }, key, cipher);
  return new Blob([plain], { type });
}

export async function encryptJson(key, value) {
  return encryptBlob(key, enc.encode(JSON.stringify(value)));
}

export async function decryptJson(key, cipher, iv) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.from(iv) }, key, cipher);
  return JSON.parse(dec.decode(plain));
}
