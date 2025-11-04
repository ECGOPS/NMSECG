// src/lib/offlineStorage.ts
import Dexie, { Table } from 'dexie';

// Name & version — bump version number on schema change
const DB_NAME = 'NMSOfflineDB';
const DB_VERSION = 4; // Increase this when schema changes

// Offline inspection data structure
export interface OfflineInspection {
  id: string; // Unique offline identifier
  originalId?: string; // Original ID if synced
  data: any; // Full inspection data
  syncStatus: 'pending' | 'synced' | 'failed';
  createdAt: number;
  updatedAt: number;
  lastSyncAttempt?: number;
  syncAttempts: number;
  errorMessage?: string;
}

// Offline photo data structure
export interface OfflinePhoto {
  id: string;
  inspectionId: string;
  originalId?: string;
  filename: string;
  data: string; // base64 or blob URL
  type: 'before' | 'after' | 'correction';
  syncStatus: 'pending' | 'synced' | 'failed';
  createdAt: number;
  size: number;
  mimeType: string;
}

// Sync queue item
export interface SyncQueueItem {
  id: string;
  type: 'inspection' | 'photo';
  offlineId: string;
  priority: number; // 1 = high, 2 = medium, 3 = low
  createdAt: number;
  retryCount: number;
  maxRetries: number;
}

// Offline feeder data structure
export interface OfflineFeederData {
  id: string;
  regionId: string;
  regionName: string;
  feeders: FeederInfo[];
  timestamp: number;
  expiresAt: number; // Data expires after 24 hours
}

// Feeder information structure
export interface FeederInfo {
  id: string;
  name: string;
  alias?: string;
  bspPss: string;
  region: string;
  district: string;
  regionId: string;
  districtId: string;
  voltageLevel: string;
  feederType: string;
}

class OfflineStorage extends Dexie {
  inspections!: Table<OfflineInspection, string>;
  photos!: Table<OfflinePhoto, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  feederData!: Table<OfflineFeederData, string>;
  offlineViewing!: Table<any, string>; // Table for storing inspections for offline viewing

  constructor() {
    super(DB_NAME);

    // Version change event — close DB to avoid blocking upgrades
    this.on('versionchange', () => {
      console.warn('[OfflineStorage] Version change detected — closing DB');
      this.close();
      window.location.reload();
    });

    // Schema definition with proper indexes
    this.version(DB_VERSION).stores({
      inspections: 'id, syncStatus, createdAt, updatedAt', // indexes
      photos: 'id, inspectionId, syncStatus, type', // indexes
      syncQueue: 'id, type, offlineId, priority, createdAt', // indexes
      feederData: 'id, regionId, timestamp', // indexes
      offlineViewing: 'id, storedAt', // indexes for offline viewing
    });
  }

  /** Initialize with recovery logic */
  async init() {
    try {
      console.log('[OfflineStorage] Initializing database...');
      await this.open();
      console.log('[OfflineStorage] Database ready');
    } catch (err) {
      console.error('[OfflineStorage] Init failed, attempting recovery...', err);
      await this.recoverDatabase();
    }
  }

  /** Reset database if it's corrupted or locked */
  private async recoverDatabase() {
    try {
      console.warn('[OfflineStorage] Starting database recovery...');
      this.close();
      await Dexie.delete(DB_NAME);
      console.warn('[OfflineStorage] Database deleted, reinitializing...');
      await this.open();
      console.log('[OfflineStorage] Database recovery successful');
    } catch (err) {
      console.error('[OfflineStorage] Recovery failed:', err);
      throw new Error('Database initialization and recovery failed');
    }
  }

  // Inspection methods
  async saveInspection(inspection: Omit<OfflineInspection, 'id'>): Promise<string> {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullInspection: OfflineInspection = {
      ...inspection,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncAttempts: 0,
    };
    
    await this.inspections.put(fullInspection);
    
    // Add to sync queue
    await this.addToSyncQueue('inspection', id, 1);
    
    console.log('[OfflineStorage] Inspection saved offline:', id);
    return id;
  }

