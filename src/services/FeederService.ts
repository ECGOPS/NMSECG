import { apiRequest } from '@/lib/api';
import { offlineStorageCompat } from '@/utils/offlineStorage';

interface FeederInfo {
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

export class FeederService {
  private static instance: FeederService;

  private constructor() {
    // Initialize offline storage if needed - FIXED VERSION
    console.log('[FeederService] Constructor called, initializing offline storage...');
    console.log('[FeederService] offlineStorageCompat type:', typeof offlineStorageCompat);
    console.log('[FeederService] offlineStorageCompat.initialize type:', typeof offlineStorageCompat.initialize);
    
    if (typeof offlineStorageCompat.initialize === 'function') {
      offlineStorageCompat.initialize().catch(console.error);
    } else {
      console.error('[FeederService] ERROR: offlineStorageCompat.initialize is not a function!');
      console.error('[FeederService] offlineStorageCompat:', offlineStorageCompat);
    }
  }

  public static getInstance(): FeederService {
    if (!FeederService.instance) {
      FeederService.instance = new FeederService();
    }
    return FeederService.instance;
  }

  public async getFeedersByRegion(regionId: string): Promise<FeederInfo[]> {
    console.log('[FeederService] getFeedersByRegion called with regionId:', regionId);
    console.log('[FeederService] navigator.onLine:', navigator.onLine);
    
    if (navigator.onLine) {
      try {
        console.log('[FeederService] Making API request to:', `/api/feeders?regionId=${regionId}`);
        const feeders = await apiRequest(`/api/feeders?regionId=${regionId}`);
        console.log('[FeederService] API response:', feeders);
        
        // Cache the feeder data for offline use
        if (feeders && feeders.length > 0) {
          try {
            const regionName = feeders[0]?.region || 'Unknown';
            await offlineStorageCompat.saveFeederData(regionId, regionName, feeders);
            console.log('[FeederService] Cached feeder data for offline use');
          } catch (cacheError) {
            console.warn('[FeederService] Failed to cache feeder data:', cacheError);
          }
        }
        
        return feeders;
      } catch (error) {
        console.error('[FeederService] Error fetching feeders from backend:', error);
        // Try to get cached data as fallback
        return await this.getCachedFeeders(regionId);
      }
    } else {
      // Offline mode - try to get cached data
      console.log('[FeederService] Offline mode - attempting to get cached feeder data');
      return await this.getCachedFeeders(regionId);
    }
  }

  private async getCachedFeeders(regionId: string): Promise<FeederInfo[]> {
    try {
      const cachedFeeders = await offlineStorageCompat.getFeederData(regionId);
      if (cachedFeeders && cachedFeeders.length > 0) {
        console.log('[FeederService] Retrieved cached feeder data:', cachedFeeders.length, 'feeders');
        return cachedFeeders;
      }
    } catch (error) {
      console.warn('[FeederService] Failed to get cached feeder data:', error);
    }
    
    console.log('[FeederService] No cached feeder data available');
    return [];
  }

