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

import { Menu, Notice, TFile, setIcon } from "obsidian";
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
import { formatMinutes, prettyDate, todayISO } from "../util/dates";
import { formatRange, parseRange, rangeCount } from "../util/ranges";
import { renderStars } from "./stars";
import { LogSheet } from "./logSheet";
import { ListPicker } from "./listPicker";
import { PersonSheet } from "./personSheet";
import { paintRelatedFeed } from "./relatedFeed";
import { fetchImdbGuide } from "../imdbGuide";
import { attachSources } from "./sources";
import { imdbUrl, tmdbUrl, keywordNames } from "../extract";
import { paintTrailerFor } from "./titleExtras";
import { unlink } from "../library";
import { compactCount } from "../util/format";
import { ContentFlag, FLAG_LABELS, certificationFromContentRatings, certificationFromReleaseDates } from "../content";
import { haptic } from "../util/haptics";
import { badgePerson } from "./personBadge";
import { ReviewEditor, paintReviews, readReviews } from "./reviewPane";
import { episodeLabelOf } from "../reviews";
import { holdAt, showChipMenu, showPersonMenu, showResultMenu, showTitleMenu } from "./titleMenu";

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
	/** Set once the tabs exist: switch to one by id and bring it into view. */
	private jumpToTab: ((id: string) => void) | null = null;

	constructor(
		private plugin: ReelPlugin,
		private entry: Entry,
		private onBack: () => void,
		/** Where you came from, so the back button doesn't claim otherwise. */
		private backLabel = "Library",
		/** A tab to open on arrival, by id (for example "content" for the Parents guide). */
		private startTab?: string
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

		const more = bar.createEl("button", { cls: "reel-btn reel-detail-more", attr: { type: "button", "aria-label": "More actions" } });
		setIcon(more.createSpan(), "more-horizontal");
		more.addEventListener("click", () => {
			const r = more.getBoundingClientRect();
			showTitleMenu(this.plugin, this.entry, r.right, r.bottom, { onDetail: true });
		});

		const page = container.createDiv({ cls: "reel-detail-page" });
		// Asynchronous, and deliberately not awaited: the page renders in the
		// theme's own colours and the tint arrives a frame or two later. Making
		// a screen wait on a canvas read would be a poor trade for a colour.
		this.plugin.swatches.tint(page, this.plugin.posters.displayUrl(e), document.body.hasClass("theme-dark"));

		/* ---- hero ------------------------------------------------------ */
		const hero = page.createDiv({ cls: "reel-hero" });
		this.paintBackdrop(hero, e);

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
		/**
		 * One score chip.
		 *
		 * `outOf` is the fix for a real misreading: your 4 out of 5 sat beside
		 * TMDB's 8 out of 10 as bare numbers, so an identical judgement looked
		 * like half the score. Four different scales were on that row at once
		 * — 5, 10, 100 and a percentage — with nothing to say so.
		 */
		const score = (label: string, value: string, cls: string, outOf?: string) => {
			const chip = scores.createDiv({ cls: `reel-score ${cls}` });
			const v = chip.createDiv({ cls: "reel-score-value", text: value });
			// Attached to the number, and much smaller, so the score still
			// reads at a glance and the denominator is there when compared.
			if (outOf) v.createSpan({ cls: "reel-score-scale", text: `/${outOf}` });
			chip.createDiv({ cls: "reel-score-label", text: label });
		};
		if (e.rating != null) score("You", String(e.rating), "mine", "5");
		const epAvg = this.episodeAverage();
		if (epAvg != null) score("Episodes", epAvg.toFixed(1), "mine", "5");
		if (e.imdbRating != null) {
			// The sample size belongs with the score. 7.9 from 1.2M voters and
			// 7.9 from 400 are different claims, and the number alone hides it.
			score("IMDb", e.imdbRating.toFixed(1), "imdb", "10");
			if (e.imdbVotes) {
				const chip = scores.lastElementChild;
				chip?.createDiv({ cls: "reel-score-votes", text: compactCount(e.imdbVotes) });
			}
		}
		if (e.metacritic != null) {
			score("Metacritic", String(e.metacritic), e.metacritic >= 61 ? "meta-good" : e.metacritic >= 40 ? "meta-mixed" : "meta-bad", "100");
		}
		// Already carries its own % sign, so a denominator would be redundant.
		if (e.rottenTomatoes != null) score("Tomatoes", `${e.rottenTomatoes}%`, e.rottenTomatoes >= 60 ? "fresh" : "rotten");
		if (e.tmdbRating != null) score("TMDB", e.tmdbRating.toFixed(1), "", "10");

		/**
		 * How your score compares once the scales match.
		 *
		 * The denominators alone still leave you doing the arithmetic. This
		 * does it: your rating doubled onto TMDB's ten-point scale, so "same
		 * as TMDB" or "a point above" is stated rather than inferred.
		 */
		if (e.rating != null) {
			const theirs = e.imdbRating ?? e.tmdbRating;
			const source = e.imdbRating != null ? "IMDb" : "TMDB";
			if (theirs != null) {
				const mine = e.rating * 2;
				const delta = Math.round((mine - theirs) * 10) / 10;
				const text =
					Math.abs(delta) < 0.5
						? `Your ${e.rating} is about the same as ${source}'s ${theirs.toFixed(1)}`
						: `Your ${e.rating} is ${Math.abs(delta).toFixed(1)} ${delta > 0 ? "above" : "below"} ${source}, on their scale`;
				body.createDiv({ cls: "reel-score-compare", text });
			}
		}
		if (!scores.childElementCount) scores.remove();

		if (e.genres.length) {
			const g = body.createDiv({ cls: "reel-hero-genres" });
			e.genres.forEach((x) => g.createSpan({ cls: "reel-chip static", text: x }));
		}

		if (e.overview) body.createDiv({ cls: "reel-hero-overview", text: e.overview });

		/*
		 * The trailer plays here, rather than in a browser.
		 *
		 * It had button weight already, which fixed it being missed — but it
		 * still threw you out of Obsidian to watch thirty seconds of footage and
		 * then made you find your way back. Embedding keeps the decision on the
		 * screen where the rest of the decision is.
		 *
		 * Above the links, because it is the thing being offered rather than one
		 * of a row of destinations. Still click-to-load: mounting an iframe on
		 * arrival would cost a YouTube request and a set of cookies on every
		 * title you open, most of which you close again.
		 */
		// Always offered, not only when frontmatter happens to carry it — a note
		// written before the field existed had no player and no explanation.
		void paintTrailerFor(this.plugin, body.createDiv({ cls: "reel-detail-trailer" }), e.tmdbId, isTv, e.trailer);

		const links = body.createDiv({ cls: "reel-links" });

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
		// Opens the Parents guide tab on this page, not a browser: the tab has the
		// estimate, IMDb's guide in the app's style, and the link out as a last resort.
		const guide = links.createEl("a", { cls: "reel-link guide", text: "Parents guide", attr: { role: "button", tabindex: "0" } });
		const goGuide = (ev: Event): void => {
			ev.preventDefault();
			this.jumpToTab?.("content");
		};
		guide.addEventListener("click", goGuide);
		guide.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (ev.key === "Enter" || ev.key === " ") goGuide(ev);
		});

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
	/** The reference tabs on their own, for a title that is not in the library. */
	renderReference(main: HTMLElement, isTv: boolean): Promise<void> {
		return this.renderFacets(main, isTv);
	}

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
		// Recommendations first (people who liked it), then "similar" (shared
		// keywords and genres), with no title twice and none that is this one.
		const related: TmdbSearchResult[] = [];
		for (const r of [...(meta.recommendations?.results ?? []), ...(meta.similar?.results ?? [])]) {
			if (r.id === this.entry.tmdbId || related.some((x) => x.id === r.id)) continue;
			related.push(r);
		}

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

		// More like this, for a title you own as much as one you do not: the same
		// strip everywhere, and it keeps loading as you scroll along it.
		if (related.length) {
			wrap.createDiv({ cls: "reel-block-title", text: "More like this" });
			paintRelatedFeed(this.plugin, wrap, {
				tmdbId: this.entry.tmdbId,
				isTv,
				seed: related.filter((r) => !r.adult && r.poster_path),
				layout: "strip",
				// On a title page opened from elsewhere, going to one of your own
				// titles closes this page first.
				beforeOpenMine: () => {
					if (!this.entry.path) this.onBack();
				},
			});
		}

		const tabs: { id: string; label: string; render: (el: HTMLElement) => void }[] = [];

		// Few, full sections rather than many thin ones: a section that had only
		// a line or two now lives inside a bigger one.
		tabs.push({ id: "about", label: "About", render: (el) => this.renderAbout(el, meta) });
		tabs.push({ id: "details", label: "Details", render: (el) => this.renderFacts(el, meta, isTv) });
		if (film && (film.budget || film.revenue)) {
			tabs.push({ id: "money", label: "Box office", render: (el) => this.renderMoney(el, film, imdbIdOf(film)) });
		}
		tabs.push({ id: "stats", label: "Stats", render: (el) => this.renderStats(el, meta, isTv) });
		if (cast.length) tabs.push({ id: "cast", label: "Cast", render: (el) => this.renderPeople(el, cast, true) });
		if (crew.length) tabs.push({ id: "crew", label: "Crew", render: (el) => this.renderPeople(el, crew, false) });
		if (film?.release_dates?.results?.length) {
			tabs.push({ id: "releases", label: "Releases", render: (el) => this.renderReleases(el, film) });
		}
		// A parents-guide view for every title, not only ones with community
		// notes: the rating, flags estimated from TMDB's keywords, and one tap
		// to IMDb's own guide.
		const region = (this.plugin.settings.region || "US").toUpperCase();
		const cert =
			this.entry.certification ??
			(isTv ? certificationFromContentRatings((meta as TmdbShow).content_ratings, region) : certificationFromReleaseDates(film?.release_dates, region));
		const imdbId = this.entry.imdbId ?? meta.external_ids?.imdb_id ?? film?.imdb_id ?? undefined;
		if (this.entry.contentTopics.length || cert || imdbId) {
			tabs.push({ id: "content", label: "Parents guide", render: (el) => this.renderContent(el, { cert, imdbId }) });
		}
		if (related.length) tabs.push({ id: "related", label: "Similar", render: (el) => this.renderRelated(el, related) });

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

		// A wrapper holds the artwork; the strip inside it still scrolls.
		//
		// The wash cannot live on the strip itself. The strip is a horizontal
		// scroller — nine tabs in 323px on a phone — and anything absolutely
		// positioned inside a scroll container scrolls away with the content,
		// so the image would cover the first screenful of tabs and nothing
		// after it. Clipping the strip to stop that just disables the scroll
		// and strands the last four tabs off the edge.
		const shell = wrap.createDiv({ cls: "reel-facet-tabwrap" });
		const bar = shell.createDiv({ cls: "reel-facet-tabs" });
		// The film, behind its own tabs.
		//
		// "Cast / Crew / Details / Storyline" was five identical grey words in
		// a row, and a row of words is the most text-shaped thing an interface
		// can be. The strip carries the title's own frame, blurred, so the tabs
		// are part of the thing you are reading about rather than a control
		// panel bolted above it. One image, already loaded for the hero.
		const strip = this.plugin.posters.washUrl(this.entry);
		if (strip) {
			shell.addClass("has-wash");
			shell.setCssProps({ "--reel-wash": `url("${strip}")` });
		}
		const body = wrap.createDiv({ cls: "reel-facet-body" });
		const buttons: HTMLElement[] = [];

		const show = (i: number) => {
			buttons.forEach((b, n) => b.toggleClass("is-active", n === i));
			body.empty();
			tabs[i].render(body);
			// Hold the tab for the other sites that cover it.
			attachSources(this.plugin, body, tabs[i].id, {
				title: this.entry.title,
				year: this.entry.year ?? this.entry.firstAirYear,
				imdbId: this.entry.imdbId ?? meta.external_ids?.imdb_id ?? film?.imdb_id ?? undefined,
				tmdbId: this.entry.tmdbId,
				isTv,
			});
		};
		this.jumpToTab = (id: string) => {
			const i = tabs.findIndex((t) => t.id === id);
			if (i < 0) return;
			show(i);
			buttons[i]?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
		};

		tabs.forEach((t, i) => {
			const b = bar.createEl("button", { cls: "reel-facet-tab", text: t.label, attr: { type: "button" } });
			buttons.push(b);
			b.addEventListener("click", () => show(i));
		});
		show(0);
		if (this.startTab) requestAnimationFrame(() => this.jumpToTab?.(this.startTab as string));
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
				holdAt(a, (x, y) => showPersonMenu(this.plugin, p, x, y, () => this.openPerson(p)));
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
			// Your own view of this person, wherever they appear. Rating an
			// actor used to be visible only on the screen where you set it.
			badgePerson(this.plugin, shot, p.id);
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
			holdAt(cell, (x, y) => showPersonMenu(this.plugin, p, x, y, open));
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
			// Unnamed before this: the photo has an empty alt (it is
			// decorative) and the name is a child span, so there was nothing
			// for the row itself to announce.
			row.setAttr("aria-label", `${p.name} — open their filmography`);

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
			holdAt(row, (x, y) => showPersonMenu(this.plugin, p, x, y, open));
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
	/** A quiet label-and-value list: the one shape every reference section uses. */
	private factList(el: HTMLElement, title: string | null, rows: [string, string | HTMLElement | null | undefined][]): void {
		const shown = rows.filter(([, v]) => v != null && v !== "");
		if (!shown.length) return;
		const box = el.createDiv({ cls: "reel-fl" });
		if (title) box.createDiv({ cls: "reel-fl-title", text: title });
		for (const [label, value] of shown) {
			const row = box.createDiv({ cls: "reel-fl-row" });
			row.createDiv({ cls: "reel-fl-label", text: label });
			const v = row.createDiv({ cls: "reel-fl-value" });
			if (typeof value === "string") v.setText(value);
			else if (value) v.appendChild(value);
		}
	}

	/** Tagline, the full overview, genres and keywords: what it is about. */
	private renderAbout(el: HTMLElement, meta: TmdbFilm | TmdbShow): void {
		if (meta.tagline) el.createDiv({ cls: "reel-tagline", text: meta.tagline });
		if (this.entry.overview) el.createDiv({ cls: "reel-facet-prose", text: this.entry.overview });

		const chipGroup = (label: string, names: string[]): void => {
			if (!names.length) return;
			const box = el.createDiv({ cls: "reel-fl" });
			box.createDiv({ cls: "reel-fl-title", text: label });
			const chips = box.createDiv({ cls: "reel-chips" });
			for (const n of names) {
				const chip = chips.createEl("button", { cls: "reel-chip", text: n, attr: { type: "button" } });
				// Both are searches of your own library, not a lookup.
				chip.addEventListener("click", () => void this.plugin.openViewWithSearch(n));
				holdAt(chip, (x, y) => showChipMenu(this.plugin, n, x, y));
			}
		};
		chipGroup("Genres", (meta.genres ?? []).map((g) => g.name));
		chipGroup("Keywords", keywordNames(meta).slice(0, 24));
	}

	private renderFacts(el: HTMLElement, meta: TmdbFilm | TmdbShow, isTv: boolean): void {
		const film = isTv ? undefined : (meta as TmdbFilm);
		const show = isTv ? (meta as TmdbShow) : undefined;
		const lang = (code?: string): string | undefined => {
			if (!code) return undefined;
			try {
				return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
			} catch {
				return code;
			}
		};
		const list = (names: (string | undefined)[]): string => names.filter(Boolean).join(", ");

		const date = film?.release_date ?? show?.first_air_date;
		this.factList(el, "Title", [
			["Released", date ? prettyDate(date.slice(0, 10)) : undefined],
			[
				"Runtime",
				film?.runtime ? formatMinutes(film.runtime) : show?.episode_run_time?.[0] ? `${show.episode_run_time[0]} min per episode` : undefined,
			],
			["Status", film?.status ?? show?.status],
			["Original title", film?.original_title && film.original_title !== film.title ? film.original_title : undefined],
			["Original language", lang(meta.original_language)],
			["Part of", film?.belongs_to_collection?.name],
			["Type", show?.type],
		]);

		this.factList(el, "Made by", [
			["Studios", list((meta.production_companies ?? []).map((c) => c.name))],
			["Networks", list((show?.networks ?? []).map((n) => n.name))],
			["Countries", list((film?.production_countries ?? []).map((c) => c.name)) || list(show?.origin_country ?? [])],
			["Languages", list((film?.spoken_languages ?? []).map((l) => l.english_name ?? l.name))],
		]);

		let site: HTMLElement | null = null;
		if (meta.homepage) {
			site = createEl("a", { cls: "reel-link", text: meta.homepage.replace(/^https?:\/\//, "").replace(/\/$/, ""), href: meta.homepage });
			site.setAttr("target", "_blank");
			site.setAttr("rel", "noopener");
		}
		// Alternative titles are how you find a film you know under another
		// name, so the local ones are worth surfacing.
		const alts = (film?.alternative_titles?.titles ?? [])
			.filter((t) => t.title)
			.slice(0, 8)
			.map((t) => (t.iso_3166_1 ? `${t.title} (${t.iso_3166_1})` : (t.title ?? "")));
		this.factList(el, "More", [
			["Official site", site],
			["Also known as", alts.join(", ")],
		]);
	}

	/**
	 * Budget, takings and what is left over, drawn as one comparison.
	 *
	 * TMDB reports a budget and a worldwide gross and nothing finer: how a
	 * budget was split between cast, effects and marketing is not published
	 * anywhere an API can reach, so none of that is invented here.
	 */
	private renderMoney(el: HTMLElement, film: TmdbFilm, imdbId?: string): void {
		const budget = film.budget ?? 0;
		const revenue = film.revenue ?? 0;
		const money = (n: number): string => {
			if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
			if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
			return `$${n.toLocaleString()}`;
		};
		const tiles = el.createDiv({ cls: "reel-money" });
		const tile = (label: string, value: string, cls = ""): void => {
			const t = tiles.createDiv({ cls: `reel-money-tile ${cls}`.trim() });
			t.createDiv({ cls: "reel-money-value", text: value });
			t.createDiv({ cls: "reel-money-label", text: label });
		};
		tile("Budget", budget ? money(budget) : "Not reported");
		tile("Worldwide gross", revenue ? money(revenue) : "Not reported");
		if (budget && revenue) {
			const net = revenue - budget;
			tile(net >= 0 ? "Gross profit" : "Gross loss", `${net < 0 ? "−" : ""}${money(Math.abs(net))}`, net >= 0 ? "is-up" : "is-down");
		}

		if (budget && revenue) {
			const top = Math.max(budget, revenue);
			const bars = el.createDiv({ cls: "reel-money-bars" });
			for (const [label, v] of [
				["Budget", budget],
				["Gross", revenue],
			] as const) {
				const row = bars.createDiv({ cls: "reel-money-bar" });
				row.createSpan({ cls: "reel-money-bar-label", text: label });
				const track = row.createDiv({ cls: "reel-money-track" });
				track.createDiv({ cls: "reel-money-fill" }).setCssProps({ "--reel-fill": String(v / top) });
			}
		}

		const rows: [string, string | undefined][] = [];
		if (budget && revenue) {
			rows.push(["Returned", `${(revenue / budget).toFixed(1)}× its budget`]);
			// Cinemas keep roughly half of a ticket, so a film needs to gross
			// about twice its budget to break even in theatres. A rule of
			// thumb, and said as one.
			rows.push([
				"Break-even",
				revenue >= budget * 2 ? "Cleared the usual 2× theatrical break-even" : "Short of the usual 2× theatrical break-even",
			]);
		}
		if (film.runtime && budget) rows.push(["Budget per minute", money(Math.round(budget / film.runtime))]);
		this.factList(el, "The numbers", rows);

		// The US and Canada figure is from OMDb (what IMDb lists); the rest of the
		// world is the difference from TMDB's worldwide total, so it is labelled
		// as that. Needs the OMDb key; without one the tab is as before.
		const split = el.createDiv({ cls: "reel-money-split" });
		if (imdbId && revenue) {
			void this.plugin.omdb.fetchScores(imdbId).then((s) => {
				if (!split.isConnected || !s?.boxOffice) return;
				const us = Math.min(s.boxOffice, revenue);
				const rest = revenue - us;
				const rows2: [string, string | undefined][] = [
					["US and Canada", `${money(us)} · ${Math.round((us / revenue) * 100)}%`],
					["Rest of the world", rest > 0 ? `${money(rest)} · ${Math.round((rest / revenue) * 100)}%` : undefined],
					["Awards", s.awards],
				];
				const bar = split.createDiv({ cls: "reel-money-bars" });
				const row = bar.createDiv({ cls: "reel-money-bar" });
				row.createSpan({ cls: "reel-money-bar-label", text: "US share" });
				const track = row.createDiv({ cls: "reel-money-track" });
				track.createDiv({ cls: "reel-money-fill" }).setCssProps({ "--reel-fill": String(us / revenue) });
				this.factList(split, "Where it earned", rows2);
			});
		}

		el.createDiv({
			cls: "reel-dim reel-fl-note",
			text: "Budget and worldwide gross are from TMDB; the US split is from OMDb (add a free key in settings). US dollars, not adjusted for inflation. Studios do not publish how a budget was spent, so there is no breakdown.",
		});
	}

	/** Ratings, scale and how this title sits against the rest of your library. */
	private renderStats(el: HTMLElement, meta: TmdbFilm | TmdbShow, isTv: boolean): void {
		const film = isTv ? undefined : (meta as TmdbFilm);
		const show = isTv ? (meta as TmdbShow) : undefined;
		const e = this.entry;
		const mine = this.plugin.library.all().filter((x) => x.type === e.type && x.path !== e.path);

		const rows: [string, string | undefined][] = [];
		if (meta.vote_average) {
			rows.push(["TMDB score", `${meta.vote_average.toFixed(1)} of 10${meta.vote_count ? ` · ${meta.vote_count.toLocaleString()} votes` : ""}`]);
			const scored = mine.filter((x) => x.tmdbRating);
			if (scored.length >= 5) {
				const below = scored.filter((x) => (x.tmdbRating ?? 0) < (meta.vote_average ?? 0)).length;
				rows.push(["In your library", `Scores higher than ${Math.round((below / scored.length) * 100)}% of your ${isTv ? "series" : "films"}`]);
			}
		}
		if (e.rating != null && meta.vote_average) {
			const diff = e.rating * 2 - meta.vote_average;
			const how = Math.abs(diff) < 0.3 ? "level with" : diff > 0 ? `${diff.toFixed(1)} above` : `${(-diff).toFixed(1)} below`;
			rows.push(["You vs TMDB", `You gave it ${e.rating} of 5, ${how} TMDB`]);
		}
		if (meta.popularity) rows.push(["Popularity", meta.popularity.toFixed(0)]);
		this.factList(el, "Reception", rows);

		const scale: [string, string | undefined][] = [];
		if (film?.runtime) {
			const lens = mine.map((x) => x.runtime).filter((n): n is number => !!n);
			scale.push(["Runtime", formatMinutes(film.runtime)]);
			if (lens.length >= 5) {
				const avg = Math.round(lens.reduce((a, b) => a + b, 0) / lens.length);
				const d = film.runtime - avg;
				scale.push(["Against your average", `${formatMinutes(avg)}, so this is ${Math.abs(d)} min ${d >= 0 ? "longer" : "shorter"}`]);
			}
		}
		if (show) {
			scale.push(["Seasons", show.number_of_seasons ? String(show.number_of_seasons) : undefined]);
			scale.push(["Episodes", show.number_of_episodes ? String(show.number_of_episodes) : undefined]);
			scale.push(["Episode length", show.episode_run_time?.[0] ? `${show.episode_run_time[0]} min` : undefined]);
			if (show.number_of_episodes && show.episode_run_time?.[0]) {
				const mins = show.number_of_episodes * show.episode_run_time[0];
				scale.push(["Time to watch it all", `${Math.round(mins / 60)} hours`]);
			}
			scale.push(["First aired", show.first_air_date ? prettyDate(show.first_air_date.slice(0, 10)) : undefined]);
			scale.push(["Last aired", show.last_air_date ? prettyDate(show.last_air_date.slice(0, 10)) : undefined]);
			const avg = this.episodeAverage();
			if (avg != null) scale.push(["Your episode average", `${avg.toFixed(1)} of 5`]);
		}
		this.factList(el, isTv ? "Scale" : "Length", scale);

		const watched = e.watched?.length ?? 0;
		this.factList(el, "You", [
			["Watched", watched ? `${watched} time${watched === 1 ? "" : "s"}` : undefined],
			["Last watched", watched ? prettyDate(String(e.watched[watched - 1].date).slice(0, 10)) : undefined],
		]);
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
	/** IMDb's guide in this app's style. It loads by itself when the tab opens. */
	private renderImdbReader(el: HTMLElement, imdbId: string): void {
		const box = el.createDiv({ cls: "reel-fl reel-guide-reader" });
		box.createDiv({ cls: "reel-fl-title", text: "From IMDb" });
		const body = box.createDiv({ cls: "reel-guide-body" });

		const load = (): void => {
			body.empty();
			body.createDiv({ cls: "reel-loading", text: "Loading the parents guide…", attr: { role: "status" } });
			void fetchImdbGuide(this.plugin, imdbId).then(({ cats, reason }) => {
				if (!body.isConnected) return;
				body.empty();
				if (!cats) {
					body.createDiv({
						cls: "reel-dim reel-fl-note",
						text: `IMDb did not give the guide in a form this could read (${reason ?? "no reply"}).`,
					});
					const retry = body.createEl("button", { cls: "reel-btn", text: "Try again", attr: { type: "button" } });
					retry.addEventListener("click", load);
					return;
				}
				cats.forEach((c, i) => {
					const sec = body.createEl("details", { cls: "reel-guide-sec" });
					// The first is open, so the tab shows something the moment it loads.
					if (i === 0) sec.setAttr("open", "");
					const sum = sec.createEl("summary");
					sum.createSpan({ cls: "reel-guide-name", text: c.title });
					if (c.severity) sum.createSpan({ cls: `reel-guide-pill sev-${c.severity.toLowerCase()}`, text: c.severity });
					const list = sec.createEl("ul", { cls: "reel-guide-list" });
					for (const t of c.items) list.createEl("li", { text: t });
					if (!c.items.length) list.createEl("li", { cls: "reel-dim", text: "No notes yet." });
				});
				body.createDiv({ cls: "reel-dim reel-fl-note", text: "Written by IMDb viewers, shown here as it was on IMDb." });
			});
		};
		load();
	}

	private renderContent(el: HTMLElement, info: { cert?: string; imdbId?: string }): void {
		const e = this.entry;

		if (info.cert) {
			const CERT_NOTE: Record<string, string> = {
				G: "Suitable for all ages.",
				PG: "Some material may not suit young children.",
				"PG-13": "May be inappropriate under 13: action violence, some language, mild sexual content.",
				R: "Restricted: expect strong language, violence or sexual content.",
				"NC-17": "Adults only: explicit sexual content or extreme violence.",
				"TV-Y": "Made for very young children.",
				"TV-G": "Suitable for all ages.",
				"TV-PG": "Parental guidance suggested.",
				"TV-14": "May be unsuitable under 14: stronger language, violence or sexual content.",
				"TV-MA": "Mature audiences only: graphic content likely.",
			};
			const box = el.createDiv({ cls: "reel-fl" });
			box.createDiv({ cls: "reel-fl-title", text: "Rating" });
			const row = box.createDiv({ cls: "reel-fl-row" });
			row.createDiv({ cls: "reel-fl-label", text: info.cert });
			row.createDiv({ cls: "reel-fl-value", text: CERT_NOTE[info.cert.toUpperCase()] ?? "As rated in your region." });
		}

		if (info.imdbId) this.renderImdbReader(el, info.imdbId);

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

		const imdb = imdbUrl(info.imdbId);
		if (imdb) {
			const a = el.createEl("a", { cls: "reel-btn", text: "Full parents guide on IMDb", href: `${imdb}parentalguide` });
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
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
	 * The full-bleed image behind the hero.
	 *
	 * Two layers, because the honest offline answer and the good online one are
	 * different images. The base is the local poster, scaled up and blurred
	 * past the point of being readable as a poster — it is already in the
	 * vault, it always exists, and blurred cover art is a defensible backdrop
	 * rather than a stand-in for one. TMDB's real backdrop then fades in over
	 * it if the note carries a path and the network cooperates.
	 *
	 * So there is never a blank hero, never a layout shift when the backdrop
	 * lands, and no second image cached to disk for the sake of decoration.
	 */
	private paintBackdrop(hero: HTMLElement, e: Entry): void {
		const local = this.plugin.posters.displayUrl(e);
		const remote = e.backdropPath ? this.plugin.tmdb.posterUrl(e.backdropPath, "w780") : null;
		if (!local && !remote) return;

		hero.addClass("has-backdrop");
		// The two cases look different and have to be styled differently. A
		// real backdrop is a photograph and wants a scrim; a blurred poster is
		// a texture and wants to sit behind the accent colour rather than be
		// the whole image. Blurring a pale poster — The Office, most comedies,
		// anything with a white sleeve — produces fog, and fog is worse than no
		// image at all because it looks like something failed to load.
		hero.toggleClass("has-art", !!remote);
		const wrap = hero.createDiv({ cls: "reel-hero-backdrop" });

		if (local) {
			const base = wrap.createDiv({ cls: "reel-hero-backdrop-base" });
			base.setCssProps({ "--reel-backdrop": `url("${cssUrl(local)}")` });
		}

		if (!remote) return;
		const img = wrap.createEl("img", {
			cls: "reel-hero-backdrop-img",
			attr: { src: remote, alt: "", decoding: "async" },
		});
		const settle = () => img.addClass("is-loaded");
		if (img.complete && img.naturalWidth > 0) settle();
		else img.addEventListener("load", settle, { once: true });
		// Offline, or a path that has since been removed from TMDB. The blurred
		// poster underneath is already doing the job, so this just tidies up.
		img.addEventListener("error", () => img.remove(), { once: true });
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
		paintRelatedFeed(this.plugin, el, {
			tmdbId: this.entry.tmdbId,
			isTv: this.entry.type === "tv",
			seed: rows,
			layout: "grid",
		});
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
				holdAt(pill, (x, y) => showChipMenu(this.plugin, name, x, y));
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

		/*
		 * Your review, in the panel that is already about you.
		 *
		 * It went in below the cast strip first, which is where the *code* for the
		 * facets happened to be — and the answer to "where do I write a review" was
		 * then two screens of scrolling past other people's work. "Your entry"
		 * holds the rating, the heart and the status. The review is the same kind of
		 * fact and it belongs in the same box.
		 */
		const reviewBox = box.createDiv({ cls: "reel-control" });
		reviewBox.createDiv({ cls: "reel-field-label", text: "Review" });
		paintReviews(this.plugin, reviewBox, this.entry, {
			editable: true,
			heading: "",
			onChange: () => this.rerender(),
		});
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
				haptic("tick");
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

			// Write about this one episode, or press and hold the row for more.
			const epLabel = `S${season}E${n}${ep.name ? ` ${ep.name}` : ""}`.replace(/\s*\u00b7\s*/g, " ");
			const openEpReview = (): void => {
				void readReviews(this.plugin, this.entry).then((all) => {
					const existing = all.find((r) => episodeLabelOf(r.heading) === epLabel) ?? null;
					new ReviewEditor(this.plugin, this.entry, existing, () => {}, epLabel).open();
				});
			};
			const pen = epRow.createEl("button", {
				cls: "reel-episode-review",
				attr: { type: "button", "aria-label": `Review episode ${n}` },
			});
			setIcon(pen, "pencil-line");
			pen.addEventListener("click", (e) => {
				e.stopPropagation();
				openEpReview();
			});
			holdAt(epRow, (x, y) => {
				const menu = new Menu();
				menu.addItem((i) =>
					i
						.setTitle(watched.has(n) ? "Mark not watched" : "Mark watched")
						.setIcon("check")
						.onClick(() => tick.click())
				);
				menu.addItem((i) => i.setTitle("Write a review").setIcon("pencil-line").onClick(openEpReview));
				menu.showAtPosition({ x, y });
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

/**
 * Make a resource path safe to drop inside a CSS `url("…")`.
 *
 * `getResourcePath` returns something like `app://local/C:/Users/.../603.jpg?1699`,
 * and a vault living under a folder with a quote or a backslash in its name
 * would otherwise close the string early and break the rule — silently, since
 * the browser just discards the declaration and the backdrop never appears.
 */
function cssUrl(path: string): string {
	return path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function imdbIdOf(film: TmdbFilm): string | undefined {
	return film.imdb_id ?? film.external_ids?.imdb_id ?? undefined;
}
