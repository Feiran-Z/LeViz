# Reusable Class Rosters — Design

## Intent and why

A teacher plans many lessons for the same class. Today every lesson owns its roster:
`Lesson.roster` is copied into `rosterStore` when the lesson opens, and saved back into
the lesson. Names, tags, and “together with / keep apart from” constraints are re-entered
for every lesson and every section.

Add a local **class roster library**: each class holds a name and a roster with tags and
constraints. A lesson can adopt a class in one action, refresh from it later, or save its
own roster back as a class. The lesson keeps a snapshot, so old plans and exports stay
complete and do not silently change.

## Goals

- Create a class from an existing lesson roster, including tags and constraints.
- Apply a class to a lesson in one action; reuse it across any number of lessons.
- Refresh a lesson from its class, preserving assignments by student ID.
- Save edits from a linked lesson back to its class.
- Manage classes: list, rename, delete.
- Keep lesson documents self-contained and exportable.

## Non-goals

- Live-linked rosters (class edits do not propagate automatically).
- Cross-device sync; classes are local to the browser until Phase 2.
- Class-level period length, room, subject, or standards metadata.
- Editing a class roster in a dedicated class editor; editing happens through a linked
  lesson’s existing Roster panel.
- Export/import of the class library in this version (lesson exports still carry the
  roster snapshot).
- Grading, attendance, or student accounts.

## Anti-goals

- Making an existing lesson’s roster change when another lesson or class is edited.
- Breaking `parseLesson`/lesson export or the complete-document invariant.
- Silently removing student assignments or constraints during a refresh.

## Current state

- `Lesson.roster: Student[]`; `Student` carries `tags`, `notWith`, `togetherWith`.
- `rosterStore` edits the open lesson’s roster with undo/redo; `lessonStore.save()`
  writes it into the lesson.
- `LessonRepository` stores whole lessons in IndexedDB (`DB_VERSION = 1`, `lessons` store).
- `RosterPanel` already edits names, tags, and constraints and pastes a class list.
- Lessons remain complete documents; exports include the roster.

## Approaches considered

1. **Class library + lesson snapshot + explicit refresh — chosen.**
   A separate local `ClassRoster` library; the lesson stores `classId` and a copy of the
   roster. “Use class” copies; “Refresh” reconciles. Exports stay self-contained; class
   edits are deliberate.
2. **Live-linked class — rejected.** The lesson would reference the class instead of
   copying it. Updates propagate immediately, but historical plans change, exports depend
   on a separate class file, and the complete-document invariant breaks.
3. **Copy at creation only — rejected as the primary model.** A class can seed a lesson
   once, but there is no way to update the class and refresh existing plans.

## Data model

```ts
interface ClassRoster {
  id: string;              // class_<uuid>
  name: string;            // trimmed, unique (case-insensitive)
  students: Student[];     // names, tags, notWith, togetherWith; IDs preserved on copy
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}
```

`LessonMeta` gains:

```ts
classId: string | null;    // null = no class link; the roster is lesson-only
```

Rules:

- `createLesson()` sets `classId: null`.
- Old documents normalize `classId` to `null` in `parseLesson` and `openLesson`.
- `classId` may dangle if a class is deleted; the lesson keeps its roster snapshot.
- Classes and lessons share student IDs when a class is created from a lesson, so
  assignments can be matched on refresh.

## Persistence and architecture

- New aggregate: `ClassRosterRepository` with `listClasses`, `getClass`, `saveClass`,
  `deleteClass`; `listClasses` returns full classes sorted by name (library sizes are
  small).
- IndexedDB moves to `DB_VERSION = 2` with a `classes` object store. A shared
  `openLevizDb(dbName)` helper owns the schema and upgrade path so the lesson and class
  repositories cannot drift. Upgrade creates `classes` if missing and keeps existing
  lessons untouched.
- The repository factory gains `getClassRosterRepository()` / a test seam. Phase 2 adds
  a PocketBase implementation; not in this scope.
- `useClassRosterStore` (L3) owns the library: `refresh`, `createFromStudents`, `rename`,
  `remove`, `get`. It writes through the repository.
- Session orchestration (extend `lessonSession` or add `classSession`) owns cross-store
  operations:
  - apply a class to a lesson (rosterStore + lessonStore),
  - refresh from the linked class,
  - save the lesson roster back to the class,
  - unlink.
- A pure helper filters layout assignments to a roster ID set. Applying or refreshing a
  class uses it; removed students are unassigned everywhere in the lesson.
- Class link changes are deliberate, confirmed operations and are **outside lesson
  undo** (no partial undo state between `classId` and the roster). Roster edits remain
  undoable. Unlink is the escape hatch.

## Reuse semantics

**Apply a class** (lesson has no class, or switching):
- Copy the class students into the roster (structured clone; constraints preserved).
- Set `lesson.classId`; set `lesson.classSize` to the class student count as **metadata
  only**. Existing furniture and canvas geometry are not moved or re-templated; future
  layout segments size to the new count. The teacher can still edit class size.
