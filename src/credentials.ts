/**
 * Runtime holder for every API credential.
 *
 * Reel now talks to three services — TMDB, OMDb and DoesTheDogDie — so this
 * holds a *map* of keys rather than one. They share a single encrypted blob and
 * therefore a single passphrase: three separate unlock prompts for one library
 * screen would be intolerable, and splitting them buys no real security, since
 * anything that can read one can read the others.
 *
 * Plaintext lives in one private field, is registered with `guardSecret` so it
 * can be scrubbed from errors, and is dropped on unload.
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

export type KeyName = "tmdb" | "omdb" | "dtdd" | "openrouter" | "trakt" | "traktApp" | "mastodon";

export const KEY_LABELS: Record<KeyName, string> = {
	tmdb: "TMDB",
	omdb: "OMDb",
	dtdd: "DoesTheDogDie",
	openrouter: "OpenRouter",
	trakt: "Trakt",
	traktApp: "Trakt app",
	mastodon: "Mastodon",
};

/**
 * The keys that fetch data, as opposed to the ones that act on your behalf.
 *
 * Worth the distinction in the UI: a TMDB key can only ever read a public
 * catalogue, while a Trakt token can post under your name. Grouping them
 * together in one list of pills would flatten that difference into nothing.
 */
export const READ_KEYS: KeyName[] = ["tmdb", "omdb", "dtdd", "openrouter"];
export const WRITE_KEYS: KeyName[] = ["trakt", "traktApp", "mastodon"];

export type KeyBundle = Partial<Record<KeyName, string>>;

export class MissingKeyError extends Error {
	constructor(readonly key: KeyName = "tmdb", msg?: string) {
		super(msg ?? `No ${KEY_LABELS[key]} key. Add one in Settings → Reel.`);
		this.name = "MissingKeyError";
	}
}

export class CredentialStore {
	private plaintext: KeyBundle | null = null;
	private pending: Promise<KeyBundle> | null = null;

	constructor(private plugin: ReelPlugin) {}

	get mode(): KeyMode {
		return this.plugin.settings.keyMode;
	}

	get isUnlocked(): boolean {
		return !!this.plaintext;
	}

	/**
	 * Would reading a key right now mean interrupting you?
	 *
	 * `has()` answers whether a service is configured and stays true while the
	 * vault is sealed, which is correct and is also the trap: anything deciding
	 * what it can *do* by asking what exists will act as though the keys are in
	 * hand, reach for one, and summon a passphrase prompt out of a screen the
	 * person was only reading.
	 *
	 * Plain text is never locked, and session mode counts as locked before its
	 * first key is entered, because the interruption is the same either way —
	 * a modal in front of whatever you were doing.
	 */
	get needsUnlock(): boolean {
		if (this.plaintext) return false;
		if (this.mode === "plain") return false;
		// Nothing stored is not the same as sealed. A fresh install has no blob
		// and no passphrase, and offering to unlock it would be offering a door
		// where there is no wall.
		if (this.mode === "encrypted") return !!this.plugin.settings.keyBlob;
		return true;
	}

	/**
	 * Ask for the passphrase on purpose.
	 *
	 * The prompt already existed but only as a side effect of needing a key, so
	 * unlocking was something you achieved by trying to do something else and
	 * waiting to be stopped. Returns whether the keys are readable afterwards;
	 * a cancelled prompt is a false, not an error, because deciding not to
	 * unlock is an ordinary answer.
	 */
	async unlock(): Promise<boolean> {
		try {
			await this.bundle();
			return true;
		} catch {
			return false;
		}
	}

	get hasStoredKey(): boolean {
		const s = this.plugin.settings;
		return !!(s.keyBlob || (s.keysPlain && Object.keys(s.keysPlain).length));
	}

	/** Is a given service configured? Answerable without unlocking. */
	has(name: KeyName): boolean {
		const s = this.plugin.settings;
		if (this.plaintext) return !!this.plaintext[name];
		if (s.keysPlain?.[name]) return true;
		// Encrypted mode can't know without unlocking, so we track which names
		// were stored alongside the blob. Names are not secret; values are.
		return s.keyNames?.includes(name) ?? false;
	}

