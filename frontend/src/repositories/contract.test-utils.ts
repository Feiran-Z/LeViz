import { describe, expect, it } from 'vitest';
import { createCanvasNode, createLayoutSegment, createLesson, createStudent, createTextSegment } from '../domain/lesson';
import type { Lesson } from '../domain/types';
import type { LessonRepository } from './types';

function sampleLesson(id: string, updatedAt: string): Lesson {
  const lesson = createLesson(`Lesson ${id}`);
  lesson.id = id;
  lesson.updatedAt = updatedAt;
  lesson.roster = [createStudent('Ada'), createStudent('Grace')];
  lesson.segments = [createTextSegment('Opening'), createLayoutSegment('station-rotation')];
  const layout = lesson.segments[1];
  if (layout && layout.kind === 'layout') {
    const node = createCanvasNode('station', 40, 50, {
      label: 'Station A',
      note: { title: 'Prompt', body: 'What do you notice?' },
    });
    layout.canvas.nodes = [node];
  }
  return lesson;
}

/**
 * Shared contract suite. Run it against every LessonRepository implementation
 * to prove interface parity (architecture §4.2, invariant 12).
 */
export function runLessonRepositoryContract(
  suiteName: string,
  makeRepository: () => LessonRepository | Promise<LessonRepository>,
): void {
  describe(`LessonRepository contract — ${suiteName}`, () => {
    it('returns null for an unknown lesson', async () => {
      const repository = await makeRepository();
      expect(await repository.getLesson('nope')).toBeNull();
    });

    it('saves and reads a complete lesson unchanged', async () => {
      const repository = await makeRepository();
      const lesson = sampleLesson('a', '2026-01-01T10:00:00.000Z');
      await repository.saveLesson(lesson);
      expect(await repository.getLesson('a')).toEqual(lesson);
    });

    it('lists summaries newest first with derived counts', async () => {
      const repository = await makeRepository();
      const older = sampleLesson('older', '2026-01-01T10:00:00.000Z');
      const newer = sampleLesson('newer', '2026-02-01T10:00:00.000Z');
      await repository.saveLesson(older);
      await repository.saveLesson(newer);

      const list = await repository.listLessons();
      expect(list.map((item) => item.id)).toEqual(['newer', 'older']);
      const summary = list[0]!;
      expect(summary.segmentCount).toBe(2);
      expect(summary.studentCount).toBe(2);
      expect(summary.totalMinutes).toBe(20);
    });

    it('overwrites an existing lesson', async () => {
      const repository = await makeRepository();
      const lesson = sampleLesson('b', '2026-01-01T10:00:00.000Z');
      await repository.saveLesson(lesson);
      const edited = { ...lesson, title: 'Edited', updatedAt: '2026-03-01T10:00:00.000Z' };
      await repository.saveLesson(edited);
      expect((await repository.getLesson('b'))?.title).toBe('Edited');
      expect(await repository.listLessons()).toHaveLength(1);
    });

    it('deletes a lesson', async () => {
      const repository = await makeRepository();
      await repository.saveLesson(sampleLesson('c', '2026-01-01T10:00:00.000Z'));
      await repository.deleteLesson('c');
      expect(await repository.getLesson('c')).toBeNull();
      expect(await repository.listLessons()).toHaveLength(0);
    });
  });
}
