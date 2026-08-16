/**
 * The log sheet — the screen you actually touch most.
 *
 * On a phone it's a bottom sheet: everything that matters sits in the lower
 * two-thirds, within thumb reach, and nothing depends on hover. Date defaults
 * to today because that's right nine times out of ten.
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
	/** Logging an existing note. */
	file?: TFile;
	entry?: Entry;
	/** Creating a new note from a search result. */
	pending?: PendingAdd;
	watchlist?: boolean;
}

export class LogSheet extends Modal {
	private date = todayISO();
	private rating: number | undefined;
	private liked = false;
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
		if (isTv) {
			sub.setText(isNew ? "Adding a series — track episodes from its note." : "Series");
		} else if (rewatchCount > 0) {
			sub.setText(`Rewatch — ${rewatchCount} previous viewing${rewatchCount === 1 ? "" : "s"}`);
		} else {
			sub.setText("First viewing");
		}

		/* ---- watchlist toggle ---------------------------------------- */
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

		/* ---- details ------------------------------------------------- */
		const detailsEl = contentEl.createDiv({ cls: "reel-log-details" });

		if (!isTv) {
			const dateRow = detailsEl.createDiv({ cls: "reel-field" });
			dateRow.createDiv({ cls: "reel-field-label", text: "Watched on" });
			const dateInput = dateRow.createEl("input", {
				cls: "reel-input",
				attr: { type: "date", value: this.date },
			});
			dateInput.addEventListener("change", () => {
				this.date = dateInput.value || todayISO();
			});

			const quick = dateRow.createDiv({ cls: "reel-quick-dates" });
			const shortcut = (label: string, offsetDays: number) => {
				const b = quick.createEl("button", { cls: "reel-chip", text: label });
				b.addEventListener("click", () => {
					const d = new Date();
					d.setDate(d.getDate() - offsetDays);
					this.date = d.toISOString().slice(0, 10);
					dateInput.value = this.date;
				});
			};
			shortcut("Today", 0);
			shortcut("Yesterday", 1);
		}

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
		const readout = ratingValue.createSpan({ cls: "reel-rating-readout", text: this.rating != null ? `${this.rating}` : "—" });

		const likeRow = detailsEl.createDiv({ cls: "reel-field reel-field-inline" });
		likeRow.createDiv({ cls: "reel-field-label", text: "Liked" });
		const heart = likeRow.createEl("button", { cls: "reel-heart", text: "♥" });
		const paintHeart = () => heart.toggleClass("is-on", this.liked);
		heart.addEventListener("click", () => {
			this.liked = !this.liked;
			paintHeart();
		});
		paintHeart();

		if (this.opts.entry && this.opts.entry.watched.length) {
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
			};

			let file: TFile | null = null;

			if (this.opts.pending) {
				const p = this.opts.pending;
				if (p.type === "tv") {
					const meta = await this.plugin.tmdb.getShow(p.id);
					file = await this.plugin.notes.createShow(meta, payload);
				} else {
					const meta = await this.plugin.tmdb.getFilm(p.id);
					file = await this.plugin.notes.createFilm(meta, payload);
				}
				new Notice(`Reel: added ${p.title}.`);
			} else if (this.opts.file) {
				file = this.opts.file;
				const isTv = this.opts.entry?.type === "tv";
				if (isTv) {
					await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
						if (this.asWatchlist) fm.status = "watchlist";
						else if (fm.status === "watchlist") fm.status = "watching";
						if (this.rating != null) fm.rating = this.rating;
						if (this.liked) fm.liked = true;
						else delete fm.liked;
					});
				} else {
					await this.plugin.notes.logFilm(file, payload);
				}
				new Notice("Reel: saved.");
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
