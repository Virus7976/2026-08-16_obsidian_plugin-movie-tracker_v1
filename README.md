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

Your review goes here, as plain markdown, below the card.
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

## The five surfaces

### 1. Log something

Ribbon icon, mobile toolbar, or **Reel: log a film or series**. Debounced 300 ms against `/search/multi`, so one command finds both films and shows — two separate commands is more friction on a phone.

Pick a result → a sheet with date (defaults to today), tap-to-set stars, a liked toggle, and "watchlist instead". On a phone it's a bottom sheet, so the controls sit under your thumb rather than behind the keyboard.

### 2. Note header card

Any note with a `tmdb_id` gets a card rendered above your writing: poster, runtime, director, your rating, full watch history. For a show, a season strip — tap a season for its episode checklist.

Reading view only, since it's a markdown post-processor. In Live Preview you see the raw note, which is arguably what you want while writing.

### 3. Library

Drop this in any note:

````markdown
```films
filter: status = watched, year >= 2020
sort: watched desc
layout: poster-grid
```
````

Three posters across on a phone, sticky filter chips, tap to open, **long-press to quick-rate**.

Also `​```series` and `​```library` (both types).

| Option | Values |
|---|---|
| `filter:` | comma-separated `field op value`, all ANDed. Ops: `=` `!=` `>` `<` `>=` `<=` `contains` |
| `sort:` | `watched` `title` `year` `rating` `tmdb_rating` `runtime` `random`, plus `asc`/`desc` |
| `layout:` | `poster-grid` · `list` · `compact` |
| `limit:` | a number |
| `title:` | heading above the block |
| `chips:` | `false` to hide the filter bar |

Filterable fields: `status` `type` `title` `year` `decade` `rating` `tmdb_rating` `liked` `genre` `director` `creator` `runtime` `show_status` `watched` `episodes`.

### 4. Up next

````markdown
```up-next
limit: 8
```
````

The screen you'd open daily, and the one film has no equivalent for. Every row is one show you're partway through, and the whole row is one action: tap ✓, the range extends by one, `last_watched` moves, done. No modal, no navigation, one thumb.

Shows TMDB marks as `Returning Series` get refreshed once a day so a new episode gets a badge.

### 5. Stats

````markdown
```film-stats
year: 2026
include: all
```
````

Films per year, hours watched, top directors and creators, rating distribution, genres. Computed entirely from frontmatter already in the index — **zero API calls**, so it's safe on a dashboard note you open constantly.

## Commands

| Command | Notes |
|---|---|
| Log a film or series | |
| Add to watchlist | |
| Log the current note | only on a Reel note |
| Mark next episode watched | only on a series note |
| Open season checklist | |
| Toggle liked | |
| Refresh metadata from TMDB | your ratings and history are never touched |
| Download missing posters | throttled 250 ms/request |
| Lock the TMDB key | |
| Rebuild the library index | |

## Setup

1. Get a free TMDB key at <https://www.themoviedb.org/settings/api>. A **v4 read access token** (starts `eyJ`) is preferred — it goes in a header rather than the URL, so it can't end up in a log.
2. Settings → Reel → paste it → Save. You'll be asked for a passphrase; the key is encrypted before it's written. See [SECURITY.md](SECURITY.md).
3. Tap **Test** to confirm.

## Install

No release yet, so build it:

```bash
npm install && npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/reel/`, then enable it in Community plugins.

For development, point the build straight at your vault and use `npm run dev` for watch mode.

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

51 assertions over the range parser, rating maths, date handling and the query engine — the pure logic where an off-by-one would quietly corrupt watch history.

## Not built

- **Letterboxd import.** Dropped from scope. The CSV route is `diary.csv` + `ratings.csv` matched title+year against TMDB, throttled ~250 ms/request; roughly four minutes for 800 films. Straightforward to add later.
- **Watch providers.** Fetched and cached, not yet displayed.
- **Live Preview header card.** Reading view only.

## Licence

MIT.
