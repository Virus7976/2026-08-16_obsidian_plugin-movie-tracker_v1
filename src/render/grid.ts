/**
 * Shared poster grid and row list.
 *
 * Both the ```films``` code block and the Reel view draw titles. Keeping one
 * renderer means a fix to the long-press handling or the progress bar lands in
 * both, instead of drifting until they behave subtly differently.
 */

import { Menu, Notice, TFile, setIcon } from "obsidian";
import { redact } from "../secrets";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { renderStarsStatic } from "../ui/stars";
import { QuickRate } from "../ui/quickRate";
import { ListPicker } from "../ui/listPicker";
import { haptic } from "../util/haptics";
import { lastWatchDate } from "./query";
import { prettyDate, formatMinutes } from "../util/dates";
import { rangeCount } from "../util/ranges";
import { compactCount } from "../util/format";
import { unlink } from "../library";
import { showTitleMenu } from "../ui/titleMenu";

/**
 * Tap opens the title; long-press (or right-click) opens the actions menu.
 *
 * 500ms with an 8px movement threshold, so a scroll that starts on a poster
 * never fires the menu — the single most annoying way to get this wrong on a
 * touch screen. The threshold is on both axes: guarding only the vertical let
 * a sideways swipe through a carousel trip it.
 *
 * The long-press used to go straight to the rating sheet, which is one action
 * out of the six you might want and no way to reach the others without
 * opening the title first.
 */
function wireCell(plugin: ReelPlugin, cell: HTMLElement, entry: Entry, onSelect?: (e: Entry) => void): void {
	let timer: number | null = null;
	let longPressed = false;
	let startX = 0;
	let startY = 0;

	const cancel = () => {
		if (timer != null) window.clearTimeout(timer);
		timer = null;
		cell.removeClass("is-holding");
	};

	const openMenu = (x: number, y: number) => {
		longPressed = true;
		cell.removeClass("is-holding");
		// Confirms the press landed *before* the menu paints. Without it the
		// only feedback is the menu itself, so a press that was a fraction too
		// short is indistinguishable from one the app ignored.
		haptic("hold");
		showTitleMenu(plugin, entry, x, y, { onSelect });
	};

	cell.addEventListener("pointerdown", (e) => {
		longPressed = false;
		startX = e.clientX;
		startY = e.clientY;
		// A slow shrink under the finger, so the wait is visibly doing
		// something rather than feeling like a delay before a surprise.
		cell.addClass("is-holding");
		timer = window.setTimeout(() => openMenu(e.clientX, e.clientY), 500);
	});
	cell.addEventListener("pointermove", (e) => {
		if (Math.abs(e.clientY - startY) > 8 || Math.abs(e.clientX - startX) > 8) cancel();
	});
	cell.addEventListener("pointerup", cancel);
	cell.addEventListener("pointercancel", cancel);
	cell.addEventListener("pointerleave", cancel);

	cell.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		cancel();
		openMenu(e.clientX, e.clientY);
	});

	cell.addEventListener("click", async () => {
		if (longPressed) {
			longPressed = false;
			return;
		}
		// In the Reel view a tap opens the detail screen; elsewhere (a code
		// block inside a note) there is nowhere to put one, so it opens the note.
		if (onSelect) {
			onSelect(entry);
			return;
		}
		const file = plugin.app.vault.getAbstractFileByPath(entry.path);
		if (file instanceof TFile) await plugin.app.workspace.getLeaf(false).openFile(file);
		else new Notice("Reel: note not found.");
	});

	cell.addEventListener("keydown", (e) => {
		if (e.key !== "Enter") return;
		if (onSelect) {
			onSelect(entry);
			return;
		}
		const file = plugin.app.vault.getAbstractFileByPath(entry.path);
		// void: opening a note is fire-and-forget here, but an unhandled
		// rejection would otherwise surface as a console error with no context.
		if (file instanceof TFile) {
			void plugin.app.workspace
				.getLeaf(false)
				.openFile(file)
				.catch((e: unknown) => new Notice(`Reel: ${redact(e)}`));
		}
	});
}

/**
 * Label a title's card for anyone not looking at it.
 *
 * The visible card carries the year, the rating and the status as separate
 * marks; announced one after another those are three unrelated fragments. One
 * sentence is what a person would actually say about the row.
 */
function describe(el: HTMLElement, entry: Entry): void {
	const bits = [entry.title];
	const year = entry.year ?? entry.firstAirYear;
	if (year) bits.push(String(year));
	if (entry.rating != null) bits.push(`rated ${entry.rating} out of 5`);
	if (entry.status === "watchlist") bits.push("on your watchlist");
	el.setAttr("role", "button");
	el.setAttr("tabindex", "0");
	el.setAttr("aria-label", bits.join(", "));
}

