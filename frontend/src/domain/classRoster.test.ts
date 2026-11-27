import { describe, expect, it } from 'vitest';
import { createCanvasNode, createLayoutSegment, createTextSegment } from './lesson';
import {
  countRemovedAssignments,
  createClassRoster,
  pruneAssignmentsToRoster,
} from './classRoster';
import type { Student } from './types';

function student(id: string, overrides: Partial<Student> = {}): Student {
  return { id, name: id, tags: [], notWith: [], togetherWith: [], ...overrides };
}

function layoutWithAssignments() {
  const layout = createLayoutSegment('group-discussion');
  layout.canvas.nodes = [
    createCanvasNode('round-table', 0, 0, { label: 'Table 1', assignedStudentIds: ['s1', 's2'] }),
    createCanvasNode('round-table', 0, 0, { label: 'Table 2', assignedStudentIds: ['s3'] }),
    createCanvasNode('round-table', 0, 0, { label: 'Table 3' }),
  ];
  const text = createTextSegment('Opening');
  return { layout, text };
}

describe('createClassRoster', () => {
  it('trims the name, clones students, and stamps ids and times', () => {
    const source = [student('s1', { name: 'Ada', tags: ['reader'] })];
    const roster = createClassRoster('  Period 3  ', source);

    expect(roster.name).toBe('Period 3');
    expect(roster.id).toMatch(/^class_/);
    expect(roster.students).toEqual(source);
    expect(roster.students).not.toBe(source);
    expect(roster.students[0]).not.toBe(source[0]);
    expect(roster.createdAt).toBe(roster.updatedAt);
    expect(Number.isFinite(Date.parse(roster.createdAt))).toBe(true);
  });
});

describe('assignment pruning', () => {
  it('removes assignments for students outside the class', () => {
    const { layout, text } = layoutWithAssignments();
    const ids = new Set(['s1']);

    const result = pruneAssignmentsToRoster([text, layout], ids);

    expect(result[0]).toBe(text);
    const updated = result[1];
    if (!updated || updated.kind !== 'layout') throw new Error('layout missing');
    expect(updated.canvas.nodes.map((node) => node.assignedStudentIds)).toEqual([['s1'], [], []]);
    expect(countRemovedAssignments([text, layout], ids)).toBe(2);
  });

  it('does not mutate the original segments', () => {
    const { layout } = layoutWithAssignments();
    const before = layout.canvas.nodes.map((node) => [...node.assignedStudentIds]);

    pruneAssignmentsToRoster([layout], new Set(['s1']));

    expect(layout.canvas.nodes.map((node) => node.assignedStudentIds)).toEqual(before);
  });

  it('counts zero when every assignment is in the class', () => {
    const { layout } = layoutWithAssignments();
    expect(countRemovedAssignments([layout], new Set(['s1', 's2', 's3']))).toBe(0);
  });
});
