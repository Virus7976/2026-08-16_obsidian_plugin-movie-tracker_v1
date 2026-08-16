/**
 * The detail screen.
 *
 * Everything the note header card offered, moved somewhere you'll actually see
 * it. The card is a markdown post-processor, so it only renders in Reading
 * view — in Live Preview, which is what most people have open, it simply isn't
 * there. That made the trailer, the season strip, the rewatch button and the
 * links effectively invisible.
 *
 * Every control here writes immediately and confirms visibly. "Did that
 * register?" is the worst question a tracker can leave you asking, so each
 * change flashes the control it changed rather than relying on you noticing a
 * colour shift.
 */

import { Notice, TFile, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry, TmdbEpisode } from "../types";
import { redact } from "../secrets";
import { formatMinutes, prettyDate, todayISO } from "../util/dates";
import { parseRange, rangeCount } from "../util/ranges";
import { renderStars } from "./stars";
import { LogSheet } from "./logSheet";
import { ListPicker } from "./listPicker";
import { imdbUrl, tmdbUrl } from "../extract";
import { unlink } from "../library";
import { ContentFlag, FLAG_LABELS } from "../content";

const FILM_STATUSES = ["watched", "watchlist", "abandoned"];
const TV_STATUSES = ["watching", "completed", "watchlist", "paused", "dropped"];

/** Brief green flash, so a silent write still reads as "that worked". */
function confirm(el: HTMLElement): void {
	el.addClass("reel-flash");
	window.setTimeout(() => el.removeClass("reel-flash"), 600);
}

export class DetailScreen {
	private openSeason: number | null = null;
	private episodeCache = new Map<number, TmdbEpisode[]>();

	constructor(
		private plugin: ReelPlugin,
		private entry: Entry,
		private onBack: () => void
	) {}

	private get file(): TFile | null {
		const f = this.plugin.app.vault.getAbstractFileByPath(this.entry.path);
		return f instanceof TFile ? f : null;
	}

	/** Re-read from the index after a write, so the screen reflects the file. */
	private refresh(container: HTMLElement): void {
		const latest = this.plugin.library.byPath(this.entry.path);
		if (latest) this.entry = latest;
		this.render(container);
	}

