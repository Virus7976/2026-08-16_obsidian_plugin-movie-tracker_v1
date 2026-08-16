/**
 * The library index, against a fake vault.
 *
 * Every surface in the plugin reads from this: the grid, discover, stats, up
 * next, the detail screen. A note wrongly excluded here is invisible
 * everywhere, and a note wrongly included shows up as a half-empty card. It
 * had no tests at all.
 *
 * Only `rebuild()` and the public readers are exercised — the event handlers
 * need Obsidian's event plumbing, and faking that would test the fake.
 */

import { Library } from "../src/library";
import { TFile } from "obsidian";

let pass = 0;
let fail = 0;

function eq(actual: unknown, expected: unknown, label: string) {
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	if (a === b) pass++;
	else {
		fail++;
		console.log(`FAIL ${label}\n  expected ${b}\n  actual   ${a}`);
	}
}

function ok(cond: boolean, label: string) {
	eq(cond, true, label);
}

/* ------------------------------------------------------------------ */

interface FakeNote {
	path: string;
	fm: Record<string, unknown> | null;
}

function makeLibrary(notes: FakeNote[], folders: { film?: string; series?: string } = {}) {
	const files = new Map<string, { file: TFile; fm: Record<string, unknown> | null }>();
	for (const n of notes) {
		const file = new TFile();
		file.path = n.path;
		file.basename = n.path.replace(/\.md$/, "").split("/").pop() ?? n.path;
		files.set(n.path, { file, fm: n.fm });
	}

	const plugin = {
		app: {
			vault: { getMarkdownFiles: () => [...files.values()].map((v) => v.file) },
			metadataCache: {
				getFileCache: (file: TFile) => {
					const row = files.get(file.path);
					return row?.fm ? { frontmatter: row.fm } : {};
				},
			},
		},
		settings: {
			filmFolder: folders.film ?? "Movies",
			seriesFolder: folders.series ?? "Series",
		},
	};

	const library = new Library(plugin as never);
	library.rebuild();
	return library;
}

/** The minimum a note needs to be indexed at all. */
const film = (id: number, extra: Record<string, unknown> = {}) => ({
	tmdb_id: id,
	title: "Dune",
	...extra,
});

/* ---- what counts as in scope ---- */

{
	const lib = makeLibrary([
		{ path: "Movies/Dune.md", fm: film(438631) },
		{ path: "Series/Severance.md", fm: film(95396, { title: "Severance" }) },
		{ path: "Journal/2026-08-16.md", fm: film(1) },
	]);
	eq(lib.size, 2, "only notes inside the configured folders are indexed");
	ok(!lib.byPath("Journal/2026-08-16.md"), "a note elsewhere stays out, id or not");
}

{
	// "Movies" must not swallow "Movies Archive" — a prefix match without the
	// separator would index a folder the user deliberately kept separate.
	const lib = makeLibrary([
		{ path: "Movies/Dune.md", fm: film(438631) },
		{ path: "Movies Archive/Old.md", fm: film(2) },
	]);
	eq(lib.size, 1, "a folder sharing a name prefix is not in scope");
}

{
	const lib = makeLibrary([{ path: "Movies/Sub/Dune.md", fm: film(438631) }]);
	eq(lib.size, 1, "notes nested deeper inside the folder are still indexed");
}

/* ---- what disqualifies a note ---- */

{
	const lib = makeLibrary([
		{ path: "Movies/NoFm.md", fm: null },
		{ path: "Movies/NoId.md", fm: { title: "Untracked" } },
		{ path: "Movies/Dune.md", fm: film(438631) },
	]);
	eq(lib.size, 1, "a note without an id is not a library entry");
}

{
	// NaN never equals itself, so an unparseable id would index and then never
	// be found — the search modal would offer to create a duplicate note.
	const lib = makeLibrary([
		{ path: "Movies/Bad.md", fm: { tmdb_id: "not-a-number", title: "Bad" } },
		{ path: "Movies/Dune.md", fm: film(438631) },
	]);
	eq(lib.size, 1, "a non-numeric id is rejected rather than stored as NaN");
	ok(!!lib.byTmdbId(438631), "and the good one is still findable by id");
}

