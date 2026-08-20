/**
 * What changed, in the user's words rather than the commit's.
 *
 * Reel updates through BRAT, which replaces `main.js` and says nothing. Every
 * release in this file was reported by the person using it — a covered search
 * box, a doubled star, a review with nowhere to go — and each fix arrived
 * silently, so the only way to know whether the thing you reported was done was
 * to go and look for it.
 *
 * Two rules for what goes in here:
 *
 *   It is written for the person who noticed, not for the person who fixed it.
 *   "The magnifier no longer prints over what you type" is checkable in three
 *   seconds. "Unpinned .reel-search-icon from absolute positioning" is not.
 *
 *   Nothing goes in that cannot be seen. A release that only changed the test
 *   rig gets no entry, because an entry that cannot be verified teaches you to
 *   stop reading them.
 *
 * The newest version here must match `manifest.json`; `scripts/preflight.mjs`
 * refuses to publish otherwise. A release with no notes is how a changelog
 * quietly stops being true.
 */

/**
 * Why an item is worth reading.
 *
 * Not a severity. "Fixed" is not lesser than "New" — on this plugin most of
 * what has mattered has been a fix — it is a different question the reader is
 * asking: is this something I can now do, something that got better, or
 * something that had been wrong?
 */
export type ChangeKind = "new" | "better" | "fixed";

export interface Change {
	kind: ChangeKind;
	/** One line, present tense, describing the screen and not the code. */
	text: string;
	/** Optional second line: what it was doing before, if that is the point. */
	note?: string;
}

export interface Release {
	version: string;
	/** ISO date, so it can be formatted in the reader's own locale. */
	date: string;
	/** One sentence. Shown large, and used as the update notice. */
	headline: string;
	changes: Change[];
}

