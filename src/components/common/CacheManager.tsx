import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Trash2, Database } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

export function CacheManager() {
  const { clearAllCache, refreshVITAssets, isLoadingVITAssets, testCache } = useData();
  const [isClearing, setIsClearing] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<any>(null);

  const handleClearAllCache = async () => {
    setIsClearing(true);
    try {
      await clearAllCache();
      toast({
        title: "Cache Cleared",
        description: "All cached data has been cleared successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear cache. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleRefreshVITAssets = async () => {
    try {
      await refreshVITAssets();
      toast({
        title: "Data Refreshed",
        description: "Switchgear assets have been refreshed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh switchgear assets. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTestCache = async () => {
    try {
      const info = await testCache();
      setCacheInfo(info);
      toast({
        title: "Cache Test Complete",
        description: "Cache information has been retrieved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test cache. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Cache Management
        </CardTitle>
        <CardDescription>
          Manage application cache and refresh data when needed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleRefreshVITAssets}
            disabled={isLoadingVITAssets}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingVITAssets ? 'animate-spin' : ''}`} />
            Refresh Switchgear Assets
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleTestCache}
          >
            <Database className="h-4 w-4 mr-2" />
            Test Cache
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={handleClearAllCache}
            disabled={isClearing}
          >
            <Trash2 className={`h-4 w-4 mr-2 ${isClearing ? 'animate-spin' : ''}`} />
            Clear All Cache
          </Button>
        </div>

        {cacheInfo && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <h4 className="font-medium mb-2">Cache Information</h4>
            <div className="text-sm space-y-1">
              <div><strong>IndexedDB:</strong> {cacheInfo.indexedDB ? 'Available' : 'Not available'}</div>
              <div><strong>Memory Cache:</strong> {cacheInfo.memory.data.length} items</div>
              <div><strong>Cache Age:</strong> {Math.round((Date.now() - cacheInfo.memory.timestamp) / 1000)}s</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 