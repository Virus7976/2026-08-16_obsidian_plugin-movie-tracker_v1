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

/**
 * The status a show should take, or `null` to leave it untouched.
 *
 * `total` of 0 means TMDB hasn't told us how many episodes exist, so no
 * conclusion can be drawn — a hand-written note shouldn't be reclassified on
 * the strength of a missing field.
 */
export function nextShowStatus(
	current: string | undefined,
	watchedCount: number,
	total: number
): "watching" | "completed" | null {
	if (FROZEN_STATUSES.has(String(current ?? ""))) return null;
	if (!Number.isFinite(total) || total <= 0) return null;
	return watchedCount >= total ? "completed" : "watching";
}
