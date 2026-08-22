import { App, Notice, PluginSettingTab, Setting, debounce } from "obsidian";
import { confirm } from "./ui/confirm";
import type ReelPlugin from "./main";
import { KeyMode, SecretBlob } from "./secrets";
import { CONTENT_FLAGS, ContentFlag, ContentPolicy, FLAG_LABELS, knownCertifications } from "./content";
import { KEY_LABELS, KeyBundle, KeyName, READ_KEYS, WRITE_KEYS } from "./credentials";
import { normaliseHost } from "./publish/mastodon";
import { TraktSignIn } from "./ui/traktSignIn";
import { FEATURES, FeatureSpec, isConfigured, isPartial, setupState } from "./setup";
import { SetupSheet } from "./ui/setupSheet";

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
	 * Which settings sections are expanded, by id.
	 *
	 * Persisted because a settings screen you have arranged and come back to
	 * find rearranged has not remembered anything about you. Stored as the
	 * *open* set rather than the closed one, so a section added in a later
	 * release arrives collapsed — the alternative is every update silently
	 * unfolding a screen the reader had folded up.
	 */
	settingsOpen: string[];
	/**
	 * The version whose update notes have been read.
	 *
	 * Empty on an install that predates the notes screen, which is treated as
	 * "nothing to catch up on" rather than as version zero — replaying eight
	 * releases at someone who has been running them all is not news.
	 */
	lastSeenVersion: string;
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

	/* ---- Publishing --------------------------------------------------- */
	/*
	 * Nothing here turns anything on by itself.
	 *
	 * Every other setting in this file changes how your own vault looks to you.
	 * These change what strangers can read, which is a different kind of thing,
	 * and not one a default should decide. So the switches start off, the
	 * confirm-before-posting switch starts on, and neither target can do
	 * anything at all until you have gone and made a token for it yourself.
	 */
	publishTrakt: boolean;
	publishMastodon: boolean;
	/** Which instance to post to, e.g. "mastodon.social". Not a secret. */
	mastodonHost: string;
	/*
	 * There is deliberately no "skip the confirmation" setting.
	 *
	 * 0.9.0 shipped one — `publishConfirm`, defaulting to true, with a toggle
	 * in this very section — and nothing anywhere read it. The sheet confirmed
	 * unconditionally, which was the correct behaviour attached to a lie: a
	 * control that claims to govern something it does not.
	 *
	 * The fix is not to wire it up. Publishing is the one irreversible,
	 * outward-facing thing this plugin does, the confirmation *is* the feature
	 * rather than a speed bump in front of it, and a setting whose only purpose
	 * is to remove it should not exist to be found later by someone in a hurry.
	 * So the switch is gone and the guarantee is unconditional — and
	 * `tests/publishguard.test.ts` now asserts that the sheet cannot be
	 * bypassed, which is a much better home for the promise than a boolean.
	 */
	/** Send the star rating to Trakt alongside the review. */
	publishRatings: boolean;
	/** Appended to a Mastodon post, e.g. "#film #letterboxd". */
	publishHashtags: string;
	/**
	 * Assume a review might spoil until told otherwise.
	 *
	 * Trakt requires every comment to declare this, and the honest default for
	 * "I wrote down what I thought of a film I just finished" is yes.
	 */
	publishSpoilerDefault: boolean;

	/* ---- Ask (OpenRouter) --------------------------------------------- */
	/** Off until a key is added; no request is ever made without one. */
	aiEnabled: boolean;
	/** An OpenRouter model slug, e.g. "anthropic/claude-3.5-haiku". */
	aiModel: string;
	/** How many titles the shortlist hands the model. Bounds the cost. */
	aiShortlist: number;
	/** Remember what you asked, so a good question can be asked again. */
	recentAsks: string[];
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
	// Only Getting started. Everything else is one tap away and, on a fresh
	// install, none of it is what you came for.
	settingsOpen: ["setup"],
	lastSeenVersion: "",
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

	publishTrakt: false,
	publishMastodon: false,
	mastodonHost: "",
	publishRatings: true,
	publishHashtags: "",
	publishSpoilerDefault: true,

	aiEnabled: false,
	// Cheap, fast, and good enough to sort sixty one-line summaries by how well
	// each answers a sentence, which is the whole of the job. A bigger model
	// costs more per question without ranking a shortlist any better.
	aiModel: "anthropic/claude-3.5-haiku",
	aiShortlist: 60,
	recentAsks: [],
};

