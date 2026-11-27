# Teach Mode with Timers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only teach mode at `/lessons/:lessonId/teach` that runs text and layout segments with an accurate countdown, rendered content, station/role cards, and derived rotation guides for station rotation, gallery walk, and opt-in layouts.

**Architecture:** A new route and page own the run. Pure domain helpers build the timed run and rotation stop sets; a pure timer reducer owns the clock; a hook adds the interval, session restore, and sound. The page renders read-only content and never edits the lesson; it closes with a save-free session close.

**Tech Stack:** React 19, TypeScript, React Router, Zustand, Vitest, Playwright (clock), Web Audio.

**Spec:** `docs/superpowers/specs/2026-11-28-teach-mode-design.md`

## Global Constraints

- Timer on **every** text and layout segment with `durationMin > 0`; zero/negative/NaN segments are skipped.
- One source of truth: timestamp-based countdown, no auto-advance; rotation is derived from segment elapsed, with a manual Next stop.
- Automatic rotation for `station-rotation` and `gallery-walk`; manual toggle for any layout with ≥2 eligible stops.
- Station stops: `station` nodes with capacity >0. Gallery stops: `wall-anchor` nodes with a note or label. Manual stops: station/round-table with capacity, wall-anchor with a note/label; exclude teacher, chair, desk, podium.
- `+1:00` extends the segment's live duration; rotation round length is recomputed from it.
- Read-only: no lesson/roster/class writes. Teach closes with a save-free `closeLesson({ save: false })`; entering from a lesson card leaves `updatedAt` untouched.
- Sound toggle off by default; chime only at zero; reload restores paused with segment, remaining, stop, stop-start, rotation mode, and added time.
- Route `/lessons/:lessonId/teach`; exit returns to `/lessons/:lessonId`.
- V1 only the scope above; fullscreen, wake-lock, clickable rail, rotating groups, class name are V1.1.
- Existing 122 tests, typecheck, build, and the lesson/classes driver flows stay green.

## Review Focus

- **Read-only:** entering from a lesson card and exiting never writes the lesson or bumps `updatedAt`. Tested in Task 2 (save-free close unit test) and Task 3 (driver card entry).
- **Clock accuracy under jumps/throttling:** remaining time is derived from `endsAt`, not decremented. Tested in Task 2 (tick far past `endsAt`).
- **Text and layout both timed:** `buildTeachRun` includes both kinds and skips zero; the driver runs a text timer before a layout. Tested in Tasks 1 and 3/4.
- **Rotation coverage:** station pods, gallery wall-anchor stops, and a manual custom layout. Tested in Task 1 (stop sets) and Task 4 (driver station/gallery/toggle).
- **+1 and reload:** adding time lengthens the live round length; reload restores the stop and rotation mode. Tested in Task 2 (reducer) and Task 3 (reload).

## File Structure

```
frontend/src/domain/teach.ts            buildTeachRun, rotation stop sets/config, countdown format
frontend/src/domain/teachTimer.ts       pure timer state/reducer and derived values
frontend/src/hooks/useTeachRun.ts       interval, session restore, sound, actions
frontend/src/hooks/useLessonDocument.ts shared load/close (save or save-free)
frontend/src/lib/chime.ts               Web Audio chime
frontend/src/pages/TeachPage.tsx        route page, status gates, header, keyboard, exit
frontend/src/components/teach/TeachTimer.tsx
frontend/src/components/teach/TeachContent.tsx   text + layout content
frontend/src/components/teach/TeachLayout.tsx    thumbnail, instructions, cards
frontend/src/components/teach/RotationGuide.tsx  toggle, strip, Next stop
frontend/src/components/ui/Icons.tsx             play/pause/skip/volume icons
frontend/src/App.tsx                    teach route
frontend/src/pages/LessonListPage.tsx   card Teach link
frontend/src/components/layout/TopBar.tsx        editor Teach link
frontend/src/components/overview/LessonOverview.tsx  overview Teach link
frontend/src/stores/lessonSession.ts    save-free close option
frontend/.claude/skills/run-leviz-frontend/driver.mjs  --flow teach
```

---

### Task 1: Domain teach run and rotation helpers

