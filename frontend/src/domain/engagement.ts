import type {
  CanvasNode,
  EngagementDesign,
  EngagementDimension,
  EngagementLevel,
  LayoutSegment,
  Lesson,
  Segment,
} from './types';

/**
 * L1 — Designed engagement. Planners describe how much cognitive, behavioral,
 * and affective engagement an activity is designed to ask for. This is a
 * planning annotation, not a measurement: nothing here is observed or scored.
 *
 * Layout segments carry an activity-wide design; each station (node) may carry
 * its own override and otherwise inherits the activity's design.
 */

export const ENGAGEMENT_DIMENSIONS: EngagementDimension[] = ['cognitive', 'behavioral', 'affective'];
export const ENGAGEMENT_LEVELS: EngagementLevel[] = ['low', 'medium', 'high'];

export const ENGAGEMENT_DIMENSION_LABELS: Record<EngagementDimension, string> = {
  cognitive: 'Cognitive',
  behavioral: 'Behavioral',
  affective: 'Affective',
};

export const ENGAGEMENT_LEVEL_LABELS: Record<EngagementLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const DEFAULT_ENGAGEMENT_LEVEL: EngagementLevel = 'medium';

export const DEFAULT_ENGAGEMENT: EngagementDesign = {
  cognitive: DEFAULT_ENGAGEMENT_LEVEL,
  behavioral: DEFAULT_ENGAGEMENT_LEVEL,
  affective: DEFAULT_ENGAGEMENT_LEVEL,
};

function isLevel(value: unknown): value is EngagementLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

/** A mutable copy of the baseline design. */
export function createEngagement(overrides: Partial<EngagementDesign> = {}): EngagementDesign {
  return { ...DEFAULT_ENGAGEMENT, ...overrides };
}

/** Coerce unknown stored values into a complete design, defaulting bad ones. */
export function normalizeEngagement(value: unknown): EngagementDesign {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    cognitive: isLevel(record['cognitive']) ? record['cognitive'] : DEFAULT_ENGAGEMENT_LEVEL,
    behavioral: isLevel(record['behavioral']) ? record['behavioral'] : DEFAULT_ENGAGEMENT_LEVEL,
    affective: isLevel(record['affective']) ? record['affective'] : DEFAULT_ENGAGEMENT_LEVEL,
  };
}

/** Coerce a station override; anything but a complete design means "inherit". */
export function normalizeNodeEngagement(value: unknown): EngagementDesign | null {
  return value === null || value === undefined ? null : normalizeEngagement(value);
}

/** The activity-wide design for any segment, including pre-feature documents. */
export function resolveSegmentEngagement(segment: Segment): EngagementDesign {
  return normalizeEngagement((segment as { engagement?: unknown }).engagement);
}

/** The design that applies at a station: its own override or the activity's. */
export function resolveNodeEngagement(segment: LayoutSegment, node: CanvasNode): EngagementDesign {
  const value = (node as { engagement?: unknown }).engagement;
  return value === null || value === undefined
    ? resolveSegmentEngagement(segment)
    : normalizeEngagement(value);
}

/** True when a station has been adjusted away from the activity-wide design. */
export function nodeOverridesEngagement(node: CanvasNode): boolean {
  const value = (node as { engagement?: unknown }).engagement;
  return value !== null && value !== undefined;
}

/**
 * Backfill engagement in a loaded document. Documents written before this
 * feature existed get the default design; stations start out inheriting it.
 */
export function normalizeLessonEngagement(lesson: Lesson): Lesson {
  return {
    ...lesson,
    segments: lesson.segments.map((segment) => {
      const engagement = normalizeEngagement((segment as { engagement?: unknown }).engagement);
      if (segment.kind !== 'layout') return { ...segment, engagement };
      return {
        ...segment,
        engagement,
        canvas: {
          ...segment.canvas,
          nodes: segment.canvas.nodes.map((node) => ({
            ...node,
            engagement: normalizeNodeEngagement((node as { engagement?: unknown }).engagement),
          })),
        },
      };
    }),
  };
}
