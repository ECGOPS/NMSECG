import React, { useState } from 'react';
import { useOffline } from '@/contexts/OfflineContext';
import { offlineStorageCompat } from '@/utils/offlineStorage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OfflineBadge } from '@/components/common/OfflineBadge';
import { Wifi, WifiOff, Database, Save, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const OfflineTestComponent: React.FC = () => {
  const {
    isOnline,
    isOffline,
    isSyncing,
    syncProgress,
    pendingInspections,
    pendingPhotos,
    totalOfflineItems,
    lastSyncAttempt,
    saveInspectionOffline,
    savePhotoOffline,
    startSync,
    getSyncStats,
    checkOnlineStatus,
    forceSetOnlineStatus,
    toggleNetworkCheck,
    isNetworkCheckDisabled
  } = useOffline();

  const [testInspectionId, setTestInspectionId] = useState<string | null>(null);
  const [testPhotoId, setTestPhotoId] = useState<string | null>(null);

  // Test functions
  const testSaveInspection = async () => {
    try {
      const testData = {
        id: `test-${Date.now()}`,
        region: 'Test Region',
        district: 'Test District',
        feederName: 'Test Feeder',
        voltageLevel: '11kV',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        latitude: 0,
        longitude: 0,
        items: [],
        inspector: {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      const offlineId = await saveInspectionOffline(testData);
      setTestInspectionId(offlineId);
      
      console.log('[Test] Inspection saved offline:', offlineId);
    } catch (error) {
      console.error('[Test] Failed to save inspection:', error);
    }
  };

  const testSavePhoto = async () => {
    if (!testInspectionId) {
      alert('Please save an inspection first');
      return;
    }

    try {
      // Create a dummy base64 image
      const dummyImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
      
      const photoId = await savePhotoOffline(
        testInspectionId,
        dummyImage,
        'test-photo.jpg',
        'before',
        'image/jpeg'
      );
      
      setTestPhotoId(photoId);
      console.log('[Test] Photo saved offline:', photoId);
    } catch (error) {
      console.error('[Test] Failed to save photo:', error);
    }
  };

  const testSync = async () => {
    try {
      await startSync();
      console.log('[Test] Sync started');
    } catch (error) {
      console.error('[Test] Failed to start sync:', error);
    }
  };

  const testGetStats = async () => {
    try {
      await getSyncStats();
      console.log('[Test] Stats updated');
    } catch (error) {
      console.error('[Test] Failed to get stats:', error);
    }
  };

  const testDebugSyncQueue = async () => {
    try {
      const { offlineStorage } = await import('@/utils/offlineStorage');
      const debugInfo = await offlineStorageCompat.debugSyncQueue();
      console.log('[Test] Sync queue debug info:', debugInfo);
      
      // Show debug info in alert for easy viewing
      alert(`Sync Queue Debug Info:
Queue Items: ${debugInfo.queueItems.length}
Pending Inspections: ${debugInfo.pendingInspections.length}
Pending Photos: ${debugInfo.pendingPhotos.length}

Queue Items: ${JSON.stringify(debugInfo.queueItems, null, 2)}
Pending Inspections: ${JSON.stringify(debugInfo.pendingInspections, null, 2)}
Pending Photos: ${JSON.stringify(debugInfo.pendingPhotos, null, 2)}`);
    } catch (error) {
      console.error('[Test] Failed to debug sync queue:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Offline Functionality Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Display */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold">
                {isOnline ? (
                  <Wifi className="h-8 w-8 text-green-500 mx-auto" />
                ) : (
                  <WifiOff className="h-8 w-8 text-red-500 mx-auto" />
                )}
              </div>
              <div className="text-sm font-medium mt-1">
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {pendingInspections}
              </div>
              <div className="text-sm font-medium mt-1">Pending Inspections</div>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {pendingPhotos}
              </div>
              <div className="text-sm font-medium mt-1">Pending Photos</div>
            </div>
            
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {totalOfflineItems}
              </div>
              <div className="text-sm font-medium mt-1">Total Offline Items</div>
            </div>
          </div>

          {/* Offline Badge */}
          <div className="flex justify-center">
            <OfflineBadge showDetails={true} />
          </div>

          {/* Sync Progress */}
          {isSyncing && (
            <div className="text-center p-3 border rounded-lg bg-blue-50">
              <div className="flex items-center justify-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="font-medium">Syncing...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                ></div>
              </div>
              <div className="text-sm text-gray-600 mt-1">{syncProgress}%</div>
            </div>
          )}

          {/* Last Sync */}
          {lastSyncAttempt && (
            <div className="text-center p-3 border rounded-lg bg-green-50">
              <div className="text-sm text-green-700">
                Last sync: {new Date(lastSyncAttempt).toLocaleString()}
              </div>
            </div>
          )}

          {/* Test Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={testSaveInspection}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Test Save Inspection
            </Button>
            
            <Button 
              onClick={testSavePhoto}
              disabled={!testInspectionId}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Test Save Photo
            </Button>
            
            <Button 
              onClick={testSync}
              disabled={!isOnline || totalOfflineItems === 0}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Test Sync
            </Button>
          </div>

          {/* Test Results */}
          <div className="space-y-2">
            {testInspectionId && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                <strong>Test Inspection ID:</strong> {testInspectionId}
              </div>
            )}
            
            {testPhotoId && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                <strong>Test Photo ID:</strong> {testPhotoId}
              </div>
            )}
          </div>

          {/* Network Test Buttons */}
          <div className="text-center space-y-2">
            <Button 
              variant="outline" 
              onClick={testGetStats}
              className="flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Stats
            </Button>
            
            <Button 
              variant="outline" 
              onClick={testDebugSyncQueue}
              className="flex items-center gap-2 mx-auto"
            >
              <Database className="h-4 w-4" />
              Debug Sync Queue
            </Button>
            
            <Button 
              variant="outline" 
              onClick={async () => {
                const result = await checkOnlineStatus();
                console.log('Manual network test result:', result);
              }}
              className="flex items-center gap-2 mx-auto"
            >
              <Wifi className="h-4 w-4" />
              Test Network Connection
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => {
                // Simulate offline for testing
                const newStatus = !isOnline;
                forceSetOnlineStatus(newStatus);
                console.log('Manually setting offline status to:', newStatus);
              }}
              className="flex items-center gap-2 mx-auto"
            >
              {isOnline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
              {isOnline ? 'Simulate Offline' : 'Simulate Online'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={async () => {
                try {
                  // Reset the database for testing
                  await offlineStorageCompat.resetDatabase();
                  console.log('[Test] Database reset successfully');
                  // Refresh stats
                  await getSyncStats();
                } catch (error) {
                  console.error('[Test] Failed to reset database:', error);
                }
              }}
              className="flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Reset Database
            </Button>
            
            <Button 
              variant="outline" 
              onClick={toggleNetworkCheck}
              className={cn(
                "flex items-center gap-2 mx-auto",
                isNetworkCheckDisabled ? "bg-yellow-100 border-yellow-300" : ""
              )}
            >
              <Wifi className="h-4 w-4" />
              {isNetworkCheckDisabled ? 'Enable Network Check' : 'Disable Network Check'}
            </Button>
            
            {isNetworkCheckDisabled && (
              <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                ⚠️ Network check disabled - simulation will work better
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OfflineTestComponent;
