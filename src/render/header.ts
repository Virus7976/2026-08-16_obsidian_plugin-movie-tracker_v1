/**
 * The card that appears at the top of any note carrying a `tmdb_id`.
 *
 * A markdown post-processor rather than a code block, so the note itself stays
 * clean: frontmatter and your prose, nothing else. The card is prepended to the
 * rendered preview section and guarded by a WeakSet, because post-processors
 * fire once per block and we only want one card per render.
 */

import { MarkdownPostProcessorContext, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { formatMinutes, prettyDate } from "../util/dates";
import { rangeCount } from "../util/ranges";
import { renderStarsStatic } from "../ui/stars";
import { LogSheet } from "../ui/logSheet";
import { SeasonSheet } from "../ui/seasonSheet";
import { ListPicker } from "../ui/listPicker";
import { imdbUrl, tmdbUrl } from "../extract";
import { unlink } from "../library";
import { ContentFlag, FLAG_LABELS } from "../content";

export function registerHeaderProcessor(plugin: ReelPlugin): void {
	plugin.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		if (!ctx.sourcePath) return;

		const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(file instanceof TFile)) return;

		const entry = plugin.library.byPath(ctx.sourcePath);
		if (!entry) return;

		// Anchor to the preview section so the card sits above everything, not
		// above whichever paragraph happened to render first.
		const section = el.closest(".markdown-preview-section") ?? el.parentElement;
		if (!(section instanceof HTMLElement)) return;

		// Ask the DOM whether a card is already there, rather than remembering
		// the element in a WeakSet. Obsidian re-renders a section while you
		// type and wipes its children; a remembered element would stay
		// "already done" forever and leave the note card-less until reload.
		if (section.querySelector(":scope > .reel-header")) return;

		const card = createDiv({ cls: "reel-header" });
		buildCard(plugin, card, entry, file);

		// After the frontmatter block if there is one, otherwise at the very top.
		const fmEl = section.querySelector(".frontmatter, .metadata-container, .mod-header");
		if (fmEl?.parentElement === section) fmEl.insertAdjacentElement("afterend", card);
		else section.prepend(card);
	});

	// A rating change should repaint the card without a manual reload.
	plugin.registerEvent(
		plugin.library.on("changed", () => {
			document.querySelectorAll<HTMLElement>(".reel-header").forEach((card) => {
				const path = card.dataset.reelPath;
				if (!path) return;
				const entry = plugin.library.byPath(path);
				const file = plugin.app.vault.getAbstractFileByPath(path);
				if (!entry || !(file instanceof TFile)) return;
				card.empty();
				buildCard(plugin, card, entry, file);
			});
		})
	);
}

