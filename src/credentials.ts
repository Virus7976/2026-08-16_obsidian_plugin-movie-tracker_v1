/**
 * The runtime holder for the TMDB credential.
 *
 * Nothing outside this file ever touches the plaintext key except `tmdb.ts`,
 * which asks for it per request and never stores it. The plaintext lives in one
 * private field, is registered with `guardSecret` so it can be redacted out of
 * errors, and is dropped on unload.
 */

import { Notice } from "obsidian";
import type ReelPlugin from "./main";
import {
	decryptSecret,
	encryptSecret,
	guardSecret,
	forgetGuarded,
	KeyMode,
	SecretBlob,
	WrongPassphraseError,
} from "./secrets";
import { PassphraseModal } from "./ui/passphraseModal";

export class MissingKeyError extends Error {
	constructor(msg = "No TMDB key. Add one in Settings → Reel.") {
		super(msg);
		this.name = "MissingKeyError";
	}
}

export class CredentialStore {
	private plaintext: string | null = null;
	/** De-duplicates concurrent unlock prompts — the grid can fire many requests at once. */
	private pending: Promise<string> | null = null;

	constructor(private plugin: ReelPlugin) {}

	get mode(): KeyMode {
		return this.plugin.settings.keyMode;
	}

	/** True if a key is available right now without prompting. */
	get isUnlocked(): boolean {
		return !!this.plaintext;
	}

	/** True if there is *something* stored, locked or not. */
	get hasStoredKey(): boolean {
		const s = this.plugin.settings;
		return !!(s.keyPlain || s.keyBlob);
	}

	/**
	 * Resolve the key, prompting if needed. Every TMDB call goes through here.
	 * Concurrent callers share one prompt.
	 */
	async get(): Promise<string> {
		if (this.plaintext) return this.plaintext;
		if (this.pending) return this.pending;

		this.pending = this.resolve().finally(() => {
			this.pending = null;
		});
		return this.pending;
	}

	private async resolve(): Promise<string> {
		const s = this.plugin.settings;

		if (s.keyMode === "plain") {
			if (!s.keyPlain) throw new MissingKeyError();
			return this.adopt(s.keyPlain);
		}

		if (s.keyMode === "session") {
			const entered = await PassphraseModal.prompt(this.plugin.app, {
				title: "TMDB key",
				body: "Session-only storage: the key is held in memory until Obsidian restarts, and never written to disk.",
				placeholder: "Paste your TMDB key or read access token",
				cta: "Use key",
			});
			if (!entered) throw new MissingKeyError("Cancelled — no key entered.");
			return this.adopt(entered);
		}

		// encrypted
		if (!s.keyBlob) throw new MissingKeyError();
		for (let attempt = 0; attempt < 3; attempt++) {
			const pass = await PassphraseModal.prompt(this.plugin.app, {
				title: "Unlock TMDB key",
				body:
					attempt === 0
						? "Your key is encrypted in this vault. Enter the passphrase to unlock it for this session."
						: "That didn't work. Try again.",
				placeholder: "Passphrase",
				cta: "Unlock",
				password: true,
			});
			if (!pass) throw new MissingKeyError("Cancelled — key stays locked.");
			try {
				const key = await decryptSecret(s.keyBlob, pass);
				return this.adopt(key);
			} catch (e) {
				if (!(e instanceof WrongPassphraseError)) throw e;
			}
		}
		throw new MissingKeyError("Too many failed attempts. Key stays locked.");
	}

	private adopt(key: string): string {
		const trimmed = key.trim();
		this.plaintext = trimmed;
		guardSecret(trimmed);
		return trimmed;
	}

	/**
	 * Store a new key under the current mode. Returns false if the user
	 * cancelled the passphrase prompt in encrypted mode.
	 */
	async store(key: string): Promise<boolean> {
		const trimmed = key.trim();
		if (!trimmed) return false;
		const s = this.plugin.settings;

		if (s.keyMode === "plain") {
			s.keyPlain = trimmed;
			s.keyBlob = null;
		} else if (s.keyMode === "session") {
			s.keyPlain = null;
			s.keyBlob = null;
		} else {
			const pass = await PassphraseModal.prompt(this.plugin.app, {
				title: "Set a passphrase",
				body:
					"This encrypts the key inside your vault with AES-256-GCM. You'll enter it once per session. " +
					"There is no recovery — if you forget it, you re-enter the TMDB key instead.",
				placeholder: "Choose a passphrase",
				cta: "Encrypt and save",
				password: true,
				confirm: true,
			});
			if (!pass) return false;
			s.keyBlob = await encryptSecret(trimmed, pass);
			s.keyPlain = null;
		}

		this.adopt(trimmed);
		await this.plugin.saveSettings();
		return true;
	}

	/**
	 * Re-encrypt / move the stored key when the mode changes.
	 *
	 * The stored key is the only copy — there is no recovery — so nothing is
	 * discarded until the re-store has actually succeeded. Both prompts
	 * involved (unlocking the old key, choosing a new passphrase) can be
	 * cancelled, and a cancel must leave the existing key exactly as it was
	 * rather than destroying it as a side effect of touching a dropdown.
	 */
	async migrateTo(next: KeyMode): Promise<void> {
		const s = this.plugin.settings;
		const prev = s.keyMode;
		if (prev === next) return;

		const prevPlain = s.keyPlain;
		const prevBlob = s.keyBlob;
		const hadKey = this.hasStoredKey;

		let key: string | null = this.plaintext;
		if (!key && hadKey) {
			try {
				key = await this.get();
			} catch {
				// Locked and the user declined. Abort — switching the mode now
				// would strand a key we can no longer read.
				new Notice("Reel: couldn't unlock the existing key, so the storage mode is unchanged.");
				return;
			}
		}

		s.keyMode = next;
		s.keyPlain = null;
		s.keyBlob = null;

		if (key) {
			const ok = await this.store(key);
			if (!ok) {
				// Re-store was cancelled — put everything back.
				s.keyMode = prev;
				s.keyPlain = prevPlain;
				s.keyBlob = prevBlob;
				await this.plugin.saveSettings();
				new Notice("Reel: storage mode unchanged — the key was left as it was.");
				return;
			}
			return; // store() already saved
		}

		// Nothing was stored to begin with; just record the new mode.
		if (!hadKey) await this.plugin.saveSettings();
	}

	/** Wipe everything, on disk and in memory. */
	async clear(): Promise<void> {
		const s = this.plugin.settings;
		s.keyPlain = null;
		s.keyBlob = null;
		this.plaintext = null;
		forgetGuarded();
		await this.plugin.saveSettings();
	}

	/** Drop the in-memory copy but keep what's on disk. */
	lock(): void {
		this.plaintext = null;
		forgetGuarded();
	}

	unload(): void {
		this.plaintext = null;
		this.pending = null;
		forgetGuarded();
	}
}

export type { SecretBlob, KeyMode };
