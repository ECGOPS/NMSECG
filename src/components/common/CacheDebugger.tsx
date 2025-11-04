import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cache } from '@/utils/cache';

interface CacheMetrics {
  apiCalls: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  lastUpdate: Date;
  cacheStatus: {
    vitAssets: { valid: boolean; age: number; count: number };
    vitInspections: { valid: boolean; age: number; count: number };
    networkInspections: { valid: boolean; age: number; count: number };
    loadMonitoring: { valid: boolean; age: number; count: number };
    op5Faults: { valid: boolean; age: number; count: number };
    controlOutages: { valid: boolean; age: number; count: number };
  };
}

export function CacheDebugger() {
  const [metrics, setMetrics] = useState<CacheMetrics>({
    apiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    lastUpdate: new Date(),
    cacheStatus: {
      vitAssets: { valid: false, age: 0, count: 0 },
      vitInspections: { valid: false, age: 0, count: 0 },
      networkInspections: { valid: false, age: 0, count: 0 },
      loadMonitoring: { valid: false, age: 0, count: 0 },
      op5Faults: { valid: false, age: 0, count: 0 },
      controlOutages: { valid: false, age: 0, count: 0 }
    }
  });

  const [isVisible, setIsVisible] = useState(false);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);

  useEffect(() => {
    const handleApiCall = () => {
      const startTime = Date.now();
      setMetrics(prev => ({
        ...prev,
        apiCalls: prev.apiCalls + 1,
        lastUpdate: new Date()
      }));
      
      // Track response time
      setTimeout(() => {
        const responseTime = Date.now() - startTime;
        setResponseTimes(prev => [...prev.slice(-9), responseTime]);
      }, 100);
    };

    const handleCacheHit = () => {
      setMetrics(prev => ({
        ...prev,
        cacheHits: prev.cacheHits + 1,
        lastUpdate: new Date()
      }));
    };

    const handleCacheMiss = () => {
      setMetrics(prev => ({
        ...prev,
        cacheMisses: prev.cacheMisses + 1,
        lastUpdate: new Date()
      }));
    };

    // Update cache status from IndexedDB
    const updateCacheStatus = async () => {
      const cacheKeys = ['vitAssets', 'vitInspections', 'networkInspections', 'loadMonitoring', 'op5Faults', 'controlOutages'];
      const newCacheStatus: any = {};
      
      for (const key of cacheKeys) {
        try {
          const cachedData = await cache.get(key);
          if (cachedData && typeof cachedData === 'object' && 'timestamp' in cachedData && 'data' in cachedData) {
            const typedData = cachedData as { timestamp: number; data: any[] };
            const age = Date.now() - typedData.timestamp;
            const valid = age < 5 * 60 * 1000; // 5 minutes
            newCacheStatus[key] = {
              valid,
              age,
              count: Array.isArray(typedData.data) ? typedData.data.length : 0
            };
          } else {
            newCacheStatus[key] = { valid: false, age: 0, count: 0 };
          }
        } catch (error) {
          newCacheStatus[key] = { valid: false, age: 0, count: 0 };
        }
      }

      setMetrics(prev => ({
        ...prev,
        cacheStatus: newCacheStatus
      }));
    };

    window.addEventListener('api-call', handleApiCall);
    window.addEventListener('cache-hit', handleCacheHit);
    window.addEventListener('cache-miss', handleCacheMiss);

    updateCacheStatus();
    const interval = setInterval(() => updateCacheStatus(), 2000);

    return () => {
      window.removeEventListener('api-call', handleApiCall);
      window.removeEventListener('cache-hit', handleCacheHit);
      window.removeEventListener('cache-miss', handleCacheMiss);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (responseTimes.length > 0) {
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      setMetrics(prev => ({
        ...prev,
        averageResponseTime: avg
      }));
    }
  }, [responseTimes]);

  const formatAge = (age: number) => {
    if (age < 60000) return `${Math.floor(age / 1000)}s`;
    return `${Math.floor(age / 60000)}m`;
  };

  const getCacheHitRate = () => {
    const total = metrics.apiCalls + metrics.cacheHits;
    return total > 0 ? (metrics.cacheHits / total * 100).toFixed(1) : '0';
  };

  const clearAllCache = async () => {
    try {
      await cache.clear();
      console.log('[CacheDebugger] Cleared all cache from IndexedDB');
    } catch (error) {
      console.error('[CacheDebugger] Failed to clear cache:', error);
    }
  };

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        Cache Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 z-50 max-h-96 overflow-y-auto">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm">Cache Debugger</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllCache}
            >
              Clear Cache
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
            >
              ×
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Performance Metrics */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">Performance</span>
            <Badge variant="secondary">{getCacheHitRate()}% hit rate</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>API Calls: <Badge variant="outline">{metrics.apiCalls}</Badge></div>
            <div>Cache Hits: <Badge variant="outline">{metrics.cacheHits}</Badge></div>
            <div>Cache Misses: <Badge variant="outline">{metrics.cacheMisses}</Badge></div>
            <div>Avg Response: <Badge variant="outline">{Math.round(metrics.averageResponseTime)}ms</Badge></div>
          </div>
        </div>

        {/* Cache Status */}
        <div className="space-y-2">
          <span className="text-xs font-medium">Cache Status</span>
          {Object.entries(metrics.cacheStatus).map(([key, status]) => (
            <div key={key} className="flex justify-between items-center text-xs">
              <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={status.valid ? "default" : "secondary"}
                  className={status.valid ? "bg-green-500" : "bg-gray-500"}
                >
                  {status.valid ? "Valid" : "Invalid"}
                </Badge>
                {status.valid && (
                  <>
                    <span className="text-muted-foreground">
                      {formatAge(status.age)}
                    </span>
                    <span className="text-muted-foreground">
                      ({status.count})
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Last Update */}
        <div className="text-xs text-muted-foreground">
          Last update: {metrics.lastUpdate.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
} 