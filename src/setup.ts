/**
 * What Reel needs, what it has, and how a person gets from one to the other.
 *
 * Setting this plugin up has always been possible and never been guided. A new
 * install opens Settings, finds forty-nine controls, and has no way to tell
 * that three of them matter and forty-six have sensible defaults. The
 * instructions existed — buried in `setDesc` strings, a paragraph at a time,
 * next to the field they described — which works if you already know you are
 * looking at the important one.
 *
 * So the steps are data here rather than prose there. That buys three things,
 * and the third is the one that matters most:
 *
 *   One walkthrough component renders every feature, so a new service gets a
 *   guided setup for free instead of a fourth hand-written variation.
 *
 *   The settings screen can ask questions it could not ask before — how much
 *   is set up, what is missing, is this off because you declined it or off
 *   because you never got to it.
 *
 *   A test can check that every feature has steps at all. "Seamless for any
 *   feature" is not a thing you achieve once; it is a thing that decays the
 *   next time somebody adds a service in a hurry, and the only defence is
 *   something that fails when they do.
 *
 * Nothing here performs setup. It describes it, and reports on it.
 */

import type ReelPlugin from "./main";
import type { KeyName } from "./credentials";

export type FeatureId = "tmdb" | "omdb" | "dtdd" | "openrouter" | "trakt" | "mastodon";

export interface SetupStep {
	/** One instruction, imperative, in the order you do it. */
	text: string;
	/** Where to go, if this step happens somewhere else. */
	url?: string;
	/**
	 * A literal you must type exactly, offered with a copy button.
	 *
	 * Redirect URIs and OAuth scopes are the two things people get wrong, and
	 * both are unforgiving strings that mean nothing to read. Showing one as
	 * prose and hoping is how a setup fails at the last step with an error
	 * message from somebody else's website.
	 */
	copy?: string;
	/** A caution or an aside. Rendered quieter than the instruction. */
	note?: string;
}

export interface FeatureSpec {
	id: FeatureId;
	name: string;
	/** What you get, said in terms of the app rather than the service. */
	gives: string;
	/** Reel cannot function without it. Exactly one feature is. */
	essential: boolean;
	/** Roughly how long the setup takes, so nobody starts one blind. */
	effort: string;
	/**
	 * What leaves your vault once this is on.
	 *
	 * Stated per feature and shown before the first step, not in a policy
	 * document. A person deciding whether to switch something on is the person
	 * who should be told, at the moment they are deciding.
	 */
	sends: string;
	/** Which stored credentials this feature owns. */
	keys: KeyName[];
	steps: SetupStep[];
}

/**
 * Every feature Reel can be given, in the order worth doing them.
 *
 * TMDB first because nothing works without it. Then the two that enrich what
 * you already have, then the three that reach outside the vault — which is
 * also, not by coincidence, ascending order of how much they ask of you.
 */
