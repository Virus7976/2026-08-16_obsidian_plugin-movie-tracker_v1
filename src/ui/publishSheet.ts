/**
 * The last thing between your writing and the internet.
 *
 * This sheet exists because of one asymmetry. Everything else Reel does can be
 * taken back — a wrong rating is a tap away from right, a bad note is one undo
 * from gone. A published review cannot be un-read, and the failure mode is not
 * "the app did something odd", it is "strangers saw a thing I did not mean to
 * say". So the design here is not the usual Reel design of removing steps.
 *
 * Three rules, all of them the opposite of what the rest of the plugin does:
 *
 *   Show the real text. Not a summary, not "your review will be posted" — the
 *   exact characters that will be sent, per target, including the truncation if
 *   there is one. A preview you cannot read is a confirmation you cannot give.
 *
 *   Nothing is ticked by default. The targets you turned on are listed; none is
 *   selected. Publishing takes a deliberate tap on the destination as well as
 *   on the button, so a reflex tap posts nowhere.
 *
 *   Say where it went afterwards, with links. The sheet does not just close on
 *   success — you get the URL, because the natural next question after "post
 *   this publicly" is "where is it".
 */

import { App, Modal, Notice, Platform, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import type { PublishPayload } from "../publish/compose";
import { wordCount, TRAKT_REVIEW_WORDS } from "../publish/compose";
import type { PublishOutcome, TargetId, TargetInfo } from "../publish";
import { redact } from "../secrets";
import { prettyDate } from "../util/dates";
import { renderStarsStatic } from "./stars";
import { FEATURES } from "../setup";
import { SetupSheet } from "./setupSheet";

interface Options {
	entry: Entry;
	date?: string;
	rating?: number;
	text: string;
	onDone?: () => void;
}

export class PublishSheet extends Modal {
	private chosen = new Set<TargetId>();
	private spoiler: boolean;
	private busy = false;
	private previewHost!: HTMLElement;
	private goBtn!: HTMLButtonElement;

	constructor(
		app: App,
		private plugin: ReelPlugin,
		private opts: Options
	) {
		super(app);
		this.spoiler = plugin.settings.publishSpoilerDefault;
	}

	private get payload(): PublishPayload {
		return {
			entry: this.opts.entry,
			date: this.opts.date,
			rating: this.opts.rating,
			text: this.opts.text,
			spoiler: this.spoiler,
		};
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-publish");

		contentEl.createEl("h3", { cls: "reel-log-title", text: "Publish review" });

		const sub = contentEl.createDiv({ cls: "reel-publish-sub" });
		sub.createSpan({ cls: "reel-publish-title", text: this.opts.entry.title });
		if (this.opts.rating != null && this.opts.rating > 0) {
			renderStarsStatic(sub.createSpan({ cls: "reel-publish-stars" }), this.opts.rating);
		}
		if (this.opts.date) sub.createSpan({ cls: "reel-publish-date", text: prettyDate(this.opts.date) });

		const targets = this.plugin.publish.targets();
		if (!targets.length) {
			this.renderNowhere(contentEl);
			return;
		}

		this.renderTargets(contentEl, targets);
		this.renderSpoiler(contentEl);

		this.previewHost = contentEl.createDiv({ cls: "reel-publish-previews" });

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
		cancel.addEventListener("click", () => this.close());

		this.goBtn = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Publish" });
		this.goBtn.addEventListener("click", () => void this.run());

		cancel.focus();
		void this.repaint();
	}

	/**
	 * Publishing is on but nothing is configured.
	 *
	 * This said "Settings → Reel → Publishing has Trakt and Mastodon" and
	 * offered one button that opened the settings tab, which is the fault the
	 * walkthroughs exist to fix: the screen knows exactly which two features are
	 * missing and it threw that away to drop you at the top of a tab holding
	 * forty-nine controls.
	 *
	 * Two buttons rather than one, because there genuinely are two answers and
	 * they differ in kind — Trakt is a film profile, Mastodon is a public
	 * post. Choosing between them is the first real decision, and each guide
	 * says what leaves your vault before you commit to anything.
	 */
	private renderNowhere(el: HTMLElement): void {
		el.createDiv({
			cls: "reel-publish-empty",
			text:
				"No publishing destination is set up yet. Trakt puts the review on your film profile; Mastodon " +
				"posts it publicly. Either takes a few minutes, and neither sends anything until you press Publish.",
		});
		const actions = el.createDiv({ cls: "reel-log-actions" });
		for (const id of ["trakt", "mastodon"] as const) {
			const spec = FEATURES.find((f) => f.id === id);
			if (!spec) continue;
			const go = actions.createEl("button", {
				cls: `reel-btn${id === "trakt" ? " mod-cta" : ""}`,
				text: `Set up ${spec.name}`,
			});
			go.addEventListener("click", () => {
				this.close();
				new SetupSheet(this.app, this.plugin, spec).open();
			});
		}
	}

	private renderTargets(el: HTMLElement, targets: TargetInfo[]): void {
		const row = el.createDiv({ cls: "reel-publish-targets" });
		for (const t of targets) {
			const btn = row.createEl("button", { cls: "reel-publish-target" });
			btn.createSpan({ cls: "reel-publish-target-name", text: t.label });

			const already = this.plugin.publish.publishedTo(this.opts.entry)[t.id];
			if (t.blocker) {
				btn.addClass("is-blocked");
				btn.createSpan({ cls: "reel-publish-target-note", text: t.blocker });
				btn.disabled = true;
				continue;
			}
			if (already) {
				// Not disabled. Posting a second review of a rewatch is a real
				// thing people do — this is a warning, not a lock.
				btn.createSpan({ cls: "reel-publish-target-note", text: "Already published once" });
			}

			btn.addEventListener("click", () => {
				if (this.busy) return;
				if (this.chosen.has(t.id)) this.chosen.delete(t.id);
				else this.chosen.add(t.id);
				btn.toggleClass("is-on", this.chosen.has(t.id));
				void this.repaint();
			});
		}
	}

	private renderSpoiler(el: HTMLElement): void {
		const row = el.createDiv({ cls: "reel-publish-spoiler" });
		const btn = row.createEl("button", { cls: "reel-publish-toggle" });
		const paint = () => {
			btn.empty();
			btn.toggleClass("is-on", this.spoiler);
			setIcon(btn.createSpan({ cls: "reel-publish-toggle-icon" }), this.spoiler ? "eye-off" : "eye");
			btn.createSpan({ text: this.spoiler ? "Marked as spoilers" : "No spoilers" });
		};
		paint();
		btn.addEventListener("click", () => {
			this.spoiler = !this.spoiler;
			paint();
			void this.repaint();
		});
		row.createDiv({
			cls: "reel-publish-hint",
			text: "Trakt requires this either way. On Mastodon it goes behind a content warning.",
		});
	}

	/**
	 * Redraw the previews for whatever is currently ticked.
	 *
	 * Async because Mastodon's character limit is a property of the instance and
	 * has to be asked for. The sheet stays usable while that is in flight — a
	 * preview arriving a moment late is fine, a sheet that blocks on a network
	 * call before it will render is not.
	 */
	private async repaint(): Promise<void> {
		if (!this.previewHost) return;
		this.previewHost.empty();
		this.goBtn.disabled = this.chosen.size === 0 || this.busy;

		if (!this.chosen.size) {
			this.previewHost.createDiv({
				cls: "reel-publish-hint",
				text: "Pick where this should go. Nothing is sent until you press Publish.",
			});
			return;
		}

		for (const id of this.chosen) {
			const box = this.previewHost.createDiv({ cls: "reel-publish-preview" });
			const label = id === "trakt" ? "Trakt" : "Mastodon";
			box.createDiv({ cls: "reel-publish-preview-head", text: label });

			const complaint = this.plugin.publish.complaint(this.payload, id);
			if (complaint) {
				box.createDiv({ cls: "reel-publish-warn", text: complaint });
				this.goBtn.disabled = true;
				continue;
			}

			try {
				const composed = await this.plugin.publish.preview(this.payload, id);
				/*
				 * A div rather than a `pre`, for two reasons that agree.
				 *
				 * The `pre` was earning nothing: every default it brings — the
				 * monospace face, the margin, the background, the border, the
				 * refusal to wrap — is overridden in the stylesheet anyway, and
				 * `white-space: pre-wrap` on a div preserves the line breaks, which
				 * is the only part that mattered.
				 *
				 * And the audit treats a stray `pre` as the signature of a screen
				 * that threw, because that is what a crashed sheet renders. Using
				 * the element here would have made this sheet permanently
				 * indistinguishable from a broken one.
				 */
				box.createDiv({ cls: "reel-publish-text", text: composed.text });
				const meta = box.createDiv({ cls: "reel-publish-meta" });
				meta.createSpan({ text: `${composed.text.length} characters` });
				if (composed.truncated) {
					box.createDiv({
						cls: "reel-publish-warn",
						text: "Too long for this instance — the post is cut where you see the ellipsis. The full review stays in your vault.",
					});
				}
				if (id === "trakt" && wordCount(this.opts.text) > TRAKT_REVIEW_WORDS) {
					meta.createSpan({ text: " · filed as a review, not a shout" });
				}
			} catch (e) {
				box.createDiv({ cls: "reel-publish-warn", text: redact(e) });
			}
		}
	}

	private async run(): Promise<void> {
		if (this.busy || !this.chosen.size) return;
		this.busy = true;
		this.goBtn.disabled = true;
		this.goBtn.setText("Publishing…");

		let outcomes: PublishOutcome[] = [];
		try {
			outcomes = await this.plugin.publish.publish(this.payload, [...this.chosen]);
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`, 8000);
			this.busy = false;
			this.goBtn.disabled = false;
			this.goBtn.setText("Publish");
			return;
		}

		this.opts.onDone?.();
		this.renderOutcome(outcomes);
	}

	/**
	 * What happened, per destination, without closing the sheet.
	 *
	 * Closing on success and firing a toast was the first version, and it was
	 * wrong: a toast that says "published" and vanishes leaves you with no way
	 * to get to the thing that was published, and no way to read the one target
	 * that failed while the other worked.
	 */
	private renderOutcome(outcomes: PublishOutcome[]): void {
		const { contentEl } = this;
		contentEl.empty();

		const good = outcomes.filter((o) => o.ok);
		contentEl.createEl("h3", {
			cls: "reel-log-title",
			text: good.length === outcomes.length ? "Published" : good.length ? "Partly published" : "Not published",
		});

		const list = contentEl.createDiv({ cls: "reel-publish-outcomes" });
		for (const o of outcomes) {
			const row = list.createDiv({ cls: `reel-publish-outcome ${o.ok ? "is-ok" : "is-bad"}` });
			setIcon(row.createSpan({ cls: "reel-publish-outcome-icon" }), o.ok ? "check" : "alert-triangle");
			row.createSpan({ cls: "reel-publish-outcome-name", text: o.label });
			if (o.ok && o.url) {
				const link = row.createEl("a", { cls: "reel-publish-outcome-link", text: "View", href: o.url });
				link.setAttr("target", "_blank");
				link.setAttr("rel", "noopener");
			} else if (!o.ok) {
				row.createSpan({ cls: "reel-publish-outcome-why", text: o.error ?? "Failed." });
			}
		}

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const done = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Done" });
		done.addEventListener("click", () => this.close());
		done.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
