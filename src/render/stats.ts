/**
 * Analytics.
 *
 * Everything is computed from frontmatter already in the index — zero API
 * calls, zero disk reads — which is what makes it safe on a dashboard note you
 * open constantly, and what makes it work with no signal.
 *
 * The bias is toward numbers you can't get by looking at the library: how your
 * taste compares to the crowd, which directors you actually rate rather than
 * merely watch, whether you're watching more than last year. A count of films
 * is something you could estimate; those aren't.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { unlink } from "../library";
import { formatMinutes, daysBetween, prettyDate, todayISO } from "../util/dates";
import { rangeCount } from "../util/ranges";
import { MAX_STARS, STEP } from "../util/ratings";
import { viewings } from "./diary";
import { renderEmpty } from "../ui/empty";
import { setSelected } from "../ui/a11y";
import { attachOpinion, opinionOf } from "../ui/personBadge";
import { TitlesSheet } from "../ui/titlesSheet";
import { paintHero } from "../ui/hero";

export interface StatsOptions {
	year?: number;
	include: "all" | "film" | "tv";
	/**
	 * The titles to count, when the caller has already narrowed them.
	 *
	 * The Reel view passes its filtered-and-searched set so the page answers
	 * "how much sci-fi have I watched" rather than always answering for the
	 * whole library. The code block passes nothing and gets everything, which
	 * is what a block in a note means.
	 */
	entries?: Entry[];
	/**
	 * The search behind `entries`, when there was one.
	 *
	 * Only used to decide whether the page should show *which* titles it is
	 * counting. Searching "dog" and being told "1 film, 1h 39m" is arithmetic
	 * about something the page will not name — and the one thing you wanted was
	 * the name. The count is not wrong, it is just the least useful true thing
	 * that could have been said.
	 */
	query?: string;
}

export function registerStatsBlock(plugin: ReelPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"film-stats",
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			ctx.addChild(new StatsBlock(plugin, el, parseOptions(source)));
		}
	);
}

class StatsBlock extends MarkdownRenderChild {
	constructor(
		private plugin: ReelPlugin,
		containerEl: HTMLElement,
		private opts: StatsOptions
	) {
		super(containerEl);
	}

	onload(): void {
		this.containerEl.addClass("reel-block", "reel-stats");
		const paint = () => paintStats(this.plugin, this.containerEl, this.opts);
		paint();
		this.registerEvent(this.plugin.library.on("changed", paint));
	}
}

/* ------------------------------------------------------------------ */