export const FEATURES: FeatureSpec[] = [
	{
		id: "tmdb",
		name: "TMDB",
		gives: "Everything. Posters, cast, runtimes, episode lists — Reel cannot add a title without it.",
		essential: true,
		effort: "2 minutes, free",
		sends: "The title you search for, or its TMDB id. Nothing about your library.",
		keys: ["tmdb"],
		steps: [
			{
				text: "Create a free TMDB account, if you don't have one.",
				url: "https://www.themoviedb.org/signup",
			},
			{
				text: "Open your API settings and request a key. Pick “Developer”, and answer the form — any personal or hobby use is fine.",
				url: "https://www.themoviedb.org/settings/api",
			},
			{
				text: "Copy the API Read Access Token — the long one starting eyJ, not the short v3 key.",
				note: "The token travels in a request header; the v3 key has to go in the URL, and URLs end up in logs. Reel accepts either, but this one is safer.",
			},
			{
				text: "Paste it below and press Save. You'll be asked for a passphrase — that encrypts the key inside your vault.",
			},
		],
	},
	{
		id: "omdb",
		name: "OMDb",
		gives: "IMDb ratings, Rotten Tomatoes and Metacritic scores on every title.",
		essential: false,
		effort: "1 minute, free",
		sends: "A film's IMDb id, when a note is created or refreshed.",
		keys: ["omdb"],
		steps: [
			{
				text: "Request a free key. The FREE tier is 1,000 requests a day, which Reel's cache makes ample.",
				url: "https://www.omdbapi.com/apikey.aspx",
			},
			{
				text: "Check your email and click the activation link. The key does not work until you do.",
				note: "This one catches people out — the key arrives before it is active.",
			},
			{ text: "Paste the key below and press Save." },
		],
	},
	{
		id: "dtdd",
		name: "DoesTheDogDie",
		gives: "Content warnings voted on per topic, so you can tell one upsetting scene from a film full of them.",
		essential: false,
		effort: "A few minutes, free — they approve by hand",
		sends: "A film's title and year.",
		keys: ["dtdd"],
		steps: [
			{
				text: "Request an API key. Say what it's for — a personal Obsidian film tracker is a fine answer.",
				url: "https://www.doesthedogdie.com/api",
			},
			{
				text: "Wait for the reply. A person reads these, so it is not instant.",
				note: "Everything else in Reel works meanwhile. Content filtering falls back to TMDB keywords until the key arrives.",
			},
			{ text: "Paste the key below and press Save." },
		],
	},
	{
		id: "openrouter",
		name: "OpenRouter",
		gives: "Ask — describe what you feel like watching and Reel finds it in your own library.",
		essential: false,
		effort: "2 minutes, and you pay per question",
		sends:
			"Your question, plus a shortlist of titles from your library — names, years, genres, runtimes and your ratings. " +
			"Never your reviews, your watch dates or your file paths.",
		keys: ["openrouter"],
		steps: [
			{ text: "Create an OpenRouter account.", url: "https://openrouter.ai/" },
			{
				text: "Add some credit. Questions cost a fraction of a penny each on the default model.",
				url: "https://openrouter.ai/credits",
				note: "Reel shows what every question cost in tokens, so this is checkable rather than a mystery bill.",
			},
			{ text: "Create an API key and copy it.", url: "https://openrouter.ai/keys" },
			{ text: "Paste it below, press Save, then turn Ask on." },
		],
	},
	{
		id: "trakt",
		name: "Trakt",
		gives: "Publishing a review to a public film profile, with your star rating alongside.",
		essential: false,
		effort: "5 minutes, free",
		sends: "Only what you explicitly publish: one review's text, your rating, and the title's id. Nothing automatic.",
		keys: ["traktApp", "trakt"],
		steps: [
			{ text: "Create a Trakt account, if you don't have one.", url: "https://trakt.tv/auth/join" },
			{
				text: "Create an application. Any name will do — it is yours and nobody else sees it.",
				url: "https://trakt.tv/oauth/applications/new",
				note: "Reel asks you to register your own rather than shipping one, because Trakt's sign-in needs a client secret, and a secret compiled into an open-source plugin is printed in the repository for anyone to read.",
			},
			{
				text: "Set the Redirect URI to exactly this:",
				copy: "urn:ietf:wg:oauth:2.0:oob",
				note: "This is the standard value for an app with no website to return to. Getting it wrong is the usual reason sign-in fails.",
			},
			{ text: "Save the application, then copy its Client ID and Client Secret into the two fields below." },
			{
				text: "Press Sign in. Trakt shows a short code — type it on any device, and Reel waits for you.",
				note: "No redirect back to the app is needed, which is what makes this work on a phone at all.",
			},
		],
	},
	{
		id: "mastodon",
		name: "Mastodon",
		gives: "Publishing a review as a public post, with the title, your stars and the text.",
		essential: false,
		effort: "3 minutes, free",
		sends: "Only what you explicitly publish: one post. Nothing automatic.",
		keys: ["mastodon"],
		steps: [
			{
				text: "Open your instance's development settings — that's your own server, e.g. mastodon.social/settings/applications.",
				note: "Reel needs the server you post from; there is no central Mastodon.",
			},
			{ text: "Create a new application. Any name and website will do." },
			{
				text: "Tick only this scope, and untick the rest:",
				copy: "write:statuses",
				note: "The defaults include read access to your whole timeline and follow list. Reel never needs either, and a token that can only post is a token that can only post.",
			},
			{ text: "Submit, open the application, and copy “Your access token”." },
			{ text: "Enter your instance's address and paste the token below." },
		],
	},
];

export function featureById(id: FeatureId): FeatureSpec | undefined {
	return FEATURES.find((f) => f.id === id);
}

/**
 * Is this feature ready to use?
 *
 * Asked of the stored credential *names*, never of the values, so it can be
 * answered while the vault is locked — which matters, because the whole point
 * is showing an honest picture before asking anybody for a passphrase.
 *
 * Every key a feature lists must be present. Trakt has two, and having the
 * application without having signed in is a real and confusing halfway state
 * that used to render as simply "not set up".
 */
export function isConfigured(plugin: ReelPlugin, spec: FeatureSpec): boolean {
	return spec.keys.every((k) => plugin.credentials.has(k));
}

/** Has setup been begun but not finished? Trakt is the only one that can be. */
export function isPartial(plugin: ReelPlugin, spec: FeatureSpec): boolean {
	if (isConfigured(plugin, spec)) return false;
	return spec.keys.some((k) => plugin.credentials.has(k));
}

export interface SetupState {
	/** Optional features that are ready. */
	done: FeatureSpec[];
	/** Started and not finished. */
	partial: FeatureSpec[];
	/** Not started. */
	todo: FeatureSpec[];
	/** True when Reel cannot do anything at all yet. */
	blocked: boolean;
	/** The one feature Reel cannot run without. */
	essential: FeatureSpec;
}

/**
 * The whole picture, in one pass.
 *
 * Computed rather than stored. A cached "setup complete" flag is a flag that
 * goes stale the moment somebody removes a key, and then cheerfully tells them
 * everything is fine while nothing works.
 */
export function setupState(plugin: ReelPlugin): SetupState {
	const essential = FEATURES.find((f) => f.essential) as FeatureSpec;
	const done: FeatureSpec[] = [];
	const partial: FeatureSpec[] = [];
	const todo: FeatureSpec[] = [];

	for (const f of FEATURES) {
		if (f.essential) continue;
		if (isConfigured(plugin, f)) done.push(f);
		else if (isPartial(plugin, f)) partial.push(f);
		else todo.push(f);
	}

	return { done, partial, todo, blocked: !isConfigured(plugin, essential), essential };
}