{
	const lib = makeLibrary([{ path: "Movies/Dune.md", fm: film(438631) }]);
	ok(!!lib.byTmdbId(438631, "film"), "found when the type matches");
	ok(!lib.byTmdbId(438631, "tv"), "not found under the wrong type");
	ok(!lib.byTmdbId(999999), "an id that is not there is not invented");
}

/* ---- films and series are told apart by folder ---- */

{
	const lib = makeLibrary([
		{ path: "Movies/Dune.md", fm: film(438631) },
		{ path: "Series/Severance.md", fm: film(95396, { title: "Severance" }) },
	]);
	eq(lib.films().length, 1, "one film");
	eq(lib.shows().length, 1, "one series");
	eq(lib.all().length, 2, "and both in the whole library");
}

/* ---- search ---- */

{
	const lib = makeLibrary([
		{
			path: "Movies/Dune.md",
			fm: film(438631, {
				director: ["[[People/Denis Villeneuve|Denis Villeneuve]]"],
				cast: ["Timothée Chalamet"],
				genres: ["Science Fiction"],
				year: 2021,
			}),
		},
		{ path: "Movies/Heat.md", fm: film(949, { title: "Heat", year: 1995 }) },
	]);

	eq(lib.search("dune").length, 1, "matches a title");
	eq(lib.search("DUNE").length, 1, "and ignores case");
	eq(lib.search("villeneuve").length, 1, "matches a director through wikilink syntax");
	eq(lib.search("chalamet").length, 1, "matches a cast member");
	eq(lib.search("science").length, 1, "matches a genre");
	eq(lib.search("2021").length, 1, "matches a year");
	eq(lib.search("").length, 2, "an empty query is not a filter");
	eq(lib.search("nothing here").length, 0, "and a miss is a miss");
}

{
	// The haystack is cached per path; searching twice must not go stale or
	// start matching things it did not the first time.
	const lib = makeLibrary([{ path: "Movies/Dune.md", fm: film(438631) }]);
	eq(lib.search("dune").length, 1, "first search");
	eq(lib.search("dune").length, 1, "second search hits the cache with the same answer");
	eq(lib.search("heat").length, 0, "and the cache has not made it match everything");
}

{
	const lib = makeLibrary([
		{ path: "Movies/Dune.md", fm: film(438631) },
		{ path: "Movies/Heat.md", fm: film(949, { title: "Heat" }) },
	]);
	const pool = lib.films().filter((e) => e.title === "Heat");
	eq(lib.search("dune", pool).length, 0, "searching within a pool cannot reach outside it");
}

/* ---- seasons survive the index ---- */

{
	// The bug: episode ratings were written to the note correctly and then
	// silently dropped when the index read them back, so reopening the season
	// sheet showed empty stars and looked exactly like a save that failed.
	const lib = makeLibrary([
		{
			path: "Series/The Office.md",
			fm: {
				tmdb_id: 2316,
				title: "The Office",
				seasons: [{ n: 1, watched: "1-3", total: 6, rating: 4, episode_ratings: { "1": 3, "2": 5 } }],
			},
		},
	]);
	const season = lib.all()[0]?.seasons[0];
	eq(season?.episode_ratings, { "1": 3, "2": 5 }, "per-episode ratings survive the index");
	eq(season?.watched, "1-3", "and so does the watched range");
	eq(season?.rating, 4, "and the season rating");
	eq(season?.total, 6, "and the episode total");
}

{
	// Hand-edited YAML can produce numeric keys rather than quoted strings.
	const lib = makeLibrary([
		{
			path: "Series/Show.md",
			fm: { tmdb_id: 1, title: "Show", seasons: [{ n: 1, watched: "1", episode_ratings: { 1: 4.5 } }] },
		},
	]);
	eq(lib.all()[0]?.seasons[0]?.episode_ratings, { "1": 4.5 }, "numeric YAML keys normalise to strings");
}

{
	const lib = makeLibrary([
		{ path: "Series/Show.md", fm: { tmdb_id: 1, title: "Show", seasons: [{ n: 1, watched: "1" }] } },
	]);
	ok(!lib.all()[0]?.seasons[0]?.episode_ratings, "a season with no ratings carries no empty map");
}

/* ---- rebuild is idempotent ---- */

{
	const lib = makeLibrary([{ path: "Movies/Dune.md", fm: film(438631) }]);
	lib.rebuild();
	lib.rebuild();
	eq(lib.size, 1, "rebuilding repeatedly does not duplicate entries");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
