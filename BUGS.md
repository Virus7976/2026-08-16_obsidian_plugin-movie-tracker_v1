# Bug ledger

Every fault reported from a real device, and every fault found while chasing it.

Kept separate from `POLISH.md` on purpose. That file is a list of improvements I
proposed; this one is a list of things that were **wrong**. The second list is
the more useful of the two, because almost every entry in the right-hand column
was invisible until something in the left-hand column forced a look.

Status is one of **fixed** (shipped and verified in the harness), **fixed,
unverified on device** (shipped, but no snapshot from the phone confirms it),
and **open**.

---

## Reported from the device

| # | What was reported | Root cause | Status |
|---|---|---|---|
| R1 | Discover found nothing, even with filters cleared | `run()` intersected ~20 recommendations with page 1 of `/discover` — two unrelated samples that never overlap | fixed |
| R2 | Only one decade selectable | Single-value filter where the question is naturally multi-value | fixed |
| R3 | "I can't see anything on the library page" | Filter stack taller than a phone screen; first poster below the fold | fixed |
| R4 | "Everything is blocking my view" | Same as R3 | fixed |
| R5 | Rating UI shifted and glitched while typing | Layout reflow on every keystroke | fixed |
| R6 | Genre chips misaligned | `1fr` tracks sizing to min-content | fixed |
| R7 | No trailer in the preview; too much blank space | Trailer was an external link; sheet showed less than the screen it came from | fixed |
| R8 | "Where do lists go?" | Lists existed with no route to them from the view | fixed |
| R9 | "Still bad on mobile" | The compact layout was inert — see F2 | fixed |
| R10 | Discover broken on mobile | Same as F2 and F10 | fixed |
| R11 | Quick button showed a white screen | Unprotected `render()` inside a `.finally()`; a throw after `container.empty()` escaped as an unhandled rejection | fixed |
| R12 | Scrolling up said "nothing to take back" | Any 80px downward drag read as undo, and a downward drag *is* a scroll up | fixed |
| R13 | "I can't search" — top bar unusable | Obsidian's own header drawn over the search field | fixed, unverified on device |
| R14 | Navigation looked wrong | Hand-rolled controls ignoring Obsidian's classes | fixed |
| R15 | Stats page did not look native | Cards on cards; see the analysis in `POLISH.md` round 7 | fixed, unverified on device |
| R16 | Rating filter "completely changed the UI" | Filters re-entered a different render branch instead of narrowing | fixed |
| R17 | **An update lost the stored API keys** | `loadData()` returns null both for "no file" and "unreadable file"; defaults were then persisted over a good file | fixed |
| R18 | Cast faces left a column of blank space | `.reel-caststrip-track` wrapper never created, so cards stacked as blocks | fixed, unverified on device |
| R19 | Blank white area at the bottom of a title | Floating navigation not detected as chrome — see F23 | fixed, unverified on device |
| R20 | Stats *still* looked wrong after the restyle | Four screens' layout classes applied at once — F22 | fixed, unverified on device |
| R21 | Detail screen "looks clunky" | Same as R20 | fixed, unverified on device |
| R22 | Thumbnails looked bad | Low-resolution poster size | fixed |
| R23 | "Full details" showed less than the screen before it | The detail payload was fetched and mostly discarded | fixed |

## Found while chasing those

