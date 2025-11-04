import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SubstationInspection } from '@/lib/asset-types';
import { toast } from '@/components/ui/sonner';
import { apiRequest } from '@/lib/api';

export interface SubstationInspectionDB extends DBSchema {
  substationInspections: {
    key: string;
    value: PendingSubstationInspection;
  };
}

export interface PendingSubstationInspection {
  id: string;
  record: SubstationInspection;
  action: 'create' | 'update' | 'delete';
  timestamp: string;
  retryCount: number;
  lastRetry?: string;
  firestoreId?: string;
}

interface PendingSyncItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  record: SubstationInspection;
  retryCount?: number;
  lastRetry?: string;
  firestoreId?: string;
}

export class SubstationInspectionService {
  private static instance: SubstationInspectionService;
  private db: IDBPDatabase<SubstationInspectionDB> | null = null;
  private isInitializing = false;
  private initPromise: Promise<IDBPDatabase<SubstationInspectionDB>> | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  private constructor() {
    console.log('Creating new SubstationInspectionService instance');
    this.init();
    this.setupOnlineStatusListener();
  }

  public static getInstance(): SubstationInspectionService {
    if (!SubstationInspectionService.instance) {
      SubstationInspectionService.instance = new SubstationInspectionService();
    }
    return SubstationInspectionService.instance;
  }

  public isInternetAvailable(): boolean {
    return this.isOnline;
  }

