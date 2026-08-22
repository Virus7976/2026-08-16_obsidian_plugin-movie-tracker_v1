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
 * This list used to stop at the three metadata services, on the grounds that
 * the rest "have no cheap test request". That was true of the code and not of
 * the world, and it left half the features in the setup walkthrough able to
 * report only that a key had been typed in.
 *
 * OpenRouter has an endpoint whose whole purpose is to describe the key you
 * asked with, so there was never a reason for Ask to be unverifiable.
 *
 * Mastodon is on the list for a narrower reason and carries `proves` to say
 * so: its server can be checked and its token cannot, because Reel asks for a
 * token that can only post and will not post to test it. Half an answer,
 * clearly labelled as half, beats no answer — the server address is the part
 * people get wrong, and it currently fails at the moment you press publish.
 *
 * Trakt is on it for a reason its expiry cannot cover. The expiry is exact and
 * needs no network, so it stays the answer the row gives on every render — but
 * expiry is not revocation. A token you revoked from Trakt's own website this
 * morning is still an unexpired token, and the row went on saying "Signed in"
 * until a review failed to publish. Only a request can tell you that.
 */
export const TESTABLE: FeatureId[] = ["tmdb", "omdb", "dtdd", "openrouter", "mastodon", "trakt"];

export interface HealthRecord {
	/** When the check ran. Epoch milliseconds. */
	at: number;
	ok: boolean;
	/** Why it failed, already redacted. Absent when it worked. */
	error?: string;
	/**
	 * What the check established, when that is less than "this feature works".
	 *
	 * The whole module exists because a stored key was being reported as a
	 * working one. A check that verifies a server but not the token sitting
	 * behind it is that same gap in miniature, and the only thing that stops it
	 * becoming the same lie is saying out loud which half was tested.
	 *
	 * Absent means the check proved the ordinary thing, and the row can say so
	 * without qualification.
	 */
	proves?: string;
	/** Anything extra worth knowing on a pass — remaining credit, say. */
	note?: string;
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
/**
 * The qualification, if the pass came with one.
 *
 * `proves` first, because a limit on what was checked outranks a detail about
 * what was found: the reader needs to know the claim is narrow before they are
 * told anything encouraging inside it. `withProves` is false where the caller
 * has already led with it, so it is not said twice.
 */
function extra(rec: HealthRecord, withProves = true): string {
	const said = [withProves ? rec.proves : "", rec.note].filter((s) => s && s.trim());
	return said.length ? `. ${said.join(" ")}` : "";
}

export function describeHealth(rec: HealthRecord | undefined, configured: boolean, now: number): Said {
	if (!configured) return { text: "Not set up", tone: "info" };
	if (!rec) return { text: "Not checked yet", tone: "info" };

	const when = ago(rec.at, now);
	if (!rec.ok) return { text: `Failed ${when}${rec.error ? ` — ${rec.error}` : ""}`, tone: "warn" };
	/*
	 * A partial check does not get to say "Working".
	 *
	 * Carrying the caveat in the text was not enough on its own. The row read
	 * "Working — checked 5 minutes ago. The token is not checked here", in
	 * green, next to a tick, and the first word is the only one a person
	 * scanning a list of five services actually reads. That is the same
	 * overstatement this whole module was written to stop, one level up from
	 * where it was fixed.
	 *
	 * Not a warning either: nothing is wrong, and flagging a correct setup
	 * would be the opposite mistake. `info` is the register this module already
	 * uses for a true-but-weaker answer — it is what a stale pass gets, and a
	 * half-checked pass is weak in the same way.
	 */
	if (rec.proves) return { text: `Checked ${when}. ${rec.proves}${extra(rec, false)}`, tone: "info" };

	// Still reported, still says when. A fortnight-old pass is evidence, just
	// weaker evidence, and hiding it would leave the row looking unchecked.
	if (now - rec.at > STALE_AFTER) return { text: `Worked ${when}${extra(rec)}`, tone: "info" };
	return { text: `Working — checked ${when}${extra(rec)}`, tone: "ok" };
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

/**
 * @param rec the last connection check, if one has run. Optional because this
 * is also drawn while the vault is locked, when no check is possible and the
 * expiry is the only thing readable.
 */
export function describeTrakt(state: TraktState, now: number, rec?: HealthRecord): Said {
	/*
	 * A rejected token outranks an unexpired one.
	 *
	 * These two answers disagree precisely when it matters. Revoking Reel's
	 * access on Trakt's website does not touch the stored token or the expiry
	 * beside it, so every passive signal still reads "Signed in" and the first
	 * contradiction arrives when a review you have just written fails to post.
	 * Where a request has actually been refused, that is the newer and the
	 * harder fact, and it is the one to show.
	 *
	 * Only when there is a token at all: a failure recorded before you signed
	 * out is not news about the state you are in now.
	 */
	if (rec && !rec.ok && state.kind !== "out") {
		/*
		 * Not "Trakt refused this token". Every line this function returns is
		 * read directly after something that already says Trakt — the health
		 * table puts the service name in the label beside it, the setup guide
		 * puts it in the heading above it — and naming it again renders as
		 * "Trakt  Trakt refused this token". The rest of the module is written
		 * to be read after its label ("Working", "Failed", "Not checked yet")
		 * and this was the one line that forgot.
		 */
		return { text: `Token refused ${ago(rec.at, now)} — sign in again`, tone: "warn" };
	}

	switch (state.kind) {
		case "out":
			return { text: "Not signed in", tone: "info" };
		case "unknown":
			return { text: "Signed in — Reel cannot tell when this expires", tone: "info" };
		case "expired":
			return { text: `Session expired ${ago(state.expires, now)} — sign in again`, tone: "warn" };
		case "soon":
			return { text: `Signed in — renews automatically this week${checked(rec, now)}`, tone: "ok" };
		case "in":
			return { text: `Signed in${checked(rec, now)}`, tone: "ok" };
	}
}

/** ", checked 5 minutes ago" — evidence the token was accepted, not merely held. */
function checked(rec: HealthRecord | undefined, now: number): string {
	return rec?.ok ? `, checked ${ago(rec.at, now)}` : "";
}

/* ------------------------------------------------------------------ */
/* One answer to "how is this feature doing", for every screen that asks */
/* ------------------------------------------------------------------ */

export interface HealthInputs {
	records: HealthMap;
	hasTrakt: boolean;
	traktExpires: number | undefined;
}

/**
 * The single place that knows how a feature reports its health.
 *
 * This rule was written out three times — the health table, the settings row,
 * and the setup guide — each an independent copy of "Trakt is special, the
 * untestable ones say nothing, everything else describes its record". Three
 * copies of a rule that was about to gain a fourth clause, in a plugin whose
 * recurring bug is two screens disagreeing about whether something works.
 *
 * Returns null for a feature nothing can honestly report on, which the callers
 * render as no line at all rather than as an empty one.
 */
export function featureHealth(id: FeatureId, inputs: HealthInputs, now: number): Said | null {
	if (id === "trakt") {
		return describeTrakt(traktState(inputs.hasTrakt, inputs.traktExpires, now), now, inputs.records.trakt);
	}
	if (!TESTABLE.includes(id)) return null;
	return describeHealth(inputs.records[id], true, now);
}
