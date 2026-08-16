/**
 * The tiny query language behind the code blocks:
 *
 *   filter: status = watched, year >= 2020, genre contains Horror
 *   sort: watched desc
 *   layout: poster-grid
 *   limit: 60
 *
 * Deliberately not a general expression parser. Comma-separated clauses, all
 * ANDed, each one `field op value`. That covers what you'd actually write in a
 * note, parses in a few lines, and fails legibly when it doesn't understand
 * something — which matters more than power here, since the error surfaces
 * inside your note.
 */

import type { Entry } from "../types";
import { rangeCount } from "../util/ranges";
import { unlink } from "../library";
import { certificationRank } from "../content";

export type Layout = "poster-grid" | "list" | "compact";

export interface Query {
	type: "film" | "tv" | "all";
	filters: Filter[];
	sortField: string;
	sortDir: 1 | -1;
	layout: Layout;
	limit?: number;
	title?: string;
	chips: boolean;
	errors: string[];
}

interface Filter {
	field: string;
	op: string;
	value: string;
}

// Word operators need surrounding spaces so a title containing "in" or
// "excludes" can't be mistaken for one. Longest-first, so ">=" wins over ">".
// "not in" must precede "in", or `certification not in R` parses as field
// "certification not" with operator "in" and silently matches nothing.
const SYMBOL_OPS = [">=", "<=", "!=", "="];
const WORD_OPS = ["contains", "excludes", "includes", "not in", "in"];
const OPS = [...SYMBOL_OPS, ">", "<", ...WORD_OPS];

export function parseQuery(source: string, defaults: Partial<Query> = {}): Query {
	const q: Query = {
		type: defaults.type ?? "all",
		filters: [],
		sortField: defaults.sortField ?? "watched",
		sortDir: defaults.sortDir ?? -1,
		layout: defaults.layout ?? "poster-grid",
		limit: defaults.limit,
		chips: defaults.chips ?? true,
		errors: [],
	};

	for (const rawLine of source.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const idx = line.indexOf(":");
		if (idx === -1) {
			q.errors.push(`Not understood: "${line}"`);
			continue;
		}
		const key = line.slice(0, idx).trim().toLowerCase();
		const value = line.slice(idx + 1).trim();

		switch (key) {
			case "type": {
				const v = value.toLowerCase();
				q.type = v === "tv" || v === "series" ? "tv" : v === "film" || v === "movie" ? "film" : "all";
				break;
			}
			case "filter":
				q.filters.push(...parseFilters(value, q.errors));
				break;
			case "sort": {
				const [field, dir] = value.split(/\s+/);
				q.sortField = (field ?? "watched").toLowerCase();
				q.sortDir = (dir ?? "desc").toLowerCase() === "asc" ? 1 : -1;
				break;
			}
			case "layout": {
				const v = value.toLowerCase();
				q.layout = v === "list" ? "list" : v === "compact" ? "compact" : "poster-grid";
				break;
			}
			case "limit": {
				const n = parseInt(value, 10);
				if (Number.isFinite(n) && n > 0) q.limit = n;
				else q.errors.push(`limit must be a positive number, got "${value}"`);
				break;
			}
			case "title":
				q.title = value;
				break;
			case "chips":
				q.chips = value.toLowerCase() !== "false" && value.toLowerCase() !== "no";
				break;
			default:
				q.errors.push(`Unknown option "${key}"`);
		}
	}

	return q;
}

