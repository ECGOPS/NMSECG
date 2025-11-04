import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CacheStatus {
  vitAssets: { valid: boolean; age: number; count: number };
  vitInspections: { valid: boolean; age: number; count: number };
  networkInspections: { valid: boolean; age: number; count: number };
  loadMonitoring: { valid: boolean; age: number; count: number };
  op5Faults: { valid: boolean; age: number; count: number };
  controlOutages: { valid: boolean; age: number; count: number };
}

export function CacheStatus() {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    vitAssets: { valid: false, age: 0, count: 0 },
    vitInspections: { valid: false, age: 0, count: 0 },
    networkInspections: { valid: false, age: 0, count: 0 },
    loadMonitoring: { valid: false, age: 0, count: 0 },
    op5Faults: { valid: false, age: 0, count: 0 },
    controlOutages: { valid: false, age: 0, count: 0 }
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateCacheStatus = () => {
      // This would need to be connected to the actual cache state
      // For now, we'll simulate it
      const now = Date.now();
      setCacheStatus({
        vitAssets: { valid: true, age: now - (Date.now() - 60000), count: 20 },
        vitInspections: { valid: true, age: now - (Date.now() - 120000), count: 15 },
        networkInspections: { valid: false, age: 0, count: 0 },
        loadMonitoring: { valid: true, age: now - (Date.now() - 30000), count: 25 },
        op5Faults: { valid: false, age: 0, count: 0 },
        controlOutages: { valid: false, age: 0, count: 0 }
      });
    };

    updateCacheStatus();
    const interval = setInterval(updateCacheStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatAge = (age: number) => {
    if (age < 60000) return `${Math.floor(age / 1000)}s`;
    return `${Math.floor(age / 60000)}m`;
  };

  const getStatusColor = (valid: boolean) => {
    return valid ? 'bg-green-500' : 'bg-red-500';
  };

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        Show Cache Status
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm">Cache Status</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
          >
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(cacheStatus).map(([key, status]) => (
          <div key={key} className="flex justify-between items-center">
            <span className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
            <div className="flex items-center gap-2">
              <Badge 
                variant={status.valid ? "default" : "secondary"}
                className={status.valid ? "bg-green-500" : "bg-gray-500"}
              >
                {status.valid ? "Valid" : "Invalid"}
              </Badge>
              {status.valid && (
                <>
                  <span className="text-xs text-muted-foreground">
                    {formatAge(status.age)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({status.count})
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
} 