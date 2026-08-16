/**
 * Flattened properties for Obsidian Bases.
 *
 * Bases reads frontmatter properties directly. It cannot reach into a nested
 * object, and it cannot derive a value — so `last_watched: {season: 3,
 * episode: 4}` is invisible to it, and "how far through this show am I" is
 * unanswerable no matter how neatly the range strings encode it.
 *
 * The fix is to write the derived values down. That is deliberate duplication:
 * `progress` can always be recomputed from `seasons`, and if the two ever
 * disagree the range strings win. They're kept in step by being rewritten on
 * every mutation that could change them, from one function — this one.
 *
 * The same fields serve Dataview and plain search, so this isn't Bases-only
 * work even if Bases is what prompted it.
 */

import { rangeCount } from "./util/ranges";
import { normaliseDate } from "./util/dates";

export interface DerivedFields {
	/** Flat date of the most recent viewing — films and shows alike. */
	last_watched_date?: string;
	/** "S3E4" — human-readable and sortable enough for a column. */
	last_watched_ep?: string;
	/** 0–100. Shows only; a film is not partially watched. */
	progress?: number;
	/** Viewings for a film, completed runs for a series. */
	watch_count: number;
	/** One `year` for both types, so a single Base can sort the whole library. */
	year?: number;
	/** Poster as an embed, so Bases card view can use it as a cover image. */
	poster_embed?: string;
}

interface SeasonLike {
	watched?: string;
	total?: number;
}

interface WatchLike {
	date?: unknown;
}

export interface DeriveInput {
	type: string;
	seasons?: SeasonLike[];
	watched?: WatchLike[];
	totalEpisodes?: number;
	lastWatched?: { season?: number; episode?: number; date?: unknown } | null;
	year?: number;
	firstAirYear?: number;
	poster?: string;
}

export function derive(input: DeriveInput): DerivedFields {
	const isTv = input.type === "tv";
	const history = Array.isArray(input.watched) ? input.watched : [];

	const out: DerivedFields = {
		watch_count: history.length,
	};

	/* ---- last watched ------------------------------------------------ */
	if (isTv) {
		const date = normaliseDate(input.lastWatched?.date);
		if (date) out.last_watched_date = date;
		const s = input.lastWatched?.season;
		const e = input.lastWatched?.episode;
		if (s != null && e != null) out.last_watched_ep = `S${s}E${e}`;
	} else {
		// The array is kept sorted by date, so the last entry is the newest.
		const last = history[history.length - 1];
		const date = normaliseDate((last as { date?: unknown })?.date);
		if (date) out.last_watched_date = date;
	}

	/* ---- progress ---------------------------------------------------- */
	if (isTv) {
		const seasons = Array.isArray(input.seasons) ? input.seasons : [];
		const seen = seasons.reduce((n, s) => n + rangeCount(s.watched), 0);
		// Prefer TMDB's total; fall back to the sum of per-season totals so a
		// hand-made note still gets a number.
		const total = input.totalEpisodes || seasons.reduce((n, s) => n + (Number(s.total) || 0), 0);
		if (total > 0) out.progress = Math.min(100, Math.round((seen / total) * 100));
		else if (seen > 0) out.progress = 0; // watched something, total unknown
	}

	/* ---- unified year ------------------------------------------------ */
	const year = isTv ? (input.firstAirYear ?? input.year) : (input.year ?? input.firstAirYear);
	if (year) out.year = year;

	/* ---- poster embed ------------------------------------------------ */
	if (input.poster) out.poster_embed = `![[${input.poster}]]`;

	return out;
}

/** Write derived fields onto a frontmatter object, clearing stale ones. */
export function applyDerived(fm: Record<string, unknown>, derived: DerivedFields): void {
	const keys: (keyof DerivedFields)[] = [
		"last_watched_date",
		"last_watched_ep",
		"progress",
		"watch_count",
		"year",
		"poster_embed",
	];
	for (const key of keys) {
		const value = derived[key];
		// An absent derived value must delete the property rather than leave a
		// stale one behind — a progress of 40% on a show you reset would be
		// worse than no progress at all.
		if (value == null || value === "") delete fm[key];
		else fm[key] = value;
	}
}

/* ------------------------------------------------------------------ */
/* Starter .base files                                                 */
/* ------------------------------------------------------------------ */

/**
 * Starter Bases views.
 *
 * The `.base` format is YAML and has changed since it shipped, so these are
 * written as plain files for you to adjust rather than generated from a schema
 * this plugin pretends to know. They exist to save the typing and to show which
 * properties are worth querying — not to be authoritative.
 */
export const STARTER_BASES: { name: string; content: string }[] = [
	{
		name: "All films.base",
		content: `filters:
  and:
    - 'type == "film"'
views:
  - type: table
    name: All films
    order:
      - title
      - year
      - rating
      - imdb_rating
      - metacritic
      - runtime
      - last_watched_date
    sort:
      - property: last_watched_date
        direction: DESC
`,
	},
	{
		name: "Watchlist.base",
		content: `filters:
  and:
    - 'status == "watchlist"'
views:
  - type: cards
    name: Watchlist
    image: poster_embed
    order:
      - title
      - year
      - runtime
      - certification
    sort:
      - property: year
        direction: DESC
`,
	},
	{
		name: "In progress.base",
		content: `filters:
  and:
    - 'type == "tv"'
    - 'progress > 0'
    - 'progress < 100'
views:
  - type: table
    name: In progress
    order:
      - title
      - last_watched_ep
      - progress
      - total_episodes
      - last_watched_date
    sort:
      - property: last_watched_date
        direction: DESC
`,
	},
	{
		name: "Family safe.base",
		content: `# Certification is board-assigned and dependable.
# content_flags is inferred and under-reports — see SECURITY/README.
filters:
  and:
    - 'certification != "R"'
    - 'certification != "NC-17"'
    - 'certification != "TV-MA"'
views:
  - type: cards
    name: Family safe
    image: poster_embed
    order:
      - title
      - year
      - certification
      - content_flags
`,
	},
	{
		name: "Highest rated.base",
		content: `filters:
  and:
    - 'rating != null'
views:
  - type: table
    name: Highest rated
    order:
      - title
      - year
      - rating
      - imdb_rating
      - metacritic
      - rotten_tomatoes
    sort:
      - property: rating
        direction: DESC
`,
	},
];
