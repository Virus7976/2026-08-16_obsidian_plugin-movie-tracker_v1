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
import { DetailScreen } from "./ui/detail";
import { RateScreen } from "./ui/rate";
import { DiscoverScreen } from "./ui/discoverView";
import { paintUpNext } from "./render/upnext";
import { paintUpcoming } from "./render/calendar";
import { paintStats } from "./render/stats";
import { viewings } from "./render/diary";
import { sortEntries } from "./render/query";
import { prettyDate } from "./util/dates";
import { redact } from "./secrets";
import { renderStarsStatic } from "./ui/stars";

export const REEL_VIEW = "reel-view";

type Tab = "library" | "discover" | "rate" | "upnext" | "diary" | "stats";

const TABS: { id: Tab; label: string; icon: string }[] = [
	{ id: "library", label: "Library", icon: "layout-grid" },
	{ id: "discover", label: "Discover", icon: "compass" },
	{ id: "rate", label: "Rate", icon: "star" },
	{ id: "upnext", label: "Up next", icon: "play" },
	{ id: "diary", label: "Diary", icon: "calendar-days" },
	{ id: "stats", label: "Stats", icon: "bar-chart-3" },
];

const SORT_OPTIONS: [string, string][] = [
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

/**
 * Which direction reads as "natural" for a field. Titles and years want A–Z
 * and oldest-first; ratings and dates want best and newest first. Guessing
 * this correctly matters more than exposing an asc/desc toggle nobody touches.
 */
function ascending(field: string): 1 | -1 {
	return field === "title" || field === "year" || field === "certification" ? 1 : -1;
}

export class ReelView extends ItemView {
	private tab: Tab = "library";
	private query = "";
	private typeFilter: "all" | "film" | "tv" = "all";
	private statusFilter: string | null = null;
	private genreFilter: string | null = null;
	private listFilter: string | null = null;
	private diaryYear: number | null = null;
	private statsScope: "all" | "film" | "tv" = "all";
	private sort = "watched";
	/** Secondary sort, applied when the primary ties. */
	private sort2 = "";
	private bodyEl!: HTMLElement;
	/** Non-null when the detail screen is showing instead of the list. */
	private detail: DetailScreen | null = null;
	/** Kept across repaints so the queue position and skips survive. */
	private rateScreen: RateScreen | null = null;
	/** Kept across repaints so rows aren't refetched on every tab switch. */
	private discoverScreen: DiscoverScreen | null = null;

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
		// Reopen where you left off — closing the view to check a note and
		// coming back to the Library tab instead of Stats is a small, constant
		// annoyance.
		const saved = this.plugin.settings.lastTab as Tab;
		if (TABS.some((t) => t.id === saved)) this.tab = saved;

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
				placeholder: "Search titles, people, characters, plots…",
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
				this.plugin.settings.lastTab = t.id;
				void this.plugin.saveSettings();
				this.paint();
			});
			btn.dataset.tab = t.id;
		}

		this.filterEl = root.createDiv({ cls: "reel-view-filters" });
		this.bodyEl = root.createDiv({ cls: "reel-view-body" });
		this.paint();
	}

	private filterEl!: HTMLElement;

	/**
	 * Switch tabs from outside the view.
	 *
	 * Not onOpen(): that registers the library listener, so calling it again
	 * stacks a second one that lives until the view unloads. Five uses of the
	 * per-tab commands and every change would repaint six times.
	 */
	showTab(tab: string): void {
		if (!TABS.some((t) => t.id === tab)) return;
		this.tab = tab as Tab;
		this.detail = null;
		// Persisted here rather than by the caller, so every route into a tab
		// remembers it — a command, a click, or anything added later.
		this.plugin.settings.lastTab = tab;
		void this.plugin.saveSettings();
		this.paint();
	}

	private paint(): void {
		this.contentEl.findAll(".reel-tab").forEach((el) => {
			el.toggleClass("is-active", el.dataset.tab === this.tab);
		});

		this.filterEl.empty();
		this.bodyEl.empty();
		// Tabs that add no filters would otherwise leave an empty bar taking
		// up vertical space above the content.
		this.filterEl.toggleClass("is-empty", true);

		if (this.detail) {
			// Repaints are driven by the library 'changed' event, which fires
			// once metadataCache has reparsed the file — so this is the moment
			// a re-read is guaranteed to return what was just written.
			this.detail.syncFromIndex();
			this.detail.render(this.bodyEl);
			return;
		}

		try {
			this.paintTab();
		} catch (e) {
			// A thrown paint used to leave an empty pane with no explanation.
			// Showing the error keeps the rest of the view usable and tells you
			// which tab is broken.
			this.bodyEl.createDiv({ cls: "reel-error", text: redact(e) });
		}
	}

	private paintTab(): void {
		if (this.tab === "library") {
			this.paintFilters();
			this.paintLibrary();
		} else if (this.tab === "discover") {
			if (!this.discoverScreen) this.discoverScreen = new DiscoverScreen(this.plugin);
			this.discoverScreen.render(this.bodyEl);
		} else if (this.tab === "rate") {
			if (!this.rateScreen) this.rateScreen = new RateScreen(this.plugin);
			this.rateScreen.render(this.bodyEl);
		} else if (this.tab === "upnext") {
			paintUpNext(this.plugin, this.bodyEl);
			// Upcoming lives here rather than in its own tab: "what am I part
			// way through" and "what's about to air" are the same question.
			paintUpcoming(this.plugin, this.bodyEl.createDiv({ cls: "reel-upcoming-section" }));
		} else if (this.tab === "diary") {
			this.paintDiary();
		} else {
			// Films and shows answer different questions — hours of film and
			// episodes watched aren't comparable — so the tab can scope like
			// the code block always could.
			this.filterEl.removeClass("is-empty");
			const bar = this.filterEl.createDiv({ cls: "reel-chips" });
			for (const [scope, label] of [
				["all", "Everything"],
				["film", "Films"],
				["tv", "Series"],
			] as const) {
				const b = bar.createEl("button", { cls: "reel-chip", text: label });
				b.toggleClass("is-active", this.statsScope === scope);
				b.addEventListener("click", () => {
					this.statsScope = scope;
					this.paint();
				});
			}
			paintStats(this.plugin, this.bodyEl, { include: this.statsScope });
		}
	}

	/* ---------------------------------------------------------------- */

	private paintFilters(): void {
		this.filterEl.removeClass("is-empty");
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

		// Until now a title could be added to a list and then never seen
		// again — there was nowhere that showed one.
		const lists = this.plugin.library.lists();
		if (lists.length) {
			bar.createSpan({ cls: "reel-chip-sep", text: "·" });
			for (const name of lists) {
				chip(`☰ ${name}`, this.listFilter === name, () => {
					this.listFilter = this.listFilter === name ? null : name;
				});
			}
		}

		const sortBar = this.filterEl.createDiv({ cls: "reel-sortbar" });

		sortBar.createSpan({ cls: "reel-dim", text: "Sort" });
		const select = sortBar.createEl("select", { cls: "reel-select" });
		for (const [value, label] of SORT_OPTIONS) select.createEl("option", { value, text: label });
		select.value = this.sort;
		select.addEventListener("change", () => {
			this.sort = select.value;
			this.paint();
		});

		// Second criterion, applied where the first ties — "highest rated, and
		// among equals the most recent" is a real question the single sort
		// could not answer.
		sortBar.createSpan({ cls: "reel-dim", text: "then" });
		const select2 = sortBar.createEl("select", { cls: "reel-select" });
		select2.createEl("option", { value: "", text: "—" });
		for (const [value, label] of SORT_OPTIONS) {
			if (value === this.sort || value === "random") continue;
			select2.createEl("option", { value, text: label });
		}
		select2.value = this.sort2;
		select2.addEventListener("change", () => {
			this.sort2 = select2.value;
			this.paint();
		});
	}

	openDetail(entry: Entry): void {
		this.detail = new DetailScreen(this.plugin, entry, () => {
			this.detail = null;
			this.paint();
		});
		this.paint();
		this.bodyEl.scrollTop = 0;
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
		if (this.listFilter) rows = rows.filter((e) => e.lists.includes(this.listFilter!));
		rows = this.plugin.library.search(this.query, rows);
		// Secondary sort first, primary second: a stable sort preserves the
		// earlier order within ties, so sorting by the tiebreaker first is what
		// makes it act as a tiebreaker.
		if (this.sort2) rows = sortEntries(rows, this.sort2, ascending(this.sort2));
		rows = sortEntries(rows, this.sort, ascending(this.sort));

		const hiddenCount = this.plugin.hiddenCount(this.plugin.library.all());
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
			if (this.query) {
				this.bodyEl.createDiv({ cls: "reel-empty", text: `Nothing matches "${this.query}".` });
			} else {
				this.renderFirstRun(this.bodyEl);
			}
			return;
		}

		renderPosterGrid(this.plugin, this.bodyEl, rows, (entry) => this.openDetail(entry));
	}

	/**
	 * What an empty library says.
	 *
	 * "Nothing here yet" is useless when the real reason is that no API key is
	 * set — you'd tap Log, get a notice, and still have to work out where to
	 * go. The two cases are told apart, and each says the next thing to do.
	 */
	private renderFirstRun(el: HTMLElement): void {
		const needsKey = !this.plugin.credentials.hasStoredKey && this.plugin.settings.keyMode !== "session";
		const box = el.createDiv({ cls: "reel-firstrun" });

		if (needsKey) {
			box.createDiv({ cls: "reel-firstrun-title", text: "Add a TMDB key to get started" });
			box.createDiv({
				cls: "reel-firstrun-body",
				text:
					"Reel looks films and series up through TMDB, so it needs a key of your own. A free one takes " +
					"a minute, and it's encrypted before it's written into your vault.",
			});
			const steps = box.createEl("ol", { cls: "reel-firstrun-steps" });
			steps.createEl("li", { text: "Create a free key at themoviedb.org/settings/api" });
			steps.createEl("li", { text: "Open Settings → Community plugins → Reel" });
			steps.createEl("li", { text: "Paste it under “TMDB key”, then Save" });
			const link = box.createEl("a", {
				cls: "reel-btn mod-cta reel-firstrun-btn",
				text: "Get a TMDB key",
				href: "https://www.themoviedb.org/settings/api",
			});
			link.setAttr("target", "_blank");
			link.setAttr("rel", "noopener");
			return;
		}

		box.createDiv({ cls: "reel-firstrun-title", text: "Your library is empty" });
		box.createDiv({
			cls: "reel-firstrun-body",
			text: "Search for anything you've watched and it becomes a note you can link to, write in, and back up.",
		});
		const add = box.createEl("button", { cls: "reel-btn mod-cta reel-firstrun-btn", text: "Log your first film" });
		add.addEventListener("click", () => this.plugin.openSearch());
	}

	private paintDiary(): void {
		// The ```diary``` block took a year and the tab didn't, so the tab
		// could only ever show everything.
		const all = viewings(this.plugin.library.search(this.query, this.pool()));
		const years = [...new Set(all.map((v) => v.date.slice(0, 4)))].sort().reverse();
		if (years.length > 1) {
			this.filterEl.removeClass("is-empty");
			const bar = this.filterEl.createDiv({ cls: "reel-chips" });
			const chip = (label: string, active: boolean, year: number | null) => {
				const b = bar.createEl("button", { cls: "reel-chip", text: label });
				b.toggleClass("is-active", active);
				b.addEventListener("click", () => {
					this.diaryYear = year;
					this.paint();
				});
			};
			chip("All time", this.diaryYear == null, null);
			for (const y of years) chip(y, this.diaryYear === Number(y), Number(y));
		}

		const rows = this.diaryYear ? all.filter((v) => v.date.startsWith(String(this.diaryYear))) : all;
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
			const src = this.plugin.posters.displayUrl(v.entry);
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

			row.addEventListener("click", () => this.openDetail(v.entry));
		}
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}
}

/** Unused import guard — `renderRowList` is kept for the compact layout. */
void renderRowList;
