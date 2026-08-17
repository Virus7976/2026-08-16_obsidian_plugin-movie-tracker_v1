/**
 * Your opinion of a person, shown wherever that person appears.
 *
 * Rating an actor or a director was already possible — it lives in
 * `settings.people`, keyed by TMDB person id — but it was only ever visible
 * on the screen where you set it. Everywhere else the same person appeared
 * with no sign you had an opinion at all, which makes the rating feel like it
 * went nowhere.
 *
 * Keyed by id rather than name throughout, because two people genuinely do
 * share a name and putting one person's rating under another's face is the
 * kind of error nobody would ever think to check for.
 */

import type ReelPlugin from "../main";
import type { PersonOpinion } from "../settings";

/** What you think of someone, if anything. */
export function opinionOf(plugin: ReelPlugin, personId: number | undefined): PersonOpinion | null {
	if (!personId) return null;
	const held = plugin.settings.people?.[String(personId)];
	if (!held) return null;
	// An entry can exist with neither a rating nor a like — set once and
	// cleared. That is not an opinion, and badging it would be noise.
	if (held.rating == null && !held.liked) return null;
	return held;
}

/** The same lookup by name, for the surfaces that only carry one. */
export function opinionByName(plugin: ReelPlugin, name: string): PersonOpinion | null {
	return opinionOf(plugin, plugin.library.peopleIds().get(name));
}

/**
 * Mark a person's portrait with what you think of them.
 *
 * Deliberately small and corner-mounted rather than a row of stars: these sit
 * on 34–70px circles in dense strips, and anything larger would cover the
 * face it is describing. The number is the whole message.
 *
 * The container must be positioned — every caller here is already a
 * `position: relative` avatar box, and the badge class asserts it in CSS
 * rather than relying on that being remembered.
 */
export function attachOpinion(el: HTMLElement, opinion: PersonOpinion | null): void {
	if (!opinion) return;
	el.addClass("has-opinion");

	if (opinion.rating != null) {
		const badge = el.createDiv({ cls: "reel-person-badge", text: String(opinion.rating) });
		badge.setAttr("aria-label", `You rated ${opinion.name} ${opinion.rating} out of 5`);
		return;
	}

	// Liked but unrated. A heart rather than a blank badge, since "I like them"
	// is a real answer and not a missing number.
	const badge = el.createDiv({ cls: "reel-person-badge is-liked", text: "♥" });
	badge.setAttr("aria-label", `You like ${opinion.name}`);
}

/** Convenience: look up and attach in one call, where the id is to hand. */
export function badgePerson(plugin: ReelPlugin, el: HTMLElement, personId: number | undefined): void {
	attachOpinion(el, opinionOf(plugin, personId));
}
