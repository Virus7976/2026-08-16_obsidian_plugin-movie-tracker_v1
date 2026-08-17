/**
 * Telling failures apart.
 *
 * Every network failure in Reel surfaced as the same redacted error notice,
 * whether TMDB was down, the key was wrong, or the phone was in a tunnel. The
 * three need completely different responses, and only one of them is a
 * problem with the app:
 *
 *   Offline — nothing is broken. The library, the diary and every chart are
 *   computed from frontmatter and work exactly as well as they did a moment
 *   ago. Saying "error" here is actively misleading.
 *
 *   Bad key — retrying will fail identically forever. The only useful thing
 *   to offer is the settings screen.
 *
 *   Rate limited or a server fault — transient, and retrying in a moment is
 *   exactly the right move.
 *
 * Pure, so the classification can be tested without a network. The decision
 * here is what a user reads at the moment something goes wrong, which makes
 * getting it wrong unusually expensive: a wrong diagnosis sends someone to
 * check their API key when their wifi is off.
 */

export type FailureKind = "offline" | "auth" | "rate" | "server" | "missing" | "unknown";

export interface Diagnosis {
	kind: FailureKind;
	/** What to say. Plain, and never blaming the user's setup unless it is the cause. */
	message: string;
	/** Whether trying the same thing again could plausibly work. */
	retryable: boolean;
	/** Whether the useful next step is the settings screen rather than a retry. */
	settings?: boolean;
}

/**
 * Work out what actually went wrong.
 *
 * `online` is passed in rather than read from `navigator` so this stays pure.
 * It is checked first and beats everything else: an offline device produces
 * assorted low-level errors depending on platform and timing, and any of them
 * would otherwise be reported as a server fault.
 *
 * `navigator.onLine` is only ever trusted in the negative direction. False
 * means genuinely no network interface; true means "there is an interface",
 * which a captive portal or a dead router also satisfies. So being told we
 * are online is never used to rule the offline case back in — that is why a
 * failed request while nominally online still lands on a plain retry rather
 * than a confident diagnosis.
 */
export function diagnose(status: number | undefined, online: boolean): Diagnosis {
	if (!online) {
		return {
			kind: "offline",
			message: "You're offline. Your library, diary and stats all still work — only new lookups need a connection.",
			retryable: true,
		};
	}

	if (status === 401 || status === 403) {
		return {
			kind: "auth",
			message: "TMDB rejected the key. Check it in Settings → Reel.",
			// Retrying an unchanged bad key fails identically every time, so
			// offering it would be a button that cannot work.
			retryable: false,
			settings: true,
		};
	}

	if (status === 404) {
		return {
			kind: "missing",
			message: "TMDB has no record of that. It may have been merged or removed.",
			retryable: false,
		};
	}

	if (status === 429) {
		return {
			kind: "rate",
			message: "TMDB is rate limiting. Wait a few seconds and try again.",
			retryable: true,
		};
	}

	if (status != null && status >= 500) {
		return {
			kind: "server",
			message: "TMDB is having trouble. Nothing wrong on your end.",
			retryable: true,
		};
	}

	return {
		kind: "unknown",
		message: "That didn't work.",
		retryable: true,
	};
}

/**
 * Whether a diagnosis is worth interrupting someone for.
 *
 * Background work — a poster backfill, an enrichment pass — failing because
 * the device is offline is not news. The screen already works; a notice
 * saying so is noise on top of a state the user chose.
 */
export function worthReporting(kind: FailureKind, background: boolean): boolean {
	if (!background) return true;
	return kind !== "offline";
}
