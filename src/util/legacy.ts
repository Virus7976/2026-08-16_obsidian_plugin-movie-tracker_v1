/**
 * Converting another tracker's frontmatter into Reel's.
 *
 * Pure and separate from `importer.ts` because this rewrites notes you already
 * have. An import that mangles a field is worse than one that refuses to run:
 * the old keys are deleted in the same pass, so a bad conversion is not
 * reversible from the note itself.
 *
 * The shape it reads (title-case keys, comma-joined strings) comes from the
 * TV Tracker plugin:
 *
 *   Title: "Ocean's Eleven"
 *   Rating: 5
 *   Genre: "Thriller, Crime"
 *   Duration: 116 minutes
 *   Cast: "George Clooney, Brad Pitt, …"
 *   TMDB ID: 161
 */

import { clampRating } from "./ratings";
import { normaliseDate, yearOf } from "./dates";

/** Keys that mark a note as belonging to the old tracker. */
export function looksLegacy(fm: Record<string, unknown>): boolean {
	if (fm.tmdb_id != null) return false; // already ours
	return fm["TMDB ID"] != null || fm.Title != null || fm.Type != null;
}

/** The old keys, retired once their values have been moved across. */
export const LEGACY_KEYS = [
	"Title", "Rating", "Status", "Type", "Poster", "Genre", "Duration",
	"Avg vote", "Popularity", "Cast", "TMDB ID", "Director",
	"belongs_to_collection", "production_company", "Available On", "original_language",
];

export function str(value: unknown): string | undefined {
	if (value == null) return undefined;
	const s = String(value).trim();
	return s || undefined;
}

/** "Thriller, Crime" → ["Thriller", "Crime"]. Arrays pass through. */
export function splitList(value: unknown): string[] {
	if (value == null) return [];
	if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
	return String(value)
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** "116 minutes" → 116. */
export function minutes(value: unknown): number | undefined {
	if (value == null) return undefined;
	const m = String(value).match(/(\d+)/);
	return m ? parseInt(m[1], 10) : undefined;
}

export function num(value: unknown): number | undefined {
	if (value == null || value === "") return undefined;
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

/**
 * Was the old tracker's scale out of ten?
 *
 * Its slider had about ten stops, so a stored 5 could mean five stars or five
 * out of ten — a factor of two across every note. Decided once from the whole
 * set rather than per note: anything above 5 proves the larger scale.
 */
export function scaleIsTen(ratings: unknown[]): boolean {
	return ratings.some((r) => (num(r) ?? 0) > 5);
}

export interface ConvertOptions {
	halveRatings: boolean;
}

/**
 * Produce the fields to write. Returns only what should change — the caller
 * applies them and deletes `LEGACY_KEYS`, so this stays testable without a
 * vault and without mutating anything.
 */
export function convertLegacy(fm: Record<string, unknown>, opts: ConvertOptions): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	const isTv = /tv|series|show/i.test(String(fm.Type ?? ""));

	out.tmdb_id = num(fm["TMDB ID"]) ?? num(fm.tmdb_id);
	out.type = isTv ? "tv" : "film";
	const title = str(fm.Title);
	if (title) out.title = title;

	const released = normaliseDate(fm.release_date);
	const year = yearOf(released);
	if (year) {
		if (isTv) out.first_air_year = year;
		else out.year = year;
	}

	const director = splitList(fm.Director);
	if (director.length) {
		// The old tracker had one "Director" field for both types; for a show
		// that person is the creator.
		if (isTv) out.creators = director;
		else out.director = director;
	}

	const cast = splitList(fm.Cast);
	if (cast.length) out.cast = cast;

	const genres = splitList(fm.Genre);
	if (genres.length) out.genres = genres;

	const runtime = minutes(fm.Duration);
	if (runtime) {
		if (isTv) out.episode_runtime = runtime;
		else out.runtime = runtime;
	}

	const vote = num(fm["Avg vote"]);
	if (vote != null) out.tmdb_rating = Math.round(vote * 10) / 10;

	const popularity = num(fm.Popularity);
	if (popularity != null) out.popularity = Math.round(popularity * 10) / 10;

	const rating = num(fm.Rating);
	if (rating != null && rating > 0) out.rating = clampRating(opts.halveRatings ? rating / 2 : rating);

	// The two apps use different status vocabularies.
	const status = String(fm.Status ?? "").toLowerCase();
	if (isTv) {
		out.status = status.includes("watchlist")
			? "watchlist"
			: status.includes("complet") || status.includes("watched")
				? "completed"
				: status.includes("drop")
					? "dropped"
					: "watching";
	} else {
		out.status = status.includes("watchlist") ? "watchlist" : status.includes("abandon") ? "abandoned" : "watched";
	}

	// The old notes recorded no viewing dates, so a watch history cannot be
	// reconstructed. One undated entry would be a fabricated fact; an empty
	// array is honest, and the rating survives either way.
	if (!Array.isArray(fm.watched)) out.watched = [];

	const providers = splitList(fm["Available On"]);
	if (providers.length) out.providers = providers;

	const companies = splitList(fm.production_company);
	if (companies.length) out.production_companies = companies;

	const collection = str(fm.belongs_to_collection);
	if (collection) out.collection = collection;

	if (str(fm.overview)) out.overview = str(fm.overview);
	if (str(fm.trailer)) out.trailer = str(fm.trailer);
	if (num(fm.budget) != null) out.budget = num(fm.budget);
	if (num(fm.revenue) != null) out.revenue = num(fm.revenue);
	if (str(fm.original_language)) out.language = str(fm.original_language);

	// The old Poster was a remote URL. Keep it under a different key so the
	// poster backfill can replace it with a local copy later, which is what
	// makes the library work offline.
	const poster = str(fm.Poster);
	if (poster && !str(fm.poster)) out.poster_url = poster;

	// `tags: "tvtracker, Movie"` is a string where Obsidian wants a list, and
	// the marker tag has no meaning once converted.
	const tags = splitList(fm.tags).filter((t) => t.toLowerCase() !== "tvtracker");
	out.tags = tags.length ? tags : undefined;

	return out;
}
