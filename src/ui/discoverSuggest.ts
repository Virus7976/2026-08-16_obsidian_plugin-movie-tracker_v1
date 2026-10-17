/**
 * Search in Discover that feels like Obsidian's quick switcher.
 *
 * On a wide window, typing in the search field opens a list under it, not a
 * grid of posters to scan: one row per match with a small poster, the title,
 * what it is, and whether it is already yours. Arrow keys move, Enter opens,
 * Ctrl or Cmd with Enter adds to the watchlist, Escape closes. People are in
 * the same list, so "denzel" finds him as well as his films.
 *
 * The list is an overlay; the screen behind it is untouched, so closing it
 * leaves you exactly where you were.
 */

import { Notice, Platform, setIcon } from "obsidian";
import type ReelPlugin from "../main";
import type { TmdbSearchResult } from "../types";
import { redact } from "../secrets";
import { todayISO, yearOf } from "../util/dates";
import { PersonSheet } from "./personSheet";
import { TitlePage } from "./titlePage";
import { holdAt, showResultMenu } from "./titleMenu";

interface Row {
	kind: "title" | "person";
	r: TmdbSearchResult;
	title: string;
	sub: string;
	isTv: boolean;
}

export class DiscoverSuggest {
	private pop: HTMLElement | null = null;
	private rows: Row[] = [];
	private at = 0;
	private timer: number | null = null;
	private token = 0;

	constructor(
		private plugin: ReelPlugin,
		private input: HTMLInputElement,
		private host: HTMLElement,
		private enabled: () => boolean
	) {
		input.addEventListener("input", () => this.onInput());
		input.addEventListener("keydown", (e) => this.onKey(e));
		input.addEventListener("focus", () => {
			if (this.rows.length && this.enabled()) this.show();
		});
		document.addEventListener("pointerdown", (e) => {
			if (!this.pop) return;
			const t = e.target as Node;
			if (this.pop.contains(t) || this.host.contains(t)) return;
			this.close();
		});
	}

	close(): void {
		this.pop?.remove();
		this.pop = null;
	}

	private onInput(): void {
		if (this.timer != null) window.clearTimeout(this.timer);
		const q = this.input.value.trim();
		if (!this.enabled() || q.length < 2) {
			this.rows = [];
			this.close();
			return;
		}
		this.timer = window.setTimeout(() => void this.fetch(q), 160);
	}

	private async fetch(q: string): Promise<void> {
		const mine = ++this.token;
		try {
			const res = await this.plugin.tmdb.searchMultiPage(q, 1);
			if (mine !== this.token || this.input.value.trim() !== q) return;
			const rows: Row[] = [];
			for (const p of res.people.slice(0, 3)) {
				rows.push({
					kind: "person",
					r: p,
					title: p.name ?? "",
					sub: "Person",
					isTv: false,
				});
			}
			for (const r of res.results.filter((x) => !x.adult && x.poster_path).slice(0, 9)) {
				const isTv = r.media_type === "tv";
				const year = yearOf(isTv ? r.first_air_date : r.release_date);
				rows.push({
					kind: "title",
					r,
					title: (isTv ? r.name : r.title) ?? "Untitled",
					sub: [isTv ? "Series" : "Film", year ? String(year) : "", r.vote_average ? `★ ${r.vote_average.toFixed(1)}` : ""]
						.filter(Boolean)
						.join(" · "),
					isTv,
				});
			}
			this.rows = rows;
			this.at = 0;
			if (!rows.length) {
				this.close();
				return;
			}
			this.show();
		} catch {
			// Search will still run below the field; the list is only a shortcut.
			this.close();
		}
	}

	private owned(row: Row): boolean {
		return row.kind === "title" && !!this.plugin.library.byTmdbId(row.r.id, row.isTv ? "tv" : "film");
	}

	private show(): void {
		this.close();
		const pop = this.host.createDiv({ cls: "reel-suggest-pop", attr: { role: "listbox" } });
		this.pop = pop;

		this.rows.forEach((row, i) => {
			const el = pop.createDiv({ cls: "reel-suggest-row", attr: { role: "option" } });
			el.toggleClass("is-selected", i === this.at);
			const thumb = el.createDiv({ cls: "reel-suggest-thumb" });
			const path = row.kind === "person" ? row.r.profile_path : row.r.poster_path;
			const src = this.plugin.tmdb.posterUrl(path ?? null, "w92");
			if (src) thumb.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
			else setIcon(thumb, row.kind === "person" ? "user" : "film");
			const text = el.createDiv({ cls: "reel-suggest-text" });
			text.createDiv({ cls: "reel-suggest-title", text: row.title });
			text.createDiv({ cls: "reel-suggest-sub", text: row.sub });

			if (this.owned(row)) el.createSpan({ cls: "reel-badge subtle", text: "In your library" });
			else if (row.kind === "title") {
				const add = el.createEl("button", {
					cls: "reel-suggest-add",
					attr: { type: "button", "aria-label": `Add ${row.title} to your watchlist`, title: "Add to watchlist" },
				});
				setIcon(add, "plus");
				add.addEventListener("click", (e) => {
					e.stopPropagation();
					void this.add(row);
				});
			}

			el.addEventListener("mousemove", () => this.select(i, false));
			el.addEventListener("click", () => this.open(row));
			if (row.kind === "title") {
				holdAt(el, (x, y) =>
					showResultMenu(
						this.plugin,
						{ id: row.r.id, title: row.title, year: row.sub.match(/\d{4}/)?.[0], isTv: row.isTv },
						x,
						y,
						() => this.open(row),
						this.owned(row) ? undefined : () => void this.add(row)
					)
				);
			}
		});

		pop.createDiv({
			cls: "reel-suggest-hint",
			text: Platform.isMacOS
				? "↑↓ to move   ↵ to open   ⌘↵ to add to watchlist   esc to close"
				: "↑↓ to move   ↵ to open   ctrl ↵ to add to watchlist   esc to close",
		});
	}

	private select(i: number, scroll = true): void {
		if (!this.pop || i === this.at) return;
		this.at = i;
		this.pop.querySelectorAll(".reel-suggest-row").forEach((el, n) => el.toggleClass("is-selected", n === i));
		if (scroll) this.pop.querySelectorAll(".reel-suggest-row")[i]?.scrollIntoView({ block: "nearest" });
	}

	private onKey(e: KeyboardEvent): void {
		if (!this.pop) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			this.select((this.at + 1) % this.rows.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			this.select((this.at - 1 + this.rows.length) % this.rows.length);
		} else if (e.key === "Enter") {
			const row = this.rows[this.at];
			if (!row) return;
			e.preventDefault();
			if ((e.ctrlKey || e.metaKey) && row.kind === "title" && !this.owned(row)) void this.add(row);
			else this.open(row);
		} else if (e.key === "Escape") {
			e.preventDefault();
			this.close();
		}
	}

	private open(row: Row): void {
		this.close();
		if (row.kind === "person") {
			new PersonSheet(this.plugin, row.r.id, row.title).open();
			return;
		}
		const own = this.plugin.library.byTmdbId(row.r.id, row.isTv ? "tv" : "film");
		if (own) void this.plugin.openDetail(own);
		else new TitlePage(this.plugin, { ...row.r, media_type: row.isTv ? "tv" : "movie" }).open();
	}

	private async add(row: Row): Promise<void> {
		try {
			await this.plugin.notes.createFromResult({ ...row.r, media_type: row.isTv ? "tv" : "movie" }, { date: todayISO(), watchlist: true });
			this.plugin.undo.offer(`Added ${row.title} to your watchlist`);
			this.show();
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
		}
	}
}
