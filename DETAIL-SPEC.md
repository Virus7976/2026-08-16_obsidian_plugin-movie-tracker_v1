# Detail screen — full inventory

Every element in the 17 reference screenshots, mapped to a data source and a
status. Two sources are represented: a Moviebase-style tracker app (tabbed
detail) and IMDb's mobile web (long-scroll detail).

Status values: **done** · **buildable** (data available, not built) ·
**partial** (some of it is reachable) · **blocked** (no legitimate source).

The reason anything is blocked: IMDb has no public API. Scraping it breaks
their terms and shatters the first time they change markup, so anything only
IMDb holds is a deep link at best.

---

## 1. Header / hero

| Element | Source | Status |
|---|---|---|
| Title, year, certificate, runtime | TMDB | **done** |
| Poster | TMDB, cached to vault | **done** |
| Overview | TMDB | **done** |
| Genre chips | TMDB `genres` | **done** |
| Your rating / IMDb / Metacritic / RT / TMDB scores | TMDB + OMDb | **done** |
| Trailer button | TMDB `videos` | **done** |
| Trailer inline with duration + play overlay | TMDB `videos` has `key`; duration is not returned | **partial** — button only |
| IMDb vote count ("1.2M") | OMDb `imdbVotes` — already fetched, not displayed | **buildable** |
| Popularity rank + trend arrow | TMDB `popularity` (a float, no rank or delta) | **partial** — no trend |
| "1 VIDEO" / "99+ PHOTOS" counts | TMDB `videos`, `/images` endpoint | **buildable** |
| Photo gallery | TMDB `/images` | **buildable** |
| Add-to-list `+` overlay on poster | Reel lists | **done** (elsewhere in UI) |

## 2. People

| Element | Source | Status |
|---|---|---|
| Cast list with headshots, name, character | TMDB `credits.cast.profile_path` | **done** |
| Crew list with headshots, name, job | TMDB `credits.crew` | **done** |
| Tap a person → what else of theirs you own | Reel library search | **done** |
| Top-cast circular strip (IMDb style) | same data, different layout | **buildable** |
| Director / Writer / Stars summary rows | TMDB `credits` | **partial** — director shown in hero |
| "All cast & crew" full screen | TMDB `credits` | **done** (Cast/Crew tabs) |
| Favourite a person (heart) | no Reel concept of a followed person | **buildable** — needs a design decision |

## 3. Storyline / reference

| Element | Source | Status |
|---|---|---|
| Keywords as chips | TMDB `keywords` — already stored | **buildable** |
| Taglines | TMDB `tagline` field | **buildable** |
| Plot summary vs synopsis | TMDB has one `overview` | **blocked** |
| Trivia | IMDb only | **blocked** — link |
| Goofs | IMDb only | **blocked** — link |

## 4. Details

| Element | Source | Status |
|---|---|---|
| Studios / production companies | TMDB | **done** |
| Countries of origin | TMDB `production_countries` | **done** |
| Languages | TMDB `spoken_languages` | **done** |
| Also known as / alternative titles | TMDB `alternative_titles` | **done** |
| Release date (primary) | TMDB | **done** |
| Official site | TMDB `homepage` | **buildable** |
| Filming locations | IMDb only | **blocked** |

## 5. Releases

| Element | Source | Status |
|---|---|---|
| Per-country dates grouped by kind | TMDB `release_dates` | **done** |
| Certification per country | TMDB `release_dates` | **done** |
| Note (IMAX, city) | TMDB `release_dates.note` | **done** |
| Country flags | needs a flag asset or emoji from ISO code | **buildable** |
| Your own region sorted first | Reel setting | **done** |

## 6. Box office

| Element | Source | Status |
|---|---|---|
| Budget | TMDB | **done** |
| Revenue (worldwide total) | TMDB | **done** |
| Return on budget | derived | **done** |
| Gross US & Canada (split) | IMDb / Box Office Mojo only | **blocked** |
| Opening weekend | IMDb only | **blocked** |

## 7. Tech specs

| Element | Source | Status |
|---|---|---|
| Runtime | TMDB | **done** |
| Colour, sound mix, aspect ratio | IMDb only | **blocked** |

## 8. Content / parents guide

| Element | Source | Status |
|---|---|---|
| Certificate | TMDB | **done** |
| Link to IMDb parents guide | deep link | **done** |
| MPA rating reason text | IMDb only | **blocked** |
| Severity bands (Sex & Nudity, Violence, Profanity, Drugs, Frightening) | DoesTheDogDie vote ratios — already integrated | **buildable** |
| Per-item community notes | DTDD topic names | **buildable** |
| Content flags on the note | Reel `content_flags` | **done** |

## 9. Related / discovery

| Element | Source | Status |
|---|---|---|
| Related films strip | TMDB `recommendations` | **done** |
| "More like this" cards with rating + rate button | TMDB `similar` | **partial** — no inline rate |
| Watch options per card | TMDB `watch/providers` | **buildable** |
| Top picks (personalised) | Reel Discover | **done** (own tab) |
| Mentions (retailer/podcast logos) | Moviebase-specific partnerships | **blocked** |

## 10. Reviews

| Element | Source | Status |
|---|---|---|
| Your own review | Reel, appended to the note | **done** |
| Community reviews | TMDB `reviews` | **buildable** |
| Letterboxd popular reviews | no public API | **blocked** |
| Review count | TMDB `reviews.total_results` | **buildable** |

## 11. Links

| Element | Source | Status |
|---|---|---|
| IMDb | `external_ids` | **done** |
| TMDB | id | **done** |
| JustWatch | region + title search | **done** |
| Parents guide | IMDb deep link | **done** |
| Official site | TMDB `homepage` | **buildable** |
| Letterboxd | slug from TMDB id | **buildable** |

## 12. List view (IMDb lists screenshot)

| Element | Source | Status |
|---|---|---|
| Numbered list with poster | Reel library | **partial** — grid, not numbered list |
| Year · runtime · certificate · metascore inline | Reel entry | **buildable** |
| Rating with vote count | OMDb | **buildable** |
| Inline Rate control | Reel | **done** (long-press quick rate) |
| Mark as watched inline | Reel | **done** (Up next tick) |
| Overview + Director + Stars in row | Reel entry | **buildable** — list layout exists |

---

## Build order

Ranked by value per unit of work, given what is already fetched.

1. **Keywords + tagline** — already in the payload, nothing new to fetch.
2. **IMDb vote count** — already fetched via OMDb, simply not rendered.
3. **Official site + Letterboxd links** — one field, one derived URL.
4. **DTDD severity bands** — the parents guide substitute, and the closest
   thing to the screenshot the user actually asked for. Data already
   integrated; needs a band UI (mild / moderate / severe from vote ratio).
5. **TMDB community reviews** — one appended field, a real gap against the
   reference.
6. **Photos gallery** — new endpoint, high visual payoff.
7. **Country flags on releases** — cosmetic, derive emoji from ISO code.
8. **Watch options per related card** — providers already fetched per title,
   but needs a fetch per related item, so it is the most expensive item here.

## Explicitly not building

Anything marked **blocked** above. Each is IMDb- or vendor-exclusive with no
public API. Where the reference shows it, Reel links out instead:

- Trivia, goofs, plot synopsis, filming locations
- Tech specs (colour, sound mix, aspect ratio)
- Opening weekend and territorial box-office splits
- MPA rating reason prose
- Letterboxd reviews
- Moviebase "Mentions"
