import React from 'react';
import { useOffline } from '@/contexts/OfflineContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineBadgeProps {
  className?: string;
  showDetails?: boolean;
}

export const OfflineBadge: React.FC<OfflineBadgeProps> = ({ 
  className,
  showDetails = false 
}) => {
  const {
    isOnline,
    isOffline,
    isSyncing,
    syncProgress,
    pendingInspections,
    pendingPhotos,
    totalOfflineItems,
    lastSyncAttempt,
    startSync
  } = useOffline();

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncAttempt) return 'Never';
    
    const now = Date.now();
    const diff = now - lastSyncAttempt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Get status color and icon
  const getStatusInfo = () => {
    if (isSyncing) {
      return {
        color: 'bg-blue-500 hover:bg-blue-600',
        icon: <RefreshCw className="h-3 w-3 animate-spin" />,
        text: 'Syncing...'
      };
    }
    
    if (isOffline) {
      return {
        color: 'bg-red-500 hover:bg-red-600',
        icon: <WifiOff className="h-3 w-3" />,
        text: 'Offline'
      };
    }
    
    if (totalOfflineItems > 0) {
      return {
        color: 'bg-yellow-500 hover:bg-yellow-600',
        icon: <Clock className="h-3 w-3" />,
        text: `${totalOfflineItems} pending`
      };
    }
    
    return {
      color: 'bg-green-500 hover:bg-green-600',
      icon: <Wifi className="h-3 w-3" />,
      text: 'Online'
    };
  };

  const statusInfo = getStatusInfo();

  // Handle sync button click
  const handleSyncClick = async () => {
    if (!isSyncing && isOnline && totalOfflineItems > 0) {
      await startSync();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Main status badge */}
      <Badge 
        variant="secondary" 
        className={cn(
          "flex items-center gap-1.5 cursor-pointer transition-colors",
          statusInfo.color,
          isSyncing && "animate-pulse"
        )}
        onClick={handleSyncClick}
      >
        {statusInfo.icon}
        <span className="text-xs font-medium text-white">
          {statusInfo.text}
        </span>
      </Badge>

      {/* Show details if requested */}
      {showDetails && (
        <div className="flex items-center gap-3">
          {/* Pending items count */}
          {(pendingInspections > 0 || pendingPhotos > 0) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Database className="h-3 w-3" />
              <span>
                {pendingInspections > 0 && `${pendingInspections} inspections`}
                {pendingInspections > 0 && pendingPhotos > 0 && ', '}
                {pendingPhotos > 0 && `${pendingPhotos} photos`}
              </span>
            </div>
          )}

          {/* Last sync time */}
          {lastSyncAttempt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3" />
              <span>Last sync: {formatLastSync()}</span>
            </div>
          )}

          {/* Sync button */}
          {isOnline && totalOfflineItems > 0 && !isSyncing && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncClick}
              className="h-6 px-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync Now
            </Button>
          )}

          {/* Sync progress */}
          {isSyncing && (
            <div className="flex items-center gap-2">
              <Progress 
                value={syncProgress} 
                className="w-20 h-2"
              />
              <span className="text-xs text-muted-foreground">
                {syncProgress}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Compact version for headers
export const OfflineBadgeCompact: React.FC<{ className?: string }> = ({ className }) => {
  const { isOnline, isOffline, totalOfflineItems, isSyncing } = useOffline();

  const getCompactStatus = () => {
    if (isSyncing) return { color: 'bg-blue-500', text: '🔄' };
    if (isOffline) return { color: 'bg-red-500', text: '📶' };
    if (totalOfflineItems > 0) return { color: 'bg-yellow-500', text: '⏳' };
    return { color: 'bg-green-500', text: '✅' };
  };

  const status = getCompactStatus();

  return (
    <div className={cn(
      "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold",
      status.color,
      isSyncing && "animate-pulse",
      className
    )}>
      {status.text}
    </div>
  );
};

// Tooltip version with detailed information
export const OfflineBadgeWithTooltip: React.FC<{ className?: string }> = ({ className }) => {
  const { isOnline, isOffline, totalOfflineItems, isSyncing, pendingInspections, pendingPhotos } = useOffline();

  const getTooltipContent = () => {
    if (isSyncing) return 'Syncing data...';
    if (isOffline) return 'No internet connection';
    if (totalOfflineItems > 0) {
      return `${pendingInspections} inspections and ${pendingPhotos} photos pending sync`;
    }
    return 'All data synced';
  };

  return (
    <div className="group relative">
      <OfflineBadgeCompact className={className} />
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        {getTooltipContent()}
        
        {/* Arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};
