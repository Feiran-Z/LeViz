import { useEffect } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { useRosterStore } from '../stores/rosterStore';

const AUTOSAVE_DELAY_MS = 900;

/**
 * Debounced persistence: one save per idle burst of edits, plus a flush when
 * the tab is hidden. Persistence never blocks editing (architecture §5.2).
 */
export function useAutosave(): void {
  useEffect(() => {
    let timer: number | undefined;
    let pending = false;

    const flush = () => {
      if (!pending) return;
      pending = false;
      window.clearTimeout(timer);
      void useLessonStore.getState().save();
    };

    const schedule = () => {
      pending = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
    };

    const unsubscribeLesson = useLessonStore.subscribe((state, previous) => {
      if (state.status === 'ready' && state.docRevision !== previous.docRevision) schedule();
    });

    const unsubscribeRoster = useRosterStore.subscribe((state, previous) => {
      if (state.revision !== previous.revision && useLessonStore.getState().status === 'ready') schedule();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    const onPageHide = () => flush();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearTimeout(timer);
      unsubscribeLesson();
      unsubscribeRoster();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);
}
