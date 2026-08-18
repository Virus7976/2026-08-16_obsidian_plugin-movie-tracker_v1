/**
 * Settings must never lose an API key.
 *
 * The user reported that an update "forgot my APIs". The mechanism was real:
 * a failed read looked identical to a fresh install, defaults have a null key
 * blob, and the next save wrote that null over an encrypted secret with no
 * recovery. These are the cases that must never regress.
 */
import { canPersist, mergeForSave } from "../src/util/settingsguard";

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = ""): void {
	if (cond) {
		passed++;
	} else {
		failed++;
		console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
	}
}
function eq(name: string, a: unknown, b: unknown): void {
	ok(name, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

/* ---- canPersist ------------------------------------------------------ */

ok("fresh install may save", canPersist({ read: true, stored: null, fileExists: false }));
ok("normal load may save", canPersist({ read: true, stored: { keyBlob: "x" }, fileExists: true }));

// The bug, stated as a test: a file is there and we could not parse it.
ok(
	"unparseable file must not be overwritten",
	!canPersist({ read: true, stored: null, fileExists: true }),
	"this is exactly the case that ate the keys"
);
ok("a throwing read must not be overwritten", !canPersist({ read: false, stored: null, fileExists: true }));
ok(
	"a throwing read must not save even if the file seems absent",
	!canPersist({ read: false, stored: null, fileExists: false })
);

/* ---- mergeForSave ---------------------------------------------------- */

const stored = { keyBlob: { ct: "cipher", iv: "iv" }, keysPlain: null, lastTab: "library", futureField: 42 };

// The exact shape of the loss: defaults carry a null blob into a save.
eq(
	"a null blob never overwrites a stored one",
	mergeForSave({ keyBlob: null, lastTab: "discover" }, stored).keyBlob,
	{ ct: "cipher", iv: "iv" }
);

eq(
	"an intentional clear does clear",
	mergeForSave({ keyBlob: null, lastTab: "discover" }, stored, true).keyBlob,
	null
);

eq(
	"a new blob replaces the old one",
	mergeForSave({ keyBlob: { ct: "new", iv: "iv2" } }, stored).keyBlob,
	{ ct: "new", iv: "iv2" }
);

eq("unknown fields survive a save", mergeForSave({ lastTab: "stats" }, stored).futureField, 42);
eq("ordinary fields still update", mergeForSave({ lastTab: "stats" }, stored).lastTab, "stats");

eq(
	"plaintext keys are protected the same way",
	mergeForSave({ keysPlain: null }, { keysPlain: { tmdb: "abc" } }).keysPlain,
	{ tmdb: "abc" }
);

eq(
	"nothing stored means nothing to protect",
	mergeForSave({ keyBlob: null }, { lastTab: "library" }).keyBlob,
	null
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
