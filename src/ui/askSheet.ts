/**
 * Ask — describe what you feel like, get titles you already own.
 *
 * The screen is built around one belief about this kind of feature: the failure
 * you have to design against is not a wrong answer, it is an *unaccountable*
 * one. A box that swallows a sentence and returns five posters is impossible to
 * argue with. When it hands back a war documentary for "something light", there
 * is nowhere to look and nothing to correct, so you stop using it.
 *
 * So the sheet shows its working, in the order the work actually happens:
 *
 *   what it understood you to mean — the restated line, in plain words
 *   what it had to give up on     — "nothing that short, so length was ignored"
 *   how many it looked at         — the shortlist size, so "62 considered"
 *   why each result is there      — one line per title, from the ranking pass
 *
 * That last one is the difference between a recommendation and a suggestion you
 * can evaluate without opening the film.
 *
 * And it says what it cost. Not because tokens are interesting, but because
 * this is the one part of Reel that spends your money, and a feature that
 * quietly bills you is one you are right not to trust.
 */

import { App, Modal, Notice, Platform, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { ask, type AskResult } from "../ai/find";
import { redact } from "../secrets";
import { renderStarsStatic } from "./stars";
import { formatMinutes } from "../util/dates";

/** Kept short. A list of twenty past questions is not a memory, it is clutter. */
const RECENT_LIMIT = 6;

export class AskSheet extends Modal {
	private input!: HTMLTextAreaElement;
	private body!: HTMLElement;
	private goBtn!: HTMLButtonElement;
	private busy = false;

	constructor(
		app: App,
		private plugin: ReelPlugin,
		private onOpenEntry: (entry: Entry) => void,
		private seed = ""
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		contentEl.addClass("reel-ask");

		contentEl.createEl("h3", { cls: "reel-log-title", text: "Ask" });
		contentEl.createDiv({
			cls: "reel-log-sub",
			text: "Describe what you feel like. Reel searches what's already in your library.",
		});

		if (!this.plugin.ai.configured) {
			this.renderUnconfigured(contentEl);
			return;
		}

		this.input = contentEl.createEl("textarea", {
			cls: "reel-ask-input reel-input",
			attr: {
				rows: "3",
				placeholder: "something short and funny I haven't seen, nothing too bleak",
			},
		});
		this.input.value = this.seed;

		// Enter runs it; Shift+Enter is a newline. On a phone the keyboard's
		// return key is the natural way to finish a sentence you have just
		// typed, and making it insert a line break instead is a small
		// infuriating thing that happens every single time.
		this.input.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (ev.key === "Enter" && !ev.shiftKey) {
				ev.preventDefault();
				void this.run();
			}
		});

		this.renderRecent(contentEl);

		const actions = contentEl.createDiv({ cls: "reel-log-actions" });
		const cancel = actions.createEl("button", { cls: "reel-btn", text: "Close" });
		cancel.addEventListener("click", () => this.close());
		this.goBtn = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Ask" });
		this.goBtn.addEventListener("click", () => void this.run());

		this.body = contentEl.createDiv({ cls: "reel-ask-body" });

		window.setTimeout(() => this.input.focus(), 40);
		if (this.seed) void this.run();
	}

	private renderUnconfigured(el: HTMLElement): void {
		el.createDiv({
			cls: "reel-ask-empty",
			text:
				"Ask needs an OpenRouter key, and it's off until you add one. " +
				"When it's on, a question sends a short list of titles from your library — names, years, genres, " +
				"runtimes and your ratings — to OpenRouter. No review text, no dates, no file paths.",
		});
		const actions = el.createDiv({ cls: "reel-log-actions" });
		const go = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Open settings" });
		go.addEventListener("click", () => {
			this.close();
			const setting = (this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting;
			setting.open();
			setting.openTabById("reel");
		});
	}

	/**
	 * Questions you asked before, as one-tap buttons.
	 *
	 * A good question here is a reusable one — "something to fall asleep to" is
	 * a mood that recurs — and retyping it on a phone every time is exactly the
	 * friction that stops a feature from being used.
	 */
	private renderRecent(el: HTMLElement): void {
		const recent = this.plugin.settings.recentAsks;
		if (!recent.length) return;
		const row = el.createDiv({ cls: "reel-ask-recent" });
		for (const q of recent.slice(0, RECENT_LIMIT)) {
			const chip = row.createEl("button", { cls: "reel-ask-chip", text: q });
			chip.addEventListener("click", () => {
				this.input.value = q;
				void this.run();
			});
		}
	}

	private async run(): Promise<void> {
		const question = this.input.value.trim();
		if (!question || this.busy) return;

		this.busy = true;
		this.goBtn.disabled = true;
		this.goBtn.setText("Thinking…");
		this.body.empty();
		this.renderThinking();

		try {
			const entries = this.plugin.library.all();
			const result = await ask(this.plugin.ai, entries, question, {
				shortlistSize: this.plugin.settings.aiShortlist,
			});
			await this.remember(question);
			this.renderResult(result, entries.length);
		} catch (e) {
			this.body.empty();
			this.body.createDiv({ cls: "reel-ask-error", text: redact(e) });
		} finally {
			this.busy = false;
			this.goBtn.disabled = false;
			this.goBtn.setText("Ask");
		}
	}

	private renderThinking(): void {
		const box = this.body.createDiv({ cls: "reel-ask-thinking" });
		box.createDiv({ cls: "reel-ask-spinner" });
		box.createSpan({ text: "Reading the question, then your library…" });
	}

	private async remember(question: string): Promise<void> {
		const list = this.plugin.settings.recentAsks.filter((q) => q.toLowerCase() !== question.toLowerCase());
		list.unshift(question);
		this.plugin.settings.recentAsks = list.slice(0, RECENT_LIMIT);
		await this.plugin.saveSettings();
	}

	private renderResult(result: AskResult, libraryTotal: number): void {
		this.body.empty();

		if (result.criteria.restated) {
			const line = this.body.createDiv({ cls: "reel-ask-understood" });
			setIcon(line.createSpan({ cls: "reel-ask-understood-icon" }), "quote");
			line.createSpan({ text: result.criteria.restated });
		}

		if (result.relaxed.length) {
			this.body.createDiv({
				cls: "reel-ask-relaxed",
				text: `Nothing in your library matched on ${list(result.relaxed)}, so that was set aside.`,
			});
		}

		if (!result.picks.length) {
			this.body.createDiv({
				cls: "reel-ask-empty",
				text:
					result.considered === 0
						? "Nothing in your library fits that, even loosely. Try asking for less at once."
						: "Nothing came back. Try putting it a different way.",
			});
			this.renderCost(result, libraryTotal);
			return;
		}

		const list_ = this.body.createDiv({ cls: "reel-ask-results" });
		for (const pick of result.picks) {
			this.renderPick(list_, pick.entry, pick.why);
		}

		this.renderCost(result, libraryTotal);
	}

	private renderPick(host: HTMLElement, entry: Entry, why: string): void {
		const row = host.createDiv({ cls: "reel-ask-result" });
		row.setAttr("role", "button");
		row.setAttr("tabindex", "0");
		row.setAttr("aria-label", `${entry.title}. ${why}`);

		const thumb = row.createDiv({ cls: "reel-ask-thumb" });
		this.plugin.posters.attach(thumb, entry);

		const body = row.createDiv({ cls: "reel-ask-result-body" });
		const title = body.createDiv({ cls: "reel-ask-result-title" });
		title.createSpan({ text: entry.title });
		const year = entry.type === "tv" ? entry.firstAirYear : entry.year;
		if (year) title.createSpan({ cls: "reel-dim", text: ` ${year}` });

		if (why) body.createDiv({ cls: "reel-ask-why", text: why });

		const facts = body.createDiv({ cls: "reel-ask-facts" });
		const mins = entry.type === "tv" ? entry.episodeRuntime : entry.runtime;
		if (mins) facts.createSpan({ text: formatMinutes(mins) });
		if (entry.genres.length) facts.createSpan({ text: entry.genres.slice(0, 2).join(", ") });
		if (entry.rating != null) renderStarsStatic(facts, entry.rating);

		const open = () => {
			this.close();
			this.onOpenEntry(entry);
		};
		row.addEventListener("click", open);
		row.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (ev.key === "Enter" || ev.key === " ") {
				ev.preventDefault();
				open();
			}
		});
	}

	/**
	 * What it looked at and what it cost.
	 *
	 * Deliberately unglamorous and deliberately present. "62 of 431 considered"
	 * is the line that tells you whether the shortlist was the bottleneck, and
	 * the token count is the line that tells you this is not free.
	 */
	private renderCost(result: AskResult, libraryTotal: number): void {
		const foot = this.body.createDiv({ cls: "reel-ask-cost" });
		foot.createSpan({ text: `${result.considered} of ${libraryTotal} considered` });
		const tokens = result.promptTokens + result.completionTokens;
		if (tokens) foot.createSpan({ text: `${tokens.toLocaleString()} tokens · ${this.plugin.settings.aiModel}` });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function list(items: string[]): string {
	if (items.length === 1) return items[0];
	return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Convenience for the command palette and the toolbar button. */
export function openAsk(plugin: ReelPlugin, onOpenEntry: (entry: Entry) => void, seed = ""): void {
	if (!plugin.settings.aiEnabled && !plugin.credentials.has("openrouter")) {
		new Notice("Reel: Ask needs an OpenRouter key. Settings → Reel → Ask.", 6000);
	}
	new AskSheet(plugin.app, plugin, onOpenEntry, seed).open();
}
