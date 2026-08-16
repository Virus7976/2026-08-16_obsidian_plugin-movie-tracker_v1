/**
 * Legacy import conversion.
 *
 * This rewrites notes you already have, deleting the old keys in the same
 * pass — so a bad conversion isn't recoverable from the note itself. The
 * fixture below is the real frontmatter shape from the TV Tracker plugin.
 */

import { convertLegacy, looksLegacy, minutes, num, scaleIsTen, splitList, str } from "../src/util/legacy";

let pass = 0;
let fail = 0;

function eq(actual: unknown, expected: unknown, label: string) {
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	if (a === b) pass++;
	else {
		fail++;
		console.log(`FAIL ${label}\n  expected ${b}\n  actual   ${a}`);
	}
}

/* A real note from the old tracker. */
const oceans: Record<string, unknown> = {
	Title: "Ocean's Eleven",
	Rating: 5,
	Status: "Watched",
	Type: "Movie",
	Poster: "https://image.tmdb.org/t/p/original/hQQCdZrsHtZyR6NbKH2YyCqd2fR.jpg",
	Genre: "Thriller, Crime",
	Duration: "116 minutes",
	"Avg vote": 7.461,
	Popularity: 11.3024,
	Cast: "George Clooney, Brad Pitt, Andy Garcia",
	"TMDB ID": 161,
	Director: "Steven Soderbergh",
	tags: "tvtracker, Movie",
	original_language: "en",
	overview: "Less than 24 hours into his parole…",
	trailer: "https://www.youtube.com/watch?v=n3epi9hPbqQ",
	budget: 85000000,
	revenue: 450717150,
	belongs_to_collection: "Ocean's Collection",
	production_company: "Warner Bros. Pictures, Village Roadshow Pictures",
	"Available On": "Starz Apple TV Channel, Starz Roku Premium Channel",
	release_date: "2001-12-07",
};

/* ---- detection ---- */
eq(looksLegacy(oceans), true, "old note detected");
eq(looksLegacy({ tmdb_id: 161, title: "x" }), false, "already-converted note is left alone");
eq(looksLegacy({ some: "note" }), false, "an unrelated note is not touched");

/* ---- helpers ---- */
eq(splitList("Thriller, Crime"), ["Thriller", "Crime"], "comma string becomes a list");
eq(splitList(["A", "B"]), ["A", "B"], "an existing list passes through");
eq(splitList(""), [], "empty string yields nothing");
eq(splitList("A,,B"), ["A", "B"], "empty entries dropped");
eq(minutes("116 minutes"), 116, "duration parsed");
eq(minutes("1h 56m"), 1, "leading number wins — imperfect, but never wrong by a factor of 60");
eq(minutes(undefined), undefined, "no duration");
eq(str("  x  "), "x", "trimmed");
eq(str(""), undefined, "blank is undefined, not empty string");
eq(num("7.461"), 7.461, "numeric string");
eq(num("abc"), undefined, "non-numeric");

/* ---- the rating-scale decision, which is the risky one ---- */
eq(scaleIsTen([5, 3, 4]), false, "nothing above 5 means a 5-point scale");
eq(scaleIsTen([5, 3, 8]), true, "an 8 proves a 10-point scale");
eq(scaleIsTen([]), false, "no ratings, no halving");

/* ---- conversion ---- */
const asFive = convertLegacy(oceans, { halveRatings: false });
eq(asFive.tmdb_id, 161, "tmdb id carried across");
eq(asFive.type, "film", "Movie becomes film");
eq(asFive.title, "Ocean's Eleven", "title");
eq(asFive.year, 2001, "year derived from release_date");
eq(asFive.director, ["Steven Soderbergh"], "director as a list");
eq(asFive.cast, ["George Clooney", "Brad Pitt", "Andy Garcia"], "cast split");
eq(asFive.genres, ["Thriller", "Crime"], "genres split");
eq(asFive.runtime, 116, "runtime in minutes");
eq(asFive.tmdb_rating, 7.5, "vote rounded to one place");
eq(asFive.status, "watched", "status mapped");
eq(asFive.rating, 5, "rating kept as-is on a 5-point scale");
eq(asFive.watched, [], "no viewing dates are invented");
eq(asFive.providers, ["Starz Apple TV Channel", "Starz Roku Premium Channel"], "providers split");
eq(asFive.collection, "Ocean's Collection", "collection");
eq(asFive.language, "en", "language");
eq(asFive.poster_url, oceans.Poster, "remote poster kept for the backfill to replace");
eq(asFive.tags, ["Movie"], "the tvtracker marker tag is dropped");

const asTen = convertLegacy(oceans, { halveRatings: true });
eq(asTen.rating, 2.5, "a 10-point 5 becomes 2.5");

/* ---- series ---- */
const show = convertLegacy(
	{ Title: "Breaking Bad", Type: "TV", Status: "Watched", Director: "Vince Gilligan", Duration: "47 minutes", release_date: "2008-01-20" },
	{ halveRatings: false }
);
eq(show.type, "tv", "TV becomes tv");
eq(show.creators, ["Vince Gilligan"], "for a show the director field is the creator");
eq(show.episode_runtime, 47, "runtime lands on episode_runtime for a show");
eq(show.first_air_year, 2008, "series year uses first_air_year");
eq(show.status, "completed", "a watched show is completed, not 'watched'");
eq(show.rating, undefined, "no rating stays absent rather than becoming zero");

/* ---- degenerate input ---- */
const bare = convertLegacy({ Title: "Untitled Thing" }, { halveRatings: false });
eq(bare.type, "film", "no Type defaults to film");
eq(bare.status, "watched", "no Status defaults to watched");
eq(bare.tmdb_id, undefined, "a missing id stays missing rather than becoming NaN");
eq(bare.watched, [], "still no invented history");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
