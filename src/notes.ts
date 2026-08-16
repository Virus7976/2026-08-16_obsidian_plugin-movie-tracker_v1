/**
 * Note creation and mutation.
 *
 * Two write paths, with different guarantees:
 *
 *   Frontmatter — always via `processFrontMatter`, which reparses the YAML and
 *   reserialises only that block. The body is untouchable from here.
 *
 *   Reviews — via `vault.append`, which can only add to the end of the file.
 *   Not `modify`, which takes whole-file content and could therefore replace
 *   your writing if anything upstream were ever wrong. Append cannot, by
 *   construction, destroy an existing review.
 */

import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type ReelPlugin from "./main";
import { clampRating, starString } from "./util/ratings";
import { addToRange, contiguousProgress, rangeCount } from "./util/ranges";
import { nextShowStatus } from "./util/status";
import { normaliseDate, prettyDate, todayISO, yearOf } from "./util/dates";
import type { Entry, SeasonProgress, TmdbFilm, TmdbShow, WatchEvent } from "./types";
import { applyFields, filmFields, showFields, ExtractOptions } from "./extract";
import { applyDerived, derive } from "./bases";
import { topicHolds } from "./enrich";
import { redact } from "./secrets";

export interface LogPayload {
	date: string;
	rating?: number;
	liked?: boolean;
	watchlist?: boolean;
	rewatch?: boolean;
	review?: string;
}

export class NoteWriter {
	constructor(private plugin: ReelPlugin) {}

	private get extractOpts(): ExtractOptions {
		const s = this.plugin.settings;
		return {
			linkPeople: s.linkPeople,
			peopleFolder: s.peopleFolder,
			castLimit: s.castLimit,
			region: s.region,
		};
	}

	/* ------------------------------------------------------------------ */
	/* Creation                                                            */
	/* ------------------------------------------------------------------ */

