/**
 * Rate and Discover — one title at a time.
 *
 * Two jobs share one screen because the interaction is identical: a card, a
 * decision, the next card. Rate works through what you already own; Discover
 * works through what you don't, so the library stops being a closed box you
 * can only look backwards into.
 *
 * Rating advances automatically. That's the whole trick — the queue moves
 * without a second tap, so it stays one thumb and one decision.
 */

import { Notice, Platform, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { redact } from "../secrets";
import { renderStars } from "./stars";
import { formatMinutes, todayISO } from "../util/dates";
import { unlink } from "../library";

export type RateQueue = "unrated" | "watchlist" | "all";

interface QueueDef {
	id: RateQueue;
	label: string;
	empty: string;
}

/**
 * Rate works through titles you already own.
 *
 * The trending and popular queues that used to live here moved to the Discover
 * tab, which does the same job properly — with rows, filters and taste-based
 * recommendations. Two places offering the same thing differently is worse
 * than one place doing it well.
 */
const QUEUES: QueueDef[] = [
	{ id: "unrated", label: "Unrated", empty: "Everything you've watched is rated." },
	{ id: "watchlist", label: "Watchlist", empty: "Nothing on the watchlist." },
	{ id: "all", label: "Everything", empty: "Nothing in the library yet." },
];

export class RateScreen {
	private queue: RateQueue = "unrated";
	private index = 0;
	private skipped = new Set<string>();
	/**
	 * Acted on this session. The queue is rebuilt from the library index on
	 * every repaint, but metadataCache hasn't reparsed by then — so a film you
	 * just rated still looks unrated and you'd be handed the same card again.
	 */
	private handled = new Set<string>();

	constructor(private plugin: ReelPlugin) {}

	private get def(): QueueDef {
		return QUEUES.find((q) => q.id === this.queue) ?? QUEUES[0];
	}

	private pool(): Entry[] {
		const all = this.plugin.visible(this.plugin.library.all());
		const base =
			this.queue === "unrated"
				? all.filter((e) => e.rating == null && (e.watched.length > 0 || e.status === "watched" || e.status === "completed"))
				: this.queue === "watchlist"
					? all.filter((e) => e.status === "watchlist")
					: all;
		return base.filter((e) => !this.skipped.has(e.path) && !this.handled.has(e.path));
	}

	render(container: HTMLElement): void {
		container.empty();
		container.addClass("reel-rate");

		const bar = container.createDiv({ cls: "reel-chips" });
		for (const q of QUEUES) {
			const chip = bar.createEl("button", { cls: "reel-chip", text: q.label });
			chip.toggleClass("is-active", this.queue === q.id);
			chip.addEventListener("click", () => {
				this.queue = q.id;
				this.index = 0;
				this.handled.clear();
				this.skipped.clear();
				this.render(container);
			});
		}

		this.renderLibraryQueue(container);
	}

	/* ------------------------------------------------------------------ */
	/* Rate — titles you already have                                      */
	/* ------------------------------------------------------------------ */

	private renderLibraryQueue(container: HTMLElement): void {
		const rows = this.pool();

		if (!rows.length) {
			const done = container.createDiv({ cls: "reel-empty" });
			done.createDiv({ text: this.skipped.size ? "Nothing left in this queue." : this.def.empty });
			if (this.handled.size) {
				done.createDiv({
					cls: "reel-dim",
					text: `${this.handled.size} handled this session.`,
				});
			}
			if (this.skipped.size) {
				const again = done.createEl("button", { cls: "reel-btn", text: `Bring back ${this.skipped.size} skipped` });
				again.addEventListener("click", () => {
					this.skipped.clear();
					this.index = 0;
					this.render(container);
				});
			}
			return;
		}

		if (this.index >= rows.length) this.index = 0;
		const entry = rows[this.index];

		container.createDiv({ cls: "reel-rate-count", text: `${this.index + 1} of ${rows.length}` });

		const card = container.createDiv({ cls: "reel-rate-card" });
		card.setAttr("tabindex", "0");
		card.addEventListener("keydown", (ev) => void this.handleKey(ev, entry, container, rows.length));
		// Focusing on a phone raises the keyboard over the poster.
		if (!Platform.isMobile) window.setTimeout(() => card.focus(), 0);

		const posterEl = card.createDiv({ cls: "reel-rate-poster" });
		this.plugin.posters.attach(posterEl, entry);
		posterEl.addEventListener("click", () => void this.plugin.openDetail(entry));

		const body = card.createDiv({ cls: "reel-rate-body" });
		const title = body.createDiv({ cls: "reel-rate-title" });
		title.createSpan({ text: entry.title });
		const year = entry.year ?? entry.firstAirYear;
		if (year) title.createSpan({ cls: "reel-dim", text: ` ${year}` });

		const facts = body.createDiv({ cls: "reel-header-facts" });
		const people = entry.type === "tv" ? entry.creators : entry.director;
		if (people.length) facts.createSpan({ text: people.map(unlink).slice(0, 2).join(", ") });
		if (entry.runtime) facts.createSpan({ text: formatMinutes(entry.runtime) });
		if (entry.genres.length) facts.createSpan({ cls: "reel-dim", text: entry.genres.slice(0, 2).join(", ") });
		if (entry.imdbRating != null) facts.createSpan({ cls: "reel-dim", text: `IMDb ${entry.imdbRating.toFixed(1)}` });

		if (entry.overview) body.createDiv({ cls: "reel-rate-overview", text: entry.overview });

		const starRow = body.createDiv({ cls: "reel-rating-row big" });
		renderStars(starRow, {
			value: entry.rating,
			onChange: (v) => void this.applyRating(entry, v, container, rows.length),
		});

		const actions = container.createDiv({ cls: "reel-rate-actions" });
		const act = (label: string, cls: string, fn: (b: HTMLButtonElement) => Promise<void> | void) => {
			const b = actions.createEl("button", { cls: `reel-btn ${cls}`, text: label });
			b.addEventListener("click", () => void Promise.resolve(fn(b)));
			return b;
		};

		act("Skip", "", () => {
			this.skipped.add(entry.path);
			this.render(container);
		});

		act(entry.liked ? "♥ Liked" : "♡ Like", entry.liked ? "is-liked" : "", async (b) => {
			const file = this.fileFor(entry);
			if (!file) return;
			const on = await this.plugin.notes.toggleLiked(file);
			entry.liked = on;
			b.setText(on ? "♥ Liked" : "♡ Like");
			b.toggleClass("is-liked", on);
		});

		if (entry.status !== "watchlist") {
			act("→ Watchlist", "", async () => {
				const file = this.fileFor(entry);
				if (!file) return;
				await this.plugin.notes.setStatus(file, "watchlist");
				this.handled.add(entry.path);
				new Notice(`${entry.title} moved to the watchlist`);
				this.advance(container, rows.length);
			});
		} else {
			act("Mark watched", "mod-cta", async () => {
				const file = this.fileFor(entry);
				if (!file) return;
				if (entry.type === "tv") await this.plugin.notes.setStatus(file, "watching");
				else await this.plugin.notes.logFilm(file, { date: todayISO(), rating: entry.rating });
				this.handled.add(entry.path);
				new Notice(`${entry.title} marked watched`);
				this.advance(container, rows.length);
			});
		}

		// Shortcuts nobody is told about may as well not exist.
		if (!Platform.isMobile) {
			container.createDiv({
				cls: "reel-rate-hint",
				text: "1–5 to rate · shift for halves · ← → to move · s skip · l like",
			});
		}

		this.renderNav(container, rows.length);
	}

	private renderNav(container: HTMLElement, total: number): void {
		const nav = container.createDiv({ cls: "reel-rate-nav" });
		const prev = nav.createEl("button", { cls: "reel-btn", text: "← Previous" });
		prev.disabled = this.index === 0;
		prev.addEventListener("click", () => {
			this.index = Math.max(0, this.index - 1);
			this.render(container);
		});
		const next = nav.createEl("button", { cls: "reel-btn", text: "Next →" });
		next.addEventListener("click", () => {
			this.index = this.index + 1 >= total ? 0 : this.index + 1;
			this.render(container);
		});
	}

	private async applyRating(entry: Entry, v: number | undefined, container: HTMLElement, total: number): Promise<void> {
		const file = this.fileFor(entry);
		if (!file) return;
		try {
			await this.plugin.notes.setRating(file, v ?? null);
			if (v != null) this.handled.add(entry.path);
			new Notice(v == null ? `${entry.title}: rating cleared` : `${entry.title}: ${v}★`);
			this.advance(container, total);
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
		}
	}

	/** 1–5 rate, shift for halves, arrows move, s skips, l likes. */
	private async handleKey(ev: KeyboardEvent, entry: Entry, container: HTMLElement, total: number): Promise<void> {
		const file = this.fileFor(entry);
		if (!file) return;

		if (ev.key >= "1" && ev.key <= "5") {
			ev.preventDefault();
			const whole = Number(ev.key);
			await this.applyRating(entry, ev.shiftKey ? whole - 0.5 : whole, container, total);
			return;
		}

		switch (ev.key) {
			case "ArrowRight":
			case "s":
				ev.preventDefault();
				this.skipped.add(entry.path);
				this.render(container);
				break;
			case "ArrowLeft":
				ev.preventDefault();
				this.index = Math.max(0, this.index - 1);
				this.render(container);
				break;
			case "l":
				ev.preventDefault();
				await this.plugin.notes.toggleLiked(file);
				this.render(container);
				break;
		}
	}

	private advance(container: HTMLElement, total: number): void {
		// Rating removes the entry from the "unrated" queue, so the list
		// shortens under us and staying put lands on the next one.
		if (this.queue !== "unrated") this.index = this.index + 1 >= total ? 0 : this.index + 1;
		this.render(container);
	}

	private fileFor(entry: Entry): TFile | null {
		const f = this.plugin.app.vault.getAbstractFileByPath(entry.path);
		return f instanceof TFile ? f : null;
	}
}
