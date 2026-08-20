/**
 * Headshot caching.
 *
 * The second thing Reel writes into the vault as binary, after posters, and
 * it follows the same rules for the same reasons: one small jpg per person,
 * named by TMDB id so nothing depends on a name the user can rename, and
 * fetched lazily rather than in a burst at note creation.
 *
 * The problem it solves is one that read as a bug: the stats page showed a
 * film poster under each actor's name. The data was right — that *is* the
 * film they were in — but a poster under a person's name implies a photo of
 * that person, and delivering artwork instead looks broken. Especially in a
 * small library, where every actor was in the same film and every row showed
 * the same image.
 *
 * Lazy on purpose. Caching ten headshots per title at creation would mean ten
 * downloads before a note you asked for exists, against a free API, for
 * decoration on a screen you may never open.
 */

import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type ReelPlugin from "./main";
import { redact } from "./secrets";
import { hideFromGallery } from "./posters";

export class PeopleStore {
	constructor(private plugin: ReelPlugin) {}

	private backfilling = false;
	private cancel = false;
	/** Ids with no usable photo, so a person with none is asked about once. */
	private missing = new Set<number>();
	/** In-flight fetches, so a repaint mid-download does not start a second. */
	private fetching = new Map<number, Promise<string | null>>();

	get busy(): boolean {
		return this.backfilling;
	}

	private get folder(): string {
		// Beside the posters rather than in a folder of its own: both are
		// Reel's cached images, and one place to exclude from search or sync
		// is easier to explain than two.
		return normalizePath(`${this.plugin.settings.posterFolder}/People`);
	}

	fileName(personId: number): string {
		return `person-${personId}.jpg`;
	}

	vaultPath(personId: number): string {
		return normalizePath(`${this.folder}/${this.fileName(personId)}`);
	}

	/** The local file for a person, if one has already been cached. */
	localPath(personId: number): string | null {
		const path = this.vaultPath(personId);
		return this.plugin.app.vault.getAbstractFileByPath(path) instanceof TFile ? path : null;
	}

	resourcePath(personId: number): string | null {
		const path = this.localPath(personId);
		if (!path) return null;
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? this.plugin.app.vault.getResourcePath(file) : null;
	}

	/**
	 * Fetch and store a headshot, returning the vault path.
	 *
	 * Null covers every ordinary failure — headshots turned off, no photo on
	 * TMDB, no key, offline. None of them is worth a message: the initials
	 * placeholder is a perfectly good answer and always available.
	 */
	async cache(personId: number): Promise<string | null> {
		if (!personId || !this.plugin.settings.downloadPosters) return null;

		const existing = this.localPath(personId);
		if (existing) return existing;
		if (this.missing.has(personId)) return null;

		const running = this.fetching.get(personId);
		if (running) return running;

		const job = this.fetchNow(personId).finally(() => this.fetching.delete(personId));
		this.fetching.set(personId, job);
		return job;
	}

	private async fetchNow(personId: number): Promise<string | null> {
		try {
			const person = await this.plugin.tmdb.getPerson(personId);
			const profile = person?.profile_path;
			if (!profile) {
				// Plenty of real people have no photo on TMDB. Remembering that
				// stops every repaint of the stats page asking again.
				this.missing.add(personId);
				return null;
			}

			// w185 — these are rendered at 40–70px. A w500 would be four times
			// the bytes for pixels no screen will ever show.
			const url = this.plugin.tmdb.posterUrl(profile, "w185");
			if (!url) return null;

			await this.ensureFolder();
			const bytes = await this.plugin.tmdb.fetchImage(url);
			const dest = this.vaultPath(personId);
			// Re-check: a concurrent render of the same person may have won.
			if (this.plugin.app.vault.getAbstractFileByPath(dest) instanceof TFile) return dest;
			await this.plugin.app.vault.createBinary(dest, bytes);
			return dest;
		} catch (e) {
			console.warn("Reel: headshot fetch failed —", redact(e));
			return null;
		}
	}