export function paintStats(plugin: ReelPlugin, el: HTMLElement, opts: StatsOptions): void {
	el.empty();
	el.addClass("reel-stats");

	const all = opts.entries ?? plugin.visible(plugin.library.all());
	const films = opts.include === "tv" ? [] : all.filter((e) => e.type === "film");
	const shows = opts.include === "film" ? [] : all.filter((e) => e.type === "tv");
	/*
	 * Only viewings with a usable date.
	 *
	 * Nine places below do `v.date.slice(...)` or `new Date(v.date + ...)`, and
	 * a single entry whose `watched:` frontmatter is malformed — hand-edited,
	 * imported from another tracker, or half-typed — takes all of them down.
	 * The page then renders as far as the first tile and stops, which is what a
	 * device screenshot showed: two tiles and a blank screen.
	 *
	 * Filtering once here is both cheaper and more honest than nine guards: a
	 * viewing without a date cannot appear on a timeline, so it is not data this
	 * page can use.
	 */
	const watched = viewings(films, opts.year).filter((v) => typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.date));

	if (!watched.length && !shows.length) {
		// Stats is the one screen that can say something true and useful about
		// its own emptiness: it is computed entirely from what you have logged,
		// so there is nothing to fetch and nothing to wait for.
		renderEmpty(el, {
			icon: "bar-chart-3",
			title: "Nothing logged yet",
			body: "Every chart here is computed from your own notes, so this fills in as soon as you log something.",
			actions: plugin
				? [{ label: "Log a film", primary: true, onClick: () => plugin.openSearch() }]
				: undefined,
		});
		return;
	}

	/* ---- year selector ------------------------------------------------ */
	// Reuse the unfiltered pass rather than flattening every watch history a
	// second time just to collect the years.
	const allViewings = opts.year ? viewings(films) : watched;
	const years = [...new Set(allViewings.map((v) => v.date.slice(0, 4)))].sort().reverse();
	if (years.length > 1) {
		const bar = el.createDiv({ cls: "reel-chips reel-year-chips" });

		/*
		 * A year is a set of films, so it should look like one.
		 *
		 * These were outlined pills with a number in them — the same control
		 * you would use for "Sort by" — sitting above a page that is entirely
		 * about pictures. Reported as "the tabs at the top with the tiny
		 * outline look terrible" and "this is too text based", and both are
		 * fair: a stroke around a numeral is the most abstract thing this
		 * screen could have used to represent a year of watching.
		 *
		 * Each chip now carries the artwork of something watched in that year,
		 * blurred to the point where it is colour rather than image. That is
		 * the same treatment the detail hero uses, and the reason it works here
		 * is the reason it works there: at this radius there is nothing to
		 * read, so it cannot compete with the label sitting on it — it only
		 * gives the chip the year's own colour. 2019 and 2024 stop being two
		 * identical outlines and become two different years.
		 */
		const artFor = (year?: number): string | null => {
			const pool = year == null ? allViewings : allViewings.filter((v) => v.date.startsWith(String(year)));
			// Newest first: the most recent thing watched is the one the year is
			// most likely to be remembered by.
			const pick = pool.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
			return pick ? plugin.posters.washUrl(pick.entry) : null;
		};

		const chip = (label: string, active: boolean, year?: number) => {
			const b = bar.createEl("button", { cls: "reel-chip" });
			const art = artFor(year);
			if (art) {
				b.addClass("has-wash");
				b.createDiv({ cls: "reel-chip-wash" }).setCssProps({ "--reel-wash": `url("${art}")` });
			}
			// After the wash, so the label is a sibling painted over it rather
			// than a text node the wash would displace.
			b.createSpan({ cls: "reel-chip-text", text: label });
			setSelected(b, active);
			b.addEventListener("click", () => paintStats(plugin, el, { ...opts, year }));
		};
		chip("All time", opts.year == null, undefined);
		for (const y of years) chip(y, opts.year === Number(y), Number(y));
	}

	/* ---- headline tiles ----------------------------------------------- */
	const filmMinutes = watched.reduce((n, v) => n + (v.entry.runtime ?? 0), 0);
	const episodesSeen = shows.reduce((n, s) => n + s.seasons.reduce((m, x) => m + rangeCount(x.watched), 0), 0);
	const episodeMinutes = shows.reduce(
		(n, s) => n + s.seasons.reduce((m, x) => m + rangeCount(x.watched), 0) * (s.episodeRuntime ?? 0),
		0
	);

	/*
	 * A hero, from a title you actually watched.
	 *
	 * The detail screen has taken its atmosphere from artwork since it was
	 * built; stats rendered in flat theme grey, which is why one page reads as
	 * designed and the other as a spreadsheet. The material is identical — this
	 * page already knows every poster in the library.
	 *
	 * The subject is the most recent viewing, falling back to the highest
	 * rated: the page is about what you have been watching, so it should be
	 * wearing what you have been watching.
	 */
	const heroFor =
		[...watched].sort((a, b) => b.date.localeCompare(a.date))[0]?.entry ??
		[...films, ...shows].filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];

	if (heroFor) {
		// The band itself lives in ui/hero.ts now. It was written here first and
		// then needed on four more screens, and four copies of a hero drift into
		// four slightly different heroes — which is the opposite of the point.
		paintHero(plugin, el, {
			label: opts.year ? String(opts.year) : "All time",
			title: `${watched.length} ${watched.length === 1 ? "film" : "films"}${
				shows.length ? ` · ${shows.length} series` : ""
			}`,
			sub: `Most recently — ${heroFor.title}`,
			subject: heroFor,
		});
	}

	/*
	 * When you searched for something, show what it found.
	 *
	 * Searching "dog" produced "1 film · 1h 39m · 1 distinct, 0 rewatches" —
	 * four true statements about a film the page would not name. Every one of
	 * those numbers is derivable from the one fact that was missing, which is
	 * *which film*. The aggregates are the right answer for a whole library and
	 * the wrong one for a handful of titles.
	 *
	 * Only under a search. A filter narrowing the library to 47 titles is still
	 * a question about a population, and 47 posters at the top of the stats page
	 * would bury the page that was asked for. A typed query is different: it is
	 * a question about specific titles, and it is nearly always short.
	 *
	 * Capped, and the cap is stated rather than silent — a strip that quietly
	 * stops at twelve reads as "that is all of them".
	 */
	const query = opts.query?.trim();
	if (query && all.length) {
		const found = el.createDiv({ cls: "reel-chart reel-found" });
		const foundHead = found.createDiv({ cls: "reel-found-head" });
		foundHead.createDiv({ cls: "reel-chart-title", text: `Matching “${query}”` });
		foundHead.createDiv({
			cls: "reel-found-count",
			text: `${all.length} ${all.length === 1 ? "title" : "titles"}`,
		});

		const strip = found.createDiv({ cls: "reel-found-strip" });
		const CAP = 12;
		for (const e of all.slice(0, CAP)) {
			const cell = strip.createDiv({ cls: "reel-found-cell" });
			const art = cell.createDiv({ cls: "reel-found-art" });
			plugin.posters.attach(art, e);
			cell.createDiv({ cls: "reel-found-title", text: e.title });
			if (e.year) cell.createDiv({ cls: "reel-found-year", text: String(e.year) });

			cell.setAttr("role", "button");
			cell.setAttr("tabindex", "0");
			cell.setAttr("aria-label", e.title);
			const open = (): void => void plugin.openDetail(e);
			cell.addEventListener("click", open);
			cell.addEventListener("keydown", (ev: KeyboardEvent) => {
				if (ev.key !== "Enter" && ev.key !== " ") return;
				ev.preventDefault();
				open();
			});
		}
		if (all.length > CAP) {
			found.createDiv({
				cls: "reel-found-more",
				text: `and ${all.length - CAP} more — the numbers below count all ${all.length}.`,
			});
		}
	}

	const tiles = el.createDiv({ cls: "reel-tiles" });

	/**
	 * A headline number.
	 *
	 * `go` makes it a control. Once the charts became clickable, a tile that
	 * looked identical and did nothing was the odd one out — and half the
	 * counts here name a set you would obviously want to see.
	 */
	/*
	 * The first number leads.
	 *
	 * Ten tiles at identical weight is a grid with nothing to enter it by —
	 * "5 unique actors" was given exactly the prominence of "164 hours of TV",
	 * so the eye has no route through and every figure competes with every
	 * other. Analytics that feel considered always lead: one headline figure at
	 * a larger scale, the rest supporting it.
	 *
	 * Positional rather than named, because the emitting order is already the
	 * order of relevance — films first for a film library, episodes first for
	 * one that is mostly television, and the section that has no data emits no
	 * tile at all. Whatever comes out first is the thing this library is
	 * mostly about, so that is the one to promote. Hard-coding "Films watched"
	 * would demote a TV-only library's headline to a footnote.
	 */
	let first = true;
	const tile = (label: string, value: string, sub?: string, go?: () => void, art?: Entry) => {
		const t = tiles.createDiv({ cls: "reel-tile" });
		if (first) {
			t.addClass("is-lead");
			first = false;
		}

		/*
		 * A number about films should look like it is about films.
		 *
		 * Ten tiles of pure text is a spreadsheet, and the complaint — "each of
		 * these should have something illustrating what they are" — is the same
		 * one the year chips got, for the same reason. Every figure here is
		 * computed from specific titles, so there is always a real one standing
		 * behind it: the film that took the longest, the one you rated highest,
		 * the next thing on the watchlist.
		 *
		 * That is what makes this honest rather than decorative. The image is
		 * not a stock texture chosen to fill space; it is the title the number
		 * is actually about, which means the tile is illustrated by its own
		 * data. A tile with no such title stays plain, because inventing one
		 * would be exactly the dishonesty this avoids.
		 */
		const wash = art ? plugin.posters.washUrl(art) : null;
		if (wash) {
			t.addClass("has-wash");
			t.createDiv({ cls: "reel-tile-wash" }).setCssProps({ "--reel-wash": `url("${wash}")` });
			t.setAttr("title", `${label} — ${art?.title ?? ""}`.trim());
		}
		t.createDiv({ cls: "reel-tile-value", text: value });
		t.createDiv({ cls: "reel-tile-label", text: label });
		if (sub) t.createDiv({ cls: "reel-tile-sub", text: sub });
		if (!go) return;
		/*
		 * Half these tiles open the set they are counting and half cannot, and
		 * until now the two looked identical — you found out by tapping. A mark in
		 * the corner is the smallest thing that distinguishes them without turning
		 * a number into a button.
		 */
		t.createDiv({ cls: "reel-tile-go" });
		t.addClass("is-clickable");
		t.setAttr("role", "button");
		t.setAttr("tabindex", "0");
		t.setAttr("aria-label", `${label} — ${value}. Show them.`);
		t.addEventListener("click", go);
		t.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (ev.key === "Enter" || ev.key === " ") {
				ev.preventDefault();
				go();
			}
		});
	};

	const rated = watched.map((v) => v.rating ?? v.entry.rating).filter((r): r is number => r != null);

	/*
	 * A tile answers in place.
	 *
	 * These used to navigate to a filtered Library, which answers the question
	 * by leaving the page it was asked from — and on a phone, leaving means
	 * finding your way back. A sheet shows the titles, your rating and when you
	 * saw them, over the stats page rather than instead of it.
	 */
	const show = (heading: string, entries: Entry[], note?: string) => () =>
		new TitlesSheet(plugin, heading, entries, note).open();

	if (films.length) {
		const distinct = new Set(watched.map((v) => v.entry.path)).size;
		const rewatches = watched.filter((v) => v.rewatch).length;
		tile(
			"Films watched",
			String(watched.length),
			`${distinct} distinct · ${rewatches} rewatches`,
			show("Films watched", [...new Set(watched.map((v) => v.entry))]),
			// The most recent one: this count is a record of watching, and the
			// last thing you watched is what it most recently recorded.
			[...watched].sort((a, b) => b.date.localeCompare(a.date))[0]?.entry
		);
		tile(
			"Hours of film",
			formatMinutes(filmMinutes),
			undefined,
			undefined,
			// The longest, which is the single biggest contributor to the total.
			[...new Set(watched.map((v) => v.entry))].sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0))[0]
		);
	}
	if (shows.length) {
		tile(
			"Episodes",
			String(episodesSeen),
			`${shows.length} show${shows.length === 1 ? "" : "s"}`,
			show("Series you're watching", shows),
			// The first show, which is the one the episode count leads with.
			shows[0]
		);
		if (episodeMinutes) tile("Hours of TV", formatMinutes(episodeMinutes));
	}
	if (rated.length) {
		const mean = rated.reduce((a, b) => a + b, 0) / rated.length;
		tile(
			"Average rating",
			mean.toFixed(2),
			`${rated.length} rated`,
			show(
				"Everything you've rated",
				[...new Set(watched.map((v) => v.entry))]
					.filter((e) => e.rating != null)
					.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
				"Highest first"
			)
		);
	}

	/* Taste vs the crowd. Comparing your rating to IMDb needs both on the
	   same scale — IMDb is out of 10, ours out of 5, so halve theirs. */
	const paired = films
		.filter((e) => e.rating != null && e.imdbRating != null)
		.map((e) => ({ entry: e, delta: (e.rating as number) - (e.imdbRating as number) / 2 }));
	if (paired.length >= 3) {
		const avg = paired.reduce((a, b) => a + b.delta, 0) / paired.length;
		tile(
			"Vs IMDb",
			`${avg >= 0 ? "+" : ""}${avg.toFixed(2)}`,
			avg >= 0 ? "you rate higher than average" : "you rate lower than average"
		);
	}

	// Silence here reads as "this feature is broken" rather than "not enough
	// data yet", which is the actual reason.
	if (paired.length && paired.length < 3) {
		tile("Vs IMDb", "—", `rate ${3 - paired.length} more to compare`);
	}

	const streak = currentStreak(watched.map((v) => v.date));
	if (streak > 1) tile("Current streak", `${streak} days`);

	const perMonth = watched.length && monthsCovered(watched.map((v) => v.date));
	if (perMonth && perMonth > 1) tile("Films per month", (watched.length / perMonth).toFixed(1));

	/*
	 * The backlog, split the way people actually ask about it.
	 *
	 * "How many films are on my watchlist" is a different question from "how
	 * big is my watchlist", and a single number answered neither well — a
	 * count of 60 covering 12 films and 48 series describes an evening very
	 * differently depending on which you were planning.
	 *
	 * The pace line stays, but only when there is a pace to speak of. It is
	 * the more interesting fact when it exists, and an invented one when it
	 * does not, so the split takes the subtitle when there is no history to
	 * divide by.
	 */
	const queued = all.filter((e) => e.status === "watchlist");
	if (queued.length) {
		const queuedFilms = queued.filter((e) => e.type === "film").length;
		const queuedShows = queued.length - queuedFilms;

		const rate = perMonth ? watched.length / perMonth : 0;
		const split = [
			queuedFilms ? `${queuedFilms} film${queuedFilms === 1 ? "" : "s"}` : "",
			queuedShows ? `${queuedShows} series` : "",
		]
			.filter(Boolean)
			.join(", ");
		const pace = rate > 0 ? `${Math.ceil(queued.length / rate)} months at this pace` : "";
		// Both when both are worth saying; the split alone when there is no
		// watch history to compute a pace from.
		const sub = [split, pace].filter(Boolean).join(" \u00b7 ") || undefined;

		tile("On the watchlist", String(queued.length), sub, show("On the watchlist", queued));
	}

	const unrated = films.filter((e) => e.rating == null && e.watched.length).length;
	if (unrated) tile("Unrated", String(unrated), "tap to rate them", () => void plugin.openTab("rate"));

	// Breadth, as opposed to the depth the top-N charts show. "195 actors" is
	// the number the old tracker put front and centre, and the charts alone
	// never answer it.
	const people = (pick: (e: Entry) => string[]) => new Set(all.flatMap((e) => pick(e).map(unlink))).size;
	const actors = people((e) => e.cast);
	const helmers = people((e) => [...e.director, ...e.creators]);
	if (actors) tile("Unique actors", String(actors));
	if (helmers) tile("Directors & creators", String(helmers));

	if (watched.length && !opts.year) {
		const perDay = new Map<string, number>();
		for (const v of watched) perDay.set(v.date, (perDay.get(v.date) ?? 0) + 1);
		const best = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
		if (best && best[1] > 1) tile("Busiest day", `${best[1]} films`, prettyDate(best[0]));
	}

	if (watched.length > 4) paintHeatmap(plugin, el, watched, opts, show);

	/* ---- superlatives -------------------------------------------------- */
	// These describe what you have *seen*, so they run over the watched set
	// rather than the whole library. Using every film put a watchlist title
	// under "Longest" directly beneath "0 films watched".
	const seen = [...new Map(watched.map((v) => [v.entry.path, v.entry])).values()];

	const longest = seen.filter((e) => e.runtime).sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0))[0];
	const topRated = seen.filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
	const mostRewatched = seen.filter((e) => e.watched.length > 1).sort((a, b) => b.watched.length - a.watched.length)[0];

	const facts: { label: string; value: string; entry?: Entry }[] = [];
	if (topRated.length) {
		facts.push({ label: "Highest rated", value: `${topRated[0].title} — ${topRated[0].rating}★`, entry: topRated[0] });
	}
	if (topRated.length > 1) {
		const worst = topRated[topRated.length - 1];
		facts.push({ label: "Lowest rated", value: `${worst.title} — ${worst.rating}★`, entry: worst });
	}
	if (longest) {
		facts.push({ label: "Longest", value: `${longest.title} — ${formatMinutes(longest.runtime ?? 0)}`, entry: longest });
	}
	if (mostRewatched) {
		facts.push({
			label: "Most rewatched",
			value: `${mostRewatched.title} — ${mostRewatched.watched.length}×`,
			entry: mostRewatched,
		});
	}
	const biggestDivergence = paired.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
	if (biggestDivergence && Math.abs(biggestDivergence.delta) >= 1) {
		facts.push({
			label: biggestDivergence.delta > 0 ? "You liked far more than most" : "You liked far less than most",
			value: biggestDivergence.entry.title,
			entry: biggestDivergence.entry,
		});
	}

	if (facts.length) {
		const box = el.createDiv({ cls: "reel-facts" });
		for (const f of facts) {
			const row = box.createDiv({ cls: "reel-fact" });

			/*
			 * Show the film the sentence is about.
			 *
			 * "Highest rated — Iron Man — 5★" is a statement about a specific
			 * title, printed as text, with the title itself absent. Reported as
			 * "plain text with nothing to show what it's saying", which is
			 * exactly right: this is the one part of the page where naming a
			 * film and showing nothing of it is least defensible, because the
			 * film is already identified. Every one of these rows has carried
			 * its `entry` since they were written — the poster was one property
			 * away the whole time.
			 *
			 * Unlike a wash, this is a real thumbnail rather than a blur. A wash
			 * is for surfaces that are *about* a title without naming one; here
			 * the title is named, so the honest illustration is the actual
			 * poster at a size you can recognise.
			 */
			if (f.entry) {
				const thumb = row.createDiv({ cls: "reel-fact-thumb" });
				plugin.posters.attach(thumb, f.entry);
			}

			const text = row.createDiv({ cls: "reel-fact-text" });
			text.createDiv({ cls: "reel-fact-label", text: f.label });
			text.createDiv({ cls: "reel-fact-value", text: f.value });
			// Each superlative names one title, so it should open that title.
			if (!f.entry) continue;
			const entry = f.entry;
			row.addClass("is-clickable");
			row.setAttr("role", "button");
			row.setAttr("tabindex", "0");
			row.setAttr("aria-label", `${f.label}: ${entry.title}. Open it.`);
			const open = () => void plugin.openDetail(entry);
			row.addEventListener("click", open);
			row.addEventListener("keydown", (ev: KeyboardEvent) => {
				if (ev.key === "Enter" || ev.key === " ") {
					ev.preventDefault();
					open();
				}
			});
		}
	}

	/* ---- charts --------------------------------------------------------- */
	const charts = el.createDiv({ cls: "reel-chart-grid" });

	if (!opts.year && watched.length) {
		const byYear = new Map<string, number>();
		// The titles behind each year, not only how many there were.
		//
		// The closed-chart poster strip added in 0.8.36 draws one film per row
		// from `entries`, and this chart never carried any — it was built from
		// a count and a label. So "Films per year · 2026" stayed the three bare
		// words the strip existed to replace, while By month and By day of week
		// showed their posters, which reads as the feature being broken rather
		// than as one chart having no data to give it.
		const filmsByYear = new Map<string, Entry[]>();
		for (const v of watched) {
			const y = v.date.slice(0, 4);
			byYear.set(y, (byYear.get(y) ?? 0) + 1);
			const seen = filmsByYear.get(y) ?? [];
			// A rewatch is two viewings of one film, and two copies of the same
			// poster in a strip of three reads as a bug.
			if (!seen.includes(v.entry)) seen.push(v.entry);
			filmsByYear.set(y, seen);
		}
		// A year bar re-scopes the whole page to that year, which is what the
		// year chips at the top already do — so the bar and the chip agree
		// rather than the bar being the one number on the page that is inert.
		bars(
			charts,
			"Films per year",
			[...byYear.entries()]
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([label, n]) => ({
					label,
					n,
					entries: filmsByYear.get(label),
					go: () => paintStats(plugin, el, { ...opts, year: Number(label) }),
				})),
			"",
			plugin
		);
	}

	// The four charts below stay inert on purpose, and it is worth saying so
	// rather than leaving it to look like an oversight.
	//
	// Month and weekday have no set to open: "January" is not a property of a
	// film, and searching for it matches nothing. Rating distribution and
	// decade *do* name real sets, but the Library has no rating or decade
	// filter to hand them to — sending "4.5" or "2010s" to a text search would
	// return either nothing or the wrong titles, which is worse than a bar
	// that plainly does not respond. They become clickable when those filters
	// exist, not before.
	/**
	 * Drop empty rows from each end, keeping any gap in the middle.
	 *
	 * All twelve months drew whenever any one of them had data, so a library
	 * watched entirely in August produced eleven rows of zero — around 540px of
	 * nothing, in a chart grid a device snapshot measured at 8930px.
	 *
	 * Interior zeros stay. "Nothing in September, between two busy months" is a
	 * fact about the year; leading and trailing zeros are just the calendar.
	 */
	const trimEmpty = <T extends { n: number }>(rows: T[]): T[] => {
		let first = 0;
		let last = rows.length - 1;
		while (first <= last && rows[first].n === 0) first++;
		while (last >= first && rows[last].n === 0) last--;
		return rows.slice(first, last + 1);
	};

	if (watched.length) {
		const byMonth = new Array(12).fill(0);
		for (const v of watched) byMonth[parseInt(v.date.slice(5, 7), 10) - 1]++;
		const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		if (byMonth.some((n) => n > 0)) {
			/*
			 * These used to be inert, and the comment above explained why:
			 * "January" is not a property of a film, so a Library search for it
			 * matches nothing. That was a good reason to do nothing when a
			 * search was the only way to answer.
			 *
			 * It stopped being true when the sheet arrived. The viewing dates
			 * are right here — the set of films watched in August is something
			 * this function already knows and was throwing away.
			 */
			// `entries` is what turns a row into posters rather than a bar —
			// the plumbing was already there and this chart was not using it.
			const monthEntries = (i: number): Entry[] => [
				...new Set(watched.filter((v) => parseInt(v.date.slice(5, 7), 10) - 1 === i).map((v) => v.entry)),
			];
			bars(
				charts,
				"By month",
				trimEmpty(
					byMonth.map((n, i) => {
						const rows = n ? monthEntries(i) : [];
						return {
							label: names[i],
							n,
							entries: rows,
							go: n ? () => new TitlesSheet(plugin, names[i], rows, `Watched in ${names[i]}`).open() : undefined,
						};
					})
				)
			);
		}

		const byWeekday = new Array(7).fill(0);
		for (const v of watched) {
			const d = new Date(v.date + "T00:00:00");
			if (!Number.isNaN(d.getTime())) byWeekday[d.getDay()]++;
		}
		const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		if (byWeekday.some((n) => n > 0)) {
			bars(
				charts,
				"By day of week",
				byWeekday.map((n, i) => {
					const rows = n
						? [...new Set(watched.filter((v) => new Date(v.date + "T00:00:00").getDay() === i).map((v) => v.entry))]
						: [];
					return {
						label: days[i],
						n,
						entries: rows,
						go: n ? () => new TitlesSheet(plugin, days[i], rows, `Watched on a ${days[i]}`).open() : undefined,
					};
				})
			);
		}
	}

	if (rated.length) {
		const buckets: Bar[] = [];
		for (let r = STEP; r <= MAX_STARS; r += STEP) {
			buckets.push({ label: r.toString(), n: rated.filter((x) => Math.abs(x - r) < 0.01).length });
		}
		bars(charts, "Rating distribution", buckets);
	}

	/* ---- taste charts: what you have SEEN ------------------------------ */
	//
	// These describe your taste, so the watchlist has no business in them. A
	// film you mean to watch tells you nothing about which directors you
	// favour, and counting it says you like someone whose work you have never
	// seen. Same bug as the superlatives once had, one section further down
	// the page.
	//
	// A series counts once any episode is watched: you have formed a view on
	// it by then, and waiting for a full run would exclude everything
	// in progress.
	const seenFilms = films.filter((e) => e.watched.length > 0);
	const seenShows = shows.filter((e) => e.seasons.some((x) => rangeCount(x.watched) > 0));
	const seenAll = [...seenFilms, ...seenShows];

	// People are stored as wikilinks, so unwrap before counting or
	// "[[People/X|X]]" and "X" tally separately.
	if (seenFilms.length) {
		tally(charts, "Top directors", seenFilms, (e) => e.director.map(unlink), undefined, undefined, plugin);
		ratedBy(charts, "Directors you rate highest", seenFilms, (e) => e.director.map(unlink), 2, plugin, true);
		tally(charts, "Top actors", seenFilms, (e) => e.cast.map(unlink), undefined, undefined, plugin, true);
		// Recurring characters are mostly a franchise signal — the same part
		// across several films is the interesting case, so require two.
		// Characters get no portrait and no posters. Nobody's face belongs to
		// "Ethan Hunt" in this index, and the film poster underneath was the
		// worst version of the same mistake — it read as a picture of the
		// character. A bar is the honest answer.
		tally(charts, "Recurring characters", seenFilms, (e) => e.characters, undefined, undefined, plugin, false, true);
	}
	if (seenShows.length) {
		tally(charts, "Top creators", seenShows, (e) => e.creators.map(unlink), undefined, undefined, plugin);
		tally(charts, "Top actors — TV", seenShows, (e) => e.cast.map(unlink), undefined, undefined, plugin, true);
	}

	tally(charts, "Genres", seenAll, (e) => e.genres, 10, undefined, plugin);
	ratedBy(charts, "Genres you rate highest", seenFilms, (e) => e.genres, 3, plugin);
	tally(charts, "Top collections", seenAll, (e) => (e.collection ? [e.collection] : []), undefined, undefined, plugin);
	tally(charts, "Certifications", seenAll, (e) => (e.certification ? [e.certification] : []), 8, 1, plugin);
	// Providers are the exception: "where can I stream the things in my
	// library" is a practical question about the backlog too, not a statement
	// about taste. The heading says so rather than leaving it inconsistent.
	providerSplit(charts, all, plugin);
	tally(charts, "Studios", seenAll, (e) => e.productionCompanies, 6, undefined, plugin);
	tally(charts, "Languages", seenAll, (e) => (e.language ? [e.language] : []), 6, 1, plugin);

	// Release years, distinct from "films per year" above: that counts when you
	// watched, this counts when the film came out. A run of 2003s says
	// something about taste that a viewing date does not.
	tally(
		charts,
		"Top release years",
		seenAll,
		(e) => {
			const y = e.year ?? e.firstAirYear;
			return y ? [String(y)] : [];
		},
		6,
		1
	);

	/* ---- money ---------------------------------------------------------- */
	// Budget and revenue only arrive for films, and TMDB leaves both at 0 for
	// plenty of them — a zero here means "not reported", not "made nothing",
	// so those rows are dropped rather than charted as the cheapest film ever.
	const withBudget = films.filter((e) => (e.budget ?? 0) > 0);
	const withRevenue = films.filter((e) => (e.revenue ?? 0) > 0);

	if (withBudget.length) {
		bars(
			charts,
			"Biggest budgets ($M)",
			[...withBudget]
				.sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))
				.slice(0, 5)
				.map((e) => ({ label: e.title, n: Math.round((e.budget ?? 0) / 1_000_000) }))
		);
		bars(
			charts,
			"Smallest budgets ($M)",
			[...withBudget]
				.sort((a, b) => (a.budget ?? 0) - (b.budget ?? 0))
				.slice(0, 5)
				.map((e) => ({ label: e.title, n: Math.round((e.budget ?? 0) / 1_000_000) }))
		);
	}

	if (withRevenue.length) {
		bars(
			charts,
			"Highest grossing ($M)",
			[...withRevenue]
				.sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
				.slice(0, 5)
				.map((e) => ({ label: e.title, n: Math.round((e.revenue ?? 0) / 1_000_000) }))
		);
		bars(
			charts,
			"Lowest grossing ($M)",
			[...withRevenue]
				.sort((a, b) => (a.revenue ?? 0) - (b.revenue ?? 0))
				.slice(0, 5)
				.map((e) => ({ label: e.title, n: Math.round((e.revenue ?? 0) / 1_000_000) }))
		);
	}

	// Return on budget. Needs both figures, so it is its own pool rather than
	// a derived column on either chart above.
	const ratios = films
		.filter((e) => (e.budget ?? 0) > 0 && (e.revenue ?? 0) > 0)
		.map((e) => ({ entry: e, x: (e.revenue ?? 0) / (e.budget ?? 1) }));

	if (ratios.length) {
		bars(
			charts,
			"Overperformers (× budget)",
			[...ratios]
				.sort((a, b) => b.x - a.x)
				.slice(0, 5)
				.map((r) => ({ label: r.entry.title, n: Math.round(r.x * 10) / 10 })),
			"×"
		);
		bars(
			charts,
			"Underperformers (× budget)",
			[...ratios]
				.sort((a, b) => a.x - b.x)
				.slice(0, 5)
				.map((r) => ({ label: r.entry.title, n: Math.round(r.x * 10) / 10 })),
			"×"
		);
	}

	const decades = new Map<string, number>();
	for (const e of seenAll) {
		const y = e.year ?? e.firstAirYear;
		if (y) {
			const d = `${Math.floor(y / 10) * 10}s`;
			decades.set(d, (decades.get(d) ?? 0) + 1);
		}
	}
	if (decades.size > 1) {
		bars(charts, "By decade", [...decades.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, n]) => ({ label, n })));
	}

	/* ---- series progress ------------------------------------------------ */
	if (shows.length) {
		const inProgress = shows
			.filter((s) => (s.progress ?? 0) > 0 && (s.progress ?? 0) < 100)
			.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
			.slice(0, 10);
		if (inProgress.length) {
			bars(
				charts,
				"Series progress (%)",
				inProgress.map((s) => ({ label: s.title, n: s.progress ?? 0, entries: [s], search: s.title })),
				"",
				plugin
			);
		}
	}
}

