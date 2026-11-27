import { beforeEach, describe, expect, it } from 'vitest';
import { createClassRoster } from '../domain/classRoster';
import { createStudent } from '../domain/lesson';
import type { ClassRoster } from '../domain/types';
import { setClassRosterRepository } from '../repositories';
import type { ClassRosterRepository } from '../repositories/types';
import { useClassRosterStore } from './classRosterStore';

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

beforeEach(() => {
  classes = new Map();
  setClassRosterRepository(repository);
  useClassRosterStore.setState({ classes: null, status: 'idle', error: null });
});

describe('classRosterStore', () => {
  it('loads classes sorted by name', async () => {
    const period = createClassRoster('Period 3', [createStudent('Ada')]);
    const algebra = createClassRoster('Algebra 2', [createStudent('Grace')]);
    classes.set(period.id, period);
    classes.set(algebra.id, algebra);

    await useClassRosterStore.getState().refresh();

    const state = useClassRosterStore.getState();
    expect(state.status).toBe('ready');
    expect(state.classes?.map((item) => item.name)).toEqual(['Algebra 2', 'Period 3']);
  });

  it('creates a class from students and keeps tags and constraints', async () => {
    const ada = createStudent('Ada', { tags: ['reader'] });
    const grace = createStudent('Grace');
    ada.togetherWith = [grace.id];
    grace.notWith = [];
    const students = [ada, grace];

    const roster = await useClassRosterStore.getState().createFromStudents('  Period 3  ', students);

    expect(roster.name).toBe('Period 3');
    expect(roster.students.find((student) => student.id === ada.id)?.tags).toEqual(['reader']);
    expect(roster.students.find((student) => student.id === ada.id)?.togetherWith).toEqual([grace.id]);
    expect(useClassRosterStore.getState().classes?.map((item) => item.name)).toEqual(['Period 3']);
    expect(classes.get(roster.id)).toEqual(roster);
  });

  it('rejects empty names, empty students, and duplicate names', async () => {
    await expect(useClassRosterStore.getState().createFromStudents('   ', [createStudent('Ada')])).rejects.toThrow(/required/i);
    await expect(useClassRosterStore.getState().createFromStudents('Period 3', [])).rejects.toThrow(/at least one/i);

    await useClassRosterStore.getState().createFromStudents('Period 3', [createStudent('Ada')]);
    await expect(
      useClassRosterStore.getState().createFromStudents('period 3', [createStudent('Grace')]),
    ).rejects.toThrow(/already exists/i);
  });

  it('updates students and the timestamp', async () => {
    const roster = await useClassRosterStore.getState().createFromStudents('Period 3', [createStudent('Ada')]);
    const next = createStudent('Grace');

    const updated = await useClassRosterStore.getState().saveStudents(roster.id, [next]);

    expect(updated.students.map((student) => student.name)).toEqual(['Grace']);
    expect(updated.updatedAt >= roster.updatedAt).toBe(true);
    expect(useClassRosterStore.getState().get(roster.id)?.students).toHaveLength(1);
  });

  it('rejects an empty class and an unknown id when saving students', async () => {
    const roster = await useClassRosterStore.getState().createFromStudents('Period 3', [createStudent('Ada')]);

    await expect(useClassRosterStore.getState().saveStudents(roster.id, [])).rejects.toThrow(/at least one/i);
    await expect(useClassRosterStore.getState().saveStudents('missing', [createStudent('Grace')])).rejects.toThrow(/no longer/i);
  });

  it('renames a class and rejects duplicate names', async () => {
    const period = await useClassRosterStore.getState().createFromStudents('Period 3', [createStudent('Ada')]);
    await useClassRosterStore.getState().createFromStudents('Algebra 2', [createStudent('Grace')]);

    const renamed = await useClassRosterStore.getState().rename(period.id, ' Period 3A ');

    expect(renamed.name).toBe('Period 3A');
    await expect(useClassRosterStore.getState().rename(period.id, 'algebra 2')).rejects.toThrow(/already exists/i);
  });

  it('removes a class', async () => {
    const roster = await useClassRosterStore.getState().createFromStudents('Period 3', [createStudent('Ada')]);

    await useClassRosterStore.getState().remove(roster.id);

    expect(useClassRosterStore.getState().classes).toEqual([]);
    expect(classes.has(roster.id)).toBe(false);
  });
});
