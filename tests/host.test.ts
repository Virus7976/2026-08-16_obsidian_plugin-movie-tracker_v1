/**
 * Reel renders into somebody else's app, and that app styles bare tags.
 *
 * The harness reproduced Obsidian's variables faithfully and its element rules
 * not at all, so every layout here was proved against a host that does not
 * exist. Two photographs of the real thing showed the bill. On the phone each
 * feature's description stopped wrapping, ran out past the chevron and
 * overlapped the paragraph below the list. On the desktop the settings tab
 * came back as a column of grey pills with centred labels and their text
 * printed across the row beneath.
 *
 * Neither was exotic. Reel builds a settings section header and a feature row
 * as a single `<button>` so the whole row is tappable, and a bare button in
 * the host carries a background, a fixed height, centred text and
 * `white-space: nowrap` — which inherits, so it reaches every word inside.
 *
 * The stylesheet had already learnt this once, for `.reel-btn`, after a theme
 * applied its decorative button treatment to a grid of small controls. What
 * was missing was that the rule belongs to every button Reel makes, including
 * the ones that were never meant to look like buttons at all.
 *
 * Two things have to stay true together: the harness has to keep modelling a
 * host that styles bare elements, and the reset has to keep sitting below
 * Reel's own rules in the cascade. A reset that outranked what it protects
 * would be the worse bug.
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

const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");
const theme = readFileSync(join(__dirname, "..", "harness", "theme.css"), "utf8");

/* ---- the harness models a host ---------------------------------------- */

/*
 * The specific blindness: a bare `button` rule. Without one the harness is
 * kinder than the real app in exactly the place a plugin gets hurt, and the
 * check that should have caught this passed 975 times instead.
 */
ok(
	"the simulated host styles bare buttons",
	/^button \{/m.test(theme),
	"the harness is back to giving bare elements nothing, which is not what Reel renders into"
);

ok("including the property that inherits", /white-space: nowrap/.test(theme));

// The fixed height is what made rows overlap rather than merely look wrong.
ok("and the one that made rows collide", /height: var\(--input-height/.test(theme));

/* ---- Reel states its own appearance ----------------------------------- */

const reset = css.slice(
	css.indexOf(":where(.reel-view, .reel-modal, .reel-settings) button"),
	css.indexOf("}", css.indexOf(":where(.reel-view, .reel-modal, .reel-settings) button"))
);

ok("the reset exists", reset.length > 40, "no button reset found");
ok("it lets a row grow to its content", /height: auto/.test(reset));
ok("it lets the text inside a row wrap", /white-space: normal/.test(reset));
ok("it stops the host deciding the alignment", /text-align: inherit/.test(reset));
ok("and the host's own button skin", /background: none/.test(reset));

/*
 * `:where()` is the whole reason this is safe. It contributes no specificity,
 * so the reset weighs exactly what the host's `button` rule weighs and wins
 * only on load order — while every real rule in this file still beats it.
 * Written as a plain descendant selector it would outrank `.reel-btn` and
 * strip the styling off every button in the plugin.
 */
ok(
	"the reset carries no specificity of its own",
	css.includes(":where(.reel-view, .reel-modal, .reel-settings) button"),
	"the reset is no longer wrapped in :where(), so it now outranks Reel's own button rules"
);

/* ---- the row that overflowed ------------------------------------------ */

/*
 * A flex item with a zero basis still cannot shrink under its own text, so
 * three buttons with `flex: 1` and no wrap ran 386px wide on a 375px screen
 * once the text was turned up.
 */
const quick = css.slice(css.indexOf(".reel-quickcard-actions {"), css.indexOf(".reel-quickcard-actions .reel-btn {"));
ok("the action row may wrap", /flex-wrap: wrap/.test(quick), quick);
ok(
	"and its buttons have a basis to wrap against",
	/flex: 1 1 6em/.test(css),
	"a zero basis gives the wrap nothing to decide on, which is how the row overflowed"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
