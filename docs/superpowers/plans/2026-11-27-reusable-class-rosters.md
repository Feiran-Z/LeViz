# Reusable Class Rosters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local class-roster library so a lesson can adopt a class once, refresh from it, or save its own roster back as a class, with tags and constraints preserved.

**Architecture:** A separate `ClassRoster` aggregate in IndexedDB v2, a `classRosterStore`, and session functions that copy a class snapshot into the lesson's roster. Lessons keep `classId` plus their roster copy; applying/refreshing a class prunes assignments by student ID. Class-link changes are deliberate and excluded from lesson undo.

**Tech Stack:** React 19, TypeScript, Zustand, IndexedDB (`idb`), Vitest, Playwright smoke driver.

**Spec:** `docs/superpowers/specs/2026-11-27-reusable-class-rosters-design.md`

## Global Constraints

- Snapshot + explicit refresh; **no live-linked rosters**.
- Assignment matching is **ID-only**; applying a class to a lesson with different IDs clears those assignments after a confirmation naming the count.
- `classSize` is **metadata-only** on apply; never move or re-template existing furniture.
- Class library is local IndexedDB v2; lessons stay self-contained and exportable.
- Class-link operations are **outside lesson undo**; roster edits remain undoable.
- Class names are trimmed and unique case-insensitively.
- Classes are created only from a lesson roster; delete does not cascade.
- V1 has no class export/import and no cross-device sync.
- Existing 95 tests, typecheck, build, and the 32-check lesson driver stay green.

## Review Focus

- **Applying a class to a lesson with different student IDs:** assignments are removed, the count is shown in the confirmation, and nothing is lost silently. Tested in Task 3 (store/session) and Task 4 (UI confirm).
- **IndexedDB v1 → v2:** existing lessons survive and the `classes` store appears once. Tested in Task 2.
- **Snapshot drift:** save-to-class changes only the class; linked lessons keep their snapshots until refresh. Tested in Task 3.
- **Undo mismatch:** apply/link/unlink do not add a lesson undo entry and cannot leave `classId` out of sync with the roster. Tested in Task 3.
- **Dangling class after delete:** linked lessons keep the snapshot and show “Class unavailable”; unlink and save-as-class still work. Tested in Task 5.

## File Structure

```
frontend/src/domain/
  types.ts                       ClassRoster type, LessonMeta.classId
  classRoster.ts                 createClassRoster, assignment pruning/counting
  lesson.ts                      createLesson classId: null
  serialize.ts                   classId normalization
frontend/src/repositories/
  types.ts                       ClassRosterRepository
  index.ts                       class repository factory + test seam
  indexeddb/db.ts                shared schema + openLevizDb (DB_VERSION 2)
  indexeddb/index.ts             lesson repository uses the shared DB
  indexeddb/classes.ts           IndexedDB class repository
  classRosterContract.test-utils.ts
frontend/src/stores/
  classRosterStore.ts            library state + validation
  lessonStore.ts                 applyClassRoster/linkClass/unlinkClass (undo-free)
  classSession.ts                cross-store use cases
frontend/src/components/
  ui/PromptDialog.tsx            reusable name prompt with inline error
  panels/RosterClassSection.tsx  class row above the roster
  panels/RosterPanel.tsx         renders the class section
  classes/ClassesDialog.tsx      list/rename/delete
  pages/LessonListPage.tsx       “Classes” header button + dialog
frontend/.claude/skills/run-leviz-frontend/driver.mjs   --flow classes
```

---

### Task 1: Domain model, pruning helpers, and normalization

**Files:**
- Modify: `frontend/src/domain/types.ts`
- Create: `frontend/src/domain/classRoster.ts`
- Modify: `frontend/src/domain/lesson.ts`
- Modify: `frontend/src/domain/serialize.ts`
- Modify: `frontend/src/stores/lessonSession.ts`
- Test: `frontend/src/domain/classRoster.test.ts`, `frontend/src/domain/serialize.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ClassRoster { id: string; name: string; students: Student[]; createdAt: string; updatedAt: string; }
  // LessonMeta gains: classId: string | null
  function createClassRoster(name: string, students: Student[]): ClassRoster;
  function pruneAssignmentsToRoster(segments: Segment[], rosterIds: ReadonlySet<string>): Segment[];
  function countRemovedAssignments(segments: Segment[], rosterIds: ReadonlySet<string>): number;
  ```

- [ ] **Step 1: Write failing domain tests**

In `classRoster.test.ts`: trimmed name; cloned students (mutating the source does not change the class); id prefix `class_`; ISO timestamps; pruning removes IDs outside the set only from layout nodes; text segments are returned unchanged; the removed count matches.

