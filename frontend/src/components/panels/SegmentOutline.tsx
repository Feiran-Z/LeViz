import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { totalMinutes } from '../../domain/lesson';
import { LAYOUT_TEMPLATES } from '../../domain/templates';
import { TEXT_TEMPLATES, type TextTemplateId } from '../../domain/textTemplates';
import { ACTIVITY_LABELS, type ActivityType, type Segment } from '../../domain/types';
import { useLessonStore } from '../../stores/lessonStore';
import { useUiStore } from '../../stores/uiStore';
import { Icon } from '../ui/Icons';

const EMPTY_SEGMENTS: Segment[] = [];

function SortableSegment({
  segment,
  active,
  onSelect,
  onDelete,
}: {
  segment: Segment;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-70' : 'relative'}
    >
      <div
        className={`group flex items-center gap-1 rounded-md border px-1.5 py-1.5 transition-colors ${
          active ? 'border-strong bg-page' : 'border-transparent hover:border-default hover:bg-page/60'
        }`}
      >
        <button
          type="button"
          className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded-sm text-placeholder hover:text-secondary active:cursor-grabbing"
          aria-label={`Reorder ${segment.title}`}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" size={13} />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <span className="flex items-center gap-1.5">
            <Icon
              name={segment.kind === 'text' ? 'text' : 'layout'}
              size={13}
              className={active ? 'text-accent' : 'text-secondary'}
            />
            <span className={`truncate text-[13px] ${active ? 'font-medium text-primary' : 'text-primary'}`}>
              {segment.title || 'Untitled segment'}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 pl-[19px] text-[11px] text-secondary">
            <span className="shrink-0 whitespace-nowrap tabular">{segment.durationMin} min</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">
              {segment.kind === 'text' ? 'Text' : ACTIVITY_LABELS[segment.activityType]}
            </span>
          </span>
        </button>
        <button
          type="button"
          className="icon-btn h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-danger"
          aria-label={`Delete ${segment.title}`}
          onClick={onDelete}
        >
          <Icon name="trash" size={12} />
        </button>
      </div>
    </li>
  );
}

export function SegmentOutline() {
  const segments = useLessonStore((state) => state.lesson?.segments ?? EMPTY_SEGMENTS);
  const periodMinutes = useLessonStore((state) => state.lesson?.durationMin ?? 0);
  const addTextSegment = useLessonStore((state) => state.addTextSegment);
  const addLayoutSegment = useLessonStore((state) => state.addLayoutSegment);
  const removeSegment = useLessonStore((state) => state.removeSegment);
  const moveSegment = useLessonStore((state) => state.moveSegment);

  const activeSegmentId = useUiStore((state) => state.activeSegmentId);
  const setActiveSegment = useUiStore((state) => state.setActiveSegment);
  const notify = useUiStore((state) => state.notify);

  const [addMenu, setAddMenu] = useState<'text' | 'layout' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      moveSegment(String(active.id), String(over.id));
    }
  };

  const handleAddText = (templateId: TextTemplateId = 'blank') => {
    const id = addTextSegment(templateId);
    if (id) setActiveSegment(id);
    setAddMenu(null);
  };

  const handleAddLayout = (activity: ActivityType) => {
    const id = addLayoutSegment(activity);
    if (id) setActiveSegment(id);
    setAddMenu(null);
  };

  const handleDelete = (segment: Segment) => {
    const index = segments.findIndex((candidate) => candidate.id === segment.id);
    removeSegment(segment.id);
    if (activeSegmentId === segment.id) {
      const next = segments[index + 1] ?? segments[index - 1] ?? null;
      setActiveSegment(next ? next.id : null);
    }
    notify('Segment removed. Undo with ⌘Z.', 'info');
  };

  const planned = totalMinutes(segments);
  const over = periodMinutes > 0 && planned > periodMinutes;
  const fill = periodMinutes > 0 ? Math.min(100, (planned / periodMinutes) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-default px-4 py-3">
        <div>
          <h2 className="panel-title">Lesson flow</h2>
          <p className="text-[11px] text-secondary">
            {segments.length} {segments.length === 1 ? 'segment' : 'segments'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              className="icon-btn"
              title="Add text segment"
              aria-label="Add text segment"
              aria-haspopup="menu"
              aria-expanded={addMenu === 'text'}
              onClick={() => setAddMenu((current) => (current === 'text' ? null : 'text'))}
            >
              <Icon name="plus" size={16} />
            </button>
            {addMenu === 'text' && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setAddMenu(null)} aria-hidden="true" />
                <div className="absolute left-0 top-8 z-30 w-72 rounded-md border border-default bg-elevated p-1.5 shadow-lg">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-secondary">
                    Text segment template
                  </p>
                  <div className="max-h-80 overflow-y-auto">
                    {TEXT_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className="flex w-full items-start justify-between gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-page"
                        onClick={() => handleAddText(template.id)}
                      >
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium">{template.name}</span>
                          <span className="block text-[11px] leading-snug text-secondary">
                            {template.description}
                          </span>
                        </span>
                        <span className="shrink-0 pt-0.5 text-[10px] tabular text-secondary">
                          {template.durationMin} min
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              className="icon-btn"
              title="Add layout segment"
              aria-label="Add layout segment"
              aria-haspopup="menu"
              aria-expanded={addMenu === 'layout'}
              onClick={() => setAddMenu((current) => (current === 'layout' ? null : 'layout'))}
            >
              <Icon name="layout" size={16} />
            </button>
            {addMenu === 'layout' && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setAddMenu(null)} aria-hidden="true" />
                <div className="absolute left-0 top-8 z-30 w-60 rounded-md border border-default bg-elevated p-1.5 shadow-lg">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-secondary">
                    Layout template
                  </p>
                  <div className="max-h-72 overflow-y-auto">
                    {LAYOUT_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left hover:bg-page"
                        onClick={() => handleAddLayout(template.id)}
                      >
                        <span className="text-[13px] font-medium">{template.name}</span>
                        <span className="text-[11px] leading-snug text-secondary">{template.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {segments.length === 0 ? (
          <div className="mx-2 my-6 rounded-md border border-dashed border-strong p-4 text-center">
            <p className="text-sm text-secondary">
              Add a text segment for an opening or exit ticket, or a layout segment for a spatial activity.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAddText('blank')}>
                <Icon name="text" size={14} />
                Add text segment
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddMenu('layout')}>
                <Icon name="layout" size={14} />
                Add layout segment
              </button>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={segments.map((segment) => segment.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {segments.map((segment) => (
                  <SortableSegment
                    key={segment.id}
                    segment={segment}
                    active={segment.id === activeSegmentId}
                    onSelect={() => setActiveSegment(segment.id)}
                    onDelete={() => handleDelete(segment)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="border-t border-default px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary">Planned</span>
          <span className={`tabular ${over ? 'font-medium text-warning' : 'text-secondary'}`}>
            {planned} / {periodMinutes} min
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-default" role="presentation">
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${over ? 'bg-warning' : 'bg-accent'}`}
            style={{ width: `${fill}%` }}
          />
        </div>
        {over ? (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning">
            <Icon name="warning" size={11} />
            {planned - periodMinutes} min over the period
          </p>
        ) : null}
      </div>
    </div>
  );
}
