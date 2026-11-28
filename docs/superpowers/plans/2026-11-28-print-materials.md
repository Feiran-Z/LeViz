# Print Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only print preview for a layout segment: one seating sheet plus one card per station/role, printed through the browser.

**Architecture:** A pure `buildPrintMaterials` domain helper turns a `LayoutSegment` and roster into cards/seats. A new hash route `/lessons/:lessonId/print/:segmentId` loads the lesson with `saveOnClose: false` and renders a printable pack. Entry links live in the layout toolbar and overview; browser print does the rest.

**Tech Stack:** React 19, TypeScript strict, React Router 7 (HashRouter), Tailwind CSS 4, Vitest, Playwright driver. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-28-print-materials-design.md`

## Global Constraints

- Route is exactly `/lessons/:lessonId/print/:segmentId`; load with `useLessonDocument(lessonId, { saveOnClose: false })`.
- The preview never writes the lesson or roster. It reads `lesson.roster`; no class-library lookup.
- Pack order: one seating sheet page, then one card per page. Sheet first.
- Card nodes: `station` and `round-table` always; any other non-teacher node with a non-blank note. Exclude the teacher and bare chairs/desks/stops.
- Seating rows: every node with `capacity > 0`, in reading order (y, then x), with assigned names.
- Card engagement: `resolveNodeEngagement(segment, node)`; sheet engagement: `resolveSegmentEngagement(segment)`.
- Browser print only — no PDF library, no upload, no new persistence, no schema change.
- Print output contains no app chrome/toolbar; white paper, dark text, visible borders, no reliance on background color.
- All commands run from `frontend/`.
- Existing lesson/classes/teach driver flows stay green; `npm test`, `npm run typecheck`, and `npm run build` stay clean.

## Review Focus

- A long note must remain fully visible on its card; no fixed-height clip and no lost final paragraph. Driver note includes a final paragraph that is asserted.
- A Harkness layout with 12 assigned chairs must not print 12 blank cards; only annotated chairs get cards. Domain test.
- In print media the Back/Print toolbar and editor chrome must be gone; only sheet and cards print. Driver test.
- An annotated chair, podium, or wall anchor must get a card; a bare one must not. Domain test.
- An assignment pointing at a student missing from the roster must print “Unknown”, not a blank. Domain test.

---

### Task 1: Print materials domain builder

**Files:**
- Create: `frontend/src/domain/printMaterials.ts`
- Test: `frontend/src/domain/printMaterials.test.ts`

**Interfaces:**
- Consumes: `CanvasNode`, `LayoutSegment`, `Student`, `EngagementDesign` from `./types`; `resolveNodeEngagement`, `resolveSegmentEngagement` from `./engagement`.
- Produces:
  ```ts
  export interface PrintCard {
    node: CanvasNode;
    groupNames: string[];
    engagement: EngagementDesign;
  }
  export interface SeatingRow {
    node: CanvasNode;
    groupNames: string[];
  }
  export interface PrintMaterials {
    cards: PrintCard[];
    seats: SeatingRow[];
    activityEngagement: EngagementDesign;
  }
  export function buildPrintMaterials(
    segment: LayoutSegment,
    students: Student[],
  ): PrintMaterials;
  ```

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/domain/printMaterials.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEngagement } from './engagement';
import { createCanvasNode, createLayoutSegment } from './lesson';
import { buildPrintMaterials } from './printMaterials';
import type { ActivityType, CanvasNode, LayoutSegment, Student } from './types';

function students(...names: string[]): Student[] {
  return names.map((name, index) => ({
    id: `s${index + 1}`,
    name,
    tags: [],
    notWith: [],
    togetherWith: [],
  }));
}

function layout(nodes: CanvasNode[], activityType: ActivityType = 'station-rotation'): LayoutSegment {
  const segment = createLayoutSegment(activityType);
  return {
    ...segment,
    title: 'Station rotation',
    engagement: createEngagement({ cognitive: 'high', behavioral: 'medium', affective: 'low' }),
    canvas: { ...segment.canvas, nodes },
  };
}

describe('buildPrintMaterials', () => {
  it('builds cards in reading order and seats with named groups', () => {
    const roster = students('Ada', 'Grace', 'Alan', 'Katherine', 'Dorothy');
    const nodes = [
      createCanvasNode('station', 0, 0, {
        label: 'Station A',
        assignedStudentIds: ['s1', 's2'],
        note: { title: 'Prompt', body: 'Discuss.' },
      }),
      createCanvasNode('station', 0, 200, { label: 'Station B', assignedStudentIds: ['s3'] }),
      createCanvasNode('round-table', 300, 0, { label: 'Table 1' }),
      createCanvasNode('teacher', 500, 0, {
        label: 'Teacher',
        note: { title: 'Teacher', body: 'Not a card' },
      }),
      createCanvasNode('chair', 600, 0, {
        label: 'Witness',
        assignedStudentIds: ['s4'],
        note: { title: 'Witness', body: 'Answer' },
      }),
      createCanvasNode('chair', 700, 0, { label: 'Seat 1', assignedStudentIds: ['s5'] }),
    ];
    const materials = buildPrintMaterials(layout(nodes), roster);

    expect(materials.cards.map((card) => card.node.label)).toEqual([
      'Station A',
      'Table 1',
      'Witness',
      'Station B',
    ]);
    expect(materials.cards[0]?.groupNames).toEqual(['Ada', 'Grace']);
    expect(materials.cards[2]?.groupNames).toEqual(['Katherine']);
    expect(materials.seats.map((row) => row.node.label)).toEqual([
      'Station A',
      'Table 1',
      'Witness',
      'Seat 1',
      'Station B',
    ]);
    expect(materials.activityEngagement).toEqual({
      cognitive: 'high',
      behavioral: 'medium',
      affective: 'low',
    });
  });

  it('lets a station override engagement and inherits otherwise', () => {
    const nodes = [
      createCanvasNode('station', 0, 0, {
        label: 'Station A',
        engagement: { cognitive: 'low', behavioral: 'high', affective: 'low' },
      }),
      createCanvasNode('station', 0, 200, { label: 'Station B' }),
    ];
    const materials = buildPrintMaterials(layout(nodes), []);

    expect(materials.cards[0]?.engagement).toEqual({
      cognitive: 'low',
      behavioral: 'high',
      affective: 'low',
    });
    expect(materials.cards[1]?.engagement).toEqual({
      cognitive: 'high',
      behavioral: 'medium',
      affective: 'low',
    });
  });

  it('does not turn every assigned chair into a card', () => {
    const roster = students(...Array.from({ length: 12 }, (_, index) => `Student ${index + 1}`));
    const nodes = roster.map((student, index) =>
      createCanvasNode('chair', index * 50, 0, {
        label: `Seat ${index + 1}`,
        assignedStudentIds: [student.id],
        ...(index === 0 ? { note: { title: 'Hot seat', body: 'Lead the opening.' } } : {}),
      }),
    );
    const materials = buildPrintMaterials(layout(nodes, 'harkness'), roster);

    expect(materials.cards.map((card) => card.node.label)).toEqual(['Seat 1']);
    expect(materials.seats).toHaveLength(12);
  });

  it('prints annotated wall stops and podiums but not bare ones', () => {
    const nodes = [
      createCanvasNode('wall-anchor', 0, 0, {
        label: 'Annotated stop',
        note: { title: 'Stop', body: 'Look closely.' },
      }),
      createCanvasNode('wall-anchor', 200, 0, { label: 'Bare stop' }),
      createCanvasNode('podium', 400, 0, {
        label: 'Judge',
        note: { title: 'Role', body: 'Rule on objections.' },
      }),
      createCanvasNode('podium', 500, 0, { label: 'Bare podium' }),
    ];
    const materials = buildPrintMaterials(layout(nodes, 'gallery-walk'), []);

    expect(materials.cards.map((card) => card.node.label)).toEqual(['Annotated stop', 'Judge']);
    expect(materials.seats).toHaveLength(0);
  });

  it('handles an empty layout', () => {
    const materials = buildPrintMaterials(layout([]), []);

    expect(materials.cards).toEqual([]);
    expect(materials.seats).toEqual([]);
    expect(materials.activityEngagement).toEqual({
      cognitive: 'medium',
      behavioral: 'medium',
      affective: 'medium',
    });
  });

  it('names a missing student as Unknown', () => {
    const node = createCanvasNode('station', 0, 0, {
      label: 'Station A',
      assignedStudentIds: ['missing'],
    });
    const materials = buildPrintMaterials(layout([node]), []);

    expect(materials.cards[0]?.groupNames).toEqual(['Unknown']);
  });
});
```

