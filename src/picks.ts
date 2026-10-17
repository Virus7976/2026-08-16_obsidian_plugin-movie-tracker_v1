/**
 * Tonight's picks: a few titles from the watchlist, chosen for tonight.
 *
 * A watchlist sorted by date added shows the same rows on every visit, so
 * there is nothing to come back for. This ranks it instead, on things that
 * change from one day to the next, and says why each title is there.
 *
 * What goes into a score, and why:
 *
 *   Taste       Genres and people from what you rated four or more (liked
 *               counts too), and against what you rated two or less. The
 *               biggest weight, because "you would like this" is the point.
 *   Quality     TMDB's community score, a little. It breaks ties between
 *               two things you would like equally.
 *   Tonight     A weeknight evening favours something under two hours; a
 *               weekend tolerates a long one. The clock is an input, so the
 *               same list ranks differently on a Tuesday than a Saturday.
 *   Waiting     A title that has sat on the list a few weeks gets a slow
 *               boost, so the list cannot bury its own oldest entries; a
 *               title added in the last three days gets a short one.
 *   On a service  Something you can press play on right now beats one you
 *               would have to hunt for.
 *   Rotation    Seeded noise, fixed for the day and changed by Shuffle, plus a
 *               penalty for anything shown in the last week. This is what
 *               stops the same three rows appearing every time.
 *
 * Pure: the caller supplies the clock, the salt and what was shown before, so
 * the same inputs always give the same picks and the tests can say so.
 */

import type { Entry } from "./types";

export interface TonightPick {
	entry: Entry;
	score: number;
	/** One line, in plain words, for why this one. */
	reason: string;
}

export interface PickOptions {
	now: Date;
	/** Changes the rotation. Bumped by Shuffle; 0 otherwise. */
	salt?: number;
	/** path → ISO date it was last shown as a pick. */
	shown?: Record<string, string>;
	/** How many to return. */
	count?: number;
}

const DAY = 86400000;

/** A person in a note may be a wikilink, [[Folder/Name|Name]]. Words only here. */
export function plainName(raw: string): string {
	const m = /^\[\[([^\]]*)\]\]$/.exec(raw.trim());
	if (!m) return raw;
	const inner = m[1];
	const bar = inner.indexOf("|");
	if (bar >= 0) return inner.slice(bar + 1).trim();
	return inner.split("/").pop()?.trim() ?? inner;
}

/** A stable number in [0, 1) from a string, so the same day gives the same noise. */
export function seeded(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return ((h >>> 0) % 100000) / 100000;
}

interface Taste {
	genres: Map<string, number>;
	people: Map<string, number>;
	/** The best-loved title behind each genre or person, for the reason line. */
	because: Map<string, { title: string; rating: number }>;
}

function tasteOf(all: Entry[]): Taste {
	const t: Taste = { genres: new Map(), people: new Map(), because: new Map() };
	for (const e of all) {
		if (e.status === "watchlist") continue;
		const r = e.rating ?? (e.liked ? 4 : undefined);
		if (r == null) continue;
		const w = r >= 4 ? (r - 3) / 2 + (e.liked ? 0.25 : 0) : r <= 2 ? -0.5 : 0;
		if (!w) continue;
		const add = (map: Map<string, number>, key: string, weight: number): void => {
			map.set(key, (map.get(key) ?? 0) + weight);
			if (weight > 0) {
				const prev = t.because.get(key);
				if (!prev || r > prev.rating) t.because.set(key, { title: e.title, rating: r });
			}
		};
		for (const g of e.genres) add(t.genres, g, w);
		for (const d of e.director) add(t.people, plainName(d), w * 1.5);
		for (const c of e.cast.slice(0, 3)) add(t.people, plainName(c), w * 0.5);
	}
	return t;
}

