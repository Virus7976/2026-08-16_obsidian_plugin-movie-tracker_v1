/**
 * Empty states.
 *
 * Every one of these was a line of grey text: "Nothing in progress. Add a
 * series and tick an episode." Accurate, and the worst screen in the app —
 * it is the first thing a new user sees on most tabs, it explains what to do
 * without offering any way to do it, and a sentence floating in an empty pane
 * reads as a page that failed rather than one that is waiting.
 *
 * The shape here is an icon, a short line about the state, an optional
 * sentence of why, and — the part that matters — a button that does the thing
 * the sentence describes. If a screen can tell you what to do next, it can do
 * it for you.
 */

import { setIcon } from "obsidian";

export interface EmptyAction {
	label: string;
	/** Marks the one action that is the obvious next step. */
	primary?: boolean;
	onClick: () => void;
}

export interface EmptyOptions {
	/** A Lucide icon name — Obsidian ships the set, so no asset is needed. */
	icon: string;
	/** One short line. The state, not an apology for it. */
	title: string;
	/** Optional second line: why it is empty, or what fills it. */
	body?: string;
	actions?: EmptyAction[];
}

export function renderEmpty(parent: HTMLElement, opts: EmptyOptions): HTMLElement {
	const wrap = parent.createDiv({ cls: "reel-empty-state" });

	// Decorative — the title beside it already says everything this conveys,
	// so announcing it again would just be noise to a screen reader.
	const icon = wrap.createDiv({ cls: "reel-empty-icon", attr: { "aria-hidden": "true" } });
	setIcon(icon, opts.icon);

	wrap.createDiv({ cls: "reel-empty-title", text: opts.title });
	if (opts.body) wrap.createDiv({ cls: "reel-empty-body", text: opts.body });

	if (opts.actions?.length) {
		const row = wrap.createDiv({ cls: "reel-empty-actions" });
		for (const action of opts.actions) {
			const btn = row.createEl("button", {
				cls: `reel-btn${action.primary ? " mod-cta" : ""}`,
				text: action.label,
				attr: { type: "button" },
			});
			btn.addEventListener("click", action.onClick);
		}
	}
	return wrap;
}