function parseFilters(value: string, errors: string[]): Filter[] {
	const out: Filter[] = [];
	// `in` takes a list, so its values are separated by `|` rather than `,`:
	//   filter: certification in G|PG|PG-13
	for (const clause of splitClauses(value)) {
		const c = clause.trim();
		if (!c) continue;
		const lower = c.toLowerCase();

		let op: string | undefined;
		let at = -1;
		for (const candidate of OPS) {
			const token = WORD_OPS.includes(candidate) ? ` ${candidate} ` : candidate;
			const idx = lower.indexOf(token);
			if (idx > 0) {
				op = candidate;
				at = idx;
				break;
			}
		}

		if (!op) {
			errors.push(`Filter needs an operator (= != > < >= <= contains excludes in): "${c}"`);
			continue;
		}

		const token = WORD_OPS.includes(op) ? ` ${op} ` : op;
		out.push({
			field: c.slice(0, at).trim().toLowerCase(),
			op,
			value: c
				.slice(at + token.length)
				.trim()
				.replace(/^["']|["']$/g, ""),
		});
	}
	return out;
}

/** Split on commas that aren't inside a bracketed list. */
function splitClauses(value: string): string[] {
	return value.split(",").map((s) => s.trim());
}

/* -------------------------------------------------------------------- */
/* Evaluation                                                            */
/* -------------------------------------------------------------------- */

export function applyQuery(entries: Entry[], q: Query): Entry[] {
	let rows = entries;
	if (q.type !== "all") rows = rows.filter((e) => e.type === q.type);
	for (const f of q.filters) rows = rows.filter((e) => matches(e, f));
	rows = sortEntries(rows, q.sortField, q.sortDir);
	return q.limit ? rows.slice(0, q.limit) : rows;
}

function matches(entry: Entry, f: Filter): boolean {
	const raw = fieldValue(entry, f.field);

	// `excludes` and `not in` must succeed on a missing field: "no content
	// flags recorded" has to pass `content excludes sex`, or every unflagged
	// title would vanish from a filtered library.
	if (raw == null) return f.op === "excludes" || f.op === "!=" || f.op === "not in";

	const listValues = () => f.value.split("|").map((v) => v.trim().toLowerCase()).filter(Boolean);

	if (Array.isArray(raw)) {
		const hay = raw.map((v) => unlink(String(v)).toLowerCase());
		const needle = f.value.toLowerCase();
		const exact = hay.includes(needle);
		const partial = hay.some((v) => v.includes(needle));
		switch (f.op) {
			case "contains":
			case "includes":
				return partial;
			case "excludes":
				return !partial;
			case "in":
				return hay.some((v) => listValues().includes(v));
			case "not in":
				return !hay.some((v) => listValues().includes(v));
			case "!=":
				return !exact;
			default:
				return exact;
		}
	}

	if (f.op === "in" || f.op === "not in") {
		const hit = listValues().includes(String(raw).toLowerCase());
		return f.op === "in" ? hit : !hit;
	}

	if (typeof raw === "number") {
		const n = Number(f.value);
		if (!Number.isFinite(n)) return false;
		switch (f.op) {
			case ">=": return raw >= n;
			case "<=": return raw <= n;
			case ">": return raw > n;
			case "<": return raw < n;
			case "!=": return raw !== n;
			default: return raw === n;
		}
	}

	const a = String(raw).toLowerCase();
	const b = f.value.toLowerCase();
	switch (f.op) {
		case "contains": return a.includes(b);
		case "!=": return a !== b;
		case ">=": return a >= b;
		case "<=": return a <= b;
		case ">": return a > b;
		case "<": return a < b;
		default: return a === b;
	}
}

function fieldValue(e: Entry, field: string): string | number | string[] | undefined | boolean {
	switch (field) {
		case "status": return e.status;
		case "type": return e.type;
		case "title": return e.title;
		case "year": return e.year ?? e.firstAirYear;
		case "decade": {
			const y = e.year ?? e.firstAirYear;
			return y ? Math.floor(y / 10) * 10 : undefined;
		}
		case "rating": return e.rating;
		case "tmdb_rating": return e.tmdbRating;
		case "liked": return e.liked ? "true" : "false";
		case "genre":
		case "genres": return e.genres;
		case "director": return e.director;
		case "creator":
		case "creators": return e.creators;
		case "runtime": return e.runtime;
		case "show_status": return e.showStatus;
		case "watched": return lastWatchDate(e);
		case "episodes": return e.seasons.reduce((n, s) => n + rangeCount(s.watched), 0);
		case "cast":
		case "actor":
		case "actors": return e.cast;
		case "collection": return e.collection;
		case "provider":
		case "providers":
		case "available": return e.providers;
		case "language": return e.language;
		case "popularity": return e.popularity;
		case "certification":
		case "cert":
		case "rated": return e.certification;
		case "content":
		case "content_flags":
		case "flags": return e.contentFlags;
		case "list":
		case "lists": return e.lists;
		case "company":
		case "studio": return e.productionCompanies;
		case "budget": return e.budget;
		case "revenue": return e.revenue;
		case "added": return e.added;
		case "overview": return e.overview;
		default: return undefined;
	}
}

export function lastWatchDate(e: Entry): string | undefined {
	if (e.type === "tv") return e.lastWatched?.date;
	return e.watched.length ? e.watched[e.watched.length - 1].date : undefined;
}

export function sortEntries(rows: Entry[], field: string, dir: 1 | -1): Entry[] {
	const keyed = rows.map((e) => ({ e, k: sortKey(e, field) }));
	keyed.sort((a, b) => {
		// Missing values always sink, regardless of direction — an unrated film
		// shouldn't lead a "sort: rating asc" list.
		if (a.k == null && b.k == null) return a.e.title.localeCompare(b.e.title);
		if (a.k == null) return 1;
		if (b.k == null) return -1;
		if (typeof a.k === "number" && typeof b.k === "number") return (a.k - b.k) * dir;
		return String(a.k).localeCompare(String(b.k)) * dir;
	});
	return keyed.map((x) => x.e);
}

function sortKey(e: Entry, field: string): string | number | undefined {
	switch (field) {
		case "watched": return lastWatchDate(e);
		// Real creation time. This used to return e.path, which sorted
		// alphabetically while claiming to be chronological.
		case "added": return e.added;
		case "popularity": return e.popularity;
		case "certification": return certificationRank(e.certification) ?? undefined;
		case "title": return e.title.replace(/^(the|a|an)\s+/i, "");
		case "year": return e.year ?? e.firstAirYear;
		case "rating": return e.rating;
		case "tmdb_rating": return e.tmdbRating;
		case "runtime": return e.runtime;
		case "random": return Math.random();
		default: return lastWatchDate(e);
	}
}
