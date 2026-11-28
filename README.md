# LeViz

A visual lesson planner: a lesson is an ordered flow of rich-text segments and
spatial classroom layouts, with rosters, station notes, and designed engagement
in one document.

Teach mode runs a lesson read-only with segment timers, the current text or
layout, station cards, and rotation guides for station rotation and gallery
walk. It is available from a lesson card, the editor, and the overview.

Print materials turns a layout segment into a paper pack: a teacher-facing
seating sheet with capacity and engagement, plus student-facing cards with
prompts and groups. Open it from the layout toolbar or the overview; the
browser print dialog handles paper and PDF.

**Live preview:** <https://feiran-z.github.io/LeViz/>

## Pilot notes

- This is a **preview build** for feedback and a small pilot, not a production
  service.
- **No accounts, no backend.** Lessons are stored in the browser's IndexedDB on
  the device you use. They do not sync across devices or browsers.
- **Back up with Export.** Clearing site data, using a private window, or switching
  browsers means the lessons are gone unless you exported them first. Import
  restores them.
- **Class rosters are local too.** A lesson export carries that lesson's roster
  snapshot but not the class library. Class library backup/export is a follow-up.
- **Teach mode does not edit lessons.** It opens a read-only run; timers and chimes
  are local to the tab.
- **Print materials is local too.** The seating sheet and cards use the lesson's
  saved roster; the browser print dialog sends nothing to a server.
- **Desktop and laptop first.** The editor is usable on a tablet; phone layout is
  out of scope.
- The site is public. Use fictional student names in any demo lessons.
- Search engines are asked not to index this preview (a `noindex` meta tag);
  the URL is still reachable by anyone who has it.
- **Feedback:** the in-app preview banner will link to a short form once it is
  ready. Until then, open an issue on this repository.
- The short commit id in the preview banner names the deployed build; include it
  in feedback.

## Development

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173/
npm test           # Vitest
npm run typecheck  # tsc -b --force
npm run build      # production build under /LeViz/
npm run preview    # serve the production build at http://localhost:4173/LeViz/
```

Routing uses `HashRouter` because GitHub Pages has no SPA rewrites; shared lesson
links look like `/#/lessons/<id>`.

The landing page preview gate is enabled by default and remembers acknowledgment
for the browser tab session. Set `VITE_PREVIEW_GATE=false` to build without it.

## Deployment

Pushing to `main` runs `.github/workflows/deploy-pages.yml`: it installs, tests,
builds `frontend/`, and deploys `frontend/dist` to GitHub Pages. The workflow can
also be run manually from the Actions tab.

Project documentation lives in `.claude/documentation/`.

## Structure

```
frontend/        Vite + React 19 + TypeScript SPA
  src/domain/    pure lesson/class/teach model, serialization, grouping, engagement
  src/stores/    Zustand state and class session use cases
  src/canvas/    Konva classroom canvas
  src/components/segments, panels, overview, classes, teach, engagement, pilot
.github/         Pages deployment workflow
docs/            deployment and planning notes
```

## License

The LeViz code is released under the [MIT License](LICENSE).

The bundled Inter and Merriweather fonts are licensed under the SIL Open Font
License 1.1; their copyright lines and the full license text are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The remaining npm dependencies
retain their own licenses, as recorded in `frontend/package-lock.json`.
