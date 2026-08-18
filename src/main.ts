import { Notice, Plugin, TFile, WorkspaceLeaf, addIcon } from "obsidian";
import { DEFAULT_SETTINGS, ReelSettingTab, ReelSettings } from "./settings";
import { canPersist, mergeForSave } from "./util/settingsguard";
import { keyboardInset } from "./util/panewidth";
import { CredentialStore, MissingKeyError } from "./credentials";
import { TmdbClient } from "./tmdb";
import { Library } from "./library";
import { NoteWriter } from "./notes";
import { PosterStore } from "./posters";
import { Importer } from "./importer";
import { DtddClient, OmdbClient } from "./enrich";
import { DiscoverEngine } from "./discover";
import { UndoService } from "./undo";
import { SwatchStore } from "./swatches";
import { reportFailure, offline } from "./ui/failure";
import { PeopleStore } from "./people";
import { STARTER_BASES } from "./bases";
import { SearchModal } from "./ui/searchModal";
import { RecipeSheet } from "./ui/recipeSheet";
import type { Recipe } from "./util/recipe";
import { LogSheet } from "./ui/logSheet";
import { SeasonSheet } from "./ui/seasonSheet";
import { ListPicker } from "./ui/listPicker";
import { registerHeaderProcessor } from "./render/header";
import { registerLibraryBlocks } from "./render/library";
import { registerStatsBlock } from "./render/stats";
import { registerUpNextBlock, UpNextService } from "./render/upnext";
import { registerDiaryBlock } from "./render/diary";
import { registerCalendarBlock } from "./render/calendar";
import { REEL_VIEW, ReelView } from "./view";
import { policyBreach, ContentPolicy } from "./content";
import { redact } from "./secrets";
import { uiSnapshot } from "./ui/snapshot";
import { confirm } from "./ui/confirm";
import { todayISO } from "./util/dates";
import type { Entry } from "./types";

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


export default class ReelPlugin extends Plugin {
	settings!: ReelSettings;
	credentials!: CredentialStore;
	tmdb!: TmdbClient;
	library!: Library;
	notes!: NoteWriter;
	posters!: PosterStore;
	upNext!: UpNextService;
	importer!: Importer;
	omdb!: OmdbClient;
	dtdd!: DtddClient;
	discover!: DiscoverEngine;
	undo!: UndoService;
	swatches!: SwatchStore;
	people!: PeopleStore;


	async onload(): Promise<void> {
		await this.loadSettings();

		this.credentials = new CredentialStore(this);
		this.tmdb = new TmdbClient(this);
		this.library = new Library(this);
		this.notes = new NoteWriter(this);
		this.posters = new PosterStore(this);
		this.upNext = new UpNextService(this);
		this.importer = new Importer(this);
		this.omdb = new OmdbClient(this);
		this.dtdd = new DtddClient(this);
		this.discover = new DiscoverEngine(this);
		this.swatches = new SwatchStore();
		this.people = new PeopleStore(this);
		this.undo = new UndoService(this);
		// Steps hold a path, and a path stops meaning anything the moment the
		// note behind it is renamed or deleted.
		this.undo.watch();

		// Sheets are pinned to the bottom of the screen, and a phone keyboard is
		// drawn over that. Without this the passphrase prompt appears behind the
		// keyboard — focused, invisible, and impossible to complete.
		this.register(keyboardInset());

		addIcon("reel", REEL_ICON);

		this.registerView(REEL_VIEW, (leaf: WorkspaceLeaf) => new ReelView(leaf, this));

		this.app.workspace.onLayoutReady(() => {
			this.library.load();
			// Cache files written before the filename carried a hash are long
			// enough to break `git add` in a vault under version control, and
			// nothing will ever read them again. Cleared silently on load —
			// a cache file is never worth a notice.
			void this.tmdb.pruneLegacyCache();
			if (this.settings.checkNewEpisodes) void this.checkNewEpisodes();
		});

		registerHeaderProcessor(this);
		registerLibraryBlocks(this);
		registerStatsBlock(this);
		registerUpNextBlock(this);
		registerDiaryBlock(this);
		registerCalendarBlock(this);

		this.registerCommands();

		const ribbon = this.addRibbonIcon("reel", "Reel", () => this.openView());
		ribbon.addClass("reel-ribbon");

		this.addSettingTab(new ReelSettingTab(this.app, this));
	}

	onunload(): void {
		this.credentials?.unload();
	}

