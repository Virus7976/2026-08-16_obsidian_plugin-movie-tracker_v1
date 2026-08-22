/**
 * The controls that finish a setup, wherever they are being drawn.
 *
 * Every one of the six guides ends by telling you to paste something "below" —
 * the key, the client ID and secret, the server address. There was nothing
 * below. The guide is a sheet opened on top of the settings screen and it
 * contained a title, some numbered steps and a button that closes it, so the
 * field each walkthrough was pointing at was on the screen underneath the
 * thing telling you to look down.
 *
 * The instruction was right about what to do and wrong about where, which is
 * the worst combination: it reads as correct, and following it means closing
 * the guide you were halfway through, hunting for a field among forty-nine
 * controls, and losing the step you were on.
 *
 * Rather than reword six guides to point somewhere else, the fields moved to
 * where the guides already said they were. That needed them to stop being
 * private methods of the settings screen — which is what this module is. The
 * settings screen and the guides now render the same controls, so a key saved
 * in one is saved in the other and there is no second implementation to drift.
 *
 * `onChanged` is how a caller redraws itself. The settings screen rebuilds the
 * whole tab; a guide rebuilds only itself. Neither needs to know about the
 * other.
 */

import { App, Notice, Setting, debounce } from "obsidian";
import { confirm } from "./confirm";
import { TraktSignIn } from "./traktSignIn";
import type ReelPlugin from "../main";
import { KEY_LABELS, KeyName } from "../credentials";
import { normaliseHost } from "../publish/mastodon";
import type { FeatureSpec } from "../setup";

export interface FieldContext {
	app: App;
	plugin: ReelPlugin;
	/** Redraw whatever screen these fields are on. */
	onChanged: () => void;
}

export interface KeyFieldOpts {
	/**
	 * Offer to delete the saved key.
	 *
	 * Off inside a guide. A walkthrough is a place for putting a key in, and a
	 * destructive control sitting beside the field you were told to paste into
	 * is an invitation to a mistake nobody was trying to make. The settings
	 * screen keeps it, which is where you go to undo things.
	 */
	remove?: boolean;
}

/**
 * One pasted secret.
 *
 * The input is a password field and never carries the saved value: a key is
 * write-only from here, and rendering it would put it in the DOM for anything
 * that walks the page. The placeholder is what tells you one is already there.
 */
export function keyField(
	el: HTMLElement,
	ctx: FieldContext,
	name: KeyName,
	label: string,
	desc: string,
	opts: KeyFieldOpts = {}
): void {
	const store = ctx.plugin.credentials;
	let input: HTMLInputElement | null = null;

	const setting = new Setting(el)
		.setName(label)
		.setDesc(desc)
		.addText((t) => {
			t.setPlaceholder(store.has(name) ? "Saved — paste to replace" : "Paste key, then Save");
			t.inputEl.type = "password";
			t.inputEl.autocomplete = "off";
			t.inputEl.spellcheck = false;
			t.inputEl.addClass("reel-input");
			input = t.inputEl;
		})
		.addButton((b) => {
			/*
			 * The accent points at the next thing to do, and once a key is
			 * saved this is not it.
			 *
			 * On a half-finished Trakt guide it left Save and Sign in wearing
			 * the same purple: one of them replaces a credential that is
			 * already there, the other is the step you actually came back for.
			 * A screen with two primary actions has none.
			 */
			if (!store.has(name)) b.setCta();
			return b
				.setButtonText("Save")
				.onClick(async () => {
					const value = input?.value ?? "";
					if (!value.trim()) {
						new Notice("Reel: nothing to save.");
						return;
					}
					const ok = await ctx.plugin.credentials.store(name, value);
					// Cleared whether or not it saved, so a failed attempt does
					// not leave a secret sitting in an input.
					if (input) input.value = "";
					new Notice(ok ? `Reel: ${KEY_LABELS[name]} key saved.` : "Reel: key not saved.");
					ctx.onChanged();
				});
		});

	if (opts.remove && store.has(name)) {
		setting.addButton((b) =>
			b.setButtonText("Remove").onClick(async () => {
				const ok = await confirm(ctx.app, {
					title: `Remove the ${KEY_LABELS[name]} key`,
					body: "Reel cannot recover it. You would need the original key again to re-add it.",
					confirmText: "Remove",
					danger: true,
				});
				if (!ok) return;
				await ctx.plugin.credentials.remove(name);
				new Notice(`Reel: ${KEY_LABELS[name]} key removed.`);
				ctx.onChanged();
			})
		);
	}
}

