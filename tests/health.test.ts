/**
 * Reporting the presence of a thing as though it were the health of it.
 *
 * Two rows on the settings screen made that mistake. "Test connections" put
 * its answer in a Notice that vanished after eight seconds, so the screen
 * could not tell "tested and working" from "never tested". And "Signed in to
 * Trakt" meant a token is stored — tokens expire, an expired one is still
 * stored, and the row went on saying you were signed in until a review failed
 * to publish.
 *
 * Every function here takes `now` as an argument. Relative times are the
 * classic source of a suite that passes all year and fails on one day in one
 * timezone, and not reading the clock is the only real defence.
 */

import { ago, describeHealth, describeTrakt, featureHealth, traktState, STALE_AFTER, TESTABLE, NEEDS_KEY_TO_CHECK } from "../src/health";

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

const NOW = 1_760_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/* ---- ago ------------------------------------------------------------ */

eq("moments ago", ago(NOW - 5_000, NOW), "just now");
eq("one minute is singular", ago(NOW - MIN, NOW), "1 minute ago");
eq("several minutes", ago(NOW - 5 * MIN, NOW), "5 minutes ago");
eq("one hour is singular", ago(NOW - HOUR, NOW), "1 hour ago");
eq("hours", ago(NOW - 5 * HOUR, NOW), "5 hours ago");
eq("one day is singular", ago(NOW - DAY, NOW), "1 day ago");
eq("days", ago(NOW - 5 * DAY, NOW), "5 days ago");
eq("months", ago(NOW - 90 * DAY, NOW), "3 months ago");

// A clock that has gone backwards — a resynced device, a vault synced from a
// machine running fast — must not produce "in -3 minutes".
eq("a future timestamp does not go negative", ago(NOW + HOUR, NOW), "just now");

/*
 * The boundaries, because off-by-one at a unit change is the whole genre of
 * bug this function can have. 59 minutes must not be "0 hours ago".
 */
eq("59 minutes is still minutes", ago(NOW - 59 * MIN, NOW), "59 minutes ago");
eq("60 minutes becomes an hour", ago(NOW - 60 * MIN, NOW), "1 hour ago");
eq("23 hours is still hours", ago(NOW - 23 * HOUR, NOW), "23 hours ago");
eq("24 hours becomes a day", ago(NOW - 24 * HOUR, NOW), "1 day ago");
eq("29 days is still days", ago(NOW - 29 * DAY, NOW), "29 days ago");
eq("30 days becomes a month", ago(NOW - 30 * DAY, NOW), "1 month ago");

/* ---- health --------------------------------------------------------- */

const good = (at: number) => ({ at, ok: true });
const bad = (at: number, error: string) => ({ at, ok: false, error });

/*
 * A service you never set up is not a service in trouble.
 *
 * Saying "never checked" about something deliberately left off would put four
 * standing complaints on the screen of anyone using Reel the simple way, and
 * a screen with four permanent warnings has no warnings at all.
 */
eq("an unconfigured service is not a problem", describeHealth(undefined, false, NOW).tone, "info");
eq("and says so plainly", describeHealth(undefined, false, NOW).text, "Not set up");
eq("a configured service with no record is unchecked", describeHealth(undefined, true, NOW).text, "Not checked yet");
eq("which is also not a problem", describeHealth(undefined, true, NOW).tone, "info");

eq("a recent pass is working", describeHealth(good(NOW - 5 * MIN), true, NOW).tone, "ok");
ok("and says when", describeHealth(good(NOW - 5 * MIN), true, NOW).text.includes("5 minutes ago"));

eq("a failure is a warning", describeHealth(bad(NOW - MIN, "401"), true, NOW).tone, "warn");
ok("and carries the reason", describeHealth(bad(NOW - MIN, "401"), true, NOW).text.includes("401"));
ok("a failure with no reason still reads", describeHealth({ at: NOW, ok: false }, true, NOW).text.length > 5);

/*
 * A stale pass is downgraded but not hidden.
 *
 * A key that worked a fortnight ago may since have been revoked or run out of
 * credit, so it should stop claiming to be working — but discarding the record
 * entirely would leave the row saying "not checked yet", which is false and
 * throws away the only evidence there is.
 */
