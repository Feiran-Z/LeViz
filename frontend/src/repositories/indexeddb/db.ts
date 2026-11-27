import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ClassRoster, Lesson } from '../../domain/types';

export interface LevizDB extends DBSchema {
  lessons: {
    key: string;
    value: Lesson;
    indexes: { 'by-updatedAt': string };
  };
  classes: {
    key: string;
    value: ClassRoster;
    indexes: { 'by-name': string };
  };
}

/** v2 adds the reusable class roster store beside lessons. */
export const DB_VERSION = 2;

/**
 * The one IndexedDB schema in the app. Both repositories open the same
 * database so the v1 → v2 upgrade runs once and keeps existing lessons.
 */
export function openLevizDb(dbName = 'leviz'): Promise<IDBPDatabase<LevizDB>> {
  return openDB<LevizDB>(dbName, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('lessons')) {
        const lessons = db.createObjectStore('lessons', { keyPath: 'id' });
        lessons.createIndex('by-updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('classes')) {
        const classes = db.createObjectStore('classes', { keyPath: 'id' });
        classes.createIndex('by-name', 'name');
      }
    },
  });
}
