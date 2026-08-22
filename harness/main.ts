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
import { paintUpcoming } from "../src/render/calendar";
import { renderEmpty } from "../src/ui/empty";
import { skeletonCards, skeletonGrid } from "../src/ui/skeleton";
import { renderStars } from "../src/ui/stars";
import { DetailScreen } from "../src/ui/detail";
import { DiscoverScreen, PreviewSheet } from "../src/ui/discoverView";
import { RecipeSheet } from "../src/ui/recipeSheet";
import { QuickRate } from "../src/ui/quickRate";
import { RateScreen } from "../src/ui/rate";
import { LogSheet } from "../src/ui/logSheet";
import { FilterSheet, emptyFilters } from "../src/ui/filterSheet";
import { SeasonSheet } from "../src/ui/seasonSheet";
import { PersonSheet } from "../src/ui/personSheet";
import { ReelSettingTab } from "../src/settings";
import { SetupSheet } from "../src/ui/setupSheet";
import { ConfirmModal } from "../src/ui/confirm";
import { FEATURES } from "../src/setup";
import { traktComplaint } from "../src/publish/compose";
import { BLOCKERS } from "../src/publish";

/** Set by the first-run scene so the credential stub reports an empty vault. */
let noKeys = false;
/*
 * Set by the locked scene: keys stored, none of them readable.
 *
 * Distinct from `noKeys` on purpose, because the two states differ in exactly
 * the way that matters. Nothing configured and everything configured but sealed
 * look the same to any code that asks whether a key can be read, and they are
 * opposite answers to the only question a person has.
 */
let locked = false;
/*
 * Set by the Ask scenes so `ai.configured` can be false.
 *
 * Pinned true, the one screen a person meets when they open Ask before setting
 * it up could not be drawn at all — and `configured` is two conditions, not
 * one, so there are two ways to be in it and they want different sentences.
 */
let aiOff = false;
/* Set by the publish scene that models an install with no destination set up. */
let noTargets = false;
/* Set by the scene that models a review already sent to one of the two. */
let alreadySent = false;
/*
 * Keys a scene wants to be *missing* while the rest are present.
 *
 * Everything-or-nothing was enough while a guide could only be shown from the
 * outside. Now that it reports which of its steps are already behind you, the
 * state worth measuring is the mixed one — some ticked, some not, on the same
 * list — which is also the realistic one: the Trakt application pasted, the
 * sign-in not yet done.
 */
const missing = new Set<string>();
/*
 * ...and keys a scene wants present that the default stub withholds.
 *
 * Mastodon is reported absent by default so the settings screen has one
 * unconfigured feature to draw. Its own guide needs the opposite.
 */
const present = new Set<string>();

/*
 * A fixed clock for the health fixtures.
 *
 * The screen renders "checked 3 hours ago", which is a phrase computed from
 * the real clock against this. Anchoring the fixtures to a literal would drift
 * a little every run and eventually cross a unit boundary mid-audit; anchoring
 * them to now keeps the words stable and the layout with them.
 */
const FIXED_NOW = Date.now();
import { PublishSheet } from "../src/ui/publishSheet";
import { AskSheet } from "../src/ui/askSheet";
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

/**
 * One page of feed results, as TMDB shapes them.
 *
 * Offset by row and by page so no two shelves show the same eight posters — a
 * feed where every row is identical looks like one row repeated, and hides the
 * horizontal-paging faults these rows exist to expose.
 */
