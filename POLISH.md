# Polish loop

A standing task: fix ten things, analyse ten more, repeat until told to stop.

This file is the loop's memory. It exists because the loop outlives any one
conversation — without it, each round would re-derive the list from scratch and
drift back to whatever was most recently on my mind.

**Rules for the loop.** Prefer findings the harness can *measure* over ones I
merely believe; a measured failure is a fact and an opinion is a guess. Fix the
thing rather than the check — an exemption needs a reason written next to it, or
the audit trains me to ignore it. Ship each round. Say plainly what was not
completed.

---

## Round 5 — in progress

Carried from round 4, where five items were listed and not built.

- [x] **1. `reel-fact × reel-fact` fails on desktop.** Not a check bug after
      all. The check reported the pair and not the amount, so a real fault
      looked like a mispaired comparison for two rounds. Made it report
      `by 16×44px at y=253/253`, which showed two rows side by side in the
      desktop layout overlapping horizontally because each sized to its
      content rather than to its column. Both viewports now pass 137/137.
- [x] **2. Dark theme.** The harness takes `?dark=1` and puts `theme-dark` on
      `<body>`, where Obsidian puts it, so every Reel colour resolves through
      the dark variables. `npm run audit` now runs four passes — phone and
      desktop, light and dark — and all four pass 137/137 with no changes
      needed to the app. The variable discipline held.

      **Caveat worth keeping:** the audit checks text contrast, not shadows.
      The six hard-coded `rgba(0,0,0,…)` shadows and the poster-loading
      gradient are still light-tuned and still unverified — a black shadow on
      a dark background is invisible rather than wrong, so nothing fails. That
      wants a check of its own before it can be called done.
- [ ] **3. Unused rules.** 706 rules, 86 matching a full detail screen. No way
      to tell which of the rest are still live.
- [ ] **4. The harness never interacts.** It renders and measures a static
      tree. "The rating UI shifted while I was typing" was a real bug a static
      render cannot catch.
- [ ] **5. Nothing measured over time.** No frame timing, no repaint cost.
      25 nodes per cell is a static count; what matters is how long a repaint
      takes after a rating.
- [ ] **6. No visual record.** Geometry catches overflow and sizing, not "these
      colours are ugly" or "that is the wrong icon".
- [x] **7. `npm run publish` times out.** The audit is out of `preflight` and
      into a new `npm run check` (preflight + tests + audit). A release step
      that has to be fast no longer launches a browser.
- [x] **8. `will-change`.** Declared on the five things that actually move
      under a finger, not everywhere — each hint costs the compositor a layer
      whether or not it is used, so blanket application is a memory leak
      wearing an optimisation's clothes.
- [x] **9. Focus.** One `:focus-visible` rule scoped to the view, modals and
      blocks, rather than sixty individual ones. A ring only some controls
      have is worse than none: it teaches you the ring means something it
      does not.
- [ ] **10. 25 DOM nodes per grid cell**, rebuilt on every repaint. Fine at 31
      titles, not at 300 — and it gets worse on its own.

- [x] **Extra — legacy cache files.** Names written before the filename
      carried a hash were long enough to break `git add` in a vault under
      version control, which is a plugin breaking a user's VCS over data it
      regenerates for free. They are also unreachable, since the current
      `cachePath` never produces those names. Pruned silently on load.

## Done

### Round 6 — the layout was asking the wrong question

The stylesheet decided its layout from `@media (min-width: …)`, which asks how
wide the *window* is. Reel lives in a pane. Docked in a sidebar, a 375px pane
matched every desktop rule at once; `measureWidth` meanwhile *returned early*
when the width read as 0 — detached leaf, hidden tab, not yet laid out — which
left the desktop layout in place with no later resize to correct it.

- **Fail safe, not open.** An unmeasured width now means compact. Compact is
  tight on a wide screen; wide is unusable on a narrow one.
- **`is-wNNN` replaces the width media queries** for anything inside the pane,
  stamped from the pane's own measurement. Sheets keep their queries — a modal
  really is viewport-sized, and mirroring it made the mirror outrank the
  deliberate rules written for sheets (it capped the recipe seed list at 40dvh
  and threw away the 52dvh a sheet is meant to get).
- **`npm run audit` builds the harness itself.** It did not, so running the
  runner directly served whatever bundle was on disk. An afternoon of edits to
  the checks sat unbuilt while five passes reported green.

Three things this round got wrong, recorded because the pattern repeats:

1. **A new pass that proved nothing.** The docked-pane pass passed on the old
   stylesheet too. `overflow: hidden` on the harness pane was hiding exactly
   what the checks needed to see — and the checks measured against
   `window.innerWidth`, the same mistake as the stylesheet.
2. **Four "bugs" that were the harness's fault.** Once the checks measured the
   pane, `rows`, `upnext`, `stats` and `empties` all overflowed. They were
   artifacts: the harness put `.reel-view` and `.reel-view-body` on one
   element, so every screen rendered as a flex item instead of block content in
   a scroller. With the *old* stylesheet and the *corrected* harness, all four
   pass. The `min-width: 0` additions are hardening, not fixes.
3. **The only proof is a check that fails before and passes after.** That is
   `bodyNoSideScroll`: the body is a scroll container, so a too-wide detail grid
   slides inside it rather than bursting the pane, and no width check could see
   it. Docked at 375px it scrolled 138px sideways on the old stylesheet.

Still unreproduced: the two bugs reported from the phone. `Copy layout
diagnostics` reports the measured width, the classes it produced and the
platform flags — geometry only — because the harness and that device disagree
about something and guessing from here has now failed four times.

### Round 4 — the audit's blind spots
Contrast, overlap and ceiling checks (78 → 137). `--text-faint` was being used
for text people read, on nine screens. Eleven controls gained `:active` states.
Fixtures gained a missing poster, a 100-character title, Japanese script, a
one-letter title, an every-badge row and a 34-season show.

### Round 3 — the harness itself
Real renderers, real stylesheet, real browser, both viewports, headless via
`npm run audit`. Found unequal grid tracks (`1fr` sizing to min-content) and a
desktop-only 41px target.

### Round 2 — measured failures
44px targets and 12px text, both of which the README already promised.

### Round 1 — the ten before that
Type scale, aria state, offline diagnosis and retry, search suggestions,
reactions, on-this-day, guided discovery.