In `serialize.test.ts`: a lesson with `classId` round-trips; a lesson object with `classId` deleted normalizes to `null` on parse.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/domain/classRoster.test.ts src/domain/serialize.test.ts`
Expected: FAIL — module/type missing.

- [ ] **Step 3: Implement**

- Add `ClassRoster` to `types.ts`; add `classId: string | null` to `LessonMeta`.
- `createLesson` sets `classId: null`; `createClassRoster` uses `newId('class')` and `structuredClone`.
- Implement the two assignment helpers over `Segment[]`.
- `parseLesson` sets `classId` to a non-empty string or `null` after validation.
- `openLesson` adds `classId: lesson.classId ?? null` to the normalized lesson.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm test && npm run typecheck`
Expected: 95 existing tests plus the new ones pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/types.ts frontend/src/domain/classRoster.ts frontend/src/domain/lesson.ts frontend/src/domain/serialize.ts frontend/src/stores/lessonSession.ts frontend/src/domain/classRoster.test.ts frontend/src/domain/serialize.test.ts
git commit -m "feat: add class roster domain model and assignment pruning"
```

---

### Task 2: Class repository and IndexedDB v2

**Files:**
- Create: `frontend/src/repositories/indexeddb/db.ts`
- Create: `frontend/src/repositories/indexeddb/classes.ts`
- Create: `frontend/src/repositories/classRosterContract.test-utils.ts`
- Modify: `frontend/src/repositories/indexeddb/index.ts`
- Modify: `frontend/src/repositories/types.ts`
- Modify: `frontend/src/repositories/index.ts`
- Test: `frontend/src/repositories/indexeddb/classes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ClassRosterRepository {
    listClasses(): Promise<ClassRoster[]>;
    getClass(id: string): Promise<ClassRoster | null>;
    saveClass(classRoster: ClassRoster): Promise<ClassRoster>;
    deleteClass(id: string): Promise<void>;
  }
  function getClassRosterRepository(): ClassRosterRepository;
  function setClassRosterRepository(next: ClassRosterRepository | null): void;
  ```
- `openLevizDb(dbName = 'leviz')` owns `DB_VERSION = 2`; `classes` has key `id` and index `by-name`.

- [ ] **Step 1: Write the failing contract tests**

Add `runClassRosterRepositoryContract(name, makeRepository)` with: unknown → null; save/read unchanged; list sorted by name; overwrite; delete. Add a migration test that opens a v1 DB, writes a lesson with the old schema, closes it, then opens via `IndexedDbLessonRepository` and `IndexedDbClassRosterRepository` on the same db name; the lesson is preserved and class CRUD works.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/repositories/indexeddb/classes.test.ts`
Expected: FAIL — repository/module missing.

- [ ] **Step 3: Implement**

- Move the schema/upgrade into `db.ts`; create `lessons` when absent and `classes` when absent (`oldVersion < 2`), keeping existing lessons.
- `IndexedDbClassRosterRepository` uses `openLevizDb`; `listClasses` reads `by-name`.
- Refactor `IndexedDbLessonRepository` to use `openLevizDb` without changing behaviour.
- Add the class repository factory + test seam; the PocketBase branch warns and falls back as the lesson factory does.

- [ ] **Step 4: Verify**

