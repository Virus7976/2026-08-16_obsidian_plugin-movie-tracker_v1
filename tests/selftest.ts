import {
	parseRange, formatRange, rangeCount, addToRange, removeFromRange,
	contiguousProgress, nextEpisode,
} from "../src/util/ranges";
import { clampRating, starString } from "../src/util/ratings";
import { formatMinutes, normaliseDate, prettyDate, yearOf } from "../src/util/dates";
import { parseQuery, applyQuery, sortEntries } from "../src/render/query";
import { nextShowStatus } from "../src/util/status";
import type { Entry } from "../src/types";

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, label: string) {
	const a = JSON.stringify(actual), b = JSON.stringify(expected);
	if (a === b) { pass++; }
	else { fail++; console.log(`FAIL ${label}\n  expected ${b}\n  actual   ${a}`); }
}

/* ---- ranges ---- */
eq(parseRange("1-7"), [1,2,3,4,5,6,7], "parse 1-7");
eq(parseRange("1-5,7-9"), [1,2,3,4,5,7,8,9], "parse gap");
eq(parseRange("3"), [3], "parse single");
eq(parseRange(""), [], "parse empty");
eq(parseRange(undefined), [], "parse undefined");
eq(parseRange("  2 - 4 , 9 "), [2,3,4,9], "parse whitespace");
eq(parseRange("7-5"), [5,6,7], "parse reversed");
eq(parseRange("junk"), [], "parse junk");
eq(formatRange([1,2,3,4,5,6,7]), "1-7", "format run");
eq(formatRange([1,2,3,4,5,7,8,9]), "1-5,7-9", "format gap");
eq(formatRange([3]), "3", "format single");
eq(formatRange([]), "", "format empty");
eq(formatRange([5,1,3,2]), "1-3,5", "format unsorted");
eq(formatRange([2,2,3]), "2-3", "format dupes");
eq(rangeCount("1-5,7-9"), 8, "count");
eq(addToRange("1-5,7-9", 6), "1-9", "add closes gap");
eq(addToRange("", 1), "1", "add to empty");
eq(addToRange("1-3", 3), "1-3", "add idempotent");
eq(removeFromRange("1-9", 5), "1-4,6-9", "remove splits");
eq(contiguousProgress("1-5,7-9"), 5, "contiguous stops at gap");
eq(contiguousProgress("2-9"), 0, "contiguous needs ep1");
eq(nextEpisode("1-5,7-9", 13), 6, "next fills gap");
eq(nextEpisode("1-13", 13), null, "next when done");
eq(nextEpisode("", 10), 1, "next from scratch");

/* ---- ratings ---- */
eq(clampRating(4.4), 4.5, "clamp snaps up");
eq(clampRating(4.2), 4, "clamp snaps down");
eq(clampRating(9), 5, "clamp max");
eq(clampRating(-1), 0, "clamp min");
eq(starString(4.5), "★★★★½", "stars half");
eq(starString(5), "★★★★★", "stars full");
eq(starString(undefined), "", "stars none");

/* ---- dates ---- */
eq(normaliseDate("2024-03-11"), "2024-03-11", "date string");
eq(normaliseDate(new Date(2024, 2, 11)), "2024-03-11", "date object (local, not UTC-shifted)");
eq(normaliseDate("nonsense"), undefined, "date junk");
eq(yearOf("2021-10-22"), 2021, "yearOf");
eq(prettyDate("2025-01-02"), "2 Jan 2025", "prettyDate");
eq(formatMinutes(155), "2h 35m", "minutes");
eq(formatMinutes(47), "47m", "minutes short");
eq(formatMinutes(120), "2h", "minutes exact");

/* ---- show status transitions ---- */
// null means "leave the existing status alone".
eq(nextShowStatus("watching", 62, 62), "completed", "last episode completes the show");
eq(nextShowStatus("watching", 61, 62), "watching", "still going");
// The regression that mattered: a finished show gains a season, total_episodes
// grows, and it must leave `completed` — otherwise inProgress() filters it out
// and it never returns to Up Next.
eq(nextShowStatus("completed", 62, 71), "watching", "new season reopens a completed show");
eq(nextShowStatus("completed", 62, 62), "completed", "completed stays completed");
// And the trap in fixing that: a watchlisted show has 0 watched, so the naive
// rule would promote every one of them to `watching` on the daily refresh.
eq(nextShowStatus("watchlist", 0, 62), null, "watchlist is never auto-promoted");
eq(nextShowStatus("dropped", 3, 62), null, "dropped is left alone");
eq(nextShowStatus("paused", 3, 62), null, "paused is left alone");
eq(nextShowStatus("watching", 0, 0), null, "unknown total draws no conclusion");
eq(nextShowStatus(undefined, 5, 10), "watching", "missing status still settles");
eq(nextShowStatus("watching", 70, 62), "completed", "over-count still completes");

/* ---- query ---- */
const q = parseQuery("filter: status = watched, year >= 2020\nsort: watched desc\nlayout: poster-grid");
eq(q.filters.length, 2, "two filters");
eq(q.filters[1], { field: "year", op: ">=", value: "2020" }, "numeric filter parsed");
eq(q.sortDir, -1, "sort desc");
eq(q.errors, [], "no errors");
eq(parseQuery("filter: genre contains Horror").filters[0], { field: "genre", op: "contains", value: "Horror" }, "contains");
eq(parseQuery("nonsense line").errors.length, 1, "bad line reported");

function mk(o: Partial<Entry>): Entry {
	return {
		path: o.title + ".md", basename: o.title ?? "", type: "film", tmdbId: 1,
		title: o.title ?? "", director: [], creators: [], genres: [], seasons: [],
		watched: [], status: "watched", ...o,
	} as Entry;
}
const rows: Entry[] = [
	mk({ title: "Dune", year: 2021, status: "watched", genres: ["Science Fiction"], rating: 4.5,
	     watched: [{ date: "2024-03-11" }, { date: "2025-01-02" }] }),
	mk({ title: "Alien", year: 1979, status: "watched", genres: ["Horror"], rating: 5,
	     watched: [{ date: "2023-06-01" }] }),
	mk({ title: "Sinners", year: 2025, status: "watchlist", genres: ["Horror"] }),
];
eq(applyQuery(rows, parseQuery("filter: status = watched, year >= 2020")).map(r => r.title), ["Dune"], "combined filter");
eq(applyQuery(rows, parseQuery("filter: genre contains horror")).map(r => r.title).sort(), ["Alien","Sinners"], "genre case-insensitive");
eq(applyQuery(rows, parseQuery("sort: watched desc")).map(r => r.title), ["Dune","Alien","Sinners"], "unwatched sinks on desc");
eq(sortEntries(rows, "rating", 1).map(r => r.title), ["Dune","Alien","Sinners"], "unrated sinks on asc too");
eq(applyQuery(rows, parseQuery("sort: title asc")).map(r => r.title), ["Alien","Dune","Sinners"], "title sort");
eq(applyQuery(rows, parseQuery("limit: 2")).length, 2, "limit");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
