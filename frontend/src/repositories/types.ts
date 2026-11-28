import type { ClassRoster, Lesson, LessonSummary } from '../domain/types';

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

/**
 * The reusable class roster library. A second aggregate beside lessons: classes
 * span lessons, while a lesson keeps its own roster snapshot.
 */
export interface ClassRosterRepository {
  listClasses(): Promise<ClassRoster[]>;
  getClass(id: string): Promise<ClassRoster | null>;
  saveClass(classRoster: ClassRoster): Promise<ClassRoster>;
  deleteClass(id: string): Promise<void>;
}

export interface WorkspaceContents {
  lessons: Lesson[];
  classes: ClassRoster[];
}

/**
 * Whole-workspace persistence for backup/restore. `saveAll` must be atomic so
 * a failed restore cannot leave half the lessons behind.
 */
export interface WorkspaceRepository {
  readAll(): Promise<WorkspaceContents>;
  saveAll(contents: WorkspaceContents): Promise<void>;
}
