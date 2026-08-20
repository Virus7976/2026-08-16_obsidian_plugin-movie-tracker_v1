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
	/*
	 * Sets, not single values.
	 *
	 * These were one string each, so choosing Comedy after Action replaced
	 * Action — the sheet looked like a set of toggles and behaved like a radio
	 * group, with nothing on screen to say so. "I can't select all I want" is
	 * the exact symptom of a control whose appearance promises more than its
	 * type allows.
	 *
	 * Within a set the test is *any* — action or comedy. Across sets it is
	 * *all* — a comedy, on the watchlist, in a list. That is what a person
	 * means when they tick several boxes in one group and one in another, and
	 * it is the only combination that does not collapse to nothing.
	 */
	genres: string[];
	statuses: string[];
	lists: string[];
	sort: string;
	/** Applied where the primary ties. Empty means no tiebreaker. */
	sort2: string;
	/**
	 * How much of the library fits on one screen.
	 *
	 * Two posters per row with a caption under each is a good way to look at six
	 * films and a bad way to look at sixty-six — you scroll past your own library
	 * without ever seeing it. Dense drops the captions and the padding and fits
	 * five to a row; list trades the art for a scannable column.
	 */
	layout: LibraryLayout;
}

export type LibraryLayout = "grid" | "dense" | "list";

export const LAYOUTS: { id: LibraryLayout; label: string; icon: string }[] = [
	{ id: "grid", label: "Posters", icon: "layout-grid" },
	{ id: "dense", label: "Dense", icon: "grip" },
	{ id: "list", label: "List", icon: "list" },
];

export function emptyFilters(): FilterState {
	return { type: "all", genres: [], statuses: [], lists: [], sort: "watched", sort2: "", layout: "grid" };
}

/** Add or remove one value from a set, in place. */
function toggle(set: string[], value: string): void {
	const at = set.indexOf(value);
	if (at >= 0) set.splice(at, 1);
	else set.push(value);
}

export interface ActiveFilter {
	key: keyof FilterState;
	label: string;
	/** The member of the set this chip stands for, for the multi-select keys. */
	value?: string;
}

/**
 * Everything set by hand, ignoring sort — sort is always *something*.
 *
 * One entry per *value*, not per category, so the bar can offer each one its
 * own x. With three genres set, a single "Genre" chip would make removing the
 * middle one impossible without clearing all three and starting again.
 */
export function activeFilters(f: FilterState): ActiveFilter[] {
	const out: ActiveFilter[] = [];
	if (f.type !== "all") out.push({ key: "type", label: f.type === "film" ? "Films" : "Series" });
	for (const s of f.statuses) out.push({ key: "statuses", label: s, value: s });
	for (const g of f.genres) out.push({ key: "genres", label: g, value: g });
	for (const l of f.lists) out.push({ key: "lists", label: `☰ ${l}`, value: l });
	return out;
}

export function clearFilter(f: FilterState, key: keyof FilterState, value?: string): void {
	if (key === "type") f.type = "all";
	else if (key === "statuses") f.statuses = value ? f.statuses.filter((v) => v !== value) : [];
	else if (key === "genres") f.genres = value ? f.genres.filter((v) => v !== value) : [];
	else if (key === "lists") f.lists = value ? f.lists.filter((v) => v !== value) : [];
}

