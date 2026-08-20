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
import type { DiscoverRow, RowSource, TasteProfile } from "../discover";
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
import { gestureIntent } from "../util/gesture";
import { paintExtras, paintLinks as paintLinksShared, paintTrailer as paintTrailerShared, paintCast } from "./titleExtras";

interface Filters {
	genreId: number | null;
	genreName: string | null;
	decade: number | null;
	minRating: number | null;
	type: "movie" | "tv";
}

const EMPTY: Filters = { genreId: null, genreName: null, decade: null, minRating: null, type: "movie" };

/** A mounted shelf: what it holds, how deep it has been read, and whether it is spent. */
interface FeedRow {
	source: RowSource;
	items: TmdbSearchResult[];
	page: number;
	done: boolean;
	loading: boolean;
	/** Consecutive pages that returned nothing new. Two means stop. */
	empties?: number;
}

export class DiscoverScreen {
	/**
	 * The feed as recipes, before any of it has been fetched.
	 *
	 * Null until a taste profile has been read. Long — sixty-odd rows on a
	 * library with ratings in it, and an unbounded popularity tail after that —
	 * because the feed is meant not to end.
	 */
	private sources: RowSource[] | null = null;
	/** Sources that have been mounted, in the order they appear. */
	private feed: FeedRow[] = [];
	/** Index of the next source to mount. */
	private nextSource = 0;
	/** One mount at a time, or a fast scroll fires four of them at once. */
	private mounting = false;
	/** Torn down and rebuilt on every draw, or they accumulate per repaint. */
	private watchers: IntersectionObserver[] = [];
	/** Where new rows are appended, so mounting one does not redraw the page. */
	private feedEl: HTMLElement | null = null;

	/**
	 * The view's search box, pointed outward.
	 *
	 * Discover is the one tab where the library filters mean nothing — it is
	 * about titles you do *not* have. But the search box is the same box, and a
	 * query that silently did nothing here was most of "the search should work
	 * the same no matter what tab you are on".
	 */
	query = "";
	private searchResults: TmdbSearchResult[] | null = null;
	/** What `searchResults` is an answer to, so a new query refetches. */
	private searchedFor = "";
	/** How many results were dropped for already being in your library. */
	private searchOwned = 0;

