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
import { normaliseHost } from "./publish/mastodon";

export type FeatureId = "tmdb" | "omdb" | "dtdd" | "openrouter" | "trakt" | "mastodon";

/**
 * What a step can be proved by: a stored credential, or Mastodon's server.
 *
 * A union rather than widening to `string`, so a typo in a spec is a compile
 * error rather than a step that can never tick.
 */
export type StepProof = KeyName | "mastodonHost";

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
	/**
	 * What this step produces, when it produces something checkable.
	 *
	 * Only the steps that end in something being saved carry this, because
	 * those are the only ones the plugin can actually verify. Reel cannot know
	 * whether you have read a paragraph or opened a website; it knows exactly
	 * whether the thing that step asks for is now in the vault.
	 *
	 * Not every such thing is a credential. Mastodon's server address is a
	 * plain setting — not secret, not encrypted — and it was the one piece of
	 * observable progress in that walkthrough that could tick nothing, because
	 * this field only admitted key names. Which left a five-step guide with no
	 * middle: nothing was behind you until the very last paste.
	 */
	key?: StepProof;
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
				key: "tmdb",
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
			{ text: "Paste the key below and press Save.", key: "omdb" },
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
			{ text: "Paste the key below and press Save.", key: "dtdd" },
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
			{ text: "Paste it below, press Save, then turn Ask on.", key: "openrouter" },
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
			{
				text: "Save the application, then copy its Client ID and Client Secret into the two fields below.",
				key: "traktApp",
			},
			{
				text: "Press Sign in. Trakt shows a short code — type it on any device, and Reel waits for you.",
				key: "trakt",
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
			/*
			 * Two steps, because they were two actions.
			 *
			 * "Enter your instance's address and paste the token below" asked
			 * for both in one line and could only be ticked by the token, so
			 * somebody who had typed their server and gone off to make a token
			 * came back to a guide reporting nothing done at all. The address
			 * is the one thing in this walkthrough Reel can watch you do.
			 */
			{ text: "Enter your instance's address below.", key: "mastodonHost" },
			{ text: "Paste the access token below.", key: "mastodon" },
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
/**
 * How many of a guide's steps are demonstrably behind you.
 *
 * Coming back to a walkthrough is the normal way to use one. Half of these
 * steps happen on somebody else's website, so you leave, do the thing, and
 * return to 2,700px of instructions that look exactly as they did before you
 * started — and the one question you have, which is "where was I", is the one
 * the screen does not answer.
 *
 * Only steps that end in a saved credential can be checked directly. The rest
 * are inferred, and soundly: you cannot be holding a Trakt client secret
 * without having created the application it belongs to, so a satisfied step
 * settles every step before it. That makes the whole list meaningful from the
 * two or three points the plugin can actually observe.
 *
 * Counts from the *last* satisfied step, not the first unsatisfied one. A
 * feature can be finished out of order — signing in before pasting a key that
 * was already there — and stopping at the first gap would report a guide as
 * barely begun when it is done.
 */
export function completedSteps(spec: FeatureSpec, has: (key: StepProof) => boolean): number {
	let done = 0;
	spec.steps.forEach((step, i) => {
		if (step.key && has(step.key)) done = i + 1;
	});
	return done;
}

export function isConfigured(plugin: ReelPlugin, spec: FeatureSpec): boolean {
	return spec.keys.every((k) => plugin.credentials.has(k));
}

/**
 * Is the thing a step produces in the vault?
 *
 * The one place that knows what proves what, because there is now more than one
 * kind of proof and two screens were about to disagree about it. Credentials are
 * asked of the stored *names*, never the values, so every question here can be
 * answered while the vault is locked — which is the whole reason an honest
 * picture can be drawn before anybody is asked for a passphrase.
 */
export function proves(plugin: ReelPlugin, k: StepProof): boolean {
	if (k === "mastodonHost") return Boolean(normaliseHost(plugin.settings.mastodonHost));
	return plugin.credentials.has(k);
}

/**
 * Has setup been begun but not finished?
 *
 * Asked of the steps rather than of the credentials, which is not a
 * simplification — it is the fix for two screens disagreeing.
 *
 * This used to read "Trakt is the only one that can be", and that was true
 * while a credential was the only observable thing. It stopped being true the
 * moment Mastodon's server address could tick a step: the guide would show five
 * of six steps behind you while the row on the settings tab that opens it said
 * "Not set up", because the row asked about tokens and the guide asked about
 * progress. Both were describing the same vault.
 *
 * Deriving both from the step list is what stops that recurring. A feature is
 * half done when something a step asks for is there and the feature still is
 * not ready, whatever kind of thing that was.
 */
export function isPartial(plugin: ReelPlugin, spec: FeatureSpec): boolean {
	if (isConfigured(plugin, spec)) return false;
	return spec.steps.some((s) => s.key && proves(plugin, s.key));
}

/**
 * The half-finished features, as a phrase you can read.
 *
 * `setupState` has computed `partial` since it was written and nothing ever
 * rendered it in aggregate. The rows showed it one at a time; both summaries
 * counted only what was finished, so a vault two minutes from having Mastodon
 * working said "4 of 5 optional features on" and stopped there.
 *
 * Which loses the most actionable fact on the screen. "Not on" and "nearly on"
 * ask completely different things of you, and the line you read when the
 * section is folded — which is every time, once TMDB is in — could not tell
 * them apart.
 *
 * Named rather than counted while there are few enough to name: "Mastodon is
 * half set up" is something you can act on, "1 half set up" is a puzzle.
 */
export function partialPhrase(partial: FeatureSpec[]): string {
	if (!partial.length) return "";
	if (partial.length === 1) return `${partial[0].name} is half set up`;
	if (partial.length === 2) return `${partial[0].name} and ${partial[1].name} are half set up`;
	return `${partial.length} are half set up`;
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
