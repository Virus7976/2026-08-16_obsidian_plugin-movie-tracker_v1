/**
 * The Discover screen.
 *
 * Two modes behind one filter bar. **For you** builds rows from your ratings;
 * picking a genre, decade or minimum score switches to a filtered grid. The
 * default is personal, because a tracker that knows what you've rated should
 * use that before making you specify anything.
 *
 * Every card carries its three decisions inline — watchlist, seen, not
 * interested — because opening a sheet to say "no" is the wrong cost for the
 * commonest answer. The sheet is still there when you want the overview first.
 */

import { Modal, Notice, Platform, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { TmdbSearchResult, TmdbFilm, TmdbShow } from "../types";
import type { DiscoverRow, TasteProfile } from "../discover";
import { redact } from "../secrets";
import { todayISO, yearOf } from "../util/dates";
import { renderStars } from "./stars";
import { SearchModal } from "./searchModal";
import { LogSheet } from "./logSheet";
import { trailerUrl, providerNames, imdbUrl, tmdbUrl } from "../extract";
import { formatMinutes } from "../util/dates";
import { PersonSheet } from "./personSheet";
import { badgePerson } from "./personBadge";
import { skeletonCards, skeletonGrid } from "./skeleton";
import { haptic } from "../util/haptics";
import { setSelected } from "./a11y";
import { diagnoseError } from "./failure";

interface Filters {
	genreId: number | null;
	genreName: string | null;
	decade: number | null;
	minRating: number | null;
	type: "movie" | "tv";
}

const EMPTY: Filters = { genreId: null, genreName: null, decade: null, minRating: null, type: "movie" };

export class DiscoverScreen {
	private rows: DiscoverRow[] | null = null;
	private profile: TasteProfile | null = null;
	private results: TmdbSearchResult[] | null = null;
	private genres: { id: number; name: string }[] = [];
	private filters: Filters = { ...EMPTY };
	private loading = false;
	private error: string | null = null;
	private handled = new Set<number>();
	private page = 1;
	private exhausted = false;
	/** "Something like this one" — a title to draw recommendations from. */
	private seed: { id: number; type: "movie" | "tv"; title: string } | null = null;
	/** One-at-a-time browsing, for when you want to move fast rather than skim. */
	private quick = false;
	private quickAt = 0;

	constructor(private plugin: ReelPlugin) {}

	private get filtered(): boolean {
		return (
			this.seed != null ||
			this.filters.genreId != null ||
			this.filters.decade != null ||
			this.filters.minRating != null
		);
	}

	reset(): void {
		this.seed = null;
		this.rows = null;
		this.profile = null;
		this.results = null;
		this.error = null;
		this.handled.clear();
		this.page = 1;
		this.exhausted = false;
	}

	render(container: HTMLElement): void {
		container.empty();
		container.addClass("reel-discover");

		this.paintFilters(container);

		if (this.error) {
			container.createDiv({ cls: "reel-error", text: this.error });
			const retry = container.createEl("button", { cls: "reel-btn", text: "Try again" });
			retry.addEventListener("click", () => {
				this.error = null;
				this.render(container);
			});
			return;
		}

		if (this.quick) this.paintQuick(container);
		else if (this.filtered) this.paintResults(container);
		else this.paintForYou(container);
	}

	/* ------------------------------------------------------------------ */
	/* Quick mode — one title at a time                                    */
	/* ------------------------------------------------------------------ */

	/**
	 * The same pool the rows draw from, flattened and de-duplicated.
	 *
	 * A title can appear in several rows — trending and your top genre often
	 * overlap — and seeing it twice in a linear run reads as the queue being
	 * stuck rather than as two separate recommendations.
	 */
	private quickPool(): TmdbSearchResult[] {
		const source = this.filtered ? (this.results ?? []) : (this.rows ?? []).flatMap((r) => r.items);
		const seen = new Set<number>();
		const out: TmdbSearchResult[] = [];
		for (const item of source) {
			if (seen.has(item.id) || this.handled.has(item.id)) continue;
			seen.add(item.id);
			out.push(item);
		}
		return out;
	}

	private paintQuick(container: HTMLElement): void {
		// Quick mode reads whatever the browsing mode already loaded, so
		// entering it cold has to trigger the same fetch the rows would.
		if (!this.filtered && !this.rows) {
			void this.loadRows(container);
			// Quick mode shows one big card at a time, so the placeholder is a
			// single card rather than a strip of them.
			skeletonCards(container, 1, "Loading");
			return;
		}
		if (this.filtered && !this.results) {
			// The filtered fetch lives inside paintResults; letting it run
			// re-renders when it lands, and this branch is gone by then.
			this.paintResults(container);
			return;
		}

		const pool = this.quickPool();
		if (!pool.length) {
			const done = container.createDiv({ cls: "reel-empty" });
			done.createDiv({ text: "Nothing left in this queue." });
			const back = done.createEl("button", { cls: "reel-btn mod-cta", text: "Back to rows" });
			back.addEventListener("click", () => {
				this.quick = false;
				this.render(container);
			});
			return;
		}

		if (this.quickAt >= pool.length) this.quickAt = 0;
		const item = pool[this.quickAt];
		const isTv = item.media_type === "tv";
		const title = (isTv ? item.name : item.title) ?? "Untitled";

		const card = container.createDiv({ cls: "reel-quickcard" });

		card.createDiv({ cls: "reel-quickcard-count", text: `${this.quickAt + 1} of ${pool.length}` });

		const posterEl = card.createDiv({ cls: "reel-quickcard-poster" });
		this.plugin.posters.attach(posterEl, {
			posterUrl: this.plugin.tmdb.posterUrl(item.poster_path, "w500") ?? undefined,
			title,
		});
		posterEl.addEventListener("click", () => new PreviewSheet(this.plugin, item, () => this.render(container)).open());

		const head = card.createDiv({ cls: "reel-quickcard-head" });
		head.createSpan({ cls: "reel-quickcard-title", text: title });
		const year = yearOf(isTv ? item.first_air_date : item.release_date);
		if (year) head.createSpan({ cls: "reel-dim", text: ` ${year}` });

		const facts = card.createDiv({ cls: "reel-header-facts" });
		facts.createSpan({ cls: `reel-badge ${isTv ? "tv" : "film"}`, text: isTv ? "Series" : "Film" });
		if (item.vote_average) facts.createSpan({ cls: "reel-dim", text: `TMDB ${item.vote_average.toFixed(1)}` });

		if (item.overview) card.createDiv({ cls: "reel-quickcard-overview", text: item.overview });

		/* ---- actions ---- */
		const step = (by: number) => {
			this.quickAt = Math.max(0, this.quickAt + by);
			this.render(container);
		};

		const actions = card.createDiv({ cls: "reel-quickcard-actions" });

		const skip = actions.createEl("button", { cls: "reel-btn reel-quick-skip", text: "✕  Skip" });
		skip.addEventListener("click", () => step(1));

		const later = actions.createEl("button", { cls: "reel-btn mod-cta", text: "+  Watchlist" });
		later.addEventListener("click", () => void this.quickAdd(item, true, container));

		const seen = actions.createEl("button", { cls: "reel-btn", text: "✓  Seen it" });
		seen.addEventListener("click", () => {
			// The log sheet, not a silent add. "Seen it" for something you
			// watched years ago should not claim you watched it today, and the
			// date, rating and review all live on that one screen already.
			const isTvItem = item.media_type === "tv";
			new LogSheet(this.plugin.app, this.plugin, {
				pending: {
					id: item.id,
					type: isTvItem ? "tv" : "film",
					title: (isTvItem ? item.name : item.title) ?? "Untitled",
				},
			}).open();
			this.handled.add(item.id);
			this.render(container);
		});

		const nav = card.createDiv({ cls: "reel-quickcard-nav" });
		const prev = nav.createEl("button", { cls: "reel-btn", text: "‹ Back", attr: { type: "button" } });
		prev.toggleClass("is-disabled", this.quickAt === 0);
		prev.addEventListener("click", () => step(-1));
		// "Not interested" is the one that persists — it removes a title from
		// every future queue, where Skip only defers it to the next session.
		const never = nav.createEl("button", { cls: "reel-btn", text: "Never show this", attr: { type: "button" } });
		never.addEventListener("click", () => {
			void this.plugin.discover.dismiss(item.id).then(() => {
				this.handled.add(item.id);
				this.render(container);
			});
		});

		card.createDiv({
			cls: "reel-dim reel-quickcard-hint",
			text: "Swipe, or use ← and → on a keyboard.",
		});

		this.wireSwipe(card, step);

		// Focusable so the arrow keys have somewhere to land on desktop. Only
		// focused when already in quick mode, so entering the tab does not
		// steal focus from the search box.
		card.setAttr("tabindex", "0");
		card.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (ev.key === "ArrowRight") {
				ev.preventDefault();
				step(1);
			} else if (ev.key === "ArrowLeft") {
				ev.preventDefault();
				step(-1);
			}
		});
		card.focus({ preventScroll: true });
	}

	/** Add from quick mode and advance, so one tap is the whole interaction. */
	private async quickAdd(item: TmdbSearchResult, watchlist: boolean, container: HTMLElement): Promise<void> {
		try {
			await this.plugin.notes.createFromResult(item, { date: todayISO(), watchlist });
			haptic("commit");
			// Quick mode is a swipe-speed interaction, which makes it the single
			// easiest place to add the title you were only scrolling past.
			this.plugin.undo.offer(watchlist ? "Added to your watchlist" : "Added as watched");
			this.handled.add(item.id);
			this.render(container);
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
		}
	}

	/**
	 * Horizontal drag to move through the queue.
	 *
	 * Only acts when the gesture is clearly sideways: the card scrolls
	 * vertically, and a swipe that stole every downward drag would make the
	 * overview unreadable on a phone.
	 */
	private wireSwipe(card: HTMLElement, step: (by: number) => void): void {
		let startX = 0;
		let startY = 0;
		let tracking = false;

		card.addEventListener(
			"touchstart",
			(ev: TouchEvent) => {
				const t = ev.touches[0];
				if (!t) return;
				startX = t.clientX;
				startY = t.clientY;
				tracking = true;
			},
			{ passive: true }
		);

		card.addEventListener(
			"touchend",
			(ev: TouchEvent) => {
				if (!tracking) return;
				tracking = false;
				const t = ev.changedTouches[0];
				if (!t) return;
				const dx = t.clientX - startX;
				const dy = t.clientY - startY;
				// Comfortably horizontal, and far enough to be deliberate.
				if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
				step(dx < 0 ? 1 : -1);
			},
			{ passive: true }
		);
	}

	/* ------------------------------------------------------------------ */
	/* Filter bar                                                          */
	/* ------------------------------------------------------------------ */

	private paintFilters(container: HTMLElement): void {
		const wrap = container.createDiv({ cls: "reel-discover-filters" });

		const row1 = wrap.createDiv({ cls: "reel-chips" });
		const chip = (parent: HTMLElement, label: string, active: boolean, onClick: () => void) => {
			const b = parent.createEl("button", { cls: "reel-chip", text: label });
			setSelected(b, active);
			b.addEventListener("click", () => {
				onClick();
				this.results = null;
				this.page = 1;
				this.exhausted = false;
				this.render(container);
			});
			return b;
		};

		// "For you" is a real choice, not just the absence of filters.
		chip(row1, "For you", !this.filtered, () => {
			this.filters = { ...EMPTY, type: this.filters.type };
		});
		// Both directions must clear the genre: ids are per-endpoint, so a
		// selection carried across would silently query the wrong genre. The
		// previous version only cleared one way.
		const setType = (next: "movie" | "tv") => {
			if (this.filters.type === next) return;
			this.filters.type = next;
			this.rows = null;
			this.genres = [];
			this.filters.genreId = null;
			this.filters.genreName = null;
		};
		chip(row1, "Films", this.filters.type === "movie", () => setType("movie"));
		chip(row1, "Series", this.filters.type === "tv", () => setType("tv"));

		// "Like this one." A seed title, not a genre — it changes what the pool
		// is drawn from rather than narrowing what is already there, which is
		// why it sits apart from the genre chips.
		const seedLabel = this.seed ? `Like ${this.seed.title}` : "Like…";
		const seedChip = chip(row1, seedLabel, !!this.seed, () => {
			if (this.seed) {
				this.seed = null;
				return;
			}
			new SearchModal(this.plugin.app, this.plugin, {
				placeholder: "Find me something like…",
				onPick: (item) => {
					this.seed = {
						id: item.id,
						type: item.media_type === "tv" ? "tv" : "movie",
						title: (item.media_type === "tv" ? item.name : item.title) ?? "that",
					};
					this.results = null;
					this.render(container);
				},
			}).open();
		});
		seedChip.addClass("reel-chip-seed");

		// Browsing mode, not a filter — it changes how the same pool is shown.
		// Rows are for skimming a shelf; this is for getting through a lot of
		// titles quickly without your eye having to re-find the buttons.
		const quick = chip(row1, "Quick", this.quick, () => {
			this.quick = !this.quick;
			this.quickAt = 0;
		});
		quick.addClass("reel-chip-mode");

		row1.createSpan({ cls: "reel-chip-sep", text: "·" });

		// The genre list has to be fetched; until it arrives, show nothing
		// rather than a row that pops in and shifts everything down.
		if (!this.genres.length) {
			void this.plugin.tmdb
				.genreList(this.filters.type)
				.then((list) => {
					this.genres = list;
					this.render(container);
				})
				.catch(() => {
					/* genre filtering is optional; the rows still work */
				});
		}

		for (const g of this.genres) {
			chip(row1, g.name, this.filters.genreId === g.id, () => {
				const on = this.filters.genreId === g.id;
				this.filters.genreId = on ? null : g.id;
				this.filters.genreName = on ? null : g.name;
			});
		}

		const row2 = wrap.createDiv({ cls: "reel-chips" });
		row2.createSpan({ cls: "reel-dim", text: "Decade" });
		const nowDecade = Math.floor(new Date().getFullYear() / 10) * 10;
		for (let d = nowDecade; d >= 1950; d -= 10) {
			chip(row2, `${d}s`, this.filters.decade === d, () => {
				this.filters.decade = this.filters.decade === d ? null : d;
			});
		}

		row2.createSpan({ cls: "reel-chip-sep", text: "·" });
		row2.createSpan({ cls: "reel-dim", text: "At least" });
		for (const r of [6, 7, 8]) {
			chip(row2, `${r}+`, this.filters.minRating === r, () => {
				this.filters.minRating = this.filters.minRating === r ? null : r;
			});
		}

		if (this.filtered) {
			const clear = row2.createEl("button", { cls: "reel-chip", text: "✕ Clear" });
			clear.addEventListener("click", () => {
				this.filters = { ...EMPTY, type: this.filters.type };
				this.results = null;
				this.render(container);
			});
		}
	}

	/* ------------------------------------------------------------------ */
	/* For you                                                             */
	/* ------------------------------------------------------------------ */

	private paintForYou(container: HTMLElement): void {
		if (!this.rows) {
			// Three sections' worth, because that is roughly what comes back —
			// the page ends up close to the height it will be, so nothing jumps
			// when the results land.
			container.createDiv({ cls: "reel-loading", text: "Finding things for you…" });
			for (let i = 0; i < 3; i++) skeletonCards(container, 6, "Finding things for you");
			if (this.loading) return;
			this.loading = true;
			void this.loadRows(container);
			return;
		}

		const head = container.createDiv({ cls: "reel-discover-head" });
		if (this.profile?.sparse) {
			head.createDiv({
				cls: "reel-discover-note",
				text: "Rate a few films and these become personal — right now they're just what's popular.",
			});
		} else if (this.profile?.genreNames.length) {
			// "Based on your ratings" was a lie once the profile could also be
			// built from watchlist picks. Name the shape, not the source.
			head.createDiv({
				cls: "reel-discover-note",
				text: `Based on your library — mostly ${this.profile.genreNames.slice(0, 3).join(", ").toLowerCase()}.`,
			});
		}
		const reload = head.createEl("button", { cls: "reel-chip", text: "Refresh" });
		reload.addEventListener("click", () => {
			reload.setText("Refreshing…");
			void this.plugin.tmdb.clearDiscoverCache().then(() => {
				this.reset();
				this.render(container);
			});
		});

		const visible = this.rows.filter((r) => r.items.some((i) => !this.handled.has(i.id)));
		if (!visible.length) {
			const empty = container.createDiv({ cls: "reel-empty" });
			empty.createDiv({ text: "Nothing left to suggest — try a genre above." });
			// Dismissals are permanent by design, so the way back has to be
			// findable from where you run out of suggestions.
			const dismissed = this.plugin.settings.dismissedIds.length;
			if (dismissed) {
				empty.createDiv({
					cls: "reel-dim",
					text: `${dismissed} dismissed — clear them in Settings → Reel to see them again.`,
				});
			}
			return;
		}
		for (const row of visible) this.paintRow(container, row);
	}

	private async loadRows(container: HTMLElement): Promise<void> {
		try {
			const profile = await this.plugin.discover.taste(this.filters.type);
			this.rows = await this.plugin.discover.rows(profile, this.filters.type);
			this.profile = profile;
		} catch (e) {
			// The diagnosis, not the raw error. A retry button already
			// existed here, but above a redacted stack fragment — so it told
			// you to try again without telling you whether that could help.
			this.error = diagnoseError(e).message;
		} finally {
			this.loading = false;
			this.render(container);
		}
	}

	private paintRow(container: HTMLElement, row: DiscoverRow): void {
		const items = row.items.filter((i) => !this.handled.has(i.id));
		if (!items.length) return;

		const section = container.createDiv({ cls: "reel-drow" });
		const head = section.createDiv({ cls: "reel-drow-head" });
		head.createDiv({ cls: "reel-drow-title", text: row.title });
		if (row.reason) head.createDiv({ cls: "reel-drow-reason", text: row.reason });

		const strip = section.createDiv({ cls: "reel-drow-strip" });
		for (const item of items) strip.appendChild(this.card(item, container));

		if (!Platform.isMobile) {
			const nav = head.createDiv({ cls: "reel-drow-nav" });
			const by = (delta: number) => strip.scrollBy({ left: delta, behavior: "smooth" });
			const left = nav.createEl("button", { cls: "reel-drow-arrow" });
			setIcon(left, "chevron-left");
			left.addEventListener("click", () => by(-600));
			const right = nav.createEl("button", { cls: "reel-drow-arrow" });
			setIcon(right, "chevron-right");
			right.addEventListener("click", () => by(600));
		}
	}

	/* ------------------------------------------------------------------ */
	/* Filtered results                                                    */
	/* ------------------------------------------------------------------ */

	private paintResults(container: HTMLElement): void {
		if (!this.results) {
			container.createDiv({ cls: "reel-loading", text: "Searching…" });
			skeletonGrid(container, 12, "Searching");
			if (this.loading) return;
			this.loading = true;
			const query = this.seed
				? // A seed changes the source: recommendations for that title,
					// then narrowed by whatever else is set. "An action comedy
					// like X" means titles like X that are also action comedies.
					this.plugin.discover.like(
						{ id: this.seed.id, type: this.seed.type },
						{
							genreIds: this.filters.genreId ? [this.filters.genreId] : [],
							decade: this.filters.decade,
							minRating: this.filters.minRating,
						}
					)
				: this.plugin.discover.search({
						type: this.filters.type,
						genreId: this.filters.genreId ?? undefined,
						decade: this.filters.decade ?? undefined,
						minRating: this.filters.minRating ?? undefined,
					});

			void query
				.then((items) => {
					this.results = items;
				})
				.catch((e: unknown) => {
					this.error = diagnoseError(e).message;
				})
				.finally(() => {
					this.loading = false;
					this.render(container);
				});
			return;
		}

		const items = this.results.filter((i) => !this.handled.has(i.id));
		const label = [
			this.filters.minRating ? `${this.filters.minRating}+` : "",
			this.filters.genreName ?? "",
			this.filters.type === "tv" ? "series" : "films",
			this.filters.decade ? `from the ${this.filters.decade}s` : "",
			// Naming the seed matters: otherwise a narrowed set looks identical
			// to an ordinary genre browse and you cannot tell whether the
			// "like X" part was honoured at all.
			this.seed ? `like ${this.seed.title}` : "",
		]
			.filter(Boolean)
			.join(" ");

		container.createDiv({ cls: "reel-block-count", text: `${items.length} ${label}` });


		if (!items.length) {
			// Narrow filters are easy to stack and hard to remember; undoing
			// them by hand means finding which chip is still lit.
			const none = container.createDiv({ cls: "reel-empty" });
			none.createDiv({ text: "Nothing matches those filters." });
			const reset = none.createEl("button", { cls: "reel-btn mod-cta", text: "Clear filters" });
			reset.addEventListener("click", () => {
				this.filters = { ...EMPTY, type: this.filters.type };
				this.render(container);
			});
			return;
		}

		const grid = container.createDiv({ cls: "reel-dgrid" });
		for (const item of items) grid.appendChild(this.card(item, container));

		// One page is twenty titles, which runs out quickly once you've
		// filtered. Pages accumulate rather than replacing, so scrolling back
		// up still shows what you already looked at.
		if (!this.exhausted) {
			const more = container.createDiv({ cls: "reel-dgrid-more" });
			const btn = more.createEl("button", { cls: "reel-btn", text: "Load more" });
			btn.addEventListener("click", () => {
				btn.setText("Loading…");
				btn.disabled = true;
				void this.plugin.discover
					.search(
						{
							type: this.filters.type,
							genreId: this.filters.genreId ?? undefined,
							decade: this.filters.decade ?? undefined,
							minRating: this.filters.minRating ?? undefined,
						},
						this.page + 1
					)
					.then((next) => {
						this.page += 1;
						const fresh = next.filter((n) => !this.results?.some((r) => r.id === n.id));
						if (!fresh.length) this.exhausted = true;
						this.results = [...(this.results ?? []), ...fresh];
					})
					.catch(() => {
						this.exhausted = true;
					})
					.finally(() => this.render(container));
			});
		}
	}

	/* ------------------------------------------------------------------ */
	/* Cards                                                               */
	/* ------------------------------------------------------------------ */

	private card(item: TmdbSearchResult, container: HTMLElement): HTMLElement {
		const isTv = item.media_type === "tv";
		const title = (isTv ? item.name : item.title) ?? "Untitled";
		const year = yearOf(isTv ? item.first_air_date : item.release_date);

		const card = createDiv({ cls: "reel-dcard" });

		const posterEl = card.createDiv({ cls: "reel-dcard-poster" });
		posterEl.setAttr("role", "button");
		posterEl.setAttr("tabindex", "0");
		posterEl.setAttr("aria-label", `${title} — details`);
		// Through PosterStore rather than a hand-rolled <img>: this was the one
		// place that built its own, so Discover cards were the only posters in
		// the app that snapped in with no fade and no tinted block underneath.
		const src = this.plugin.tmdb.posterUrl(item.poster_path, "w342");
		if (src) this.plugin.posters.attach(posterEl, { posterUrl: src, title });
		if (item.vote_average) posterEl.createDiv({ cls: "reel-dcard-score", text: item.vote_average.toFixed(1) });
		if (isTv) posterEl.createDiv({ cls: "reel-dcard-type", text: "TV" });

		const openPreview = () =>
			new PreviewSheet(this.plugin, item, () => {
				this.handled.add(item.id);
				this.render(container);
			}).open();
		posterEl.addEventListener("click", openPreview);
		posterEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter") openPreview();
		});

		card.createDiv({ cls: "reel-dcard-title", text: title });
		if (year) card.createDiv({ cls: "reel-dcard-year", text: String(year) });

		// The three decisions, inline. Opening a sheet to say "no" is the
		// wrong cost for the commonest answer.
		const actions = card.createDiv({ cls: "reel-dcard-actions" });

		const button = (icon: string, label: string, cls: string, fn: () => Promise<void> | void) => {
			const b = actions.createEl("button", { cls: `reel-dcard-btn ${cls}` });
			setIcon(b, icon);
			b.setAttr("aria-label", `${label}: ${title}`);
			b.setAttr("title", label);
			b.addEventListener("click", (e) => {
				e.stopPropagation();
				void Promise.resolve(fn());
			});
			return b;
		};

		button("plus", "Add to watchlist", "add", async () => {
			await this.add(item, true);
			this.plugin.undo.offer(`${title} → watchlist`);
			this.handled.add(item.id);
			this.render(container);
		});

		button("check", "Seen it — rate now", "seen", () => {
			new SeenSheet(this.plugin, item, () => {
				this.handled.add(item.id);
				this.render(container);
			}).open();
		});

		button("x", "Not interested", "skip", async () => {
			await this.plugin.discover.dismiss(item.id);
			this.handled.add(item.id);
			this.render(container);
		});

		return card;
	}

	private async add(item: TmdbSearchResult, watchlist: boolean, rating?: number): Promise<void> {
		await this.plugin.notes.createFromResult(item, { date: todayISO(), watchlist, rating });
	}
}

