/**
 * The poster-prune decision.
 *
 * This is the only place Reel deletes a file the user did not name, so the
 * cases here are deliberately paranoid. The rule that matters most is the
 * first one: an index that reads empty must never be taken as permission to
 * remove everything.
 */

import { orphanedPosters } from "../src/util/prune";

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

/* ---- the safety rule ---- */

// The index reads empty while it is still building and after a failed build.
// Treating that as "nothing is referenced" would bin the entire folder.
eq(
	orphanedPosters({ files: ["Posters/1.jpg", "Posters/2.jpg"], referenced: [], libraryEmpty: true }),
	[],
	"an empty index removes nothing, however many files are present"
);

eq(
	orphanedPosters({ files: ["Posters/1.jpg"], referenced: ["Posters/1.jpg"], libraryEmpty: true }),
	[],
	"the empty-index guard wins even when references exist"
);

/* ---- the ordinary case ---- */

eq(
	orphanedPosters({
		files: ["Posters/keep.jpg", "Posters/gone.jpg"],
		referenced: ["Posters/keep.jpg"],
		libraryEmpty: false,
	}),
	["Posters/gone.jpg"],
	"removes only what no entry points at"
);

eq(
	orphanedPosters({ files: ["Posters/a.jpg"], referenced: [null, undefined, ""], libraryEmpty: false }),
	["Posters/a.jpg"],
	"entries without a poster protect nothing"
);

eq(
	orphanedPosters({
		files: ["Posters/a.jpg", "Posters/b.jpg"],
		referenced: ["Posters/a.jpg", "Posters/b.jpg"],
		libraryEmpty: false,
	}),
	[],
	"nothing orphaned, nothing removed"
);

eq(orphanedPosters({ files: [], referenced: ["Posters/a.jpg"], libraryEmpty: false }), [], "no files, no work");

/* ---- path shapes that must not cause a deletion ---- */

// A vault can round-trip a stored path with Windows separators; comparing raw
// strings would call this unreferenced and delete a poster still in use.
eq(
	orphanedPosters({ files: ["Posters/a.jpg"], referenced: ["Posters\\a.jpg"], libraryEmpty: false }),
	[],
	"a backslash-separated reference still protects its file"
);

eq(
	orphanedPosters({ files: ["Posters/a.jpg"], referenced: ["Posters//a.jpg"], libraryEmpty: false }),
	[],
	"a doubled separator still protects its file"
);

eq(
	orphanedPosters({ files: ["Posters/a.jpg"], referenced: ["/Posters/a.jpg"], libraryEmpty: false }),
	[],
	"a leading slash still protects its file"
);

eq(
	orphanedPosters({ files: ["Posters/a.jpg"], referenced: ["Posters/a.jpg/"], libraryEmpty: false }),
	[],
	"a trailing slash still protects its file"
);

/* ---- normalisation must not over-match ---- */

eq(
	orphanedPosters({
		files: ["Posters/a.jpg", "Posters/sub/a.jpg"],
		referenced: ["Posters/a.jpg"],
		libraryEmpty: false,
	}),
	["Posters/sub/a.jpg"],
	"same filename in a subfolder is not protected by the parent"
);

// The caller looks the file up by the string it passed in, so a normalised
// return value would fail to resolve and silently delete nothing.
eq(
	orphanedPosters({ files: ["Posters//gone.jpg"], referenced: ["Posters/keep.jpg"], libraryEmpty: false }),
	["Posters//gone.jpg"],
	"returns the path as given, not the normalised form"
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