| # | What was actually wrong | Found because of | Status |
|---|---|---|---|
| F1 | `--reel-radius` was defined only on `.reel-block` but used 42 times, so every corner in the view was square | R3 | fixed |
| F2 | The entire compact stylesheet was inert: a viewport media query that never matched, then `Platform.isPhone`, which also failed | R9 | fixed |
| F3 | `flex-wrap: nowrap` without `min-width: 0` made rows wider than the pane and dragged the screen sideways | R4 | fixed |
| F4 | A bare `1fr` track has a min-content minimum, so one long title stretched its column to 317px and squeezed its neighbours to 125px | R6 | fixed |
| F5 | Cache filenames collided: `,` and `\|` both sanitised to `_`, so "Action AND Comedy" and "Action OR Comedy" shared one file | R1 | fixed |
| F6 | `--text-faint` was being used for text people read, at 2.85:1, on nine screens | R3 | fixed |
| F7 | The audit reported green for screens that had thrown and rendered nothing | R10 | fixed |
| F8 | 19 test assertions never ran — appended after `process.exit` | F7 | fixed |
| F9 | `measureWidth` failed *open*: an unmeasurable width left the desktop layout in place | R9 | fixed |
| F10 | Layout keyed off *viewport* width while living in a *pane*; docked narrow on a desktop it matched every desktop rule at once | R10 | fixed |
| F11 | A generated mirror outranked the deliberate rule it copied, capping the recipe seed list at 40dvh instead of 52 | F10 | fixed |
| F12 | `npm run audit` never rebuilt the harness, so an afternoon of edits to the checks sat unbuilt while five passes reported green | F10 | fixed |
| F13 | The checks measured `window.innerWidth` — the stylesheet's own mistake, and the reason they could not catch it | F10 | fixed |
| F14 | The harness put `.reel-view` and `.reel-view-body` on one element, manufacturing four overflows that do not exist | F13 | fixed |
| F15 | Sheet action buttons sat under the floating toolbar, with nothing to scroll to reach them | R13 | fixed |
| F16 | A collapsed search row still held focusable children — tab order running through a field nobody can see | R13 | fixed |
| F17 | The sort dropdown was 34px against a promised 44 | R14 | fixed |
| F18 | The target checks counted `visibility: hidden` elements as targets | F16 | fixed |
| F19 | `touchTargets44` measured the *painted box*, so enforcing it turned every chip into a 60px lozenge | R14 | fixed |
| F20 | **`document.querySelector(".view-header")` returned a 0×0 header** from a closed leaf, so the inset computed as zero and R13 was never actually fixed — through three attempts | R13 + a device snapshot | fixed |
| F21 | The generated mirrors were appended at end-of-file, so every one outranked every rule written afterwards | R15 + a device snapshot | fixed |
| F22 | **Screen classes accumulated on the shared body**: `reel-discover reel-detail reel-move-back reel-stats` all at once | R20 + a device snapshot | fixed |
| F23 | Bottom chrome detection missed a floating navigation bar, so content ran underneath it | R19 | fixed |
| F24 | All twelve months drew whenever any had data — eleven zero rows, in a chart grid measured at 8930px | R15 | fixed |
| F25 | The snapshot tool measured with the command palette still open, blaming `div.modal-bg` for 22 controls including four of Obsidian's own | using the snapshot tool | fixed |

## Checks that were wrong, not code

Recorded because they cost more than the bugs did — each one had me about to
change working code.

| # | The check said | It was actually | Status |
|---|---|---|---|
| C1 | `reel-fact × reel-fact` overlapping | Real, but reported the pair and not the amount, so it read as a mispaired comparison for two rounds | fixed |
| C2 | Chips are 32px, below the 44px minimum | The tap area *was* 44px; the check measured paint | fixed |
| C3 | A collapsed row's controls overlap | They were `visibility: hidden` and not targets at all | fixed |
| C4 | `reel-chip under reel-chip` | The two chips were 130px apart. An artifact of the harness mounting a fixed-position sheet inside a fake narrow pane | fixed, and the exclusion is printed rather than silent |
| C5 | Everything passes | The audit was serving a stale bundle (F12) | fixed |

---

## The pattern

Twenty-three reports produced twenty-five further faults, and five of my own
checks were wrong. Three entries — F20, F21, F22 — were found only when a
snapshot arrived from the actual device, and all three had survived a fix that
was verified green in the harness.

The harness models one workspace leaf, one header, and one screen mounted fresh.
The device has several leaves, a zero-sized header first in document order, and
one body element that every screen paints into in turn. Every difference between
those two facts produced a bug that could not fail locally.
