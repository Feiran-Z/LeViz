import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { activityGuidelines } from '../../domain/activityGuidelines';
import { ACTIVITY_TYPES, ACTIVITY_LABELS, type ActivityType, type LayoutSegment } from '../../domain/types';
import { CanvasEditor } from '../../canvas/CanvasEditor';
import { NoteDialog } from '../../canvas/NoteDialog';
import { useLessonStore } from '../../stores/lessonStore';
import { Icon } from '../ui/Icons';
import { EngagementBar } from '../engagement/EngagementBar';
import { SegmentHeader } from './SegmentHeader';

export function LayoutSegmentEditor({ segment }: { segment: LayoutSegment }) {
  const updateSegment = useLessonStore((state) => state.updateSegment);
  const lessonId = useLessonStore((state) => state.lesson?.id ?? null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructions, setInstructions] = useState(segment.instructions);
  const instructionsRef = useRef(instructions);
  instructionsRef.current = instructions;

  // Adopt instructions changed elsewhere (template apply, undo, activity change).
  useEffect(() => {
    if (segment.instructions !== instructionsRef.current) setInstructions(segment.instructions);
  }, [segment.instructions]);

  const commitInstructions = () => {
    if (instructions !== segment.instructions) updateSegment(segment.id, { instructions });
  };

  const changeActivity = (next: ActivityType) => {
    const previousSample = activityGuidelines(segment.activityType);
    const nextSample = activityGuidelines(next);
    // Replace the sample text for the old activity, but keep teacher edits.
    const replace = !instructions.trim() || instructions === previousSample;
    const nextInstructions = replace ? nextSample : instructions;
    setInstructions(nextInstructions);
    updateSegment(segment.id, { activityType: next, instructions: nextInstructions });
  };

  const insertSample = () => {
    const sample = activityGuidelines(segment.activityType);
    setInstructions(sample);
    updateSegment(segment.id, { instructions: sample });
  };

  useEffect(
    () => () => {
      const latest = instructionsRef.current;
      const current = useLessonStore.getState().lesson;
      const stored = current?.segments.find((candidate) => candidate.id === segment.id);
      if (stored && stored.kind === 'layout' && stored.instructions !== latest) {
        useLessonStore.getState().updateSegment(segment.id, { instructions: latest });
      }
    },
    [segment.id],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SegmentHeader segment={segment} />
      <EngagementBar segment={segment} />

      <div className="flex flex-wrap items-center gap-2 border-b border-default bg-page px-4 py-1.5">
        <label className="flex items-center gap-1.5 text-xs text-secondary" htmlFor="activity-type">
          Activity
          <select
            id="activity-type"
            className="h-7 rounded-sm border border-default bg-surface px-1.5 text-xs text-primary"
            value={segment.activityType}
            onChange={(event) => changeActivity(event.target.value as ActivityType)}
          >
            {ACTIVITY_TYPES.map((activity) => (
              <option key={activity} value={activity}>
                {ACTIVITY_LABELS[activity]}
              </option>
            ))}
            {!ACTIVITY_TYPES.includes(segment.activityType) ? (
              // Legacy documents may still say "free-for-all"; keep the label
              // visible without offering it for new segments.
              <option value={segment.activityType}>{ACTIVITY_LABELS[segment.activityType]}</option>
            ) : null}
          </select>
        </label>

        <span className="text-xs text-secondary">
          {segment.canvas.nodes.length} nodes ·{' '}
          {segment.canvas.nodes.reduce((sum, node) => sum + node.assignedStudentIds.length, 0)} assigned
        </span>

        <div className="ml-auto flex items-center gap-1">
          {lessonId ? (
            <Link
              to={`/lessons/${lessonId}/print/${segment.id}`}
              className="btn btn-ghost btn-sm"
              title="Print station and role cards, plus a seating sheet"
            >
              <Icon name="printer" size={13} />
              Print materials
            </Link>
          ) : null}
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${instructionsOpen ? 'btn-active' : ''}`}
            onClick={() => setInstructionsOpen((open) => !open)}
            aria-expanded={instructionsOpen}
            title={
              instructions.trim()
                ? 'Activity instructions (sample guidelines included)'
                : 'Add activity instructions'
            }
          >
            <Icon name="text" size={13} />
            Activity instructions
            {instructions.trim() ? (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            ) : null}
          </button>
        </div>
      </div>

      {instructionsOpen && (
        <div className="border-b border-default bg-page px-4 py-2">
          <textarea
            className="textarea min-h-[120px] max-h-[240px] bg-surface"
            placeholder="Instructions for the whole activity — what everyone should know before starting…"
            value={instructions}
            aria-label="Activity instructions"
            onChange={(event) => setInstructions(event.target.value)}
            onBlur={commitInstructions}
          />
          {!instructions.trim() && activityGuidelines(segment.activityType) ? (
            <div className="mt-1.5 flex justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={insertSample}>
                <Icon name="text" size={12} />
                Use sample guidelines
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <CanvasEditor segment={segment} />
      </div>

      <NoteDialog segment={segment} />
    </div>
  );
}