**Files:**
- Create: `frontend/src/domain/teach.ts`
- Test: `frontend/src/domain/teach.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface TeachSegment { segment: Segment; index: number; startMin: number; endMin: number; durationMin: number; }
  interface TeachRun { segments: TeachSegment[]; totalMin: number; }
  type RotationKind = 'station' | 'stop';
  interface RotationConfig { kind: RotationKind; stops: CanvasNode[]; }
  function buildTeachRun(segments: Segment[]): TeachRun;
  function rotationEligibleStops(segment: LayoutSegment): CanvasNode[];
  function defaultRotationEnabled(segment: LayoutSegment): boolean;
  function rotationConfig(segment: LayoutSegment, enabled: boolean): RotationConfig | null;
  function roundLengthMs(segmentLiveMs: number, stopCount: number): number;
  function formatCountdown(ms: number): string;
  ```

- [ ] **Step 1: Write failing tests**

In `teach.test.ts`:
- `buildTeachRun([text 5, layout 15, text 0, text 10])` → 3 segments, `totalMin 30`, starts `[0,5,20]`, durations `[5,15,10]`, indexes `[1,2,3]`; NaN and negative skipped.
- `formatCountdown`: `0 → '00:00'`, `65_000 → '01:05'`, `3_600_000 → '1:00:00'`, negative → `'00:00'`.
- Build station rotation and gallery walk layouts with `templateFor` + `applyTemplate`:
  - station rotation → `defaultRotationEnabled` true, `rotationConfig(.., true)` kind `station`, 4 stops, disabled → null.
  - gallery walk → default true, kind `stop`, 6 stops.
  - group discussion → default false; `rotationConfig(.., false)` null; manual enabled → kind `stop`, 5 round tables.
  - Harkness → no eligible stops and no config even when enabled.
  - custom with two station nodes → manual enabled gives 2 stops; with one → null.
- `roundLengthMs(15 * 60_000, 4) === 225_000`.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/domain/teach.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

- `buildTeachRun` filters finite durations >0, lays segments end to end, carries the original segment and a 1-based timed index.
- `rotationEligibleStops` sorts by `y` then `x`; manual candidates are `station`/`round-table` with capacity >0 and `wall-anchor` with a note or label; exclude teacher/chair/desk/podium.
- `rotationConfig`: station rotation uses station pods; gallery walk uses wall-anchor stops; everything else uses the manual candidate set. Fewer than two stops → null.
- `formatCountdown` uses whole seconds, `MM:SS` under an hour and `H:MM:SS` above.

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run src/domain/teach.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/teach.ts frontend/src/domain/teach.test.ts docs/superpowers/specs/2026-11-28-teach-mode-design.md docs/superpowers/plans/2026-11-28-teach-mode.md
git commit -m "feat: add teach run and rotation domain helpers"
```

---

### Task 2: Timer reducer, save-free close, and run hook

**Files:**
- Create: `frontend/src/domain/teachTimer.ts`
- Create: `frontend/src/hooks/useTeachRun.ts`
- Create: `frontend/src/hooks/useLessonDocument.ts`
- Create: `frontend/src/lib/chime.ts`
- Modify: `frontend/src/stores/lessonSession.ts`
- Modify: `frontend/src/pages/EditorPage.tsx` (use the shared load/close hook)
- Test: `frontend/src/domain/teachTimer.test.ts`, `frontend/src/stores/lessonSession.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface TeachTimerState {
    segmentIndex: number; remainingMs: number; running: boolean; endsAt: number | null;
    completed: boolean; addedMs: number; stopIndex: number; stopStartElapsedMs: number;
    rotationEnabled: boolean; soundOn: boolean;
  }
  type TeachTimerAction =
    | { type:'start'; now:number } | { type:'pause'; now:number } | { type:'tick'; now:number }
    | { type:'reset' } | { type:'add'; ms:number } | { type:'next' } | { type:'previous' }
    | { type:'nextStop'; now:number } | { type:'setRotation'; enabled:boolean }
    | { type:'setSound'; enabled:boolean };
  function createTeachTimerState(run: TeachRun, options?: { soundOn?: boolean }): TeachTimerState;
  function reduceTeachTimer(state: TeachTimerState, action: TeachTimerAction, run: TeachRun): TeachTimerState;
  function segmentElapsedMs(state, run): number;
  function liveDurationMs(state, run): number;
  function rotationRemainingMs(state, run, config: RotationConfig | null): number;
  function plannedEndAt(now: number, state, run): number;
  function closeLesson(options?: { save?: boolean }): void;
  function useTeachRun(options: { lessonId: string; run: TeachRun }): { state; segment; rotation; rotationRemainingMs; elapsedMs; liveDurationMs; plannedEndAt; actions };
  function useLessonDocument(lessonId: string | undefined, options: { saveOnClose: boolean }): void;
  ```

- [ ] **Step 1: Write failing tests**

`teachTimer.test.ts` with a run of a 1-minute text segment then a 2-minute text segment:
- initial state: first remaining 60_000, paused, rotation default; `segmentElapsedMs 0`; `plannedEndAt(0) 180_000`.
- `start` at now 1_000 → running, endsAt 61_000; `tick` at 31_000 → 30_000; `tick` at 61_000 → 0, completed, not running.
- `pause` at 31_000 → 30_000 paused; a later tick does nothing.
- `add 60_000` paused and running; at completed, adds and clears completed; running shifts `endsAt`.
- `reset` clears added, restores 60_000, pauses; rotation stays off/on as it was.
- `next`/`previous`: pause, full duration, default rotation for the target, added 0; boundaries no-op.
- A run with a 10-minute station-rotation layout (4 stops) and rotation enabled:
  - at elapsed 0, `rotationRemainingMs` is 150_000;
  - `nextStop` at elapsed 40_000 sets stopIndex 1 and stopStartElapsed 40_000;
  - `nextStop` at the last stop is a no-op;
  - `setRotation(false)` hides the config; `setRotation(true)` at elapsed 200_000 starts at stop 1 (floor(200/150));
  - `add 60_000` makes the round length 165_000 and updates the remaining.
- `closeLesson({ save: false })` in `lessonSession.test.ts`: inject a fake repository, hydrate a lesson, call close, flush the deferred task; `saveLesson` is not called and the store is cleared. `closeLesson()` without the option calls `saveLesson` once.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/domain/teachTimer.test.ts src/stores/lessonSession.test.ts`
Expected: FAIL — modules/options missing.

