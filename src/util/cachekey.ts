/**
 * Turning a cache key into a filename that cannot collide.
 *
 * The old rule was `key.replace(/[^a-z0-9._-]/gi, "_")` — safe for a
 * filesystem, and lossy in a way that turned out to matter enormously. A
 * TMDB discover query joins genres with a comma for AND and a pipe for OR,
 * and *both characters sanitise to an underscore*:
 *
 *   with_genres=28,35  →  with_genres_28_35
 *   with_genres=28|35  →  with_genres_28_35
 *
 * So "action AND comedy" and "action OR comedy" shared one cache file. Run
 * the narrow one first and the broad one silently served the narrow one's
 * answer — including, if the narrow query legitimately matched nothing, a
 * cached zero. Nothing errored. The screen simply said there were no results
 * for a query with thousands.
 *
 * The fix is to keep the readable prefix for anyone looking in the folder,
 * and append a hash of the *whole* untouched key so two different queries can
 * never land on one file.
 */

/**
 * FNV-1a, 32-bit.
 *
 * Not cryptographic and does not need to be: the only requirement is that
 * two different strings almost never produce the same output, and that it is
 * cheap enough to run on every request. Chosen over writing the raw key as
 * hex because a 200-character filename is its own problem on Windows.
 */
export function hashKey(input: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		// The FNV prime, via shifts — a plain multiply overflows into float
		// territory and loses the low bits that carry most of the entropy.
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return h.toString(36).padStart(7, "0");
}

/**
 * A filename for a cache key: readable, safe, and unique.
 *
 * The prefix is truncated because it exists only so a person browsing the
 * cache folder can tell what a file is; the hash is what makes it correct.
 */
export function cacheFileName(key: string): string {
	const readable = key.replace(/[^a-z0-9._-]/gi, "_").slice(0, 60);
	return `${readable}-${hashKey(key)}.json`;
}
