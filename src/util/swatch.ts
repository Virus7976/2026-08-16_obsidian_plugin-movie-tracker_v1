/**
 * The dominant colour of a poster.
 *
 * Purpose is narrow: give the detail screen an accent that belongs to the
 * title it is showing, so a Dune page and an Alien page do not look like the
 * same page with different words on it.
 *
 * Runs entirely offline against the image already cached in the vault — no
 * service, no extra request, and no dependency. The maths is small enough
 * that a library would be more code than this file.
 *
 * The pure part lives here, taking raw RGBA bytes, so the decision that
 * matters — which colour wins, and when to admit there isn't one — can be
 * tested without a canvas or a DOM.
 */

export interface Swatch {
	/** 0–360. */
	hue: number;
	/** 0–100. */
	sat: number;
	/** 0–100. */
	light: number;
}

/**
 * Pick an accent from RGBA pixel data.
 *
 * Buckets by hue rather than averaging. Averaging a poster returns mud every
 * time: a dark image with one red title averages to brown, which is neither
 * the red you can see nor a colour anyone would choose.
 *
 * Returns null when there is no defensible answer — a greyscale poster, a
 * mostly-black one, an empty buffer. A null is handled by simply not tinting,
 * which is much better than tinting wrongly and confidently.
 */
export function swatchFromPixels(data: Uint8ClampedArray, step = 4): Swatch | null {
	if (!data.length) return null;

	// 24 buckets — 15° each. Finer splits a single poster's red across two
	// neighbouring buckets and can hand the win to a colour that covers less
	// of the image.
	const BUCKETS = 24;
	const weight = new Array<number>(BUCKETS).fill(0);
	const satSum = new Array<number>(BUCKETS).fill(0);
	const lightSum = new Array<number>(BUCKETS).fill(0);
	let counted = 0;

	for (let i = 0; i < data.length; i += 4 * step) {
		const a = data[i + 3];
		if (a < 128) continue; // transparent, so not part of the picture

		const { h, s, l } = toHsl(data[i], data[i + 1], data[i + 2]);

		// Near-black and near-white pixels have a hue, technically, and it is
		// noise — the letterboxing and the credits block would otherwise
		// outvote the artwork.
		if (l < 12 || l > 92) continue;
		// Greys have no hue worth having either.
		if (s < 18) continue;

		// Weighted toward saturated, mid-light pixels: those are the ones a
		// person would name if asked what colour the poster is.
		const w = (s / 100) * (1 - Math.abs(l - 55) / 55);
		if (w <= 0) continue;

		const b = Math.min(BUCKETS - 1, Math.floor((h / 360) * BUCKETS));
		weight[b] += w;
		satSum[b] += s * w;
		lightSum[b] += l * w;
		counted++;
	}

	if (!counted) return null;

	let best = 0;
	for (let b = 1; b < BUCKETS; b++) if (weight[b] > weight[best]) best = b;
	if (weight[best] <= 0) return null;

	// The bucket centre would quantise every poster to one of 24 hues. The
	// weighted mean inside the winning bucket keeps the actual colour.
	const hue = (best + 0.5) * (360 / BUCKETS);
	return {
		hue: Math.round(hue),
		sat: Math.round(satSum[best] / weight[best]),
		light: Math.round(lightSum[best] / weight[best]),
	};
}

/**
 * Bring a swatch into a range that works as a UI accent.
 *
 * A poster's own colour is chosen to look good at postcard size behind
 * artwork, not to be legible as a 2px underline or a button. Yellows in
 * particular come back at a lightness that vanishes on a light theme.
 *
 * Clamped rather than corrected: the point is that the accent still reads as
 * *that poster's* colour, so the hue is never touched.
 */
export function usableAccent(swatch: Swatch, dark: boolean): Swatch {
	const sat = Math.min(85, Math.max(45, swatch.sat));
	// Yellow and green read much lighter than blue at the same L, so they need
	// pushing further to stay visible against the theme behind them.
	const yellowish = swatch.hue > 40 && swatch.hue < 190;
	const floor = dark ? (yellowish ? 55 : 48) : 30;
	const ceiling = dark ? 78 : (yellowish ? 42 : 48);
	return { hue: swatch.hue, sat, light: Math.min(ceiling, Math.max(floor, swatch.light)) };
}

export function toCss({ hue, sat, light }: Swatch): string {
	return `hsl(${hue} ${sat}% ${light}%)`;
}

/** Standard RGB → HSL, with H in degrees and S/L as percentages. */
function toHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	const d = max - min;

	if (d === 0) return { h: 0, s: 0, l: l * 100 };

	const s = d / (1 - Math.abs(2 * l - 1));
	let h: number;
	if (max === rn) h = ((gn - bn) / d) % 6;
	else if (max === gn) h = (bn - rn) / d + 2;
	else h = (rn - gn) / d + 4;

	h *= 60;
	if (h < 0) h += 360;
	return { h, s: s * 100, l: l * 100 };
}
