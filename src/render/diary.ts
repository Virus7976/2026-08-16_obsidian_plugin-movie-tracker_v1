/**
 * The diary — every viewing, newest first, grouped by month.
 *
 * The library grid shows *titles*; this shows *viewings*. That's the whole
 * distinction, and it's why the watch history is an array: a film seen twice
 * appears in the grid once, at its most recent date, and the earlier viewing is
 * invisible anywhere else. Here it gets its own row.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { prettyDate } from "../util/dates";
import { renderStarsStatic } from "../ui/stars";

interface Viewing {
	entry: Entry;
	date: string;
	rating?: number;
	rewatch: boolean;
}

export function registerDiaryBlock(plugin: ReelPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"diary",
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			ctx.addChild(new DiaryBlock(plugin, el, parseOptions(source)));
		}
	);
}

interface DiaryOptions {
	year?: number;
	limit?: number;
}

function parseOptions(source: string): DiaryOptions {
	const opts: DiaryOptions = {};
	for (const line of source.split("\n")) {
		const [k, v] = line.split(":").map((s) => s?.trim().toLowerCase());
		if (!k || !v) continue;
		if (k === "year" && /^\d{4}$/.test(v)) opts.year = parseInt(v, 10);
		if (k === "limit") {
			const n = parseInt(v, 10);
			if (Number.isFinite(n) && n > 0) opts.limit = n;
		}
	}
	return opts;
}

/** Flatten every film's watch history into one dated stream. */
export function viewings(entries: Entry[], year?: number): Viewing[] {
	const out: Viewing[] = [];
	for (const entry of entries) {
		for (const w of entry.watched) {
			if (!w.date) continue;
			if (year && !w.date.startsWith(String(year))) continue;
			out.push({ entry, date: w.date, rating: w.rating ?? undefined, rewatch: w.rewatch === true });
		}
	}
	return out.sort((a, b) => b.date.localeCompare(a.date));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

class DiaryBlock extends MarkdownRenderChild {
	constructor(
		private plugin: ReelPlugin,
		containerEl: HTMLElement,
		private opts: DiaryOptions
	) {
		super(containerEl);
	}

	onload(): void {
		this.containerEl.addClass("reel-block");
		this.render();
		this.registerEvent(this.plugin.library.on("changed", () => this.render()));
	}

	private render(): void {
		const el = this.containerEl;
		el.empty();

		const visible = this.plugin.visible(this.plugin.library.all());
		let rows = viewings(visible, this.opts.year);
		if (this.opts.limit) rows = rows.slice(0, this.opts.limit);

		if (!rows.length) {
			el.createDiv({ cls: "reel-empty", text: "No viewings logged yet." });
			return;
		}

		el.createDiv({
			cls: "reel-block-count",
			text: `${rows.length} viewing${rows.length === 1 ? "" : "s"}`,
		});

		const list = el.createDiv({ cls: "reel-diary" });
		let currentMonth = "";

		for (const v of rows) {
			const month = v.date.slice(0, 7);
			if (month !== currentMonth) {
				currentMonth = month;
				const [y, m] = month.split("-");
				list.createDiv({
					cls: "reel-diary-month",
					text: `${MONTHS[parseInt(m, 10) - 1]} ${y}`,
				});
			}

			const row = list.createDiv({ cls: "reel-diary-row" });
			row.setAttr("role", "button");
			row.setAttr("tabindex", "0");

			row.createDiv({ cls: "reel-diary-day", text: String(parseInt(v.date.slice(8, 10), 10)) });

			const thumb = row.createDiv({ cls: "reel-diary-thumb" });
			const src = this.plugin.posters.resourcePath(v.entry.poster);
			if (src) thumb.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
			else {
				thumb.addClass("is-empty");
				thumb.createSpan({ text: v.entry.title.slice(0, 2) });
			}

			const body = row.createDiv({ cls: "reel-diary-body" });
			const title = body.createDiv({ cls: "reel-diary-title" });
			title.createSpan({ text: v.entry.title });
			if (v.entry.year) title.createSpan({ cls: "reel-dim", text: ` ${v.entry.year}` });

			const meta = body.createDiv({ cls: "reel-diary-meta" });
			if (v.rating != null) renderStarsStatic(meta, v.rating);
			if (v.rewatch) meta.createSpan({ cls: "reel-badge subtle", text: "rewatch" });
			meta.createSpan({ cls: "reel-dim", text: prettyDate(v.date) });

			row.addEventListener("click", async () => {
				const file = this.plugin.app.vault.getAbstractFileByPath(v.entry.path);
				if (file instanceof TFile) await this.plugin.app.workspace.getLeaf(false).openFile(file);
			});
		}
	}
}
