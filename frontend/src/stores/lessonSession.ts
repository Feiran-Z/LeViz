import { resolveClassSize } from '../domain/lesson';
import type { Lesson } from '../domain/types';
import { getLessonRepository } from '../repositories';
import { useLessonStore } from './lessonStore';
import { useRosterStore } from './rosterStore';

/**
 * L3 session use-cases. Opening a lesson touches both the document store and
 * the roster store; only this module orchestrates that pair, so neither store
 * writes the other's state.
 */

let requestToken = 0;

export async function openLesson(id: string): Promise<void> {
  const token = ++requestToken;
  useLessonStore.getState().beginLoad();
  try {
    const lesson = await getLessonRepository().getLesson(id);
    if (token !== requestToken) return;
    if (!lesson) {
      useRosterStore.getState().load([]);
      useLessonStore.getState().hydrate(null, 'missing');
      return;
    }
    // Documents saved before classSize existed infer it from the roster.
    const normalized: Lesson = {
      ...lesson,
      classSize: resolveClassSize(lesson.classSize, lesson.roster.length),
    };
    useRosterStore.getState().load(normalized.roster);
    useLessonStore.getState().hydrate(normalized, 'ready');
  } catch (cause) {
    if (token !== requestToken) return;
    useRosterStore.getState().load([]);
    useLessonStore
      .getState()
      .hydrate(null, 'error', cause instanceof Error ? cause.message : 'Could not load lesson.');
  }
}

export function closeLesson(): void {
  const token = ++requestToken;
  const state = useLessonStore.getState();
  if (state.status === 'ready') void state.save();

  // Defer clearing by one task: child editors flush debounced content in their
  // own unmount cleanup, which React runs after this parent cleanup. The second
  // save captures that late flush. If another lesson opens first, the token
  // changes and the old state is simply replaced by hydrate.
  setTimeout(() => {
    if (token !== requestToken) return;
    const latest = useLessonStore.getState();
    if (latest.status === 'ready') void latest.save();
    latest.hydrate(null, 'idle');
    useRosterStore.getState().load([]);
  }, 0);
}
