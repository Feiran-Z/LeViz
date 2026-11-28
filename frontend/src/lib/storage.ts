/** Browser storage protection for the local-only lesson library. */

export type StoragePersistenceState = 'persisted' | 'best-effort' | 'unsupported';

function storageManager(): StorageManager | null {
  return typeof navigator !== 'undefined' && navigator.storage ? navigator.storage : null;
}

export async function getStoragePersistence(): Promise<StoragePersistenceState> {
  const storage = storageManager();
  if (!storage || typeof storage.persisted !== 'function') return 'unsupported';
  try {
    return (await storage.persisted()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}

/**
 * Ask the browser not to evict IndexedDB. Best called from a user gesture
 * (the preview gate) and safe to call again later.
 */
export async function requestPersistentStorage(): Promise<StoragePersistenceState> {
  const storage = storageManager();
  if (!storage || typeof storage.persist !== 'function') return 'unsupported';
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) {
      return 'persisted';
    }
    return (await storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}
