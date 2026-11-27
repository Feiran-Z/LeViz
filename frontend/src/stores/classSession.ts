import { countRemovedAssignments } from '../domain/classRoster';
import type { ClassRoster } from '../domain/types';
import { useClassRosterStore } from './classRosterStore';
import { useLessonStore } from './lessonStore';
import { useRosterStore } from './rosterStore';

/**
 * L3 — cross-store use cases for reusable classes. Only this module writes the
 * lesson and roster stores together; the class store owns the library itself.
 */

function studentIds(classRoster: ClassRoster): Set<string> {
  return new Set(classRoster.students.map((student) => student.id));
}

function assignmentLoss(classRoster: ClassRoster): number {
  const lesson = useLessonStore.getState().lesson;
  return lesson ? countRemovedAssignments(lesson.segments, studentIds(classRoster)) : 0;
}

export function applyClassToLesson(classRoster: ClassRoster): { removedAssignments: number } {
  const removedAssignments = assignmentLoss(classRoster);
  useRosterStore.getState().load(classRoster.students);
  useLessonStore.getState().applyClassRoster(classRoster, { setClassSize: true });
  return { removedAssignments };
}

export function refreshLessonFromClass(classRoster: ClassRoster): { removedAssignments: number } {
  const removedAssignments = assignmentLoss(classRoster);
  useRosterStore.getState().load(classRoster.students);
  useLessonStore.getState().applyClassRoster(classRoster, { setClassSize: false });
  return { removedAssignments };
}

export async function saveRosterAsClass(name: string): Promise<ClassRoster> {
  const students = useRosterStore.getState().students;
  const roster = await useClassRosterStore.getState().createFromStudents(name, students);
  useLessonStore.getState().linkClass(roster.id);
  return roster;
}

export async function saveChangesToClass(): Promise<ClassRoster> {
  const classId = useLessonStore.getState().lesson?.classId;
  if (!classId) throw new Error('This lesson is not linked to a class.');
  return useClassRosterStore.getState().saveStudents(classId, useRosterStore.getState().students);
}

export function unlinkLessonClass(): void {
  useLessonStore.getState().unlinkClass();
}