  async getInspection(id: string): Promise<OfflineInspection | undefined> {
    return this.inspections.get(id);
  }

  async getAllInspections(): Promise<OfflineInspection[]> {
    return this.inspections.toArray();
  }

  async getUnsyncedInspections(): Promise<OfflineInspection[]> {
    return this.inspections.where('syncStatus').equals('pending').toArray();
  }

  async updateInspectionSyncStatus(
    id: string, 
    status: 'pending' | 'synced' | 'failed',
    originalId?: string,
    errorMessage?: string
  ): Promise<void> {
    const inspection = await this.inspections.get(id);
    if (!inspection) {
      throw new Error('Inspection not found');
    }

    inspection.syncStatus = status;
    inspection.updatedAt = Date.now();
    inspection.lastSyncAttempt = Date.now();
    
    if (status === 'synced' && originalId) {
      inspection.originalId = originalId;
    }
    
    if (status === 'failed') {
      inspection.syncAttempts += 1;
      inspection.errorMessage = errorMessage;
    }

    await this.inspections.put(inspection);
  }

  async deleteInspection(id: string): Promise<void> {
    // Delete the inspection
    await this.inspections.delete(id);
    
    // Delete associated photos
    const photos = await this.photos.where('inspectionId').equals(id).toArray();
    for (const photo of photos) {
      await this.photos.delete(photo.id);
    }
    
    // Remove from sync queue
    await this.syncQueue.where('offlineId').equals(id).delete();
    
    console.log(`[OfflineStorage] Deleted inspection ${id} and associated data`);
  }

  // Photo methods
  async savePhoto(photo: Omit<OfflinePhoto, 'id'>): Promise<string> {
    const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullPhoto: OfflinePhoto = {
      ...photo,
      id,
      createdAt: Date.now(),
    };
    
    await this.photos.put(fullPhoto);
    
    // Add to sync queue
    await this.addToSyncQueue('photo', id, 2);
    
    console.log('[OfflineStorage] Photo saved offline:', id);
    return id;
  }

  async getPhoto(id: string): Promise<OfflinePhoto | undefined> {
    return this.photos.get(id);
  }

  async getPhotosByInspectionId(inspectionId: string): Promise<OfflinePhoto[]> {
    return this.photos.where('inspectionId').equals(inspectionId).toArray();
  }

  async updatePhotoSyncStatus(
    id: string,
    status: 'pending' | 'synced' | 'failed',
    originalId?: string
  ): Promise<void> {
    const photo = await this.photos.get(id);
    if (!photo) {
      throw new Error('Photo not found');
    }

    photo.syncStatus = status;
    
    if (status === 'synced' && originalId) {
      photo.originalId = originalId;
    }

    await this.photos.put(photo);
  }

  async deletePhoto(id: string): Promise<void> {
    await this.photos.delete(id);
    
    // Remove from sync queue
    await this.syncQueue.where('offlineId').equals(id).delete();
    
    console.log(`[OfflineStorage] Deleted photo ${id}`);
  }

  // Sync queue methods
  async addToSyncQueue(
    type: 'inspection' | 'photo',
    offlineId: string,
    priority: number
  ): Promise<void> {
    const syncItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      offlineId,
      priority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    await this.syncQueue.put(syncItem);
  }

  async getNextSyncItem(): Promise<SyncQueueItem | null> {
    // Get items by priority (1 = high, 2 = medium, 3 = low)
    for (let priority = 1; priority <= 3; priority++) {
      const items = await this.syncQueue
        .where('priority')
        .equals(priority)
        .toArray();
      
      if (items.length > 0) {
        // Sort by creation time (oldest first)
        items.sort((a, b) => a.createdAt - b.createdAt);
        return items[0];
      }
    }
    
    return null;
  }

