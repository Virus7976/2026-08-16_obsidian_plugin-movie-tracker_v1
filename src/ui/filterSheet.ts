/**
 * Every filter, in one sheet.
 *
 * The filter bar used to be the whole set laid out flat: type chips, then a
 * status row, then up to fourteen genres, then every list, then two sort
 * dropdowns. On a phone that is a stack taller than the screen, and the answer
 * shipped for it was to hide the lot the moment you typed a search — which is
 * how the library came to have no filtering at all. Deleting the controls was
 * never the fix; the fix is that a control you are not currently setting does
 * not need to be on screen.
 *
 * So the bar keeps only what is *true right now* — the filters you have
 * actually set, as chips you can tap to remove — and everything else lives
 * behind one button. That is a row and a half instead of six rows, and nothing
 * had to be taken away to get there.
 */

import { App, Modal, Platform } from "obsidian";
import type { Entry } from "../types";
import { setSelected } from "./a11y";

/**
 * What the library is currently narrowed to.
 *
 * One object rather than six fields on the view, because these now travel
 * between tabs: "Films, sci-fi, four stars and up" means the same thing in the
 * Diary as it does in the Library, and it used to be re-asked on each screen.
 */
export interface FilterState {
	type: "all" | "film" | "tv";
	status: string | null;
	genre: string | null;
	list: string | null;
	sort: string;
	/** Applied where the primary ties. Empty means no tiebreaker. */
	sort2: string;
}

export function emptyFilters(): FilterState {
	return { type: "all", status: null, genre: null, list: null, sort: "watched", sort2: "" };
}

/** Everything set by hand, ignoring sort — sort is always *something*. */
export function activeFilters(f: FilterState): { key: keyof FilterState; label: string }[] {
	const out: { key: keyof FilterState; label: string }[] = [];
	if (f.type !== "all") out.push({ key: "type", label: f.type === "film" ? "Films" : "Series" });
	if (f.status) out.push({ key: "status", label: f.status });
	if (f.genre) out.push({ key: "genre", label: f.genre });
	if (f.list) out.push({ key: "list", label: `☰ ${f.list}` });
	return out;
}

export function clearFilter(f: FilterState, key: keyof FilterState): void {
	if (key === "type") f.type = "all";
	else if (key === "status") f.status = null;
	else if (key === "genre") f.genre = null;
	else if (key === "list") f.list = null;
}

/** Apply the shared filters to a pool. Sorting stays with the caller. */
export function narrow(rows: Entry[], f: FilterState): Entry[] {
	let out = rows;
	if (f.type !== "all") out = out.filter((e) => e.type === f.type);
	if (f.status) {
		/*
		 * "Watched" means you have seen it, which is a fact about your history
		 * — not a label a later intent can overwrite. Putting a film you have
		 * already seen back on the watchlist sets `status` to "watchlist", and
		 * filtering the raw field then dropped it out of "watched" entirely, so
		 * the app appeared to forget you had ever seen it.
		 */
		out = out.filter((e) =>
			f.status === "watched" && e.type !== "tv" ? e.watched.length > 0 : e.status === f.status
		);
	}
	if (f.genre) out = out.filter((e) => e.genres.includes(f.genre as string));
	if (f.list) out = out.filter((e) => e.lists.includes(f.list as string));
	return out;
}

export const SORT_OPTIONS: [string, string][] = [
	["watched", "Recently watched"],
	["added", "Recently added"],
	["rating", "My rating"],
	["imdb_rating", "IMDb rating"],
	["metacritic", "Metacritic"],
	["tmdb_rating", "TMDB rating"],
	["title", "Title"],
	["year", "Year"],
	["runtime", "Runtime"],
	["popularity", "Popularity"],
	["certification", "Certification"],
	["random", "Shuffle"],
];

interface Options {
	/** The pool the chips are built from, so no chip returns nothing. */
	pool: Entry[];
	lists: string[];
	/** Sorting is meaningless on the Diary and Stats, so those tabs hide it. */
	showSort: boolean;
	onChange: () => void;
}

/**
 * The sheet.
 *
 * Every option is drawn, at full height, with room to read it — the opposite
 * trade to the bar, and the right one for a surface you opened deliberately.
 * Changes apply as you make them rather than on a Done button: you are looking
 * at a list, and the point of a filter is to watch it narrow.
 */
