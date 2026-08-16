import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ReelPlugin from "./main";
import { KeyMode, SecretBlob, maskSecret } from "./secrets";
import { CONTENT_FLAGS, ContentFlag, ContentPolicy, FLAG_LABELS, knownCertifications } from "./content";

export interface ReelSettings {
	/* Credentials — see credentials.ts. Only one of keyPlain / keyBlob is ever set. */
	keyMode: KeyMode;
	keyPlain: string | null;
	keyBlob: SecretBlob | null;

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
	keyPlain: null,
	keyBlob: null,

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
		new Setting(el).setName("TMDB access").setHeading();

		const store = this.plugin.credentials;

		const status = el.createDiv({ cls: "reel-key-status" });
		const describe = () => {
			status.empty();
			const s = this.plugin.settings;
			if (s.keyMode === "session") {
				status.createSpan({
					cls: store.isUnlocked ? "reel-pill ok" : "reel-pill",
					text: store.isUnlocked ? "Key held for this session" : "No key this session",
				});
			} else if (s.keyBlob) {
				status.createSpan({
					cls: store.isUnlocked ? "reel-pill ok" : "reel-pill",
					text: store.isUnlocked ? "Unlocked" : "Encrypted — locked",
				});
			} else if (s.keyPlain) {
				status.createSpan({ cls: "reel-pill warn", text: `Stored in plain text · ${maskSecret(s.keyPlain)}` });
			} else {
				status.createSpan({ cls: "reel-pill warn", text: "No key set" });
			}
		};
		describe();

		new Setting(el)
			.setName("Key storage")
			.setDesc(
				"Where the TMDB key lives. Encrypted mode writes only salt, IV and ciphertext into the vault — " +
					"safe to sync, useless without your passphrase."
			)
			.addDropdown((d) => {
				(Object.keys(MODE_LABELS) as KeyMode[]).forEach((m) => d.addOption(m, MODE_LABELS[m]));
				d.setValue(this.plugin.settings.keyMode).onChange(async (value) => {
					await this.plugin.credentials.migrateTo(value as KeyMode);
					this.display();
				});
			});

		new Setting(el)
			.setName("TMDB key or read access token")
			.setDesc(
				"A v4 read access token (starts with eyJ) is preferred — it travels in an Authorization header " +
					"rather than the URL, so it can't end up in a log. A v3 API key also works."
			)
			.addText((t) => {
				t.setPlaceholder("Paste key, then Save").inputEl.type = "password";
				t.inputEl.autocomplete = "off";
				t.inputEl.spellcheck = false;
				t.inputEl.addClass("reel-input");
				this.pendingKeyInput = t.inputEl;
			})
			.addButton((b) =>
				b
					.setButtonText("Save")
					.setCta()
					.onClick(async () => {
						const value = this.pendingKeyInput?.value ?? "";
						if (!value.trim()) {
							new Notice("Reel: nothing to save.");
							return;
						}
						const ok = await this.plugin.credentials.store(value);
						if (this.pendingKeyInput) this.pendingKeyInput.value = "";
						new Notice(ok ? "Reel: key saved." : "Reel: key not saved.");
						this.display();
					})
			);

		new Setting(el)
			.setName("Test connection")
			.setDesc("Makes one small request to TMDB to confirm the key works.")
			.addButton((b) =>
				b.setButtonText("Test").onClick(async () => {
					b.setDisabled(true).setButtonText("Testing…");
					const result = await this.plugin.tmdb.testCredentials();
					b.setDisabled(false).setButtonText("Test");
					new Notice(result.ok ? "Reel: TMDB key works." : `Reel: ${result.error}`);
					describe();
				})
			);

		if (this.plugin.settings.keyMode === "encrypted" && this.plugin.credentials.isUnlocked) {
			new Setting(el)
				.setName("Lock now")
				.setDesc("Forget the decrypted key until the next unlock.")
				.addButton((b) =>
					b.setButtonText("Lock").onClick(() => {
						this.plugin.credentials.lock();
						new Notice("Reel: key locked.");
						this.display();
					})
				);
		}

		if (this.plugin.credentials.hasStoredKey) {
			new Setting(el)
				.setName("Remove key")
				.setDesc("Deletes the stored key from this vault.")
				.addButton((b) =>
					b.setWarning().setButtonText("Remove").onClick(async () => {
						await this.plugin.credentials.clear();
						new Notice("Reel: key removed.");
						this.display();
					})
				);
		}

		if (this.plugin.settings.keyMode === "plain") {
			el.createDiv({
				cls: "reel-callout warn",
				text:
					"Plain text mode writes your key readably into .obsidian/plugins/reel/data.json. " +
					"If this vault is synced to git or a shared drive, treat the key as public.",
			});
		}
	}

	private pendingKeyInput: HTMLInputElement | null = null;

	/* ---------------------------------------------------------------- */

	private renderFolders(el: HTMLElement): void {
		new Setting(el).setName("Folders").setHeading();

		type FolderKey = "filmFolder" | "seriesFolder" | "posterFolder" | "peopleFolder";
		const folder = (name: string, desc: string, key: FolderKey) =>
			new Setting(el)
				.setName(name)
				.setDesc(desc)
				.addText((t) =>
					t.setValue(this.plugin.settings[key]).onChange(async (v) => {
						this.plugin.settings[key] = v.replace(/^\/+|\/+$/g, "") || DEFAULT_SETTINGS[key];
						await this.plugin.saveSettings();
						this.plugin.library.rebuild();
					})
				);

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
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.castLimit = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(el)
			.setName("Region")
			.setDesc("Drives which certification and streaming providers are stored. Two-letter country code.")
			.addText((t) =>
				t.setValue(this.plugin.settings.region).onChange(async (v) => {
					this.plugin.settings.region = v.trim().toUpperCase().slice(0, 2) || "US";
					await this.plugin.saveSettings();
				})
			);

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
			.setName("Daily note line prefix")
			.addText((t) =>
				t.setValue(this.plugin.settings.dailyNotePrefix).onChange(async (v) => {
					this.plugin.settings.dailyNotePrefix = v || "- Watched";
					await this.plugin.saveSettings();
				})
			);
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
				this.plugin.library.rebuild();
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
					this.plugin.library.rebuild();
				});
			});

		new Setting(el)
			.setName("Also hide unrated titles")
			.setDesc("Strict mode. An unrated title is unknown, not safe — turn this on if that distinction matters to you.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.hideUnrated).onChange(async (v) => {
					this.plugin.settings.hideUnrated = v;
					await this.plugin.saveSettings();
					this.plugin.library.rebuild();
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
					.setDynamicTooltip()
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

		new Setting(el)
			.setName("Clear cached responses")
			.addButton((b) =>
				b.setButtonText("Clear").onClick(async () => {
					const n = await this.plugin.tmdb.clearCache();
					new Notice(`Reel: cleared ${n} cached response${n === 1 ? "" : "s"}.`);
				})
			);
	}
}
