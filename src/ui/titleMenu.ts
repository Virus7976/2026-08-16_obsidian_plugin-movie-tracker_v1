/**
 * The menu behind a long-press, a right-click, and the title page's ⋯ button.
 *
 * One builder, so every place a title appears offers the same doors.
 */

import { Menu, Notice, Platform, TFile } from "obsidian";
import { redact } from "../secrets";
import { haptic } from "../util/haptics";
import type ReelPlugin from "../main";
import type { Entry } from "../types";
import { QuickRate } from "./quickRate";
import { ListPicker } from "./listPicker";
import { ReviewEditor } from "./reviewPane";
import { LogSheet } from "./logSheet";
import { imdbUrl, tmdbUrl } from "../extract";

/**
 * The actions a title supports, without opening it.
 *
 * Obsidian's own `Menu`, so it looks and behaves like every other context
 * menu in the app — a bottom sheet on a phone, a popup on desktop — rather
 * than something Reel invented that only resembles one.
 *
 * The list is deliberately short and differs by what the entry already is:
 * offering "Add to watchlist" on something already watchlisted is a row that
 * can only disappoint.
 */
export function showTitleMenu(
	plugin: ReelPlugin,
	entry: Entry,
	x: number,
	y: number,
	opts: { onSelect?: (e: Entry) => void; /** On the title page itself, "Open" would open what is already open. */ onDetail?: boolean } = {}
): void {
	const { onSelect } = opts;
	const file = plugin.app.vault.getAbstractFileByPath(entry.path);
	if (!(file instanceof TFile)) {
		new Notice("Reel: note not found.");
		return;
	}

	const menu = new Menu();
	const run = (job: Promise<unknown>) => void job.catch((e: unknown) => new Notice(`Reel: ${redact(e)}`));

	if (!opts.onDetail) {
		menu.addItem((i) =>
			i
				.setTitle("Open")
				.setIcon("panel-right-open")
				.onClick(() => {
					if (onSelect) onSelect(entry);
					else void plugin.openDetail(entry);
				})
		);
	}

	menu.addItem((i) =>
		i
			.setTitle(entry.rating != null ? "Change rating" : "Rate")
			.setIcon("star")
			.onClick(() => new QuickRate(plugin, entry, file).open())
	);

	menu.addItem((i) =>
		i
			.setTitle(entry.liked ? "Unlike" : "Like")
			.setIcon("heart")
			.onClick(() => run(plugin.notes.toggleLiked(file).then((on) => plugin.undo.offer(on ? "Liked" : "Unliked"))))
	);

	menu.addItem((i) =>
		i.setTitle("Write a review").setIcon("pencil-line").onClick(() => new ReviewEditor(plugin, entry, null, () => {}).open())
	);
	menu.addItem((i) =>
		i.setTitle("Log a viewing").setIcon("calendar-plus").onClick(() => new LogSheet(plugin.app, plugin, { entry, file }).open())
	);
	menu.addItem((i) =>
		i.setTitle("Parents guide").setIcon("shield-alert").onClick(() => void plugin.openDetail(entry, "content"))
	);

	if (entry.status === "watchlist") {
		// Marking a film watched has to record a viewing, which `setStatus`
		// does — a bare relabel leaves it invisible to the Diary and to stats.
		menu.addItem((i) =>
			i
				.setTitle("Mark watched")
				.setIcon("check")
				.onClick(() =>
					run(
						plugin.notes
							.setStatus(file, entry.type === "tv" ? "watching" : "watched")
							.then(() => plugin.undo.offer(`${entry.title} marked watched`))
					)
				)
		);
	} else {
		menu.addItem((i) =>
			i
				.setTitle("Move to watchlist")
				.setIcon("bookmark")
				.onClick(() =>
					run(
						plugin.notes
							.setStatus(file, "watchlist")
							.then(() => plugin.undo.offer(`${entry.title} moved to the watchlist`))
					)
				)
		);
	}

	/*
	 * Everything past the four things you do most is grouped by what it is for,
	 * each group opening its own short menu. One long list is a list to scroll;
	 * five named doors is a list to scan. A phone's menu is a bottom sheet, so
	 * a group opens a second sheet in place rather than a flyout beside it.
	 */
	menu.addSeparator();
	menu.addItem((i) =>
		i
			.setTitle("Tags and lists…")
			.setIcon("list")
			.onClick(() => new ListPicker(plugin.app, plugin, entry, file).open())
	);
	door(menu, "Change status", "circle-dot", x, y, entry.title, (m) => statusItems(m, plugin, entry, file, run));
	door(menu, "Find more like this", "sparkles", x, y, entry.title, (m) => findMoreItems(m, plugin, entry));
	door(menu, "Look it up", "external-link", x, y, entry.title, (m) => lookUpItems(m, entry));
	door(menu, "Where to watch", "tv", x, y, entry.title, (m) => whereItems(m, plugin, entry));
	door(menu, "Note", "file-text", x, y, entry.title, (m) => noteItems(m, plugin, entry, file));

	menu.showAtPosition({ x, y });
}