function feedPage(offset: number, page: number): Record<string, unknown>[] {
	const start = (offset + (page - 1) * 8) % LIBRARY.length;
	return Array.from({ length: 8 }, (_, i) => {
		const e = LIBRARY[(start + i) % LIBRARY.length];
		return {
			id: 90_000 + start + i,
			media_type: e.type === "tv" ? "tv" : "movie",
			title: e.title,
			name: e.title,
			poster_path: e.title,
			overview: "A synopsis long enough to wrap onto a second line, because a card that has only ever been shown a short one has never been asked the question.",
			vote_average: 6 + ((start + i) % 4),
			release_date: `${2000 + ((start + i) % 25)}-06-01`,
			first_air_date: `${2000 + ((start + i) % 25)}-06-01`,
			genre_ids: [28, 35],
			adult: false,
		};
	});
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
	// Without an IMDb id the links row renders a single chip, and a one-chip
	// row cannot show what a three-chip row does — which is the row in the
	// photo, wrapping and then being clipped.
	imdb_id: "tt0120737",
	external_ids: { imdb_id: "tt0120737" },
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

/**
 * One season, as the episode checklist sees it.
 *
 * `getSeason` used to return `{ episodes: [] }`, which is not a season — it is
 * the empty state of one, and a stub that returns an empty list quietly deletes
 * whatever it stood in for from the test. Every row in the sheet is drawn from
 * this, so an empty array meant the sheet had never been drawn at all.
 *
 * Shaped for the rows that break things rather than the tidy ones: an episode
 * title longer than the row, one with no title at all (TMDB leaves it blank for
 * unaired episodes), one with no air date, and a runtime that is a feature
 * length rather than 22 minutes.
 */
const SEASON_META = {
	episodes: Array.from({ length: 22 }, (_, i) => {
		const n = i + 1;
		return {
			episode_number: n,
			name:
				n === 4
					? "An Episode Title That Is Considerably Longer Than The Row It Has To Fit Inside"
					: n === 22
						? ""
						: `Episode ${n}`,
			air_date: n === 22 ? undefined : `2026-0${1 + (i % 9)}-1${i % 10}`,
			runtime: n === 12 ? 91 : 22,
			overview:
				n % 3 === 0
					? "A summary long enough to wrap onto a second line on a phone, which is where an episode row has to decide what it is willing to lose."
					: "",
			still_path: null,
		};
	}),
};

/**
 * A person, and a filmography.
 *
 * Invented rather than borrowed: the sheet needs a biography long enough to
 * trip the 280-character clamp and a name long enough to test the hero, and
 * writing either for a real person would mean inventing facts about them.
 */
const PERSON_META = {
	id: 525,
	name: "Marguerite Vance-Ashworth",
	known_for_department: "Directing",
	birthday: "1970-07-30",
	deathday: null,
	place_of_birth: "London, England",
	profile_path: null,
	biography:
		"A director and screenwriter whose work is invented entirely for this test harness. " +
		"This paragraph exists to be longer than two hundred and eighty characters, because the " +
		"sheet clamps a biography at that length and offers a Read more button, and a clamp that " +
		"is never reached is a branch that has never been drawn on a phone screen.",
	combined_credits: {
		cast: Array.from({ length: 26 }, (_, i) => ({
			id: 3000 + i,
			title: i === 0 ? "A Credit Whose Title Will Not Fit Under Its Poster" : `Credit ${i}`,
			poster_path: `/c${i}.jpg`,
			media_type: i % 5 === 0 ? "tv" : "movie",
			character: i % 4 === 0 ? "A Character With A Considerably Longer Name" : "Herself",
			popularity: 100 - i,
			release_date: `${1994 + (i % 30)}-05-01`,
			vote_average: 6 + (i % 4),
		})),
		crew: [
			// The same title twice, with two jobs. Three identical posters in a
			// row is what this de-duplication exists to stop.
			{ id: 3000, title: "A Credit Whose Title Will Not Fit Under Its Poster", poster_path: "/c0.jpg", media_type: "movie", job: "Director", popularity: 100, release_date: "1994-05-01" },
			{ id: 3000, title: "A Credit Whose Title Will Not Fit Under Its Poster", poster_path: "/c0.jpg", media_type: "movie", job: "Writer", popularity: 100, release_date: "1994-05-01" },
			{ id: 3100, title: "A Directed Film", poster_path: "/c100.jpg", media_type: "movie", job: "Director", popularity: 55, release_date: "2011-05-01" },
		],
	},
};

const plugin = {
	settings: { ...DEFAULT_SETTINGS, recentSearches: ["Inside Man"] },
	app: {
		vault: {
			// The real default. Without it the one sentence on the settings
			// screen that says where plain-text keys land rendered as
			// "undefined/plugins/reel/data.json", and every check passed.
			configDir: ".obsidian",
			getAbstractFileByPath: () => null,
			/*
			 * A vault with a shape, so the folder fields have something to
			 * check themselves against.
			 *
			 * Chosen so the screen shows both answers at once: `Movies` and
			 * `Series` exist, and the default people folder `Movies/People`
			 * does not — which is the real default, and the state a new
			 * install is actually in. A fixture where every path resolves
			 * would only ever exercise the half of the feature that says
			 * "fine".
			 */
			getAllLoadedFiles: () => [
				{ path: "Movies", children: [] },
				{ path: "Movies/_posters", children: [] },
				{ path: "Series", children: [] },
				{ path: "People", children: [] },
				{ path: "Archive/Old Movies", children: [] },
				{ path: "Music", children: [] },
				{ path: "Movies/Heat.md" },
				{ path: "Inbox.md" },
				/*
				 * Daily notes, in a folder Reel is not pointed at.
				 *
				 * The default `dailyNoteFolder` is the vault root, which holds
				 * none of these — so the scene renders the mismatch state and
				 * its suggestion, which is the half of the feature that can
				 * actually be wrong. A fixture where the setting already
				 * matched would only exercise the sentence saying "fine".
				 */
				{ path: "Journal/2026-08-20.md" },
				{ path: "Journal/2026-08-21.md" },
				{ path: "Journal/2026-08-22.md" },
			],
		},
		workspace: { getLeaf: () => null },
	},
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
	/*
	 * Publishing, configured half-way on purpose.
	 *
	 * Trakt is ready and Mastodon is blocked, because the two states sit side
	 * by side in the same row and the blocked one is the easier of the pair to
	 * get wrong — it carries a second line of explanatory text inside a button
	 * that is otherwise one word tall.
	 */
	publish: {
		anyEnabled: true,
		/*
		 * Two targets by default, one ready and one blocked; none at all for
		 * the scene that models an install which has set up neither.
		 *
		 * That empty case renders a different screen entirely — the one telling
		 * you publishing exists and offering to set it up — and it had never been
		 * drawn, because this list was a constant.
		 */
		targets: () =>
			noTargets
				? []
				: [
						{ id: "trakt", label: "Trakt", enabled: true, blocker: null },
						{
							id: "mastodon",
							label: "Mastodon",
							enabled: true,
							blocker: BLOCKERS.mastodonToken,
						},
					],
		/*
		 * Whether this review has been sent before.
		 *
		 * Pinned empty, so the "Already published once" note — the only thing
		 * standing between a rewatch review and a duplicate post — had never
		 * been rendered.
		 */
		publishedTo: () => (alreadySent ? { trakt: "https://trakt.tv/comments/1" } : {}),
		/*
		 * The real rule, not a constant.
		 *
		 * `() => null` meant the warning box was unreachable in the rig, and it
		 * is the box that says why Publish is disabled. Delegating to the
		 * function the app uses means the fixture cannot drift from the rule:
		 * a review the harness calls short is short because Trakt's own
		 * minimum says so.
		 */
		complaint: (payload: { text: string; entry: { tmdbId?: number } }, id: string) =>
			id === "trakt" ? traktComplaint(payload as never) : payload.text.trim() ? null : "There's nothing written to post.",
		preview: async () => ({
			text:
				"★★★★½\n\nA review long enough to wrap several times in the preview box, because a " +
				"one-line sample would never show whether the text block scrolls, clips, or pushes the Publish " +
				"button off the bottom of a phone screen.",
			truncated: true,
		}),
	},
	// Ask records the question you asked; the rig has nothing to save it to.
	saveSettings: async () => undefined,
	ai: {
		get configured() {
			return !aiOff && plugin.settings.aiEnabled && !noKeys;
		},
		/*
		 * A live model list, for the scene that presses Load list.
		 *
		 * The curated branch — what the picker shows before any fetch — is
		 * still the state a new install is in and is still measured by the
		 * ordinary settings scenes, which never press the button. What was
		 * never drawn is the other half: chips carrying OpenRouter's own names
		 * and a price, which is a taller two-line control with a suffix that
		 * the curated list has no equivalent of.
		 *
		 * The prices are chosen to cover every branch of `formatPrice` at once:
		 * one over a dollar (two decimals), one under (three, because two would
		 * render "$0.00" and that is a different claim from "cheap"), one at
		 * zero (the word "free"), and one unpriced (nothing at all).
		 */
		models: async () => [
			{ id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", prompt: 0.8, completion: 4 },
			{ id: "openai/gpt-4o-mini", name: "GPT-4o mini", prompt: 0.15, completion: 0.6 },
			{ id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash Experimental (free)", prompt: 0, completion: 0 },
			{ id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct", prompt: 1.2, completion: 1.2 },
			{ id: "mistralai/mistral-small", name: "Mistral Small", prompt: null, completion: null },
		],
		/*
		 * A fake network client, not a fake Ask.
		 *
		 * The result list has never been measured, and the reason it never was
		 * is that `renderResult` is private and I would not widen it for the
		 * rig — changing the thing being measured to suit the measurement
		 * is not coverage.
		 *
		 * It turns out none of that was necessary. `ask()` takes the client as
		 * an argument and the only thing it asks of it is `json`, so replacing
		 * *that* runs the entire real path: the criteria are sanitised for
		 * real, the shortlist is computed for real against the real library,
		 * the out-of-range pick below is rejected by the real guard, and the
		 * real `renderResult` draws the real markup. The seam was already
		 * there and it belongs to the app, not to the harness.
		 *
		 * Keyed on the schema name because `ask` makes two calls that want
		 * entirely different answers.
		 */
		json: async (_messages: unknown, _schema: unknown, name: string) => {
			if (name === "criteria") {
				return {
					value: {
						pool: "any",
						type: "any",
						genres: [],
						excludeGenres: [],
						yearFrom: null,
						yearTo: null,
						minRuntime: null,
						maxRuntime: null,
						minRating: null,
						keywords: [],
						restated: "Something short and funny you haven't seen, nothing too bleak.",
					},
					promptTokens: 412,
					completionTokens: 96,
				};
			}
			return {
				value: {
					picks: [
						{
							index: 0,
							why: "Ninety minutes, genuinely funny, and about as far from bleak as the library gets.",
						},
						{ index: 1, why: "Short, warm, and you rated the director's other one highly." },
						{
							index: 2,
							why: "A comedy you added months ago and never got to. Long-ish, but it earns it — and this reason is deliberately wordy, because a two-line explanation is the one that finds the layout bugs.",
						},
						// Out of range on purpose: the real guard drops it, and
						// a rig that only ever sends valid data never proves that.
						{ index: 9999, why: "A film you do not own." },
					],
				},
				promptTokens: 1180,
				completionTokens: 143,
			};
		},
	},
	/*
	 * Flipped by the first-run scene.
	 *
	 * A module-level flag rather than a parameter because `plugin` is built
	 * once at load and the settings tab reads the store through it. The scene
	 * sets it, renders, and puts it back.
	 */
	/*
	 * Enough of the credential store for the settings screen to render.
	 *
	 * Keys are reported present so the sections that unfold behind one are
	 * actually drawn — the collapsed screen is the easy case, and the long one
	 * is where the overflow and the touch targets live. `store` and `remove`
	 * exist because they are referenced in click handlers; nothing in the rig
	 * ever presses anything.
	 */
	credentials: {
		has: (name: string) => (present.has(name) || name !== "mastodon") && !missing.has(name) && !noKeys,
		// A getter, not a value. The stub is built once at load, so a plain
		// `!locked` freezes whatever the flag was then, which is false, and the
		// locked scene renders an unlocked screen while reporting success.
		get isUnlocked() {
			return !locked;
		},
		get needsUnlock() {
			return locked;
		},
		unlock: async () => true,
		/*
		 * Read off the settings, not pinned true.
		 *
		 * Pinned, it put an Unlock button and a Remove all keys button on the
		 * session-only screen, where nothing is stored and there is nothing to
		 * unlock or remove. Both are gated on exactly this flag in the real
		 * store, so a fixture that answers yes unconditionally cannot see the
		 * gate at all — it can only ever render the open branch.
		 */
		get hasStoredKey() {
			const s = plugin.settings;
			return !!(s.keyBlob || (s.keysPlain && Object.keys(s.keysPlain).length));
		},
		store: async () => true,
		remove: async () => undefined,
		migrateTo: async () => undefined,
		lock: () => undefined,
	},
	posters: {
		attach(parent: HTMLElement, entry: { title: string }) {
			parent.addClass("reel-poster-loading");
			const img = parent.createEl("img", { cls: "reel-img", attr: { src: poster(entry.title), alt: "" } });
			img.addClass("is-loaded");
			parent.removeClass("reel-poster-loading");
		},
		displayUrl: (e: { title: string }) => poster(e.title),
		// The wash prefers a backdrop and falls back to the poster. The rig has
		// no backdrops, so this exercises the fallback path — which is the one
		// most entries will actually take, since backdrop_path is the field
		// most often missing.
		washUrl: (e: { title: string }) => poster(e.title),
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
		/*
		 * The feed, as the screen has asked for it since it became endless.
		 *
		 * The stub still answered `rows()` — the shape from before Discover was
		 * rewritten into a paging feed — so `rowSources` was undefined, the
		 * await threw, and every run since has rendered "That didn't work."
		 * with a Try again button. It passed because the audit measured the
		 * screen while it was still a skeleton; adding the settle is what made
		 * it visible.
		 *
		 * A stub is a claim about an interface. When the interface moves and
		 * the stub does not, the test keeps reporting on a version of the app
		 * that no longer exists.
		 */
		rowSources: () => [
			{ id: "people", title: "More with Denzel Washington", reason: "You rated three of his films 4 or more", fetch: async (p: number) => (p > 2 ? [] : feedPage(0, p)) },
			{ id: "seed", title: "Because you liked Inside Man", reason: "Similar to a film you rated 5", fetch: async (p: number) => (p > 2 ? [] : feedPage(6, p)) },
			{ id: "trend", title: "Trending this week", fetch: async (p: number) => (p > 3 ? [] : feedPage(12, p)) },
			{ id: "genre", title: "Action from the 2010s", reason: "Your most-watched genre", fetch: async (p: number) => (p > 3 ? [] : feedPage(18, p)) },
		],
		filterOut: (items: unknown[]) => items,
		like: async () => feedPage(3, 1),
		search: async () => feedPage(9, 1),
		reroll: () => {},
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
		getSeason: async () => SEASON_META,
		getPerson: async () => PERSON_META,
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

	/*
	 * Ask, which the view draws here once an OpenRouter key exists.
	 *
	 * Drawn unconditionally in the rig, because the row with it is the wider
	 * one and the width is the whole question this screen is measured on. The
	 * comment further down records this bar drifting from the app once before;
	 * it drifted again the day Ask shipped, and a replica nobody updates is a
	 * green tick for a layout that no longer exists.
	 */
	const ask = bar.createEl("button", { cls: "reel-chip reel-ask-btn" });
	ask.createSpan({ cls: "reel-filter-btn-icon", text: "✦" });
	ask.createSpan({ text: "Ask" });

	// Sort and layout share the row rather than owning one each. Three stacked
	// rows of controls above two posters is a control panel with a preview pane
	// attached, which is what the device screenshot showed.
	if (sort) {
		const sel = bar.createEl("select", { cls: "reel-select dropdown reel-sort-select" });
		sel.createEl("option", { text: "Recently watched" });
		const layout = bar.createEl("button", { cls: "reel-chip reel-layout-btn" });
		layout.createSpan({ cls: "reel-layout-icon", text: "▦" });
		layout.createSpan({ cls: "reel-layout-label", text: "Posters" });
	}

	/*
	 * The two-part tag the view now builds: a label that opens the sheet and an
	 * x that removes just this one.
	 *
	 * This had drifted. The harness was still drawing the old single button
	 * with a decorative x inside it, so the row it measured was one the app had
	 * stopped producing — and the chip that came out 200px wide and 56px tall
	 * on the phone measured fine here, because here it was still a plain chip.
	 */
	for (const label of active) {
		const tag = bar.createDiv({ cls: "reel-chip is-active reel-filter-tag" });
		tag.setAttr("role", "group");
		tag.createEl("button", { cls: "reel-filter-tag-label", text: label });
		const x = tag.createEl("button", {
			cls: "reel-filter-tag-x",
			attr: { "aria-label": `Remove the ${label} filter` },
		});
		x.createSpan({ cls: "reel-filter-x svg-icon", text: "×" });
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

/**
 * The filter sheet, open — the real one.
 *
 * This screen used to be hand-written markup that looked like the sheet: a
 * head, some chip rows, a select. It could not have caught anything the sheet
 * actually does, because none of the sheet's code ran. It reported green while
 * every section was single-select, every tap threw away the scroll position,
 * and the body was a 60vh scroller nested inside a scrolling sheet.
 *
 * A copy of the markup tests the copy.
 */
function filterSheet(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const state = emptyFilters();
	// Several genres at once, because that is the state the sheet exists to
	// hold and the one it could not represent until now.
	state.genres = ["Action", "Comedy"];
	state.statuses = ["watchlist"];
	mountSheet(
		root,
		new FilterSheet(plugin.app, state, {
			pool: all,
			lists: ["Christmas with the family", "Rewatch pile", "Letterboxd top 250"],
			showSort: true,
			onChange: () => {},
		}) as never
	);
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

/**
 * The Rate tab, which is the last of the daily screens never rendered here.
 *
 * It is a queue: one title at a time with a decision attached, so unlike a
 * list it has no natural worst case to build — the awkward shape is the *card*,
 * not the collection. Rendered against the year fixture so the queue is deep
 * enough to have a position in it rather than being its own last item.
 */
function rate(root: HTMLElement): void {
	root.addClass("reel-view-body");
	withPool(YEAR, () => new RateScreen(plugin).render(root));
}

function upnext(root: HTMLElement): void {
	root.addClass("reel-view-body");
	heroBand(root, { label: "Tonight", title: "6 on the go", sub: "Severance — up to S2E4", art: true, compact: true });
	paintUpNext(plugin, root, undefined, true);
	// The upcoming rows, which the view draws directly under Up Next and the
	// rig had never rendered. They are built by calendar.ts, not upnext.ts —
	// the same markup from a second file, which is how a title-truncation fix
	// landed on one screen and not the other.
	paintUpcoming(plugin, root.createDiv({ cls: "reel-upcoming-section" }));
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

/**
 * The detail screen's Remove button, asked once.
 *
 * It is a two-stage control: the first tap turns it into "Delete note?" and
 * fills it red, the second trashes the note, and it reverts on its own after
 * four seconds so a stray tap leaves nothing armed. Only the resting stage had
 * ever been drawn.
 *
 * That mattered this release. The stylesheet's rule for the armed stage was
 * rewritten — it was filling with a theme colour meant for text, which on a
 * dark theme put white on a pale red at 2.77:1 — and the fix went in on
 * reasoning, because the state it applies to could not be rendered.
 *
 * The assertion is the point of the scene as much as the render is. `settled()`
 * waits for animations rather than for a fixed delay, so the click lands well
 * inside the four seconds; if that ever stops being true the button reverts and
 * this would quietly measure the resting state and pass. Throwing makes a
 * timing regression loud instead.
 */
function detailremove(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const screen = new DetailScreen(plugin, SHOW, () => {}, "Library");
	screen.render(root);

	const remove = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "Remove");
	if (!remove) throw new Error("harness: no Remove button on the detail screen");
	remove.click();
	if (remove.dataset.confirming !== "true") {
		throw new Error("harness: Remove did not arm, so the confirming state is not what was measured");
	}
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

/**
 * The episode checklist, on the show with 34 of them.
 *
 * Season 21 rather than season 1: the first twenty are fully watched in the
 * fixture, so season 1 would draw twenty-two ticked rows and none of the
 * mixed state the sheet actually spends its life in.
 */
function seasonsheet(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(root, new SeasonSheet(plugin.app, plugin, LONG_SHOW, 21) as never);
}

/**
 * The Discover preview sheet — the card you get by tapping a poster.
 *
 * Not the same screen as `quick`, which is the shortlist card inside the
 * Discover tab. This is the modal with the trailer, the cast strip, the three
 * actions and the IMDb / Parents guide / TMDB row, and it had never been drawn
 * anywhere but on the phone. A photo of its bottom half is what put it here:
 * cast names sliced through the middle, and each link wrapped in what looked
 * like a pair of brackets.
 */
function preview(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(
		root,
		new PreviewSheet(
			plugin,
			{
				id: 120,
				media_type: "movie",
				title: "A Preview Title Long Enough To Wrap",
				poster_path: "Preview",
				release_date: "2023-09-01",
				vote_average: 7.4,
				overview:
					"A synopsis of the kind the sheet actually receives: several sentences, long enough to need a clamp, and written to be read rather than counted.",
			} as never,
			() => {},
			"A Character With A Considerably Longer Name"
		) as never
	);
}

/** A person and their filmography — sixty poster cards on a 375px screen. */
function personsheet(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(root, new PersonSheet(plugin, 525, "Marguerite Vance-Ashworth") as never);
}

/**
 * The confirmation between a review and the internet.
 *
 * Mounted with a destination already chosen, because the sheet's whole reason
 * to exist — the exact text, in a box, before it is sent — only appears once
 * one is. An unticked sheet would audit the buttons and miss the thing they
 * are there to gate.
 *
 * The truncation warning is on in the stub for the same reason: it is the one
 * piece of copy in the sheet that appears only in a state that is awkward to
 * reach by hand, which makes it exactly the piece that would rot unnoticed.
 */
function publishsheet(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(
		root,
		new PublishSheet(plugin.app, plugin as never, {
			entry: LIBRARY[0],
			date: "2026-08-20",
			rating: 4.5,
			text: "A review of the length people actually write, which is to say several sentences rather than one.",
		}) as never
	);
	// `settled()` waits for the async preview, so the click below is enough to
	// put the sheet into the state worth measuring.
	(root.querySelector(".reel-publish-target") as HTMLElement | null)?.click();
}

/**
 * Ask, at rest.
 *
 * Only the resting state: the box, the remembered questions and the buttons.
 * Drawing a set of results would mean either reaching a private method or
 * adding a seam that exists for the rig and nothing else, and the note above
 * `SCREENS` about the Diary is the same judgement — changing the thing being
 * measured to suit the measurement is not coverage.
 *
 * What that leaves uncovered is the result list, and it is listed in the
 * audit's own skip line rather than left to be discovered.
 */
/**
 * Ask, opened before it has been set up — the screen every new install meets.
 *
 * `configured` was pinned true in this rig, so the branch that draws when it is
 * false had never been rendered. That branch is the entire first-run experience
 * of the feature: what Ask says for itself, what it promises about your data,
 * and where it sends you next.
 */
function askoff(root: HTMLElement): void {
	root.addClass("reel-view-body");
	aiOff = true;
	noKeys = true;
	try {
		mountSheet(root, new AskSheet(plugin.app, plugin as never, () => {}, "") as never);
	} finally {
		aiOff = false;
		noKeys = false;
	}
}

/**
 * The other way to be unconfigured: the key is saved and the switch is off.
 *
 * `configured` is two conditions and this screen treated it as one. Somebody
 * who pasted a key and never found the toggle — which is exactly what the
 * 0.9.20 note is about, since a saved key reads as set up everywhere else in
 * the plugin — was told Ask needs a key, which they have.
 */
function askdisabled(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const before = plugin.settings.aiEnabled;
	plugin.settings.aiEnabled = false;
	try {
		mountSheet(root, new AskSheet(plugin.app, plugin as never, () => {}, "") as never);
	} finally {
		plugin.settings.aiEnabled = before;
	}
}

/**
 * Publishing, on an install that has set up neither destination.
 *
 * `targets()` was a constant in this rig, so the branch that draws when it is
 * empty had never been rendered. That branch is the whole first-run experience
 * of publishing: what the two destinations are, what each one does with your
 * review, and how you get one working.
 */
function publishnowhere(root: HTMLElement): void {
	root.addClass("reel-view-body");
	noTargets = true;
	try {
		mountSheet(
			root,
			new PublishSheet(plugin.app, plugin as never, {
				entry: LIBRARY[0],
				date: "2026-08-20",
				rating: 4.5,
				text: "A review that has nowhere to go yet.",
			}) as never
		);
	} finally {
		noTargets = false;
	}
}

/**
 * A review Trakt will refuse, and one already sent.
 *
 * `complaint()` and `publishedTo()` were both constants in this rig, so two
 * branches of the publish sheet had never been drawn: the box explaining why
 * Publish is greyed out, and the note saying you have posted this once already.
 *
 * Both matter more than their size suggests. The first is the only thing on the
 * screen that answers "why can't I press this"; the second is the only thing
 * standing between a rewatch and a duplicate public post.
 */
function publishrefused(root: HTMLElement): void {
	root.addClass("reel-view-body");
	alreadySent = true;
	try {
		mountSheet(
			root,
			new PublishSheet(plugin.app, plugin as never, {
				entry: LIBRARY[0],
				date: "2026-08-20",
				rating: 4.5,
				// Under Trakt's minimum on purpose, which the real rule decides.
				text: "Loved it.",
			}) as never
		);
		(root.querySelector(".reel-publish-target") as HTMLElement | null)?.click();
	} finally {
		alreadySent = false;
	}
}

function asksheet(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(
		root,
		new AskSheet(
			plugin.app,
			plugin as never,
			() => {},
			""
		) as never
	);
}

/**
 * Ask, having answered — the last unmeasured surface in Reel.
 *
 * Every other screen has been checked eight ways on every release since the
 * harness existed. This one never had been, because drawing results meant
 * reaching a private method, and the note above `SCREENS` about the Diary is
 * the same judgement: a seam that exists for the rig and nothing else is not
 * coverage of anything.
 *
 * A seed question is all it takes. `onOpen` runs the search itself when given
 * one, so this is the ordinary path a person takes — every line of it real
 * except the network.
 */
function askresult(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(
		root,
		new AskSheet(
			plugin.app,
			plugin as never,
			() => {},
			"something short and funny I haven't seen, nothing too bleak"
		) as never
	);
}

/**
 * The settings screen — forty-nine controls, never once measured.
 *
 * This is the screen the audit could not reach, because `Setting` in the shim
 * returned `this` and drew nothing. Every other surface in Reel has been
 * checked eight ways on every release; this one, on a plugin whose whole point
 * is being usable on a phone, had never been checked at all.
 *
 * Rendered with the optional features switched on. Off, the screen is barely
 * half its length and none of the sections that unfold behind a key exist —
 * which is the state that would pass most easily and prove least.
 */
/**
 * The very first screen a new install sees.
 *
 * Every other scene in this rig is drawn with the app in a good state — keys
 * present, library full, features on — because that is where the interesting
 * layout lives. It is also the state nobody starts in. This one has nothing
 * configured at all, which is the only view of Reel that every single user is
 * guaranteed to see, and until now the only one never measured.
 */
function firstrun(root: HTMLElement): void {
	root.addClass("reel-view-body");
	noKeys = true;
	const before = { ...plugin.settings };
	Object.assign(plugin.settings, { keyBlob: null, keysPlain: null, keyNames: [] });
	try {
		const tab = new ReelSettingTab(plugin.app as never, plugin as never);
		tab.containerEl = root;
		tab.display();
	} finally {
		noKeys = false;
		Object.assign(plugin.settings, before);
	}
}

/**
 * One feature's setup guide.
 *
 * Trakt, because it is the longest and the only one carrying every kind of
 * step the format supports — a link, a value that must be copied character
 * for character, and the notes explaining why. If the layout holds here it
 * holds for the other five.
 */
function setupsheet(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const spec = FEATURES.find((f) => f.id === "trakt");
	if (!spec) throw new Error("harness: no trakt feature spec");
	// Application saved, sign-in still to do: four steps ticked, one not.
	missing.add("trakt");
	try {
		mountSheet(root, new SetupSheet(plugin.app, plugin as never, spec) as never);
	} finally {
		missing.delete("trakt");
	}
}

/**
 * A guide with nothing left to do, for a feature that is not Trakt.
 *
 * Two gaps in one scene. Every guide rendered until now has been Trakt's, so
 * five of the six had never been drawn at all — and Mastodon's is the one with
 * a different shape underneath it, a server address that is not a credential
 * sitting above a token that is.
 *
 * And it is finished, which is the state the new step ticks create and the one
 * with the obvious risk: five ticked, dimmed rows in a column is exactly what a
 * disabled screen looks like. Worth being able to see.
 */
function setupdone(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const spec = FEATURES.find((f) => f.id === "mastodon");
	if (!spec) throw new Error("harness: no mastodon feature spec");
	present.add("mastodon");
	const before = plugin.settings.mastodonHost;
	plugin.settings.mastodonHost = "mastodon.social";
	try {
		mountSheet(root, new SetupSheet(plugin.app, plugin as never, spec) as never);
	} finally {
		present.delete("mastodon");
		plugin.settings.mastodonHost = before;
	}
}

/**
 * One scene per feature, derived rather than written.
 *
 * Three guides were added here by hand over three releases and every one of
 * them turned up a real defect the moment it was first drawn — a status line
 * offering a check that could only fail, a field block with no padding, five
 * completed steps standing between somebody and the two things they came for.
 * Three more had still never been rendered.
 *
 * Adding them one at a time is the wrong shape. The interesting fact is not
 * that TMDB's guide was unmeasured, it is that *whether a guide is measured*
 * was a thing somebody had to remember. So the list comes from `FEATURES`: no
 * walkthrough can be missing now, and a seventh feature arrives with its scene
 * already attached.
 *
 * Fresh, because that is the state every guide is met in and the one with the
 * most riding on it. The two states worth seeing that a fresh install cannot
 * show — half finished, and finished — keep their own scenes below.
 */
function guide(spec: FeatureSpec): (root: HTMLElement) => void {
	return (root: HTMLElement): void => {
		root.addClass("reel-view-body");
		noKeys = true;
		try {
			mountSheet(root, new SetupSheet(plugin.app, plugin as never, spec) as never);
		} finally {
			noKeys = false;
		}
	};
}

function settings(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const before = { ...plugin.settings };
	Object.assign(plugin.settings, {
		publishTrakt: true,
		publishMastodon: true,
		mastodonHost: "mastodon.social",
		aiEnabled: true,
		dismissedIds: [1, 2, 3],
		/*
		 * Every section open, which is the whole point of this scene.
		 *
		 * Sections fold now, and the moment they did the audit quietly stopped
		 * measuring what was inside them: forty-six controls became display:
		 * none and the pass stayed green at the same count, which is the most
		 * dangerous shape a green result can have. The folded screen is worth
		 * measuring too and the firstrun scene does it; this one has to show
		 * every control there is.
		 */
		settingsOpen: ["setup", "keys", "folders", "metadata", "reviews", "publishing", "ask", "content", "behaviour", "maintenance"],
		/*
		 * One passing check, one failing one, and a dead Trakt session.
		 *
		 * The warning states are the ones worth measuring: they are the only
		 * place on this screen that paints text in a colour of its own, and
		 * every contrast fault this rig has ever caught has been in exactly
		 * that kind of rule. A fixture where everything is healthy would
		 * exercise the half that cannot fail.
		 *
		 * Timestamps are fixed offsets from a literal rather than from
		 * Date.now(), so the rendered words do not change between runs.
		 */
		connectionHealth: {
			tmdb: { at: FIXED_NOW - 3 * 60 * 60 * 1000, ok: true },
			omdb: { at: FIXED_NOW - 2 * 24 * 60 * 60 * 1000, ok: false, error: "401 Unauthorized" },
			/*
			 * The two shapes a pass can now take, both present on purpose.
			 *
			 * A row that qualifies itself is longer than one that does not, and
			 * the whole point of the qualification is lost if it is the thing
			 * that overflows. Neither had ever been rendered anywhere.
			 */
			openrouter: { at: FIXED_NOW - 40 * 60 * 1000, ok: true, note: "$4.20 of $10.00 used" },
			mastodon: {
				at: FIXED_NOW - 5 * 60 * 1000,
				ok: true,
				proves: "mastodon.social answered. The token is not checked here: it can only post, and Reel will not post to test it.",
			},
			/*
			 * Revoked, not expired — the state that had no way of being seen.
			 *
			 * The expiry is deliberately two months out, so the only thing
			 * making this session dead is the refusal. Anything that reads the
			 * expiry alone renders this row as "Signed in", which is what it
			 * used to do.
			 */
			trakt: { at: FIXED_NOW - 3 * 60 * 1000, ok: false, error: "Trakt refused this token. It may have been revoked." },
		},
		traktExpires: FIXED_NOW + 60 * 24 * 60 * 60 * 1000,
	});
	try {
		const tab = new ReelSettingTab(plugin.app as never, plugin as never);
		tab.containerEl = root;
		tab.display();
	} finally {
		Object.assign(plugin.settings, before);
	}
}

/**
 * The same screen with the keys encrypted and the vault locked.
 *
 * Every settings scene in this rig has been drawn unlocked, which is the state
 * the screen is in for about a second per session. Encrypted is the default
 * mode, and the default mode spends most of its life sealed: you open Reel,
 * you have not been asked for the passphrase yet because nothing has needed a
 * key yet, and this is the screen you get.
 *
 * It is a different screen, not a dimmer one. Health cannot be read because
 * nothing can talk to a service without a key; the fields cannot show you what
 * is saved; and `has()` still answers yes for every service, because the names
 * are stored beside the blob and names are not secret. That last part is what
 * makes this worth measuring — everything on the screen that decides what to
 * draw by asking whether a key exists will draw exactly what it draws when the
 * vault is open, and be wrong about all of it.
 */
/**
 * Session-only storage, with nothing entered yet.
 *
 * The last of the three modes never drawn, and the one that inverts every
 * assumption the other two share. Nothing is stored, so no key reports as
 * configured, no health row appears, and `hasStoredKey` — which gates the
 * unlock offered in 0.9.21 and the remove-everything button — is false.
 *
 * Which means this is the screen where the most controls are absent, and the
 * question worth asking of it is whether what is left explains itself. A mode
 * whose whole premise is that you re-enter a key every time Obsidian starts
 * has to say so somewhere you will read it.
 */
function settingsSession(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const before = { ...plugin.settings };
	noKeys = true;
	locked = true;
	Object.assign(plugin.settings, {
		keyMode: "session",
		keyBlob: null,
		keysPlain: null,
		keyNames: [],
		settingsOpen: ["setup", "keys"],
		connectionHealth: {},
	});
	try {
		const tab = new ReelSettingTab(plugin.app as never, plugin as never);
		tab.containerEl = root;
		tab.display();
	} finally {
		noKeys = false;
		locked = false;
		Object.assign(plugin.settings, before);
	}
}

/**
 * The third storage mode, which had never been drawn.
 *
 * Plain text is the mode with the most to say and the least screen time. It is
 * the only one that writes readable secrets into a file that syncs, so it is
 * the only one carrying a warning — and the warning sits at the bottom of the
 * section, several hundred pixels below the dropdown that chose it, on a phone.
 *
 * It also inverts the question the last two scenes asked. Encrypted and locked
 * is "configured but unreadable"; plain is "readable by anything, including
 * whatever else opens your vault", and the screen has to make the difference
 * between those two feel like a choice rather than a preference.
 */
function settingsPlain(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const before = { ...plugin.settings };
	Object.assign(plugin.settings, {
		keyMode: "plain",
		keyBlob: null,
		/*
		 * Obvious fakes. The rig renders a real settings screen and the screen
		 * lists the names of whatever is in here, so anything that looked like
		 * a key would be a key-shaped string committed to a public repository.
		 */
		keysPlain: { tmdb: "not-a-real-key", omdb: "not-a-real-key" },
		keyNames: ["tmdb", "omdb"],
		settingsOpen: ["setup", "keys"],
		connectionHealth: {
			tmdb: { at: FIXED_NOW - 3 * 60 * 60 * 1000, ok: true },
		},
	});
	try {
		const tab = new ReelSettingTab(plugin.app as never, plugin as never);
		tab.containerEl = root;
		tab.display();
	} finally {
		Object.assign(plugin.settings, before);
	}
}

/**
 * A finished guide, opened on a vault that is still sealed.
 *
 * The commonest reason to reopen a walkthrough you already completed is that
 * the thing has stopped working, and the guide answers that with a status line
 * and a Check now button. Neither is available while the keys are locked, so
 * the version of this screen a person actually meets — default storage mode,
 * Obsidian just opened, nothing has needed a key yet — is the one where the
 * help it offers is the help it cannot give.
 */
/**
 * Mastodon halfway: the server typed, the token not yet made.
 *
 * The realistic middle of that walkthrough, and until now an impossible state
 * for it to be in — the guide could only be ticked by the token, so somebody
 * who had entered their server and gone off to create an application came back
 * to a list reporting nothing done at all.
 */
function guideHalf(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const spec = FEATURES.find((f) => f.id === "mastodon");
	if (!spec) throw new Error("harness: no mastodon feature spec");
	const before = plugin.settings.mastodonHost;
	plugin.settings.mastodonHost = "mastodon.social";
	// Server yes, token no: the stub reports mastodon absent by default.
	try {
		mountSheet(root, new SetupSheet(plugin.app, plugin as never, spec) as never);
	} finally {
		plugin.settings.mastodonHost = before;
	}
}

function guideLocked(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const spec = FEATURES.find((f) => f.id === "omdb");
	if (!spec) throw new Error("harness: no omdb feature spec");
	const before = { ...plugin.settings };
	locked = true;
	Object.assign(plugin.settings, { keyMode: "encrypted", keyBlob: "v1:sealed", keysPlain: null, keyNames: ["omdb"] });
	try {
		mountSheet(root, new SetupSheet(plugin.app, plugin as never, spec) as never);
	} finally {
		locked = false;
		Object.assign(plugin.settings, before);
	}
}

/**
 * A walkthrough whose check came back a failure.
 *
 * The state a person is actually in when they need this screen most: they have
 * followed the guide, pasted a key, pressed Check now, and been told no. Every
 * other guide scene draws a check that has not run or one that passed, so the
 * one tone this block paints in a colour of its own had never been rendered
 * inside a guide — at all. It is on the settings screen — as one row among ten,
 * where it is short and has a whole column to itself. Here it sits directly
 * under the step list with a button beside it.
 *
 * The error is OMDb's real refusal, at its real length. A stub reading "401"
 * would prove the tone renders and nothing about whether the sentence fits,
 * and the sentence is the part a person has to read to know what to do next.
 * There is no key in it: the fixture is a public repo and a rig that draws a
 * real settings screen has no business holding a key-shaped string.
 */
function guideFailed(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const spec = FEATURES.find((f) => f.id === "omdb");
	if (!spec) throw new Error("harness: no omdb feature spec");
	const before = { ...plugin.settings };
	present.add("omdb");
	Object.assign(plugin.settings, {
		connectionHealth: {
			omdb: {
				at: FIXED_NOW - 4 * 60 * 1000,
				ok: false,
				error: "Invalid API key! (Please visit https://www.omdbapi.com/apikey.aspx to obtain a valid key.)",
			},
		},
	});
	try {
		mountSheet(root, new SetupSheet(plugin.app, plugin as never, spec) as never);
	} finally {
		present.delete("omdb");
		Object.assign(plugin.settings, before);
	}
}

/**
 * The model picker after the list has been fetched.
 *
 * `models()` returned an empty array in this rig, so the only branch of the
 * picker ever drawn was the curated one. The fetched branch is a different
 * control: OpenRouter's own name on a second line, and a price appended to the
 * slug on the first — so a chip is taller, wider, and carries text nothing in
 * the curated list has an equivalent of.
 *
 * Pressing the button rather than reaching for the private field, because the
 * button is the only thing that sets it and a rig that sets it directly would
 * be measuring a state the app cannot get into.
 */
function settingsModels(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const before = { ...plugin.settings };
	Object.assign(plugin.settings, { aiEnabled: true, settingsOpen: ["ask"] });
	try {
		const tab = new ReelSettingTab(plugin.app as never, plugin as never);
		tab.containerEl = root;
		tab.display();
		// The audit's settled() waits for the fetch, so one click is enough.
		for (const b of Array.from(root.querySelectorAll("button"))) {
			if (b.textContent === "Load list") {
				b.click();
				break;
			}
		}
	} finally {
		Object.assign(plugin.settings, before);
	}
}

/**
 * Every section folded, with one feature half finished.
 *
 * The state most people are actually in: setup collapses the moment TMDB is
 * saved, so the summary beside its title is the only thing about setup you see
 * on an ordinary visit. It had never been drawn carrying the half-done phrase,
 * which is several times longer than the count it sits next to — a summary row
 * on a 375px phone is exactly where a longer string goes wrong.
 */
function settingsFolded(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const before = { ...plugin.settings };
	Object.assign(plugin.settings, {
		settingsOpen: [],
		// Server typed, token not yet made: half done, and the summary has to
		// say so from the one line it has.
		mastodonHost: "mastodon.social",
		publishTrakt: true,
		aiEnabled: true,
	});
	try {
		const tab = new ReelSettingTab(plugin.app as never, plugin as never);
		tab.containerEl = root;
		tab.display();
	} finally {
		Object.assign(plugin.settings, before);
	}
}

/**
 * Settings, filtered by a search.
 *
 * Forty-nine controls behind a search box, three different match strengths,
 * sections forced open, rows hidden individually — and no scene had ever typed
 * anything into it. The whole feature existed only in its unfiltered state.
 *
 * Driven by dispatching a real input event rather than by setting the private
 * query field, so what runs is the listener the app installs.
 */
function searchIn(root: HTMLElement, query: string): void {
	root.addClass("reel-view-body");
	const before = { ...plugin.settings };
	Object.assign(plugin.settings, { settingsOpen: [] });
	try {
		const tab = new ReelSettingTab(plugin.app as never, plugin as never);
		tab.containerEl = root;
		tab.display();
		const box = root.querySelector(".reel-settings-search input") as HTMLInputElement | null;
		if (!box) throw new Error("harness: no settings search box");
		box.value = query;
		box.dispatchEvent(new Event("input"));
	} finally {
		Object.assign(plugin.settings, before);
	}
}

/*
 * A keyword hit. "spoiler" is one of Publishing's keywords and also appears in
 * a row inside it, so this exercises the ordinary case: one section survives,
 * forced open, with most of its rows hidden.
 */
function settingsSearch(root: HTMLElement): void {
	searchIn(root, "spoiler");
}

/**
 * A search that names a whole section.
 *
 * The other side of the prose rule. Asking for "publishing" is asking for the
 * section, so you get all of it — every row and every paragraph — where asking
 * for "spoiler" is asking for a control and the explanation of the controls it
 * hid would only be in the way. The two cases differ by one boolean and it
 * would be easy to get backwards in a way nothing else would notice.
 */
function settingsSearchSection(root: HTMLElement): void {
	searchIn(root, "publishing");
}

/**
 * A search, then the box cleared again.
 *
 * The state you are in for most of the time you spend on this screen after ever
 * using the search once, and the one nobody thinks to draw — the interesting
 * render feels like the filtered one, so the unfiltered render *after* a filter
 * never gets looked at.
 */
function settingsSearchCleared(root: HTMLElement): void {
	searchIn(root, "spoiler");
	const box = root.querySelector(".reel-settings-search input") as HTMLInputElement | null;
	if (!box) throw new Error("harness: no settings search box");
	box.value = "";
	box.dispatchEvent(new Event("input"));
}

/**
 * Tapping the header of a section a search forced open.
 *
 * The body is shown when either `is-open` or `is-forced-open` is present, so
 * while a search is running the header's own state is not what decides what you
 * see. Tapping it still toggles that state, and still writes it to disk.
 *
 * Which would mean a control that does nothing visible and quietly changes what
 * the screen looks like after you clear the box. Worth measuring rather than
 * reasoning about, since both halves are one CSS selector apart.
 */
function settingsSearchTap(root: HTMLElement): void {
	searchIn(root, "spoiler");
	const head = root.querySelector(".reel-settings-section.is-forced-open .reel-section-head") as HTMLElement | null;
	head?.click();
}

/**
 * A search that finds nothing.
 *
 * The screen goes blank below the box, which reads as a crash rather than as an
 * answer — so there is an element that says so, and it had never been drawn.
 */
function settingsSearchEmpty(root: HTMLElement): void {
	searchIn(root, "zzzznothing");
}

/**
 * The dialog standing in front of every irreversible thing Reel can do.
 *
 * Removing every stored key, deleting a single key, disconnecting Trakt,
 * moving cached posters to the trash, writing your keys to disk in cleartext
 * — all six go through this one modal, and it had never been drawn. The whole
 * safety net of the plugin was unmeasured.
 *
 * Built with the longest body any caller actually passes rather than an
 * invented one, because the question worth asking of a confirmation is whether
 * the reason for it survives being read on a phone: a warning that pushes its
 * own buttons off the bottom of the screen is a warning nobody finishes.
 */
function confirmsheet(root: HTMLElement): void {
	root.addClass("reel-view-body");
	mountSheet(
		root,
		new ConfirmModal(
			plugin.app,
			{
				title: "Write your keys in plain text?",
				body:
					"Every saved key is written readably into .obsidian/plugins/reel/data.json. Anything that can " +
					"read the vault can read them: sync, backups, another plugin, anyone you share the folder with. " +
					"Reel can encrypt them again later, but a key that has been on disk in the clear is best treated " +
					"as exposed and replaced at the service that issued it.",
				confirmText: "Write in plain text",
				danger: true,
			},
			() => {}
		) as never
	);
}

function settingsLocked(root: HTMLElement): void {
	root.addClass("reel-view-body");
	const before = { ...plugin.settings };
	locked = true;
	Object.assign(plugin.settings, {
		keyMode: "encrypted",
		// Enough of a blob for the screen to know one exists. Nothing reads it.
		keyBlob: "v1:sealed",
		keysPlain: null,
		keyNames: ["tmdb", "omdb", "dtdd", "openrouter", "trakt"],
		mastodonHost: "mastodon.social",
		aiEnabled: true,
		publishTrakt: true,
		settingsOpen: ["setup", "keys", "publishing", "ask"],
		/*
		 * One old result, kept deliberately.
		 *
		 * A record written while unlocked outlives the unlock, so the screen has
		 * to hold a truthful past answer next to a present it cannot test. That
		 * pairing is the whole difficulty of this state and a fixture with an
		 * empty health map would skip it.
		 */
		connectionHealth: {
			tmdb: { at: FIXED_NOW - 3 * 60 * 60 * 1000, ok: true },
		},
	});
	try {
		const tab = new ReelSettingTab(plugin.app as never, plugin as never);
		tab.containerEl = root;
		tab.display();
	} finally {
		locked = false;
		Object.assign(plugin.settings, before);
	}
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
	rate,
	stats,
	statsYear,
	upnext,
	empties,
	stars,
	detail,
	detailFilm,
	detailremove,
	discover,
	recipe,
	quickrate,
	logsheet,
	seasonsheet,
	personsheet,
	preview,
	publishsheet,
	asksheet,
	askresult,
	askoff,
	askdisabled,
	publishnowhere,
	publishrefused,
	settings,
	settingsLocked,
	confirmsheet,
	settingsFolded,
	settingsSearch,
	settingsSearchSection,
	settingsSearchTap,
	settingsSearchCleared,
	settingsSearchEmpty,
	settingsModels,
	settingsPlain,
	settingsSession,
	guideLocked,
	guideFailed,
	guideHalf,
	firstrun,
	setupsheet,
	setupdone,
	// Every feature's guide, in the state a new install meets it in. Derived
	// from FEATURES so none can be left out and a seventh arrives covered.
	...Object.fromEntries(FEATURES.map((f) => [`guide_${f.id}`, guide(f)])),
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
 * Which palette to render on.
 *
 * The rig had exactly one set of colours — Obsidian's own neutral greys — and
 * every colour rule in the plugin was therefore checked against a single
 * sample. That is not a test of a colour relationship, it is a test of one
 * point on it, and it let a whole class of fault through: three separate
 * problems reached a screenshot on the user's phone before anyone saw them,
 * and all three were rules that happened to work on grey.
 *
 * The point is emphatically NOT to render on the one theme this app is used
 * with — a plugin tuned to a single theme is a plugin broken on every other.
 * It is that a rule which only survives on neutral greys should fail here.
 * Three palettes spread across the space is enough to catch that: two of them
 * saturated, one of them with its surfaces bunched close together, which is
 * the specific condition under which "use a slightly different background"
 * stops being a way to make a card.
 *
 * The values below are not any real theme's. They are deliberately synthetic
 * points chosen to bracket what themes do.
 */
document.body.setAttribute("data-palette", params.get("palette") ?? "neutral");

/*
 * Obsidian's text size setting, which nothing here has ever moved.
 *
 * Every pass renders at 16px with the UI tokens at their defaults, so every
 * layout in this plugin has only ever been proved at one text size. That is
 * not a test of the layout, for the same reason the neutral palette was not a
 * test of the colours: it holds one variable fixed and calls the result
 * general.
 *
 * It let two faults through to a photograph of a real phone. On the settings
 * screen at a larger size, each feature's one-line description ran out of its
 * row and was cut mid-word, and the paragraph below the list was overlapped by
 * the row above it. Both are the ordinary shape of a text-size bug: something
 * sized for the text it happened to be given.
 *
 * The tokens are scaled rather than the root font size, because that is what
 * Obsidian does — its slider moves the UI scale, and a rule reading
 * `--font-ui-small` has to see the number the app would really hand it.
 */
const textScale = Number(params.get("scale") ?? "") || 1;
if (textScale !== 1) {
	const root = document.documentElement.style;
	for (const [token, px] of [
		["--font-ui-smaller", 12],
		["--font-ui-small", 13],
		["--font-ui-medium", 15],
		["--font-ui-large", 20],
		["--font-ui-larger", 24],
	] as const) {
		root.setProperty(token, `${Math.round(px * textScale)}px`);
	}
	document.body.style.fontSize = `${Math.round(16 * textScale)}px`;
}

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

/**
 * Let a screen finish arriving before measuring it.
 *
 * Half these screens fetch something. `DetailScreen.render` awaits `getFilm`,
 * both sheets await their own request, and the stubs resolve on a microtask —
 * so every one of them was being audited in its *loading* state: a spinner, a
 * skeleton, or a heading with nothing under it. A skeleton has no contrast
 * faults and no touch targets, which is exactly why those screens have been
 * reporting green.
 *
 * Two frames and a task: the microtask drains the stub's promise, the task lets
 * anything it scheduled run, and the frames let a transition settle — measuring
 * mid-animation is how a 44px button was reported as 26px for three rounds.
 */
async function settled(root?: HTMLElement): Promise<void> {
	await new Promise((done) => {
		setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => done(null))), 0);
	});
	/*
	 * And then wait for anything still moving.
	 *
	 * A fixed delay only covers the animations that were short enough when it
	 * was written. Lengthening the sheet entrance from 180ms to 320ms put every
	 * sheet's primary button mid-flight at the moment of measurement, and nine
	 * screens reported their Save button below the fold — all of them by about
	 * the same twelve percent the sheet animates in from.
	 *
	 * Asking the animations when they are done needs no guess and cannot go
	 * stale the next time a duration changes.
	 */
	const scope = root ?? document.body;
	const running = scope.getAnimations?.({ subtree: true }) ?? [];
	await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
}

const app = document.getElementById("app");

if (app) mountObsidianChrome(app);

async function runAudit(app: HTMLElement): Promise<void> {
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
	const MODAL_SCREENS = new Set([
		"recipe",
		"logsheet",
		"quickrate",
		"filterSheet",
		"seensheet",
		"whatsnew",
		"passphrase",
		"seasonsheet",
		"personsheet",
		"preview",
		"publishsheet",
		"asksheet",
	]);
	const skipped: string[] = [];

	const results: { screen: string; checks: Check[] }[] = [];
	for (const name of Object.keys(SCREENS)) {
		if (paneWidth > 0 && MODAL_SCREENS.has(name)) {
			skipped.push(name);
			continue;
		}
		const view = mount(app, name);
		await settled(view);
		results.push({ screen: name, checks: auditScreen(view, { phone, keyboard, scale: textScale !== 1 }) });
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
	// Written last, and the runner waits for it — the loop is asynchronous now,
	// so "the page has stopped loading" no longer means "the audit has run".
	(window as unknown as { REEL_AUDIT: unknown }).REEL_AUDIT = { total, failures, skipped };
}

if (app && params.get("audit") != null) {
	void runAudit(app);
} else if (app) {
	mount(app, wanted);
	// The screenshot tool waits on this rather than on the network, since
	// nothing here touches the network and a data-URI poster is instant.
	void settled().then(() => document.body.addClass("reel-settled"));
}

// A marker the screenshot step can wait on, rather than guessing at a delay.
document.body.dataset.reelReady = "1";