/* ------------------------------------------------------------------ */

/** Marking something seen usually means you have an opinion about it. */
class SeenSheet extends Modal {
	private busy = false;

	constructor(
		private plugin: ReelPlugin,
		private item: TmdbSearchResult,
		private onDone: () => void
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		const isTv = this.item.media_type === "tv";
		const title = (isTv ? this.item.name : this.item.title) ?? "Untitled";

		contentEl.createEl("h3", { cls: "reel-log-title", text: title });
		contentEl.createDiv({ cls: "reel-log-sub", text: "Adding as watched. Rate it now, or skip." });

		const starRow = contentEl.createDiv({ cls: "reel-rating-row big centred" });
		renderStars(starRow, {
			onChange: (v) => void this.save(v),
		});

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const noRating = actions.createEl("button", { cls: "reel-btn", text: "Add without rating" });
		noRating.addEventListener("click", () => void this.save(undefined));
		const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
		cancel.addEventListener("click", () => this.close());
	}

	private async save(rating: number | undefined): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			await this.plugin.notes.createFromResult(this.item, { date: todayISO(), watchlist: false, rating });
			this.plugin.undo.offer(rating != null ? `Added — rated ${rating}` : "Added as watched");
			this.onDone();
			this.close();
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
			this.busy = false;
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Preview before committing — for when you want the overview first. */
export class PreviewSheet extends Modal {
	private busy = false;

