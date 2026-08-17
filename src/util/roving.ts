/**
 * Moving through a grid with the keyboard.
 *
 * Individual controls in Reel already answer Enter and Space, but there was
 * no way to *get* to the third poster without pressing Tab three times — and
 * in a 300-title library that is 300 stops before you reach the filter bar.
 * On a desktop that difference is what separates a tool from a web page.
 *
 * The arithmetic is here and pure because it is the part that is easy to get
 * subtly wrong: what happens at the end of a row, on the last row when it is
 * short, and when the grid is one column wide because the window is narrow.
 * Those are exactly the cases nobody tests by hand.
 */

export type Motion = "left" | "right" | "up" | "down" | "home" | "end";

/**
 * Where a keypress moves the selection.
 *
 * Rows wrap into each other on left and right, because a grid reads like
 * text: at the end of a row the next item is the start of the next one, not
 * nothing. Up and down do *not* wrap — falling off the bottom into the top is
 * disorienting in a way that horizontal wrapping is not, since the eye
 * follows a column rather than a sentence.
 *
 * Out-of-range indices are clamped rather than rejected. A caller holding a
 * stale index after the list shrank should land somewhere sensible instead of
 * losing the selection entirely.
 */
export function move(index: number, motion: Motion, total: number, columns: number): number {
	if (total <= 0) return -1;
	const cols = Math.max(1, columns);
	const at = Math.min(Math.max(0, index), total - 1);

	switch (motion) {
		case "home":
			return 0;
		case "end":
			return total - 1;
		case "left":
			return Math.max(0, at - 1);
		case "right":
			return Math.min(total - 1, at + 1);
		case "up": {
			const up = at - cols;
			// Already on the top row: stay put rather than jumping to the
			// start, which reads as the list scrolling under you.
			return up < 0 ? at : up;
		}
		case "down": {
			const down = at + cols;
			if (down < total) return down;
			// The last row is usually short. Falling off its end should land
			// on the final item rather than doing nothing, or the last few
			// titles in a library are unreachable from the row above them.
			return at === total - 1 ? at : total - 1;
		}
	}
}

/**
 * How many columns a grid is actually rendering.
 *
 * Read from the laid-out elements rather than from the CSS, because the grid
 * is `auto-fill` — the column count depends on the pane width and changes
 * when the window does. Counting items that share the first row's vertical
 * position is the only reliable answer, and it costs one pass.
 */
export function columnsOf(tops: number[]): number {
	if (!tops.length) return 1;
	const first = tops[0];
	let n = 0;
	for (const top of tops) {
		// A tolerance, because sub-pixel layout means two items on the same
		// row rarely report exactly equal offsets.
		if (Math.abs(top - first) > 2) break;
		n++;
	}
	return Math.max(1, n);
}

/** Which key, if any, this is. Returns null for anything not ours. */
export function motionFor(key: string): Motion | null {
	switch (key) {
		case "ArrowLeft":
		case "h":
			return "left";
		case "ArrowRight":
		case "l":
			return "right";
		case "ArrowUp":
		case "k":
			return "up";
		case "ArrowDown":
		case "j":
			return "down";
		case "Home":
			return "home";
		case "End":
			return "end";
		default:
			return null;
	}
}
