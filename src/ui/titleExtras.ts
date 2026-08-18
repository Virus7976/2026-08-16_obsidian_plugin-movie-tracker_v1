/**
 * The three things you need to decide about a title, in one place.
 *
 * A trailer, direct links to IMDb and its parents guide, and the cast with
 * your own opinion of them attached. These lived as private methods on
 * `PreviewSheet`, which meant the sheet was the only screen that had them —
 * and the sheet is the screen you reach *after* deciding to look closer. Quick
 * mode, where decisions actually get made, had none of it.
 *
 * Shared rather than copied, so the three surfaces cannot drift into three
 * slightly different answers to the same question.
 */

import type ReelPlugin from "../main";
import type { TmdbFilm, TmdbShow } from "../types";
import { imdbUrl, tmdbUrl, trailerUrl } from "../extract";
import { opinionOf } from "./personBadge";

/**
 * The trailer, playable in place.
 *
 * Click-to-load rather than an iframe on arrival: an embed that mounts itself
 * costs a YouTube request and a set of cookies for every card you so much as
 * glance at, and most of them you close again. The poster frame is free, and
 * one tap is a fair price for the thing you asked for.
 */
export function paintTrailer(slot: HTMLElement, url: string): void {
	const id = /[?&]v=([\w-]{6,})/.exec(url)?.[1] ?? /youtu\.be\/([\w-]{6,})/.exec(url)?.[1];
	if (!id) {
		const link = slot.createEl("a", { cls: "reel-btn mod-cta reel-trailer-btn", text: "▶  Watch trailer", href: url });
		link.setAttr("target", "_blank");
		link.setAttr("rel", "noopener");
		return;
	}

	const box = slot.createDiv({ cls: "reel-trailer" });
	const play = box.createEl("button", { cls: "reel-trailer-play", attr: { type: "button" } });
	// YouTube's own still, so the placeholder is the actual first frame rather
	// than a grey rectangle.
	play.createEl("img", { attr: { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: "", loading: "lazy" } });
	play.createDiv({ cls: "reel-trailer-icon", text: "▶" });
	play.setAttr("aria-label", "Play the trailer");
	play.addEventListener("click", () => {
		const frame = box.createEl("iframe", {
			cls: "reel-trailer-frame",
			attr: {
				src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
				title: "Trailer",
				allow: "accelerometer; autoplay; encrypted-media; picture-in-picture",
				allowfullscreen: "true",
				frameborder: "0",
			},
		});
		play.remove();
		frame.focus();
	});
}

/**
 * IMDb, its parents guide, and TMDB — as links, never as searches.
 *
 * The parents guide needs an IMDb id, which a search result does not carry;
 * it arrives only on the detail payload. "Search IMDb for this title" is a
 * different and much worse thing than a direct link, so when the id is missing
 * the links are simply absent.
 */
export function paintLinks(slot: HTMLElement, meta: TmdbFilm | TmdbShow, isTv: boolean): void {
	const row = slot.createDiv({ cls: "reel-preview-links" });
	const link = (text: string, href: string): void => {
		const a = row.createEl("a", { cls: "reel-chip", text, href });
		a.setAttr("target", "_blank");
		a.setAttr("rel", "noopener");
	};

	const raw = meta.external_ids?.imdb_id ?? (meta as TmdbFilm).imdb_id ?? undefined;
	const imdb = imdbUrl(raw ?? undefined);
	if (imdb) {
		link("IMDb", imdb);
		link("Parents guide", `${imdb}parentalguide`);
	}
	link("TMDB", tmdbUrl(meta.id, isTv ? "tv" : "film"));
}

/**
 * The cast, carrying whatever you already think of them.
 *
 * Rating an actor was possible before and visible only on the screen where you
 * set it, which makes the rating feel like it went nowhere. Here it is on the
 * face, at the moment it is useful: "four stars, and he is in this" is most of
 * a decision.
 *
 * Films carry `credits`; a series carries `aggregate_credits`, because an
 * actor can play several parts across a run and TMDB merges them. Reading the
 * wrong one gives an empty list and no error.
 */
