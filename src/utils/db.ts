// Client-side IndexedDB wrapper for AuraVault secure storage

export interface VaultFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string; // Base64 representation of file contents (empty or preview for direct cloud files)
  folderId: string | null;
  createdAt: number;
  googleFileId?: string;
  driveEmail?: string;
  note?: string;
}

export interface VaultCredential {
  id: string;
  name: string;
  username: string;
  password: string;
  category: string; // 'social', 'server', 'database', 'financial', 'other'
  website?: string;
  note?: string;
  strength: number; // 0 (weak) to 4 (strong)
  updatedAt: number;
}

export interface VaultSocialHandle {
  id: string;
  platform: string; // 'Twitter', 'Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'Other'
  username: string;
  handleUrl?: string;
  password?: string;
  role: string; // 'admin', 'editor', 'viewer'
  status: 'active' | 'inactive' | 'suspended';
  notes?: string;
  updatedAt: number;
}

export interface VaultFolder {
  id: string;
  name: string;
  createdAt: number;
}

const DB_NAME = 'AuraVaultDB';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Store for files
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
      
      // Store for credentials
      if (!db.objectStoreNames.contains('credentials')) {
        db.createObjectStore('credentials', { keyPath: 'id' });
      }
      
      // Store for social handles
      if (!db.objectStoreNames.contains('socialHandles')) {
        db.createObjectStore('socialHandles', { keyPath: 'id' });
      }
      
      // Store for folders
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
    };
  });
}

export const db = {
  // Generic CRUD helpers
  async getAll<T>(storeName: 'files' | 'credentials' | 'socialHandles' | 'folders'): Promise<T[]> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  },

  async put<T>(storeName: 'files' | 'credentials' | 'socialHandles' | 'folders', item: T): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async delete(storeName: 'files' | 'credentials' | 'socialHandles' | 'folders', id: string): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clearStore(storeName: 'files' | 'credentials' | 'socialHandles' | 'folders'): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
