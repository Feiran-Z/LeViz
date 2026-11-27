import {
  ENGAGEMENT_DIMENSIONS,
  ENGAGEMENT_DIMENSION_LABELS,
  nodeOverridesEngagement,
  resolveNodeEngagement,
  resolveSegmentEngagement,
} from '../../domain/engagement';
import type { CanvasNode, EngagementDimension, EngagementLevel, LayoutSegment } from '../../domain/types';
import { useLessonStore } from '../../stores/lessonStore';
import { EngagementLevelSegmented } from './EngagementLevelSegmented';

/**
 * Per-station engagement. A station starts at the activity-wide design and
 * inherits it until the planner adjusts any dimension; from then on the whole
 * design is station-specific. Resetting returns it to the activity design.
 */
export function NodeEngagementSection({
  segment,
  node,
}: {
  segment: LayoutSegment;
  node: CanvasNode;
}) {
  const updateNode = useLessonStore((state) => state.updateNode);
  const activity = resolveSegmentEngagement(segment);
  const overridden = nodeOverridesEngagement(node);
  const design = resolveNodeEngagement(segment, node);

  const setLevel = (dimension: EngagementDimension, level: EngagementLevel) => {
    // The first adjustment copies the activity design, so the station starts
    // from the activity's levels rather than from a blank slate.
    updateNode(segment.id, node.id, { engagement: { ...design, [dimension]: level } });
  };

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="section-label">Engagement</span>
        <span
          className="tag"
          title={
            overridden
              ? 'This station has its own designed engagement.'
              : `Following the activity: Cognitive ${activity.cognitive}, Behavioral ${activity.behavioral}, Affective ${activity.affective}.`
          }
        >
          {overridden ? 'Station-specific' : 'Follows activity'}
        </span>
      </div>

      <div className="space-y-1.5">
        {ENGAGEMENT_DIMENSIONS.map((dimension) => (
          <div key={dimension} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-secondary">
              {ENGAGEMENT_DIMENSION_LABELS[dimension]}
            </span>
            <EngagementLevelSegmented
              label={ENGAGEMENT_DIMENSION_LABELS[dimension]}
              value={design[dimension]}
              tone={overridden ? 'set' : 'inherited'}
              onChange={(level) => setLevel(dimension, level)}
            />
          </div>
        ))}
      </div>

      {overridden ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-secondary">Adjusted for this station.</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => updateNode(segment.id, node.id, { engagement: null })}
          >
            Reset to activity
          </button>
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-secondary">
          Pick a level to adjust just this station.
        </p>
      )}
    </div>
  );
}
