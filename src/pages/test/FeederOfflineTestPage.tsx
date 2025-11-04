import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FeederService } from '@/services/FeederService';
import { useData } from '@/contexts/DataContext';
import { toast } from 'sonner';
import { Wifi, WifiOff, Download, Database } from 'lucide-react';

interface FeederInfo {
  id: string;
  name: string;
  bspPss: string;
  region: string;
  district: string;
  regionId: string;
  districtId: string;
  voltageLevel: string;
  feederType: string;
}

export default function FeederOfflineTestPage() {
  const { regions } = useData();
  const [feeders, setFeeders] = useState<FeederInfo[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  
  const feederService = FeederService.getInstance();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check initial cache status
    checkCacheStatus();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkCacheStatus = async () => {
    try {
      const allFeeders = await feederService.getAllFeeders();
      setCachedCount(allFeeders.length);
    } catch (error) {
      console.error('Error checking cache status:', error);
    }
  };

  const loadFeeders = async () => {
    if (!selectedRegion) return;
    
    setIsLoading(true);
    try {
      const feedersData = await feederService.getFeedersByRegion(selectedRegion);
      setFeeders(feedersData);
      
      // Count offline vs online feeders
      // Offline feeders are those with "offline_" prefix OR when we're offline and using cached data
      const offlineFeeders = feedersData.filter(f => f.id.startsWith('offline_'));
      const isCurrentlyOffline = !navigator.onLine;
      
      // If we're offline, all feeders are considered offline (served from cache)
      // If we're online, only count those with "offline_" prefix as offline
      if (isCurrentlyOffline) {
        setOfflineCount(feedersData.length);
        setOnlineCount(0);
      } else {
        setOfflineCount(offlineFeeders.length);
        setOnlineCount(feedersData.length - offlineFeeders.length);
      }
      
      toast.success(`Loaded ${feedersData.length} feeders for ${regions.find(r => r.id === selectedRegion)?.name} (${isCurrentlyOffline ? 'offline' : 'online'})`);
    } catch (error) {
      console.error('Error loading feeders:', error);
      toast.error('Failed to load feeders');
    } finally {
      setIsLoading(false);
    }
  };

  const preloadAllFeeders = async () => {
    setIsLoading(true);
    try {
      console.log('Starting feeder preload...');
      await feederService.preloadFeeders();
      
      // Get the count of preloaded feeders
      const allFeeders = await feederService.getAllFeeders();
      console.log(`Preloaded ${allFeeders.length} feeders`);
      
      // Update cache status
      setCachedCount(allFeeders.length);
      
      toast.success(`Preloaded ${allFeeders.length} feeders for offline use`);
    } catch (error) {
      console.error('Error preloading feeders:', error);
      toast.error('Failed to preload feeders: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionStatus = () => {
    return isOnline ? (
      <Badge variant="default" className="bg-green-500">
        <Wifi className="w-3 h-3 mr-1" />
        Online
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-yellow-500">
        <WifiOff className="w-3 h-3 mr-1" />
        Offline
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Feeder Offline Test</h1>
            <p className="text-muted-foreground">
              Test the offline functionality for feeder data
            </p>
          </div>
          {getConnectionStatus()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Offline Storage
              </CardTitle>
              <CardDescription>
                Manage feeder data for offline use
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={loadFeeders} 
                  disabled={!selectedRegion || isLoading}
                  className="flex-1"
                >
                  Load Feeders
                </Button>
                <Button 
                  onClick={preloadAllFeeders} 
                  disabled={isLoading}
                  variant="outline"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={checkCacheStatus} 
                  disabled={isLoading}
                  variant="outline"
                  size="icon"
                  title="Refresh cache status"
                >
                  <Database className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
              <CardDescription>
                Current feeder data status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Total Feeders:</span>
                <Badge variant="outline">{feeders.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Online Feeders:</span>
                <Badge variant="default" className="bg-green-500">{onlineCount}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Offline Feeders:</span>
                <Badge variant="secondary" className="bg-yellow-500">{offlineCount}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Cached Feeders:</span>
                <Badge variant="outline">{cachedCount}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
              <CardDescription>
                How to test offline functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <p className="font-medium">1. Preload Data:</p>
                <p className="text-muted-foreground">
                  Click the download button to preload all feeders for offline use
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-medium">2. Go Offline:</p>
                <p className="text-muted-foreground">
                  Disconnect your internet connection or use browser dev tools
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-medium">3. Test Loading:</p>
                <p className="text-muted-foreground">
                  Select a region and load feeders - they should work offline
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {feeders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Feeders for {regions.find(r => r.id === selectedRegion)?.name}</CardTitle>
              <CardDescription>
                Showing {feeders.length} feeders ({offlineCount} offline, {onlineCount} online)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feeders.map((feeder) => (
                  <div
                    key={feeder.id}
                    className="p-4 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{feeder.name}</h3>
                      {(!navigator.onLine || feeder.id.startsWith('offline_')) ? (
                        <Badge variant="secondary" className="bg-yellow-500 text-xs">
                          Offline
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500 text-xs">
                          Online
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>BSP/PSS: {feeder.bspPss}</p>
                      <p>District: {feeder.district || 'N/A'}</p>
                      <p>Voltage: {feeder.voltageLevel || 'N/A'}</p>
                      <p>Type: {feeder.feederType || 'N/A'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
} 