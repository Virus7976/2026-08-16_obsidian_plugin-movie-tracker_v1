/**
 * Discovery.
 *
 * The library answers "what have I seen". This answers "what should I watch",
 * which is a different question and needs a different engine: it has to read
 * your taste out of what you've already rated, then ask TMDB for things you
 * haven't.
 *
 * Three principles shape it:
 *
 *   Personal before popular. A row of this week's trending titles is the same
 *   row everybody sees. "Because you liked Sinners" is not, and it's the only
 *   part a tracker can do better than a streaming service's front page.
 *
 *   Never suggest what you already have. Every row is filtered against the
 *   library and against your content policy — a recommendation you've hidden
 *   by filter is worse than no recommendation.
 *
 *   Rows, not a queue. Browsing is visual and lateral; you skim posters and
 *   stop at one. A one-at-a-time card is right for rating and wrong for
 *   looking around.
 */

import type ReelPlugin from "./main";
import type { Entry, TmdbSearchResult } from "./types";
import { unlink } from "./library";

export interface DiscoverRow {
	id: string;
	title: string;
	/** Why this row exists — shown under the heading when it isn't obvious. */
	reason?: string;
	items: TmdbSearchResult[];
}

export interface TasteProfile {
	/** Genre ids, most-liked first. */
	genreIds: number[];
	genreNames: string[];
	/** Highly-rated titles, newest first — the seeds for "because you liked". */
	seeds: Entry[];
	directors: string[];
	/** True when there isn't enough rated history to personalise anything. */
	sparse: boolean;
}

export interface DiscoverFilters {
	genreId?: number;
	decade?: number;
	minRating?: number;
	type: "movie" | "tv";
}

/** Ratings at or above this count as "you liked it". */
export const LIKED_THRESHOLD = 3.5;

/**
 * How much one entry counts toward the profile.
 *
 * Rating above the threshold, plus a bonus for a deliberate like. A 3.5 counts
 * for 1 and a 5 counts for 2.5, so enthusiasm outweighs volume — otherwise a
 * genre you watch constantly and rate 3.5 would drown out the one you rate 5.
 */
export function tasteWeight(entry: { rating?: number; liked?: boolean }): number {
	const base = (entry.rating ?? LIKED_THRESHOLD) - (LIKED_THRESHOLD - 1);
	return base + (entry.liked ? 1 : 0);
}

