# Teach Mode with Timers — Design

## Intent and why

LeViz is strong before class and silent during it. A teacher still needs a separate
timer for each segment and a way to see the current layout, station prompts, and groups
without the editor chrome.

Add a **read-only teach mode** that runs the planned lesson segment by segment with a
large countdown, the current text or layout, station/role cards, and a rotation guide
for station-rotation and gallery-walk layouts (with an optional manual guide for other
layouts). It never edits the lesson.

## Goals

- Launch teach mode from a lesson card, the editor top bar, and the lesson overview.
- Run timed segments in order with an accurate countdown: start, pause, reset, +1 min,
  previous, next. Text and layout segments share the same timer; only their content and
  rotation guide differ.
- Show the current segment's text, activity instructions, layout thumbnail, station/role
  notes, and assigned groups.
- Provide a rotation guide for `station-rotation` and `gallery-walk` layouts, plus an
  optional manual guide for other layouts with eligible stops: the current stop, a
  per-round countdown derived from the segment timer, and a manual "Next stop".
- Pause at zero with a clear "Time's up" state; never auto-advance.
- Keep the run usable after an accidental reload (restore paused) and with a keyboard.
- Optional sound: an off-by-default toggle with a soft chime at zero.

## Non-goals

- Student-facing view, student accounts, or a second screen.
- Editing the lesson, moving furniture, assigning students, or changing the plan.
- Automatic group rotation or automatic station movement; the teacher moves groups.
- Recording actual elapsed time, participation, or engagement in V1.
- Grading, attendance, or notifications.
- Replacing the editor or the printed overview.
- Screen wake-lock, fullscreen, and projector-specific controls in V1 (V1.1).
- Cross-device sync; the app remains local-only until Phase 2.

## Anti-goals

- Auto-advancing to the next segment and starting its timer without the teacher.
- Two competing clocks that can drift (the segment timer is the source of truth).
- A timer that misses time because a background tab throttles `setInterval`.
- Losing the current station or remaining time on a reload.
- Any teach-mode action writing to the lesson.

## Current state

- `openLesson` loads the lesson and roster; the editor renders edit and overview modes.
- `durationMin` exists on every segment; `totalMinutes` sums the plan.
- The overview already renders rich text (`RichTextView`), layout thumbnails
  (`LayoutThumbnail`), station notes, assignments, and activity instructions.
- There is no timer, run state, or teach route.
- Routing uses `HashRouter`; routes are `/lessons/:lessonId`.

## Activity coverage

Text segments are always timed in the normal run and have no rotation guide. Coverage
below applies to layout segments:

| Activity | Guide | Stops (reading order) | Groups |
|---|---|---|---|
| Harkness discussion | No | — | One circle; students stay seated |
| Debate | No | — | Two fixed sides |
| Mock trial | No | — | Roles are fixed |
| Group discussion | No | — | Groups stay at their tables |
| Gallery walk | Yes, automatic | `wall-anchor` stops with a note or label | The class moves; stops carry prompts, no assigned group |
| Station rotation | Yes, automatic | `station` nodes with `capacity > 0` | Planned group per station |
| Free-for-all | Optional | Manual toggle with 2+ eligible stops | — |
| Custom | Optional | Manual toggle with 2+ eligible stops | — |

- Manual mode is available for any layout with at least two eligible stops. Eligible
  stops are `station` and `round-table` nodes with `capacity > 0`, plus `wall-anchor`
  nodes with a note or label. Teacher, chair, desk, and podium nodes are excluded.
- The manual toggle is off by default for non-rotation activities and on for station
  rotation and gallery walk; it can also turn the automatic guide off.
- The guide is a timing aid, not a group tracker. In a gallery walk the whole class moves
  and the stop prompts are the content; no groups are implied.

## Approaches considered

1. **Segment timer + derived, manually-advanced rotation guide — chosen.**
   One countdown per segment driven by timestamps. For a rotation layout, a strip shows the
   current stop and a per-round countdown computed from the segment's elapsed time and
   the time the teacher advanced the stop. The teacher clicks "Next station/stop"; the
   strip restarts its countdown. The segment timer remains the only clock that can
   pause/resume the lesson.
2. **Segment timer only.** Simplest, but no rotation guidance; not selected.
3. **Independent rotation timer.** A second start/pause clock per round with automatic
   station advance. More control, but two clocks compete, can drift, and auto-advance can
   surprise a teacher mid-activity.

## Route, entry points, and loading

- New route: `/lessons/:lessonId/teach` → `TeachPage`.
- Entry points:
  - **Lesson card:** an always-visible "Teach" button with a play icon in the card
    footer. Export/delete remain hover actions.
  - **Editor top bar:** a "Teach" button next to Overview.
  - **Overview:** a "Teach" button next to Edit/Print.
- `TeachPage` loads with `openLesson` and closes with a **save-free** close
  (`closeLesson({ save: false })` or a `closeLessonReadOnly` helper) so entering or
  leaving teach never bumps `updatedAt` or rewrites the document. It renders no editor
  chrome, panels, or editor hotkeys.
