/**
 * Watch history and episode ratings.
 *
 * This is the code that edits data you can't reconstruct. A dropped viewing or
 * a stranded rating is silent — nothing errors, the number is just wrong from
 * then on — so these assertions matter more than the count suggests.
 */

import { appendWatch, latestRating, rateEpisode, mergeSeasons, watchedCount } from "../src/util/mutations";
import type { SeasonProgress } from "../src/types";

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

/* ---- watch history ---- */
eq(appendWatch(undefined, { date: "2024-03-11" }), [{ date: "2024-03-11", rewatch: false }], "first viewing is not a rewatch");
eq(
	appendWatch([{ date: "2024-03-11", rewatch: false }], { date: "2025-01-02" }),
	[{ date: "2024-03-11", rewatch: false }, { date: "2025-01-02", rewatch: true }],
	"second viewing is a rewatch"
);
// Out-of-order entry sorts into place rather than landing at the end.
eq(
	appendWatch([{ date: "2025-01-02" }], { date: "2024-03-11" }).map((w) => w.date),
	["2024-03-11", "2025-01-02"],
	"history stays sorted by date"
);
eq(appendWatch(undefined, { date: "2024-03-11", rating: 4.4 })[0].rating, 4.5, "rating is snapped to a half star");
// A hand-typed bare date must survive, not be discarded.
eq(appendWatch(["2020-01-01"], { date: "2024-03-11" }).length, 2, "string entries are kept");
eq(appendWatch(["2020-01-01"], { date: "2024-03-11" })[0].date, "2020-01-01", "string entry keeps its date");
// Nothing about a non-array should destroy what follows.
eq(appendWatch("nonsense", { date: "2024-03-11" }).length, 1, "junk history is replaced, not crashed on");
eq(appendWatch(undefined, { date: "2024-03-11", rewatch: true })[0].rewatch, true, "explicit rewatch is honoured");

eq(latestRating([{ date: "a", rating: 3 }, { date: "b" }]), 3, "newest *rated* viewing wins, not newest overall");
eq(latestRating([{ date: "a", rating: 3 }, { date: "b", rating: 5 }]), 5, "latest rating");
eq(latestRating([]), undefined, "no history, no rating");

/* ---- episode ratings ---- */
const base: SeasonProgress[] = [
	{ n: 1, watched: "1-3", total: 6 },
	{ n: 2, watched: "", total: 10 },
];

const r1 = rateEpisode(base, 1, 2, 5);
eq(r1.seasons[0].episode_ratings, { "2": 5 }, "episode rating stored");
eq(r1.seasons[0].rating, 5, "season rating derives from its episodes");
eq(r1.average, 5, "series average derives from all episodes");
// The input must not be mutated — the caller still holds it.
eq(base[0].episode_ratings, undefined, "original seasons untouched");

const r2 = rateEpisode(r1.seasons, 1, 3, 4);
eq(r2.seasons[0].rating, 4.5, "season rating is the mean of its rated episodes");
eq(r2.average, 4.5, "series average follows");

// Rating an unwatched episode marks it watched — you can't rate what you
// haven't seen, so requiring a separate tick buys nothing.
const r3 = rateEpisode(base, 2, 4, 3);
eq(r3.seasons[1].watched, "4", "rating marks the episode watched");

// Clearing the last rating must drop the derived season rating too, or it
// claims a judgement that no longer exists.
const cleared = rateEpisode(r1.seasons, 1, 2, null);
eq(cleared.seasons[0].episode_ratings, undefined, "empty ratings map is removed");
eq(cleared.seasons[0].rating, undefined, "derived season rating is removed");
eq(cleared.average, null, "no ratings, no average");
eq(cleared.seasons[0].watched, "1-3", "clearing a rating does not unwatch the episode");

// A season absent from the list is created rather than silently dropped.
const created = rateEpisode(base, 5, 1, 4);
eq(created.seasons.length, 3, "missing season is added");
eq(created.seasons[2].n, 5, "seasons stay in order");

/* ---- season merge ---- */
const merged = mergeSeasons(
	[{ n: 1, watched: "1-6", total: 6 }],
	[{ season_number: 1, episode_count: 6 }, { season_number: 2, episode_count: 8 }],
	false
);
eq(merged.length, 2, "new season added");
eq(merged[0].watched, "1-6", "existing progress preserved");
eq(merged[1].watched, "", "new season starts empty");
eq(mergeSeasons([], [{ season_number: 0, episode_count: 3 }], false).length, 0, "specials excluded by default");
eq(mergeSeasons([], [{ season_number: 0, episode_count: 3 }], true).length, 1, "specials included when asked");
// A re-run of the same payload must not duplicate anything.
eq(mergeSeasons(merged, [{ season_number: 1, episode_count: 6 }], false).length, 2, "merge is idempotent");

eq(watchedCount([{ n: 1, watched: "1-7" }, { n: 2, watched: "1-5,7-9" }]), 15, "episodes counted across seasons");
eq(watchedCount([]), 0, "no seasons, no episodes");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
