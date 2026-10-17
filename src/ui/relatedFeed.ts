/**
 * "More like this", without an end.
 *
 * TMDB gives a first page of recommendations with every title and many more
 * behind it, plus a second list of "similar" titles drawn from shared keywords
 * and genres. This shows what came with the title, then keeps asking for the
 * next page as you scroll, recommendations first and similar after, until
 * there is nothing left to ask for.
 *
 * Used by the title page of something in your library, the title page of
 * something that is not, and the preview sheet, in a grid or a sideways strip.
 */

import { Notice } from "obsidian";
import type ReelPlugin from "../main";
import type { TmdbSearchResult } from "../types";
import { redact } from "../secrets";
import { todayISO, yearOf } from "../util/dates";
import { holdAt, showResultMenu } from "./titleMenu";
import { TitlePage } from "./titlePage";

/** Stop asking after this many, so a very long chain cannot grow forever. */
const CAP = 240;

type Source = "recommendations" | "similar";

export interface RelatedOptions {
	tmdbId: number;
	isTv: boolean;
	/** What arrived with the title, so the first screen needs no request. */
	seed: TmdbSearchResult[];
	layout: "grid" | "strip";
	/** A title in your library opens its own page and may need to close this one. */
	beforeOpenMine?: () => void;
	onAdded?: () => void;
}

export function paintRelatedFeed(plugin: ReelPlugin, el: HTMLElement, opts: RelatedOptions): void {
	const list = el.createDiv({ cls: opts.layout === "grid" ? "reel-related" : "reel-related reel-morelike" });
	const seen = new Set<number>([opts.tmdbId]);
	let sources: Source[] = ["recommendations", "similar"];
	let page = 1;
	let done = false;
	let loading = false;
	let shownCount = 0;

	const card = (raw: TmdbSearchResult): void => {
		const r: TmdbSearchResult = { ...raw, media_type: raw.media_type ?? (opts.isTv ? "tv" : "movie") };
		const rTv = r.media_type === "tv";
		const title = (rTv ? r.name : r.title) ?? "Untitled";
		const year = String(yearOf(rTv ? r.first_air_date : r.release_date) ?? "");
		const c = list.createDiv({ cls: "reel-related-card" });
		c.setAttr("role", "button");
		c.setAttr("tabindex", "0");
		c.setAttr("aria-label", `${title} — see details`);
		const poster = c.createDiv({ cls: "reel-related-poster" });
		plugin.posters.attach(poster, { posterUrl: plugin.tmdb.posterUrl(r.poster_path, "w342") ?? undefined, title });
		c.createDiv({ cls: "reel-related-title", text: title });
		const bits = [year, r.vote_average ? `★ ${r.vote_average.toFixed(1)}` : ""].filter(Boolean);
		if (bits.length) c.createDiv({ cls: "reel-related-sub", text: bits.join("  ") });

		const mine = (): ReturnType<typeof plugin.library.byTmdbId> => plugin.library.byTmdbId(r.id, rTv ? "tv" : "film");
		const open = (): void => plugin.openTitle(r, { onAdded: opts.onAdded, beforeOpenMine: opts.beforeOpenMine });
		holdAt(c, (x, y) =>
			showResultMenu(
				plugin,
				{ id: r.id, title, year, isTv: rTv },
				x,
				y,
				open,
				mine()
					? undefined
					: () => {
							void plugin.notes
								.createFromResult(r, { date: todayISO(), watchlist: true })
								.then(() => plugin.undo.offer(`Added ${title} to your watchlist`))
								.catch((e: unknown) => new Notice(`Reel: ${redact(e)}`));
						},
				() => plugin.openTitle(r, { tab: "content", onAdded: opts.onAdded, beforeOpenMine: opts.beforeOpenMine })
			)
		);
		c.addEventListener("click", open);
		c.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (ev.key === "Enter" || ev.key === " ") {
				ev.preventDefault();
				open();
			}
		});
	};

	const add = (rows: TmdbSearchResult[]): number => {
		let n = 0;
		for (const r of rows) {
			if (seen.has(r.id) || r.adult || !r.poster_path) continue;
			seen.add(r.id);
			card(r);
			n++;
			shownCount++;
		}
		return n;
	};

	add(opts.seed);

	const sentinel = el.createDiv({ cls: "reel-feed-end reel-related-end" });
	if (opts.layout === "strip") list.appendChild(sentinel);
	sentinel.createDiv({ cls: "reel-loading", text: "Loading more…" });

	const more = async (): Promise<void> => {
		if (loading || done) return;
		loading = true;
		try {
			// A page can add nothing new (every title already shown), so walk on
			// a few pages rather than stop on a technicality.
			for (let tries = 0; tries < 4 && shownCount < CAP; tries++) {
				const source = sources[0];
				if (!source) break;
				page += 1;
				const res = await plugin.tmdb.relatedPage(opts.isTv ? "tv" : "movie", opts.tmdbId, source, page);
				if (page >= res.total_pages) {
					sources = sources.slice(1);
					page = 0;
				}
				if (add(res.results) > 0) break;
			}
		} catch {
			// A failed page is not a failed screen: stop asking, keep what is shown.
			done = true;
		} finally {
			loading = false;
			if (!sources.length || shownCount >= CAP) done = true;
			if (done) sentinel.remove();
		}
	};

	// The first page of "recommendations" arrived with the title; start at its
	// second page. "Similar" starts at its second page too, for the same reason.
	const startOn = (): void => {
		page = 1;
	};
	startOn();

	const root = opts.layout === "strip" ? list : null;
	const io = new IntersectionObserver(
		(entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			void more().then(() => {
				// An observer only speaks when the sentinel's state changes; a new
				// row can leave it still in view, so watch it afresh.
				if (!sentinel.isConnected) return;
				io.unobserve(sentinel);
				io.observe(sentinel);
			});
		},
		{ root, rootMargin: opts.layout === "strip" ? "0px 400px 0px 0px" : "600px 0px" }
	);
	io.observe(sentinel);
}
