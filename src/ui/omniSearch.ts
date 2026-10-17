/**
 * One search for everything: your library first, TMDB underneath.
 *
 * Before this, searching meant first deciding where to look. The Library tab
 * filtered the library, the + button searched TMDB, and a film in the wrong
 * place simply was not found. Here you type once. Titles you already have come
 * first and open their detail screen; titles you do not have follow under them
 * and start the log flow.
 *
 * The filter chips narrow what is shown without leaving the box.
 */

import { App, Notice, SuggestModal, debounce, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry, TmdbSearchResult } from "../types";
import { matchesStatus } from "../util/status";
import { yearOf } from "../util/dates";
import { redact } from "../secrets";
import { LogSheet } from "./logSheet";

type Item =
	| { kind: "unlock" }
	| { kind: "lib"; entry: Entry }
	| { kind: "tmdb"; result: TmdbSearchResult }
	| { kind: "head"; text: string };

/**
 * Where to look. One search, three readings of it: everything, only what you
 * already have, or only what you do not. Library and Discover are the same
 * search with a different starting scope, not two features.
 */
export type OmniScope = "all" | "mine" | "new";
type Kind = "film" | "tv" | null;
type Status = "watchlist" | "watched" | null;

const SCOPES: [OmniScope, string][] = [
	["all", "All"],
	["mine", "In library"],
	["new", "Not in library"],
];
const KINDS: [Exclude<Kind, null>, string][] = [
	["film", "Films"],
	["tv", "Shows"],
];
const STATUSES: [Exclude<Status, null>, string][] = [
	["watchlist", "Watchlist"],
	["watched", "Watched"],
];

export class OmniSearch extends SuggestModal<Item> {
	private where: OmniScope;
	private kind: Kind = null;
	private status: Status = null;
	private chipEls: HTMLElement[] = [];
	private remote: TmdbSearchResult[] = [];
	private remoteFor = "";
	private seq = 0;

	constructor(
		app: App,
		private plugin: ReelPlugin,
		query = "",
		scope: OmniScope = "all",
		state: { kind: Kind; status: Status } = { kind: null, status: null }
	) {
		super(app);
		this.where = scope;
		this.kind = state.kind;
		this.status = state.status;
		this.setPlaceholder("Search your library and TMDB…");
		this.limit = 40;
		this.modalEl.addClass("reel-modal", "reel-search", "reel-omni");

		const row = createDiv({ cls: "reel-omni-chips" });
		const redo = (): void => {
			this.paintChips();
			this.inputEl.dispatchEvent(new Event("input"));
			this.inputEl.focus();
		};
		const chip = (label: string, on: () => void, active: () => boolean): void => {
			const b = row.createEl("button", { cls: "reel-chip", text: label, attr: { type: "button" } });
			b.addEventListener("click", () => {
				on();
				redo();
			});
			b.dataset.on = "";
			this.chipEls.push(b);
			(b as unknown as { _active: () => boolean })._active = active;
		};
		for (const [id, label] of SCOPES) {
			chip(label, () => {
				this.where = id;
				if (id === "new") this.status = null;
			}, () => this.where === id);
		}
		for (const [id, label] of KINDS) {
			chip(label, () => (this.kind = this.kind === id ? null : id), () => this.kind === id);
		}
		for (const [id, label] of STATUSES) {
			chip(label, () => {
				this.status = this.status === id ? null : id;
				if (this.status) this.where = "mine";
			}, () => this.status === id);
		}
		this.paintChips();
		// Under the field, on a row of their own. Beside it they shared the
		// input's line and squeezed the text you were typing.
		this.resultContainerEl.insertAdjacentElement("beforebegin", row);

		if (query) {
			this.inputEl.value = query;
			window.setTimeout(() => this.inputEl.dispatchEvent(new Event("input")), 0);
		}
	}

	private paintChips(): void {
		for (const b of this.chipEls) {
			b.toggleClass("is-active", (b as unknown as { _active: () => boolean })._active());
		}
	}

	private matches(e: Entry): boolean {
		if (this.kind && e.type !== this.kind) return false;
		if (this.status === "watchlist") return e.status === "watchlist";
		if (this.status === "watched") return matchesStatus(e, "watched");
		return true;
	}

