import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { OfflineLoadMonitoringService, PendingLoadMonitoring } from '@/services/OfflineLoadMonitoringService';
import { LoadMonitoringData } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';

// Load Monitoring Offline context interface
interface LoadMonitoringOfflineContextType {
  // Offline status
  isOnline: boolean;
  isOffline: boolean;
  
  // Sync status
  isSyncing: boolean;
  syncProgress: number;
  lastSyncAttempt: number | null;
  
  // Offline data counts
  pendingRecords: number;
  pendingCreates: number;
  pendingUpdates: number;
  pendingDeletes: number;
  
  // Offline actions
  saveOffline: (record: LoadMonitoringData, action: 'create' | 'update' | 'delete') => Promise<string>;
  
  // Sync actions
  startSync: () => Promise<void>;
  getPendingRecords: () => Promise<PendingLoadMonitoring[]>;
  getPendingRecordsByAction: (action: 'create' | 'update' | 'delete') => Promise<PendingLoadMonitoring[]>;
  
  // Utility functions
  checkOnlineStatus: () => boolean;
  getSyncStats: () => Promise<void>;
  clearAllPendingRecords: () => Promise<void>;
}

// Create the context
const LoadMonitoringOfflineContext = createContext<LoadMonitoringOfflineContextType | undefined>(undefined);

// Load Monitoring Offline context provider props
interface LoadMonitoringOfflineProviderProps {
  children: ReactNode;
}

