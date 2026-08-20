/**
 * Upcoming episodes.
 *
 * Reads `next_air_date`, which the daily refresh keeps current for shows TMDB
 * marks as returning. No extra API calls happen here — this is a view over
 * frontmatter, like everything else.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from "obsidian";
import { upnextTitle } from "./upnext";
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
		const paint = () => paintUpcoming(this.plugin, this.containerEl, this.withinDays, true);
		paint();
		this.registerEvent(this.plugin.library.on("changed", paint));
	}
}

/**
 * Shared by the code block and the Up next tab.
 *
 * `quiet` returns without rendering anything when there's nothing scheduled —
 * an empty "Upcoming" heading under a populated Up Next list is just noise.
 */
export function paintUpcoming(
	plugin: ReelPlugin,
	containerEl: HTMLElement,
	withinDays?: number,
	showEmpty = false
): void {
	new CalendarPainter(plugin, containerEl, withinDays, showEmpty).render();
}

class CalendarPainter {
	constructor(
		private plugin: ReelPlugin,
		private containerEl: HTMLElement,
		private withinDays?: number,
		private showEmpty = false
	) {}

	render(): void {
		const el = this.containerEl;
		el.empty();

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
			if (this.showEmpty) {
				el.createDiv({ cls: "reel-block-title", text: "Upcoming" });
				el.createDiv({ cls: "reel-empty", text: "Nothing scheduled. Only shows TMDB lists as returning appear here." });
			}
			return;
		}

		el.createDiv({ cls: "reel-block-title", text: "Upcoming" });
		const list = el.createDiv({ cls: "reel-upnext" });
		for (const entry of rows) list.appendChild(this.row(entry, today));
	}

	private row(entry: Entry, today: string): HTMLElement {
		const row = createDiv({ cls: "reel-upnext-row" });

		const thumb = row.createDiv({ cls: "reel-upnext-thumb" });
		this.plugin.posters.attach(thumb, entry);

		const body = row.createDiv({ cls: "reel-upnext-body" });
		// Shared with Up Next, so a long series name elides here too. Setting
		// the text directly on the row put it in a flex container with nothing
		// to elide, and these titles were still being cut mid-word after the
		// same bug was fixed on the other screen.
		upnextTitle(body, entry.title);

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
