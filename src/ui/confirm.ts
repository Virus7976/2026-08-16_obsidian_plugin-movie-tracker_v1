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

/*
 * Exported for the layout rig, and stated plainly rather than slipped in.
 *
 * The rule I have been holding is that a seam existing only for the test
 * harness is not coverage of anything — the Ask sheet's result list stayed
 * unmeasured for months rather than widen a private method for it, and was
 * eventually reached through a seam the app already had.
 *
 * This is a different case. `ConfirmModal` is the whole dialog rather than a
 * fragment of one, the export adds no behaviour and no branch, and the rig
 * constructs it with exactly the three arguments `confirm` passes. What is
 * being measured is the thing itself. The alternative was leaving the dialog
 * that guards every irreversible action in the plugin undrawn, which is a
 * worse trade than one exported class.
 */
export class ConfirmModal extends Modal {
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

		/*
		 * Marks this as the dialog where the decision is made.
		 *
		 * The stylesheet demotes destructive buttons to quiet muted text and
		 * gives them the red fill only at `data-confirming="true"`, which is
		 * the second tap of the detail screen's inline remove. That is the only
		 * place that attribute is ever set — so in here, which has no second
		 * tap, the button sat in the resting state permanently and rendered as
		 * bare text with no fill and no border.
		 *
		 * Demoting a destructive control among a stack of ordinary ones is
		 * right. This is not that: it is a dialog whose entire purpose is the
		 * choice, and the stylesheet's own reasoning says the red belongs where
		 * the decision is. It is here.
		 */
		contentEl.addClass("reel-confirm");

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