- Entering teach from the editor still runs the editor's normal close-save; that is how
  pending edits are persisted today, and the teach page itself never writes. Entering
  from a lesson card has no editor close and leaves the document untouched.
- It shows loading, missing, and error states; missing/error reuse the editor's copy.
- Exit returns to `/lessons/:lessonId` (the editor).
- Read-only: no edits, no autosave mutations, no roster/class mutations.

## Run data

- A pure `buildTeachRun(segments)` helper returns the timed run:
  - includes text and layout segments in lesson order with `durationMin > 0`;
  - skips zero/negative/NaN durations (planning notes do not run);
  - carries `startMin`, `endMin`, `durationMin`, the original segment, and its
    lesson order.
- If no segment has time, the teach page shows "No timed segments" with an exit.
- The run starts paused on the first timed segment at its full duration.
- The header shows the lesson title, current segment title, `Segment N of M`, planned
  total/end, and the roster/class size. It does not need the class library name.

## Timer semantics

- Source of truth is a timestamp: while running, `endsAt = now + remainingMs`; the
  displayed remaining is recomputed from `endsAt` on every tick. `setInterval` only
  paints; it never owns the countdown.
- Initial state: paused, first segment, full duration.
- **Start** begins or resumes. **Pause** freezes the remaining time. **Reset** returns to
  the segment's full duration and pauses. **+1:00** adds a minute to the current segment,
  whether running or paused.
- **Previous/Next** move one timed segment and pause at the full duration. They never
  auto-start.
- At zero: pause, show "Time's up", and keep Next prominent. A soft chime plays if sound
  is enabled. Never auto-advance.
- Display: large `MM:SS` (tabular), the segment title, a segment progress bar, and the
  lesson progress across timed segments. Last 30 seconds use the warning color plus a
  text label; time-up uses "Time's up" text, not color alone.
