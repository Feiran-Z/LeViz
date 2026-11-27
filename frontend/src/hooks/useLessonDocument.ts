import { useEffect } from 'react';
import { closeLesson, openLesson } from '../stores/lessonSession';
import { useUiStore } from '../stores/uiStore';

/**
 * Load a lesson for a full-page route. Editors save on close; read-only pages
 * such as teach mode pass `saveOnClose: false`.
 */
export function useLessonDocument(
  lessonId: string | undefined,
  options: { saveOnClose: boolean },
): void {
  useEffect(() => {
    if (!lessonId) return undefined;
    useUiStore.getState().resetForLesson();
    void openLesson(lessonId);
    return () => {
      useUiStore.getState().setNodeHover(null);
      closeLesson({ save: options.saveOnClose });
    };
  }, [lessonId, options.saveOnClose]);
}
