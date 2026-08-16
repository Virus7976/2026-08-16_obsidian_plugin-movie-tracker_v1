/**
 * Episode range strings: "1-7", "1-5,7-9", "3", "".
 *
 * This is the compact form stored per season. It stays hand-editable at 200
 * episodes where a flat list of episode objects would not, and every progress
 * number the UI shows is derived from it — nothing is stored twice.
 */

export function parseRange(spec: string | undefined | null): number[] {
	if (!spec) return [];
	const out = new Set<number>();
	for (const part of String(spec).split(",")) {
		const chunk = part.trim();
		if (!chunk) continue;
		const m = chunk.match(/^(\d+)\s*-\s*(\d+)$/);
		if (m) {
			const lo = parseInt(m[1], 10);
			const hi = parseInt(m[2], 10);
			if (Number.isNaN(lo) || Number.isNaN(hi)) continue;
			// Tolerate a reversed range rather than silently dropping it.
			for (let i = Math.min(lo, hi); i <= Math.max(lo, hi); i++) out.add(i);
		} else if (/^\d+$/.test(chunk)) {
			out.add(parseInt(chunk, 10));
		}
	}
	return [...out].sort((a, b) => a - b);
}

/** Inverse of `parseRange`. Collapses consecutive runs back into "a-b". */
export function formatRange(episodes: number[]): string {
	const sorted = [...new Set(episodes)].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
	if (!sorted.length) return "";
	const parts: string[] = [];
	let start = sorted[0];
	let prev = sorted[0];
	for (let i = 1; i <= sorted.length; i++) {
		const cur = sorted[i];
		if (cur !== prev + 1) {
			parts.push(start === prev ? String(start) : `${start}-${prev}`);
			start = cur;
		}
		prev = cur;
	}
	return parts.join(",");
}

export function rangeCount(spec: string | undefined | null): number {
	return parseRange(spec).length;
}

export function inRange(spec: string | undefined | null, episode: number): boolean {
	return parseRange(spec).includes(episode);
}

export function addToRange(spec: string | undefined | null, episode: number): string {
	const eps = parseRange(spec);
	eps.push(episode);
	return formatRange(eps);
}

export function removeFromRange(spec: string | undefined | null, episode: number): string {
	return formatRange(parseRange(spec).filter((e) => e !== episode));
}

/** Highest contiguous episode watched from 1. Gaps stop the count. */
export function contiguousProgress(spec: string | undefined | null): number {
	const eps = parseRange(spec);
	let n = 0;
	for (const e of eps) {
		if (e === n + 1) n = e;
		else if (e > n + 1) break;
	}
	return n;
}

/** First episode not yet watched, ignoring gaps behind you. */
export function nextEpisode(spec: string | undefined | null, total: number): number | null {
	const watched = new Set(parseRange(spec));
	for (let i = 1; i <= Math.max(total, watched.size + 1); i++) {
		if (!watched.has(i)) return i <= total || total === 0 ? i : null;
	}
	return null;
}