  async getAllSyncQueueItems(): Promise<SyncQueueItem[]> {
    return this.syncQueue.toArray();
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    await this.syncQueue.delete(id);
  }

  // Offline viewing methods for storing inspection data for offline viewing
  async storeInspectionForViewing(key: string, inspectionData: any): Promise<void> {
    const viewingData = {
      id: key,
      data: inspectionData,
      storedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours expiration
    };
    
    await this.offlineViewing.put(viewingData);
    console.log(`[OfflineStorage] Stored inspection for offline viewing: ${key}`);
  }

  async getStoredInspectionsForViewing(): Promise<any[]> {
    const now = Date.now();
    const allData = await this.offlineViewing.toArray();
    
    // Filter out expired data
    const validData = allData.filter(item => !item.expiresAt || item.expiresAt > now);
    
    // Return the actual inspection data
    return validData.map(item => item.data);
  }

  async cleanupExpiredViewingData(): Promise<void> {
    const now = Date.now();
    const expiredData = await this.offlineViewing
      .where('expiresAt')
      .below(now)
      .toArray();
    
    for (const item of expiredData) {
      await this.offlineViewing.delete(item.id);
    }
    
    if (expiredData.length > 0) {
      console.log(`[OfflineStorage] Cleaned up ${expiredData.length} expired viewing records`);
    }
  }

  // Store load monitoring data for offline viewing
  async storeLoadMonitoringForViewing(key: string, loadMonitoringData: any): Promise<void> {
    const viewingData = {
      id: key,
      data: loadMonitoringData,
      storedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours expiration
    };
    
    await this.offlineViewing.put(viewingData);
    console.log(`[OfflineStorage] Stored load monitoring for offline viewing: ${key}`);
  }

  // Get stored load monitoring data for offline viewing
  async getStoredLoadMonitoringForViewing(): Promise<any[]> {
    const now = Date.now();
    const allData = await this.offlineViewing.toArray();
    
    // Filter for valid (non-expired) data
    const validData = allData.filter(item => !item.expiresAt || item.expiresAt > now);
    
    // Return only the data portion
    return validData.map(item => item.data);
  }

  // Feeder data methods
  async saveFeederData(regionId: string, regionName: string, feeders: FeederInfo[]): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours from now

    const feederData: OfflineFeederData = {
      id: `feeder_${regionId}_${now}`,
      regionId,
      regionName,
      feeders,
      timestamp: now,
      expiresAt,
    };

    // Remove old data for this region
    await this.feederData.where('regionId').equals(regionId).delete();

