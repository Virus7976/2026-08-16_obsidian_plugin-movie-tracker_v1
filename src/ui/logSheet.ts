/**
 * The log sheet — the screen you touch most.
 *
 * Shaped against the tracker this replaces, whose dialog put a thin slider
 * rating and a stack of dropdowns in a box floating mid-screen. Here:
 *
 *   - it's a bottom sheet, so every control is in thumb reach and nothing
 *     hides behind the keyboard
 *   - the rating is ten 44px star halves, not a slider you have to land on
 *   - the date defaults to today with one-tap shortcuts, because typing a date
 *     on a phone is the worst possible way to enter one
 *   - the review box is right there, so writing a review is part of logging
 *     rather than a separate trip to the note
 */

import { App, Modal, Notice, Platform, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { redact } from "../secrets";
import { prettyDate, todayISO } from "../util/dates";
import { renderStars } from "./stars";

interface PendingAdd {
	id: number;
	type: "film" | "tv";
	title: string;
}

interface LogSheetOptions {
	file?: TFile;
	entry?: Entry;
	pending?: PendingAdd;
	watchlist?: boolean;
}

export class LogSheet extends Modal {
	private date = todayISO();
	private rating: number | undefined;
	private liked = false;
	private review = "";
	private asWatchlist: boolean;
	private busy = false;

	constructor(
		app: App,
		private plugin: ReelPlugin,
		private opts: LogSheetOptions
	) {
		super(app);
		this.asWatchlist = opts.watchlist ?? false;
		this.rating = opts.entry?.rating;
		this.liked = opts.entry?.liked ?? false;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-log");

		const isTv = (this.opts.entry?.type ?? this.opts.pending?.type) === "tv";
		const title = this.opts.entry?.title ?? this.opts.pending?.title ?? "";
		const isNew = !!this.opts.pending;
		const rewatchCount = this.opts.entry?.watched.length ?? 0;

		contentEl.createEl("h3", { cls: "reel-log-title", text: title });

		const sub = contentEl.createDiv({ cls: "reel-log-sub" });
		if (isTv) sub.setText(isNew ? "Adding a series — track episodes from its note." : "Series");
		else if (rewatchCount > 0) sub.setText(`Rewatch — ${rewatchCount} previous viewing${rewatchCount === 1 ? "" : "s"}`);
		else sub.setText("First viewing");

		/* ---- watched / watchlist ------------------------------------- */
		const modeRow = contentEl.createDiv({ cls: "reel-seg" });
		const logBtn = modeRow.createEl("button", { cls: "reel-seg-btn", text: isTv ? "Watching" : "Watched" });
		const listBtn = modeRow.createEl("button", { cls: "reel-seg-btn", text: "Watchlist" });
		const paintMode = () => {
			logBtn.toggleClass("is-active", !this.asWatchlist);
			listBtn.toggleClass("is-active", this.asWatchlist);
			detailsEl.toggleClass("is-hidden", this.asWatchlist);
		};
		logBtn.addEventListener("click", () => {
			this.asWatchlist = false;
			paintMode();
		});
		listBtn.addEventListener("click", () => {
			this.asWatchlist = true;
			paintMode();
		});

		const detailsEl = contentEl.createDiv({ cls: "reel-log-details" });

		/* ---- date ---------------------------------------------------- */
		if (!isTv) {
			const dateRow = detailsEl.createDiv({ cls: "reel-field" });
			dateRow.createDiv({ cls: "reel-field-label", text: "Watched on" });
			const quick = dateRow.createDiv({ cls: "reel-quick-dates" });
			const dateInput = dateRow.createEl("input", {
				cls: "reel-input",
				attr: { type: "date", value: this.date },
			});
			dateInput.addEventListener("change", () => {
				this.date = dateInput.value || todayISO();
				paintChips();
			});

			const chips: { el: HTMLButtonElement; iso: string }[] = [];
			const shortcut = (label: string, offsetDays: number) => {
				const d = new Date();
				d.setDate(d.getDate() - offsetDays);
				const iso = toLocalISO(d);
				const b = quick.createEl("button", { cls: "reel-chip", text: label });
				b.addEventListener("click", () => {
					this.date = iso;
					dateInput.value = iso;
					paintChips();
				});
				chips.push({ el: b, iso });
			};
			const paintChips = () => chips.forEach((c) => c.el.toggleClass("is-active", c.iso === this.date));
			shortcut("Today", 0);
			shortcut("Yesterday", 1);
			shortcut("2 days ago", 2);
			paintChips();
		}

		/* ---- rating -------------------------------------------------- */
		const ratingRow = detailsEl.createDiv({ cls: "reel-field" });
		ratingRow.createDiv({ cls: "reel-field-label", text: "Rating" });
		const ratingValue = ratingRow.createDiv({ cls: "reel-rating-row" });
		renderStars(ratingValue, {
			value: this.rating,
			onChange: (v) => {
				this.rating = v;
				readout.setText(v != null ? `${v}` : "—");
			},
		});
		const readout = ratingValue.createSpan({
			cls: "reel-rating-readout",
			text: this.rating != null ? `${this.rating}` : "—",
		});

		/* ---- liked --------------------------------------------------- */
		const likeRow = detailsEl.createDiv({ cls: "reel-field reel-field-inline" });
		likeRow.createDiv({ cls: "reel-field-label", text: "Liked" });
		const heart = likeRow.createEl("button", {
			cls: "reel-heart reel-heart-labelled",
			attr: { "aria-pressed": "false", type: "button" },
		});
		// Colour alone did not answer "did I like this?" — a faint heart and a
		// red one look the same when you have nothing to compare against. The
		// glyph fills and the word changes, so the state reads at a glance.
		const glyph = heart.createSpan({ cls: "reel-heart-glyph" });
		const word = heart.createSpan({ cls: "reel-heart-word" });
		const paintHeart = () => {
			heart.toggleClass("is-on", this.liked);
			heart.setAttr("aria-pressed", String(this.liked));
			heart.setAttr("aria-label", this.liked ? "Liked — tap to unlike" : "Not liked — tap to like");
			glyph.setText(this.liked ? "♥" : "♡");
			word.setText(this.liked ? "Liked" : "Like");
		};
		heart.addEventListener("click", () => {
			this.liked = !this.liked;
			paintHeart();
		});
		paintHeart();

		/* ---- review -------------------------------------------------- */
		if (this.plugin.settings.askForReview) {
			const reviewRow = detailsEl.createDiv({ cls: "reel-field" });
			reviewRow.createDiv({ cls: "reel-field-label", text: "Review" });
			const box = reviewRow.createEl("textarea", {
				cls: "reel-input reel-textarea",
				attr: {
					rows: "4",
					placeholder: "What did you think? Appended to the note under a dated heading.",
					enterkeyhint: "enter",
				},
			});
			box.addEventListener("input", () => {
				this.review = box.value;
				// Reset to auto first so scrollHeight measures the content
				// rather than the current box, then grow to fit — capped, so a
				// long review can't push the sheet's buttons off screen.
				box.setCssStyles({ height: "auto" });
				box.setCssStyles({ height: `${Math.min(box.scrollHeight, 240)}px` });
			});
		}

		/* ---- history ------------------------------------------------- */
		if (this.opts.entry?.watched.length) {
			const hist = detailsEl.createDiv({ cls: "reel-field" });
			hist.createDiv({ cls: "reel-field-label", text: "History" });
			const list = hist.createDiv({ cls: "reel-history" });
			for (const w of [...this.opts.entry.watched].reverse().slice(0, 5)) {
				const row = list.createDiv({ cls: "reel-history-row" });
				row.createSpan({ text: prettyDate(w.date) });
				if (w.rating != null) row.createSpan({ cls: "reel-dim", text: `★ ${w.rating}` });
				if (w.rewatch) row.createSpan({ cls: "reel-dim", text: "rewatch" });
			}
		}

		paintMode();

		/* ---- actions ------------------------------------------------- */
		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
		cancel.addEventListener("click", () => this.close());
		const save = actions.createEl("button", { cls: "reel-btn mod-cta", text: isNew ? "Add" : "Save" });
		save.addEventListener("click", () => this.submit(save));
	}

	private async submit(button: HTMLButtonElement): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		button.setText("Saving…");
		button.setAttr("disabled", "true");

		try {
			const payload = {
				date: this.date,
				rating: this.rating,
				liked: this.liked,
				watchlist: this.asWatchlist,
				review: this.asWatchlist ? undefined : this.review,
			};

			let file: TFile | null = null;

			if (this.opts.pending) {
				const p = this.opts.pending;
				file = await this.plugin.notes.createFromResult(
					{ id: p.id, media_type: p.type === "tv" ? "tv" : "movie" },
					payload
				);
				this.plugin.undo.offer(`Added ${p.title}`);
			} else if (this.opts.file) {
				file = this.opts.file;
				if (this.opts.entry?.type === "tv") {
					await this.plugin.notes.edit(file, `the change to ${file.basename}`, (fm) => {
						if (this.asWatchlist) fm.status = "watchlist";
						else if (fm.status === "watchlist") fm.status = "watching";
						if (this.rating != null) fm.rating = this.rating;
						if (this.liked) fm.liked = true;
						else delete fm.liked;
					});
					if (payload.review?.trim()) {
						await this.plugin.notes.appendReview(file, this.date, this.rating, payload.review);
					}
				} else {
					await this.plugin.notes.logFilm(file, payload);
				}
				this.plugin.undo.offer("Saved");
			}

			this.close();

			if (file && this.opts.pending && this.plugin.settings.openNoteAfterCreate) {
				await this.app.workspace.getLeaf(false).openFile(file);
			}
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`, 8000);
			button.setText("Retry");
			button.removeAttribute("disabled");
			this.busy = false;
			return;
		}
		this.busy = false;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Local date, not UTC — `toISOString()` would shift the day west of Greenwich. */
function toLocalISO(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}
