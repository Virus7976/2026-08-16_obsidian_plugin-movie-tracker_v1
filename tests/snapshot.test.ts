/**
 * A snapshot from the device must survive the trip into the harness.
 *
 * The fixture below is synthetic, but its numbers are not invented: 384×823
 * with a 379px pane is what the diagnostics command actually reported from the
 * user's phone. The chrome boxes are the shape `uiSnapshot()` emits.
 *
 * What this proves: the parser reads the format, and the covered-control lines
 * survive — that last one is the line that would have caught an untappable
 * search field long before anything else did.
 *
 * What it does not prove: that any of it matches a real device. No snapshot has
 * been taken from one yet.
 */
import { parseSnapshot, snapshotParams } from "../harness/snapshot";

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

const SAMPLE = `=== Reel UI snapshot ===
viewport: 384×823  dpr: 2.75
platform: phone=true mobile=true desktop=false
theme: dark
body classes: theme-dark is-mobile is-phone

-- Obsidian chrome --
.view-header: x=0 y=0 w=384 h=48 pos=fixed z=10
.workspace-tab-header-container: absent
.mobile-toolbar: x=0 y=775 w=384 h=48 pos=fixed z=15
.status-bar: absent
.view-content: x=0 y=0 w=379 h=823 pos=relative z=auto

-- Covered controls (visible but not tappable) --
input.reel-input.reel-search-input (327×34 at 12,34) is under div.view-header
button.reel-search-clear (44×44 at 331,34) is under div.view-header

-- Tree (412 rendered elements) --
div.reel-view.is-phone  379×823 @0,0  [ovx=hidden]
`;

const s = parseSnapshot(SAMPLE);

eq("viewport width", s.width, 384);
eq("viewport height", s.height, 823);
eq("theme", s.dark, true);
eq("platform", s.phone, true);

// The whole point: the chrome numbers come from the device, not a guess.
eq("header reaches 48px into the view", s.chrome.top, 48);
eq("toolbar reaches 48px up from the bottom", s.chrome.bottom, 48);

eq("both covered controls survive", s.covered.length, 2);
eq("the covered control is named", s.covered[0].what, "input.reel-input.reel-search-input");
eq("and so is what covers it", s.covered[0].by, "div.view-header");

const params = snapshotParams(s);
eq("params carry the chrome", params.includes("chromeTop=48"), true);
eq("params carry the theme", params.includes("dark=1"), true);

/* ---- tolerance: the format will drift, and must not take the parser with it */

const MINIMAL = "=== Reel UI snapshot ===\nviewport: 375×812  dpr: 2\ntheme: light\n";
const m = parseSnapshot(MINIMAL);
eq("a snapshot with no chrome section still parses", m.width, 375);
eq("missing chrome means no inset, not a crash", m.chrome.top, 0);
eq("missing platform defaults to not-phone", m.phone, false);

const GARBAGE = parseSnapshot("nothing useful here at all");
eq("an unparseable dump falls back to a phone shape", GARBAGE.width, 375);
eq("and does not throw", GARBAGE.chrome.bottom, 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