/** Genres ordered by how much you actually like them, not how often you watch. */
export function rankGenres(entries: { genres: string[]; rating?: number; liked?: boolean }[]): string[] {
	const scores = new Map<string, number>();
	for (const e of entries) {
		const w = tasteWeight(e);
		for (const g of e.genres) scores.set(g, (scores.get(g) ?? 0) + w);
	}
	return [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
}

export class DiscoverEngine {
	private genreCache: Map<string, Map<string, number>> = new Map();

	constructor(private plugin: ReelPlugin) {}

	/* ------------------------------------------------------------------ */
	/* Taste                                                               */
	/* ------------------------------------------------------------------ */

	/**
	 * Read a profile out of the library.
	 *
	 * Weighted by rating rather than by count: five films you rated 5 say more
	 * about you than twenty you rated 3. Liked titles count double, since a
	 * deliberate heart is a stronger signal than a rating you gave in passing.
	 */
	async taste(type: "movie" | "tv" = "movie"): Promise<TasteProfile> {
		const all = this.plugin.visible(this.plugin.library.all());
		const rated = all.filter((e) => (e.rating ?? 0) >= LIKED_THRESHOLD || e.liked);

		const directorScores = new Map<string, number>();
		for (const e of rated) {
			const weight = tasteWeight(e);
			for (const d of e.director) {
				const name = unlink(d);
				directorScores.set(name, (directorScores.get(name) ?? 0) + weight);
			}
		}

		const genreNames = rankGenres(rated);
		// Ids are per-endpoint: "Action" is 28 for film and 10759 for TV, so a
		// profile built against one is meaningless to the other.
		const map = await this.genreIds(type);
		const genreIds = genreNames.map((n) => map.get(n.toLowerCase())).filter((id): id is number => id != null);

		// Seeds are the strongest, most recent things you rated — recency
		// matters because taste drifts and a five-star film from 2019 is a
		// weaker signal than one from last month.
		const seeds = rated
			.filter((e) => (e.rating ?? 0) >= 4)
			.sort((a, b) => (b.lastWatchedDate ?? "").localeCompare(a.lastWatchedDate ?? ""))
			.slice(0, 6);

		return {
			genreIds,
			genreNames,
			seeds,
			directors: [...directorScores.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 5),
			sparse: rated.length < 3,
		};
	}

	/** Genre name → TMDB id, cached; the discover endpoint needs ids. */
	async genreIds(kind: "movie" | "tv"): Promise<Map<string, number>> {
		const hit = this.genreCache.get(kind);
		if (hit) return hit;
		const map = new Map<string, number>();
		try {
			const list = await this.plugin.tmdb.genreList(kind);
			for (const g of list) map.set(g.name.toLowerCase(), g.id);
		} catch {
			// A missing genre map costs personalisation, not the whole screen.
		}
		this.genreCache.set(kind, map);
		return map;
	}

	/* ------------------------------------------------------------------ */
	/* Rows                                                                */
	/* ------------------------------------------------------------------ */

	/**
	 * The rows for the Discover screen.
	 *
	 * Requests run in parallel and a failed row is dropped rather than failing
	 * the screen — one dead endpoint should cost you that row and nothing else.
	 */
	async rows(profile: TasteProfile, type: "movie" | "tv" = "movie"): Promise<DiscoverRow[]> {
		const jobs: Promise<DiscoverRow | null>[] = [];

		// Personal rows first, when there's enough history to build them.
		for (const seed of profile.seeds.slice(0, 3)) {
			jobs.push(
				this.plugin.tmdb
					.recommendations(seed.tmdbId, seed.type === "tv" ? "tv" : "movie")
					.then((items) => this.row(`rec-${seed.tmdbId}`, `Because you liked ${seed.title}`, items))
					.catch(() => null)
			);
		}

		jobs.push(
			this.plugin.tmdb
				.discover("trending")
				.then((items) => this.row("trending", "Trending this week", items))
				.catch(() => null)
		);

		if (profile.genreIds.length) {
			const name = profile.genreNames[0];
			// The Films/Series toggle has to reach these rows too, or picking
			// Series changes the filtered grid and leaves the personalised
			// rows showing films regardless.
			jobs.push(
				this.plugin.tmdb
					.discoverBy({ type, genreId: profile.genreIds[0], minRating: 7 })
					.then((items) => this.row("genre", `Highly rated ${name.toLowerCase()}`, items, "Your most-watched genre"))
					.catch(() => null)
			);
			jobs.push(
				this.plugin.tmdb
					.discoverBy({ type, genreId: profile.genreIds[0], decade: 1990 })
					.then((items) => this.row("genre-90s", `${name} from the nineties`, items))
					.catch(() => null)
			);
		}

		jobs.push(
			this.plugin.tmdb
				.discover("top")
				.then((items) => this.row("top", "Acclaimed films you've missed", items))
				.catch(() => null)
		);

		jobs.push(
			this.plugin.tmdb
				.discover("upcoming")
				.then((items) => this.row("upcoming", "Coming soon", items))
				.catch(() => null)
		);

		const rows = await Promise.all(jobs);
		return rows.filter((r): r is DiscoverRow => r != null && r.items.length > 0);
	}

	/** Stop suggesting something. Persisted, so it stays gone. */
	async dismiss(id: number): Promise<void> {
		if (this.plugin.settings.dismissedIds.includes(id)) return;
		// Bounded: an unbounded ignore-list would grow forever in data.json for
		// no benefit, and the oldest dismissals are the least relevant.
		const next = [...this.plugin.settings.dismissedIds, id].slice(-500);
		this.plugin.settings.dismissedIds = next;
		await this.plugin.saveSettings();
	}

	/** A single filtered search — the manual counterpart to the taste rows. */
	async search(filters: DiscoverFilters, page = 1): Promise<TmdbSearchResult[]> {
		const items = await this.plugin.tmdb.discoverBy({ ...filters, page });
		return this.filterOut(items);
	}

	/** One row, filtered against the library and your content policy. */
	private row(id: string, title: string, items: TmdbSearchResult[], reason?: string): DiscoverRow {
		return { id, title, reason, items: this.filterOut(items) };
	}

	/**
	 * Remove titles already in the library, duplicates, dismissals, and
	 * anything without a poster — a poster-less card is a grey box.
	 *
	 * Not a content filter: see the note at the top of this file for why that
	 * has to happen at the source.
	 */
	filterOut(items: TmdbSearchResult[]): TmdbSearchResult[] {
		const seen = new Set<number>();
		const out: TmdbSearchResult[] = [];
		for (const item of items) {
			if (seen.has(item.id)) continue;
			seen.add(item.id);
			const type = item.media_type === "tv" ? "tv" : "film";
			if (this.plugin.library.byTmdbId(item.id, type)) continue;
			if (this.plugin.settings.dismissedIds.includes(item.id)) continue;
			if (!item.poster_path) continue; // a poster-less card is a grey box
			out.push(item);
		}
		return out;
	}
}
