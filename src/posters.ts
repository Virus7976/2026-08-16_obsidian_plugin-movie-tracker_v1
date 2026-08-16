/**
 * Poster caching.
 *
 * One `w342` jpg per title — roughly 30 KB — written into the vault with
 * `createBinary` and read back with `getResourcePath`. That makes the library
 * grid work with no network at all, which is the difference between a screen
 * that's instant on a train and one that's a wall of grey boxes.
 *
 * Files are named by TMDB id (`438631.jpg`, `tv-1396.jpg`) so nothing depends
 * on the title, which the user is free to rename.
 */

import { Notice, TFile, normalizePath } from "obsidian";
import type ReelPlugin from "./main";
import { redact } from "./secrets";

export class PosterStore {
	constructor(private plugin: ReelPlugin) {}

	private get folder(): string {
		return normalizePath(this.plugin.settings.posterFolder);
	}

	fileName(tmdbId: number, type: "film" | "tv"): string {
		return type === "tv" ? `tv-${tmdbId}.jpg` : `${tmdbId}.jpg`;
	}

	vaultPath(tmdbId: number, type: "film" | "tv"): string {
		return normalizePath(`${this.folder}/${this.fileName(tmdbId, type)}`);
	}

	/**
	 * Download and store, returning the vault-relative path to record in
	 * frontmatter. Returns null if posters are off, there is no poster, or the
	 * download failed — a missing poster must never block note creation.
	 */
	async cache(tmdbId: number, type: "film" | "tv", posterPath: string | null | undefined): Promise<string | null> {
		if (!this.plugin.settings.downloadPosters || !posterPath) return null;

		const dest = this.vaultPath(tmdbId, type);
		const existing = this.plugin.app.vault.getAbstractFileByPath(dest);
		if (existing instanceof TFile) return dest;

		const url = this.plugin.tmdb.posterUrl(posterPath);
		if (!url) return null;

		try {
			await this.ensureFolder();
			const bytes = await this.plugin.tmdb.fetchImage(url);
			// Re-check: a concurrent add of the same title may have won the race.
			if (this.plugin.app.vault.getAbstractFileByPath(dest) instanceof TFile) return dest;
			await this.plugin.app.vault.createBinary(dest, bytes);
			return dest;
		} catch (e) {
			console.warn("Reel: poster download failed —", redact(e));
			return null;
		}
	}

	/** Resource URL for an <img>, or null if the file isn't in the vault. */
	resourcePath(vaultPath: string | undefined): string | null {
		if (!vaultPath) return null;
		const file = this.plugin.app.vault.getAbstractFileByPath(normalizePath(vaultPath));
		return file instanceof TFile ? this.plugin.app.vault.getResourcePath(file) : null;
	}

	private async ensureFolder(): Promise<void> {
		const vault = this.plugin.app.vault;
		const parts = this.folder.split("/").filter(Boolean);
		let cur = "";
		for (const part of parts) {
			cur = cur ? `${cur}/${part}` : part;
			if (!vault.getAbstractFileByPath(cur)) {
				try {
					await vault.createFolder(cur);
				} catch {
					// Another call created it between the check and the create.
				}
			}
		}
	}

	/** Backfill posters for entries that have none. Used by the repair command. */
	async backfill(): Promise<number> {
		let done = 0;
		const missing = this.plugin.library
			.all()
			.filter((e) => !e.poster || !this.plugin.app.vault.getAbstractFileByPath(e.poster));

		if (!missing.length) return 0;
		const notice = new Notice(`Reel: fetching ${missing.length} posters…`, 0);
		try {
			for (const entry of missing) {
				const type = entry.type === "tv" ? "tv" : "film";
				try {
					const meta =
						type === "tv"
							? await this.plugin.tmdb.getShow(entry.tmdbId)
							: await this.plugin.tmdb.getFilm(entry.tmdbId);
					const stored = await this.cache(entry.tmdbId, type, meta.poster_path);
					if (stored) {
						const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
						if (file instanceof TFile) {
							await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
								fm.poster = stored;
							});
						}
						done++;
					}
				} catch (e) {
					console.warn("Reel: backfill skipped", entry.title, redact(e));
				}
				// TMDB tolerates bursts, but a 500-title vault shouldn't hammer it.
				await sleep(250);
			}
		} finally {
			notice.hide();
		}
		return done;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => window.setTimeout(r, ms));
}
