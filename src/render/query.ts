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

const OPS = [">=", "<=", "!=", "=", ">", "<", "contains"];

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
	for (const clause of value.split(",")) {
		const c = clause.trim();
		if (!c) continue;
		const op = OPS.find((o) => c.toLowerCase().includes(o === "contains" ? " contains " : o));
		if (!op) {
			errors.push(`Filter needs an operator (= != > < >= <= contains): "${c}"`);
			continue;
		}
		const token = op === "contains" ? " contains " : op;
		const at = c.toLowerCase().indexOf(token);
		out.push({
			field: c.slice(0, at).trim().toLowerCase(),
			op,
			value: c.slice(at + token.length).trim().replace(/^["']|["']$/g, ""),
		});
	}
	return out;
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
	if (raw == null) return false;

	if (Array.isArray(raw)) {
		const needle = f.value.toLowerCase();
		const hit = raw.some((v) => String(v).toLowerCase() === needle);
		const partial = raw.some((v) => String(v).toLowerCase().includes(needle));
		if (f.op === "contains") return partial;
		if (f.op === "!=") return !hit;
		return hit;
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
		case "added": return e.path;
		case "title": return e.title.replace(/^(the|a|an)\s+/i, "");
		case "year": return e.year ?? e.firstAirYear;
		case "rating": return e.rating;
		case "tmdb_rating": return e.tmdbRating;
		case "runtime": return e.runtime;
		case "random": return Math.random();
		default: return lastWatchDate(e);
	}
}
