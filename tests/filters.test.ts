/**
 * Narrowing the library.
 *
 * Written because of a reported symptom rather than a hypothesis: "I have many
 * more 5-star rated movies, and all I'm excluding is the watchlist." Selecting
 * watched, watching and completed returned 47 titles from a library of 104
 * holding 36 on the watchlist, and the missing twenty-odd had no obvious
 * property in common.
 *
 * They did have one. A film matched "watched" only if it had logged watch
 * dates; the status field was ignored for films entirely, so anything marked
 * watched without a date — every import, and anything ticked off in a hurry —
 * matched neither branch of the test and fell out of its own filter.
 *
 * The cases below are all about which signal counts as having seen something,
 * because that is the one this got wrong.
 */

import { narrow, emptyFilters, activeFilters, clearFilter, type FilterState } from "../src/ui/filterSheet";
import type { Entry } from "../src/types";

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

function entry(over: Partial<Entry>): Entry {
	return {
		title: "Untitled",
		type: "film",
		status: "watched",
		watched: [],
		genres: [],
		lists: [],
		path: "x.md",
		tmdbId: 1,
		...over,
	} as Entry;
}

function withStatuses(...statuses: string[]): FilterState {
	return { ...emptyFilters(), statuses };
}

const titles = (rows: Entry[]) => rows.map((e) => e.title).sort();

/* ---- a film marked watched, with no dates logged ---- */

// The reported case. An import carries a status and a rating and no history.
const imported = entry({ title: "Imported", status: "watched", watched: [], rating: 5 });
const logged = entry({ title: "Logged", status: "watched", watched: [{ date: "2026-01-02" }] });

eq(titles(narrow([imported, logged], withStatuses("watched"))), ["Imported", "Logged"], "a status alone is enough");

/* ---- and the case that put the dates test there in the first place ---- */

// Seen years ago, then put back on the watchlist to see again. The status now
// says watchlist, and it is still true that you have seen it.
const rewatching = entry({ title: "Rewatching", status: "watchlist", watched: [{ date: "2019-05-05" }] });
eq(titles(narrow([rewatching], withStatuses("watched"))), ["Rewatching"], "dates alone are enough too");

// Both signals still have to mean the same answer for a title with neither.
const unseen = entry({ title: "Unseen", status: "watchlist", watched: [] });
eq(titles(narrow([unseen], withStatuses("watched"))), [], "neither signal means not watched");

/* ---- series are judged on the status field, which is what they have ---- */

const show = entry({ title: "Show", type: "tv", status: "watching", watched: [] });
eq(titles(narrow([show], withStatuses("watching"))), ["Show"], "a series matches its status");
eq(titles(narrow([show], withStatuses("watched"))), [], "and not one it does not hold");

/* ---- a series is judged on its episodes, not on a word it never holds ---- */

/*
 * The second half of the same bug. Series were excluded from the whole idea,
 * so a show only matched "watched" if its status said that word — which for a
 * series it never does. Shows are "watching" or "completed".
 */
const partly = entry({
	title: "Partly",
	type: "tv",
	status: "watching",
	seasons: [{ n: 1, watched: "1-4" }],
	totalEpisodes: 10,
});
eq(titles(narrow([partly], withStatuses("watched"))), ["Partly"], "episodes ticked mean you have seen it");
eq(titles(narrow([partly], withStatuses("completed"))), [], "but four of ten is not finished");

/* ---- and finishing a series then queuing a rewatch keeps both facts ---- */

// The reported case, in its series form: completed, then moved to the
// watchlist to watch again. It dropped out of "completed" entirely.
const rewatchShow = entry({
	title: "Rewatch Show",
	type: "tv",
	status: "watchlist",
	seasons: [{ n: 1, watched: "1-10" }],
	totalEpisodes: 10,
});
eq(titles(narrow([rewatchShow], withStatuses("completed"))), ["Rewatch Show"], "all ten episodes is finished");
eq(titles(narrow([rewatchShow], withStatuses("watched"))), ["Rewatch Show"], "and finished means seen");
eq(titles(narrow([rewatchShow], withStatuses("watchlist"))), ["Rewatch Show"], "while still being queued");

