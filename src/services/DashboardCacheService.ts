/**
 * DashboardCacheService - Enterprise-grade caching service for dashboard API calls
 * 
 * Implements stale-while-revalidate pattern with enterprise features:
 * - Request deduplication (prevents duplicate concurrent requests)
 * - Memory management with size limits and LRU eviction
 * - Performance metrics and telemetry
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern for failing endpoints
 * - Cache versioning and invalidation strategies
 * - Structured logging and observability
 * 
 * Cache Strategy:
 * - Memory cache for instant access (survives component remounts)
 * - IndexedDB for persistence across page refreshes
 * - Cache expiration: 30 seconds (fresh), 2 minutes (stale but usable)
 * - LRU eviction when memory limit reached (default: 50MB)
 */

import { indexedDBCache, CacheConfig } from '@/utils/cache';

interface CachedApiResponse<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  staleAt: number; // After this time, data is stale but still usable
  accessCount: number; // For LRU eviction
  lastAccessed: number; // For LRU eviction
  size: number; // Memory size in bytes
  version?: string; // Cache version for breaking changes
}

interface FetchOptions {
  forceRefresh?: boolean; // Bypass cache completely
  maxAge?: number; // Cache freshness duration (default: 30 seconds)
  staleAge?: number; // Cache staleness duration (default: 2 minutes)
  retries?: number; // Number of retry attempts (default: 3)
  retryDelay?: number; // Initial retry delay in ms (default: 1000)
}

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  backgroundRefreshes: number;
  evictions: number;
  totalRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  lastUpdated: number;
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class DashboardCacheService {
  private static instance: DashboardCacheService;
  private memoryCache: Map<string, CachedApiResponse> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private circuitBreakers: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();
  
  // Metrics tracking
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    backgroundRefreshes: 0,
    evictions: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    lastUpdated: Date.now()
  };

  // Configuration constants
  private readonly DEFAULT_MAX_AGE = 30 * 1000; // 30 seconds - fresh
  private readonly DEFAULT_STALE_AGE = 2 * 60 * 1000; // 2 minutes - stale but usable
  private readonly MAX_MEMORY_SIZE = 50 * 1024 * 1024; // 50MB memory limit
  private readonly MAX_CACHE_ENTRIES = 200; // Maximum number of cache entries
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 failures
  private readonly CIRCUIT_BREAKER_RESET_TIME = 60 * 1000; // Reset after 60 seconds
  private readonly DEFAULT_RETRIES = 3;
  private readonly DEFAULT_RETRY_DELAY = 1000;
  private readonly CACHE_VERSION = '1.0.0'; // Increment on breaking changes

  // Response time tracking
  private responseTimes: number[] = [];
  private readonly MAX_RESPONSE_TIME_SAMPLES = 100;

  private constructor() {
    // Clean up expired memory cache entries periodically
    setInterval(() => {
      this.cleanupMemoryCache();
      this.cleanupPendingRequests();
      this.updateMetrics();
    }, 60000); // Every minute

    // Clean up old response time samples
    setInterval(() => {
      if (this.responseTimes.length > this.MAX_RESPONSE_TIME_SAMPLES) {
        this.responseTimes = this.responseTimes.slice(-this.MAX_RESPONSE_TIME_SAMPLES);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  static getInstance(): DashboardCacheService {
    if (!DashboardCacheService.instance) {
      DashboardCacheService.instance = new DashboardCacheService();
    }
    return DashboardCacheService.instance;
  }

  /**
   * Generate cache key from API endpoint and parameters
   */
  private generateCacheKey(endpoint: string, params?: URLSearchParams | string): string {
    const paramsStr = params instanceof URLSearchParams 
      ? params.toString() 
      : params || '';
    // Sort params for consistent keys (a=b&c=d === c=d&a=b)
    if (paramsStr) {
      const sortedParams = paramsStr.split('&').sort().join('&');
      return `dashboard:${endpoint}:${sortedParams}`;
    }
    return `dashboard:${endpoint}:`;
  }

  /**
   * Check if cached data is fresh (within maxAge)
   */
  private isFresh(cached: CachedApiResponse, maxAge: number): boolean {
    const age = Date.now() - cached.timestamp;
    return age < maxAge;
  }

  /**
   * Check if cached data is expired (beyond staleAge)
   */
  private isStale(cached: CachedApiResponse, staleAge: number): boolean {
    const age = Date.now() - cached.timestamp;
    return age >= staleAge;
  }

  /**
   * Calculate memory size of cached data
   */
  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback estimation
      return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    }
  }

  /**
   * Update access tracking for LRU eviction
   */
  private updateAccessTracking(key: string, cached: CachedApiResponse): void {
    cached.accessCount++;
    cached.lastAccessed = Date.now();
  }

  /**
   * Get cached data (from memory first, then IndexedDB)
   */
  private async getCached<T>(key: string): Promise<CachedApiResponse<T> | null> {
    // Try memory cache first (fastest)
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached) {
      // Check cache version compatibility
      if (memoryCached.version && memoryCached.version !== this.CACHE_VERSION) {
        console.warn(`[DashboardCacheService] Cache version mismatch for ${key}, invalidating`);
        await this.invalidateByKey(key);
        return null;
      }
      this.updateAccessTracking(key, memoryCached);
      return memoryCached;
    }

    // Try IndexedDB cache
    try {
      const indexedDBCached = await indexedDBCache.get<CachedApiResponse<T>>(key);
      if (indexedDBCached) {
        // Check cache version compatibility
        if (indexedDBCached.version && indexedDBCached.version !== this.CACHE_VERSION) {
          console.warn(`[DashboardCacheService] IndexedDB cache version mismatch for ${key}, invalidating`);
          await this.invalidateByKey(key);
          return null;
        }
        // Store in memory cache for faster access
        this.memoryCache.set(key, indexedDBCached);
        this.updateAccessTracking(key, indexedDBCached);
        return indexedDBCached;
      }
    } catch (error) {
      console.warn('[DashboardCacheService] Error reading from IndexedDB:', error);
      this.recordError();
    }

    return null;
  }

  /**
   * Store data in both memory and IndexedDB cache with LRU eviction
   */
  private async setCached<T>(
    key: string, 
    data: T, 
    maxAge: number, 
    staleAge: number
  ): Promise<void> {
    const now = Date.now();
    const size = this.calculateSize(data);
    
    // Check memory limits and evict if necessary
    await this.enforceMemoryLimits(size);

    const cached: CachedApiResponse<T> = {
      data,
      timestamp: now,
      expiresAt: now + staleAge,
      staleAt: now + maxAge,
      accessCount: 1,
      lastAccessed: now,
      size,
      version: this.CACHE_VERSION
    };

    // Store in memory cache
    this.memoryCache.set(key, cached);
    this.metrics.memoryUsage += size;

    // Store in IndexedDB for persistence
    try {
      await indexedDBCache.set(key, cached, { maxAge: staleAge });
    } catch (error) {
      console.warn('[DashboardCacheService] Error writing to IndexedDB:', error);
      this.recordError();
      // Continue even if IndexedDB fails - memory cache still works
    }
  }

  /**
   * Enforce memory limits with LRU eviction
   */
  private async enforceMemoryLimits(newEntrySize: number): Promise<void> {
    // Calculate current memory usage
    let currentMemoryUsage = 0;
    for (const cached of this.memoryCache.values()) {
      currentMemoryUsage += cached.size || 0;
    }

    // If adding new entry would exceed limit, evict least recently used
    if (currentMemoryUsage + newEntrySize > this.MAX_MEMORY_SIZE || 
        this.memoryCache.size >= this.MAX_CACHE_ENTRIES) {
      const entries = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed); // Sort by last access

      let freedMemory = 0;
      const entriesToEvict: string[] = [];

      for (const [key, cached] of entries) {
        if ((currentMemoryUsage - freedMemory + newEntrySize <= this.MAX_MEMORY_SIZE) &&
            (this.memoryCache.size - entriesToEvict.length < this.MAX_CACHE_ENTRIES)) {
          break;
        }
        freedMemory += cached.size || 0;
        entriesToEvict.push(key);
      }

      // Evict entries
      for (const key of entriesToEvict) {
        await this.invalidateByKey(key);
        this.metrics.evictions++;
      }

      if (entriesToEvict.length > 0) {
        console.log(`[DashboardCacheService] Evicted ${entriesToEvict.length} cache entries (freed ${freedMemory} bytes)`);
      }
    }
  }

  /**
   * Check circuit breaker status
   */
  private checkCircuitBreaker(endpoint: string): boolean {
    const breaker = this.circuitBreakers.get(endpoint);
    if (!breaker) return true; // No breaker = allow request

    // Reset circuit breaker if enough time has passed
    if (breaker.isOpen && Date.now() - breaker.lastFailure > this.CIRCUIT_BREAKER_RESET_TIME) {
      console.log(`[DashboardCacheService] Circuit breaker reset for ${endpoint}`);
      breaker.isOpen = false;
      breaker.failures = 0;
      return true;
    }

    return !breaker.isOpen; // Allow if circuit is closed
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitBreakerFailure(endpoint: string): void {
    let breaker = this.circuitBreakers.get(endpoint);
    if (!breaker) {
      breaker = { failures: 0, lastFailure: 0, isOpen: false };
      this.circuitBreakers.set(endpoint, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.isOpen = true;
      console.warn(`[DashboardCacheService] Circuit breaker OPEN for ${endpoint} (${breaker.failures} failures)`);
    }
  }

  /**
   * Record circuit breaker success
   */
  private recordCircuitBreakerSuccess(endpoint: string): void {
    const breaker = this.circuitBreakers.get(endpoint);
    if (breaker && breaker.failures > 0) {
      breaker.failures = Math.max(0, breaker.failures - 1); // Reduce failure count
    }
  }

  /**
   * Record metrics
   */
  private recordError(): void {
    this.metrics.errors++;
    this.updateMetrics();
  }

  private recordHit(): void {
    this.metrics.hits++;
    this.updateMetrics();
  }

  private recordMiss(): void {
    this.metrics.misses++;
    this.updateMetrics();
  }

  private recordBackgroundRefresh(): void {
    this.metrics.backgroundRefreshes++;
    this.updateMetrics();
  }

  private recordResponseTime(ms: number): void {
    this.responseTimes.push(ms);
    if (this.responseTimes.length > this.MAX_RESPONSE_TIME_SAMPLES) {
      this.responseTimes.shift();
    }

    // Update average
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = sum / this.responseTimes.length;
  }

  private updateMetrics(): void {
    this.metrics.totalRequests = this.metrics.hits + this.metrics.misses;
    this.metrics.cacheHitRate = this.metrics.totalRequests > 0
      ? (this.metrics.hits / this.metrics.totalRequests) * 100
      : 0;
    this.metrics.lastUpdated = Date.now();

    // Calculate current memory usage
    let memoryUsage = 0;
    for (const cached of this.memoryCache.values()) {
      memoryUsage += cached.size || 0;
    }
    this.metrics.memoryUsage = memoryUsage;
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async retryFetch<T>(
    fetchFn: () => Promise<T>,
    retries: number,
    retryDelay: number,
    endpoint: string
  ): Promise<T> {
    let lastError: Error;
    let currentDelay = retryDelay;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await fetchFn();
        // Success - reset circuit breaker
        this.recordCircuitBreakerSuccess(endpoint);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        const statusCode = (error as any).status || (error as any).statusCode;
        if (statusCode >= 400 && statusCode < 500) {
          throw error;
        }

        if (attempt < retries) {
          console.log(`[DashboardCacheService] Retry attempt ${attempt}/${retries} for ${endpoint} (delay: ${currentDelay}ms)`);
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay *= 2; // Exponential backoff
        }
      }
    }

    // All retries failed - record circuit breaker failure
    this.recordCircuitBreakerFailure(endpoint);
    throw lastError!;
  }

  /**
   * Clean up expired memory cache entries
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, cached] of this.memoryCache.entries()) {
      if (now > cached.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      const cached = this.memoryCache.get(key);
      if (cached) {
        this.metrics.memoryUsage -= cached.size || 0;
      }
      this.memoryCache.delete(key);
    });

    if (keysToDelete.length > 0) {
      console.log(`[DashboardCacheService] Cleaned up ${keysToDelete.length} expired memory cache entries`);
    }
  }

  /**
   * Clean up stale pending requests
   */
  private cleanupPendingRequests(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > staleThreshold) {
        this.pendingRequests.delete(key);
        console.warn(`[DashboardCacheService] Cleaned up stale pending request: ${key}`);
      }
    }
  }

  /**
   * Fetch with smart caching (stale-while-revalidate pattern)
   * 
   * @param endpoint API endpoint
   * @param params Query parameters
   * @param fetchFn Function to fetch fresh data
   * @param options Cache options
   * @returns Promise with cached or fresh data
   */
  async fetchWithCache<T>(
    endpoint: string,
    params: URLSearchParams | string,
    fetchFn: () => Promise<T>,
    options: FetchOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const {
      forceRefresh = false,
      maxAge = this.DEFAULT_MAX_AGE,
      staleAge = this.DEFAULT_STALE_AGE,
      retries = this.DEFAULT_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY
    } = options;

    const cacheKey = this.generateCacheKey(endpoint, params);

    // Check circuit breaker
    if (!this.checkCircuitBreaker(endpoint)) {
      console.warn(`[DashboardCacheService] Circuit breaker OPEN for ${endpoint}, returning stale cache if available`);
      const staleCached = await this.getCached<T>(cacheKey);
      if (staleCached && !this.isStale(staleCached, staleAge * 2)) {
        return staleCached.data;
      }
      throw new Error(`Circuit breaker open for ${endpoint} and no stale cache available`);
    }

    // Check for pending request (request deduplication)
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest && !forceRefresh) {
      console.log(`[DashboardCacheService] Request deduplication for ${cacheKey}`);
      try {
        const result = await pendingRequest.promise;
        this.recordResponseTime(Date.now() - startTime);
        return result;
      } catch (error) {
        // If pending request failed, continue with normal flow
        this.pendingRequests.delete(cacheKey);
      }
    }

    // Force refresh - bypass cache completely
    if (forceRefresh) {
      console.log(`[DashboardCacheService] Force refresh for ${cacheKey}`);
      const fetchPromise = this.retryFetch(
        fetchFn,
        retries,
        retryDelay,
        endpoint
      ).then(async (freshData) => {
        await this.setCached(cacheKey, freshData, maxAge, staleAge);
        this.pendingRequests.delete(cacheKey);
        return freshData;
      }).catch((error) => {
        this.pendingRequests.delete(cacheKey);
        throw error;
      });

      this.pendingRequests.set(cacheKey, {
        promise: fetchPromise,
        timestamp: Date.now()
      });

      const result = await fetchPromise;
      this.recordResponseTime(Date.now() - startTime);
      return result;
    }

    // Check cache
    const cached = await this.getCached<T>(cacheKey);

    if (cached) {
      const isDataFresh = this.isFresh(cached, maxAge);
      const isDataStale = this.isStale(cached, staleAge);

      if (!isDataStale) {
        // Data is either fresh or stale but usable
        this.recordHit();
        console.log(`[DashboardCacheService] Cache ${isDataFresh ? 'HIT (fresh)' : 'HIT (stale)'} for ${cacheKey}`);
        this.recordResponseTime(Date.now() - startTime);

        // If data is stale, fetch fresh data in background (stale-while-revalidate)
        if (!isDataFresh) {
          console.log(`[DashboardCacheService] Background refresh for stale data: ${cacheKey}`);
          this.recordBackgroundRefresh();
          // Don't await - let it update in background
          this.retryFetch(
            fetchFn,
            retries,
            retryDelay,
            endpoint
          )
            .then(async (freshData) => {
              await this.setCached(cacheKey, freshData, maxAge, staleAge);
              console.log(`[DashboardCacheService] Background refresh completed for ${cacheKey}`);
            })
            .catch(error => {
              console.error(`[DashboardCacheService] Background refresh failed for ${cacheKey}:`, error);
              // Don't throw - user already has stale data
            });
        }

        return cached.data;
      } else {
        // Data is expired - remove from cache
        console.log(`[DashboardCacheService] Cache expired for ${cacheKey}`);
        await this.invalidateByKey(cacheKey);
      }
    }

    // Cache miss or expired - fetch fresh data
    this.recordMiss();
    console.log(`[DashboardCacheService] Cache MISS - fetching fresh data for ${cacheKey}`);

    const fetchPromise = this.retryFetch(
      fetchFn,
      retries,
      retryDelay,
      endpoint
    ).then(async (freshData) => {
      await this.setCached(cacheKey, freshData, maxAge, staleAge);
      this.pendingRequests.delete(cacheKey);
      return freshData;
    }).catch((error) => {
      this.pendingRequests.delete(cacheKey);
      // On error, try to return stale cache if available (offline support)
      if (cached && !this.isStale(cached, staleAge * 2)) {
        console.warn(`[DashboardCacheService] Fetch failed, using stale cache for ${cacheKey}`);
        return cached.data;
      }
      throw error;
    });

    this.pendingRequests.set(cacheKey, {
      promise: fetchPromise,
      timestamp: Date.now()
    });

    try {
      const result = await fetchPromise;
      this.recordResponseTime(Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordError();
      throw error;
    }
  }

  /**
   * Invalidate cache by key
   */
  private async invalidateByKey(key: string): Promise<void> {
    const cached = this.memoryCache.get(key);
    if (cached) {
      this.metrics.memoryUsage -= cached.size || 0;
    }
    this.memoryCache.delete(key);
    try {
      await indexedDBCache.delete(key);
    } catch (error) {
      console.warn(`[DashboardCacheService] Error deleting cache:`, error);
    }
  }

  /**
   * Invalidate cache for specific endpoint and params
   */
  async invalidate(endpoint: string, params?: URLSearchParams | string): Promise<void> {
    const cacheKey = this.generateCacheKey(endpoint, params);
    await this.invalidateByKey(cacheKey);
    console.log(`[DashboardCacheService] Invalidated cache for ${cacheKey}`);
  }

  /**
   * Invalidate all dashboard cache entries
   */
  async invalidateAll(): Promise<void> {
    const keysToDelete: string[] = [];
    
    // Collect all dashboard cache keys from memory
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith('dashboard:')) {
        keysToDelete.push(key);
      }
    }

    // Delete from memory
    for (const key of keysToDelete) {
      await this.invalidateByKey(key);
    }

    // Clear pending requests
    this.pendingRequests.clear();

    console.log(`[DashboardCacheService] Invalidated ${keysToDelete.length} cache entries`);
  }

  /**
   * Get cache statistics and metrics
   */
  getCacheStats(): CacheMetrics & { 
    memoryEntries: number; 
    averageResponseTime: number;
    cacheSize: number;
  } {
    this.updateMetrics();
    
    let totalSize = 0;
    for (const cached of this.memoryCache.values()) {
      totalSize += cached.size || 0;
    }

    return {
      ...this.metrics,
      memoryEntries: this.memoryCache.size,
      cacheSize: totalSize,
      averageResponseTime: this.metrics.averageResponseTime
    };
  }

  /**
   * Reset all metrics (for testing/monitoring)
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      backgroundRefreshes: 0,
      evictions: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      lastUpdated: Date.now()
    };
    this.responseTimes = [];
    console.log('[DashboardCacheService] Metrics reset');
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<string, { isOpen: boolean; failures: number }> {
    const status: Record<string, { isOpen: boolean; failures: number }> = {};
    for (const [endpoint, breaker] of this.circuitBreakers.entries()) {
      status[endpoint] = {
        isOpen: breaker.isOpen,
        failures: breaker.failures
      };
    }
    return status;
  }
}

export const dashboardCacheService = DashboardCacheService.getInstance();
export default dashboardCacheService;