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
| IMDb vote count ("1.2M") | OMDb `imdbVotes` | **done** — was fetched then discarded; now stored and shown |
| Popularity rank + trend arrow | TMDB `popularity` (a float, no rank or delta) | **partial** — no trend |
| "1 VIDEO" / "99+ PHOTOS" counts | TMDB `videos`, `/images` | **partial** — gallery exists, no count badge |
| Photo gallery | TMDB `/images` | **done** — own tab, fetched lazily |
| Add-to-list `+` overlay on poster | Reel lists | **done** (elsewhere in UI) |

## 2. People

| Element | Source | Status |
|---|---|---|
| Cast list with headshots, name, character | TMDB `credits.cast.profile_path` | **done** |
| Crew list with headshots, name, job | TMDB `credits.crew` | **done** |
| Tap a person → their filmography | TMDB `/person` + `combined_credits` | **done** — titles you own are ticked |
| Top-cast circular strip (IMDb style) | same data, different layout | **done** — above the tabs |
| Director / Writer / Stars summary rows | TMDB `credits` | **partial** — director shown in hero |
| "All cast & crew" full screen | TMDB `credits` | **done** (Cast/Crew tabs) |
| Favourite a person (heart) | no Reel concept of a followed person | **buildable** — needs a design decision |
| Person biography, birth year | TMDB `/person` | **done** |

## 3. Storyline / reference

| Element | Source | Status |
|---|---|---|
| Keywords as chips | TMDB `keywords` | **done** — read from the payload, not stored per note |
| Taglines | TMDB `tagline` | **done** |
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
| Official site | TMDB `homepage` | **done** |
| Filming locations | IMDb only | **blocked** |

## 5. Releases

| Element | Source | Status |
|---|---|---|
| Per-country dates grouped by kind | TMDB `release_dates` | **done** |
| Certification per country | TMDB `release_dates` | **done** |
| Note (IMAX, city) | TMDB `release_dates.note` | **done** |
| Country flags | regional indicator emoji from the ISO code | **done** |
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
| Community reviews | TMDB `reviews` | **done** — excerpt + attribution + link, never reproduced whole |
| Letterboxd popular reviews | no public API | **blocked** |
| Review count | TMDB `reviews.total_results` | **done** — on the tab label |

## 11. Links

| Element | Source | Status |
|---|---|---|
| IMDb | `external_ids` | **done** |
| TMDB | id | **done** |
| JustWatch | region + title search | **done** |
| Parents guide | IMDb deep link | **done** |
| Official site | TMDB `homepage` | **done** |
| Letterboxd | `letterboxd.com/tmdb/{id}` | **done** — films only |

## 12. List view (IMDb lists screenshot)

| Element | Source | Status |
|---|---|---|
| Numbered list with poster | Reel library | **partial** — grid, not numbered list |
| Year · runtime · certificate · metascore inline | Reel entry | **done** — full list layout |
| Rating with vote count | OMDb | **done** |
| Inline Rate control | Reel | **done** (long-press quick rate) |
| Mark as watched inline | Reel | **done** (Up next tick) |
| Overview + Director + Stars in row | Reel entry | **done** — two-line clamp |

---

## Build order

Ranked by value per unit of work, given what is already fetched.

Done: keywords, tagline, IMDb vote count, official site, Letterboxd,
community reviews, and the content tab.

Remaining, cheapest first:

1. **Watch options per related card** — needs a providers fetch per related
   item, so it is by far the most expensive thing left.

Correction to an earlier estimate: the IMDb vote count was listed as "already
fetched, not displayed". It was fetched by OMDb and then thrown away — never
written to the note — so it needed a field on the entry and the index too, not
just a render.

The DTDD severity bands were dropped rather than built. Only topic names reach
the note; the vote counts decide whether a topic qualifies and are discarded.
Any band would have been invented, so the Content tab states what the data
actually means and links to IMDb's graded guide instead.

## Explicitly not building

Anything marked **blocked** above. Each is IMDb- or vendor-exclusive with no
public API. Where the reference shows it, Reel links out instead:

- Trivia, goofs, plot synopsis, filming locations
- Tech specs (colour, sound mix, aspect ratio)
- Opening weekend and territorial box-office splits
- MPA rating reason prose
- Letterboxd reviews
- Moviebase "Mentions"
