/**
 * TMDB payload → frontmatter fields.
 *
 * Kept apart from `notes.ts` so the write path stays about *writing* and this
 * stays about *mapping*. Every function here is pure and takes a plain payload,
 * which is what makes the whole lot testable without a vault.
 */

import {
	certificationFromContentRatings,
	certificationFromReleaseDates,
	flagsFromKeywords,
} from "./content";
import type { TmdbCastMember, TmdbFilm, TmdbShow, TmdbVideo } from "./types";

export interface ExtractOptions {
	/** Wrap people and genres as `[[People/Name|Name]]` links. */
	linkPeople: boolean;
	peopleFolder: string;
	/** How many cast members to keep. The old tracker kept ten. */
	castLimit: number;
	region: string;
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

/**
 * Render a name as a wikilink into a fixed folder, or leave it plain.
 *
 * The folder is explicit — `[[People/Denis Villeneuve|Denis Villeneuve]]`
 * rather than `[[Denis Villeneuve]]` — so that clicking an unresolved link
 * creates the note *there* instead of wherever Obsidian's default happens to
 * point. That is the difference between people notes collecting in one place
 * and them scattering across the vault root.
 */
export function personLink(name: string, opts: ExtractOptions): string {
	if (!opts.linkPeople) return name;
	const clean = name.replace(/[[\]|#^]/g, "").trim();
	if (!clean) return name;
	const folder = opts.peopleFolder.replace(/^\/+|\/+$/g, "");
	return folder ? `[[${folder}/${clean}|${clean}]]` : `[[${clean}]]`;
}

/** Prefer an official YouTube trailer; fall back to any YouTube video. */
export function trailerUrl(videos: TmdbVideo[] | undefined): string | undefined {
	if (!videos?.length) return undefined;
	const youtube = videos.filter((v) => v.site === "YouTube" && v.key);
	const pick =
		youtube.find((v) => v.type === "Trailer" && v.official) ??
		youtube.find((v) => v.type === "Trailer") ??
		youtube.find((v) => v.type === "Teaser") ??
		youtube[0];
	return pick?.key ? `https://www.youtube.com/watch?v=${pick.key}` : undefined;
}

/** Streaming services for the configured region, subscription and free only. */
export function providerNames(block: unknown, region: string): string[] {
	const results = (block as { results?: Record<string, { flatrate?: { provider_name: string }[]; free?: { provider_name: string }[] }> })?.results;
	const row = results?.[region];
	if (!row) return [];
	const names = [...(row.flatrate ?? []), ...(row.free ?? [])].map((p) => p.provider_name);
	return [...new Set(names)];
}

/** The part played. Shows list several roles per actor; take the first. */
function characterOf(c: TmdbCastMember): string {
	if (c.character?.trim()) return c.character.trim();
	const role = c.roles?.find((r) => r.character?.trim());
	return role?.character?.trim() ?? "";
}

export function keywordNames(film: TmdbFilm | TmdbShow): string[] {
	// Films nest under `keywords.keywords`, shows under `keywords.results`.
	// Same endpoint name, different shape — a genuine TMDB inconsistency.
	const asFilm = (film as TmdbFilm).keywords?.keywords;
	const asShow = (film as TmdbShow).keywords?.results;
	return (asFilm ?? asShow ?? []).map((k) => k.name).filter(Boolean);
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Films                                                               */
/* ------------------------------------------------------------------ */

export function filmFields(meta: TmdbFilm, opts: ExtractOptions): Record<string, unknown> {
	const out: Record<string, unknown> = {};

	const directors = (meta.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name);
	if (directors.length) out.director = directors.map((d) => personLink(d, opts));

	const castRows = (meta.credits?.cast ?? []).slice(0, opts.castLimit);
	if (castRows.length) {
		out.cast = castRows.map((c) => personLink(c.name, opts));
		const characters = castRows.map((c) => characterOf(c)).filter(Boolean);
		if (characters.length) out.characters = characters;
	}

	if (meta.runtime) out.runtime = meta.runtime;
	out.genres = (meta.genres ?? []).map((g) => g.name);
	if (meta.vote_average) out.tmdb_rating = round1(meta.vote_average);
	if (meta.popularity) out.popularity = round1(meta.popularity);
	if (meta.original_language) out.language = meta.original_language;
	if (meta.overview) out.overview = meta.overview;
	if (meta.budget) out.budget = meta.budget;
	if (meta.revenue) out.revenue = meta.revenue;
	if (meta.belongs_to_collection?.name) out.collection = meta.belongs_to_collection.name;

	const companies = (meta.production_companies ?? []).map((c) => c.name);
	if (companies.length) out.production_companies = companies;

	const trailer = trailerUrl(meta.videos?.results);
	if (trailer) out.trailer = trailer;

	const providers = providerNames(meta["watch/providers"], opts.region);
	if (providers.length) out.providers = providers;

	const cert = certificationFromReleaseDates(meta.release_dates, opts.region);
	if (cert) out.certification = cert;

	const flags = flagsFromKeywords(keywordNames(meta));
	if (flags.length) out.content_flags = flags;

	if (meta.release_date) out.release_date = meta.release_date;

	// The TMDB path, not a URL — one short string, and the size is chosen at
	// render time. Fetched all along on the detail endpoint and thrown away,
	// which is why the detail screen had no hero image to work with.
	if (meta.backdrop_path) out.backdrop_path = meta.backdrop_path;

	const imdb = meta.external_ids?.imdb_id ?? meta.imdb_id;
	if (imdb) out.imdb_id = imdb;

	return out;
}

/* ------------------------------------------------------------------ */
/* Shows                                                               */
/* ------------------------------------------------------------------ */

export function showFields(meta: TmdbShow, opts: ExtractOptions): Record<string, unknown> {
	const out: Record<string, unknown> = {};

	const creators = (meta.created_by ?? []).map((c) => c.name);
	if (creators.length) out.creators = creators.map((c) => personLink(c, opts));

	// Shows expose a flattened `aggregate_credits`, ordered by prominence
	// across the whole run rather than per episode.
	const castRows = (meta.aggregate_credits?.cast ?? []).slice(0, opts.castLimit);
	if (castRows.length) {
		out.cast = castRows.map((c) => personLink(c.name, opts));
		const characters = castRows.map((c) => characterOf(c)).filter(Boolean);
		if (characters.length) out.characters = characters;
	}

	if (meta.status) out.show_status = meta.status;
	const runtime = meta.episode_run_time?.[0];
	if (runtime) out.episode_runtime = runtime;
	if (meta.number_of_episodes) out.total_episodes = meta.number_of_episodes;
	out.genres = (meta.genres ?? []).map((g) => g.name);
	if (meta.vote_average) out.tmdb_rating = round1(meta.vote_average);
	if (meta.popularity) out.popularity = round1(meta.popularity);
	if (meta.original_language) out.language = meta.original_language;
	if (meta.overview) out.overview = meta.overview;

	const companies = (meta.production_companies ?? []).map((c) => c.name);
	if (companies.length) out.production_companies = companies;

	const trailer = trailerUrl(meta.videos?.results);
	if (trailer) out.trailer = trailer;

	const providers = providerNames(meta["watch/providers"], opts.region);
	if (providers.length) out.providers = providers;

	const cert = certificationFromContentRatings(meta.content_ratings, opts.region);
	if (cert) out.certification = cert;

	const flags = flagsFromKeywords(keywordNames(meta));
	if (flags.length) out.content_flags = flags;

	if (meta.next_episode_to_air?.air_date) out.next_air_date = meta.next_episode_to_air.air_date;

	if (meta.backdrop_path) out.backdrop_path = meta.backdrop_path;

	const imdb = meta.external_ids?.imdb_id;
	if (imdb) out.imdb_id = imdb;

	return out;
}

/** `tt0240772` → the IMDb page. Built rather than stored, so it can't go stale. */
export function imdbUrl(imdbId: string | undefined): string | undefined {
	return imdbId ? `https://www.imdb.com/title/${imdbId}/` : undefined;
}

export function tmdbUrl(tmdbId: number, type: string): string {
	return `https://www.themoviedb.org/${type === "tv" ? "tv" : "movie"}/${tmdbId}`;
}

/**
 * Apply extracted fields to frontmatter without trampling the user.
 *
 * `content_flags` is merged rather than replaced: the derivation is only as
 * good as TMDB's crowd-sourced keywords, so a flag you added by hand must
 * survive a refresh, and one you deleted must stay deleted. `userRemoved`
 * carries the flags previously derived-but-now-absent so we can tell "you
 * removed this" from "TMDB never had it".
 */
export function applyFields(
	fm: Record<string, unknown>,
	fields: Record<string, unknown>,
	opts: { preserve?: string[] } = {}
): void {
	const preserve = new Set(opts.preserve ?? []);
	for (const [key, value] of Object.entries(fields)) {
		if (preserve.has(key)) continue;
		if (key === "content_flags") {
			const existing = Array.isArray(fm.content_flags) ? fm.content_flags.map(String) : [];
			const derived = (value as string[]) ?? [];
			fm.content_flags = [...new Set([...existing, ...derived])].sort();
			continue;
		}
		fm[key] = value;
	}
}
