/**
 * What a drag meant.
 *
 * Every gesture in Reel shares an axis with something that scrolls, which is
 * the whole difficulty: on a touch screen, "drag down" and "scroll up" are the
 * same movement. Quick mode read any 80px downward drag as undo, so *every*
 * upward scroll fired it and the reward for scrolling was a notice saying there
 * was nothing to take back — the app interrupting to report it had misread you.
 *
 * The rule this encodes, and the one to apply to any gesture added later:
 *
 *   A gesture sharing an axis with a scroller must require that the scroller
 *   was at its edge when the finger went down. Otherwise the drag is a scroll,
 *   and the scroll must win — the user does it a hundred times a session, and
 *   the gesture perhaps once.
 *
 * Pure so it can be tested without a browser, since the failure is subtle,
 * silent, and only reproducible on a device.
 */

export type Gesture = "undo" | "next" | "previous" | "none";

export interface Drag {
	/** Horizontal travel, positive rightwards. */
	dx: number;
	/** Vertical travel, positive downwards. */
	dy: number;
	/** Was the surface under the finger already scrolled to the top? */
	atTop: boolean;
	/** Is there anything an undo would actually take back? */
	canUndo: boolean;
}

/** Below this a drag is a tap or a twitch, not an instruction. */
const HORIZONTAL_MIN = 60;

/**
 * Deliberately more than double the horizontal threshold.
 *
 * Undo is the destructive one and the one competing with scrolling, so it has
 * to be asked for clearly. 80px was a flick; 140px is a pull.
 */
const VERTICAL_MIN = 140;

/** How much straighter than the other axis a drag must be to count. */
const STRAIGHTNESS = 1.5;

export function gestureIntent(drag: Drag): Gesture {
	const { dx, dy, atTop, canUndo } = drag;

	// Down, from the top, with something to undo, and clearly not a horizontal
	// swipe that drifted. All four, or it is a scroll.
	if (atTop && canUndo && dy > VERTICAL_MIN && Math.abs(dy) > Math.abs(dx) * STRAIGHTNESS) {
		return "undo";
	}

	// Comfortably horizontal, and far enough to be deliberate.
	if (Math.abs(dx) < HORIZONTAL_MIN || Math.abs(dx) < Math.abs(dy) * STRAIGHTNESS) return "none";
	return dx < 0 ? "next" : "previous";
}
