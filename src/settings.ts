import { App, Notice, PluginSettingTab, Setting, debounce } from "obsidian";
import { confirm } from "./ui/confirm";
import type ReelPlugin from "./main";
import { KeyMode, SecretBlob } from "./secrets";
import { CONTENT_FLAGS, ContentFlag, ContentPolicy, FLAG_LABELS, knownCertifications } from "./content";
import { KEY_LABELS, KeyBundle, KeyName, PassphraseChange, READ_KEYS, WRITE_KEYS } from "./credentials";
import { TraktSignIn } from "./ui/traktSignIn";
import { FEATURES, FeatureId, FeatureSpec, isConfigured, isPartial, partialPhrase, setupState } from "./setup";
import { describeFolder, folderState, matchFolders, normaliseFolder } from "./util/folders";
import { checkAll, checkable } from "./checks";
import { FieldContext, keyField, traktAppField } from "./ui/fields";
import {
	HealthMap,
	HealthInputs,
	TESTABLE,
	describeHealth,
	describeTrakt,
	featureHealth,
	traktState,
} from "./health";
import { CURATED, ModelInfo, formatPrice, rankModels, slugProblem } from "./ai/models";
import { dailyStatus, previewLine, scanDaily, suggestDailyFolders } from "./util/dailynote";
import { normaliseHost } from "./publish/mastodon";
import { todayISO } from "./util/dates";
import { redact } from "./secrets";
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
	 * What each connection did the last time anybody checked.
	 *
	 * Kept because the answer used to live in an eight-second Notice, which
	 * meant the screen could not tell "tested and working" from "never
	 * tested" — the two rendered identically, which is to say the test told
	 * you something once and the settings screen never did.
	 */
	connectionHealth: HealthMap;
	/**
	 * When the Trakt session expires. Epoch milliseconds, 0 if unknown.
	 *
	 * Deliberately outside the encrypted blob: it is a date rather than a
	 * secret, and the screen must be able to say whether you are signed in
	 * without asking for a passphrase first.
	 */
	traktExpires: number;
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
	 * Which walkthrough steps you have marked done, per feature.
	 *
	 * Kept because half of these steps happen on somebody else's website, and
	 * the phone this plugin is built for cannot show two apps at once. You tick
	 * step two, switch to a browser to do step three, come back — and the sheet
	 * was rebuilt, so every mark you made is gone and you are looking at 2,700
	 * pixels of instructions with no idea where you were.
	 *
	 * Which is the exact question the ticks exist to answer. Holding them in
	 * memory made them survive a redraw and nothing else, and leaving the guide
	 * is not an edge case here — it is the middle of the task.
	 */
	setupTicks: Record<string, number[]>;
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
	connectionHealth: {},
	traktExpires: 0,
	// Only Getting started. Everything else is one tap away and, on a fresh
	// install, none of it is what you came for.
	settingsOpen: ["setup"],
	setupTicks: {},
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
 * What the mode you have chosen actually does to you.
 *
 * The dropdown offers three and the paragraph above it described one. It
 * explained the encrypted blob and its single passphrase to everybody —
 * including the person on session-only storage, for whom there is no blob and
 * no passphrase, and the person on plain text, for whom there is no encryption
 * at all. Three different arrangements of your secrets, one explanation, and no
 * way to tell from the screen which one you were reading about.
 *
 * Session mode had the most to lose by that. Its label says "never written to
 * disk", which is the appealing half; the half you find out by restarting
 * Obsidian — that you type your key in again, every time — was written down
 * nowhere.
 *
 * Plain text keeps its own sentence below, because that one has to name a file
 * path and is a caution rather than a description.
 */
