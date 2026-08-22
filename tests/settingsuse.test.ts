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
	// Which settings sections you left expanded. The settings screen is
	// genuinely the whole of the behaviour here — nothing else in the app has
	// any business knowing, or any way to act on it if it did.
	settingsOpen: "the settings screen is the only thing this describes",
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

/*
 * ---- The section registry ------------------------------------------------
 *
 * Sections used to be nine consecutive method calls, which meant the answer to
 * "what sections are there" existed only in the order of the statements.
 * Three features now need to ask it — collapsing needs an id to remember, the
 * summary line needs somewhere to live, and search needs something to match
 * besides the DOM — so it is a list, and a list can be checked.
 */
const registry = settingsSrc.slice(
	settingsSrc.indexOf("private sections(): SectionSpec[]"),
	settingsSrc.indexOf("display(): void")
);

ok("the section registry was found", registry.length > 500, `parsed ${registry.length} chars`);

const sectionIds = [...registry.matchAll(/^\t\t\t\tid: "([a-z]+)",$/gm)].map((m) => m[1]);
ok("every section has an id", sectionIds.length >= 10, `found ${sectionIds.length}: ${sectionIds.join(", ")}`);
ok(
	"section ids are unique",
	new Set(sectionIds).size === sectionIds.length,
	`ids: ${sectionIds.join(", ")}`
);

const titles = [...registry.matchAll(/^\t\t\t\ttitle: "([^"]+)",$/gm)].map((m) => m[1]);
ok("every section has a title", titles.length === sectionIds.length, `${titles.length} titles, ${sectionIds.length} ids`);

const summaries = registry.match(/summary: \(\) =>/g) ?? [];
ok(
	"every section has a live summary",
	summaries.length === sectionIds.length,
	`${summaries.length} summaries, ${sectionIds.length} sections\n` +
		`      A collapsed section showing only its name is a filing cabinet. The\n` +
		`      summary is what makes the closed state worth reading.`
);

/*
 * No section draws its own heading any more.
 *
 * The card header carries the title, so a leftover `setHeading()` renders the
 * section name twice — once in the header you fold with and once at the top of
 * the body it folds away. It looks like a duplicated word rather than like a
 * structural mistake, which is exactly the sort of thing that survives review.
 */
