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

export interface TmdbFilm {
	id: number;
	title: string;
	release_date?: string;
	runtime?: number;
	genres?: { id: number; name: string }[];
	poster_path?: string | null;
	vote_average?: number;
	overview?: string;
	credits?: { crew?: TmdbCrew[]; cast?: { name: string }[] };
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
	aggregate_credits?: { crew?: TmdbCrew[] };
}

export interface TmdbEpisode {
	episode_number: number;
	name?: string;
	air_date?: string;
	runtime?: number;
	still_path?: string | null;
	overview?: string;
}
