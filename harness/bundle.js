"use strict";
(() => {
  // harness/shim.ts
  function applyOptions(el, o = {}) {
    if (o.cls) {
      const classes = Array.isArray(o.cls) ? o.cls : o.cls.split(/\s+/);
      for (const c of classes)
        if (c)
          el.classList.add(c);
    }
    if (o.text != null)
      el.textContent = o.text;
    if (o.href != null)
      el.setAttribute("href", o.href);
    if (o.type != null)
      el.setAttribute("type", o.type);
    if (o.placeholder != null)
      el.setAttribute("placeholder", o.placeholder);
    if (o.value != null)
      el.value = o.value;
    if (o.title != null)
      el.setAttribute("title", o.title);
    if (o.attr) {
      for (const [k, v] of Object.entries(o.attr)) {
        if (v != null && v !== false)
          el.setAttribute(k, String(v));
      }
    }
    return el;
  }
  function installDomExtensions() {
    const proto = HTMLElement.prototype;
    if (proto.createDiv)
      return;
    proto.createEl = function(tag, o) {
      const el = document.createElement(tag);
      applyOptions(el, o);
      this.appendChild(el);
      return el;
    };
    proto.createDiv = function(o) {
      return this.createEl("div", o);
    };
    proto.createSpan = function(o) {
      return this.createEl("span", o);
    };
    proto.addClass = function(...c) {
      for (const x of c)
        if (x)
          this.classList.add(x);
    };
    proto.removeClass = function(...c) {
      for (const x of c)
        this.classList.remove(x);
    };
    proto.removeClasses = function(c) {
      for (const x of c)
        this.classList.remove(x);
    };
    proto.toggleClass = function(c, on) {
      for (const x of Array.isArray(c) ? c : [c])
        this.classList.toggle(x, on);
    };
    proto.hasClass = function(c) {
      return this.classList.contains(c);
    };
    proto.setAttr = function(k, v) {
      this.setAttribute(k, String(v));
    };
    proto.setText = function(t) {
      this.textContent = t;
    };
    proto.empty = function() {
      while (this.firstChild)
        this.removeChild(this.firstChild);
    };
    proto.detach = function() {
      this.remove();
    };
    proto.setCssProps = function(props) {
      for (const [k, v] of Object.entries(props))
        this.style.setProperty(k, v);
    };
    proto.setCssStyles = function(styles) {
      Object.assign(this.style, styles);
    };
    proto.findAll = function(sel) {
      return Array.from(this.querySelectorAll(sel));
    };
    proto.find = function(sel) {
      return this.querySelector(sel);
    };
    const g = globalThis;
    g.createDiv = (o) => applyOptions(document.createElement("div"), o);
    g.createEl = (tag, o) => applyOptions(document.createElement(tag), o);
    g.createSpan = (o) => applyOptions(document.createElement("span"), o);
  }
  installDomExtensions();
  var params = new URLSearchParams(location.search);
  var phone = params.get("phone") !== "0";
  var Platform = {
    isPhone: phone,
    isMobile: phone,
    isDesktop: !phone,
    isDesktopApp: !phone,
    isIosApp: false,
    isAndroidApp: phone
  };
  function setIcon(el, name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "svg-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.dataset.icon = name;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "12");
    c.setAttribute("cy", "12");
    c.setAttribute("r", "8");
    svg.appendChild(c);
    el.appendChild(svg);
  }
  var Notice = class {
    constructor(message = "", _timeout) {
      this.noticeEl = document.createElement("div");
      this.noticeEl.className = "notice";
      this.noticeEl.textContent = message;
    }
    setMessage(m) {
      this.noticeEl.textContent = m;
      return this;
    }
    hide() {
      this.noticeEl.remove();
    }
  };
  var Modal = class {
    constructor(app2) {
      this.app = app2;
      this.contentEl = document.createElement("div");
      this.modalEl = document.createElement("div");
      this.titleEl = document.createElement("div");
    }
    open() {
    }
    close() {
    }
    onOpen() {
    }
    onClose() {
    }
  };
  var TFile = class {
    constructor() {
      this.path = "";
      this.basename = "";
      this.extension = "md";
      this.stat = { ctime: 0, mtime: 0, size: 0 };
    }
  };
  var Menu = class {
    addItem(cb) {
      cb({
        setTitle: () => this,
        setIcon: () => this,
        onClick: () => this
      });
      return this;
    }
    addSeparator() {
      return this;
    }
    showAtPosition() {
    }
  };
  function debounce(fn, _wait, _immediate) {
    return fn;
  }
  var SuggestModal = class extends Modal {
  };

  // harness/fixtures.ts
  var n = 0;
  function film(o) {
    n++;
    return {
      path: `Movies/${o.title}.md`,
      basename: o.title,
      type: "film",
      tmdbId: 1e3 + n,
      director: [],
      creators: [],
      genres: [],
      seasons: [],
      watched: [],
      cast: [],
      characters: [],
      castIds: [],
      directorIds: [],
      productionCompanies: [],
      providers: [],
      contentFlags: [],
      contentTopics: [],
      lists: [],
      status: "watched",
      added: Date.now() - n * 864e5,
      watchCount: 1,
      ...o
    };
  }
  var LIBRARY = [
    film({
      title: "The Lord of the Rings: The Fellowship of the Ring",
      year: 2001,
      rating: 5,
      runtime: 178,
      genres: ["Adventure", "Fantasy", "Action"],
      director: ["Peter Jackson"],
      cast: ["Elijah Wood", "Ian McKellen", "Viggo Mortensen"],
      castIds: [1327, 1328, 110],
      directorIds: [108],
      certification: "PG-13",
      imdbRating: 8.9,
      imdbVotes: 195e4,
      metacritic: 92,
      watched: [{ date: "2025-08-16", rating: 5 }],
      overview: "A meek Hobbit and eight companions set out on a journey to destroy the One Ring and the Dark Lord Sauron.",
      liked: true,
      wouldRewatch: true
    }),
    film({
      title: "Heat",
      year: 1995,
      rating: 4.5,
      runtime: 170,
      genres: ["Action", "Crime", "Drama"],
      director: ["Michael Mann"],
      cast: ["Al Pacino", "Robert De Niro"],
      castIds: [1158, 380],
      directorIds: [1704],
      certification: "R",
      imdbRating: 8.3,
      watched: [{ date: "2024-08-16", rating: 4.5 }]
    }),
    film({ title: "Inside Man", year: 2006, rating: 4, genres: ["Crime", "Thriller"], director: ["Spike Lee"], runtime: 129 }),
    film({ title: "Sicario", year: 2015, rating: 4.5, genres: ["Action", "Crime"], director: ["Denis Villeneuve"], runtime: 121 }),
    film({ title: "Dune", year: 2021, rating: 4.5, genres: ["Science Fiction"], director: ["Denis Villeneuve"], runtime: 155 }),
    film({ title: "Hot Fuzz", year: 2007, rating: 5, genres: ["Action", "Comedy"], director: ["Edgar Wright"], runtime: 121 }),
    film({ title: "Shaun of the Dead", year: 2004, rating: 4, genres: ["Comedy", "Horror"], director: ["Edgar Wright"] }),
    film({ title: "The Dark Knight", year: 2008, rating: 5, genres: ["Action", "Crime"], director: ["Christopher Nolan"], runtime: 152 }),
    film({ title: "Inception", year: 2010, rating: 4.5, genres: ["Action", "Science Fiction"], director: ["Christopher Nolan"] }),
    film({ title: "Interstellar", year: 2014, rating: 4.5, genres: ["Adventure", "Drama"], director: ["Christopher Nolan"] }),
    film({ title: "Training Day", year: 2001, rating: 4, genres: ["Crime", "Drama"], director: ["Antoine Fuqua"] }),
    film({ title: "Remember the Titans", year: 2e3, rating: 3.5, genres: ["Drama"], director: ["Boaz Yakin"] }),
    film({ title: "Everything Everywhere All at Once", year: 2022, rating: 5, genres: ["Action", "Comedy"], status: "watchlist" }),
    film({ title: "Parasite", year: 2019, rating: 5, genres: ["Thriller", "Drama"] }),
    film({ title: "Mad Max: Fury Road", year: 2015, rating: 4.5, genres: ["Action", "Adventure"] }),
    film({ title: "Arrival", year: 2016, rating: 4, genres: ["Science Fiction", "Drama"], director: ["Denis Villeneuve"] }),
    film({ title: "Blade Runner 2049", year: 2017, rating: 4.5, genres: ["Science Fiction"], director: ["Denis Villeneuve"] }),
    film({ title: "No Country for Old Men", year: 2007, rating: 4.5, genres: ["Crime", "Thriller"] }),
    film({ title: "There Will Be Blood", year: 2007, rating: 4, genres: ["Drama"] }),
    film({ title: "Whiplash", year: 2014, rating: 5, genres: ["Drama", "Music"] }),
    film({ title: "The Grand Budapest Hotel", year: 2014, rating: 4, genres: ["Comedy", "Adventure"] }),
    film({ title: "Knives Out", year: 2019, rating: 4, genres: ["Comedy", "Crime"], status: "watchlist" }),
    film({ title: "Nightcrawler", year: 2014, rating: 4.5, genres: ["Crime", "Thriller"] }),
    film({ title: "Prisoners", year: 2013, rating: 4, genres: ["Thriller"], director: ["Denis Villeneuve"] }),
    film({ title: "Se7en", year: 1995, rating: 4.5, genres: ["Crime", "Thriller"] }),
    film({ title: "Zodiac", year: 2007, rating: 4, genres: ["Crime", "Drama"] }),
    film({ title: "The Social Network", year: 2010, rating: 4, genres: ["Drama"] }),
    film({ title: "Gone Girl", year: 2014, rating: 4, genres: ["Thriller"] }),
    film({ title: "Baby Driver", year: 2017, rating: 4, genres: ["Action", "Crime"], director: ["Edgar Wright"] }),
    film({ title: "Drive", year: 2011, rating: 4, genres: ["Crime", "Drama"] })
  ];
  var SHOW = {
    ...film({ title: "The Office", genres: ["Comedy"] }),
    type: "tv",
    firstAirYear: 2005,
    totalEpisodes: 186,
    episodeRuntime: 22,
    rating: 3,
    certification: "TV-14",
    creators: ["Greg Daniels"],
    tmdbRating: 8.6,
    status: "watching",
    seasons: [
      { n: 1, watched: "1-6", total: 6 },
      { n: 2, watched: "1-3", total: 22 },
      { n: 3, watched: "", total: 23 }
    ],
    lastWatched: { season: 2, episode: 3, date: "2026-08-15" },
    overview: "The everyday lives of office employees in the Scranton, Pennsylvania branch of the fictional Dunder Mifflin Paper Company."
  };
  var AWKWARD = [
    // No poster at all. Common on obscure titles and on everything until the
    // backfill runs, and it is the case where the placeholder has to hold the
    // grid's shape by itself.
    film({ title: "A Film With No Poster", year: 1974, genres: ["Drama"], rating: 3 }),
    // A title long enough to break a grid track, which is exactly how the
    // unequal-columns bug got in.
    film({
      title: "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb, and Several Other Things Besides",
      year: 1964,
      rating: 5,
      genres: ["Comedy", "War"],
      director: ["Stanley Kubrick"]
    }),
    // Nothing recorded but the title. An import leaves hundreds of these.
    film({ title: "Untitled Import", status: "watchlist" }),
    // Non-Latin script, which sizes and wraps differently from English.
    film({ title: "\u4E03\u4EBA\u306E\u4F8D", year: 1954, rating: 5, genres: ["Drama"], director: ["\u9ED2\u6FA4\u660E"], runtime: 207 }),
    // A single character, at the other end from the long one.
    film({ title: "M", year: 1931, rating: 4.5, genres: ["Crime"] }),
    // Every badge at once: certification, watchlist flag, rating, heart. They
    // all overlay the same poster corner region.
    film({
      title: "Everything At Once",
      year: 2020,
      rating: 4.5,
      liked: true,
      wouldRewatch: true,
      status: "watchlist",
      certification: "NC-17",
      genres: ["Action", "Comedy", "Drama", "Thriller", "Horror", "Romance"],
      imdbRating: 9.9,
      imdbVotes: 24e5,
      metacritic: 100,
      rottenTomatoes: 100,
      tmdbRating: 9.9
    })
  ];
  var LONG_SHOW = {
    ...film({ title: "A Very Long Running Series Indeed", genres: ["Drama"] }),
    type: "tv",
    firstAirYear: 1989,
    totalEpisodes: 750,
    episodeRuntime: 22,
    status: "watching",
    creators: ["Someone With A Considerably Long Name Attached"],
    seasons: Array.from({ length: 34 }, (_, i) => ({
      n: i + 1,
      watched: i < 20 ? `1-${22}` : "",
      total: 22
    })),
    lastWatched: { season: 20, episode: 22, date: "2026-01-01" }
  };
  function rng(seed) {
    let s = seed;
    return () => {
      s = s * 1664525 + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }
  var GENRES = [
    "Drama",
    "Comedy",
    "Thriller",
    "Science Fiction",
    "Horror",
    "Documentary",
    "Animation",
    "Romance",
    "Crime",
    "Western"
  ];
  var DIRECTORS = [
    "Denis Villeneuve",
    "Greta Gerwig",
    "Bong Joon-ho",
    "C\xE9line Sciamma",
    "Ryusuke Hamaguchi",
    "Jordan Peele",
    "Lynne Ramsay",
    "Wes Anderson"
  ];
  var CERTS = ["PG", "PG-13", "R", "15", "12A"];
  var PER_MONTH = [14, 9, 4, 3, 6, 8, 11, 7, 5, 22, 16, 13];
  var YEAR = (() => {
    const rand = rng(20260820);
    const out = [];
    for (let m = 0; m < 12; m++) {
      for (let i = 0; i < PER_MONTH[m]; i++) {
        const dayBias = rand();
        const dom = 1 + Math.floor(rand() * 27);
        const date = `2025-${String(m + 1).padStart(2, "0")}-${String(dom).padStart(2, "0")}`;
        const r = rand();
        const rating = r > 0.92 ? 2.5 : r > 0.75 ? 3 : r > 0.4 ? 3.5 : r > 0.15 ? 4 : r > 0.04 ? 4.5 : 5;
        const decade = 1970 + Math.floor(rand() * 6) * 10;
        out.push(
          film({
            title: `Fixture ${m + 1}-${i + 1}${dayBias > 0.7 ? " \u2014 A Considerably Longer Title Than Fits" : ""}`,
            year: decade + Math.floor(rand() * 10),
            rating,
            runtime: 80 + Math.floor(rand() * 90),
            genres: [GENRES[Math.floor(rand() * GENRES.length)]],
            director: [DIRECTORS[Math.floor(rand() * DIRECTORS.length)]],
            certification: CERTS[Math.floor(rand() * CERTS.length)],
            imdbRating: 5 + rand() * 4,
            watched: [{ date, rating }],
            liked: rand() > 0.7
          })
        );
      }
    }
    return out;
  })();

  // src/secrets.ts
  var guarded = /* @__PURE__ */ new Set();
  function redact(input) {
    let s = input instanceof Error ? `${input.message}` : typeof input === "string" ? input : String(input);
    for (const secret of guarded)
      s = s.split(secret).join("\xABapi-key\xBB");
    s = s.replace(/([?&]api_key=)[^&\s]+/gi, "$1\xABapi-key\xBB");
    s = s.replace(/(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, "$1\xABtoken\xBB");
    return s;
  }

  // src/util/ratings.ts
  var MAX_STARS = 5;
  var STEP = 0.5;
  function clampRating(value) {
    const snapped = Math.round(value / STEP) * STEP;
    return Math.min(MAX_STARS, Math.max(0, snapped));
  }
  function starString(rating) {
    if (rating == null || rating <= 0)
      return "";
    const r = clampRating(rating);
    const full = Math.floor(r);
    const half = r - full >= STEP;
    return "\u2605".repeat(full) + (half ? "\xBD" : "");
  }

  // src/util/haptics.ts
  var PATTERNS = {
    /** A value landed: a star, an episode tick, a toggle. */
    tick: 10,
    /** Something was created or removed — a heavier event, so a heavier tap. */
    commit: 18,
    /** A long-press crossed its threshold and a menu is about to appear. */
    hold: 22
  };
  function haptic(kind = "tick") {
    if (!Platform.isMobile)
      return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      return;
    try {
      navigator.vibrate?.(PATTERNS[kind]);
    } catch {
    }
  }

  // src/ui/stars.ts
  function renderStars(parent, opts = {}) {
    const root = parent.createDiv({ cls: "reel-stars" });
    if (opts.readonly)
      root.addClass("is-readonly");
    if (opts.compact)
      root.addClass("is-compact");
    let value = opts.value != null ? clampRating(opts.value) : void 0;
    const paint = () => {
      root.setAttr("aria-label", value ? `${value} out of 5` : "No rating");
      root.findAll(".reel-star").forEach((star, i) => {
        const index = i + 1;
        const filled = value != null && value >= index;
        const half = value != null && !filled && value >= index - 0.5;
        star.toggleClass("is-full", filled);
        star.toggleClass("is-half", half);
      });
    };
    for (let i = 1; i <= MAX_STARS; i++) {
      const star = root.createDiv({ cls: "reel-star" });
      star.createSpan({ cls: "reel-star-bg", text: "\u2605" });
      star.createSpan({ cls: "reel-star-fg", text: "\u2605" });
      if (opts.readonly)
        continue;
      star.setAttr("role", "button");
      star.setAttr("tabindex", "0");
      const pick = (clientX) => {
        const rect = star.getBoundingClientRect();
        const isLeftHalf = clientX - rect.left < rect.width / 2;
        const next = isLeftHalf ? i - 0.5 : i;
        value = value === next ? void 0 : next;
        paint();
        haptic("tick");
        opts.onChange?.(value);
      };
      star.addEventListener("click", (e) => pick(e.clientX));
      star.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ")
          return;
        e.preventDefault();
        const rect = star.getBoundingClientRect();
        pick(rect.left + rect.width * 0.75);
      });
    }
    paint();
    return root;
  }
  function renderStarsStatic(parent, value) {
    return renderStars(parent, { value, readonly: true });
  }

  // src/ui/quickRate.ts
  var QuickRate = class extends Modal {
    constructor(plugin2, entry, file) {
      super(plugin2.app);
      this.plugin = plugin2;
      this.entry = entry;
      this.file = file;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal", "reel-quickrate");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.createEl("h3", { cls: "reel-log-title", text: this.entry.title });
      renderStars(contentEl.createDiv({ cls: "reel-rating-row big" }), {
        value: this.entry.rating,
        onChange: async (v) => {
          try {
            await this.plugin.notes.setRating(this.file, v ?? null);
          } catch (e) {
            new Notice(`Reel: ${redact(e)}`);
          }
          this.close();
        }
      });
      const reactions = contentEl.createDiv({ cls: "reel-reactions" });
      const reaction = (on, iconOn, iconOff, label, toggle) => {
        const b = reactions.createEl("button", { cls: "reel-reaction", attr: { type: "button" } });
        const paint = (state) => {
          b.empty();
          setIcon(b.createSpan({ cls: "reel-reaction-icon" }), state ? iconOn : iconOff);
          b.createSpan({ cls: "reel-reaction-label", text: label });
          b.toggleClass("is-on", state);
          b.setAttr("aria-pressed", state ? "true" : "false");
        };
        paint(on);
        b.addEventListener("click", async () => {
          const next = !b.hasClass("is-on");
          paint(next);
          haptic("tick");
          try {
            const actual = await toggle();
            if (actual !== next)
              paint(actual);
          } catch (e) {
            paint(!next);
            new Notice(`Reel: ${redact(e)}`);
          }
        });
      };
      reaction(!!this.entry.liked, "heart", "heart", "Liked", () => this.plugin.notes.toggleLiked(this.file));
      reaction(
        !!this.entry.wouldRewatch,
        "rotate-ccw",
        "rotate-ccw",
        "Again",
        () => this.plugin.notes.toggleRewatch(this.file)
      );
      const row = contentEl.createDiv({ cls: "reel-log-actions" });
      const open = row.createEl("button", { cls: "reel-btn mod-cta", text: "Open note" });
      open.addEventListener("click", async () => {
        this.close();
        await this.plugin.app.workspace.getLeaf(false).openFile(this.file);
      });
    }
    onClose() {
      this.contentEl.empty();
    }
  };

  // src/ui/listPicker.ts
  var ListPicker = class extends Modal {
    constructor(app2, plugin2, entry, file) {
      super(app2);
      this.plugin = plugin2;
      this.entry = entry;
      this.file = file;
      this.selected = new Set(entry.lists);
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.createEl("h3", { cls: "reel-log-title", text: "Lists" });
      contentEl.createDiv({ cls: "reel-log-sub", text: this.entry.title });
      const chipRow = contentEl.createDiv({ cls: "reel-flag-row" });
      const known = /* @__PURE__ */ new Set([...this.plugin.library.lists(), ...this.selected]);
      const addChip = (name) => {
        const chip = chipRow.createEl("button", { cls: "reel-chip", text: name });
        const paint = () => chip.toggleClass("is-active", this.selected.has(name));
        chip.addEventListener("click", () => {
          if (this.selected.has(name))
            this.selected.delete(name);
          else
            this.selected.add(name);
          paint();
        });
        paint();
      };
      [...known].sort().forEach(addChip);
      if (!known.size)
        contentEl.createDiv({ cls: "reel-dim", text: "No lists yet \u2014 create one below." });
      const newRow = contentEl.createDiv({ cls: "reel-field" });
      newRow.createDiv({ cls: "reel-field-label", text: "New list" });
      const input = newRow.createEl("input", {
        cls: "reel-input",
        attr: { type: "text", placeholder: "e.g. Halloween 2026", enterkeyhint: "done" }
      });
      const create = () => {
        const name = input.value.trim();
        if (!name || this.selected.has(name))
          return;
        this.selected.add(name);
        addChip(name);
        input.value = "";
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          create();
        }
      });
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      actions.createEl("button", { cls: "reel-btn", text: "Cancel" }).addEventListener("click", () => this.close());
      const save = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Save" });
      save.addEventListener("click", async () => {
        create();
        try {
          await this.plugin.notes.setLists(this.file, [...this.selected]);
          this.plugin.undo.offer("Lists updated");
        } catch (e) {
          new Notice(`Reel: ${redact(e)}`);
        }
        this.close();
      });
    }
    onClose() {
      this.contentEl.empty();
    }
  };

  // src/util/ranges.ts
  function parseRange(spec) {
    if (!spec)
      return [];
    const out = /* @__PURE__ */ new Set();
    for (const part of String(spec).split(",")) {
      const chunk = part.trim();
      if (!chunk)
        continue;
      const m = chunk.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const lo = parseInt(m[1], 10);
        const hi = parseInt(m[2], 10);
        if (Number.isNaN(lo) || Number.isNaN(hi))
          continue;
        for (let i = Math.min(lo, hi); i <= Math.max(lo, hi); i++)
          out.add(i);
      } else if (/^\d+$/.test(chunk)) {
        out.add(parseInt(chunk, 10));
      }
    }
    return [...out].sort((a, b) => a - b);
  }
  function formatRange(episodes) {
    const sorted = [...new Set(episodes)].filter((n2) => Number.isFinite(n2) && n2 > 0).sort((a, b) => a - b);
    if (!sorted.length)
      return "";
    const parts = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      const cur = sorted[i];
      if (cur !== prev + 1) {
        parts.push(start === prev ? String(start) : `${start}-${prev}`);
        start = cur;
      }
      prev = cur;
    }
    return parts.join(",");
  }
  function rangeCount(spec) {
    return parseRange(spec).length;
  }

  // src/util/dates.ts
  function todayISO() {
    return toISO(/* @__PURE__ */ new Date());
  }
  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function yearOf(dateish) {
    if (!dateish)
      return void 0;
    const m = String(dateish).match(/^(\d{4})/);
    return m ? parseInt(m[1], 10) : void 0;
  }
  function prettyDate(iso2) {
    if (!iso2)
      return "";
    const m = iso2.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m)
      return iso2;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
  }
  function daysBetween(aISO, bISO) {
    const a = Date.parse(aISO + "T00:00:00");
    const b = Date.parse(bISO + "T00:00:00");
    if (Number.isNaN(a) || Number.isNaN(b))
      return NaN;
    return Math.round((b - a) / 864e5);
  }
  function formatMinutes(mins) {
    if (!Number.isFinite(mins) || mins <= 0)
      return "\u2014";
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (!h)
      return `${m}m`;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  // src/library.ts
  function unlink(value) {
    const m = String(value).match(/^\[\[([^\]]+)\]\]$/);
    if (!m)
      return String(value).trim();
    const inner = m[1];
    const pipe = inner.lastIndexOf("|");
    const text = pipe >= 0 ? inner.slice(pipe + 1) : inner;
    const slash = text.lastIndexOf("/");
    return (slash >= 0 ? text.slice(slash + 1) : text).trim();
  }

  // src/content.ts
  var FLAG_LABELS = {
    sex: "Sex",
    nudity: "Nudity",
    profanity: "Swearing",
    violence: "Violence",
    gore: "Gore",
    drugs: "Drugs",
    horror: "Horror"
  };

  // src/render/query.ts
  var SYMBOL_OPS = [">=", "<=", "!=", "="];
  var WORD_OPS = ["contains", "excludes", "includes", "not in", "in"];
  var OPS = [...SYMBOL_OPS, ">", "<", ...WORD_OPS];
  function lastWatchDate(e) {
    if (e.type === "tv")
      return e.lastWatched?.date;
    return e.watched.length ? e.watched[e.watched.length - 1].date : void 0;
  }

  // src/util/format.ts
  function compactCount(n2) {
    if (!Number.isFinite(n2) || n2 <= 0)
      return "";
    if (n2 >= 1e6)
      return `${(n2 / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (n2 >= 1e3)
      return `${Math.round(n2 / 1e3)}K`;
    return String(Math.round(n2));
  }

  // src/render/grid.ts
  function wireCell(plugin2, cell, entry, onSelect) {
    let timer = null;
    let longPressed = false;
    let startX = 0;
    let startY = 0;
    const cancel = () => {
      if (timer != null)
        window.clearTimeout(timer);
      timer = null;
      cell.removeClass("is-holding");
    };
    const openMenu = (x, y) => {
      longPressed = true;
      cell.removeClass("is-holding");
      haptic("hold");
      showActions(plugin2, entry, x, y, onSelect);
    };
    cell.addEventListener("pointerdown", (e) => {
      longPressed = false;
      startX = e.clientX;
      startY = e.clientY;
      cell.addClass("is-holding");
      timer = window.setTimeout(() => openMenu(e.clientX, e.clientY), 500);
    });
    cell.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientY - startY) > 8 || Math.abs(e.clientX - startX) > 8)
        cancel();
    });
    cell.addEventListener("pointerup", cancel);
    cell.addEventListener("pointercancel", cancel);
    cell.addEventListener("pointerleave", cancel);
    cell.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      cancel();
      openMenu(e.clientX, e.clientY);
    });
    cell.addEventListener("click", async () => {
      if (longPressed) {
        longPressed = false;
        return;
      }
      if (onSelect) {
        onSelect(entry);
        return;
      }
      const file = plugin2.app.vault.getAbstractFileByPath(entry.path);
      if (file instanceof TFile)
        await plugin2.app.workspace.getLeaf(false).openFile(file);
      else
        new Notice("Reel: note not found.");
    });
    cell.addEventListener("keydown", (e) => {
      if (e.key !== "Enter")
        return;
      if (onSelect) {
        onSelect(entry);
        return;
      }
      const file = plugin2.app.vault.getAbstractFileByPath(entry.path);
      if (file instanceof TFile) {
        void plugin2.app.workspace.getLeaf(false).openFile(file).catch((e2) => new Notice(`Reel: ${redact(e2)}`));
      }
    });
  }
  function showActions(plugin2, entry, x, y, onSelect) {
    const file = plugin2.app.vault.getAbstractFileByPath(entry.path);
    if (!(file instanceof TFile)) {
      new Notice("Reel: note not found.");
      return;
    }
    const menu = new Menu();
    const run = (job) => void job.catch((e) => new Notice(`Reel: ${redact(e)}`));
    menu.addItem(
      (i) => i.setTitle("Open").setIcon("panel-right-open").onClick(() => {
        if (onSelect)
          onSelect(entry);
        else
          void plugin2.app.workspace.getLeaf(false).openFile(file);
      })
    );
    menu.addItem(
      (i) => i.setTitle(entry.rating != null ? "Change rating" : "Rate").setIcon("star").onClick(() => new QuickRate(plugin2, entry, file).open())
    );
    menu.addItem(
      (i) => i.setTitle(entry.liked ? "Unlike" : "Like").setIcon("heart").onClick(() => run(plugin2.notes.toggleLiked(file).then((on) => plugin2.undo.offer(on ? "Liked" : "Unliked"))))
    );
    if (entry.status === "watchlist") {
      menu.addItem(
        (i) => i.setTitle("Mark watched").setIcon("check").onClick(
          () => run(
            plugin2.notes.setStatus(file, entry.type === "tv" ? "watching" : "watched").then(() => plugin2.undo.offer(`${entry.title} marked watched`))
          )
        )
      );
    } else {
      menu.addItem(
        (i) => i.setTitle("Move to watchlist").setIcon("bookmark").onClick(
          () => run(
            plugin2.notes.setStatus(file, "watchlist").then(() => plugin2.undo.offer(`${entry.title} moved to the watchlist`))
          )
        )
      );
    }
    menu.addItem(
      (i) => i.setTitle("Lists\u2026").setIcon("list").onClick(() => new ListPicker(plugin2.app, plugin2, entry, file).open())
    );
    menu.addSeparator();
    menu.addItem(
      (i) => i.setTitle("Open note").setIcon("file-text").onClick(() => void plugin2.app.workspace.getLeaf(false).openFile(file))
    );
    menu.showAtPosition({ x, y });
  }
  function describe(el, entry) {
    const bits = [entry.title];
    const year = entry.year ?? entry.firstAirYear;
    if (year)
      bits.push(String(year));
    if (entry.rating != null)
      bits.push(`rated ${entry.rating} out of 5`);
    if (entry.status === "watchlist")
      bits.push("on your watchlist");
    el.setAttr("role", "button");
    el.setAttr("tabindex", "0");
    el.setAttr("aria-label", bits.join(", "));
  }
  function renderPosterGrid(plugin2, el, rows2, onSelect) {
    const grid = el.createDiv({ cls: "reel-grid" });
    for (const entry of rows2) {
      const cell = grid.createDiv({ cls: "reel-cell" });
      describe(cell, entry);
      const posterEl = cell.createDiv({ cls: "reel-cell-poster" });
      plugin2.posters.attach(posterEl, entry);
      if (entry.rating != null) {
        renderStarsStatic(posterEl.createDiv({ cls: "reel-cell-rating" }), entry.rating);
      }
      if (entry.liked)
        posterEl.createDiv({ cls: "reel-cell-heart", text: "\u2665" });
      if (entry.status === "watchlist")
        posterEl.createDiv({ cls: "reel-cell-flag", text: "Watchlist" });
      if (entry.certification)
        posterEl.createDiv({ cls: "reel-cell-cert", text: entry.certification });
      if (entry.type === "tv") {
        const total = entry.totalEpisodes ?? 0;
        const seen = entry.seasons.reduce((n2, s) => n2 + rangeCount(s.watched), 0);
        if (total && seen && seen < total) {
          const bar = posterEl.createDiv({ cls: "reel-cell-progress" });
          bar.setCssProps({ "--reel-fill": String(seen / total) });
        }
      }
      const caption = cell.createDiv({ cls: "reel-cell-caption" });
      caption.createDiv({ cls: "reel-cell-title", text: entry.title });
      const y = entry.year ?? entry.firstAirYear;
      if (y)
        caption.createDiv({ cls: "reel-cell-year", text: String(y) });
      wireCell(plugin2, cell, entry, onSelect);
    }
  }
  function renderRowList(plugin2, el, rows2, compact = false, onSelect) {
    const list = el.createDiv({ cls: "reel-list" });
    for (const entry of rows2) {
      const row = list.createDiv({ cls: "reel-row" });
      describe(row, entry);
      if (!compact) {
        const thumb = row.createDiv({ cls: "reel-row-thumb" });
        plugin2.posters.attach(thumb, entry);
      }
      const body = row.createDiv({ cls: "reel-row-body" });
      const title = body.createDiv({ cls: "reel-row-title" });
      title.createSpan({ text: entry.title });
      const y = entry.year ?? entry.firstAirYear;
      if (y)
        title.createSpan({ cls: "reel-dim", text: ` ${y}` });
      const meta = body.createDiv({ cls: "reel-row-meta" });
      const when = lastWatchDate(entry);
      if (when)
        meta.createSpan({ text: prettyDate(when) });
      if (entry.rating != null)
        renderStarsStatic(meta, entry.rating);
      if (entry.type === "tv" && entry.lastWatched) {
        meta.createSpan({ text: `S${entry.lastWatched.season}E${entry.lastWatched.episode}` });
      }
      if (!compact) {
        const facts = body.createDiv({ cls: "reel-row-facts" });
        if (entry.runtime)
          facts.createSpan({ text: formatMinutes(entry.runtime) });
        if (entry.type === "tv" && entry.totalEpisodes) {
          facts.createSpan({ text: `${entry.totalEpisodes} episodes` });
        }
        if (entry.certification)
          facts.createSpan({ cls: "reel-badge cert", text: entry.certification });
        if (entry.imdbRating != null) {
          const votes = entry.imdbVotes ? ` (${compactCount(entry.imdbVotes)})` : "";
          facts.createSpan({ cls: "reel-dim", text: `IMDb ${entry.imdbRating.toFixed(1)}${votes}` });
        }
        if (entry.metacritic != null)
          facts.createSpan({ cls: "reel-dim", text: `MC ${entry.metacritic}` });
        if (!facts.childElementCount)
          facts.remove();
        const people = entry.type === "tv" ? entry.creators : entry.director;
        const names = [...people.map(unlink), ...entry.cast.slice(0, 2).map(unlink)].filter(Boolean);
        if (names.length)
          body.createDiv({ cls: "reel-row-people", text: names.join(" \xB7 ") });
        if (entry.overview)
          body.createDiv({ cls: "reel-row-overview", text: entry.overview });
      }
      wireCell(plugin2, row, entry, onSelect);
    }
  }

  // src/ui/empty.ts
  function renderEmpty(parent, opts) {
    const wrap = parent.createDiv({ cls: "reel-empty-state" });
    const icon = wrap.createDiv({ cls: "reel-empty-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, opts.icon);
    wrap.createDiv({ cls: "reel-empty-title", text: opts.title });
    if (opts.body)
      wrap.createDiv({ cls: "reel-empty-body", text: opts.body });
    if (opts.actions?.length) {
      const row = wrap.createDiv({ cls: "reel-empty-actions" });
      for (const action of opts.actions) {
        const btn = row.createEl("button", {
          cls: `reel-btn${action.primary ? " mod-cta" : ""}`,
          text: action.label,
          attr: { type: "button" }
        });
        btn.addEventListener("click", action.onClick);
      }
    }
    return wrap;
  }

  // src/render/diary.ts
  function viewings(entries, year) {
    const out = [];
    for (const entry of entries) {
      for (const w of entry.watched) {
        if (!w.date)
          continue;
        if (year && !w.date.startsWith(String(year)))
          continue;
        out.push({ entry, date: w.date, rating: w.rating ?? void 0, rewatch: w.rewatch === true });
      }
      if (entry.type === "tv" && entry.lastWatched?.date) {
        const date = entry.lastWatched.date;
        if (!year || date.startsWith(String(year))) {
          out.push({
            entry,
            date,
            rating: entry.rating ?? void 0,
            rewatch: false,
            episode: `S${entry.lastWatched.season}E${entry.lastWatched.episode}`
          });
        }
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }

  // src/ui/a11y.ts
  function setSelected(el, on, kind = "toggle") {
    el.toggleClass("is-active", on);
    if (kind === "tab") {
      if (on)
        el.setAttr("aria-current", "page");
      else
        el.removeAttribute("aria-current");
      return;
    }
    el.setAttr("aria-pressed", on ? "true" : "false");
  }

  // src/ui/personBadge.ts
  function opinionOf(plugin2, personId) {
    if (!personId)
      return null;
    const held = plugin2.settings.people?.[String(personId)];
    if (!held)
      return null;
    if (held.rating == null && !held.liked)
      return null;
    return held;
  }
  function attachOpinion(el, opinion) {
    if (!opinion)
      return;
    el.addClass("has-opinion");
    if (opinion.rating != null) {
      const badge2 = el.createDiv({ cls: "reel-person-badge", text: String(opinion.rating) });
      badge2.setAttr("aria-label", `You rated ${opinion.name} ${opinion.rating} out of 5`);
      return;
    }
    const badge = el.createDiv({ cls: "reel-person-badge is-liked", text: "\u2665" });
    badge.setAttr("aria-label", `You like ${opinion.name}`);
  }
  function badgePerson(plugin2, el, personId) {
    attachOpinion(el, opinionOf(plugin2, personId));
  }

  // src/ui/titlesSheet.ts
  var TitlesSheet = class extends Modal {
    constructor(plugin2, heading, entries, note) {
      super(plugin2.app);
      this.plugin = plugin2;
      this.heading = heading;
      this.entries = entries;
      this.note = note;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal", "reel-titles-sheet");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.addClass("reel-titles");
      const head = contentEl.createDiv({ cls: "reel-titles-head" });
      head.createDiv({ cls: "reel-titles-title", text: this.heading });
      head.createDiv({
        cls: "reel-titles-count",
        text: `${this.entries.length} ${this.entries.length === 1 ? "title" : "titles"}`
      });
      if (this.note)
        head.createDiv({ cls: "reel-dim", text: this.note });
      if (!this.entries.length) {
        contentEl.createDiv({ cls: "reel-empty", text: "Nothing here yet." });
        return;
      }
      const list = contentEl.createDiv({ cls: "reel-titles-list" });
      for (const entry of this.entries) {
        const row = list.createDiv({ cls: "reel-titles-row" });
        const poster2 = row.createDiv({ cls: "reel-titles-poster" });
        this.plugin.posters.attach(poster2, entry);
        const body = row.createDiv({ cls: "reel-titles-body" });
        body.createDiv({ cls: "reel-titles-name", text: entry.title });
        const meta = body.createDiv({ cls: "reel-titles-meta" });
        const year = entry.year ?? entry.firstAirYear;
        if (year)
          meta.createSpan({ cls: "reel-dim", text: String(year) });
        if (entry.rating != null) {
          renderStarsStatic(meta.createDiv({ cls: "reel-titles-stars" }), entry.rating);
        }
        const last = entry.watched?.[entry.watched.length - 1];
        if (last?.date)
          meta.createSpan({ cls: "reel-dim", text: prettyDate(last.date) });
        row.addEventListener("click", () => {
          this.close();
          void this.plugin.openDetail(entry);
        });
        row.setAttr("role", "button");
        row.setAttr("tabindex", "0");
      }
    }
    onClose() {
      this.contentEl.empty();
    }
  };

  // src/ui/hero.ts
  function cssUrl(path) {
    return path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  function paintHero(plugin2, el, opts) {
    const band = el.createDiv({ cls: opts.compact ? "reel-hero-band is-compact" : "reel-hero-band" });
    const subject = opts.subject;
    if (subject) {
      const local = plugin2.posters.displayUrl(subject);
      const remote = subject.backdropPath ? plugin2.tmdb.posterUrl(subject.backdropPath, "w780") : null;
      if (local || remote) {
        band.addClass("has-backdrop");
        band.toggleClass("has-art", !!remote);
        const wrap = band.createDiv({ cls: "reel-hero-art" });
        if (local) {
          wrap.createDiv({ cls: "reel-hero-art-base" }).setCssProps({ "--reel-backdrop": `url("${cssUrl(local)}")` });
        }
        if (remote) {
          wrap.createEl("img", {
            cls: "reel-hero-art-img",
            attr: { src: remote, alt: "", loading: "lazy", decoding: "async" }
          });
        }
      }
      if (opts.tint !== false) {
        plugin2.swatches.tint(el, plugin2.posters.displayUrl(subject), document.body.hasClass("theme-dark"));
      }
    }
    const line = band.createDiv({ cls: "reel-hero-band-body" });
    line.createDiv({ cls: "reel-hero-band-label", text: opts.label });
    line.createDiv({ cls: "reel-hero-band-title", text: opts.title });
    if (opts.sub)
      line.createDiv({ cls: "reel-hero-band-sub", text: opts.sub });
    return band;
  }

  // src/render/stats.ts
  function paintStats(plugin2, el, opts) {
    el.empty();
    el.addClass("reel-stats");
    const all2 = opts.entries ?? plugin2.visible(plugin2.library.all());
    const films = opts.include === "tv" ? [] : all2.filter((e) => e.type === "film");
    const shows = opts.include === "film" ? [] : all2.filter((e) => e.type === "tv");
    const watched = viewings(films, opts.year).filter((v) => typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.date));
    if (!watched.length && !shows.length) {
      renderEmpty(el, {
        icon: "bar-chart-3",
        title: "Nothing logged yet",
        body: "Every chart here is computed from your own notes, so this fills in as soon as you log something.",
        actions: plugin2 ? [{ label: "Log a film", primary: true, onClick: () => plugin2.openSearch() }] : void 0
      });
      return;
    }
    const allViewings = opts.year ? viewings(films) : watched;
    const years = [...new Set(allViewings.map((v) => v.date.slice(0, 4)))].sort().reverse();
    if (years.length > 1) {
      const bar = el.createDiv({ cls: "reel-chips" });
      const chip = (label, active, year) => {
        const b = bar.createEl("button", { cls: "reel-chip", text: label });
        setSelected(b, active);
        b.addEventListener("click", () => paintStats(plugin2, el, { ...opts, year }));
      };
      chip("All time", opts.year == null, void 0);
      for (const y of years)
        chip(y, opts.year === Number(y), Number(y));
    }
    const filmMinutes = watched.reduce((n2, v) => n2 + (v.entry.runtime ?? 0), 0);
    const episodesSeen = shows.reduce((n2, s) => n2 + s.seasons.reduce((m, x) => m + rangeCount(x.watched), 0), 0);
    const episodeMinutes = shows.reduce(
      (n2, s) => n2 + s.seasons.reduce((m, x) => m + rangeCount(x.watched), 0) * (s.episodeRuntime ?? 0),
      0
    );
    const heroFor = [...watched].sort((a, b) => b.date.localeCompare(a.date))[0]?.entry ?? [...films, ...shows].filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    if (heroFor) {
      paintHero(plugin2, el, {
        label: opts.year ? String(opts.year) : "All time",
        title: `${watched.length} ${watched.length === 1 ? "film" : "films"}${shows.length ? ` \xB7 ${shows.length} series` : ""}`,
        sub: `Most recently \u2014 ${heroFor.title}`,
        subject: heroFor
      });
    }
    const tiles = el.createDiv({ cls: "reel-tiles" });
    const tile = (label, value, sub, go) => {
      const t = tiles.createDiv({ cls: "reel-tile" });
      t.createDiv({ cls: "reel-tile-value", text: value });
      t.createDiv({ cls: "reel-tile-label", text: label });
      if (sub)
        t.createDiv({ cls: "reel-tile-sub", text: sub });
      if (!go)
        return;
      t.createDiv({ cls: "reel-tile-go" });
      t.addClass("is-clickable");
      t.setAttr("role", "button");
      t.setAttr("tabindex", "0");
      t.setAttr("aria-label", `${label} \u2014 ${value}. Show them.`);
      t.addEventListener("click", go);
      t.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          go();
        }
      });
    };
    const rated = watched.map((v) => v.rating ?? v.entry.rating).filter((r) => r != null);
    const show = (heading, entries, note) => () => new TitlesSheet(plugin2, heading, entries, note).open();
    if (films.length) {
      const distinct = new Set(watched.map((v) => v.entry.path)).size;
      const rewatches = watched.filter((v) => v.rewatch).length;
      tile(
        "Films watched",
        String(watched.length),
        `${distinct} distinct \xB7 ${rewatches} rewatches`,
        show("Films watched", [...new Set(watched.map((v) => v.entry))])
      );
      tile("Hours of film", formatMinutes(filmMinutes));
    }
    if (shows.length) {
      tile(
        "Episodes",
        String(episodesSeen),
        `${shows.length} show${shows.length === 1 ? "" : "s"}`,
        show("Series you're watching", shows)
      );
      if (episodeMinutes)
        tile("Hours of TV", formatMinutes(episodeMinutes));
    }
    if (rated.length) {
      const mean = rated.reduce((a, b) => a + b, 0) / rated.length;
      tile(
        "Average rating",
        mean.toFixed(2),
        `${rated.length} rated`,
        show(
          "Everything you've rated",
          [...new Set(watched.map((v) => v.entry))].filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
          "Highest first"
        )
      );
    }
    const paired = films.filter((e) => e.rating != null && e.imdbRating != null).map((e) => ({ entry: e, delta: e.rating - e.imdbRating / 2 }));
    if (paired.length >= 3) {
      const avg = paired.reduce((a, b) => a + b.delta, 0) / paired.length;
      tile(
        "Vs IMDb",
        `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}`,
        avg >= 0 ? "you rate higher than average" : "you rate lower than average"
      );
    }
    if (paired.length && paired.length < 3) {
      tile("Vs IMDb", "\u2014", `rate ${3 - paired.length} more to compare`);
    }
    const streak = currentStreak(watched.map((v) => v.date));
    if (streak > 1)
      tile("Current streak", `${streak} days`);
    const perMonth = watched.length && monthsCovered(watched.map((v) => v.date));
    if (perMonth && perMonth > 1)
      tile("Films per month", (watched.length / perMonth).toFixed(1));
    const watchlist = all2.filter((e) => e.status === "watchlist").length;
    if (watchlist) {
      const rate = perMonth ? watched.length / perMonth : 0;
      tile(
        "On the watchlist",
        String(watchlist),
        rate > 0 ? `${Math.ceil(watchlist / rate)} months at this pace` : void 0,
        show("On the watchlist", all2.filter((e) => e.status === "watchlist"))
      );
    }
    const unrated = films.filter((e) => e.rating == null && e.watched.length).length;
    if (unrated)
      tile("Unrated", String(unrated), "tap to rate them", () => void plugin2.openTab("rate"));
    const people = (pick) => new Set(all2.flatMap((e) => pick(e).map(unlink))).size;
    const actors = people((e) => e.cast);
    const helmers = people((e) => [...e.director, ...e.creators]);
    if (actors)
      tile("Unique actors", String(actors));
    if (helmers)
      tile("Directors & creators", String(helmers));
    if (watched.length && !opts.year) {
      const perDay = /* @__PURE__ */ new Map();
      for (const v of watched)
        perDay.set(v.date, (perDay.get(v.date) ?? 0) + 1);
      const best = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] > 1)
        tile("Busiest day", `${best[1]} films`, prettyDate(best[0]));
    }
    if (watched.length > 4)
      paintHeatmap(plugin2, el, watched, opts, show);
    const seen = [...new Map(watched.map((v) => [v.entry.path, v.entry])).values()];
    const longest = seen.filter((e) => e.runtime).sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0))[0];
    const topRated = seen.filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const mostRewatched = seen.filter((e) => e.watched.length > 1).sort((a, b) => b.watched.length - a.watched.length)[0];
    const facts = [];
    if (topRated.length) {
      facts.push({ label: "Highest rated", value: `${topRated[0].title} \u2014 ${topRated[0].rating}\u2605`, entry: topRated[0] });
    }
    if (topRated.length > 1) {
      const worst = topRated[topRated.length - 1];
      facts.push({ label: "Lowest rated", value: `${worst.title} \u2014 ${worst.rating}\u2605`, entry: worst });
    }
    if (longest) {
      facts.push({ label: "Longest", value: `${longest.title} \u2014 ${formatMinutes(longest.runtime ?? 0)}`, entry: longest });
    }
    if (mostRewatched) {
      facts.push({
        label: "Most rewatched",
        value: `${mostRewatched.title} \u2014 ${mostRewatched.watched.length}\xD7`,
        entry: mostRewatched
      });
    }
    const biggestDivergence = paired.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    if (biggestDivergence && Math.abs(biggestDivergence.delta) >= 1) {
      facts.push({
        label: biggestDivergence.delta > 0 ? "You liked far more than most" : "You liked far less than most",
        value: biggestDivergence.entry.title,
        entry: biggestDivergence.entry
      });
    }
    if (facts.length) {
      const box = el.createDiv({ cls: "reel-facts" });
      for (const f of facts) {
        const row = box.createDiv({ cls: "reel-fact" });
        row.createDiv({ cls: "reel-fact-label", text: f.label });
        row.createDiv({ cls: "reel-fact-value", text: f.value });
        if (!f.entry)
          continue;
        const entry = f.entry;
        row.addClass("is-clickable");
        row.setAttr("role", "button");
        row.setAttr("tabindex", "0");
        row.setAttr("aria-label", `${f.label}: ${entry.title}. Open it.`);
        const open = () => void plugin2.openDetail(entry);
        row.addEventListener("click", open);
        row.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            open();
          }
        });
      }
    }
    const charts = el.createDiv({ cls: "reel-chart-grid" });
    if (!opts.year && watched.length) {
      const byYear = /* @__PURE__ */ new Map();
      for (const v of watched) {
        const y = v.date.slice(0, 4);
        byYear.set(y, (byYear.get(y) ?? 0) + 1);
      }
      bars(
        charts,
        "Films per year",
        [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, n2]) => ({ label, n: n2, go: () => paintStats(plugin2, el, { ...opts, year: Number(label) }) })),
        "",
        plugin2
      );
    }
    const trimEmpty = (rows2) => {
      let first = 0;
      let last = rows2.length - 1;
      while (first <= last && rows2[first].n === 0)
        first++;
      while (last >= first && rows2[last].n === 0)
        last--;
      return rows2.slice(first, last + 1);
    };
    if (watched.length) {
      const byMonth = new Array(12).fill(0);
      for (const v of watched)
        byMonth[parseInt(v.date.slice(5, 7), 10) - 1]++;
      const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      if (byMonth.some((n2) => n2 > 0)) {
        const monthEntries = (i) => [
          ...new Set(watched.filter((v) => parseInt(v.date.slice(5, 7), 10) - 1 === i).map((v) => v.entry))
        ];
        bars(
          charts,
          "By month",
          trimEmpty(
            byMonth.map((n2, i) => {
              const rows2 = n2 ? monthEntries(i) : [];
              return {
                label: names[i],
                n: n2,
                entries: rows2,
                go: n2 ? () => new TitlesSheet(plugin2, names[i], rows2, `Watched in ${names[i]}`).open() : void 0
              };
            })
          )
        );
      }
      const byWeekday = new Array(7).fill(0);
      for (const v of watched) {
        const d = /* @__PURE__ */ new Date(v.date + "T00:00:00");
        if (!Number.isNaN(d.getTime()))
          byWeekday[d.getDay()]++;
      }
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      if (byWeekday.some((n2) => n2 > 0)) {
        bars(
          charts,
          "By day of week",
          byWeekday.map((n2, i) => {
            const rows2 = n2 ? [...new Set(watched.filter((v) => (/* @__PURE__ */ new Date(v.date + "T00:00:00")).getDay() === i).map((v) => v.entry))] : [];
            return {
              label: days[i],
              n: n2,
              entries: rows2,
              go: n2 ? () => new TitlesSheet(plugin2, days[i], rows2, `Watched on a ${days[i]}`).open() : void 0
            };
          })
        );
      }
    }
    if (rated.length) {
      const buckets = [];
      for (let r = STEP; r <= MAX_STARS; r += STEP) {
        buckets.push({ label: r.toString(), n: rated.filter((x) => Math.abs(x - r) < 0.01).length });
      }
      bars(charts, "Rating distribution", buckets);
    }
    const seenFilms = films.filter((e) => e.watched.length > 0);
    const seenShows = shows.filter((e) => e.seasons.some((x) => rangeCount(x.watched) > 0));
    const seenAll = [...seenFilms, ...seenShows];
    if (seenFilms.length) {
      tally(charts, "Top directors", seenFilms, (e) => e.director.map(unlink), void 0, void 0, plugin2);
      ratedBy(charts, "Directors you rate highest", seenFilms, (e) => e.director.map(unlink), 2, plugin2, true);
      tally(charts, "Top actors", seenFilms, (e) => e.cast.map(unlink), void 0, void 0, plugin2, true);
      tally(charts, "Recurring characters", seenFilms, (e) => e.characters, void 0, void 0, plugin2, false, true);
    }
    if (seenShows.length) {
      tally(charts, "Top creators", seenShows, (e) => e.creators.map(unlink), void 0, void 0, plugin2);
      tally(charts, "Top actors \u2014 TV", seenShows, (e) => e.cast.map(unlink), void 0, void 0, plugin2, true);
    }
    tally(charts, "Genres", seenAll, (e) => e.genres, 10, void 0, plugin2);
    ratedBy(charts, "Genres you rate highest", seenFilms, (e) => e.genres, 3, plugin2);
    tally(charts, "Top collections", seenAll, (e) => e.collection ? [e.collection] : [], void 0, void 0, plugin2);
    tally(charts, "Certifications", seenAll, (e) => e.certification ? [e.certification] : [], 8, 1, plugin2);
    providerSplit(charts, all2, plugin2);
    tally(charts, "Studios", seenAll, (e) => e.productionCompanies, 6, void 0, plugin2);
    tally(charts, "Languages", seenAll, (e) => e.language ? [e.language] : [], 6, 1, plugin2);
    tally(
      charts,
      "Top release years",
      seenAll,
      (e) => {
        const y = e.year ?? e.firstAirYear;
        return y ? [String(y)] : [];
      },
      6,
      1
    );
    const withBudget = films.filter((e) => (e.budget ?? 0) > 0);
    const withRevenue = films.filter((e) => (e.revenue ?? 0) > 0);
    if (withBudget.length) {
      bars(
        charts,
        "Biggest budgets ($M)",
        [...withBudget].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)).slice(0, 5).map((e) => ({ label: e.title, n: Math.round((e.budget ?? 0) / 1e6) }))
      );
      bars(
        charts,
        "Smallest budgets ($M)",
        [...withBudget].sort((a, b) => (a.budget ?? 0) - (b.budget ?? 0)).slice(0, 5).map((e) => ({ label: e.title, n: Math.round((e.budget ?? 0) / 1e6) }))
      );
    }
    if (withRevenue.length) {
      bars(
        charts,
        "Highest grossing ($M)",
        [...withRevenue].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)).slice(0, 5).map((e) => ({ label: e.title, n: Math.round((e.revenue ?? 0) / 1e6) }))
      );
      bars(
        charts,
        "Lowest grossing ($M)",
        [...withRevenue].sort((a, b) => (a.revenue ?? 0) - (b.revenue ?? 0)).slice(0, 5).map((e) => ({ label: e.title, n: Math.round((e.revenue ?? 0) / 1e6) }))
      );
    }
    const ratios = films.filter((e) => (e.budget ?? 0) > 0 && (e.revenue ?? 0) > 0).map((e) => ({ entry: e, x: (e.revenue ?? 0) / (e.budget ?? 1) }));
    if (ratios.length) {
      bars(
        charts,
        "Overperformers (\xD7 budget)",
        [...ratios].sort((a, b) => b.x - a.x).slice(0, 5).map((r) => ({ label: r.entry.title, n: Math.round(r.x * 10) / 10 })),
        "\xD7"
      );
      bars(
        charts,
        "Underperformers (\xD7 budget)",
        [...ratios].sort((a, b) => a.x - b.x).slice(0, 5).map((r) => ({ label: r.entry.title, n: Math.round(r.x * 10) / 10 })),
        "\xD7"
      );
    }
    const decades = /* @__PURE__ */ new Map();
    for (const e of seenAll) {
      const y = e.year ?? e.firstAirYear;
      if (y) {
        const d = `${Math.floor(y / 10) * 10}s`;
        decades.set(d, (decades.get(d) ?? 0) + 1);
      }
    }
    if (decades.size > 1) {
      bars(charts, "By decade", [...decades.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, n2]) => ({ label, n: n2 })));
    }
    if (shows.length) {
      const inProgress = shows.filter((s) => (s.progress ?? 0) > 0 && (s.progress ?? 0) < 100).sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0)).slice(0, 10);
      if (inProgress.length) {
        bars(
          charts,
          "Series progress (%)",
          inProgress.map((s) => ({ label: s.title, n: s.progress ?? 0, entries: [s], search: s.title })),
          "",
          plugin2
        );
      }
    }
  }
  function providerSplit(el, rows2, plugin2) {
    const counts = /* @__PURE__ */ new Map();
    for (const e of rows2) {
      for (const p of e.providers) {
        if (!p)
          continue;
        const row = counts.get(p) ?? { films: 0, shows: 0 };
        if (e.type === "tv")
          row.shows++;
        else
          row.films++;
        counts.set(p, row);
      }
    }
    const data = [...counts.entries()].map(([label, c]) => ({
      label,
      n: c.films + c.shows,
      note: `${c.films} film${c.films === 1 ? "" : "s"} \xB7 ${c.shows} series`
    })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, 12);
    bars(el, "Streaming on \u2014 whole library", data, "", plugin2);
  }
  function bars(el, title, data, suffix = "", plugin2) {
    if (!data.length)
      return;
    const max = Math.max(...data.map((d) => d.n), 1);
    const faces = data.some((d) => d.face) ? plugin2?.library.peopleIds() : void 0;
    const box = el.createDiv({ cls: "reel-chart reel-fold" });
    const toggle = box.createDiv({ cls: "reel-fold-toggle" });
    toggle.setAttr("role", "button");
    toggle.setAttr("tabindex", "0");
    toggle.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggle.click();
      }
    });
    const heading = toggle.createDiv({ cls: "reel-fold-heading" });
    heading.createDiv({ cls: "reel-chart-title", text: title });
    const preview = data.slice(0, 3).map((d) => d.label).join(" \xB7 ");
    if (preview)
      heading.createDiv({ cls: "reel-fold-preview", text: preview });
    toggle.createDiv({ cls: "reel-fold-count", text: `${data.length}` });
    const body = box.createDiv({ cls: "reel-chart-body" });
    const setOpen = (open) => {
      box.toggleClass("is-open", open);
      toggle.setAttr("aria-expanded", String(open));
    };
    setOpen(false);
    toggle.addEventListener("click", () => setOpen(!box.hasClass("is-open")));
    for (const d of data) {
      const row = body.createDiv({ cls: "reel-chart-row" });
      const head = row.createDiv({ cls: "reel-chart-head" });
      head.createDiv({ cls: "reel-chart-rank", text: String(data.indexOf(d) + 1) });
      if (d.face && plugin2) {
        const shot = head.createDiv({ cls: "reel-chart-face" });
        plugin2.people.attach(shot, d.face, faces?.get(d.face));
        attachOpinion(shot, opinionOf(plugin2, faces?.get(d.face)));
      }
      const label = head.createDiv({ cls: "reel-chart-label", text: d.label });
      label.setAttr("title", d.note ? `${d.label} \u2014 ${d.note}` : d.label);
      if (d.note)
        label.createDiv({ cls: "reel-chart-sub", text: d.note });
      head.createDiv({ cls: "reel-chart-value", text: `${d.n}${suffix}` });
      const posters = plugin2 && !d.noPosters ? d.entries ?? [] : [];
      if (posters.length) {
        const strip = row.createDiv({ cls: "reel-chart-strip" });
        for (const e of posters.slice(0, 8)) {
          const thumb = strip.createDiv({ cls: "reel-chart-thumb" });
          plugin2?.posters.attach(thumb, e);
        }
        if (posters.length > 8) {
          strip.createDiv({ cls: "reel-chart-more", text: `+${posters.length - 8}` });
        }
      } else {
        const track = row.createDiv({ cls: "reel-chart-track" });
        track.createDiv({ cls: "reel-chart-fill" }).setCssProps({ "--reel-fill": String(d.n / max) });
      }
      if (plugin2 && (d.search || d.go)) {
        row.addClass("is-clickable");
        row.setAttr("role", "button");
        row.setAttr("tabindex", "0");
        row.setAttr("aria-label", d.go ? `Show ${d.label} only` : `Show titles matching ${d.label}`);
        const term = (d.search ?? d.label).toLowerCase();
        const matches = plugin2.visible(plugin2.library.all()).filter(
          (e) => [e.title, ...e.genres ?? [], ...e.director ?? [], ...e.cast ?? [], ...e.creators ?? []].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
        );
        const open = d.go ?? (matches.length ? () => new TitlesSheet(plugin2, d.label, matches, `${title} \u2014 ${d.n}`).open() : () => void plugin2.openViewWithSearch(d.search ?? d.label, "stats"));
        row.addEventListener("click", open);
        row.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            open();
          }
        });
      }
    }
  }
  function tally(el, title, rows2, pick, limit = 8, minCount = 2, plugin2, people = false, bare = false) {
    const floor = rows2.length < 5 ? 1 : minCount;
    const held = /* @__PURE__ */ new Map();
    for (const e of rows2) {
      for (const value of pick(e)) {
        if (!value)
          continue;
        const list = held.get(value) ?? [];
        list.push(e);
        held.set(value, list);
      }
    }
    for (const list of held.values())
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const top = [...held.entries()].filter(([, list]) => list.length >= floor).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, limit).map(([label, list]) => ({
      label,
      n: list.length,
      entries: list,
      search: label,
      ...people ? { face: label, noPosters: true } : {},
      ...bare ? { noPosters: true } : {}
    }));
    bars(el, title, top, "", plugin2);
  }
  function ratedBy(el, title, rows2, pick, min = 2, plugin2, people = false) {
    const sums = /* @__PURE__ */ new Map();
    const held = /* @__PURE__ */ new Map();
    for (const e of rows2) {
      if (e.rating == null)
        continue;
      for (const key of pick(e)) {
        if (!key)
          continue;
        const cur = sums.get(key) ?? { total: 0, n: 0 };
        cur.total += e.rating;
        cur.n++;
        sums.set(key, cur);
        const list = held.get(key) ?? [];
        list.push(e);
        held.set(key, list);
      }
    }
    for (const list of held.values())
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const top = [...sums.entries()].filter(([, v]) => v.n >= min).map(([label, v]) => ({
      label: `${label} (${v.n})`,
      n: Math.round(v.total / v.n * 10) / 10,
      entries: held.get(label),
      // The label carries a count in brackets — searching that string
      // would match nothing, so the search uses the bare key.
      search: label,
      ...people ? { face: label, noPosters: true } : {}
    })).sort((a, b) => b.n - a.n).slice(0, 8);
    bars(el, title, top, "\u2605", plugin2);
  }
  function currentStreak(dates) {
    const seen = new Set(dates);
    if (!seen.size)
      return 0;
    const today = todayISO();
    let cursor = seen.has(today) ? today : shiftDay(today, -1);
    if (!seen.has(cursor))
      return 0;
    let streak = 0;
    while (seen.has(cursor)) {
      streak++;
      cursor = shiftDay(cursor, -1);
    }
    return streak;
  }
  function shiftDay(iso2, delta) {
    const d = /* @__PURE__ */ new Date(iso2 + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function monthsCovered(dates) {
    if (!dates.length)
      return 0;
    const sorted = [...dates].sort();
    const days = daysBetween(sorted[0], sorted[sorted.length - 1]);
    if (!Number.isFinite(days))
      return 0;
    return Math.max(1, days / 30.4);
  }
  function paintHeatmap(plugin2, el, watched, opts, show) {
    const perDay = /* @__PURE__ */ new Map();
    for (const v of watched) {
      const list = perDay.get(v.date);
      if (list)
        list.push(v.entry);
      else
        perDay.set(v.date, [v.entry]);
    }
    const dates = [...perDay.keys()].sort();
    const lastISO = dates[dates.length - 1];
    if (!lastISO)
      return;
    const end = opts.year ? new Date(Date.UTC(opts.year, 11, 31)) : parseISO(lastISO);
    const start = opts.year ? new Date(Date.UTC(opts.year, 0, 1)) : addDays(end, -363);
    const gridStart = addDays(start, -((start.getUTCDay() + 6) % 7));
    const weeks = Math.ceil((diffDays(gridStart, end) + 1) / 7);
    const box = el.createDiv({ cls: "reel-chart reel-heatmap-box" });
    const head = box.createDiv({ cls: "reel-heatmap-head" });
    head.createDiv({ cls: "reel-chart-title", text: opts.year ? `${opts.year}, day by day` : "The last year" });
    const busiest = [...perDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const peak = Math.max(1, busiest ? busiest[1].length : 1);
    const active = [...perDay.keys()].filter((d) => d >= iso(start) && d <= iso(end)).length;
    head.createDiv({
      cls: "reel-heatmap-sub",
      text: `${active} ${active === 1 ? "day" : "days"} with something on`
    });
    const scroll = box.createDiv({ cls: "reel-heatmap-scroll" });
    const grid = scroll.createDiv({ cls: "reel-heatmap-grid" });
    grid.setCssProps({ "--reel-heat-weeks": String(weeks) });
    const months = grid.createDiv({ cls: "reel-heatmap-months" });
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const day = addDays(gridStart, w * 7);
      const label = months.createDiv({ cls: "reel-heatmap-month" });
      if (day.getUTCMonth() !== lastMonth && day.getUTCDate() <= 7) {
        lastMonth = day.getUTCMonth();
        label.setText(MONTH_SHORT[lastMonth]);
      }
    }
    const cells = grid.createDiv({ cls: "reel-heatmap-cells" });
    for (let w = 0; w < weeks; w++) {
      const col = cells.createDiv({ cls: "reel-heatmap-week" });
      for (let d = 0; d < 7; d++) {
        const day = addDays(gridStart, w * 7 + d);
        const key = iso(day);
        const cell = col.createDiv({ cls: "reel-heatmap-cell" });
        if (day < start || day > end) {
          cell.addClass("is-outside");
          continue;
        }
        const hits = perDay.get(key) ?? [];
        if (!hits.length)
          continue;
        const level = Math.min(4, Math.ceil(hits.length / peak * 4));
        cell.addClass(`is-l${level}`);
        cell.setAttr("title", `${prettyDate(key)} \u2014 ${hits.length} ${hits.length === 1 ? "film" : "films"}`);
        cell.setAttr("role", "button");
        cell.setAttr("tabindex", "0");
        cell.setAttr("aria-label", `${prettyDate(key)}, ${hits.length} watched`);
        const open = show(prettyDate(key), hits, `${hits.length} watched that day`);
        cell.addEventListener("click", open);
        cell.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ")
            return;
          ev.preventDefault();
          open();
        });
      }
    }
    const legend = box.createDiv({ cls: "reel-heatmap-legend" });
    legend.createSpan({ cls: "reel-dim", text: "Less" });
    for (let l = 0; l <= 4; l++) {
      legend.createDiv({ cls: `reel-heatmap-cell${l ? ` is-l${l}` : ""}` });
    }
    legend.createSpan({ cls: "reel-dim", text: "More" });
  }
  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function parseISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  }
  function iso(d) {
    return d.toISOString().slice(0, 10);
  }
  function addDays(d, n2) {
    return new Date(d.getTime() + n2 * 864e5);
  }
  function diffDays(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 864e5);
  }

  // src/util/status.ts
  var FROZEN_STATUSES = /* @__PURE__ */ new Set(["dropped", "paused", "watchlist"]);
  function nextShowStatus(current, watchedCount, total) {
    if (FROZEN_STATUSES.has(String(current ?? "")))
      return null;
    if (!Number.isFinite(total) || total <= 0)
      return null;
    return watchedCount >= total ? "completed" : "watching";
  }

  // src/ui/seasonSheet.ts
  var SeasonSheet = class extends Modal {
    constructor(app2, plugin2, entry, season) {
      super(app2);
      this.plugin = plugin2;
      this.entry = entry;
      this.season = season;
      this.episodes = [];
      this.dirty = false;
      const row = entry.seasons.find((s) => s.n === season);
      this.watched = new Set(parseRange(row?.watched));
      this.ratings = { ...row?.episode_ratings ?? {} };
      this.seasonRating = row?.rating;
    }
    async onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.addClass("reel-season");
      const head = contentEl.createDiv({ cls: "reel-season-head" });
      head.createEl("h3", { text: `${this.entry.title} \u2014 Season ${this.season}` });
      const counter = head.createDiv({ cls: "reel-season-count" });
      const seasonRow = contentEl.createDiv({ cls: "reel-field reel-field-inline" });
      seasonRow.createDiv({ cls: "reel-field-label", text: "Season rating" });
      renderStars(seasonRow.createDiv(), {
        value: this.seasonRating,
        onChange: (v) => {
          this.seasonRating = v;
          this.dirty = true;
        }
      });
      const bulk = contentEl.createDiv({ cls: "reel-season-bulk" });
      const listEl = contentEl.createDiv({ cls: "reel-episodes" });
      listEl.createDiv({ cls: "reel-loading", text: "Loading episodes\u2026", attr: { role: "status" } });
      const ended = this.entry.showStatus === "Ended" || this.entry.showStatus === "Canceled";
      try {
        const data = await this.plugin.tmdb.getSeason(this.entry.tmdbId, this.season, ended);
        this.episodes = (data.episodes ?? []).filter((e) => e.episode_number > 0);
      } catch (e) {
        listEl.empty();
        listEl.createDiv({ cls: "reel-error", text: redact(e) });
        return;
      }
      const paintCount = () => counter.setText(`${this.watched.size} / ${this.episodes.length} watched`);
      const rows2 = /* @__PURE__ */ new Map();
      const paintRow = (row, n2) => row.toggleClass("is-watched", this.watched.has(n2));
      listEl.empty();
      for (const ep of this.episodes) {
        const n2 = ep.episode_number;
        const row = listEl.createDiv({ cls: "reel-episode" });
        rows2.set(n2, row);
        const tick = row.createDiv({ cls: "reel-episode-tick" });
        tick.createSpan({ text: "\u2713" });
        tick.setAttr("aria-label", `Episode ${n2}`);
        tick.setAttr("role", "button");
        tick.setAttr("aria-label", `Mark episode ${n2} watched`);
        tick.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.watched.has(n2))
            this.watched.delete(n2);
          else
            this.watched.add(n2);
          this.dirty = true;
          paintRow(row, n2);
          paintCount();
        });
        const body = row.createDiv({ cls: "reel-episode-body" });
        body.createDiv({ cls: "reel-episode-title", text: `${n2}. ${ep.name ?? `Episode ${n2}`}` });
        const meta = body.createDiv({ cls: "reel-episode-meta" });
        if (ep.air_date)
          meta.createSpan({ text: prettyDate(ep.air_date) });
        if (ep.runtime)
          meta.createSpan({ text: `${ep.runtime}m` });
        renderStars(body.createDiv({ cls: "reel-episode-stars" }), {
          value: this.ratings[String(n2)],
          compact: true,
          onChange: (v) => {
            if (v == null)
              delete this.ratings[String(n2)];
            else {
              this.ratings[String(n2)] = v;
              this.watched.add(n2);
            }
            this.dirty = true;
            paintRow(row, n2);
            paintCount();
          }
        });
        paintRow(row, n2);
      }
      paintCount();
      const bulkBtn = (label, fn) => {
        const b = bulk.createEl("button", { cls: "reel-chip", text: label });
        b.addEventListener("click", () => {
          fn();
          this.dirty = true;
          rows2.forEach((row, n2) => paintRow(row, n2));
          paintCount();
        });
      };
      bulkBtn("Mark all", () => this.episodes.forEach((e) => this.watched.add(e.episode_number)));
      bulkBtn("Clear", () => this.watched.clear());
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
      cancel.addEventListener("click", () => {
        this.dirty = false;
        this.close();
      });
      const save = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Save" });
      save.addEventListener("click", async () => {
        await this.persist();
        this.close();
      });
    }
    /**
     * One write for the whole season rather than one per episode — "mark all"
     * on a 23-episode season would otherwise queue 23 file writes.
     */
    async persist() {
      if (!this.dirty)
        return;
      const file = this.app.vault.getAbstractFileByPath(this.entry.path);
      if (!(file instanceof TFile))
        return;
      try {
        await this.plugin.notes.edit(file, `the season ${this.season} changes`, (fm) => {
          const seasons = Array.isArray(fm.seasons) ? [...fm.seasons] : [];
          let row = seasons.find((s) => Number(s.n) === this.season);
          if (!row) {
            row = { n: this.season, watched: "" };
            seasons.push(row);
            seasons.sort((a, b) => Number(a.n) - Number(b.n));
          }
          row.watched = formatRange([...this.watched]);
          const kept = {};
          for (const [k, v] of Object.entries(this.ratings)) {
            if (this.watched.has(Number(k)))
              kept[k] = v;
          }
          if (Object.keys(kept).length)
            row.episode_ratings = kept;
          else
            delete row.episode_ratings;
          if (this.seasonRating != null)
            row.rating = this.seasonRating;
          else
            delete row.rating;
          fm.seasons = seasons;
          const furthest = Math.max(0, ...[...this.watched]);
          if (furthest > 0)
            fm.last_watched = { season: this.season, episode: furthest, date: todayISO() };
          if (this.watched.size && (fm.status === "watchlist" || !fm.status))
            fm.status = "watching";
          const totalWatched = seasons.reduce(
            (sum, s) => sum + parseRange(s.watched).length,
            0
          );
          const next = nextShowStatus(String(fm.status ?? ""), totalWatched, Number(fm.total_episodes ?? 0));
          if (next)
            fm.status = next;
        });
        this.plugin.undo.offer(`Season ${this.season} updated`);
      } catch (e) {
        new Notice(`Reel: ${redact(e)}`);
      }
    }
    onClose() {
      this.contentEl.empty();
    }
  };

  // src/render/upnext.ts
  function paintUpNext(plugin2, containerEl, limit, heading = false, entries) {
    new UpNextPainter(plugin2, containerEl, limit, heading, entries).render();
  }
  var UpNextPainter = class {
    constructor(plugin2, containerEl, limit, heading = false, entries) {
      this.plugin = plugin2;
      this.containerEl = containerEl;
      this.limit = limit;
      this.heading = heading;
      this.entries = entries;
    }
    render() {
      const el = this.containerEl;
      el.empty();
      if (this.heading)
        el.createDiv({ cls: "reel-block-title", text: "Up next" });
      const inProgress = this.plugin.visible(this.plugin.library.inProgress());
      const everything = this.entries ? inProgress.filter((e) => this.entries?.some((v) => v.path === e.path)) : inProgress;
      const cap = this.limit ?? 12;
      let rows2 = everything.slice(0, cap);
      const hidden = everything.length - rows2.length;
      if (!rows2.length) {
        const bare = !this.plugin.library.shows().length;
        renderEmpty(el, {
          icon: "tv",
          title: bare ? "No series yet" : "Nothing part-watched",
          body: bare ? "Add a series and this becomes the screen you open every night \u2014 one row per show, one tap to tick the next episode." : "Every series you have is either finished or not started. Tick an episode and it appears here.",
          actions: [
            {
              label: bare ? "Find a series" : "Add a series",
              primary: true,
              onClick: () => this.plugin.openSearch()
            }
          ]
        });
        return;
      }
      const list = el.createDiv({ cls: "reel-upnext" });
      if (hidden > 0) {
        const more = el.createDiv({ cls: "reel-block-count" });
        const btn = more.createEl("button", { cls: "reel-chip", text: `Show ${hidden} more` });
        btn.addEventListener("click", () => {
          for (const entry of everything.slice(cap))
            list.appendChild(this.row(entry));
          more.remove();
        });
      }
      for (const entry of rows2)
        list.appendChild(this.row(entry));
    }
    /** One row. Detached, so it can be appended lazily by 'show more'. */
    row(entry) {
      const next = this.plugin.upNext.nextFor(entry);
      const row = createDiv({ cls: "reel-upnext-row" });
      const thumb = row.createDiv({ cls: "reel-upnext-thumb" });
      this.plugin.posters.attach(thumb, entry);
      thumb.addEventListener("click", () => void this.plugin.openDetail(entry));
      const body = row.createDiv({ cls: "reel-upnext-body" });
      const title = body.createDiv({ cls: "reel-upnext-title" });
      title.createSpan({ text: entry.title });
      if (this.plugin.upNext.airingToday(entry)) {
        title.createSpan({ cls: "reel-badge new", text: "New" });
      }
      const total = entry.totalEpisodes ?? 0;
      const seen = entry.seasons.reduce((n2, s) => n2 + rangeCount(s.watched), 0);
      const meta = body.createDiv({ cls: "reel-upnext-meta" });
      if (next)
        meta.createSpan({ cls: "reel-upnext-ep", text: `S${next.season}E${next.episode}` });
      else
        meta.createSpan({ cls: "reel-dim", text: "All caught up" });
      if (total)
        meta.createSpan({ cls: "reel-dim", text: `${seen}/${total} \xB7 ${Math.round(seen / total * 100)}%` });
      if (entry.lastWatched?.date)
        meta.createSpan({ cls: "reel-dim", text: prettyDate(entry.lastWatched.date) });
      if (total) {
        const bar = body.createDiv({ cls: "reel-progress" });
        bar.setCssProps({ "--reel-fill": String(Math.min(1, seen / total)) });
        bar.setAttr("aria-label", `${seen} of ${total} episodes`);
      }
      const actions = row.createDiv({ cls: "reel-upnext-actions" });
      if (next) {
        const tick = actions.createEl("button", {
          cls: "reel-tick",
          text: "\u2713",
          attr: { type: "button" }
        });
        tick.setAttr("aria-label", `Mark S${next.season}E${next.episode} watched`);
        tick.addEventListener("click", async (e) => {
          e.stopPropagation();
          const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
          if (!(file instanceof TFile))
            return;
          haptic("tick");
          tick.setAttr("disabled", "true");
          try {
            await this.plugin.notes.markEpisode(file, next.season, next.episode);
          } catch (err) {
            new Notice(`Reel: ${redact(err)}`);
            tick.removeAttribute("disabled");
          }
        });
      }
      const more = actions.createEl("button", { cls: "reel-more", text: "\u22EF" });
      more.setAttr("aria-label", "Open season");
      more.addEventListener("click", (e) => {
        e.stopPropagation();
        new SeasonSheet(this.plugin.app, this.plugin, entry, next?.season ?? 1).open();
      });
      return row;
    }
  };

  // src/ui/skeleton.ts
  function skeletonCards(parent, count = 6, label = "Loading") {
    const strip = parent.createDiv({ cls: "reel-skel-strip", attr: { role: "status", "aria-label": label } });
    for (let i = 0; i < count; i++) {
      const card = strip.createDiv({ cls: "reel-skel-card" });
      card.createDiv({ cls: "reel-skel reel-skel-poster" });
      card.createDiv({ cls: "reel-skel reel-skel-line" });
      card.createDiv({ cls: "reel-skel reel-skel-line is-short" });
    }
    return strip;
  }
  function skeletonGrid(parent, count = 12, label = "Loading") {
    const grid = parent.createDiv({ cls: "reel-skel-grid", attr: { role: "status", "aria-label": label } });
    for (let i = 0; i < count; i++)
      grid.createDiv({ cls: "reel-skel reel-skel-poster" });
    return grid;
  }

  // src/ui/logSheet.ts
  var LogSheet = class extends Modal {
    constructor(app2, plugin2, opts) {
      super(app2);
      this.plugin = plugin2;
      this.opts = opts;
      this.date = todayISO();
      this.liked = false;
      this.review = "";
      this.busy = false;
      this.asWatchlist = opts.watchlist ?? false;
      this.rating = opts.entry?.rating;
      this.liked = opts.entry?.liked ?? false;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.addClass("reel-log");
      const isTv = (this.opts.entry?.type ?? this.opts.pending?.type) === "tv";
      const title = this.opts.entry?.title ?? this.opts.pending?.title ?? "";
      const isNew = !!this.opts.pending;
      const rewatchCount = this.opts.entry?.watched.length ?? 0;
      contentEl.createEl("h3", { cls: "reel-log-title", text: title });
      const sub = contentEl.createDiv({ cls: "reel-log-sub" });
      if (isTv)
        sub.setText(isNew ? "Adding a series \u2014 track episodes from its note." : "Series");
      else if (rewatchCount > 0)
        sub.setText(`Rewatch \u2014 ${rewatchCount} previous viewing${rewatchCount === 1 ? "" : "s"}`);
      else
        sub.setText("First viewing");
      const modeRow = contentEl.createDiv({ cls: "reel-seg" });
      const logBtn = modeRow.createEl("button", { cls: "reel-seg-btn", text: isTv ? "Watching" : "Watched" });
      const listBtn = modeRow.createEl("button", { cls: "reel-seg-btn", text: "Watchlist" });
      const paintMode = () => {
        logBtn.toggleClass("is-active", !this.asWatchlist);
        listBtn.toggleClass("is-active", this.asWatchlist);
        detailsEl.toggleClass("is-hidden", this.asWatchlist);
      };
      logBtn.addEventListener("click", () => {
        this.asWatchlist = false;
        paintMode();
      });
      listBtn.addEventListener("click", () => {
        this.asWatchlist = true;
        paintMode();
      });
      const detailsEl = contentEl.createDiv({ cls: "reel-log-details" });
      if (!isTv) {
        const dateRow = detailsEl.createDiv({ cls: "reel-field" });
        dateRow.createDiv({ cls: "reel-field-label", text: "Watched on" });
        const quick2 = dateRow.createDiv({ cls: "reel-quick-dates" });
        const dateInput = dateRow.createEl("input", {
          cls: "reel-input",
          attr: { type: "date", value: this.date }
        });
        dateInput.addEventListener("change", () => {
          this.date = dateInput.value || todayISO();
          paintChips();
        });
        const chips = [];
        const shortcut = (label, offsetDays) => {
          const d = /* @__PURE__ */ new Date();
          d.setDate(d.getDate() - offsetDays);
          const iso2 = toLocalISO(d);
          const b = quick2.createEl("button", { cls: "reel-chip", text: label });
          b.addEventListener("click", () => {
            this.date = iso2;
            dateInput.value = iso2;
            paintChips();
          });
          chips.push({ el: b, iso: iso2 });
        };
        const paintChips = () => chips.forEach((c) => c.el.toggleClass("is-active", c.iso === this.date));
        shortcut("Today", 0);
        shortcut("Yesterday", 1);
        shortcut("2 days ago", 2);
        paintChips();
      }
      const ratingRow = detailsEl.createDiv({ cls: "reel-field" });
      ratingRow.createDiv({ cls: "reel-field-label", text: "Rating" });
      const ratingValue = ratingRow.createDiv({ cls: "reel-rating-row" });
      renderStars(ratingValue, {
        value: this.rating,
        onChange: (v) => {
          this.rating = v;
          readout.setText(v != null ? `${v}` : "\u2014");
        }
      });
      const readout = ratingValue.createSpan({
        cls: "reel-rating-readout",
        text: this.rating != null ? `${this.rating}` : "\u2014"
      });
      const likeRow = detailsEl.createDiv({ cls: "reel-field reel-field-inline" });
      likeRow.createDiv({ cls: "reel-field-label", text: "Liked" });
      const heart = likeRow.createEl("button", {
        cls: "reel-heart reel-heart-labelled",
        attr: { "aria-pressed": "false", type: "button" }
      });
      const glyph = heart.createSpan({ cls: "reel-heart-glyph" });
      const word = heart.createSpan({ cls: "reel-heart-word" });
      const paintHeart = () => {
        heart.toggleClass("is-on", this.liked);
        heart.setAttr("aria-pressed", String(this.liked));
        heart.setAttr("aria-label", this.liked ? "Liked \u2014 tap to unlike" : "Not liked \u2014 tap to like");
        glyph.setText(this.liked ? "\u2665" : "\u2661");
        word.setText(this.liked ? "Liked" : "Like");
      };
      heart.addEventListener("click", () => {
        this.liked = !this.liked;
        paintHeart();
      });
      paintHeart();
      if (this.plugin.settings.askForReview) {
        const reviewRow = detailsEl.createDiv({ cls: "reel-field" });
        reviewRow.createDiv({ cls: "reel-field-label", text: "Review" });
        const box = reviewRow.createEl("textarea", {
          cls: "reel-input reel-textarea",
          attr: {
            rows: "4",
            placeholder: "What did you think? Appended to the note under a dated heading.",
            enterkeyhint: "enter"
          }
        });
        box.addEventListener("input", () => {
          this.review = box.value;
          box.setCssStyles({ height: "auto" });
          box.setCssStyles({ height: `${Math.min(box.scrollHeight, 240)}px` });
        });
      }
      if (this.opts.entry?.watched.length) {
        const hist = detailsEl.createDiv({ cls: "reel-field" });
        hist.createDiv({ cls: "reel-field-label", text: "History" });
        const list = hist.createDiv({ cls: "reel-history" });
        for (const w of [...this.opts.entry.watched].reverse().slice(0, 5)) {
          const row = list.createDiv({ cls: "reel-history-row" });
          row.createSpan({ text: prettyDate(w.date) });
          if (w.rating != null)
            row.createSpan({ cls: "reel-dim", text: `\u2605 ${w.rating}` });
          if (w.rewatch)
            row.createSpan({ cls: "reel-dim", text: "rewatch" });
        }
      }
      paintMode();
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
      cancel.addEventListener("click", () => this.close());
      const save = actions.createEl("button", { cls: "reel-btn mod-cta", text: isNew ? "Add" : "Save" });
      save.addEventListener("click", () => this.submit(save));
    }
    async submit(button) {
      if (this.busy)
        return;
      this.busy = true;
      button.setText("Saving\u2026");
      button.setAttr("disabled", "true");
      try {
        const payload = {
          date: this.date,
          rating: this.rating,
          liked: this.liked,
          watchlist: this.asWatchlist,
          review: this.asWatchlist ? void 0 : this.review
        };
        let file = null;
        if (this.opts.pending) {
          const p = this.opts.pending;
          file = await this.plugin.notes.createFromResult(
            { id: p.id, media_type: p.type === "tv" ? "tv" : "movie" },
            payload
          );
          this.plugin.undo.offer(`Added ${p.title}`);
        } else if (this.opts.file) {
          file = this.opts.file;
          if (this.opts.entry?.type === "tv") {
            await this.plugin.notes.edit(file, `the change to ${file.basename}`, (fm) => {
              if (this.asWatchlist)
                fm.status = "watchlist";
              else if (fm.status === "watchlist")
                fm.status = "watching";
              if (this.rating != null)
                fm.rating = this.rating;
              if (this.liked)
                fm.liked = true;
              else
                delete fm.liked;
            });
            if (payload.review?.trim()) {
              await this.plugin.notes.appendReview(file, this.date, this.rating, payload.review);
            }
          } else {
            await this.plugin.notes.logFilm(file, payload);
          }
          this.plugin.undo.offer("Saved");
        }
        this.close();
        if (file && this.opts.pending && this.plugin.settings.openNoteAfterCreate) {
          await this.app.workspace.getLeaf(false).openFile(file);
        }
      } catch (e) {
        new Notice(`Reel: ${redact(e)}`, 8e3);
        button.setText("Retry");
        button.removeAttribute("disabled");
        this.busy = false;
        return;
      }
      this.busy = false;
    }
    onClose() {
      this.contentEl.empty();
    }
  };
  function toLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // src/ui/searchModal.ts
  var SearchModal = class extends SuggestModal {
    constructor(app2, plugin2, opts = {}) {
      super(app2);
      this.plugin = plugin2;
      this.opts = opts;
      this.results = [];
      this.lastQuery = "";
      this.seq = 0;
      this.resolveResults = null;
      /** 300ms debounce, with a sequence guard so a slow reply can't overwrite a fast one. */
      this.runSearch = debounce(
        async (query) => {
          const ticket = ++this.seq;
          try {
            const results = await this.plugin.tmdb.searchMulti(query);
            if (ticket !== this.seq)
              return;
            this.results = results;
          } catch (e) {
            if (ticket !== this.seq)
              return;
            this.results = [];
            new Notice(`Reel: ${redact(e)}`);
          }
          this.resolveResults?.(this.results);
          this.resolveResults = null;
        },
        300,
        true
      );
      this.setPlaceholder(
        opts.placeholder ?? (opts.watchlist ? "Add to watchlist \u2014 search TMDB\u2026" : "Search TMDB for a film or show\u2026")
      );
      this.limit = 20;
      this.modalEl.addClass("reel-modal", "reel-search");
      this.setInstructions([
        { command: "\u2191\u2193", purpose: "navigate" },
        { command: "\u21B5", purpose: "select" },
        { command: "esc", purpose: "dismiss" },
        // Results are capped at 20; without saying so, a missing title
        // looks like TMDB doesn't have it rather than like a cut-off list.
        { command: "20 max", purpose: "add words to narrow" }
      ]);
      if (opts.query) {
        this.inputEl.value = opts.query;
        window.setTimeout(() => this.inputEl.dispatchEvent(new Event("input")), 0);
      }
    }
    async getSuggestions(query) {
      const q = query.trim();
      if (q.length < 2) {
        this.results = [];
        return [];
      }
      if (q === this.lastQuery && this.results.length)
        return this.results;
      this.lastQuery = q;
      return new Promise((resolve) => {
        this.resolveResults?.(this.results);
        this.resolveResults = resolve;
        this.runSearch(q);
      });
    }
    renderSuggestion(item, el) {
      el.addClass("reel-suggestion");
      const isTv = item.media_type === "tv";
      const title = isTv ? item.name ?? "Untitled" : item.title ?? "Untitled";
      const year = yearOf(isTv ? item.first_air_date : item.release_date);
      const thumb = el.createDiv({ cls: "reel-suggestion-thumb" });
      const url = this.plugin.tmdb.posterUrl(item.poster_path, "w92");
      if (url) {
        const img = thumb.createEl("img", { attr: { src: url, loading: "lazy", alt: "" } });
        img.addEventListener("error", () => {
          img.remove();
          thumb.addClass("is-empty");
        });
      } else {
        thumb.addClass("is-empty");
      }
      const body = el.createDiv({ cls: "reel-suggestion-body" });
      const line = body.createDiv({ cls: "reel-suggestion-title" });
      line.createSpan({ text: title });
      if (year)
        line.createSpan({ cls: "reel-dim", text: ` ${year}` });
      const meta = body.createDiv({ cls: "reel-suggestion-meta" });
      meta.createSpan({ cls: `reel-badge ${isTv ? "tv" : "film"}`, text: isTv ? "Series" : "Film" });
      const existing = this.plugin.library.byTmdbId(item.id, isTv ? "tv" : "film");
      if (existing)
        meta.createSpan({ cls: "reel-badge in-library", text: "In library" });
      if (item.vote_average)
        meta.createSpan({ cls: "reel-dim", text: `\u2605 ${item.vote_average.toFixed(1)}` });
    }
    async onChooseSuggestion(item) {
      if (this.opts.onPick) {
        this.opts.onPick(item);
        return;
      }
      const isTv = item.media_type === "tv";
      const type = isTv ? "tv" : "film";
      const existing = this.plugin.library.byTmdbId(item.id, type);
      if (existing) {
        const file = this.app.vault.getAbstractFileByPath(existing.path);
        if (file instanceof TFile) {
          new LogSheet(this.app, this.plugin, { file, entry: existing }).open();
          return;
        }
      }
      new LogSheet(this.app, this.plugin, {
        pending: { id: item.id, type, title: isTv ? item.name ?? "" : item.title ?? "" },
        watchlist: this.opts.watchlist
      }).open();
    }
  };

  // src/extract.ts
  function trailerUrl(videos) {
    if (!videos?.length)
      return void 0;
    const youtube = videos.filter((v) => v.site === "YouTube" && v.key);
    const pick = youtube.find((v) => v.type === "Trailer" && v.official) ?? youtube.find((v) => v.type === "Trailer") ?? youtube.find((v) => v.type === "Teaser") ?? youtube[0];
    return pick?.key ? `https://www.youtube.com/watch?v=${pick.key}` : void 0;
  }
  function providerNames(block, region) {
    const results = block?.results;
    const row = results?.[region];
    if (!row)
      return [];
    const names = [...row.flatrate ?? [], ...row.free ?? []].map((p) => p.provider_name);
    return [...new Set(names)];
  }
  function keywordNames(film2) {
    const asFilm = film2.keywords?.keywords;
    const asShow = film2.keywords?.results;
    return (asFilm ?? asShow ?? []).map((k) => k.name).filter(Boolean);
  }
  function imdbUrl(imdbId) {
    return imdbId ? `https://www.imdb.com/title/${imdbId}/` : void 0;
  }
  function tmdbUrl(tmdbId, type) {
    return `https://www.themoviedb.org/${type === "tv" ? "tv" : "movie"}/${tmdbId}`;
  }

  // src/util/failure.ts
  function diagnose(status, online) {
    if (!online) {
      return {
        kind: "offline",
        message: "You're offline. Your library, diary and stats all still work \u2014 only new lookups need a connection.",
        retryable: true
      };
    }
    if (status === 401 || status === 403) {
      return {
        kind: "auth",
        message: "TMDB rejected the key. Check it in Settings \u2192 Reel.",
        // Retrying an unchanged bad key fails identically every time, so
        // offering it would be a button that cannot work.
        retryable: false,
        settings: true
      };
    }
    if (status === 404) {
      return {
        kind: "missing",
        message: "TMDB has no record of that. It may have been merged or removed.",
        retryable: false
      };
    }
    if (status === 429) {
      return {
        kind: "rate",
        message: "TMDB is rate limiting. Wait a few seconds and try again.",
        retryable: true
      };
    }
    if (status != null && status >= 500) {
      return {
        kind: "server",
        message: "TMDB is having trouble. Nothing wrong on your end.",
        retryable: true
      };
    }
    return {
      kind: "unknown",
      message: "That didn't work.",
      retryable: true
    };
  }
  function worthReporting(kind, background) {
    if (!background)
      return true;
    return kind !== "offline";
  }

  // src/credentials.ts
  var KEY_LABELS = {
    tmdb: "TMDB",
    omdb: "OMDb",
    dtdd: "DoesTheDogDie"
  };
  var MissingKeyError = class extends Error {
    constructor(key = "tmdb", msg) {
      super(msg ?? `No ${KEY_LABELS[key]} key. Add one in Settings \u2192 Reel.`);
      this.key = key;
      this.name = "MissingKeyError";
    }
  };

  // src/tmdb.ts
  var TmdbError = class extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
      this.name = "TmdbError";
    }
  };

  // src/ui/failure.ts
  function diagnoseError(error) {
    if (error instanceof MissingKeyError) {
      return {
        kind: "auth",
        message: "No TMDB key is unlocked. Add or unlock one in Settings \u2192 Reel.",
        retryable: false,
        settings: true
      };
    }
    const status = error instanceof TmdbError ? error.status : void 0;
    return diagnose(status, navigator.onLine !== false);
  }
  function reportFailure(error, opts = {}) {
    const d = diagnoseError(error);
    if (!worthReporting(d.kind, opts.background === true)) {
      console.warn("Reel: offline \u2014", opts.context ?? "background work", "skipped");
      return d;
    }
    if (d.kind === "unknown")
      console.warn("Reel:", opts.context ?? "failed", redact(error));
    const notice = new Notice("", d.retryable ? 12e3 : 9e3);
    const el = notice.noticeEl;
    el.addClass("reel-undo-notice");
    el.createSpan({ text: opts.context ? `${opts.context} \u2014 ${d.message}` : d.message });
    if (d.settings)
      return d;
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

  // src/util/gesture.ts
  var HORIZONTAL_MIN = 60;
  var VERTICAL_MIN = 140;
  var STRAIGHTNESS = 1.5;
  function gestureIntent(drag) {
    const { dx, dy, atTop, canUndo } = drag;
    if (atTop && canUndo && dy > VERTICAL_MIN && Math.abs(dy) > Math.abs(dx) * STRAIGHTNESS) {
      return "undo";
    }
    if (Math.abs(dx) < HORIZONTAL_MIN || Math.abs(dx) < Math.abs(dy) * STRAIGHTNESS)
      return "none";
    return dx < 0 ? "next" : "previous";
  }

  // src/ui/titleExtras.ts
  function paintTrailer(slot, url) {
    const id = /[?&]v=([\w-]{6,})/.exec(url)?.[1] ?? /youtu\.be\/([\w-]{6,})/.exec(url)?.[1];
    if (!id) {
      const link = slot.createEl("a", { cls: "reel-btn mod-cta reel-trailer-btn", text: "\u25B6  Watch trailer", href: url });
      link.setAttr("target", "_blank");
      link.setAttr("rel", "noopener");
      return;
    }
    const box = slot.createDiv({ cls: "reel-trailer" });
    const play = box.createEl("button", { cls: "reel-trailer-play", attr: { type: "button" } });
    play.createEl("img", { attr: { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: "", loading: "lazy" } });
    play.createDiv({ cls: "reel-trailer-icon", text: "\u25B6" });
    play.setAttr("aria-label", "Play the trailer");
    play.addEventListener("click", () => {
      const frame = box.createEl("iframe", {
        cls: "reel-trailer-frame",
        attr: {
          src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
          title: "Trailer",
          allow: "accelerometer; autoplay; encrypted-media; picture-in-picture",
          allowfullscreen: "true",
          frameborder: "0"
        }
      });
      play.remove();
      frame.focus();
    });
  }
  function paintLinks(slot, meta, isTv) {
    const row = slot.createDiv({ cls: "reel-preview-links" });
    const link = (text, href) => {
      const a = row.createEl("a", { cls: "reel-chip", text, href });
      a.setAttr("target", "_blank");
      a.setAttr("rel", "noopener");
    };
    const raw = meta.external_ids?.imdb_id ?? meta.imdb_id ?? void 0;
    const imdb = imdbUrl(raw ?? void 0);
    if (imdb) {
      link("IMDb", imdb);
      link("Parents guide", `${imdb}parentalguide`);
    }
    link("TMDB", tmdbUrl(meta.id, isTv ? "tv" : "film"));
  }
  function paintCast(plugin2, slot, meta, isTv) {
    const credits = isTv ? meta.aggregate_credits : meta.credits;
    const cast = (credits?.cast ?? []).slice(0, 12);
    if (!cast.length)
      return;
    const strip = slot.createDiv({ cls: "reel-caststrip" }).createDiv({ cls: "reel-caststrip-track" });
    for (const person of cast) {
      const card = strip.createDiv({ cls: "reel-castcard" });
      const face = card.createDiv({ cls: "reel-castface" });
      const src = person.profile_path ? plugin2.tmdb.posterUrl(person.profile_path, "w185") : null;
      if (src)
        face.createEl("img", { attr: { src, alt: "", loading: "lazy" } });
      else
        plugin2.people.attach(face, person.name);
      const held = opinionOf(plugin2, person.id);
      if (held) {
        const mark = face.createDiv({ cls: "reel-castmark" });
        if (held.rating != null)
          mark.createSpan({ text: `\u2605 ${held.rating}` });
        else if (held.liked)
          mark.createSpan({ cls: "reel-castmark-heart", text: "\u2665" });
      }
      card.createDiv({ cls: "reel-castname", text: person.name });
      const role = Array.isArray(person.roles) ? (person.roles ?? []).map((r) => r.character).join(", ") : person.character;
      if (role)
        card.createDiv({ cls: "reel-castrole", text: role });
    }
  }
  async function paintExtras(plugin2, slot, id, isTv) {
    try {
      const meta = isTv ? await plugin2.tmdb.getShow(id) : await plugin2.tmdb.getFilm(id);
      const url = trailerUrl(meta.videos?.results);
      if (url)
        paintTrailer(slot, url);
      paintCast(plugin2, slot, meta, isTv);
      paintLinks(slot, meta, isTv);
    } catch {
    }
  }
  async function paintTrailerFor(plugin2, slot, id, isTv, known) {
    if (known) {
      paintTrailer(slot, known);
      return;
    }
    try {
      const meta = isTv ? await plugin2.tmdb.getShow(id) : await plugin2.tmdb.getFilm(id);
      const url = trailerUrl(meta.videos?.results);
      if (url)
        paintTrailer(slot, url);
    } catch {
    }
  }

  // src/ui/discoverView.ts
  var EMPTY = { genreId: null, genreName: null, decade: null, minRating: null, type: "movie" };
  var DiscoverScreen = class {
    constructor(plugin2) {
      this.plugin = plugin2;
      /**
       * The feed as recipes, before any of it has been fetched.
       *
       * Null until a taste profile has been read. Long — sixty-odd rows on a
       * library with ratings in it, and an unbounded popularity tail after that —
       * because the feed is meant not to end.
       */
      this.sources = null;
      /** Sources that have been mounted, in the order they appear. */
      this.feed = [];
      /** Index of the next source to mount. */
      this.nextSource = 0;
      /** One mount at a time, or a fast scroll fires four of them at once. */
      this.mounting = false;
      /** Torn down and rebuilt on every draw, or they accumulate per repaint. */
      this.watchers = [];
      /** Where new rows are appended, so mounting one does not redraw the page. */
      this.feedEl = null;
      /**
       * The view's search box, pointed outward.
       *
       * Discover is the one tab where the library filters mean nothing — it is
       * about titles you do *not* have. But the search box is the same box, and a
       * query that silently did nothing here was most of "the search should work
       * the same no matter what tab you are on".
       */
      this.query = "";
      this.searchResults = null;
      /** What `searchResults` is an answer to, so a new query refetches. */
      this.searchedFor = "";
      /** How many results were dropped for already being in your library. */
      this.searchOwned = 0;
      this.profile = null;
      this.results = null;
      this.genres = [];
      this.filters = { ...EMPTY };
      this.loading = false;
      this.error = null;
      this.handled = /* @__PURE__ */ new Set();
      this.page = 1;
      this.exhausted = false;
      /** "Something like this one" — a title to draw recommendations from. */
      this.seed = null;
      /** One-at-a-time browsing, for when you want to move fast rather than skim. */
      this.quick = false;
      this.quickAt = 0;
      /** Results handed over by the recipe flow, if any. */
      this.shortlist = null;
      /**
       * The title the last quick action handled, and where it sat.
       *
       * Undo has to put back three things, not one: the vault change, the fact
       * that the card was marked handled, and your position in the queue.
       * Reversing only the first leaves a title in your library that the screen
       * still believes you dealt with.
       */
      this.lastAction = null;
      /**
       * Every title the feed has already shown, across all rows.
       *
       * Trending and your top genre overlap heavily, and the same poster turning
       * up in four consecutive shelves is what makes an endless feed feel like a
       * short one on a loop.
       */
      this.seen = /* @__PURE__ */ new Set();
      /**
       * Cards taken out of the feed by an action, newest last.
       *
       * `handled` is a set and says nothing about order, so it cannot answer "which
       * one did I just do". Undo has to put back the last one specifically, and
       * pressing undo twice has to put back two.
       */
      this.handledOrder = [];
      /** The container of the most recent render, so an undo can repaint it. */
      this.lastContainer = null;
    }
    /**
     * The mounted rows, in the shape the rest of the screen already expects.
     *
     * Quick mode and the narrowing pass both read the loaded pool, and neither
     * cares that it now arrives a row at a time.
     */
    get rows() {
      if (!this.sources)
        return null;
      return this.feed.map((f) => ({ id: f.source.id, title: f.source.title, reason: f.source.reason, items: f.items }));
    }
    get filtered() {
      return this.seed != null || this.filters.genreId != null || this.filters.decade != null || this.filters.minRating != null;
    }
    reset() {
      this.seed = null;
      this.sources = null;
      this.feed = [];
      this.nextSource = 0;
      this.mounting = false;
      this.searchResults = null;
      this.searchedFor = "";
      this.profile = null;
      this.results = null;
      this.error = null;
      this.handled.clear();
      this.page = 1;
      this.exhausted = false;
    }
    /**
     * Draw the screen, and never leave it blank.
     *
     * `render` empties the container before it draws. If anything after that
     * throws — and several paths reach here from a `.finally()`, where a throw
     * becomes an unhandled rejection nothing catches — the user is left
     * looking at an empty pane with no explanation. That is the white screen.
     *
     * The view's own `paintTab` has a try/catch, but it only guards the
     * *synchronous* first paint. Every repaint that follows a fetch arrives
     * outside it.
     */
    render(container) {
      this.lastContainer = container;
      try {
        this.draw(container);
      } catch (e) {
        container.empty();
        const box = container.createDiv({ cls: "reel-error-state" });
        box.createDiv({ cls: "reel-empty-title", text: "Discover hit a problem" });
        box.createDiv({ cls: "reel-empty-body", text: redact(e) });
        const again = box.createEl("button", { cls: "reel-btn mod-cta", text: "Start again" });
        again.addEventListener("click", () => {
          this.reset();
          this.quick = false;
          this.shortlist = null;
          this.render(container);
        });
        console.error("Reel: Discover render failed", e);
      }
    }
    draw(container) {
      container.empty();
      container.addClass("reel-discover");
      for (const w of this.watchers)
        w.disconnect();
      this.watchers = [];
      this.feedEl = null;
      const staged = this.plugin.discover.takeStaged();
      if (staged) {
        this.shortlist = staged;
        this.quick = true;
        this.quickAt = 0;
      }
      this.paintFilters(container);
      if (this.error) {
        container.createDiv({ cls: "reel-error", text: this.error });
        const retry = container.createEl("button", { cls: "reel-btn", text: "Try again" });
        retry.addEventListener("click", () => {
          this.error = null;
          this.render(container);
        });
        return;
      }
      if (this.query)
        this.paintSearch(container);
      else if (this.quick)
        this.paintQuick(container);
      else if (this.filtered)
        this.paintResults(container);
      else
        this.paintForYou(container);
    }
    /* ------------------------------------------------------------------ */
    /* Quick mode — one title at a time                                    */
    /* ------------------------------------------------------------------ */
    /**
     * The same pool the rows draw from, flattened and de-duplicated.
     *
     * A title can appear in several rows — trending and your top genre often
     * overlap — and seeing it twice in a linear run reads as the queue being
     * stuck rather than as two separate recommendations.
     */
    quickPool() {
      if (this.shortlist?.length)
        return this.shortlist.filter((i) => !this.handled.has(i.id));
      const source = this.filtered ? this.results ?? [] : (this.rows ?? []).flatMap((r) => r.items);
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      for (const item of source) {
        if (seen.has(item.id) || this.handled.has(item.id))
          continue;
        seen.add(item.id);
        out.push(item);
      }
      return out;
    }
    paintQuick(container) {
      if (!this.filtered && !this.sources) {
        void this.loadRows(container);
        skeletonCards(container, 1, "Loading");
        return;
      }
      if (this.filtered && !this.results) {
        this.paintResults(container);
        return;
      }
      const pool2 = this.quickPool();
      if (!pool2.length) {
        const done = container.createDiv({ cls: "reel-empty" });
        done.createDiv({ text: "Nothing left in this queue." });
        const back = done.createEl("button", { cls: "reel-btn mod-cta", text: "Back to rows" });
        back.addEventListener("click", () => {
          this.quick = false;
          this.render(container);
        });
        return;
      }
      if (this.quickAt >= pool2.length)
        this.quickAt = 0;
      const item = pool2[this.quickAt];
      const isTv = item.media_type === "tv";
      const title = (isTv ? item.name : item.title) ?? "Untitled";
      const card = container.createDiv({ cls: "reel-quickcard" });
      this.plugin.swatches.tint(
        card,
        this.plugin.tmdb.posterUrl(item.poster_path, "w342"),
        document.body.hasClass("theme-dark")
      );
      card.createDiv({ cls: "reel-quickcard-count", text: `${this.quickAt + 1} of ${pool2.length}` });
      const posterEl = card.createDiv({ cls: "reel-quickcard-poster" });
      this.plugin.posters.attach(posterEl, {
        posterUrl: this.plugin.tmdb.posterUrl(item.poster_path, "w500") ?? void 0,
        title
      });
      posterEl.addEventListener("click", () => new PreviewSheet(this.plugin, item, () => this.render(container)).open());
      const head = card.createDiv({ cls: "reel-quickcard-head" });
      head.createSpan({ cls: "reel-quickcard-title", text: title });
      const year = yearOf(isTv ? item.first_air_date : item.release_date);
      if (year)
        head.createSpan({ cls: "reel-dim", text: ` ${year}` });
      const facts = card.createDiv({ cls: "reel-header-facts" });
      facts.createSpan({ cls: `reel-badge ${isTv ? "tv" : "film"}`, text: isTv ? "Series" : "Film" });
      if (item.vote_average)
        facts.createSpan({ cls: "reel-dim", text: `TMDB ${item.vote_average.toFixed(1)}` });
      if (item.overview)
        card.createDiv({ cls: "reel-quickcard-overview", text: item.overview });
      void paintExtras(this.plugin, card.createDiv({ cls: "reel-quickcard-extras" }), item.id, isTv);
      const step = (by) => {
        this.quickAt = Math.max(0, this.quickAt + by);
        this.render(container);
      };
      const actions = card.createDiv({ cls: "reel-quickcard-actions" });
      const skip = actions.createEl("button", { cls: "reel-btn reel-quick-skip", text: "\u2715  Skip" });
      skip.addEventListener("click", () => step(1));
      const later = actions.createEl("button", { cls: "reel-btn mod-cta", text: "+  Watchlist" });
      later.addEventListener("click", () => void this.quickAdd(item, true, container));
      const seen = actions.createEl("button", { cls: "reel-btn", text: "\u2713  Seen it" });
      seen.addEventListener("click", () => {
        const isTvItem = item.media_type === "tv";
        new LogSheet(this.plugin.app, this.plugin, {
          pending: {
            id: item.id,
            type: isTvItem ? "tv" : "film",
            title: (isTvItem ? item.name : item.title) ?? "Untitled"
          }
        }).open();
        this.markHandled(item.id);
        this.render(container);
      });
      const nav = card.createDiv({ cls: "reel-quickcard-nav" });
      const prev = nav.createEl("button", { cls: "reel-btn", text: "\u2039 Back", attr: { type: "button" } });
      prev.toggleClass("is-disabled", this.quickAt === 0);
      prev.addEventListener("click", () => step(-1));
      const never = nav.createEl("button", { cls: "reel-btn", text: "Never show this", attr: { type: "button" } });
      never.addEventListener("click", () => {
        void this.plugin.discover.dismiss(item.id).then(() => {
          this.handled.add(item.id);
          this.render(container);
        });
      });
      const hint = card.createDiv({ cls: "reel-dim reel-quickcard-hint" });
      hint.setText(
        this.lastAction ? "Swipe to move, swipe down to take back the last one. Arrow keys and Z work too." : "Swipe, or use \u2190 and \u2192 on a keyboard."
      );
      if (this.lastAction) {
        const back = card.createEl("button", {
          cls: "reel-chip reel-quick-undo",
          text: "Undo that",
          attr: { type: "button" }
        });
        back.addEventListener("click", () => void this.undoLast(container));
      }
      this.wireSwipe(card, step, () => void this.undoLast(container));
      card.setAttr("tabindex", "0");
      card.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowRight") {
          ev.preventDefault();
          step(1);
        } else if (ev.key === "ArrowLeft") {
          ev.preventDefault();
          step(-1);
        } else if (ev.key === "z" || ev.key === "Z") {
          ev.preventDefault();
          void this.undoLast(container);
        }
      });
      card.focus({ preventScroll: true });
    }
    /** Add from quick mode and advance, so one tap is the whole interaction. */
    async quickAdd(item, watchlist, container) {
      try {
        await this.plugin.notes.createFromResult(item, { date: todayISO(), watchlist });
        haptic("commit");
        this.plugin.undo.offer(watchlist ? "Added to your watchlist" : "Added as watched");
        this.markHandled(item.id);
        this.lastAction = { id: item.id, at: this.quickAt };
        this.render(container);
      } catch (e) {
        new Notice(`Reel: ${redact(e)}`);
      }
    }
    /**
     * Horizontal drag to move through the queue.
     *
     * Only acts when the gesture is clearly sideways: the card scrolls
     * vertically, and a swipe that stole every downward drag would make the
     * overview unreadable on a phone.
     */
    /**
     * Swipe left and right to move, down to take back what you just did.
     *
     * Left and right always worked. What did not was recovering from a
     * mistake: quick mode is built to be fast, so it is the single easiest
     * place to add a title you were only skimming past — and going *back* only
     * showed you a card for something already in your library. The action was
     * gone and the screen said nothing about it.
     *
     * Down rather than up: up is where the browser and Obsidian both put
     * their own gestures, and a third meaning on that axis is a collision
     * waiting to happen.
     */
    wireSwipe(card, step, onUndo) {
      let startX = 0;
      let startY = 0;
      let tracking = false;
      let atTop = false;
      const scroller = () => {
        for (let p = card; p; p = p.parentElement) {
          if (p.scrollHeight > p.clientHeight + 1)
            return p;
        }
        return null;
      };
      card.addEventListener(
        "touchstart",
        (ev) => {
          const t = ev.touches[0];
          if (!t)
            return;
          startX = t.clientX;
          startY = t.clientY;
          tracking = true;
          const s = scroller();
          atTop = !s || s.scrollTop <= 0;
        },
        { passive: true }
      );
      card.addEventListener(
        "touchend",
        (ev) => {
          if (!tracking)
            return;
          tracking = false;
          const t = ev.changedTouches[0];
          if (!t)
            return;
          const dx = t.clientX - startX;
          const dy = t.clientY - startY;
          switch (gestureIntent({ dx, dy, atTop, canUndo: this.lastAction != null })) {
            case "undo":
              onUndo();
              return;
            case "next":
              step(1);
              return;
            case "previous":
              step(-1);
              return;
            default:
              return;
          }
        },
        { passive: true }
      );
    }
    /**
     * Take back the last thing quick mode did.
     *
     * Delegates the vault change to the undo service — it already knows how
     * to reverse an add, including trashing a note it created — and handles
     * the two things only this screen knows about: that the card was marked
     * handled, and where you were when you did it.
     */
    /** Take a card out of the feed, remembering that it was this one. */
    markHandled(id) {
      this.handled.add(id);
      this.handledOrder = [...this.handledOrder.filter((n2) => n2 !== id), id];
    }
    /**
     * Put back whatever the last action removed.
     *
     * Called after an undo lands. Rating a title from the feed used to reverse
     * the vault write and leave the card gone — the note came back and the poster
     * did not, so the undo looked like it had half worked. The screen's own state
     * is not something a vault write can reach, so it has to be told.
     */
    restoreLast() {
      const id = this.handledOrder.pop();
      if (id == null)
        return;
      this.handled.delete(id);
      this.seen.delete(id);
      if (this.lastContainer?.isConnected)
        this.render(this.lastContainer);
    }
    async undoLast(container) {
      const last = this.lastAction;
      if (!last) {
        new Notice("Reel: nothing to take back.");
        return;
      }
      haptic("commit");
      this.lastAction = null;
      await this.plugin.undo.undo();
      this.handled.delete(last.id);
      this.handledOrder = this.handledOrder.filter((n2) => n2 !== last.id);
      this.seen.delete(last.id);
      this.quickAt = last.at;
      this.render(container);
    }
    /* ------------------------------------------------------------------ */
    /* Filter bar                                                          */
    /* ------------------------------------------------------------------ */
    paintFilters(container) {
      const wrap = container.createDiv({ cls: "reel-discover-filters" });
      const launch = wrap.createDiv({ cls: "reel-recipe-launch" });
      const find = launch.createEl("button", { cls: "reel-btn mod-cta", attr: { type: "button" } });
      setIcon(find.createSpan(), "wand-2");
      find.createSpan({ text: "Find something to watch" });
      find.addEventListener("click", () => this.plugin.openRecipe());
      for (const saved of this.plugin.settings.recipes.slice(0, 4)) {
        const b = launch.createEl("button", { cls: "reel-chip", text: saved.name ?? "Recipe", attr: { type: "button" } });
        b.addEventListener("click", () => this.plugin.openRecipe(saved));
        b.addEventListener("contextmenu", async (ev) => {
          ev.preventDefault();
          this.plugin.settings.recipes = this.plugin.settings.recipes.filter((r) => r !== saved);
          await this.plugin.saveSettings();
          this.render(container);
        });
      }
      const row1 = wrap.createDiv({ cls: "reel-chips" });
      const chip = (parent, label, active, onClick) => {
        const b = parent.createEl("button", { cls: "reel-chip", text: label });
        setSelected(b, active);
        b.addEventListener("click", () => {
          onClick();
          this.results = null;
          this.page = 1;
          this.exhausted = false;
          this.render(container);
        });
        return b;
      };
      chip(row1, "For you", !this.filtered, () => {
        this.filters = { ...EMPTY, type: this.filters.type };
      });
      const setType = (next) => {
        if (this.filters.type === next)
          return;
        this.filters.type = next;
        this.sources = null;
        this.feed = [];
        this.nextSource = 0;
        this.genres = [];
        this.filters.genreId = null;
        this.filters.genreName = null;
      };
      chip(row1, "Films", this.filters.type === "movie", () => setType("movie"));
      chip(row1, "Series", this.filters.type === "tv", () => setType("tv"));
      const seedLabel = this.seed ? `Like ${this.seed.title}` : "Like\u2026";
      const seedChip = chip(row1, seedLabel, !!this.seed, () => {
        if (this.seed) {
          this.seed = null;
          return;
        }
        new SearchModal(this.plugin.app, this.plugin, {
          placeholder: "Find me something like\u2026",
          onPick: (item) => {
            this.seed = {
              id: item.id,
              type: item.media_type === "tv" ? "tv" : "movie",
              title: (item.media_type === "tv" ? item.name : item.title) ?? "that"
            };
            this.results = null;
            this.render(container);
          }
        }).open();
      });
      seedChip.addClass("reel-chip-seed");
      const quick2 = chip(row1, "Quick", this.quick, () => {
        this.quick = !this.quick;
        this.quickAt = 0;
      });
      quick2.addClass("reel-chip-mode");
      row1.createSpan({ cls: "reel-chip-sep", text: "\xB7" });
      if (!this.genres.length) {
        void this.plugin.tmdb.genreList(this.filters.type).then((list) => {
          this.genres = list;
          this.render(container);
        }).catch(() => {
        });
      }
      for (const g of this.genres) {
        chip(row1, g.name, this.filters.genreId === g.id, () => {
          const on = this.filters.genreId === g.id;
          this.filters.genreId = on ? null : g.id;
          this.filters.genreName = on ? null : g.name;
        });
      }
      const row2 = wrap.createDiv({ cls: "reel-chips" });
      row2.createSpan({ cls: "reel-dim", text: "Decade" });
      const nowDecade = Math.floor((/* @__PURE__ */ new Date()).getFullYear() / 10) * 10;
      for (let d = nowDecade; d >= 1950; d -= 10) {
        chip(row2, `${d}s`, this.filters.decade === d, () => {
          this.filters.decade = this.filters.decade === d ? null : d;
        });
      }
      row2.createSpan({ cls: "reel-chip-sep", text: "\xB7" });
      row2.createSpan({ cls: "reel-dim", text: "At least" });
      for (const r of [6, 7, 8]) {
        chip(row2, `${r}+`, this.filters.minRating === r, () => {
          this.filters.minRating = this.filters.minRating === r ? null : r;
        });
      }
      if (this.filtered) {
        const clear = row2.createEl("button", { cls: "reel-chip", text: "\u2715 Clear" });
        clear.addEventListener("click", () => {
          this.filters = { ...EMPTY, type: this.filters.type };
          this.results = null;
          this.render(container);
        });
      }
    }
    /* ------------------------------------------------------------------ */
    /* For you                                                             */
    /* ------------------------------------------------------------------ */
    /**
     * Does a title already in hand satisfy the current filters?
     *
     * Used to narrow the shelves without a round trip. The server answers the
     * same question better — it can see every title, not the sixty already
     * loaded — but it cannot answer it *instantly*, and instant is what stops
     * the screen changing shape under you.
     */
    matchesFilters(item) {
      const f = this.filters;
      if (f.minRating != null && (item.vote_average ?? 0) < f.minRating)
        return false;
      if (f.genreId != null && !(item.genre_ids ?? []).includes(f.genreId))
        return false;
      if (f.decade != null) {
        const year = Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4));
        if (!Number.isFinite(year) || year < f.decade || year >= f.decade + 10)
          return false;
      }
      return true;
    }
    /**
     * The bit of the screen that must not move when a filter changes.
     *
     * Shared by the personalised view and the filtered one. Picking a minimum
     * rating used to replace shelves with a flat grid — same data, entirely
     * different screen — so the app appeared to navigate somewhere when the
     * user had only narrowed what they were already looking at. A filter should
     * change what is in the list, never what kind of list it is.
     */
    paintHead(container) {
      const head = container.createDiv({ cls: "reel-discover-head" });
      if (this.profile?.sparse) {
        head.createDiv({
          cls: "reel-discover-note",
          text: "Rate a few films and these become personal \u2014 right now they're just what's popular."
        });
      } else if (this.profile?.genreNames.length) {
        head.createDiv({
          cls: "reel-discover-note",
          text: `Based on your library \u2014 mostly ${this.profile.genreNames.slice(0, 3).join(", ").toLowerCase()}.`
        });
      }
      const reload = head.createEl("button", { cls: "reel-chip reel-refresh", attr: { type: "button" } });
      setIcon(reload.createSpan({ cls: "reel-refresh-icon" }), "refresh-cw");
      reload.createSpan({ text: "Refresh" });
      reload.addEventListener("click", () => {
        reload.addClass("is-spinning");
        this.plugin.discover.reroll();
        void this.plugin.tmdb.clearDiscoverCache().then(() => {
          this.reset();
          this.render(container);
        });
      });
    }
    /**
     * The shelves you were already looking at, narrowed.
     *
     * Drawn before the fetched results and from titles already in memory, so
     * the moment a chip is tapped the screen answers with the same shelves
     * holding fewer things. The fetch then adds what it finds underneath.
     */
    paintNarrowedRows(container) {
      if (!this.rows)
        return false;
      const narrowed = this.rows.map((r) => ({ ...r, items: r.items.filter((i) => !this.handled.has(i.id) && this.matchesFilters(i)) })).filter((r) => r.items.length);
      for (const row of narrowed)
        this.paintStaticRow(container, row);
      return narrowed.length > 0;
    }
    /**
     * A shelf that does not page.
     *
     * These are rows you have already loaded, shown with some of their cards
     * filtered out. Asking such a row for another page would fetch titles the
     * filter is about to discard, so it stays as it is and the fetched results
     * underneath do the widening.
     */
    paintStaticRow(container, row) {
      const items = row.items.filter((i) => !this.handled.has(i.id));
      if (!items.length)
        return;
      const section = container.createDiv({ cls: "reel-drow" });
      const head = section.createDiv({ cls: "reel-drow-head" });
      head.createDiv({ cls: "reel-drow-title", text: row.title });
      if (row.reason)
        head.createDiv({ cls: "reel-drow-reason", text: row.reason });
      const strip = section.createDiv({ cls: "reel-drow-strip" });
      for (const item of items)
        strip.appendChild(this.card(item, container));
    }
    /**
     * The feed.
     *
     * It used to be eight rows, fetched all at once, each holding one page of
     * about twenty cards. Every row ended, the page ended, and tomorrow it said
     * the same thing — which is exactly what "a hardcoded block I cannot refresh"
     * describes.
     *
     * Now both axes keep going. Reaching the end of a row asks that row for its
     * next page; reaching the bottom of the page mounts the next row. The list of
     * rows is long and its tail is unbounded, so there is no last one to reach.
     */
    paintForYou(container) {
      if (!this.sources) {
        container.createDiv({ cls: "reel-loading", text: "Finding things for you\u2026" });
        for (let i = 0; i < 3; i++)
          skeletonCards(container, 6, "Finding things for you");
        if (this.loading)
          return;
        this.loading = true;
        void this.loadRows(container);
        return;
      }
      this.paintHead(container);
      const feedEl = container.createDiv({ cls: "reel-feed" });
      this.feedEl = feedEl;
      for (const row of this.feed)
        this.mountRow(feedEl, row, container);
      const live = this.feed.some((r) => r.items.some((i) => !this.handled.has(i.id)));
      if (!live && this.exhausted) {
        const empty = container.createDiv({ cls: "reel-empty" });
        empty.createDiv({ text: "Nothing left to suggest \u2014 try a genre above." });
        const dismissed = this.plugin.settings.dismissedIds.length;
        if (dismissed) {
          empty.createDiv({
            cls: "reel-dim",
            text: `${dismissed} dismissed \u2014 clear them in Settings \u2192 Reel to see them again.`
          });
        }
        return;
      }
      this.paintFeedSentinel(container);
    }
    /**
     * The thing at the bottom that asks for more.
     *
     * A sentinel plus an observer rather than a scroll handler: the body is a
     * measured, fixed-height element and its scroll events fire at whatever rate
     * the device feels like, whereas an intersection is asked once and answered
     * once. The rootMargin means the fetch starts a screen early, so the next row
     * is usually there before you arrive at the gap.
     */
    paintFeedSentinel(container) {
      const more = this.sources ? this.nextSource < this.sources.length : false;
      if (!more)
        return;
      const sentinel = container.createDiv({ cls: "reel-feed-end" });
      sentinel.createDiv({ cls: "reel-loading", text: "Loading more\u2026" });
      const scroller = container.closest(".reel-view-body") ?? null;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting))
            return;
          void this.mountNext(container);
        },
        { root: scroller, rootMargin: "600px 0px" }
      );
      io.observe(sentinel);
      this.watchers.push(io);
    }
    /**
     * Mount the next row, skipping ones that come back empty.
     *
     * A source can legitimately return nothing — every title in it is already in
     * your library, or dismissed, or has no poster. Stopping there would end the
     * feed on a technicality, so it tries the next one, up to a handful of times
     * per scroll so a run of empties cannot become an unbounded request loop.
     */
    async mountNext(container) {
      if (this.mounting || !this.sources)
        return;
      this.mounting = true;
      try {
        for (let tries = 0; tries < 6 && this.nextSource < this.sources.length; tries++) {
          const source = this.sources[this.nextSource++];
          const items = (await source.fetch(1)).filter((i) => !this.seen.has(i.id));
          for (const i of items)
            this.seen.add(i.id);
          if (!items.length)
            continue;
          const row = { source, items, page: 1, done: false, loading: false };
          this.feed.push(row);
          if (this.feedEl && this.feedEl.isConnected) {
            this.mountRow(this.feedEl, row, container);
            return;
          }
          this.render(container);
          return;
        }
        if (this.nextSource >= (this.sources?.length ?? 0)) {
          this.exhausted = true;
          this.render(container);
        }
      } catch {
      } finally {
        this.mounting = false;
      }
    }
    async loadRows(container) {
      try {
        const profile = await this.plugin.discover.taste(this.filters.type);
        this.profile = profile;
        this.sources = this.plugin.discover.rowSources(profile, this.filters.type);
        this.feed = [];
        this.nextSource = 0;
        this.seen.clear();
        this.exhausted = false;
        this.mounting = false;
        for (let i = 0; i < 4; i++) {
          const before = this.feed.length;
          await this.mountNextSilently();
          if (this.feed.length === before)
            break;
        }
      } catch (e) {
        this.error = diagnoseError(e).message;
      } finally {
        this.loading = false;
        this.render(container);
      }
    }
    /** The same step as `mountNext`, without touching the DOM. */
    async mountNextSilently() {
      if (!this.sources)
        return;
      for (let tries = 0; tries < 6 && this.nextSource < this.sources.length; tries++) {
        const source = this.sources[this.nextSource++];
        const items = (await source.fetch(1)).filter((i) => !this.seen.has(i.id));
        for (const i of items)
          this.seen.add(i.id);
        if (!items.length)
          continue;
        this.feed.push({ source, items, page: 1, done: false, loading: false });
        return;
      }
    }
    /**
     * One shelf, which pages as you scroll it.
     *
     * The horizontal sentinel sits at the right-hand end of the strip and is
     * observed against the strip itself, so it fires when you scroll the row
     * rather than when the row happens to be on screen. Cards are appended in
     * place: rebuilding the strip would send it back to the left, which on a row
     * you are actively scrolling is the most annoying thing a feed can do.
     */
    mountRow(into, row, container) {
      const items = row.items.filter((i) => !this.handled.has(i.id));
      if (!items.length)
        return;
      const section = into.createDiv({ cls: "reel-drow" });
      const head = section.createDiv({ cls: "reel-drow-head" });
      head.createDiv({ cls: "reel-drow-title", text: row.source.title });
      if (row.source.reason)
        head.createDiv({ cls: "reel-drow-reason", text: row.source.reason });
      const strip = section.createDiv({ cls: "reel-drow-strip" });
      for (const item of items)
        strip.appendChild(this.card(item, container));
      if (!row.done) {
        const tail = strip.createDiv({ cls: "reel-drow-tail" });
        const io = new IntersectionObserver(
          (entries) => {
            if (!entries.some((e) => e.isIntersecting))
              return;
            void this.extendRow(row, strip, tail, container);
          },
          { root: strip, rootMargin: "0px 600px" }
        );
        io.observe(tail);
        this.watchers.push(io);
      }
      if (!Platform.isMobile) {
        const nav = head.createDiv({ cls: "reel-drow-nav" });
        const by = (delta) => strip.scrollBy({ left: delta, behavior: "smooth" });
        const left = nav.createEl("button", { cls: "reel-drow-arrow" });
        setIcon(left, "chevron-left");
        left.addEventListener("click", () => by(-600));
        const right = nav.createEl("button", { cls: "reel-drow-arrow" });
        setIcon(right, "chevron-right");
        right.addEventListener("click", () => by(600));
      }
    }
    /** Another page for one shelf, appended where you are already looking. */
    async extendRow(row, strip, tail, container) {
      if (row.loading || row.done)
        return;
      row.loading = true;
      try {
        const next = await row.source.fetch(row.page + 1);
        row.page += 1;
        const fresh = next.filter((i) => !this.seen.has(i.id) && !this.handled.has(i.id));
        for (const i of fresh)
          this.seen.add(i.id);
        if (!fresh.length) {
          row.empties = (row.empties ?? 0) + 1;
          if (row.empties >= 2 || row.page > 20) {
            row.done = true;
            tail.remove();
          }
          return;
        }
        row.empties = 0;
        row.items = [...row.items, ...fresh];
        for (const item of fresh)
          strip.insertBefore(this.card(item, container), tail);
      } catch {
        row.done = true;
        tail.remove();
      } finally {
        row.loading = false;
      }
    }
    /* ------------------------------------------------------------------ */
    /* Search — the view's own box, pointed at TMDB                        */
    /* ------------------------------------------------------------------ */
    /**
     * What a search means on a screen about titles you do not own.
     *
     * Anything already in your library is dropped, because the card's actions are
     * "add" and "watchlist" and offering those for a note you already have is how
     * you end up with two of them. The count is stated rather than swallowed, with
     * a way through to the library search, so a title you know you own not
     * appearing here is explained rather than mysterious.
     */
    paintSearch(container) {
      const q = this.query.trim();
      if (this.searchedFor !== q) {
        this.searchResults = null;
        this.searchedFor = q;
      }
      if (!this.searchResults) {
        skeletonGrid(container, 12, "Searching");
        if (this.loading)
          return;
        this.loading = true;
        void this.plugin.tmdb.searchMulti(q).then((items2) => {
          const usable = items2.filter((i) => !i.adult && i.poster_path);
          const fresh = this.plugin.discover.filterOut(usable);
          this.searchOwned = usable.length - fresh.length;
          this.searchResults = fresh;
        }).catch((e) => {
          this.error = diagnoseError(e).message;
        }).finally(() => {
          this.loading = false;
          this.render(container);
        });
        return;
      }
      const items = this.searchResults.filter((i) => !this.handled.has(i.id));
      const count = container.createDiv({ cls: "reel-block-count" });
      count.setText(`${items.length} on TMDB for \u201C${q}\u201D`);
      if (this.searchOwned) {
        count.createSpan({ cls: "reel-dim", text: ` \xB7 ${this.searchOwned} already in your library` });
      }
      if (!items.length) {
        const none = container.createDiv({ cls: "reel-empty" });
        none.createDiv({
          text: this.searchOwned ? "Everything matching is already in your library." : "Nothing on TMDB matches that."
        });
        return;
      }
      const grid = container.createDiv({ cls: "reel-dgrid" });
      for (const item of items)
        grid.appendChild(this.card(item, container));
    }
    /* ------------------------------------------------------------------ */
    /* Filtered results                                                    */
    /* ------------------------------------------------------------------ */
    paintResults(container) {
      this.paintHead(container);
      const hadRows = this.paintNarrowedRows(container);
      if (!this.results) {
        container.createDiv({ cls: "reel-loading", text: hadRows ? "Looking for more\u2026" : "Searching\u2026" });
        skeletonGrid(container, hadRows ? 6 : 12, "Searching");
        if (this.loading)
          return;
        this.loading = true;
        const query = this.seed ? (
          // A seed changes the source: recommendations for that title,
          // then narrowed by whatever else is set. "An action comedy
          // like X" means titles like X that are also action comedies.
          this.plugin.discover.like(
            { id: this.seed.id, type: this.seed.type },
            {
              genreIds: this.filters.genreId ? [this.filters.genreId] : [],
              decade: this.filters.decade,
              minRating: this.filters.minRating
            }
          )
        ) : this.plugin.discover.search({
          type: this.filters.type,
          genreId: this.filters.genreId ?? void 0,
          decade: this.filters.decade ?? void 0,
          minRating: this.filters.minRating ?? void 0
        });
        void query.then((items2) => {
          this.results = items2;
        }).catch((e) => {
          this.error = diagnoseError(e).message;
        }).finally(() => {
          this.loading = false;
          this.render(container);
        });
        return;
      }
      const items = this.results.filter((i) => !this.handled.has(i.id));
      const label = [
        this.filters.minRating ? `${this.filters.minRating}+` : "",
        this.filters.genreName ?? "",
        this.filters.type === "tv" ? "series" : "films",
        this.filters.decade ? `from the ${this.filters.decade}s` : "",
        // Naming the seed matters: otherwise a narrowed set looks identical
        // to an ordinary genre browse and you cannot tell whether the
        // "like X" part was honoured at all.
        this.seed ? `like ${this.seed.title}` : ""
      ].filter(Boolean).join(" ");
      if (hadRows)
        container.createDiv({ cls: "reel-drow-title", text: "More matches" });
      container.createDiv({ cls: "reel-block-count", text: `${items.length} ${label}` });
      if (!items.length) {
        const none = container.createDiv({ cls: "reel-empty" });
        none.createDiv({
          text: hadRows ? "Nothing more beyond what's above." : "Nothing matches those filters."
        });
        const reset = none.createEl("button", { cls: "reel-btn mod-cta", text: "Clear filters" });
        reset.addEventListener("click", () => {
          this.filters = { ...EMPTY, type: this.filters.type };
          this.render(container);
        });
        return;
      }
      const grid = container.createDiv({ cls: "reel-dgrid" });
      for (const item of items)
        grid.appendChild(this.card(item, container));
      if (!this.exhausted) {
        const more = container.createDiv({ cls: "reel-dgrid-more" });
        const btn = more.createEl("button", { cls: "reel-btn", text: "Load more" });
        btn.addEventListener("click", () => {
          btn.setText("Loading\u2026");
          btn.disabled = true;
          void this.plugin.discover.search(
            {
              type: this.filters.type,
              genreId: this.filters.genreId ?? void 0,
              decade: this.filters.decade ?? void 0,
              minRating: this.filters.minRating ?? void 0
            },
            this.page + 1
          ).then((next) => {
            this.page += 1;
            const fresh = next.filter((n2) => !this.results?.some((r) => r.id === n2.id));
            if (!fresh.length)
              this.exhausted = true;
            this.results = [...this.results ?? [], ...fresh];
          }).catch(() => {
            this.exhausted = true;
          }).finally(() => this.render(container));
        });
      }
    }
    /* ------------------------------------------------------------------ */
    /* Cards                                                               */
    /* ------------------------------------------------------------------ */
    card(item, container) {
      const isTv = item.media_type === "tv";
      const title = (isTv ? item.name : item.title) ?? "Untitled";
      const year = yearOf(isTv ? item.first_air_date : item.release_date);
      const card = createDiv({ cls: "reel-dcard" });
      const posterEl = card.createDiv({ cls: "reel-dcard-poster" });
      posterEl.setAttr("role", "button");
      posterEl.setAttr("tabindex", "0");
      posterEl.setAttr("aria-label", `${title} \u2014 details`);
      const src = this.plugin.tmdb.posterUrl(item.poster_path, "w342");
      if (src)
        this.plugin.posters.attach(posterEl, { posterUrl: src, title });
      if (item.vote_average)
        posterEl.createDiv({ cls: "reel-dcard-score", text: item.vote_average.toFixed(1) });
      if (isTv)
        posterEl.createDiv({ cls: "reel-dcard-type", text: "TV" });
      const openPreview = () => new PreviewSheet(this.plugin, item, () => {
        this.markHandled(item.id);
        this.render(container);
      }).open();
      posterEl.addEventListener("click", openPreview);
      posterEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter")
          openPreview();
      });
      card.createDiv({ cls: "reel-dcard-title", text: title });
      if (year)
        card.createDiv({ cls: "reel-dcard-year", text: String(year) });
      const actions = card.createDiv({ cls: "reel-dcard-actions" });
      const button = (icon, label, cls, fn) => {
        const b = actions.createEl("button", { cls: `reel-dcard-btn ${cls}` });
        setIcon(b, icon);
        b.setAttr("aria-label", `${label}: ${title}`);
        b.setAttr("title", label);
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          void Promise.resolve(fn());
        });
        return b;
      };
      button("plus", "Add to watchlist", "add", async () => {
        await this.add(item, true);
        this.plugin.undo.offer(`${title} \u2192 watchlist`);
        this.markHandled(item.id);
        this.render(container);
      });
      button("check", "Seen it \u2014 rate now", "seen", () => {
        new SeenSheet(this.plugin, item, () => {
          this.markHandled(item.id);
          this.render(container);
        }).open();
      });
      button("x", "Not interested", "skip", async () => {
        await this.plugin.discover.dismiss(item.id);
        this.handled.add(item.id);
        this.render(container);
      });
      return card;
    }
    async add(item, watchlist, rating) {
      await this.plugin.notes.createFromResult(item, { date: todayISO(), watchlist, rating });
    }
  };
  var RATING_WORDS = ["Not for me", "Weak", "Fine", "Great", "Favourite"];
  var SeenSheet = class extends Modal {
    constructor(plugin2, item, onDone) {
      super(plugin2.app);
      this.plugin = plugin2;
      this.item = item;
      this.onDone = onDone;
      this.busy = false;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      modalEl.addClass("reel-seensheet");
      const isTv = this.item.media_type === "tv";
      const title = (isTv ? this.item.name : this.item.title) ?? "Untitled";
      const year = yearOf(this.item.release_date ?? this.item.first_air_date);
      const head = contentEl.createDiv({ cls: "reel-seen-head" });
      const src = this.item.poster_path ? this.plugin.tmdb.posterUrl(this.item.poster_path, "w342") : null;
      if (src) {
        const art = head.createDiv({ cls: "reel-seen-poster" });
        art.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
        this.plugin.swatches.tint(modalEl, src, document.body.hasClass("theme-dark"));
      }
      const who = head.createDiv({ cls: "reel-seen-who" });
      who.createDiv({ cls: "reel-seen-title", text: title });
      const meta = who.createDiv({ cls: "reel-seen-meta" });
      if (year)
        meta.createSpan({ text: String(year) });
      meta.createSpan({ cls: "reel-badge subtle", text: isTv ? "Series" : "Film" });
      if (this.item.vote_average)
        meta.createSpan({ cls: "reel-dim", text: `\u2605 ${this.item.vote_average.toFixed(1)}` });
      who.createDiv({ cls: "reel-seen-note", text: "Adding as watched." });
      const starRow = contentEl.createDiv({ cls: "reel-rating-row big centred" });
      const readout = contentEl.createDiv({ cls: "reel-seen-readout", text: "Tap a star to rate it" });
      renderStars(starRow, {
        onChange: (v) => {
          if (v == null)
            return;
          readout.setText(`${v} \u2014 ${RATING_WORDS[Math.ceil(v) - 1] ?? ""}`);
          readout.addClass("is-set");
          void this.save(v);
        }
      });
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const noRating = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Add without rating" });
      noRating.addEventListener("click", () => void this.save(void 0));
      const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
      cancel.addEventListener("click", () => this.close());
    }
    async save(rating) {
      if (this.busy)
        return;
      this.busy = true;
      try {
        await this.plugin.notes.createFromResult(this.item, { date: todayISO(), watchlist: false, rating });
        this.plugin.undo.offer(rating != null ? `Added \u2014 rated ${rating}` : "Added as watched");
        this.onDone();
        this.close();
      } catch (e) {
        new Notice(`Reel: ${redact(e)}`);
        this.busy = false;
      }
    }
    onClose() {
      this.contentEl.empty();
    }
  };
  var PreviewSheet = class extends Modal {
    constructor(plugin2, item, onAdded, role) {
      super(plugin2.app);
      this.plugin = plugin2;
      this.item = item;
      this.onAdded = onAdded;
      this.role = role;
      this.busy = false;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.addClass("reel-preview");
      const isTv = this.item.media_type === "tv";
      const title = (isTv ? this.item.name : this.item.title) ?? "Untitled";
      const year = yearOf(isTv ? this.item.first_air_date : this.item.release_date);
      if (this.role) {
        const r = contentEl.createDiv({ cls: "reel-preview-role" });
        r.createSpan({ cls: "reel-preview-role-label", text: "Role" });
        r.createSpan({ cls: "reel-preview-role-value", text: this.role });
      }
      const head = contentEl.createDiv({ cls: "reel-preview-head" });
      const posterEl = head.createDiv({ cls: "reel-preview-poster" });
      const src = this.plugin.tmdb.posterUrl(this.item.poster_path, "w342");
      if (src)
        posterEl.createEl("img", { attr: { src, alt: "" } });
      const body = head.createDiv({ cls: "reel-preview-body" });
      const h = body.createDiv({ cls: "reel-preview-title" });
      h.createSpan({ text: title });
      if (year)
        h.createSpan({ cls: "reel-dim", text: ` ${year}` });
      const facts = body.createDiv({ cls: "reel-header-facts" });
      facts.createSpan({ cls: `reel-badge ${isTv ? "tv" : "film"}`, text: isTv ? "Series" : "Film" });
      if (this.item.vote_average)
        facts.createSpan({ cls: "reel-dim", text: `TMDB ${this.item.vote_average.toFixed(1)}` });
      if (this.item.overview)
        contentEl.createDiv({ cls: "reel-preview-overview", text: this.item.overview });
      void this.loadTrailer(contentEl.createDiv({ cls: "reel-preview-trailer" }), isTv);
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const later = actions.createEl("button", { cls: "reel-btn mod-cta", text: "+ Watchlist" });
      later.addEventListener("click", () => void this.add(true, later));
      const seen = actions.createEl("button", { cls: "reel-btn", text: "Seen it" });
      seen.addEventListener("click", () => {
        new LogSheet(this.plugin.app, this.plugin, {
          pending: {
            id: this.item.id,
            type: isTv ? "tv" : "film",
            title
          }
        }).open();
        this.onAdded();
        this.close();
      });
      const nope = actions.createEl("button", { cls: "reel-btn", text: "Not interested" });
      nope.addEventListener("click", () => {
        void this.plugin.discover.dismiss(this.item.id).then(() => {
          this.onAdded();
          this.close();
        });
      });
    }
    /**
     * Fill the sheet out from the full TMDB record.
     *
     * This used to fetch the detail payload and take only the trailer and the
     * provider list from it, which made "Full details" a promise the screen
     * did not keep — it showed *less* than the inline role panel it was
     * reached from. The request was already being made; almost everything
     * below was in the response and was being discarded.
     *
     * Silent on failure. The sheet works without any of it, and an error
     * notice for a missing trailer would be noise on a screen you are
     * skimming.
     */
    async loadTrailer(slot, isTv) {
      try {
        const meta = isTv ? await this.plugin.tmdb.getShow(this.item.id) : await this.plugin.tmdb.getFilm(this.item.id);
        const url = trailerUrl(meta.videos?.results);
        if (url)
          this.paintTrailer(slot, url);
        this.paintFacts(slot, meta, isTv);
        const providers = providerNames(meta["watch/providers"], this.plugin.settings.region);
        if (providers.length) {
          const box = slot.createDiv({ cls: "reel-preview-providers" });
          box.createSpan({ cls: "reel-dim", text: "Streaming on " });
          box.createSpan({ text: providers.slice(0, 4).join(", ") });
        }
        this.paintLinks(slot, meta, isTv);
      } catch {
      }
    }
    /**
     * The facts that make this "details" rather than a preview.
     *
     * All of it came back in the request already made for the trailer and was
     * being discarded — genres, runtime, certification, the cast. The cast
     * strip matters most: on a screen you reached *from* an actor, the other
     * people in the thing are the obvious next question.
     */
    paintFacts(slot, meta, isTv) {
      const facts = [];
      const genres = (meta.genres ?? []).map((g) => g.name).filter(Boolean);
      if (genres.length)
        facts.push(genres.slice(0, 3).join(", "));
      if (isTv) {
        const show = meta;
        if (show.number_of_episodes)
          facts.push(`${show.number_of_episodes} episodes`);
        if (show.status)
          facts.push(show.status);
      } else {
        const runtime = meta.runtime;
        if (runtime)
          facts.push(formatMinutes(runtime));
      }
      if (facts.length)
        slot.createDiv({ cls: "reel-preview-facts", text: facts.join(" \xB7 ") });
      const credits = isTv ? meta.aggregate_credits : meta.credits;
      const made = isTv ? (meta.created_by ?? []).map((c) => c.name) : (credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name);
      if (made.length) {
        slot.createDiv({
          cls: "reel-preview-facts",
          text: `${isTv ? "Created by" : "Directed by"} ${made.join(", ")}`
        });
      }
      const cast = (credits?.cast ?? []).slice(0, 10);
      if (!cast.length)
        return;
      slot.createDiv({ cls: "reel-block-title", text: "Cast" });
      const strip = slot.createDiv({ cls: "reel-caststrip" }).createDiv({ cls: "reel-caststrip-track" });
      for (const p of cast) {
        const cell = strip.createDiv({ cls: "reel-caststrip-cell" });
        const shot = cell.createDiv({ cls: "reel-caststrip-shot" });
        this.plugin.people.attach(shot, p.name, p.id);
        badgePerson(this.plugin, shot, p.id);
        cell.createDiv({ cls: "reel-caststrip-name", text: p.name });
        const role = (p.character ?? p.roles?.[0]?.character ?? "").trim();
        if (role)
          cell.createDiv({ cls: "reel-caststrip-role", text: role });
        const id = p.id;
        if (!id)
          continue;
        cell.setAttr("role", "button");
        cell.setAttr("tabindex", "0");
        cell.setAttr("aria-label", `${p.name} \u2014 open their filmography`);
        cell.addEventListener("click", () => new PersonSheet(this.plugin, id, p.name).open());
      }
    }
    /**
     * IMDb, its parents guide, and TMDB.
     *
     * The parents guide needs an IMDb id, which a search result does not
     * carry — it only arrives on the detail payload, which is why this could
     * not be built before the fetch. Direct links, never a search: "search
     * IMDb for this title" is a different and much worse thing.
     */
    paintLinks(slot, meta, isTv) {
      paintLinks(slot, meta, isTv);
    }
    /**
     * The trailer, playable in place.
     *
     * Click-to-load rather than an iframe on arrival: an embed that mounts
     * itself costs a YouTube request and a set of cookies for every card you
     * so much as glance at, and most of them you close again. The poster frame
     * is free, and one tap is a fair price for the thing you asked for.
     */
    paintTrailer(slot, url) {
      paintTrailer(slot, url);
    }
    async add(watchlist, button) {
      if (this.busy)
        return;
      this.busy = true;
      button.setText("Adding\u2026");
      button.setAttr("disabled", "true");
      try {
        await this.plugin.notes.createFromResult(this.item, { date: todayISO(), watchlist });
        this.plugin.undo.offer(watchlist ? "Added to your watchlist" : "Added as watched");
        this.onAdded();
        this.close();
      } catch (e) {
        new Notice(`Reel: ${redact(e)}`);
        button.setText("Retry");
        button.removeAttribute("disabled");
        this.busy = false;
      }
    }
    onClose() {
      this.contentEl.empty();
    }
  };

  // src/ui/personSheet.ts
  var PersonSheet = class extends Modal {
    constructor(plugin2, personId, fallbackName) {
      super(plugin2.app);
      this.plugin = plugin2;
      this.personId = personId;
      this.fallbackName = fallbackName;
      this.busy = false;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal", "reel-person-sheet");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.createEl("h3", { cls: "reel-log-title", text: this.fallbackName });
      contentEl.createDiv({ cls: "reel-loading", text: "Loading\u2026", attr: { role: "status" } });
      void this.load();
    }
    async load() {
      let person;
      try {
        person = await this.plugin.tmdb.getPerson(this.personId);
      } catch (e) {
        this.contentEl.empty();
        this.contentEl.createDiv({ cls: "reel-error", text: redact(e) });
        return;
      }
      if (!this.contentEl.isConnected)
        return;
      this.contentEl.empty();
      this.renderHead(person);
      this.renderCredits(person);
    }
    renderHead(person) {
      const head = this.contentEl.createDiv({ cls: "reel-person-head" });
      const shot = head.createDiv({ cls: "reel-person-hero-shot" });
      const src = this.plugin.tmdb.posterUrl(person.profile_path, "w342");
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
      const facts = [];
      if (person.known_for_department)
        facts.push(person.known_for_department);
      const born = yearOf(person.birthday ?? void 0);
      const died = yearOf(person.deathday ?? void 0);
      if (born && died)
        facts.push(`${born}\u2013${died}`);
      else if (born)
        facts.push(`b. ${born}`);
      if (facts.length)
        body.createDiv({ cls: "reel-dim", text: facts.join(" \xB7 ") });
      this.renderOpinion(body, person);
      if (person.biography?.trim()) {
        const bio = person.biography.trim();
        const short = bio.length > 280 ? `${bio.slice(0, 280).trimEnd()}\u2026` : bio;
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
    renderOpinion(body, person) {
      const key = String(person.id);
      const store = this.plugin.settings.people;
      const current = store[key];
      const row = body.createDiv({ cls: "reel-person-opinion" });
      const save = async (next) => {
        const merged = {
          ...store[key],
          ...next,
          name: person.name,
          department: person.known_for_department
        };
        if (!merged.liked && merged.rating == null)
          delete store[key];
        else
          store[key] = merged;
        await this.plugin.saveSettings();
      };
      const heart = row.createEl("button", {
        cls: "reel-heart reel-heart-labelled",
        attr: { type: "button", "aria-pressed": String(!!current?.liked) }
      });
      const glyph = heart.createSpan({ cls: "reel-heart-glyph" });
      const word = heart.createSpan({ cls: "reel-heart-word" });
      const paintHeart = () => {
        const liked = !!this.plugin.settings.people[key]?.liked;
        heart.toggleClass("is-on", liked);
        heart.setAttr("aria-pressed", String(liked));
        heart.setAttr("aria-label", liked ? `${person.name} \u2014 liked` : `Like ${person.name}`);
        glyph.setText(liked ? "\u2665" : "\u2661");
        word.setText(liked ? "Liked" : "Like");
      };
      heart.addEventListener("click", () => {
        void save({ liked: !this.plugin.settings.people[key]?.liked }).then(paintHeart);
      });
      paintHeart();
      const stars2 = row.createDiv({ cls: "reel-person-stars" });
      renderStars(stars2, {
        value: current?.rating,
        compact: true,
        onChange: (v) => void save({ rating: v ?? void 0 })
      });
    }
    renderCredits(person) {
      const cast = person.combined_credits?.cast ?? [];
      const crew = person.combined_credits?.crew ?? [];
      const byId = /* @__PURE__ */ new Map();
      for (const c of [...cast, ...crew]) {
        if (!c.id || !c.poster_path)
          continue;
        if (!byId.has(c.id))
          byId.set(c.id, c);
      }
      const credits = [...byId.values()].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
      if (!credits.length) {
        this.contentEl.createDiv({ cls: "reel-empty", text: "No credits listed." });
        return;
      }
      this.contentEl.createDiv({ cls: "reel-facet-label", text: `Known for \u2014 ${credits.length} titles` });
      const grid = this.contentEl.createDiv({ cls: "reel-person-credits" });
      for (const c of credits.slice(0, 60)) {
        const type = c.media_type === "tv" ? "tv" : "film";
        const mine = this.plugin.library.byTmdbId(c.id, type);
        const card = grid.createDiv({ cls: "reel-person-credit" });
        card.setAttr("role", "button");
        card.setAttr("tabindex", "0");
        card.toggleClass("is-mine", !!mine);
        const poster2 = card.createDiv({ cls: "reel-person-credit-poster" });
        this.plugin.posters.attach(poster2, {
          posterUrl: this.plugin.tmdb.posterUrl(c.poster_path, "w342") ?? void 0,
          title: c.title ?? c.name ?? ""
        });
        if (mine)
          poster2.createSpan({ cls: "reel-person-credit-tick", text: "\u2713" });
        card.createDiv({ cls: "reel-person-credit-title", text: c.title ?? c.name ?? "Untitled" });
        const year = yearOf(c.release_date ?? c.first_air_date);
        const role = c.character || c.job || "";
        const sub = [year ? String(year) : "", role].filter(Boolean).join(" \xB7 ");
        if (sub)
          card.createDiv({ cls: "reel-person-credit-sub", text: sub });
        const open = () => this.toggleRole(card, c, mine, role);
        card.addEventListener("click", open);
        card.addEventListener("keydown", (ev) => {
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
    toggleRole(card, credit, mine, role) {
      const existing = card.querySelector(".reel-person-role-panel");
      card.doc.querySelectorAll(".reel-person-role-panel").forEach((el) => el.remove());
      card.doc.querySelectorAll(".reel-person-credit.is-open").forEach((el) => el.removeClass("is-open"));
      if (existing)
        return;
      card.addClass("is-open");
      const panel = card.createDiv({ cls: "reel-person-role-panel" });
      if (credit.backdrop_path) {
        const shot = panel.createDiv({ cls: "reel-person-role-still" });
        const img = shot.createEl("img", {
          attr: {
            src: this.plugin.tmdb.posterUrl(credit.backdrop_path, "w500") ?? "",
            alt: "",
            loading: "lazy",
            decoding: "async"
          }
        });
        img.addEventListener("error", () => shot.remove());
      }
      if (role) {
        panel.createDiv({ cls: "reel-person-role-label", text: credit.character ? "Played" : "Worked as" });
        panel.createDiv({ cls: "reel-person-role-value", text: role });
      } else {
        panel.createDiv({ cls: "reel-dim", text: "No role recorded for this credit." });
      }
      if (credit.overview)
        panel.createDiv({ cls: "reel-person-role-overview", text: credit.overview });
      const actions = panel.createDiv({ cls: "reel-person-role-actions" });
      const details = actions.createEl("button", {
        cls: mine ? "reel-btn mod-cta" : "reel-btn",
        text: mine ? "Open in your library" : "Full details"
      });
      details.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (mine) {
          this.close();
          void this.plugin.openDetail(mine);
          return;
        }
        new PreviewSheet(this.plugin, credit, () => {
        }, roleOf(credit)).open();
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
    async add(item) {
      if (this.busy)
        return;
      this.busy = true;
      try {
        await this.plugin.notes.createFromResult(item, { date: todayISO(), watchlist: true });
        this.plugin.undo.offer(`Added ${item.title ?? item.name ?? "it"} to your watchlist`);
        this.contentEl.empty();
        await this.load();
      } catch (e) {
        new Notice(`Reel: ${redact(e)}`);
      }
      this.busy = false;
    }
    onClose() {
      this.contentEl.empty();
    }
  };
  function roleOf(credit) {
    const role = (credit.character ?? credit.job ?? "").trim();
    return role || void 0;
  }

  // src/reviews.ts
  var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function dateFromHeading(heading) {
    const iso2 = /(\d{4})-(\d{2})-(\d{2})/.exec(heading);
    if (iso2)
      return `${iso2[1]}-${iso2[2]}-${iso2[3]}`;
    const pretty = /\b(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\b/.exec(heading);
    if (pretty) {
      const month = MONTHS.indexOf(pretty[2].slice(0, 3).toLowerCase());
      if (month >= 0) {
        return `${pretty[3]}-${String(month + 1).padStart(2, "0")}-${pretty[1].padStart(2, "0")}`;
      }
    }
    return void 0;
  }
  function ratingFromHeading(heading) {
    const stars2 = (heading.match(/★/g) ?? []).length;
    if (!stars2)
      return void 0;
    return stars2 + (heading.includes("\xBD") ? 0.5 : 0);
  }
  function parseReviews(content) {
    const out = [];
    const headings = [...content.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)];
    headings.forEach((match, i) => {
      const heading = match[1];
      const date = dateFromHeading(heading);
      if (!date)
        return;
      const from = (match.index ?? 0) + match[0].length;
      const rest = content.slice(from);
      const nextHeading = /^#{1,6}[ \t]+/m.exec(rest);
      const to = nextHeading ? from + (nextHeading.index ?? 0) : content.length;
      out.push({
        date,
        heading,
        rating: ratingFromHeading(heading),
        text: content.slice(from, to).trim(),
        from,
        to
      });
    });
    return out;
  }
  function reviewsNewestFirst(content) {
    return parseReviews(content).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }
  function replaceReview(content, review, text) {
    const body = text.trim();
    const block = body ? `

${body}
` : "\n";
    return content.slice(0, review.from) + block + content.slice(review.to);
  }
  function appendReviewSection(content, date, rating, text) {
    const body = text.trim();
    if (!body)
      return content;
    const stars2 = rating != null && rating > 0 ? ` \xB7 ${starString(rating)}` : "";
    const heading = `## ${prettyDate(date) || date}${stars2}`;
    const gap = content.endsWith("\n") ? "\n" : "\n\n";
    return `${content}${gap}${heading}

${body}
`;
  }
  function headingFor(review, rating) {
    const base = review.date ? prettyDate(review.date) || review.date : review.heading.replace(/\s*·.*$/, "").trim();
    const stars2 = rating != null && rating > 0 ? ` \xB7 ${starString(rating)}` : "";
    return `## ${base}${stars2}`;
  }
  function replaceHeading(content, review, heading) {
    const lineStart = content.lastIndexOf("\n", review.from - 1) + 1;
    return content.slice(0, lineStart) + heading + content.slice(review.from);
  }

  // src/ui/reviewPane.ts
  var EXCERPT = 220;
  function fileFor(plugin2, entry) {
    const f = plugin2.app.vault.getAbstractFileByPath(entry.path);
    return f instanceof TFile ? f : null;
  }
  var cache = /* @__PURE__ */ new Map();
  async function readReviews(plugin2, entry) {
    const file = fileFor(plugin2, entry);
    if (!file)
      return [];
    const hit = cache.get(file.path);
    if (hit && hit.mtime === file.stat.mtime)
      return hit.reviews;
    try {
      const reviews2 = reviewsNewestFirst(await plugin2.app.vault.cachedRead(file));
      cache.set(file.path, { mtime: file.stat.mtime, reviews: reviews2 });
      return reviews2;
    } catch {
      return [];
    }
  }
  function forgetReviews(path) {
    cache.delete(path);
  }
  function paintReviews(plugin2, container, entry, opts = {}) {
    const pane = container.createDiv({ cls: "reel-yours is-loading" });
    const fill = () => {
      void readReviews(plugin2, entry).then((all2) => {
        if (!pane.isConnected)
          return;
        pane.removeClass("is-loading");
        draw(plugin2, pane, entry, all2, opts);
      });
    };
    if (!opts.lazy || typeof IntersectionObserver === "undefined") {
      fill();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting))
          return;
        io.disconnect();
        fill();
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(pane);
  }
  function draw(plugin2, pane, entry, all2, opts) {
    pane.empty();
    const reviews2 = opts.onlyDate ? all2.filter((r) => r.date === opts.onlyDate) : all2;
    const shown2 = opts.limit ? reviews2.slice(0, opts.limit) : reviews2;
    const repaint = () => {
      forgetReviews(entry.path);
      void readReviews(plugin2, entry).then((fresh) => {
        if (pane.isConnected)
          draw(plugin2, pane, entry, fresh, opts);
      });
      opts.onChange?.();
    };
    if (!shown2.length) {
      if (!opts.editable) {
        pane.remove();
        return;
      }
      const empty = pane.createDiv({ cls: "reel-yours-empty" });
      empty.createDiv({ cls: "reel-yours-label", text: opts.heading ?? "Your review" });
      empty.createDiv({
        cls: "reel-dim",
        text: entry.watched.length ? "You have not written about this one yet." : "Write about it now, or when you log it."
      });
      const write = empty.createEl("button", { cls: "reel-btn", attr: { type: "button" } });
      setIcon(write.createSpan(), "pencil-line");
      write.createSpan({ text: "Write a review" });
      write.addEventListener("click", () => {
        new ReviewEditor(plugin2, entry, null, repaint).open();
      });
      return;
    }
    if (opts.heading !== "")
      pane.createDiv({ cls: "reel-yours-label", text: opts.heading ?? "Your review" });
    for (const review of shown2) {
      const box = pane.createDiv({ cls: "reel-yours-item" });
      const head = box.createDiv({ cls: "reel-yours-head" });
      head.createSpan({ cls: "reel-yours-date", text: review.date ? prettyDate(review.date) : review.heading });
      if (review.rating != null)
        renderStarsStatic(head.createSpan({ cls: "reel-yours-stars" }), review.rating);
      if (opts.editable) {
        const edit = head.createEl("button", {
          cls: "reel-yours-edit clickable-icon",
          attr: { type: "button", "aria-label": "Edit this review" }
        });
        setIcon(edit, "pencil-line");
        edit.addEventListener("click", () => new ReviewEditor(plugin2, entry, review, repaint).open());
      }
      const long = review.text.length > EXCERPT;
      const body = box.createDiv({ cls: "reel-yours-body" });
      body.setText(long && !opts.editable ? `${review.text.slice(0, EXCERPT).trimEnd()}\u2026` : review.text);
      if (long && !opts.editable) {
        const more = box.createEl("button", { cls: "reel-yours-more", text: "Read the rest", attr: { type: "button" } });
        more.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const file = fileFor(plugin2, entry);
          if (file)
            void plugin2.app.workspace.getLeaf(false).openFile(file);
        });
      }
    }
    if (opts.editable) {
      const add = pane.createEl("button", { cls: "reel-yours-add", attr: { type: "button" } });
      setIcon(add.createSpan(), "plus");
      add.createSpan({ text: "Add another" });
      add.addEventListener("click", () => new ReviewEditor(plugin2, entry, null, repaint).open());
    } else if (opts.limit && reviews2.length > opts.limit) {
      pane.createDiv({ cls: "reel-dim reel-yours-count", text: `${reviews2.length - opts.limit} more` });
    }
  }
  var ReviewEditor = class extends Modal {
    constructor(plugin2, entry, review, onSaved) {
      super(plugin2.app);
      this.plugin = plugin2;
      this.entry = entry;
      this.review = review;
      this.onSaved = onSaved;
      this.saving = false;
      this.text = review?.text ?? "";
      this.rating = review?.rating ?? (review ? void 0 : entry.rating);
      this.date = review?.date ?? this.mostRecentWatch();
    }
    /**
     * The date a fresh review belongs to.
     *
     * The last time you watched it, not today: you write the review after the
     * film, sometimes days after, and dating it "today" quietly puts a viewing
     * in your diary on a night you were doing something else.
     */
    mostRecentWatch() {
      const dates = this.entry.watched.map((w) => w.date).filter(Boolean).sort();
      return dates[dates.length - 1] ?? todayISO();
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      modalEl.addClass("reel-review-sheet");
      contentEl.createEl("h3", { cls: "reel-log-title", text: this.review ? "Edit review" : "Write a review" });
      contentEl.createDiv({ cls: "reel-log-sub", text: this.entry.title });
      const box = contentEl.createEl("textarea", {
        cls: "reel-input reel-review-box",
        attr: { rows: "6", placeholder: "What did you think?" }
      });
      box.value = this.text;
      box.addEventListener("input", () => this.text = box.value);
      const meta = contentEl.createDiv({ cls: "reel-review-meta" });
      meta.createDiv({ cls: "reel-field-label", text: "Rating" });
      renderStars(meta, {
        value: this.rating,
        onChange: (v) => {
          this.rating = v;
        }
      });
      meta.createDiv({ cls: "reel-field-label", text: "Date" });
      const dateEl = meta.createEl("input", { cls: "reel-input reel-review-date", attr: { type: "date" } });
      dateEl.value = this.date;
      dateEl.disabled = this.review != null;
      dateEl.addEventListener("change", () => this.date = dateEl.value);
      const actions = contentEl.createDiv({ cls: "reel-actions" });
      const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel", attr: { type: "button" } });
      cancel.addEventListener("click", () => this.close());
      const save = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Save", attr: { type: "button" } });
      save.addEventListener("click", () => void this.save(save));
      window.setTimeout(() => box.focus(), 0);
    }
    async save(button) {
      if (this.saving)
        return;
      this.saving = true;
      button.disabled = true;
      button.setText("Saving\u2026");
      const file = fileFor(this.plugin, this.entry);
      if (!file) {
        new Notice("That note has moved or been deleted.");
        this.close();
        return;
      }
      try {
        const review = this.review;
        await this.plugin.app.vault.process(file, (data) => {
          if (!review)
            return appendReviewSection(data, this.date, this.rating, this.text);
          const withHeading = replaceHeading(data, review, headingFor(review, this.rating));
          const again = reviewsNewestFirst(withHeading).find((r) => r.date === review.date);
          return again ? replaceReview(withHeading, again, this.text) : withHeading;
        });
        forgetReviews(file.path);
        this.onSaved();
        this.close();
      } catch (e) {
        new Notice(`Reel could not save that review \u2014 ${redact(e)}`);
        button.disabled = false;
        button.setText("Save");
        this.saving = false;
      }
    }
    onClose() {
      this.contentEl.empty();
    }
  };

  // src/ui/detail.ts
  function flagEmoji(iso2) {
    const code = iso2.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code))
      return "";
    return String.fromCodePoint(...[...code].map((c) => 127462 + c.charCodeAt(0) - 65));
  }
  var FILM_STATUSES = ["watched", "watchlist", "abandoned"];
  var TV_STATUSES = ["watching", "completed", "watchlist", "paused", "dropped"];
  function flash(el) {
    el.addClass("reel-flash");
    el.setAttr("aria-live", "polite");
    window.setTimeout(() => {
      el.removeClass("reel-flash");
      el.removeAttribute("aria-live");
    }, 600);
  }
  var DetailScreen = class {
    constructor(plugin2, entry, onBack, backLabel = "Library") {
      this.plugin = plugin2;
      this.entry = entry;
      this.onBack = onBack;
      this.backLabel = backLabel;
      this.openSeason = null;
      this.episodeCache = /* @__PURE__ */ new Map();
      this.rootEl = null;
    }
    get file() {
      const f = this.plugin.app.vault.getAbstractFileByPath(this.entry.path);
      return f instanceof TFile ? f : null;
    }
    /** Repaint using the current entry, without re-reading the index. */
    rerender() {
      if (this.rootEl)
        this.render(this.rootEl);
    }
    /**
     * Adopt the latest indexed version of this entry.
     *
     * Called by the view when the library reports a change — which happens
     * *after* `metadataCache` has reparsed the file. That event is the only
     * reliable signal that a re-read will return the values we just wrote;
     * this used to be a 120ms timer, which is a guess that quietly fails on a
     * slow disk or a large vault.
     */
    syncFromIndex() {
      const latest = this.plugin.library.byPath(this.entry.path);
      if (latest)
        this.entry = latest;
    }
    /** The path this screen is showing, so the view can tell if it still exists. */
    get path() {
      return this.entry.path;
    }
    render(container) {
      this.rootEl = container;
      container.empty();
      container.addClass("reel-detail");
      const e = this.entry;
      const isTv = e.type === "tv";
      const bar = container.createDiv({ cls: "reel-detail-bar" });
      const back = bar.createEl("button", { cls: "reel-btn reel-back" });
      setIcon(back.createSpan(), "arrow-left");
      back.createSpan({ text: this.backLabel });
      back.addEventListener("click", () => this.onBack());
      const openNote = bar.createEl("button", { cls: "reel-btn", text: "Open note" });
      openNote.addEventListener("click", async () => {
        const file = this.file;
        if (file)
          await this.plugin.app.workspace.getLeaf(false).openFile(file);
      });
      const page = container.createDiv({ cls: "reel-detail-page" });
      this.plugin.swatches.tint(page, this.plugin.posters.displayUrl(e), document.body.hasClass("theme-dark"));
      const hero = page.createDiv({ cls: "reel-hero" });
      this.paintBackdrop(hero, e);
      const posterEl = hero.createDiv({ cls: "reel-hero-poster" });
      this.plugin.posters.attach(posterEl, e);
      const body = hero.createDiv({ cls: "reel-hero-body" });
      const h = body.createDiv({ cls: "reel-hero-title" });
      h.createSpan({ text: e.title });
      const year = e.year ?? e.firstAirYear;
      if (year)
        h.createSpan({ cls: "reel-dim", text: ` ${year}` });
      const sub = body.createDiv({ cls: "reel-hero-sub" });
      const people = isTv ? e.creators : e.director;
      if (people.length)
        sub.createSpan({ text: people.map(unlink).join(", ") });
      if (!isTv && e.runtime)
        sub.createSpan({ text: formatMinutes(e.runtime) });
      if (isTv) {
        const seen = e.seasons.reduce((n2, s) => n2 + rangeCount(s.watched), 0);
        sub.createSpan({ text: `${seen} of ${e.totalEpisodes ?? "?"} episodes` });
      }
      if (e.certification)
        sub.createSpan({ cls: "reel-badge cert", text: e.certification });
      const scores = body.createDiv({ cls: "reel-scores" });
      const score = (label, value, cls, outOf) => {
        const chip = scores.createDiv({ cls: `reel-score ${cls}` });
        const v = chip.createDiv({ cls: "reel-score-value", text: value });
        if (outOf)
          v.createSpan({ cls: "reel-score-scale", text: `/${outOf}` });
        chip.createDiv({ cls: "reel-score-label", text: label });
      };
      if (e.rating != null)
        score("You", String(e.rating), "mine", "5");
      const epAvg = this.episodeAverage();
      if (epAvg != null)
        score("Episodes", epAvg.toFixed(1), "mine", "5");
      if (e.imdbRating != null) {
        score("IMDb", e.imdbRating.toFixed(1), "imdb", "10");
        if (e.imdbVotes) {
          const chip = scores.lastElementChild;
          chip?.createDiv({ cls: "reel-score-votes", text: compactCount(e.imdbVotes) });
        }
      }
      if (e.metacritic != null) {
        score("Metacritic", String(e.metacritic), e.metacritic >= 61 ? "meta-good" : e.metacritic >= 40 ? "meta-mixed" : "meta-bad", "100");
      }
      if (e.rottenTomatoes != null)
        score("Tomatoes", `${e.rottenTomatoes}%`, e.rottenTomatoes >= 60 ? "fresh" : "rotten");
      if (e.tmdbRating != null)
        score("TMDB", e.tmdbRating.toFixed(1), "", "10");
      if (e.rating != null) {
        const theirs = e.imdbRating ?? e.tmdbRating;
        const source = e.imdbRating != null ? "IMDb" : "TMDB";
        if (theirs != null) {
          const mine = e.rating * 2;
          const delta = Math.round((mine - theirs) * 10) / 10;
          const text = Math.abs(delta) < 0.5 ? `Your ${e.rating} is about the same as ${source}'s ${theirs.toFixed(1)}` : `Your ${e.rating} is ${Math.abs(delta).toFixed(1)} ${delta > 0 ? "above" : "below"} ${source}, on their scale`;
          body.createDiv({ cls: "reel-score-compare", text });
        }
      }
      if (!scores.childElementCount)
        scores.remove();
      if (e.genres.length) {
        const g = body.createDiv({ cls: "reel-hero-genres" });
        e.genres.forEach((x) => g.createSpan({ cls: "reel-chip static", text: x }));
      }
      if (e.overview)
        body.createDiv({ cls: "reel-hero-overview", text: e.overview });
      void paintTrailerFor(this.plugin, body.createDiv({ cls: "reel-detail-trailer" }), e.tmdbId, isTv, e.trailer);
      const links = body.createDiv({ cls: "reel-links" });
      const link = (label, url, cls) => {
        const a = links.createEl("a", { cls: `reel-link ${cls}`, text: label, href: url });
        a.setAttr("target", "_blank");
        a.setAttr("rel", "noopener");
      };
      const imdb = imdbUrl(e.imdbId);
      if (imdb)
        link("IMDb", imdb, "imdb");
      link("TMDB", tmdbUrl(e.tmdbId, e.type), "tmdb");
      if (imdb)
        link("Parents guide", `${imdb}parentalguide`, "guide");
      const region = (this.plugin.settings.region || "US").toLowerCase();
      link("JustWatch", `https://www.justwatch.com/${region}/search?q=${encodeURIComponent(e.title)}`, "justwatch");
      if (e.type === "film")
        link("Letterboxd", `https://letterboxd.com/tmdb/${e.tmdbId}/`, "letterboxd");
      const cols = page.createDiv({ cls: "reel-detail-cols" });
      const side = cols.createDiv({ cls: "reel-detail-side" });
      const main = cols.createDiv({ cls: "reel-detail-main" });
      this.renderControls(side);
      this.renderActions(side);
      this.renderMeta(side);
      if (isTv)
        this.renderSeasons(main);
      else
        this.renderHistory(main);
      void this.renderFacets(main, isTv);
    }
    /* ------------------------------------------------------------------ */
    /* Facets — everything TMDB knows, behind tabs                         */
    /* ------------------------------------------------------------------ */
    /**
     * Cast, crew, production details, genres, releases and related titles.
     *
     * Tabbed rather than stacked because this is reference material: you come
     * looking for one specific thing, and five collapsed sections beat one
     * very long scroll. The payload is the same cached `getFilm`/`getShow`
     * response the rest of the plugin uses, so opening this costs nothing
     * after the first time.
     */
    async renderFacets(main, isTv) {
      const wrap = main.createDiv({ cls: "reel-facets" });
      wrap.createDiv({ cls: "reel-loading", text: "Loading details\u2026", attr: { role: "status" } });
      let meta;
      try {
        meta = isTv ? await this.plugin.tmdb.getShow(this.entry.tmdbId) : await this.plugin.tmdb.getFilm(this.entry.tmdbId);
      } catch (e) {
        wrap.empty();
        wrap.createDiv({ cls: "reel-error", text: redact(e) });
        return;
      }
      if (!wrap.isConnected)
        return;
      wrap.empty();
      const film2 = isTv ? void 0 : meta;
      const cast = (isTv ? meta.aggregate_credits?.cast : film2?.credits?.cast) ?? [];
      const crew = (isTv ? meta.aggregate_credits?.crew : film2?.credits?.crew) ?? [];
      const related = meta.recommendations?.results ?? [];
      if (cast.length)
        this.renderCastStrip(wrap, cast);
      this.renderCreditRows(wrap, cast, crew, isTv);
      const tabs = [];
      if (cast.length)
        tabs.push({ id: "cast", label: "Cast", render: (el) => this.renderPeople(el, cast, true) });
      if (crew.length)
        tabs.push({ id: "crew", label: "Crew", render: (el) => this.renderPeople(el, crew, false) });
      tabs.push({ id: "details", label: "Details", render: (el) => this.renderFacts(el, meta, isTv) });
      tabs.push({ id: "story", label: "Storyline", render: (el) => this.renderStoryline(el, meta) });
      if (this.entry.contentTopics.length || this.entry.certification) {
        tabs.push({ id: "content", label: "Content", render: (el) => this.renderContent(el) });
      }
      if (meta.genres?.length)
        tabs.push({ id: "genre", label: "Genre", render: (el) => this.renderGenres(el, meta.genres ?? []) });
      if (film2?.release_dates?.results?.length) {
        tabs.push({ id: "releases", label: "Releases", render: (el) => this.renderReleases(el, film2) });
      }
      if (related.length)
        tabs.push({ id: "related", label: "Related", render: (el) => this.renderRelated(el, related) });
      tabs.push({ id: "photos", label: "Photos", render: (el) => void this.renderPhotos(el, isTv) });
      const reviews2 = meta.reviews?.results ?? [];
      if (reviews2.length) {
        tabs.push({
          id: "reviews",
          label: `Other reviews${meta.reviews?.total_results ? ` ${meta.reviews.total_results}` : ""}`,
          render: (el) => this.renderReviews(el, reviews2)
        });
      }
      if (!tabs.length)
        return;
      const bar = wrap.createDiv({ cls: "reel-facet-tabs" });
      const body = wrap.createDiv({ cls: "reel-facet-body" });
      const buttons = [];
      const show = (i) => {
        buttons.forEach((b, n2) => b.toggleClass("is-active", n2 === i));
        body.empty();
        tabs[i].render(body);
      };
      tabs.forEach((t, i) => {
        const b = bar.createEl("button", { cls: "reel-facet-tab", text: t.label, attr: { type: "button" } });
        buttons.push(b);
        b.addEventListener("click", () => show(i));
      });
      show(0);
    }
    /**
     * Director / Writer / Stars, as named rows of tappable names.
     *
     * The three questions everyone asks about a title before anything else,
     * and each name opens that person's filmography rather than being dead
     * text. Grouped by job so "Screenplay" and "Story" collapse into one
     * Writer row instead of three near-identical lines.
     */
    renderCreditRows(wrap, cast, crew, isTv) {
      const pick = (...jobs) => crew.filter((c) => c.job && jobs.includes(c.job)).filter((c, i, all2) => all2.findIndex((x) => x.name === c.name) === i);
      const rows2 = [];
      if (isTv) {
        const creators = pick("Creator", "Executive Producer").slice(0, 3);
        if (creators.length)
          rows2.push({ label: creators.length > 1 ? "Creators" : "Creator", people: creators });
      } else {
        const directors = pick("Director");
        if (directors.length)
          rows2.push({ label: directors.length > 1 ? "Directors" : "Director", people: directors });
      }
      const writers = pick("Screenplay", "Writer", "Story", "Author").slice(0, 4);
      if (writers.length)
        rows2.push({ label: writers.length > 1 ? "Writers" : "Writer", people: writers });
      const stars2 = cast.slice(0, 3);
      if (stars2.length)
        rows2.push({ label: "Stars", people: stars2 });
      if (!rows2.length)
        return;
      const box = wrap.createDiv({ cls: "reel-credit-rows" });
      for (const row of rows2) {
        const line = box.createDiv({ cls: "reel-credit-row" });
        line.createSpan({ cls: "reel-credit-label", text: row.label });
        const names = line.createSpan({ cls: "reel-credit-names" });
        row.people.forEach((p, i) => {
          if (i)
            names.createSpan({ cls: "reel-dim", text: " \xB7 " });
          const a = names.createEl("button", { cls: "reel-credit-name", text: p.name, attr: { type: "button" } });
          a.addEventListener("click", () => this.openPerson(p));
        });
      }
    }
    /**
     * Top billing as a horizontal strip of circular headshots.
     *
     * Deliberately capped and scrollable rather than complete — the Cast tab
     * holds the full list. This answers "who is in this" at a glance, which is
     * a different question from "show me everyone".
     */
    renderCastStrip(wrap, cast) {
      const box = wrap.createDiv({ cls: "reel-caststrip" });
      const head = box.createDiv({ cls: "reel-caststrip-head" });
      head.createSpan({ cls: "reel-facet-label", text: "Top cast" });
      head.createSpan({ cls: "reel-dim", text: String(cast.length) });
      const strip = box.createDiv({ cls: "reel-caststrip-track" });
      for (const p of cast.slice(0, 12)) {
        const cell = strip.createDiv({ cls: "reel-caststrip-cell" });
        cell.setAttr("role", "button");
        cell.setAttr("tabindex", "0");
        cell.setAttr("aria-label", `Find ${p.name} in your library`);
        const shot = cell.createDiv({ cls: "reel-caststrip-shot" });
        badgePerson(this.plugin, shot, p.id);
        const src = this.plugin.tmdb.posterUrl(p.profile_path, "w185");
        if (src) {
          const img = shot.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
          img.addEventListener("error", () => {
            img.remove();
            shot.addClass("is-empty");
            shot.createSpan({ cls: "reel-placeholder-text", text: p.name.slice(0, 2) });
          });
        } else {
          shot.addClass("is-empty");
          shot.createSpan({ cls: "reel-placeholder-text", text: p.name.slice(0, 2) });
        }
        cell.createDiv({ cls: "reel-caststrip-name", text: p.name });
        const part = p.character ?? p.roles?.[0]?.character ?? "";
        if (part)
          cell.createDiv({ cls: "reel-caststrip-role", text: part });
        const open = () => this.openPerson(p);
        cell.addEventListener("click", open);
        cell.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            open();
          }
        });
      }
    }
    /**
     * Open a person's filmography.
     *
     * TMDB gives an id on credits, but not always — aggregate credits for a
     * show occasionally omit it. Without one there is no person to look up, so
     * fall back to searching your own library by name rather than doing
     * nothing at all.
     */
    openPerson(p) {
      if (p.id)
        new PersonSheet(this.plugin, p.id, p.name).open();
      else
        void this.plugin.openViewWithSearch(p.name);
    }
    /**
     * A list of people with headshots.
     *
     * Tapping one searches your own library for them, which is the question
     * you actually have standing on this screen — "what else of theirs have I
     * seen?" — rather than opening a biography you did not ask for.
     */
    renderPeople(el, people, asCast) {
      const list = el.createDiv({ cls: "reel-people" });
      for (const p of people.slice(0, 40)) {
        const row = list.createDiv({ cls: "reel-person" });
        row.setAttr("role", "button");
        row.setAttr("tabindex", "0");
        row.setAttr("aria-label", `${p.name} \u2014 open their filmography`);
        const shot = row.createDiv({ cls: "reel-person-shot" });
        const src = this.plugin.tmdb.posterUrl(p.profile_path, "w185");
        if (src) {
          const img = shot.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
          img.addEventListener("error", () => {
            img.remove();
            shot.addClass("is-empty");
            shot.createSpan({ cls: "reel-placeholder-text", text: p.name.slice(0, 2) });
          });
        } else {
          shot.addClass("is-empty");
          shot.createSpan({ cls: "reel-placeholder-text", text: p.name.slice(0, 2) });
        }
        const body = row.createDiv({ cls: "reel-person-body" });
        body.createDiv({ cls: "reel-person-name", text: p.name });
        const sub = asCast ? p.character ?? p.roles?.[0]?.character ?? "" : p.job ?? "";
        if (sub)
          body.createDiv({ cls: "reel-person-role", text: sub });
        const open = () => this.openPerson(p);
        row.addEventListener("click", open);
        row.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            open();
          }
        });
      }
    }
    /** Studios, country, language, alternative titles, and the money. */
    renderFacts(el, meta, isTv) {
      const film2 = isTv ? void 0 : meta;
      const group = (label, values) => {
        if (!values.length)
          return;
        const box = el.createDiv({ cls: "reel-facet-group" });
        box.createDiv({ cls: "reel-facet-label", text: label });
        for (const v of values)
          box.createDiv({ cls: "reel-facet-value", text: v });
      };
      group("Studios", (meta.production_companies ?? []).map((c) => c.name).filter(Boolean));
      group("Country", (film2?.production_countries ?? []).map((c) => c.name ?? "").filter(Boolean));
      group(
        "Language",
        (film2?.spoken_languages ?? []).map((l) => l.english_name ?? l.name ?? "").filter(Boolean)
      );
      if (film2 && (film2.budget || film2.revenue)) {
        const money = (n2) => n2 ? `$${n2.toLocaleString()}` : "not reported";
        const box = el.createDiv({ cls: "reel-facet-group" });
        box.createDiv({ cls: "reel-facet-label", text: "Box office" });
        box.createDiv({ cls: "reel-facet-value", text: `Budget \u2014 ${money(film2.budget)}` });
        box.createDiv({ cls: "reel-facet-value", text: `Revenue \u2014 ${money(film2.revenue)}` });
        if (film2.budget && film2.revenue) {
          const x = film2.revenue / film2.budget;
          box.createDiv({ cls: "reel-facet-value", text: `Returned ${x.toFixed(1)}\xD7 its budget` });
        }
      }
      if (meta.homepage) {
        const box = el.createDiv({ cls: "reel-facet-group" });
        box.createDiv({ cls: "reel-facet-label", text: "Official site" });
        const a = box.createEl("a", { cls: "reel-facet-value reel-link", text: meta.homepage, href: meta.homepage });
        a.setAttr("target", "_blank");
        a.setAttr("rel", "noopener");
      }
      const alts = (film2?.alternative_titles?.titles ?? []).filter((t) => t.title).slice(0, 8).map((t) => t.iso_3166_1 ? `${t.title} (${t.iso_3166_1})` : t.title ?? "");
      group("Also known as", alts);
    }
    /** Tagline, full overview, and the keywords TMDB tags a title with. */
    renderStoryline(el, meta) {
      if (meta.tagline)
        el.createDiv({ cls: "reel-tagline", text: meta.tagline });
      if (this.entry.overview)
        el.createDiv({ cls: "reel-facet-prose", text: this.entry.overview });
      const keywords = keywordNames(meta);
      if (keywords.length) {
        const box = el.createDiv({ cls: "reel-facet-group" });
        box.createDiv({ cls: "reel-facet-label", text: "Keywords" });
        const chips = box.createDiv({ cls: "reel-chips" });
        for (const k of keywords.slice(0, 24)) {
          const chip = chips.createEl("button", { cls: "reel-chip", text: k, attr: { type: "button" } });
          chip.addEventListener("click", () => void this.plugin.openViewWithSearch(k));
        }
      }
    }
    /**
     * The parents-guide substitute.
     *
     * IMDb's own bands are not available through any API, so this derives the
     * same shape from DoesTheDogDie's community votes: what share of people
     * said a thing happens decides mild / moderate / severe. The vote counts
     * are shown rather than hidden, because a 3-vote "severe" and a 300-vote
     * one deserve different amounts of trust, and the link to IMDb's fuller
     * guide sits alongside.
     */
    renderContent(el) {
      const e = this.entry;
      if (e.certification) {
        const box = el.createDiv({ cls: "reel-facet-group" });
        box.createDiv({ cls: "reel-facet-label", text: "Certificate" });
        box.createDiv({ cls: "reel-facet-value", text: e.certification });
      }
      if (e.contentTopics.length) {
        const box = el.createDiv({ cls: "reel-facet-group" });
        box.createDiv({ cls: "reel-facet-label", text: "Reported by viewers" });
        box.createDiv({
          cls: "reel-dim",
          text: "Topics a majority of DoesTheDogDie voters confirmed. Not severity-rated \u2014 IMDb's guide below grades them."
        });
        for (const topic of e.contentTopics.slice(0, 40)) {
          const row = box.createDiv({ cls: "reel-content-row" });
          row.createSpan({ cls: "reel-band reported" });
          row.createSpan({ cls: "reel-content-name", text: topic });
        }
      }
      if (e.contentFlags.length) {
        const box = el.createDiv({ cls: "reel-facet-group" });
        box.createDiv({ cls: "reel-facet-label", text: "Flags on this note" });
        const chips = box.createDiv({ cls: "reel-chips" });
        for (const f of e.contentFlags) {
          chips.createSpan({ cls: "reel-chip static", text: FLAG_LABELS[f] ?? f });
        }
      }
      const imdb = imdbUrl(e.imdbId);
      if (imdb) {
        const a = el.createEl("a", { cls: "reel-btn", text: "Full parents guide on IMDb", href: `${imdb}parentalguide` });
        a.setAttr("target", "_blank");
        a.setAttr("rel", "noopener");
      }
      if (!e.contentTopics.length) {
        el.createDiv({
          cls: "reel-dim",
          text: "No community content notes yet \u2014 add a DoesTheDogDie key in settings to fetch them."
        });
      }
    }
    renderGenres(el, genres) {
      const box = el.createDiv({ cls: "reel-facet-group" });
      box.createDiv({ cls: "reel-facet-label", text: "Genre" });
      const chips = box.createDiv({ cls: "reel-chips" });
      for (const g of genres) {
        const chip = chips.createEl("button", { cls: "reel-chip", text: g.name, attr: { type: "button" } });
        chip.addEventListener("click", () => void this.plugin.openViewWithSearch(g.name));
      }
    }
    /** Per-country release dates, grouped by kind, as TMDB reports them. */
    renderReleases(el, film2) {
      const KIND = {
        1: "Premiere",
        2: "Theatrical limited",
        3: "Theatrical",
        4: "Digital",
        5: "Physical",
        6: "TV"
      };
      const rows2 = [];
      for (const r of film2.release_dates?.results ?? []) {
        for (const d of r.release_dates ?? []) {
          rows2.push({
            kind: KIND[d.type ?? 3] ?? "Release",
            country: r.iso_3166_1 ?? "",
            date: d.release_date,
            cert: d.certification || void 0,
            note: d.note || void 0
          });
        }
      }
      if (!rows2.length) {
        el.createDiv({ cls: "reel-empty", text: "No release dates recorded." });
        return;
      }
      const mine = (this.plugin.settings.region || "US").toUpperCase();
      rows2.sort((a, b) => {
        if (a.country === mine && b.country !== mine)
          return -1;
        if (b.country === mine && a.country !== mine)
          return 1;
        return (a.date ?? "").localeCompare(b.date ?? "");
      });
      for (const kind of Object.values(KIND)) {
        const group = rows2.filter((r) => r.kind === kind);
        if (!group.length)
          continue;
        const box = el.createDiv({ cls: "reel-facet-group" });
        box.createDiv({ cls: "reel-facet-label", text: kind });
        for (const r of group.slice(0, 30)) {
          const line = box.createDiv({ cls: "reel-release-row" });
          line.createSpan({ cls: "reel-release-date", text: r.date ? prettyDate(r.date.slice(0, 10)) : "\u2014" });
          const flag = flagEmoji(r.country);
          if (flag)
            line.createSpan({ cls: "reel-release-flag", text: flag });
          line.createSpan({ cls: "reel-release-country", text: r.country });
          if (r.cert)
            line.createSpan({ cls: "reel-badge cert", text: r.cert });
          if (r.note)
            line.createSpan({ cls: "reel-dim", text: r.note });
        }
      }
    }
    /**
     * The full-bleed image behind the hero.
     *
     * Two layers, because the honest offline answer and the good online one are
     * different images. The base is the local poster, scaled up and blurred
     * past the point of being readable as a poster — it is already in the
     * vault, it always exists, and blurred cover art is a defensible backdrop
     * rather than a stand-in for one. TMDB's real backdrop then fades in over
     * it if the note carries a path and the network cooperates.
     *
     * So there is never a blank hero, never a layout shift when the backdrop
     * lands, and no second image cached to disk for the sake of decoration.
     */
    paintBackdrop(hero, e) {
      const local = this.plugin.posters.displayUrl(e);
      const remote = e.backdropPath ? this.plugin.tmdb.posterUrl(e.backdropPath, "w780") : null;
      if (!local && !remote)
        return;
      hero.addClass("has-backdrop");
      hero.toggleClass("has-art", !!remote);
      const wrap = hero.createDiv({ cls: "reel-hero-backdrop" });
      if (local) {
        const base = wrap.createDiv({ cls: "reel-hero-backdrop-base" });
        base.setCssProps({ "--reel-backdrop": `url("${cssUrl2(local)}")` });
      }
      if (!remote)
        return;
      const img = wrap.createEl("img", {
        cls: "reel-hero-backdrop-img",
        attr: { src: remote, alt: "", decoding: "async" }
      });
      const settle = () => img.addClass("is-loaded");
      if (img.complete && img.naturalWidth > 0)
        settle();
      else
        img.addEventListener("load", settle, { once: true });
      img.addEventListener("error", () => img.remove(), { once: true });
    }
    /**
     * Stills and backdrops, fetched only when the tab is opened.
     *
     * Lazy on purpose: images are the largest block TMDB returns, and paying
     * for them on every title added would be a poor trade for a tab most
     * people never open.
     */
    async renderPhotos(el, isTv) {
      el.createDiv({ cls: "reel-loading", text: "Loading photos\u2026", attr: { role: "status" } });
      try {
        const data = await this.plugin.tmdb.getImages(this.entry.tmdbId, isTv ? "tv" : "movie");
        if (!el.isConnected)
          return;
        el.empty();
        const shots = (data.backdrops ?? []).map((b) => b.file_path).filter((p) => !!p);
        if (!shots.length) {
          el.createDiv({ cls: "reel-empty", text: "No photos for this title." });
          return;
        }
        const grid = el.createDiv({ cls: "reel-photos" });
        for (const path of shots.slice(0, 24)) {
          const src = this.plugin.tmdb.posterUrl(path, "w500");
          if (!src)
            continue;
          const cell = grid.createDiv({ cls: "reel-photo" });
          const img = cell.createEl("img", { attr: { src, alt: "", loading: "lazy", decoding: "async" } });
          img.addEventListener("error", () => cell.remove());
        }
      } catch (e) {
        if (!el.isConnected)
          return;
        el.empty();
        el.createDiv({ cls: "reel-error", text: redact(e) });
      }
    }
    /**
     * Community reviews from TMDB.
     *
     * Excerpted and linked, never reproduced whole: these are other people's
     * writing, often thousands of words, and a tracker has no business
     * republishing them. The opening lines are enough to decide whether to
     * read the rest on TMDB.
     */
    renderReviews(el, reviews2) {
      for (const r of reviews2.slice(0, 6)) {
        const box = el.createDiv({ cls: "reel-review" });
        const head = box.createDiv({ cls: "reel-review-head" });
        head.createSpan({ cls: "reel-review-author", text: r.author ?? r.author_details?.username ?? "Anonymous" });
        const stars2 = r.author_details?.rating;
        if (stars2 != null)
          head.createSpan({ cls: "reel-badge", text: `${stars2}/10` });
        if (r.created_at)
          head.createSpan({ cls: "reel-dim", text: prettyDate(r.created_at.slice(0, 10)) });
        const body = (r.content ?? "").trim();
        if (body) {
          const excerpt = body.length > 320 ? `${body.slice(0, 320).trimEnd()}\u2026` : body;
          box.createDiv({ cls: "reel-review-body", text: excerpt });
        }
        if (r.url) {
          const a = box.createEl("a", { cls: "reel-link", text: "Read on TMDB", href: r.url });
          a.setAttr("target", "_blank");
          a.setAttr("rel", "noopener");
        }
      }
    }
    /** Titles TMDB associates with this one — the "what next" question. */
    renderRelated(el, rows2) {
      const strip = el.createDiv({ cls: "reel-related" });
      for (const r of rows2.slice(0, 20)) {
        const card = strip.createDiv({ cls: "reel-related-card" });
        card.setAttr("role", "button");
        card.setAttr("tabindex", "0");
        card.setAttr("aria-label", `${r.title ?? r.name ?? "Untitled"} \u2014 see details`);
        const poster2 = card.createDiv({ cls: "reel-related-poster" });
        this.plugin.posters.attach(poster2, {
          posterUrl: this.plugin.tmdb.posterUrl(r.poster_path, "w342") ?? void 0,
          title: r.title ?? r.name ?? ""
        });
        card.createDiv({ cls: "reel-related-title", text: r.title ?? r.name ?? "Untitled" });
        const open = () => {
          const mine = this.plugin.library.byTmdbId(r.id, r.media_type === "tv" ? "tv" : "film");
          if (mine)
            void this.plugin.openDetail(mine);
          else
            this.plugin.openSearch({ query: r.title ?? r.name ?? "" });
        };
        card.addEventListener("click", open);
        card.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            open();
          }
        });
      }
    }
    /** Mean of every episode rating across all seasons, or null if none. */
    episodeAverage() {
      const values = [];
      for (const s of this.entry.seasons) {
        for (const v of Object.values(s.episode_ratings ?? {})) {
          if (typeof v === "number")
            values.push(v);
        }
      }
      if (!values.length)
        return null;
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
    /* ------------------------------------------------------------------ */
    renderControls(side) {
      const e = this.entry;
      const isTv = e.type === "tv";
      const box = side.createDiv({ cls: "reel-panel" });
      box.createDiv({ cls: "reel-panel-title", text: "Your entry" });
      const ratingBox = box.createDiv({ cls: "reel-control" });
      ratingBox.createDiv({ cls: "reel-field-label", text: "Rating" });
      const starRow = ratingBox.createDiv({ cls: "reel-rating-row" });
      renderStars(starRow, {
        value: e.rating,
        onChange: async (v) => {
          const file = this.file;
          if (!file)
            return;
          try {
            await this.plugin.notes.setRating(file, v ?? null);
            this.entry = { ...this.entry, rating: v };
            flash(starRow);
            this.plugin.undo.offer(v == null ? "Rating cleared" : `Rated ${v}`);
          } catch (err) {
            new Notice(`Reel: ${redact(err)}`);
          }
        }
      });
      const epAvg = this.episodeAverage();
      if (isTv && epAvg != null) {
        ratingBox.createDiv({
          cls: "reel-hint",
          text: `Episode average ${epAvg.toFixed(1)} \u2014 set automatically until you rate the series yourself.`
        });
      }
      const likeBox = box.createDiv({ cls: "reel-control" });
      likeBox.createDiv({ cls: "reel-field-label", text: "Liked" });
      const heart = likeBox.createEl("button", { cls: "reel-heart", text: e.liked ? "\u2665 Liked" : "\u2661 Like" });
      heart.toggleClass("is-on", !!e.liked);
      heart.addEventListener("click", async () => {
        const file = this.file;
        if (!file)
          return;
        const on = await this.plugin.notes.toggleLiked(file);
        this.entry = { ...this.entry, liked: on };
        heart.setText(on ? "\u2665 Liked" : "\u2661 Like");
        heart.toggleClass("is-on", on);
        flash(heart);
      });
      const known = this.plugin.library.lists();
      if (known.length || e.lists.length) {
        const listBox = box.createDiv({ cls: "reel-control" });
        listBox.createDiv({ cls: "reel-field-label", text: "Lists" });
        const listRow = listBox.createDiv({ cls: "reel-status-row" });
        for (const name of [.../* @__PURE__ */ new Set([...known, ...e.lists])].sort()) {
          const pill = listRow.createEl("button", { cls: "reel-chip", text: name });
          const on = () => this.entry.lists.includes(name);
          pill.toggleClass("is-active", on());
          pill.addEventListener("click", () => {
            void (async () => {
              const file = this.file;
              if (!file)
                return;
              const next = on() ? this.entry.lists.filter((l) => l !== name) : [...this.entry.lists, name];
              await this.plugin.notes.setLists(file, next);
              this.entry = { ...this.entry, lists: next };
              pill.toggleClass("is-active", on());
              flash(pill);
            })();
          });
        }
      }
      const statusBox = box.createDiv({ cls: "reel-control" });
      statusBox.createDiv({ cls: "reel-field-label", text: "Status" });
      const statusRow = statusBox.createDiv({ cls: "reel-status-row" });
      for (const status of isTv ? TV_STATUSES : FILM_STATUSES) {
        const pill = statusRow.createEl("button", { cls: "reel-chip", text: status });
        pill.toggleClass("is-active", this.entry.status === status);
        pill.addEventListener("click", async () => {
          const file = this.file;
          if (!file)
            return;
          await this.plugin.notes.setStatus(file, status);
          this.entry = { ...this.entry, status };
          statusRow.findAll(".reel-chip").forEach((c) => c.removeClass("is-active"));
          pill.addClass("is-active");
          flash(pill);
        });
      }
      const reviewBox = box.createDiv({ cls: "reel-control" });
      reviewBox.createDiv({ cls: "reel-field-label", text: "Review" });
      paintReviews(this.plugin, reviewBox, this.entry, {
        editable: true,
        heading: "",
        onChange: () => this.rerender()
      });
    }
    renderActions(side) {
      const e = this.entry;
      const isTv = e.type === "tv";
      const box = side.createDiv({ cls: "reel-panel" });
      const actions = box.createDiv({ cls: "reel-detail-actions" });
      const act = (label, cta, fn) => {
        const b = actions.createEl("button", { cls: `reel-btn${cta ? " mod-cta" : ""}`, text: label });
        b.addEventListener("click", fn);
        return b;
      };
      if (!isTv) {
        act(e.watched.length ? "Log another watch" : "Log watch", true, () => {
          const file = this.file;
          if (file)
            new LogSheet(this.plugin.app, this.plugin, { file, entry: e }).open();
        });
      } else {
        const next = this.plugin.upNext.nextFor(e);
        if (next) {
          act(`Watched S${next.season}E${next.episode}`, true, async () => {
            const file = this.file;
            if (!file)
              return;
            await this.plugin.notes.markEpisode(file, next.season, next.episode);
            this.plugin.undo.offer(`S${next.season}E${next.episode} watched`);
          });
        }
        act("Start a rewatch", false, async () => {
          const file = this.file;
          if (!file)
            return;
          await this.plugin.notes.restartSeries(file, e.rating);
          this.plugin.undo.offer("Progress reset \u2014 previous run recorded");
        });
      }
      act("Lists", false, () => {
        const file = this.file;
        if (file)
          new ListPicker(this.plugin.app, this.plugin, e, file).open();
      });
      act("Refresh", false, async () => {
        try {
          this.episodeCache.clear();
          await this.plugin.notes.refreshMetadata(e);
          new Notice("Metadata refreshed");
        } catch (err) {
          new Notice(`Reel: ${redact(err)}`);
        }
      });
      const remove = actions.createEl("button", { cls: "reel-btn reel-btn-danger", text: "Remove" });
      remove.addEventListener("click", () => {
        if (remove.dataset.confirming !== "true") {
          remove.dataset.confirming = "true";
          remove.setText("Delete note?");
          window.setTimeout(() => {
            if (!remove.isConnected)
              return;
            remove.dataset.confirming = "false";
            remove.setText("Remove");
          }, 4e3);
          return;
        }
        void (async () => {
          const file = this.file;
          if (!file)
            return;
          try {
            await this.plugin.app.fileManager.trashFile(file);
            new Notice(`${e.title} moved to trash`);
            this.onBack();
          } catch (err) {
            new Notice(`Reel: ${redact(err)}`);
          }
        })();
      });
    }
    /** Cast, streaming and flags as aligned rows rather than run-on lines. */
    renderMeta(side) {
      const e = this.entry;
      const rows2 = [];
      if (e.cast.length) {
        const names = e.cast.map(unlink);
        const paired = names.map((n2, i) => {
          const character = e.characters[i];
          return character ? `${n2} as ${character}` : n2;
        });
        rows2.push(["Cast", paired.join(" \xB7 ")]);
      }
      if (e.providers.length)
        rows2.push(["Streaming", e.providers.join(", ")]);
      if (e.collection)
        rows2.push(["Collection", e.collection]);
      if (e.productionCompanies.length)
        rows2.push(["Studio", e.productionCompanies.slice(0, 3).join(", ")]);
      if (e.contentFlags.length) {
        rows2.push(["Contains", e.contentFlags.map((f) => FLAG_LABELS[f] ?? f).join(", ")]);
      }
      if (!rows2.length)
        return;
      const box = side.createDiv({ cls: "reel-panel" });
      box.createDiv({ cls: "reel-panel-title", text: "Details" });
      const dl = box.createDiv({ cls: "reel-meta" });
      for (const [k, v] of rows2) {
        const row = dl.createDiv({ cls: "reel-meta-row" });
        row.createDiv({ cls: "reel-meta-key", text: k });
        row.createDiv({ cls: "reel-meta-value", text: v });
      }
    }
    /* ------------------------------------------------------------------ */
    renderSeasons(main) {
      const e = this.entry;
      const wrap = main.createDiv({ cls: "reel-panel" });
      wrap.createDiv({ cls: "reel-panel-title", text: "Seasons" });
      const strip = wrap.createDiv({ cls: "reel-seasons" });
      for (const s of e.seasons) {
        const total = s.total ?? 0;
        const seen = rangeCount(s.watched);
        const pill = strip.createDiv({ cls: "reel-season-pill" });
        pill.createSpan({ cls: "reel-season-n", text: `S${s.n}` });
        pill.createSpan({ cls: "reel-dim", text: total ? `${seen}/${total}` : String(seen) });
        if (s.rating != null)
          pill.createSpan({ cls: "reel-season-rating", text: `${s.rating}\u2605` });
        if (total && seen >= total)
          pill.addClass("is-complete");
        else if (seen > 0)
          pill.addClass("is-partial");
        if (this.openSeason === s.n)
          pill.addClass("is-open");
        pill.setAttr("aria-expanded", String(this.openSeason === s.n));
        pill.setCssProps({ "--reel-fill": total ? String(Math.min(1, seen / total)) : "0" });
        pill.addEventListener("click", () => {
          this.openSeason = this.openSeason === s.n ? null : s.n;
          this.rerender();
        });
      }
      if (this.openSeason != null)
        void this.renderEpisodes(wrap, this.openSeason);
    }
    async renderEpisodes(wrap, season) {
      const e = this.entry;
      const listEl = wrap.createDiv({ cls: "reel-episodes" });
      listEl.createDiv({ cls: "reel-loading", text: `Loading season ${season}\u2026`, attr: { role: "status" } });
      let episodes = this.episodeCache.get(season);
      if (!episodes) {
        const ended = e.showStatus === "Ended" || e.showStatus === "Canceled";
        try {
          const data = await this.plugin.tmdb.getSeason(e.tmdbId, season, ended);
          episodes = (data.episodes ?? []).filter((x) => x.episode_number > 0);
          this.episodeCache.set(season, episodes);
        } catch (err) {
          listEl.empty();
          listEl.createDiv({ cls: "reel-error", text: redact(err) });
          return;
        }
      }
      const row = e.seasons.find((s) => s.n === season);
      const watched = new Set(parseRange(row?.watched));
      const ratings = { ...row?.episode_ratings ?? {} };
      listEl.empty();
      let firstUnwatched = null;
      const remaining = episodes.filter((x) => !watched.has(x.episode_number)).length;
      if (remaining) {
        listEl.createDiv({
          cls: "reel-block-count",
          text: `${remaining} of ${episodes.length} left in season ${season}`
        });
      }
      const bulk = listEl.createDiv({ cls: "reel-season-bulk" });
      const markAll = bulk.createEl("button", { cls: "reel-chip", text: "Mark all watched" });
      markAll.addEventListener("click", async () => {
        const file = this.file;
        if (!file || !episodes)
          return;
        await this.plugin.notes.setSeasonRange(file, season, `1-${episodes.length}`);
        this.plugin.undo.offer(`Season ${season} marked watched`);
      });
      const clear = bulk.createEl("button", { cls: "reel-chip", text: "Clear" });
      clear.addEventListener("click", async () => {
        const file = this.file;
        if (!file)
          return;
        await this.plugin.notes.setSeasonRange(file, season, "");
        this.plugin.undo.offer(`Season ${season} cleared`);
      });
      for (const ep of episodes) {
        const n2 = ep.episode_number;
        const epRow = listEl.createDiv({ cls: "reel-episode" });
        epRow.toggleClass("is-watched", watched.has(n2));
        const tick = epRow.createDiv({ cls: "reel-episode-tick" });
        tick.createSpan({ text: "\u2713" });
        tick.setAttr("aria-label", `Episode ${n2}`);
        tick.setAttr("role", "button");
        tick.setAttr("aria-label", `Toggle episode ${n2}`);
        tick.addEventListener("click", async () => {
          const file = this.file;
          if (!file)
            return;
          haptic("tick");
          if (watched.has(n2))
            watched.delete(n2);
          else
            watched.add(n2);
          epRow.toggleClass("is-watched", watched.has(n2));
          const range = formatRange([...watched]);
          await this.plugin.notes.setSeasonRange(file, season, range);
          this.entry = {
            ...this.entry,
            seasons: this.entry.seasons.map((s) => s.n === season ? { ...s, watched: range } : s)
          };
        });
        const epBody = epRow.createDiv({ cls: "reel-episode-body" });
        epBody.createDiv({ cls: "reel-episode-title", text: `${n2}. ${ep.name ?? `Episode ${n2}`}` });
        const meta = epBody.createDiv({ cls: "reel-episode-meta" });
        if (ep.air_date)
          meta.createSpan({ text: prettyDate(ep.air_date) });
        if (ep.runtime)
          meta.createSpan({ text: `${ep.runtime}m` });
        const starWrap = epRow.createDiv({ cls: "reel-episode-stars" });
        starWrap.setAttr("aria-label", `Rate episode ${n2}`);
        renderStars(starWrap, {
          value: ratings[String(n2)],
          compact: true,
          onChange: async (v) => {
            const file = this.file;
            if (!file)
              return;
            if (v == null)
              delete ratings[String(n2)];
            else {
              ratings[String(n2)] = v;
              watched.add(n2);
              epRow.addClass("is-watched");
            }
            await this.plugin.notes.rateEpisode(file, season, n2, v ?? null);
            this.plugin.undo.offer(v == null ? `S${season}E${n2} cleared` : `S${season}E${n2} rated ${v}`);
          }
        });
        if (!firstUnwatched && !watched.has(n2)) {
          firstUnwatched = epRow;
        }
      }
      if (firstUnwatched) {
        window.setTimeout(() => firstUnwatched?.scrollIntoView({ block: "nearest" }), 0);
      }
    }
    renderHistory(main) {
      const e = this.entry;
      if (!e.watched.length)
        return;
      const wrap = main.createDiv({ cls: "reel-panel" });
      wrap.createDiv({ cls: "reel-panel-title", text: `Watch history \u2014 ${e.watched.length}` });
      const list = wrap.createDiv({ cls: "reel-history" });
      for (const w of [...e.watched].reverse()) {
        const row = list.createDiv({ cls: "reel-history-row" });
        row.createSpan({ text: prettyDate(w.date) });
        if (w.rating != null)
          row.createSpan({ cls: "reel-dim", text: `\u2605 ${w.rating}` });
        if (w.rewatch)
          row.createSpan({ cls: "reel-badge subtle", text: "rewatch" });
      }
    }
  };
  function cssUrl2(path) {
    return path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  // src/util/blend.ts
  function becauseText(because, cap = 3) {
    const names = because.slice(0, cap);
    const extra = because.length - names.length;
    let list;
    if (names.length === 1)
      list = names[0];
    else if (names.length === 2)
      list = `${names[0]} and ${names[1]}`;
    else
      list = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    if (extra > 0)
      list += ` and ${extra} more`;
    return `Because it's like ${list}`;
  }

  // src/util/recipe.ts
  function emptyRecipe() {
    return {
      seeds: [],
      pool: "loved",
      genres: [],
      genreMode: "all",
      withoutGenres: [],
      decades: [],
      excludeOwned: true,
      minAgreement: 1
    };
  }
  function describeConstraints(recipe2, genreName) {
    const out = [];
    if (recipe2.genres.length) {
      const joiner = recipe2.genreMode === "all" ? " and " : " or ";
      out.push(recipe2.genres.map(genreName).join(joiner));
    }
    if (recipe2.withoutGenres.length)
      out.push(`not ${recipe2.withoutGenres.map(genreName).join(" or ")}`);
    if (recipe2.minScore != null)
      out.push(`rated ${recipe2.minScore}+ on TMDB`);
    if (recipe2.maxRuntime != null)
      out.push(`under ${recipe2.maxRuntime} minutes`);
    if (recipe2.decades.length)
      out.push(recipe2.decades.map((d) => `${d}s`).join(" or "));
    if (recipe2.excludeOwned)
      out.push("not already in your library");
    if (recipe2.minAgreement > 1)
      out.push(`${recipe2.minAgreement}+ of your picks agree`);
    return out;
  }
  function recipeKey(recipe2) {
    return JSON.stringify({
      seeds: [...recipe2.seeds].sort((a, b) => a - b),
      genres: [...recipe2.genres].sort((a, b) => a - b),
      genreMode: recipe2.genreMode,
      withoutGenres: [...recipe2.withoutGenres].sort((a, b) => a - b),
      minScore: recipe2.minScore ?? null,
      maxRuntime: recipe2.maxRuntime ?? null,
      decades: [...recipe2.decades].sort((a, b) => a - b),
      excludeOwned: recipe2.excludeOwned,
      minAgreement: recipe2.minAgreement
    });
  }

  // src/ui/recipeSheet.ts
  var POOLS = [
    { id: "loved", label: "Loved", hint: "Rated 4+, liked, or marked for a rewatch" },
    { id: "rewatch", label: "Would rewatch", hint: "The ones you said you'd watch again" },
    { id: "all", label: "Everything", hint: "Anything you've logged" }
  ];
  var RUNTIMES = [
    { minutes: 90, label: "90 min" },
    { minutes: 120, label: "2 hours" },
    { minutes: 150, label: "2\xBD hours" }
  ];
  var RecipeSheet = class extends Modal {
    constructor(plugin2, saved) {
      super(plugin2.app);
      this.plugin = plugin2;
      this.recipe = emptyRecipe();
      this.step = "seeds";
      this.genres = [];
      this.results = null;
      this.running = false;
      /** Live match count for the current constraints; null while unknown. */
      this.matches = null;
      this.seedFilter = "";
      this.genreName = (id) => this.genres.find((g) => g.id === id)?.name ?? String(id);
      /**
       * The live count, debounced.
       *
       * Every chip tap would otherwise fire a request, and tapping through six
       * genres to find the right pair would fire six. The count is a comfort,
       * not an answer — it can afford to arrive a third of a second late.
       */
      this.refreshCount = debounce(
        () => {
          const asked = recipeKey(this.recipe);
          void this.plugin.discover.count(this.recipe).then((n2) => {
            if (asked !== recipeKey(this.recipe))
              return;
            this.matches = n2;
            const el = this.contentEl.querySelector(".reel-recipe-count");
            if (el instanceof HTMLElement)
              el.setText(this.countText());
          }).catch(() => {
          });
        },
        350,
        true
      );
      if (saved)
        this.recipe = { ...emptyRecipe(), ...saved };
    }
    onOpen() {
      const { modalEl } = this;
      modalEl.addClass("reel-modal", "reel-recipe");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      void this.plugin.tmdb.genreList("movie").then((g) => {
        this.genres = g;
        this.paint();
      }).catch(() => this.paint());
      this.paint();
    }
    onClose() {
      this.contentEl.empty();
    }
    /* ------------------------------------------------------------------ */
    paint() {
      const el = this.contentEl;
      el.empty();
      this.paintProgress(el);
      if (this.step === "seeds")
        this.paintSeeds(el);
      else if (this.step === "mood")
        this.paintMood(el);
      else
        this.paintResults(el);
    }
    /**
     * Where you are in three steps.
     *
     * Tappable backwards, never forwards: stepping back to change a seed is a
     * thing people do constantly, and making them cancel and start again is
     * the cheapest way to make a wizard hateful.
     */
    paintProgress(el) {
      const steps = [
        { id: "seeds", label: "Picks" },
        { id: "mood", label: "Mood" },
        { id: "results", label: "Results" }
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
    paintSeeds(el) {
      el.createDiv({ cls: "reel-recipe-title", text: "What are you in the mood for?" });
      el.createDiv({
        cls: "reel-recipe-hint",
        text: "Pick a few you loved. The more you pick, the more the results have to agree \u2014 which is what makes them good."
      });
      const pools = el.createDiv({ cls: "reel-chips" });
      for (const p of POOLS) {
        const b = pools.createEl("button", { cls: "reel-chip", text: p.label, attr: { type: "button", title: p.hint } });
        setSelected(b, this.recipe.pool === p.id);
        b.addEventListener("click", () => {
          this.recipe.pool = p.id;
          this.paint();
        });
      }
      const pool2 = this.plugin.discover.seedPool(this.recipe.pool);
      if (!pool2.length) {
        const why = this.recipe.pool === "rewatch" ? "Nothing is marked 'would rewatch' yet \u2014 long-press a poster and tap Again." : this.recipe.pool === "loved" ? "Nothing rated 4 or above yet. Try Everything, or rate a few first." : "Nothing logged yet.";
        el.createDiv({ cls: "reel-empty", text: why });
        this.paintNav(el, { next: "Skip to mood", onNext: () => this.go("mood") });
        return;
      }
      if (pool2.length > 12) {
        const search = el.createEl("input", {
          cls: "reel-input",
          attr: { type: "search", placeholder: "Find one of yours\u2026", enterkeyhint: "search" }
        });
        search.value = this.seedFilter;
        search.addEventListener("input", () => {
          this.seedFilter = search.value;
          this.paintSeedGrid(grid, pool2);
        });
      }
      const grid = el.createDiv({ cls: "reel-recipe-seeds" });
      this.paintSeedGrid(grid, pool2);
      const n2 = this.recipe.seeds.length;
      this.paintNav(el, {
        count: n2 ? `${n2} picked` : "None picked yet",
        next: n2 ? "Next" : "Skip \u2014 just filter",
        onNext: () => this.go("mood")
      });
    }
    paintSeedGrid(grid, pool2) {
      grid.empty();
      const q = this.seedFilter.trim().toLowerCase();
      const rows2 = q ? pool2.filter((e) => e.title.toLowerCase().includes(q)) : pool2;
      if (!rows2.length) {
        grid.createDiv({ cls: "reel-empty", text: `Nothing of yours matches "${this.seedFilter}".` });
        return;
      }
      const picked = rows2.filter((e) => this.recipe.seeds.includes(e.tmdbId));
      const rest = rows2.filter((e) => !this.recipe.seeds.includes(e.tmdbId)).slice(0, 60);
      for (const entry of [...picked, ...rest]) {
        const on = this.recipe.seeds.includes(entry.tmdbId);
        const cell = grid.createDiv({ cls: "reel-recipe-seed" });
        cell.toggleClass("is-on", on);
        cell.setAttr("role", "button");
        cell.setAttr("tabindex", "0");
        cell.setAttr("aria-pressed", on ? "true" : "false");
        cell.setAttr("aria-label", `${entry.title}${on ? " \u2014 picked" : ""}`);
        const poster2 = cell.createDiv({ cls: "reel-recipe-seed-poster" });
        this.plugin.posters.attach(poster2, entry);
        if (on)
          setIcon(poster2.createDiv({ cls: "reel-recipe-seed-tick" }), "check");
        cell.createDiv({ cls: "reel-recipe-seed-title", text: entry.title });
        const toggle = () => {
          haptic("tick");
          this.recipe.seeds = on ? this.recipe.seeds.filter((id) => id !== entry.tmdbId) : [...this.recipe.seeds, entry.tmdbId];
          this.paint();
        };
        cell.addEventListener("click", toggle);
        cell.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ")
            return;
          ev.preventDefault();
          toggle();
        });
      }
    }
    /* ---- step 2: constraints ---------------------------------------- */
    paintMood(el) {
      el.createDiv({ cls: "reel-recipe-title", text: "Narrow it down" });
      const section = (label) => el.createDiv({ cls: "reel-recipe-label", text: label });
      section("Genres");
      if (this.recipe.genres.length > 1) {
        const mode = el.createDiv({ cls: "reel-seg" });
        for (const [value, text, hint] of [
          ["all", "Both", "Films that are all of these"],
          ["any", "Either", "Films that are any of these"]
        ]) {
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
        b.setAttr("aria-label", `${g.name} \u2014 ${included ? "included" : excluded ? "excluded" : "off"}. Tap to change.`);
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
      section("How long have you got?");
      const times = el.createDiv({ cls: "reel-chips" });
      for (const r of RUNTIMES) {
        const b = times.createEl("button", { cls: "reel-chip", text: r.label, attr: { type: "button" } });
        setSelected(b, this.recipe.maxRuntime === r.minutes);
        b.addEventListener("click", () => {
          this.recipe.maxRuntime = this.recipe.maxRuntime === r.minutes ? void 0 : r.minutes;
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
          this.recipe.minScore = this.recipe.minScore === s ? void 0 : s;
          this.refreshCount();
          this.paint();
        });
      }
      section("Decade");
      const decades = el.createDiv({ cls: "reel-chips" });
      for (const d of [1970, 1980, 1990, 2e3, 2010, 2020]) {
        const b = decades.createEl("button", { cls: "reel-chip", text: `${d}s`, attr: { type: "button" } });
        const on = this.recipe.decades.includes(d);
        setSelected(b, on);
        b.addEventListener("click", () => {
          this.recipe.decades = on ? this.recipe.decades.filter((x) => x !== d) : [...this.recipe.decades, d];
          this.refreshCount();
          this.paint();
        });
      }
      if (this.recipe.seeds.length > 1) {
        section("How closely should your picks agree?");
        const agree = el.createDiv({ cls: "reel-chips" });
        for (let n2 = 1; n2 <= Math.min(3, this.recipe.seeds.length); n2++) {
          const b = agree.createEl("button", {
            cls: "reel-chip",
            text: n2 === 1 ? "Any of them" : `${n2}+ of them`,
            attr: { type: "button" }
          });
          setSelected(b, this.recipe.minAgreement === n2);
          b.addEventListener("click", () => {
            this.recipe.minAgreement = n2;
            this.paint();
          });
        }
      }
      const owned = el.createDiv({ cls: "reel-chips" });
      const skip = owned.createEl("button", {
        cls: "reel-chip",
        text: "Hide what I already have",
        attr: { type: "button" }
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
        }
      });
    }
    countText() {
      if (this.matches == null)
        return "Nothing narrowed yet";
      if (this.matches === 0)
        return "Nothing matches \u2014 try loosening something";
      return `${this.matches.toLocaleString()} film${this.matches === 1 ? "" : "s"} match`;
    }
    /* ---- step 3: results -------------------------------------------- */
    paintResults(el) {
      const constraints = describeConstraints(this.recipe, this.genreName);
      if (constraints.length)
        el.createDiv({ cls: "reel-recipe-hint", text: constraints.join(" \xB7 ") });
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
        const poster2 = card.createDiv({ cls: "reel-recipe-result-poster" });
        this.plugin.posters.attach(poster2, {
          posterUrl: this.plugin.tmdb.posterUrl(item.poster_path, "w342") ?? void 0,
          title
        });
        if (row.agreement > 1) {
          poster2.createDiv({ cls: "reel-recipe-agree", text: `${row.agreement}\xD7` });
        }
        card.createDiv({ cls: "reel-recipe-result-title", text: title });
        if (row.because.length) {
          card.createDiv({ cls: "reel-recipe-because", text: becauseText(row.because) });
        }
        card.setAttr("role", "button");
        card.setAttr("tabindex", "0");
        card.setAttr("aria-label", `${title} \u2014 ${row.because.length ? becauseText(row.because) : "see details"}`);
        card.addEventListener("click", () => this.preview(item));
      }
      const actions = el.createDiv({ cls: "reel-recipe-actions" });
      const quick2 = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Go through them one by one" });
      quick2.addEventListener("click", () => {
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
    async explainEmpty(el) {
      const box = el.createDiv({ cls: "reel-empty-state" });
      setIcon(box.createDiv({ cls: "reel-empty-icon" }), "search-x");
      box.createDiv({ cls: "reel-empty-title", text: "Nothing matches all of that" });
      const body = box.createDiv({ cls: "reel-empty-body", text: "Working out which part is the problem\u2026" });
      let culprit = null;
      try {
        culprit = await this.plugin.discover.blameFor(this.recipe, this.genreName);
      } catch {
      }
      if (!box.isConnected)
        return;
      const show = box.createEl("button", { cls: "reel-link", text: "Show the query" });
      show.addEventListener("click", () => {
        show.remove();
        const dump = box.createDiv({ cls: "reel-recipe-query" });
        const queries = this.plugin.discover.describeQueries(this.recipe);
        dump.createDiv({ text: queries.length ? `${queries.length} query to TMDB:` : "No query \u2014 nothing constrains it." });
        for (const q of queries)
          dump.createEl("code", { text: q });
        const cert = this.plugin.settings.maxCertification;
        if (cert)
          dump.createDiv({ text: `Content filter: certification \u2264 ${cert}. This applies to every search.` });
        const dismissed = this.plugin.settings.dismissedIds.length;
        if (dismissed)
          dump.createDiv({ text: `${dismissed} title(s) hidden by "not interested".` });
        dump.createDiv({ text: `${this.plugin.library.size} in your library, hidden: ${this.recipe.excludeOwned}` });
      });
      if (!culprit) {
        body.setText(
          "Even loosening one thing doesn't help. That usually means something outside these filters is cutting it \u2014 the query below will say what."
        );
        return;
      }
      body.setText(`It's ${culprit.label}. Drop it and you get ${culprit.without.toLocaleString()} results.`);
      const fix = box.createDiv({ cls: "reel-empty-actions" });
      const btn = fix.createEl("button", { cls: "reel-btn mod-cta", text: "Drop it and try again" });
      btn.addEventListener("click", () => {
        const key = culprit.key;
        if (key === "minScore")
          this.recipe.minScore = void 0;
        else if (key === "maxRuntime")
          this.recipe.maxRuntime = void 0;
        else if (key === "decades")
          this.recipe.decades = [];
        else if (key === "withoutGenres")
          this.recipe.withoutGenres = [];
        else if (key === "genreMode")
          this.recipe.genreMode = "any";
        else if (key === "genres")
          this.recipe.genres = [];
        this.results = null;
        this.paint();
        void this.run();
      });
    }
    async run() {
      if (this.running)
        return;
      this.running = true;
      try {
        this.results = await this.plugin.discover.run(this.recipe);
      } catch (e) {
        this.results = [];
        reportFailure(e, { context: "Couldn't run that", retry: () => void this.run() });
      } finally {
        this.running = false;
        this.paint();
      }
    }
    preview(item) {
      new PreviewSheet(this.plugin, item, () => {
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
    save() {
      const key = recipeKey(this.recipe);
      const existing = this.plugin.settings.recipes.find((r) => recipeKey(r) === key);
      if (existing) {
        new Notice(`Reel: already saved as "${existing.name}".`);
        return;
      }
      const suggestion = describeConstraints(this.recipe, this.genreName).filter((c) => c !== "not already in your library").slice(0, 2).join(", ") || "My recipe";
      const modal = new Modal(this.app);
      modal.titleEl.setText("Name this recipe");
      const input = modal.contentEl.createEl("input", {
        cls: "reel-input",
        attr: { type: "text", placeholder: "Sunday afternoon" }
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
      window.setTimeout(() => input.select(), 0);
    }
    /* ---- shared footer ---------------------------------------------- */
    paintNav(el, opts) {
      const nav = el.createDiv({ cls: "reel-recipe-nav" });
      if (opts.count)
        nav.createDiv({ cls: "reel-recipe-count", text: opts.count });
      const btn = nav.createEl("button", { cls: "reel-btn mod-cta", text: opts.next, attr: { type: "button" } });
      btn.addEventListener("click", opts.onNext);
    }
    go(step) {
      this.step = step;
      if (step === "mood")
        this.refreshCount();
      this.paint();
    }
  };

  // src/settings.ts
  var DEFAULT_SETTINGS = {
    keyMode: "encrypted",
    keysPlain: null,
    keyBlob: null,
    keyNames: [],
    enrich: true,
    filmFolder: "Movies",
    seriesFolder: "Series",
    posterFolder: "Movies/_posters",
    peopleFolder: "Movies/People",
    linkPeople: true,
    castLimit: 10,
    region: "US",
    includeSpecials: false,
    askForReview: true,
    linkFromDailyNote: false,
    dailyNotePrefix: "- Watched",
    dailyNoteFolder: "",
    lastEpisodeCheck: "",
    dismissedIds: [],
    people: {},
    lastTab: "library",
    lastSeenVersion: "",
    libraryLayout: "grid",
    librarySort: "watched",
    recentSearches: [],
    recipes: [],
    hideFlags: [],
    maxCertification: null,
    hideUnrated: false,
    posterQuality: "w342",
    downloadPosters: true,
    cacheResponses: true,
    cacheTtlDays: 30,
    openNoteAfterCreate: true,
    checkNewEpisodes: true,
    language: "en-US",
    noteTemplate: "\n## Notes\n\n"
  };

  // harness/audit.ts
  function luminance(colour) {
    const parts = colour.match(/[\d.]+/g);
    if (!parts || parts.length < 3)
      return null;
    if (parts.length > 3 && Number(parts[3]) === 0)
      return null;
    const [r, g, b] = parts.slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(fg, bg) {
    const a = luminance(fg);
    const b = luminance(bg);
    if (a == null || b == null)
      return null;
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
  }
  function backdropOf(el) {
    for (let p = el; p; p = p.parentElement) {
      const bg = getComputedStyle(p).backgroundColor;
      const parts = bg.match(/[\d.]+/g);
      if (parts && (parts.length < 4 || Number(parts[3]) > 0.5))
        return bg;
    }
    return getComputedStyle(document.body).backgroundColor;
  }
  var TAPPABLE = 'button, input, select, textarea, a, [role="button"], [contenteditable="true"], .clickable-icon';
  function shown(el) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0")
      return false;
    return !el.closest("details:not([open])");
  }
  function scrollableOut(el, stopAt) {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && p.scrollHeight > p.clientHeight + 1)
        return true;
      if (p === stopAt)
        break;
    }
    return false;
  }
  var SCROLLERS = [
    "reel-chips",
    "reel-suggest",
    "reel-sortbar",
    "reel-caststrip",
    "reel-drow-strip",
    "reel-chart-strip",
    "reel-otd-strip",
    "reel-recipe-seeds",
    "reel-skel-strip",
    "reel-related-strip",
    "reel-preview-links"
  ];
  function auditScreen(view, opts) {
    const paneRight = view.getBoundingClientRect().right;
    const vw = Math.min(window.innerWidth, Math.round(paneRight) || window.innerWidth);
    const vh = window.innerHeight;
    const out = [];
    const check = (name, ok, detail2 = "") => out.push({ name, ok, detail: detail2 });
    const crashed = view.querySelector("pre");
    check("rendered", !crashed, crashed ? (crashed.textContent ?? "").slice(0, 90) : "");
    check("phoneClass", view.classList.contains("is-phone") === opts.phone, "compact layout keys off this");
    const escaped = [...view.querySelectorAll("*")].filter((el) => {
      if (el.getBoundingClientRect().right <= vw + 1)
        return false;
      for (let p = el; p; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== "visible")
          return false;
        if ([...p.classList].some((c) => SCROLLERS.includes(c)))
          return false;
      }
      return true;
    });
    check(
      "noOverflow",
      escaped.length === 0,
      escaped.slice(0, 3).map((e) => e.className.split(" ")[0]).join(", ")
    );
    const wide = [...view.querySelectorAll("*")].filter((el) => {
      if (el.getBoundingClientRect().right <= paneRight + 1)
        return false;
      for (let p = el.parentElement; p && p !== view; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== "visible")
          return false;
        if ([...p.classList].some((c) => SCROLLERS.includes(c)))
          return false;
      }
      return true;
    }).map((el) => `${el.className.split(" ")[0] || el.tagName} +${Math.round(el.getBoundingClientRect().right - paneRight)}px`);
    const clipped = [...view.querySelectorAll(".reel-view-body")].filter((b) => b.getBoundingClientRect().bottom > view.getBoundingClientRect().bottom + 2).map((b) => `${Math.round(b.getBoundingClientRect().height)} in a ${Math.round(view.getBoundingClientRect().height)} view`);
    check("bodyScrollsNotClips", clipped.length === 0, clipped.join(", "));
    const bodies = [...view.querySelectorAll(".reel-view-body")];
    const sliding = bodies.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => `${b.scrollWidth} vs ${b.clientWidth}`);
    check("bodyNoSideScroll", sliding.length === 0, sliding.join(", "));
    check(
      "paneNotWider",
      view.scrollWidth <= view.clientWidth + 1,
      `${view.scrollWidth} vs ${view.clientWidth}${wide.length ? ` \u2014 ${[...new Set(wide)].slice(0, 4).join(", ")}` : ""}`
    );
    const uneven = [...view.querySelectorAll(".reel-grid, .reel-recipe-results, .reel-recipe-seeds")].filter((g) => {
      const w = getComputedStyle(g).gridTemplateColumns.split(" ").map(parseFloat).filter(Number.isFinite);
      return w.length > 1 && Math.max(...w) - Math.min(...w) > 2;
    });
    check("gridTracksEqual", uneven.length === 0, uneven.map((g) => getComputedStyle(g).gridTemplateColumns).join(" | "));
    const first = view.querySelector(".reel-cell, .reel-row, .reel-upnext-row, .reel-chart, .reel-tile, .reel-hero, .reel-recipe-seed");
    if (first && !opts.keyboard) {
      const top = first.getBoundingClientRect().top;
      check("chromeUnderHalf", top < vh * 0.45, `${Math.round(top)}px, ${Math.round(top / vh * 100)}%`);
    }
    const reaches44 = (el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const top = r.top + r.height / 2 - 21;
      const bottom = r.top + r.height / 2 + 21;
      const hits = (y) => {
        if (y < 0 || y > window.innerHeight || cx < 0 || cx > window.innerWidth)
          return false;
        const hit = document.elementFromPoint(cx, y);
        return !!hit && (hit === el || el.contains(hit));
      };
      return hits(top) && hits(bottom);
    };
    const small = [...view.querySelectorAll('button, [role="button"], select')].filter((el) => {
      const h = el.getBoundingClientRect().height;
      if (h <= 0 || !shown(el) || el.closest(".reel-stars") || el.closest(".reel-episode-stars"))
        return false;
      if (el.closest(".reel-heatmap-grid"))
        return false;
      if (h >= 44)
        return false;
      return !reaches44(el);
    });
    const worst = /* @__PURE__ */ new Map();
    for (const el of small) {
      const k = el.className.split(" ")[0] || el.tagName;
      const r = el.getBoundingClientRect();
      if (worst.has(k))
        continue;
      const used = getComputedStyle(el).height;
      const drawn = `${Math.round(r.height)}px`;
      worst.set(
        k,
        `${drawn}${used !== drawn ? ` (laid out ${used} \u2014 mid-transform?)` : ""} at ${Math.round(r.left)},${Math.round(r.top)} in .${el.parentElement?.className.split(" ")[0] ?? "?"}`
      );
    }
    check("touchTargets44", small.length === 0, [...worst].map(([k, d]) => `${k} ${d}`).join(", "));
    if (opts.keyboard) {
      const unreachable = [];
      for (const modal of Array.from(view.querySelectorAll(".reel-modal"))) {
        const field = modal.querySelector("input, textarea");
        const action = modal.querySelector(".mod-cta");
        for (const el of [field, action]) {
          if (!el || !shown(el))
            continue;
          const r = el.getBoundingClientRect();
          if (r.height < 2)
            continue;
          if (r.top >= 0 && r.bottom <= window.innerHeight)
            continue;
          unreachable.push(
            `${el.className.split(" ")[0] || el.tagName} at y ${Math.round(r.top)}..${Math.round(r.bottom)} of ${window.innerHeight}`
          );
        }
      }
      check("typingVisible", unreachable.length === 0, unreachable.slice(0, 3).join(", "));
    }
    const blocked = [];
    for (const el of Array.from(view.querySelectorAll(TAPPABLE))) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || !shown(el))
        continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight)
        continue;
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || hit === el || el.contains(hit) || hit.contains(el))
        continue;
      const hr = hit.getBoundingClientRect();
      if (cx < hr.left - 1 || cx > hr.right + 1 || cy < hr.top - 1 || cy > hr.bottom + 1)
        continue;
      if (scrollableOut(el, view))
        continue;
      blocked.push(`${el.className.split(" ")[0] || el.tagName} under ${hit.className.split(" ")[0] || hit.tagName}`);
    }
    check("controlsNotCovered", blocked.length === 0, [...new Set(blocked)].slice(0, 4).join(", "));
    const tiny = /* @__PURE__ */ new Set();
    for (const el of view.querySelectorAll("*")) {
      if (el.childElementCount || !el.textContent?.trim())
        continue;
      if (el.closest(".reel-stars") || el.closest(".reel-tab-icon"))
        continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12)
        tiny.add(`${el.className.split(" ")[0] || el.tagName} ${fs}px`);
    }
    check("textAtLeast12px", tiny.size === 0, [...tiny].slice(0, 4).join(", "));
    const lowContrast = [];
    const probe = document.createElement("div");
    probe.style.background = "var(--interactive-accent)";
    document.body.appendChild(probe);
    const accentColour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    for (const el of view.querySelectorAll("*")) {
      if (el.childElementCount || !el.textContent?.trim())
        continue;
      if (el.closest(".reel-stars"))
        continue;
      const cs = getComputedStyle(el);
      const bgHere = backdropOf(el);
      if (bgHere === accentColour)
        continue;
      if (el.closest(".reel-heart, .reel-cell-heart, .reel-reaction-icon")) {
        const iconRatio = contrastRatio(cs.color, bgHere);
        if (iconRatio != null && iconRatio < 3) {
          lowContrast.push(`${el.className.split(" ")[0]} ${iconRatio.toFixed(2)}:1 (icon)`);
        }
        continue;
      }
      if (cs.visibility === "hidden" || cs.display === "none")
        continue;
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || bold && size >= 18.66;
      const ratio = contrastRatio(cs.color, backdropOf(el));
      if (ratio != null && ratio < (large ? 3 : 4.5)) {
        lowContrast.push(`${el.className.split(" ")[0] || el.tagName} ${ratio.toFixed(2)}:1`);
      }
    }
    check("contrastAA", lowContrast.length === 0, [...new Set(lowContrast)].slice(0, 4).join(", "));
    const targets = [...view.querySelectorAll('button, [role="button"], a, select, input')].filter((el) => {
      if (!shown(el))
        return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    });
    const overlaps = [];
    for (let i = 0; i < targets.length && overlaps.length < 3; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i];
        const b = targets[j];
        if (a.contains(b) || b.contains(a))
          continue;
        const floats = (el) => {
          for (let p = el; p; p = p.parentElement) {
            const pos = getComputedStyle(p).position;
            if (pos === "sticky" || pos === "fixed" || pos === "absolute")
              return true;
          }
          return false;
        };
        if (floats(a) || floats(b))
          continue;
        const inside = (x, y) => x.left >= y.left - 1 && x.right <= y.right + 1 && x.top >= y.top - 1 && x.bottom <= y.bottom + 1;
        if (inside(a.getBoundingClientRect(), b.getBoundingClientRect()))
          continue;
        if (inside(b.getBoundingClientRect(), a.getBoundingClientRect()))
          continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 3 && h > 3) {
          overlaps.push(
            `${a.className.split(" ")[0]} \xD7 ${b.className.split(" ")[0]} by ${Math.round(w)}\xD7${Math.round(h)}px at y=${Math.round(ra.top)}/${Math.round(rb.top)}`
          );
          break;
        }
      }
    }
    check("noOverlappingTargets", overlaps.length === 0, overlaps.join(", "));
    const tallChips = [...view.querySelectorAll(".reel-chip")].filter(
      (el) => el.getBoundingClientRect().height > 56
    );
    check("chipsNotOversized", tallChips.length === 0, `${tallChips.length} over 56px`);
    const walls = [...view.querySelectorAll(".reel-view-filters, .reel-view-header, .reel-tabs")].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.height > vh * 0.33;
    });
    check("chromeNotAWall", walls.length === 0, walls.map((e) => `${e.className.split(" ")[0]} ${Math.round(e.getBoundingClientRect().height)}px`).join(", "));
    return out;
  }

  // src/util/panewidth.ts
  var WIDTH_STEPS = [400, 500, 520, 620, 700, 760, 800, 900];
  var NARROW_AT = 600;
  function stampWidth(el, width) {
    const w = Number.isFinite(width) && width > 0 ? width : 0;
    const narrow = w > 0 ? w < NARROW_AT : true;
    el.toggleClass("is-narrow", narrow);
    el.toggleClass("is-wide", !narrow);
    for (const step of WIDTH_STEPS)
      el.toggleClass(`is-w${step}`, w >= step);
  }
  function measure(el) {
    const w = el.clientWidth || Math.round(el.getBoundingClientRect().width);
    return Number.isFinite(w) && w > 0 ? w : 0;
  }
  var TOP_CHROME = ".view-header";
  var BOTTOM_CHROME = ".mobile-toolbar, .mobile-navbar, .status-bar";
  function findFloatingBottomBar(view) {
    const floor = window.innerHeight * 0.75;
    let highest = null;
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el.closest(".reel-view, .reel-modal, .modal-container"))
        continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky")
        continue;
      if (cs.visibility === "hidden" || cs.display === "none")
        continue;
      const r = el.getBoundingClientRect();
      if (r.height < 24 || r.width < view.width * 0.4)
        continue;
      if (r.top < floor || r.top > window.innerHeight - 8)
        continue;
      if (r.right < view.left || r.left > view.right)
        continue;
      if (!highest || r.top < highest.getBoundingClientRect().top)
        highest = el;
    }
    return highest;
  }
  function findFloatingCorner(view) {
    const floor = window.innerHeight * 0.6;
    let best = null;
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el.closest(".reel-view, .reel-modal, .modal-container"))
        continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky")
        continue;
      if (cs.visibility === "hidden" || cs.display === "none")
        continue;
      const r = el.getBoundingClientRect();
      if (r.width < 28 || r.height < 28)
        continue;
      if (r.width > 120 || r.width > view.width * 0.4)
        continue;
      if (r.bottom < floor)
        continue;
      const nearRight = view.right - r.right < 40;
      const nearLeft = r.left - view.left < 40;
      if (!nearRight && !nearLeft)
        continue;
      if (!best || r.width > best.getBoundingClientRect().width)
        best = el;
    }
    return best;
  }
  function pickChrome(root, selector) {
    let best = null;
    let bestArea = 0;
    for (const el of Array.from(root.querySelectorAll(selector))) {
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area <= 0)
        continue;
      if (area > bestArea) {
        best = el;
        bestArea = area;
      }
    }
    return best;
  }
  function stampChromeInsets(el, root = document) {
    const rect = el.getBoundingClientRect();
    const clamp = (n2) => Math.round(Math.min(Math.max(n2, 0), 160));
    const header = pickChrome(root, TOP_CHROME);
    const top = header ? clamp(header.getBoundingClientRect().bottom - rect.top) : 0;
    const bar = pickChrome(root, BOTTOM_CHROME) ?? findFloatingBottomBar(rect);
    const bottom = bar ? clamp(rect.bottom - bar.getBoundingClientRect().top) : 0;
    const fab = findFloatingCorner(rect);
    const right = fab ? clamp(rect.right - fab.getBoundingClientRect().left + 8) : 0;
    const vars = {
      "--reel-top-inset": `${top}px`,
      "--reel-bottom-inset": `${bottom}px`,
      "--reel-bottom-right-inset": `${right}px`
    };
    el.setCssProps(vars);
    el.style.paddingTop = top > 0 ? `${top}px` : "";
    if (el !== document.body)
      document.body.setCssProps(vars);
  }
  function sheetFit() {
    const sync = () => {
      const h = Math.round(window.innerHeight * 0.88);
      document.body.setCssProps({ "--reel-sheet-max": `${h}px` });
    };
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    sync();
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      vv?.removeEventListener("resize", sync);
      document.body.style.removeProperty("--reel-sheet-max");
    };
  }
  function sizeBody(view, body) {
    const cs = getComputedStyle(view);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    const top = view.getBoundingClientRect().top;
    const inner = view.clientHeight - padTop - padBottom;
    if (!(inner > 0))
      return;
    let used = 0;
    for (const child of Array.from(view.children)) {
      if (child === body || !(child instanceof HTMLElement))
        continue;
      if (getComputedStyle(child).display === "none")
        continue;
      used += child.getBoundingClientRect().height;
    }
    const want = Math.round(inner - used);
    if (want >= 120) {
      lastGoodHeight.set(body, want);
      body.setCssProps({ height: `${want}px` });
      return;
    }
    body.setCssProps({ height: `${lastGoodHeight.get(body) ?? 120}px` });
  }
  var lastGoodHeight = /* @__PURE__ */ new WeakMap();

  // harness/main.ts
  function poster(title) {
    let h = 0;
    for (let i = 0; i < title.length; i++)
      h = (h * 31 + title.charCodeAt(i)) % 360;
    const short = title.length > 22 ? `${title.slice(0, 20)}\u2026` : title;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513">
		<rect width="342" height="513" fill="hsl(${h} 45% 32%)"/>
		<text x="171" y="256" fill="white" font-family="sans-serif" font-size="22"
		      text-anchor="middle">${short.replace(/[<>&]/g, "")}</text>
	</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
  var all = [...LIBRARY, SHOW, ...AWKWARD, LONG_SHOW];
  var pool = all;
  function withPool(rows2, run) {
    pool = rows2;
    try {
      run();
    } finally {
      pool = all;
    }
  }
  var FILM_META = {
    id: 120,
    genres: [
      { id: 12, name: "Adventure" },
      { id: 14, name: "Fantasy" },
      { id: 28, name: "Action" }
    ],
    tagline: "One ring to rule them all.",
    status: "Released",
    original_language: "en",
    budget: 93e6,
    revenue: 8715e5,
    production_companies: [{ id: 12, name: "New Line Cinema" }],
    credits: {
      cast: Array.from({ length: 14 }, (_, i) => ({
        id: 1e3 + i,
        name: ["Elijah Wood", "Ian McKellen", "Viggo Mortensen", "Sean Astin", "Orlando Bloom"][i % 5],
        character: i % 4 === 0 ? "A Character With A Considerably Longer Name" : "Frodo",
        profile_path: null
      })),
      crew: [
        { id: 108, name: "Peter Jackson", job: "Director", profile_path: null },
        { id: 109, name: "Fran Walsh", job: "Screenplay", profile_path: null },
        { id: 110, name: "Philippa Boyens", job: "Screenplay", profile_path: null },
        { id: 111, name: "Howard Shore", job: "Original Music Composer", profile_path: null }
      ]
    },
    recommendations: {
      results: Array.from({ length: 8 }, (_, i) => ({
        id: 2e3 + i,
        title: i === 0 ? "A Recommended Title That Will Not Fit On One Line" : `Related ${i}`,
        poster_path: "/rel.jpg",
        vote_average: 7 + i % 3,
        release_date: `20${10 + i}-05-01`,
        media_type: "movie"
      }))
    },
    release_dates: {
      results: [
        { iso_3166_1: "US", release_dates: [{ certification: "PG-13", release_date: "2001-12-19T00:00:00.000Z", type: 3 }] },
        { iso_3166_1: "GB", release_dates: [{ certification: "PG", release_date: "2001-12-19T00:00:00.000Z", type: 3 }] }
      ]
    },
    videos: { results: [] }
  };
  var plugin = {
    settings: { ...DEFAULT_SETTINGS, recentSearches: ["Inside Man"] },
    app: { vault: { getAbstractFileByPath: () => null }, workspace: { getLeaf: () => null } },
    library: {
      all: () => pool,
      films: () => pool.filter((e) => e.type === "film"),
      shows: () => pool.filter((e) => e.type === "tv"),
      inProgress: () => pool.filter((e) => e.type === "tv"),
      byPath: (p) => pool.find((e) => e.path === p),
      byTmdbId: (id) => pool.find((e) => e.tmdbId === id),
      peopleIds: () => /* @__PURE__ */ new Map([["Christopher Nolan", 525]]),
      size: all.length,
      on: () => ({}),
      // The detail screen asks for these; without them it threw before
      // drawing anything, and three screens reported green for rounds.
      lists: () => ["Favourites", "Rewatch pile"],
      genres: () => ["Action", "Comedy", "Drama"]
    },
    visible: (rows2) => rows2,
    hiddenCount: () => 0,
    posters: {
      attach(parent, entry) {
        parent.addClass("reel-poster-loading");
        const img = parent.createEl("img", { cls: "reel-img", attr: { src: poster(entry.title), alt: "" } });
        img.addClass("is-loaded");
        parent.removeClass("reel-poster-loading");
      },
      displayUrl: (e) => poster(e.title)
    },
    people: {
      attach(parent, name) {
        parent.addClass("is-empty");
        parent.createSpan({
          cls: "reel-placeholder-text",
          text: name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")
        });
      }
    },
    upNext: {
      nextFor: (e) => e.type === "tv" ? { season: 2, episode: 4 } : null,
      airingToday: () => false
    },
    undo: { offer: () => {
    }, record: () => {
    }, recordCreation: () => {
    }, undo: async () => null, last: null },
    swatches: { tint: () => {
    } },
    discover: {
      // The screen calls these on mount; without them it threw before it
      // drew anything, and the audit called that a pass.
      takeStaged: () => null,
      stage: () => {
      },
      seedPool: () => all.filter((e) => (e.rating ?? 0) >= 4),
      taste: async () => ({ genreIds: [28, 35], genreNames: ["Action", "Comedy"], seeds: all.slice(0, 3), directors: ["Christopher Nolan"], sparse: false }),
      rows: async () => [
        { id: "a", title: "More with Denzel Washington", items: all.slice(0, 8) },
        { id: "b", title: "Because you liked Inside Man", items: all.slice(4, 12) },
        { id: "c", title: "Trending this week", items: all.slice(2, 10) }
      ],
      count: async () => 100,
      run: async () => [],
      blameFor: async () => null,
      describeQueries: () => [],
      dismiss: async () => {
      }
    },
    tmdb: {
      posterUrl: (p) => p ? poster(String(p)) : null,
      genreList: async () => [
        { id: 28, name: "Action" },
        { id: 35, name: "Comedy" },
        { id: 27, name: "Horror" }
      ],
      /*
       * The half of the detail screen nobody had ever seen.
       *
       * `getFilm` was missing from this stub, so `renderFacets` threw and the
       * screen ended with "this.plugin.tmdb.getFilm is not a function" printed
       * where the cast strip, the credit rows and eight tabs should be. Every
       * check passed, because a caught error renders as one line of text and
       * one line of text has no layout faults.
       *
       * Two screens have now been audited green for weeks while showing an
       * error message. A stub that throws is not a neutral omission — it
       * silently removes whatever it was standing in for from the test.
       */
      getFilm: async () => FILM_META,
      getShow: async () => FILM_META,
      getImages: async () => ({ backdrops: [], posters: [] }),
      getSeason: async () => ({ episodes: [] })
    },
    openSearch: () => {
    },
    openDetail: () => {
    },
    openTab: () => {
    },
    openLibraryWithStatus: () => {
    },
    openViewWithSearch: () => {
    },
    openRecipe: () => {
    }
  };
  function library(root) {
    const header = root.createDiv({ cls: "reel-view-header" });
    const navBtn = header.createEl("button", { cls: "reel-nav-btn" });
    navBtn.createSpan({ cls: "reel-nav-icon", text: "\u25A3" });
    navBtn.createSpan({ cls: "reel-nav-label", text: "Library" });
    navBtn.createSpan({ cls: "reel-nav-chevron", text: "\u25BE" });
    const wrap = header.createDiv({ cls: "reel-search-wrap" });
    wrap.createSpan({ cls: "reel-search-icon", text: "\u2315" });
    wrap.createEl("input", {
      cls: "reel-input reel-search-input",
      attr: { type: "search", placeholder: "Search titles, people, characters, plots\u2026" }
    });
    wrap.createEl("button", { cls: "reel-search-clear clickable-icon", text: "\xD7" });
    const tabs = root.createDiv({ cls: "reel-tabs" });
    for (const t of ["Library", "Discover", "Rate", "Up next", "Diary", "Stats"]) {
      const b = tabs.createEl("button", { cls: "reel-tab" });
      b.createSpan({ cls: "reel-tab-icon", text: "\u25A3" });
      b.createSpan({ cls: "reel-tab-label", text: t });
      if (t === "Library")
        b.addClass("is-active");
    }
    const filters = root.createDiv({ cls: "reel-view-filters" });
    const suggest = filters.createDiv({ cls: "reel-suggest" });
    suggest.createSpan({ cls: "reel-suggest-label", text: "Try" });
    for (const s of ["Inside Man", "Christopher Nolan", "Denis Villeneuve", "Action", "Crime", "2010s"]) {
      suggest.createEl("button", { cls: "reel-chip reel-suggest-chip", text: s });
    }
    filterBar(filters, ["Films", "Science Fiction", "\u2630 Christmas with the family"]);
    const body = root.createDiv({ cls: "reel-view-body" });
    heroBand(body, {
      label: "Your library",
      title: `${all.length} titles`,
      sub: `Most recently \u2014 ${all[0].title} \xB7 14 to watch \xB7 2 hidden by content filter`,
      art: false,
      compact: true
    });
    renderPosterGrid(plugin, body, all);
  }
  function filterBar(into, active, sort = true) {
    const bar = into.createDiv({ cls: "reel-chips reel-filterbar" });
    const open = bar.createEl("button", { cls: "reel-chip reel-filter-btn" });
    open.createSpan({ cls: "reel-filter-btn-icon", text: "\u2699" });
    open.createSpan({ text: "Filters" });
    if (active.length)
      open.createSpan({ cls: "reel-filter-count", text: String(active.length) });
    if (sort) {
      const sel = bar.createEl("select", { cls: "reel-select dropdown reel-sort-select" });
      sel.createEl("option", { text: "Recently watched" });
      const layout = bar.createEl("button", { cls: "reel-chip reel-layout-btn" });
      layout.createSpan({ cls: "reel-layout-icon", text: "\u25A6" });
      layout.createSpan({ cls: "reel-layout-label", text: "Posters" });
      bar.createSpan({ cls: "reel-chip-sep", text: "\xB7" });
    }
    for (const label of active) {
      const tag = bar.createEl("button", { cls: "reel-chip is-active reel-filter-tag" });
      tag.createSpan({ text: label });
      tag.createSpan({ cls: "reel-filter-x", text: "\xD7" });
    }
    return bar;
  }
  function reviewPane(into, editable = true) {
    const pane = into.createDiv({ cls: "reel-yours" });
    pane.createDiv({ cls: "reel-yours-label", text: "Your review" });
    const item = pane.createDiv({ cls: "reel-yours-item" });
    const head = item.createDiv({ cls: "reel-yours-head" });
    head.createSpan({ cls: "reel-yours-date", text: "4 Aug 2026" });
    head.createSpan({ cls: "reel-yours-stars", text: "\u2605\u2605\u2605\u2605" });
    if (editable)
      head.createEl("button", { cls: "reel-yours-edit clickable-icon", text: "\u270E" });
    item.createDiv({
      cls: "reel-yours-body",
      text: "Held up far better than I expected. The middle hour drags, and then the last twenty minutes earn every bit of it back \u2014 I have not stopped thinking about the final shot since."
    });
    if (editable) {
      const add = pane.createEl("button", { cls: "reel-yours-add" });
      add.createSpan({ text: "+" });
      add.createSpan({ text: "Add another" });
    }
    return pane;
  }
  function feed(root) {
    root.addClass("reel-view-body");
    root.addClass("reel-discover");
    const head = root.createDiv({ cls: "reel-discover-head" });
    head.createDiv({
      cls: "reel-discover-note",
      text: "Based on your library \u2014 mostly drama, science fiction, thriller."
    });
    const refresh = head.createEl("button", { cls: "reel-chip reel-refresh" });
    refresh.createSpan({ cls: "reel-refresh-icon", text: "\u27F3" });
    refresh.createSpan({ text: "Refresh" });
    const feedEl = root.createDiv({ cls: "reel-feed" });
    for (const [title, reason] of [
      ["Because you liked Sinners", "Age limit does not apply to this row"],
      ["Science fiction from the nineties", ""]
    ]) {
      const section = feedEl.createDiv({ cls: "reel-drow" });
      const h = section.createDiv({ cls: "reel-drow-head" });
      h.createDiv({ cls: "reel-drow-title", text: title });
      if (reason)
        h.createDiv({ cls: "reel-drow-reason", text: reason });
      const strip = section.createDiv({ cls: "reel-drow-strip" });
      for (const e of all.slice(0, 10)) {
        const card = strip.createDiv({ cls: "reel-dcard" });
        plugin.posters.attach(card.createDiv({ cls: "reel-dcard-poster" }), e);
        card.createDiv({ cls: "reel-dcard-title", text: e.title });
      }
      strip.createDiv({ cls: "reel-drow-tail" });
    }
    const end = root.createDiv({ cls: "reel-feed-end" });
    end.createDiv({ cls: "reel-loading", text: "Loading more\u2026" });
  }
  function filterSheet(root) {
    const modal = root.createDiv({ cls: "reel-modal reel-filter-sheet reel-sheet" });
    const head = modal.createDiv({ cls: "reel-filter-head" });
    head.createEl("h3", { cls: "reel-log-title", text: "Filters" });
    head.createEl("button", { cls: "reel-btn reel-filter-clear", text: "Clear all" });
    const body = modal.createDiv({ cls: "reel-filter-body" });
    const section = (label, values, activeAt = -1) => {
      const box = body.createDiv({ cls: "reel-filter-section" });
      box.createDiv({ cls: "reel-filter-label", text: label });
      const chips = box.createDiv({ cls: "reel-chips reel-filter-chips" });
      values.forEach((v, i) => {
        const b = chips.createEl("button", { cls: "reel-chip", text: v });
        if (i === activeAt)
          b.addClass("is-active");
      });
    };
    section("Type", ["Everything", "Films", "Series"], 1);
    section("Status", ["watched", "watchlist", "watching", "completed", "paused", "abandoned"]);
    section(
      "Genre",
      [
        "Action",
        "Adventure",
        "Animation",
        "Comedy",
        "Crime",
        "Documentary",
        "Drama",
        "Family",
        "Fantasy",
        "History",
        "Horror",
        "Music",
        "Mystery",
        "Romance",
        "Science Fiction",
        "Thriller",
        "War",
        "Western"
      ],
      14
    );
    section("Lists", ["Christmas with the family", "Rewatch pile", "Letterboxd top 250"]);
    const sortBox = body.createDiv({ cls: "reel-filter-section" });
    sortBox.createDiv({ cls: "reel-filter-label", text: "Sort" });
    const sel = sortBox.createEl("select", { cls: "reel-select dropdown" });
    sel.createEl("option", { text: "Recently watched" });
    sortBox.createDiv({ cls: "reel-filter-label", text: "Then by" });
    const sel2 = sortBox.createEl("select", { cls: "reel-select dropdown" });
    sel2.createEl("option", { text: "My rating" });
  }
  function reviews(root) {
    root.addClass("reel-view-body");
    root.addClass("reel-detail");
    reviewPane(root, true);
    const empty = root.createDiv({ cls: "reel-yours" });
    empty.createDiv({ cls: "reel-yours-label", text: "Your review" });
    const box = empty.createDiv({ cls: "reel-yours-empty" });
    box.createDiv({ cls: "reel-dim", text: "You have not written about this one yet." });
    const write = box.createEl("button", { cls: "reel-btn" });
    write.createSpan({ text: "\u270E" });
    write.createSpan({ text: "Write a review" });
    const diary = root.createDiv({ cls: "reel-diary" });
    for (const e of all.slice(0, 3)) {
      const row = diary.createDiv({ cls: "reel-diary-row" });
      row.createDiv({ cls: "reel-diary-day", text: "4" });
      plugin.posters.attach(row.createDiv({ cls: "reel-diary-thumb" }), e);
      const body = row.createDiv({ cls: "reel-diary-body" });
      body.createDiv({ cls: "reel-diary-title", text: e.title });
      const meta = body.createDiv({ cls: "reel-diary-meta" });
      meta.createSpan({ cls: "reel-dim", text: "4 Aug 2026" });
      const pane = body.createDiv({ cls: "reel-yours" });
      const item = pane.createDiv({ cls: "reel-yours-item" });
      item.createDiv({
        cls: "reel-yours-body",
        text: "Held up far better than I expected. The middle hour drags, and then the last twenty minutes earn every bit of it back \u2014 I have not stopped thinking about the final shot."
      });
    }
  }
  function heroBand(into, opts) {
    const band = into.createDiv({ cls: "reel-hero-band has-backdrop" });
    if (opts.compact)
      band.addClass("is-compact");
    if (opts.art)
      band.addClass("has-art");
    const wrap = band.createDiv({ cls: "reel-hero-art" });
    wrap.createDiv({ cls: "reel-hero-art-base" }).setCssProps({ "--reel-backdrop": `url("${poster(all[0].title)}")` });
    if (opts.art) {
      wrap.createEl("img", { cls: "reel-hero-art-img", attr: { src: poster(all[0].title), alt: "" } });
    }
    const body = band.createDiv({ cls: "reel-hero-band-body" });
    body.createDiv({ cls: "reel-hero-band-label", text: opts.label });
    body.createDiv({ cls: "reel-hero-band-title", text: opts.title });
    if (opts.sub)
      body.createDiv({ cls: "reel-hero-band-sub", text: opts.sub });
    return band;
  }
  function dense(root) {
    root.addClass("reel-view-body");
    const wrap = root.createDiv({ cls: "reel-gridwrap is-dense" });
    renderPosterGrid(plugin, wrap, [...all, ...all, ...all]);
  }
  function searching(root) {
    root.addClass("is-searching");
    const header = root.createDiv({ cls: "reel-view-header is-open" });
    const navBtn = header.createEl("button", { cls: "reel-nav-btn" });
    navBtn.createSpan({ cls: "reel-nav-icon", text: "\u25A3" });
    navBtn.createSpan({ cls: "reel-nav-label", text: "Library" });
    navBtn.createSpan({ cls: "reel-nav-chevron", text: "\u25BE" });
    const wrap = header.createDiv({ cls: "reel-search-wrap search-input-container" });
    wrap.createSpan({ cls: "reel-search-icon", text: "\u2315" });
    const input = wrap.createEl("input", {
      cls: "reel-input reel-search-input",
      attr: { type: "search", placeholder: "Search titles, people, characters, plots\u2026" }
    });
    input.value = "the dog";
    wrap.createEl("button", { cls: "reel-search-clear clickable-icon", text: "\xD7" });
    const filters = root.createDiv({ cls: "reel-view-filters" });
    filterBar(filters, ["\u201Cthe dog\u201D"]);
    const body = root.createDiv({ cls: "reel-view-body" });
    renderPosterGrid(plugin, body, all.slice(0, 6));
  }
  function seensheet(root) {
    const modal = root.createDiv({ cls: "reel-modal reel-seensheet reel-sheet has-accent" });
    modal.setCssProps({
      "--reel-accent-h": "18",
      "--reel-accent-s": "78%",
      "--reel-accent-l": document.body.classList.contains("theme-dark") ? "58%" : "40%"
    });
    const head = modal.createDiv({ cls: "reel-seen-head" });
    const art = head.createDiv({ cls: "reel-seen-poster" });
    art.createEl("img", { attr: { src: poster(all[0].title), alt: "" } });
    const who = head.createDiv({ cls: "reel-seen-who" });
    who.createDiv({
      cls: "reel-seen-title",
      text: "The Assassination of Jesse James by the Coward Robert Ford"
    });
    const meta = who.createDiv({ cls: "reel-seen-meta" });
    meta.createSpan({ text: "2007" });
    meta.createSpan({ cls: "reel-badge subtle", text: "Film" });
    meta.createSpan({ cls: "reel-dim", text: "\u2605 7.5" });
    who.createDiv({ cls: "reel-seen-note", text: "Adding as watched." });
    const starRow = modal.createDiv({ cls: "reel-rating-row big centred" });
    const stars2 = starRow.createDiv({ cls: "reel-stars" });
    for (let i = 1; i <= 5; i++) {
      const star = stars2.createDiv({ cls: `reel-star${i <= 4 ? " is-full" : ""}` });
      star.createSpan({ cls: "reel-star-bg", text: "\u2605" });
      star.createSpan({ cls: "reel-star-fg", text: "\u2605" });
    }
    modal.createDiv({ cls: "reel-seen-readout is-set", text: "4 \u2014 Great" });
    const actions = modal.createDiv({ cls: "reel-log-actions" });
    actions.createEl("button", { cls: "reel-btn mod-cta", text: "Add without rating" });
    actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
  }
  function whatsnew(root) {
    const modal = root.createDiv({ cls: "reel-modal reel-whatsnew reel-sheet" });
    const head = modal.createDiv({ cls: "reel-wn-head" });
    head.createDiv({ cls: "reel-wn-eyebrow", text: "Reel" });
    head.createDiv({ cls: "reel-wn-title", text: "What's new" });
    head.createDiv({
      cls: "reel-wn-headline",
      text: "Reel tells you what it changed, and Stats reads like a page rather than a pile of numbers."
    });
    const body = modal.createDiv({ cls: "reel-wn-body" });
    const releases = [
      [
        "0.8.8",
        "20 August 2026",
        "",
        [
          [
            "new",
            "This screen. After an update, Reel shows what changed since the version you were on.",
            "Reel updates through BRAT, which swaps the file out silently. Everything fixed here was something you reported, and there was no way to tell it had landed."
          ],
          ["better", "Stats headline numbers sit on their own cards with the unit beside them."]
        ]
      ],
      [
        "0.8.7",
        "20 August 2026",
        "The search box stops fighting Obsidian's floating + button.",
        [
          [
            "fixed",
            "The + button no longer sits on top of the search field.",
            "Reel was looking for a full-width toolbar and a round corner button never matched."
          ],
          ["fixed", "The magnifier no longer prints over the first characters you type."]
        ]
      ],
      [
        "0.8.6",
        "20 August 2026",
        "The search field docks above the keyboard and stays there.",
        [["better", "While searching, the field sits just above the keyboard."]]
      ]
    ];
    for (const [version, date, summary, changes] of releases) {
      const sec = body.createDiv({ cls: "reel-wn-release" });
      const bar = sec.createDiv({ cls: "reel-wn-relhead" });
      bar.createSpan({ cls: "reel-wn-version", text: version });
      bar.createSpan({ cls: "reel-wn-date", text: date });
      if (summary)
        sec.createDiv({ cls: "reel-wn-relsummary", text: summary });
      const list = sec.createDiv({ cls: "reel-wn-list" });
      for (const [kind, what, note] of changes) {
        const row = list.createDiv({ cls: `reel-wn-item is-${kind}` });
        row.createSpan({ cls: "reel-wn-kind", text: kind === "new" ? "New" : kind === "better" ? "Better" : "Fixed" });
        const text = row.createDiv({ cls: "reel-wn-text" });
        text.createDiv({ cls: "reel-wn-what", text: what });
        if (note)
          text.createDiv({ cls: "reel-wn-note", text: note });
      }
    }
    const actions = modal.createDiv({ cls: "reel-log-actions reel-wn-actions" });
    actions.createEl("button", { cls: "reel-btn mod-cta", text: "Got it" });
  }
  function passphrase(root) {
    const modal = root.createDiv({ cls: "reel-modal reel-sheet reel-prompt" });
    modal.createEl("h3", { cls: "reel-prompt-title", text: "Unlock your API keys" });
    modal.createEl("p", {
      cls: "reel-prompt-body",
      text: "Reel encrypts your TMDB and OMDb keys. Enter the passphrase you set to use them this session."
    });
    for (const ph of ["Passphrase", "Confirm passphrase"]) {
      modal.createEl("input", {
        cls: "reel-input",
        attr: { type: "password", placeholder: ph, autocomplete: "off" }
      });
    }
    const actions = modal.createDiv({ cls: "reel-prompt-actions" });
    actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
    actions.createEl("button", { cls: "reel-btn mod-cta", text: "Unlock" });
  }
  function rows(root) {
    root.addClass("reel-view-body");
    renderRowList(plugin, root, all.slice(0, 8));
  }
  function tintWorstCase(el) {
    const dark = document.body.classList.contains("theme-dark");
    el.setCssProps({
      // Yellow-green, which `usableAccent` singles out as the hue that reads
      // lightest at a given L and therefore needs the most help.
      "--reel-accent-h": "84",
      "--reel-accent-s": "85%",
      "--reel-accent-l": dark ? "55%" : "42%"
    });
  }
  function stats(root) {
    root.addClass("reel-view-body");
    tintWorstCase(root);
    paintStats(plugin, root, { include: "all" });
  }
  function statsYear(root) {
    root.addClass("reel-view-body");
    tintWorstCase(root);
    withPool(YEAR, () => paintStats(plugin, root, { include: "all" }));
  }
  function upnext(root) {
    root.addClass("reel-view-body");
    heroBand(root, { label: "Tonight", title: "6 on the go", sub: "Severance \u2014 up to S2E4", art: true, compact: true });
    paintUpNext(plugin, root, void 0, true);
  }
  function empties(root) {
    root.addClass("reel-view-body");
    renderEmpty(root, {
      icon: "tv",
      title: "No series yet",
      body: "Add a series and this becomes the screen you open every night \u2014 one row per show, one tap to tick the next episode.",
      actions: [{ label: "Find a series", primary: true, onClick: () => {
      } }]
    });
    root.createDiv({ cls: "reel-block-title", text: "Loading states" });
    skeletonCards(root, 6);
    skeletonGrid(root, 8);
  }
  function stars(root) {
    root.addClass("reel-view-body");
    root.createDiv({ cls: "reel-block-title", text: "Rating controls" });
    for (const v of [void 0, 2.5, 5]) {
      const box = root.createDiv({ cls: "reel-control" });
      box.createDiv({ cls: "reel-field-label", text: v == null ? "Unrated" : `${v} stars` });
      renderStars(box.createDiv({ cls: "reel-rating-row" }), { value: v });
    }
    const compact = root.createDiv({ cls: "reel-control" });
    compact.createDiv({ cls: "reel-field-label", text: "Compact (episode rows)" });
    renderStars(compact.createDiv({ cls: "reel-rating-row" }), { value: 4, compact: true });
  }
  function mountSheet(root, sheet) {
    const shell = root.createDiv({ cls: "reel-modal-shell" });
    sheet.modalEl = shell;
    shell.addClass("reel-modal");
    if (phone2)
      shell.addClass("reel-sheet");
    shell.appendChild(sheet.contentEl);
    try {
      sheet.onOpen();
    } catch (e) {
      sheet.contentEl.createEl("pre", { text: `sheet failed: ${String(e)}` });
    }
  }
  function detail(root) {
    root.addClass("reel-view-body");
    const screen = new DetailScreen(plugin, SHOW, () => {
    }, "Library");
    screen.render(root);
  }
  function longshow(root) {
    root.addClass("reel-view-body");
    new DetailScreen(plugin, LONG_SHOW, () => {
    }, "Library").render(root);
  }
  function detailFilm(root) {
    root.addClass("reel-view-body");
    const screen = new DetailScreen(plugin, LIBRARY[0], () => {
    }, "Library");
    screen.render(root);
  }
  function quick(root) {
    root.addClass("reel-view-body");
    const screen = new DiscoverScreen(plugin);
    plugin.discover.takeStaged = () => all.slice(0, 6);
    screen.render(root);
  }
  function discover(root) {
    root.addClass("reel-view-body");
    const screen = new DiscoverScreen(plugin);
    screen.render(root);
  }
  function recipe(root) {
    root.addClass("reel-view-body");
    mountSheet(root, new RecipeSheet(plugin));
  }
  function quickrate(root) {
    root.addClass("reel-view-body");
    mountSheet(root, new QuickRate(plugin, LIBRARY[0], {}));
  }
  function logsheet(root) {
    root.addClass("reel-view-body");
    mountSheet(root, new LogSheet(plugin.app, plugin, { entry: LIBRARY[0], file: {} }));
  }
  var SCREENS = {
    library,
    dense,
    searching,
    seensheet,
    whatsnew,
    passphrase,
    feed,
    filterSheet,
    reviews,
    rows,
    stats,
    statsYear,
    upnext,
    empties,
    stars,
    detail,
    detailFilm,
    discover,
    recipe,
    quickrate,
    logsheet,
    longshow,
    quick
  };
  var params2 = new URLSearchParams(location.search);
  var wanted = params2.get("screen") ?? "library";
  var phone2 = params2.get("phone") !== "0";
  var keyboard = params2.get("keyboard") === "1";
  var paneWidth = Number(params2.get("pane") ?? "") || 0;
  var chromeTop = Number(params2.get("chromeTop") ?? "") || 0;
  var chromeBottom = Number(params2.get("chromeBottom") ?? "") || 0;
  if (chromeTop || chromeBottom) {
    document.body.setCssProps({
      "--harness-chrome-top": `${chromeTop || 48}px`,
      "--harness-chrome-bottom": `${chromeBottom || 48}px`
    });
  }
  if (paneWidth > 0) {
    document.body.setCssProps({ "--reel-harness-pane": `${paneWidth}px` });
    document.body.addClass("reel-harness-narrow-pane");
  }
  document.body.classList.toggle("theme-dark", params2.get("dark") === "1");
  document.body.classList.toggle("theme-light", params2.get("dark") !== "1");
  function mountObsidianChrome(app2) {
    if (!phone2)
      return;
    app2.createDiv({ cls: "view-header obsidian-chrome-decoy" });
    const header = app2.createDiv({ cls: "view-header obsidian-chrome" });
    header.createDiv({ cls: "view-header-title", text: "Reel" });
    header.createEl("button", { cls: "clickable-icon", text: "\u2630", attr: { "aria-label": "Menu" } });
    app2.createDiv({ cls: "harness-unnamed-nav obsidian-chrome" }).createEl("button", {
      cls: "clickable-icon",
      text: "\uFF0B",
      attr: { "aria-label": "New" }
    });
    app2.createDiv({ cls: "harness-unnamed-fab obsidian-chrome" }).createEl("button", {
      cls: "clickable-icon",
      text: "\uFF0B",
      attr: { "aria-label": "New note" }
    });
  }
  function mount(app2, name) {
    const view = app2.createDiv({ cls: "view-content reel-view" });
    view.toggleClass("is-phone", phone2);
    view.toggleClass("is-mobile", phone2);
    stampWidth(view, measure(view) || window.innerWidth);
    const FULL_VIEW = /* @__PURE__ */ new Set(["library", "searching"]);
    const target = FULL_VIEW.has(name) ? view : view.createDiv({ cls: "reel-view-body" });
    try {
      (SCREENS[name] ?? library)(target);
    } catch (e) {
      target.createEl("pre", { text: `render failed: ${String(e)}
${e?.stack ?? ""}` });
    }
    stampWidth(view, measure(view) || window.innerWidth);
    stampChromeInsets(view);
    const realBody = view.querySelector(":scope > .reel-view-body");
    if (realBody)
      sizeBody(view, realBody);
    return view;
  }
  sheetFit();
  var app = document.getElementById("app");
  if (app)
    mountObsidianChrome(app);
  if (app && params2.get("audit") != null) {
    const MODAL_SCREENS = /* @__PURE__ */ new Set(["recipe", "logsheet", "quickrate", "filterSheet", "seensheet", "whatsnew", "passphrase"]);
    const skipped = [];
    const results = [];
    for (const name of Object.keys(SCREENS)) {
      if (paneWidth > 0 && MODAL_SCREENS.has(name)) {
        skipped.push(name);
        continue;
      }
      const view = mount(app, name);
      results.push({ screen: name, checks: auditScreen(view, { phone: phone2, keyboard }) });
      view.remove();
    }
    const failures = results.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => ({ ...c, screen: r.screen })));
    const total = results.reduce((n2, r) => n2 + r.checks.length, 0);
    document.title = failures.length ? `FAIL ${failures.length}/${total}` : `PASS ${total}`;
    const report = app.createDiv({ cls: "reel-audit" });
    report.createEl("h2", { text: document.title });
    if (!failures.length) {
      report.createEl("p", { text: `${Object.keys(SCREENS).length} screens, nothing to report.` });
    }
    for (const f of failures) {
      const row = report.createDiv({ cls: "reel-audit-row" });
      row.createEl("strong", { text: `${f.screen} \xB7 ${f.name}` });
      if (f.detail)
        row.createEl("code", { text: f.detail });
    }
    window.REEL_AUDIT = { total, failures, skipped };
  } else if (app) {
    mount(app, wanted);
  }
  document.body.dataset.reelReady = "1";
})();
