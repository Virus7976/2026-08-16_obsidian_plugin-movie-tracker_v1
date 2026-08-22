/**
 * Turning a review in your vault into a post somewhere else.
 *
 * Kept pure and kept here, away from the two clients that send it, for one
 * reason: this is the part where the app decides what other people will read
 * under your name, and that deserves to be something a test can pin down
 * exactly rather than something assembled inline at the moment of sending.
 *
 * The two destinations want genuinely different things, and pretending
 * otherwise is how you end up posting a truncated sentence to one of them:
 *
 *   Trakt is a film site. It already knows the film, so naming it in the text
 *   is noise, and there is no length limit worth worrying about — but a comment
 *   under five words is rejected outright, and every comment must declare
 *   whether it spoils.
 *
 *   Mastodon is not a film site. Nobody reading it knows what you are talking
 *   about unless the post says so, and there is a hard character limit that
 *   varies by instance. So the title goes in, and the body has to fit.
 *
 * Nothing here sends anything. It returns text and complaints; deciding to post
 * is the caller's job, and on the far side of a confirmation.
 */

import type { Entry } from "../types";
import { starString } from "../util/ratings";

export interface PublishPayload {
	entry: Entry;
	/** ISO date of the viewing this review belongs to, when there is one. */
	date?: string;
	/** 0–5 with halves, as Reel stores it. Trakt's scale is different; see below. */
	rating?: number;
	text: string;
	spoiler: boolean;
}

export interface Composed {
	text: string;
	/** True when the body had to be cut to fit. Shown before sending, never after. */
	truncated: boolean;
}

/** Mastodon's own default. Instances can raise it; none lower it in practice. */
export const MASTODON_DEFAULT_LIMIT = 500;

/** Trakt rejects anything shorter, with a 422 that reads like a server fault. */
export const TRAKT_MIN_WORDS = 5;

/** Past this, Trakt files a comment as a review rather than a shout. */
export const TRAKT_REVIEW_WORDS = 200;

/** Words, counted the way a person would count them. */
export function wordCount(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * "Heat (1995)" — the film, said once, in the form everybody writes it.
 *
 * A series uses its first air year, because that is the year people mean when
 * they say the name of a show, and `year` is undefined on one anyway.
 */
export function titleLine(entry: Entry): string {
	const year = entry.type === "tv" ? entry.firstAirYear : entry.year;
	return year ? `${entry.title} (${year})` : entry.title;
}

/**
 * Reel's stars on Trakt's scale.
 *
 * Reel stores 0–5 in halves; Trakt stores 1–10 in whole numbers. Doubling is
 * exact in both directions, which is the only reason this is a one-liner and
 * not a table — a five-point scale onto a ten-point one usually is not.
 *
 * Zero means unrated rather than "the worst film ever made", so it returns
 * nothing rather than 0, which Trakt would reject anyway.
 */
export function traktRating(rating: number | undefined): number | undefined {
	if (rating == null || rating <= 0) return undefined;
	const scaled = Math.round(rating * 2);
	return Math.min(10, Math.max(1, scaled));
}

/**
 * Why Trakt would refuse this, in words you can act on.
 *
 * Checked here rather than by sending it and reading the error, because the
 * error arrives after the post attempt and says `422 Unprocessable Entity`,
 * which tells you nothing about the actual rule. Returns null when it will go.
 */
export function traktComplaint(payload: PublishPayload): string | null {
	const body = payload.text.trim();
	if (!body) return "There's nothing written to post.";
	const words = wordCount(body);
	if (words < TRAKT_MIN_WORDS) {
		return `Trakt needs at least ${TRAKT_MIN_WORDS} words — this is ${words}.`;
	}
	if (!payload.entry.tmdbId) {
		return "This note has no TMDB id, so Trakt can't tell which title it's about.";
	}
	return null;
}

/**
 * The comment body Trakt receives.
 *
 * The stars go in the text as well as into the rating field. Trakt shows a
 * comment and a rating in different places, and a comment reading "the third
 * act falls apart" with no score attached loses half of what you meant.
 */
export function composeTrakt(payload: PublishPayload): Composed {
	const stars = payload.rating != null && payload.rating > 0 ? `${starString(payload.rating)}\n\n` : "";
	return { text: `${stars}${payload.text.trim()}`, truncated: false };
}

/**
 * The Mastodon post, cut to fit if it has to be.
 *
 * Order matters here and is not arbitrary. The title line and the hashtags are
 * the parts that make the post legible to a stranger scrolling past, so they
 * are reserved out of the budget first and the body absorbs the shortfall.
 * A post that fits by dropping the film's name is not a shorter post, it is a
 * useless one.
 *
 * The cut lands on a word boundary and is marked with an ellipsis, so it reads
 * as abridged rather than as a sentence that stopped. Anyone who wants the rest
 * has it in the vault, which is where it actually lives.
 */
export function composeMastodon(
	payload: PublishPayload,
	opts: { limit?: number; hashtags?: string } = {}
): Composed {
	const limit = opts.limit && opts.limit > 0 ? opts.limit : MASTODON_DEFAULT_LIMIT;
	const stars = payload.rating != null && payload.rating > 0 ? ` ${starString(payload.rating)}` : "";
	const head = `${titleLine(payload.entry)}${stars}`;
	const tags = (opts.hashtags ?? "").trim();

	const tail = tags ? `\n\n${tags}` : "";
	// Two newlines between head and body, hence the +2.
	const budget = limit - head.length - tail.length - 2;

	const body = payload.text.trim();
	if (budget <= 0) {
		// Pathological: an instance limit smaller than the title itself. Post
		// what identifies the film and nothing else rather than post nothing.
		return { text: head.slice(0, limit), truncated: true };
	}

	if (body.length <= budget) {
		return { text: `${head}\n\n${body}${tail}`, truncated: false };
	}

	const cut = trimToWord(body, budget - 1);
	return { text: `${head}\n\n${cut}…${tail}`, truncated: true };
}

/**
 * The longest prefix that fits and doesn't end mid-word.
 *
 * Falls back to a hard slice when there is no space to break on — a single
 * unbroken 500-character token is not a sentence, but it is also not a reason
 * to return an empty string.
 */
function trimToWord(text: string, max: number): string {
	if (text.length <= max) return text;
	const slice = text.slice(0, max);
	const space = slice.lastIndexOf(" ");
	const kept = space > max * 0.6 ? slice.slice(0, space) : slice;
	return kept.replace(/[\s,;:.!?—-]+$/, "");
}

/**
 * Where a published post ends up, recorded in the note.
 *
 * Stored per target so publishing to Mastodon does not make Reel believe it
 * already went to Trakt, and stored as the URL rather than as `true` because
 * the useful question six months later is "where is it", not "did it happen".
 */
export type PublishRecord = Record<string, string>;

/** The frontmatter key holding those URLs. */
export const PUBLISHED_KEY = "published";
