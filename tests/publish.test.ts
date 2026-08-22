/**
 * What gets posted under your name, pinned down exactly.
 *
 * This is the one part of Reel whose output other people read, and the one it
 * cannot take back, so the interesting cases here are all about the seams: the
 * review that is one word too short for Trakt, the post that is three
 * characters too long for Mastodon, the retry that must not become a second
 * post. Every one of those is silent in the UI and permanent on the internet.
 */

import {
	composeMastodon,
	composeTrakt,
	titleLine,
	traktComplaint,
	traktRating,
	wordCount,
	MASTODON_DEFAULT_LIMIT,
} from "../src/publish/compose";
import { idempotencyKey, normaliseHost } from "../src/publish/mastodon";
import { parseApp, parseToken } from "../src/publish/trakt";
import type { Entry } from "../src/types";

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

function entry(over: Partial<Entry> = {}): Entry {
	return {
		path: "Movies/Heat.md",
		basename: "Heat",
		type: "film",
		tmdbId: 949,
		title: "Heat",
		year: 1995,
		director: ["Michael Mann"],
		watched: [],
		creators: [],
		seasons: [],
		genres: ["Action", "Crime", "Drama"],
		castIds: [],
		directorIds: [],
		status: "watched",
		cast: [],
		characters: [],
		productionCompanies: [],
		providers: [],
		contentFlags: [],
		contentTopics: [],
		lists: [],
		added: 0,
		watchCount: 1,
		...over,
	} as Entry;
}

/* ---- naming the thing ----------------------------------------------- */

eq("a film uses its year", titleLine(entry()), "Heat (1995)");
eq(
	"a series uses its first air year, because `year` is never set on one",
	titleLine(entry({ type: "tv", title: "The Wire", year: undefined, firstAirYear: 2002 })),
	"The Wire (2002)"
);
eq("no year at all is not a parenthesis", titleLine(entry({ year: undefined })), "Heat");

/* ---- the rating scales exactly -------------------------------------- */

eq("four stars is eight", traktRating(4), 8);
eq("a half star survives the conversion", traktRating(3.5), 7);
eq("five is ten, not eleven", traktRating(5), 10);
eq("half a star is the floor, not zero", traktRating(0.5), 1);
eq("unrated is not zero stars", traktRating(0), undefined);
eq("absent is absent", traktRating(undefined), undefined);

/* ---- Trakt's rules, checked before the request ---------------------- */

const short = { entry: entry(), text: "Loved it.", spoiler: false };
eq("two words is a complaint, not a 422", traktComplaint(short)?.includes("at least 5 words"), true);
eq("and it says how many there were", traktComplaint(short)?.includes("is 2"), true);
eq(
	"exactly five words is allowed",
	traktComplaint({ entry: entry(), text: "One two three four five", spoiler: false }),
	null
);
eq(
	"nothing written is its own message",
	traktComplaint({ entry: entry(), text: "   ", spoiler: false }),
	"There's nothing written to post."
);
eq(
	"no TMDB id means Trakt cannot know the film",
	traktComplaint({ entry: entry({ tmdbId: 0 }), text: "One two three four five", spoiler: false })?.includes("TMDB"),
	true
);

eq("words are counted the way a person counts them", wordCount("  one   two\nthree\t four "), 4);
eq("an empty string is nothing, not one", wordCount("   "), 0);

/* ---- what Trakt receives -------------------------------------------- */

const traktPost = composeTrakt({ entry: entry(), rating: 4.5, text: "The diner scene alone.", spoiler: false });
eq("the stars lead, because Trakt files them separately", traktPost.text.startsWith("★★★★½"), true);
eq("and the prose follows", traktPost.text.endsWith("The diner scene alone."), true);
eq("an unrated review has no stray stars", composeTrakt({ entry: entry(), text: "Fine.", spoiler: false }).text, "Fine.");
eq("Trakt is never truncated", traktPost.truncated, false);

/* ---- what Mastodon receives ----------------------------------------- */

const masto = composeMastodon({ entry: entry(), rating: 4, text: "Still the best shootout ever filmed.", spoiler: false });
eq("a stranger is told what it is", masto.text.startsWith("Heat (1995) ★★★★"), true);
eq("the review is intact", masto.text.includes("Still the best shootout ever filmed."), true);
eq("nothing was cut", masto.truncated, false);

