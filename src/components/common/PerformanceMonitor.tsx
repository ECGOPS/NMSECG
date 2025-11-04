import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PerformanceMetrics {
  apiCalls: number;
  cacheHits: number;
  averageResponseTime: number;
  lastUpdate: Date;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    apiCalls: 0,
    cacheHits: 0,
    averageResponseTime: 0,
    lastUpdate: new Date()
  });

  useEffect(() => {
    // Listen for performance events
    const handleApiCall = () => {
      setMetrics(prev => ({
        ...prev,
        apiCalls: prev.apiCalls + 1,
        lastUpdate: new Date()
      }));
    };

    const handleCacheHit = () => {
      setMetrics(prev => ({
        ...prev,
        cacheHits: prev.cacheHits + 1,
        lastUpdate: new Date()
      }));
    };

    window.addEventListener('api-call', handleApiCall);
    window.addEventListener('cache-hit', handleCacheHit);

    return () => {
      window.removeEventListener('api-call', handleApiCall);
      window.removeEventListener('cache-hit', handleCacheHit);
    };
  }, []);

  const cacheHitRate = metrics.apiCalls > 0 ? (metrics.cacheHits / metrics.apiCalls * 100).toFixed(1) : '0';

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-sm">Performance Monitor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">API Calls:</span>
          <Badge variant="secondary">{metrics.apiCalls}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Cache Hits:</span>
          <Badge variant="outline">{metrics.cacheHits}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Cache Hit Rate:</span>
          <Badge variant={parseFloat(cacheHitRate) > 50 ? "default" : "destructive"}>
            {cacheHitRate}%
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Last Update:</span>
          <span className="text-xs">{metrics.lastUpdate.toLocaleTimeString()}</span>
        </div>
      </CardContent>
    </Card>
  );
} 