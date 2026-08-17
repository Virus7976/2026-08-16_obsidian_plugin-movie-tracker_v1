/**
 * Looking backwards through the diary.
 *
 * The interesting cases are all boundaries — year ends, leap days, and the
 * daylight-saving shift that turns two consecutive days into a gap if the
 * arithmetic is done in local time.
 */

import { onThisDay, countMilestone, firstMilestones, longestStreak } from "../src/util/milestones";

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

function v(date: string, title = "Dune") {
	return { date, title, path: `${title}.md` };
}

/* ---- on this day ---- */

eq(onThisDay([], "2026-08-16"), [], "an empty diary has no anniversaries");

{
	const out = onThisDay([v("2025-08-16", "Dune"), v("2025-08-15", "Alien")], "2026-08-16");
	eq(out.length, 1, "only the matching month and day counts");
	eq(out[0].viewing.title, "Dune", "and it is the right one");
	eq(out[0].years, 1, "a year ago");
}

// Today's own viewings are not anniversaries. Showing "0 years ago today"
// for something watched this morning would be absurd.
eq(onThisDay([v("2026-08-16")], "2026-08-16"), [], "the same day this year is not an anniversary");

// Nor is a future date, which a hand-typed diary entry can easily contain.
eq(onThisDay([v("2027-08-16")], "2026-08-16"), [], "a future date is not an anniversary");

// Longest ago first: "five years ago today" is a better line than "one".
{
	const out = onThisDay([v("2025-03-11", "A"), v("2021-03-11", "B"), v("2023-03-11", "C")], "2026-03-11");
	eq(out.map((x) => x.years), [5, 3, 1], "oldest anniversary leads");
}

// The month and day are compared as a fixed slice, so a date in another
// month with the same day number must not match.
eq(onThisDay([v("2025-07-16")], "2026-08-16"), [], "same day of a different month does not match");

// Leap day is deliberately not special-cased: showing it on the 28th would
// invent a date the user never recorded.
eq(onThisDay([v("2024-02-29")], "2025-02-28"), [], "a leap-day viewing does not drift to the 28th");
eq(onThisDay([v("2024-02-29")], "2028-02-29").length, 1, "it returns on the next leap day");

/* ---- counts ---- */

eq(countMilestone(0, "ever"), null, "zero is not a milestone");
eq(countMilestone(7, "ever"), null, "nor is an arbitrary number");
ok(countMilestone(10, "year") != null, "ten is");
ok(countMilestone(25, "year") != null, "so is twenty-five");
ok(countMilestone(50, "ever") != null, "and fifty");
ok(countMilestone(100, "ever") != null, "and a hundred");
ok(countMilestone(300, "ever") != null, "and every hundred after that");
// Not every ten: at a film a day that is wallpaper, and wallpaper is
// indistinguishable from nothing.
eq(countMilestone(110, "ever"), null, "but not every ten past a hundred");
eq(countMilestone(20, "ever"), null, "nor twenty");
ok(countMilestone(10, "year")!.text.includes("this year"), "the period is reflected in the wording");
ok(countMilestone(10, "ever")!.text.includes("in total"), "and differs for all-time");

/* ---- firsts ---- */

// A count of one means the title just logged is the only one carrying that
// value. Two or more is not news.
{
	const out = firstMilestones([
		{ value: "Akira Kurosawa", count: 1, preposition: "by" },
		{ value: "Japanese", count: 1, preposition: "in" },
		{ value: "Christopher Nolan", count: 4, preposition: "by" },
	]);
	eq(out.length, 2, "only genuine firsts are reported");
	eq(out[0].text, "Your first film by Akira Kurosawa", "phrased with the right preposition");
	eq(out[1].text, "Your first film in Japanese", "and the other one too");
}

eq(firstMilestones([{ value: "  ", count: 1, preposition: "by" }]), [], "a blank value is not a first");
eq(firstMilestones([{ value: "X", count: 0, preposition: "by" }]), [], "a count of zero is a caller bug, not a first");
eq(firstMilestones([{ value: "X", count: 1, preposition: "by" }], "series")[0].text, "Your first series by X", "the noun is configurable");

/* ---- longest streak ---- */

eq(longestStreak([]), 0, "no viewings, no streak");
eq(longestStreak(["2026-08-16"]), 1, "one day is a streak of one");
eq(longestStreak(["2026-08-14", "2026-08-15", "2026-08-16"]), 3, "three consecutive days");
eq(longestStreak(["2026-08-14", "2026-08-16"]), 1, "a gap breaks it");

// Two viewings on one day are one day. Without de-duplication a double bill
// would read as a two-day streak.
eq(longestStreak(["2026-08-16", "2026-08-16"]), 1, "two films in a day is still one day");

// Order is not guaranteed by the caller.
eq(longestStreak(["2026-08-16", "2026-08-14", "2026-08-15"]), 3, "unsorted input still works");

// Month and year boundaries.
eq(longestStreak(["2026-01-31", "2026-02-01"]), 2, "a streak crosses a month end");
eq(longestStreak(["2025-12-31", "2026-01-01"]), 2, "and a year end");
eq(longestStreak(["2024-02-28", "2024-02-29", "2024-03-01"]), 3, "and a leap day");
eq(longestStreak(["2025-02-28", "2025-03-01"]), 2, "and a non-leap February");

// The reason the arithmetic is done in UTC: in a zone that springs forward,
// these two dates are 23 hours apart locally, and a naive difference would
// call them a gap.
eq(longestStreak(["2026-03-28", "2026-03-29", "2026-03-30"]), 3, "a daylight-saving shift does not break a streak");

// The longest run wins, not the most recent.
eq(longestStreak(["2026-01-01", "2026-01-02", "2026-01-03", "2026-06-01"]), 3, "the best run is reported, not the last");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
