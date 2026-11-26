import { createCanvasNode, DEFAULT_CLASS_SIZE } from '../lesson';
import type { ActivityType, CanvasNode, CanvasState, NodeType } from '../types';

/**
 * Static layout templates. Templates are starting points sized to the planned
 * class: applying one only ever adds nodes and never overwrites existing notes
 * or assignments.
 */
export interface TemplateNodeSpec {
  type: NodeType;
  x: number;
  y: number;
  label: string;
  width?: number;
  height?: number;
  rotation?: number;
  capacity?: number;
}

export interface LayoutTemplate {
  id: ActivityType;
  name: string;
  description: string;
  canvasWidth: number;
  canvasHeight: number;
  /** Pure builder — seat counts and capacities follow the planned class size. */
  buildNodes: (classSize: number) => TemplateNodeSpec[];
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

function spec(
  type: NodeType,
  x: number,
  y: number,
  label: string,
  overrides: Partial<Omit<TemplateNodeSpec, 'type' | 'x' | 'y' | 'label'>> = {},
): TemplateNodeSpec {
  return { type, x, y, label, ...overrides };
}

function classSizeOf(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CLASS_SIZE;
  return Math.max(1, Math.round(value));
}

function sized(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, classSizeOf(value)));
}

function circleOfChairs(centerX: number, centerY: number, radius: number, count: number): TemplateNodeSpec[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const chairSize = 46;
    return spec(
      'chair',
      Math.round(centerX + Math.cos(angle) * radius - chairSize / 2),
      Math.round(centerY + Math.sin(angle) * radius - chairSize / 2),
      `Seat ${index + 1}`,
    );
  });
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'harkness',
    name: 'Harkness discussion',
    description: 'One circle of chairs sized to your class, with the teacher outside the circle.',
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    buildNodes: (classSize) => {
      const seats = sized(classSize, 6, 32);
      const radius = Math.min(260, Math.max(180, 140 + seats * 5));
      return [...circleOfChairs(500, 310, radius, seats), spec('teacher', 466, 620, 'Teacher')];
    },
  },
  {
    id: 'debate',
    name: 'Debate',
    description: 'Two teams, split to your class size, facing a central speaking position.',
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    buildNodes: (classSize) => {
      const total = sized(classSize, 2, 60);
      const affirmative = Math.ceil(total / 2);
      const negative = Math.max(1, total - affirmative);
      return [
        spec('station', 100, 250, 'Affirmative', { width: 220, height: 150, capacity: affirmative }),
        spec('station', 680, 250, 'Negative', { width: 220, height: 150, capacity: negative }),
        spec('podium', 462, 300, 'Speaking position', { capacity: 0 }),
        spec('teacher', 466, 600, 'Teacher'),
      ];
    },
  },
  {
    id: 'mock-trial',
    name: 'Mock trial',
    description: 'Judge, jury, and counsel in distinct positions, sized to your class.',
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    buildNodes: (classSize) => {
      const total = sized(classSize, 8, 60);
      const jury = Math.min(14, Math.max(6, Math.round(total * 0.5)));
      const counsel = Math.max(2, Math.ceil((total - jury - 2) / 2));
      const jurors = Array.from({ length: jury }, (_, index) =>
        spec('chair', 770 + (index % 2) * 74, 90 + Math.floor(index / 2) * 62, `Juror ${index + 1}`),
      );
      return [
        spec('station', 420, 40, 'Judge', { width: 160, height: 76, capacity: 1 }),
        spec('chair', 460, 220, 'Witness'),
        spec('station', 120, 380, 'Defense counsel', { width: 200, height: 140, capacity: counsel }),
        spec('station', 680, 380, 'Prosecution counsel', { width: 200, height: 140, capacity: counsel }),
        ...jurors,
        spec('teacher', 60, 620, 'Teacher'),
      ];
    },
  },
  {
    id: 'group-discussion',
    name: 'Group discussion',
    description: 'Five round-table clusters sized to your class.',
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    buildNodes: (classSize) => {
      const perTable = Math.max(2, Math.ceil(sized(classSize, 4, 60) / 5));
      return [
        spec('round-table', 120, 100, 'Table 1', { capacity: perTable }),
        spec('round-table', 434, 100, 'Table 2', { capacity: perTable }),
        spec('round-table', 748, 100, 'Table 3', { capacity: perTable }),
        spec('round-table', 277, 360, 'Table 4', { capacity: perTable }),
        spec('round-table', 591, 360, 'Table 5', { capacity: perTable }),
        spec('teacher', 466, 600, 'Teacher'),
      ];
    },
  },
  {
    id: 'gallery-walk',
    name: 'Gallery walk',
    description: 'Work anchored around the room perimeter, students moving between stops.',
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    buildNodes: () => [
      spec('wall-anchor', 120, 40, 'Stop A'),
      spec('wall-anchor', 415, 40, 'Stop B'),
      spec('wall-anchor', 710, 40, 'Stop C'),
      spec('wall-anchor', 120, 600, 'Stop D'),
      spec('wall-anchor', 415, 600, 'Stop E'),
      spec('wall-anchor', 710, 600, 'Stop F'),
      spec('teacher', 466, 320, 'Teacher'),
    ],
  },
  {
    id: 'station-rotation',
    name: 'Station rotation',
    description: 'Four station pods with capacity for your whole class.',
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    buildNodes: (classSize) => {
      const perStation = Math.max(2, Math.ceil(sized(classSize, 4, 60) / 4));
      return [
        spec('station', 90, 60, 'Station 1', { width: 250, height: 170, capacity: perStation }),
        spec('station', 660, 60, 'Station 2', { width: 250, height: 170, capacity: perStation }),
        spec('station', 90, 420, 'Station 3', { width: 250, height: 170, capacity: perStation }),
        spec('station', 660, 420, 'Station 4', { width: 250, height: 170, capacity: perStation }),
        spec('teacher', 466, 320, 'Teacher'),
      ];
    },
  },
  {
    id: 'custom',
    name: 'Blank canvas',
    description: 'Start from nothing and arrange the room freely.',
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    buildNodes: () => [],
  },
];

export function templateFor(id: ActivityType): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((template) => template.id === id);
}

export function instantiateTemplate(template: LayoutTemplate, classSize = DEFAULT_CLASS_SIZE): CanvasNode[] {
  return template.buildNodes(classSize).map((node) =>
    createCanvasNode(node.type, node.x, node.y, {
      label: node.label,
      ...(node.width !== undefined ? { width: node.width } : {}),
      ...(node.height !== undefined ? { height: node.height } : {}),
      ...(node.rotation !== undefined ? { rotation: node.rotation } : {}),
      ...(node.capacity !== undefined ? { capacity: node.capacity } : {}),
    }),
  );
}

/** Non-destructive merge: existing nodes, notes, and assignments are preserved. */
export function applyTemplate(
  canvas: CanvasState,
  template: LayoutTemplate,
  classSize = DEFAULT_CLASS_SIZE,
): CanvasState {
  return {
    width: canvas.width,
    height: canvas.height,
    nodes: [...canvas.nodes, ...instantiateTemplate(template, classSize)],
  };
}
