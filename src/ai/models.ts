/**
 * Which model Ask should use, and how anybody is meant to know.
 *
 * The setting is a free-text box holding a string like
 * `anthropic/claude-3.5-haiku`. Get it wrong and Reel does tell you — the
 * client turns OpenRouter's 404 into "No such model, check the slug in
 * Settings" — but it tells you at question time, which is to say after you
 * have typed a question, waited, and been refused. The settings screen, which
 * is where the string was typed and where the answer would have been useful,
 * says nothing at all.
 *
 * Two things fix that, and only one of them needs the network.
 *
 * The shape of a slug is checkable offline. `claude-3.5-haiku` with the vendor
 * missing, a trailing space, a pasted URL — all of those are wrong in ways
 * that need no permission and no request to notice.
 *
 * And a short list of models known to suit this job is worth carrying, because
 * the first-run problem is not "I typed it wrong", it is "I have no idea what
 * goes here". A curated list does go stale, which is why the live list is
 * authoritative whenever a key exists to fetch it with — but a stale
 * suggestion you can check beats an empty box you cannot.
 */

/**
 * OpenRouter slugs are `vendor/model`, lowercase, with a small punctuation
 * set. Variants after a colon (`:free`, `:nitro`, `:beta`) are legal and
 * common, so they are allowed rather than tidied away.
 */
const SLUG = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)?$/;

/**
 * What is wrong with this slug, if anything.
 *
 * Deliberately never "this model does not exist" — that is not knowable from
 * the string, only from OpenRouter, and guessing it would mean rejecting every
 * model released after this release. Shape only.
 */
export function slugProblem(raw: string): string | null {
	const slug = raw.trim();
	if (!slug) return "Empty — Reel will use its default model";
	if (/\s/.test(slug)) return "A model slug has no spaces in it";
	if (/^https?:/i.test(slug)) return "That looks like a URL. A slug is just vendor/model";
	if (!slug.includes("/")) return "Missing the vendor — slugs look like vendor/model";
	if (slug !== slug.toLowerCase()) return "Model slugs are lowercase";
	if (!SLUG.test(slug)) return "That is not the shape of a model slug";
	return null;
}

export interface ModelInfo {
	id: string;
	name: string;
	/** US dollars per million prompt tokens, or null if unpriced. */
	prompt: number | null;
	/** US dollars per million completion tokens. */
	completion: number | null;
}

/**
 * Models worth suggesting before anything has been fetched.
 *
 * Chosen for the job Ask actually does, which is ranking sixty one-line
 * summaries against a sentence. That wants cheap, fast, and able to return
 * structured JSON reliably; it does not want a frontier model, and paying for
 * one here buys nothing a person could notice.
 *
 * This list will age. It is a starting point for somebody staring at an empty
 * box, not a claim about the current state of the market, and the live list
 * replaces it the moment there is a key to fetch one with.
 */
export const CURATED: { id: string; why: string }[] = [
	{ id: "anthropic/claude-3.5-haiku", why: "Fast, cheap, reliable at structured output" },
	{ id: "openai/gpt-4o-mini", why: "Comparable and widely available" },
	{ id: "google/gemini-2.0-flash-001", why: "Cheapest of the three" },
];

/**
 * OpenRouter's model list, from its own response shape.
 *
 * Tolerant on purpose: this parses somebody else's JSON over which Reel has no
 * control and no version guarantee, and a field appearing or vanishing should
 * cost one model's price rather than the whole picker.
 */
export function parseModels(body: unknown): ModelInfo[] {
	const data = (body as { data?: unknown })?.data;
	if (!Array.isArray(data)) return [];

	const out: ModelInfo[] = [];
	for (const raw of data) {
		const m = raw as { id?: unknown; name?: unknown; pricing?: { prompt?: unknown; completion?: unknown } };
		if (typeof m?.id !== "string" || !m.id) continue;
		out.push({
			id: m.id,
			name: typeof m.name === "string" && m.name ? m.name : m.id,
			prompt: perMillion(m.pricing?.prompt),
			completion: perMillion(m.pricing?.completion),
		});
	}
	return out;
}

/**
 * OpenRouter quotes dollars per token, as a string, which for a cheap model is
 * a number like 0.0000008 — six leading zeros of nothing anybody can read.
 * Per million is the unit the pricing page itself uses.
 */
function perMillion(v: unknown): number | null {
	const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
	if (!Number.isFinite(n) || n < 0) return null;
	/*
	 * Rounded, because 0.0000008 * 1e6 is 0.7999999999999999.
	 *
	 * `formatPrice` would hide that, and hiding it is exactly the problem: the
	 * stored number would still be a hair under the real price, and the first
	 * thing to compare two of them, or to print one at higher precision, would
	 * inherit a bug with no visible cause. Six decimals is far finer than any
	 * real per-million price and comfortably coarser than the noise.
	 */
	return Math.round(n * 1_000_000 * 1e6) / 1e6;
}

/** "$0.80/M", or "free", or nothing at all when the price is unknown. */
export function formatPrice(perM: number | null): string {
	if (perM === null) return "";
	if (perM === 0) return "free";
	// Below a cent per million, two decimals reads as "$0.00" — which is a
	// different claim from "cheap" and not one to make by accident.
	const digits = perM < 1 ? 3 : 2;
	return `$${perM.toFixed(digits)}/M`;
}

/**
 * The models worth offering for what has been typed.
 *
 * Same shape as the folder matcher and for the same reason: ranked rather than
 * filtered, because "gpt" matches dozens and the first suggestion is the one
 * people take. An exact id wins, then a prefix, then the vendor, then anything
 * containing it — and cheaper wins ties, since this is a job where the cheap
 * model is the right answer.
 */
export function rankModels(all: ModelInfo[], query: string, limit = 8): ModelInfo[] {
	const q = query.trim().toLowerCase();

	const cost = (m: ModelInfo): number => (m.prompt === null ? Number.MAX_SAFE_INTEGER : m.prompt);
	const byCost = (a: ModelInfo, b: ModelInfo): number => cost(a) - cost(b) || a.id.localeCompare(b.id);

	if (!q) return [...all].sort(byCost).slice(0, limit);

	const rank = (m: ModelInfo): number => {
		const id = m.id.toLowerCase();
		if (id === q) return 0;
		if (id.startsWith(q)) return 1;
		const [vendor, rest = ""] = id.split("/");
		if (rest.startsWith(q)) return 2;
		if (vendor.startsWith(q)) return 3;
		if (id.includes(q) || m.name.toLowerCase().includes(q)) return 4;
		return 99;
	};

	return all
		.map((m) => ({ m, r: rank(m) }))
		.filter((x) => x.r < 99)
		.sort((a, b) => a.r - b.r || byCost(a.m, b.m))
		.map((x) => x.m)
		.slice(0, limit);
}
