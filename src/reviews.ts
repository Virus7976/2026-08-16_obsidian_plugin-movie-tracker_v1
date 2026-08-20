/**
 * The reviews you wrote, read back out of the note.
 *
 * `notes.appendReview` has always written a review into the note body as a
 * dated `##` section, and nothing in the app has ever read one. The index is
 * built from frontmatter only — deliberately, so rebuilding it stays cheap and
 * a user's prose is irrelevant to queries — with the consequence that the one
 * piece of writing you actually did was the one thing Reel could not show you.
 * You could see a film's runtime everywhere and your own opinion of it nowhere.
 *
 * So this parses the body back into structured reviews, and does it with
 * character offsets rather than by rewriting the file: an edit replaces exactly
 * the span it came from and leaves every other byte — your own headings, links,
 * embeds, whatever else lives in that note — untouched. A tracker that
 * reformats your notes to store its own data is not one you can trust with
 * them.
 */

import { starString } from "./util/ratings";
import { prettyDate } from "./util/dates";

export interface NoteReview {
	/** ISO date, when the heading carried a recoverable one. */
	date?: string;
	/** The heading exactly as written, so it can be shown or rewritten as-is. */
	heading: string;
	rating?: number;
	/** The prose under the heading, trimmed. */
	text: string;
	/** Character offsets of the body span, for an in-place edit. */
	from: number;
	to: number;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * An ISO date back out of a heading, if there is one in there.
 *
 * `appendReview` writes `prettyDate()` output — "4 Aug 2026" — so that is the
 * shape to expect, but notes hand-written or brought in from another tracker
 * use plain ISO just as often. Both are cheap to accept and refusing either
 * would silently drop half of somebody's history.
 */
export function dateFromHeading(heading: string): string | undefined {
	const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(heading);
	if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

	const pretty = /\b(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\b/.exec(heading);
	if (pretty) {
		const month = MONTHS.indexOf(pretty[2].slice(0, 3).toLowerCase());
		if (month >= 0) {
			return `${pretty[3]}-${String(month + 1).padStart(2, "0")}-${pretty[1].padStart(2, "0")}`;
		}
	}
	return undefined;
}

/**
 * The rating a heading is carrying, as a number.
 *
 * Stars in, number out: `★★★★½` is 4.5. Written by `starString`, so this is
 * simply its inverse — and it has to be, because the rating in the frontmatter
 * is the *latest* one, while a rewatch's heading holds the rating you gave that
 * night. Those are different facts and the diary needs both.
 */
export function ratingFromHeading(heading: string): number | undefined {
	const stars = (heading.match(/★/g) ?? []).length;
	if (!stars) return undefined;
	return stars + (heading.includes("½") ? 0.5 : 0);
}

/**
 * Every dated section in a note, newest position last.
 *
 * A heading counts as a review only when a date can be read out of it. That
 * keeps "## Notes", "## Trivia" and anything else you keep in the note out of
 * the way — this reads your file, it does not own it.
 */
export function parseReviews(content: string): NoteReview[] {
	const out: NoteReview[] = [];
	// Anchored to line starts so a `##` inside a fenced code block or mid-line
	// cannot open a section.
	const headings = [...content.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)];

	headings.forEach((match, i) => {
		const heading = match[1];
		const date = dateFromHeading(heading);
		if (!date) return;

		const from = (match.index ?? 0) + match[0].length;
		// Up to the next heading of any level, not just the next `##` — a note
		// with an `# Appendix` after its reviews should not swallow it.
		const rest = content.slice(from);
		const nextHeading = /^#{1,6}[ \t]+/m.exec(rest);
		const to = nextHeading ? from + (nextHeading.index ?? 0) : content.length;

		out.push({
			date,
			heading,
			rating: ratingFromHeading(heading),
			text: content.slice(from, to).trim(),
			from,
			to,
		});
		void i;
	});

	return out;
}

/** Newest first, which is the order every screen wants to show them in. */
export function reviewsNewestFirst(content: string): NoteReview[] {
	return parseReviews(content).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/**
 * Replace one review's prose, leaving the rest of the file alone.
 *
 * Offsets rather than a search-and-replace on the text, because two viewings of
 * the same film can carry the same words — "still holds up" twice, five years
 * apart — and a text match would edit whichever came first.
 */
export function replaceReview(content: string, review: NoteReview, text: string): string {
	const body = text.trim();
	// One blank line either side, so the section reads the same as one written
	// by `appendReview` and a later parse finds it in the same shape.
	const block = body ? `\n\n${body}\n` : "\n";
	return content.slice(0, review.from) + block + content.slice(review.to);
}

/**
 * Add a review for a date that has none.
 *
 * Appended rather than inserted in date order: the note is a document, and
 * rewriting the middle of somebody's file to keep a sort order is a much larger
 * liberty than adding to the end of it. Every reader here sorts anyway.
 */
export function appendReviewSection(content: string, date: string, rating: number | undefined, text: string): string {
	const body = text.trim();
	if (!body) return content;
	const stars = rating != null && rating > 0 ? ` · ${starString(rating)}` : "";
	const heading = `## ${prettyDate(date) || date}${stars}`;
	const gap = content.endsWith("\n") ? "\n" : "\n\n";
	return `${content}${gap}${heading}\n\n${body}\n`;
}

/**
 * Rewrite a heading so its stars match a rating.
 *
 * Editing a review is also the natural moment to change your mind about the
 * score, and a heading that still says four stars over prose explaining why it
 * is a three is worse than no stars at all.
 */
export function headingFor(review: NoteReview, rating: number | undefined): string {
	const base = review.date ? prettyDate(review.date) || review.date : review.heading.replace(/\s*·.*$/, "").trim();
	const stars = rating != null && rating > 0 ? ` · ${starString(rating)}` : "";
	return `## ${base}${stars}`;
}

/** Replace the heading line a review was found under. */
export function replaceHeading(content: string, review: NoteReview, heading: string): string {
	// The heading is the line ending at `from`; find its start.
	const lineStart = content.lastIndexOf("\n", review.from - 1) + 1;
	return content.slice(0, lineStart) + heading + content.slice(review.from);
}
