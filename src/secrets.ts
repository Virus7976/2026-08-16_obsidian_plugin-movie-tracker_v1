/**
 * Credential handling for the TMDB key.
 *
 * The problem: an Obsidian plugin's only persistence is `data.json` inside the
 * vault. Vaults get synced, backed up, and — often enough — committed to git.
 * A plaintext key there is a key you have effectively published.
 *
 * Three storage modes, chosen in settings:
 *
 *   session    Never written to disk at all. You paste the key once per app
 *              launch. Zero at-rest exposure; maximum friction.
 *   encrypted  AES-256-GCM at rest, key derived from a passphrase you choose
 *              via PBKDF2-SHA256. `data.json` holds only salt, IV and
 *              ciphertext — useless without the passphrase. Unlock once per
 *              session. This is the default.
 *   plain      Stored as-is. Only sensible for a vault that is never synced
 *              anywhere. The settings UI says so, loudly.
 *
 * In every mode the decrypted key exists only in this module's memory, is never
 * logged, and is scrubbed from any error text before it can reach the console
 * or a Notice (see `redact`).
 *
 * WebCrypto is used rather than a bundled crypto library: it's present in both
 * the desktop Electron renderer and the mobile webview, both of which are
 * secure contexts, and it keeps the bundle small — which matters on phones.
 */

import { arrayBufferToBase64, base64ToArrayBuffer } from "obsidian";

export type KeyMode = "encrypted" | "plain" | "session";

/** What actually gets persisted in `data.json` when mode is `encrypted`. */
export interface SecretBlob {
	v: 1;
	kdf: "PBKDF2-SHA256";
	iters: number;
	salt: string; // base64
	iv: string; // base64
	ct: string; // base64 — ciphertext with GCM tag appended
}

/** Deliberately high; a phone does this once per session, not per request. */
const PBKDF2_ITERATIONS = 310_000;

function subtle(): SubtleCrypto {
	const c = window.crypto;
	if (!c?.subtle) {
		throw new Error(
			"WebCrypto is unavailable, so the key cannot be encrypted. " +
				"Switch key storage to 'session' in Reel's settings."
		);
	}
	return c.subtle;
}

function randomBytes(n: number): Uint8Array {
	const b = new Uint8Array(n);
	window.crypto.getRandomValues(b);
	return b;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iters: number): Promise<CryptoKey> {
	const material = await subtle().importKey(
		"raw",
		new TextEncoder().encode(passphrase),
		{ name: "PBKDF2" },
		false,
		["deriveKey"]
	);
	return subtle().deriveKey(
		{ name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: iters, hash: "SHA-256" },
		material,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"]
	);
}

export async function encryptSecret(plaintext: string, passphrase: string): Promise<SecretBlob> {
	const salt = randomBytes(16);
	const iv = randomBytes(12);
	const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
	const ct = await subtle().encrypt(
		{ name: "AES-GCM", iv: iv as unknown as BufferSource },
		key,
		new TextEncoder().encode(plaintext)
	);
	return {
		v: 1,
		kdf: "PBKDF2-SHA256",
		iters: PBKDF2_ITERATIONS,
		salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
		iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
		ct: arrayBufferToBase64(ct),
	};
}

/** Throws `WrongPassphraseError` on a bad passphrase — GCM auth failure. */
export async function decryptSecret(blob: SecretBlob, passphrase: string): Promise<string> {
	const salt = new Uint8Array(base64ToArrayBuffer(blob.salt));
	const iv = new Uint8Array(base64ToArrayBuffer(blob.iv));
	const key = await deriveAesKey(passphrase, salt, blob.iters ?? PBKDF2_ITERATIONS);
	try {
		const pt = await subtle().decrypt(
			{ name: "AES-GCM", iv: iv as unknown as BufferSource },
			key,
			base64ToArrayBuffer(blob.ct)
		);
		return new TextDecoder().decode(pt);
	} catch {
		// GCM cannot distinguish "wrong passphrase" from "tampered ciphertext",
		// and neither can we. Report the likely one.
		throw new WrongPassphraseError();
	}
}

/**
 * Encrypt, then immediately read the result back.
 *
 * `encryptSecret` alone is enough everywhere the plaintext is still on screen:
 * if the write went wrong you retype the key you just pasted. Re-encrypting an
 * existing blob under a new passphrase has no such second copy — the keys come
 * out of the old blob, the old blob is overwritten, and a ciphertext that seals
 * but will not open takes every key with it and cannot be told from a forgotten
 * passphrase afterwards.
 *
 * One extra derivation, once, on the rarest operation in the plugin.
 */
export async function encryptSecretVerified(plaintext: string, passphrase: string): Promise<SecretBlob> {
	const blob = await encryptSecret(plaintext, passphrase);
	let readBack: string;
	try {
		readBack = await decryptSecret(blob, passphrase);
	} catch {
		throw new ResealError();
	}
	if (readBack !== plaintext) throw new ResealError();
	return blob;
}

/** The new blob would not open. Raised before anything is written. */
export class ResealError extends Error {
	constructor() {
		super("The re-encrypted keys could not be read back.");
		this.name = "ResealError";
	}
}

export class WrongPassphraseError extends Error {
	constructor() {
		super("That passphrase didn't unlock the key.");
		this.name = "WrongPassphraseError";
	}
}

/* ------------------------------------------------------------------ */
/* Redaction                                                           */
/* ------------------------------------------------------------------ */

const guarded = new Set<string>();

/**
 * Register a live secret so `redact` can strip it. Called whenever a key is
 * unlocked or entered. Short strings are ignored — redacting a 3-character
 * value would mangle unrelated text.
 */
export function guardSecret(secret: string | undefined | null): void {
	if (secret && secret.length >= 8) guarded.add(secret);
}

export function forgetGuarded(): void {
	guarded.clear();
}

/**
 * Strip every known secret from a string. Run this over anything heading for
 * the console, a Notice, or a rendered error block — TMDB v3 puts the key in
 * the query string, so a failed request's URL is itself a leak.
 */
export function redact(input: unknown): string {
	let s =
		input instanceof Error
			? `${input.message}`
			: typeof input === "string"
				? input
				: String(input);
	for (const secret of guarded) s = s.split(secret).join("«api-key»");
	// Belt and braces: catch a key we were never told about but that appears in
	// a URL we built, and bearer tokens in any header dump.
	s = s.replace(/([?&]api_key=)[^&\s]+/gi, "$1«api-key»");
	s = s.replace(/(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, "$1«token»");
	return s;
}

/** Mask for display: `eyJhbGciOi…9Zx1` — enough to recognise, not to use. */
export function maskSecret(secret: string): string {
	if (!secret) return "";
	if (secret.length <= 12) return "•".repeat(secret.length);
	return `${secret.slice(0, 6)}…${secret.slice(-4)}`;
}