	constructor(
		private plugin: ReelPlugin,
		private item: TmdbSearchResult,
		private onAdded: () => void,
		/**
		 * Who the person you arrived from played in this.
		 *
		 * Carried across the navigation rather than looked up again: the
		 * filmography already knows it, and refetching the credits to answer
		 * a question that was on screen a moment ago would be absurd.
		 */
		private role?: string
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-preview");

		const isTv = this.item.media_type === "tv";
		const title = (isTv ? this.item.name : this.item.title) ?? "Untitled";
		const year = yearOf(isTv ? this.item.first_air_date : this.item.release_date);

		// Above everything, because it is why you tapped through.
		if (this.role) {
			const r = contentEl.createDiv({ cls: "reel-preview-role" });
			r.createSpan({ cls: "reel-preview-role-label", text: "Role" });
			r.createSpan({ cls: "reel-preview-role-value", text: this.role });
		}

		const head = contentEl.createDiv({ cls: "reel-preview-head" });
		const posterEl = head.createDiv({ cls: "reel-preview-poster" });
		const src = this.plugin.tmdb.posterUrl(this.item.poster_path, "w342");
		if (src) posterEl.createEl("img", { attr: { src, alt: "" } });

		const body = head.createDiv({ cls: "reel-preview-body" });
		const h = body.createDiv({ cls: "reel-preview-title" });
		h.createSpan({ text: title });
		if (year) h.createSpan({ cls: "reel-dim", text: ` ${year}` });

		const facts = body.createDiv({ cls: "reel-header-facts" });
		facts.createSpan({ cls: `reel-badge ${isTv ? "tv" : "film"}`, text: isTv ? "Series" : "Film" });
		if (this.item.vote_average) facts.createSpan({ cls: "reel-dim", text: `TMDB ${this.item.vote_average.toFixed(1)}` });

		if (this.item.overview) contentEl.createDiv({ cls: "reel-preview-overview", text: this.item.overview });

		// A trailer is the fastest way to decide, which is this sheet's whole
		// job. Search results carry no videos, so the detail payload loads in
		// the background: the sheet stays usable and the button appears when
		// it arrives. Responses are cached, and a title you go on to add would
		// have needed this fetch regardless.
		void this.loadTrailer(contentEl.createDiv({ cls: "reel-preview-trailer" }), isTv);

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const later = actions.createEl("button", { cls: "reel-btn mod-cta", text: "+ Watchlist" });
		later.addEventListener("click", () => void this.add(true, later));
		const seen = actions.createEl("button", { cls: "reel-btn", text: "Seen it" });
		seen.addEventListener("click", () => {
			// Opens the log sheet so the date is yours to set, rather than
			// silently recording today for a film you saw last year.
			new LogSheet(this.plugin.app, this.plugin, {
				pending: {
					id: this.item.id,
					type: isTv ? "tv" : "film",
					title,
				},
			}).open();
			this.onAdded();
			this.close();
		});
		const nope = actions.createEl("button", { cls: "reel-btn", text: "Not interested" });
		nope.addEventListener("click", () => {
			void this.plugin.discover.dismiss(this.item.id).then(() => {
				this.onAdded();
				this.close();
			});
		});
	}

