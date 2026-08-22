/**
 * "Something short and funny I haven't seen, nothing too bleak."
 *
 * The point of this file is how *little* of that question the model answers.
 *
 * The naive version sends the whole library and asks which titles fit. It works
 * on a demo library and then falls apart on a real one: a thousand titles is a
 * large, slow, expensive prompt, the model quietly forgets the middle of a long
 * list, and it will happily recommend a film you do not own because it knows
 * the film exists. You cannot check any of that from the outside — you get an
 * answer that looks right and is wrong in a way nothing surfaces.
 *
 * So the work is split at the seam where it naturally divides:
 *
 *   1. The model reads the sentence and says what it *means* — genres, a decade,
 *      a runtime ceiling, seen or unseen, a mood restated in its own words. A
 *      small answer to a small question, and the only part that needs language.
 *
 *   2. Reel applies that to the library itself. Ordinary filtering and scoring
 *      over frontmatter, locally, exactly and instantly, over every title you
 *      own with none skipped. This is the part that must not be guessed at, so
 *      it isn't.
 *
 *   3. The model ranks the shortlist that survives and says why each one fits.
 *      Sixty short lines in, ten choices out.
 *
 * The result: it cannot invent a film you do not have, because step 3 only ever
 * sees titles step 2 handed it. The expensive prompt is bounded whatever the
 * library's size. And step 1's interpretation is shown to you in the UI, so
 * when the answer is odd you can see it read "bleak" as "no horror" and say so,
 * rather than shrugging at a black box.
 */

import type { Entry } from "../types";
import { hasBeenWatched } from "../util/status";
import type { OpenRouterClient } from "./openrouter";

export interface AskCriteria {
	/** Which part of the library to look in. */
	pool: "watchlist" | "watched" | "any";
	type: "film" | "tv" | "any";
	genres: string[];
	excludeGenres: string[];
	yearFrom: number | null;
	yearTo: number | null;
	/** Minutes. For a series this is measured per episode. */
	minRuntime: number | null;
	maxRuntime: number | null;
	/** Your own star rating, 0–5. */
	minRating: number | null;
	/** Free words worth matching against titles, genres and people. */
	keywords: string[];
	/** The question restated, so you can see what it thought you meant. */
	restated: string;
}

export interface AskPick {
	/** Index into the shortlist handed to the model. Never a title it invented. */
	index: number;
	/** One line on why this one, in the model's words. */
	why: string;
}

export interface AskResult {
	criteria: AskCriteria;
	/** The chosen titles, best first, each with its reason. */
	picks: { entry: Entry; why: string }[];
	/** How many titles survived the local filter before ranking. */
	considered: number;
	/** Filters that had to be dropped to find anything at all. */
	relaxed: string[];
	promptTokens: number;
	completionTokens: number;
}

export const EMPTY_CRITERIA: AskCriteria = {
	pool: "any",
	type: "any",
	genres: [],
	excludeGenres: [],
	yearFrom: null,
	yearTo: null,
	minRuntime: null,
	maxRuntime: null,
	minRating: null,
	keywords: [],
	restated: "",
};

/* ------------------------------------------------------------------ */
/* The deterministic middle                                            */
/* ------------------------------------------------------------------ */

/** Which pool an entry belongs to, asked the way `matchesStatus` asks it. */
function inPool(entry: Entry, pool: AskCriteria["pool"]): boolean {
	if (pool === "any") return true;
	const seen = hasBeenWatched(entry);
	if (pool === "watched") return seen;
	// "Watchlist" means what you haven't got to yet — which is not the same as
	// the status literally reading `watchlist`. A show you started and
	// abandoned is not something to recommend as unseen.
	return !seen;
}

/** A film's runtime, or a series' per-episode one. Undefined when unknown. */
export function effectiveRuntime(entry: Entry): number | undefined {
	const value = entry.type === "tv" ? entry.episodeRuntime : entry.runtime;
	return value && value > 0 ? value : undefined;
}

