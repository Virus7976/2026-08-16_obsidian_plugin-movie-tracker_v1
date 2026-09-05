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
  var BaseComponent = class {
    constructor() {
      this.disabled = false;
    }
    setDisabled(on) {
      this.disabled = on;
      return this;
    }
    then(cb) {
      cb(this);
      return this;
    }
  };
  var TextComponent = class extends BaseComponent {
    constructor(parent, textarea = false) {
      super();
      this.inputEl = document.createElement(textarea ? "textarea" : "input");
      if (!textarea)
        this.inputEl.type = "text";
      parent.appendChild(this.inputEl);
    }
    setPlaceholder(v) {
      this.inputEl.placeholder = v;
      return this;
    }
    setValue(v) {
      this.inputEl.value = v;
      return this;
    }
    getValue() {
      return this.inputEl.value;
    }
    onChange(cb) {
      this.inputEl.addEventListener("input", () => cb(this.inputEl.value));
      return this;
    }
    setDisabled(on) {
      this.inputEl.disabled = on;
      return super.setDisabled(on);
    }
  };
  var ToggleComponent = class extends BaseComponent {
    constructor(parent) {
      super();
      this.on = false;
      this.handler = null;
      this.toggleEl = document.createElement("div");
      this.toggleEl.className = "checkbox-container";
      this.toggleEl.setAttribute("role", "checkbox");
      this.toggleEl.setAttribute("tabindex", "0");
      this.toggleEl.addEventListener("click", () => this.setValue(!this.on));
      parent.appendChild(this.toggleEl);
    }
    setValue(v) {
      this.on = v;
      this.toggleEl.classList.toggle("is-enabled", v);
      this.toggleEl.setAttribute("aria-checked", v ? "true" : "false");
      this.handler?.(v);
      return this;
    }
    getValue() {
      return this.on;
    }
    onChange(cb) {
      this.handler = cb;
      return this;
    }
  };
  var ButtonComponent = class extends BaseComponent {
    constructor(parent) {
      super();
      this.buttonEl = document.createElement("button");
      parent.appendChild(this.buttonEl);
    }
    setButtonText(v) {
      this.buttonEl.textContent = v;
      return this;
    }
    setIcon() {
      return this;
    }
    setTooltip(v) {
      this.buttonEl.setAttribute("aria-label", v);
      return this;
    }
    setCta() {
      this.buttonEl.classList.add("mod-cta");
      return this;
    }
    setWarning() {
      this.buttonEl.classList.add("mod-warning");
      return this;
    }
    setDisabled(on) {
      this.buttonEl.disabled = on;
      return super.setDisabled(on);
    }
    onClick(cb) {
      this.buttonEl.addEventListener("click", cb);
      return this;
    }
  };
  var DropdownComponent = class extends BaseComponent {
    constructor(parent) {
      super();
      this.selectEl = document.createElement("select");
      this.selectEl.className = "dropdown";
      parent.appendChild(this.selectEl);
    }
    addOption(value, label) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      this.selectEl.appendChild(o);
      return this;
    }
    // The plural form, used once, for poster quality. Missing it aborted the
    // whole render mid-screen — and the audit dutifully reported the four
    // faults it had found before the exception, as though that were the lot.
    addOptions(map) {
      for (const [value, label] of Object.entries(map))
        this.addOption(value, label);
      return this;
    }
    setValue(v) {
      this.selectEl.value = v;
      return this;
    }
    getValue() {
      return this.selectEl.value;
    }
    onChange(cb) {
      this.selectEl.addEventListener("change", () => cb(this.selectEl.value));
      return this;
    }
  };
  var SliderComponent = class extends BaseComponent {
    constructor(parent) {
      super();
      this.sliderEl = document.createElement("input");
      this.sliderEl.type = "range";
      this.sliderEl.className = "slider";
      parent.appendChild(this.sliderEl);
    }
    setLimits(min, max, step) {
      this.sliderEl.min = String(min);
      this.sliderEl.max = String(max);
      this.sliderEl.step = String(step);
      return this;
    }
    setValue(v) {
      this.sliderEl.value = String(v);
      return this;
    }
    getValue() {
      return Number(this.sliderEl.value);
    }
    setDynamicTooltip() {
      return this;
    }
    onChange(cb) {
      this.sliderEl.addEventListener("input", () => cb(Number(this.sliderEl.value)));
      return this;
    }
  };
  var PluginSettingTab = class {
    constructor(app2, plugin2) {
      this.app = app2;
      this.plugin = plugin2;
      this.containerEl = document.createElement("div");
    }
    display() {
    }
    hide() {
    }
  };
  var Setting = class {
    constructor(parent) {
      this.settingEl = document.createElement("div");
      this.settingEl.className = "setting-item";
      this.infoEl = document.createElement("div");
      this.infoEl.className = "setting-item-info";
      this.nameEl = document.createElement("div");
      this.nameEl.className = "setting-item-name";
      this.descEl = document.createElement("div");
      this.descEl.className = "setting-item-description";
      this.infoEl.appendChild(this.nameEl);
      this.infoEl.appendChild(this.descEl);
      this.controlEl = document.createElement("div");
      this.controlEl.className = "setting-item-control";
      this.settingEl.appendChild(this.infoEl);
      this.settingEl.appendChild(this.controlEl);
      parent.appendChild(this.settingEl);
    }
    setName(v) {
      this.nameEl.textContent = v;
      return this;
    }
    setDesc(v) {
      this.descEl.textContent = v;
      return this;
    }
    setClass(c) {
      this.settingEl.classList.add(c);
      return this;
    }
    setHeading() {
      this.settingEl.classList.add("setting-item-heading");
      return this;
    }
    setDisabled(on) {
      this.settingEl.classList.toggle("is-disabled", on);
      return this;
    }
    addText(cb) {
      cb(new TextComponent(this.controlEl));
      return this;
    }
    addTextArea(cb) {
      cb(new TextComponent(this.controlEl, true));
      return this;
    }
    addToggle(cb) {
      cb(new ToggleComponent(this.controlEl));
      return this;
    }
    addButton(cb) {
      cb(new ButtonComponent(this.controlEl));
      return this;
    }
    addExtraButton(cb) {
      cb(new ButtonComponent(this.controlEl));
      return this;
    }
    addDropdown(cb) {
      cb(new DropdownComponent(this.controlEl));
      return this;
    }
    addSlider(cb) {
      cb(new SliderComponent(this.controlEl));
      return this;
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
    /*
     * An air date three days out, computed rather than written down.
     *
     * The upcoming rows need a series with something due, and a fixed date
     * would put this fixture in the past within the week — after which
     * `paintUpcoming` renders nothing, the screen quietly stops being covered,
     * and the audit keeps reporting the same number of passing checks. Coverage
     * that expires without saying so is worse than coverage that was never
     * there, because the count still looks right.
     *
     * This is also deliberately the longest title in the fixtures: the calendar
     * builds its own version of the Up Next row, and a long name is exactly
     * what was being cut mid-word there.
     */
    nextAirDate: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
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
        const unrated = r > 0.84;
        const rating = unrated ? void 0 : r > 0.75 ? 3 : r > 0.4 ? 3.5 : r > 0.15 ? 4 : r > 0.04 ? 4.5 : 5;
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
      const reaction = (on, iconOn, iconOff, label, toggle2) => {
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
            const actual = await toggle2();
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
  var CONTENT_FLAGS = ["sex", "nudity", "profanity", "violence", "gore", "drugs", "horror"];
  var FLAG_LABELS = {
    sex: "Sex",
    nudity: "Nudity",
    profanity: "Swearing",
    violence: "Violence",
    gore: "Gore",
    drugs: "Drugs",
    horror: "Horror"
  };
  var CERT_RANK = {
    G: 0,
    "TV-Y": 0,
    "TV-Y7": 0,
    "TV-G": 0,
    PG: 1,
    "TV-PG": 1,
    "PG-13": 2,
    "TV-14": 2,
    R: 3,
    "TV-MA": 4,
    "NC-17": 5,
    X: 5
  };
  function knownCertifications() {
    return Object.keys(CERT_RANK);
  }

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
    const run2 = (job) => void job.catch((e) => new Notice(`Reel: ${redact(e)}`));
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
      (i) => i.setTitle(entry.liked ? "Unlike" : "Like").setIcon("heart").onClick(() => run2(plugin2.notes.toggleLiked(file).then((on) => plugin2.undo.offer(on ? "Liked" : "Unliked"))))
    );
    if (entry.status === "watchlist") {
      menu.addItem(
        (i) => i.setTitle("Mark watched").setIcon("check").onClick(
          () => run2(
            plugin2.notes.setStatus(file, entry.type === "tv" ? "watching" : "watched").then(() => plugin2.undo.offer(`${entry.title} marked watched`))
          )
        )
      );
    } else {
      menu.addItem(
        (i) => i.setTitle("Move to watchlist").setIcon("bookmark").onClick(
          () => run2(
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
    const year2 = entry.year ?? entry.firstAirYear;
    if (year2)
      bits.push(String(year2));
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
    const list2 = el.createDiv({ cls: "reel-list" });
    for (const entry of rows2) {
      const row = list2.createDiv({ cls: "reel-row" });
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
  function viewings(entries, year2) {
    const out = [];
    for (const entry of entries) {
      for (const w of entry.watched) {
        if (!w.date)
          continue;
        if (year2 && !w.date.startsWith(String(year2)))
          continue;
        out.push({ entry, date: w.date, rating: w.rating ?? void 0, rewatch: w.rewatch === true });
      }
      if (entry.type === "tv" && entry.lastWatched?.date) {
        const date = entry.lastWatched.date;
        if (!year2 || date.startsWith(String(year2))) {
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
      const list2 = contentEl.createDiv({ cls: "reel-titles-list" });
      for (const entry of this.entries) {
        const row = list2.createDiv({ cls: "reel-titles-row" });
        const poster2 = row.createDiv({ cls: "reel-titles-poster" });
        this.plugin.posters.attach(poster2, entry);
        const body = row.createDiv({ cls: "reel-titles-body" });
        body.createDiv({ cls: "reel-titles-name", text: entry.title });
        const meta = body.createDiv({ cls: "reel-titles-meta" });
        const year2 = entry.year ?? entry.firstAirYear;
        if (year2)
          meta.createSpan({ cls: "reel-dim", text: String(year2) });
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
      const bar = el.createDiv({ cls: "reel-chips reel-year-chips" });
      const artFor = (year2) => {
        const pool2 = year2 == null ? allViewings : allViewings.filter((v) => v.date.startsWith(String(year2)));
        const pick = pool2.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
        return pick ? plugin2.posters.washUrl(pick.entry) : null;
      };
      const chip = (label, active, year2) => {
        const b = bar.createEl("button", { cls: "reel-chip" });
        const art = artFor(year2);
        if (art) {
          b.addClass("has-wash");
          b.createDiv({ cls: "reel-chip-wash" }).setCssProps({ "--reel-wash": `url("${art}")` });
        }
        b.createSpan({ cls: "reel-chip-text", text: label });
        setSelected(b, active);
        b.addEventListener("click", () => paintStats(plugin2, el, { ...opts, year: year2 }));
      };
      chip("All time", opts.year == null, void 0);
      for (const y of years)
        chip(y, opts.year === Number(y), Number(y));
    }
    const filmMinutes = watched.reduce((n2, v) => n2 + (v.entry.runtime ?? 0), 0);
    const episodesSeen2 = shows.reduce((n2, s) => n2 + s.seasons.reduce((m, x) => m + rangeCount(x.watched), 0), 0);
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
    const query = opts.query?.trim();
    if (query && all2.length) {
      const found = el.createDiv({ cls: "reel-chart reel-found" });
      const foundHead = found.createDiv({ cls: "reel-found-head" });
      foundHead.createDiv({ cls: "reel-chart-title", text: `Matching \u201C${query}\u201D` });
      foundHead.createDiv({
        cls: "reel-found-count",
        text: `${all2.length} ${all2.length === 1 ? "title" : "titles"}`
      });
      const strip = found.createDiv({ cls: "reel-found-strip" });
      const CAP = 12;
      for (const e of all2.slice(0, CAP)) {
        const cell = strip.createDiv({ cls: "reel-found-cell" });
        const art = cell.createDiv({ cls: "reel-found-art" });
        plugin2.posters.attach(art, e);
        cell.createDiv({ cls: "reel-found-title", text: e.title });
        if (e.year)
          cell.createDiv({ cls: "reel-found-year", text: String(e.year) });
        cell.setAttr("role", "button");
        cell.setAttr("tabindex", "0");
        cell.setAttr("aria-label", e.title);
        const open = () => void plugin2.openDetail(e);
        cell.addEventListener("click", open);
        cell.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ")
            return;
          ev.preventDefault();
          open();
        });
      }
      if (all2.length > CAP) {
        found.createDiv({
          cls: "reel-found-more",
          text: `and ${all2.length - CAP} more \u2014 the numbers below count all ${all2.length}.`
        });
      }
    }
    const tiles = el.createDiv({ cls: "reel-tiles" });
    let first = true;
    const tile = (label, value, sub, go, art) => {
      const t = tiles.createDiv({ cls: "reel-tile" });
      if (first) {
        t.addClass("is-lead");
        first = false;
      }
      const wash = art ? plugin2.posters.washUrl(art) : null;
      if (wash) {
        t.addClass("has-wash");
        t.createDiv({ cls: "reel-tile-wash" }).setCssProps({ "--reel-wash": `url("${wash}")` });
        t.setAttr("title", `${label} \u2014 ${art?.title ?? ""}`.trim());
      }
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
        show("Films watched", [...new Set(watched.map((v) => v.entry))]),
        // The most recent one: this count is a record of watching, and the
        // last thing you watched is what it most recently recorded.
        [...watched].sort((a, b) => b.date.localeCompare(a.date))[0]?.entry
      );
      tile(
        "Hours of film",
        formatMinutes(filmMinutes),
        void 0,
        void 0,
        // The longest, which is the single biggest contributor to the total.
        [...new Set(watched.map((v) => v.entry))].sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0))[0]
      );
    }
    if (shows.length) {
      tile(
        "Episodes",
        String(episodesSeen2),
        `${shows.length} show${shows.length === 1 ? "" : "s"}`,
        show("Series you're watching", shows),
        // The first show, which is the one the episode count leads with.
        shows[0]
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
    const queued = all2.filter((e) => e.status === "watchlist");
    if (queued.length) {
      const queuedFilms = queued.filter((e) => e.type === "film").length;
      const queuedShows = queued.length - queuedFilms;
      const rate2 = perMonth ? watched.length / perMonth : 0;
      const split = [
        queuedFilms ? `${queuedFilms} film${queuedFilms === 1 ? "" : "s"}` : "",
        queuedShows ? `${queuedShows} series` : ""
      ].filter(Boolean).join(", ");
      const pace = rate2 > 0 ? `${Math.ceil(queued.length / rate2)} months at this pace` : "";
      const sub = [split, pace].filter(Boolean).join(" \xB7 ") || void 0;
      tile("On the watchlist", String(queued.length), sub, show("On the watchlist", queued));
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
        if (f.entry) {
          const thumb = row.createDiv({ cls: "reel-fact-thumb" });
          plugin2.posters.attach(thumb, f.entry);
        }
        const text = row.createDiv({ cls: "reel-fact-text" });
        text.createDiv({ cls: "reel-fact-label", text: f.label });
        text.createDiv({ cls: "reel-fact-value", text: f.value });
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
      const filmsByYear = /* @__PURE__ */ new Map();
      for (const v of watched) {
        const y = v.date.slice(0, 4);
        byYear.set(y, (byYear.get(y) ?? 0) + 1);
        const seen2 = filmsByYear.get(y) ?? [];
        if (!seen2.includes(v.entry))
          seen2.push(v.entry);
        filmsByYear.set(y, seen2);
      }
      bars(
        charts,
        "Films per year",
        [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, n2]) => ({
          label,
          n: n2,
          entries: filmsByYear.get(label),
          go: () => paintStats(plugin2, el, { ...opts, year: Number(label) })
        })),
        "",
        plugin2
      );
    }
    const trimEmpty = (rows2) => {
      let first2 = 0;
      let last = rows2.length - 1;
      while (first2 <= last && rows2[first2].n === 0)
        first2++;
      while (last >= first2 && rows2[last].n === 0)
        last--;
      return rows2.slice(first2, last + 1);
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
    const toggle2 = box.createDiv({ cls: "reel-fold-toggle" });
    toggle2.setAttr("role", "button");
    toggle2.setAttr("tabindex", "0");
    toggle2.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggle2.click();
      }
    });
    const heading = toggle2.createDiv({ cls: "reel-fold-heading" });
    heading.createDiv({ cls: "reel-chart-title", text: title });
    const preview2 = data.slice(0, 3).map((d) => d.label).join(" \xB7 ");
    if (preview2)
      heading.createDiv({ cls: "reel-fold-preview", text: preview2 });
    if (plugin2) {
      const faces2 = data.slice(0, 3).filter((d) => !d.noPosters);
      const shots = faces2.map((d) => d.entries?.[0]).filter((e) => Boolean(e));
      if (shots.length) {
        const strip = heading.createDiv({ cls: "reel-fold-shots" });
        for (const e of shots) {
          const thumb = strip.createDiv({ cls: "reel-fold-shot" });
          plugin2.posters.attach(thumb, e);
        }
      }
    }
    toggle2.createDiv({ cls: "reel-fold-count", text: `${data.length}` });
    const body = box.createDiv({ cls: "reel-chart-body" });
    const setOpen = (open) => {
      box.toggleClass("is-open", open);
      toggle2.setAttr("aria-expanded", String(open));
    };
    const view = el.closest(".reel-view");
    const roomy = !!view && view.classList.contains("is-w700") && !view.classList.contains("is-phone");
    setOpen(roomy);
    toggle2.addEventListener("click", () => setOpen(!box.hasClass("is-open")));
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
        const fill = track.createDiv({ cls: "reel-chart-fill" });
        fill.setCssProps({ "--reel-fill": String(d.n / max) });
        const art = plugin2 && d.entries?.length ? plugin2.posters.washUrl(d.entries[0]) : null;
        if (art) {
          fill.addClass("has-wash");
          fill.setCssProps({ "--reel-wash": `url("${art}")` });
        }
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
        const list2 = held.get(value) ?? [];
        list2.push(e);
        held.set(value, list2);
      }
    }
    for (const list2 of held.values())
      list2.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const top = [...held.entries()].filter(([, list2]) => list2.length >= floor).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, limit).map(([label, list2]) => ({
      label,
      n: list2.length,
      entries: list2,
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
        const list2 = held.get(key) ?? [];
        list2.push(e);
        held.set(key, list2);
      }
    }
    for (const list2 of held.values())
      list2.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
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
      const list2 = perDay.get(v.date);
      if (list2)
        list2.push(v.entry);
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
  function paintWash(host, url) {
    if (!url)
      return;
    host.addClass("has-wash");
    const wash = host.createDiv({ cls: "reel-sheet-wash" });
    wash.createDiv({ cls: "reel-sheet-wash-art" }).setCssProps({ "--reel-wash": `url("${url}")` });
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

  // src/util/status.ts
  var FROZEN_STATUSES = /* @__PURE__ */ new Set(["dropped", "paused", "watchlist"]);
  function hasBeenWatched(e) {
    if (e.seen === true)
      return true;
    if (e.status === "watched" || e.status === "completed")
      return true;
    if ((e.watched?.length ?? 0) > 0)
      return true;
    return episodesSeen(e) > 0;
  }
  function hasBeenCompleted(e) {
    if (e.status === "completed")
      return true;
    if (e.type !== "tv")
      return false;
    const total = e.totalEpisodes ?? 0;
    if (!Number.isFinite(total) || total <= 0)
      return false;
    return episodesSeen(e) >= total;
  }
  function matchesStatus(e, status) {
    if (status === "watched")
      return hasBeenWatched(e);
    if (status === "completed")
      return hasBeenCompleted(e);
    return e.status === status;
  }
  function episodesSeen(e) {
    return (e.seasons ?? []).reduce((n2, s) => n2 + rangeCount(s.watched), 0);
  }
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
      paintWash(contentEl, this.plugin.posters.displayUrl(this.entry));
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
  function upnextTitle(body, text) {
    const title = body.createDiv({ cls: "reel-upnext-title" });
    title.createSpan({ cls: "reel-upnext-name", text });
    return title;
  }
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
      const list2 = el.createDiv({ cls: "reel-upnext" });
      if (hidden > 0) {
        const more = el.createDiv({ cls: "reel-block-count" });
        const btn = more.createEl("button", { cls: "reel-chip", text: `Show ${hidden} more` });
        btn.addEventListener("click", () => {
          for (const entry of everything.slice(cap))
            list2.appendChild(this.row(entry));
          more.remove();
        });
      }
      for (const entry of rows2)
        list2.appendChild(this.row(entry));
    }
    /** One row. Detached, so it can be appended lazily by 'show more'. */
    row(entry) {
      const next = this.plugin.upNext.nextFor(entry);
      const row = createDiv({ cls: "reel-upnext-row" });
      const thumb = row.createDiv({ cls: "reel-upnext-thumb" });
      this.plugin.posters.attach(thumb, entry);
      thumb.addEventListener("click", () => void this.plugin.openDetail(entry));
      const body = row.createDiv({ cls: "reel-upnext-body" });
      const title = upnextTitle(body, entry.title);
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

  // src/render/calendar.ts
  function paintUpcoming(plugin2, containerEl, withinDays, showEmpty = false) {
    new CalendarPainter(plugin2, containerEl, withinDays, showEmpty).render();
  }
  var CalendarPainter = class {
    constructor(plugin2, containerEl, withinDays, showEmpty = false) {
      this.plugin = plugin2;
      this.containerEl = containerEl;
      this.withinDays = withinDays;
      this.showEmpty = showEmpty;
    }
    render() {
      const el = this.containerEl;
      el.empty();
      const today = todayISO();
      const rows2 = this.plugin.visible(this.plugin.library.shows()).filter((e) => !!e.nextAirDate && e.status !== "dropped").filter((e) => {
        if (!this.withinDays)
          return true;
        const gap = daysBetween(today, e.nextAirDate);
        return Number.isFinite(gap) && gap <= this.withinDays;
      }).sort((a, b) => (a.nextAirDate ?? "").localeCompare(b.nextAirDate ?? ""));
      if (!rows2.length) {
        if (this.showEmpty) {
          el.createDiv({ cls: "reel-block-title", text: "Upcoming" });
          el.createDiv({ cls: "reel-empty", text: "Nothing scheduled. Only shows TMDB lists as returning appear here." });
        }
        return;
      }
      el.createDiv({ cls: "reel-block-title", text: "Upcoming" });
      const list2 = el.createDiv({ cls: "reel-upnext" });
      for (const entry of rows2)
        list2.appendChild(this.row(entry, today));
    }
    row(entry, today) {
      const row = createDiv({ cls: "reel-upnext-row" });
      const thumb = row.createDiv({ cls: "reel-upnext-thumb" });
      this.plugin.posters.attach(thumb, entry);
      const body = row.createDiv({ cls: "reel-upnext-body" });
      upnextTitle(body, entry.title);
      const gap = daysBetween(today, entry.nextAirDate);
      const meta = body.createDiv({ cls: "reel-upnext-meta" });
      const when = gap === 0 ? "Today" : gap === 1 ? "Tomorrow" : gap > 0 ? `In ${gap} days` : "Aired";
      meta.createSpan({ cls: "reel-upnext-ep", text: when });
      meta.createSpan({ cls: "reel-dim", text: prettyDate(entry.nextAirDate) });
      if (gap <= 0)
        body.createDiv({ cls: "reel-badge new", text: "Out now" });
      row.addEventListener("click", async () => {
        const file = this.plugin.app.vault.getAbstractFileByPath(entry.path);
        if (file instanceof TFile)
          await this.plugin.app.workspace.getLeaf(false).openFile(file);
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
      if (this.opts.entry)
        paintWash(contentEl, this.plugin.posters.displayUrl(this.opts.entry));
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
        const list2 = hist.createDiv({ cls: "reel-history" });
        for (const w of [...this.opts.entry.watched].reverse().slice(0, 5)) {
          const row = list2.createDiv({ cls: "reel-history-row" });
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
      const year2 = yearOf(isTv ? item.first_air_date : item.release_date);
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
      if (year2)
        line.createSpan({ cls: "reel-dim", text: ` ${year2}` });
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
    dtdd: "DoesTheDogDie",
    openrouter: "OpenRouter",
    trakt: "Trakt",
    traktApp: "Trakt app",
    mastodon: "Mastodon"
  };
  var READ_KEYS = ["tmdb", "omdb", "dtdd", "openrouter"];
  var WRITE_KEYS = ["trakt", "traktApp", "mastodon"];
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
      /** The last page of results fetched; the sentinel asks for the next. */
      this.searchPage = 0;
      /** What TMDB says it holds for this query. 0 until the first page lands. */
      this.searchPages = 0;
      /** Titles TMDB claims to have, so the count can stop overstating one page. */
      this.searchTotal = 0;
      /** A page is in flight, so the sentinel must not ask for it twice. */
      this.searchMore = false;
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
      this.searchPage = 0;
      this.searchPages = 0;
      this.searchMore = false;
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
      const year2 = yearOf(isTv ? item.first_air_date : item.release_date);
      if (year2)
        head.createSpan({ cls: "reel-dim", text: ` ${year2}` });
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
      if (!this.genres.length) {
        void this.plugin.tmdb.genreList(this.filters.type).then((list2) => {
          this.genres = list2;
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
        const year2 = Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4));
        if (!Number.isFinite(year2) || year2 < f.decade || year2 >= f.decade + 10)
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
        this.searchPage = 0;
        this.searchPages = 0;
        this.searchTotal = 0;
        this.searchMore = false;
      }
      if (!this.searchResults) {
        skeletonGrid(container, 12, "Searching");
        if (this.loading)
          return;
        this.loading = true;
        void this.plugin.tmdb.searchMultiPage(q, 1).then((res) => {
          const usable = res.results.filter((i) => !i.adult && i.poster_path);
          const fresh = this.plugin.discover.filterOut(usable);
          this.searchOwned = usable.length - fresh.length;
          this.searchResults = fresh;
          this.searchPage = res.page;
          this.searchPages = res.totalPages;
          this.searchTotal = res.totalResults;
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
      const more = this.searchTotal > items.length;
      count.setText(more ? `${items.length} of ${this.searchTotal} on TMDB for \u201C${q}\u201D` : `${items.length} on TMDB for \u201C${q}\u201D`);
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
      this.paintSearchSentinel(container, grid, count);
    }
    /**
     * Keep the search going as you scroll, instead of stopping at page one.
     *
     * The same sentinel-and-observer shape as the feed, and for the same reason:
     * an intersection is asked once and answered once, where a scroll handler on
     * a measured, fixed-height body fires at whatever rate the device likes.
     *
     * Cards are appended to the grid that is already on screen rather than the
     * screen being redrawn. A redraw would replace the scroller's children and
     * throw the reader back to the top — the one thing an infinite scroll must
     * never do.
     */
    paintSearchSentinel(container, grid, count) {
      if (this.searchPage >= this.searchPages)
        return;
      const sentinel = container.createDiv({ cls: "reel-feed-end" });
      sentinel.createDiv({ cls: "reel-loading", text: "Loading more\u2026" });
      const scroller = container.closest(".reel-view-body") ?? null;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting))
            return;
          void this.moreSearch(container, grid, sentinel, count);
        },
        { root: scroller, rootMargin: "600px 0px" }
      );
      io.observe(sentinel);
      this.watchers.push(io);
    }
    /**
     * One more page of search results, appended.
     *
     * A page can legitimately yield nothing to show — every title on it is
     * already in your library, or has no poster, or the page was mostly people.
     * Stopping there would end the search on a technicality while TMDB still
     * holds hundreds of matches, so it walks on to the next page, up to a few
     * per scroll so a run of empty pages cannot become an unbounded request
     * loop.
     */
    async moreSearch(container, grid, sentinel, count) {
      if (this.searchMore)
        return;
      this.searchMore = true;
      const q = this.searchedFor;
      try {
        for (let tries = 0; tries < 3 && this.searchPage < this.searchPages; tries++) {
          const res = await this.plugin.tmdb.searchMultiPage(q, this.searchPage + 1);
          if (this.searchedFor !== q || !this.searchResults)
            return;
          this.searchPage = res.page;
          if (res.totalPages)
            this.searchPages = res.totalPages;
          const usable = res.results.filter((i) => !i.adult && i.poster_path);
          const fresh = this.plugin.discover.filterOut(usable);
          this.searchOwned += usable.length - fresh.length;
          const seen = new Set(this.searchResults.map((i) => i.id));
          const added = fresh.filter((i) => !seen.has(i.id) && !this.handled.has(i.id));
          this.searchResults.push(...added);
          for (const item of added)
            grid.appendChild(this.card(item, container));
          if (added.length)
            break;
        }
        const shown2 = this.searchResults?.filter((i) => !this.handled.has(i.id)).length ?? 0;
        count.setText(
          this.searchTotal > shown2 ? `${shown2} of ${this.searchTotal} on TMDB for \u201C${q}\u201D` : `${shown2} on TMDB for \u201C${q}\u201D`
        );
        if (this.searchOwned) {
          count.createSpan({ cls: "reel-dim", text: ` \xB7 ${this.searchOwned} already in your library` });
        }
        if (this.searchPage >= this.searchPages)
          sentinel.remove();
      } catch {
        sentinel.remove();
      } finally {
        this.searchMore = false;
      }
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
      const year2 = yearOf(isTv ? item.first_air_date : item.release_date);
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
      if (year2)
        card.createDiv({ cls: "reel-dcard-year", text: String(year2) });
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
      const year2 = yearOf(this.item.release_date ?? this.item.first_air_date);
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
      if (year2)
        meta.createSpan({ text: String(year2) });
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
      /** The sticky foot, kept so it can be put back at the end. */
      this.actionsEl = null;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.addClass("reel-preview");
      paintWash(contentEl, this.plugin.tmdb.posterUrl(this.item.poster_path, "w342"));
      const isTv = this.item.media_type === "tv";
      const title = (isTv ? this.item.name : this.item.title) ?? "Untitled";
      const year2 = yearOf(isTv ? this.item.first_air_date : this.item.release_date);
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
      if (year2)
        h.createSpan({ cls: "reel-dim", text: ` ${year2}` });
      const facts = body.createDiv({ cls: "reel-header-facts" });
      facts.createSpan({ cls: `reel-badge ${isTv ? "tv" : "film"}`, text: isTv ? "Series" : "Film" });
      if (this.item.vote_average)
        facts.createSpan({ cls: "reel-dim", text: `TMDB ${this.item.vote_average.toFixed(1)}` });
      if (this.item.overview)
        contentEl.createDiv({ cls: "reel-preview-overview", text: this.item.overview });
      void this.loadTrailer(contentEl.createDiv({ cls: "reel-preview-trailer" }), isTv);
      const actions = contentEl.createDiv({ cls: "reel-log-actions reel-preview-actions" });
      this.actionsEl = actions;
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
      } finally {
        const actions = this.actionsEl;
        if (actions?.parentElement)
          actions.parentElement.appendChild(actions);
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
      const roles = credits.filter((c) => !isAppearance(c));
      const appearances = credits.filter(isAppearance);
      const lead = roles.length ? roles : appearances;
      this.renderGrid(person, lead, `Known for \u2014 ${lead.length} titles`);
      if (roles.length && appearances.length) {
        const fold = this.contentEl.createEl("button", {
          cls: "reel-person-fold",
          text: `As themselves \u2014 ${appearances.length} appearances`
        });
        fold.addEventListener("click", () => {
          fold.remove();
          this.renderGrid(person, appearances, "As themselves");
        });
      }
    }
    /** One grid of credits under one heading. */
    renderGrid(person, credits, label) {
      this.contentEl.createDiv({ cls: "reel-facet-label", text: label });
      this.contentEl.createDiv({
        cls: "reel-person-hint",
        text: "Tap for the role \xB7 press and hold for the full part"
      });
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
        const year2 = yearOf(c.release_date ?? c.first_air_date);
        const character = (c.character ?? "").trim();
        const job = (c.job ?? "").trim();
        const role = character || job;
        if (role) {
          card.createDiv({
            cls: character ? "reel-person-credit-role" : "reel-person-credit-role is-job",
            text: role
          });
        }
        const bits = [];
        if (year2)
          bits.push(String(year2));
        if (c.media_type === "tv" && c.episode_count) {
          bits.push(c.episode_count === 1 ? "1 ep" : `${c.episode_count} eps`);
        }
        if (bits.length)
          card.createDiv({ cls: "reel-person-credit-sub", text: bits.join(" \xB7 ") });
        attachHold(card, () => new RoleSheet(this.plugin, person, c, mine).open());
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
  var CHAT_GENRES = /* @__PURE__ */ new Set([10763, 10764, 10767]);
  function isAppearance(credit) {
    const role = (credit.character ?? "").trim();
    if (/^(self|himself|herself|themselves)\b/i.test(role))
      return true;
    if (/\bself\s*[-–—]/i.test(role))
      return true;
    return (credit.genre_ids ?? []).some((g) => CHAT_GENRES.has(g));
  }
  function attachHold(el, fire) {
    let timer = null;
    let from = null;
    let fired = false;
    const cancel = () => {
      if (timer !== null)
        window.clearTimeout(timer);
      timer = null;
      from = null;
    };
    el.addEventListener(
      "click",
      (ev) => {
        if (!fired)
          return;
        fired = false;
        ev.stopImmediatePropagation();
        ev.preventDefault();
      },
      true
    );
    el.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0)
        return;
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
    el.addEventListener("pointermove", (ev) => {
      if (!from)
        return;
      if (Math.abs(ev.clientX - from.x) > 10 || Math.abs(ev.clientY - from.y) > 10)
        cancel();
    });
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());
  }
  var RoleSheet = class extends Modal {
    constructor(plugin2, person, credit, mine) {
      super(plugin2.app);
      this.plugin = plugin2;
      this.person = person;
      this.credit = credit;
      this.mine = mine;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal", "reel-role-sheet");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      const title = this.credit.title ?? this.credit.name ?? "Untitled";
      const year2 = yearOf(this.credit.release_date ?? this.credit.first_air_date);
      const character = (this.credit.character ?? "").trim();
      const job = (this.credit.job ?? "").trim();
      const stage = contentEl.createDiv({ cls: "reel-role-stage" });
      const still = this.plugin.tmdb.posterUrl(this.credit.backdrop_path, "w780") ?? this.plugin.tmdb.posterUrl(this.credit.poster_path, "w500");
      if (still) {
        const img = stage.createEl("img", {
          cls: "reel-role-still",
          attr: { src: still, alt: "", decoding: "async" }
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
        text: character || job || "No role recorded for this credit"
      });
      if (character || job) {
        body.createDiv({ cls: "reel-role-what", text: character ? "the character" : "their job" });
      }
      const facts = [this.credit.media_type === "tv" ? "Series" : "Film"];
      if (year2)
        facts.push(String(year2));
      if (this.credit.episode_count) {
        facts.push(this.credit.episode_count === 1 ? "1 episode" : `${this.credit.episode_count} episodes`);
      }
      if (this.credit.vote_average)
        facts.push(`${this.credit.vote_average.toFixed(1)} on TMDB`);
      body.createDiv({ cls: "reel-role-in", text: title });
      body.createDiv({ cls: "reel-role-facts", text: facts.join(" \xB7 ") });
      if (this.credit.overview)
        body.createDiv({ cls: "reel-role-overview", text: this.credit.overview });
      const actions = contentEl.createDiv({ cls: "reel-role-actions" });
      const details = actions.createEl("button", {
        cls: "reel-btn mod-cta",
        text: this.mine ? "Open in your library" : "Full details"
      });
      details.addEventListener("click", () => {
        const mine = this.mine;
        this.close();
        if (mine) {
          void this.plugin.openDetail(mine);
          return;
        }
        new PreviewSheet(this.plugin, this.credit, () => {
        }, roleOf(this.credit)).open();
      });
      if (!this.mine) {
        const add = actions.createEl("button", { cls: "reel-btn", text: "+ Watchlist" });
        add.addEventListener("click", () => {
          add.setAttr("disabled", "true");
          void this.plugin.notes.createFromResult(this.credit, { date: todayISO(), watchlist: true }).then(() => {
            this.plugin.undo.offer(`Added ${title} to your watchlist`);
            this.close();
          }).catch((e) => {
            add.removeAttribute("disabled");
            new Notice(`Reel: ${redact(e)}`);
          });
        });
      }
    }
    onClose() {
      this.contentEl.empty();
    }
  };

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

  // src/publish/compose.ts
  var TRAKT_MIN_WORDS = 5;
  var TRAKT_REVIEW_WORDS = 200;
  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
  function traktComplaint(payload) {
    const body = payload.text.trim();
    if (!body)
      return "There's nothing written to post.";
    const words = wordCount(body);
    if (words < TRAKT_MIN_WORDS) {
      return `Trakt needs at least ${TRAKT_MIN_WORDS} words \u2014 this is ${words}.`;
    }
    if (!payload.entry.tmdbId) {
      return "This note has no TMDB id, so Trakt can't tell which title it's about.";
    }
    return null;
  }

  // src/publish/mastodon.ts
  function normaliseHost(raw) {
    let host = (raw ?? "").trim();
    if (!host)
      return "";
    host = host.replace(/^https?:\/\//i, "");
    host = host.split("/")[0];
    if (host.includes("@"))
      host = host.slice(host.lastIndexOf("@") + 1);
    return host.toLowerCase();
  }

  // src/setup.ts
  var FEATURES = [
    {
      id: "tmdb",
      name: "TMDB",
      gives: "Everything. Posters, cast, runtimes, episode lists \u2014 Reel cannot add a title without it.",
      essential: true,
      effort: "2 minutes, free",
      sends: "The title you search for, or its TMDB id. Nothing about your library.",
      keys: ["tmdb"],
      steps: [
        {
          text: "Create a free TMDB account, if you don't have one.",
          url: "https://www.themoviedb.org/signup"
        },
        {
          text: "Open your API settings and request a key. Pick \u201CDeveloper\u201D, and answer the form \u2014 any personal or hobby use is fine.",
          url: "https://www.themoviedb.org/settings/api"
        },
        {
          text: "Copy the API Read Access Token \u2014 the long one starting eyJ, not the short v3 key.",
          note: "The token travels in a request header; the v3 key has to go in the URL, and URLs end up in logs. Reel accepts either, but this one is safer."
        },
        {
          text: "Paste it below and press Save. You'll be asked for a passphrase \u2014 that encrypts the key inside your vault.",
          key: "tmdb"
        }
      ]
    },
    {
      id: "omdb",
      name: "OMDb",
      gives: "IMDb ratings, Rotten Tomatoes and Metacritic scores on every title.",
      essential: false,
      effort: "1 minute, free",
      sends: "A film's IMDb id, when a note is created or refreshed.",
      keys: ["omdb"],
      steps: [
        {
          text: "Request a free key. The FREE tier is 1,000 requests a day, which Reel's cache makes ample.",
          url: "https://www.omdbapi.com/apikey.aspx"
        },
        {
          text: "Check your email and click the activation link. The key does not work until you do.",
          note: "This one catches people out \u2014 the key arrives before it is active."
        },
        { text: "Paste the key below and press Save.", key: "omdb" }
      ]
    },
    {
      id: "dtdd",
      name: "DoesTheDogDie",
      gives: "Content warnings voted on per topic, so you can tell one upsetting scene from a film full of them.",
      essential: false,
      effort: "A few minutes, free \u2014 they approve by hand",
      sends: "A film's title and year.",
      keys: ["dtdd"],
      steps: [
        {
          text: "Request an API key. Say what it's for \u2014 a personal Obsidian film tracker is a fine answer.",
          url: "https://www.doesthedogdie.com/api"
        },
        {
          text: "Wait for the reply. A person reads these, so it is not instant.",
          note: "Everything else in Reel works meanwhile. Content filtering falls back to TMDB keywords until the key arrives."
        },
        { text: "Paste the key below and press Save.", key: "dtdd" }
      ]
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      gives: "Ask \u2014 describe what you feel like watching and Reel finds it in your own library.",
      essential: false,
      effort: "2 minutes, and you pay per question",
      sends: "Your question, plus a shortlist of titles from your library \u2014 names, years, genres, runtimes and your ratings. Never your reviews, your watch dates or your file paths.",
      keys: ["openrouter"],
      steps: [
        { text: "Create an OpenRouter account.", url: "https://openrouter.ai/" },
        {
          text: "Add some credit. Questions cost a fraction of a penny each on the default model.",
          url: "https://openrouter.ai/credits",
          note: "Reel shows what every question cost in tokens, so this is checkable rather than a mystery bill."
        },
        { text: "Create an API key and copy it.", url: "https://openrouter.ai/keys" },
        { text: "Paste it below, press Save, then turn Ask on.", key: "openrouter" }
      ]
    },
    {
      id: "trakt",
      name: "Trakt",
      gives: "Publishing a review to a public film profile, with your star rating alongside.",
      essential: false,
      effort: "5 minutes, free",
      sends: "Only what you explicitly publish: one review's text, your rating, and the title's id. Nothing automatic.",
      keys: ["traktApp", "trakt"],
      steps: [
        { text: "Create a Trakt account, if you don't have one.", url: "https://trakt.tv/auth/join" },
        {
          text: "Create an application. Any name will do \u2014 it is yours and nobody else sees it.",
          url: "https://trakt.tv/oauth/applications/new",
          note: "Reel asks you to register your own rather than shipping one, because Trakt's sign-in needs a client secret, and a secret compiled into an open-source plugin is printed in the repository for anyone to read."
        },
        {
          text: "Set the Redirect URI to exactly this:",
          copy: "urn:ietf:wg:oauth:2.0:oob",
          note: "This is the standard value for an app with no website to return to. Getting it wrong is the usual reason sign-in fails."
        },
        {
          text: "Save the application, then copy its Client ID and Client Secret into the two fields below.",
          key: "traktApp"
        },
        {
          text: "Press Sign in. Trakt shows a short code \u2014 type it on any device, and Reel waits for you.",
          key: "trakt",
          note: "No redirect back to the app is needed, which is what makes this work on a phone at all."
        }
      ]
    },
    {
      id: "mastodon",
      name: "Mastodon",
      gives: "Publishing a review as a public post, with the title, your stars and the text.",
      essential: false,
      effort: "3 minutes, free",
      sends: "Only what you explicitly publish: one post. Nothing automatic.",
      keys: ["mastodon"],
      steps: [
        {
          text: "Open your instance's development settings \u2014 that's your own server, e.g. mastodon.social/settings/applications.",
          note: "Reel needs the server you post from; there is no central Mastodon."
        },
        { text: "Create a new application. Any name and website will do." },
        {
          text: "Tick only this scope, and untick the rest:",
          copy: "write:statuses",
          note: "The defaults include read access to your whole timeline and follow list. Reel never needs either, and a token that can only post is a token that can only post."
        },
        { text: "Submit, open the application, and copy \u201CYour access token\u201D." },
        /*
         * Two steps, because they were two actions.
         *
         * "Enter your instance's address and paste the token below" asked
         * for both in one line and could only be ticked by the token, so
         * somebody who had typed their server and gone off to make a token
         * came back to a guide reporting nothing done at all. The address
         * is the one thing in this walkthrough Reel can watch you do.
         */
        { text: "Enter your instance's address below.", key: "mastodonHost" },
        { text: "Paste the access token below.", key: "mastodon" }
      ]
    }
  ];
  function completedSteps(spec, has) {
    let done = 0;
    spec.steps.forEach((step, i) => {
      if (step.key && has(step.key))
        done = i + 1;
    });
    return done;
  }
  function isConfigured(plugin2, spec) {
    return spec.keys.every((k) => plugin2.credentials.has(k));
  }
  function proves(plugin2, k) {
    if (k === "mastodonHost")
      return Boolean(normaliseHost(plugin2.settings.mastodonHost));
    return plugin2.credentials.has(k);
  }
  function isPartial(plugin2, spec) {
    if (isConfigured(plugin2, spec))
      return false;
    return spec.steps.some((s) => s.key && proves(plugin2, s.key));
  }
  function partialPhrase(partial) {
    if (!partial.length)
      return "";
    if (partial.length === 1)
      return `${partial[0].name} is half set up`;
    if (partial.length === 2)
      return `${partial[0].name} and ${partial[1].name} are half set up`;
    return `${partial.length} are half set up`;
  }
  function setupState(plugin2) {
    const essential = FEATURES.find((f) => f.essential);
    const done = [];
    const partial = [];
    const todo = [];
    for (const f of FEATURES) {
      if (f.essential)
        continue;
      if (isConfigured(plugin2, f))
        done.push(f);
      else if (isPartial(plugin2, f))
        partial.push(f);
      else
        todo.push(f);
    }
    return { done, partial, todo, blocked: !isConfigured(plugin2, essential), essential };
  }

  // src/health.ts
  var TESTABLE = ["tmdb", "omdb", "dtdd", "openrouter", "mastodon", "trakt"];
  var NEEDS_KEY_TO_CHECK = ["tmdb", "omdb", "dtdd", "openrouter", "trakt"];
  function lastCheckFailed(records, id) {
    return records[id]?.ok === false;
  }
  var STALE_AFTER = 14 * 24 * 60 * 60 * 1e3;
  function ago(then, now) {
    const ms = Math.max(0, now - then);
    const min = Math.floor(ms / 6e4);
    if (min < 1)
      return "just now";
    if (min < 60)
      return `${min} minute${min === 1 ? "" : "s"} ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24)
      return `${hr} hour${hr === 1 ? "" : "s"} ago`;
    const day = Math.floor(hr / 24);
    if (day < 30)
      return `${day} day${day === 1 ? "" : "s"} ago`;
    const mon = Math.floor(day / 30);
    return `${mon} month${mon === 1 ? "" : "s"} ago`;
  }
  function extra(rec, withProves = true) {
    const said = [withProves ? rec.proves : "", rec.note].filter((s) => s && s.trim());
    return said.length ? `. ${said.join(" ")}` : "";
  }
  function describeHealth(rec, configured, now) {
    if (!configured)
      return { text: "Not set up", tone: "info" };
    if (!rec)
      return { text: "Not checked yet", tone: "info" };
    const when = ago(rec.at, now);
    if (!rec.ok)
      return { text: `Failed ${when}${rec.error ? ` \u2014 ${rec.error}` : ""}`, tone: "warn" };
    if (rec.proves)
      return { text: `Checked ${when}. ${rec.proves}${extra(rec, false)}`, tone: "info" };
    if (now - rec.at > STALE_AFTER)
      return { text: `Worked ${when}${extra(rec)}`, tone: "info" };
    return { text: `Working \u2014 checked ${when}${extra(rec)}`, tone: "ok" };
  }
  var SOON = 7 * 24 * 60 * 60 * 1e3;
  function traktState(hasToken, expires, now) {
    if (!hasToken)
      return { kind: "out" };
    if (!expires)
      return { kind: "unknown" };
    if (expires <= now)
      return { kind: "expired", expires };
    if (expires - now < SOON)
      return { kind: "soon", expires };
    return { kind: "in", expires };
  }
  function describeTrakt(state, now, rec) {
    if (rec && !rec.ok && state.kind !== "out") {
      return { text: `Token refused ${ago(rec.at, now)} \u2014 sign in again`, tone: "warn" };
    }
    switch (state.kind) {
      case "out":
        return { text: "Not signed in", tone: "info" };
      case "unknown":
        return { text: "Signed in \u2014 Reel cannot tell when this expires", tone: "info" };
      case "expired":
        return { text: `Session expired ${ago(state.expires, now)} \u2014 sign in again`, tone: "warn" };
      case "soon":
        return { text: `Signed in \u2014 renews automatically this week${checked(rec, now)}`, tone: "ok" };
      case "in":
        return { text: `Signed in${checked(rec, now)}`, tone: "ok" };
    }
  }
  function checked(rec, now) {
    return rec?.ok ? `, checked ${ago(rec.at, now)}` : "";
  }
  function featureHealth(id, inputs, now) {
    if (id === "trakt") {
      return describeTrakt(traktState(inputs.hasTrakt, inputs.traktExpires, now), now, inputs.records.trakt);
    }
    if (!TESTABLE.includes(id))
      return null;
    const rec = inputs.records[id];
    if (!rec && inputs.locked && NEEDS_KEY_TO_CHECK.includes(id)) {
      return { text: "Keys are locked \u2014 unlock to check", tone: "info" };
    }
    return describeHealth(rec, true, now);
  }

  // src/checks.ts
  function checkable(plugin2, id) {
    if (!TESTABLE.includes(id))
      return false;
    if (NEEDS_KEY_TO_CHECK.includes(id) && plugin2.credentials.needsUnlock)
      return false;
    switch (id) {
      case "mastodon":
        return Boolean(normaliseHost(plugin2.settings.mastodonHost));
      default:
        return plugin2.credentials.has(id);
    }
  }
  async function run(plugin2, id) {
    switch (id) {
      case "tmdb":
        return plugin2.tmdb.testCredentials();
      case "omdb":
        return plugin2.omdb.test();
      case "dtdd":
        return plugin2.dtdd.test();
      case "openrouter":
        return plugin2.ai.test();
      case "mastodon":
        return plugin2.publish.mastodon.test();
      case "trakt":
        return plugin2.publish.trakt.test();
      default:
        return { ok: false, error: "Nothing to check." };
    }
  }
  async function checkFeature(plugin2, id, now) {
    if (!checkable(plugin2, id))
      return null;
    let out;
    try {
      out = await run(plugin2, id);
    } catch (e) {
      out = { ok: false, error: redact(e) };
    }
    const rec = out.ok ? { at: now, ok: true, ...out.proves ? { proves: out.proves } : {}, ...out.note ? { note: out.note } : {} } : { at: now, ok: false, error: redact(out.error) };
    plugin2.settings.connectionHealth[id] = rec;
    return rec;
  }
  async function checkAll(plugin2, now) {
    const ids = TESTABLE.filter((id) => checkable(plugin2, id));
    await Promise.all(ids.map((id) => checkFeature(plugin2, id, now)));
    await plugin2.saveSettings();
    return ids.filter((id) => plugin2.settings.connectionHealth[id]?.ok === false);
  }

  // src/ui/confirm.ts
  function confirm(app2, opts) {
    return new Promise((resolve) => new ConfirmModal(app2, opts, resolve).open());
  }
  var ConfirmModal = class extends Modal {
    constructor(app2, opts, done) {
      super(app2);
      this.opts = opts;
      this.done = done;
      this.answered = false;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.addClass("reel-confirm");
      contentEl.createEl("h3", { cls: "reel-log-title", text: this.opts.title });
      contentEl.createDiv({ cls: "reel-log-sub", text: this.opts.body });
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
      cancel.addEventListener("click", () => this.finish(false));
      const go = actions.createEl("button", {
        cls: this.opts.danger ? "reel-btn reel-btn-danger" : "reel-btn mod-cta",
        text: this.opts.confirmText
      });
      go.addEventListener("click", () => this.finish(true));
      cancel.focus();
    }
    finish(ok) {
      this.answered = true;
      this.done(ok);
      this.close();
    }
    onClose() {
      this.contentEl.empty();
      if (!this.answered)
        this.done(false);
    }
  };

  // src/publish/trakt.ts
  var ACTIVATE_URL = "https://trakt.tv/activate";

  // src/ui/traktSignIn.ts
  var TraktSignIn = class extends Modal {
    constructor(app2, plugin2, app_, onDone) {
      super(app2);
      this.plugin = plugin2;
      this.app_ = app_;
      this.onDone = onDone;
      this.stop = false;
      this.device = null;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.addClass("reel-trakt");
      contentEl.createEl("h3", { cls: "reel-log-title", text: "Sign in to Trakt" });
      contentEl.createDiv({ cls: "reel-log-sub", text: "Asking Trakt for a code\u2026" });
      void this.begin();
    }
    async begin() {
      try {
        this.device = await this.plugin.publish.trakt.requestDeviceCode(this.app_);
      } catch (e) {
        this.fail(redact(e));
        return;
      }
      this.renderCode(this.device);
      void this.poll(this.device);
    }
    renderCode(device) {
      const { contentEl } = this;
      contentEl.empty();
      contentEl.createEl("h3", { cls: "reel-log-title", text: "Sign in to Trakt" });
      const steps = contentEl.createDiv({ cls: "reel-trakt-steps" });
      steps.createDiv({ cls: "reel-trakt-step", text: "1. Open this page on any device:" });
      const link = steps.createEl("a", {
        cls: "reel-trakt-url",
        text: device.verificationUrl || ACTIVATE_URL,
        href: device.verificationUrl || ACTIVATE_URL
      });
      link.setAttr("target", "_blank");
      link.setAttr("rel", "noopener");
      steps.createDiv({ cls: "reel-trakt-step", text: "2. Enter this code:" });
      const code = steps.createEl("button", { cls: "reel-trakt-code", text: device.userCode });
      code.setAttr("aria-label", `Code ${device.userCode.split("").join(" ")}. Tap to copy.`);
      code.addEventListener("click", () => {
        navigator.clipboard?.writeText(device.userCode).then(() => new Notice("Reel: code copied.")).catch(() => new Notice("Reel: couldn't copy \u2014 type it from the screen."));
      });
      const status = contentEl.createDiv({ cls: "reel-trakt-status" });
      status.createDiv({ cls: "reel-ask-spinner" });
      status.createSpan({ text: "Waiting for you to approve it\u2026" });
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
      cancel.addEventListener("click", () => this.close());
    }
    /**
     * Ask, wait, ask again, until Trakt says yes, no, or too late.
     *
     * The deadline is Trakt's own `expires_in` rather than a fixed number of
     * attempts, because the interval can be raised mid-flow by a 429 and a loop
     * counting attempts would then give up early — while the user is still
     * typing, having done nothing wrong.
     */
    async poll(device) {
      let wait = Math.max(1, device.interval) * 1e3;
      const deadline = Date.now() + Math.max(60, device.expiresIn) * 1e3;
      while (!this.stop && Date.now() < deadline) {
        await sleep(wait);
        if (this.stop)
          return;
        let token;
        try {
          token = await this.plugin.publish.trakt.pollDeviceToken(this.app_, device.deviceCode);
        } catch (e) {
          this.fail(redact(e));
          return;
        }
        if (token) {
          const saved = await this.plugin.publish.storeToken(JSON.stringify(token));
          if (!saved) {
            this.fail("Signed in, but the token wasn't saved \u2014 the passphrase prompt was cancelled.");
            return;
          }
          this.succeed();
          return;
        }
        wait = Math.min(wait + 500, 15e3);
      }
      if (!this.stop)
        this.fail("The code expired before it was approved.");
    }
    succeed() {
      const { contentEl } = this;
      contentEl.empty();
      const done = contentEl.createDiv({ cls: "reel-trakt-done" });
      setIcon(done.createSpan({ cls: "reel-trakt-done-icon" }), "check");
      done.createSpan({ text: "Signed in to Trakt." });
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const ok = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Done" });
      ok.addEventListener("click", () => this.close());
      ok.focus();
      this.stop = true;
      this.onDone(true);
      this.onDone = () => void 0;
    }
    fail(message) {
      const { contentEl } = this;
      contentEl.empty();
      contentEl.createEl("h3", { cls: "reel-log-title", text: "Couldn't sign in" });
      contentEl.createDiv({ cls: "reel-publish-warn", text: message });
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const ok = actions.createEl("button", { cls: "reel-btn", text: "Close" });
      ok.addEventListener("click", () => this.close());
      this.stop = true;
    }
    onClose() {
      this.stop = true;
      this.contentEl.empty();
      this.onDone(false);
      this.onDone = () => void 0;
    }
  };
  function sleep(ms) {
    return new Promise((r) => window.setTimeout(r, ms));
  }

  // src/ui/fields.ts
  function keyField(el, ctx, name, label, desc, opts = {}) {
    const store = ctx.plugin.credentials;
    let input = null;
    const setting = new Setting(el).setName(label).setDesc(desc).addText((t) => {
      t.setPlaceholder(store.has(name) ? "Saved \u2014 paste to replace" : "Paste key, then Save");
      t.inputEl.type = "password";
      t.inputEl.autocomplete = "off";
      t.inputEl.spellcheck = false;
      t.inputEl.addClass("reel-input");
      input = t.inputEl;
    }).addButton((b) => {
      if (!store.has(name))
        b.setCta();
      return b.setButtonText("Save").onClick(async () => {
        const value = input?.value ?? "";
        if (!value.trim()) {
          new Notice("Reel: nothing to save.");
          return;
        }
        const ok = await ctx.plugin.credentials.store(name, value);
        if (input)
          input.value = "";
        new Notice(ok ? `Reel: ${KEY_LABELS[name]} key saved.` : "Reel: key not saved.");
        ctx.onChanged();
      });
    });
    if (opts.remove && store.has(name)) {
      setting.addButton(
        (b) => b.setButtonText("Remove").onClick(async () => {
          const ok = await confirm(ctx.app, {
            title: `Remove the ${KEY_LABELS[name]} key`,
            body: "Reel cannot recover it. You would need the original key again to re-add it.",
            confirmText: "Remove",
            danger: true
          });
          if (!ok)
            return;
          await ctx.plugin.credentials.remove(name);
          new Notice(`Reel: ${KEY_LABELS[name]} key removed.`);
          ctx.onChanged();
        })
      );
    }
  }
  function traktAppField(el, ctx, opts = {}) {
    const hasApp = ctx.plugin.credentials.has("traktApp");
    let idEl = null;
    let secretEl = null;
    const setting = new Setting(el).setName("Trakt application").setDesc(
      hasApp ? "Saved. Paste both again to replace them." : "From trakt.tv/oauth/applications. Both are stored with your other keys."
    ).addText((t) => {
      t.setPlaceholder("Client ID");
      t.inputEl.autocomplete = "off";
      t.inputEl.spellcheck = false;
      t.inputEl.addClass("reel-input");
      idEl = t.inputEl;
    }).addText((t) => {
      t.setPlaceholder("Client secret");
      t.inputEl.type = "password";
      t.inputEl.autocomplete = "off";
      t.inputEl.spellcheck = false;
      t.inputEl.addClass("reel-input");
      secretEl = t.inputEl;
    }).addButton((b) => {
      if (!hasApp)
        b.setCta();
      return b.setButtonText("Save").onClick(async () => {
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
        if (idEl)
          idEl.value = "";
        if (secretEl)
          secretEl.value = "";
        new Notice(ok ? "Reel: Trakt application saved." : "Reel: not saved.");
        ctx.onChanged();
      });
    });
    if (opts.remove && hasApp) {
      setting.addButton(
        (b) => b.setButtonText("Remove").onClick(async () => {
          const ok = await confirm(ctx.app, {
            title: "Remove the Trakt application",
            body: "This also signs you out of Trakt. You would need the client ID and secret again to reconnect.",
            confirmText: "Remove",
            danger: true
          });
          if (!ok)
            return;
          await ctx.plugin.credentials.remove("traktApp");
          await ctx.plugin.credentials.remove("trakt");
          new Notice("Reel: Trakt application removed.");
          ctx.onChanged();
        })
      );
    }
  }
  function traktSignInField(el, ctx) {
    const hasApp = ctx.plugin.credentials.has("traktApp");
    const signedIn = ctx.plugin.credentials.has("trakt");
    new Setting(el).setName(signedIn ? "Signed in to Trakt" : "Sign in to Trakt").setDesc(
      hasApp ? "Trakt shows a short code. Type it on any device \u2014 Reel waits." : "Save the application above first; the sign-in needs it."
    ).addButton((b) => {
      b.setButtonText(signedIn ? "Sign in again" : "Sign in");
      if (!signedIn)
        b.setCta();
      b.setDisabled(!hasApp);
      b.onClick(async () => {
        const app2 = await ctx.plugin.publish.app();
        if (!app2) {
          new Notice("Reel: couldn't read the Trakt application.");
          return;
        }
        new TraktSignIn(ctx.app, ctx.plugin, app2, (ok) => {
          if (ok)
            ctx.onChanged();
        }).open();
      });
    });
  }
  function mastodonHostField(el, ctx) {
    new Setting(el).setName("Instance").setDesc("The server you post from, e.g. mastodon.social. Not a secret, so it isn't encrypted.").addText(
      (t) => t.setPlaceholder("mastodon.social").setValue(ctx.plugin.settings.mastodonHost).onChange(
        debounce(async (v) => {
          ctx.plugin.settings.mastodonHost = normaliseHost(v);
          await ctx.plugin.saveSettings();
        }, 500)
      )
    );
  }
  function askEnabledField(el, ctx) {
    new Setting(el).setName("Enable Ask").setDesc("Off by default. With this off, no request is ever made, key or no key.").addToggle(
      (t) => t.setValue(ctx.plugin.settings.aiEnabled).onChange(async (v) => {
        ctx.plugin.settings.aiEnabled = v;
        await ctx.plugin.saveSettings();
        ctx.onChanged();
      })
    );
  }
  function publishEnabledField(el, ctx, id, label) {
    const key = id === "trakt" ? "publishTrakt" : "publishMastodon";
    new Setting(el).setName(`Publish to ${label}`).setDesc("Off by default. With this off there is no Publish button, key or no key.").addToggle(
      (t) => t.setValue(ctx.plugin.settings[key]).onChange(async (v) => {
        ctx.plugin.settings[key] = v;
        await ctx.plugin.saveSettings();
        ctx.onChanged();
      })
    );
  }
  function setupFields(el, ctx, spec) {
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
        keyField(el, ctx, "openrouter", "OpenRouter key", "Pasted here, encrypted in your vault.");
        askEnabledField(el, ctx);
        return;
      case "trakt":
        traktAppField(el, ctx);
        traktSignInField(el, ctx);
        publishEnabledField(el, ctx, "trakt", "Trakt");
        return;
      case "mastodon":
        mastodonHostField(el, ctx);
        keyField(el, ctx, "mastodon", "Access token", "The token from step 4, encrypted in your vault.");
        publishEnabledField(el, ctx, "mastodon", "Mastodon");
        return;
      default:
        return;
    }
  }

  // src/ui/setupSheet.ts
  var SetupSheet = class extends Modal {
    constructor(app2, plugin2, spec, onDone) {
      super(app2);
      this.plugin = plugin2;
      this.spec = spec;
      this.onDone = onDone;
      this.ticked = /* @__PURE__ */ new Set();
    }
    onOpen() {
      const { modalEl } = this;
      modalEl.addClass("reel-modal");
      modalEl.addClass("reel-setup-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-modal-phone");
      this.draw();
    }
    /**
     * Redrawn in place after anything that changes the answer.
     *
     * Saving a key changes the state pill, the status line and whether the
     * sign-in button is offered, and a guide that still described the state
     * before you acted would be the same lie this plugin keeps finding: a
     * screen reporting what it was told rather than what is.
     */
    draw() {
      const { contentEl } = this;
      this.seedTicks();
      contentEl.empty();
      contentEl.addClass("reel-setup");
      this.renderHead(contentEl);
      this.renderSteps(contentEl);
      this.renderFields(contentEl);
      this.renderFoot(contentEl);
    }
    /**
     * Steps the vault can prove you have already done.
     *
     * Ticking was there and was purely manual, which means it only ever
     * survived one sitting: come back tomorrow to a guide you half finished
     * and the marks are gone, along with the answer to the only question you
     * have. A saved credential is durable, and it settles the question
     * directly — no new state to store, and nothing to go stale.
     *
     * Only ever adds. A tick you put there by hand is a statement about
     * something Reel cannot see, and taking it away because the plugin has no
     * evidence of it would be the screen overruling you about your own
     * afternoon.
     */
    seedTicks() {
      for (const i of this.plugin.settings.setupTicks[this.spec.id] ?? [])
        this.ticked.add(i);
      const done = completedSteps(this.spec, (k) => this.proves(k));
      for (let i = 0; i < done; i++)
        this.ticked.add(i);
    }
    /**
     * Is this step's product in the vault?
     *
     * Delegated, because the settings row asks the same question and the two
     * gave different answers for a release: the guide counted the Mastodon
     * server as progress and the row that opens it did not.
     */
    proves(k) {
      return proves(this.plugin, k);
    }
    /**
     * Write the marks down.
     *
     * Only the ones you made: a step the credentials already prove is re-seeded
     * on every open and storing it as well would freeze an inference that ought
     * to be recomputed — remove the key and the guide should stop claiming the
     * step is behind you.
     */
    async saveTicks() {
      const proven = completedSteps(this.spec, (k) => this.proves(k));
      const mine = [...this.ticked].filter((i) => i >= proven).sort((a, b) => a - b);
      if (mine.length)
        this.plugin.settings.setupTicks[this.spec.id] = mine;
      else
        delete this.plugin.settings.setupTicks[this.spec.id];
      await this.plugin.saveSettings();
    }
    /**
     * The fields the steps have been pointing at all along.
     *
     * Every guide ends by telling you to paste something "below" and there was
     * nothing below — the field was on the settings screen underneath the sheet
     * saying "look down". The instruction was right about what to do and wrong
     * about where, so following it meant abandoning the walkthrough halfway to
     * go and find a control among forty-nine others.
     *
     * The same controls as the settings screen, not a copy of them: they live
     * in `ui/fields` and both screens call it, so a key saved here is saved
     * there and there is no second implementation to drift.
     */
    renderFields(root) {
      const box = root.createDiv({ cls: "reel-setup-fields" });
      setupFields(box, { app: this.app, plugin: this.plugin, onChanged: () => this.draw() }, this.spec);
      if (!box.childElementCount)
        box.remove();
    }
    /* ------------------------------------------------------------------ */
    renderHead(root) {
      const head = root.createDiv({ cls: "reel-setup-head" });
      const title = head.createDiv({ cls: "reel-setup-title" });
      title.createSpan({ cls: "reel-setup-name", text: this.spec.name });
      const done = isConfigured(this.plugin, this.spec);
      const part = isPartial(this.plugin, this.spec);
      const failed = lastCheckFailed(this.plugin.settings.connectionHealth, this.spec.id);
      title.createSpan({
        cls: done ? failed ? "reel-pill" : "reel-pill ok" : part ? "reel-pill warn" : "reel-pill",
        text: done ? "Set up" : part ? "Half done" : this.spec.essential ? "Required" : "Not set up"
      });
      head.createDiv({ cls: "reel-setup-gives", text: this.spec.gives });
      head.createDiv({ cls: "reel-setup-effort", text: this.spec.effort });
      this.renderHealth(head, done);
      const sends = root.createDiv({ cls: "reel-setup-sends" });
      sends.createDiv({ cls: "reel-setup-sends-label", text: "What leaves your vault" });
      sends.createDiv({ cls: "reel-setup-sends-text", text: this.spec.sends });
    }
    /**
     * What this connection last did, and a way to find out now.
     *
     * Opening a guide for something already set up is almost always because it
     * has stopped working, and the guide used to answer only the question you
     * were not asking — how to set it up, which you already did.
     *
     * The button is the other half of that. Verification lived on a different
     * screen from configuration, behind one control that tested all six
     * services at once, so finishing this walkthrough meant closing it and
     * going to look for something else in order to learn whether the key you
     * had just pasted was right.
     *
     * Shown when the feature is set up *or* merely checkable, which are not the
     * same thing and the difference is the point. Mastodon is checked by its
     * server address rather than its token, so somebody who has typed a server
     * and not yet made a token can find out the address is wrong — which is
     * both the commonest mistake and the cheapest moment to fix it.
     */
    renderHealth(head, done) {
      const can = checkable(this.plugin, this.spec.id);
      if (!done && !can)
        return;
      const said = this.healthLine();
      if (!said && !can)
        return;
      const wrap = head.createDiv({ cls: "reel-setup-check" });
      const line = wrap.createDiv({ cls: "reel-setup-health" });
      const draw2 = () => {
        const now = this.healthLine();
        line.setText(now?.text ?? "");
        line.className = `reel-setup-health is-${now?.tone ?? "info"}`;
      };
      draw2();
      if (!can) {
        if (!this.locked())
          return;
        const open = wrap.createEl("button", { cls: "reel-btn reel-setup-check-btn", text: "Unlock" });
        open.addEventListener("click", async () => {
          open.disabled = true;
          open.setText("Unlocking\u2026");
          const opened = await this.plugin.credentials.unlock();
          if (!opened) {
            open.disabled = false;
            open.setText("Unlock");
            return;
          }
          this.draw();
        });
        return;
      }
      const btn = wrap.createEl("button", { cls: "reel-btn reel-setup-check-btn", text: "Check now" });
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.setText("Checking\u2026");
        try {
          await checkFeature(this.plugin, this.spec.id, Date.now());
          await this.plugin.saveSettings();
        } finally {
          btn.disabled = false;
          btn.setText("Check now");
          draw2();
        }
      });
    }
    /**
     * Null for the features nothing can honestly report on.
     *
     * The routing lives in `health.ts` and is shared with the settings rows and
     * the health table. It was written out here as well, which is how a guide
     * and a row come to disagree about the same feature.
     */
    /** Sealed keys, and this feature is one of the ones that needs them. */
    locked() {
      return NEEDS_KEY_TO_CHECK.includes(this.spec.id) && this.plugin.credentials.needsUnlock && this.plugin.credentials.hasStoredKey;
    }
    healthLine() {
      const s = this.plugin.settings;
      return featureHealth(
        this.spec.id,
        {
          records: s.connectionHealth,
          hasTrakt: this.plugin.credentials.has("trakt"),
          traktExpires: s.traktExpires,
          locked: this.plugin.credentials.needsUnlock
        },
        Date.now()
      );
    }
    /**
     * The instructions, folded away once there is nothing left to follow.
     *
     * Opening a guide for a feature that is already working is a normal thing
     * to do — it is where the status lives, and the Check now button, and the
     * field you would use to replace a key. What you are not doing is reading
     * how to create the account, and five completed steps between you and the
     * three things you came for is a wall of settled questions.
     *
     * The settings list already reasons this way about its own descriptions: a
     * pitch is for something you have not bought yet. This is the same rule one
     * screen further in.
     *
     * Folded, never dropped. Making a second token a year from now means
     * reading them again, and a guide that has quietly stopped containing its
     * own guide would be a worse answer than a long screen.
     */
    renderSteps(root) {
      const total = this.spec.steps.length;
      const allDone = total > 0 && this.spec.steps.every((_, i) => this.ticked.has(i));
      if (!allDone) {
        const open = root.createEl("ol", { cls: "reel-setup-steps" });
        this.spec.steps.forEach((step, i) => this.renderStep(open, step, i));
        return;
      }
      const toggle2 = root.createEl("button", { cls: "reel-btn reel-setup-steps-toggle" });
      const failed = lastCheckFailed(this.plugin.settings.connectionHealth, this.spec.id);
      const list2 = root.createEl("ol", { cls: failed ? "reel-setup-steps" : "reel-setup-steps is-collapsed" });
      const label = () => {
        const shown2 = !list2.classList.contains("is-collapsed");
        toggle2.setText(shown2 ? "Hide the steps" : `All ${total} steps done \u2014 show them`);
        toggle2.setAttr("aria-expanded", String(shown2));
      };
      toggle2.addEventListener("click", () => {
        list2.classList.toggle("is-collapsed");
        label();
      });
      label();
      this.spec.steps.forEach((step, i) => this.renderStep(list2, step, i));
    }
    renderStep(list2, step, i) {
      const li = list2.createEl("li", { cls: "reel-setup-step" });
      const row = li.createDiv({ cls: "reel-setup-step-row" });
      const done = this.ticked.has(i);
      if (done)
        li.addClass("is-done");
      const tick = row.createEl("button", { cls: "reel-setup-tick", text: done ? "\u2713" : String(i + 1) });
      tick.setAttr("aria-label", `Step ${i + 1}. Tap to mark done.`);
      tick.setAttr("aria-pressed", String(done));
      row.createSpan({ cls: "reel-setup-step-text", text: step.text });
      const mark = () => {
        const on = this.ticked.has(i);
        if (on)
          this.ticked.delete(i);
        else
          this.ticked.add(i);
        li.toggleClass("is-done", !on);
        tick.setAttr("aria-pressed", String(!on));
        tick.setText(!on ? "\u2713" : String(i + 1));
        void this.saveTicks();
      };
      tick.addEventListener("click", mark);
      if (step.copy)
        this.renderCopy(li, step.copy);
      if (step.url) {
        const a = li.createEl("a", {
          cls: "reel-btn reel-setup-go",
          text: this.hostOf(step.url),
          href: step.url
        });
        a.setAttr("target", "_blank");
        a.setAttr("rel", "noopener");
        a.addEventListener("click", () => {
          if (!this.ticked.has(i))
            mark();
        });
      }
      if (step.note)
        li.createDiv({ cls: "reel-setup-note", text: step.note });
    }
    /**
     * A literal to be typed exactly, with a button that copies it.
     *
     * The two values in Reel's entire setup that must match character for
     * character are Trakt's redirect URI and Mastodon's scope, and both are
     * strings of punctuation that mean nothing to read. Copying either by eye
     * is how a setup fails five minutes later with somebody else's error
     * message attached.
     */
    renderCopy(li, value) {
      const btn = li.createEl("button", { cls: "reel-setup-copy" });
      btn.createSpan({ cls: "reel-setup-copy-value", text: value });
      btn.createSpan({ cls: "reel-setup-copy-hint", text: "Copy" });
      btn.setAttr("aria-label", `Copy ${value}`);
      btn.addEventListener("click", () => {
        navigator.clipboard?.writeText(value).then(() => {
          new Notice("Reel: copied.");
          btn.addClass("is-copied");
        }).catch(() => new Notice("Reel: couldn't copy \u2014 type it from the screen."));
      });
    }
    renderFoot(root) {
      const foot = root.createDiv({ cls: "reel-setup-foot" });
      const close = foot.createEl("button", { cls: "reel-btn mod-cta", text: "Back to settings" });
      close.addEventListener("click", () => {
        this.close();
        this.onDone?.();
      });
    }
    /** "Open themoviedb.org" reads better on a button than the whole URL does. */
    hostOf(url) {
      try {
        return `Open ${new URL(url).hostname.replace(/^www\./, "")}`;
      } catch {
        return "Open";
      }
    }
    onClose() {
      this.contentEl.empty();
    }
  };

  // src/ui/publishSheet.ts
  var PublishSheet = class extends Modal {
    constructor(app2, plugin2, opts) {
      super(app2);
      this.plugin = plugin2;
      this.opts = opts;
      this.chosen = /* @__PURE__ */ new Set();
      this.busy = false;
      this.spoiler = plugin2.settings.publishSpoilerDefault;
    }
    get payload() {
      return {
        entry: this.opts.entry,
        date: this.opts.date,
        rating: this.opts.rating,
        text: this.opts.text,
        spoiler: this.spoiler
      };
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.addClass("reel-publish");
      contentEl.createEl("h3", { cls: "reel-log-title", text: "Publish review" });
      const sub = contentEl.createDiv({ cls: "reel-publish-sub" });
      sub.createSpan({ cls: "reel-publish-title", text: this.opts.entry.title });
      if (this.opts.rating != null && this.opts.rating > 0) {
        renderStarsStatic(sub.createSpan({ cls: "reel-publish-stars" }), this.opts.rating);
      }
      if (this.opts.date)
        sub.createSpan({ cls: "reel-publish-date", text: prettyDate(this.opts.date) });
      const targets = this.plugin.publish.targets();
      if (!targets.length) {
        this.renderNowhere(contentEl);
        return;
      }
      this.renderTargets(contentEl, targets);
      this.renderSpoiler(contentEl);
      this.previewHost = contentEl.createDiv({ cls: "reel-publish-previews" });
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const cancel = actions.createEl("button", { cls: "reel-btn", text: "Cancel" });
      cancel.addEventListener("click", () => this.close());
      this.goBtn = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Publish" });
      this.goBtn.addEventListener("click", () => void this.run());
      cancel.focus();
      void this.repaint();
    }
    /**
     * Publishing is on but nothing is configured.
     *
     * This said "Settings → Reel → Publishing has Trakt and Mastodon" and
     * offered one button that opened the settings tab, which is the fault the
     * walkthroughs exist to fix: the screen knows exactly which two features are
     * missing and it threw that away to drop you at the top of a tab holding
     * forty-nine controls.
     *
     * Two buttons rather than one, because there genuinely are two answers and
     * they differ in kind — Trakt is a film profile, Mastodon is a public
     * post. Choosing between them is the first real decision, and each guide
     * says what leaves your vault before you commit to anything.
     */
    renderNowhere(el) {
      el.createDiv({
        cls: "reel-publish-empty",
        text: "No publishing destination is set up yet. Trakt puts the review on your film profile; Mastodon posts it publicly. Either takes a few minutes, and neither sends anything until you press Publish."
      });
      const actions = el.createDiv({ cls: "reel-log-actions" });
      for (const id of ["trakt", "mastodon"]) {
        const spec = FEATURES.find((f) => f.id === id);
        if (!spec)
          continue;
        const go = actions.createEl("button", {
          cls: `reel-btn${id === "trakt" ? " mod-cta" : ""}`,
          text: `Set up ${spec.name}`
        });
        go.addEventListener("click", () => {
          this.close();
          new SetupSheet(this.app, this.plugin, spec).open();
        });
      }
    }
    renderTargets(el, targets) {
      const row = el.createDiv({ cls: "reel-publish-targets" });
      for (const t of targets) {
        const btn = row.createEl("button", { cls: "reel-publish-target" });
        btn.createSpan({ cls: "reel-publish-target-name", text: t.label });
        const already = this.plugin.publish.publishedTo(this.opts.entry)[t.id];
        if (t.blocker) {
          btn.addClass("is-blocked");
          btn.createSpan({ cls: "reel-publish-target-note", text: t.blocker });
          const spec = FEATURES.find((f) => f.id === t.id);
          if (!spec) {
            btn.disabled = true;
            continue;
          }
          btn.setAttribute("aria-label", `Set up ${spec.name}`);
          btn.addEventListener("click", () => {
            this.close();
            new SetupSheet(this.app, this.plugin, spec).open();
          });
          continue;
        }
        if (already) {
          btn.createSpan({ cls: "reel-publish-target-note", text: "Already published once" });
        }
        btn.addEventListener("click", () => {
          if (this.busy)
            return;
          if (this.chosen.has(t.id))
            this.chosen.delete(t.id);
          else
            this.chosen.add(t.id);
          btn.toggleClass("is-on", this.chosen.has(t.id));
          void this.repaint();
        });
      }
    }
    renderSpoiler(el) {
      const row = el.createDiv({ cls: "reel-publish-spoiler" });
      const btn = row.createEl("button", { cls: "reel-publish-toggle" });
      const paint = () => {
        btn.empty();
        btn.toggleClass("is-on", this.spoiler);
        setIcon(btn.createSpan({ cls: "reel-publish-toggle-icon" }), this.spoiler ? "eye-off" : "eye");
        btn.createSpan({ text: this.spoiler ? "Marked as spoilers" : "No spoilers" });
      };
      paint();
      btn.addEventListener("click", () => {
        this.spoiler = !this.spoiler;
        paint();
        void this.repaint();
      });
      row.createDiv({
        cls: "reel-publish-hint",
        text: "Trakt requires this either way. On Mastodon it goes behind a content warning."
      });
    }
    /**
     * Redraw the previews for whatever is currently ticked.
     *
     * Async because Mastodon's character limit is a property of the instance and
     * has to be asked for. The sheet stays usable while that is in flight — a
     * preview arriving a moment late is fine, a sheet that blocks on a network
     * call before it will render is not.
     */
    async repaint() {
      if (!this.previewHost)
        return;
      this.previewHost.empty();
      this.goBtn.disabled = this.chosen.size === 0 || this.busy;
      if (!this.chosen.size) {
        this.previewHost.createDiv({
          cls: "reel-publish-hint",
          text: "Pick where this should go. Nothing is sent until you press Publish."
        });
        return;
      }
      for (const id of this.chosen) {
        const box = this.previewHost.createDiv({ cls: "reel-publish-preview" });
        const label = id === "trakt" ? "Trakt" : "Mastodon";
        box.createDiv({ cls: "reel-publish-preview-head", text: label });
        const complaint = this.plugin.publish.complaint(this.payload, id);
        if (complaint) {
          box.createDiv({ cls: "reel-publish-warn", text: complaint });
          this.goBtn.disabled = true;
          continue;
        }
        try {
          const composed = await this.plugin.publish.preview(this.payload, id);
          box.createDiv({ cls: "reel-publish-text", text: composed.text });
          const meta = box.createDiv({ cls: "reel-publish-meta" });
          meta.createSpan({ text: `${composed.text.length} characters` });
          if (composed.truncated) {
            box.createDiv({
              cls: "reel-publish-warn",
              text: "Too long for this instance \u2014 the post is cut where you see the ellipsis. The full review stays in your vault."
            });
          }
          if (id === "trakt" && wordCount(this.opts.text) > TRAKT_REVIEW_WORDS) {
            meta.createSpan({ text: " \xB7 filed as a review, not a shout" });
          }
        } catch (e) {
          box.createDiv({ cls: "reel-publish-warn", text: redact(e) });
        }
      }
    }
    async run() {
      if (this.busy || !this.chosen.size)
        return;
      this.busy = true;
      this.goBtn.disabled = true;
      this.goBtn.setText("Publishing\u2026");
      let outcomes = [];
      try {
        outcomes = await this.plugin.publish.publish(this.payload, [...this.chosen]);
      } catch (e) {
        new Notice(`Reel: ${redact(e)}`, 8e3);
        this.busy = false;
        this.goBtn.disabled = false;
        this.goBtn.setText("Publish");
        return;
      }
      this.opts.onDone?.();
      this.renderOutcome(outcomes);
    }
    /**
     * What happened, per destination, without closing the sheet.
     *
     * Closing on success and firing a toast was the first version, and it was
     * wrong: a toast that says "published" and vanishes leaves you with no way
     * to get to the thing that was published, and no way to read the one target
     * that failed while the other worked.
     */
    renderOutcome(outcomes) {
      const { contentEl } = this;
      contentEl.empty();
      const good = outcomes.filter((o) => o.ok);
      contentEl.createEl("h3", {
        cls: "reel-log-title",
        text: good.length === outcomes.length ? "Published" : good.length ? "Partly published" : "Not published"
      });
      const list2 = contentEl.createDiv({ cls: "reel-publish-outcomes" });
      for (const o of outcomes) {
        const row = list2.createDiv({ cls: `reel-publish-outcome ${o.ok ? "is-ok" : "is-bad"}` });
        setIcon(row.createSpan({ cls: "reel-publish-outcome-icon" }), o.ok ? "check" : "alert-triangle");
        row.createSpan({ cls: "reel-publish-outcome-name", text: o.label });
        if (o.ok && o.url) {
          const link = row.createEl("a", { cls: "reel-publish-outcome-link", text: "View", href: o.url });
          link.setAttr("target", "_blank");
          link.setAttr("rel", "noopener");
        } else if (!o.ok) {
          row.createSpan({ cls: "reel-publish-outcome-why", text: o.error ?? "Failed." });
        }
      }
      const actions = contentEl.createDiv({ cls: "reel-log-actions" });
      const done = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Done" });
      done.addEventListener("click", () => this.close());
      done.focus();
    }
    onClose() {
      this.contentEl.empty();
    }
  };

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
        if (plugin2.publish.anyEnabled) {
          const already = plugin2.publish.publishedTo(entry);
          const gone = Object.keys(already).length > 0;
          const send = head.createEl("button", {
            cls: `reel-yours-publish clickable-icon${gone ? " is-published" : ""}`,
            attr: {
              type: "button",
              "aria-label": gone ? "Published \u2014 publish again" : "Publish this review"
            }
          });
          setIcon(send, gone ? "check-circle-2" : "send");
          send.addEventListener("click", (ev) => {
            ev.stopPropagation();
            new PublishSheet(plugin2.app, plugin2, {
              entry,
              date: review.date,
              rating: review.rating ?? entry.rating,
              text: review.text,
              onDone: repaint
            }).open();
          });
        }
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
      const year2 = e.year ?? e.firstAirYear;
      if (year2)
        h.createSpan({ cls: "reel-dim", text: ` ${year2}` });
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
      const score2 = (label, value, cls, outOf) => {
        const chip = scores.createDiv({ cls: `reel-score ${cls}` });
        const v = chip.createDiv({ cls: "reel-score-value", text: value });
        if (outOf)
          v.createSpan({ cls: "reel-score-scale", text: `/${outOf}` });
        chip.createDiv({ cls: "reel-score-label", text: label });
      };
      if (e.rating != null)
        score2("You", String(e.rating), "mine", "5");
      const epAvg = this.episodeAverage();
      if (epAvg != null)
        score2("Episodes", epAvg.toFixed(1), "mine", "5");
      if (e.imdbRating != null) {
        score2("IMDb", e.imdbRating.toFixed(1), "imdb", "10");
        if (e.imdbVotes) {
          const chip = scores.lastElementChild;
          chip?.createDiv({ cls: "reel-score-votes", text: compactCount(e.imdbVotes) });
        }
      }
      if (e.metacritic != null) {
        score2("Metacritic", String(e.metacritic), e.metacritic >= 61 ? "meta-good" : e.metacritic >= 40 ? "meta-mixed" : "meta-bad", "100");
      }
      if (e.rottenTomatoes != null)
        score2("Tomatoes", `${e.rottenTomatoes}%`, e.rottenTomatoes >= 60 ? "fresh" : "rotten");
      if (e.tmdbRating != null)
        score2("TMDB", e.tmdbRating.toFixed(1), "", "10");
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
      const shell = wrap.createDiv({ cls: "reel-facet-tabwrap" });
      const bar = shell.createDiv({ cls: "reel-facet-tabs" });
      const strip = this.plugin.posters.washUrl(this.entry);
      if (strip) {
        shell.addClass("has-wash");
        shell.setCssProps({ "--reel-wash": `url("${strip}")` });
      }
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
      const list2 = el.createDiv({ cls: "reel-people" });
      for (const p of people.slice(0, 40)) {
        const row = list2.createDiv({ cls: "reel-person" });
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
      const list2 = wrap.createDiv({ cls: "reel-history" });
      for (const w of [...e.watched].reverse()) {
        const row = list2.createDiv({ cls: "reel-history-row" });
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
    const extra2 = because.length - names.length;
    let list2;
    if (names.length === 1)
      list2 = names[0];
    else if (names.length === 2)
      list2 = `${names[0]} and ${names[1]}`;
    else
      list2 = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    if (extra2 > 0)
      list2 += ` and ${extra2} more`;
    return `Because it's like ${list2}`;
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
        const toggle2 = () => {
          haptic("tick");
          this.recipe.seeds = on ? this.recipe.seeds.filter((id) => id !== entry.tmdbId) : [...this.recipe.seeds, entry.tmdbId];
          this.paint();
        };
        cell.addEventListener("click", toggle2);
        cell.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ")
            return;
          ev.preventDefault();
          toggle2();
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

  // src/ui/rate.ts
  var QUEUES = [
    { id: "unrated", label: "Unrated", empty: "Everything you've watched is rated." },
    { id: "watchlist", label: "Watchlist", empty: "Nothing on the watchlist." },
    { id: "all", label: "Everything", empty: "Nothing in the library yet." }
  ];
  var RateScreen = class {
    constructor(plugin2) {
      this.plugin = plugin2;
      this.queue = "unrated";
      this.index = 0;
      this.skipped = /* @__PURE__ */ new Set();
      /**
       * Acted on this session. The queue is rebuilt from the library index on
       * every repaint, but metadataCache hasn't reparsed by then — so a film you
       * just rated still looks unrated and you'd be handed the same card again.
       */
      this.handled = /* @__PURE__ */ new Set();
      /**
       * The view's filtered-and-searched set, when it has one.
       *
       * Assigned rather than passed to the constructor because the screen is kept
       * across repaints — that is what preserves your place in the queue — so it
       * outlives any one set of filters.
       */
      this.scope = null;
    }
    get def() {
      return QUEUES.find((q) => q.id === this.queue) ?? QUEUES[0];
    }
    pool() {
      const all2 = this.scope ?? this.plugin.visible(this.plugin.library.all());
      const base = this.queue === "unrated" ? all2.filter((e) => e.rating == null && (e.watched.length > 0 || e.status === "watched" || e.status === "completed")) : this.queue === "watchlist" ? all2.filter((e) => e.status === "watchlist") : all2;
      return base.filter((e) => !this.skipped.has(e.path) && !this.handled.has(e.path));
    }
    render(container) {
      container.empty();
      container.addClass("reel-rate");
      const bar = container.createDiv({ cls: "reel-chips" });
      for (const q of QUEUES) {
        const chip = bar.createEl("button", { cls: "reel-chip", text: q.label });
        chip.toggleClass("is-active", this.queue === q.id);
        chip.addEventListener("click", () => {
          this.queue = q.id;
          this.index = 0;
          this.handled.clear();
          this.skipped.clear();
          this.render(container);
        });
      }
      this.renderLibraryQueue(container);
    }
    /* ------------------------------------------------------------------ */
    /* Rate — titles you already have                                      */
    /* ------------------------------------------------------------------ */
    renderLibraryQueue(container) {
      const rows2 = this.pool();
      if (!rows2.length) {
        const done = container.createDiv({ cls: "reel-empty" });
        done.createDiv({ text: this.skipped.size ? "Nothing left in this queue." : this.def.empty });
        if (this.handled.size) {
          done.createDiv({
            cls: "reel-dim",
            text: `${this.handled.size} handled this session.`
          });
        }
        if (this.skipped.size) {
          const again = done.createEl("button", { cls: "reel-btn", text: `Bring back ${this.skipped.size} skipped` });
          again.addEventListener("click", () => {
            this.skipped.clear();
            this.index = 0;
            this.render(container);
          });
        }
        return;
      }
      if (this.index >= rows2.length)
        this.index = 0;
      const entry = rows2[this.index];
      container.createDiv({ cls: "reel-rate-count", text: `${this.index + 1} of ${rows2.length}` });
      const card = container.createDiv({ cls: "reel-rate-card" });
      paintWash(card, this.plugin.posters.displayUrl(entry));
      card.setAttr("tabindex", "0");
      card.addEventListener("keydown", (ev) => void this.handleKey(ev, entry, container, rows2.length));
      if (!Platform.isMobile)
        window.setTimeout(() => card.focus(), 0);
      const posterEl = card.createDiv({ cls: "reel-rate-poster" });
      this.plugin.posters.attach(posterEl, entry);
      posterEl.addEventListener("click", () => void this.plugin.openDetail(entry));
      const body = card.createDiv({ cls: "reel-rate-body" });
      const title = body.createDiv({ cls: "reel-rate-title" });
      title.createSpan({ text: entry.title });
      const year2 = entry.year ?? entry.firstAirYear;
      if (year2)
        title.createSpan({ cls: "reel-dim", text: ` ${year2}` });
      const facts = body.createDiv({ cls: "reel-header-facts" });
      const people = entry.type === "tv" ? entry.creators : entry.director;
      if (people.length)
        facts.createSpan({ text: people.map(unlink).slice(0, 2).join(", ") });
      if (entry.runtime)
        facts.createSpan({ text: formatMinutes(entry.runtime) });
      if (entry.genres.length)
        facts.createSpan({ cls: "reel-dim", text: entry.genres.slice(0, 2).join(", ") });
      if (entry.imdbRating != null)
        facts.createSpan({ cls: "reel-dim", text: `IMDb ${entry.imdbRating.toFixed(1)}` });
      if (entry.overview)
        body.createDiv({ cls: "reel-rate-overview", text: entry.overview });
      const starRow = card.createDiv({ cls: "reel-rating-row big reel-rate-stars" });
      renderStars(starRow, {
        value: entry.rating,
        onChange: (v) => void this.applyRating(entry, v, container, rows2.length)
      });
      const actions = container.createDiv({ cls: "reel-rate-actions" });
      const act = (label, cls, fn) => {
        const b = actions.createEl("button", { cls: `reel-btn ${cls}`, text: label });
        b.addEventListener("click", () => void Promise.resolve(fn(b)));
        return b;
      };
      act("Skip", "", () => {
        this.skipped.add(entry.path);
        this.render(container);
      });
      act(entry.liked ? "\u2665 Liked" : "\u2661 Like", entry.liked ? "is-liked" : "", async (b) => {
        const file = this.fileFor(entry);
        if (!file)
          return;
        const on = await this.plugin.notes.toggleLiked(file);
        entry.liked = on;
        b.setText(on ? "\u2665 Liked" : "\u2661 Like");
        b.toggleClass("is-liked", on);
      });
      if (entry.status !== "watchlist") {
        act("\u2192 Watchlist", "", async () => {
          const file = this.fileFor(entry);
          if (!file)
            return;
          await this.plugin.notes.setStatus(file, "watchlist");
          this.handled.add(entry.path);
          this.plugin.undo.offer(`${entry.title} moved to the watchlist`);
          this.advance(container, rows2.length);
        });
      } else {
        act("Mark watched", "mod-cta", async () => {
          const file = this.fileFor(entry);
          if (!file)
            return;
          if (entry.type === "tv")
            await this.plugin.notes.setStatus(file, "watching");
          else
            await this.plugin.notes.logFilm(file, { date: todayISO(), rating: entry.rating });
          this.handled.add(entry.path);
          this.plugin.undo.offer(`${entry.title} marked watched`);
          this.advance(container, rows2.length);
        });
      }
      if (!Platform.isMobile) {
        container.createDiv({
          cls: "reel-rate-hint",
          text: "1\u20135 to rate \xB7 shift for halves \xB7 \u2190 \u2192 to move \xB7 s skip \xB7 l like"
        });
      }
      this.renderNav(container, rows2.length);
    }
    renderNav(container, total) {
      const nav = container.createDiv({ cls: "reel-rate-nav" });
      const prev = nav.createEl("button", { cls: "reel-btn", text: "\u2190 Previous" });
      prev.disabled = this.index === 0;
      prev.addEventListener("click", () => {
        this.index = Math.max(0, this.index - 1);
        this.render(container);
      });
      const next = nav.createEl("button", { cls: "reel-btn", text: "Next \u2192" });
      next.addEventListener("click", () => {
        this.index = this.index + 1 >= total ? 0 : this.index + 1;
        this.render(container);
      });
    }
    async applyRating(entry, v, container, total) {
      const file = this.fileFor(entry);
      if (!file)
        return;
      try {
        await this.plugin.notes.setRating(file, v ?? null);
        if (v != null)
          this.handled.add(entry.path);
        new Notice(v == null ? `${entry.title}: rating cleared` : `${entry.title}: ${v}\u2605`);
        this.advance(container, total);
      } catch (e) {
        new Notice(`Reel: ${redact(e)}`);
      }
    }
    /** 1–5 rate, shift for halves, arrows move, s skips, l likes. */
    async handleKey(ev, entry, container, total) {
      const file = this.fileFor(entry);
      if (!file)
        return;
      if (ev.key >= "1" && ev.key <= "5") {
        ev.preventDefault();
        const whole = Number(ev.key);
        await this.applyRating(entry, ev.shiftKey ? whole - 0.5 : whole, container, total);
        return;
      }
      switch (ev.key) {
        case "ArrowRight":
        case "s":
          ev.preventDefault();
          this.skipped.add(entry.path);
          this.render(container);
          break;
        case "ArrowLeft":
          ev.preventDefault();
          this.index = Math.max(0, this.index - 1);
          this.render(container);
          break;
        case "l":
          ev.preventDefault();
          await this.plugin.notes.toggleLiked(file);
          this.render(container);
          break;
      }
    }
    advance(container, total) {
      if (this.queue !== "unrated")
        this.index = this.index + 1 >= total ? 0 : this.index + 1;
      this.render(container);
    }
    fileFor(entry) {
      const f = this.plugin.app.vault.getAbstractFileByPath(entry.path);
      return f instanceof TFile ? f : null;
    }
  };

  // src/ui/filterSheet.ts
  function emptyFilters() {
    return { type: "all", genres: [], statuses: [], lists: [], sort: "watched", sort2: "", layout: "grid" };
  }
  function toggle(set, value) {
    const at = set.indexOf(value);
    if (at >= 0)
      set.splice(at, 1);
    else
      set.push(value);
  }
  function narrow(rows2, f) {
    let out = rows2;
    if (f.type !== "all")
      out = out.filter((e) => e.type === f.type);
    if (f.statuses.length) {
      out = out.filter((e) => f.statuses.some((s) => matchesStatus(e, s)));
    }
    if (f.genres.length)
      out = out.filter((e) => f.genres.some((g) => e.genres.includes(g)));
    if (f.lists.length)
      out = out.filter((e) => f.lists.some((l) => e.lists.includes(l)));
    return out;
  }
  var SORT_OPTIONS = [
    ["watched", "Recently watched"],
    ["added", "Recently added"],
    ["rating", "My rating"],
    ["imdb_rating", "IMDb rating"],
    ["metacritic", "Metacritic"],
    ["tmdb_rating", "TMDB rating"],
    ["title", "Title"],
    ["year", "Year"],
    ["runtime", "Runtime"],
    ["popularity", "Popularity"],
    ["certification", "Certification"],
    ["random", "Shuffle"]
  ];
  var FilterSheet = class extends Modal {
    constructor(app2, filters, opts) {
      super(app2);
      this.filters = filters;
      this.opts = opts;
      this.countEl = null;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      modalEl.addClass("reel-filter-sheet");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      const head = contentEl.createDiv({ cls: "reel-filter-head" });
      head.createEl("h3", { cls: "reel-log-title", text: "Filters" });
      const clear = head.createEl("button", { cls: "reel-btn reel-filter-clear", text: "Clear all" });
      clear.addEventListener("click", () => {
        const { sort, sort2, layout } = this.filters;
        Object.assign(this.filters, emptyFilters(), { sort, sort2, layout });
        this.opts.onChange();
        this.redraw();
      });
      this.body = contentEl.createDiv({ cls: "reel-filter-body" });
      this.redraw();
      const foot = contentEl.createDiv({ cls: "reel-log-actions reel-filter-actions" });
      const done = foot.createEl("button", { cls: "reel-btn mod-cta reel-filter-done" });
      this.countEl = done.createSpan();
      done.addEventListener("click", () => this.close());
      this.paintCount();
    }
    /** How many titles the current set would show. */
    paintCount() {
      if (!this.countEl)
        return;
      const n2 = narrow(this.opts.pool, this.filters).length;
      this.countEl.setText(n2 === 1 ? "Show 1 title" : `Show ${n2} titles`);
    }
    /**
     * Rebuild the body, keeping your place in it.
     *
     * Called only when the offered chips could actually have changed — Type,
     * and Clear all. Everything else toggles in place.
     */
    redraw() {
      const el = this.body;
      const keepScroll = el.scrollTop;
      el.empty();
      const section = (label) => {
        const box = el.createDiv({ cls: "reel-filter-section" });
        box.createDiv({ cls: "reel-filter-label", text: label });
        return box.createDiv({ cls: "reel-chips reel-filter-chips" });
      };
      const withCount = (b, label, n2) => {
        b.setText(label);
        if (n2 == null)
          return;
        b.createSpan({ cls: "reel-chip-count", text: String(n2) });
        b.setAttr("aria-label", `${label}, ${n2} title${n2 === 1 ? "" : "s"}`);
      };
      const one = (into, label, active, onClick, count) => {
        const b = into.createEl("button", { cls: "reel-chip", attr: { type: "button" } });
        withCount(b, label, count);
        setSelected(b, active);
        b.addEventListener("click", () => {
          onClick();
          this.opts.onChange();
          this.redraw();
        });
      };
      const many = (into, label, set, value, count) => {
        const b = into.createEl("button", { cls: "reel-chip", attr: { type: "button" } });
        withCount(b, label, count);
        setSelected(b, set.includes(value));
        b.addEventListener("click", () => {
          toggle(set, value);
          setSelected(b, set.includes(value));
          this.opts.onChange();
          this.paintCount();
        });
      };
      const kinds = section("Type");
      for (const [value, label] of [
        ["all", "Everything"],
        ["film", "Films"],
        ["tv", "Series"]
      ]) {
        one(
          kinds,
          label,
          this.filters.type === value,
          () => this.filters.type = value,
          value === "all" ? this.opts.pool.length : this.opts.pool.filter((e) => e.type === value).length
        );
      }
      const pool2 = narrow(this.opts.pool, { ...this.filters, statuses: [], genres: [], lists: [] });
      const statuses = [...new Set(pool2.map((e) => e.status))].filter(Boolean).sort();
      if (statuses.length > 1) {
        const row = section("Status");
        for (const s of statuses) {
          many(row, s, this.filters.statuses, s, pool2.filter((e) => matchesStatus(e, s)).length);
        }
      }
      const genres = [...new Set(pool2.flatMap((e) => e.genres))].filter(Boolean).sort();
      if (genres.length > 1) {
        const row = section("Genre");
        for (const g of genres)
          many(row, g, this.filters.genres, g);
      }
      if (this.opts.lists.length) {
        const row = section("Lists");
        for (const name of this.opts.lists)
          many(row, name, this.filters.lists, name);
      }
      if (this.opts.showSort) {
        const sortBox = el.createDiv({ cls: "reel-filter-section" });
        sortBox.createDiv({ cls: "reel-filter-label", text: "Sort" });
        const first = sortBox.createEl("select", { cls: "reel-select dropdown" });
        for (const [value, label] of SORT_OPTIONS)
          first.createEl("option", { value, text: label });
        first.value = this.filters.sort;
        first.addEventListener("change", () => {
          this.filters.sort = first.value;
          this.opts.onChange();
          this.redraw();
        });
        sortBox.createDiv({ cls: "reel-filter-label", text: "Then by" });
        const second = sortBox.createEl("select", { cls: "reel-select dropdown" });
        second.createEl("option", { value: "", text: "\u2014" });
        for (const [value, label] of SORT_OPTIONS) {
          if (value === this.filters.sort || value === "random")
            continue;
          second.createEl("option", { value, text: label });
        }
        second.value = this.filters.sort2;
        second.addEventListener("change", () => {
          this.filters.sort2 = second.value;
          this.opts.onChange();
        });
      }
      el.scrollTop = keepScroll;
      this.paintCount();
    }
    onClose() {
      this.contentEl.empty();
    }
  };

  // src/util/folders.ts
  var ILLEGAL = /[*"\\<>:|?]/;
  function normaliseFolder(raw) {
    return raw.trim().replace(/\\/g, "/").split("/").map((seg) => seg.trim()).filter(Boolean).join("/");
  }
  function folderState(raw, folders, files) {
    const path = normaliseFolder(raw);
    if (!path)
      return { kind: "root" };
    if (ILLEGAL.test(path)) {
      return { kind: "invalid", path, reason: 'A folder name cannot contain * " \\ < > : | or ?' };
    }
    if (path.split("/").some((seg) => seg.startsWith("."))) {
      return { kind: "invalid", path, reason: "Folders starting with a dot are hidden and reserved by Obsidian" };
    }
    if (folders.has(path))
      return { kind: "exists", path };
    if (files.has(path) || files.has(`${path}.md`))
      return { kind: "collides", path };
    return { kind: "new", path };
  }
  function describeFolder(state, fallback) {
    switch (state.kind) {
      case "root":
        return fallback ? { text: `Empty \u2014 Reel will use \u201C${fallback}\u201D`, tone: "info" } : { text: "Empty \u2014 Reel will write to your vault root", tone: "warn" };
      case "exists":
        return { text: "Folder exists", tone: "ok" };
      case "new":
        return { text: "Does not exist yet \u2014 Reel will create it", tone: "info" };
      case "collides":
        return { text: "A note already has this exact name", tone: "warn" };
      case "invalid":
        return { text: state.reason, tone: "warn" };
    }
  }
  function matchFolders(all2, query, limit = 6) {
    const q = normaliseFolder(query).toLowerCase();
    if (!q) {
      return [...all2].sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, limit);
    }
    const hits = rankAgainst(all2, q, limit);
    if (hits.length)
      return hits;
    const tail = q.split("/").pop() ?? "";
    return tail && tail !== q ? rankAgainst(all2, tail, limit) : [];
  }
  function rankAgainst(all2, q, limit) {
    const rank2 = (path) => {
      const p = path.toLowerCase();
      if (p === q)
        return 0;
      if (p.startsWith(q))
        return 1;
      const segs = p.split("/");
      if ((segs[segs.length - 1] ?? "").startsWith(q))
        return 2;
      if (segs.some((s) => s.startsWith(q)))
        return 3;
      if (p.includes(q))
        return 4;
      return 99;
    };
    return all2.map((path) => ({ path, r: rank2(path) })).filter((x) => x.r < 99).sort((a, b) => a.r - b.r || a.path.length - b.path.length || a.path.localeCompare(b.path)).map((x) => x.path).slice(0, limit);
  }

  // src/ai/models.ts
  var SLUG = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)?$/;
  function slugProblem(raw) {
    const slug = raw.trim();
    if (!slug)
      return "Empty \u2014 Reel will use its default model";
    if (/\s/.test(slug))
      return "A model slug has no spaces in it";
    if (/^https?:/i.test(slug))
      return "That looks like a URL. A slug is just vendor/model";
    if (!slug.includes("/"))
      return "Missing the vendor \u2014 slugs look like vendor/model";
    if (slug !== slug.toLowerCase())
      return "Model slugs are lowercase";
    if (!SLUG.test(slug))
      return "That is not the shape of a model slug";
    return null;
  }
  var CURATED = [
    { id: "anthropic/claude-3.5-haiku", why: "Fast, cheap, reliable at structured output" },
    { id: "openai/gpt-4o-mini", why: "Comparable and widely available" },
    { id: "google/gemini-2.0-flash-001", why: "Cheapest of the three" }
  ];
  function formatPrice(perM) {
    if (perM === null)
      return "";
    if (perM === 0)
      return "free";
    const digits = perM < 1 ? 3 : 2;
    return `$${perM.toFixed(digits)}/M`;
  }
  function rankModels(all2, query, limit = 8) {
    const q = query.trim().toLowerCase();
    const cost = (m) => m.prompt === null ? Number.MAX_SAFE_INTEGER : m.prompt;
    const byCost = (a, b) => cost(a) - cost(b) || a.id.localeCompare(b.id);
    if (!q)
      return [...all2].sort(byCost).slice(0, limit);
    const rank2 = (m) => {
      const id = m.id.toLowerCase();
      if (id === q)
        return 0;
      if (id.startsWith(q))
        return 1;
      const [vendor, rest = ""] = id.split("/");
      if (rest.startsWith(q))
        return 2;
      if (vendor.startsWith(q))
        return 3;
      if (id.includes(q) || m.name.toLowerCase().includes(q))
        return 4;
      return 99;
    };
    return all2.map((m) => ({ m, r: rank2(m) })).filter((x) => x.r < 99).sort((a, b) => a.r - b.r || byCost(a.m, b.m)).map((x) => x.m).slice(0, limit);
  }

  // src/util/dailynote.ts
  var ISO_NOTE = /^(\d{4}-\d{2}-\d{2})\.md$/;
  function isoDateOf(path) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const m = ISO_NOTE.exec(name);
    if (!m)
      return null;
    const [y, mo, d] = m[1].split("-").map(Number);
    if (mo < 1 || mo > 12 || d < 1 || d > 31)
      return null;
    return m[1];
  }
  function scanDaily(paths) {
    const out = /* @__PURE__ */ new Map();
    for (const path of paths) {
      const date = isoDateOf(path);
      if (!date)
        continue;
      const cut = path.lastIndexOf("/");
      const folder = cut === -1 ? "" : path.slice(0, cut);
      const prev = out.get(folder);
      if (!prev)
        out.set(folder, { count: 1, latest: date });
      else
        out.set(folder, { count: prev.count + 1, latest: date > prev.latest ? date : prev.latest });
    }
    return out;
  }
  function dailyStatus(folder, scan, today) {
    const clean = folder.replace(/^\/+|\/+$/g, "");
    const tally2 = scan.get(clean);
    const where = clean || "your vault root";
    if (!tally2) {
      return scan.size ? { text: `No notes named YYYY-MM-DD in ${where} \u2014 Reel will never find one`, tone: "warn" } : { text: "No dated notes anywhere in this vault yet", tone: "info" };
    }
    const noun = `${tally2.count} dated note${tally2.count === 1 ? "" : "s"}`;
    if (tally2.latest === today)
      return { text: `${noun} in ${where}, including today's`, tone: "ok" };
    return { text: `${noun} in ${where}, most recent ${tally2.latest}`, tone: "ok" };
  }
  function suggestDailyFolders(scan, limit = 4) {
    return [...scan.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).map(([folder]) => folder).slice(0, limit);
  }
  function previewLine(prefix, example = "Heat (1995)") {
    return `${prefix.trim() || "- Watched"} [[${example}]]`;
  }

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
    connectionHealth: {},
    traktExpires: 0,
    // Only Getting started. Everything else is one tap away and, on a fresh
    // install, none of it is what you came for.
    settingsOpen: ["setup"],
    setupTicks: {},
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
    noteTemplate: "\n## Notes\n\n",
    publishTrakt: false,
    publishMastodon: false,
    mastodonHost: "",
    publishRatings: true,
    publishHashtags: "",
    publishSpoilerDefault: true,
    aiEnabled: false,
    // Cheap, fast, and good enough to sort sixty one-line summaries by how well
    // each answers a sentence, which is the whole of the job. A bigger model
    // costs more per question without ranking a shortlist any better.
    aiModel: "anthropic/claude-3.5-haiku",
    aiShortlist: 60,
    recentAsks: []
  };
  var MODE_LABELS = {
    encrypted: "Encrypted in vault (recommended)",
    session: "Session only \u2014 never written to disk",
    plain: "Plain text in vault (not recommended)"
  };
  var MODE_NOTES = {
    encrypted: "Every key shares one encrypted blob and one passphrase. A prompt per service would be intolerable, and splitting them buys nothing, since whatever can read one can read the rest. Reel asks once, the first time it needs a key after Obsidian starts.",
    session: "Nothing is written to disk. Reel asks for your TMDB key the first time it needs one and forgets it when Obsidian closes, so you enter it again every time you start, on every device.",
    plain: ""
  };
  var ReelSettingTab = class extends PluginSettingTab {
    constructor(app2, plugin2) {
      super(app2, plugin2);
      this.plugin = plugin2;
      /**
       * OpenRouter's model list, once somebody has asked for it.
       *
       * Not persisted. Prices and availability change, and a cached list is
       * exactly the sort of thing that goes quietly wrong months later; fetching
       * it costs one request and only when the button is pressed.
       */
      this.models = null;
      /** What the search box currently holds. Not persisted; a search is a moment. */
      this.query = "";
      /** Set at render time so the filter can ask a card what it is. */
      this.cards = /* @__PURE__ */ new Map();
      this.pendingKeyInput = null;
    }
    /**
     * Ten sections, each collapsible, each saying what it holds.
     *
     * The order is by how often you touch it, not by when it was built: what a
     * new install needs first, then the things that shape your notes, then the
     * opt-in features that reach outside the vault, and last the controls that
     * act rather than remember.
     */
    sections() {
      const s = this.plugin.settings;
      const yes = (on, a, b) => on ? a : b;
      return [
        {
          id: "setup",
          title: "Getting started",
          /*
           * Pinned only while Reel cannot work.
           *
           * A section that refuses to fold has to be earning it every
           * time you open the screen, and "here is how to set up the
           * thing you set up months ago" is not earning it. While the
           * TMDB key is missing nothing else on the screen matters, so
           * it stays; the moment it is in, this becomes an ordinary
           * section you can put away.
           */
          pinned: setupState(this.plugin).blocked,
          keywords: "setup first run guide walkthrough tmdb omdb trakt mastodon openrouter",
          summary: () => {
            const st = setupState(this.plugin);
            if (st.blocked)
              return "Reel needs a TMDB key";
            const half = partialPhrase(st.partial);
            const on = `${st.done.length} of ${FEATURES.length - 1} on`;
            return half ? `Ready \u2014 ${on} \xB7 ${half}` : `Ready \u2014 ${on}`;
          },
          render: (el) => this.renderSetup(el)
        },
        {
          id: "keys",
          title: "API keys",
          keywords: "credentials token secret passphrase encrypt unlock",
          summary: () => {
            const n2 = [...READ_KEYS, ...WRITE_KEYS].filter((k) => this.plugin.credentials.has(k)).length;
            const mode = MODE_LABELS[s.keyMode] ?? s.keyMode;
            if (!n2)
              return "None saved";
            const bad = TESTABLE.filter((id) => s.connectionHealth[id]?.ok === false).length;
            const tail = bad ? ` \xB7 ${bad} failing` : "";
            return `${mode} \xB7 ${n2} ${n2 === 1 ? "service" : "services"}${tail}`;
          },
          render: (el) => this.renderCredentials(el)
        },
        {
          id: "folders",
          title: "Folders",
          keywords: "path vault location posters people",
          summary: () => `${s.filmFolder || "\u2014"} \xB7 ${s.seriesFolder || "\u2014"}`,
          render: (el) => this.renderFolders(el)
        },
        {
          id: "metadata",
          title: "Metadata",
          keywords: "cast crew region language specials people links",
          summary: () => `${s.castLimit} cast \xB7 ${s.region}${yes(s.linkPeople, " \xB7 people linked", "")}`,
          render: (el) => this.renderMetadata(el)
        },
        {
          id: "reviews",
          title: "Reviews",
          keywords: "daily note journal rating prompt template",
          summary: () => `${yes(s.askForReview, "Asks after watching", "Never asks")}${yes(s.linkFromDailyNote, " \xB7 linked from daily notes", "")}`,
          render: (el) => this.renderReviews(el)
        },
        {
          id: "publishing",
          title: "Publishing",
          keywords: "trakt mastodon post public share spoiler hashtags",
          summary: () => {
            const on = [s.publishTrakt && "Trakt", s.publishMastodon && "Mastodon"].filter(Boolean);
            return on.length ? on.join(", ") : "Off \u2014 nothing leaves your vault";
          },
          render: (el) => this.renderPublishing(el)
        },
        {
          id: "ask",
          title: "Ask",
          keywords: "openrouter ai model search recommend natural language",
          summary: () => s.aiEnabled ? s.aiModel : "Off",
          render: (el) => this.renderAsk(el)
        },
        {
          id: "content",
          title: "Content filtering",
          keywords: "warnings triggers certification rating age hide",
          summary: () => {
            const bits = [];
            if (s.hideFlags.length)
              bits.push(`${s.hideFlags.length} hidden`);
            if (s.maxCertification)
              bits.push(`up to ${s.maxCertification}`);
            if (s.hideUnrated)
              bits.push("unrated hidden");
            return bits.length ? bits.join(" \xB7 ") : "Nothing hidden";
          },
          render: (el) => this.renderContent(el)
        },
        {
          id: "behaviour",
          title: "Behaviour",
          keywords: "poster quality cache episodes language template open note",
          summary: () => `${s.posterQuality}${yes(s.downloadPosters, " \xB7 posters saved", "")}${yes(s.cacheResponses, ` \xB7 cache ${s.cacheTtlDays}d`, "")}`,
          render: (el) => this.renderBehaviour(el)
        },
        {
          id: "maintenance",
          title: "Maintenance",
          cls: "is-actions",
          keywords: "rebuild clear cache delete posters index repair",
          summary: () => "Runs immediately \u2014 some of it deletes files",
          render: (el) => this.renderMaintenance(el)
        }
      ];
    }
    display() {
      const { containerEl } = this;
      containerEl.empty();
      containerEl.addClass("reel-settings");
      this.cards.clear();
      this.renderSearch(containerEl);
      for (const spec of this.sections())
        this.renderSection(containerEl, spec);
      this.applyFilter();
    }
    /**
     * The search box.
     *
     * Forty-nine controls is past the point where scrolling is a way of
     * finding things, and it is well past it on a phone. Obsidian's own
     * settings gained a search for the same reason; a plugin with its own tab
     * does not inherit it.
     *
     * Matching is over the rendered text of each row, not over a hand-kept
     * keyword table, so it covers the descriptions too — which is how you find
     * "spoiler" without knowing it lives under Publishing.
     */
    renderSearch(root) {
      const wrap = root.createDiv({ cls: "reel-settings-search" });
      const input = wrap.createEl("input", { cls: "reel-input", type: "search" });
      input.placeholder = "Search settings\u2026";
      input.value = this.query;
      input.setAttr("aria-label", "Search settings");
      input.addEventListener("input", () => {
        this.query = input.value;
        this.applyFilter();
      });
    }
    renderSection(root, spec) {
      const card = root.createDiv({ cls: `reel-settings-section${spec.cls ? ` ${spec.cls}` : ""}` });
      const open = spec.pinned || this.plugin.settings.settingsOpen.includes(spec.id);
      card.toggleClass("is-open", open);
      if (spec.pinned)
        card.addClass("is-pinned");
      const head = card.createEl("button", { cls: "reel-section-head" });
      head.setAttr("aria-expanded", String(open));
      const label = head.createDiv({ cls: "reel-section-label" });
      label.createSpan({ cls: "reel-section-title", text: spec.title });
      label.createSpan({ cls: "reel-section-summary", text: spec.summary() });
      head.createSpan({ cls: "reel-section-chev", text: "\u203A" }).setAttr("aria-hidden", "true");
      const body = card.createDiv({ cls: "reel-section-body" });
      spec.render(body);
      if (spec.pinned)
        head.setAttr("disabled", "true");
      else
        head.addEventListener("click", () => void this.toggleSection(spec, card, head));
      this.cards.set(spec.id, { spec, el: card });
    }
    /**
     * Fold a section, without redrawing the screen.
     *
     * `display()` would be the easy call and it is the wrong one: it rebuilds
     * forty-nine controls and throws away the scroll position, so folding
     * something near the bottom would jump you back to the top — punishing the
     * exact tidying-up the feature exists to allow.
     */
    async toggleSection(spec, card, head) {
      const openIds = new Set(this.plugin.settings.settingsOpen);
      const nowOpen = !openIds.has(spec.id);
      if (nowOpen)
        openIds.add(spec.id);
      else
        openIds.delete(spec.id);
      card.toggleClass("is-open", nowOpen);
      head.setAttr("aria-expanded", String(nowOpen));
      this.plugin.settings.settingsOpen = [...openIds];
      await this.plugin.saveSettings();
    }
    /**
     * Show what matches, hide what does not.
     *
     * Done by toggling classes rather than by re-rendering: a filter that
     * rebuilt the screen on every keystroke would lose focus from the box you
     * are typing into, which is a special kind of unusable.
     *
     * A matching section is forced open regardless of its saved state. Finding
     * a setting and being shown the closed section it is inside would be a
     * search that answers the question and withholds the answer.
     */
    applyFilter() {
      const q = this.query.trim().toLowerCase();
      let hits = 0;
      for (const { spec, el } of this.cards.values()) {
        const rows2 = Array.from(el.querySelectorAll(".setting-item"));
        const head = el.querySelector(".reel-section-head");
        const body = el.querySelector(".reel-section-body");
        const prose = body ? Array.from(body.children).filter(
          (c) => !c.classList.contains("setting-item") && !c.querySelector(".setting-item")
        ) : [];
        if (!q) {
          el.removeClass("is-filtered-out");
          el.removeClass("is-forced-open");
          rows2.forEach((r) => r.removeClass("is-filtered-out"));
          prose.forEach((p) => p.removeClass("is-filtered-out"));
          if (head) {
            const open = spec.pinned || this.plugin.settings.settingsOpen.includes(spec.id);
            head.setAttr("aria-expanded", String(open));
            if (!spec.pinned)
              head.removeAttribute("disabled");
          }
          continue;
        }
        const titled = spec.title.toLowerCase().includes(q);
        const keyed = (spec.keywords ?? "").toLowerCase().includes(q);
        let any = false;
        let hidden = false;
        for (const row of rows2) {
          const hit = titled || (row.textContent ?? "").toLowerCase().includes(q);
          row.toggleClass("is-filtered-out", !hit);
          if (hit)
            any = true;
          else
            hidden = true;
        }
        if (!any && keyed) {
          rows2.forEach((r) => r.removeClass("is-filtered-out"));
          hidden = false;
        }
        for (const p of prose)
          p.toggleClass("is-filtered-out", hidden);
        const show = any || titled || keyed;
        el.toggleClass("is-filtered-out", !show);
        el.toggleClass("is-forced-open", show);
        if (show)
          hits++;
        if (head) {
          head.setAttr("aria-expanded", String(show));
          head.setAttr("disabled", "true");
        }
      }
      this.renderNoMatches(q, hits);
    }
    /**
     * Say when a search found nothing.
     *
     * Without this the screen goes blank below the box, which reads as a crash
     * rather than as an answer — and "no results" is a perfectly good answer
     * that deserves saying out loud.
     */
    renderNoMatches(q, hits) {
      const host = this.containerEl.querySelector(".reel-settings-search");
      host?.querySelector(".reel-settings-empty")?.remove();
      if (!q || hits > 0)
        return;
      host?.createDiv({ cls: "reel-settings-empty", text: `Nothing in settings matches \u201C${q}\u201D.` });
    }
    /** The live content policy, read by every surface that lists titles. */
    get policy() {
      return {
        hideFlags: this.plugin.settings.hideFlags,
        maxCertification: this.plugin.settings.maxCertification,
        hideUnrated: this.plugin.settings.hideUnrated
      };
    }
    /* ---------------------------------------------------------------- */
    /**
     * Getting started — the section that answers "what do I do first".
     *
     * Everything below it is a preference. This one is a checklist, and it is
     * built out of plain markup rather than `Setting` rows on purpose: a
     * settings row says "here is a choice, make it", and none of these are
     * choices. They are six things that are either done or not.
     *
     * The distinction it draws that nothing drew before is between *off because
     * you decided against it* and *off because you never got round to it*. Both
     * used to render as an empty field. One is a finished state and the other
     * is an unfinished one, and telling them apart is most of what "seamless
     * first-run setup" actually means.
     */
    renderSetup(el) {
      const state = setupState(this.plugin);
      if (state.blocked) {
        const stop = el.createDiv({ cls: "reel-setup-blocked" });
        stop.createDiv({ cls: "reel-setup-blocked-title", text: "Reel needs one key before it can do anything" });
        stop.createDiv({
          cls: "reel-setup-blocked-body",
          text: "TMDB supplies every poster, cast list and runtime in the plugin. It is free and takes about two minutes. Everything else on this screen is optional."
        });
        const go = stop.createEl("button", { cls: "reel-btn mod-cta", text: "Set up TMDB" });
        go.addEventListener("click", () => this.openGuide(state.essential));
      } else {
        const on = state.done.length;
        const total = FEATURES.length - 1;
        const line = el.createDiv({ cls: "reel-setup-ready" });
        line.createSpan({ cls: "reel-pill ok", text: "Ready" });
        const half = partialPhrase(state.partial);
        line.createSpan({
          cls: "reel-setup-ready-text",
          text: (on === 0 ? `Reel works. ${total} optional features are available below.` : `Reel works, with ${on} of ${total} optional features on.`) + // Said second because it is the exception, and said at all
          // because a feature a few minutes from working is not the
          // same as one nobody has touched.
          (half ? ` ${half}.` : "")
        });
      }
      const anyMark = FEATURES.some((f) => isConfigured(this.plugin, f) || isPartial(this.plugin, f));
      const list2 = el.createDiv({ cls: `reel-setup-list${anyMark ? "" : " is-fresh"}` });
      for (const spec of FEATURES) {
        if (state.blocked && spec.essential)
          continue;
        this.renderSetupRow(list2, spec);
      }
      el.createDiv({
        cls: "reel-settings-note",
        text: "Each guide opens the pages you need, takes the key in the guide itself, and can check it works before you leave. Every one says what leaves your vault before you commit to anything."
      });
    }
    /**
     * One feature, as a row you tap.
     *
     * The row is a `<button>` rather than a div containing one. The first
     * version gave every feature its own "Set up" control, which rendered as
     * six full-width accent buttons stacked down a phone screen — a wall of
     * identical calls to action, none of which could be more important than
     * any other because they all looked the same. It passed every check in the
     * audit and was obviously wrong in the first screenshot.
     *
     * The whole row being the target also means the touch area is the size of
     * the thing you are aiming at, which on a phone is the only sane answer.
     */
    renderSetupRow(list2, spec) {
      const done = isConfigured(this.plugin, spec);
      const part = isPartial(this.plugin, spec);
      const health = this.featureHealth(spec);
      const sick = done && health?.tone === "warn";
      const row = list2.createEl("button", { cls: "reel-setup-row" });
      if (done)
        row.addClass("is-done");
      if (part)
        row.addClass("is-partial");
      if (sick)
        row.addClass("is-unhealthy");
      if (spec.essential)
        row.addClass("is-essential");
      row.setAttr(
        "aria-label",
        `${spec.name}. ${sick ? health?.text : done ? "Set up." : part ? "Half done." : "Not set up."} Open the guide.`
      );
      const mark = row.createSpan({ cls: "reel-setup-mark" });
      mark.setText(sick ? "!" : done ? "\u2713" : part ? "!" : "");
      mark.setAttr("aria-hidden", "true");
      const body = row.createDiv({ cls: "reel-setup-row-body" });
      const top = body.createDiv({ cls: "reel-setup-row-top" });
      top.createSpan({ cls: "reel-setup-row-name", text: spec.name });
      if (part)
        top.createSpan({ cls: "reel-pill warn", text: "Half done" });
      else if (!done && spec.essential)
        top.createSpan({ cls: "reel-pill warn", text: "Required" });
      if (!done) {
        body.createDiv({ cls: "reel-setup-row-gives", text: spec.gives });
        body.createDiv({ cls: "reel-setup-row-effort", text: spec.effort });
      }
      if (sick && health)
        body.createDiv({ cls: "reel-setup-row-warn", text: health.text });
      const chev = row.createSpan({ cls: "reel-setup-chev", text: "\u203A" });
      chev.setAttr("aria-hidden", "true");
      row.addEventListener("click", () => this.openGuide(spec));
    }
    /**
     * Redraw after the guide closes.
     *
     * A key can be saved from inside the sheet's steps, and coming back to a
     * checklist still claiming you have not started is exactly the kind of
     * small lie that makes a settings screen feel dead.
     */
    openGuide(spec) {
      new SetupSheet(this.app, this.plugin, spec, () => this.display()).open();
    }
    /* ---------------------------------------------------------------- */
    renderCredentials(el) {
      const store = this.plugin.credentials;
      const sealed = store.needsUnlock && store.hasStoredKey;
      const dataPath = `${this.app.vault.configDir ?? ".obsidian"}/plugins/reel/data.json`;
      const nothingToTest = !sealed && !TESTABLE.some((id) => checkable(this.plugin, id));
      const status = el.createDiv({ cls: "reel-key-status" });
      const describe2 = () => {
        status.empty();
        const s = this.plugin.settings;
        if (s.keyMode === "session") {
          status.createSpan({
            cls: store.isUnlocked ? "reel-pill ok" : "reel-pill",
            text: store.isUnlocked ? "Keys held for this session" : "No keys this session"
          });
        } else if (s.keyBlob) {
          status.createSpan({
            cls: store.isUnlocked ? "reel-pill ok" : "reel-pill",
            text: store.isUnlocked ? "Unlocked" : "Encrypted \u2014 locked"
          });
        } else if (s.keysPlain && Object.keys(s.keysPlain).length) {
          status.createSpan({ cls: "reel-pill warn", text: "Plain text on disk" });
        } else {
          status.createSpan({ cls: "reel-pill warn", text: "No keys set" });
        }
        for (const name of [...READ_KEYS, ...WRITE_KEYS]) {
          if (store.has(name))
            status.createSpan({ cls: "reel-pill ok", text: KEY_LABELS[name] });
        }
      };
      describe2();
      if (sealed) {
        new Setting(el).setName("Unlock keys").setDesc(
          "Nothing can be tested or fetched until the keys are readable. One passphrase unlocks all of them, and Reel holds them until you quit Obsidian or press Lock."
        ).addButton(
          (b) => b.setButtonText("Unlock").setCta().onClick(async () => {
            b.setDisabled(true).setButtonText("Unlocking\u2026");
            const opened = await this.plugin.credentials.unlock();
            new Notice(opened ? "Reel: keys unlocked." : "Reel: keys stay locked.");
            this.display();
          })
        );
      }
      new Setting(el).setName("Key storage").setDesc(
        "Where Reel keeps your keys. Note that Trakt and Mastodon are different in kind from the others: those can post publicly as you."
      ).addDropdown((d) => {
        Object.keys(MODE_LABELS).forEach((m) => d.addOption(m, MODE_LABELS[m]));
        d.setValue(this.plugin.settings.keyMode).onChange(async (value) => {
          const next = value;
          if (next === "plain" && this.plugin.settings.keyMode !== "plain") {
            const ok = await confirm(this.app, {
              title: "Write your keys in plain text?",
              body: `Every saved key is written readably into ${dataPath}. Anything that can read the vault can read them: sync, backups, another plugin, anyone you share the folder with. Reel can encrypt them again later, but a key that has been on disk in the clear is best treated as exposed and replaced at the service that issued it.`,
              confirmText: "Write in plain text",
              danger: true
            });
            if (!ok) {
              d.setValue(this.plugin.settings.keyMode);
              return;
            }
          }
          await this.plugin.credentials.migrateTo(next);
          this.display();
        });
      });
      const mode = this.plugin.settings.keyMode;
      el.createDiv({
        cls: mode === "plain" ? "reel-callout warn" : "reel-callout",
        text: mode === "plain" ? `Plain text mode writes your keys readably into ${dataPath}. If this vault is synced to git or a shared drive, treat them as public.` : MODE_NOTES[mode]
      });
      const keyField2 = (name, label, desc) => this.keyField(el, name, label, desc);
      keyField2(
        "tmdb",
        "TMDB key or read access token",
        "Required. A v4 read access token (starts with eyJ) is preferred \u2014 it travels in an Authorization header rather than the URL, so it can't end up in a log."
      );
      keyField2(
        "omdb",
        "OMDb key",
        "Optional. Adds IMDb rating, Rotten Tomatoes and Metacritic. Free tier is 1,000 requests a day, which the response cache makes ample. omdbapi.com/apikey.aspx"
      );
      keyField2(
        "dtdd",
        "DoesTheDogDie key",
        "Optional, and the best available answer to content filtering \u2014 community votes per topic, so you can tell one scene from constant. Request a free key at doesthedogdie.com/api."
      );
      new Setting(el).setName("Enrich new notes automatically").setDesc("Fetch OMDb scores and DoesTheDogDie topics after adding a title. Runs after the note is written, so a slow service never delays it.").addToggle(
        (t) => t.setValue(this.plugin.settings.enrich).onChange(async (v) => {
          this.plugin.settings.enrich = v;
          await this.plugin.saveSettings();
        })
      );
      const health = el.createDiv({ cls: "reel-health" });
      const drawHealth = () => {
        health.empty();
        const now = Date.now();
        const inputs = this.healthInputs();
        for (const id of TESTABLE) {
          const rec = this.plugin.settings.connectionHealth[id];
          if (!rec && !store.has(id))
            continue;
          const said = featureHealth(id, inputs, now) ?? describeHealth(rec, true, now);
          const row = health.createDiv({ cls: `reel-health-row is-${said.tone}` });
          row.createSpan({ cls: "reel-health-name", text: KEY_LABELS[id] ?? id });
          row.createSpan({ cls: "reel-health-said", text: said.text });
        }
      };
      new Setting(el).setName("Test connections").setDesc(
        nothingToTest ? "Nothing to test yet. Save a key above and this will check it against the service." : sealed ? "One small request per configured service. The keys are locked, so this asks for the passphrase first." : "One small request per configured service, so a mistyped key fails here rather than silently."
      ).addButton((b) => {
        b.setDisabled(nothingToTest);
        return b.setButtonText(sealed ? "Unlock and test" : "Test").onClick(async () => {
          const label = sealed ? "Unlock and test" : "Test";
          b.setDisabled(true).setButtonText(sealed ? "Unlocking\u2026" : "Testing\u2026");
          if (sealed && !await this.plugin.credentials.unlock()) {
            new Notice("Reel: keys stay locked, so nothing was tested.");
            b.setDisabled(false).setButtonText(label);
            return;
          }
          b.setButtonText("Testing\u2026");
          await this.runTests();
          if (sealed) {
            this.display();
            return;
          }
          b.setDisabled(false).setButtonText(label);
          drawHealth();
          describe2();
        });
      });
      el.appendChild(health);
      drawHealth();
      if (this.plugin.settings.keyMode === "encrypted" && store.isUnlocked) {
        new Setting(el).setName("Lock now").setDesc("Forget the decrypted keys until the next unlock.").addButton(
          (b) => b.setButtonText("Lock").onClick(() => {
            store.lock();
            new Notice("Reel: keys locked.");
            this.display();
          })
        );
      }
      if (this.plugin.settings.keyMode === "encrypted" && this.plugin.settings.keyBlob) {
        new Setting(el).setName("Change passphrase").setDesc(
          "Asks for your current passphrase, then seals the same keys with a new one. The keys themselves are unchanged, so nothing needs re-issuing. Forgotten the current one? Nothing here can recover it \u2014 remove every key below and enter them again."
        ).addButton(
          (b) => b.setButtonText("Change").onClick(async () => {
            b.setDisabled(true);
            let outcome;
            try {
              outcome = await store.changePassphrase();
            } catch (e) {
              new Notice(`Reel: ${redact(e)} Your keys are unchanged, and the old passphrase still works.`);
              b.setDisabled(false);
              return;
            }
            b.setDisabled(false);
            if (outcome === "changed") {
              new Notice("Reel: passphrase changed. Your keys are unlocked for this session.");
              this.display();
              return;
            }
            if (outcome === "wrong-passphrase") {
              new Notice("Reel: that passphrase didn't unlock the keys, so nothing was changed.");
              return;
            }
            if (outcome === "cancelled")
              new Notice("Reel: passphrase unchanged.");
          })
        );
      }
      if (store.hasStoredKey) {
        new Setting(el).setName("Remove all keys").setDesc("Deletes every saved key from your vault. Reel cannot recover them; you would need each original key again.").addButton((b) => {
          b.buttonEl.addClass("reel-btn-danger");
          return b.setButtonText("Remove all").onClick(async () => {
            const ok = await confirm(this.app, {
              title: "Remove every stored key",
              body: "All saved keys are deleted and cannot be recovered. You would need each original key again.",
              confirmText: "Remove all",
              danger: true
            });
            if (!ok)
              return;
            await store.clear();
            new Notice("Reel: keys removed.");
            this.display();
          });
        });
      }
    }
    /* ---------------------------------------------------------------- */
    /**
     * One credential: a password field, a Save, and a Remove once there is
     * something to remove.
     *
     * A method rather than the closure it used to be inside the API-keys
     * section, because publishing needs exactly the same control and a second
     * copy of it would be a second place for the Remove confirmation to go
     * missing, or for "paste to replace" to quietly stop being true.
     */
    /**
     * Delegated to `ui/fields`, which the setup guides also use.
     *
     * These were private methods here, which is why every guide could tell you
     * to paste a key "below" and have nothing below it — the field could not
     * be drawn anywhere but on this screen.
     */
    keyField(el, name, label, desc) {
      keyField(el, this.fieldCtx(), name, label, desc, { remove: true });
    }
    fieldCtx() {
      return { app: this.app, plugin: this.plugin, onChanged: () => this.display() };
    }
    /* ---------------------------------------------------------------- */
    /**
     * Publishing \u2014 the only part of Reel that writes outside your vault.
     *
     * Written to be read before it is used, which is unusual for a settings
     * section and correct for this one. The copy says what leaves, where it
     * goes and under whose name, because switching this on is agreeing to
     * something you cannot take back, and a toggle labelled "Trakt" with no
     * further explanation is not an informed decision.
     *
     * IMDb is named explicitly. It is what people ask for, it is not possible,
     * and leaving that unsaid means everyone who wants it goes hunting through
     * the settings for an option that was never there.
     */
    renderPublishing(el) {
      el.createDiv({
        cls: "reel-settings-note",
        text: "Reviews stay in your vault unless you publish one, one at a time, from the button beside it. Nothing here posts automatically, and nothing posts without showing you the exact text first."
      });
      el.createDiv({
        cls: "reel-settings-note reel-dim",
        text: "IMDb isn't an option: it has no public way to post a review, and the only alternative would be driving a login and a form as you, which Reel won't do. Trakt is the closest equivalent with a real API \u2014 a public profile carrying ratings and reviews."
      });
      new Setting(el).setName("Trakt").setDesc("A public film and TV profile. Reviews post as comments, with your star rating alongside.").addToggle(
        (t) => t.setValue(this.plugin.settings.publishTrakt).onChange(async (v) => {
          this.plugin.settings.publishTrakt = v;
          await this.plugin.saveSettings();
          this.display();
        })
      );
      if (this.plugin.settings.publishTrakt)
        this.renderTraktApp(el);
      new Setting(el).setName("Mastodon").setDesc("One public post per review, with the title, your stars and the text.").addToggle(
        (t) => t.setValue(this.plugin.settings.publishMastodon).onChange(async (v) => {
          this.plugin.settings.publishMastodon = v;
          await this.plugin.saveSettings();
          this.display();
        })
      );
      if (this.plugin.settings.publishMastodon) {
        new Setting(el).setName("Instance").setDesc("The server you post from, e.g. mastodon.social. Not a secret, so it isn't encrypted.").addText(
          (t) => t.setPlaceholder("mastodon.social").setValue(this.plugin.settings.mastodonHost).onChange(
            debounce(async (v) => {
              this.plugin.settings.mastodonHost = normaliseHost(v);
              await this.plugin.saveSettings();
            }, 500)
          )
        );
        this.keyField(
          el,
          "mastodon",
          "Access token",
          "Your instance \u2192 Preferences \u2192 Development \u2192 New application. Tick write:statuses; nothing else is needed."
        );
      }
      if (!this.plugin.publish.anyEnabled)
        return;
      el.createDiv({
        cls: "reel-settings-note reel-dim",
        text: "There's no switch to skip the confirmation. Publishing is the one thing Reel does that can't be undone, so the sheet showing you the exact text is the feature rather than a step in front of it."
      });
      new Setting(el).setName("Publish ratings too").setDesc("Send the star rating to Trakt with the review. Your stars appear in the Mastodon text either way.").addToggle(
        (t) => t.setValue(this.plugin.settings.publishRatings).onChange(async (v) => {
          this.plugin.settings.publishRatings = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Assume spoilers").setDesc(
        "Start each review marked as spoilers. Trakt requires the declaration either way, and on Mastodon it goes behind a content warning."
      ).addToggle(
        (t) => t.setValue(this.plugin.settings.publishSpoilerDefault).onChange(async (v) => {
          this.plugin.settings.publishSpoilerDefault = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Hashtags").setDesc("Added to the end of a Mastodon post. Reserved out of the character budget, so they never get cut.").addText(
        (t) => t.setPlaceholder("#film #tv").setValue(this.plugin.settings.publishHashtags).onChange(
          debounce(async (v) => {
            this.plugin.settings.publishHashtags = v.trim();
            await this.plugin.saveSettings();
          }, 500)
        )
      );
    }
    /**
     * Your own Trakt application, and then the sign-in that uses it.
     *
     * You register the app rather than Reel shipping one, and the reason is
     * worth stating in the UI as well as here: Trakt's device flow needs a
     * client secret, and a secret compiled into an open-source plugin is
     * printed in the repository for anyone to read. Shipping one and calling it
     * secret would be theatre. Yours stays yours, in the same encrypted store
     * as every other key.
     */
    renderTraktApp(el) {
      const store = this.plugin.credentials;
      const hasApp = store.has("traktApp");
      const signedIn = store.has("trakt");
      if (!hasApp) {
        el.createDiv({
          cls: "reel-settings-note",
          text: "Trakt needs an application of your own: trakt.tv/oauth/applications \u2192 New Application. Any name will do, and set the redirect URI to urn:ietf:wg:oauth:2.0:oob. Then paste its client ID and secret below."
        });
      }
      traktAppField(el, this.fieldCtx(), { remove: true });
      if (!hasApp)
        return;
      const now = Date.now();
      const session = traktState(signedIn, this.plugin.settings.traktExpires, now);
      const check = this.plugin.settings.connectionHealth.trakt;
      const said = describeTrakt(session, now, check);
      const refused = signedIn && check?.ok === false;
      const dead = session.kind === "expired" || refused;
      const signIn = async () => {
        const app2 = await this.plugin.publish.app();
        if (!app2) {
          new Notice("Reel: couldn't read the Trakt application.");
          return;
        }
        new TraktSignIn(this.app, this.plugin, app2, (ok) => {
          if (ok)
            this.display();
        }).open();
      };
      const trakt = new Setting(el).setName(
        refused ? "Trakt refused this token" : dead ? "Trakt session expired" : signedIn ? "Signed in to Trakt" : "Sign in to Trakt"
      ).setDesc(
        signedIn ? `${said.text}. Reel can post reviews and ratings as you; sign out to stop that immediately.` : "Trakt shows you a short code to type on any device. Nothing has to link back to this app."
      );
      if (dead || !signedIn) {
        trakt.addButton((b) => b.setButtonText(dead ? "Sign in again" : "Sign in").setCta().onClick(signIn));
      }
      if (signedIn) {
        trakt.addButton(
          (b) => b.setButtonText("Sign out").onClick(async () => {
            await this.plugin.publish.signOut();
            new Notice("Reel: signed out of Trakt.");
            this.display();
          })
        );
      }
    }
    /**
     * Ask \u2014 the one feature that sends your library somewhere else.
     *
     * The copy says exactly what goes and what doesn't, in the same words as
     * the sheet, and it sits above the toggle rather than under it. "Titles,
     * years, genres, runtimes and your ratings" is a specific enough claim to
     * be checked against the code; "some data about your library" would not be.
     */
    renderAsk(el) {
      el.createDiv({
        cls: "reel-settings-note",
        text: "Describe what you feel like watching and Reel finds it in your own library. A question sends your words, plus a short list of titles \u2014 names, years, genres, runtimes and your star ratings \u2014 to OpenRouter. Not your reviews, not your watch dates, not your file paths."
      });
      new Setting(el).setName("Enable Ask").setDesc("Off by default. With this off, no request is ever made, key or no key.").addToggle(
        (t) => t.setValue(this.plugin.settings.aiEnabled).onChange(async (v) => {
          this.plugin.settings.aiEnabled = v;
          await this.plugin.saveSettings();
          this.display();
        })
      );
      if (!this.plugin.settings.aiEnabled)
        return;
      this.keyField(
        el,
        "openrouter",
        "OpenRouter key",
        "From openrouter.ai/keys. You pay OpenRouter directly; Reel shows what each question cost in tokens."
      );
      this.modelField(el);
      new Setting(el).setName("Shortlist size").setDesc(
        "How many titles get sent for ranking. Larger casts a wider net and costs more per question; the filtering that chooses them runs over your whole library either way."
      ).addSlider(
        (sl) => sl.setLimits(20, 150, 10).setValue(this.plugin.settings.aiShortlist).setDynamicTooltip().onChange(async (v) => {
          this.plugin.settings.aiShortlist = v;
          await this.plugin.saveSettings();
        })
      );
      if (this.plugin.settings.recentAsks.length) {
        new Setting(el).setName("Forget past questions").setDesc(`${this.plugin.settings.recentAsks.length} remembered, shown as shortcuts in the Ask sheet.`).addButton(
          (b) => b.setButtonText("Forget").onClick(async () => {
            this.plugin.settings.recentAsks = [];
            await this.plugin.saveSettings();
            this.display();
          })
        );
      }
    }
    /* ---------------------------------------------------------------- */
    renderFolders(el) {
      const films = this.plugin.library.films().length;
      const shows = this.plugin.library.shows().length;
      el.createDiv({
        cls: "reel-key-status",
        text: films + shows === 0 ? "No titles indexed yet." : `Indexing ${films} film${films === 1 ? "" : "s"} and ${shows} series.`
      });
      this.folderField(el, "filmFolder", "Films folder", "One note per film.");
      this.folderField(el, "seriesFolder", "Series folder", "One note per show \u2014 not per season or episode.");
      this.folderField(el, "posterFolder", "Poster folder", "Shared by films and series.");
      this.folderField(
        el,
        "peopleFolder",
        "People folder",
        "Where director and cast links point. Naming the folder explicitly is what stops person notes appearing in your vault root when you tap an unresolved link."
      );
      el.createDiv({
        cls: "reel-callout",
        text: "Everything Reel writes lives under these four folders and its own plugin folder. It never creates notes anywhere else \u2014 the daily-note link, if you turn it on, only appends to a note you already have."
      });
    }
    /**
     * Every folder in the vault, and every file, as two sets.
     *
     * Read once per render rather than per keystroke. A vault of ten thousand
     * notes is a list of ten thousand strings, and rebuilding it on every
     * character typed into a folder box is the kind of cost that does not show
     * up until somebody with a real vault tries it.
     */
    vaultIndex() {
      const folders = /* @__PURE__ */ new Set();
      const files = /* @__PURE__ */ new Set();
      const loaded = this.app.vault.getAllLoadedFiles();
      for (const f of loaded ?? []) {
        if (!f?.path || f.path === "/")
          continue;
        if ("children" in f)
          folders.add(f.path);
        else
          files.add(f.path);
      }
      return { folders, files, all: [...folders] };
    }
    /**
     * A folder setting that says what it is looking at.
     *
     * These four fields are the only place on this screen where being wrong is
     * silent. A bad API key errors the moment it is used; a bad folder simply
     * becomes a folder, and Reel goes on working perfectly while writing
     * somewhere you are not looking. The symptom surfaces weeks later as "my
     * films have stopped appearing", reported as a bug in the library.
     *
     * It cannot be validated away, because "I mistyped Movies" and "I want a
     * folder that does not exist yet" are the same keystrokes, and the second
     * is a legitimate thing to do. So the field does the two things it honestly
     * can: say which of those two situations it is in, and offer the folders
     * you already have, so the typo never has to be typed.
     */
    folderField(el, key, name, desc) {
      const vault = this.vaultIndex();
      const wrap = el.createDiv({ cls: "reel-folder-field" });
      let input = null;
      const apply = debounce(
        async (v) => {
          this.plugin.settings[key] = normaliseFolder(v) || DEFAULT_SETTINGS[key];
          await this.plugin.saveSettings();
          this.plugin.library.rebuild();
        },
        600,
        true
      );
      const status = document.createElement("div");
      const list2 = document.createElement("div");
      list2.className = "reel-folder-suggest";
      const refresh = (raw) => {
        const state = folderState(raw, vault.folders, vault.files);
        const said = describeFolder(state, DEFAULT_SETTINGS[key]);
        status.setText(said.text);
        status.className = `reel-folder-status is-${said.tone}`;
        list2.empty();
        const offer = state.kind === "new" || state.kind === "root" || state.kind === "collides";
        const here = normaliseFolder(raw);
        let hits = offer ? matchFolders(vault.all, raw).filter((path) => path !== here) : [];
        if (offer && !hits.length) {
          hits = matchFolders(vault.all, "").filter((path) => path !== here);
          const preferred = DEFAULT_SETTINGS[key];
          if (hits.includes(preferred))
            hits = [preferred, ...hits.filter((path) => path !== preferred)];
        }
        for (const path of hits) {
          const b = list2.createEl("button", { cls: "reel-folder-chip", text: path });
          b.setAttr("aria-label", `Use folder ${path}`);
          b.addEventListener("click", () => {
            if (input)
              input.value = path;
            refresh(path);
            apply(path);
          });
        }
      };
      new Setting(wrap).setName(name).setDesc(desc).addText((t) => {
        t.setValue(this.plugin.settings[key]).onChange((v) => {
          refresh(v);
          apply(v);
        });
        t.inputEl.addClass("reel-input");
        t.inputEl.spellcheck = false;
        input = t.inputEl;
      });
      const extra2 = wrap.createDiv({ cls: "reel-folder-extra" });
      extra2.appendChild(status);
      extra2.appendChild(list2);
      refresh(this.plugin.settings[key]);
    }
    /**
     * Check every configured service and write down what happened.
     *
     * Only the three that have a real test. OpenRouter, Trakt and Mastodon are
     * deliberately absent rather than faked: reporting "not checked" about them
     * is true, and inventing a request per service so the row has something to
     * say would be three new network calls written to make a screen look
     * complete.
     *
     * Errors go through `redact` even though the clients redact their own,
     * because an error message can carry a request URL and a request URL can
     * carry the key — and this one gets *persisted*, which is a longer life
     * than a Notice ever had.
     */
    async runTests() {
      const failed = await checkAll(this.plugin, Date.now());
      new Notice(failed.length ? `Reel: ${failed.length} connection check failed.` : "Reel: all connections working.");
    }
    /**
     * What this feature's connection is currently doing, if anything knows.
     *
     * Trakt is answered from its token's expiry rather than from a test,
     * because that is a question the stored data can answer exactly and a
     * network call could only approximate.
     */
    featureHealth(spec) {
      return featureHealth(spec.id, this.healthInputs(), Date.now());
    }
    /** What the shared router needs, gathered in the one place that has it. */
    healthInputs() {
      return {
        records: this.plugin.settings.connectionHealth,
        hasTrakt: this.plugin.credentials.has("trakt"),
        traktExpires: this.plugin.settings.traktExpires,
        locked: this.plugin.credentials.needsUnlock
      };
    }
    /**
     * The model slug, with something checking it.
     *
     * It was a free-text box. Reel does report a bad slug — the client turns
     * OpenRouter's 404 into "No such model, check it in Settings" — but only
     * once you have typed a question and waited to be refused. The screen where
     * the string was typed, and where the answer would have saved the trip,
     * said nothing at all.
     *
     * Most of what goes wrong is visible in the string: the vendor left off, a
     * pasted URL, a name copied with its capitals. None of that needs the
     * network, and it is checked as you type.
     *
     * What it never claims is that a model does not exist. That is OpenRouter's
     * to say, and a check that guessed would reject every model released after
     * this release.
     */
    modelField(el) {
      const wrap = el.createDiv({ cls: "reel-model-field" });
      let input = null;
      const save = debounce(async (v) => {
        this.plugin.settings.aiModel = v.trim() || DEFAULT_SETTINGS.aiModel;
        await this.plugin.saveSettings();
      }, 500);
      const status = document.createElement("div");
      const list2 = document.createElement("div");
      list2.className = "reel-folder-suggest";
      const source = document.createElement("div");
      source.className = "reel-model-source";
      const refresh = (raw) => {
        const problem = slugProblem(raw);
        source.setText(
          this.models ? `${this.models.length} models from OpenRouter, priced as of this fetch.` : "Reel's own suggestions. Load the list for OpenRouter's full catalogue and current prices."
        );
        status.setText(problem ?? "Looks like a model slug");
        status.className = `reel-folder-status is-${problem ? "warn" : "ok"}`;
        list2.empty();
        const pool2 = this.models ?? CURATED.map((c) => ({ id: c.id, name: c.why, prompt: null, completion: null }));
        const here = raw.trim().toLowerCase();
        const notMe = (m) => m.id.toLowerCase() !== here;
        let hits = rankModels(pool2, raw).filter(notMe);
        if (!hits.length)
          hits = rankModels(pool2, "").filter(notMe);
        for (const m of hits) {
          const price = formatPrice(m.prompt);
          const b = list2.createEl("button", { cls: "reel-folder-chip" });
          const top = b.createDiv();
          top.createSpan({ text: m.id });
          if (price)
            top.createSpan({ cls: "reel-model-price", text: ` \xB7 ${price}` });
          if (m.name && m.name !== m.id)
            b.createDiv({ cls: "reel-model-why", text: m.name });
          b.setAttr("aria-label", `Use ${m.id}${price ? `, ${price} prompt tokens` : ""}`);
          b.addEventListener("click", () => {
            if (input)
              input.value = m.id;
            refresh(m.id);
            save(m.id);
          });
        }
      };
      new Setting(wrap).setName("Model").setDesc(
        "An OpenRouter model slug. The job is ranking sixty one-line summaries, which a small fast model does as well as a large one and far more cheaply."
      ).addText((t) => {
        t.setPlaceholder(DEFAULT_SETTINGS.aiModel).setValue(this.plugin.settings.aiModel).onChange((v) => {
          refresh(v);
          save(v);
        });
        t.inputEl.addClass("reel-input");
        t.inputEl.spellcheck = false;
        input = t.inputEl;
      }).addButton(
        (b) => b.setButtonText(this.models ? "Reload" : "Load list").onClick(async () => {
          b.setDisabled(true).setButtonText("Loading\u2026");
          const got = await this.plugin.ai.models();
          b.setDisabled(false).setButtonText("Reload");
          if (!got.length) {
            new Notice("Reel: couldn't reach OpenRouter's model list.");
            return;
          }
          this.models = got;
          new Notice(`Reel: ${got.length} models available.`);
          refresh(input?.value ?? this.plugin.settings.aiModel);
        })
      );
      const extra2 = wrap.createDiv({ cls: "reel-folder-extra" });
      extra2.appendChild(status);
      extra2.appendChild(source);
      extra2.appendChild(list2);
      refresh(this.plugin.settings.aiModel);
    }
    /**
     * The daily note folder, checked against where the daily notes are.
     *
     * Reel appends to today's daily note if there is one and never creates it,
     * which is deliberate and stays. The gap this closes is one level down:
     * every part of that behaviour hangs on a folder path typed into a box,
     * and nothing checked it against the vault. Point it at "Journal" when
     * yours live in "Daily" and the toggle stays on, nothing errors, and the
     * feature simply never fires — because "no daily note today" and "wrong
     * folder" produce exactly the same silence.
     *
     * They are different situations and the vault knows which one you are in.
     */
    dailyFolderField(el) {
      const scan = scanDaily([...this.vaultIndex().files]);
      const today = todayISO();
      const wrap = el.createDiv({ cls: "reel-folder-field" });
      let input = null;
      const apply = debounce(
        async (v) => {
          this.plugin.settings.dailyNoteFolder = normaliseFolder(v);
          await this.plugin.saveSettings();
        },
        600,
        true
      );
      const status = document.createElement("div");
      const list2 = document.createElement("div");
      list2.className = "reel-folder-suggest";
      const refresh = (raw) => {
        const said = dailyStatus(raw, scan, today);
        status.setText(said.text);
        status.className = `reel-folder-status is-${said.tone}`;
        list2.empty();
        const here = normaliseFolder(raw);
        const hits = said.tone === "warn" ? suggestDailyFolders(scan).filter((f) => f !== here) : [];
        for (const folder of hits) {
          const b = list2.createEl("button", { cls: "reel-folder-chip", text: folder || "(vault root)" });
          b.setAttr("aria-label", `Use ${folder || "the vault root"}`);
          b.addEventListener("click", () => {
            if (input)
              input.value = folder;
            refresh(folder);
            apply(folder);
          });
        }
      };
      new Setting(wrap).setName("Daily note folder").setDesc(
        "Where your daily notes live \u2014 leave empty for the vault root. Files must be named YYYY-MM-DD.md. Reel asks rather than reading the Daily Notes plugin's configuration, which is undocumented API."
      ).addText((t) => {
        t.setPlaceholder("e.g. Journal/Daily").setValue(this.plugin.settings.dailyNoteFolder).onChange((v) => {
          refresh(v);
          apply(v);
        });
        t.inputEl.addClass("reel-input");
        t.inputEl.spellcheck = false;
        input = t.inputEl;
      });
      const extra2 = wrap.createDiv({ cls: "reel-folder-extra" });
      extra2.appendChild(status);
      extra2.appendChild(list2);
      refresh(this.plugin.settings.dailyNoteFolder);
    }
    /**
     * The prefix, with the line it produces shown underneath.
     *
     * Its effect was invisible until the next time you happened to log a film
     * and then went and opened a different note. A preview costs nothing and
     * answers "what will this do" at the moment somebody is asking it.
     */
    dailyPrefixField(el) {
      const wrap = el.createDiv({ cls: "reel-folder-field" });
      const preview2 = document.createElement("div");
      preview2.className = "reel-daily-preview";
      const apply = debounce(
        async (v) => {
          this.plugin.settings.dailyNotePrefix = v || "- Watched";
          await this.plugin.saveSettings();
        },
        600,
        true
      );
      new Setting(wrap).setName("Daily note line prefix").setDesc("What Reel writes in front of the link.").addText((t) => {
        t.setValue(this.plugin.settings.dailyNotePrefix).onChange((v) => {
          preview2.setText(previewLine(v));
          apply(v);
        });
        t.inputEl.addClass("reel-input");
      });
      const extra2 = wrap.createDiv({ cls: "reel-folder-extra" });
      extra2.appendChild(preview2);
      preview2.setText(previewLine(this.plugin.settings.dailyNotePrefix));
    }
    renderMetadata(el) {
      new Setting(el).setName("Link people and use wikilinks").setDesc(
        "Store directors and cast as [[People/Name|Name]] rather than plain text, so they appear in the graph and get backlinks. This is the thing Letterboxd cannot do."
      ).addToggle(
        (t) => t.setValue(this.plugin.settings.linkPeople).onChange(async (v) => {
          this.plugin.settings.linkPeople = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Cast members to keep").setDesc("Top-billed order, as TMDB returns it.").addSlider(
        (s) => s.setLimits(0, 25, 1).setValue(this.plugin.settings.castLimit).onChange(async (v) => {
          this.plugin.settings.castLimit = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Region").setDesc("Drives which certification and streaming providers are stored. Two-letter country code.").addText((t) => {
        const apply = debounce(
          async (v) => {
            const code = v.trim().toUpperCase().slice(0, 2);
            this.plugin.settings.region = /^[A-Z]{2}$/.test(code) ? code : "US";
            await this.plugin.saveSettings();
          },
          600,
          true
        );
        t.setValue(this.plugin.settings.region).onChange((v) => apply(v));
      });
      new Setting(el).setName("Track specials").setDesc("Include season 0 \u2014 Christmas episodes, OVAs, and the like.").addToggle(
        (t) => t.setValue(this.plugin.settings.includeSpecials).onChange(async (v) => {
          this.plugin.settings.includeSpecials = v;
          await this.plugin.saveSettings();
        })
      );
    }
    renderReviews(el) {
      new Setting(el).setName("Ask for a review when logging").setDesc("Adds a review box to the log sheet. Reviews are appended to the note body under a dated heading \u2014 never overwriting what's already there.").addToggle(
        (t) => t.setValue(this.plugin.settings.askForReview).onChange(async (v) => {
          this.plugin.settings.askForReview = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Link from today's daily note").setDesc("Appends a link when you log something. Only if today's daily note already exists \u2014 Reel will not create one.").addToggle(
        (t) => t.setValue(this.plugin.settings.linkFromDailyNote).onChange(async (v) => {
          this.plugin.settings.linkFromDailyNote = v;
          await this.plugin.saveSettings();
        })
      );
      this.dailyFolderField(el);
      this.dailyPrefixField(el);
    }
    renderContent(el) {
      el.createDiv({
        cls: "reel-callout",
        text: "Read this before relying on it. TMDB has no structured content-advisory data. Certification (R, PG-13, TV-MA) comes from a ratings board and is dependable. Flags are inferred from crowd-sourced keywords, so they under-report: no flag means nothing was tagged, not that nothing is there. You can add or remove flags on any note by hand, and a refresh will not undo your edits."
      });
      new Setting(el).setName("Hide titles flagged with").setDesc("Applies across the library, Up Next and search.").setClass("reel-flag-setting");
      const flagRow = el.createDiv({ cls: "reel-flag-row" });
      for (const flag of CONTENT_FLAGS) {
        const chip = flagRow.createEl("button", { cls: "reel-chip", text: FLAG_LABELS[flag] });
        const paint = () => chip.toggleClass("is-active", this.plugin.settings.hideFlags.includes(flag));
        chip.addEventListener("click", async () => {
          const set = new Set(this.plugin.settings.hideFlags);
          if (set.has(flag))
            set.delete(flag);
          else
            set.add(flag);
          this.plugin.settings.hideFlags = [...set];
          await this.plugin.saveSettings();
          paint();
          this.plugin.library.refresh();
        });
        paint();
      }
      new Setting(el).setName("Maximum certification").setDesc("Hide anything rated above this.").addDropdown((d) => {
        d.addOption("", "No limit");
        for (const cert of knownCertifications())
          d.addOption(cert, cert);
        d.setValue(this.plugin.settings.maxCertification ?? "").onChange(async (v) => {
          this.plugin.settings.maxCertification = v || null;
          await this.plugin.saveSettings();
          this.plugin.library.refresh();
        });
      });
      new Setting(el).setName("Also hide unrated titles").setDesc("Strict mode. An unrated title is unknown, not safe \u2014 turn this on if that distinction matters to you.").addToggle(
        (t) => t.setValue(this.plugin.settings.hideUnrated).onChange(async (v) => {
          this.plugin.settings.hideUnrated = v;
          await this.plugin.saveSettings();
          this.plugin.library.refresh();
        })
      );
    }
    renderBehaviour(el) {
      new Setting(el).setName("Rating scale").setDesc("Five stars with halves. Fixed \u2014 the stored numbers and the star widget assume it.").addText((t) => t.setValue("\u2605 0.5 \u2013 5.0").setDisabled(true));
      new Setting(el).setName("Download posters").setDesc("Saves a jpg per title into the poster folder, so the library works offline.").addToggle(
        (t) => t.setValue(this.plugin.settings.downloadPosters).onChange(async (v) => {
          this.plugin.settings.downloadPosters = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Poster size").setDesc("w342 is about 30 KB per title and is what the grid is tuned for.").addDropdown(
        (d) => d.addOptions({ w185: "w185 \u2014 smallest", w342: "w342 \u2014 recommended", w500: "w500 \u2014 sharpest" }).setValue(this.plugin.settings.posterQuality).onChange(async (v) => {
          this.plugin.settings.posterQuality = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Cache TMDB responses").setDesc("On-disk, keyed by id. Keeps repeat opens instant and stays within rate limits.").addToggle(
        (t) => t.setValue(this.plugin.settings.cacheResponses).onChange(async (v) => {
          this.plugin.settings.cacheResponses = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Cache lifetime").setDesc("Days before a cached response is refetched. Ended shows are kept regardless.").addSlider(
        (s) => s.setLimits(1, 90, 1).setValue(this.plugin.settings.cacheTtlDays).onChange(async (v) => {
          this.plugin.settings.cacheTtlDays = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Check for new episodes").setDesc("Once a day, refreshes shows TMDB still marks as returning, to badge them in Up Next.").addToggle(
        (t) => t.setValue(this.plugin.settings.checkNewEpisodes).onChange(async (v) => {
          this.plugin.settings.checkNewEpisodes = v;
          await this.plugin.saveSettings();
        })
      );
      new Setting(el).setName("Open the note after adding").setDesc("Jump straight to a title's note once it is created, instead of staying where you are.").addToggle(
        (t) => t.setValue(this.plugin.settings.openNoteAfterCreate).onChange(async (v) => {
          this.plugin.settings.openNoteAfterCreate = v;
          await this.plugin.saveSettings();
        })
      );
    }
    renderMaintenance(maint) {
      maint.createDiv({
        cls: "reel-setting-note",
        text: "These run straight away rather than changing a preference. The ones that remove files move them to the trash, and ask first."
      });
      new Setting(maint).setName("Dismissed suggestions").setDesc("Titles you marked 'not interested' in Discover. Clearing brings them back.").addButton(
        (b) => b.setButtonText(`Clear ${this.plugin.settings.dismissedIds.length}`).setDisabled(this.plugin.settings.dismissedIds.length === 0).onClick(async () => {
          this.plugin.settings.dismissedIds = [];
          await this.plugin.saveSettings();
          new Notice("Reel: dismissed suggestions cleared.");
          this.display();
        })
      );
      const posterCount = this.plugin.library.all().filter((e) => !!e.poster).length;
      new Setting(maint).setName("Posters").setDesc(`${posterCount} title${posterCount === 1 ? "" : "s"} have a cached poster.`).addButton(
        (b) => b.setButtonText("Download missing").onClick(async () => {
          const n2 = await this.plugin.posters.backfill();
          if (n2 < 0) {
            new Notice("Reel: stopping after the current poster.");
            return;
          }
          new Notice(`Reel: cached ${n2} poster${n2 === 1 ? "" : "s"}.`);
          this.display();
        })
      ).addButton(
        (b) => b.setButtonText("Remove unused").onClick(async () => {
          await this.plugin.prunePosters();
          this.display();
        })
      );
      new Setting(maint).setName("Clear cached responses").setDesc("Metadata Reel has already fetched. Clearing costs requests, not data \u2014 everything refetches on demand.").addButton(
        (b) => b.setButtonText("Clear").onClick(async () => {
          const n2 = await this.plugin.tmdb.clearCache();
          new Notice(`Reel: cleared ${n2} cached response${n2 === 1 ? "" : "s"}.`);
        })
      );
    }
  };

  // src/publish/index.ts
  var BLOCKERS = {
    traktApp: "No Trakt application yet \u2014 tap to set up.",
    traktSignIn: "Not signed in to Trakt \u2014 tap to sign in.",
    mastodonHost: "No Mastodon server set \u2014 tap to set up.",
    mastodonToken: "No Mastodon access token \u2014 tap to set up."
  };

  // src/ai/find.ts
  var EMPTY_CRITERIA = {
    pool: "any",
    type: "any",
    genres: [],
    excludeGenres: [],
    yearFrom: null,
    yearTo: null,
    minRuntime: null,
    maxRuntime: null,
    minRating: null,
    keywords: [],
    restated: ""
  };
  function inPool(entry, pool2) {
    if (pool2 === "any")
      return true;
    const seen = hasBeenWatched(entry);
    if (pool2 === "watched")
      return seen;
    return !seen;
  }
  function effectiveRuntime(entry) {
    const value = entry.type === "tv" ? entry.episodeRuntime : entry.runtime;
    return value && value > 0 ? value : void 0;
  }
  function effectiveYear(entry) {
    return entry.type === "tv" ? entry.firstAirYear : entry.year;
  }
  function gates(c) {
    const out = [];
    if (c.minRuntime != null || c.maxRuntime != null) {
      out.push({
        name: "length",
        pass: (e) => {
          const mins = effectiveRuntime(e);
          if (mins == null)
            return true;
          if (c.minRuntime != null && mins < c.minRuntime)
            return false;
          if (c.maxRuntime != null && mins > c.maxRuntime)
            return false;
          return true;
        }
      });
    }
    if (c.yearFrom != null || c.yearTo != null) {
      out.push({
        name: "era",
        pass: (e) => {
          const y = effectiveYear(e);
          if (y == null)
            return true;
          if (c.yearFrom != null && y < c.yearFrom)
            return false;
          if (c.yearTo != null && y > c.yearTo)
            return false;
          return true;
        }
      });
    }
    if (c.minRating != null) {
      out.push({ name: "rating", pass: (e) => (e.rating ?? 0) >= c.minRating });
    }
    if (c.genres.length) {
      const want = c.genres.map(lower);
      out.push({ name: "genre", pass: (e) => e.genres.some((g) => want.includes(lower(g))) });
    }
    return out;
  }
  function shortlist(entries, c, limit) {
    const pool2 = entries.filter((e) => inPool(e, c.pool));
    const typed = c.type === "any" ? pool2 : pool2.filter((e) => e.type === c.type);
    const excluded = c.excludeGenres.length ? typed.filter((e) => {
      const no = c.excludeGenres.map(lower);
      return !e.genres.some((g) => no.includes(lower(g)));
    }) : typed;
    const all2 = gates(c);
    const relaxed = [];
    for (let drop = 0; drop <= all2.length; drop++) {
      const active = all2.slice(drop);
      const kept = excluded.filter((e) => active.every((g) => g.pass(e)));
      if (kept.length || drop === all2.length) {
        const scored = kept.map((e) => ({ e, score: score(e, c) })).sort((a, b) => b.score - a.score || (a.e.title > b.e.title ? 1 : -1));
        return { picked: scored.slice(0, limit).map((s) => s.e), relaxed };
      }
      relaxed.push(all2[drop].name);
    }
    return { picked: [], relaxed };
  }
  function score(entry, c) {
    let n2 = 0;
    const want = c.genres.map(lower);
    for (const g of entry.genres)
      if (want.includes(lower(g)))
        n2 += 3;
    if (c.keywords.length) {
      const hay = [entry.title, ...entry.genres, ...entry.director, ...entry.creators, ...entry.cast.slice(0, 6)].join(" ").toLowerCase();
      for (const k of c.keywords) {
        const word = lower(k);
        if (word.length > 2 && hay.includes(word))
          n2 += 2;
      }
    }
    if (entry.rating)
      n2 += entry.rating * 0.4;
    else if (entry.tmdbRating)
      n2 += entry.tmdbRating * 0.05;
    if (!entry.genres.length)
      n2 -= 1;
    return n2;
  }
  function digest(entry, index) {
    const bits = [];
    const year2 = effectiveYear(entry);
    bits.push(`${index}. ${entry.title}${year2 ? ` (${year2})` : ""}`);
    if (entry.type === "tv")
      bits.push("series");
    if (entry.genres.length)
      bits.push(entry.genres.slice(0, 3).join("/"));
    const mins = effectiveRuntime(entry);
    if (mins)
      bits.push(`${mins}m`);
    const people = entry.type === "tv" ? entry.creators : entry.director;
    if (people.length)
      bits.push(`dir ${people[0]}`);
    if (entry.rating)
      bits.push(`you ${entry.rating}/5`);
    bits.push(hasBeenWatched(entry) ? "seen" : "unseen");
    return bits.join(" \xB7 ");
  }
  function lower(s) {
    return s.trim().toLowerCase();
  }
  var CRITERIA_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: [
      "pool",
      "type",
      "genres",
      "excludeGenres",
      "yearFrom",
      "yearTo",
      "minRuntime",
      "maxRuntime",
      "minRating",
      "keywords",
      "restated"
    ],
    properties: {
      pool: { type: "string", enum: ["watchlist", "watched", "any"] },
      type: { type: "string", enum: ["film", "tv", "any"] },
      genres: { type: "array", items: { type: "string" } },
      excludeGenres: { type: "array", items: { type: "string" } },
      yearFrom: { type: ["integer", "null"] },
      yearTo: { type: ["integer", "null"] },
      minRuntime: { type: ["integer", "null"] },
      maxRuntime: { type: ["integer", "null"] },
      minRating: { type: ["number", "null"] },
      keywords: { type: "array", items: { type: "string" } },
      restated: { type: "string" }
    }
  };
  var PICKS_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["picks"],
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "why"],
          properties: {
            index: { type: "integer" },
            why: { type: "string" }
          }
        }
      }
    }
  };
  var GENRES2 = [
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
    "TV Movie",
    "Thriller",
    "War",
    "Western",
    "Action & Adventure",
    "Kids",
    "News",
    "Reality",
    "Sci-Fi & Fantasy",
    "Soap",
    "Talk",
    "War & Politics"
  ];
  async function readCriteria(client, question, thisYear) {
    const system = [
      "You turn a sentence about what someone feels like watching into filter criteria for their own film and TV library.",
      "",
      `Use only these genre names, spelled exactly: ${GENRES2.join(", ")}.`,
      "",
      "Rules:",
      `- "haven't seen", "something new", "what should I watch" means pool "watchlist". "again", "rewatch", "I loved" means "watched". Otherwise "any".`,
      `- Runtimes are in minutes. "short" is about 100 max for a film, 35 for a series episode. "long" is 150 min.`,
      `- Decades map to year ranges: "the nineties" is 1990 to 1999. "recent" is ${thisYear - 5} onwards.`,
      `- minRating is the person's own 0-5 star rating, and only belongs when they ask for things they rated highly.`,
      "- excludeGenres is for what they say they do NOT want. Read the mood: bleak, heavy or depressing usually means excluding Horror and War, not Drama.",
      "- keywords are extra words worth matching against titles, directors and actors. Leave it empty when there are none. Do not put genres in it.",
      "- Prefer fewer constraints. Every one you add can only remove titles from a library that may be small.",
      `- restated: one short sentence saying what you understood, addressed to them, e.g. "Short comedies you haven't watched yet."`
    ].join("\n");
    const res = await client.json(
      [
        { role: "system", content: system },
        { role: "user", content: question }
      ],
      CRITERIA_SCHEMA,
      "criteria"
    );
    return {
      criteria: sanitise(res.value),
      promptTokens: res.promptTokens ?? 0,
      completionTokens: res.completionTokens ?? 0
    };
  }
  function sanitise(raw) {
    const c = { ...EMPTY_CRITERIA, ...raw ?? {} };
    const pools = ["watchlist", "watched", "any"];
    c.pool = pools.includes(c.pool) ? c.pool : "any";
    const types = ["film", "tv", "any"];
    c.type = types.includes(c.type) ? c.type : "any";
    c.genres = cleanList(c.genres);
    c.excludeGenres = cleanList(c.excludeGenres);
    c.keywords = cleanList(c.keywords).slice(0, 8);
    c.yearFrom = year(c.yearFrom);
    c.yearTo = year(c.yearTo);
    if (c.yearFrom != null && c.yearTo != null && c.yearFrom > c.yearTo) {
      [c.yearFrom, c.yearTo] = [c.yearTo, c.yearFrom];
    }
    c.minRuntime = minutes(c.minRuntime);
    c.maxRuntime = minutes(c.maxRuntime);
    if (c.minRuntime != null && c.maxRuntime != null && c.minRuntime > c.maxRuntime) {
      [c.minRuntime, c.maxRuntime] = [c.maxRuntime, c.minRuntime];
    }
    const r = Number(c.minRating);
    c.minRating = Number.isFinite(r) && r > 0 && r <= 5 ? r : null;
    c.restated = typeof c.restated === "string" ? c.restated.trim().slice(0, 200) : "";
    const wanted2 = c.genres.map(lower);
    c.excludeGenres = c.excludeGenres.filter((g) => !wanted2.includes(lower(g)));
    return c;
  }
  function cleanList(v) {
    if (!Array.isArray(v))
      return [];
    const out = [];
    for (const item of v) {
      const s = String(item ?? "").trim();
      if (s && !out.some((x) => lower(x) === lower(s)))
        out.push(s);
    }
    return out;
  }
  function year(v) {
    const n2 = Number(v);
    if (!Number.isFinite(n2))
      return null;
    return n2 >= 1870 && n2 <= 2200 ? Math.round(n2) : null;
  }
  function minutes(v) {
    const n2 = Number(v);
    if (!Number.isFinite(n2))
      return null;
    return n2 > 0 && n2 <= 1200 ? Math.round(n2) : null;
  }
  async function rank(client, question, criteria, candidates, want) {
    const lines = candidates.map((e, i) => digest(e, i)).join("\n");
    const system = [
      "You are choosing from someone's own film and TV library. Every candidate is numbered.",
      "",
      `Pick at most ${want}, best first, and give one short sentence for each saying why it answers what they asked.`,
      "",
      "Rules:",
      "- Only ever use an index from the list. Never name a title that isn't there.",
      "- If fewer than that genuinely fit, return fewer. A short honest answer beats a padded one.",
      "- The reason must be about this title and their question, not a plot summary and not a restatement of the genre.",
      "- Do not mention indexes, ratings out of five, or the word 'library' in the reasons."
    ].join("\n");
    const user = [
      `They asked: ${question}`,
      criteria.restated ? `Understood as: ${criteria.restated}` : "",
      "",
      "Candidates:",
      lines
    ].filter(Boolean).join("\n");
    const res = await client.json(
      [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      PICKS_SCHEMA,
      "picks"
    );
    const seen = /* @__PURE__ */ new Set();
    const picks = (res.value?.picks ?? []).filter((p) => Number.isInteger(p.index) && p.index >= 0 && p.index < candidates.length).filter((p) => !seen.has(p.index) && (seen.add(p.index), true)).slice(0, want).map((p) => ({ index: p.index, why: String(p.why ?? "").trim() }));
    return {
      picks,
      promptTokens: res.promptTokens ?? 0,
      completionTokens: res.completionTokens ?? 0
    };
  }
  async function ask(client, entries, question, opts) {
    const thisYear = opts.year ?? (/* @__PURE__ */ new Date()).getFullYear();
    const first = await readCriteria(client, question, thisYear);
    const { picked, relaxed } = shortlist(entries, first.criteria, opts.shortlistSize);
    if (!picked.length) {
      return {
        criteria: first.criteria,
        picks: [],
        considered: 0,
        relaxed,
        promptTokens: first.promptTokens,
        completionTokens: first.completionTokens
      };
    }
    const second = await rank(client, question, first.criteria, picked, opts.want ?? 10);
    return {
      criteria: first.criteria,
      picks: second.picks.map((p) => ({ entry: picked[p.index], why: p.why })),
      considered: picked.length,
      relaxed,
      promptTokens: first.promptTokens + second.promptTokens,
      completionTokens: first.completionTokens + second.completionTokens
    };
  }

  // src/ui/askSheet.ts
  var RECENT_LIMIT = 6;
  var AskSheet = class _AskSheet extends Modal {
    constructor(app2, plugin2, onOpenEntry, seed = "") {
      super(app2);
      this.plugin = plugin2;
      this.onOpenEntry = onOpenEntry;
      this.seed = seed;
      this.busy = false;
    }
    onOpen() {
      const { contentEl, modalEl } = this;
      modalEl.addClass("reel-modal");
      if (Platform.isPhone)
        modalEl.addClass("reel-sheet");
      contentEl.addClass("reel-ask");
      contentEl.createEl("h3", { cls: "reel-log-title", text: "Ask" });
      contentEl.createDiv({
        cls: "reel-log-sub",
        text: "Describe what you feel like. Reel searches what's already in your library."
      });
      if (!this.plugin.ai.configured) {
        this.renderUnconfigured(contentEl);
        return;
      }
      this.input = contentEl.createEl("textarea", {
        cls: "reel-ask-input reel-input",
        attr: {
          rows: "3",
          placeholder: "something short and funny I haven't seen, nothing too bleak"
        }
      });
      this.input.value = this.seed;
      this.input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          void this.run();
        }
      });
      this.renderRecent(contentEl);
      this.body = contentEl.createDiv({ cls: "reel-ask-body" });
      const actions = contentEl.createDiv({ cls: "reel-log-actions reel-ask-actions" });
      const cancel = actions.createEl("button", { cls: "reel-btn", text: "Close" });
      cancel.addEventListener("click", () => this.close());
      this.goBtn = actions.createEl("button", { cls: "reel-btn mod-cta", text: "Ask" });
      this.goBtn.addEventListener("click", () => void this.run());
      window.setTimeout(() => this.input.focus(), 40);
      if (this.seed)
        void this.run();
    }
    /**
     * The screen every new install meets when it opens Ask.
     *
     * Two faults lived here, both invisible until it was rendered for the first
     * time, because `configured` was pinned true in the test rig.
     *
     * The first: `configured` is two conditions — a saved key *and* the switch
     * — and this treated it as one. Somebody who had pasted a key and never
     * found the toggle was told Ask needs a key. They had one. That is the
     * 0.9.20 gap arriving one screen later: a saved key reads as set up
     * everywhere in the plugin, and the one screen positioned to catch the
     * difference repeated the wrong half of it.
     *
     * The second: it opened the settings tab. That is the exact fault the
     * walkthroughs were built to fix — the guide has the key field, the switch
     * beside it, the three steps for getting a key, and a check that proves it
     * works before you leave. Sending somebody to hunt for one section among
     * forty-nine controls, from a screen that knows precisely which feature is
     * missing, is losing information on purpose.
     */
    renderUnconfigured(el) {
      const hasKey = this.plugin.credentials.has("openrouter");
      el.createDiv({
        cls: "reel-ask-empty",
        text: hasKey ? "Your OpenRouter key is saved, but Ask is switched off, so no question is ever sent. Turning it on is one toggle \u2014 and while it is on, a question sends a short list of titles from your library: names, years, genres, runtimes and your ratings. No review text, no dates, no file paths." : "Ask needs an OpenRouter key, and it stays off until you add one. When it is on, a question sends a short list of titles from your library \u2014 names, years, genres, runtimes and your ratings \u2014 to OpenRouter. No review text, no dates, no file paths."
      });
      const actions = el.createDiv({ cls: "reel-log-actions" });
      const spec = FEATURES.find((f) => f.id === "openrouter");
      if (!spec)
        return;
      const go = actions.createEl("button", {
        cls: "reel-btn mod-cta",
        text: hasKey ? "Turn Ask on" : "Set up Ask"
      });
      go.addEventListener("click", () => {
        this.close();
        new SetupSheet(this.app, this.plugin, spec, () => {
          if (this.plugin.ai.configured)
            new _AskSheet(this.app, this.plugin, this.onOpenEntry, "").open();
        }).open();
      });
    }
    /**
     * Questions you asked before, as one-tap buttons.
     *
     * A good question here is a reusable one — "something to fall asleep to" is
     * a mood that recurs — and retyping it on a phone every time is exactly the
     * friction that stops a feature from being used.
     */
    renderRecent(el) {
      const recent = this.plugin.settings.recentAsks;
      if (!recent.length)
        return;
      const row = el.createDiv({ cls: "reel-ask-recent" });
      for (const q of recent.slice(0, RECENT_LIMIT)) {
        const chip = row.createEl("button", { cls: "reel-ask-chip", text: q });
        chip.addEventListener("click", () => {
          this.input.value = q;
          void this.run();
        });
      }
    }
    async run() {
      const question = this.input.value.trim();
      if (!question || this.busy)
        return;
      this.busy = true;
      this.goBtn.disabled = true;
      this.goBtn.setText("Thinking\u2026");
      this.body.empty();
      this.renderThinking();
      try {
        const entries = this.plugin.library.all();
        const result = await ask(this.plugin.ai, entries, question, {
          shortlistSize: this.plugin.settings.aiShortlist
        });
        await this.remember(question);
        this.renderResult(result, entries.length);
      } catch (e) {
        this.body.empty();
        this.body.createDiv({ cls: "reel-ask-error", text: redact(e) });
      } finally {
        this.busy = false;
        this.goBtn.disabled = false;
        this.goBtn.setText("Ask");
      }
    }
    renderThinking() {
      const box = this.body.createDiv({ cls: "reel-ask-thinking" });
      box.createDiv({ cls: "reel-ask-spinner" });
      box.createSpan({ text: "Reading the question, then your library\u2026" });
    }
    async remember(question) {
      const list2 = this.plugin.settings.recentAsks.filter((q) => q.toLowerCase() !== question.toLowerCase());
      list2.unshift(question);
      this.plugin.settings.recentAsks = list2.slice(0, RECENT_LIMIT);
      await this.plugin.saveSettings();
    }
    renderResult(result, libraryTotal) {
      this.body.empty();
      if (result.criteria.restated) {
        const line = this.body.createDiv({ cls: "reel-ask-understood" });
        setIcon(line.createSpan({ cls: "reel-ask-understood-icon" }), "quote");
        line.createSpan({ text: result.criteria.restated });
      }
      if (result.relaxed.length) {
        this.body.createDiv({
          cls: "reel-ask-relaxed",
          text: `Nothing in your library matched on ${list(result.relaxed)}, so that was set aside.`
        });
      }
      if (!result.picks.length) {
        this.body.createDiv({
          cls: "reel-ask-empty",
          text: result.considered === 0 ? "Nothing in your library fits that, even loosely. Try asking for less at once." : "Nothing came back. Try putting it a different way."
        });
        this.renderCost(result, libraryTotal);
        return;
      }
      const list_ = this.body.createDiv({ cls: "reel-ask-results" });
      for (const pick of result.picks) {
        this.renderPick(list_, pick.entry, pick.why);
      }
      this.renderCost(result, libraryTotal);
    }
    renderPick(host, entry, why) {
      const row = host.createDiv({ cls: "reel-ask-result" });
      row.setAttr("role", "button");
      row.setAttr("tabindex", "0");
      row.setAttr("aria-label", `${entry.title}. ${why}`);
      const thumb = row.createDiv({ cls: "reel-ask-thumb" });
      this.plugin.posters.attach(thumb, entry);
      const body = row.createDiv({ cls: "reel-ask-result-body" });
      const title = body.createDiv({ cls: "reel-ask-result-title" });
      title.createSpan({ text: entry.title });
      const year2 = entry.type === "tv" ? entry.firstAirYear : entry.year;
      if (year2)
        title.createSpan({ cls: "reel-dim", text: ` ${year2}` });
      if (why)
        body.createDiv({ cls: "reel-ask-why", text: why });
      const facts = body.createDiv({ cls: "reel-ask-facts" });
      const mins = entry.type === "tv" ? entry.episodeRuntime : entry.runtime;
      if (mins)
        facts.createSpan({ text: formatMinutes(mins) });
      if (entry.genres.length)
        facts.createSpan({ text: entry.genres.slice(0, 2).join(", ") });
      if (entry.rating != null)
        renderStarsStatic(facts, entry.rating);
      const open = () => {
        this.close();
        this.onOpenEntry(entry);
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          open();
        }
      });
    }
    /**
     * What it looked at and what it cost.
     *
     * Deliberately unglamorous and deliberately present. "62 of 431 considered"
     * is the line that tells you whether the shortlist was the bottleneck, and
     * the token count is the line that tells you this is not free.
     */
    renderCost(result, libraryTotal) {
      const foot = this.body.createDiv({ cls: "reel-ask-cost" });
      foot.createSpan({ text: `${result.considered} of ${libraryTotal} considered` });
      const tokens = result.promptTokens + result.completionTokens;
      if (tokens)
        foot.createSpan({ text: `${tokens.toLocaleString()} tokens \xB7 ${this.plugin.settings.aiModel}` });
    }
    onClose() {
      this.contentEl.empty();
    }
  };
  function list(items) {
    if (items.length === 1)
      return items[0];
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  // harness/audit.ts
  function luminance(colour) {
    const parts = colour.match(/[\d.]+/g);
    if (!parts || parts.length < 3)
      return null;
    if (parts.length > 3 && Number(parts[3]) === 0)
      return null;
    const scale = colour.startsWith("color(") ? 1 : 255;
    const [r, g, b] = parts.slice(0, 3).map((v) => {
      const c = Number(v) / scale;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function channels(colour) {
    const parts = colour.match(/[\d.]+/g);
    if (!parts || parts.length < 3)
      return null;
    const scale = colour.startsWith("color(") ? 1 / 255 : 1;
    const [r, g, b] = parts.slice(0, 3).map((v) => Number(v) / scale);
    return [r, g, b];
  }
  function paintedColour(el, backdrop) {
    let alpha = 1;
    for (let p = el; p; p = p.parentElement) {
      const o = Number(getComputedStyle(p).opacity);
      if (Number.isFinite(o))
        alpha *= o;
    }
    const fg = getComputedStyle(el).color;
    if (alpha > 0.995)
      return fg;
    const a = channels(fg);
    const b = channels(backdrop);
    if (!a || !b)
      return fg;
    const mix = a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
    return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
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
    const first = view.querySelector(
      ".reel-cell, .reel-row, .reel-upnext-row, .reel-chart, .reel-tile, .reel-hero, .reel-recipe-seed, .reel-dcard, .reel-drow-card"
    );
    if (first && !opts.keyboard && !opts.scale) {
      const top = first.getBoundingClientRect().top;
      check("chromeUnderHalf", top < vh * 0.45, `${Math.round(top)}px, ${Math.round(top / vh * 100)}%`);
    }
    const minTarget = opts.phone ? 44 : 28;
    const reachesMin = (el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const reach = minTarget / 2 - 1;
      const top = r.top + r.height / 2 - reach;
      const bottom = r.top + r.height / 2 + reach;
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
      if (h >= minTarget)
        return false;
      return !reachesMin(el);
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
    check(
      `targetSize${minTarget}`,
      small.length === 0,
      [...worst].map(([k, d]) => `${k} ${d}`).join(", ")
    );
    const POINTER_CEILING = 34;
    const BY_CONTENT = [
      ".reel-section-head",
      ".reel-fold-toggle",
      ".reel-credit-name",
      ".reel-model-field",
      ".reel-setup-row",
      ".reel-dcard-btn"
    ];
    if (!opts.phone && view.classList.contains("is-w700")) {
      const oversize = [...view.querySelectorAll('button, select, input, [role="button"]')].filter(
        (el) => {
          const h = el.getBoundingClientRect().height;
          if (h <= POINTER_CEILING || !shown(el))
            return false;
          if (h >= 60)
            return false;
          if (el.closest(".reel-stars") || el.closest(".reel-episode-stars"))
            return false;
          if (el.closest(".reel-heatmap-grid"))
            return false;
          return !BY_CONTENT.some((sel) => el.matches(sel) || el.closest(sel));
        }
      );
      const seen = /* @__PURE__ */ new Map();
      for (const el of oversize) {
        const k = el.className.split(" ")[0] || el.tagName;
        if (seen.has(k))
          continue;
        seen.set(k, `${Math.round(el.getBoundingClientRect().height)}px`);
      }
      check(
        `pointerScale${POINTER_CEILING}`,
        oversize.length === 0,
        [...seen].map(([k, d]) => `${k} ${d}`).join(", ")
      );
    }
    if (opts.keyboard) {
      const opensWith = (el, modal) => {
        let box = el.parentElement;
        while (box && box !== modal.parentElement && box.scrollHeight <= box.clientHeight + 1) {
          box = box.parentElement;
        }
        if (!box || box.scrollHeight <= box.clientHeight + 1)
          return true;
        const offset = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
        return offset < box.clientHeight;
      };
      const unreachable = [];
      const stranded = [];
      for (const modal of Array.from(view.querySelectorAll(".reel-modal"))) {
        const field = modal.querySelector("input, textarea");
        const action = modal.querySelector(".mod-cta");
        let scrolled = false;
        for (const el of [field, action]) {
          if (!el || !shown(el))
            continue;
          const r = el.getBoundingClientRect();
          if (r.height < 2)
            continue;
          if (r.top >= 0 && r.bottom <= window.innerHeight)
            continue;
          if (!opensWith(el, modal)) {
            scrolled = true;
            continue;
          }
          unreachable.push(
            `${el.className.split(" ")[0] || el.tagName} at y ${Math.round(r.top)}..${Math.round(r.bottom)} of ${window.innerHeight}`
          );
        }
        if (!scrolled)
          continue;
        const reachable = Array.from(modal.querySelectorAll(".mod-cta")).some((b) => {
          const r = b.getBoundingClientRect();
          return shown(b) && r.height >= 2 && r.top >= 0 && r.bottom <= window.innerHeight;
        });
        if (!reachable)
          stranded.push(modal.className.split(" ")[1] || modal.className.split(" ")[0] || "modal");
      }
      check("typingVisible", unreachable.length === 0, unreachable.slice(0, 3).join(", "));
      check("scrollingSheetHasAction", stranded.length === 0, stranded.slice(0, 3).join(", "));
    }
    const broken = [];
    for (const el of Array.from(view.querySelectorAll('[class*="error"], pre'))) {
      if (!shown(el))
        continue;
      const text = (el.textContent ?? "").trim();
      if (!text)
        continue;
      broken.push(text.slice(0, 80));
    }
    check("screenRendered", broken.length === 0, broken.slice(0, 2).join(" | "));
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
    const nameOf = (el) => {
      const own = el.className.split(" ")[0];
      if (own)
        return own;
      const parent = el.parentElement?.closest('[class*="reel-"]');
      const owner = parent?.className.split(" ")[0];
      return owner ? `${el.tagName} in ${owner}` : el.tagName;
    };
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
      if (el.closest(".reel-heart, .reel-cell-heart, .reel-reaction-icon, .reel-search-icon")) {
        const iconRatio = contrastRatio(paintedColour(el, bgHere), bgHere);
        if (iconRatio != null && iconRatio < 3) {
          lowContrast.push(`${nameOf(el)} ${iconRatio.toFixed(2)}:1 (icon)`);
        }
        continue;
      }
      if (el.closest('[disabled], [aria-disabled="true"], .is-disabled'))
        continue;
      if (cs.visibility === "hidden" || cs.display === "none")
        continue;
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || bold && size >= 18.66;
      const ratio = contrastRatio(paintedColour(el, bgHere), bgHere);
      if (ratio != null && ratio < (large ? 3 : 4.5)) {
        lowContrast.push(`${nameOf(el)} ${ratio.toFixed(2)}:1`);
      }
    }
    check("contrastAA", lowContrast.length === 0, [...new Set(lowContrast)].slice(0, 4).join(", "));
    const undescribed = [];
    for (const item of Array.from(view.querySelectorAll(".setting-item"))) {
      if (item.classList.contains("setting-item-heading"))
        continue;
      const desc = item.querySelector(".setting-item-description");
      if (desc?.textContent?.trim())
        continue;
      const name = item.querySelector(".setting-item-name")?.textContent?.trim();
      undescribed.push(name || "(unnamed row)");
    }
    check("settingsExplained", undescribed.length === 0, undescribed.slice(0, 4).join(", "));
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
        const clipped2 = (el) => {
          const r = el.getBoundingClientRect();
          for (let p = el.parentElement; p; p = p.parentElement) {
            const cs = getComputedStyle(p);
            const scrolls = /auto|scroll|hidden/.test(cs.overflowY) || /auto|scroll|hidden/.test(cs.overflowX);
            if (!scrolls)
              continue;
            const pr = p.getBoundingClientRect();
            if (r.bottom > pr.bottom + 1 || r.top < pr.top - 1)
              return true;
            if (r.right > pr.right + 1 || r.left < pr.left - 1)
              return true;
          }
          return false;
        };
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
        if (clipped2(a) || clipped2(b))
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
    const narrow2 = w > 0 ? w < NARROW_AT : true;
    el.toggleClass("is-narrow", narrow2);
    el.toggleClass("is-wide", !narrow2);
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
  var noKeys = false;
  var locked = false;
  var aiOff = false;
  var noTargets = false;
  var alreadySent = false;
  var missing = /* @__PURE__ */ new Set();
  var present = /* @__PURE__ */ new Set();
  var FIXED_NOW = Date.now();
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
  function feedPage(offset, page) {
    const start = (offset + (page - 1) * 8) % LIBRARY.length;
    return Array.from({ length: 8 }, (_, i) => {
      const e = LIBRARY[(start + i) % LIBRARY.length];
      return {
        id: 9e4 + start + i,
        media_type: e.type === "tv" ? "tv" : "movie",
        title: e.title,
        name: e.title,
        poster_path: e.title,
        overview: "A synopsis long enough to wrap onto a second line, because a card that has only ever been shown a short one has never been asked the question.",
        vote_average: 6 + (start + i) % 4,
        release_date: `${2e3 + (start + i) % 25}-06-01`,
        first_air_date: `${2e3 + (start + i) % 25}-06-01`,
        genre_ids: [28, 35],
        adult: false
      };
    });
  }
  var all = [...LIBRARY, SHOW, ...AWKWARD, LONG_SHOW];
  var pool = all;
  function withPool(rows2, run2) {
    pool = rows2;
    try {
      run2();
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
    // Without an IMDb id the links row renders a single chip, and a one-chip
    // row cannot show what a three-chip row does — which is the row in the
    // photo, wrapping and then being clipped.
    imdb_id: "tt0120737",
    external_ids: { imdb_id: "tt0120737" },
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
  var SEASON_META = {
    episodes: Array.from({ length: 22 }, (_, i) => {
      const n2 = i + 1;
      return {
        episode_number: n2,
        name: n2 === 4 ? "An Episode Title That Is Considerably Longer Than The Row It Has To Fit Inside" : n2 === 22 ? "" : `Episode ${n2}`,
        air_date: n2 === 22 ? void 0 : `2026-0${1 + i % 9}-1${i % 10}`,
        runtime: n2 === 12 ? 91 : 22,
        overview: n2 % 3 === 0 ? "A summary long enough to wrap onto a second line on a phone, which is where an episode row has to decide what it is willing to lose." : "",
        still_path: null
      };
    })
  };
  var PERSON_META = {
    id: 525,
    name: "Marguerite Vance-Ashworth",
    known_for_department: "Directing",
    birthday: "1970-07-30",
    deathday: null,
    place_of_birth: "London, England",
    profile_path: null,
    biography: "A director and screenwriter whose work is invented entirely for this test harness. This paragraph exists to be longer than two hundred and eighty characters, because the sheet clamps a biography at that length and offers a Read more button, and a clamp that is never reached is a branch that has never been drawn on a phone screen.",
    combined_credits: {
      cast: Array.from({ length: 26 }, (_, i) => ({
        id: 3e3 + i,
        title: i === 0 ? "A Credit Whose Title Will Not Fit Under Its Poster" : `Credit ${i}`,
        poster_path: `/c${i}.jpg`,
        media_type: i % 5 === 0 ? "tv" : "movie",
        character: i % 4 === 0 ? "A Character With A Considerably Longer Name" : "Herself",
        popularity: 100 - i,
        release_date: `${1994 + i % 30}-05-01`,
        vote_average: 6 + i % 4
      })),
      crew: [
        // The same title twice, with two jobs. Three identical posters in a
        // row is what this de-duplication exists to stop.
        { id: 3e3, title: "A Credit Whose Title Will Not Fit Under Its Poster", poster_path: "/c0.jpg", media_type: "movie", job: "Director", popularity: 100, release_date: "1994-05-01" },
        { id: 3e3, title: "A Credit Whose Title Will Not Fit Under Its Poster", poster_path: "/c0.jpg", media_type: "movie", job: "Writer", popularity: 100, release_date: "1994-05-01" },
        { id: 3100, title: "A Directed Film", poster_path: "/c100.jpg", media_type: "movie", job: "Director", popularity: 55, release_date: "2011-05-01" }
      ]
    }
  };
  var plugin = {
    settings: { ...DEFAULT_SETTINGS, recentSearches: ["Inside Man"] },
    app: {
      vault: {
        // The real default. Without it the one sentence on the settings
        // screen that says where plain-text keys land rendered as
        // "undefined/plugins/reel/data.json", and every check passed.
        configDir: ".obsidian",
        getAbstractFileByPath: () => null,
        /*
         * A vault with a shape, so the folder fields have something to
         * check themselves against.
         *
         * Chosen so the screen shows both answers at once: `Movies` and
         * `Series` exist, and the default people folder `Movies/People`
         * does not — which is the real default, and the state a new
         * install is actually in. A fixture where every path resolves
         * would only ever exercise the half of the feature that says
         * "fine".
         */
        getAllLoadedFiles: () => [
          { path: "Movies", children: [] },
          { path: "Movies/_posters", children: [] },
          { path: "Series", children: [] },
          { path: "People", children: [] },
          { path: "Archive/Old Movies", children: [] },
          { path: "Music", children: [] },
          { path: "Movies/Heat.md" },
          { path: "Inbox.md" },
          /*
           * Daily notes, in a folder Reel is not pointed at.
           *
           * The default `dailyNoteFolder` is the vault root, which holds
           * none of these — so the scene renders the mismatch state and
           * its suggestion, which is the half of the feature that can
           * actually be wrong. A fixture where the setting already
           * matched would only exercise the sentence saying "fine".
           */
          { path: "Journal/2026-08-20.md" },
          { path: "Journal/2026-08-21.md" },
          { path: "Journal/2026-08-22.md" }
        ]
      },
      workspace: { getLeaf: () => null }
    },
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
    /*
     * Publishing, configured half-way on purpose.
     *
     * Trakt is ready and Mastodon is blocked, because the two states sit side
     * by side in the same row and the blocked one is the easier of the pair to
     * get wrong — it carries a second line of explanatory text inside a button
     * that is otherwise one word tall.
     */
    publish: {
      anyEnabled: true,
      /*
       * Two targets by default, one ready and one blocked; none at all for
       * the scene that models an install which has set up neither.
       *
       * That empty case renders a different screen entirely — the one telling
       * you publishing exists and offering to set it up — and it had never been
       * drawn, because this list was a constant.
       */
      targets: () => noTargets ? [] : [
        { id: "trakt", label: "Trakt", enabled: true, blocker: null },
        {
          id: "mastodon",
          label: "Mastodon",
          enabled: true,
          blocker: BLOCKERS.mastodonToken
        }
      ],
      /*
       * Whether this review has been sent before.
       *
       * Pinned empty, so the "Already published once" note — the only thing
       * standing between a rewatch review and a duplicate post — had never
       * been rendered.
       */
      publishedTo: () => alreadySent ? { trakt: "https://trakt.tv/comments/1" } : {},
      /*
       * The real rule, not a constant.
       *
       * `() => null` meant the warning box was unreachable in the rig, and it
       * is the box that says why Publish is disabled. Delegating to the
       * function the app uses means the fixture cannot drift from the rule:
       * a review the harness calls short is short because Trakt's own
       * minimum says so.
       */
      complaint: (payload, id) => id === "trakt" ? traktComplaint(payload) : payload.text.trim() ? null : "There's nothing written to post.",
      preview: async () => ({
        text: "\u2605\u2605\u2605\u2605\xBD\n\nA review long enough to wrap several times in the preview box, because a one-line sample would never show whether the text block scrolls, clips, or pushes the Publish button off the bottom of a phone screen.",
        truncated: true
      })
    },
    // Ask records the question you asked; the rig has nothing to save it to.
    saveSettings: async () => void 0,
    ai: {
      get configured() {
        return !aiOff && plugin.settings.aiEnabled && !noKeys;
      },
      /*
       * A live model list, for the scene that presses Load list.
       *
       * The curated branch — what the picker shows before any fetch — is
       * still the state a new install is in and is still measured by the
       * ordinary settings scenes, which never press the button. What was
       * never drawn is the other half: chips carrying OpenRouter's own names
       * and a price, which is a taller two-line control with a suffix that
       * the curated list has no equivalent of.
       *
       * The prices are chosen to cover every branch of `formatPrice` at once:
       * one over a dollar (two decimals), one under (three, because two would
       * render "$0.00" and that is a different claim from "cheap"), one at
       * zero (the word "free"), and one unpriced (nothing at all).
       */
      models: async () => [
        { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", prompt: 0.8, completion: 4 },
        { id: "openai/gpt-4o-mini", name: "GPT-4o mini", prompt: 0.15, completion: 0.6 },
        { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash Experimental (free)", prompt: 0, completion: 0 },
        { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct", prompt: 1.2, completion: 1.2 },
        { id: "mistralai/mistral-small", name: "Mistral Small", prompt: null, completion: null }
      ],
      /*
       * A fake network client, not a fake Ask.
       *
       * The result list has never been measured, and the reason it never was
       * is that `renderResult` is private and I would not widen it for the
       * rig — changing the thing being measured to suit the measurement
       * is not coverage.
       *
       * It turns out none of that was necessary. `ask()` takes the client as
       * an argument and the only thing it asks of it is `json`, so replacing
       * *that* runs the entire real path: the criteria are sanitised for
       * real, the shortlist is computed for real against the real library,
       * the out-of-range pick below is rejected by the real guard, and the
       * real `renderResult` draws the real markup. The seam was already
       * there and it belongs to the app, not to the harness.
       *
       * Keyed on the schema name because `ask` makes two calls that want
       * entirely different answers.
       */
      json: async (_messages, _schema, name) => {
        if (name === "criteria") {
          return {
            value: {
              pool: "any",
              type: "any",
              genres: [],
              excludeGenres: [],
              yearFrom: null,
              yearTo: null,
              minRuntime: null,
              maxRuntime: null,
              minRating: null,
              keywords: [],
              restated: "Something short and funny you haven't seen, nothing too bleak."
            },
            promptTokens: 412,
            completionTokens: 96
          };
        }
        return {
          value: {
            picks: [
              {
                index: 0,
                why: "Ninety minutes, genuinely funny, and about as far from bleak as the library gets."
              },
              { index: 1, why: "Short, warm, and you rated the director's other one highly." },
              {
                index: 2,
                why: "A comedy you added months ago and never got to. Long-ish, but it earns it \u2014 and this reason is deliberately wordy, because a two-line explanation is the one that finds the layout bugs."
              },
              // Out of range on purpose: the real guard drops it, and
              // a rig that only ever sends valid data never proves that.
              { index: 9999, why: "A film you do not own." }
            ]
          },
          promptTokens: 1180,
          completionTokens: 143
        };
      }
    },
    /*
     * Flipped by the first-run scene.
     *
     * A module-level flag rather than a parameter because `plugin` is built
     * once at load and the settings tab reads the store through it. The scene
     * sets it, renders, and puts it back.
     */
    /*
     * Enough of the credential store for the settings screen to render.
     *
     * Keys are reported present so the sections that unfold behind one are
     * actually drawn — the collapsed screen is the easy case, and the long one
     * is where the overflow and the touch targets live. `store` and `remove`
     * exist because they are referenced in click handlers; nothing in the rig
     * ever presses anything.
     */
    credentials: {
      has: (name) => (present.has(name) || name !== "mastodon") && !missing.has(name) && !noKeys,
      // A getter, not a value. The stub is built once at load, so a plain
      // `!locked` freezes whatever the flag was then, which is false, and the
      // locked scene renders an unlocked screen while reporting success.
      get isUnlocked() {
        return !locked;
      },
      get needsUnlock() {
        return locked;
      },
      unlock: async () => true,
      /*
       * Read off the settings, not pinned true.
       *
       * Pinned, it put an Unlock button and a Remove all keys button on the
       * session-only screen, where nothing is stored and there is nothing to
       * unlock or remove. Both are gated on exactly this flag in the real
       * store, so a fixture that answers yes unconditionally cannot see the
       * gate at all — it can only ever render the open branch.
       */
      get hasStoredKey() {
        const s = plugin.settings;
        return !!(s.keyBlob || s.keysPlain && Object.keys(s.keysPlain).length);
      },
      store: async () => true,
      remove: async () => void 0,
      migrateTo: async () => void 0,
      changePassphrase: async () => "cancelled",
      lock: () => void 0
    },
    posters: {
      attach(parent, entry) {
        parent.addClass("reel-poster-loading");
        const img = parent.createEl("img", { cls: "reel-img", attr: { src: poster(entry.title), alt: "" } });
        img.addClass("is-loaded");
        parent.removeClass("reel-poster-loading");
      },
      displayUrl: (e) => poster(e.title),
      // The wash prefers a backdrop and falls back to the poster. The rig has
      // no backdrops, so this exercises the fallback path — which is the one
      // most entries will actually take, since backdrop_path is the field
      // most often missing.
      washUrl: (e) => poster(e.title)
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
      /*
       * The feed, as the screen has asked for it since it became endless.
       *
       * The stub still answered `rows()` — the shape from before Discover was
       * rewritten into a paging feed — so `rowSources` was undefined, the
       * await threw, and every run since has rendered "That didn't work."
       * with a Try again button. It passed because the audit measured the
       * screen while it was still a skeleton; adding the settle is what made
       * it visible.
       *
       * A stub is a claim about an interface. When the interface moves and
       * the stub does not, the test keeps reporting on a version of the app
       * that no longer exists.
       */
      rowSources: () => [
        { id: "people", title: "More with Denzel Washington", reason: "You rated three of his films 4 or more", fetch: async (p) => p > 2 ? [] : feedPage(0, p) },
        { id: "seed", title: "Because you liked Inside Man", reason: "Similar to a film you rated 5", fetch: async (p) => p > 2 ? [] : feedPage(6, p) },
        { id: "trend", title: "Trending this week", fetch: async (p) => p > 3 ? [] : feedPage(12, p) },
        { id: "genre", title: "Action from the 2010s", reason: "Your most-watched genre", fetch: async (p) => p > 3 ? [] : feedPage(18, p) }
      ],
      filterOut: (items) => items,
      like: async () => feedPage(3, 1),
      search: async () => feedPage(9, 1),
      reroll: () => {
      },
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
      getSeason: async () => SEASON_META,
      getPerson: async () => PERSON_META
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
  function library(root, rows2 = all) {
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
      title: `${rows2.length} titles`,
      sub: `Most recently \u2014 ${rows2[0].title} \xB7 14 to watch \xB7 2 hidden by content filter`,
      art: false,
      compact: true
    });
    renderPosterGrid(plugin, body, rows2);
  }
  function libraryYear(root) {
    withPool(YEAR, () => library(root, YEAR));
  }
  function filterBar(into, active, sort = true) {
    const bar = into.createDiv({ cls: "reel-chips reel-filterbar" });
    const open = bar.createEl("button", { cls: "reel-chip reel-filter-btn" });
    open.createSpan({ cls: "reel-filter-btn-icon", text: "\u2699" });
    open.createSpan({ text: "Filters" });
    if (active.length)
      open.createSpan({ cls: "reel-filter-count", text: String(active.length) });
    const ask2 = bar.createEl("button", { cls: "reel-chip reel-ask-btn" });
    ask2.createSpan({ cls: "reel-filter-btn-icon", text: "\u2726" });
    ask2.createSpan({ text: "Ask" });
    if (sort) {
      const sel = bar.createEl("select", { cls: "reel-select dropdown reel-sort-select" });
      sel.createEl("option", { text: "Recently watched" });
      const layout = bar.createEl("button", { cls: "reel-chip reel-layout-btn" });
      layout.createSpan({ cls: "reel-layout-icon", text: "\u25A6" });
      layout.createSpan({ cls: "reel-layout-label", text: "Posters" });
    }
    for (const label of active) {
      const tag = bar.createDiv({ cls: "reel-chip is-active reel-filter-tag" });
      tag.setAttr("role", "group");
      tag.createEl("button", { cls: "reel-filter-tag-label", text: label });
      const x = tag.createEl("button", {
        cls: "reel-filter-tag-x",
        attr: { "aria-label": `Remove the ${label} filter` }
      });
      x.createSpan({ cls: "reel-filter-x svg-icon", text: "\xD7" });
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
    root.addClass("reel-view-body");
    const state = emptyFilters();
    state.genres = ["Action", "Comedy"];
    state.statuses = ["watchlist"];
    mountSheet(
      root,
      new FilterSheet(plugin.app, state, {
        pool: all,
        lists: ["Christmas with the family", "Rewatch pile", "Letterboxd top 250"],
        showSort: true,
        onChange: () => {
        }
      })
    );
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
      const list2 = sec.createDiv({ cls: "reel-wn-list" });
      for (const [kind, what, note] of changes) {
        const row = list2.createDiv({ cls: `reel-wn-item is-${kind}` });
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
  function rate(root) {
    root.addClass("reel-view-body");
    withPool(YEAR, () => new RateScreen(plugin).render(root));
  }
  function upnext(root) {
    root.addClass("reel-view-body");
    heroBand(root, { label: "Tonight", title: "6 on the go", sub: "Severance \u2014 up to S2E4", art: true, compact: true });
    paintUpNext(plugin, root, void 0, true);
    paintUpcoming(plugin, root.createDiv({ cls: "reel-upcoming-section" }));
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
  function detailremove(root) {
    root.addClass("reel-view-body");
    const screen = new DetailScreen(plugin, SHOW, () => {
    }, "Library");
    screen.render(root);
    const remove = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "Remove");
    if (!remove)
      throw new Error("harness: no Remove button on the detail screen");
    remove.click();
    if (remove.dataset.confirming !== "true") {
      throw new Error("harness: Remove did not arm, so the confirming state is not what was measured");
    }
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
  function seasonsheet(root) {
    root.addClass("reel-view-body");
    mountSheet(root, new SeasonSheet(plugin.app, plugin, LONG_SHOW, 21));
  }
  function preview(root) {
    root.addClass("reel-view-body");
    mountSheet(
      root,
      new PreviewSheet(
        plugin,
        {
          id: 120,
          media_type: "movie",
          title: "A Preview Title Long Enough To Wrap",
          poster_path: "Preview",
          release_date: "2023-09-01",
          vote_average: 7.4,
          overview: "A synopsis of the kind the sheet actually receives: several sentences, long enough to need a clamp, and written to be read rather than counted."
        },
        () => {
        },
        "A Character With A Considerably Longer Name"
      )
    );
  }
  function personsheet(root) {
    root.addClass("reel-view-body");
    mountSheet(root, new PersonSheet(plugin, 525, "Marguerite Vance-Ashworth"));
  }
  function publishsheet(root) {
    root.addClass("reel-view-body");
    mountSheet(
      root,
      new PublishSheet(plugin.app, plugin, {
        entry: LIBRARY[0],
        date: "2026-08-20",
        rating: 4.5,
        text: "A review of the length people actually write, which is to say several sentences rather than one."
      })
    );
    root.querySelector(".reel-publish-target")?.click();
  }
  function askoff(root) {
    root.addClass("reel-view-body");
    aiOff = true;
    noKeys = true;
    try {
      mountSheet(root, new AskSheet(plugin.app, plugin, () => {
      }, ""));
    } finally {
      aiOff = false;
      noKeys = false;
    }
  }
  function askdisabled(root) {
    root.addClass("reel-view-body");
    const before = plugin.settings.aiEnabled;
    plugin.settings.aiEnabled = false;
    try {
      mountSheet(root, new AskSheet(plugin.app, plugin, () => {
      }, ""));
    } finally {
      plugin.settings.aiEnabled = before;
    }
  }
  function publishnowhere(root) {
    root.addClass("reel-view-body");
    noTargets = true;
    try {
      mountSheet(
        root,
        new PublishSheet(plugin.app, plugin, {
          entry: LIBRARY[0],
          date: "2026-08-20",
          rating: 4.5,
          text: "A review that has nowhere to go yet."
        })
      );
    } finally {
      noTargets = false;
    }
  }
  function publishrefused(root) {
    root.addClass("reel-view-body");
    alreadySent = true;
    try {
      mountSheet(
        root,
        new PublishSheet(plugin.app, plugin, {
          entry: LIBRARY[0],
          date: "2026-08-20",
          rating: 4.5,
          // Under Trakt's minimum on purpose, which the real rule decides.
          text: "Loved it."
        })
      );
      root.querySelector(".reel-publish-target")?.click();
    } finally {
      alreadySent = false;
    }
  }
  function asksheet(root) {
    root.addClass("reel-view-body");
    mountSheet(
      root,
      new AskSheet(
        plugin.app,
        plugin,
        () => {
        },
        ""
      )
    );
  }
  function askresult(root) {
    root.addClass("reel-view-body");
    mountSheet(
      root,
      new AskSheet(
        plugin.app,
        plugin,
        () => {
        },
        "something short and funny I haven't seen, nothing too bleak"
      )
    );
  }
  function firstrun(root) {
    root.addClass("reel-view-body");
    noKeys = true;
    const before = { ...plugin.settings };
    Object.assign(plugin.settings, { keyBlob: null, keysPlain: null, keyNames: [] });
    try {
      const tab = new ReelSettingTab(plugin.app, plugin);
      tab.containerEl = root;
      tab.display();
    } finally {
      noKeys = false;
      Object.assign(plugin.settings, before);
    }
  }
  function setupsheet(root) {
    root.addClass("reel-view-body");
    const spec = FEATURES.find((f) => f.id === "trakt");
    if (!spec)
      throw new Error("harness: no trakt feature spec");
    missing.add("trakt");
    try {
      mountSheet(root, new SetupSheet(plugin.app, plugin, spec));
    } finally {
      missing.delete("trakt");
    }
  }
  function setupdone(root) {
    root.addClass("reel-view-body");
    const spec = FEATURES.find((f) => f.id === "mastodon");
    if (!spec)
      throw new Error("harness: no mastodon feature spec");
    present.add("mastodon");
    const before = plugin.settings.mastodonHost;
    plugin.settings.mastodonHost = "mastodon.social";
    try {
      mountSheet(root, new SetupSheet(plugin.app, plugin, spec));
    } finally {
      present.delete("mastodon");
      plugin.settings.mastodonHost = before;
    }
  }
  function guide(spec) {
    return (root) => {
      root.addClass("reel-view-body");
      noKeys = true;
      try {
        mountSheet(root, new SetupSheet(plugin.app, plugin, spec));
      } finally {
        noKeys = false;
      }
    };
  }
  function settings(root) {
    root.addClass("reel-view-body");
    const before = { ...plugin.settings };
    Object.assign(plugin.settings, {
      publishTrakt: true,
      publishMastodon: true,
      mastodonHost: "mastodon.social",
      aiEnabled: true,
      dismissedIds: [1, 2, 3],
      /*
       * Every section open, which is the whole point of this scene.
       *
       * Sections fold now, and the moment they did the audit quietly stopped
       * measuring what was inside them: forty-six controls became display:
       * none and the pass stayed green at the same count, which is the most
       * dangerous shape a green result can have. The folded screen is worth
       * measuring too and the firstrun scene does it; this one has to show
       * every control there is.
       */
      settingsOpen: ["setup", "keys", "folders", "metadata", "reviews", "publishing", "ask", "content", "behaviour", "maintenance"],
      /*
       * One passing check, one failing one, and a dead Trakt session.
       *
       * The warning states are the ones worth measuring: they are the only
       * place on this screen that paints text in a colour of its own, and
       * every contrast fault this rig has ever caught has been in exactly
       * that kind of rule. A fixture where everything is healthy would
       * exercise the half that cannot fail.
       *
       * Timestamps are fixed offsets from a literal rather than from
       * Date.now(), so the rendered words do not change between runs.
       */
      connectionHealth: {
        tmdb: { at: FIXED_NOW - 3 * 60 * 60 * 1e3, ok: true },
        omdb: { at: FIXED_NOW - 2 * 24 * 60 * 60 * 1e3, ok: false, error: "401 Unauthorized" },
        /*
         * The two shapes a pass can now take, both present on purpose.
         *
         * A row that qualifies itself is longer than one that does not, and
         * the whole point of the qualification is lost if it is the thing
         * that overflows. Neither had ever been rendered anywhere.
         */
        openrouter: { at: FIXED_NOW - 40 * 60 * 1e3, ok: true, note: "$4.20 of $10.00 used" },
        mastodon: {
          at: FIXED_NOW - 5 * 60 * 1e3,
          ok: true,
          proves: "mastodon.social answered. The token is not checked here: it can only post, and Reel will not post to test it."
        },
        /*
         * Revoked, not expired — the state that had no way of being seen.
         *
         * The expiry is deliberately two months out, so the only thing
         * making this session dead is the refusal. Anything that reads the
         * expiry alone renders this row as "Signed in", which is what it
         * used to do.
         */
        trakt: { at: FIXED_NOW - 3 * 60 * 1e3, ok: false, error: "Trakt refused this token. It may have been revoked." }
      },
      traktExpires: FIXED_NOW + 60 * 24 * 60 * 60 * 1e3
    });
    try {
      const tab = new ReelSettingTab(plugin.app, plugin);
      tab.containerEl = root;
      tab.display();
    } finally {
      Object.assign(plugin.settings, before);
    }
  }
  function settingsSession(root) {
    root.addClass("reel-view-body");
    const before = { ...plugin.settings };
    noKeys = true;
    locked = true;
    Object.assign(plugin.settings, {
      keyMode: "session",
      keyBlob: null,
      keysPlain: null,
      keyNames: [],
      settingsOpen: ["setup", "keys"],
      connectionHealth: {}
    });
    try {
      const tab = new ReelSettingTab(plugin.app, plugin);
      tab.containerEl = root;
      tab.display();
    } finally {
      noKeys = false;
      locked = false;
      Object.assign(plugin.settings, before);
    }
  }
  function settingsPlain(root) {
    root.addClass("reel-view-body");
    const before = { ...plugin.settings };
    Object.assign(plugin.settings, {
      keyMode: "plain",
      keyBlob: null,
      /*
       * Obvious fakes. The rig renders a real settings screen and the screen
       * lists the names of whatever is in here, so anything that looked like
       * a key would be a key-shaped string committed to a public repository.
       */
      keysPlain: { tmdb: "not-a-real-key", omdb: "not-a-real-key" },
      keyNames: ["tmdb", "omdb"],
      settingsOpen: ["setup", "keys"],
      connectionHealth: {
        tmdb: { at: FIXED_NOW - 3 * 60 * 60 * 1e3, ok: true }
      }
    });
    try {
      const tab = new ReelSettingTab(plugin.app, plugin);
      tab.containerEl = root;
      tab.display();
    } finally {
      Object.assign(plugin.settings, before);
    }
  }
  function guideHalf(root) {
    root.addClass("reel-view-body");
    const spec = FEATURES.find((f) => f.id === "mastodon");
    if (!spec)
      throw new Error("harness: no mastodon feature spec");
    const before = plugin.settings.mastodonHost;
    plugin.settings.mastodonHost = "mastodon.social";
    try {
      mountSheet(root, new SetupSheet(plugin.app, plugin, spec));
    } finally {
      plugin.settings.mastodonHost = before;
    }
  }
  function guideLocked(root) {
    root.addClass("reel-view-body");
    const spec = FEATURES.find((f) => f.id === "omdb");
    if (!spec)
      throw new Error("harness: no omdb feature spec");
    const before = { ...plugin.settings };
    locked = true;
    Object.assign(plugin.settings, { keyMode: "encrypted", keyBlob: "v1:sealed", keysPlain: null, keyNames: ["omdb"] });
    try {
      mountSheet(root, new SetupSheet(plugin.app, plugin, spec));
    } finally {
      locked = false;
      Object.assign(plugin.settings, before);
    }
  }
  function guideFailed(root) {
    root.addClass("reel-view-body");
    const spec = FEATURES.find((f) => f.id === "omdb");
    if (!spec)
      throw new Error("harness: no omdb feature spec");
    const before = { ...plugin.settings };
    present.add("omdb");
    Object.assign(plugin.settings, {
      connectionHealth: {
        omdb: {
          at: FIXED_NOW - 4 * 60 * 1e3,
          ok: false,
          error: "Invalid API key! (Please visit https://www.omdbapi.com/apikey.aspx to obtain a valid key.)"
        }
      }
    });
    try {
      mountSheet(root, new SetupSheet(plugin.app, plugin, spec));
    } finally {
      present.delete("omdb");
      Object.assign(plugin.settings, before);
    }
  }
  function settingsModels(root) {
    root.addClass("reel-view-body");
    const before = { ...plugin.settings };
    Object.assign(plugin.settings, { aiEnabled: true, settingsOpen: ["ask"] });
    try {
      const tab = new ReelSettingTab(plugin.app, plugin);
      tab.containerEl = root;
      tab.display();
      for (const b of Array.from(root.querySelectorAll("button"))) {
        if (b.textContent === "Load list") {
          b.click();
          break;
        }
      }
    } finally {
      Object.assign(plugin.settings, before);
    }
  }
  function settingsFolded(root) {
    root.addClass("reel-view-body");
    const before = { ...plugin.settings };
    Object.assign(plugin.settings, {
      settingsOpen: [],
      // Server typed, token not yet made: half done, and the summary has to
      // say so from the one line it has.
      mastodonHost: "mastodon.social",
      publishTrakt: true,
      aiEnabled: true
    });
    try {
      const tab = new ReelSettingTab(plugin.app, plugin);
      tab.containerEl = root;
      tab.display();
    } finally {
      Object.assign(plugin.settings, before);
    }
  }
  function searchIn(root, query) {
    root.addClass("reel-view-body");
    const before = { ...plugin.settings };
    Object.assign(plugin.settings, { settingsOpen: [] });
    try {
      const tab = new ReelSettingTab(plugin.app, plugin);
      tab.containerEl = root;
      tab.display();
      const box = root.querySelector(".reel-settings-search input");
      if (!box)
        throw new Error("harness: no settings search box");
      box.value = query;
      box.dispatchEvent(new Event("input"));
    } finally {
      Object.assign(plugin.settings, before);
    }
  }
  function settingsSearch(root) {
    searchIn(root, "spoiler");
  }
  function settingsSearchSection(root) {
    searchIn(root, "publishing");
  }
  function settingsSearchCleared(root) {
    searchIn(root, "spoiler");
    const box = root.querySelector(".reel-settings-search input");
    if (!box)
      throw new Error("harness: no settings search box");
    box.value = "";
    box.dispatchEvent(new Event("input"));
  }
  function settingsSearchTap(root) {
    searchIn(root, "spoiler");
    const head = root.querySelector(".reel-settings-section.is-forced-open .reel-section-head");
    head?.click();
  }
  function settingsSearchEmpty(root) {
    searchIn(root, "zzzznothing");
  }
  function confirmsheet(root) {
    root.addClass("reel-view-body");
    mountSheet(
      root,
      new ConfirmModal(
        plugin.app,
        {
          title: "Write your keys in plain text?",
          body: "Every saved key is written readably into .obsidian/plugins/reel/data.json. Anything that can read the vault can read them: sync, backups, another plugin, anyone you share the folder with. Reel can encrypt them again later, but a key that has been on disk in the clear is best treated as exposed and replaced at the service that issued it.",
          confirmText: "Write in plain text",
          danger: true
        },
        () => {
        }
      )
    );
  }
  function settingsLocked(root) {
    root.addClass("reel-view-body");
    const before = { ...plugin.settings };
    locked = true;
    Object.assign(plugin.settings, {
      keyMode: "encrypted",
      // Enough of a blob for the screen to know one exists. Nothing reads it.
      keyBlob: "v1:sealed",
      keysPlain: null,
      keyNames: ["tmdb", "omdb", "dtdd", "openrouter", "trakt"],
      mastodonHost: "mastodon.social",
      aiEnabled: true,
      publishTrakt: true,
      settingsOpen: ["setup", "keys", "publishing", "ask"],
      /*
       * One old result, kept deliberately.
       *
       * A record written while unlocked outlives the unlock, so the screen has
       * to hold a truthful past answer next to a present it cannot test. That
       * pairing is the whole difficulty of this state and a fixture with an
       * empty health map would skip it.
       */
      connectionHealth: {
        tmdb: { at: FIXED_NOW - 3 * 60 * 60 * 1e3, ok: true }
      }
    });
    try {
      const tab = new ReelSettingTab(plugin.app, plugin);
      tab.containerEl = root;
      tab.display();
    } finally {
      locked = false;
      Object.assign(plugin.settings, before);
    }
  }
  var SCREENS = {
    library,
    libraryYear,
    dense,
    searching,
    seensheet,
    whatsnew,
    passphrase,
    feed,
    filterSheet,
    reviews,
    rows,
    rate,
    stats,
    statsYear,
    upnext,
    empties,
    stars,
    detail,
    detailFilm,
    detailremove,
    discover,
    recipe,
    quickrate,
    logsheet,
    seasonsheet,
    personsheet,
    preview,
    publishsheet,
    asksheet,
    askresult,
    askoff,
    askdisabled,
    publishnowhere,
    publishrefused,
    settings,
    settingsLocked,
    confirmsheet,
    settingsFolded,
    settingsSearch,
    settingsSearchSection,
    settingsSearchTap,
    settingsSearchCleared,
    settingsSearchEmpty,
    settingsModels,
    settingsPlain,
    settingsSession,
    guideLocked,
    guideFailed,
    guideHalf,
    firstrun,
    setupsheet,
    setupdone,
    // Every feature's guide, in the state a new install meets it in. Derived
    // from FEATURES so none can be left out and a seventh arrives covered.
    ...Object.fromEntries(FEATURES.map((f) => [`guide_${f.id}`, guide(f)])),
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
  document.body.setAttribute("data-palette", params2.get("palette") ?? "neutral");
  var textScale = Number(params2.get("scale") ?? "") || 1;
  if (textScale !== 1) {
    const root = document.documentElement.style;
    for (const [token, px] of [
      ["--font-ui-smaller", 12],
      ["--font-ui-small", 13],
      ["--font-ui-medium", 15],
      ["--font-ui-large", 20],
      ["--font-ui-larger", 24]
    ]) {
      root.setProperty(token, `${Math.round(px * textScale)}px`);
    }
    document.body.style.fontSize = `${Math.round(16 * textScale)}px`;
  }
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
    document.body.toggleClass("is-phone", !!phone2);
    document.body.toggleClass("is-mobile", !!phone2);
    stampWidth(view, measure(view) || window.innerWidth);
    const FULL_VIEW = /* @__PURE__ */ new Set(["library", "libraryYear", "searching"]);
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
  async function settled(root) {
    await new Promise((done) => {
      setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => done(null))), 0);
    });
    const scope = root ?? document.body;
    const running = scope.getAnimations?.({ subtree: true }) ?? [];
    await Promise.all(running.map((a) => a.finished.catch(() => void 0)));
  }
  var app = document.getElementById("app");
  if (app)
    mountObsidianChrome(app);
  async function runAudit(app2) {
    const MODAL_SCREENS = /* @__PURE__ */ new Set([
      "recipe",
      "logsheet",
      "quickrate",
      "filterSheet",
      "seensheet",
      "whatsnew",
      "passphrase",
      "seasonsheet",
      "personsheet",
      "preview",
      "publishsheet",
      "asksheet"
    ]);
    const skipped = [];
    const results = [];
    for (const name of Object.keys(SCREENS)) {
      if (paneWidth > 0 && MODAL_SCREENS.has(name)) {
        skipped.push(name);
        continue;
      }
      const view = mount(app2, name);
      await settled(view);
      results.push({ screen: name, checks: auditScreen(view, { phone: phone2, keyboard, scale: textScale !== 1 }) });
      view.remove();
    }
    const failures = results.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => ({ ...c, screen: r.screen })));
    const total = results.reduce((n2, r) => n2 + r.checks.length, 0);
    document.title = failures.length ? `FAIL ${failures.length}/${total}` : `PASS ${total}`;
    const report = app2.createDiv({ cls: "reel-audit" });
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
  }
  if (app && params2.get("audit") != null) {
    void runAudit(app);
  } else if (app) {
    mount(app, wanted);
    void settled().then(() => document.body.addClass("reel-settled"));
  }
  document.body.dataset.reelReady = "1";
})();
