import type { Lesson, LessonSummary } from '../domain/types';

/**
 * The persistence contract. Every implementation (IndexedDB in Phase 1,
 * PocketBase in Phase 2) must pass the same shared contract test suite.
 */
export interface LessonRepository {
  listLessons(): Promise<LessonSummary[]>;
  getLesson(id: string): Promise<Lesson | null>;
  saveLesson(lesson: Lesson): Promise<Lesson>;
  deleteLesson(id: string): Promise<void>;
}
