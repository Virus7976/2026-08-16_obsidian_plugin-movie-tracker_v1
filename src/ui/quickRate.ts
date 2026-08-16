import { Modal, Notice, Platform, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { redact } from "../secrets";
import { renderStars } from "./stars";

/** Long-press target: stars, a heart, and nothing else to get in the way. */
export class QuickRate extends Modal {
	constructor(
		private plugin: ReelPlugin,
		private entry: Entry,
		private file: TFile
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal", "reel-quickrate");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		contentEl.createEl("h3", { cls: "reel-log-title", text: this.entry.title });

		renderStars(contentEl.createDiv({ cls: "reel-rating-row big" }), {
			value: this.entry.rating,
			onChange: async (v) => {
				try {
					await this.plugin.notes.setRating(this.file, v ?? null);
				} catch (e) {
					new Notice(`Reel: ${redact(e)}`);
				}
				this.close();
			},
		});

		const row = contentEl.createDiv({ cls: "reel-log-actions" });
		const heart = row.createEl("button", { cls: "reel-btn", text: this.entry.liked ? "♥ Liked" : "♡ Like" });
		heart.addEventListener("click", async () => {
			await this.plugin.notes.toggleLiked(this.file);
			this.close();
		});
		const open = row.createEl("button", { cls: "reel-btn mod-cta", text: "Open note" });
		open.addEventListener("click", async () => {
			this.close();
			await this.plugin.app.workspace.getLeaf(false).openFile(this.file);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
