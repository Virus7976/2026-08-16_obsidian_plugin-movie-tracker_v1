/**
 * Note creation and mutation.
 *
 * Every write to an existing note goes through `processFrontMatter`, which
 * parses the YAML, hands us the object, and reserialises only that block. The
 * body is never touched — so the plugin cannot clobber your writing, no matter
 * what it does to the metadata.
 */

import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type ReelPlugin from "./main";
import { clampRating } from "./util/ratings";
import { addToRange, contiguousProgress, rangeCount } from "./util/ranges";
import { nextShowStatus } from "./util/status";
import { normaliseDate, todayISO, yearOf } from "./util/dates";
import type { Entry, SeasonProgress, TmdbFilm, TmdbShow, WatchEvent } from "./types";
import { redact } from "./secrets";

export interface LogPayload {
	date: string;
	rating?: number;
	liked?: boolean;
	watchlist?: boolean;
	rewatch?: boolean;
}

export class NoteWriter {
	constructor(private plugin: ReelPlugin) {}

	/* ------------------------------------------------------------------ */
	/* Creation                                                            */
	/* ------------------------------------------------------------------ */

	async createFilm(meta: TmdbFilm, log: LogPayload): Promise<TFile> {
		const year = yearOf(meta.release_date);
		const folder = this.plugin.settings.filmFolder;
		const path = await this.uniquePath(folder, this.filmBasename(meta.title, year));

		const poster = await this.plugin.posters.cache(meta.id, "film", meta.poster_path);
		const directors = (meta.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name);

		const file = await this.createNote(path);
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			fm.tmdb_id = meta.id;
			fm.type = "film";
			fm.title = meta.title;
			if (year) fm.year = year;
			if (directors.length) fm.director = directors;
			if (meta.runtime) fm.runtime = meta.runtime;
			fm.genres = (meta.genres ?? []).map((g) => g.name);
			if (poster) fm.poster = poster;
			if (meta.vote_average) fm.tmdb_rating = round1(meta.vote_average);

			if (log.watchlist) {
				fm.status = "watchlist";
				fm.watched = [];
			} else {
				fm.status = "watched";
				const event: WatchEvent = { date: log.date, rewatch: false };
				if (log.rating != null) event.rating = clampRating(log.rating);
				fm.watched = [event];
				if (log.rating != null) fm.rating = clampRating(log.rating);
			}
			if (log.liked) fm.liked = true;
		});

		return file;
	}

	async createShow(meta: TmdbShow, log: LogPayload): Promise<TFile> {
		const folder = this.plugin.settings.seriesFolder;
		const path = await this.uniquePath(folder, sanitize(meta.name));

		const poster = await this.plugin.posters.cache(meta.id, "tv", meta.poster_path);
		const creators = (meta.created_by ?? []).map((c) => c.name);

		// Season 0 is TMDB's "Specials" bucket — real seasons only.
		const seasons = (meta.seasons ?? []).filter((s) => s.season_number > 0);

		const file = await this.createNote(path);
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			fm.tmdb_id = meta.id;
			fm.type = "tv";
			fm.title = meta.name;
			const fay = yearOf(meta.first_air_date);
			if (fay) fm.first_air_year = fay;
			if (creators.length) fm.creators = creators;
			fm.status = log.watchlist ? "watchlist" : "watching";
			if (meta.status) fm.show_status = meta.status;
			const runtime = meta.episode_run_time?.[0];
			if (runtime) fm.episode_runtime = runtime;
			if (meta.number_of_episodes) fm.total_episodes = meta.number_of_episodes;
			fm.genres = (meta.genres ?? []).map((g) => g.name);
			if (poster) fm.poster = poster;
			if (meta.vote_average) fm.tmdb_rating = round1(meta.vote_average);
			// Season shells carry the episode count so progress maths needs no
			// further requests. `watched` stays empty until you tick something.
			fm.seasons = seasons.map((s) => ({ n: s.season_number, watched: "", total: s.episode_count ?? 0 }));
			if (log.liked) fm.liked = true;
			if (log.rating != null) fm.rating = clampRating(log.rating);
		});

		return file;
	}

	/* ------------------------------------------------------------------ */
	/* Mutation                                                            */
	/* ------------------------------------------------------------------ */

	/** Append a viewing to a film. Second and later entries are rewatches. */
	async logFilm(file: TFile, log: LogPayload): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const history: WatchEvent[] = Array.isArray(fm.watched) ? [...fm.watched] : [];

			if (log.watchlist) {
				fm.status = "watchlist";
				if (log.liked != null) fm.liked = log.liked;
				return;
			}

			const event: WatchEvent = {
				date: log.date || todayISO(),
				rewatch: log.rewatch ?? history.length > 0,
			};
			if (log.rating != null) event.rating = clampRating(log.rating);
			history.push(event);
			history.sort((a, b) => String(a.date).localeCompare(String(b.date)));

			fm.watched = history;
			fm.status = "watched";
			// `rating` mirrors the most recent viewing that carried one, so the
			// grid and stats can read a single field.
			const lastRated = [...history].reverse().find((h) => h.rating != null);
			if (lastRated?.rating != null) fm.rating = lastRated.rating;
			if (log.liked != null) fm.liked = log.liked;
		});
	}

	/** Mark one episode watched: extend the range, move `last_watched`. */
	async markEpisode(file: TFile, season: number, episode: number, date = todayISO()): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const seasons: SeasonProgress[] = Array.isArray(fm.seasons) ? [...fm.seasons] : [];
			let row = seasons.find((s) => Number(s.n) === season);
			if (!row) {
				row = { n: season, watched: "" };
				seasons.push(row);
				seasons.sort((a, b) => Number(a.n) - Number(b.n));
			}
			row.watched = addToRange(row.watched, episode);
			fm.seasons = seasons;
			fm.last_watched = { season, episode, date };
			if (fm.status === "watchlist" || fm.status === "paused" || !fm.status) fm.status = "watching";
			this.settleShowStatus(fm, seasons);
		});
	}

	/** Set a whole season's range at once — used by the episode checklist. */
	async setSeasonRange(file: TFile, season: number, range: string, date = todayISO()): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const seasons: SeasonProgress[] = Array.isArray(fm.seasons) ? [...fm.seasons] : [];
			let row = seasons.find((s) => Number(s.n) === season);
			if (!row) {
				row = { n: season };
				seasons.push(row);
				seasons.sort((a, b) => Number(a.n) - Number(b.n));
			}
			row.watched = range;
			fm.seasons = seasons;
			const furthest = contiguousProgress(range);
			if (furthest > 0) fm.last_watched = { season, episode: furthest, date };
			// Ticking episodes starts a watchlisted show, mirroring markEpisode.
			// Clearing a season must not, hence the count check.
			if (rangeCount(range) > 0 && (fm.status === "watchlist" || !fm.status)) fm.status = "watching";
			this.settleShowStatus(fm, seasons);
		});
	}

	/**
	 * Flip to `completed` once every episode TMDB knows about is ticked, and
	 * back to `watching` when a returning series gains a season. The set of
	 * statuses this must not touch lives in `nextShowStatus`.
	 */
	private settleShowStatus(fm: Record<string, unknown>, seasons: SeasonProgress[]): void {
		const watched = seasons.reduce((sum, s) => sum + rangeCount(s.watched), 0);
		const next = nextShowStatus(String(fm.status ?? ""), watched, Number(fm.total_episodes ?? 0));
		if (next) fm.status = next;
	}

	async setStatus(file: TFile, status: string): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			fm.status = status;
		});
	}

	async setRating(file: TFile, rating: number | null): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			if (rating == null) {
				delete fm.rating;
				return;
			}
			const value = clampRating(rating);
			fm.rating = value;
			// Keep the newest viewing in step, so history and headline agree.
			// Only rewrite an entry that is actually an object: spreading a
			// hand-written `- 2024-03-11` string would explode it into
			// character-indexed keys and destroy the entry.
			if (Array.isArray(fm.watched) && fm.watched.length) {
				const history = [...fm.watched];
				const last = history[history.length - 1];
				if (last && typeof last === "object" && !Array.isArray(last)) {
					history[history.length - 1] = { ...last, rating: value };
					fm.watched = history;
				}
			}
		});
	}

	async toggleLiked(file: TFile): Promise<boolean> {
		let next = false;
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			next = !fm.liked;
			if (next) fm.liked = true;
			else delete fm.liked;
		});
		return next;
	}

	/** Refresh TMDB-owned fields, leaving everything you entered alone. */
	async refreshMetadata(entry: Entry): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
		if (!(file instanceof TFile)) return;

		if (entry.type === "tv") {
			const meta = await this.plugin.tmdb.refreshShow(entry.tmdbId);
			const poster = await this.plugin.posters.cache(meta.id, "tv", meta.poster_path);
			await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
				if (meta.status) fm.show_status = meta.status;
				if (meta.number_of_episodes) fm.total_episodes = meta.number_of_episodes;
				if (meta.next_episode_to_air?.air_date) fm.next_air_date = meta.next_episode_to_air.air_date;
				else delete fm.next_air_date;
				if (poster && !fm.poster) fm.poster = poster;

				// Merge new seasons in without touching existing progress.
				const known: SeasonProgress[] = Array.isArray(fm.seasons) ? [...fm.seasons] : [];
				for (const s of meta.seasons ?? []) {
					if (s.season_number <= 0) continue;
					const row = known.find((k) => Number(k.n) === s.season_number);
					if (row) (row as SeasonProgress & { total?: number }).total = s.episode_count ?? 0;
					else known.push({ n: s.season_number, watched: "", ...{ total: s.episode_count ?? 0 } });
				}
				known.sort((a, b) => Number(a.n) - Number(b.n));
				fm.seasons = known;

				// A finished show that gains a season has to leave `completed`,
				// or `inProgress()` filters it out and it never returns to Up
				// Next — the exact case the new-episode check exists to catch.
				this.settleShowStatus(fm, known);
			});
		} else {
			const meta = await this.plugin.tmdb.getFilm(entry.tmdbId);
			const poster = await this.plugin.posters.cache(meta.id, "film", meta.poster_path);
			await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
				if (meta.runtime) fm.runtime = meta.runtime;
				fm.genres = (meta.genres ?? []).map((g) => g.name);
				if (meta.vote_average) fm.tmdb_rating = round1(meta.vote_average);
				const directors = (meta.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name);
				if (directors.length) fm.director = directors;
				if (poster && !fm.poster) fm.poster = poster;
			});
		}
	}

	/* ------------------------------------------------------------------ */
	/* Helpers                                                             */
	/* ------------------------------------------------------------------ */

	filmBasename(title: string, year?: number): string {
		return sanitize(year ? `${title} (${year})` : title);
	}

	private async createNote(path: string): Promise<TFile> {
		await this.ensureFolder(path.substring(0, path.lastIndexOf("/")));
		const body = this.plugin.settings.noteTemplate ?? "";
		try {
			return await this.plugin.app.vault.create(path, body);
		} catch (e) {
			const existing = this.plugin.app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) return existing;
			throw new Error(redact(e));
		}
	}

	private async ensureFolder(folder: string): Promise<void> {
		if (!folder) return;
		const vault = this.plugin.app.vault;
		const parts = normalizePath(folder).split("/").filter(Boolean);
		let cur = "";
		for (const part of parts) {
			cur = cur ? `${cur}/${part}` : part;
			const existing = vault.getAbstractFileByPath(cur);
			if (existing instanceof TFolder) continue;
			if (existing) throw new Error(`Reel: "${cur}" exists but is not a folder.`);
			try {
				await vault.createFolder(cur);
			} catch {
				/* raced with another create */
			}
		}
	}

	private async uniquePath(folder: string, basename: string): Promise<string> {
		const dir = normalizePath(folder);
		let candidate = normalizePath(`${dir}/${basename}.md`);
		let n = 2;
		while (this.plugin.app.vault.getAbstractFileByPath(candidate)) {
			candidate = normalizePath(`${dir}/${basename} ${n}.md`);
			n++;
		}
		return candidate;
	}
}

/** Strip characters no filesystem — Windows included — will accept. */
function sanitize(name: string): string {
	return (
		name
			.replace(/[\\/:*?"<>|#^[\]]/g, "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 120) || "Untitled"
	);
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

export { sanitize, normaliseDate };