- [ ] **Step 3: Implement**

- `reduceTeachTimer` derives remaining from `endsAt` on tick/pause; start is a no-op when completed or at 0; next/prev pause and reset the target; stop actions use the current segment elapsed; rotation enabling computes the current round from elapsed and live duration.
- `useTeachRun` initializes from `sessionStorage` key `leviz-teach:<lessonId>` (find by segment id, clamp remaining/stop, restore paused), reads sound from `localStorage`, runs a 250 ms interval only while running, saves on transitions and pagehide/visibility hidden, clears on explicit exit, and plays `playChime()` on the completed transition when sound is on.
- `closeLesson` gains `{ save = true }` and skips both save calls when false.
- `useLessonDocument` owns `resetForLesson` + `openLesson` + close with the option; EditorPage uses it with `saveOnClose: true`.
- `chime.ts` creates/resumes an AudioContext and plays two short sine notes; swallow unsupported-audio errors.
- `+1` extends the live duration and round length; reset clears additions.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm test && npm run typecheck`
Expected: existing 122 plus new tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/teachTimer.ts frontend/src/domain/teachTimer.test.ts frontend/src/hooks/useTeachRun.ts frontend/src/hooks/useLessonDocument.ts frontend/src/lib/chime.ts frontend/src/stores/lessonSession.ts frontend/src/stores/lessonSession.test.ts frontend/src/pages/EditorPage.tsx
git commit -m "feat: add teach timer state and save-free session close"
```

---

### Task 3: Teach page, text content, timer UI, route, and core driver

**Files:**
- Create: `frontend/src/pages/TeachPage.tsx`
- Create: `frontend/src/components/teach/TeachTimer.tsx`
- Create: `frontend/src/components/teach/TeachContent.tsx`
- Modify: `frontend/src/components/ui/Icons.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/.claude/skills/run-leviz-frontend/driver.mjs`
- Test: driver flow

