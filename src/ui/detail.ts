/**
 * The detail screen.
 *
 * Everything the note header card offered, moved somewhere you'll actually see
 * it — the card is a markdown post-processor, so it only renders in Reading
 * view, and in Live Preview it simply isn't there.
 *
 * Layout is a hero followed by two columns: your own data and the metadata on
 * the left, seasons or watch history on the right. On a phone they stack. The
 * page is width-capped, because a single column of content on a 2000px monitor
 * strands the text in a ribbon on the left and stretches four buttons to 460px
 * each.
 *
 * Every control writes immediately and confirms visibly. "Did that register?"
 * is the worst question a tracker can leave you asking.
 */

import { Notice, TFile, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry, TmdbEpisode } from "../types";
import { redact } from "../secrets";
import { formatMinutes, prettyDate } from "../util/dates";
import { formatRange, parseRange, rangeCount } from "../util/ranges";
import { renderStars } from "./stars";
import { LogSheet } from "./logSheet";
import { ListPicker } from "./listPicker";
import { imdbUrl, tmdbUrl } from "../extract";
import { unlink } from "../library";
import { ContentFlag, FLAG_LABELS } from "../content";

const FILM_STATUSES = ["watched", "watchlist", "abandoned"];
const TV_STATUSES = ["watching", "completed", "watchlist", "paused", "dropped"];

/**
 * Brief flash, so a silent write still reads as "that worked".
 *
 * A colour change says nothing to a screen reader, so the control is also
 * marked as a live region for the moment it changes — otherwise the whole
 * confirmation is invisible to anyone not looking at it.
 */
function flash(el: HTMLElement): void {
	el.addClass("reel-flash");
	el.setAttr("aria-live", "polite");
	window.setTimeout(() => {
		el.removeClass("reel-flash");
		el.removeAttribute("aria-live");
	}, 600);
}

export class DetailScreen {
	private openSeason: number | null = null;
	private episodeCache = new Map<number, TmdbEpisode[]>();
	private rootEl: HTMLElement | null = null;

	constructor(
		private plugin: ReelPlugin,
		private entry: Entry,
		private onBack: () => void
	) {}

	private get file(): TFile | null {
		const f = this.plugin.app.vault.getAbstractFileByPath(this.entry.path);
		return f instanceof TFile ? f : null;
	}

	/** Repaint using the current entry, without re-reading the index. */
	private rerender(): void {
		if (this.rootEl) this.render(this.rootEl);
	}

	/**
	 * Adopt the latest indexed version of this entry.
	 *
	 * Called by the view when the library reports a change — which happens
	 * *after* `metadataCache` has reparsed the file. That event is the only
	 * reliable signal that a re-read will return the values we just wrote;
	 * this used to be a 120ms timer, which is a guess that quietly fails on a
	 * slow disk or a large vault.
	 */
	syncFromIndex(): void {
		const latest = this.plugin.library.byPath(this.entry.path);
		if (latest) this.entry = latest;
	}

	/** The path this screen is showing, so the view can tell if it still exists. */
	get path(): string {
		return this.entry.path;
	}

