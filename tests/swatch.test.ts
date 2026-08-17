/**
 * Picking an accent colour out of a poster.
 *
 * The failure that matters is not "wrong hue" — it is confidently returning a
 * colour for an image that has none. A greyscale poster tinted brown, or a
 * black-bordered one tinted by its letterboxing, looks like a bug in a way
 * that no tint at all never does. So most of these check the refusals.
 */

import { swatchFromPixels, usableAccent, toCss } from "../src/util/swatch";

let pass = 0;
let fail = 0;

function eq(actual: unknown, expected: unknown, label: string) {
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	if (a === b) pass++;
	else {
		fail++;
		console.log(`FAIL ${label}\n  expected ${b}\n  actual   ${a}`);
	}
}

function ok(value: boolean, label: string) {
	eq(value, true, label);
}

/** An RGBA buffer of `n` copies of one colour. */
function solid(r: number, g: number, b: number, n = 100, a = 255): Uint8ClampedArray {
	const out = new Uint8ClampedArray(n * 4);
	for (let i = 0; i < n; i++) {
		out[i * 4] = r;
		out[i * 4 + 1] = g;
		out[i * 4 + 2] = b;
		out[i * 4 + 3] = a;
	}
	return out;
}

function concat(...parts: Uint8ClampedArray[]): Uint8ClampedArray {
	const total = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8ClampedArray(total);
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}

/* ---- the refusals ---- */

eq(swatchFromPixels(new Uint8ClampedArray(0), 1), null, "an empty buffer has no colour");

// Greys have a hue, technically, and it is meaningless. A black-and-white
// poster must come back with nothing rather than a confident tint.
eq(swatchFromPixels(solid(128, 128, 128), 1), null, "mid grey is not a colour");
eq(swatchFromPixels(solid(255, 255, 255), 1), null, "white is not a colour");
eq(swatchFromPixels(solid(0, 0, 0), 1), null, "black is not a colour");

// Letterboxing and a dark credits block are most of some posters by area.
// Counting them would hand the answer to whatever noise survives the crush.
eq(swatchFromPixels(solid(8, 4, 10), 1), null, "near-black is excluded, hue or not");
eq(swatchFromPixels(solid(250, 248, 252), 1), null, "so is near-white");

// Fully transparent pixels are not part of the picture.
eq(swatchFromPixels(solid(200, 30, 40, 100, 0), 1), null, "transparent pixels are skipped");

/* ---- the straightforward case ---- */

{
	const red = swatchFromPixels(solid(200, 30, 40), 1);
	ok(red != null, "a saturated red returns a swatch");
	ok(red!.hue < 20 || red!.hue > 340, "and the hue is red");
	ok(red!.sat > 50, "with the saturation preserved");
}

{
	const blue = swatchFromPixels(solid(40, 80, 210), 1);
	ok(blue != null, "a saturated blue returns a swatch");
	ok(blue!.hue > 200 && blue!.hue < 260, "and the hue is blue");
}

/* ---- why buckets, not an average ---- */

// The case that makes averaging useless: a mostly-dark poster with one strong
// colour. Averaging red and near-black gives a muddy maroon that matches
// nothing you can see. Bucketing throws the dark pixels out and answers red.
{
	const mostlyDarkWithRed = concat(solid(10, 10, 12, 900), solid(210, 40, 50, 100));
	const s = swatchFromPixels(mostlyDarkWithRed, 1);
	ok(s != null, "a dark poster with one strong colour still has an answer");
	ok(s!.hue < 20 || s!.hue > 340, "and it is the colour you can actually see");
}

// Two colours, one clearly dominant by area.
{
	const s = swatchFromPixels(concat(solid(40, 80, 210, 800), solid(210, 40, 50, 200)), 1);
	ok(s!.hue > 200 && s!.hue < 260, "the larger of two colours wins");
}

// The hue is the weighted mean inside the winning bucket, not the bucket
// centre — otherwise every poster quantises to one of 24 hues.
{
	const a = swatchFromPixels(solid(40, 80, 210), 1)!;
	const b = swatchFromPixels(solid(40, 95, 210), 1)!;
	ok(a.hue !== b.hue, "two nearby blues are not flattened to the same hue");
}

/* ---- making it usable as an accent ---- */

// A poster's colour is chosen to look good behind artwork, not to be legible
// as a 2px rule. Clamped into range — but the hue is never touched, because
// the whole point is that it still reads as that poster's colour.
{
	const dim = usableAccent({ hue: 220, sat: 5, light: 4 }, true);
	eq(dim.hue, 220, "the hue survives clamping unchanged");
	ok(dim.sat >= 45, "a washed-out swatch is pushed to a visible saturation");
	ok(dim.light >= 48, "and a near-black one is lifted off the background");
}

{
	const glaring = usableAccent({ hue: 220, sat: 100, light: 99 }, true);
	ok(glaring.sat <= 85, "an over-saturated swatch is pulled back");
	ok(glaring.light <= 78, "and a blinding one is dimmed");
}

// Yellow and green read much lighter than blue at the same L, so they need
// pushing further to stay visible against the theme behind them.
{
	const yellow = usableAccent({ hue: 55, sat: 80, light: 20 }, true);
	const blue = usableAccent({ hue: 220, sat: 80, light: 20 }, true);
	ok(yellow.light > blue.light, "yellows are lifted further than blues on dark");
}

// Light theme needs the opposite treatment: the accent sits on white.
{
	const onLight = usableAccent({ hue: 220, sat: 80, light: 90 }, false);
	ok(onLight.light <= 48, "on a light theme the accent is darkened, not lightened");
	const onDark = usableAccent({ hue: 220, sat: 80, light: 90 }, true);
	ok(onDark.light > onLight.light, "the two themes pull in opposite directions");
}

/* ---- output ---- */

eq(toCss({ hue: 220, sat: 60, light: 50 }), "hsl(220 60% 50%)", "css is a plain hsl triple");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
