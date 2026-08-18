/**
 * A picture of the whole app's layout, in text.
 *
 * Four layout bugs have now been reported from a phone and none of them
 * reproduced in the harness, because the harness models a device it has never
 * seen. Screenshots show what a screen *looks* like; they do not say which
 * element is on top of which, what the computed overflow is, or why a control
 * that is plainly visible cannot be tapped. That last one cost several
 * releases: the search field was drawn under Obsidian's own header, and every
 * check passed it because they all ask about size and position and none asks
 * "is something covering this".
 *
 * So this walks the entire document — Obsidian's chrome included, since that is
 * where the collisions come from — and records geometry, stacking, overflow and
 * occlusion. It is deliberately not limited to `.reel-view`: the bugs live at
 * the seam between Reel and the app around it.
 *
 * On privacy: this is the user's own screen, pasted by them, so labels and
 * titles are kept because removing them would defeat the purpose. What is never
 * emitted is anything that could be a credential — password fields, any input
 * whose name suggests a key, and the whole output passes through `redact()`.
 */
import { Platform } from "obsidian";
import { redact } from "../secrets";

/** Cap the walk. A snapshot nobody can paste is a snapshot nobody sends. */
const MAX_NODES = 900;

/** Inputs whose value must never leave the device. */
const SECRET_HINT = /key|token|secret|pass|api/i;

interface Node {
	depth: number;
	tag: string;
	cls: string;
	x: number;
	y: number;
	w: number;
	h: number;
	text: string;
	/** Non-static positioning, stacking and clipping — the layout's real rules. */
	pos: string;
	z: string;
	ovx: string;
	ovy: string;
	/** What `elementFromPoint` returns at this element's centre, when not itself. */
	coveredBy: string;
}

/** A short, readable identity for an element. */
function name(el: Element): string {
	const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
	return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
}

/**
 * Text worth recording: a label, not an essay.
 *
 * Only the element's *own* text, so a container does not repeat everything
 * beneath it, and never the value of anything that smells like a credential.
 */
function ownText(el: Element): string {
	if (el instanceof HTMLInputElement) {
		if (el.type === "password") return "«password»";
		const hint = `${el.name} ${el.id} ${el.placeholder} ${el.className}`;
		if (SECRET_HINT.test(hint)) return `«withheld: ${el.placeholder || el.type}»`;
		return el.value ? `value=${el.value.slice(0, 40)}` : el.placeholder ? `placeholder=${el.placeholder}` : "";
	}
	let out = "";
	for (const n of Array.from(el.childNodes)) {
		if (n.nodeType === 3) out += n.nodeValue ?? "";
	}
	out = out.replace(/\s+/g, " ").trim();
	return out.length > 48 ? `${out.slice(0, 48)}…` : out;
}

/**
 * Is something else drawn over this element's centre?
 *
 * `elementFromPoint` answers the question a tap asks. If it comes back with an
 * element that is neither this one nor inside it, the user's finger will land
 * on that instead — which is precisely, and undetectably, what was happening to
 * the search field.
 */
function occludedBy(el: Element, rect: DOMRect): string {
	if (rect.width < 2 || rect.height < 2) return "";
	const cx = rect.left + rect.width / 2;
	const cy = rect.top + rect.height / 2;
	if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return "off-screen";
	const hit = document.elementFromPoint(cx, cy);
	if (!hit || hit === el || el.contains(hit)) return "";
	// A descendant of the element covering it is still the element.
	if (hit.contains(el)) return "";
	return name(hit);
}

/** Walk the document, recording only what is actually rendered. */
function collect(): Node[] {
	const out: Node[] = [];
	const walk = (el: Element, depth: number): void => {
		if (out.length >= MAX_NODES) return;
		const cs = getComputedStyle(el);
		if (cs.display === "none" || cs.visibility === "hidden") return;
		const rect = el.getBoundingClientRect();
		// Zero-area elements are recorded only if they have children worth
		// reaching; they carry no layout information themselves.
		if (rect.width > 0 && rect.height > 0) {
			out.push({
				depth,
				tag: el.tagName.toLowerCase(),
				cls: typeof el.className === "string" ? el.className : "",
				x: Math.round(rect.left),
				y: Math.round(rect.top),
				w: Math.round(rect.width),
				h: Math.round(rect.height),
				text: ownText(el),
				pos: cs.position,
				z: cs.zIndex,
				ovx: cs.overflowX,
				ovy: cs.overflowY,
				coveredBy: occludedBy(el, rect),
			});
		}
		for (const child of Array.from(el.children)) walk(child, depth + 1);
	};
	walk(document.body, 0);
	return out;
}