	async createFilm(meta: TmdbFilm, log: LogPayload): Promise<TFile> {
		const year = yearOf(meta.release_date);
		const path = await this.uniquePath(this.plugin.settings.filmFolder, this.filmBasename(meta.title, year));
		const poster = await this.plugin.posters.cache(meta.id, "film", meta.poster_path);

		const file = await this.createNote(path);
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			fm.tmdb_id = meta.id;
			fm.type = "film";
			fm.title = meta.title;
			if (year) fm.year = year;
			applyFields(fm, filmFields(meta, this.extractOpts));
			if (poster) fm.poster = poster;

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
			this.refreshDerived(fm);
		});

		if (log.review?.trim()) await this.appendReview(file, log.date, log.rating, log.review);
		await this.linkFromDailyNote(file);
		// Enrichment runs after the note exists, so a slow or missing
		// third-party service delays extra fields rather than the note itself.
		void this.enrich(file, { title: meta.title, year, imdbId: str(meta.external_ids?.imdb_id ?? meta.imdb_id) });
		return file;
	}

	async createShow(meta: TmdbShow, log: LogPayload): Promise<TFile> {
		const path = await this.uniquePath(this.plugin.settings.seriesFolder, sanitize(meta.name));
		const poster = await this.plugin.posters.cache(meta.id, "tv", meta.poster_path);

		const seasons = (meta.seasons ?? []).filter((s) => this.plugin.settings.includeSpecials || s.season_number > 0);

		const file = await this.createNote(path);
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			fm.tmdb_id = meta.id;
			fm.type = "tv";
			fm.title = meta.name;
			const fay = yearOf(meta.first_air_date);
			if (fay) fm.first_air_year = fay;
			applyFields(fm, showFields(meta, this.extractOpts));
			if (poster) fm.poster = poster;
			fm.status = log.watchlist ? "watchlist" : "watching";
			fm.seasons = seasons.map((s) => ({ n: s.season_number, watched: "", total: s.episode_count ?? 0 }));
			if (log.liked) fm.liked = true;
			if (log.rating != null) fm.rating = clampRating(log.rating);
			this.refreshDerived(fm);
		});

		if (log.review?.trim()) await this.appendReview(file, log.date, log.rating, log.review);
		await this.linkFromDailyNote(file);
		void this.enrich(file, {
			title: meta.name,
			year: yearOf(meta.first_air_date),
			imdbId: str(meta.external_ids?.imdb_id),
		});
		return file;
	}

	/* ------------------------------------------------------------------ */
	/* Reviews                                                             */
	/* ------------------------------------------------------------------ */

	/**
	 * Append a dated review to the note body.
	 *
	 * One heading per viewing, so a rewatch adds a second review rather than
	 * overwriting the first — which is the whole reason the watch history is an
	 * array. Uses `append`, so no code path here can remove text.
	 */
	async appendReview(file: TFile, date: string, rating: number | undefined, text: string): Promise<void> {
		const body = text.trim();
		if (!body) return;
		const stars = rating != null ? ` · ${starString(rating)}` : "";
		const block = `\n\n## ${prettyDate(date) || date}${stars}\n\n${body}\n`;
		await this.plugin.app.vault.append(file, block);
	}

	/* ------------------------------------------------------------------ */
	/* Mutation — films                                                    */
	/* ------------------------------------------------------------------ */

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
			const lastRated = [...history].reverse().find((h) => h && typeof h === "object" && h.rating != null);
			if (lastRated?.rating != null) fm.rating = lastRated.rating;
			if (log.liked === true) fm.liked = true;
			else if (log.liked === false) delete fm.liked;
			this.refreshDerived(fm);
		});

		if (log.review?.trim()) await this.appendReview(file, log.date, log.rating, log.review);
		await this.linkFromDailyNote(file);
	}

	/* ------------------------------------------------------------------ */
	/* Mutation — series                                                   */
	/* ------------------------------------------------------------------ */

	async markEpisode(file: TFile, season: number, episode: number, date = todayISO()): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const seasons = this.seasonRows(fm);
			const row = this.seasonRow(seasons, season);
			row.watched = addToRange(row.watched, episode);
			fm.seasons = seasons;
			fm.last_watched = { season, episode, date };
			if (fm.status === "watchlist" || fm.status === "paused" || !fm.status) fm.status = "watching";
			this.settleShowStatus(fm, seasons);
			this.refreshDerived(fm);
		});
	}

	async setSeasonRange(file: TFile, season: number, range: string, date = todayISO()): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const seasons = this.seasonRows(fm);
			const row = this.seasonRow(seasons, season);
			row.watched = range;
			fm.seasons = seasons;
			const furthest = contiguousProgress(range);
			if (furthest > 0) fm.last_watched = { season, episode: furthest, date };
			if (rangeCount(range) > 0 && (fm.status === "watchlist" || !fm.status)) fm.status = "watching";
			this.settleShowStatus(fm, seasons);
			this.refreshDerived(fm);
		});
	}

	/**
	 * Rate one episode. Rating implies watching it — nobody rates an episode
	 * they haven't seen, and making them tick it separately is a second tap for
	 * no information.
	 */
	async rateEpisode(file: TFile, season: number, episode: number, rating: number | null): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const seasons = this.seasonRows(fm);
			const row = this.seasonRow(seasons, season);
			const ratings: Record<string, number> = { ...(row.episode_ratings ?? {}) };

			if (rating == null) {
				delete ratings[String(episode)];
			} else {
				ratings[String(episode)] = clampRating(rating);
				row.watched = addToRange(row.watched, episode);
				fm.last_watched = { season, episode, date: todayISO() };
				if (fm.status === "watchlist" || !fm.status) fm.status = "watching";
			}

			if (Object.keys(ratings).length) row.episode_ratings = ratings;
			else delete row.episode_ratings;

			fm.seasons = seasons;
			this.settleShowStatus(fm, seasons);
			this.refreshDerived(fm);
		});
	}

	async setSeasonRating(file: TFile, season: number, rating: number | null): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const seasons = this.seasonRows(fm);
			const row = this.seasonRow(seasons, season);
			if (rating == null) delete row.rating;
			else row.rating = clampRating(rating);
			fm.seasons = seasons;
		});
	}

	/**
	 * Record a completed run of a series and reset progress for a rewatch.
	 * Films have had this since day one via `watched[]`; shows had no way to
	 * say "I've seen all of this twice", which was an odd asymmetry.
	 */
	async restartSeries(file: TFile, rating?: number): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const seasons = this.seasonRows(fm);
			const runs: WatchEvent[] = Array.isArray(fm.watched) ? [...fm.watched] : [];
			runs.push({
				date: todayISO(),
				rewatch: runs.length > 0,
				...(rating != null ? { rating: clampRating(rating) } : {}),
			});
			fm.watched = runs;
			for (const s of seasons) {
				s.watched = "";
				delete s.episode_ratings;
			}
			fm.seasons = seasons;
			delete fm.last_watched;
			fm.status = "watching";
			this.refreshDerived(fm);
		});
	}

	/**
	 * Recompute the flattened Bases properties from whatever the frontmatter
	 * now says. Called at the end of every mutation that could move them —
	 * the single place they're kept in step with the real data.
	 */
	private refreshDerived(fm: Record<string, unknown>): void {
		applyDerived(
			fm,
			derive({
				type: String(fm.type ?? "film"),
				seasons: (Array.isArray(fm.seasons) ? fm.seasons : []) as { watched?: string; total?: number }[],
				watched: (Array.isArray(fm.watched) ? fm.watched : []) as { date?: unknown }[],
				totalEpisodes: Number(fm.total_episodes ?? 0) || undefined,
				lastWatched: (fm.last_watched ?? null) as { season?: number; episode?: number; date?: unknown } | null,
				year: Number(fm.year ?? 0) || undefined,
				firstAirYear: Number(fm.first_air_year ?? 0) || undefined,
				poster: fm.poster ? String(fm.poster) : undefined,
			})
		);
	}

	/**
	 * Fetch OMDb scores and DoesTheDogDie topics, then merge them in.
	 *
	 * Optional and failure-tolerant by design: a missing key, a service outage
	 * or a title neither database knows leaves the note exactly as TMDB
	 * described it. Enrichment must never be able to fail note creation.
	 */
	async enrich(file: TFile, opts: { title: string; year?: number; imdbId?: string }): Promise<void> {
		const jobs: Promise<void>[] = [];
		const patch: Record<string, unknown> = {};

		if (opts.imdbId && this.plugin.credentials.has("omdb")) {
			jobs.push(
				this.plugin.omdb.fetchScores(opts.imdbId).then((scores) => {
					if (!scores) return;
					if (scores.imdbRating != null) patch.imdb_rating = scores.imdbRating;
					if (scores.metacritic != null) patch.metacritic = scores.metacritic;
					if (scores.rottenTomatoes != null) patch.rotten_tomatoes = scores.rottenTomatoes;
					if (scores.rated && !patch.certification) patch.certification_omdb = scores.rated;
				})
			);
		}

		let topics: string[] = [];
		let dtddFlags: string[] = [];
		if (this.plugin.credentials.has("dtdd")) {
			jobs.push(
				this.plugin.dtdd.fetchByTitle(opts.title, opts.year).then((result) => {
					if (!result) return;
					dtddFlags = result.flags;
					topics = result.topics.filter(topicHolds).map((t) => t.name).sort();
				})
			);
		}

		await Promise.all(jobs);
		if (!Object.keys(patch).length && !topics.length && !dtddFlags.length) return;

		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			Object.assign(fm, patch);
			if (topics.length) fm.content_topics = topics;
			if (dtddFlags.length) {
				// Union with what TMDB keywords implied and with anything you
				// added by hand. DTDD is better evidence, but it is not the
				// only evidence, and it must not erase your own edits.
				const existing: string[] = Array.isArray(fm.content_flags) ? fm.content_flags.map(String) : [];
				fm.content_flags = [...new Set([...existing, ...dtddFlags])].sort();
			}
			this.refreshDerived(fm);
		});
	}

	private seasonRows(fm: Record<string, unknown>): SeasonProgress[] {
		return Array.isArray(fm.seasons) ? [...(fm.seasons as SeasonProgress[])] : [];
	}

	private seasonRow(seasons: SeasonProgress[], n: number): SeasonProgress {
		let row = seasons.find((s) => Number(s.n) === n);
		if (!row) {
			row = { n, watched: "" };
			seasons.push(row);
			seasons.sort((a, b) => Number(a.n) - Number(b.n));
		}
		return row;
	}

	private settleShowStatus(fm: Record<string, unknown>, seasons: SeasonProgress[]): void {
		const watched = seasons.reduce((sum, s) => sum + rangeCount(s.watched), 0);
		const next = nextShowStatus(String(fm.status ?? ""), watched, Number(fm.total_episodes ?? 0));
		if (next) fm.status = next;
	}

	/* ------------------------------------------------------------------ */
	/* Shared mutation                                                     */
	/* ------------------------------------------------------------------ */

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

	/* ------------------------------------------------------------------ */
	/* Lists                                                               */
	/* ------------------------------------------------------------------ */

	async setLists(file: TFile, lists: string[]): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const clean = [...new Set(lists.map((l) => l.trim()).filter(Boolean))].sort();
			if (clean.length) fm.lists = clean;
			else delete fm.lists;
		});
	}

	async addToList(file: TFile, list: string): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const existing = Array.isArray(fm.lists) ? fm.lists.map(String) : [];
			fm.lists = [...new Set([...existing, list.trim()])].filter(Boolean).sort();
		});
	}

	async removeFromList(file: TFile, list: string): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const existing: string[] = Array.isArray(fm.lists) ? fm.lists.map(String) : [];
			const next = existing.filter((l: string) => l !== list);
			if (next.length) fm.lists = next;
			else delete fm.lists;
		});
	}

	/** Add or remove a content flag by hand, overriding what TMDB implied. */
	async toggleContentFlag(file: TFile, flag: string): Promise<boolean> {
		let on = false;
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const existing: string[] = Array.isArray(fm.content_flags) ? fm.content_flags.map(String) : [];
			on = !existing.includes(flag);
			const next = on ? [...existing, flag] : existing.filter((f: string) => f !== flag);
			if (next.length) fm.content_flags = [...new Set(next)].sort();
			else delete fm.content_flags;
		});
		return on;
	}

	/* ------------------------------------------------------------------ */
	/* Refresh                                                             */
	/* ------------------------------------------------------------------ */

	async refreshMetadata(entry: Entry): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
		if (!(file instanceof TFile)) return;

		// Never let a refresh overwrite what you decided.
		const preserve = ["status", "rating", "liked", "watched", "lists"];

		if (entry.type === "tv") {
			const meta = await this.plugin.tmdb.refreshShow(entry.tmdbId);
			const poster = await this.plugin.posters.cache(meta.id, "tv", meta.poster_path);
			await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
				applyFields(fm, showFields(meta, this.extractOpts), { preserve });
				if (!meta.next_episode_to_air?.air_date) delete fm.next_air_date;
				if (poster && !fm.poster) fm.poster = poster;

				const known = this.seasonRows(fm);
				for (const s of meta.seasons ?? []) {
					if (!this.plugin.settings.includeSpecials && s.season_number <= 0) continue;
					const row = known.find((k) => Number(k.n) === s.season_number);
					if (row) row.total = s.episode_count ?? 0;
					else known.push({ n: s.season_number, watched: "", total: s.episode_count ?? 0 });
				}
				known.sort((a, b) => Number(a.n) - Number(b.n));
				fm.seasons = known;
				this.settleShowStatus(fm, known);
				this.refreshDerived(fm);
			});
		} else {
			const meta = await this.plugin.tmdb.getFilm(entry.tmdbId);
			const poster = await this.plugin.posters.cache(meta.id, "film", meta.poster_path);
			await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
				applyFields(fm, filmFields(meta, this.extractOpts), { preserve });
				if (poster && !fm.poster) fm.poster = poster;
				this.refreshDerived(fm);
			});
		}
	}

	/* ------------------------------------------------------------------ */
	/* Daily note                                                          */
	/* ------------------------------------------------------------------ */

	/**
	 * Append a link to today's daily note, if one exists.
	 *
	 * Deliberately does not *create* the daily note: a tracker inventing files
	 * in someone's journal folder is exactly the kind of spread the folder
	 * settings exist to prevent. No daily note today means nothing happens.
	 */
	private async linkFromDailyNote(file: TFile): Promise<void> {
		if (!this.plugin.settings.linkFromDailyNote) return;
		try {
			const path = this.dailyNotePath();
			if (!path) return;
			const daily = this.plugin.app.vault.getAbstractFileByPath(path);
			if (!(daily instanceof TFile)) return;

			const link = this.plugin.app.fileManager.generateMarkdownLink(file, daily.path);
			const existing = await this.plugin.app.vault.cachedRead(daily);
			if (existing.includes(file.basename)) return; // already mentioned today

			const prefix = this.plugin.settings.dailyNotePrefix || "- Watched";
			await this.plugin.app.vault.append(daily, `\n${prefix} ${link}`);
		} catch (e) {
			console.warn("Reel: daily note link skipped —", redact(e));
		}
	}

	/**
	 * Today's daily note, from Reel's own setting.
	 *
	 * An earlier version read the core Daily Notes plugin's configuration
	 * through `app.internalPlugins`. That is undocumented API: it can change
	 * without notice, and reaching into another plugin's internals is the kind
	 * of thing a reviewer is right to flag. A folder setting is one field the
	 * user fills in once, and it cannot break.
	 *
	 * Only `YYYY-MM-DD` filenames are supported. Matching arbitrary date
	 * formats would mean a date-parsing library for a convenience feature.
	 */
	private dailyNotePath(): string | null {
		const folder = (this.plugin.settings.dailyNoteFolder ?? "").replace(/^\/+|\/+$/g, "");
		const name = todayISO();
		return normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
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

	async ensureFolder(folder: string): Promise<void> {
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

/** Nullable-to-undefined, since TMDB returns `null` for a missing imdb_id. */
function str(value: unknown): string | undefined {
	if (value == null) return undefined;
	const s = String(value).trim();
	return s || undefined;
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

export { sanitize, normaliseDate };
