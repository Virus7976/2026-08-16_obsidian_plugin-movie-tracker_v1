/**
 * The Reel view — a real tab, not a code block you have to go and find.
 *
 * This is the answer to "make it better on mobile". A code block lives inside
 * some note; to reach it you have to remember which note, open it, and scroll.
 * A registered view opens from the ribbon in one tap and holds its own state:
 * a search box, filter chips, and four sections that keep their scroll position
 * as you move between them.
 */

import { ItemView, Platform, WorkspaceLeaf, setIcon } from "obsidian";
import type ReelPlugin from "./main";
import type { Entry } from "./types";
import { renderPosterGrid, renderRowList } from "./render/grid";
import { paintUpNext } from "./render/upnext";
import { paintStats } from "./render/stats";
import { viewings } from "./render/diary";
import { sortEntries } from "./render/query";
import { prettyDate } from "./util/dates";
import { renderStarsStatic } from "./ui/stars";
import { TFile } from "obsidian";

export const REEL_VIEW = "reel-view";

type Tab = "library" | "upnext" | "diary" | "stats";

const TABS: { id: Tab; label: string; icon: string }[] = [
	{ id: "library", label: "Library", icon: "layout-grid" },
	{ id: "upnext", label: "Up next", icon: "play" },
	{ id: "diary", label: "Diary", icon: "calendar-days" },
	{ id: "stats", label: "Stats", icon: "bar-chart-3" },
];