/** Score one title. The reason is the largest positive part, in words. */
function scoreOf(e: Entry, taste: Taste, o: Required<Pick<PickOptions, "now" | "salt">> & { shown: Record<string, string> }): TonightPick {
	const parts: { v: number; why: string }[] = [];

	// Taste. Genre fit is averaged so a title with six genres is not favoured
	// for having six; a director or lead you loved counts in full.
	let genre = 0;
	let genreKey = "";
	let genreBest = 0;
	for (const g of e.genres) {
		const w = taste.genres.get(g) ?? 0;
		genre += w;
		if (w > genreBest) {
			genreBest = w;
			genreKey = g;
		}
	}
	const genreFit = e.genres.length ? genre / Math.sqrt(e.genres.length) : 0;
	let person = 0;
	let personKey = "";
	let personBest = 0;
	for (const p of [...e.director, ...e.cast.slice(0, 3)].map(plainName)) {
		const w = taste.people.get(p) ?? 0;
		person += w;
		if (w > personBest) {
			personBest = w;
			personKey = p;
		}
	}
	const clip = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
	const tasteScore = clip(genreFit, -2, 3) + clip(person, -1, 2);
	if (personKey && taste.because.get(personKey)) {
		const b = taste.because.get(personKey);
		parts.push({ v: clip(person, 0, 2) * 2, why: `${personKey}, who you liked in ${b?.title}` });
	} else if (genreKey && taste.because.get(genreKey)) {
		const b = taste.because.get(genreKey);
		parts.push({ v: clip(genreFit, 0, 3) * 2, why: `Because you rated ${b?.title} ${b?.rating}★` });
	}

	// Quality
	const rating = e.tmdbRating ?? 0;
	const quality = rating ? clip((rating - 6.2) / 2, -1, 1) : 0;
	if (rating >= 7.6) parts.push({ v: quality * 1.2, why: `Highly rated, ★ ${rating.toFixed(1)}` });

	// Tonight
	const day = o.now.getDay();
	const weekend = day === 0 || day === 6 || day === 5;
	const evening = o.now.getHours() >= 17;
	let tonight = 0;
	if (e.type === "film" && e.runtime) {
		const h = Math.floor(e.runtime / 60);
		const m = e.runtime % 60;
		const len = `${h}h ${m}m`;
		if (!weekend && evening) {
			if (e.runtime <= 110) {
				tonight = 0.7;
				parts.push({ v: 1.2, why: `Short enough for a weeknight, ${len}` });
			} else if (e.runtime <= 135) tonight = 0.2;
			else tonight = -0.5;
		} else if (weekend && e.runtime >= 120) {
			tonight = 0.4;
			parts.push({ v: 0.9, why: `A proper weekend film, ${len}` });
		}
	} else if (e.type === "tv" && !weekend) tonight = 0.2;

	// Waiting
	const days = e.added ? Math.max(0, (o.now.getTime() - e.added) / DAY) : 0;
	let waiting = 0;
	if (days > 14) {
		waiting = Math.min(0.9, (days - 14) / 60);
		const weeks = Math.round(days / 7);
		parts.push({ v: waiting * 1.5, why: `Waiting on your list for ${weeks} weeks` });
	} else if (e.added && days <= 3) {
		waiting = 0.4;
		parts.push({ v: 0.5, why: "New to your list" });
	}

	// On a service
	const service = e.providers[0];
	if (service) {
		parts.push({ v: 0.7, why: `On ${service} now` });
	}

	// Rotation
	const key = `${o.now.getFullYear()}-${o.now.getMonth()}-${o.now.getDate()}|${o.salt}|${e.path}`;
	const jitter = seeded(key) * 1.3;
	const last = o.shown[e.path];
	let seen = 0;
	if (last) {
		const then = new Date(last);
		const sameDay =
			then.getFullYear() === o.now.getFullYear() && then.getMonth() === o.now.getMonth() && then.getDate() === o.now.getDate();
		const ago = (o.now.getTime() - then.getTime()) / DAY;
		// Offered earlier today is not "seen before": the picks hold still all
		// day, and only tomorrow's choice avoids them.
		if (sameDay) seen = 0;
		else if (ago < 3) seen = -1.6;
		else if (ago < 7) seen = -0.6;
	}

	const score = 2 * tasteScore + quality + tonight + waiting + (service ? 0.5 : 0) + jitter + seen;
	parts.sort((a, b) => b.v - a.v);
	const reason = parts[0]?.why ?? "From your watchlist";
	return { entry: e, score, reason };
}

/**
 * Choose tonight's few. Greedy, so each pick is the best of what is left after
 * the ones above it, with a penalty for repeating a genre and a cap on series:
 * three thrillers in a row is a list, not a choice.
 */
export function pickTonight(watchlist: Entry[], library: Entry[], opts: PickOptions): TonightPick[] {
	const count = opts.count ?? 3;
	if (!watchlist.length) return [];
	const taste = tasteOf(library);
	const o = { now: opts.now, salt: opts.salt ?? 0, shown: opts.shown ?? {} };
	const ranked = watchlist.map((e) => scoreOf(e, taste, o));

	const chosen: TonightPick[] = [];
	const usedGenres = new Set<string>();
	let shows = 0;
	const pool = [...ranked];
	while (chosen.length < count && pool.length) {
		let bestAt = 0;
		let best = -Infinity;
		pool.forEach((p, i) => {
			let s = p.score;
			if (p.entry.genres[0] && usedGenres.has(p.entry.genres[0])) s -= 0.6;
			if (p.entry.type === "tv" && shows >= 1) s -= 1.5;
			if (s > best) {
				best = s;
				bestAt = i;
			}
		});
		const [taken] = pool.splice(bestAt, 1);
		chosen.push(taken);
		if (taken.entry.genres[0]) usedGenres.add(taken.entry.genres[0]);
		if (taken.entry.type === "tv") shows++;
	}
	return chosen;
}