/**
 * Trakt's client ID and secret, which only mean anything together.
 *
 * Saved as one credential because half a pair is not a usable state and
 * storing them apart would let you have exactly that.
 */
export function traktAppField(el: HTMLElement, ctx: FieldContext, opts: KeyFieldOpts = {}): void {
	const hasApp = ctx.plugin.credentials.has("traktApp");
	let idEl: HTMLInputElement | null = null;
	let secretEl: HTMLInputElement | null = null;

	const setting = new Setting(el)
		.setName("Trakt application")
		.setDesc(
			hasApp
				? "Saved. Paste both again to replace them."
				: "From trakt.tv/oauth/applications. Both are stored with your other keys."
		)
		.addText((t) => {
			t.setPlaceholder("Client ID");
			t.inputEl.autocomplete = "off";
			t.inputEl.spellcheck = false;
			t.inputEl.addClass("reel-input");
			idEl = t.inputEl;
		})
		.addText((t) => {
			t.setPlaceholder("Client secret");
			t.inputEl.type = "password";
			t.inputEl.autocomplete = "off";
			t.inputEl.spellcheck = false;
			t.inputEl.addClass("reel-input");
			secretEl = t.inputEl;
		})
		.addButton((b) => {
			// Same rationing: replacing a saved application is not the primary
			// action on a guide whose remaining step is the sign-in.
			if (!hasApp) b.setCta();
			return b
				.setButtonText("Save")
				.onClick(async () => {
					const clientId = (idEl?.value ?? "").trim();
					const clientSecret = (secretEl?.value ?? "").trim();
					if (!clientId || !clientSecret) {
						new Notice("Reel: both the client ID and the secret are needed.");
						return;
					}
					const ok = await ctx.plugin.credentials.store(
						"traktApp",
						JSON.stringify({ id: clientId, secret: clientSecret })
					);
					if (idEl) idEl.value = "";
					if (secretEl) secretEl.value = "";
					new Notice(ok ? "Reel: Trakt application saved." : "Reel: not saved.");
					ctx.onChanged();
				});
		});

	if (opts.remove && hasApp) {
		setting.addButton((b) =>
			b.setButtonText("Remove").onClick(async () => {
				const ok = await confirm(ctx.app, {
					title: "Remove the Trakt application",
					body: "This also signs you out of Trakt. You would need the client ID and secret again to reconnect.",
					confirmText: "Remove",
					danger: true,
				});
				if (!ok) return;
				/*
				 * The token goes with it. It was issued by this application and
				 * is worthless without it, so leaving it behind would keep a
				 * dead credential in the vault and let every "signed in" signal
				 * go on reporting a session that cannot be renewed.
				 */
				await ctx.plugin.credentials.remove("traktApp");
				await ctx.plugin.credentials.remove("trakt");
				new Notice("Reel: Trakt application removed.");
				ctx.onChanged();
			})
		);
	}
}

/**
 * The sign-in itself, which is the step a pasted value cannot cover.
 *
 * Disabled until the application exists, because the device flow has nothing
 * to identify itself with until then — and a button that fails when pressed
 * teaches people the feature is broken rather than that a step is missing.
 */
