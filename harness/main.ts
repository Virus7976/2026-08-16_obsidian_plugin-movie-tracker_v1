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
import { LIBRARY, SHOW, AWKWARD, LONG_SHOW, YEAR } from "./fixtures";
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
import { measure, stampWidth, stampChromeInsets, sizeBody, sheetFit } from "../src/util/panewidth";

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

/*
 * What the stubbed library reports, which is not always `all`.
 *
 * One screen — the stats page with a year of viewing behind it — needs a
 * different pool to say anything useful, and the charts read the library rather
 * than taking their data as an argument. Swapped around a single synchronous
 * paint and put back immediately; see `withPool`.
 */
let pool: Entry[] = all;

/** Render something against a different library, and always give it back. */
function withPool(rows: Entry[], run: () => void): void {
	pool = rows;
	try {
		run();
	} finally {
		// In a `finally` because the audit mounts every screen in one loop: a
		// screen that throws would otherwise leave every screen after it
		// reporting on the wrong library.
		pool = all;
	}
}

/**
 * What TMDB hands back for one film, as far as the detail screen cares.
 *
 * Sized for the awkward cases rather than the tidy ones: a cast longer than a
 * strip, a crew with several people sharing one job, and a recommendation whose
 * title does not fit — those are where this screen has broken before.
 */
const FILM_META = {
	id: 120,
	genres: [
		{ id: 12, name: "Adventure" },
		{ id: 14, name: "Fantasy" },
		{ id: 28, name: "Action" },
	],
	tagline: "One ring to rule them all.",
	status: "Released",
	original_language: "en",
	budget: 93_000_000,
	revenue: 871_500_000,
	production_companies: [{ id: 12, name: "New Line Cinema" }],
	credits: {
		cast: Array.from({ length: 14 }, (_, i) => ({
			id: 1000 + i,
			name: ["Elijah Wood", "Ian McKellen", "Viggo Mortensen", "Sean Astin", "Orlando Bloom"][i % 5],
			character: i % 4 === 0 ? "A Character With A Considerably Longer Name" : "Frodo",
			profile_path: null,
		})),
		crew: [
			{ id: 108, name: "Peter Jackson", job: "Director", profile_path: null },
			{ id: 109, name: "Fran Walsh", job: "Screenplay", profile_path: null },
			{ id: 110, name: "Philippa Boyens", job: "Screenplay", profile_path: null },
			{ id: 111, name: "Howard Shore", job: "Original Music Composer", profile_path: null },
		],
	},
	recommendations: {
		results: Array.from({ length: 8 }, (_, i) => ({
			id: 2000 + i,
			title: i === 0 ? "A Recommended Title That Will Not Fit On One Line" : `Related ${i}`,
			poster_path: "/rel.jpg",
			vote_average: 7 + (i % 3),
			release_date: `20${10 + i}-05-01`,
			media_type: "movie",
		})),
	},
	release_dates: {
		results: [
			{ iso_3166_1: "US", release_dates: [{ certification: "PG-13", release_date: "2001-12-19T00:00:00.000Z", type: 3 }] },
			{ iso_3166_1: "GB", release_dates: [{ certification: "PG", release_date: "2001-12-19T00:00:00.000Z", type: 3 }] },
		],
	},
	videos: { results: [] },
};