/**
 * A menu row that opens a second, named menu.
 *
 * On a desktop it is a real flyout that opens on hover, like every other menu
 * in Obsidian. `setSubmenu` is not in the published typings, so it is
 * feature-tested; on a phone (or where it is missing) the row opens a second
 * menu in place instead, since a phone's menu is a bottom sheet.
 */
function door(
	menu: Menu,
	title: string,
	icon: string,
	x: number,
	y: number,
	heading: string,
	fill: (m: Menu) => void
): void {
	menu.addItem((i) => {
		const withSub = i as unknown as { setSubmenu?: () => Menu };
		if (!Platform.isMobile && typeof withSub.setSubmenu === "function") {
			i.setTitle(title).setIcon(icon);
			fill(withSub.setSubmenu());
			return;
		}
		i.setTitle(`${title}…`)
			.setIcon(icon)
			.onClick(() => {
				const m = new Menu();
				// The title of what the menu is about, so the second sheet says
				// whose it is. Greyed: it labels, it does not act.
				m.addItem((h) => h.setTitle(heading).setDisabled(true));
				m.addSeparator();
				fill(m);
				m.showAtPosition({ x, y });
			});
	});
}

const open = (url: string): void => void window.open(url, "_blank", "noopener");

function statusItems(m: Menu, plugin: ReelPlugin, entry: Entry, file: TFile, run: (j: Promise<unknown>) => void): void {
	const options: [string, string][] =
		entry.type === "tv"
			? [["watchlist", "Watchlist"], ["watching", "Watching"], ["completed", "Completed"], ["paused", "Paused"], ["dropped", "Dropped"]]
			: [["watchlist", "Watchlist"], ["watched", "Watched"], ["dropped", "Dropped"]];
	for (const [value, label] of options) {
		m.addItem((i) =>
			i
				.setTitle(label)
				.setChecked(entry.status === value)
				.onClick(() => {
					if (entry.status === value) return;
					run(plugin.notes.setStatus(file, value).then(() => plugin.undo.offer(`${entry.title}: ${label.toLowerCase()}`)));
				})
		);
	}
}

/** Searches seeded from the title's own people, genre and collection. */
function findMoreItems(m: Menu, plugin: ReelPlugin, entry: Entry): void {
	const search = (query: string): void => plugin.openOmni(query, "all");
	const row = (label: string, icon: string, query: string | undefined): void => {
		if (!query) return;
		m.addItem((i) => i.setTitle(label).setIcon(icon).onClick(() => search(query)));
	};
	row(`Directed by ${entry.director[0] ?? ""}`, "clapperboard", entry.director[0]);
	row(`Created by ${entry.creators[0] ?? ""}`, "clapperboard", entry.creators[0]);
	row(`With ${entry.cast[0] ?? ""}`, "user", entry.cast[0]);
	if (entry.cast[1]) row(`With ${entry.cast[1]}`, "user", entry.cast[1]);
	for (const g of entry.genres.slice(0, 3)) row(g, "tag", g);
	row(`${entry.collection ?? ""}`, "layers", entry.collection);
	m.addSeparator();
	m.addItem((i) =>
		i
			.setTitle("Similar titles")
			.setIcon("compass")
			.onClick(() => plugin.openOmni("", "new", { id: entry.tmdbId, type: entry.type === "tv" ? "tv" : "movie", title: entry.title }))
	);
}

