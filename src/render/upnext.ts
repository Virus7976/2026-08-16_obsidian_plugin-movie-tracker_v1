/**
 * Up Next — the screen with no film equivalent, and the one you'd open daily.
 *
 * Every row is one show you're partway through, and the whole row is a single
 * action: tap the button, the range extends by one, `last_watched` moves, done.
 * No modal, no navigation, one thumb.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { nextEpisode, rangeCount } from "../util/ranges";
import { prettyDate, todayISO } from "../util/dates";
import { redact } from "../secrets";
import { SeasonSheet } from "../ui/seasonSheet";

export interface NextUp {
	season: number;
	episode: number;
}

export class UpNextService {
	constructor(private plugin: ReelPlugin) {}

	/**
	 * The next episode to watch: first gap in the earliest incomplete season,
	 * otherwise episode 1 of the next season that has any episodes at all.
	 */
	nextFor(entry: Entry): NextUp | null {
		if (entry.type !== "tv") return null;
		const seasons = [...entry.seasons].sort((a, b) => a.n - b.n);
		for (const s of seasons) {
			const total = (s as { total?: number }).total ?? 0;
			const seen = rangeCount(s.watched);
			if (total && seen >= total) continue;
			const next = nextEpisode(s.watched, total);
			if (next != null) return { season: s.n, episode: next };
		}
		return null;
	}

	/** Shows with an episode airing today or already waiting unwatched. */
	airingToday(entry: Entry): boolean {
		return !!entry.nextAirDate && entry.nextAirDate <= todayISO();
	}
}

export function registerUpNextBlock(plugin: ReelPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"up-next",
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const limit = parseInt((source.match(/limit:\s*(\d+)/) ?? [])[1] ?? "0", 10);
			ctx.addChild(new UpNextBlock(plugin, el, limit || undefined));
		}
	);
}

class UpNextBlock extends MarkdownRenderChild {
	constructor(
		private plugin: ReelPlugin,
		containerEl: HTMLElement,
		private limit?: number
	) {
		super(containerEl);
	}

	onload(): void {
		this.containerEl.addClass("reel-block");
		const paint = () => paintUpNext(this.plugin, this.containerEl, this.limit, true);
		paint();
		this.registerEvent(this.plugin.library.on("changed", paint));
	}
}

/** Shared by the code block and the Reel view. */
export function paintUpNext(plugin: ReelPlugin, containerEl: HTMLElement, limit?: number, heading = false): void {
	new UpNextPainter(plugin, containerEl, limit, heading).render();
}

class UpNextPainter {
	constructor(
		private plugin: ReelPlugin,
		private containerEl: HTMLElement,
		private limit?: number,
		private heading = false
	) {}

	render(): void {
		const el = this.containerEl;
		el.empty();
		if (this.heading) el.createDiv({ cls: "reel-block-title", text: "Up next" });

		const everything = this.plugin.visible(this.plugin.library.inProgress());
		// Up Next answers "what do I watch tonight", so a long tail of shows
		// you last touched months ago is noise. The rest stay one tap away.
		const cap = this.limit ?? 12;
		let rows = everything.slice(0, cap);
		const hidden = everything.length - rows.length;

		if (!rows.length) {
			el.createDiv({ cls: "reel-empty", text: "Nothing in progress. Add a series and tick an episode." });
			return;
		}

		const list = el.createDiv({ cls: "reel-upnext" });
		if (hidden > 0) {
			const more = el.createDiv({ cls: "reel-block-count" });
			const btn = more.createEl("button", { cls: "reel-chip", text: `Show ${hidden} more` });
			btn.addEventListener("click", () => {
				rows = everything;
				this.limit = everything.length;
				this.render();
			});
		}
		for (const entry of rows) {
			const next = this.plugin.upNext.nextFor(entry);
			const row = list.createDiv({ cls: "reel-upnext-row" });

			const thumb = row.createDiv({ cls: "reel-upnext-thumb" });
			const src = this.plugin.posters.displayUrl(entry);
			if (src) thumb.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
			else {
				thumb.addClass("is-empty");
				thumb.createSpan({ text: entry.title.slice(0, 2) });
			}
			// Opens the detail screen rather than the raw note — the note in
			// Live Preview shows frontmatter, not the season strip.
			thumb.addEventListener("click", () => void this.plugin.openDetail(entry));

			const body = row.createDiv({ cls: "reel-upnext-body" });
			const title = body.createDiv({ cls: "reel-upnext-title" });
			title.createSpan({ text: entry.title });
			if (this.plugin.upNext.airingToday(entry)) {
				title.createSpan({ cls: "reel-badge new", text: "New" });
			}

			const total = entry.totalEpisodes ?? 0;
			const seen = entry.seasons.reduce((n, s) => n + rangeCount(s.watched), 0);

			const meta = body.createDiv({ cls: "reel-upnext-meta" });
			if (next) meta.createSpan({ cls: "reel-upnext-ep", text: `S${next.season}E${next.episode}` });
			else meta.createSpan({ cls: "reel-dim", text: "All caught up" });
			// How far through, in words as well as a bar — a 3px bar alone is
			// not readable at a glance, and the count is the useful number.
			if (total) meta.createSpan({ cls: "reel-dim", text: `${seen}/${total} · ${Math.round((seen / total) * 100)}%` });
			if (entry.lastWatched?.date) meta.createSpan({ cls: "reel-dim", text: prettyDate(entry.lastWatched.date) });

			if (total) {
				const bar = body.createDiv({ cls: "reel-progress" });
				bar.setCssProps({ "--reel-fill": String(Math.min(1, seen / total)) });
				bar.setAttr("aria-label", `${seen} of ${total} episodes`);
			}

			const actions = row.createDiv({ cls: "reel-upnext-actions" });
			if (next) {
				const tick = actions.createEl("button", { cls: "reel-tick", text: "✓" });
				tick.setAttr("aria-label", `Mark S${next.season}E${next.episode} watched`);
				tick.addEventListener("click", async (e) => {
					e.stopPropagation();
					const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
					if (!(file instanceof TFile)) return;
					tick.setAttr("disabled", "true");
					try {
						await this.plugin.notes.markEpisode(file, next.season, next.episode);
					} catch (err) {
						new Notice(`Reel: ${redact(err)}`);
						tick.removeAttribute("disabled");
					}
				});
			}
			const more = actions.createEl("button", { cls: "reel-more", text: "⋯" });
			more.setAttr("aria-label", "Open season");
			more.addEventListener("click", (e) => {
				e.stopPropagation();
				new SeasonSheet(this.plugin.app, this.plugin, entry, next?.season ?? 1).open();
			});
		}
	}
}
