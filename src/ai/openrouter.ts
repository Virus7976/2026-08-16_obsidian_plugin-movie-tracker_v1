/**
 * OpenRouter, used for the one job in Reel that isn't deterministic.
 *
 * Everything else this plugin does is arithmetic over frontmatter, and a model
 * would only make it slower, costlier and less predictable. Sorting by rating
 * does not need a language model, and asking one to do it would be a worse
 * version of `Array.sort`. That is why Reel has gone this long without one.
 *
 * "Something short and funny that I haven't seen, nothing too bleak" is a
 * different kind of question. There is no field in the vault called `bleak`.
 * Mapping a sentence like that onto genres, decades, runtimes and a mood is
 * exactly what a model is for, and nothing else in the app can do it at all.
 *
 * ## What leaves the vault
 *
 * This has to be said plainly because the honest answer is "quite a lot": a
 * request sends your question and a compact list of titles from your library —
 * name, year, genres, runtime, your rating, whether you have seen it. That is
 * your viewing history, going to a company that is not you, to be forwarded to
 * a model provider that is also not you.
 *
 * So: off by default, no key means no request ever, the settings copy says this
 * in the same words, and the request carries no note text, no review prose, no
 * dates and no file paths. The shortlist is bounded (`aiShortlist`) rather than
 * "the whole library", which keeps the cost predictable and, more to the point,
 * keeps the amount of you being sent anywhere as small as the job allows.
 */

import { requestUrl } from "obsidian";
import type ReelPlugin from "../main";
import { redact } from "../secrets";
import { ModelInfo, parseModels } from "./models";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

export class AiError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = "AiError";
	}
}

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface ChatResult<T> {
	value: T;
	/** Tokens spent, when the provider reported them. Shown, not hidden. */
	promptTokens?: number;
	completionTokens?: number;
}

export class OpenRouterClient {
	constructor(private plugin: ReelPlugin) {}

	get configured(): boolean {
		return this.plugin.settings.aiEnabled && this.plugin.credentials.has("openrouter");
	}

	/**
	 * Ask for JSON and get JSON back.
	 *
	 * `response_format: json_schema` is doing real work here rather than being
	 * decoration. Without it a model asked for structured output will sometimes
	 * wrap it in prose, or in a ```json fence, and the parse fails on a run that
	 * cost real money and took four seconds on a phone. With it the provider
	 * constrains the generation, and the fallback below only has to cover
	 * providers that quietly ignore the field.
	 */
	async json<T>(messages: ChatMessage[], schema: Record<string, unknown>, name: string): Promise<ChatResult<T>> {
		const body = {
			model: this.plugin.settings.aiModel,
			messages,
			// Low, not zero. Zero is not more correct here, it just makes a bad
			// interpretation of a vague question reproducibly bad.
			temperature: 0.2,
			response_format: {
				type: "json_schema",
				json_schema: { name, strict: true, schema },
			},
		};

		const raw = await this.send(body);
		const text = String(raw.choices?.[0]?.message?.content ?? "").trim();
		if (!text) throw new AiError("The model returned nothing.");

		return {
			value: parseJson<T>(text),
			promptTokens: numberOr(raw.usage?.prompt_tokens),
			completionTokens: numberOr(raw.usage?.completion_tokens),
		};
	}

	/**
	 * The models OpenRouter currently offers.
	 *
	 * Deliberately not routed through `send`, for two reasons that both matter.
	 *
	 * It does not require `aiEnabled`. You fetch the list in order to *choose a
	 * model*, which is something you do while setting Ask up — before turning
	 * it on. Guarding it the way a question is guarded would mean the picker
	 * only worked once you no longer needed it.
	 *
	 * And it tolerates having no key. The endpoint is public; the key is sent
	 * when there is one, because a signed request gets the models that account
	 * can actually reach, but its absence is not an error to report.
	 *
	 * Returns an empty list on any failure rather than throwing. A model picker
	 * that cannot reach the network should fall back to its suggestions, not
	 * take the settings screen down with it.
	 */
	async models(): Promise<ModelInfo[]> {
		const key = await this.plugin.credentials.getOptional("openrouter");
		try {
			const res = await requestUrl({
				url: MODELS_ENDPOINT,
				method: "GET",
				headers: {
					...(key ? { Authorization: `Bearer ${key}` } : {}),
					"X-Title": "Obsidian Reel",
				},
				throw: false,
			});
			if (res.status >= 400) return [];
			return parseModels(res.json);
		} catch {
			// Never surfaced, so never a place a key could leak into a message.
			return [];
		}
	}

	private async send(body: unknown): Promise<RawResponse> {
		if (!this.plugin.settings.aiEnabled) {
			throw new AiError("Ask is switched off. Turn it on in Settings → Reel.");
		}
		const key = await this.plugin.credentials.getOptional("openrouter");
		if (!key) throw new AiError("No OpenRouter key. Add one in Settings → Reel.");

		let res;
		try {
			res = await requestUrl({
				url: ENDPOINT,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${key}`,
					// Optional attribution, so the spend shows up on OpenRouter's
					// dashboard as Reel rather than as an unnamed script.
					"X-Title": "Obsidian Reel",
				},
				body: JSON.stringify(body),
				throw: false,
			});
		} catch (e) {
			// A thrown network error can carry the request, key included.
			throw new AiError(redact(e));
		}

		if (res.status === 401) throw new AiError("OpenRouter rejected the key. Check it in Settings → Reel.", 401);
		if (res.status === 402) throw new AiError("Your OpenRouter account is out of credit.", 402);
		if (res.status === 404) {
			throw new AiError(`No such model: "${this.plugin.settings.aiModel}". Check the slug in Settings → Reel.`, 404);
		}
		if (res.status === 429) throw new AiError("OpenRouter rate limit hit. Wait a moment and try again.", 429);
		if (res.status >= 400) {
			let detail = "";
			try {
				detail = String(res.json?.error?.message ?? "");
			} catch {
				/* body wasn't json */
			}
			throw new AiError(redact(`OpenRouter error ${res.status}${detail ? `: ${detail}` : ""}`), res.status);
		}

		return (res.json ?? {}) as RawResponse;
	}
}

interface RawResponse {
	choices?: { message?: { content?: string } }[];
	usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function numberOr(v: unknown): number | undefined {
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
}

/**
 * JSON out of whatever came back.
 *
 * The straight parse is the expected path. The rest is for providers that
 * ignore `response_format` and hand back a fenced block or a sentence with an
 * object in the middle of it — recoverable, and worth recovering, because the
 * alternative is telling somebody their question failed when the answer is
 * sitting right there in the response.
 */
export function parseJson<T>(text: string): T {
	try {
		return JSON.parse(text) as T;
	} catch {
		/* keep going */
	}

	const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
	if (fenced) {
		try {
			return JSON.parse(fenced[1]) as T;
		} catch {
			/* keep going */
		}
	}

	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start >= 0 && end > start) {
		try {
			return JSON.parse(text.slice(start, end + 1)) as T;
		} catch {
			/* fall through to the honest failure */
		}
	}

	throw new AiError("The model's answer wasn't valid JSON.");
}