    // Save new data
    await this.feederData.put(feederData);
    console.log(`[OfflineStorage] Saved feeder data for region ${regionId}: ${feeders.length} feeders`);
  }

  async getFeederData(regionId: string): Promise<FeederInfo[] | null> {
    const now = Date.now();
    const feederData = await this.feederData
      .where('regionId')
      .equals(regionId)
      .toArray();
    
    // Find the most recent non-expired data
    const validData = feederData
      .filter(data => data.expiresAt > now)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (validData.length > 0) {
      console.log(`[OfflineStorage] Retrieved feeder data for region ${regionId}: ${validData[0].feeders.length} feeders`);
      return validData[0].feeders;
    }

    console.log(`[OfflineStorage] No valid feeder data found for region ${regionId}`);
    return null;
  }

  async cleanupExpiredFeederData(): Promise<void> {
    const now = Date.now();
    const allData = await this.feederData.toArray();
    let cleanedCount = 0;

    for (const data of allData) {
      if (data.expiresAt <= now) {
        await this.feederData.delete(data.id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[OfflineStorage] Cleaned up ${cleanedCount} expired feeder data records`);
    }
  }

  // Sync statistics
  async getSyncStats(): Promise<{
    pendingInspections: number;
    pendingPhotos: number;
    totalOfflineItems: number;
    lastSyncAttempt: number | null;
    syncQueueCount: number;
  }> {
    const pendingInspections = await this.inspections.where('syncStatus').equals('pending').count();
    const pendingPhotos = await this.photos.where('syncStatus').equals('pending').count();
    
    const allInspections = await this.inspections.toArray();
    const syncQueueItems = await this.syncQueue.toArray();
    const lastSyncAttempt = allInspections.length > 0 
      ? Math.max(...allInspections.map(i => i.lastSyncAttempt || 0))
      : null;

    return {
      pendingInspections,
      pendingPhotos,
      totalOfflineItems: allInspections.length,
      lastSyncAttempt,
      syncQueueCount: syncQueueItems.length,
    };
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    await this.inspections.clear();
    await this.photos.clear();
    await this.syncQueue.clear();
    await this.feederData.clear();
    
    console.log('[OfflineStorage] All offline data cleared');
  }

  async resetDatabase(): Promise<void> {
    console.log('[OfflineStorage] Resetting database...');
    this.close();
    await Dexie.delete(DB_NAME);
    await this.open();
    console.log('[OfflineStorage] Database reset successfully');
  }

  // Check database health
  async checkDatabaseHealth(): Promise<{ isHealthy: boolean; error?: string }> {
    try {
      // Test basic operations
      await this.inspections.count();
      await this.photos.count();
      await this.syncQueue.count();
      
      return { isHealthy: true };
    } catch (error) {
      return { 
        isHealthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Force recovery
  async forceRecovery(): Promise<void> {
    console.log('[OfflineStorage] Force recovery initiated...');
    await this.recoverDatabase();
    console.log('[OfflineStorage] Force recovery completed');
  }

  // Close database connection
  async close(): Promise<void> {
    this.close();
    console.log('[OfflineStorage] Database connection closed');
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorage();

// Legacy method names for backward compatibility
export const OfflineStorageManager = OfflineStorage;

// Backward compatibility methods for existing code
export class OfflineStorageManagerCompat {
  private db: OfflineStorage;

  constructor() {
    this.db = offlineStorage;
  }

    // Initialize method for backward compatibility
    async initialize(): Promise<void> {
      return this.db.init();
    }

    // Check if database is ready
    isReady(): boolean {
      return this.db.isOpen();
    }

    // Get database status
    getStatus(): { isReady: boolean; isInitializing: boolean } {
      return {
        isReady: this.db.isOpen(),
        isInitializing: false // Dexie handles this automatically
      };
    }

    // Wait for database to be ready
    async waitForReady(timeoutMs: number = 10000): Promise<void> {
      const startTime = Date.now();
      
      while (!this.db.isOpen() && (Date.now() - startTime) < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!this.db.isOpen()) {
        throw new Error(`Database not ready after ${timeoutMs}ms timeout`);
      }
    }

    // Legacy method names
    async saveInspectionOffline(inspectionData: any): Promise<string> {
      return this.db.saveInspection({
        data: inspectionData,
        syncStatus: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncAttempts: 0,
      });
    }

    async savePhotoOffline(
      inspectionOfflineId: string,
      photoData: string,
      filename: string,
      type: 'before' | 'after' | 'correction',
      mimeType: string = 'image/jpeg'
    ): Promise<string> {
      return this.db.savePhoto({
        inspectionId: inspectionOfflineId,
        filename,
        data: photoData,
        type,
        syncStatus: 'pending',
        createdAt: Date.now(),
        size: photoData.length,
        mimeType,
      });
    }

    async getAllOfflineInspections(): Promise<OfflineInspection[]> {
      return this.db.getAllInspections();
    }

    async getInspectionByOfflineId(offlineId: string): Promise<OfflineInspection | undefined> {
      return this.db.getInspection(offlineId);
    }

    async getPhotoByOfflineId(offlineId: string): Promise<OfflinePhoto | undefined> {
      return this.db.getPhoto(offlineId);
    }

    async getPhotosByInspectionId(inspectionId: string): Promise<OfflinePhoto[]> {
      return this.db.getPhotosByInspectionId(inspectionId);
    }

    // Store inspection for offline viewing (different from sync storage)
    async storeInspectionForViewing(key: string, inspectionData: any): Promise<void> {
      // Store in a separate table for offline viewing
      await this.db.storeInspectionForViewing(key, inspectionData);
    }

    // Get stored inspections for offline viewing
    async getStoredInspectionsForViewing(): Promise<any[]> {
      return this.db.getStoredInspectionsForViewing();
    }

    async getPendingInspections(): Promise<OfflineInspection[]> {
      return this.db.getUnsyncedInspections();
    }

    async getPendingPhotos(): Promise<OfflinePhoto[]> {
      return this.db.photos.where('syncStatus').equals('pending').toArray();
    }

    async updateInspectionSyncStatus(
      offlineId: string, 
      status: 'pending' | 'synced' | 'failed',
      originalId?: string,
      errorMessage?: string
    ): Promise<void> {
      return this.db.updateInspectionSyncStatus(offlineId, status, originalId, errorMessage);
    }

    async updatePhotoSyncStatus(
      offlineId: string,
      status: 'pending' | 'synced' | 'failed',
      originalId?: string
    ): Promise<void> {
      return this.db.updatePhotoSyncStatus(offlineId, status, originalId);
    }

    async addToSyncQueue(
      type: 'inspection' | 'photo',
      offlineId: string,
      priority: number
    ): Promise<void> {
      return this.db.addToSyncQueue(type, offlineId, priority);
    }

    async getNextSyncItem(): Promise<SyncQueueItem | null> {
      return this.db.getNextSyncItem();
    }

    async getSyncQueueItems(): Promise<SyncQueueItem[]> {
      return this.db.getAllSyncQueueItems();
    }

    async removeFromSyncQueue(id: string): Promise<void> {
      return this.db.removeFromSyncQueue(id);
    }

    async getSyncStats(): Promise<{
      pendingInspections: number;
      pendingPhotos: number;
      totalOfflineItems: number;
      lastSyncAttempt: number | null;
      syncQueueCount: number;
    }> {
      return this.db.getSyncStats();
    }

    async deleteInspection(offlineId: string): Promise<void> {
      return this.db.deleteInspection(offlineId);
    }

    async deletePhoto(offlineId: string): Promise<void> {
      return this.db.deletePhoto(offlineId);
    }

    async saveFeederData(regionId: string, regionName: string, feeders: FeederInfo[]): Promise<void> {
      return this.db.saveFeederData(regionId, regionName, feeders);
    }

    async getFeederData(regionId: string): Promise<FeederInfo[] | null> {
      return this.db.getFeederData(regionId);
    }

    async getAllFeederData(): Promise<OfflineFeederData[]> {
      return this.db.feederData.toArray();
    }

    async cleanupExpiredFeederData(): Promise<void> {
      return this.db.cleanupExpiredFeederData();
    }

    async clearAllData(): Promise<void> {
      return this.db.clearAllData();
    }

    async resetDatabase(): Promise<void> {
      return this.db.resetDatabase();
    }

    async checkDatabaseHealth(): Promise<{ isHealthy: boolean; error?: string }> {
      return this.db.checkDatabaseHealth();
    }

    async forceRecovery(): Promise<void> {
      return this.db.forceRecovery();
    }

    async close(): Promise<void> {
      return this.db.close();
    }

    // Load Monitoring offline viewing methods
    async storeLoadMonitoringForViewing(key: string, loadMonitoringData: any): Promise<void> {
      await this.db.storeLoadMonitoringForViewing(key, loadMonitoringData);
    }

    // Get stored load monitoring data for offline viewing
    async getStoredLoadMonitoringForViewing(): Promise<any[]> {
      return this.db.getStoredLoadMonitoringForViewing();
    }
  }

  // Export the compatibility instance
  export const offlineStorageCompat = new OfflineStorageManagerCompat();
