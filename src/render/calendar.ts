/**
 * Upcoming episodes.
 *
 * Reads `next_air_date`, which the daily refresh keeps current for shows TMDB
 * marks as returning. No extra API calls happen here — this is a view over
 * frontmatter, like everything else.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { daysBetween, prettyDate, todayISO } from "../util/dates";

export function registerCalendarBlock(plugin: ReelPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"upcoming",
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const days = parseInt((source.match(/days:\s*(\d+)/) ?? [])[1] ?? "0", 10);
			ctx.addChild(new CalendarBlock(plugin, el, days || undefined));
		}
	);
}

class CalendarBlock extends MarkdownRenderChild {
	constructor(
		private plugin: ReelPlugin,
		containerEl: HTMLElement,
		private withinDays?: number
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
		el.createDiv({ cls: "reel-block-title", text: "Upcoming" });

		const today = todayISO();
		const rows = this.plugin
			.visible(this.plugin.library.shows())
			.filter((e) => !!e.nextAirDate && e.status !== "dropped")
			.filter((e) => {
				if (!this.withinDays) return true;
				const gap = daysBetween(today, e.nextAirDate!);
				return Number.isFinite(gap) && gap <= this.withinDays;
			})
			.sort((a, b) => (a.nextAirDate ?? "").localeCompare(b.nextAirDate ?? ""));

		if (!rows.length) {
			el.createDiv({ cls: "reel-empty", text: "Nothing scheduled. Only shows TMDB lists as returning appear here." });
			return;
		}

		const list = el.createDiv({ cls: "reel-upnext" });
		for (const entry of rows) list.appendChild(this.row(entry, today));
	}

	private row(entry: Entry, today: string): HTMLElement {
		const row = createDiv({ cls: "reel-upnext-row" });

		const thumb = row.createDiv({ cls: "reel-upnext-thumb" });
		const src = this.plugin.posters.resourcePath(entry.poster);
		if (src) thumb.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
		else {
			thumb.addClass("is-empty");
			thumb.createSpan({ text: entry.title.slice(0, 2) });
		}

		const body = row.createDiv({ cls: "reel-upnext-body" });
		body.createDiv({ cls: "reel-upnext-title", text: entry.title });

		const gap = daysBetween(today, entry.nextAirDate!);
		const meta = body.createDiv({ cls: "reel-upnext-meta" });
		// "Today" and "Tomorrow" read faster than a date you have to decode.
		const when = gap === 0 ? "Today" : gap === 1 ? "Tomorrow" : gap > 0 ? `In ${gap} days` : "Aired";
		meta.createSpan({ cls: "reel-upnext-ep", text: when });
		meta.createSpan({ cls: "reel-dim", text: prettyDate(entry.nextAirDate) });

		if (gap <= 0) body.createDiv({ cls: "reel-badge new", text: "Out now" });

		row.addEventListener("click", async () => {
			const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile) await this.plugin.app.workspace.getLeaf(false).openFile(file);
		});

		return row;
	}
}
