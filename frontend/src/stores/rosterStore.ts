import { create } from 'zustand';
import { temporal } from 'zundo';
import { createStudent } from '../domain/lesson';
import type { Student } from '../domain/types';

export type ConstraintKind = 'notWith' | 'togetherWith';

interface RosterState {
  students: Student[];
  /** Bumped on every roster mutation so autosave can coalesce writes. */
  revision: number;
  load: (students: Student[]) => void;
  addStudent: (name: string) => Student | null;
  addStudents: (names: string[]) => number;
  renameStudent: (id: string, name: string) => void;
  removeStudent: (id: string) => string | null;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  setConstraint: (id: string, kind: ConstraintKind, otherId: string, enabled: boolean) => void;
  markDirty: () => void;
}

function withStudents(state: RosterState, students: Student[]): Partial<RosterState> {
  return { students, revision: state.revision + 1 };
}

function namesFrom(input: string[]): string[] {
  return input.map((name) => name.trim()).filter((name) => name.length > 0);
}

export const useRosterStore = create<RosterState>()(
  temporal(
    (set, get) => ({
      students: [],
      revision: 0,

      load: (students) => {
        set({ students: structuredClone(students), revision: get().revision + 1 });
        useRosterStore.temporal.getState().clear();
      },

      addStudent: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const student = createStudent(trimmed);
        set((state) => withStudents(state, [...state.students, student]));
        return student;
      },

      addStudents: (names) => {
        const unique = [...new Set(namesFrom(names))];
        if (unique.length === 0) return 0;
        const created = unique.map((name) => createStudent(name));
        set((state) => withStudents(state, [...state.students, ...created]));
        return created.length;
      },

      renameStudent: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) =>
          withStudents(
            state,
            state.students.map((student) => (student.id === id ? { ...student, name: trimmed } : student)),
          ),
        );
      },

      removeStudent: (id) => {
        const target = get().students.find((student) => student.id === id);
        if (!target) return null;
        set((state) =>
          withStudents(
            state,
            state.students
              .filter((student) => student.id !== id)
              .map((student) => ({
                ...student,
                notWith: student.notWith.filter((otherId) => otherId !== id),
                togetherWith: student.togetherWith.filter((otherId) => otherId !== id),
              })),
          ),
        );
        return id;
      },

      addTag: (id, tag) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        set((state) =>
          withStudents(
            state,
            state.students.map((student) =>
              student.id === id && !student.tags.includes(trimmed)
                ? { ...student, tags: [...student.tags, trimmed] }
                : student,
            ),
          ),
        );
      },

      removeTag: (id, tag) => {
        set((state) =>
          withStudents(
            state,
            state.students.map((student) =>
              student.id === id ? { ...student, tags: student.tags.filter((value) => value !== tag) } : student,
            ),
          ),
        );
      },

      setConstraint: (id, kind, otherId, enabled) => {
        if (id === otherId) return;
        set((state) => {
          const updateSide = (student: Student): Student => {
            if (student.id !== id && student.id !== otherId) return student;
            const peerId = student.id === id ? otherId : id;
            const key: ConstraintKind = kind;
            const current = new Set(student[key]);
            if (enabled) current.add(peerId);
            else current.delete(peerId);
            // A pair cannot be both "together" and "apart".
            const opposite: ConstraintKind = kind === 'notWith' ? 'togetherWith' : 'notWith';
            const oppositeSet = new Set(student[opposite]);
            if (enabled) oppositeSet.delete(peerId);
            return { ...student, [key]: [...current], [opposite]: [...oppositeSet] } as Student;
          };
          return withStudents(state, state.students.map(updateSide));
        });
      },

      markDirty: () => set((state) => ({ revision: state.revision + 1 })),
    }),
    {
      limit: 50,
      partialize: (state) => ({ students: state.students }),
      equality: (a, b) => a.students === b.students,
    },
  ),
);
