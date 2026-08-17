/**
 * Reporting a failure in a way you can act on.
 *
 * There were 43 catch blocks and not one offered a retry. Every one of them
 * ended in a notice you could only read — a failed search, a failed poster, a
 * failed enrichment all dead-ended, and the only recourse was to redo by hand
 * whatever action had caused it.
 *
 * Built on the same notice-with-a-button shape as Undo, deliberately: a
 * confirmation you can reverse and a failure you can retry are the same
 * gesture from the user's side, and they should look identical.
 */

import { Notice } from "obsidian";
import { diagnose, worthReporting, type Diagnosis } from "../util/failure";
import { TmdbError } from "../tmdb";
import { MissingKeyError } from "../credentials";
import { redact } from "../secrets";

export interface FailureOptions {
	/** Re-run whatever failed. Omitted where there is nothing sensible to repeat. */
	retry?: () => void;
	/**
	 * True for work nobody asked for right now — a backfill, an enrichment
	 * pass. Being offline during background work is not worth a notice.
	 */
	background?: boolean;
	/** Prefixed to the diagnosis, e.g. "Couldn't load Discover". */
	context?: string;
}

/** Classify a thrown value, whatever shape it arrived in. */
export function diagnoseError(error: unknown): Diagnosis {
	// A missing or locked key is not a network condition at all, and reaching
	// TMDB to discover that would be the wrong order of operations.
	if (error instanceof MissingKeyError) {
		return {
			kind: "auth",
			message: "No TMDB key is unlocked. Add or unlock one in Settings → Reel.",
			retryable: false,
			settings: true,
		};
	}

	const status = error instanceof TmdbError ? error.status : undefined;
	// `navigator.onLine` is read here, at the edge, so the decision itself
	// stays pure and testable.
	return diagnose(status, navigator.onLine !== false);
}

/**
 * Say what went wrong and offer the one thing that would help.
 *
 * Never both buttons. A bad key with a Retry beside it invites pressing the
 * button that cannot work, and a transient fault with a Settings button sends
 * someone to check a key that is fine.
 */
export function reportFailure(error: unknown, opts: FailureOptions = {}): Diagnosis {
	const d = diagnoseError(error);

	if (!worthReporting(d.kind, opts.background === true)) {
		console.warn("Reel: offline —", opts.context ?? "background work", "skipped");
		return d;
	}

	// The redacted original still reaches the console. The diagnosis is for
	// the person; the detail is for whoever has to work out why.
	if (d.kind === "unknown") console.warn("Reel:", opts.context ?? "failed", redact(error));

	const notice = new Notice("", d.retryable ? 12000 : 9000);
	const el = notice.noticeEl;
	el.addClass("reel-undo-notice");
	el.createSpan({ text: opts.context ? `${opts.context} — ${d.message}` : d.message });

	// No Settings button, despite it being the obvious affordance: opening a
	// plugin's own settings tab needs `app.setting`, which is undocumented
	// API. This plugin already refused that once — the daily-note path used
	// to reach into `app.internalPlugins` and was rewritten to a plain
	// setting for exactly this reason. The message names the destination, and
	// that is worth more than a button that could break on any release.
	if (d.settings) return d;

	if (d.retryable && opts.retry) {
		const btn = el.createEl("button", { cls: "reel-undo-btn", text: "Retry", attr: { type: "button" } });
		btn.addEventListener("click", (ev) => {
			ev.stopPropagation();
			btn.setAttr("disabled", "true");
			notice.hide();
			opts.retry?.();
		});
	}
	return d;
}

/**
 * Is there a network at all?
 *
 * Only ever used to decide whether to *start* a request. A true here is not a
 * promise — a captive portal reports online — so nothing treats it as one.
 */
export function offline(): boolean {
	return navigator.onLine === false;
}