	render(container: HTMLElement): void {
		this.rootEl = container;
		container.empty();
		container.addClass("reel-detail");
		const e = this.entry;
		const isTv = e.type === "tv";

		/* ---- top bar --------------------------------------------------- */
		const bar = container.createDiv({ cls: "reel-detail-bar" });
		const back = bar.createEl("button", { cls: "reel-btn reel-back" });
		setIcon(back.createSpan(), "arrow-left");
		back.createSpan({ text: "Library" });
		back.addEventListener("click", () => this.onBack());

		const openNote = bar.createEl("button", { cls: "reel-btn", text: "Open note" });
		openNote.addEventListener("click", async () => {
			const file = this.file;
			if (file) await this.plugin.app.workspace.getLeaf(false).openFile(file);
		});

		const page = container.createDiv({ cls: "reel-detail-page" });

		/* ---- hero ------------------------------------------------------ */
		const hero = page.createDiv({ cls: "reel-hero" });

		const posterEl = hero.createDiv({ cls: "reel-hero-poster" });
		const src = this.plugin.posters.displayUrl(e);
		if (src) posterEl.createEl("img", { attr: { src, alt: "" } });
		else {
			posterEl.addClass("is-empty");
			posterEl.createSpan({ text: e.title.slice(0, 2) });
		}

		const body = hero.createDiv({ cls: "reel-hero-body" });

		const h = body.createDiv({ cls: "reel-hero-title" });
		h.createSpan({ text: e.title });
		const year = e.year ?? e.firstAirYear;
		if (year) h.createSpan({ cls: "reel-dim", text: ` ${year}` });

		const sub = body.createDiv({ cls: "reel-hero-sub" });
		const people = isTv ? e.creators : e.director;
		if (people.length) sub.createSpan({ text: people.map(unlink).join(", ") });
		if (!isTv && e.runtime) sub.createSpan({ text: formatMinutes(e.runtime) });
		if (isTv) {
			const seen = e.seasons.reduce((n, s) => n + rangeCount(s.watched), 0);
			sub.createSpan({ text: `${seen} of ${e.totalEpisodes ?? "?"} episodes` });
		}
		if (e.certification) sub.createSpan({ cls: "reel-badge cert", text: e.certification });

		const scores = body.createDiv({ cls: "reel-scores" });
		const score = (label: string, value: string, cls: string) => {
			const chip = scores.createDiv({ cls: `reel-score ${cls}` });
			chip.createDiv({ cls: "reel-score-value", text: value });
			chip.createDiv({ cls: "reel-score-label", text: label });
		};
		if (e.rating != null) score("You", String(e.rating), "mine");
		const epAvg = this.episodeAverage();
		if (epAvg != null) score("Episodes", epAvg.toFixed(1), "mine");
		if (e.imdbRating != null) score("IMDb", e.imdbRating.toFixed(1), "imdb");
		if (e.metacritic != null) {
			score("Metacritic", String(e.metacritic), e.metacritic >= 61 ? "meta-good" : e.metacritic >= 40 ? "meta-mixed" : "meta-bad");
		}
		if (e.rottenTomatoes != null) score("Tomatoes", `${e.rottenTomatoes}%`, e.rottenTomatoes >= 60 ? "fresh" : "rotten");
		if (e.tmdbRating != null) score("TMDB", e.tmdbRating.toFixed(1), "");
		if (!scores.childElementCount) scores.remove();

		if (e.genres.length) {
			const g = body.createDiv({ cls: "reel-hero-genres" });
			e.genres.forEach((x) => g.createSpan({ cls: "reel-chip static", text: x }));
		}

		if (e.overview) body.createDiv({ cls: "reel-hero-overview", text: e.overview });

		const links = body.createDiv({ cls: "reel-links" });

		// The trailer was a small text link among two others and was missed
		// entirely. It's the one link anyone actually wants, so it gets button
		// weight and the others stay as links.
		if (e.trailer) {
			const play = links.createEl("a", { cls: "reel-btn mod-cta reel-trailer-btn", href: e.trailer });
			setIcon(play.createSpan(), "play");
			play.createSpan({ text: "Watch trailer" });
			play.setAttr("target", "_blank");
			play.setAttr("rel", "noopener");
		}

		const link = (label: string, url: string, cls: string) => {
			const a = links.createEl("a", { cls: `reel-link ${cls}`, text: label, href: url });
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
		};
		const imdb = imdbUrl(e.imdbId);
		if (imdb) link("IMDb", imdb, "imdb");
		link("TMDB", tmdbUrl(e.tmdbId, e.type), "tmdb");

		/* ---- columns ---------------------------------------------------- */
		const cols = page.createDiv({ cls: "reel-detail-cols" });
		const side = cols.createDiv({ cls: "reel-detail-side" });
		const main = cols.createDiv({ cls: "reel-detail-main" });

		this.renderControls(side);
		this.renderActions(side);
		this.renderMeta(side);

		if (isTv) this.renderSeasons(main);
		else this.renderHistory(main);
	}

