/**
 * The half of Ask that isn't a model.
 *
 * The model reads a sentence and the model ranks a shortlist, and neither of
 * those is testable — but everything between them is ordinary code over
 * frontmatter, and it is the part that decides which titles the model is ever
 * allowed to see. If this is wrong, no amount of good ranking saves the answer:
 * a film filtered out here cannot be recommended, and a nonsense number let
 * through here filters the whole library away.
 *
 * Two behaviours carry most of the weight.
 *
 * `sanitise` is the airlock. Anything the model returns has to come out the
 * other side either usable or discarded — never as a value that quietly empties
 * the library.
 *
 * `shortlist` relaxes rather than returning nothing. A personal library is
 * small, four constraints usually match none of it, and "nothing found" is a
 * technically correct answer that no person would ever give.
 */

import { digest, effectiveRuntime, effectiveYear, sanitise, score, shortlist, EMPTY_CRITERIA } from "../src/ai/find";
import type { AskCriteria } from "../src/ai/find";
import type { Entry } from "../src/types";

let passed = 0;
let failed = 0;

function eq(name: string, got: unknown, want: unknown): void {
	if (got === want) {
		passed++;
	} else {
		failed++;
		console.error(`  ✗ ${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
	}
}

function entry(over: Partial<Entry> = {}): Entry {
	return {
		path: `Movies/${over.title ?? "X"}.md`,
		basename: String(over.title ?? "X"),
		type: "film",
		tmdbId: 1,
		title: "X",
		director: [],
		watched: [],
		creators: [],
		seasons: [],
		genres: [],
		castIds: [],
		directorIds: [],
		status: "watchlist",
		cast: [],
		characters: [],
		productionCompanies: [],
		providers: [],
		contentFlags: [],
		contentTopics: [],
		lists: [],
		added: 0,
		watchCount: 0,
		...over,
	} as Entry;
}

function crit(over: Partial<AskCriteria> = {}): AskCriteria {
	return { ...EMPTY_CRITERIA, ...over };
}

/* ---- the airlock ----------------------------------------------------- */

eq("nothing at all is still a usable set of criteria", sanitise(null).pool, "any");
eq("an invented pool falls back rather than filtering to nothing", sanitise({ pool: "unseen" as never }).pool, "any");
eq("an invented type does too", sanitise({ type: "movie" as never }).type, "any");
eq("a zero runtime is not a runtime", sanitise({ maxRuntime: 0 }).maxRuntime, null);
eq("a negative one is not either", sanitise({ minRuntime: -30 }).minRuntime, null);
eq("nor is a day and a half", sanitise({ maxRuntime: 5000 }).maxRuntime, null);
eq("a real one survives", sanitise({ maxRuntime: 100 }).maxRuntime, 100);
eq("the year 12000 is not a year", sanitise({ yearFrom: 12000 }).yearFrom, null);
eq("1899 is", sanitise({ yearFrom: 1899 }).yearFrom, 1899);
eq("a backwards range is turned round rather than emptied", sanitise({ yearFrom: 2010, yearTo: 1990 }).yearFrom, 1990);
eq("and its other end", sanitise({ yearFrom: 2010, yearTo: 1990 }).yearTo, 2010);
eq("a backwards runtime range too", sanitise({ minRuntime: 200, maxRuntime: 90 }).minRuntime, 90);
eq("a rating out of range is dropped", sanitise({ minRating: 9 }).minRating, null);
eq("zero stars is not a floor worth having", sanitise({ minRating: 0 }).minRating, null);
eq("four is", sanitise({ minRating: 4 }).minRating, 4);

eq("duplicate genres collapse", sanitise({ genres: ["Comedy", "comedy", " COMEDY "] }).genres.length, 1);
eq("blank entries are dropped", sanitise({ genres: ["Comedy", "", "   "] }).genres.length, 1);
eq("a non-array is an empty list, not a crash", sanitise({ keywords: "heist" as never }).keywords.length, 0);
eq("keywords are capped", sanitise({ keywords: Array.from({ length: 30 }, (_, i) => `k${i}`) }).keywords.length, 8);

/*
 * A genre both wanted and excluded is a contradiction that would filter the
 * library to nothing. What you asked for has to win over what you didn't.
 */
const contradiction = sanitise({ genres: ["Comedy"], excludeGenres: ["comedy", "Horror"] });
eq("the contradiction is resolved in favour of the request", contradiction.excludeGenres.join(","), "Horror");
eq("and the request is kept", contradiction.genres.join(","), "Comedy");

/* ---- runtimes and years, per medium ---------------------------------- */

eq("a film's runtime is its runtime", effectiveRuntime(entry({ runtime: 170 })), 170);
eq(
	"a series' runtime is per episode, because nobody means 60 hours by 'short'",
	effectiveRuntime(entry({ type: "tv", episodeRuntime: 42, runtime: 4000 })),
	42
);
eq("a zero runtime is unknown, not instant", effectiveRuntime(entry({ runtime: 0 })), undefined);
eq("a series' year is when it started", effectiveYear(entry({ type: "tv", firstAirYear: 2008 })), 2008);

/* ---- the library used by the cases below ------------------------------ */

const library: Entry[] = [
	entry({ title: "Airplane!", year: 1980, runtime: 88, genres: ["Comedy"], status: "watchlist" }),
	entry({ title: "The Big Lebowski", year: 1998, runtime: 117, genres: ["Comedy", "Crime"], status: "watchlist" }),
	entry({ title: "Come and See", year: 1985, runtime: 142, genres: ["War", "Drama"], status: "watchlist" }),
	entry({ title: "Superbad", year: 2007, runtime: 113, genres: ["Comedy"], status: "watched", rating: 4 }),
	entry({ title: "Uncatalogued", year: 2001, genres: [], status: "watchlist" }),
	entry({
		title: "The Rehearsal",
		type: "tv",
		firstAirYear: 2022,
		episodeRuntime: 30,
		genres: ["Comedy"],
		status: "watchlist",
	}),
];

/* ---- the pool is never negotiable ------------------------------------ */

const unseen = shortlist(library, crit({ pool: "watchlist" }), 50);
eq("nothing already watched is offered as something to watch", unseen.picked.some((e) => e.title === "Superbad"), false);
eq("and the rest is", unseen.picked.length, 5);

const seen = shortlist(library, crit({ pool: "watched" }), 50);
eq("asking for a rewatch returns only what you've seen", seen.picked.map((e) => e.title).join(","), "Superbad");

/* ---- ordinary filtering ---------------------------------------------- */

const comedies = shortlist(library, crit({ pool: "watchlist", genres: ["Comedy"] }), 50);
eq("genre filters", comedies.picked.some((e) => e.title === "Come and See"), false);
eq("nothing was given up", comedies.relaxed.length, 0);

const films = shortlist(library, crit({ pool: "watchlist", type: "film", genres: ["Comedy"] }), 50);
eq("a series is excluded when films were asked for", films.picked.some((e) => e.type === "tv"), false);

const notWar = shortlist(library, crit({ pool: "watchlist", excludeGenres: ["War"] }), 50);
eq("exclusion works", notWar.picked.some((e) => e.title === "Come and See"), false);

/*
 * An unknown runtime is not a failed one. Half an imported library has no
 * runtime at all, and dropping those would answer "something short" with only
 * the titles that happen to be well-catalogued.
 */
const shortOnes = shortlist(library, crit({ pool: "watchlist", maxRuntime: 100 }), 50);
eq("a missing runtime is not excluded by a runtime filter", shortOnes.picked.some((e) => e.title === "Uncatalogued"), true);
eq("a long one is", shortOnes.picked.some((e) => e.title === "Come and See"), false);

/* ---- relaxation, which is the whole trick ---------------------------- */

/* A 20-minute nineties comedy: nothing matches, but the answer is not "no". */
const impossible = shortlist(
	library,
	crit({ pool: "watchlist", genres: ["Comedy"], yearFrom: 1990, yearTo: 1999, maxRuntime: 20 }),
	50
);
eq("length is the first thing given up", impossible.relaxed[0], "length");
eq("and it found the nineties comedy", impossible.picked[0]?.title, "The Big Lebowski");
eq("without giving up the genre as well", impossible.relaxed.includes("genre"), false);

/* Asking for a genre the library simply hasn't got. */
const noSuchGenre = shortlist(library, crit({ pool: "watchlist", genres: ["Western"] }), 50);
eq("the genre is given up last", noSuchGenre.relaxed.includes("genre"), true);
eq("and something is still offered", noSuchGenre.picked.length > 0, true);

/* But never the pool. */
const seenOnly = shortlist(
	[entry({ title: "Only One", status: "watched", watched: [{ date: "2020-01-01" }] as never, genres: ["Horror"] })],
	crit({ pool: "watchlist", genres: ["Comedy"] }),
	50
);
eq("a watched film is never offered as unseen, however much is relaxed", seenOnly.picked.length, 0);

/* ---- scoring is a sieve, not a verdict -------------------------------- */

const wanted = crit({ genres: ["Comedy"], keywords: ["heist"] });
eq(
	"a genre match outweighs a good rating in the wrong genre",
	score(entry({ genres: ["Comedy"] }), wanted) > score(entry({ genres: ["War"], rating: 5 }), wanted),
	true
);
eq(
	"a keyword in the title counts",
	score(entry({ title: "The Heist", genres: ["Comedy"] }), wanted) > score(entry({ genres: ["Comedy"] }), wanted),
	true
);
eq(
	"a two-letter keyword is too weak to match on",
	score(entry({ title: "It" }), crit({ keywords: ["it"] })),
	score(entry({ title: "It" }), crit({}))
);
eq(
	"an uncatalogued title doesn't outrank a real match on its rating alone",
	score(entry({ genres: [], rating: 5 }), wanted) < score(entry({ genres: ["Comedy"] }), wanted),
	true
);

eq("the limit is honoured", shortlist(library, crit({ pool: "any" }), 2).picked.length, 2);
eq("an empty library is empty, not an error", shortlist([], crit(), 10).picked.length, 0);

/* ---- what actually leaves the vault ----------------------------------- */

const line = digest(entry({ title: "Heat", year: 1995, runtime: 170, genres: ["Action", "Crime", "Drama"], director: ["Michael Mann"], rating: 5, status: "watched" }), 3);
eq("it is numbered, so the model answers with an index", line.startsWith("3. Heat (1995)"), true);
eq("the director is there", line.includes("dir Michael Mann"), true);
eq("and your own rating", line.includes("you 5/5"), true);
eq("and whether you have seen it", line.includes("seen"), true);
eq("the file path is not", line.includes("Movies/"), false);
eq("genres are capped at three", digest(entry({ genres: ["A", "B", "C", "D", "E"] }), 0).includes("D"), false);
eq("an unseen title says so", digest(entry({ status: "watchlist" }), 0).includes("unseen"), true);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
