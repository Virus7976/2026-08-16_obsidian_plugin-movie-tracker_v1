/**
 * Content flags — "don't show me films with a lot of sex scenes or swearing".
 *
 * Read this before trusting the output, because the data underneath is weaker
 * than the feature sounds.
 *
 * TMDB has no structured content-advisory data. There is no field saying "this
 * film contains 14 uses of strong language". What exists is:
 *
 *   1. Certification (US: G / PG / PG-13 / R / NC-17, TV-14, TV-MA …). Assigned
 *      by a ratings board, present for most released titles, and by far the
 *      most reliable signal available. An R is an R.
 *   2. Keywords. Crowd-sourced free-text tags. When present they are specific
 *      ("female nudity", "sex scene"), but coverage is patchy and inconsistent
 *      — a film full of sex may carry no relevant keyword at all.
 *
 * So: certification is the dependable filter and keywords are a bonus. A title
 * with no flags means "nothing was tagged", NOT "nothing is there". The UI says
 * this too, because a filter that quietly under-reports is worse than none —
 * you would trust it and be caught out.
 *
 * Anything the plugin derives is written to `content_flags` in frontmatter,
 * where you can correct it by hand. Your edits win: `refreshMetadata` merges
 * rather than overwrites, so a flag you add stays added and one you delete
 * stays deleted.
 */

export type ContentFlag = "sex" | "nudity" | "profanity" | "violence" | "gore" | "drugs" | "horror";

export const CONTENT_FLAGS: ContentFlag[] = ["sex", "nudity", "profanity", "violence", "gore", "drugs", "horror"];

export const FLAG_LABELS: Record<ContentFlag, string> = {
	sex: "Sex",
	nudity: "Nudity",
	profanity: "Swearing",
	violence: "Violence",
	gore: "Gore",
	drugs: "Drugs",
	horror: "Horror",
};

/**
 * Keyword patterns per flag. Matched against TMDB keyword names, lowercased.
 * Substring matching, so "female nudity" and "male nudity" both hit "nudity".
 */
const KEYWORD_RULES: Record<ContentFlag, RegExp[]> = {
	sex: [/\bsex\b/, /sex scene/, /sexual/, /erotic/, /lovemaking/, /seduction/, /prostitut/, /brothel/, /orgy/, /affair/],
	nudity: [/nudity/, /nude/, /topless/, /full frontal/, /strip club/, /stripper/],
	profanity: [/profanity/, /swearing/, /obscenit/, /f-word/, /foul language/, /strong language/],
	violence: [/violence/, /violent/, /brutal/, /torture/, /massacre/, /shootout/, /war crime/],
	gore: [/gore\b/, /gory/, /dismember/, /decapitat/, /mutilat/, /splatter/, /body horror/],
	drugs: [/drug/, /cocaine/, /heroin/, /methamphetamine/, /addict/, /narcotic/],
	horror: [/horror/, /slasher/, /supernatural/, /haunting/, /demonic/, /zombie/],
};

/** Derive flags from a title's TMDB keywords. Empty means "nothing tagged". */
export function flagsFromKeywords(keywords: string[]): ContentFlag[] {
	const found = new Set<ContentFlag>();
	for (const raw of keywords) {
		const k = raw.toLowerCase();
		for (const flag of CONTENT_FLAGS) {
			if (KEYWORD_RULES[flag].some((re) => re.test(k))) found.add(flag);
		}
	}
	return CONTENT_FLAGS.filter((f) => found.has(f));
}

/* ------------------------------------------------------------------ */
/* Certification                                                       */
/* ------------------------------------------------------------------ */

/**
 * Rank certifications so `certification <= PG-13` is meaningful. Films and TV
 * share one scale here — crude, but it lets a single filter cover both, and the
 * alternative (two incomparable ladders) is worse to write queries against.
 *
 * 0 = all ages … 5 = adults only. Unknown returns null and never matches a
 * comparison, so an unrated title is never silently treated as safe.
 */
const CERT_RANK: Record<string, number> = {
	G: 0,
	"TV-Y": 0,
	"TV-Y7": 0,
	"TV-G": 0,
	PG: 1,
	"TV-PG": 1,
	"PG-13": 2,
	"TV-14": 2,
	R: 3,
	"TV-MA": 4,
	"NC-17": 5,
	X: 5,
};

export function certificationRank(cert: string | undefined): number | null {
	if (!cert) return null;
	const rank = CERT_RANK[cert.toUpperCase().trim()];
	return rank == null ? null : rank;
}

export function knownCertifications(): string[] {
	return Object.keys(CERT_RANK);
}

/** Pull the US certification out of `/movie` release_dates. */
export function certificationFromReleaseDates(data: unknown, region = "US"): string | undefined {
	const results = (data as { results?: { iso_3166_1?: string; release_dates?: { certification?: string }[] }[] })
		?.results;
	if (!Array.isArray(results)) return undefined;
	const row = results.find((r) => r.iso_3166_1 === region);
	const cert = row?.release_dates?.map((d) => d.certification).find((c) => c && c.trim());
	return cert?.trim() || undefined;
}

/** Pull the US rating out of `/tv` content_ratings. */
export function certificationFromContentRatings(data: unknown, region = "US"): string | undefined {
	const results = (data as { results?: { iso_3166_1?: string; rating?: string }[] })?.results;
	if (!Array.isArray(results)) return undefined;
	const row = results.find((r) => r.iso_3166_1 === region);
	return row?.rating?.trim() || undefined;
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

export interface ContentPolicy {
	/** Flags that cause a title to be hidden. */
	hideFlags: ContentFlag[];
	/** Hide anything ranked above this certification. Null disables. */
	maxCertification: string | null;
	/** Hide titles with no certification at all — strict mode. */
	hideUnrated: boolean;
}

export const DEFAULT_POLICY: ContentPolicy = {
	hideFlags: [],
	maxCertification: null,
	hideUnrated: false,
};

/**
 * Does this title breach the policy? Returns the reason, or null if it passes.
 * A reason string is returned rather than a boolean so the UI can say *why*
 * something is hidden — an unexplained empty grid reads as a bug.
 */
export function policyBreach(
	entry: { contentFlags: string[]; certification?: string },
	policy: ContentPolicy
): string | null {
	const hit = policy.hideFlags.find((f) => entry.contentFlags.includes(f));
	if (hit) return FLAG_LABELS[hit] ?? hit;

	if (policy.maxCertification) {
		const limit = certificationRank(policy.maxCertification);
		const actual = certificationRank(entry.certification);
		if (limit != null) {
			if (actual == null) {
				if (policy.hideUnrated) return "unrated";
			} else if (actual > limit) {
				return entry.certification ?? "certification";
			}
		}
	} else if (policy.hideUnrated && !entry.certification) {
		return "unrated";
	}

	return null;
}
