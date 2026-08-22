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
function fakePlugin(
	opts: { keys?: string[]; host?: string; result?: unknown; throws?: boolean; locked?: boolean } = {}
) {
	const keys = new Set(opts.keys ?? []);
	return {
		settings: { mastodonHost: opts.host ?? "", connectionHealth: {} as Record<string, unknown> },
		credentials: { has: (k: string) => keys.has(k), needsUnlock: opts.locked ?? false },
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
 * TMDB used to be excepted here, on the grounds that its key might be built
 * in. It is not: with nothing saved, testing it raises a missing-key error and
 * comes back a failure.
 *
 * That cost landed on the first screen of the product. A new install opening
 * the one required guide was offered "Check now" under a line reading "Not
 * checked yet", and pressing it reported a broken connection to somebody who
 * had not been given the chance to set one up yet.
 */
ok("TMDB with no key is not checkable", !checkable(bare as never, "tmdb"));
ok("and is once the key is there", checkable(fakePlugin({ keys: ["tmdb"] }) as never, "tmdb"));

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

/* ---- sealed keys ------------------------------------------------------ */

/*
 * The state the settings screen spends most of its life in, since encrypted is
 * the default: every key stored, none of them readable, and `has()` truthfully
 * reporting all of them as configured because the names live beside the blob.
 *
 * What made that dangerous is that being configured was the only question
 * anything asked. Test connections reached for five keys it could not have,
 * threw a passphrase modal over a screen nobody had asked it to, and wrote
 * down five failures reading "Cancelled" if you declined it. Declining to type
 * a password is not a broken connection to five services.
 */
const sealed = fakePlugin({ keys: ["tmdb", "omdb", "dtdd", "openrouter", "trakt"], locked: true });

ok("a locked TMDB key is not checkable", !checkable(sealed as never, "tmdb"));
ok("nor a locked OMDb key", !checkable(sealed as never, "omdb"));
ok("nor a locked OpenRouter key", !checkable(sealed as never, "openrouter"));
ok("nor a Trakt session whose token cannot be read", !checkable(sealed as never, "trakt"));

/*
 * Mastodon is the exception and it is the same exception as always: the check
 * asks whether the server exists, which needs the address, not the token. A
 * sealed vault stops five checks, not six.
 */
ok(
	"Mastodon is still checkable while locked",
	checkable(fakePlugin({ host: "mastodon.social", locked: true }) as never, "mastodon")
);

// And unlocking is all it takes: nothing else about the fixture changes.
ok("unlocking makes the same keys checkable", checkable(fakePlugin({ keys: ["tmdb"], locked: false }) as never, "tmdb"));

/* ---- running one ------------------------------------------------------ */

void (async () => {
	// Nothing to check reads as silence, not as a result.
	eq("an unchecked feature records nothing", await checkFeature(bare as never, "omdb", 1000), null);
	// Including the required one, on the screen where it matters most.
	eq("a fresh install records no TMDB failure", await checkFeature(bare as never, "tmdb", 1000), null);
	// And a sealed vault records nothing rather than a row of failures about a
	// passphrase prompt you declined.
	eq("a locked vault records nothing", await checkFeature(sealed as never, "tmdb", 1000), null);
	ok("and leaves the health map alone", sealed.settings.connectionHealth.tmdb === undefined);

	// Keyed, because these are about what `checkFeature` records rather than
	// about whether TMDB is checkable — which is the section above.
	const good = fakePlugin({ keys: ["tmdb"] });
	const rec = await checkFeature(good as never, "tmdb", 1000);
	ok("a pass is recorded", rec?.ok === true);
	eq("stamped with the time it was given", rec?.at, 1000);
	ok("and kept on the settings", good.settings.connectionHealth.tmdb !== undefined);

	/*
	 * A client that throws rather than returning is still an answer. Losing it
	 * would leave the row saying "not checked yet" forever, which is the one
	 * thing a check must never do.
	 */
	const angry = fakePlugin({ keys: ["tmdb"], throws: true });
	const thrown = await checkFeature(angry as never, "tmdb", 2000);
	ok("a thrown error is still an answer", thrown?.ok === false);
	ok("and carries something to read", Boolean(thrown && !thrown.ok && thrown.error));

	// A returned failure keeps its reason.
	const sad = fakePlugin({ keys: ["tmdb"], result: { ok: false, error: "OMDb rejected the key." } });
	const bad = await checkFeature(sad as never, "tmdb", 3000);
	ok("a refused check keeps its reason", Boolean(bad && !bad.ok && bad.error?.includes("rejected")));

	// Extras only appear when there are any.
	const plain = await checkFeature(fakePlugin({ keys: ["tmdb"] }) as never, "tmdb", 4000);
	eq("a plain pass carries no qualification", plain?.proves, undefined);
	eq("and no note", plain?.note, undefined);

	const partial = fakePlugin({ keys: ["tmdb"], result: { ok: true, proves: "Server answered.", note: "$1 used" } });
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