interface Bar {
	label: string;
	n: number;
	/** Optional second line, e.g. the film/series split under a provider. */
	note?: string;
	/** Every title behind this row, so the posters themselves become the chart. */
	entries?: Entry[];
	/** What tapping the row searches for. Defaults to the label. */
	search?: string;
	/** An action for rows whose answer is not a library search — a year rescopes the page. */
	go?: () => void;
	/**
	 * Suppress the poster strip.
	 *
	 * Set for people and for characters. A character has no headshot of its
	 * own — nobody's face belongs to "Ethan Hunt" in this index — so those
	 * rows carry a bar rather than a portrait, and definitely not a poster
	 * that would read as a picture of the character.
	 */
	noPosters?: boolean;
	/**
	 * The person this row is about, when it is about a person.
	 *
	 * Held separately from `label` because a label can carry a count or a
	 * qualifier, and the lookup needs the bare name. Set only where a face
	 * makes sense — a director or an actor, never a genre or a decade.
	 */
	face?: string;
}

/**
 * Where your library can be streamed, split by type.
 *
 * A bare count answers "how many titles" but not "is this subscription
 * carrying my films or my shows", which is the question behind deciding what
 * to keep paying for.
 */
function providerSplit(el: HTMLElement, rows: Entry[], plugin?: ReelPlugin): void {
	const counts = new Map<string, { films: number; shows: number }>();
	for (const e of rows) {
		for (const p of e.providers) {
			if (!p) continue;
			const row = counts.get(p) ?? { films: 0, shows: 0 };
			if (e.type === "tv") row.shows++;
			else row.films++;
			counts.set(p, row);
		}
	}
	const data = [...counts.entries()]
		.map(([label, c]) => ({
			label,
			n: c.films + c.shows,
			note: `${c.films} film${c.films === 1 ? "" : "s"} · ${c.shows} series`,
		}))
		.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
		.slice(0, 12);
	bars(el, "Streaming on — whole library", data, "", plugin);
}