  public async getAllFeeders(): Promise<FeederInfo[]> {
    console.log('[FeederService] getAllFeeders called');
    console.log('[FeederService] navigator.onLine:', navigator.onLine);
    
    if (navigator.onLine) {
      try {
        console.log('[FeederService] Making API request to: /api/feeders');
        const feeders = await apiRequest('/api/feeders');
        console.log('[FeederService] getAllFeeders API response:', feeders);
        console.log('[FeederService] Feeders type:', typeof feeders);
        console.log('[FeederService] Feeders length:', feeders?.length);
        
        // Cache all feeder data by region for offline use
        if (feeders && feeders.length > 0) {
          try {
            console.log('[FeederService] Grouping feeders by region...');
            const feedersByRegion = this.groupFeedersByRegion(feeders);
            console.log('[FeederService] Feeders grouped by region:', Object.keys(feedersByRegion));
            
            for (const [regionId, regionFeeders] of Object.entries(feedersByRegion)) {
              const regionName = regionFeeders[0]?.region || 'Unknown';
              console.log(`[FeederService] Caching ${regionFeeders.length} feeders for region ${regionId} (${regionName})`);
              await offlineStorageCompat.saveFeederData(regionId, regionName, regionFeeders);
            }
            console.log('[FeederService] Cached all feeder data by region for offline use');
          } catch (cacheError) {
            console.error('[FeederService] Failed to cache feeder data:', cacheError);
            console.error('[FeederService] Cache error details:', {
              name: cacheError.name,
              message: cacheError.message,
              stack: cacheError.stack
            });
          }
        } else {
          console.warn('[FeederService] No feeders returned from API or empty array');
        }
        
        return feeders;
      } catch (error) {
        console.error('[FeederService] Error fetching feeders from backend:', error);
        console.error('[FeederService] API error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        // Try to get cached data as fallback
        console.log('[FeederService] Attempting to get cached data as fallback...');
        return await this.getAllCachedFeeders();
      }
    } else {
      // Offline mode - try to get cached data
      console.log('[FeederService] Offline mode - attempting to get cached feeder data');
      return await this.getAllCachedFeeders();
    }
  }

  private groupFeedersByRegion(feeders: FeederInfo[]): Record<string, FeederInfo[]> {
    return feeders.reduce((acc, feeder) => {
      const regionId = feeder.regionId;
      if (!acc[regionId]) {
        acc[regionId] = [];
      }
      acc[regionId].push(feeder);
      return acc;
    }, {} as Record<string, FeederInfo[]>);
  }

  private async getAllCachedFeeders(): Promise<FeederInfo[]> {
    try {
      const allFeederData = await offlineStorageCompat.getAllFeederData();
      const allFeeders: FeederInfo[] = [];
      
      for (const data of allFeederData) {
        allFeeders.push(...data.feeders);
      }
      
      if (allFeeders.length > 0) {
        console.log('[FeederService] Retrieved all cached feeder data:', allFeeders.length, 'feeders');
        return allFeeders;
      }
    } catch (error) {
      console.warn('[FeederService] Failed to get cached feeder data:', error);
    }
    
    console.log('[FeederService] No cached feeder data available');
    return [];
  }

  public async addFeeder(feeder: Omit<FeederInfo, 'id'>): Promise<string> {
    if (navigator.onLine) {
      const result = await apiRequest('/api/feeders', {
        method: 'POST',
        body: JSON.stringify(feeder),
      });
      return result.id;
    } else {
      // For offline mode, return a temporary ID
      const offlineId = `offline_${Date.now()}`;
      return offlineId;
    }
  }

  public async updateFeeder(id: string, updates: Partial<FeederInfo>): Promise<void> {
    if (navigator.onLine) {
      await apiRequest(`/api/feeders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } else {
      // Offline mode - no action taken since feeder offline storage is not implemented
      console.log('Offline mode: feeder update not implemented');
    }
  }

  public async deleteFeeder(id: string): Promise<void> {
    if (navigator.onLine) {
      await apiRequest(`/api/feeders/${id}`, {
        method: 'DELETE',
      });
    } else {
      // Offline mode - no action taken since feeder offline storage is not implemented
      console.log('Offline mode: feeder deletion not implemented');
    }
  }

  public async getFeederById(id: string): Promise<FeederInfo | null> {
    if (navigator.onLine) {
      try {
        const feeder = await apiRequest(`/api/feeders/${id}`);
        return feeder;
      } catch (error) {
        console.error('Error fetching feeder from backend:', error);
      }
    }
    return null;
  }

  public async preloadFeeders(): Promise<void> {
    if (navigator.onLine) {
      const feeders = await apiRequest('/api/feeders');
      console.log(`Preloaded ${feeders.length} feeders for online use`);
    }
  }
} 