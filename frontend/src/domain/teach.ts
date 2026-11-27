import type { CanvasNode, LayoutSegment, Segment } from './types';

/**
 * L1 — Teach-mode run and rotation data. A run is the timed subset of the
 * lesson; rotations are derived from the layout's annotated stops.
 */

export interface TeachSegment {
  segment: Segment;
  /** 1-based position among timed segments. */
  index: number;
  startMin: number;
  endMin: number;
  durationMin: number;
}

export interface TeachRun {
  segments: TeachSegment[];
  totalMin: number;
}

export type RotationKind = 'station' | 'stop';

export interface RotationConfig {
  kind: RotationKind;
  stops: CanvasNode[];
}

function safeDuration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function buildTeachRun(segments: Segment[]): TeachRun {
  let cursor = 0;
  const timed: TeachSegment[] = [];

  for (const segment of segments) {
    const durationMin = safeDuration(segment.durationMin);
    if (durationMin === 0) continue;
    const startMin = cursor;
    const endMin = cursor + durationMin;
    cursor = endMin;
    timed.push({ segment, index: timed.length + 1, startMin, endMin, durationMin });
  }

  return { segments: timed, totalMin: cursor };
}

function readingOrder(nodes: CanvasNode[]): CanvasNode[] {
  return [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
}

function hasLabel(node: CanvasNode): boolean {
  if (node.label.trim()) return true;
  return Boolean(node.note && (node.note.title.trim() || node.note.body.trim()));
}

function isWallStop(node: CanvasNode): boolean {
  return node.type === 'wall-anchor' && hasLabel(node);
}

/**
 * Stops a teacher could opt into rotating through: station and table areas
 * that hold students, plus annotated wall stops. Individual seats, desks,
 * podiums, and the teacher are not rotation stops.
 */
export function rotationEligibleStops(segment: LayoutSegment): CanvasNode[] {
  return readingOrder(
    segment.canvas.nodes.filter((node) => {
      if (node.type === 'teacher' || node.type === 'chair' || node.type === 'desk' || node.type === 'podium') {
        return false;
      }
      if ((node.type === 'station' || node.type === 'round-table') && node.capacity > 0) return true;
      return isWallStop(node);
    }),
  );
}

export function defaultRotationEnabled(segment: LayoutSegment): boolean {
  return segment.activityType === 'station-rotation' || segment.activityType === 'gallery-walk';
}

/**
 * The active stops for a layout. Station rotation uses station pods; gallery
 * walk uses wall stops; every other activity uses the manual candidate set.
 */
export function rotationConfig(segment: LayoutSegment, enabled: boolean): RotationConfig | null {
  if (!enabled) return null;

  let stops: CanvasNode[];
  let kind: RotationKind;

  if (segment.activityType === 'station-rotation') {
    stops = readingOrder(
      segment.canvas.nodes.filter((node) => node.type === 'station' && node.capacity > 0),
    );
    kind = 'station';
  } else if (segment.activityType === 'gallery-walk') {
    stops = readingOrder(segment.canvas.nodes.filter(isWallStop));
    kind = 'stop';
  } else {
    stops = rotationEligibleStops(segment);
    kind = 'stop';
  }

  return stops.length >= 2 ? { kind, stops } : null;
}

export function roundLengthMs(segmentLiveMs: number, stopCount: number): number {
  if (!Number.isFinite(segmentLiveMs) || segmentLiveMs <= 0 || stopCount < 2) return 0;
  return segmentLiveMs / stopCount;
}

export function formatCountdown(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.ceil(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
