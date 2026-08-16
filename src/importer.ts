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
import { redact } from "./secrets";
import { LEGACY_KEYS, convertLegacy, looksLegacy, scaleIsTen } from "./util/legacy";

export interface ImportReport {
	scanned: number;
	converted: number;
	skipped: number;
	scaleHalved: boolean;
	errors: string[];
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

		// Decide the rating scale once, across every note — the same judgement
		// applied per note would give one library two different scales.
		report.scaleHalved = scaleIsTen(found.map(({ fm }) => fm.Rating));

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
		await this.plugin.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const fields = convertLegacy(fm, { halveRatings: halve });

			for (const [key, value] of Object.entries(fields)) {
				// `undefined` means "remove", which is how the converter says a
				// field ended up empty — writing it back would leave a null.
				if (value === undefined) delete fm[key];
				else fm[key] = value;
			}

			// Retire the old keys so the note carries one schema, not two.
			for (const key of LEGACY_KEYS) delete fm[key];
		});
	}
}
