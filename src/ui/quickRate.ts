import { Modal, Notice, Platform, TFile, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { redact } from "../secrets";
import { renderStars } from "./stars";
import { haptic } from "../util/haptics";

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

		// Reactions, which is the fast path: a rating is a judgement you have to
		// compose, and plenty of the time what you actually want to record is
		// "yes" or "again". Both were already possible only by opening the note.
		//
		// These deliberately do not close the sheet. Liking something and
		// marking it a rewatch are two taps you often want together, and the
		// old heart dismissed on the first one.
		const reactions = contentEl.createDiv({ cls: "reel-reactions" });

		const reaction = (
			on: boolean,
			iconOn: string,
			iconOff: string,
			label: string,
			toggle: () => Promise<boolean>
		) => {
			const b = reactions.createEl("button", { cls: "reel-reaction", attr: { type: "button" } });
			const paint = (state: boolean) => {
				b.empty();
				setIcon(b.createSpan({ cls: "reel-reaction-icon" }), state ? iconOn : iconOff);
				b.createSpan({ cls: "reel-reaction-label", text: label });
				b.toggleClass("is-on", state);
				b.setAttr("aria-pressed", state ? "true" : "false");
			};
			paint(on);
			b.addEventListener("click", async () => {
				// Optimistic: the toggle is the whole interaction, so waiting on
				// a disk write before the button changes makes it feel broken.
				const next = !b.hasClass("is-on");
				paint(next);
				haptic("tick");
				try {
					const actual = await toggle();
					if (actual !== next) paint(actual);
				} catch (e) {
					paint(!next);
					new Notice(`Reel: ${redact(e)}`);
				}
			});
		};

		reaction(!!this.entry.liked, "heart", "heart", "Liked", () => this.plugin.notes.toggleLiked(this.file));
		reaction(!!this.entry.wouldRewatch, "rotate-ccw", "rotate-ccw", "Again", () =>
			this.plugin.notes.toggleRewatch(this.file)
		);

		const row = contentEl.createDiv({ cls: "reel-log-actions" });
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
