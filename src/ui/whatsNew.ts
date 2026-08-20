/**
 * What changed since the version you were running.
 *
 * Shown once per update and never again for that version, because the second
 * showing of a dialog you have already read is an interruption rather than
 * news. Reopenable from the command palette, because "what was that thing it
 * said?" is a real question and the answer should not be gone.
 *
 * Deliberately not a `Notice`. A notice is a sentence with a timer on it, and
 * this is a list you may want to read twice — the last four releases were all
 * fixes to things the user reported, and the point of the screen is being able
 * to check whether the thing you reported is in it.
 */

import { App, Modal, Platform } from "obsidian";
import type ReelPlugin from "../main";
import { RELEASES, releasesSince, type Change, type ChangeKind, type Release } from "../changelog";

const KIND_LABEL: Record<ChangeKind, string> = {
	new: "New",
	better: "Better",
	fixed: "Fixed",
};

/** A date a person would say out loud, in their own locale. */
function pretty(iso: string): string {
	const d = new Date(`${iso}T00:00:00`);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export class WhatsNewModal extends Modal {
	constructor(
		app: App,
		private releases: Release[],
		private onClose_?: () => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal");
		modalEl.addClass("reel-whatsnew");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		const head = contentEl.createDiv({ cls: "reel-wn-head" });
		head.createDiv({ cls: "reel-wn-eyebrow", text: "Reel" });
		head.createDiv({ cls: "reel-wn-title", text: "What's new" });

		/*
		 * The headline of the newest release, verbatim.
		 *
		 * One sentence saying what this update is about, before any list. If
		 * the reader stops here they should still know whether the thing they
		 * were waiting for arrived.
		 */
		const top = this.releases[0];
		if (top) head.createDiv({ cls: "reel-wn-headline", text: top.headline });

		const body = contentEl.createDiv({ cls: "reel-wn-body" });
		for (const release of this.releases) this.paintRelease(body, release);

		if (!this.releases.length) {
			body.createDiv({ cls: "reel-empty", text: "You are on the newest version." });
		}

		/*
		 * One button, and it is the one that dismisses.
		 *
		 * There is nothing to decide here, so offering a choice would only make
		 * the reader work out whether the other option loses something.
		 */
		const actions = contentEl.createDiv({ cls: "reel-log-actions reel-wn-actions" });
		const go = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Got it" });
		go.addEventListener("click", () => this.close());
		go.focus();
	}

	private paintRelease(parent: HTMLElement, release: Release): void {
		const sec = parent.createDiv({ cls: "reel-wn-release" });

		const bar = sec.createDiv({ cls: "reel-wn-relhead" });
		bar.createSpan({ cls: "reel-wn-version", text: release.version });
		bar.createSpan({ cls: "reel-wn-date", text: pretty(release.date) });

		/*
		 * The headline repeats on the newest release, and that is on purpose
		 * for the older ones: when two or three versions arrive at once, each
		 * needs its own sentence or the list below it is a pile of unrelated
		 * items under a number.
		 */
		if (release !== this.releases[0]) {
			sec.createDiv({ cls: "reel-wn-relsummary", text: release.headline });
		}

		const list = sec.createDiv({ cls: "reel-wn-list" });
		for (const change of release.changes) paintChange(list, change);
	}

	onClose(): void {
		this.contentEl.empty();
		this.onClose_?.();
	}
}

function paintChange(list: HTMLElement, change: Change): void {
	const row = list.createDiv({ cls: `reel-wn-item is-${change.kind}` });
	row.createSpan({ cls: "reel-wn-kind", text: KIND_LABEL[change.kind] });
	const text = row.createDiv({ cls: "reel-wn-text" });
	text.createDiv({ cls: "reel-wn-what", text: change.text });
	// The "before" line is what makes an item checkable. Without it "the
	// magnifier no longer prints over what you type" is a claim; with it, it
	// names the thing you saw.
	if (change.note) text.createDiv({ cls: "reel-wn-note", text: change.note });
}

/**
 * Show the update notes if this is the first run of a new version.
 *
 * The stored version is written whether or not anything is shown, so an install
 * that skips several releases still only ever sees this once, and a fresh
 * install does not open a dialog before the user has seen the plugin at all.
 */
export async function showWhatsNewIfUpdated(plugin: ReelPlugin): Promise<void> {
	const current = plugin.manifest.version;
	const seen = plugin.settings.lastSeenVersion ?? "";
	if (seen === current) return;

	const releases = releasesSince(seen);

	// Recorded before the dialog opens, not after. If the write is left until
	// the modal closes, a reload with the dialog still open shows it again on
	// the next start — which is the one behaviour a "what's new" screen must
	// never have.
	plugin.settings.lastSeenVersion = current;
	await plugin.saveSettings();

	// A first install has nothing to catch up on. The plugin's own empty states
	// explain it better than a changelog would.
	if (!seen) return;
	if (!releases.length) return;

	new WhatsNewModal(plugin.app, releases).open();
}

/** The palette command: every release, newest first. */
export function showChangelog(plugin: ReelPlugin): void {
	new WhatsNewModal(plugin.app, RELEASES).open();
}