/** Newest first. The order here is the order on screen. */
export const RELEASES: Release[] = [
	{
		version: "0.8.11",
		date: "2026-08-20",
		headline: "On Stats, colour goes back to meaning one thing.",
		changes: [
			{
				kind: "better",
				text: "An open section's header is no longer tinted, so the bars are the only coloured thing on the page.",
				note: "A bar is longer because there is more of it. The header was using the same colour to say something else, and expanded sections read as one block of tint with the bars lost inside it.",
			},
			{
				kind: "better",
				text: "A section's heading leads it, and its first row no longer butts against it.",
			},
		],
	},
	{
		version: "0.8.10",
		date: "2026-08-20",
		headline: "Reel behaves like a phone app: taps respond instantly, sheets have a grabber, and nothing scrolls the page behind it.",
		changes: [
			{
				kind: "better",
				text: "Taps register immediately instead of pausing first.",
				note: "A browser holds every tap for a third of a second in case a second one means “zoom”. That delay is most of why a phone web page feels slower than an app.",
			},
			{
				kind: "better",
				text: "Buttons and posters respond the moment your finger lands.",
				note: "The grey flash was suppressed in fifteen places and nothing put in its place, so a tap that worked looked like a tap that missed.",
			},
			{
				kind: "better",
				text: "Bottom sheets have a grabber, and dragging past the end of one no longer scrolls the library behind it.",
			},
			{
				kind: "fixed",
				text: "Holding a button no longer selects its label and raises the copy bar over it.",
			},
			{
				kind: "better",
				text: "Stats tiles are tighter, and the arrow that means “this opens” sits against the right edge rather than floating in a corner.",
			},
		],
	},
	{
		version: "0.8.9",
		date: "2026-08-20",
		headline: "Sheets fit the screen they are on, so the passphrase box is where you can see it.",
		changes: [
			{
				kind: "fixed",
				text: "The passphrase prompt stays on screen with the keyboard up.",
				note: "A sheet was allowed to be 88% of the whole screen while half of it was showing, so it overflowed off the top and took the field with it.",
			},
			{
				kind: "better",
				text: "A sheet's buttons ride its bottom edge while the rest scrolls, instead of sitting at the end of the content.",
				note: "With the keyboard up, the log sheet's Save button was 240 pixels below the fold on a sheet that cannot be scrolled clear.",
			},
			{
				kind: "better",
				text: "Reel is now checked with the keyboard open, not only at rest.",
				note: "Four separate “I can't see it, the keyboard is over it” faults had shipped, and none of them could fail a test.",
			},
		],
	},
	{
		version: "0.8.8",
		date: "2026-08-20",
		headline: "Reel tells you what it changed, and Stats reads like a page rather than a pile of numbers.",
		changes: [
			{
				kind: "new",
				text: "This screen. After an update, Reel shows what changed since the version you were on.",
				note: "Reel updates through BRAT, which swaps the file out silently. Everything fixed here was something you reported, and there was no way to tell it had landed.",
			},
			{
				kind: "new",
				text: "“What's new in Reel” is a command, so you can reread any release rather than only catching it once.",
			},
			{
				kind: "better",
				text: "Stats headline numbers sit on their own cards with the unit beside them, instead of running together as one block of digits.",
			},
			{
				kind: "better",
				text: "Every chart row now shows its share as a bar you can compare at a glance, with the count kept in line down the right.",
			},
			{
				kind: "better",
				text: "The collapsed sections say what is inside them before you open them.",
			},
		],
	},
	{
		version: "0.8.7",
		date: "2026-08-20",
		headline: "The search box stops fighting Obsidian's floating + button.",
		changes: [
			{
				kind: "fixed",
				text: "The + button no longer sits on top of the search field.",
				note: "Reel was looking for a full-width toolbar and a round corner button never matched, so it measured nothing to avoid.",
			},
			{
				kind: "fixed",
				text: "The magnifier no longer prints over the first characters you type.",
			},
			{
				kind: "fixed",
				text: "One search box, with one border, instead of a box drawn inside a box.",
			},
			{
				kind: "fixed",
				text: "Search results fill the screen instead of showing one clipped row above a large empty space.",
				note: "Opening the keyboard shrank the screen mid-draw and Reel kept the small measurement it took at that moment.",
			},
		],
	},
	{
		version: "0.8.6",
		date: "2026-08-20",
		headline: "The search field docks above the keyboard and stays there.",
		changes: [
			{
				kind: "better",
				text: "While searching, the field sits just above the keyboard, the way Obsidian's own search does.",
			},
			{
				kind: "fixed",
				text: "The field no longer stretches past the edge of the screen with its left end cut off.",
			},
			{ kind: "fixed", text: "It stops springing open from a squash every time it is drawn." },
		],
	},
	{
		version: "0.8.5",
		date: "2026-08-19",
		headline: "Undo puts the poster back, and the sheet you use most stops being a grey box.",
		changes: [
			{
				kind: "fixed",
				text: "Undoing a rating returns the title to Discover instead of leaving a gap where it was.",
			},
			{
				kind: "better",
				text: "The “seen it” sheet shows the poster, the year and what your rating means in words.",
			},
		],
	},
	{
		version: "0.8.4",
		date: "2026-08-19",
		headline: "Stats gets colour drawn from your own posters.",
		changes: [
			{ kind: "better", text: "Cards and charts tint towards the artwork of what you have been watching." },
			{ kind: "new", text: "A year-at-a-glance heatmap. Tap any day to see what you watched." },
		],
	},
	{
		version: "0.8.3",
		date: "2026-08-19",
		headline: "The doubled star, the review you could not see, and typing at the bottom of the screen.",
		changes: [
			{
				kind: "fixed",
				text: "Stars are one star each. Half ratings fill by clipping rather than by shrinking the glyph.",
				note: "The filled star was drawn beside the empty one rather than over it, everywhere stars appear.",
			},
			{
				kind: "fixed",
				text: "The review box sits above the rating controls, so the keyboard cannot cover what you are writing.",
			},
		],
	},
	{
		version: "0.8.2",
		date: "2026-08-18",
		headline: "One row of controls, three ways to see a library, and the review where you look for it.",
		changes: [
			{ kind: "new", text: "Posters, Dense and List layouts, remembered between sessions." },
			{ kind: "better", text: "Filters, sort and search share a single row instead of stacking three deep." },
			{ kind: "new", text: "Your review appears on the detail screen, and can be edited from there." },
		],
	},
	{
		version: "0.8.1",
		date: "2026-08-18",
		headline: "The artwork band goes on every tab, and the diary stops reading four hundred notes.",
		changes: [
			{ kind: "better", text: "Every tab opens on artwork from your library rather than on a bare list." },
			{ kind: "fixed", text: "The diary reads notes as you scroll to them, so the first screen appears at once." },
		],
	},
	{
		version: "0.8.0",
		date: "2026-08-17",
		headline: "A feed that does not end, a search that means the same thing everywhere, and your own reviews.",
		changes: [
			{
				kind: "new",
				text: "Discover keeps going. Rows extend as you reach them and new ones load underneath, with a reroll for a different set.",
			},
			{ kind: "new", text: "The same search works on every tab, and can be filtered like the library." },
			{ kind: "new", text: "Reviews are read out of your notes and shown wherever the title is." },
		],
	},
];

/** `1` if `a` is newer than `b`, `-1` if older, `0` if the same. */
export function compareVersions(a: string, b: string): number {
	const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
	const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d) return d > 0 ? 1 : -1;
	}
	return 0;
}

/**
 * Everything released after the version last seen.
 *
 * An empty `since` means this install has never recorded one. That is either a
 * first run or an upgrade from before this screen existed, and in both cases
 * the whole file would be a wall of text about releases the reader may never
 * have run. Only the newest is shown.
 */
export function releasesSince(since: string, all: Release[] = RELEASES): Release[] {
	if (!since) return all.slice(0, 1);
	return all.filter((r) => compareVersions(r.version, since) > 0);
}

/** The newest release described here, which must be the one being shipped. */
export function latestRelease(all: Release[] = RELEASES): Release | null {
	return all[0] ?? null;
}
