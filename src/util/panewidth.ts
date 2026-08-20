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
 * The chrome element that is actually on screen.
 *
 * `querySelector` returns the *first* match in document order, and Obsidian
 * keeps a `.view-header` in every workspace leaf — including the ones that are
 * closed, collapsed or in a hidden drawer. On a real phone the first match
 * measured 0×0 while the header genuinely covering the view was 384×45 at
 * y=33. The inset therefore computed as zero, the compensation never applied,
 * and the search field stayed buried exactly as before.
 *
 * A device snapshot showed both elements side by side, which is the only reason
 * this was findable at all: the harness has one leaf and one header, so the
 * first match is always the right one there.
 *
 * Picking the tallest visible match is the fix. A zero-height header is not
 * covering anything, and where several are real the one reaching furthest down
 * is the one to clear.
 */
/**
 * Whatever is floating over the bottom of the screen, whatever it is called.
 *
 * The named selectors above are guesses at class names, and on a real device
 * both missed: the snapshot reported `.mobile-toolbar: absent` and
 * `.mobile-navbar: absent` while a navigation bar was plainly sitting on top of
 * the last row of posters. The body carried `is-floating-nav`, so Obsidian was
 * drawing something under a name this code does not know.
 *
 * Guessing harder is the wrong answer — the next Obsidian release renames it
 * again. Ask the layout instead: a fixed or sticky element, anchored in the
 * bottom quarter of the screen, wide enough to matter, and not ours. That
 * describes a floating toolbar regardless of what anyone calls it.
 */
function findFloatingBottomBar(view: DOMRect): HTMLElement | null {
	const floor = window.innerHeight * 0.75;
	let highest: HTMLElement | null = null;
	for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
		// Reel's own sheets and anything inside the view are not chrome.
		if (el.closest(".reel-view, .reel-modal, .modal-container")) continue;
		const cs = getComputedStyle(el);
		if (cs.position !== "fixed" && cs.position !== "sticky") continue;
		if (cs.visibility === "hidden" || cs.display === "none") continue;
		const r = el.getBoundingClientRect();
		// Anchored low, meaningfully sized, and actually over the view.
		if (r.height < 24 || r.width < view.width * 0.4) continue;
		if (r.top < floor || r.top > window.innerHeight - 8) continue;
		if (r.right < view.left || r.left > view.right) continue;
		if (!highest || r.top < highest.getBoundingClientRect().top) highest = el;
	}
	return highest;
}

/**
 * Obsidian's floating **+**, and anything else shaped like it.
 *
 * `findFloatingBottomBar` was written for a toolbar and requires 40% of the
 * view's width, so it has never once seen the round + button that Obsidian
 * parks in the bottom corner — a 56px control is nowhere near that threshold.
 * `--reel-bottom-inset` therefore computed as 0 on the phone and the docked
 * search field was placed directly underneath it.
 *
 * A corner button is not a bar and must not be treated as one. Clearing a bar
 * means giving up a whole row of the screen; clearing a button means giving up
 * the corner it sits in. So this reports a *horizontal* inset, and the pill
 * shortens rather than moving up.
 *
 * Same reasoning as the bar: describe the shape, do not guess the class name.
 * Small, fixed, low, and hard against one side.
 */
function findFloatingCorner(view: DOMRect): HTMLElement | null {
	const floor = window.innerHeight * 0.6;
	let best: HTMLElement | null = null;
	for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
		if (el.closest(".reel-view, .reel-modal, .modal-container")) continue;
		const cs = getComputedStyle(el);
		if (cs.position !== "fixed" && cs.position !== "sticky") continue;
		if (cs.visibility === "hidden" || cs.display === "none") continue;
		const r = el.getBoundingClientRect();
		// Button-shaped: big enough to tap, small enough not to be a bar.
		if (r.width < 28 || r.height < 28) continue;
		if (r.width > 120 || r.width > view.width * 0.4) continue;
		// Low on the screen, and hard against the left or right edge.
		if (r.bottom < floor) continue;
		const nearRight = view.right - r.right < 40;
		const nearLeft = r.left - view.left < 40;
		if (!nearRight && !nearLeft) continue;
		// The one reaching furthest into the view is the one to clear.
		if (!best || r.width > best.getBoundingClientRect().width) best = el;
	}
	return best;
}

