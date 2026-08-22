/**
 * Every feature has to have a guide.
 *
 * "Seamless setup for any feature" is not something you achieve once. It is
 * something that decays the next time somebody adds a service at half past
 * eleven, wires a key field into the credential store, ships it, and never
 * writes the four sentences telling anybody where to get the key. Nothing
 * would catch that: the field renders, the key saves, the feature works — for
 * the one person who already knew what to paste into it.
 *
 * So the load-bearing assertion in this file is the cross-check. Every
 * credential Reel can store must be claimed by exactly one feature spec, and
 * every feature spec must claim credentials that exist. Adding a service
 * without a guide fails the suite; deleting a service and leaving its guide
 * behind fails it too.
 *
 * The rest is proofreading a person cannot be trusted to do at volume: that no
 * step is blank, that every link parses and is https, and — the one that has
 * actually bitten real setups — that the values meant to be copied character
 * for character carry no stray whitespace.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { FEATURES, isConfigured, isPartial, setupState } from "../src/setup";
import { READ_KEYS, WRITE_KEYS, KeyName } from "../src/credentials";

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

/* ---- Shape ---------------------------------------------------------- */

ok("there is at least one feature", FEATURES.length > 0);

const ids = FEATURES.map((f) => f.id);
ok("feature ids are unique", new Set(ids).size === ids.length, `ids: ${ids.join(", ")}`);

const essential = FEATURES.filter((f) => f.essential);
ok(
	"exactly one feature is essential",
	essential.length === 1,
	`essential: ${essential.map((f) => f.id).join(", ") || "none"}`
);

/*
 * TMDB is the one. Asserted by name rather than by count, because "exactly one
 * is essential" would still pass if somebody marked the wrong one and unmarked
 * TMDB — which would put a "Reel needs one key before it can do anything"
 * banner in front of a feature Reel does not need at all.
 */
ok("the essential feature is TMDB", essential[0]?.id === "tmdb", `got: ${essential[0]?.id}`);

for (const f of FEATURES) {
	ok(`${f.id}: has a name`, f.name.trim().length > 0);
	ok(`${f.id}: says what you get`, f.gives.trim().length > 10, `gives: ${JSON.stringify(f.gives)}`);
	ok(`${f.id}: says what it costs`, f.effort.trim().length > 0);
	ok(`${f.id}: says what leaves the vault`, f.sends.trim().length > 10, `sends: ${JSON.stringify(f.sends)}`);
	ok(`${f.id}: has steps`, f.steps.length > 0);
	ok(`${f.id}: claims at least one credential`, f.keys.length > 0);
}

/* ---- The decay guard ------------------------------------------------ */

const ALL_KEYS: KeyName[] = [...READ_KEYS, ...WRITE_KEYS];
const claimed = FEATURES.flatMap((f) => f.keys);

const unguided = ALL_KEYS.filter((k) => !claimed.includes(k));
ok(
	"every credential Reel stores belongs to a guided feature",
	unguided.length === 0,
	unguided.length
		? `no setup guide covers: ${unguided.join(", ")}\n` +
			`       Add a FeatureSpec in src/setup.ts. A key field with no guide is a\n` +
			`       field only the person who wrote it knows how to fill in.`
		: ""
);

const phantom = claimed.filter((k) => !ALL_KEYS.includes(k));
ok(
	"no guide describes a credential that does not exist",
	phantom.length === 0,
	phantom.length ? `claimed but unknown: ${phantom.join(", ")}` : ""
);

const dupes = claimed.filter((k, i) => claimed.indexOf(k) !== i);
ok(
	"no credential is claimed by two features",
	dupes.length === 0,
	dupes.length ? `claimed twice: ${[...new Set(dupes)].join(", ")}` : ""
);

/* ---- Proofreading --------------------------------------------------- */