const strayHeadings = [...code(settingsSrc).matchAll(/setName\("([^"]+)"\)\.setHeading\(\)/g)].map((m) => m[1]);
ok(
	"no section renders its own heading",
	strayHeadings.length === 0,
	strayHeadings.length ? `these would render twice: ${strayHeadings.join(", ")}` : ""
);

/* ---- a state you can enter must be one you can leave ------------------ */

/*
 * There was a "Lock now" button and no unlock.
 *
 * Locking was a decision the screen let you make; unlocking was something that
 * happened *to* you, later, when some unrelated action reached for a key and a
 * passphrase modal arrived to demand a password for a reason you had to infer
 * from whatever you had last tapped. And encrypted is the default storage
 * mode, so this was not a corner of the app: it is the state the settings
 * screen is in every time Obsidian starts.
 *
 * The general fault is a one-way switch — a control that moves the app into a
 * state and no control that moves it back — which is invisible in exactly the
 * way a dead setting is. Everything renders, nothing errors, and the way out
 * is somewhere else or nowhere.
 */
const settingsCode = code(settingsSrc);
ok(
	"the screen can lock the keys",
	/setName\("Lock now"\)/.test(settingsCode),
	"if this button was renamed, rename its counterpart below with it"
);
ok(
	"and can unlock them again",
	/setName\("Unlock keys"\)/.test(settingsCode),
	"locking is offered on the screen and unlocking is not, so the only way back is to trip a passphrase prompt by accident"
);

/*
 * And the check knows about the lock.
 *
 * Test connections used to reach for five keys it could not read, which threw
 * a modal over a screen nobody had asked it to and recorded five failures if
 * you declined it. Whatever else changes, the button has to name the unlock it
 * is about to ask for.
 */
ok(
	"Test connections says when it will ask for the passphrase",
	/Unlock and test/.test(settingsCode),
	"the test button springs a passphrase prompt without saying so"
);

/* ---- exposing every key is at least as serious as deleting one -------- */

/*
 * Switching storage to plain text used to happen on one tap of a dropdown.
 *
 * The other two directions are recoverable in the ordinary sense: you can
 * always encrypt again, or re-enter a key. This one is not, because what it
 * changes is not where the key is kept but who has already read it — once a
 * secret has sat in cleartext in a folder that syncs, moving it back does not
 * un-sync it.
 *
 * Removing a single key has asked for confirmation since it was written.
 * Exposing all of them asked for nothing, and the sentence explaining what it
 * did rendered at the bottom of the section, most of a phone screen below the
 * control that chose it.
 */
ok(
	"switching to plain text is confirmed",
	/next === "plain"/.test(settingsCode) && /confirm\(/.test(settingsCode),
	"the dropdown writes every key to disk in the clear without asking"
);
ok(
	"and a declined confirmation puts the dropdown back",
	/d\.setValue\(this\.plugin\.settings\.keyMode\)/.test(settingsCode),
	"the control would keep showing a mode the vault is not in"
);

/*
 * And the warning names a real path.
 *
 * `app.vault.configDir` interpolated bare renders "undefined/plugins/reel/
 * data.json" wherever it is missing — a security notice pointing at a path
 * that does not exist, which is worse than none, because it reads as a bug and
 * invites you to disbelieve the rest of the sentence.
 */
ok(
	"the plain-text warning cannot name an undefined folder",
	!/\$\{this\.app\.vault\.configDir\}/.test(settingsCode),
	"configDir is interpolated with no fallback"
);
ok(
	"and there is a warning to name it in",
	/Plain text mode writes your keys readably/.test(settingsCode)
);

/* ---- three storage modes, one explanation ----------------------------- */

/*
 * The dropdown offers three arrangements of your secrets and the paragraph
 * above it described one of them. Everybody read about the encrypted blob and
 * its single passphrase, including the person on session-only storage, for
 * whom there is neither.
 *
 * Session mode lost the most by that. Its label says "never written to disk",
 * which is the appealing half; the half you discover by restarting Obsidian —
 * that you type the key in again, every time, on every device — was written
 * down nowhere on the screen.
 */
const modes = [...settingsCode.matchAll(/^	(encrypted|session|plain):/gm)].map((m) => m[1]);
const labelled = new Set(modes);
ok("every storage mode is labelled", labelled.size === 3, [...labelled].join(", "));
ok(
	"and every one of them is explained",
	/const MODE_NOTES/.test(settingsCode),
	"the mode table has labels and no descriptions, so the dropdown explains one mode to people using another"
);
// Session's own fact, which is the one that costs you something if unsaid.
ok(
	"session mode says you re-enter the key every start",
	/every time you start/.test(settingsCode),
	"the appealing half of session mode was on the screen and the inconvenient half was not"
);

/* ---- a control that can do nothing says so ---------------------------- */

/*
 * With nothing configured, Test connections checked none of six services and
 * returned: the button read "Testing…", went back to "Test", and no row, notice
 * or change appeared. On the first screen of a new install that is the most
 * discouraging answer available — you press the control that proves it works
 * and the screen says nothing at all.
 *
 * Both halves are pinned, because either alone is worse than neither: a
 * sentence saying there is nothing to test beside a live button invites you to
 * disagree with the sentence and press it.
 */
ok(
	"the test button explains an empty vault",
	/Nothing to test yet/.test(settingsCode),
	"pressing Test with nothing configured is answered by silence"
);
ok(
	"and is disabled rather than silent",
	/setDisabled\(nothingToTest\)/.test(settingsCode),
	"the description and the button disagree about whether there is anything to do"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