/** The year people mean when they name the thing. */
export function effectiveYear(entry: Entry): number | undefined {
	return entry.type === "tv" ? entry.firstAirYear : entry.year;
}

interface Gate {
	name: string;
	/** True when this entry passes. */
	pass(entry: Entry): boolean;
}

/**
 * The hard filters, in the order they get given up.
 *
 * Order matters and is not alphabetical. Runtime goes first because "about
 * ninety minutes" is the softest thing anybody means; genre goes last but one
 * because it is usually the actual request; the pool never goes at all, since
 * "something I haven't seen" is not a preference to be negotiated away — a
 * recommendation you have already watched is not a near miss, it is a wrong
 * answer.
 */
function gates(c: AskCriteria): Gate[] {
	const out: Gate[] = [];

	if (c.minRuntime != null || c.maxRuntime != null) {
		out.push({
			name: "length",
			pass: (e) => {
				const mins = effectiveRuntime(e);
				// An unknown runtime is not a failed one. Half an imported
				// library has no runtime at all, and excluding it would answer
				// "something short" with only the titles that happen to be
				// well-catalogued.
				if (mins == null) return true;
				if (c.minRuntime != null && mins < c.minRuntime) return false;
				if (c.maxRuntime != null && mins > c.maxRuntime) return false;
				return true;
			},
		});
	}

	if (c.yearFrom != null || c.yearTo != null) {
		out.push({
			name: "era",
			pass: (e) => {
				const y = effectiveYear(e);
				if (y == null) return true;
				if (c.yearFrom != null && y < c.yearFrom) return false;
				if (c.yearTo != null && y > c.yearTo) return false;
				return true;
			},
		});
	}

	if (c.minRating != null) {
		out.push({ name: "rating", pass: (e) => (e.rating ?? 0) >= (c.minRating as number) });
	}

	if (c.genres.length) {
		const want = c.genres.map(lower);
		out.push({ name: "genre", pass: (e) => e.genres.some((g) => want.includes(lower(g))) });
	}

	return out;
}

/**
 * Every title that could answer the question, best-scoring first.
 *
 * Relaxation is the interesting behaviour. "A short French thriller from the
 * nineties I haven't seen" is four constraints, and a personal library is
 * small — the honest outcome is usually "nothing matches all four". Returning
 * nothing is correct and useless, so instead the softest gate is dropped and
 * the search runs again, and the caller is told exactly which ones were let go.
 * The answer becomes "nothing that short, but here are the nineties thrillers",
 * which is what a person would have said.
 */
export function shortlist(
	entries: Entry[],
	c: AskCriteria,
	limit: number
): { picked: Entry[]; relaxed: string[] } {
	const pool = entries.filter((e) => inPool(e, c.pool));
	const typed = c.type === "any" ? pool : pool.filter((e) => e.type === c.type);

	const excluded = c.excludeGenres.length
		? typed.filter((e) => {
				const no = c.excludeGenres.map(lower);
				return !e.genres.some((g) => no.includes(lower(g)));
			})
		: typed;

	const all = gates(c);
	const relaxed: string[] = [];

	// Drop one gate at a time from the front, which is the softest first.
	for (let drop = 0; drop <= all.length; drop++) {
		const active = all.slice(drop);
		const kept = excluded.filter((e) => active.every((g) => g.pass(e)));
		if (kept.length || drop === all.length) {
			const scored = kept
				.map((e) => ({ e, score: score(e, c) }))
				.sort((a, b) => b.score - a.score || (a.e.title > b.e.title ? 1 : -1));
			return { picked: scored.slice(0, limit).map((s) => s.e), relaxed };
		}
		relaxed.push(all[drop].name);
	}

	return { picked: [], relaxed };
}

/**
 * How well one title answers the question, before the model sees it.
 *
 * This only has to be good enough to decide which sixty of four hundred are
 * worth paying to rank — it is a sieve, not a verdict. Genre overlap dominates
 * because it is the one signal that is actually structured; keywords count for
 * less because they are matched by substring and a substring match is a guess.
 */
