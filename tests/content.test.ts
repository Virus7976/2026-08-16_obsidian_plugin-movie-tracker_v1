/**
 * Content filtering and metadata extraction.
 *
 * The filter decides what you never see, so the failure mode that matters most
 * is the silent one: a title that should have been hidden slipping through, or
 * — worse for daily use — an unflagged title being hidden because a missing
 * field was read as a match.
 */

import {
	certificationFromContentRatings,
	certificationFromReleaseDates,
	certificationRank,
	flagsFromKeywords,
	policyBreach,
	DEFAULT_POLICY,
} from "../src/content";
import { personLink, providerNames, trailerUrl, applyFields } from "../src/extract";
import { parseQuery, applyQuery } from "../src/render/query";
import { topicHolds, flagsFromTopics } from "../src/enrich";
import { derive, applyDerived } from "../src/bases";
import { parseBundle } from "../src/credentials";
import { tasteWeight, rankGenres } from "../src/discover";
import type { Entry } from "../src/types";

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

function ok(cond: boolean, label: string) {
	if (cond) pass++;
	else {
		fail++;
		console.log(`FAIL ${label}`);
	}
}

/* ---- keyword → flags ---- */
eq(flagsFromKeywords(["sex scene", "heist"]), ["sex"], "sex scene detected");
eq(flagsFromKeywords(["female nudity"]), ["nudity"], "nudity detected");
eq(flagsFromKeywords(["strong language"]), ["profanity"], "profanity detected");
eq(flagsFromKeywords(["gore", "dismemberment"]), ["gore"], "gore deduped to one flag");
eq(flagsFromKeywords(["heist", "las vegas", "casino"]), [], "clean film gets no flags");
eq(flagsFromKeywords([]), [], "no keywords, no flags");
// Order is stable regardless of keyword order, so notes don't churn on refresh.
eq(flagsFromKeywords(["cocaine", "sex"]), ["sex", "drugs"], "flags come back in canonical order");

/* ---- certification ranking ---- */
ok(certificationRank("G")! < certificationRank("R")!, "G ranks below R");
ok(certificationRank("PG-13")! < certificationRank("NC-17")!, "PG-13 below NC-17");
eq(certificationRank("nonsense"), null, "unknown certification has no rank");
eq(certificationRank(undefined), null, "missing certification has no rank");
eq(certificationRank("r"), certificationRank("R"), "case insensitive");

eq(
	certificationFromReleaseDates({ results: [{ iso_3166_1: "US", release_dates: [{ certification: "PG-13" }] }] }),
	"PG-13",
	"US certification pulled from release_dates"
);
eq(
	certificationFromReleaseDates({ results: [{ iso_3166_1: "GB", release_dates: [{ certification: "15" }] }] }),
	undefined,
	"other regions ignored"
);
// TMDB frequently returns an empty certification string for some entries.
eq(
	certificationFromReleaseDates({ results: [{ iso_3166_1: "US", release_dates: [{ certification: "" }, { certification: "R" }] }] }),
	"R",
	"blank certifications are skipped"
);
eq(certificationFromReleaseDates(undefined), undefined, "missing payload is tolerated");
eq(certificationFromContentRatings({ results: [{ iso_3166_1: "US", rating: "TV-MA" }] }), "TV-MA", "tv rating");

/* ---- policy ---- */
const film = (over: Partial<Entry>) => ({ contentFlags: [], certification: undefined, ...over }) as Entry;

eq(policyBreach(film({}), DEFAULT_POLICY), null, "default policy hides nothing");
eq(policyBreach(film({ contentFlags: ["sex"] }), { ...DEFAULT_POLICY, hideFlags: ["sex"] }), "Sex", "flagged title is hidden, with a reason");
eq(policyBreach(film({ contentFlags: ["violence"] }), { ...DEFAULT_POLICY, hideFlags: ["sex"] }), null, "unrelated flag passes");
// The important one: an unflagged title must not be hidden by a flag filter.
eq(policyBreach(film({}), { ...DEFAULT_POLICY, hideFlags: ["sex", "profanity"] }), null, "unflagged title passes a flag filter");

eq(policyBreach(film({ certification: "R" }), { ...DEFAULT_POLICY, maxCertification: "PG-13" }), "R", "R is above PG-13");
eq(policyBreach(film({ certification: "PG" }), { ...DEFAULT_POLICY, maxCertification: "PG-13" }), null, "PG is under the limit");
eq(policyBreach(film({ certification: "PG-13" }), { ...DEFAULT_POLICY, maxCertification: "PG-13" }), null, "the limit itself passes");
// Unknown is not the same as safe, but it only hides in strict mode.
eq(policyBreach(film({}), { ...DEFAULT_POLICY, maxCertification: "PG-13" }), null, "unrated passes by default");
eq(policyBreach(film({}), { ...DEFAULT_POLICY, maxCertification: "PG-13", hideUnrated: true }), "unrated", "strict mode hides unrated");

