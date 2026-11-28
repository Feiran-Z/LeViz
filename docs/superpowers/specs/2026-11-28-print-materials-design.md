# Printable Station and Role Cards — Design

## Intent and why

Teachers prepare the room and the roles from the screen, then need paper: one prompt
at each station, one role card at each position, and a compact seating sheet. Today the
overview prints the whole lesson, not a layout's materials.

Add a **Print materials** action on a layout segment that opens a read-only print preview:
a seating sheet first, then one card per station/role. The browser print dialog does the
printing; no PDF library and no backend.

## Goals

- Print a layout segment's materials without printing the app chrome or the whole lesson.
- A compact seating sheet: lesson/activity/segment header, instructions, layout thumbnail,
  activity engagement, and a table of seats with assigned students.
- One card per station/role: label, prompt, planned group, capacity, resolved station
  engagement, and a small lesson/segment footer.
- Entry from the layout segment toolbar and the lesson overview.
- Read-only: entering and leaving the print preview never writes the lesson.

## Non-goals

- Generating a PDF file or using a PDF library.
- Printing every layout segment at once; the overview's existing Print covers the lesson.
- Card density/paper-saving options, cut marks, or custom card sizes (V1.1).
- Student accounts, QR codes, or remote printing.
- Editing notes, groups, or shifts from the print preview.

## Anti-goals

- A print page that requires the editor chrome or a specific screen size.
- Cards for bare chairs/desks, the teacher, or empty gallery stops that add paper without
  a prompt.
- Clipped prompts or cards split across pages.
- Any write to the lesson or roster from the preview.

## Approaches considered

1. **Dedicated print route + browser print — chosen.**
   `/lessons/:lessonId/print/:segmentId` is a read-only preview with a Print button. The
   route can hide all chrome, control page breaks, and is shareable/bookmarkable.
2. **Print CSS on the editor/overview.** No new route, but the editor is a fixed-height
   app shell and its print rules would have to hide the whole three-column chrome; the
   overview prints the entire lesson. Rejected.
3. **Client-side PDF generation.** More control over page boxes, but adds a dependency,
   font embedding, and a new artifact to test; the browser print dialog is sufficient.
   Rejected for V1.

## Decisions

- **Route:** `/lessons/:lessonId/print/:segmentId`; loading uses
  `useLessonDocument(lessonId, { saveOnClose: false })`, like teach mode.
- **Pack order:** one seating sheet page, then one card per page. One card per page is
  the V1 call; it guarantees a full prompt and avoids page-splitting. Card density is
  V1.1.
- **Entry points:** a **Print materials** link in the layout segment toolbar and in the
  overview's layout section. The print preview has Back to editor and Print.
- **Seating sheet content:** lesson title, activity label, segment title/duration,
  activity engagement summary, activity instructions, read-only `LayoutThumbnail`, and a
  table of every assignable node (label, assigned names, capacity) in reading order.
- **Card nodes:**
  - station and round-table nodes always (a blank prompt card is useful);
  - any other node with a note (a chair/desk note can be a role card, e.g. Witness);
  - exclude the teacher and nodes with neither a station/table type nor a note.
  This keeps Harkness seating on the sheet rather than printing twenty empty cards.
- **Card content:** station/role label; note title/body (or a blank prompt area with a
  muted “No prompt yet” on screen, blank on paper); planned group names; capacity;
  resolved station engagement (node override or activity); footer with the lesson and
  segment title.
- **Engagement:** the sheet shows the activity-level design; each card shows the level
  that applies at that station.
- **Print styling:** `@page { size: letter; margin: 0.5in; }`; a `.print-page` per card
  with `break-after: page` (last page auto); no app chrome; white paper, dark text,
  visible card borders; no reliance on background color. Screen preview uses a calm
  page-like surface and a screen-only toolbar.
- **Empty cases:** a layout with no nodes still prints the sheet with “No furniture
  placed”; a layout with no eligible cards prints the sheet plus a note.
- **No new persistence.** The print page reads the lesson snapshot; students come from
  `lesson.roster`. No class library lookup.

## Testing

- Domain: card filtering (station/table always; annotated chair included; bare chairs,
  desks, teacher excluded), reading order, group names/unknown, engagement resolution
  (node override), seats table, empty segment.
- Driver `--flow print`: create a station-rotation layout with groups and a station
  note; open Print materials from the editor; verify the route, seating sheet, card
  content/group/engagement, Print button; emulate print media and verify the toolbar is
  hidden; stub `window.print` and verify it is called; open the overview's Print
  materials entry. Existing lesson/classes/teach flows stay green.
- No lesson write from entering/leaving the print route (same save-free close test
  already covers the mechanism).

## Phases

- **V1:** route, entries, seating sheet, one card per page, print CSS, tests, driver.
- **V1.1:** card density (2-up), choose cards vs sheet, include card cut marks, print all
  layout segments as a pack.
- **Phase 2:** if PocketBase lands, print still reads the local lesson; no server work.

## Risks

- **Page breaks:** one card per page is the safe default; long prompts should use a
  smaller font or a continuation area if they exceed a page. The builder must verify a
  long note does not clip.
- **Print colors:** the thumbnail uses theme tokens; print CSS must guarantee legible
  text/borders even with backgrounds disabled.
- **Data privacy:** printing contains names; the teacher prints locally. No upload.

## What is left to the builder

- Exact card typography, border/cut treatment, and footer copy.
- Print CSS values and page-break tuning.
- The size/spacing of the seating table and thumbnail.
- The `--flow print` fixtures and stub details.
