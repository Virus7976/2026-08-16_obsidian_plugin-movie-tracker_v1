/**
 * The in-memory index.
 *
 * Built once at load from `metadataCache.getFileCache().frontmatter` across the
 * film and series folders, then kept live off `metadataCache.on("changed")`.
 * This is what replaces Dataview: the grid reads a plain array, so filtering
 * 800 titles is a synchronous pass that finishes before the frame does. A
 * DataviewJS block doing the same work is the thing that feels sluggish on a
 * phone, and this removes the dependency entirely.
 */

import { Events, TAbstractFile, TFile, normalizePath } from "obsidian";
import type ReelPlugin from "./main";
import type { Entry, SeasonProgress, WatchEvent } from "./types";
import { normaliseDate } from "./util/dates";
import { rangeCount } from "./util/ranges";

export class Library extends Events {
	private entries = new Map<string, Entry>();
	private ready = false;
	/** Lowercased haystack per entry, built lazily and dropped on change. */
	private searchCache = new Map<string, string>();

	constructor(private plugin: ReelPlugin) {
		super();
	}

	/* ------------------------------------------------------------------ */

	load(): void {
		this.rebuild();

		const { metadataCache, vault } = this.plugin.app;

		this.plugin.registerEvent(
			metadataCache.on("changed", (file) => {
				if (this.inScope(file.path)) this.upsert(file);
			})
		);
		this.plugin.registerEvent(
			vault.on("delete", (file: TAbstractFile) => {
				if (this.entries.delete(file.path)) this.emitChange();
			})
		);
		this.plugin.registerEvent(
			vault.on("rename", (file: TAbstractFile, oldPath: string) => {
				if (!(file instanceof TFile)) {
					// A folder moved. Only the folder's own path arrives here,
					// and a folder is never in the index — but every entry
					// beneath it now holds a stale path, which renders fine and
					// fails to open. Rebuilding is idempotent, so this stays
					// correct even if child renames are also delivered.
					this.rebuild();
					return;
				}
				this.entries.delete(oldPath);
				if (this.inScope(file.path)) this.upsert(file);
				else this.emitChange();
			})
		);
		// A vault can finish resolving after onload; rebuild once it settles.
		this.plugin.registerEvent(metadataCache.on("resolved", () => {
			if (!this.ready) {
				this.ready = true;
				this.rebuild();
			}
		}));
	}