/* ---- query operators ---- */
const rows: Entry[] = [
	{ title: "Ocean's Eleven", contentFlags: [], certification: "PG-13", genres: ["Thriller"], cast: ["George Clooney"], type: "film", watched: [], seasons: [], director: [], creators: [], lists: [], providers: [], productionCompanies: [], status: "watched", path: "a", basename: "a", tmdbId: 1, added: 0 } as unknown as Entry,
	{ title: "Sinners", contentFlags: ["sex", "gore"], certification: "R", genres: ["Horror"], cast: [], type: "film", watched: [], seasons: [], director: [], creators: [], lists: [], providers: [], productionCompanies: [], status: "watched", path: "b", basename: "b", tmdbId: 2, added: 0 } as unknown as Entry,
];

eq(applyQuery(rows, parseQuery("filter: content excludes sex")).map((r) => r.title), ["Ocean's Eleven"], "excludes drops flagged");
eq(applyQuery(rows, parseQuery("filter: certification in G|PG|PG-13")).map((r) => r.title), ["Ocean's Eleven"], "in matches a list");
eq(applyQuery(rows, parseQuery("filter: certification not in R|NC-17")).map((r) => r.title), ["Ocean's Eleven"], "not in excludes a list");
eq(applyQuery(rows, parseQuery("filter: cast contains clooney")).map((r) => r.title), ["Ocean's Eleven"], "cast search is case-insensitive");
eq(parseQuery("filter: content excludes sex").errors, [], "excludes parses without error");
// `in` must not be mistaken for the letters "in" inside a field or value.
eq(parseQuery("filter: title contains sinners").filters[0].op, "contains", "word op detection is not fooled by substrings");

/* ---- extraction ---- */
eq(personLink("Denis Villeneuve", { linkPeople: true, peopleFolder: "Movies/People", castLimit: 10, region: "US" }), "[[Movies/People/Denis Villeneuve|Denis Villeneuve]]", "person link targets the configured folder");
eq(personLink("Denis Villeneuve", { linkPeople: false, peopleFolder: "x", castLimit: 10, region: "US" }), "Denis Villeneuve", "linking can be turned off");
// Brackets in a name would otherwise produce a broken link.
eq(personLink("Bad [Name]", { linkPeople: true, peopleFolder: "P", castLimit: 10, region: "US" }), "[[P/Bad Name|Bad Name]]", "brackets stripped from names");

eq(
	trailerUrl([{ site: "YouTube", type: "Teaser", key: "aaa" }, { site: "YouTube", type: "Trailer", key: "bbb", official: true }]),
	"https://www.youtube.com/watch?v=bbb",
	"official trailer preferred over teaser"
);
eq(trailerUrl([{ site: "Vimeo", type: "Trailer", key: "x" }]), undefined, "non-YouTube ignored");
eq(trailerUrl(undefined), undefined, "no videos");

eq(
	providerNames({ results: { US: { flatrate: [{ provider_name: "Starz" }], free: [{ provider_name: "Starz" }] } } }, "US"),
	["Starz"],
	"providers deduped across tiers"
);
eq(providerNames({ results: { GB: { flatrate: [{ provider_name: "Now" }] } } }, "US"), [], "wrong region gives nothing");

/* ---- applyFields merge semantics ---- */
const fm: Record<string, unknown> = { content_flags: ["profanity"], rating: 5, status: "watched" };
applyFields(fm, { content_flags: ["sex"], runtime: 116 }, { preserve: ["status"] });
eq(fm.content_flags, ["profanity", "sex"], "hand-added flags survive a refresh");
eq(fm.runtime, 116, "new fields are written");
eq(fm.status, "watched", "preserved fields are untouched");

/* ---- DoesTheDogDie vote thresholds ---- */
// A single stray vote must not flag a title. Without a floor, one person
// clicking "yes" on an obscure film hides it from the whole library — the
// failure that makes people switch a filter off and never trust it again.
eq(topicHolds({ name: "Sex", yes: 1, no: 0 }), false, "one vote is not enough");
eq(topicHolds({ name: "Sex", yes: 3, no: 0 }), true, "three agreeing votes hold");
eq(topicHolds({ name: "Sex", yes: 2, no: 2 }), false, "a tie does not hold");
eq(topicHolds({ name: "Sex", yes: 10, no: 40 }), false, "minority does not hold");
eq(topicHolds({ name: "Sex", yes: 40, no: 10 }), true, "majority holds");
eq(topicHolds({ name: "Sex", yes: 0, no: 0 }), false, "no votes at all");

