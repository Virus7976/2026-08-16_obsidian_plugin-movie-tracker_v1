# Reel

Track films and series in your Obsidian vault. TMDB metadata, poster library, rewatches, episode progress, stats — all stored as frontmatter, all working offline, all built for a phone first.

No Dataview dependency. No Node APIs. `isDesktopOnly: false` and meant it.

---

## Why one note per title

`[[Dune (2021)]]` from a daily note or a Canvas links to something. That's the whole reason to do this in Obsidian rather than in Letterboxd — so a viewing isn't a row in someone else's database, it's a note you can link to, write in, and back up.

So: one note per film, one note per **show** — not per season, and never per episode. 62 episodes of Breaking Bad as 62 notes would wreck the metadata cache and give nothing back.

The plugin only ever writes frontmatter, always through `processFrontMatter()`. Your note body is untouched, whatever the plugin does to the metadata.

## Data model

### Film — `Movies/Dune (2021).md`

```yaml
---
tmdb_id: 438631
type: film
title: Dune
year: 2021
director: [Denis Villeneuve]
runtime: 155
genres: [Science Fiction, Adventure]
poster: Movies/_posters/438631.jpg
tmdb_rating: 7.8
status: watched        # watched | watchlist | abandoned
rating: 4.5            # most recent
liked: true
watched:
  - {date: 2024-03-11, rating: 4.5, rewatch: false}
  - {date: 2025-01-02, rating: 5, rewatch: true}
---

## 11 March 2024 · ★★★★½

The desert holds up. Second viewing and the sound design still does most of the work.
```

The `watched` array is what makes rewatches work and what a diary view flattens over. It's append-only — logging a rewatch never rewrites history.

### Series — `Series/Breaking Bad.md`

```yaml
---
tmdb_id: 1396
type: tv
title: Breaking Bad
first_air_year: 2008
creators: [Vince Gilligan]
status: watching       # watching | completed | watchlist | paused | dropped
show_status: Ended     # from TMDB — drives the new-episode check
episode_runtime: 47
total_episodes: 62
seasons:
  - {n: 1, watched: "1-7", total: 7, rating: 4.5}
  - {n: 2, watched: "1-13", total: 13, rating: 5}
  - {n: 3, watched: "1-4", total: 13}
last_watched: {season: 3, episode: 4, date: 2026-08-12}
rating: 4.5
---
```

**The range string is the key call.** `"1-7"`, or `"1-5,7-9"` if you skipped one. Compact, hand-editable, parses in ten lines, and still readable at 200 episodes where a flat episode list would not be. Progress percentage and hours-watched derive from it — nothing is stored twice.

`status` settles itself: tick the last episode and the show flips to `completed`; a new season arrives and it goes back to `watching`. A deliberate `paused` or `dropped` is never overridden.

## What it looks like

Everything lives in one tab — the film-reel icon in the ribbon. Five sections,
a search box across the top, and filter chips underneath.

### Library

