/**
 * The importer, against a fake vault.
 *
 * This is the code that rewrites notes you already own, in place, across the
 * whole vault. Until now it was verified only by the compiler — the pure
 * conversion underneath it is well covered in legacy.test.ts, but nothing
 * checked the part that decides *which* notes to touch and *what* a run does
 * to them.
 *
 * The fake vault below is deliberately small: enough to exercise candidate
 * selection, the once-per-library scale decision, key retirement and the
 * preview/run contract, without pretending to be Obsidian.
 *
 * Everything async lives inside main(): esbuild's cjs output has no
 * top-level await, which is why the other suites are all synchronous.
 */

import { Importer } from "../src/importer";
import { TFile } from "obsidian";

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

function ok(cond: boolean, label: string) {
	eq(cond, true, label);
}

/* ------------------------------------------------------------------ */
/* A vault just real enough                                            */
/* ------------------------------------------------------------------ */

interface FakeNote {
	path: string;
	fm: Record<string, unknown>;
}

function makeVault(notes: FakeNote[], opts: { failOn?: string[] } = {}) {
	const files = new Map<string, { file: TFile; fm: Record<string, unknown> }>();
	for (const n of notes) {
		const file = new TFile();
		file.path = n.path;
		file.basename = n.path.replace(/\.md$/, "").split("/").pop() ?? n.path;
		files.set(n.path, { file, fm: { ...n.fm } });
	}

	let rebuilt = 0;

	const plugin = {
		app: {
			vault: {
				getMarkdownFiles: () => [...files.values()].map((v) => v.file),
			},
			metadataCache: {
				getFileCache: (file: TFile) => {
					const row = files.get(file.path);
					// Frontmatter is absent, not empty, for a note without any.
					return row && Object.keys(row.fm).length ? { frontmatter: row.fm } : {};
				},
			},
			fileManager: {
				processFrontMatter: async (file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					if (opts.failOn?.includes(file.path)) throw new Error("write refused");
					const row = files.get(file.path);
					if (row) fn(row.fm);
				},
			},
		},
		library: { rebuild: () => void rebuilt++ },
	};

	return {
		importer: new Importer(plugin as never),
		frontmatter: (path: string) => files.get(path)?.fm,
		rebuilds: () => rebuilt,
	};
}

/** A note in the old tracker's shape. Rating is the field the scale hinges on. */
const legacy = (rating: unknown, extra: Record<string, unknown> = {}) => ({
	Title: "Some Film",
	Status: "Watched",
	Rating: rating,
	...extra,
});

/* ------------------------------------------------------------------ */
/* Candidate selection — synchronous, so it runs here                  */
/* ------------------------------------------------------------------ */

{
	const v = makeVault([
		{ path: "Old/One.md", fm: legacy(8) },
		{ path: "Notes/Shopping.md", fm: { tags: ["errand"] } },
		{ path: "Notes/Empty.md", fm: {} },
	]);
	const plan = v.importer.preview();
	eq(plan.scanned, 1, "only notes in the old shape are candidates");
	eq(plan.files.length, 1, "the plan carries the files it counted");
	eq(plan.files[0].path, "Old/One.md", "and they are the right ones");
}

{
	const v = makeVault([{ path: "Notes/Shopping.md", fm: { tags: ["errand"] } }]);
	const plan = v.importer.preview();
	eq(plan.scanned, 0, "a vault with nothing to convert scans to zero");
	eq(plan.scaleHalved, false, "and claims no scale decision it did not make");
}

/* ---- the scale decision: taken once, across every note ---- */

// This is the field that matters most. Deciding per note would give one
// library two scales; deciding wrong halves every rating you own.
{
	const v = makeVault([
		{ path: "a.md", fm: legacy(8) },
		{ path: "b.md", fm: legacy(9) },
		{ path: "c.md", fm: legacy(4) },
	]);
	ok(v.importer.preview().scaleHalved, "ratings above five mark the library as out of ten");
}

{
	const v = makeVault([
		{ path: "a.md", fm: legacy(4) },
		{ path: "b.md", fm: legacy(5) },
		{ path: "c.md", fm: legacy(3) },
	]);
	ok(!v.importer.preview().scaleHalved, "ratings within five are left alone");
}

async function main(): Promise<void> {
	/* ---- preview and run agree ---- */

	{
		const v = makeVault([
			{ path: "a.md", fm: legacy(8) },
			{ path: "b.md", fm: legacy(9) },
		]);
		const plan = v.importer.preview();
		const report = await v.importer.run(plan);
		eq(report.scanned, plan.scanned, "the run converts what the preview promised");
		eq(report.scaleHalved, plan.scaleHalved, "and applies the scale the preview showed");
		eq(report.converted, 2, "both notes converted");
		eq(report.skipped, 0, "nothing skipped");
	}

	{
		// The confirmation dialog shows the preview's numbers. If run() could
		// reach a different answer on its own, the dialog would be a lie.
		const v = makeVault([
			{ path: "a.md", fm: legacy(8) },
			{ path: "b.md", fm: legacy(2) },
		]);
		const plan = v.importer.preview();
		const report = await v.importer.run(plan);
		eq(report.scaleHalved, plan.scaleHalved, "a mixed library still gets one answer, decided once");
	}

	{
		const v = makeVault([{ path: "a.md", fm: legacy(8) }]);
		const report = await v.importer.run();
		eq(report.converted, 1, "run without a plan still scans for itself");
	}

	/* ---- what conversion does to a note ---- */

	{
		const v = makeVault([{ path: "a.md", fm: legacy(8) }]);
		await v.importer.run();
		const fm = v.frontmatter("a.md") ?? {};
		ok(!("Status" in fm), "the old capitalised keys are retired");
		ok(!("Rating" in fm), "including the one the scale was read from");
		ok(Object.keys(fm).length > 0, "and the note is not left bare");
	}

	{
		// A note carrying both schemas is the failure key retirement prevents:
		// two sources of truth for one fact, drifting apart from then on.
		const v = makeVault([{ path: "a.md", fm: legacy(8, { Genre: "Drama" }) }]);
		await v.importer.run();
		ok(!("Genre" in (v.frontmatter("a.md") ?? {})), "every legacy key goes, not just the ones read");
	}

	/* ---- failure is survivable ---- */

	{
		// One unwritable note must not abandon the rest of the library
		// half-converted, which is the worst possible place to stop.
		const v = makeVault(
			[
				{ path: "a.md", fm: legacy(8) },
				{ path: "b.md", fm: legacy(9) },
				{ path: "c.md", fm: legacy(7) },
			],
			{ failOn: ["b.md"] }
		);
		const report = await v.importer.run();
		eq(report.converted, 2, "the notes that could be written were");
		eq(report.skipped, 1, "the one that could not is counted");
		eq(report.errors.length, 1, "and reported rather than swallowed");
		ok(report.errors[0].includes("b"), "the error names the note");
	}

	{
		const v = makeVault([{ path: "a.md", fm: legacy(8) }]);
		await v.importer.run();
		eq(v.rebuilds(), 1, "the index is rebuilt once the notes have changed");
	}
}

void main().then(() => {
	console.log(`\n${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
});
