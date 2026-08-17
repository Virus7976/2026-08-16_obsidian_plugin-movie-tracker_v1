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
import { haptic } from "../util/haptics";
import { renderEmpty } from "../ui/empty";
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
			// The library may be full and simply have nothing part-watched, or
			// it may be a fresh install. Those want different offers, and the
			// old single sentence made the same one to both.
			const bare = !this.plugin.library.shows().length;
			renderEmpty(el, {
				icon: "tv",
				title: bare ? "No series yet" : "Nothing part-watched",
				body: bare
					? "Add a series and this becomes the screen you open every night — one row per show, one tap to tick the next episode."
					: "Every series you have is either finished or not started. Tick an episode and it appears here.",
				actions: [
					{
						label: bare ? "Find a series" : "Add a series",
						primary: true,
						onClick: () => this.plugin.openSearch(),
					},
				],
			});
			return;
		}

		const list = el.createDiv({ cls: "reel-upnext" });
		if (hidden > 0) {
			const more = el.createDiv({ cls: "reel-block-count" });
			const btn = more.createEl("button", { cls: "reel-chip", text: `Show ${hidden} more` });
			btn.addEventListener("click", () => {
				// Append the rest rather than re-rendering: this painter is
				// rebuilt on every library event, so any state set on it would
				// be discarded the next time anything changed.
				for (const entry of everything.slice(cap)) list.appendChild(this.row(entry));
				more.remove();
			});
		}
		for (const entry of rows) list.appendChild(this.row(entry));
	}

	/** One row. Detached, so it can be appended lazily by 'show more'. */
	private row(entry: Entry): HTMLElement {
		const next = this.plugin.upNext.nextFor(entry);
		const row = createDiv({ cls: "reel-upnext-row" });

		const thumb = row.createDiv({ cls: "reel-upnext-thumb" });
		this.plugin.posters.attach(thumb, entry);
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
			const tick = actions.createEl("button", {
				cls: "reel-tick",
				text: "✓",
				attr: { type: "button" },
			});
			tick.setAttr("aria-label", `Mark S${next.season}E${next.episode} watched`);
			tick.addEventListener("click", async (e) => {
				e.stopPropagation();
				const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
				if (!(file instanceof TFile)) return;
				// The signature interaction of the whole app — one thumb, one
				// tap, a row at a time. It is the one that most wants a tick.
				haptic("tick");
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
		return row;
	}
}
