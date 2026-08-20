/**
 * TMDB client.
 *
 * Uses `requestUrl` rather than `fetch` — mobile Obsidian runs in a webview
 * where cross-origin `fetch` is blocked by CORS. `requestUrl` goes through the
 * app's own networking and works identically on both platforms.
 *
 * Two credential shapes are supported. A v4 read access token (a JWT, starts
 * `eyJ`) is sent as `Authorization: Bearer`; a v3 API key has to go in the
 * query string, which is why the settings copy nudges towards v4 — a URL ends
 * up in far more logs than a header does.
 *
 * One request per title on add: `append_to_response` folds credits and
 * providers into the same call, and for a show the season list comes with it,
 * so a ten-season show costs one request, not eleven. Episode titles are
 * fetched lazily per season, only when a season is opened.
 */

import { Plugin, requestUrl, RequestUrlResponse } from "obsidian";
import type ReelPlugin from "./main";
import { redact } from "./secrets";
import { cacheFileName } from "./util/cachekey";
import { MissingKeyError } from "./credentials";
import type {
	TmdbEpisode,
	TmdbFilm,
	TmdbPerson,
	TmdbSearchResult,
	TmdbShow,
} from "./types";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

interface CacheRecord<T> {
	fetchedAt: number;
	/** Cached forever — set for ended shows and released films, whose data won't change. */
	immutable?: boolean;
	data: T;
}

export class TmdbError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = "TmdbError";
	}
}

export class TmdbClient {
	private memCache = new Map<string, CacheRecord<unknown>>();
	/** Collapses identical in-flight requests — the grid can ask for the same id twice. */
	private inflight = new Map<string, Promise<unknown>>();

	constructor(private plugin: ReelPlugin) {}

	private get cacheDir(): string {
		return `${this.plugin.app.vault.configDir}/plugins/${(this.plugin as Plugin).manifest.id}/cache`;
	}

	/* ------------------------------------------------------------------ */
	/* Requests                                                            */
	/* ------------------------------------------------------------------ */

	private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
		const key = await this.plugin.credentials.get();
		const isV4 = key.startsWith("eyJ");

		const url = new URL(API + path);
		url.searchParams.set("language", this.plugin.settings.language);
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
		if (!isV4) url.searchParams.set("api_key", key);

		const headers: Record<string, string> = { Accept: "application/json" };
		if (isV4) headers["Authorization"] = `Bearer ${key}`;

		let res: RequestUrlResponse;
		try {
			res = await requestUrl({ url: url.toString(), method: "GET", headers, throw: false });
		} catch (e) {
			// The thrown error can contain the full URL, key included.
			throw new TmdbError(redact(e));
		}

		if (res.status === 401) {
			throw new TmdbError("TMDB rejected the key (401). Check it in Settings → Reel.", 401);
		}
		if (res.status === 404) {
			throw new TmdbError("Not found on TMDB (404).", 404);
		}
		if (res.status === 429) {
			throw new TmdbError("TMDB rate limit hit (429). Wait a moment and retry.", 429);
		}
		if (res.status >= 400) {
			let detail = "";
			try {
				detail = String(res.json?.status_message ?? "");
			} catch {
				/* body wasn't json */
			}
			throw new TmdbError(redact(`TMDB error ${res.status}${detail ? `: ${detail}` : ""}`), res.status);
		}