	/**
	 * Fill the sheet out from the full TMDB record.
	 *
	 * This used to fetch the detail payload and take only the trailer and the
	 * provider list from it, which made "Full details" a promise the screen
	 * did not keep — it showed *less* than the inline role panel it was
	 * reached from. The request was already being made; almost everything
	 * below was in the response and was being discarded.
	 *
	 * Silent on failure. The sheet works without any of it, and an error
	 * notice for a missing trailer would be noise on a screen you are
	 * skimming.
	 */
	private async loadTrailer(slot: HTMLElement, isTv: boolean): Promise<void> {
		try {
			const meta = isTv ? await this.plugin.tmdb.getShow(this.item.id) : await this.plugin.tmdb.getFilm(this.item.id);

			this.paintFacts(slot, meta, isTv);

			const url = trailerUrl(meta.videos?.results);
			if (url) {
				const play = slot.createEl("a", {
					cls: "reel-btn mod-cta reel-trailer-btn",
					text: "▶  Watch trailer",
					href: url,
				});
				play.setAttr("target", "_blank");
				play.setAttr("rel", "noopener");
			}

			// Where you can actually watch it, from the payload already
			// fetched for the trailer — so this costs nothing extra. Doing it
			// per card in the related strip would have meant one request per
			// title; doing it here puts the answer exactly where the decision
			// gets made, for free.
			const providers = providerNames(meta["watch/providers"], this.plugin.settings.region);
			if (providers.length) {
				const box = slot.createDiv({ cls: "reel-preview-providers" });
				box.createSpan({ cls: "reel-dim", text: "Streaming on " });
				box.createSpan({ text: providers.slice(0, 4).join(", ") });
			}

			this.paintLinks(slot, meta, isTv);
		} catch {
			/* neither a trailer nor a provider list is worth interrupting for */
		}
	}

