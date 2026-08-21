/**
 * Show status transitions.
 *
 * Pulled out as a pure function because the rule has more edges than it looks:
 * it has to flip a show to `completed` when the last episode is ticked, flip it
 * back to `watching` when a returning series gains a season, and leave several
 * states strictly alone. Getting the "leave alone" set wrong silently rewrites
 * the user's own decisions on every background refresh.
 */

/**
 * Statuses the plugin must never overwrite:
 *
 *   dropped / paused  — deliberate user decisions about a show they could
 *                       otherwise be "caught up" on.
 *   watchlist         — nothing has been watched, so the episode count is 0 and
 *                       the naive rule would read that as "in progress" and
 *                       promote every watchlisted show to `watching`.
 */
export const FROZEN_STATUSES = new Set(["dropped", "paused", "watchlist"]);

import { rangeCount } from "./ranges";

/**
 * The status a show should take, or `null` to leave it untouched.
 *
 * `total` of 0 means TMDB hasn't told us how many episodes exist, so no
 * conclusion can be drawn — a hand-written note shouldn't be reclassified on
 * the strength of a missing field.
 */
/**
 * Have you seen this, whatever it is labelled now?
 *
 * `status` is one field and can hold one value, so putting a film you have
 * already seen back on the watchlist to see it again overwrites the only
 * place the app recorded that you saw it — and it drops out of "watched"
 * entirely, as though it had never happened. That is the wrong shape for the
 * data: watching something is an event in your history, and a later intention
 * cannot un-happen it.
 *
 * Three signals, any one of which settles it:
 *
 *   a logged viewing   — a film with dates in `watched`
 *   episode progress   — a series with any episode ticked
 *   the label, or the memory of it — `status`, or the `seen` flag written
 *                        when that status was about to be overwritten
 *
 * The third matters more than it looks. Most of an imported library is marked
 * watched with no dates at all, so for those titles the label is the whole of
 * the evidence, and moving one to the watchlist would destroy it.
 */
export function hasBeenWatched(e: WatchedLike): boolean {
	if (e.seen === true) return true;
	if (e.status === "watched" || e.status === "completed") return true;
	if ((e.watched?.length ?? 0) > 0) return true;
	return episodesSeen(e) > 0;
}

/**
 * Have you finished it?
 *
 * A series is complete when you have seen as many episodes as it has, which is
 * the same arithmetic `nextShowStatus` does above — stated here as a question
 * about the past rather than as a label to assign. `total` of 0 means TMDB has
 * not said how many there are, and an unknown denominator proves nothing.
 *
 * Films have no notion of completion, so for them this is just the label.
 */
export function hasBeenCompleted(e: WatchedLike): boolean {
	if (e.status === "completed") return true;
	if (e.type !== "tv") return false;
	const total = e.totalEpisodes ?? 0;
	if (!Number.isFinite(total) || total <= 0) return false;
	return episodesSeen(e) >= total;
}

/**
 * Does this title match one ticked status box?
 *
 * "Watched" and "completed" are facts about your history and are answered from
 * the evidence. Everything else — watching, watchlist, paused, dropped — is
 * a claim about right now, and those are exclusive by design: a show cannot be
 * both paused and dropped, and asking for paused should not return the ones
 * you gave up on months ago.
 */
export function matchesStatus(e: WatchedLike, status: string): boolean {
	if (status === "watched") return hasBeenWatched(e);
	if (status === "completed") return hasBeenCompleted(e);
	return e.status === status;
}

/** Episodes ticked across every season. Zero for a film. */
function episodesSeen(e: WatchedLike): number {
	return (e.seasons ?? []).reduce((n, s) => n + rangeCount(s.watched), 0);
}

/**
 * The shape these three need, rather than the whole `Entry`.
 *
 * Declared structurally so the frontmatter path can answer the same question
 * before a note has been indexed — `setStatus` has to know whether a title
 * counted as watched at the moment it is about to stop saying so.
 */
export interface WatchedLike {
	type?: string;
	status?: string;
	seen?: boolean;
	watched?: unknown[];
	seasons?: { watched?: string }[];
	totalEpisodes?: number;
}

export function nextShowStatus(
	current: string | undefined,
	watchedCount: number,
	total: number
): "watching" | "completed" | null {
	if (FROZEN_STATUSES.has(String(current ?? ""))) return null;
	if (!Number.isFinite(total) || total <= 0) return null;
	return watchedCount >= total ? "completed" : "watching";
}
