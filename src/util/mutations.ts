/**
 * Pure frontmatter transformations.
 *
 * These used to live inside `processFrontMatter` callbacks, where they were
 * untestable — the callback needs a real vault — and where every property read
 * came off an `any`. Pulled out here they take typed inputs, return new values,
 * and can be exercised without Obsidian at all.
 *
 * That matters because this is the logic that edits watch history and episode
 * ratings. A silent off-by-one here loses data you can't reconstruct, and it's
 * exactly the sort of thing a lint warning would never catch.
 */

import { clampRating } from "./ratings";
import { addToRange, rangeCount } from "./ranges";
import type { SeasonProgress, WatchEvent } from "../types";

/* ------------------------------------------------------------------ */
/* Watch history                                                       */
/* ------------------------------------------------------------------ */

export interface LoggedWatch {
	date: string;
	rating?: number;
	rewatch?: boolean;
}

/**
 * Append a viewing and return the new history, sorted by date.
 *
 * Hand-written entries are tolerated: a bare `- 2024-03-11` string is a date
 * with no rating rather than something to discard, because throwing away a
 * viewing someone typed themselves would be worse than a slightly odd shape.
 */
export function appendWatch(existing: unknown, log: LoggedWatch): WatchEvent[] {
	const history: WatchEvent[] = [];
	if (Array.isArray(existing)) {
		for (const raw of existing) {
			if (typeof raw === "string") {
				history.push({ date: raw });
			} else if (raw && typeof raw === "object") {
				history.push(raw as WatchEvent);
			}
		}
	}

	const event: WatchEvent = {
		date: log.date,
		rewatch: log.rewatch ?? history.length > 0,
	};
	if (log.rating != null) event.rating = clampRating(log.rating);

	history.push(event);
	history.sort((a, b) => String(a.date).localeCompare(String(b.date)));
	return history;
}

/** The newest rating in a history, which is what the headline `rating` mirrors. */
export function latestRating(history: WatchEvent[]): number | undefined {
	for (let i = history.length - 1; i >= 0; i--) {
		const entry = history[i];
		if (entry && typeof entry === "object" && entry.rating != null) return entry.rating;
	}
	return undefined;
}

/* ------------------------------------------------------------------ */
/* Episode ratings                                                     */
/* ------------------------------------------------------------------ */

export interface EpisodeRatingResult {
	seasons: SeasonProgress[];
	/** Mean across every rated episode of every season, or null if none. */
	average: number | null;
}

/**
 * Set or clear one episode's rating.
 *
 * Rating an episode also marks it watched — nobody rates an episode they
 * haven't seen, and making that a second tap buys no information. The season's
 * own rating becomes the mean of its rated episodes, and the series average
 * follows from all of them.
 */
export function rateEpisode(
	seasons: SeasonProgress[],
	season: number,
	episode: number,
	rating: number | null
): EpisodeRatingResult {
	// `rating` and `episode_ratings` are both optional on SeasonProgress but a
	// mapped copy widens them to required, which `delete` then rejects. The
	// explicit type keeps them optional so the clear paths below stay legal.
	const next: SeasonProgress[] = seasons.map((s) => ({ ...s, episode_ratings: { ...(s.episode_ratings ?? {}) } }));

	let row: SeasonProgress | undefined = next.find((s) => Number(s.n) === season);
	if (!row) {
		row = { n: season, watched: "", episode_ratings: {} };
		next.push(row);
		next.sort((a, b) => Number(a.n) - Number(b.n));
	}

	const ratings = row.episode_ratings ?? {};
	if (rating == null) {
		delete ratings[String(episode)];
	} else {
		ratings[String(episode)] = clampRating(rating);
		row.watched = addToRange(row.watched, episode);
	}

	if (Object.keys(ratings).length) row.episode_ratings = ratings;
	else delete row.episode_ratings;

	// A season with no rated episodes has no derived rating either — leaving a
	// stale one would claim a judgement that no longer exists.
	const seasonValues = Object.values(row.episode_ratings ?? {});
	if (seasonValues.length) row.rating = round1(mean(seasonValues));
	else delete row.rating;

	const all: number[] = [];
	for (const s of next) for (const v of Object.values(s.episode_ratings ?? {})) all.push(v);

	return { seasons: next, average: all.length ? round1(mean(all)) : null };
}

/**
 * Merge TMDB's season list into what's already stored, preserving progress.
 *
 * The refresh path's one job is to add newly announced seasons without
 * touching a single episode you've ticked.
 */
export function mergeSeasons(
	known: SeasonProgress[],
	incoming: { season_number: number; episode_count?: number }[],
	includeSpecials: boolean
): SeasonProgress[] {
	const next = known.map((s) => ({ ...s }));
	for (const s of incoming) {
		if (!includeSpecials && s.season_number <= 0) continue;
		const row = next.find((k) => Number(k.n) === s.season_number);
		if (row) row.total = s.episode_count ?? row.total ?? 0;
		else next.push({ n: s.season_number, watched: "", total: s.episode_count ?? 0 });
	}
	next.sort((a, b) => Number(a.n) - Number(b.n));
	return next;
}

/** Episodes ticked across every season. */
export function watchedCount(seasons: SeasonProgress[]): number {
	return seasons.reduce((n, s) => n + rangeCount(s.watched), 0);
}

function mean(values: number[]): number {
	return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}