	rebuild(): void {
		this.entries.clear();
		this.searchCache.clear();
		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			if (this.inScope(file.path)) this.upsert(file, true);
		}
		this.emitChange();
	}

	private inScope(path: string): boolean {
		const p = normalizePath(path);
		const film = normalizePath(this.plugin.settings.filmFolder);
		const series = normalizePath(this.plugin.settings.seriesFolder);
		return p.startsWith(film + "/") || p.startsWith(series + "/");
	}

	private upsert(file: TFile, quiet = false): void {
		const fm = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		// A non-numeric id would index as NaN, and NaN never equals itself — so
		// byTmdbId() would silently miss and the search modal would offer to
		// create a second note for a title already in the library.
		if (!fm || fm.tmdb_id == null || !Number.isFinite(Number(fm.tmdb_id))) {
			// The note lost its id, or never had one — drop it from the index.
			if (this.entries.delete(file.path) && !quiet) this.emitChange();
			return;
		}
		this.entries.set(file.path, toEntry(file, fm, this.plugin.settings.seriesFolder));
		this.searchCache.delete(file.path);
		if (!quiet) this.emitChange();
	}

	private emitChange(): void {
		this.trigger("changed");
	}

	/* ------------------------------------------------------------------ */
	/* Reads                                                               */
	/* ------------------------------------------------------------------ */

	all(): Entry[] {
		return [...this.entries.values()];
	}

	films(): Entry[] {
		return this.all().filter((e) => e.type === "film");
	}

	shows(): Entry[] {
		return this.all().filter((e) => e.type === "tv");
	}

	byPath(path: string): Entry | undefined {
		return this.entries.get(normalizePath(path));
	}

	byTmdbId(id: number, type?: Entry["type"]): Entry | undefined {
		return this.all().find((e) => e.tmdbId === id && (!type || e.type === type));
	}

	get size(): number {
		return this.entries.size;
	}

	/** Shows with progress but not finished — the Up Next source. */
	inProgress(): Entry[] {
		return this.shows()
			.filter((e) => {
				if (e.status === "completed" || e.status === "dropped" || e.status === "watchlist") return false;
				return e.seasons.some((s) => rangeCount(s.watched) > 0);
			})
			.sort((a, b) => (b.lastWatched?.date ?? "").localeCompare(a.lastWatched?.date ?? ""));
	}

	/**
	 * Free-text search across title, people, genres and collection.
	 *
	 * A plain substring scan over a prebuilt lowercase haystack. At a few
	 * thousand titles that is under a millisecond, so the search box can filter
	 * on every keystroke without debouncing — which is what makes it feel
	 * instant rather than laggy on a phone.
	 */
	search(query: string, pool?: Entry[]): Entry[] {
		const q = query.trim().toLowerCase();
		const rows = pool ?? this.all();
		if (!q) return rows;
		// Quoted runs stay together, so "the office" doesn't match every title
		// containing "the". Everything else splits on whitespace and must all
		// match, which is what makes adding a word narrow rather than widen.
		const terms = (q.match(/"[^"]+"|\S+/g) ?? []).map((t) => t.replace(/^"|"$/g, "")).filter(Boolean);
		return rows.filter((e) => {
			const hay = this.haystack(e);
			return terms.every((t) => hay.includes(t));
		});
	}

	private haystack(e: Entry): string {
		let hay = this.searchCache.get(e.path);
		if (hay == null) {
			hay = [
				e.title,
				e.basename,
				String(e.year ?? e.firstAirYear ?? ""),
				...e.director,
				...e.creators,
				...e.cast,
				...e.characters,
				...e.genres,
				...e.lists,
				e.collection ?? "",
				e.certification ?? "",
				// People remember plots more reliably than titles, but a whole
				// synopsis per title is half a megabyte of lowercased string
				// across a large library, and the distinguishing words are
				// almost always in the opening sentence.
				(e.overview ?? "").slice(0, 160),
			]
				.join(" ")
				// Strip wikilink syntax so searching "Villeneuve" still matches
				// `[[People/Denis Villeneuve|Denis Villeneuve]]`.
				.replace(/[[\]|]/g, " ")
				.toLowerCase();
			this.searchCache.set(e.path, hay);
		}
		return hay;
	}

	/** Every list name in use, for chips and the "add to list" picker. */
	lists(): string[] {
		const set = new Set<string>();
		for (const e of this.entries.values()) e.lists.forEach((l) => set.add(l));
		return [...set].sort();
	}

	/** Distinct genres across the library, for the filter chips. */
	genres(): string[] {
		const set = new Set<string>();
		for (const e of this.entries.values()) e.genres.forEach((g) => set.add(g));
		return [...set].sort();
	}

	decades(): number[] {
		const set = new Set<number>();
		for (const e of this.entries.values()) {
			const y = e.year ?? e.firstAirYear;
			if (y) set.add(Math.floor(y / 10) * 10);
		}
		return [...set].sort((a, b) => b - a);
	}
}

/* -------------------------------------------------------------------- */
/* Frontmatter → Entry                                                   */
/* -------------------------------------------------------------------- */

