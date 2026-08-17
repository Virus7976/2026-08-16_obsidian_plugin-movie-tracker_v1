/**
 * What to offer before anyone has typed anything.
 *
 * The search box is the most-used control in the app and it was a blank slate
 * every time you opened it. That is a wasted screen: the library already
 * knows what is in it, so it can propose the searches that would actually
 * return something rather than waiting to be told.
 *
 * Two sources, in priority order. What you searched for before, because a
 * repeat search is the commonest kind. Then what your own library is made of
 * — your most-watched directors, your biggest genres, the decades you
 * actually own. Never a generic list: a suggestion that returns nothing is
 * worse than no suggestion, because it implies the library is emptier than it
 * is.
 *
 * Pure, so the ranking can be tested without a vault.
 */

export type SuggestionKind = "recent" | "person" | "genre" | "decade";

export interface Suggestion {
	/** What the chip reads. */
	label: string;
	/** What goes into the search box. */
	query: string;
	kind: SuggestionKind;
}

export interface SuggestSource {
	recent: string[];
	/** Director and creator names, one entry per title they appear on. */
	people: string[];
	/** Genre names, one entry per title. */
	genres: string[];
	/** Release years, one per title. */
	years: number[];
}

/**
 * Rank and mix the suggestions.
 *
 * Recents first and in order, because "the thing I looked at yesterday" beats
 * any inference. Then the strongest signals from the library itself, capped
 * per kind so one prolific director cannot fill the row.
 */
export function suggestions(src: SuggestSource, limit = 8): Suggestion[] {
	const out: Suggestion[] = [];
	const taken = new Set<string>();

	const add = (label: string, query: string, kind: SuggestionKind) => {
		const key = query.trim().toLowerCase();
		if (!key || taken.has(key) || out.length >= limit) return;
		taken.add(key);
		out.push({ label, query, kind });
	};

	// Recents are already newest-first from the caller.
	for (const q of src.recent) add(q, q, "recent");

	// Two people, two genres, one decade. A fixed mix rather than "the top
	// eight by count", which on most libraries would be eight genres.
	for (const [name] of top(src.people, 2)) add(name, name, "person");
	for (const [name] of top(src.genres, 2)) add(name, name, "genre");

	const decades = src.years.filter((y) => y > 1800).map((y) => Math.floor(y / 10) * 10);
	for (const [decade] of top(decades.map(String), 1)) add(`${decade}s`, decade, "decade");

	return out;
}

/**
 * Most frequent first, ties broken alphabetically so the row does not
 * reshuffle between repaints when two values are level.
 */
function top(values: string[], n: number): [string, number][] {
	const counts = new Map<string, number>();
	for (const v of values) {
		const key = v.trim();
		if (!key) continue;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

/**
 * Add a search to the recents, newest first, without duplicates.
 *
 * Case-insensitive on the way in — searching "nolan" then "Nolan" is one
 * search repeated, and showing both would waste a slot to say nothing. The
 * newest spelling wins, since that is the one just typed.
 */
export function rememberSearch(recent: string[], query: string, cap = 6): string[] {
	const q = query.trim();
	// Single characters are almost always a search in progress rather than one
	// anybody meant to make.
	if (q.length < 2) return recent;
	const lower = q.toLowerCase();
	return [q, ...recent.filter((r) => r.trim().toLowerCase() !== lower)].slice(0, cap);
}