	/* ------------------------------------------------------------------ */
	/* Content policy                                                      */
	/* ------------------------------------------------------------------ */

	get policy(): ContentPolicy {
		return {
			hideFlags: this.settings.hideFlags as ContentPolicy["hideFlags"],
			maxCertification: this.settings.maxCertification,
			hideUnrated: this.settings.hideUnrated,
		};
	}

	/**
	 * Apply the content policy to any list of titles. Every surface that shows
	 * titles routes through here, so turning a filter on hides consistently
	 * rather than in some views and not others.
	 */
	visible(entries: Entry[]): Entry[] {
		const policy = this.policy;
		if (!policy.hideFlags.length && !policy.maxCertification && !policy.hideUnrated) return entries;
		return entries.filter((e) => policyBreach(e, policy) == null);
	}

	/**
	 * How many of *these* entries the policy hides.
	 *
	 * Takes the list rather than reporting on whatever called `visible()` last:
	 * several surfaces filter on every repaint, so a shared counter meant the
	 * Library could show a number produced by Stats.
	 */
	hiddenCount(entries: Entry[]): number {
		return entries.length - this.visible(entries).length;
	}

	/* ------------------------------------------------------------------ */

	async openView(targetTab = false): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(REEL_VIEW);
		if (existing.length) {
			// A command that targets a tab has to switch it explicitly;
			// revealing alone would leave you wherever you already were.
			if (targetTab) {
				const view = existing[0].view;
				if (view instanceof ReelView) view.showTab(this.settings.lastTab);
			}
			await this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		// On a phone the main area is the only sensible place; a sidebar leaf
		// would open in a drawer the user then has to swipe away.
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: REEL_VIEW, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	/** Open a title's detail screen in the Reel view, opening the view if needed. */
	async openDetail(entry: Entry): Promise<void> {
		await this.openView();
		const leaf = this.app.workspace.getLeavesOfType(REEL_VIEW)[0];
		const view = leaf?.view;
		if (view instanceof ReelView) view.openDetail(entry);
	}

	/** Open the Reel view on a named tab. */
	async openTab(tab: string): Promise<void> {
		await this.openView();
		const leaf = this.app.workspace.getLeavesOfType(REEL_VIEW)[0];
		const view = leaf?.view;
		if (view instanceof ReelView) view.showTab(tab);
	}

	/** Open the Library showing one status — used by the stats tiles. */
	async openLibraryWithStatus(status: string | null, from?: string): Promise<void> {
		await this.openView();
		const leaf = this.app.workspace.getLeavesOfType(REEL_VIEW)[0];
		const view = leaf?.view;
		if (view instanceof ReelView) view.filterByStatus(status, from);
	}

	/** Open the Library filtered by a term — used by cast and genre taps. */
	async openViewWithSearch(query: string, from?: string): Promise<void> {
		await this.openView();
		const leaf = this.app.workspace.getLeavesOfType(REEL_VIEW)[0];
		const view = leaf?.view;
		if (view instanceof ReelView) view.searchFor(query, from);
	}

	/**
	 * Find, confirm, then remove. Lives here rather than in either caller so
	 * the command and the settings button cannot drift apart — a confirmation
	 * added to one and not the other is worse than none, because the missing
	 * one is the surprise.
	 */
	async prunePosters(): Promise<void> {
		// A backfill in flight is writing posters this would judge unreferenced,
		// because the frontmatter that will point at them is not written yet.
		if (this.posters.busy) {
			new Notice("Reel: posters are still downloading — try again once that finishes.");
			return;
		}
		const orphans = this.posters.findOrphans();
		if (!orphans.length) {
			new Notice("Reel: no orphaned posters.");
			return;
		}
		const ok = await confirm(this.app, {
			title: "Remove unused posters",
			body: `${orphans.length} cached poster${orphans.length === 1 ? "" : "s"} ${
				orphans.length === 1 ? "is" : "are"
			} no longer used by any note. They move to the system trash, so this can be undone.`,
			confirmText: `Move ${orphans.length} to trash`,
			danger: true,
		});
		if (!ok) return;

		const n = await this.posters.removeOrphans(orphans);
		new Notice(`Reel: moved ${n} poster${n === 1 ? "" : "s"} to the trash.`);
	}

	/** Set while the whole-library enrichment runs, so a second call stops it. */
	private enriching = false;
	private cancelEnrich = false;

	/**
	 * The guided flow, or one you saved.
	 *
	 * Gated on the same two things a search is: without a key there is nothing
	 * to recommend from, and offline the whole thing is a spinner that ends in
	 * an error.
	 */
	openRecipe(saved?: Recipe): void {
		if (!this.credentials.hasStoredKey && this.settings.keyMode !== "session") {
			new Notice("Reel: add a TMDB key in Settings → Reel first.", 6000);
			return;
		}
		if (offline()) {
			new Notice("Reel: finding new things needs a connection. Your library still works.", 7000);
			return;
		}
		new RecipeSheet(this, saved).open();
	}

	openSearch(opts: { watchlist?: boolean; query?: string } = {}): void {
		if (!this.credentials.hasStoredKey && this.settings.keyMode !== "session") {
			new Notice("Reel: add a TMDB key in Settings → Reel first.", 6000);
			return;
		}
		// Checked before opening, not after failing. Searching TMDB is the one
		// thing in Reel that genuinely cannot work offline, and a modal that
		// opens, spins, then errors is a worse way to learn that than a
		// sentence saying so.
		if (offline()) {
			new Notice(
				"Reel: you're offline — searching TMDB needs a connection. Everything already in your library still works.",
				7000
			);
			return;
		}
		new SearchModal(this.app, this, opts).open();
	}

	private currentEntry() {
		const file = this.app.workspace.getActiveFile();
		return file ? this.library.byPath(file.path) : undefined;
	}

	private withEntry(checking: boolean, fn: (entry: Entry, file: TFile) => void, needTv = false): boolean {
		const entry = this.currentEntry();
		if (!entry) return false;
		if (needTv && entry.type !== "tv") return false;
		if (!checking) {
			const file = this.app.vault.getAbstractFileByPath(entry.path);
			if (file instanceof TFile) fn(entry, file);
		}
		return true;
	}

	private registerCommands(): void {
		this.addCommand({ id: "open-view", name: "Open library", icon: "reel", callback: () => void this.openView() });

		// One command per tab: the palette is how a keyboard user navigates,
		// and "open, then click a tab" is two steps where one will do.
		for (const [id, tab, name] of [
			["open-discover", "discover", "Open discover"],
			["open-rate", "rate", "Open rate"],
			["open-upnext", "upnext", "Open up next"],
			["open-diary", "diary", "Open diary"],
			["open-stats", "stats", "Open stats"],
		] as const) {
			this.addCommand({
				id,
				name,
				callback: () => {
					this.settings.lastTab = tab;
					void this.saveSettings().then(() => this.openView(true));
				},
			});
		}

		// Named after what it would actually do, so the palette tells you
		// whether pressing it is safe before you press it.
		this.addCommand({
			id: "undo",
			name: "Undo the last change",
			checkCallback: (checking) => {
				const last = this.undo.last;
				if (!last) return false;
				if (!checking) void this.undo.undo();
				return true;
			},
		});

		this.addCommand({
			id: "find-something",
			name: "Find something to watch",
			icon: "compass",
			callback: () => this.openRecipe(),
		});

		this.addCommand({ id: "log", name: "Log a film or series", icon: "reel", callback: () => this.openSearch() });

		/*
		 * What the layout thinks it is, on the device it is running on.
		 *
		 * Two layout bugs have been reported from a phone, and neither
		 * reproduced in the harness — so the harness and that phone disagree
		 * about something, and no amount of guessing from here will say what.
		 * This reports the measured pane width, the classes that came out of
		 * it, and what the platform flags claim, which is the whole input to
		 * every layout decision Reel makes.
		 *
		 * No vault contents, no key, nothing but geometry.
		 */
		/*
		 * The whole screen, as text.
		 *
		 * Layout diagnostics below reports what Reel believes about itself.
		 * This reports what is actually on the glass — Obsidian's chrome
		 * included — and, critically, which controls have something drawn on
		 * top of them. Works from any screen, not just the Reel view, because
		 * the bugs live at the seam between Reel and the app around it.
		 */
		this.addCommand({
			id: "copy-ui-snapshot",
			name: "Copy UI snapshot",
			callback: () => {
				// Async now: it waits for the command palette to finish closing
				// before measuring. Measured too early, every control on screen
				// reads as covered by the palette's own backdrop.
				void uiSnapshot().then((text) =>
					navigator.clipboard
						.writeText(text)
						.then(() => new Notice(`UI snapshot copied — ${text.length.toLocaleString()} characters.`))
						.catch(() => {
							// A phone that refuses the clipboard would otherwise
							// lose the whole point, so fall back to a file the
							// user can open and copy from by hand.
							void this.writeSnapshotFile(text);
						})
				);
			},
		});

		/*
		 * Capture when the keyboard appears, rather than on a countdown.
		 *
		 * The countdown was the wrong shape twice over. Obsidian draws its notice
		 * across the top of the screen, covering the very header action you have to
		 * tap to open search — and making it `pointer-events: none` so taps could
		 * pass through also made it impossible to dismiss. The tool obstructed the
		 * action it was asking for, then refused to go away.
		 *
		 * The keyboard is the signal, so wait for the keyboard. `visualViewport`
		 * shrinks when it opens; that fires, the layout is given a moment to
		 * settle, and the snapshot is taken with no timer and nothing on screen.
		 */
		this.addCommand({
			id: "snapshot-on-keyboard",
			name: "Snapshot the next time the keyboard opens",
			callback: () => {
				const vv = window.visualViewport;
				if (!vv) {
					new Notice("This device cannot report keyboard size; use the plain snapshot.", 6000);
					return;
				}
				// Short and self-dismissing: it is confirmation, not an instruction
				// that has to stay on screen while you work.
				new Notice("Armed. Open the keyboard.", 2500);

				let done = false;
				const onResize = (): void => {
					const covered = window.innerHeight - vv.height - vv.offsetTop;
					// 120px is comfortably more than a URL bar and comfortably less
					// than any software keyboard.
					if (done || covered < 120) return;
					done = true;
					vv.removeEventListener("resize", onResize);
					// Let the reflow the keyboard triggers finish before measuring,
					// or the capture records the layout mid-transition.
					window.setTimeout(() => {
						void uiSnapshot().then((text) =>
							navigator.clipboard
								.writeText(text)
								.then(() => new Notice(`Snapshot copied — ${text.length.toLocaleString()} characters.`, 4000))
								.catch(() => void this.writeSnapshotFile(text))
						);
					}, 500);
				};
				vv.addEventListener("resize", onResize);
				// Disarm after a minute rather than listening forever.
				const giveUp = window.setTimeout(() => vv.removeEventListener("resize", onResize), 60000);
				this.register(() => {
					window.clearTimeout(giveUp);
					vv.removeEventListener("resize", onResize);
				});
			},
		});

		this.addCommand({
			id: "copy-layout-diagnostics",
			name: "Copy layout diagnostics",
			checkCallback: (checking) => {
				const view = this.app.workspace.getLeavesOfType(REEL_VIEW)[0]?.view;
				if (!(view instanceof ReelView)) return false;
				if (!checking) {
					const text = view.diagnostics();
					void navigator.clipboard
						.writeText(text)
						.then(() => new Notice("Layout diagnostics copied."))
						// A clipboard that refuses is not a reason to lose the
						// answer — show it instead, so it can still be read.
						.catch(() => new Notice(text, 15000));
				}
				return true;
			},
		});

		this.addCommand({ id: "add-watchlist", name: "Add to watchlist", callback: () => this.openSearch({ watchlist: true }) });

		this.addCommand({
			id: "log-current",
			name: "Log the current note",
			checkCallback: (checking) =>
				this.withEntry(checking, (entry, file) => new LogSheet(this.app, this, { file, entry }).open()),
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
							.then(() => this.undo.offer(`S${next.season}E${next.episode} watched`))
							.catch((e) => new Notice(`Reel: ${redact(e)}`));
					}
				}
				return true;
			},
		});

		this.addCommand({
			id: "open-season",
			name: "Rate episodes / open season checklist",
			checkCallback: (checking) =>
				this.withEntry(
					checking,
					(entry) => {
						const season = this.upNext.nextFor(entry)?.season ?? entry.seasons[0]?.n ?? 1;
						new SeasonSheet(this.app, this, entry, season).open();
					},
					true
				),
		});

		this.addCommand({
			id: "restart-series",
			name: "Start a rewatch of this series",
			checkCallback: (checking) =>
				this.withEntry(
					checking,
					(entry, file) => {
						void this.notes
							.restartSeries(file, entry.rating)
							.then(() => this.undo.offer("Progress reset — previous run recorded"))
							.catch((e) => new Notice(`Reel: ${redact(e)}`));
					},
					true
				),
		});

		this.addCommand({
			id: "add-review",
			name: "Add a review to the current note",
			checkCallback: (checking) =>
				this.withEntry(checking, (entry, file) => new LogSheet(this.app, this, { file, entry }).open()),
		});

		this.addCommand({
			id: "manage-lists",
			name: "Add to a list",
			checkCallback: (checking) =>
				this.withEntry(checking, (entry, file) => new ListPicker(this.app, this, entry, file).open()),
		});

		this.addCommand({
			id: "toggle-liked",
			name: "Toggle liked",
			checkCallback: (checking) =>
				this.withEntry(checking, (_entry, file) => {
					void this.notes.toggleLiked(file).then((on) => this.undo.offer(on ? "Liked" : "Unliked"));
				}),
		});

		this.addCommand({
			id: "refresh-metadata",
			name: "Refresh metadata from TMDB",
			checkCallback: (checking) =>
				this.withEntry(checking, (entry) => {
					const run = () =>
						void this.notes
							.refreshMetadata(entry)
							.then(() => new Notice("Reel: metadata refreshed."))
							.catch((e) =>
								reportFailure(e, {
									context: `Couldn't refresh ${entry.title}`,
									retry: run,
								})
							);
					run();
				}),
		});

		this.addCommand({
			id: "backfill-posters",
			name: "Download missing posters",
			callback: async () => {
				try {
					const n = await this.posters.backfill();
					// -1 means this invocation asked a running backfill to stop,
					// so reporting "cached -1 posters" would be nonsense.
					if (n < 0) {
						new Notice("Reel: stopping after the current poster.");
						return;
					}
					new Notice(`Reel: cached ${n} poster${n === 1 ? "" : "s"}.`);
				} catch (e) {
					new Notice(`Reel: ${redact(e)}`);
				}
			},
		});

		this.addCommand({
			id: "backfill-headshots",
			name: "Download missing headshots",
			callback: async () => {
				try {
					const n = await this.people.backfill();
					if (n < 0) {
						new Notice("Reel: stopping after the current headshot.");
						return;
					}
					new Notice(
						n
							? `Reel: cached ${n} headshot${n === 1 ? "" : "s"}.`
							: "Reel: nothing to fetch — add or refresh a title first, since only notes written since 0.7.45 carry the cast ids a photo is found by."
					);
				} catch (e) {
					new Notice(`Reel: ${redact(e)}`);
				}
			},
		});

		this.addCommand({
			id: "prune-posters",
			name: "Remove posters for deleted titles",
			callback: async () => {
				try {
					await this.prunePosters();
				} catch (e) {
					new Notice(`Reel: ${redact(e)}`);
				}
			},
		});

		this.addCommand({
			id: "import-legacy",
			name: "Import notes from another tracker",
			callback: async () => {
				try {
					// Rewriting frontmatter across the vault on a single command,
					// with the rating scale decided silently, was too much to do
					// without asking.
					const plan = this.importer.preview();
					if (!plan.scanned) {
						new Notice("Reel: found no notes to convert.");
						return;
					}
					const ok = await confirm(this.app, {
						title: "Import notes from another tracker",
						body:
							`${plan.scanned} note${plan.scanned === 1 ? "" : "s"} will be converted in place. ` +
							(plan.scaleHalved
								? "Ratings look like they are out of 10, so they will be halved."
								: "Ratings look like they are already out of 5, so they will be kept as they are.") +
							" Only frontmatter is rewritten — your prose is untouched.",
						confirmText: `Convert ${plan.scanned}`,
					});
					if (!ok) return;

					// Reuse the scan the preview already did.
					const report = await this.importer.run(plan);
					const scale = report.scaleHalved
						? " Ratings were treated as out of 10 and halved."
						: " Ratings were treated as already out of 5.";
					new Notice(
						`Reel: converted ${report.converted} of ${report.scanned} notes.${scale}` +
							(report.skipped ? ` ${report.skipped} skipped.` : ""),
						12000
					);
					if (report.errors.length) console.warn("Reel: import issues —", report.errors);
				} catch (e) {
					new Notice(`Reel: ${redact(e)}`);
				}
			},
		});

		this.addCommand({
			id: "enrich-current",
			name: "Fetch ratings and content notes for this title",
			checkCallback: (checking) =>
				this.withEntry(checking, (entry, file) => {
					const run = () =>
						void this.notes
							.enrich(file, { title: entry.title, year: entry.year ?? entry.firstAirYear, imdbId: entry.imdbId })
							.then(() => new Notice("Reel: enrichment done."))
							.catch((e) => reportFailure(e, { context: "Enrichment failed", retry: run }));
					run();
				}),
		});

		this.addCommand({
			id: "enrich-all",
			name: "Fetch ratings and content notes for the whole library",
			callback: async () => {
				const rows = this.library.all().filter((e) => e.imdbRating == null || !e.contentTopics.length);
				if (!rows.length) {
					new Notice("Reel: everything is already enriched.");
					return;
				}
				// Same shape as the poster backfill: minutes of work behind a
				// frozen notice. It gets the same treatment — a running count
				// and a second invocation that calls it off.
				if (this.enriching) {
					this.cancelEnrich = true;
					new Notice("Reel: stopping after the current title.");
					return;
				}
				this.enriching = true;
				this.cancelEnrich = false;

				const notice = new Notice("", 0);
				let done = 0;
				try {
					for (const [i, entry] of rows.entries()) {
						if (this.cancelEnrich) break;
						notice.setMessage(
							`Reel: enriching ${i + 1} of ${rows.length}… (run the command again to stop)`
						);
						const file = this.app.vault.getAbstractFileByPath(entry.path);
						if (!(file instanceof TFile)) continue;
						try {
							await this.notes.enrich(file, {
								title: entry.title,
								year: entry.year ?? entry.firstAirYear,
								imdbId: entry.imdbId,
							});
							done++;
						} catch (e) {
							console.warn("Reel: enrich skipped", entry.title, redact(e));
						}
						// Both services are free tiers; pace accordingly.
						await new Promise((r) => window.setTimeout(r, 350));
					}
				} finally {
					this.enriching = false;
					this.cancelEnrich = false;
					notice.hide();
				}
				new Notice(`Reel: enriched ${done} of ${rows.length}.`);
			},
		});

		this.addCommand({
			id: "create-bases",
			name: "Create starter Bases views",
			callback: async () => {
				const folder = `${this.settings.filmFolder}/Bases`;
				try {
					await this.notes.ensureFolder(folder);
					let written = 0;
					for (const base of STARTER_BASES) {
						const path = `${folder}/${base.name}`;
						// Never overwrite — these are meant to be edited, and
						// clobbering a view you tuned would be worse than
						// skipping one that already exists.
						if (this.app.vault.getAbstractFileByPath(path)) continue;
						await this.app.vault.create(path, base.content);
						written++;
					}
					new Notice(
						written
							? `Reel: created ${written} Bases view${written === 1 ? "" : "s"} in ${folder}.`
							: "Reel: those Bases views already exist — nothing overwritten."
					);
				} catch (e) {
					new Notice(`Reel: ${redact(e)}`);
				}
			},
		});

		this.addCommand({
			id: "lock-key",
			name: "Lock the API keys",
			checkCallback: (checking) => {
				if (!this.credentials.isUnlocked) return false;
				if (!checking) {
					this.credentials.lock();
					new Notice("Reel: keys locked.");
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

	/* ------------------------------------------------------------------ */

	private async checkNewEpisodes(): Promise<void> {
		// Stored in plugin data, not localStorage. localStorage is app-wide, so
		// three vaults would share one "already checked today" flag and only
		// the first to open would ever refresh — a real bug, not just a
		// review-guideline preference.
		if (this.settings.lastEpisodeCheck === todayISO()) return;

		const returning = this.library.shows().filter((s) => s.showStatus === "Returning Series" && s.status !== "dropped");
		if (!returning.length) {
			await this.markEpisodeCheckDone();
			return;
		}

		// Silent by design: no key, no check, no nag.
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
		await this.markEpisodeCheckDone();
	}

	private async markEpisodeCheckDone(): Promise<void> {
		this.settings.lastEpisodeCheck = todayISO();
		await this.saveSettings();
	}

	/* ------------------------------------------------------------------ */

	/**
	 * True once settings have been read *successfully*. Nothing may be written
	 * before that, because writing what we failed to read destroys it.
	 */
	private settingsLoaded = false;
	/**
	 * The stored object exactly as it was on disk.
	 *
	 * Kept so a save re-emits fields this version does not know about. Rolling
	 * back to an older Reel should not silently strip whatever a newer one
	 * added — an unknown key is somebody's data, not litter.
	 */
	private storedRaw: Record<string, unknown> = {};

	/**
	 * Last resort for the snapshot: write it into the vault.
	 *
	 * Obsidian mobile does not always grant clipboard access, and a diagnostic
	 * that cannot leave the phone is no diagnostic at all.
	 */
	private async writeSnapshotFile(text: string): Promise<void> {
		const path = "Reel UI snapshot.md";
		try {
			const existing = this.app.vault.getAbstractFileByPath(path);
			const body = `\`\`\`\n${text}\n\`\`\`\n`;
			if (existing instanceof TFile) await this.app.vault.modify(existing, body);
			else await this.app.vault.create(path, body);
			new Notice(`Clipboard unavailable — snapshot written to "${path}".`, 8000);
		} catch (e) {
			new Notice(`Reel: could not save the snapshot — ${redact(e)}`, 8000);
		}
	}

	/** Where Obsidian keeps this plugin's `data.json`. */
	private dataPath(): string {
		return `${this.app.vault.configDir}/plugins/${this.manifest.id}/data.json`;
	}

	/**
	 * Read settings, and refuse to guess when the read fails.
	 *
	 * `loadData()` returns null for two unrelated reasons: there is no file
	 * yet, and the file could not be read or parsed. The old code treated both
	 * as "fresh install" and fell back to defaults — where `keyBlob` is null.
	 * Since `saveSettings()` runs on ordinary actions (switching tabs writes
	 * `lastTab`), the first tap after a bad read wrote null over the encrypted
	 * keys. That is almost certainly the update that "forgot my APIs", and it
	 * was unrecoverable.
	 *
	 * The file's *existence* is what separates the two cases, and the adapter
	 * can answer that even when parsing cannot.
	 */
	async loadSettings(): Promise<void> {
		let stored: Partial<ReelSettings> | null = null;
		let read = false;
		try {
			stored = (await this.loadData()) as Partial<ReelSettings> | null;
			read = true;
		} catch (e) {
			console.error("Reel: settings could not be read", e);
		}

		if (!canPersist({ read, stored, fileExists: await this.dataFileExists() })) {
			// A file is there and we could not make sense of it. Run on
			// defaults so the plugin still works, but never persist them.
			this.settingsLoaded = false;
			this.settings = Object.assign({}, DEFAULT_SETTINGS);
			console.error("Reel: settings file exists but could not be parsed — saving is disabled to protect it.");
			new Notice(
				"Reel: your settings file could not be read, so saving is switched off to avoid overwriting it. " +
					"Your API keys are still in data.json. Reload Obsidian; if this repeats, that file needs a look.",
				0
			);
			return;
		}

		this.storedRaw = (stored ?? {}) as Record<string, unknown>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
		this.settingsLoaded = true;
	}

	private async dataFileExists(): Promise<boolean> {
		try {
			return await this.app.vault.adapter.exists(this.dataPath());
		} catch {
			// If we cannot even ask, assume it is there. Declining to save is
			// recoverable; overwriting an encrypted key blob is not.
			return true;
		}
	}

	/**
	 * Persist settings.
	 *
	 * `clearingKeys` is how a caller says it means to remove the stored
	 * credentials — switching to session-only storage, or "forget my keys".
	 * Without it, a save that would blank a credential that previously had a
	 * value is treated as a bug and the old value is kept.
	 *
	 * The asymmetry is deliberate. Every other field here is a preference worth
	 * seconds; `keyBlob` is an encrypted secret typed once, with no recovery.
	 * Refusing a legitimate clear costs one more tap. Writing an accidental one
	 * costs the key.
	 */
	async saveSettings(opts: { clearingKeys?: boolean } = {}): Promise<void> {
		if (!this.settingsLoaded) {
			console.warn("Reel: refusing to save settings — they were never read successfully.");
			return;
		}

		const merged = mergeForSave(
			this.settings as unknown as Record<string, unknown>,
			this.storedRaw,
			opts.clearingKeys
		);
		if (!opts.clearingKeys && merged.keyBlob !== this.settings.keyBlob) {
			console.warn("Reel: a save would have cleared the encrypted keys; kept the stored value.");
		}
		await this.saveData(merged);
		this.storedRaw = merged;
		// Keep the in-memory copy consistent with what is now on disk.
		this.settings.keyBlob = merged.keyBlob as ReelSettings["keyBlob"];
		this.settings.keysPlain = merged.keysPlain as ReelSettings["keysPlain"];
	}
}
