/**
 * The Discover screen.
 *
 * Rows of horizontally-scrolling posters, the shape every streaming service
 * converged on for a reason: browsing is lateral. You skim a row, stop at
 * something, and only then want detail. A vertical list makes you scroll past
 * everything you're not interested in.
 *
 * Tapping a poster opens a preview rather than adding it — deciding needs the
 * overview and the score, and an accidental tap should cost nothing.
 */

import { Modal, Notice, Platform, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { TmdbSearchResult } from "../types";
import type { DiscoverRow, TasteProfile } from "../discover";
import { redact } from "../secrets";
import { todayISO, yearOf } from "../util/dates";

export class DiscoverScreen {
	private rows: DiscoverRow[] | null = null;
	private profile: TasteProfile | null = null;
	private loading = false;
	private error: string | null = null;
	/** Added this session, so a card can disappear without a full reload. */
	private added = new Set<number>();

	constructor(private plugin: ReelPlugin) {}

	/** Drop everything so the next paint refetches — used by the reload button. */
	reset(): void {
		this.rows = null;
		this.profile = null;
		this.error = null;
		this.added.clear();
	}

	render(container: HTMLElement): void {
		container.empty();
		container.addClass("reel-discover");

		if (this.error) {
			container.createDiv({ cls: "reel-error", text: this.error });
			const retry = container.createEl("button", { cls: "reel-btn", text: "Try again" });
			retry.addEventListener("click", () => {
				this.reset();
				this.render(container);
			});
			return;
		}

		if (!this.rows) {
			container.createDiv({ cls: "reel-loading", text: "Finding things for you…" });
			if (this.loading) return;
			this.loading = true;
			void this.load(container);
			return;
		}

		this.paintHeader(container);

		if (!this.rows.length) {
			container.createDiv({ cls: "reel-empty", text: "Nothing to suggest right now." });
			return;
		}

		for (const row of this.rows) this.paintRow(container, row);
	}

	private async load(container: HTMLElement): Promise<void> {
		try {
			const profile = await this.plugin.discover.taste();
			const rows = await this.plugin.discover.rows(profile);
			this.profile = profile;
			this.rows = rows;
		} catch (e) {
			this.error = redact(e);
		} finally {
			this.loading = false;
			this.render(container);
		}
	}

	private paintHeader(container: HTMLElement): void {
		const head = container.createDiv({ cls: "reel-discover-head" });

		// Say what the suggestions are based on. A recommendation with no
		// stated reason is indistinguishable from an advert.
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
	}

	private paintRow(container: HTMLElement, row: DiscoverRow): void {
		const items = row.items.filter((i) => !this.added.has(i.id));
		if (!items.length) return;

		const section = container.createDiv({ cls: "reel-drow" });
		const head = section.createDiv({ cls: "reel-drow-head" });
		head.createDiv({ cls: "reel-drow-title", text: row.title });
		if (row.reason) head.createDiv({ cls: "reel-drow-reason", text: row.reason });

		const strip = section.createDiv({ cls: "reel-drow-strip" });
		for (const item of items) strip.appendChild(this.card(item, container));

		// Arrows for desktop, where there's no touch scrolling. Hidden on a
		// phone, where dragging is the obvious thing to do.
		if (!Platform.isMobile) {
			const nav = head.createDiv({ cls: "reel-drow-nav" });
			const scrollBy = (delta: number) => strip.scrollBy({ left: delta, behavior: "smooth" });
			const left = nav.createEl("button", { cls: "reel-drow-arrow" });
			setIcon(left, "chevron-left");
			left.addEventListener("click", () => scrollBy(-600));
			const right = nav.createEl("button", { cls: "reel-drow-arrow" });
			setIcon(right, "chevron-right");
			right.addEventListener("click", () => scrollBy(600));
		}
	}

	private card(item: TmdbSearchResult, container: HTMLElement): HTMLElement {
		const isTv = item.media_type === "tv";
		const title = (isTv ? item.name : item.title) ?? "Untitled";
		const year = yearOf(isTv ? item.first_air_date : item.release_date);

		const card = createDiv({ cls: "reel-dcard" });
		card.setAttr("role", "button");
		card.setAttr("tabindex", "0");
		card.setAttr("aria-label", title);

		const posterEl = card.createDiv({ cls: "reel-dcard-poster" });
		const src = this.plugin.tmdb.posterUrl(item.poster_path, "w342");
		if (src) posterEl.createEl("img", { attr: { src, alt: "", loading: "lazy" } });

		if (item.vote_average) {
			posterEl.createDiv({ cls: "reel-dcard-score", text: item.vote_average.toFixed(1) });
		}
		if (isTv) posterEl.createDiv({ cls: "reel-dcard-type", text: "TV" });

		card.createDiv({ cls: "reel-dcard-title", text: title });
		if (year) card.createDiv({ cls: "reel-dcard-year", text: String(year) });

		const open = () => new PreviewSheet(this.plugin, item, () => {
			this.added.add(item.id);
			this.render(container);
		}).open();

		card.addEventListener("click", open);
		card.addEventListener("keydown", (e) => {
			if (e.key === "Enter") open();
		});

		return card;
	}
}

/**
 * Preview before committing.
 *
 * Deciding needs the overview and the score, so tapping a poster shows those
 * rather than adding it outright — an accidental tap costs nothing.
 */
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
		const close = actions.createEl("button", { cls: "reel-btn", text: "Not for me" });
		close.addEventListener("click", () => this.close());
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
