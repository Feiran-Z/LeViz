# Phased Implementation Plan: LeViz

> **Scope:** Implementation sequencing only — phases, steps, deliverables, and exit criteria.
> **Companion documents:** Product intent (`project_overview.md`), architecture and data model (`architecture.md`), tech stack (`teck_stack.md`).
> **Rule:** Do not begin a phase until the previous phase's exit criterion is met. Do not build Phase 3 items unless explicitly requested.

---

## 1. Phase Overview

| Phase | Goal | Backend? | Exit criterion |
|---|---|---|---|
| **Phase 1** | Frontend MVP — fully usable offline | No | A teacher can build, save, reload, and export a complete multi-segment lesson entirely in the browser. |
| **Phase 2** | PocketBase integration — cross-device persistence | Yes | Two teachers on two devices log in and see only their own lessons, persisted server-side. |
| **Phase 3** | Optional enhancements | Yes | Only on explicit request. |

---

## 2. Phase 1 — Frontend MVP (No Backend)

**Goal:** A fully usable static SPA that persists lessons in IndexedDB. No network dependency.

### 2.1 Steps

| # | Step | Deliverable | Done when |
|---|---|---|---|
| 1.1 | **Scaffold** | Vite + React 19 + TypeScript project; Tailwind; react-router-dom; Zustand, zundo, konva, react-konva, idb, dndkit, TipTap installed | `npm run dev` serves a blank routed app; `npm run build` emits `dist/`; TS strict mode compiles clean |
| 1.2 | **Domain types** | `domain/types.ts` with `Lesson`, `LessonMeta`, `Student`, `Segment`, `TextSegment`, `LayoutSegment`, `CanvasState`, `CanvasNode`, `NodeNote` | Types compile with strict mode; no `any` in `domain/` |
| 1.3 | **Repository interface + IndexedDB impl** | `repositories/types.ts` (`LessonRepository`); `repositories/indexeddb/` implementation | Create, read, list, update, delete lessons via a test harness; reload survives |
| 1.4 | **Stores** | `lessonStore` and `rosterStore` wrapped in zundo (`limit: 50`); `uiStore` | Undo/redo works for segment edits and canvas node movement; UI state does not enter history |
| 1.5 | **Konva canvas** | Stage, node palette (desk, round table, station, podium, wall anchor, teacher, chair), drag, resize (Transformer), selection, snap guides | Nodes can be placed, moved, resized, selected; 60 FPS at 100+ nodes |
| 1.6 | **Node notes** | Double-click a node → popover with `title` + `body` | Note persists to store and survives reload |
| 1.7 | **Roster panel** | Student list, tags, constraint editor (`notWith`, `togetherWith`), draggable chips | Chips can be dropped onto nodes; capacity enforced; conflict pairs highlighted |
| 1.8 | **Text segments** | TipTap editor with StarterKit + link extension | Rich text survives reload; no formatting beyond the allowed set is possible |
| 1.9 | **Segment outline** | Ordered list with dndkit reorder; add/remove; running time budget bar | Total updates as `durationMin` changes; over-budget warning appears |
| 1.10 | **Grouping engine** | `domain/grouping.ts` with `generateGroups` (random + constraint-aware) and `validateAssignment` | Unit tests cover: balanced sizes, `notWith` violations, `togetherWith` pairings, unsatisfiable constraints, `groupCount = 1`, `groupCount > students.length` |
| 1.11 | **Layout templates** | JSON templates for 7 activity types; "apply template" merges nodes into the canvas | Applying a template is non-destructive; existing notes and assignments are preserved |
| 1.12 | **Groups panel** | Grouping controls, results preview, "Apply to canvas" | Generated groups populate `assignedStudentIds` on nodes; violations surfaced as warnings |
| 1.13 | **Export / Import** | JSON export and import of a full `Lesson` | Round-trip export → import produces an identical document (`JSON.stringify` equality) |
| 1.14 | **Deploy** | Static host or single-container Nginx deploy | App reachable at a URL; lessons persist per browser across reloads |

### 2.2 Exit Criterion

A teacher can create a lesson with an opening text segment, at least one layout segment (using a template or built from scratch), notes on individual nodes, a roster with at least one constraint pair, generated groups applied to the canvas, and an exit ticket — then reload the page, export to JSON, re-import, and see an identical lesson.

**Do not begin Phase 2 until this passes.**

---

## 3. Phase 2 — PocketBase Integration

**Goal:** Cross-device persistence, teacher accounts, and a single-binary deployment.

### 3.1 Steps

| # | Step | Deliverable | Done when |
|---|---|---|---|
| 2.1 | **PocketBase setup** | Pinned binary; `pb_migrations/` with `teachers`, `lessons`, `assets` collections and API rules | A fresh `pocketbase serve` reproduces the schema from migrations alone |
| 2.2 | **Auth store** | `authStore` wired to PocketBase auth; login screen; route guard | Unauthenticated users are redirected to `/login`; session persists across reloads |
| 2.3 | **PocketBase repository** | `PocketBaseLessonRepository` implementing `LessonRepository`; maps `Lesson` ↔ record (`created`/`updated` → `createdAt`/`updatedAt`) | Same interface as IndexedDB; store code unchanged |
| 2.4 | **Repository factory** | `repositories/index.ts` picks implementation based on `VITE_POCKETBASE_URL` | Setting the env var switches backends with no other code changes |
| 2.5 | **First-login migration** | On first successful login, push unmigrated IndexedDB lessons to PocketBase; record mapping | Existing local lessons appear server-side; local copies are not deleted until confirmed |
| 2.6 | **Deploy** | Build → copy `dist/*` into `pb_public/` → restart PocketBase; verify SPA deep-link refresh | `/lessons/:id` hard-refresh loads correctly (`indexFallback` handles this) |
| 2.7 | **Backup** | Cron job or hook calling PocketBase backup API; restore test performed | A deleted lesson can be restored from a backup archive |

