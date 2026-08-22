/**
 * The four settings that decide where Reel writes.
 *
 * These are the only fields on the settings screen where being wrong is
 * silent. A bad API key produces an error the moment it is used; a bad folder
 * produces a folder. Reel goes on working perfectly, writing notes somewhere
 * you are not looking, and the symptom that eventually surfaces is "my films
 * have stopped appearing" — reported weeks later as a bug in the library.
 *
 * So the tests here are mostly about the cases that are legal and wrong rather
 * than the ones that are illegal, since it is the legal-and-wrong ones that
 * ship.
 */

import { normaliseFolder, folderState, describeFolder, matchFolders } from "../src/util/folders";

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

/* ---- normalise ------------------------------------------------------ */

eq("plain path is unchanged", normaliseFolder("Movies"), "Movies");
eq("leading slash goes", normaliseFolder("/Movies"), "Movies");
eq("trailing slash goes", normaliseFolder("Movies/"), "Movies");
eq("both go", normaliseFolder("/Movies/"), "Movies");
eq("doubled separators collapse", normaliseFolder("Movies//Posters"), "Movies/Posters");
eq("surrounding space goes", normaliseFolder("  Movies  "), "Movies");
// Someone pasting a Windows path into a vault setting is not a hypothetical.
eq("backslashes become separators", normaliseFolder("Movies\\Posters"), "Movies/Posters");
eq("space around a segment goes", normaliseFolder("Movies / Posters"), "Movies/Posters");
eq("empty stays empty", normaliseFolder(""), "");
eq("only slashes is empty", normaliseFolder("///"), "");

/* ---- state ---------------------------------------------------------- */

const FOLDERS = new Set(["Movies", "Movies/_posters", "Series", "People", "Archive/Old Movies"]);
const FILES = new Set(["Inbox.md", "Movies/Heat.md", "Notes"]);

const st = (p: string) => folderState(p, FOLDERS, FILES);

eq("an existing folder is recognised", st("Movies").kind, "exists");
eq("normalisation happens first", st("/Movies/").kind, "exists");
eq("a nested folder is recognised", st("Movies/_posters").kind, "exists");

/*
 * The case this whole module exists for.
 *
 * "Films" is a perfectly legal path, so nothing is wrong and nothing can be
 * reported as wrong. It is also almost certainly a typo for "Movies", and the
 * only honest thing to do is say which of the two situations you are in.
 */
eq("a missing folder is new, not invalid", st("Films").kind, "new");
eq("and it says it will be created", describeFolder(st("Films")).tone, "info");

eq("empty means the vault root", st("").kind, "root");
ok("and the root is flagged, because it is rarely meant", describeFolder(st("")).tone === "warn");

/*
 * Except in the four places it is actually used.
 *
 * Reel's folder settings revert to their default when cleared, so an empty box
 * never means the root there. Warning about scattered notes would be warning
 * about something that cannot happen — the kind people learn to ignore, and
 * then ignore the real one beside it.
 */
ok("a field with a fallback says so instead", describeFolder(st(""), "Movies").text.includes("Movies"));
eq("and does not call it a problem", describeFolder(st(""), "Movies").tone, "info");

// A note at the exact path fails at the first write, a long way from here.
eq("a note occupying the path collides", st("Notes").kind, "collides");
eq("including when the note has its extension", st("Inbox").kind, "collides");

eq("illegal characters are invalid", st("Movies?").kind, "invalid");
eq("colons too", st("C:/Movies").kind, "invalid");
eq("a dotted folder is refused", st(".obsidian/plugins").kind, "invalid");
eq("a dotted segment anywhere is refused", st("Movies/.hidden").kind, "invalid");

ok(
	"every state has something to say",
	(["", "Movies", "Films", "Notes", "Movies?"] as const).every((p) => describeFolder(st(p)).text.length > 5)
);

/* ---- matching ------------------------------------------------------- */

const ALL = ["Movies", "Movies/_posters", "Series", "People", "Archive/Old Movies", "Music"];

/*
 * Ranking, not filtering.
 *
 * "mov" matches both "Movies" and "Archive/Old Movies". A plain includes()
 * returns them in whatever order the vault enumerated its files, which on a
 * large vault is effectively arbitrary — and the first suggestion is the one
 * people take.
 */
eq("a prefix match outranks a buried one", matchFolders(ALL, "mov")[0], "Movies");
ok("but the buried one is still offered", matchFolders(ALL, "mov").includes("Archive/Old Movies"));
eq("matching is case-insensitive", matchFolders(ALL, "MOVIES")[0], "Movies");
eq("a last-segment match is found", matchFolders(ALL, "_post")[0], "Movies/_posters");
eq("the query is normalised too", matchFolders(ALL, "/movies/")[0], "Movies");
eq("no match is an empty list", matchFolders(ALL, "zzzz").length, 0);

/*
 * The bug this fallback exists for, found by looking at the screen.
 *
 * Reel's default people folder is "Movies/People". Every ranking rule above
 * assumes what you typed is a prefix of what you want, and this query is
 * *longer* than every folder in a vault with a "People" at the root — so the
 * one suggestion anybody would want scored bottom and the field offered
 * nothing whatsoever, on the exact default the plugin ships with.
 */
eq("a too-long path falls back to its last segment", matchFolders(ALL, "Movies/People")[0], "People");
eq("a deep miss finds its leaf", matchFolders(ALL, "a/b/c/Series")[0], "Series");

/*
 * And only as a fallback. "Movies/_posters" is a real folder; loosening to
 * "_posters" as well would add nothing and could reorder the exact match away
 * from the top.
 */
eq("a full-path match is not diluted", matchFolders(ALL, "Movies/_post")[0], "Movies/_posters");
eq("a leaf that also misses stays empty", matchFolders(ALL, "a/b/zzzz").length, 0);
ok("an empty query offers the shallowest folders", matchFolders(ALL, "").length > 0);
eq("an empty query puts a short path first", matchFolders(ALL, "")[0], "Music");

ok("the limit is honoured", matchFolders(ALL, "", 2).length === 2);
ok("an empty vault suggests nothing", matchFolders([], "mov").length === 0);

/*
 * Ties break on length, then alphabetically — deterministic either way.
 * A suggestion list that reorders itself between renders is one you stop
 * trusting to be in the same place twice.
 */
eq("ties are ordered deterministically", matchFolders(["Bb", "Aa"], "").join(), "Aa,Bb");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