function toEntry(file: TFile, fm: Record<string, unknown>, seriesFolder: string): Entry {
	const declared = String(fm.type ?? "").toLowerCase();
	// `type:` is authoritative; folder is the fallback for hand-made notes.
	const type: Entry["type"] =
		declared === "tv" || declared === "series" || declared === "show"
			? "tv"
			: declared === "film" || declared === "movie"
				? "film"
				: file.path.startsWith(normalizePath(seriesFolder) + "/")
					? "tv"
					: "film";

	return {
		path: file.path,
		basename: file.basename,
		type,
		tmdbId: Number(fm.tmdb_id),
		title: String(fm.title ?? file.basename),
		year: numberOrUndef(fm.year),
		director: toStringArray(fm.director),
		runtime: numberOrUndef(fm.runtime),
		watched: toWatchEvents(fm.watched),
		creators: toStringArray(fm.creators ?? fm.creator),
		firstAirYear: numberOrUndef(fm.first_air_year),
		showStatus: fm.show_status ? String(fm.show_status) : undefined,
		episodeRuntime: numberOrUndef(fm.episode_runtime),
		totalEpisodes: numberOrUndef(fm.total_episodes),
		seasons: toSeasons(fm.seasons),
		lastWatched: toLastWatched(fm.last_watched),
		nextAirDate: normaliseDate(fm.next_air_date),
		genres: toStringArray(fm.genres),
		poster: fm.poster ? String(fm.poster) : undefined,
		posterUrl: fm.poster_url ? String(fm.poster_url) : undefined,
		tmdbRating: numberOrUndef(fm.tmdb_rating),
		status: String(fm.status ?? (type === "tv" ? "watching" : "watched")),
		rating: numberOrUndef(fm.rating),
		liked: fm.liked === true,
		cast: toStringArray(fm.cast),
		characters: toStringArray(fm.characters),
		overview: fm.overview ? String(fm.overview) : undefined,
		trailer: fm.trailer ? String(fm.trailer) : undefined,
		budget: numberOrUndef(fm.budget),
		revenue: numberOrUndef(fm.revenue),
		collection: fm.collection ? String(fm.collection) : undefined,
		productionCompanies: toStringArray(fm.production_companies),
		providers: toStringArray(fm.providers),
		language: fm.language ? String(fm.language) : undefined,
		popularity: numberOrUndef(fm.popularity),
		certification: fm.certification ? String(fm.certification) : undefined,
		contentFlags: toStringArray(fm.content_flags),
		contentTopics: toStringArray(fm.content_topics),
		lists: toStringArray(fm.lists),
		imdbId: fm.imdb_id ? String(fm.imdb_id) : undefined,
		imdbRating: numberOrUndef(fm.imdb_rating),
		metacritic: numberOrUndef(fm.metacritic),
		rottenTomatoes: numberOrUndef(fm.rotten_tomatoes),
		lastWatchedDate: normaliseDate(fm.last_watched_date),
		lastWatchedEp: fm.last_watched_ep ? String(fm.last_watched_ep) : undefined,
		progress: numberOrUndef(fm.progress),
		watchCount: numberOrUndef(fm.watch_count) ?? (Array.isArray(fm.watched) ? fm.watched.length : 0),
		// The real creation time, so `sort: added` is chronological rather than
		// the alphabetical-by-path it used to silently be.
		added: file.stat?.ctime ?? 0,
	};
}

/** Strip `[[Folder/Name|Name]]` down to `Name` for display and grouping. */
export function unlink(value: string): string {
	const m = String(value).match(/^\[\[([^\]]+)\]\]$/);
	if (!m) return String(value).trim();
	const inner = m[1];
	const pipe = inner.lastIndexOf("|");
	const text = pipe >= 0 ? inner.slice(pipe + 1) : inner;
	const slash = text.lastIndexOf("/");
	return (slash >= 0 ? text.slice(slash + 1) : text).trim();
}

function numberOrUndef(v: unknown): number | undefined {
	if (v == null || v === "") return undefined;
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
}

function toStringArray(v: unknown): string[] {
	if (v == null) return [];
	if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
	// Tolerate a hand-typed "Denis Villeneuve, Someone Else".
	return String(v)
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function toWatchEvents(v: unknown): WatchEvent[] {
	if (!Array.isArray(v)) return [];
	const out: WatchEvent[] = [];
	for (const raw of v) {
		if (raw == null) continue;
		if (typeof raw === "string") {
			const date = normaliseDate(raw);
			if (date) out.push({ date });
			continue;
		}
		const obj = raw as Record<string, unknown>;
		const date = normaliseDate(obj.date);
		if (!date) continue;
		out.push({
			date,
			rating: numberOrUndef(obj.rating),
			rewatch: obj.rewatch === true,
		});
	}
	return out.sort((a, b) => a.date.localeCompare(b.date));
}

function toSeasons(v: unknown): SeasonProgress[] {
	if (!Array.isArray(v)) return [];
	const out: SeasonProgress[] = [];
	for (const raw of v) {
		if (raw == null || typeof raw !== "object") continue;
		const obj = raw as Record<string, unknown>;
		const n = numberOrUndef(obj.n ?? obj.season);
		if (n == null) continue;
		const row: SeasonProgress & { total?: number } = {
			n,
			watched: obj.watched == null ? "" : String(obj.watched),
			rating: numberOrUndef(obj.rating),
		};
		const total = numberOrUndef(obj.total);
		if (total != null) row.total = total;
		out.push(row);
	}
	return out.sort((a, b) => a.n - b.n);
}

function toLastWatched(v: unknown): Entry["lastWatched"] {
	if (!v || typeof v !== "object") return undefined;
	const obj = v as Record<string, unknown>;
	const season = numberOrUndef(obj.season);
	const episode = numberOrUndef(obj.episode);
	const date = normaliseDate(obj.date);
	if (season == null || episode == null) return undefined;
	return { season, episode, date: date ?? "" };
}
