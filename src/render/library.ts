/**
 * The ```films``` / ```series``` / ```library``` code block.
 *
 * Rendering is a synchronous pass over the in-memory index, so re-filtering on
 * a chip tap touches neither disk nor network and lands inside one frame.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { applyQuery, parseQuery, Query } from "./query";
import { renderPosterGrid, renderRowList } from "./grid";

interface ChipState {
	status: string | null;
	decade: number | null;
	genre: string | null;
}

export function registerLibraryBlocks(plugin: ReelPlugin): void {
	const handler =
		(defaults: Partial<Query>) =>
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			ctx.addChild(new LibraryBlock(plugin, el, parseQuery(source, defaults)));
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

		// Content policy first, so hidden titles can't leak into the chip
		// options either — a genre chip for a film you've filtered out is a
		// small leak, but it's still a leak.
		const base = applyQuery(this.plugin.visible(this.plugin.library.all()), this.query);
		const hidden = this.plugin.hiddenCount(this.plugin.library.all());

		if (this.query.chips) this.renderChips(el, base);

		const rows = base.filter((e) => this.matchesChips(e));

		const count = el.createDiv({ cls: "reel-block-count" });
		count.setText(`${rows.length} title${rows.length === 1 ? "" : "s"}`);
		if (hidden) count.createSpan({ cls: "reel-dim", text: ` · ${hidden} hidden by content filter` });

		if (!rows.length) {
			el.createDiv({
				cls: "reel-empty",
				text: this.plugin.library.size
					? "Nothing matches these filters."
					: "Nothing logged yet. Tap the Reel ribbon icon to add something.",
			});
			return;
		}

		if (this.query.layout === "list") renderRowList(this.plugin, el, rows);
		else if (this.query.layout === "compact") renderRowList(this.plugin, el, rows, true);
		else renderPosterGrid(this.plugin, el, rows);
	}

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

		group("All", [...new Set(rows.map((e) => e.status))].sort(), "status", (v) => String(v));

		const decades = [...new Set(rows.map(decadeOf).filter((d): d is number => d != null))].sort((a, b) => b - a);
		if (decades.length > 1) {
			group("Any decade", decades, "decade", (v) => `${v}s`);
		}

		const genres = [...new Set(rows.flatMap((e) => e.genres))].sort();
		if (genres.length > 1) {
			group("Any genre", genres.slice(0, 12), "genre", (v) => String(v));
		}
	}

	private matchesChips(e: Entry): boolean {
		if (this.chips.status && e.status !== this.chips.status) return false;
		if (this.chips.decade != null && decadeOf(e) !== this.chips.decade) return false;
		if (this.chips.genre && !e.genres.includes(this.chips.genre)) return false;
		return true;
	}
}

function decadeOf(e: Entry): number | null {
	const y = e.year ?? e.firstAirYear;
	return y ? Math.floor(y / 10) * 10 : null;
}
