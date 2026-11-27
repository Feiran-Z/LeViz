import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { createClassRoster } from '../../domain/classRoster';
import { createLesson } from '../../domain/lesson';
import { runClassRosterRepositoryContract } from '../classRosterContract.test-utils';
import { IndexedDbClassRosterRepository } from './classes';
import { IndexedDbLessonRepository } from './index';

let dbCounter = 0;

runClassRosterRepositoryContract('IndexedDB', () => {
  dbCounter += 1;
  return new IndexedDbClassRosterRepository(`leviz-classes-test-${dbCounter}-${Date.now()}`);
});

describe('IndexedDB v2 upgrade', () => {
  it('keeps existing lessons and adds the classes store', async () => {
    const dbName = `leviz-upgrade-test-${Date.now()}`;
    const oldDb = await openDB(dbName, 1, {
      upgrade(db) {
        const lessons = db.createObjectStore('lessons', { keyPath: 'id' });
        lessons.createIndex('by-updatedAt', 'updatedAt');
      },
    });
    const lesson = createLesson('Before upgrade');
    await oldDb.put('lessons', lesson);
    oldDb.close();

    const lessonRepository = new IndexedDbLessonRepository(dbName);
    expect((await lessonRepository.getLesson(lesson.id))?.title).toBe('Before upgrade');

    const classRepository = new IndexedDbClassRosterRepository(dbName);
    const roster = createClassRoster('Period 1', []);
    await classRepository.saveClass(roster);
    expect(await classRepository.getClass(roster.id)).toEqual(roster);
  });
});
