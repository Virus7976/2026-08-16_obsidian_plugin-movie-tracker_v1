/**
 * Snapshot and restore of a note's frontmatter.
 *
 * Every mutation Reel makes is a small edit to one YAML block: a rating, a
 * status, one more episode in a range. None of them could be taken back. On a
 * phone, where the tap targets are thumb-sized and sit next to each other, the
 * cost of a mis-tap was a value you then had to reconstruct from memory —
 * which viewing had the 4½, how far into season 3 you actually were.
 *
 * The approach is deliberately blunt: copy the whole block before the change,
 * put the whole block back on undo. Computing a minimal diff would be smaller
 * to store and much easier to get subtly wrong, and there is no size pressure
 * on twenty frontmatter blocks held in memory for one session.
 *
 * Pure on purpose — the restore rule is the part that can lose data, so it is
 * testable without a vault.
 */

export type Snapshot = Record<string, unknown>;

/**
 * Deep copy of a frontmatter object.
 *
 * Not `JSON.parse(JSON.stringify(...))`: Obsidian hands back real `Date`
 * objects for date-shaped values, and a JSON round trip turns those into
 * strings. Writing a string back where a date was would quietly change how the
 * value serialises — `2024-03-11` becoming `"2024-03-11"` — on every field the
 * user never touched.
 */
export function cloneFrontmatter<T>(value: T): T {
	if (value === null || typeof value !== "object") return value;
	if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
	if (Array.isArray(value)) return value.map((v) => cloneFrontmatter(v)) as unknown as T;

	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		out[k] = cloneFrontmatter(v);
	}
	return out as T;
}

/**
 * Put a snapshot back, in place.
 *
 * `processFrontMatter` hands you the live object and reserialises whatever it
 * holds afterwards, so this has to mutate rather than return. Both halves
 * matter: keys the mutation *added* have to go (otherwise undoing "mark
 * watched" leaves the watch event behind), and keys it *removed* have to come
 * back (otherwise undoing "clear rating" restores nothing).
 *
 * Anything written to the note between the snapshot and the undo — by hand, by
 * another plugin, by enrichment finishing late — is overwritten. That is the
 * honest reading of "undo": the block goes back to how it was. It is also why
 * the stack is short and session-only; an undo offered an hour later would be
 * a much bigger claim than it can support.
 */
export function restoreInto(fm: Record<string, unknown>, before: Snapshot): void {
	for (const key of Object.keys(fm)) {
		if (!(key in before)) delete fm[key];
	}
	for (const [key, value] of Object.entries(before)) {
		fm[key] = cloneFrontmatter(value);
	}
}

/** True when the snapshot and the current block are the same data. */
export function unchanged(fm: Record<string, unknown>, before: Snapshot): boolean {
	return stable(fm) === stable(before);
}

/**
 * Key-order-independent serialisation, used only for equality.
 *
 * `processFrontMatter` does not promise to preserve key order, so comparing
 * two blocks by their natural JSON would report a change every time Obsidian
 * happened to reorder them.
 */
function stable(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (value instanceof Date) return JSON.stringify(value.toISOString());
	if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
	const keys = Object.keys(value as Record<string, unknown>).sort();
	const body = keys.map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`);
	return `{${body.join(",")}}`;
}

/**
 * One reversible action.
 *
 * `apply` is the inverse, held as a closure rather than as data because the
 * two kinds of inverse are genuinely different shapes: restoring a snapshot,
 * and binning a note that should never have been created.
 */
export interface UndoStep {
	/** Shown on the button and in the palette: "Undo rating Dune". */
	label: string;
	/** The note it would touch, so a step can be dropped when that note goes. */
	path: string;
	apply: () => Promise<void>;
}

/**
 * A bounded last-in-first-out stack of reversible actions.
 *
 * Bounded because an unbounded one is a memory leak with a friendly name, and
 * because an undo you can reach after forty other edits is not one anyone
 * trusts enough to press.
 */
export class UndoStack {
	private steps: UndoStep[] = [];

	constructor(private limit = 20) {}

	push(step: UndoStep): void {
		this.steps.push(step);
		if (this.steps.length > this.limit) this.steps.shift();
	}

	pop(): UndoStep | undefined {
		return this.steps.pop();
	}

	/** The label of the step an undo would run, without consuming it. */
	peek(): string | null {
		return this.steps.length ? this.steps[this.steps.length - 1].label : null;
	}

	get size(): number {
		return this.steps.length;
	}

	clear(): void {
		this.steps = [];
	}

	/**
	 * Forget every step touching a path.
	 *
	 * A note that has been deleted cannot be restored into, and a note that has
	 * been recreated is a different file wearing the same name — either way the
	 * snapshot no longer describes anything real. Offering the undo anyway would
	 * either fail silently or write an old block into a new note.
	 */
	forget(path: string): void {
		this.steps = this.steps.filter((s) => s.path !== path);
	}
}
