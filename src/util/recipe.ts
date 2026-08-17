/**
 * A discovery recipe: what you're in the mood for, as data.
 *
 * The point of making this a plain object rather than a pile of UI state is
 * that it can be counted before it is run, diagnosed when it returns nothing,
 * and saved under a name you'll recognise later. All three are things a
 * filter bar cannot do, and all three are the difference between a form and a
 * tool.
 *
 * Pure. Every function here turns a recipe into either TMDB parameters or an
 * explanation, and neither needs a network to be argued with.
 */

export type SeedPool = "loved" | "rewatch" | "all";

export interface Recipe {
	/** A name, once saved. Absent while you are still building it. */
	name?: string;
	/** TMDB ids of the titles to recommend from. */
	seeds: number[];
	/** Which of your own films the picker offered. */
	pool: SeedPool;
	/** Genre ids that must all be present ("both") or any ("either"). */
	genres: number[];
	genreMode: "all" | "any";
	/** Genre ids to rule out entirely. */
	withoutGenres: number[];
	/** TMDB's own score, out of 10. */
	minScore?: number;
	/** Minutes. Phrased to the user as time available, not as runtime. */
	maxRuntime?: number;
	/**
	 * Release decades, e.g. [1990, 2010].
	 *
	 * A list rather than one value because "the 90s or the 2010s" is an
	 * ordinary thing to want and being made to choose one is arbitrary. TMDB
	 * cannot express two disjoint date ranges in a single query, so the engine
	 * runs one per decade and merges — see DiscoverEngine.run.
	 */
	decades: number[];
	/** Hide anything already in the library — usually what you want. */
	excludeOwned: boolean;
	/** Require this many seeds to agree before a title is shown. */
	minAgreement: number;
}

export function emptyRecipe(): Recipe {
	return {
		seeds: [],
		pool: "loved",
		genres: [],
		genreMode: "all",
		withoutGenres: [],
		decades: [],
		excludeOwned: true,
		minAgreement: 1,
	};
}

/**
 * TMDB `/discover` parameters for a recipe.
 *
 * The genre mode is the whole reason this function exists. TMDB reads a comma
 * in `with_genres` as AND and a pipe as OR, which is a real and useful
 * distinction hidden behind punctuation — "action AND comedy" finds action
 * comedies, "action OR comedy" finds twice as many films that are neither.
 */
export function toDiscoverParams(recipe: Recipe, only?: number): Record<string, string> {
	const params: Record<string, string> = {};

	if (recipe.genres.length) {
		params.with_genres = recipe.genres.join(recipe.genreMode === "all" ? "," : "|");
	}
	// Always OR: "not horror and not musicals" means exclude both, so any
	// match is a reason to drop it.
	if (recipe.withoutGenres.length) params.without_genres = recipe.withoutGenres.join("|");

	if (recipe.minScore != null) {
		params["vote_average.gte"] = String(recipe.minScore);
		// A 9.5 from four people is not a well-rated film. Without a vote
		// floor a high score filter returns obscure noise, which reads as the
		// filter being broken rather than as it working literally.
		params["vote_count.gte"] = "50";
	}

	if (recipe.maxRuntime != null) params["with_runtime.lte"] = String(recipe.maxRuntime);

	// Exactly one decade goes into a query. Several cannot: TMDB takes a
	// single date range, and asking for 1990–2019 to cover "the 90s or the
	// 2010s" would quietly include the 2000s as well. The engine runs one
	// query per decade instead, which is exact.
	if (only != null) {
		params["primary_release_date.gte"] = `${only}-01-01`;
		params["primary_release_date.lte"] = `${only + 9}-12-31`;
	}

	return params;
}

/** Every constraint currently narrowing things, as one line each. */
export function describeConstraints(recipe: Recipe, genreName: (id: number) => string): string[] {
	const out: string[] = [];
	if (recipe.genres.length) {
		const joiner = recipe.genreMode === "all" ? " and " : " or ";
		out.push(recipe.genres.map(genreName).join(joiner));
	}
	if (recipe.withoutGenres.length) out.push(`not ${recipe.withoutGenres.map(genreName).join(" or ")}`);
	if (recipe.minScore != null) out.push(`rated ${recipe.minScore}+ on TMDB`);
	if (recipe.maxRuntime != null) out.push(`under ${recipe.maxRuntime} minutes`);
	if (recipe.decades.length) out.push(recipe.decades.map((d) => `${d}s`).join(" or "));
	if (recipe.excludeOwned) out.push("not already in your library");
	if (recipe.minAgreement > 1) out.push(`${recipe.minAgreement}+ of your picks agree`);
	return out;
}

/** One constraint, and what removing it would be worth. */
export interface Culprit {
	/** Which field to relax. */
	key: keyof Recipe;
	/** How to say it: "your 90 minute limit". */
	label: string;
	/** How many results come back without it. */
	without: number;
}

/**
 * Which single constraint is doing the damage.
 *
 * "No results" is a dead end; "your runtime limit is what's cutting it — drop
 * it and you get 40" is an action. The caller re-runs the count once per
 * constraint with that one removed, and this picks the most valuable to lose.
 *
 * Deliberately reports one, not a list. Offering five things to relax is the
 * same dead end with extra steps — the useful answer is the single change
 * that gets you furthest.
 */
export function blame(candidates: Culprit[]): Culprit | null {
	const useful = candidates.filter((c) => c.without > 0);
	if (!useful.length) return null;
	// Most results recovered wins; ties break toward the constraint that is
	// least likely to be the point of the search. Genre is usually *why* you
	// came, so it is the last thing to suggest giving up.
	const rank: Partial<Record<keyof Recipe, number>> = {
		minScore: 0,
		maxRuntime: 1,
		decades: 2,
		minAgreement: 3,
		withoutGenres: 4,
		excludeOwned: 5,
		genres: 6,
	};
	return useful.sort((a, b) => b.without - a.without || (rank[a.key] ?? 9) - (rank[b.key] ?? 9))[0];
}

/**
 * Recipes with the same shape are the same recipe.
 *
 * Used to spot a duplicate before saving another copy under a new name, and
 * to mark the saved recipe you are currently looking at. Order within the
 * genre lists is not meaningful, so it is normalised away.
 */
export function recipeKey(recipe: Recipe): string {
	return JSON.stringify({
		seeds: [...recipe.seeds].sort((a, b) => a - b),
		genres: [...recipe.genres].sort((a, b) => a - b),
		genreMode: recipe.genreMode,
		withoutGenres: [...recipe.withoutGenres].sort((a, b) => a - b),
		minScore: recipe.minScore ?? null,
		maxRuntime: recipe.maxRuntime ?? null,
		decades: [...recipe.decades].sort((a, b) => a - b),
		excludeOwned: recipe.excludeOwned,
		minAgreement: recipe.minAgreement,
	});
}
