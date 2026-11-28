import { create } from 'zustand';
import {
  planWorkspaceRestore,
  WORKSPACE_KIND,
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceBackup,
  type WorkspaceRestoreMode,
  type WorkspaceRestorePlan,
} from '../domain/workspace';
import { getWorkspaceRepository } from '../repositories';

export interface WorkspaceConflicts {
  lessons: { id: string; title: string }[];
  classes: { id: string; name: string }[];
}

interface WorkspaceState {
  createBackup: () => Promise<WorkspaceBackup>;
  inspect: (backup: WorkspaceBackup) => Promise<WorkspaceConflicts>;
  restore: (
    backup: WorkspaceBackup,
    mode: WorkspaceRestoreMode,
  ) => Promise<WorkspaceRestorePlan>;
}

/**
 * L3 — cross-aggregate backup use cases. The restore write is one workspace
 * repository transaction; pages refresh the lesson/class stores afterwards.
 */
export const useWorkspaceStore = create<WorkspaceState>()(() => ({
  createBackup: async () => {
    const { lessons, classes } = await getWorkspaceRepository().readAll();
    return {
      kind: WORKSPACE_KIND,
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      lessons,
      classes,
    };
  },

  inspect: async (backup) => {
    const existing = await getWorkspaceRepository().readAll();
    const lessonIds = new Set(existing.lessons.map((lesson) => lesson.id));
    const classIds = new Set(existing.classes.map((roster) => roster.id));
    return {
      lessons: backup.lessons
        .filter((lesson) => lessonIds.has(lesson.id))
        .map((lesson) => ({ id: lesson.id, title: lesson.title })),
      classes: backup.classes
        .filter((roster) => classIds.has(roster.id))
        .map((roster) => ({ id: roster.id, name: roster.name })),
    };
  },

  restore: async (backup, mode) => {
    const existing = await getWorkspaceRepository().readAll();
    const plan = planWorkspaceRestore(
      backup,
      new Set(existing.lessons.map((lesson) => lesson.id)),
      existing.classes,
      mode,
    );
    await getWorkspaceRepository().saveAll({
      lessons: plan.lessons,
      classes: plan.classes,
    });
    return plan;
  },
}));
