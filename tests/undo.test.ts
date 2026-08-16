/**
 * Snapshot and restore.
 *
 * Undo is a data-loss feature wearing a friendly name: it overwrites a whole
 * frontmatter block with an older copy. If the copy is shallow, restoring a
 * series puts back a reference to the same seasons array the mutation already
 * edited and nothing changes. If the restore only assigns, keys the mutation
 * added survive it. Both failures look like "undo did nothing" from outside,
 * which is why they are the first cases here.
 */

import { cloneFrontmatter, restoreInto, unchanged, UndoStack, type UndoStep } from "../src/util/undo";

let pass = 0;
let fail = 0;

function eq(actual: unknown, expected: unknown, label: string) {
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	if (a === b) pass++;
	else {
		fail++;
		console.log(`FAIL ${label}\n  expected ${b}\n  actual   ${a}`);
	}
}

function ok(value: boolean, label: string) {
	eq(value, true, label);
}

/* ---- the two failures that would make undo silently useless ---- */

// Shallow copy: the mutation edits the nested object the snapshot points at,
// so by the time you restore, the "old" value is the new one.
{
	const fm: Record<string, unknown> = { title: "Dune", seasons: [{ n: 1, watched: "1-3" }] };
	const before = cloneFrontmatter(fm);
	(fm.seasons as { watched: string }[])[0].watched = "1-9";
	restoreInto(fm, before);
	eq((fm.seasons as { watched: string }[])[0].watched, "1-3", "nested edits are reverted, not aliased");
}

// Assign-only restore: `status` and `watched` were added by the mutation and
// have to go, or undoing "mark watched" leaves the film marked watched.
{
	const fm: Record<string, unknown> = { title: "Dune" };
	const before = cloneFrontmatter(fm);
	fm.status = "watched";
	fm.watched = [{ date: "2026-08-15" }];
	restoreInto(fm, before);
	eq(Object.keys(fm), ["title"], "keys the mutation added are removed");
}

// And the mirror: a key the mutation deleted must come back.
{
	const fm: Record<string, unknown> = { title: "Dune", rating: 4.5 };
	const before = cloneFrontmatter(fm);
	delete fm.rating;
	restoreInto(fm, before);
	eq(fm.rating, 4.5, "a cleared rating is restored");
}

/* ---- restoring in place ---- */

// `processFrontMatter` hands you the live object and reserialises whatever it
// holds, so a restore that returned a new object would write nothing.
{
	const fm: Record<string, unknown> = { a: 1 };
	const same = fm;
	restoreInto(fm, { b: 2 });
	ok(same === fm, "the same object is mutated, not replaced");
	eq(fm, { b: 2 }, "and it holds the snapshot afterwards");
}

/* ---- dates ---- */

// Obsidian hands back real Date objects for date-shaped values. A JSON round
// trip would turn one into a string, and writing a string back where a date
// was changes how it serialises — on a field the user never touched.
{
	const d = new Date(2024, 2, 11);
	const copy = cloneFrontmatter({ released: d });
	ok(copy.released instanceof Date, "a Date stays a Date");
	ok(copy.released !== d, "and is a distinct object");
	eq((copy.released as Date).getTime(), d.getTime(), "with the same instant");
}

/* ---- deep structures ---- */

{
	const fm: {
		seasons: { n: number; watched: string; episode_ratings: Record<string, number> }[];
		watched: { date: string; rating: number }[];
		liked: boolean;
		nothing: null;
	} = {
		seasons: [
			{ n: 1, watched: "1-7", episode_ratings: { "3": 4.5 } },
			{ n: 2, watched: "", episode_ratings: {} },
		],
		watched: [{ date: "2025-01-02", rating: 4 }],
		liked: true,
		nothing: null,
	};
	const copy = cloneFrontmatter(fm);
	eq(copy, fm, "a deep copy equals the original");
	copy.seasons[0].episode_ratings["3"] = 1;
	eq(fm.seasons[0].episode_ratings["3"], 4.5, "editing the copy does not touch the original");
	eq(copy.nothing, null, "null survives (typeof null is 'object')");
}

/* ---- change detection ---- */

// A no-op mutation must not push a step. Tapping the star you already set
// would otherwise bury the undo you actually wanted one press deeper.
ok(unchanged({ rating: 4 }, { rating: 4 }), "identical blocks compare equal");
ok(!unchanged({ rating: 4.5 }, { rating: 4 }), "a changed value is detected");
ok(!unchanged({ rating: 4, liked: true }, { rating: 4 }), "an added key is a change");
ok(!unchanged({ rating: 4 }, { rating: 4, liked: true }), "a removed key is a change");
// processFrontMatter does not promise to preserve key order, so comparing raw
// JSON would report a change every time Obsidian reordered the block.
ok(unchanged({ a: 1, b: 2 }, { b: 2, a: 1 }), "key order is not a change");
ok(unchanged({ s: [{ n: 1, w: "1-3" }] }, { s: [{ w: "1-3", n: 1 }] }), "nor is key order inside an array");
// Array order, on the other hand, is real data: watch history is chronological.
ok(!unchanged({ w: [1, 2] }, { w: [2, 1] }), "array order is a change");
ok(unchanged({ d: new Date(2024, 2, 11) }, { d: new Date(2024, 2, 11) }), "equal dates compare equal");

/* ---- the stack ---- */

function step(label: string, path = "a.md"): UndoStep {
	return { label, path, apply: async () => {} };
}

{
	const s = new UndoStack(3);
	eq(s.peek(), null, "an empty stack has nothing to undo");
	eq(s.pop(), undefined, "and popping it is not an error");

	s.push(step("one"));
	s.push(step("two"));
	eq(s.peek(), "two", "peek reports the newest");
	eq(s.size, 2, "peek does not consume");
	eq(s.pop()?.label, "two", "pop is last-in-first-out");
	eq(s.pop()?.label, "one", "then the one before it");
	eq(s.size, 0, "and the stack empties");
}

// Bounded, because an unbounded undo stack is a memory leak with a friendly
// name — and the oldest steps are the ones nobody trusts enough to press.
{
	const s = new UndoStack(3);
	for (const l of ["a", "b", "c", "d"]) s.push(step(l));
	eq(s.size, 3, "the limit holds");
	eq(s.pop()?.label, "d", "the newest is kept");
	s.pop();
	eq(s.pop()?.label, "b", "and the oldest was dropped, not the newest");
}

// A deleted note cannot be restored into; a recreated one is a different file
// wearing the same name. Either way the snapshot describes nothing real.
{
	const s = new UndoStack();
	s.push(step("rating Dune", "Films/Dune.md"));
	s.push(step("rating Alien", "Films/Alien.md"));
	s.push(step("liking Dune", "Films/Dune.md"));
	s.forget("Films/Dune.md");
	eq(s.size, 1, "every step for that note is dropped");
	eq(s.peek(), "rating Alien", "and the others are untouched");
	s.forget("Films/Nothing.md");
	eq(s.size, 1, "forgetting an unknown path is harmless");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