function pickChrome(root: ParentNode, selector: string): HTMLElement | null {
	let best: HTMLElement | null = null;
	let bestArea = 0;
	for (const el of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
		const r = el.getBoundingClientRect();
		const area = r.width * r.height;
		if (area <= 0) continue;
		if (area > bestArea) {
			best = el;
			bestArea = area;
		}
	}
	return best;
}

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

	const header = pickChrome(root, TOP_CHROME);
	const top = header ? clamp(header.getBoundingClientRect().bottom - rect.top) : 0;

	const bar = pickChrome(root, BOTTOM_CHROME) ?? findFloatingBottomBar(rect);
	const bottom = bar ? clamp(rect.bottom - bar.getBoundingClientRect().top) : 0;

	/*
	 * How far a corner button eats into the bottom of the view, sideways.
	 *
	 * Reported separately from `--reel-bottom-inset` because the answer is a
	 * different one. A bar spans the width and has to be cleared vertically; a
	 * button occupies a corner and only needs that corner left alone. Treating
	 * the + as a bar would cost a whole row of a screen that already has a
	 * keyboard on it.
	 */
	const fab = findFloatingCorner(rect);
	const right = fab ? clamp(rect.right - fab.getBoundingClientRect().left + 8) : 0;

	const vars = {
		"--reel-top-inset": `${top}px`,
		"--reel-bottom-inset": `${bottom}px`,
		"--reel-bottom-right-inset": `${right}px`,
	};
	el.setCssProps(vars);

	/*
	 * Applied inline, not through a stylesheet rule.
	 *
	 * `.reel-view { padding-top: var(--reel-top-inset) }` looked correct and did
	 * nothing on a real device, through three separate attempts. Obsidian loads
	 * **themes after plugins**, so a theme's `.view-content { padding: 12px }`
	 * beats a plugin's `.reel-view { padding: … }` — identical specificity, and
	 * the theme comes last. The device snapshot showed it plainly: 12px of
	 * padding on every side, including the top, where the rule sets none.
	 *
	 * Raising specificity would work until a theme raised its own. An inline
	 * style is beaten only by `!important`, and this is not a matter of taste —
	 * it is the difference between the navigation being reachable and not.
	 *
	 * Cleared to "" rather than "0px" when there is nothing to clear, so a theme
	 * that legitimately wants padding there still gets it.
	 */
	el.style.paddingTop = top > 0 ? `${top}px` : "";
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

/**
 * Keep sheets above the software keyboard.
 *
 * A sheet is pinned to the bottom of the *layout* viewport. A phone keyboard
 * does not shrink that viewport — it is drawn over it — so a bottom-anchored
 * sheet ends up behind the keyboard. The passphrase prompt did exactly that:
 * the field had focus, the keyboard was up, and the sheet itself was nowhere on
 * screen. Not being able to type a passphrase means not being able to unlock
 * the API keys, which means not being able to use the plugin at all.
 *
 * `visualViewport` is the one API that knows how much of the screen the
 * keyboard has taken. Where it is missing, the offset stays 0 and behaviour is
 * exactly as before.
 *
 * Returns a teardown, because a listener on `visualViewport` outlives any view
 * that forgets to remove it.
 */
export function keyboardInset(): () => void {
	const vv = window.visualViewport;
	if (!vv) return () => {};
	const sync = (): void => {
		// How much of the layout viewport is currently hidden below the fold.
		const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
		document.body.setCssProps({ "--reel-keyboard": `${Math.round(hidden)}px` });
	};
	vv.addEventListener("resize", sync);
	vv.addEventListener("scroll", sync);
	sync();
	return () => {
		vv.removeEventListener("resize", sync);
		vv.removeEventListener("scroll", sync);
		document.body.setCssProps({ "--reel-keyboard": "0px" });
	};
}

