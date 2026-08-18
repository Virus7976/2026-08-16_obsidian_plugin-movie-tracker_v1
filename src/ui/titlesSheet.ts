/**
 * The titles behind a number.
 *
 * Every figure on the stats page was a dead end: "12 rated five stars" told you
 * the count and gave you no way to see *which* twelve. Some tiles navigated
 * away to a filtered Library instead, which answers the question by leaving the
 * page you asked it from — and on a phone, leaving a page means finding your
 * way back.
 *
 * A sheet answers in place. It carries the poster, your rating and your own
 * review, because "which five-star films" is almost always asked as a prelude
 * to "and what did I say about them".
 */

import { Modal, Platform } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { renderStarsStatic } from "./stars";
import { prettyDate } from "../util/dates";

export class TitlesSheet extends Modal {
	constructor(
		private plugin: ReelPlugin,
		private heading: string,
		private entries: Entry[],
		/** Shown under the heading — what the number actually meant. */
		private note?: string
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal", "reel-titles-sheet");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-titles");

		const head = contentEl.createDiv({ cls: "reel-titles-head" });
		head.createDiv({ cls: "reel-titles-title", text: this.heading });
		head.createDiv({
			cls: "reel-titles-count",
			text: `${this.entries.length} ${this.entries.length === 1 ? "title" : "titles"}`,
		});
		if (this.note) head.createDiv({ cls: "reel-dim", text: this.note });

		if (!this.entries.length) {
			contentEl.createDiv({ cls: "reel-empty", text: "Nothing here yet." });
			return;
		}

		const list = contentEl.createDiv({ cls: "reel-titles-list" });
		for (const entry of this.entries) {
			const row = list.createDiv({ cls: "reel-titles-row" });

			const poster = row.createDiv({ cls: "reel-titles-poster" });
			this.plugin.posters.attach(poster, entry);

			const body = row.createDiv({ cls: "reel-titles-body" });
			body.createDiv({ cls: "reel-titles-name", text: entry.title });

			const meta = body.createDiv({ cls: "reel-titles-meta" });
			const year = entry.year ?? entry.firstAirYear;
			if (year) meta.createSpan({ cls: "reel-dim", text: String(year) });
			if (entry.rating != null) {
				renderStarsStatic(meta.createDiv({ cls: "reel-titles-stars" }), entry.rating);
			}
			// The most recent viewing, because "when did I see this" is the
			// other half of the question almost every time.
			const last = entry.watched?.[entry.watched.length - 1];
			if (last?.date) meta.createSpan({ cls: "reel-dim", text: prettyDate(last.date) });

			// The row is the control: tapping it goes to the title, which is the
			// only thing anyone wants to do from here.
			row.addEventListener("click", () => {
				this.close();
				void this.plugin.openDetail(entry);
			});
			row.setAttr("role", "button");
			row.setAttr("tabindex", "0");
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
