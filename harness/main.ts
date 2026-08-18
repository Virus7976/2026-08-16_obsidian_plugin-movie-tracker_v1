/**
 * The harness: real renderers, real stylesheet, real browser, phone width.
 *
 * Everything below builds the smallest fake plugin the render functions will
 * accept, then calls them. It deliberately does *not* reimplement any layout —
 * if a screen looks wrong here it is wrong in the app, and if it looks right
 * here the only remaining risk is Obsidian's own theme, which is a much
 * smaller surface than "all of it".
 *
 * Posters are inline SVG data URIs rather than network images, so the harness
 * works offline, needs no TMDB key, and produces identical pixels every run.
 * A poster that sometimes fails to load would make every screenshot a
 * judgement call.
 */

import "./shim";
import { LIBRARY, SHOW, AWKWARD, LONG_SHOW } from "./fixtures";
import type { Entry } from "../src/types";
import { renderPosterGrid, renderRowList } from "../src/render/grid";
import { paintStats } from "../src/render/stats";
import { paintUpNext } from "../src/render/upnext";
import { renderEmpty } from "../src/ui/empty";
import { skeletonCards, skeletonGrid } from "../src/ui/skeleton";
import { renderStars } from "../src/ui/stars";
import { DetailScreen } from "../src/ui/detail";
import { DiscoverScreen } from "../src/ui/discoverView";
import { RecipeSheet } from "../src/ui/recipeSheet";
import { QuickRate } from "../src/ui/quickRate";
import { LogSheet } from "../src/ui/logSheet";
import { DEFAULT_SETTINGS } from "../src/settings";
import { auditScreen, type Check } from "./audit";
import { measure, stampWidth, stampChromeInsets } from "../src/util/panewidth";

/* ------------------------------------------------------------------ */
/* A poster that always loads                                          */
/* ------------------------------------------------------------------ */

