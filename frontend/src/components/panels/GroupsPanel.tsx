import { useEffect, useState } from 'react';
import { generateGroups, suggestGroupCount, type GroupingMode } from '../../domain/grouping';
import { useLessonStore } from '../../stores/lessonStore';
import { useRosterStore } from '../../stores/rosterStore';
import { useUiStore } from '../../stores/uiStore';
import { Icon } from '../ui/Icons';

export function GroupsPanel() {
  const students = useRosterStore((state) => state.students);
  const activeSegmentId = useUiStore((state) => state.activeSegmentId);
  const notify = useUiStore((state) => state.notify);
  const applyGroups = useLessonStore((state) => state.applyGroups);
  const clearSegmentAssignments = useLessonStore((state) => state.clearSegmentAssignments);

  const layout = useLessonStore((state) => {
    if (!activeSegmentId) return null;
    const segment = state.lesson?.segments.find((candidate) => candidate.id === activeSegmentId);
    return segment && segment.kind === 'layout' ? segment : null;
  });

  const seatNodes = layout ? layout.canvas.nodes.filter((node) => node.capacity > 0) : [];
  const storedPreview = useUiStore((state) => state.groupPreview);
  const setGroupPreview = useUiStore((state) => state.setGroupPreview);

  // The preview lives in uiStore so it survives tab switches, node selection,
  // and segment changes until the teacher generates again.
  const preview = layout && storedPreview?.segmentId === layout.id ? storedPreview : null;
  const result = preview?.result ?? null;

  const [mode, setMode] = useState<GroupingMode>('constraints');
  const [groupCount, setGroupCount] = useState('2');

  useEffect(() => {
    const kept = useUiStore.getState().groupPreview;
    if (layout && kept?.segmentId === layout.id) {
      // Restore the controls that produced the kept preview.
      setMode(kept.mode);
      setGroupCount(String(kept.groupCount));
      return;
    }
    const groupAreas = layout
      ? layout.canvas.nodes.filter((node) => node.capacity > 1).length
      : 0;
    const rosterSize = useRosterStore.getState().students.length;
    setGroupCount(String(suggestGroupCount(rosterSize, groupAreas)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout?.id]);

  if (!layout) {
    return (
      <div className="px-4 py-6 text-sm text-secondary">
        Open a layout segment to generate groups and place them on seats or stations.
      </div>
    );
  }

  const parseCount = (): number => {
    const parsed = Number.parseInt(groupCount, 10);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : 2;
  };

  const generate = () => {
    if (students.length === 0) {
      notify('Add students to the roster first.', 'warning');
      return;
    }
    const count = parseCount();
    const next = generateGroups(students, {
      groupCount: count,
      mode,
      seed: Math.floor(Math.random() * 2 ** 32),
    });
    setGroupPreview({ segmentId: layout.id, result: next, mode, groupCount: count });
    const constraintIssues = next.violations.filter((violation) => violation.type !== 'empty-group');
    if (constraintIssues.length > 0) {
      notify(`${constraintIssues.length} constraint issue${constraintIssues.length === 1 ? '' : 's'} — review warnings below.`, 'warning');
    }
  };

  const apply = () => {
    if (!result) return;
    const outcome = applyGroups(layout.id, result.groups);
    if (outcome.unplacedCount > 0) {
      notify(
        `Placed ${outcome.assignedCount} students across ${outcome.nodesUsed} seats. ${outcome.unplacedCount} could not fit — add capacity or more nodes.`,
        'warning',
      );
    } else {
      notify(`Placed ${outcome.assignedCount} students across ${outcome.nodesUsed} seats.`, 'success');
    }
  };

  const studentName = (id: string) => students.find((student) => student.id === id)?.name ?? 'Unknown';
  const totalSeats = seatNodes.reduce((sum, node) => sum + node.capacity, 0);
  const assignedNow = layout.canvas.nodes.reduce((sum, node) => sum + node.assignedStudentIds.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pb-2 pt-3">
        <h2 className="panel-title">Groups</h2>
        <p className="text-[11px] text-secondary">
          {seatNodes.length} {seatNodes.length === 1 ? 'seat area' : 'seat areas'} · {totalSeats} seats ·{' '}
          {assignedNow} assigned
        </p>
      </div>

      <div className="space-y-2.5 px-4 pb-3">
        <div>
          <span className="label">Mode</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className={`btn btn-sm ${mode === 'constraints' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('constraints')}
            >
              Constraint-aware
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'random' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('random')}
            >
              Random shuffle
            </button>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="w-24">
            <label className="label" htmlFor="group-count">
              Groups
            </label>
            <input
              id="group-count"
              className="input h-8 tabular"
              type="number"
              min={1}
              max={30}
              value={groupCount}
              onChange={(event) => setGroupCount(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary h-8 flex-1"
            onClick={generate}
            disabled={students.length === 0}
          >
            <Icon name="users" size={14} />
            Generate
          </button>
        </div>

        {students.length === 0 ? (
          <p className="text-[11px] text-secondary">Add students in the Roster tab first.</p>
        ) : seatNodes.length === 0 ? (
          <p className="flex items-start gap-1 text-[11px] text-warning">
            <Icon name="warning" size={11} className="mt-0.5 shrink-0" />
            This layout has no nodes with capacity. Add a station or table before applying groups.
          </p>
        ) : null}

        {result ? (
          <div className="rounded-md border border-default bg-page p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                {result.groups.length} groups · {students.length} students
              </span>
              <button type="button" className="btn btn-ghost btn-sm h-6" onClick={generate} title="Regenerate">
                <Icon name="refresh" size={12} />
                Again
              </button>
            </div>
            <p className="mt-0.5 text-[11px] text-secondary">
              {result.satisfiedConstraints}/{result.totalConstraints} constraints satisfied · kept until you
              generate again
            </p>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {result ? (
          <ul className="space-y-1.5">
            {result.groups.map((group) => (
              <li key={group.id} className="rounded-md border border-default bg-page p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{group.name}</span>
                  <span className="text-[10px] tabular text-secondary">{group.studentIds.length}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-secondary">
                  {group.studentIds.length > 0 ? group.studentIds.map(studentName).join(', ') : 'Empty'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-secondary">
            Groups appear here before they touch the canvas. Nothing changes until you press Apply.
          </p>
        )}

        {result && result.violations.some((violation) => violation.type !== 'empty-group') ? (
          <div className="mt-2 rounded-md border border-warning/40 bg-page p-2.5">
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-warning">
              <Icon name="warning" size={12} />
              Constraints that could not be satisfied
            </p>
            <ul className="space-y-1">
              {result.violations
                .filter((violation) => violation.type !== 'empty-group')
                .map((violation, index) => (
                  <li key={`${violation.type}-${index}`} className="text-[11px] leading-snug text-secondary">
                    {violation.message}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {result && result.violations.some((violation) => violation.type === 'empty-group') ? (
          <p className="mt-2 text-[11px] text-secondary">
            {result.violations.filter((violation) => violation.type === 'empty-group').length} group
            {result.violations.filter((violation) => violation.type === 'empty-group').length === 1 ? ' is' : 's are'}{' '}
            empty — lower the group count if that is not intended.
          </p>
        ) : null}
      </div>

      <div className="border-t border-default px-4 py-3">
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn btn-secondary btn-sm flex-1"
            onClick={() => {
              clearSegmentAssignments(layout.id);
              notify('All seats cleared.', 'info');
            }}
            disabled={assignedNow === 0}
          >
            Clear seats
          </button>
          <button type="button" className="btn btn-primary btn-sm flex-1" onClick={apply} disabled={!result}>
            Apply to canvas
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-secondary">
          Students are placed in groups onto seat areas in reading order.
        </p>
      </div>
    </div>
  );
}
