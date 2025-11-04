import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { VITAsset } from '@/lib/types';
import { addVITAsset } from '@/lib/api';

interface VITDB extends DBSchema {
  pendingAssets: {
    key: string;
    value: {
      asset: Omit<VITAsset, 'id'>;
      timestamp: number;
      type: 'vit';
    };
  };
  pendingInspections: {
    key: string;
    value: {
      inspection: any;
      timestamp: number;
      type: 'vit';
    };
  };
}

interface PendingAsset {
  key: string;
  asset: Omit<VITAsset, 'id'>;
  timestamp: number;
  type: 'vit';
}

interface PendingInspection {
  key: string;
  inspection: any;
  timestamp: number;
  type: 'vit';
}

export class VITOfflineService {
  private static instance: VITOfflineService;
  private db: IDBPDatabase<VITDB> | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private dbInitialized: boolean = false;
  private syncQueue: Promise<void> = Promise.resolve();
  private offlineAssets: Map<string, VITAsset> = new Map();
  private offlineInspections: Map<string, any> = new Map();

  private constructor() {
    this.initializeDB();
    this.setupOnlineStatusListener();
    this.loadOfflineData();
  }

  public static getInstance(): VITOfflineService {
    if (!VITOfflineService.instance) {
      VITOfflineService.instance = new VITOfflineService();
    }
    return VITOfflineService.instance;
  }

