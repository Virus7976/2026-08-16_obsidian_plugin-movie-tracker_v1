/**
 * Keyboard movement through a grid.
 *
 * The interesting cases are all edges: the end of a row, the last row when it
 * is short, and a one-column grid on a narrow pane. Nobody tests those by
 * hand, which is exactly why they are the ones that break.
 */

import { move, columnsOf, motionFor } from "../src/util/roving";

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

/* ---- an empty grid has nowhere to go ---- */

eq(move(0, "right", 0, 4), -1, "no items means no selection");
eq(move(0, "down", 0, 4), -1, "whichever way you press");

/* ---- along a row ---- */

// 8 items, 4 across:  0 1 2 3
//                     4 5 6 7
eq(move(0, "right", 8, 4), 1, "right moves one along");
eq(move(1, "left", 8, 4), 0, "left moves one back");

// A grid reads like text: the item after the end of a row is the start of the
// next one, not nothing.
eq(move(3, "right", 8, 4), 4, "right wraps to the next row");
eq(move(4, "left", 8, 4), 3, "and left wraps back up");

// The extremes stop rather than cycling — arriving at the last poster by
// pressing right from the first would be disorienting.
eq(move(0, "left", 8, 4), 0, "left on the first item stays");
eq(move(7, "right", 8, 4), 7, "right on the last item stays");

/* ---- between rows ---- */

eq(move(0, "down", 8, 4), 4, "down moves a full row");
eq(move(4, "up", 8, 4), 0, "up moves a full row back");

// Vertical deliberately does not wrap: the eye follows a column, and falling
// off the bottom into the top reads as the list scrolling under you.
eq(move(1, "up", 8, 4), 1, "up on the top row stays put");

/* ---- the short last row ---- */

// 6 items, 4 across:  0 1 2 3
//                     4 5
// Pressing down from 2 has no item directly below it. Doing nothing would
// make the last two titles unreachable from the row above.
eq(move(2, "down", 6, 4), 5, "down from a column with nothing below lands on the last item");
eq(move(5, "down", 6, 4), 5, "and the last item stays put");
eq(move(4, "up", 6, 4), 0, "up from the short row still works");

/* ---- a one-column grid ---- */

// What a narrow pane produces. Down must still advance by one, or the
// keyboard stops working entirely on a phone-width window.
eq(move(0, "down", 4, 1), 1, "down advances by one when there is one column");
eq(move(3, "down", 4, 1), 3, "and stops at the end");
eq(move(1, "up", 4, 1), 0, "up goes back one");
// Zero columns is a caller bug — a grid measured before layout — and must not
// produce a NaN index.
eq(move(1, "down", 4, 0), 2, "zero columns is treated as one");

/* ---- jumping ---- */

eq(move(5, "home", 8, 4), 0, "home goes to the first");
eq(move(2, "end", 8, 4), 7, "end goes to the last");

/* ---- a stale index ---- */

// The caller can hold an index from before the list shrank. Landing somewhere
// sensible beats losing the selection.
eq(move(99, "left", 8, 4), 6, "an index past the end is clamped first");
eq(move(-5, "right", 8, 4), 1, "and so is a negative one");

/* ---- counting columns from layout ---- */

// Read from the laid-out elements rather than the CSS, because the grid is
// auto-fill and the count changes with the pane width.
eq(columnsOf([]), 1, "no items is one column");
eq(columnsOf([0, 0, 0, 0, 200, 200, 200, 200]), 4, "four items share the first row");
eq(columnsOf([0, 200, 400]), 1, "a single column when every item is on its own row");
// Sub-pixel layout means two items on one row rarely report equal offsets.
eq(columnsOf([0, 0.5, 1.4, 180]), 3, "a small difference is still the same row");
eq(columnsOf([0, 0, 0]), 3, "every item on one row");

/* ---- which keys are ours ---- */

eq(motionFor("ArrowLeft"), "left", "arrows work");
eq(motionFor("j"), "down", "and so does vim's j");
eq(motionFor("k"), "up", "and k");
eq(motionFor("h"), "left", "and h");
eq(motionFor("l"), "right", "and l");
eq(motionFor("Home"), "home", "home");
eq(motionFor("End"), "end", "end");
// Anything else has to fall through untouched, or the grid swallows typing.
eq(motionFor("a"), null, "an ordinary letter is not a motion");
eq(motionFor("Enter"), null, "nor is Enter, which means open");
eq(motionFor("/"), null, "nor slash, which means search");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
