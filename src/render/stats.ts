/**
 * The ```film-stats``` block.
 *
 * Everything here is computed from frontmatter already sitting in the index —
 * zero API calls, zero disk reads. That's what makes it safe to leave on a
 * dashboard note you open constantly.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { formatMinutes } from "../util/dates";
import { rangeCount } from "../util/ranges";
import { MAX_STARS, STEP } from "../util/ratings";

export function registerStatsBlock(plugin: ReelPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"film-stats",
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			ctx.addChild(new StatsBlock(plugin, el, source));
		}
	);
}

interface StatsOptions {
	year?: number;
	include: "all" | "film" | "tv";
}

class StatsBlock extends MarkdownRenderChild {
	private opts: StatsOptions;

	constructor(
		private plugin: ReelPlugin,
		containerEl: HTMLElement,
		source: string
	) {
		super(containerEl);
		this.opts = parseOptions(source);
	}

	onload(): void {
		this.containerEl.addClass("reel-block", "reel-stats");
		this.render();
		this.registerEvent(this.plugin.library.on("changed", () => this.render()));
	}

	private render(): void {
		const el = this.containerEl;
		el.empty();

		const all = this.plugin.library.all();
		const films = this.opts.include === "tv" ? [] : all.filter((e) => e.type === "film");
		const shows = this.opts.include === "film" ? [] : all.filter((e) => e.type === "tv");

		const viewings = films.flatMap((f) =>
			f.watched
				.filter((w) => !this.opts.year || w.date.startsWith(String(this.opts.year)))
				.map((w) => ({ film: f, w }))
		);

		if (!viewings.length && !shows.length) {
			el.createDiv({ cls: "reel-empty", text: "Nothing logged yet." });
			return;
		}

		/* ---- headline numbers ---------------------------------------- */
		const filmMinutes = viewings.reduce((n, v) => n + (v.film.runtime ?? 0), 0);
		const episodesSeen = shows.reduce(
			(n, s) => n + s.seasons.reduce((m, x) => m + rangeCount(x.watched), 0),
			0
		);
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
			const distinct = new Set(viewings.map((v) => v.film.path)).size;
			const rewatches = viewings.filter((v) => v.w.rewatch).length;
			tile("Films watched", String(viewings.length), `${distinct} distinct · ${rewatches} rewatches`);
			tile("Hours of film", formatMinutes(filmMinutes));
		}
		if (shows.length) {
			tile("Episodes", String(episodesSeen), `${shows.length} show${shows.length === 1 ? "" : "s"}`);
			if (episodeMinutes) tile("Hours of TV", formatMinutes(episodeMinutes));
		}

		const rated = viewings.map((v) => v.w.rating ?? v.film.rating).filter((r): r is number => r != null);
		if (rated.length) {
			const mean = rated.reduce((a, b) => a + b, 0) / rated.length;
			tile("Average rating", mean.toFixed(2), `${rated.length} rated`);
		}

		/* ---- per-year bars ------------------------------------------- */
		if (!this.opts.year && viewings.length) {
			const byYear = new Map<string, number>();
			for (const v of viewings) {
				const y = v.w.date.slice(0, 4);
				byYear.set(y, (byYear.get(y) ?? 0) + 1);
			}
			this.bars(
				el,
				"Films per year",
				[...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, n]) => ({ label: k, n }))
			);
		}

		/* ---- rating distribution ------------------------------------- */
		if (rated.length) {
			const buckets: { label: string; n: number }[] = [];
			for (let r = STEP; r <= MAX_STARS; r += STEP) {
				buckets.push({ label: r.toString(), n: rated.filter((x) => Math.abs(x - r) < 0.01).length });
			}
			this.bars(el, "Rating distribution", buckets);
		}

		/* ---- top people ---------------------------------------------- */
		if (films.length) this.people(el, "Top directors", films, (e) => e.director);
		if (shows.length) this.people(el, "Top creators", shows, (e) => e.creators);

		/* ---- genres --------------------------------------------------- */
		const genreCount = new Map<string, number>();
		for (const e of [...films, ...shows]) for (const g of e.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
		if (genreCount.size) {
			this.bars(
				el,
				"Genres",
				[...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, n]) => ({ label, n }))
			);
		}
	}

	private bars(el: HTMLElement, title: string, data: { label: string; n: number }[]): void {
		if (!data.length) return;
		const max = Math.max(...data.map((d) => d.n), 1);
		const box = el.createDiv({ cls: "reel-chart" });
		box.createDiv({ cls: "reel-chart-title", text: title });
		const body = box.createDiv({ cls: "reel-chart-body" });
		for (const d of data) {
			const row = body.createDiv({ cls: "reel-chart-row" });
			row.createDiv({ cls: "reel-chart-label", text: d.label });
			const track = row.createDiv({ cls: "reel-chart-track" });
			const fill = track.createDiv({ cls: "reel-chart-fill" });
			fill.style.setProperty("--reel-fill", String(d.n / max));
			row.createDiv({ cls: "reel-chart-value", text: String(d.n) });
		}
	}

	private people(el: HTMLElement, title: string, rows: Entry[], pick: (e: Entry) => string[]): void {
		const count = new Map<string, number>();
		for (const e of rows) for (const p of pick(e)) count.set(p, (count.get(p) ?? 0) + 1);
		const top = [...count.entries()]
			.filter(([, n]) => n > 1)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([label, n]) => ({ label, n }));
		this.bars(el, title, top);
	}
}

function parseOptions(source: string): StatsOptions {
	const opts: StatsOptions = { include: "all" };
	for (const line of source.split("\n")) {
		const [k, v] = line.split(":").map((s) => s?.trim().toLowerCase());
		if (!k || !v) continue;
		if (k === "year" && /^\d{4}$/.test(v)) opts.year = parseInt(v, 10);
		if (k === "include") opts.include = v === "film" || v === "films" ? "film" : v === "tv" ? "tv" : "all";
	}
	return opts;
}
