import { useCallback } from 'react';
import { useLoadMonitoringOffline } from '@/contexts/LoadMonitoringOfflineContext';
import { LoadMonitoringData } from '@/lib/types';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

export const useLoadMonitoringOfflineCRUD = () => {
  const { isOnline, saveOffline, startSync } = useLoadMonitoringOffline();
  const { toast } = useToast();

  // Create record with offline fallback
  const createRecord = useCallback(async (record: LoadMonitoringData): Promise<any> => {
    console.log('[LoadMonitoringOfflineCRUD] createRecord called, isOnline:', isOnline);
    
    try {
      if (isOnline) {
        console.log('[LoadMonitoringOfflineCRUD] Attempting online create...');
        // Try online first
        const result = await apiRequest('/api/loadMonitoring', {
          method: 'POST',
          body: JSON.stringify(record)
        });
        
        console.log('[LoadMonitoringOfflineCRUD] Online create successful:', result);
        
        toast({
          title: "Record Created",
          description: "Load monitoring record created successfully",
          variant: "default",
        });
        
        // Return result with synced flag for online operations
        return { ...result, synced: true };
      } else {
        console.log('[LoadMonitoringOfflineCRUD] Saving offline...');
        // Save offline
        const offlineId = await saveOffline(record, 'create');
        
        toast({
          title: "Saved Offline",
          description: "Record saved offline. Will sync when online.",
          variant: "default",
        });
        
        return { offlineId, synced: false };
      }
    } catch (error) {
      if (isOnline) {
        // Network failed, save offline
        console.log('[LoadMonitoringOfflineCRUD] Online create failed, saving offline:', error);
        
        try {
          const offlineId = await saveOffline(record, 'create');
          
          toast({
            title: "Saved Offline",
            description: "Network failed. Record saved offline for later sync.",
            variant: "default",
          });
          
          return { offlineId, synced: false };
        } catch (offlineError) {
          console.error('[LoadMonitoringOfflineCRUD] Failed to save offline:', offlineError);
          throw offlineError;
        }
      } else {
        throw error;
      }
    }
  }, [isOnline, saveOffline, toast]);

  // Update record with offline fallback
  const updateRecord = useCallback(async (id: string, record: LoadMonitoringData): Promise<any> => {
    console.log('[LoadMonitoringOfflineCRUD] updateRecord called, isOnline:', isOnline, 'id:', id);
    
    try {
      if (isOnline) {
        console.log('[LoadMonitoringOfflineCRUD] Attempting online update...');
        // Try online first
        const result = await apiRequest(`/api/loadMonitoring/${id}`, {
          method: 'PUT',
          body: JSON.stringify(record)
        });
        
        console.log('[LoadMonitoringOfflineCRUD] Online update successful:', result);
        
        toast({
          title: "Record Updated",
          description: "Load monitoring record updated successfully",
          variant: "default",
        });
        
        // Return result with synced flag for online operations
        return { ...result, synced: true };
      } else {
        console.log('[LoadMonitoringOfflineCRUD] Saving update offline...');
        // Save offline
        const offlineId = await saveOffline({ ...record, id }, 'update');
        
        toast({
          title: "Saved Offline",
          description: "Update saved offline. Will sync when online.",
          variant: "default",
        });
        
        return { offlineId, synced: false };
      }
    } catch (error) {
      if (isOnline) {
        // Network failed, save offline
        console.log('[LoadMonitoringOfflineCRUD] Online update failed, saving offline:', error);
        
        try {
          const offlineId = await saveOffline({ ...record, id }, 'update');
          
          toast({
            title: "Saved Offline",
            description: "Network failed. Update saved offline for later sync.",
            variant: "default",
          });
          
          return { offlineId, synced: false };
        } catch (offlineError) {
          console.error('[LoadMonitoringOfflineCRUD] Failed to save offline:', offlineError);
          throw offlineError;
        }
      } else {
        throw error;
      }
    }
  }, [isOnline, saveOffline, toast]);

  // Delete record with offline fallback
  const deleteRecord = useCallback(async (id: string, record: LoadMonitoringData): Promise<any> => {
    console.log('[LoadMonitoringOfflineCRUD] deleteRecord called, isOnline:', isOnline, 'id:', id);
    
    try {
      if (isOnline) {
        console.log('[LoadMonitoringOfflineCRUD] Attempting online delete...');
        // Try online first
        const result = await apiRequest(`/api/loadMonitoring/${id}`, {
          method: "DELETE"
        });
        
        console.log('[LoadMonitoringOfflineCRUD] Online delete successful:', result);
        
        toast({
          title: "Record Deleted",
          description: "Load monitoring record deleted successfully",
          variant: "default",
        });
        
        // Return result with synced flag for online operations
        return { ...result, synced: true };
      } else {
        console.log('[LoadMonitoringOfflineCRUD] Saving delete offline...');
        // Save offline
        const offlineId = await saveOffline({ ...record, id }, 'delete');
        
        toast({
          title: "Saved Offline",
          description: "Delete saved offline. Will sync when online.",
          variant: "default",
        });
        
        return { offlineId, synced: false };
      }
    } catch (error) {
      if (isOnline) {
        // Network failed, save offline
        console.log('[LoadMonitoringOfflineCRUD] Online delete failed, saving offline:', error);
        
        try {
          const offlineId = await saveOffline({ ...record, id }, 'delete');
          
          toast({
            title: "Saved Offline",
            description: "Network failed. Delete saved offline for later sync.",
            variant: "default",
          });
          
          return { offlineId, synced: false };
        } catch (offlineError) {
          console.error('[LoadMonitoringOfflineCRUD] Failed to save offline:', offlineError);
          throw offlineError;
        }
      } else {
        throw error;
      }
    }
  }, [isOnline, saveOffline, toast]);

  // Manual sync
  const syncOfflineData = useCallback(async () => {
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
      throw error;
    }
  }, [startSync, toast]);

  return {
    createRecord,
    updateRecord,
    deleteRecord,
    syncOfflineData,
    isOnline
  };
};
