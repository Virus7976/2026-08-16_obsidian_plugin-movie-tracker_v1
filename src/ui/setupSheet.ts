/**
 * A guided setup for one feature.
 *
 * There was never anything wrong with the instructions Reel gave. They were
 * accurate, and they were three lines of grey text under a field, in a column
 * of forty-nine other rows that looked exactly the same. Which is to say the
 * problem was not what they said, it was that nothing marked them as the thing
 * you were meant to be reading at that moment.
 *
 * So: one screen per feature, opened deliberately, answering the four
 * questions in the order a person actually asks them.
 *
 *   What do I get? Before anything else, because the honest answer to "should
 *   I set up DoesTheDogDie" is sometimes no, and finding that out on step four
 *   is worse than finding it out on step zero.
 *
 *   What does it cost me? Time and money, said plainly. "A few minutes, free —
 *   they approve by hand" is a different proposition from "2 minutes, free",
 *   and the difference matters before you start rather than after.
 *
 *   What leaves my vault? Every one of these features sends something
 *   somewhere. That belongs here, beside the switch, at the moment of the
 *   decision — not in a privacy section nobody opens.
 *
 *   Then, and only then, the steps.
 *
 * The steps are a list, not a wizard. A wizard earns its place when each step
 * depends on the last and the whole would overwhelm; these are four short
 * instructions, most of which happen on somebody else's website, and paging
 * through them on a phone means losing your place every time you tab away to
 * actually do one. A list you can see all of survives being left and returned
 * to, which is the real usage pattern here.
 *
 * Ticks are local to the sheet and deliberately not saved. What is saved is
 * the key, and that is the only honest measure of whether setup happened. A
 * persisted "you finished step 3" would go on insisting setup was underway
 * long after somebody gave up — and would go on insisting it after they
 * removed the key.
 */

import { App, Modal, Notice, Platform } from "obsidian";
import type ReelPlugin from "../main";
import type { FeatureSpec, SetupStep } from "../setup";
import { isConfigured, isPartial } from "../setup";
import { featureHealth } from "../health";
import { checkFeature, checkable } from "../checks";

export class SetupSheet extends Modal {
	private ticked = new Set<number>();

	constructor(
		app: App,
		private plugin: ReelPlugin,
		private spec: FeatureSpec,
		private onDone?: () => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		modalEl.addClass("reel-setup-modal");
		if (Platform.isPhone) modalEl.addClass("reel-modal-phone");
		contentEl.empty();
		contentEl.addClass("reel-setup");

		this.renderHead(contentEl);
		this.renderSteps(contentEl);
		this.renderFoot(contentEl);
	}

	/* ------------------------------------------------------------------ */

	private renderHead(root: HTMLElement): void {
		const head = root.createDiv({ cls: "reel-setup-head" });

		const title = head.createDiv({ cls: "reel-setup-title" });
		title.createSpan({ cls: "reel-setup-name", text: this.spec.name });

		// The state pill answers "did I already do this?", which is a
		// surprisingly hard question to answer from a settings screen where a
		// saved key renders as an empty password field.
		const done = isConfigured(this.plugin, this.spec);
		const part = isPartial(this.plugin, this.spec);
		title.createSpan({
			cls: done ? "reel-pill ok" : part ? "reel-pill warn" : "reel-pill",
			text: done ? "Set up" : part ? "Half done" : this.spec.essential ? "Required" : "Not set up",
		});

		head.createDiv({ cls: "reel-setup-gives", text: this.spec.gives });
		head.createDiv({ cls: "reel-setup-effort", text: this.spec.effort });

		/*
		 * What this connection last did, for the features that can say.
		 *
		 * Opening a guide for something already set up is almost always
		 * because it has stopped working, and until now the guide answered
		 * only the question you were not asking — how to set it up, which you
		 * already did.
		 */
		this.renderHealth(head, done);

		// Not a disclosure buried behind a link. If a feature sends something
		// out of the vault, the sentence saying so is on the screen where you
		// decide to turn it on.
		const sends = root.createDiv({ cls: "reel-setup-sends" });
		sends.createDiv({ cls: "reel-setup-sends-label", text: "What leaves your vault" });
		sends.createDiv({ cls: "reel-setup-sends-text", text: this.spec.sends });
	}

