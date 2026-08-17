/**
 * Blending seeds, and the recipe that constrains them.
 *
 * The ranking is the feature. If agreement does not beat popularity, the
 * consensus pick sinks under whatever TMDB is promoting that week — which is
 * exactly the "because you watched" row this replaces.
 */

import { blend, becauseText } from "../src/util/blend";
import {
	toDiscoverParams,
	blame,
	emptyRecipe,
	recipeKey,
	describeConstraints,
	matchesRecipe,
	unappliedWithSeeds,
} from "../src/util/recipe";

let pass = 0;
let fail = 0;

function eq(actual: unknown, expected: unknown, label: string) {
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	if (a === b) pass++;
	else {
		fail++;
			}
}

function ok(v: boolean, label: string) {
	eq(v, true, label);
}

const f = (id: number, popularity = 1) => ({ id, title: `F${id}`, popularity });

/* ---- agreement beats popularity ---- */

// The whole point. F1 is recommended by both seeds but is unpopular; F2 is
// wildly popular but only one seed suggests it. F1 has to win.
{
	const out = blend([
		{ seedId: 100, seedTitle: "Heat", items: [f(1, 1), f(2, 999)] },
		{ seedId: 200, seedTitle: "Sicario", items: [f(1, 1)] },
	]);
	eq(out[0].item.id, 1, "the title both seeds agree on leads");
	eq(out[0].agreement, 2, "and its agreement is counted");
	eq(out[1].item.id, 2, "the popular one-seed pick comes second");
}

/* ---- the seeds themselves never come back ---- */

// TMDB's graph is not perfectly directed, so a seed routinely appears in
// another seed's recommendations. Recommending Heat because you picked Heat
// is not a recommendation.
{
	const out = blend([
		{ seedId: 100, seedTitle: "Heat", items: [f(200), f(1)] },
		{ seedId: 200, seedTitle: "Sicario", items: [f(100), f(1)] },
	]);
	eq(out.map((b) => b.item.id), [1], "both seeds are dropped from their own results");
}

/* ---- explicit exclusions ---- */

{
	const out = blend([{ seedId: 1, seedTitle: "A", items: [f(2), f(3)] }], { exclude: [3] });
	eq(out.map((b) => b.item.id), [2], "an excluded id is dropped");
}

/* ---- a seed listing the same title twice does not fake agreement ---- */

{
	const out = blend([{ seedId: 1, seedTitle: "A", items: [f(2), f(2)] }]);
	eq(out.length, 1, "the duplicate collapses");
	eq(out[0].agreement, 1, "and agreement stays at one, not two");
	eq(out[0].because, ["A"], "with the seed named once");
}

/* ---- rank breaks ties within an agreement level ---- */

// A title that was *first* for one seed is a better bet than one that was
// fortieth for one seed, and agreement alone cannot see the difference.
{
	const many = Array.from({ length: 5 }, (_, i) => f(i + 10, 1));
	const out = blend([
		{ seedId: 1, seedTitle: "A", items: many },
		{ seedId: 2, seedTitle: "B", items: [] },
	]);
	eq(out[0].item.id, 10, "the seed's own top pick leads its level");
	eq(out[0].bestRank, 0, "and its best rank is recorded");
}

/* ---- consensus-only mode ---- */

{
	const sets = [
		{ seedId: 1, seedTitle: "A", items: [f(9), f(8)] },
		{ seedId: 2, seedTitle: "B", items: [f(9)] },
	];
	eq(blend(sets, { minAgreement: 2 }).map((b) => b.item.id), [9], "only the agreed title survives");
	eq(blend(sets, { minAgreement: 1 }).length, 2, "and a floor of one keeps everything");
	// A floor below one would be meaningless, and a caller can easily pass 0.
	eq(blend(sets, { minAgreement: 0 }).length, 2, "a floor of zero is treated as one");
}

eq(blend([]), [], "no seeds, no results");

/* ---- the sentence under the card ---- */

eq(becauseText(["Heat"]), "Because it's like Heat", "one seed");
eq(becauseText(["Heat", "Sicario"]), "Because it's like Heat and Sicario", "two are joined with and");
eq(becauseText(["A", "B", "C"]), "Because it's like A, B and C", "three read as a list");
eq(becauseText(["A", "B", "C", "D"]), "Because it's like A, B and C and 1 more", "beyond the cap it counts the rest");

