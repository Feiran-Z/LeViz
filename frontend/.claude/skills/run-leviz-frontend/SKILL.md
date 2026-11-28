---
name: run-leviz-frontend
description: Run, start, build, test, and screenshot the LeViz frontend — a Vite + React 19 + TypeScript SPA for visual lesson planning. Use when asked to run or start the LeViz app, build it, take a screenshot, or smoke-test the lesson editor UI.
---

# Run: LeViz frontend

LeViz is a visual lesson planner: a lesson is an ordered list of text segments and
spatial layout segments, where furniture and stations on a canvas carry notes and
assigned students. This skill covers the **`frontend/` Vite SPA** only. All paths
below are relative to `LeViz/frontend/`.

## ✅ Status: verified (2026-11-28)

Every command below was executed against Phase 1 of the implementation plan on this
machine. Evidence from that run:

- `npm test` → **22 files, 162 tests passed**, including the class-repository contract,
  the IndexedDB v1 → v2 migration, the teach timer/close/restart tests, the print
  materials builder, and the workspace backup planner/repository.
- `npm run build` → `dist/` emitted; strict TypeScript clean. JS bundle ~1.24 MB
  (382 kB gzip) with Vite's chunk-size warning (expected: Konva + TipTap).
- `node .claude/skills/run-leviz-frontend/driver.mjs --flow lesson` → **all 38 checks
  passed**, zero console errors, zero page errors, 17 non-blank screenshots.
- `node .claude/skills/run-leviz-frontend/driver.mjs --flow classes` → **all 14 checks
  passed**, zero console errors, zero page errors, 4 non-blank screenshots.
- `node .claude/skills/run-leviz-frontend/driver.mjs --flow teach` → **all 31 checks
  passed**, zero console errors, zero page errors, 5 non-blank screenshots.
- `node .claude/skills/run-leviz-frontend/driver.mjs --flow print` → **all 14 checks
  passed**, zero console errors, zero page errors, 3 non-blank screenshots.
- `node .claude/skills/run-leviz-frontend/driver.mjs --flow backup` → **all 8 checks
  passed**, zero console errors, zero page errors, 2 non-blank screenshots.

The `lesson` flow creates a lesson, sets class size to 12, applies the Harkness template
(asserting 12 chairs + teacher), adds four students,
drags one onto a seat, saves a node note, moves a node and undoes it, generates and
checks the prefilled Harkness activity guidance, applies groups, adds a text segment via
the template menu, reloads to prove persistence, then exports and re-imports the JSON,
confirming the replace prompt before the id collision overwrites the lesson. It also
checks the copyright/license footer on the lesson list
(including the served third-party notices file) and the overview, verifies the footer
prints, and asserts the editor has no footer. It also verifies the landing preview gate:
the feedback-form link, that Escape and backdrop clicks do not dismiss it, and that
“I understand.” does.

The `classes` flow creates a tagged and paired roster, saves it as a class, then seats a
legacy student in a new lesson and applies the class — asserting the confirmation names
the removed assignment, refreshing replaces a lesson-only student, saving back adds a
student, and unlinking keeps the roster. It reuses the updated class, renames it in the
Classes manager, and deletes it — asserting the linked lesson keeps its roster snapshot
and shows the class as unavailable.

The `teach` flow builds a text segment, a station-rotation layout with groups, and a
gallery-walk layout with a stop prompt, then opens teach mode from the lesson card. It
checks the text timer, start/pause/reset/+1, time-up without auto-advance, next/previous,
a reload restoring paused (text and station), station and gallery rotation guides, the
guide toggle, the planned-end tick, a11y state, Start over, and the editor/overview Teach
entries.

The `print` flow builds a station-rotation layout with groups and a station prompt, then
opens Print materials from the layout toolbar. It checks the print route, the seating
sheet and assignment table, the station prompt/group, that the card is student-facing,
sheet engagement, one card per station, the absence of editor chrome, the screen toolbar
hidden under print media, that the seating sheet fits one printed page, that the Print
button calls `window.print`, and the overview's Print materials entry.

