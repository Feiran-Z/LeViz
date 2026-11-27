# License and Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MIT license, third-party font notices, and a quiet copyright/license footer to the lesson list and printed overview.

**Architecture:** Root legal files plus a notices file served from `frontend/public/`. One `AppFooter` component with a page variant (lesson list, pinned bottom) and a document variant (overview, printable). The existing Playwright lesson driver gains the UI checks.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind tokens, Playwright smoke driver.

**Spec:** `docs/superpowers/specs/2026-11-27-license-footer-design.md`

## Global Constraints

- Project license: **MIT**; copyright holder: **Feiran Zhang**; year **2026**.
- Footer on the lesson list and read-only overview only. Never in the editor.
- Footer copy: `© 2026 Feiran Zhang` · **MIT License** · **Third-party notices** · **Source**.
- The notices file must be reachable at `<base>/licenses/THIRD_PARTY_NOTICES.txt`.
- Font notices: Inter and Merriweather, SIL OFL 1.1, with their copyright lines and license text.

## Review Focus

- Empty lesson list: the footer sits at the bottom of the viewport, not floating mid-page.
- Project Pages base: the notices link resolves under `/LeViz/`, not `/`.
- Print: the overview footer is included when printed.
- Editor: no footer consumes canvas height.
- Copyright holder/year: no placeholder or wrong name.

---

### Task 1: Legal files, notices, and metadata

**Files:**
- Create: `LICENSE`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `frontend/public/licenses/THIRD_PARTY_NOTICES.txt`
- Modify: `frontend/package.json` (add `author`, `license`)
- Modify: `README.md` (add a License section)

**Interfaces:**
- Produces: the served notices path `licenses/THIRD_PARTY_NOTICES.txt` and the repo `LICENSE` URL used by the footer links.

- [ ] **Step 1: Add `LICENSE`**

Standard MIT text, beginning:

```
MIT License

Copyright (c) 2026 Feiran Zhang
```

- [ ] **Step 2: Add the notices files**

`THIRD_PARTY_NOTICES.md` and `frontend/public/licenses/THIRD_PARTY_NOTICES.txt`
both contain:

- Inter — `Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)` — SIL Open Font License 1.1.
- Merriweather — `Copyright 2024 The Merriweather Project Authors (https://github.com/EbenSorkin/Merriweather4) with Reserved Font Name "Merriweather".` — SIL Open Font License 1.1.
- The full SIL OFL 1.1 text, copied from `frontend/node_modules/@fontsource/inter/LICENSE` (the same license text covers both fonts).
- A note that the remaining npm dependencies retain their own licenses in `package-lock.json`.

- [ ] **Step 3: Add package metadata**

In `frontend/package.json`, add:

```json
"author": "Feiran Zhang",
"license": "MIT",
```

- [ ] **Step 4: Add the README License section**

A short section linking `LICENSE` and `THIRD_PARTY_NOTICES.md`, naming MIT and the font notices.

- [ ] **Step 5: Verify the files**

Run:

```bash
head -3 LICENSE
grep -c "SIL OPEN FONT LICENSE" THIRD_PARTY_NOTICES.md frontend/public/licenses/THIRD_PARTY_NOTICES.txt
node -e "const p=require('./frontend/package.json'); console.log(p.author, p.license)"
```

Expected: the MIT header and holder; a non-zero OFL count in both notices files; `Feiran Zhang MIT`.

- [ ] **Step 6: Commit**

```bash
git add LICENSE THIRD_PARTY_NOTICES.md frontend/public/licenses/THIRD_PARTY_NOTICES.txt frontend/package.json README.md
git commit -m "docs: add MIT license and third-party font notices"
```

---

### Task 2: Footer component and wiring

**Files:**
- Create: `frontend/src/components/layout/AppFooter.tsx`
- Modify: `frontend/src/pages/LessonListPage.tsx`
- Modify: `frontend/src/components/overview/LessonOverview.tsx`
- Test: `frontend/.claude/skills/run-leviz-frontend/driver.mjs`

**Interfaces:**
- Consumes: the served notices path from Task 1.
- Produces: `<AppFooter variant="page" | "document" />`; page variant is a `<footer>` pinned by `mt-auto`; document variant is a compact printable `<footer>`.

- [ ] **Step 1: Write the failing driver checks**

In `runLessonFlow`, after the initial screenshot on the lesson list, add:

```js
const footer = page.locator('footer').first();
const footerText = await footer.innerText();
check('footer shows copyright and MIT license',
  /© \d{4} Feiran Zhang/.test(footerText) && footerText.includes('MIT License'), footerText);
const noticesLink = page.getByRole('link', { name: 'Third-party notices' }).first();
const noticesHref = await noticesLink.getAttribute('href');
check('footer notices link is base-aware',
  Boolean(noticesHref && noticesHref.endsWith('/licenses/THIRD_PARTY_NOTICES.txt')), noticesHref ?? '');
const noticesResponse = await page.request.get(new URL(noticesHref ?? '', page.url()).toString());
check('footer notices link resolves', noticesResponse.status() === 200, String(noticesResponse.status()));
const footerBox = await footer.boundingBox();
check('footer is pinned to the bottom on an empty list',
  Boolean(footerBox && footerBox.y + footerBox.height >= 890), JSON.stringify(footerBox));
```

In the overview section, after the existing overview checks, add:

```js
const overviewFooter = page.locator('footer').first();
check('overview shows the footer', (await overviewFooter.innerText()).includes('MIT License'));
await page.emulateMedia({ media: 'print' });
check('print includes the footer', await overviewFooter.isVisible());
await page.emulateMedia({ media: 'screen' });
```

Before navigating to the editor from the list, or in the editor checks, add:

```js
check('editor has no footer', (await page.locator('footer').count()) === 0);
```

- [ ] **Step 2: Run the driver to verify the checks fail**

Start the dev server (`npm run dev`), then:

```bash
node .claude/skills/run-leviz-frontend/driver.mjs --flow lesson --url http://localhost:5173
```

Expected: failure at “footer shows copyright and MIT license” (no footer).

- [ ] **Step 3: Implement `AppFooter`**

`frontend/src/components/layout/AppFooter.tsx`:

```tsx
const LICENSE_URL = 'https://github.com/Feiran-Z/LeViz/blob/main/LICENSE';
const SOURCE_URL = 'https://github.com/Feiran-Z/LeViz';
const NOTICES_PATH = 'licenses/THIRD_PARTY_NOTICES.txt';

export function AppFooter({ variant = 'page' }: { variant?: 'page' | 'document' }) {
  const noticesUrl = `${import.meta.env.BASE_URL}${NOTICES_PATH}`;
  const year = new Date().getFullYear();
  const links = (
    <>
      <a href={LICENSE_URL} target="_blank" rel="noreferrer" className="hover:text-primary">MIT License</a>
      <a href={noticesUrl} target="_blank" rel="noreferrer" className="hover:text-primary">Third-party notices</a>
      <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="hover:text-primary">Source</a>
    </>
  );
  // document variant: compact <footer className="mt-8 border-t border-default pt-3 text-[11px] text-secondary"> with the same rows, wrapped in the overview column.
  // page variant: <footer className="mt-auto border-t border-default"> with an inner max-w-5xl px-5 py-4 row and text-[11px] text-secondary.
}
```

Both rows use `© {year} Feiran Zhang` on the left and `links` on the right,
with `flex flex-wrap items-center justify-between gap-x-4 gap-y-1`.

- [ ] **Step 4: Wire the footer**

- `LessonListPage`: root becomes `flex min-h-full flex-col bg-page`; main gains `w-full flex-1`; render `<AppFooter />` after `</main>` (before the confirm dialog).
- `LessonOverview`: render `<AppFooter variant="document" />` after the “Read-only overview” paragraph, inside the max-w-3xl document column.

- [ ] **Step 5: Run the driver to verify it passes**

```bash
node .claude/skills/run-leviz-frontend/driver.mjs --flow lesson --url http://localhost:5173
```

Expected: all checks pass, including the footer and print checks; zero console errors.

- [ ] **Step 6: Run the project gates**

```bash
cd frontend && npm test && npm run typecheck && npm run build
```

Expected: tests pass; typecheck and build clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/layout/AppFooter.tsx frontend/src/pages/LessonListPage.tsx frontend/src/components/overview/LessonOverview.tsx frontend/.claude/skills/run-leviz-frontend/driver.mjs
git commit -m "feat: add copyright and license footer"
```

---

## Self-Review

- Spec coverage: license, holder, notices, served notices, footer variants, list/overview placement, no editor footer, package metadata, README — all mapped.
- The notices link is checked against the base-aware href and fetched for 200.
- The print and editor cases each have a driver check.
- Type consistency: one `AppFooter` export with the same `variant` union used by both callers.
- Proportion: two tasks, matching the small design.