A poster grid: three across on a phone, capped column count on a desktop so a
wide monitor doesn't give you sixteen tiny posters a row. Filter by type,
status, genre or list; sort by two criteria at once ("highest rated, then most
recent"). Search covers title, director, cast, genre, collection and list, with
no debounce — the index is in memory, so it filters as you type.

Tap a poster for the detail screen. Long-press to quick-rate without leaving
the grid.

### Detail

Everything about one title, and everything editable in place:

- Poster, scores from you / IMDb / Metacritic / Rotten Tomatoes / TMDB, genres,
  overview
- **Trailer** as a button, plus IMDb and TMDB links
- Rating, liked, and status — tap and it saves, with a flash to confirm
- **Series:** a season strip that expands inline into episodes, each with its
  own stars. Rating an episode marks it watched, and feeds the season and
  series ratings.
- **Films:** full watch history, and one button to log another viewing
- Cast, streaming providers, collection, studio, lists and content flags as
  aligned rows

### Discover

Rows of posters built from what you've rated: **"Because you liked X"** from
TMDB's recommendations, then trending, your top genre, acclaimed titles you've
missed, and upcoming releases. Nothing already in your library appears, and
nothing you've dismissed.

Every card carries its three answers inline — **+** to your watchlist, **✓**
for seen (which asks for a rating there and then), **✕** for not interested,
which persists. Tapping the poster previews it first.

Filter by genre, decade, minimum score, and films vs series — that swaps the
personalised rows for a grid, since you're then comparing a set rather than
skimming a shelf. "For you" is its own chip, so letting it choose from your
ratings is a deliberate choice rather than the absence of filters.

It says what it's reading from — "based on your ratings, mostly comedy,
thriller" — and if you haven't rated enough to personalise anything, it says
that instead of dressing the popular list up as being about you.

### Rate

One title at a time: poster, the essentials, big stars. Rating advances
automatically, so rating and moving on are a single action. Queues for unrated,
watchlist, or everything; Skip means "not now" and can be undone.

On desktop, `1`–`5` rate, shift for halves, `←`/`→` move, `s` skips, `l` likes.

### Up next

Every show you're partway through, one row each: poster, `S3E5`, progress, and
a tick that marks it watched in one tap. Underneath, what's about to air for
shows TMDB still lists as returning.

### Diary

Every *viewing*, newest first, grouped by month. The grid shows titles; this
shows viewings — so a film seen twice appears twice, which is the whole reason
the watch history is an array.

### Stats

Computed entirely from frontmatter, so no API calls and it works offline.
Beyond the counts: how your ratings compare to IMDb, which directors and genres
you actually rate rather than merely watch, current streak, films per month, how
long your watchlist is at your current pace, day-of-week patterns, superlatives,
and series progress.

### Ask

Describe what you feel like watching and Reel finds it in what you already own.
*“Something short and funny I haven't seen, nothing too bleak”* works, because
there is no field in the vault called `bleak` — which is exactly the sort of
question nothing else here could answer.

The model does less of the work than you would expect, on purpose. It reads
your sentence and says what it *means* — genres, a decade, a runtime ceiling,
seen or unseen. Reel applies that to the library itself, locally and exactly,
over every title with none skipped. Then the model ranks the shortlist that
survives and says why each one fits.

That split is what makes the answer checkable:

- **It cannot invent a film you do not own.** The ranking only ever sees titles
  that came out of your own library.
- **The prompt is bounded** whatever your library's size, so the cost per
  question does not grow with your collection.
- **It shows its working** — what it understood you to mean, what it had to
  give up on (*“nothing that short, so length was set aside”*), how many titles
  it considered, and one line per result. When it reads “bleak” as “no horror”
  you can see that, instead of shrugging at a black box.

Needs an OpenRouter key and is **off until you add one**. See
[what leaves the vault](SECURITY.md#what-leaves-the-vault-and-when).

### Publishing

A review lives in your note. If you want one to be public, the button beside it
sends it to **Trakt** or **Mastodon** — one review, one tap, having read the
exact text first.

**IMDb isn't an option**, and it is the thing everyone asks for. It has no
public API for posting a review, and the only alternative would be driving a
login and a form as you, which is impersonation with extra steps. Trakt is the
closest equivalent with a real door: a public profile carrying ratings and
reviews.

The confirmation sheet is deliberately unlike the rest of Reel, which spends
its time removing steps:

- **The real text, per destination.** Not a summary — the exact characters,
  with the character count and the truncation if there is one.
- **Nothing ticked to start with.** A reflex tap on Publish posts nowhere.
- **The URL afterwards**, because the next question after “post this” is
  “where is it”. A failure on one destination doesn't hide a success on the
  other.

Where a review went is recorded in its note, so the button knows it has been
rather than quietly posting twice.

## Undo

Every action in Reel is one tap, which is the point of it and also how you rate
the wrong film, tick an episode on the show above the one you meant, or add
something from a Discover row you were only scrolling past. So the notice that
confirms an action carries an **Undo** button, and the palette has *Undo the
last change* for after it fades. The last twenty changes are held for the
session.

What that covers, and what it deliberately doesn't:

| | |
|---|---|
| Ratings, likes, statuses, episode ticks, season changes, lists, content flags | fully reversible — the whole frontmatter block is snapshotted before the edit and written back |
| Adding a title | reversible; the note moves to the trash, so Obsidian or the OS can still bring it back |
| Reviews | **not** reversible, and no undo is offered. They're appended with `vault.append`, which cannot remove text — the same property that means no bug in Reel can eat something you wrote |
| Deleting a title | already goes to the trash, and asks first |

Undoing writes the old block back verbatim, so anything else that changed the
same note in between — your own edit, another plugin, a late enrichment — is
overwritten. That's why the stack is short and doesn't survive a restart: an
undo offered tomorrow would be claiming more than it can support.

## Code blocks

The same data, embeddable in any note:

````markdown
```films
filter: status = watched, year >= 2020
sort: watched desc
layout: poster-grid
```
````

Also `​```series`, `​```library`, `​```diary`, `​```up-next`, `​```upcoming` and
`​```film-stats`.

| Option | Values |
|---|---|
| `filter:` | comma-separated `field op value`, all ANDed. Ops: `=` `!=` `>` `<` `>=` `<=` `contains` `excludes` `in` `not in` |
| `sort:` | `watched` `added` `title` `year` `rating` `imdb_rating` `metacritic` `tmdb_rating` `runtime` `popularity` `certification` `random`, plus `asc`/`desc` |
| `layout:` | `poster-grid` · `list` · `compact` |
| `limit:` `title:` `chips:` | a number · a heading · `false` to hide filters |

Filterable fields: `status` `type` `title` `year` `decade` `rating`
`imdb_rating` `metacritic` `tmdb_rating` `liked` `genre` `director` `creator`
`cast` `runtime` `show_status` `watched` `episodes` `collection` `provider`
`language` `popularity` `certification` `content` `list` `studio` `budget`
`revenue` `added`.

## Commands

| Command | Notes |
|---|---|
| Open library / discover / rate / up next / diary / stats | one per tab |
| Undo the last change | hidden from the palette when there is nothing to undo |
| Log a film or series | |
| Add to watchlist | |
| Log the current note | only on a Reel note |
| Mark next episode watched | only on a series note |
| Open season checklist | |
| Toggle liked | |
| Refresh metadata from TMDB | your ratings and history are never touched |
| Download missing posters | throttled 250 ms/request; run again to stop |
| Remove posters for deleted titles | asks first; moves unreferenced posters to the trash |
| Lock the TMDB key | |
| Rebuild the library index | |
| Fetch ratings and content notes for this title | OMDb + DoesTheDogDie |
| Fetch ratings and content notes for the whole library | throttled; run again to stop |
| Create starter Bases views | five `.base` files |
| Import notes from another tracker | shows the count and rating scale, then asks before writing |
| Start a rewatch of this series | records the completed run |
| Ask for something to watch | needs an OpenRouter key; off by default |

## Setup

1. Get a free TMDB key at <https://www.themoviedb.org/settings/api>. A **v4 read access token** (starts `eyJ`) is preferred — it goes in a header rather than the URL, so it can't end up in a log.
2. Settings → Reel → paste it → Save. You'll be asked for a passphrase; the key is encrypted before it's written. It can be changed later — Settings → Reel → **Change passphrase** — without touching the keys themselves. See [SECURITY.md](SECURITY.md).
3. Tap **Test** to confirm.

Everything else is optional and off until you switch it on:

| | Where the key comes from | What it gives you |
|---|---|---|
| OMDb | <https://omdbapi.com/apikey.aspx> | IMDb, Rotten Tomatoes, Metacritic scores |
| DoesTheDogDie | <https://www.doesthedogdie.com/api> | content notes, voted on per topic |
| OpenRouter | <https://openrouter.ai/keys> | **Ask** |
| Trakt | your own app at <https://trakt.tv/oauth/applications> | **publishing** reviews and ratings |
| Mastodon | your instance → Preferences → Development, scope `write:statuses` | **publishing** reviews |

Trakt needs an application you register yourself, because its sign-in requires
a client secret and a secret shipped inside an open-source plugin is printed in
this repository. Yours stays yours. Reel then signs in with a short code you
type on any device — nothing has to link back to the app, which is what makes
it work on a phone at all.

## Install

### From the community store

Once accepted, Reel appears in **Settings → Community plugins → Browse**, and
updates arrive through Obsidian's own *Check for updates*. No other plugin is
involved. This is the intended route.

### Straight into your vaults (development)

Until then, build and copy in one command — no extra plugin required:

```bash
npm install          # first time only
npm run install-local
```

That reads Obsidian's own vault list and copies `main.js`, `manifest.json` and
`styles.css` into `.obsidian/plugins/reel/` in every vault it finds. Reload
Obsidian (`Ctrl+R`) to pick up the change.

```bash
npm run install-local -- open              # only the vault currently open
npm run install-local -- "My Vault"        # match by name
```

### With BRAT (optional)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) auto-updates plugins from
a GitHub repo. Useful for other people testing pre-release builds; unnecessary
if you're building locally or waiting for the store.

### Manually

Download the three files from the latest release into
`<vault>/.obsidian/plugins/reel/`.

Releasing is documented in [RELEASING.md](RELEASING.md) and
[PUBLISHING.md](PUBLISHING.md).

## How it's built

```
src/
  main.ts          plugin entry — commands, ribbon, daily episode check
  settings.ts      settings tab
  secrets.ts       AES-GCM / PBKDF2, redaction        ← see SECURITY.md
  credentials.ts   runtime key holder, unlock flow
  tmdb.ts          requestUrl client + on-disk cache
  library.ts       the in-memory index
  notes.ts         all frontmatter writes
  posters.ts       poster download and resolution
  ui/              search modal, log sheet, season sheet, stars, passphrase
  render/          header card, library grid, up next, stats, query parser
```

A few decisions worth stating:

**`requestUrl`, never `fetch`.** Mobile Obsidian runs in a webview where cross-origin `fetch` is blocked by CORS. `requestUrl` goes through the app's own networking and behaves identically on both platforms.

**The index replaces Dataview.** Built once at load from `metadataCache.getFileCache().frontmatter`, kept live via `metadataCache.on("changed")`. Filtering 800 titles is a synchronous pass over an array, so a chip tap re-renders inside one frame. A DataviewJS block doing the same work is the thing that feels sluggish on a phone — and dropping the dependency is worth it here.

**One API call per title.** `append_to_response=credits,watch/providers` folds everything into one request, and for a show the season list comes with it — so adding a ten-season show costs *one* call, not eleven. Episode titles are fetched lazily per season, only when you open one, and cached permanently once a show has ended.

**Posters live in the vault.** One `w342` jpg per title, about 30 KB, written with `createBinary` and read back with `getResourcePath`. That's the difference between a library that's instant on a train and a wall of grey boxes.

**Vanilla DOM, no framework.** Bundle size is felt on phones. The whole plugin is ~67 KB.

## Mobile constraints

Design-level, not afterthoughts:

- `requestUrl` instead of `fetch` (CORS)
- `isDesktopOnly: false`, zero Node APIs — the esbuild config lists every Node builtin as external so a stray dependency can't silently break the mobile build
- 44 px minimum touch targets throughout; the star widget's glyph is small but its tap box isn't
- no hover-only affordances — long-press for quick-rate, with a movement threshold so scrolling never triggers it
- every colour from an Obsidian CSS variable, so an untested theme can't produce unreadable text
- `safe-area-inset` on the sticky filter bar and the bottom sheets
- 16 px font on inputs, because anything smaller makes iOS zoom the page on focus
- `prefers-reduced-motion` respected

## Tests

```bash
npm test
```

426 assertions over eleven suites:

| Suite | Covers |
|---|---|
| logic | range parser, rating maths, dates, the query engine |
| crypto | AES-GCM round trips, tamper detection, redaction |
| content | flag derivation, certifications, field extraction |
| mutations | watch history and episode ratings — data you cannot reconstruct |
| legacy | conversion from the old tracker's shape |
| prune | which cached posters are safe to delete |
| importer | candidate selection and the once-per-library rating scale |
| library | the index every surface reads from |
| notes | the write path — reviews stay append-only, titles stay filesystem-safe |
| posters | which cached posters reach the trash, and which are never candidates |
| undo | snapshot depth, restore in place, and the no-op guard |

The bias is toward code that writes or deletes something. The pure logic is covered because an off-by-one there quietly corrupts watch history; the prune and importer suites exist because those are the two places Reel changes files you already own.

## Content filtering — what it can and can't do

Read this before relying on it.

TMDB has **no structured content-advisory data**. There is no field saying "this film contains 14 uses of strong language". What exists is:

1. **Certification** (G / PG / PG-13 / R / NC-17, TV-14, TV-MA). From a ratings board, present for most released titles. This is the dependable signal.
2. **Keywords**. Crowd-sourced free text. Specific when present ("female nudity", "sex scene"), but coverage is patchy — a film full of sex may carry no relevant keyword at all.

So a title with **no flags means "nothing was tagged", not "nothing is there"**. Certification is the filter to lean on; flags are a bonus. The settings screen says this too, because a filter that quietly under-reports is worse than none — you'd trust it and get caught out.

Flags are written to `content_flags`, where you can correct them by hand. Refreshes merge rather than overwrite, so a flag you add stays added.

```
filter: content excludes sex, certification not in R|NC-17
```

## Not built

- **Scrobbling** (Trakt/Simkl style, where Plex tells it what you watched). A plugin has no network listener; this is structurally impossible here.
- **Social** — reviews from other people, followers. Out of scope by choice.
- **Other media types** — books, games. Different product.
- **Manual list ordering** — lists are sets, sorted by whatever sort you pick.
- **Live Preview header card** — reading view only.

## Network use and your data

Stated plainly, because a plugin that talks to the internet from inside your
vault should say exactly what it sends and where.

**Requests are made only when you act** — searching, adding a title, refreshing
metadata, or opening a season. The one exception is a once-a-day refresh of
shows TMDB lists as returning, which you can turn off.

| Service | When | What is sent |
|---|---|---|
| **TMDB** | Search, add, refresh, open a season | Your search text, or a TMDB id. Plus your key. |
| **TMDB images** | First time a poster is cached | A poster path. No key. |
| **OMDb** *(optional)* | Enrichment | An IMDb id and your key. |
| **DoesTheDogDie** *(optional)* | Enrichment | A title and year, and your key. |

Nothing else leaves your machine. No analytics, no telemetry, no crash
reporting, no identifiers. Your ratings, reviews, watch history and notes are
never transmitted anywhere — they exist only as markdown in your vault.

**What the plugin writes:** notes in your films and series folders, poster
`.jpg` files in the poster folder, response caches under
`.obsidian/plugins/reel/cache/`, and settings in
`.obsidian/plugins/reel/data.json`. It appends to today's daily note only if
you turn that on, and never creates one. Nothing is written outside those
places.

**Your API keys** are encrypted at rest by default. See
[SECURITY.md](SECURITY.md) for the threat model, including what it does *not*
protect against.

**Third-party terms:** you supply your own keys, so their terms are between you
and them. This product uses the TMDB API but is not endorsed or certified by
TMDB.

## Licence

MIT.

## Checking the layout

Reel's layout could only be verified by shipping it and waiting for a
screenshot. That cost three regressions in a row, including a set of
"compact on mobile" rules keyed on a width media query that never matched on
a real device — inert while reading as perfectly correct.

```bash
npm run harness
npx serve -l 5599 .
```

Then open `http://localhost:5599/harness/?screen=library&phone=1` at a phone
viewport and paste `harness/audit.js` into the console.

The harness runs the **real** renderers against the **real** stylesheet, so a
screen that looks wrong there is wrong in the app. `?screen=` takes
`library`, `rows`, `stats`, `upnext`, `empties` or `stars`; `?phone=0` gives
the desktop layout.

Two things it deliberately gets right, because getting them wrong makes the
harness lie: `Platform.isPhone` is modelled (the compact rules key off it),
and `box-sizing: border-box` is set globally the way Obsidian does. Without
the second, the first run reported a 24px overflow that did not exist.

### Running it headlessly

```bash
npm run audit
```

Serves the repo, drives a real browser at 375×812 **and** 1280×900, reads the
audit's verdict and exits non-zero on failure. `npm run preflight` calls it, so
a layout regression stops a release the way a failing test does.

`puppeteer-core` rather than `puppeteer`: the full package downloads its own
Chromium (~200 MB) to render six screens, and any machine that can run
Obsidian already has a Chromium-based browser. The script finds Chrome or Edge
on Windows, macOS and Linux; set `REEL_CHROME` to override. With no browser
present it says so and exits 0 — a machine that cannot run the check should
not be blocked from cutting a release by it.

Running at both viewports is the point. The first headless run passed on phone
and failed on desktop: a stats row measured 41px because the phone layout gives
it more padding and it cleared 44 there. A check that runs at one width
verifies one width.