// An unknown episode count proves nothing either way. A missing field must not
// promote a show to completed on the strength of one ticked episode.
const unknownTotal = entry({ title: "Unknown", type: "tv", status: "watching", seasons: [{ n: 1, watched: "1-3" }] });
eq(titles(narrow([unknownTotal], withStatuses("completed"))), [], "no denominator, no conclusion");

/* ---- the imported film with no dates, moved to the watchlist ---- */

/*
 * Most of an imported library is marked watched with no dates at all, so the
 * label is the whole of the evidence — and moving one to the watchlist
 * overwrites it. `setStatus` stamps `seen` before the overwrite; this is that
 * flag doing its job.
 */
const stamped = entry({ title: "Stamped", status: "watchlist", watched: [], seen: true });
eq(titles(narrow([stamped], withStatuses("watched"))), ["Stamped"], "a stamped title stays watched");

// And the flag is not a way to be watched without ever having been.
const neverSeen = entry({ title: "Never", status: "watchlist", watched: [] });
eq(titles(narrow([neverSeen], withStatuses("watched"))), [], "no flag, no dates, no claim");

/* ---- a current-state label stays exclusive, because it is about now ---- */

// "Paused" is a decision about right now, not a fact about your history, so it
// must not start matching things you gave up on months ago.
const dropped = entry({ title: "Dropped", type: "tv", status: "dropped", seasons: [{ n: 1, watched: "1-2" }] });
eq(titles(narrow([dropped], withStatuses("paused"))), [], "dropped is not paused");
eq(titles(narrow([dropped], withStatuses("watched"))), ["Dropped"], "though you did watch some of it");

/* ---- several statuses are an OR, which is what ticking boxes means ---- */

const pool = [
	entry({ title: "A", status: "watched", watched: [{ date: "2026-01-01" }] }),
	entry({ title: "B", status: "watching", type: "tv" }),
	entry({ title: "C", status: "completed", type: "tv" }),
	entry({ title: "D", status: "watchlist" }),
	entry({ title: "E", status: "watched", watched: [] }),
];

eq(
	titles(narrow(pool, withStatuses("watched", "watching", "completed"))),
	["A", "B", "C", "E"],
	"three statuses return everything but the watchlist"
);
eq(narrow(pool, withStatuses()).length, 5, "no status set narrows nothing");

/* ---- genres and lists are an OR within themselves, an AND across ---- */

const genred = [
	entry({ title: "Action", genres: ["Action"] }),
	entry({ title: "Comedy", genres: ["Comedy"] }),
	entry({ title: "Both", genres: ["Action", "Comedy"] }),
	entry({ title: "Neither", genres: ["Drama"] }),
];

eq(
	titles(narrow(genred, { ...emptyFilters(), genres: ["Action", "Comedy"] })),
	["Action", "Both", "Comedy"],
	"any of the chosen genres"
);

const crossed = [
	entry({ title: "Match", genres: ["Action"], lists: ["Rewatch"] }),
	entry({ title: "WrongList", genres: ["Action"], lists: ["Other"] }),
	entry({ title: "WrongGenre", genres: ["Drama"], lists: ["Rewatch"] }),
];
eq(
	titles(narrow(crossed, { ...emptyFilters(), genres: ["Action"], lists: ["Rewatch"] })),
	["Match"],
	"but every category has to agree"
);

/* ---- type is exclusive, because Everything/Films/Series is one question ---- */

const mixed = [entry({ title: "Film" }), entry({ title: "Series", type: "tv", status: "watching" })];
eq(titles(narrow(mixed, { ...emptyFilters(), type: "film" })), ["Film"], "films only");
eq(titles(narrow(mixed, { ...emptyFilters(), type: "tv" })), ["Series"], "series only");
eq(narrow(mixed, emptyFilters()).length, 2, "everything means everything");

/* ---- the bar shows one removable chip per value ---- */

const many: FilterState = { ...emptyFilters(), genres: ["Action", "Comedy"], statuses: ["watched"], type: "film" };
eq(activeFilters(many).length, 4, "one chip per value, not per category");

clearFilter(many, "genres", "Action");
eq(many.genres, ["Comedy"], "removing one leaves the rest");

clearFilter(many, "genres");
eq(many.genres, [], "and no value clears the category");

clearFilter(many, "type");
eq(many.type, "all", "type goes back to everything");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
