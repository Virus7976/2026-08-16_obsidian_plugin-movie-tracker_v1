/**
 * Episode checklist for one season.
 *
 * Episode titles come from `/tv/{id}/season/{n}` — fetched only when you open a
 * season, and cached permanently once the show has ended. Adding a ten-season
 * show still costs one request; you pay per season only for the ones you look at.
 *
 * Ticking writes the whole season's range in one `processFrontMatter` pass
 * rather than one per episode, so a "mark all" doesn't queue fifty file writes.
 */

import { App, Modal, Notice, Platform, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry, TmdbEpisode } from "../types";
import { redact } from "../secrets";
import { formatRange, parseRange } from "../util/ranges";
import { prettyDate } from "../util/dates";

export class SeasonSheet extends Modal {
	private watched: Set<number>;
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
	}

	async onOpen(): Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-season");

		const head = contentEl.createDiv({ cls: "reel-season-head" });
		head.createEl("h3", { text: `${this.entry.title} — Season ${this.season}` });
		const counter = head.createDiv({ cls: "reel-season-count" });

		const bulk = contentEl.createDiv({ cls: "reel-season-bulk" });
		const listEl = contentEl.createDiv({ cls: "reel-episodes" });
		listEl.createDiv({ cls: "reel-loading", text: "Loading episodes…" });

		const ended = this.entry.showStatus === "Ended" || this.entry.showStatus === "Canceled";
		try {
			const data = await this.plugin.tmdb.getSeason(this.entry.tmdbId, this.season, ended);
			this.episodes = (data.episodes ?? []).filter((e) => e.episode_number > 0);
		} catch (e) {
			listEl.empty();
			listEl.createDiv({ cls: "reel-error", text: redact(e) });
			return;
		}

		const paintCount = () => {
			counter.setText(`${this.watched.size} / ${this.episodes.length} watched`);
		};

		const paintRow = (row: HTMLElement, n: number) => {
			row.toggleClass("is-watched", this.watched.has(n));
		};

		listEl.empty();
		const rows = new Map<number, HTMLElement>();

		for (const ep of this.episodes) {
			const n = ep.episode_number;
			const row = listEl.createDiv({ cls: "reel-episode" });
			rows.set(n, row);

			const tick = row.createDiv({ cls: "reel-episode-tick" });
			tick.createSpan({ text: "✓" });

			const body = row.createDiv({ cls: "reel-episode-body" });
			body.createDiv({ cls: "reel-episode-title", text: `${n}. ${ep.name ?? `Episode ${n}`}` });
			const meta = body.createDiv({ cls: "reel-episode-meta" });
			if (ep.air_date) meta.createSpan({ text: prettyDate(ep.air_date) });
			if (ep.runtime) meta.createSpan({ text: `${ep.runtime}m` });

			row.addEventListener("click", () => {
				if (this.watched.has(n)) this.watched.delete(n);
				else this.watched.add(n);
				this.dirty = true;
				paintRow(row, n);
				paintCount();
			});

			paintRow(row, n);
		}
		paintCount();

		/* Bulk actions — "watched up to here" is the one that gets used. */
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

	private async persist(): Promise<void> {
		if (!this.dirty) return;
		const file = this.app.vault.getAbstractFileByPath(this.entry.path);
		if (!(file instanceof TFile)) return;
		try {
			await this.plugin.notes.setSeasonRange(file, this.season, formatRange([...this.watched]));
			new Notice(`Reel: season ${this.season} updated.`);
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
