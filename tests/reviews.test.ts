/**
 * Reading and editing a review must never damage the note around it.
 *
 * Reviews live in the note body, which is also where everything else the user
 * writes lives. That makes this the one parser in Reel that can lose somebody's
 * work, so the cases below are mostly about what it must leave alone.
 */
import {
	appendReviewSection,
	dateFromHeading,
	headingFor,
	parseReviews,
	ratingFromHeading,
	replaceHeading,
	replaceReview,
	reviewsNewestFirst,
} from "../src/reviews";

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

/* ---- headings ------------------------------------------------------- */

eq("the format appendReview writes", dateFromHeading("4 Aug 2026 · ★★★★"), "2026-08-04");
eq("a single-digit day", dateFromHeading("9 Jan 2021"), "2021-01-09");
eq("plain ISO, as hand-written notes use", dateFromHeading("2019-11-02 · ★★★"), "2019-11-02");
eq("a full month name", dateFromHeading("12 September 2024"), "2024-09-12");
eq("no date is not a review", dateFromHeading("Trivia"), undefined);
eq("a bare year is not a date", dateFromHeading("Thoughts, 2024"), undefined);

eq("four stars", ratingFromHeading("4 Aug 2026 · ★★★★"), 4);
eq("a half star", ratingFromHeading("4 Aug 2026 · ★★★½"), 3.5);
eq("no stars", ratingFromHeading("4 Aug 2026"), undefined);

/* ---- parsing -------------------------------------------------------- */

const note = [
	"Some notes about the film.",
	"",
	"## 4 Aug 2026 · ★★★★",
	"",
	"Held up better than I expected.",
	"",
	"## 2 Feb 2021 · ★★★",
	"",
	"First time. Slow start.",
	"",
	"## Trivia",
	"",
	"Shot in Malta.",
	"",
].join("\n");

const parsed = parseReviews(note);
eq("only dated sections count", parsed.length, 2);
eq("the newest heading is read", parsed[0].heading, "4 Aug 2026 · ★★★★");
eq("its prose is the section body", parsed[0].text, "Held up better than I expected.");
eq("its rating comes off the heading", parsed[0].rating, 4);
eq("the older one too", parsed[1].text, "First time. Slow start.");
eq("a heading that is not a date is skipped", parsed.some((r) => r.text.includes("Malta")), false);

eq("newest first", reviewsNewestFirst(note)[0].date, "2026-08-04");

eq("a note with no reviews", parseReviews("Just some prose.\n").length, 0);
eq("a note with nothing in it", parseReviews("").length, 0);

/* ---- editing must not touch anything else --------------------------- */

const edited = replaceReview(note, parsed[1], "First time. Slow start, strong ending.");
eq("the edited review changed", parseReviews(edited)[1].text, "First time. Slow start, strong ending.");
eq("the other review is untouched", parseReviews(edited)[0].text, "Held up better than I expected.");
eq("prose above the reviews survives", edited.startsWith("Some notes about the film."), true);
eq("the section that is not a review survives", edited.includes("Shot in Malta."), true);
eq("its heading survives", edited.includes("## Trivia"), true);

/*
 * The case a text search would get wrong: two viewings, identical words. An
 * offset-based edit has to change the second one and only the second one.
 */
const twice = ["## 1 Jan 2020 · ★★★★", "", "Still holds up.", "", "## 1 Jan 2015 · ★★★★", "", "Still holds up.", ""].join("\n");
const both = parseReviews(twice);
const one = replaceReview(twice, both[1], "Not any more.");
eq("the right one of two identical reviews", parseReviews(one)[1].text, "Not any more.");
eq("the other identical one is untouched", parseReviews(one)[0].text, "Still holds up.");

/* ---- clearing a review leaves the heading in place ------------------ */

const cleared = replaceReview(note, parsed[0], "   ");
eq("an emptied review keeps its heading", cleared.includes("## 4 Aug 2026 · ★★★★"), true);
eq("and holds no prose", parseReviews(cleared)[0].text, "");

/* ---- appending ------------------------------------------------------ */

const added = appendReviewSection("Body.\n", "2026-08-20", 4.5, "Best of the year so far.");
eq("the heading is written in the same format", added.includes("## 20 Aug 2026 · ★★★★½"), true);
eq("and parses straight back", parseReviews(added)[0].text, "Best of the year so far.");
eq("with its rating", parseReviews(added)[0].rating, 4.5);
eq("an empty review is not appended", appendReviewSection("Body.\n", "2026-08-20", 4, "  "), "Body.\n");
eq("the existing body survives", added.startsWith("Body.\n"), true);

/* ---- changing the score rewrites the heading, not the prose --------- */

const rescored = replaceHeading(note, parsed[0], headingFor(parsed[0], 2.5));
eq("the stars follow the rating", rescored.includes("## 4 Aug 2026 · ★★½"), true);
eq("the prose is untouched", parseReviews(rescored)[0].text, "Held up better than I expected.");
eq("the older heading is untouched", rescored.includes("## 2 Feb 2021 · ★★★"), true);
eq("clearing the rating drops the stars", replaceHeading(note, parsed[0], headingFor(parsed[0], undefined)).includes("## 4 Aug 2026\n"), true);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