Run: `cd frontend && npx vitest run src/repositories/indexeddb/classes.test.ts src/repositories/indexeddb/index.test.ts && npm run typecheck`
Expected: all repository contract tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/repositories/indexeddb/db.ts frontend/src/repositories/indexeddb/classes.ts frontend/src/repositories/indexeddb/index.ts frontend/src/repositories/classRosterContract.test-utils.ts frontend/src/repositories/indexeddb/classes.test.ts frontend/src/repositories/types.ts frontend/src/repositories/index.ts
git commit -m "feat: persist class rosters with IndexedDB v2"
```

---

### Task 3: Class store, lesson class actions, and session use cases

**Files:**
- Create: `frontend/src/stores/classRosterStore.ts`
- Create: `frontend/src/stores/classSession.ts`
- Modify: `frontend/src/stores/lessonStore.ts`
- Test: `frontend/src/stores/classRosterStore.test.ts`, `frontend/src/stores/lessonStore.test.ts`, `frontend/src/stores/classSession.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ClassRosterState {
    classes: ClassRoster[] | null;
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    refresh: () => Promise<void>;
    createFromStudents: (name: string, students: Student[]) => Promise<ClassRoster>;
    saveStudents: (id: string, students: Student[]) => Promise<ClassRoster>;
    rename: (id: string, name: string) => Promise<ClassRoster>;
    remove: (id: string) => Promise<void>;
    get: (id: string) => ClassRoster | undefined;
  }
  // lessonStore additions:
  applyClassRoster: (classRoster: ClassRoster, options: { setClassSize: boolean }) => void;
  linkClass: (classId: string) => void;
  unlinkClass: () => void;
  // classSession:
  applyClassToLesson(classRoster): { removedAssignments: number };
  refreshLessonFromClass(classRoster): { removedAssignments: number };
  saveRosterAsClass(name): Promise<ClassRoster>;
  saveChangesToClass(): Promise<ClassRoster>;
  unlinkLessonClass(): void;
  ```

- [ ] **Step 1: Write failing store/session tests**

- `classRosterStore.test.ts`: refresh; create rejects empty names/students and duplicate names case-insensitively; tags/constraints survive; rename; saveStudents updates students/updatedAt; remove.
- `lessonStore.test.ts`: `applyClassRoster` sets classId and (when requested) classSize, prunes assignments outside the class, and leaves node geometry untouched; `setClassSize: false` keeps classSize; `linkClass`/`unlinkClass`; class-link actions add no lesson undo entry (`useLessonStore.temporal.getState().pastStates.length` unchanged).
- `classSession.test.ts`: apply loads the roster and returns the removed count; refresh does the same without changing classSize; saveRosterAsClass creates and links; saveChangesToClass overwrites the class; unlink keeps the roster.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/stores/classRosterStore.test.ts src/stores/lessonStore.test.ts src/stores/classSession.test.ts`
Expected: FAIL — actions/modules missing.

- [ ] **Step 3: Implement**

- Class store uses `getClassRosterRepository`; validate names and students; keep `classes` sorted by name; update `updatedAt`.
- Lesson store: add a `mutateDetached` helper (pause/resume zundo) used by `applyClassRoster`, `linkClass`, `unlinkClass`; prune with `pruneAssignmentsToRoster`; set `classSize` only when requested.
- Session: orchestrate rosterStore + lessonStore + classStore as specified; return the removed count computed with `countRemovedAssignments` before pruning.
- Class rename/copy/delete do not touch lessons.

- [ ] **Step 4: Verify**

Run: `cd frontend && npm test && npm run typecheck`
Expected: all tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/classRosterStore.ts frontend/src/stores/classSession.ts frontend/src/stores/lessonStore.ts frontend/src/stores/classRosterStore.test.ts frontend/src/stores/lessonStore.test.ts frontend/src/stores/classSession.test.ts
git commit -m "feat: add class roster store and lesson session use cases"
```

---

### Task 4: Roster panel class controls

**Files:**
- Create: `frontend/src/components/ui/PromptDialog.tsx`
- Create: `frontend/src/components/panels/RosterClassSection.tsx`
- Modify: `frontend/src/components/panels/RosterPanel.tsx`
- Test: `frontend/.claude/skills/run-leviz-frontend/driver.mjs`

**Interfaces:**
- `PromptDialog` props: `open`, `title`, `label`, `initialValue?`, `confirmLabel`, `onCancel`, and `onConfirm(value): string | null | Promise<string | null>` (a returned string is an inline error).
- `RosterClassSection` consumes the class store and session functions; renders above the roster add input.

- [ ] **Step 1: Add failing `--flow classes` checks**

Extend the driver CLI to allow `classes`. The new flow:
- create a lesson, add Ada/Grace/Alan/Katherine;
- add a tag to Ada and a “together with” constraint Ada+Grace;
- “Save as class…” → name “Period 3”; assert the linked class row;
- create a second lesson, use class, confirm; assert four students, the tag, and the constraint;
- add “Student 5”, “Save changes to class”, create a third lesson and use class; assert five students.
Run: `node .claude/skills/run-leviz-frontend/driver.mjs --flow classes --url http://localhost:5173`
Expected: fail — no class controls.

- [ ] **Step 2: Implement the prompt dialog**

A small modal with a text input, Cancel/Save, Enter submits, Escape cancels, and inline error text; focus the input on open.

- [ ] **Step 3: Implement the class section and wire it**

- On mount, refresh classes.
- Unlinked: class select, Use class, Save as class, Manage classes (opened in Task 5).
- Linked: name, Refresh from class, Save changes to class, Unlink.
- Missing class: “Class unavailable — roster snapshot kept” + Save as class + Unlink.
- Confirmations use `ConfirmDialog` and include the removed-assignment count for Use/Refresh; save-to-class warns that other lessons keep snapshots.
- Copy rules: “Use class” replaces the roster; “Refresh” replaces the roster; “Save changes” overwrites the class; “Unlink” keeps the roster.
- Wire `<RosterClassSection />` above the add-student input in `RosterPanel`.

