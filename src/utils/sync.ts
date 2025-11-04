import { apiRequest } from '@/lib/api';

export interface SyncRecord {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export class SyncService {
  private static instance: SyncService;
  private syncQueue: SyncRecord[] = [];
  private isSyncing: boolean = false;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  private constructor() {
    this.setupOnlineStatusListener();
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  private setupOnlineStatusListener() {
    window.addEventListener('online', () => {
      console.log('Network connection restored, starting sync...');
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost');
    });
  }

  public async addToSyncQueue(endpoint: string, method: 'POST' | 'PUT' | 'DELETE', data: any): Promise<string> {
    const record: SyncRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.maxRetries
    };

    this.syncQueue.push(record);
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      this.processSyncQueue();
    }

    return record.id;
  }

  public async processSyncQueue(): Promise<void> {
    if (this.isSyncing || !navigator.onLine || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      const recordsToProcess = [...this.syncQueue];
      
      for (const record of recordsToProcess) {
        try {
          await apiRequest(record.endpoint, {
            method: record.method,
            body: JSON.stringify(record.data),
          });

          // Remove from queue on success
          this.syncQueue = this.syncQueue.filter(r => r.id !== record.id);
          console.log(`Successfully synced record ${record.id}`);
        } catch (error) {
          console.error(`Error syncing record ${record.id}:`, error);
          
          record.retryCount++;
          
          if (record.retryCount >= record.maxRetries) {
            // Remove from queue after max retries
            this.syncQueue = this.syncQueue.filter(r => r.id !== record.id);
            console.error(`Record ${record.id} failed after ${record.maxRetries} retries`);
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, this.retryDelay * record.retryCount));
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  public getQueueLength(): number {
    return this.syncQueue.length;
  }

  public getQueueStatus(): SyncRecord[] {
    return [...this.syncQueue];
  }

  public clearQueue(): void {
    this.syncQueue = [];
  }

  public isOnline(): boolean {
    return navigator.onLine;
  }
}

export const syncService = SyncService.getInstance(); 