import { App, Notice, PluginSettingTab, Setting, debounce } from "obsidian";
import { confirm } from "./ui/confirm";
import type ReelPlugin from "./main";
import { KeyMode, SecretBlob } from "./secrets";
import { CONTENT_FLAGS, ContentFlag, ContentPolicy, FLAG_LABELS, knownCertifications } from "./content";
import { KEY_LABELS, KeyBundle, KeyName } from "./credentials";

/** What you think of a person, used to weight what gets recommended. */
import type { Recipe } from "./util/recipe";

export interface PersonOpinion {
	name: string;
	liked?: boolean;
	rating?: number;
	/** "Acting" or "Directing" — decides which TMDB credit field to search. */
	department?: string;
}

export interface ReelSettings {
	/* Credentials — see credentials.ts. Only one of keyPlain / keyBlob is ever set. */
	keyMode: KeyMode;
	keysPlain: KeyBundle | null;
	keyBlob: SecretBlob | null;
	/** Which services are configured. Names aren't secret; values are. */
	keyNames: KeyName[];
	/** Fetch OMDb scores and DoesTheDogDie topics after creating a note. */
	enrich: boolean;

	/* Vault layout */
	filmFolder: string;
	seriesFolder: string;
	posterFolder: string;
	peopleFolder: string;

	/* Metadata */
	linkPeople: boolean;
	castLimit: number;
	region: string;
	includeSpecials: boolean;

	/* Reviews and daily notes */
	askForReview: boolean;
	linkFromDailyNote: boolean;
	dailyNotePrefix: string;
	/** Folder holding daily notes. Empty means the vault root. */
	dailyNoteFolder: string;
	/** Last day the returning-series refresh ran, per vault. */
	lastEpisodeCheck: string;
	/** TMDB ids dismissed in Discover. "Not interested" has to stick. */
	dismissedIds: number[];
	/**
	 * People you have liked or rated, keyed by TMDB person id.
	 *
	 * Kept in settings rather than as notes: a person is not something you
	 * watch, so giving them a note would put non-titles in your film folders
	 * and into every query that reads them. This is a preference about how
	 * recommendations should lean, which is exactly what settings are for.
	 */
	people: Record<string, PersonOpinion>;
	/** The Reel view reopens where you left it. */
	lastTab: string;
	/**
	 * How the library is laid out, and by what.
	 *
	 * Persisted because they are statements about how you like to look at your
	 * own collection, not about the session. Choosing the dense grid and finding
	 * two big posters again next time you open Reel would read as the setting
	 * having failed rather than as it having been temporary.
	 */
	libraryLayout: "grid" | "dense" | "list";
	librarySort: string;
	/** Newest-first, capped. Offered under an empty search box. */
	recentSearches: string[];
	/** Named discovery recipes, newest first. A mood you built once. */
	recipes: Recipe[];

	/* Content policy — see content.ts for what the data can and can't do */
	hideFlags: string[];
	maxCertification: string | null;
	hideUnrated: boolean;

	/* Behaviour */
	posterQuality: "w185" | "w342" | "w500";
	downloadPosters: boolean;
	cacheResponses: boolean;
	cacheTtlDays: number;
	openNoteAfterCreate: boolean;
	checkNewEpisodes: boolean;
	language: string;
	/** Written into every new note's body so the file isn't empty. */
	noteTemplate: string;
}

export const DEFAULT_SETTINGS: ReelSettings = {
	keyMode: "encrypted",
	keysPlain: null,
	keyBlob: null,
	keyNames: [],
	enrich: true,

	filmFolder: "Movies",
	seriesFolder: "Series",
	posterFolder: "Movies/_posters",
	peopleFolder: "Movies/People",

	linkPeople: true,
	castLimit: 10,
	region: "US",
	includeSpecials: false,

	askForReview: true,
	linkFromDailyNote: false,
	dailyNotePrefix: "- Watched",
	dailyNoteFolder: "",
	lastEpisodeCheck: "",
	dismissedIds: [],
	people: {},
	lastTab: "library",
	libraryLayout: "grid",
	librarySort: "watched",
	recentSearches: [],
	recipes: [],

	hideFlags: [],
	maxCertification: null,
	hideUnrated: false,

	posterQuality: "w342",
	downloadPosters: true,
	cacheResponses: true,
	cacheTtlDays: 30,
	openNoteAfterCreate: true,
	checkNewEpisodes: true,
	language: "en-US",
	noteTemplate: "\n## Notes\n\n",
};

