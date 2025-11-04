import React, { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { SafeText } from '@/components/ui/safe-display';

export function DataLoadingDebugger() {
  const { user } = useAzureADAuth();
  const { 
    vitAssets, 
    vitInspections, 
    regions, 
    districts, 
    op5Faults, 
    controlSystemOutages,
    clearVITAssetsCache 
  } = useData();
  
  const [cacheInfo, setCacheInfo] = useState<any[]>([]);
  const [loadingStates, setLoadingStates] = useState({
    vitAssets: false,
    vitInspections: false,
    regions: false,
    districts: false
  });

  useEffect(() => {
    const updateCacheInfo = async () => {
      try {
        const { cache } = await import('@/utils/cache');
        const info = await cache.getInfo();
        setCacheInfo(Array.isArray(info) ? info : []);
      } catch (error) {
        console.error('Error getting cache info:', error);
        setCacheInfo([]);
      }
    };

    updateCacheInfo();
    const interval = setInterval(updateCacheInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearVITCache = async () => {
    try {
      await clearVITAssetsCache();
              console.log('Switchgear assets cache cleared');
      // Force reload of VIT assets
      window.location.reload();
    } catch (error) {
      console.error('Error clearing VIT cache:', error);
    }
  };

  const getDataStatus = (data: any[], name: string) => {
    if (!data || data.length === 0) {
      return { status: 'empty', icon: <AlertCircle className="h-4 w-4 text-red-500" /> };
    }
    return { status: 'loaded', icon: <CheckCircle className="h-4 w-4 text-green-500" /> };
  };

          const vitAssetsStatus = getDataStatus(vitAssets, 'Switchgear Assets');
  const vitInspectionsStatus = getDataStatus(vitInspections, 'VIT Inspections');
  const regionsStatus = getDataStatus(regions, 'Regions');
  const districtsStatus = getDataStatus(districts, 'Districts');
  const op5FaultsStatus = getDataStatus(op5Faults, 'OP5 Faults');
  const controlOutagesStatus = getDataStatus(controlSystemOutages, 'Control Outages');

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Loading Debugger
        </CardTitle>
        <CardDescription>
          Monitor data loading states and cache information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-semibold">User Information</h3>
            <div className="text-sm space-y-1">
              <p><strong>User ID:</strong> <SafeText content={user?.id || 'Not logged in'} /></p>
              <p><strong>Role:</strong> <SafeText content={user?.role || 'Unknown'} /></p>
              <p><strong>Region:</strong> <SafeText content={user?.region || 'Not assigned'} /></p>
              <p><strong>District:</strong> <SafeText content={user?.district || 'Not assigned'} /></p>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold">Data Status</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {vitAssetsStatus.icon}
                <span>Switchgear Assets: {vitAssets?.length || 0} items</span>
                <Badge variant={vitAssetsStatus.status === 'loaded' ? 'default' : 'destructive'}>
                  {vitAssetsStatus.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                {vitInspectionsStatus.icon}
                <span>VIT Inspections: {vitInspections?.length || 0} items</span>
                <Badge variant={vitInspectionsStatus.status === 'loaded' ? 'default' : 'destructive'}>
                  {vitInspectionsStatus.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                {regionsStatus.icon}
                <span>Regions: {regions?.length || 0} items</span>
                <Badge variant={regionsStatus.status === 'loaded' ? 'default' : 'destructive'}>
                  {regionsStatus.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                {districtsStatus.icon}
                <span>Districts: {districts?.length || 0} items</span>
                <Badge variant={districtsStatus.status === 'loaded' ? 'default' : 'destructive'}>
                  {districtsStatus.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                {op5FaultsStatus.icon}
                <span>OP5 Faults: {op5Faults?.length || 0} items</span>
                <Badge variant={op5FaultsStatus.status === 'loaded' ? 'default' : 'destructive'}>
                  {op5FaultsStatus.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                {controlOutagesStatus.icon}
                <span>Control Outages: {controlSystemOutages?.length || 0} items</span>
                <Badge variant={controlOutagesStatus.status === 'loaded' ? 'default' : 'destructive'}>
                  {controlOutagesStatus.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Cache Information */}
        <div className="space-y-2">
          <h3 className="font-semibold">Cache Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(cacheInfo) && cacheInfo.length > 0 ? (
              cacheInfo.map((cache: any) => (
                <div key={cache.key} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">{cache.key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={cache.valid ? 'default' : 'secondary'}>
                      {cache.valid ? 'Valid' : 'Invalid'}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {Math.round(cache.age / 1000)}s old
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center text-gray-500 py-4">
                No cache information available
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            onClick={handleClearVITCache} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Clear VIT Cache
          </Button>
          
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 