		return res.json as T;
	}

	/** Cached request. `immutable` records survive TTL expiry. */
	private async cached<T>(cacheKey: string, fetcher: () => Promise<T>, immutable = false): Promise<T> {
		if (!this.plugin.settings.cacheResponses) return fetcher();

		const hit = await this.readCache<T>(cacheKey);
		if (hit) return hit;

		const existing = this.inflight.get(cacheKey);
		if (existing) return existing as Promise<T>;

		const p = fetcher()
			.then(async (data) => {
				await this.writeCache(cacheKey, data, immutable);
				return data;
			})
			.finally(() => this.inflight.delete(cacheKey));

		this.inflight.set(cacheKey, p);
		return p;
	}

	/* ------------------------------------------------------------------ */
	/* Public API                                                          */
	/* ------------------------------------------------------------------ */

	/** One command finds films and shows — two commands is more friction on a phone. */
	async searchMulti(query: string): Promise<TmdbSearchResult[]> {
		const q = query.trim();
		if (!q) return [];
		const data = await this.request<{ results?: TmdbSearchResult[] }>("/search/multi", {
			query: q,
			include_adult: "false",
		});
		return (data.results ?? [])
			.filter((r) => r.media_type === "movie" || r.media_type === "tv")
			.slice(0, 20);
	}

	/**
	 * Titles you haven't seen — the input to Discover.
	 *
	 * Cached like anything else, so flicking between the queues doesn't spend a
	 * request each time. Trending changes daily, so a short TTL is honest; the
	 * shared cache TTL is close enough and keeps one policy rather than two.
	 */
	async discover(kind: "trending" | "popular" | "top" | "upcoming", page = 1): Promise<TmdbSearchResult[]> {
		const path =
			kind === "trending"
				? "/trending/all/week"
				: kind === "popular"
					? "/movie/popular"
					: kind === "top"
						? "/movie/top_rated"
						: "/movie/upcoming";

		// Page one and only page one, until now — which is most of why every
		// Discover row ended at about twenty cards and stayed identical between
		// visits. The cache key has to carry the page or page two would be served
		// page one's answer forever.
		const n = Math.max(1, Math.min(500, Math.floor(page)));
		const data = await this.cached(`discover-${kind}${n > 1 ? `-p${n}` : ""}`, () =>
			this.request<{ results?: TmdbSearchResult[] }>(path, n > 1 ? { page: String(n) } : {})
		);

		return (data.results ?? [])
			// /movie/* endpoints omit media_type; everything there is a film.
			.map((r) => ({ ...r, media_type: r.media_type ?? "movie" }))
			.filter((r) => r.media_type === "movie" || r.media_type === "tv");
	}

	/**
	 * "More like this", straight from TMDB.
	 *
	 * `/recommendations` is curated from viewing patterns rather than metadata
	 * similarity, so it suggests things that feel related rather than things
	 * that merely share a genre — which is why it beats `/similar` as the seed
	 * for a "because you liked X" row.
	 */
	async recommendations(id: number, kind: "movie" | "tv", page = 1): Promise<TmdbSearchResult[]> {
		const n = Math.max(1, Math.min(500, Math.floor(page)));
		const data = await this.cached(`rec-${kind}-${id}${n > 1 ? `-p${n}` : ""}`, () =>
			this.request<{ results?: TmdbSearchResult[] }>(
				`/${kind}/${id}/recommendations`,
				n > 1 ? { page: String(n) } : {}
			)
		);
		return (data.results ?? []).map((r) => ({ ...r, media_type: r.media_type ?? kind }));
	}

	/** Filtered discovery: genre, decade, minimum score. */
	async discoverBy(opts: {
		type: "movie" | "tv";
		genreId?: number;
		genreIds?: number[];
		decade?: number;
		minRating?: number;
		page?: number;
		/** A person id, so "more with this actor" is one query rather than a scan. */
		withPerson?: number;
		/** Which credit list to match: cast for actors, crew for directors. */
		personAs?: "cast" | "crew";
	}): Promise<TmdbSearchResult[]> {
		const params: Record<string, string> = {
			sort_by: "popularity.desc",
			// Without a vote floor the results are dominated by obscure titles
			// with a single perfect score, which reads as broken.
			"vote_count.gte": "200",
			include_adult: "false",
		};

		// Certification can only be filtered at the source: discover results
		// carry no certification field, so there is nothing to filter locally
		// without a detail request per title. TMDB will do it for us, but only
		// for films and only with a region.
		const maxCert = this.plugin.settings.maxCertification;
		if (maxCert && opts.type === "movie") {
			params.certification_country = this.plugin.settings.region;
			params["certification.lte"] = maxCert;
		}
		// A comma is AND to TMDB, so several genres means "action *and* comedy"
		// rather than either — which is what naming two of them asks for.
		if (opts.genreIds?.length) params.with_genres = opts.genreIds.join(",");
		else if (opts.genreId) params.with_genres = String(opts.genreId);

		if (opts.withPerson) {
			// with_cast and with_crew exist only on /discover/movie. For a
			// series TMDB offers with_people on neither, so the caller falls
			// back to the person's own credit list.
			const field = opts.personAs === "crew" ? "with_crew" : "with_cast";
			params[field] = String(opts.withPerson);
			// A specific person is already a narrow query; the popularity floor
			// would bury everything but their two best-known films.
			delete params["vote_count.gte"];
		}
		if (opts.minRating) params["vote_average.gte"] = String(opts.minRating);
		if (opts.decade) {
			const from = `${opts.decade}-01-01`;
			const to = `${opts.decade + 9}-12-31`;
			if (opts.type === "movie") {
				params["primary_release_date.gte"] = from;
				params["primary_release_date.lte"] = to;
			} else {
				params["first_air_date.gte"] = from;
				params["first_air_date.lte"] = to;
			}
		}

		// The cache key has to include the certification limit, or changing it
		// would return the previous, unfiltered results.
		const key = `disc-${opts.type}-${opts.genreId ?? 0}-${opts.decade ?? 0}-${opts.minRating ?? 0}-${maxCert ?? "any"}-p${opts.page ?? 1}`;
		if (opts.page && opts.page > 1) params.page = String(opts.page);
		const data = await this.cached(key, () =>
			this.request<{ results?: TmdbSearchResult[] }>(`/discover/${opts.type}`, params)
		);
		return (data.results ?? []).map((r) => ({ ...r, media_type: r.media_type ?? opts.type }));
	}

	/**
	 * `/discover` with parameters supplied directly, plus the total count.
	 *
	 * `filter()` above takes a fixed set of options and builds its own query,
	 * which is right for the filter bar but cannot express a recipe — AND-vs-
	 * OR genres, exclusions, a runtime ceiling. Rather than grow that
	 * signature to a dozen optional fields, a recipe produces the parameters
	 * and this passes them through.
	 *
	 * `total_results` is why this returns an object rather than an array.
	 * Showing "312 films match" while someone is still building a query needs
	 * the count, and TMDB returns both in one response — so the live counter
	 * costs nothing beyond a request that was going to happen anyway.
	 */
	async discoverWith(
		type: "movie" | "tv",
		params: Record<string, string>
	): Promise<{ results: TmdbSearchResult[]; total: number }> {
		const merged: Record<string, string> = {
			sort_by: "popularity.desc",
			include_adult: "false",
			...params,
		};

		// Same reasoning as filter(): discover results carry no certification
		// field, so the content policy is applied at the source or not at all.
		const maxCert = this.plugin.settings.maxCertification;
		if (maxCert && type === "movie") {
			merged.certification_country = this.plugin.settings.region;
			merged["certification.lte"] = maxCert;
		}

		// The key covers every parameter, or two different recipes would share
		// one cached answer. Sorted, so key order cannot cause a miss for a
		// query that is genuinely identical.
		const key = `rec-${type}-${Object.keys(merged)
			.sort()
			.map((k) => `${k}=${merged[k]}`)
			.join("&")}`;

		const data = await this.cached(key, () =>
			this.request<{ results?: TmdbSearchResult[]; total_results?: number }>(`/discover/${type}`, merged)
		);
		return {
			results: (data.results ?? []).map((r) => ({ ...r, media_type: r.media_type ?? type })),
			total: data.total_results ?? 0,
		};
	}

	/** Genre name/id pairs. Immutable in practice, so cached permanently. */
	async genreList(kind: "movie" | "tv"): Promise<{ id: number; name: string }[]> {
		const data = await this.cached(
			`genres-${kind}`,
			() => this.request<{ genres?: { id: number; name: string }[] }>(`/genre/${kind}/list`, {}),
			true
		);
		return data.genres ?? [];
	}

	/**
	 * `append_to_response` is what keeps this to one request. Credits, keywords,
	 * videos, certifications and providers all arrive in the same payload —
	 * five extra endpoints' worth of data for zero extra round trips, which
	 * matters on a phone far more than it does on a desktop.
	 */
	async getFilm(id: number): Promise<TmdbFilm> {
		return this.cached(
			`movie-${id}`,
			() =>
				this.request<TmdbFilm>(`/movie/${id}`, {
					// recommendations and alternative_titles ride along for free:
					// append_to_response is still a single HTTP request, and
					// the detail screen wants both the moment it opens.
					append_to_response:
						"credits,watch/providers,keywords,videos,release_dates,external_ids,recommendations,alternative_titles,reviews",
				}),
			true // a released film's credits and runtime don't change
		);
	}

	async getShow(id: number): Promise<TmdbShow> {
		const fetcher = () =>
			this.request<TmdbShow>(`/tv/${id}`, {
				append_to_response:
					"aggregate_credits,watch/providers,keywords,videos,content_ratings,external_ids,recommendations,alternative_titles,reviews",
			});
		// A returning series gains episodes, so its record must expire.
		const cacheKey = `tv-${id}`;
		const hit = await this.readCache<TmdbShow>(cacheKey);
		if (hit) return hit;
		const data = await fetcher();
		await this.writeCache(cacheKey, data, data.status === "Ended" || data.status === "Canceled");
		return data;
	}

	/** Episode titles for one season. Permanent cache once the show has ended. */
	/**
	 * A person and everything they have been in.
	 *
	 * `combined_credits` spans film and television in one request, which is
	 * what a filmography actually means — splitting them would make an actor
	 * who moved between the two look half as prolific as they are.
	 *
	 * Not immutable: a working actor gains credits.
	 */
	async getPerson(id: number): Promise<TmdbPerson> {
		return this.cached(`person-${id}`, () =>
			this.request<TmdbPerson>(`/person/${id}`, { append_to_response: "combined_credits" })
		);
	}

	/**
	 * Stills and backdrops for a title.
	 *
	 * A separate request rather than an append: images are the heaviest block
	 * TMDB returns and only the gallery ever wants them, so folding them into
	 * every detail fetch would slow down adding a title to pay for a tab most
	 * people never open. Cached immutably — a released title's stills do not
	 * change.
	 *
	 * `include_image_language` asks for language-neutral art first: text-free
	 * backdrops travel better than posters with baked-in titles in a language
	 * the reader may not have.
	 */
	async getImages(id: number, kind: "movie" | "tv"): Promise<{ backdrops?: { file_path?: string }[] }> {
		return this.cached(
			`img-${kind}-${id}`,
			() =>
				this.request<{ backdrops?: { file_path?: string }[] }>(`/${kind}/${id}/images`, {
					include_image_language: "null,en",
				}),
			true
		);
	}

	async getSeason(showId: number, season: number, showEnded = false): Promise<{ episodes: TmdbEpisode[] }> {
		return this.cached(
			`tv-${showId}-s${season}`,
			() => this.request<{ episodes: TmdbEpisode[] }>(`/tv/${showId}/season/${season}`),
			showEnded
		);
	}

	/** Force a refresh, bypassing the cache — used by the new-episode check. */
	async refreshShow(id: number): Promise<TmdbShow> {
		const data = await this.request<TmdbShow>(`/tv/${id}`, {
			append_to_response: "aggregate_credits,watch/providers,keywords,videos,content_ratings",
		});
		await this.writeCache(`tv-${id}`, data, data.status === "Ended" || data.status === "Canceled");
		return data;
	}

	async testCredentials(): Promise<{ ok: true } | { ok: false; error: string }> {
		try {
			await this.request<unknown>("/configuration");
			return { ok: true };
		} catch (e) {
			if (e instanceof MissingKeyError) return { ok: false, error: e.message };
			return { ok: false, error: redact(e) };
		}
	}

	posterUrl(path: string | null | undefined, size?: string): string | null {
		if (!path) return null;
		return `${IMG}/${size ?? this.plugin.settings.posterQuality}${path}`;
	}

	stillUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		return `${IMG}/w300${path}`;
	}

	/** Poster bytes for on-disk caching. Not a JSON request — no key needed. */
	async fetchImage(url: string): Promise<ArrayBuffer> {
		const res = await requestUrl({ url, method: "GET", throw: false });
		if (res.status >= 400) throw new TmdbError(`Poster download failed (${res.status}).`, res.status);
		return res.arrayBuffer;
	}

	/* ------------------------------------------------------------------ */
	/* Disk cache — vault adapter, so it works on mobile with no Node APIs */
	/* ------------------------------------------------------------------ */

	/**
	 * The file a cache key maps to.
	 *
	 * Sanitising alone was not enough and the failure was silent: a comma and
	 * a pipe both became an underscore, so `with_genres=28,35` (action AND
	 * comedy) and `with_genres=28|35` (action OR comedy) shared one file.
	 * Whichever ran first answered for both. See util/cachekey.ts.
	 */
	private cachePath(key: string): string {
		return `${this.cacheDir}/${cacheFileName(key)}`;
	}

	private async readCache<T>(key: string): Promise<T | null> {
		const mem = this.memCache.get(key);
		if (mem && this.isFresh(mem)) return mem.data as T;

		const adapter = this.plugin.app.vault.adapter;
		const path = this.cachePath(key);
		try {
			if (!(await adapter.exists(path))) return null;
			const raw = await adapter.read(path);
			const rec = JSON.parse(raw) as CacheRecord<T>;
			if (!this.isFresh(rec)) return null;
			this.memCache.set(key, rec);
			return rec.data;
		} catch {
			return null; // a corrupt cache file is not worth surfacing
		}
	}

	private isFresh(rec: CacheRecord<unknown>): boolean {
		if (rec.immutable) return true;
		const ttl = this.plugin.settings.cacheTtlDays * 86_400_000;
		return Date.now() - rec.fetchedAt < ttl;
	}

	private async writeCache<T>(key: string, data: T, immutable: boolean): Promise<void> {
		const rec: CacheRecord<T> = { fetchedAt: Date.now(), immutable, data };
		this.memCache.set(key, rec);
		if (!this.plugin.settings.cacheResponses) return;
		const adapter = this.plugin.app.vault.adapter;
		try {
			if (!(await adapter.exists(this.cacheDir))) await adapter.mkdir(this.cacheDir);
			await adapter.write(this.cachePath(key), JSON.stringify(rec));
		} catch {
			// Cache is an optimisation. Failing to write it must never fail the request.
		}
	}

	/**
	 * Cache access for the supplementary clients (OMDb, DoesTheDogDie), so
	 * every network response in the plugin expires under one policy and one
	 * "Clear cache" button rather than three parallel schemes.
	 */
	async readExternalCache<T>(key: string): Promise<T | null> {
		return this.readCache<T>(key);
	}

	async writeExternalCache<T>(key: string, data: T, immutable: boolean): Promise<void> {
		return this.writeCache(key, data, immutable);
	}

	/**
	 * Drop the cached discovery responses.
	 *
	 * Without this, a "Refresh" button clears the screen's own state and then
	 * reads the same cached payloads straight back — visibly doing nothing.
	 * Title metadata is left alone: that genuinely doesn't change, and
	 * refetching it would spend requests for no benefit.
	 */
	async clearDiscoverCache(): Promise<void> {
		for (const key of [...this.memCache.keys()]) {
			if (key.startsWith("discover-") || key.startsWith("disc-") || key.startsWith("rec-")) {
				this.memCache.delete(key);
			}
		}
		const adapter = this.plugin.app.vault.adapter;
		try {
			if (!(await adapter.exists(this.cacheDir))) return;
			const listing = await adapter.list(this.cacheDir);
			for (const f of listing.files) {
				const name = f.split("/").pop() ?? "";
				if (name.startsWith("discover-") || name.startsWith("disc-") || name.startsWith("rec-")) {
					await adapter.remove(f);
				}
			}
		} catch {
			// Cache eviction is best-effort; the memory clear above is what
			// makes the button work within a session.
		}
	}

	async clearCache(): Promise<number> {
		this.memCache.clear();
		const adapter = this.plugin.app.vault.adapter;
		try {
			if (!(await adapter.exists(this.cacheDir))) return 0;
			const listing = await adapter.list(this.cacheDir);
			for (const f of listing.files) await adapter.remove(f);
			return listing.files.length;
		} catch {
			return 0;
		}
	}

	/**
	 * Remove cache files written under the old naming scheme.
	 *
	 * Before the filename carried a hash, a discover query produced names like
	 * `rec-movie-include_adult_false_primary_release_date.gte_2000-01-01_…json`
	 * — long enough that `git add` in the vault failed outright with "Filename
	 * too long", which is a plugin breaking a user's version control over a
	 * cache file it can regenerate for free.
	 *
	 * They are also unreachable: the current `cachePath` never produces those
	 * names, so nothing will ever read them again. Deleting is strictly better
	 * than leaving them to rot.
	 *
	 * Runs once at load, silently. A cache file is never worth a notice.
	 */
	async pruneLegacyCache(): Promise<number> {
		const adapter = this.plugin.app.vault.adapter;
		try {
			if (!(await adapter.exists(this.cacheDir))) return 0;
			const listing = await adapter.list(this.cacheDir);
			let removed = 0;
			for (const path of listing.files) {
				const name = path.split("/").pop() ?? "";
				// Current names are a truncated prefix plus `-<hash>.json`, so
				// they are short and end in a hash. Anything long, or lacking
				// that suffix, predates the scheme.
				const current = /-[a-z0-9]{7,}\.json$/.test(name) && name.length <= 80;
				if (current) continue;
				await adapter.remove(path);
				removed++;
			}
			return removed;
		} catch {
			// Best effort. A vault that will not let us tidy up is not a reason
			// to fail loading.
			return 0;
		}
	}
}
