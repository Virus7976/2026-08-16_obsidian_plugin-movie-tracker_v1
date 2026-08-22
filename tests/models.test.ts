/**
 * The model slug, which was a free-text box with nothing checking it.
 *
 * Reel does report a bad slug — the client turns OpenRouter's 404 into "No
 * such model, check it in Settings" — but only once you have typed a question
 * and waited to be refused. The screen where the string was typed, and where
 * the answer would have saved the trip, said nothing.
 *
 * Most of what is wrong with a bad slug is visible in the string itself, and
 * that is what these cover. What is deliberately *not* covered is whether the
 * model exists: that is not knowable from the text, and a check that guessed
 * would reject every model released after this release.
 */

import { slugProblem, parseModels, formatPrice, rankModels, describeKey, CURATED } from "../src/ai/models";

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = ""): void {
	if (cond) {
		passed++;
		console.log(`  ok   ${name}`);
	} else {
		failed++;
		console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
	}
}

function eq(name: string, got: unknown, want: unknown): void {
	const g = JSON.stringify(got);
	const w = JSON.stringify(want);
	ok(name, g === w, g === w ? "" : `got ${g}, want ${w}`);
}

/* ---- slug shape ----------------------------------------------------- */

eq("a normal slug is fine", slugProblem("anthropic/claude-3.5-haiku"), null);
eq("digits and dots are fine", slugProblem("google/gemini-2.0-flash-001"), null);
// `:free` and `:nitro` are real, common, and not a mistake to be tidied away.
eq("a variant suffix is fine", slugProblem("meta-llama/llama-3.1-8b-instruct:free"), null);
eq("surrounding space is trimmed, not rejected", slugProblem("  openai/gpt-4o-mini  "), null);

ok("an empty box is explained, not scolded", (slugProblem("") ?? "").includes("default"));

/*
 * The four ways people actually get this wrong: the vendor left off, a pasted
 * URL, a stray space in the middle, and the name copied with its capitals.
 */
ok("a missing vendor is caught", (slugProblem("claude-3.5-haiku") ?? "").includes("vendor"));
ok("a pasted URL is caught", (slugProblem("https://openrouter.ai/anthropic/claude-3.5-haiku") ?? "").includes("URL"));
ok("an inner space is caught", (slugProblem("anthropic/claude 3.5 haiku") ?? "").includes("space"));
ok("capitals are caught", (slugProblem("Anthropic/Claude-3.5-Haiku") ?? "").includes("lowercase"));
ok("plain nonsense is caught", slugProblem("!!!/???") !== null);

// Never claims a well-formed slug is unknown; that is OpenRouter's to say.
eq("a well-formed unknown model passes", slugProblem("someone/a-model-released-tomorrow"), null);

/* ---- the curated list ----------------------------------------------- */

ok("there are suggestions to offer", CURATED.length > 0);
ok(
	"every curated slug is itself valid",
	CURATED.every((c) => slugProblem(c.id) === null),
	CURATED.filter((c) => slugProblem(c.id) !== null)
		.map((c) => c.id)
		.join(", ")
);
ok(
	"and every one says why it is here",
	CURATED.every((c) => c.why.trim().length > 10)
);

/* ---- parsing somebody else's JSON ----------------------------------- */

