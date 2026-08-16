/**
 * The ```films``` / ```series``` code block: a poster grid with sticky chips.
 *
 * Three across on a phone, tap to open, long-press to quick-rate. Rendering is
 * a synchronous pass over the in-memory index, so re-filtering on a chip tap
 * doesn't touch disk or network and lands inside one frame.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { applyQuery, lastWatchDate, parseQuery, Query } from "./query";
import { renderStars, renderStarsStatic } from "../ui/stars";
import { prettyDate } from "../util/dates";
import { rangeCount } from "../util/ranges";
import { redact } from "../secrets";
import { LogSheet } from "../ui/logSheet";

interface ChipState {
	status: string | null;
	decade: number | null;
	genre: string | null;
}

export function registerLibraryBlocks(plugin: ReelPlugin): void {
	const handler =
		(defaults: Partial<Query>) =>
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const query = parseQuery(source, defaults);
			const child = new LibraryBlock(plugin, el, query);
			ctx.addChild(child);
		};

	plugin.registerMarkdownCodeBlockProcessor("films", handler({ type: "film" }));
	plugin.registerMarkdownCodeBlockProcessor("series", handler({ type: "tv", sortField: "watched" }));
	plugin.registerMarkdownCodeBlockProcessor("library", handler({ type: "all" }));
}

class LibraryBlock extends MarkdownRenderChild {
	private chips: ChipState = { status: null, decade: null, genre: null };

	constructor(
		private plugin: ReelPlugin,
		containerEl: HTMLElement,
		private query: Query
	) {
		super(containerEl);
	}

	onload(): void {
		this.containerEl.addClass("reel-block");
		this.render();
		// Any frontmatter change anywhere repaints — the index is already live,
		// so this is just a re-read of an array.
		this.registerEvent(this.plugin.library.on("changed", () => this.render()));
	}

	private render(): void {
		const el = this.containerEl;
		el.empty();

		if (this.query.errors.length) {
			const box = el.createDiv({ cls: "reel-error" });
			this.query.errors.forEach((e) => box.createDiv({ text: e }));
		}

		if (this.query.title) el.createDiv({ cls: "reel-block-title", text: this.query.title });

		const base = applyQuery(this.plugin.library.all(), this.query);
		if (this.query.chips) this.renderChips(el, base);

		const rows = base.filter((e) => this.matchesChips(e));

		const count = el.createDiv({ cls: "reel-block-count" });
		count.setText(`${rows.length} title${rows.length === 1 ? "" : "s"}`);

		if (!rows.length) {
			el.createDiv({
				cls: "reel-empty",
				text: this.plugin.library.size
					? "Nothing matches these filters."
					: "Nothing logged yet. Use the Reel ribbon icon to add something.",
			});
			return;
		}

		if (this.query.layout === "list" || this.query.layout === "compact") this.renderList(el, rows);
		else this.renderGrid(el, rows);
	}

	/* ---------------------------------------------------------------- */

	private renderChips(el: HTMLElement, rows: Entry[]): void {
		const bar = el.createDiv({ cls: "reel-chips" });

		const group = (
			label: string,
			values: (string | number)[],
			key: keyof ChipState,
			format: (v: string | number) => string
		) => {
			if (values.length < 2) return;
			const all = bar.createEl("button", { cls: "reel-chip", text: label });
			all.toggleClass("is-active", this.chips[key] == null);
			all.addEventListener("click", () => {
				(this.chips[key] as unknown) = null;
				this.render();
			});
			for (const v of values) {
				const chip = bar.createEl("button", { cls: "reel-chip", text: format(v) });
				chip.toggleClass("is-active", String(this.chips[key]) === String(v));
				chip.addEventListener("click", () => {
					(this.chips[key] as unknown) = String(this.chips[key]) === String(v) ? null : v;
					this.render();
				});
			}
		};

		const statuses = [...new Set(rows.map((e) => e.status))].sort();
		group("All", statuses, "status", (v) => String(v));

		const decades = [...new Set(rows.map((e) => decadeOf(e)).filter((d): d is number => d != null))].sort(
			(a, b) => b - a
		);
		if (decades.length > 1) {
			const sep = bar.createSpan({ cls: "reel-chip-sep" });
			sep.setText("·");
			group("Any decade", decades, "decade", (v) => `${v}s`);
		}

		const genres = [...new Set(rows.flatMap((e) => e.genres))].sort();
		if (genres.length > 1) {
			bar.createSpan({ cls: "reel-chip-sep", text: "·" });
			group("Any genre", genres.slice(0, 12), "genre", (v) => String(v));
		}
	}

	private matchesChips(e: Entry): boolean {
		if (this.chips.status && e.status !== this.chips.status) return false;
		if (this.chips.decade != null && decadeOf(e) !== this.chips.decade) return false;
		if (this.chips.genre && !e.genres.includes(this.chips.genre)) return false;
		return true;
	}

	/* ---------------------------------------------------------------- */

	private renderGrid(el: HTMLElement, rows: Entry[]): void {
		const grid = el.createDiv({ cls: "reel-grid" });
		for (const entry of rows) {
			const cell = grid.createDiv({ cls: "reel-cell" });
			cell.setAttr("role", "button");
			cell.setAttr("tabindex", "0");
			cell.setAttr("aria-label", entry.title);

			const posterEl = cell.createDiv({ cls: "reel-cell-poster" });
			const src = this.plugin.posters.resourcePath(entry.poster);
			if (src) {
				const img = posterEl.createEl("img", {
					attr: { src, alt: "", loading: "lazy", decoding: "async" },
				});
				img.addEventListener("error", () => {
					img.remove();
					this.placeholder(posterEl, entry);
				});
			} else {
				this.placeholder(posterEl, entry);
			}

			if (entry.rating != null) {
				const badge = posterEl.createDiv({ cls: "reel-cell-rating" });
				renderStarsStatic(badge, entry.rating);
			}
			if (entry.liked) posterEl.createDiv({ cls: "reel-cell-heart", text: "♥" });
			if (entry.status === "watchlist") posterEl.createDiv({ cls: "reel-cell-flag", text: "Watchlist" });

			if (entry.type === "tv") {
				const total = entry.totalEpisodes ?? 0;
				const seen = entry.seasons.reduce((n, s) => n + rangeCount(s.watched), 0);
				if (total && seen && seen < total) {
					const bar = posterEl.createDiv({ cls: "reel-cell-progress" });
					bar.style.setProperty("--reel-fill", String(seen / total));
				}
			}

			const caption = cell.createDiv({ cls: "reel-cell-caption" });
			caption.createDiv({ cls: "reel-cell-title", text: entry.title });
			const y = entry.year ?? entry.firstAirYear;
			if (y) caption.createDiv({ cls: "reel-cell-year", text: String(y) });

			this.wireCell(cell, entry);
		}
	}

	private renderList(el: HTMLElement, rows: Entry[]): void {
		const list = el.createDiv({ cls: "reel-list" });
		for (const entry of rows) {
			const row = list.createDiv({ cls: "reel-row" });
			row.setAttr("role", "button");
			row.setAttr("tabindex", "0");

			if (this.query.layout !== "compact") {
				const thumb = row.createDiv({ cls: "reel-row-thumb" });
				const src = this.plugin.posters.resourcePath(entry.poster);
				if (src) thumb.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
				else this.placeholder(thumb, entry);
			}

			const body = row.createDiv({ cls: "reel-row-body" });
			const title = body.createDiv({ cls: "reel-row-title" });
			title.createSpan({ text: entry.title });
			const y = entry.year ?? entry.firstAirYear;
			if (y) title.createSpan({ cls: "reel-dim", text: ` ${y}` });

			const meta = body.createDiv({ cls: "reel-row-meta" });
			const when = lastWatchDate(entry);
			if (when) meta.createSpan({ text: prettyDate(when) });
			if (entry.rating != null) renderStarsStatic(meta, entry.rating);
			if (entry.type === "tv" && entry.lastWatched) {
				meta.createSpan({ text: `S${entry.lastWatched.season}E${entry.lastWatched.episode}` });
			}

			this.wireCell(row, entry);
		}
	}

	private placeholder(parent: HTMLElement, entry: Entry): void {
		parent.addClass("is-empty");
		parent.createSpan({ cls: "reel-placeholder-text", text: entry.title.slice(0, 2) });
	}

	/**
	 * Tap opens the note; long-press (or right-click on desktop) quick-rates.
	 * A 500ms hold with a movement threshold, so a scroll never fires it.
	 */
	private wireCell(cell: HTMLElement, entry: Entry): void {
		let timer: number | null = null;
		let longPressed = false;
		let startY = 0;

		const cancel = () => {
			if (timer != null) window.clearTimeout(timer);
			timer = null;
		};

		const quickRate = () => {
			longPressed = true;
			const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile) new QuickRate(this.plugin, entry, file).open();
		};

		cell.addEventListener("pointerdown", (e) => {
			longPressed = false;
			startY = e.clientY;
			timer = window.setTimeout(quickRate, 500);
		});
		cell.addEventListener("pointermove", (e) => {
			if (Math.abs(e.clientY - startY) > 8) cancel();
		});
		cell.addEventListener("pointerup", cancel);
		cell.addEventListener("pointercancel", cancel);
		cell.addEventListener("pointerleave", cancel);

		cell.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			cancel();
			quickRate();
		});

		cell.addEventListener("click", async () => {
			if (longPressed) {
				longPressed = false;
				return;
			}
			const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile) await this.plugin.app.workspace.getLeaf(false).openFile(file);
			else new Notice("Reel: note not found.");
		});

		cell.addEventListener("keydown", (e) => {
			if (e.key !== "Enter") return;
			const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile) this.plugin.app.workspace.getLeaf(false).openFile(file);
		});
	}
}