**Interfaces:**
- Consumes: `useLessonDocument`, `useTeachRun`, `buildTeachRun`, `formatCountdown`.
- Produces: `/lessons/:lessonId/teach`, the timer/content shell, and a `--flow teach` core.

- [ ] **Step 1: Write the failing `--flow teach` checks**

Extend the driver CLI and main dispatch. Install Playwright's clock before navigation:
`await page.clock.install({ time: new Date('2026-11-28T09:00:00') })`.
The flow:
- create a lesson; add a Do Now text segment and set its duration to 1 minute; add a Debrief segment set to 5 minutes;
- go back to the list; click the card's Teach link; assert the route, title, Do Now content, and timer `01:00`;
- Start, `fastForward('00:00:10')` → `00:50`; pause, fast-forward 5 s → still `00:50`;
- +1:00 → `01:50`; reset → `01:00`;
- Start, fast-forward past 1 minute → `Time's up`, timer `00:00`, still the Do Now segment;
- Next → Debrief `05:00`; Previous → Do Now;
- Start, advance a few seconds, reload; assert paused at the same segment with a reduced remaining time;
- Exit and assert the editor route.

Run: `node .claude/skills/run-leviz-frontend/driver.mjs --flow teach --url http://localhost:5173`
Expected: FAIL — route/UI missing.

- [ ] **Step 2: Implement the page shell**

- `TeachPage` uses `useLessonDocument(lessonId, { saveOnClose: false })`, shows loading/missing/error, builds the run with `buildTeachRun`, handles an empty run, and calls `useTeachRun`.
- Header: Exit, lesson title, roster count, planned end clock, sound toggle.
- Timer: `role="timer"`, `formatCountdown`, state label, segment progress, Start/Pause, Reset, +1:00, Previous, Next; warning styling for the last 30 seconds; time-up shows “Time’s up” with Next prominent and Start disabled.
- Text content uses `RichTextView`; empty text shows a muted note.
- Next preview line; keyboard Space/arrows/R/Escape with input guards; Escape clears the session and returns to the editor.
- Layout segments render a basic thumbnail + activity instructions in this task; the full cards/rotation arrive in Task 4.
- Add the `play`, `pause`, `skip-back`, `skip-forward`, `volume`, and `volume-off` icons.
- Add the route in `App.tsx`.

- [ ] **Step 3: Run the teach flow**

Run: `node .claude/skills/run-leviz-frontend/driver.mjs --flow teach --url http://localhost:5173`
Expected: the core text/timer/reload checks pass with zero console errors.

- [ ] **Step 4: Run project gates**

Run: `cd frontend && npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TeachPage.tsx frontend/src/components/teach/TeachTimer.tsx frontend/src/components/teach/TeachContent.tsx frontend/src/components/ui/Icons.tsx frontend/src/App.tsx frontend/.claude/skills/run-leviz-frontend/driver.mjs
git commit -m "feat: add teach page with text timers"
```

---

### Task 4: Layout content, rotation guides, and entry points

**Files:**
- Create: `frontend/src/components/teach/TeachLayout.tsx`
- Create: `frontend/src/components/teach/RotationGuide.tsx`
- Modify: `frontend/src/components/teach/TeachContent.tsx`
- Modify: `frontend/src/pages/LessonListPage.tsx`
- Modify: `frontend/src/components/layout/TopBar.tsx`
- Modify: `frontend/src/components/overview/LessonOverview.tsx`
- Modify: `frontend/.claude/skills/run-leviz-frontend/driver.mjs`
- Test: driver flow

**Interfaces:**
- Consumes: `rotationEligibleStops`, `rotationConfig`, `defaultRotationEnabled`, `useTeachRun` rotation values/actions.
- Produces: layout cards, the rotation guide/toggle, and Teach links on the lesson card, editor, and overview.

- [ ] **Step 1: Extend the failing driver flow**

Before teaching, add a station-rotation layout (4 pods), eight students, and apply four groups; add a gallery-walk layout and a note on one wall-anchor stop. Then after the text checks:
- Next to station rotation: timer `15:00`, strip `Station 1 of 4`, group names in the cards, Next station → `Station 2 of 4`.
- Toggle `Rotation guide` off → strip hidden; on → strip returns.
- Next to gallery walk: strip `Stop 1 of 6`, the noted stop prompt and label, Next stop → `Stop 2 of 6`.
- Exit; assert the editor TopBar and overview each expose a Teach link that returns to the teach route; the card entry is already covered.
- Assert the lesson content is intact after exiting (title and segment count).