function lookUpItems(m: Menu, entry: Entry): void {
	const link = (title: string, url: string | undefined): void => {
		if (!url) return;
		m.addItem((i) => i.setTitle(title).setIcon("external-link").onClick(() => open(url)));
	};
	const isTv = entry.type === "tv";
	const imdb = imdbUrl(entry.imdbId);
	link("IMDb", imdb);
	link("IMDb parents guide", imdb ? `${imdb}parentalguide` : undefined);
	link("TMDB", tmdbUrl(entry.tmdbId, entry.type));
	link("Trakt", `https://trakt.tv/search/tmdb/${entry.tmdbId}?id_type=${isTv ? "show" : "movie"}`);
	if (!isTv) link("Letterboxd", `https://letterboxd.com/tmdb/${entry.tmdbId}`);
	const q = encodeURIComponent(`${entry.title}${entry.year ? ` ${entry.year}` : ""}`);
	link("Search the web", `https://www.google.com/search?q=${q}`);
}

function whereItems(m: Menu, plugin: ReelPlugin, entry: Entry): void {
	const region = (plugin.settings.region || "us").toLowerCase();
	if (entry.providers.length) {
		// What the note already knows, in your region. Shown as a line each so
		// the answer is on the menu; tapping any of them opens the full page.
		for (const name of entry.providers.slice(0, 6)) {
			m.addItem((i) =>
				i
					.setTitle(name)
					.setIcon("play-circle")
					.onClick(() => open(`https://www.justwatch.com/${region}/search?q=${encodeURIComponent(entry.title)}`))
			);
		}
		m.addSeparator();
	}
	m.addItem((i) =>
		i
			.setTitle("Open JustWatch")
			.setIcon("external-link")
			.onClick(() => open(`https://www.justwatch.com/${region}/search?q=${encodeURIComponent(entry.title)}`))
	);
}

function noteItems(m: Menu, plugin: ReelPlugin, entry: Entry, file: TFile): void {
	m.addItem((i) =>
		i.setTitle("Open note").setIcon("file-text").onClick(() => void plugin.app.workspace.getLeaf(false).openFile(file))
	);
	m.addItem((i) =>
		i
			.setTitle("Open in new tab")
			.setIcon("file-plus")
			.onClick(() => void plugin.app.workspace.getLeaf("tab").openFile(file))
	);
	m.addSeparator();
	m.addItem((i) =>
		i
			.setTitle("Copy link")
			.setIcon("link")
			.onClick(() => void navigator.clipboard.writeText(`[[${file.basename}]]`).then(() => new Notice("Link copied")))
	);
	m.addItem((i) =>
		i
			.setTitle("Copy title and year")
			.setIcon("copy")
			.onClick(() =>
				void navigator.clipboard
					.writeText(`${entry.title}${entry.year ? ` (${entry.year})` : ""}`)
					.then(() => new Notice("Copied"))
			)
	);
}



/**
 * Press and hold an element (or right-click it) and call back with where.
 * 500ms with an 8px movement allowance, so a scroll that starts on the element
 * never opens it. The click that follows a hold is swallowed.
 */
export function holdAt(el: HTMLElement, cb: (x: number, y: number) => void): void {
	let timer: number | null = null;
	let held = false;
	let sx = 0;
	let sy = 0;
	// A slow shrink under the finger while the wait runs, so the press visibly
	// "takes" instead of feeling like a delay before a surprise.
	const cancel = (): void => {
		if (timer != null) window.clearTimeout(timer);
		timer = null;
		el.removeClass("is-holding");
	};
	const open = (x: number, y: number): void => {
		held = true;
		cancel();
		haptic("hold");
		cb(x, y);
	};
	el.addEventListener("pointerdown", (e) => {
		held = false;
		sx = e.clientX;
		sy = e.clientY;
		el.addClass("is-holding");
		timer = window.setTimeout(() => open(e.clientX, e.clientY), 500);
	});
	el.addEventListener("pointermove", (e) => {
		if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) cancel();
	});
	for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, cancel);
	el.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		open(e.clientX, e.clientY);
	});
	el.addEventListener(
		"click",
		(e) => {
			if (!held) return;
			held = false;
			e.stopPropagation();
			e.preventDefault();
		},
		true
	);
}

/** Press and hold anywhere on an element for the title's menu. */
export function onHold(plugin: ReelPlugin, el: HTMLElement, entry: Entry): void {
	holdAt(el, (x, y) => showTitleMenu(plugin, entry, x, y));
}

