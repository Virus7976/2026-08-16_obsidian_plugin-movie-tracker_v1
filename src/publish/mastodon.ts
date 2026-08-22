/**
 * Mastodon — the same review, said to people rather than to a database.
 *
 * Trakt files a review against a film. Mastodon puts a sentence in front of
 * whoever follows you, most of whom have no idea what you have been watching,
 * which is why `composeMastodon` leads with the title and the stars instead of
 * assuming any of that is known. Two destinations, two genuinely different
 * posts, one review behind them.
 *
 * Simpler than Trakt in every respect: one access token you generate yourself
 * in your instance's own settings, one POST, no refresh, no device dance. The
 * host is kept in settings rather than in the credential store — which server
 * you are on is not a secret, and putting it behind the passphrase would mean
 * unlocking the vault to render a settings label.
 */

import { requestUrl } from "obsidian";
import type ReelPlugin from "../main";
import { redact } from "../secrets";
import { composeMastodon, MASTODON_DEFAULT_LIMIT, type Composed, type PublishPayload } from "./compose";

export class MastodonError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = "MastodonError";
	}
}

/**
 * A host, cleaned up into the one shape the API calls can use.
 *
 * People paste all of these: `mastodon.social`, `https://mastodon.social`,
 * `https://mastodon.social/`, `@me@mastodon.social`. Rejecting four out of five
 * with "invalid host" would be technically correct and useless.
 */
export function normaliseHost(raw: string): string {
	let host = (raw ?? "").trim();
	if (!host) return "";
	host = host.replace(/^https?:\/\//i, "");
	/*
	 * The path goes before the handle is unwrapped, and the order is not
	 * arbitrary — it was the other way round and a pasted profile URL,
	 * "https://mastodon.social/@me", parsed to the host "me". Everything after
	 * the first slash is discarded first, so the @ rule below only ever sees an
	 * actual handle.
	 */
	host = host.split("/")[0];
	// "@you@instance" and "you@instance" both end with the bit we want.
	if (host.includes("@")) host = host.slice(host.lastIndexOf("@") + 1);
	return host.toLowerCase();
}

export class MastodonClient {
	/** Instance character limits, per host. They do not change mid-session. */
	private limits = new Map<string, number>();

	constructor(private plugin: ReelPlugin) {}

	private get host(): string {
		return normaliseHost(this.plugin.settings.mastodonHost);
	}

	/**
	 * The instance's real character limit, or the default if it won't say.
	 *
	 * Worth one request. Instances vary from 500 up to several thousand, and
	 * truncating a review to 500 characters on a server that would have taken
	 * the whole thing is a silent loss of your own writing — the kind of bug
	 * nobody reports because the post looks fine.
	 */
	async limit(): Promise<number> {
		const host = this.host;
		if (!host) return MASTODON_DEFAULT_LIMIT;
		const known = this.limits.get(host);
		if (known) return known;

		try {
			const res = await requestUrl({
				url: `https://${host}/api/v2/instance`,
				method: "GET",
				headers: { Accept: "application/json" },
				throw: false,
			});
			const max = Number(res.json?.configuration?.statuses?.max_characters);
			const value = Number.isFinite(max) && max > 0 ? max : MASTODON_DEFAULT_LIMIT;
			this.limits.set(host, value);
			return value;
		} catch {
			// An instance that won't answer is not a reason to refuse to post.
			return MASTODON_DEFAULT_LIMIT;
		}
	}

	async preview(payload: PublishPayload): Promise<Composed> {
		return composeMastodon(payload, {
			limit: await this.limit(),
			hashtags: this.plugin.settings.publishHashtags,
		});
	}

	/**
	 * Post it.
	 *
	 * `Idempotency-Key` is the interesting part. A phone on a bad connection
	 * times out after the server has already accepted the post, Reel shows a
	 * failure, you tap again — and without this you have posted the same review
	 * twice. Mastodon dedupes on that header for a few minutes, so the retry
	 * returns the post that already exists instead of making another.
	 *
	 * The key is derived from what is being posted rather than from a random
	 * value, so the retry genuinely carries the same one.
	 */
	async publish(payload: PublishPayload): Promise<{ url?: string }> {
		const host = this.host;
		if (!host) throw new MastodonError("No Mastodon instance set. Add one in Settings → Reel.");

		const token = await this.plugin.credentials.getOptional("mastodon");
		if (!token) throw new MastodonError("No Mastodon access token. Add one in Settings → Reel.");

		const composed = await this.preview(payload);
		if (!composed.text.trim()) throw new MastodonError("There's nothing written to post.");

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
			"Idempotency-Key": idempotencyKey(payload),
		};

		const body: Record<string, unknown> = {
			status: composed.text,
			visibility: "public",
		};
		/*
		 * A spoiler goes behind Mastodon's content warning rather than into the
		 * text. That is what the field is for, and it is the difference between
		 * warning someone and spoiling them while saying the word "spoiler".
		 */
		if (payload.spoiler) body.spoiler_text = `Spoilers — ${payload.entry.title}`;

		let res;
		try {
			res = await requestUrl({
				url: `https://${host}/api/v1/statuses`,
				method: "POST",
				headers,
				body: JSON.stringify(body),
				throw: false,
			});
		} catch (e) {
			throw new MastodonError(redact(e));
		}

		if (res.status === 401) {
			throw new MastodonError("Mastodon rejected the token. Check it in Settings → Reel.", 401);
		}
		if (res.status === 403) throw new MastodonError("That token isn't allowed to post (403).", 403);
		if (res.status === 422) throw new MastodonError("Mastodon wouldn't accept that post (422).", 422);
		if (res.status === 429) throw new MastodonError("Mastodon rate limit hit. Wait a moment.", 429);
		if (res.status >= 400) throw new MastodonError(redact(`Mastodon error ${res.status}.`), res.status);

		const url = typeof res.json?.url === "string" ? res.json.url : undefined;
		return { url };
	}
}

/**
 * A stable key for one intended post.
 *
 * Same film, same date, same words means the same key, which is exactly when a
 * second request is a retry rather than a second opinion. Editing the review
 * changes the key, because that genuinely is a different post.
 *
 * A plain string hash rather than a crypto digest: this only has to be stable
 * and unlikely to collide across a handful of posts, and it has to be
 * synchronous inside a header build.
 */
export function idempotencyKey(payload: PublishPayload): string {
	const seed = `${payload.entry.tmdbId}|${payload.date ?? ""}|${payload.rating ?? ""}|${payload.text.trim()}`;
	let h1 = 0x811c9dc5;
	let h2 = 0x01000193;
	for (let i = 0; i < seed.length; i++) {
		const c = seed.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
		h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
	}
	return `reel-${h1.toString(36)}${h2.toString(36)}`;
}
