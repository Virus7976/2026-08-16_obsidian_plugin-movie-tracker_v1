/**
 * The add flow: type, pick, log.
 *
 * `SuggestModal` gives keyboard navigation and the mobile-correct keyboard
 * handling for free. Queries are debounced 300ms — TMDB is rate limited, and
 * firing per keystroke on a phone keyboard is both slow and rude.
 */

import { App, Notice, SuggestModal, TFile, debounce } from "obsidian";
import type ReelPlugin from "../main";
import type { TmdbSearchResult } from "../types";
import { redact } from "../secrets";
import { yearOf } from "../util/dates";
import { LogSheet } from "./logSheet";

export class SearchModal extends SuggestModal<TmdbSearchResult> {
	private results: TmdbSearchResult[] = [];
	private lastQuery = "";
	private seq = 0;
	private resolveResults: ((r: TmdbSearchResult[]) => void) | null = null;

	constructor(
		app: App,
		private plugin: ReelPlugin,
		private opts: { watchlist?: boolean } = {}
	) {
		super(app);
		this.setPlaceholder(opts.watchlist ? "Add to watchlist — search TMDB…" : "Search TMDB for a film or show…");
		this.limit = 20;
		this.modalEl.addClass("reel-modal", "reel-search");
		this.setInstructions([
			{ command: "↑↓", purpose: "navigate" },
			{ command: "↵", purpose: "select" },
			{ command: "esc", purpose: "dismiss" },
			// Results are capped at 20; without saying so, a missing title
			// looks like TMDB doesn't have it rather than like a cut-off list.
			{ command: "top 20", purpose: "add words to narrow" },
		]);
	}

	/** 300ms debounce, with a sequence guard so a slow reply can't overwrite a fast one. */
	private runSearch = debounce(
		async (query: string) => {
			const ticket = ++this.seq;
			try {
				const results = await this.plugin.tmdb.searchMulti(query);
				if (ticket !== this.seq) return;
				this.results = results;
			} catch (e) {
				if (ticket !== this.seq) return;
				this.results = [];
				new Notice(`Reel: ${redact(e)}`);
			}
			this.resolveResults?.(this.results);
			this.resolveResults = null;
		},
		300,
		true
	);

	async getSuggestions(query: string): Promise<TmdbSearchResult[]> {
		const q = query.trim();
		if (q.length < 2) {
			this.results = [];
			return [];
		}
		if (q === this.lastQuery && this.results.length) return this.results;
		this.lastQuery = q;

		return new Promise<TmdbSearchResult[]>((resolve) => {
			this.resolveResults = resolve;
			this.runSearch(q);
		});
	}

	renderSuggestion(item: TmdbSearchResult, el: HTMLElement): void {
		el.addClass("reel-suggestion");
		const isTv = item.media_type === "tv";
		const title = isTv ? (item.name ?? "Untitled") : (item.title ?? "Untitled");
		const year = yearOf(isTv ? item.first_air_date : item.release_date);

		const thumb = el.createDiv({ cls: "reel-suggestion-thumb" });
		const url = this.plugin.tmdb.posterUrl(item.poster_path, "w92");
		if (url) {
			const img = thumb.createEl("img", { attr: { src: url, loading: "lazy", alt: "" } });
			img.addEventListener("error", () => {
				img.remove();
				thumb.addClass("is-empty");
			});
		} else {
			thumb.addClass("is-empty");
		}

		const body = el.createDiv({ cls: "reel-suggestion-body" });
		const line = body.createDiv({ cls: "reel-suggestion-title" });
		line.createSpan({ text: title });
		if (year) line.createSpan({ cls: "reel-dim", text: ` ${year}` });

		const meta = body.createDiv({ cls: "reel-suggestion-meta" });
		meta.createSpan({ cls: `reel-badge ${isTv ? "tv" : "film"}`, text: isTv ? "Series" : "Film" });

		const existing = this.plugin.library.byTmdbId(item.id, isTv ? "tv" : "film");
		if (existing) meta.createSpan({ cls: "reel-badge in-library", text: "In library" });

		if (item.vote_average) meta.createSpan({ cls: "reel-dim", text: `★ ${item.vote_average.toFixed(1)}` });
	}

	async onChooseSuggestion(item: TmdbSearchResult): Promise<void> {
		const isTv = item.media_type === "tv";
		const type = isTv ? "tv" : "film";
		const existing = this.plugin.library.byTmdbId(item.id, type);

		if (existing) {
			const file = this.app.vault.getAbstractFileByPath(existing.path);
			if (file instanceof TFile) {
				new LogSheet(this.app, this.plugin, { file, entry: existing }).open();
				return;
			}
		}

		new LogSheet(this.app, this.plugin, {
			pending: { id: item.id, type, title: isTv ? (item.name ?? "") : (item.title ?? "") },
			watchlist: this.opts.watchlist,
		}).open();
	}
}