function bars(el: HTMLElement, title: string, data: Bar[], suffix = "", plugin?: ReelPlugin): void {
	if (!data.length) return;
	const max = Math.max(...data.map((d) => d.n), 1);
	// Resolved once for the whole chart rather than per row. The map is
	// memoised on the index, but reaching for it twelve times per chart across
	// eight charts is still eight times more work than reaching for it once.
	const faces = data.some((d) => d.face) ? plugin?.library.peopleIds() : undefined;
	/*
	 * Collapsed by default, and openable.
	 *
	 * Eight charts all expanded made the stats page a single 8930px scroll:
	 * everything present, nothing findable. A closed section states what it
	 * holds and how much, so the page becomes a contents page you open the one
	 * part of that you came for.
	 *
	 * `<details>` rather than a hand-rolled toggle — it is keyboard-operable,
	 * announced correctly by a screen reader and searchable by the browser's own
	 * find, none of which a div with a click handler gets for free.
	 */
	/*
	 * A button and a div, not `<details>`.
	 *
	 * `<details>` was the right instinct — free keyboard support, correct
	 * announcement — and the wrong element here, because themes style it. On a
	 * real device every closed section rendered as an empty bordered box: the
	 * theme's own `details` rules drew a frame, and the collapsed body left it
	 * hollow. A stack of empty form fields is what "the stats page needs a
	 * complete rework" was looking at.
	 *
	 * Owning the markup means the appearance is ours. The accessibility comes
	 * back explicitly through `aria-expanded` and a real button, which is what
	 * `<details>` was giving for free.
	 */
	const box = el.createDiv({ cls: "reel-chart reel-fold" });
	/*
	 * A div with a button role, not a `<button>`.
	 *
	 * The theme styles bare buttons — background, radius, padding — so every
	 * collapsed section came out as a filled rounded box, which is the second
	 * time a theme's opinion about an element has decided how Reel looks. The
	 * first was `<details>`. The rule that keeps emerging: where Reel owns the
	 * surface, use an element nobody has opinions about, and put the semantics
	 * back on by hand.
	 */
	const toggle = box.createDiv({ cls: "reel-fold-toggle" });
	toggle.setAttr("role", "button");
	toggle.setAttr("tabindex", "0");
	toggle.addEventListener("keydown", (ev: KeyboardEvent) => {
		if (ev.key === "Enter" || ev.key === " ") {
			ev.preventDefault();
			toggle.click();
		}
	});
	const heading = toggle.createDiv({ cls: "reel-fold-heading" });
	heading.createDiv({ cls: "reel-chart-title", text: title });
	/*
	 * What is in there, not just how much.
	 *
	 * A closed fold said "7", and a page of those is twelve outlined boxes with
	 * a different digit in each — nothing to read and nothing to choose between.
	 * The closed state is the one you spend most of your time looking at, so it
	 * should be the summary: naming the top three makes the page scannable
	 * without opening anything.
	 */
	const preview = data
		.slice(0, 3)
		.map((d) => d.label)
		.join(" · ");
	if (preview) heading.createDiv({ cls: "reel-fold-preview", text: preview });

	/*
	 * The closed fold shows the films, not just their names.
	 *
	 * A closed chart was a title, a count and three words — "Films per year",
	 * "1", "2026". Every one of those words stands for a set of titles the
	 * chart already holds, so the closed state was describing pictures it was
	 * choosing not to show. This is the same fault as the superlatives, in the
	 * state you spend most of your time looking at: folds are closed by
	 * default, so this is what the page mostly *is*.
	 *
	 * Taken across rows rather than down one, because the preview names the top
	 * three rows and should illustrate those three rather than showing three
	 * films from the first. One title per row, in row order, so the strip and
	 * the text say the same thing.
	 *
	 * Skipped entirely where the rows are people or characters. A face does not
	 * belong to a film poster, and putting one under "Top actors" was a fault
	 * fixed once already — it is not coming back through the closed state.
	 */
	if (plugin) {
		const faces = data.slice(0, 3).filter((d) => !d.noPosters);
		const shots = faces.map((d) => d.entries?.[0]).filter((e): e is Entry => Boolean(e));
		if (shots.length) {
			const strip = heading.createDiv({ cls: "reel-fold-shots" });
			for (const e of shots) {
				const thumb = strip.createDiv({ cls: "reel-fold-shot" });
				plugin.posters.attach(thumb, e);
			}
		}
	}
	toggle.createDiv({ cls: "reel-fold-count", text: `${data.length}` });
	const body = box.createDiv({ cls: "reel-chart-body" });

	const setOpen = (open: boolean): void => {
		box.toggleClass("is-open", open);
		toggle.setAttr("aria-expanded", String(open));
	};
	/*
	 * Closed on a phone, open where there is room to read them.
	 *
	 * Collapsing spends taps to buy back screen, and that is the right trade on
	 * a phone: twelve charts open is a very long page to thumb through, which
	 * is why the closed state was made worth reading — the preview names the
	 * top three and the strip shows their posters.
	 *
	 * On a desktop the trade runs the other way. The room is already there, so
	 * the page becomes twelve grey boxes each holding one number and a chevron:
	 * reading your own statistics costs twelve clicks, and nothing can be
	 * compared against anything else because only one is ever open at a time. A
	 * tool puts the numbers on the page.
	 *
	 * They still collapse. The toggle, the count and the chevron behave exactly
	 * as before — only the starting state differs, and only where the pane is
	 * both wide and driven by a pointer.
	 */
	const view = el.closest(".reel-view");
	const roomy = !!view && view.classList.contains("is-w700") && !view.classList.contains("is-phone");
	setOpen(roomy);
	toggle.addEventListener("click", () => setOpen(!box.hasClass("is-open")));
	for (const d of data) {
		const row = body.createDiv({ cls: "reel-chart-row" });

		// Label and number on one line, posters underneath.
		//
		// A single thumbnail beside a thin bar left most of the row empty and
		// told you nothing about the other four films. Showing every title the
		// row counts turns the chart into the thing it is describing — the
		// posters are the bar, and their number is the count.
		const head = row.createDiv({ cls: "reel-chart-head" });

		/*
		 * The position, stated.
		 *
		 * Every chart here is sorted and none of them said so, which leaves the
		 * reader inferring rank from bar length — fine when the bars differ, and
		 * useless in the common case where the top three are 4, 3 and 3. A number
		 * makes the ordering a fact rather than an impression, and it gives the
		 * rows a left edge to line up on.
		 */
		head.createDiv({ cls: "reel-chart-rank", text: String(data.indexOf(d) + 1) });

		// A person's row leads with their face. It used to lead with a film
		// poster, which is the right *data* — that is the film they were in —
		// but a poster under a person's name implies a photo of that person,
		// so it read as a bug. In a small library it looked like a worse one:
		// every actor was in the same film, so every row showed the same image.
		if (d.face && plugin) {
			const shot = head.createDiv({ cls: "reel-chart-face" });
			plugin.people.attach(shot, d.face, faces?.get(d.face));
			attachOpinion(shot, opinionOf(plugin, faces?.get(d.face)));
		}

		const label = head.createDiv({ cls: "reel-chart-label", text: d.label });
		label.setAttr("title", d.note ? `${d.label} — ${d.note}` : d.label);
		if (d.note) label.createDiv({ cls: "reel-chart-sub", text: d.note });
		head.createDiv({ cls: "reel-chart-value", text: `${d.n}${suffix}` });

		// A row about a person or a character shows no posters at all.
		//
		// The strip is right for a genre or a decade, where the row genuinely
		// *is* a set of titles. Under a name it was wrong twice over: a film
		// poster beneath "Jean Reno" reads as a picture of Jean Reno, and in a
		// small library every actor in the chart was in the same film, so the
		// identical poster repeated down every row. The face is the thumbnail;
		// a second, wrong one under it was the complaint.
		const posters = plugin && !d.noPosters ? (d.entries ?? []) : [];
		if (posters.length) {
			const strip = row.createDiv({ cls: "reel-chart-strip" });
			// Capped: a prolific director would otherwise push every other row
			// off the screen, and the count is already stated above.
			for (const e of posters.slice(0, 8)) {
				const thumb = strip.createDiv({ cls: "reel-chart-thumb" });
				plugin?.posters.attach(thumb, e);
			}
			if (posters.length > 8) {
				strip.createDiv({ cls: "reel-chart-more", text: `+${posters.length - 8}` });
			}
		} else {
			// No posters to show — a date bucket, a rating band — so the bar
			// stays, since something has to carry the comparison.
			const track = row.createDiv({ cls: "reel-chart-track" });
			const fill = track.createDiv({ cls: "reel-chart-fill" });
			fill.setCssProps({ "--reel-fill": String(d.n / max) });

			/*
			 * The bar, in the colour of what it counts.
			 *
			 * Recurring characters are the case that broke this. Every one of
			 * them appears in exactly three films, so every bar was `3 / 3` —
			 * eight identical full-width slabs of flat accent down the card. As
			 * a chart it carried no information at all, and as a surface it read
			 * like eight rows had been selected by accident.
			 *
			 * The earlier decision not to put a poster under a character's name
			 * still holds: a sharp poster beside "Jack Sparrow" claims to be a
			 * picture of Jack Sparrow, and it isn't. But the blurred wash the
			 * sheets use makes no such claim — at this radius there is no image
			 * left to misread, only the film's colour. So the row is tinted by
			 * the film the character is in, which is true, and legible as decor
			 * rather than as a portrait.
			 *
			 * Only where the row genuinely has a title behind it. A rating band
			 * or a date bucket keeps the plain fill, because there is no single
			 * artwork that belongs to "3½ stars".
			 */
			const art = plugin && d.entries?.length ? plugin.posters.washUrl(d.entries[0]) : null;
			if (art) {
				fill.addClass("has-wash");
				fill.setCssProps({ "--reel-wash": `url("${art}")` });
			}
		}

		// Every bar answers a question you can only otherwise ask by hand:
		// "which seven were the dramas?" Tapping runs that search — or, where
		// a search is the wrong answer, whatever the row supplied instead.
		if (plugin && (d.search || d.go)) {
			row.addClass("is-clickable");
			row.setAttr("role", "button");
			row.setAttr("tabindex", "0");
			row.setAttr("aria-label", d.go ? `Show ${d.label} only` : `Show titles matching ${d.label}`);
			/*
			 * Answer over the page, not by leaving it.
			 *
			 * A bar used to run a Library search, which is the right answer to
			 * "which seven were the dramas?" delivered in the wrong place — you
			 * lose the chart you asked from and have to navigate back. The sheet
			 * shows the same titles with your ratings attached.
			 *
			 * Falls back to the search when the term matches nothing in the
			 * index, since a sheet saying "no titles" is less use than a search
			 * that can look wider than the visible set.
			 */
			const term = (d.search ?? d.label).toLowerCase();
			const matches = plugin
				.visible(plugin.library.all())
				.filter((e) =>
					[e.title, ...(e.genres ?? []), ...(e.director ?? []), ...(e.cast ?? []), ...(e.creators ?? [])]
						.filter(Boolean)
						.some((v) => String(v).toLowerCase().includes(term))
				);
			const open =
				d.go ??
				(matches.length
					? () => new TitlesSheet(plugin, d.label, matches, `${title} — ${d.n}`).open()
					: () => void plugin.openViewWithSearch(d.search ?? d.label, "stats"));
			row.addEventListener("click", open);
			row.addEventListener("keydown", (ev: KeyboardEvent) => {
				if (ev.key === "Enter" || ev.key === " ") {
					ev.preventDefault();
					open();
				}
			});
		}
	}
}