/** Interactive things a finger is meant to be able to reach. */
const TAPPABLE = 'button, input, select, textarea, a, [role="button"], [contenteditable="true"], .clickable-icon';

/**
 * Render the snapshot as text a person can read and an agent can parse.
 *
 * An indented tree rather than raw JSON: the nesting is the point, and the
 * thing being diagnosed is usually visible at a glance in the indentation.
 */
export function uiSnapshot(): string {
	const nodes = collect();
	const lines: string[] = [];

	lines.push("=== Reel UI snapshot ===");
	lines.push(`viewport: ${window.innerWidth}×${window.innerHeight}  dpr: ${window.devicePixelRatio}`);
	lines.push(`platform: phone=${Platform.isPhone} mobile=${Platform.isMobile} desktop=${Platform.isDesktop}`);
	lines.push(`theme: ${document.body.classList.contains("theme-dark") ? "dark" : "light"}`);
	lines.push(`body classes: ${document.body.className}`);

	// Obsidian's own chrome, called out first — it is where the collisions are,
	// and its sizes are the ones Reel has been guessing at.
	lines.push("", "-- Obsidian chrome --");
	for (const sel of [
		".view-header",
		".workspace-tab-header-container",
		".mobile-toolbar",
		".mobile-navbar",
		".status-bar",
		".workspace-drawer.mod-left",
		".workspace-drawer.mod-right",
		".workspace-leaf-content",
		".view-content",
	]) {
		const el = document.querySelector(sel);
		if (!el) {
			lines.push(`${sel}: absent`);
			continue;
		}
		const r = el.getBoundingClientRect();
		const cs = getComputedStyle(el);
		lines.push(
			`${sel}: x=${Math.round(r.left)} y=${Math.round(r.top)} w=${Math.round(r.width)} h=${Math.round(r.height)} pos=${cs.position} z=${cs.zIndex}`
		);
	}

	// Anything a finger is supposed to reach, and whether it actually can.
	lines.push("", "-- Covered controls (visible but not tappable) --");
	const covered: string[] = [];
	for (const el of Array.from(document.querySelectorAll(TAPPABLE))) {
		const r = el.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) continue;
		const by = occludedBy(el, r);
		if (by && by !== "off-screen") {
			covered.push(`${name(el)} (${Math.round(r.width)}×${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)}) is under ${by}`);
		}
	}
	lines.push(covered.length ? covered.join("\n") : "none — every control is reachable");

	lines.push("", `-- Tree (${nodes.length} rendered elements${nodes.length >= MAX_NODES ? ", truncated" : ""}) --`);
	for (const n of nodes) {
		const pad = "  ".repeat(Math.min(n.depth, 12));
		const cls = n.cls ? `.${n.cls.trim().split(/\s+/).join(".")}` : "";
		const extra: string[] = [];
		if (n.pos !== "static") extra.push(`pos=${n.pos}`);
		if (n.z !== "auto") extra.push(`z=${n.z}`);
		if (n.ovx !== "visible") extra.push(`ovx=${n.ovx}`);
		if (n.ovy !== "visible") extra.push(`ovy=${n.ovy}`);
		if (n.coveredBy) extra.push(`COVERED-BY ${n.coveredBy}`);
		const tail = extra.length ? `  [${extra.join(" ")}]` : "";
		const txt = n.text ? `  "${n.text}"` : "";
		lines.push(`${pad}${n.tag}${cls}  ${n.w}×${n.h} @${n.x},${n.y}${tail}${txt}`);
	}

	// Belt and braces: nothing that looks like a credential leaves here, even
	// if it reached the DOM by a route this file does not know about.
	return redact(lines.join("\n"));
}
