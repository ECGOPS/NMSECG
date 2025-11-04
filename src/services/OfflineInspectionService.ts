import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { OverheadLineInspection } from '@/lib/types';
import { addOverheadLineInspection } from '@/lib/api';

interface InspectionDB extends DBSchema {
  pendingInspections: {
    key: string;
    value: {
      inspection: Omit<OverheadLineInspection, 'id'>;
      timestamp: number;
      type: 'overhead';
    };
  };
}

interface PendingInspection {
  key: string;
  inspection: Omit<OverheadLineInspection, 'id'>;
  timestamp: number;
  type: 'overhead';
}

export class OfflineInspectionService {
  private static instance: OfflineInspectionService;
  private db: IDBPDatabase<InspectionDB> | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private dbInitialized: boolean = false;
  private syncQueue: Promise<void> = Promise.resolve();
  private offlineInspections: Map<string, OverheadLineInspection> = new Map();

  private constructor() {
    this.initializeDB();
    this.setupOnlineStatusListener();
    this.loadOfflineInspections();
  }

  public static getInstance(): OfflineInspectionService {
    if (!OfflineInspectionService.instance) {
      OfflineInspectionService.instance = new OfflineInspectionService();
    }
    return OfflineInspectionService.instance;
  }

  private async initializeDB() {
    try {
      console.log('[OfflineInspection] Initializing IndexedDB...');
      this.db = await openDB<InspectionDB>('faultmaster-inspections', 1, {
        upgrade(db) {
          console.log('[OfflineInspection] Upgrading database...');
          if (!db.objectStoreNames.contains('pendingInspections')) {
            console.log('[OfflineInspection] Creating pendingInspections store...');
            db.createObjectStore('pendingInspections', { keyPath: 'key' });
          }
        },
      });
      this.dbInitialized = true;
      console.log('[OfflineInspection] Database initialized successfully');
    } catch (error) {
      console.error('[OfflineInspection] Failed to initialize IndexedDB:', error);
      this.dbInitialized = false;
    }
  }

  private setupOnlineStatusListener() {
    window.addEventListener('online', () => {
      console.log('[OfflineInspection] Network connection restored');
      this.isOnline = true;
      this.syncPendingInspections();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineInspection] Network connection lost');
      this.isOnline = false;
    });
  }

  public isInternetAvailable(): boolean {
    return navigator.onLine;
  }

  private async loadOfflineInspections() {
    try {
      const pendingInspections = await this.getPendingInspections();
      pendingInspections.forEach(({ key, inspection }) => {
        this.offlineInspections.set(key, { ...inspection, id: key } as OverheadLineInspection);
      });
      this.notifyOfflineInspectionsUpdate();
    } catch (error) {
      console.error('[OfflineInspection] Error loading offline inspections:', error);
    }
  }

  private notifyOfflineInspectionsUpdate() {
    window.dispatchEvent(new CustomEvent('offlineInspectionsUpdated', {
      detail: {
        inspections: Array.from(this.offlineInspections.values())
      }
    }));
  }

  public getOfflineInspections(): OverheadLineInspection[] {
    return Array.from(this.offlineInspections.values());
  }

  public async saveInspectionOffline(inspection: Omit<OverheadLineInspection, 'id'>): Promise<void> {
    console.log('[OfflineInspection] Attempting to save inspection offline...');
    
    if (!this.dbInitialized) {
      console.log('[OfflineInspection] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.db) {
      console.error('[OfflineInspection] Database not available after initialization');
      throw new Error('Database not initialized');
    }

    const key = `inspection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pendingInspection: PendingInspection = {
      key,
      inspection: {
        ...inspection,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      timestamp: Date.now(),
      type: 'overhead'
    };

    try {
      console.log('[OfflineInspection] Saving inspection with key:', key);
      await this.db.add('pendingInspections', pendingInspection);
      console.log('[OfflineInspection] Inspection saved successfully');

      // Add to local state for immediate UI update
      const newInspection: OverheadLineInspection = {
        ...pendingInspection.inspection,
        id: key
      };
      this.offlineInspections.set(key, newInspection);
      this.notifyOfflineInspectionsUpdate();

      // Dispatch success event
      window.dispatchEvent(new CustomEvent('inspectionAdded', { 
        detail: { 
          inspection: newInspection,
          type: 'overhead',
          status: 'success'
        } 
      }));
    } catch (error) {
      console.error('[OfflineInspection] Error saving inspection:', error);
      // Dispatch error event
      window.dispatchEvent(new CustomEvent('inspectionAdded', { 
        detail: { 
          error: error.message,
          type: 'overhead',
          status: 'error'
        } 
      }));
      throw error;
    }
  }

  public async getPendingInspections(): Promise<PendingInspection[]> {
    console.log('[OfflineInspection] Getting pending inspections...');
    
    if (!this.dbInitialized) {
      console.log('[OfflineInspection] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.db) {
      console.error('[OfflineInspection] Database not available after initialization');
      throw new Error('Database not initialized');
    }

    try {
      const keys = await this.db.getAllKeys('pendingInspections');
      const values = await this.db.getAll('pendingInspections');
      
      console.log('[OfflineInspection] Found', keys.length, 'pending inspections');
      
      return keys.map((key, index) => ({
        key,
        inspection: values[index].inspection,
        timestamp: values[index].timestamp,
        type: values[index].type
      }));
    } catch (error) {
      console.error('[OfflineInspection] Error getting pending inspections:', error);
      throw error;
    }
  }

  public async removePendingInspection(key: string): Promise<void> {
    console.log('[OfflineInspection] Removing pending inspection:', key);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.delete('pendingInspections', key);
      this.offlineInspections.delete(key);
      this.notifyOfflineInspectionsUpdate();
      console.log('[OfflineInspection] Inspection removed successfully');
    } catch (error) {
      console.error('[OfflineInspection] Error removing inspection:', error);
      throw error;
    }
  }

  public async syncPendingInspections(): Promise<void> {
    console.log('[OfflineInspection] Starting sync of pending inspections...');
    
    if (!this.isOnline || this.syncInProgress) {
      console.log('[OfflineInspection] Sync skipped - online:', this.isOnline, 'sync in progress:', this.syncInProgress);
      return;
    }

    this.syncInProgress = true;
    this.syncQueue = this.syncQueue.then(async () => {
      try {
        const pendingInspections = await this.getPendingInspections();
        console.log('[OfflineInspection] Found', pendingInspections.length, 'inspections to sync');
        
        for (const { key, inspection } of pendingInspections) {
          try {
            // Remove Firebase sync comment
            await addOverheadLineInspection(inspection);
            
            // Remove from IndexedDB after successful sync
            await this.removePendingInspection(key);
            
            // Dispatch event for UI update
            window.dispatchEvent(new CustomEvent('inspectionSynced', { 
              detail: { 
                key,
                status: 'success'
              } 
            }));
            
            console.log(`[OfflineInspection] Successfully synced inspection ${key}`);
          } catch (error) {
            console.error(`[OfflineInspection] Failed to sync inspection ${key}:`, error);
            
            // Dispatch error event
            window.dispatchEvent(new CustomEvent('inspectionSynced', { 
              detail: { 
                key,
                error: error.message,
                status: 'error'
              } 
            }));
          }
        }
      } finally {
        this.syncInProgress = false;
        console.log('[OfflineInspection] Sync completed');
      }
    });

    return this.syncQueue;
  }
} 