function tally(
	el: HTMLElement,
	title: string,
	rows: Entry[],
	pick: (e: Entry) => string[],
	limit = 8,
	minCount = 2,
	plugin?: ReelPlugin,
	/** True when each key is a person's name, so the row can lead with a face. */
	people = false,
	/** True for keys that are neither titles nor people — a character name. */
	bare = false
): void {
	// "Appears at least twice" keeps a large library's charts meaningful, but
	// it empties them entirely for a small one — every director has exactly
	// one film until you own five. Below that, show singles: seeing your two
	// titles listed is more useful than a blank page.
	const floor = rows.length < 5 ? 1 : minCount;
	// Every title carrying each value, best-rated first — the posters are the
	// chart now, so the row needs the whole set rather than one representative.
	const held = new Map<string, Entry[]>();
	for (const e of rows) {
		for (const value of pick(e)) {
			if (!value) continue;
			const list = held.get(value) ?? [];
			list.push(e);
			held.set(value, list);
		}
	}
	for (const list of held.values()) list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

	const top = [...held.entries()]
		.filter(([, list]) => list.length >= floor)
		.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([label, list]) => ({
			label,
			n: list.length,
			entries: list,
			search: label,
			...(people ? { face: label, noPosters: true } : {}),
			...(bare ? { noPosters: true } : {}),
		}));
	bars(el, title, top, "", plugin);
}

