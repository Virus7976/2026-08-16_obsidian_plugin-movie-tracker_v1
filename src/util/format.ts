/** Small display formatters shared across surfaces. */

/**
 * 1240000 → "1.2M", 4300 → "4K".
 *
 * Vote counts are scale, not precision: nobody reads the difference between
 * 1,243,187 and 1,243,904, and the exact figure crowds out the score it is
 * meant to qualify.
 *
 * Lives here rather than beside its first caller because both the detail hero
 * and the list layout show vote counts, and two implementations of the same
 * rounding would eventually disagree in front of the reader.
 */
export function compactCount(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return "";
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
	return String(Math.round(n));
}