const tagged = composeMastodon(
	{ entry: entry(), rating: 4, text: "Short one.", spoiler: false },
	{ hashtags: "#film #heat" }
);
eq("hashtags go at the end", tagged.text.endsWith("#film #heat"), true);

/*
 * The case that matters: a long review on a default instance.
 *
 * The title and the hashtags must survive, because a post cut down to prose
 * with no film named is not a shorter post, it is a useless one.
 */
const long = composeMastodon(
	{ entry: entry(), rating: 5, text: "word ".repeat(400).trim(), spoiler: false },
	{ limit: MASTODON_DEFAULT_LIMIT, hashtags: "#film" }
);
eq("it fits", long.text.length <= MASTODON_DEFAULT_LIMIT, true);
eq("and says so", long.truncated, true);
eq("the film is still named", long.text.startsWith("Heat (1995) ★★★★★"), true);
eq("the hashtags survived the cut", long.text.endsWith("#film"), true);
eq("the cut is marked rather than a sentence that just stops", long.text.includes("…"), true);
eq("the cut lands on a word boundary", /\bword…/.test(long.text), true);

const wide = composeMastodon({ entry: entry(), text: "word ".repeat(400).trim(), spoiler: false }, { limit: 5000 });
eq("an instance with room does not truncate", wide.truncated, false);

const unbroken = composeMastodon({ entry: entry(), text: "x".repeat(900), spoiler: false }, { limit: 200 });
eq("one unbroken token still fits", unbroken.text.length <= 200, true);
eq("and is still marked as cut", unbroken.truncated, true);

const cramped = composeMastodon({ entry: entry(), text: "Anything.", spoiler: false }, { limit: 8 });
eq("an absurd limit yields the film, not an empty post", cramped.text.length <= 8, true);

/* ---- hosts, as people actually type them ---------------------------- */

eq("bare", normaliseHost("mastodon.social"), "mastodon.social");
eq("with a scheme", normaliseHost("https://mastodon.social"), "mastodon.social");
eq("with a trailing slash", normaliseHost("https://mastodon.social/"), "mastodon.social");
eq("as a full handle", normaliseHost("@me@mastodon.social"), "mastodon.social");
eq("as a bare handle", normaliseHost("me@mastodon.social"), "mastodon.social");
eq("with a path pasted along", normaliseHost("https://mastodon.social/@me"), "mastodon.social");
eq("shouted", normaliseHost("  MASTODON.SOCIAL  "), "mastodon.social");
eq("nothing is nothing", normaliseHost(""), "");

/* ---- the retry must not become a second post ------------------------ */

const a = { entry: entry(), date: "2026-08-20", rating: 4, text: "Same words.", spoiler: false };
const b = { entry: entry(), date: "2026-08-20", rating: 4, text: "Same words.", spoiler: false };
eq("the same post twice is the same key", idempotencyKey(a), idempotencyKey(b));
eq(
	"an edited review is genuinely a different post",
	idempotencyKey(a) === idempotencyKey({ ...a, text: "Different words." }),
	false
);
eq(
	"and so is the same words about a different film",
	idempotencyKey(a) === idempotencyKey({ ...a, entry: entry({ tmdbId: 550 }) }),
	false
);
eq(
	"a rewatch on another night is not a retry",
	idempotencyKey(a) === idempotencyKey({ ...a, date: "2026-08-21" }),
	false
);

/* ---- stored credentials round-trip ---------------------------------- */

eq("an app parses back", parseApp(JSON.stringify({ id: "x", secret: "y" }))?.id, "x");
eq("a half-filled app is not an app", parseApp(JSON.stringify({ id: "x" })), null);
eq("junk is not an app", parseApp("not json"), null);
eq("nothing is not an app", parseApp(null), null);

eq("a token parses back", parseToken(JSON.stringify({ access: "a", refresh: "r", expires: 5 }))?.refresh, "r");
eq("a token with no refresh is unusable", parseToken(JSON.stringify({ access: "a" })), null);
eq(
	"a missing expiry degrades to zero, which reads as 'refresh now'",
	parseToken(JSON.stringify({ access: "a", refresh: "r" }))?.expires,
	0
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