	/** Resolve one key, prompting if needed. Concurrent callers share a prompt. */
	async get(name: KeyName = "tmdb"): Promise<string> {
		const bundle = await this.bundle();
		const value = bundle[name];
		if (!value) throw new MissingKeyError(name);
		return value;
	}

	/** Resolve a key, or null if it isn't configured — for optional services. */
	async getOptional(name: KeyName): Promise<string | null> {
		if (!this.has(name)) return null;
		try {
			return await this.get(name);
		} catch {
			return null;
		}
	}

	private async bundle(): Promise<KeyBundle> {
		if (this.plaintext) return this.plaintext;
		if (this.pending) return this.pending;
		this.pending = this.resolve().finally(() => {
			this.pending = null;
		});
		return this.pending;
	}

	private async resolve(): Promise<KeyBundle> {
		const s = this.plugin.settings;

		if (s.keyMode === "plain") {
			if (!s.keysPlain || !Object.keys(s.keysPlain).length) throw new MissingKeyError();
			return this.adopt(s.keysPlain);
		}

		if (s.keyMode === "session") {
			const entered = await PassphraseModal.prompt(this.plugin.app, {
				title: "TMDB key",
				body: "Session-only storage: keys are held in memory until Obsidian restarts, and never written to disk.",
				placeholder: "Paste your TMDB key or read access token",
				cta: "Use key",
			});
			if (!entered) throw new MissingKeyError("tmdb", "Cancelled — no key entered.");
			return this.adopt({ tmdb: entered.trim() });
		}

		if (!s.keyBlob) throw new MissingKeyError();
		for (let attempt = 0; attempt < 3; attempt++) {
			const pass = await PassphraseModal.prompt(this.plugin.app, {
				title: "Unlock API keys",
				body:
					attempt === 0
						? "Your keys are encrypted in this vault. Enter the passphrase to unlock them for this session."
						: "That didn't work. Try again.",
				placeholder: "Passphrase",
				cta: "Unlock",
				password: true,
			});
			if (!pass) throw new MissingKeyError("tmdb", "Cancelled — keys stay locked.");
			try {
				const decrypted = await decryptSecret(s.keyBlob, pass);
				return this.adopt(parseBundle(decrypted));
			} catch (e) {
				if (!(e instanceof WrongPassphraseError)) throw e;
			}
		}
		throw new MissingKeyError("tmdb", "Too many failed attempts. Keys stay locked.");
	}

	private adopt(bundle: KeyBundle): KeyBundle {
		const clean: KeyBundle = {};
		for (const [k, v] of Object.entries(bundle)) {
			const trimmed = String(v).trim();
			if (!trimmed) continue;
			clean[k as KeyName] = trimmed;
			guardSecret(trimmed);
		}
		this.plaintext = clean;
		return clean;
	}

	/**
	 * Store or replace one key, keeping the others. Returns false if the user
	 * cancelled the passphrase prompt.
	 */
	async store(name: KeyName, key: string): Promise<boolean> {
		const trimmed = key.trim();
		if (!trimmed) return false;
		const s = this.plugin.settings;

		// Start from whatever is already held, so setting OMDb doesn't drop TMDB.
		let existing: KeyBundle = {};
		if (this.plaintext) existing = { ...this.plaintext };
		else if (this.hasStoredKey) {
			try {
				existing = { ...(await this.bundle()) };
			} catch {
				return false; // couldn't unlock; refuse rather than overwrite
			}
		}
		const next: KeyBundle = { ...existing, [name]: trimmed };

		return this.writeBundle(next, s.keyMode);
	}

	async remove(name: KeyName): Promise<void> {
		let existing: KeyBundle = {};
		if (this.plaintext) existing = { ...this.plaintext };
		else if (this.hasStoredKey) {
			try {
				existing = { ...(await this.bundle()) };
			} catch {
				return;
			}
		}
		delete existing[name];
		await this.writeBundle(existing, this.plugin.settings.keyMode);
	}

