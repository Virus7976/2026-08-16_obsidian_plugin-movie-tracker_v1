/**
 * "No daily note today" and "you told me the wrong folder" are the same
 * silence.
 *
 * Reel appends to today's daily note if there is one and never creates it,
 * which is the right behaviour and not what these tests are about. They are
 * about the setting underneath it: a folder path typed into a box that nothing
 * checked against where the daily notes actually were. Point it at "Journal"
 * when yours live in "Daily" and the toggle stays on, nothing errors, and the
 * feature never does anything at all.
 *
 * The vault knows the difference, so the screen can too.
 */

import { isoDateOf, scanDaily, dailyStatus, suggestDailyFolders, previewLine } from "../src/util/dailynote";

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = ""): void {
	if (cond) {
		passed++;
		console.log(`  ok   ${name}`);
	} else {
		failed++;
		console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
	}
}

function eq(name: string, got: unknown, want: unknown): void {
	const g = JSON.stringify(got);
	const w = JSON.stringify(want);
	ok(name, g === w, g === w ? "" : `got ${g}, want ${w}`);
}

/* ---- recognising a daily note --------------------------------------- */

eq("a dated note at the root", isoDateOf("2026-08-22.md"), "2026-08-22");
eq("a dated note in a folder", isoDateOf("Journal/2026-08-22.md"), "2026-08-22");
eq("nested deeper still", isoDateOf("a/b/c/2026-01-01.md"), "2026-01-01");

/*
 * Strict on purpose, and matching what Reel actually opens. A looser match
 * would report notes the plugin then fails to find, turning a silence into a
 * confident wrong answer — which is worse.
 */
eq("a title with a date in it is not a daily note", isoDateOf("Journal/2026-08-22 thoughts.md"), null);
eq("a different separator is not matched", isoDateOf("2026_08_22.md"), null);
eq("a two-digit year is not matched", isoDateOf("26-08-22.md"), null);
eq("a non-markdown file is not matched", isoDateOf("2026-08-22.txt"), null);
eq("an ordinary note is not matched", isoDateOf("Movies/Heat.md"), null);
// Right shape, not a date.
eq("month 13 is refused", isoDateOf("2026-13-01.md"), null);
eq("day 45 is refused", isoDateOf("2026-01-45.md"), null);

/* ---- scanning -------------------------------------------------------- */

const VAULT = [
	"Journal/2026-08-20.md",
	"Journal/2026-08-21.md",
	"Journal/2026-08-22.md",
	"Journal/notes.md",
	"Old Journal/2025-01-01.md",
	"2026-08-19.md",
	"Movies/Heat.md",
];

const scan = scanDaily(VAULT);

eq("only folders with dated notes appear", [...scan.keys()].sort().join("|"), "|Journal|Old Journal");
eq("they are counted", scan.get("Journal")?.count, 3);
eq("the newest is remembered", scan.get("Journal")?.latest, "2026-08-22");
eq("a root note counts under the empty string", scan.get("")?.count, 1);
eq("an empty vault scans to nothing", scanDaily([]).size, 0);
eq("a vault with no dated notes scans to nothing", scanDaily(["a.md", "b/c.md"]).size, 0);

/* ---- status ---------------------------------------------------------- */

const TODAY = "2026-08-22";

ok("the right folder is fine", dailyStatus("Journal", scan, TODAY).tone === "ok");
ok("and says today's is there", dailyStatus("Journal", scan, TODAY).text.includes("today"));
ok("and counts what it found", dailyStatus("Journal", scan, TODAY).text.includes("3 dated notes"));

/*
 * Having no note for today is the ordinary state of a morning, and Reel is
 * designed to do nothing in it. Reporting that as a problem would put a
 * standing warning on the screen of somebody whose setup is perfect.
 */
ok("a folder with no note for today is still fine", dailyStatus("Old Journal", scan, TODAY).tone === "ok");
ok("and says when the last one was", dailyStatus("Old Journal", scan, TODAY).text.includes("2025-01-01"));

/*
 * The case worth warning about: a folder that has never held a dated note.
 * Nothing will be found there on any day, not just today.
 */
ok("a folder with no dated notes is a warning", dailyStatus("Nope", scan, TODAY).tone === "warn");
ok("and says so plainly", dailyStatus("Nope", scan, TODAY).text.includes("never"));

// Slashes people type out of habit must not change the answer.
ok("surrounding slashes are ignored", dailyStatus("/Journal/", scan, TODAY).tone === "ok");
// Empty means the vault root, which here does hold one.
ok("empty means the root", dailyStatus("", scan, TODAY).tone === "ok");
ok("and the root is named in words", dailyStatus("", scan, TODAY).text.includes("vault root"));

/*
 * A vault with no dated notes anywhere is not a misconfiguration — it is
 * somebody who does not keep a journal, and telling them their folder is wrong
 * would be answering a question they never asked.
 */
const bare = scanDaily(["Movies/Heat.md"]);
ok("no dated notes anywhere is not a warning", dailyStatus("Journal", bare, TODAY).tone === "info");

/* ---- suggestions ----------------------------------------------------- */

eq("the busiest folder leads", suggestDailyFolders(scan)[0], "Journal");
ok("the others are offered too", suggestDailyFolders(scan).includes("Old Journal"));
eq("the root is offerable", suggestDailyFolders(scan).includes("") , true);
eq("nothing to suggest is empty", suggestDailyFolders(new Map()).length, 0);
eq("the limit is honoured", suggestDailyFolders(scan, 1).length, 1);

/* ---- the prefix preview ---------------------------------------------- */

eq("the preview shows the real line", previewLine("- Watched"), "- Watched [[Heat (1995)]]");
eq("a custom prefix is used", previewLine("* Saw"), "* Saw [[Heat (1995)]]");
eq("surrounding space is trimmed", previewLine("  - Watched  "), "- Watched [[Heat (1995)]]");
// Empty falls back to the same default the note writer uses.
eq("empty falls back to the default", previewLine(""), "- Watched [[Heat (1995)]]");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
