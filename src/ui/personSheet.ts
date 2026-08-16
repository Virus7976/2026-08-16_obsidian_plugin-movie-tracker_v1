/**
 * A person, and everything they have been in.
 *
 * Tapping an actor used to search your own library for their name. That
 * answers "what else of theirs do I own", which is a fair question but not the
 * one anyone is asking on a cast list — you tap a face because you want to
 * know who they are and what else they have done, including the things you
 * have never seen.
 *
 * So: a proper filmography from TMDB, with the titles already in your library
 * marked, sorted by how well known each credit is rather than by date. The
 * things a person is known for are what you are scanning for; a strict
 * chronology buries them among bit parts.
 */

import { Modal, Notice, Platform } from "obsidian";
import type ReelPlugin from "../main";
import type { TmdbPerson, TmdbPersonCredit } from "../types";
import { redact } from "../secrets";
import { todayISO, yearOf } from "../util/dates";

export class PersonSheet extends Modal {
	private busy = false;

	constructor(
		private plugin: ReelPlugin,
		private personId: number,
		private fallbackName: string
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal", "reel-person-sheet");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		contentEl.createEl("h3", { cls: "reel-log-title", text: this.fallbackName });
		contentEl.createDiv({ cls: "reel-loading", text: "Loading…", attr: { role: "status" } });

		void this.load();
	}

	private async load(): Promise<void> {
		let person: TmdbPerson;
		try {
			person = await this.plugin.tmdb.getPerson(this.personId);
		} catch (e) {
			this.contentEl.empty();
			this.contentEl.createDiv({ cls: "reel-error", text: redact(e) });
			return;
		}
		// The sheet may have been dismissed while the request was in flight.
		if (!this.contentEl.isConnected) return;

		this.contentEl.empty();
		this.renderHead(person);
		this.renderCredits(person);
	}

	private renderHead(person: TmdbPerson): void {
		const head = this.contentEl.createDiv({ cls: "reel-person-head" });

		const shot = head.createDiv({ cls: "reel-person-hero-shot" });
		const src = this.plugin.tmdb.posterUrl(person.profile_path, "w342");
		if (src) {
			const img = shot.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
			img.addEventListener("error", () => {
				img.remove();
				shot.addClass("is-empty");
				shot.createSpan({ cls: "reel-placeholder-text", text: person.name.slice(0, 2) });
			});
		} else {
			shot.addClass("is-empty");
			shot.createSpan({ cls: "reel-placeholder-text", text: person.name.slice(0, 2) });
		}

		const body = head.createDiv({ cls: "reel-person-hero-body" });
		body.createDiv({ cls: "reel-person-hero-name", text: person.name });

		const facts: string[] = [];
		if (person.known_for_department) facts.push(person.known_for_department);
		// Years only. A full date of birth is more precision than a cast list
		// needs, and for a living person it is more than they need shared.
		const born = yearOf(person.birthday ?? undefined);
		const died = yearOf(person.deathday ?? undefined);
		if (born && died) facts.push(`${born}–${died}`);
		else if (born) facts.push(`b. ${born}`);
		if (facts.length) body.createDiv({ cls: "reel-dim", text: facts.join(" · ") });

		if (person.biography?.trim()) {
			const bio = person.biography.trim();
			// Biographies run long. The opening paragraph places someone; the
			// rest is available behind a tap rather than pushing the
			// filmography off the screen.
			const short = bio.length > 280 ? `${bio.slice(0, 280).trimEnd()}…` : bio;
			const el = this.contentEl.createDiv({ cls: "reel-person-bio", text: short });
			if (bio.length > 280) {
				const more = this.contentEl.createEl("button", { cls: "reel-link", text: "Read more" });
				more.addEventListener("click", () => {
					el.setText(bio);
					more.remove();
				});
			}
		}
	}

