/**
 * The two supplementary APIs: OMDb and DoesTheDogDie.
 *
 * Both are optional. Neither blocks note creation — if a key is missing, a
 * service is down, or a title simply isn't in their database, the note is
 * written with whatever TMDB gave us and the extra fields are absent. An
 * enrichment that can fail the primary flow isn't worth having.
 *
 * Both are keyed off the IMDb id, which TMDB hands us via `external_ids`. That
 * makes matching exact rather than fuzzy title-and-year guessing, which is the
 * usual source of "why does this note say it's a different film".
 */

import { requestUrl } from "obsidian";
import type ReelPlugin from "./main";
import { redact } from "./secrets";

/* ------------------------------------------------------------------ */
/* OMDb — IMDb rating, Rotten Tomatoes, Metacritic                     */
/* ------------------------------------------------------------------ */

export interface OmdbScores {
	imdbRating?: number;
	imdbVotes?: number;
	metacritic?: number;
	rottenTomatoes?: number;
	rated?: string;
	awards?: string;
}

interface OmdbResponse {
	Response?: string;
	Error?: string;
	imdbRating?: string;
	imdbVotes?: string;
	Metascore?: string;
	Rated?: string;
	Awards?: string;
	Ratings?: { Source?: string; Value?: string }[];
}

function parseNumber(value: string | undefined): number | undefined {
	if (!value || value === "N/A") return undefined;
	const n = Number(value.replace(/,/g, ""));
	return Number.isFinite(n) ? n : undefined;
}

/** "87%" → 87. Rotten Tomatoes is the only percentage in the Ratings array. */
function parsePercent(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const m = value.match(/^(\d+)%$/);
	return m ? parseInt(m[1], 10) : undefined;
}

export class OmdbClient {
	constructor(private plugin: ReelPlugin) {}

	async fetchScores(imdbId: string): Promise<OmdbScores | null> {
		const key = await this.plugin.credentials.getOptional("omdb");
		if (!key || !imdbId) return null;

		const cacheKey = `omdb-${imdbId}`;
		const cached = await this.plugin.tmdb.readExternalCache<OmdbScores>(cacheKey);
		if (cached) return cached;

		const url = new URL("https://www.omdbapi.com/");
		url.searchParams.set("i", imdbId);
		url.searchParams.set("apikey", key);

		try {
			const res = await requestUrl({ url: url.toString(), method: "GET", throw: false });
			if (res.status >= 400) return null;
			const data = res.json as OmdbResponse;
			// OMDb answers 200 with {"Response":"False"} for a miss.
			if (data.Response === "False") return null;

			const rt = data.Ratings?.find((r) => r.Source === "Rotten Tomatoes");
			const scores: OmdbScores = {
				imdbRating: parseNumber(data.imdbRating),
				imdbVotes: parseNumber(data.imdbVotes),
				metacritic: parseNumber(data.Metascore),
				rottenTomatoes: parsePercent(rt?.Value),
				rated: data.Rated && data.Rated !== "N/A" ? data.Rated : undefined,
				awards: data.Awards && data.Awards !== "N/A" ? data.Awards : undefined,
			};

			// Scores drift as votes accumulate, so this expires like any other
			// cached response rather than being pinned as immutable.
			await this.plugin.tmdb.writeExternalCache(cacheKey, scores, false);
			return scores;
		} catch (e) {
			console.warn("Reel: OMDb lookup failed —", redact(e));
			return null;
		}
	}
}

/* ------------------------------------------------------------------ */
/* DoesTheDogDie — content topics with vote counts                     */
/* ------------------------------------------------------------------ */

/**
 * DTDD returns community votes per topic: how many people said a thing happens
 * and how many said it doesn't. That vote *ratio* is the part TMDB keywords
 * can't give — it separates "one brief scene" from "constantly", which is the
 * actual question behind "filter out films with a lot of sex".
 *
 * It is still crowd-sourced. Coverage is best on popular titles and thin on
 * obscure ones, and a topic nobody voted on reads as absent rather than as no.
 */
export interface ContentTopic {
	name: string;
	yes: number;
	no: number;
}

export interface DtddResult {
	topics: ContentTopic[];
	/** Flags derived from topics that cleared the intensity threshold. */
	flags: string[];
}

/**
 * Map DTDD topic names onto Reel's flags. Their topic list is long and
 * specific; these are the ones that answer the question actually asked.
 */
