import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { OfflineStorageService } from "@/services/OfflineStorageService";
import { OP5Fault, ControlSystemOutage } from "@/lib/types";
import { format } from "date-fns";

interface PendingFault {
  key: string;
  fault: Omit<OP5Fault, 'id'> | Omit<ControlSystemOutage, 'id'>;
  timestamp: number;
  type: 'op5' | 'control';
}

export function PendingFaultsList() {
  const [pendingFaults, setPendingFaults] = useState<PendingFault[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const offlineStorage = OfflineStorageService.getInstance();

  const loadPendingFaults = async () => {
    try {
      setIsLoading(true);
      const records = await offlineStorage.getOfflineRecords();
      const faultRecords = records.filter(record => 
        record.endpoint.includes('/api/op5Faults') || 
        record.endpoint.includes('/api/controlOutages')
      );
      
      const faults: PendingFault[] = faultRecords.map(record => {
        const data = record.data;
        const type = record.endpoint.includes('/api/op5Faults') ? 'op5' : 'control';
        return {
          key: record.id,
          fault: data,
          timestamp: record.timestamp,
          type
        };
      });
      
      setPendingFaults(faults);
    } catch (error) {
      console.error('[PendingFaultsList] Error loading pending faults:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await offlineStorage.syncOfflineRecords();
      await loadPendingFaults(); // Reload the list after sync
    } catch (error) {
      console.error('[PendingFaultsList] Error syncing faults:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadPendingFaults();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Offline Faults</CardTitle>
          <CardDescription>Loading pending faults...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (pendingFaults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Offline Faults</CardTitle>
          <CardDescription>No pending faults found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Pending Offline Faults</CardTitle>
          <CardDescription>
            {pendingFaults.length} fault{pendingFaults.length !== 1 ? 's' : ''} waiting to be synced
          </CardDescription>
        </div>
        <Button 
          onClick={handleSync} 
          disabled={isSyncing || !offlineStorage.isOnline()}
          variant="outline"
          size="sm"
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingFaults.map(({ key, fault, timestamp, type }) => (
            <div 
              key={key} 
              className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">
                    {type === 'op5' ? 'OP5 Fault' : 'Control System Outage'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Saved on {format(new Date(timestamp), 'PPpp')}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {type === 'op5' ? (fault as Omit<OP5Fault, 'id'>).faultType : 'Control System'}
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-sm">
                  <span className="font-medium">Location:</span>{' '}
                  {type === 'op5' 
                    ? (fault as Omit<OP5Fault, 'id'>).substationName
                    : (fault as Omit<ControlSystemOutage, 'id'>).areaAffected}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Region:</span>{' '}
                  {type === 'op5' 
                    ? (fault as Omit<OP5Fault, 'id'>).region
                    : (fault as Omit<ControlSystemOutage, 'id'>).region}
                </p>
                <p className="text-sm">
                  <span className="font-medium">District:</span>{' '}
                  {type === 'op5' 
                    ? (fault as Omit<OP5Fault, 'id'>).district
                    : (fault as Omit<ControlSystemOutage, 'id'>).district}
                </p>
                {type === 'op5' && (
                  <p className="text-sm">
                    <span className="font-medium">Status:</span>{' '}
                    {(fault as Omit<OP5Fault, 'id'>).status}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 