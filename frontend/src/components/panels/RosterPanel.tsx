import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { LayoutSegment, Student } from '../../domain/types';
import { resolveCanvasDrop } from '../../canvas/dropTarget';
import { initials } from '../../lib/format';
import { useLessonStore } from '../../stores/lessonStore';
import { useRosterStore, type ConstraintKind } from '../../stores/rosterStore';
import { useUiStore } from '../../stores/uiStore';
import { redoRoster, undoRoster, useRosterHistory } from '../../hooks/useUndoRedo';
import { Icon } from '../ui/Icons';
import { RosterClassSection } from './RosterClassSection';

function useActiveLayout(): LayoutSegment | null {
  const activeSegmentId = useUiStore((state) => state.activeSegmentId);
  return useLessonStore((state) => {
    if (!activeSegmentId) return null;
    const segment = state.lesson?.segments.find((candidate) => candidate.id === activeSegmentId);
    return segment && segment.kind === 'layout' ? segment : null;
  });
}

function StudentRow({
  student,
  students,
  expanded,
  onToggle,
  conflictMessages,
}: {
  student: Student;
  students: Student[];
  expanded: boolean;
  onToggle: () => void;
  conflictMessages: string[];
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `student:${student.id}`,
    data: { type: 'student', studentId: student.id, name: student.name },
  });

  const renameStudent = useRosterStore((state) => state.renameStudent);
  const removeStudent = useRosterStore((state) => state.removeStudent);
  const addTag = useRosterStore((state) => state.addTag);
  const removeTag = useRosterStore((state) => state.removeTag);
  const setConstraint = useRosterStore((state) => state.setConstraint);
  const removeStudentEverywhere = useLessonStore((state) => state.removeStudentEverywhere);
  const notify = useUiStore((state) => state.notify);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(student.name);
  const [tagDraft, setTagDraft] = useState('');

  const others = students.filter((candidate) => candidate.id !== student.id);
  const together = student.togetherWith
    .map((id) => students.find((candidate) => candidate.id === id))
    .filter((value): value is Student => Boolean(value));
  const apart = student.notWith
    .map((id) => students.find((candidate) => candidate.id === id))
    .filter((value): value is Student => Boolean(value));

  const constraintOptions = (kind: ConstraintKind) => {
    const active = new Set(kind === 'notWith' ? student.notWith : student.togetherWith);
    return others.filter((candidate) => !active.has(candidate.id));
  };

  return (
    <li
      ref={setNodeRef}
      className={`rounded-md border bg-page transition-colors ${
        conflictMessages.length > 0
          ? 'border-warning/50'
          : expanded
            ? 'border-strong'
            : 'border-default'
      } ${isDragging ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-full bg-chip text-[10px] font-semibold text-chip-text active:cursor-grabbing"
          aria-label={`Drag ${student.name} onto the canvas`}
          title="Drag onto a seat on the canvas"
          {...attributes}
          {...listeners}
        >
          {initials(student.name)}
        </button>

        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              className="input h-6 px-1.5 text-[13px]"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onBlur={() => {
                renameStudent(student.id, name);
                setEditingName(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setName(student.name);
                  setEditingName(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-left"
              onClick={onToggle}
              aria-expanded={expanded}
            >
              <span className="truncate text-[13px] font-medium">{student.name}</span>
              {student.tags.length > 0 && (
                <span className="text-[10px] text-secondary">
                  {student.tags.length} {student.tags.length === 1 ? 'tag' : 'tags'}
                </span>
              )}
            </button>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {conflictMessages.length > 0 ? (
              <span className="flex items-center gap-1 text-[10px] text-warning">
                <Icon name="warning" size={10} />
                Constraint conflict on canvas
              </span>
            ) : null}
            {together.length > 0 ? (
              <span className="text-[10px] text-secondary">with {together.map((s) => s.name).join(', ')}</span>
            ) : null}
            {apart.length > 0 ? (
              <span className="text-[10px] text-secondary">apart from {apart.map((s) => s.name).join(', ')}</span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="icon-btn h-6 w-6"
          title="Rename student"
          aria-label={`Rename ${student.name}`}
          onClick={() => {
            setName(student.name);
            setEditingName(true);
          }}
        >
          <Icon name="pencil" size={11} />
        </button>
        <button
          type="button"
          className="icon-btn h-6 w-6 hover:text-danger"
          title="Remove student"
          aria-label={`Remove ${student.name}`}
          onClick={() => {
            removeStudent(student.id);
            removeStudentEverywhere(student.id);
            notify(`${student.name} removed from the roster.`, 'info');
          }}
        >
          <Icon name="trash" size={11} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-default px-2.5 py-2.5">
          <div>
            <span className="section-label">Tags</span>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {student.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                  <button
                    type="button"
                    className="ml-1 text-placeholder hover:text-danger"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => removeTag(student.id, tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                className="h-6 w-24 rounded-sm border border-default bg-page px-1.5 text-[11px] focus:border-accent focus:outline-none"
                placeholder="Add tag"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    addTag(student.id, tagDraft);
                    setTagDraft('');
                  }
                }}
              />
            </div>
          </div>

          <div>
            <span className="section-label">Together with</span>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {together.map((other) => (
                <span key={other.id} className="chip h-6">
                  {other.name}
                  <button
                    type="button"
                    className="text-secondary hover:text-danger"
                    aria-label={`Remove pairing with ${other.name}`}
                    onClick={() => setConstraint(student.id, 'togetherWith', other.id, false)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <select
                className="h-6 rounded-sm border border-default bg-page px-1 text-[11px]"
                value=""
                aria-label={`Pair ${student.name} with another student`}
                onChange={(event) => {
                  if (event.target.value) setConstraint(student.id, 'togetherWith', event.target.value, true);
                  event.target.value = '';
                }}
              >
                <option value="">Add…</option>
                {constraintOptions('togetherWith').map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="section-label">Keep apart from</span>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {apart.map((other) => (
                <span key={other.id} className="chip h-6 border border-warning/40 bg-transparent text-warning">
                  {other.name}
                  <button
                    type="button"
                    className="hover:text-primary"
                    aria-label={`Remove separation from ${other.name}`}
                    onClick={() => setConstraint(student.id, 'notWith', other.id, false)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <select
                className="h-6 rounded-sm border border-default bg-page px-1 text-[11px]"
                value=""
                aria-label={`Keep ${student.name} apart from another student`}
                onChange={(event) => {
                  if (event.target.value) setConstraint(student.id, 'notWith', event.target.value, true);
                  event.target.value = '';
                }}
              >
                <option value="">Add…</option>
                {constraintOptions('notWith').map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {conflictMessages.map((message) => (
            <p key={message} className="flex items-start gap-1 text-[11px] text-warning">
              <Icon name="warning" size={11} className="mt-0.5 shrink-0" />
              {message}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}

export function RosterPanel() {
  const students = useRosterStore((state) => state.students);
  const addStudent = useRosterStore((state) => state.addStudent);
  const addStudents = useRosterStore((state) => state.addStudents);
  const assignStudent = useLessonStore((state) => state.assignStudent);
  const notify = useUiStore((state) => state.notify);
  const { canUndo, canRedo } = useRosterHistory();
  const layout = useActiveLayout();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [draggingName, setDraggingName] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const conflicts = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!layout) return map;
    for (const node of layout.canvas.nodes) {
      for (const studentId of node.assignedStudentIds) {
        const student = students.find((candidate) => candidate.id === studentId);
        if (!student) continue;
        for (const otherId of student.notWith) {
          if (!node.assignedStudentIds.includes(otherId)) continue;
          const other = students.find((candidate) => candidate.id === otherId);
          const messages = map.get(studentId) ?? [];
          messages.push(`Assigned with ${other?.name ?? 'a student'} but marked keep apart (${node.label}).`);
          map.set(studentId, messages);
        }
      }
    }
    return map;
  }, [layout, students]);

  const handleDragStart = (event: DragStartEvent) => {
    const name = event.active.data.current?.['name'];
    setDraggingName(typeof name === 'string' ? name : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingName(null);
    const studentId = event.active.data.current?.['studentId'];
    if (typeof studentId !== 'string') return;

    // Hit-test the pointer, not the dragged chip's rect: the overlay is wider
    // than the avatar and its center drifts from where the teacher is pointing.
    const activator = event.activatorEvent;
    let clientX: number | null = null;
    let clientY: number | null = null;
    if (activator instanceof MouseEvent || activator instanceof PointerEvent) {
      clientX = activator.clientX + event.delta.x;
      clientY = activator.clientY + event.delta.y;
    } else if (activator instanceof TouchEvent) {
      const touch = activator.changedTouches[0] ?? activator.touches[0];
      if (touch) {
        clientX = touch.clientX + event.delta.x;
        clientY = touch.clientY + event.delta.y;
      }
    }
    if (clientX === null || clientY === null) {
      const rect = event.active.rect.current.translated;
      if (!rect) return;
      clientX = rect.left + rect.width / 2;
      clientY = rect.top + rect.height / 2;
    }

    const resolution = resolveCanvasDrop(clientX, clientY);
    if (!resolution) {
      notify('Drop a student onto a visible seat or station.', 'info');
      return;
    }
    const outcome = assignStudent(resolution.segmentId, resolution.nodeId, studentId);
    notify(outcome.message, outcome.ok ? (outcome.warning ? 'warning' : 'success') : 'error');
  };

  const handleAdd = () => {
    const created = addStudent(draft);
    if (created) setDraft('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <div>
          <h2 className="panel-title">Roster</h2>
          <p className="text-[11px] text-secondary">
            {students.length} {students.length === 1 ? 'student' : 'students'}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="icon-btn h-7 w-7"
            disabled={!canUndo}
            onClick={undoRoster}
            title="Undo roster change"
            aria-label="Undo roster change"
          >
            <Icon name="undo" size={14} />
          </button>
          <button
            type="button"
            className="icon-btn h-7 w-7"
            disabled={!canRedo}
            onClick={redoRoster}
            title="Redo roster change"
            aria-label="Redo roster change"
          >
            <Icon name="redo" size={14} />
          </button>
        </div>
      </div>

      <RosterClassSection />

      <div className="px-4 pb-2">
        <div className="flex gap-1.5">
          <input
            className="input h-8"
            placeholder="Add a student…"
            value={draft}
            aria-label="Add a student by name"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleAdd();
            }}
          />
          <button type="button" className="btn btn-secondary btn-sm h-8" onClick={handleAdd} disabled={!draft.trim()}>
            Add
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <button
            type="button"
            className="text-[11px] text-secondary underline-offset-2 hover:text-primary hover:underline"
            onClick={() => setBulkOpen((open) => !open)}
          >
            {bulkOpen ? 'Hide bulk paste' : 'Paste a class list'}
          </button>
          {layout ? (
            <span className="text-[10px] text-secondary">Drag a name onto a seat</span>
          ) : (
            <span className="text-[10px] text-secondary">Open a layout to place students</span>
          )}
        </div>
        {bulkOpen && (
          <div className="mt-2">
            <textarea
              className="textarea min-h-[72px] text-[12px]"
              placeholder={'One name per line, or comma-separated'}
              value={bulkText}
              aria-label="Paste names to add"
              onChange={(event) => setBulkText(event.target.value)}
            />
            <div className="mt-1.5 flex justify-end gap-1.5">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBulkOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!bulkText.trim()}
                onClick={() => {
                  const names = bulkText.split(/[\n,]+/).map((name) => name.trim()).filter(Boolean);
                  const added = addStudents(names);
                  setBulkText('');
                  setBulkOpen(false);
                  notify(`Added ${added} ${added === 1 ? 'student' : 'students'}.`, 'success');
                }}
              >
                Add names
              </button>
            </div>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {students.length === 0 ? (
            <div className="rounded-md border border-dashed border-strong p-4 text-center">
              <p className="text-sm text-secondary">
                Add students here, then drag them onto seats — or generate groups from the Groups tab.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {students.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  students={students}
                  expanded={expandedId === student.id}
                  onToggle={() => setExpandedId((current) => (current === student.id ? null : student.id))}
                  conflictMessages={conflicts.get(student.id) ?? []}
                />
              ))}
            </ul>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingName ? <span className="chip h-7 shadow-md">{draggingName}</span> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
