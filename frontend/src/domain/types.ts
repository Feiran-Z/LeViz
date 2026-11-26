/**
 * L1 — Domain. The single source of truth for the lesson document shape.
 * This module must not import React, Zustand, repositories, or any SDK.
 */

export type ActivityType =
  | 'harkness'
  | 'debate'
  | 'mock-trial'
  | 'group-discussion'
  | 'gallery-walk'
  | 'station-rotation'
  | 'free-for-all'
  | 'custom';

export type NodeType =
  | 'desk'
  | 'round-table'
  | 'station'
  | 'podium'
  | 'wall-anchor'
  | 'teacher'
  | 'chair';

/** Plain-text annotation attached to a canvas node. Never rich text. */
export interface NodeNote {
  title: string;
  body: string;
}

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees. Always present so documents round-trip without defaults. */
  rotation: number;
  label: string;
  /** How many students may be assigned. 0 means the node is not a seat. */
  capacity: number;
  note: NodeNote | null;
  assignedStudentIds: string[];
}

export interface CanvasState {
  /** Logical canvas size in world units. */
  width: number;
  height: number;
  nodes: CanvasNode[];
}

/** Minimal structural type for TipTap JSON. Kept local so domain stays SDK-free. */
export interface RichTextNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichTextNode[];
}

export interface RichTextDoc {
  type: 'doc';
  content?: RichTextNode[];
}

export interface TextSegment {
  id: string;
  kind: 'text';
  title: string;
  durationMin: number;
  /** TipTap JSON only ever lives here (architecture invariant 7). */
  content: RichTextDoc | null;
}

export interface LayoutSegment {
  id: string;
  kind: 'layout';
  title: string;
  durationMin: number;
  activityType: ActivityType;
  /** General instructions for the activity as a whole. Plain text. */
  instructions: string;
  canvas: CanvasState;
}

export type Segment = TextSegment | LayoutSegment;

export interface Student {
  id: string;
  name: string;
  tags: string[];
  /** Student ids this student should not be grouped with. */
  notWith: string[];
  /** Student ids this student should be grouped with. */
  togetherWith: string[];
}

export interface LessonMeta {
  id: string;
  title: string;
  /** ISO date `YYYY-MM-DD`, or null when the teacher has not set one. */
  lessonDate: string | null;
  /** Class period length in minutes; segment durations are measured against it. */
  durationMin: number;
  /** Planned number of students. Layout templates size themselves from this. */
  classSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson extends LessonMeta {
  roster: Student[];
  segments: Segment[];
}

export interface LessonSummary {
  id: string;
  title: string;
  lessonDate: string | null;
  durationMin: number;
  totalMinutes: number;
  segmentCount: number;
  studentCount: number;
  updatedAt: string;
}

export interface NodeTypeInfo {
  label: string;
  capacity: number;
  width: number;
  height: number;
  shape: 'rect' | 'ellipse';
}

export const NODE_TYPE_INFO: Record<NodeType, NodeTypeInfo> = {
  desk: { label: 'Desk', capacity: 2, width: 132, height: 72, shape: 'rect' },
  'round-table': { label: 'Round table', capacity: 5, width: 132, height: 132, shape: 'ellipse' },
  station: { label: 'Station', capacity: 4, width: 170, height: 104, shape: 'rect' },
  podium: { label: 'Podium', capacity: 1, width: 76, height: 64, shape: 'rect' },
  'wall-anchor': { label: 'Wall anchor', capacity: 0, width: 170, height: 52, shape: 'rect' },
  teacher: { label: 'Teacher', capacity: 0, width: 68, height: 68, shape: 'ellipse' },
  chair: { label: 'Chair', capacity: 1, width: 46, height: 46, shape: 'ellipse' },
};

export const NODE_TYPES: NodeType[] = [
  'desk',
  'round-table',
  'station',
  'podium',
  'wall-anchor',
  'teacher',
  'chair',
];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  harkness: 'Harkness discussion',
  debate: 'Debate',
  'mock-trial': 'Mock trial',
  'group-discussion': 'Group discussion',
  'gallery-walk': 'Gallery walk',
  'station-rotation': 'Station rotation',
  'free-for-all': 'Free-for-all',
  custom: 'Custom layout',
};

export const ACTIVITY_TYPES: ActivityType[] = [
  'harkness',
  'debate',
  'mock-trial',
  'group-discussion',
  'gallery-walk',
  'station-rotation',
  'custom',
];

/** A node that can hold students. */
export function isAssignableNode(node: CanvasNode): boolean {
  return node.capacity > 0;
}