	/** Mean of every episode rating across all seasons, or null if none. */
	private episodeAverage(): number | null {
		const values: number[] = [];
		for (const s of this.entry.seasons) {
			for (const v of Object.values(s.episode_ratings ?? {})) {
				if (typeof v === "number") values.push(v);
			}
		}
		if (!values.length) return null;
		return values.reduce((a, b) => a + b, 0) / values.length;
	}

	/* ------------------------------------------------------------------ */

	private renderControls(side: HTMLElement): void {
		const e = this.entry;
		const isTv = e.type === "tv";
		const box = side.createDiv({ cls: "reel-panel" });
		box.createDiv({ cls: "reel-panel-title", text: "Your entry" });

		const ratingBox = box.createDiv({ cls: "reel-control" });
		ratingBox.createDiv({ cls: "reel-field-label", text: "Rating" });
		const starRow = ratingBox.createDiv({ cls: "reel-rating-row" });
		renderStars(starRow, {
			value: e.rating,
			onChange: async (v) => {
				const file = this.file;
				if (!file) return;
				try {
					await this.plugin.notes.setRating(file, v ?? null);
					this.entry = { ...this.entry, rating: v };
					flash(starRow);
					new Notice(v == null ? "Rating cleared" : `Rated ${v}`);
				} catch (err) {
					new Notice(`Reel: ${redact(err)}`);
				}
			},
		});

		const epAvg = this.episodeAverage();
		if (isTv && epAvg != null) {
			ratingBox.createDiv({
				cls: "reel-hint",
				text: `Episode average ${epAvg.toFixed(1)} — set automatically until you rate the series yourself.`,
			});
		}

		const likeBox = box.createDiv({ cls: "reel-control" });
		likeBox.createDiv({ cls: "reel-field-label", text: "Liked" });
		const heart = likeBox.createEl("button", { cls: "reel-heart", text: e.liked ? "♥ Liked" : "♡ Like" });
		heart.toggleClass("is-on", !!e.liked);
		heart.addEventListener("click", async () => {
			const file = this.file;
			if (!file) return;
			const on = await this.plugin.notes.toggleLiked(file);
			this.entry = { ...this.entry, liked: on };
			heart.setText(on ? "♥ Liked" : "♡ Like");
			heart.toggleClass("is-on", on);
			flash(heart);
		});

		// Lists were only reachable through a modal, which is a lot of taps for
		// something you mostly want to glance at and toggle.
		const known = this.plugin.library.lists();
		if (known.length || e.lists.length) {
			const listBox = box.createDiv({ cls: "reel-control" });
			listBox.createDiv({ cls: "reel-field-label", text: "Lists" });
			const listRow = listBox.createDiv({ cls: "reel-status-row" });
			for (const name of [...new Set([...known, ...e.lists])].sort()) {
				const pill = listRow.createEl("button", { cls: "reel-chip", text: name });
				const on = () => this.entry.lists.includes(name);
				pill.toggleClass("is-active", on());
				pill.addEventListener("click", () => {
					void (async () => {
						const file = this.file;
						if (!file) return;
						const next = on()
							? this.entry.lists.filter((l) => l !== name)
							: [...this.entry.lists, name];
						await this.plugin.notes.setLists(file, next);
						this.entry = { ...this.entry, lists: next };
						pill.toggleClass("is-active", on());
						flash(pill);
					})();
				});
			}
		}

		const statusBox = box.createDiv({ cls: "reel-control" });
		statusBox.createDiv({ cls: "reel-field-label", text: "Status" });
		const statusRow = statusBox.createDiv({ cls: "reel-status-row" });
		for (const status of isTv ? TV_STATUSES : FILM_STATUSES) {
			const pill = statusRow.createEl("button", { cls: "reel-chip", text: status });
			pill.toggleClass("is-active", this.entry.status === status);
			pill.addEventListener("click", async () => {
				const file = this.file;
				if (!file) return;
				await this.plugin.notes.setStatus(file, status);
				this.entry = { ...this.entry, status };
				statusRow.findAll(".reel-chip").forEach((c) => c.removeClass("is-active"));
				pill.addClass("is-active");
				flash(pill);
			});
		}
	}

