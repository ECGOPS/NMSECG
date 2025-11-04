import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type StoreName = 'vitAssets' | 'vitInspections' | 'pendingSync';

interface ECGNMSDatabase extends DBSchema {
  vitAssets: {
    key: string;
    value: any;
  };
  vitInspections: {
    key: string;
    value: any;
  };
  pendingSync: {
    key: string;
    value: {
      storeName: StoreName;
      operation: 'create' | 'update' | 'delete';
      data: any;
      timestamp: number;
    };
  };
}

let db: IDBPDatabase<ECGNMSDatabase> | null = null;

const DB_NAME = 'ecg-nms-db';
const DB_VERSION = 1;

export async function initDB() {
  if (db) return db;

  db = await openDB<ECGNMSDatabase>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Create object stores
      if (!database.objectStoreNames.contains('vitAssets')) {
        database.createObjectStore('vitAssets', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('vitInspections')) {
        database.createObjectStore('vitInspections', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('pendingSync')) {
        database.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
      }
    },
  });

  return db;
}

export async function getAllItems(storeName: StoreName) {
  const database = await initDB();
  return database.getAll(storeName);
}

export async function getItem(storeName: StoreName, id: string) {
  const database = await initDB();
  return database.get(storeName, id);
}

export async function addItem(storeName: StoreName, item: any) {
  const database = await initDB();
  return database.add(storeName, item);
}

export async function updateItem(storeName: StoreName, item: any) {
  const database = await initDB();
  return database.put(storeName, item);
}

export async function deleteItem(storeName: StoreName, id: string) {
  const database = await initDB();
  return database.delete(storeName, id);
}

export async function addToPendingSync(storeName: StoreName, operation: 'create' | 'update' | 'delete', data: any) {
  const database = await initDB();
  return database.add('pendingSync', {
    storeName,
    operation,
    data,
    timestamp: Date.now()
  });
}

export async function clearStore(storeName: StoreName) {
  const database = await initDB();
  return database.clear(storeName);
}

export async function getAllPendingSync() {
  const database = await initDB();
  return database.getAll('pendingSync');
}

export async function deletePendingSync(id: number) {
  const database = await initDB();
  return database.delete('pendingSync', IDBKeyRange.only(id));
} 