export function renderPosterGrid(plugin: ReelPlugin, el: HTMLElement, rows: Entry[], onSelect?: (e: Entry) => void): void {
	const grid = el.createDiv({ cls: "reel-grid" });
	for (const entry of rows) {
		const cell = grid.createDiv({ cls: "reel-cell" });
		cell.dataset.reelPath = entry.path;
		describe(cell, entry);

		const posterEl = cell.createDiv({ cls: "reel-cell-poster" });
		plugin.posters.attach(posterEl, entry);

		/*
		 * Four fixed corners, the same on every card.
		 *   top left      content rating
		 *   top right     liked, or on the watchlist
		 *   bottom left   your score
		 *   bottom right  how many times you have watched it
		 * A card then reads the same whatever is on it, and a missing piece
		 * leaves its corner empty rather than moving another one.
		 */
		if (entry.certification) posterEl.createDiv({ cls: "reel-cell-cert", text: entry.certification });
		if (entry.liked) posterEl.createDiv({ cls: "reel-cell-heart", text: "♥" });
		else if (entry.status === "watchlist") {
			const flag = posterEl.createDiv({ cls: "reel-cell-flag", attr: { "aria-hidden": "true" } });
			setIcon(flag, "bookmark");
		}
		if (entry.rating != null) {
			posterEl.createDiv({ cls: "reel-cell-score", text: `${entry.rating} ★` });
		}
		const times = entry.watched?.length ?? 0;
		if (times > 1) posterEl.createDiv({ cls: "reel-cell-count", text: `${times}×` });

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
		const facts: string[] = [];
		if (y) facts.push(String(y));
		if (entry.type === "film" && entry.runtime) facts.push(formatMinutes(entry.runtime));
		else if (entry.type === "tv" && entry.seasons.length) {
			facts.push(`${entry.seasons.length} season${entry.seasons.length === 1 ? "" : "s"}`);
		}
		if (facts.length) caption.createDiv({ cls: "reel-cell-year", text: facts.join(" • ") });

		wireCell(plugin, cell, entry, onSelect);
	}
}

export function renderRowList(plugin: ReelPlugin, el: HTMLElement, rows: Entry[], compact = false, onSelect?: (e: Entry) => void): void {
	const list = el.createDiv({ cls: "reel-list" });
	for (const entry of rows) {
		const row = list.createDiv({ cls: "reel-row" });
		row.dataset.reelPath = entry.path;
		// This one had no label at all — `role="button"` with nothing to
		// announce, so the entire row list read as a column of unnamed
		// buttons. The grid beside it was labelled. That is exactly the drift
		// that comes of writing the same three lines in fourteen places.
		describe(row, entry);

		if (!compact) {
			const thumb = row.createDiv({ cls: "reel-row-thumb" });
			plugin.posters.attach(thumb, entry);
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

		// The full list layout carries what you would otherwise open the title
		// to find out. Compact deliberately does not — being scannable at a
		// glance is the entire reason to choose it.
		if (!compact) {
			const facts = body.createDiv({ cls: "reel-row-facts" });
			if (entry.runtime) facts.createSpan({ text: formatMinutes(entry.runtime) });
			if (entry.type === "tv" && entry.totalEpisodes) {
				facts.createSpan({ text: `${entry.totalEpisodes} episodes` });
			}
			if (entry.certification) facts.createSpan({ cls: "reel-badge cert", text: entry.certification });
			if (entry.imdbRating != null) {
				const votes = entry.imdbVotes ? ` (${compactCount(entry.imdbVotes)})` : "";
				facts.createSpan({ cls: "reel-dim", text: `IMDb ${entry.imdbRating.toFixed(1)}${votes}` });
			}
			if (entry.metacritic != null) facts.createSpan({ cls: "reel-dim", text: `MC ${entry.metacritic}` });
			if (!facts.childElementCount) facts.remove();

			// Who made it, which is how most people recognise a title they have
			// half-forgotten — more reliably than by its year.
			const people = entry.type === "tv" ? entry.creators : entry.director;
			const names = [...people.map(unlink), ...entry.cast.slice(0, 2).map(unlink)].filter(Boolean);
			if (names.length) body.createDiv({ cls: "reel-row-people", text: names.join(" · ") });

			if (entry.overview) body.createDiv({ cls: "reel-row-overview", text: entry.overview });
		}

		wireCell(plugin, row, entry, onSelect);
	}
}