/**
 * How tall a bottom sheet is allowed to be, measured rather than expressed.
 *
 * The sheets were capped at `88dvh`, and whether that unit accounts for a
 * software keyboard depends on the WebView's `interactive-widget` behaviour —
 * which is to say, on the platform, the Obsidian version and the Android
 * release. When it does not, the cap is 88% of the *full* screen while the
 * visible area is barely half of it: the sheet is anchored at the bottom, so it
 * overflows off the top, and the field you were asked to type into is above the
 * first pixel of the screen. That is the passphrase prompt reported twice as
 * "there is nothing there".
 *
 * `window.innerHeight` is the layout viewport, which is the thing the sheet is
 * actually being drawn into, whatever the units claim. Stamped on `<body>`
 * because a sheet is not inside the view.
 *
 * Returns a teardown; a resize listener outlives the plugin otherwise.
 */
export function sheetFit(): () => void {
	const sync = (): void => {
		// 88% is the same proportion as before — this changes what it is 88% of,
		// not how much of the screen a sheet may take.
		const h = Math.round(window.innerHeight * 0.88);
		document.body.setCssProps({ "--reel-sheet-max": `${h}px` });
	};
	window.addEventListener("resize", sync);
	window.addEventListener("orientationchange", sync);
	const vv = window.visualViewport;
	vv?.addEventListener("resize", sync);
	sync();
	return () => {
		window.removeEventListener("resize", sync);
		window.removeEventListener("orientationchange", sync);
		vv?.removeEventListener("resize", sync);
		document.body.style.removeProperty("--reel-sheet-max");
	};
}

/**
 * Give a view's scrolling body an explicit height.
 *
 * `.reel-view-body` has `overflow-y: auto`, which makes it a scroll container,
 * and a scroll container's automatic minimum size is **zero**. Flex is
 * therefore always entitled to collapse it to nothing, and on a real device it
 * did: measured at 32px while holding a 5772px grid, which the user saw as a
 * white screen with the tops of two posters.
 *
 * Six attempts to express this as CSS failed on that one rule. The height is
 * arithmetic — the view's inner height minus its other children — so it is
 * stated rather than negotiated.
 *
 * Shared between the plugin and the harness for the same reason `stampWidth`
 * is: a check written about the app is worthless if the harness lays out
 * differently.
 */
export function sizeBody(view: HTMLElement, body: HTMLElement): void {
	const cs = getComputedStyle(view);
	const padTop = parseFloat(cs.paddingTop) || 0;
	const padBottom = parseFloat(cs.paddingBottom) || 0;
	const top = view.getBoundingClientRect().top;

	/*
	 * The view's own height is left alone.
	 *
	 * A previous attempt set it from the screen, which resizes the element the
	 * `ResizeObserver` is watching — a feedback loop browsers abort silently,
	 * leaving whatever value happened to be set when they gave up. A snapshot
	 * caught the result: a 516px view with a 120px body and 257px of nothing.
	 *
	 * The view had 377px available the whole time. The body was not starved of
	 * space; it was measured once, early, and never asked again.
	 */
	const inner = view.clientHeight - padTop - padBottom;
	if (!(inner > 0)) return;

	let used = 0;
	for (const child of Array.from(view.children)) {
		if (child === body || !(child instanceof HTMLElement)) continue;
		if (getComputedStyle(child).display === "none") continue;
		used += child.getBoundingClientRect().height;
	}
	/*
	 * The floor is a last resort, not a value to settle on.
	 *
	 * `Math.max(120, …)` was meant to keep a nonsense mid-transition reading
	 * from blanking the screen. Instead it *became* the screen: opening the
	 * keyboard shrinks the layout viewport while a render is in flight, the
	 * measurement lands during the collapse, 120px gets written, and nothing
	 * measures again — a search showing one clipped row of posters above four
	 * hundred pixels of nothing. That is the exact shape of the bug this floor
	 * exists to prevent, caused by the floor.
	 *
	 * So a real measurement is remembered, and a below-floor one falls back to
	 * the last real answer rather than overwriting it. The first measurement of
	 * a brand-new body still gets the floor, because there is nothing better to
	 * say yet.
	 */
	const want = Math.round(inner - used);
	if (want >= 120) {
		lastGoodHeight.set(body, want);
		body.setCssProps({ height: `${want}px` });
		return;
	}
	body.setCssProps({ height: `${lastGoodHeight.get(body) ?? 120}px` });
}

/** The last height that was not a mid-transition artefact, per body. */
const lastGoodHeight = new WeakMap<HTMLElement, number>();
