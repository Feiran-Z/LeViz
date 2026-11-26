# LeViz — frontend (Phase 1 MVP)

A visual lesson planner. A lesson is an ordered flow of **text segments** (openings,
debriefs, exit tickets) and **layout segments** (a classroom canvas with furniture,
stations, notes, and assigned students). Everything lives in one document.

Phase 1 is a static SPA that stores lessons in **IndexedDB** — no backend, no network.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Requires Node ≥ 20 (verified on v25.8.1) and npm.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Type-check (`tsc -b`) and emit `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm test` | Vitest: domain, serialization, geometry, repository contract |
| `npm run typecheck` | Strict TypeScript build check |

## What is implemented

- Lesson list: create, open, search, export, import, delete.
- Lesson-level **class size** (top bar) — templates build chair counts and seat capacities from it, with or without a roster.
- **Activity instructions** are prefilled with activity-specific guidance (prep, roles, procedure) for Harkness, debate, mock trial, group discussion, gallery walk, and stations — fully editable.
- Editor shell: top bar (title, date, period length, running time budget, undo/redo,
  save indicator, theme, panel toggles), three-column layout.
- Lesson flow outline: add text/layout segments, drag to reorder, delete, running total.
- Rich-text segments: TipTap narrowed to bold, italic, headings, lists, links.
  Merriweather for lesson prose, Inter for UI.
- Layout segments: Konva canvas with 7 node types, drag, resize/rotate (Transformer),
  snap guides, pan/zoom, selection, and non-destructive activity templates
  (Harkness, debate, mock trial, group discussion, gallery walk, station rotation,
  and blank canvas).
- Node notes: plain-text title + body per node, edited by double-click or inspector;
  hovering a noted node previews the note at the cursor.
- Roster: names, tags, `togetherWith` / `notWith` constraints, bulk paste, drag chips
  onto seats, capacity enforcement, conflict warnings.
- Grouping: random and constraint-aware generation with violation reporting, preview,
  and apply-to-canvas. The preview is kept until the teacher generates again — it
  survives canvas clicks, tab switches, and segment changes. Pure logic in
  `src/domain/grouping.ts`, unit-tested.
- Persistence: IndexedDB through `LessonRepository`; debounced autosave + flush on tab hide.
- **Text templates**: Do Now, Think-Pair-Share, Mini-lesson, Debrief, Reflection, Exit
  ticket, Learning goals, Key vocabulary, Homework, plus blank — offered from the
  lesson start screen and the lesson-flow add menu.
- **Lesson overview**: a read-only single-page view of every segment in order, with
  rendered text, room schematics, instructions, and annotations — plus print support.
- Export/import: versioned JSON (`.leviz.json`) with lossless round-trip.
- Light and dark themes following `prefers-color-scheme` with a manual override.

## Structure

```
src/
  domain/        pure types, grouping, templates, geometry (snap/hit-test), serialization
  repositories/  LessonRepository contract + IndexedDB implementation + factory
  stores/        lessonStore + rosterStore (zundo), uiStore (no history),
                 libraryStore (list ops), lessonSession (open/close orchestration)
  canvas/        Konva stage, node views, toolbar, note dialog, canvas tokens
  components/    segments, panels, layout, UI primitives
  pages/         lesson list, editor, not found
  hooks/         theme, autosave, undo/redo
```

Hard boundaries from the architecture doc are respected: `domain/` imports nothing
above it; only `repositories/indexeddb/` imports `idb`; components never touch a
repository; `uiStore` never enters undo history.

## Data & storage

- IndexedDB database `leviz`, object store `lessons` keyed by `id`, indexed by `updatedAt`.
- A lesson is one document: metadata, roster, and ordered segments (TipTap JSON only in
  `TextSegment.content`; node notes are plain text).
- Export uses `{ "schemaVersion": 1, "lesson": { … } }`; `parse(serialize(lesson))` is
  deep-equal to the original lesson.

## Deploying

Phase 1 is a static bundle:

```bash
npm run build
# serve dist/ with a static host; rewrite unknown paths to /index.html
```

Deep links (`/lessons/:id`) require SPA fallback. Phase 2 will copy `dist/*` into
PocketBase's `pb_public/`, which provides fallback via `indexFallback`.

`VITE_POCKETBASE_URL` is reserved for Phase 2. If set today the app warns and
continues with IndexedDB.

## Known limitations (Phase 1)

- Data is per browser profile. Export is the backup/sharing path.
- The roster is per lesson (shared class rosters are deferred to Phase 3).
- Autosave is debounced ~0.9 s; a very fast tab close can drop the last keystrokes.
- Canvas nodes are pointer-driven; keyboard placement is not implemented.
- Bundle is a single ~1.15 MB chunk (Konva + TipTap); code-splitting is future work.

## Verification

```bash
npm test                                   # 66 unit/contract tests
npm run build                              # strict TS + production build
node .claude/skills/run-leviz-frontend/driver.mjs --flow lesson
```

The driver drives a full lesson end-to-end in Chrome and writes screenshots.
