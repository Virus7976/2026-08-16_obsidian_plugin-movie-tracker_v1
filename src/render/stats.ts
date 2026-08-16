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
	const years = [...new Set(viewings(films).map((v) => v.date.slice(0, 4)))].sort().reverse();
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
	const tile = (label: string, value: string, sub?: string) => {
		const t = tiles.createDiv({ cls: "reel-tile" });
		t.createDiv({ cls: "reel-tile-value", text: value });
		t.createDiv({ cls: "reel-tile-label", text: label });
		if (sub) t.createDiv({ cls: "reel-tile-sub", text: sub });
	};

	const rated = watched.map((v) => v.rating ?? v.entry.rating).filter((r): r is number => r != null);

	if (films.length) {
		const distinct = new Set(watched.map((v) => v.entry.path)).size;
		const rewatches = watched.filter((v) => v.rewatch).length;
		tile("Films watched", String(watched.length), `${distinct} distinct · ${rewatches} rewatches`);
		tile("Hours of film", formatMinutes(filmMinutes));
	}
	if (shows.length) {
		tile("Episodes", String(episodesSeen), `${shows.length} show${shows.length === 1 ? "" : "s"}`);
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

	const streak = currentStreak(watched.map((v) => v.date));
	if (streak > 1) tile("Current streak", `${streak} days`);

	const perMonth = watched.length && monthsCovered(watched.map((v) => v.date));
	if (perMonth && perMonth > 1) tile("Films per month", (watched.length / perMonth).toFixed(1));

	const watchlist = all.filter((e) => e.status === "watchlist").length;
	if (watchlist) {
		// At your current pace, how long is the backlog?
		const rate = perMonth ? watched.length / perMonth : 0;
		tile("On the watchlist", String(watchlist), rate > 0 ? `${Math.ceil(watchlist / rate)} months at this pace` : undefined);
	}

	const unrated = films.filter((e) => e.rating == null && e.watched.length).length;
	if (unrated) tile("Unrated", String(unrated), "tap Rate to fix");

	if (watched.length && !opts.year) {
		const perDay = new Map<string, number>();
		for (const v of watched) perDay.set(v.date, (perDay.get(v.date) ?? 0) + 1);
		const best = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
		if (best && best[1] > 1) tile("Busiest day", `${best[1]} films`, prettyDate(best[0]));
	}

	/* ---- superlatives -------------------------------------------------- */
	const longest = films.filter((e) => e.runtime).sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0))[0];
	const topRated = films.filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
	const mostRewatched = films.filter((e) => e.watched.length > 1).sort((a, b) => b.watched.length - a.watched.length)[0];

	const facts: { label: string; value: string }[] = [];
	if (topRated.length) facts.push({ label: "Highest rated", value: `${topRated[0].title} — ${topRated[0].rating}★` });
	if (topRated.length > 1) {
		const worst = topRated[topRated.length - 1];
		facts.push({ label: "Lowest rated", value: `${worst.title} — ${worst.rating}★` });
	}
	if (longest) facts.push({ label: "Longest", value: `${longest.title} — ${formatMinutes(longest.runtime ?? 0)}` });
	if (mostRewatched) {
		facts.push({ label: "Most rewatched", value: `${mostRewatched.title} — ${mostRewatched.watched.length}×` });
	}
	const biggestDivergence = paired.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
	if (biggestDivergence && Math.abs(biggestDivergence.delta) >= 1) {
		facts.push({
			label: biggestDivergence.delta > 0 ? "You liked far more than most" : "You liked far less than most",
			value: biggestDivergence.entry.title,
		});
	}

	if (facts.length) {
		const box = el.createDiv({ cls: "reel-facts" });
		for (const f of facts) {
			const row = box.createDiv({ cls: "reel-fact" });
			row.createDiv({ cls: "reel-fact-label", text: f.label });
			row.createDiv({ cls: "reel-fact-value", text: f.value });
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
		bars(charts, "Films per year", [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, n]) => ({ label, n })));
	}

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

	// People are stored as wikilinks, so unwrap before counting or
	// "[[People/X|X]]" and "X" tally separately.
	if (films.length) {
		tally(charts, "Top directors", films, (e) => e.director.map(unlink));
		ratedBy(charts, "Directors you rate highest", films, (e) => e.director.map(unlink));
		tally(charts, "Top actors", films, (e) => e.cast.map(unlink));
	}
	if (shows.length) tally(charts, "Top creators", shows, (e) => e.creators.map(unlink));

	tally(charts, "Genres", all, (e) => e.genres, 10);
	ratedBy(charts, "Genres you rate highest", films, (e) => e.genres, 3);
	tally(charts, "Top collections", all, (e) => (e.collection ? [e.collection] : []));
	tally(charts, "Certifications", all, (e) => (e.certification ? [e.certification] : []), 8, 1);
	tally(charts, "Streaming on", all, (e) => e.providers, 8, 1);
	tally(charts, "Studios", all, (e) => e.productionCompanies, 6);
	tally(charts, "Languages", all, (e) => (e.language ? [e.language] : []), 6, 1);

	const decades = new Map<string, number>();
	for (const e of all) {
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
			bars(charts, "Series progress (%)", inProgress.map((s) => ({ label: s.title, n: s.progress ?? 0 })));
		}
	}
}

interface Bar {
	label: string;
	n: number;
}

function bars(el: HTMLElement, title: string, data: Bar[], suffix = ""): void {
	if (!data.length) return;
	const max = Math.max(...data.map((d) => d.n), 1);
	const box = el.createDiv({ cls: "reel-chart" });
	box.createDiv({ cls: "reel-chart-title", text: title });
	const body = box.createDiv({ cls: "reel-chart-body" });
	for (const d of data) {
		const row = body.createDiv({ cls: "reel-chart-row" });
		row.createDiv({ cls: "reel-chart-label", text: d.label });
		const track = row.createDiv({ cls: "reel-chart-track" });
		track.createDiv({ cls: "reel-chart-fill" }).setCssProps({ "--reel-fill": String(d.n / max) });
		row.createDiv({ cls: "reel-chart-value", text: `${d.n}${suffix}` });
	}
}

function tally(
	el: HTMLElement,
	title: string,
	rows: Entry[],
	pick: (e: Entry) => string[],
	limit = 8,
	minCount = 2
): void {
	const count = new Map<string, number>();
	for (const e of rows) for (const value of pick(e)) if (value) count.set(value, (count.get(value) ?? 0) + 1);
	const top = [...count.entries()]
		.filter(([, n]) => n >= minCount)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([label, n]) => ({ label, n }));
	bars(el, title, top);
}

/**
 * Average rating per group — "who do you actually rate", as distinct from who
 * you happen to have watched most. Needs a minimum sample, or one five-star
 * film puts an unknown director at the top of the chart.
 */
function ratedBy(el: HTMLElement, title: string, rows: Entry[], pick: (e: Entry) => string[], min = 2): void {
	const sums = new Map<string, { total: number; n: number }>();
	for (const e of rows) {
		if (e.rating == null) continue;
		for (const key of pick(e)) {
			if (!key) continue;
			const cur = sums.get(key) ?? { total: 0, n: 0 };
			cur.total += e.rating;
			cur.n++;
			sums.set(key, cur);
		}
	}
	const top = [...sums.entries()]
		.filter(([, v]) => v.n >= min)
		.map(([label, v]) => ({ label: `${label} (${v.n})`, n: Math.round((v.total / v.n) * 10) / 10 }))
		.sort((a, b) => b.n - a.n)
		.slice(0, 8);
	bars(el, title, top, "★");
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
