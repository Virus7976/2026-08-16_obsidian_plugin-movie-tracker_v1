/**
 * Episode checklist for one season, with per-episode ratings.
 *
 * Two things happen per row and they must not fight each other: ticking an
 * episode watched, and rating it. So the tick zone and the star strip are
 * separate targets — tapping stars rates *and* marks watched, because nobody
 * rates an episode they haven't seen, and making that two taps buys nothing.
 *
 * Episode titles come from `/tv/{id}/season/{n}`, fetched only when a season is
 * opened and cached permanently once the show has ended.
 */

import { App, Modal, Notice, Platform, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry, TmdbEpisode } from "../types";
import { redact } from "../secrets";
import { formatRange, parseRange } from "../util/ranges";
import { prettyDate } from "../util/dates";
import { renderStars } from "./stars";

export class SeasonSheet extends Modal {
	private watched: Set<number>;
	private ratings: Record<string, number>;
	private seasonRating: number | undefined;
	private episodes: TmdbEpisode[] = [];
	private dirty = false;

	constructor(
		app: App,
		private plugin: ReelPlugin,
		private entry: Entry,
		private season: number
	) {
		super(app);
		const row = entry.seasons.find((s) => s.n === season);
		this.watched = new Set(parseRange(row?.watched));
		this.ratings = { ...(row?.episode_ratings ?? {}) };
		this.seasonRating = row?.rating;
	}

	async onOpen(): Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-season");

		const head = contentEl.createDiv({ cls: "reel-season-head" });
		head.createEl("h3", { text: `${this.entry.title} — Season ${this.season}` });
		const counter = head.createDiv({ cls: "reel-season-count" });

		/* Season rating sits above the list, so it reads as being about the
		   season rather than about whichever episode is at the top. */
		const seasonRow = contentEl.createDiv({ cls: "reel-field reel-field-inline" });
		seasonRow.createDiv({ cls: "reel-field-label", text: "Season rating" });
		renderStars(seasonRow.createDiv(), {
			value: this.seasonRating,
			onChange: (v) => {
				this.seasonRating = v;
				this.dirty = true;
			},
		});

		const bulk = contentEl.createDiv({ cls: "reel-season-bulk" });
		const listEl = contentEl.createDiv({ cls: "reel-episodes" });
		listEl.createDiv({ cls: "reel-loading", text: "Loading episodes…", attr: { role: "status" } });

		const ended = this.entry.showStatus === "Ended" || this.entry.showStatus === "Canceled";
		try {
			const data = await this.plugin.tmdb.getSeason(this.entry.tmdbId, this.season, ended);
			this.episodes = (data.episodes ?? []).filter((e) => e.episode_number > 0);
		} catch (e) {
			listEl.empty();
			listEl.createDiv({ cls: "reel-error", text: redact(e) });
			return;
		}

		const paintCount = () => counter.setText(`${this.watched.size} / ${this.episodes.length} watched`);
		const rows = new Map<number, HTMLElement>();
		const paintRow = (row: HTMLElement, n: number) => row.toggleClass("is-watched", this.watched.has(n));

		listEl.empty();

