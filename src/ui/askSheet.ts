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

import { App, Modal, Platform, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { ask, type AskResult } from "../ai/find";
import { redact } from "../secrets";
import { renderStarsStatic } from "./stars";
import { formatMinutes } from "../util/dates";
import { FEATURES } from "../setup";
import { SetupSheet } from "./setupSheet";

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

		/*
		 * The answer goes above the buttons, not below them.
		 *
		 * This was the other way round, which nobody could see until the result
		 * list was first rendered in the harness: asking a question left the
		 * Close and Ask buttons stranded in the middle of the sheet with the
		 * three recommendations underneath them. The buttons are the least
		 * important thing on the screen once an answer exists, and they were
		 * sitting in front of it.
		 *
		 * Nothing moves in the resting state — the body is empty before you
		 * ask, so this is the same sheet until there is something to read.
		 */
		this.body = contentEl.createDiv({ cls: "reel-ask-body" });

		const actions = contentEl.createDiv({ cls: "reel-log-actions reel-ask-actions" });
		const cancel = actions.createEl("button", { cls: "reel-btn", text: "Close" });
		cancel.addEventListener("click", () => this.close());
		this.goBtn = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Ask" });
		this.goBtn.addEventListener("click", () => void this.run());

		window.setTimeout(() => this.input.focus(), 40);
		if (this.seed) void this.run();
	}

	/**
	 * The screen every new install meets when it opens Ask.
	 *
	 * Two faults lived here, both invisible until it was rendered for the first
	 * time, because `configured` was pinned true in the test rig.
	 *
	 * The first: `configured` is two conditions — a saved key *and* the switch
	 * — and this treated it as one. Somebody who had pasted a key and never
	 * found the toggle was told Ask needs a key. They had one. That is the
	 * 0.9.20 gap arriving one screen later: a saved key reads as set up
	 * everywhere in the plugin, and the one screen positioned to catch the
	 * difference repeated the wrong half of it.
	 *
	 * The second: it opened the settings tab. That is the exact fault the
	 * walkthroughs were built to fix — the guide has the key field, the switch
	 * beside it, the three steps for getting a key, and a check that proves it
	 * works before you leave. Sending somebody to hunt for one section among
	 * forty-nine controls, from a screen that knows precisely which feature is
	 * missing, is losing information on purpose.
	 */
	private renderUnconfigured(el: HTMLElement): void {
		const hasKey = this.plugin.credentials.has("openrouter");

		el.createDiv({
			cls: "reel-ask-empty",
			text: hasKey
				? "Your OpenRouter key is saved, but Ask is switched off, so no question is ever sent. " +
					"Turning it on is one toggle — and while it is on, a question sends a short list of titles from " +
					"your library: names, years, genres, runtimes and your ratings. No review text, no dates, no " +
					"file paths."
				: "Ask needs an OpenRouter key, and it stays off until you add one. " +
					"When it is on, a question sends a short list of titles from your library — names, years, genres, " +
					"runtimes and your ratings — to OpenRouter. No review text, no dates, no file paths.",
		});

		const actions = el.createDiv({ cls: "reel-log-actions" });
		const spec = FEATURES.find((f) => f.id === "openrouter");
		if (!spec) return;
		const go = actions.createEl("button", {
			cls: "reel-btn mod-cta",
			text: hasKey ? "Turn Ask on" : "Set up Ask",
		});
		go.addEventListener("click", () => {
			this.close();
			// The guide redraws itself as you finish steps, so `onDone` only has
			// to reopen Ask once it can actually run.
			new SetupSheet(this.app, this.plugin, spec, () => {
				if (this.plugin.ai.configured) new AskSheet(this.app, this.plugin, this.onOpenEntry, "").open();
			}).open();
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

/**
 * The one way to open Ask, used by both things that open it.
 *
 * It used to fire a Notice first when no key was configured, which duplicated
 * — badly, in eight words — the paragraph the sheet itself renders explaining
 * what Ask sends and where. Two copies of the same explanation is how one of
 * them ends up wrong; the sheet's is the better one, so it is the only one.
 */
export function openAsk(plugin: ReelPlugin, onOpenEntry: (entry: Entry) => void, seed = ""): void {
	new AskSheet(plugin.app, plugin, onOpenEntry, seed).open();
}
