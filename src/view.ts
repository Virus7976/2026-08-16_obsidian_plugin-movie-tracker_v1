/**
 * The Reel view — a real tab, not a code block you have to go and find.
 *
 * This is the answer to "make it better on mobile". A code block lives inside
 * some note; to reach it you have to remember which note, open it, and scroll.
 * A registered view opens from the ribbon in one tap and holds its own state:
 * a search box, filter chips, and four sections that keep their scroll position
 * as you move between them.
 */

import { ItemView, Menu, Platform, WorkspaceLeaf, setIcon } from "obsidian";
import type ReelPlugin from "./main";
import type { Entry } from "./types";
import { renderPosterGrid, renderRowList } from "./render/grid";
import { DetailScreen } from "./ui/detail";
import { RateScreen } from "./ui/rate";
import { DiscoverScreen } from "./ui/discoverView";
import { paintUpNext } from "./render/upnext";
import { paintOnThisDay } from "./render/onthisday";
import { paintUpcoming } from "./render/calendar";
import { paintStats } from "./render/stats";
import { viewings } from "./render/diary";
import { sortEntries } from "./render/query";
import { prettyDate } from "./util/dates";
import { redact } from "./secrets";
import { renderStarsStatic } from "./ui/stars";
import { renderEmpty } from "./ui/empty";
import { setSelected } from "./ui/a11y";
import { suggestions, rememberSearch } from "./util/suggest";
import { unlink } from "./library";
import { measure, stampWidth, stampChromeInsets, topInset } from "./util/panewidth";

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
	/**
	 * Set by the navigation methods, consumed by the next paint.
	 *
	 * `paint()` runs on every library change, not only when you go somewhere —
	 * so animating unconditionally would make the whole screen slide every time
	 * you rated an episode. Only a deliberate move sets this.
	 */
	private moving: "forward" | "back" | "sideways" | null = null;
	/** Where each tab was scrolled to, so coming back lands where you left. */
	private tabScroll = new Map<string, number>();
	/** Last measured pane width, surfaced by the diagnostics dump. */
	private lastWidth = 0;
	/** How far Obsidian's own header reaches over the top of the view. */
	private lastTopInset = 0;

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
		this.contentEl.toggleClass("is-phone", Platform.isPhone);
		this.contentEl.toggleClass("is-mobile", Platform.isMobile);
		// The compact layout keys off `is-narrow`, which is *measured*.
		//
		// Two previous attempts guessed and both were wrong. A width media
		// query never matched on a real device. `Platform.isPhone` then also
		// failed to produce the compact layout on that same device — so
		// whatever it reports there, it is not the thing that decides whether
		// six filter rows fit.
		//
		// The pane's own width is not a guess. It is also the right question:
		// a narrow pane on a desktop has exactly the same problem as a phone,
		// and neither platform flag can see that.
		this.measureWidth();
		// The pane resizes when the window does, when a sidebar opens, and
		// when the phone rotates. ResizeObserver catches all three; a resize
		// listener on the window catches only the first.
		if (typeof ResizeObserver !== "undefined") {
			const ro = new ResizeObserver(() => this.measureWidth());
			ro.observe(this.contentEl);
			/*
			 * Watch Obsidian's header too, not just our own pane.
			 *
			 * The inset was measured once during `onOpen`, when the header has
			 * not been laid out and reports 0×0 — so the compensation computed
			 * as zero. Nothing re-measured it, because the observer only watched
			 * `contentEl` and *our* size had not changed. The result on a device
			 * was the tab row sitting under Obsidian's header with no way to
			 * reach it.
			 *
			 * The header is the thing whose size we are compensating for, so it
			 * is the thing to watch.
			 */
			const header = this.containerEl.closest(".workspace-leaf")?.querySelector(".view-header");
			if (header instanceof HTMLElement) ro.observe(header);
			this.register(() => ro.disconnect());
		}
		// And once more after layout settles, for the case where the header is
		// not in the tree yet at all. Cheap, and the alternative is a screen
		// nobody can navigate.
		this.app.workspace.onLayoutReady(() => this.measureWidth());
		this.registerDomEvent(window, "resize", () => this.measureWidth());
		// registerDomEvent, not addEventListener: Obsidian unbinds it when the
		// view closes, so reopening the tab can't stack duplicate handlers.
		this.registerDomEvent(this.contentEl, "keydown", this.onKey);

		/*
		 * View actions, where Obsidian already draws its own.
		 *
		 * `addAction` puts these in the header alongside the tab and menu
		 * buttons, which is both the native place for them and the one place
		 * guaranteed not to collide with anything — Obsidian owns the layout.
		 * Reel's own header row was competing for that space and losing.
		 */
		this.addAction("plus", "Log a film or series", () => this.plugin.openSearch());
		// Search lives in Obsidian's header, next to its own controls. It was
		// briefly in Reel's row instead, which put two magnifiers a centimetre
		// apart; the top bar is the one that reads as part of the app.
		this.addAction("search", "Search your library", () => this.toggleSearch());

		this.build();
		this.registerEvent(this.plugin.library.on("changed", () => this.paint()));
	}

	private build(): void {
		const root = this.contentEl;

		/* ---- header: search ------------------------------------------- */
		/*
		 * `search-input-container` is Obsidian's own class, not a copy of it.
		 *
		 * Reel hand-rolled every control, which meant every theme the user
		 * installs styled the app around Reel and left Reel looking like a web
		 * page dropped into it. Borrowing the real classes means the search
		 * field, the dropdowns and the icon buttons inherit whatever the user
		 * chose, for free and permanently.
		 */
		const header = root.createDiv({ cls: "reel-view-header" });
		this.headerEl = header;

		/*
		 * Navigation is a dropdown on a phone, not a row of six tabs.
		 *
		 * The tab row cost 45px of a 823px screen and spent the whole time
		 * fighting Obsidian's floating header for the same strip — first the
		 * search field was buried under it, then the tabs were. A row that must
		 * be exactly clear of a bar whose height nobody controls is a row that
		 * will be wrong again on the next device.
		 *
		 * One control that says where you are and opens a menu cannot collide
		 * with anything, needs no horizontal scrolling, and stops "Stats" being
		 * sliced off the right edge. The full row stays on a wide pane, where
		 * there is room and no floating header to argue with.
		 */
		const nav = header.createEl("button", { cls: "reel-nav-btn", attr: { type: "button" } });
		this.navEl = nav;
		nav.addEventListener("click", (ev) => this.openNav(ev));

		const searchWrap = header.createDiv({ cls: "reel-search-wrap search-input-container" });
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
		this.searchEl = search;
		const clear = searchWrap.createEl("button", {
			cls: "reel-search-clear clickable-icon",
			text: "×",
			// A screen reader otherwise announces this as "times".
			attr: { "aria-label": "Clear search", type: "button" },
		});
		clear.addEventListener("click", () => {
			search.value = "";
			this.query = "";
			this.paint();
			search.focus();
		});

		// The "Log" button used to live here, in a row of Reel's own making
		// that sat directly under Obsidian's header — which is what buried the
		// search field. It is a view action now: same place Obsidian already
		// draws its own, and one less row of chrome on a phone.

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
				// A search typed in the Library silently filtered the Diary
				// too, which reads as missing data rather than a filter.
				this.clearSearch();
				this.paint();
			});
			btn.dataset.tab = t.id;
		}
		// The row runs off the right edge on a phone, where "Stats" was sliced
		// in half and read as a rendering fault. A fade says "there is more"; it
		// has to go once there is not, or the last tab looks half-drawn.
		this.trackScrollEnd(tabBar);

		this.filterEl = root.createDiv({ cls: "reel-view-filters" });
		this.bodyEl = root.createDiv({ cls: "reel-view-body" });
		this.paint();
	}

	private filterEl!: HTMLElement;
	/** The search row, collapsed on a phone until the header action asks for it. */
	private headerEl!: HTMLElement;
	/** The dropdown that replaces the tab row on a narrow pane. */
	private navEl: HTMLElement | null = null;
	private searchEl: HTMLInputElement | null = null;
	/** Where the list was when a detail screen was opened over it. */
	private listScroll = 0;
	/**
	 * The tab a filtered view was launched from, so it can offer a way back.
	 *
	 * Tapping a stat drops you into the Library with filters you did not set
	 * by hand, and the only route back was to notice which chips were lit,
	 * clear them, and find the Stats tab again.
	 */
	private cameFrom: { tab: Tab; label: string } | null = null;

	private clearSearch(): void {
		if (!this.query) return;
		this.query = "";
		if (this.searchEl) this.searchEl.value = "";
	}

	/**
	 * Switch tabs from outside the view.
	 *
	 * Not onOpen(): that registers the library listener, so calling it again
	 * stacks a second one that lives until the view unloads. Five uses of the
	 * per-tab commands and every change would repaint six times.
	 */
	/**
	 * Jump to the Library filtered by a term — a cast member, a genre.
	 *
	 * Tapping an actor on the detail screen asks "what else of theirs have I
	 * seen?", and the library search already answers exactly that across
	 * cast, director and genre. Reusing it beats a second lookup screen.
	 */
	/**
	 * Jump to the Library showing one status — watchlist, watched, unrated.
	 *
	 * The stats tiles count these sets; this is how you get from the count to
	 * the titles behind it.
	 */
	filterByStatus(status: string | null, from?: string): void {
		this.rememberOrigin(from);
		this.tab = "library";
		this.detail = null;
		this.clearSearch();
		this.statusFilter = status;
		this.plugin.settings.lastTab = "library";
		void this.plugin.saveSettings();
		this.paint();
	}

	searchFor(query: string, from?: string): void {
		this.rememberOrigin(from);
		this.tab = "library";
		this.detail = null;
		this.plugin.settings.lastTab = "library";
		// Only searches made deliberately — a tapped chip, a cast name, a jump
		// from stats. Typing is *not* recorded: every keystroke repaints, so
		// "Christopher Nolan" would otherwise leave seventeen recents, sixteen
		// of them prefixes nobody meant to search for.
		this.plugin.settings.recentSearches = rememberSearch(this.plugin.settings.recentSearches ?? [], query);
		void this.plugin.saveSettings();
		this.paint();
		this.query = query;
		if (this.searchEl) this.searchEl.value = query;
		this.paint();
	}

	/** Note where a jump came from, so the destination can offer a way back. */
	private rememberOrigin(from?: string): void {
		const origin = TABS.find((t) => t.id === from);
		this.cameFrom = origin ? { tab: origin.id as Tab, label: origin.label } : null;
	}

	showTab(tab: string): void {
		if (!TABS.some((t) => t.id === tab)) return;
		// Where you were on the tab you are leaving, so returning to it does not
		// dump you at the top of a library you had scrolled halfway down.
		if (!this.detail) this.tabScroll.set(this.tab, this.bodyEl?.scrollTop ?? 0);
		this.moving = tab === this.tab ? null : "sideways";
		this.tab = tab as Tab;
		this.detail = null;
		this.clearSearch();
		// Choosing a tab yourself is not a detour, so the breadcrumb goes.
		this.cameFrom = null;
		// Persisted here rather than by the caller, so every route into a tab
		// remembers it — a command, a click, or anything added later.
		this.plugin.settings.lastTab = tab;
		void this.plugin.saveSettings();
		this.paint();
		// After the paint, since the body has no height to scroll until then.
		this.bodyEl.scrollTop = this.tabScroll.get(this.tab) ?? 0;
	}

	private paint(): void {
		this.contentEl.findAll(".reel-tab").forEach((el) => {
			// aria-current, not aria-pressed: this is "which screen am I on",
			// and a tab announced as "pressed" describes the wrong thing.
			setSelected(el, el.dataset.tab === this.tab, "tab");
		});

		// Every library change repaints, and rebuilding the body resets its
		// scroll to the top — so rating something halfway down your library
		// threw you back to the start of it.
		const scroll = this.bodyEl.scrollTop;

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
			// The detail screen needs this more than the library does: rating
			// episodes is the one thing you do repeatedly without leaving the
			// screen, and each rating repaints it.
			if (scroll > 0) this.bodyEl.scrollTop = scroll;
			this.playMove();
			return;
		}

		try {
			this.paintTab();
			// After the DOM exists, or there is nothing to scroll yet.
			if (scroll > 0) this.bodyEl.scrollTop = scroll;
			this.playMove();
		} catch (e) {
			// A thrown paint used to leave an empty pane with no explanation.
			// Showing the error keeps the rest of the view usable and tells you
			// which tab is broken.
			this.bodyEl.createDiv({ cls: "reel-error", text: redact(e) });
		}
	}

	/**
	 * Give the freshly-painted body a direction, once.
	 *
	 * Tapping a title used to empty the container and rebuild it, which is
	 * instant and tells you nothing about where you went. A short move in the
	 * direction you travelled says the detail came *from* the list rather than
	 * replacing it, and going back reverses it.
	 *
	 * The class is not removed afterwards. It only needs clearing so the same
	 * animation can be re-triggered, and the reflow below does that — a timer
	 * would be one more thing to cancel when the view closes.
	 */
	private playMove(): void {
		const move = this.moving;
		this.moving = null;
		if (!move) return;

		this.bodyEl.removeClasses(["reel-move-forward", "reel-move-back", "reel-move-sideways"]);
		// Reading a layout property flushes the class removal, so re-adding it
		// restarts the animation instead of being coalesced into a no-op.
		void this.bodyEl.offsetWidth;
		this.bodyEl.addClass(`reel-move-${move}`);
	}

	/**
	 * Every screen paints into the same element, so every screen has to let go
	 * of it.
	 *
	 * `paintStats`, `DetailScreen` and `DiscoverScreen` each add their own class
	 * to the shared body and none of them removed it. After a few tab switches a
	 * device snapshot showed
	 * `reel-view-body reel-discover reel-detail reel-move-back reel-stats` — four
	 * screens' worth of layout rules applied at once.
	 *
	 * That is what made the stats page look broken rather than merely plain: the
	 * facts block came out 171px wide inside a 349px body, and the charts sat in
	 * a narrow indented column with dead space either side. Nothing was wrong
	 * with the stats styling. It was competing with Discover's centring and the
	 * detail screen's column rules.
	 *
	 * Cleared before each paint rather than by each screen on the way out: a
	 * screen that throws never gets to clean up, and this has to hold even then.
	 */
	private clearScreenClasses(): void {
		this.bodyEl.removeClasses(["reel-discover", "reel-detail", "reel-stats", "reel-rate", "reel-upnext", "reel-diary"]);
	}

	private paintTab(): void {
		this.clearScreenClasses();
		this.paintNav();
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
			// Above Up Next, not below: it is a grace note on the way to the
			// thing you opened the screen for, and it renders nothing at all on
			// the days it has nothing to say.
			paintOnThisDay(this.plugin, this.bodyEl);
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
				setSelected(b, this.statsScope === scope);
				b.addEventListener("click", () => {
					this.statsScope = scope;
					this.paint();
				});
			}
			paintStats(this.plugin, this.bodyEl, { include: this.statsScope });
		}
	}

	/* ---------------------------------------------------------------- */

	/**
	 * What to offer under an empty search box.
	 *
	 * Only when nothing is typed and no filter is set — once you are looking
	 * at a narrowed list, a row of other searches is a distraction from the
	 * one you are making.
	 *
	 * Every suggestion is built from your own library, so tapping one always
	 * returns something. A generic list would sometimes return nothing, which
	 * reads as the library being emptier than it is.
	 */
	private paintSuggestions(): void {
		if (this.query || this.statusFilter || this.genreFilter || this.listFilter) return;

		const rows = this.pool();
		if (rows.length < 4) return; // too small to have a shape worth guessing at

		const picks = suggestions({
			recent: this.plugin.settings.recentSearches ?? [],
			people: rows.flatMap((e) => (e.type === "tv" ? e.creators : e.director).map(unlink)),
			genres: rows.flatMap((e) => e.genres),
			years: rows.map((e) => e.year ?? e.firstAirYear ?? 0),
		});
		if (!picks.length) return;

		const wrap = this.filterEl.createDiv({ cls: "reel-suggest" });
		wrap.createSpan({ cls: "reel-suggest-label", text: "Try" });
		for (const s of picks) {
			const chip = wrap.createEl("button", {
				cls: `reel-chip reel-suggest-chip is-${s.kind}`,
				text: s.label,
				attr: { type: "button" },
			});
			if (s.kind === "recent") setIcon(chip.createSpan({ cls: "reel-suggest-icon" }), "history");
			chip.addEventListener("click", () => this.searchFor(s.query));
		}
	}

	/**
	 * Decide the compact layout from the pane's real width.
	 *
	 * 600px, because the filter stack is search + tabs + suggestions + type
	 * chips + status chips + sort. Below that it wraps onto four rows and
	 * pushes the first poster off the bottom of a phone screen — which is
	 * what "I can't see anything on the library page" actually was.
	 */
	/**
	 * The tab list, as a menu.
	 *
	 * Uses Obsidian's own `Menu`, so it inherits the theme, the dismiss
	 * behaviour and the safe-area handling rather than reimplementing three
	 * things that are easy to get subtly wrong on a phone.
	 */
	private openNav(ev: MouseEvent): void {
		const menu = new Menu();
		for (const t of TABS) {
			menu.addItem((item) =>
				item
					.setTitle(t.label)
					.setIcon(t.icon)
					// A tick, so the menu also answers "where am I" — which is
					// the other half of what the tab row was doing.
					.setChecked(this.tab === t.id)
					.onClick(() => {
						this.tab = t.id;
						this.plugin.settings.lastTab = t.id;
						void this.plugin.saveSettings();
						this.clearSearch();
						this.paint();
					})
			);
		}
		menu.showAtMouseEvent(ev);
	}

	/** Keep the dropdown's label in step with the tab it names. */
	private paintNav(): void {
		if (!this.navEl) return;
		this.navEl.empty();
		const current = TABS.find((t) => t.id === this.tab);
		setIcon(this.navEl.createSpan({ cls: "reel-nav-icon" }), current?.icon ?? "layout-grid");
		this.navEl.createSpan({ cls: "reel-nav-label", text: current?.label ?? "Library" });
		setIcon(this.navEl.createSpan({ cls: "reel-nav-chevron" }), "chevron-down");
		this.navEl.setAttr("aria-label", `${current?.label ?? "Library"} — change section`);
	}

	/**
	 * Show or hide the search row.
	 *
	 * On a phone the field is collapsed until asked for: a persistent search
	 * box costs a row of a screen that had roughly a third of it spent on
	 * chrome, and searching is something you do occasionally rather than
	 * continuously. On a wide pane there is room, so it simply stays.
	 *
	 * Clearing on collapse is deliberate. A hidden filter still filtering is
	 * indistinguishable from missing data, which is the bug this view already
	 * had once when a Library search silently filtered the Diary.
	 */
	private toggleSearch(): void {
		const open = this.headerEl.hasClass("is-open");
		this.headerEl.toggleClass("is-open", !open);
		if (open) {
			this.clearSearch();
			this.paint();
		} else {
			this.searchEl?.focus();
		}
	}

	/**
	 * Keep `is-scroll-end` in step with a horizontally scrolling row.
	 *
	 * The edge fade that advertises "there is more this way" becomes a lie the
	 * moment there is not — the last item then looks permanently half-painted.
	 * Also applied when the row does not overflow at all, which is the common
	 * case on a wide pane.
	 */
	private trackScrollEnd(row: HTMLElement): void {
		const sync = (): void => {
			const done = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
			row.toggleClass("is-scroll-end", done);
		};
		this.registerDomEvent(row, "scroll", sync);
		if (typeof ResizeObserver !== "undefined") {
			const ro = new ResizeObserver(sync);
			ro.observe(row);
			this.register(() => ro.disconnect());
		}
		sync();
	}

	private measureWidth(): void {
		this.lastWidth = measure(this.contentEl);
		stampWidth(this.contentEl, this.lastWidth);
		this.measureTopInset();
	}

	/**
	 * How much of the view's top edge Obsidian is already covering.
	 *
	 * On a phone Obsidian draws its own header — the sidebar toggle, the view
	 * title, the tab and menu buttons — and on this device it lands *over* the
	 * top of the content rather than above it. Reel's search field is the first
	 * thing in the view, so it ended up underneath: visible, and untappable.
	 * "I can't search" was literally that.
	 *
	 * The bottom toolbar had the same shape of problem and the fix there was to
	 * move out of its way, because guessing the toolbar's height means guessing
	 * at the user's settings and their phone's gesture bar. The top is
	 * different: there is nowhere above it to move to. So measure the overlap
	 * instead of assuming it — zero when Obsidian stacks the header properly,
	 * and exactly the covered distance when it does not.
	 */
	private measureTopInset(): void {
		// Searched from the document rather than this view's container, because
		// on a phone Obsidian's header is not inside the leaf it covers.
		stampChromeInsets(this.contentEl);
		this.lastTopInset = topInset(this.contentEl);
	}

	/**
	 * What the layout currently believes about itself, in one string.
	 *
	 * Two layout bugs have now been reported on a device I cannot see, and
	 * neither reproduced in the harness. Guessing a fourth time is worse than
	 * asking. This is what the Copy diagnostics button in settings reads.
	 */
	diagnostics(): string {
		const el = this.contentEl;
		const cls = Array.from(el.classList).filter((c) => c.startsWith("is-"));
		return [
			`tab: ${this.tab}`,
			`pane width: ${this.lastWidth || "unmeasured"} (clientWidth ${el.clientWidth}, rect ${Math.round(el.getBoundingClientRect().width)})`,
			`window: ${window.innerWidth}×${window.innerHeight}`,
			`top inset: ${this.lastTopInset}px (Obsidian header overlap)`,
			`classes: ${cls.join(" ") || "none"}`,
			`platform: phone=${Platform.isPhone} mobile=${Platform.isMobile}`,
			`ResizeObserver: ${typeof ResizeObserver !== "undefined"}`,
		].join("\n");
	}

	private paintFilters(): void {
		this.filterEl.removeClass("is-empty");

		// A way back, when you arrived here by tapping a number somewhere else.
		//
		// Filters you did not set by hand are hard to undo: you have to work
		// out which chips are lit, clear them, and then find your way back to
		// the tab you came from. One button does all three.
		if (this.cameFrom) {
			const origin = this.cameFrom;
			const crumb = this.filterEl.createDiv({ cls: "reel-crumb" });
			const back = crumb.createEl("button", { cls: "reel-btn reel-crumb-btn", attr: { type: "button" } });
			setIcon(back.createSpan(), "arrow-left");
			back.createSpan({ text: `Back to ${origin.label}` });
			back.addEventListener("click", () => this.showTab(origin.tab));
		}

		this.paintSuggestions();

		const bar = this.filterEl.createDiv({ cls: "reel-chips" });

		const chip = (label: string, active: boolean, onClick: () => void) => {
			const b = bar.createEl("button", { cls: "reel-chip", text: label });
			setSelected(b, active);
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
		const select = sortBar.createEl("select", { cls: "reel-select dropdown" });
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
		const select2 = sortBar.createEl("select", { cls: "reel-select dropdown" });
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

	/** Escape backs out of the detail screen, as it does from every modal. */
	private onKey = (ev: KeyboardEvent): void => {
		if (ev.key !== "Escape" || !this.detail) return;
		ev.preventDefault();
		this.closeDetail();
	};

	/**
	 * One exit for both the back button and Escape.
	 *
	 * Repaints restore the scroll they captured, which is the *detail
	 * screen's* — so leaving a deeply-scrolled episode list would drop the
	 * library at a matching offset rather than where you left it. The
	 * position to return to is the one saved when the detail was opened.
	 */
	private closeDetail(): void {
		this.detail = null;
		this.moving = "back";
		this.paint();
		this.bodyEl.scrollTop = this.listScroll;
	}

	openDetail(entry: Entry): void {
		this.listScroll = this.bodyEl.scrollTop;
		this.moving = "forward";
		const from = TABS.find((t) => t.id === this.tab)?.label ?? "Library";
		this.detail = new DetailScreen(
			this.plugin,
			entry,
			() => this.closeDetail(),
			from
		);
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
		if (this.statusFilter) {
			// "Watched" means you have seen it, which is a fact about your
			// history — not a label that a later intent can overwrite.
			//
			// `status` is one field doing two jobs: have I seen this, and do I
			// mean to watch it. Putting a film you have already seen back on
			// the watchlist sets status to "watchlist", and filtering on the
			// raw field then dropped it out of "watched" entirely — the app
			// appeared to forget you had ever seen it. Reading the watch
			// history instead means a film you intend to rewatch correctly
			// shows under both, because both are true.
			rows = rows.filter((e) =>
				this.statusFilter === "watched" && e.type !== "tv"
					? e.watched.length > 0
					: e.status === this.statusFilter
			);
		}
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
				// A dead end otherwise: the reason a title isn't in your library
				// is usually that you haven't added it yet, and that is exactly
				// what you came here to do.
				const carried = this.query;
				renderEmpty(this.bodyEl, {
					icon: "search-x",
					title: `Nothing matches "${carried}"`,
					body: "Nothing in your library, at least. It may just not be in there yet.",
					actions: [
						{ label: "Search TMDB for it", primary: true, onClick: () => this.plugin.openSearch({ query: carried }) },
						{ label: "Clear search", onClick: () => this.searchFor("") },
					],
				});
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
				setSelected(b, active);
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
			const none = this.bodyEl.createDiv({ cls: "reel-empty" });
			none.createDiv({ text: "No viewings logged yet." });
			const first = none.createEl("button", { cls: "reel-btn mod-cta", text: "Log something you've watched" });
			first.addEventListener("click", () => this.plugin.openSearch());
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
			this.plugin.posters.attach(thumb, v.entry);

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
