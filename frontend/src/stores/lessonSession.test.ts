import { beforeEach, describe, expect, it } from 'vitest';
import { createLesson } from '../domain/lesson';
import { setLessonRepository } from '../repositories';
import type { LessonRepository } from '../repositories/types';
import { closeLesson } from './lessonSession';
import { useLessonStore } from './lessonStore';
import { useRosterStore } from './rosterStore';

let saveCount = 0;

const repository: LessonRepository = {
  listLessons: async () => [],
  getLesson: async () => null,
  saveLesson: async (lesson) => {
    saveCount += 1;
    return lesson;
  },
  deleteLesson: async () => {},
};

beforeEach(() => {
  saveCount = 0;
  setLessonRepository(repository);
  useLessonStore.getState().hydrate(createLesson('Teach close'), 'ready');
  useRosterStore.getState().load([]);
});

describe('closeLesson', () => {
  it('can close without saving', async () => {
    closeLesson({ save: false });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(saveCount).toBe(0);
    expect(useLessonStore.getState().lesson).toBeNull();
  });

  it('saves by default', async () => {
    closeLesson();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(saveCount).toBeGreaterThan(0);
    expect(useLessonStore.getState().lesson).toBeNull();
  });
});
