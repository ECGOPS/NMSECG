import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { offlineStorageCompat, OfflineInspection, OfflinePhoto } from '@/utils/offlineStorage';
import { useAzureADAuth } from './AzureADAuthContext';
import { apiRequest } from '@/lib/api';

// Offline context interface
interface OfflineContextType {
  // Initialization status
  isInitialized: boolean;
  
  // Offline status
  isOnline: boolean;
  isOffline: boolean;
  
  // Sync status
  isSyncing: boolean;
  syncProgress: number;
  lastSyncAttempt: number | null;
  
  // Offline data counts
  pendingInspections: number;
  pendingPhotos: number;
  totalOfflineItems: number;
  
  // Offline actions
  saveInspectionOffline: (inspectionData: any) => Promise<string>;
  savePhotoOffline: (
    inspectionOfflineId: string,
    photoData: string,
    filename: string,
    type: 'before' | 'after' | 'correction',
    mimeType?: string
  ) => Promise<string>;
  
  // Sync actions
  startSync: () => Promise<void>;
  syncVITData: () => Promise<void>;
  getOfflineInspections: () => Promise<OfflineInspection[]>;
  getOfflinePhotos: (inspectionId: string) => Promise<OfflinePhoto[]>;
  
  // Utility functions
  checkOnlineStatus: () => Promise<boolean>;
  getSyncStats: () => Promise<void>;
  forceSetOnlineStatus: (status: boolean) => void;
  toggleNetworkCheck: () => boolean;
  isNetworkCheckDisabled: boolean;
  
  // Feeder data management
  preloadFeederData: () => Promise<void>;
  getCachedFeederData: (regionId: string) => Promise<any[] | null>;
  
  // Debug functions
  testSync: () => Promise<void>;
  checkInitialization: () => Promise<void>;
}

// Create the context
const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

// Offline context provider props
interface OfflineProviderProps {
  children: ReactNode;
}

