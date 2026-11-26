import { IndexedDbLessonRepository } from './indexeddb';
import type { LessonRepository } from './types';

let repository: LessonRepository | null = null;

/**
 * The only module that knows which persistence implementation is active.
 * Phase 1 always resolves to IndexedDB; Phase 2 adds the PocketBase branch.
 */
export function getLessonRepository(): LessonRepository {
  if (repository) return repository;
  const pocketBaseUrl = import.meta.env['VITE_POCKETBASE_URL' as keyof ImportMetaEnv] as string | undefined;
  if (pocketBaseUrl) {
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