/**
 * Average rating per group — "who do you actually rate", as distinct from who
 * you happen to have watched most. Needs a minimum sample, or one five-star
 * film puts an unknown director at the top of the chart.
 */
function ratedBy(
	el: HTMLElement,
	title: string,
	rows: Entry[],
	pick: (e: Entry) => string[],
	min = 2,
	plugin?: ReelPlugin,
	people = false
): void {
	const sums = new Map<string, { total: number; n: number }>();
	// Every rated title per key, best first — the posters carry the row.
	const held = new Map<string, Entry[]>();
	for (const e of rows) {
		if (e.rating == null) continue;
		for (const key of pick(e)) {
			if (!key) continue;
			const cur = sums.get(key) ?? { total: 0, n: 0 };
			cur.total += e.rating;
			cur.n++;
			sums.set(key, cur);
			const list = held.get(key) ?? [];
			list.push(e);
			held.set(key, list);
		}
	}
	for (const list of held.values()) list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

	const top = [...sums.entries()]
		.filter(([, v]) => v.n >= min)
		.map(([label, v]) => ({
			label: `${label} (${v.n})`,
			n: Math.round((v.total / v.n) * 10) / 10,
			entries: held.get(label),
			// The label carries a count in brackets — searching that string
			// would match nothing, so the search uses the bare key.
			search: label,
			...(people ? { face: label, noPosters: true } : {}),
		}))
		.sort((a, b) => b.n - a.n)
		.slice(0, 8);
	bars(el, title, top, "★", plugin);
}