export function score(entry: Entry, c: AskCriteria): number {
	let n = 0;

	const want = c.genres.map(lower);
	for (const g of entry.genres) if (want.includes(lower(g))) n += 3;

	if (c.keywords.length) {
		const hay = [entry.title, ...entry.genres, ...entry.director, ...entry.creators, ...entry.cast.slice(0, 6)]
			.join(" ")
			.toLowerCase();
		for (const k of c.keywords) {
			const word = lower(k);
			if (word.length > 2 && hay.includes(word)) n += 2;
		}
	}

	/*
	 * Your own opinion outranks the crowd's, and both are tiebreakers rather
	 * than reasons — a five-star film in the wrong genre is still wrong.
	 *
	 * The weight matters more than it looks. At 0.6 a five-star film scored
	 * exactly 3.0, which is precisely one genre match, so a beloved war film
	 * tied with an actual comedy when a comedy was what you asked for. The
	 * ceiling has to sit *below* a single genre hit for "tiebreaker" to be true
	 * rather than merely intended.
	 */
	if (entry.rating) n += entry.rating * 0.4;
	else if (entry.tmdbRating) n += entry.tmdbRating * 0.05;

	// A title with no genres at all can't lose on genre alone; nudge it down so
	// it doesn't outrank a real match purely on its rating.
	if (!entry.genres.length) n -= 1;

	return n;
}

/**
 * One title, in as few characters as will still let a model judge it.
 *
 * No path, no review text, no watch dates. Partly because none of it helps
 * rank a film, and mostly because this is the payload that leaves the vault,
 * and the smallest useful version of it is the right one to send.
 */
export function digest(entry: Entry, index: number): string {
	const bits: string[] = [];
	const year = effectiveYear(entry);
	bits.push(`${index}. ${entry.title}${year ? ` (${year})` : ""}`);
	if (entry.type === "tv") bits.push("series");
	if (entry.genres.length) bits.push(entry.genres.slice(0, 3).join("/"));
	const mins = effectiveRuntime(entry);
	if (mins) bits.push(`${mins}m`);
	const people = entry.type === "tv" ? entry.creators : entry.director;
	if (people.length) bits.push(`dir ${people[0]}`);
	if (entry.rating) bits.push(`you ${entry.rating}/5`);
	bits.push(hasBeenWatched(entry) ? "seen" : "unseen");
	return bits.join(" · ");
}

function lower(s: string): string {
	return s.trim().toLowerCase();
}

/* ------------------------------------------------------------------ */
/* The two model calls                                                 */
/* ------------------------------------------------------------------ */

const CRITERIA_SCHEMA: Record<string, unknown> = {
	type: "object",
	additionalProperties: false,
	required: [
		"pool",
		"type",
		"genres",
		"excludeGenres",
		"yearFrom",
		"yearTo",
		"minRuntime",
		"maxRuntime",
		"minRating",
		"keywords",
		"restated",
	],
	properties: {
		pool: { type: "string", enum: ["watchlist", "watched", "any"] },
		type: { type: "string", enum: ["film", "tv", "any"] },
		genres: { type: "array", items: { type: "string" } },
		excludeGenres: { type: "array", items: { type: "string" } },
		yearFrom: { type: ["integer", "null"] },
		yearTo: { type: ["integer", "null"] },
		minRuntime: { type: ["integer", "null"] },
		maxRuntime: { type: ["integer", "null"] },
		minRating: { type: ["number", "null"] },
		keywords: { type: "array", items: { type: "string" } },
		restated: { type: "string" },
	},
};

const PICKS_SCHEMA: Record<string, unknown> = {
	type: "object",
	additionalProperties: false,
	required: ["picks"],
	properties: {
		picks: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["index", "why"],
				properties: {
					index: { type: "integer" },
					why: { type: "string" },
				},
			},
		},
	},
};

/**
 * TMDB's genre vocabulary, given to the model so it answers in the same words
 * the library is written in.
 *
 * Without this it returns "comedy-drama", "feel-good" and "dramedy", none of
 * which appear in any note, and the genre gate matches nothing — which then
 * gets relaxed away, and the whole first stage has achieved nothing at all.
 */
