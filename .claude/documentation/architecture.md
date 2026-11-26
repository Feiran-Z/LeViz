# Architecture: LeViz

> **Scope:** System structure — components, layers, boundaries, data flow, and deployment topology.
> **Companion documents:** Product intent (`PROJECT_OVERVIEW.md`), tech stack choices (`TECH_STACK.md`), implementation sequencing (`IMPLEMENTATION_PLAN.md`).
> **Authority:** This document is authoritative on structure. If implementation diverges from it, update this file or fix the implementation.

---

## 1. Architectural Style

The system is a **layered client-side application with a document-shaped persistence boundary**. There is no server-side business logic. The frontend owns all domain logic, all editing state, and all validation. The backend is a persistence and identity service only.

Three properties follow from this and drive every other decision:

1. **The browser is the application.** Grouping algorithms, undo/redo, serialization, and constraint validation all run client-side. The network is only consulted to save and load whole lesson documents.
2. **The lesson is a single aggregate.** A `Lesson` — with its meta, roster, and ordered segments — is read and written as one unit. There are no partial-update endpoints, no field-level PATCH calls, no server-side merging.
3. **Persistence is an interface, not a location.** The app runs identically against IndexedDB (Phase 1) and PocketBase (Phase 2). Only one module knows which is active.

---

## 2. System Context

┌───────────────────────────┐
│ Teacher (browser)         │
│ Desktop / laptop /        │
│ tablet                    │
└─────────────┬─────────────┘
│ HTTPS
┌─────────────▼─────────────┐
│ Reverse proxy (Caddy/     │
│ Nginx): TLS termination   │
└─────────────┬─────────────┘
│ HTTP (loopback)
┌─────────────▼─────────────┐
│ PocketBase                │
│ ┌─────────────────────┐   │
│ │ REST API + Auth     │   │
│ │ File storage        │   │
│ │ Static SPA serving  │   │
│ │ SQLite (pb_data/)   │   │
│ └─────────────────────┘   │
└───────────────────────────┘


**Trust boundaries:**
- The browser is untrusted. PocketBase API rules enforce per-teacher isolation; the client never sees another teacher's data.
- PocketBase is never exposed directly. It binds to loopback and sits behind a TLS-terminating proxy.
- There are no other external dependencies at runtime. No CDN, no third-party API, no analytics.

---

## 3. Layer Model

The frontend is organized into four horizontal layers with a strict one-directional dependency rule.

┌──────────────────────────────────────────────────────────────┐
│ L4 — Presentation                                            │
│ React components: canvas, segments, panels, UI primitives    │
└───────────────────────────────┬──────────────────────────────┘
│ reads/writes via hooks
┌───────────────────────────────▼──────────────────────────────┐
│ L3 — Application State                                       │
│ Zustand stores: lessonStore, rosterStore, uiStore, authStore │
└───────────────────────────────┬──────────────────────────────┘
│ calls
┌───────────────────────────────▼──────────────────────────────┐
│ L2 — Persistence                                             │
│ LessonRepository implementations: IndexedDB | PocketBase     │
└───────────────────────────────┬──────────────────────────────┘
│ serializes/deserializes
┌───────────────────────────────▼──────────────────────────────┐
│ L1 — Domain                                                  │
│ Pure types + logic: Lesson, Segment, CanvasNode, grouping    │
└──────────────────────────────────────────────────────────────┘


**Dependency rules (enforced by code review and lint):**

| Rule | Rationale |
|---|---|
| L1 imports nothing above it. No React, no Zustand, no SDKs, no `idb`. | Keeps domain logic unit-testable and portable. |
| L2 may import L1. L2 is the **only** layer that imports `idb` or `pocketbase`. | Confines backend-specific code to one directory. |
| L3 may import L1 and L2. L3 owns in-memory state and calls repositories. | Single place where mutations and persistence meet. |
| L4 may import L3 (via hooks) and L1 (types only). L4 **never** imports L2. | Prevents components from bypassing state and persistence abstractions. |
| L1 never imports L2–L4. | No cycles. |