	private renderActions(side: HTMLElement): void {
		const e = this.entry;
		const isTv = e.type === "tv";
		const box = side.createDiv({ cls: "reel-panel" });
		const actions = box.createDiv({ cls: "reel-detail-actions" });
		const act = (label: string, cta: boolean, fn: () => void) => {
			const b = actions.createEl("button", { cls: `reel-btn${cta ? " mod-cta" : ""}`, text: label });
			b.addEventListener("click", fn);
			return b;
		};

		if (!isTv) {
			act(e.watched.length ? "Log another watch" : "Log watch", true, () => {
				const file = this.file;
				if (file) new LogSheet(this.plugin.app, this.plugin, { file, entry: e }).open();
			});
		} else {
			const next = this.plugin.upNext.nextFor(e);
			if (next) {
				act(`Watched S${next.season}E${next.episode}`, true, async () => {
					const file = this.file;
					if (!file) return;
					await this.plugin.notes.markEpisode(file, next.season, next.episode);
					new Notice(`S${next.season}E${next.episode} watched`);
				});
			}
			act("Start a rewatch", false, async () => {
				const file = this.file;
				if (!file) return;
				await this.plugin.notes.restartSeries(file, e.rating);
				new Notice("Progress reset — previous run recorded");
			});
		}

		act("Lists", false, () => {
			const file = this.file;
			if (file) new ListPicker(this.plugin.app, this.plugin, e, file).open();
		});

		act("Refresh", false, async () => {
			try {
				// A refresh can add a season or rename episodes, so the cached
				// episode lists are stale by definition afterwards.
				this.episodeCache.clear();
				await this.plugin.notes.refreshMetadata(e);
				new Notice("Metadata refreshed");
			} catch (err) {
				new Notice(`Reel: ${redact(err)}`);
			}
		});

		// Removing a title meant leaving the plugin and deleting the note by
		// hand. It takes two taps rather than one, and it goes to whatever
		// trash Obsidian is configured to use rather than vanishing: a rating
		// you can't undo is an annoyance, a note you can't recover is not.
		const remove = actions.createEl("button", { cls: "reel-btn reel-btn-danger", text: "Remove" });
		remove.addEventListener("click", () => {
			if (remove.dataset.confirming !== "true") {
				remove.dataset.confirming = "true";
				remove.setText("Delete note?");
				// Reverts on its own, so a stray tap doesn't leave a live
				// delete button sitting there waiting to be hit.
				window.setTimeout(() => {
					if (!remove.isConnected) return;
					remove.dataset.confirming = "false";
					remove.setText("Remove");
				}, 4000);
				return;
			}
			void (async () => {
				const file = this.file;
				if (!file) return;
				try {
					await this.plugin.app.fileManager.trashFile(file);
					new Notice(`${e.title} moved to trash`);
					this.onBack();
				} catch (err) {
					new Notice(`Reel: ${redact(err)}`);
				}
			})();
		});
	}