	/**
	 * The facts that make this "details" rather than a preview.
	 *
	 * All of it came back in the request already made for the trailer and was
	 * being discarded — genres, runtime, certification, the cast. The cast
	 * strip matters most: on a screen you reached *from* an actor, the other
	 * people in the thing are the obvious next question.
	 */
	private paintFacts(slot: HTMLElement, meta: TmdbFilm | TmdbShow, isTv: boolean): void {
		const facts: string[] = [];

		const genres = (meta.genres ?? []).map((g) => g.name).filter(Boolean);
		if (genres.length) facts.push(genres.slice(0, 3).join(", "));

		if (isTv) {
			const show = meta as TmdbShow;
			if (show.number_of_episodes) facts.push(`${show.number_of_episodes} episodes`);
			if (show.status) facts.push(show.status);
		} else {
			const runtime = (meta as TmdbFilm).runtime;
			if (runtime) facts.push(formatMinutes(runtime));
		}

		if (facts.length) slot.createDiv({ cls: "reel-preview-facts", text: facts.join(" · ") });

		// Films carry `credits`; a series carries `aggregate_credits`, because
		// an actor can play several parts across a run and TMDB merges them.
		// Reading the wrong one gives an empty cast list and no error.
		const credits = isTv ? (meta as TmdbShow).aggregate_credits : (meta as TmdbFilm).credits;

		// Who made it, which is how most people place a title they half know.
		const made = isTv
			? ((meta as TmdbShow).created_by ?? []).map((c) => c.name)
			: (credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name);
		if (made.length) {
			slot.createDiv({
				cls: "reel-preview-facts",
				text: `${isTv ? "Created by" : "Directed by"} ${made.join(", ")}`,
			});
		}

		const cast = (credits?.cast ?? []).slice(0, 10);
		if (!cast.length) return;
		slot.createDiv({ cls: "reel-block-title", text: "Cast" });
		const strip = slot.createDiv({ cls: "reel-caststrip" });
		for (const p of cast) {
			const cell = strip.createDiv({ cls: "reel-caststrip-cell" });
			const shot = cell.createDiv({ cls: "reel-caststrip-shot" });
			this.plugin.people.attach(shot, p.name, p.id);
			badgePerson(this.plugin, shot, p.id);
			cell.createDiv({ cls: "reel-caststrip-name", text: p.name });
			const role = (p.character ?? p.roles?.[0]?.character ?? "").trim();
			if (role) cell.createDiv({ cls: "reel-caststrip-role", text: role });
			const id = p.id;
			if (!id) continue;
			cell.setAttr("role", "button");
			cell.setAttr("tabindex", "0");
			cell.setAttr("aria-label", `${p.name} — open their filmography`);
			cell.addEventListener("click", () => new PersonSheet(this.plugin, id, p.name).open());
		}
	}

