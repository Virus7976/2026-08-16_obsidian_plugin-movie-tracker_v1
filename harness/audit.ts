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

export interface Check {
	name: string;
	ok: boolean;
	detail: string;
}

/** Containers that are *meant* to have children past their edge. */
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

export function auditScreen(view: HTMLElement, opts: { phone: boolean }): Check[] {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const out: Check[] = [];
	const check = (name: string, ok: boolean, detail = "") => out.push({ name, ok, detail });

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

	check(
		"docNotWider",
		document.documentElement.scrollWidth <= vw,
		`${document.documentElement.scrollWidth} vs ${vw}`
	);

	// Unequal fr tracks mean content is sizing a column that should share.
	const uneven = [...view.querySelectorAll<HTMLElement>(".reel-grid, .reel-recipe-results, .reel-recipe-seeds")].filter((g) => {
		const w = getComputedStyle(g).gridTemplateColumns.split(" ").map(parseFloat).filter(Number.isFinite);
		return w.length > 1 && Math.max(...w) - Math.min(...w) > 2;
	});
	check("gridTracksEqual", uneven.length === 0, uneven.map((g) => getComputedStyle(g).gridTemplateColumns).join(" | "));

	// How much of the screen is chrome before the first piece of content.
	const first = view.querySelector(".reel-cell, .reel-row, .reel-upnext-row, .reel-chart, .reel-tile, .reel-hero, .reel-recipe-seed");
	if (first) {
		const top = first.getBoundingClientRect().top;
		check("chromeUnderHalf", top < vh * 0.45, `${Math.round(top)}px, ${Math.round((top / vh) * 100)}%`);
	}

	// The stylesheet's own promise. Stars are excluded: the widget is one
	// 44px control split into halves, so its parts are legitimately smaller.
	const small = [...view.querySelectorAll<HTMLElement>('button, [role="button"], select')].filter((el) => {
		const h = el.getBoundingClientRect().height;
		return h > 0 && h < 44 && !el.closest(".reel-stars") && !el.closest(".reel-episode-stars");
	});
	const worst = new Map<string, number>();
	for (const el of small) {
		const k = el.className.split(" ")[0] || el.tagName;
		worst.set(k, Math.min(worst.get(k) ?? 99, Math.round(el.getBoundingClientRect().height)));
	}
	check("touchTargets44", small.length === 0, [...worst].map(([k, h]) => `${k} ${h}px`).join(", "));

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

	return out;
}
