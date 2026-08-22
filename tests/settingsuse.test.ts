/**
 * Every setting has to actually do something.
 *
 * 0.9.0 shipped `publishConfirm`: declared on the interface, defaulted to
 * `true`, given a toggle in the settings screen with a sentence of copy
 * explaining what it governed — and read by nothing at all. The behaviour it
 * described was real and unconditional, so the switch was not broken in any
 * way a user could see. It simply did not exist, and flipping it did nothing.
 *
 * Nothing caught it. It typechecked, because writing a field is a use as far
 * as the compiler is concerned. Twenty-seven test suites passed, because no
 * test can fail on a behaviour that was never wired. Eight audit passes were
 * green, because the toggle rendered beautifully.
 *
 * That is the shape of the whole class: a dead setting is *invisible*. It has
 * no error, no warning and no wrong pixel — only a control that lies about
 * what it controls, and a user who eventually concludes the app ignores them.
 * The only place it shows up is the gap between "this key is written" and
 * "this key is read", so that gap is what this test measures.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = ""): void {
	if (cond) {
		passed++;
	} else {
		failed++;
		console.error(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
	}
}

const SRC = join(__dirname, "..", "src");

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else if (name.endsWith(".ts")) out.push(full);
	}
	return out;
}

const paths = walk(SRC);
const settingsPath = paths.find((p) => p.endsWith("settings.ts")) as string;
const settingsSrc = readFileSync(settingsPath, "utf8");

/*
 * The keys, read off DEFAULT_SETTINGS rather than off the interface.
 *
 * The interface carries comments, optional markers and multi-line types; the
 * default object is one flat literal of `key: value`, which is far harder to
 * misparse. It is also the stricter list — a field on the interface with no
 * default would fail to compile, so anything real appears in both.
 */
const defaults = settingsSrc.slice(
	settingsSrc.indexOf("export const DEFAULT_SETTINGS"),
	settingsSrc.indexOf("const MODE_LABELS")
);
const keys = [...defaults.matchAll(/^\t([A-Za-z_][A-Za-z0-9_]*):/gm)].map((m) => m[1]);

ok("the settings keys were found", keys.length > 25, `parsed ${keys.length}`);

/*
 * Comments are stripped before searching.
 *
 * This repo explains itself at length, and several of those paragraphs name
 * settings that were removed — including the one directly above, which exists
 * to say why `publishConfirm` is gone. A test that counted prose would be
 * satisfied by its own epitaph.
 */
function code(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const elsewhere = paths
	.filter((p) => p !== settingsPath)
	.map((p) => code(readFileSync(p, "utf8")))
	.join("\n");

/*
 * Settings that legitimately live only in the settings screen.
 *
 * Each needs a reason, and the reason has to be that the screen is genuinely
 * where the behaviour is — not that nobody has got round to using it. This
 * list existing is the point: adding to it is a deliberate sentence somebody
 * has to write, which is exactly the moment a dead toggle gets noticed.
 */
const SCREEN_ONLY: Record<string, string> = {
	// Read through the CredentialStore, which reaches them via `this.plugin
	// .settings` on an aliased local rather than by name.
	keysPlain: "held by CredentialStore, not read by name",
	keyBlob: "held by CredentialStore, not read by name",
};

const dead: string[] = [];
for (const key of keys) {
	if (SCREEN_ONLY[key]) continue;
	// `settings.foo` is the idiom everywhere in this codebase; `s.foo` is the
	// abbreviated form used inside credentials.ts and settings.ts helpers.
	const used = new RegExp(`\\bsettings\\.${key}\\b|\\bs\\.${key}\\b`).test(elsewhere);
	if (!used) dead.push(key);
}

ok(
	"no setting is written but never read",
	dead.length === 0,
	dead.length
		? `these have a default and a control but nothing reads them: ${dead.join(", ")}\n` +
			`      Either wire it up, or delete it — a control that governs nothing is worse than a missing one.`
		: ""
);

/*
 * And the reverse: nothing reads a setting that does not exist.
 *
 * A rename that misses a caller leaves `settings.oldName` compiling as
 * `undefined` — falsy, so the feature silently behaves as though the setting
 * were off, which is the same invisible failure from the other direction.
 */
const referenced = [...elsewhere.matchAll(/\bsettings\.([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((m) => m[1]);
const known = new Set(keys);
// Methods and fields that live on the settings *tab*, not in the settings data.
const NOT_DATA = new Set(["length", "keyMode"]);
const phantom = [...new Set(referenced)].filter((k) => !known.has(k) && !NOT_DATA.has(k));

ok(
	"nothing reads a setting that no longer exists",
	phantom.length === 0,
	phantom.length ? `read but not declared: ${phantom.join(", ")}` : ""
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