const MODE_LABELS: Record<KeyMode, string> = {
	encrypted: "Encrypted in vault (recommended)",
	session: "Session only — never written to disk",
	plain: "Plain text in vault (not recommended)",
};


/**
 * One section of the settings screen.
 *
 * A registry rather than a run of calls, because three separate features all
 * need to ask the same question — what sections are there? Collapsing needs an
 * id to remember, the summary line needs somewhere to live, and search needs
 * something to match against besides the rendered DOM. Written as nine
 * consecutive method calls, the answer to "what sections are there" existed
 * only in the order of the statements.
 */
interface SectionSpec {
	/** Stable across releases: it is persisted in the open set. */
	id: string;
	title: string;
	/**
	 * What this section currently says, in one line, shown while collapsed.
	 *
	 * A closed section that shows only its name is a filing cabinet: you have
	 * to open all of them to find the one you want. A closed section that says
	 * "Trakt, Mastodon" or "Nothing hidden" is an index, and most of the time
	 * the summary is the whole answer and you never open it at all.
	 *
	 * A function, not a string, because every one of these is live state.
	 */
	summary: () => string;
	render: (el: HTMLElement) => void;
	/** Words worth matching that do not appear in the rendered rows. */
	keywords?: string;
	/** Never collapsed — the one section whose job is to be seen. */
	pinned?: boolean;
	cls?: string;
}