/** Consecutive days up to today (or yesterday) with at least one viewing. */
function currentStreak(dates: string[]): number {
	const seen = new Set(dates);
	if (!seen.size) return 0;
	const today = todayISO();
	// Allow the streak to end yesterday — you haven't necessarily watched
	// something yet today, and calling that a broken streak is harsh.
	let cursor = seen.has(today) ? today : shiftDay(today, -1);
	if (!seen.has(cursor)) return 0;
	let streak = 0;
	while (seen.has(cursor)) {
		streak++;
		cursor = shiftDay(cursor, -1);
	}
	return streak;
}

function shiftDay(iso: string, delta: number): string {
	const d = new Date(iso + "T00:00:00");
	d.setDate(d.getDate() + delta);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** Months between first and last viewing, for a meaningful per-month rate. */
function monthsCovered(dates: string[]): number {
	if (!dates.length) return 0;
	const sorted = [...dates].sort();
	const days = daysBetween(sorted[0], sorted[sorted.length - 1]);
	if (!Number.isFinite(days)) return 0;
	return Math.max(1, days / 30.4);
}

export function parseOptions(source: string): StatsOptions {
	const opts: StatsOptions = { include: "all" };
	for (const line of source.split("\n")) {
		const [k, v] = line.split(":").map((s) => s?.trim().toLowerCase());
		if (!k || !v) continue;
		if (k === "year" && /^\d{4}$/.test(v)) opts.year = parseInt(v, 10);
		if (k === "include") opts.include = v === "film" || v === "films" ? "film" : v === "tv" ? "tv" : "all";
	}
	return opts;
}




/* ------------------------------------------------------------------ */

/**
 * A year of viewing, as a shape.
 *
 * Every other chart on this page is a ranking — your top genres, your top
 * actors, the months with the most films in them. Rankings answer "what" and
 * none of them answers "when": whether you watch in bursts or steadily, which
 * months you lost, how long the current run is. That is a different question
 * and it wants a different picture.
 *
 * Days as rows and weeks as columns, which is the arrangement everyone already
 * knows how to read — a year fits in one glance and the gaps are as legible as
 * the runs. Colour comes from the accent the page already pulled off your most
 * recent poster, so it belongs to this page rather than being a chart library's
 * idea of green.
 */
function paintHeatmap(
	plugin: ReelPlugin,
	el: HTMLElement,
	watched: { date: string; entry: Entry }[],
	opts: StatsOptions,
	show: (heading: string, entries: Entry[], note?: string) => () => void
): void {
	const perDay = new Map<string, Entry[]>();
	for (const v of watched) {
		const list = perDay.get(v.date);
		if (list) list.push(v.entry);
		else perDay.set(v.date, [v.entry]);
	}

	const dates = [...perDay.keys()].sort();
	const lastISO = dates[dates.length - 1];
	if (!lastISO) return;

	/*
	 * The window ends at the last thing you watched, not at today.
	 *
	 * A library that has not been logged in since March should show March's
	 * activity, not four blank months followed by a chart that looks broken.
	 * When a year is selected the window is that year exactly, because that is
	 * what the filter means.
	 */
	const end = opts.year ? new Date(Date.UTC(opts.year, 11, 31)) : parseISO(lastISO);
	const start = opts.year ? new Date(Date.UTC(opts.year, 0, 1)) : addDays(end, -363);
	// Weeks run Monday to Sunday, so the grid starts on the Monday on or before
	// the window opens or the first column is a ragged half-week.
	const gridStart = addDays(start, -((start.getUTCDay() + 6) % 7));
	const weeks = Math.ceil((diffDays(gridStart, end) + 1) / 7);

	const box = el.createDiv({ cls: "reel-chart reel-heatmap-box" });
	const head = box.createDiv({ cls: "reel-heatmap-head" });
	head.createDiv({ cls: "reel-chart-title", text: opts.year ? `${opts.year}, day by day` : "The last year" });

	const busiest = [...perDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];
	const peak = Math.max(1, busiest ? busiest[1].length : 1);
	const active = [...perDay.keys()].filter((d) => d >= iso(start) && d <= iso(end)).length;
	head.createDiv({
		cls: "reel-heatmap-sub",
		text: `${active} ${active === 1 ? "day" : "days"} with something on`,
	});

	const scroll = box.createDiv({ cls: "reel-heatmap-scroll" });
	const grid = scroll.createDiv({ cls: "reel-heatmap-grid" });
	grid.setCssProps({ "--reel-heat-weeks": String(weeks) });

	/*
	 * Month labels, placed on the week each month opens in.
	 *
	 * Without them the grid is a texture with no scale — you can see that
	 * something happened but not when. Written only when the month changes, or
	 * fifty-two labels overlap into a smear.
	 */
	const months = grid.createDiv({ cls: "reel-heatmap-months" });
	let lastMonth = -1;
	for (let w = 0; w < weeks; w++) {
		const day = addDays(gridStart, w * 7);
		const label = months.createDiv({ cls: "reel-heatmap-month" });
		if (day.getUTCMonth() !== lastMonth && day.getUTCDate() <= 7) {
			lastMonth = day.getUTCMonth();
			label.setText(MONTH_SHORT[lastMonth]);
		}
	}

	const cells = grid.createDiv({ cls: "reel-heatmap-cells" });
	for (let w = 0; w < weeks; w++) {
		const col = cells.createDiv({ cls: "reel-heatmap-week" });
		for (let d = 0; d < 7; d++) {
			const day = addDays(gridStart, w * 7 + d);
			const key = iso(day);
			const cell = col.createDiv({ cls: "reel-heatmap-cell" });

			// Outside the window is not the same as "nothing that day", and a
			// grid that renders them identically is lying about its edges.
			if (day < start || day > end) {
				cell.addClass("is-outside");
				continue;
			}

			const hits = perDay.get(key) ?? [];
			if (!hits.length) continue;

			// Four steps, not a continuous ramp: the eye cannot rank thirty
			// shades, and every one of these is a small square.
			const level = Math.min(4, Math.ceil((hits.length / peak) * 4));
			cell.addClass(`is-l${level}`);
			cell.setAttr("title", `${prettyDate(key)} — ${hits.length} ${hits.length === 1 ? "film" : "films"}`);
			cell.setAttr("role", "button");
			cell.setAttr("tabindex", "0");
			cell.setAttr("aria-label", `${prettyDate(key)}, ${hits.length} watched`);
			const open = show(prettyDate(key), hits, `${hits.length} watched that day`);
			cell.addEventListener("click", open);
			cell.addEventListener("keydown", (ev: KeyboardEvent) => {
				if (ev.key !== "Enter" && ev.key !== " ") return;
				ev.preventDefault();
				open();
			});
		}
	}

	// A key, because four unlabelled shades of the same colour is a decoration
	// rather than a scale.
	const legend = box.createDiv({ cls: "reel-heatmap-legend" });
	legend.createSpan({ cls: "reel-dim", text: "Less" });
	for (let l = 0; l <= 4; l++) {
		legend.createDiv({ cls: `reel-heatmap-cell${l ? ` is-l${l}` : ""}` });
	}
	legend.createSpan({ cls: "reel-dim", text: "More" });
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/*
 * UTC throughout.
 *
 * A date-only string parsed as local time lands on the previous day west of
 * Greenwich, which would put every viewing in the wrong cell for half the
 * world — and, worse, only for half the year in places that observe daylight
 * saving. The dates in frontmatter are calendar days with no timezone, so they
 * are read and written as such.
 */
function parseISO(s: string): Date {
	const [y, m, d] = s.split("-").map(Number);
	return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function iso(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
	return new Date(d.getTime() + n * 86_400_000);
}

function diffDays(a: Date, b: Date): number {
	return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
