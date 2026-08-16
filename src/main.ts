import { Notice, Plugin, TFile, addIcon } from "obsidian";
import { DEFAULT_SETTINGS, ReelSettingTab, ReelSettings } from "./settings";
import { CredentialStore, MissingKeyError } from "./credentials";
import { TmdbClient } from "./tmdb";
import { Library } from "./library";
import { NoteWriter } from "./notes";
import { PosterStore } from "./posters";
import { SearchModal } from "./ui/searchModal";
import { LogSheet } from "./ui/logSheet";
import { SeasonSheet } from "./ui/seasonSheet";
import { registerHeaderProcessor } from "./render/header";
import { registerLibraryBlocks } from "./render/library";
import { registerStatsBlock } from "./render/stats";
import { registerUpNextBlock, UpNextService } from "./render/upnext";
import { redact } from "./secrets";
import { todayISO } from "./util/dates";

/**
 * `addIcon` takes the *contents* of an SVG, not an `<svg>` element — Obsidian
 * supplies the wrapper itself, on a 0 0 100 100 viewBox. Passing a full element
 * nests one svg inside another, which renders at the wrong size.
 */
const REEL_ICON = `<circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="8"/>
<circle cx="50" cy="30" r="9" fill="currentColor"/>
<circle cx="50" cy="70" r="9" fill="currentColor"/>
<circle cx="30" cy="50" r="9" fill="currentColor"/>
<circle cx="70" cy="50" r="9" fill="currentColor"/>`;

const NEW_EPISODE_CHECK_KEY = "reel-last-episode-check";

export default class ReelPlugin extends Plugin {
	settings!: ReelSettings;
	credentials!: CredentialStore;
	tmdb!: TmdbClient;
	library!: Library;
	notes!: NoteWriter;
	posters!: PosterStore;
	upNext!: UpNextService;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.credentials = new CredentialStore(this);
		this.tmdb = new TmdbClient(this);
		this.library = new Library(this);
		this.notes = new NoteWriter(this);
		this.posters = new PosterStore(this);
		this.upNext = new UpNextService(this);

		addIcon("reel", REEL_ICON);

		// The index needs a resolved metadata cache. On a cold start that isn't
		// ready during onload, so defer — `onLayoutReady` fires once it is.
		this.app.workspace.onLayoutReady(() => {
			this.library.load();
			if (this.settings.checkNewEpisodes) void this.checkNewEpisodes();
		});

		registerHeaderProcessor(this);
		registerLibraryBlocks(this);
		registerStatsBlock(this);
		registerUpNextBlock(this);

		this.registerCommands();
		this.registerRibbon();

