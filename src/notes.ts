/**
 * Note creation and mutation.
 *
 * Two write paths, with different guarantees:
 *
 *   Frontmatter â€” always via `processFrontMatter`, which reparses the YAML and
 *   reserialises only that block. The body is untouchable from here.
 *
 *   Reviews â€” via `vault.append`, which can only add to the end of the file.
 *   Not `modify`, which takes whole-file content and could therefore replace
 *   your writing if anything upstream were ever wrong. Append cannot, by
 *   construction, destroy an existing review.
 */

import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type ReelPlugin from "./main";
import { clampRating, starString } from "./util/ratings";
import { addToRange, contiguousProgress, rangeCount } from "./util/ranges";
import { nextShowStatus } from "./util/status";
import { appendWatch, latestRating, mergeSeasons, rateEpisode as computeEpisodeRating } from "./util/mutations";
import { normaliseDate, prettyDate, todayISO, yearOf } from "./util/dates";
import type { Entry, SeasonProgress, TmdbFilm, TmdbShow, WatchEvent } from "./types";
import { applyFields, filmFields, showFields, ExtractOptions } from "./extract";
import { applyDerived, derive } from "./bases";
import { topicHolds } from "./enrich";
import { redact } from "./secrets";
import { cloneFrontmatter, unchanged, type Snapshot } from "./util/undo";

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
		this.plugin.undo.recordCreation(file, `adding ${meta.title}`);
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
		this.plugin.undo.recordCreation(file, `adding ${meta.name}`);
		void this.enrich(file, {
			title: meta.name,
			year: yearOf(meta.first_air_date),
			imdbId: str(meta.external_ids?.imdb_id),
		});
		return file;
	}

	/**
	 * Create a note from a search or discovery result.
	 *
	 * Four call sites were each doing this dance â€” fetch the right detail
	 * endpoint, branch on media type, build the payload â€” which is four places
	 * to forget something like the review or the rating.
	 */
	async createFromResult(
		item: { id: number; media_type?: string },
		log: LogPayload
	): Promise<TFile> {
		const type = item.media_type === "tv" ? "tv" : "film";

		// Never two notes for one title.
		//
		// Nothing checked this before: every route into here created a note,
		// and uniquePath politely named the second one "The Odyssey 2". You
		// end up with a split history â€” half your viewings on one note, half
		// on the other â€” and no indication anything went wrong.
		const existing = this.plugin.library.byTmdbId(item.id, type);
		if (existing) {
			const file = this.plugin.app.vault.getAbstractFileByPath(existing.path);
			if (file instanceof TFile) {
				// Not a silent no-op: you asked to log something, so log it
				// onto the note that already exists.
				await this.applyToExisting(file, existing, log);
				return file;
			}
		}

		// The index updates only after metadataCache reparses, so two taps in
		// quick succession both miss the check above. This closes that window.
		const key = `${type}-${item.id}`;
		const pending = this.creating.get(key);
		if (pending) return pending;

		const job = (async () => {
			if (type === "tv") {
				const meta = await this.plugin.tmdb.getShow(item.id);
				return this.createShow(meta, log);
			}
			const meta = await this.plugin.tmdb.getFilm(item.id);
			return this.createFilm(meta, log);
		})().finally(() => this.creating.delete(key));

		this.creating.set(key, job);
		return job;
	}

	/**
	 * Fold a log payload into a note that already exists.
	 *
	 * Reached when you add something already in your library â€” from Discover,
	 * from search, from a shared link. Adding a viewing is the useful reading
	 * of that action; creating a second note never is.
	 */
	private async applyToExisting(file: TFile, entry: Entry, log: LogPayload): Promise<void> {
		if (log.watchlist) {
			new Notice(`Reel: ${entry.title} is already in your library.`);
			return;
		}
		if (entry.type === "tv") {
			await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
				if (fm.status === "watchlist") fm.status = "watching";
				if (log.rating != null) fm.rating = log.rating;
				if (log.liked) fm.liked = true;
			});
		} else {
			await this.logFilm(file, log);
		}
		if (log.review?.trim()) await this.appendReview(file, log.date, log.rating, log.review);
		this.plugin.undo.offer(`Added a viewing to ${entry.title}`);
	}

	/* ------------------------------------------------------------------ */
	/* Reviews                                                             */
	/* ------------------------------------------------------------------ */

	/**
	 * Append a dated review to the note body.
	 *
	 * One heading per viewing, so a rewatch adds a second review rather than
	 * overwriting the first â€” which is the whole reason the watch history is an
	 * array. Uses `append`, so no code path here can remove text.
	 */
	async appendReview(file: TFile, date: string, rating: number | undefined, text: string): Promise<void> {
		const body = text.trim();
		if (!body) return;
		const stars = rating != null ? ` Â· ${starString(rating)}` : "";
		const block = `\n\n## ${prettyDate(date) || date}${stars}\n\n${body}\n`;
		await this.plugin.app.vault.append(file, block);
	}

	/* ------------------------------------------------------------------ */
	/* Undoable frontmatter edits                                          */
	/* ------------------------------------------------------------------ */

	/**
	 * Make a frontmatter change that can be taken back.
	 *
	 * The snapshot is taken *inside* the same callback that makes the change,
	 * which is the only place the pre-state is knowable for certain: the
	 * metadata cache lags writes, so reading it here would sometimes hand back
	 * the result of the previous edit and undo would jump two steps.
	 *
	 * A mutation that changed nothing records nothing. Otherwise tapping the
	 * star you had already set would push a no-op onto the stack, and the undo
	 * you actually wanted would be one press further down than it looks.
	 */
	async edit(file: TFile, label: string, mutate: (fm: Record<string, unknown>) => void): Promise<void> {
		let before: Snapshot | undefined;
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const snapshot = cloneFrontmatter(fm) as Snapshot;
			mutate(fm);
			if (!unchanged(fm, snapshot)) before = snapshot;
		});
		if (before) this.plugin.undo.record(file, label, before);
	}

	/* ------------------------------------------------------------------ */
	/* Mutation â€” films                                                    */
	/* ------------------------------------------------------------------ */

	async logFilm(file: TFile, log: LogPayload): Promise<void> {
		await this.edit(file, `the change to ${file.basename}`, (fm) => {
			if (log.watchlist) {
				fm.status = "watchlist";
				if (log.liked != null) fm.liked = log.liked;
				return;
			}

			const history = appendWatch(fm.watched, {
				date: log.date || todayISO(),
				rating: log.rating,
				rewatch: log.rewatch,
			});

			fm.watched = history;
			fm.status = "watched";
			// `rating` mirrors the newest viewing that carried one, so the grid
			// and stats can read a single field.
			const newest = latestRating(history);
			if (newest != null) fm.rating = newest;
			if (log.liked === true) fm.liked = true;
			else if (log.liked === false) delete fm.liked;
			this.refreshDerived(fm);
		});

		if (log.review?.trim()) await this.appendReview(file, log.date, log.rating, log.review);
		await this.linkFromDailyNote(file);
	}

	/* ------------------------------------------------------------------ */
	/* Mutation â€” series                                                   */
	/* ------------------------------------------------------------------ */

	async markEpisode(file: TFile, season: number, episode: number, date = todayISO()): Promise<void> {
		await this.edit(file, `marking S${season}E${episode} watched`, (fm) => {
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
		await this.edit(file, `the change to season ${season}`, (fm) => {
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
	 * Rate one episode. Rating implies watching it â€” nobody rates an episode
	 * they haven't seen, and making them tick it separately is a second tap for
	 * no information.
	 */
	async rateEpisode(file: TFile, season: number, episode: number, rating: number | null): Promise<void> {
		const what = rating == null ? `clearing the S${season}E${episode} rating` : `rating S${season}E${episode}`;
		await this.edit(file, what, (fm) => {
			const { seasons, average } = computeEpisodeRating(this.seasonRows(fm), season, episode, rating);
			fm.seasons = seasons;

			if (rating != null) {
				fm.last_watched = { season, episode, date: todayISO() };
				if (fm.status === "watchlist" || !fm.status) fm.status = "watching";
			}

			if (average != null) {
				fm.episode_rating_avg = average;
				// Only fill the series rating when you haven't set one, or when
				// the existing value was itself derived. A rating you chose by
				// hand must not be overwritten by ticking through episodes.
				const previous = Number(fm.episode_rating_avg_applied ?? NaN);
				if (fm.rating == null || Number(fm.rating) === previous) {
					fm.rating = clampRating(average);
					fm.episode_rating_avg_applied = clampRating(average);
				}
			} else {
				delete fm.episode_rating_avg;
				delete fm.episode_rating_avg_applied;
			}

			this.settleShowStatus(fm, seasons);
			this.refreshDerived(fm);
		});
	}

	async setSeasonRating(file: TFile, season: number, rating: number | null): Promise<void> {
		await this.edit(file, `the season ${season} rating`, (fm) => {
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
		// The one mutation that discards a lot at once â€” every ticked episode
		// and every episode rating across the whole series. It is the action
		// most worth being able to take back.
		await this.edit(file, `restarting ${file.basename}`, (fm) => {
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
	 * now says. Called at the end of every mutation that could move them â€”
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
	/**
	 * Serialised so a burst of adds doesn't fire a burst of requests.
	 *
	 * Adding six titles from Discover in ten seconds used to start six
	 * enrichments at once, against two free-tier APIs. They now queue behind
	 * each other, which costs nothing noticeable â€” enrichment is already
	 * background work that no screen waits on.
	 */
	private enrichQueue: Promise<unknown> = Promise.resolve();
	/** In-flight creations, keyed type-id, so a double tap cannot make two notes. */
	private creating = new Map<string, Promise<TFile>>();
	private enrichDepth = 0;

	async enrich(file: TFile, opts: { title: string; year?: number; imdbId?: string }): Promise<void> {
		// Reset the chain when it drains, so a long session doesn't hold a
		// promise link per title ever added.
		this.enrichDepth++;
		this.enrichQueue = this.enrichQueue
			.then(() => this.enrichNow(file, opts))
			.finally(() => {
				if (--this.enrichDepth === 0) this.enrichQueue = Promise.resolve();
			})
			// The queue must survive a failure, but swallowing it entirely
			// meant a broken key looked like a service with no data.
			.catch((e: unknown) => {
				console.warn("Reel: enrichment failed for", opts.title, redact(e));
			});
		return this.enrichQueue as Promise<void>;
	}

	private async enrichNow(file: TFile, opts: { title: string; year?: number; imdbId?: string }): Promise<void> {
		const jobs: Promise<void>[] = [];
		const patch: Record<string, unknown> = {};

		if (opts.imdbId && this.plugin.credentials.has("omdb")) {
			jobs.push(
				this.plugin.omdb.fetchScores(opts.imdbId).then((scores) => {
					if (!scores) return;
					if (scores.imdbRating != null) patch.imdb_rating = scores.imdbRating;
					// Fetched since the beginning and thrown away. A 7.9 from
					// 1.2M voters and a 7.9 from 400 are not the same claim,
					// and the count is the only thing that separates them.
					if (scores.imdbVotes != null) patch.imdb_votes = scores.imdbVotes;
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
		await this.edit(file, `setting ${file.basename} to ${status}`, (fm) => {
			fm.status = status;
			// Marking a film watched has to record *that you watched it*, not
			// merely relabel it. The Diary, the streak, hours-watched and every
			// per-year chart read the `watched` array, so a note saying
			// "status: watched" with an empty history is invisible to all of
			// them â€” it reads as a film nobody has ever seen.
			if (fm.type !== "tv" && status === "watched") this.ensureViewing(fm);
			this.refreshDerived(fm);
		});
	}

	/**
	 * Guarantee at least one viewing on a film that claims to have been seen.
	 *
	 * Dated today, because today is when you said so and a guessed date would
	 * be worse than an honest one. Only ever adds â€” an existing history is
	 * never touched.
	 */
	private ensureViewing(fm: Record<string, unknown>): void {
		const history = Array.isArray(fm.watched) ? fm.watched : [];
		if (history.length) return;
		const event: WatchEvent = { date: todayISO(), rewatch: false };
		const rating = Number(fm.rating);
		if (fm.rating != null && Number.isFinite(rating)) event.rating = clampRating(rating);
		fm.watched = [event];
	}

	async setRating(file: TFile, rating: number | null): Promise<void> {
		const what = rating == null ? `clearing the rating on ${file.basename}` : `rating ${file.basename}`;
		await this.edit(file, what, (fm) => {
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
			} else if (fm.type !== "tv" && fm.status !== "watchlist") {
				// Rating a film you have no recorded viewing of. You cannot
				// have rated something you never saw, so the rating is the
				// evidence â€” record the viewing rather than leaving a score
				// floating above an empty history that the Diary and every
				// stat will ignore.
				fm.status = "watched";
				this.ensureViewing(fm);
			}
			this.refreshDerived(fm);
		});
	}

	/**
	 * "I'd watch that again" — a judgement a star rating does not capture.
	 *
	 * A four-star film you will never revisit and a three-star one you put on
	 * every winter are different facts, and only the number was recordable.
	 * Kept as its own flag rather than inferred from the rating, because the
	 * whole point is that it disagrees with the rating sometimes.
	 */
	async toggleRewatch(file: TFile): Promise<boolean> {
		let on = false;
		await this.edit(file, `the rewatch mark on ${file.basename}`, (fm) => {
			on = !fm.would_rewatch;
			if (on) fm.would_rewatch = true;
			else delete fm.would_rewatch;
		});
		return on;
	}

	async toggleLiked(file: TFile): Promise<boolean> {
		let next = false;
		await this.edit(file, `the like on ${file.basename}`, (fm) => {
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
		await this.edit(file, `the list change on ${file.basename}`, (fm) => {
			const clean = [...new Set(lists.map((l) => l.trim()).filter(Boolean))].sort();
			if (clean.length) fm.lists = clean;
			else delete fm.lists;
		});
	}

	async addToList(file: TFile, list: string): Promise<void> {
		await this.edit(file, `adding ${file.basename} to ${list}`, (fm) => {
			const existing = Array.isArray(fm.lists) ? fm.lists.map(String) : [];
			fm.lists = [...new Set([...existing, list.trim()])].filter(Boolean).sort();
		});
	}

	async removeFromList(file: TFile, list: string): Promise<void> {
		await this.edit(file, `removing ${file.basename} from ${list}`, (fm) => {
			const existing: string[] = Array.isArray(fm.lists) ? fm.lists.map(String) : [];
			const next = existing.filter((l: string) => l !== list);
			if (next.length) fm.lists = next;
			else delete fm.lists;
		});
	}

	/** Add or remove a content flag by hand, overriding what TMDB implied. */
	async toggleContentFlag(file: TFile, flag: string): Promise<boolean> {
		let on = false;
		await this.edit(file, `the "${flag}" flag on ${file.basename}`, (fm) => {
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

				const known = mergeSeasons(
					this.seasonRows(fm),
					meta.seasons ?? [],
					this.plugin.settings.includeSpecials
				);
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
			console.warn("Reel: daily note link skipped â€”", redact(e));
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

/** Strip characters no filesystem â€” Windows included â€” will accept. */
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
