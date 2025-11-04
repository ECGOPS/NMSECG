import { initDB, addItem, getAllItems, safeClearStore } from './db';

export interface CacheEntry<T = any> {
  id: string;
  key: string;
  data: T;
  timestamp: number;
  expiresAt?: number;
}

export interface CacheConfig {
  maxAge?: number; // in milliseconds
  maxSize?: number; // maximum number of entries
}

class IndexedDBCache {
  private db: any = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initialize();
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    try {
      this.db = await initDB();
      this.isInitialized = true;
      console.log('[IndexedDBCache] Initialized successfully');
    } catch (error) {
      console.error('[IndexedDBCache] Initialization failed:', error);
      throw error;
    }
  }

  async set<T>(key: string, data: T, config: CacheConfig = {}): Promise<void> {
    await this.ensureInitialized();
    
    const { maxAge = 5 * 60 * 1000 } = config; // Default 5 minutes
    const timestamp = Date.now();
    const expiresAt = timestamp + maxAge;

    const cacheEntry: CacheEntry<T> = {
      id: key,
      key,
      data,
      timestamp,
      expiresAt
    };

    try {
      await addItem('system-cache', cacheEntry);
      console.log(`[IndexedDBCache] ✅ Cached ${key}:`, {
        timestamp,
        expiresAt,
        dataSize: JSON.stringify(data).length
      });
    } catch (error) {
      console.error(`[IndexedDBCache] ❌ Failed to cache ${key}:`, error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureInitialized();
    
    try {
      const entries = await getAllItems('system-cache');
      const entry = entries.find((e: CacheEntry<T>) => e.key === key);
      
      if (!entry) {
        console.log(`[IndexedDBCache] Cache miss for ${key}`);
        return null;
      }

      // Check if expired
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        console.log(`[IndexedDBCache] Cache expired for ${key}`);
        await this.delete(key);
        return null;
      }

      console.log(`[IndexedDBCache] ✅ Cache hit for ${key}:`, {
        timestamp: entry.timestamp,
        age: Date.now() - entry.timestamp,
        dataSize: JSON.stringify(entry.data).length
      });

      return entry.data;
    } catch (error) {
      console.error(`[IndexedDBCache] ❌ Error reading cache for ${key}:`, error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureInitialized();
    
    try {
      const entries = await getAllItems('system-cache');
      const entry = entries.find((e: CacheEntry) => e.key === key);
      
      if (entry) {
        await this.db?.delete('system-cache', entry.id);
        console.log(`[IndexedDBCache] ✅ Deleted cache for ${key}`);
      }
    } catch (error) {
      console.error(`[IndexedDBCache] ❌ Error deleting cache for ${key}:`, error);
    }
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await safeClearStore('system-cache');
      console.log('[IndexedDBCache] ✅ Cleared all cache');
    } catch (error) {
      console.error('[IndexedDBCache] ❌ Error clearing cache:', error);
    }
  }

  async isValid(key: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const entries = await getAllItems('system-cache');
      const entry = entries.find((e: CacheEntry) => e.key === key);
      
      if (!entry) return false;
      
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`[IndexedDBCache] ❌ Error checking cache validity for ${key}:`, error);
      return false;
    }
  }

  async getCacheInfo(): Promise<{ key: string; valid: boolean; age: number; size: number }[]> {
    await this.ensureInitialized();
    
    try {
      const entries = await getAllItems('system-cache');
      const now = Date.now();
      
      return entries.map((entry: CacheEntry) => ({
        key: entry.key,
        valid: !entry.expiresAt || now <= entry.expiresAt,
        age: now - entry.timestamp,
        size: JSON.stringify(entry.data).length
      }));
    } catch (error) {
      console.error('[IndexedDBCache] ❌ Error getting cache info:', error);
      return [];
    }
  }

  async cleanup(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      const entries = await getAllItems('system-cache');
      const now = Date.now();
      
      for (const entry of entries) {
        if (entry.expiresAt && now > entry.expiresAt) {
          await this.delete(entry.key);
        }
      }
      
      console.log('[IndexedDBCache] ✅ Cleanup completed');
    } catch (error) {
      console.error('[IndexedDBCache] ❌ Error during cleanup:', error);
    }
  }
}

// Create singleton instance
export const indexedDBCache = new IndexedDBCache();

// Convenience functions for backward compatibility
export const cache = {
  set: (key: string, data: any, config?: CacheConfig) => indexedDBCache.set(key, data, config),
  get: (key: string) => indexedDBCache.get(key),
  delete: (key: string) => indexedDBCache.delete(key),
  clear: () => indexedDBCache.clear(),
  isValid: (key: string) => indexedDBCache.isValid(key),
  getInfo: () => indexedDBCache.getCacheInfo(),
  cleanup: () => indexedDBCache.cleanup()
};

// Migration helper from localStorage
export const migrateFromLocalStorage = async (): Promise<void> => {
  try {
    const cacheKeys = ['vitAssets', 'vitInspections', 'networkInspections', 'loadMonitoring', 'op5Faults', 'controlOutages'];
    
    for (const key of cacheKeys) {
      const localStorageKey = `cache_${key}`;
      const stored = localStorage.getItem(localStorageKey);
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          await indexedDBCache.set(key, parsed.data, { maxAge: 5 * 60 * 1000 });
          console.log(`[Migration] ✅ Migrated ${key} from localStorage to IndexedDB`);
          
          // Remove from localStorage after successful migration
          localStorage.removeItem(localStorageKey);
        } catch (error) {
          console.error(`[Migration] ❌ Failed to migrate ${key}:`, error);
        }
      }
    }
    
    console.log('[Migration] ✅ Migration from localStorage completed');
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
  }
}; 