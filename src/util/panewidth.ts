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

/** Obsidian's own chrome, in the order it is worth asking about. */
const TOP_CHROME = ".view-header";
const BOTTOM_CHROME = ".mobile-toolbar, .mobile-navbar, .status-bar";

/**
 * How far Obsidian's chrome reaches over the top and bottom of a view.
 *
 * On a phone Obsidian draws its header and its toolbar *over* the content
 * rather than beside it. Reel has been bitten at both ends: the toolbar covered
 * the tab bar, and the header covered the search field — visible, correctly
 * sized, and completely untappable.
 *
 * The previous fix for the bottom was a hardcoded 72px, which the comment
 * itself admitted was a guess at the user's settings and their phone's gesture
 * bar. Measuring costs the same and cannot be wrong.
 *
 * Clamped to 160px: a mid-transition reading must not push the whole screen
 * down. Negative means the chrome sits properly above or below, which needs no
 * compensation at all.
 */
export function stampChromeInsets(el: HTMLElement, root: ParentNode = document): void {
	const rect = el.getBoundingClientRect();
	const clamp = (n: number): number => Math.round(Math.min(Math.max(n, 0), 160));

	const header = root.querySelector<HTMLElement>(TOP_CHROME);
	const top = header ? clamp(header.getBoundingClientRect().bottom - rect.top) : 0;

	const bar = root.querySelector<HTMLElement>(BOTTOM_CHROME);
	const bottom = bar ? clamp(rect.bottom - bar.getBoundingClientRect().top) : 0;

	const vars = { "--reel-top-inset": `${top}px`, "--reel-bottom-inset": `${bottom}px` };
	el.setCssProps(vars);
	// Mirrored onto <body> so sheets get them too. A modal is not inside the
	// view, and its action row is pinned to the bottom — which is exactly where
	// the floating toolbar is. A "Save" button you cannot reach is worse than a
	// covered poster, because there is no way to scroll it clear.
	if (el !== document.body) document.body.setCssProps(vars);
}

/** The measured top overlap, for the diagnostics dump. */
export function topInset(el: HTMLElement): number {
	return parseInt(el.style.getPropertyValue("--reel-top-inset") || "0", 10) || 0;
}
