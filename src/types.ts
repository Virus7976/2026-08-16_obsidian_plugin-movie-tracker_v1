/** Shared shapes. Frontmatter is the source of truth; everything here mirrors it. */

export type MediaType = "film" | "tv";

export type FilmStatus = "watched" | "watchlist" | "abandoned";
export type ShowStatus = "watching" | "completed" | "watchlist" | "paused" | "dropped";

/** One viewing of a film. Rewatches append; the array is never rewritten. */
export interface WatchEvent {
	date: string; // ISO yyyy-mm-dd
	rating?: number;
	rewatch?: boolean;
}

/** Per-season progress. `watched` is a compact range string: "1-7" or "1-5,7-9". */
export interface SeasonProgress {
	n: number;
	watched?: string;
	rating?: number;
	total?: number;
	/**
	 * Per-episode ratings, keyed by episode number: `{3: 5, 7: 4.5}`. A sparse
	 * map rather than an array, because you rate a handful of standouts, not
	 * all 62 — and a sparse YAML map stays readable where a mostly-null array
	 * would not.
	 */
	episode_ratings?: Record<string, number>;
}

export interface LastWatched {
	season: number;
	episode: number;
	date: string;
}

/**
 * A row in the in-memory index. Built from frontmatter only — never from note
 * body — so rebuilding is cheap and a user's prose is irrelevant to queries.
 */
export interface Entry {
	path: string;
	basename: string;
	type: MediaType;
	tmdbId: number;
	title: string;
	year?: number;
	/** Films */
	director: string[];
	runtime?: number;
	watched: WatchEvent[];
	/** Series */
	creators: string[];
	firstAirYear?: number;
	showStatus?: string;
	episodeRuntime?: number;
	totalEpisodes?: number;
	seasons: SeasonProgress[];
	lastWatched?: LastWatched;
	nextAirDate?: string;
	/** Both */
	genres: string[];
	poster?: string;
	/** Remote poster from an import, until the backfill stores a local copy. */
	posterUrl?: string;
	tmdbRating?: number;
	status: string;
	rating?: number;
	liked?: boolean;
	/** Rich metadata */
	cast: string[];
	/** "Rainn Wilson as Dwight Schrute", aligned by index with `cast`. */
	characters: string[];
	overview?: string;
	trailer?: string;
	budget?: number;
	revenue?: number;
	collection?: string;
	productionCompanies: string[];
	providers: string[];
	language?: string;
	popularity?: number;
	certification?: string;
	contentFlags: string[];
	contentTopics: string[];
	lists: string[];
	/** External scores */
	imdbId?: string;
	imdbRating?: number;
	/** How many people voted — a 7.9 from 1.2M is not a 7.9 from 400. */
	imdbVotes?: number;
	metacritic?: number;
	rottenTomatoes?: number;
	/** File creation time, so `sort: added` means something. */
	added: number;
	/* ---- Flattened for Obsidian Bases ------------------------------- *
	 * Bases reads frontmatter properties directly and cannot reach into a
	 * nested object or derive a value, so anything worth sorting or grouping
	 * on has to exist as a top-level scalar. These are all derived — written
	 * down rather than computed at read time, purely so Bases can see them. */
	lastWatchedDate?: string;
	lastWatchedEp?: string;
	progress?: number;
	watchCount: number;
}

/* ---------- TMDB response subsets (only the fields we actually read) ---------- */

export interface TmdbSearchResult {
	id: number;
	media_type?: string;
	title?: string; // film
	name?: string; // tv
	release_date?: string;
	first_air_date?: string;
	poster_path?: string | null;
	overview?: string;
	vote_average?: number;
	/** TMDB sends this on every result; only /discover lets us exclude it up front. */
	adult?: boolean;
}

export interface TmdbCrew {
	job?: string;
	name: string;
	/** Headshot path, as on cast. Often absent below the top billing. */
	profile_path?: string | null;
	id?: number;
	department?: string;
}

/**
 * A cast entry. Films put the part in `character`; a show's aggregate credits
 * put it in `roles`, because an actor can play several parts across a run.
 */
export interface TmdbCastMember {
	name: string;
	character?: string;
	roles?: { character?: string }[];
	/** Headshot path. Absent for plenty of people — the UI falls back to initials. */
	profile_path?: string | null;
	id?: number;
	order?: number;
}

/**
 * A person and their filmography.
 *
 * `combined_credits` merges film and TV, which is what a filmography means —
 * an actor who moved between the two would otherwise look half as prolific.
 */
