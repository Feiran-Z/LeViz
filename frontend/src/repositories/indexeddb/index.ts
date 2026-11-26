import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { totalMinutes } from '../../domain/lesson';
import type { Lesson, LessonSummary } from '../../domain/types';
import type { LessonRepository } from '../types';

interface LevizDB extends DBSchema {
  lessons: {
    key: string;
    value: Lesson;
    indexes: { 'by-updatedAt': string };
  };
}

const DB_VERSION = 1;

export function summarize(lesson: Lesson): LessonSummary {
  return {
    id: lesson.id,
    title: lesson.title,
    lessonDate: lesson.lessonDate,
    durationMin: lesson.durationMin,
    totalMinutes: totalMinutes(lesson.segments),
    segmentCount: lesson.segments.length,
    studentCount: lesson.roster.length,
    updatedAt: lesson.updatedAt,
  };
}

/** IndexedDB-backed repository. This is the only Phase 1 module that imports `idb`. */
export class IndexedDbLessonRepository implements LessonRepository {
  private readonly dbPromise: Promise<IDBPDatabase<LevizDB>>;

  constructor(dbName = 'leviz') {
    this.dbPromise = openDB<LevizDB>(dbName, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('lessons', { keyPath: 'id' });
        store.createIndex('by-updatedAt', 'updatedAt');
      },
    });
  }

  async listLessons(): Promise<LessonSummary[]> {
    const db = await this.dbPromise;
    const lessons = await db.getAll('lessons');
    return lessons
      .map(summarize)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getLesson(id: string): Promise<Lesson | null> {
    const db = await this.dbPromise;
    return (await db.get('lessons', id)) ?? null;
  }

  async saveLesson(lesson: Lesson): Promise<Lesson> {
    const db = await this.dbPromise;
    await db.put('lessons', structuredClone(lesson));
    return lesson;
  }

  async deleteLesson(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('lessons', id);
  }
}
