/**
 * Discover's filters, in the same sheet shape as the Library's.
 *
 * Discover used to lay genre, decade and score out as two scrolling rows of
 * chips above the shelves, which is the exact layout the Library gave up when
 * it grew a Filters button. Same button, same sheet, same footer now: what is
 * set shows as tags in the control row, everything else lives behind one tap.
 */

import { App, Modal, Platform } from "obsidian";
import { setSelected } from "./a11y";

export interface DiscoverFilters {
	genreIds: number[];
	genreNames: string[];
	decade: number | null;
	minRating: number | null;
	type: "movie" | "tv";
}

export interface DiscoverSheetHooks {
	/** Called after any change, so the shelves behind the sheet re-narrow. */
	onChange: () => void;
	/** Switch between films and series. Clears the genre, which is per-endpoint. */
	setType: (type: "movie" | "tv") => void;
	/** The genres on offer for the current type. May still be loading. */
	genres: () => { id: number; name: string }[];
	/** "Something like…": the title picked as a seed, if any. */
	seedTitle: () => string | null;
	pickSeed: (done: () => void) => void;
	clearSeed: () => void;
	clearAll: () => void;
}

export class DiscoverFilterSheet extends Modal {
	private body!: HTMLElement;

	constructor(
		app: App,
		private filters: DiscoverFilters,
		private hooks: DiscoverSheetHooks
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		modalEl.addClass("reel-filter-sheet");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		contentEl.addClass("reel-filter-content");
		const head = contentEl.createDiv({ cls: "reel-filter-head" });
		head.createEl("h3", { cls: "reel-log-title", text: "Filters" });

		this.body = contentEl.createDiv({ cls: "reel-filter-body" });
		this.redraw();

		const foot = contentEl.createDiv({ cls: "reel-log-actions reel-filter-actions" });
		const clear = foot.createEl("button", { cls: "reel-btn reel-filter-clear", text: "Clear all", attr: { type: "button" } });
		clear.addEventListener("click", () => {
			this.hooks.clearAll();
			this.redraw();
		});
		const done = foot.createEl("button", { cls: "reel-btn mod-cta reel-filter-done", attr: { type: "button" } });
		done.createSpan({ text: "Show results" });
		done.addEventListener("click", () => this.close());
	}

	/** Called when the genre list arrives after the sheet is already open. */
	refresh(): void {
		if (this.body?.isConnected) this.redraw();
	}

	private redraw(): void {
		const el = this.body;
		const keep = el.scrollTop;
		el.empty();

		const section = (label: string, asOptions = false): HTMLElement => {
			const box = el.createDiv({ cls: "reel-filter-section" });
			box.createDiv({ cls: "reel-filter-label", text: label });
			return box.createDiv({ cls: asOptions ? "reel-opts" : "reel-chips reel-filter-chips" });
		};

		const pick = (into: HTMLElement, label: string, active: boolean, onClick: () => void): HTMLElement => {
			const b = into.createEl("button", { cls: into.hasClass("reel-opts") ? "reel-opt" : "reel-chip", attr: { type: "button" } });
			if (b.hasClass("reel-opt")) {
				b.createSpan({ cls: "reel-opt-mark" });
				b.createSpan({ cls: "reel-opt-label", text: label });
			} else b.setText(label);
			setSelected(b, active);
			b.addEventListener("click", () => {
				onClick();
				this.hooks.onChange();
				this.redraw();
			});
			return b;
		};

		const kinds = section("Type", true);
		pick(kinds, "Films", this.filters.type === "movie", () => this.hooks.setType("movie"));
		pick(kinds, "Series", this.filters.type === "tv", () => this.hooks.setType("tv"));

		const like = section("Similar to");
		const seed = this.hooks.seedTitle();
		if (seed) pick(like, `${seed}  ✕`, true, () => this.hooks.clearSeed());
		else {
			const b = like.createEl("button", { cls: "reel-chip", text: "Pick a title…", attr: { type: "button" } });
			b.addEventListener("click", () => {
				this.hooks.pickSeed(() => {
					this.hooks.onChange();
					this.redraw();
				});
			});
		}

		const genres = this.hooks.genres();
		const gbox = section("Genre");
		if (!genres.length) gbox.createSpan({ cls: "reel-dim", text: "Loading…" });
		for (const g of genres) {
			// Several at once: Action and Comedy together means action comedies.
			pick(gbox, g.name, this.filters.genreIds.includes(g.id), () => {
				const at = this.filters.genreIds.indexOf(g.id);
				if (at >= 0) {
					this.filters.genreIds.splice(at, 1);
					this.filters.genreNames.splice(at, 1);
				} else {
					this.filters.genreIds.push(g.id);
					this.filters.genreNames.push(g.name);
				}
			});
		}
		this.fold(gbox, 8);

		const decades = section("Decade", true);
		const nowDecade = Math.floor(new Date().getFullYear() / 10) * 10;
		for (let d = nowDecade; d >= 1950; d -= 10) {
			pick(decades, `${d}s`, this.filters.decade === d, () => {
				this.filters.decade = this.filters.decade === d ? null : d;
			});
		}
		this.fold(decades, 6);

		const score = section("Minimum score");
		for (const r of [6, 7, 8]) {
			pick(score, `${r}+`, this.filters.minRating === r, () => {
				this.filters.minRating = this.filters.minRating === r ? null : r;
			});
		}

		el.scrollTop = keep;
	}

	/** Long groups show their first few, the rest behind one button. */
	private fold(group: HTMLElement, limit: number): void {
		const all = Array.from(group.children) as HTMLElement[];
		const hidden = all.slice(limit).filter((c) => !c.hasClass("is-active"));
		if (!hidden.length) return;
		hidden.forEach((c) => c.addClass("is-folded"));
		const more = group.parentElement?.createEl("button", {
			cls: "reel-filter-more",
			text: `Show ${hidden.length} more`,
			attr: { type: "button", "aria-expanded": "false" },
		});
		more?.addEventListener("click", () => {
			const open = more.getAttr("aria-expanded") !== "true";
			hidden.forEach((c) => c.toggleClass("is-folded", !open));
			more.setAttr("aria-expanded", String(open));
			more.setText(open ? "Show less" : `Show ${hidden.length} more`);
		});
	}
}
