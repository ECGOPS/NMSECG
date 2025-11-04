import { openDB, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

// Define store names as a type
export type StoreName =
  | 'op5Faults'
  | 'op5Faults-cache'
  | 'controlOutages'
  | 'controlOutages-cache'
  | 'loadMonitoring'
  | 'loadMonitoring-cache'
  | 'vitAssets'
  | 'vitAssets-cache'
  | 'vitInspections'
  | 'vitInspections-cache'
  | 'substationInspections'
  | 'overheadLineInspections'
  | 'overheadLineInspections-cache'
  | 'pendingSync'
  | 'districts'
  | 'districts-cache'
  | 'regions'
  | 'regions-cache'
  | 'devices'
  | 'devices-cache'
  | 'permissions'
  | 'permissions-cache'
  | 'staffIds'
  | 'staffIds-cache'
  | 'system'
  | 'system-cache'
  | 'users'
  | 'users-cache';

let db: IDBPDatabase | null = null;
let isInitializing = false;
let initPromise: Promise<IDBPDatabase> | null = null;

export async function initDB() {
  if (initPromise) {
    return initPromise;
  }

  if (!db) {
    isInitializing = true;
    initPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('Starting database initialization...');
        
        // Create new database with version 5
        db = await openDB('ecg-nms-db', 5, {
          upgrade(db, oldVersion, newVersion) {
            console.log(`Upgrading database from version ${oldVersion} to ${newVersion}...`);
            
            // Create all stores if they don't exist
            const stores: StoreName[] = [
              'op5Faults',
              'op5Faults-cache',
              'controlOutages',
              'controlOutages-cache',
              'loadMonitoring',
              'loadMonitoring-cache',
              'vitAssets',
              'vitAssets-cache',
              'vitInspections',
              'vitInspections-cache',
              'substationInspections',
              'overheadLineInspections',
              'overheadLineInspections-cache',
              'pendingSync',
              'districts',
              'districts-cache',
              'regions',
              'regions-cache',
              'devices',
              'devices-cache',
              'permissions',
              'permissions-cache',
              'staffIds',
              'staffIds-cache',
              'system',
              'system-cache',
              'users',
              'users-cache'
            ];

            // Delete existing stores to ensure clean state
            Array.from(db.objectStoreNames).forEach(storeName => {
              db.deleteObjectStore(storeName);
            });

            // Create all stores fresh
            stores.forEach(storeName => {
              console.log(`Creating store: ${storeName}`);
              const store = db.createObjectStore(storeName, { keyPath: 'id' });
              
              // Add appropriate indexes based on store type
              switch (storeName) {
                case 'op5Faults':
                case 'op5Faults-cache':
                case 'controlOutages':
                case 'controlOutages-cache':
                  store.createIndex('by-date', 'occurrenceDate');
                  break;
                case 'vitAssets':
                case 'vitAssets-cache':
                  store.createIndex('by-region', 'regionId');
                  break;
                case 'vitInspections':
                case 'vitInspections-cache':
                  store.createIndex('by-asset', 'assetId');
                  store.createIndex('by-date', 'inspectionDate');
                  break;
                case 'substationInspections':
                  store.createIndex('by-date', 'inspectionDate');
                  break;
                case 'loadMonitoring':
                case 'loadMonitoring-cache':
                  store.createIndex('by-date', 'timestamp');
                  break;
                case 'overheadLineInspections':
                case 'overheadLineInspections-cache':
                  store.createIndex('by-date', 'inspectionDate');
                  break;
                case 'pendingSync':
                  store.createIndex('by-timestamp', 'timestamp');
                  break;
                case 'districts':
                case 'districts-cache':
                  store.createIndex('by-region', 'regionId');
                  break;
              }
            });
          },
          blocked() {
            console.log('Database upgrade blocked');
          },
          blocking() {
            console.log('Database upgrade blocking');
          },
          terminated() {
            console.log('Database connection terminated');
            db = null;
            initPromise = null;
            isInitializing = false;
          }
        });

        console.log('Database initialized successfully');
        isInitializing = false;
        resolve(db);
      } catch (error) {
        console.error('Error initializing database:', error);
        isInitializing = false;
        initPromise = null;
        reject(error);
      }
    });
  }
  return initPromise;
}