export interface TmdbPerson {
	id: number;
	name: string;
	biography?: string;
	profile_path?: string | null;
	known_for_department?: string;
	birthday?: string | null;
	deathday?: string | null;
	place_of_birth?: string | null;
	combined_credits?: {
		cast?: TmdbPersonCredit[];
		crew?: TmdbPersonCredit[];
	};
}

/**
 * An image a person is tagged in. `media` identifies the title it came from,
 * which is the only reason this is more useful than a plain headshot.
 */
export interface TmdbTaggedImage {
	file_path?: string;
	aspect_ratio?: number;
	media?: { id?: number; media_type?: string };
}

export interface TmdbPersonCredit extends TmdbSearchResult {
	character?: string;
	job?: string;
	popularity?: number;
}

/** One country's release for a film, from the release_dates append. */
export interface TmdbReleaseDate {
	certification?: string;
	release_date?: string;
	/** TMDB's numeric kind: 1 premiere, 2 limited, 3 theatrical, 4 digital, 5 physical, 6 TV. */
	type?: number;
	note?: string;
}

export interface TmdbReleaseDates {
	results?: { iso_3166_1?: string; release_dates?: TmdbReleaseDate[] }[];
}

/** A community review from TMDB. Excerpted and linked, never reproduced whole. */
export interface TmdbReview {
	id?: string;
	author?: string;
	content?: string;
	url?: string;
	created_at?: string;
	author_details?: { rating?: number | null; username?: string };
}

export interface TmdbVideo {
	site?: string;
	type?: string;
	key?: string;
	official?: boolean;
}

export interface TmdbProviderBlock {
	results?: Record<string, { flatrate?: { provider_name: string }[]; free?: { provider_name: string }[] }>;
}

export interface TmdbFilm {
	id: number;
	title: string;
	release_date?: string;
	runtime?: number;
	genres?: { id: number; name: string }[];
	poster_path?: string | null;
	vote_average?: number;
	popularity?: number;
	original_language?: string;
	overview?: string;
	budget?: number;
	revenue?: number;
	belongs_to_collection?: { name?: string } | null;
	production_companies?: { name: string }[];
	credits?: { crew?: TmdbCrew[]; cast?: TmdbCastMember[] };
	keywords?: { keywords?: { name: string }[] };
	videos?: { results?: TmdbVideo[] };
	release_dates?: TmdbReleaseDates;
	external_ids?: { imdb_id?: string | null };
	imdb_id?: string | null;
	"watch/providers"?: TmdbProviderBlock;
	production_countries?: { iso_3166_1?: string; name?: string }[];
	spoken_languages?: { english_name?: string; name?: string }[];
	tagline?: string;
	alternative_titles?: { titles?: { iso_3166_1?: string; title?: string }[] };
	recommendations?: { results?: TmdbSearchResult[] };
	homepage?: string;
	reviews?: { results?: TmdbReview[]; total_results?: number };
}

export interface TmdbSeason {
	season_number: number;
	episode_count?: number;
	name?: string;
	air_date?: string;
}

export interface TmdbShow {
	id: number;
	name: string;
	first_air_date?: string;
	episode_run_time?: number[];
	number_of_episodes?: number;
	genres?: { id: number; name: string }[];
	poster_path?: string | null;
	vote_average?: number;
	overview?: string;
	status?: string;
	seasons?: TmdbSeason[];
	next_episode_to_air?: { air_date?: string; season_number?: number; episode_number?: number } | null;
	created_by?: { name: string }[];
	aggregate_credits?: { crew?: TmdbCrew[]; cast?: TmdbCastMember[] };
	popularity?: number;
	original_language?: string;
	production_companies?: { name: string }[];
	keywords?: { results?: { name: string }[] };
	videos?: { results?: TmdbVideo[] };
	content_ratings?: unknown;
	external_ids?: { imdb_id?: string | null };
	"watch/providers"?: TmdbProviderBlock;
	recommendations?: { results?: TmdbSearchResult[] };
	alternative_titles?: { results?: { iso_3166_1?: string; title?: string }[] };
	homepage?: string;
	tagline?: string;
	reviews?: { results?: TmdbReview[]; total_results?: number };
}

export interface TmdbEpisode {
	episode_number: number;
	name?: string;
	air_date?: string;
	runtime?: number;
	still_path?: string | null;
	overview?: string;
}