	/**
	 * Draw a person into a container: photo if there is one, initials if not.
	 *
	 * Renders synchronously with the placeholder and swaps in the photo when
	 * it arrives, so a list of twenty people appears immediately rather than
	 * waiting on twenty requests. Nothing moves when a photo lands — the box
	 * is the same size either way.
	 */
	attach(parent: HTMLElement, name: string, personId?: number): void {
		const draw = (src: string) => {
			parent.removeClass("is-empty");
			parent.empty();
			const img = parent.createEl("img", {
				cls: "reel-img",
				attr: { src, alt: "", loading: "lazy", decoding: "async" },
			});
			const settle = () => img.addClass("is-loaded");
			if (img.complete && img.naturalWidth > 0) settle();
			else img.addEventListener("load", settle, { once: true });
			img.addEventListener("error", () => {
				img.remove();
				this.placeholder(parent, name);
			});
		};

		const cached = personId ? this.resourcePath(personId) : null;
		if (cached) {
			draw(cached);
			return;
		}

		this.placeholder(parent, name);
		if (!personId) return;

		void this.cache(personId).then((path) => {
			// The screen may have been repainted or navigated away from while
			// the request was in the air.
			if (!path || !parent.isConnected) return;
			const src = this.resourcePath(personId);
			if (src) draw(src);
		});
	}

	/** Initials, which is what every contacts app falls back to and reads fine. */
	private placeholder(parent: HTMLElement, name: string): void {
		parent.addClass("is-empty");
		const initials = name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("");
		parent.createSpan({ cls: "reel-placeholder-text", text: initials || "?" });
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
					/* raced with another create */
				}
			}
		}
		// The portraits are the half of the cache that actually showed up in
		// the phone's gallery. See the note on the helper.
		await hideFromGallery(vault, this.folder);
	}

	/**
	 * Fetch every headshot the library could show, ahead of needing them.
	 *
	 * Same shape as the poster backfill, and for the same reason: a large
	 * library is minutes of work, so it reports progress and a second
	 * invocation calls it off.
	 */
	async backfill(): Promise<number> {
		if (this.backfilling) {
			this.cancel = true;
			return -1;
		}

		const wanted = new Set<number>();
		for (const entry of this.plugin.library.all()) {
			for (const id of [...entry.castIds, ...entry.directorIds]) {
				if (id && !this.localPath(id) && !this.missing.has(id)) wanted.add(id);
			}
		}
		if (!wanted.size) return 0;

		this.backfilling = true;
		this.cancel = false;
		const ids = [...wanted];
		const notice = new Notice("", 0);
		let done = 0;
		try {
			for (const [i, id] of ids.entries()) {
				if (this.cancel) break;
				notice.setMessage(`Reel: headshot ${i + 1} of ${ids.length}… (run the command again to stop)`);
				if (await this.cache(id)) done++;
				await new Promise((r) => window.setTimeout(r, 250));
			}
		} finally {
			notice.hide();
			this.backfilling = false;
			this.cancel = false;
		}
		return done;
	}

	/**
	 * Cached headshots for people no note mentions any more.
	 *
	 * Same paranoia as the poster prune: an index that reads empty is never
	 * taken as permission to delete, and only Reel's own `person-<id>.jpg`
	 * shape is ever a candidate.
	 */
	findOrphans(): TFile[] {
		const folder = this.plugin.app.vault.getAbstractFileByPath(this.folder);
		if (!(folder instanceof TFolder)) return [];

		const entries = this.plugin.library.all();
		if (!entries.length) return [];

		const referenced = new Set<number>();
		for (const entry of entries) {
			for (const id of [...entry.castIds, ...entry.directorIds]) if (id) referenced.add(id);
		}

		return folder.children.filter((c): c is TFile => {
			if (!(c instanceof TFile)) return false;
			const match = /^person-(\d+)\.jpg$/.exec(c.name);
			if (!match) return false;
			return !referenced.has(Number(match[1]));
		});
	}
}
