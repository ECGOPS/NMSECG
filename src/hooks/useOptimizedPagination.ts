/**
 * useOptimizedPagination - Advanced pagination hook with caching, prefetching, and offline support
 * 
 * Features:
 * 1. In-memory + localStorage caching for instant page loads
 * 2. Background prefetching of next page for smooth navigation
 * 3. Debounced/throttled pagination clicks
 * 4. Offline mode with cached data fallback
 * 5. Automatic cache invalidation on filter changes
 * 
 * Usage:
 * const { data, loading, error, totalPages, currentPage, goToPage, isOffline } = useOptimizedPagination({
 *   fetchPage: (page, limit) => apiRequest(`/api/data?page=${page}&limit=${limit}`),
 *   pageSize: 20,
 *   cacheKey: 'inspections',
 *   filters: { region, district, search }
 * });
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from '@/components/ui/sonner';

interface PaginationOptions<T> {
  /**
   * Fetch function that accepts (page, limit) and returns Promise<{ data: T[], total: number }>
   * The API should support: /api/data?page={page}&limit={limit}
   */
  fetchPage: (page: number, limit: number, offset: number) => Promise<{ data?: T[]; total: number; [key: string]: any } | T[]>;
  
  /**
   * Number of items per page
   */
  pageSize: number;
  
  /**
   * Base cache key for localStorage and memory cache
   * Each page/filter combination will append to this key
   */
  cacheKey: string;
  
  /**
   * Filter object - when this changes, cache is invalidated
   * Should include all filter parameters (region, district, search, etc.)
   */
  filters?: Record<string, any>;
  
  /**
   * Enable background prefetching of next page (default: true)
   */
  enablePrefetch?: boolean;
  
  /**
   * Cache TTL in milliseconds (default: 5 minutes)
   */
  cacheTTL?: number;
  
  /**
   * Debounce delay for pagination clicks in ms (default: 300ms)
   */
  debounceDelay?: number;
  
  /**
   * Enable offline mode support (default: true)
   */
  enableOffline?: boolean;
  
  /**
   * Initial page number (default: 1)
   */
  initialPage?: number;
}

interface PaginationResult<T> {
  /** Current page data */
  data: T[];
  
  /** Loading state */
  loading: boolean;
  
  /** Error state */
  error: Error | null;
  
  /** Total number of records */
  total: number;
  
  /** Total number of pages */
  totalPages: number;
  
  /** Current page number (1-indexed) */
  currentPage: number;
  
  /** Go to specific page (debounced) */
  goToPage: (page: number) => void;
  
  /** Go to next page */
  nextPage: () => void;
  
  /** Go to previous page */
  previousPage: () => void;
  
  /** Refresh current page (bypass cache) */
  refresh: () => void;
  
  /** Clear all cached data */
  clearCache: () => void;
  
  /** Whether currently showing offline/cached data */
  isOffline: boolean;
  
  /** Whether data is from cache */
  isFromCache: boolean;
}

/**
 * Memory cache for fast access
 * Key: cacheKey + page + filterHash
 * Value: { data, total, timestamp }
 */
const memoryCache = new Map<string, { data: any[]; total: number; timestamp: number }>();

/**
 * Generate a cache key from filters and page
 */
function generateCacheKey(baseKey: string, page: number, filters?: Record<string, any>): string {
  const filterHash = filters ? JSON.stringify(filters) : 'no_filters';
  return `${baseKey}_page_${page}_${btoa(filterHash).substring(0, 16)}`;
}

/**
 * Get cache from localStorage
 */
function getLocalStorageCache<T>(key: string): { data: T[]; total: number; timestamp: number } | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    return parsed;
  } catch (error) {
    console.error('[useOptimizedPagination] Error reading from localStorage:', error);
    return null;
  }
}

/**
 * Save cache to localStorage
 */
function setLocalStorageCache<T>(key: string, data: T[], total: number): void {
  const cacheData = {
    data,
    total,
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem(key, JSON.stringify(cacheData));
    
    // Clean up old cache entries (keep only last 50 pages)
    cleanupLocalStorageCache();
  } catch (error) {
    // localStorage quota exceeded - try to clean up
    if (error instanceof DOMException && error.code === 22) {
      console.warn('[useOptimizedPagination] localStorage quota exceeded, cleaning up...');
      cleanupLocalStorageCache(true);
      try {
        localStorage.setItem(key, JSON.stringify(cacheData));
      } catch (retryError) {
        console.error('[useOptimizedPagination] Failed to save to localStorage after cleanup:', retryError);
      }
    } else {
      console.error('[useOptimizedPagination] Error saving to localStorage:', error);
    }
  }
}