A violation of these rules is a structural defect, not a style preference. If a component needs persistence, it goes through a store. If a store needs a computation, it calls a domain function.

---

## 4. Layer Detail

### 4.1 L1 — Domain (`src/domain/`)

Pure TypeScript. The canonical data model and the algorithms that operate on it.

| Module | Responsibility |
|---|---|
| `types.ts` | `Lesson`, `LessonMeta`, `Student`, `Segment` union, `CanvasState`, `CanvasNode`, `NodeNote`, `ActivityType`. The single source of truth for the document shape. |
| `grouping.ts` | `generateGroups` (random, constraint-aware) and `validateAssignment`. Deterministic, side-effect free, fully unit-tested. |
| `templates/` | Static JSON templates for the seven activity types. Applying a template is a pure merge function. |
| `serialize.ts` | Lossless round-trip helpers. Guarantees `parse(stringify(lesson))` equals the original. |

The domain layer knows nothing about where a lesson is stored, how it is displayed, or what framework renders it.

### 4.2 L2 — Persistence (`src/repositories/`)

Defines the contract and provides interchangeable implementations.

```typescript
// repositories/types.ts
interface LessonRepository {
  listLessons(): Promise<LessonSummary[]>;
  getLesson(id: string): Promise<Lesson | null>;
  saveLesson(lesson: Lesson): Promise<Lesson>;
  deleteLesson(id: string): Promise<void>;
}
```

| Module | Responsibility |
|---|---|
| `indexeddb/` | | Phase 1 implementation. One object store keyed by lesson id, indexed by updatedAt. |
| `pocketbase/` | Phase 2 implementation. Maps Lesson ↔ PocketBase record (created/updated → createdAt/updatedAt). |
| `index.ts` | Factory. Selects the implementation based on `VITE_POCKETBASE_URL`. Nothing else in the app branches on backend choice. |

**Parity requirement**: both implementations must pass the same test suite. The interface is the contract; a repository that cannot satisfy it is not a valid implementation.

### 4.3 L3 — Application State (src/stores/)

Four Zustand stores with explicit, non-overlapping responsibilities.

| Store | Owns | Undo history | Persisted? |
|---|---|---|---|
| `lessonStore` | The active `Lesson` document: meta, segments, canvas nodes, node notes | Yes (zundo, limit 50) | On debounced save |
| `rosterStore` | Students, tags, constraints | Yes (zundo, limit 50) | As part of `Lesson.roster` |
| `uiStore` | Active segment id, selected node id, active panel tab, canvas zoom/pan | No | No |
| `authStore` | Auth record and session state | No | Session token only |

**State ownership rules**:
- A piece of state has exactly one owning store. No duplication across stores.
- Cross-store reads are allowed; cross-store writes are not. A store may read `rosterStore` students to validate an assignment, but only `rosterStore` mutates the roster.
- Derived values (e.g., the time budget total) are computed via selectors, never stored.
- `uiStore` never enters undo history. Undoing a layout change must not revert which panel was open.

**Mutation flow**: every state change originates from a store action. Actions mutate state, then trigger persistence through the repository. Components dispatch actions; they never mutate store state directly.

### 4.4 L4 — Presentation (src/components/)
| Directory |	Responsibility |
|---|---|
| `canvas/` | Konva stage, node rendering, palette, transformer, snap guides. Subscribes to lessonStore node slices. |
| `segments/` | Segment editors. Text segments use TipTap; layout segments host the canvas. |
| `panels/` | Left outline, right roster/inspector/groups panels. |
| `ui/` | Framework-agnostic primitives (tabs, popover, dialog). No domain knowledge. |