eq(flagsFromTopics([{ name: "Sexual content", yes: 9, no: 1 }]), ["sex"], "sexual content maps to sex");
eq(flagsFromTopics([{ name: "Strong language", yes: 9, no: 1 }]), ["profanity"], "language maps to profanity");
eq(flagsFromTopics([{ name: "Sexual content", yes: 1, no: 9 }]), [], "community says no, so no flag");
eq(flagsFromTopics([]), [], "no topics, no flags");
// Several topics can imply one flag; it must not be duplicated.
eq(flagsFromTopics([{ name: "Blood", yes: 5, no: 0 }, { name: "Gore", yes: 5, no: 0 }]), ["gore"], "flags deduped");

/* ---- Bases derived fields ---- */
eq(derive({ type: "film", watched: [{ date: "2024-03-11" }, { date: "2025-01-02" }] }).watch_count, 2, "watch count");
eq(derive({ type: "film", watched: [{ date: "2024-03-11" }, { date: "2025-01-02" }] }).last_watched_date, "2025-01-02", "newest viewing wins");
eq(derive({ type: "film", watched: [] }).last_watched_date, undefined, "no viewings, no date");
eq(derive({ type: "film", watched: [] }).progress, undefined, "a film has no progress");

const show = derive({
	type: "tv",
	seasons: [{ watched: "1-7", total: 7 }, { watched: "1-4", total: 13 }],
	totalEpisodes: 20,
	lastWatched: { season: 2, episode: 4, date: "2026-08-12" },
	firstAirYear: 2008,
	poster: "Movies/_posters/tv-1396.jpg",
});
eq(show.progress, 55, "progress is 11 of 20");
eq(show.last_watched_ep, "S2E4", "flat episode label");
eq(show.last_watched_date, "2026-08-12", "flat date lifted out of the nested object");
eq(show.year, 2008, "series year unified onto `year`");
eq(show.poster_embed, "![[Movies/_posters/tv-1396.jpg]]", "poster as an embed for card covers");

// Total unknown: report 0 rather than dividing by zero or inventing a number.
eq(derive({ type: "tv", seasons: [{ watched: "1-3" }], totalEpisodes: 0 }).progress, 0, "unknown total gives 0");
eq(derive({ type: "tv", seasons: [{ watched: "1-7", total: 7 }], totalEpisodes: 7 }).progress, 100, "complete show is 100");
// Falls back to summing per-season totals when TMDB's count is missing.
eq(derive({ type: "tv", seasons: [{ watched: "1-5", total: 10 }] }).progress, 50, "falls back to season totals");

const stale: Record<string, unknown> = { progress: 40, last_watched_ep: "S3E4", watch_count: 2 };
applyDerived(stale, derive({ type: "tv", seasons: [{ watched: "", total: 10 }], totalEpisodes: 10 }));
eq(stale.progress, 0, "reset show drops to 0");
eq(stale.last_watched_ep, undefined, "stale episode label is deleted, not left behind");

/* ---- credential bundle migration ---- */
// A pre-multi-key blob holds a bare token, not JSON. Reading it as an empty
// bundle would silently lose the key the user already had.
eq(parseBundle("eyJhbGciOiJIUzI1NiJ9.abc"), { tmdb: "eyJhbGciOiJIUzI1NiJ9.abc" }, "legacy bare token becomes the tmdb key");
eq(parseBundle('{"tmdb":"a","omdb":"b"}'), { tmdb: "a", omdb: "b" }, "json bundle parses");
eq(parseBundle('{"tmdb":"a","junk":"x"}'), { tmdb: "a" }, "unknown key names ignored");
eq(parseBundle("{not json"), { tmdb: "{not json" }, "unparseable falls back to a bare token");

/* ---- taste weighting: what Discover's quality rests on ---- */
// Enthusiasm has to outweigh volume, or a genre you watch constantly and rate
// 3.5 drowns out the one you rate 5 and would actually want more of.
eq(tasteWeight({ rating: 5 }), 2.5, "a five weighs 2.5");
eq(tasteWeight({ rating: 3.5 }), 1, "the threshold weighs 1");
eq(tasteWeight({ rating: 5, liked: true }), 3.5, "a like adds a full point");
eq(tasteWeight({ liked: true }), 2, "liked with no rating still counts");
ok(tasteWeight({ rating: 5 }) > tasteWeight({ rating: 4 }), "higher ratings weigh more");

eq(
	rankGenres([
		{ genres: ["Comedy"], rating: 3.5 },
		{ genres: ["Comedy"], rating: 3.5 },
		{ genres: ["Horror"], rating: 5, liked: true },
	]),
	["Horror", "Comedy"],
	"one loved horror outranks two merely-liked comedies"
);
eq(rankGenres([]), [], "no ratings, no ranking");
// Ties resolve alphabetically so the order can't drift between renders.
eq(
	rankGenres([{ genres: ["Drama"], rating: 4 }, { genres: ["Action"], rating: 4 }]),
	["Action", "Drama"],
	"ties are stable"
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