export class ReelView extends ItemView {
	private tab: Tab = "library";
	private query = "";
	private typeFilter: "all" | "film" | "tv" = "all";
	private statusFilter: string | null = null;
	private genreFilter: string | null = null;
	private sort = "watched";
	private bodyEl!: HTMLElement;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ReelPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return REEL_VIEW;
	}

	getDisplayText(): string {
		return "Reel";
	}

	getIcon(): string {
		return "reel";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("reel-view");
		this.build();
		this.registerEvent(this.plugin.library.on("changed", () => this.paint()));
	}

	private build(): void {
		const root = this.contentEl;

		/* ---- header: search + add ------------------------------------ */
		const header = root.createDiv({ cls: "reel-view-header" });

		const searchWrap = header.createDiv({ cls: "reel-search-wrap" });
		setIcon(searchWrap.createSpan({ cls: "reel-search-icon" }), "search");
		const search = searchWrap.createEl("input", {
			cls: "reel-input reel-search-input",
			attr: {
				type: "search",
				placeholder: "Search title, director, cast…",
				enterkeyhint: "search",
				autocapitalize: "off",
				autocorrect: "off",
			},
		});
		// No debounce: the index is in memory and the haystack is prebuilt, so
		// filtering runs in well under a frame even at a few thousand titles.
		search.addEventListener("input", () => {
			this.query = search.value;
			this.paint();
		});
		const clear = searchWrap.createEl("button", { cls: "reel-search-clear", text: "×" });
		clear.addEventListener("click", () => {
			search.value = "";
			this.query = "";
			this.paint();
			search.focus();
		});

		const add = header.createEl("button", { cls: "reel-btn mod-cta reel-add-btn" });
		setIcon(add.createSpan(), "plus");
		add.createSpan({ text: Platform.isPhone ? "" : "Log" });
		add.setAttr("aria-label", "Log a film or series");
		add.addEventListener("click", () => this.plugin.openSearch());

		/* ---- tabs ----------------------------------------------------- */
		const tabBar = root.createDiv({ cls: "reel-tabs" });
		for (const t of TABS) {
			const btn = tabBar.createEl("button", { cls: "reel-tab" });
			setIcon(btn.createSpan({ cls: "reel-tab-icon" }), t.icon);
			btn.createSpan({ cls: "reel-tab-label", text: t.label });
			btn.addEventListener("click", () => {
				this.tab = t.id;
				this.paint();
			});
			btn.dataset.tab = t.id;
		}

		this.filterEl = root.createDiv({ cls: "reel-view-filters" });
		this.bodyEl = root.createDiv({ cls: "reel-view-body" });
		this.paint();
	}

	private filterEl!: HTMLElement;

	private paint(): void {
		this.contentEl.findAll(".reel-tab").forEach((el) => {
			el.toggleClass("is-active", (el as HTMLElement).dataset.tab === this.tab);
		});

		this.filterEl.empty();
		this.bodyEl.empty();

		if (this.tab === "library") {
			this.paintFilters();
			this.paintLibrary();
		} else if (this.tab === "upnext") {
			paintUpNext(this.plugin, this.bodyEl);
		} else if (this.tab === "diary") {
			this.paintDiary();
		} else {
			paintStats(this.plugin, this.bodyEl, { include: "all" });
		}
	}

	/* ---------------------------------------------------------------- */

	private paintFilters(): void {
		const bar = this.filterEl.createDiv({ cls: "reel-chips" });

		const chip = (label: string, active: boolean, onClick: () => void) => {
			const b = bar.createEl("button", { cls: "reel-chip", text: label });
			b.toggleClass("is-active", active);
			b.addEventListener("click", () => {
				onClick();
				this.paint();
			});
		};

		chip("All", this.typeFilter === "all", () => (this.typeFilter = "all"));
		chip("Films", this.typeFilter === "film", () => (this.typeFilter = "film"));
		chip("Series", this.typeFilter === "tv", () => (this.typeFilter = "tv"));

		bar.createSpan({ cls: "reel-chip-sep", text: "·" });

		const pool = this.pool();
		for (const status of [...new Set(pool.map((e) => e.status))].sort()) {
			chip(status, this.statusFilter === status, () => {
				this.statusFilter = this.statusFilter === status ? null : status;
			});
		}

		const genres = [...new Set(pool.flatMap((e) => e.genres))].sort();
		if (genres.length > 1) {
			bar.createSpan({ cls: "reel-chip-sep", text: "·" });
			for (const g of genres.slice(0, 14)) {
				chip(g, this.genreFilter === g, () => {
					this.genreFilter = this.genreFilter === g ? null : g;
				});
			}
		}

		const sortBar = this.filterEl.createDiv({ cls: "reel-sortbar" });
		sortBar.createSpan({ cls: "reel-dim", text: "Sort" });
		const select = sortBar.createEl("select", { cls: "reel-select" });
		for (const [value, label] of [
			["watched", "Recently watched"],
			["added", "Recently added"],
			["rating", "My rating"],
			["tmdb_rating", "TMDB rating"],
			["title", "Title"],
			["year", "Year"],
			["runtime", "Runtime"],
			["random", "Shuffle"],
		]) {
			select.createEl("option", { value, text: label });
		}
		select.value = this.sort;
		select.addEventListener("change", () => {
			this.sort = select.value;
			this.paint();
		});
	}

	/** Everything visible under the content policy, before UI filters. */
	private pool(): Entry[] {
		return this.plugin.visible(this.plugin.library.all());
	}

	private paintLibrary(): void {
		let rows = this.pool();
		if (this.typeFilter !== "all") rows = rows.filter((e) => e.type === this.typeFilter);
		if (this.statusFilter) rows = rows.filter((e) => e.status === this.statusFilter);
		if (this.genreFilter) rows = rows.filter((e) => e.genres.includes(this.genreFilter!));
		rows = this.plugin.library.search(this.query, rows);
		rows = sortEntries(rows, this.sort, this.sort === "title" || this.sort === "year" ? 1 : -1);

		const hiddenCount = this.plugin.hiddenCount();
		const count = this.bodyEl.createDiv({ cls: "reel-block-count" });
		count.setText(`${rows.length} title${rows.length === 1 ? "" : "s"}`);
		if (hiddenCount) {
			// Say so explicitly — a filtered-down library that doesn't explain
			// itself just looks like missing data.
			count.createSpan({
				cls: "reel-dim",
				text: ` · ${hiddenCount} hidden by content filter`,
			});
		}

		if (!rows.length) {
			this.bodyEl.createDiv({
				cls: "reel-empty",
				text: this.query ? `Nothing matches "${this.query}".` : "Nothing here yet. Tap Log to add something.",
			});
			return;
		}

		renderPosterGrid(this.plugin, this.bodyEl, rows);
	}

	private paintDiary(): void {
		const rows = viewings(this.plugin.library.search(this.query, this.pool()));
		if (!rows.length) {
			this.bodyEl.createDiv({ cls: "reel-empty", text: "No viewings logged yet." });
			return;
		}

		const list = this.bodyEl.createDiv({ cls: "reel-diary" });
		const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		let currentMonth = "";

		for (const v of rows.slice(0, 400)) {
			const month = v.date.slice(0, 7);
			if (month !== currentMonth) {
				currentMonth = month;
				const [y, m] = month.split("-");
				list.createDiv({ cls: "reel-diary-month", text: `${months[parseInt(m, 10) - 1]} ${y}` });
			}

			const row = list.createDiv({ cls: "reel-diary-row" });
			row.createDiv({ cls: "reel-diary-day", text: String(parseInt(v.date.slice(8, 10), 10)) });

			const thumb = row.createDiv({ cls: "reel-diary-thumb" });
			const src = this.plugin.posters.resourcePath(v.entry.poster);
			if (src) thumb.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
			else {
				thumb.addClass("is-empty");
				thumb.createSpan({ text: v.entry.title.slice(0, 2) });
			}

			const body = row.createDiv({ cls: "reel-diary-body" });
			body.createDiv({ cls: "reel-diary-title", text: v.entry.title });
			const meta = body.createDiv({ cls: "reel-diary-meta" });
			if (v.rating != null) renderStarsStatic(meta, v.rating);
			if (v.rewatch) meta.createSpan({ cls: "reel-badge subtle", text: "rewatch" });
			meta.createSpan({ cls: "reel-dim", text: prettyDate(v.date) });

			row.addEventListener("click", async () => {
				const file = this.plugin.app.vault.getAbstractFileByPath(v.entry.path);
				if (file instanceof TFile) await this.plugin.app.workspace.getLeaf(false).openFile(file);
			});
		}
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}
}

/** Unused import guard — `renderRowList` is kept for the compact layout. */
void renderRowList;
