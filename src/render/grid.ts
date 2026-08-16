/**
 * Shared poster grid and row list.
 *
 * Both the ```films``` code block and the Reel view draw titles. Keeping one
 * renderer means a fix to the long-press handling or the progress bar lands in
 * both, instead of drifting until they behave subtly differently.
 */

import { Notice, TFile } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { renderStarsStatic } from "../ui/stars";
import { QuickRate } from "../ui/quickRate";
import { lastWatchDate } from "./query";
import { prettyDate } from "../util/dates";
import { rangeCount } from "../util/ranges";

function placeholder(parent: HTMLElement, entry: Entry): void {
	parent.addClass("is-empty");
	parent.createSpan({ cls: "reel-placeholder-text", text: entry.title.slice(0, 2) });
}

/**
 * Tap opens the note; long-press (or right-click) quick-rates.
 *
 * 500ms with an 8px movement threshold, so a scroll that starts on a poster
 * never fires the rating sheet — the single most annoying way to get this
 * wrong on a touch screen.
 */
function wireCell(plugin: ReelPlugin, cell: HTMLElement, entry: Entry): void {
	let timer: number | null = null;
	let longPressed = false;
	let startY = 0;

	const cancel = () => {
		if (timer != null) window.clearTimeout(timer);
		timer = null;
	};

	const quickRate = () => {
		longPressed = true;
		const file = plugin.app.vault.getAbstractFileByPath(entry.path);
		if (file instanceof TFile) new QuickRate(plugin, entry, file).open();
	};

	cell.addEventListener("pointerdown", (e) => {
		longPressed = false;
		startY = e.clientY;
		timer = window.setTimeout(quickRate, 500);
	});
	cell.addEventListener("pointermove", (e) => {
		if (Math.abs(e.clientY - startY) > 8) cancel();
	});
	cell.addEventListener("pointerup", cancel);
	cell.addEventListener("pointercancel", cancel);
	cell.addEventListener("pointerleave", cancel);

	cell.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		cancel();
		quickRate();
	});

	cell.addEventListener("click", async () => {
		if (longPressed) {
			longPressed = false;
			return;
		}
		const file = plugin.app.vault.getAbstractFileByPath(entry.path);
		if (file instanceof TFile) await plugin.app.workspace.getLeaf(false).openFile(file);
		else new Notice("Reel: note not found.");
	});

	cell.addEventListener("keydown", (e) => {
		if (e.key !== "Enter") return;
		const file = plugin.app.vault.getAbstractFileByPath(entry.path);
		if (file instanceof TFile) plugin.app.workspace.getLeaf(false).openFile(file);
	});
}

export function renderPosterGrid(plugin: ReelPlugin, el: HTMLElement, rows: Entry[]): void {
	const grid = el.createDiv({ cls: "reel-grid" });
	for (const entry of rows) {
		const cell = grid.createDiv({ cls: "reel-cell" });
		cell.setAttr("role", "button");
		cell.setAttr("tabindex", "0");
		cell.setAttr("aria-label", entry.title);

		const posterEl = cell.createDiv({ cls: "reel-cell-poster" });
		const src = plugin.posters.resourcePath(entry.poster);
		if (src) {
			const img = posterEl.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
			img.addEventListener("error", () => {
				img.remove();
				placeholder(posterEl, entry);
			});
		} else {
			placeholder(posterEl, entry);
		}

		if (entry.rating != null) {
			renderStarsStatic(posterEl.createDiv({ cls: "reel-cell-rating" }), entry.rating);
		}
		if (entry.liked) posterEl.createDiv({ cls: "reel-cell-heart", text: "♥" });
		if (entry.status === "watchlist") posterEl.createDiv({ cls: "reel-cell-flag", text: "Watchlist" });
		if (entry.certification) posterEl.createDiv({ cls: "reel-cell-cert", text: entry.certification });

		if (entry.type === "tv") {
			const total = entry.totalEpisodes ?? 0;
			const seen = entry.seasons.reduce((n, s) => n + rangeCount(s.watched), 0);
			if (total && seen && seen < total) {
				const bar = posterEl.createDiv({ cls: "reel-cell-progress" });
				bar.setCssProps({ "--reel-fill": String(seen / total) });
			}
		}

		const caption = cell.createDiv({ cls: "reel-cell-caption" });
		caption.createDiv({ cls: "reel-cell-title", text: entry.title });
		const y = entry.year ?? entry.firstAirYear;
		if (y) caption.createDiv({ cls: "reel-cell-year", text: String(y) });

		wireCell(plugin, cell, entry);
	}
}

export function renderRowList(plugin: ReelPlugin, el: HTMLElement, rows: Entry[], compact = false): void {
	const list = el.createDiv({ cls: "reel-list" });
	for (const entry of rows) {
		const row = list.createDiv({ cls: "reel-row" });
		row.setAttr("role", "button");
		row.setAttr("tabindex", "0");

		if (!compact) {
			const thumb = row.createDiv({ cls: "reel-row-thumb" });
			const src = plugin.posters.resourcePath(entry.poster);
			if (src) thumb.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
			else placeholder(thumb, entry);
		}

		const body = row.createDiv({ cls: "reel-row-body" });
		const title = body.createDiv({ cls: "reel-row-title" });
		title.createSpan({ text: entry.title });
		const y = entry.year ?? entry.firstAirYear;
		if (y) title.createSpan({ cls: "reel-dim", text: ` ${y}` });

		const meta = body.createDiv({ cls: "reel-row-meta" });
		const when = lastWatchDate(entry);
		if (when) meta.createSpan({ text: prettyDate(when) });
		if (entry.rating != null) renderStarsStatic(meta, entry.rating);
		if (entry.type === "tv" && entry.lastWatched) {
			meta.createSpan({ text: `S${entry.lastWatched.season}E${entry.lastWatched.episode}` });
		}

		wireCell(plugin, row, entry);
	}
}
