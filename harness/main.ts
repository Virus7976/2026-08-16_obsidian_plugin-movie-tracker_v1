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
import { LIBRARY, SHOW } from "./fixtures";
import type { Entry } from "../src/types";
import { renderPosterGrid, renderRowList } from "../src/render/grid";
import { paintStats } from "../src/render/stats";
import { paintUpNext } from "../src/render/upnext";
import { renderEmpty } from "../src/ui/empty";
import { skeletonCards, skeletonGrid } from "../src/ui/skeleton";
import { renderStars } from "../src/ui/stars";
import { DEFAULT_SETTINGS } from "../src/settings";

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

const all = [...LIBRARY, SHOW];

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

const SCREENS: Record<string, (root: HTMLElement) => void> = {
	library,
	rows,
	stats,
	upnext,
	empties,
	stars,
};

/* ------------------------------------------------------------------ */
/* Mount                                                               */
/* ------------------------------------------------------------------ */

const params = new URLSearchParams(location.search);
const wanted = params.get("screen") ?? "library";
const phone = params.get("phone") !== "0";

const app = document.getElementById("app");
if (app) {
	const view = app.createDiv({ cls: "reel-view" });
	// The same two classes ReelView sets. Without these the harness would
	// render the desktop layout at phone width and report a fixed bug.
	view.toggleClass("is-phone", phone);
	view.toggleClass("is-mobile", phone);

	const paint = SCREENS[wanted] ?? library;
	try {
		paint(view);
	} catch (e) {
		view.createEl("pre", { text: `render failed: ${String(e)}\n${(e as Error)?.stack ?? ""}` });
	}
}

// A marker the screenshot step can wait on, rather than guessing at a delay.
document.body.dataset.reelReady = "1";
