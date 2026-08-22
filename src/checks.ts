/**
 * Running one feature's connection check, and knowing when there is a point.
 *
 * The checks themselves live with the clients that own them — OMDb knows how
 * to test an OMDb key. What was missing is the layer above: which features can
 * be checked, what has to be true before checking one is meaningful, and how
 * the answer becomes a record. That lived inline in the settings screen's Test
 * button, which made it the only place in the plugin that could check
 * anything.
 *
 * That is the wrong place for it. Verification belongs where configuration
 * happens — at the end of the walkthrough that just asked you to paste a key,
 * not on another screen behind a button that tests all six of them. Pulling
 * the routing out here is what lets both call it, and means there is one
 * answer to "is this thing working" rather than two that can drift.
 *
 * The preconditions are the interesting part and they are not uniform. A check
 * with nothing to check reports a failure about a state you are not in, which
 * is worse than staying quiet.
 */

import type ReelPlugin from "./main";
import type { HealthRecord } from "./health";
import { TESTABLE } from "./health";
import { normaliseHost } from "./publish/mastodon";
import { redact } from "./secrets";
import type { FeatureId } from "./setup";

export type CheckOutcome = { ok: true; proves?: string; note?: string } | { ok: false; error: string };

/**
 * Is there anything to check yet?
 *
 * Per feature, because the answer is not "has a key been saved" in every case.
 * Mastodon is checked by its server address rather than by its token, on
 * purpose, so a token is the wrong precondition for it — somebody who has
 * typed a server and not yet made a token is exactly who benefits most from
 * finding out the address is wrong.
 */
export function checkable(plugin: ReelPlugin, id: FeatureId): boolean {
	if (!TESTABLE.includes(id)) return false;
	switch (id) {
		/*
		 * TMDB was excepted here on the grounds that its key "may be built in",
		 * so there was always something to ask about. There is no built-in key.
		 * `testCredentials` raises a missing-key error and returns a failure,
		 * which is why the same install says Reel needs a key before it can do
		 * anything.
		 *
		 * The cost of that landed on the first screen of the product. A brand
		 * new install opening the one required guide was offered "Check now"
		 * above a status line reading "Not checked yet", and pressing it
		 * reported a broken connection to somebody who had not yet been given
		 * the chance to set one up. Pressing Test connections on the settings
		 * screen recorded the same failure.
		 *
		 * So TMDB is checkable on the same terms as everything else, and the
		 * exception is gone rather than special-cased further.
		 */
		case "mastodon":
			return Boolean(normaliseHost(plugin.settings.mastodonHost));
		default:
			return plugin.credentials.has(id);
	}
}

/** The client call behind each id. Nothing else in the plugin should know this. */
async function run(plugin: ReelPlugin, id: FeatureId): Promise<CheckOutcome> {
	switch (id) {
		case "tmdb":
			return plugin.tmdb.testCredentials();
		case "omdb":
			return plugin.omdb.test();
		case "dtdd":
			return plugin.dtdd.test();
		case "openrouter":
			return plugin.ai.test();
		case "mastodon":
			return plugin.publish.mastodon.test();
		case "trakt":
			return plugin.publish.trakt.test();
		default:
			return { ok: false, error: "Nothing to check." };
	}
}

/**
 * Check one feature and write down what happened.
 *
 * Returns null when there was nothing to check, which the caller renders as
 * silence rather than as a result.
 *
 * `now` is passed in so a set of checks run together share one timestamp, and
 * because everything else in this area takes its clock as an argument.
 */
export async function checkFeature(plugin: ReelPlugin, id: FeatureId, now: number): Promise<HealthRecord | null> {
	if (!checkable(plugin, id)) return null;

	let out: CheckOutcome;
	try {
		out = await run(plugin, id);
	} catch (e) {
		// A client that throws rather than returning is still an answer, and
		// losing it would leave the row saying "not checked yet" forever.
		// redact: the message can carry a request URL and a URL can carry a key.
		out = { ok: false, error: redact(e) };
	}

	const rec: HealthRecord = out.ok
		? { at: now, ok: true, ...(out.proves ? { proves: out.proves } : {}), ...(out.note ? { note: out.note } : {}) }
		: { at: now, ok: false, error: redact(out.error) };

	plugin.settings.connectionHealth[id] = rec;
	return rec;
}

/**
 * Check everything there is to check, at once.
 *
 * Concurrently, which is not a micro-optimisation here: this went from three
 * services to six, and run in series that is six round trips to six different
 * hosts with a spinner in front of them. They share no rate limit and no
 * dependency, so the only thing serialising them bought was a longer wait.
 *
 * One `saveSettings` at the end rather than one per check, because that file
 * holds your encrypted keys and rewriting it six times to record six booleans
 * is work nobody asked for.
 */
export async function checkAll(plugin: ReelPlugin, now: number): Promise<FeatureId[]> {
	const ids = TESTABLE.filter((id) => checkable(plugin, id));
	await Promise.all(ids.map((id) => checkFeature(plugin, id, now)));
	await plugin.saveSettings();
	return ids.filter((id) => plugin.settings.connectionHealth[id]?.ok === false);
}
