/**
 * Pane-width classes.
 *
 * The stylesheet used to decide its layout from `@media (min-width: …)`, which
 * asks the *window*. Reel lives in a pane, and a pane is not a window: it is
 * narrow in a desktop sidebar and wide on a tablet in landscape. The two
 * disagreed, and the layout followed the wrong one.
 *
 * This is the single place that turns a measured width into classes, so the
 * plugin and the verification harness can never drift apart on it.
 */

/** Breakpoints the stylesheet keys off, as `is-w520`, `is-w800`, and so on. */
export const WIDTH_STEPS = [400, 500, 520, 620, 700, 760, 800, 900] as const;

/** Below this the filter stack wraps onto four rows and buries the content. */
export const NARROW_AT = 600;

/**
 * Stamp `is-narrow` / `is-wide` / `is-wNNN` onto an element from its width.
 *
 * A width of 0 means *not measured* — the leaf is detached, hidden behind
 * another tab, or not yet laid out. That resolves to narrow, deliberately.
 * The old code returned early instead, which left the desktop layout in place:
 * three-column grids and a six-row filter stack rendered into a phone, with no
 * later resize to correct it because a hidden leaf never resizes.
 *
 * Compact is merely tight on a wide screen. Wide is unusable on a narrow one.
 * When we do not know, we take the one that cannot break.
 */
export function stampWidth(el: HTMLElement, width: number): void {
	const w = Number.isFinite(width) && width > 0 ? width : 0;
	const narrow = w > 0 ? w < NARROW_AT : true;
	el.toggleClass("is-narrow", narrow);
	el.toggleClass("is-wide", !narrow);
	for (const step of WIDTH_STEPS) el.toggleClass(`is-w${step}`, w >= step);
}

/**
 * The element's own width, preferring layout over guesswork.
 *
 * `clientWidth` is the honest answer on screen; `getBoundingClientRect` still
 * knows in some detached cases. Zero means neither did, and the caller treats
 * that as narrow.
 */
export function measure(el: HTMLElement): number {
	const w = el.clientWidth || Math.round(el.getBoundingClientRect().width);
	return Number.isFinite(w) && w > 0 ? w : 0;
}
