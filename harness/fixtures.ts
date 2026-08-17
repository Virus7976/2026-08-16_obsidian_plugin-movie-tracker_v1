/**
 * A believable library to render against.
 *
 * Two things matter here and both come from bugs that shipped.
 *
 * The titles are *long*. "The Lord of the Rings: The Fellowship of the Ring"
 * is the case that finds missing truncation, and a fixture full of short
 * names would have said the layout was fine.
 *
 * The size is realistic. The filter chrome burying the library only showed up
 * at ~30 titles with several genres and directors, because that is when the
 * suggestion row has enough to wrap onto a second line. Three fixtures would
 * have hidden it.
 */

import type { Entry } from "../src/types";

let n = 0;

function film(o: Partial<Entry> & { title: string }): Entry {
	n++;
	return {
		path: `Movies/${o.title}.md`,
		basename: o.title,
		type: "film",
		tmdbId: 1000 + n,
		director: [],
		creators: [],
		genres: [],
		seasons: [],
		watched: [],
		cast: [],
		characters: [],
		castIds: [],
		directorIds: [],
		productionCompanies: [],
		providers: [],
		contentFlags: [],
		contentTopics: [],
		lists: [],
		status: "watched",
		added: Date.now() - n * 86_400_000,
		watchCount: 1,
		...o,
	} as Entry;
}

export const LIBRARY: Entry[] = [
	film({
		title: "The Lord of the Rings: The Fellowship of the Ring",
		year: 2001,
		rating: 5,
		runtime: 178,
		genres: ["Adventure", "Fantasy", "Action"],
		director: ["Peter Jackson"],
		cast: ["Elijah Wood", "Ian McKellen", "Viggo Mortensen"],
		castIds: [1327, 1328, 110],
		directorIds: [108],
		certification: "PG-13",
		imdbRating: 8.9,
		imdbVotes: 1_950_000,
		metacritic: 92,
		watched: [{ date: "2025-08-16", rating: 5 }],
		overview:
			"A meek Hobbit and eight companions set out on a journey to destroy the One Ring and the Dark Lord Sauron.",
		liked: true,
		wouldRewatch: true,
	}),
	film({
		title: "Heat",
		year: 1995,
		rating: 4.5,
		runtime: 170,
		genres: ["Action", "Crime", "Drama"],
		director: ["Michael Mann"],
		cast: ["Al Pacino", "Robert De Niro"],
		castIds: [1158, 380],
		directorIds: [1704],
		certification: "R",
		imdbRating: 8.3,
		watched: [{ date: "2024-08-16", rating: 4.5 }],
	}),
	film({ title: "Inside Man", year: 2006, rating: 4, genres: ["Crime", "Thriller"], director: ["Spike Lee"], runtime: 129 }),
	film({ title: "Sicario", year: 2015, rating: 4.5, genres: ["Action", "Crime"], director: ["Denis Villeneuve"], runtime: 121 }),
	film({ title: "Dune", year: 2021, rating: 4.5, genres: ["Science Fiction"], director: ["Denis Villeneuve"], runtime: 155 }),
	film({ title: "Hot Fuzz", year: 2007, rating: 5, genres: ["Action", "Comedy"], director: ["Edgar Wright"], runtime: 121 }),
	film({ title: "Shaun of the Dead", year: 2004, rating: 4, genres: ["Comedy", "Horror"], director: ["Edgar Wright"] }),
	film({ title: "The Dark Knight", year: 2008, rating: 5, genres: ["Action", "Crime"], director: ["Christopher Nolan"], runtime: 152 }),
	film({ title: "Inception", year: 2010, rating: 4.5, genres: ["Action", "Science Fiction"], director: ["Christopher Nolan"] }),
	film({ title: "Interstellar", year: 2014, rating: 4.5, genres: ["Adventure", "Drama"], director: ["Christopher Nolan"] }),
	film({ title: "Training Day", year: 2001, rating: 4, genres: ["Crime", "Drama"], director: ["Antoine Fuqua"] }),
	film({ title: "Remember the Titans", year: 2000, rating: 3.5, genres: ["Drama"], director: ["Boaz Yakin"] }),
	film({ title: "Everything Everywhere All at Once", year: 2022, rating: 5, genres: ["Action", "Comedy"], status: "watchlist" }),
	film({ title: "Parasite", year: 2019, rating: 5, genres: ["Thriller", "Drama"] }),
	film({ title: "Mad Max: Fury Road", year: 2015, rating: 4.5, genres: ["Action", "Adventure"] }),
	film({ title: "Arrival", year: 2016, rating: 4, genres: ["Science Fiction", "Drama"], director: ["Denis Villeneuve"] }),
	film({ title: "Blade Runner 2049", year: 2017, rating: 4.5, genres: ["Science Fiction"], director: ["Denis Villeneuve"] }),
	film({ title: "No Country for Old Men", year: 2007, rating: 4.5, genres: ["Crime", "Thriller"] }),
	film({ title: "There Will Be Blood", year: 2007, rating: 4, genres: ["Drama"] }),
	film({ title: "Whiplash", year: 2014, rating: 5, genres: ["Drama", "Music"] }),
	film({ title: "The Grand Budapest Hotel", year: 2014, rating: 4, genres: ["Comedy", "Adventure"] }),
	film({ title: "Knives Out", year: 2019, rating: 4, genres: ["Comedy", "Crime"], status: "watchlist" }),
	film({ title: "Nightcrawler", year: 2014, rating: 4.5, genres: ["Crime", "Thriller"] }),
	film({ title: "Prisoners", year: 2013, rating: 4, genres: ["Thriller"], director: ["Denis Villeneuve"] }),
	film({ title: "Se7en", year: 1995, rating: 4.5, genres: ["Crime", "Thriller"] }),
	film({ title: "Zodiac", year: 2007, rating: 4, genres: ["Crime", "Drama"] }),
	film({ title: "The Social Network", year: 2010, rating: 4, genres: ["Drama"] }),
	film({ title: "Gone Girl", year: 2014, rating: 4, genres: ["Thriller"] }),
	film({ title: "Baby Driver", year: 2017, rating: 4, genres: ["Action", "Crime"], director: ["Edgar Wright"] }),
	film({ title: "Drive", year: 2011, rating: 4, genres: ["Crime", "Drama"] }),
];