The `backup` flow creates a lesson, opens Backup & restore, downloads a
`.leviz-backup.json`, asserts the file kind/schema/contents, restores it into the same
workspace, and chooses **Import as copies** at the conflict panel. It verifies the
existing lesson remains, a copy appears beside it, and the copy title is labelled.

## Prerequisites

Verified on this machine (2026-11-26): Node v25.8.1, npm 11.14.1, Google Chrome
installed, Playwright 1.65.1 as a dev dependency.

- Node ≥ 20 and npm.
- For the agent path only: Playwright is already in `devDependencies`. No browser
  download is needed — the driver prefers the installed Google Chrome
  (`channel: 'chrome'`) and falls back to bundled Chromium.

## Setup

```bash
cd frontend
npm install
```

Stack (locked in `package.json`): React 19.3, Vite 8, TypeScript 5.9 strict
(`noUncheckedIndexedAccess`), Tailwind CSS 4 (`@tailwindcss/vite`), Konva 10 +
react-konva 19, Zustand 5 + zundo 2.3, TipTap 3.35 (all `@tiptap/*` on the same minor),
dnd-kit, `idb`, Vitest 5 + fake-indexeddb, self-hosted Inter/Merriweather via
`@fontsource`.

## Build

```bash
npm run build
```

Emits static files in `dist/`. `tsc -b` runs first; the build fails on any TypeScript
error. Deep-link refreshes require a static host with SPA fallback (`/index.html`);
`npm run preview` serves it correctly.

## Test

```bash
npm test            # vitest run — all unit + repository-contract tests
npm run typecheck   # tsc -b --force
```

Tests live next to their modules (`src/**/*.test.ts`). The repository suite is shared:
any future PocketBase repository must call `runLessonRepositoryContract` from
`src/repositories/contract.test-utils.ts`.

## Run — agent path (primary)

1. Start the dev server in the background:

   ```bash
   cd frontend
   (npm run dev > /tmp/leviz-frontend-dev.log 2>&1 &)
   ```

   Vite serves on **http://localhost:5173** (verified). Wait until it answers:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
   ```

2. Drive it:

   ```bash
   node .claude/skills/run-leviz-frontend/driver.mjs --url http://localhost:5173
   node .claude/skills/run-leviz-frontend/driver.mjs --flow lesson --url http://localhost:5173
   ```

Driver flags:

| Flag | Default | Meaning |
|---|---|---|
| `--flow load\|lesson\|classes\|teach\|print\|backup` | `load` | `load` = open + screenshot. `lesson` = full end-to-end smoke. `classes` = reusable class roster lifecycle. `teach` = teach-mode timers and rotation guides. `print` = printable seating sheet and station cards. `backup` = full workspace backup/restore. |
| `--url URL` | `http://localhost:5173` | Page to open |
| `--out DIR` | `screenshots` | Where PNGs and the exported JSON land |
| `--headed` | off | Show a real window |
| `--timeout MS` | `30000` | Navigation timeout |
| `--no-fail-on-console` | off | Do not fail on `console.error` |

The driver prints a JSON summary. With `--flow lesson`, `--flow classes`, `--flow teach`, `--flow print`, or `--flow backup` it includes a `checks` array:

```json
{ "ok": true, "flow": "lesson", "browser": "system Chrome",
  "url": "http://localhost:5173", "title": "…",
  "screenshots": ["screenshots/leviz-lesson-01-lesson-start-….png", "…"],
  "checks": [{ "name": "text survives reload", "ok": true }, "…"],
  "consoleErrors": [], "pageErrors": [] }
```

Exit code `1` means a check failed, the page failed to load, or a console/page error
fired. **Open the screenshots** — a blank PNG is a failure even when exit code is 0.