export class FilterSheet extends Modal {
	private body!: HTMLElement;

	constructor(
		app: App,
		private filters: FilterState,
		private opts: Options
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		modalEl.addClass("reel-filter-sheet");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		const head = contentEl.createDiv({ cls: "reel-filter-head" });
		head.createEl("h3", { cls: "reel-log-title", text: "Filters" });
		const clear = head.createEl("button", { cls: "reel-btn reel-filter-clear", text: "Clear all" });
		clear.addEventListener("click", () => {
			const { sort, sort2 } = this.filters;
			Object.assign(this.filters, emptyFilters(), { sort, sort2 });
			this.opts.onChange();
			this.redraw();
		});

		this.body = contentEl.createDiv({ cls: "reel-filter-body" });
		this.redraw();
	}

	private redraw(): void {
		const el = this.body;
		el.empty();

		const section = (label: string): HTMLElement => {
			const box = el.createDiv({ cls: "reel-filter-section" });
			box.createDiv({ cls: "reel-filter-label", text: label });
			return box.createDiv({ cls: "reel-chips reel-filter-chips" });
		};

		const chip = (into: HTMLElement, label: string, active: boolean, onClick: () => void): void => {
			const b = into.createEl("button", { cls: "reel-chip", text: label, attr: { type: "button" } });
			setSelected(b, active);
			b.addEventListener("click", () => {
				onClick();
				this.opts.onChange();
				// Which genres are on offer depends on what is already set, so
				// the sheet has to restate itself.
				this.redraw();
			});
		};

		const kinds = section("Type");
		for (const [value, label] of [
			["all", "Everything"],
			["film", "Films"],
			["tv", "Series"],
		] as const) {
			chip(kinds, label, this.filters.type === value, () => (this.filters.type = value));
		}

		// Built from the pool as it stands *after* the other filters, so a chip
		// is never offered that would empty the screen.
		const pool = narrow(this.opts.pool, { ...this.filters, status: null, genre: null, list: null });

		const statuses = [...new Set(pool.map((e) => e.status))].filter(Boolean).sort();
		if (statuses.length > 1) {
			const row = section("Status");
			for (const s of statuses) {
				chip(row, s, this.filters.status === s, () => {
					this.filters.status = this.filters.status === s ? null : s;
				});
			}
		}

		const genres = [...new Set(pool.flatMap((e) => e.genres))].filter(Boolean).sort();
		if (genres.length > 1) {
			const row = section("Genre");
			// Every genre, not the first fourteen. The cap existed because the
			// bar was one line; a sheet scrolls.
			for (const g of genres) {
				chip(row, g, this.filters.genre === g, () => {
					this.filters.genre = this.filters.genre === g ? null : g;
				});
			}
		}

		if (this.opts.lists.length) {
			const row = section("Lists");
			for (const name of this.opts.lists) {
				chip(row, name, this.filters.list === name, () => {
					this.filters.list = this.filters.list === name ? null : name;
				});
			}
		}

		if (!this.opts.showSort) return;

		const sortBox = el.createDiv({ cls: "reel-filter-section" });
		sortBox.createDiv({ cls: "reel-filter-label", text: "Sort" });
		const first = sortBox.createEl("select", { cls: "reel-select dropdown" });
		for (const [value, label] of SORT_OPTIONS) first.createEl("option", { value, text: label });
		first.value = this.filters.sort;
		first.addEventListener("change", () => {
			this.filters.sort = first.value;
			this.opts.onChange();
			this.redraw();
		});

		// "Highest rated, and among equals the most recent" is a real question
		// a single sort cannot answer.
		sortBox.createDiv({ cls: "reel-filter-label", text: "Then by" });
		const second = sortBox.createEl("select", { cls: "reel-select dropdown" });
		second.createEl("option", { value: "", text: "—" });
		for (const [value, label] of SORT_OPTIONS) {
			if (value === this.filters.sort || value === "random") continue;
			second.createEl("option", { value, text: label });
		}
		second.value = this.filters.sort2;
		second.addEventListener("change", () => {
			this.filters.sort2 = second.value;
			this.opts.onChange();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