	/** Cast, streaming and flags as aligned rows rather than run-on lines. */
	private renderMeta(side: HTMLElement): void {
		const e = this.entry;
		const rows: [string, string][] = [];
		if (e.cast.length) {
			// Pair each actor with the part they played, where we have it —
			// "Rainn Wilson as Dwight Schrute" says far more than either alone.
			const names = e.cast.map(unlink);
			const paired = names.map((n, i) => {
				const character = e.characters[i];
				return character ? `${n} as ${character}` : n;
			});
			rows.push(["Cast", paired.join(" · ")]);
		}
		if (e.providers.length) rows.push(["Streaming", e.providers.join(", ")]);
		if (e.collection) rows.push(["Collection", e.collection]);
		if (e.productionCompanies.length) rows.push(["Studio", e.productionCompanies.slice(0, 3).join(", ")]);

		if (e.contentFlags.length) {
			rows.push(["Contains", e.contentFlags.map((f) => FLAG_LABELS[f as ContentFlag] ?? f).join(", ")]);
		}
		if (!rows.length) return;

		const box = side.createDiv({ cls: "reel-panel" });
		box.createDiv({ cls: "reel-panel-title", text: "Details" });
		const dl = box.createDiv({ cls: "reel-meta" });
		for (const [k, v] of rows) {
			const row = dl.createDiv({ cls: "reel-meta-row" });
			row.createDiv({ cls: "reel-meta-key", text: k });
			row.createDiv({ cls: "reel-meta-value", text: v });
		}
	}

	/* ------------------------------------------------------------------ */

	private renderSeasons(main: HTMLElement): void {
		const e = this.entry;
		const wrap = main.createDiv({ cls: "reel-panel" });
		wrap.createDiv({ cls: "reel-panel-title", text: "Seasons" });

		const strip = wrap.createDiv({ cls: "reel-seasons" });
		for (const s of e.seasons) {
			const total = s.total ?? 0;
			const seen = rangeCount(s.watched);
			const pill = strip.createDiv({ cls: "reel-season-pill" });
			pill.createSpan({ cls: "reel-season-n", text: `S${s.n}` });
			pill.createSpan({ cls: "reel-dim", text: total ? `${seen}/${total}` : String(seen) });
			if (s.rating != null) pill.createSpan({ cls: "reel-season-rating", text: `${s.rating}★` });
			if (total && seen >= total) pill.addClass("is-complete");
			else if (seen > 0) pill.addClass("is-partial");
			if (this.openSeason === s.n) pill.addClass("is-open");
			pill.setCssProps({ "--reel-fill": total ? String(Math.min(1, seen / total)) : "0" });
			pill.addEventListener("click", () => {
				this.openSeason = this.openSeason === s.n ? null : s.n;
				this.rerender();
			});
		}

		if (this.openSeason != null) void this.renderEpisodes(wrap, this.openSeason);
	}