### What the lesson flow assumes

- A 1440×900 viewport (the driver creates its own context).
- The flow sets class size to 12 first; Harkness geometry therefore matches the
  original 12-chair coordinates. Other class sizes shift the chair layout.
- The driver maps canvas world units to the screen at run time via
  `canvasPoint(page, x, y)`, using the `[data-canvas-surface]` rect and the stage fit
  (1000×700 canvas, 28px padding). It clicks **Fit to view** before each mapping so
  zoom/pan can never skew the target, and recomputes the point before every
  interaction. Seat 1 is `(500, 110)` and Seat 5 is `(673, 410)` in world units. If
  the template layout or canvas size changes, update those world coordinates; chrome
  height changes no longer require driver edits.
- Some checks read toast/message text (e.g. `Ada Lovelace → Seat 5`). Toast copy
  changes belong in the driver too.
- Each run uses a fresh browser context, so IndexedDB starts empty and the run does
  not pollute other data.
- The lesson flow checks and dismisses the landing preview gate; classes/teach/print
  call `dismissPreviewGate` before their first action. Acknowledgment is session-scoped,
  so internal returns to the lesson list do not re-block.

### What the print flow assumes

- Default class size (20): Station 1 of the station-rotation template is
  `(90, 60)` with a `250×170` box, so its center is `(215, 145)` in world units.
  Update the driver if the template or canvas changes.
- The flow stubs `window.print` before `goto`, then asserts the Print button calls it
  exactly once. The native dialog is never opened.
- The print page reads the saved lesson; the editor's close save must land before the
  route loads. The flow waits at each navigation.
- The print-media check switches to a `720×960` viewport (7.5in of content at 96dpi) and
  asserts the `.print-sheet` height is at most `960px`. A PDF export of the fixture is
  five letter pages: one seating sheet plus four station cards.

### What the backup flow assumes

- A fresh context starts with one lesson created by the flow; the backup therefore has
  one lesson and no classes.
- The download is saved under `--out` and parsed in Node to assert `kind`,
  `schemaVersion`, lessons, and classes.
- The flow restores that same file to force a conflict, then chooses **Import as
  copies** and asserts the original lesson plus one copy remain.

## Run — human path

```bash
cd frontend && npm run dev
```

Open the printed URL (5173); Ctrl-C to stop.

## Direct invocation

`npm test` is the verified way to exercise domain logic without the app. Konva needs
a real browser: do not try to validate the canvas with jsdom.

## Known constraints

- **No backend in Phase 1.** Lessons and classes persist in IndexedDB per browser
  profile; **Backup & restore** is the full workspace backup, while a single-lesson
  export is for sharing one plan.
- `VITE_POCKETBASE_URL` is read by the repository factory but PocketBase persistence
  ships in Phase 2. If set, the app warns and continues with IndexedDB.
- The app is a static SPA: `dist/` must be served with SPA fallback for `/lessons/:id`.
- Autosave is debounced (~0.9 s) and also flushes on `visibilitychange`/`pagehide`.
  A hard reload script should wait ~1.5 s after the last keystroke before asserting.
- Fonts are self-hosted (`@fontsource`) — no CDN calls at runtime.
- The project is a git repository (default branch `main`); branches and worktrees are
  managed by the host.

## When to re-verify

- `package.json` dependency ranges change (especially react-konva ↔ React major,
  TipTap minors, Tailwind major).
- Canvas geometry, template coordinates, or the editor shell layout change → update
  the driver's coordinates and re-run `--flow lesson`.
- Roster or class-library UI/persistence changes → re-run `--flow classes`.
- Teach-mode timer, layout, or rotation changes → re-run `--flow teach`.
- New routes, panels, or persistence implementations are added.
- Node major version changes (Vitest advertises engine ranges that exclude some
  odd-numbered Node releases; v25.8.1 works, install-time warnings are harmless).