- [ ] **Step 2: Run the tests and confirm the failure**

Run: `cd frontend && npx vitest run src/domain/printMaterials.test.ts`
Expected: FAIL because `./printMaterials` cannot be resolved.

- [ ] **Step 3: Implement `buildPrintMaterials` in `frontend/src/domain/printMaterials.ts`**

Use a local `hasNoteContent(node)` (`Boolean(node.note && (node.note.title.trim() || node.note.body.trim()))`), `readingOrder(nodes)` (`[...nodes].sort((a, b) => a.y - b.y || a.x - b.x)`), and a student-id-to-name map. Build cards by filtering out `teacher`, keeping `station`/`round-table` or `hasNoteContent`, then mapping `{ node, groupNames, engagement: resolveNodeEngagement(segment, node) }`. Build seats from `node.capacity > 0`, mapping `{ node, groupNames }`. Set `activityEngagement: resolveSegmentEngagement(segment)`. Missing names become `'Unknown'`. Do not mutate the segment or its nodes.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd frontend && npx vitest run src/domain/printMaterials.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the full suite**

Run: `cd frontend && npm test`
Expected: PASS; existing 146 tests plus the 6 new tests, no failures.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/domain/printMaterials.ts frontend/src/domain/printMaterials.test.ts
git commit -m "feat: add print materials domain builder"
```

---

### Task 2: Print route, seating sheet, cards, entries, and print CSS

**Files:**
- Create: `frontend/src/pages/PrintMaterialsPage.tsx`
- Create: `frontend/src/components/print/PrintPack.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/segments/LayoutSegmentEditor.tsx`
- Modify: `frontend/src/components/overview/LessonOverview.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/.claude/skills/run-leviz-frontend/driver.mjs`

**Interfaces:**
- Consumes: `buildPrintMaterials` from Task 1.
- Produces: `PrintMaterialsPage`; `PrintPack({ lesson, segment, materials })`; route `/lessons/:lessonId/print/:segmentId`; entry links named exactly `Print materials`.

- [ ] **Step 1: Add the failing `print` driver flow**

In `driver.mjs`: add `print` to the usage string, the `--flow` validation array, and `main` dispatch. Add `runPrintFlow(page, opts, shoot, checks)` after `runTeachFlow`. It must install `window.print` before `goto`:

```js
await page.addInitScript(() => {
  window.__levizPrintCalls = 0;
  window.print = () => { window.__levizPrintCalls += 1; };
});
```

Then create a lesson, add the **Station rotation** layout, add eight students, generate and apply groups (assert `Placed 8 students across 4 seats`), and note Station 1 at canvas `(215, 145)` (title `Station 1 prompt`, body with two paragraphs ending `Choose one sentence to share.`). Click the link `Print materials` and wait for `/\/print\//`. Assert:

- route contains `/print/`;
- body includes `Seating sheet` and `Seats and assignments`;
- body includes `Station 1 prompt` and `Choose one sentence to share.`;
- body matches `/Group: Student \d/`;
- body includes `Cognitive` and `Medium`;
- `page.locator('.print-card')` has count `4`;
- the print page has no `Roster` tab;
- with `page.emulateMedia({ media: 'print' })`, `page.locator('.print-toolbar').isVisible()` is false; then reset to screen;
- clicking `Print` exactly makes `window.__levizPrintCalls === 1`;
- `Back to editor` returns to `/lessons/:id`; open the overview and click `Print materials` there; the route opens and shows `Seating sheet`.

Take screenshots `01-print-preview`, `02-print-media`, and `03-overview-entry`.

Run: `cd frontend && node .claude/skills/run-leviz-frontend/driver.mjs --flow print --url http://localhost:5173`
Expected: FAIL — the `Print materials` link does not exist yet (or the route is absent).

- [ ] **Step 2: Implement `PrintMaterialsPage` and `PrintPack`**

`PrintMaterialsPage` uses `useParams<{ lessonId: string; segmentId: string }>()`, `useLessonDocument(lessonId, { saveOnClose: false })`, and the lesson store status/lesson. Handle loading/missing/error with the same compact panels as `TeachPage`. Find the segment by `segmentId`; if absent or not `kind === 'layout'`, show “This layout segment is not available” and a link back to the lesson. Set `document.title` to `Print materials · ${lesson.title} · LeViz`.

