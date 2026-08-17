/**
 * Making non-button things behave like buttons, once.
 *
 * Fourteen places built a clickable element out of a div and hand-wrote the
 * same three lines: set `role`, set `tabindex`, listen for a key. They had
 * already drifted — some handled Enter, some Enter and Space, some called
 * `preventDefault` and some did not, so a poster in the grid and the same
 * poster in the row list answered the keyboard differently.
 *
 * The obvious alternative is to use real `<button>` elements, which get all
 * of this for free. I have not done that here, and the reason is worth
 * stating rather than leaving as an oddity: these are grid cells, table-ish
 * rows and cards whose layout depends on being plain boxes, and a button
 * brings its own user-agent display, padding and font behaviour that would
 * have to be unset everywhere. Swapping them is the better end state, but it
 * is a visual change to every list in the app and it needs to be looked at on
 * a device rather than reasoned about. Centralising the behaviour removes the
 * drift now, and makes that swap a change in one file later.
 */

export interface ClickableOptions {
	/** What a screen reader announces. Required — an unlabelled control is a dead end. */
	label: string;
	onActivate: () => void;
	/**
	 * `option` for something in a set where exactly one wins — a tab, a
	 * filter. `button` for an action.
	 */
	kind?: "button" | "option";
}

/**
 * Make an element operable by mouse, keyboard and assistive technology.
 *
 * Space is handled as well as Enter, and both call `preventDefault` — Space
 * on a focused non-input scrolls the page, so a keyboard user selecting a
 * poster would jump down a screen at the same time.
 */
export function clickable(el: HTMLElement, opts: ClickableOptions): HTMLElement {
	el.setAttr("role", opts.kind === "option" ? "tab" : "button");
	el.setAttr("tabindex", "0");
	el.setAttr("aria-label", opts.label);

	el.addEventListener("click", () => opts.onActivate());
	el.addEventListener("keydown", (ev: KeyboardEvent) => {
		if (ev.key !== "Enter" && ev.key !== " ") return;
		ev.preventDefault();
		opts.onActivate();
	});
	return el;
}

/**
 * Say which one is selected, not just colour it.
 *
 * The active tab and every filter chip were distinguished by background
 * colour alone. To anyone using a screen reader the whole filter bar read as
 * a row of identical buttons, and to anyone who cannot separate those two
 * colours it looked the same way.
 *
 * `aria-current` for navigation — which tab am I on — and `aria-pressed` for
 * a filter that is on or off. They are not interchangeable: `aria-pressed`
 * on a tab announces "pressed" rather than "current page", which describes
 * the wrong thing.
 */
export function setSelected(el: HTMLElement, on: boolean, kind: "tab" | "toggle" = "toggle"): void {
	el.toggleClass("is-active", on);
	if (kind === "tab") {
		// Removed rather than set to "false": aria-current="false" is valid but
		// noisier than absence, and absence is what the spec expects.
		if (on) el.setAttr("aria-current", "page");
		else el.removeAttribute("aria-current");
		return;
	}
	el.setAttr("aria-pressed", on ? "true" : "false");
}
