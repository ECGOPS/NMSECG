import { LoadMonitoringData } from '@/lib/asset-types';
import { apiRequest } from '@/lib/api';

export interface PendingLoadMonitoring {
  id: string;
  record: LoadMonitoringData;
  action: 'create' | 'update' | 'delete';
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  lastSyncAttempt?: number;
}

export class OfflineLoadMonitoringService {
  private static instance: OfflineLoadMonitoringService;
  private db: IDBDatabase | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private syncQueue: Promise<void> = Promise.resolve();

  private constructor() {
    this.setupOnlineStatusListener();
    // Don't call initializeDatabase here - it will be called when needed
  }

  public static getInstance(): OfflineLoadMonitoringService {
    if (!OfflineLoadMonitoringService.instance) {
      OfflineLoadMonitoringService.instance = new OfflineLoadMonitoringService();
    }
    return OfflineLoadMonitoringService.instance;
  }

  private async initializeDatabase(): Promise<void> {
    if (this.db) {
      console.log('[OfflineLoadMonitoring] Database already initialized');
      return;
    }

    try {
      console.log('[OfflineLoadMonitoring] Starting database initialization...');
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('LoadMonitoringOfflineDB', 1);
        
        request.onerror = () => {
          console.error('[OfflineLoadMonitoring] Failed to open database');
          reject(new Error('Failed to open database'));
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          console.log('[OfflineLoadMonitoring] Database initialized successfully');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          console.log('[OfflineLoadMonitoring] Database upgrade needed, creating object stores...');
          
          // Create object stores
          if (!db.objectStoreNames.contains('pendingRecords')) {
            const pendingStore = db.createObjectStore('pendingRecords', { keyPath: 'id' });
            pendingStore.createIndex('action', 'action', { unique: false });
            pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
            pendingStore.createIndex('retryCount', 'retryCount', { unique: false });
            console.log('[OfflineLoadMonitoring] Object stores created successfully');
          }
        };
      });
    } catch (error) {
      console.error('[OfflineLoadMonitoring] Database initialization failed:', error);
      throw error;
    }
  }

  private setupOnlineStatusListener(): void {
    window.addEventListener('online', () => {
      console.log('[OfflineLoadMonitoring] Network connection restored');
      this.isOnline = true;
      this.syncPendingRecords();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineLoadMonitoring] Network connection lost');
      this.isOnline = false;
    });
  }

  public async isInternetAvailable(): Promise<boolean> {
    // Do a real network connectivity check instead of just relying on navigator.onLine
    try {
      const response = await fetch('/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });
      
      const isActuallyOnline = response.ok;
      if (this.isOnline !== isActuallyOnline) {
        this.isOnline = isActuallyOnline;
        console.log(`[OfflineLoadMonitoring] Network status updated: ${isActuallyOnline ? 'online' : 'offline'}`);
      }
      
      return isActuallyOnline;
    } catch (error) {
      if (this.isOnline !== false) {
        this.isOnline = false;
        console.log('[OfflineLoadMonitoring] Network status updated: offline');
      }
      return false;
    }
  }

  private async ensureDatabaseReady(): Promise<void> {
    if (!this.db) {
      console.log('[OfflineLoadMonitoring] Database not ready, initializing...');
      await this.initializeDatabase();
    }
  }

  public async isDatabaseReady(): Promise<boolean> {
    try {
      await this.ensureDatabaseReady();
      return true;
    } catch (error) {
      console.error('[OfflineLoadMonitoring] Database not ready:', error);
      return false;
    }
  }

  public async saveOffline(
    record: LoadMonitoringData, 
    action: 'create' | 'update' | 'delete'
  ): Promise<string> {
    console.log('[OfflineLoadMonitoring] Attempting to save offline:', { action, recordId: record.id });
    
    await this.ensureDatabaseReady();

    const pendingRecord: PendingLoadMonitoring = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      record,
      action,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3
    };

    console.log('[OfflineLoadMonitoring] Created pending record:', pendingRecord);

    try {
      const transaction = this.db!.transaction(['pendingRecords'], 'readwrite');
      const store = transaction.objectStore('pendingRecords');
      
      console.log('[OfflineLoadMonitoring] Starting database transaction...');
      await store.add(pendingRecord);
      
      console.log('[OfflineLoadMonitoring] Record saved offline successfully:', pendingRecord.id);
      
      // Verify the save by reading it back
      const savedRecord = await store.get(pendingRecord.id);
      console.log('[OfflineLoadMonitoring] Verification - saved record:', savedRecord);
      
      return pendingRecord.id;
    } catch (error) {
      console.error('[OfflineLoadMonitoring] Failed to save offline:', error);
      throw error;
    }
  }

  public async getPendingRecords(): Promise<PendingLoadMonitoring[]> {
    console.log('[OfflineLoadMonitoring] Getting pending records...');
    
    await this.ensureDatabaseReady();

    try {
      const transaction = this.db!.transaction(['pendingRecords'], 'readonly');
      const store = transaction.objectStore('pendingRecords');
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('[OfflineLoadMonitoring] Retrieved pending records:', request.result);
          resolve(request.result);
        };
        request.onerror = () => {
          console.error('[OfflineLoadMonitoring] Failed to get pending records:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[OfflineLoadMonitoring] Failed to get pending records:', error);
      return [];
    }
  }

  public async getPendingRecordsByAction(action: 'create' | 'update' | 'delete'): Promise<PendingLoadMonitoring[]> {
    await this.ensureDatabaseReady();

    try {
      const transaction = this.db!.transaction(['pendingRecords'], 'readonly');
      const store = transaction.objectStore('pendingRecords');
      const index = store.index('action');
      const request = index.getAll(action);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[OfflineLoadMonitoring] Failed to get pending records by action:', error);
      return [];
    }
  }

  public async removePendingRecord(id: string): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      const transaction = this.db!.transaction(['pendingRecords'], 'readwrite');
      const store = transaction.objectStore('pendingRecords');
      await store.delete(id);
      
      console.log('[OfflineLoadMonitoring] Pending record removed:', id);
    } catch (error) {
      console.error('[OfflineLoadMonitoring] Failed to remove pending record:', error);
      throw error;
    }
  }

  public async updateRetryCount(id: string, retryCount: number, errorMessage?: string): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      const transaction = this.db!.transaction(['pendingRecords'], 'readwrite');
      const store = transaction.objectStore('pendingRecords');
      const request = store.get(id);
      
      request.onsuccess = async () => {
        const record = request.result;
        if (record) {
          record.retryCount = retryCount;
          record.errorMessage = errorMessage;
          record.lastSyncAttempt = Date.now();
          await store.put(record);
        }
      };
    } catch (error) {
      console.error('[OfflineLoadMonitoring] Failed to update retry count:', error);
      throw error;
    }
  }

  public async syncRecords(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      console.log('[OfflineLoadMonitoring] Sync skipped - in progress:', this.syncInProgress, 'online:', this.isOnline);
      return;
    }

    this.syncInProgress = true;
    this.syncQueue = this.syncQueue.then(async () => {
      try {
        const pendingRecords = await this.getPendingRecords();
        console.log('[OfflineLoadMonitoring] Found', pendingRecords.length, 'records to sync');
        
        for (const pendingRecord of pendingRecords) {
          try {
            if (pendingRecord.retryCount >= pendingRecord.maxRetries) {
              console.warn('[OfflineLoadMonitoring] Max retries reached for record:', pendingRecord.id);
              continue;
            }

            await this.syncRecord(pendingRecord);
            
            // Remove from pending records after successful sync
            await this.removePendingRecord(pendingRecord.id);
            
            console.log(`[OfflineLoadMonitoring] Successfully synced record ${pendingRecord.id}`);
          } catch (error) {
            console.error(`[OfflineLoadMonitoring] Failed to sync record ${pendingRecord.id}:`, error);
            
            // Update retry count
            const newRetryCount = pendingRecord.retryCount + 1;
            await this.updateRetryCount(pendingRecord.id, newRetryCount, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      } finally {
        this.syncInProgress = false;
        console.log('[OfflineLoadMonitoring] Sync completed');
      }
    });

    return this.syncQueue;
  }

  private async syncRecord(pendingRecord: PendingLoadMonitoring): Promise<void> {
    const { record, action } = pendingRecord;
    
    try {
      let result;
      
      switch (action) {
                 case 'create':
           result = await apiRequest('/api/monitoring', {
             method: 'POST',
             body: JSON.stringify(record)
           });
           break;
           
         case 'update':
           result = await apiRequest(`/api/monitoring/${record.id}`, {
             method: 'PUT',
             body: JSON.stringify(record)
           });
           break;
           
         case 'delete':
           result = await apiRequest(`/api/monitoring/${record.id}`, {
             method: 'DELETE'
           });
           break;
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      console.log(`[OfflineLoadMonitoring] ${action} operation successful:`, result);
      
    } catch (error) {
      console.error(`[OfflineLoadMonitoring] ${action} operation failed:`, error);
      throw error;
    }
  }

  public async syncPendingRecords(): Promise<void> {
    return this.syncRecords();
  }

  public async getPendingCount(): Promise<number> {
    const pendingRecords = await this.getPendingRecords();
    return pendingRecords.length;
  }

  public async clearAllPendingRecords(): Promise<void> {
    await this.ensureDatabaseReady();

    try {
      const transaction = this.db!.transaction(['pendingRecords'], 'readwrite');
      const store = transaction.objectStore('pendingRecords');
      await store.clear();
      
      console.log('[OfflineLoadMonitoring] All pending records cleared');
    } catch (error) {
      console.error('[OfflineLoadMonitoring] Failed to clear pending records:', error);
      throw error;
    }
  }
}
