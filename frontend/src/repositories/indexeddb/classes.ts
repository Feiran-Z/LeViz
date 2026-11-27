import type { IDBPDatabase } from 'idb';
import type { ClassRoster } from '../../domain/types';
import type { ClassRosterRepository } from '../types';
import { openLevizDb, type LevizDB } from './db';

/** IndexedDB-backed class roster library. */
export class IndexedDbClassRosterRepository implements ClassRosterRepository {
  private readonly dbPromise: Promise<IDBPDatabase<LevizDB>>;

  constructor(dbName = 'leviz') {
    this.dbPromise = openLevizDb(dbName);
  }

  async listClasses(): Promise<ClassRoster[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex('classes', 'by-name');
  }

  async getClass(id: string): Promise<ClassRoster | null> {
    const db = await this.dbPromise;
    return (await db.get('classes', id)) ?? null;
  }

  async saveClass(classRoster: ClassRoster): Promise<ClassRoster> {
    const db = await this.dbPromise;
    await db.put('classes', structuredClone(classRoster));
    return classRoster;
  }

  async deleteClass(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('classes', id);
  }
}
