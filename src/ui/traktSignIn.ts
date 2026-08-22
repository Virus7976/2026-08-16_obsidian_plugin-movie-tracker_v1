/**
 * Signing in to Trakt from a phone, without a redirect URL.
 *
 * Ordinary OAuth needs somewhere for the browser to come back to, and a plugin
 * running inside Obsidian on Android is not somewhere. Device flow exists for
 * precisely that shape of client and the whole ceremony is eight characters:
 * Reel asks Trakt for a code, you type it into trakt.tv/activate on whatever
 * device is nearest, and Reel keeps asking whether that has happened yet.
 *
 * Two details that decide whether this feels like a sign-in or like a fault:
 *
 *   The code is the biggest thing on the screen, and tapping it copies it.
 *   It is the only thing you have to carry to another device, so making it
 *   large and copyable is most of the design.
 *
 *   The polling interval comes from Trakt's own answer rather than from a
 *   number chosen here, and a 429 slows it down further. Polling faster than
 *   asked achieves nothing except being rate-limited during the one part of
 *   the flow where a stall looks exactly like a failure.
 */

import { App, Modal, Notice, Platform, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import { redact } from "../secrets";
import { ACTIVATE_URL, type DeviceCode, type TraktApp } from "../publish/trakt";

export class TraktSignIn extends Modal {
	private stop = false;
	private device: DeviceCode | null = null;

	constructor(
		app: App,
		private plugin: ReelPlugin,
		private app_: TraktApp,
		private onDone: (ok: boolean) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-trakt");

		contentEl.createEl("h3", { cls: "reel-log-title", text: "Sign in to Trakt" });
		contentEl.createDiv({ cls: "reel-log-sub", text: "Asking Trakt for a code…" });

		void this.begin();
	}

	private async begin(): Promise<void> {
		try {
			this.device = await this.plugin.publish.trakt.requestDeviceCode(this.app_);
		} catch (e) {
			this.fail(redact(e));
			return;
		}
		this.renderCode(this.device);
		void this.poll(this.device);
	}

	private renderCode(device: DeviceCode): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { cls: "reel-log-title", text: "Sign in to Trakt" });

		const steps = contentEl.createDiv({ cls: "reel-trakt-steps" });
		steps.createDiv({ cls: "reel-trakt-step", text: "1. Open this page on any device:" });

		const link = steps.createEl("a", {
			cls: "reel-trakt-url",
			text: device.verificationUrl || ACTIVATE_URL,
			href: device.verificationUrl || ACTIVATE_URL,
		});
		link.setAttr("target", "_blank");
		link.setAttr("rel", "noopener");

		steps.createDiv({ cls: "reel-trakt-step", text: "2. Enter this code:" });

		const code = steps.createEl("button", { cls: "reel-trakt-code", text: device.userCode });
		code.setAttr("aria-label", `Code ${device.userCode.split("").join(" ")}. Tap to copy.`);
		code.addEventListener("click", () => {
			navigator.clipboard
				?.writeText(device.userCode)
				.then(() => new Notice("Reel: code copied."))
				// A phone that refuses the clipboard still shows the code on
				// screen, which is the thing that actually matters.
				.catch(() => new Notice("Reel: couldn't copy — type it from the screen."));
		});

		const status = contentEl.createDiv({ cls: "reel-trakt-status" });
		status.createDiv({ cls: "reel-ask-spinner" });
		status.createSpan({ text: "Waiting for you to approve it…" });

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
		cancel.addEventListener("click", () => this.close());
	}

	/**
	 * Ask, wait, ask again, until Trakt says yes, no, or too late.
	 *
	 * The deadline is Trakt's own `expires_in` rather than a fixed number of
	 * attempts, because the interval can be raised mid-flow by a 429 and a loop
	 * counting attempts would then give up early — while the user is still
	 * typing, having done nothing wrong.
	 */
	private async poll(device: DeviceCode): Promise<void> {
		let wait = Math.max(1, device.interval) * 1000;
		const deadline = Date.now() + Math.max(60, device.expiresIn) * 1000;

		while (!this.stop && Date.now() < deadline) {
			await sleep(wait);
			if (this.stop) return;

			let token;
			try {
				token = await this.plugin.publish.trakt.pollDeviceToken(this.app_, device.deviceCode);
			} catch (e) {
				this.fail(redact(e));
				return;
			}

			if (token) {
				const saved = await this.plugin.publish.storeToken(JSON.stringify(token));
				if (!saved) {
					this.fail("Signed in, but the token wasn't saved — the passphrase prompt was cancelled.");
					return;
				}
				this.succeed();
				return;
			}

			// Back off a little each time. Trakt's interval is a floor, not a
			// target, and a slow approval should not cost a rate limit.
			wait = Math.min(wait + 500, 15000);
		}

		if (!this.stop) this.fail("The code expired before it was approved.");
	}

	private succeed(): void {
		const { contentEl } = this;
		contentEl.empty();
		const done = contentEl.createDiv({ cls: "reel-trakt-done" });
		setIcon(done.createSpan({ cls: "reel-trakt-done-icon" }), "check");
		done.createSpan({ text: "Signed in to Trakt." });

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const ok = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Done" });
		ok.addEventListener("click", () => this.close());
		ok.focus();

		this.stop = true;
		this.onDone(true);
		this.onDone = () => undefined;
	}

	private fail(message: string): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { cls: "reel-log-title", text: "Couldn't sign in" });
		contentEl.createDiv({ cls: "reel-publish-warn", text: message });
		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const ok = actions.createEl("button", { cls: "reel-btn", text: "Close" });
		ok.addEventListener("click", () => this.close());
		this.stop = true;
	}

	onClose(): void {
		// The loop holds a reference to this modal; without the flag it keeps
		// polling Trakt after the sheet is gone.
		this.stop = true;
		this.contentEl.empty();
		this.onDone(false);
		this.onDone = () => undefined;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => window.setTimeout(r, ms));
}