	private async renderEpisodes(wrap: HTMLElement, season: number): Promise<void> {
		const e = this.entry;
		const listEl = wrap.createDiv({ cls: "reel-episodes" });
		listEl.createDiv({ cls: "reel-loading", text: `Loading season ${season}…` });

		let episodes = this.episodeCache.get(season);
		if (!episodes) {
			const ended = e.showStatus === "Ended" || e.showStatus === "Canceled";
			try {
				const data = await this.plugin.tmdb.getSeason(e.tmdbId, season, ended);
				episodes = (data.episodes ?? []).filter((x) => x.episode_number > 0);
				this.episodeCache.set(season, episodes);
			} catch (err) {
				listEl.empty();
				listEl.createDiv({ cls: "reel-error", text: redact(err) });
				return;
			}
		}

		const row = e.seasons.find((s) => s.n === season);
		const watched = new Set(parseRange(row?.watched));
		const ratings: Record<string, number> = { ...(row?.episode_ratings ?? {}) };

		listEl.empty();
		let firstUnwatched: HTMLElement | null = null;

		const remaining = episodes.filter((x) => !watched.has(x.episode_number)).length;
		if (remaining) {
			listEl.createDiv({
				cls: "reel-block-count",
				text: `${remaining} of ${episodes.length} left in season ${season}`,
			});
		}

		const bulk = listEl.createDiv({ cls: "reel-season-bulk" });
		const markAll = bulk.createEl("button", { cls: "reel-chip", text: "Mark all watched" });
		markAll.addEventListener("click", async () => {
			const file = this.file;
			if (!file || !episodes) return;
			await this.plugin.notes.setSeasonRange(file, season, `1-${episodes.length}`);
			new Notice(`Season ${season} marked watched`);
		});
		const clear = bulk.createEl("button", { cls: "reel-chip", text: "Clear" });
		clear.addEventListener("click", async () => {
			const file = this.file;
			if (!file) return;
			await this.plugin.notes.setSeasonRange(file, season, "");
			new Notice(`Season ${season} cleared`);
		});

		for (const ep of episodes) {
			const n = ep.episode_number;
			const epRow = listEl.createDiv({ cls: "reel-episode" });
			epRow.toggleClass("is-watched", watched.has(n));

			const tick = epRow.createDiv({ cls: "reel-episode-tick" });
			tick.createSpan({ text: "✓" });
			tick.setAttr("role", "button");
			tick.setAttr("aria-label", `Toggle episode ${n}`);
			tick.addEventListener("click", async () => {
				const file = this.file;
				if (!file) return;
				if (watched.has(n)) watched.delete(n);
				else watched.add(n);
				epRow.toggleClass("is-watched", watched.has(n));
				const range = formatRange([...watched]);
				await this.plugin.notes.setSeasonRange(file, season, range);
				// Keep the in-memory entry in step so the season pill counts are
				// right if you collapse the season, without re-reading an index
				// that hasn't caught up with this write yet.
				this.entry = {
					...this.entry,
					seasons: this.entry.seasons.map((s) => (s.n === season ? { ...s, watched: range } : s)),
				};
			});

			const epBody = epRow.createDiv({ cls: "reel-episode-body" });
			epBody.createDiv({ cls: "reel-episode-title", text: `${n}. ${ep.name ?? `Episode ${n}`}` });
			const meta = epBody.createDiv({ cls: "reel-episode-meta" });
			if (ep.air_date) meta.createSpan({ text: prettyDate(ep.air_date) });
			if (ep.runtime) meta.createSpan({ text: `${ep.runtime}m` });

			// The stars own their own state. Re-rendering here would read the
			// index before Obsidian has reparsed the file and paint the old
			// value straight back over the new one.
			const starWrap = epRow.createDiv({ cls: "reel-episode-stars" });
			starWrap.setAttr("aria-label", `Rate episode ${n}`);
			renderStars(starWrap, {
				value: ratings[String(n)],
				compact: true,
				onChange: async (v) => {
					const file = this.file;
					if (!file) return;
					if (v == null) delete ratings[String(n)];
					else {
						ratings[String(n)] = v;
						watched.add(n);
						epRow.addClass("is-watched");
					}
					await this.plugin.notes.rateEpisode(file, season, n, v ?? null);
					new Notice(v == null ? `S${season}E${n} cleared` : `S${season}E${n} rated ${v}`);
				},
			});

			// Opening season 4 of a show you're 18 episodes into should land on
			// episode 19, not make you scroll past everything you've seen.
			if (!firstUnwatched && !watched.has(n)) {
				firstUnwatched = epRow;
			}
		}

		if (firstUnwatched) {
			// After layout, or the offset is measured against nothing.
			window.setTimeout(() => firstUnwatched?.scrollIntoView({ block: "nearest" }), 0);
		}
	}

	private renderHistory(main: HTMLElement): void {
		const e = this.entry;
		if (!e.watched.length) return;
		const wrap = main.createDiv({ cls: "reel-panel" });
		wrap.createDiv({ cls: "reel-panel-title", text: `Watch history — ${e.watched.length}` });
		const list = wrap.createDiv({ cls: "reel-history" });
		for (const w of [...e.watched].reverse()) {
			const row = list.createDiv({ cls: "reel-history-row" });
			row.createSpan({ text: prettyDate(w.date) });
			if (w.rating != null) row.createSpan({ cls: "reel-dim", text: `★ ${w.rating}` });
			if (w.rewatch) row.createSpan({ cls: "reel-badge subtle", text: "rewatch" });
		}
	}
}
