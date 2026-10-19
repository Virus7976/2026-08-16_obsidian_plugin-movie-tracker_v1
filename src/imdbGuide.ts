/**
 * IMDb's parents guide, read on request and redrawn in the app's own style.
 *
 * Nothing runs until you press the button, and one title makes one request
 * from your own device; the result is cached so it is not asked for twice.
 * IMDb has no API for this, so the page is read as a reader mode would: the
 * data embedded in the page first, the visible markup second. If either layout
 * changes or IMDb refuses the request, this returns null and the tab keeps
 * its estimate and its link; nothing here is allowed to break that tab.
 */

import { requestUrl } from "obsidian";
import type ReelPlugin from "./main";

export interface ImdbGuideCategory {
	title: string;
	/** "Mild", "Moderate", "Severe", "None"; empty when IMDb gives none. */
	severity: string;
	items: string[];
}

const SEVERITIES = ["none", "mild", "moderate", "severe"];

function text(v: unknown): string {
	if (typeof v === "string") return v;
	if (v && typeof v === "object") {
		const o = v as Record<string, unknown>;
		return text(o.plainText ?? o.text ?? o.value ?? "");
	}
	return "";
}

/** Find category-shaped objects anywhere in the embedded data. */
function fromJson(root: unknown): ImdbGuideCategory[] {
	const out: ImdbGuideCategory[] = [];
	const seen = new Set<string>();
	const walk = (o: unknown, depth: number): void => {
		if (!o || typeof o !== "object" || depth > 14) return;
		if (Array.isArray(o)) {
			for (const x of o) walk(x, depth + 1);
			return;
		}
		const r = o as Record<string, unknown>;
		const cat = r.category as Record<string, unknown> | undefined;
		const title = cat ? text(cat.text ?? cat.id) : "";
		if (title && (r.guideItems || r.severity || r.items)) {
			const edges = ((r.guideItems ?? r.items) as { edges?: { node?: unknown }[] } | undefined)?.edges ?? [];
			const items = edges.map((e) => text((e.node as Record<string, unknown> | undefined)?.text)).filter(Boolean);
			const sev = text((r.severity as Record<string, unknown> | undefined)?.text ?? r.severity).trim();
			if (!seen.has(title)) {
				seen.add(title);
				out.push({ title, severity: sev, items });
			}
			return;
		}
		for (const k of Object.keys(r)) walk(r[k], depth + 1);
	};
	walk(root, 0);
	return out;
}

/** The visible page, if the embedded data is not where it was. */
function fromDom(doc: Document): ImdbGuideCategory[] {
	const out: ImdbGuideCategory[] = [];
	doc.querySelectorAll('section[data-testid^="advisory-"]').forEach((sec) => {
		const title = sec.querySelector(".ipc-title__text, h3, h2")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
		if (!title) return;
		const items = Array.from(sec.querySelectorAll("li .ipc-html-content-inner-div, li"))
			.map((li) => li.textContent?.replace(/\s+/g, " ").trim() ?? "")
			.filter((t) => t.length > 12);
		const sevText = sec.querySelector('[data-testid*="severity"], .ipc-signpost__text')?.textContent?.trim() ?? "";
		const sev = SEVERITIES.find((s) => sevText.toLowerCase().includes(s)) ?? "";
		out.push({ title, severity: sev ? sev[0].toUpperCase() + sev.slice(1) : "", items: [...new Set(items)] });
	});
	return out;
}

export interface ImdbGuideResult {
	cats: ImdbGuideCategory[] | null;
	/** Why there is nothing to show, in a few words, so a failure can be reported. */
	reason?: string;
}

const GQL_QUERY =
	"query($id:ID!){title(id:$id){parentsGuide{categories{category{id text} severity{text} guideItems(first:12){edges{node{text{plainText}}}}}}}}";

/** IMDb's own site asks this endpoint for the same data; tried first, being JSON. */
async function viaGraphql(imdbId: string): Promise<{ cats: ImdbGuideCategory[]; status: number }> {
	const res = await requestUrl({
		url: "https://api.graphql.imdb.com/",
		method: "POST",
		contentType: "application/json",
		headers: { Accept: "application/json", "x-imdb-client-name": "imdb-web-next-localized" },
		body: JSON.stringify({ query: GQL_QUERY, variables: { id: imdbId } }),
		throw: false,
	});
	if (res.status >= 400) return { cats: [], status: res.status };
	let json: unknown = null;
	try {
		json = res.json;
	} catch {
		/* not JSON */
	}
	return { cats: fromJson(json), status: res.status };
}

async function viaPage(imdbId: string): Promise<{ cats: ImdbGuideCategory[]; status: number }> {
	const res = await requestUrl({
		url: `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/parentalguide/`,
		method: "GET",
		headers: { "Accept-Language": "en-US,en;q=0.9" },
		throw: false,
	});
	if (res.status >= 400 || !res.text) return { cats: [], status: res.status };
	const doc = new DOMParser().parseFromString(res.text, "text/html");
	let cats: ImdbGuideCategory[] = [];
	const next = doc.getElementById("__NEXT_DATA__")?.textContent;
	if (next) {
		try {
			cats = fromJson(JSON.parse(next));
		} catch {
			/* fall through to the markup */
		}
	}
	if (!cats.length) cats = fromDom(doc);
	return { cats, status: res.status };
}

export async function fetchImdbGuide(plugin: ReelPlugin, imdbId: string): Promise<ImdbGuideResult> {
	const cacheKey = `imdbguide-${imdbId}`;
	const cached = await plugin.tmdb.readExternalCache<ImdbGuideCategory[]>(cacheKey);
	if (cached?.length) return { cats: cached };
	const notes: string[] = [];
	for (const [name, run] of [
		["data", viaGraphql],
		["page", viaPage],
	] as const) {
		try {
			const { cats, status } = await run(imdbId);
			const usable = cats.filter((c) => c.items.length || c.severity);
			if (usable.length) {
				await plugin.tmdb.writeExternalCache(cacheKey, usable, false);
				return { cats: usable };
			}
			notes.push(`${name} ${status}${status < 400 ? " (no guide in reply)" : ""}`);
		} catch {
			notes.push(`${name} failed`);
		}
	}
	return { cats: null, reason: notes.join(", ") };
}
