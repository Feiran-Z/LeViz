import { useEffect } from 'react';
import { useStore } from 'zustand';
import { useLessonStore } from '../stores/lessonStore';
import { useRosterStore } from '../stores/rosterStore';

export function undoLesson(): void {
  const temporal = useLessonStore.temporal.getState();
  if (temporal.pastStates.length === 0) return;
  temporal.undo();
  useLessonStore.getState().markDirty();
}

export function redoLesson(): void {
  const temporal = useLessonStore.temporal.getState();
  if (temporal.futureStates.length === 0) return;
  temporal.redo();
  useLessonStore.getState().markDirty();
}

export function undoRoster(): void {
  const temporal = useRosterStore.temporal.getState();
  if (temporal.pastStates.length === 0) return;
  temporal.undo();
  useLessonStore.getState().markDirty();
}

export function redoRoster(): void {
  const temporal = useRosterStore.temporal.getState();
  if (temporal.futureStates.length === 0) return;
  temporal.redo();
  useLessonStore.getState().markDirty();
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

/** Cmd/Ctrl+Z routes to the document history unless the user is typing. */
export function useUndoRedoHotkeys(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if (isTextEntry(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) redoLesson();
      else undoLesson();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

export function useLessonHistory(): { canUndo: boolean; canRedo: boolean } {
  const canUndo = useStore(useLessonStore.temporal, (state) => state.pastStates.length > 0);
  const canRedo = useStore(useLessonStore.temporal, (state) => state.futureStates.length > 0);
  return { canUndo, canRedo };
}

export function useRosterHistory(): { canUndo: boolean; canRedo: boolean } {
  const canUndo = useStore(useRosterStore.temporal, (state) => state.pastStates.length > 0);
  const canRedo = useStore(useRosterStore.temporal, (state) => state.futureStates.length > 0);
  return { canUndo, canRedo };
}
