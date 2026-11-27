# LeViz Enhancement Suggestions

**Date:** 2026-11-27
**Status:** Proposed
**Context:** Based on the current planner — timed text/layout segments, designed
engagement, annotated spatial layouts, grouping/rosters, and browser-local data.
Ordered by teacher pain.

## 1. Reusable class rosters (with constraints)

**Teacher pain:** Every lesson carries its own roster, so a teacher with four
sections re-enters the same names, tags, and "keep apart / together" rules for
every lesson.

**Change:** Add a small class-roster library — class name, students, tags,
constraints — and let a lesson pick one. Snapshot the roster into the lesson at
creation so old plans stay intact, or let the teacher refresh from the class.

**Why it matters:** Removes the most repetitive setup step and is the foundation
for teach mode, print cards, and cross-device sync.

**Effort:** Medium.

## 2. Teach mode with timers

**Teacher pain:** LeViz is excellent before class and silent during it. The
teacher still needs a separate timer for segments and station rotations.

**Change:** A read-only "Teach" view that shows the current segment, a countdown,
next/previous controls, the active layout, station prompts, assigned students,
and a station-rotation timer.

**Why it matters:** Closes the loop from planning to running the lesson and uses
data already in the document.

**Effort:** Medium.

## 3. Printable station and role cards

**Teacher pain:** Station prompts, roles, and groups live on screen, but
classroom setup needs paper: one prompt per station, one role card per position,
a compact seating sheet.

**Change:** A "Print materials" action on a layout segment that generates a card
per station/node with its note, capacity, assigned students, and engagement
design, plus a seating overview.

**Why it matters:** High value for station rotation, mock trial, debate, and
gallery walks; it turns annotations into physical classroom materials.

**Effort:** Low-medium.

## 4. Duplicate lessons and "new from this lesson"

**Teacher pain:** Teachers repeat the same lesson across sections or reuse a
strong activity next term; today they export/import or rebuild it.

**Change:** Duplicate from the lesson list or editor, and "New lesson from this
one" that copies the flow, layouts, notes, and optional roster while resetting
dates and assignments.

**Why it matters:** Planning multiple sections becomes one action instead of a
rebuild.

**Effort:** Low.

## 5. "Ready to teach" pre-flight check

**Teacher pain:** Problems surface in class: the plan runs long, a student is
unassigned, a station is over capacity, or a station has no prompt.

**Change:** A compact readiness panel on the overview and lesson list: time
over/under the period, unassigned students, capacity vs. group sizes, layout
segments with no students or no station notes, and missing activity
instructions.

**Why it matters:** Everything needed is already computed in the document;
surfacing it gives the teacher confidence before the bell.

**Effort:** Low.

## Structural caveat

These are all local-first features. The biggest gap not on the list is
**cross-device access**: a teacher cannot open the plan on the classroom
computer without export/import. That is the Phase 2 PocketBase work, and it is
worth doing if the pilot moves beyond a single browser.

## Recommended sequence

Start with **reusable class rosters**, then **teach mode**. They compound, and
both make the other three cheaper.
