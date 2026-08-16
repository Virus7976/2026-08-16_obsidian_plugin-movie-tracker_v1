/**
 * The note writer, against a fake vault.
 *
 * This is the code that runs every time you log a viewing, rate an episode or
 * write a review — far more often than the importer, which got tested first.
 * The pure arithmetic underneath it is covered in mutations.test.ts; what was
 * never covered is the orchestration on top: what actually reaches the file.
 *
 * Two properties matter more than the rest, and both are asserted directly:
 * a review can only ever be appended, and a title can never produce a filename
 * the vault will reject.
 *
 * Async work lives in main() — esbuild's cjs output has no top-level await.
 */

import { NoteWriter, sanitize } from "../src/notes";
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

function makeVault(notes: { path: string; body?: string; fm?: Record<string, unknown> }[] = []) {
	const files = new Map<string, { file: TFile; body: string; fm: Record<string, unknown> }>();

	const add = (path: string, body = "", fm: Record<string, unknown> = {}) => {
		const file = new TFile();
		file.path = path;
		file.basename = path.replace(/\.md$/, "").split("/").pop() ?? path;
		files.set(path, { file, body, fm });
		return file;
	};

	for (const n of notes) add(n.path, n.body ?? "", n.fm ?? {});

	const folders = new Set<string>();

	const plugin = {
		app: {
			vault: {
				append: async (file: TFile, text: string) => {
					const row = files.get(file.path);
					if (row) row.body += text;
				},
				create: async (path: string, body: string) => {
					if (files.has(path)) throw new Error("already exists");
					return add(path, body);
				},
				createFolder: async (path: string) => void folders.add(path),
				getAbstractFileByPath: (path: string) => files.get(path)?.file ?? null,
				getMarkdownFiles: () => [...files.values()].map((v) => v.file),
			},
			metadataCache: {
				getFileCache: (file: TFile) => {
					const row = files.get(file.path);
					return row && Object.keys(row.fm).length ? { frontmatter: row.fm } : {};
				},
			},
			fileManager: {
				processFrontMatter: async (file: TFile, fn: (fm: Record<string, unknown>) => void) => {
					const row = files.get(file.path);
					if (row) fn(row.fm);
				},
			},
		},
		settings: {
			filmFolder: "Movies",
			seriesFolder: "Series",
			peopleFolder: "People",
			noteTemplate: "",
			ratingScale: 5,
			enrich: false,
			downloadPosters: false,
			linkPeople: false,
			castLimit: 10,
		},
		library: { rebuild: () => {}, refresh: () => {}, byPath: () => undefined },
		posters: { cache: async () => null },
	};

	return {
		notes: new NoteWriter(plugin as never),
		file: (path: string) => files.get(path)?.file as TFile,
		body: (path: string) => files.get(path)?.body ?? "",
		fm: (path: string) => files.get(path)?.fm ?? {},
		exists: (path: string) => files.has(path),
	};
}

/* ------------------------------------------------------------------ */
/* Filenames — synchronous, so they run out here                       */
/* ------------------------------------------------------------------ */

{
	const v = makeVault();
	const n = v.notes;

	eq(n.filmBasename("Dune", 2021), "Dune (2021)", "title and year");
	eq(n.filmBasename("Dune"), "Dune", "a title with no year is left alone");

	// Every one of these is rejected by at least one filesystem Obsidian runs
	// on. A title containing them must not produce an uncreatable note.
	eq(n.filmBasename("Face/Off", 1997), "FaceOff (1997)", "a slash would nest the note in a phantom folder");
	eq(n.filmBasename("Mission: Impossible", 1996), "Mission Impossible (1996)", "colons are illegal on Windows");
	eq(n.filmBasename('The "Burbs', 1989), "The Burbs (1989)", "quotes are stripped");
	eq(n.filmBasename("What?", 1972), "What (1972)", "question marks are stripped");
	eq(n.filmBasename("A*P*E", 1976), "APE (1976)", "asterisks are stripped");
	eq(n.filmBasename("[REC]", 2007), "REC (2007)", "square brackets would read as a wikilink");
	eq(n.filmBasename("#Alive", 2020), "Alive (2020)", "a leading hash would read as a heading anchor");

	eq(n.filmBasename("  Dune   Part  Two  ", 2024), "Dune Part Two (2024)", "runs of whitespace collapse");
	eq(n.filmBasename("///"), "Untitled", "a title that sanitises away still yields a usable name");
	eq(n.filmBasename(""), "Untitled", "and so does an empty one");

	const long = n.filmBasename("x".repeat(400), 2024);
	ok(long.length <= 130, "an absurdly long title is truncated rather than rejected by the filesystem");

	// sanitize is exported, so the rule can be checked without a year wrapper.
	eq(sanitize("a|b"), "ab", "pipes are stripped");
	eq(sanitize("a^b"), "ab", "carets are stripped");
	eq(sanitize("a<b>c"), "abc", "angle brackets are stripped");
	eq(sanitize("   "), "Untitled", "whitespace alone is not a filename");
}