  private async initializeDB() {
    try {
      console.log('[VITOffline] Initializing IndexedDB...');
      this.db = await openDB<VITDB>('faultmaster-vit', 1, {
        upgrade(db) {
          console.log('[VITOffline] Upgrading database...');
          if (!db.objectStoreNames.contains('pendingAssets')) {
            console.log('[VITOffline] Creating pendingAssets store...');
            db.createObjectStore('pendingAssets', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('pendingInspections')) {
            console.log('[VITOffline] Creating pendingInspections store...');
            db.createObjectStore('pendingInspections', { keyPath: 'key' });
          }
        },
      });
      this.dbInitialized = true;
      console.log('[VITOffline] Database initialized successfully');
    } catch (error) {
      console.error('[VITOffline] Failed to initialize IndexedDB:', error);
      this.dbInitialized = false;
    }
  }

  private setupOnlineStatusListener() {
    window.addEventListener('online', () => {
      console.log('[VITOffline] Network connection restored');
      this.isOnline = true;
      this.syncPendingData();
    });

    window.addEventListener('offline', () => {
      console.log('[VITOffline] Network connection lost');
      this.isOnline = false;
    });
  }

  public isInternetAvailable(): boolean {
    return navigator.onLine;
  }

  private async loadOfflineData() {
    try {
      const pendingAssets = await this.getPendingAssets();
      pendingAssets.forEach(({ key, asset }) => {
        this.offlineAssets.set(key, { ...asset, id: key } as VITAsset);
      });
      
      const pendingInspections = await this.getPendingInspections();
      pendingInspections.forEach(({ key, inspection }) => {
        this.offlineInspections.set(key, { ...inspection, id: key });
      });
      
      this.notifyOfflineDataUpdate();
    } catch (error) {
      console.error('[VITOffline] Error loading offline data:', error);
    }
  }

  private notifyOfflineDataUpdate() {
    window.dispatchEvent(new CustomEvent('vitOfflineDataUpdated', {
      detail: {
        assets: Array.from(this.offlineAssets.values()),
        inspections: Array.from(this.offlineInspections.values())
      }
    }));
  }

  public getOfflineAssets(): VITAsset[] {
    return Array.from(this.offlineAssets.values());
  }

  public getOfflineInspections(): any[] {
    return Array.from(this.offlineInspections.values());
  }

  public async saveAssetOffline(asset: Omit<VITAsset, 'id'>): Promise<string> {
    console.log('[VITOffline] Attempting to save asset offline...');
    
    if (!this.dbInitialized) {
      console.log('[VITOffline] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.db) {
      console.error('[VITOffline] Database not available after initialization');
      throw new Error('Database not initialized');
    }

    const key = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pendingAsset: PendingAsset = {
      key,
      asset: {
        ...asset,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      timestamp: Date.now(),
      type: 'vit'
    };

    try {
      console.log('[VITOffline] Saving asset with key:', key);
      await this.db.add('pendingAssets', pendingAsset);
      console.log('[VITOffline] Asset saved successfully');

      // Add to local state for immediate UI update
      const newAsset: VITAsset = {
        ...pendingAsset.asset,
        id: key
      };
      this.offlineAssets.set(key, newAsset);
      this.notifyOfflineDataUpdate();

      // Dispatch success event
      window.dispatchEvent(new CustomEvent('assetAdded', { 
        detail: { 
          asset: newAsset,
          type: 'vit',
          status: 'offline'
        } 
      }));
      
      return key;
    } catch (error) {
      console.error('[VITOffline] Error saving asset:', error);
      throw error;
    }
  }

  public async saveInspectionOffline(inspection: any): Promise<string> {
    console.log('[VITOffline] Attempting to save inspection offline...');
    
    if (!this.dbInitialized) {
      console.log('[VITOffline] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.db) {
      console.error('[VITOffline] Database not available after initialization');
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
      type: 'vit'
    };

    try {
      console.log('[VITOffline] Saving inspection with key:', key);
      await this.db.add('pendingInspections', pendingInspection);
      console.log('[VITOffline] Inspection saved successfully');

      // Add to local state for immediate UI update
      const newInspection = {
        ...pendingInspection.inspection,
        id: key
      };
      this.offlineInspections.set(key, newInspection);
      this.notifyOfflineDataUpdate();

      // Dispatch success event
      window.dispatchEvent(new CustomEvent('inspectionAdded', { 
        detail: { 
          inspection: newInspection,
          type: 'vit',
          status: 'offline'
        } 
      }));
      
      return key;
    } catch (error) {
      console.error('[VITOffline] Error saving inspection:', error);
      throw error;
    }
  }

  public async getPendingAssets(): Promise<PendingAsset[]> {
    console.log('[VITOffline] Getting pending assets...');
    
    if (!this.dbInitialized) {
      console.log('[VITOffline] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const keys = await this.db.getAllKeys('pendingAssets');
      const values = await this.db.getAll('pendingAssets');
      
      console.log('[VITOffline] Found', keys.length, 'pending assets');
      
      return keys.map((key, index) => ({
        key,
        asset: values[index].asset,
        timestamp: values[index].timestamp,
        type: values[index].type
      }));
    } catch (error) {
      console.error('[VITOffline] Error getting pending assets:', error);
      throw error;
    }
  }

  public async getPendingInspections(): Promise<PendingInspection[]> {
    console.log('[VITOffline] Getting pending inspections...');
    
    if (!this.dbInitialized) {
      console.log('[VITOffline] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const keys = await this.db.getAllKeys('pendingInspections');
      const values = await this.db.getAll('pendingInspections');
      
      console.log('[VITOffline] Found', keys.length, 'pending inspections');
      
      return keys.map((key, index) => ({
        key,
        inspection: values[index].inspection,
        timestamp: values[index].timestamp,
        type: values[index].type
      }));
    } catch (error) {
      console.error('[VITOffline] Error getting pending inspections:', error);
      throw error;
    }
  }

  public async removePendingAsset(key: string): Promise<void> {
    console.log('[VITOffline] Removing pending asset:', key);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.delete('pendingAssets', key);
      this.offlineAssets.delete(key);
      this.notifyOfflineDataUpdate();
      console.log('[VITOffline] Asset removed successfully');
    } catch (error) {
      console.error('[VITOffline] Error removing asset:', error);
      throw error;
    }
  }

  public async removePendingInspection(key: string): Promise<void> {
    console.log('[VITOffline] Removing pending inspection:', key);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.delete('pendingInspections', key);
      this.offlineInspections.delete(key);
      this.notifyOfflineDataUpdate();
      console.log('[VITOffline] Inspection removed successfully');
    } catch (error) {
      console.error('[VITOffline] Error removing inspection:', error);
      throw error;
    }
  }

  public async syncPendingData(): Promise<void> {
    console.log('[VITOffline] Starting sync of pending data...');
    
    if (!this.isOnline || this.syncInProgress) {
      console.log('[VITOffline] Sync skipped - online:', this.isOnline, 'sync in progress:', this.syncInProgress);
      return;
    }

    this.syncInProgress = true;
    this.syncQueue = this.syncQueue.then(async () => {
      try {
        // Sync assets - EXACTLY like overheadline pattern
        const pendingAssets = await this.getPendingAssets();
        console.log('[VITOffline] Found', pendingAssets.length, 'assets to sync');
        
        for (const { key, asset } of pendingAssets) {
          try {
            // Use the same pattern as overheadline - single API call
            await addVITAsset(asset);
            
            // Remove from IndexedDB after successful sync - EXACTLY like overheadline
            await this.removePendingAsset(key);
            
            // Dispatch event for UI update - EXACTLY like overheadline
            window.dispatchEvent(new CustomEvent('assetSynced', { 
              detail: { 
                key,
                status: 'success'
              } 
            }));
            
            console.log(`[VITOffline] Successfully synced asset ${key}`);
          } catch (error) {
            console.error(`[VITOffline] Failed to sync asset ${key}:`, error);
            
            // Dispatch error event - EXACTLY like overheadline
            window.dispatchEvent(new CustomEvent('assetSynced', { 
              detail: { 
                key,
                error: error.message,
                status: 'error'
              } 
            }));
          }
        }

        // Sync inspections - EXACTLY like overheadline pattern
        const pendingInspections = await this.getPendingInspections();
        console.log('[VITOffline] Found', pendingInspections.length, 'inspections to sync');
        
        for (const { key, inspection } of pendingInspections) {
          try {
            // Use the same pattern as overheadline - single API call
            await addVITInspection(inspection);
            
            // Remove from IndexedDB after successful sync - EXACTLY like overheadline
            await this.removePendingInspection(key);
            
            // Dispatch event for UI update - EXACTLY like overheadline
            window.dispatchEvent(new CustomEvent('inspectionSynced', { 
              detail: { 
                key,
                status: 'success'
              } 
            }));
            
            console.log(`[VITOffline] Successfully synced inspection ${key}`);
          } catch (error) {
            console.error(`[VITOffline] Failed to sync inspection ${key}:`, error);
            
            // Dispatch error event - EXACTLY like overheadline
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
        console.log('[VITOffline] Sync completed');
      }
    });

    return this.syncQueue;
  }
}
