/**
 * What the search box offers before anyone types.
 *
 * The rule that matters most is that every suggestion has to return
 * something. A chip built from the library always does; a generic one
 * sometimes returns nothing, and an empty result from a suggestion the app
 * made itself reads as the library being emptier than it is.
 */

import { suggestions, rememberSearch } from "../src/util/suggest";

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

function ok(v: boolean, label: string) {
	eq(v, true, label);
}

const EMPTY = { recent: [], people: [], genres: [], years: [] };

/* ---- nothing in, nothing out ---- */

eq(suggestions(EMPTY), [], "an empty library suggests nothing");

/* ---- recents lead ---- */

// "The thing I looked at yesterday" beats any inference from the library.
{
	const out = suggestions({ ...EMPTY, recent: ["Nolan", "Horror"], genres: ["Drama", "Drama", "Drama"] });
	eq(out[0].query, "Nolan", "the newest recent comes first");
	eq(out[1].query, "Horror", "then the one before it");
	eq(out[0].kind, "recent", "and it is marked as a recent");
}

/* ---- the mix is fixed, not just "top by count" ---- */

// Ranking purely by frequency would fill the row with genres on almost any
// library, since every title has one or two and most have a shared director
// only rarely.
{
	const out = suggestions({
		recent: [],
		people: ["Nolan", "Nolan", "Villeneuve", "Villeneuve", "Scott"],
		genres: ["Drama", "Drama", "Drama", "Drama", "Horror", "Horror", "Horror", "Sci-Fi"],
		years: [1999, 2001, 2005],
	});
	const kinds = out.map((s) => s.kind);
	eq(kinds.filter((k) => k === "person").length, 2, "two people, no more");
	eq(kinds.filter((k) => k === "genre").length, 2, "two genres, no more");
	eq(kinds.filter((k) => k === "decade").length, 1, "and a single decade");
}

// Within a kind, most frequent wins.
{
	const out = suggestions({ ...EMPTY, people: ["Nolan", "Nolan", "Scott"] });
	eq(out[0].query, "Nolan", "the more frequent person is offered first");
}

// Ties break alphabetically, so the row does not reshuffle between repaints.
{
	const a = suggestions({ ...EMPTY, genres: ["Horror", "Drama"] }).map((s) => s.query);
	const b = suggestions({ ...EMPTY, genres: ["Drama", "Horror"] }).map((s) => s.query);
	eq(a, b, "a tie produces the same order regardless of input order");
}

/* ---- decades ---- */

{
	const out = suggestions({ ...EMPTY, years: [1994, 1997, 1999, 2005] });
	const decade = out.find((s) => s.kind === "decade");
	eq(decade?.label, "1990s", "the commonest decade is labelled as one");
	eq(decade?.query, "1990", "and searches for the bare number, which is what titles carry");
}

// A missing year is stored as 0 by the caller rather than dropped, so it has
// to be excluded here or every library suggests "the 0s".
{
	const out = suggestions({ ...EMPTY, years: [0, 0, 0, 1994] });
	eq(out.find((s) => s.kind === "decade")?.label, "1990s", "zero years are not a decade");
}

/* ---- no duplicates, and recents win the collision ---- */

{
	const out = suggestions({ ...EMPTY, recent: ["Horror"], genres: ["Horror", "Horror"] });
	eq(out.filter((s) => s.query.toLowerCase() === "horror").length, 1, "a term is offered once");
	eq(out[0].kind, "recent", "and the recent wins, since it is the stronger signal");
}

/* ---- the cap holds ---- */

{
	const out = suggestions({ ...EMPTY, recent: ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8", "i9", "j10"] }, 8);
	eq(out.length, 8, "the limit is respected");
}

/* ---- remembering a search ---- */

eq(rememberSearch([], "Nolan"), ["Nolan"], "the first search is remembered");
eq(rememberSearch(["Horror"], "Nolan"), ["Nolan", "Horror"], "newest first");

// Searching the same thing twice is one search repeated, and showing both
// would waste a slot to say nothing.
eq(rememberSearch(["Nolan", "Horror"], "Nolan"), ["Nolan", "Horror"], "a repeat moves to the front, not duplicated");
eq(rememberSearch(["nolan"], "Nolan"), ["Nolan"], "case-insensitive, and the newest spelling wins");

// A single character is a search in progress, not one anybody meant to make.
eq(rememberSearch(["Nolan"], "N"), ["Nolan"], "one character is not recorded");
eq(rememberSearch(["Nolan"], "  "), ["Nolan"], "nor is whitespace");
eq(rememberSearch([], "  Dune  "), ["Dune"], "and what is recorded is trimmed");

{
	const out = rememberSearch(["a", "b", "c", "d", "e", "f"], "new", 6);
	eq(out.length, 6, "the cap holds");
	eq(out[0], "new", "with the newest kept");
	ok(!out.includes("f"), "and the oldest dropped");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
