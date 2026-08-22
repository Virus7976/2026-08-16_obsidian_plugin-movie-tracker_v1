/**
 * Whether Reel's connections actually work, and when anybody last checked.
 *
 * Two separate lies were being told on the settings screen, and they are the
 * same lie in different clothes.
 *
 * "Test connections" made one small request per service and reported the
 * result in a Notice that disappeared after eight seconds. So the answer
 * existed for eight seconds and then the screen went back to looking exactly
 * as it had before — no record, no history, and no way to tell "I tested this
 * and it worked" from "I have never tested this".
 *
 * "Signed in to Trakt" was `credentials.has("trakt")`: a token is stored.
 * Tokens expire. A token that expired months ago is still stored, so the row
 * went on saying you were signed in, and the first you heard otherwise was a
 * review failing to publish. The expiry was sitting inside the token the whole
 * time, unread.
 *
 * Both are the same shape of mistake: reporting the presence of a thing as
 * though it were the health of the thing. This module holds the difference.
 *
 * Everything here is pure and takes `now` as an argument. Relative times are
 * the classic source of tests that pass all year and fail in one timezone on
 * one day, and the only defence is not reading the clock in the first place.
 */

import type { FeatureId } from "./setup";

/**
 * The services Reel can actually check.
 *
 * Not every feature. OpenRouter, Trakt and Mastodon have no cheap test
 * request, and listing them so the table looks even would mean inventing
 * network calls to fill rows. Trakt is answered a better way anyway — its
 * token knows its own expiry, which is exact where a request would only be
 * suggestive.
 */
export const TESTABLE: FeatureId[] = ["tmdb", "omdb", "dtdd"];

export interface HealthRecord {
	/** When the check ran. Epoch milliseconds. */
	at: number;
	ok: boolean;
	/** Why it failed, already redacted. Absent when it worked. */
	error?: string;
}

export type HealthMap = Partial<Record<FeatureId, HealthRecord>>;

/**
 * How long a result stays worth believing.
 *
 * A key that worked a fortnight ago tells you almost nothing about today — it
 * may have been revoked, rate-limited, or run out of credit. Rather than
 * expire the record and show nothing, it keeps saying what it saw and says how
 * long ago, which is the honest version and also the more useful one.
 */
export const STALE_AFTER = 14 * 24 * 60 * 60 * 1000;

/**
 * "3 days ago", and deliberately coarse.
 *
 * Nobody needs "2 days, 4 hours and 11 minutes ago" for this, and the extra
 * precision reads as though the number matters more than it does.
 */
export function ago(then: number, now: number): string {
	const ms = Math.max(0, now - then);
	const min = Math.floor(ms / 60000);
	if (min < 1) return "just now";
	if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
	const day = Math.floor(hr / 24);
	if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
	const mon = Math.floor(day / 30);
	return `${mon} month${mon === 1 ? "" : "s"} ago`;
}

export interface Said {
	text: string;
	tone: "ok" | "warn" | "info";
}

/**
 * What to say about one service.
 *
 * `configured` is separate from the record on purpose. A service you have not
 * set up is not unhealthy, and saying "never checked" about something you
 * deliberately never enabled is noise dressed as a warning.
 */
export function describeHealth(rec: HealthRecord | undefined, configured: boolean, now: number): Said {
	if (!configured) return { text: "Not set up", tone: "info" };
	if (!rec) return { text: "Not checked yet", tone: "info" };

	const when = ago(rec.at, now);
	if (!rec.ok) return { text: `Failed ${when}${rec.error ? ` — ${rec.error}` : ""}`, tone: "warn" };
	// Still reported, still says when. A fortnight-old pass is evidence, just
	// weaker evidence, and hiding it would leave the row looking unchecked.
	if (now - rec.at > STALE_AFTER) return { text: `Worked ${when}`, tone: "info" };
	return { text: `Working — checked ${when}`, tone: "ok" };
}

/* ------------------------------------------------------------------ */
/* Trakt, whose token knows when it dies                               */
/* ------------------------------------------------------------------ */

export type TraktState =
	| { kind: "out" }
	| { kind: "unknown" }
	| { kind: "in"; expires: number }
	| { kind: "soon"; expires: number }
	| { kind: "expired"; expires: number };

/** Reel refreshes a day early, so "soon" has to be comfortably wider. */
const SOON = 7 * 24 * 60 * 60 * 1000;

/**
 * Signed in, or merely holding a token?
 *
 * `expires` is stored beside the credential rather than inside it, because it
 * is not a secret and this question has to be answerable while the vault is
 * locked. Reading it out of the encrypted token would mean asking for a
 * passphrase in order to draw a settings row, which is a poor trade for a
 * timestamp anybody could infer by watching the plugin fail.
 *
 * Zero means a token stored before Reel recorded expiries — genuinely unknown,
 * which is its own answer and not the same as expired.
 */
export function traktState(hasToken: boolean, expires: number | undefined, now: number): TraktState {
	if (!hasToken) return { kind: "out" };
	if (!expires) return { kind: "unknown" };
	if (expires <= now) return { kind: "expired", expires };
	if (expires - now < SOON) return { kind: "soon", expires };
	return { kind: "in", expires };
}

export function describeTrakt(state: TraktState, now: number): Said {
	switch (state.kind) {
		case "out":
			return { text: "Not signed in", tone: "info" };
		case "unknown":
			return { text: "Signed in — Reel cannot tell when this expires", tone: "info" };
		case "expired":
			return { text: `Session expired ${ago(state.expires, now)} — sign in again`, tone: "warn" };
		case "soon":
			return { text: "Signed in — renews automatically this week", tone: "ok" };
		case "in":
			return { text: "Signed in", tone: "ok" };
	}
}
