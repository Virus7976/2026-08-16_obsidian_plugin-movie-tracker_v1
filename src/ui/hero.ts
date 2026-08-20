/**
 * The band of artwork a screen wears at the top.
 *
 * The detail screen has taken its atmosphere from a poster since it was built.
 * Stats got the same treatment last release, and the difference was the whole
 * of "one page looks designed and the other looks like a spreadsheet" — from
 * identical material, since every one of these screens already knows every
 * poster in your library.
 *
 * This is that band, extracted, because "continue this theme across every tab"
 * is a promise a copied block cannot keep: four copies drift into four
 * slightly different heroes, and the one you build next has none at all.
 *
 * Two decisions worth stating, both learned from getting them wrong:
 *
 *   A real backdrop and a blurred poster are different materials. A backdrop is
 *   a photograph and takes 2px of blur; a poster is a texture and takes 28px.
 *   Blurring a pale poster lightly produces fog, which reads as an image that
 *   failed to load rather than as atmosphere.
 *
 *   The scrim is not decoration. Without it the text is legible over a dark
 *   poster and invisible over a pale one, and half of any library is pale.
 */

import type ReelPlugin from "../main";
import type { Entry } from "../types";

export interface HeroOptions {
	/** The small uppercase line — "All time", "Your library", "Tonight". */
	label: string;
	/** The headline. Usually a count, which is why it is tabular. */
	title: string;
	/** One quiet line under it. Ellipsised, never wrapped. */
	sub?: string;
	/**
	 * The title whose artwork the band wears.
	 *
	 * Undefined is a legitimate answer — an empty library has nothing to wear —
	 * and the band then renders as plain type rather than as a grey rectangle
	 * pretending an image is on its way.
	 */
	subject?: Entry;
	/**
	 * Tint the whole screen from the subject's poster, not just the band.
	 *
	 * On by default: the accent is what carries the artwork's colour down into
	 * the chips and headings below, and a band that is the only tinted thing on
	 * the page reads as a stuck banner rather than as the page's own colour.
	 */
	tint?: boolean;
	/**
	 * Short, for a band that introduces content rather than being it.
	 *
	 * Stats is a summary — there the band *is* the page's opening statement and
	 * 132px is earned. On the Library the posters are what you came for, and the
	 * audit said so in the plainest terms available: adding the tall band pushed
	 * the chrome above the first poster to 48% of the screen, past the 45% ceiling
	 * set after that exact fight was had once already.
	 *
	 * So the rule is not "how important is this screen" but "is this band the
	 * content or the label on it".
	 */
	compact?: boolean;
}

/** Escape a vault resource path for use inside a CSS `url("…")`. */
export function cssUrl(path: string): string {
	return path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function paintHero(plugin: ReelPlugin, el: HTMLElement, opts: HeroOptions): HTMLElement {
	const band = el.createDiv({ cls: opts.compact ? "reel-hero-band is-compact" : "reel-hero-band" });
	const subject = opts.subject;

	if (subject) {
		const local = plugin.posters.displayUrl(subject);
		const remote = subject.backdropPath ? plugin.tmdb.posterUrl(subject.backdropPath, "w780") : null;

		if (local || remote) {
			band.addClass("has-backdrop");
			band.toggleClass("has-art", !!remote);
			const wrap = band.createDiv({ cls: "reel-hero-art" });
			if (local) {
				wrap
					.createDiv({ cls: "reel-hero-art-base" })
					.setCssProps({ "--reel-backdrop": `url("${cssUrl(local)}")` });
			}
			if (remote) {
				// Lazy and async: the band is above the fold, but it is
				// decoration, and it must never be what the first paint waits on.
				wrap.createEl("img", {
					cls: "reel-hero-art-img",
					attr: { src: remote, alt: "", loading: "lazy", decoding: "async" },
				});
			}
		}

		// The same colour the detail screen pulls, so every screen agrees about
		// what this title looks like.
		if (opts.tint !== false) {
			plugin.swatches.tint(el, plugin.posters.displayUrl(subject), document.body.hasClass("theme-dark"));
		}
	}

	const line = band.createDiv({ cls: "reel-hero-band-body" });
	line.createDiv({ cls: "reel-hero-band-label", text: opts.label });
	line.createDiv({ cls: "reel-hero-band-title", text: opts.title });
	if (opts.sub) line.createDiv({ cls: "reel-hero-band-sub", text: opts.sub });
	return band;
}

/**
 * The title a screen should wear, given what it is showing.
 *
 * Most recently watched, falling back to the highest rated, falling back to
 * whatever is there. A screen about what you have been watching should be
 * wearing what you have been watching, and the fallbacks matter because a
 * watchlist-only library has no viewing history at all — that is exactly the
 * case where a grey header would be most discouraging.
 */
export function heroSubject(entries: Entry[]): Entry | undefined {
	let newest: Entry | undefined;
	let newestDate = "";
	for (const e of entries) {
		for (const w of e.watched) {
			if (typeof w.date === "string" && w.date > newestDate) {
				newestDate = w.date;
				newest = e;
			}
		}
	}
	if (newest) return newest;

	const rated = entries.filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
	// A poster is the point, so prefer something that has one.
	return rated[0] ?? entries.find((e) => e.poster || e.posterUrl) ?? entries[0];
}