/* ---- recipe to TMDB parameters ---- */

// The distinction the whole "both/either" control exists for. A comma is AND
// and a pipe is OR — a real difference hidden behind punctuation.
{
	const r = { ...emptyRecipe(), genres: [28, 35], genreMode: "all" as const };
	eq(toDiscoverParams(r).with_genres, "28,35", "'both' joins with a comma, which TMDB reads as AND");
}
{
	const r = { ...emptyRecipe(), genres: [28, 35], genreMode: "any" as const };
	eq(toDiscoverParams(r).with_genres, "28|35", "'either' joins with a pipe, which TMDB reads as OR");
}

// Exclusions are always OR: "not horror and not musicals" means either is
// reason enough to drop it.
{
	const r = { ...emptyRecipe(), withoutGenres: [27, 10402] };
	eq(toDiscoverParams(r).without_genres, "27|10402", "exclusions are joined with a pipe");
}

// A 9.5 from four people is not a well-rated film, and a score filter with no
// vote floor returns obscure noise that reads as the filter being broken.
{
	const p = toDiscoverParams({ ...emptyRecipe(), minScore: 7 });
	eq(p["vote_average.gte"], "7", "the score floor is passed through");
	eq(p["vote_count.gte"], "50", "and a vote floor rides along with it");
}

{
	const p = toDiscoverParams({ ...emptyRecipe(), maxRuntime: 90 });
	eq(p["with_runtime.lte"], "90", "time available becomes a runtime ceiling");
}

{
	const p = toDiscoverParams({ ...emptyRecipe(), decades: [1990] }, 1990);
	eq(p["primary_release_date.gte"], "1990-01-01", "a decade starts at its first day");
	eq(p["primary_release_date.lte"], "1999-12-31", "and ends at its last");
}

eq(Object.keys(toDiscoverParams(emptyRecipe())).length, 0, "an empty recipe constrains nothing");

/* ---- naming the culprit ---- */

eq(blame([]), null, "nothing to blame when there are no candidates");
// A constraint whose removal changes nothing is not the culprit.
eq(blame([{ key: "decades", label: "the 1990s", without: 0 }]), null, "a constraint that recovers nothing is not blamed");

{
	const worst = blame([
		{ key: "decades", label: "the 1990s", without: 3 },
		{ key: "maxRuntime", label: "your 90 minute limit", without: 40 },
	]);
	eq(worst?.key, "maxRuntime", "the constraint recovering the most results is blamed");
}

// Genre is usually *why* you came, so it is the last thing to suggest giving
// up when two constraints would recover the same amount.
{
	const tie = blame([
		{ key: "genres", label: "action and comedy", without: 10 },
		{ key: "minScore", label: "your 7+ filter", without: 10 },
	]);
	eq(tie?.key, "minScore", "on a tie, the score goes before the genre");
}

/* ---- recipe identity ---- */

{
	const a = { ...emptyRecipe(), genres: [28, 35], seeds: [1, 2] };
	const b = { ...emptyRecipe(), genres: [35, 28], seeds: [2, 1] };
	eq(recipeKey(a), recipeKey(b), "order within the lists is not part of the identity");

	const c = { ...emptyRecipe(), genres: [28, 35], seeds: [1, 2], minScore: 7 };
	ok(recipeKey(a) !== recipeKey(c), "but an added constraint is");

	// The name is a label, not part of what the recipe *is* — otherwise
	// renaming one would make it a different recipe.
	const d = { ...a, name: "Sunday afternoon" };
	eq(recipeKey(a), recipeKey(d), "the name is not part of the identity");
}

/* ---- constraints in words ---- */

