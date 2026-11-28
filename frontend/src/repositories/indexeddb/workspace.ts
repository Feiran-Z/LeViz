import type { IDBPDatabase } from 'idb';
import type { WorkspaceContents, WorkspaceRepository } from '../types';
import { openLevizDb, type LevizDB } from './db';

/**
 * Whole-workspace access over the existing lessons and classes stores. The
 * restore write runs in one IndexedDB transaction so it is all-or-nothing.
 */
export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  private readonly dbPromise: Promise<IDBPDatabase<LevizDB>>;

  constructor(dbName = 'leviz') {
    this.dbPromise = openLevizDb(dbName);
  }

  async readAll(): Promise<WorkspaceContents> {
    const db = await this.dbPromise;
    const [lessons, classes] = await Promise.all([
      db.getAll('lessons'),
      db.getAllFromIndex('classes', 'by-name'),
    ]);
    return { lessons, classes };
  }

  async saveAll({ lessons, classes }: WorkspaceContents): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(['lessons', 'classes'], 'readwrite');
    await Promise.all([
      ...lessons.map((lesson) => tx.objectStore('lessons').put(structuredClone(lesson))),
      ...classes.map((roster) => tx.objectStore('classes').put(structuredClone(roster))),
      tx.done,
    ]);
  }
}
