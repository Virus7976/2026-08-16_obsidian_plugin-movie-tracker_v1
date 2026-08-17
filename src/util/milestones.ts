/**
 * A sense of time passing.
 *
 * Everything else Reel shows is a fact about now: what you're partway
 * through, what you rated, how many hours. None of it says anything about
 * *having kept a diary* — which is the actual reason to keep one. You already
 * have dated viewings going back as far as you have been logging, and nothing
 * ever looked at them backwards.
 *
 * Three things worth surfacing, in descending order of how often they fire:
 *
 *   On this day — you watched something a year ago today. Common enough to be
 *   a recurring pleasure once a diary has a year in it, and impossible before
 *   then, which is honest: this feature earns its place over time.
 *
 *   Firsts — the first film you have seen by a director, in a language, from
 *   a decade. Fires most for someone starting out, which is when a tracker
 *   otherwise feels emptiest.
 *
 *   Counts — the tenth this year, the hundredth ever. Round numbers only,
 *   because every number is a milestone if you let it be, and then none are.
 *
 * Pure, and takes today as an argument. A module that reads the clock cannot
 * be tested for the case that matters — the boundary — and the boundaries
 * here are leap days and year ends.
 */

export interface Viewing {
	date: string;
	title: string;
	path: string;
	rating?: number;
}

export interface Anniversary {
	/** How many years ago. Always 1 or more. */
	years: number;
	viewing: Viewing;
}

/**
 * Viewings from the same month and day in earlier years.
 *
 * String comparison on `MM-DD` rather than date arithmetic: the dates are
 * stored as ISO strings, and parsing them into Date objects to compare two
 * fixed fields would introduce a timezone into a question that has none.
 *
 * 29 February is deliberately not special-cased. A film watched on a leap day
 * has an anniversary every four years, and quietly showing it on the 28th or
 * the 1st would be inventing a date the user never recorded.
 */
export function onThisDay(viewings: Viewing[], today: string): Anniversary[] {
	const monthDay = today.slice(5, 10);
	const thisYear = Number(today.slice(0, 4));
	if (!monthDay || !Number.isFinite(thisYear)) return [];

	const out: Anniversary[] = [];
	for (const v of viewings) {
		if (v.date.slice(5, 10) !== monthDay) continue;
		const years = thisYear - Number(v.date.slice(0, 4));
		if (years >= 1) out.push({ years, viewing: v });
	}
	// Longest ago first: "five years ago today" is a better opening line than
	// "one year ago today", and the older one is rarer.
	return out.sort((a, b) => b.years - a.years || a.viewing.title.localeCompare(b.viewing.title));
}

export interface Milestone {
	kind: "first" | "count";
	/** One line, already phrased. */
	text: string;
}

/**
 * Round-number counts worth mentioning.
 *
 * 10, 25, 50, 100 and then every hundred. Not every ten: at 340 films a year
 * a milestone every ten is wallpaper, and wallpaper is indistinguishable from
 * nothing.
 */
export function countMilestone(total: number, period: "year" | "ever"): Milestone | null {
	if (total <= 0) return null;
	const notable = total === 10 || total === 25 || total === 50 || (total >= 100 && total % 100 === 0);
	if (!notable) return null;
	return {
		kind: "count",
		text: period === "year" ? `${total} films watched this year` : `${total} films logged in total`,
	};
}

export interface FirstSource {
	/** The thing that might be new — a director, a language, a decade. */
	value: string;
	/** How many titles in the library carry it, including the one just logged. */
	count: number;
	/** Reads as "your first film by …" / "your first film in …". */
	preposition: "by" | "in" | "from";
}

/**
 * Firsts, which only mean anything when the count is exactly one.
 *
 * A count of one means the title just logged is the only one carrying that
 * value — so it is genuinely a first. Two or more is not news, and zero means
 * the caller passed something the library does not know about.
 */
export function firstMilestones(sources: FirstSource[], noun = "film"): Milestone[] {
	return sources
		.filter((s) => s.count === 1 && s.value.trim().length > 0)
		.map((s) => ({
			kind: "first" as const,
			text: `Your first ${noun} ${s.preposition} ${s.value.trim()}`,
		}));
}

/**
 * The longest run of consecutive days with at least one viewing.
 *
 * Distinct from the current streak, which the stats page already has: that
 * one answers "am I on a run", this one answers "what is the best I have ever
 * managed", and the second is the one that survives breaking the first.
 */
export function longestStreak(dates: string[]): number {
	const days = [...new Set(dates.filter(Boolean))].sort();
	if (!days.length) return 0;

	let best = 1;
	let run = 1;
	for (let i = 1; i < days.length; i++) {
		run = isNextDay(days[i - 1], days[i]) ? run + 1 : 1;
		if (run > best) best = run;
	}
	return best;
}

/**
 * Whether `b` is the calendar day after `a`.
 *
 * Uses UTC deliberately. These are date-only strings with no time and no
 * zone, and constructing them as local dates makes the arithmetic wrong
 * across a daylight-saving boundary — an hour lost in March would turn two
 * consecutive days into a gap and silently break a streak.
 */
function isNextDay(a: string, b: string): boolean {
	const one = Date.parse(`${a}T00:00:00Z`);
	const two = Date.parse(`${b}T00:00:00Z`);
	if (!Number.isFinite(one) || !Number.isFinite(two)) return false;
	return two - one === 86_400_000;
}
