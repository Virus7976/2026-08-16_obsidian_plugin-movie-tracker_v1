import { App, Modal, Notice, Platform, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { redact } from "../secrets";

/**
 * List membership for one title.
 *
 * Lists are stored as a `lists:` array in each note's frontmatter rather than
 * as separate index files. That means a list can never fall out of sync with
 * its members, and deleting a note removes it from every list automatically —
 * which a file full of links would not do.
 */
export class ListPicker extends Modal {
	private selected: Set<string>;

	constructor(
		app: App,
		private plugin: ReelPlugin,
		private entry: Entry,
		private file: TFile
	) {
		super(app);
		this.selected = new Set(entry.lists);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		contentEl.createEl("h3", { cls: "reel-log-title", text: "Lists" });
		contentEl.createDiv({ cls: "reel-log-sub", text: this.entry.title });

		const chipRow = contentEl.createDiv({ cls: "reel-flag-row" });
		const known = new Set([...this.plugin.library.lists(), ...this.selected]);

		const addChip = (name: string) => {
			const chip = chipRow.createEl("button", { cls: "reel-chip", text: name });
			const paint = () => chip.toggleClass("is-active", this.selected.has(name));
			chip.addEventListener("click", () => {
				if (this.selected.has(name)) this.selected.delete(name);
				else this.selected.add(name);
				paint();
			});
			paint();
		};

		[...known].sort().forEach(addChip);
		if (!known.size) contentEl.createDiv({ cls: "reel-dim", text: "No lists yet — create one below." });

		const newRow = contentEl.createDiv({ cls: "reel-field" });
		newRow.createDiv({ cls: "reel-field-label", text: "New list" });
		const input = newRow.createEl("input", {
			cls: "reel-input",
			attr: { type: "text", placeholder: "e.g. Halloween 2026", enterkeyhint: "done" },
		});
		const create = () => {
			const name = input.value.trim();
			if (!name || this.selected.has(name)) return;
			this.selected.add(name);
			addChip(name);
			input.value = "";
		};
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				create();
			}
		});

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		actions.createEl("button", { cls: "reel-btn", text: "Cancel" }).addEventListener("click", () => this.close());
		const save = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Save" });
		save.addEventListener("click", async () => {
			create(); // don't lose a name typed but not submitted
			try {
				await this.plugin.notes.setLists(this.file, [...this.selected]);
				this.plugin.undo.offer("Lists updated");
			} catch (e) {
				new Notice(`Reel: ${redact(e)}`);
			}
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