/** Apply the shared filters to a pool. Sorting stays with the caller. */
export function narrow(rows: Entry[], f: FilterState): Entry[] {
	let out = rows;
	if (f.type !== "all") out = out.filter((e) => e.type === f.type);
	if (f.statuses.length) {
		/*
		 * "Watched" means you have seen it, which is a fact about your history
		 * — not a label a later intent can overwrite. Putting a film you have
		 * already seen back on the watchlist sets `status` to "watchlist", and
		 * filtering the raw field then dropped it out of "watched" entirely, so
		 * the app appeared to forget you had ever seen it.
		 *
		 * That reasoning is right and the code got it backwards: it *replaced*
		 * the status test with the dates test instead of adding to it. So a
		 * film marked watched but carrying no logged dates — an import, or
		 * anything ticked off without a date — matched neither branch and
		 * vanished from its own filter. Selecting watched, watching and
		 * completed then returned far fewer titles than the library holds,
		 * with no way to tell which ones had gone or why.
		 *
		 * Either signal counts. A date proves it; the label claims it; both
		 * mean you have seen it.
		 */
		out = out.filter((e) =>
			f.statuses.some((s) =>
				s === "watched" && e.type !== "tv" ? e.watched.length > 0 || e.status === "watched" : e.status === s
			)
		);
	}
	if (f.genres.length) out = out.filter((e) => f.genres.some((g) => e.genres.includes(g)));
	if (f.lists.length) out = out.filter((e) => f.lists.some((l) => e.lists.includes(l)));
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
 *
 * Three things had made that untrue in practice.
 *
 * Each section was single-select, so a second genre replaced the first.
 *
 * Every tap called `redraw()`, which emptied the body and rebuilt it. That
 * threw away the scroll position, so choosing a genre — which is two thirds of
 * the way down — bounced the sheet back to the top and you had to find your
 * place again for the next one. Nothing about picking a genre changes which
 * genres are on offer, so almost every one of those rebuilds was avoidable;
 * only Type changes what the other sections contain.
 *
 * And there was no foot: no count, and nothing to press when you were done, so
 * the only way out was the x in the corner, which reads as "cancel".
 */
export class FilterSheet extends Modal {
	private body!: HTMLElement;
	private countEl: HTMLElement | null = null;

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
			const { sort, sort2, layout } = this.filters;
			Object.assign(this.filters, emptyFilters(), { sort, sort2, layout });
			this.opts.onChange();
			this.redraw();
		});

		this.body = contentEl.createDiv({ cls: "reel-filter-body" });
		this.redraw();

		/*
		 * The foot: what you are about to get, and the way out.
		 *
		 * `reel-log-actions` as well as its own class, so it inherits the
		 * sticky treatment every other sheet foot uses — including reaching the
		 * bottom of the sheet rather than floating above the strip reserved for
		 * Obsidian's + button.
		 *
		 * The count is the honest part. Narrowing to nothing is easy to do by
		 * accident with several sets active, and "Show 0 titles" says so while
		 * you can still fix it, rather than after the sheet has closed over an
		 * empty screen.
		 */
		const foot = contentEl.createDiv({ cls: "reel-log-actions reel-filter-actions" });
		const done = foot.createEl("button", { cls: "reel-btn mod-cta reel-filter-done" });
		this.countEl = done.createSpan();
		done.addEventListener("click", () => this.close());
		this.paintCount();
	}

	/** How many titles the current set would show. */
	private paintCount(): void {
		if (!this.countEl) return;
		const n = narrow(this.opts.pool, this.filters).length;
		this.countEl.setText(n === 1 ? "Show 1 title" : `Show ${n} titles`);
	}

	/**
	 * Rebuild the body, keeping your place in it.
	 *
	 * Called only when the offered chips could actually have changed — Type,
	 * and Clear all. Everything else toggles in place.
	 */
	private redraw(): void {
		const el = this.body;
		const keepScroll = el.scrollTop;
		el.empty();

		const section = (label: string): HTMLElement => {
			const box = el.createDiv({ cls: "reel-filter-section" });
			box.createDiv({ cls: "reel-filter-label", text: label });
			return box.createDiv({ cls: "reel-chips reel-filter-chips" });
		};

		/** A chip that switches one of several exclusive values. */
		const one = (into: HTMLElement, label: string, active: boolean, onClick: () => void): void => {
			const b = into.createEl("button", { cls: "reel-chip", text: label, attr: { type: "button" } });
			setSelected(b, active);
			b.addEventListener("click", () => {
				onClick();
				this.opts.onChange();
				this.redraw();
			});
		};

		/**
		 * A chip that ticks on and off, and does not disturb anything else.
		 *
		 * No redraw: the chip repaints itself, the count updates, the library
		 * behind the sheet re-narrows, and the sheet stays exactly where you
		 * left it. That is the difference between ticking four genres in four
		 * taps and ticking one, scrolling back down, ticking another.
		 */
		const many = (into: HTMLElement, label: string, set: string[], value: string): void => {
			const b = into.createEl("button", { cls: "reel-chip", text: label, attr: { type: "button" } });
			setSelected(b, set.includes(value));
			b.addEventListener("click", () => {
				toggle(set, value);
				setSelected(b, set.includes(value));
				this.opts.onChange();
				this.paintCount();
			});
		};

		const kinds = section("Type");
		for (const [value, label] of [
			["all", "Everything"],
			["film", "Films"],
			["tv", "Series"],
		] as const) {
			one(kinds, label, this.filters.type === value, () => (this.filters.type = value));
		}

		// Built from the pool as it stands *after* Type, so a chip is never
		// offered that would empty the screen. The other sets are excluded
		// deliberately: which genres exist does not depend on which genres you
		// have ticked, and rebuilding the list from the narrowed pool would
		// make chips vanish from under your thumb as you used them.
		const pool = narrow(this.opts.pool, { ...this.filters, statuses: [], genres: [], lists: [] });

		const statuses = [...new Set(pool.map((e) => e.status))].filter(Boolean).sort();
		if (statuses.length > 1) {
			const row = section("Status");
			for (const s of statuses) many(row, s, this.filters.statuses, s);
		}

		const genres = [...new Set(pool.flatMap((e) => e.genres))].filter(Boolean).sort();
		if (genres.length > 1) {
			const row = section("Genre");
			// Every genre, not the first fourteen. The cap existed because the
			// bar was one line; a sheet scrolls.
			for (const g of genres) many(row, g, this.filters.genres, g);
		}

		if (this.opts.lists.length) {
			const row = section("Lists");
			for (const name of this.opts.lists) many(row, name, this.filters.lists, name);
		}

		if (this.opts.showSort) {
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

			// "Highest rated, and among equals the most recent" is a real
			// question a single sort cannot answer.
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

		el.scrollTop = keepScroll;
		this.paintCount();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
