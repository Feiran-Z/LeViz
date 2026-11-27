import { describe, expect, it } from 'vitest';
import { createClassRoster } from '../domain/classRoster';
import { createStudent } from '../domain/lesson';
import type { ClassRoster } from '../domain/types';
import type { ClassRosterRepository } from './types';

function sampleClass(id: string, name: string, updatedAt = '2026-01-01T10:00:00.000Z'): ClassRoster {
  const roster = createClassRoster(name, [createStudent('Ada'), createStudent('Grace')]);
  roster.id = id;
  roster.updatedAt = updatedAt;
  return roster;
}

/**
 * Shared contract for every ClassRosterRepository implementation. Classes are a
 * small local library, so listClasses returns full rosters sorted by name.
 */
export function runClassRosterRepositoryContract(
  suiteName: string,
  makeRepository: () => ClassRosterRepository | Promise<ClassRosterRepository>,
): void {
  describe(`ClassRosterRepository contract — ${suiteName}`, () => {
    it('returns null for an unknown class', async () => {
      const repository = await makeRepository();
      expect(await repository.getClass('nope')).toBeNull();
    });

    it('saves and reads a class unchanged', async () => {
      const repository = await makeRepository();
      const roster = sampleClass('period-3', 'Period 3');
      await repository.saveClass(roster);
      expect(await repository.getClass('period-3')).toEqual(roster);
    });

    it('lists classes sorted by name', async () => {
      const repository = await makeRepository();
      await repository.saveClass(sampleClass('period-3', 'Period 3'));
      await repository.saveClass(sampleClass('algebra-2', 'Algebra 2'));

      const list = await repository.listClasses();

      expect(list.map((item) => item.name)).toEqual(['Algebra 2', 'Period 3']);
    });

    it('overwrites an existing class', async () => {
      const repository = await makeRepository();
      const roster = sampleClass('period-3', 'Period 3');
      await repository.saveClass(roster);
      await repository.saveClass({ ...roster, name: 'Period 3A', updatedAt: '2026-02-01T10:00:00.000Z' });

      expect((await repository.getClass('period-3'))?.name).toBe('Period 3A');
      expect(await repository.listClasses()).toHaveLength(1);
    });

    it('deletes a class', async () => {
      const repository = await makeRepository();
      await repository.saveClass(sampleClass('period-3', 'Period 3'));
      await repository.deleteClass('period-3');

      expect(await repository.getClass('period-3')).toBeNull();
      expect(await repository.listClasses()).toHaveLength(0);
    });
  });
}