	private async writeBundle(bundle: KeyBundle, mode: KeyMode): Promise<boolean> {
		const s = this.plugin.settings;

		if (mode === "plain") {
			s.keysPlain = bundle;
			s.keyBlob = null;
		} else if (mode === "session") {
			// Session mode means "hold these in memory only", so clearing what
			// is on disk is the whole point rather than an accident.
			s.keysPlain = null;
			s.keyBlob = null;
			s.keyNames = Object.keys(bundle) as KeyName[];
			this.adopt(bundle);
			await this.plugin.saveSettings({ clearingKeys: true });
			return true;
		} else {
			const pass = await PassphraseModal.prompt(this.plugin.app, {
				title: this.hasStoredKey ? "Confirm passphrase" : "Set a passphrase",
				body:
					"This encrypts your keys inside the vault with AES-256-GCM. You'll enter it once per session. " +
					"There is no recovery — if you forget it, you re-enter the keys instead.",
				placeholder: this.hasStoredKey ? "Passphrase" : "Choose a passphrase",
				cta: "Encrypt and save",
				password: true,
				confirm: !this.hasStoredKey,
			});
			if (!pass) return false;
			s.keyBlob = await encryptSecret(JSON.stringify(bundle), pass);
			s.keysPlain = null;
		}

		// Names are not secret, and knowing which services are configured
		// without unlocking is what lets the UI stay honest while locked.
		s.keyNames = Object.keys(bundle) as KeyName[];
		this.adopt(bundle);
		await this.plugin.saveSettings();
		return true;
	}

	/**
	 * Move stored keys to a different mode. Nothing is discarded until the
	 * re-store succeeds — see the note in migrateTo's history: cancelling
	 * either prompt used to destroy the only copy.
	 */
	async migrateTo(next: KeyMode): Promise<void> {
		const s = this.plugin.settings;
		const prev = s.keyMode;
		if (prev === next) return;

		const prevPlain = s.keysPlain;
		const prevBlob = s.keyBlob;
		const hadKey = this.hasStoredKey;

		let bundle: KeyBundle | null = this.plaintext;
		if (!bundle && hadKey) {
			try {
				bundle = await this.bundle();
			} catch {
				new Notice("Reel: couldn't unlock the existing keys, so the storage mode is unchanged.");
				return;
			}
		}

		s.keyMode = next;
		s.keysPlain = null;
		s.keyBlob = null;

		if (bundle && Object.keys(bundle).length) {
			const ok = await this.writeBundle(bundle, next);
			if (!ok) {
				s.keyMode = prev;
				s.keysPlain = prevPlain;
				s.keyBlob = prevBlob;
				await this.plugin.saveSettings();
				new Notice("Reel: storage mode unchanged — your keys were left as they were.");
				return;
			}
			return;
		}

		if (!hadKey) await this.plugin.saveSettings();
	}

	async clear(): Promise<void> {
		const s = this.plugin.settings;
		s.keysPlain = null;
		s.keyBlob = null;
		s.keyNames = [];
		this.plaintext = null;
		forgetGuarded();
		// The one place the user genuinely means to lose them.
		await this.plugin.saveSettings({ clearingKeys: true });
	}

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

/**
 * Decode a stored bundle.
 *
 * Blobs written before multi-key support hold a bare TMDB token, not JSON, so
 * anything that doesn't parse as an object is treated as that. Without this a
 * v0.2 upgrade would silently lose the key it already had.
 */
export function parseBundle(decrypted: string): KeyBundle {
	const text = decrypted.trim();
	if (!text.startsWith("{")) return { tmdb: text };
	try {
		const parsed = JSON.parse(text) as Record<string, unknown>;
		const out: KeyBundle = {};
		// Every known name, derived from one list rather than a second
		// hand-kept copy. A literal here would decrypt the bundle correctly and
		// then drop any name added later on the way past — which presents as
		// "the plugin forgot my token" and sends you looking at the crypto.
		for (const name of [...READ_KEYS, ...WRITE_KEYS]) {
			const v = parsed[name];
			if (typeof v === "string" && v.trim()) out[name] = v.trim();
		}
		return out;
	} catch {
		return { tmdb: text };
	}
}

export type { SecretBlob, KeyMode };
