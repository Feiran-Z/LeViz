import { create } from 'zustand';
import { createLesson } from '../domain/lesson';
import { parseLesson } from '../domain/serialize';
import type { Lesson, LessonSummary } from '../domain/types';
import { getLessonRepository } from '../repositories';

interface LibraryState {
  summaries: LessonSummary[] | null;
  error: string | null;
  refresh: () => Promise<void>;
  create: () => Promise<Lesson>;
  remove: (id: string) => Promise<void>;
  getDocument: (id: string) => Promise<Lesson | null>;
  importFromJson: (json: string) => Promise<Lesson>;
}

/**
 * L3 — the lesson library (list-level operations). Pages read this store
 * instead of touching LessonRepository directly (architecture §3 layer rule).
 */
export const useLibraryStore = create<LibraryState>()((set) => ({
  summaries: null,
  error: null,

  refresh: async () => {
    try {
      set({ summaries: await getLessonRepository().listLessons(), error: null });
    } catch (cause) {
      set({
        summaries: [],
        error: cause instanceof Error ? cause.message : 'Could not read saved lessons.',
      });
    }
  },

  create: async () => {
    const lesson = createLesson();
    await getLessonRepository().saveLesson(lesson);
    return lesson;
  },

  remove: async (id) => {
    await getLessonRepository().deleteLesson(id);
  },

  getDocument: (id) => getLessonRepository().getLesson(id),

  importFromJson: async (json) => {
    const lesson = parseLesson(json);
    await getLessonRepository().saveLesson(lesson);
    return lesson;
  },
}));
