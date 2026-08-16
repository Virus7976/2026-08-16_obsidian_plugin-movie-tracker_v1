/**
 * Rate mode — one title at a time, rate, move on.
 *
 * The library grid is for finding a specific thing. This is for the opposite
 * job: working through a pile without deciding what to look at next. Every
 * other tracker has some version of it, and the reason is that rating twenty
 * films through a grid means twenty round trips into and out of a detail
 * screen, which nobody does twice.
 *
 * Rating advances automatically. That's the whole trick — the queue moves
 * without a second tap, so the interaction is one thumb and one decision.
 */

import { Notice, Platform, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { redact } from "../secrets";
import { renderStars } from "./stars";
import { formatMinutes } from "../util/dates";
import { unlink } from "../library";

export type RateQueue = "unrated" | "watchlist" | "all";

const QUEUES: { id: RateQueue; label: string; empty: string }[] = [
	{ id: "unrated", label: "Unrated", empty: "Everything you've watched is rated." },
	{ id: "watchlist", label: "Watchlist", empty: "Nothing on the watchlist." },
	{ id: "all", label: "Everything", empty: "Nothing in the library yet." },
];

export class RateScreen {
	private queue: RateQueue = "unrated";
	private index = 0;
	/** Paths skipped this session, so Skip means "not now" rather than "never". */
	private skipped = new Set<string>();
	/**
	 * Paths already acted on in this queue.
	 *
	 * The queue is recomputed from the library index on every repaint, but
	 * `metadataCache` has not reparsed the file by the time we repaint — so a
	 * film you just rated still looks unrated, stays in the queue, and you are
	 * handed the same card again. Tracking it here makes the queue shrink
	 * immediately, which is what the index will agree with a moment later.
	 */
	private handled = new Set<string>();

	constructor(private plugin: ReelPlugin) {}

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

		/* ---- queue picker ---------------------------------------------- */
		const bar = container.createDiv({ cls: "reel-chips" });
		for (const q of QUEUES) {
			const chip = bar.createEl("button", { cls: "reel-chip", text: q.label });
			chip.toggleClass("is-active", this.queue === q.id);
			chip.addEventListener("click", () => {
				this.queue = q.id;
				this.index = 0;
				// A new queue asks a different question, so what you've already
				// dealt with in the old one shouldn't be hidden here.
				this.handled.clear();
				this.skipped.clear();
				this.render(container);
			});
		}

		const rows = this.pool();
		const meta = QUEUES.find((q) => q.id === this.queue)!;

		if (!rows.length) {
			const done = container.createDiv({ cls: "reel-empty" });
			done.createDiv({ text: this.skipped.size ? "Nothing left in this queue." : meta.empty });
			if (this.skipped.size) {
				const again = done.createEl("button", { cls: "reel-btn", text: `Bring back ${this.skipped.size} skipped` });
				again.addEventListener("click", () => {
					this.skipped.clear();
					this.index = 0;
					this.render(container);
				});
			}
			if (this.handled.size) {
				done.createDiv({
					cls: "reel-dim",
					text: `${this.handled.size} handled this session.`,
				});
			}
			return;
		}

		if (this.index >= rows.length) this.index = 0;
		const entry = rows[this.index];

		container.createDiv({ cls: "reel-rate-count", text: `${this.index + 1} of ${rows.length}` });

		/* ---- the card --------------------------------------------------- */
		const card = container.createDiv({ cls: "reel-rate-card" });

		/**
		 * Keyboard shortcuts, bound to the card rather than the document — the
		 * listener dies with the element, so there is nothing to clean up and
		 * no chance of it firing while you're typing somewhere else.
		 *
		 * 1–5 rate whole stars, shift+1–5 add a half.
		 */
		card.setAttr("tabindex", "0");
		card.addEventListener("keydown", async (ev) => {
			const file = this.fileFor(entry);
			if (!file) return;

			if (ev.key >= "1" && ev.key <= "5") {
				ev.preventDefault();
				const whole = Number(ev.key);
				const value = ev.shiftKey ? whole - 0.5 : whole;
				await this.plugin.notes.setRating(file, value);
				this.handled.add(entry.path);
				new Notice(`${entry.title}: ${value}★`);
				this.advance(container, rows.length);
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
		});
		// Focus the card so the shortcuts work without a click first. Only on
		// desktop — focusing on a phone raises the keyboard over the poster.
		if (!Platform.isMobile) window.setTimeout(() => card.focus(), 0);

		const posterEl = card.createDiv({ cls: "reel-rate-poster" });
		const src = this.plugin.posters.resourcePath(entry.poster);
		if (src) posterEl.createEl("img", { attr: { src, alt: "" } });
		else {
			posterEl.addClass("is-empty");
			posterEl.createSpan({ text: entry.title.slice(0, 2) });
		}
		// Tapping the poster is the escape hatch into the full detail screen.
		posterEl.addEventListener("click", () => this.plugin.openDetail(entry));

		const title = card.createDiv({ cls: "reel-rate-title" });
		title.createSpan({ text: entry.title });
		const year = entry.year ?? entry.firstAirYear;
		if (year) title.createSpan({ cls: "reel-dim", text: ` ${year}` });

		const facts = card.createDiv({ cls: "reel-header-facts" });
		const people = entry.type === "tv" ? entry.creators : entry.director;
		if (people.length) facts.createSpan({ text: people.map(unlink).slice(0, 2).join(", ") });
		if (entry.runtime) facts.createSpan({ text: formatMinutes(entry.runtime) });
		if (entry.genres.length) facts.createSpan({ cls: "reel-dim", text: entry.genres.slice(0, 2).join(", ") });
		if (entry.imdbRating != null) facts.createSpan({ cls: "reel-dim", text: `IMDb ${entry.imdbRating.toFixed(1)}` });

		if (entry.overview) {
			card.createDiv({ cls: "reel-rate-overview", text: entry.overview });
		}

		/* ---- rating ----------------------------------------------------- */
		const starRow = card.createDiv({ cls: "reel-rating-row big centred" });
		renderStars(starRow, {
			value: entry.rating,
			onChange: async (v) => {
				const file = this.fileFor(entry);
				if (!file) return;
				try {
					await this.plugin.notes.setRating(file, v ?? null);
					if (v != null) this.handled.add(entry.path);
					new Notice(v == null ? `${entry.title}: rating cleared` : `${entry.title}: ${v}★`);
					// Advance on its own — the point of this screen is that
					// rating and moving on are a single action.
					this.advance(container, rows.length);
				} catch (e) {
					new Notice(`Reel: ${redact(e)}`);
				}
			},
		});

		/* ---- secondary actions ------------------------------------------ */
		const actions = container.createDiv({ cls: "reel-rate-actions" });
		const act = (label: string, cls: string, fn: (b: HTMLButtonElement) => void | Promise<void>) => {
			const b = actions.createEl("button", { cls: `reel-btn ${cls}`, text: label });
			b.addEventListener("click", () => void fn(b));
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
			new Notice(on ? `Liked ${entry.title}` : `Unliked ${entry.title}`);
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

		/* ---- prev / next ------------------------------------------------- */
		const nav = container.createDiv({ cls: "reel-rate-nav" });
		const prev = nav.createEl("button", { cls: "reel-btn", text: "← Previous" });
		prev.disabled = this.index === 0;
		prev.addEventListener("click", () => {
			this.index = Math.max(0, this.index - 1);
			this.render(container);
		});
		const next = nav.createEl("button", { cls: "reel-btn", text: "Next →" });
		next.addEventListener("click", () => this.advance(container, rows.length));
	}

	private advance(container: HTMLElement, total: number): void {
		// Rating removes the entry from the "unrated" queue, so the list
		// shortens under us. Staying put lands on the next one; only wrap when
		// we're genuinely at the end of a queue that isn't shrinking.
		if (this.queue !== "unrated") this.index = this.index + 1 >= total ? 0 : this.index + 1;
		this.render(container);
	}

	private fileFor(entry: Entry): TFile | null {
		const f = this.plugin.app.vault.getAbstractFileByPath(entry.path);
		return f instanceof TFile ? f : null;
	}
}

import { todayISO } from "../util/dates";
