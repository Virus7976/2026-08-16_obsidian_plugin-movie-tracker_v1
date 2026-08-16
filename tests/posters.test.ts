/**
 * The poster store, against a fake vault.
 *
 * This is the only code in Reel that deletes a file the user did not name, and
 * it nearly deleted the wrong things twice: once by treating an unbuilt index
 * as "nothing is referenced", and once by trashing every file in a folder the
 * user is free to point anywhere.
 *
 * util/prune.ts holds the decision and is tested there. What was never tested
 * is the wiring — which files actually reach trashFile, and whether the guards
 * survive the trip through the vault layer. A correct decision wired to the
 * wrong list is the same disaster.
 *
 * Async work lives in main(); esbuild's cjs output has no top-level await.
 */

import { PosterStore } from "../src/posters";
import { TFile, TFolder } from "obsidian";

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

interface Opts {
	/** Files sitting in the poster folder. */
	files?: string[];
	/** The poster path recorded on each library entry. */
	referenced?: (string | null)[];
	/** Omit the folder entirely, as it is before the first poster is cached. */
	noFolder?: boolean;
	/** Paths whose trashFile call should throw. */
	trashFails?: string[];
	posterFolder?: string;
	downloadPosters?: boolean;
}

function makeStore(opts: Opts = {}) {
	const folderPath = opts.posterFolder ?? "Movies/_posters";
	const trashed: string[] = [];

	const children = (opts.files ?? []).map((p) => {
		const f = new TFile();
		f.path = p;
		f.basename = p.split("/").pop() ?? p;
		return f;
	});

	const folder = new TFolder();
	folder.path = folderPath;
	folder.children = children;

	const entries = (opts.referenced ?? []).map((poster) => ({ poster, type: "film", tmdbId: 1 }));

	const plugin = {
		app: {
			vault: {
				// Resolves both the folder and the files inside it. Returning only
			// the folder made cache() unable to see an existing poster, which
			// is the exact behaviour one of these tests checks.
			getAbstractFileByPath: (path: string) => {
				if (!opts.noFolder && path === folderPath) return folder;
				return children.find((c) => c.path === path) ?? null;
			},
				createBinary: async () => undefined,
				createFolder: async () => undefined,
			},
			fileManager: {
				trashFile: async (file: TFile) => {
					if (opts.trashFails?.includes(file.path)) throw new Error("locked");
					trashed.push(file.path);
				},
			},
		},
		settings: {
			posterFolder: folderPath,
			downloadPosters: opts.downloadPosters ?? true,
		},
		library: { all: () => entries },
		tmdb: {
			posterUrl: (p: string) => `https://image.tmdb.org/${p}`,
			fetchImage: async () => new ArrayBuffer(8),
		},
	};

	return { store: new PosterStore(plugin as never), trashed: () => trashed };
}

/* ---- filenames ---- */

{
	const { store } = makeStore();
	eq(store.fileName(603, "film"), "603.jpg", "a film poster is named by id alone");
	eq(store.fileName(1396, "tv"), "tv-1396.jpg", "a series poster carries the tv prefix");
	eq(store.vaultPath(603, "film"), "Movies/_posters/603.jpg", "and lands in the configured folder");
}

/* ---- which files are candidates for deletion ---- */

{
	const { store } = makeStore({
		files: ["Movies/_posters/603.jpg", "Movies/_posters/1396.jpg"],
		referenced: ["Movies/_posters/603.jpg"],
	});
	const orphans = store.findOrphans().map((f) => f.path);
	eq(orphans, ["Movies/_posters/1396.jpg"], "only the unreferenced poster is a candidate");
}

{
	// The guard that matters. An index reads empty while it is building and
	// after a failed build; treating that as "nothing is referenced" would
	// select every poster in the vault for deletion.
	const { store } = makeStore({
		files: ["Movies/_posters/603.jpg", "Movies/_posters/1396.jpg"],
		referenced: [],
	});
	eq(store.findOrphans().length, 0, "an empty library selects nothing, however many files exist");
}