	private renderCredits(person: TmdbPerson): void {
		const cast = person.combined_credits?.cast ?? [];
		const crew = person.combined_credits?.crew ?? [];

		// One entry per title. A person can be credited several times on the
		// same film — actor and producer, or two roles — and three identical
		// posters in a row reads as a bug.
		const byId = new Map<number, TmdbPersonCredit>();
		for (const c of [...cast, ...crew]) {
			if (!c.id || !c.poster_path) continue;
			if (!byId.has(c.id)) byId.set(c.id, c);
		}

		const credits = [...byId.values()].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

		if (!credits.length) {
			this.contentEl.createDiv({ cls: "reel-empty", text: "No credits listed." });
			return;
		}

		this.contentEl.createDiv({ cls: "reel-facet-label", text: `Known for — ${credits.length} titles` });

		const grid = this.contentEl.createDiv({ cls: "reel-person-credits" });
		for (const c of credits.slice(0, 60)) {
			const type = c.media_type === "tv" ? "tv" : "film";
			const mine = this.plugin.library.byTmdbId(c.id, type);

			const card = grid.createDiv({ cls: "reel-person-credit" });
			card.setAttr("role", "button");
			card.setAttr("tabindex", "0");
			card.toggleClass("is-mine", !!mine);

			// The grid stays clean posters — that is what makes sixty titles
			// scannable. The frame from the film belongs in the expanded panel,
			// where there is room for it and where you have asked for detail.
			const poster = card.createDiv({ cls: "reel-person-credit-poster" });
			this.plugin.posters.attach(poster, {
				posterUrl: this.plugin.tmdb.posterUrl(c.poster_path, "w342") ?? undefined,
				title: c.title ?? c.name ?? "",
			});
			// A tick rather than a colour alone, so "I own this" survives a
			// glance and does not depend on seeing two cards side by side.
			if (mine) poster.createSpan({ cls: "reel-person-credit-tick", text: "✓" });


			card.createDiv({ cls: "reel-person-credit-title", text: c.title ?? c.name ?? "Untitled" });
			const year = yearOf(c.release_date ?? c.first_air_date);
			const role = c.character || c.job || "";
			const sub = [year ? String(year) : "", role].filter(Boolean).join(" · ");
			if (sub) card.createDiv({ cls: "reel-person-credit-sub", text: sub });

			// Tapping inspects; it does not act.
			//
			// It used to add straight to the watchlist, which is a write you
			// cannot see coming from a poster in a grid — and the thing you
			// actually want on a filmography is "what did they play in this".
			// Adding is still one tap, but it is now a button that says so.
			const open = () => this.toggleRole(card, c, mine, role);
			card.addEventListener("click", open);
			card.addEventListener("keydown", (ev: KeyboardEvent) => {
				if (ev.key === "Enter" || ev.key === " ") {
					ev.preventDefault();
					open();
				}
			});
		}
	}

	/**
	 * Expand a credit to show the role, with the actions spelled out.
	 *
	 * Only one panel is open at a time — a grid with six expanded cards is
	 * harder to read than the grid was, and you are comparing one credit
	 * against the rest, not several against each other.
	 */
	private toggleRole(
		card: HTMLElement,
		credit: TmdbPersonCredit,
		mine: ReturnType<typeof this.plugin.library.byTmdbId>,
		role: string
	): void {
		const existing = card.querySelector(".reel-person-role-panel");
		card.doc.querySelectorAll(".reel-person-role-panel").forEach((el) => el.remove());
		card.doc.querySelectorAll(".reel-person-credit.is-open").forEach((el) => el.removeClass("is-open"));
		// A second tap on the same card closes it, rather than reopening it.
		if (existing) return;

		card.addClass("is-open");
		const panel = card.createDiv({ cls: "reel-person-role-panel" });

		// A frame from the film, here rather than on the card.
		//
		// It started on the card and was wrong there: sixty backdrops make a
		// grid unscannable, and the poster is what you recognise a title by.
		// This is the moment you have asked for detail, so this is where the
		// picture earns its space.
		//
		// It is the title's backdrop, which comes free on the credit. TMDB has
		// no reliable way to get a still of *this person* in *this title* —
		// tagged_images returns nothing for most people and alternate poster
		// art for the rest — so this is a scene from the film, not a
		// guaranteed shot of them, and it is labelled accordingly.
		if (credit.backdrop_path) {
			const shot = panel.createDiv({ cls: "reel-person-role-still" });
			const img = shot.createEl("img", {
				attr: {
					src: this.plugin.tmdb.posterUrl(credit.backdrop_path, "w500") ?? "",
					alt: "",
					loading: "lazy",
					decoding: "async",
				},
			});
			img.addEventListener("error", () => shot.remove());
		}

		if (role) {
			panel.createDiv({ cls: "reel-person-role-label", text: credit.character ? "Played" : "Worked as" });
			panel.createDiv({ cls: "reel-person-role-value", text: role });
		} else {
			panel.createDiv({ cls: "reel-dim", text: "No role recorded for this credit." });
		}

		if (credit.overview) panel.createDiv({ cls: "reel-person-role-overview", text: credit.overview });

		const actions = panel.createDiv({ cls: "reel-person-role-actions" });
		if (mine) {
			const openIt = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Open in your library" });
			openIt.addEventListener("click", (ev) => {
				ev.stopPropagation();
				this.close();
				void this.plugin.openDetail(mine);
			});
		} else {
			const add = actions.createEl("button", { cls: "reel-btn mod-cta", text: "+ Watchlist" });
			add.addEventListener("click", (ev) => {
				ev.stopPropagation();
				void this.add(credit);
			});
		}
	}

	/** Add a credit to the watchlist without leaving the filmography. */
	private async add(item: TmdbPersonCredit): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			await this.plugin.notes.createFromResult(item, { date: todayISO(), watchlist: true });
			new Notice(`Added ${item.title ?? item.name ?? "it"} to your watchlist`);
			// Repaint so the tick appears against what you just added.
			this.contentEl.empty();
			await this.load();
		} catch (e) {
			new Notice(`Reel: ${redact(e)}`);
		}
		this.busy = false;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