const TOPIC_RULES: { flag: string; patterns: RegExp[] }[] = [
	{ flag: "sex", patterns: [/sex/i, /rape/i, /sexual (assault|content|violence)/i] },
	{ flag: "nudity", patterns: [/nudity/i, /naked/i] },
	{ flag: "profanity", patterns: [/language/i, /profanity/i, /slur/i, /f-bomb/i] },
	{ flag: "violence", patterns: [/violence/i, /abuse/i, /torture/i, /shot/i, /murder/i] },
	{ flag: "gore", patterns: [/gore/i, /blood/i, /mutilat/i, /dismember/i] },
	{ flag: "drugs", patterns: [/drug/i, /alcohol/i, /addict/i, /overdose/i, /needle/i] },
	{ flag: "horror", patterns: [/jump scare/i, /horror/i, /body horror/i] },
];

/**
 * A topic counts only when the community actually agrees it happens.
 *
 * Requiring both a majority and a floor of votes keeps a single stray vote from
 * flagging a film. Without the floor, one person clicking "yes" on an obscure
 * title would hide it from your entire library — the failure mode that makes
 * people switch a filter off and never trust it again.
 */
export const MIN_VOTES = 3;
export const MIN_RATIO = 0.5;

export function topicHolds(topic: ContentTopic): boolean {
	const total = topic.yes + topic.no;
	if (total < MIN_VOTES) return false;
	return topic.yes / total > MIN_RATIO;
}

export function flagsFromTopics(topics: ContentTopic[]): string[] {
	const found = new Set<string>();
	for (const topic of topics) {
		if (!topicHolds(topic)) continue;
		for (const rule of TOPIC_RULES) {
			if (rule.patterns.some((re) => re.test(topic.name))) found.add(rule.flag);
		}
	}
	return [...found].sort();
}

interface DtddResponse {
	topItemStats?: { topic?: { name?: string }; yesSum?: number; noSum?: number }[];
}

export class DtddClient {
	constructor(private plugin: ReelPlugin) {}

	/**
	 * DTDD's search takes a title, not an IMDb id, so this is the one place a
	 * fuzzy match is unavoidable. The first result for an exact title is taken;
	 * anything less confident is skipped rather than guessed at.
	 */
	async fetchByTitle(title: string, year?: number): Promise<DtddResult | null> {
		const key = await this.plugin.credentials.getOptional("dtdd");
		if (!key || !title) return null;

		const cacheKey = `dtdd-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${year ?? ""}`;
		const cached = await this.plugin.tmdb.readExternalCache<DtddResult>(cacheKey);
		if (cached) return cached;

		try {
			const id = await this.findId(title, year, key);
			if (id == null) return null;

			const res = await requestUrl({
				url: `https://www.doesthedogdie.com/media/${id}`,
				method: "GET",
				headers: { Accept: "application/json", "X-API-KEY": key },
				throw: false,
			});
			if (res.status >= 400) return null;

			const data = res.json as DtddResponse;
			const topics: ContentTopic[] = (data.topItemStats ?? [])
				.map((s) => ({
					name: String(s.topic?.name ?? "").trim(),
					yes: Number(s.yesSum ?? 0),
					no: Number(s.noSum ?? 0),
				}))
				.filter((t) => t.name && (t.yes > 0 || t.no > 0));

			const result: DtddResult = { topics, flags: flagsFromTopics(topics) };
			await this.plugin.tmdb.writeExternalCache(cacheKey, result, false);
			return result;
		} catch (e) {
			console.warn("Reel: DoesTheDogDie lookup failed —", redact(e));
			return null;
		}
	}

	private async findId(title: string, year: number | undefined, key: string): Promise<number | null> {
		const url = new URL("https://www.doesthedogdie.com/dddsearch");
		url.searchParams.set("q", title);

		const res = await requestUrl({
			url: url.toString(),
			method: "GET",
			headers: { Accept: "application/json", "X-API-KEY": key },
			throw: false,
		});
		if (res.status >= 400) return null;

		const items = (res.json as { items?: { id?: number; name?: string; releaseYear?: string }[] })?.items ?? [];
		if (!items.length) return null;

		const wanted = title.trim().toLowerCase();
		// Prefer an exact title match in the right year; fall back to exact
		// title alone. Never take a loose match — a wrong film's content
		// warnings are worse than none.
		const exactWithYear = items.find(
			(i) => String(i.name ?? "").trim().toLowerCase() === wanted && (!year || String(i.releaseYear ?? "") === String(year))
		);
		if (exactWithYear?.id != null) return exactWithYear.id;

		const exact = items.find((i) => String(i.name ?? "").trim().toLowerCase() === wanted);
		return exact?.id ?? null;
	}
}