		for (const ep of this.episodes) {
			const n = ep.episode_number;
			const row = listEl.createDiv({ cls: "reel-episode" });
			rows.set(n, row);

			// Tick zone: its own target, so tapping it can't be read as a
			// stray tap on the stars.
			const tick = row.createDiv({ cls: "reel-episode-tick" });
			tick.createSpan({ text: "✓" });
			tick.setAttr("aria-label", `Episode ${n}`);
			tick.setAttr("role", "button");
			tick.setAttr("aria-label", `Mark episode ${n} watched`);
			tick.addEventListener("click", (e) => {
				e.stopPropagation();
				if (this.watched.has(n)) this.watched.delete(n);
				else this.watched.add(n);
				this.dirty = true;
				paintRow(row, n);
				paintCount();
			});

			const body = row.createDiv({ cls: "reel-episode-body" });
			body.createDiv({ cls: "reel-episode-title", text: `${n}. ${ep.name ?? `Episode ${n}`}` });

			const meta = body.createDiv({ cls: "reel-episode-meta" });
			if (ep.air_date) meta.createSpan({ text: prettyDate(ep.air_date) });
			if (ep.runtime) meta.createSpan({ text: `${ep.runtime}m` });

			renderStars(body.createDiv({ cls: "reel-episode-stars" }), {
				value: this.ratings[String(n)],
				compact: true,
				onChange: (v) => {
					if (v == null) delete this.ratings[String(n)];
					else {
						this.ratings[String(n)] = v;
						this.watched.add(n); // rating implies watching
					}
					this.dirty = true;
					paintRow(row, n);
					paintCount();
				},
			});

			paintRow(row, n);
		}
		paintCount();

		const bulkBtn = (label: string, fn: () => void) => {
			const b = bulk.createEl("button", { cls: "reel-chip", text: label });
			b.addEventListener("click", () => {
				fn();
				this.dirty = true;
				rows.forEach((row, n) => paintRow(row, n));
				paintCount();
			});
		};
		bulkBtn("Mark all", () => this.episodes.forEach((e) => this.watched.add(e.episode_number)));
		bulkBtn("Clear", () => this.watched.clear());

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
		cancel.addEventListener("click", () => {
			this.dirty = false;
			this.close();
		});
		const save = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Save" });
		save.addEventListener("click", async () => {
			await this.persist();
			this.close();
		});
	}

	/**
	 * One write for the whole season rather than one per episode — "mark all"
	 * on a 23-episode season would otherwise queue 23 file writes.
	 */
	private async persist(): Promise<void> {
		if (!this.dirty) return;
		const file = this.app.vault.getAbstractFileByPath(this.entry.path);
		if (!(file instanceof TFile)) return;
		try {
			// Through NoteWriter rather than straight to processFrontMatter, so
			// this save is undoable like every other. It is the one that can
			// discard the most in a single press: untick a run of episodes and
			// their ratings go with them.
			await this.plugin.notes.edit(file, `the season ${this.season} changes`, (fm) => {
				const seasons = Array.isArray(fm.seasons) ? [...fm.seasons] : [];
				let row = seasons.find((s: { n: number }) => Number(s.n) === this.season);
				if (!row) {
					row = { n: this.season, watched: "" };
					seasons.push(row);
					seasons.sort((a: { n: number }, b: { n: number }) => Number(a.n) - Number(b.n));
				}
				row.watched = formatRange([...this.watched]);

				// Drop ratings for episodes that are no longer marked watched,
				// so "Clear" doesn't strand ratings for unwatched episodes.
				const kept: Record<string, number> = {};
				for (const [k, v] of Object.entries(this.ratings)) {
					if (this.watched.has(Number(k))) kept[k] = v;
				}
				if (Object.keys(kept).length) row.episode_ratings = kept;
				else delete row.episode_ratings;

				if (this.seasonRating != null) row.rating = this.seasonRating;
				else delete row.rating;

				fm.seasons = seasons;

				const furthest = Math.max(0, ...[...this.watched]);
				if (furthest > 0) fm.last_watched = { season: this.season, episode: furthest, date: todayISO() };
				if (this.watched.size && (fm.status === "watchlist" || !fm.status)) fm.status = "watching";

				const totalWatched = seasons.reduce(
					(sum: number, s: { watched?: string }) => sum + parseRange(s.watched).length,
					0
				);
				const next = nextShowStatus(String(fm.status ?? ""), totalWatched, Number(fm.total_episodes ?? 0));
				if (next) fm.status = next;
			});
			this.plugin.undo.offer(`Season ${this.season} updated`);
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

import { todayISO } from "../util/dates";
import { nextShowStatus } from "../util/status";