async function main(): Promise<void> {
	/* ---- reviews are append-only ---- */

	{
		// The single most important property in this file. Reviews are written
		// with vault.append precisely so that no code path here can reach
		// existing prose. If this ever regresses, people lose writing.
		const v = makeVault([{ path: "Movies/Dune.md", body: "# Dune\n\nMy notes from 2021.\n" }]);
		await v.notes.appendReview(v.file("Movies/Dune.md"), "2026-08-16", 4.5, "Still holds up.");
		const body = v.body("Movies/Dune.md");
		ok(body.startsWith("# Dune\n\nMy notes from 2021.\n"), "existing prose is untouched at the start");
		ok(body.includes("Still holds up."), "and the new review is present");
	}

	{
		const v = makeVault([{ path: "Movies/Dune.md", body: "original" }]);
		await v.notes.appendReview(v.file("Movies/Dune.md"), "2026-08-16", 4, "one");
		await v.notes.appendReview(v.file("Movies/Dune.md"), "2026-08-17", 5, "two");
		const body = v.body("Movies/Dune.md");
		ok(body.includes("one") && body.includes("two"), "a second review does not replace the first");
		ok(body.indexOf("one") < body.indexOf("two"), "and they stay in the order written");
	}

	{
		const v = makeVault([{ path: "Movies/Dune.md", body: "original" }]);
		await v.notes.appendReview(v.file("Movies/Dune.md"), "2026-08-16", 4, "   ");
		eq(v.body("Movies/Dune.md"), "original", "an empty review writes nothing at all");
	}

	{
		const v = makeVault([{ path: "Movies/Dune.md", body: "" }]);
		await v.notes.appendReview(v.file("Movies/Dune.md"), "2026-08-16", undefined, "No stars.");
		const body = v.body("Movies/Dune.md");
		ok(body.includes("No stars."), "a review without a rating still writes");
		ok(!body.includes("·"), "and carries no empty rating separator");
	}

	/* ---- ratings ---- */

	{
		const v = makeVault([{ path: "Movies/Dune.md", fm: { tmdb_id: 438631, rating: 3 } }]);
		await v.notes.setRating(v.file("Movies/Dune.md"), 4.5);
		eq(v.fm("Movies/Dune.md").rating, 4.5, "a rating is stored");

		await v.notes.setRating(v.file("Movies/Dune.md"), null);
		ok(!("rating" in v.fm("Movies/Dune.md")), "and null removes it rather than writing a null");
	}

	{
		const v = makeVault([{ path: "Movies/Dune.md", fm: { tmdb_id: 438631 } }]);
		const on = await v.notes.toggleLiked(v.file("Movies/Dune.md"));
		ok(on, "toggling on reports the new state");
		eq(v.fm("Movies/Dune.md").liked, true, "and writes it");

		const off = await v.notes.toggleLiked(v.file("Movies/Dune.md"));
		ok(!off, "toggling off reports the new state");
		ok(!("liked" in v.fm("Movies/Dune.md")), "and removes the key rather than storing false");
	}

	/* ---- lists ---- */

	{
		const v = makeVault([{ path: "Movies/Dune.md", fm: { tmdb_id: 438631 } }]);
		const f = v.file("Movies/Dune.md");
		await v.notes.addToList(f, "Halloween 2026");
		await v.notes.addToList(f, "Rewatch");
		eq(v.fm("Movies/Dune.md").lists, ["Halloween 2026", "Rewatch"], "lists accumulate");

		await v.notes.addToList(f, "Rewatch");
		eq(v.fm("Movies/Dune.md").lists, ["Halloween 2026", "Rewatch"], "and adding twice does not duplicate");

		await v.notes.removeFromList(f, "Rewatch");
		eq(v.fm("Movies/Dune.md").lists, ["Halloween 2026"], "removing takes out only the one named");
	}

	/* ---- content flags ---- */

	{
		const v = makeVault([{ path: "Movies/Dune.md", fm: { tmdb_id: 438631 } }]);
		const f = v.file("Movies/Dune.md");
		const on = await v.notes.toggleContentFlag(f, "violence");
		ok(on, "a flag can be added by hand");
		const off = await v.notes.toggleContentFlag(f, "violence");
		ok(!off, "and removed again");
	}
}

void main().then(() => {
	console.log(`\n${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
});
