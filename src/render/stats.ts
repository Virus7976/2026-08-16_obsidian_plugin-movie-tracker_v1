/**
 * Analytics.
 *
 * Everything is computed from frontmatter already in the index — zero API
 * calls, zero disk reads — which is what makes it safe on a dashboard note you
 * open constantly, and what makes it work with no signal.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { unlink } from "../library";
import { formatMinutes } from "../util/dates";
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

	const watchedFilms = viewings(films, opts.year);

	if (!watchedFilms.length && !shows.length) {
		el.createDiv({ cls: "reel-empty", text: "Nothing logged yet." });
		return;
	}

	/* ---- headline tiles ---------------------------------------------- */
	const filmMinutes = watchedFilms.reduce((n, v) => n + (v.entry.runtime ?? 0), 0);
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

	if (films.length) {
		const distinct = new Set(watchedFilms.map((v) => v.entry.path)).size;
		const rewatches = watchedFilms.filter((v) => v.rewatch).length;
		tile("Films watched", String(watchedFilms.length), `${distinct} distinct · ${rewatches} rewatches`);
		tile("Hours of film", formatMinutes(filmMinutes));
	}
	if (shows.length) {
		tile("Episodes", String(episodesSeen), `${shows.length} show${shows.length === 1 ? "" : "s"}`);
		if (episodeMinutes) tile("Hours of TV", formatMinutes(episodeMinutes));
	}

	const rated = watchedFilms.map((v) => v.rating ?? v.entry.rating).filter((r): r is number => r != null);
	if (rated.length) {
		const mean = rated.reduce((a, b) => a + b, 0) / rated.length;
		tile("Average rating", mean.toFixed(2), `${rated.length} rated`);
	}

	const watchlist = all.filter((e) => e.status === "watchlist").length;
	if (watchlist) tile("On the watchlist", String(watchlist));

	if (watchedFilms.length && !opts.year) {
		// Busiest single day — a small thing, but it's the sort of number a
		// year-in-review is actually for.
		const perDay = new Map<string, number>();
		for (const v of watchedFilms) perDay.set(v.date, (perDay.get(v.date) ?? 0) + 1);
		const best = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
		if (best && best[1] > 1) tile("Busiest day", `${best[1]} films`, best[0]);
	}

	/* ---- charts ------------------------------------------------------- */
	if (!opts.year && watchedFilms.length) {
		const byYear = new Map<string, number>();
		for (const v of watchedFilms) {
			const y = v.date.slice(0, 4);
			byYear.set(y, (byYear.get(y) ?? 0) + 1);
		}
		bars(el, "Films per year", [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, n]) => ({ label, n })));
	}

	if (watchedFilms.length) {
		const byMonth = new Array(12).fill(0);
		for (const v of watchedFilms) byMonth[parseInt(v.date.slice(5, 7), 10) - 1]++;
		const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		if (byMonth.some((n) => n > 0)) {
			bars(el, "By month", byMonth.map((n, i) => ({ label: names[i], n })));
		}
	}

	if (rated.length) {
		const buckets: Bar[] = [];
		for (let r = STEP; r <= MAX_STARS; r += STEP) {
			buckets.push({ label: r.toString(), n: rated.filter((x) => Math.abs(x - r) < 0.01).length });
		}
		bars(el, "Rating distribution", buckets);
	}

	// People are stored as wikilinks, so they have to be unwrapped before
	// counting or "[[People/X|X]]" and "X" would tally separately.
	if (films.length) people(el, "Top directors", films, (e) => e.director);
	if (films.length) people(el, "Top actors", films, (e) => e.cast);
	if (shows.length) people(el, "Top creators", shows, (e) => e.creators);
	if (shows.length) people(el, "Top actors — TV", shows, (e) => e.cast);

	tally(el, "Top collections", all, (e) => (e.collection ? [e.collection] : []));
	tally(el, "Genres", all, (e) => e.genres, 8);
	tally(el, "Certifications", all, (e) => (e.certification ? [e.certification] : []), 8, 1);
	tally(el, "Streaming on", all, (e) => e.providers, 8, 1);
	tally(el, "Studios", all, (e) => e.productionCompanies, 6);

	const decades = new Map<string, number>();
	for (const e of all) {
		const y = e.year ?? e.firstAirYear;
		if (y) {
			const d = `${Math.floor(y / 10) * 10}s`;
			decades.set(d, (decades.get(d) ?? 0) + 1);
		}
	}
	if (decades.size > 1) {
		bars(el, "By decade", [...decades.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, n]) => ({ label, n })));
	}
}

interface Bar {
	label: string;
	n: number;
}

function bars(el: HTMLElement, title: string, data: Bar[]): void {
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
		row.createDiv({ cls: "reel-chart-value", text: String(d.n) });
	}
}

function people(el: HTMLElement, title: string, rows: Entry[], pick: (e: Entry) => string[]): void {
	tally(el, title, rows, (e) => pick(e).map(unlink));
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
