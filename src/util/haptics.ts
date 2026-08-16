/**
 * Haptics.
 *
 * A 10 ms tick when a star lands or an episode ticks is most of the
 * difference between "web page" and "app" on a phone. It costs nothing, it
 * cannot fail loudly, and it fires at the moment the screen confirms
 * something — which is when the hand expects it.
 *
 * Two honest limits, stated up front rather than discovered later:
 *
 *   iOS has no Vibration API in Safari or in any WKWebView, which is what
 *   Obsidian on iOS is. There is no workaround short of a native shell, so on
 *   an iPhone every call here is a no-op. That is not a bug to chase.
 *
 *   Android is subject to the user's own system setting and to whether the
 *   page has been interacted with. `vibrate()` returning false is normal, not
 *   an error, so nothing here reports anything.
 *
 * Deliberately short. Anything long enough to notice as a buzz rather than a
 * tick is the phone interrupting you, which is the opposite of what a
 * confirmation should feel like.
 */

import { Platform } from "obsidian";

/** How long each kind of confirmation buzzes for, in milliseconds. */
const PATTERNS = {
	/** A value landed: a star, an episode tick, a toggle. */
	tick: 10,
	/** Something was created or removed — a heavier event, so a heavier tap. */
	commit: 18,
	/** A long-press crossed its threshold and a menu is about to appear. */
	hold: 22,
} as const;

export type Haptic = keyof typeof PATTERNS;

/**
 * Buzz, if the platform and the user allow it.
 *
 * Never throws. A phone with vibration disabled, a desktop, an iPhone and a
 * browser that has never been touched all take the same path out — silently,
 * because a tracker that logged a warning every time you rated something
 * would be worse than one that stays quiet.
 */
export function haptic(kind: Haptic = "tick"): void {
	// Desktop has no business vibrating anything, and some laptops do expose a
	// `vibrate` that does nothing but cost a call.
	if (!Platform.isMobile) return;
	// Someone who has asked the OS to reduce motion has usually asked for less
	// of exactly this sort of thing too.
	if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

	try {
		navigator.vibrate?.(PATTERNS[kind]);
	} catch {
		// Permissions policy, an iOS WKWebView, a user setting. All fine.
	}
}