const MODE_NOTES: Record<KeyMode, string> = {
	encrypted:
		"Every key shares one encrypted blob and one passphrase. A prompt per service would be intolerable, and " +
		"splitting them buys nothing, since whatever can read one can read the rest. Reel asks once, the first " +
		"time it needs a key after Obsidian starts.",
	session:
		"Nothing is written to disk. Reel asks for your TMDB key the first time it needs one and forgets it when " +
		"Obsidian closes, so you enter it again every time you start, on every device.",
	plain: "",
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
type FolderKey = "filmFolder" | "seriesFolder" | "posterFolder" | "peopleFolder";

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

	/**
	 * OpenRouter's model list, once somebody has asked for it.
	 *
	 * Not persisted. Prices and availability change, and a cached list is
	 * exactly the sort of thing that goes quietly wrong months later; fetching
	 * it costs one request and only when the button is pressed.
	 */
	private models: ModelInfo[] | null = null;

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
					const half = partialPhrase(st.partial);
					// The unfinished one first when there is one: it is the only
					// part of this line anybody can act on.
					const on = `${st.done.length} of ${FEATURES.length - 1} on`;
					return half ? `Ready — ${on} · ${half}` : `Ready — ${on}`;
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
					if (!n) return "None saved";
					// A failure is the only thing worth interrupting the summary
					// for, and it is worth interrupting it every time.
					const bad = TESTABLE.filter((id) => s.connectionHealth[id]?.ok === false).length;
					const tail = bad ? ` · ${bad} failing` : "";
					return `${mode} · ${n} ${n === 1 ? "service" : "services"}${tail}`;
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
			const head = el.querySelector<HTMLElement>(".reel-section-head");

			/*
			 * Everything in the body that is not a row and holds no rows.
			 *
			 * Computed before the branch below, because both halves need it:
			 * one hides it and the other has to be able to put it back.
			 *
			 * Structural rather than a list of prose classes. A list is right
			 * the day it is written and wrong the first time somebody adds a
			 * callout, which is how the one narrow patch in the stylesheet for
			 * the folder chips came to be the only case that was handled.
			 */
			const body = el.querySelector<HTMLElement>(".reel-section-body");
			const prose = body
				? (Array.from(body.children) as HTMLElement[]).filter(
						(c) => !c.classList.contains("setting-item") && !c.querySelector(".setting-item")
					)
				: [];

			if (!q) {
				el.removeClass("is-filtered-out");
				el.removeClass("is-forced-open");
				rows.forEach((r) => r.removeClass("is-filtered-out"));
				/*
				 * Including the prose, which was the half I forgot.
				 *
				 * Hiding it with its rows was right; leaving it hidden once the
				 * box was cleared meant a screen that had ever been searched
				 * lost its explanations until the next full redraw. Every
				 * class this function adds has to be a class it can take away.
				 */
				prose.forEach((p) => p.removeClass("is-filtered-out"));
				/*
				 * And the header goes back to describing its own state.
				 *
				 * Pinned sections keep their disabled attribute: it was never
				 * the search that put it there.
				 */
				if (head) {
					const open = spec.pinned || this.plugin.settings.settingsOpen.includes(spec.id);
					head.setAttr("aria-expanded", String(open));
					if (!spec.pinned) head.removeAttribute("disabled");
				}
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
			let hidden = false;
			for (const row of rows) {
				const hit = titled || (row.textContent ?? "").toLowerCase().includes(q);
				row.toggleClass("is-filtered-out", !hit);
				if (hit) any = true;
				else hidden = true;
			}

			/*
			 * A keyword got the section here and no row matched, so show the
			 * whole thing rather than an empty card. This is the case where
			 * the word you searched is genuinely the subject of the section
			 * without appearing in any of its labels.
			 */
			if (!any && keyed) {
				rows.forEach((r) => r.removeClass("is-filtered-out"));
				hidden = false;
			}

			/*
			 * The prose goes with the rows it explains.
			 *
			 * Only the `.setting-item` rows were ever filtered, so every
			 * paragraph in a section survived a search that hid everything it
			 * was about. Searching "spoiler" left one matching control under
			 * three hundred pixels of explanation — including a note saying why
			 * IMDb is not among the destinations, beside a list of destinations
			 * that was no longer on screen.
			 *
			 * Structural rather than a list of prose classes: anything that is
			 * not a row and contains no rows. A list would be right the day it
			 * was written and wrong the first time somebody adds a callout,
			 * which is how the one narrow patch for `.reel-folder-extra` in the
			 * stylesheet came to be the only case handled.
			 *
			 * Only when rows were actually hidden. A section matched by its
			 * title or by a keyword shows everything, and its explanation is
			 * part of everything.
			 */
			for (const p of prose) p.toggleClass("is-filtered-out", hidden);

			// Getting started has no `.setting-item` rows at all, so it can
			// only ever match on its name and keywords.
			const show = any || titled || keyed;
			el.toggleClass("is-filtered-out", !show);
			el.toggleClass("is-forced-open", show);
			if (show) hits++;

			/*
			 * While a search is running, the fold control is not what decides
			 * whether you can see the section, so it stops pretending to be.
			 *
			 * It was doing two wrong things at once. It reported
			 * `aria-expanded="false"` for a section whose contents were on
			 * screen, so anybody listening to the page was told a section was
			 * collapsed while it was being read out. And tapping it still
			 * toggled the saved state and wrote it to disk — with the body
			 * visible either way, so nothing moved. You tapped to collapse
			 * something, nothing happened, and the change turned up later as a
			 * section that was open when you cleared the box.
			 *
			 * Disabled for the duration, exactly as a pinned section is, and
			 * restored above when the query goes.
			 */
			if (head) {
				head.setAttr("aria-expanded", String(show));
				head.setAttr("disabled", "true");
			}
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
			const half = partialPhrase(state.partial);
			line.createSpan({
				cls: "reel-setup-ready-text",
				text:
					(on === 0
						? `Reel works. ${total} optional features are available below.`
						: `Reel works, with ${on} of ${total} optional features on.`) +
					// Said second because it is the exception, and said at all
					// because a feature a few minutes from working is not the
					// same as one nobody has touched.
					(half ? ` ${half}.` : ""),
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
				"Each guide opens the pages you need, takes the key in the guide itself, and can check it works " +
				"before you leave. Every one says what leaves your vault before you commit to anything.",
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

		/*
		 * The tick has to answer the same question the row does.
		 *
		 * It first shipped meaning "configured", which is what `done` is — and
		 * then the health line arrived underneath it and the result was a green
		 * check mark sitting beside the words "Session expired 9 days ago". Both
		 * statements were true and the pair of them was a lie, which is exactly
		 * the confusion between *present* and *working* that this whole release
		 * is about. Having fixed it in the model, I had reproduced it in the
		 * one glyph most people will actually read.
		 *
		 * So a configured feature known to be failing gets the warning mark. It
		 * is still set up; it is not fine, and fine is what a tick means.
		 */
		const health = this.featureHealth(spec);
		const sick = done && health?.tone === "warn";

		const row = list.createEl("button", { cls: "reel-setup-row" });
		if (done) row.addClass("is-done");
		if (part) row.addClass("is-partial");
		if (sick) row.addClass("is-unhealthy");
		if (spec.essential) row.addClass("is-essential");
		row.setAttr(
			"aria-label",
			`${spec.name}. ${sick ? health?.text : done ? "Set up." : part ? "Half done." : "Not set up."} Open the guide.`
		);

		const mark = row.createSpan({ cls: "reel-setup-mark" });
		mark.setText(sick ? "!" : done ? "✓" : part ? "!" : "");
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
		if (!done) {
			body.createDiv({ cls: "reel-setup-row-gives", text: spec.gives });
			/*
			 * How long, and whether it costs anything.
			 *
			 * `effort` existed on every feature and was only ever shown inside
			 * the guide — which is one tap too late, because it is the fact
			 * that decides whether you take the tap. "Publishing to a public
			 * film profile" tells you what it does and nothing about whether
			 * this is a two-minute job or an account you have to register.
			 *
			 * Undone rows only, following the same rule as the sentence above
			 * it: this is a pitch, and a pitch is for something you have not
			 * bought yet.
			 */
			body.createDiv({ cls: "reel-setup-row-effort", text: spec.effort });
		}

		/*
		 * A configured feature that is failing says so here.
		 *
		 * Getting started is where you look when something has stopped
		 * working, and until now it answered a different question — is this
		 * set up — which an expired Trakt session and a revoked API key both
		 * answer "yes" to. Only warnings appear: a healthy row reading
		 * "Working, checked 2 days ago" on all six would be the same wall of
		 * green the ticks already are.
		 */
		if (sick && health) body.createDiv({ cls: "reel-setup-row-warn", text: health.text });

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
		/*
		 * Keys stored, none of them readable.
		 *
		 * Both halves matter. `needsUnlock` alone is true on a brand new
		 * install in the default mode, where there is nothing to unlock, and a
		 * screen offering to unlock an empty vault is worse than one that does
		 * not mention locks at all.
		 */
		const sealed = store.needsUnlock && store.hasStoredKey;
		/*
		 * Where plain text actually puts them.
		 *
		 * The fallback is not defensive tidiness. This string is the one
		 * sentence on the screen that says where your keys land in the clear,
		 * and with `configDir` missing it read "undefined/plugins/reel/
		 * data.json" — a security warning naming a path that does not exist,
		 * which is worse than no warning, because it reads as a bug and
		 * invites you to disbelieve the rest of the sentence.
		 */
		const dataPath = `${this.app.vault.configDir ?? ".obsidian"}/plugins/reel/data.json`;
		/*
		 * Is there anything for the Test button to do?
		 *
		 * With nothing configured it ran, checked none of six services, saved,
		 * and returned — so the button went "Testing…" and back to "Test" with
		 * no row, no notice and no change at all. On the first screen of a new
		 * install that is the most discouraging answer available: you press the
		 * control that proves it works and the screen says nothing.
		 *
		 * Sealed is excluded because there is something to do there: unlock, and
		 * then everything becomes checkable.
		 */
		const nothingToTest = !sealed && !TESTABLE.some((id) => checkable(this.plugin, id));

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
				/*
				 * Not the list of names.
				 *
				 * The loop below already prints one pill per configured
				 * service, so naming them here printed every key twice — once
				 * in an amber pill and once in a green one, side by side, the
				 * same word in two colours that mean opposite things. This is
				 * the only mode that did it, because it is the only mode whose
				 * summary knew the names.
				 */
				status.createSpan({ cls: "reel-pill warn", text: "Plain text on disk" });
			} else {
				status.createSpan({ cls: "reel-pill warn", text: "No keys set" });
			}
			// Which services are configured, regardless of lock state.
			for (const name of [...READ_KEYS, ...WRITE_KEYS]) {
				if (store.has(name)) status.createSpan({ cls: "reel-pill ok", text: KEY_LABELS[name] });
			}
		};
		describe();

		/*
		 * The half of the pair that did not exist.
		 *
		 * There has always been a "Lock now" button and never an unlock. Locking
		 * was a decision you could make; unlocking was something that happened
		 * to you, when some other action needed a key and a modal arrived to
		 * demand a passphrase for a reason you had to infer.
		 *
		 * And encrypted is the default mode, so this is not a corner: it is the
		 * state the settings screen is in every time you open Obsidian and come
		 * here before doing anything else. The pill above says "Encrypted —
		 * locked" and, until now, nothing on the screen would do anything about
		 * that.
		 *
		 * It sits under the status rather than beside the lock, because the line
		 * it answers is the one directly above it.
		 */
		if (sealed) {
			new Setting(el)
				.setName("Unlock keys")
				.setDesc(
					"Nothing can be tested or fetched until the keys are readable. One passphrase unlocks all of them, " +
						"and Reel holds them until you quit Obsidian or press Lock."
				)
				.addButton((b) =>
					b
						.setButtonText("Unlock")
						.setCta()
						.onClick(async () => {
							b.setDisabled(true).setButtonText("Unlocking…");
							const opened = await this.plugin.credentials.unlock();
							new Notice(opened ? "Reel: keys unlocked." : "Reel: keys stay locked.");
							// Redrawn either way: the pills, this row and every
							// health line are all decided by the answer.
							this.display();
						})
				);
		}

		new Setting(el)
			.setName("Key storage")
			.setDesc(
				"Where Reel keeps your keys. Note that Trakt and Mastodon are different in kind from the others: " +
					"those can post publicly as you."
			)
			.addDropdown((d) => {
				(Object.keys(MODE_LABELS) as KeyMode[]).forEach((m) => d.addOption(m, MODE_LABELS[m]));
				d.setValue(this.plugin.settings.keyMode).onChange(async (value) => {
					const next = value as KeyMode;
					/*
					 * One tap of a dropdown used to take every key out of an
					 * encrypted blob and write it readably to disk.
					 *
					 * The other two directions are recoverable in the ordinary
					 * sense — you can always encrypt again, or re-enter a key.
					 * This one is not, because what it changes is not where the
					 * key is stored but who has already read it: once a secret
					 * has sat in cleartext in a folder that syncs, moving it
					 * back does not un-sync it.
					 *
					 * The label said "(not recommended)" and the explanation
					 * lived at the bottom of the section, several hundred
					 * pixels below on a phone. Removing one key has asked for
					 * confirmation since it was written; exposing all of them
					 * asked for nothing.
					 */
					if (next === "plain" && this.plugin.settings.keyMode !== "plain") {
						const ok = await confirm(this.app, {
							title: "Write your keys in plain text?",
							body:
								`Every saved key is written readably into ${dataPath}. Anything that can read the vault ` +
								"can read them: sync, backups, another plugin, anyone you share the folder with. Reel can " +
								"encrypt them again later, but a key that has been on disk in the clear is best treated as " +
								"exposed and replaced at the service that issued it.",
							confirmText: "Write in plain text",
							danger: true,
						});
						if (!ok) {
							// The dropdown has already moved. Leaving it
							// showing a mode the vault is not in is the same
							// lie as a switch that controls nothing.
							d.setValue(this.plugin.settings.keyMode);
							return;
						}
					}
					await this.plugin.credentials.migrateTo(next);
					this.display();
				});
			});

		/*
		 * The warning, at the point of decision rather than at the foot of the
		 * section.
		 *
		 * It used to render last, after three key fields, a toggle, the health
		 * table and two buttons — so on a phone the sentence explaining what
		 * plain text does was most of a screen below the control that chose it,
		 * and you would only meet it by scrolling past everything you had come
		 * for. A caution you have to go looking for is decoration.
		 */
		const mode = this.plugin.settings.keyMode;
		el.createDiv({
			cls: mode === "plain" ? "reel-callout warn" : "reel-callout",
			text:
				mode === "plain"
					? `Plain text mode writes your keys readably into ${dataPath}. ` +
						"If this vault is synced to git or a shared drive, treat them as public."
					: MODE_NOTES[mode],
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

		const health = el.createDiv({ cls: "reel-health" });

		/*
		 * The result of the last test, kept on screen.
		 *
		 * It used to be a Notice that disappeared after eight seconds, which
		 * meant a screen that had just proved every key worked looked exactly
		 * like one that had never been tested. The answer existed, briefly,
		 * and then the only place it lived was your memory.
		 */
		const drawHealth = (): void => {
			health.empty();
			const now = Date.now();
			const inputs = this.healthInputs();
			for (const id of TESTABLE) {
				const rec = this.plugin.settings.connectionHealth[id];
				/*
				 * A row appears if there is a result to show, or if a key is
				 * stored and a result is therefore expected.
				 *
				 * This was keyed on the stored credential alone, which was
				 * right while every testable service was a key and stopped
				 * being right the moment Mastodon joined the list. Mastodon is
				 * checked by its server address, on purpose — that is the half
				 * that can be checked — so a token is exactly the wrong thing to
				 * ask for before showing the answer. Somebody who has typed a
				 * server, pressed Test and not yet made a token would have had
				 * the result recorded and never shown it.
				 */
				if (!rec && !store.has(id)) continue;
				// The shared router, so Trakt cannot be described one way here
				// and another way two screens over.
				const said = featureHealth(id, inputs, now) ?? describeHealth(rec, true, now);
				const row = health.createDiv({ cls: `reel-health-row is-${said.tone}` });
				row.createSpan({ cls: "reel-health-name", text: KEY_LABELS[id] ?? id });
				row.createSpan({ cls: "reel-health-said", text: said.text });
			}
		};

		new Setting(el)
			.setName("Test connections")
			.setDesc(
				nothingToTest
					? "Nothing to test yet. Save a key above and this will check it against the service."
					: sealed
						? "One small request per configured service. The keys are locked, so this asks for the passphrase first."
						: "One small request per configured service, so a mistyped key fails here rather than silently."
			)
			.addButton((b) => {
				/*
				 * The unlock is named on the button rather than sprung by it.
				 *
				 * Pressing Test while sealed used to reach for five keys it
				 * could not read, which put a passphrase modal over a screen
				 * nobody had asked it to and recorded five failures if you
				 * declined. The checks now decline to run instead, so the
				 * button has to say what it is going to do and then do it.
				 */
				/*
				 * Disabled rather than merely explained.
				 *
				 * The sentence beside it says there is nothing to test; a live
				 * button next to that sentence invites you to disagree with it,
				 * press, and get silence for an answer. The two have to agree.
				 */
				b.setDisabled(nothingToTest);
				return b.setButtonText(sealed ? "Unlock and test" : "Test").onClick(async () => {
					const label = sealed ? "Unlock and test" : "Test";
					b.setDisabled(true).setButtonText(sealed ? "Unlocking…" : "Testing…");
					if (sealed && !(await this.plugin.credentials.unlock())) {
						new Notice("Reel: keys stay locked, so nothing was tested.");
						b.setDisabled(false).setButtonText(label);
						return;
					}
					b.setButtonText("Testing…");
					await this.runTests();
					// A successful unlock changes the pills, the rows and this
					// button, so the whole tab is redrawn rather than patched.
					if (sealed) {
						this.display();
						return;
					}
					b.setDisabled(false).setButtonText(label);
					drawHealth();
					describe();
				});
			});

		el.appendChild(health);
		drawHealth();

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

		/*
		 * The one decision about encrypted storage that could not be revisited.
		 *
		 * Everything else on this screen can be changed after the fact: which
		 * mode, which keys, whether to keep any at all. The passphrase was fixed
		 * at whatever was typed the first time a key was saved — usually during
		 * setup, in a hurry, before anyone had decided how much this vault was
		 * worth protecting — and the documented answer to wanting a different
		 * one was to delete every key and fetch them all again from six
		 * services. So a passphrase you regret stayed in use.
		 *
		 * Shown while locked as well as unlocked, since the flow asks for the
		 * current phrase either way, and being locked is when you are most
		 * likely to be thinking about it.
		 */
		if (this.plugin.settings.keyMode === "encrypted" && this.plugin.settings.keyBlob) {
			new Setting(el)
				.setName("Change passphrase")
				.setDesc(
					"Asks for your current passphrase, then seals the same keys with a new one. The keys themselves are " +
						"unchanged, so nothing needs re-issuing. Forgotten the current one? Nothing here can recover it — " +
						"remove every key below and enter them again."
				)
				.addButton((b) =>
					b.setButtonText("Change").onClick(async () => {
						// Disabled but not relabelled. Every other button here
						// says "…ing" while it works; this one spends its whole
						// life waiting behind a modal for someone to type, and
						// "Changing…" under a prompt that has not been answered
						// yet would be claiming something that has not happened.
						b.setDisabled(true);
						let outcome: PassphraseChange;
						try {
							outcome = await store.changePassphrase();
						} catch (e) {
							// A reseal that could not be read back, or WebCrypto
							// missing. Either way the old passphrase still works,
							// and saying so is the useful half of the message.
							new Notice(`Reel: ${redact(e)} Your keys are unchanged, and the old passphrase still works.`);
							b.setDisabled(false);
							return;
						}
						b.setDisabled(false);
						if (outcome === "changed") {
							new Notice("Reel: passphrase changed. Your keys are unlocked for this session.");
							// The change unlocks, which moves the pills, the
							// Lock row and the health lines.
							this.display();
							return;
						}
						if (outcome === "wrong-passphrase") {
							new Notice("Reel: that passphrase didn't unlock the keys, so nothing was changed.");
							return;
						}
						if (outcome === "cancelled") new Notice("Reel: passphrase unchanged.");
					})
				);
		}

		if (store.hasStoredKey) {
			new Setting(el)
				.setName("Remove all keys")
				// The most destructive control on the screen was the one with
				// nothing written under it.
				.setDesc("Deletes every saved key from your vault. Reel cannot recover them; you would need each original key again.")
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
	/**
	 * Delegated to `ui/fields`, which the setup guides also use.
	 *
	 * These were private methods here, which is why every guide could tell you
	 * to paste a key "below" and have nothing below it — the field could not
	 * be drawn anywhere but on this screen.
	 */
	private keyField(el: HTMLElement, name: KeyName, label: string, desc: string): void {
		keyField(el, this.fieldCtx(), name, label, desc, { remove: true });
	}

	private fieldCtx(): FieldContext {
		return { app: this.app, plugin: this.plugin, onChanged: () => this.display() };
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

		traktAppField(el, this.fieldCtx(), { remove: true });

		if (!hasApp) return;

		/*
		 * "Signed in" used to mean "a token is stored", which stays true long
		 * after the session it refers to has expired — so the row cheerfully
		 * claimed you were connected and the first you heard otherwise was a
		 * review that would not post. The expiry was inside the token the
		 * whole time, unread.
		 */
		const now = Date.now();
		const session = traktState(signedIn, this.plugin.settings.traktExpires, now);
		const check = this.plugin.settings.connectionHealth.trakt;
		const said = describeTrakt(session, now, check);

		/*
		 * A refused token is as dead as an expired one, and this row is where
		 * you do something about it.
		 *
		 * `dead` decides both what the row is called and whether the sign-in
		 * button is offered at all. Revocation reaches neither the stored token
		 * nor its expiry, so without this a token Trakt has already refused
		 * would still be titled "Signed in to Trakt" with no way to fix it from
		 * the one row that exists to fix it.
		 */
		const refused = signedIn && check?.ok === false;
		const dead = session.kind === "expired" || refused;

		const signIn = async (): Promise<void> => {
			const app = await this.plugin.publish.app();
			if (!app) {
				new Notice("Reel: couldn't read the Trakt application.");
				return;
			}
			new TraktSignIn(this.app, this.plugin, app, (ok) => {
				if (ok) this.display();
			}).open();
		};

		/*
		 * Two ways to be dead, and they are not the same sentence.
		 *
		 * `dead` was widened to cover a refused token so the sign-in button
		 * would appear — which was right, and left this title still saying
		 * "expired" for a token whose expiry is months away. The status line
		 * directly underneath it says "Token refused", so the row contradicted
		 * itself: one state, two labels, disagreeing.
		 */
		const trakt = new Setting(el)
			.setName(
				refused
					? "Trakt refused this token"
					: dead
						? "Trakt session expired"
						: signedIn
							? "Signed in to Trakt"
							: "Sign in to Trakt"
			)
			.setDesc(
				signedIn
					? `${said.text}. Reel can post reviews and ratings as you; sign out to stop that immediately.`
					: "Trakt shows you a short code to type on any device. Nothing has to link back to this app."
			);

		// An expired session needs the way back in *and* the way out. Offering
		// only "Sign out" would make the fix be "break it further, then fix it".
		if (dead || !signedIn) {
			trakt.addButton((b) => b.setButtonText(dead ? "Sign in again" : "Sign in").setCta().onClick(signIn));
		}
		if (signedIn) {
			trakt.addButton((b) =>
				b.setButtonText("Sign out").onClick(async () => {
					await this.plugin.publish.signOut();
					new Notice("Reel: signed out of Trakt.");
					this.display();
				})
			);
		}
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

		this.modelField(el);

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

		this.folderField(el, "filmFolder", "Films folder", "One note per film.");
		this.folderField(el, "seriesFolder", "Series folder", "One note per show — not per season or episode.");
		this.folderField(el, "posterFolder", "Poster folder", "Shared by films and series.");
		this.folderField(
			el,
			"peopleFolder",
			"People folder",
			"Where director and cast links point. Naming the folder explicitly is what stops person notes appearing in your vault root when you tap an unresolved link."
		);

		el.createDiv({
			cls: "reel-callout",
			text:
				"Everything Reel writes lives under these four folders and its own plugin folder. " +
				"It never creates notes anywhere else — the daily-note link, if you turn it on, only appends to a note you already have.",
		});
	}


	/**
	 * Every folder in the vault, and every file, as two sets.
	 *
	 * Read once per render rather than per keystroke. A vault of ten thousand
	 * notes is a list of ten thousand strings, and rebuilding it on every
	 * character typed into a folder box is the kind of cost that does not show
	 * up until somebody with a real vault tries it.
	 */
	private vaultIndex(): { folders: Set<string>; files: Set<string>; all: string[] } {
		const folders = new Set<string>();
		const files = new Set<string>();
		/*
		 * Duck-typed rather than `instanceof TFolder`.
		 *
		 * The layout harness supplies its own vault, and making it construct
		 * real Obsidian classes in order to be recognised here would be the rig
		 * dictating the shape of the app. A folder is the thing with children.
		 */
		const loaded = this.app.vault.getAllLoadedFiles() as Array<{ path?: string; children?: unknown }>;
		for (const f of loaded ?? []) {
			if (!f?.path || f.path === "/") continue;
			if ("children" in f) folders.add(f.path);
			else files.add(f.path);
		}
		return { folders, files, all: [...folders] };
	}

	/**
	 * A folder setting that says what it is looking at.
	 *
	 * These four fields are the only place on this screen where being wrong is
	 * silent. A bad API key errors the moment it is used; a bad folder simply
	 * becomes a folder, and Reel goes on working perfectly while writing
	 * somewhere you are not looking. The symptom surfaces weeks later as "my
	 * films have stopped appearing", reported as a bug in the library.
	 *
	 * It cannot be validated away, because "I mistyped Movies" and "I want a
	 * folder that does not exist yet" are the same keystrokes, and the second
	 * is a legitimate thing to do. So the field does the two things it honestly
	 * can: say which of those two situations it is in, and offer the folders
	 * you already have, so the typo never has to be typed.
	 */
	private folderField(el: HTMLElement, key: FolderKey, name: string, desc: string): void {
		const vault = this.vaultIndex();
		const wrap = el.createDiv({ cls: "reel-folder-field" });
		let input: HTMLInputElement | null = null;

		// Typing "Movies" fired six saves and six full vault scans, each
		// briefly pointing the library at a folder named "M", then "Mo".
		// Settle first, then rebuild once.
		const apply = debounce(
			async (v: string) => {
				this.plugin.settings[key] = normaliseFolder(v) || DEFAULT_SETTINGS[key];
				await this.plugin.saveSettings();
				this.plugin.library.rebuild();
			},
			600,
			true
		);

		const status = document.createElement("div");
		/*
		 * The class matters. It was missing until 0.9.7, which meant every rule
		 * written for this container — the flex row, the wrapping, the gap
		 * between chips, hiding it when empty — had never applied to anything.
		 * With a single suggestion the result was indistinguishable from
		 * correct, which is exactly why a screenshot did not catch it.
		 */
		const list = document.createElement("div");
		list.className = "reel-folder-suggest";

		const refresh = (raw: string): void => {
			const state = folderState(raw, vault.folders, vault.files);
			const said = describeFolder(state, DEFAULT_SETTINGS[key]);
			status.setText(said.text);
			status.className = `reel-folder-status is-${said.tone}`;

			list.empty();
			/*
			 * Who gets suggestions, and it is not everybody.
			 *
			 * Once the folder exists the question is answered, and offering
			 * five neighbours underneath it spends a row of screen on a
			 * decision already made — four fields each doing that is most of
			 * the section. And an illegal character is fixed by deleting the
			 * character, so a list of folders there is an answer to a question
			 * nobody asked.
			 *
			 * That leaves the three states where you are looking for a folder
			 * and have not got one: it does not exist, it is empty, or a note
			 * is sitting on the name.
			 */
			const offer = state.kind === "new" || state.kind === "root" || state.kind === "collides";
			const here = normaliseFolder(raw);
			let hits = offer ? matchFolders(vault.all, raw).filter((path) => path !== here) : [];

			/*
			 * Never leave them with nothing.
			 *
			 * "Films" when the folder is called "Movies" is the case this whole
			 * feature was written for, and it matched nothing at all — quite
			 * correctly, since the two words share no letters in an order any
			 * matcher would care about. Correct and useless: the field said the
			 * folder would be created and offered no hint that the one you
			 * meant was sitting right there.
			 *
			 * So when the query finds nothing, fall back to showing what the
			 * vault actually has. This is a decision about not stranding
			 * somebody rather than a ranking rule, which is why it lives here
			 * and not inside `matchFolders` — that function should go on
			 * answering "what matches this" honestly, including "nothing".
			 */
			if (offer && !hits.length) {
				hits = matchFolders(vault.all, "").filter((path) => path !== here);
				/*
				 * This field's own default goes first, if the vault has it.
				 *
				 * The list is otherwise ordered shortest-path-first, which is
				 * a fine neutral order for browsing and a poor one to tap
				 * without reading: typing "Films" offered Music at the front,
				 * and the first chip is the one people take. The default for
				 * this particular setting is the best guess available, and it
				 * costs nothing to put it where the thumb already is.
				 */
				const preferred = DEFAULT_SETTINGS[key];
				if (hits.includes(preferred)) hits = [preferred, ...hits.filter((path) => path !== preferred)];
			}
			for (const path of hits) {
				const b = list.createEl("button", { cls: "reel-folder-chip", text: path });
				b.setAttr("aria-label", `Use folder ${path}`);
				b.addEventListener("click", () => {
					if (input) input.value = path;
					refresh(path);
					apply(path);
				});
			}
		};

		new Setting(wrap)
			.setName(name)
			.setDesc(desc)
			.addText((t) => {
				t.setValue(this.plugin.settings[key]).onChange((v) => {
					// Feedback is immediate; the save is not. Waiting 600ms to
					// be told whether the folder exists would make the answer
					// feel like it belonged to the previous keystroke.
					refresh(v);
					apply(v);
				});
				t.inputEl.addClass("reel-input");
				t.inputEl.spellcheck = false;
				input = t.inputEl;
			});

		const extra = wrap.createDiv({ cls: "reel-folder-extra" });
		extra.appendChild(status);
		extra.appendChild(list);

		refresh(this.plugin.settings[key]);
	}


	/**
	 * Check every configured service and write down what happened.
	 *
	 * Only the three that have a real test. OpenRouter, Trakt and Mastodon are
	 * deliberately absent rather than faked: reporting "not checked" about them
	 * is true, and inventing a request per service so the row has something to
	 * say would be three new network calls written to make a screen look
	 * complete.
	 *
	 * Errors go through `redact` even though the clients redact their own,
	 * because an error message can carry a request URL and a request URL can
	 * carry the key — and this one gets *persisted*, which is a longer life
	 * than a Notice ever had.
	 */
	private async runTests(): Promise<void> {
		/*
		 * The routing lives in `checks.ts` so the setup guides can run the same
		 * check on one feature. This used to be the only place in the plugin
		 * that knew how to verify anything, which put verification on a
		 * different screen from configuration.
		 */
		const failed = await checkAll(this.plugin, Date.now());
		new Notice(failed.length ? `Reel: ${failed.length} connection check failed.` : "Reel: all connections working.");
	}

	/**
	 * What this feature's connection is currently doing, if anything knows.
	 *
	 * Trakt is answered from its token's expiry rather than from a test,
	 * because that is a question the stored data can answer exactly and a
	 * network call could only approximate.
	 */
	private featureHealth(spec: FeatureSpec): { text: string; tone: "ok" | "warn" | "info" } | null {
		return featureHealth(spec.id, this.healthInputs(), Date.now());
	}

	/** What the shared router needs, gathered in the one place that has it. */
	private healthInputs(): HealthInputs {
		return {
			records: this.plugin.settings.connectionHealth,
			hasTrakt: this.plugin.credentials.has("trakt"),
			traktExpires: this.plugin.settings.traktExpires,
			locked: this.plugin.credentials.needsUnlock,
		};
	}


	/**
	 * The model slug, with something checking it.
	 *
	 * It was a free-text box. Reel does report a bad slug — the client turns
	 * OpenRouter's 404 into "No such model, check it in Settings" — but only
	 * once you have typed a question and waited to be refused. The screen where
	 * the string was typed, and where the answer would have saved the trip,
	 * said nothing at all.
	 *
	 * Most of what goes wrong is visible in the string: the vendor left off, a
	 * pasted URL, a name copied with its capitals. None of that needs the
	 * network, and it is checked as you type.
	 *
	 * What it never claims is that a model does not exist. That is OpenRouter's
	 * to say, and a check that guessed would reject every model released after
	 * this release.
	 */
	private modelField(el: HTMLElement): void {
		const wrap = el.createDiv({ cls: "reel-model-field" });
		let input: HTMLInputElement | null = null;

		const save = debounce(async (v: string) => {
			this.plugin.settings.aiModel = v.trim() || DEFAULT_SETTINGS.aiModel;
			await this.plugin.saveSettings();
		}, 500);

		const status = document.createElement("div");
		/*
		 * The class matters. It was missing until 0.9.7, which meant every rule
		 * written for this container — the flex row, the wrapping, the gap
		 * between chips, hiding it when empty — had never applied to anything.
		 * With a single suggestion the result was indistinguishable from
		 * correct, which is exactly why a screenshot did not catch it.
		 */
		const list = document.createElement("div");
		list.className = "reel-folder-suggest";

		/*
		 * Which of the two lists you are looking at.
		 *
		 * The chips render identically either way, and they are not the same
		 * thing at all: one is four names Reel carries and will eventually get
		 * wrong, the other is OpenRouter's live catalogue with today's prices.
		 * Fetching said so in a Notice that names the count and then takes it
		 * away, so a screen that had just pulled the real list looked exactly
		 * like one that never had — which is the same fault the connection
		 * results had before they were kept on screen.
		 *
		 * And the price is the whole reason to fetch. Not knowing whether the
		 * numbers in front of you are real is worse than having no numbers.
		 */
		const source = document.createElement("div");
		source.className = "reel-model-source";

		const refresh = (raw: string): void => {
			const problem = slugProblem(raw);
			source.setText(
				this.models
					? `${this.models.length} models from OpenRouter, priced as of this fetch.`
					: "Reel's own suggestions. Load the list for OpenRouter's full catalogue and current prices."
			);
			status.setText(problem ?? "Looks like a model slug");
			status.className = `reel-folder-status is-${problem ? "warn" : "ok"}`;

			list.empty();
			/*
			 * Suggestions from the live list once it has been fetched, and from
			 * the curated one before that. The curated list will age; it exists
			 * for the person staring at an empty box with no idea what belongs
			 * in it, which is a worse problem than a slightly dated hint.
			 */
			const pool = this.models ?? CURATED.map((c) => ({ id: c.id, name: c.why, prompt: null, completion: null }));
			const here = raw.trim().toLowerCase();
			const notMe = (m: ModelInfo): boolean => m.id.toLowerCase() !== here;

			/*
			 * Unlike a folder, a model is never known to be right.
			 *
			 * The folder field stops suggesting once the path resolves, because
			 * at that point the question is settled. Nothing here can settle it:
			 * all Reel knows is that the string is well *shaped*, and
			 * `anthropic/claude-3-haiku` is beautifully shaped and not a model.
			 * So the alternatives stay on screen, which is also the answer to
			 * the other question people have in this section — what else could
			 * I be using, and what would it cost.
			 */
			let hits = rankModels(pool, raw).filter(notMe);
			if (!hits.length) hits = rankModels(pool, "").filter(notMe);

			for (const m of hits) {
				const price = formatPrice(m.prompt);
				const b = list.createEl("button", { cls: "reel-folder-chip" });
				const top = b.createDiv();
				top.createSpan({ text: m.id });
				if (price) top.createSpan({ cls: "reel-model-price", text: ` · ${price}` });

				/*
				 * The subtitle carries different things in the two modes, on
				 * purpose. For a fetched model it is OpenRouter's human name
				 * ("Claude 3.5 Haiku"); for a curated one it is why that model
				 * is being recommended, which is the entire value of carrying a
				 * curated list rather than an empty box. Shown only when it
				 * says something the slug does not.
				 */
				if (m.name && m.name !== m.id) b.createDiv({ cls: "reel-model-why", text: m.name });
				b.setAttr("aria-label", `Use ${m.id}${price ? `, ${price} prompt tokens` : ""}`);
				b.addEventListener("click", () => {
					if (input) input.value = m.id;
					refresh(m.id);
					save(m.id);
				});
			}
		};

		new Setting(wrap)
			.setName("Model")
			.setDesc(
				"An OpenRouter model slug. The job is ranking sixty one-line summaries, which a small fast model does as well as a large one and far more cheaply."
			)
			.addText((t) => {
				t.setPlaceholder(DEFAULT_SETTINGS.aiModel)
					.setValue(this.plugin.settings.aiModel)
					.onChange((v) => {
						refresh(v);
						save(v);
					});
				t.inputEl.addClass("reel-input");
				t.inputEl.spellcheck = false;
				input = t.inputEl;
			})
			.addButton((b) =>
				b.setButtonText(this.models ? "Reload" : "Load list").onClick(async () => {
					b.setDisabled(true).setButtonText("Loading…");
					const got = await this.plugin.ai.models();
					b.setDisabled(false).setButtonText("Reload");
					if (!got.length) {
						new Notice("Reel: couldn't reach OpenRouter's model list.");
						return;
					}
					this.models = got;
					new Notice(`Reel: ${got.length} models available.`);
					refresh(input?.value ?? this.plugin.settings.aiModel);
				})
			);

		const extra = wrap.createDiv({ cls: "reel-folder-extra" });
		extra.appendChild(status);
		extra.appendChild(source);
		extra.appendChild(list);

		refresh(this.plugin.settings.aiModel);
	}


	/**
	 * The daily note folder, checked against where the daily notes are.
	 *
	 * Reel appends to today's daily note if there is one and never creates it,
	 * which is deliberate and stays. The gap this closes is one level down:
	 * every part of that behaviour hangs on a folder path typed into a box,
	 * and nothing checked it against the vault. Point it at "Journal" when
	 * yours live in "Daily" and the toggle stays on, nothing errors, and the
	 * feature simply never fires — because "no daily note today" and "wrong
	 * folder" produce exactly the same silence.
	 *
	 * They are different situations and the vault knows which one you are in.
	 */
	private dailyFolderField(el: HTMLElement): void {
		// One scan per render, off the same vault index the folder fields use.
		const scan = scanDaily([...this.vaultIndex().files]);
		const today = todayISO();
		const wrap = el.createDiv({ cls: "reel-folder-field" });
		let input: HTMLInputElement | null = null;

		const apply = debounce(
			async (v: string) => {
				this.plugin.settings.dailyNoteFolder = normaliseFolder(v);
				await this.plugin.saveSettings();
			},
			600,
			true
		);

		const status = document.createElement("div");
		const list = document.createElement("div");
		list.className = "reel-folder-suggest";

		const refresh = (raw: string): void => {
			const said = dailyStatus(raw, scan, today);
			status.setText(said.text);
			status.className = `reel-folder-status is-${said.tone}`;

			list.empty();
			// Only worth offering when the current answer is wrong. Once the
			// folder holds dated notes, the question is settled.
			const here = normaliseFolder(raw);
			const hits = said.tone === "warn" ? suggestDailyFolders(scan).filter((f) => f !== here) : [];
			for (const folder of hits) {
				const b = list.createEl("button", { cls: "reel-folder-chip", text: folder || "(vault root)" });
				b.setAttr("aria-label", `Use ${folder || "the vault root"}`);
				b.addEventListener("click", () => {
					if (input) input.value = folder;
					refresh(folder);
					apply(folder);
				});
			}
		};

		new Setting(wrap)
			.setName("Daily note folder")
			.setDesc(
				"Where your daily notes live — leave empty for the vault root. Files must be named YYYY-MM-DD.md. " +
					"Reel asks rather than reading the Daily Notes plugin's configuration, which is undocumented API."
			)
			.addText((t) => {
				// Cheaper than the folder inputs — no rescan — but it still
				// rewrote data.json, which holds your encrypted keys, once per
				// keypress.
				t.setPlaceholder("e.g. Journal/Daily")
					.setValue(this.plugin.settings.dailyNoteFolder)
					.onChange((v) => {
						refresh(v);
						apply(v);
					});
				t.inputEl.addClass("reel-input");
				t.inputEl.spellcheck = false;
				input = t.inputEl;
			});

		const extra = wrap.createDiv({ cls: "reel-folder-extra" });
		extra.appendChild(status);
		extra.appendChild(list);

		refresh(this.plugin.settings.dailyNoteFolder);
	}

	/**
	 * The prefix, with the line it produces shown underneath.
	 *
	 * Its effect was invisible until the next time you happened to log a film
	 * and then went and opened a different note. A preview costs nothing and
	 * answers "what will this do" at the moment somebody is asking it.
	 */
	private dailyPrefixField(el: HTMLElement): void {
		const wrap = el.createDiv({ cls: "reel-folder-field" });
		const preview = document.createElement("div");
		preview.className = "reel-daily-preview";

		const apply = debounce(
			async (v: string) => {
				this.plugin.settings.dailyNotePrefix = v || "- Watched";
				await this.plugin.saveSettings();
			},
			600,
			true
		);

		new Setting(wrap)
			.setName("Daily note line prefix")
			.setDesc("What Reel writes in front of the link.")
			.addText((t) => {
				t.setValue(this.plugin.settings.dailyNotePrefix).onChange((v) => {
					preview.setText(previewLine(v));
					apply(v);
				});
				t.inputEl.addClass("reel-input");
			});

		const extra = wrap.createDiv({ cls: "reel-folder-extra" });
		extra.appendChild(preview);
		preview.setText(previewLine(this.plugin.settings.dailyNotePrefix));
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

		this.dailyFolderField(el);
		this.dailyPrefixField(el);
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
			.setDesc("Jump straight to a title's note once it is created, instead of staying where you are.")
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