	render(container: HTMLElement): void {
		container.empty();
		container.addClass("reel-detail");
		const e = this.entry;
		const isTv = e.type === "tv";

		/* ---- top bar ------------------------------------------------- */
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

		/* ---- header -------------------------------------------------- */
		const head = container.createDiv({ cls: "reel-detail-head" });
		const posterEl = head.createDiv({ cls: "reel-detail-poster" });
		const src = this.plugin.posters.resourcePath(e.poster);
		if (src) posterEl.createEl("img", { attr: { src, alt: "" } });
		else {
			posterEl.addClass("is-empty");
			posterEl.createSpan({ text: e.title.slice(0, 2) });
		}

		const info = head.createDiv({ cls: "reel-detail-info" });
		const h = info.createDiv({ cls: "reel-detail-title" });
		h.createSpan({ text: e.title });
		const year = e.year ?? e.firstAirYear;
		if (year) h.createSpan({ cls: "reel-dim", text: ` ${year}` });

		const facts = info.createDiv({ cls: "reel-header-facts" });
		const people = isTv ? e.creators : e.director;
		if (people.length) facts.createSpan({ text: people.map(unlink).join(", ") });
		if (!isTv && e.runtime) facts.createSpan({ text: formatMinutes(e.runtime) });
		if (isTv) {
			const seen = e.seasons.reduce((n, s) => n + rangeCount(s.watched), 0);
			facts.createSpan({ text: `${seen}/${e.totalEpisodes ?? "?"} episodes` });
		}
		if (e.certification) facts.createSpan({ cls: "reel-badge cert", text: e.certification });

		/* scores */
		const scores = info.createDiv({ cls: "reel-scores" });
		const score = (label: string, value: string, cls: string) => {
			const chip = scores.createDiv({ cls: `reel-score ${cls}` });
			chip.createDiv({ cls: "reel-score-value", text: value });
			chip.createDiv({ cls: "reel-score-label", text: label });
		};
		if (e.rating != null) score("You", String(e.rating), "mine");
		if (e.imdbRating != null) score("IMDb", e.imdbRating.toFixed(1), "imdb");
		if (e.metacritic != null) score("Metacritic", String(e.metacritic), e.metacritic >= 61 ? "meta-good" : e.metacritic >= 40 ? "meta-mixed" : "meta-bad");
		if (e.rottenTomatoes != null) score("Tomatoes", `${e.rottenTomatoes}%`, e.rottenTomatoes >= 60 ? "fresh" : "rotten");
		if (e.tmdbRating != null) score("TMDB", e.tmdbRating.toFixed(1), "");
		if (!scores.childElementCount) scores.remove();

		/* ---- editable controls --------------------------------------- */
		const controls = container.createDiv({ cls: "reel-detail-controls" });

		const ratingBox = controls.createDiv({ cls: "reel-control" });
		ratingBox.createDiv({ cls: "reel-field-label", text: "Your rating" });
		const starRow = ratingBox.createDiv({ cls: "reel-rating-row" });
		renderStars(starRow, {
			value: e.rating,
			onChange: async (v) => {
				const file = this.file;
				if (!file) return;
				try {
					await this.plugin.notes.setRating(file, v ?? null);
					confirm(starRow);
					new Notice(v == null ? "Rating cleared" : `Rated ${v}`);
				} catch (err) {
					new Notice(`Reel: ${redact(err)}`);
				}
			},
		});

		const likeBox = controls.createDiv({ cls: "reel-control" });
		likeBox.createDiv({ cls: "reel-field-label", text: "Liked" });
		const heart = likeBox.createEl("button", { cls: "reel-heart", text: e.liked ? "♥ Liked" : "♡ Like" });
		heart.toggleClass("is-on", !!e.liked);
		heart.addEventListener("click", async () => {
			const file = this.file;
			if (!file) return;
			const on = await this.plugin.notes.toggleLiked(file);
			// Repaint from the actual result, not an assumption about it.
			heart.setText(on ? "♥ Liked" : "♡ Like");
			heart.toggleClass("is-on", on);
			confirm(heart);
		});

		const statusBox = controls.createDiv({ cls: "reel-control wide" });
		statusBox.createDiv({ cls: "reel-field-label", text: "Status" });
		const statusRow = statusBox.createDiv({ cls: "reel-status-row" });
		for (const status of isTv ? TV_STATUSES : FILM_STATUSES) {
			const pill = statusRow.createEl("button", { cls: "reel-chip", text: status });
			pill.toggleClass("is-active", e.status === status);
			pill.addEventListener("click", async () => {
				const file = this.file;
				if (!file) return;
				await this.plugin.notes.setStatus(file, status);
				statusRow.findAll(".reel-chip").forEach((c) => c.removeClass("is-active"));
				pill.addClass("is-active");
				confirm(pill);
			});
		}

		/* ---- primary actions ------------------------------------------ */
		const actions = container.createDiv({ cls: "reel-detail-actions" });
		const act = (label: string, cta: boolean, fn: () => void) => {
			const b = actions.createEl("button", { cls: `reel-btn${cta ? " mod-cta" : ""}`, text: label });
			b.addEventListener("click", fn);
			return b;
		};

		if (!isTv) {
			// The label says what will happen, so logging a rewatch is one
			// obvious button rather than something you have to know about.
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
					this.refresh(container);
				});
			}
			act("Start a rewatch", false, async () => {
				const file = this.file;
				if (!file) return;
				await this.plugin.notes.restartSeries(file, e.rating);
				new Notice("Progress reset — previous run recorded");
				this.refresh(container);
			});
		}

		act("Lists", false, () => {
			const file = this.file;
			if (file) new ListPicker(this.plugin.app, this.plugin, e, file).open();
		});

		act("Refresh", false, async () => {
			try {
				await this.plugin.notes.refreshMetadata(e);
				new Notice("Metadata refreshed");
				this.refresh(container);
			} catch (err) {
				new Notice(`Reel: ${redact(err)}`);
			}
		});

		/* ---- links ---------------------------------------------------- */
		const links = container.createDiv({ cls: "reel-links" });
		const link = (label: string, url: string, cls: string) => {
			const a = links.createEl("a", { cls: `reel-link ${cls}`, text: label, href: url });
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
		};
		if (e.trailer) link("▶ Trailer", e.trailer, "trailer");
		const imdb = imdbUrl(e.imdbId);
		if (imdb) link("IMDb", imdb, "imdb");
		link("TMDB", tmdbUrl(e.tmdbId, e.type), "tmdb");

		/* ---- overview ------------------------------------------------- */
		if (e.overview) container.createDiv({ cls: "reel-detail-overview", text: e.overview });

		if (e.genres.length) {
			const g = container.createDiv({ cls: "reel-header-genres" });
			e.genres.forEach((x) => g.createSpan({ cls: "reel-chip static", text: x }));
		}

		if (e.providers.length) {
			const p = container.createDiv({ cls: "reel-header-facts" });
			p.createSpan({ cls: "reel-dim", text: "Streaming: " });
			p.createSpan({ text: e.providers.join(", ") });
		}

		if (e.contentFlags.length) {
			const f = container.createDiv({ cls: "reel-header-flags" });
			f.createSpan({ cls: "reel-dim", text: "Contains: " });
			e.contentFlags.forEach((x) => f.createSpan({ cls: "reel-badge flag", text: FLAG_LABELS[x as ContentFlag] ?? x }));
		}

		if (e.cast.length) {
			const c = container.createDiv({ cls: "reel-header-cast" });
			c.createSpan({ cls: "reel-dim", text: "Cast: " });
			c.createSpan({ text: e.cast.map(unlink).join(", ") });
		}

		/* ---- seasons and episodes ------------------------------------- */
		if (isTv) this.renderSeasons(container);
		else this.renderHistory(container);
	}

	/* ------------------------------------------------------------------ */

	private renderSeasons(container: HTMLElement): void {
		const e = this.entry;
		const wrap = container.createDiv({ cls: "reel-detail-section" });
		wrap.createDiv({ cls: "reel-section-title", text: "Seasons" });

		const strip = wrap.createDiv({ cls: "reel-seasons" });
		for (const s of e.seasons) {
			const total = s.total ?? 0;
			const seen = rangeCount(s.watched);
			const pill = strip.createDiv({ cls: "reel-season-pill" });
			pill.createSpan({ cls: "reel-season-n", text: `S${s.n}` });
			pill.createSpan({ cls: "reel-dim", text: total ? `${seen}/${total}` : String(seen) });
			if (total && seen >= total) pill.addClass("is-complete");
			else if (seen > 0) pill.addClass("is-partial");
			if (this.openSeason === s.n) pill.addClass("is-open");
			pill.setCssProps({ "--reel-fill": total ? String(Math.min(1, seen / total)) : "0" });
			pill.addEventListener("click", () => {
				// Tapping the open season closes it, so the list is a toggle
				// rather than something you can only ever open.
				this.openSeason = this.openSeason === s.n ? null : s.n;
				this.render(container);
			});
		}

		if (this.openSeason != null) void this.renderEpisodes(wrap, container, this.openSeason);
	}

	private async renderEpisodes(wrap: HTMLElement, root: HTMLElement, season: number): Promise<void> {
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
		const ratings = row?.episode_ratings ?? {};

		listEl.empty();

		const bulk = listEl.createDiv({ cls: "reel-season-bulk" });
		const markAll = bulk.createEl("button", { cls: "reel-chip", text: "Mark all watched" });
		markAll.addEventListener("click", async () => {
			const file = this.file;
			if (!file || !episodes) return;
			await this.plugin.notes.setSeasonRange(file, season, `1-${episodes.length}`);
			new Notice(`Season ${season} marked watched`);
			this.refresh(root);
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
				const next = new Set(watched);
				if (next.has(n)) next.delete(n);
				else next.add(n);
				const { formatRange } = await import("../util/ranges");
				await this.plugin.notes.setSeasonRange(file, season, formatRange([...next]));
				this.refresh(root);
			});

			const body = epRow.createDiv({ cls: "reel-episode-body" });
			body.createDiv({ cls: "reel-episode-title", text: `${n}. ${ep.name ?? `Episode ${n}`}` });
			const meta = body.createDiv({ cls: "reel-episode-meta" });
			if (ep.air_date) meta.createSpan({ text: prettyDate(ep.air_date) });
			if (ep.runtime) meta.createSpan({ text: `${ep.runtime}m` });

			renderStars(body.createDiv({ cls: "reel-episode-stars" }), {
				value: ratings[String(n)],
				compact: true,
				onChange: async (v) => {
					const file = this.file;
					if (!file) return;
					await this.plugin.notes.rateEpisode(file, season, n, v ?? null);
					new Notice(v == null ? `S${season}E${n} rating cleared` : `S${season}E${n} rated ${v}`);
					this.refresh(root);
				},
			});
		}
	}

	private renderHistory(container: HTMLElement): void {
		const e = this.entry;
		if (!e.watched.length) return;
		const wrap = container.createDiv({ cls: "reel-detail-section" });
		wrap.createDiv({ cls: "reel-section-title", text: `Watch history — ${e.watched.length}` });
		const list = wrap.createDiv({ cls: "reel-history" });
		for (const w of [...e.watched].reverse()) {
			const row = list.createDiv({ cls: "reel-history-row" });
			row.createSpan({ text: prettyDate(w.date) });
			if (w.rating != null) row.createSpan({ cls: "reel-dim", text: `★ ${w.rating}` });
			if (w.rewatch) row.createSpan({ cls: "reel-badge subtle", text: "rewatch" });
		}
	}
}

export { todayISO };
