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
	tmdbRating?: number;
	status: string;
	rating?: number;
	liked?: boolean;
	/** Rich metadata */
	cast: string[];
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
	lists: string[];
	/** File creation time, so `sort: added` means something. */
	added: number;
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
}

export interface TmdbCrew {
	job?: string;
	name: string;
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
	credits?: { crew?: TmdbCrew[]; cast?: { name: string }[] };
	keywords?: { keywords?: { name: string }[] };
	videos?: { results?: TmdbVideo[] };
	release_dates?: unknown;
	"watch/providers"?: TmdbProviderBlock;
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
	aggregate_credits?: { crew?: TmdbCrew[]; cast?: { name: string }[] };
	popularity?: number;
	original_language?: string;
	production_companies?: { name: string }[];
	keywords?: { results?: { name: string }[] };
	videos?: { results?: TmdbVideo[] };
	content_ratings?: unknown;
	"watch/providers"?: TmdbProviderBlock;
}

export interface TmdbEpisode {
	episode_number: number;
	name?: string;
	air_date?: string;
	runtime?: number;
	still_path?: string | null;
	overview?: string;
}