export function paintCast(plugin: ReelPlugin, slot: HTMLElement, meta: TmdbFilm | TmdbShow, isTv: boolean): void {
	const credits = isTv ? (meta as TmdbShow).aggregate_credits : (meta as TmdbFilm).credits;
	const cast = (credits?.cast ?? []).slice(0, 12);
	if (!cast.length) return;

	/*
	 * `.reel-caststrip` is the *section*; `.reel-caststrip-track` is the row
	 * that scrolls. Putting the cards straight into the section left them as
	 * block elements in a column — twelve faces stacked vertically down a
	 * 72px gutter with the rest of the width empty, which is what "the people
	 * leave a ton of blank space" was.
	 *
	 * The track already existed with the right rules on it. This was a wrapper
	 * I failed to create, not a style I failed to write.
	 */
	const strip = slot.createDiv({ cls: "reel-caststrip" }).createDiv({ cls: "reel-caststrip-track" });
	for (const person of cast) {
		const card = strip.createDiv({ cls: "reel-castcard" });
		const face = card.createDiv({ cls: "reel-castface" });
		const src = person.profile_path ? plugin.tmdb.posterUrl(person.profile_path, "w185") : null;
		if (src) face.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
		else plugin.people.attach(face, person.name);

		// Your opinion, where the person is — not on a screen you have to go to.
		const held = opinionOf(plugin, person.id);
		if (held) {
			const mark = face.createDiv({ cls: "reel-castmark" });
			if (held.rating != null) mark.createSpan({ text: `★ ${held.rating}` });
			else if (held.liked) mark.createSpan({ cls: "reel-castmark-heart", text: "♥" });
		}

		card.createDiv({ cls: "reel-castname", text: person.name });
		// A series merges an actor's parts, so the role can be a list.
		const role = Array.isArray((person as { roles?: { character: string }[] }).roles)
			? ((person as { roles?: { character: string }[] }).roles ?? []).map((r) => r.character).join(", ")
			: (person as { character?: string }).character;
		if (role) card.createDiv({ cls: "reel-castrole", text: role });
	}
}

/**
 * Everything above, from one already-cached request.
 *
 * The detail payload is fetched once and reused: a title you go on to add
 * would have needed it regardless, so on the common path this costs nothing.
 * Silent on failure — the card works without any of it, and an error notice
 * for a missing trailer would be noise on a screen you are skimming.
 */
export async function paintExtras(
	plugin: ReelPlugin,
	slot: HTMLElement,
	id: number,
	isTv: boolean
): Promise<void> {
	try {
		const meta = isTv ? await plugin.tmdb.getShow(id) : await plugin.tmdb.getFilm(id);
		const url = trailerUrl(meta.videos?.results);
		if (url) paintTrailer(slot, url);
		paintCast(plugin, slot, meta, isTv);
		paintLinks(slot, meta, isTv);
	} catch {
		/* none of this is worth interrupting a decision for */
	}
}

/**
 * The trailer, whether or not the note already knows about it.
 *
 * The detail screen only drew one when `entry.trailer` was in frontmatter,
 * which is written at note-creation time. A series added before that field
 * existed — or one whose trailer TMDB published later — simply had no player,
 * and the screen gave no hint that a trailer was a thing it could show. "Where's
 * the trailer" is the reasonable response to that.
 *
 * Uses the known URL when there is one, and otherwise asks TMDB. The response
 * is cached and a title you interact with needed it anyway.
 */
export async function paintTrailerFor(
	plugin: ReelPlugin,
	slot: HTMLElement,
	id: number,
	isTv: boolean,
	known?: string
): Promise<void> {
	if (known) {
		paintTrailer(slot, known);
		return;
	}
	try {
		const meta = isTv ? await plugin.tmdb.getShow(id) : await plugin.tmdb.getFilm(id);
		const url = trailerUrl(meta.videos?.results);
		if (url) paintTrailer(slot, url);
	} catch {
		/* no trailer is not worth interrupting a page for */
	}
}