// Add a function to check if the database is ready
export async function ensureDBReady() {
  if (!db || isInitializing) {
    await initDB();
  }
  return db;
}

async function deleteDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export interface PendingSyncItem {
  id: string;
  type: StoreName;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export async function safeAddItem<T extends BaseRecord>(storeName: StoreName, item: T): Promise<void> {
  const db = await initDB();
  await db.add(storeName, item);
}

export async function safeUpdateItem<T extends BaseRecord>(storeName: StoreName, item: T): Promise<void> {
  const db = await initDB();
  await db.put(storeName, item);
}

export async function safeDeleteItem(storeName: StoreName, itemId: string): Promise<void> {
  const db = await initDB();
  await db.delete(storeName, itemId);
}

export async function safeGetAllItems<T extends BaseRecord>(storeName: StoreName): Promise<T[]> {
  const db = await initDB();
  return db.getAll(storeName);
}

export async function safeGetItem<T extends BaseRecord>(storeName: StoreName, itemId: string): Promise<T | undefined> {
  const db = await initDB();
  return db.get(storeName, itemId);
}

export async function safeClearStore(storeName: StoreName): Promise<void> {
  const db = await initDB();
  await db.clear(storeName);
}

export async function addToPendingSync(storeName: StoreName, action: 'create' | 'update' | 'delete', data: any): Promise<void> {
  const db = await initDB();
  const pendingSyncItem: PendingSyncItem = {
    id: uuidv4(),
    type: storeName,
    action,
    data,
    timestamp: Date.now()
  };
  await db.add('pendingSync', pendingSyncItem);
}

export async function getPendingSyncItems(): Promise<PendingSyncItem[]> {
  const db = await initDB();
  return db.getAll('pendingSync');
}

export async function clearPendingSyncItem(item: PendingSyncItem): Promise<void> {
  const db = await initDB();
  await db.delete('pendingSync', item.id);
}

// Generic CRUD operations for each store
export async function addItem(storeName: StoreName, item: any) {
  try {
    const db = await ensureDBReady();
    if (!db) {
      throw new Error('Database not initialized');
    }
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
    await db.put(storeName, item); // Using put instead of add to handle updates
    console.log(`Successfully added/updated item in ${storeName}:`, item.id);
  } catch (error) {
    console.error(`Error adding item to ${storeName}:`, error);
    throw error;
  }
}

export async function updateItem(storeName: StoreName, item: any) {
  try {
    const db = await ensureDBReady();
    if (!db) {
      throw new Error('Database not initialized');
    }
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
  await db.put(storeName, item);
  await addToPendingSync(storeName, 'update', item);
    console.log(`Successfully updated item in ${storeName}:`, item.id);
  } catch (error) {
    console.error(`Error updating item in ${storeName}:`, error);
    throw error;
  }
}

export async function deleteItem(storeName: StoreName, id: string | number) {
  try {
    const db = await ensureDBReady();
    if (!db) {
      throw new Error('Database not initialized');
    }
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
  await db.delete(storeName, id.toString());
  await addToPendingSync(storeName, 'delete', { id: id.toString() });
    console.log(`Successfully deleted item from ${storeName}:`, id);
  } catch (error) {
    console.error(`Error deleting item from ${storeName}:`, error);
    throw error;
  }
}

export async function getAllItems(storeName: StoreName) {
  try {
    const db = await ensureDBReady();
    if (!db) {
      throw new Error('Database not initialized');
    }
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
    const items = await db.getAll(storeName);
    console.log(`Retrieved ${items.length} items from ${storeName}`);
    return items;
  } catch (error) {
    console.error(`Error getting all items from ${storeName}:`, error);
    throw error;
  }
}

export async function getItem(storeName: StoreName, id: string | number) {
  try {
    const db = await ensureDBReady();
    if (!db) {
      throw new Error('Database not initialized');
    }
    if (!db.objectStoreNames.contains(storeName)) {
      throw new Error(`Store ${storeName} does not exist`);
    }
    const item = await db.get(storeName, id.toString());
    console.log(`Retrieved item from ${storeName}:`, id);
    return item;
  } catch (error) {
    console.error(`Error getting item from ${storeName}:`, error);
    throw error;
  }
} 