function decadeOf(e: Entry): number | null {
	const y = e.year ?? e.firstAirYear;
	return y ? Math.floor(y / 10) * 10 : null;
}

/* -------------------------------------------------------------------- */

import { Modal, Platform } from "obsidian";

/** Long-press target: stars, a heart, and nothing else. */
class QuickRate extends Modal {
	constructor(
		private plugin: ReelPlugin,
		private entry: Entry,
		private file: TFile
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal", "reel-quickrate");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		contentEl.createEl("h3", { cls: "reel-log-title", text: this.entry.title });

		renderStars(contentEl.createDiv({ cls: "reel-rating-row big" }), {
			value: this.entry.rating,
			onChange: async (v) => {
				try {
					await this.plugin.notes.setRating(this.file, v ?? null);
				} catch (e) {
					new Notice(`Reel: ${redact(e)}`);
				}
				this.close();
			},
		});

		const row = contentEl.createDiv({ cls: "reel-log-actions" });
		const heart = row.createEl("button", { cls: "reel-btn", text: this.entry.liked ? "♥ Liked" : "♡ Like" });
		heart.addEventListener("click", async () => {
			await this.plugin.notes.toggleLiked(this.file);
			this.close();
		});
		const open = row.createEl("button", { cls: "reel-btn mod-cta", text: "Open note" });
		open.addEventListener("click", async () => {
			this.close();
			await this.plugin.app.workspace.getLeaf(false).openFile(this.file);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
