/** 5-star scale with halves. Stored as a number 0.5–5 in 0.5 steps. */

export const MAX_STARS = 5;
export const STEP = 0.5;

export function clampRating(value: number): number {
	const snapped = Math.round(value / STEP) * STEP;
	return Math.min(MAX_STARS, Math.max(0, snapped));
}

/** "★★★★½" — used in the header card and grid overlays. */
export function starString(rating: number | undefined): string {
	if (rating == null || rating <= 0) return "";
	const r = clampRating(rating);
	const full = Math.floor(r);
	const half = r - full >= STEP;
	return "★".repeat(full) + (half ? "½" : "");
}

/** Bucket a rating into the ten half-star slots, for the stats histogram. */
export function ratingBucket(rating: number): number {
	return clampRating(rating);
}

export function formatRating(rating: number | undefined): string {
	if (rating == null) return "—";
	return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}