	/**
	 * What this connection last did, and a way to find out now.
	 *
	 * Opening a guide for something already set up is almost always because it
	 * has stopped working, and the guide used to answer only the question you
	 * were not asking — how to set it up, which you already did.
	 *
	 * The button is the other half of that. Verification lived on a different
	 * screen from configuration, behind one control that tested all six
	 * services at once, so finishing this walkthrough meant closing it and
	 * going to look for something else in order to learn whether the key you
	 * had just pasted was right.
	 *
	 * Shown when the feature is set up *or* merely checkable, which are not the
	 * same thing and the difference is the point. Mastodon is checked by its
	 * server address rather than its token, so somebody who has typed a server
	 * and not yet made a token can find out the address is wrong — which is
	 * both the commonest mistake and the cheapest moment to fix it.
	 */
	private renderHealth(head: HTMLElement, done: boolean): void {
		const can = checkable(this.plugin, this.spec.id);
		if (!done && !can) return;

		const said = this.healthLine();
		if (!said && !can) return;

		const wrap = head.createDiv({ cls: "reel-setup-check" });
		const line = wrap.createDiv({ cls: "reel-setup-health" });

		const draw = (): void => {
			const now = this.healthLine();
			line.setText(now?.text ?? "");
			line.className = `reel-setup-health is-${now?.tone ?? "info"}`;
		};
		draw();

		if (!can) return;

		const btn = wrap.createEl("button", { cls: "reel-btn reel-setup-check-btn", text: "Check now" });
		btn.addEventListener("click", async () => {
			btn.disabled = true;
			btn.setText("Checking…");
			try {
				await checkFeature(this.plugin, this.spec.id, Date.now());
				// checkFeature records the result but does not persist — the
				// bulk run saves once at the end rather than once per check.
				await this.plugin.saveSettings();
			} finally {
				btn.disabled = false;
				btn.setText("Check now");
				draw();
			}
		});
	}

	/**
	 * Null for the features nothing can honestly report on.
	 *
	 * The routing lives in `health.ts` and is shared with the settings rows and
	 * the health table. It was written out here as well, which is how a guide
	 * and a row come to disagree about the same feature.
	 */
	private healthLine(): { text: string; tone: "ok" | "warn" | "info" } | null {
		const s = this.plugin.settings;
		return featureHealth(
			this.spec.id,
			{
				records: s.connectionHealth,
				hasTrakt: this.plugin.credentials.has("trakt"),
				traktExpires: s.traktExpires,
			},
			Date.now()
		);
	}

	private renderSteps(root: HTMLElement): void {
		const list = root.createEl("ol", { cls: "reel-setup-steps" });
		this.spec.steps.forEach((step, i) => this.renderStep(list, step, i));
	}

	private renderStep(list: HTMLElement, step: SetupStep, i: number): void {
		const li = list.createEl("li", { cls: "reel-setup-step" });
		const row = li.createDiv({ cls: "reel-setup-step-row" });

		// The number itself is the button. Keeping your place in a list you
		// keep tabbing away from is the whole job of these ticks, and it should
		// not require aim.
		const tick = row.createEl("button", { cls: "reel-setup-tick", text: String(i + 1) });
		tick.setAttr("aria-label", `Step ${i + 1}. Tap to mark done.`);
		tick.setAttr("aria-pressed", "false");

		row.createSpan({ cls: "reel-setup-step-text", text: step.text });

		const mark = (): void => {
			const on = this.ticked.has(i);
			if (on) this.ticked.delete(i);
			else this.ticked.add(i);
			li.toggleClass("is-done", !on);
			tick.setAttr("aria-pressed", String(!on));
			tick.setText(!on ? "✓" : String(i + 1));
		};
		tick.addEventListener("click", mark);

		if (step.copy) this.renderCopy(li, step.copy);

		if (step.url) {
			const a = li.createEl("a", {
				cls: "reel-btn reel-setup-go",
				text: this.hostOf(step.url),
				href: step.url,
			});
			a.setAttr("target", "_blank");
			a.setAttr("rel", "noopener");
			// Following the link is the step. Making you tick it afterwards as
			// well is a chore nobody would thank us for.
			a.addEventListener("click", () => {
				if (!this.ticked.has(i)) mark();
			});
		}

		if (step.note) li.createDiv({ cls: "reel-setup-note", text: step.note });
	}

	/**
	 * A literal to be typed exactly, with a button that copies it.
	 *
	 * The two values in Reel's entire setup that must match character for
	 * character are Trakt's redirect URI and Mastodon's scope, and both are
	 * strings of punctuation that mean nothing to read. Copying either by eye
	 * is how a setup fails five minutes later with somebody else's error
	 * message attached.
	 */
	private renderCopy(li: HTMLElement, value: string): void {
		const btn = li.createEl("button", { cls: "reel-setup-copy" });
		btn.createSpan({ cls: "reel-setup-copy-value", text: value });
		btn.createSpan({ cls: "reel-setup-copy-hint", text: "Copy" });
		btn.setAttr("aria-label", `Copy ${value}`);
		btn.addEventListener("click", () => {
			navigator.clipboard
				?.writeText(value)
				.then(() => {
					new Notice("Reel: copied.");
					btn.addClass("is-copied");
				})
				// It is on screen and selectable either way, which is the part
				// that actually has to work.
				.catch(() => new Notice("Reel: couldn't copy — type it from the screen."));
		});
	}

	private renderFoot(root: HTMLElement): void {
		const foot = root.createDiv({ cls: "reel-setup-foot" });
		const close = foot.createEl("button", { cls: "reel-btn mod-cta", text: "Back to settings" });
		close.addEventListener("click", () => {
			this.close();
			this.onDone?.();
		});
	}

	/** "Open themoviedb.org" reads better on a button than the whole URL does. */
	private hostOf(url: string): string {
		try {
			return `Open ${new URL(url).hostname.replace(/^www\./, "")}`;
		} catch {
			return "Open";
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
