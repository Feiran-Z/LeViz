import {
  ENGAGEMENT_DIMENSIONS,
  ENGAGEMENT_DIMENSION_LABELS,
  resolveSegmentEngagement,
} from '../../domain/engagement';
import type { Segment } from '../../domain/types';
import { useLessonStore } from '../../stores/lessonStore';
import { Icon } from '../ui/Icons';
import { EngagementLevelSegmented } from './EngagementLevelSegmented';

/**
 * Segment-level engagement design. Every segment — text or layout — carries
 * one. On a layout segment this is the activity-wide level that stations
 * inherit until the planner adjusts an individual station.
 */
export function EngagementBar({ segment }: { segment: Segment }) {
  const updateSegment = useLessonStore((state) => state.updateSegment);
  const design = resolveSegmentEngagement(segment);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-default bg-surface px-4 py-1.5">
      <span
        className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-secondary"
        title={
          segment.kind === 'layout'
            ? 'Designed for the activity. Stations start here and can be adjusted individually.'
            : 'Designed for this segment.'
        }
      >
        <Icon name="circle-dot" size={13} />
        Designed engagement
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {ENGAGEMENT_DIMENSIONS.map((dimension) => (
          <div key={dimension} className="flex items-center gap-1.5">
            <span className="text-[11px] text-secondary">
              {ENGAGEMENT_DIMENSION_LABELS[dimension]}
            </span>
            <EngagementLevelSegmented
              label={ENGAGEMENT_DIMENSION_LABELS[dimension]}
              value={design[dimension]}
              onChange={(level) =>
                updateSegment(segment.id, {
                  engagement: { ...design, [dimension]: level },
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
