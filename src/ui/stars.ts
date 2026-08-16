/**
 * Tap-to-set star widget, 5 stars with halves.
 *
 * Each star is one 44px target split down the middle: the left half sets the
 * half value, the right half sets the whole. That gives ten reachable values
 * without a slider, which is the only control that reliably works one-thumbed.
 * Tapping the value you already have clears it back to none.
 */

import { clampRating, MAX_STARS } from "../util/ratings";

export interface StarsOptions {
	value?: number;
	readonly?: boolean;
	onChange?: (value: number | undefined) => void;
}

export function renderStars(parent: HTMLElement, opts: StarsOptions = {}): HTMLElement {
	const root = parent.createDiv({ cls: "reel-stars" });
	if (opts.readonly) root.addClass("is-readonly");
	let value = opts.value != null ? clampRating(opts.value) : undefined;

	const paint = () => {
		root.setAttr("aria-label", value ? `${value} out of 5` : "No rating");
		root.findAll(".reel-star").forEach((star, i) => {
			const index = i + 1;
			const filled = value != null && value >= index;
			const half = value != null && !filled && value >= index - 0.5;
			star.toggleClass("is-full", filled);
			star.toggleClass("is-half", half);
		});
	};

	for (let i = 1; i <= MAX_STARS; i++) {
		const star = root.createDiv({ cls: "reel-star" });
		star.createSpan({ cls: "reel-star-bg", text: "★" });
		star.createSpan({ cls: "reel-star-fg", text: "★" });

		if (opts.readonly) continue;

		star.setAttr("role", "button");
		star.setAttr("tabindex", "0");

		const pick = (clientX: number) => {
			const rect = star.getBoundingClientRect();
			const isLeftHalf = clientX - rect.left < rect.width / 2;
			const next = isLeftHalf ? i - 0.5 : i;
			// Tapping the current value clears it — the only way back to "unrated".
			value = value === next ? undefined : next;
			paint();
			opts.onChange?.(value);
		};

		star.addEventListener("click", (e) => pick(e.clientX));
		star.addEventListener("keydown", (e) => {
			if (e.key !== "Enter" && e.key !== " ") return;
			e.preventDefault();
			const rect = star.getBoundingClientRect();
			pick(rect.left + rect.width * 0.75);
		});
	}

	paint();
	return root;
}

/** Static display version — header cards, grid overlays, Up Next rows. */
export function renderStarsStatic(parent: HTMLElement, value: number | undefined): HTMLElement {
	return renderStars(parent, { value, readonly: true });
}