- When paused, the big control shows Start; when running, Pause. The state is always
  named in text (Running / Paused / Time's up).
- The planned end time is derived from the current remaining time plus all later timed
  segments and shown as a clock time (e.g., "Planned end ~10:42").
- `sessionStorage` per lesson stores `{ segmentId, remainingMs, stopIndex, stopStartElapsedMs,
  rotationMode }` on every state change and on `pagehide`/visibility hidden;
  a reload restores **paused** at that segment, time, and stop (clamped to the
  lesson's current timed segments and stop count). Exit clears the key. Sound
  preference persists in `localStorage`.

## Segment content

**Text segment:** the same segment countdown runs above the content. Render
`RichTextView` in the lesson serif at a comfortable measure; scroll if long. Empty
content shows a muted "No text for this segment." A zero-minute text segment is a
planning note and is skipped from the run, like any other zero-minute segment.

**Layout segment:**
- Activity instructions (plain text) in a compact card, if present.
- A read-only `LayoutThumbnail` for orientation; it is not interactive.
- **Station/role cards** in reading order (`y`, then `x`) for nodes that have a note or
  assigned students, plus station-like nodes (`station`, `round-table`, `podium`,
  `wall-anchor` with a note). Each card shows the node label, its note title/body, the
  assigned group (names from the lesson roster), and capacity. Teacher/wall-anchor nodes
  with no note and no students are omitted.
- Gallery-walk stops show their prompt; they have no assigned group.
- The teach view does not move groups. For station rotation, the cards show the
  **planned group for each station** as the starting assignment.

**Next preview:** a small "Next: [title] · N min" line below the content, or "Last
segment."

## Rotation guide (Approach A)

- Automatic for `station-rotation` and `gallery-walk`; optional manual mode for any other
  layout with at least two eligible stops.
- Stop sets:
  - Station rotation: `station` nodes with `capacity > 0`, reading order. Cards show the
    planned group at each station.
  - Gallery walk: `wall-anchor` stops with a note or label, reading order. Cards show the
    stop prompt; there are no assigned groups.
  - Manual: `station` and `round-table` nodes with `capacity > 0`, plus `wall-anchor`
    nodes with a note or label, in reading order. Teacher, chair, desk, and podium nodes
    are excluded.
- The "Rotation guide" toggle is visible when a layout has at least two eligible stops.
  It defaults on for station rotation and gallery walk and off otherwise, and can turn
  the automatic guide off.
- With fewer than two stops, no guide.
- Round length = the segment's live duration (planned + any +1:00 additions) ÷ active
  stop count. Adding time mid-run lengthens the current and later rounds.
- State: current stop index and the segment elapsed time when that stop started. The
  rotation countdown = round length − (current segment elapsed − stop start elapsed),
  clamped at zero. It advances only while the segment timer runs, so pause pauses it too.
- The strip shows `Station X of N · rotate in MM:SS` for station rotation and
  `Stop X of N · rotate in MM:SS` for gallery walk and manual mode, highlighting the
  current stop. At zero it shows "Rotate now" and waits; it never advances automatically.
- **Next station/stop** increments the stop index and resets the stop start to the
  current segment elapsed. At the last stop the button is disabled ("Last stop").
- The current stop's card is highlighted. For station rotation, cards show the planned
  group; for gallery walk, the stop prompt. Groups do not move in the plan; the teacher
  moves the class.
- If the teacher advances early, the countdown restarts; the segment timer is unaffected.
  This is a guide, not a second source of truth.
- Non-rotation layouts with no manual guide get the cards but no rotation strip.

## Controls and keyboard

- Primary controls: Start/Pause, Reset, +1:00, Previous, Next, Exit.
- Keyboard: `Space` start/pause, `←` previous, `→` next, `R` reset, `Escape` exit.
  Ignore shortcuts while a dialog is open and prevent Space from scrolling.
- Exit returns to the editor. The run state is cleared.
- The sound toggle is in the header; default off. With sound on, a soft two-tone chime
  plays at segment zero. Audio is initialized on the Start/toggle user gesture.
- Fullscreen and wake-lock are V1.1.

## Visual direction

- Full-viewport, calm, high-contrast teaching surface using existing tokens; no new
  theme. The timer is the visual anchor; the content is readable at a distance.
- Desktop/laptop first; a tablet in landscape is usable. On narrow widths the layout
  content stacks below the timer.
- No entrance animations; progress transitions respect `prefers-reduced-motion`.
- Text labels accompany every color state (Running, Paused, Time's up, Rotate now).

Sketch:

```
← Exit    Harkness discussion · 12 on roster                  Planned end ~10:42  [sound]
Station rotation · Segment 3 of 8
┌──────────────────────────────────────────────────────────────────────────┐
│  03:45        STATION 2 OF 4 · ROTATE IN 01:12          [Next station]   │
│  ████████████████████████░░░░░░░░  [Pause] [Reset] [+1:00]              │
└──────────────────────────────────────────────────────────────────────────┘
┌ thumbnail ┐  Station 2 — “Compare the two sources…”     Planned group:
│           │  Ada, Grace, Alan                           Alice, Ben, Cy
└───────────┘  Next: Debrief · 5 min
[◀ Previous]                                                     [Next ▶]
```

## Testing

- Domain: `buildTeachRun` skips zero/negative durations and computes starts/ends;
  station extraction and round length; the timer reducer/hook with a fake clock
  (start, pause, tick from timestamps, add, reset, next/prev, time-up, station next).
- UI driver: a new `--flow teach` — create a lesson with a text segment, a
  station-rotation layout with notes/groups, and a gallery-walk layout with wall-anchor
  prompts; enter from the lesson card; verify the route, the text segment's timer,
  start/pause, +1, previous/next, time-up (using Playwright's clock to avoid real
  waits), both automatic rotation strips (station and stop wording), the manual toggle
  on a custom layout, next preview, sound toggle, exit, and the editor/overview Teach
  entries. Verify the editor is untouched.
- Session restore: reload the teach page mid-run and assert it comes back paused at the
  saved segment, time, and station.
- Read-only: entering from a lesson card and exiting teach leaves the lesson's
  `updatedAt` and content unchanged; the editor→teach transition may persist the
  editor's pending edits, as today.
- Accessibility: all controls are buttons with names; shortcut help is visible; states
  are labeled; focus is visible.
- Existing 122 tests and both existing driver flows stay green.

## Phases

- **V1:** route + entry points, timed run, text/layout content, automatic station-rotation
  and gallery-walk guides, the manual rotation toggle, sound toggle, keyboard, session
  restore, tests, driver.
- **V1.1:** fullscreen, screen wake-lock, clickable segment rail/jump, rotating displayed
  groups, and the linked class name in the header.
- **V2:** actual-vs-planned time logging and post-lesson reflection; cross-device sync
  after the Phase 2 backend.

## Risks

- **Rotation semantics:** the plan assigns groups to station pods, while gallery-walk
  stops have prompts and no groups. V1 shows the planned group per station and labels
  the strip as timing guidance, not a group tracker. A rotating-group display is V1.1.
- **Background throttling:** timestamp-based remaining time prevents drift; the display
  may update less often in a background tab, which is harmless.
- **Reload:** restoring paused avoids silently resuming a timer the teacher did not see.
- **Sound autoplay:** the toggle/Start is the user gesture that unlocks audio.
- **Read-only close:** `closeLesson` currently saves on close; teach mode needs the
  save-free variant or it will rewrite the lesson on exit.
- **Read-only:** the teach page must not mount editor hotkeys or writable controls.

## What is left to the builder

- Exact spacing/type sizes, icon set, and copy.
- The timer hook structure (reducer vs refs) and `sessionStorage` save cadence.
- The chime tone and duration.
- The station-card filtering details and thumbnail size.
- The `--flow teach` fixtures and Playwright clock steps.
