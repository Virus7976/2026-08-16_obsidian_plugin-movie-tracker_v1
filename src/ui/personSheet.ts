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
import { PreviewSheet } from "./discoverView";
import { badgePerson } from "./personBadge";
import type { TmdbPerson, TmdbPersonCredit } from "../types";
import { redact } from "../secrets";
import { todayISO, yearOf } from "../util/dates";
import { renderStars } from "./stars";
import type { PersonOpinion } from "../settings";

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

		// Their own portrait behind them, scaled up and blurred past being
		// readable as a photograph — the same trick the film hero uses. It
		// costs no extra request, since it is the image already loading, and
		// it gives the sheet a colour that belongs to the person rather than
		// a flat panel that looks the same for everyone.
		if (src) {
			head.addClass("has-wash");
			head.createDiv({ cls: "reel-person-wash" }).setCssProps({ "--reel-person-wash": `url("${src}")` });
		}
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

		this.renderOpinion(body, person);

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

	/**
	 * Like or rate a person, which then leans your recommendations.
	 *
	 * Both, rather than one: a heart is a fast yes you will actually use on a
	 * cast list, and a rating is for the handful of people you feel strongly
	 * enough about to rank. Requiring stars for every actor you like would
	 * mean nobody records anything.
	 *
	 * Stored under settings rather than as a note, because this is a
	 * preference about how suggestions should lean — not a thing you watched.
	 */
	private renderOpinion(body: HTMLElement, person: TmdbPerson): void {
		const key = String(person.id);
		const store = this.plugin.settings.people;
		const current = store[key];

		const row = body.createDiv({ cls: "reel-person-opinion" });

		const save = async (next: Partial<PersonOpinion>) => {
			// Spread first, then the identity fields: an existing record must
			// not be able to overwrite the name with a stale one.
			const merged: PersonOpinion = {
				...store[key],
				...next,
				name: person.name,
				department: person.known_for_department,
			};
			// An opinion with nothing in it is not an opinion — drop the whole
			// record so an unliked, unrated person stops weighting anything.
			if (!merged.liked && merged.rating == null) delete store[key];
			else store[key] = merged;
			await this.plugin.saveSettings();
		};

		const heart = row.createEl("button", {
			cls: "reel-heart reel-heart-labelled",
			attr: { type: "button", "aria-pressed": String(!!current?.liked) },
		});
		const glyph = heart.createSpan({ cls: "reel-heart-glyph" });
		const word = heart.createSpan({ cls: "reel-heart-word" });
		const paintHeart = () => {
			const liked = !!this.plugin.settings.people[key]?.liked;
			heart.toggleClass("is-on", liked);
			heart.setAttr("aria-pressed", String(liked));
			heart.setAttr("aria-label", liked ? `${person.name} — liked` : `Like ${person.name}`);
			glyph.setText(liked ? "♥" : "♡");
			word.setText(liked ? "Liked" : "Like");
		};
		heart.addEventListener("click", () => {
			void save({ liked: !this.plugin.settings.people[key]?.liked }).then(paintHeart);
		});
		paintHeart();

		const stars = row.createDiv({ cls: "reel-person-stars" });
		renderStars(stars, {
			value: current?.rating,
			compact: true,
			onChange: (v) => void save({ rating: v ?? undefined }),
		});
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

		// Playing a part and turning up on a sofa are not the same credit.
		//
		// Sorting the raw list by popularity put Robert Downey Jr at the top of
		// his own filmography with: The Tonight Show, Family Guy, Late Night
		// with Seth Meyers, The Late Show, The Daily Show. All five are real
		// credits and four of them are him as himself, so the grid you got for
		// tapping his name was four other people's faces. Chat shows run for
		// decades and accumulate a popularity no single film can reach, which
		// is why they win a straight sort every time, for every actor.
		//
		// They are not discarded — they are a true part of what someone has
		// done — but they go underneath, behind a tap, under a heading that
		// says what they are.
		const roles = credits.filter((c) => !isAppearance(c));
		const appearances = credits.filter(isAppearance);
		const lead = roles.length ? roles : appearances;

		this.renderGrid(person, lead, `Known for — ${lead.length} titles`);

		if (roles.length && appearances.length) {
			const fold = this.contentEl.createEl("button", {
				cls: "reel-person-fold",
				text: `As themselves — ${appearances.length} appearances`,
			});
			fold.addEventListener("click", () => {
				fold.remove();
				this.renderGrid(person, appearances, "As themselves");
			});
		}
	}

	/** One grid of credits under one heading. */
	private renderGrid(person: TmdbPerson, credits: TmdbPersonCredit[], label: string): void {
		this.contentEl.createDiv({ cls: "reel-facet-label", text: label });
		// Nobody finds a long-press by accident, and what is behind it is the
		// answer to the question you tapped the name to ask.
		this.contentEl.createDiv({
			cls: "reel-person-hint",
			text: "Tap for the role · press and hold for the full part",
		});

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

			// The part, on its own line and in the accent.
			//
			// "2014 · Self - Guest" put the year first and let the character run
			// off the end of a 96px column, so the one fact a filmography exists
			// to carry — who were they in this — was the first thing truncated.
			const year = yearOf(c.release_date ?? c.first_air_date);
			const character = (c.character ?? "").trim();
			const job = (c.job ?? "").trim();
			const role = character || job;
			if (role) {
				card.createDiv({
					cls: character ? "reel-person-credit-role" : "reel-person-credit-role is-job",
					text: role,
				});
			}
			const bits: string[] = [];
			if (year) bits.push(String(year));
			if (c.media_type === "tv" && c.episode_count) {
				bits.push(c.episode_count === 1 ? "1 ep" : `${c.episode_count} eps`);
			}
			if (bits.length) card.createDiv({ cls: "reel-person-credit-sub", text: bits.join(" · ") });

			// Press and hold for the whole part.
			//
			// Registered before the click handler on purpose: the tap that ends
			// a hold is still a tap, and it would otherwise toggle the inline
			// panel underneath the sheet that had just opened over it.
			attachHold(card, () => new RoleSheet(this.plugin, person, c, mine).open());

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

		// The full screen, whether or not you own it. Previously a title you
		// did not have offered only "+ Watchlist" — so the one thing you might
		// actually want from a filmography, "what *is* this", was reachable
		// only by adding it to your library first.
		const details = actions.createEl("button", {
			cls: mine ? "reel-btn mod-cta" : "reel-btn",
			text: mine ? "Open in your library" : "Full details",
		});
		details.addEventListener("click", (ev) => {
			ev.stopPropagation();
			if (mine) {
				this.close();
				void this.plugin.openDetail(mine);
				return;
			}
			// Not owned, so there is no note and no detail screen. The preview
			// sheet is the same information from TMDB directly — overview,
			// scores, providers, trailer — and it carries the role across, so
			// the answer to "who was he in this" survives the navigation.
			new PreviewSheet(this.plugin, credit, () => {}, roleOf(credit)).open();
		});

		if (!mine) {
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
			this.plugin.undo.offer(`Added ${item.title ?? item.name ?? "it"} to your watchlist`);
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

/**
 * What this person did on this title.
 *
 * A cast credit carries `character`, a crew credit carries `job`, and a
 * person can appear in a filmography under either — a director who also
 * acted in one of their own films has both kinds of row.
 */
function roleOf(credit: { character?: string; job?: string }): string | undefined {
	const role = (credit.character ?? credit.job ?? "").trim();
	return role || undefined;
}

/** TMDB's ids for talk, news and reality — the formats people appear on. */
const CHAT_GENRES = new Set([10763, 10764, 10767]);

/**
 * Is this someone turning up as themselves rather than playing a part?
 *
 * Two independent signals, because either alone misses. The character string
 * catches "Self", "Self - Guest" and "Himself" on titles TMDB files under no
 * useful genre; the genre catches the chat show that credited its guest by
 * name instead. A voice part in Family Guy passes both tests and stays where
 * it belongs, in the filmography.
 */
function isAppearance(credit: TmdbPersonCredit): boolean {
	const role = (credit.character ?? "").trim();
	if (/^(self|himself|herself|themselves)\b/i.test(role)) return true;
	if (/\bself\s*[-–—]/i.test(role)) return true;
	return (credit.genre_ids ?? []).some((g) => CHAT_GENRES.has(g));
}

/**
 * Press and hold, without breaking scrolling.
 *
 * A grid of posters is something you flick through, so the hold has to lose to
 * the scroll: any real movement cancels it, and only a thumb that stays put
 * for about half a second counts. The tap that ends the hold is then swallowed
 * in the capture phase, or letting go would also fire whatever `click` does.
 *
 * `contextmenu` is cancelled for the desktop case, where a right-click is the
 * same intent and the browser's own menu is not the answer.
 */
function attachHold(el: HTMLElement, fire: () => void): void {
	let timer: number | null = null;
	let from: { x: number; y: number } | null = null;
	let fired = false;

	const cancel = () => {
		if (timer !== null) window.clearTimeout(timer);
		timer = null;
		from = null;
	};

	// Capture, and registered first, so it beats the click handler on this
	// element as well as any on the poster inside it.
	el.addEventListener(
		"click",
		(ev) => {
			if (!fired) return;
			fired = false;
			ev.stopImmediatePropagation();
			ev.preventDefault();
		},
		true
	);

	el.addEventListener("pointerdown", (ev: PointerEvent) => {
		if (ev.pointerType === "mouse" && ev.button !== 0) return;
		fired = false;
		from = { x: ev.clientX, y: ev.clientY };
		timer = window.setTimeout(() => {
			timer = null;
			from = null;
			fired = true;
			el.addClass("is-held");
			window.setTimeout(() => el.removeClass("is-held"), 220);
			fire();
		}, 480);
	});

	// Ten pixels of slop: a thumb held still on a phone is never perfectly
	// still, and anything past that is the beginning of a scroll.
	el.addEventListener("pointermove", (ev: PointerEvent) => {
		if (!from) return;
		if (Math.abs(ev.clientX - from.x) > 10 || Math.abs(ev.clientY - from.y) > 10) cancel();
	});
	el.addEventListener("pointerup", cancel);
	el.addEventListener("pointercancel", cancel);
	el.addEventListener("contextmenu", (ev) => ev.preventDefault());
}

/**
 * One part, at the size the question deserves.
 *
 * "It doesn't show what character he is in that movie" was true twice over:
 * the character was a truncated fragment on a 96px card, and the panel that
 * expanded underneath it was a block of text inside a grid. This is the same
 * information given a screen — the film's own frame, their face on top of it,
 * and the character set as the headline, because that is what you held the
 * poster down to find out.
 *
 * The still is the title's backdrop. TMDB has no endpoint that returns a
 * photograph of a named person inside a named title, so this is a frame from
 * the film with their portrait on it rather than a guaranteed shot of them in
 * character — and the portrait is what makes the pairing legible.
 */
class RoleSheet extends Modal {
	constructor(
		private plugin: ReelPlugin,
		private person: TmdbPerson,
		private credit: TmdbPersonCredit,
		private mine: ReturnType<ReelPlugin["library"]["byTmdbId"]>
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("reel-modal", "reel-role-sheet");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");

		const title = this.credit.title ?? this.credit.name ?? "Untitled";
		const year = yearOf(this.credit.release_date ?? this.credit.first_air_date);
		const character = (this.credit.character ?? "").trim();
		const job = (this.credit.job ?? "").trim();

		const stage = contentEl.createDiv({ cls: "reel-role-stage" });
		const still =
			this.plugin.tmdb.posterUrl(this.credit.backdrop_path, "w780") ??
			this.plugin.tmdb.posterUrl(this.credit.poster_path, "w500");
		if (still) {
			const img = stage.createEl("img", {
				cls: "reel-role-still",
				attr: { src: still, alt: "", decoding: "async" },
			});
			img.addEventListener("error", () => {
				img.remove();
				stage.addClass("is-empty");
			});
		} else {
			stage.addClass("is-empty");
		}

		const face = stage.createDiv({ cls: "reel-role-face" });
		const portrait = this.plugin.tmdb.posterUrl(this.person.profile_path, "w185");
		if (portrait) {
			const shot = face.createEl("img", { attr: { src: portrait, alt: "", decoding: "async" } });
			shot.addEventListener("error", () => {
				shot.remove();
				face.createSpan({ cls: "reel-placeholder-text", text: this.person.name.slice(0, 2) });
			});
		} else {
			face.createSpan({ cls: "reel-placeholder-text", text: this.person.name.slice(0, 2) });
		}

		const body = contentEl.createDiv({ cls: "reel-role-body" });
		body.createDiv({ cls: "reel-role-kicker", text: this.person.name });
		body.createDiv({
			cls: "reel-role-name",
			text: character || job || "No role recorded for this credit",
		});
		if (character || job) {
			body.createDiv({ cls: "reel-role-what", text: character ? "the character" : "their job" });
		}

		const facts: string[] = [this.credit.media_type === "tv" ? "Series" : "Film"];
		if (year) facts.push(String(year));
		if (this.credit.episode_count) {
			facts.push(this.credit.episode_count === 1 ? "1 episode" : `${this.credit.episode_count} episodes`);
		}
		if (this.credit.vote_average) facts.push(`${this.credit.vote_average.toFixed(1)} on TMDB`);

		body.createDiv({ cls: "reel-role-in", text: title });
		body.createDiv({ cls: "reel-role-facts", text: facts.join(" · ") });

		if (this.credit.overview) body.createDiv({ cls: "reel-role-overview", text: this.credit.overview });

		const actions = contentEl.createDiv({ cls: "reel-role-actions" });
		const details = actions.createEl("button", {
			cls: "reel-btn mod-cta",
			text: this.mine ? "Open in your library" : "Full details",
		});
		details.addEventListener("click", () => {
			const mine = this.mine;
			this.close();
			if (mine) {
				void this.plugin.openDetail(mine);
				return;
			}
			new PreviewSheet(this.plugin, this.credit, () => {}, roleOf(this.credit)).open();
		});

		if (!this.mine) {
			const add = actions.createEl("button", { cls: "reel-btn", text: "+ Watchlist" });
			add.addEventListener("click", () => {
				add.setAttr("disabled", "true");
				void this.plugin.notes
					.createFromResult(this.credit, { date: todayISO(), watchlist: true })
					.then(() => {
						this.plugin.undo.offer(`Added ${title} to your watchlist`);
						this.close();
					})
					.catch((e) => {
						add.removeAttribute("disabled");
						new Notice(`Reel: ${redact(e)}`);
					});
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
