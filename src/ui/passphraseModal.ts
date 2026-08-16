import { App, Modal, Platform } from "obsidian";

interface PromptOptions {
	title: string;
	body?: string;
	placeholder?: string;
	cta?: string;
	password?: boolean;
	/** Ask twice and require a match — for setting a new passphrase. */
	confirm?: boolean;
}

/**
 * A single-field prompt used for passphrases and for session key entry.
 * Rendered as a bottom sheet on mobile so it sits under the thumb rather than
 * behind the on-screen keyboard.
 */
export class PassphraseModal extends Modal {
	private value = "";
	private confirmValue = "";
	private resolved = false;

	private constructor(
		app: App,
		private opts: PromptOptions,
		private resolve: (value: string | null) => void
	) {
		super(app);
	}

	static prompt(app: App, opts: PromptOptions): Promise<string | null> {
		return new Promise((resolve) => new PassphraseModal(app, opts, resolve).open());
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-prompt");

		contentEl.createEl("h3", { text: this.opts.title, cls: "reel-prompt-title" });
		if (this.opts.body) contentEl.createEl("p", { text: this.opts.body, cls: "reel-prompt-body" });

		const field = (placeholder: string, onInput: (v: string) => void) => {
			const input = contentEl.createEl("input", {
				cls: "reel-input",
				attr: {
					type: this.opts.password ? "password" : "text",
					placeholder,
					// Keep credentials out of the keyboard's learned dictionary
					// and away from autofill heuristics.
					autocomplete: "off",
					autocapitalize: "off",
					autocorrect: "off",
					spellcheck: "false",
					enterkeyhint: "go",
				},
			});
			input.addEventListener("input", () => onInput(input.value));
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					this.submit();
				}
			});
			return input;
		};

		const first = field(this.opts.placeholder ?? "", (v) => (this.value = v));
		if (this.opts.confirm) field("Confirm passphrase", (v) => (this.confirmValue = v));

		const error = contentEl.createDiv({ cls: "reel-prompt-error" });
		error.hide();
		this.errorEl = error;

		const actions = contentEl.createDiv({ cls: "reel-prompt-actions" });
		const cancel = actions.createEl("button", { text: "Cancel", cls: "reel-btn" });
		cancel.addEventListener("click", () => this.close());
		const go = actions.createEl("button", { text: this.opts.cta ?? "OK", cls: "reel-btn mod-cta" });
		go.addEventListener("click", () => this.submit());

		// Phones need a beat before focus takes, or the keyboard doesn't raise.
		window.setTimeout(() => first.focus(), Platform.isMobile ? 120 : 0);
	}

	private errorEl!: HTMLElement;

	private submit(): void {
		if (!this.value) {
			this.showError("Enter a value.");
			return;
		}
		if (this.opts.confirm) {
			if (this.value !== this.confirmValue) {
				this.showError("The two entries don't match.");
				return;
			}
			if (this.value.length < 8) {
				this.showError("Use at least 8 characters.");
				return;
			}
		}
		this.resolved = true;
		const v = this.value;
		this.close();
		this.resolve(v);
	}

	private showError(msg: string): void {
		this.errorEl.setText(msg);
		this.errorEl.show();
	}

	onClose(): void {
		// Clear the fields before the DOM is torn down, so a passphrase can't
		// linger in a detached node.
		this.contentEl.empty();
		this.value = "";
		this.confirmValue = "";
		if (!this.resolved) this.resolve(null);
	}
}
