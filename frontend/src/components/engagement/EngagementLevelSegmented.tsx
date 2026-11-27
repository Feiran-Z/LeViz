import { ENGAGEMENT_LEVELS, ENGAGEMENT_LEVEL_LABELS } from '../../domain/engagement';
import type { EngagementLevel } from '../../domain/types';

interface EngagementLevelSegmentedProps {
  /** Dimension name used for the accessible group label, e.g. "Cognitive". */
  label: string;
  value: EngagementLevel;
  /**
   * `inherited` shows the level a station gets from its activity, in a quieter
   * treatment, until the planner adjusts the station.
   */
  tone?: 'set' | 'inherited';
  onChange: (level: EngagementLevel) => void;
}

export function EngagementLevelSegmented({
  label,
  value,
  tone = 'set',
  onChange,
}: EngagementLevelSegmentedProps) {
  return (
    <div
      role="group"
      aria-label={`${label} engagement level`}
      className="inline-flex shrink-0 overflow-hidden rounded-sm border border-default bg-page"
    >
      {ENGAGEMENT_LEVELS.map((level) => {
        const selected = level === value;
        const selectedClass =
          tone === 'inherited' ? 'bg-surface text-primary' : 'bg-accent text-inverse';
        return (
          <button
            key={level}
            type="button"
            aria-pressed={selected}
            title={`${label}: ${ENGAGEMENT_LEVEL_LABELS[level]}`}
            className={`h-7 border-l border-default px-2.5 text-[11px] font-medium transition-colors first:border-l-0 ${
              selected ? selectedClass : 'text-secondary hover:bg-surface hover:text-primary'
            }`}
            onClick={() => onChange(level)}
          >
            {ENGAGEMENT_LEVEL_LABELS[level]}
          </button>
        );
      })}
    </div>
  );
}
