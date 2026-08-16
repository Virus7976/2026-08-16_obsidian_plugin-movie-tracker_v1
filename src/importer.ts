/**
 * Import notes written by the old TV Tracker setup.
 *
 * Those notes carry title-case keys and stringified lists:
 *
 *   Title: "Ocean's Eleven"
 *   Rating: 5
 *   Status: "Watched"
 *   Type: "Movie"
 *   Genre: "Thriller, Crime"
 *   Duration: 116 minutes
 *   Cast: "George Clooney, Brad Pitt, …"
 *   TMDB ID: 161
 *
 * Conversion happens in place — the note keeps its path, its body, and its
 * links. Only frontmatter is rewritten, through `processFrontMatter`, so any
 * review already written underneath survives untouched.
 *
 * The one genuinely ambiguous field is `Rating`. The old tracker's slider had
 * about ten stops, so a 5 could mean "five stars" or "five out of ten". Those
 * differ by a factor of two across every note you own, so the importer decides
 * once by looking at the whole set: if anything is rated above 5, the scale
 * must be 10-point and everything is halved. Otherwise it is taken as already
 * being out of 5. The choice is reported rather than assumed silently.
 */

import { Notice, TFile } from "obsidian";
import type ReelPlugin from "./main";
import { clampRating } from "./util/ratings";
import { normaliseDate, yearOf } from "./util/dates";
import { redact } from "./secrets";

export interface ImportReport {
	scanned: number;
	converted: number;
	skipped: number;
	scaleHalved: boolean;
	errors: string[];
}

/** Keys that mark a note as belonging to the old tracker. */
function looksLegacy(fm: Record<string, unknown>): boolean {
	if (fm.tmdb_id != null) return false; // already ours
	return fm["TMDB ID"] != null || fm.Title != null || fm.Type != null;
}

function str(value: unknown): string | undefined {
	if (value == null) return undefined;
	const s = String(value).trim();
	return s || undefined;
}

/** "Thriller, Crime" → ["Thriller", "Crime"]. Already-arrays pass through. */
function splitList(value: unknown): string[] {
	if (value == null) return [];
	if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
	return String(value)
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** "116 minutes" → 116. */
function minutes(value: unknown): number | undefined {
	if (value == null) return undefined;
	const m = String(value).match(/(\d+)/);
	return m ? parseInt(m[1], 10) : undefined;
}

function num(value: unknown): number | undefined {
	if (value == null || value === "") return undefined;
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

export class Importer {
	constructor(private plugin: ReelPlugin) {}

	/** Candidate notes anywhere in the vault, not just the Reel folders. */
	private candidates(): { file: TFile; fm: Record<string, unknown> }[] {
		const out: { file: TFile; fm: Record<string, unknown> }[] = [];
		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			const fm = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
			if (fm && looksLegacy(fm)) out.push({ file, fm });
		}
		return out;
	}

	async run(): Promise<ImportReport> {
		const found = this.candidates();
		const report: ImportReport = {
			scanned: found.length,
			converted: 0,
			skipped: 0,
			scaleHalved: false,
			errors: [],
		};
		if (!found.length) return report;

		// Decide the rating scale once, across every note.
		const maxRating = found.reduce((max, { fm }) => Math.max(max, num(fm.Rating) ?? 0), 0);
		report.scaleHalved = maxRating > 5;

		const notice = new Notice(`Reel: converting ${found.length} notes…`, 0);
		try {
			for (const { file } of found) {
				try {
					await this.convert(file, report.scaleHalved);
					report.converted++;
				} catch (e) {
					report.skipped++;
					report.errors.push(`${file.basename}: ${redact(e)}`);
				}
			}
		} finally {
			notice.hide();
		}

		this.plugin.library.rebuild();
		return report;
	}

	private async convert(file: TFile, halve: boolean): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
			const isTv = /tv|series|show/i.test(String(fm.Type ?? ""));
			const title = str(fm.Title) ?? file.basename;

			fm.tmdb_id = num(fm["TMDB ID"]) ?? num(fm.tmdb_id);
			fm.type = isTv ? "tv" : "film";
			fm.title = title;

			const released = normaliseDate(fm.release_date);
			const year = yearOf(released);
			if (year) {
				if (isTv) fm.first_air_year = year;
				else fm.year = year;
			}

			const director = splitList(fm.Director);
			if (director.length) {
				if (isTv) fm.creators = director;
				else fm.director = director;
			}

			const cast = splitList(fm.Cast);
			if (cast.length) fm.cast = cast;

			const genres = splitList(fm.Genre);
			if (genres.length) fm.genres = genres;

			const runtime = minutes(fm.Duration);
			if (runtime) {
				if (isTv) fm.episode_runtime = runtime;
				else fm.runtime = runtime;
			}

			const vote = num(fm["Avg vote"]);
			if (vote != null) fm.tmdb_rating = Math.round(vote * 10) / 10;

			const popularity = num(fm.Popularity);
			if (popularity != null) fm.popularity = Math.round(popularity * 10) / 10;

			const rating = num(fm.Rating);
			if (rating != null && rating > 0) {
				fm.rating = clampRating(halve ? rating / 2 : rating);
			}

			// Status vocabulary differs between the two apps.
			const status = String(fm.Status ?? "").toLowerCase();
			if (isTv) {
				fm.status = status.includes("watchlist")
					? "watchlist"
					: status.includes("complet") || status.includes("watched")
						? "completed"
						: status.includes("drop")
							? "dropped"
							: "watching";
			} else {
				fm.status = status.includes("watchlist") ? "watchlist" : status.includes("abandon") ? "abandoned" : "watched";
			}

			// The old notes recorded no viewing dates, so a watch history can't
			// be invented. One undated entry would be a fabricated fact; an
			// empty array is honest, and the rating is preserved regardless.
			if (!Array.isArray(fm.watched)) fm.watched = [];

			const providers = splitList(fm["Available On"]);
			if (providers.length) fm.providers = providers;

			const companies = splitList(fm.production_company);
			if (companies.length) fm.production_companies = companies;

			const collection = str(fm.belongs_to_collection);
			if (collection) fm.collection = collection;

			for (const [from, to] of [
				["overview", "overview"],
				["trailer", "trailer"],
				["budget", "budget"],
				["revenue", "revenue"],
				["original_language", "language"],
			] as const) {
				const value = fm[from];
				if (value != null && value !== "") fm[to] = from === "budget" || from === "revenue" ? num(value) : str(value);
			}

			// The old Poster was a remote URL. Keep it — it still renders — and
			// leave a note for the poster backfill to replace it with a local
			// copy, which is what makes the library work offline.
			const poster = str(fm.Poster);
			if (poster && !str(fm.poster)) fm.poster_url = poster;

			// Retire the old keys so the note has one schema rather than two.
			for (const key of [
				"Title", "Rating", "Status", "Type", "Poster", "Genre", "Duration",
				"Avg vote", "Popularity", "Cast", "TMDB ID", "Director",
				"belongs_to_collection", "production_company", "Available On", "original_language",
			]) {
				delete fm[key];
			}

			// `tags: "tvtracker, Movie"` is a string where Obsidian wants a list.
			const tags = splitList(fm.tags).filter((t) => t.toLowerCase() !== "tvtracker");
			if (tags.length) fm.tags = tags;
			else delete fm.tags;
		});
	}
}