Render:

```tsx
<div className="print-materials min-h-full bg-page print:bg-white">
  <header className="print-toolbar sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-default bg-surface px-5 py-2.5 print:hidden">
    <Link to={`/lessons/${lesson.id}`} className="btn btn-secondary btn-sm">
      <Icon name="arrow-left" size={14} /> Back to editor
    </Link>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-wider text-secondary">Print materials</p>
      <h1 className="truncate text-[15px] font-semibold">{lesson.title}</h1>
    </div>
    <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
      <Icon name="printer" size={14} /> Print
    </button>
  </header>
  <main className="mx-auto w-full max-w-[9in] px-4 py-6 print:max-w-none print:p-0">
    <PrintPack lesson={lesson} segment={segment} materials={materials} />
  </main>
</div>
```

`materials = useMemo(() => buildPrintMaterials(segment, lesson.roster), [segment, lesson.roster])`.

`PrintPack` renders a `<section className="print-page print-sheet">` followed by one `<article className="print-page print-card">` per card. The sheet includes:

- `Seating sheet` kicker, lesson title, `ACTIVITY_LABELS[segment.activityType] · segment.title · durationMin min`;
- `Engagement` + `<EngagementSummary design={materials.activityEngagement} />`;
- activity instructions if present, `whitespace-pre-wrap`;
- `LayoutThumbnail` if `segment.canvas.nodes.length > 0`, else `No furniture placed.`;
- heading `Seats and assignments` and a table with columns `Seat / station`, `Students`, `Capacity`; rows `row.node.label`, `row.groupNames.join(', ') || '—'`, `${row.node.assignedStudentIds.length}/${row.node.capacity}`;
- if no seats: `No student seats in this layout.`;
- if no cards: `No station cards yet — add a station or a note in the editor.`

Each card includes:

- kicker `NODE_TYPE_INFO[card.node.type].label card ${index + 1} of ${materials.cards.length}`;
- `h2` `card.node.label || 'Untitled station'`;
- a prompt block: if the node has a non-blank note, the note title then body (`whitespace-pre-wrap text-[15px] leading-7`); otherwise a bordered blank area with `min-h-[3in]` and a screen-only muted line `No prompt yet — add one in the editor, or write on the printed card.` (use `print:hidden` on that line);
- `Group: ${card.groupNames.join(', ') || 'No group assigned'}`;
- `Seats: ${card.node.assignedStudentIds.length}/${card.node.capacity}` when capacity > 0;
- `Engagement` + `<EngagementSummary design={card.engagement} />`;
- footer `${lesson.title} · ${segment.title}`.

No fixed height on the prompt block; one card per page is set by the print page break.

- [ ] **Step 3: Wire the route and entries**

In `App.tsx`, add before the lesson route:

```tsx
<Route path="/lessons/:lessonId/print/:segmentId" element={<PrintMaterialsPage />} />
```

In `LayoutSegmentEditor.tsx`, read `const lessonId = useLessonStore((state) => state.lesson?.id ?? null);`, import `Link` from `react-router-dom`, and wrap the activity instructions button in a `ml-auto flex items-center gap-1` group with a preceding link (when `lessonId`) named `Print materials`, using the printer icon. Remove `ml-auto` from the button itself.

In `LessonOverview.tsx`, change `LayoutSection` to accept `lessonId: string`, pass `lesson.id` at the call site, and add at the top of the section a `print:hidden` right-aligned link to `/lessons/${lessonId}/print/${segment.id}` with the printer icon and text `Print materials`. Keep the overview's existing top-level `Print` button unchanged.

- [ ] **Step 4: Add print CSS**

In `frontend/src/index.css`, add a top-level `@page { size: letter; margin: 0.5in; }` and screen/print rules:

- `.print-page` on screen: `width: 8.5in; max-width: 100%; min-height: 10in; margin: 0 auto 1rem; padding: 0.5in; background: #fff; color: #1f1c18; border: 1px solid var(--border-default); box-shadow: 0 1px 4px rgb(0 0 0 / 12%);`
- `@media print`: `.print-page { width: auto; min-height: 0; margin: 0; padding: 0; border: 0; box-shadow: none; background: #fff; break-after: page; }`, `.print-page:last-child { break-after: auto; }`, `.print-toolbar { display: none !important; }`, and card/sheet borders `#999`.
- `@media print` scoped to `.print-materials`: reset `--bg-page`, `--bg-surface`, `--bg-canvas`, `--node-fill`, `--station-fill`, `--node-stroke`, `--node-label`, `--text-primary`, `--text-secondary`, `--text-placeholder`, `--text-inverse`, `--border-default`, `--border-strong`, and `--accent-primary` to white/gray/black values so a dark-theme screen still prints light. Do not reset series chart tokens.
- `.print-materials { color: #000 }` inside print.

