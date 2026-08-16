/**
 * Loading placeholders.
 *
 * Before this, every screen that waited on TMDB showed a single line of grey
 * text — "Finding things for you…" — and then, some seconds later, the whole
 * thing at once. Two problems with that. The wait looks identical to a hang,
 * because nothing about the line changes. And the arrival is a jolt: the
 * layout goes from one line tall to a full page in a single frame.
 *
 * A skeleton fixes both by being the right *shape* before it is the right
 * content. The page is already the height it will be, so nothing jumps, and
 * the moving sheen distinguishes "still coming" from "this is all there is".
 *
 * Deliberately not a spinner. A spinner says something is happening; a
 * skeleton says what is about to be there.
 */

/** One row of poster-shaped placeholders, matching the Discover card strip. */
export function skeletonCards(parent: HTMLElement, count = 6, label = "Loading"): HTMLElement {
	const strip = parent.createDiv({ cls: "reel-skel-strip", attr: { role: "status", "aria-label": label } });
	for (let i = 0; i < count; i++) {
		const card = strip.createDiv({ cls: "reel-skel-card" });
		card.createDiv({ cls: "reel-skel reel-skel-poster" });
		card.createDiv({ cls: "reel-skel reel-skel-line" });
		// Two lines, the second shorter — a title wraps, a year does not, and
		// two identical bars read as a table rather than as a card.
		card.createDiv({ cls: "reel-skel reel-skel-line is-short" });
	}
	return strip;
}

/** A grid of poster-shaped placeholders, matching the library grid. */
export function skeletonGrid(parent: HTMLElement, count = 12, label = "Loading"): HTMLElement {
	const grid = parent.createDiv({ cls: "reel-skel-grid", attr: { role: "status", "aria-label": label } });
	for (let i = 0; i < count; i++) grid.createDiv({ cls: "reel-skel reel-skel-poster" });
	return grid;
}

/** Stacked row placeholders, for lists rather than posters. */
export function skeletonRows(parent: HTMLElement, count = 5, label = "Loading"): HTMLElement {
	const list = parent.createDiv({ cls: "reel-skel-rows", attr: { role: "status", "aria-label": label } });
	for (let i = 0; i < count; i++) {
		const row = list.createDiv({ cls: "reel-skel-row" });
		row.createDiv({ cls: "reel-skel reel-skel-thumb" });
		const body = row.createDiv({ cls: "reel-skel-body" });
		body.createDiv({ cls: "reel-skel reel-skel-line" });
		body.createDiv({ cls: "reel-skel reel-skel-line is-short" });
	}
	return list;
}

/**
 * A named section with skeleton cards under it.
 *
 * Discover's rows have headings that are known before the results are — "More
 * from Christopher Nolan" does not depend on what comes back. Showing the
 * heading immediately means the wait explains itself.
 */
export function skeletonSection(parent: HTMLElement, heading: string, count = 6): HTMLElement {
	const section = parent.createDiv({ cls: "reel-skel-section" });
	section.createDiv({ cls: "reel-block-title", text: heading });
	skeletonCards(section, count, heading);
	return section;
}
