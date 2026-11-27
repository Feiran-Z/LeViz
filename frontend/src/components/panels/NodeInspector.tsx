import { useEffect, useState } from 'react';
import type { LayoutSegment } from '../../domain/types';
import { NODE_TYPE_INFO, isAssignableNode } from '../../domain/types';
import { useLessonStore } from '../../stores/lessonStore';
import { useRosterStore } from '../../stores/rosterStore';
import { useUiStore } from '../../stores/uiStore';
import { NodeEngagementSection } from '../engagement/NodeEngagementSection';
import { Icon } from '../ui/Icons';

export function NodeInspector({ segment }: { segment: LayoutSegment | null }) {
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectNode = useUiStore((state) => state.selectNode);
  const openNoteEditor = useUiStore((state) => state.openNoteEditor);
  const notify = useUiStore((state) => state.notify);
  const setRightTab = useUiStore((state) => state.setRightTab);

  const node = segment && selectedNodeId ? segment.canvas.nodes.find((candidate) => candidate.id === selectedNodeId) ?? null : null;
  const updateNode = useLessonStore((state) => state.updateNode);
  const removeNode = useLessonStore((state) => state.removeNode);
  const unassignStudent = useLessonStore((state) => state.unassignStudent);
  const assignStudent = useLessonStore((state) => state.assignStudent);
  const students = useRosterStore((state) => state.students);

  const [label, setLabel] = useState('');
  const [capacity, setCapacity] = useState('0');

  useEffect(() => {
    if (!node) return;
    setLabel(node.label);
    setCapacity(String(node.capacity));
  }, [node?.id]);

  if (!segment) {
    return (
      <div className="px-4 py-6 text-sm text-secondary">
        Open a layout segment to inspect furniture and stations.
      </div>
    );
  }

  if (!node) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-secondary">
          Select a node on the canvas to edit its label, capacity, note, and assigned students.
        </p>
        <div className="mt-4 rounded-md border border-default bg-page p-3">
          <p className="section-label mb-2">This layout</p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-secondary">Nodes</dt>
              <dd className="tabular">{segment.canvas.nodes.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-secondary">Seats</dt>
              <dd className="tabular">
                {segment.canvas.nodes.reduce((sum, candidate) => sum + candidate.capacity, 0)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-secondary">Assigned</dt>
              <dd className="tabular">
                {segment.canvas.nodes.reduce((sum, candidate) => sum + candidate.assignedStudentIds.length, 0)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  const assigned = node.assignedStudentIds
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is NonNullable<typeof student> => Boolean(student));
  const assignable = students.filter((student) => !node.assignedStudentIds.includes(student.id));
  const info = NODE_TYPE_INFO[node.type];

  const commitLabel = () => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== node.label) updateNode(segment.id, node.id, { label: trimmed });
    else setLabel(node.label);
  };

  const commitCapacity = () => {
    const parsed = Number.parseInt(capacity, 10);
    const assignedCount = node.assignedStudentIds.length;
    const requested = Number.isFinite(parsed) ? Math.max(0, Math.min(60, parsed)) : node.capacity;
    const next = Math.max(assignedCount, requested);
    if (requested < assignedCount) {
      notify(`Unassign students first to lower capacity below ${assignedCount}.`, 'warning');
    }
    setCapacity(String(next));
    if (next !== node.capacity) updateNode(segment.id, node.id, { capacity: next });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="section-label">{info.label}</p>
          <h3 className="text-lg font-semibold leading-tight">{node.label}</h3>
        </div>
        <button
          type="button"
          className="icon-btn hover:text-danger"
          title="Delete node"
          aria-label="Delete node"
          onClick={() => {
            removeNode(segment.id, node.id);
            selectNode(null);
            setRightTab('roster');
            notify(`${node.label} removed.`, 'info');
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_88px] gap-2">
        <div>
          <label className="label" htmlFor="node-label">
            Label
          </label>
          <input
            id="node-label"
            className="input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onBlur={commitLabel}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        </div>
        <div>
          <label className="label" htmlFor="node-capacity">
            Capacity
          </label>
          <input
            id="node-capacity"
            className="input tabular"
            type="number"
            min={node.assignedStudentIds.length}
            max={60}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            onBlur={commitCapacity}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        </div>
      </div>

      {isAssignableNode(node) ? <NodeEngagementSection segment={segment} node={node} /> : null}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="section-label">Note</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openNoteEditor(node.id)}>
            <Icon name="pencil" size={13} />
            Edit note
          </button>
        </div>
        {node.note && (node.note.title || node.note.body) ? (
          <button
            type="button"
            className="w-full rounded-md border border-default bg-page p-3 text-left transition-colors hover:border-strong"
            onClick={() => openNoteEditor(node.id)}
          >
            {node.note.title ? <p className="text-sm font-medium">{node.note.title}</p> : null}
            {node.note.body ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-secondary">{node.note.body}</p>
            ) : null}
          </button>
        ) : (
          <button
            type="button"
            className="w-full rounded-md border border-dashed border-strong p-3 text-left text-sm text-secondary transition-colors hover:border-accent hover:text-primary"
            onClick={() => openNoteEditor(node.id)}
          >
            Add a prompt, role, or instruction for {node.label}…
          </button>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="section-label">Assigned students</span>
          <span className="text-xs tabular text-secondary">
            {assigned.length}/{node.capacity}
          </span>
        </div>

        {node.capacity === 0 ? (
          <p className="text-sm text-secondary">This node is not a seat. Raise its capacity to assign students.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {assigned.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-page px-2.5 py-1.5"
                >
                  <span className="truncate text-sm">{student.name}</span>
                  <button
                    type="button"
                    className="icon-btn h-6 w-6"
                    aria-label={`Unassign ${student.name}`}
                    onClick={() => unassignStudent(segment.id, node.id, student.id)}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </li>
              ))}
              {assigned.length === 0 ? <li className="text-sm text-secondary">No one assigned yet.</li> : null}
            </ul>

            {assignable.length > 0 && assigned.length < node.capacity ? (
              <select
                className="input mt-2"
                value=""
                aria-label={`Assign a student to ${node.label}`}
                onChange={(event) => {
                  if (!event.target.value) return;
                  const outcome = assignStudent(segment.id, node.id, event.target.value);
                  notify(outcome.message, outcome.ok ? (outcome.warning ? 'warning' : 'success') : 'error');
                  event.target.value = '';
                }}
              >
                <option value="">Assign a student…</option>
                {assignable.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-auto pt-6">
        <dl className="space-y-1 border-t border-default pt-3 text-xs text-secondary">
          <div className="flex justify-between">
            <dt>Position</dt>
            <dd className="tabular">
              {Math.round(node.x)}, {Math.round(node.y)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Size</dt>
            <dd className="tabular">
              {Math.round(node.width)} × {Math.round(node.height)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
