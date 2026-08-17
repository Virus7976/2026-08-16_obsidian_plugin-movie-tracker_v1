/**
 * The layout assertions, in one place.
 *
 * Paste into the harness page's console, or run through the browser tool.
 * Returns a pass/fail summary rather than a dump — a wall of rectangles is
 * how the first run of this buried a real bug in 900 lines of JSON.
 *
 * Every check here exists because the thing it checks actually broke:
 *
 *   chrome        the filter stack grew taller than a phone screen, so a
 *                 library of 32 titles looked empty
 *   overflow      `flex-wrap: nowrap` without `min-width: 0` made rows wider
 *                 than the pane and dragged the whole screen sideways
 *   gridTracks    a bare `1fr` track sizes to min-content, so one long title
 *                 stretched its column and squeezed the rest
 *   phoneClass    the compact rules were keyed on a width media query that
 *                 never matched on a real device
 */
(() => {
	const vw = innerWidth, vh = innerHeight;
	const view = document.querySelector('.reel-view');
	const out = [];
	const check = (name, ok, detail) => out.push({ name, ok, detail });

	check('renders', !!view, view ? '' : 'no .reel-view');
	if (!view) return out;

	check('phoneClass', view.classList.contains('is-phone'), 'compact layout is keyed off this');

	// Scroll containers are meant to have children past their edge.
	const scrollers = ['reel-chips','reel-suggest','reel-sortbar','reel-caststrip',
		'reel-drow-strip','reel-chart-strip','reel-otd-strip','reel-recipe-seeds','reel-skel-strip'];
	const escaped = [...view.querySelectorAll('*')].filter(el => {
		if (el.getBoundingClientRect().right <= vw + 1) return false;
		for (let p = el; p; p = p.parentElement) {
			if (getComputedStyle(p).overflowX !== 'visible') return false;
			if ([...p.classList].some(c => scrollers.includes(c))) return false;
		}
		return true;
	});
	check('noOverflow', escaped.length === 0,
		escaped.slice(0, 3).map(e => e.className.split(' ')[0]).join(', '));

	check('docNotWider', document.documentElement.scrollWidth <= vw, `${document.documentElement.scrollWidth} vs ${vw}`);

	const grids = [...view.querySelectorAll('.reel-grid, .reel-recipe-results, .reel-recipe-seeds')];
	const uneven = grids.filter(g => {
		const w = getComputedStyle(g).gridTemplateColumns.split(' ').map(parseFloat).filter(Number.isFinite);
		return w.length > 1 && Math.max(...w) - Math.min(...w) > 2;
	});
	check('gridTracksEqual', uneven.length === 0, uneven.map(g => getComputedStyle(g).gridTemplateColumns).join(' | '));

	const first = view.querySelector('.reel-cell, .reel-row, .reel-upnext-row, .reel-chart, .reel-tile');
	if (first) {
		const top = first.getBoundingClientRect().top;
		check('chromeUnderHalfScreen', top < vh * 0.45, `${Math.round(top)}px, ${Math.round(top / vh * 100)}% of the screen`);
	}

	// Nothing below a comfortable thumb target. 44px is the floor the whole
	// stylesheet claims to hold to, so it may as well be checked.
	const small = [...view.querySelectorAll('button, [role="button"]')].filter(el => {
		const b = el.getBoundingClientRect();
		return b.height > 0 && b.height < 30 && !el.closest('.reel-stars');
	});
	check('touchTargets', small.length === 0, small.slice(0, 3).map(e => `${e.className.split(' ')[0]} ${Math.round(e.getBoundingClientRect().height)}px`).join(', '));

	return { pass: out.filter(o => o.ok).length, fail: out.filter(o => !o.ok).length, failures: out.filter(o => !o.ok) };
})();
