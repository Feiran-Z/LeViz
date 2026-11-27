import { resolveSegmentEngagement } from './engagement';
import type { EngagementDesign, Segment } from './types';

/**
 * L1 — Lesson engagement timeline. Turns the ordered segments into spans laid
 * end to end on a minutes axis, carrying the segment-level design. Station
 * overrides are deliberately not folded in: the chart is the activity line.
 */

export interface EngagementTimelineSpan {
  /** 1-based position in the lesson, matching the overview's segment numbers. */
  segmentIndex: number;
  segmentId: string;
  title: string;
  kind: Segment['kind'];
  startMin: number;
  endMin: number;
  durationMin: number;
  engagement: EngagementDesign;
}

export interface EngagementTimeline {
  spans: EngagementTimelineSpan[];
  /** Last planned minute — the end of the lesson's planned time. */
  totalMin: number;
}

function safeDuration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function buildEngagementTimeline(segments: Segment[]): EngagementTimeline {
  let cursor = 0;
  const spans: EngagementTimelineSpan[] = [];

  segments.forEach((segment, index) => {
    const durationMin = safeDuration(segment.durationMin);
    const startMin = cursor;
    const endMin = cursor + durationMin;
    cursor = endMin;

    // A zero-minute segment occupies no time; it has no place on the timeline.
    if (durationMin === 0) return;

    spans.push({
      segmentIndex: index + 1,
      segmentId: segment.id,
      title: segment.title,
      kind: segment.kind,
      startMin,
      endMin,
      durationMin,
      engagement: resolveSegmentEngagement(segment),
    });
  });

  return { spans, totalMin: cursor };
}