/**
 * Clean up localStorage cache - keep only recent entries
 */
function cleanupLocalStorageCache(aggressive: boolean = false): void {
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith('pagination_cache_'));
    
    if (cacheKeys.length > (aggressive ? 30 : 50)) {
      // Get all cache entries with timestamps
      const entries = cacheKeys.map(key => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            return { key, timestamp: parsed.timestamp || 0 };
          }
        } catch (error) {
          return { key, timestamp: 0 };
        }
      }).filter(Boolean) as { key: string; timestamp: number }[];
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - (aggressive ? 20 : 40));
      toRemove.forEach(entry => localStorage.removeItem(entry.key));
      
      console.log(`[useOptimizedPagination] Cleaned up ${toRemove.length} cache entries`);
    }
  } catch (error) {
    console.error('[useOptimizedPagination] Error cleaning up localStorage:', error);
  }
}

/**
 * Check if online
 */
function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Debounce function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function useOptimizedPagination<T = any>(
  options: PaginationOptions<T>
): PaginationResult<T> {
  const {
    fetchPage,
    pageSize,
    cacheKey,
    filters = {},
    enablePrefetch = true,
    cacheTTL = 5 * 60 * 1000, // 5 minutes default
    debounceDelay = 300,
    enableOffline = true,
    initialPage = 1
  } = options;

  // State
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isOffline, setIsOffline] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  
  // Refs for tracking
  const prefetchControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const filtersRef = useRef(filters);
  const lastCacheKeyRef = useRef<string>('');
  const fetchPageRef = useRef(fetchPage);

  // Update refs when they change
  useEffect(() => {
    filtersRef.current = filters;
    fetchPageRef.current = fetchPage;
  }, [filters, fetchPage]);

  /**
   * Load a page from cache or API
   */
  const loadPage = useCallback(async (page: number, bypassCache: boolean = false): Promise<void> => {
    if (!isMountedRef.current) return;

    const fullCacheKey = generateCacheKey(cacheKey, page, filtersRef.current);
    const localStorageKey = `pagination_cache_${fullCacheKey}`;
    
    setLoading(true);
    setError(null);
    setIsFromCache(false);

    // Check memory cache first (fastest)
    if (!bypassCache) {
      const memoryCached = memoryCache.get(fullCacheKey);
      if (memoryCached) {
        const cacheAge = Date.now() - memoryCached.timestamp;
        if (cacheAge < cacheTTL) {
          console.log(`[useOptimizedPagination] Using memory cache for page ${page} (age: ${cacheAge}ms)`);
          setData(memoryCached.data);
          setTotal(memoryCached.total);
      setLoading(false);
      setIsFromCache(true);
      
      // Update localStorage cache in background
      const cacheData = {
        data: memoryCached.data,
        total: memoryCached.total,
        timestamp: memoryCached.timestamp
      };
      setLocalStorageCache(localStorageKey, memoryCached.data, memoryCached.total);
      return;
        } else {
          // Cache expired, remove it
          memoryCache.delete(fullCacheKey);
        }
      }

      // Check localStorage cache (slower but persistent)
      if (enableOffline) {
        const localCached = getLocalStorageCache<T>(localStorageKey);
        if (localCached) {
          const cacheAge = Date.now() - localCached.timestamp;
          if (cacheAge < cacheTTL) {
            console.log(`[useOptimizedPagination] Using localStorage cache for page ${page} (age: ${cacheAge}ms)`);
            setData(localCached.data);
            setTotal(localCached.total);
            
            // Move to memory cache for faster access
            memoryCache.set(fullCacheKey, localCached);
            
            setLoading(false);
            setIsFromCache(true);
            
            // Check if offline - if so, don't try to fetch
            if (!isOnline() && enableOffline) {
              setIsOffline(true);
              toast.info('Offline: Showing cached data', { duration: 3000 });
              return;
            }
            
            // Continue to fetch fresh data in background (if online)
            // but show cached data immediately
          } else {
            // Cache expired in localStorage, remove it
            localStorage.removeItem(localStorageKey);
          }
        }
      }
    }

    // Fetch from API
    if (!isOnline() && enableOffline) {
      setIsOffline(true);
      toast.warning('Offline: Showing cached data only', { duration: 5000 });
      
      // Try to show any cached data we have
      const localCached = getLocalStorageCache<T>(localStorageKey);
      if (localCached) {
        setData(localCached.data);
        setTotal(localCached.total);
        setIsFromCache(true);
      }
      
      setLoading(false);
      return;
    }

    setIsOffline(false);

    try {
      const offset = (page - 1) * pageSize;
      // Use ref to always get the latest fetchPage function
      const response = await fetchPageRef.current(page, pageSize, offset);
      
      if (!isMountedRef.current) return;

      // Handle different response formats
      let pageData: T[];
      let totalRecords: number;

      if (Array.isArray(response)) {
        // Response is directly an array
        pageData = response;
        totalRecords = response.length;
      } else if (response && typeof response === 'object') {
        // Response has data and total properties
        pageData = response.data || (response as any).records || [];
        totalRecords = response.total || pageData.length;
      } else {
        throw new Error('Invalid response format from API');
      }

      setData(pageData);
      setTotal(totalRecords);
      setIsFromCache(false);

      // Cache the results
      const cacheData = {
        data: pageData,
        total: totalRecords,
        timestamp: Date.now()
      };

      // Save to memory cache
      memoryCache.set(fullCacheKey, cacheData);

      // Save to localStorage for offline access
      if (enableOffline) {
        setLocalStorageCache(localStorageKey, pageData, totalRecords);
      }

      console.log(`[useOptimizedPagination] Loaded page ${page} with ${pageData.length} items, total: ${totalRecords}`);
    } catch (err) {
      if (!isMountedRef.current) return;

      const error = err instanceof Error ? err : new Error('Failed to load page');
      setError(error);
      console.error(`[useOptimizedPagination] Error loading page ${page}:`, error);

      // Fallback to cache if available
      const localCached = getLocalStorageCache<T>(localStorageKey);
      if (localCached) {
        console.log('[useOptimizedPagination] Using cached data as fallback');
        setData(localCached.data);
        setTotal(localCached.total);
        setIsFromCache(true);
        toast.warning('Using cached data due to server error', { duration: 3000 });
      } else {
        toast.error('Failed to load page data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchPage, pageSize, cacheKey, cacheTTL, enableOffline]);

  /**
   * Prefetch next page in background
   */
  const prefetchNextPage = useCallback(async (currentPageNum: number): Promise<void> => {
    if (!enablePrefetch || !isOnline()) return;

    // Cancel any existing prefetch
    if (prefetchControllerRef.current) {
      prefetchControllerRef.current.abort();
    }

    const nextPage = currentPageNum + 1;
    const fullCacheKey = generateCacheKey(cacheKey, nextPage, filtersRef.current);
    
    // Skip if already cached
    if (memoryCache.has(fullCacheKey)) {
      return;
    }

    const localStorageKey = `pagination_cache_${fullCacheKey}`;
    const localCached = getLocalStorageCache<T>(localStorageKey);
    if (localCached && Date.now() - localCached.timestamp < cacheTTL) {
      // Already cached and fresh
      return;
    }

    // Prefetch in background
    prefetchControllerRef.current = new AbortController();
    
    try {
      const offset = (nextPage - 1) * pageSize;
      // Use ref to always get the latest fetchPage function
      const response = await fetchPageRef.current(nextPage, pageSize, offset);
      
      if (prefetchControllerRef.current.signal.aborted) return;

      let pageData: T[];
      let totalRecords: number;

      if (Array.isArray(response)) {
        pageData = response;
        totalRecords = response.length;
      } else if (response && typeof response === 'object') {
        pageData = response.data || (response as any).records || [];
        totalRecords = response.total || pageData.length;
      } else {
        return;
      }

      // Cache the prefetched data
      const cacheData = {
        data: pageData,
        total: totalRecords,
        timestamp: Date.now()
      };

      memoryCache.set(fullCacheKey, cacheData);
      
      if (enableOffline) {
        setLocalStorageCache(localStorageKey, pageData, totalRecords);
      }

      console.log(`[useOptimizedPagination] Prefetched page ${nextPage}`);
    } catch (err) {
      // Silently fail prefetch - not critical
      console.log(`[useOptimizedPagination] Prefetch failed for page ${nextPage}:`, err);
    }
  }, [fetchPage, pageSize, cacheKey, cacheTTL, enablePrefetch, enableOffline]);

  /**
   * Debounced page navigation
   */
  const debouncedGoToPage = useMemo(
    () =>
      debounce((page: number) => {
        if (page !== currentPage) {
          setCurrentPage(page);
          loadPage(page);
        }
      }, debounceDelay),
    [loadPage, debounceDelay, currentPage]
  );

  /**
   * Navigate to specific page
   */
  const goToPage = useCallback((page: number) => {
    if (page < 1 || (total > 0 && page > Math.ceil(total / pageSize))) {
      return;
    }
    debouncedGoToPage(page);
  }, [debouncedGoToPage, total, pageSize]);

  /**
   * Navigate to next page
   */
  const nextPage = useCallback(() => {
    const next = currentPage + 1;
    const maxPages = total > 0 ? Math.ceil(total / pageSize) : Infinity;
    if (next <= maxPages) {
      goToPage(next);
    }
  }, [currentPage, total, pageSize, goToPage]);

  /**
   * Navigate to previous page
   */
  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  /**
   * Refresh current page (bypass cache)
   */
  const refresh = useCallback(() => {
    loadPage(currentPage, true);
  }, [currentPage, loadPage]);

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(() => {
    // Clear memory cache for this cacheKey
    const keysToDelete: string[] = [];
    memoryCache.forEach((_, key) => {
      if (key.startsWith(cacheKey)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => memoryCache.delete(key));

    // Clear localStorage cache for this cacheKey
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`pagination_cache_${cacheKey}`)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[useOptimizedPagination] Error clearing localStorage cache:', error);
    }

    console.log('[useOptimizedPagination] Cache cleared');
    toast.success('Cache cleared');
  }, [cacheKey]);

  // Track previous filter hash to detect filter changes
  const prevFilterHashRef = useRef<string>('');
  const currentFilterHash = useMemo(() => {
    return JSON.stringify(filters || {});
  }, [filters]);

  // Load initial page
  useEffect(() => {
    isMountedRef.current = true;
    loadPage(currentPage);
    prevFilterHashRef.current = currentFilterHash;
    return () => {
      isMountedRef.current = false;
      if (prefetchControllerRef.current) {
        prefetchControllerRef.current.abort();
      }
    };
  }, []); // Only on mount

  // Handle page changes
  useEffect(() => {
    if (currentPage !== initialPage) {
      loadPage(currentPage);
    }
  }, [currentPage]);

  // Handle filter changes - automatically refetch when filters change
  useEffect(() => {
    if (prevFilterHashRef.current && prevFilterHashRef.current !== currentFilterHash) {
      console.log('[useOptimizedPagination] Filters changed, clearing cache and refetching...');
      // Clear cache for old filter set
      const oldCacheKeys: string[] = [];
      memoryCache.forEach((_, key) => {
        if (key.startsWith(cacheKey)) {
          oldCacheKeys.push(key);
        }
      });
      oldCacheKeys.forEach(key => memoryCache.delete(key));

      // Clear localStorage cache for old filter set
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(`pagination_cache_${cacheKey}`)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.error('[useOptimizedPagination] Error clearing localStorage on filter change:', error);
      }

      // Reset to page 1 and reload
      setCurrentPage(1);
      loadPage(1, true); // Bypass cache to get fresh data with new filters
      prevFilterHashRef.current = currentFilterHash;
    } else if (!prevFilterHashRef.current) {
      prevFilterHashRef.current = currentFilterHash;
    }
  }, [currentFilterHash, cacheKey, loadPage]);

  // Prefetch next page after current page loads
  useEffect(() => {
    if (!loading && data.length > 0 && enablePrefetch) {
      const timeoutId = setTimeout(() => {
        prefetchNextPage(currentPage);
      }, 500); // Small delay to not block UI
      return () => clearTimeout(timeoutId);
    }
  }, [loading, data.length, currentPage, prefetchNextPage, enablePrefetch]);

  // Listen to online/offline events
  useEffect(() => {
    if (!enableOffline) return;

    const handleOnline = () => {
      setIsOffline(false);
      console.log('[useOptimizedPagination] Back online, refreshing page');
      loadPage(currentPage, true);
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.info('Offline: Showing cached data', { duration: 3000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableOffline, currentPage, loadPage]);

  // Calculate derived values
  const totalPages = useMemo(() => {
    return total > 0 ? Math.ceil(total / pageSize) : 0;
  }, [total, pageSize]);

  return {
    data,
    loading,
    error,
    total,
    totalPages,
    currentPage,
    goToPage,
    nextPage,
    previousPage,
    refresh,
    clearCache,
    isOffline,
    isFromCache
  };
}