  private async init() {
    console.log('Initializing SubstationInspectionService...');
    if (this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('Opening IndexedDB...');
        if (this.db) {
          console.log('Database already initialized');
          this.isInitializing = false;
          resolve(this.db);
          return;
        }

        this.db = await openDB<SubstationInspectionDB>('substation-inspection-offline', 1, {
          upgrade(db) {
            console.log('Upgrading database...');
            if (!db.objectStoreNames.contains('substationInspections')) {
              console.log('Creating substationInspections store');
              db.createObjectStore('substationInspections', { keyPath: 'id' });
            }
          },
          blocked() {
            console.log('Database blocked');
          },
          blocking() {
            console.log('Database blocking');
          },
          terminated() {
            console.log('Database terminated');
            this.db = null;
            this.initPromise = null;
            this.isInitializing = false;
          }
        });
        console.log('IndexedDB initialized successfully');
        this.isInitializing = false;
        resolve(this.db);
      } catch (error) {
        console.error('Error initializing SubstationInspectionService:', error);
        this.db = null;
        this.initPromise = null;
        this.isInitializing = false;
        reject(error);
      }
    });

    return this.initPromise;
  }

  private async ensureDBReady() {
    if (!this.db || this.isInitializing) {
      await this.init();
    }
    return this.db;
  }

  private setupOnlineStatusListener() {
    console.log('Setting up online status listener. Current status:', navigator.onLine);
    
    window.addEventListener('online', async () => {
      console.log('Device is back online, updating status and triggering sync...');
      this.isOnline = true;
      try {
        await this.ensureDBReady();
        await this.syncPendingRecords();
      } catch (error) {
        console.error('Error during online sync:', error);
      }
    });

    window.addEventListener('offline', () => {
      console.log('Device went offline');
      this.isOnline = false;
    });

    // Set initial online status
    this.isOnline = navigator.onLine;

    if (this.isOnline) {
      console.log('Already online, triggering initial sync...');
      this.syncPendingRecords().catch(error => {
        console.error('Error during initial sync:', error);
      });
    }
  }

  private async syncPendingRecords() {
    if (!this.isOnline) {
      console.log('Device is offline, skipping sync');
      return;
    }

    console.log('Syncing pending records...');
    const result = await this.syncSubstationInspectionRecords();
    console.log('Sync result:', result);

    // After sync, refresh the data
    try {
      const allRecords = await this.getAllSubstationInspections();
      console.log('Refreshed records after sync:', allRecords.length);
      
      // Dispatch event to notify UI of the update
      window.dispatchEvent(new CustomEvent('substationInspectionSyncComplete', {
        detail: {
          timestamp: new Date().toISOString(),
          status: 'synced',
          recordCount: allRecords.length
        }
      }));
    } catch (error) {
      console.error('Error refreshing records after sync:', error);
    }
  }

  private async syncSubstationInspectionRecords(): Promise<{ successCount: number; failureCount: number }> {
    let pendingRecords: PendingSyncItem[] = [];
    
    try {
      if (!this.db) {
        console.error('Database not initialized');
        return { successCount: 0, failureCount: 0 };
      }

      // Get all pending records
      pendingRecords = await this.getPendingSubstationInspectionRecords();
      console.log('SubstationInspectionService: Retrieved pending records:', pendingRecords.length, pendingRecords);

      if (pendingRecords.length === 0) {
        console.log('No pending records to sync');
        return { successCount: 0, failureCount: 0 };
      }

      let successCount = 0;
      let failureCount = 0;

      // Process each pending record
      for (const record of pendingRecords) {
        try {
          console.log('Processing pending record:', record);
          
          if (!record || !record.id) {
            console.error('Invalid record:', record);
            failureCount++;
            continue;
          }

          // Handle different actions
          switch (record.action) {
            case 'create':
              try {
                if (!record.record) {
                  console.error('Create action missing record data');
                  failureCount++;
                  break;
                }
                await apiRequest('/api/substationInspections', {
                  method: 'POST',
                  body: JSON.stringify(record.record),
                });
                await this.removePendingSubstationInspection(record.id);
                successCount++;
              } catch (error) {
                console.error('Error creating inspection in Firestore:', error);
                failureCount++;
              }
              break;

            case 'update':
              try {
                if (!record.record) {
                  console.error('Update action missing record data');
                  failureCount++;
                  break;
                }
                
                await apiRequest(`/api/substationInspections/${record.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(record.record),
                });
                await this.removePendingSubstationInspection(record.id);
                successCount++;
              } catch (error) {
                console.error('Error updating inspection in Firestore:', error);
                failureCount++;
              }
              break;

            case 'delete':
              try {
                await apiRequest(`/api/substationInspections/${record.id}`, {
                  method: 'DELETE',
                });
                await this.removePendingSubstationInspection(record.id);
                successCount++;
              } catch (error) {
                console.error('Error deleting inspection from Firestore:', error);
                failureCount++;
              }
              break;
          }
        } catch (error) {
          console.error('Error processing pending record:', error);
          failureCount++;
        }
      }

      console.log(`Sync completed. Success: ${successCount}, Failures: ${failureCount}`);
      return { successCount, failureCount };
    } catch (error) {
      console.error('Error in syncSubstationInspectionRecords:', error);
      return { successCount: 0, failureCount: pendingRecords.length };
    }
  }

  private async updatePendingSyncItem(id: string, updates: Partial<PendingSubstationInspection>): Promise<void> {
    const db = await openDB('substation-inspection-offline', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('substationInspections')) {
          db.createObjectStore('substationInspections', { keyPath: 'id' });
        }
      },
    });
    const tx = db.transaction('substationInspections', 'readwrite');
    const store = tx.objectStore('substationInspections');
    
    const record = await store.get(id);
    if (record) {
      await store.put({ ...record, ...updates });
    }
    await tx.done;
  }

  public async saveSubstationInspectionOffline(inspection: SubstationInspection, action: 'create' | 'update' | 'delete'): Promise<void> {
    try {
      await this.ensureDBReady();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const tx = this.db.transaction('substationInspections', 'readwrite');
      const store = tx.objectStore('substationInspections');

      // For delete action, use the correct ID
      const recordId = action === 'delete' ? (inspection.firestoreId || inspection.id) : inspection.id;

      // Check if a record with this ID already exists
      const existingRecord = await store.get(recordId);
      
      if (existingRecord) {
        console.log('Found existing record:', existingRecord);
        
        // If the existing record is already synced and we're trying to create a new one,
        // we should update instead
        if (action === 'create' && existingRecord.record.syncStatus === 'synced') {
          console.log('Converting create to update for synced record');
          action = 'update';
        }
        
        // If we're trying to delete a record that's already pending deletion,
        // we can skip this operation
        if (action === 'delete' && existingRecord.action === 'delete') {
          console.log('Record already pending deletion, skipping');
          return;
        }
      }

      // Format the data according to PendingSubstationInspection interface
      const pendingRecord: PendingSubstationInspection = {
        id: recordId,
        record: {
          ...inspection,
          syncStatus: 'pending',
          updatedAt: new Date().toISOString()
        },
        action,
        timestamp: Date.now().toString(),
        retryCount: existingRecord?.retryCount || 0,
        firestoreId: inspection.firestoreId || existingRecord?.firestoreId
      };

      // Store the record in IndexedDB
      await store.put(pendingRecord);
      await tx.done;

      // Dispatch event for UI update
      const event = new CustomEvent('substationInspectionUpdated', {
        detail: {
          action,
          inspection: pendingRecord.record
        }
      });
      window.dispatchEvent(event);

      // Log for debugging
      console.log(`Saved inspection offline (${action}):`, pendingRecord);
    } catch (error) {
      console.error('Error saving inspection offline:', error);
      // If we get a database error, try to reinitialize
      if (error.name === 'InvalidStateError') {
        this.db = null;
        await this.init();
        // Retry the operation once
        return this.saveSubstationInspectionOffline(inspection, action);
      }
      throw error;
    }
  }

  public async getPendingSubstationInspectionRecords(): Promise<PendingSubstationInspection[]> {
    if (!this.db) {
      console.error('Database not initialized');
      await this.init();
      if (!this.db) {
        throw new Error('Failed to initialize database');
      }
    }

    try {
      const records = await this.db.getAll('substationInspections');
      console.log('Retrieved pending records:', records.length);
      return records;
    } catch (error) {
      console.error('Error getting pending records:', error);
      return [];
    }
  }

  private async removePendingSubstationInspection(id: string): Promise<void> {
    if (!this.db) {
      console.error('Database not initialized');
      await this.init();
      if (!this.db) {
        throw new Error('Failed to initialize database');
      }
    }

    try {
      await this.db.delete('substationInspections', id);
      console.log('Successfully removed pending record:', id);
    } catch (error) {
      console.error('Error removing pending record:', id, error);
      throw error;
    }
  }

  private deepCleanUndefined(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepCleanUndefined(item));
    }
    
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, this.deepCleanUndefined(value)])
    );
  }

  private cleanDataForFirestore(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.cleanDataForFirestore(item)).filter(item => item !== null);
    }

    if (typeof data === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        const cleanedValue = this.cleanDataForFirestore(value);
        if (cleanedValue !== null && cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return Object.keys(cleaned).length > 0 ? cleaned : null;
    }

    return data;
  }

  public async getOfflineSubstationInspections(): Promise<SubstationInspection[]> {
    await this.ensureDBReady();

    try {
      const records = await this.db!.getAll('substationInspections');
      console.log('SubstationInspectionService: Retrieved pending records:', records.length, records);
      
      // Map records to SubstationInspection with defensive checks
      return records.map(pendingRecord => {
        console.log('Processing pending record:', pendingRecord);
        
        if (!pendingRecord) {
          console.error('Null or undefined pending record');
          return null;
        }

        const now = new Date().toISOString();
        let record: SubstationInspection;

        // Handle both old and new data structures
        if ('record' in pendingRecord) {
          // New structure with record property
          record = pendingRecord.record;
        } else {
          // Old structure where the record is the pendingRecord itself
          record = pendingRecord as unknown as SubstationInspection;
        }

        // Ensure all required fields are present
        const inspection: SubstationInspection = {
          id: record.id || pendingRecord.id,
          region: record.region || '',
          regionId: record.regionId || '',
          district: record.district || '',
          districtId: record.districtId || '',
          date: record.date || now,
          substationNo: record.substationNo || '',
          substationName: record.substationName || '',
          type: record.type || '',
          location: record.location || '',
          voltageLevel: record.voltageLevel || '',
          status: record.status || '',
          remarks: record.remarks || '',
          syncStatus: 'pending',
          createdAt: record.createdAt || now,
          updatedAt: record.updatedAt || now,
          // Add any other required fields with default values
          ...record
        };

        console.log('Processed inspection:', inspection);
        return inspection;
      }).filter((inspection): inspection is SubstationInspection => inspection !== null);
    } catch (error) {
      console.error('Error getting offline inspections:', error);
      return [];
    }
  }

  public async getAllSubstationInspections(): Promise<SubstationInspection[]> {
    try {
      // Always get offline data first
      const offlineRecords = await this.getOfflineSubstationInspections();
      console.log('Retrieved offline records:', offlineRecords.length);
      
      // Get pending records to check for deletions
      const pendingRecords = await this.getPendingSubstationInspectionRecords();
      const pendingDeletions = new Set(
        pendingRecords
          .filter(record => record.action === 'delete')
          .map(record => record.id)
      );
      
      // If we're online, get Firestore data
      if (this.isOnline) {
        try {
          // Check if user is authenticated
          // const auth = getAuth();
          // const currentUser = auth.currentUser;
          
          // if (!currentUser) {
          //   console.log('User not authenticated, returning offline records only');
          //   return offlineRecords.filter(record => !pendingDeletions.has(record.id));
          // }

          // const db = getFirestore();
          // const snapshot = await getDocs(collection(db, 'substationInspections'));
          // const firestoreRecords = snapshot.docs.map(doc => {
          //   const data = doc.data();
          //   return {
          //     id: doc.id,
          //     ...data,
          //     createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          //     updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          //     syncStatus: 'synced'
          //   } as SubstationInspection;
          // });
          // console.log('Retrieved Firestore records:', firestoreRecords.length);

          // // Create a map of all records by ID
          // const recordMap = new Map<string, SubstationInspection>();
          
          // // Add Firestore records to map first (they take precedence)
          // firestoreRecords.forEach(record => {
          //   if (record.id) {
          //     recordMap.set(record.id, record);
          //   }
          // });

          // // Add offline records that aren't in Firestore or have a different syncStatus
          // // and aren't pending deletion
          // offlineRecords.forEach(record => {
          //   if (!record.id) {
          //     console.warn('Offline record missing ID:', record);
          //     return;
          //   }

          //   // Skip if the record is pending deletion
          //   if (pendingDeletions.has(record.id)) {
          //     console.log('Skipping record pending deletion:', record.id);
          //     return;
          //   }

          //   const existingRecord = recordMap.get(record.id);
          //   if (!existingRecord || existingRecord.syncStatus !== 'synced') {
          //     recordMap.set(record.id, record);
          //   }
          // });

          // // Convert map to array and sort by updatedAt
          // const allRecords = Array.from(recordMap.values()).sort(
          //   (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          // );
          
          // console.log('Final merged records:', allRecords.length);
          // return allRecords;
        } catch (error) {
          console.error('Error fetching Firestore data:', error);
          // If there's an error fetching Firestore data, return offline records
          // but still filter out pending deletions
          return offlineRecords.filter(record => !pendingDeletions.has(record.id));
        }
      }

      // If offline, return offline records but filter out pending deletions
      return offlineRecords.filter(record => !pendingDeletions.has(record.id));
    } catch (error) {
      console.error('Error getting all substation inspections:', error);
      // If there's an error, return offline records as fallback
      // but still filter out pending deletions
      const offlineRecords = await this.getOfflineSubstationInspections();
      const pendingRecords = await this.getPendingSubstationInspectionRecords();
      const pendingDeletions = new Set(
        pendingRecords
          .filter(record => record.action === 'delete')
          .map(record => record.id)
      );
      return offlineRecords.filter(record => !pendingDeletions.has(record.id));
    }
  }

  public async triggerSyncAndRefresh(): Promise<void> {
    console.log('Triggering sync and refresh...');
    try {
      await this.ensureDBReady();
      
      // Update online status
      this.isOnline = navigator.onLine;
      
      // Trigger sync if online
      if (this.isOnline) {
        console.log('Online - triggering sync...');
        await this.syncPendingRecords();
      } else {
        console.log('Offline - sync will be triggered when connection is restored');
      }
    } catch (error) {
      console.error('Error during sync and refresh:', error);
      throw error;
    }
  }
} 