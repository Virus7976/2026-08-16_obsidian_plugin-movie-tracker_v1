/**
 * The guided discovery flow.
 *
 * Three steps, because that is how the decision actually goes: what did I
 * like, what am I in the mood for, and then — show me. A filter bar asks all
 * of it at once and answers none of it.
 *
 * Two things separate this from the reference flow it is modelled on. The
 * seed picker offers what you *rated*, not everything you have seen, since
 * seeding a recommender with a film you disliked asks for more of what you
 * did not want. And several seeds blend: results rank by how many of your
 * picks agree, so the consensus rises instead of whatever is popular.
 *
 * Mobile and desktop from the start rather than as an adaptation. Every
 * control is a 44px target, the steps are a single column at any width, and
 * the sheet becomes a bottom sheet on a phone — which is Obsidian's own
 * convention, so it behaves the way every other sheet in the app does.
 */

import { Modal, Notice, Platform, setIcon, debounce } from "obsidian";
import type ReelPlugin from "../main";
import type { Entry, TmdbSearchResult } from "../types";
import type { Blended } from "../util/blend";
import { becauseText } from "../util/blend";
import {
	emptyRecipe,
	describeConstraints,
	recipeKey,
	type Recipe,
	type SeedPool,
} from "../util/recipe";
import { setSelected } from "./a11y";
import { skeletonGrid } from "./skeleton";
import { haptic } from "../util/haptics";
import { reportFailure } from "./failure";
import { PreviewSheet } from "./discoverView";

type Step = "seeds" | "mood" | "results";

const POOLS: { id: SeedPool; label: string; hint: string }[] = [
	{ id: "loved", label: "Loved", hint: "Rated 4+, liked, or marked for a rewatch" },
	{ id: "rewatch", label: "Would rewatch", hint: "The ones you said you'd watch again" },
	{ id: "all", label: "Everything", hint: "Anything you've logged" },
];

const RUNTIMES = [
	{ minutes: 90, label: "90 min" },
	{ minutes: 120, label: "2 hours" },
	{ minutes: 150, label: "2½ hours" },
];

export class RecipeSheet extends Modal {
	private recipe: Recipe = emptyRecipe();
	private step: Step = "seeds";
	private genres: { id: number; name: string }[] = [];
	private results: Blended<TmdbSearchResult>[] | null = null;
	private running = false;
	/** Live match count for the current constraints; null while unknown. */
	private matches: number | null = null;
	private seedFilter = "";

	constructor(
		private plugin: ReelPlugin,
		/** Reopening a saved recipe rather than starting from nothing. */
		saved?: Recipe
	) {
		super(plugin.app);
		if (saved) this.recipe = { ...emptyRecipe(), ...saved };
	}

