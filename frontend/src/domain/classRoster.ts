import { newId } from './lesson';
import type { ClassRoster, Segment, Student } from './types';

/**
 * L1 — Reusable class rosters. A class is an independent library entry; a
 * lesson keeps a copy of its students and constraints plus a classId link.
 */

export function createClassRoster(name: string, students: Student[]): ClassRoster {
  const now = new Date().toISOString();
  return {
    id: newId('class'),
    name: name.trim(),
    students: structuredClone(students),
    createdAt: now,
    updatedAt: now,
  };
}

/** Remove seat assignments for students who are not in the roster. */
export function pruneAssignmentsToRoster(
  segments: Segment[],
  rosterIds: ReadonlySet<string>,
): Segment[] {
  return segments.map((segment) => {
    if (segment.kind === 'text') return segment;
    return {
      ...segment,
      canvas: {
        ...segment.canvas,
        nodes: segment.canvas.nodes.map((node) => ({
          ...node,
          assignedStudentIds: node.assignedStudentIds.filter((id) => rosterIds.has(id)),
        })),
      },
    };
  });
}

/** How many seat assignments would be removed by adopting a roster. */
export function countRemovedAssignments(
  segments: Segment[],
  rosterIds: ReadonlySet<string>,
): number {
  let removed = 0;
  for (const segment of segments) {
    if (segment.kind !== 'layout') continue;
    for (const node of segment.canvas.nodes) {
      for (const id of node.assignedStudentIds) {
        if (!rosterIds.has(id)) removed += 1;
      }
    }
  }
  return removed;
}
