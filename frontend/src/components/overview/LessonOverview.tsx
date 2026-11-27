import { Link } from 'react-router-dom';
import {
  nodeOverridesEngagement,
  resolveNodeEngagement,
  resolveSegmentEngagement,
} from '../../domain/engagement';
import { ACTIVITY_LABELS, isAssignableNode, type LayoutSegment } from '../../domain/types';
import { EngagementSummary } from '../engagement/EngagementSummary';
import { AppFooter } from '../layout/AppFooter';
import { formatMinutes, formatShortDate } from '../../lib/format';
import { lessonTotalMinutes, useLessonStore } from '../../stores/lessonStore';
import { useRosterStore } from '../../stores/rosterStore';
import { useUiStore } from '../../stores/uiStore';
import { Icon } from '../ui/Icons';
import { EngagementTimelineChart } from './EngagementTimelineChart';
import { LayoutThumbnail } from './LayoutThumbnail';
import { RichTextView } from './RichTextView';

function LayoutSection({ segment }: { segment: LayoutSegment }) {
  const students = useRosterStore((state) => state.students);
  const nodes = segment.canvas.nodes;
  const seats = nodes.reduce((sum, node) => sum + node.capacity, 0);
  const assignedCount = nodes.reduce((sum, node) => sum + node.assignedStudentIds.length, 0);
  const capacityNodes = nodes.filter((node) => node.capacity > 0).length;
  // Reading order, matching where "Apply to canvas" places groups.
  const assignedNodes = nodes
    .filter((node) => node.assignedStudentIds.length > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const annotated = nodes.filter(
    (node) => node.note && (node.note.title.trim() || node.note.body.trim()),
  );
  // Only seats/stations hold students; a stray override on the teacher or a
  // wall anchor must never print as "Station engagement".
  const adjustedStations = nodes
    .filter((node) => isAssignableNode(node) && nodeOverridesEngagement(node))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const studentName = (id: string) => students.find((student) => student.id === id)?.name ?? 'Unknown';

  return (
    <div>
      {segment.instructions.trim() ? (
        <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-secondary">
          {segment.instructions}
        </p>
      ) : null}

      {nodes.length === 0 ? (
        <p className="text-sm text-secondary">No furniture placed yet.</p>
      ) : (
        <>
          <LayoutThumbnail canvas={segment.canvas} />
          <p className="mt-1.5 text-[11px] text-secondary">
            {nodes.length} nodes · {seats} seats · {assignedCount} assigned
          </p>
        </>
      )}

      {capacityNodes > 0 ? (
        <div className="mt-3 border-t border-default pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="section-label">Student assignments</p>
            <p className="text-[10px] tabular text-secondary">
              {assignedCount} {assignedCount === 1 ? 'student' : 'students'} · {assignedNodes.length}{' '}
              {assignedNodes.length === 1 ? 'seat' : 'seats'}
            </p>
          </div>
          {assignedNodes.length > 0 ? (
            <ul className="mt-1.5 overflow-hidden rounded-sm border border-default">
              {assignedNodes.map((node) => (
                <li
                  key={node.id}
                  className="flex items-start gap-3 border-b border-default bg-page px-2.5 py-1.5 last:border-b-0"
                >
                  <span className="w-32 shrink-0 truncate text-xs font-medium" title={node.label}>
                    {node.label}
                  </span>
                  <span className="min-w-0 flex-1 text-xs leading-relaxed text-secondary">
                    {node.assignedStudentIds.map(studentName).join(', ')}
                  </span>
                  <span className="shrink-0 text-[10px] tabular text-secondary">
                    {node.assignedStudentIds.length}/{node.capacity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-secondary">No students assigned yet.</p>
          )}
        </div>
      ) : null}

      {adjustedStations.length > 0 ? (
        <div className="mt-3 border-t border-default pt-3">
          <p className="section-label">Station engagement</p>
          <ul className="mt-1.5 space-y-1">
            {adjustedStations.map((node) => (
              <li
                key={node.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-sm border border-default bg-page px-2.5 py-1.5"
              >
                <span className="w-32 shrink-0 truncate text-xs font-medium" title={node.label}>
                  {node.label}
                </span>
                <span className="text-[11px]">
                  <EngagementSummary design={resolveNodeEngagement(segment, node)} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {annotated.length > 0 ? (
        <div className="mt-3 border-t border-default pt-3">
          <p className="section-label">Annotations</p>
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {annotated.map((node) => (
              <li key={node.id} className="rounded-sm border border-default bg-page px-2.5 py-2">
                <p className="text-xs font-medium">
                  {node.label}
                  {node.note?.title ? ` · ${node.note.title}` : ''}
                </p>
                {node.note?.body ? (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-secondary">
                    {node.note.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function LessonOverview() {
  const lesson = useLessonStore((state) => state.lesson);
  const students = useRosterStore((state) => state.students);
  const setActiveSegment = useUiStore((state) => state.setActiveSegment);
  const setViewMode = useUiStore((state) => state.setViewMode);

  if (!lesson) return null;

  const planned = lessonTotalMinutes(lesson);
  const over = lesson.durationMin > 0 && planned > lesson.durationMin;
  const fill = lesson.durationMin > 0 ? Math.min(100, (planned / lesson.durationMin) * 100) : 0;

  const editSegment = (id: string) => {
    setActiveSegment(id);
    setViewMode('edit');
  };

  const stats = [
    { label: 'Period', value: formatMinutes(lesson.durationMin) },
    { label: 'Planned', value: formatMinutes(planned) },
    { label: 'Class size', value: String(lesson.classSize) },
    { label: 'On roster', value: String(students.length) },
    { label: 'Segments', value: String(lesson.segments.length) },
  ];

  return (
    <div className="h-full overflow-y-auto bg-page print:h-auto print:overflow-visible">
      <div className="mx-auto w-full max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-label">Lesson plan</p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{lesson.title}</h1>
            <p className="mt-1 text-sm text-secondary">
              {formatShortDate(lesson.lessonDate)} · {lesson.classSize} students · {students.length} on roster
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Link to={`/lessons/${lesson.id}/teach`} className="btn btn-secondary btn-sm">
              <Icon name="play" size={14} />
              Teach
            </Link>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setViewMode('edit')}>
              <Icon name="pencil" size={14} />
              Back to editor
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
              <Icon name="printer" size={14} />
              Print
            </button>
          </div>
        </header>

        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-md border border-default bg-surface px-3 py-2">
              <dt className="text-[11px] text-secondary">{stat.label}</dt>
              <dd className="text-[15px] font-semibold tabular">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-secondary">Time budget</span>
            <span className={`tabular ${over ? 'font-medium text-warning' : 'text-secondary'}`}>
              {formatMinutes(planned)} / {formatMinutes(lesson.durationMin)}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-strong" role="presentation">
            <div
              className={`h-full rounded-full ${over ? 'bg-warning' : 'bg-accent'}`}
              style={{ width: `${fill}%` }}
            />
          </div>
        </div>

        <EngagementTimelineChart segments={lesson.segments} />

        {lesson.segments.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-strong px-6 py-12 text-center">
            <p className="text-sm text-secondary">This lesson has no segments yet.</p>
            <button type="button" className="btn btn-secondary mt-4 print:hidden" onClick={() => setViewMode('edit')}>
              <Icon name="pencil" size={14} />
              Start planning
            </button>
          </div>
        ) : (
          <ol className="mt-6 space-y-4">
            {lesson.segments.map((segment, index) => {
              const activityLabel = segment.kind === 'text' ? 'Text' : ACTIVITY_LABELS[segment.activityType];
              const showActivityTag = segment.kind === 'text' || activityLabel !== segment.title;
              return (
              <li
                key={segment.id}
                className="overview-segment card break-inside-avoid p-4 print:border-default"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-page text-xs font-semibold tabular text-secondary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 className="text-[15px] font-semibold leading-snug">{segment.title}</h2>
                      {showActivityTag ? <span className="tag">{activityLabel}</span> : null}
                      <span className="text-xs tabular text-secondary">{segment.durationMin} min</span>
                    </div>
                    <div className="mt-1 text-[11px]">
                      <span className="mr-2 font-medium text-secondary">Engagement</span>
                      <EngagementSummary design={resolveSegmentEngagement(segment)} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm shrink-0 print:hidden"
                    onClick={() => editSegment(segment.id)}
                  >
                    <Icon name="pencil" size={13} />
                    Edit
                  </button>
                </div>

                <div className="mt-3 sm:pl-10">
                  {segment.kind === 'text' ? (
                    <RichTextView doc={segment.content} />
                  ) : (
                    <LayoutSection segment={segment} />
                  )}
                </div>
              </li>
              );
            })}
          </ol>
        )}

        <p className="mt-6 text-center text-[11px] text-secondary print:hidden">
          Read-only overview · changes are made in the editor
        </p>

        <AppFooter variant="document" />
      </div>
    </div>
  );
}