	/**
	 * IMDb, its parents guide, and TMDB.
	 *
	 * The parents guide needs an IMDb id, which a search result does not
	 * carry — it only arrives on the detail payload, which is why this could
	 * not be built before the fetch. Direct links, never a search: "search
	 * IMDb for this title" is a different and much worse thing.
	 */
	private paintLinks(slot: HTMLElement, meta: TmdbFilm | TmdbShow, isTv: boolean): void {
		const row = slot.createDiv({ cls: "reel-preview-links" });
		const link = (text: string, href: string) => {
			const a = row.createEl("a", { cls: "reel-chip", text, href });
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
		};

		const raw = meta.external_ids?.imdb_id ?? (meta as TmdbFilm).imdb_id ?? undefined;
		const imdb = imdbUrl(raw ?? undefined);
		if (imdb) {
			link("IMDb", imdb);
			link("Parents guide", `${imdb}parentalguide`);
		}
		link("TMDB", tmdbUrl(meta.id, isTv ? "tv" : "film"));
	}

	private async add(watchlist: boolean, button: HTMLButtonElement): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		button.setText("Adding…");
		button.setAttr("disabled", "true");

		try {
			await this.plugin.notes.createFromResult(this.item, { date: todayISO(), watchlist });
			this.plugin.undo.offer(watchlist ? "Added to your watchlist" : "Added as watched");
			this.onAdded();
			this.close();
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
			// Leave the sheet open on failure: closing it would lose the title
			// and give no way to try again.
			button.setText("Retry");
			button.removeAttribute("disabled");
			this.busy = false;
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
