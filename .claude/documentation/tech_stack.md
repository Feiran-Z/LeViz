# Tech Stack: LeViz

> **Scope:** Tech stack choices only — frontend and backend. For product intent, architecture, or phase plans, see the companion documents.
> **Context:** Internal tool for one school (50–150 teachers), maintained by one person. Optimize for operational simplicity and canvas performance over scale.

---

## 1. At a Glance

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) |
| Frontend framework | React 19 |
| Build tool | Vite |
| Canvas | Konva.js + react-konva |
| State | Zustand + zundo |
| Styling | Tailwind CSS + headless primitives (Radix) |
| Rich text | TipTap (ProseMirror) |
| UI drag-and-drop | dndkit |
| Local persistence | IndexedDB via `idb` |
| Backend | PocketBase (single Go binary + embedded SQLite) |
| Backend SDK | `pocketbase` (official JS client) |

---

## 2. Frontend

### 2.1 Core

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict, `noUncheckedIndexedAccess`) | The lesson document schema is complex; typing prevents drift between stores, components, and repositories. |
| UI framework | **React 19** | Entire canvas ecosystem (Konva bindings, Zustand, dndkit, TipTap) is React-native. |
| Build tool | **Vite** | Static `dist/` output; no SSR, SEO, or server-secret requirement. Next.js would add a Node.js runtime for zero benefit. |
| Router | **react-router-dom** | Three routes only: lesson list, editor, login. |
| Package manager | **npm** | Two directories, not a workspace. |

### 2.2 Canvas

| Concern | Choice | Notes |
|---|---|---|
| Canvas library | **Konva.js** (`^10.9.0`) | Scene graph, per-node events, built-in `Transformer` for resize/rotate. |
| React binding | **react-konva** (`^19.3.1`) | Major version **must match React's major version**. |

Target **60 FPS with 250+ nodes**. Memoize node components; each node subscribes only to its own state slice.

*Rejected:* Fabric.js (SVG-centric, weaker React integration), tldraw (drawing model, not semantic nodes), raw DOM/SVG (poor drag performance).

### 2.3 State

| Concern | Choice | Notes |
|---|---|---|
| State container | **Zustand** (v5) | Lives outside React's render cycle — required for 60 Hz drag performance. |
| Undo/redo | **zundo** (`^2.3.0`) | Zustand middleware providing `undo`/`redo`/`clear` with no custom plumbing. |

**Store boundaries:**

| Store | Contents | Undo? |
|---|---|---|
| `lessonStore` | Lesson meta, segments, canvas nodes, node notes | Yes (limit 50) |
| `rosterStore` | Students, tags, constraints | Yes (limit 50) |
| `uiStore` | Active segment, selection, panel tab, zoom/pan | No |
| `authStore` | Auth record + token state | No |

Debounce canvas drags (~300 ms) so one drag = one undo step.

### 2.4 UI & Text

