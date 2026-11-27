import {
  NODE_TYPE_INFO,
  type ActivityType,
  type CanvasNode,
  type LayoutSegment,
  type Lesson,
  type NodeNote,
  type NodeType,
  type RichTextDoc,
  type Segment,
  type Student,
  type TextSegment,
} from './types';
import { createEngagement } from './engagement';

export const DEFAULT_CANVAS_WIDTH = 1000;
export const DEFAULT_CANVAS_HEIGHT = 700;
export const DEFAULT_PERIOD_MINUTES = 70;
export const DEFAULT_CLASS_SIZE = 20;
export const MIN_CLASS_SIZE = 1;
export const MAX_CLASS_SIZE = 200;

export function clampClassSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CLASS_SIZE;
  return Math.min(MAX_CLASS_SIZE, Math.max(MIN_CLASS_SIZE, Math.round(value)));
}

/**
 * Resolve a stored class size, including documents written before the field
 * existed: infer from the roster if possible, otherwise use the default.
 */
export function resolveClassSize(value: unknown, rosterLength: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return clampClassSize(value);
  if (rosterLength > 0) return clampClassSize(rosterLength);
  return DEFAULT_CLASS_SIZE;
}

let idCounter = 0;

/** Stable-enough ids; crypto.randomUUID is available in every target browser. */
export function newId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
  return `${prefix}_${uuid}`;
}

export function emptyRichTextDoc(): RichTextDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export function createCanvasNode(
  type: NodeType,
  x: number,
  y: number,
  overrides: Partial<Omit<CanvasNode, 'id' | 'type' | 'x' | 'y'>> = {},
): CanvasNode {
  const info = NODE_TYPE_INFO[type];
  return {
    id: newId('node'),
    type,
    x,
    y,
    width: info.width,
    height: info.height,
    rotation: 0,
    label: info.label,
    capacity: info.capacity,
    engagement: null,
    note: null,
    assignedStudentIds: [],
    ...overrides,
  };
}

export function createTextSegment(
  title = 'Text segment',
  content: RichTextDoc | null = null,
  durationMin = 5,
): TextSegment {
  return {
    id: newId('seg'),
    kind: 'text',
    title,
    durationMin,
    engagement: createEngagement(),
    content: content ? structuredClone(content) : emptyRichTextDoc(),
  };
}

export function createLayoutSegment(activityType: ActivityType = 'custom'): LayoutSegment {
  return {
    id: newId('seg'),
    kind: 'layout',
    title: 'Layout segment',
    durationMin: 15,
    activityType,
    instructions: '',
    engagement: createEngagement(),
    canvas: {
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
      nodes: [],
    },
  };
}

export function createStudent(name: string, overrides: Partial<Student> = {}): Student {
  return {
    id: newId('stu'),
    name,
    tags: [],
    notWith: [],
    togetherWith: [],
    ...overrides,
  };
}

export function createLesson(title = 'Untitled lesson'): Lesson {
  const now = new Date().toISOString();
  return {
    id: newId('lesson'),
    title,
    lessonDate: null,
    durationMin: DEFAULT_PERIOD_MINUTES,
    classSize: DEFAULT_CLASS_SIZE,
    createdAt: now,
    updatedAt: now,
    roster: [],
    segments: [],
  };
}

export function cloneLesson(lesson: Lesson): Lesson {
  return structuredClone(lesson);
}

export function createNodeNote(title = '', body = ''): NodeNote {
  return { title, body };
}

export function totalMinutes(segments: Segment[]): number {
  return segments.reduce((sum, segment) => sum + (Number.isFinite(segment.durationMin) ? segment.durationMin : 0), 0);
}