const GENRES = [
	"Action",
	"Adventure",
	"Animation",
	"Comedy",
	"Crime",
	"Documentary",
	"Drama",
	"Family",
	"Fantasy",
	"History",
	"Horror",
	"Music",
	"Mystery",
	"Romance",
	"Science Fiction",
	"TV Movie",
	"Thriller",
	"War",
	"Western",
	"Action & Adventure",
	"Kids",
	"News",
	"Reality",
	"Sci-Fi & Fantasy",
	"Soap",
	"Talk",
	"War & Politics",
];

export async function readCriteria(
	client: OpenRouterClient,
	question: string,
	thisYear: number
): Promise<{ criteria: AskCriteria; promptTokens: number; completionTokens: number }> {
	const system = [
		"You turn a sentence about what someone feels like watching into filter criteria for their own film and TV library.",
		"",
		`Use only these genre names, spelled exactly: ${GENRES.join(", ")}.`,
		"",
		"Rules:",
		`- "haven't seen", "something new", "what should I watch" means pool "watchlist". "again", "rewatch", "I loved" means "watched". Otherwise "any".`,
		`- Runtimes are in minutes. "short" is about 100 max for a film, 35 for a series episode. "long" is 150 min.`,
		`- Decades map to year ranges: "the nineties" is 1990 to 1999. "recent" is ${thisYear - 5} onwards.`,
		`- minRating is the person's own 0-5 star rating, and only belongs when they ask for things they rated highly.`,
		"- excludeGenres is for what they say they do NOT want. Read the mood: bleak, heavy or depressing usually means excluding Horror and War, not Drama.",
		"- keywords are extra words worth matching against titles, directors and actors. Leave it empty when there are none. Do not put genres in it.",
		"- Prefer fewer constraints. Every one you add can only remove titles from a library that may be small.",
		"- restated: one short sentence saying what you understood, addressed to them, e.g. \"Short comedies you haven't watched yet.\"",
	].join("\n");

	const res = await client.json<AskCriteria>(
		[
			{ role: "system", content: system },
			{ role: "user", content: question },
		],
		CRITERIA_SCHEMA,
		"criteria"
	);

	return {
		criteria: sanitise(res.value),
		promptTokens: res.promptTokens ?? 0,
		completionTokens: res.completionTokens ?? 0,
	};
}

/**
 * Whatever came back, made safe to run against the library.
 *
 * A model that returns `maxRuntime: 0`, a year of 12000, or `pool: "unseen"`
 * should degrade to a looser search, never to an empty one or a crash. Every
 * value here is either usable or discarded — there is no third state where a
 * nonsense number silently filters the whole library away.
 */
export function sanitise(raw: Partial<AskCriteria> | null | undefined): AskCriteria {
	const c: AskCriteria = { ...EMPTY_CRITERIA, ...(raw ?? {}) };

	const pools = ["watchlist", "watched", "any"];
	c.pool = pools.includes(c.pool) ? c.pool : "any";
	const types = ["film", "tv", "any"];
	c.type = types.includes(c.type) ? c.type : "any";

	c.genres = cleanList(c.genres);
	c.excludeGenres = cleanList(c.excludeGenres);
	c.keywords = cleanList(c.keywords).slice(0, 8);

	c.yearFrom = year(c.yearFrom);
	c.yearTo = year(c.yearTo);
	if (c.yearFrom != null && c.yearTo != null && c.yearFrom > c.yearTo) {
		[c.yearFrom, c.yearTo] = [c.yearTo, c.yearFrom];
	}

	c.minRuntime = minutes(c.minRuntime);
	c.maxRuntime = minutes(c.maxRuntime);
	if (c.minRuntime != null && c.maxRuntime != null && c.minRuntime > c.maxRuntime) {
		[c.minRuntime, c.maxRuntime] = [c.maxRuntime, c.minRuntime];
	}

	const r = Number(c.minRating);
	c.minRating = Number.isFinite(r) && r > 0 && r <= 5 ? r : null;

	c.restated = typeof c.restated === "string" ? c.restated.trim().slice(0, 200) : "";

	// A genre in both lists is a contradiction, and keeping it would filter the
	// library to nothing. What they asked for wins over what they didn't.
	const wanted = c.genres.map(lower);
	c.excludeGenres = c.excludeGenres.filter((g) => !wanted.includes(lower(g)));

	return c;
}