- Preserve assignments whose student IDs exist in the class; remove assignments for
  students who are not in it; new students start unassigned.
- This is **ID-only by design**. Applying a class to an existing lesson built from a
  different set of student IDs intentionally clears those seat assignments after a
  confirmation that names how many will be removed. Reusing a class across sections
  without re-seating is the V1.1 “New lesson from class” flow, not this action.
- Confirm when the lesson already has students or assignments.

**Refresh from class**:
- Replace the lesson roster with the class roster.
- Preserve assignments by ID, remove the rest, leave new students unassigned.
- Leave `classSize` unchanged (layout geometry should not move unexpectedly).
- Confirm, naming how many students/assignments will change.

**Save changes to class**:
- Overwrite the linked class with the current lesson roster, tags, and constraints.
- Other lessons keep their snapshots until they refresh.
- Confirm; a class edit is a shared-library change.

**Save as class** (when unlinked):
- Prompt for a unique name; create the class from the current roster; link the lesson.
- Empty rosters are not eligible.

**Unlink**:
- Set `classId` to null; keep the roster. No confirmation needed.

**Delete a class** (manager):
- Remove it from the library. Linked lessons keep their snapshots and show “Class
  unavailable”; they can Save as class or Unlink. Confirm and explain this.

## UI

**Roster panel** — a class row above the add-student input.

Unlinked:

```
Class  [Choose a class ▾]  [Use class]  [Save as class…]  · Manage classes
```

Linked:

```
Class  Period 3   [Refresh from class]  [Save changes to class]  [Unlink]  · Manage classes
```

- Selecting a class and pressing Use applies it (confirm if needed).
- “Save as class…” opens a small name prompt.
- “Manage classes” opens the Classes dialog.
- If the linked class no longer exists: show “Class unavailable — roster snapshot kept”
  with [Save as class…] and [Unlink].
- Reuse the existing roster editor for tags/constraints; no second editor.

**Classes dialog** — reachable from the Roster panel and a “Classes” button on the
lesson list:
- List: name, student count, last updated.
- Rename (unique name), delete (confirm).
- No create here; classes start from a lesson roster.
- No linked-lesson counts in this version (would require scanning lessons).

**Lesson list**: a “Classes” header button opens the dialog. Lesson cards are unchanged
in this version.

## Compatibility and migration

- Old lessons load with `classId: null`; no roster changes.
- Lesson export/import includes `classId` and the roster snapshot. On another device the
  class may be absent; the snapshot works and the panel offers to recreate the class or
  unlink.
- The class library is local. This is documented in the pilot notes and README; a class
  export/backup is a follow-up.

## Testing

- Domain: assignment filtering to a roster ID set; class creation/cloning; constraint
  pruning when a class is saved from a lesson that removed a student.
- Repository: a shared class-repository contract suite (unknown → null, save/read,
  alphabetical listing, overwrite, delete) for IndexedDB; DB v1 → v2 upgrade keeps
  existing lessons.
- Store/session: create from roster, apply (with assignment preservation/removal),
  refresh, save to class, unlink, duplicate/empty names, dangling class.
- Apply to a lesson whose student IDs do not match the class: assignments are removed by
  design and the outcome reports the count; `classSize` changes while canvas node
  positions/sizes stay untouched.
- Serialization: round-trip a lesson with `classId`; old documents normalize to null.
- Playwright: a new `--flow classes` in the smoke driver — create a roster with tags and
  constraints, save as a class, open a second lesson, apply it, verify students and
  constraints, add a student, save to class, refresh another lesson, rename/delete from
  the manager.

## Phases

- **V1 (this scope):** class library, persistence + migration, classId, Roster panel
  apply/save/refresh/unlink, Classes dialog, assignment reconciliation, tests, driver.
- **V1.1:** class export/import backup, class chips on lesson cards, “New lesson from
  class”.
- **V2:** cross-device sync through PocketBase, including the classes collection.

## Risks

- **Drift is intentional.** A class edit does not update existing lessons until refresh;
  the UI must make that explicit.
- **Deleting a class** leaves dangling IDs by design; linked lessons keep usable
  snapshots and must explain the state.
- **Local-only data.** Classes live in one browser; export/backup is a follow-up.
- **Undo mismatch** is avoided by excluding class-link operations from lesson undo.
- **ID-only matching.** Applying a class to an existing lesson with different student IDs
  clears those seat assignments by design; the confirmation must name the count.
- **Class size** updates the lesson metadata only on apply and is left alone on refresh;
  existing furniture never moves.

## What is left to the builder

- Exact dialog copy and the class-row layout within the existing Roster panel.
- Whether the Classes manager is a modal or a small dedicated page; the design assumes a
  modal.
- The class empty/loading/error states.
- The driver flow structure and fixtures.