	onOpen(): void {
		const { modalEl } = this;
		modalEl.addClass("reel-modal", "reel-recipe");
		if (Platform.isPhone) modalEl.addClass("reel-sheet");
		void this.plugin.tmdb
			.genreList("movie")
			.then((g) => {
				this.genres = g;
				this.paint();
			})
			.catch(() => this.paint());
		this.paint();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private genreName = (id: number): string => this.genres.find((g) => g.id === id)?.name ?? String(id);

	/* ------------------------------------------------------------------ */

	private paint(): void {
		const el = this.contentEl;
		el.empty();

		this.paintProgress(el);

		if (this.step === "seeds") this.paintSeeds(el);
		else if (this.step === "mood") this.paintMood(el);
		else this.paintResults(el);
	}

	/**
	 * Where you are in three steps.
	 *
	 * Tappable backwards, never forwards: stepping back to change a seed is a
	 * thing people do constantly, and making them cancel and start again is
	 * the cheapest way to make a wizard hateful.
	 */
	private paintProgress(el: HTMLElement): void {
		const steps: { id: Step; label: string }[] = [
			{ id: "seeds", label: "Picks" },
			{ id: "mood", label: "Mood" },
			{ id: "results", label: "Results" },
		];
		const order = steps.map((s) => s.id);
		const at = order.indexOf(this.step);

		const bar = el.createDiv({ cls: "reel-recipe-steps" });
		for (const [i, s] of steps.entries()) {
			const b = bar.createEl("button", { cls: "reel-recipe-step", text: s.label, attr: { type: "button" } });
			setSelected(b, s.id === this.step, "tab");
			b.toggleClass("is-done", i < at);
			if (i >= at) {
				b.setAttr("disabled", "true");
				continue;
			}
			b.addEventListener("click", () => {
				this.step = s.id;
				this.results = null;
				this.paint();
			});
		}
	}

	/* ---- step 1: what did you like ---------------------------------- */

	private paintSeeds(el: HTMLElement): void {
		el.createDiv({ cls: "reel-recipe-title", text: "What are you in the mood for?" });
		el.createDiv({
			cls: "reel-recipe-hint",
			text: "Pick a few you loved. The more you pick, the more the results have to agree — which is what makes them good.",
		});

		// Which of your films to offer.
		const pools = el.createDiv({ cls: "reel-chips" });
		for (const p of POOLS) {
			const b = pools.createEl("button", { cls: "reel-chip", text: p.label, attr: { type: "button", title: p.hint } });
			setSelected(b, this.recipe.pool === p.id);
			b.addEventListener("click", () => {
				this.recipe.pool = p.id;
				this.paint();
			});
		}

		const pool = this.plugin.discover.seedPool(this.recipe.pool);

		if (!pool.length) {
			const why =
				this.recipe.pool === "rewatch"
					? "Nothing is marked 'would rewatch' yet — long-press a poster and tap Again."
					: this.recipe.pool === "loved"
						? "Nothing rated 4 or above yet. Try Everything, or rate a few first."
						: "Nothing logged yet.";
			el.createDiv({ cls: "reel-empty", text: why });
			this.paintNav(el, { next: "Skip to mood", onNext: () => this.go("mood") });
			return;
		}

		// A search box only once the list is long enough to need one; below
		// that it is a control that costs a tap and saves nothing.
		if (pool.length > 12) {
			const search = el.createEl("input", {
				cls: "reel-input",
				attr: { type: "search", placeholder: "Find one of yours…", enterkeyhint: "search" },
			});
			search.value = this.seedFilter;
			search.addEventListener("input", () => {
				this.seedFilter = search.value;
				this.paintSeedGrid(grid, pool);
			});
		}

		const grid = el.createDiv({ cls: "reel-recipe-seeds" });
		this.paintSeedGrid(grid, pool);

		const n = this.recipe.seeds.length;
		this.paintNav(el, {
			count: n ? `${n} picked` : "None picked yet",
			next: n ? "Next" : "Skip — just filter",
			onNext: () => this.go("mood"),
		});
	}

	private paintSeedGrid(grid: HTMLElement, pool: Entry[]): void {
		grid.empty();
		const q = this.seedFilter.trim().toLowerCase();
		const rows = q ? pool.filter((e) => e.title.toLowerCase().includes(q)) : pool;

		if (!rows.length) {
			grid.createDiv({ cls: "reel-empty", text: `Nothing of yours matches "${this.seedFilter}".` });
			return;
		}

		// Capped, with the picked ones always present: scrolling 400 posters
		// to find the third seed is worse than typing two letters, and a pick
		// vanishing because it fell outside the cap would be a bug.
		const picked = rows.filter((e) => this.recipe.seeds.includes(e.tmdbId));
		const rest = rows.filter((e) => !this.recipe.seeds.includes(e.tmdbId)).slice(0, 60);

		for (const entry of [...picked, ...rest]) {
			const on = this.recipe.seeds.includes(entry.tmdbId);
			const cell = grid.createDiv({ cls: "reel-recipe-seed" });
			cell.toggleClass("is-on", on);
			cell.setAttr("role", "button");
			cell.setAttr("tabindex", "0");
			cell.setAttr("aria-pressed", on ? "true" : "false");
			cell.setAttr("aria-label", `${entry.title}${on ? " — picked" : ""}`);

			const poster = cell.createDiv({ cls: "reel-recipe-seed-poster" });
			this.plugin.posters.attach(poster, entry);
			if (on) setIcon(poster.createDiv({ cls: "reel-recipe-seed-tick" }), "check");

			cell.createDiv({ cls: "reel-recipe-seed-title", text: entry.title });

			const toggle = () => {
				haptic("tick");
				this.recipe.seeds = on
					? this.recipe.seeds.filter((id) => id !== entry.tmdbId)
					: [...this.recipe.seeds, entry.tmdbId];
				this.paint();
			};
			cell.addEventListener("click", toggle);
			cell.addEventListener("keydown", (ev: KeyboardEvent) => {
				if (ev.key !== "Enter" && ev.key !== " ") return;
				ev.preventDefault();
				toggle();
			});
		}
	}

	/* ---- step 2: constraints ---------------------------------------- */

	private paintMood(el: HTMLElement): void {
		el.createDiv({ cls: "reel-recipe-title", text: "Narrow it down" });

		/* Genres, and the both/either control that is the point of them. */
		const section = (label: string) => el.createDiv({ cls: "reel-recipe-label", text: label });

		section("Genres");
		if (this.recipe.genres.length > 1) {
			const mode = el.createDiv({ cls: "reel-seg" });
			for (const [value, text, hint] of [
				["all", "Both", "Films that are all of these"],
				["any", "Either", "Films that are any of these"],
			] as const) {
				const b = mode.createEl("button", { cls: "reel-seg-btn", text, attr: { type: "button", title: hint } });
				setSelected(b, this.recipe.genreMode === value);
				b.addEventListener("click", () => {
					this.recipe.genreMode = value;
					this.refreshCount();
					this.paint();
				});
			}
		}

		const genreRow = el.createDiv({ cls: "reel-chips" });
		for (const g of this.genres) {
			const included = this.recipe.genres.includes(g.id);
			const excluded = this.recipe.withoutGenres.includes(g.id);
			const b = genreRow.createEl("button", { cls: "reel-chip", attr: { type: "button" } });
			b.createSpan({ text: excluded ? `Not ${g.name}` : g.name });
			b.toggleClass("is-active", included);
			b.toggleClass("is-excluded", excluded);
			b.setAttr("aria-pressed", included || excluded ? "true" : "false");
			// Three states on one control: off → include → exclude → off.
			// Half of choosing a film is ruling things out, and a separate
			// "exclude" list would double the number of chips on screen.
			b.setAttr("aria-label", `${g.name} — ${included ? "included" : excluded ? "excluded" : "off"}. Tap to change.`);
			b.addEventListener("click", () => {
				haptic("tick");
				if (included) {
					this.recipe.genres = this.recipe.genres.filter((id) => id !== g.id);
					this.recipe.withoutGenres = [...this.recipe.withoutGenres, g.id];
				} else if (excluded) {
					this.recipe.withoutGenres = this.recipe.withoutGenres.filter((id) => id !== g.id);
				} else {
					this.recipe.genres = [...this.recipe.genres, g.id];
				}
				this.refreshCount();
				this.paint();
			});
		}
		el.createDiv({ cls: "reel-recipe-hint", text: "Tap once to include, twice to rule out." });

		/* Time available, phrased as the decision rather than the metadata. */
		section("How long have you got?");
		const times = el.createDiv({ cls: "reel-chips" });
		for (const r of RUNTIMES) {
			const b = times.createEl("button", { cls: "reel-chip", text: r.label, attr: { type: "button" } });
			setSelected(b, this.recipe.maxRuntime === r.minutes);
			b.addEventListener("click", () => {
				this.recipe.maxRuntime = this.recipe.maxRuntime === r.minutes ? undefined : r.minutes;
				this.refreshCount();
				this.paint();
			});
		}

		section("At least");
		const scores = el.createDiv({ cls: "reel-chips" });
		for (const s of [6, 7, 8]) {
			const b = scores.createEl("button", { cls: "reel-chip", text: `${s}+`, attr: { type: "button" } });
			setSelected(b, this.recipe.minScore === s);
			b.addEventListener("click", () => {
				this.recipe.minScore = this.recipe.minScore === s ? undefined : s;
				this.refreshCount();
				this.paint();
			});
		}

		section("Decade");
		const decades = el.createDiv({ cls: "reel-chips" });
		for (const d of [1970, 1980, 1990, 2000, 2010, 2020]) {
			const b = decades.createEl("button", { cls: "reel-chip", text: `${d}s`, attr: { type: "button" } });
			const on = this.recipe.decades.includes(d);
			setSelected(b, on);
			b.addEventListener("click", () => {
				// Several at once: "the 90s or the 2010s" is an ordinary thing
				// to want, and being made to pick one is arbitrary.
				this.recipe.decades = on
					? this.recipe.decades.filter((x) => x !== d)
					: [...this.recipe.decades, d];
				this.refreshCount();
				this.paint();
			});
		}

		/* Agreement, which only means anything with more than one seed. */
		if (this.recipe.seeds.length > 1) {
			section("How closely should your picks agree?");
			const agree = el.createDiv({ cls: "reel-chips" });
			for (let n = 1; n <= Math.min(3, this.recipe.seeds.length); n++) {
				const b = agree.createEl("button", {
					cls: "reel-chip",
					text: n === 1 ? "Any of them" : `${n}+ of them`,
					attr: { type: "button" },
				});
				setSelected(b, this.recipe.minAgreement === n);
				b.addEventListener("click", () => {
					this.recipe.minAgreement = n;
					this.paint();
				});
			}
		}

		const owned = el.createDiv({ cls: "reel-chips" });
		const skip = owned.createEl("button", {
			cls: "reel-chip",
			text: "Hide what I already have",
			attr: { type: "button" },
		});
		setSelected(skip, this.recipe.excludeOwned);
		skip.addEventListener("click", () => {
			this.recipe.excludeOwned = !this.recipe.excludeOwned;
			this.paint();
		});

		this.paintNav(el, {
			count: this.countText(),
			next: "Show me",
			onNext: () => {
				this.step = "results";
				this.results = null;
				this.paint();
				void this.run();
			},
		});
	}

	/**
	 * The live count, debounced.
	 *
	 * Every chip tap would otherwise fire a request, and tapping through six
	 * genres to find the right pair would fire six. The count is a comfort,
	 * not an answer — it can afford to arrive a third of a second late.
	 */
	private refreshCount = debounce(
		() => {
			const asked = recipeKey(this.recipe);
			void this.plugin.discover
				.count(this.recipe)
				.then((n) => {
					// A slow response for an older recipe must not overwrite
					// the count for the one now on screen.
					if (asked !== recipeKey(this.recipe)) return;
					this.matches = n;
					const el = this.contentEl.querySelector(".reel-recipe-count");
					if (el instanceof HTMLElement) el.setText(this.countText());
				})
				.catch(() => {
					/* a missing count is not worth interrupting for */
				});
		},
		350,
		true
	);

	private countText(): string {
		if (this.matches == null) return "Nothing narrowed yet";
		if (this.matches === 0) return "Nothing matches — try loosening something";
		return `${this.matches.toLocaleString()} film${this.matches === 1 ? "" : "s"} match`;
	}

	/* ---- step 3: results -------------------------------------------- */

	private paintResults(el: HTMLElement): void {
		const constraints = describeConstraints(this.recipe, this.genreName);
		if (constraints.length) el.createDiv({ cls: "reel-recipe-hint", text: constraints.join(" · ") });

		if (this.results == null) {
			skeletonGrid(el, 12, "Finding things for you");
			return;
		}

		if (!this.results.length) {
			void this.explainEmpty(el);
			return;
		}

		const grid = el.createDiv({ cls: "reel-recipe-results" });
		for (const row of this.results.slice(0, 40)) {
			const item = row.item;
			const title = item.title ?? item.name ?? "Untitled";
			const card = grid.createDiv({ cls: "reel-recipe-result" });

			const poster = card.createDiv({ cls: "reel-recipe-result-poster" });
			this.plugin.posters.attach(poster, {
				posterUrl: this.plugin.tmdb.posterUrl(item.poster_path, "w342") ?? undefined,
				title,
			});
			// How many of your picks agreed, on the poster. It is the ranking
			// signal, so it belongs where the eye lands first.
			if (row.agreement > 1) {
				poster.createDiv({ cls: "reel-recipe-agree", text: `${row.agreement}×` });
			}

			card.createDiv({ cls: "reel-recipe-result-title", text: title });
			// The argument. A list that cannot say why is just a list.
			if (row.because.length) {
				card.createDiv({ cls: "reel-recipe-because", text: becauseText(row.because) });
			}

			card.setAttr("role", "button");
			card.setAttr("tabindex", "0");
			card.setAttr("aria-label", `${title} — ${row.because.length ? becauseText(row.because) : "see details"}`);
			card.addEventListener("click", () => this.preview(item));
		}

		const actions = el.createDiv({ cls: "reel-recipe-actions" });

		// Straight into the swipe interface. The flow should end in a
		// decision, not in another list to scroll.
		const quick = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Go through them one by one" });
		quick.addEventListener("click", () => {
			this.plugin.discover.stage(this.results?.map((r) => r.item) ?? []);
			this.close();
			void this.plugin.openTab("discover");
		});

		const save = actions.createEl("button", { cls: "reel-btn", text: "Save this recipe" });
		save.addEventListener("click", () => this.save());
	}

	/**
	 * Why nothing came back, and the one thing to change.
	 *
	 * "No results" is a dead end. Every constraint is in hand, so the culprit
	 * is computable — one count per constraint with that one removed.
	 */
	private async explainEmpty(el: HTMLElement): Promise<void> {
		const box = el.createDiv({ cls: "reel-empty-state" });
		setIcon(box.createDiv({ cls: "reel-empty-icon" }), "search-x");
		box.createDiv({ cls: "reel-empty-title", text: "Nothing matches all of that" });
		const body = box.createDiv({ cls: "reel-empty-body", text: "Working out which part is the problem…" });

		let culprit = null;
		try {
			culprit = await this.plugin.discover.blameFor(this.recipe, this.genreName);
		} catch {
			/* falls through to the generic message below */
		}
		if (!box.isConnected) return;

		// The diagnostic. A recipe returning nothing when it obviously should
		// is not debuggable from the outside — "no results" from a query you
		// cannot see is indistinguishable from a broken app, and that is
		// exactly what happened here: "Action or Comedy" with nothing else
		// returned zero, which is not a real answer.
		const show = box.createEl("button", { cls: "reel-link", text: "Show the query" });
		show.addEventListener("click", () => {
			show.remove();
			const dump = box.createDiv({ cls: "reel-recipe-query" });
			const queries = this.plugin.discover.describeQueries(this.recipe);
			dump.createDiv({ text: queries.length ? `${queries.length} query to TMDB:` : "No query — nothing constrains it." });
			for (const q of queries) dump.createEl("code", { text: q });
			// The two things that narrow results without appearing in the
			// recipe at all, and so never show up in the diagnosis above.
			const cert = this.plugin.settings.maxCertification;
			if (cert) dump.createDiv({ text: `Content filter: certification ≤ ${cert}. This applies to every search.` });
			const dismissed = this.plugin.settings.dismissedIds.length;
			if (dismissed) dump.createDiv({ text: `${dismissed} title(s) hidden by "not interested".` });
			dump.createDiv({ text: `${this.plugin.library.size} in your library, hidden: ${this.recipe.excludeOwned}` });
		});

		if (!culprit) {
			body.setText(
				"Even loosening one thing doesn't help. That usually means something outside these filters is cutting it — the query below will say what."
			);
			return;
		}

		body.setText(`It's ${culprit.label}. Drop it and you get ${culprit.without.toLocaleString()} results.`);
		const fix = box.createDiv({ cls: "reel-empty-actions" });
		const btn = fix.createEl("button", { cls: "reel-btn mod-cta", text: "Drop it and try again" });
		btn.addEventListener("click", () => {
			const key = culprit.key;
			if (key === "minScore") this.recipe.minScore = undefined;
			else if (key === "maxRuntime") this.recipe.maxRuntime = undefined;
			else if (key === "decades") this.recipe.decades = [];
			else if (key === "withoutGenres") this.recipe.withoutGenres = [];
			else if (key === "genreMode") this.recipe.genreMode = "any";
			else if (key === "genres") this.recipe.genres = [];
			this.results = null;
			this.paint();
			void this.run();
		});
	}

	private async run(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			this.results = (await this.plugin.discover.run(this.recipe)) as Blended<TmdbSearchResult>[];
		} catch (e) {
			this.results = [];
			reportFailure(e, { context: "Couldn't run that", retry: () => void this.run() });
		} finally {
			this.running = false;
			this.paint();
		}
	}