### 3.2 Exit Criterion

Two teacher accounts, created by an admin, log in on two separate browsers. Each sees only their own lessons. A lesson created on browser A is not visible to user B. A hard refresh of `/lessons/:id` loads the editor. A backup restore returns a deleted lesson.

---

## 4. Phase 3 — Optional Enhancements (Only on Request)

Do not build unless a user explicitly asks. These are listed to prevent scope creep, not to invite it.

| Feature | Prerequisite work | Why deferred |
|---|---|---|
| **Shared class roster** across lessons | New `rosters` collection; `rosterId` relation on `lessons`; repository + store changes | Per-lesson roster is sufficient for v1 |
| **PDF export** of a lesson | Server-side or headless rendering pipeline (layout thumbnail + text segments) | JSON export covers sharing for now |
| **Real-time co-editing** | Yjs/CRDT state model; PocketBase realtime subscriptions; conflict resolution UX | Large feature with its own architecture; out of scope for a school-internal tool |
| **Department-head read access** | Role-aware API rules; explicit privacy decision | Default is strict per-teacher privacy |

---

## 5. Cross-Cutting Requirements (Apply Every Phase)

### 5.1 Testing

| Area | Requirement |
|---|---|
| `domain/grouping.ts` | Unit tests for all modes and edge cases (see 1.10) |
| `LessonRepository` | A shared test suite run against every implementation (IndexedDB, PocketBase) to prove interface parity |
| Serialization | A round-trip test for every `Segment` and `CanvasNode` variant |
| Canvas interaction | Manual smoke test each phase: drag, resize, snap, select, note edit |

### 5.2 Hard Boundaries (Enforced Throughout)

1. All persistence goes through `LessonRepository`. UI → store → repository. Never UI → SDK.
2. All shared state lives in Zustand. Component state is only local UI ephemera.
3. `domain/` has zero imports from React, stores, or SDKs.
4. TipTap JSON lives only in `TextSegment.content`; node notes are plain text.
5. Undo/redo is store-level, never per-component.
6. All PocketBase schema changes are migrations checked into git.
7. Pin PocketBase exactly; pin `react-konva` to the React minor.

### 5.3 Dependency Graph (Critical Path)

1.1 Scaffold
└─► 1.2 Domain types
├─► 1.3 Repository (IndexedDB)
│ └─► 1.4 Stores
│ ├─► 1.5 Canvas
│ │ ├─► 1.6 Node notes
│ │ ├─► 1.7 Roster panel
│ │ └─► 1.11 Templates
│ ├─► 1.8 Text segments
│ ├─► 1.9 Segment outline
│ └─► 1.10 Grouping engine
│ └─► 1.12 Groups panel
└─► 1.13 Export/Import
└─► 1.14 Deploy ──► Phase 1 exit

Phase 1 exit ──► 2.1 PocketBase setup
├─► 2.2 Auth store
└─► 2.3 PocketBase repository
└─► 2.4 Repository factory
├─► 2.5 First-login migration
├─► 2.6 Deploy
└─► 2.7 Backup ──► Phase 2 exit

Items 1.5–1.10 can be parallelized once 1.4 is stable; 1.13 can begin once 1.2 is done.

### 5.4 Definition of Done (Every Step)

A step is complete only when:

- The deliverable exists and works in `npm run dev`.
- `npm run build` succeeds with no TypeScript errors.
- Relevant tests (if any) pass.
- No new imports violate the hard boundaries in §5.2.
- The "Done when" column in its row is satisfied.

---

## 6. Risks and Sequencing Notes

| Risk | Impact | Mitigation |
|---|---|---|
| Konva performance degrades as nodes grow | Phase 1 blocked | Memoize node components; per-node state subscription; profile at 100 nodes before step 1.6 |
| Undo history bloats or behaves oddly during drag | Phase 1 UX degraded | Debounce canvas drags (~300 ms); cap history at 50; test drag → undo → redo explicitly |
| IndexedDB schema drift breaks early lessons | Phase 1 data loss | Version the IndexedDB store; write a migration function; test with an old document |
| Repository interface is too narrow for PocketBase | Phase 2 rework | Design `LessonRepository` against the PocketBase record shape in Phase 1; write the shared test suite early |
| PocketBase migration API differs from the sketch | Phase 2 blocked | Verify the `Collection` constructor against the pinned version **before** writing 2.1 |
| SPA deep links 404 behind PocketBase | Phase 2 deploy fails | Test `/lessons/:id` hard refresh immediately after 2.6 |
| First-login migration loses local lessons | Data loss | Never delete IndexedDB until a successful round-trip fetch confirms the server copy |
| Scope creep into Phase 3 features | Delay | Treat Phase 3 as out of scope; require an explicit request to add any item |

---

*End of document.*