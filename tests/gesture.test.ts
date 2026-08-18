/**
 * A scroll must never be mistaken for a gesture.
 *
 * Quick mode announced "nothing to take back" on every upward scroll, because
 * dragging down and scrolling up are the same movement and the handler only
 * looked at the distance. These are the cases that must never regress.
 */
import { gestureIntent } from "../src/util/gesture";

let passed = 0;
let failed = 0;

function eq(name: string, got: unknown, want: unknown): void {
	if (got === want) {
		passed++;
	} else {
		failed++;
		console.error(`  ✗ ${name} — got ${String(got)}, wanted ${String(want)}`);
	}
}

const scrolled = { atTop: false, canUndo: true };
const top = { atTop: true, canUndo: true };

/* ---- the bug, stated as tests -------------------------------------- */

eq("a long scroll up is not an undo", gestureIntent({ dx: 0, dy: 300, ...scrolled }), "none");
eq("a short scroll up is not an undo", gestureIntent({ dx: 0, dy: 90, ...scrolled }), "none");
eq(
	"a pull from the top with nothing to undo does nothing",
	gestureIntent({ dx: 0, dy: 300, atTop: true, canUndo: false }),
	"none"
);

/* ---- and the gesture still works ----------------------------------- */

eq("a deliberate pull from the top undoes", gestureIntent({ dx: 0, dy: 200, ...top }), "undo");
eq("a flick is not a pull", gestureIntent({ dx: 0, dy: 100, ...top }), "none");
eq("a diagonal drag is not a pull", gestureIntent({ dx: 160, dy: 180, ...top }), "none");

/* ---- horizontal, unchanged ----------------------------------------- */

eq("left goes forward", gestureIntent({ dx: -120, dy: 0, ...top }), "next");
eq("right goes back", gestureIntent({ dx: 120, dy: 0, ...top }), "previous");
eq("a small drag is a tap", gestureIntent({ dx: 30, dy: 0, ...top }), "none");
eq("a mostly-vertical drag is not a swipe", gestureIntent({ dx: 70, dy: 120, ...scrolled }), "none");
eq("swiping works mid-scroll", gestureIntent({ dx: -150, dy: 10, ...scrolled }), "next");

/* ---- upward drags belong to the scroller --------------------------- */

eq("dragging up is never a gesture", gestureIntent({ dx: 0, dy: -300, ...top }), "none");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
