/**
 * Blending several seeds into one ranked list.
 *
 * "Something like Heat" is a question Reel could already answer. "Something
 * like Heat *and* Sicario *and* Nightcrawler" is a different and much better
 * one, because the overlap between three sets is a far stronger signal than
 * anything in one of them: a film all three recommend sits in the middle of
 * what you actually asked for, and a film only one recommends is a tangent.
 *
 * So results rank by *agreement* first — how many of your seeds produced this
 * — and only then by popularity. That ordering is the whole feature. Ranking
 * by popularity first would bury the consensus pick under whatever TMDB
 * happens to be promoting, which is the failure mode of every "because you
 * watched" row ever built.
 *
 * Pure, because the ranking is the part worth arguing about and it should be
 * arguable without a network.
 */

/**
 * The minimum a title has to be for blending to work on it.
 *
 * Generic rather than a concrete shape, so the caller's own type survives the
 * blend — an earlier version declared its own item interface with an index
 * signature, which made every TMDB result structurally incompatible and would
 * have forced a cast at the one place the ranking is consumed.
 */
export interface Blendable {
	id: number;
	title?: string;
	name?: string;
	popularity?: number;
}

export interface SeedResult<T extends Blendable> {
	/** TMDB id of the film you picked. */
	seedId: number;
	/** Its title, which is what the explanation will read. */
	seedTitle: string;
	/** What TMDB recommends off the back of it, best first. */
	items: T[];
}

export interface Blended<T extends Blendable = Blendable> {
	item: T;
	/** Titles of the seeds that produced this, in the order they were given. */
	because: string[];
	/**
	 * How many seeds agreed. Kept alongside `because` rather than derived at
	 * the call site so sorting and rendering cannot disagree about it.
	 */
	agreement: number;
	/**
	 * Best position this held in any one seed's list, 0-based.
	 *
	 * TMDB returns recommendations in its own order of confidence. A title
	 * that was *first* for one seed and absent for the others is a better bet
	 * than one that was fortieth for two of them, and agreement alone cannot
	 * see that.
	 */
	bestRank: number;
}

export interface BlendOptions {
	/** TMDB ids to drop — the seeds themselves, and anything already owned. */
	exclude?: Iterable<number>;
	/**
	 * Require this many seeds to agree. 1 keeps everything; 2 or more is the
	 * "only show me the consensus" setting.
	 */
	minAgreement?: number;
}

/**
 * Merge seed result sets into one list, best first.
 *
 * The seeds themselves are always excluded even if the caller forgets:
 * recommending Heat because you picked Heat is not a recommendation, and it
 * happens constantly because TMDB's graph is not perfectly directed.
 */
export function blend<T extends Blendable>(sets: SeedResult<T>[], opts: BlendOptions = {}): Blended<T>[] {
	const drop = new Set<number>(opts.exclude ?? []);
	for (const s of sets) drop.add(s.seedId);

	const held = new Map<number, Blended<T>>();

	for (const set of sets) {
		for (const [rank, item] of set.items.entries()) {
			if (!item?.id || drop.has(item.id)) continue;

			const existing = held.get(item.id);
			if (existing) {
				// A seed can list the same title twice across pages; counting
				// it twice would fake agreement that does not exist.
				if (!existing.because.includes(set.seedTitle)) {
					existing.because.push(set.seedTitle);
					existing.agreement++;
				}
				existing.bestRank = Math.min(existing.bestRank, rank);
				continue;
			}

			held.set(item.id, { item, because: [set.seedTitle], agreement: 1, bestRank: rank });
		}
	}

	const floor = Math.max(1, opts.minAgreement ?? 1);
	return [...held.values()]
		.filter((b) => b.agreement >= floor)
		.sort(
			(a, b) =>
				// Agreement first. This is the point of the whole function.
				b.agreement - a.agreement ||
				// Then how confident any single seed was.
				a.bestRank - b.bestRank ||
				(b.item.popularity ?? 0) - (a.item.popularity ?? 0) ||
				String(a.item.title ?? a.item.name ?? "").localeCompare(String(b.item.title ?? b.item.name ?? ""))
		);
}

/**
 * The sentence under a card.
 *
 * Reads as a person would say it: two names joined by "and", three or more
 * with an Oxford-less list. Capped, because "because it's like A, B, C, D, E
 * and F" is not an explanation anybody finishes reading.
 */
export function becauseText(because: string[], cap = 3): string {
	const names = because.slice(0, cap);
	const extra = because.length - names.length;

	let list: string;
	if (names.length === 1) list = names[0];
	else if (names.length === 2) list = `${names[0]} and ${names[1]}`;
	else list = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

	if (extra > 0) list += ` and ${extra} more`;
	return `Because it's like ${list}`;
}