for (const f of FEATURES) {
	f.steps.forEach((step, i) => {
		const at = `${f.id} step ${i + 1}`;
		ok(`${at}: has text`, step.text.trim().length > 0);

		if (step.url) {
			let parsed: URL | null = null;
			try {
				parsed = new URL(step.url);
			} catch {
				parsed = null;
			}
			ok(`${at}: link parses`, parsed !== null, `url: ${step.url}`);
			// A setup guide that sends somebody to http:// to create an API key
			// is a setup guide that helps them leak it.
			ok(`${at}: link is https`, parsed?.protocol === "https:", `url: ${step.url}`);
		}

		if (step.copy) {
			/*
			 * The reason this check exists.
			 *
			 * `write:statuses ` with a trailing space is accepted by the field,
			 * rejected by the server, and identical to the correct value on
			 * screen. Same for a redirect URI. Whitespace in a copy value is
			 * not a typo you can see.
			 */
			ok(`${at}: copy value has no stray whitespace`, step.copy === step.copy.trim(), JSON.stringify(step.copy));
			ok(`${at}: copy value is not empty`, step.copy.length > 0);
		}
	});
}

/* ---- State ---------------------------------------------------------- */

function fake(present: KeyName[]): never {
	const set = new Set(present);
	return { credentials: { has: (k: KeyName) => set.has(k) } } as never;
}

const tmdb = FEATURES.find((f) => f.id === "tmdb")!;
const trakt = FEATURES.find((f) => f.id === "trakt")!;

ok("a missing key reads as not configured", !isConfigured(fake([]), tmdb));
ok("a present key reads as configured", isConfigured(fake(["tmdb"]), tmdb));

/*
 * Trakt is the only two-key feature, and half-done is a real state somebody
 * lands in: you register the application, save the id and secret, and then put
 * the phone down before signing in. That used to render exactly like never
 * having started, which is the most discouraging possible answer.
 */
ok("half of a two-key feature is partial", isPartial(fake(["traktApp"]), trakt));
ok("half of a two-key feature is not configured", !isConfigured(fake(["traktApp"]), trakt));
ok("both keys is configured", isConfigured(fake(["traktApp", "trakt"]), trakt));
ok("both keys is not partial", !isPartial(fake(["traktApp", "trakt"]), trakt));
ok("nothing at all is not partial", !isPartial(fake([]), trakt));

const empty = setupState(fake([]));
ok("no TMDB key blocks", empty.blocked);
ok("the essential feature is never in the optional lists", !empty.todo.concat(empty.done, empty.partial).some((f) => f.essential));
ok("with nothing set, every optional feature is to do", empty.todo.length === FEATURES.length - 1);

const some = setupState(fake(["tmdb", "omdb", "traktApp"]));
ok("a TMDB key unblocks", !some.blocked);
ok("a configured optional feature is done", some.done.map((f) => f.id).join() === "omdb");
ok("a half-configured feature is partial", some.partial.map((f) => f.id).join() === "trakt");
ok(
	"every optional feature lands in exactly one bucket",
	some.done.length + some.partial.length + some.todo.length === FEATURES.length - 1
);

/* ---- a guide that says "below" must have something below ------------- */

/*
 * Every one of the six guides ends by telling you to paste something below:
 * the key, the client ID and secret, the server address. There was nothing
 * below. A guide is a sheet opened on top of the settings screen, containing a
 * title, numbered steps and a button that closes it — so the field each
 * walkthrough pointed at was on the screen underneath the thing saying "look
 * down".
 *
 * Right about what to do, wrong about where, which is the worst combination:
 * it reads as correct, and following it means abandoning the walkthrough
 * halfway to hunt for a control among forty-nine others.
 *
 * Checked against the source of `setupFields` rather than by rendering it,
 * because the fault was never in the rendering — it was that no branch
 * existed at all.
 */
const fieldsSrc = readFileSync(join(__dirname, "..", "src", "ui", "fields.ts"), "utf8");

for (const spec of FEATURES) {
	const pointsDown = spec.steps.some((s) => s.text.toLowerCase().includes("below"));
	if (!pointsDown) continue;
	ok(
		`${spec.id}: the guide says "below" and has a field there`,
		new RegExp(`case "${spec.id}":`).test(fieldsSrc),
		`a step tells you to paste something below, and setupFields has no branch for ${spec.id}`
	);
}

// If the wording ever stops saying "below", the loop above would pass by
// checking nothing at all.
ok(
	"the guides do still say it",
	FEATURES.filter((f) => f.steps.some((s) => s.text.toLowerCase().includes("below"))).length >= 5
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