{
	// The second near-disaster. The poster folder is a user-editable setting;
	// pointed at a folder holding their own files, a rule of "delete whatever
	// is unreferenced" would take those too.
	const { store } = makeStore({
		posterFolder: "Attachments",
		files: ["Attachments/603.jpg", "Attachments/holiday.jpg", "Attachments/tax-return.pdf"],
		referenced: ["Attachments/999.jpg"],
	});
	const orphans = store.findOrphans().map((f) => f.path);
	eq(orphans, ["Attachments/603.jpg"], "files Reel did not write are never candidates");
}

{
	const { store } = makeStore({ noFolder: true, referenced: ["x.jpg"] });
	eq(store.findOrphans().length, 0, "no poster folder yet means nothing to remove");
}

{
	const { store } = makeStore({ files: [], referenced: ["Movies/_posters/603.jpg"] });
	eq(store.findOrphans().length, 0, "an empty folder yields no candidates");
}

/* ---- concurrency flag ---- */

{
	const { store } = makeStore();
	ok(!store.busy, "a store that is not backfilling reports itself free");
}

async function main(): Promise<void> {
	/* ---- removal trashes exactly what it is handed ---- */

	{
		const s = makeStore({
			files: ["Movies/_posters/603.jpg", "Movies/_posters/1396.jpg"],
			referenced: ["Movies/_posters/603.jpg"],
		});
		const orphans = s.store.findOrphans();
		const removed = await s.store.removeOrphans(orphans);
		eq(removed, 1, "one poster removed");
		eq(s.trashed(), ["Movies/_posters/1396.jpg"], "and it is the one that was unreferenced");
	}

	{
		const s = makeStore({ files: ["Movies/_posters/603.jpg"], referenced: ["Movies/_posters/603.jpg"] });
		const removed = await s.store.removeOrphans(s.store.findOrphans());
		eq(removed, 0, "nothing orphaned, nothing removed");
		eq(s.trashed(), [], "and nothing was touched");
	}

	{
		// One locked file must not abandon the rest, and must not be counted
		// as removed when it was not.
		const s = makeStore({
			files: ["Movies/_posters/1.jpg", "Movies/_posters/2.jpg", "Movies/_posters/3.jpg"],
			referenced: ["Movies/_posters/999.jpg"],
			trashFails: ["Movies/_posters/2.jpg"],
		});
		const removed = await s.store.removeOrphans(s.store.findOrphans());
		eq(removed, 2, "the count reflects what actually went to the trash");
		eq(s.trashed(), ["Movies/_posters/1.jpg", "Movies/_posters/3.jpg"], "and the rest still went");
	}

	{
		// removeOrphans trusts its argument, so passing nothing must do nothing
		// rather than falling back to "everything".
		const s = makeStore({ files: ["Movies/_posters/603.jpg"], referenced: [] });
		eq(await s.store.removeOrphans([]), 0, "an empty list removes nothing");
		eq(s.trashed(), [], "and reaches no files");
	}

	/* ---- caching ---- */

	{
		const { store } = makeStore({ downloadPosters: false });
		eq(await store.cache(603, "film", "/abc.jpg"), null, "caching off means no poster is written");
	}

	{
		const { store } = makeStore();
		eq(await store.cache(603, "film", null), null, "a title with no poster yields nothing");
		eq(await store.cache(603, "film", undefined), null, "and neither does a missing one");
	}

	{
		// The file is already there, so this must return the path without
		// spending a request — the whole point of caching to the vault.
		const { store } = makeStore({ files: ["Movies/_posters/603.jpg"] });
		let fetched = 0;
		const s = store as unknown as { plugin: { tmdb: { fetchImage: () => Promise<ArrayBuffer> } } };
		s.plugin.tmdb.fetchImage = async () => {
			fetched++;
			return new ArrayBuffer(8);
		};
		const got = await store.cache(603, "film", "/abc.jpg");
		eq(got, "Movies/_posters/603.jpg", "an existing poster is reported as already cached");
		eq(fetched, 0, "and no image was downloaded");
	}
}

void main().then(() => {
	console.log(`\n${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
});