- [ ] **Step 4: Run the class flow**

Run: `node .claude/skills/run-leviz-frontend/driver.mjs --flow classes --url http://localhost:5173`
Expected: the core class checks pass; zero console errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/PromptDialog.tsx frontend/src/components/panels/RosterClassSection.tsx frontend/src/components/panels/RosterPanel.tsx frontend/.claude/skills/run-leviz-frontend/driver.mjs
git commit -m "feat: add class controls to the roster panel"
```

---

### Task 5: Classes manager and lesson-list entry point

**Files:**
- Create: `frontend/src/components/classes/ClassesDialog.tsx`
- Modify: `frontend/src/pages/LessonListPage.tsx`
- Modify: `frontend/src/components/panels/RosterClassSection.tsx`
- Modify: `frontend/.claude/skills/run-leviz-frontend/driver.mjs`

**Interfaces:**
- `ClassesDialog` props: `open`, `onClose`; lists classes, renames and deletes via the class store; no create.
- The lesson list header gets a “Classes” button opening the same dialog.

- [ ] **Step 1: Add failing manager checks**

Extend `--flow classes`: open the manager from the lesson list, rename “Period 3” to “Period 3A”, assert the linked roster updates; delete the class and assert the lesson shows “Class unavailable”, the roster still has five students, and Unlink/Save as class are offered.
Run: `node .claude/skills/run-leviz-frontend/driver.mjs --flow classes --url http://localhost:5173`
Expected: fail — manager/list entry missing.

- [ ] **Step 2: Implement**

- Dialog: refresh on open; name/student count/updated; Rename via `PromptDialog`; Delete via `ConfirmDialog` explaining that linked lessons keep snapshots; empty state.
- List header button with a `users` icon; dialog state.
- The Roster section’s “Manage classes” opens the same dialog.
- After delete, a linked lesson’s section shows the unavailable state without crashing.

- [ ] **Step 3: Run the class flow**

Run: `node .claude/skills/run-leviz-frontend/driver.mjs --flow classes --url http://localhost:5173`
Expected: all class checks pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/classes/ClassesDialog.tsx frontend/src/pages/LessonListPage.tsx frontend/src/components/panels/RosterClassSection.tsx frontend/.claude/skills/run-leviz-frontend/driver.mjs
git commit -m "feat: add class manager and lesson-list entry point"
```

---

### Task 6: Documentation, full driver, and final gates

**Files:**
- Modify: `.claude/documentation/architecture.md`
- Modify: `.claude/documentation/project_overview.md`
- Modify: `README.md` (and the pilot note if appropriate)
- Modify: `frontend/.claude/skills/run-leviz-frontend/SKILL.md`
- Test: full suites + both driver flows

- [ ] **Step 1: Update documentation**

- Architecture: the second aggregate, `ClassRosterRepository`, `classes` store, DB v2, snapshot semantics, class-link actions outside undo.
- Product overview: reusable class rosters; resolve the “per-lesson vs shared roster” open question.
- README/pilot notes: classes are local to this browser; lesson exports carry the roster snapshot; class library backup is a follow-up.
- Run skill: new `--flow classes` and updated check counts.

- [ ] **Step 2: Run all gates**

```bash
cd frontend
npm test
npm run typecheck
npm run build
node .claude/skills/run-leviz-frontend/driver.mjs --flow lesson --url http://localhost:5173
node .claude/skills/run-leviz-frontend/driver.mjs --flow classes --url http://localhost:5173
```
Expected: all tests pass; typecheck/build clean; both driver flows green with zero console errors.

- [ ] **Step 3: Commit**

```bash
git add .claude/documentation/architecture.md .claude/documentation/project_overview.md README.md frontend/.claude/skills/run-leviz-frontend/SKILL.md
git commit -m "docs: document reusable class rosters"
```

---

## Self-Review

- Spec coverage: class library, classId snapshots, apply/refresh/save/unlink, ID-only reconciliation, metadata-only class size, no undo, unique names, delete no-cascade, Roster panel, Classes dialog, local-only, tests, driver, docs — every section maps to a task.
- Review Focus has a test in the owning task for each failure mode.
- Types and names are consistent across tasks (`ClassRosterRepository`, `applyClassRoster`, `saveStudents`, `pruneAssignmentsToRoster`, `RosterClassSection`, `ClassesDialog`).
- The plan is scoped to V1; class export/backup and cross-device sync stay explicitly out.
- Proportion: six tasks for a new aggregate, migration, stores, two dialogs, and a driver flow; no task is a code transcript.
