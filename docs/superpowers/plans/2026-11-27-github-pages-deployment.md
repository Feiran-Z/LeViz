# GitHub Pages Preview Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the LeViz frontend at `https://feiran-z.github.io/LeViz/` from `main` with working deep links and a repeatable deploy, ready for preview, feedback, and a small pilot.

**Architecture:** GitHub Actions builds `frontend/` and deploys `frontend/dist` as a Pages artifact. Vite builds against base `/LeViz/`; React Router switches to `HashRouter` so refreshes and shared lesson links work without a server rewrite. Lessons stay browser-local in IndexedDB; there is no backend.

**Tech Stack:** Vite 8, React 19, React Router 7, TypeScript, GitHub Actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`), GitHub Pages.

**Spec:** Deployment request in this conversation; no separate design document.

## Current State (verified 2026-11-27)

- Repository is **public**: `https://github.com/Feiran-Z/LeViz`.
- Pages is already enabled, but with `build_type: "legacy"`, source `main` / `/`.
  The live URL returns **404** because the repo root has no `index.html`.
- The app lives in `frontend/`; `frontend/dist` is gitignored; there are no workflows.
- `vite.config.ts` uses the default base `/`; `index.html` points at `/favicon.svg`;
  `main.tsx` uses `BrowserRouter`.
- The app has no backend: lessons live in the browser's IndexedDB, and export/import
  is the backup path.
- Local dev assumes `http://localhost:5173/`; CI will use Node 22 LTS.

## Decision: HashRouter for the pilot

GitHub Pages has no SPA rewrites. Hash routing makes refreshes and shared lesson
links work with zero fallback files. The cost is `#` in URLs
(`https://feiran-z.github.io/LeViz/#/lessons/...`).

**Alternative if clean URLs matter:** keep `BrowserRouter`, set
`basename={import.meta.env.BASE_URL.replace(/\/$/, '')}`, and copy
`dist/index.html` to `dist/404.html` in the workflow. This works but deep links
initially return HTTP 404 and depend on the fallback file. Not chosen for the pilot.

## Global Constraints

- The site and repository are public; Pages has no access control. Do not design
  around private links.
- No backend, no accounts, no analytics. All lesson data stays in the user's browser.
- Base path is `/LeViz/`; dev stays at `/`.
- Tests must pass before every deploy. `frontend/dist` is never committed.
- CI runs Node 22; the project has no native dependencies.

---

### Task 1: Make the build Pages-aware and route with hashes

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/index.html`

**Interfaces:**
- Produces: a production build whose assets resolve under `/LeViz/`, and hash-based
  URLs (`#/lessons/:lessonId`) that survive a page refresh.

- [ ] **Step 1: Set the production base in `frontend/vite.config.ts`**

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/LeViz/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
```

- [ ] **Step 2: Switch `frontend/src/main.tsx` to `HashRouter`**

Import `HashRouter` from `react-router-dom` instead of `BrowserRouter` and wrap
`<App />` in it. No basename is needed.

- [ ] **Step 3: Make the favicon base-aware in `frontend/index.html`**

Change `href="/favicon.svg"` to `href="%BASE_URL%favicon.svg"`.

- [ ] **Step 4: Verify the build output**

Run: `cd frontend && npm test && npm run build`
Expected: 93 tests pass; build succeeds.

Run: `grep -o '/LeViz/assets/[^"]*' dist/index.html | head -3`
Expected: `/LeViz/assets/...` paths (not `/assets/...`).

Run: `grep -o 'href="[^"]*favicon.svg"' dist/index.html`
Expected: `href="/LeViz/favicon.svg"`.

- [ ] **Step 5: Preview the production build locally**

Run: `cd frontend && npx vite preview`
Open the printed URL (it ends in `/LeViz/`), create a lesson, reload, and open a
lesson link directly. Expected: the list and editor both work after reload.

- [ ] **Step 6: Commit**

```bash
git add frontend/vite.config.ts frontend/src/main.tsx frontend/index.html
git commit -m "build: target GitHub Pages base and hash routing"
```

---

### Task 2: Add the GitHub Actions Pages workflow

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Add the workflow**

```yaml
name: Deploy frontend to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`working-directory: frontend` applies to `run` steps; the artifact path is
relative to the repository root, so it stays `frontend/dist`.

- [ ] **Step 2: Commit (do not push yet)**

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "ci: deploy the frontend to GitHub Pages"
```

---

### Task 3: Switch Pages to Actions and make the first deploy

Pages must accept workflow deployments **before** the first push, otherwise the
deploy job fails.

- [ ] **Step 1: Switch the Pages source**

Run:
```bash
gh api -X PUT repos/Feiran-Z/LeViz/pages -f build_type=workflow
gh api repos/Feiran-Z/LeViz/pages --jq '.build_type, .html_url'
```
Expected: `workflow` and `https://feiran-z.github.io/LeViz/`.