/** A series, since half the app has to handle one. */
export const SHOW: Entry = {
	...film({ title: "The Office", genres: ["Comedy"] }),
	type: "tv",
	firstAirYear: 2005,
	totalEpisodes: 186,
	episodeRuntime: 22,
	rating: 3,
	certification: "TV-14",
	creators: ["Greg Daniels"],
	tmdbRating: 8.6,
	status: "watching",
	seasons: [
		{ n: 1, watched: "1-6", total: 6 },
		{ n: 2, watched: "1-3", total: 22 },
		{ n: 3, watched: "", total: 23 },
	],
	lastWatched: { season: 2, episode: 3, date: "2026-08-15" },
	overview:
		"The everyday lives of office employees in the Scranton, Pennsylvania branch of the fictional Dunder Mifflin Paper Company.",
} as Entry;

/**
 * The rows a real library actually contains.
 *
 * The first fixture set was thirty English films with posters and one series.
 * Every one of them was well-behaved, so the harness could only prove the
 * layout handled well-behaved data — which was never the question. These are
 * the shapes that break things, and each is a row somebody genuinely has.
 */
export const AWKWARD: Entry[] = [
	// No poster at all. Common on obscure titles and on everything until the
	// backfill runs, and it is the case where the placeholder has to hold the
	// grid's shape by itself.
	film({ title: "A Film With No Poster", year: 1974, genres: ["Drama"], rating: 3 }),

	// A title long enough to break a grid track, which is exactly how the
	// unequal-columns bug got in.
	film({
		title:
			"Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb, and Several Other Things Besides",
		year: 1964,
		rating: 5,
		genres: ["Comedy", "War"],
		director: ["Stanley Kubrick"],
	}),

	// Nothing recorded but the title. An import leaves hundreds of these.
	film({ title: "Untitled Import", status: "watchlist" }),

	// Non-Latin script, which sizes and wraps differently from English.
	film({ title: "七人の侍", year: 1954, rating: 5, genres: ["Drama"], director: ["黒澤明"], runtime: 207 }),

	// A single character, at the other end from the long one.
	film({ title: "M", year: 1931, rating: 4.5, genres: ["Crime"] }),

	// Every badge at once: certification, watchlist flag, rating, heart. They
	// all overlay the same poster corner region.
	film({
		title: "Everything At Once",
		year: 2020,
		rating: 4.5,
		liked: true,
		wouldRewatch: true,
		status: "watchlist",
		certification: "NC-17",
		genres: ["Action", "Comedy", "Drama", "Thriller", "Horror", "Romance"],
		imdbRating: 9.9,
		imdbVotes: 2_400_000,
		metacritic: 100,
		rottenTomatoes: 100,
		tmdbRating: 9.9,
	}),
];

/** A show long enough that its season strip is the layout problem. */
export const LONG_SHOW: Entry = {
	...film({ title: "A Very Long Running Series Indeed", genres: ["Drama"] }),
	type: "tv",
	firstAirYear: 1989,
	totalEpisodes: 750,
	episodeRuntime: 22,
	status: "watching",
	creators: ["Someone With A Considerably Long Name Attached"],
	seasons: Array.from({ length: 34 }, (_, i) => ({
		n: i + 1,
		watched: i < 20 ? `1-${22}` : "",
		total: 22,
	})),
	lastWatched: { season: 20, episode: 22, date: "2026-01-01" },
} as Entry;
