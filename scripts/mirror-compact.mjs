/**
 * Mirror every `@media (max-width: N)` block onto a pane-measured class.
 *
 * The stylesheet's compact rules ask the *viewport* how wide it is. The view
 * is a pane, and a pane's width is its own business: narrow on a desktop with
 * a sidebar open, wide on a tablet in landscape. Worse, a query that fails to
 * match leaves the desktop layout in place, which is the failure the user
 * actually saw.
 *
 * So each block gets a twin scoped to `.reel-view:not(.is-wN)` — true when the
 * pane measures under N *or* has not been measured at all. The original query
 * stays: it still covers the markdown-block styles, which are not in the pane.
 *
 * Run: node scripts/mirror-compact.mjs
 * Idempotent — it rewrites everything below the generated marker.
 */
import { readFile, writeFile } from "node:fs/promises";

/*
 * The generated block sits *before* the hand-written mobile sections.
 *
 * It used to be appended at end-of-file, which meant every mirror outranked
 * every deliberate rule written after it — same specificity, later position.
 * A device snapshot caught this: the sort dropdown was still full width because
 * `.reel-view:not(.is-w500) .reel-select { max-width: none }`, mirrored from an
 * old `@media (max-width: 500px)` block, was silently beating the rule written
 * to fix it.
 *
 * A mirror is a translation of an existing rule, not a new decision. It belongs
 * where the rule it copies belongs — under anything written afterwards on
 * purpose.
 */
const BEGIN = "/* === generated: pane-measured mirrors of the compact rules === */";
const END = "/* === end generated === */";
const FILE = new URL("../styles.css", import.meta.url);

/** Breakpoint classes the view stamps. Pick the smallest that covers N. */
const STEPS = [400, 500, 520, 620, 700, 760, 800, 900];
const stepFor = (n) => STEPS.find((s) => s >= n) ?? STEPS[STEPS.length - 1];

/**
 * Selectors that do not live in the pane, and so must not be mirrored.
 *
 * Sheets are modals: they hang off `document.body` and really are sized by the
 * viewport, so the original media query is already the right rule for them.
 * The header card renders inside a note, not the view, for the same reason.
 *
 * Mirroring them anyway is not merely redundant — the mirror carries a class
 * more than the query it copies, so it outranks the deliberate later rules
 * written for sheets. That is what capped the recipe seed list at 40dvh and
 * threw away the 52dvh a sheet is meant to get.
 */
const NOT_IN_PANE = [".reel-recipe", ".reel-log", ".reel-preview", ".reel-prompt", ".reel-header", ".reel-sheet", ".reel-modal"];
const inPane = (sel) => !NOT_IN_PANE.some((p) => sel.trim().startsWith(p));

const raw = await readFile(FILE, "utf8");

/*
 * Remove any previous generation, in either shape.
 *
 * Older runs appended at end-of-file; this one writes between markers. Both
 * have to go, or a rewrite leaves the old copy in place — still outranking
 * every rule written after it, which is the bug this whole change is about.
 */
let src = raw;
const begin = src.indexOf(BEGIN);
if (begin >= 0) {
	const finish = src.indexOf(END, begin);
	src =
		finish >= 0
			? src.slice(0, begin) + src.slice(finish + END.length)
			: src.slice(0, begin).replace(/\s+$/, "") + "\n";
}

const lines = src.split("\n");
const blocks = [];
for (let i = 0; i < lines.length; i++) {
	const m = /^@media \(max-width: (\d+)px\) \{\s*$/.exec(lines[i]);
	if (!m) continue;
	let depth = 1;
	const body = [];
	let j = i + 1;
	for (; j < lines.length && depth > 0; j++) {
		depth += (lines[j].match(/\{/g) ?? []).length;
		depth -= (lines[j].match(/\}/g) ?? []).length;
		if (depth > 0) body.push(lines[j]);
	}
	blocks.push({ max: Number(m[1]), body });
	i = j - 1;
}

/**
 * Re-root one selector inside the pane.
 *
 * `.reel-view` itself becomes the guard; everything else hangs off it. A
 * selector that never appears in the pane simply stops matching, which is the
 * correct outcome — the untouched media query still covers it.
 */
function reroot(sel, guard) {
	const s = sel.trim();
	if (!s || s.startsWith("/*")) return s;
	if (s === ".reel-view") return guard;
	if (s.startsWith(".reel-view ") || s.startsWith(".reel-view.")) {
		return s.replace(/^\.reel-view/, guard);
	}
	return `${guard} ${s}`;
}

const out = [BEGIN, "", "/* Written by scripts/mirror-compact.mjs — do not edit by hand. */", ""];

for (const { max, body } of blocks) {
	const guard = `.reel-view:not(.is-w${stepFor(max)})`;
	const text = body.join("\n");
	// Strip one level of indentation so the twin reads like hand-written CSS.
	const dedented = text.replace(/^\t/gm, "");
	// Split on rule boundaries, keeping comments attached to what follows.
	const rules = dedented.split(/\}\n/).map((r) => r.trim()).filter(Boolean);
	for (const rule of rules) {
		const open = rule.indexOf("{");
		if (open < 0) continue;
		const head = rule.slice(0, open);
		const decls = rule.slice(open + 1).replace(/\}\s*$/, "").trim();
		if (!decls) continue;
		// Comments live in front of the selector list; carry them across.
		const cm = /^([\s\S]*\*\/)?\s*([\s\S]*)$/.exec(head);
		const comment = (cm?.[1] ?? "").trim();
		const sels = (cm?.[2] ?? head)
			.split(",")
			.filter(inPane)
			.map((s) => reroot(s, guard))
			.filter(Boolean);
		if (!sels.length) continue;
		if (comment) out.push(comment);
		out.push(`${sels.join(",\n")} {`);
		for (const d of decls.split("\n")) out.push(`\t${d.trim()}`);
		out.push("}", "");
	}
}

out.push(END, "");

/*
 * Written at the anchor, not at the end.
 *
 * The anchor marks the start of the hand-written mobile sections, so every
 * deliberate rule comes after the mirrors and wins on source order. Falling
 * back to appending would silently restore the defect, so a missing anchor is
 * an error rather than a default.
 */
const ANCHOR = "/* Mobile density pass";
const at = src.indexOf(ANCHOR);
if (at < 0) {
	console.error("mirror-compact: anchor not found — refusing to append, which would outrank the hand-written rules.");
	process.exit(1);
}
// Back up to the comment box that opens the section, so the generated block
// lands between sections rather than inside one.
const boxed = src.lastIndexOf("/* ---", at);
const insertAt = boxed >= 0 && at - boxed < 200 ? boxed : at;
await writeFile(FILE, `${src.slice(0, insertAt)}${out.join("\n")}\n${src.slice(insertAt)}`);
console.log(`mirrored ${blocks.length} compact blocks`);
