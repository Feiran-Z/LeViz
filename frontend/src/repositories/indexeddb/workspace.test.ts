import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createClassRoster } from '../../domain/classRoster';
import { createLesson } from '../../domain/lesson';
import { IndexedDbWorkspaceRepository } from './workspace';

let dbCounter = 0;

function repository(): IndexedDbWorkspaceRepository {
  dbCounter += 1;
  return new IndexedDbWorkspaceRepository(`leviz-workspace-test-${dbCounter}-${Date.now()}`);
}

describe('IndexedDbWorkspaceRepository', () => {
  it('saves and reads all lessons and classes', async () => {
    const repo = repository();
    const first = createLesson('Motion');
    const second = createLesson('Forces');
    const roster = createClassRoster('Period 3', []);

    await repo.saveAll({ lessons: [first, second], classes: [roster] });
    const contents = await repo.readAll();

    expect(contents.lessons.map((lesson) => lesson.title).sort()).toEqual(['Forces', 'Motion']);
    expect(contents.classes.map((item) => item.name)).toEqual(['Period 3']);
  });

  it('overwrites existing records with matching ids', async () => {
    const repo = repository();
    const lesson = createLesson('Before');
    await repo.saveAll({ lessons: [lesson], classes: [] });

    await repo.saveAll({ lessons: [{ ...lesson, title: 'After' }], classes: [] });

    const contents = await repo.readAll();
    expect(contents.lessons).toHaveLength(1);
    expect(contents.lessons[0]?.title).toBe('After');
  });
});
