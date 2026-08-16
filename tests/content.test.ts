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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
