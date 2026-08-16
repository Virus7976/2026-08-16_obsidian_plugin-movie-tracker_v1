/**
 * The detail screen.
 *
 * Everything the note header card offered, moved somewhere you'll actually see
 * it — the card is a markdown post-processor, so it only renders in Reading
 * view, and in Live Preview it simply isn't there.
 *
 * Layout is a hero followed by two columns: your own data and the metadata on
 * the left, seasons or watch history on the right. On a phone they stack. The
 * page is width-capped, because a single column of content on a 2000px monitor
 * strands the text in a ribbon on the left and stretches four buttons to 460px
 * each.
 *
 * Every control writes immediately and confirms visibly. "Did that register?"
 * is the worst question a tracker can leave you asking.
 */

import { Notice, TFile, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type {
	Entry,
	TmdbEpisode,
	TmdbFilm,
	TmdbShow,
	TmdbCastMember,
	TmdbCrew,
	TmdbSearchResult,
	TmdbReview,
} from "../types";
import { redact } from "../secrets";
import { formatMinutes, prettyDate } from "../util/dates";
import { formatRange, parseRange, rangeCount } from "../util/ranges";
import { renderStars } from "./stars";
import { LogSheet } from "./logSheet";
import { ListPicker } from "./listPicker";
import { PersonSheet } from "./personSheet";
import { imdbUrl, tmdbUrl, keywordNames } from "../extract";
import { unlink } from "../library";
import { compactCount } from "../util/format";
import { ContentFlag, FLAG_LABELS } from "../content";

/**
 * "GB" → 🇬🇧.
 *
 * Regional indicator symbols sit at a fixed offset from A–Z, so a flag is just
 * the two letters shifted into that block. No asset, no lookup table, and it
 * follows whatever flag set the reader's platform ships.
 */
function flagEmoji(iso: string): string {
	const code = iso.trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(code)) return "";
	return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const FILM_STATUSES = ["watched", "watchlist", "abandoned"];
const TV_STATUSES = ["watching", "completed", "watchlist", "paused", "dropped"];

/**
 * Brief flash, so a silent write still reads as "that worked".
 *
 * A colour change says nothing to a screen reader, so the control is also
 * marked as a live region for the moment it changes — otherwise the whole
 * confirmation is invisible to anyone not looking at it.
 */
function flash(el: HTMLElement): void {
	el.addClass("reel-flash");
	el.setAttr("aria-live", "polite");
	window.setTimeout(() => {
		el.removeClass("reel-flash");
		el.removeAttribute("aria-live");
	}, 600);
}

export class DetailScreen {
	private openSeason: number | null = null;
	private episodeCache = new Map<number, TmdbEpisode[]>();
	private rootEl: HTMLElement | null = null;

	constructor(
		private plugin: ReelPlugin,
		private entry: Entry,
		private onBack: () => void,
		/** Where you came from, so the back button doesn't claim otherwise. */
		private backLabel = "Library"
	) {}

	private get file(): TFile | null {
		const f = this.plugin.app.vault.getAbstractFileByPath(this.entry.path);
		return f instanceof TFile ? f : null;
	}

	/** Repaint using the current entry, without re-reading the index. */
	private rerender(): void {
		if (this.rootEl) this.render(this.rootEl);
	}

	/**
	 * Adopt the latest indexed version of this entry.
	 *
	 * Called by the view when the library reports a change — which happens
	 * *after* `metadataCache` has reparsed the file. That event is the only
	 * reliable signal that a re-read will return the values we just wrote;
	 * this used to be a 120ms timer, which is a guess that quietly fails on a
	 * slow disk or a large vault.
	 */
	syncFromIndex(): void {
		const latest = this.plugin.library.byPath(this.entry.path);
		if (latest) this.entry = latest;
	}

	/** The path this screen is showing, so the view can tell if it still exists. */
	get path(): string {
		return this.entry.path;
	}

	render(container: HTMLElement): void {
		this.rootEl = container;
		container.empty();
		container.addClass("reel-detail");
		const e = this.entry;
		const isTv = e.type === "tv";

		/* ---- top bar --------------------------------------------------- */
		const bar = container.createDiv({ cls: "reel-detail-bar" });
		const back = bar.createEl("button", { cls: "reel-btn reel-back" });
		setIcon(back.createSpan(), "arrow-left");
		back.createSpan({ text: this.backLabel });
		back.addEventListener("click", () => this.onBack());

		const openNote = bar.createEl("button", { cls: "reel-btn", text: "Open note" });
		openNote.addEventListener("click", async () => {
			const file = this.file;
			if (file) await this.plugin.app.workspace.getLeaf(false).openFile(file);
		});

		const page = container.createDiv({ cls: "reel-detail-page" });

		/* ---- hero ------------------------------------------------------ */
		const hero = page.createDiv({ cls: "reel-hero" });

		const posterEl = hero.createDiv({ cls: "reel-hero-poster" });
		this.plugin.posters.attach(posterEl, e);

		const body = hero.createDiv({ cls: "reel-hero-body" });

		const h = body.createDiv({ cls: "reel-hero-title" });
		h.createSpan({ text: e.title });
		const year = e.year ?? e.firstAirYear;
		if (year) h.createSpan({ cls: "reel-dim", text: ` ${year}` });

		const sub = body.createDiv({ cls: "reel-hero-sub" });
		const people = isTv ? e.creators : e.director;
		if (people.length) sub.createSpan({ text: people.map(unlink).join(", ") });
		if (!isTv && e.runtime) sub.createSpan({ text: formatMinutes(e.runtime) });
		if (isTv) {
			const seen = e.seasons.reduce((n, s) => n + rangeCount(s.watched), 0);
			sub.createSpan({ text: `${seen} of ${e.totalEpisodes ?? "?"} episodes` });
		}
		if (e.certification) sub.createSpan({ cls: "reel-badge cert", text: e.certification });

		const scores = body.createDiv({ cls: "reel-scores" });
		const score = (label: string, value: string, cls: string) => {
			const chip = scores.createDiv({ cls: `reel-score ${cls}` });
			chip.createDiv({ cls: "reel-score-value", text: value });
			chip.createDiv({ cls: "reel-score-label", text: label });
		};
		if (e.rating != null) score("You", String(e.rating), "mine");
		const epAvg = this.episodeAverage();
		if (epAvg != null) score("Episodes", epAvg.toFixed(1), "mine");
		if (e.imdbRating != null) {
			// The sample size belongs with the score. 7.9 from 1.2M voters and
			// 7.9 from 400 are different claims, and the number alone hides it.
			score("IMDb", e.imdbRating.toFixed(1), "imdb");
			if (e.imdbVotes) {
				const chip = scores.lastElementChild;
				chip?.createDiv({ cls: "reel-score-votes", text: compactCount(e.imdbVotes) });
			}
		}
		if (e.metacritic != null) {
			score("Metacritic", String(e.metacritic), e.metacritic >= 61 ? "meta-good" : e.metacritic >= 40 ? "meta-mixed" : "meta-bad");
		}
		if (e.rottenTomatoes != null) score("Tomatoes", `${e.rottenTomatoes}%`, e.rottenTomatoes >= 60 ? "fresh" : "rotten");
		if (e.tmdbRating != null) score("TMDB", e.tmdbRating.toFixed(1), "");
		if (!scores.childElementCount) scores.remove();

		if (e.genres.length) {
			const g = body.createDiv({ cls: "reel-hero-genres" });
			e.genres.forEach((x) => g.createSpan({ cls: "reel-chip static", text: x }));
		}

		if (e.overview) body.createDiv({ cls: "reel-hero-overview", text: e.overview });

		const links = body.createDiv({ cls: "reel-links" });

		// The trailer was a small text link among two others and was missed
		// entirely. It's the one link anyone actually wants, so it gets button
		// weight and the others stay as links.
		if (e.trailer) {
			const play = links.createEl("a", { cls: "reel-btn mod-cta reel-trailer-btn", href: e.trailer });
			setIcon(play.createSpan(), "play");
			play.createSpan({ text: "Watch trailer" });
			play.setAttr("target", "_blank");
			play.setAttr("rel", "noopener");
		}

		const link = (label: string, url: string, cls: string) => {
			const a = links.createEl("a", { cls: `reel-link ${cls}`, text: label, href: url });
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
		};
		const imdb = imdbUrl(e.imdbId);
		if (imdb) link("IMDb", imdb, "imdb");
		link("TMDB", tmdbUrl(e.tmdbId, e.type), "tmdb");

		// IMDb's parental guide, deep-linked rather than reproduced. The
		// severity bands and per-item notes are community-maintained and have
		// no public API; scraping them would break the first time IMDb touched
		// their markup. A link is always current and always complete.
		if (imdb) link("Parents guide", `${imdb}parentalguide`, "guide");

		// JustWatch resolves "where can I actually watch this" across every
		// service, which the providers list only approximates. Their paths are
		// lowercase country codes, and the region is already a setting — this
		// must not be hardcoded to wherever the author happens to live.
		const region = (this.plugin.settings.region || "US").toLowerCase();
		link("JustWatch", `https://www.justwatch.com/${region}/search?q=${encodeURIComponent(e.title)}`, "justwatch");

		// Letterboxd resolves a TMDB id directly, so no title guessing.
		if (e.type === "film") link("Letterboxd", `https://letterboxd.com/tmdb/${e.tmdbId}/`, "letterboxd");

		/* ---- columns ---------------------------------------------------- */
		const cols = page.createDiv({ cls: "reel-detail-cols" });
		const side = cols.createDiv({ cls: "reel-detail-side" });
		const main = cols.createDiv({ cls: "reel-detail-main" });

		this.renderControls(side);
		this.renderActions(side);
		this.renderMeta(side);

		if (isTv) this.renderSeasons(main);
		else this.renderHistory(main);

		// Everything TMDB knows, behind tabs. Loaded lazily so the screen you
		// came for — rating, status, progress — paints immediately and the
		// reference material arrives a moment later.
		void this.renderFacets(main, isTv);
	}

	/* ------------------------------------------------------------------ */
	/* Facets — everything TMDB knows, behind tabs                         */
	/* ------------------------------------------------------------------ */

	/**
	 * Cast, crew, production details, genres, releases and related titles.
	 *
	 * Tabbed rather than stacked because this is reference material: you come
	 * looking for one specific thing, and five collapsed sections beat one
	 * very long scroll. The payload is the same cached `getFilm`/`getShow`
	 * response the rest of the plugin uses, so opening this costs nothing
	 * after the first time.
	 */
	private async renderFacets(main: HTMLElement, isTv: boolean): Promise<void> {
		const wrap = main.createDiv({ cls: "reel-facets" });
		wrap.createDiv({ cls: "reel-loading", text: "Loading details…", attr: { role: "status" } });

		let meta: TmdbFilm | TmdbShow;
		try {
			meta = isTv ? await this.plugin.tmdb.getShow(this.entry.tmdbId) : await this.plugin.tmdb.getFilm(this.entry.tmdbId);
		} catch (e) {
			wrap.empty();
			wrap.createDiv({ cls: "reel-error", text: redact(e) });
			return;
		}
		// The screen may have been closed, or another title opened, while the
		// request was in flight.
		if (!wrap.isConnected) return;
		wrap.empty();

		const film = isTv ? undefined : (meta as TmdbFilm);
		const cast = (isTv ? (meta as TmdbShow).aggregate_credits?.cast : film?.credits?.cast) ?? [];
		const crew = (isTv ? (meta as TmdbShow).aggregate_credits?.crew : film?.credits?.crew) ?? [];
		const related = meta.recommendations?.results ?? [];

		// Top cast sits above the tabs, not inside them. It is the one piece of
		// reference material people look for without being asked, and burying
		// it behind a tap made the screen feel emptier than it is.
		if (cast.length) this.renderCastStrip(wrap, cast);

		// Director / Writer / Stars as named, tappable rows.
		//
		// Every reference app puts these directly under the overview, and they
		// were the most conspicuous thing missing: the director was a grey
		// subtitle you could not tap, and writers appeared nowhere at all
		// unless you opened the Crew tab and scrolled.
		this.renderCreditRows(wrap, cast, crew, isTv);

		const tabs: { id: string; label: string; render: (el: HTMLElement) => void }[] = [];

		if (cast.length) tabs.push({ id: "cast", label: "Cast", render: (el) => this.renderPeople(el, cast, true) });
		if (crew.length) tabs.push({ id: "crew", label: "Crew", render: (el) => this.renderPeople(el, crew, false) });
		tabs.push({ id: "details", label: "Details", render: (el) => this.renderFacts(el, meta, isTv) });
		tabs.push({ id: "story", label: "Storyline", render: (el) => this.renderStoryline(el, meta) });
		if (this.entry.contentTopics.length || this.entry.certification) {
			tabs.push({ id: "content", label: "Content", render: (el) => this.renderContent(el) });
		}
		if (meta.genres?.length) tabs.push({ id: "genre", label: "Genre", render: (el) => this.renderGenres(el, meta.genres ?? []) });
		if (film?.release_dates?.results?.length) {
			tabs.push({ id: "releases", label: "Releases", render: (el) => this.renderReleases(el, film) });
		}
		if (related.length) tabs.push({ id: "related", label: "Related", render: (el) => this.renderRelated(el, related) });

		tabs.push({ id: "photos", label: "Photos", render: (el) => void this.renderPhotos(el, isTv) });

		const reviews = meta.reviews?.results ?? [];
		if (reviews.length) {
			tabs.push({
				id: "reviews",
				label: `Reviews${meta.reviews?.total_results ? ` ${meta.reviews.total_results}` : ""}`,
				render: (el) => this.renderReviews(el, reviews),
			});
		}

		if (!tabs.length) return;

		const bar = wrap.createDiv({ cls: "reel-facet-tabs" });
		const body = wrap.createDiv({ cls: "reel-facet-body" });
		const buttons: HTMLElement[] = [];

		const show = (i: number) => {
			buttons.forEach((b, n) => b.toggleClass("is-active", n === i));
			body.empty();
			tabs[i].render(body);
		};

		tabs.forEach((t, i) => {
			const b = bar.createEl("button", { cls: "reel-facet-tab", text: t.label, attr: { type: "button" } });
			buttons.push(b);
			b.addEventListener("click", () => show(i));
		});
		show(0);
	}

	/**
	 * Director / Writer / Stars, as named rows of tappable names.
	 *
	 * The three questions everyone asks about a title before anything else,
	 * and each name opens that person's filmography rather than being dead
	 * text. Grouped by job so "Screenplay" and "Story" collapse into one
	 * Writer row instead of three near-identical lines.
	 */
	private renderCreditRows(wrap: HTMLElement, cast: TmdbCastMember[], crew: TmdbCrew[], isTv: boolean): void {
		const pick = (...jobs: string[]) =>
			crew.filter((c) => c.job && jobs.includes(c.job)).filter((c, i, all) => all.findIndex((x) => x.name === c.name) === i);

		const rows: { label: string; people: (TmdbCastMember | TmdbCrew)[] }[] = [];

		// A series is "created by"; only a film has a single director worth
		// naming, since episodes each have their own.
		if (isTv) {
			const creators = pick("Creator", "Executive Producer").slice(0, 3);
			if (creators.length) rows.push({ label: creators.length > 1 ? "Creators" : "Creator", people: creators });
		} else {
			const directors = pick("Director");
			if (directors.length) rows.push({ label: directors.length > 1 ? "Directors" : "Director", people: directors });
		}

		const writers = pick("Screenplay", "Writer", "Story", "Author").slice(0, 4);
		if (writers.length) rows.push({ label: writers.length > 1 ? "Writers" : "Writer", people: writers });

		const stars = cast.slice(0, 3);
		if (stars.length) rows.push({ label: "Stars", people: stars });

		if (!rows.length) return;

		const box = wrap.createDiv({ cls: "reel-credit-rows" });
		for (const row of rows) {
			const line = box.createDiv({ cls: "reel-credit-row" });
			line.createSpan({ cls: "reel-credit-label", text: row.label });
			const names = line.createSpan({ cls: "reel-credit-names" });
			row.people.forEach((p, i) => {
				if (i) names.createSpan({ cls: "reel-dim", text: " · " });
				const a = names.createEl("button", { cls: "reel-credit-name", text: p.name, attr: { type: "button" } });
				a.addEventListener("click", () => this.openPerson(p));
			});
		}
	}

	/**
	 * Top billing as a horizontal strip of circular headshots.
	 *
	 * Deliberately capped and scrollable rather than complete — the Cast tab
	 * holds the full list. This answers "who is in this" at a glance, which is
	 * a different question from "show me everyone".
	 */
	private renderCastStrip(wrap: HTMLElement, cast: TmdbCastMember[]): void {
		const box = wrap.createDiv({ cls: "reel-caststrip" });

		const head = box.createDiv({ cls: "reel-caststrip-head" });
		head.createSpan({ cls: "reel-facet-label", text: "Top cast" });
		head.createSpan({ cls: "reel-dim", text: String(cast.length) });

		const strip = box.createDiv({ cls: "reel-caststrip-track" });
		for (const p of cast.slice(0, 12)) {
			const cell = strip.createDiv({ cls: "reel-caststrip-cell" });
			cell.setAttr("role", "button");
			cell.setAttr("tabindex", "0");
			cell.setAttr("aria-label", `Find ${p.name} in your library`);

			const shot = cell.createDiv({ cls: "reel-caststrip-shot" });
			const src = this.plugin.tmdb.posterUrl(p.profile_path, "w185");
			if (src) {
				const img = shot.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
				img.addEventListener("error", () => {
					img.remove();
					shot.addClass("is-empty");
					shot.createSpan({ cls: "reel-placeholder-text", text: p.name.slice(0, 2) });
				});
			} else {
				shot.addClass("is-empty");
				shot.createSpan({ cls: "reel-placeholder-text", text: p.name.slice(0, 2) });
			}

			cell.createDiv({ cls: "reel-caststrip-name", text: p.name });
			const part = p.character ?? p.roles?.[0]?.character ?? "";
			if (part) cell.createDiv({ cls: "reel-caststrip-role", text: part });

			const open = () => this.openPerson(p);
			cell.addEventListener("click", open);
			cell.addEventListener("keydown", (ev: KeyboardEvent) => {
				if (ev.key === "Enter" || ev.key === " ") {
					ev.preventDefault();
					open();
				}
			});
		}
	}

	/**
	 * Open a person's filmography.
	 *
	 * TMDB gives an id on credits, but not always — aggregate credits for a
	 * show occasionally omit it. Without one there is no person to look up, so
	 * fall back to searching your own library by name rather than doing
	 * nothing at all.
	 */
	private openPerson(p: TmdbCastMember | TmdbCrew): void {
		if (p.id) new PersonSheet(this.plugin, p.id, p.name).open();
		else void this.plugin.openViewWithSearch(p.name);
	}

	/**
	 * A list of people with headshots.
	 *
	 * Tapping one searches your own library for them, which is the question
	 * you actually have standing on this screen — "what else of theirs have I
	 * seen?" — rather than opening a biography you did not ask for.
	 */
	private renderPeople(el: HTMLElement, people: (TmdbCastMember | TmdbCrew)[], asCast: boolean): void {
		const list = el.createDiv({ cls: "reel-people" });
		for (const p of people.slice(0, 40)) {
			const row = list.createDiv({ cls: "reel-person" });
			row.setAttr("role", "button");
			row.setAttr("tabindex", "0");

			const shot = row.createDiv({ cls: "reel-person-shot" });
			const src = this.plugin.tmdb.posterUrl(p.profile_path, "w185");
			if (src) {
				const img = shot.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
				img.addEventListener("error", () => {
					img.remove();
					shot.addClass("is-empty");
					shot.createSpan({ cls: "reel-placeholder-text", text: p.name.slice(0, 2) });
				});
			} else {
				shot.addClass("is-empty");
				shot.createSpan({ cls: "reel-placeholder-text", text: p.name.slice(0, 2) });
			}

			const body = row.createDiv({ cls: "reel-person-body" });
			body.createDiv({ cls: "reel-person-name", text: p.name });
			const sub = asCast
				? ((p as TmdbCastMember).character ?? (p as TmdbCastMember).roles?.[0]?.character ?? "")
				: ((p as TmdbCrew).job ?? "");
			if (sub) body.createDiv({ cls: "reel-person-role", text: sub });

			const open = () => this.openPerson(p);
			row.addEventListener("click", open);
			row.addEventListener("keydown", (ev: KeyboardEvent) => {
				if (ev.key === "Enter" || ev.key === " ") {
					ev.preventDefault();
					open();
				}
			});
		}
	}

	/** Studios, country, language, alternative titles, and the money. */
	private renderFacts(el: HTMLElement, meta: TmdbFilm | TmdbShow, isTv: boolean): void {
		const film = isTv ? undefined : (meta as TmdbFilm);
		const group = (label: string, values: string[]) => {
			if (!values.length) return;
			const box = el.createDiv({ cls: "reel-facet-group" });
			box.createDiv({ cls: "reel-facet-label", text: label });
			for (const v of values) box.createDiv({ cls: "reel-facet-value", text: v });
		};

		group("Studios", (meta.production_companies ?? []).map((c) => c.name).filter(Boolean));
		group("Country", (film?.production_countries ?? []).map((c) => c.name ?? "").filter(Boolean));
		group(
			"Language",
			(film?.spoken_languages ?? []).map((l) => l.english_name ?? l.name ?? "").filter(Boolean)
		);

		if (film && (film.budget || film.revenue)) {
			const money = (n?: number) => (n ? `$${n.toLocaleString()}` : "not reported");
			const box = el.createDiv({ cls: "reel-facet-group" });
			box.createDiv({ cls: "reel-facet-label", text: "Box office" });
			box.createDiv({ cls: "reel-facet-value", text: `Budget — ${money(film.budget)}` });
			box.createDiv({ cls: "reel-facet-value", text: `Revenue — ${money(film.revenue)}` });
			if (film.budget && film.revenue) {
				const x = film.revenue / film.budget;
				box.createDiv({ cls: "reel-facet-value", text: `Returned ${x.toFixed(1)}× its budget` });
			}
		}

		if (meta.homepage) {
			const box = el.createDiv({ cls: "reel-facet-group" });
			box.createDiv({ cls: "reel-facet-label", text: "Official site" });
			const a = box.createEl("a", { cls: "reel-facet-value reel-link", text: meta.homepage, href: meta.homepage });
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
		}

		// Alternative titles are how you find a film you know under another
		// name, so the local one is worth surfacing before the rest.
		const alts = (film?.alternative_titles?.titles ?? [])
			.filter((t) => t.title)
			.slice(0, 8)
			.map((t) => (t.iso_3166_1 ? `${t.title} (${t.iso_3166_1})` : (t.title ?? "")));
		group("Also known as", alts);
	}

	/** Tagline, full overview, and the keywords TMDB tags a title with. */
	private renderStoryline(el: HTMLElement, meta: TmdbFilm | TmdbShow): void {
		if (meta.tagline) el.createDiv({ cls: "reel-tagline", text: meta.tagline });
		if (this.entry.overview) el.createDiv({ cls: "reel-facet-prose", text: this.entry.overview });

		// Keywords are far more specific than genres — "heist", "unreliable
		// narrator". They are fetched on every title but only ever used to
		// derive content flags, never stored and never shown. Read straight
		// from the payload here rather than adding a field to every note.
		const keywords = keywordNames(meta);
		if (keywords.length) {
			const box = el.createDiv({ cls: "reel-facet-group" });
			box.createDiv({ cls: "reel-facet-label", text: "Keywords" });
			const chips = box.createDiv({ cls: "reel-chips" });
			for (const k of keywords.slice(0, 24)) {
				const chip = chips.createEl("button", { cls: "reel-chip", text: k, attr: { type: "button" } });
				chip.addEventListener("click", () => void this.plugin.openViewWithSearch(k));
			}
		}
	}

	/**
	 * The parents-guide substitute.
	 *
	 * IMDb's own bands are not available through any API, so this derives the
	 * same shape from DoesTheDogDie's community votes: what share of people
	 * said a thing happens decides mild / moderate / severe. The vote counts
	 * are shown rather than hidden, because a 3-vote "severe" and a 300-vote
	 * one deserve different amounts of trust, and the link to IMDb's fuller
	 * guide sits alongside.
	 */
	private renderContent(el: HTMLElement): void {
		const e = this.entry;

		if (e.certification) {
			const box = el.createDiv({ cls: "reel-facet-group" });
			box.createDiv({ cls: "reel-facet-label", text: "Certificate" });
			box.createDiv({ cls: "reel-facet-value", text: e.certification });
		}

		if (e.contentTopics.length) {
			const box = el.createDiv({ cls: "reel-facet-group" });
			box.createDiv({ cls: "reel-facet-label", text: "Reported by viewers" });
			// Deliberately not graded mild/moderate/severe. Only the topic
			// names are stored — the vote counts are used to decide whether a
			// topic qualifies at all and then discarded — so any severity band
			// shown here would be invented. What these do mean is precise: a
			// majority of voters, above a minimum sample, said it happens.
			box.createDiv({
				cls: "reel-dim",
				text: "Topics a majority of DoesTheDogDie voters confirmed. Not severity-rated — IMDb's guide below grades them.",
			});
			for (const topic of e.contentTopics.slice(0, 40)) {
				const row = box.createDiv({ cls: "reel-content-row" });
				row.createSpan({ cls: "reel-band reported" });
				row.createSpan({ cls: "reel-content-name", text: topic });
			}
		}

		if (e.contentFlags.length) {
			const box = el.createDiv({ cls: "reel-facet-group" });
			box.createDiv({ cls: "reel-facet-label", text: "Flags on this note" });
			const chips = box.createDiv({ cls: "reel-chips" });
			for (const f of e.contentFlags) {
				chips.createSpan({ cls: "reel-chip static", text: FLAG_LABELS[f as ContentFlag] ?? f });
			}
		}

		const imdb = imdbUrl(e.imdbId);
		if (imdb) {
			const a = el.createEl("a", { cls: "reel-btn", text: "Full parents guide on IMDb", href: `${imdb}parentalguide` });
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
		}

		if (!e.contentTopics.length) {
			el.createDiv({
				cls: "reel-dim",
				text: "No community content notes yet — add a DoesTheDogDie key in settings to fetch them.",
			});
		}
	}

	private renderGenres(el: HTMLElement, genres: { name: string }[]): void {
		const box = el.createDiv({ cls: "reel-facet-group" });
		box.createDiv({ cls: "reel-facet-label", text: "Genre" });
		const chips = box.createDiv({ cls: "reel-chips" });
		for (const g of genres) {
			const chip = chips.createEl("button", { cls: "reel-chip", text: g.name, attr: { type: "button" } });
			// Genres are a filter in your own library, not a lookup.
			chip.addEventListener("click", () => void this.plugin.openViewWithSearch(g.name));
		}
	}

	/** Per-country release dates, grouped by kind, as TMDB reports them. */
	private renderReleases(el: HTMLElement, film: TmdbFilm): void {
		const KIND: Record<number, string> = {
			1: "Premiere",
			2: "Theatrical limited",
			3: "Theatrical",
			4: "Digital",
			5: "Physical",
			6: "TV",
		};
		const rows: { kind: string; country: string; date?: string; cert?: string; note?: string }[] = [];
		for (const r of film.release_dates?.results ?? []) {
			for (const d of r.release_dates ?? []) {
				rows.push({
					kind: KIND[d.type ?? 3] ?? "Release",
					country: r.iso_3166_1 ?? "",
					date: d.release_date,
					cert: d.certification || undefined,
					note: d.note || undefined,
				});
			}
		}
		if (!rows.length) {
			el.createDiv({ cls: "reel-empty", text: "No release dates recorded." });
			return;
		}

		// Your own region first — it is the only row most people are looking
		// for, and it is otherwise buried alphabetically among fifty others.
		const mine = (this.plugin.settings.region || "US").toUpperCase();
		rows.sort((a, b) => {
			if (a.country === mine && b.country !== mine) return -1;
			if (b.country === mine && a.country !== mine) return 1;
			return (a.date ?? "").localeCompare(b.date ?? "");
		});

		for (const kind of Object.values(KIND)) {
			const group = rows.filter((r) => r.kind === kind);
			if (!group.length) continue;
			const box = el.createDiv({ cls: "reel-facet-group" });
			box.createDiv({ cls: "reel-facet-label", text: kind });
			for (const r of group.slice(0, 30)) {
				const line = box.createDiv({ cls: "reel-release-row" });
				line.createSpan({ cls: "reel-release-date", text: r.date ? prettyDate(r.date.slice(0, 10)) : "—" });
				const flag = flagEmoji(r.country);
				if (flag) line.createSpan({ cls: "reel-release-flag", text: flag });
				line.createSpan({ cls: "reel-release-country", text: r.country });
				if (r.cert) line.createSpan({ cls: "reel-badge cert", text: r.cert });
				if (r.note) line.createSpan({ cls: "reel-dim", text: r.note });
			}
		}
	}

	/**
	 * Stills and backdrops, fetched only when the tab is opened.
	 *
	 * Lazy on purpose: images are the largest block TMDB returns, and paying
	 * for them on every title added would be a poor trade for a tab most
	 * people never open.
	 */
	private async renderPhotos(el: HTMLElement, isTv: boolean): Promise<void> {
		el.createDiv({ cls: "reel-loading", text: "Loading photos…", attr: { role: "status" } });
		try {
			const data = await this.plugin.tmdb.getImages(this.entry.tmdbId, isTv ? "tv" : "movie");
			// The tab may have been switched away from while this was in flight.
			if (!el.isConnected) return;
			el.empty();

			const shots = (data.backdrops ?? []).map((b) => b.file_path).filter((p): p is string => !!p);
			if (!shots.length) {
				el.createDiv({ cls: "reel-empty", text: "No photos for this title." });
				return;
			}

			const grid = el.createDiv({ cls: "reel-photos" });
			for (const path of shots.slice(0, 24)) {
				const src = this.plugin.tmdb.posterUrl(path, "w500");
				if (!src) continue;
				const cell = grid.createDiv({ cls: "reel-photo" });
				const img = cell.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
				img.addEventListener("error", () => cell.remove());
			}
		} catch (e) {
			if (!el.isConnected) return;
			el.empty();
			el.createDiv({ cls: "reel-error", text: redact(e) });
		}
	}

	/**
	 * Community reviews from TMDB.
	 *
	 * Excerpted and linked, never reproduced whole: these are other people's
	 * writing, often thousands of words, and a tracker has no business
	 * republishing them. The opening lines are enough to decide whether to
	 * read the rest on TMDB.
	 */
	private renderReviews(el: HTMLElement, reviews: TmdbReview[]): void {
		for (const r of reviews.slice(0, 6)) {
			const box = el.createDiv({ cls: "reel-review" });

			const head = box.createDiv({ cls: "reel-review-head" });
			head.createSpan({ cls: "reel-review-author", text: r.author ?? r.author_details?.username ?? "Anonymous" });
			const stars = r.author_details?.rating;
			if (stars != null) head.createSpan({ cls: "reel-badge", text: `${stars}/10` });
			if (r.created_at) head.createSpan({ cls: "reel-dim", text: prettyDate(r.created_at.slice(0, 10)) });

			const body = (r.content ?? "").trim();
			if (body) {
				const excerpt = body.length > 320 ? `${body.slice(0, 320).trimEnd()}…` : body;
				box.createDiv({ cls: "reel-review-body", text: excerpt });
			}

			if (r.url) {
				const a = box.createEl("a", { cls: "reel-link", text: "Read on TMDB", href: r.url });
				a.setAttr("target", "_blank");
				a.setAttr("rel", "noopener");
			}
		}
	}

	/** Titles TMDB associates with this one — the "what next" question. */
	private renderRelated(el: HTMLElement, rows: TmdbSearchResult[]): void {
		const strip = el.createDiv({ cls: "reel-related" });
		for (const r of rows.slice(0, 20)) {
			const card = strip.createDiv({ cls: "reel-related-card" });
			card.setAttr("role", "button");
			card.setAttr("tabindex", "0");
			const poster = card.createDiv({ cls: "reel-related-poster" });
			this.plugin.posters.attach(poster, {
				posterUrl: this.plugin.tmdb.posterUrl(r.poster_path, "w342") ?? undefined,
				title: r.title ?? r.name ?? "",
			});
			card.createDiv({ cls: "reel-related-title", text: r.title ?? r.name ?? "Untitled" });

			// Already yours? Open it. Otherwise offer to add it — the two
			// things you might want, without a third screen in between.
			const open = () => {
				const mine = this.plugin.library.byTmdbId(r.id, r.media_type === "tv" ? "tv" : "film");
				if (mine) void this.plugin.openDetail(mine);
				else this.plugin.openSearch({ query: r.title ?? r.name ?? "" });
			};
			card.addEventListener("click", open);
			card.addEventListener("keydown", (ev: KeyboardEvent) => {
				if (ev.key === "Enter" || ev.key === " ") {
					ev.preventDefault();
					open();
				}
			});
		}
	}

	/** Mean of every episode rating across all seasons, or null if none. */
	private episodeAverage(): number | null {
		const values: number[] = [];
		for (const s of this.entry.seasons) {
			for (const v of Object.values(s.episode_ratings ?? {})) {
				if (typeof v === "number") values.push(v);
			}
		}
		if (!values.length) return null;
		return values.reduce((a, b) => a + b, 0) / values.length;
	}

	/* ------------------------------------------------------------------ */

	private renderControls(side: HTMLElement): void {
		const e = this.entry;
		const isTv = e.type === "tv";
		const box = side.createDiv({ cls: "reel-panel" });
		box.createDiv({ cls: "reel-panel-title", text: "Your entry" });

		const ratingBox = box.createDiv({ cls: "reel-control" });
		ratingBox.createDiv({ cls: "reel-field-label", text: "Rating" });
		const starRow = ratingBox.createDiv({ cls: "reel-rating-row" });
		renderStars(starRow, {
			value: e.rating,
			onChange: async (v) => {
				const file = this.file;
				if (!file) return;
				try {
					await this.plugin.notes.setRating(file, v ?? null);
					this.entry = { ...this.entry, rating: v };
					flash(starRow);
					this.plugin.undo.offer(v == null ? "Rating cleared" : `Rated ${v}`);
				} catch (err) {
					new Notice(`Reel: ${redact(err)}`);
				}
			},
		});

		const epAvg = this.episodeAverage();
		if (isTv && epAvg != null) {
			ratingBox.createDiv({
				cls: "reel-hint",
				text: `Episode average ${epAvg.toFixed(1)} — set automatically until you rate the series yourself.`,
			});
		}

		const likeBox = box.createDiv({ cls: "reel-control" });
		likeBox.createDiv({ cls: "reel-field-label", text: "Liked" });
		const heart = likeBox.createEl("button", { cls: "reel-heart", text: e.liked ? "♥ Liked" : "♡ Like" });
		heart.toggleClass("is-on", !!e.liked);
		heart.addEventListener("click", async () => {
			const file = this.file;
			if (!file) return;
			const on = await this.plugin.notes.toggleLiked(file);
			this.entry = { ...this.entry, liked: on };
			heart.setText(on ? "♥ Liked" : "♡ Like");
			heart.toggleClass("is-on", on);
			flash(heart);
		});

		// Lists were only reachable through a modal, which is a lot of taps for
		// something you mostly want to glance at and toggle.
		const known = this.plugin.library.lists();
		if (known.length || e.lists.length) {
			const listBox = box.createDiv({ cls: "reel-control" });
			listBox.createDiv({ cls: "reel-field-label", text: "Lists" });
			const listRow = listBox.createDiv({ cls: "reel-status-row" });
			for (const name of [...new Set([...known, ...e.lists])].sort()) {
				const pill = listRow.createEl("button", { cls: "reel-chip", text: name });
				const on = () => this.entry.lists.includes(name);
				pill.toggleClass("is-active", on());
				pill.addEventListener("click", () => {
					void (async () => {
						const file = this.file;
						if (!file) return;
						const next = on()
							? this.entry.lists.filter((l) => l !== name)
							: [...this.entry.lists, name];
						await this.plugin.notes.setLists(file, next);
						this.entry = { ...this.entry, lists: next };
						pill.toggleClass("is-active", on());
						flash(pill);
					})();
				});
			}
		}

		const statusBox = box.createDiv({ cls: "reel-control" });
		statusBox.createDiv({ cls: "reel-field-label", text: "Status" });
		const statusRow = statusBox.createDiv({ cls: "reel-status-row" });
		for (const status of isTv ? TV_STATUSES : FILM_STATUSES) {
			const pill = statusRow.createEl("button", { cls: "reel-chip", text: status });
			pill.toggleClass("is-active", this.entry.status === status);
			pill.addEventListener("click", async () => {
				const file = this.file;
				if (!file) return;
				await this.plugin.notes.setStatus(file, status);
				this.entry = { ...this.entry, status };
				statusRow.findAll(".reel-chip").forEach((c) => c.removeClass("is-active"));
				pill.addClass("is-active");
				flash(pill);
			});
		}
	}

	private renderActions(side: HTMLElement): void {
		const e = this.entry;
		const isTv = e.type === "tv";
		const box = side.createDiv({ cls: "reel-panel" });
		const actions = box.createDiv({ cls: "reel-detail-actions" });
		const act = (label: string, cta: boolean, fn: () => void) => {
			const b = actions.createEl("button", { cls: `reel-btn${cta ? " mod-cta" : ""}`, text: label });
			b.addEventListener("click", fn);
			return b;
		};

		if (!isTv) {
			act(e.watched.length ? "Log another watch" : "Log watch", true, () => {
				const file = this.file;
				if (file) new LogSheet(this.plugin.app, this.plugin, { file, entry: e }).open();
			});
		} else {
			const next = this.plugin.upNext.nextFor(e);
			if (next) {
				act(`Watched S${next.season}E${next.episode}`, true, async () => {
					const file = this.file;
					if (!file) return;
					await this.plugin.notes.markEpisode(file, next.season, next.episode);
					this.plugin.undo.offer(`S${next.season}E${next.episode} watched`);
				});
			}
			act("Start a rewatch", false, async () => {
				const file = this.file;
				if (!file) return;
				await this.plugin.notes.restartSeries(file, e.rating);
				this.plugin.undo.offer("Progress reset — previous run recorded");
			});
		}

		act("Lists", false, () => {
			const file = this.file;
			if (file) new ListPicker(this.plugin.app, this.plugin, e, file).open();
		});

		act("Refresh", false, async () => {
			try {
				// A refresh can add a season or rename episodes, so the cached
				// episode lists are stale by definition afterwards.
				this.episodeCache.clear();
				await this.plugin.notes.refreshMetadata(e);
				new Notice("Metadata refreshed");
			} catch (err) {
				new Notice(`Reel: ${redact(err)}`);
			}
		});

		// Removing a title meant leaving the plugin and deleting the note by
		// hand. It takes two taps rather than one, and it goes to whatever
		// trash Obsidian is configured to use rather than vanishing: a rating
		// you can't undo is an annoyance, a note you can't recover is not.
		const remove = actions.createEl("button", { cls: "reel-btn reel-btn-danger", text: "Remove" });
		remove.addEventListener("click", () => {
			if (remove.dataset.confirming !== "true") {
				remove.dataset.confirming = "true";
				remove.setText("Delete note?");
				// Reverts on its own, so a stray tap doesn't leave a live
				// delete button sitting there waiting to be hit.
				window.setTimeout(() => {
					if (!remove.isConnected) return;
					remove.dataset.confirming = "false";
					remove.setText("Remove");
				}, 4000);
				return;
			}
			void (async () => {
				const file = this.file;
				if (!file) return;
				try {
					await this.plugin.app.fileManager.trashFile(file);
					new Notice(`${e.title} moved to trash`);
					this.onBack();
				} catch (err) {
					new Notice(`Reel: ${redact(err)}`);
				}
			})();
		});
	}

	/** Cast, streaming and flags as aligned rows rather than run-on lines. */
	private renderMeta(side: HTMLElement): void {
		const e = this.entry;
		const rows: [string, string][] = [];
		if (e.cast.length) {
			// Pair each actor with the part they played, where we have it —
			// "Rainn Wilson as Dwight Schrute" says far more than either alone.
			const names = e.cast.map(unlink);
			const paired = names.map((n, i) => {
				const character = e.characters[i];
				return character ? `${n} as ${character}` : n;
			});
			rows.push(["Cast", paired.join(" · ")]);
		}
		if (e.providers.length) rows.push(["Streaming", e.providers.join(", ")]);
		if (e.collection) rows.push(["Collection", e.collection]);
		if (e.productionCompanies.length) rows.push(["Studio", e.productionCompanies.slice(0, 3).join(", ")]);

		if (e.contentFlags.length) {
			rows.push(["Contains", e.contentFlags.map((f) => FLAG_LABELS[f as ContentFlag] ?? f).join(", ")]);
		}
		if (!rows.length) return;

		const box = side.createDiv({ cls: "reel-panel" });
		box.createDiv({ cls: "reel-panel-title", text: "Details" });
		const dl = box.createDiv({ cls: "reel-meta" });
		for (const [k, v] of rows) {
			const row = dl.createDiv({ cls: "reel-meta-row" });
			row.createDiv({ cls: "reel-meta-key", text: k });
			row.createDiv({ cls: "reel-meta-value", text: v });
		}
	}

	/* ------------------------------------------------------------------ */

	private renderSeasons(main: HTMLElement): void {
		const e = this.entry;
		const wrap = main.createDiv({ cls: "reel-panel" });
		wrap.createDiv({ cls: "reel-panel-title", text: "Seasons" });

		const strip = wrap.createDiv({ cls: "reel-seasons" });
		for (const s of e.seasons) {
			const total = s.total ?? 0;
			const seen = rangeCount(s.watched);
			const pill = strip.createDiv({ cls: "reel-season-pill" });
			pill.createSpan({ cls: "reel-season-n", text: `S${s.n}` });
			pill.createSpan({ cls: "reel-dim", text: total ? `${seen}/${total}` : String(seen) });
			if (s.rating != null) pill.createSpan({ cls: "reel-season-rating", text: `${s.rating}★` });
			if (total && seen >= total) pill.addClass("is-complete");
			else if (seen > 0) pill.addClass("is-partial");
			if (this.openSeason === s.n) pill.addClass("is-open");
			pill.setAttr("aria-expanded", String(this.openSeason === s.n));
			pill.setCssProps({ "--reel-fill": total ? String(Math.min(1, seen / total)) : "0" });
			pill.addEventListener("click", () => {
				this.openSeason = this.openSeason === s.n ? null : s.n;
				this.rerender();
			});
		}

		if (this.openSeason != null) void this.renderEpisodes(wrap, this.openSeason);
	}

	private async renderEpisodes(wrap: HTMLElement, season: number): Promise<void> {
		const e = this.entry;
		const listEl = wrap.createDiv({ cls: "reel-episodes" });
		listEl.createDiv({ cls: "reel-loading", text: `Loading season ${season}…`, attr: { role: "status" } });

		let episodes = this.episodeCache.get(season);
		if (!episodes) {
			const ended = e.showStatus === "Ended" || e.showStatus === "Canceled";
			try {
				const data = await this.plugin.tmdb.getSeason(e.tmdbId, season, ended);
				episodes = (data.episodes ?? []).filter((x) => x.episode_number > 0);
				this.episodeCache.set(season, episodes);
			} catch (err) {
				listEl.empty();
				listEl.createDiv({ cls: "reel-error", text: redact(err) });
				return;
			}
		}

		const row = e.seasons.find((s) => s.n === season);
		const watched = new Set(parseRange(row?.watched));
		const ratings: Record<string, number> = { ...(row?.episode_ratings ?? {}) };

		listEl.empty();
		let firstUnwatched: HTMLElement | null = null;

		const remaining = episodes.filter((x) => !watched.has(x.episode_number)).length;
		if (remaining) {
			listEl.createDiv({
				cls: "reel-block-count",
				text: `${remaining} of ${episodes.length} left in season ${season}`,
			});
		}

		const bulk = listEl.createDiv({ cls: "reel-season-bulk" });
		const markAll = bulk.createEl("button", { cls: "reel-chip", text: "Mark all watched" });
		markAll.addEventListener("click", async () => {
			const file = this.file;
			if (!file || !episodes) return;
			await this.plugin.notes.setSeasonRange(file, season, `1-${episodes.length}`);
			this.plugin.undo.offer(`Season ${season} marked watched`);
		});
		const clear = bulk.createEl("button", { cls: "reel-chip", text: "Clear" });
		clear.addEventListener("click", async () => {
			const file = this.file;
			if (!file) return;
			await this.plugin.notes.setSeasonRange(file, season, "");
			// The one bulk action that throws away every tick in a season.
			this.plugin.undo.offer(`Season ${season} cleared`);
		});

		for (const ep of episodes) {
			const n = ep.episode_number;
			const epRow = listEl.createDiv({ cls: "reel-episode" });
			epRow.toggleClass("is-watched", watched.has(n));

			const tick = epRow.createDiv({ cls: "reel-episode-tick" });
			tick.createSpan({ text: "✓" });
			tick.setAttr("aria-label", `Episode ${n}`);
			tick.setAttr("role", "button");
			tick.setAttr("aria-label", `Toggle episode ${n}`);
			tick.addEventListener("click", async () => {
				const file = this.file;
				if (!file) return;
				if (watched.has(n)) watched.delete(n);
				else watched.add(n);
				epRow.toggleClass("is-watched", watched.has(n));
				const range = formatRange([...watched]);
				await this.plugin.notes.setSeasonRange(file, season, range);
				// Keep the in-memory entry in step so the season pill counts are
				// right if you collapse the season, without re-reading an index
				// that hasn't caught up with this write yet.
				this.entry = {
					...this.entry,
					seasons: this.entry.seasons.map((s) => (s.n === season ? { ...s, watched: range } : s)),
				};
			});

			const epBody = epRow.createDiv({ cls: "reel-episode-body" });
			epBody.createDiv({ cls: "reel-episode-title", text: `${n}. ${ep.name ?? `Episode ${n}`}` });
			const meta = epBody.createDiv({ cls: "reel-episode-meta" });
			if (ep.air_date) meta.createSpan({ text: prettyDate(ep.air_date) });
			if (ep.runtime) meta.createSpan({ text: `${ep.runtime}m` });

			// The stars own their own state. Re-rendering here would read the
			// index before Obsidian has reparsed the file and paint the old
			// value straight back over the new one.
			const starWrap = epRow.createDiv({ cls: "reel-episode-stars" });
			starWrap.setAttr("aria-label", `Rate episode ${n}`);
			renderStars(starWrap, {
				value: ratings[String(n)],
				compact: true,
				onChange: async (v) => {
					const file = this.file;
					if (!file) return;
					if (v == null) delete ratings[String(n)];
					else {
						ratings[String(n)] = v;
						watched.add(n);
						epRow.addClass("is-watched");
					}
					await this.plugin.notes.rateEpisode(file, season, n, v ?? null);
					this.plugin.undo.offer(v == null ? `S${season}E${n} cleared` : `S${season}E${n} rated ${v}`);
				},
			});

			// Opening season 4 of a show you're 18 episodes into should land on
			// episode 19, not make you scroll past everything you've seen.
			if (!firstUnwatched && !watched.has(n)) {
				firstUnwatched = epRow;
			}
		}

		if (firstUnwatched) {
			// After layout, or the offset is measured against nothing.
			window.setTimeout(() => firstUnwatched?.scrollIntoView({ block: "nearest" }), 0);
		}
	}

	private renderHistory(main: HTMLElement): void {
		const e = this.entry;
		if (!e.watched.length) return;
		const wrap = main.createDiv({ cls: "reel-panel" });
		wrap.createDiv({ cls: "reel-panel-title", text: `Watch history — ${e.watched.length}` });
		const list = wrap.createDiv({ cls: "reel-history" });
		for (const w of [...e.watched].reverse()) {
			const row = list.createDiv({ cls: "reel-history-row" });
			row.createSpan({ text: prettyDate(w.date) });
			if (w.rating != null) row.createSpan({ cls: "reel-dim", text: `★ ${w.rating}` });
			if (w.rewatch) row.createSpan({ cls: "reel-badge subtle", text: "rewatch" });
		}
	}
}