Alternative: repository **Settings → Pages → Build and deployment → Source:
GitHub Actions**.

- [ ] **Step 2: Push `main` and watch the workflow**

```bash
git push origin main
gh run list --workflow deploy-pages.yml --limit 1
gh run watch <run-id> --exit-status
```
Expected: the `build` and `deploy` jobs both succeed.

- [ ] **Step 3: Verify the live site**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://feiran-z.github.io/LeViz/
```
Expected: `200` (allow a minute after deploy).

In a browser at `https://feiran-z.github.io/LeViz/`:
- the lesson list loads and fonts/favicon load;
- create a lesson, edit it, reload — it persists;
- copy a lesson URL (contains `#/lessons/...`) and open it in a new tab;
- toggle dark mode; export and re-import a lesson.

- [ ] **Step 4: Point the repo at the live site**

```bash
gh repo edit Feiran-Z/LeViz \
  --homepage https://feiran-z.github.io/LeViz/ \
  --description "LeViz — visual lesson planner (preview build)"
```

- [ ] **Step 5: Commit any remaining changes**

The workflow change is already committed; this step only records the live URL if
a root README is added later.

---

### Task 4: Pilot readiness (recommended before sharing)

- [ ] **Step 1: Create a feedback channel**

Create a short external form (Google Form, Typeform, or similar) with: what they
tried, what worked, what broke, device/browser, and one change they want. Do not
use GitHub Issues as the only channel — pilot teachers may not have accounts.

- [ ] **Step 2: Add a pilot notice and feedback link**

Create `frontend/src/lib/pilot.ts` with:

```ts
export const PILOT_FEEDBACK_URL = '<paste the form URL>';
export const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? 'dev';
```

Render a small, dismissible banner on the lesson list (not the editor) with:
"Preview build — lessons are saved only in this browser. Export to back up."
plus a **Share feedback** link. Show the short `BUILD_ID` in the banner so reports
can name the build. Keep it out of print and out of the editor chrome.

- [ ] **Step 3: Inject the build id in CI**

Add to the workflow build step:

```yaml
      - run: npm run build
        env:
          VITE_BUILD_ID: ${{ github.sha }}
```

Type the env var in `frontend/src/vite-env.d.ts` (create it if absent):

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_BUILD_ID?: string;
}
```

- [ ] **Step 4: Add a root README and a pilot note**

Create `README.md` with: what LeViz is, the live URL, the local-data/export
caveat, supported browsers (desktop/laptop first; tablet usable; phone out of
scope), and the feedback link. Optionally create `PILOT.md` with the same
one-page brief.

- [ ] **Step 5: Decide on indexing**

For an unlisted pilot, add `frontend/public/robots.txt`:

```
User-agent: *
Disallow: /
```

This only asks crawlers to stay out; it is not access control.

- [ ] **Step 6: Verify and deploy**

Run `cd frontend && npm test && npm run build`; commit; push. Confirm the new
banner and feedback link on the deployed site.

---

### Task 5: Verification and rollback

- [ ] **Checklist**

| Check | Expected |
|---|---|
| `https://feiran-z.github.io/LeViz/` | 200 and the lesson list |
| Refresh a lesson URL with `#/lessons/...` | Editor reopens |
| Create, edit, reload | Lesson persists |
| Export → delete → import | Lesson restored |
| Dark mode | Chart and panels switch themes |
| Browser console | No errors |
| Tablet width (e.g. 900px) | Shell usable; canvas pans |
| Actions run | Green on `main` |

- [ ] **Rollback**

Revert the failing commit and push: `git revert <sha> && git push`. The workflow
redeploys `main`. The Pages deployment history is visible under **Actions** and
**Settings → Pages**.

---

## Risks and Non-Goals

- **Public by design.** Pages cannot password-protect a site. If access control is
  required, use Netlify/Vercel password protection or Cloudflare Access instead.
- **Local-only data.** Each browser has its own IndexedDB. Clearing site data
  deletes lessons; export is the backup. No cross-device sync or accounts.
- **No custom headers.** GitHub Pages does not let us set cache or security headers;
  hashed Vite assets are safe, and the app needs no COOP/COEP.
- **Hash URLs.** The pilot link shape includes `#`. Clean URLs need the 404 fallback
  alternative above.
- **Repo rename.** If the repo name changes, update the Vite base `/LeViz/`.
- **Root hygiene (optional).** A root `.DS_Store` is tracked because only
  `frontend/.gitignore` exists. Remove it (`git rm --cached .DS_Store`) and add a
  root `.gitignore` with `.DS_Store`.

## Open Decisions

1. **Routing:** HashRouter (recommended) or clean URLs with a 404 fallback?
2. **Feedback channel:** which form URL should the banner link to?
3. **Pilot notice:** add the banner/version now, or deploy first and add it after a
   smoke test?
4. **Public site:** confirm the pilot can be public and that demo rosters use
   fictional names, not real student data.
