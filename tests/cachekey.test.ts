/**
 * Cache filenames.
 *
 * This is where a silent, expensive bug lived. Sanitising a key for the
 * filesystem turned both a comma and a pipe into an underscore — and TMDB
 * uses exactly those two characters to mean AND and OR. So "action AND
 * comedy" and "action OR comedy" shared one cache file, and whichever ran
 * first answered for both. Nothing errored; the screen just reported no
 * results for a query with thousands.
 */

import { cacheFileName, hashKey } from "../src/util/cachekey";

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

/* ---- the bug that started this ---- */

const AND = "rec-movie-with_genres=28,35";
const OR = "rec-movie-with_genres=28|35";
ok(cacheFileName(AND) !== cacheFileName(OR), "AND and OR genre queries get different files");

// The same trap for every other pair of characters the old rule flattened.
ok(cacheFileName("a=1&b=2") !== cacheFileName("a=1|b=2"), "an ampersand and a pipe are distinguishable");
ok(cacheFileName("x?y") !== cacheFileName("x/y"), "a question mark and a slash are too");
ok(cacheFileName("a b") !== cacheFileName("a_b"), "and a space and an underscore");

/* ---- still a legal filename ---- */

// Windows rejects \ / : * ? " < > | outright, and a name over 255 characters
// fails everywhere. A query string contains several of those.
{
	const nasty = cacheFileName('rec-movie-with_genres=28|35&q="x"<y>/z\w:*?');
	ok(!/[\/:*?"<>|]/.test(nasty), "no character illegal on Windows survives");
	ok(nasty.endsWith(".json"), "and it is still a json file");
}

{
	const long = cacheFileName("x".repeat(500));
	ok(long.length < 100, "a very long key still produces a short filename");
}

/* ---- readable, so the cache folder can be understood by eye ---- */

ok(cacheFileName("rec-movie-with_genres=28,35").startsWith("rec-movie-with_genres_28_35"), "the prefix stays legible");

/* ---- deterministic ---- */

eq(cacheFileName(AND), cacheFileName(AND), "the same key always gives the same file");
eq(hashKey("abc"), hashKey("abc"), "the hash is stable");
ok(hashKey("abc") !== hashKey("abd"), "and a one-character change changes it");
ok(hashKey("") === hashKey(""), "an empty key is handled");

/* ---- spread, so near-identical keys do not cluster ---- */

// Discover keys differ only in the digits of an id, which is the case most
// likely to collide if the hash were weak.
{
	const seen = new Set<string>();
	for (let i = 0; i < 2000; i++) seen.add(hashKey(`rec-movie-with_genres=${i}`));
	eq(seen.size, 2000, "two thousand near-identical keys produce no collisions");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