// Offline context provider
export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  // Get auth context for API calls
  const { user } = useAzureADAuth();
  
  // State variables
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<number | null>(null);
  const [pendingInspections, setPendingInspections] = useState(0);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [totalOfflineItems, setTotalOfflineItems] = useState(0);
  const [isNetworkCheckDisabled, setIsNetworkCheckDisabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize offline storage
  useEffect(() => {
    const initializeOfflineStorage = async () => {
      try {
        console.log('[OfflineContext] Starting offline storage initialization...');
        
        // Initialize with retry mechanism and recovery
        let retries = 0;
        const maxRetries = 3; // Reduced retries since recovery is built into offlineStorage
        
        while (retries < maxRetries) {
          try {
            await offlineStorageCompat.initialize();
            console.log('[OfflineContext] Database initialization successful');
            break;
          } catch (error) {
            retries++;
            console.warn(`[OfflineContext] Initialization attempt ${retries} failed:`, error);
            
            if (retries >= maxRetries) {
              throw error;
            }
            
            // Wait before retrying
            const waitTime = 500;
            console.log(`[OfflineContext] Waiting ${waitTime}ms before retry ${retries + 1}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
        
        // Add a small delay to ensure database is fully ready
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify database is truly ready by testing a simple operation
        try {
          await offlineStorageCompat.getSyncStats();
          console.log('[OfflineContext] Database connection verified successfully');
        } catch (verifyError) {
          console.error('[OfflineContext] Database verification failed:', verifyError);
          throw new Error('Database verification failed');
        }
        
        setIsInitialized(true);
        console.log('[OfflineContext] Offline storage initialized successfully');
        
        // Load initial stats after initialization
        try {
          const stats = await offlineStorageCompat.getSyncStats();
          setPendingInspections(stats.pendingInspections);
          setPendingPhotos(stats.pendingPhotos);
          setTotalOfflineItems(stats.totalOfflineItems);
          setLastSyncAttempt(stats.lastSyncAttempt);
          
          console.log('[OfflineContext] Initial sync stats loaded:', {
            pendingInspections: stats.pendingInspections,
            pendingPhotos: stats.pendingPhotos,
            totalOfflineItems: stats.totalOfflineItems,
            syncQueueCount: stats.syncQueueCount,
            lastSyncAttempt: stats.lastSyncAttempt,
          });
        } catch (statsError) {
          console.error('[OfflineContext] Failed to load initial sync stats:', statsError);
        }
      } catch (error) {
        console.error('[OfflineContext] Failed to initialize offline storage after all retries:', error);
        
        // Log the error but don't block the app - set initialized to true
        console.warn('[OfflineContext] Offline storage initialization failed, but app will continue without offline functionality');
        console.warn('[OfflineContext] Users can still use the app online, but offline features will be disabled');
        
        // Set initialized to true to prevent infinite retries and allow app to continue
        setIsInitialized(true);
      }
    };

    initializeOfflineStorage();
  }, []);

  // Enhanced network detection with real connectivity check
  useEffect(() => {
    // Don't start network detection until initialized
    if (!isInitialized) {
      return;
    }
    
    let intervalId: NodeJS.Timeout;
    
    // Function to check real network connectivity
    const checkRealNetworkStatus = async () => {
      // Skip network check if disabled for testing
      if (isNetworkCheckDisabled) {
        console.log('[OfflineContext] Network check disabled for testing');
        return;
      }

      try {
        // Try to fetch a small resource to test real connectivity
        const response = await fetch('/favicon.ico', { 
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (response.ok && isOnline === false) {
          setIsOnline(true);
          console.log('[OfflineContext] Real network connection detected');
          
          // Auto-sync when coming back online
          if (pendingInspections > 0 || pendingPhotos > 0) {
            startSync();
          }
          
          // Also trigger VIT sync if there are pending VIT assets
          try {
            const { VITSyncService } = await import('@/services/VITSyncService');
            const vitSyncService = VITSyncService.getInstance();
            const pendingVITAssets = await vitSyncService.getPendingVITAssets();
            if (pendingVITAssets.length > 0) {
              console.log('[OfflineContext] Found pending VIT assets, triggering VIT sync...');
              vitSyncService.syncAllVITData();
            }
          } catch (error) {
            console.warn('[OfflineContext] Failed to trigger VIT sync:', error);
            // Don't fail the network check if VIT sync fails
          }
          
          // Preload feeder data for offline use (only when actually online)
          try {
            await preloadFeederData();
          } catch (error) {
            console.warn('[OfflineContext] Failed to preload feeder data:', error);
            // Don't fail the network check if preload fails
          }
        }
      } catch (error) {
        if (isOnline === true) {
          setIsOnline(false);
          console.log('[OfflineContext] Real network connection lost');
        }
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      console.log('[OfflineContext] Browser reports online');
      // Verify with real network check
      checkRealNetworkStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[OfflineContext] Browser reports offline');
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set up periodic real network checks (every 5 seconds)
    intervalId = setInterval(checkRealNetworkStatus, 5000);

    // Initial check
    checkRealNetworkStatus();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalId) clearInterval(intervalId);
    };
      }, [pendingInspections, pendingPhotos, isOnline, isInitialized]);

  // Check online status with real network test
  const checkOnlineStatus = useCallback(async () => {
    if (!isInitialized) {
      console.log('[OfflineContext] Skipping checkOnlineStatus - not initialized yet');
      return navigator.onLine;
    }
    
    try {
      const response = await fetch('/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000)
      });
      const isActuallyOnline = response.ok;
      
      if (isActuallyOnline !== isOnline) {
        setIsOnline(isActuallyOnline);
        console.log('[OfflineContext] Manual network check:', isActuallyOnline ? 'Online' : 'Offline');
      }
      
      return isActuallyOnline;
    } catch (error) {
      if (isOnline) {
        setIsOnline(false);
        console.log('[OfflineContext] Manual network check: Offline');
      }
      return false;
    }
  }, [isOnline, isInitialized]);

  // Force set online status (for testing purposes)
  const forceSetOnlineStatus = useCallback((status: boolean) => {
    if (!isInitialized) {
      console.log('[OfflineContext] Skipping forceSetOnlineStatus - not initialized yet');
      return;
    }
    
    setIsOnline(status);
    console.log('[OfflineContext] Force setting online status to:', status);
  }, [isInitialized]);

  // Toggle network check for testing
  const toggleNetworkCheck = useCallback(() => {
    if (!isInitialized) {
      console.log('[OfflineContext] Skipping toggleNetworkCheck - not initialized yet');
      return false;
    }
    
    setIsNetworkCheckDisabled(prev => !prev);
    console.log('[OfflineContext] Network check toggled:', !isNetworkCheckDisabled);
    return !isNetworkCheckDisabled;
  }, [isNetworkCheckDisabled, isInitialized]);

  // Get sync statistics
  const getSyncStats = useCallback(async () => {
    if (!isInitialized) {
      console.log('[OfflineContext] Skipping getSyncStats - not initialized yet');
      return;
    }
    
          try {
        const stats = await offlineStorageCompat.getSyncStats();
        setPendingInspections(stats.pendingInspections);
        setPendingPhotos(stats.pendingPhotos);
        setTotalOfflineItems(stats.totalOfflineItems);
        setLastSyncAttempt(stats.lastSyncAttempt);
        
        console.log('[OfflineContext] Sync stats updated:', {
          pendingInspections: stats.pendingInspections,
          pendingPhotos: stats.pendingPhotos,
          totalOfflineItems: stats.totalOfflineItems,
          syncQueueCount: stats.syncQueueCount,
          lastSyncAttempt: stats.lastSyncAttempt,
        });
      } catch (error) {
        console.error('[OfflineContext] Failed to get sync stats:', error);
      }
  }, [isInitialized]);

  // Save inspection offline
  const saveInspectionOffline = useCallback(async (inspectionData: any): Promise<string> => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized yet');
    }
    
          try {
        const offlineId = await offlineStorageCompat.saveInspectionOffline(inspectionData);
        await getSyncStats(); // Update stats
        console.log('[OfflineContext] Inspection saved offline:', offlineId);
        return offlineId;
      } catch (error) {
        console.error('[OfflineContext] Failed to save inspection offline:', error);
        throw error;
      }
  }, [getSyncStats, isInitialized]);

  // Save photo offline
  const savePhotoOffline = useCallback(async (
    inspectionOfflineId: string,
    photoData: string,
    filename: string,
    type: 'before' | 'after' | 'correction',
    mimeType: string = 'image/jpeg'
  ): Promise<string> => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized yet');
    }
    
          try {
        const offlineId = await offlineStorageCompat.savePhotoOffline(
          inspectionOfflineId,
          photoData,
          filename,
          type,
          mimeType
        );
        await getSyncStats(); // Update stats
        console.log('[OfflineContext] Photo saved offline:', offlineId);
        return offlineId;
      } catch (error) {
        console.error('[OfflineContext] Failed to save photo offline:', error);
        throw error;
      }
  }, [getSyncStats, isInitialized]);

  // Get offline inspections
  const getOfflineInspections = useCallback(async (): Promise<OfflineInspection[]> => {
    if (!isInitialized) {
      console.log('[OfflineContext] Skipping getOfflineInspections - not initialized yet');
      return [];
    }
    
    try {
      // Check database status first
      const status = offlineStorageCompat.getStatus();
      console.log('[OfflineContext] Database status:', status);
      
      if (!status.isReady) {
        console.log('[OfflineContext] Database not ready, attempting to initialize...');
        try {
          await offlineStorageCompat.initialize();
        } catch (initError) {
          console.warn('[OfflineContext] Failed to initialize database for getOfflineInspections:', initError);
          return []; // Return empty array if database is not available
        }
      }
      
      // Try to get offline inspections
      try {
        const result = await offlineStorageCompat.getAllOfflineInspections();
        console.log('[OfflineContext] getOfflineInspections successful, found', result.length, 'inspections');
        return result;
      } catch (error) {
        console.warn('[OfflineContext] getOfflineInspections failed, returning empty array:', error);
        return []; // Return empty array if operation fails
      }
    } catch (error) {
      console.error('[OfflineContext] Failed to get offline inspections:', error);
      return []; // Always return empty array instead of throwing
    }
  }, [isInitialized]);

  // Get offline photos
  const getOfflinePhotos = useCallback(async (inspectionId: string): Promise<OfflinePhoto[]> => {
    if (!isInitialized) {
      console.log('[OfflineContext] Skipping getOfflinePhotos - not initialized yet');
      return [];
    }
    
    try {
      return await offlineStorageCompat.getPhotosByInspectionId(inspectionId);
    } catch (error) {
      console.error('[OfflineContext] Failed to get offline photos:', error);
      return [];
    }
  }, [isInitialized]);

  // Start sync process
  const startSync = useCallback(async () => {
    if (isSyncing || !isOnline || !isInitialized) {
      console.log('[OfflineContext] Cannot start sync:', { isSyncing, isOnline, isInitialized });
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    
    try {
      console.log('[OfflineContext] Starting sync process...');
      console.log('[OfflineContext] Current state:', { isOnline, isInitialized, totalOfflineItems });
      
      // Clean up orphaned sync queue items first
      await cleanupOrphanedSyncItems();
      
      // Get sync stats
      const stats = await offlineStorageCompat.getSyncStats();
      const totalItems = stats.syncQueueCount;
      
      console.log('[OfflineContext] Sync stats:', stats);
      console.log('[OfflineContext] Total items to sync:', totalItems);
      
      if (totalItems === 0) {
        console.log('[OfflineContext] No items to sync');
        return;
      }
      
      console.log('[OfflineContext] Syncing', totalItems, 'items...');
      
      let processedItems = 0;
      let queueIterations = 0;
      const maxIterations = totalItems * 2; // Prevent infinite loops
      
      while (processedItems < totalItems && queueIterations < maxIterations) {
        queueIterations++;
        
        const syncItem = await offlineStorageCompat.getNextSyncItem();
        console.log(`[OfflineContext] Sync queue iteration ${queueIterations}:`, syncItem);
        
        if (!syncItem) {
          console.log('[OfflineContext] No more sync items in queue');
          break; // No more items to sync
        }

        try {
          if (syncItem.type === 'inspection') {
            // Sync inspection
            console.log(`[OfflineContext] Syncing inspection: ${syncItem.offlineId}`);
            await syncInspection(syncItem.offlineId);
          } else if (syncItem.type === 'photo') {
            // Sync photo
            console.log(`[OfflineContext] Syncing photo: ${syncItem.offlineId}`);
            await syncPhoto(syncItem.offlineId);
          }

          // Remove from sync queue
          await offlineStorageCompat.removeFromSyncQueue(syncItem.id);
          processedItems++;
          
          // Update progress
          const progress = Math.round((processedItems / totalItems) * 100);
          setSyncProgress(progress);
          
          console.log(`[OfflineContext] Successfully synced item ${processedItems}/${totalItems} (${progress}%)`);

        } catch (error) {
          console.error('[OfflineContext] Sync failed for item:', syncItem.offlineId, error);
          
          // Handle specific error cases
          if (syncItem.type === 'photo') {
            try {
              // Check if photo still exists
              const photo = await offlineStorageCompat.getPhotoByOfflineId(syncItem.offlineId);
              if (!photo) {
                console.warn(`[OfflineContext] Photo ${syncItem.offlineId} no longer exists, removing from sync queue`);
                await offlineStorageCompat.removeFromSyncQueue(syncItem.id);
                continue; // Skip to next item
              }
            } catch (checkError) {
              console.error('[OfflineContext] Error checking photo existence:', checkError);
            }
          }
          
          // Update sync status to failed
          if (syncItem.type === 'inspection') {
            await offlineStorageCompat.updateInspectionSyncStatus(
              syncItem.offlineId,
              'failed',
              undefined,
              error instanceof Error ? error.message : 'Unknown error'
            );
          } else if (syncItem.type === 'photo') {
            await offlineStorageCompat.updatePhotoSyncStatus(
              syncItem.offlineId,
              'failed'
            );
          }
        }
      }

      // Update sync stats
      await getSyncStats();
      setLastSyncAttempt(Date.now());
      
      console.log('[OfflineContext] Sync completed. Processed items:', processedItems);
      
      // Dispatch custom event to notify other components that sync is complete
      // This allows them to refresh their data to include newly synced inspections
      if (processedItems > 0) {
        window.dispatchEvent(new CustomEvent('offlineSyncCompleted', {
          detail: {
            syncedInspections: processedItems,
            timestamp: Date.now()
          }
        }));
        console.log('[OfflineContext] Dispatched offlineSyncCompleted event');
      }
      
    } catch (error) {
      console.error('[OfflineContext] Sync process failed:', error);
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  }, [isSyncing, isOnline, getSyncStats, isInitialized]);

  // Clean up orphaned sync queue items
  const cleanupOrphanedSyncItems = async () => {
    try {
      console.log('[OfflineContext] Cleaning up orphaned sync queue items...');
      
      // Get all sync queue items
      const syncItems = await offlineStorageCompat.getSyncQueueItems();
      let cleanedCount = 0;
      
      for (const item of syncItems) {
        if (item.type === 'inspection') {
          const inspection = await offlineStorageCompat.getInspectionByOfflineId(item.offlineId);
          if (!inspection) {
            console.warn(`[OfflineContext] Removing orphaned inspection sync item: ${item.offlineId}`);
            await offlineStorageCompat.removeFromSyncQueue(item.id);
            cleanedCount++;
          }
        } else if (item.type === 'photo') {
          const photo = await offlineStorageCompat.getPhotoByOfflineId(item.offlineId);
          if (!photo) {
            console.warn(`[OfflineContext] Removing orphaned photo sync item: ${item.offlineId}`);
            await offlineStorageCompat.removeFromSyncQueue(item.id);
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[OfflineContext] Cleaned up ${cleanedCount} orphaned sync items`);
      }
    } catch (error) {
      console.error('[OfflineContext] Error during cleanup:', error);
    }
  };

  // Sync inspection
  const syncInspection = async (offlineId: string) => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized yet');
    }
    
    try {
      const inspection = await offlineStorageCompat.getInspectionByOfflineId(offlineId);
      if (!inspection) {
        throw new Error('Inspection not found');
      }

      console.log('[OfflineContext] Syncing inspection:', offlineId);
      console.log('[OfflineContext] Inspection data to sync:', inspection.data);
      
      // Determine the correct API endpoint based on inspection type
      let apiEndpoint = '/api/inspections'; // Default
      
      // Check if this is a substation status (has substationNumber, substationName, transformerConditions)
      const isSubstationStatus = 
        inspection.data.substationNumber ||
        inspection.data.substationName ||
        (inspection.data.transformerConditions && typeof inspection.data.transformerConditions === 'object') ||
        (inspection.data.fuseConditions && typeof inspection.data.fuseConditions === 'object') ||
        (inspection.data.earthingConditions && typeof inspection.data.earthingConditions === 'object');
      
      // Check if this is a substation inspection (primary or secondary)
      const isSubstationInspection = 
        inspection.data.substationType === 'primary' || 
        inspection.data.substationType === 'secondary' ||
        inspection.data.type === 'secondary' ||
        // Check for substation-specific inspection item arrays
        (inspection.data.siteCondition && Array.isArray(inspection.data.siteCondition)) ||
        (inspection.data.transformer && Array.isArray(inspection.data.transformer)) ||
        (inspection.data.areaFuse && Array.isArray(inspection.data.areaFuse)) ||
        (inspection.data.arrestors && Array.isArray(inspection.data.arrestors)) ||
        (inspection.data.switchgear && Array.isArray(inspection.data.switchgear)) ||
        (inspection.data.distributionEquipment && Array.isArray(inspection.data.distributionEquipment)) ||
        (inspection.data.paintWork && Array.isArray(inspection.data.paintWork)) ||
        (inspection.data.generalBuilding && Array.isArray(inspection.data.generalBuilding)) ||
        (inspection.data.controlEquipment && Array.isArray(inspection.data.controlEquipment)) ||
        (inspection.data.powerTransformer && Array.isArray(inspection.data.powerTransformer)) ||
        (inspection.data.outdoorEquipment && Array.isArray(inspection.data.outdoorEquipment)) ||
        (inspection.data.basement && Array.isArray(inspection.data.basement));
      
      if (isSubstationStatus && !isSubstationInspection) {
        // This is substation status (not inspection)
        apiEndpoint = '/api/substation-status';
        console.log('[OfflineContext] Using substation status endpoint:', apiEndpoint, 'for record:', inspection.data.substationNumber || inspection.data.substationName);
      } else if (isSubstationInspection) {
        // This is a substation inspection (primary or secondary)
        apiEndpoint = '/api/substations';
        console.log('[OfflineContext] Using substation inspection endpoint:', apiEndpoint, 'for inspection type:', inspection.data.type || inspection.data.substationType);
      } else if (inspection.data.feederName || inspection.data.poleId) {
        // This is an overhead line inspection
        apiEndpoint = '/api/inspections';
        console.log('[OfflineContext] Using overhead line endpoint:', apiEndpoint);
      }
      
      // Prepare the data for the API
      const dataToSync = {
        ...inspection.data,
        // Ensure required fields are present
        createdAt: inspection.data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Add user information if available
        createdBy: inspection.data.createdBy || 'Offline User',
        inspectedBy: inspection.data.inspectedBy || 'Offline User'
      };
      
      console.log('[OfflineContext] Sending data to endpoint:', apiEndpoint, dataToSync);
      
      // Make real API call to sync inspection using apiRequest utility
      const result = await apiRequest(apiEndpoint, {
        method: 'POST',
        body: JSON.stringify(dataToSync)
      });

      console.log('[OfflineContext] Inspection synced successfully:', result);

      // Get the server ID from the response
      const serverId = result.id || result._id || result.firestoreId;
      
      // Dispatch event with ID mapping before deleting offline inspection
      window.dispatchEvent(new CustomEvent('inspectionSynced', {
        detail: {
          offlineId: offlineId,
          serverId: serverId,
          inspectionData: dataToSync,
          timestamp: Date.now()
        }
      }));
      console.log('[OfflineContext] Dispatched inspectionSynced event with mapping:', { offlineId, serverId });

      // Update sync status with real server ID
      await offlineStorageCompat.updateInspectionSyncStatus(
        offlineId,
        'synced',
        serverId
      );

      // Remove from offline storage after successful sync
      await offlineStorageCompat.deleteInspection(offlineId);
      console.log(`[OfflineContext] Inspection ${offlineId} removed from offline storage`);

    } catch (error) {
      console.error('[OfflineContext] Failed to sync inspection:', offlineId, error);
      throw error;
    }
  };

  // Sync photo
  const syncPhoto = async (offlineId: string) => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized yet');
    }
    
    try {
      console.log(`[OfflineContext] Attempting to sync photo: ${offlineId}`);
      
      const photo = await offlineStorageCompat.getPhotoByOfflineId(offlineId);
      if (!photo) {
        console.warn(`[OfflineContext] Photo not found for offlineId: ${offlineId}, cleaning up orphaned sync queue item`);
        // Remove the orphaned sync queue item since the photo doesn't exist
        await offlineStorageCompat.removeFromSyncQueue(offlineId);
        return; // Skip this photo, don't throw error
      }

      console.log('[OfflineContext] Photo found, syncing:', {
        offlineId,
        filename: photo.filename,
        type: photo.type,
        size: photo.size,
        inspectionId: photo.inspectionId
      });
      
      // Make real API call to sync photo
      const formData = new FormData();
      formData.append('photo', dataURLtoBlob(photo.data), photo.filename);
      formData.append('assetId', photo.inspectionId);
      
      // Determine photo type based on inspection type
      let photoType = 'overhead-inspection'; // Default
      if (photo.inspectionId && photo.inspectionId.startsWith('offline_')) {
        // This is an offline inspection, check the inspection data
        try {
          const inspection = await offlineStorageCompat.getInspectionByOfflineId(photo.inspectionId);
          if (inspection) {
            // Check if this is substation status first
            const isSubstationStatus = 
              inspection.data.substationNumber ||
              inspection.data.substationName ||
              (inspection.data.transformerConditions && typeof inspection.data.transformerConditions === 'object') ||
              (inspection.data.fuseConditions && typeof inspection.data.fuseConditions === 'object') ||
              (inspection.data.earthingConditions && typeof inspection.data.earthingConditions === 'object');
            
            // Use the same detection logic as syncInspection
            const isSubstationInspection = 
              inspection.data.substationType === 'primary' || 
              inspection.data.substationType === 'secondary' ||
              inspection.data.type === 'secondary' ||
              // Check for substation-specific inspection item arrays
              (inspection.data.siteCondition && Array.isArray(inspection.data.siteCondition)) ||
              (inspection.data.transformer && Array.isArray(inspection.data.transformer)) ||
              (inspection.data.areaFuse && Array.isArray(inspection.data.areaFuse)) ||
              (inspection.data.arrestors && Array.isArray(inspection.data.arrestors)) ||
              (inspection.data.switchgear && Array.isArray(inspection.data.switchgear)) ||
              (inspection.data.paintWork && Array.isArray(inspection.data.paintWork)) ||
              (inspection.data.generalBuilding && Array.isArray(inspection.data.generalBuilding)) ||
              (inspection.data.controlEquipment && Array.isArray(inspection.data.controlEquipment)) ||
              (inspection.data.powerTransformer && Array.isArray(inspection.data.powerTransformer)) ||
              (inspection.data.outdoorEquipment && Array.isArray(inspection.data.outdoorEquipment)) ||
              (inspection.data.basement && Array.isArray(inspection.data.basement));
            
            if (isSubstationStatus && !isSubstationInspection) {
              photoType = 'substation-status';
              console.log('[OfflineContext] Photo type determined as substation-status for record:', inspection.data.substationNumber || inspection.data.substationName);
            } else if (isSubstationInspection) {
              photoType = 'substation-inspection';
              console.log('[OfflineContext] Photo type determined as substation-inspection for inspection:', inspection.data.type || inspection.data.substationType);
            }
          }
        } catch (error) {
          console.warn('[OfflineContext] Could not determine photo type, using default:', error);
        }
      }
      
      formData.append('photoType', photoType);
      
      console.log('[OfflineContext] Uploading photo to server with type:', photoType);
      
      // Use apiRequest for consistency, but handle FormData specially
      const result = await apiRequest('/api/photos/upload-file', {
        method: 'POST',
        body: formData
      });

      console.log('[OfflineContext] Photo synced successfully:', result);

      // Update sync status with real server ID
      await offlineStorageCompat.updatePhotoSyncStatus(
        offlineId,
        'synced',
        result.id || result._id // Real server ID
      );

      // Remove from offline storage after successful sync
      await offlineStorageCompat.deletePhoto(offlineId);
      console.log(`[OfflineContext] Photo ${offlineId} removed from offline storage`);

    } catch (error) {
      console.error('[OfflineContext] Failed to sync photo:', offlineId, error);
      
      // If it's a "Photo not found" error, clean up the orphaned sync queue item
      if (error instanceof Error && error.message.includes('Photo not found')) {
        console.warn(`[OfflineContext] Cleaning up orphaned sync queue item for missing photo: ${offlineId}`);
        try {
          await offlineStorageCompat.removeFromSyncQueue(offlineId);
        } catch (cleanupError) {
          console.error('[OfflineContext] Failed to cleanup orphaned sync queue item:', cleanupError);
        }
        return; // Don't throw error, just skip this photo
      }
      
      throw error;
    }
  };

  // Helper function to convert data URL to blob
  const dataURLtoBlob = (dataURL: string): Blob => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized yet');
    }
    
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Preload feeder data for offline use
  const preloadFeederData = useCallback(async () => {
    if (!isInitialized) {
      console.log('[OfflineContext] Cannot preload feeder data - not initialized yet');
      throw new Error('Offline storage not initialized');
    }
    
    if (!isOnline) {
      console.log('[OfflineContext] Cannot preload feeder data while offline');
      throw new Error('Cannot preload while offline');
    }

    try {
      console.log('[OfflineContext] Preloading feeder data for offline use...');
      console.log('[OfflineContext] isInitialized:', isInitialized);
      console.log('[OfflineContext] isOnline:', isOnline);
      
      // Import FeederService dynamically to avoid circular dependencies
      console.log('[OfflineContext] Importing FeederService...');
      const { FeederService } = await import('@/services/FeederService');
      console.log('[OfflineContext] FeederService imported successfully');
      
      const feederService = FeederService.getInstance();
      console.log('[OfflineContext] FeederService instance created');
      
      // Fetch all feeders to cache them
      console.log('[OfflineContext] Calling feederService.getAllFeeders()...');
      const allFeeders = await feederService.getAllFeeders();
      console.log('[OfflineContext] Preloaded feeder data:', allFeeders.length, 'feeders');
      
      // Clean up expired data
      console.log('[OfflineContext] Cleaning up expired feeder data...');
      await offlineStorageCompat.cleanupExpiredFeederData();
      console.log('[OfflineContext] Cleanup completed');
      
    } catch (error) {
      console.error('[OfflineContext] Failed to preload feeder data:', error);
      console.error('[OfflineContext] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error; // Re-throw the error so the calling code knows it failed
    }
  }, [isOnline, isInitialized]);

  // Get cached feeder data for a region
  const getCachedFeederData = useCallback(async (regionId: string) => {
    if (!isInitialized) {
      console.log('[OfflineContext] Skipping getCachedFeederData - not initialized yet');
      return null;
    }
    
    try {
      return await offlineStorageCompat.getFeederData(regionId);
    } catch (error) {
      console.error('[OfflineContext] Failed to get cached feeder data:', error);
      return null;
    }
  }, [isInitialized]);

  // Test sync function for debugging
  const testSync = useCallback(async () => {
    console.log('[OfflineContext] Testing sync process...');
    console.log('[OfflineContext] Current state:', {
      isOnline,
      isInitialized,
      isSyncing,
      totalOfflineItems,
      pendingInspections,
      pendingPhotos
    });
    
    try {
      // Check offline storage status
      const stats = await offlineStorageCompat.getSyncStats();
      console.log('[OfflineContext] Offline storage stats:', stats);
      
      // Check if there are items to sync
      if (stats.syncQueueCount > 0) {
        console.log('[OfflineContext] Found items to sync, starting sync...');
        await startSync();
      } else {
        console.log('[OfflineContext] No items in sync queue');
      }
    } catch (error) {
      console.error('[OfflineContext] Test sync failed:', error);
    }
  }, [isOnline, isInitialized, isSyncing, totalOfflineItems, pendingInspections, pendingPhotos, startSync]);

  // Enhanced initialization check
  const checkInitialization = useCallback(async () => {
    try {
      console.log('[OfflineContext] Checking initialization status...');
      const status = offlineStorageCompat.getStatus();
      console.log('[OfflineContext] Storage status:', status);
      
      if (status.isReady) {
        console.log('[OfflineContext] Storage is ready');
        const stats = await offlineStorageCompat.getSyncStats();
        console.log('[OfflineContext] Current sync stats:', stats);
      } else {
        console.log('[OfflineContext] Storage not ready yet');
      }
    } catch (error) {
      console.error('[OfflineContext] Initialization check failed:', error);
    }
  }, []);

  // Manual sync functions
  const syncVITData = useCallback(async () => {
    if (!isInitialized) {
      console.log('[OfflineContext] Skipping syncVITData - not initialized yet');
      return;
    }

    try {
      console.log('[OfflineContext] Starting manual VIT sync...');
      const { VITSyncService } = await import('@/services/VITSyncService');
      const vitSyncService = VITSyncService.getInstance();
      const pendingVITAssets = await vitSyncService.getPendingVITAssets();
      console.log('[OfflineContext] Found', pendingVITAssets.length, 'pending VIT assets to sync.');

      if (pendingVITAssets.length === 0) {
        console.log('[OfflineContext] No pending VIT assets to sync.');
        return;
      }

      await vitSyncService.syncAllVITData();
      console.log('[OfflineContext] Manual VIT sync completed.');
      await getSyncStats(); // Update stats after sync
    } catch (error) {
      console.error('[OfflineContext] Failed to perform manual VIT sync:', error);
    }
  }, [isInitialized, getSyncStats]);

  // Context value
  const value: OfflineContextType = {
    isInitialized,
    isOnline,
    isOffline: !isOnline,
    isSyncing,
    syncProgress,
    lastSyncAttempt,
    pendingInspections,
    pendingPhotos,
    totalOfflineItems,
    saveInspectionOffline,
    savePhotoOffline,
    startSync,
    syncVITData,
    getOfflineInspections,
    getOfflinePhotos,
    checkOnlineStatus,
    getSyncStats,
    forceSetOnlineStatus,
    toggleNetworkCheck,
    isNetworkCheckDisabled,
    preloadFeederData,
    getCachedFeederData,
    testSync,
    checkInitialization
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

// Custom hook to use offline context
export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
    