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
import type { TmdbSearchResult } from "../types";
import type { DiscoverRow, TasteProfile } from "../discover";
import { redact } from "../secrets";
import { todayISO, yearOf } from "../util/dates";
import { renderStars } from "./stars";

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

	constructor(private plugin: ReelPlugin) {}

	private get filtered(): boolean {
		return this.filters.genreId != null || this.filters.decade != null || this.filters.minRating != null;
	}

	reset(): void {
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

		if (this.filtered) this.paintResults(container);
		else this.paintForYou(container);
	}

	/* ------------------------------------------------------------------ */
	/* Filter bar                                                          */
	/* ------------------------------------------------------------------ */

	private paintFilters(container: HTMLElement): void {
		const wrap = container.createDiv({ cls: "reel-discover-filters" });

		const row1 = wrap.createDiv({ cls: "reel-chips" });
		const chip = (parent: HTMLElement, label: string, active: boolean, onClick: () => void) => {
			const b = parent.createEl("button", { cls: "reel-chip", text: label });
			b.toggleClass("is-active", active);
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
		chip(row1, "Films", this.filters.type === "movie", () => {
			this.filters.type = "movie";
			this.rows = null;
			this.genres = [];
		});
		chip(row1, "Series", this.filters.type === "tv", () => {
			this.filters.type = "tv";
			// Genre ids differ between films and shows, so the list has to be
			// refetched rather than reused.
			this.rows = null;
			this.genres = [];
			this.filters.genreId = null;
			this.filters.genreName = null;
		});

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
			container.createDiv({ cls: "reel-loading", text: "Finding things for you…" });
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
			head.createDiv({
				cls: "reel-discover-note",
				text: `Based on your ratings — mostly ${this.profile.genreNames.slice(0, 3).join(", ").toLowerCase()}.`,
			});
		}
		const reload = head.createEl("button", { cls: "reel-chip", text: "Refresh" });
		reload.addEventListener("click", () => {
			this.reset();
			this.render(container);
		});

		const visible = this.rows.filter((r) => r.items.some((i) => !this.handled.has(i.id)));
		if (!visible.length) {
			container.createDiv({ cls: "reel-empty", text: "Nothing left to suggest — try a genre above." });
			return;
		}
		for (const row of visible) this.paintRow(container, row);
	}

	private async loadRows(container: HTMLElement): Promise<void> {
		try {
			const profile = await this.plugin.discover.taste();
			this.rows = await this.plugin.discover.rows(profile, this.filters.type);
			this.profile = profile;
		} catch (e) {
			this.error = redact(e);
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
			if (this.loading) return;
			this.loading = true;
			void this.plugin.discover
				.search({
					type: this.filters.type,
					genreId: this.filters.genreId ?? undefined,
					decade: this.filters.decade ?? undefined,
					minRating: this.filters.minRating ?? undefined,
				})
				.then((items) => {
					this.results = items;
				})
				.catch((e: unknown) => {
					this.error = redact(e);
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
		]
			.filter(Boolean)
			.join(" ");

		container.createDiv({ cls: "reel-block-count", text: `${items.length} ${label}` });

		if (!items.length) {
			container.createDiv({ cls: "reel-empty", text: "Nothing matches — try a wider filter." });
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
		const src = this.plugin.tmdb.posterUrl(item.poster_path, "w342");
		if (src) posterEl.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
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
			new Notice(`${title} → watchlist`);
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
		const payload = { date: todayISO(), watchlist, rating };
		if (item.media_type === "tv") {
			const meta = await this.plugin.tmdb.getShow(item.id);
			await this.plugin.notes.createShow(meta, payload);
		} else {
			const meta = await this.plugin.tmdb.getFilm(item.id);
			await this.plugin.notes.createFilm(meta, payload);
		}
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
			const payload = { date: todayISO(), watchlist: false, rating };
			if (this.item.media_type === "tv") {
				const meta = await this.plugin.tmdb.getShow(this.item.id);
				await this.plugin.notes.createShow(meta, payload);
			} else {
				const meta = await this.plugin.tmdb.getFilm(this.item.id);
				await this.plugin.notes.createFilm(meta, payload);
			}
			new Notice(rating != null ? `Added — rated ${rating}` : "Added as watched");
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
class PreviewSheet extends Modal {
	private busy = false;

	constructor(
		private plugin: ReelPlugin,
		private item: TmdbSearchResult,
		private onAdded: () => void
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

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const later = actions.createEl("button", { cls: "reel-btn mod-cta", text: "+ Watchlist" });
		later.addEventListener("click", () => void this.add(true, later));
		const seen = actions.createEl("button", { cls: "reel-btn", text: "Seen it" });
		seen.addEventListener("click", () => void this.add(false, seen));
		const nope = actions.createEl("button", { cls: "reel-btn", text: "Not interested" });
		nope.addEventListener("click", () => {
			void this.plugin.discover.dismiss(this.item.id).then(() => {
				this.onAdded();
				this.close();
			});
		});
	}

	private async add(watchlist: boolean, button: HTMLButtonElement): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		button.setText("Adding…");
		button.setAttr("disabled", "true");

		try {
			const payload = { date: todayISO(), watchlist };
			if (this.item.media_type === "tv") {
				const meta = await this.plugin.tmdb.getShow(this.item.id);
				await this.plugin.notes.createShow(meta, payload);
			} else {
				const meta = await this.plugin.tmdb.getFilm(this.item.id);
				await this.plugin.notes.createFilm(meta, payload);
			}
			new Notice(watchlist ? "Added to your watchlist" : "Added as watched");
			this.onAdded();
			this.close();
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
			button.setText("Retry");
			button.removeAttribute("disabled");
			this.busy = false;
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
