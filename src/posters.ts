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

import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { Vault } from "obsidian";
import type ReelPlugin from "./main";
import { redact } from "./secrets";
import { orphanedPosters } from "./util/prune";

export class PosterStore {
	constructor(private plugin: ReelPlugin) {}

	/** Set while a backfill runs, so a second invocation stops the first. */
	private cancelBackfill = false;
	private backfilling = false;

	/** True while posters are being written, so pruning knows to wait. */
	get busy(): boolean {
		return this.backfilling;
	}

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

	/**
	 * The best available image for an entry.
	 *
	 * A local copy first, then whatever remote URL an import left behind. Notes
	 * converted from another tracker carry `poster_url` and no local file, so
	 * without this fallback an imported library is a wall of grey placeholders
	 * until the backfill runs.
	 */
	displayUrl(entry: { poster?: string; posterUrl?: string }): string | null {
		return this.resourcePath(entry.poster) ?? entry.posterUrl ?? null;
	}

	/**
	 * Draw a poster into a container, with the fallback built in.
	 *
	 * Six places were each doing this by hand and five of them forgot the
	 * error case, which matters because an imported poster is a remote URL —
	 * offline or a dead link left a blank box rather than the placeholder a
	 * missing poster gets. One helper means the fallback can't be forgotten in
	 * the next place that needs one.
	 */
	attach(parent: HTMLElement, entry: { poster?: string; posterUrl?: string; title: string }): void {
		const src = this.displayUrl(entry);
		const fallback = () => {
			parent.addClass("is-empty");
			parent.createSpan({ cls: "reel-placeholder-text", text: entry.title.slice(0, 2) });
		};

		if (!src) {
			fallback();
			return;
		}

		// A tinted block sits under every poster from the moment the box exists,
		// so a grid has its shape before any image decodes. Derived from the
		// title, not random, so the same film gets the same colour every time —
		// a placeholder that changes on each repaint is worse than a grey one.
		parent.addClass("reel-poster-loading");
		parent.setCssProps({ "--reel-poster-hue": String(hueOf(entry.title)) });

		// One class on the image itself, rather than adding the fade to each of
		// the ~28 `.reel-something-poster img` rules that already exist. Every
		// image on every screen comes through here, so one selector covers all
		// of them and the next screen gets it for free.
		const img = parent.createEl("img", {
			cls: "reel-img",
			attr: { src, alt: "", loading: "lazy", decoding: "async" },
		});

		// Without this every poster snaps to full opacity the instant it
		// decodes, and twenty of them arrive in whatever order the disk and the
		// network settle on. The result reads as flicker rather than loading.
		const settle = () => {
			parent.removeClass("reel-poster-loading");
			img.addClass("is-loaded");
		};
		// A cached image can be complete before the listener is attached, in
		// which case `load` has already fired and would never fire again.
		if (img.complete && img.naturalWidth > 0) settle();
		else img.addEventListener("load", settle, { once: true });

		img.addEventListener("error", () => {
			parent.removeClass("reel-poster-loading");
			img.remove();
			fallback();
		});
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
		await hideFromGallery(vault, this.folder);
	}

	/** Backfill posters for entries that have none. Used by the repair command. */
	async backfill(): Promise<number> {
		// A second run is a request to stop, not to start another: a 500-title
		// vault takes minutes, and there was no way to call it off.
		if (this.backfilling) {
			this.cancelBackfill = true;
			return -1;
		}
		this.backfilling = true;
		this.cancelBackfill = false;
		let done = 0;
		const missing = this.plugin.library
			.all()
			.filter((e) => !e.poster || !this.plugin.app.vault.getAbstractFileByPath(e.poster));

		if (!missing.length) {
			this.backfilling = false;
			return 0;
		}
		// Persistent notice, so it has to carry progress — a frozen "fetching
		// 500 posters" for two minutes is indistinguishable from a hang.
		const notice = new Notice("", 0);
		const progress = (i: number) =>
			notice.setMessage(`Reel: poster ${i} of ${missing.length}… (run the command again to stop)`);
		progress(0);
		try {
			for (const [i, entry] of missing.entries()) {
				if (this.cancelBackfill) break;
				progress(i + 1);
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
			this.backfilling = false;
			this.cancelBackfill = false;
		}
		return done;
	}

	/**
	 * Which cached posters are no longer referenced by any note.
	 *
	 * Deleting a film used to leave its poster behind forever — the folder
	 * only ever grew, which is the opposite of keeping everything tidy in its
	 * folders. Kept separate from the removal so the count can be shown before
	 * anything is deleted; a number you can check is the only warning you get.
	 */
	findOrphans(): TFile[] {
		const folder = this.plugin.app.vault.getAbstractFileByPath(normalizePath(this.folder));
		if (!(folder instanceof TFolder)) return [];

		const entries = this.plugin.library.all();
		const files = folder.children.filter((c): c is TFile => c instanceof TFile);

		// The decision itself lives in util/prune.ts, where it is tested —
		// including the case where an unbuilt index would otherwise mean
		// "nothing is referenced, remove everything", and the case where the
		// poster folder also holds files that are not Reel's to delete.
		const doomed = new Set(
			orphanedPosters({
				files: files.map((f) => f.path),
				referenced: entries.map((e) => e.poster),
				libraryEmpty: entries.length === 0,
			})
		);
		return files.filter((f) => doomed.has(f.path));
	}

	/** Move the given posters to the system trash, so a wrong call is undoable. */
	async removeOrphans(files: TFile[]): Promise<number> {
		let removed = 0;
		for (const file of files) {
			try {
				await this.plugin.app.fileManager.trashFile(file);
				removed++;
			} catch (e) {
				console.warn("Reel: could not remove orphaned poster", file.path, redact(e));
			}
		}
		return removed;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => window.setTimeout(r, ms));
}

/**
 * A stable hue for a title, used to tint its loading placeholder.
 *
 * Any cheap hash would do; this one only has to be deterministic and spread
 * titles across the wheel. The point is that a grid mid-load looks like a
 * deliberate set of coloured cards rather than a page of identical grey boxes,
 * and that each box keeps its colour across repaints.
 */
function hueOf(title: string): number {
	let h = 0;
	for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
	return h;
}

/**
 * Keep the cache out of the phone's photo gallery.
 *
 * Reported from a screenshot of Google Photos: portraits of Johnny Depp,
 * Robert Downey Jr and Jonathan Pryce sitting in the user's camera roll among
 * their own pictures. Nothing was uploaded anywhere — these are the cached
 * TMDB stills, and the cause is entirely local. Android's MediaStore walks
 * shared storage and indexes every image file it finds, and an Obsidian vault
 * is an ordinary folder on shared storage. Writing real `.jpg` files into it,
 * which is exactly what the poster and portrait caches do, hands them to the
 * gallery.
 *
 * `.nomedia` is the documented way to opt a directory out, honoured by the
 * scanner and by every gallery app on top of it. One empty file covers the
 * whole subtree, and both caches live in the same folder, so either one
 * creating it is enough.
 *
 * Written through the adapter rather than the vault: dotfiles are not vault
 * files, and `vault.create` will not make one.
 *
 * Best effort by design. If this throws — a read-only adapter, a desktop
 * platform that has no such convention — the cache still works and the only
 * cost is on a platform where the file meant nothing anyway.
 */
export async function hideFromGallery(vault: Vault, folder: string): Promise<void> {
	const marker = normalizePath(`${folder}/.nomedia`);
	try {
		if (await vault.adapter.exists(marker)) return;
		await vault.adapter.write(marker, "");
	} catch {
		// Not every platform allows this, and none of them need it to work.
	}
}
