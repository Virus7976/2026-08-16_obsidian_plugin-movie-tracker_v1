/**
 * The dialog in front of every irreversible thing, and the red it wears.
 *
 * Six actions go through one confirmation modal — removing every stored key,
 * removing one, disconnecting Trakt, trashing cached posters, writing your keys
 * to disk in cleartext — and it had never been rendered by the layout rig at
 * all. The whole safety net was unmeasured.
 *
 * Drawing it found the confirm button rendering as bare muted text with no fill
 * and no border, while Cancel beside it had both. The cause is worth keeping:
 * the stylesheet demotes destructive buttons and gives them their fill only at
 * `data-confirming="true"`, which is the second tap of an inline control on the
 * detail screen. That attribute is set in exactly one file, and never in the
 * dialog — so a rule written for a two-stage button was governing a one-stage
 * one that could never reach stage two.
 *
 * Then the fix failed twice on colour, in the same shape both times: a theme
 * token answering a question it had not been asked.
 */

import { readFileSync } from "fs";
import { join } from "path";

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

const ROOT = join(__dirname, "..");
const css = readFileSync(join(ROOT, "styles.css"), "utf8");
const confirmSrc = readFileSync(join(ROOT, "src", "ui", "confirm.ts"), "utf8");

/* ---- the dialog says which kind of screen it is ---------------------- */

/*
 * Demoting a destructive button among a stack of ordinary ones is right, and
 * is what the quiet rule is for. A dialog whose entire purpose is the choice is
 * the opposite case, and it has to be able to say so.
 */
ok(
	"the confirmation marks itself as the decision",
	/addClass\("reel-confirm"\)/.test(confirmSrc),
	"the dialog inherits the quiet treatment meant for inline buttons and its confirm renders as a label"
);
ok("and the stylesheet acts on that", /\.reel-confirm .reel-btn\.reel-btn-danger/.test(css));

/* ---- a fill is not a text colour ------------------------------------- */

/*
 * First failure: the fill read `--text-error`, which a dark theme lightens so
 * it works as text on a dark surface. rgb(248, 113, 113) under white is
 * 2.77:1, and the audit caught it on the first draw.
 *
 * Second: the ink read `--text-on-accent`, which means "text that sits on the
 * accent" — and a palette whose accent is light defines it dark. On the
 * audit's warm-dark palette that put rgb(32, 26, 19) on the red: 2.66:1.
 *
 * Both times the theme gave a correct answer to a different question. The pair
 * is fixed now, and the point of this test is that it stays a pair.
 */
const fillRules = css.split("\n").filter((l) => /background: var\(--reel-danger-fill\)/.test(l));
ok("something fills with the danger colour", fillRules.length >= 1, `${fillRules.length} rules`);

ok(
	"the fill does not read the theme's text colour",
	!/background: var\(--text-error/.test(css),
	"a dark theme lightens its error colour so it reads as text, which makes it fail as a fill"
);
ok(
	"and the ink on it does not read the accent's",
	!/--reel-danger-fill[\s\S]{0,400}?color: var\(--text-on-accent/.test(css),
	"a palette with a light accent defines that token dark, and puts dark text on the red"
);
ok("both halves of the pair exist", /--reel-danger-fill:/.test(css) && /--reel-danger-ink:/.test(css));

/*
 * And they are defined once, at the root, with no dark-theme override. An
 * override is what would reintroduce the whole problem: a fill supplies its own
 * background, so the surface beneath it never enters into the ratio.
 */
ok(
	"the pair is not re-answered per theme",
	!/\.theme-dark[\s\S]{0,200}?--reel-danger-fill:/.test(css),
	"a per-theme fill is a per-theme contrast ratio, which is the bug this token exists to prevent"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