const plugin = {
	settings: { ...DEFAULT_SETTINGS, recentSearches: ["Inside Man"] },
	app: { vault: { getAbstractFileByPath: () => null }, workspace: { getLeaf: () => null } },
	library: {
		all: () => pool,
		films: () => pool.filter((e) => e.type === "film"),
		shows: () => pool.filter((e) => e.type === "tv"),
		inProgress: () => pool.filter((e) => e.type === "tv"),
		byPath: (p: string) => pool.find((e) => e.path === p),
		byTmdbId: (id: number) => pool.find((e) => e.tmdbId === id),
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
		/*
		 * The half of the detail screen nobody had ever seen.
		 *
		 * `getFilm` was missing from this stub, so `renderFacets` threw and the
		 * screen ended with "this.plugin.tmdb.getFilm is not a function" printed
		 * where the cast strip, the credit rows and eight tabs should be. Every
		 * check passed, because a caught error renders as one line of text and
		 * one line of text has no layout faults.
		 *
		 * Two screens have now been audited green for weeks while showing an
		 * error message. A stub that throws is not a neutral omission — it
		 * silently removes whatever it was standing in for from the test.
		 */
		getFilm: async () => FILM_META,
		getShow: async () => FILM_META,
		getImages: async () => ({ backdrops: [], posters: [] }),
		getSeason: async () => ({ episodes: [] }),
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
function library(root: HTMLElement, rows: Entry[] = all): void {
	const header = root.createDiv({ cls: "reel-view-header" });
	// The navigation dropdown that replaces the tab row on a narrow pane. The
	// harness has to build it or the audit measures a header that no longer
	// matches the one that ships.
	const navBtn = header.createEl("button", { cls: "reel-nav-btn" });
	navBtn.createSpan({ cls: "reel-nav-icon", text: "▣" });
	navBtn.createSpan({ cls: "reel-nav-label", text: "Library" });
	navBtn.createSpan({ cls: "reel-nav-chevron", text: "▾" });
	/*
	 * No `search-input-container` here, matching what the app does once the
	 * field docks.
	 *
	 * That class is Obsidian's, and having it is right in the header — it is
	 * what makes the field inherit the user's theme. Docked at the bottom the
	 * wrap is a pill Reel draws itself, and both Obsidian and the theme still
	 * style the class: a border and background on the container, another border
	 * on the input inside, and the magnifier pinned absolutely to the left. A
	 * device photo showed exactly that — two rounded rectangles, and the
	 * magnifier printed over the word being typed.
	 */
	const wrap = header.createDiv({ cls: "reel-search-wrap" });
	wrap.createSpan({ cls: "reel-search-icon", text: "⌕" });
	wrap.createEl("input", {
		cls: "reel-input reel-search-input",
		attr: { type: "search", placeholder: "Search titles, people, characters, plots…" },
	});
	wrap.createEl("button", { cls: "reel-search-clear clickable-icon", text: "×" });
	// No add button: it moved to a native view action via addAction().

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

	// The bar as it ships now: what is set, and a button for everything else.
	// Long labels on purpose — a director's name and a list called something
	// unreasonable are the cases that used to widen the whole pane.
	filterBar(filters, ["Films", "Science Fiction", "☰ Christmas with the family"]);

	const body = root.createDiv({ cls: "reel-view-body" });
	// The band replaced the bare "39 titles" line: the count is its headline, and
	// two of them would be one more row of chrome on the screen that has fought
	// hardest for its vertical space. A deliberately long subtitle, because it is
	// the part that must ellipsise rather than wrap or widen the pane.
	heroBand(body, {
		label: "Your library",
		title: `${rows.length} titles`,
		sub: `Most recently — ${rows[0].title} · 14 to watch · 2 hidden by content filter`,
		art: false,
		compact: true,
	});
	renderPosterGrid(plugin, body, rows);
}

/**
 * The library as it exists after a year of use, rather than after a demo.
 *
 * `library` keeps its 35 titles: a shortish grid is the case where the filter
 * chrome has the most room to misbehave relative to the content, and that is
 * where the "chrome before the first poster" faults have all been found.
 *
 * This is the other end. A grid with a hundred-plus posters is where lazy
 * loading, scroll height and the sheer weight of the first paint show up, and
 * none of that has ever been rendered here.
 */
function libraryYear(root: HTMLElement): void {
	withPool(YEAR, () => library(root, YEAR));
}

/**
 * The filter bar, as the view draws it.
 *
 * One row: a Filters button carrying a count, then one removable chip per
 * filter that is actually on. The audit cares that this stays a single row
 * whose width is the pane's — the six-row stack it replaced is what made the
 * first poster start below the fold.
 */
function filterBar(into: HTMLElement, active: string[], sort = true): HTMLElement {
	const bar = into.createDiv({ cls: "reel-chips reel-filterbar" });
	const open = bar.createEl("button", { cls: "reel-chip reel-filter-btn" });
	open.createSpan({ cls: "reel-filter-btn-icon", text: "⚙" });
	open.createSpan({ text: "Filters" });
	if (active.length) open.createSpan({ cls: "reel-filter-count", text: String(active.length) });

	// Sort and layout share the row rather than owning one each. Three stacked
	// rows of controls above two posters is a control panel with a preview pane
	// attached, which is what the device screenshot showed.
	if (sort) {
		const sel = bar.createEl("select", { cls: "reel-select dropdown reel-sort-select" });
		sel.createEl("option", { text: "Recently watched" });
		const layout = bar.createEl("button", { cls: "reel-chip reel-layout-btn" });
		layout.createSpan({ cls: "reel-layout-icon", text: "▦" });
		layout.createSpan({ cls: "reel-layout-label", text: "Posters" });
		bar.createSpan({ cls: "reel-chip-sep", text: "·" });
	}

	for (const label of active) {
		const tag = bar.createEl("button", { cls: "reel-chip is-active reel-filter-tag" });
		tag.createSpan({ text: label });
		tag.createSpan({ cls: "reel-filter-x", text: "×" });
	}
	return bar;
}

/**
 * A review as the detail screen shows it.
 *
 * Prose rather than metadata, which is the point — it has to read differently
 * from the facts around it, and it has to wrap rather than widen the pane.
 */
function reviewPane(into: HTMLElement, editable = true): HTMLElement {
	const pane = into.createDiv({ cls: "reel-yours" });
	pane.createDiv({ cls: "reel-yours-label", text: "Your review" });
	const item = pane.createDiv({ cls: "reel-yours-item" });
	const head = item.createDiv({ cls: "reel-yours-head" });
	head.createSpan({ cls: "reel-yours-date", text: "4 Aug 2026" });
	head.createSpan({ cls: "reel-yours-stars", text: "★★★★" });
	if (editable) head.createEl("button", { cls: "reel-yours-edit clickable-icon", text: "✎" });
	item.createDiv({
		cls: "reel-yours-body",
		text:
			"Held up far better than I expected. The middle hour drags, and then the last twenty minutes " +
			"earn every bit of it back — I have not stopped thinking about the final shot since.",
	});
	if (editable) {
		const add = pane.createEl("button", { cls: "reel-yours-add" });
		add.createSpan({ text: "+" });
		add.createSpan({ text: "Add another" });
	}
	return pane;
}

/**
 * The Discover feed, mid-scroll.
 *
 * Two mounted shelves, each ending in the sentinel that fetches its next page,
 * and the page-level sentinel underneath. All three are elements the audit has
 * to see, because an endless feed that pushes the pane sideways is worse than a
 * short one that does not.
 */
function feed(root: HTMLElement): void {
	root.addClass("reel-view-body");
	root.addClass("reel-discover");

	const head = root.createDiv({ cls: "reel-discover-head" });
	head.createDiv({
		cls: "reel-discover-note",
		text: "Based on your library — mostly drama, science fiction, thriller.",
	});
	const refresh = head.createEl("button", { cls: "reel-chip reel-refresh" });
	refresh.createSpan({ cls: "reel-refresh-icon", text: "⟳" });
	refresh.createSpan({ text: "Refresh" });

	const feedEl = root.createDiv({ cls: "reel-feed" });
	for (const [title, reason] of [
		["Because you liked Sinners", "Age limit does not apply to this row"],
		["Science fiction from the nineties", ""],
	] as const) {
		const section = feedEl.createDiv({ cls: "reel-drow" });
		const h = section.createDiv({ cls: "reel-drow-head" });
		h.createDiv({ cls: "reel-drow-title", text: title });
		if (reason) h.createDiv({ cls: "reel-drow-reason", text: reason });
		const strip = section.createDiv({ cls: "reel-drow-strip" });
		for (const e of all.slice(0, 10)) {
			const card = strip.createDiv({ cls: "reel-dcard" });
			plugin.posters.attach(card.createDiv({ cls: "reel-dcard-poster" }), e);
			card.createDiv({ cls: "reel-dcard-title", text: e.title });
		}
		strip.createDiv({ cls: "reel-drow-tail" });
	}

	const end = root.createDiv({ cls: "reel-feed-end" });
	end.createDiv({ cls: "reel-loading", text: "Loading more…" });
}

/** The filter sheet, open. Every option at full height, which is the trade. */
function filterSheet(root: HTMLElement): void {
	const modal = root.createDiv({ cls: "reel-modal reel-filter-sheet reel-sheet" });
	const head = modal.createDiv({ cls: "reel-filter-head" });
	head.createEl("h3", { cls: "reel-log-title", text: "Filters" });
	head.createEl("button", { cls: "reel-btn reel-filter-clear", text: "Clear all" });

	const body = modal.createDiv({ cls: "reel-filter-body" });
	const section = (label: string, values: string[], activeAt = -1) => {
		const box = body.createDiv({ cls: "reel-filter-section" });
		box.createDiv({ cls: "reel-filter-label", text: label });
		const chips = box.createDiv({ cls: "reel-chips reel-filter-chips" });
		values.forEach((v, i) => {
			const b = chips.createEl("button", { cls: "reel-chip", text: v });
			if (i === activeAt) b.addClass("is-active");
		});
	};

	section("Type", ["Everything", "Films", "Series"], 1);
	section("Status", ["watched", "watchlist", "watching", "completed", "paused", "abandoned"]);
	// Every genre, not the first fourteen — the cap existed because the bar was
	// one line, and a sheet scrolls.
	section(
		"Genre",
		[
			"Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family",
			"Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Science Fiction",
			"Thriller", "War", "Western",
		],
		14
	);
	section("Lists", ["Christmas with the family", "Rewatch pile", "Letterboxd top 250"]);

	const sortBox = body.createDiv({ cls: "reel-filter-section" });
	sortBox.createDiv({ cls: "reel-filter-label", text: "Sort" });
	const sel = sortBox.createEl("select", { cls: "reel-select dropdown" });
	sel.createEl("option", { text: "Recently watched" });
	sortBox.createDiv({ cls: "reel-filter-label", text: "Then by" });
	const sel2 = sortBox.createEl("select", { cls: "reel-select dropdown" });
	sel2.createEl("option", { text: "My rating" });
}

/**
 * Reviews, on the two surfaces that show them.
 *
 * `DetailScreen` draws the real pane, but it fills in from a file read that
 * the harness has no vault for — so it removes itself and the audit measures
 * nothing. This mounts the same markup directly, in both its shapes: the
 * editable block on a detail screen, and the clipped two-line aside on a diary
 * row, where a long review would otherwise turn a list of viewings into a wall
 * of text.
 */
function reviews(root: HTMLElement): void {
	root.addClass("reel-view-body");
	root.addClass("reel-detail");
	reviewPane(root, true);

	const empty = root.createDiv({ cls: "reel-yours" });
	empty.createDiv({ cls: "reel-yours-label", text: "Your review" });
	const box = empty.createDiv({ cls: "reel-yours-empty" });
	box.createDiv({ cls: "reel-dim", text: "You have not written about this one yet." });
	const write = box.createEl("button", { cls: "reel-btn" });
	write.createSpan({ text: "✎" });
	write.createSpan({ text: "Write a review" });

	const diary = root.createDiv({ cls: "reel-diary" });
	for (const e of all.slice(0, 3)) {
		const row = diary.createDiv({ cls: "reel-diary-row" });
		row.createDiv({ cls: "reel-diary-day", text: "4" });
		plugin.posters.attach(row.createDiv({ cls: "reel-diary-thumb" }), e);
		const body = row.createDiv({ cls: "reel-diary-body" });
		body.createDiv({ cls: "reel-diary-title", text: e.title });
		const meta = body.createDiv({ cls: "reel-diary-meta" });
		meta.createSpan({ cls: "reel-dim", text: "4 Aug 2026" });
		const pane = body.createDiv({ cls: "reel-yours" });
		const item = pane.createDiv({ cls: "reel-yours-item" });
		item.createDiv({
			cls: "reel-yours-body",
			text:
				"Held up far better than I expected. The middle hour drags, and then the last twenty " +
				"minutes earn every bit of it back — I have not stopped thinking about the final shot.",
		});
	}
}

/**
 * The artwork band, as every tab now wears it.
 *
 * Two shapes, both audited: a real backdrop, which is a photograph under a
 * scrim, and a blurred poster, which is a texture. The pale case is the one
 * that matters — a hero reads correctly over a dark poster whether or not the
 * scrim is doing its job, and half of any library is pale.
 */
function heroBand(
	into: HTMLElement,
	opts: { label: string; title: string; sub?: string; art: boolean; compact?: boolean }
): HTMLElement {
	const band = into.createDiv({ cls: "reel-hero-band has-backdrop" });
	if (opts.compact) band.addClass("is-compact");
	if (opts.art) band.addClass("has-art");
	const wrap = band.createDiv({ cls: "reel-hero-art" });
	wrap
		.createDiv({ cls: "reel-hero-art-base" })
		.setCssProps({ "--reel-backdrop": `url("${poster(all[0].title)}")` });
	if (opts.art) {
		wrap.createEl("img", { cls: "reel-hero-art-img", attr: { src: poster(all[0].title), alt: "" } });
	}
	const body = band.createDiv({ cls: "reel-hero-band-body" });
	body.createDiv({ cls: "reel-hero-band-label", text: opts.label });
	body.createDiv({ cls: "reel-hero-band-title", text: opts.title });
	if (opts.sub) body.createDiv({ cls: "reel-hero-band-sub", text: opts.sub });
	return band;
}

/**
 * The dense grid — "an easy way to view all of these at once".
 *
 * The captioned grid is two columns on a phone because a title needs about
 * 110px before it truncates to "The Equaliz…". Take the caption away and the
 * poster can be small enough to fit five across, which is the difference
 * between looking at your library and scrolling past it.
 *
 * The audit's job here is the badges: they do not shrink with the poster, so
 * at 68px a certification chip and a watchlist flag cover most of the art.
 */
function dense(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const wrap = root.createDiv({ cls: "reel-gridwrap is-dense" });
	renderPosterGrid(plugin, wrap, [...all, ...all, ...all]);
}

/**
 * The library mid-search, with the field docked against the keyboard.
 *
 * Obsidian's own mobile search puts the input at the bottom and lets results
 * fill upward, and that is the shape being copied: the thumb is already down
 * there, and a field at the top spends its life in a fight with the thing
 * covering half the screen.
 *
 * The audit's job here is the one that matters — `controlsNotCovered`. A fixed
 * element over a scrolling list is exactly how the search field ended up
 * underneath Obsidian's header in the first place, and this is the same trick
 * pointed the other way.
 */
function searching(root: HTMLElement): void {
	root.addClass("is-searching");

	/*
	 * `is-open`, because that is the only state this screen exists in.
	 *
	 * Without it the header keeps the collapsed grid it uses before you ask for
	 * the field, the wrap measures 0x0, and every check skips it — `width < 2`
	 * is the first line of `controlsNotCovered`. Two releases of a docked search
	 * field were audited as a zero-sized element and reported green.
	 */
	const header = root.createDiv({ cls: "reel-view-header is-open" });
	const navBtn = header.createEl("button", { cls: "reel-nav-btn" });
	navBtn.createSpan({ cls: "reel-nav-icon", text: "▣" });
	navBtn.createSpan({ cls: "reel-nav-label", text: "Library" });
	navBtn.createSpan({ cls: "reel-nav-chevron", text: "▾" });

	const wrap = header.createDiv({ cls: "reel-search-wrap search-input-container" });
	wrap.createSpan({ cls: "reel-search-icon", text: "⌕" });
	const input = wrap.createEl("input", {
		cls: "reel-input reel-search-input",
		attr: { type: "search", placeholder: "Search titles, people, characters, plots…" },
	});
	input.value = "the dog";
	wrap.createEl("button", { cls: "reel-search-clear clickable-icon", text: "×" });

	const filters = root.createDiv({ cls: "reel-view-filters" });
	filterBar(filters, ["“the dog”"]);

	const body = root.createDiv({ cls: "reel-view-body" });
	renderPosterGrid(plugin, body, all.slice(0, 6));
}

/**
 * The "seen it" sheet, which is the surface this app is used through.
 *
 * Modelled at its worst: a title long enough to need clamping, every meta chip
 * present, and the readout in its set state. The poster is the part the audit
 * has to see — it is a fixed 76px beside text that must shrink rather than push
 * the sheet wider, which is the same min-width defect that has widened four
 * other rows in this codebase.
 */
function seensheet(root: HTMLElement): void {
	const modal = root.createDiv({ cls: "reel-modal reel-seensheet reel-sheet has-accent" });
	modal.setCssProps({
		"--reel-accent-h": "18",
		"--reel-accent-s": "78%",
		"--reel-accent-l": document.body.classList.contains("theme-dark") ? "58%" : "40%",
	});

	const head = modal.createDiv({ cls: "reel-seen-head" });
	const art = head.createDiv({ cls: "reel-seen-poster" });
	art.createEl("img", { attr: { src: poster(all[0].title), alt: "" } });
	const who = head.createDiv({ cls: "reel-seen-who" });
	who.createDiv({
		cls: "reel-seen-title",
		text: "The Assassination of Jesse James by the Coward Robert Ford",
	});
	const meta = who.createDiv({ cls: "reel-seen-meta" });
	meta.createSpan({ text: "2007" });
	meta.createSpan({ cls: "reel-badge subtle", text: "Film" });
	meta.createSpan({ cls: "reel-dim", text: "★ 7.5" });
	who.createDiv({ cls: "reel-seen-note", text: "Adding as watched." });

	const starRow = modal.createDiv({ cls: "reel-rating-row big centred" });
	const stars = starRow.createDiv({ cls: "reel-stars" });
	for (let i = 1; i <= 5; i++) {
		const star = stars.createDiv({ cls: `reel-star${i <= 4 ? " is-full" : ""}` });
		star.createSpan({ cls: "reel-star-bg", text: "★" });
		star.createSpan({ cls: "reel-star-fg", text: "★" });
	}
	modal.createDiv({ cls: "reel-seen-readout is-set", text: "4 — Great" });

	const actions = modal.createDiv({ cls: "reel-log-actions" });
	actions.createEl("button", { cls: "reel-btn mod-cta", text: "Add without rating" });
	actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
}

/**
 * The update notes, modelled at their worst case.
 *
 * Three releases at once — what someone who skipped a couple of updates
 * actually gets — with the longest headline and a "before" line on the items
 * that have one. The rig builds the real DOM rather than instantiating the
 * modal, because the modal wants an `App` and the screen is worth checking on
 * its geometry alone: a sticky action row over a scrolling list is the same
 * shape that put a Save button under the keyboard once already.
 */
function whatsnew(root: HTMLElement): void {
	const modal = root.createDiv({ cls: "reel-modal reel-whatsnew reel-sheet" });

	const head = modal.createDiv({ cls: "reel-wn-head" });
	head.createDiv({ cls: "reel-wn-eyebrow", text: "Reel" });
	head.createDiv({ cls: "reel-wn-title", text: "What's new" });
	head.createDiv({
		cls: "reel-wn-headline",
		text: "Reel tells you what it changed, and Stats reads like a page rather than a pile of numbers.",
	});

	const body = modal.createDiv({ cls: "reel-wn-body" });
	const releases: [string, string, string, [string, string, string?][]][] = [
		[
			"0.8.8",
			"20 August 2026",
			"",
			[
				[
					"new",
					"This screen. After an update, Reel shows what changed since the version you were on.",
					"Reel updates through BRAT, which swaps the file out silently. Everything fixed here was something you reported, and there was no way to tell it had landed.",
				],
				["better", "Stats headline numbers sit on their own cards with the unit beside them."],
			],
		],
		[
			"0.8.7",
			"20 August 2026",
			"The search box stops fighting Obsidian's floating + button.",
			[
				[
					"fixed",
					"The + button no longer sits on top of the search field.",
					"Reel was looking for a full-width toolbar and a round corner button never matched.",
				],
				["fixed", "The magnifier no longer prints over the first characters you type."],
			],
		],
		[
			"0.8.6",
			"20 August 2026",
			"The search field docks above the keyboard and stays there.",
			[["better", "While searching, the field sits just above the keyboard."]],
		],
	];

	for (const [version, date, summary, changes] of releases) {
		const sec = body.createDiv({ cls: "reel-wn-release" });
		const bar = sec.createDiv({ cls: "reel-wn-relhead" });
		bar.createSpan({ cls: "reel-wn-version", text: version });
		bar.createSpan({ cls: "reel-wn-date", text: date });
		if (summary) sec.createDiv({ cls: "reel-wn-relsummary", text: summary });
		const list = sec.createDiv({ cls: "reel-wn-list" });
		for (const [kind, what, note] of changes) {
			const row = list.createDiv({ cls: `reel-wn-item is-${kind}` });
			row.createSpan({ cls: "reel-wn-kind", text: kind === "new" ? "New" : kind === "better" ? "Better" : "Fixed" });
			const text = row.createDiv({ cls: "reel-wn-text" });
			text.createDiv({ cls: "reel-wn-what", text: what });
			if (note) text.createDiv({ cls: "reel-wn-note", text: note });
		}
	}

	const actions = modal.createDiv({ cls: "reel-log-actions reel-wn-actions" });
	actions.createEl("button", { cls: "reel-btn mod-cta", text: "Got it" });
}

/**
 * The passphrase prompt, which is the screen that decides whether the plugin
 * works at all.
 *
 * Reported twice as "there is nothing on screen": the field had focus, the
 * keyboard was up, and the sheet was behind it. Being unable to type a
 * passphrase means being unable to unlock the API keys, and there is no way
 * around it from inside the app.
 *
 * Modelled with the confirm field present, which is the taller of its two
 * shapes and therefore the one that runs out of screen first.
 */
function passphrase(root: HTMLElement): void {
	const modal = root.createDiv({ cls: "reel-modal reel-sheet reel-prompt" });
	modal.createEl("h3", { cls: "reel-prompt-title", text: "Unlock your API keys" });
	modal.createEl("p", {
		cls: "reel-prompt-body",
		text: "Reel encrypts your TMDB and OMDb keys. Enter the passphrase you set to use them this session.",
	});
	for (const ph of ["Passphrase", "Confirm passphrase"]) {
		modal.createEl("input", {
			cls: "reel-input",
			attr: { type: "password", placeholder: ph, autocomplete: "off" },
		});
	}
	const actions = modal.createDiv({ cls: "reel-prompt-actions" });
	actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
	actions.createEl("button", { cls: "reel-btn mod-cta", text: "Unlock" });
}

function rows(root: HTMLElement): void {
	root.addClass("reel-view-body");
	renderRowList(plugin, root, all.slice(0, 8));
}

/**
 * The stats page, wearing an accent — which is the case that actually ships.
 *
 * Every surface, separator and bar on this page now derives from
 * `--reel-accent-*`, set at runtime from the dominant colour of your most
 * recent poster. The harness stubs `swatches.tint` to a no-op, so until now the
 * audit had only ever measured the *fallback* — a mid blue nobody sees once
 * there is a poster in the library.
 *
 * The value used is the worst case rather than a pretty one. `usableAccent`
 * clamps lightness to 30–48% on a light theme and 48–78% on a dark one, so the
 * boundary nearest the page background is where accent-tinted ink has the least
 * contrast to give. If it passes there it passes everywhere.
 */
function tintWorstCase(el: HTMLElement): void {
	const dark = document.body.classList.contains("theme-dark");
	el.setCssProps({
		// Yellow-green, which `usableAccent` singles out as the hue that reads
		// lightest at a given L and therefore needs the most help.
		"--reel-accent-h": "84",
		"--reel-accent-s": "85%",
		"--reel-accent-l": dark ? "55%" : "42%",
	});
}

function stats(root: HTMLElement): void {
	root.addClass("reel-view-body");
	tintWorstCase(root);
	paintStats(plugin, root, { include: "all" });
}

/**
 * The stats page with a year of watching behind it.
 *
 * The plain `stats` screen stays as it is: four titles is the *empty-ish*
 * case, and "does this look sensible when there is barely any data" is a real
 * question — it is where a chart with one row and a full-width bar lives.
 *
 * This is the other half. Every chart here answers a question about
 * distribution, and against four titles the day-of-week chart was five zeroes,
 * the rating histogram was ten empty rows, and every bar that was not zero was
 * 100% wide. That is how a gradient fill that made length unreadable survived
 * for weeks: there was no length to read.
 */
function statsYear(root: HTMLElement): void {
	root.addClass("reel-view-body");
	tintWorstCase(root);
	withPool(YEAR, () => paintStats(plugin, root, { include: "all" }));
}

function upnext(root: HTMLElement): void {
	root.addClass("reel-view-body");
	heroBand(root, { label: "Tonight", title: "6 on the go", sub: "Severance — up to S2E4", art: true, compact: true });
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
	libraryYear,
	dense,
	searching,
	seensheet,
	whatsnew,
	passphrase,
	feed,
	filterSheet,
	reviews,
	rows,
	stats,
	statsYear,
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
/*
 * Whether this run models a phone with the keyboard open.
 *
 * Not inferred from the window height: a short window and a keyboard look
 * identical to the layout and ask different questions of it. "Is the browsing
 * chrome eating the screen" is a question about a screen at rest; "can you see
 * the box you are typing into" is a question about this one.
 */
const keyboard = params.get("keyboard") === "1";

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

/*
 * Chrome sizes taken from a device snapshot, when one is supplied.
 *
 * The harness's own header and toolbar are 48px because that is what one
 * Android phone reported. `?chromeTop=&chromeBottom=` lets a real snapshot
 * override them, so replaying a device is a URL rather than an edit.
 */
const chromeTop = Number(params.get("chromeTop") ?? "") || 0;
const chromeBottom = Number(params.get("chromeBottom") ?? "") || 0;
if (chromeTop || chromeBottom) {
	document.body.setCssProps({
		"--harness-chrome-top": `${chromeTop || 48}px`,
		"--harness-chrome-bottom": `${chromeBottom || 48}px`,
	});
}
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
	/*
	 * A decoy header, first in document order and zero-sized.
	 *
	 * This is what a real phone actually contains: Obsidian keeps a
	 * `.view-header` in every workspace leaf, including closed and collapsed
	 * ones. `querySelector` returned that 0x0 element instead of the 384x45 one
	 * genuinely covering the view, so the inset computed as zero and the search
	 * field stayed buried through three separate attempts to fix it.
	 *
	 * The harness had one leaf and one header, so the first match was always
	 * the right one and nothing here could ever fail. It fails now.
	 */
	app.createDiv({ cls: "view-header obsidian-chrome-decoy" });
	const header = app.createDiv({ cls: "view-header obsidian-chrome" });
	header.createDiv({ cls: "view-header-title", text: "Reel" });
	header.createEl("button", { cls: "clickable-icon", text: "☰", attr: { "aria-label": "Menu" } });
	/*
	 * The bottom bar carries a name this code does not know.
	 *
	 * A real device reported `.mobile-toolbar: absent` and `.mobile-navbar:
	 * absent` while a navigation bar sat on top of the last row of posters —
	 * the body had `is-floating-nav`, so Obsidian was drawing something under a
	 * third name. Naming it `.mobile-toolbar` here would let the named-selector
	 * path find it and leave the fallback untested, which is how the header
	 * fault survived three fixes.
	 */
	app.createDiv({ cls: "harness-unnamed-nav obsidian-chrome" }).createEl("button", {
		cls: "clickable-icon",
		text: "＋",
		attr: { "aria-label": "New" },
	});

	/*
	 * The floating **+**, which is a button in a corner and not a bar.
	 *
	 * A device photo showed it sitting squarely on top of the docked search
	 * field. The rig could not have caught that: the only floating chrome it
	 * modelled was a full-width bar, and the app's own detection requires 40%
	 * of the view's width — so a 56px corner button was invisible to both, and
	 * `controlsNotCovered` reported the screen green while the + covered the
	 * field's right end.
	 *
	 * Deliberately unnamed, for the same reason the bar above is: naming it
	 * something Obsidian might call it would test a selector rather than the
	 * shape-matching that has to work when the next release renames things.
	 */
	app.createDiv({ cls: "harness-unnamed-fab obsidian-chrome" }).createEl("button", {
		cls: "clickable-icon",
		text: "＋",
		attr: { "aria-label": "New note" },
	});
}

/** Render one screen into a fresh, correctly-classed view root. */
function mount(app: HTMLElement, name: string): HTMLElement {
	// `view-content` too, because that is what Obsidian calls this element and
	// what a theme targets. Without it the harness cannot see a theme outranking
	// the plugin — which is exactly how the header inset failed three times.
	const view = app.createDiv({ cls: "view-content reel-view" });
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
	/*
	 * `library` builds the whole view — header, tabs, filters *and* body — just
	 * as `ReelView.build()` does, so it needs the view root. Every other screen
	 * is body content and gets a body.
	 *
	 * Handing the body to `library` produced a `.reel-view-body` nested inside
	 * another one, a tree the app never builds. The inner body is not a flex
	 * child of `.reel-view`, so it cannot take the sizing that governs the real
	 * one — and a check written about the real body was reporting on a fake.
	 */
	/*
	 * Screens that build a whole view — header, filters and body — take the view
	 * root. Everything else gets a body to draw into.
	 *
	 * A list rather than one name, because adding `searching` reproduced the
	 * exact defect the paragraph above describes: it built its own
	 * `.reel-view-body` inside the one handed to it, and `bodyScrollsNotClips`
	 * dutifully reported 917px in an 812px view. The number was real and it was
	 * measuring the rig.
	 */
	const FULL_VIEW = new Set(["library", "libraryYear", "searching"]);
	const target = FULL_VIEW.has(name) ? view : view.createDiv({ cls: "reel-view-body" });
	try {
		(SCREENS[name] ?? library)(target);
	} catch (e) {
		target.createEl("pre", { text: `render failed: ${String(e)}\n${(e as Error)?.stack ?? ""}` });
	}
	stampWidth(view, measure(view) || window.innerWidth);
	// The same call the app makes, against the same chrome. Without it the
	// harness would model Obsidian's overlays and then not compensate for them,
	// which reports a bug the shipped code does not have.
	stampChromeInsets(view);
	// The same sizing the app performs. Without it the harness lays out a body
	// the app never produces, and a check about the app reports on the rig.
	const realBody = view.querySelector<HTMLElement>(":scope > .reel-view-body");
	if (realBody) sizeBody(view, realBody);
	return view;
}

/*
 * The same measured sheet cap the plugin installs.
 *
 * Without it the rig exercises the `88dvh` fallback rather than the code that
 * ships, and the check written for a sheet overflowing its screen would be
 * measuring a value the app never uses.
 */
sheetFit();

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
	const MODAL_SCREENS = new Set(["recipe", "logsheet", "quickrate", "filterSheet", "seensheet", "whatsnew", "passphrase"]);
	const skipped: string[] = [];

	const results: { screen: string; checks: Check[] }[] = [];
	for (const name of Object.keys(SCREENS)) {
		if (paneWidth > 0 && MODAL_SCREENS.has(name)) {
			skipped.push(name);
			continue;
		}
		const view = mount(app, name);
		results.push({ screen: name, checks: auditScreen(view, { phone, keyboard }) });
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
