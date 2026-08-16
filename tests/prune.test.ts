/**
 * The poster-prune decision.
 *
 * This is the only place Reel deletes a file the user did not name, so the
 * cases here are deliberately paranoid. The rule that matters most is the
 * first one: an index that reads empty must never be taken as permission to
 * remove everything.
 */

import { orphanedPosters, isReelPoster } from "../src/util/prune";

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
	orphanedPosters({ files: ["Posters/603.jpg", "Posters/tv-1396.jpg"], referenced: [], libraryEmpty: true }),
	[],
	"an empty index removes nothing, however many files are present"
);

eq(
	orphanedPosters({ files: ["Posters/603.jpg"], referenced: ["Posters/603.jpg"], libraryEmpty: true }),
	[],
	"the empty-index guard wins even when references exist"
);

/* ---- the ordinary case ---- */

eq(
	orphanedPosters({
		files: ["Posters/603.jpg", "Posters/1396.jpg"],
		referenced: ["Posters/603.jpg"],
		libraryEmpty: false,
	}),
	["Posters/1396.jpg"],
	"removes only what no entry points at"
);

eq(
	orphanedPosters({ files: ["Posters/603.jpg"], referenced: [null, undefined, ""], libraryEmpty: false }),
	["Posters/603.jpg"],
	"entries without a poster protect nothing"
);

eq(
	orphanedPosters({
		files: ["Posters/603.jpg", "Posters/tv-1396.jpg"],
		referenced: ["Posters/603.jpg", "Posters/tv-1396.jpg"],
		libraryEmpty: false,
	}),
	[],
	"nothing orphaned, nothing removed"
);

eq(orphanedPosters({ files: [], referenced: ["Posters/603.jpg"], libraryEmpty: false }), [], "no files, no work");

/* ---- path shapes that must not cause a deletion ---- */

// A vault can round-trip a stored path with Windows separators; comparing raw
// strings would call this unreferenced and delete a poster still in use.
eq(
	orphanedPosters({ files: ["Posters/a.jpg"], referenced: ["Posters\\a.jpg"], libraryEmpty: false }),
	[],
	"a backslash-separated reference still protects its file"
);

eq(
	orphanedPosters({ files: ["Posters/603.jpg"], referenced: ["Posters//603.jpg"], libraryEmpty: false }),
	[],
	"a doubled separator still protects its file"
);

eq(
	orphanedPosters({ files: ["Posters/603.jpg"], referenced: ["/Posters/603.jpg"], libraryEmpty: false }),
	[],
	"a leading slash still protects its file"
);

eq(
	orphanedPosters({ files: ["Posters/603.jpg"], referenced: ["Posters/603.jpg/"], libraryEmpty: false }),
	[],
	"a trailing slash still protects its file"
);

/* ---- normalisation must not over-match ---- */

eq(
	orphanedPosters({
		files: ["Posters/603.jpg", "Posters/sub/603.jpg"],
		referenced: ["Posters/603.jpg"],
		libraryEmpty: false,
	}),
	["Posters/sub/603.jpg"],
	"same filename in a subfolder is not protected by the parent"
);

// The caller looks the file up by the string it passed in, so a normalised
// return value would fail to resolve and silently delete nothing.
eq(
	orphanedPosters({ files: ["Posters//1396.jpg"], referenced: ["Posters/603.jpg"], libraryEmpty: false }),
	["Posters//1396.jpg"],
	"returns the path as given, not the normalised form"
);

/* ---- only Reel's own files are candidates ---- */

// The poster folder is a user-editable setting. Point it at a folder that
// already holds your own attachments and "delete whatever no note references"
// would bin them. Reel writes two filename shapes; nothing else is ours.
eq(
	orphanedPosters({
		files: ["Posters/603.jpg", "Posters/holiday-photo.jpg", "Posters/notes.pdf"],
		referenced: [],
		libraryEmpty: false,
	}),
	["Posters/603.jpg"],
	"files Reel did not create are never candidates"
);

eq(
	orphanedPosters({
		files: ["Attachments/1396.jpg", "Attachments/tv-1396.jpg", "Attachments/scan.jpg"],
		referenced: ["Attachments/1396.jpg"],
		libraryEmpty: false,
	}),
	["Attachments/tv-1396.jpg"],
	"a shared folder loses only the unreferenced Reel poster"
);

eq(isReelPoster("Posters/603.jpg"), true, "film poster recognised");
eq(isReelPoster("Posters/tv-1396.jpg"), true, "series poster recognised");
eq(isReelPoster("Posters/603.png"), false, "a different extension is not ours");
eq(isReelPoster("Posters/603 (1).jpg"), false, "a duplicate-suffixed copy is not ours");
eq(isReelPoster("Posters/Dune 603.jpg"), false, "a named file containing digits is not ours");
eq(isReelPoster("Posters/tv-.jpg"), false, "the prefix alone is not ours");
eq(isReelPoster("Posters/movie-603.jpg"), false, "an unknown prefix is not ours");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
