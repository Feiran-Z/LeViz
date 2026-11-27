# License and Footer — Design

## Intent

The public pilot currently shows no copyright or license information, and the repo has
no `LICENSE`. Add a real MIT license for the code, credit the bundled fonts under
their SIL OFL 1.1 terms, and surface the essentials in a quiet footer on the public
pages and the printed lesson overview.

## Decisions already made

- **Project license:** MIT.
- **Copyright holder:** Feiran Zhang, 2026.
- **Footer placement:** lesson list and read-only overview/print. **Not** the editor,
  where vertical space belongs to the canvas.

## Approach

1. **`LICENSE`** at the repo root: standard MIT text, `Copyright (c) 2026 Feiran Zhang`.
2. **`THIRD_PARTY_NOTICES.md`** at the repo root:
   - Inter and Merriweather are bundled and licensed under SIL OFL 1.1; include their
     copyright lines and the OFL 1.1 text.
   - Note that npm dependencies retain their own licenses (see `package-lock.json`).
3. **`frontend/public/licenses/THIRD_PARTY_NOTICES.txt`**: the same notices, served
   with the deployed site so the license text travels with the font files. The footer
   links to it via `import.meta.env.BASE_URL`.
4. **`frontend/src/components/layout/AppFooter.tsx`**:
   - `variant="page"`: bordered footer below the lesson list, pinned to the bottom on
     short pages.
   - `variant="document"`: compact version inside the overview's document column; it
     prints.
   - Content: `© 2026 Feiran Zhang` · **MIT License** (repo `LICENSE`) ·
     **Third-party notices** (served file) · **Source** (GitHub repo).
5. **Wiring:** add the footer to `LessonListPage` and `LessonOverview`; make the list
   page a full-height flex column so the footer sits at the bottom when content is
   short.
6. **Metadata/docs:** set `"license": "MIT"` and `"author": "Feiran Zhang"` in
   `frontend/package.json`; add a License section to `README.md`.

## Non-goals

- No per-segment or editor footer.
- No full dependency-license audit; the notices cover the bundled fonts and point to
  `package-lock.json` for the rest.
- No new route or settings page for licenses.

## Verification

- `npm run build` emits the footer and the served notices file.
- Playwright: footer visible on the lesson list and overview, links resolve (repo
  `LICENSE`, served notices, source), year/holder correct, no console errors.
- Print check: the overview footer is included in the printed page; the editor has no
  footer.
- Existing test suite, typecheck, and build stay green.
