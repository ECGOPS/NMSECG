import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { apiRequest } from '@/lib/api';

// Remove Firebase Auth import comments

interface OfflineRecord {
  id: string;
  data: any;
  timestamp: number;
  syncStatus: 'pending' | 'synced' | 'failed';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
}

interface DBSchemaWithOffline extends DBSchema {
  offlineRecords: {
    key: string;
    value: OfflineRecord;
  };
  substationInspections: {
    key: string;
    value: any;
  };
  loadMonitoring: {
    key: string;
    value: any;
  };
}

export class OfflineStorageService {
  private static instance: OfflineStorageService;
  private db: IDBPDatabase<DBSchemaWithOffline> | null = null;
  private readonly DB_NAME = 'ecg-offline-db';
  private readonly DB_VERSION = 1;

  private constructor() {}

  public static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService();
    }
    return OfflineStorageService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      this.db = await openDB<DBSchemaWithOffline>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create object stores
          if (!db.objectStoreNames.contains('offlineRecords')) {
            db.createObjectStore('offlineRecords', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('substationInspections')) {
            db.createObjectStore('substationInspections', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('loadMonitoring')) {
            db.createObjectStore('loadMonitoring', { keyPath: 'id' });
          }
        },
      });
    } catch (error) {
      console.error('Error initializing offline storage:', error);
      throw error;
    }
  }

  public async saveOfflineRecord(endpoint: string, method: 'POST' | 'PUT' | 'DELETE', data: any): Promise<string> {
    if (!this.db) {
      await this.initialize();
    }

    const record: OfflineRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
      timestamp: Date.now(),
      syncStatus: 'pending',
      endpoint,
      method,
    };

    await this.db!.add('offlineRecords', record);
    return record.id;
  }

  public async getOfflineRecords(): Promise<OfflineRecord[]> {
    if (!this.db) {
      await this.initialize();
    }

    return await this.db!.getAll('offlineRecords');
  }

  public async syncOfflineRecords(): Promise<void> {
    if (!navigator.onLine) {
      return;
    }

    const records = await this.getOfflineRecords();
    const pendingRecords = records.filter(record => record.syncStatus === 'pending');

    for (const record of pendingRecords) {
      try {
        await apiRequest(record.endpoint, {
          method: record.method,
          body: JSON.stringify(record.data),
        });

        // Mark as synced
        await this.db!.put('offlineRecords', {
          ...record,
          syncStatus: 'synced',
        });
      } catch (error) {
        console.error('Error syncing offline record:', error);
        
        // Mark as failed
        await this.db!.put('offlineRecords', {
          ...record,
          syncStatus: 'failed',
        });
      }
    }
  }

  public async clearSyncedRecords(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const records = await this.getOfflineRecords();
    const syncedRecords = records.filter(record => record.syncStatus === 'synced');

    for (const record of syncedRecords) {
      await this.db!.delete('offlineRecords', record.id);
    }
  }

  public async saveSubstationInspection(inspection: any): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    await this.db!.put('substationInspections', inspection);
  }

  public async getSubstationInspections(): Promise<any[]> {
    if (!this.db) {
      await this.initialize();
    }

    return await this.db!.getAll('substationInspections');
  }

  public async saveLoadMonitoring(record: any): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    await this.db!.put('loadMonitoring', record);
  }

  public async getLoadMonitoring(): Promise<any[]> {
    if (!this.db) {
      await this.initialize();
    }

    return await this.db!.getAll('loadMonitoring');
  }

  public isOnline(): boolean {
    return navigator.onLine;
  }
}

export const offlineStorageService = OfflineStorageService.getInstance(); 