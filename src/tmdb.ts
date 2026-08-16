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
import { MissingKeyError } from "./credentials";
import type {
	TmdbEpisode,
	TmdbFilm,
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
	 * `append_to_response` is what keeps this to one request. Credits, keywords,
	 * videos, certifications and providers all arrive in the same payload —
	 * five extra endpoints' worth of data for zero extra round trips, which
	 * matters on a phone far more than it does on a desktop.
	 */
	/**
	 * Titles you haven't seen — the input to Discover.
	 *
	 * Cached like anything else, so flicking between the queues doesn't spend a
	 * request each time. Trending changes daily, so a short TTL is honest; the
	 * shared cache TTL is close enough and keeps one policy rather than two.
	 */
	async discover(kind: "trending" | "popular" | "top" | "upcoming"): Promise<TmdbSearchResult[]> {
		const path =
			kind === "trending"
				? "/trending/all/week"
				: kind === "popular"
					? "/movie/popular"
					: kind === "top"
						? "/movie/top_rated"
						: "/movie/upcoming";

		const data = await this.cached(`discover-${kind}`, () =>
			this.request<{ results?: TmdbSearchResult[] }>(path, {})
		);

		return (data.results ?? [])
			// /movie/* endpoints omit media_type; everything there is a film.
			.map((r) => ({ ...r, media_type: r.media_type ?? "movie" }))
			.filter((r) => r.media_type === "movie" || r.media_type === "tv");
	}

	async getFilm(id: number): Promise<TmdbFilm> {
		return this.cached(
			`movie-${id}`,
			() =>
				this.request<TmdbFilm>(`/movie/${id}`, {
					append_to_response: "credits,watch/providers,keywords,videos,release_dates,external_ids",
				}),
			true // a released film's credits and runtime don't change
		);
	}

	async getShow(id: number): Promise<TmdbShow> {
		const fetcher = () =>
			this.request<TmdbShow>(`/tv/${id}`, {
				append_to_response: "aggregate_credits,watch/providers,keywords,videos,content_ratings,external_ids",
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

	private cachePath(key: string): string {
		return `${this.cacheDir}/${key.replace(/[^a-z0-9._-]/gi, "_")}.json`;
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
}
