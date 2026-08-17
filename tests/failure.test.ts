/**
 * Telling failures apart.
 *
 * This is what a person reads at the moment something goes wrong, which makes
 * a wrong answer unusually expensive: diagnosing a flat wifi as a bad API key
 * sends someone to check a setting that was never the problem, and diagnosing
 * a bad key as a transient fault gives them a Retry button that can only fail.
 */

import { diagnose, worthReporting } from "../src/util/failure";

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

/* ---- offline wins over everything ---- */

// An offline device produces assorted low-level errors depending on platform
// and timing. Any of them would otherwise be read as a server fault, so the
// connection is checked first and beats every status code.
eq(diagnose(undefined, false).kind, "offline", "no status and no network is offline");
eq(diagnose(500, false).kind, "offline", "a 500 while offline is still offline");
eq(diagnose(401, false).kind, "offline", "so is a 401 — the key is not the problem");

// The wording matters as much as the classification. Being offline is not a
// fault, and the library genuinely still works.
ok(!diagnose(undefined, false).message.toLowerCase().includes("error"), "offline is not called an error");
ok(diagnose(undefined, false).retryable, "and it is worth trying again once there is signal");

/* ---- a bad key is not retryable ---- */

// Retrying an unchanged key fails identically every time, so offering the
// button would be offering something that cannot work.
eq(diagnose(401, true).kind, "auth", "401 is an auth problem");
eq(diagnose(403, true).kind, "auth", "so is 403");
ok(!diagnose(401, true).retryable, "and neither is worth retrying");
ok(diagnose(401, true).settings === true, "the useful destination is settings");

/* ---- transient faults are ---- */

eq(diagnose(429, true).kind, "rate", "429 is rate limiting");
ok(diagnose(429, true).retryable, "which is worth waiting out");
eq(diagnose(500, true).kind, "server", "500 is theirs, not ours");
eq(diagnose(503, true).kind, "server", "so is 503");
ok(diagnose(503, true).retryable, "and a retry is the right move");
// Not the user's fault, and the message should not imply it is.
ok(diagnose(500, true).message.toLowerCase().includes("your end"), "a server fault says so explicitly");

/* ---- a missing title is neither ---- */

// Retrying a 404 forever is pointless: TMDB will keep not having it.
eq(diagnose(404, true).kind, "missing", "404 is a missing record");
ok(!diagnose(404, true).retryable, "and not retryable");
ok(diagnose(404, true).settings !== true, "nor a settings problem");

/* ---- anything else ---- */

eq(diagnose(undefined, true).kind, "unknown", "no status while online is unknown");
ok(diagnose(undefined, true).retryable, "and unknown is retryable — it might have been a blip");
eq(diagnose(418, true).kind, "unknown", "an unhandled 4xx is not guessed at");

/* ---- what is worth interrupting someone for ---- */

// A poster backfill failing because the phone is in a tunnel is not news.
// The screen already works, and a notice is noise on top of a state the user
// chose deliberately.
ok(!worthReporting("offline", true), "background work stays quiet when offline");
ok(worthReporting("offline", false), "but an action you just took does not");
ok(worthReporting("auth", true), "a bad key is worth saying even in the background");
ok(worthReporting("server", true), "and so is a server fault");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