eq("a fortnight-old pass stops claiming to be current", describeHealth(good(NOW - STALE_AFTER - DAY), true, NOW).tone, "info");
ok("but still reports what it saw", describeHealth(good(NOW - STALE_AFTER - DAY), true, NOW).text.startsWith("Worked"));
eq("just inside the window is still working", describeHealth(good(NOW - STALE_AFTER + HOUR), true, NOW).tone, "ok");

/* ---- Trakt ---------------------------------------------------------- */

eq("no token is signed out", traktState(false, undefined, NOW).kind, "out");
eq("no token stays signed out even with an expiry", traktState(false, NOW + DAY, NOW).kind, "out");

/*
 * The bug. A stored token with a date in the past is not a session.
 *
 * This rendered as "Signed in to Trakt" for as long as the token sat in the
 * credential store, which is forever, and the first anybody heard of it was a
 * review that would not post.
 */
eq("an expired token is expired", traktState(true, NOW - DAY, NOW).kind, "expired");
eq("and is a warning", describeTrakt(traktState(true, NOW - DAY, NOW), NOW).tone, "warn");
ok("that says how long ago", describeTrakt(traktState(true, NOW - 3 * DAY, NOW), NOW).text.includes("3 days ago"));

eq("a healthy token is signed in", traktState(true, NOW + 60 * DAY, NOW).kind, "in");
eq("and is not a warning", describeTrakt(traktState(true, NOW + 60 * DAY, NOW), NOW).tone, "ok");

/*
 * Reel refreshes a day before expiry, so a token due in three days is fine
 * and should not be reported as a problem the user has to act on.
 */
eq("a token expiring this week is soon", traktState(true, NOW + 3 * DAY, NOW).kind, "soon");
eq("and is still fine", describeTrakt(traktState(true, NOW + 3 * DAY, NOW), NOW).tone, "ok");
ok("and says it renews itself", describeTrakt(traktState(true, NOW + 3 * DAY, NOW), NOW).text.includes("automatically"));

// Exactly at the boundary is gone, not nearly gone.
eq("expiring this instant is expired", traktState(true, NOW, NOW).kind, "expired");

/*
 * A token stored before Reel recorded expiries. Genuinely unknown, which is a
 * different answer from expired, and guessing either way would be a claim the
 * data does not support.
 */
eq("a token with no recorded expiry is unknown", traktState(true, 0, NOW).kind, "unknown");
eq("and is not treated as broken", describeTrakt(traktState(true, 0, NOW), NOW).tone, "info");
eq("nor is undefined", traktState(true, undefined, NOW).kind, "unknown");

/* ---- half an answer, labelled as half -------------------------------- */

/*
 * Mastodon can have its server checked and its token cannot: Reel asks for a
 * token that can only post, and will not post to find out whether posting
 * works. That makes "working" an overstatement, and the whole reason this
 * module exists is that an overstatement here is how the original bug read.
 */
// Reusing the clock the rest of this suite runs on.
const partial = { at: NOW - 60_000, ok: true, proves: "mastodon.social answered. The token is not checked here." };

/*
 * Not "ok". Carrying the caveat in the text was not enough: the row read
 * "Working — checked 5 minutes ago. The token is not checked here" in green,
 * and the first word is the only one somebody scanning five rows reads.
 * `info` is what this module already gives a true-but-weaker answer.
 */
ok("a half-check does not claim to be working", describeHealth(partial, true, NOW).tone === "info");
ok("and never says the word", !describeHealth(partial, true, NOW).text.startsWith("Working"));
ok("and carries the qualification", describeHealth(partial, true, NOW).text.includes("token is not checked"));
ok("and still says when", describeHealth(partial, true, NOW).text.includes("minute"));
// Nothing is wrong, so it must not read as a warning either.
ok("but is not a complaint about a correct setup", describeHealth(partial, true, NOW).tone !== "warn");

// A stale qualified pass must not quietly drop the qualification.
ok(
	"the limit survives going stale",
	describeHealth({ ...partial, at: NOW - STALE_AFTER - 1 }, true, NOW).text.includes("token is not checked")
);

