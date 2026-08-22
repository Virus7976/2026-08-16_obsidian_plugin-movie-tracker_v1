/**
 * Where Reel is allowed to write, and whether it exists.
 *
 * Four settings on this screen are vault paths typed by hand into a plain text
 * box with nothing checking them. Type "Films" when your folder is called
 * "Movies" and everything continues to work perfectly: the setting saves, the
 * screen looks right, and Reel starts writing notes into a folder that is not
 * the one you are looking at. There is no error, because there is nothing
 * wrong — a path that does not exist yet is exactly how you legitimately point
 * Reel at a folder you want it to create.
 *
 * Which is the whole problem. "I meant a folder that exists and mistyped it"
 * and "I mean a folder that does not exist yet" produce identical input, so
 * the field cannot tell them apart and must not guess. What it can do is say
 * which one it is looking at, and offer the folders you already have.
 *
 * All of this is pure and takes the vault's contents as an argument, so it can
 * be tested without a vault and so the settings screen is not the only place
 * that could ever ask these questions.
 */

/** Characters Obsidian will not accept in a path. `/` is the separator. */
const ILLEGAL = /[*"\\<>:|?]/;

/**
 * Trim the slashes people type out of habit and collapse the doubles.
 *
 * `/Movies/` and `Movies//` and `Movies` are the same folder, and storing
 * three spellings of one answer means every consumer has to re-normalise or
 * quietly disagree about whether the setting changed.
 */
export function normaliseFolder(raw: string): string {
	return raw
		.trim()
		.replace(/\\/g, "/")
		.split("/")
		.map((seg) => seg.trim())
		.filter(Boolean)
		.join("/");
}

export type FolderState =
	/** Empty. Means the vault root, which is legal and rarely intended. */
	| { kind: "root" }
	| { kind: "exists"; path: string }
	/** Legal, absent, and will be made on first write. */
	| { kind: "new"; path: string }
	/** A note already occupies that exact path. */
	| { kind: "collides"; path: string }
	| { kind: "invalid"; path: string; reason: string };

/**
 * What this path currently is.
 *
 * `folders` and `files` are the vault's own sets, passed in rather than looked
 * up, because the interesting cases are all about disagreement between what
 * you typed and what is actually there.
 */
export function folderState(raw: string, folders: Set<string>, files: Set<string>): FolderState {
	const path = normaliseFolder(raw);
	if (!path) return { kind: "root" };

	if (ILLEGAL.test(path)) {
		return { kind: "invalid", path, reason: 'A folder name cannot contain * " \\ < > : | or ?' };
	}
	/*
	 * Obsidian's own configuration lives in a dotted folder, and pointing a
	 * plugin's write path inside it is a way to lose your settings that gives
	 * no warning at the time.
	 */
	if (path.split("/").some((seg) => seg.startsWith("."))) {
		return { kind: "invalid", path, reason: "Folders starting with a dot are hidden and reserved by Obsidian" };
	}

	if (folders.has(path)) return { kind: "exists", path };
	// A note at exactly this path is not a folder you can write into, and the
	// failure lands later, at the moment of the first save, well away from here.
	if (files.has(path) || files.has(`${path}.md`)) return { kind: "collides", path };
	return { kind: "new", path };
}

/**
 * One line for the person, in the voice of the thing that is true.
 *
 * `fallback` is what an empty field actually resolves to, if anything does.
 * Reel's four folder settings each revert to their default when cleared rather
 * than meaning the vault root, so telling somebody an empty box will scatter
 * notes across their root warns about something that cannot happen — which is
 * worse than not warning at all, because it is the kind of warning people
 * learn to ignore, and then ignore the real one beside it.
 */
export function describeFolder(
	state: FolderState,
	fallback?: string
): { text: string; tone: "ok" | "warn" | "info" } {
	switch (state.kind) {
		case "root":
			return fallback
				? { text: `Empty \u2014 Reel will use \u201c${fallback}\u201d`, tone: "info" }
				: { text: "Empty \u2014 Reel will write to your vault root", tone: "warn" };
		case "exists":
			return { text: "Folder exists", tone: "ok" };
		case "new":
			return { text: "Does not exist yet \u2014 Reel will create it", tone: "info" };
		case "collides":
			return { text: "A note already has this exact name", tone: "warn" };
		case "invalid":
			return { text: state.reason, tone: "warn" };
	}
}

/**
 * The folders worth offering for what has been typed so far.
 *
 * Ranked rather than merely filtered, and the ranking is the point. Typing
 * "mov" in a vault with `Movies` and `Archive/Old Movies` should put `Movies`
 * first; a plain `includes()` filter returns them in whatever order the vault
 * enumerated, which on a large vault is effectively random.
 *
 * Four tiers: the path starts with what you typed, the last segment starts
 * with it, any segment starts with it, and finally anything containing it.
 * Shorter paths win ties, because a shallower folder is more likely to be the
 * one you meant and is cheaper to read.
 */
export function matchFolders(all: string[], query: string, limit = 6): string[] {
	const q = normaliseFolder(query).toLowerCase();
	if (!q) {
		return [...all].sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, limit);
	}

	const hits = rankAgainst(all, q, limit);
	if (hits.length) return hits;

	/*
	 * Nothing matched the whole path, so try just the last part of it.
	 *
	 * Every rule above assumes what you typed is a prefix of what you want.
	 * Reel's own default people folder is `Movies/People`, which is *longer*
	 * than every folder in a vault that has a `People` at the root — so the
	 * one suggestion a person actually wants scored 99 and the field offered
	 * nothing at all, on the exact default it ships with.
	 *
	 * Only as a fallback. While the full path still matches something, that
	 * is the better answer and should not be diluted by loose matches on its
	 * last segment.
	 */
	const tail = q.split("/").pop() ?? "";
	return tail && tail !== q ? rankAgainst(all, tail, limit) : [];
}

/** The ranking itself, so the fallback can reuse it rather than restate it. */
function rankAgainst(all: string[], q: string, limit: number): string[] {
	const rank = (path: string): number => {
		const p = path.toLowerCase();
		if (p === q) return 0;
		if (p.startsWith(q)) return 1;
		const segs = p.split("/");
		if ((segs[segs.length - 1] ?? "").startsWith(q)) return 2;
		if (segs.some((s) => s.startsWith(q))) return 3;
		if (p.includes(q)) return 4;
		return 99;
	};

	return all
		.map((path) => ({ path, r: rank(path) }))
		.filter((x) => x.r < 99)
		.sort((a, b) => a.r - b.r || a.path.length - b.path.length || a.path.localeCompare(b.path))
		.map((x) => x.path)
		.slice(0, limit);
}