export function traktSignInField(el: HTMLElement, ctx: FieldContext): void {
	const hasApp = ctx.plugin.credentials.has("traktApp");
	const signedIn = ctx.plugin.credentials.has("trakt");

	new Setting(el)
		.setName(signedIn ? "Signed in to Trakt" : "Sign in to Trakt")
		.setDesc(
			hasApp
				? "Trakt shows a short code. Type it on any device — Reel waits."
				: "Save the application above first; the sign-in needs it."
		)
		.addButton((b) => {
			b.setButtonText(signedIn ? "Sign in again" : "Sign in");
			if (!signedIn) b.setCta();
			b.setDisabled(!hasApp);
			b.onClick(async () => {
				const app = await ctx.plugin.publish.app();
				if (!app) {
					new Notice("Reel: couldn't read the Trakt application.");
					return;
				}
				new TraktSignIn(ctx.app, ctx.plugin, app, (ok) => {
					if (ok) ctx.onChanged();
				}).open();
			});
		});
}

/**
 * Which server you post to. Not a secret, so not encrypted.
 *
 * Debounced rather than saved per keystroke: this writes the same file that
 * holds the encrypted keys, and rewriting it once per character to record a
 * hostname is work nobody asked for.
 */
export function mastodonHostField(el: HTMLElement, ctx: FieldContext): void {
	new Setting(el)
		.setName("Instance")
		.setDesc("The server you post from, e.g. mastodon.social. Not a secret, so it isn't encrypted.")
		.addText((t) =>
			t
				.setPlaceholder("mastodon.social")
				.setValue(ctx.plugin.settings.mastodonHost)
				.onChange(
					debounce(async (v: string) => {
						ctx.plugin.settings.mastodonHost = normaliseHost(v);
						await ctx.plugin.saveSettings();
					}, 500)
				)
		);
}

/**
 * The switch that decides whether Ask may make a request at all.
 *
 * The OpenRouter walkthrough ends "paste it below, press Save, then turn Ask
 * on", and until now the guide contained the first half of that sentence and
 * not the second — the same fault as pointing at a field that was on another
 * screen, in an instruction the "below" check was never going to catch.
 *
 * It also closes a gap of its own. A saved key with this off reads as set up
 * everywhere in the plugin, because being set up means having the key, and yet
 * no question will run: `send` refuses before it reaches the network. Putting
 * the switch beside the key makes the difference visible at the moment it is
 * decided.
 */
export function askEnabledField(el: HTMLElement, ctx: FieldContext): void {
	new Setting(el)
		.setName("Enable Ask")
		.setDesc("Off by default. With this off, no request is ever made, key or no key.")
		.addToggle((t) =>
			t.setValue(ctx.plugin.settings.aiEnabled).onChange(async (v) => {
				ctx.plugin.settings.aiEnabled = v;
				await ctx.plugin.saveSettings();
				ctx.onChanged();
			})
		);
}

/**
 * Everything a given guide needs in order to be finishable, in step order.
 *
 * Per feature rather than derived from `spec.keys`, because the keys alone do
 * not describe the job. Mastodon needs a server address that is not a
 * credential at all; Trakt's second key is not pasted but arrives from a
 * sign-in; and the order has to match the order the steps talk about them in,
 * which is a fact about the writing rather than about the data.
 */
export function setupFields(el: HTMLElement, ctx: FieldContext, spec: FeatureSpec): void {
	switch (spec.id) {
		case "tmdb":
			keyField(el, ctx, "tmdb", "TMDB key", "Pasted here, encrypted in your vault.");
			return;
		case "omdb":
			keyField(el, ctx, "omdb", "OMDb key", "Pasted here, encrypted in your vault.");
			return;
		case "dtdd":
			keyField(el, ctx, "dtdd", "DoesTheDogDie key", "Pasted here, encrypted in your vault.");
			return;
		case "openrouter":
			// Key first, then the switch, which is the order the last step
			// gives them in.
			keyField(el, ctx, "openrouter", "OpenRouter key", "Pasted here, encrypted in your vault.");
			askEnabledField(el, ctx);
			return;
		case "trakt":
			traktAppField(el, ctx);
			traktSignInField(el, ctx);
			return;
		case "mastodon":
			mastodonHostField(el, ctx);
			keyField(el, ctx, "mastodon", "Access token", "The token from step 4, encrypted in your vault.");
			return;
		default:
			return;
	}
}
