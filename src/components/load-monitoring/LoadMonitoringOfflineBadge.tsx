import React from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useLoadMonitoringOffline } from '@/contexts/LoadMonitoringOfflineContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LoadMonitoringOfflineBadgeProps {
  showDetails?: boolean;
  showSyncButton?: boolean;
  className?: string;
}

export function LoadMonitoringOfflineBadge({ 
  showDetails = false, 
  showSyncButton = true,
  className = "" 
}: LoadMonitoringOfflineBadgeProps) {
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
    lastSyncAttempt
  } = useLoadMonitoringOffline();

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncAttempt) return 'Never';
    const now = Date.now();
    const diff = now - lastSyncAttempt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Get status color and icon
  const getStatusInfo = () => {
    if (isSyncing) {
      return {
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: <RefreshCw className="h-3 w-3 animate-spin" />,
        text: 'Syncing...'
      };
    }

    if (isOffline) {
      return {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: <WifiOff className="h-3 w-3" />,
        text: 'Offline'
      };
    }

    if (pendingRecords > 0) {
      return {
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: <Clock className="h-3 w-3" />,
        text: `${pendingRecords} pending`
      };
    }

    return {
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: <CheckCircle className="h-3 w-3" />,
      text: 'Online'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Main Status Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`${statusInfo.color} border`}>
              <div className="flex items-center gap-1">
                {statusInfo.icon}
                <span className="text-xs font-medium">{statusInfo.text}</span>
              </div>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <p className="font-medium">
                {isSyncing ? 'Synchronizing data...' : 
                 isOffline ? 'Working offline' : 
                 pendingRecords > 0 ? 'Pending sync operations' : 'All data synchronized'}
              </p>
              {lastSyncAttempt && (
                <p className="text-xs text-gray-500 mt-1">
                  Last sync: {formatLastSync()}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Sync Progress Bar (when syncing) */}
        {isSyncing && syncProgress > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
            <span className="text-xs text-gray-600">{syncProgress}%</span>
          </div>
        )}

        {/* Detailed Status (when showDetails is true) */}
        {showDetails && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            {pendingCreates > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {pendingCreates} new
              </span>
            )}
            {pendingUpdates > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {pendingUpdates} updates
              </span>
            )}
            {pendingDeletes > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                {pendingDeletes} deletes
              </span>
            )}
          </div>
        )}

        {/* Manual Sync Button */}
        {showSyncButton && pendingRecords > 0 && isOnline && !isSyncing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={startSync}
                className="h-6 px-2 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Manually sync pending offline operations</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Error Indicator (if any pending records have failed) */}
        {pendingRecords > 0 && lastSyncAttempt && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertCircle className="h-3 w-3 text-orange-500" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Some operations failed to sync and will be retried</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
