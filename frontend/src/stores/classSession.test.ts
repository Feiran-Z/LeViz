import { beforeEach, describe, expect, it } from 'vitest';
import { createClassRoster } from '../domain/classRoster';
import { createLesson, createStudent } from '../domain/lesson';
import type { ClassRoster } from '../domain/types';
import { setClassRosterRepository } from '../repositories';
import type { ClassRosterRepository } from '../repositories/types';
import {
  applyClassToLesson,
  refreshLessonFromClass,
  saveChangesToClass,
  saveRosterAsClass,
  unlinkLessonClass,
} from './classSession';
import { useClassRosterStore } from './classRosterStore';
import { useLessonStore } from './lessonStore';
import { useRosterStore } from './rosterStore';

let classes = new Map<string, ClassRoster>();

const repository: ClassRosterRepository = {
  listClasses: async () => [...classes.values()].sort((a, b) => a.name.localeCompare(b.name)),
  getClass: async (id) => classes.get(id) ?? null,
  saveClass: async (classRoster) => {
    classes.set(classRoster.id, structuredClone(classRoster));
    return classRoster;
  },
  deleteClass: async (id) => {
    classes.delete(id);
  },
};

function setupLessonWithAssignments(studentIds: string[]): string {
  useRosterStore.getState().load(
    studentIds.map((id) => ({ id, name: id, tags: [], notWith: [], togetherWith: [] })),
  );
  useLessonStore.getState().setClassSize(20);
  const segmentId = useLessonStore.getState().addLayoutSegment('group-discussion');
  if (!segmentId) throw new Error('layout segment not created');
  const segment = useLessonStore.getState().lesson?.segments.find((item) => item.id === segmentId);
  if (!segment || segment.kind !== 'layout') throw new Error('layout missing');
  const table = segment.canvas.nodes.find((node) => node.type === 'round-table');
  if (!table) throw new Error('table missing');
  useLessonStore.getState().updateNode(segmentId, table.id, { assignedStudentIds: studentIds });
  return segmentId;
}

function tableAssignments(segmentId: string): string[] {
  const segment = useLessonStore.getState().lesson?.segments.find((item) => item.id === segmentId);
  if (!segment || segment.kind !== 'layout') return [];
  return segment.canvas.nodes.flatMap((node) => node.assignedStudentIds);
}

beforeEach(() => {
  classes = new Map();
  setClassRosterRepository(repository);
  useClassRosterStore.setState({ classes: null, status: 'idle', error: null });
  useLessonStore.getState().hydrate(createLesson('Session'), 'ready');
  useRosterStore.getState().load([]);
});

describe('classSession', () => {
  it('applies a class, loads the roster, prunes assignments, and returns the loss count', () => {
    const ada = createStudent('Ada');
    const grace = createStudent('Grace');
    const alan = createStudent('Alan');
    const segmentId = setupLessonWithAssignments([ada.id, grace.id, alan.id]);
    const roster = createClassRoster('Period 3', [ada, grace]);

    const outcome = applyClassToLesson(roster);

    expect(outcome.removedAssignments).toBe(1);
    expect(useRosterStore.getState().students.map((student) => student.id)).toEqual([ada.id, grace.id]);
    expect(useLessonStore.getState().lesson?.classId).toBe(roster.id);
    expect(useLessonStore.getState().lesson?.classSize).toBe(2);
    expect(tableAssignments(segmentId)).toEqual([ada.id, grace.id]);
  });

  it('refreshes from a class without changing class size', () => {
    const ada = createStudent('Ada');
    const grace = createStudent('Grace');
    const segmentId = setupLessonWithAssignments([ada.id, grace.id]);
    const first = createClassRoster('Period 3', [ada, grace]);
    applyClassToLesson(first);
    useLessonStore.getState().setClassSize(24);
    const second = createClassRoster('Period 3', [ada]);

    const outcome = refreshLessonFromClass(second);

    expect(outcome.removedAssignments).toBe(1);
    expect(useLessonStore.getState().lesson?.classSize).toBe(24);
    expect(useRosterStore.getState().students.map((student) => student.id)).toEqual([ada.id]);
    expect(useLessonStore.getState().lesson?.classId).toBe(second.id);
    expect(tableAssignments(segmentId)).toEqual([ada.id]);
  });

  it('saves the lesson roster as a class and links it', async () => {
    const ada = createStudent('Ada');
    const grace = createStudent('Grace');
    useRosterStore.getState().load([ada, grace]);

    const roster = await saveRosterAsClass('Period 3');

    expect(roster.students.map((student) => student.id)).toEqual([ada.id, grace.id]);
    expect(useClassRosterStore.getState().get(roster.id)?.name).toBe('Period 3');
    expect(useLessonStore.getState().lesson?.classId).toBe(roster.id);
    expect(classes.has(roster.id)).toBe(true);
  });

  it('saves roster changes back to the linked class', async () => {
    const ada = createStudent('Ada');
    const roster = await useClassRosterStore.getState().createFromStudents('Period 3', [ada]);
    useLessonStore.getState().linkClass(roster.id);
    const grace = createStudent('Grace');
    useRosterStore.getState().load([ada, grace]);

    const updated = await saveChangesToClass();

    expect(updated.id).toBe(roster.id);
    expect(updated.students.map((student) => student.id)).toEqual([ada.id, grace.id]);
    expect(updated.updatedAt >= roster.updatedAt).toBe(true);
    expect(useClassRosterStore.getState().get(roster.id)?.students).toHaveLength(2);
  });

  it('unlinks without clearing the roster', () => {
    const ada = createStudent('Ada');
    const roster = createClassRoster('Period 3', [ada]);
    useLessonStore.getState().linkClass(roster.id);
    useRosterStore.getState().load([ada]);

    unlinkLessonClass();

    expect(useLessonStore.getState().lesson?.classId).toBeNull();
    expect(useRosterStore.getState().students.map((student) => student.id)).toEqual([ada.id]);
  });
});