function cleanList(v: unknown): string[] {
	if (!Array.isArray(v)) return [];
	const out: string[] = [];
	for (const item of v) {
		const s = String(item ?? "").trim();
		if (s && !out.some((x) => lower(x) === lower(s))) out.push(s);
	}
	return out;
}

function year(v: unknown): number | null {
	const n = Number(v);
	if (!Number.isFinite(n)) return null;
	return n >= 1870 && n <= 2200 ? Math.round(n) : null;
}

function minutes(v: unknown): number | null {
	const n = Number(v);
	if (!Number.isFinite(n)) return null;
	return n > 0 && n <= 1200 ? Math.round(n) : null;
}

export async function rank(
	client: OpenRouterClient,
	question: string,
	criteria: AskCriteria,
	candidates: Entry[],
	want: number
): Promise<{ picks: AskPick[]; promptTokens: number; completionTokens: number }> {
	const lines = candidates.map((e, i) => digest(e, i)).join("\n");

	const system = [
		"You are choosing from someone's own film and TV library. Every candidate is numbered.",
		"",
		`Pick at most ${want}, best first, and give one short sentence for each saying why it answers what they asked.`,
		"",
		"Rules:",
		"- Only ever use an index from the list. Never name a title that isn't there.",
		"- If fewer than that genuinely fit, return fewer. A short honest answer beats a padded one.",
		"- The reason must be about this title and their question, not a plot summary and not a restatement of the genre.",
		"- Do not mention indexes, ratings out of five, or the word 'library' in the reasons.",
	].join("\n");

	const user = [
		`They asked: ${question}`,
		criteria.restated ? `Understood as: ${criteria.restated}` : "",
		"",
		"Candidates:",
		lines,
	]
		.filter(Boolean)
		.join("\n");

	const res = await client.json<{ picks: AskPick[] }>(
		[
			{ role: "system", content: system },
			{ role: "user", content: user },
		],
		PICKS_SCHEMA,
		"picks"
	);

	// An index outside the list is the one failure that would put a title in
	// front of you that you do not own. Dropped rather than clamped: clamping
	// would silently substitute a different film for the one it meant.
	const seen = new Set<number>();
	const picks = (res.value?.picks ?? [])
		.filter((p) => Number.isInteger(p.index) && p.index >= 0 && p.index < candidates.length)
		.filter((p) => !seen.has(p.index) && (seen.add(p.index), true))
		.slice(0, want)
		.map((p) => ({ index: p.index, why: String(p.why ?? "").trim() }));

	return {
		picks,
		promptTokens: res.promptTokens ?? 0,
		completionTokens: res.completionTokens ?? 0,
	};
}

/** The whole thing, end to end. */
export async function ask(
	client: OpenRouterClient,
	entries: Entry[],
	question: string,
	opts: { shortlistSize: number; want?: number; year?: number }
): Promise<AskResult> {
	const thisYear = opts.year ?? new Date().getFullYear();
	const first = await readCriteria(client, question, thisYear);

	const { picked, relaxed } = shortlist(entries, first.criteria, opts.shortlistSize);
	if (!picked.length) {
		return {
			criteria: first.criteria,
			picks: [],
			considered: 0,
			relaxed,
			promptTokens: first.promptTokens,
			completionTokens: first.completionTokens,
		};
	}

	const second = await rank(client, question, first.criteria, picked, opts.want ?? 10);

	return {
		criteria: first.criteria,
		picks: second.picks.map((p) => ({ entry: picked[p.index], why: p.why })),
		considered: picked.length,
		relaxed,
		promptTokens: first.promptTokens + second.promptTokens,
		completionTokens: first.completionTokens + second.completionTokens,
	};
}
