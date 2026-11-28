import { describe, expect, it } from 'vitest';
import { createClassRoster } from './classRoster';
import { createLesson, createStudent, createTextSegment } from './lesson';
import {
  WORKSPACE_KIND,
  WORKSPACE_SCHEMA_VERSION,
  parseWorkspace,
  planWorkspaceRestore,
  serializeWorkspace,
  type WorkspaceBackup,
} from './workspace';
import type { ClassRoster, Lesson } from './types';

function lesson(id: string, title = `Lesson ${id}`, classId: string | null = null): Lesson {
  const value = createLesson(title);
  value.id = id;
  value.classId = classId;
  value.updatedAt = '2026-01-01T10:00:00.000Z';
  value.roster = [createStudent('Ada')];
  value.segments = [createTextSegment('Opening')];
  return value;
}

function roster(id: string, name = `Class ${id}`): ClassRoster {
  const value = createClassRoster(name, [createStudent('Ada')]);
  value.id = id;
  value.updatedAt = '2026-01-01T10:00:00.000Z';
  return value;
}

function backup(lessons: Lesson[], classes: ClassRoster[]): WorkspaceBackup {
  return {
    kind: WORKSPACE_KIND,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: '2026-01-02T10:00:00.000Z',
    lessons,
    classes,
  };
}

describe('workspace backup', () => {
  it('round-trips all lessons and classes', () => {
    const lessons = [lesson('l1', 'Motion', 'c1'), lesson('l2', 'Forces')];
    const classes = [roster('c1', 'Period 3')];
    const json = serializeWorkspace(lessons, classes, '2026-01-02T10:00:00.000Z');

    const restored = parseWorkspace(json);

    expect(restored.kind).toBe(WORKSPACE_KIND);
    expect(restored.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(restored.exportedAt).toBe('2026-01-02T10:00:00.000Z');
    expect(restored.lessons.map((item) => item.id)).toEqual(['l1', 'l2']);
    expect(restored.classes.map((item) => item.name)).toEqual(['Period 3']);
    expect(restored.lessons[0]?.classId).toBe('c1');
  });

  it('rejects a single-lesson export as a workspace backup', () => {
    expect(() =>
      parseWorkspace(JSON.stringify({ schemaVersion: 1, lesson: lesson('l1') })),
    ).toThrow(/not a LeViz workspace backup/);
  });

  it('rejects a newer workspace schema', () => {
    const file = backup([], []);
    expect(() =>
      parseWorkspace(JSON.stringify({ ...file, schemaVersion: WORKSPACE_SCHEMA_VERSION + 1 })),
    ).toThrow(/newer/);
  });

  it('rejects malformed lessons and classes', () => {
    expect(() =>
      parseWorkspace(JSON.stringify(backup([{ id: 'broken' } as Lesson], []))),
    ).toThrow(/lesson 1/);
    expect(() =>
      parseWorkspace(
        JSON.stringify({ ...backup([], []), classes: [{ id: 'c1', name: 'No students' }] }),
      ),
    ).toThrow(/class 1/);
  });
});

describe('planWorkspaceRestore', () => {
  it('replaces id conflicts and adds missing items', () => {
    const file = backup([lesson('l1'), lesson('l2')], [roster('c1')]);
    const plan = planWorkspaceRestore(file, new Set(['l1']), [roster('c1', 'Current')], 'replace');

    expect(plan.lessons.map((item) => item.id)).toEqual(['l1', 'l2']);
    expect(plan.classes.map((item) => item.id)).toEqual(['c1']);
    expect(plan.counts.lessonsReplaced).toBe(1);
    expect(plan.counts.lessonsAdded).toBe(1);
    expect(plan.counts.classesReplaced).toBe(1);
  });

  it('keeps existing items and adds only the missing ones', () => {
    const file = backup([lesson('l1'), lesson('l2')], [roster('c1')]);
    const plan = planWorkspaceRestore(file, new Set(['l1']), [roster('c1', 'Current')], 'keep');

    expect(plan.lessons.map((item) => item.id)).toEqual(['l2']);
    expect(plan.classes).toEqual([]);
    expect(plan.counts.lessonsSkipped).toBe(1);
    expect(plan.counts.lessonsAdded).toBe(1);
    expect(plan.counts.classesSkipped).toBe(1);
  });

  it('copies conflicting items, remaps class links, and leaves existing items alone', () => {
    const file = backup(
      [lesson('l1', 'Motion', 'c1'), lesson('l2', 'Forces', 'c1')],
      [roster('c1', 'Period 3')],
    );
    const existingClasses = [roster('c1', 'Period 3'), roster('c2', 'Period 4')];
    const plan = planWorkspaceRestore(file, new Set(['l1']), existingClasses, 'copy');

    expect(plan.lessons).toHaveLength(2);
    const copiedLesson = plan.lessons.find((item) => item.id !== 'l2');
    expect(copiedLesson).toBeDefined();
    expect(copiedLesson?.id).not.toBe('l1');
    expect(copiedLesson?.title).toBe('Motion (restored copy)');
    expect(plan.classes).toHaveLength(1);
    const copiedClass = plan.classes[0];
    expect(copiedClass?.id).not.toBe('c1');
    expect(copiedClass?.name).toMatch(/Period 3 \(restored/);
    expect(copiedLesson?.classId).toBe(copiedClass?.id);
    expect(plan.lessons.find((item) => item.id === 'l2')?.classId).toBe(copiedClass?.id);
    expect(plan.counts.lessonsCopied).toBe(1);
    expect(plan.counts.lessonsAdded).toBe(1);
    expect(plan.counts.classesCopied).toBe(1);
    expect(existingClasses[0]?.name).toBe('Period 3');
  });

  it('copies without conflicts as plain additions', () => {
    const file = backup([lesson('l3', 'New', 'c3')], [roster('c3', 'Period 9')]);
    const plan = planWorkspaceRestore(file, new Set(), [], 'copy');

    expect(plan.lessons.map((item) => item.id)).toEqual(['l3']);
    expect(plan.classes.map((item) => item.id)).toEqual(['c3']);
    expect(plan.counts.lessonsAdded).toBe(1);
    expect(plan.counts.classesAdded).toBe(1);
    expect(plan.classes[0]?.name).toBe('Period 9');
  });
});
