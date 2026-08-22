/**
 * Whether Reel will ever find your daily note.
 *
 * The linking itself is deliberate and, I think, right: Reel appends to
 * today's daily note if there is one, never creates it, and finds it from its
 * own folder setting rather than by reaching into the core Daily Notes
 * plugin's undocumented configuration. Those are all defensible choices and
 * this module does not revisit any of them.
 *
 * What it fixes is narrower. Every one of those choices depends on a folder
 * path you typed into a box, and nothing anywhere checks that path against
 * where your daily notes actually are. Point it at "Journal" when yours live
 * in "Daily" and the toggle stays on, no error is raised, and the feature
 * simply never does anything — because "no daily note today" and "you told me
 * the wrong folder" are the same silence.
 *
 * They are not the same situation, though, and the vault knows the difference.
 * A folder either holds notes named `YYYY-MM-DD.md` or it does not, and that
 * is answerable now, on the settings screen, without a single request.
 *
 * Pure, taking the vault's file list as an argument, like the folder module it
 * sits beside.
 */

/** The only filename shape Reel looks for. Anything else it cannot find. */
const ISO_NOTE = /^(\d{4}-\d{2}-\d{2})\.md$/;

/**
 * The date in a daily-note filename, or null.
 *
 * Deliberately strict, and matching what `dailyNotePath` actually builds. A
 * looser match here would report notes Reel then fails to open, which is worse
 * than reporting none: it would turn a silence into a confident wrong answer.
 */
export function isoDateOf(path: string): string | null {
	const name = path.slice(path.lastIndexOf("/") + 1);
	const m = ISO_NOTE.exec(name);
	if (!m) return null;
	// Rejects 2026-13-45.md, which matches the shape and is not a date.
	const [y, mo, d] = m[1].split("-").map(Number);
	if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
	return m[1];
}

export interface FolderTally {
	count: number;
	/** The most recent dated note in this folder. */
	latest: string;
}

/** Which folders hold dated notes, and how many. Root is the empty string. */
export function scanDaily(paths: string[]): Map<string, FolderTally> {
	const out = new Map<string, FolderTally>();
	for (const path of paths) {
		const date = isoDateOf(path);
		if (!date) continue;
		const cut = path.lastIndexOf("/");
		const folder = cut === -1 ? "" : path.slice(0, cut);
		const prev = out.get(folder);
		if (!prev) out.set(folder, { count: 1, latest: date });
		else out.set(folder, { count: prev.count + 1, latest: date > prev.latest ? date : prev.latest });
	}
	return out;
}

export interface DailySaid {
	text: string;
	tone: "ok" | "warn" | "info";
}

/**
 * What the configured folder currently looks like.
 *
 * `today` is passed in rather than read, for the same reason every date in
 * this codebase is: a function that reads the clock is a function that passes
 * all year and fails on one particular day.
 *
 * Note what is *not* a warning. Having no note for today is the ordinary state
 * of a morning, and Reel is designed to do nothing in it. The warning is
 * reserved for the case that is actually broken: a folder with no dated notes
 * in it at all, where nothing will ever be found on any day.
 */
export function dailyStatus(folder: string, scan: Map<string, FolderTally>, today: string): DailySaid {
	const clean = folder.replace(/^\/+|\/+$/g, "");
	const tally = scan.get(clean);
	const where = clean || "your vault root";

	if (!tally) {
		return scan.size
			? { text: `No notes named YYYY-MM-DD in ${where} — Reel will never find one`, tone: "warn" }
			: { text: "No dated notes anywhere in this vault yet", tone: "info" };
	}

	const noun = `${tally.count} dated note${tally.count === 1 ? "" : "s"}`;
	if (tally.latest === today) return { text: `${noun} in ${where}, including today's`, tone: "ok" };
	// Found the right place; today's simply has not been written yet.
	return { text: `${noun} in ${where}, most recent ${tally.latest}`, tone: "ok" };
}

/**
 * Folders that actually hold dated notes, busiest first.
 *
 * This is the part that turns "your setting is wrong" into something you can
 * act on without going to look. Most vaults have exactly one such folder, so
 * the answer is usually a single tap.
 */
export function suggestDailyFolders(scan: Map<string, FolderTally>, limit = 4): string[] {
	return [...scan.entries()]
		.sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
		.map(([folder]) => folder)
		.slice(0, limit);
}

/**
 * The line Reel would append, as it would actually appear.
 *
 * The prefix setting is free text whose effect is invisible until the next
 * time you happen to add a film and then go and look at a different note. A
 * preview costs nothing and answers "what will this do" at the moment the
 * question is asked.
 */
export function previewLine(prefix: string, example = "Heat (1995)"): string {
	return `${prefix.trim() || "- Watched"} [[${example}]]`;
}
