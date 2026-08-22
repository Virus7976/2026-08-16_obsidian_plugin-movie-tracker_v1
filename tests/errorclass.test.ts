/**
 * The check that catches a screen apologising must not depend on a list.
 *
 * The audit has a sentinel whose entire job is to notice that a screen rendered
 * nothing but an error message while every other check passed. It did that job
 * twice. Then it failed at it, on itself: the Ask result screen was wired up,
 * fifteen new checks went green, and the screen showed only "saveSettings is
 * not a function" — because the sentinel matched `.reel-error` and the class is
 * `reel-ask-error`.
 *
 * There were four such classes in the app and the list knew two. That is the
 * failure mode of a list: it is correct the day it is written and decays every
 * time somebody adds a screen, silently, in the one check that exists to break
 * silence.
 *
 * It is matched by shape now. This suite holds the two things that have to be
 * true for that to keep working — that the selector stays a shape and does not
 * drift back into an enumeration, and that error classes keep being named so a
 * shape can find them.
 */

import { readdirSync, readFileSync, statSync } from "fs";
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

const SRC = join(__dirname, "..", "src");

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else if (full.endsWith(".ts")) out.push(full);
	}
	return out;
}

const all = walk(SRC)
	.map((p) => readFileSync(p, "utf8"))
	.join("\n");

/* ---- the classes the app can actually render ------------------------- */

/*
 * Every class name mentioned anywhere in src, however it was written: a `cls:`
 * option, an `addClass`, a `className`. Casting a wide net is the point, since
 * the thing being guarded against is a class the net was not cast over.
 */
const classNames = new Set<string>();
for (const m of all.matchAll(/["'`]([a-z0-9-]*reel-[a-z0-9- ]*)["'`]/g)) {
	for (const c of m[1].split(/\s+/)) if (c) classNames.add(c);
}

ok("the source was actually scanned", classNames.size > 50, `found ${classNames.size} class names`);

const errorish = [...classNames].filter((c) => /err/i.test(c)).sort();

ok("there are error classes to protect", errorish.length >= 3, errorish.join(", "));

/*
 * The selector is `[class*="error"]`, so a class spelled `reel-ask-err` or
 * `reel-oops` is invisible to it. The convention is what makes a shape-based
 * match possible, so the convention is what gets pinned.
 */
const unmatched = errorish.filter((c) => !c.includes("error"));
ok(
	"every error class contains the word the sentinel matches",
	unmatched.length === 0,
	unmatched.length ? `the audit cannot see these: ${unmatched.join(", ")}` : ""
);

/* ---- the sentinel itself --------------------------------------------- */

const audit = readFileSync(join(__dirname, "..", "harness", "audit.ts"), "utf8");

ok(
	"the sentinel matches by shape",
	audit.includes('[class*="error"]'),
	"the crash check no longer uses a wildcard — if it went back to naming classes, it is one new screen away from missing one again"
);

/*
 * The specific regression: a comma-separated list of literal error classes is
 * exactly what was there before, and exactly what must not come back.
 */
ok(
	"the sentinel does not enumerate classes",
	!/querySelectorAll<HTMLElement>\("\.reel-error/.test(audit),
	"the crash check is naming individual error classes again"
);

// It has to keep looking at raw <pre> too: a stack trace dumped into the page
// carries no reel- class at all and is the other way a screen says it broke.
ok("the sentinel still catches raw output", /\[class\*="error"\], pre/.test(audit));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