/*
 * `proves` before `note`: a limit on what was checked outranks an
 * encouraging detail found inside it. Being told there is credit left is
 * worse than useless if you have not yet been told the claim is narrow.
 */
const both = { at: NOW - 60_000, ok: true, proves: "Server answered.", note: "$1.00 of $10.00 used" };
const text = describeHealth(both, true, NOW).text;
ok("the caveat comes before the detail", text.indexOf("Server answered") < text.indexOf("$1.00"));
// Led with, then not repeated.
eq("the caveat is said once", text.split("Server answered").length - 1, 1);

// An ordinary pass gains nothing and says nothing extra.
eq("an unqualified pass is unchanged", describeHealth({ at: NOW, ok: true }, true, NOW).text, "Working — checked just now");

/*
 * The three that could only report "a key is present" are checkable now.
 *
 * Trakt was left off this list one release ago, on the grounds that its token
 * states its own expiry and a request could only be suggestive. That was true
 * and it was not the whole question: expiry is not revocation. Access
 * withdrawn from Trakt's website leaves the token stored and its expiry months
 * out, so the exact answer stays exactly right about the wrong thing.
 *
 * Both are kept, because they answer different questions. The expiry needs no
 * network and is readable while the vault is locked, so it stays what the row
 * says on every render; the request is what a check adds.
 */
ok("Ask can be verified", TESTABLE.includes("openrouter"));
ok("Mastodon can be verified", TESTABLE.includes("mastodon"));
ok("Trakt can be verified too", TESTABLE.includes("trakt"));
// The passive answer still comes from the token, with no check recorded.
ok(
	"and still answers from its token when nothing has been checked",
	featureHealth("trakt", { records: {}, hasTrakt: true, traktExpires: NOW + 60 * 24 * 60 * 60 * 1000, locked: false }, NOW)?.text ===
		"Signed in"
);

/* ---- revoked is not expired ------------------------------------------ */

/*
 * These two disagree exactly where it matters. Revoking Reel's access on
 * Trakt's website leaves the stored token untouched and its expiry months
 * away, so every passive signal still reads "Signed in" and the first
 * contradiction is a review that will not post.
 */
const LIVE = traktState(true, NOW + 60 * 24 * 60 * 60 * 1000, NOW);
const refused = { at: NOW - 3 * 60 * 1000, ok: false, error: "Trakt refused this token." };

ok("an unexpired token that was refused is a warning", describeTrakt(LIVE, NOW, refused).tone === "warn");
ok("and says to sign in again", describeTrakt(LIVE, NOW, refused).text.includes("sign in again"));
ok("and says when it was refused", describeTrakt(LIVE, NOW, refused).text.includes("3 minutes ago"));
/*
 * Every line this returns is read straight after something that already says
 * Trakt: the health table labels the row, the setup guide heads the section.
 * Naming it again rendered as "Trakt  Trakt refused this token".
 */
ok("and does not repeat the label beside it", !describeTrakt(LIVE, NOW, refused).text.includes("Trakt"));
// Without the check it is the old answer, which is the whole problem.
ok("the same token with no check still reads as signed in", describeTrakt(LIVE, NOW).text === "Signed in");

/*
 * A failure recorded before you signed out is not news about the state you are
 * in now, and "Not signed in" is the more useful thing to say.
 */
ok("a refusal does not survive signing out", describeTrakt(traktState(false, 0, NOW), NOW, refused).text === "Not signed in");

// A pass is evidence the token was accepted, not merely held.
const accepted = { at: NOW - 5 * 60 * 1000, ok: true };
ok("a checked session says so", describeTrakt(LIVE, NOW, accepted).text.includes("checked 5 minutes ago"));
ok("and is still fine", describeTrakt(LIVE, NOW, accepted).tone === "ok");

/* ---- one router, so screens cannot disagree -------------------------- */

/*
 * This rule was written out four times: the health table, the settings row,
 * the setup guide, and the Trakt sign-in row. The fourth had been missed and
 * would have gone on saying "Signed in to Trakt" for a token Trakt had already
 * refused — in a plugin whose recurring bug is two screens disagreeing about
 * whether something works.
 */
