import { resolveNodeEngagement, resolveSegmentEngagement } from './engagement';
import type { CanvasNode, EngagementDesign, LayoutSegment, Student } from './types';

/**
 * L1 — printable station/role cards and the seating sheet. Cards are the
 * station or table areas plus any other annotated position; the teacher and
 * bare seats stay off paper.
 */

export interface PrintCard {
  node: CanvasNode;
  groupNames: string[];
  engagement: EngagementDesign;
}

export interface SeatingRow {
  node: CanvasNode;
  groupNames: string[];
}

export interface PrintMaterials {
  cards: PrintCard[];
  seats: SeatingRow[];
  activityEngagement: EngagementDesign;
}

function hasNoteContent(node: CanvasNode): boolean {
  return Boolean(node.note && (node.note.title.trim() || node.note.body.trim()));
}

function readingOrder(nodes: CanvasNode[]): CanvasNode[] {
  return [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function buildPrintMaterials(
  segment: LayoutSegment,
  students: Student[],
): PrintMaterials {
  const nameById = new Map(students.map((student) => [student.id, student.name]));
  const groupNames = (node: CanvasNode) =>
    node.assignedStudentIds.map((id) => nameById.get(id) ?? 'Unknown');

  const cards = readingOrder(
    segment.canvas.nodes.filter((node) => {
      if (node.type === 'teacher') return false;
      return node.type === 'station' || node.type === 'round-table' || hasNoteContent(node);
    }),
  ).map((node) => ({
    node,
    groupNames: groupNames(node),
    engagement: resolveNodeEngagement(segment, node),
  }));

  const seats = readingOrder(
    segment.canvas.nodes.filter((node) => node.capacity > 0),
  ).map((node) => ({ node, groupNames: groupNames(node) }));

  return {
    cards,
    seats,
    activityEngagement: resolveSegmentEngagement(segment),
  };
}