- [ ] **Step 5: Run the gates and the new flow**

Run, in order:

```bash
cd frontend
npm test
npm run typecheck
npm run build
node .claude/skills/run-leviz-frontend/driver.mjs --flow print --url http://localhost:5173
```

Expected: tests pass, typecheck/build clean, print flow all checks pass with zero console/page errors, and all three screenshots are non-blank. Open the screenshots and verify the sheet, cards, print-media view, and overview entry.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PrintMaterialsPage.tsx frontend/src/components/print/PrintPack.tsx \
  frontend/src/App.tsx frontend/src/components/segments/LayoutSegmentEditor.tsx \
  frontend/src/components/overview/LessonOverview.tsx frontend/src/index.css \
  frontend/.claude/skills/run-leviz-frontend/driver.mjs
git commit -m "feat: add printable station cards and seating sheet"
```

---

### Task 3: Document the feature and verify the whole app

**Files:**
- Modify: `README.md`
- Modify: `docs/roadmap/2026-11-27-enhancement-suggestions.md`
- Modify: `frontend/.claude/skills/run-leviz-frontend/SKILL.md`
- Add: `docs/superpowers/specs/2026-11-28-print-materials-design.md`
- Add: `docs/superpowers/plans/2026-11-28-print-materials.md`

- [ ] **Step 1: Update the README**

Add a short paragraph after the Teach mode paragraph: print materials opens a layout's seating sheet and one card per station/role from the layout toolbar or overview; the browser print dialog handles paper; printing includes the saved roster and stays local.

- [ ] **Step 2: Mark roadmap item 3 implemented**

Under `## 3. Printable station and role cards`, add `**Status:** Implemented (V1). Design: [Print materials design](../superpowers/specs/2026-11-28-print-materials-design.md).` Keep the original pain/change text.

- [ ] **Step 3: Update the run skill evidence**

In `frontend/.claude/skills/run-leviz-frontend/SKILL.md`, update the verified status block with the actual test count/file count after Task 1 and the new `--flow print` result and screenshot count. Add the print flow to the driver flags/table and the flow description. Keep the existing lesson/classes/teach evidence; add print.

- [ ] **Step 4: Run the final gates**

```bash
cd frontend
npm test
npm run typecheck
npm run build
node .claude/skills/run-leviz-frontend/driver.mjs --flow print --url http://localhost:5173
node .claude/skills/run-leviz-frontend/driver.mjs --flow lesson --url http://localhost:5173
node .claude/skills/run-leviz-frontend/driver.mjs --flow classes --url http://localhost:5173
node .claude/skills/run-leviz-frontend/driver.mjs --flow teach --url http://localhost:5173
```

Expected: all tests pass; typecheck/build clean; print flow all checks pass; lesson (32), classes (14), and teach (31) flows remain green with zero console/page errors. Open the print screenshots and check that the toolbar is absent in the print-media shot and that the final note paragraph is visible.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/roadmap/2026-11-27-enhancement-suggestions.md \
  frontend/.claude/skills/run-leviz-frontend/SKILL.md \
  docs/superpowers/specs/2026-11-28-print-materials-design.md \
  docs/superpowers/plans/2026-11-28-print-materials.md
git commit -m "docs: document printable materials"
```

---

## Self-Review

- **Spec coverage:** route, entries, sheet, cards, filtering, engagement, empty states, read-only close, browser print, print CSS, tests, driver, docs are all assigned.
- **Types:** `PrintMaterials`, `PrintCard`, `SeatingRow`, and `buildPrintMaterials` are defined once in Task 1 and consumed unchanged in Task 2.
- **Review Focus:** the long-note, Harkness, print-chrome, annotated-stop, and missing-name cases each have a test in the task that owns the behavior.
- **No hidden implementation:** Task 2 pins props, selectors, copy, page structure, and CSS behavior; the builder chooses only typography/spacing details within those constraints.