const INPUTS = { records: { trakt: refused }, hasTrakt: true, traktExpires: NOW + 60 * 24 * 60 * 60 * 1000, locked: false };

ok("the router routes Trakt through its own description", featureHealth("trakt", INPUTS, NOW)?.tone === "warn");
ok("and agrees with calling it directly", featureHealth("trakt", INPUTS, NOW)?.text === describeTrakt(LIVE, NOW, refused).text);
eq("a feature nothing can report on says nothing", featureHealth("letterboxd" as never, { records: {}, hasTrakt: false, traktExpires: 0, locked: false }, NOW), null);
ok(
	"an ordinary feature describes its record",
	featureHealth("tmdb", { records: { tmdb: { at: NOW, ok: true } }, hasTrakt: false, traktExpires: 0, locked: false }, NOW)?.tone === "ok"
);
ok("Trakt is testable now", TESTABLE.includes("trakt"));

/* ---- sealed keys are not failed keys --------------------------------- */

/*
 * Encrypted is the default storage mode, so for most of the time this plugin
 * is open its keys are unreadable. Everything else on the screen goes on
 * reporting them as configured, correctly: the names are stored beside the
 * blob and names are not secret.
 *
 * That leaves one line to carry the difference. "Not checked yet" is the right
 * answer for a key nobody has tried and the wrong one for a key nobody *can*
 * try, and from the outside the two states look identical.
 */
const SEALED = { records: {}, hasTrakt: false, traktExpires: 0, locked: true };

ok("a locked key says it is locked", featureHealth("tmdb", SEALED, NOW)?.text.includes("locked") === true);
ok("and offers the way out", featureHealth("tmdb", SEALED, NOW)?.text.includes("unlock") === true);
// Not a fault: nothing has gone wrong, you have simply not opened the vault.
ok("and is not painted as a problem", featureHealth("tmdb", SEALED, NOW)?.tone === "info");
/*
 * Every key-backed check says so, with one deliberate exception.
 *
 * Trakt is described by its expiry rather than by a request, and the expiry is
 * stored outside the blob precisely so that a settings row never costs a
 * passphrase. So a sealed vault changes what Trakt can *verify* and not what it
 * can *say*, and overwriting "Signed in" with a lock notice would be losing a
 * true answer to report an irrelevant obstacle.
 */
ok(
	"every other key-backed check says it is locked",
	NEEDS_KEY_TO_CHECK.filter((id) => id !== "trakt").every((id) => featureHealth(id, SEALED, NOW)?.text.includes("locked"))
);
ok("and Trakt answers from its token instead", featureHealth("trakt", SEALED, NOW)?.text === "Not signed in");

/*
 * Mastodon is the exception, and it is the exception it has always been: its
 * check asks the server whether it exists, which needs the address and not the
 * token. A sealed vault stops five checks, not six.
 */
ok("Mastodon is checkable while locked", !NEEDS_KEY_TO_CHECK.includes("mastodon"));
ok("so it says what it always says", featureHealth("mastodon", SEALED, NOW)?.text === "Not checked yet");

/*
 * A result recorded before the lock is still true about the moment it was
 * taken. Replacing it with the lock notice would throw away the only evidence
 * the screen has, in the one state where it can gather no more.
 */
const WAS_FINE = { records: { tmdb: { at: NOW - 60 * 1000, ok: true } }, hasTrakt: false, traktExpires: 0, locked: true };
ok("an earlier pass survives the lock", featureHealth("tmdb", WAS_FINE, NOW)?.text.includes("Working") === true);
ok("and is still reported as a pass", featureHealth("tmdb", WAS_FINE, NOW)?.tone === "ok");

/*
 * Trakt keeps answering from its expiry, which is stored outside the blob for
 * exactly this reason: a settings row should not cost a passphrase.
 */
ok(
	"Trakt still answers while locked",
	featureHealth("trakt", { records: {}, hasTrakt: true, traktExpires: NOW + 60 * 24 * 60 * 60 * 1000, locked: true }, NOW)?.text ===
		"Signed in"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