const MODE_LABELS: Record<KeyMode, string> = {
	encrypted: "Encrypted in vault (recommended)",
	session: "Session only — never written to disk",
	plain: "Plain text in vault (not recommended)",
};

export class ReelSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ReelPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("reel-settings");

		this.renderCredentials(containerEl);
		this.renderFolders(containerEl);
		this.renderMetadata(containerEl);
		this.renderReviews(containerEl);
		this.renderContent(containerEl);
		this.renderBehaviour(containerEl);
	}

	/** The live content policy, read by every surface that lists titles. */
	get policy(): ContentPolicy {
		return {
			hideFlags: this.plugin.settings.hideFlags as ContentFlag[],
			maxCertification: this.plugin.settings.maxCertification,
			hideUnrated: this.plugin.settings.hideUnrated,
		};
	}

	/* ---------------------------------------------------------------- */

	private renderCredentials(el: HTMLElement): void {
		new Setting(el).setName("API keys").setHeading();

		const store = this.plugin.credentials;

		const status = el.createDiv({ cls: "reel-key-status" });
		const describe = () => {
			status.empty();
			const s = this.plugin.settings;
			if (s.keyMode === "session") {
				status.createSpan({
					cls: store.isUnlocked ? "reel-pill ok" : "reel-pill",
					text: store.isUnlocked ? "Keys held for this session" : "No keys this session",
				});
			} else if (s.keyBlob) {
				status.createSpan({
					cls: store.isUnlocked ? "reel-pill ok" : "reel-pill",
					text: store.isUnlocked ? "Unlocked" : "Encrypted — locked",
				});
			} else if (s.keysPlain && Object.keys(s.keysPlain).length) {
				const names = Object.keys(s.keysPlain).map((n) => KEY_LABELS[n as KeyName] ?? n);
				status.createSpan({ cls: "reel-pill warn", text: `Plain text · ${names.join(", ")}` });
			} else {
				status.createSpan({ cls: "reel-pill warn", text: "No keys set" });
			}
			// Which services are configured, regardless of lock state.
			for (const name of ["tmdb", "omdb", "dtdd"] as KeyName[]) {
				if (store.has(name)) status.createSpan({ cls: "reel-pill ok", text: KEY_LABELS[name] });
			}
		};
		describe();

		new Setting(el)
			.setName("Key storage")
			.setDesc(
				"All three keys share one encrypted blob and one passphrase — three unlock prompts for one library " +
					"screen would be intolerable, and splitting them buys nothing, since whatever can read one can read the rest."
			)
			.addDropdown((d) => {
				(Object.keys(MODE_LABELS) as KeyMode[]).forEach((m) => d.addOption(m, MODE_LABELS[m]));
				d.setValue(this.plugin.settings.keyMode).onChange(async (value) => {
					await this.plugin.credentials.migrateTo(value as KeyMode);
					this.display();
				});
			});

		const keyField = (name: KeyName, label: string, desc: string) => {
			let input: HTMLInputElement | null = null;
			const setting = new Setting(el)
				.setName(label)
				.setDesc(desc)
				.addText((t) => {
					t.setPlaceholder(store.has(name) ? "Saved — paste to replace" : "Paste key, then Save");
					t.inputEl.type = "password";
					t.inputEl.autocomplete = "off";
					t.inputEl.spellcheck = false;
					t.inputEl.addClass("reel-input");
					input = t.inputEl;
				})
				.addButton((b) =>
					b
						.setButtonText("Save")
						.setCta()
						.onClick(async () => {
							const value = input?.value ?? "";
							if (!value.trim()) {
								new Notice("Reel: nothing to save.");
								return;
							}
							const ok = await this.plugin.credentials.store(name, value);
							if (input) input.value = "";
							new Notice(ok ? `Reel: ${KEY_LABELS[name]} key saved.` : "Reel: key not saved.");
							this.display();
						})
				);
			if (store.has(name)) {
				setting.addButton((b) =>
					b.setButtonText("Remove").onClick(async () => {
						const ok = await confirm(this.app, {
							title: `Remove the ${KEY_LABELS[name]} key`,
							body: "Reel cannot recover it. You would need the original key again to re-add it.",
							confirmText: "Remove",
							danger: true,
						});
						if (!ok) return;
						await this.plugin.credentials.remove(name);
						new Notice(`Reel: ${KEY_LABELS[name]} key removed.`);
						this.display();
					})
				);
			}
		};

		keyField(
			"tmdb",
			"TMDB key or read access token",
			"Required. A v4 read access token (starts with eyJ) is preferred — it travels in an Authorization header rather than the URL, so it can't end up in a log."
		);
		keyField(
			"omdb",
			"OMDb key",
			"Optional. Adds IMDb rating, Rotten Tomatoes and Metacritic. Free tier is 1,000 requests a day, which the response cache makes ample. omdbapi.com/apikey.aspx"
		);
		keyField(
			"dtdd",
			"DoesTheDogDie key",
			"Optional, and the best available answer to content filtering — community votes per topic, so you can tell one scene from constant. Request a free key at doesthedogdie.com/api."
		);

		new Setting(el)
			.setName("Enrich new notes automatically")
			.setDesc("Fetch OMDb scores and DoesTheDogDie topics after adding a title. Runs after the note is written, so a slow service never delays it.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.enrich).onChange(async (v) => {
					this.plugin.settings.enrich = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(el)
			.setName("Test connections")
			.setDesc("One small request per configured service, so a mistyped key fails here rather than silently.")
			.addButton((b) =>
				b.setButtonText("Test").onClick(async () => {
					b.setDisabled(true).setButtonText("Testing…");
					const lines: string[] = [];

					const tmdb = await this.plugin.tmdb.testCredentials();
					lines.push(tmdb.ok ? "TMDB works" : `TMDB: ${tmdb.error}`);

					if (store.has("omdb")) {
						const omdb = await this.plugin.omdb.test();
						lines.push(omdb.ok ? "OMDb works" : `OMDb: ${omdb.error}`);
					}
					if (store.has("dtdd")) {
						const dtdd = await this.plugin.dtdd.test();
						lines.push(dtdd.ok ? "DoesTheDogDie works" : `DoesTheDogDie: ${dtdd.error}`);
					}

					b.setDisabled(false).setButtonText("Test");
					new Notice(`Reel: ${lines.join(" · ")}`, 8000);
					describe();
				})
			);

		if (this.plugin.settings.keyMode === "encrypted" && store.isUnlocked) {
			new Setting(el)
				.setName("Lock now")
				.setDesc("Forget the decrypted keys until the next unlock.")
				.addButton((b) =>
					b.setButtonText("Lock").onClick(() => {
						store.lock();
						new Notice("Reel: keys locked.");
						this.display();
					})
				);
		}

		if (store.hasStoredKey) {
			new Setting(el)
				.setName("Remove all keys")
				.addButton((b) => {
					// Not setDestructive(): that is @since 1.13.0, and raising
					// minAppVersion from 1.7.2 would lock out five minor
					// versions of users to colour one button. The plugin's own
					// danger class is already themed the same way.
					b.buttonEl.addClass("reel-btn-danger");
					return b.setButtonText("Remove all").onClick(async () => {
						// Marked destructive since it was written, and yet it
						// fired on one tap.
						const ok = await confirm(this.app, {
							title: "Remove every stored key",
							body: "All saved keys are deleted and cannot be recovered. You would need each original key again.",
							confirmText: "Remove all",
							danger: true,
						});
						if (!ok) return;
						await store.clear();
						new Notice("Reel: keys removed.");
						this.display();
					});
				});
		}

		if (this.plugin.settings.keyMode === "plain") {
			el.createDiv({
				cls: "reel-callout warn",
				text:
					`Plain text mode writes your keys readably into ${this.app.vault.configDir}/plugins/reel/data.json. ` +
					"If this vault is synced to git or a shared drive, treat them as public.",
			});
		}
	}

	private pendingKeyInput: HTMLInputElement | null = null;

	/* ---------------------------------------------------------------- */

	private renderFolders(el: HTMLElement): void {
		new Setting(el).setName("Folders").setHeading();

		// A count is the quickest way to tell "the folder setting is wrong"
		// from "I haven't added anything yet" — both otherwise look identical.
		const films = this.plugin.library.films().length;
		const shows = this.plugin.library.shows().length;
		el.createDiv({
			cls: "reel-key-status",
			text:
				films + shows === 0
					? "No titles indexed yet."
					: `Indexing ${films} film${films === 1 ? "" : "s"} and ${shows} series.`,
		});

		type FolderKey = "filmFolder" | "seriesFolder" | "posterFolder" | "peopleFolder";
		const folder = (name: string, desc: string, key: FolderKey) =>
			new Setting(el)
				.setName(name)
				.setDesc(desc)
				.addText((t) => {
					// Typing "Movies" fired six saves and six full vault scans,
					// each briefly pointing the library at a folder named "M",
					// then "Mo". Settle first, then rebuild once.
					const apply = debounce(
						async (v: string) => {
							this.plugin.settings[key] = v.replace(/^\/+|\/+$/g, "") || DEFAULT_SETTINGS[key];
							await this.plugin.saveSettings();
							this.plugin.library.rebuild();
						},
						600,
						true
					);
					t.setValue(this.plugin.settings[key]).onChange((v) => apply(v));
				});

		folder("Films folder", "One note per film.", "filmFolder");
		folder("Series folder", "One note per show — not per season or episode.", "seriesFolder");
		folder("Poster folder", "Shared by films and series.", "posterFolder");
		folder(
			"People folder",
			"Where director and cast links point. Naming the folder explicitly is what stops person notes appearing in your vault root when you tap an unresolved link.",
			"peopleFolder"
		);

		el.createDiv({
			cls: "reel-callout",
			text:
				"Everything Reel writes lives under these four folders and its own plugin folder. " +
				"It never creates notes anywhere else — the daily-note link, if you turn it on, only appends to a note you already have.",
		});
	}

	private renderMetadata(el: HTMLElement): void {
		new Setting(el).setName("Metadata").setHeading();

		new Setting(el)
			.setName("Link people and use wikilinks")
			.setDesc(
				"Store directors and cast as [[People/Name|Name]] rather than plain text, so they appear in the graph and get backlinks. This is the thing Letterboxd cannot do."
			)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.linkPeople).onChange(async (v) => {
					this.plugin.settings.linkPeople = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(el)
			.setName("Cast members to keep")
			.setDesc("Top-billed order, as TMDB returns it.")
			.addSlider((s) =>
				s
					.setLimits(0, 25, 1)
					.setValue(this.plugin.settings.castLimit)
					.onChange(async (v) => {
						this.plugin.settings.castLimit = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(el)
			.setName("Region")
			.setDesc("Drives which certification and streaming providers are stored. Two-letter country code.")
			.addText((t) => {
				// Typing "GB" stored "G" on the first keypress — an invalid
				// country code that drives certification and provider lookups
				// until the second letter lands. Wait for a complete code.
				const apply = debounce(
					async (v: string) => {
						const code = v.trim().toUpperCase().slice(0, 2);
						this.plugin.settings.region = /^[A-Z]{2}$/.test(code) ? code : "US";
						await this.plugin.saveSettings();
					},
					600,
					true
				);
				t.setValue(this.plugin.settings.region).onChange((v) => apply(v));
			});

		new Setting(el)
			.setName("Track specials")
			.setDesc("Include season 0 — Christmas episodes, OVAs, and the like.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.includeSpecials).onChange(async (v) => {
					this.plugin.settings.includeSpecials = v;
					await this.plugin.saveSettings();
				})
			);
	}

	private renderReviews(el: HTMLElement): void {
		new Setting(el).setName("Reviews").setHeading();

		new Setting(el)
			.setName("Ask for a review when logging")
			.setDesc("Adds a review box to the log sheet. Reviews are appended to the note body under a dated heading — never overwriting what's already there.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.askForReview).onChange(async (v) => {
					this.plugin.settings.askForReview = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(el)
			.setName("Link from today's daily note")
			.setDesc("Appends a link when you log something. Only if today's daily note already exists — Reel will not create one.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.linkFromDailyNote).onChange(async (v) => {
					this.plugin.settings.linkFromDailyNote = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(el)
			.setName("Daily note folder")
			.setDesc(
				"Where your daily notes live — leave empty for the vault root. Files must be named YYYY-MM-DD.md. " +
					"Reel asks rather than reading the Daily Notes plugin's configuration, which is undocumented API."
			)
			.addText((t) => {
				// Cheaper than the folder inputs — no rescan — but it still
				// rewrote data.json, which holds your encrypted keys, once per
				// keypress.
				const apply = debounce(
					async (v: string) => {
						this.plugin.settings.dailyNoteFolder = v.replace(/^\/+|\/+$/g, "");
						await this.plugin.saveSettings();
					},
					600,
					true
				);
				t.setPlaceholder("e.g. Journal/Daily")
					.setValue(this.plugin.settings.dailyNoteFolder)
					.onChange((v) => apply(v));
			});

		new Setting(el)
			.setName("Daily note line prefix")
			.addText((t) => {
				const apply = debounce(
					async (v: string) => {
						this.plugin.settings.dailyNotePrefix = v || "- Watched";
						await this.plugin.saveSettings();
					},
					600,
					true
				);
				t.setValue(this.plugin.settings.dailyNotePrefix).onChange((v) => apply(v));
			});
	}

	private renderContent(el: HTMLElement): void {
		new Setting(el).setName("Content filtering").setHeading();

		el.createDiv({
			cls: "reel-callout",
			text:
				"Read this before relying on it. TMDB has no structured content-advisory data. Certification (R, PG-13, TV-MA) comes from a ratings board and is dependable. " +
				"Flags are inferred from crowd-sourced keywords, so they under-report: no flag means nothing was tagged, not that nothing is there. " +
				"You can add or remove flags on any note by hand, and a refresh will not undo your edits.",
		});

		new Setting(el)
			.setName("Hide titles flagged with")
			.setDesc("Applies across the library, Up Next and search.")
			.setClass("reel-flag-setting");

		const flagRow = el.createDiv({ cls: "reel-flag-row" });
		for (const flag of CONTENT_FLAGS) {
			const chip = flagRow.createEl("button", { cls: "reel-chip", text: FLAG_LABELS[flag] });
			const paint = () => chip.toggleClass("is-active", this.plugin.settings.hideFlags.includes(flag));
			chip.addEventListener("click", async () => {
				const set = new Set(this.plugin.settings.hideFlags);
				if (set.has(flag)) set.delete(flag);
				else set.add(flag);
				this.plugin.settings.hideFlags = [...set];
				await this.plugin.saveSettings();
				paint();
				this.plugin.library.refresh();
			});
			paint();
		}

		new Setting(el)
			.setName("Maximum certification")
			.setDesc("Hide anything rated above this.")
			.addDropdown((d) => {
				d.addOption("", "No limit");
				for (const cert of knownCertifications()) d.addOption(cert, cert);
				d.setValue(this.plugin.settings.maxCertification ?? "").onChange(async (v) => {
					this.plugin.settings.maxCertification = v || null;
					await this.plugin.saveSettings();
					this.plugin.library.refresh();
				});
			});

		new Setting(el)
			.setName("Also hide unrated titles")
			.setDesc("Strict mode. An unrated title is unknown, not safe — turn this on if that distinction matters to you.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.hideUnrated).onChange(async (v) => {
					this.plugin.settings.hideUnrated = v;
					await this.plugin.saveSettings();
					this.plugin.library.refresh();
				})
			);
	}

	private renderBehaviour(el: HTMLElement): void {
		new Setting(el).setName("Behaviour").setHeading();

		new Setting(el)
			.setName("Rating scale")
			.setDesc("Five stars with halves. Fixed — the stored numbers and the star widget assume it.")
			.addText((t) => t.setValue("★ 0.5 – 5.0").setDisabled(true));

		new Setting(el)
			.setName("Download posters")
			.setDesc("Saves a jpg per title into the poster folder, so the library works offline.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.downloadPosters).onChange(async (v) => {
					this.plugin.settings.downloadPosters = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(el)
			.setName("Poster size")
			.setDesc("w342 is about 30 KB per title and is what the grid is tuned for.")
			.addDropdown((d) =>
				d
					.addOptions({ w185: "w185 — smallest", w342: "w342 — recommended", w500: "w500 — sharpest" })
					.setValue(this.plugin.settings.posterQuality)
					.onChange(async (v) => {
						this.plugin.settings.posterQuality = v as ReelSettings["posterQuality"];
						await this.plugin.saveSettings();
					})
			);

		new Setting(el)
			.setName("Cache TMDB responses")
			.setDesc("On-disk, keyed by id. Keeps repeat opens instant and stays within rate limits.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.cacheResponses).onChange(async (v) => {
					this.plugin.settings.cacheResponses = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(el)
			.setName("Cache lifetime")
			.setDesc("Days before a cached response is refetched. Ended shows are kept regardless.")
			.addSlider((s) =>
				s
					.setLimits(1, 90, 1)
					.setValue(this.plugin.settings.cacheTtlDays)
					.onChange(async (v) => {
						this.plugin.settings.cacheTtlDays = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(el)
			.setName("Check for new episodes")
			.setDesc("Once a day, refreshes shows TMDB still marks as returning, to badge them in Up Next.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.checkNewEpisodes).onChange(async (v) => {
					this.plugin.settings.checkNewEpisodes = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(el)
			.setName("Open the note after adding")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.openNoteAfterCreate).onChange(async (v) => {
					this.plugin.settings.openNoteAfterCreate = v;
					await this.plugin.saveSettings();
				})
			);

		// Everything above this line is a preference: set it, and it changes
		// what Reel does from now on. Everything below is an *action* that
		// runs immediately, and two of the three move files to the trash.
		// They were interleaved with the toggles, so the control that deletes
		// cached posters sat directly beneath the one choosing a poster size
		// — same visual weight, entirely different consequence.
		new Setting(el).setName("Maintenance").setHeading();
		el.createDiv({
			cls: "reel-setting-note",
			text: "These run straight away rather than changing a preference. The ones that remove files move them to the trash, and ask first.",
		});

		new Setting(el)
			.setName("Dismissed suggestions")
			.setDesc("Titles you marked 'not interested' in Discover. Clearing brings them back.")
			.addButton((b) =>
				b
					.setButtonText(`Clear ${this.plugin.settings.dismissedIds.length}`)
					.setDisabled(this.plugin.settings.dismissedIds.length === 0)
					.onClick(async () => {
						this.plugin.settings.dismissedIds = [];
						await this.plugin.saveSettings();
						new Notice("Reel: dismissed suggestions cleared.");
						this.display();
					})
			);

		// The command palette is a poor fit on a phone, and these are exactly
		// the actions you reach for after deleting a few titles.
		const posterCount = this.plugin.library.all().filter((e) => !!e.poster).length;
		new Setting(el)
			.setName("Posters")
			.setDesc(`${posterCount} title${posterCount === 1 ? "" : "s"} have a cached poster.`)
			.addButton((b) =>
				b.setButtonText("Download missing").onClick(async () => {
					const n = await this.plugin.posters.backfill();
					if (n < 0) {
						new Notice("Reel: stopping after the current poster.");
						return;
					}
					new Notice(`Reel: cached ${n} poster${n === 1 ? "" : "s"}.`);
					this.display();
				})
			)
			.addButton((b) =>
				b.setButtonText("Remove unused").onClick(async () => {
					await this.plugin.prunePosters();
					this.display();
				})
			);

		new Setting(el)
			.setName("Clear cached responses")
			.setDesc("Metadata Reel has already fetched. Clearing costs requests, not data — everything refetches on demand.")
			.addButton((b) =>
				b.setButtonText("Clear").onClick(async () => {
					const n = await this.plugin.tmdb.clearCache();
					new Notice(`Reel: cleared ${n} cached response${n === 1 ? "" : "s"}.`);
				})
			);
	}
}
