/**
 * A confirmation before something irreversible.
 *
 * Reel had no such thing: every destructive action ran on a single tap. That
 * is fine for a rating and wrong for deleting files, and the difference is
 * worth one dialog.
 *
 * Two deliberate choices:
 *
 *   The count goes in the message, not just "are you sure". "Move 14 posters
 *   to the trash" is checkable; "are you sure?" is not, and a number that
 *   looks wrong is the only warning you get before the fact.
 *
 *   Cancel is the default focus. Getting here by mis-tap should cost nothing,
 *   and Escape resolves the same way.
 */

import { App, Modal, Platform } from "obsidian";

export function confirm(
	app: App,
	opts: { title: string; body: string; confirmText: string; danger?: boolean }
): Promise<boolean> {
	return new Promise((resolve) => new ConfirmModal(app, opts, resolve).open());
}

class ConfirmModal extends Modal {
	private answered = false;

	constructor(
		app: App,
		private opts: { title: string; body: string; confirmText: string; danger?: boolean },
		private done: (ok: boolean) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		contentEl.createEl("h3", { cls: "reel-log-title", text: this.opts.title });
		contentEl.createDiv({ cls: "reel-log-sub", text: this.opts.body });

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
		cancel.addEventListener("click", () => this.finish(false));

		const go = actions.createEl("button", {
			cls: this.opts.danger ? "reel-btn reel-btn-danger" : "reel-btn mod-cta",
			text: this.opts.confirmText,
		});
		go.addEventListener("click", () => this.finish(true));

		// Landing on Cancel means Enter cannot confirm a deletion by reflex.
		cancel.focus();
	}

	private finish(ok: boolean): void {
		this.answered = true;
		this.done(ok);
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
		// Dismissing by Escape or by tapping outside is a refusal, not a yes.
		if (!this.answered) this.done(false);
	}
}
