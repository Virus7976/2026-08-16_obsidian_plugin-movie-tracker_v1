# Releasing

The goal: updates appear inside Obsidian, so nobody copies files by hand.

There are two ways Obsidian learns a new version exists. Both need the same
thing — a **GitHub release whose tag equals `manifest.json`'s version**, with
`main.js`, `manifest.json` and `styles.css` attached as **loose files**, not a
zip.

## The rule that bites everyone

Obsidian matches the release **tag** against `manifest.version`. If they differ
— including a `v` prefix — Obsidian doesn't error. It just never offers the
update, and you're left wondering why the plugin looks stale.

So: tag `0.3.0`, never `v0.3.0`. `npm run release` derives the tag from the
manifest precisely so it can't be typed wrong, and `scripts/preflight.mjs`
fails the build if anything drifts.

## First-time setup

You need the repo on GitHub and public. From the plugin folder:

```bash
gh repo create obsidian-reel --public --source=. --remote=origin --push
```

If `gh` isn't installed, create the repo in the browser and then:

```bash
git remote add origin https://github.com/<you>/obsidian-reel.git && git push -u origin master
```

## Cutting a release

1. Bump the version in **three** places — `manifest.json`, `package.json`, and
   a new entry in `versions.json` mapping it to `minAppVersion`.
2. Commit.
3. Run:

```bash
npm run release
```

That builds, runs the preflight checks, tags from the manifest, and pushes. The
`release` workflow then builds again on a clean checkout, runs the tests, and
publishes the three assets.

To check before committing to anything:

```bash
npm run preflight
```

## How people get updates

### Now — BRAT

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs and updates
plugins straight from a GitHub repo, without waiting for the community store.

1. Install **Obsidian42 - BRAT** from Community plugins.
2. BRAT → *Add a beta plugin for testing* → paste the repo URL.
3. BRAT checks for new releases on startup and updates automatically. Turn on
   *Auto-update plugins at startup* in BRAT's settings.

This is the fastest route and needs no review. Anyone you share the repo with
gets the same.

### The community store

Submission is **not** a pull request against `community-plugins.json` any more.
It goes through the plugin directory:

1. Sign in at <https://community.obsidian.md> with your Obsidian account.
2. Link your GitHub account, which is how ownership of the repo is verified.
3. Add the plugin through the directory interface.

The directory reads `manifest.json` **at the HEAD of the repo's default
branch**, so that file must be committed and pushed before you submit — not
merely present in a release.

An automated check runs and tells you what to fix. Each round of fixes needs a
**new release with a higher version**; you can't re-tag. Once the checks pass,
Reel appears in Community plugins and updates arrive through Obsidian's own
*Check for updates*, with no BRAT involved.

The id `reel` was free as of the last check against the ~700 published plugins,
so no rename is needed — but ids are first-come, so submitting sooner protects
it.

## Version numbers

`versions.json` maps each plugin version to the minimum Obsidian version it
needs. Obsidian reads it to decide which build to offer someone on an older
app — without an entry, a release can be skipped silently.

Bump the **minor** version when adding features, **patch** for fixes. Bump
`minAppVersion` only when you actually use a newer API, since raising it
excludes people.