export class ReelSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ReelPlugin) {
		super(app, plugin);
	}

	/** What the search box currently holds. Not persisted; a search is a moment. */
	private query = "";
	/** Set at render time so the filter can ask a card what it is. */
	private cards = new Map<string, { spec: SectionSpec; el: HTMLElement }>();

	/**
	 * Ten sections, each collapsible, each saying what it holds.
	 *
	 * The order is by how often you touch it, not by when it was built: what a
	 * new install needs first, then the things that shape your notes, then the
	 * opt-in features that reach outside the vault, and last the controls that
	 * act rather than remember.
	 */
	private sections(): SectionSpec[] {
		const s = this.plugin.settings;
		const yes = (on: boolean, a: string, b: string): string => (on ? a : b);

		return [
			{
				id: "setup",
				title: "Getting started",
				/*
				 * Pinned only while Reel cannot work.
				 *
				 * A section that refuses to fold has to be earning it every
				 * time you open the screen, and "here is how to set up the
				 * thing you set up months ago" is not earning it. While the
				 * TMDB key is missing nothing else on the screen matters, so
				 * it stays; the moment it is in, this becomes an ordinary
				 * section you can put away.
				 */
				pinned: setupState(this.plugin).blocked,
				keywords: "setup first run guide walkthrough tmdb omdb trakt mastodon openrouter",
				summary: () => {
					const st = setupState(this.plugin);
					if (st.blocked) return "Reel needs a TMDB key";
					return `Ready — ${st.done.length} of ${FEATURES.length - 1} optional features on`;
				},
				render: (el) => this.renderSetup(el),
			},
			{
				id: "keys",
				title: "API keys",
				keywords: "credentials token secret passphrase encrypt unlock",
				summary: () => {
					const n = [...READ_KEYS, ...WRITE_KEYS].filter((k) => this.plugin.credentials.has(k)).length;
					const mode = MODE_LABELS[s.keyMode] ?? s.keyMode;
					return n ? `${mode} · ${n} ${n === 1 ? "service" : "services"}` : "None saved";
				},
				render: (el) => this.renderCredentials(el),
			},
			{
				id: "folders",
				title: "Folders",
				keywords: "path vault location posters people",
				summary: () => `${s.filmFolder || "—"} · ${s.seriesFolder || "—"}`,
				render: (el) => this.renderFolders(el),
			},
			{
				id: "metadata",
				title: "Metadata",
				keywords: "cast crew region language specials people links",
				summary: () =>
					`${s.castLimit} cast · ${s.region}${yes(s.linkPeople, " · people linked", "")}`,
				render: (el) => this.renderMetadata(el),
			},
			{
				id: "reviews",
				title: "Reviews",
				keywords: "daily note journal rating prompt template",
				summary: () =>
					`${yes(s.askForReview, "Asks after watching", "Never asks")}` +
					`${yes(s.linkFromDailyNote, " · linked from daily notes", "")}`,
				render: (el) => this.renderReviews(el),
			},
			{
				id: "publishing",
				title: "Publishing",
				keywords: "trakt mastodon post public share spoiler hashtags",
				summary: () => {
					const on = [s.publishTrakt && "Trakt", s.publishMastodon && "Mastodon"].filter(Boolean);
					return on.length ? on.join(", ") : "Off — nothing leaves your vault";
				},
				render: (el) => this.renderPublishing(el),
			},
			{
				id: "ask",
				title: "Ask",
				keywords: "openrouter ai model search recommend natural language",
				summary: () => (s.aiEnabled ? s.aiModel : "Off"),
				render: (el) => this.renderAsk(el),
			},
			{
				id: "content",
				title: "Content filtering",
				keywords: "warnings triggers certification rating age hide",
				summary: () => {
					const bits: string[] = [];
					if (s.hideFlags.length) bits.push(`${s.hideFlags.length} hidden`);
					if (s.maxCertification) bits.push(`up to ${s.maxCertification}`);
					if (s.hideUnrated) bits.push("unrated hidden");
					return bits.length ? bits.join(" · ") : "Nothing hidden";
				},
				render: (el) => this.renderContent(el),
			},
			{
				id: "behaviour",
				title: "Behaviour",
				keywords: "poster quality cache episodes language template open note",
				summary: () =>
					`${s.posterQuality}${yes(s.downloadPosters, " · posters saved", "")}` +
					`${yes(s.cacheResponses, ` · cache ${s.cacheTtlDays}d`, "")}`,
				render: (el) => this.renderBehaviour(el),
			},
			{
				id: "maintenance",
				title: "Maintenance",
				cls: "is-actions",
				keywords: "rebuild clear cache delete posters index repair",
				summary: () => "Runs immediately — some of it deletes files",
				render: (el) => this.renderMaintenance(el),
			},
		];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("reel-settings");
		this.cards.clear();

		this.renderSearch(containerEl);
		for (const spec of this.sections()) this.renderSection(containerEl, spec);
		this.applyFilter();
	}

	/**
	 * The search box.
	 *
	 * Forty-nine controls is past the point where scrolling is a way of
	 * finding things, and it is well past it on a phone. Obsidian's own
	 * settings gained a search for the same reason; a plugin with its own tab
	 * does not inherit it.
	 *
	 * Matching is over the rendered text of each row, not over a hand-kept
	 * keyword table, so it covers the descriptions too — which is how you find
	 * "spoiler" without knowing it lives under Publishing.
	 */
	private renderSearch(root: HTMLElement): void {
		const wrap = root.createDiv({ cls: "reel-settings-search" });
		const input = wrap.createEl("input", { cls: "reel-input", type: "search" });
		input.placeholder = "Search settings…";
		input.value = this.query;
		input.setAttr("aria-label", "Search settings");
		input.addEventListener("input", () => {
			this.query = input.value;
			this.applyFilter();
		});
	}

	private renderSection(root: HTMLElement, spec: SectionSpec): void {
		const card = root.createDiv({ cls: `reel-settings-section${spec.cls ? ` ${spec.cls}` : ""}` });
		const open = spec.pinned || this.plugin.settings.settingsOpen.includes(spec.id);
		card.toggleClass("is-open", open);
		if (spec.pinned) card.addClass("is-pinned");

		const head = card.createEl("button", { cls: "reel-section-head" });
		head.setAttr("aria-expanded", String(open));
		const label = head.createDiv({ cls: "reel-section-label" });
		label.createSpan({ cls: "reel-section-title", text: spec.title });
		label.createSpan({ cls: "reel-section-summary", text: spec.summary() });
		head.createSpan({ cls: "reel-section-chev", text: "›" }).setAttr("aria-hidden", "true");

		const body = card.createDiv({ cls: "reel-section-body" });
		spec.render(body);

		// A pinned section still gets a header, because the title and the live
		// summary are worth having; it simply does not fold away.
		if (spec.pinned) head.setAttr("disabled", "true");
		else head.addEventListener("click", () => void this.toggleSection(spec, card, head));

		this.cards.set(spec.id, { spec, el: card });
	}

	/**
	 * Fold a section, without redrawing the screen.
	 *
	 * `display()` would be the easy call and it is the wrong one: it rebuilds
	 * forty-nine controls and throws away the scroll position, so folding
	 * something near the bottom would jump you back to the top — punishing the
	 * exact tidying-up the feature exists to allow.
	 */
	private async toggleSection(spec: SectionSpec, card: HTMLElement, head: HTMLElement): Promise<void> {
		const openIds = new Set(this.plugin.settings.settingsOpen);
		const nowOpen = !openIds.has(spec.id);
		if (nowOpen) openIds.add(spec.id);
		else openIds.delete(spec.id);

		card.toggleClass("is-open", nowOpen);
		head.setAttr("aria-expanded", String(nowOpen));

		this.plugin.settings.settingsOpen = [...openIds];
		await this.plugin.saveSettings();
	}

	/**
	 * Show what matches, hide what does not.
	 *
	 * Done by toggling classes rather than by re-rendering: a filter that
	 * rebuilt the screen on every keystroke would lose focus from the box you
	 * are typing into, which is a special kind of unusable.
	 *
	 * A matching section is forced open regardless of its saved state. Finding
	 * a setting and being shown the closed section it is inside would be a
	 * search that answers the question and withholds the answer.
	 */
	private applyFilter(): void {
		const q = this.query.trim().toLowerCase();
		let hits = 0;

		for (const { spec, el } of this.cards.values()) {
			const rows = Array.from(el.querySelectorAll<HTMLElement>(".setting-item"));

			if (!q) {
				el.removeClass("is-filtered-out");
				el.removeClass("is-forced-open");
				rows.forEach((r) => r.removeClass("is-filtered-out"));
				continue;
			}

			/*
			 * Three ways to match, and they are not the same strength.
			 *
			 * A title hit means you asked for the section, so you get all of
			 * it. A row hit means you asked for a control, so you get that
			 * control. A keyword hit is the weakest: it only decides whether
			 * the section appears at all, and the rows inside it still have to
			 * earn their place.
			 *
			 * Collapsing those three into one boolean is what the first
			 * version did, and searching "spoiler" — a Publishing keyword —
			 * returned all nine Publishing rows. Technically a match, and no
			 * more useful than scrolling.
			 */
			const titled = spec.title.toLowerCase().includes(q);
			const keyed = (spec.keywords ?? "").toLowerCase().includes(q);

			let any = false;
			for (const row of rows) {
				const hit = titled || (row.textContent ?? "").toLowerCase().includes(q);
				row.toggleClass("is-filtered-out", !hit);
				if (hit) any = true;
			}

			/*
			 * A keyword got the section here and no row matched, so show the
			 * whole thing rather than an empty card. This is the case where
			 * the word you searched is genuinely the subject of the section
			 * without appearing in any of its labels.
			 */
			if (!any && keyed) rows.forEach((r) => r.removeClass("is-filtered-out"));

			// Getting started has no `.setting-item` rows at all, so it can
			// only ever match on its name and keywords.
			const show = any || titled || keyed;
			el.toggleClass("is-filtered-out", !show);
			el.toggleClass("is-forced-open", show);
			if (show) hits++;
		}

		this.renderNoMatches(q, hits);
	}

	/**
	 * Say when a search found nothing.
	 *
	 * Without this the screen goes blank below the box, which reads as a crash
	 * rather than as an answer — and "no results" is a perfectly good answer
	 * that deserves saying out loud.
	 */
	private renderNoMatches(q: string, hits: number): void {
		const host = this.containerEl.querySelector<HTMLElement>(".reel-settings-search");
		host?.querySelector(".reel-settings-empty")?.remove();
		if (!q || hits > 0) return;
		host?.createDiv({ cls: "reel-settings-empty", text: `Nothing in settings matches “${q}”.` });
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

	/**
	 * Getting started — the section that answers "what do I do first".
	 *
	 * Everything below it is a preference. This one is a checklist, and it is
	 * built out of plain markup rather than `Setting` rows on purpose: a
	 * settings row says "here is a choice, make it", and none of these are
	 * choices. They are six things that are either done or not.
	 *
	 * The distinction it draws that nothing drew before is between *off because
	 * you decided against it* and *off because you never got round to it*. Both
	 * used to render as an empty field. One is a finished state and the other
	 * is an unfinished one, and telling them apart is most of what "seamless
	 * first-run setup" actually means.
	 */
	private renderSetup(el: HTMLElement): void {
		const state = setupState(this.plugin);

		if (state.blocked) {
			// The only genuinely blocking state Reel has. It gets said once,
			// plainly, at the top, rather than being inferred from an empty
			// field forty rows further down.
			const stop = el.createDiv({ cls: "reel-setup-blocked" });
			stop.createDiv({ cls: "reel-setup-blocked-title", text: "Reel needs one key before it can do anything" });
			stop.createDiv({
				cls: "reel-setup-blocked-body",
				text:
					"TMDB supplies every poster, cast list and runtime in the plugin. It is free and takes about " +
					"two minutes. Everything else on this screen is optional.",
			});
			const go = stop.createEl("button", { cls: "reel-btn mod-cta", text: "Set up TMDB" });
			go.addEventListener("click", () => this.openGuide(state.essential));
		} else {
			const on = state.done.length;
			const total = FEATURES.length - 1;
			const line = el.createDiv({ cls: "reel-setup-ready" });
			line.createSpan({ cls: "reel-pill ok", text: "Ready" });
			line.createSpan({
				cls: "reel-setup-ready-text",
				text:
					on === 0
						? `Reel works. ${total} optional features are available below.`
						: `Reel works, with ${on} of ${total} optional features on.`,
			});
		}

		/*
		 * The tick column is reserved, not per-row — six names have to line up,
		 * and a column that appears only on the rows that earned it makes a
		 * ragged left edge that reads as a rendering fault.
		 *
		 * But on a fresh install nothing has a tick, so the column is pure
		 * unexplained indent on every row of the one screen every single user
		 * sees. So it is reserved when it holds something and absent when it
		 * does not, decided once for the whole list.
		 */
		const anyMark = FEATURES.some((f) => isConfigured(this.plugin, f) || isPartial(this.plugin, f));
		const list = el.createDiv({ cls: `reel-setup-list${anyMark ? "" : " is-fresh"}` });
		for (const spec of FEATURES) {
			// When Reel is blocked, the callout above *is* the TMDB item,
			// promoted out of the list because it is the only thing that
			// matters. Listing it again three inches below the button that
			// already does it is the sort of duplication that makes a screen
			// feel machine-generated.
			if (state.blocked && spec.essential) continue;
			this.renderSetupRow(list, spec);
		}

		el.createDiv({
			cls: "reel-settings-note",
			text:
				"Each guide opens the pages you need, gives you the exact values to paste, and says what leaves " +
				"your vault before you commit to anything.",
		});
	}

	/**
	 * One feature, as a row you tap.
	 *
	 * The row is a `<button>` rather than a div containing one. The first
	 * version gave every feature its own "Set up" control, which rendered as
	 * six full-width accent buttons stacked down a phone screen — a wall of
	 * identical calls to action, none of which could be more important than
	 * any other because they all looked the same. It passed every check in the
	 * audit and was obviously wrong in the first screenshot.
	 *
	 * The whole row being the target also means the touch area is the size of
	 * the thing you are aiming at, which on a phone is the only sane answer.
	 */
	private renderSetupRow(list: HTMLElement, spec: FeatureSpec): void {
		const done = isConfigured(this.plugin, spec);
		const part = isPartial(this.plugin, spec);

		const row = list.createEl("button", { cls: "reel-setup-row" });
		if (done) row.addClass("is-done");
		if (part) row.addClass("is-partial");
		if (spec.essential) row.addClass("is-essential");
		row.setAttr("aria-label", `${spec.name}. ${done ? "Set up." : part ? "Half done." : "Not set up."} Open the guide.`);

		const mark = row.createSpan({ cls: "reel-setup-mark" });
		mark.setText(done ? "✓" : part ? "!" : "");
		// Decoration. The state is already in the row's own label, and a
		// screen reader announcing "check mark" before the name is noise.
		mark.setAttr("aria-hidden", "true");

		const body = row.createDiv({ cls: "reel-setup-row-body" });
		const top = body.createDiv({ cls: "reel-setup-row-top" });
		top.createSpan({ cls: "reel-setup-row-name", text: spec.name });

		/*
		 * A pill only when the tick cannot say it.
		 *
		 * This has now been wrong twice in opposite directions. The first
		 * version put one on every row, which was four identical "Optional"
		 * chips — a label true of most rows, charging rent on the line that
		 * carries the name. The second dropped those and kept "Set up", which
		 * on a configured install is five green pills beside five green ticks
		 * saying the same word twice in the same colour.
		 *
		 * A tick means done. That leaves exactly two states a tick cannot
		 * express, and those are the two that get a pill.
		 */
		if (part) top.createSpan({ cls: "reel-pill warn", text: "Half done" });
		else if (!done && spec.essential) top.createSpan({ cls: "reel-pill warn", text: "Required" });

		/*
		 * The description is a pitch, and a pitch is for something you have not
		 * bought yet. On an install with everything configured it was five
		 * paragraphs explaining features you are already using — 1,500px of
		 * settled questions above the first thing you might actually want to
		 * change. Done rows are one line; the guide is still a tap away.
		 */
		if (!done) body.createDiv({ cls: "reel-setup-row-gives", text: spec.gives });

		const chev = row.createSpan({ cls: "reel-setup-chev", text: "›" });
		chev.setAttr("aria-hidden", "true");

		row.addEventListener("click", () => this.openGuide(spec));
	}

	/**
	 * Redraw after the guide closes.
	 *
	 * A key can be saved from inside the sheet's steps, and coming back to a
	 * checklist still claiming you have not started is exactly the kind of
	 * small lie that makes a settings screen feel dead.
	 */
	private openGuide(spec: FeatureSpec): void {
		new SetupSheet(this.app, this.plugin, spec, () => this.display()).open();
	}

	/* ---------------------------------------------------------------- */

	private renderCredentials(el: HTMLElement): void {
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
			for (const name of [...READ_KEYS, ...WRITE_KEYS]) {
				if (store.has(name)) status.createSpan({ cls: "reel-pill ok", text: KEY_LABELS[name] });
			}
		};
		describe();

		new Setting(el)
			.setName("Key storage")
			.setDesc(
				"Every key shares one encrypted blob and one passphrase — a prompt per service would be intolerable, " +
					"and splitting them buys nothing, since whatever can read one can read the rest. Note that Trakt and " +
					"Mastodon are different in kind from the others: those can post publicly as you."
			)
			.addDropdown((d) => {
				(Object.keys(MODE_LABELS) as KeyMode[]).forEach((m) => d.addOption(m, MODE_LABELS[m]));
				d.setValue(this.plugin.settings.keyMode).onChange(async (value) => {
					await this.plugin.credentials.migrateTo(value as KeyMode);
					this.display();
				});
			});

		const keyField = (name: KeyName, label: string, desc: string) => this.keyField(el, name, label, desc);

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

	/**
	 * One credential: a password field, a Save, and a Remove once there is
	 * something to remove.
	 *
	 * A method rather than the closure it used to be inside the API-keys
	 * section, because publishing needs exactly the same control and a second
	 * copy of it would be a second place for the Remove confirmation to go
	 * missing, or for "paste to replace" to quietly stop being true.
	 */
	private keyField(el: HTMLElement, name: KeyName, label: string, desc: string): void {
		const store = this.plugin.credentials;
		let input: HTMLInputElement | null = null;
		const setting = new Setting(el)
			.setName(label)
			.setDesc(desc)
			.addText((t) => {
				t.setPlaceholder(store.has(name) ? "Saved \u2014 paste to replace" : "Paste key, then Save");
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
	}

	/* ---------------------------------------------------------------- */

	/**
	 * Publishing \u2014 the only part of Reel that writes outside your vault.
	 *
	 * Written to be read before it is used, which is unusual for a settings
	 * section and correct for this one. The copy says what leaves, where it
	 * goes and under whose name, because switching this on is agreeing to
	 * something you cannot take back, and a toggle labelled "Trakt" with no
	 * further explanation is not an informed decision.
	 *
	 * IMDb is named explicitly. It is what people ask for, it is not possible,
	 * and leaving that unsaid means everyone who wants it goes hunting through
	 * the settings for an option that was never there.
	 */
	private renderPublishing(el: HTMLElement): void {
		el.createDiv({
			cls: "reel-settings-note",
			text:
				"Reviews stay in your vault unless you publish one, one at a time, from the button beside it. " +
				"Nothing here posts automatically, and nothing posts without showing you the exact text first.",
		});
		el.createDiv({
			cls: "reel-settings-note reel-dim",
			text:
				"IMDb isn't an option: it has no public way to post a review, and the only alternative would be " +
				"driving a login and a form as you, which Reel won't do. Trakt is the closest equivalent with a " +
				"real API \u2014 a public profile carrying ratings and reviews.",
		});

		new Setting(el)
			.setName("Trakt")
			.setDesc("A public film and TV profile. Reviews post as comments, with your star rating alongside.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.publishTrakt).onChange(async (v) => {
					this.plugin.settings.publishTrakt = v;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		if (this.plugin.settings.publishTrakt) this.renderTraktApp(el);

		new Setting(el)
			.setName("Mastodon")
			.setDesc("One public post per review, with the title, your stars and the text.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.publishMastodon).onChange(async (v) => {
					this.plugin.settings.publishMastodon = v;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		if (this.plugin.settings.publishMastodon) {
			new Setting(el)
				.setName("Instance")
				.setDesc("The server you post from, e.g. mastodon.social. Not a secret, so it isn't encrypted.")
				.addText((t) =>
					t
						.setPlaceholder("mastodon.social")
						.setValue(this.plugin.settings.mastodonHost)
						.onChange(
							debounce(async (v: string) => {
								this.plugin.settings.mastodonHost = normaliseHost(v);
								await this.plugin.saveSettings();
							}, 500)
						)
				);

			this.keyField(
				el,
				"mastodon",
				"Access token",
				"Your instance \u2192 Preferences \u2192 Development \u2192 New application. Tick write:statuses; nothing else is needed."
			);
		}

		if (!this.plugin.publish.anyEnabled) return;

		el.createDiv({
			cls: "reel-settings-note reel-dim",
			text:
				"There's no switch to skip the confirmation. Publishing is the one thing Reel does that can't be " +
				"undone, so the sheet showing you the exact text is the feature rather than a step in front of it.",
		});

		new Setting(el)
			.setName("Publish ratings too")
			.setDesc("Send the star rating to Trakt with the review. Your stars appear in the Mastodon text either way.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.publishRatings).onChange(async (v) => {
					this.plugin.settings.publishRatings = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(el)
			.setName("Assume spoilers")
			.setDesc(
				"Start each review marked as spoilers. Trakt requires the declaration either way, and on Mastodon it goes behind a content warning."
			)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.publishSpoilerDefault).onChange(async (v) => {
					this.plugin.settings.publishSpoilerDefault = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(el)
			.setName("Hashtags")
			.setDesc("Added to the end of a Mastodon post. Reserved out of the character budget, so they never get cut.")
			.addText((t) =>
				t
					.setPlaceholder("#film #tv")
					.setValue(this.plugin.settings.publishHashtags)
					.onChange(
						debounce(async (v: string) => {
							this.plugin.settings.publishHashtags = v.trim();
							await this.plugin.saveSettings();
						}, 500)
					)
			);
	}

	/**
	 * Your own Trakt application, and then the sign-in that uses it.
	 *
	 * You register the app rather than Reel shipping one, and the reason is
	 * worth stating in the UI as well as here: Trakt's device flow needs a
	 * client secret, and a secret compiled into an open-source plugin is
	 * printed in the repository for anyone to read. Shipping one and calling it
	 * secret would be theatre. Yours stays yours, in the same encrypted store
	 * as every other key.
	 */
	private renderTraktApp(el: HTMLElement): void {
		const store = this.plugin.credentials;
		const hasApp = store.has("traktApp");
		const signedIn = store.has("trakt");

		if (!hasApp) {
			el.createDiv({
				cls: "reel-settings-note",
				text:
					"Trakt needs an application of your own: trakt.tv/oauth/applications \u2192 New Application. " +
					"Any name will do, and set the redirect URI to urn:ietf:wg:oauth:2.0:oob. " +
					"Then paste its client ID and secret below.",
			});
		}

		let idEl: HTMLInputElement | null = null;
		let secretEl: HTMLInputElement | null = null;

		const setting = new Setting(el)
			.setName("Trakt application")
			.setDesc(
				hasApp
					? "Saved. Paste both again to replace them."
					: "From trakt.tv/oauth/applications. Both are stored with your other keys."
			)
			.addText((t) => {
				t.setPlaceholder("Client ID");
				t.inputEl.autocomplete = "off";
				t.inputEl.spellcheck = false;
				t.inputEl.addClass("reel-input");
				idEl = t.inputEl;
			})
			.addText((t) => {
				t.setPlaceholder("Client secret");
				t.inputEl.type = "password";
				t.inputEl.autocomplete = "off";
				t.inputEl.spellcheck = false;
				t.inputEl.addClass("reel-input");
				secretEl = t.inputEl;
			})
			.addButton((b) =>
				b
					.setButtonText("Save")
					.setCta()
					.onClick(async () => {
						const clientId = (idEl?.value ?? "").trim();
						const clientSecret = (secretEl?.value ?? "").trim();
						if (!clientId || !clientSecret) {
							new Notice("Reel: both the client ID and the secret are needed.");
							return;
						}
						const ok = await this.plugin.credentials.store(
							"traktApp",
							JSON.stringify({ id: clientId, secret: clientSecret })
						);
						if (idEl) idEl.value = "";
						if (secretEl) secretEl.value = "";
						new Notice(ok ? "Reel: Trakt application saved." : "Reel: not saved.");
						this.display();
					})
			);

		if (hasApp) {
			setting.addButton((b) =>
				b.setButtonText("Remove").onClick(async () => {
					const ok = await confirm(this.app, {
						title: "Remove the Trakt application",
						body: "This also signs you out of Trakt. You would need the client ID and secret again to reconnect.",
						confirmText: "Remove",
						danger: true,
					});
					if (!ok) return;
					await this.plugin.credentials.remove("traktApp");
					await this.plugin.credentials.remove("trakt");
					this.display();
				})
			);
		}

		if (!hasApp) return;

		new Setting(el)
			.setName(signedIn ? "Signed in to Trakt" : "Sign in to Trakt")
			.setDesc(
				signedIn
					? "Reel can post reviews and ratings as you. Sign out to stop that immediately."
					: "Trakt shows you a short code to type on any device. Nothing has to link back to this app."
			)
			.addButton((b) =>
				signedIn
					? b.setButtonText("Sign out").onClick(async () => {
							await this.plugin.publish.signOut();
							new Notice("Reel: signed out of Trakt.");
							this.display();
						})
					: b
							.setButtonText("Sign in")
							.setCta()
							.onClick(async () => {
								const app = await this.plugin.publish.app();
								if (!app) {
									new Notice("Reel: couldn't read the Trakt application.");
									return;
								}
								new TraktSignIn(this.app, this.plugin, app, (ok) => {
									if (ok) this.display();
								}).open();
							})
			);
	}

	/**
	 * Ask \u2014 the one feature that sends your library somewhere else.
	 *
	 * The copy says exactly what goes and what doesn't, in the same words as
	 * the sheet, and it sits above the toggle rather than under it. "Titles,
	 * years, genres, runtimes and your ratings" is a specific enough claim to
	 * be checked against the code; "some data about your library" would not be.
	 */
	private renderAsk(el: HTMLElement): void {
		el.createDiv({
			cls: "reel-settings-note",
			text:
				"Describe what you feel like watching and Reel finds it in your own library. " +
				"A question sends your words, plus a short list of titles \u2014 names, years, genres, runtimes and " +
				"your star ratings \u2014 to OpenRouter. Not your reviews, not your watch dates, not your file paths.",
		});

		new Setting(el)
			.setName("Enable Ask")
			.setDesc("Off by default. With this off, no request is ever made, key or no key.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.aiEnabled).onChange(async (v) => {
					this.plugin.settings.aiEnabled = v;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		if (!this.plugin.settings.aiEnabled) return;

		this.keyField(
			el,
			"openrouter",
			"OpenRouter key",
			"From openrouter.ai/keys. You pay OpenRouter directly; Reel shows what each question cost in tokens."
		);

		new Setting(el)
			.setName("Model")
			.setDesc(
				"An OpenRouter model slug. The job is ranking sixty one-line summaries, which a small fast model does as well as a large one and far more cheaply."
			)
			.addText((t) =>
				t
					.setPlaceholder("anthropic/claude-3.5-haiku")
					.setValue(this.plugin.settings.aiModel)
					.onChange(
						debounce(async (v: string) => {
							this.plugin.settings.aiModel = v.trim() || DEFAULT_SETTINGS.aiModel;
							await this.plugin.saveSettings();
						}, 500)
					)
			);

		new Setting(el)
			.setName("Shortlist size")
			.setDesc(
				"How many titles get sent for ranking. Larger casts a wider net and costs more per question; the filtering that chooses them runs over your whole library either way."
			)
			.addSlider((sl) =>
				sl
					.setLimits(20, 150, 10)
					.setValue(this.plugin.settings.aiShortlist)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.aiShortlist = v;
						await this.plugin.saveSettings();
					})
			);

		if (this.plugin.settings.recentAsks.length) {
			new Setting(el)
				.setName("Forget past questions")
				.setDesc(`${this.plugin.settings.recentAsks.length} remembered, shown as shortcuts in the Ask sheet.`)
				.addButton((b) =>
					b.setButtonText("Forget").onClick(async () => {
						this.plugin.settings.recentAsks = [];
						await this.plugin.saveSettings();
						this.display();
					})
				);
		}
	}

	/* ---------------------------------------------------------------- */

	private renderFolders(el: HTMLElement): void {
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
		//
		// The separation was a heading and a paragraph asking to be believed.
		// Now it is structural: Maintenance is a registered section in its own
		// right, with its own card, its own colouring and its own collapsed
		// state, so the difference between "change a preference" and "delete
		// forty files" is something you can see rather than something you have
		// to read.
	}

	private renderMaintenance(maint: HTMLElement): void {
		maint.createDiv({
			cls: "reel-setting-note",
			text: "These run straight away rather than changing a preference. The ones that remove files move them to the trash, and ask first.",
		});

		new Setting(maint)
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
		new Setting(maint)
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

		new Setting(maint)
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
