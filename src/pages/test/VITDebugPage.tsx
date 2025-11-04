import React, { useEffect, useState } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useData } from '@/contexts/DataContext';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, User, Shield } from 'lucide-react';

export default function VITDebugPage() {
  const { user } = useAzureADAuth();
  const { vitAssets, regions, districts, refreshVITAssets, isLoadingVITAssets } = useData();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const updateDebugInfo = () => {
      const info = {
        user: {
          id: user?.id,
          role: user?.role,
          region: user?.region,
          district: user?.district,
          email: user?.email
        },
        data: {
          vitAssetsCount: vitAssets?.length || 0,
          regionsCount: regions?.length || 0,
          districtsCount: districts?.length || 0
        },
        sampleAssets: vitAssets?.slice(0, 3).map(asset => ({
          id: asset.id,
          serialNumber: asset.serialNumber,
          region: asset.region,
          district: asset.district,
          typeOfUnit: asset.typeOfUnit
        })) || []
      };
      setDebugInfo(info);
    };

    updateDebugInfo();
  }, [user, vitAssets, regions, districts]);

  const handleRefresh = async () => {
            console.log('[VITDebugPage] 🔄 Manually refreshing switchgear assets...');
    await refreshVITAssets();
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VIT Debug Page</h1>
            <p className="text-muted-foreground mt-1">
              Debug VIT role-based filtering and data flow
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={isLoadingVITAssets}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingVITAssets ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Information
              </CardTitle>
              <CardDescription>Current user details and permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <strong>ID:</strong> {debugInfo.user?.id || 'N/A'}
              </div>
              <div>
                <strong>Role:</strong> 
                <Badge variant="secondary" className="ml-2">
                  {debugInfo.user?.role || 'N/A'}
                </Badge>
              </div>
              <div>
                <strong>Region:</strong> {debugInfo.user?.region || 'N/A'}
              </div>
              <div>
                <strong>District:</strong> {debugInfo.user?.district || 'N/A'}
              </div>
              <div>
                <strong>Email:</strong> {debugInfo.user?.email || 'N/A'}
              </div>
            </CardContent>
          </Card>

          {/* Data Counts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Counts
              </CardTitle>
              <CardDescription>Current data in context</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <strong>Switchgear Assets:</strong> {debugInfo.data?.vitAssetsCount || 0}
              </div>
              <div>
                <strong>Regions:</strong> {debugInfo.data?.regionsCount || 0}
              </div>
              <div>
                <strong>Districts:</strong> {debugInfo.data?.districtsCount || 0}
              </div>
            </CardContent>
          </Card>

          {/* Sample Assets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sample Assets
              </CardTitle>
              <CardDescription>First 3 switchgear assets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {debugInfo.sampleAssets?.length > 0 ? (
                debugInfo.sampleAssets.map((asset: any, index: number) => (
                  <div key={index} className="border rounded p-2 text-sm">
                    <div><strong>ID:</strong> {asset.id}</div>
                    <div><strong>Serial:</strong> {asset.serialNumber}</div>
                    <div><strong>Region:</strong> {asset.region}</div>
                    <div><strong>District:</strong> {asset.district}</div>
                    <div><strong>Type:</strong> {asset.typeOfUnit}</div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">No assets found</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Console Logs */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Console Logs</CardTitle>
            <CardDescription>
              Check browser console for detailed debug information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded text-sm font-mono">
              <div>Open browser console (F12) to see detailed logs:</div>
              <div className="mt-2 text-muted-foreground">
                • [DataContext] - Switchgear assets loading and filtering<br/>
                • [VITAssets] - Backend query and filtering<br/>
                • [VITAssetsTable] - Frontend component data<br/>
                • [AccessControlWrapper] - Permission checks
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 