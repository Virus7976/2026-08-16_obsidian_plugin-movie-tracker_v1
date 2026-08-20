/**
 * Your own writing, shown where the title is.
 *
 * Writing a review was already possible — the log sheet has had a box for it
 * from the start — and then it vanished. It went into the note body, the index
 * reads frontmatter only, and so nothing in Reel could show you a word of it.
 * The app would tell you a film's runtime on four screens and your opinion of
 * it on none.
 *
 * Two rules here, both learned the hard way elsewhere in this plugin:
 *
 *   The note is yours. Reading is `cachedRead`, editing is a span replacement
 *   at known offsets, and nothing rewrites, reformats or reorders the rest of
 *   the file.
 *
 *   Reading a file is slow enough to be visible. The pane draws its frame
 *   immediately and fills in when the read lands, so a detail screen never
 *   waits on disk before it appears.
 */

import { App, Modal, Notice, Platform, TFile, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import {
	appendReviewSection,
	headingFor,
	replaceHeading,
	replaceReview,
	reviewsNewestFirst,
	type NoteReview,
} from "../reviews";
import { prettyDate, todayISO } from "../util/dates";
import { renderStars, renderStarsStatic } from "./stars";
import { redact } from "../secrets";

/** How much of a review a summary shows before it is worth opening. */
const EXCERPT = 220;

function fileFor(plugin: ReelPlugin, entry: Entry): TFile | null {
	const f = plugin.app.vault.getAbstractFileByPath(entry.path);
	return f instanceof TFile ? f : null;
}

/**
 * Every review in a note, newest first.
 *
 * Cached against the file's modification time: the diary asks this once per
 * visible row, and a hundred rows is a hundred reads of files that have not
 * changed since the last repaint. An mtime is exactly the right key — it moves
 * when and only when the answer could have.
 */
const cache = new Map<string, { mtime: number; reviews: NoteReview[] }>();

export async function readReviews(plugin: ReelPlugin, entry: Entry): Promise<NoteReview[]> {
	const file = fileFor(plugin, entry);
	if (!file) return [];
	const hit = cache.get(file.path);
	if (hit && hit.mtime === file.stat.mtime) return hit.reviews;
	try {
		const reviews = reviewsNewestFirst(await plugin.app.vault.cachedRead(file));
		cache.set(file.path, { mtime: file.stat.mtime, reviews });
		return reviews;
	} catch {
		return [];
	}
}

/** Forget a note's parsed reviews, after writing to it. */
export function forgetReviews(path: string): void {
	cache.delete(path);
}

interface PaneOptions {
	/** Editing is offered on the detail screen and nowhere else. */
	editable?: boolean;
	/** Show at most this many. The detail screen shows them all. */
	limit?: number;
	/** Called after a save, so the surrounding screen can repaint. */
	onChange?: () => void;
	/** Only this date's review — what a diary row wants. */
	onlyDate?: string;
	heading?: string;
	/**
	 * Wait until the pane is near the viewport before reading the note.
	 *
	 * The diary paints up to four hundred rows, and each one asking its note for
	 * reviews is four hundred file reads on a screen that shows about six. The
	 * cache is keyed on mtime so repaints are free, but the *first* paint is not,
	 * and on a phone that is the paint that matters.
	 *
	 * Off by default. The detail screen shows exactly one and wants it now.
	 */
	lazy?: boolean;
}

/**
 * Draw the pane, filling it in when the note has been read.
 *
 * Returns immediately. The container gets a class while it waits so a screen
 * can reserve the space rather than jumping when the text lands.
 */
export function paintReviews(plugin: ReelPlugin, container: HTMLElement, entry: Entry, opts: PaneOptions = {}): void {
	const pane = container.createDiv({ cls: "reel-yours is-loading" });

	const fill = (): void => {
		void readReviews(plugin, entry).then((all) => {
			if (!pane.isConnected) return;
			pane.removeClass("is-loading");
			draw(plugin, pane, entry, all, opts);
		});
	};

	if (!opts.lazy || typeof IntersectionObserver === "undefined") {
		fill();
		return;
	}

	/*
	 * Read when it comes into view, and once only.
	 *
	 * `rootMargin` is generous on purpose: a row that starts reading its note the
	 * instant it becomes visible has the text arrive after you have already
	 * looked at it, and a line appearing under your eye is worse than one that
	 * was never there. A screen's warning is enough to land before it matters.
	 *
	 * `root: null` — the viewport — rather than the scroller, because this is
	 * used from screens that scroll in different containers and getting it wrong
	 * fails silently by never firing at all.
	 */
	const io = new IntersectionObserver(
		(entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			io.disconnect();
			fill();
		},
		{ rootMargin: "800px 0px" }
	);
	io.observe(pane);
}

function draw(
	plugin: ReelPlugin,
	pane: HTMLElement,
	entry: Entry,
	all: NoteReview[],
	opts: PaneOptions
): void {
	pane.empty();
	const reviews = opts.onlyDate ? all.filter((r) => r.date === opts.onlyDate) : all;
	const shown = opts.limit ? reviews.slice(0, opts.limit) : reviews;

	const repaint = (): void => {
		forgetReviews(entry.path);
		void readReviews(plugin, entry).then((fresh) => {
			if (pane.isConnected) draw(plugin, pane, entry, fresh, opts);
		});
		opts.onChange?.();
	};

	if (!shown.length) {
		// Nothing written, and nothing to say about it unless you can act on it.
		// A "no reviews" line on a screen with no way to write one is furniture.
		if (!opts.editable) {
			pane.remove();
			return;
		}
		const empty = pane.createDiv({ cls: "reel-yours-empty" });
		empty.createDiv({ cls: "reel-yours-label", text: opts.heading ?? "Your review" });
		empty.createDiv({
			cls: "reel-dim",
			text: entry.watched.length
				? "You have not written about this one yet."
				: "Write about it now, or when you log it.",
		});
		const write = empty.createEl("button", { cls: "reel-btn", attr: { type: "button" } });
		setIcon(write.createSpan(), "pencil-line");
		write.createSpan({ text: "Write a review" });
		write.addEventListener("click", () => {
			new ReviewEditor(plugin, entry, null, repaint).open();
		});
		return;
	}

	if (opts.heading !== "") pane.createDiv({ cls: "reel-yours-label", text: opts.heading ?? "Your review" });

	for (const review of shown) {
		const box = pane.createDiv({ cls: "reel-yours-item" });
		const head = box.createDiv({ cls: "reel-yours-head" });
		head.createSpan({ cls: "reel-yours-date", text: review.date ? prettyDate(review.date) : review.heading });
		if (review.rating != null) renderStarsStatic(head.createSpan({ cls: "reel-yours-stars" }), review.rating);

		if (opts.editable) {
			const edit = head.createEl("button", {
				cls: "reel-yours-edit clickable-icon",
				attr: { type: "button", "aria-label": "Edit this review" },
			});
			setIcon(edit, "pencil-line");
			edit.addEventListener("click", () => new ReviewEditor(plugin, entry, review, repaint).open());
		}

		const long = review.text.length > EXCERPT;
		const body = box.createDiv({ cls: "reel-yours-body" });
		body.setText(long && !opts.editable ? `${review.text.slice(0, EXCERPT).trimEnd()}…` : review.text);
		if (long && !opts.editable) {
			// On a screen that cannot edit, "more" means open the note — the
			// only honest destination for the rest of the text.
			const more = box.createEl("button", { cls: "reel-yours-more", text: "Read the rest", attr: { type: "button" } });
			more.addEventListener("click", (ev) => {
				ev.stopPropagation();
				const file = fileFor(plugin, entry);
				if (file) void plugin.app.workspace.getLeaf(false).openFile(file);
			});
		}
	}

	if (opts.editable) {
		const add = pane.createEl("button", { cls: "reel-yours-add", attr: { type: "button" } });
		setIcon(add.createSpan(), "plus");
		add.createSpan({ text: "Add another" });
		add.addEventListener("click", () => new ReviewEditor(plugin, entry, null, repaint).open());
	} else if (opts.limit && reviews.length > opts.limit) {
		pane.createDiv({ cls: "reel-dim reel-yours-count", text: `${reviews.length - opts.limit} more` });
	}
}

/* ------------------------------------------------------------------ */

/**
 * Write or rewrite one review.
 *
 * The rating sits alongside the prose because changing your mind about a film
 * and writing down why are the same act, and a heading still claiming four
 * stars over three stars' worth of prose is worse than no heading at all.
 *
 * A new review is written for today unless you say otherwise; an edited one
 * keeps whatever date it already had, because that date is a fact about when
 * you watched it, not about when you last touched the sentence.
 */
export class ReviewEditor extends Modal {
	private text: string;
	private rating: number | undefined;
	private date: string;
	private saving = false;

	constructor(
		private plugin: ReelPlugin,
		private entry: Entry,
		private review: NoteReview | null,
		private onSaved: () => void
	) {
		super(plugin.app);
		this.text = review?.text ?? "";
		this.rating = review?.rating ?? (review ? undefined : entry.rating);
		this.date = review?.date ?? this.mostRecentWatch();
	}

	/**
	 * The date a fresh review belongs to.
	 *
	 * The last time you watched it, not today: you write the review after the
	 * film, sometimes days after, and dating it "today" quietly puts a viewing
	 * in your diary on a night you were doing something else.
	 */
	private mostRecentWatch(): string {
		const dates = this.entry.watched.map((w) => w.date).filter(Boolean).sort();
		return dates[dates.length - 1] ?? todayISO();
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		modalEl.addClass("reel-review-sheet");

		contentEl.createEl("h3", { cls: "reel-log-title", text: this.review ? "Edit review" : "Write a review" });
		contentEl.createDiv({ cls: "reel-log-sub", text: this.entry.title });

		/*
		 * The box, first.
		 *
		 * It used to come after a title, a subtitle, a date field and ten rating
		 * chips, which on a phone put it under the keyboard — you could not see a
		 * word you were typing. Everything else here is metadata about the writing,
		 * and metadata goes under the thing it describes.
		 */
		const box = contentEl.createEl("textarea", {
			cls: "reel-input reel-review-box",
			attr: { rows: "6", placeholder: "What did you think?" },
		});
		box.value = this.text;
		box.addEventListener("input", () => (this.text = box.value));

		const meta = contentEl.createDiv({ cls: "reel-review-meta" });

		/*
		 * The app's own star control, not ten chips.
		 *
		 * Half-star values need ten buttons if each is a number, and one widget if
		 * it is stars — which is the control every other rating in Reel uses, so
		 * this was also the only screen where scoring something looked different.
		 */
		meta.createDiv({ cls: "reel-field-label", text: "Rating" });
		renderStars(meta, {
			value: this.rating,
			onChange: (v) => {
				this.rating = v;
			},
		});

		meta.createDiv({ cls: "reel-field-label", text: "Date" });
		const dateEl = meta.createEl("input", { cls: "reel-input reel-review-date", attr: { type: "date" } });
		dateEl.value = this.date;
		// An existing review's date is what ties it to a viewing, and moving it
		// would orphan the pair. Only a new one is free to choose.
		dateEl.disabled = this.review != null;
		dateEl.addEventListener("change", () => (this.date = dateEl.value));

		const actions = contentEl.createDiv({ cls: "reel-actions" });
		const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel", attr: { type: "button" } });
		cancel.addEventListener("click", () => this.close());
		const save = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Save", attr: { type: "button" } });
		save.addEventListener("click", () => void this.save(save));

		// Focused everywhere now, phones included. Opening the keyboard used to
		// bury the box; it is the first thing in the sheet, so the keyboard now
		// opens *under* it.
		window.setTimeout(() => box.focus(), 0);
	}

	private async save(button: HTMLButtonElement): Promise<void> {
		if (this.saving) return;
		this.saving = true;
		button.disabled = true;
		button.setText("Saving…");

		const file = fileFor(this.plugin, this.entry);
		if (!file) {
			new Notice("That note has moved or been deleted.");
			this.close();
			return;
		}

		try {
			const review = this.review;
			await this.plugin.app.vault.process(file, (data) => {
				if (!review) return appendReviewSection(data, this.date, this.rating, this.text);
				/*
				 * Heading first, then body — and re-parse in between.
				 *
				 * Both edits are offset-based, and rewriting the heading changes
				 * the length of everything after it. Doing the body first with a
				 * stale heading offset, or the heading first without re-reading,
				 * splices the file at the wrong byte. Re-parsing costs a pass
				 * over one note and removes the whole class of bug.
				 */
				const withHeading = replaceHeading(data, review, headingFor(review, this.rating));
				const again = reviewsNewestFirst(withHeading).find((r) => r.date === review.date);
				return again ? replaceReview(withHeading, again, this.text) : withHeading;
			});

			forgetReviews(file.path);
			this.onSaved();
			this.close();
		} catch (e) {
			// Redacted for the same reason every other error in Reel is: a
			// message can carry a path, and a path can carry more than you meant
			// to paste into a bug report.
			new Notice(`Reel could not save that review — ${redact(e)}`);
			button.disabled = false;
			button.setText("Save");
			this.saving = false;
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** The `app` a caller might not have to hand. */
export type { App };
