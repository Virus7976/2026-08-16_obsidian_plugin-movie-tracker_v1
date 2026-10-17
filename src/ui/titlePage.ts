/**
 * A title you do not own, on the same page as one you do.
 *
 * The preview sheet is for deciding quickly. This is for looking around: the
 * same tabs as a title in your library (About, Details, Box office, Stats,
 * Cast, Crew, Releases, Similar, Photos, Reviews), the same cast strip and the
 * same named credits, reached from "More like this" and from Similar. Tap a
 * similar title here and you get its page, with its own Similar tab, so you
 * can follow an interest from one film to the next.
 *
 * It does not duplicate any of that. The reference sections live in
 * `DetailScreen.renderReference`, and this builds a stand-in entry for it to
 * read, so a fix to a tab lands here too.
 */

import { Modal, Notice, Platform } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry, TmdbSearchResult } from "../types";
import { redact } from "../secrets";
import { todayISO, yearOf } from "../util/dates";
import { DetailScreen } from "./detail";
import { LogSheet } from "./logSheet";
import { paintWash } from "./titleExtras";

/** The fields an entry needs, from what a search result already says. */
export function entryFromResult(plugin: ReelPlugin, r: TmdbSearchResult): Entry {
	const isTv = r.media_type === "tv" || (!!r.name && !r.title);
	const poster = plugin.tmdb.posterUrl(r.poster_path, "w342") ?? undefined;
	return {
		path: "",
		basename: "",
		type: isTv ? "tv" : "film",
		tmdbId: r.id,
		title: (isTv ? r.name : r.title) ?? "Untitled",
		year: isTv ? undefined : yearOf(r.release_date),
		director: [],
		watched: [],
		creators: [],
		firstAirYear: isTv ? yearOf(r.first_air_date) : undefined,
		seasons: [],
		genres: [],
		posterUrl: poster,
		castIds: [],
		directorIds: [],
		tmdbRating: r.vote_average,
		status: "",
		cast: [],
		characters: [],
		overview: r.overview,
		productionCompanies: [],
		providers: [],
		contentFlags: [],
		contentTopics: [],
		lists: [],
		added: 0,
		watchCount: 0,
	} as Entry;
}

export class TitlePage extends Modal {
	private busy = false;

	constructor(
		private plugin: ReelPlugin,
		private item: TmdbSearchResult,
		private onAdded: () => void = () => {}
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal", "reel-titlepage");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-titlepage-content", "reel-detail");

		const entry = entryFromResult(this.plugin, this.item);
		const isTv = entry.type === "tv";
		paintWash(contentEl, this.plugin.tmdb.posterUrl(this.item.poster_path, "w342"));

		const head = contentEl.createDiv({ cls: "reel-preview-head" });
		const posterEl = head.createDiv({ cls: "reel-preview-poster" });
		const src = this.plugin.tmdb.posterUrl(this.item.poster_path, "w342");
		if (src) posterEl.createEl("img", { attr: { src, alt: "" } });

		const body = head.createDiv({ cls: "reel-preview-body" });
		const h = body.createDiv({ cls: "reel-preview-title" });
		h.createSpan({ text: entry.title });
		const year = entry.year ?? entry.firstAirYear;
		if (year) h.createSpan({ cls: "reel-dim", text: ` ${year}` });
		const facts = body.createDiv({ cls: "reel-header-facts" });
		facts.createSpan({ cls: `reel-badge ${isTv ? "tv" : "film"}`, text: isTv ? "Series" : "Film" });
		if (this.item.vote_average) facts.createSpan({ cls: "reel-dim", text: `TMDB ${this.item.vote_average.toFixed(1)}` });

		// The three decisions, up top where they are always in reach.
		const actions = contentEl.createDiv({ cls: "reel-titlepage-actions" });
		const later = actions.createEl("button", { cls: "reel-btn mod-cta", text: "+ Watchlist", attr: { type: "button" } });
		later.addEventListener("click", () => void this.add(later));
		const seen = actions.createEl("button", { cls: "reel-btn", text: "Seen it", attr: { type: "button" } });
		seen.addEventListener("click", () => {
			new LogSheet(this.plugin.app, this.plugin, {
				pending: { id: this.item.id, type: isTv ? "tv" : "film", title: entry.title },
			}).open();
			this.onAdded();
			this.close();
		});
		const nope = actions.createEl("button", { cls: "reel-btn", text: "Not interested", attr: { type: "button" } });
		nope.addEventListener("click", () => {
			void this.plugin.discover.dismiss(this.item.id).then(() => {
				this.onAdded();
				this.close();
			});
		});

		if (entry.overview) contentEl.createDiv({ cls: "reel-preview-overview", text: entry.overview });

		// The reference tabs, from the same code the library's title page uses.
		const main = contentEl.createDiv({ cls: "reel-titlepage-main" });
		const screen = new DetailScreen(this.plugin, entry, () => this.close());
		void screen.renderReference(main, isTv);
	}

	private async add(button: HTMLButtonElement): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		button.setText("Adding…");
		button.setAttr("disabled", "true");
		try {
			await this.plugin.notes.createFromResult(this.item, { date: todayISO(), watchlist: true });
			this.plugin.undo.offer("Added to your watchlist");
			this.onAdded();
			this.close();
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
			button.setText("Retry");
			button.removeAttribute("disabled");
			this.busy = false;
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
