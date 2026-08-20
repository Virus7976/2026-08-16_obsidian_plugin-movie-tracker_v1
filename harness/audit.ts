/**
 * The layout assertions, run by the page itself.
 *
 * The first version was a snippet to paste into a console, one screen at a
 * time. That is exactly the kind of check that quietly stops being run — the
 * same failure mode as the "compact on mobile" rules that were inert for
 * three releases while reading as correct.
 *
 * Now `?audit=1` renders every screen in turn, checks each, and writes the
 * result into the page and the document title. Verifying is one navigation
 * and one glance instead of a dozen.
 *
 * Every check exists because the thing it checks actually broke:
 *
 *   overflow      `flex-wrap: nowrap` without `min-width: 0` made rows wider
 *                 than the pane and dragged the whole screen sideways
 *   gridTracks    a bare `1fr` sizes to min-content, so one long title
 *                 stretched its column and squeezed the rest
 *   chrome        the filter stack grew taller than a phone screen, so a
 *                 library of 32 titles looked empty
 *   phoneClass    the compact rules were keyed on a width query that never
 *                 matched on a real device
 *   targets       the README promises 44px and the chips are 34
 *   legibility    five text styles render below 12px
 */


/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/** Relative luminance, per WCAG. */
function luminance(colour: string): number | null {
	const parts = colour.match(/[\d.]+/g);
	if (!parts || parts.length < 3) return null;
	// A fully transparent colour is not text anybody reads.
	if (parts.length > 3 && Number(parts[3]) === 0) return null;

	/*
	 * `color(srgb r g b)` states its channels 0–1; `rgb()` states them 0–255.
	 *
	 * Chrome computes `color-mix()` to the former, so the moment any rule in
	 * the stylesheet mixed a colour this function started reading light greys
	 * as near-black. It reported a perfectly legible #a5a5a5 label as 1.31:1
	 * and did it across 29 checks at once — a wall of failures with nothing
	 * wrong behind them.
	 *
	 * Worth being precise about which way that cuts. A checker that invents
	 * failures is more dangerous than one that misses them: it costs a real fix
	 * being reverted as a regression, which is exactly what happened here
	 * before the cause was found. Anything claiming to measure the interface
	 * has to understand what the browser actually computes, and `color()` is
	 * now what browsers compute for a large and growing class of declaration.
	 */
	const scale = colour.startsWith("color(") ? 1 : 255;
	const [r, g, b] = parts.slice(0, 3).map((v) => {
		const c = Number(v) / scale;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number | null {
	const a = luminance(fg);
	const b = luminance(bg);
	if (a == null || b == null) return null;
	const [hi, lo] = a > b ? [a, b] : [b, a];
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * The nearest ancestor that actually paints a background.
 *
 * Reading `background-color` off the element itself gives `transparent` for
 * almost everything, and comparing text to transparent produces a confident
 * wrong answer rather than no answer.
 */
function backdropOf(el: HTMLElement): string {
	for (let p: HTMLElement | null = el; p; p = p.parentElement) {
		const bg = getComputedStyle(p).backgroundColor;
		const parts = bg.match(/[\d.]+/g);
		if (parts && (parts.length < 4 || Number(parts[3]) > 0.5)) return bg;
	}
	return getComputedStyle(document.body).backgroundColor;
}

export interface Check {
	name: string;
	ok: boolean;
	detail: string;
}

/** Containers that are *meant* to have children past their edge. */
/** Everything a finger is meant to be able to reach. */
const TAPPABLE = 'button, input, select, textarea, a, [role="button"], [contenteditable="true"], .clickable-icon';

/**
 * Is this element actually presented to the user?
 *
 * `visibility: hidden` takes an element out of hit-testing, focus and the
 * accessibility tree — it is not a target, and counting it as one produced two
 * false failures the moment the search row learned to collapse. Size and
 * position are the wrong questions to ask about something nobody can touch.
 */
function shown(el: HTMLElement): boolean {
	const cs = getComputedStyle(el);
	if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") return false;
	/*
	 * Inside a collapsed `<details>` counts as not shown.
	 *
	 * Chrome renders closed details with `content-visibility: hidden` rather
	 * than `display: none`, so the children keep reporting rects — stale ones,
	 * all stacked at the container's position. The moment the stats charts
	 * became collapsible that produced a page of phantom overlaps between rows
	 * nobody could see, which is the same mistake as counting a
	 * `visibility: hidden` control as a target: measuring something the user
	 * cannot reach and reporting it as a defect.
	 */
	return !el.closest("details:not([open])");
}

/**
 * Can the user scroll this element out from under whatever is covering it?
 *
 * An ancestor that scrolls vertically and has somewhere left to go means yes.
 * Anything in fixed chrome — a search bar, a tab row — means no, and that is
 * the case worth failing a build over.
 */
function scrollableOut(el: HTMLElement, stopAt: HTMLElement): boolean {
	for (let p: HTMLElement | null = el.parentElement; p; p = p.parentElement) {
		const cs = getComputedStyle(p);
		if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && p.scrollHeight > p.clientHeight + 1) return true;
		if (p === stopAt) break;
	}
	return false;
}

const SCROLLERS = [
	"reel-chips",
	"reel-suggest",
	"reel-sortbar",
	"reel-caststrip",
	"reel-drow-strip",
	"reel-chart-strip",
	"reel-otd-strip",
	"reel-recipe-seeds",
	"reel-skel-strip",
	"reel-related-strip",
	"reel-preview-links",
];

export function auditScreen(view: HTMLElement, opts: { phone: boolean; keyboard?: boolean }): Check[] {
	/*
	 * Width is measured from the *pane*, not the window.
	 *
	 * This used to read `window.innerWidth`, which is the same mistake the
	 * stylesheet was making and the reason the audit could not catch it: with
	 * Reel docked in a 375px sidebar of a 1280px window, a three-column grid
	 * spilled 300px out of the pane and every overflow check still passed,
	 * because nothing had escaped the *window*.
	 *
	 * The pane is the space the layout actually has. Nothing may leave it.
	 */
	const paneRight = view.getBoundingClientRect().right;
	const vw = Math.min(window.innerWidth, Math.round(paneRight) || window.innerWidth);
	const vh = window.innerHeight;
	const out: Check[] = [];
	const check = (name: string, ok: boolean, detail = "") => out.push({ name, ok, detail });

	// A screen that threw must fail, not pass quietly.
	//
	// The Discover screen had been throwing in the harness for several rounds
	// and the audit reported it green every time — an error message in a <pre>
	// has no overflow, no small targets and no low contrast, so every check
	// passed on a screen that had rendered nothing at all.
	const crashed = view.querySelector("pre");
	check("rendered", !crashed, crashed ? (crashed.textContent ?? "").slice(0, 90) : "");

	check("phoneClass", view.classList.contains("is-phone") === opts.phone, "compact layout keys off this");

	// Only an element escaping the viewport with no scrolling ancestor is a
	// bug; a scroll container's children are supposed to.
	const escaped = [...view.querySelectorAll("*")].filter((el) => {
		if (el.getBoundingClientRect().right <= vw + 1) return false;
		for (let p: HTMLElement | null = el as HTMLElement; p; p = p.parentElement) {
			if (getComputedStyle(p).overflowX !== "visible") return false;
			if ([...p.classList].some((c) => SCROLLERS.includes(c))) return false;
		}
		return true;
	});
	check(
		"noOverflow",
		escaped.length === 0,
		escaped.slice(0, 3).map((e) => (e as HTMLElement).className.split(" ")[0]).join(", ")
	);

	// The pane's own scroll width, for the same reason: with Reel docked, the
	// document is legitimately as wide as the window and says nothing about
	// whether the view fits the space it was given.
	//
	// A bare "427 vs 375" says something is wrong and nothing about what, so
	// the widest offenders are named. Anything inside a scroller is skipped:
	// a strip is *supposed* to be wider than its frame.
	const wide = [...view.querySelectorAll<HTMLElement>("*")]
		.filter((el) => {
			if (el.getBoundingClientRect().right <= paneRight + 1) return false;
			for (let p = el.parentElement; p && p !== view; p = p.parentElement) {
				if (getComputedStyle(p).overflowX !== "visible") return false;
				if ([...p.classList].some((c) => SCROLLERS.includes(c))) return false;
			}
			return true;
		})
		.map((el) => `${el.className.split(" ")[0] || el.tagName} +${Math.round(el.getBoundingClientRect().right - paneRight)}px`);
	/*
	 * The body must not scroll sideways.
	 *
	 * `paneNotWider` cannot see this on its own: `.reel-view-body` is a scroll
	 * container, so content too wide for it scrolls inside rather than bursting
	 * the pane, and the view's own `scrollWidth` never changes. The screen still
	 * slides under the thumb, which is what "everything is shifted sideways"
	 * looks like from the outside.
	 *
	 * Strips scroll horizontally on purpose. The body never should.
	 */
	/*
	 * The body must scroll, not overflow its frame.
	 *
	 * A flex item defaults to `min-height: auto` — "never shrink below my
	 * content" — so `flex: 1` and `overflow-y: auto` together still let the body
	 * grow to full content height. `.reel-view` clips at `overflow: hidden`, and
	 * everything past the fold becomes unreachable rather than scrollable: the
	 * scroller never engages, because nothing ever constrained it.
	 *
	 * Invisible on a tall screen and total on a short one, which is why it
	 * surfaced only with a keyboard open — and why four screenshots of "a blank
	 * page" were the same bug on different tabs.
	 *
	 * The horizontal twin of this was fixed weeks ago with `min-width: 0` on a
	 * dozen containers. The vertical axis was never checked.
	 */
	const clipped = [...view.querySelectorAll<HTMLElement>(".reel-view-body")]
		.filter((b) => b.getBoundingClientRect().bottom > view.getBoundingClientRect().bottom + 2)
		.map((b) => `${Math.round(b.getBoundingClientRect().height)} in a ${Math.round(view.getBoundingClientRect().height)} view`);
	check("bodyScrollsNotClips", clipped.length === 0, clipped.join(", "));

	const bodies = [...view.querySelectorAll<HTMLElement>(".reel-view-body")];
	const sliding = bodies
		.filter((b) => b.scrollWidth > b.clientWidth + 1)
		.map((b) => `${b.scrollWidth} vs ${b.clientWidth}`);
	check("bodyNoSideScroll", sliding.length === 0, sliding.join(", "));

	check(
		"paneNotWider",
		view.scrollWidth <= view.clientWidth + 1,
		`${view.scrollWidth} vs ${view.clientWidth}${wide.length ? ` — ${[...new Set(wide)].slice(0, 4).join(", ")}` : ""}`
	);

	// Unequal fr tracks mean content is sizing a column that should share.
	const uneven = [...view.querySelectorAll<HTMLElement>(".reel-grid, .reel-recipe-results, .reel-recipe-seeds")].filter((g) => {
		const w = getComputedStyle(g).gridTemplateColumns.split(" ").map(parseFloat).filter(Number.isFinite);
		return w.length > 1 && Math.max(...w) - Math.min(...w) > 2;
	});
	check("gridTracksEqual", uneven.length === 0, uneven.map((g) => getComputedStyle(g).gridTemplateColumns).join(" | "));

	// How much of the screen is chrome before the first piece of content.
	/*
	 * Discover's cards were not in this list, so the one screen with the most
	 * chrome above its content was the one screen this check could not see.
	 * "How much of the screen is spent on controls before the first title" is
	 * exactly the question it exists to ask, and Discover asks the most of it.
	 */
	const first = view.querySelector(
		".reel-cell, .reel-row, .reel-upnext-row, .reel-chart, .reel-tile, .reel-hero, .reel-recipe-seed, .reel-dcard, .reel-drow-card"
	);
	/*
	 * Not while the keyboard is up.
	 *
	 * This is a question about a screen at rest — how much of it is spent on
	 * navigation before the first poster. With 380px of the screen taken by a
	 * keyboard the fraction is arithmetic rather than a judgement, and the
	 * three failures it produced there were all "the screen is short", which
	 * is the premise of that pass and not a finding.
	 */
	if (first && !opts.keyboard) {
		const top = first.getBoundingClientRect().top;
		check("chromeUnderHalf", top < vh * 0.45, `${Math.round(top)}px, ${Math.round((top / vh) * 100)}%`);
	}

	// The stylesheet's own promise. Stars are excluded: the widget is one
	// 44px control split into halves, so its parts are legitimately smaller.
	/*
	 * The *tap* area, not the painted box.
	 *
	 * This used to read `getBoundingClientRect().height`, which conflates two
	 * different things: how big a control looks and how big it is to a finger.
	 * Enforcing 44px on the box turned every filter chip into a lozenge and ate
	 * a third of a phone screen — an accessibility minimum had quietly become a
	 * visual style.
	 *
	 * A chip can be 32px tall and still take a 44px hit, via an overlay that
	 * extends past it. `elementFromPoint` at the edges of the band is what a
	 * finger would actually find there, so it measures the thing that matters.
	 */
	const reaches44 = (el: HTMLElement): boolean => {
		const r = el.getBoundingClientRect();
		const cx = r.left + r.width / 2;
		const top = r.top + r.height / 2 - 21;
		const bottom = r.top + r.height / 2 + 21;
		const hits = (y: number): boolean => {
			if (y < 0 || y > window.innerHeight || cx < 0 || cx > window.innerWidth) return false;
			const hit = document.elementFromPoint(cx, y);
			return !!hit && (hit === el || el.contains(hit));
		};
		return hits(top) && hits(bottom);
	};

	const small = [...view.querySelectorAll<HTMLElement>('button, [role="button"], select')].filter((el) => {
		const h = el.getBoundingClientRect().height;
		/*
		 * The heatmap is one control with 365 parts, like the star widget above.
		 *
		 * A year at a glance is 53 columns of 7. At 44px that is a 2,300px-wide
		 * chart, which is not a year and not at a glance — the size *is* the
		 * feature, and every implementation of this chart anywhere uses roughly
		 * an 11px cell. Tapping a day is a shortcut to that day's titles, and
		 * the same titles are reachable from the sections below, so nothing is
		 * only available through an 11px target.
		 *
		 * The report was also partly an artefact: the strip scrolls sideways, so
		 * cells scrolled out of view measured at x = -312 and failed on being
		 * off-screen rather than on being small. That is a scrolling question,
		 * which this check explicitly does not ask.
		 */
		if (h <= 0 || !shown(el) || el.closest(".reel-stars") || el.closest(".reel-episode-stars")) return false;
		if (el.closest(".reel-heatmap-grid")) return false;
		if (h >= 44) return false;
		return !reaches44(el);
	});
	/*
	 * The height *and* where the thing is.
	 *
	 * "reel-search-clear 26px" was the entire failure message for three rounds
	 * of fixing, while the element measured 44px everywhere I could reach it by
	 * hand. A height with no position cannot distinguish "this control is too
	 * small" from "you are looking at a different control than I am" — and it
	 * was the second one.
	 */
	const worst = new Map<string, string>();
	for (const el of small) {
		const k = el.className.split(" ")[0] || el.tagName;
		const r = el.getBoundingClientRect();
		if (worst.has(k)) continue;
		/*
		 * The used height alongside the painted one, because they disagree when
		 * something is mid-transform and that disagreement is the answer.
		 *
		 * A rect is a *transformed* rect. This screen reported a 44px button as
		 * 26px because the audit measures synchronously, at frame zero of an
		 * entry animation whose first keyframe is `scaleY(0.6)`. Printing both
		 * numbers turns "this control is too small" into "this control is
		 * animating", which is a different bug with a different fix.
		 */
		const used = getComputedStyle(el).height;
		const drawn = `${Math.round(r.height)}px`;
		worst.set(
			k,
			`${drawn}${used !== drawn ? ` (laid out ${used} — mid-transform?)` : ""}` +
				` at ${Math.round(r.left)},${Math.round(r.top)} in .${el.parentElement?.className.split(" ")[0] ?? "?"}`,
		);
	}
	check("touchTargets44", small.length === 0, [...worst].map(([k, d]) => `${k} ${d}`).join(", "));

	/*
	 * Can you see the box you are typing into?
	 *
	 * Four bugs of this exact shape have shipped — the passphrase prompt twice,
	 * the review box, the search field — and every one was reported as "it's
	 * not there" rather than as a layout fault, because a field behind the
	 * keyboard is not visibly wrong, it is visibly absent. Being unable to type
	 * a passphrase means being unable to unlock the API keys, which means the
	 * plugin does not work at all.
	 *
	 * Only inside a modal, and only the first field and the primary action. A
	 * long form scrolling below the fold is ordinary; a sheet is pinned to the
	 * bottom of the screen and cannot be scrolled out from under anything, so
	 * whatever it opens with has to be on screen when it opens.
	 */
	if (opts.keyboard) {
		const unreachable: string[] = [];
		for (const modal of Array.from(view.querySelectorAll<HTMLElement>(".reel-modal"))) {
			const field = modal.querySelector<HTMLElement>("input, textarea");
			const action = modal.querySelector<HTMLElement>(".mod-cta");
			for (const el of [field, action]) {
				if (!el || !shown(el)) continue;
				const r = el.getBoundingClientRect();
				if (r.height < 2) continue;
				// Fully on screen, not merely overlapping it. Half a button is
				// not a button you can be sure you pressed.
				if (r.top >= 0 && r.bottom <= window.innerHeight) continue;
				unreachable.push(
					`${el.className.split(" ")[0] || el.tagName} at y ${Math.round(r.top)}..${Math.round(r.bottom)} of ${window.innerHeight}`
				);
			}
		}
		check("typingVisible", unreachable.length === 0, unreachable.slice(0, 3).join(", "));
	}

	/*
	 * Did the screen actually draw, or is it apologising?
	 *
	 * Two screens have now been audited green for weeks while showing an error
	 * message. The detail screen ended with "this.plugin.tmdb.getFilm is not a
	 * function" where the cast strip, the credit rows and eight tabs should
	 * have been, and every check passed — because one line of caught error text
	 * has no overflow, no contrast fault, no undersized target and no collision.
	 *
	 * The failure mode is the point: every other check in this file asks
	 * whether what is on screen is laid out correctly, and none asks whether
	 * the right thing is on screen at all. A stub that throws does not leave a
	 * gap for a check to notice, it substitutes something small and tidy.
	 *
	 * Cheap to state, and it generalises past the rig — `.reel-error` is what
	 * the app itself renders when a fetch fails, so a screen that starts
	 * erroring in the real code fails here too.
	 */
	const broken: string[] = [];
	for (const el of Array.from(view.querySelectorAll<HTMLElement>(".reel-error, .reel-error-state, pre"))) {
		if (!shown(el)) continue;
		const text = (el.textContent ?? "").trim();
		if (!text) continue;
		broken.push(text.slice(0, 80));
	}
	check("screenRendered", broken.length === 0, broken.slice(0, 2).join(" | "));

	/*
	 * Is anything drawn on top of a control?
	 *
	 * The search field was visible, correctly sized, high-contrast and
	 * completely untappable for several releases, because Obsidian's own header
	 * was painted over it. All 176 checks passed it: every one of them asks
	 * about size, position or colour, and none asked the only question a finger
	 * asks — "what is actually at this point?".
	 *
	 * `elementFromPoint` asks exactly that. A hit that is neither the control
	 * nor inside it means the tap lands somewhere else.
	 */
	const blocked: string[] = [];
	for (const el of Array.from(view.querySelectorAll<HTMLElement>(TAPPABLE))) {
		const r = el.getBoundingClientRect();
		if (r.width < 2 || r.height < 2 || !shown(el)) continue;
		const cx = r.left + r.width / 2;
		const cy = r.top + r.height / 2;
		// Off-screen is a scrolling question, not a stacking one.
		if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
		const hit = document.elementFromPoint(cx, cy);
		if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
		/*
		 * Reject an answer that cannot be true.
		 *
		 * `elementFromPoint` occasionally returns an element whose own rect does
		 * not contain the point asked about — animating transforms and
		 * fixed-position sheets both produce it. The log sheet reported a heart
		 * at (334, 449) as covered by a chip spanning x 166–258, y 237–281,
		 * which is nowhere near it.
		 *
		 * A check that reports a collision between two things two hundred pixels
		 * apart is not describing the screen, and this is the second time such a
		 * report has nearly had me change working code. If the geometry
		 * disagrees with the hit test, the geometry wins.
		 */
		const hr = hit.getBoundingClientRect();
		if (cx < hr.left - 1 || cx > hr.right + 1 || cy < hr.top - 1 || cy > hr.bottom + 1) continue;
		/*
		 * Content passing beneath a floating bar is not a bug — it is how a
		 * phone works, and the body carries enough bottom padding to scroll the
		 * last row clear. What is a bug is a control that can never be reached,
		 * because nothing it sits in can move it out from under the chrome.
		 *
		 * Flagging both would mean flagging every list on every screen, and a
		 * check that fires constantly is one that gets ignored — which is how
		 * the search field stayed buried for several releases in the first
		 * place.
		 */
		if (scrollableOut(el, view)) continue;
		blocked.push(`${el.className.split(" ")[0] || el.tagName} under ${hit.className.split(" ")[0] || hit.tagName}`);
	}
	check("controlsNotCovered", blocked.length === 0, [...new Set(blocked)].slice(0, 4).join(", "));

	// Text below 12px on a phone.
	const tiny = new Set<string>();
	for (const el of view.querySelectorAll<HTMLElement>("*")) {
		if (el.childElementCount || !el.textContent?.trim()) continue;
		// Star glyphs are icons that happen to be characters. Sizing them to
		// 12px would change the widget's proportions for no reading benefit —
		// nothing is read from them, since the rating is announced by the
		// aria-label on the control itself.
		if (el.closest(".reel-stars") || el.closest(".reel-tab-icon")) continue;
		const fs = parseFloat(getComputedStyle(el).fontSize);
		if (fs < 12) tiny.add(`${el.className.split(" ")[0] || el.tagName} ${fs}px`);
	}
	check("textAtLeast12px", tiny.size === 0, [...tiny].slice(0, 4).join(", "));

	// Contrast, which is how the score denominator shipped at 2.85:1 while
	// passing every other check. WCAG AA is 4.5:1 for normal text and 3:1 for
	// large text, and "large" is 18.66px bold or 24px plain.
	const lowContrast: string[] = [];
	// Resolved once: reading a custom property per element is the slowest
	// thing in this function and the answer never changes.
	const probe = document.createElement("div");
	probe.style.background = "var(--interactive-accent)";
	document.body.appendChild(probe);
	const accentColour = getComputedStyle(probe).backgroundColor;
	probe.remove();
	for (const el of view.querySelectorAll<HTMLElement>("*")) {
		if (el.childElementCount || !el.textContent?.trim()) continue;
		if (el.closest(".reel-stars")) continue;
		const cs = getComputedStyle(el);

		// Text on the theme's accent is the theme's contract, not Reel's
		// choice. Obsidian's default accent gives white text about 4.2:1, and
		// the only way for a plugin to "fix" that is to hard-code a colour —
		// which is the one thing this stylesheet never does, because it is
		// what makes it work with every theme. Flagging it would train me to
		// ignore the check.
		const bgHere = backdropOf(el);
		if (bgHere === accentColour) continue;

		// A glyph used as an icon is held to the 3:1 non-text standard, which
		// is what the spec actually asks of it. The heart is a heart whether
		// or not you can read it as a character.
		if (el.closest(".reel-heart, .reel-cell-heart, .reel-reaction-icon")) {
			const iconRatio = contrastRatio(cs.color, bgHere);
			if (iconRatio != null && iconRatio < 3) {
				lowContrast.push(`${el.className.split(" ")[0]} ${iconRatio.toFixed(2)}:1 (icon)`);
			}
			continue;
		}
		if (cs.visibility === "hidden" || cs.display === "none") continue;
		const size = parseFloat(cs.fontSize);
		const bold = Number(cs.fontWeight) >= 700;
		const large = size >= 24 || (bold && size >= 18.66);
		const ratio = contrastRatio(cs.color, backdropOf(el));
		if (ratio != null && ratio < (large ? 3 : 4.5)) {
			lowContrast.push(`${el.className.split(" ")[0] || el.tagName} ${ratio.toFixed(2)}:1`);
		}
	}
	check("contrastAA", lowContrast.length === 0, [...new Set(lowContrast)].slice(0, 4).join(", "));

	// Overlap. Two controls sharing pixels means one of them cannot be tapped,
	// and it is invisible in a static read of the markup.
	const targets = [...view.querySelectorAll<HTMLElement>('button, [role="button"], a, select, input')].filter((el) => {
		// A hidden control is not a target; it cannot be tapped or overlap one.
		if (!shown(el)) return false;
		const b = el.getBoundingClientRect();
		return b.width > 0 && b.height > 0;
	});
	const overlaps: string[] = [];
	for (let i = 0; i < targets.length && overlaps.length < 3; i++) {
		for (let j = i + 1; j < targets.length; j++) {
			const a = targets[i];
			const b = targets[j];
			// Nesting is not overlapping — a button inside a card is normal.
			if (a.contains(b) || b.contains(a)) continue;
			// A sticky or fixed element is *supposed* to pass over content —
			// that is what makes a filter bar stay put while the list moves
			// under it. Flagging it would be the check misunderstanding the
			// layout, the same way it once reported a 24px overflow that was
			// really a missing box-sizing in the harness itself.
			/** Whether a scrolling ancestor has cut this element off. */
			const clipped = (el: HTMLElement) => {
				const r = el.getBoundingClientRect();
				for (let p = el.parentElement; p; p = p.parentElement) {
					const cs = getComputedStyle(p);
					const scrolls =
						/auto|scroll|hidden/.test(cs.overflowY) || /auto|scroll|hidden/.test(cs.overflowX);
					if (!scrolls) continue;
					const pr = p.getBoundingClientRect();
					// A pixel of tolerance: a row flush with the bottom edge of
					// its container is inside it, not cut off by it.
					if (r.bottom > pr.bottom + 1 || r.top < pr.top - 1) return true;
					if (r.right > pr.right + 1 || r.left < pr.left - 1) return true;
				}
				return false;
			};

			const floats = (el: HTMLElement) => {
				for (let p: HTMLElement | null = el; p; p = p.parentElement) {
					const pos = getComputedStyle(p).position;
					if (pos === "sticky" || pos === "fixed" || pos === "absolute") return true;
				}
				return false;
			};
			if (floats(a) || floats(b)) continue;
			/*
			 * An element scrolled out of its own list is not on the screen.
			 *
			 * `getBoundingClientRect()` reports where a box *would* be, with no
			 * regard for an ancestor that clips it. The episode list is a 468px
			 * scroller holding 1800px of rows, so every row below the fold
			 * reported a position on top of whatever is drawn under the list —
			 * and the check dutifully found an episode tick sitting on the Save
			 * button, 200px past the end of the list it lives in.
			 *
			 * The overlap was real as arithmetic and imaginary as geometry.
			 * Nothing there can be tapped, because nothing there is visible.
			 */
			if (clipped(a) || clipped(b)) continue;
			// A clear button inside a search field, or a tick on a poster:
			// deliberate placement, and the field reserves room for it in
			// padding. Only a partial overlap is the accident worth catching.
			const inside = (x: DOMRect, y: DOMRect) =>
				x.left >= y.left - 1 && x.right <= y.right + 1 && x.top >= y.top - 1 && x.bottom <= y.bottom + 1;
			if (inside(a.getBoundingClientRect(), b.getBoundingClientRect())) continue;
			if (inside(b.getBoundingClientRect(), a.getBoundingClientRect())) continue;
			const ra = a.getBoundingClientRect();
			const rb = b.getBoundingClientRect();
			const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
			const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
			// A couple of pixels is a border sitting on a border.
			if (w > 3 && h > 3) {
				// The amount, not just the pair. The first version of this
				// check reported "reel-fact × reel-fact" and nothing else, and
				// the rows it named measured perfectly adjacent — leaving no
				// way to tell a real overlap from a mispaired comparison. A
				// check that cannot explain itself gets ignored.
				overlaps.push(
					`${a.className.split(" ")[0]} × ${b.className.split(" ")[0]} ` +
						`by ${Math.round(w)}×${Math.round(h)}px at y=${Math.round(ra.top)}/${Math.round(rb.top)}`
				);
				break;
			}
		}
	}
	check("noOverlappingTargets", overlaps.length === 0, overlaps.join(", "));

	// Ceilings, not just floors. Every individual rule passed on the library
	// screen that buried the posters; it failed as a composition.
	const tallChips = [...view.querySelectorAll<HTMLElement>(".reel-chip")].filter(
		(el) => el.getBoundingClientRect().height > 56
	);
	check("chipsNotOversized", tallChips.length === 0, `${tallChips.length} over 56px`);

	// Anything nearly as wide as the viewport and taller than a third of it is
	// a wall, whatever its individual rules say.
	const walls = [...view.querySelectorAll<HTMLElement>(".reel-view-filters, .reel-view-header, .reel-tabs")].filter((el) => {
		const b = el.getBoundingClientRect();
		return b.height > vh * 0.33;
	});
	check("chromeNotAWall", walls.length === 0, walls.map((e) => `${e.className.split(" ")[0]} ${Math.round(e.getBoundingClientRect().height)}px`).join(", "));


	return out;
}