**Component rules**:
- Components read from stores via selectors and dispatch actions. No component calls a repository.
- A Konva node component subscribes only to its own node's slice, not to the whole canvas. This is what preserves 60 FPS at scale.
- `ui/` has zero imports from `domain/`. It is generic.

## 5. Data Flow

### 5.1 Read Path (loading a lesson)
Router (/lessons/:id)
  → lessonStore.load(id)
    → LessonRepository.getLesson(id)
      → [IndexedDB | PocketBase]
    ← Lesson (domain type)
  → lessonStore populated → zundo history reset
→ Components subscribe to slices → render

### 5.2 Write Path (editing)
User interaction (drag a node, type text, assign a student)
  → Component dispatches store action
    → Store mutates state (zundo records undo entry, debounced)
      → Debounced persistence trigger (~1 s idle)
        → LessonRepository.saveLesson(lesson)
          → [IndexedDB | PocketBase]

The store is the single source of truth in memory. Persistence is a downstream effect, never a prerequisite for a UI update. A slow or failed save must never block editing.

### 5.3 Grouping Flow
Groups panel: "Generate"
  → reads students from rosterStore, group count from canvas nodes
    → domain/generateGroups(pure function)
  ← GroupingResult { groups, score, violations }
→ User reviews, clicks "Apply"
  → lessonStore action writes assignedStudentIds onto nodes
→ Violations surfaced as warnings; never blocking

## 6. Canvas Architecture
The canvas is the highest-complexity subsystem and has its own internal structure.

Konva Stage (fixed logical size, scaled to fit)
├── Layer: background (optional floor-plan image)
├── Layer: nodes
│   └── LayoutNode × N
│       ├── Shape (rect/circle per node type)
│       ├── Label (text)
│       ├── StudentChips (assigned students)
│       └── SelectionTransformer (only when selected)
└── Layer: overlay (snap guides, drop-target highlights)

**Design decisions**:
- Nodes are semantic, not shapes. A station node is a domain object with capacity, note, and assignedStudentIds. Rendering is derived from the domain type, not the reverse.
- Selection is a UI concern. The selected node id lives in uiStore, not in the document.
- Snapping is a pure function. Given a dragged node's position and the positions of all other nodes, the snap calculator returns an adjusted position. It has no Konva dependency and is unit-testable.
- Drag commits once. During a drag, geometry is updated in a transient UI path; on drag end, one store action commits the final position and one undo entry is recorded.
- Drop targets are hit-tested, not event-bubbled. When a student chip is dragged from the roster panel via dndkit, the drop handler converts screen coordinates to canvas coordinates and resolves the target node.

**Performance invariants**:
- A node component re-renders only when its own node object changes.
- The canvas never re-renders because uiStore selection changed for an unrelated node.
- 60 FPS target at 250+ nodes.

## 7. Backend Architecture
PocketBase provides four capabilities and no business logic.

| Capability | Provided by | Used for |
|---|---|---|
| Identity | `teachers` auth collection | Login, session, per-teacher scoping |
| Persistence | `lessons` collection | Whole lesson documents as JSON fields |
| File storage | `assets` collection | Optional floor-plan background images |
| Static hosting | `pb_public/` | Serving the built SPA |

**Record shape**: `roster` and `segments` are JSON columns. The backend never inspects their structure. This is deliberate — the document schema evolves in the frontend and the backend remains agnostic.

**Authorization**: enforced entirely by PocketBase API rules (`teacher = @request.auth.id`). The client cannot widen its own access. Public signup is disabled; accounts are admin-provisioned.

**Schema management**: migrations are JS files in `pb_migrations/`, checked into git. A fresh deployment reproduces the schema from the repository alone. Admin-UI schema edits are prohibited because they create drift between environments.

**The backend has no knowledge of**:
- Segment types or activity types
- Canvas nodes or geometry
- Grouping rules or constraints
- Undo history

If any of these ever need server-side processing, that is a signal that the architecture is being violated, not that the backend needs more logic.

