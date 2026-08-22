/**
 * Publishing a review, and the rules around letting it happen at all.
 *
 * Every other write in this plugin lands in your own vault, where the worst
 * case is a file you can edit back. This one leaves, and once it has left there
 * is no version of "undo" that reaches the people who already read it. So the
 * shape here is deliberately unlike the rest of the app:
 *
 *   Nothing publishes as a side effect. There is no auto-post-on-rate, no
 *   "publish everything since Tuesday". A review goes out because you looked at
 *   the exact text and pressed the button under it.
 *
 *   Nothing publishes twice. The resulting URL is written back into the note's
 *   frontmatter per target, so the button knows it has already been and says so
 *   instead of quietly posting a duplicate.
 *
 *   A target that fails does not take the others down with it. Mastodon being
 *   unreachable is not a reason to abandon a Trakt post that already worked,
 *   and the result says plainly which went and which did not.
 */

import { TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { PUBLISHED_KEY, traktComplaint, type Composed, type PublishPayload } from "./compose";
import { MastodonClient, normaliseHost } from "./mastodon";
import { parseApp, parseToken, TraktClient } from "./trakt";

export type TargetId = "trakt" | "mastodon";

export interface TargetInfo {
	id: TargetId;
	label: string;
	/** Turned on in settings. Says nothing about whether it can actually post. */
	enabled: boolean;
	/** Why it can't post right now, in a sentence. Null when it can. */
	blocker: string | null;
}

export interface PublishOutcome {
	id: TargetId;
	label: string;
	ok: boolean;
	url?: string;
	error?: string;
}

export class PublishService {
	readonly trakt: TraktClient;
	readonly mastodon: MastodonClient;

	constructor(private plugin: ReelPlugin) {
		this.trakt = new TraktClient(plugin);
		this.mastodon = new MastodonClient(plugin);
	}

	/** Is publishing worth showing at all? False means the UI stays out of the way. */
	get anyEnabled(): boolean {
		const s = this.plugin.settings;
		return s.publishTrakt || s.publishMastodon;
	}

	/**
	 * What each target's situation is, without unlocking anything.
	 *
	 * `credentials.has` answers from the stored *names*, not the values, so this
	 * can be called while the vault is locked — which matters, because the whole
	 * point is to render an honest button before asking for a passphrase.
	 */
	targets(): TargetInfo[] {
		const s = this.plugin.settings;
		const creds = this.plugin.credentials;
		const out: TargetInfo[] = [];

		if (s.publishTrakt) {
			let blocker: string | null = null;
			if (!creds.has("traktApp")) blocker = "No Trakt application yet — add one in Settings → Reel.";
			else if (!creds.has("trakt")) blocker = "Not signed in to Trakt — sign in from Settings → Reel.";
			out.push({ id: "trakt", label: "Trakt", enabled: true, blocker });
		}

		if (s.publishMastodon) {
			let blocker: string | null = null;
			if (!normaliseHost(s.mastodonHost)) blocker = "No Mastodon instance set — add one in Settings → Reel.";
			else if (!creds.has("mastodon")) blocker = "No Mastodon access token — add one in Settings → Reel.";
			out.push({ id: "mastodon", label: "Mastodon", enabled: true, blocker });
		}

		return out;
	}

	/** The ones that could actually post right now. */
	ready(): TargetInfo[] {
		return this.targets().filter((t) => !t.blocker);
	}

	/**
	 * The exact text each target would send.
	 *
	 * Asked for before anything is posted, and rendered verbatim in the confirm
	 * sheet. A preview that is *regenerated* rather than reused would be a
	 * preview of a different post than the one that goes — so the caller passes
	 * this same object straight into `publish`.
	 */
	async preview(payload: PublishPayload, id: TargetId): Promise<Composed> {
		if (id === "trakt") return this.trakt.preview(payload);
		return this.mastodon.preview(payload);
	}

	/** Why this particular review would be refused, per target. Null when fine. */
	complaint(payload: PublishPayload, id: TargetId): string | null {
		if (id === "trakt") return traktComplaint(payload);
		return payload.text.trim() ? null : "There's nothing written to post.";
	}

	/**
	 * Send it, to each chosen target, one at a time.
	 *
	 * Sequential rather than parallel, on purpose. These are two separate
	 * public acts, and if the first one fails in a way that suggests the review
	 * is wrong — Trakt refusing it as too short — running the second
	 * concurrently means the bad post is already on Mastodon before the failure
	 * is even read. One at a time is slower by a second and correct.
	 */
	async publish(payload: PublishPayload, ids: TargetId[]): Promise<PublishOutcome[]> {
		const out: PublishOutcome[] = [];
		for (const id of ids) {
			const label = id === "trakt" ? "Trakt" : "Mastodon";
			try {
				const result = id === "trakt" ? await this.trakt.publish(payload) : await this.mastodon.publish(payload);
				out.push({ id, label, ok: true, url: result.url });
			} catch (e) {
				out.push({ id, label, ok: false, error: messageOf(e) });
			}
		}
		await this.record(payload.entry, out);
		return out;
	}

	/**
	 * Write the resulting URLs into the note.
	 *
	 * Only the successes, and only ones that came back with a URL. Recording a
	 * failure as "published" would make the button refuse to try again, which is
	 * precisely the wrong direction to fail in: the cost of an unrecorded
	 * success is a duplicate you can delete, and the cost of a recorded failure
	 * is a review that can never be posted.
	 */
	private async record(entry: Entry, outcomes: PublishOutcome[]): Promise<void> {
		const wins = outcomes.filter((o) => o.ok && o.url);
		if (!wins.length) return;

		const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
		if (!(file instanceof TFile)) return;

		await this.plugin.notes.edit(file, `recording where ${entry.title} was published`, (fm) => {
			const existing = (fm[PUBLISHED_KEY] as Record<string, unknown> | undefined) ?? {};
			const next: Record<string, string> = {};
			for (const [k, v] of Object.entries(existing)) {
				if (typeof v === "string") next[k] = v;
			}
			for (const w of wins) next[w.id] = w.url as string;
			fm[PUBLISHED_KEY] = next;
		});
	}

	/** Where this title has already been posted, if anywhere. */
	publishedTo(entry: Entry): Record<string, string> {
		const cache = this.plugin.app.metadataCache;
		const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
		if (!(file instanceof TFile)) return {};
		const fm = cache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
		const raw = fm?.[PUBLISHED_KEY];
		if (!raw || typeof raw !== "object") return {};
		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
			if (typeof v === "string" && v) out[k] = v;
		}
		return out;
	}

	/** Both credentials that can act as you, dropped. */
	async signOut(): Promise<void> {
		await this.plugin.credentials.remove("trakt");
		this.plugin.settings.traktExpires = 0;
		await this.plugin.saveSettings();
	}

	/**
	 * Store the token, and record its expiry where the screen can see it.
	 *
	 * The expiry lives beside the credential rather than only inside it. It is
	 * not a secret — it is a date, and anybody could infer it by watching the
	 * plugin stop working — and the settings screen has to answer "are you
	 * signed in" while the vault is locked. Reading it out of the encrypted
	 * token would mean demanding a passphrase in order to draw one row.
	 *
	 * Until this existed, "Signed in to Trakt" meant "a token is stored", which
	 * stays true forever, including long after the session it refers to has
	 * expired.
	 */
	async storeToken(json: string): Promise<boolean> {
		const ok = await this.plugin.credentials.store("trakt", json);
		if (ok) {
			this.plugin.settings.traktExpires = parseToken(json)?.expires ?? 0;
			await this.plugin.saveSettings();
		}
		return ok;
	}

	appConfigured(): boolean {
		return this.plugin.credentials.has("traktApp");
	}

	async app(): Promise<ReturnType<typeof parseApp>> {
		return parseApp(await this.plugin.credentials.getOptional("traktApp"));
	}

	async token(): Promise<ReturnType<typeof parseToken>> {
		return parseToken(await this.plugin.credentials.getOptional("trakt"));
	}
}

function messageOf(e: unknown): string {
	if (e instanceof Error) return e.message;
	return String(e);
}