function poster(title: string): string {
	// Deterministic hue from the title, so each fixture is visually distinct
	// and the same every run — a screenshot diff should show layout changes,
	// not a new colour scheme.
	let h = 0;
	for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
	const short = title.length > 22 ? `${title.slice(0, 20)}…` : title;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513">
		<rect width="342" height="513" fill="hsl(${h} 45% 32%)"/>
		<text x="171" y="256" fill="white" font-family="sans-serif" font-size="22"
		      text-anchor="middle">${short.replace(/[<>&]/g, "")}</text>
	</svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ------------------------------------------------------------------ */
/* The smallest plugin the renderers will accept                       */
/* ------------------------------------------------------------------ */

// The awkward rows are in the main set on purpose. Keeping them on a
// separate screen would mean the library grid is only ever checked against
// well-behaved data, which is not the question.
const all = [...LIBRARY, SHOW, ...AWKWARD, LONG_SHOW];

const plugin = {
	settings: { ...DEFAULT_SETTINGS, recentSearches: ["Inside Man"] },
	app: { vault: { getAbstractFileByPath: () => null }, workspace: { getLeaf: () => null } },
	library: {
		all: () => all,
		films: () => all.filter((e) => e.type === "film"),
		shows: () => all.filter((e) => e.type === "tv"),
		inProgress: () => all.filter((e) => e.type === "tv"),
		byPath: (p: string) => all.find((e) => e.path === p),
		byTmdbId: (id: number) => all.find((e) => e.tmdbId === id),
		peopleIds: () => new Map<string, number>([["Christopher Nolan", 525]]),
		size: all.length,
		on: () => ({}),
		// The detail screen asks for these; without them it threw before
		// drawing anything, and three screens reported green for rounds.
		lists: () => ["Favourites", "Rewatch pile"],
		genres: () => ["Action", "Comedy", "Drama"],
	},
	visible: (rows: Entry[]) => rows,
	hiddenCount: () => 0,
	posters: {
		attach(parent: HTMLElement, entry: { title: string }) {
			parent.addClass("reel-poster-loading");
			const img = parent.createEl("img", { cls: "reel-img", attr: { src: poster(entry.title), alt: "" } });
			img.addClass("is-loaded");
			parent.removeClass("reel-poster-loading");
		},
		displayUrl: (e: { title: string }) => poster(e.title),
	},
	people: {
		attach(parent: HTMLElement, name: string) {
			parent.addClass("is-empty");
			parent.createSpan({
				cls: "reel-placeholder-text",
				text: name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join(""),
			});
		},
	},
	upNext: {
		nextFor: (e: Entry) => (e.type === "tv" ? { season: 2, episode: 4 } : null),
		airingToday: () => false,
	},
	undo: { offer: () => {}, record: () => {}, recordCreation: () => {}, undo: async () => null, last: null },
	swatches: { tint: () => {} },
	discover: {
		// The screen calls these on mount; without them it threw before it
		// drew anything, and the audit called that a pass.
		takeStaged: () => null,
		stage: () => {},
		seedPool: () => all.filter((e) => (e.rating ?? 0) >= 4),
		taste: async () => ({ genreIds: [28, 35], genreNames: ["Action", "Comedy"], seeds: all.slice(0, 3), directors: ["Christopher Nolan"], sparse: false }),
		rows: async () => [
			{ id: "a", title: "More with Denzel Washington", items: all.slice(0, 8) },
			{ id: "b", title: "Because you liked Inside Man", items: all.slice(4, 12) },
			{ id: "c", title: "Trending this week", items: all.slice(2, 10) },
		],
		count: async () => 100,
		run: async () => [],
		blameFor: async () => null,
		describeQueries: () => [],
		dismiss: async () => {},
	},
	tmdb: {
		posterUrl: (p: string | null | undefined) => (p ? poster(String(p)) : null),
		genreList: async () => [
			{ id: 28, name: "Action" },
			{ id: 35, name: "Comedy" },
			{ id: 27, name: "Horror" },
		],
	},
	openSearch: () => {},
	openDetail: () => {},
	openTab: () => {},
	openLibraryWithStatus: () => {},
	openViewWithSearch: () => {},
	openRecipe: () => {},
} as unknown as never;

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

/**
 * The library, chrome and all.
 *
 * Rebuilt here rather than instantiating ReelView, which needs a workspace
 * leaf and an ItemView lifecycle. The markup mirrors `view.ts` exactly — the
 * *chrome* is what buried the library, so the harness has to include all of
 * it or it verifies nothing.
 */
function library(root: HTMLElement): void {
	const header = root.createDiv({ cls: "reel-view-header" });
	const wrap = header.createDiv({ cls: "reel-search-wrap" });
	wrap.createSpan({ cls: "reel-search-icon", text: "⌕" });
	wrap.createEl("input", {
		cls: "reel-input reel-search-input",
		attr: { type: "search", placeholder: "Search titles, people, characters, plots…" },
	});
	wrap.createEl("button", { cls: "reel-search-clear", text: "×" });
	header.createEl("button", { cls: "reel-btn mod-cta reel-add-btn", text: "+" });

	const tabs = root.createDiv({ cls: "reel-tabs" });
	for (const t of ["Library", "Discover", "Rate", "Up next", "Diary", "Stats"]) {
		const b = tabs.createEl("button", { cls: "reel-tab" });
		b.createSpan({ cls: "reel-tab-icon", text: "▣" });
		b.createSpan({ cls: "reel-tab-label", text: t });
		if (t === "Library") b.addClass("is-active");
	}

	const filters = root.createDiv({ cls: "reel-view-filters" });

	const suggest = filters.createDiv({ cls: "reel-suggest" });
	suggest.createSpan({ cls: "reel-suggest-label", text: "Try" });
	for (const s of ["Inside Man", "Christopher Nolan", "Denis Villeneuve", "Action", "Crime", "2010s"]) {
		suggest.createEl("button", { cls: "reel-chip reel-suggest-chip", text: s });
	}

	const chips = filters.createDiv({ cls: "reel-chips" });
	for (const [label, on] of [["All", true], ["Films", false], ["Series", false]] as const) {
		const b = chips.createEl("button", { cls: "reel-chip", text: label });
		if (on) b.addClass("is-active");
	}
	chips.createSpan({ cls: "reel-dim", text: "·" });
	for (const s of ["watched", "watchlist", "watching", "completed", "paused"]) {
		chips.createEl("button", { cls: "reel-chip", text: s });
	}

	const sort = filters.createDiv({ cls: "reel-sortbar" });
	sort.createSpan({ cls: "reel-dim", text: "Sort" });
	const sel = sort.createEl("select");
	sel.createEl("option", { text: "Recently watched" });
	sort.createSpan({ cls: "reel-dim", text: "then" });
	const sel2 = sort.createEl("select");
	sel2.createEl("option", { text: "—" });

	const body = root.createDiv({ cls: "reel-view-body" });
	body.createDiv({ cls: "reel-view-count", text: `${all.length} titles` });
	renderPosterGrid(plugin, body, all);
}

function rows(root: HTMLElement): void {
	root.addClass("reel-view-body");
	renderRowList(plugin, root, all.slice(0, 8));
}

function stats(root: HTMLElement): void {
	root.addClass("reel-view-body");
	paintStats(plugin, root, { include: "all" });
}

function upnext(root: HTMLElement): void {
	root.addClass("reel-view-body");
	paintUpNext(plugin, root, undefined, true);
}

function empties(root: HTMLElement): void {
	root.addClass("reel-view-body");
	renderEmpty(root, {
		icon: "tv",
		title: "No series yet",
		body: "Add a series and this becomes the screen you open every night — one row per show, one tap to tick the next episode.",
		actions: [{ label: "Find a series", primary: true, onClick: () => {} }],
	});
	root.createDiv({ cls: "reel-block-title", text: "Loading states" });
	skeletonCards(root, 6);
	skeletonGrid(root, 8);
}

function stars(root: HTMLElement): void {
	root.addClass("reel-view-body");
	root.createDiv({ cls: "reel-block-title", text: "Rating controls" });
	for (const v of [undefined, 2.5, 5]) {
		const box = root.createDiv({ cls: "reel-control" });
		box.createDiv({ cls: "reel-field-label", text: v == null ? "Unrated" : `${v} stars` });
		renderStars(box.createDiv({ cls: "reel-rating-row" }), { value: v });
	}
	const compact = root.createDiv({ cls: "reel-control" });
	compact.createDiv({ cls: "reel-field-label", text: "Compact (episode rows)" });
	renderStars(compact.createDiv({ cls: "reel-rating-row" }), { value: 4, compact: true });
}


/* ------------------------------------------------------------------ */
/* The screens the first version missed                                */
/* ------------------------------------------------------------------ */

/**
 * A sheet, mounted into the page.
 *
 * Obsidian's Modal attaches itself to the app; the shim's does nothing, so
 * the harness mounts `contentEl` itself and applies the same classes the real
 * modal would. Without `reel-sheet` the phone layout — which is the whole
 * reason these are here — would not apply.
 */
function mountSheet(root: HTMLElement, sheet: { contentEl: HTMLElement; modalEl: HTMLElement; onOpen(): void }): void {
	const shell = root.createDiv({ cls: "reel-modal-shell" });
	sheet.modalEl = shell;
	shell.addClass("reel-modal");
	if (phone) shell.addClass("reel-sheet");
	shell.appendChild(sheet.contentEl);
	try {
		sheet.onOpen();
	} catch (e) {
		sheet.contentEl.createEl("pre", { text: `sheet failed: ${String(e)}` });
	}
}

function detail(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const screen = new DetailScreen(plugin, SHOW, () => {}, "Library");
	screen.render(root);
}

function longshow(root: HTMLElement): void {
	root.addClass("reel-view-body");
	// 34 seasons. The season strip is the one control whose layout depends on
	// how much data it is given.
	new DetailScreen(plugin, LONG_SHOW, () => {}, "Library").render(root);
}

function detailFilm(root: HTMLElement): void {
	root.addClass("reel-view-body");
	// The longest title in the fixtures, because the hero is where a long name
	// has the most room to break something.
	const screen = new DetailScreen(plugin, LIBRARY[0], () => {}, "Library");
	screen.render(root);
}

function quick(root: HTMLElement): void {
	root.addClass("reel-view-body");
	// Quick mode via a staged shortlist, which is the path the "Quick" button
	// takes. Reported as going white — and white is what a throw looks like,
	// since the container is emptied before the render that fails.
	const screen = new DiscoverScreen(plugin);
	(plugin as unknown as { discover: { takeStaged: () => unknown } }).discover.takeStaged = () => all.slice(0, 6);
	screen.render(root);
}

function discover(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const screen = new DiscoverScreen(plugin);
	screen.render(root);
}

function recipe(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(root, new RecipeSheet(plugin) as never);
}

function quickrate(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(root, new QuickRate(plugin, LIBRARY[0], {} as never) as never);
}

function logsheet(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(root, new LogSheet(plugin.app, plugin, { entry: LIBRARY[0], file: {} as never }) as never);
}

/*
 * No diary screen.
 *
 * Its painter lives inside a MarkdownRenderChild rather than being exported,
 * and exporting it purely so the harness could reach it would be changing the
 * thing being measured to suit the measurement. The Diary is covered by the
 * `viewings()` unit tests instead; when it next needs a layout change, that is
 * the moment to extract the painter for real reasons.
 */

const SCREENS: Record<string, (root: HTMLElement) => void> = {
	library,
	rows,
	stats,
	upnext,
	empties,
	stars,
	detail,
	detailFilm,
	discover,
	recipe,
	quickrate,
	logsheet,
	longshow,
	quick,
};

/* ------------------------------------------------------------------ */
/* Mount                                                               */
/* ------------------------------------------------------------------ */

const params = new URLSearchParams(location.search);
const wanted = params.get("screen") ?? "library";
const phone = params.get("phone") !== "0";

/**
 * Constrain the pane without touching the window.
 *
 * This is the case the stylesheet used to get wrong and the harness could not
 * see: Reel docked in a sidebar on a wide desktop. Every `@media (min-width:
 * 900px)` rule matched — the window really was that wide — and a 375px pane
 * was handed a three-column grid. The harness only ever tested a narrow pane
 * in a narrow window, where the two happen to agree, so it always passed.
 */
const paneWidth = Number(params.get("pane") ?? "") || 0;
if (paneWidth > 0) {
	document.body.setCssProps({ "--reel-harness-pane": `${paneWidth}px` });
	document.body.addClass("reel-harness-narrow-pane");
}

// Obsidian puts the theme on <body>, and every Reel colour resolves from
// there. The harness has to do the same, or a dark-theme check would quietly
// measure light-theme colours and pass.
document.body.classList.toggle("theme-dark", params.get("dark") === "1");
document.body.classList.toggle("theme-light", params.get("dark") !== "1");

/*
 * Obsidian's own mobile chrome, at the sizes it really uses.
 *
 * The harness rendered `.reel-view` into a bare page. The app wraps it in a
 * workspace leaf with a header above and a floating toolbar below, and *both*
 * have now caused bugs: the toolbar covered the tab bar, and the header covered
 * the search field for several releases while every check reported green.
 *
 * Modelled as overlays rather than as siblings deliberately — overlaying is the
 * behaviour that caused the harm, so it is the behaviour worth testing against.
 */
function mountObsidianChrome(app: HTMLElement): void {
	if (!phone) return;
	const header = app.createDiv({ cls: "view-header obsidian-chrome" });
	header.createDiv({ cls: "view-header-title", text: "Reel" });
	header.createEl("button", { cls: "clickable-icon", text: "☰", attr: { "aria-label": "Menu" } });
	app.createDiv({ cls: "mobile-toolbar obsidian-chrome" }).createEl("button", {
		cls: "clickable-icon",
		text: "＋",
		attr: { "aria-label": "New" },
	});
}

/** Render one screen into a fresh, correctly-classed view root. */
function mount(app: HTMLElement, name: string): HTMLElement {
	const view = app.createDiv({ cls: "reel-view" });
	// The same two classes ReelView sets. Without these the harness would
	// render the desktop layout at phone width and report a fixed bug.
	view.toggleClass("is-phone", phone);
	view.toggleClass("is-mobile", phone);
	// The classes the compact layout keys off, produced by the *same function*
	// the plugin calls. The harness used to compute `is-narrow` from
	// `window.innerWidth`, which meant it was testing its own arithmetic rather
	// than the app's — and the app's is where the bug was.
	//
	// Stamped twice: once before the screen draws, because some screens read
	// their own layout as they build; once after, on the width the pane
	// actually ended up with.
	stampWidth(view, measure(view) || window.innerWidth);
	/*
	 * Screens draw into a `.reel-view-body` *child*, as they do in the app.
	 *
	 * The harness used to put both classes on one element, so every screen
	 * rendered as a direct flex item of the view rather than as block content
	 * inside a scrolling body. That is not the box tree the app builds, and it
	 * gave the stats grid a different containing block — a 76px overflow that
	 * exists nowhere but here. A harness that models the wrong DOM reports
	 * bugs the user does not have and misses the ones they do.
	 */
	const body = view.createDiv({ cls: "reel-view-body" });
	try {
		(SCREENS[name] ?? library)(body);
	} catch (e) {
		body.createEl("pre", { text: `render failed: ${String(e)}\n${(e as Error)?.stack ?? ""}` });
	}
	stampWidth(view, measure(view) || window.innerWidth);
	// The same call the app makes, against the same chrome. Without it the
	// harness would model Obsidian's overlays and then not compensate for them,
	// which reports a bug the shipped code does not have.
	stampChromeInsets(view);
	return view;
}

const app = document.getElementById("app");

if (app) mountObsidianChrome(app);

if (app && params.get("audit") != null) {
	/**
	 * Check every screen in turn.
	 *
	 * Each is mounted alone and removed before the next: two views in the
	 * document at once would share a viewport, and every "is this taller than
	 * the screen" answer would be measured against the wrong thing.
	 */
	/*
	 * Sheets are skipped when the pane is artificially constrained.
	 *
	 * A sheet is `position: fixed`, so it escapes the wrapper the docked-pane
	 * pass uses to fake a narrow pane — it lays out across the whole window
	 * while still inheriting the view's narrow classes. The app never produces
	 * that pairing: a sheet is viewport-width by definition, and the phone
	 * passes already cover it at a real phone width.
	 *
	 * Logged rather than dropped quietly. A pass that silently covers less than
	 * it appears to is how a green tick stops meaning anything.
	 */
	const MODAL_SCREENS = new Set(["recipe", "logsheet", "quickrate"]);
	const skipped: string[] = [];

	const results: { screen: string; checks: Check[] }[] = [];
	for (const name of Object.keys(SCREENS)) {
		if (paneWidth > 0 && MODAL_SCREENS.has(name)) {
			skipped.push(name);
			continue;
		}
		const view = mount(app, name);
		results.push({ screen: name, checks: auditScreen(view, { phone }) });
		view.remove();
	}

	const failures = results.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => ({ ...c, screen: r.screen })));
	const total = results.reduce((n, r) => n + r.checks.length, 0);

	// In the title as well as the page, so pass or fail can be read without
	// parsing anything.
	document.title = failures.length ? `FAIL ${failures.length}/${total}` : `PASS ${total}`;

	const report = app.createDiv({ cls: "reel-audit" });
	report.createEl("h2", { text: document.title });
	if (!failures.length) {
		report.createEl("p", { text: `${Object.keys(SCREENS).length} screens, nothing to report.` });
	}
	for (const f of failures) {
		const row = report.createDiv({ cls: "reel-audit-row" });
		row.createEl("strong", { text: `${f.screen} · ${f.name}` });
		if (f.detail) row.createEl("code", { text: f.detail });
	}
	// A machine-readable copy, so a future CI step needs no scraping.
	(window as unknown as { REEL_AUDIT: unknown }).REEL_AUDIT = { total, failures, skipped };
} else if (app) {
	mount(app, wanted);
}

// A marker the screenshot step can wait on, rather than guessing at a delay.
document.body.dataset.reelReady = "1";