		this.addSettingTab(new ReelSettingTab(this.app, this));
	}

	onunload(): void {
		this.credentials?.unload();
	}

	/* ------------------------------------------------------------------ */

	private registerRibbon(): void {
		// Also reachable from the mobile toolbar — Obsidian surfaces ribbon
		// actions there, so this single registration covers both.
		const el = this.addRibbonIcon("reel", "Reel: log a film or series", () => {
			this.openSearch();
		});
		el.addClass("reel-ribbon");
	}

	private registerCommands(): void {
		this.addCommand({
			id: "log",
			name: "Log a film or series",
			icon: "reel",
			callback: () => this.openSearch(),
		});

		this.addCommand({
			id: "add-watchlist",
			name: "Add to watchlist",
			callback: () => this.openSearch({ watchlist: true }),
		});

		this.addCommand({
			id: "log-current",
			name: "Log the current note",
			checkCallback: (checking) => {
				const entry = this.currentEntry();
				if (!entry) return false;
				if (!checking) {
					const file = this.app.vault.getAbstractFileByPath(entry.path);
					if (file instanceof TFile) new LogSheet(this.app, this, { file, entry }).open();
				}
				return true;
			},
		});

		this.addCommand({
			id: "mark-next-episode",
			name: "Mark next episode watched",
			checkCallback: (checking) => {
				const entry = this.currentEntry();
				if (!entry || entry.type !== "tv") return false;
				const next = this.upNext.nextFor(entry);
				if (!next) return false;
				if (!checking) {
					const file = this.app.vault.getAbstractFileByPath(entry.path);
					if (file instanceof TFile) {
						void this.notes
							.markEpisode(file, next.season, next.episode, todayISO())
							.then(() => new Notice(`Reel: S${next.season}E${next.episode} watched.`))
							.catch((e) => new Notice(`Reel: ${redact(e)}`));
					}
				}
				return true;
			},
		});

		this.addCommand({
			id: "open-season",
			name: "Open season checklist",
			checkCallback: (checking) => {
				const entry = this.currentEntry();
				if (!entry || entry.type !== "tv") return false;
				if (!checking) {
					const season = this.upNext.nextFor(entry)?.season ?? entry.seasons[0]?.n ?? 1;
					new SeasonSheet(this.app, this, entry, season).open();
				}
				return true;
			},
		});

		this.addCommand({
			id: "toggle-liked",
			name: "Toggle liked",
			checkCallback: (checking) => {
				const entry = this.currentEntry();
				if (!entry) return false;
				if (!checking) {
					const file = this.app.vault.getAbstractFileByPath(entry.path);
					if (file instanceof TFile) {
						void this.notes.toggleLiked(file).then((on) => new Notice(on ? "Reel: liked." : "Reel: unliked."));
					}
				}
				return true;
			},
		});

		this.addCommand({
			id: "refresh-metadata",
			name: "Refresh metadata from TMDB",
			checkCallback: (checking) => {
				const entry = this.currentEntry();
				if (!entry) return false;
				if (!checking) {
					void this.notes
						.refreshMetadata(entry)
						.then(() => new Notice("Reel: metadata refreshed."))
						.catch((e) => new Notice(`Reel: ${redact(e)}`));
				}
				return true;
			},
		});

		this.addCommand({
			id: "backfill-posters",
			name: "Download missing posters",
			callback: async () => {
				try {
					const n = await this.posters.backfill();
					new Notice(`Reel: cached ${n} poster${n === 1 ? "" : "s"}.`);
				} catch (e) {
					new Notice(`Reel: ${redact(e)}`);
				}
			},
		});

		this.addCommand({
			id: "lock-key",
			name: "Lock the TMDB key",
			checkCallback: (checking) => {
				if (!this.credentials.isUnlocked) return false;
				if (!checking) {
					this.credentials.lock();
					new Notice("Reel: key locked.");
				}
				return true;
			},
		});

		this.addCommand({
			id: "rebuild-index",
			name: "Rebuild the library index",
			callback: () => {
				this.library.rebuild();
				new Notice(`Reel: indexed ${this.library.size} titles.`);
			},
		});
	}

	private openSearch(opts: { watchlist?: boolean } = {}): void {
		if (!this.credentials.hasStoredKey && this.settings.keyMode !== "session") {
			new Notice("Reel: add a TMDB key in Settings → Reel first.", 6000);
			return;
		}
		new SearchModal(this.app, this, opts).open();
	}

	private currentEntry() {
		const file = this.app.workspace.getActiveFile();
		return file ? this.library.byPath(file.path) : undefined;
	}

	/* ------------------------------------------------------------------ */

	/**
	 * Once a day, refresh shows TMDB still marks as returning so Up Next can
	 * badge them. Throttled and sequential — this runs at startup and must not
	 * saturate a phone's connection.
	 */
	private async checkNewEpisodes(): Promise<void> {
		const last = window.localStorage.getItem(NEW_EPISODE_CHECK_KEY);
		if (last === todayISO()) return;

		const returning = this.library
			.shows()
			.filter((s) => s.showStatus === "Returning Series" && s.status !== "dropped");
		if (!returning.length) {
			window.localStorage.setItem(NEW_EPISODE_CHECK_KEY, todayISO());
			return;
		}

		// Silent by design: no key, no check, no nag. The user will hit the
		// prompt when they deliberately do something instead.
		if (!this.credentials.isUnlocked && this.settings.keyMode !== "plain") return;

		for (const show of returning) {
			try {
				await this.notes.refreshMetadata(show);
			} catch (e) {
				if (e instanceof MissingKeyError) return;
				console.warn("Reel: episode check skipped", show.title, redact(e));
			}
			await new Promise((r) => window.setTimeout(r, 400));
		}
		window.localStorage.setItem(NEW_EPISODE_CHECK_KEY, todayISO());
	}

	/* ------------------------------------------------------------------ */

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<ReelSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