## 8. Persistence Strategy and Phase Transition

The repository interface exists specifically so the backend can be introduced without touching L1, L3, or L4.

| Phase | Repository | Where data lives | Consequence |
|---|---|---|---|
| 1 | IndexedDB | Browser, per-device | No accounts, no cross-device access, local-only |
| 2 | PocketBase | Server, per-teacher | Accounts, cross-device access, backups |

**Transition mechanism**:
1. `repositories/index.ts` checks `VITE_POCKETBASE_URL`.
2. On first successful login in Phase 2, a migration routine reads all local lessons, pushes any not yet migrated, and records the mapping.
3. Local copies are retained until a successful round-trip fetch confirms the server copy. Deletion is never automatic.
4. fter migration, the IndexedDB repository remains available as a fallback but is not the default.

**Why this works**: the stores and components were written against the interface, not the implementation. No store action, no component, and no domain function changes between phases.

## 9. Deployment Topology

Two supported shapes, identical at the application level.

### 9.1 Single binary on a school server or VPS (primary)

Internet/LAN
  │
  ▼
Caddy or Nginx  (TLS termination, :443)
  │  proxy_pass → 127.0.0.1:8090
  ▼
PocketBase process (systemd)
  ├── serves SPA from pb_public/
  ├── serves REST API
  └── owns pb_data/ (SQLite + uploaded files)

- One process, one data directory, one backup target.
- `pb_data/` is the entire system state. Backing it up backs up everything.
- Upgrades: stop service, replace binary, run pending migrations on start, restart.

### 9.2 Optional single container

Same topology with PocketBase packaged in an `alpine` image and `pb_data` mounted as a volume. No orchestration, no sidecars. Chosen only if the school standardizes on Docker.

**Explicitly not supported**: multi-instance horizontal scaling, read replicas, external object storage, a separate database server. None are needed at this scale, and each would undermine the single-binary operational model.

## 10. Architectural Invariants

These must hold at all times. A change that violates one requires an explicit architecture revision, not a workaround.

1. The frontend builds to static files with no server-side rendering or runtime Node dependency.
2. All persistence passes through `LessonRepository`. No component or store imports `idb` or `pocketbase`.
3. `domain/` has no imports from any other layer or external SDK.
4. A lesson is saved and loaded as a complete document. No partial-field updates.
5. Shared state lives in exactly one Zustand store per concern. No duplicated state.
6. `uiStore` state never enters undo history.
7. TipTap JSON exists only in `TextSegment.content`. Node notes are plain text.
8. The document serializes losslessly: `parse(stringify(lesson))` equals `lesson`.
9. Authorization is enforced by PocketBase API rules, never by client-side checks alone.
10. PocketBase schema changes exist only as migrations in git.
11. The backend contains no domain logic and never inspects `segments` or `roster` structure.
12. Every repository implementation passes the same shared contract test suite.

## 11. Known Trade-offs


| Decision | Benefit | Cost | Accepted? |
|---|---|---|---|
| Whole-document persistence | Simple, transactional saves; no merge logic| Large payloads as lessons grow | Yes — typical lessons are well under 1 MB |
|J SON columns instead of normalized tables | Schema evolves freely in the frontend | No server-side querying of nodes or students | Yes — no such query is needed |
|Client-side domain logic | Fast, offline-capable, easy to test | Domain rules cannot be enforced authoritatively server-side | Yes — a single trusted teacher per lesson |
| Single binary, no horizontal scaling | Trivial operations and backups | Not suitable beyond a few hundred users | Yes — scope is 50–150 teachers |
| Two persistence backends | Phase 1 ships without backend work | One extra implementation to maintain | Yes — the shared test suite bounds the cost |
| No real-time collaboration | Vastly simpler state model | Two teachers cannot co-edit | Yes — export/import covers sharing |

*End of document. Structural changes must be reflected here before or alongside the code.*