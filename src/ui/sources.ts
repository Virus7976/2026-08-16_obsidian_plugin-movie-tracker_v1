/**
 * "See this somewhere else": the sites that know most about each tab.
 *
 * Press and hold (or right-click) the body of a title page tab and this lists
 * the places that cover that subject best, each as a direct link. Where a site
 * has a page for an IMDb id it opens that page; where it only has search, it
 * opens a search for the title and year, which is said in the label's absence
 * of a "page" claim: nothing here is promised to land on the exact title.
 */

import { Menu } from "obsidian";
import type ReelPlugin from "../main";
import { holdAt } from "./titleMenu";
import { tmdbUrl } from "../extract";

export interface SourceTarget {
	title: string;
	year?: number;
	imdbId?: string;
	tmdbId: number;
	isTv: boolean;
}

type Source = [label: string, url: string];

function sourcesFor(tab: string, t: SourceTarget): Source[] {
	const q = encodeURIComponent(`${t.title}${t.year ? ` ${t.year}` : ""}`);
	const imdb = t.imdbId ? `https://www.imdb.com/title/${t.imdbId}` : `https://www.imdb.com/find/?q=${q}&s=tt`;
	const imdbAt = (path: string): string => (t.imdbId ? `${imdb}/${path}/` : imdb);
	const wiki: Source = ["Wikipedia", `https://en.wikipedia.org/w/index.php?search=${q}`];
	const tmdb: Source = ["TMDB", tmdbUrl(t.tmdbId, t.isTv ? "tv" : "film")];
	const mojo: Source = ["Box Office Mojo", t.imdbId ? `https://www.boxofficemojo.com/title/${t.imdbId}/` : `https://www.boxofficemojo.com/search/?q=${q}`];
	const numbers: Source = ["The Numbers", `https://www.the-numbers.com/custom-search?searchterm=${encodeURIComponent(t.title)}`];
	const rt: Source = ["Rotten Tomatoes", `https://www.rottentomatoes.com/search?search=${encodeURIComponent(t.title)}`];
	const meta: Source = ["Metacritic", `https://www.metacritic.com/search/${encodeURIComponent(t.title)}/`];
	const lb: Source = ["Letterboxd", `https://letterboxd.com/tmdb/${t.tmdbId}/`];
	const trakt: Source = ["Trakt", `https://trakt.tv/search/tmdb/${t.tmdbId}?id_type=${t.isTv ? "show" : "movie"}`];
	const csm: Source = ["Common Sense Media", `https://www.commonsensemedia.org/search/${encodeURIComponent(t.title)}`];
	const dtd: Source = ["DoesTheDogDie", `https://www.doesthedogdie.com/search?q=${encodeURIComponent(t.title)}`];

	switch (tab) {
		case "money":
			return [["IMDb box office", imdbAt("business")], mojo, numbers, wiki, tmdb];
		case "stats":
			return [["IMDb ratings", imdbAt("ratings")], rt, meta, lb, trakt];
		case "content":
			return [["IMDb parents guide", imdbAt("parentalguide")], csm, dtd];
		case "releases":
			return [["IMDb release dates", imdbAt("releaseinfo")], wiki, tmdb];
		case "cast":
		case "crew":
			return [["IMDb full cast and crew", imdbAt("fullcredits")], wiki, tmdb];
		case "details":
			return [["IMDb company credits", imdbAt("companycredits")], ["IMDb technical specs", imdbAt("technical")], wiki, tmdb];
		case "photos":
			return [["IMDb photos", imdbAt("mediaindex")], tmdb];
		case "reviews":
			return [["IMDb user reviews", imdbAt("reviews")], rt, meta, lb];
		default:
			return [["IMDb", imdb], wiki, lb, tmdb];
	}
}

/** Hold or right-click the tab's body for the sites that cover it; buttons and links keep their own behaviour. */
export function attachSources(plugin: ReelPlugin, body: HTMLElement, tab: string, target: SourceTarget): void {
	holdAt(body, (x, y) => {
		// A chip, a card or a fold inside the tab has its own press-and-hold.
		const hit = document.elementFromPoint(x, y);
		if (hit?.closest("button, a, summary, [role='button']")) return;
		const menu = new Menu();
		for (const [label, url] of sourcesFor(tab, target)) {
			menu.addItem((i) => i.setTitle(label).setIcon("external-link").onClick(() => void window.open(url, "_blank", "noopener")));
		}
		menu.showAtPosition({ x, y });
	});
}