function buildCard(plugin: ReelPlugin, card: HTMLElement, entry: Entry, file: TFile): void {
	card.dataset.reelPath = entry.path;
	card.toggleClass("is-tv", entry.type === "tv");

	/* Poster */
	const posterEl = card.createDiv({ cls: "reel-header-poster" });
	const src = plugin.posters.resourcePath(entry.poster) ?? plugin.tmdb.posterUrl(null);
	if (src) {
		const img = posterEl.createEl("img", { attr: { src, alt: `${entry.title} poster`, loading: "lazy" } });
		img.addEventListener("error", () => {
			img.remove();
			posterEl.addClass("is-empty");
		});
	} else {
		posterEl.addClass("is-empty");
		posterEl.createSpan({ text: entry.title.slice(0, 1) });
	}

	/* Body */
	const body = card.createDiv({ cls: "reel-header-body" });

	const titleRow = body.createDiv({ cls: "reel-header-title" });
	titleRow.createSpan({ text: entry.title });
	const year = entry.year ?? entry.firstAirYear;
	if (year) titleRow.createSpan({ cls: "reel-dim", text: ` ${year}` });

	/* External scores. One row, four sources, each labelled — the label is what
	   makes 87 (Metacritic, out of 100) and 8.7 (IMDb, out of 10) legible side
	   by side. Sources with no data are omitted rather than shown as dashes. */
	const scores = body.createDiv({ cls: "reel-scores" });
	const score = (label: string, value: string, cls: string) => {
		const chip = scores.createDiv({ cls: `reel-score ${cls}` });
		chip.createDiv({ cls: "reel-score-value", text: value });
		chip.createDiv({ cls: "reel-score-label", text: label });
	};
	if (entry.rating != null) score("You", String(entry.rating), "mine");
	if (entry.imdbRating != null) score("IMDb", entry.imdbRating.toFixed(1), "imdb");
	if (entry.metacritic != null) score("Metacritic", String(entry.metacritic), metacriticClass(entry.metacritic));
	if (entry.rottenTomatoes != null) score("Tomatoes", `${entry.rottenTomatoes}%`, entry.rottenTomatoes >= 60 ? "fresh" : "rotten");
	if (!scores.childElementCount) scores.remove();

	const facts = body.createDiv({ cls: "reel-header-facts" });
	const people = entry.type === "tv" ? entry.creators : entry.director;
	if (people.length) facts.createSpan({ text: people.join(", ") });
	if (entry.type === "film" && entry.runtime) facts.createSpan({ text: formatMinutes(entry.runtime) });
	if (entry.type === "tv") {
		const total = entry.totalEpisodes ?? 0;
		const seen = entry.seasons.reduce((n, s) => n + rangeCount(s.watched), 0);
		facts.createSpan({ text: total ? `${seen}/${total} episodes` : `${seen} episodes` });
		if (entry.showStatus) facts.createSpan({ cls: "reel-dim", text: entry.showStatus });
	}
	if (entry.tmdbRating) facts.createSpan({ cls: "reel-dim", text: `TMDB ${entry.tmdbRating}` });

	if (entry.cast.length) {
		const cast = body.createDiv({ cls: "reel-header-cast" });
		cast.createSpan({ cls: "reel-dim", text: "Cast: " });
		cast.createSpan({ text: entry.cast.slice(0, 5).map(unlink).join(", ") });
	}

	if (entry.genres.length) {
		const genres = body.createDiv({ cls: "reel-header-genres" });
		entry.genres.slice(0, 4).forEach((g) => genres.createSpan({ cls: "reel-chip static", text: g }));
	}

	const ratingRow = body.createDiv({ cls: "reel-header-rating" });
	renderStarsStatic(ratingRow, entry.rating);
	if (entry.liked) ratingRow.createSpan({ cls: "reel-heart is-on static", text: "♥" });
	ratingRow.createSpan({ cls: `reel-badge status-${entry.status}`, text: entry.status });
	if (entry.certification) ratingRow.createSpan({ cls: "reel-badge cert", text: entry.certification });

	if (entry.contentFlags.length) {
		const flags = body.createDiv({ cls: "reel-header-flags" });
		flags.createSpan({ cls: "reel-dim", text: "Contains: " });
		for (const f of entry.contentFlags) {
			flags.createSpan({ cls: "reel-badge flag", text: FLAG_LABELS[f as ContentFlag] ?? f });
		}
		// The specific topics behind the flags, when DoesTheDogDie supplied
		// them — collapsed, because there can be a dozen and they're detail
		// you want on demand rather than in your face above every review.
		if (entry.contentTopics.length) {
			const details = body.createEl("details", { cls: "reel-topics" });
			details.createEl("summary", { text: `${entry.contentTopics.length} content notes` });
			const list = details.createDiv({ cls: "reel-topic-list" });
			for (const t of entry.contentTopics) list.createSpan({ cls: "reel-chip static", text: t });
		}
	}

	if (entry.providers.length) {
		const p = body.createDiv({ cls: "reel-header-facts" });
		p.createSpan({ cls: "reel-dim", text: "Streaming: " });
		p.createSpan({ text: entry.providers.slice(0, 4).join(", ") });
	}

	if (entry.lists.length) {
		const l = body.createDiv({ cls: "reel-header-genres" });
		entry.lists.forEach((name) => l.createSpan({ cls: "reel-chip static", text: name }));
	}

	/* Watch history / season strip */
	if (entry.type === "film") {
		if (entry.watched.length) {
			const hist = body.createDiv({ cls: "reel-header-history" });
			for (const w of [...entry.watched].reverse()) {
				const row = hist.createDiv({ cls: "reel-history-row" });
				row.createSpan({ text: prettyDate(w.date) });
				if (w.rating != null) row.createSpan({ cls: "reel-dim", text: `★ ${w.rating}` });
				if (w.rewatch) row.createSpan({ cls: "reel-badge subtle", text: "rewatch" });
			}
		}
	} else {
		const strip = body.createDiv({ cls: "reel-seasons" });
		for (const s of entry.seasons) {
			const total = (s as { total?: number }).total ?? 0;
			const seen = rangeCount(s.watched);
			const pill = strip.createDiv({ cls: "reel-season-pill" });
			pill.createSpan({ cls: "reel-season-n", text: `S${s.n}` });
			pill.createSpan({ cls: "reel-dim", text: total ? `${seen}/${total}` : String(seen) });
			if (total && seen >= total) pill.addClass("is-complete");
			else if (seen > 0) pill.addClass("is-partial");
			// Fill proportion as a CSS custom property — cheaper than a child bar.
			pill.style.setProperty("--reel-fill", total ? String(Math.min(1, seen / total)) : "0");
			pill.addEventListener("click", () => new SeasonSheet(plugin.app, plugin, entry, s.n).open());
		}
	}

	/* Actions */
	const actions = body.createDiv({ cls: "reel-header-actions" });
	const act = (label: string, fn: () => void, cta = false) => {
		const b = actions.createEl("button", { cls: `reel-btn${cta ? " mod-cta" : ""}`, text: label });
		b.addEventListener("click", fn);
		return b;
	};

	if (entry.type === "film") {
		act(entry.watched.length ? "Log rewatch" : "Log watch", () => {
			new LogSheet(plugin.app, plugin, { file, entry }).open();
		}, true);
	} else {
		const next = plugin.upNext.nextFor(entry);
		if (next) {
			act(`Mark S${next.season}E${next.episode} watched`, async () => {
				await plugin.notes.markEpisode(file, next.season, next.episode);
			}, true);
		}
		act("Edit rating", () => new LogSheet(plugin.app, plugin, { file, entry }).open());
	}

	act("Lists", () => new ListPicker(plugin.app, plugin, entry, file).open());

	act("Refresh", async () => {
		await plugin.notes.refreshMetadata(entry);
	});

	/* External links, kept apart from the actions.
	   Actions change your vault; links leave the app. Mixing them means an
	   accidental tap on "Trailer" sits next to one that edits your data, so
	   they get their own row and their own visual weight. */
	const links = body.createDiv({ cls: "reel-links" });
	const link = (label: string, url: string, cls: string) => {
		const a = links.createEl("a", { cls: `reel-link ${cls}`, text: label, href: url });
		a.setAttr("target", "_blank");
		a.setAttr("rel", "noopener");
	};

	if (entry.trailer) link("▶ Trailer", entry.trailer, "trailer");
	const imdb = imdbUrl(entry.imdbId);
	if (imdb) link("IMDb", imdb, "imdb");
	link("TMDB", tmdbUrl(entry.tmdbId, entry.type), "tmdb");
	if (!links.childElementCount) links.remove();
}

/** Metacritic's own bands: 61+ favourable, 40–60 mixed, below 40 unfavourable. */
function metacriticClass(score: number): string {
	if (score >= 61) return "meta-good";
	if (score >= 40) return "meta-mixed";
	return "meta-bad";
}
