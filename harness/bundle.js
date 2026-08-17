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
  function prettyDate(iso) {
    if (!iso)
      return "";
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m)
      return iso;
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

  // src/render/stats.ts
  function paintStats(plugin2, el, opts) {
    el.empty();
    el.addClass("reel-stats");
    const all2 = plugin2.visible(plugin2.library.all());
    const films = opts.include === "tv" ? [] : all2.filter((e) => e.type === "film");
    const shows = opts.include === "film" ? [] : all2.filter((e) => e.type === "tv");
    const watched = viewings(films, opts.year);
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
    const tiles = el.createDiv({ cls: "reel-tiles" });
    const tile = (label, value, sub, go) => {
      const t = tiles.createDiv({ cls: "reel-tile" });
      t.createDiv({ cls: "reel-tile-value", text: value });
      t.createDiv({ cls: "reel-tile-label", text: label });
      if (sub)
        t.createDiv({ cls: "reel-tile-sub", text: sub });
      if (!go)
        return;
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
    if (films.length) {
      const distinct = new Set(watched.map((v) => v.entry.path)).size;
      const rewatches = watched.filter((v) => v.rewatch).length;
      tile(
        "Films watched",
        String(watched.length),
        `${distinct} distinct \xB7 ${rewatches} rewatches`,
        () => void plugin2.openLibraryWithStatus("watched", "stats")
      );
      tile("Hours of film", formatMinutes(filmMinutes));
    }
    if (shows.length) {
      tile(
        "Episodes",
        String(episodesSeen),
        `${shows.length} show${shows.length === 1 ? "" : "s"}`,
        () => void plugin2.openLibraryWithStatus("watching", "stats")
      );
      if (episodeMinutes)
        tile("Hours of TV", formatMinutes(episodeMinutes));
    }
    if (rated.length) {
      const mean = rated.reduce((a, b) => a + b, 0) / rated.length;
      tile("Average rating", mean.toFixed(2), `${rated.length} rated`);
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
        () => void plugin2.openLibraryWithStatus("watchlist", "stats")
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
    if (watched.length) {
      const byMonth = new Array(12).fill(0);
      for (const v of watched)
        byMonth[parseInt(v.date.slice(5, 7), 10) - 1]++;
      const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      if (byMonth.some((n2) => n2 > 0))
        bars(charts, "By month", byMonth.map((n2, i) => ({ label: names[i], n: n2 })));
      const byWeekday = new Array(7).fill(0);
      for (const v of watched) {
        const d = /* @__PURE__ */ new Date(v.date + "T00:00:00");
        if (!Number.isNaN(d.getTime()))
          byWeekday[d.getDay()]++;
      }
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      if (byWeekday.some((n2) => n2 > 0))
        bars(charts, "By day of week", byWeekday.map((n2, i) => ({ label: days[i], n: n2 })));
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
    const box = el.createDiv({ cls: "reel-chart" });
    box.createDiv({ cls: "reel-chart-title", text: title });
    const body = box.createDiv({ cls: "reel-chart-body" });
    for (const d of data) {
      const row = body.createDiv({ cls: "reel-chart-row" });
      const head = row.createDiv({ cls: "reel-chart-head" });
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
        const open = d.go ?? (() => void plugin2.openViewWithSearch(d.search ?? d.label, "stats"));
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
  function shiftDay(iso, delta) {
    const d = /* @__PURE__ */ new Date(iso + "T00:00:00");
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
  function paintUpNext(plugin2, containerEl, limit, heading = false) {
    new UpNextPainter(plugin2, containerEl, limit, heading).render();
  }
  var UpNextPainter = class {
    constructor(plugin2, containerEl, limit, heading = false) {
      this.plugin = plugin2;
      this.containerEl = containerEl;
      this.limit = limit;
      this.heading = heading;
    }
    render() {
      const el = this.containerEl;
      el.empty();
      if (this.heading)
        el.createDiv({ cls: "reel-block-title", text: "Up next" });
      const everything = this.plugin.visible(this.plugin.library.inProgress());
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
  var all = [...LIBRARY, SHOW];
  var plugin = {
    settings: { ...DEFAULT_SETTINGS, recentSearches: ["Inside Man"] },
    app: { vault: { getAbstractFileByPath: () => null }, workspace: { getLeaf: () => null } },
    library: {
      all: () => all,
      films: () => all.filter((e) => e.type === "film"),
      shows: () => all.filter((e) => e.type === "tv"),
      inProgress: () => all.filter((e) => e.type === "tv"),
      byPath: (p) => all.find((e) => e.path === p),
      byTmdbId: (id) => all.find((e) => e.tmdbId === id),
      peopleIds: () => /* @__PURE__ */ new Map([["Christopher Nolan", 525]]),
      size: all.length,
      on: () => ({})
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
    const wrap = header.createDiv({ cls: "reel-search-wrap" });
    wrap.createSpan({ cls: "reel-search-icon", text: "\u2315" });
    wrap.createEl("input", {
      cls: "reel-input reel-search-input",
      attr: { type: "search", placeholder: "Search titles, people, characters, plots\u2026" }
    });
    wrap.createEl("button", { cls: "reel-search-clear", text: "\xD7" });
    header.createEl("button", { cls: "reel-btn mod-cta reel-add-btn", text: "+" });
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
    const chips = filters.createDiv({ cls: "reel-chips" });
    for (const [label, on] of [["All", true], ["Films", false], ["Series", false]]) {
      const b = chips.createEl("button", { cls: "reel-chip", text: label });
      if (on)
        b.addClass("is-active");
    }
    chips.createSpan({ cls: "reel-dim", text: "\xB7" });
    for (const s of ["watched", "watchlist", "watching", "completed", "paused"]) {
      chips.createEl("button", { cls: "reel-chip", text: s });
    }
    const sort = filters.createDiv({ cls: "reel-sortbar" });
    sort.createSpan({ cls: "reel-dim", text: "Sort" });
    const sel = sort.createEl("select");
    sel.createEl("option", { text: "Recently watched" });
    sort.createSpan({ cls: "reel-dim", text: "then" });
    const sel2 = sort.createEl("select");
    sel2.createEl("option", { text: "\u2014" });
    const body = root.createDiv({ cls: "reel-view-body" });
    body.createDiv({ cls: "reel-view-count", text: `${all.length} titles` });
    renderPosterGrid(plugin, body, all);
  }
  function rows(root) {
    root.addClass("reel-view-body");
    renderRowList(plugin, root, all.slice(0, 8));
  }
  function stats(root) {
    root.addClass("reel-view-body");
    paintStats(plugin, root, { include: "all" });
  }
  function upnext(root) {
    root.addClass("reel-view-body");
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
  var SCREENS = {
    library,
    rows,
    stats,
    upnext,
    empties,
    stars
  };
  var params2 = new URLSearchParams(location.search);
  var wanted = params2.get("screen") ?? "library";
  var phone2 = params2.get("phone") !== "0";
  var app = document.getElementById("app");
  if (app) {
    const view = app.createDiv({ cls: "reel-view" });
    view.toggleClass("is-phone", phone2);
    view.toggleClass("is-mobile", phone2);
    const paint = SCREENS[wanted] ?? library;
    try {
      paint(view);
    } catch (e) {
      view.createEl("pre", { text: `render failed: ${String(e)}
${e?.stack ?? ""}` });
    }
  }
  document.body.dataset.reelReady = "1";
})();