	private preview(item: TmdbSearchResult): void {
		// The same sheet Discover uses, so a result behaves identically
		// wherever it was found — full details, links, and the three
		// decisions inline.
		new PreviewSheet(this.plugin, item, () => {
			// Adding something removes it from the shortlist: it is no longer
			// a suggestion, it is in your library.
			this.results = (this.results ?? []).filter((r) => r.item.id !== item.id);
			this.paint();
		}).open();
	}

	/**
	 * Name it and keep it.
	 *
	 * A mood you built once and can return to is what turns this from a form
	 * into a tool. Stored in settings rather than as a note — it is a
	 * preference about how to search, not a thing you watched.
	 */
	private save(): void {
		const key = recipeKey(this.recipe);
		const existing = this.plugin.settings.recipes.find((r) => recipeKey(r) === key);
		if (existing) {
			new Notice(`Reel: already saved as "${existing.name}".`);
			return;
		}

		const suggestion =
			describeConstraints(this.recipe, this.genreName)
				.filter((c) => c !== "not already in your library")
				.slice(0, 2)
				.join(", ") || "My recipe";

		const modal = new Modal(this.app);
		modal.titleEl.setText("Name this recipe");
		const input = modal.contentEl.createEl("input", {
			cls: "reel-input",
			attr: { type: "text", placeholder: "Sunday afternoon" },
		});
		input.value = suggestion;
		const row = modal.contentEl.createDiv({ cls: "reel-log-actions" });
		row.createEl("button", { cls: "reel-btn", text: "Cancel" }).addEventListener("click", () => modal.close());
		const ok = row.createEl("button", { cls: "reel-btn mod-cta", text: "Save" });
		ok.addEventListener("click", async () => {
			const name = input.value.trim() || suggestion;
			this.plugin.settings.recipes = [{ ...this.recipe, name }, ...this.plugin.settings.recipes].slice(0, 20);
			await this.plugin.saveSettings();
			modal.close();
			new Notice(`Reel: saved "${name}".`);
		});
		modal.open();
		// Selected rather than merely focused: the suggested name is usually
		// close but rarely exactly right, so typing should replace it.
		window.setTimeout(() => input.select(), 0);
	}

	/* ---- shared footer ---------------------------------------------- */

	private paintNav(el: HTMLElement, opts: { count?: string; next: string; onNext: () => void }): void {
		const nav = el.createDiv({ cls: "reel-recipe-nav" });
		if (opts.count) nav.createDiv({ cls: "reel-recipe-count", text: opts.count });
		const btn = nav.createEl("button", { cls: "reel-btn mod-cta", text: opts.next, attr: { type: "button" } });
		btn.addEventListener("click", opts.onNext);
	}

	private go(step: Step): void {
		this.step = step;
		if (step === "mood") this.refreshCount();
		this.paint();
	}
}
