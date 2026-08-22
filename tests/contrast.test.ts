/**
 * The audit has to measure the colour on the screen, not the one in the rule.
 *
 * For as long as the contrast check existed it read `getComputedStyle(el).color`
 * and compared that to the backdrop. That is the colour the stylesheet asked
 * for. It is not the colour anybody sees, because `opacity` on any ancestor
 * repaints the whole group against what is behind it, and opacity never
 * reached the arithmetic.
 *
 * The cost was not one missed case. Dimming is how this interface says
 * "settled", "secondary" and "blocked", so every faded thing in the app was
 * exempt from the contrast check by accident — a completed walkthrough step
 * computing to rgb(34, 34, 34) and rendering at rgb(133, 133, 133) sailed
 * through at a reported 15.9:1 while actually sitting at 3.69:1. Eleven real
 * failures across seven screens surfaced the moment the compositing was added.
 *
 * This suite pins the two halves that have to stay true together. The
 * measurement must keep compositing, and the exemption that arrived with it
 * — inactive controls, which the spec excludes and which are drawn by dimming
 * — must stay narrow enough that it does not become a way to opt anything out.
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

const audit = readFileSync(join(__dirname, "..", "harness", "audit.ts"), "utf8");
const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");

/* ---- the measurement ------------------------------------------------- */

ok("the audit composites opacity before measuring", /function paintedColour/.test(audit));

/*
 * The specific regression: reading `cs.color` straight into the ratio is
 * exactly what was there before, and exactly what must not come back.
 */
ok(
	"the contrast check no longer reads the computed colour directly",
	!/contrastRatio\(cs\.color/.test(audit),
	"contrast is being measured from the declared colour again, which is not the one on the screen"
);
ok("it measures the painted one instead", /contrastRatio\(paintedColour\(/.test(audit));

// Opacity compounds through ancestors, so a single element's value is not
// enough. The walk is what makes a step dimmed by its container measurable.
ok("the whole ancestor chain is walked", /p = p\.parentElement/.test(audit.slice(audit.indexOf("function paintedColour"))));

/*
 * Compositing happens in sRGB because that is where the browser does it.
 * Blending the linearised values `luminance` works in would give a different
 * grey from the one on the screen, which is the same class of mistake as not
 * compositing at all.
 */
ok("channels are read separately from luminance", /function channels/.test(audit));

/* ---- the exemption --------------------------------------------------- */

ok(
	"inactive controls are exempt, as the spec says",
	/\[aria-disabled="true"\]/.test(audit),
	"1.4.3 excludes disabled components; without this the check flags every greyed-out button"
);

/*
 * `.is-disabled` has to be in there. A `disabled` property makes a control
 * unfocusable, so this app carries the state as a class in several places and
 * the DOM property reads false on them.
 */
ok("and the class this app actually uses is covered", /\.is-disabled/.test(audit));

/*
 * The exemption must not widen. Anything that lets a rule opt out by naming
 * itself would undo the whole check, quietly, one class at a time.
 */
const exemption = audit.slice(audit.indexOf("if (el.closest('[disabled]"), audit.indexOf("if (el.closest('[disabled]") + 120);
ok("and it stays narrow", !/reel-/.test(exemption), `the exemption has grown app classes: ${exemption}`);

/* ---- what the fixes were --------------------------------------------- */

/*
 * Two quiet signals multiply rather than agree. A muted token already means
 * "quieter but readable"; a fade on top of it asks the same question twice and
 * takes the worse answer. This file settled that argument once before, about a
 * faint token at 0.85, and these are the same shape.
 */
const rank = css.slice(css.indexOf(".reel-chart-rank {"), css.indexOf("}", css.indexOf(".reel-chart-rank {")));
ok("the chart rank is muted without also being faded", !/opacity:/.test(rank), rank);

ok(
	"a finished step stays readable",
	/\.reel-setup-step\.is-done \{[^}]*opacity: 0\.9/.test(css),
	"a done step is still text on a screen somebody opened in order to read it"
);

ok(
	"a blocked publish target no longer refuses the cursor",
	!/\.reel-publish-target\.is-blocked \{[^}]*not-allowed/.test(css),
	"these tiles are tappable into their own guide, so a not-allowed cursor contradicts what happens when you press one"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
