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
 *   library, and against your content policy as far as each endpoint allows.
 *   That last part is uneven and worth stating plainly: /discover accepts a
 *   certification ceiling, so those rows are filtered at the source, but
 *   /recommendations and /trending do not. For those, the ceiling is applied
 *   by swapping in a filterable endpoint where one exists, and the adult flag
 *   is dropped everywhere. A row that cannot honour the ceiling says so rather
 *   than implying it did.
 *
 *   Rows, not a queue. Browsing is visual and lateral; you skim posters and
 *   stop at one. A one-at-a-time card is right for rating and wrong for
 *   looking around.
 */

import type ReelPlugin from "./main";
import type { Entry, TmdbSearchResult } from "./types";
import { unlink } from "./library";
import { blend, type Blended } from "./util/blend";
import { toDiscoverParams, blame, type Recipe, type SeedPool, type Culprit } from "./util/recipe";

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

		// Signals, strongest first.
		//
		// Requiring a rating at or above the liked threshold meant a young
		// library personalised nothing: rate one show three stars, put one
		// film on the watchlist, and the profile came back empty while the
		// screen still offered "For you". Adding something to your watchlist
		// is a deliberate statement of interest even before you have seen it,
		// and a middling rating says more than no data at all. So the weaker
		// signals are folded in only while the strong ones are too few to
		// stand on their own.
		const strong = all.filter((e) => (e.rating ?? 0) >= LIKED_THRESHOLD || e.liked);
		const weak = all.filter((e) => e.status === "watchlist" || (e.rating ?? 0) > 0);
		const rated = strong.length >= 3 ? strong : [...new Map([...strong, ...weak].map((e) => [e.path, e])).values()];

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
		const byRecency = (a: Entry, b: Entry) => (b.lastWatchedDate ?? "").localeCompare(a.lastWatchedDate ?? "");
		const strongSeeds = rated.filter((e) => (e.rating ?? 0) >= 4).sort(byRecency);

		// Demanding four stars meant no "Because you liked X" row at all until
		// you had rated something that highly. Below that, seed from the best
		// of what there is — a recommendation drawn from your three-star show
		// beats a row of this week's trending titles.
		const seeds = (strongSeeds.length ? strongSeeds : [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byRecency(a, b))).slice(0, 6);

		return {
			genreIds,
			genreNames,
			seeds,
			directors: [...directorScores.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 5),
			// Sparse means "nothing to personalise from", not "not much" — if
			// there is a genre or a seed, the rows are genuinely about you and
			// saying otherwise undersells them.
			sparse: !genreIds.length && !seeds.length,
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

		// People you have explicitly liked or rated lead everything else.
		//
		// A stated opinion beats an inferred one: telling the app you like a
		// director is a clearer signal than it noticing you watched three of
		// their films. TMDB's with_cast and with_crew only exist on
		// /discover/movie, so for series this row is simply absent rather than
		// silently returning something else.
		if (type === "movie") {
			for (const person of this.favouritePeople()) {
				jobs.push(
					this.plugin.tmdb
						.discoverBy({ type, withPerson: person.id, personAs: person.as })
						.then((items) =>
							this.row(
								`person-${person.id}`,
								person.as === "crew" ? `More from ${person.name}` : `More with ${person.name}`,
								items,
								"Someone you rated"
							)
						)
						.catch(() => null)
				);
			}
		}

		// Personal rows first, when there's enough history to build them.
		for (const seed of profile.seeds.slice(0, 3)) {
			jobs.push(
				this.plugin.tmdb
					.recommendations(seed.tmdbId, seed.type === "tv" ? "tv" : "movie")
					.then((items) =>
						this.row(
							`rec-${seed.tmdbId}`,
							`Because you liked ${seed.title}`,
							items,
							// Honest rather than silent: TMDB offers no ceiling
							// on this endpoint, and pretending otherwise is how
							// a content filter loses your trust for good.
							this.plugin.settings.maxCertification ? "Age limit does not apply to this row" : undefined
						)
					)
					.catch(() => null)
			);
		}

		// /trending cannot take a certification ceiling. Rather than show an
		// unfiltered row to someone who set one, ask /discover for popular
		// titles instead — a slightly different list, but one the ceiling
		// actually reaches.
		const ceiling = this.plugin.settings.maxCertification;
		if (ceiling && type === "movie") {
			jobs.push(
				this.plugin.tmdb
					.discoverBy({ type })
					.then((items) => this.row("trending", "Popular right now", items, `Within your ${ceiling} limit`))
					.catch(() => null)
			);
		} else {
			jobs.push(
				this.plugin.tmdb
					.discover("trending")
					.then((items) => this.row("trending", "Trending this week", items))
					.catch(() => null)
			);
		}

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

	/**
	 * People you have liked or rated, strongest first.
	 *
	 * A deliberate opinion outranks an inferred one: telling the app you like
	 * a director is a clearer signal than it noticing you happened to watch
	 * three of their films, so these lead the personalised rows.
	 */
	private favouritePeople(): { id: number; name: string; as: "cast" | "crew" }[] {
		const people = this.plugin.settings.people ?? {};
		return Object.entries(people)
			.map(([id, o]) => ({
				id: Number(id),
				name: o.name,
				rating: o.rating ?? (o.liked ? 4 : 0),
				// Directing, Writing and Production are crew credits; everything
				// else TMDB reports is effectively acting.
				as: (o.department && o.department !== "Acting" ? "crew" : "cast") as "cast" | "crew",
			}))
			.filter((p) => Number.isFinite(p.id) && p.rating > 0)
			.sort((a, b) => b.rating - a.rating)
			.slice(0, 3);
	}

	/**
	 * "Something like this one."
	 *
	 * TMDB's recommendations are drawn from what people who watched one title
	 * went on to watch, which is a better answer to "like X" than metadata
	 * similarity — it catches tone and register, not just a shared genre tag.
	 *
	 * The remaining filters then narrow that set rather than widening it, so
	 * "an action comedy like X" means titles like X that are *also* action
	 * comedies, not a mixture of the two ideas. Filtering locally is the only
	 * option: /recommendations takes no genre or decade parameters.
	 */
	async like(
		seed: { id: number; type: "movie" | "tv" },
		filters: { genreIds?: number[]; decade?: number | null; minRating?: number | null } = {}
	): Promise<TmdbSearchResult[]> {
		const items = await this.plugin.tmdb.recommendations(seed.id, seed.type);

		const wanted = filters.genreIds ?? [];
		const filtered = items.filter((item) => {
			// Recommendations carry genre_ids rather than full genre objects.
			const ids = (item as { genre_ids?: number[] }).genre_ids ?? [];
			// Every named genre must be present — "action comedy" means both,
			// which is the whole point of naming two.
			if (wanted.length && !wanted.every((g) => ids.includes(g))) return false;

			if (filters.minRating && (item.vote_average ?? 0) < filters.minRating) return false;

			if (filters.decade) {
				const year = Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4));
				if (!year || year < filters.decade || year >= filters.decade + 10) return false;
			}
			return true;
		});

		const direct = this.filterOut(filtered);

		// Recommendations are a fixed set of roughly twenty, so any real
		// narrowing exhausts them — "like The Bourne Identity, from the 2010s,
		// 7+" legitimately matches none of them. Stopping there is the wrong
		// answer to "find me something like this": the request was to keep
		// looking, not to report that one list came up short.
		//
		// So widen. Take the seed's own genres and run a proper discover query
		// with the same filters, which searches the whole catalogue rather
		// than one curated list. Results are appended after the direct
		// recommendations, which stay first because they are the better match.
		if (direct.length >= 12) return direct;

		const genres = wanted.length ? wanted : await this.seedGenres(seed);
		if (!genres.length) return direct;

		try {
			const wider = await this.plugin.tmdb.discoverBy({
				type: seed.type,
				genreIds: genres,
				decade: filters.decade ?? undefined,
				minRating: filters.minRating ?? undefined,
			});
			const seen = new Set(direct.map((d) => d.id));
			// Never suggest the seed back to the person who named it.
			seen.add(seed.id);
			return [...direct, ...this.filterOut(wider.filter((w) => !seen.has(w.id)))];
		} catch {
			// The widening is a bonus; a failure here must not lose the
			// recommendations that already worked.
			return direct;
		}
	}

	/** The seed's own genre ids, for widening a search beyond its recommendations. */
	private async seedGenres(seed: { id: number; type: "movie" | "tv" }): Promise<number[]> {
		try {
			const meta =
				seed.type === "tv" ? await this.plugin.tmdb.getShow(seed.id) : await this.plugin.tmdb.getFilm(seed.id);
			return (meta.genres ?? []).map((g) => g.id).filter((n): n is number => Number.isFinite(n));
		} catch {
			return [];
		}
	}

	/** One row, filtered against the library and your content policy. */
	private row(id: string, title: string, items: TmdbSearchResult[], reason?: string): DiscoverRow {
		return { id, title, reason, items: this.filterOut(items) };
	}

	/**
	 * Remove titles already in the library, duplicates, dismissals, and
	 * anything without a poster — a poster-less card is a grey box.
	 *
	 * Also drops adult-flagged results. /discover is sent include_adult=false,
	 * but /recommendations and /trending take no such parameter, so without
	 * this the two personalised rows were the only place adult titles could
	 * surface — the rows most likely to be on screen.
	 */
	filterOut(items: TmdbSearchResult[]): TmdbSearchResult[] {
		const seen = new Set<number>();
		const out: TmdbSearchResult[] = [];
		for (const item of items) {
			if (seen.has(item.id)) continue;
			seen.add(item.id);
			if (item.adult) continue;
			const type = item.media_type === "tv" ? "tv" : "film";
			if (this.plugin.library.byTmdbId(item.id, type)) continue;
			if (this.plugin.settings.dismissedIds.includes(item.id)) continue;
			if (!item.poster_path) continue; // a poster-less card is a grey box
			out.push(item);
		}
		return out;
	}

	/* ------------------------------------------------------------------ */
	/* Recipes — several seeds, blended                                    */
	/* ------------------------------------------------------------------ */

	/**
	 * A shortlist handed to the Discover screen's one-at-a-time mode.
	 *
	 * Held here rather than passed as an argument because the two screens do
	 * not know about each other — the recipe sheet closes, the tab opens, and
	 * this is the only thing that survives in between.
	 */
	private staged: TmdbSearchResult[] | null = null;

	stage(items: TmdbSearchResult[]): void {
		this.staged = items.length ? items : null;
	}

	/** Take the shortlist, if there is one. Reading it consumes it. */
	takeStaged(): TmdbSearchResult[] | null {
		const held = this.staged;
		this.staged = null;
		return held;
	}

	/**
	 * Which of your own films to offer as seeds.
	 *
	 * The default is what you *rated highly*, not what you watched. A picker
	 * showing everything you have seen includes the things you disliked, and
	 * seeding a recommendation engine with a film you gave two stars is
	 * actively counterproductive — it asks for more of what you did not want.
	 *
	 * "Would rewatch" is its own pool because it answers a different question:
	 * not "what was good" but "what do I want again", which is much closer to
	 * what someone deciding what to watch tonight actually means.
	 */
	seedPool(pool: SeedPool): Entry[] {
		const films = this.plugin.visible(this.plugin.library.all()).filter((e) => e.watched.length || e.rating != null);

		const rows =
			pool === "rewatch"
				? films.filter((e) => e.wouldRewatch)
				: pool === "loved"
					? films.filter((e) => (e.rating ?? 0) >= 4 || e.liked || e.wouldRewatch)
					: films;

		// Best first, so the picker opens on the films you are most likely to
		// choose rather than on whatever happens to sort first alphabetically.
		return [...rows].sort(
			(a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title)
		);
	}

	/**
	 * How many titles a recipe would return, without fetching them.
	 *
	 * Used by the live counter while the recipe is still being built. Returns
	 * null when there is nothing to count — a recipe with no constraints at
	 * all would report "every film ever made", which is true and useless.
	 */
	async count(recipe: Recipe): Promise<number | null> {
		const queries = this.queriesFor(recipe);
		if (!queries.length) return null;
		const totals = await Promise.all(
			queries.map((params) => this.plugin.tmdb.discoverWith("movie", params).then((r) => r.total))
		);
		// Summed rather than maxed: the decades do not overlap, so the counts
		// are of disjoint sets and adding them is exact.
		return totals.reduce((a, b) => a + b, 0);
	}

	/**
	 * One parameter set per query a recipe needs.
	 *
	 * Usually one. Several decades means several, because TMDB takes a single
	 * date range — asking for 1990–2019 to mean "the 90s or the 2010s" would
	 * quietly include the 2000s too.
	 */
	private queriesFor(recipe: Recipe): Record<string, string>[] {
		if (!recipe.decades.length) {
			const params = toDiscoverParams(recipe);
			return Object.keys(params).length ? [params] : [];
		}
		return recipe.decades.map((d) => toDiscoverParams(recipe, d));
	}

	/**
	 * The exact queries a recipe produces, for the diagnostic.
	 *
	 * Exposed because a recipe returning nothing when it obviously should is
	 * not something anyone can debug from the outside — and "no results" from
	 * a query you cannot see is indistinguishable from a broken app.
	 */
	describeQueries(recipe: Recipe): string[] {
		return this.queriesFor(recipe).map((p) =>
			Object.keys(p)
				.sort()
				.map((k) => `${k}=${p[k]}`)
				.join("&")
		);
	}

	/**
	 * Run a recipe: blend the seeds, then apply the constraints.
	 *
	 * Order matters and is not obvious. The seeds come first because
	 * /recommendations takes no filters at all — there is no way to ask TMDB
	 * for "films like Heat that are under 90 minutes". So the blend is fetched
	 * whole and narrowed locally against a constrained /discover set.
	 *
	 * With no seeds it degenerates to a plain filtered search, which is the
	 * right behaviour rather than an error: "any well-rated 90s comedy" is a
	 * reasonable thing to ask for and needs no seed at all.
	 */
	async run(recipe: Recipe): Promise<Blended[]> {
		const owned = new Set<number>();
		if (recipe.excludeOwned) {
			for (const e of this.plugin.library.all()) owned.add(e.tmdbId);
		}
		for (const id of this.plugin.settings.dismissedIds) owned.add(id);

		const queries = this.queriesFor(recipe);
		// One request per decade, merged. De-duplicated by id, since a title
		// cannot be in two decades but a caller could pass the same one twice.
		const constrained = queries.length
			? await Promise.all(queries.map((p) => this.plugin.tmdb.discoverWith("movie", p))).then((sets) => {
					const seen = new Map<number, TmdbSearchResult>();
					for (const set of sets) for (const r of set.results) if (!seen.has(r.id)) seen.set(r.id, r);
					return { results: [...seen.values()], total: sets.reduce((n, s) => n + s.total, 0) };
				})
			: null;

		// No seeds: the constrained set *is* the answer, with no explanation
		// to offer beyond the constraints the user set themselves.
		if (!recipe.seeds.length) {
			const rows = (constrained?.results ?? []).filter((r) => !owned.has(r.id) && r.poster_path);
			return rows.map((item, i) => ({ item, because: [], agreement: 0, bestRank: i }));
		}

		const sets = await Promise.all(
			recipe.seeds.map(async (id) => {
				const entry = this.plugin.library.byTmdbId(id, "film");
				try {
					const items = await this.plugin.tmdb.recommendations(id, "movie");
					return { seedId: id, seedTitle: entry?.title ?? String(id), items };
				} catch {
					// One dead seed must not lose the other two. A partial
					// blend is a worse answer than a full one and a much
					// better answer than an error page.
					return { seedId: id, seedTitle: entry?.title ?? String(id), items: [] };
				}
			})
		);

		let out = blend(sets, { exclude: owned, minAgreement: recipe.minAgreement });

		// Narrow against the constrained set. An id present in /discover under
		// these parameters satisfies them; TMDB will not tell us that about a
		// recommendation directly.
		if (constrained) {
			const allowed = new Set(constrained.results.map((r) => r.id));
			out = out.filter((b) => allowed.has(b.item.id));
		}

		return out.filter((b) => b.item.poster_path);
	}

	/**
	 * When a recipe returns nothing, work out which constraint to blame.
	 *
	 * One count per constraint with that constraint removed — so at most a
	 * handful of requests, all cached, and only on the failure path. "No
	 * results" is a dead end; "your 90 minute limit is what is cutting it,
	 * drop it and you get 40" is an action.
	 */
	async blameFor(recipe: Recipe, genreName: (id: number) => string): Promise<Culprit | null> {
		const variants: { key: keyof Recipe; label: string; recipe: Recipe }[] = [];

		if (recipe.minScore != null) {
			variants.push({ key: "minScore", label: `the ${recipe.minScore}+ score filter`, recipe: { ...recipe, minScore: undefined } });
		}
		if (recipe.maxRuntime != null) {
			variants.push({ key: "maxRuntime", label: `the ${recipe.maxRuntime} minute limit`, recipe: { ...recipe, maxRuntime: undefined } });
		}
		if (recipe.decades.length) {
			variants.push({
				key: "decades",
				label: recipe.decades.map((d) => `the ${d}s`).join(" and "),
				recipe: { ...recipe, decades: [] },
			});
		}
		if (recipe.withoutGenres.length) {
			variants.push({
				key: "withoutGenres",
				label: `excluding ${recipe.withoutGenres.map(genreName).join(" and ")}`,
				recipe: { ...recipe, withoutGenres: [] },
			});
		}
		if (recipe.genres.length > 1 && recipe.genreMode === "all") {
			// Not "drop the genres" but "loosen them" — asking for action AND
			// comedy AND crime is usually the culprit, and "either" recovers
			// most of it without abandoning what was asked for.
			variants.push({
				key: "genreMode",
				label: `requiring all of ${recipe.genres.map(genreName).join(", ")}`,
				recipe: { ...recipe, genreMode: "any" },
			});
		}

		const counted = await Promise.all(
			variants.map(async (v) => ({
				key: v.key,
				label: v.label,
				without: (await this.count(v.recipe)) ?? 0,
			}))
		);
		return blame(counted);
	}
}