| Concern | Choice | Notes |
|---|---|---|
| Styling | **Tailwind CSS** | No CSS-in-JS. |
| UI primitives | **Radix UI primitives** (or hand-rolled) | Headless tabs, popovers, dialogs, dropdowns. |
| Rich text | **TipTap** (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`) | StarterKit + link only. Used **only** for text segments — never for node notes. |
| UI DnD | **dndkit** | Roster chips → canvas nodes; segment reordering. Never for movement inside the Konva canvas. |

### 2.5 Local Persistence

| Concern | Choice | Notes |
|---|---|---|
| Local store | **`idb`** (IndexedDB wrapper) | One object store `lessons`, keyed by `id`, indexed by `updatedAt`. |
| Abstraction | `LessonRepository` interface | UI and stores never import `idb` directly — this is what allows a PocketBase-backed repository to be swapped in without touching components. |

### 2.6 Version Pinning

| Dependency | Pin |
|---|---|
| `react-konva` | Exact version matching React minor |
| `konva` | `^10.9.0` |
| `zustand` | `^5` |
| `zundo` | `^2.3.0` |
| `@tiptap/*` | All packages on the **same minor** |

---

## 3. Backend

### 3.1 Platform

| Concern | Choice | Why |
|---|---|---|
| Backend | **PocketBase** (pin exact version, e.g. `0.40.1`) | One binary, embedded SQLite, built-in auth/API/file storage. Runs in <100 MB RAM idle. |
| Database | **SQLite** (managed by PocketBase) | No external DB process. |
| JS SDK | **`pocketbase`** (npm, `^0.28.0`) | Official client, aligned with the pinned server version. |

*Rejected:* Supabase (4 GB RAM, multi-container minimum — unjustified for 50–150 users), custom Express/Go server (re-implements auth, rules, storage, migrations), PostgreSQL/Prisma (document-shaped JSON data).

### 3.2 Collections

| Collection | Type | Key fields |
|---|---|---|
| `teachers` | auth | `email`, `password`; `displayName` (text); `role` (select: `teacher` \| `admin`) |
| `lessons` | base | `teacher` (relation → `teachers`, cascade delete); `title` (text); `lessonDate` (date); `durationMin` (number); `roster` (json); `segments` (json) |
| `assets` | base | `teacher` (relation); `name` (text); `file` (single image, max 2 MB) |

**`roster` and `segments` are JSON fields**, not normalized tables. The document is read/written as a whole; nodes are heterogeneous; queries are only "list mine" and "get one."

### 3.3 Authorization (API Rules)

| Operation | Rule |
|---|---|
| List / View | `teacher = @request.auth.id` |
| Create | `@request.auth.id != "" && @request.body.teacher = @request.auth.id` |
| Update / Delete | `teacher = @request.auth.id` |

`teachers` collection: `createRule = null` (admin-only; public signup disabled).

### 3.4 Schema Migrations

Every schema change is a **JS migration checked into `pb_migrations/`** — never an admin-UI-only edit. A fresh deployment must reproduce the schema from the repo alone. Verify the `Collection` constructor API against the pinned PocketBase version before writing.

### 3.5 Serving the Frontend

PocketBase serves the built SPA from `pb_public/` → **single-binary deployment**. Client-side routes resolve via PocketBase's `indexFallback` (on by default); no Nginx `try_files` or custom hook needed.

### 3.6 Environment

| Variable | Where | Purpose |
|---|---|---|
| `VITE_POCKETBASE_URL` | Frontend, **build time** | Backend URL. If unset, the app runs in IndexedDB-only mode. |

Vite inlines `VITE_*` at build time — changing the backend URL requires a rebuild.

### 3.7 Backups

All state lives in `pb_data/`. Back up via PocketBase's backup API (cron or hook) or by stopping the service and copying `pb_data/`. Retain 7 daily + 4 weekly; test a restore before first real use.

---

## 4. Deployment Shape

Browser ──HTTPS──► Caddy/Nginx ──► PocketBase (127.0.0.1:8090)
├── REST API + Auth
├── SQLite (pb_data/)
└── Static SPA (pb_public/)


- **Frontend build:** `npm run build` → copy `dist/*` into `backend/pb_public/`.
- **Backend run:** `./pocketbase serve --http=127.0.0.1:8090`.
- **TLS:** terminate with Caddy or Nginx; never expose PocketBase directly.
- **Hosting:** school server under `systemd`, or a $5–10/month VPS. Optional single Docker container if the school standardizes on Docker.

---

## 5. Hard Rules

1. All persistence goes through `LessonRepository`. UI → store → repository. Never UI → SDK.
2. All shared state lives in Zustand. Component state is only local UI ephemera.
3. `domain/` (types, grouping, templates) has **zero** imports from React, stores, or SDKs.
4. TipTap JSON lives only in `TextSegment.content`; node notes are plain text.
5. Undo/redo is store-level, never per-component.
6. All schema changes are migrations in git.
7. Pin PocketBase exactly; pin `react-konva` to the React minor.

---

*End of document.*