{
	const names: Record<number, string> = { 28: "Action", 35: "Comedy", 27: "Horror" };
	const say = (id: number) => names[id] ?? String(id);

	eq(
		describeConstraints({ ...emptyRecipe(), genres: [28, 35], genreMode: "all", excludeOwned: false }, say),
		["Action and Comedy"],
		"'both' reads as and"
	);
	eq(
		describeConstraints({ ...emptyRecipe(), genres: [28, 35], genreMode: "any", excludeOwned: false }, say),
		["Action or Comedy"],
		"'either' reads as or"
	);
	eq(
		describeConstraints({ ...emptyRecipe(), withoutGenres: [27], excludeOwned: false }, say),
		["not Horror"],
		"an exclusion reads as a negation"
	);
	eq(
		describeConstraints({ ...emptyRecipe(), maxRuntime: 90, excludeOwned: false }, say),
		["under 90 minutes"],
		"time available reads as a limit"
	);
	ok(
		describeConstraints({ ...emptyRecipe() }, say).includes("not already in your library"),
		"excluding owned titles is stated, since it is on by default"
	);
}

console.log(`\n${pass} passed, ${fail} failed`);

/* ---- filtering a blended list against the recipe ---- */

// The bug this replaces: the seeded path intersected ~20 recommendations with
// page one of /discover — 20 results drawn from thousands. Two unrelated
// samples almost never overlap, so a recipe matching 6,181 films reported
// nothing, and dropping a constraint only changed which twenty came back.
{
	const action = { genre_ids: [28], vote_average: 8, release_date: "2005-01-01" };
	const comedy = { genre_ids: [35], vote_average: 8, release_date: "2005-01-01" };
	const both = { genre_ids: [28, 35], vote_average: 8, release_date: "2005-01-01" };

	const all = { ...emptyRecipe(), genres: [28, 35], genreMode: "all" as const };
	eq(matchesRecipe(both, all), true, "a title with both genres passes 'both'");
	eq(matchesRecipe(action, all), false, "one of the two is not enough");

	const any = { ...emptyRecipe(), genres: [28, 35], genreMode: "any" as const };
	eq(matchesRecipe(action, any), true, "either genre passes 'either'");
	eq(matchesRecipe(comedy, any), true, "and so does the other");
	eq(matchesRecipe({ genre_ids: [18] }, any), false, "neither does not");
}

{
	const horror = { genre_ids: [27, 28], vote_average: 8 };
	eq(matchesRecipe(horror, { ...emptyRecipe(), withoutGenres: [27] }), false, "an excluded genre rules it out");
	eq(matchesRecipe(horror, { ...emptyRecipe(), withoutGenres: [10402] }), true, "an unrelated exclusion does not");
}

{
	const r = { ...emptyRecipe(), minScore: 7 };
	eq(matchesRecipe({ vote_average: 7 }, r), true, "exactly the floor passes");
	eq(matchesRecipe({ vote_average: 6.9 }, r), false, "just under does not");
	// An unrated title has not scored zero — but it cannot be shown to clear
	// the bar either, and letting it through would be the filter not working.
	eq(matchesRecipe({}, r), false, "a title with no score does not pass a score filter");
}

{
	const r = { ...emptyRecipe(), decades: [1990, 2010] };
	eq(matchesRecipe({ release_date: "1995-06-01" }, r), true, "inside the first decade");
	eq(matchesRecipe({ release_date: "2019-12-31" }, r), true, "and the last day of the second");
	eq(matchesRecipe({ release_date: "2005-01-01" }, r), false, "the gap between them is excluded");
	eq(matchesRecipe({ release_date: "1990-01-01" }, r), true, "the first day counts");
	eq(matchesRecipe({}, r), false, "no date cannot satisfy a decade");
	// A series carries first_air_date instead.
	eq(matchesRecipe({ first_air_date: "1995-01-01" }, r), true, "a series uses its air date");
}

// The whole point: with several constraints at once, a matching title matches.
{
	const r = { ...emptyRecipe(), genres: [28, 35], genreMode: "all" as const, minScore: 7, decades: [2000] };
	eq(matchesRecipe({ genre_ids: [28, 35, 80], vote_average: 7.6, release_date: "2007-02-14" }, r), true,
		"an action comedy from the 2000s rated 7.6 passes all of it");
}

// Runtime cannot be checked without a detail request per candidate, so it is
// reported as unapplied rather than silently ignored.
eq(unappliedWithSeeds({ ...emptyRecipe(), maxRuntime: 90 }), ["under 90 minutes"], "a runtime limit is declared unapplied");
eq(unappliedWithSeeds(emptyRecipe()), [], "and nothing is claimed when none is set");

console.log(`
${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