	/**
	 * The mounted rows, in the shape the rest of the screen already expects.
	 *
	 * Quick mode and the narrowing pass both read the loaded pool, and neither
	 * cares that it now arrives a row at a time.
	 */
	private get rows(): DiscoverRow[] | null {
		if (!this.sources) return null;
		return this.feed.map((f) => ({ id: f.source.id, title: f.source.title, reason: f.source.reason, items: f.items }));
	}

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
	/** Results handed over by the recipe flow, if any. */
	private shortlist: TmdbSearchResult[] | null = null;
	/**
	 * The title the last quick action handled, and where it sat.
	 *
	 * Undo has to put back three things, not one: the vault change, the fact
	 * that the card was marked handled, and your position in the queue.
	 * Reversing only the first leaves a title in your library that the screen
	 * still believes you dealt with.
	 */
	private lastAction: { id: number; at: number } | null = null;
	/**
	 * Every title the feed has already shown, across all rows.
	 *
	 * Trending and your top genre overlap heavily, and the same poster turning
	 * up in four consecutive shelves is what makes an endless feed feel like a
	 * short one on a loop.
	 */
	private seen = new Set<number>();
	/**
	 * Cards taken out of the feed by an action, newest last.
	 *
	 * `handled` is a set and says nothing about order, so it cannot answer "which
	 * one did I just do". Undo has to put back the last one specifically, and
	 * pressing undo twice has to put back two.
	 */
	private handledOrder: number[] = [];
	/** The container of the most recent render, so an undo can repaint it. */
	private lastContainer: HTMLElement | null = null;

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
		this.sources = null;
		this.feed = [];
		this.nextSource = 0;
		this.mounting = false;
		this.searchResults = null;
		this.searchedFor = "";
		this.profile = null;
		this.results = null;
		this.error = null;
		this.handled.clear();
		this.page = 1;
		this.exhausted = false;
	}

	/**
	 * Draw the screen, and never leave it blank.
	 *
	 * `render` empties the container before it draws. If anything after that
	 * throws — and several paths reach here from a `.finally()`, where a throw
	 * becomes an unhandled rejection nothing catches — the user is left
	 * looking at an empty pane with no explanation. That is the white screen.
	 *
	 * The view's own `paintTab` has a try/catch, but it only guards the
	 * *synchronous* first paint. Every repaint that follows a fetch arrives
	 * outside it.
	 */
	render(container: HTMLElement): void {
		this.lastContainer = container;
		try {
			this.draw(container);
		} catch (e) {
			container.empty();
			const box = container.createDiv({ cls: "reel-error-state" });
			box.createDiv({ cls: "reel-empty-title", text: "Discover hit a problem" });
			// The message, not a blank screen. Redacted, because an error can
			// carry the request URL and the URL can carry the API key.
			box.createDiv({ cls: "reel-empty-body", text: redact(e) });
			const again = box.createEl("button", { cls: "reel-btn mod-cta", text: "Start again" });
			again.addEventListener("click", () => {
				this.reset();
				this.quick = false;
				this.shortlist = null;
				this.render(container);
			});
			console.error("Reel: Discover render failed", e);
		}
	}

	private draw(container: HTMLElement): void {
		container.empty();
		container.addClass("reel-discover");
		// The old ones point at elements that no longer exist, and an observer
		// nobody disconnects keeps its callback — and this screen — alive.
		for (const w of this.watchers) w.disconnect();
		this.watchers = [];
		this.feedEl = null;

		// Consumed rather than read: a shortlist is for the run you just
		// asked for, and finding it still there on a later visit would be a
		// stale answer to a question you have moved on from.
		const staged = this.plugin.discover.takeStaged();
		if (staged) {
			this.shortlist = staged;
			this.quick = true;
			this.quickAt = 0;
		}

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

		if (this.query) this.paintSearch(container);
		else if (this.quick) this.paintQuick(container);
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
		// A shortlist handed over by the recipe flow wins over everything
		// else: you asked for exactly these, so browsing anything else would
		// be ignoring the question you just answered.
		if (this.shortlist?.length) return this.shortlist.filter((i) => !this.handled.has(i.id));
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
		if (!this.filtered && !this.sources) {
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
		/*
		 * The card takes its colour from the poster it is showing.
		 *
		 * `swatches.tint` has existed since the detail screen was built and had
		 * exactly one call site, so every other screen rendered in theme grey
		 * regardless of what was on it. Quick mode is the best possible place
		 * for the second: one card at a time, one poster to read, and it is the
		 * screen where a title has to make an impression in about a second.
		 *
		 * Fire-and-forget — the card draws in the theme's own colours and the
		 * tint arrives a frame later.
		 */
		this.plugin.swatches.tint(
			card,
			this.plugin.tmdb.posterUrl(item.poster_path, "w342"),
			document.body.hasClass("theme-dark")
		);

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

		/*
		 * The trailer, the cast and the links — where the decision is made.
		 *
		 * Quick mode is the screen you say yes or no on, and it had the least to
		 * go on: a poster, a line of text and three buttons. Everything needed to
		 * actually judge a title lived behind a sheet you reach *after* deciding
		 * to look closer, which is the wrong way round.
		 *
		 * Loaded per card and in the background, from a cached request a title
		 * you add would have needed anyway. The buttons below are drawn first and
		 * work immediately, so this never stands between you and an answer.
		 */
		void paintExtras(this.plugin, card.createDiv({ cls: "reel-quickcard-extras" }), item.id, isTv);

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
			this.markHandled(item.id);
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

		// A gesture nobody is told about may as well not exist, and the hint
		// changes to name the undo only once there is something to undo —
		// otherwise it advertises an action that would do nothing.
		const hint = card.createDiv({ cls: "reel-dim reel-quickcard-hint" });
		hint.setText(
			this.lastAction
				? "Swipe to move, swipe down to take back the last one. Arrow keys and Z work too."
				: "Swipe, or use ← and → on a keyboard."
		);

		if (this.lastAction) {
			const back = card.createEl("button", {
				cls: "reel-chip reel-quick-undo",
				text: "Undo that",
				attr: { type: "button" },
			});
			back.addEventListener("click", () => void this.undoLast(container));
		}

		// The container, not the card: undo re-renders the whole screen, and
		// handing it the card would rebuild the screen inside the card.
		this.wireSwipe(card, step, () => void this.undoLast(container));

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
			} else if (ev.key === "z" || ev.key === "Z") {
				// Not Ctrl+Z: that belongs to Obsidian's own editor undo, and
				// stealing it inside a plugin view would be a nasty surprise
				// the one time you meant the other thing.
				ev.preventDefault();
				void this.undoLast(container);
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
			this.markHandled(item.id);
			this.lastAction = { id: item.id, at: this.quickAt };
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
	/**
	 * Swipe left and right to move, down to take back what you just did.
	 *
	 * Left and right always worked. What did not was recovering from a
	 * mistake: quick mode is built to be fast, so it is the single easiest
	 * place to add a title you were only skimming past — and going *back* only
	 * showed you a card for something already in your library. The action was
	 * gone and the screen said nothing about it.
	 *
	 * Down rather than up: up is where the browser and Obsidian both put
	 * their own gestures, and a third meaning on that axis is a collision
	 * waiting to happen.
	 */
	private wireSwipe(card: HTMLElement, step: (by: number) => void, onUndo: () => void): void {
		let startX = 0;
		let startY = 0;
		let tracking = false;
		/** Was the content already at the top when the finger went down? */
		let atTop = false;

		/** The nearest ancestor that actually scrolls this card's content. */
		const scroller = (): HTMLElement | null => {
			for (let p: HTMLElement | null = card; p; p = p.parentElement) {
				if (p.scrollHeight > p.clientHeight + 1) return p;
			}
			return null;
		};

		card.addEventListener(
			"touchstart",
			(ev: TouchEvent) => {
				const t = ev.touches[0];
				if (!t) return;
				startX = t.clientX;
				startY = t.clientY;
				tracking = true;
				// Dragging down *is* scrolling up. Unless the content is already
				// at the top there is nothing to pull against, and treating the
				// drag as a gesture steals an ordinary scroll.
				const s = scroller();
				atTop = !s || s.scrollTop <= 0;
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

				// The decision lives in `gestureIntent`, which is pure and
				// tested. It got this wrong once in a way that only showed up on
				// a device — every upward scroll fired undo — and a rule that
				// subtle should not be re-derived inline each time it is touched.
				switch (gestureIntent({ dx, dy, atTop, canUndo: this.lastAction != null })) {
					case "undo":
						onUndo();
						return;
					case "next":
						step(1);
						return;
					case "previous":
						step(-1);
						return;
					default:
						return;
				}
			},
			{ passive: true }
		);
	}

	/**
	 * Take back the last thing quick mode did.
	 *
	 * Delegates the vault change to the undo service — it already knows how
	 * to reverse an add, including trashing a note it created — and handles
	 * the two things only this screen knows about: that the card was marked
	 * handled, and where you were when you did it.
	 */
	/** Take a card out of the feed, remembering that it was this one. */
	markHandled(id: number): void {
		this.handled.add(id);
		this.handledOrder = [...this.handledOrder.filter((n) => n !== id), id];
	}

	/**
	 * Put back whatever the last action removed.
	 *
	 * Called after an undo lands. Rating a title from the feed used to reverse
	 * the vault write and leave the card gone — the note came back and the poster
	 * did not, so the undo looked like it had half worked. The screen's own state
	 * is not something a vault write can reach, so it has to be told.
	 */
	restoreLast(): void {
		const id = this.handledOrder.pop();
		if (id == null) return;
		this.handled.delete(id);
		// Out of `seen` too, or the next fetch that offers it would filter it
		// straight back out as a duplicate and it would never reappear.
		this.seen.delete(id);
		if (this.lastContainer?.isConnected) this.render(this.lastContainer);
	}

	private async undoLast(container: HTMLElement): Promise<void> {
		const last = this.lastAction;
		if (!last) {
			new Notice("Reel: nothing to take back.");
			return;
		}
		haptic("commit");
		this.lastAction = null;
		await this.plugin.undo.undo();
		// `undo()` notifies `restoreLast`, which has already put this one back —
		// but the swipe path also has a queue position to restore, so it finishes
		// the job rather than duplicating it.
		this.handled.delete(last.id);
		this.handledOrder = this.handledOrder.filter((n) => n !== last.id);
		this.seen.delete(last.id);
		// Back to the card you were on, so the screen shows the thing you
		// just recovered rather than leaving you further down the queue
		// wondering whether it worked.
		this.quickAt = last.at;
		this.render(container);
	}

	/* ------------------------------------------------------------------ */
	/* Filter bar                                                          */
	/* ------------------------------------------------------------------ */

	private paintFilters(container: HTMLElement): void {
		const wrap = container.createDiv({ cls: "reel-discover-filters" });

		// The guided flow, and the moods you have already built. Above the
		// filter chips because it is a better first move than any of them:
		// starting from three films you loved beats starting from a genre.
		const launch = wrap.createDiv({ cls: "reel-recipe-launch" });
		const find = launch.createEl("button", { cls: "reel-btn mod-cta", attr: { type: "button" } });
		setIcon(find.createSpan(), "wand-2");
		find.createSpan({ text: "Find something to watch" });
		find.addEventListener("click", () => this.plugin.openRecipe());

		for (const saved of this.plugin.settings.recipes.slice(0, 4)) {
			const b = launch.createEl("button", { cls: "reel-chip", text: saved.name ?? "Recipe", attr: { type: "button" } });
			b.addEventListener("click", () => this.plugin.openRecipe(saved));
			// Right-click or long-press to forget it. A delete button on every
			// chip would double the width of a row meant to be scanned.
			b.addEventListener("contextmenu", async (ev) => {
				ev.preventDefault();
				this.plugin.settings.recipes = this.plugin.settings.recipes.filter((r) => r !== saved);
				await this.plugin.saveSettings();
				this.render(container);
			});
		}

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
			// A different medium is a different feed, not a filtered one.
			this.sources = null;
			this.feed = [];
			this.nextSource = 0;
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

	/**
	 * Does a title already in hand satisfy the current filters?
	 *
	 * Used to narrow the shelves without a round trip. The server answers the
	 * same question better — it can see every title, not the sixty already
	 * loaded — but it cannot answer it *instantly*, and instant is what stops
	 * the screen changing shape under you.
	 */
	private matchesFilters(item: TmdbSearchResult): boolean {
		const f = this.filters;
		if (f.minRating != null && (item.vote_average ?? 0) < f.minRating) return false;
		if (f.genreId != null && !(item.genre_ids ?? []).includes(f.genreId)) return false;
		if (f.decade != null) {
			const year = Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4));
			if (!Number.isFinite(year) || year < f.decade || year >= f.decade + 10) return false;
		}
		return true;
	}

	/**
	 * The bit of the screen that must not move when a filter changes.
	 *
	 * Shared by the personalised view and the filtered one. Picking a minimum
	 * rating used to replace shelves with a flat grid — same data, entirely
	 * different screen — so the app appeared to navigate somewhere when the
	 * user had only narrowed what they were already looking at. A filter should
	 * change what is in the list, never what kind of list it is.
	 */
	private paintHead(container: HTMLElement): void {
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
		const reload = head.createEl("button", { cls: "reel-chip reel-refresh", attr: { type: "button" } });
		setIcon(reload.createSpan({ cls: "reel-refresh-icon" }), "refresh-cw");
		reload.createSpan({ text: "Refresh" });
		reload.addEventListener("click", () => {
			reload.addClass("is-spinning");
			/*
			 * Refresh used to clear the cache and re-request the same pages, which
			 * is asking TMDB the identical question and hoping for a different
			 * answer — the trending list does not change between two taps. Rolling
			 * the feed forward asks a different question, so it comes back with
			 * different titles.
			 */
			this.plugin.discover.reroll();
			void this.plugin.tmdb.clearDiscoverCache().then(() => {
				this.reset();
				this.render(container);
			});
		});
	}

	/**
	 * The shelves you were already looking at, narrowed.
	 *
	 * Drawn before the fetched results and from titles already in memory, so
	 * the moment a chip is tapped the screen answers with the same shelves
	 * holding fewer things. The fetch then adds what it finds underneath.
	 */
	private paintNarrowedRows(container: HTMLElement): boolean {
		if (!this.rows) return false;
		const narrowed = this.rows
			.map((r) => ({ ...r, items: r.items.filter((i) => !this.handled.has(i.id) && this.matchesFilters(i)) }))
			.filter((r) => r.items.length);
		for (const row of narrowed) this.paintStaticRow(container, row);
		return narrowed.length > 0;
	}

	/**
	 * A shelf that does not page.
	 *
	 * These are rows you have already loaded, shown with some of their cards
	 * filtered out. Asking such a row for another page would fetch titles the
	 * filter is about to discard, so it stays as it is and the fetched results
	 * underneath do the widening.
	 */
	private paintStaticRow(container: HTMLElement, row: DiscoverRow): void {
		const items = row.items.filter((i) => !this.handled.has(i.id));
		if (!items.length) return;

		const section = container.createDiv({ cls: "reel-drow" });
		const head = section.createDiv({ cls: "reel-drow-head" });
		head.createDiv({ cls: "reel-drow-title", text: row.title });
		if (row.reason) head.createDiv({ cls: "reel-drow-reason", text: row.reason });

		const strip = section.createDiv({ cls: "reel-drow-strip" });
		for (const item of items) strip.appendChild(this.card(item, container));
	}

	/**
	 * The feed.
	 *
	 * It used to be eight rows, fetched all at once, each holding one page of
	 * about twenty cards. Every row ended, the page ended, and tomorrow it said
	 * the same thing — which is exactly what "a hardcoded block I cannot refresh"
	 * describes.
	 *
	 * Now both axes keep going. Reaching the end of a row asks that row for its
	 * next page; reaching the bottom of the page mounts the next row. The list of
	 * rows is long and its tail is unbounded, so there is no last one to reach.
	 */
	private paintForYou(container: HTMLElement): void {
		if (!this.sources) {
			// Three sections' worth, because that is roughly what comes back — the
			// page ends up close to the height it will be, so nothing jumps when
			// the results land.
			container.createDiv({ cls: "reel-loading", text: "Finding things for you…" });
			for (let i = 0; i < 3; i++) skeletonCards(container, 6, "Finding things for you");
			if (this.loading) return;
			this.loading = true;
			void this.loadRows(container);
			return;
		}

		this.paintHead(container);

		const feedEl = container.createDiv({ cls: "reel-feed" });
		this.feedEl = feedEl;
		for (const row of this.feed) this.mountRow(feedEl, row, container);

		const live = this.feed.some((r) => r.items.some((i) => !this.handled.has(i.id)));
		if (!live && this.exhausted) {
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

		this.paintFeedSentinel(container);
	}

	/**
	 * The thing at the bottom that asks for more.
	 *
	 * A sentinel plus an observer rather than a scroll handler: the body is a
	 * measured, fixed-height element and its scroll events fire at whatever rate
	 * the device feels like, whereas an intersection is asked once and answered
	 * once. The rootMargin means the fetch starts a screen early, so the next row
	 * is usually there before you arrive at the gap.
	 */
	private paintFeedSentinel(container: HTMLElement): void {
		const more = this.sources ? this.nextSource < this.sources.length : false;
		if (!more) return;

		const sentinel = container.createDiv({ cls: "reel-feed-end" });
		sentinel.createDiv({ cls: "reel-loading", text: "Loading more…" });

		const scroller = container.closest(".reel-view-body") ?? null;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				void this.mountNext(container);
			},
			{ root: scroller as Element | null, rootMargin: "600px 0px" }
		);
		io.observe(sentinel);
		this.watchers.push(io);
	}

	/**
	 * Mount the next row, skipping ones that come back empty.
	 *
	 * A source can legitimately return nothing — every title in it is already in
	 * your library, or dismissed, or has no poster. Stopping there would end the
	 * feed on a technicality, so it tries the next one, up to a handful of times
	 * per scroll so a run of empties cannot become an unbounded request loop.
	 */
	private async mountNext(container: HTMLElement): Promise<void> {
		if (this.mounting || !this.sources) return;
		this.mounting = true;
		try {
			for (let tries = 0; tries < 6 && this.nextSource < this.sources.length; tries++) {
				const source = this.sources[this.nextSource++];
				const items = (await source.fetch(1)).filter((i) => !this.seen.has(i.id));
				for (const i of items) this.seen.add(i.id);
				if (!items.length) continue;
				const row: FeedRow = { source, items, page: 1, done: false, loading: false };
				this.feed.push(row);
				if (this.feedEl && this.feedEl.isConnected) {
					// Appended rather than repainted: a repaint would throw away the
					// scroll position of every strip above, which on a feed is the
					// difference between "more arrived" and "it jumped".
					this.mountRow(this.feedEl, row, container);
					return;
				}
				this.render(container);
				return;
			}
			// Nothing left to try.
			if (this.nextSource >= (this.sources?.length ?? 0)) {
				this.exhausted = true;
				this.render(container);
			}
		} catch {
			/* one row failing is not worth taking the feed down for */
		} finally {
			this.mounting = false;
		}
	}

	private async loadRows(container: HTMLElement): Promise<void> {
		try {
			const profile = await this.plugin.discover.taste(this.filters.type);
			this.profile = profile;
			this.sources = this.plugin.discover.rowSources(profile, this.filters.type);
			this.feed = [];
			this.nextSource = 0;
			this.seen.clear();
			this.exhausted = false;
			// Enough to fill a screen, so the feed does not arrive one row at a
			// time in front of the user.
			this.mounting = false;
			for (let i = 0; i < 4; i++) {
				const before = this.feed.length;
				await this.mountNextSilently();
				if (this.feed.length === before) break;
			}
		} catch (e) {
			// The diagnosis, not the raw error. A retry button already existed
			// here, but above a redacted stack fragment — so it told you to try
			// again without telling you whether that could help.
			this.error = diagnoseError(e).message;
		} finally {
			this.loading = false;
			this.render(container);
		}
	}

	/** The same step as `mountNext`, without touching the DOM. */
	private async mountNextSilently(): Promise<void> {
		if (!this.sources) return;
		for (let tries = 0; tries < 6 && this.nextSource < this.sources.length; tries++) {
			const source = this.sources[this.nextSource++];
			const items = (await source.fetch(1)).filter((i) => !this.seen.has(i.id));
			for (const i of items) this.seen.add(i.id);
			if (!items.length) continue;
			this.feed.push({ source, items, page: 1, done: false, loading: false });
			return;
		}
	}

	/**
	 * One shelf, which pages as you scroll it.
	 *
	 * The horizontal sentinel sits at the right-hand end of the strip and is
	 * observed against the strip itself, so it fires when you scroll the row
	 * rather than when the row happens to be on screen. Cards are appended in
	 * place: rebuilding the strip would send it back to the left, which on a row
	 * you are actively scrolling is the most annoying thing a feed can do.
	 */
	private mountRow(into: HTMLElement, row: FeedRow, container: HTMLElement): void {
		const items = row.items.filter((i) => !this.handled.has(i.id));
		if (!items.length) return;

		const section = into.createDiv({ cls: "reel-drow" });
		const head = section.createDiv({ cls: "reel-drow-head" });
		head.createDiv({ cls: "reel-drow-title", text: row.source.title });
		if (row.source.reason) head.createDiv({ cls: "reel-drow-reason", text: row.source.reason });

		const strip = section.createDiv({ cls: "reel-drow-strip" });
		for (const item of items) strip.appendChild(this.card(item, container));

		if (!row.done) {
			const tail = strip.createDiv({ cls: "reel-drow-tail" });
			const io = new IntersectionObserver(
				(entries) => {
					if (!entries.some((e) => e.isIntersecting)) return;
					void this.extendRow(row, strip, tail, container);
				},
				{ root: strip, rootMargin: "0px 600px" }
			);
			io.observe(tail);
			this.watchers.push(io);
		}

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

	/** Another page for one shelf, appended where you are already looking. */
	private async extendRow(row: FeedRow, strip: HTMLElement, tail: HTMLElement, container: HTMLElement): Promise<void> {
		if (row.loading || row.done) return;
		row.loading = true;
		try {
			const next = await row.source.fetch(row.page + 1);
			row.page += 1;
			const fresh = next.filter((i) => !this.seen.has(i.id) && !this.handled.has(i.id));
			for (const i of fresh) this.seen.add(i.id);
			if (!fresh.length) {
				/*
				 * One empty page is not the end of a row.
				 *
				 * Everything on it may already be in your library, which says nothing
				 * about page four. Two in a row is a fair signal that the endpoint has
				 * run out, and stopping there keeps a dead row from requesting
				 * forever.
				 */
				row.empties = (row.empties ?? 0) + 1;
				if (row.empties >= 2 || row.page > 20) {
					row.done = true;
					tail.remove();
				}
				return;
			}
			row.empties = 0;
			row.items = [...row.items, ...fresh];
			for (const item of fresh) strip.insertBefore(this.card(item, container), tail);
		} catch {
			row.done = true;
			tail.remove();
		} finally {
			row.loading = false;
		}
	}

	/* ------------------------------------------------------------------ */
	/* Search — the view's own box, pointed at TMDB                        */
	/* ------------------------------------------------------------------ */

	/**
	 * What a search means on a screen about titles you do not own.
	 *
	 * Anything already in your library is dropped, because the card's actions are
	 * "add" and "watchlist" and offering those for a note you already have is how
	 * you end up with two of them. The count is stated rather than swallowed, with
	 * a way through to the library search, so a title you know you own not
	 * appearing here is explained rather than mysterious.
	 */
	private paintSearch(container: HTMLElement): void {
		const q = this.query.trim();
		if (this.searchedFor !== q) {
			this.searchResults = null;
			this.searchedFor = q;
		}

		if (!this.searchResults) {
			skeletonGrid(container, 12, "Searching");
			if (this.loading) return;
			this.loading = true;
			void this.plugin.tmdb
				.searchMulti(q)
				.then((items) => {
					const usable = items.filter((i) => !i.adult && i.poster_path);
					const fresh = this.plugin.discover.filterOut(usable);
					this.searchOwned = usable.length - fresh.length;
					this.searchResults = fresh;
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

		const items = this.searchResults.filter((i) => !this.handled.has(i.id));
		const count = container.createDiv({ cls: "reel-block-count" });
		count.setText(`${items.length} on TMDB for “${q}”`);
		if (this.searchOwned) {
			count.createSpan({ cls: "reel-dim", text: ` · ${this.searchOwned} already in your library` });
		}

		if (!items.length) {
			const none = container.createDiv({ cls: "reel-empty" });
			none.createDiv({
				text: this.searchOwned
					? "Everything matching is already in your library."
					: "Nothing on TMDB matches that.",
			});
			return;
		}

		const grid = container.createDiv({ cls: "reel-dgrid" });
		for (const item of items) grid.appendChild(this.card(item, container));
	}

	/* ------------------------------------------------------------------ */
	/* Filtered results                                                    */
	/* ------------------------------------------------------------------ */

	private paintResults(container: HTMLElement): void {
		/*
		 * The same screen, narrowed — not a different screen.
		 *
		 * Tapping a minimum rating used to replace the personalised shelves with
		 * a flat grid: same subject, entirely different layout, so the app
		 * appeared to navigate somewhere when the user had only narrowed what
		 * they were already looking at.
		 *
		 * The head and the shelves are drawn first, from titles already in
		 * memory, so the answer is instant and the page keeps its shape. The
		 * fetch then adds whatever it finds underneath — which is the part only
		 * the server can do, since it can see every title rather than the sixty
		 * already loaded.
		 */
		this.paintHead(container);
		const hadRows = this.paintNarrowedRows(container);

		if (!this.results) {
			container.createDiv({ cls: "reel-loading", text: hadRows ? "Looking for more…" : "Searching…" });
			skeletonGrid(container, hadRows ? 6 : 12, "Searching");
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

		// Titled, because it is no longer the only thing on the screen.
		if (hadRows) container.createDiv({ cls: "reel-drow-title", text: "More matches" });
		container.createDiv({ cls: "reel-block-count", text: `${items.length} ${label}` });


		if (!items.length) {
			// Narrow filters are easy to stack and hard to remember; undoing
			// them by hand means finding which chip is still lit.
			const none = container.createDiv({ cls: "reel-empty" });
			none.createDiv({
				text: hadRows
					? "Nothing more beyond what's above."
					: "Nothing matches those filters.",
			});
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
				this.markHandled(item.id);
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
			this.markHandled(item.id);
			this.render(container);
		});

		button("check", "Seen it — rate now", "seen", () => {
			new SeenSheet(this.plugin, item, () => {
				this.markHandled(item.id);
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

/**
 * A word per star, so a number you set by thumb is confirmed in language.
 *
 * Deliberately mild at the bottom: "Bad" for a one-star is a stronger statement
 * than most one-star ratings mean, and a scale that editorialises makes people
 * rate more conservatively than they would.
 */
const RATING_WORDS = ["Not for me", "Weak", "Fine", "Great", "Favourite"];

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

		modalEl.addClass("reel-seensheet");

		const isTv = this.item.media_type === "tv";
		const title = (isTv ? this.item.name : this.item.title) ?? "Untitled";
		const year = yearOf(this.item.release_date ?? this.item.first_air_date);

		/*
		 * The poster, because this sheet is about *this* film.
		 *
		 * It showed a title, a sentence and five grey stars — the same screen for
		 * every title in the library, distinguished only by a line of text. This is
		 * the surface you touch most often in the app, and it was the one place
		 * Reel had artwork available and drew none of it.
		 */
		const head = contentEl.createDiv({ cls: "reel-seen-head" });
		const src = this.item.poster_path ? this.plugin.tmdb.posterUrl(this.item.poster_path, "w342") : null;
		if (src) {
			const art = head.createDiv({ cls: "reel-seen-poster" });
			art.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
			// The same tint every other screen takes off a poster, so the sheet
			// belongs to the title rather than being a grey box with its name in it.
			this.plugin.swatches.tint(modalEl, src, document.body.hasClass("theme-dark"));
		}

		const who = head.createDiv({ cls: "reel-seen-who" });
		who.createDiv({ cls: "reel-seen-title", text: title });
		const meta = who.createDiv({ cls: "reel-seen-meta" });
		if (year) meta.createSpan({ text: String(year) });
		meta.createSpan({ cls: "reel-badge subtle", text: isTv ? "Series" : "Film" });
		if (this.item.vote_average) meta.createSpan({ cls: "reel-dim", text: `★ ${this.item.vote_average.toFixed(1)}` });
		who.createDiv({ cls: "reel-seen-note", text: "Adding as watched." });

		/*
		 * The stars, and a word for what you just chose.
		 *
		 * Five stars with no readout means the difference between three and three
		 * and a half is a few pixels of a glyph you are already tapping over with
		 * your thumb. Naming it confirms the value landed — which matters here more
		 * than anywhere, because the tap that sets it also closes the sheet.
		 */
		const starRow = contentEl.createDiv({ cls: "reel-rating-row big centred" });
		const readout = contentEl.createDiv({ cls: "reel-seen-readout", text: "Tap a star to rate it" });
		renderStars(starRow, {
			onChange: (v) => {
				if (v == null) return;
				readout.setText(`${v} — ${RATING_WORDS[Math.ceil(v) - 1] ?? ""}`);
				readout.addClass("is-set");
				void this.save(v);
			},
		});

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const noRating = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Add without rating" });
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
	/** The sticky foot, kept so it can be put back at the end. */
	private actionsEl: HTMLElement | null = null;

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

		const actions = contentEl.createDiv({ cls: "reel-log-actions reel-preview-actions" });
		this.actionsEl = actions;
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


			const url = trailerUrl(meta.videos?.results);
			if (url) this.paintTrailer(slot, url);

			this.paintFacts(slot, meta, isTv);

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
		} finally {
			/*
			 * The sticky foot goes back to being the last thing in the sheet.
			 *
			 * It is `position: sticky`, which pins it to the bottom of the
			 * scroller only for as long as there is content *above* it. Anything
			 * appended afterwards lands underneath — so the links row ended up
			 * below the buttons, at the very bottom edge of the screen, half
			 * cut off, while the cast strip above scrolled under the bar and
			 * had its names sliced through the middle.
			 *
			 * This fill is asynchronous and adds several blocks, and which of
			 * them land where depends on which slot each one was handed. Rather
			 * than depend on that ordering holding, the foot re-anchors itself
			 * once the fill is done. A sticky bottom bar that is not the last
			 * child is a bug however it got that way.
			 */
			const actions = this.actionsEl;
			if (actions?.parentElement) actions.parentElement.appendChild(actions);
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
		// The track is where the flex row lives — appending cells straight into
		// `.reel-caststrip` gave one cell per line and a screen of blank space
		// beside them.
		const strip = slot.createDiv({ cls: "reel-caststrip" }).createDiv({ cls: "reel-caststrip-track" });
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
		paintLinksShared(slot, meta, isTv);
	}

	/**
	 * The trailer, playable in place.
	 *
	 * Click-to-load rather than an iframe on arrival: an embed that mounts
	 * itself costs a YouTube request and a set of cookies for every card you
	 * so much as glance at, and most of them you close again. The poster frame
	 * is free, and one tap is a fair price for the thing you asked for.
	 */
	private paintTrailer(slot: HTMLElement, url: string): void {
		paintTrailerShared(slot, url);
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