	/**
	 * "thriller", "90s comedy", "something scary": a genre or a decade in the
	 * box asks for a kind of film, not a title. Answered by TMDB's own filter,
	 * so it finds what you do not have yet. Null means the words were not that,
	 * and the normal title search runs instead.
	 */
	private async byGenre(q: string): Promise<TmdbSearchResult[] | null> {
		const words = q.toLowerCase().replace(/^#/, "").split(/\s+/).filter(Boolean);
		const alias: Record<string, string> = {
			"sci-fi": "science fiction",
			scifi: "science fiction",
			scary: "horror",
			funny: "comedy",
			romantic: "romance",
			animated: "animation",
			cartoon: "animation",
			"kids": "family",
		};
		let decade: number | undefined;
		const rest: string[] = [];
		for (const w of words) {
			const m = /^(?:(19|20)?(\d)0)s$/.exec(w);
			if (m) decade = m[1] ? Number(m[1] + m[2] + "0") : Number(m[2]) < 3 ? 2000 + Number(m[2]) * 10 : 1900 + Number(m[2]) * 10;
			else rest.push(alias[w] ?? w);
		}
		const phrase = rest.join(" ");
		const kinds: ("movie" | "tv")[] = this.kind === "film" ? ["movie"] : this.kind === "tv" ? ["tv"] : ["movie", "tv"];
		const out: TmdbSearchResult[] = [];
		for (const type of kinds) {
			const list = await this.plugin.tmdb.genreList(type);
			const hit = list.find((g) => g.name.toLowerCase() === phrase);
			if (!hit && !(decade && !phrase)) continue;
			out.push(...(await this.plugin.tmdb.discoverBy({ type, genreId: hit?.id, decade })));
		}
		return out.length ? out : null;
	}

	private fetchRemote = debounce(
		async (q: string) => {
			const ticket = ++this.seq;
			try {
				const r = (await this.byGenre(q)) ?? (await this.plugin.tmdb.searchMulti(q));
				if (ticket !== this.seq) return;
				this.remote = r;
				this.remoteFor = q;
			} catch (e) {
				if (ticket !== this.seq) return;
				new Notice(`Reel: ${redact(e)}`);
			}
			// Re-run the suggestions now that there is more to show.
			if (ticket === this.seq) this.inputEl.dispatchEvent(new Event("input"));
		},
		350,
		true
	);

	getSuggestions(query: string): Item[] {
		const q = query.trim();
		const lib = this.plugin.library;
		const showMine = this.where !== "new";
		const mine = showMine ? (q ? lib.search(q) : lib.all()).filter((e) => this.matches(e)).slice(0, 25) : [];
		const out: Item[] = [];
		if (mine.length) {
			out.push({ kind: "head", text: "In your library" });
			for (const entry of mine) out.push({ kind: "lib", entry });
		}

		// TMDB only answers "what else exists", so it is skipped when the chip
		// asks about things you already have.
		const askRemote = q.length >= 2 && this.where !== "mine" && !this.status;
		if (askRemote && this.plugin.credentials.needsUnlock) {
			// Reading a sealed key mid-typing would throw a passphrase sheet over
			// the box you are typing in. Say so in the list instead, and let the
			// person choose when.
			out.push({ kind: "head", text: "Not in your library" });
			out.push({ kind: "unlock" });
		} else if (askRemote) {
			if (this.remoteFor !== q) this.fetchRemote(q);
			const fresh = this.remote
				.filter((r) => r.media_type === "tv" || r.media_type === "movie")
				.filter((r) => (this.kind === "film" ? r.media_type === "movie" : this.kind === "tv" ? r.media_type === "tv" : true))
				.filter((r) => !lib.byTmdbId(r.id, r.media_type === "tv" ? "tv" : "film"));
			if (fresh.length) {
				out.push({ kind: "head", text: "Not in your library" });
				for (const result of fresh) out.push({ kind: "tmdb", result });
			}
		}
		if (!out.length) out.push({ kind: "head", text: q ? "Nothing found" : "Your library is empty" });
		return out;
	}

	renderSuggestion(item: Item, el: HTMLElement): void {
		if (item.kind === "unlock") {
			el.addClass("reel-omni-unlock");
			setIcon(el.createSpan({ cls: "reel-omni-unlock-icon" }), "lock");
			const text = el.createDiv({ cls: "reel-omni-unlock-text" });
			text.createDiv({ cls: "reel-omni-unlock-title", text: "Unlock your keys to search TMDB" });
			text.createDiv({ cls: "reel-dim", text: "You come straight back here with your search kept." });
			return;
		}
		if (item.kind === "head") {
			el.addClass("reel-omni-head");
			el.setText(item.text);
			return;
		}
		el.addClass("reel-suggestion");
		const thumb = el.createDiv({ cls: "reel-suggestion-thumb" });
		let title: string;
		let year: number | null | undefined;
		let isTv: boolean;
		if (item.kind === "lib") {
			const e = item.entry;
			title = e.title;
			isTv = e.type === "tv";
			year = e.year ?? e.firstAirYear;
			this.plugin.posters.attach(thumb, e);
		} else {
			const r = item.result;
			isTv = r.media_type === "tv";
			title = (isTv ? r.name : r.title) ?? "Untitled";
			year = yearOf(isTv ? r.first_air_date : r.release_date);
			const url = this.plugin.tmdb.posterUrl(r.poster_path, "w92");
			if (url) thumb.createEl("img", { attr: { src: url, loading: "lazy", alt: "" } });
			else thumb.addClass("is-empty");
		}
		const body = el.createDiv({ cls: "reel-suggestion-body" });
		const line = body.createDiv({ cls: "reel-suggestion-title" });
		line.createSpan({ text: title });
		if (year) line.createSpan({ cls: "reel-dim", text: ` ${year}` });
		const meta = body.createDiv({ cls: "reel-suggestion-meta" });
		meta.createSpan({ cls: `reel-badge ${isTv ? "tv" : "film"}`, text: isTv ? "Series" : "Film" });
		if (item.kind === "lib") {
			meta.createSpan({ cls: `reel-badge status-${item.entry.status}`, text: item.entry.status });
			if (item.entry.rating != null) meta.createSpan({ cls: "reel-dim", text: `★ ${item.entry.rating}` });
		}
	}

	onChooseSuggestion(item: Item): void {
		if (item.kind === "unlock") {
			// Close, unlock, and reopen exactly as it was: the words, the scope
			// and the chips. The prompt is a detour, not a new place.
			const back = { query: this.inputEl.value, where: this.where, state: { kind: this.kind, status: this.status } };
			void this.plugin.credentials.unlock().then(() => {
				new OmniSearch(this.app, this.plugin, back.query, back.where, back.state).open();
			});
			return;
		}
		if (item.kind === "head") {
			// Not a result; reopen so a stray tap does not just close the box.
			new OmniSearch(this.app, this.plugin, this.inputEl.value, this.where).open();
			return;
		}
		if (item.kind === "lib") {
			void this.plugin.openDetail(item.entry);
			return;
		}
		const r = item.result;
		const isTv = r.media_type === "tv";
		new LogSheet(this.app, this.plugin, {
			pending: { id: r.id, type: isTv ? "tv" : "film", title: (isTv ? r.name : r.title) ?? "" },
		}).open();
	}
}