// Load Monitoring Offline context provider
export const LoadMonitoringOfflineProvider: React.FC<LoadMonitoringOfflineProviderProps> = ({ children }) => {
  const { toast } = useToast();
  
  // State variables
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<number | null>(null);
  const [pendingRecords, setPendingRecords] = useState(0);
  const [pendingCreates, setPendingCreates] = useState(0);
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [pendingDeletes, setPendingDeletes] = useState(0);

  // Get service instance
  const offlineService = OfflineLoadMonitoringService.getInstance();

  // Enhanced network detection with real connectivity check
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    // Function to check real network connectivity
    const checkRealNetworkStatus = async () => {
      try {
        // Try to fetch a small resource to test real connectivity
        const response = await fetch('/favicon.ico', { 
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (response.ok && isOnline === false) {
          setIsOnline(true);
          console.log('[LoadMonitoringOfflineContext] Real network connection detected');
          
          // Auto-sync when coming back online
          if (pendingRecords > 0) {
            startSync();
          }
        } else if (response.ok && isOnline === true) {
          console.log('[LoadMonitoringOfflineContext] Network connection confirmed online');
        }
      } catch (error) {
        if (isOnline === true) {
          setIsOnline(false);
          console.log('[LoadMonitoringOfflineContext] Real network connection lost');
        } else {
          console.log('[LoadMonitoringOfflineContext] Network connection still offline');
        }
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      console.log('[LoadMonitoringOfflineContext] Browser reports online');
      // Verify with real network check
      checkRealNetworkStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[LoadMonitoringOfflineContext] Browser reports offline');
    };

    // Log current online status
    console.log('[LoadMonitoringOfflineContext] Current online status:', isOnline);

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set up periodic real network checks (every 5 seconds)
    intervalId = setInterval(checkRealNetworkStatus, 5000);

    // Initial check
    checkRealNetworkStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isOnline, pendingRecords]);

  // Update pending counts when they change
  useEffect(() => {
    const updatePendingCounts = async () => {
      try {
        // First ensure database is ready
        const isReady = await offlineService.isDatabaseReady();
        if (!isReady) {
          console.log('[LoadMonitoringOfflineContext] Database not ready, skipping pending count update');
          return;
        }

        console.log('[LoadMonitoringOfflineContext] Updating pending counts...');
        const totalPending = await offlineService.getPendingCount();
        const pendingCreates = await offlineService.getPendingRecordsByAction('create');
        const pendingUpdates = await offlineService.getPendingRecordsByAction('update');
        const pendingDeletes = await offlineService.getPendingRecordsByAction('delete');

        console.log('[LoadMonitoringOfflineContext] Pending counts:', {
          total: totalPending,
          creates: pendingCreates.length,
          updates: pendingUpdates.length,
          deletes: pendingDeletes.length
        });

        setPendingRecords(totalPending);
        setPendingCreates(pendingCreates.length);
        setPendingUpdates(pendingUpdates.length);
        setPendingDeletes(pendingDeletes.length);
      } catch (error) {
        console.error('[LoadMonitoringOfflineContext] Failed to update pending counts:', error);
      }
    };

    // Update counts initially and set up interval
    updatePendingCounts();
    const intervalId = setInterval(updatePendingCounts, 5000); // Update every 5 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Check online status
  const checkOnlineStatus = useCallback(async () => {
    return await offlineService.isInternetAvailable();
  }, []);

  // Save offline
  const saveOffline = useCallback(async (
    record: LoadMonitoringData, 
    action: 'create' | 'update' | 'delete'
  ): Promise<string> => {
    console.log('[LoadMonitoringOfflineContext] saveOffline called with:', { action, recordId: record.id });
    
    try {
      const offlineId = await offlineService.saveOffline(record, action);
      console.log('[LoadMonitoringOfflineContext] Offline service returned ID:', offlineId);
      
      // Update pending counts
      const totalPending = await offlineService.getPendingCount();
      console.log('[LoadMonitoringOfflineContext] Updated pending count:', totalPending);
      setPendingRecords(totalPending);
      
      // Show success toast
      toast({
        title: "Saved Offline",
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} operation saved offline. Will sync when online.`,
        variant: "default",
      });
      
      console.log('[LoadMonitoringOfflineContext] Record saved offline successfully:', offlineId);
      return offlineId;
    } catch (error) {
      console.error('[LoadMonitoringOfflineContext] Failed to save offline:', error);
      
      toast({
        title: "Offline Save Failed",
        description: "Failed to save operation offline. Please try again.",
        variant: "destructive",
      });
      
      throw error;
    }
  }, [toast]);

  // Start sync process
  const startSync = useCallback(async () => {
    if (isSyncing || !isOnline) {
      console.log('[LoadMonitoringOfflineContext] Sync already in progress or offline');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      console.log('[LoadMonitoringOfflineContext] Starting sync process...');
      
      // Get current pending count for progress calculation
      const totalPending = await offlineService.getPendingCount();
      
      if (totalPending === 0) {
        console.log('[LoadMonitoringOfflineContext] No items to sync');
        setSyncProgress(100);
        setIsSyncing(false);
        return;
      }

      // Start sync with progress tracking
      let processedItems = 0;
      
      // Monitor sync progress
      const progressInterval = setInterval(async () => {
        const currentPending = await offlineService.getPendingCount();
        const processed = totalPending - currentPending;
        const progress = Math.round((processed / totalPending) * 100);
        setSyncProgress(progress);
        
        if (currentPending === 0) {
          clearInterval(progressInterval);
        }
      }, 500);

      // Start the actual sync
      await offlineService.syncRecords();
      
      // Update sync stats
      await getSyncStats();
      setLastSyncAttempt(Date.now());
      
      // Show success toast
      toast({
        title: "Sync Completed",
        description: "All offline data has been synchronized successfully.",
        variant: "default",
      });
      
      // Dispatch offline sync completed event
      if (processedItems > 0) {
        window.dispatchEvent(new CustomEvent('offlineSyncCompleted', {
          detail: {
            syncedRecords: processedItems,
            timestamp: Date.now()
          }
        }));
      }
      
      console.log('[LoadMonitoringOfflineContext] Sync completed successfully');
      
    } catch (error) {
      console.error('[LoadMonitoringOfflineContext] Sync process failed:', error);
      
      toast({
        title: "Sync Failed",
        description: "Some items failed to sync. They will be retried automatically.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  }, [isSyncing, isOnline, toast]);

  // Get pending records
  const getPendingRecords = useCallback(async (): Promise<PendingLoadMonitoring[]> => {
    return await offlineService.getPendingRecords();
  }, []);

  // Get pending records by action
  const getPendingRecordsByAction = useCallback(async (
    action: 'create' | 'update' | 'delete'
  ): Promise<PendingLoadMonitoring[]> => {
    return await offlineService.getPendingRecordsByAction(action);
  }, []);

  // Get sync stats
  const getSyncStats = useCallback(async () => {
    try {
      const totalPending = await offlineService.getPendingCount();
      const pendingCreates = await offlineService.getPendingRecordsByAction('create');
      const pendingUpdates = await offlineService.getPendingRecordsByAction('update');
      const pendingDeletes = await offlineService.getPendingRecordsByAction('delete');

      setPendingRecords(totalPending);
      setPendingCreates(pendingCreates.length);
      setPendingUpdates(pendingUpdates.length);
      setPendingDeletes(pendingDeletes.length);
    } catch (error) {
      console.error('[LoadMonitoringOfflineContext] Failed to get sync stats:', error);
    }
  }, []);

  // Clear all pending records
  const clearAllPendingRecords = useCallback(async () => {
    try {
      await offlineService.clearAllPendingRecords();
      await getSyncStats();
      
      toast({
        title: "Pending Records Cleared",
        description: "All pending offline records have been cleared.",
        variant: "default",
      });
    } catch (error) {
      console.error('[LoadMonitoringOfflineContext] Failed to clear pending records:', error);
      
      toast({
        title: "Clear Failed",
        description: "Failed to clear pending records. Please try again.",
        variant: "destructive",
      });
    }
  }, [getSyncStats, toast]);

  // Context value
  const contextValue: LoadMonitoringOfflineContextType = {
    isOnline,
    isOffline: !isOnline,
    isSyncing,
    syncProgress,
    lastSyncAttempt,
    pendingRecords,
    pendingCreates,
    pendingUpdates,
    pendingDeletes,
    saveOffline,
    startSync,
    getPendingRecords,
    getPendingRecordsByAction,
    checkOnlineStatus,
    getSyncStats,
    clearAllPendingRecords,
  };

  return (
    <LoadMonitoringOfflineContext.Provider value={contextValue}>
      {children}
    </LoadMonitoringOfflineContext.Provider>
  );
};

// Custom hook to use the Load Monitoring Offline context
export const useLoadMonitoringOffline = (): LoadMonitoringOfflineContextType => {
  const context = useContext(LoadMonitoringOfflineContext);
  if (context === undefined) {
    throw new Error('useLoadMonitoringOffline must be used within a LoadMonitoringOfflineProvider');
  }
  return context;
};
