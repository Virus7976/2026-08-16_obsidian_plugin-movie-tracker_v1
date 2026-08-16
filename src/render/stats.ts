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

export interface StatsOptions {
	year?: number;
	include: "all" | "film" | "tv";
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

	const all = plugin.visible(plugin.library.all());
	const films = opts.include === "tv" ? [] : all.filter((e) => e.type === "film");
	const shows = opts.include === "film" ? [] : all.filter((e) => e.type === "tv");
	const watched = viewings(films, opts.year);

	if (!watched.length && !shows.length) {
		el.createDiv({ cls: "reel-empty", text: "Nothing logged yet." });
		return;
	}

	/* ---- year selector ------------------------------------------------ */
	// Reuse the unfiltered pass rather than flattening every watch history a
	// second time just to collect the years.
	const allViewings = opts.year ? viewings(films) : watched;
	const years = [...new Set(allViewings.map((v) => v.date.slice(0, 4)))].sort().reverse();
	if (years.length > 1) {
		const bar = el.createDiv({ cls: "reel-chips" });
		const chip = (label: string, active: boolean, year?: number) => {
			const b = bar.createEl("button", { cls: "reel-chip", text: label });
			b.toggleClass("is-active", active);
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

	const tiles = el.createDiv({ cls: "reel-tiles" });

	/**
	 * A headline number.
	 *
	 * `go` makes it a control. Once the charts became clickable, a tile that
	 * looked identical and did nothing was the odd one out — and half the
	 * counts here name a set you would obviously want to see.
	 */
	const tile = (label: string, value: string, sub?: string, go?: () => void) => {
		const t = tiles.createDiv({ cls: "reel-tile" });
		t.createDiv({ cls: "reel-tile-value", text: value });
		t.createDiv({ cls: "reel-tile-label", text: label });
		if (sub) t.createDiv({ cls: "reel-tile-sub", text: sub });
		if (!go) return;
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

	if (films.length) {
		const distinct = new Set(watched.map((v) => v.entry.path)).size;
		const rewatches = watched.filter((v) => v.rewatch).length;
		tile("Films watched", String(watched.length), `${distinct} distinct · ${rewatches} rewatches`, () =>
			void plugin.openLibraryWithStatus("watched", "stats")
		);
		tile("Hours of film", formatMinutes(filmMinutes));
	}
	if (shows.length) {
		tile("Episodes", String(episodesSeen), `${shows.length} show${shows.length === 1 ? "" : "s"}`, () =>
			void plugin.openLibraryWithStatus("watching", "stats")
		);
		if (episodeMinutes) tile("Hours of TV", formatMinutes(episodeMinutes));
	}
	if (rated.length) {
		const mean = rated.reduce((a, b) => a + b, 0) / rated.length;
		tile("Average rating", mean.toFixed(2), `${rated.length} rated`);
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

	const watchlist = all.filter((e) => e.status === "watchlist").length;
	if (watchlist) {
		// At your current pace, how long is the backlog?
		const rate = perMonth ? watched.length / perMonth : 0;
		tile(
			"On the watchlist",
			String(watchlist),
			rate > 0 ? `${Math.ceil(watchlist / rate)} months at this pace` : undefined,
			() => void plugin.openLibraryWithStatus("watchlist", "stats")
		);
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
			row.createDiv({ cls: "reel-fact-label", text: f.label });
			row.createDiv({ cls: "reel-fact-value", text: f.value });
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
		for (const v of watched) {
			const y = v.date.slice(0, 4);
			byYear.set(y, (byYear.get(y) ?? 0) + 1);
		}
		// A year bar re-scopes the whole page to that year, which is what the
		// year chips at the top already do — so the bar and the chip agree
		// rather than the bar being the one number on the page that is inert.
		bars(
			charts,
			"Films per year",
			[...byYear.entries()]
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([label, n]) => ({ label, n, go: () => paintStats(plugin, el, { ...opts, year: Number(label) }) })),
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
	if (watched.length) {
		const byMonth = new Array(12).fill(0);
		for (const v of watched) byMonth[parseInt(v.date.slice(5, 7), 10) - 1]++;
		const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		if (byMonth.some((n) => n > 0)) bars(charts, "By month", byMonth.map((n, i) => ({ label: names[i], n })));

		const byWeekday = new Array(7).fill(0);
		for (const v of watched) {
			const d = new Date(v.date + "T00:00:00");
			if (!Number.isNaN(d.getTime())) byWeekday[d.getDay()]++;
		}
		const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		if (byWeekday.some((n) => n > 0)) bars(charts, "By day of week", byWeekday.map((n, i) => ({ label: days[i], n })));
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
		ratedBy(charts, "Directors you rate highest", seenFilms, (e) => e.director.map(unlink), 2, plugin);
		tally(charts, "Top actors", seenFilms, (e) => e.cast.map(unlink), undefined, undefined, plugin);
		// Recurring characters are mostly a franchise signal — the same part
		// across several films is the interesting case, so require two.
		tally(charts, "Recurring characters", seenFilms, (e) => e.characters, undefined, undefined, plugin);
	}
	if (seenShows.length) {
		tally(charts, "Top creators", seenShows, (e) => e.creators.map(unlink), undefined, undefined, plugin);
		tally(charts, "Top actors — TV", seenShows, (e) => e.cast.map(unlink), undefined, undefined, plugin);
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
	const box = el.createDiv({ cls: "reel-chart" });
	box.createDiv({ cls: "reel-chart-title", text: title });
	const body = box.createDiv({ cls: "reel-chart-body" });
	for (const d of data) {
		const row = body.createDiv({ cls: "reel-chart-row" });

		// Label and number on one line, posters underneath.
		//
		// A single thumbnail beside a thin bar left most of the row empty and
		// told you nothing about the other four films. Showing every title the
		// row counts turns the chart into the thing it is describing — the
		// posters are the bar, and their number is the count.
		const head = row.createDiv({ cls: "reel-chart-head" });
		const label = head.createDiv({ cls: "reel-chart-label", text: d.label });
		label.setAttr("title", d.note ? `${d.label} — ${d.note}` : d.label);
		if (d.note) label.createDiv({ cls: "reel-chart-sub", text: d.note });
		head.createDiv({ cls: "reel-chart-value", text: `${d.n}${suffix}` });

		const posters = plugin ? (d.entries ?? []) : [];
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
			track.createDiv({ cls: "reel-chart-fill" }).setCssProps({ "--reel-fill": String(d.n / max) });
		}

		// Every bar answers a question you can only otherwise ask by hand:
		// "which seven were the dramas?" Tapping runs that search — or, where
		// a search is the wrong answer, whatever the row supplied instead.
		if (plugin && (d.search || d.go)) {
			row.addClass("is-clickable");
			row.setAttr("role", "button");
			row.setAttr("tabindex", "0");
			row.setAttr("aria-label", d.go ? `Show ${d.label} only` : `Show titles matching ${d.label}`);
			const open = d.go ?? (() => void plugin.openViewWithSearch(d.search ?? d.label, "stats"));
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
	plugin?: ReelPlugin
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
		.map(([label, list]) => ({ label, n: list.length, entries: list, search: label }));
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
	plugin?: ReelPlugin
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
