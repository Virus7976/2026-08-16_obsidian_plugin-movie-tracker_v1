/**
 * Replay a device snapshot as harness conditions.
 *
 * Four layout bugs were reported from a phone and none reproduced here, because
 * the harness has only ever modelled a device it has never seen. `Copy UI
 * snapshot` in the app produces a text dump of the real thing: viewport,
 * platform flags, and — the part that matters — where Obsidian's own chrome
 * actually sits, which is what the app has repeatedly got wrong.
 *
 * This parses that dump and reconfigures the harness to match, so a snapshot
 * becomes a fixture and a fixture becomes a permanent check.
 *
 * **This is unproven.** No snapshot from a real device exists yet — nine
 * releases have been built and none has reached the phone. It is tested against
 * a synthetic fixture built from the one set of real numbers available, the
 * diagnostics output the user pasted: a 384×823 window reporting a 379px pane.
 * Until a real snapshot is replayed, this is scaffolding that compiles and
 * parses, not evidence about anybody's device.
 */

/** What the harness needs in order to imitate a device. */
export interface Snapshot {
	width: number;
	height: number;
	dark: boolean;
	phone: boolean;
	/** Obsidian's chrome, as measured on the device rather than assumed. */
	chrome: { top: number; bottom: number };
	/** Controls the device reported as covered, and by what. */
	covered: { what: string; by: string }[];
}

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;

/**
 * Parse the text `uiSnapshot()` produces.
 *
 * Deliberately tolerant: the format is a human-readable dump that will drift as
 * it gains fields, and a parser that throws on an unexpected line would make
 * every future snapshot useless. Anything unrecognised is skipped; anything
 * missing falls back to a phone-shaped default, which is the safe direction.
 */
export function parseSnapshot(text: string): Snapshot {
	const viewport = new RegExp(`viewport:\\s*${NUM}[×x]${NUM}`).exec(text);
	const width = viewport ? Math.round(Number(viewport[1])) : 375;
	const height = viewport ? Math.round(Number(viewport[2])) : 812;

	const dark = /theme:\s*dark/.test(text);
	const phone = /phone=true/.test(text);

	// The chrome lines look like:
	//   .view-header: x=0 y=0 w=384 h=48 pos=fixed z=10
	const box = (selector: string): { top: number; bottom: number } | null => {
		const re = new RegExp(`${selector.replace(/[.\\]/g, "\\$&")}:\\s*x=${NUM}\\s+y=${NUM}\\s+w=${NUM}\\s+h=${NUM}`);
		const m = re.exec(text);
		if (!m) return null;
		const y = Number(m[2]);
		const h = Number(m[4]);
		return { top: y, bottom: y + h };
	};

	const header = box(".view-header");
	const toolbar = box(".mobile-toolbar") ?? box(".mobile-navbar");

	// How far each reaches *into* the view, which is the only number the layout
	// needs. A header that stacks properly above the content contributes zero.
	const top = header ? Math.max(0, Math.round(header.bottom)) : 0;
	const bottom = toolbar ? Math.max(0, Math.round(height - toolbar.top)) : 0;

	// "reel-input under view-header" — the line that would have caught the
	// untappable search field months earlier than anything else did.
	const covered: { what: string; by: string }[] = [];
	for (const line of text.split("\n")) {
		const m = /^(\S+).*\bis under\s+(\S+)/.exec(line.trim());
		if (m) covered.push({ what: m[1], by: m[2] });
	}

	return { width, height, dark, phone, chrome: { top, bottom }, covered };
}

/**
 * Turn a snapshot into the harness's own URL parameters.
 *
 * Returned rather than applied, so the runner can drive a real browser at the
 * right viewport — a page cannot resize its own window, and pretending
 * otherwise would produce a fixture that measures the wrong thing.
 */
export function snapshotParams(s: Snapshot): string {
	return [
		"audit=1",
		`phone=${s.phone ? 1 : 0}`,
		`dark=${s.dark ? 1 : 0}`,
		`chromeTop=${s.chrome.top}`,
		`chromeBottom=${s.chrome.bottom}`,
	].join("&");
}