const BODY = {
	data: [
		{ id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", pricing: { prompt: "0.0000008", completion: "0.000004" } },
		{ id: "openai/gpt-4o-mini", name: "GPT-4o mini", pricing: { prompt: "0.00000015", completion: "0.0000006" } },
		{ id: "free/thing", name: "Free Thing", pricing: { prompt: "0", completion: "0" } },
	],
};

const models = parseModels(BODY);
eq("every model is parsed", models.length, 3);
eq("the id survives", models[0].id, "anthropic/claude-3.5-haiku");
// Per token is a number with six leading zeros. Per million is readable.
eq("price is converted to per-million", models[0].prompt, 0.8);
eq("and so is completion", models[0].completion, 4);

/*
 * This is somebody else's JSON with no version guarantee. A field appearing or
 * vanishing should cost one model's price, not the whole picker.
 */
eq("junk is not a crash", parseModels(null), []);
eq("a missing data array is empty", parseModels({}), []);
eq("a non-array data is empty", parseModels({ data: "nope" }), []);
eq("entries with no id are skipped", parseModels({ data: [{ name: "nameless" }, { id: "a/b" }] }).length, 1);
eq("a missing price is null, not zero", parseModels({ data: [{ id: "a/b" }] })[0].prompt, null);
eq("an unparseable price is null", parseModels({ data: [{ id: "a/b", pricing: { prompt: "abc" } }] })[0].prompt, null);
eq("a missing name falls back to the id", parseModels({ data: [{ id: "a/b" }] })[0].name, "a/b");

/* ---- prices ---------------------------------------------------------- */

eq("a cheap price keeps its digits", formatPrice(0.8), "$0.800/M");
eq("a dearer one uses two", formatPrice(15), "$15.00/M");
eq("zero is free, not $0.00", formatPrice(0), "free");
// An unknown price must render as nothing rather than as a claim about cost.
eq("unknown says nothing at all", formatPrice(null), "");

/*
 * Below a cent per million, two decimals would print "$0.00" — which reads as
 * free and is a different claim from cheap.
 */
ok("a sub-cent price does not round to zero", formatPrice(0.005) !== "$0.00/M");

/* ---- ranking --------------------------------------------------------- */

const ALL = parseModels(BODY);

eq("an exact id wins", rankModels(ALL, "openai/gpt-4o-mini")[0].id, "openai/gpt-4o-mini");
eq("a vendor prefix finds its models", rankModels(ALL, "anthropic")[0].id, "anthropic/claude-3.5-haiku");
eq("the model half matches too", rankModels(ALL, "gpt-4o")[0].id, "openai/gpt-4o-mini");
eq("the display name matches", rankModels(ALL, "haiku")[0].id, "anthropic/claude-3.5-haiku");
eq("nothing matching is empty", rankModels(ALL, "zzzz").length, 0);

/*
 * Cheapest first with no query. Ask ranks sixty one-line summaries against a
 * sentence — a job where the cheap model is the right answer, so the default
 * order should not put a frontier model at the top of the list.
 */
eq("no query lists cheapest first", rankModels(ALL, "")[0].id, "free/thing");
eq("and the next cheapest second", rankModels(ALL, "")[1].id, "openai/gpt-4o-mini");
ok("the limit is honoured", rankModels(ALL, "", 2).length === 2);

// An unpriced model sorts last rather than sorting as free.
const withUnknown = parseModels({ data: [{ id: "a/unpriced" }, { id: "b/cheap", pricing: { prompt: "0.000001" } }] });
eq("an unknown price is not treated as free", rankModels(withUnknown, "")[0].id, "b/cheap");

/* ---- what the key says about itself ---------------------------------- */

/*
 * An OpenRouter key that has run out of credit is not rejected. It is accepted
 * and then fails on the question you asked, which reads as Ask being broken
 * rather than as an account being empty. Telling those apart is the point.
 */
eq("spend against a limit", describeKey({ data: { usage: 4.2, limit: 10 } }), "$4.20 of $10.00 used");
ok("a spent key says so", describeKey({ data: { usage: 10, limit: 10 } }).includes("out of credit"));
ok("a key with room does not", !describeKey({ data: { usage: 1, limit: 10 } }).includes("out of credit"));

/*
 * `limit: null` is OpenRouter for "no cap on this key". It must not read as
 * "no credit left", which is the opposite situation.
 */
eq("no cap is not no credit", describeKey({ data: { usage: 2, limit: null } }), "$2.00 used, no limit set");
ok("free tier is mentioned", describeKey({ data: { usage: 0, limit: 0, is_free_tier: true } }).includes("free tier"));

/*
 * OpenRouter is entitled to change this shape. An unreadable answer has to
 * come back as no answer, leaving the check saying only that the key was
 * accepted — which is still the useful half. A settings row is not the thing
 * that should break when a third party edits its JSON.
 */
eq("an unknown body says nothing", describeKey({ hello: "world" }), "");
eq("null says nothing", describeKey(null), "");
eq("a string says nothing", describeKey("nope"), "");
eq("missing numbers say nothing", describeKey({ data: { label: "k" } }), "");
// NaN and Infinity are numbers as far as typeof is concerned.
eq("nonsense numbers say nothing", describeKey({ data: { usage: NaN, limit: 10 } }), "");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
