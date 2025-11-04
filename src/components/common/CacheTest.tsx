import React, { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Clock, CheckCircle, XCircle } from 'lucide-react';

export function CacheTest() {
  const { testCache, clearVITAssetsCache, isLoadingVITAssets } = useData();
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const runCacheTest = async () => {
    setIsTesting(true);
    try {
      const result = await testCache();
      setCacheInfo(result);
      console.log('Cache test result:', result);
      } catch (error) {
      console.error('Cache test failed:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const clearCache = async () => {
    try {
      await clearVITAssetsCache();
      setCacheInfo(null);
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  useEffect(() => {
    runCacheTest();
  }, []);

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          VIT Cache Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runCacheTest} 
            disabled={isTesting}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
          Test Cache
        </Button>
          <Button 
            onClick={clearCache} 
            variant="destructive"
            size="sm"
          >
            Clear Cache
        </Button>
        </div>

        {cacheInfo && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">IndexedDB Cache</CardTitle>
                </CardHeader>
                <CardContent>
                  {cacheInfo.indexedDB ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Available</span>
                      </div>
                      <div className="text-xs space-y-1">
                        <p>Data Length: {Array.isArray(cacheInfo.indexedDB.data) ? cacheInfo.indexedDB.data.length : 'N/A'}</p>
                        <p>Timestamp: {new Date(cacheInfo.indexedDB.timestamp).toLocaleString()}</p>
                        <p>Age: {Math.round((Date.now() - cacheInfo.indexedDB.timestamp) / 1000)}s</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Not Available</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Memory Cache</CardTitle>
                </CardHeader>
                <CardContent>
                  {cacheInfo.memory.data.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Available</span>
                      </div>
                      <div className="text-xs space-y-1">
                        <p>Data Length: {cacheInfo.memory.data.length}</p>
                        <p>Timestamp: {new Date(cacheInfo.memory.timestamp).toLocaleString()}</p>
                        <p>Age: {Math.round((Date.now() - cacheInfo.memory.timestamp) / 1000)}s</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Empty</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cache Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cacheInfo.cacheInfo.map((info: any, index: number) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <span>{info.key}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={info.valid ? "default" : "destructive"}>
                          {info.valid ? "Valid" : "Expired"}
                        </Badge>
                        <span>{Math.round(info.age / 1000)}s</span>
                        <span>{info.size} bytes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoadingVITAssets && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Loading switchgear assets...
          </div>
        )}
      </CardContent>
    </Card>
  );
} 