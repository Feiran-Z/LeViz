import { create } from 'zustand';
import { createClassRoster } from '../domain/classRoster';
import type { ClassRoster, Student } from '../domain/types';
import { getClassRosterRepository } from '../repositories';

export type ClassRosterStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ClassRosterState {
  classes: ClassRoster[] | null;
  status: ClassRosterStatus;
  error: string | null;
  refresh: () => Promise<void>;
  createFromStudents: (name: string, students: Student[]) => Promise<ClassRoster>;
  saveStudents: (id: string, students: Student[]) => Promise<ClassRoster>;
  rename: (id: string, name: string) => Promise<ClassRoster>;
  remove: (id: string) => Promise<void>;
  get: (id: string) => ClassRoster | undefined;
}

function sortByName(classes: ClassRoster[]): ClassRoster[] {
  return [...classes].sort((a, b) => a.name.localeCompare(b.name));
}

function validateName(name: string, classes: ClassRoster[], exceptId?: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('A class name is required.');
  const key = trimmed.toLowerCase();
  if (classes.some((item) => item.id !== exceptId && item.name.trim().toLowerCase() === key)) {
    throw new Error(`A class named “${trimmed}” already exists.`);
  }
  return trimmed;
}

function requireStudents(students: Student[]): Student[] {
  if (students.length === 0) throw new Error('Add at least one student before saving a class.');
  return structuredClone(students);
}

/**
 * L3 — the reusable class roster library. Classes are a separate aggregate from
 * lessons; reading them is allowed from any store, but only this store writes.
 */
export const useClassRosterStore = create<ClassRosterState>()((set, get) => ({
  classes: null,
  status: 'idle',
  error: null,

  refresh: async () => {
    set({ status: 'loading', error: null });
    try {
      const classes = await getClassRosterRepository().listClasses();
      set({ classes: sortByName(classes), status: 'ready' });
    } catch (cause) {
      set({
        classes: [],
        status: 'error',
        error: cause instanceof Error ? cause.message : 'Could not load classes.',
      });
    }
  },

  createFromStudents: async (name, students) => {
    const roster = createClassRoster(
      validateName(name, get().classes ?? []),
      requireStudents(students),
    );
    const saved = await getClassRosterRepository().saveClass(roster);
    set((state) => ({ classes: sortByName([...(state.classes ?? []), saved]), status: 'ready' }));
    return saved;
  },

  saveStudents: async (id, students) => {
    const existing = get().classes?.find((item) => item.id === id);
    if (!existing) throw new Error('That class is no longer available.');
    const updated: ClassRoster = {
      ...existing,
      students: requireStudents(students),
      updatedAt: new Date().toISOString(),
    };
    const saved = await getClassRosterRepository().saveClass(updated);
    set((state) => ({
      classes: sortByName((state.classes ?? []).map((item) => (item.id === id ? saved : item))),
    }));
    return saved;
  },

  rename: async (id, name) => {
    const existing = get().classes?.find((item) => item.id === id);
    if (!existing) throw new Error('That class is no longer available.');
    const updated: ClassRoster = {
      ...existing,
      name: validateName(name, get().classes ?? [], id),
      updatedAt: new Date().toISOString(),
    };
    const saved = await getClassRosterRepository().saveClass(updated);
    set((state) => ({
      classes: sortByName((state.classes ?? []).map((item) => (item.id === id ? saved : item))),
    }));
    return saved;
  },

  remove: async (id) => {
    await getClassRosterRepository().deleteClass(id);
    set((state) => ({ classes: (state.classes ?? []).filter((item) => item.id !== id) }));
  },

  get: (id) => get().classes?.find((item) => item.id === id),
}));
