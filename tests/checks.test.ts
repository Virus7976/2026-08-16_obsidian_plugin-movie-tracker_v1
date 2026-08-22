/**
 * Knowing when there is a point in checking.
 *
 * The checks themselves belong to the clients that own them. What this covers
 * is the layer above: which features can be checked at all, and what has to be
 * true first. Those preconditions are not uniform, and getting one wrong is
 * quiet in the worst way — a check with nothing to check reports a failure
 * about a state you are not in, which reads as "this is broken" when the
 * honest answer is "you have not set this up yet".
 *
 * Mastodon is the one that breaks the pattern, on purpose. It is checked by
 * its server address rather than by its token, so a stored token is exactly
 * the wrong precondition: somebody who has typed a server and not yet made a
 * token is precisely who benefits from being told the address is wrong.
 */

import { checkable, checkFeature } from "../src/checks";
import { TESTABLE } from "../src/health";

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = ""): void {
	if (cond) {
		passed++;
		console.log(`  ok   ${name}`);
	} else {
		failed++;
		console.log(`  FAIL ${name}`);
		if (detail) console.log(`       ${detail}`);
	}
}

function eq(name: string, got: unknown, want: unknown): void {
	const g = JSON.stringify(got);
	const w = JSON.stringify(want);
	ok(name, g === w, g === w ? "" : `got ${g}, want ${w}`);
}

/** Only the parts `checkable` and `checkFeature` actually reach for. */
function fakePlugin(opts: { keys?: string[]; host?: string; result?: unknown; throws?: boolean } = {}) {
	const keys = new Set(opts.keys ?? []);
	return {
		settings: { mastodonHost: opts.host ?? "", connectionHealth: {} as Record<string, unknown> },
		credentials: { has: (k: string) => keys.has(k) },
		tmdb: {
			testCredentials: async () => {
				if (opts.throws) throw new Error("network fell over");
				return opts.result ?? { ok: true };
			},
		},
	};
}

/* ---- what can be checked --------------------------------------------- */

const bare = fakePlugin();

/*
 * TMDB is the one Reel cannot work without and its key may be built in, so
 * there is always something to ask about.
 */
ok("TMDB is always checkable", checkable(bare as never, "tmdb"));

ok("a service with no key is not", !checkable(bare as never, "omdb"));
ok("and is once the key is saved", checkable(fakePlugin({ keys: ["omdb"] }) as never, "omdb"));

/*
 * The exception that the whole module is shaped around.
 */
ok("Mastodon with no server is not checkable", !checkable(fakePlugin({ keys: ["mastodon"] }) as never, "mastodon"));
ok(
	"Mastodon with a server is, token or not",
	checkable(fakePlugin({ host: "mastodon.social" }) as never, "mastodon")
);
// The habitual slashes people type must not decide this either way.
ok("a messy server address still counts", checkable(fakePlugin({ host: "https://mastodon.social/" }) as never, "mastodon"));

/*
 * Trakt is gated on being signed in. Testing a sign-in nobody has made would
 * record a failure about a state you are not in, and "Not signed in" is
 * already what the row says.
 */
ok("Trakt needs a session", !checkable(bare as never, "trakt"));
ok("and has one once signed in", checkable(fakePlugin({ keys: ["trakt"] }) as never, "trakt"));

// A feature with no check at all is never checkable, whatever is stored.
ok("an unlistable feature is never checkable", !checkable(fakePlugin({ keys: ["letterboxd"] }) as never, "letterboxd" as never));

/* ---- running one ------------------------------------------------------ */

void (async () => {
	// Nothing to check reads as silence, not as a result.
	eq("an unchecked feature records nothing", await checkFeature(bare as never, "omdb", 1000), null);

	const good = fakePlugin();
	const rec = await checkFeature(good as never, "tmdb", 1000);
	ok("a pass is recorded", rec?.ok === true);
	eq("stamped with the time it was given", rec?.at, 1000);
	ok("and kept on the settings", good.settings.connectionHealth.tmdb !== undefined);

	/*
	 * A client that throws rather than returning is still an answer. Losing it
	 * would leave the row saying "not checked yet" forever, which is the one
	 * thing a check must never do.
	 */
	const angry = fakePlugin({ throws: true });
	const thrown = await checkFeature(angry as never, "tmdb", 2000);
	ok("a thrown error is still an answer", thrown?.ok === false);
	ok("and carries something to read", Boolean(thrown && !thrown.ok && thrown.error));

	// A returned failure keeps its reason.
	const sad = fakePlugin({ result: { ok: false, error: "OMDb rejected the key." } });
	const bad = await checkFeature(sad as never, "tmdb", 3000);
	ok("a refused check keeps its reason", Boolean(bad && !bad.ok && bad.error?.includes("rejected")));

	// Extras only appear when there are any.
	const plain = await checkFeature(fakePlugin() as never, "tmdb", 4000);
	eq("a plain pass carries no qualification", plain?.proves, undefined);
	eq("and no note", plain?.note, undefined);

	const partial = fakePlugin({ result: { ok: true, proves: "Server answered.", note: "$1 used" } });
	const qualified = await checkFeature(partial as never, "tmdb", 5000);
	eq("a qualified pass keeps what it proved", qualified?.proves, "Server answered.");
	eq("and its note", qualified?.note, "$1 used");

	/* ---- the list stays honest ---------------------------------------- */

	// Every id the router can run must be one the health module lists.
	ok("every testable feature has a precondition", TESTABLE.every((id) => typeof checkable(bare as never, id) === "boolean"));
	ok("the list is not empty", TESTABLE.length >= 6);

	console.log(`\n${passed} passed, ${failed} failed`);
	if (failed) process.exit(1);
})();
