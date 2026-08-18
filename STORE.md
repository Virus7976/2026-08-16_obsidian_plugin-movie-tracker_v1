# Community store submission

Reel is **not** in the Obsidian community store. Verified against the source of
truth, `obsidianmd/obsidian-releases` → `community-plugins.json`: there is no
entry with `id: "reel"`, and none whose `repo` is under `Virus7976`.

That matters more than it sounds. Until it is listed, "update from the store"
cannot happen, and every release this repo builds reaches GitHub and stops
there. **BRAT is what delivers to a phone today.**

## Installing on a phone right now

In Obsidian → Community plugins, install **BRAT**, then *Add beta plugin* with:

```
Virus7976/2026-08-16_obsidian_plugin-movie-tracker_v1
```

Every `npm run publish` after that appears as an update.

## Decisions

These were delegated, so they are made here rather than left open.

### Keep `id: "reel"` — do not rename it

The id is generic, and a reviewer may say so. It stays anyway, because the cost
of changing it is concrete and the benefit is aesthetic.

Obsidian stores a plugin's data at `.obsidian/plugins/<id>/data.json`. Changing
the id points the plugin at a directory that does not exist: settings gone,
folder choices gone, and the AES-256-GCM key blob gone — the encrypted TMDB,
OMDb and DoesTheDogDie keys, which have no recovery and must be typed again.

That is precisely the loss `util/settingsguard.ts` exists to prevent. Causing it
deliberately, to make a name tidier, would be the wrong trade. If a reviewer
insists, the answer is a migration that reads the old directory first — not a
rename on its own.

The manifest passes every mechanical rule: the id does not begin with
"obsidian", contains no "plugin", the name does not say "Obsidian", and the
description is 196 characters against a 250 limit.

### Rename the repository — needs one action, and now is the cheapest moment

`2026-08-16_obsidian_plugin-movie-tracker_v1` is a dated scratch name that
becomes the permanent public identity of the listing. It should be
`obsidian-reel`, which is what `PUBLISHING.md` assumed throughout.

**This one cannot be done from here.** `gh` is not installed, and the only
credential to hand is a `ghp_` token embedded in a vault's git remote, which is
not mine to use — it should be rotated rather than borrowed.

Timing argument for doing it before anything else: a rename changes the BRAT
identifier. Since BRAT is not yet set up, renaming now costs nothing. Renaming
after it is added means re-adding the beta plugin by hand.

To do it: GitHub → the repo → Settings → rename to `obsidian-reel`. Then locally:

```bash
git remote set-url origin https://github.com/Virus7976/obsidian-reel.git
```

GitHub redirects the old URL, so existing clones keep working either way.

## What is not ready

Store review is a human reading the code, not a linter. Two things would draw a
reasonable objection today:

- **The mobile bugs reported from a real device are not all confirmed fixed.**
  They are fixed in the harness; they have not been seen working on the phone,
  because no release since 0.7.65 has reached it. A reviewer opening Discover
  and hitting a white screen is a rejection, and that specific bug has never
  been reproduced here.
- **Nothing has been verified on iOS.** The insets, the collapsing search row
  and the gesture thresholds were all built against one Android device's
  measurements.

## Submission, when those are settled

1. Rename the repo (above), and push a release from the renamed repo so the
   release URL matches.
2. Fork `obsidianmd/obsidian-releases`.
3. Append to `community-plugins.json`:

```json
{
  "id": "reel",
  "name": "Reel",
  "author": "Virus7976",
  "description": "Track films and series with TMDB metadata. Poster library, reviews, episode ratings, personalised discovery, content filtering, Up Next and stats — all computed from frontmatter. Built for mobile.",
  "repo": "Virus7976/obsidian-reel"
}
```

4. Open a pull request using their plugin template. Expect weeks, and expect
   change requests.

Requirements already met: `main.js`, `manifest.json` and `styles.css` attached
as loose files to a release tagged exactly the version number; a README; an MIT
licence; `isDesktopOnly: false` and no Node built-ins in the bundle, which the
build workflow asserts on every push.
