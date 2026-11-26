import { describe, expect, it } from 'vitest';
import { generateGroups, suggestGroupCount, validateAssignment } from './grouping';
import type { Student } from './types';

function student(id: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    name: id.toUpperCase(),
    tags: [],
    notWith: [],
    togetherWith: [],
    ...overrides,
  };
}

function classOf(count: number): Student[] {
  return Array.from({ length: count }, (_, index) => student(`s${index + 1}`, { name: `Student ${index + 1}` }));
}

function groupOfStudent(groups: { studentIds: string[] }[], id: string): number {
  return groups.findIndex((group) => group.studentIds.includes(id));
}

describe('generateGroups', () => {
  it('produces balanced random groups containing every student exactly once', () => {
    const students = classOf(10);
    const result = generateGroups(students, { groupCount: 3, mode: 'random', seed: 42 });
    expect(result.groups).toHaveLength(3);
    const sizes = result.groups.map((group) => group.studentIds.length).sort((a, b) => a - b);
    expect(sizes).toEqual([3, 3, 4]);
    const assigned = result.groups.flatMap((group) => group.studentIds);
    expect(new Set(assigned).size).toBe(10);
    expect(assigned).toHaveLength(10);
    expect(result.violations.filter((violation) => violation.type === 'empty-group')).toHaveLength(0);
  });

  it('is reproducible for a given seed', () => {
    const students = classOf(8);
    const first = generateGroups(students, { groupCount: 2, mode: 'random', seed: 7 });
    const second = generateGroups(students, { groupCount: 2, mode: 'random', seed: 7 });
    expect(first.groups).toEqual(second.groups);
  });

  it('keeps notWith pairs in different groups when possible', () => {
    const students = classOf(6);
    students[0]!.notWith = ['s2'];
    students[1]!.notWith = ['s1'];
    const result = generateGroups(students, { groupCount: 2, mode: 'constraints', seed: 11 });
    expect(groupOfStudent(result.groups, 's1')).not.toBe(groupOfStudent(result.groups, 's2'));
    expect(result.violations.filter((violation) => violation.type === 'not-with')).toHaveLength(0);
    expect(result.satisfiedConstraints).toBe(result.totalConstraints);
  });

  it('keeps togetherWith pairs in the same group', () => {
    const students = classOf(6);
    students[0]!.togetherWith = ['s2'];
    students[1]!.togetherWith = ['s1'];
    const result = generateGroups(students, { groupCount: 3, mode: 'constraints', seed: 3 });
    expect(groupOfStudent(result.groups, 's1')).toBe(groupOfStudent(result.groups, 's2'));
    expect(groupOfStudent(result.groups, 's1')).toBeGreaterThanOrEqual(0);
    expect(result.violations.filter((violation) => violation.type === 'together-with')).toHaveLength(0);
  });

  it('reports unsatisfiable notWith constraints instead of failing', () => {
    const students = classOf(3);
    students[0]!.notWith = ['s2', 's3'];
    students[1]!.notWith = ['s1', 's3'];
    students[2]!.notWith = ['s1', 's2'];
    const result = generateGroups(students, { groupCount: 2, mode: 'constraints', seed: 5 });
    expect(result.groups).toHaveLength(2);
    expect(result.violations.some((violation) => violation.type === 'not-with')).toBe(true);
    const assigned = result.groups.flatMap((group) => group.studentIds);
    expect(assigned.sort()).toEqual(['s1', 's2', 's3']);
  });

  it('puts everyone in one group when groupCount is 1', () => {
    const students = classOf(5);
    const result = generateGroups(students, { groupCount: 1, mode: 'constraints', seed: 1 });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.studentIds).toHaveLength(5);
    expect(result.violations).toEqual([]);
  });

  it('creates empty groups and warns when groupCount exceeds student count', () => {
    const students = classOf(2);
    const result = generateGroups(students, { groupCount: 4, mode: 'random', seed: 2 });
    expect(result.groups).toHaveLength(4);
    const assigned = result.groups.flatMap((group) => group.studentIds);
    expect(assigned.sort()).toEqual(['s1', 's2']);
    const empty = result.violations.filter((violation) => violation.type === 'empty-group');
    expect(empty).toHaveLength(2);
  });

  it('counts a symmetric constraint pair once', () => {
    const students = classOf(2);
    students[0]!.notWith = ['s2'];
    students[1]!.notWith = ['s1'];
    students[0]!.togetherWith = [];
    const result = generateGroups(students, { groupCount: 2, mode: 'constraints', seed: 1 });
    expect(result.totalConstraints).toBe(1);
    expect(result.satisfiedConstraints).toBe(1);
  });

  it('clamps invalid group counts to one', () => {
    const students = classOf(3);
    const result = generateGroups(students, { groupCount: 0, mode: 'random', seed: 1 });
    expect(result.groups).toHaveLength(1);
  });

  it('handles an empty roster', () => {
    const result = generateGroups([], { groupCount: 2, mode: 'constraints', seed: 1 });
    expect(result.groups).toHaveLength(2);
    expect(result.groups.every((group) => group.studentIds.length === 0)).toBe(true);
    expect(result.violations.every((violation) => violation.type === 'empty-group')).toBe(true);
  });
});

describe('suggestGroupCount', () => {
  it('uses one group per large seat area', () => {
    expect(suggestGroupCount(24, 4)).toBe(4);
    expect(suggestGroupCount(24, 5)).toBe(5);
  });

  it('falls back to groups of roughly four for chair-only layouts', () => {
    expect(suggestGroupCount(24, 0)).toBe(6);
    expect(suggestGroupCount(10, 0)).toBe(3);
  });

  it('never suggests more groups than students', () => {
    expect(suggestGroupCount(3, 5)).toBe(3);
    expect(suggestGroupCount(0, 0)).toBe(2);
  });
});

describe('validateAssignment', () => {
  it('flags notWith, togetherWith, and empty groups', () => {
    const students = classOf(4);
    students[0]!.notWith = ['s2'];
    students[1]!.togetherWith = ['s3'];
    const violations = validateAssignment(students, [
      { id: 'g1', name: 'Group 1', studentIds: ['s1', 's2'] },
      { id: 'g2', name: 'Group 2', studentIds: ['s3', 's4'] },
      { id: 'g3', name: 'Group 3', studentIds: [] },
    ]);
    expect(violations.map((violation) => violation.type).sort()).toEqual([
      'empty-group',
      'not-with',
      'together-with',
    ]);
  });

  it('ignores constraints that reference students outside the roster', () => {
    const students = [student('s1', { notWith: ['ghost'] })];
    const violations = validateAssignment(students, [{ id: 'g1', name: 'Group 1', studentIds: ['s1'] }]);
    expect(violations).toEqual([]);
  });
});
