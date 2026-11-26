import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLessonStore } from '../stores/lessonStore';
import { useUiStore } from '../stores/uiStore';

/**
 * Cursor-following preview of a furniture note. Pointer-only; the note remains
 * editable via double-click or the inspector.
 */
export function NodeNoteTooltip() {
  const hover = useUiStore((state) => state.nodeHover);
  const node = useLessonStore((state) => {
    if (!hover) return null;
    const lesson = state.lesson;
    if (!lesson) return null;
    for (const segment of lesson.segments) {
      if (segment.kind !== 'layout') continue;
      const found = segment.canvas.nodes.find((candidate) => candidate.id === hover.nodeId);
      if (found) return found;
    }
    return null;
  });

  const note = node?.note ?? null;
  const elementRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!hover) return;
    const element = elementRef.current;
    const width = element?.offsetWidth ?? 288;
    const height = element?.offsetHeight ?? 160;
    const margin = 12;
    const offset = 16;
    let left = hover.clientX + offset;
    let top = hover.clientY + offset;
    if (left + width > window.innerWidth - margin) left = hover.clientX - width - offset;
    if (top + height > window.innerHeight - margin) top = hover.clientY - height - offset;
    const next = {
      left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
    };
    setPosition((current) =>
      current.left === next.left && current.top === next.top ? current : next,
    );
  }, [hover, note]);

  if (!hover || !node || !note || (!note.title.trim() && !note.body.trim())) return null;

  return createPortal(
    <div
      ref={elementRef}
      role="tooltip"
      style={{ left: position.left, top: position.top }}
      className="pointer-events-none fixed z-40 w-72 max-w-[calc(100vw-24px)] rounded-md border border-default bg-elevated p-3 shadow-lg"
    >
      <p className="truncate text-[10px] font-medium uppercase tracking-[0.06em] text-secondary">
        {node.label}
      </p>
      {note.title ? (
        <p className="mt-0.5 break-words text-sm font-medium leading-snug text-primary">{note.title}</p>
      ) : null}
      {note.body ? (
        <p className="mt-1 max-h-52 overflow-hidden whitespace-pre-wrap break-words text-xs leading-relaxed text-secondary">
          {note.body}
        </p>
      ) : null}
      <p className="mt-2 text-[10px] text-placeholder">Double-click to edit the note</p>
    </div>,
    document.body,
  );
}
