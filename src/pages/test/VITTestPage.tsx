import React from 'react';
import { useData } from '@/contexts/DataContext';
import { CacheTest } from '@/components/common/CacheTest';
import { DataDebugger } from '@/components/common/DataDebugger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database, Clock } from 'lucide-react';

export default function VITTestPage() {
  const { vitAssets, isLoadingVITAssets, clearVITAssetsCache } = useData();

  const handleRefresh = async () => {
    try {
      await clearVITAssetsCache();
      // Force a reload by triggering the useEffect in DataContext
      window.location.reload();
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">VIT System Test</h1>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Force Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CacheTest />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Switchgear Assets Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Loading Status:</span>
              <Badge variant={isLoadingVITAssets ? "secondary" : "default"}>
                {isLoadingVITAssets ? "Loading..." : "Ready"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>Assets Count:</span>
              <Badge variant="outline">
                {vitAssets?.length || 0} assets
              </Badge>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Sample Assets:</h4>
              {vitAssets && vitAssets.length > 0 ? (
                <div className="space-y-1">
                  {vitAssets.slice(0, 3).map((asset, index) => (
                    <div key={asset.id} className="text-sm p-2 bg-muted rounded">
                      <div className="font-medium">{asset.serialNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {asset.region} - {asset.district} - {asset.status}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <strong>Location:</strong> {asset.location || "Not specified"}
                      </div>
                      {asset.gpsCoordinates && (
                        <div className="text-xs text-muted-foreground">
                          <strong>GPS:</strong> {asset.gpsCoordinates}
                        </div>
                      )}
                      {asset.photoUrl && (
                        <div className="text-xs text-muted-foreground">
                          <strong>Photo:</strong> Available
                        </div>
                      )}
                    </div>
                  ))}
                  {vitAssets.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      ... and {vitAssets.length - 3} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No assets loaded
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <DataDebugger />

      <Card>
        <CardHeader>
          <CardTitle>Expected Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Cache expires after 5 minutes</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span>Data stored in IndexedDB for persistence</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span>Progressive loading: 50 assets initially, rest in background</span>
          </div>
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>Role-based filtering applied at API level</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span>Location and GPS coordinates should be displayed</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📷</span>
            <span>Photo URLs should be available and displayed</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 