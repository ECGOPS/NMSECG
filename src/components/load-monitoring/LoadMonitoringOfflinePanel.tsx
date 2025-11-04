import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Plus, 
  Edit, 
  Trash2,
  Database,
  X
} from 'lucide-react';
import { useLoadMonitoringOffline } from '@/contexts/LoadMonitoringOfflineContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { PendingLoadMonitoring } from '@/services/OfflineLoadMonitoringService';

interface LoadMonitoringOfflinePanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function LoadMonitoringOfflinePanel({ 
  isOpen, 
  onClose, 
  className = "" 
}: LoadMonitoringOfflinePanelProps) {
  const { toast } = useToast();
  const { 
    isOnline, 
    isOffline, 
    isSyncing, 
    syncProgress, 
    pendingRecords, 
    pendingCreates, 
    pendingUpdates, 
    pendingDeletes,
    startSync,
    getPendingRecords,
    clearAllPendingRecords,
    lastSyncAttempt
  } = useLoadMonitoringOffline();

  const [pendingData, setPendingData] = React.useState<PendingLoadMonitoring[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Load pending records
  const loadPendingRecords = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const records = await getPendingRecords();
      setPendingData(records);
    } catch (error) {
      console.error('[LoadMonitoringOfflinePanel] Failed to load pending records:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getPendingRecords]);

  // Load data when panel opens
  React.useEffect(() => {
    if (isOpen) {
      loadPendingRecords();
    }
  }, [isOpen, loadPendingRecords]);

  // Refresh data periodically
  React.useEffect(() => {
    if (isOpen) {
      const interval = setInterval(loadPendingRecords, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, loadPendingRecords]);

  // Handle manual sync
  const handleManualSync = async () => {
    try {
      await startSync();
      toast({
        title: "Sync Started",
        description: "Synchronizing offline data...",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Failed to start synchronization",
        variant: "destructive",
      });
    }
  };

  // Handle clear all pending records
  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all pending offline operations? This action cannot be undone.')) {
      try {
        await clearAllPendingRecords();
        setPendingData([]);
        toast({
          title: "Records Cleared",
          description: "All pending offline operations have been cleared",
          variant: "default",
        });
      } catch (error) {
        toast({
          title: "Clear Failed",
          description: "Failed to clear pending operations",
          variant: "destructive",
        });
      }
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Get action icon and color
  const getActionInfo = (action: string) => {
    switch (action) {
      case 'create':
        return { icon: <Plus className="h-3 w-3" />, color: 'bg-green-100 text-green-800' };
      case 'update':
        return { icon: <Edit className="h-3 w-3" />, color: 'bg-blue-100 text-blue-800' };
      case 'delete':
        return { icon: <Trash2 className="h-3 w-3" />, color: 'bg-red-100 text-red-800' };
      default:
        return { icon: <AlertCircle className="h-3 w-3" />, color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-2 sm:px-0 ${className}`}>
      <Card className="w-full sm:max-w-4xl max-h-[90vh] overflow-hidden rounded-none sm:rounded-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle>Load Monitoring Offline Status</CardTitle>
              <CardDescription>
                Monitor offline operations and synchronization status
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Connection Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {isOnline ? (
                    <Wifi className="h-5 w-5 text-green-600" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-yellow-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Connection</p>
                    <p className={`text-lg font-bold ${isOnline ? 'text-green-600' : 'text-yellow-600'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium">Pending Operations</p>
                    <p className="text-lg font-bold text-orange-600">{pendingRecords}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {lastSyncAttempt ? (
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-gray-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Last Sync</p>
                    <p className="text-lg font-bold text-blue-600">
                      {lastSyncAttempt ? new Date(lastSyncAttempt).toLocaleTimeString() : 'Never'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sync Progress */}
          {isSyncing && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="font-medium">Synchronizing...</span>
                    </div>
                    <span className="text-sm text-gray-600">{syncProgress}%</span>
                  </div>
                  <Progress value={syncProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Operation Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Operation Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Plus className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">New Records</p>
                    <p className="text-lg font-bold text-green-600">{pendingCreates}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Edit className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Updates</p>
                    <p className="text-lg font-bold text-blue-600">{pendingUpdates}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Deletions</p>
                    <p className="text-lg font-bold text-red-600">{pendingDeletes}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Operations List */}
          {pendingRecords > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-lg">Pending Operations</CardTitle>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualSync}
                      disabled={isSyncing || isOffline}
                      className="border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearAll}
                      disabled={isSyncing}
                      className="border-red-200 text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Loading pending operations...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingData.map((item) => {
                      const actionInfo = getActionInfo(item.action);
                      return (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
                          <div className="flex items-start sm:items-center gap-3">
                            <Badge className={actionInfo.color}>
                              {actionInfo.icon}
                              <span className="ml-1 capitalize">{item.action}</span>
                            </Badge>
                            <div>
                              <p className="font-medium">
                                {item.record.substationName || item.record.feederName || 'Unknown Record'}
                              </p>
                              <p className="text-sm text-gray-600">
                                {item.record.region} - {item.record.district}
                              </p>
                            </div>
                          </div>
                          <div className="sm:text-right text-left text-sm text-gray-600 w-full sm:w-auto">
                            <p>{formatTimestamp(item.timestamp)}</p>
                            {item.retryCount > 0 && (
                              <p className="text-orange-600">
                                Retries: {item.retryCount}/{item.maxRetries}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No Pending Operations */}
          {pendingRecords === 0 && !isLoading && (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
                <p className="text-gray-600">
                  No pending offline operations. All data is synchronized.
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