const link = (m: Menu, title: string, url: string): void => {
	m.addItem((i) => i.setTitle(title).setIcon("external-link").onClick(() => open(url)));
};

/** A person: their screen, your library, and the places that know more. */
export function showPersonMenu(
	plugin: ReelPlugin,
	person: { id?: number; name: string },
	x: number,
	y: number,
	onOpen?: () => void
): void {
	const menu = new Menu();
	if (onOpen) menu.addItem((i) => i.setTitle("Open").setIcon("user").onClick(onOpen));
	menu.addItem((i) =>
		i.setTitle("Search your library").setIcon("search").onClick(() => void plugin.openViewWithSearch(person.name))
	);
	const q = encodeURIComponent(person.name);
	door(menu, "Look them up", "external-link", x, y, person.name, (m) => {
		if (person.id) link(m, "TMDB", `https://www.themoviedb.org/person/${person.id}`);
		link(m, "IMDb", `https://www.imdb.com/find/?q=${q}&s=nm`);
		link(m, "Wikipedia", `https://en.wikipedia.org/w/index.php?search=${q}`);
		link(m, "Letterboxd", `https://letterboxd.com/search/${q}/`);
		link(m, "Trakt", `https://trakt.tv/search/people?query=${q}`);
		link(m, "Search the web", `https://www.google.com/search?q=${q}`);
	});
	menu.showAtPosition({ x, y });
}

/** A title from TMDB that may not be yours yet. */
export function showResultMenu(
	plugin: ReelPlugin,
	r: { id: number; title: string; year?: string; isTv: boolean },
	x: number,
	y: number,
	onOpen: () => void,
	onAdd?: () => void,
	/** Open the page on its Parents guide tab; absent where the page cannot. */
	onGuide?: () => void
): void {
	const menu = new Menu();
	menu.addItem((i) => i.setTitle("Open").setIcon("panel-right").onClick(onOpen));
	if (onGuide) menu.addItem((i) => i.setTitle("Parents guide").setIcon("shield-alert").onClick(onGuide));
	if (onAdd) menu.addItem((i) => i.setTitle("Add to watchlist").setIcon("bookmark").onClick(onAdd));
	const q = encodeURIComponent(`${r.title}${r.year ? ` ${r.year}` : ""}`);
	const kind = r.isTv ? "tv" : "movie";
	const region = (plugin.settings.region || "us").toLowerCase();
	door(menu, "Look it up", "external-link", x, y, r.title, (m) => {
		link(m, "TMDB", `https://www.themoviedb.org/${kind}/${r.id}`);
		link(m, "IMDb", `https://www.imdb.com/find/?q=${q}&s=tt`);
		if (!r.isTv) link(m, "Letterboxd", `https://letterboxd.com/tmdb/${r.id}`);
		link(m, "Trakt", `https://trakt.tv/search/tmdb/${r.id}?id_type=${r.isTv ? "show" : "movie"}`);
		link(m, "Where to watch", `https://www.justwatch.com/${region}/search?q=${encodeURIComponent(r.title)}`);
		link(m, "Search the web", `https://www.google.com/search?q=${q}`);
	});
	menu.showAtPosition({ x, y });
}

/**
 * The menu for a word on a chip: a genre, a keyword, a tag, a list.
 * Search your library for it, copy it, and whatever the caller adds
 * (toggle on this title, rename, delete).
 */
export function showChipMenu(
	plugin: ReelPlugin,
	text: string,
	x: number,
	y: number,
	extra: { title: string; icon: string; run: () => void; warning?: boolean }[] = []
): void {
	const menu = new Menu();
	menu.addItem((i) => i.setTitle(`Search your library for "${text}"`).setIcon("search").onClick(() => void plugin.openViewWithSearch(text)));
	menu.addItem((i) =>
		i
			.setTitle("Copy")
			.setIcon("copy")
			.onClick(() => {
				void navigator.clipboard.writeText(text).then(() => new Notice(`Copied "${text}"`));
			})
	);
	if (extra.length) menu.addSeparator();
	for (const e of extra) {
		menu.addItem((i) => {
			i.setTitle(e.title).setIcon(e.icon).onClick(e.run);
			if (e.warning) i.setWarning(true);
		});
	}
	menu.showAtPosition({ x, y });
}
