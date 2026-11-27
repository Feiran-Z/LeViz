import {
  ENGAGEMENT_DIMENSIONS,
  ENGAGEMENT_DIMENSION_LABELS,
  ENGAGEMENT_LEVEL_LABELS,
} from '../../domain/engagement';
import type { EngagementDesign } from '../../domain/types';

/** Read-only one-line summary used in the lesson overview and printout. */
export function EngagementSummary({ design }: { design: EngagementDesign }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
      {ENGAGEMENT_DIMENSIONS.map((dimension) => (
        <span key={dimension} className="whitespace-nowrap">
          <span className="text-secondary">{ENGAGEMENT_DIMENSION_LABELS[dimension]}</span>{' '}
          <span className="font-medium text-primary">
            {ENGAGEMENT_LEVEL_LABELS[design[dimension]]}
          </span>
        </span>
      ))}
    </span>
  );
}
