import { totalMinutes } from '../../domain/lesson';
import type { Lesson, LessonSummary } from '../../domain/types';
import type { LessonRepository } from '../types';
import { openLevizDb } from './db';

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

/** IndexedDB-backed lesson repository; the schema lives in `db.ts`. */
export class IndexedDbLessonRepository implements LessonRepository {
  private readonly dbPromise: ReturnType<typeof openLevizDb>;

  constructor(dbName = 'leviz') {
    this.dbPromise = openLevizDb(dbName);
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
