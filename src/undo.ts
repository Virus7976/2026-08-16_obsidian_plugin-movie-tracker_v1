/**
 * Undo.
 *
 * Until now nothing Reel did could be taken back. Every action is one tap —
 * that is the point of the app — but one tap is also how you rate the wrong
 * film, tick an episode on the show above the one you meant, or add something
 * to the watchlist from a Discover row you were only scrolling past. The fix
 * for a mis-tap was to work out what the value used to be and set it again.
 *
 * What is offered is deliberately modest, because an undo you cannot rely on
 * is worse than none:
 *
 *   Frontmatter changes — fully reversible. The whole block is snapshotted
 *   before the edit and written back verbatim.
 *
 *   Creating a note — reversible by moving it to the trash, from where
 *   Obsidian or the OS can restore it. Nothing is hard-deleted here.
 *
 *   Reviews — *not* reversible, and the offer is not made. They are appended
 *   to the body, and the only way to remove one would be to rewrite the file,
 *   which is exactly the operation `appendReview` refuses to do so that no bug
 *   in Reel can ever eat something you wrote.
 *
 * The stack is short and lives for the session. An undo button that survived a
 * restart would be claiming the note still looks the way it did yesterday, and
 * it usually would not.
 */

import { Notice, TFile } from "obsidian";
import type ReelPlugin from "./main";
import { cloneFrontmatter, restoreInto, unchanged, UndoStack, type Snapshot } from "./util/undo";
import { redact } from "./secrets";
import { haptic } from "./util/haptics";

export class UndoService {
	private stack = new UndoStack(20);
	/** The notice currently offering an undo, so a second action replaces it. */
	private offered: Notice | null = null;
	/**
	 * Screens that have to put something back when an undo lands.
	 *
	 * Undo reverses the *vault*, and for most of the app that is the whole job —
	 * the library index reparses and every list repaints. Discover is the
	 * exception: rating a card marks it handled and drops it out of the feed, and
	 * that is screen state no vault write can reach. So the note came back and the
	 * poster did not, which reads as the undo half-working.
	 */
	private listeners = new Set<() => void>();

	/** Register a callback for after a successful undo. Returns an unsubscribe. */
	onUndone(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	constructor(private plugin: ReelPlugin) {}

	/**
	 * Watch for notes leaving or being renamed.
	 *
	 * Registered through the plugin so it is torn down with it. A stale step
	 * pointing at a path that no longer exists would fail on press, which reads
	 * as "undo is broken" rather than "that note is gone".
	 */
	watch(): void {
		this.plugin.registerEvent(this.plugin.app.vault.on("delete", (f) => this.stack.forget(f.path)));
		this.plugin.registerEvent(this.plugin.app.vault.on("rename", (_f, old) => this.stack.forget(old)));
	}

	get last(): string | null {
		return this.stack.peek();
	}

	/* ------------------------------------------------------------------ */
	/* Recording                                                           */
	/* ------------------------------------------------------------------ */

	/**
	 * Remember a frontmatter block so the edit that follows can be reversed.
	 *
	 * Callers snapshot *inside* the same `processFrontMatter` callback that
	 * makes the change, which is the only way to be sure the copy is of the
	 * state the edit started from. Reading the metadata cache instead would
	 * give whatever the last reparse produced, which lags writes.
	 */
	record(file: TFile, label: string, before: Snapshot): void {
		this.stack.push({
			label,
			path: file.path,
			apply: async () => {
				const target = this.plugin.app.vault.getAbstractFileByPath(file.path);
				if (!(target instanceof TFile)) throw new Error("that note has moved or been deleted");
				await this.plugin.app.fileManager.processFrontMatter(target, (fm) => restoreInto(fm, before));
			},
		});
	}

	/** Reverse a note's creation by moving it to the trash. */
	recordCreation(file: TFile, label: string): void {
		this.stack.push({
			label,
			path: file.path,
			apply: async () => {
				const target = this.plugin.app.vault.getAbstractFileByPath(file.path);
				if (!(target instanceof TFile)) return; // already gone; nothing to do
				// System trash where the vault is configured for it, Obsidian's
				// `.trash` otherwise. Never `vault.delete` — undoing an accidental
				// add must not be a way to lose a note you had written in.
				await this.plugin.app.fileManager.trashFile(target);
			},
		});
	}

	/* ------------------------------------------------------------------ */
	/* Offering                                                            */
	/* ------------------------------------------------------------------ */

	/**
	 * Say what happened, with a button to take it back.
	 *
	 * The button is the whole feature on a phone: the command palette exists
	 * there but nobody reaches for it mid-scroll, and a gesture would collide
	 * with Obsidian's own. Ten seconds is long enough to notice a mistake and
	 * short enough not to sit over the thing you are looking at — and the
	 * palette command keeps working after it fades.
	 */
	offer(message: string): void {
		this.offered?.hide();
		const notice = new Notice("", 10000);
		this.offered = notice;

		// `noticeEl` and not `messageEl`, despite the deprecation: `messageEl` is
		// @since 1.8.7 and this plugin declares a floor of 1.7.2. Reaching for
		// the newer property would lock out every user between those versions to
		// silence a warning, which is the wrong trade — the same call the
		// `setDestructive` review finding came down to.
		const el = notice.noticeEl;
		el.addClass("reel-undo-notice");
		el.createSpan({ text: message });

		const btn = el.createEl("button", { cls: "reel-undo-btn", text: "Undo", attr: { type: "button" } });
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			// Heavier than a star landing: this is a real reversal, and the
			// weight distinguishes "took it back" from "set a value".
			haptic("commit");
			btn.setAttr("disabled", "true");
			notice.hide();
			void this.undo();
		});
	}

	/* ------------------------------------------------------------------ */
	/* Undoing                                                             */
	/* ------------------------------------------------------------------ */

	/** Reverse the most recent action. Returns what was undone, or null. */
	async undo(): Promise<string | null> {
		const step = this.stack.pop();
		if (!step) {
			new Notice("Reel: nothing to undo.");
			return null;
		}
		try {
			await step.apply();
			new Notice(`Reel: undid ${step.label}.`);
			// After the write, never before: a listener that repaints from a state
			// the vault has not reached yet shows the thing it is about to undo.
			for (const fn of this.listeners) {
				try {
					fn();
				} catch {
					/* a screen failing to repaint must not fail the undo */
				}
			}
			return step.label;
		} catch (e) {
			// Put it back. A step that failed because the vault was momentarily
			// busy should still be there to try again, and one that failed
			// because the note is gone will be dropped by the delete handler.
			this.stack.push(step);
			new Notice(`Reel: could not undo — ${redact(e)}`);
			return null;
		}
	}
}

export { cloneFrontmatter, unchanged };
