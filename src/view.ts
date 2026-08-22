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
import { viewings, paintDiaryRows } from "./render/diary";
import { sortEntries } from "./render/query";
import { prettyDate } from "./util/dates";
import { redact } from "./secrets";
import { renderStarsStatic } from "./ui/stars";
import { renderEmpty } from "./ui/empty";
import { paintReviews } from "./ui/reviewPane";
import { openAsk } from "./ui/askSheet";
import { paintHero, heroSubject } from "./ui/hero";
import { setSelected } from "./ui/a11y";
import { suggestions, rememberSearch } from "./util/suggest";
import {
	FilterSheet,
	LAYOUTS,
	activeFilters,
	clearFilter,
	emptyFilters,
	narrow,
	SORT_OPTIONS,
	type FilterState,
	type LibraryLayout,
} from "./ui/filterSheet";
import { unlink } from "./library";
import { measure, stampWidth, stampChromeInsets, topInset, sizeBody } from "./util/panewidth";

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
	/**
	 * One filter set, shared by every tab.
	 *
	 * These were six separate fields, read only by the Library, and thrown away
	 * on each tab switch along with the search query. "Films, sci-fi" is the
	 * same statement in the Diary as in the Library, and having to re-make it on
	 * arrival is why the other tabs felt like different apps.
	 */
	private filters: FilterState = emptyFilters();
	private diaryYear: number | null = null;
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
		// The layout and sort you chose last time. Not restored, and the dense
		// grid would be a toggle that forgets — which reads as broken rather than
		// as temporary.
		const layout = this.plugin.settings.libraryLayout;
		if (layout === "grid" || layout === "dense" || layout === "list") this.filters.layout = layout;
		if (this.plugin.settings.librarySort) this.filters.sort = this.plugin.settings.librarySort;

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
		/*
		 * The keyboard changes the available height without resizing us.
		 *
		 * A software keyboard does not shrink the layout viewport, so neither
		 * the `ResizeObserver` on `contentEl` nor `window.resize` necessarily
		 * fires when it opens. The body therefore kept the height computed for
		 * the taller screen, and the difference showed as dead space below the
		 * results — better than the 32px collapse, still wrong.
		 *
		 * `visualViewport` is the only thing that reports the change, so it is
		 * the thing to listen to.
		 */
		const vv = window.visualViewport;
		if (vv) {
			const remeasure = (): void => this.measureWidth();
			vv.addEventListener("resize", remeasure);
			vv.addEventListener("scroll", remeasure);
			this.register(() => {
				vv.removeEventListener("resize", remeasure);
				vv.removeEventListener("scroll", remeasure);
			});
		}
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
			this.syncSearchFocus();
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
				// The query used to be dropped here, on the grounds that a
				// search typed in the Library silently narrowing the Diary reads
				// as missing data. It does — when nothing says so. Every tab now
				// states what it is filtered by, so the query can survive the
				// journey, which is what "search should work the same no matter
				// what tab you are on" asks for.
				this.paint();
			});
			btn.dataset.tab = t.id;
		}
		// The row runs off the right edge on a phone, where "Stats" was sliced
		// in half and read as a rendering fault. A fade says "there is more"; it
		// has to go once there is not, or the last tab looks half-drawn.
		this.trackScrollEnd(tabBar);

		/*
		 * When an undo lands, whatever it took back should come back into view.
		 *
		 * Registered on the view rather than inside Discover so it is torn down
		 * with the leaf. A listener held by a screen that has no unload hook is a
		 * leak that survives every close and reopen.
		 */
		this.register(
			this.plugin.undo.onUndone(() => {
				this.discoverScreen?.restoreLast();
				if (this.tab !== "discover") this.paint();
			})
		);

		this.filterEl = root.createDiv({ cls: "reel-view-filters" });
		this.bodyEl = root.createDiv({ cls: "reel-view-body" });

		/*
		 * Re-measure when the body's contents change, not only when Reel paints.
		 *
		 * `sizeBody` runs at the end of `paintTab`, which is the moment the *view*
		 * draws. Discover does not finish drawing then: it paints a skeleton,
		 * fetches, and re-renders itself from a `.finally()` that the view never
		 * hears about. So the body kept the height it was given while it held six
		 * placeholder cards, and the real results were clipped inside it — a search
		 * showing two half-height posters with no titles, and four hundred pixels
		 * of empty screen underneath.
		 *
		 * Every async screen has this shape, so the fix belongs here rather than in
		 * Discover. `childList` only: setting a height on the body is an attribute
		 * change on the body itself and cannot re-trigger this, so there is no loop
		 * to guard against.
		 */
		if (typeof MutationObserver !== "undefined") {
			let queued = false;
			const mo = new MutationObserver(() => {
				if (queued) return;
				queued = true;
				// One measurement per frame. A screen that appends thirty cards in a
				// loop would otherwise force thirty layouts.
				requestAnimationFrame(() => {
					queued = false;
					if (this.bodyEl?.isConnected) sizeBody(this.contentEl, this.bodyEl);
				});
			});
			mo.observe(this.bodyEl, { childList: true });
			this.register(() => mo.disconnect());
		}

		/*
		 * Re-measure when the *viewport* changes, which is what a keyboard is.
		 *
		 * Watching the body's contents is not enough. Opening the keyboard
		 * shrinks the layout viewport on Android while a render is already in
		 * flight, so `sizeBody` measures during the collapse, writes its 120px
		 * floor, and is never asked again — the body has stopped changing, so
		 * the MutationObserver above has nothing to fire on. That is the
		 * clipped row of posters over four hundred pixels of nothing.
		 *
		 * A `ResizeObserver` on the view sees it directly. Nothing here resizes
		 * the view — only the body inside it, which has a fixed height and
		 * cannot push its parent — so there is no feedback loop of the kind
		 * `sizeBody` warns about.
		 *
		 * `visualViewport` is listened to as well, and expected to stay silent
		 * on this device: it reports no keyboard here, which is why two earlier
		 * releases gated on it and never ran. It costs nothing and covers the
		 * platforms where it does work.
		 */
		const remeasure = (): void => {
			if (!this.bodyEl?.isConnected) return;
			stampChromeInsets(this.contentEl);
			sizeBody(this.contentEl, this.bodyEl);
		};
		if (typeof ResizeObserver !== "undefined") {
			const ro = new ResizeObserver(() => requestAnimationFrame(remeasure));
			// The border box, not the content box. `remeasure` stamps the top
			// inset as padding on this very element, which changes its content
			// box and would wake the observer that just ran it.
			ro.observe(this.contentEl, { box: "border-box" });
			this.register(() => ro.disconnect());
		}
		this.registerDomEvent(window, "resize", remeasure);
		const vv = window.visualViewport;
		if (vv) {
			const onVv = (): void => remeasure();
			vv.addEventListener("resize", onVv);
			this.register(() => vv.removeEventListener("resize", onVv));
		}

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
		// A null status means "every status" — the tile that counts the whole
		// library rather than one of its states.
		this.filters.statuses = status ? [status] : [];
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

	/**
	 * Draw the current tab, and never leave half a page behind.
	 *
	 * A throw partway through a screen used to leave exactly what had been
	 * drawn so far and no explanation — two stats tiles and then nothing, which
	 * photographs as a blank white area and reads as a layout bug. It is not a
	 * layout bug; it is an exception with nobody catching it.
	 *
	 * Discover already had this guard and it is the reason its white screen
	 * became diagnosable. Every other tab was still unprotected, which is the
	 * kind of gap that only shows up as "the search error still exists" three
	 * releases running.
	 */
	private paintTab(): void {
		try {
			this.drawTab();
			/*
			 * Re-measure after drawing, not only on resize.
			 *
			 * The body's height is the view minus its siblings, and the siblings
			 * change height as a result of painting — opening the search row
			 * adds 61px, hiding the filters removes 110. `ResizeObserver` does
			 * not fire for that, because the *view* never changed size, so the
			 * body kept a height computed for a layout that no longer existed.
			 * A snapshot caught it at 120px with 377px available.
			 */
			if (this.bodyEl) sizeBody(this.contentEl, this.bodyEl);
		} catch (e) {
			this.bodyEl.empty();
			const box = this.bodyEl.createDiv({ cls: "reel-error-state" });
			box.createDiv({ cls: "reel-empty-title", text: `${this.tab} hit a problem` });
			// Redacted: an error can carry a request URL, and a URL can carry
			// the API key.
			box.createDiv({ cls: "reel-empty-body", text: redact(e) });
			const again = box.createEl("button", { cls: "reel-btn mod-cta", text: "Try again" });
			again.addEventListener("click", () => this.paint());
			console.error(`Reel: ${this.tab} render failed`, e);
		}
	}

	private drawTab(): void {
		this.clearScreenClasses();
		this.paintNav();
		if (this.tab === "library") {
			this.paintFilters();
			this.paintLibrary();
		} else if (this.tab === "discover") {
			if (!this.discoverScreen) this.discoverScreen = new DiscoverScreen(this.plugin);
			// Discover looks outward, so the library filters mean nothing to it —
			// but the search box is the same box, and typing in it has to do
			// something here too. It searches TMDB, which is the only sensible
			// reading of a query on a screen about titles you do not own.
			this.discoverScreen.query = this.query;
			this.discoverScreen.render(this.bodyEl);
		} else if (this.tab === "rate") {
			if (!this.rateScreen) this.rateScreen = new RateScreen(this.plugin);
			this.paintFilters({ showSort: false });
			this.rateScreen.scope = this.narrowed() ? this.scoped() : null;
			this.rateScreen.render(this.bodyEl);
		} else if (this.tab === "upnext") {
			this.paintFilters({ showSort: false });
			this.paintUpNextHero();
			// Above Up Next, not below: it is a grace note on the way to the
			// thing you opened the screen for, and it renders nothing at all on
			// the days it has nothing to say.
			paintOnThisDay(this.plugin, this.bodyEl);
			paintUpNext(this.plugin, this.bodyEl, undefined, false, this.narrowed() ? this.scoped() : undefined);
			// Upcoming lives here rather than in its own tab: "what am I part
			// way through" and "what's about to air" are the same question.
			paintUpcoming(this.plugin, this.bodyEl.createDiv({ cls: "reel-upcoming-section" }));
		} else if (this.tab === "diary") {
			this.paintFilters({ showSort: false });
			this.paintDiary();
		} else {
			// Films and shows answer different questions — hours of film and
			// episodes watched aren't comparable — so the tab scopes. It used to
			// keep a `statsScope` of its own, which meant choosing "Films" here
			// and choosing "Films" in the Library were two unrelated acts.
			this.paintFilters({ showSort: false });
			paintStats(this.plugin, this.bodyEl, {
				include: this.filters.type,
				entries: this.scoped(),
				query: this.query,
			});
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
		if (this.query || activeFilters(this.filters).length) return;

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
	/**
	 * While you are searching, the filters step aside.
	 *
	 * With a keyboard up the view has about 288px of usable height, and the
	 * search row plus two rows of filter chips take 171 of it — sixty percent of
	 * the screen spent on controls, leaving barely one row of results. A device
	 * screenshot showed two matching posters clipped to a third of their height
	 * with the count above them.
	 *
	 * Searching and filtering are two ways of narrowing the same list, and
	 * nobody does both at once. The chips come back the moment the field is
	 * empty.
	 */
	private syncSearchFocus(): void {
		const searching = this.headerEl.hasClass("is-open") && this.query.length > 0;
		this.contentEl.toggleClass("is-searching", searching);
		/*
		 * Borrow Obsidian's class where Obsidian draws the box; drop it where
		 * Reel does.
		 *
		 * `search-input-container` is what makes the field inherit the user's
		 * theme in the header, and that is worth having. Docked at the bottom
		 * it is the opposite: the wrap is a pill Reel draws itself, and both
		 * Obsidian and the theme still style that class — a border and a
		 * background on the container, another border on the input inside it,
		 * and the magnifier positioned absolutely at the left edge. That is the
		 * two rounded rectangles and the icon sitting on top of the text.
		 *
		 * Themes load after plugins, so this cannot be won in the cascade at
		 * equal specificity. Removing the hook is the version that keeps
		 * working when the theme changes.
		 */
		this.searchEl?.parentElement?.toggleClass("search-input-container", !searching);
		// The filter row changing height changes what the body has left.
		this.measureWidth();
	}

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
		if (this.bodyEl) sizeBody(this.contentEl, this.bodyEl);
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

	/**
	 * One row that says what you are looking at, and one button for the rest.
	 *
	 * The old bar drew the entire filter set flat: type chips, a status row, up
	 * to fourteen genres, every list, and two sort dropdowns. That is six rows on
	 * a phone, and the fix shipped for it was to hide all of it the moment a
	 * search was typed — which is how the library ended up with no filtering.
	 *
	 * A filter you have not set does not need to be on screen. So this shows only
	 * what is currently true, each chip tappable to undo it, and everything else
	 * lives in a sheet one tap away. Same function, one row, and it survives the
	 * keyboard being open.
	 */
	private paintFilters(opts: { showSort?: boolean } = {}): HTMLElement {
		const showSort = opts.showSort !== false;
		this.filterEl.removeClass("is-empty");

		// A way back, when you arrived here by tapping a number somewhere else.
		//
		// Filters you did not set by hand are hard to undo: you have to work out
		// which chips are lit, clear them, and then find your way back to the tab
		// you came from. One button does all three.
		if (this.cameFrom) {
			const origin = this.cameFrom;
			const crumb = this.filterEl.createDiv({ cls: "reel-crumb" });
			const back = crumb.createEl("button", { cls: "reel-btn reel-crumb-btn", attr: { type: "button" } });
			setIcon(back.createSpan(), "arrow-left");
			back.createSpan({ text: `Back to ${origin.label}` });
			back.addEventListener("click", () => this.showTab(origin.tab));
		}

		this.paintSuggestions();

		const bar = this.filterEl.createDiv({ cls: "reel-chips reel-filterbar" });
		const set = activeFilters(this.filters);

		const open = bar.createEl("button", {
			cls: "reel-chip reel-filter-btn",
			attr: { type: "button", "aria-label": "Filters" },
		});
		setIcon(open.createSpan({ cls: "reel-filter-btn-icon" }), "sliders-horizontal");
		open.createSpan({ text: "Filters" });
		if (set.length) open.createSpan({ cls: "reel-filter-count", text: String(set.length) });
		open.addEventListener("click", () => this.openFilters(showSort));

		/*
		 * Ask, beside the filters, because that is what it is.
		 *
		 * It shipped reachable only from the command palette, which on a phone
		 * is three taps and a keyboard — for the feature whose entire pitch is
		 * describing a mood in one sentence. Here it sits next to Filters, where
		 * you already are when the question is \u201cwhat should I watch\u201d.
		 *
		 * Only when a key exists. A chip that opens a panel explaining why it
		 * cannot work is worse than no chip, and Filters is not a shelf for
		 * advertising features you have not set up.
		 */
		if (this.plugin.ai.configured) {
			const askBtn = bar.createEl("button", {
				cls: "reel-chip reel-ask-btn",
				attr: { type: "button", "aria-label": "Ask for something to watch" },
			});
			setIcon(askBtn.createSpan({ cls: "reel-filter-btn-icon" }), "sparkles");
			askBtn.createSpan({ text: "Ask" });
			askBtn.addEventListener("click", () => openAsk(this.plugin, (entry) => this.openDetail(entry)));
		}

		if (showSort) {
			this.paintSortControls(bar);
			this.paintLayoutControl(bar);
		}

		/*
		 * The search reads as a filter, because it is one.
		 *
		 * The query now survives a tab switch, which is what makes it useful — and
		 * also what would make an unexplained three-item Diary look like data loss.
		 * Saying "search: nolan" with an x on it is the difference between a filter
		 * and a bug.
		 */
		if (this.query) {
			const tag = bar.createEl("button", {
				cls: "reel-chip is-active reel-filter-tag",
				attr: { type: "button", "aria-label": `Clear the search for ${this.query}` },
			});
			tag.createSpan({ text: `“${this.query}”` });
			setIcon(tag.createSpan({ cls: "reel-filter-x" }), "x");
			tag.addEventListener("click", () => {
				this.clearSearch();
				this.paint();
			});
		}

		/*
		 * An active filter is two controls, not one.
		 *
		 * The whole chip used to clear the filter, so tapping "watched" to see
		 * what else was set threw it away instead — and since the Filters
		 * button scrolls off the left of this row once a few tags are on, the
		 * tag is often the only filter-shaped thing on screen. Tapping the one
		 * visible filter control and having it delete a filter is the opposite
		 * of what it looks like it does.
		 *
		 * The label opens the sheet; the x removes it. Two buttons rather than
		 * one with a hit-test inside it, so the keyboard and assistive tech get
		 * the same two choices the thumb does — and a button cannot be nested
		 * inside another button, so the pill is a group holding both.
		 */
		for (const f of set) {
			const tag = bar.createDiv({ cls: "reel-chip is-active reel-filter-tag" });
			tag.setAttr("role", "group");
			tag.setAttr("aria-label", `${f.label} filter`);

			const label = tag.createEl("button", {
				cls: "reel-filter-tag-label",
				text: f.label,
				attr: { type: "button", "aria-label": `${f.label} — change the filters` },
			});
			label.addEventListener("click", () => this.openFilters(showSort));

			const drop = tag.createEl("button", {
				cls: "reel-filter-tag-x",
				attr: { type: "button", "aria-label": `Remove the ${f.label} filter` },
			});
			setIcon(drop.createSpan({ cls: "reel-filter-x" }), "x");
			drop.addEventListener("click", () => {
				clearFilter(this.filters, f.key, f.value);
				this.paint();
			});
		}

		return bar;
	}

	/** The one place the filter sheet is opened from. */
	private openFilters(showSort: boolean): void {
		new FilterSheet(this.app, this.filters, {
			pool: this.pool(),
			lists: this.plugin.library.lists(),
			showSort,
			onChange: () => this.paint(),
		}).open();
	}

	/**
	 * Sort and layout, in the same row as the filters.
	 *
	 * They were three stacked rows — filters, then a "Sort" label with a
	 * dropdown, then the grid. Three rows of controls above two posters is a
	 * control panel with a preview pane attached, which is what the screenshot
	 * showed. They are all one row now; on a phone it scrolls, and the two
	 * controls you cannot switch off sit at the start where they are always
	 * reachable without scrolling.
	 */
	private paintSortControls(bar: HTMLElement): void {
		const select = bar.createEl("select", { cls: "reel-select dropdown reel-sort-select" });
		for (const [value, label] of SORT_OPTIONS) select.createEl("option", { value, text: label });
		select.value = this.filters.sort;
		select.setAttr("aria-label", "Sort by");
		select.addEventListener("change", () => {
			this.filters.sort = select.value;
			void this.persistLayout();
			this.paint();
		});

		// The tiebreaker lives in the sheet. It is a real feature and a rare one,
		// and it was costing a phone a permanent dropdown.
		if (this.filters.sort2) {
			const label = SORT_OPTIONS.find(([v]) => v === this.filters.sort2)?.[1] ?? this.filters.sort2;
			bar.createSpan({ cls: "reel-dim reel-sort-then", text: `then ${label.toLowerCase()}` });
		}
	}

	/**
	 * How much of the library you can see at once.
	 *
	 * Cycles rather than opening a menu: there are three states, they are
	 * instantly legible from the result, and a menu to choose between three
	 * things you can see is a tap spent on nothing. The icon shows the mode you
	 * are in, and the label says what the next tap gives you.
	 */
	private paintLayoutControl(bar: HTMLElement): void {
		const current = LAYOUTS.find((l) => l.id === this.filters.layout) ?? LAYOUTS[0];
		const next = LAYOUTS[(LAYOUTS.indexOf(current) + 1) % LAYOUTS.length];
		const b = bar.createEl("button", {
			cls: "reel-chip reel-layout-btn",
			attr: { type: "button", "aria-label": `View: ${current.label}. Switch to ${next.label}.` },
		});
		setIcon(b.createSpan({ cls: "reel-layout-icon" }), current.icon);
		b.createSpan({ cls: "reel-layout-label", text: current.label });
		b.addEventListener("click", () => {
			this.filters.layout = next.id;
			void this.persistLayout();
			this.paint();
		});
	}

	/** Remember the view you chose, so opening Reel does not undo it. */
	private async persistLayout(): Promise<void> {
		const s = this.plugin.settings;
		if (s.libraryLayout === this.filters.layout && s.librarySort === this.filters.sort) return;
		s.libraryLayout = this.filters.layout;
		s.librarySort = this.filters.sort;
		await this.plugin.saveSettings();
	}

	/** Is anything narrowing the list at all? */
	private narrowed(): boolean {
		return Boolean(this.query) || activeFilters(this.filters).length > 0;
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

	/**
	 * The pool as the current filters and search leave it.
	 *
	 * Every tab draws from this rather than from `pool()`, which is the whole
	 * of "search should work the same no matter what tab you are on": the Diary,
	 * Up Next, Rate and Stats were all reading the unfiltered library and
	 * ignoring the search box entirely.
	 */
	private scoped(): Entry[] {
		return this.plugin.library.search(this.query, narrow(this.pool(), this.filters));
	}

	private paintLibrary(): void {
		let rows = this.scoped();
		// Secondary sort first, primary second: a stable sort preserves the
		// earlier order within ties, so sorting by the tiebreaker first is what
		// makes it act as a tiebreaker.
		if (this.filters.sort2) rows = sortEntries(rows, this.filters.sort2, ascending(this.filters.sort2));
		rows = sortEntries(rows, this.filters.sort, ascending(this.filters.sort));

		const hiddenCount = this.plugin.hiddenCount(this.plugin.library.all());

		/*
		 * The library wears what you last watched.
		 *
		 * This replaces the bare "39 titles" line rather than sitting above it —
		 * the count is the band's headline, and two of them would be one more row
		 * of chrome on the screen that has fought hardest for its vertical space.
		 *
		 * The subtitle is where the count used to say what it could not: how many
		 * of these are on a watchlist rather than watched, and how many the content
		 * filter is holding back. A filtered library that does not explain itself
		 * reads as missing data.
		 */
		if (rows.length) {
			const watchlist = rows.filter((e) => e.status === "watchlist").length;
			const parts: string[] = [];
			if (watchlist) parts.push(`${watchlist} to watch`);
			if (hiddenCount) parts.push(`${hiddenCount} hidden by content filter`);
			const newest = heroSubject(rows);
			if (newest && !parts.length) parts.push(`Most recently — ${newest.title}`);
			paintHero(this.plugin, this.bodyEl, {
				label: this.narrowed() ? "Filtered" : "Your library",
				title: `${rows.length} title${rows.length === 1 ? "" : "s"}`,
				sub: parts.join(" · ") || undefined,
				subject: newest,
				compact: true,
			});
		} else if (hiddenCount) {
			const count = this.bodyEl.createDiv({ cls: "reel-block-count" });
			count.createSpan({ cls: "reel-dim", text: `${hiddenCount} hidden by content filter` });
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

		/*
		 * Three ways to look at the same list.
		 *
		 * Two captioned posters per row is right for six films and wrong for
		 * sixty-six — you scroll past your own library without ever seeing it, which
		 * is what "an easy way to view all of these at once" is asking about. Dense
		 * drops the captions and fits five to a row; list trades the art for a
		 * column you can read down.
		 */
		if (this.filters.layout === "list") {
			renderRowList(this.plugin, this.bodyEl, rows, false, (entry) => this.openDetail(entry));
		} else {
			const grid = this.bodyEl.createDiv({ cls: "reel-gridwrap" });
			grid.toggleClass("is-dense", this.filters.layout === "dense");
			renderPosterGrid(this.plugin, grid, rows, (entry) => this.openDetail(entry));
		}
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

	/**
	 * What Up Next is wearing tonight.
	 *
	 * The show you are furthest into, which is very nearly always the one you are
	 * about to put on. Silent when nothing is part-watched: a band announcing
	 * "0 series" over a blurred poster would be a decorated way of saying there
	 * is nothing here, and the empty state below already says it better.
	 */
	private paintUpNextHero(): void {
		const all = this.plugin.visible(this.plugin.library.inProgress());
		const rows = this.narrowed() ? all.filter((e) => this.scoped().some((s) => s.path === e.path)) : all;
		if (!rows.length) return;

		const lead = rows[0];
		const at = lead.lastWatched;
		paintHero(this.plugin, this.bodyEl, {
			label: "Tonight",
			title: `${rows.length} on the go`,
			sub: at ? `${lead.title} — up to S${at.season}E${at.episode}` : lead.title,
			subject: lead,
			compact: true,
		});
	}

	private paintDiary(): void {
		// The ```diary``` block took a year and the tab didn't, so the tab
		// could only ever show everything.
		const all = viewings(this.scoped());
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

		/*
		 * The diary wears the most recent thing in it — which, unlike the other
		 * tabs, changes when you change the year filter. That is the point: the
		 * band is a statement about the set you are looking at, not about the
		 * library in general.
		 */
		if (rows.length) {
			const newest = rows[0];
			paintHero(this.plugin, this.bodyEl, {
				label: this.diaryYear ? String(this.diaryYear) : "Diary",
				title: `${rows.length} viewing${rows.length === 1 ? "" : "s"}`,
				sub: `Most recently — ${newest.entry.title}`,
				subject: newest.entry,
				compact: true,
			});
		}

		if (!rows.length) {
			const none = this.bodyEl.createDiv({ cls: "reel-empty" });
			none.createDiv({ text: "No viewings logged yet." });
			const first = none.createEl("button", { cls: "reel-btn mod-cta", text: "Log something you've watched" });
			first.addEventListener("click", () => this.plugin.openSearch());
			return;
		}

		const list = this.bodyEl.createDiv({ cls: "reel-diary" });
		/*
		 * The same renderer the ```diary``` block uses.
		 *
		 * This loop used to be written out again here, and the two copies had
		 * drifted: the block's rows announce themselves to a screen reader and
		 * carry the year, and this one — the screen actually opened every day —
		 * did neither. Sharing it is what stops that happening a second time.
		 *
		 * The review pane is the one real difference. The diary is a list of
		 * viewings and a review is a fact about one viewing, so this is the only
		 * screen where the date match is exact: a rewatch shows its own review
		 * rather than the most recent one. Silent when there is nothing, because
		 * an empty prompt on four hundred rows would be four hundred pieces of
		 * furniture.
		 */
		paintDiaryRows(this.plugin, list, rows.slice(0, 400), (v) => this.openDetail(v.entry), {
			extras: (body, v) =>
				paintReviews(this.plugin, body, v.entry, { onlyDate: v.date, heading: "", lazy: true }),
		});
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}
}

/** Unused import guard — `renderRowList` is kept for the compact layout. */
void renderRowList;