Run: `node .claude/skills/run-leviz-frontend/driver.mjs --flow teach --url http://localhost:5173`
Expected: FAIL — layout cards/rotation/entry points missing.

- [ ] **Step 2: Implement layout content and cards**

- `TeachLayout` renders activity instructions, `LayoutThumbnail`, and cards in reading order for nodes with a note/assignments plus station-like nodes; station-rotation cards show the planned group, gallery stops show the prompt, and the current stop is highlighted.
- `TeachContent` switches on segment kind and passes the active stop id.
- Roster names come from `useRosterStore`; missing students render as “Unknown”.

- [ ] **Step 3: Implement the rotation guide**

- `RotationGuide` shows a `Rotation guide` toggle when `rotationEligibleStops` has at least two; default on for station rotation/gallery walk and off otherwise.
- When enabled and `rotationConfig` is non-null, show `Station X of N` or `Stop X of N`, the derived countdown, `Rotate now` at zero, and `Next station/stop` (disabled at the last).
- The toggle and Next stop wire to `useTeachRun`; the guide pauses with the segment timer and never advances automatically.
- Add Teach links: lesson card (always visible play icon/label), editor TopBar, and overview.

- [ ] **Step 4: Run the teach flow**

Run: `node .claude/skills/run-leviz-frontend/driver.mjs --flow teach --url http://localhost:5173`
Expected: all teach checks pass, including station/gallery/toggle/entries; zero console errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/teach/TeachLayout.tsx frontend/src/components/teach/RotationGuide.tsx frontend/src/components/teach/TeachContent.tsx frontend/src/pages/LessonListPage.tsx frontend/src/components/layout/TopBar.tsx frontend/src/components/overview/LessonOverview.tsx frontend/.claude/skills/run-leviz-frontend/driver.mjs
git commit -m "feat: add teach layout content and rotation guides"
```

---

### Task 5: Documentation, full gates, and final driver

**Files:**
- Modify: `README.md`
- Modify: `docs/roadmap/2026-11-27-enhancement-suggestions.md`
- Modify: `frontend/.claude/skills/run-leviz-frontend/SKILL.md`
- Test: full suites + lesson/classes/teach drivers

- [ ] **Step 1: Update docs**

- README: mention teach mode is read-only and timers are local.
- Roadmap: mark suggestion 2 as implemented and link the design.
- Run skill: add `--flow teach`, its checks/screenshots, and the new test counts; add teach mode to the re-verify list.

- [ ] **Step 2: Run all gates**

```bash
cd frontend
npm test
npm run typecheck
npm run build
node .claude/skills/run-leviz-frontend/driver.mjs --flow lesson --url http://localhost:5173
node .claude/skills/run-leviz-frontend/driver.mjs --flow classes --url http://localhost:5173
node .claude/skills/run-leviz-frontend/driver.mjs --flow teach --url http://localhost:5173
```
Expected: all tests pass; typecheck/build clean; all three driver flows green with zero console errors.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/roadmap/2026-11-27-enhancement-suggestions.md frontend/.claude/skills/run-leviz-frontend/SKILL.md
git commit -m "docs: document teach mode"
```

---

## Self-Review

- Spec coverage: route/entry points, text+layout timers, rotation matrix (station, gallery, manual), timer semantics, +1 live duration, session restore, sound, keyboard, read-only close, planned end, phases — mapped to tasks.
- Review Focus has a test in its owning task for each failure mode.
- Names are consistent: `TeachRun`/`TeachSegment`, `rotationConfig`/`rotationEligibleStops`, `reduceTeachTimer`, `useTeachRun`, `useLessonDocument`, `closeLesson({save})`, `TeachLayout`/`RotationGuide`.
- Zero-duration segments, empty runs, Harkness/group-discussion non-rotation, gallery stops without groups, and manual custom stops are covered.
- Proportion: five tasks for one route, a pure timer, a hook, three teach components, entry points, and a driver flow; no code transcript.
