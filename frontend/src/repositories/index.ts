import { IndexedDbLessonRepository } from './indexeddb';
import { IndexedDbClassRosterRepository } from './indexeddb/classes';
import { IndexedDbWorkspaceRepository } from './indexeddb/workspace';
import type {
  ClassRosterRepository,
  LessonRepository,
  WorkspaceRepository,
} from './types';

let repository: LessonRepository | null = null;
let classRepository: ClassRosterRepository | null = null;
let workspaceRepository: WorkspaceRepository | null = null;

function pocketBaseUrl(): string | undefined {
  return import.meta.env['VITE_POCKETBASE_URL' as keyof ImportMetaEnv] as string | undefined;
}

/**
 * The only module that knows which persistence implementation is active.
 * Phase 1 always resolves to IndexedDB; Phase 2 adds the PocketBase branch.
 */
export function getLessonRepository(): LessonRepository {
  if (repository) return repository;
  if (pocketBaseUrl()) {
    // Phase 2 will construct PocketBaseLessonRepository here. Until then the
    // app stays fully usable rather than failing to start.
    console.warn('[LeViz] VITE_POCKETBASE_URL is set, but PocketBase persistence ships in Phase 2. Using IndexedDB.');
  }
  repository = new IndexedDbLessonRepository();
  return repository;
}

/** Test seam only. */
export function setLessonRepository(next: LessonRepository | null): void {
  repository = next;
}

/** The class roster library. Phase 2 adds a PocketBase implementation. */
export function getClassRosterRepository(): ClassRosterRepository {
  if (classRepository) return classRepository;
  if (pocketBaseUrl()) {
    console.warn('[LeViz] VITE_POCKETBASE_URL is set, but PocketBase persistence ships in Phase 2. Using IndexedDB for classes.');
  }
  classRepository = new IndexedDbClassRosterRepository();
  return classRepository;
}

/** Test seam only. */
export function setClassRosterRepository(next: ClassRosterRepository | null): void {
  classRepository = next;
}

/** Whole-workspace backup/restore; Phase 2 adds a PocketBase implementation. */
export function getWorkspaceRepository(): WorkspaceRepository {
  if (workspaceRepository) return workspaceRepository;
  if (pocketBaseUrl()) {
    console.warn('[LeViz] VITE_POCKETBASE_URL is set, but PocketBase persistence ships in Phase 2. Using IndexedDB for the workspace.');
  }
  workspaceRepository = new IndexedDbWorkspaceRepository();
  return workspaceRepository;
}

/** Test seam only. */
export function setWorkspaceRepository(next: WorkspaceRepository | null): void {
  workspaceRepository = next;
}
