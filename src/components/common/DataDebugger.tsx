import React, { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Eye, EyeOff } from 'lucide-react';
import { SafeText } from '@/components/ui/safe-display';

export function DataDebugger() {
  const { vitAssets, isLoadingVITAssets } = useData();
  const [showRawData, setShowRawData] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const handleViewAsset = (asset: any) => {
    setSelectedAsset(asset);
    setShowRawData(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            VIT Data Debugger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Total Assets: {vitAssets?.length || 0}</p>
              <p className="text-xs text-muted-foreground">
                Status: {isLoadingVITAssets ? "Loading..." : "Ready"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRawData(!showRawData)}
            >
              {showRawData ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showRawData ? "Hide Raw Data" : "Show Raw Data"}
            </Button>
          </div>

          {showRawData && vitAssets && vitAssets.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">Sample Asset Data:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vitAssets.slice(0, 3).map((asset, index) => (
                  <Card key={asset.id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Asset {index + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewAsset(asset)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-xs space-y-1">
                        <div><strong>ID:</strong> <SafeText content={asset.id} /></div>
                        <div><strong>Serial:</strong> <SafeText content={asset.serialNumber} /></div>
                        <div><strong>Location:</strong> <SafeText content={asset.location || "Not specified"} /></div>
                        <div><strong>GPS:</strong> <SafeText content={asset.gpsCoordinates || "Not specified"} /></div>
                        <div><strong>Photo:</strong> {asset.photoUrl ? "Available" : "Not available"}</div>
                        <div><strong>Status:</strong> <SafeText content={asset.status} /></div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {selectedAsset && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Raw Asset Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
                  {JSON.stringify(selectedAsset, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {vitAssets && vitAssets.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Field Analysis:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant={vitAssets.some(a => a.location) ? "default" : "secondary"}>
                    {vitAssets.filter(a => a.location).length}/{vitAssets.length}
                  </Badge>
                  <span>Location</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={vitAssets.some(a => a.gpsCoordinates) ? "default" : "secondary"}>
                    {vitAssets.filter(a => a.gpsCoordinates).length}/{vitAssets.length}
                  </Badge>
                  <span>GPS</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={vitAssets.some(a => a.photoUrl) ? "default" : "secondary"}>
                    {vitAssets.filter(a => a.photoUrl).length}/{vitAssets.length}
                  </Badge>
                  <span>Photo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {vitAssets.length}
                  </Badge>
                  <span>Total</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 