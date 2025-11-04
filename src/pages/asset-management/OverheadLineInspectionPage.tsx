import { useState, useEffect, useMemo, useCallback } from "react";
import { useData } from "@/contexts/DataContext";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { apiRequest } from "@/lib/api";
import { LoggingService } from "@/services/LoggingService";
import { cache } from "@/utils/cache";

import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OverheadLineInspectionForm } from "@/components/overhead-line/OverheadLineInspectionForm";
import { OverheadLineInspectionsTable } from "@/components/overhead-line/OverheadLineInspectionsTable";
import { PlusCircle, RefreshCw, Wifi, WifiOff, Database } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { NetworkInspection } from "@/lib/types";
import { OverheadLineInspectionDetails } from "@/components/overhead-line/OverheadLineInspectionDetails";
import { AccessControlWrapper } from "@/components/access-control/AccessControlWrapper";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { InspectionDetailsView } from "@/components/inspection/InspectionDetailsView";
import { useNavigate } from "react-router-dom";
import { OverheadLineInspectionDetailsView } from "@/components/overhead-line/OverheadLineInspectionDetailsView";
import { OfflineBadge } from "@/components/common/OfflineBadge";
import { DeleteConfirmationDialog, useDeleteConfirmation } from "@/components/common/DeleteConfirmationDialog";

export default function OverheadLineInspectionPage() {
  const { user } = useAzureADAuth();
  const [activeTab, setActiveTab] = useState("inspections");
  const [isInspectionFormOpen, setIsInspectionFormOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<NetworkInspection | null>(null);
  const [editingInspection, setEditingInspection] = useState<NetworkInspection | null>(null);
  const { isOpen, deleteItem, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation();
  const { networkInspections, updateNetworkInspection, deleteNetworkInspection, addNetworkInspection, districts, regions, refreshNetworkInspections } = useData();
  const { 
    isOnline, 
    isOffline, 
    pendingInspections, 
    pendingPhotos, 
    totalOfflineItems,
    getOfflineInspections,
    saveInspectionOffline,
    startSync
  } = useOffline();
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedFeeder, setSelectedFeeder] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20; // Optimized page size after removing base64 data
  const navigate = useNavigate();
  const [offlineInspections, setOfflineInspections] = useState<any[]>([]);

  // Load offline inspections
  useEffect(() => {
    const loadOfflineInspections = async () => {
      try {
        const offlineData = await getOfflineInspections();
        setOfflineInspections(offlineData);
      } catch (error) {
        console.error('[OverheadLineInspectionPage] Failed to load offline inspections:', error);
      }
    };

    // Load initial offline inspections
    loadOfflineInspections();

    // Set up interval to refresh offline data
    const intervalId = setInterval(loadOfflineInspections, 5000); // Refresh every 5 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [getOfflineInspections]);

  // Handle online/offline status changes from offline context
  useEffect(() => {
    if (isOnline && totalOfflineItems > 0) {
      // Auto-sync when coming back online with pending items
      startSync();
    }
  }, [isOnline, totalOfflineItems, startSync]);

  // Handle force sync events from table
  useEffect(() => {
    const handleForceSync = async (event: CustomEvent) => {
      const { offlineId } = event.detail;
      if (offlineId && isOnline) {
        try {
          await startSync();
          toast.success("Force sync started for inspection");
        } catch (error) {
          toast.error("Failed to force sync inspection");
        }
      } else if (!isOnline) {
        toast.error("Cannot sync while offline");
      }
    };

    window.addEventListener('forceSyncInspection', handleForceSync as EventListener);
    return () => {
      window.removeEventListener('forceSyncInspection', handleForceSync as EventListener);
    };
  }, [isOnline, startSync]);

  // Filter regions and districts based on user role for UI display
  const filteredRegions = useMemo(() => {
    if (!user) return regions;
    
    // System admin and global engineer can see all regions
    if (user.role === 'system_admin' || user.role === 'global_engineer') {
      return regions;
    }
    
    // Regional users can only see their assigned region
    if (user.role === 'regional_engineer' || user.role === 'project_engineer' || user.role === 'regional_general_manager') {
      return regions.filter(r => r.name === user.region);
    }
    
    // Ashsubt users can see all Ashanti regions
    if (user.role === 'ashsubt') {
      return regions.filter(r => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(r.id));
    }
    
    // Accsubt users can see all Accra regions
    if (user.role === 'accsubt') {
      return regions.filter(r => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(r.id));
    }
    
    // District users can only see their assigned region
    if (user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') {
      const userDistrict = districts.find(d => d.name === user.district);
      if (userDistrict) {
        return regions.filter(r => r.id === userDistrict.regionId);
      }
    }
    
    return regions;
  }, [regions, districts, user]);

  // Filter districts based on selected region and user role
  const filteredDistricts = useMemo(() => {
    if (!user) return districts;
    
    // System admin and global engineer can see all districts in selected region
    if (user.role === 'system_admin' || user.role === 'global_engineer') {
      if (!selectedRegion) return districts;
      return districts.filter(d => d.regionId === selectedRegion);
    }
    
    // Regional users can see all districts in their region
    if (user.role === 'regional_engineer' || user.role === 'project_engineer' || user.role === 'regional_general_manager' || user.role === 'ashsubt' || user.role === 'accsubt') {
      // For ashsubt and accsubt, show districts based on selected region
      if (user.role === 'ashsubt' || user.role === 'accsubt') {
        if (!selectedRegion) {
          // Show all districts in their allowed regions
          if (user.role === 'ashsubt') {
            return districts.filter(d => ['subtransmission-ashanti', 'ashanti-east', 'ashanti-west', 'ashanti-south'].includes(d.regionId));
          }
          if (user.role === 'accsubt') {
            return districts.filter(d => ['subtransmission-accra', 'accra-east', 'accra-west'].includes(d.regionId));
          }
        }
        return districts.filter(d => d.regionId === selectedRegion);
      }
      // For regional engineers, project engineers, and regional general managers (single assigned region)
      if (!selectedRegion) return districts.filter(d => {
        const userRegion = regions.find(r => r.name === user.region);
        return userRegion ? d.regionId === userRegion.id : false;
      });
      return districts.filter(d => d.regionId === selectedRegion);
    }
    
    // District users can only see their assigned district
    if (user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') {
      return districts.filter(d => d.name === user.district);
    }
    
    return districts;
  }, [districts, selectedRegion, regions, user]);

  // Server-side pagination state - no client-side filtering needed
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [currentPageData, setCurrentPageData] = useState<NetworkInspection[]>([]);
  const [isDataFromCache, setIsDataFromCache] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'retrying' | 'error'>('connected');

  // Generate cache key for current page and filters
  const getCacheKey = (page: number) => {
    const filterParams = {
      page,
      date: selectedDate?.toISOString().split('T')[0] || null,
      month: selectedMonth?.toISOString().split('T')[0].substring(0, 7) || null,
      region: selectedRegion,
      district: selectedDistrict,
      feeder: selectedFeeder,
      userRole: user?.role,
      userDistrict: user?.district,
      userRegion: user?.region
    };
    return `overheadLineInspections_page_${JSON.stringify(filterParams)}`;
  };

  // Load data for specific page from server with caching and retry logic
  const loadPageData = useCallback(async (page: number, retryCount = 0) => {
    console.log('[OverheadLineInspectionPage] loadPageData called with page:', page, 'retryCount:', retryCount);
    setIsLoadingPage(true);
    const cacheKey = getCacheKey(page);
    let cached: any = null;
    
    try {
      console.log('[OverheadLineInspectionPage] Starting loadPageData execution...');
      // Check cache first
      cached = await cache.get(cacheKey) as any;
      if (cached && cached.data && cached.timestamp) {
        const cacheAge = Date.now() - cached.timestamp;
        const maxAge = 5 * 60 * 1000; // 5 minutes
        
        if (cacheAge < maxAge) {
          console.log(`[OverheadLineInspectionPage] Using cached data for page ${page}, age: ${cacheAge}ms`);
          setCurrentPageData(cached.data.records || cached.data);
          setTotalRecords(cached.data.total || cached.data.length);
          setIsLoadingPage(false);
          setIsDataFromCache(true);
          return;
        }
      }

      const params = new URLSearchParams();
    
      // Apply role-based filtering
      if (user && user.role !== "system_admin" && user.role !== "global_engineer") {
        if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
          params.append('district', user.district || '');
        } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
          params.append('region', user.region || '');
        }
      }
      
      // Apply filters
      if (selectedDate) {
          params.append('date', selectedDate.toISOString().split('T')[0]);
      }
      if (selectedMonth) {
          params.append('month', selectedMonth.toISOString().split('T')[0].substring(0, 7));
        }
        if (selectedRegion) {
          const regionName = regions.find(r => r.id === selectedRegion)?.name;
          if (regionName) params.append('region', regionName);
        }
        if (selectedDistrict) {
          const districtName = districts.find(d => d.id === selectedDistrict)?.name;
          if (districtName) params.append('district', districtName);
        }
        if (selectedFeeder) {
          params.append('feeder', selectedFeeder);
        }
        
        // Server-side pagination parameters
        const offset = (page - 1) * pageSize;
        params.append('limit', pageSize.toString());
        params.append('offset', offset.toString());
        params.append('sort', 'date');
        params.append('order', 'desc');
        params.append('countOnly', 'false');
        
        const url = `/api/overheadLineInspections?${params.toString()}`;
        console.log('[OverheadLineInspectionPage] Loading page', page, 'with URL:', url);
        
        console.log('[OverheadLineInspectionPage] About to make API request...');
        const response = await apiRequest(url);
        console.log('[OverheadLineInspectionPage] API Response received:', response);
        console.log('[OverheadLineInspectionPage] Response type:', typeof response);
        console.log('[OverheadLineInspectionPage] Response keys:', response ? Object.keys(response) : 'null/undefined');
        
        // Update current page data with improved response structure
        const pageData = response?.data || response || [];
        const total = response?.total || (Array.isArray(response) ? response.length : 0);
        
        console.log('[OverheadLineInspectionPage] Processed pageData:', pageData);
        console.log('[OverheadLineInspectionPage] Processed total:', total);
        
        // Check if current page is valid based on total records
        const totalPages = Math.ceil(total / pageSize);
        if (page > totalPages && totalPages > 0) {
          console.log(`[OverheadLineInspectionPage] Page ${page} exceeds total pages ${totalPages}, resetting to page 1`);
          setCurrentPage(1);
          return; // Don't update data, let the page reset trigger a new load
        }
        
        console.log('[OverheadLineInspectionPage] Setting state with:', {
          pageDataLength: pageData.length,
          total,
          pageDataSample: pageData.slice(0, 2),
          firstRecordKeys: pageData.length > 0 ? Object.keys(pageData[0]) : [],
          firstRecordChecklistFields: pageData.length > 0 ? {
            hasPoleCondition: !!pageData[0].poleCondition,
            hasStayCondition: !!pageData[0].stayCondition,
            hasCrossArmCondition: !!pageData[0].crossArmCondition,
            hasInsulatorCondition: !!pageData[0].insulatorCondition,
            hasConductorCondition: !!pageData[0].conductorCondition,
            hasLightningArresterCondition: !!pageData[0].lightningArresterCondition,
            hasDropOutFuseCondition: !!pageData[0].dropOutFuseCondition,
            hasTransformerCondition: !!pageData[0].transformerCondition,
            hasRecloserCondition: !!pageData[0].recloserCondition,
            hasVegetationConflicts: !!pageData[0].vegetationConflicts
          } : {}
        });
        
        // Test state setters
        console.log('[OverheadLineInspectionPage] Before setCurrentPageData');
        setCurrentPageData(pageData);
        console.log('[OverheadLineInspectionPage] After setCurrentPageData');
        
        console.log('[OverheadLineInspectionPage] Before setTotalRecords');
        setTotalRecords(total);
        console.log('[OverheadLineInspectionPage] After setTotalRecords');
        
        setIsDataFromCache(false);
        setConnectionStatus('connected');
        
        console.log('[OverheadLineInspectionPage] State set successfully');
        
        // Cache the page data
        const cacheData = {
          records: pageData,
          total: total,
          timestamp: Date.now()
        };
        
        await cache.set(cacheKey, cacheData, { maxAge: 5 * 60 * 1000 }); // 5 minutes cache
        console.log(`[OverheadLineInspectionPage] Cached page ${page} data`);
        
        console.log('[OverheadLineInspectionPage] Loaded page', page, 'with', pageData.length, 'records. Total:', total);
        console.log('[OverheadLineInspectionPage] Pagination info:', {
          page: response.page,
          pageSize: response.pageSize,
          totalPages: response.totalPages,
          hasNextPage: response.hasNextPage,
          hasPreviousPage: response.hasPreviousPage
        });
      } catch (error) {
        console.error('Error loading page data:', error);
        
        // Retry logic for intermittent 500 errors
        if (retryCount < 3 && (error.message?.includes('500') || error.message?.includes('Internal Server Error'))) {
          const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`[OverheadLineInspectionPage] Retrying page ${page} in ${retryDelay}ms (attempt ${retryCount + 1}/3)`);
          
          setConnectionStatus('retrying');
          setTimeout(() => {
            loadPageData(page, retryCount + 1);
          }, retryDelay);
          return;
        }
        
        // If we have cached data, show it as fallback
        if (cached && cached.data) {
          console.log('[OverheadLineInspectionPage] Using cached data as fallback due to server error');
          setCurrentPageData(cached.data.records || cached.data);
          setTotalRecords(cached.data.total || cached.data.length);
          setIsDataFromCache(true);
          setConnectionStatus('error');
          toast.error('Server temporarily unavailable. Showing cached data.');
        } else {
          setConnectionStatus('error');
          toast.error('Failed to load page data. Please try again.');
        }
      } finally {
        setIsLoadingPage(false);
      }
    }, [user, selectedDate, selectedMonth, selectedRegion, selectedDistrict, selectedFeeder, regions, districts]);

    // Clear cache when filters change
    const clearPageCache = async () => {
      try {
        // Clear all overhead line inspection page caches
        const cacheInfo = await cache.getInfo();
        const pageCacheKeys = cacheInfo
          .filter(info => info.key.startsWith('overheadLineInspections_page_'))
          .map(info => info.key);
        
        for (const key of pageCacheKeys) {
          await cache.delete(key);
        }
        console.log('[OverheadLineInspectionPage] Cleared page cache, removed', pageCacheKeys.length, 'entries');
      } catch (error) {
        console.error('[OverheadLineInspectionPage] Error clearing cache:', error);
      }
    };

    // Load initial data and when page/filters change
    useEffect(() => {
      console.log('[OverheadLineInspectionPage] useEffect triggered with:', {
        user: !!user,
        currentPage,
        selectedDate,
        selectedMonth,
        selectedRegion,
        selectedDistrict,
        selectedFeeder
      });
      if (user) {
        console.log('[OverheadLineInspectionPage] Calling loadPageData...');
        loadPageData(currentPage);
      }
    }, [user, currentPage, selectedDate, selectedMonth, selectedRegion, selectedDistrict, selectedFeeder, loadPageData]);

    // Merge offline and online data for display
  const mergedInspections = useMemo(() => {
    // Convert offline inspections to NetworkInspection format
    const offlineInspectionsFormatted = offlineInspections.map(offlineItem => ({
      ...offlineItem.data,
      id: offlineItem.offlineId,
      isOffline: true,
      offlineId: offlineItem.offlineId,
      syncStatus: offlineItem.syncStatus,
      createdAt: offlineItem.createdAt,
      updatedAt: offlineItem.updatedAt
    }));

    // Combine offline and online data
    const allInspections = [...offlineInspectionsFormatted, ...currentPageData];
    
    // Sort by inspection date (newest first), fallback to creation date
    return allInspections.sort((a, b) => {
      // Try to use inspection date first, then fallback to createdAt
      const dateA = a.date ? new Date(a.date) : new Date(a.createdAt || a.updatedAt || 0);
      const dateB = b.date ? new Date(b.date) : new Date(b.createdAt || b.updatedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [offlineInspections, currentPageData]);

  // Calculate total records including offline items
  const totalRecordsWithOffline = totalRecords + offlineInspections.length;

  const paginatedInspections = mergedInspections;
  
  // Calculate total pages after we have the total records
  const totalPages = Math.ceil(totalRecordsWithOffline / pageSize);

    // Monitor state changes
    useEffect(() => {
      console.log('[OverheadLineInspectionPage] State changed:', {
        currentPageDataLength: currentPageData.length,
        totalRecords,
        isLoadingPage
      });
    }, [currentPageData, totalRecords, isLoadingPage]);

    // Reset to first page when filters change
    useEffect(() => {
      setCurrentPage(1);
      clearPageCache(); // Clear cache when filters change
    }, [selectedDate, selectedMonth, selectedRegion, selectedDistrict, selectedFeeder]);

    // Reset all filters
    const handleResetFilters = () => {
      setSelectedDate(null);
      setSelectedMonth(null);
      setSelectedRegion(null);
      setSelectedDistrict(null);
      setSelectedFeeder(null);
      setCurrentPage(1); // Reset to first page
      clearPageCache(); // Clear cache when filters are reset
    };

  const handleAddInspection = () => {
    setEditingInspection(null);
    setIsInspectionFormOpen(true);
  };

  const handleInspectionFormClose = () => {
    setIsInspectionFormOpen(false);
    setEditingInspection(null);
  };

  const handleViewInspection = (inspection: NetworkInspection) => {
    console.log('[OverheadLineInspectionPage] handleViewInspection called with:', {
      id: inspection.id,
      hasPoleCondition: !!inspection.poleCondition,
      hasStayCondition: !!inspection.stayCondition,
      hasCrossArmCondition: !!inspection.crossArmCondition,
      hasInsulatorCondition: !!inspection.insulatorCondition,
      hasConductorCondition: !!inspection.conductorCondition,
      hasLightningArresterCondition: !!inspection.lightningArresterCondition,
      hasDropOutFuseCondition: !!inspection.dropOutFuseCondition,
      hasTransformerCondition: !!inspection.transformerCondition,
      hasRecloserCondition: !!inspection.recloserCondition,
      hasVegetationConflicts: !!inspection.vegetationConflicts,
      allKeys: Object.keys(inspection)
    });
    
    // For offline inspections, show a note about offline status
    if (inspection.isOffline) {
      toast.info("Viewing offline inspection. This data is stored locally and will sync when online.");
    }
    setSelectedInspection(inspection);
    setIsDetailsDialogOpen(true);
  };

  const handleEditInspection = (inspection: NetworkInspection) => {
    console.log('[OverheadLineInspectionPage] handleEditInspection called with:', {
      id: inspection.id,
      hasPoleCondition: !!inspection.poleCondition,
      hasStayCondition: !!inspection.stayCondition,
      hasCrossArmCondition: !!inspection.crossArmCondition,
      hasInsulatorCondition: !!inspection.insulatorCondition,
      hasConductorCondition: !!inspection.conductorCondition,
      hasLightningArresterCondition: !!inspection.lightningArresterCondition,
      hasDropOutFuseCondition: !!inspection.dropOutFuseCondition,
      hasTransformerCondition: !!inspection.transformerCondition,
      hasRecloserCondition: !!inspection.recloserCondition,
      hasVegetationConflicts: !!inspection.vegetationConflicts,
      allKeys: Object.keys(inspection)
    });
    
    // For offline inspections, we need to handle them differently
    if (inspection.isOffline) {
      toast.info("Editing offline inspection. Changes will be saved locally and synced when online.");
    }
    setEditingInspection(inspection);
    setIsInspectionFormOpen(true);
  };

  const handleDeleteInspection = (inspection: NetworkInspection) => {
    if (!inspection?.id) {
      toast.error("Invalid inspection ID");
      return;
    }

    // Open confirmation dialog
    const inspectionName = inspection.feederName || inspection.id;
    openDeleteDialog(inspection.id, inspectionName, 'overhead line inspection', inspection);
  };

  const performDeleteInspection = async (id: string, data: any) => {
    const inspection = data as NetworkInspection;

    // Handle offline inspection deletion
    if (inspection.isOffline) {
      try {
        // Remove from offline storage
        const { offlineStorageCompat } = await import('@/utils/offlineStorage');
        await offlineStorageCompat.deleteInspection(inspection.offlineId!);
        
        // Update local state
        setOfflineInspections(prev => prev.filter(item => item.offlineId !== inspection.offlineId));
        
        toast.success("Offline inspection deleted successfully");
        return;
      } catch (error) {
        console.error("Error deleting offline inspection:", error);
        toast.error("Failed to delete offline inspection");
        return;
      }
    }

    // Handle online inspection deletion
    try {
      // Log the delete action before deleting
      await LoggingService.getInstance().logDeleteAction(
        user?.id || 'unknown',
        user?.name || 'unknown',
        user?.role || 'unknown',
        'overhead_line_inspection',
        inspection.id,
        inspection, // deleted data
        `Deleted overhead line inspection: ${inspection.feederName || inspection.id}`,
        inspection.region,
        inspection.district
      );

      await deleteNetworkInspection(inspection.id);
      toast.success("Inspection deleted successfully");
      
      // Clear page cache after deleting inspection
      await clearPageCache();
      
      // Reload current page to show updated data
      await loadPageData(currentPage);
    } catch (error) {
      toast.error("Failed to delete inspection");
    }
  };

  const handleFormSubmit = async (inspection: NetworkInspection) => {
    try {
      // Check if we're offline
      if (isOffline) {
        if (editingInspection && editingInspection.isOffline) {
          // Update existing offline inspection
          try {
                    const { offlineStorageCompat } = await import('@/utils/offlineStorage');
        await offlineStorageCompat.saveInspectionOffline(inspection);
            
            // Update local state
            setOfflineInspections(prev => prev.map(item => 
              item.offlineId === editingInspection.offlineId 
                ? { ...item, data: inspection, updatedAt: Date.now() }
                : item
            ));
            
            toast.success("Offline inspection updated successfully!");
          } catch (error) {
            console.error('Failed to update offline inspection:', error);
            toast.error("Failed to update offline inspection");
            return;
          }
        } else {
          // Save new inspection offline
          const offlineId = await saveInspectionOffline(inspection);
          
          // Update local state to show the offline inspection
          setOfflineInspections(prev => [...prev, {
            offlineId,
            data: inspection,
            syncStatus: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncAttempts: 0
          }]);
          
          toast.success("Inspection saved offline successfully! It will sync when you're back online.");
        }
        
        setIsInspectionFormOpen(false);
        setEditingInspection(null);
        return;
      }

      // Online flow - proceed with normal API calls
      if (editingInspection) {
        // Log the edit action before updating
        await LoggingService.getInstance().logEditAction(
          user?.id || 'unknown',
          user?.name || 'unknown',
          user?.role || 'unknown',
          'overhead_line_inspection',
          editingInspection.id,
          editingInspection, // old values
          inspection, // new values
          `Updated overhead line inspection: ${inspection.feederName || inspection.id}`,
          inspection.region,
          inspection.district
        );

        await updateNetworkInspection(editingInspection.id, inspection);
        toast.success("Inspection updated successfully");
      } else {
        // Log the create action
        await LoggingService.getInstance().logAction(
          user?.id || 'unknown',
          user?.name || 'unknown',
          user?.role || 'unknown',
          'create',
          'overhead_line_inspection',
          'unknown', // ID will be assigned by backend
          `Created new overhead line inspection: ${inspection.feederName || 'Unknown feeder'}`,
          inspection.region,
          inspection.district
        );

        await addNetworkInspection(inspection);
        toast.success("Inspection created successfully");
      }
      setIsInspectionFormOpen(false);
      setEditingInspection(null);
      
      // Clear page cache after adding/updating inspection
      await clearPageCache();
      
      // Reload current page to show updated data
      await loadPageData(currentPage);
    } catch (error) {
      console.error('Form submission error:', error);
      
      // If API call fails and we're not offline, try to save offline as fallback
      if (!isOffline && error.message?.includes('Failed to fetch')) {
        try {
          toast.info("Network error detected. Attempting to save offline...");
          const offlineId = await saveInspectionOffline(inspection);
          
          // Update local state
          setOfflineInspections(prev => [...prev, {
            offlineId,
            data: inspection,
            syncStatus: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncAttempts: 0
          }]);
          
          toast.success("Inspection saved offline due to network error! It will sync when connection is restored.");
          setIsInspectionFormOpen(false);
          setEditingInspection(null);
          return;
        } catch (offlineError) {
          console.error('Failed to save offline:', offlineError);
          toast.error("Failed to save inspection both online and offline. Please try again.");
        }
      } else {
        toast.error(editingInspection ? "Failed to update inspection" : "Failed to create inspection");
      }
    }
  };

  console.log('[OverheadLineInspectionPage] Rendering with:', {
    paginatedInspectionsLength: paginatedInspections.length,
    currentPageDataLength: currentPageData.length,
    isLoadingPage,
    totalRecords
  });

  return (
    <AccessControlWrapper type="inspection">
      <Layout>
        <div className="container py-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6 space-y-4 lg:space-y-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Network Inspection</h1>
              <p className="text-muted-foreground mt-1">
                Manage and monitor network inspections
              </p>
              
              {/* Offline Status and Pending Items */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                <OfflineBadge showDetails={false} />
                
                {totalOfflineItems > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      <span className="text-orange-600">
                        {pendingInspections} inspection{pendingInspections !== 1 ? 's' : ''} pending sync
                      </span>
                    </div>
                    {pendingPhotos > 0 && (
                      <span className="text-orange-600">
                        • {pendingPhotos} photo{pendingPhotos !== 1 ? 's' : ''} pending
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Connection Status Messages */}
              {isDataFromCache && (
                <p className="text-sm text-blue-600 mt-2">
                  📋 Showing cached data
                </p>
              )}
              {connectionStatus === 'retrying' && (
                <p className="text-sm text-yellow-600 mt-2">
                  🔄 Retrying connection... Please wait
                </p>
              )}
              {connectionStatus === 'error' && (
                <p className="text-sm text-red-600 mt-2">
                  ⚠️ Connection issues detected. Some data may be from cache.
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0 w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {(user?.role === 'global_engineer' || user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager' || user?.role === 'technician' || user?.role === 'system_admin' || user?.role === 'ashsubt' || user?.role === 'accsubt') && (
                  <Button 
                    onClick={handleAddInspection}
                    className="w-full sm:w-auto min-h-[44px] touch-manipulation"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Inspection
                  </Button>
                )}
                
                {/* Sync Offline Data Button */}
                {totalOfflineItems > 0 && isOnline && (
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      try {
                        await startSync();
                        toast.success("Sync started successfully");
                      } catch (error) {
                        toast.error("Failed to start sync");
                      }
                    }}
                    className="border-orange-500 text-orange-600 hover:bg-orange-50 w-full sm:w-auto min-h-[44px] touch-manipulation"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Offline Data ({totalOfflineItems})
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    await clearPageCache();
                    setConnectionStatus('connected');
                    await loadPageData(currentPage);
                    toast.success("Data refreshed");
                  }}
                  disabled={isLoadingPage}
                  className="w-full sm:w-auto min-h-[44px] touch-manipulation"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingPage ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              
              {/* Retry Connection Button - Full width on mobile */}
              {connectionStatus === 'error' && (
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    setConnectionStatus('connected');
                    await loadPageData(currentPage);
                  }}
                  disabled={isLoadingPage}
                  className="border-red-500 text-red-600 hover:bg-red-50 w-full sm:w-auto min-h-[44px] touch-manipulation"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Connection
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Month</Label>
              <DatePicker
                value={selectedMonth}
                onChange={setSelectedMonth}
                picker="month"
              />
            </div>
            
            {/* Region filter - enabled for system admin, global engineer, ashsubt, and accsubt */}
            <div className="space-y-2">
              <Label>Region</Label>
              <div className="w-full">
                <Select
                  value={selectedRegion}
                  onValueChange={setSelectedRegion}
                  disabled={user?.role !== 'system_admin' && user?.role !== 'global_engineer' && user?.role !== 'ashsubt' && user?.role !== 'accsubt'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRegions.map(region => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* District filter - disabled for district users, enabled for others */}
            <div className="space-y-2">
              <Label>District/Section</Label>
              <div className="w-full">
                <Select
                  value={selectedDistrict}
                  onValueChange={setSelectedDistrict}
                  disabled={user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician' || (!selectedRegion && user?.role !== 'regional_engineer' && user?.role !== 'project_engineer' && user?.role !== 'regional_general_manager' && user?.role !== 'ashsubt' && user?.role !== 'accsubt')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDistricts.map(district => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Reset Filters Button */}
          <div className="flex flex-col sm:flex-row justify-end gap-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 w-full sm:w-auto">
              <div className="space-y-2 w-full sm:w-[200px]">
                <Label>Filter by Feeder Name</Label>
                <Select
                  value={selectedFeeder || "all-feeders"}
                  onValueChange={(value) => {
                    if (value === "all-feeders") {
                      setSelectedFeeder(null);
                    } else {
                      setSelectedFeeder(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Feeders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-feeders">All Feeders</SelectItem>
                    {Array.from(new Set(currentPageData
                      .map(inspection => inspection.feederName)
                      .filter(Boolean)))
                      .sort()
                      .map(feeder => (
                        <SelectItem key={feeder} value={feeder}>
                          {feeder}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={handleResetFilters}
                disabled={!selectedDate && !selectedMonth && !selectedRegion && !selectedDistrict && !selectedFeeder}
                className="w-full sm:w-auto"
              >
                Reset All Filters
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-1">
              <TabsTrigger value="inspections">Inspection Records</TabsTrigger>
            </TabsList>

            <TabsContent value="inspections" className="space-y-4">
              <OverheadLineInspectionsTable 
                inspections={paginatedInspections}
                allInspections={currentPageData}
                onEdit={handleEditInspection}
                onDelete={handleDeleteInspection}
                onView={handleViewInspection}
                userRole={user?.role}
              />
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="flex-1 text-sm text-muted-foreground">
                    {isLoadingPage ? (
                      "Loading..."
                    ) : (
                      <>
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecordsWithOffline)} of {totalRecordsWithOffline} results
                        {offlineInspections.length > 0 && (
                          <span className="ml-2 text-orange-600">📱 +{offlineInspections.length} offline</span>
                        )}
                        {isDataFromCache && (
                          <span className="ml-2 text-blue-600">📋 Cached</span>
                        )}
                        {connectionStatus === 'retrying' && (
                          <span className="ml-2 text-yellow-600">🔄 Retrying</span>
                        )}
                        {connectionStatus === 'error' && (
                          <span className="ml-2 text-red-600">⚠️ Connection Error</span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || isLoadingPage}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || isLoadingPage}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Inspection Form Sheet */}
          <Sheet open={isInspectionFormOpen} onOpenChange={setIsInspectionFormOpen}>
            <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {editingInspection ? "Edit Network Inspection" : "New Network Inspection"}
                </SheetTitle>
                <SheetDescription>
                  {editingInspection ? "Update the inspection details." : "Complete the inspection checklist for the network."}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <OverheadLineInspectionForm
                  inspection={editingInspection}
                  onSubmit={handleFormSubmit}
                  onCancel={handleInspectionFormClose}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Inspection Details Dialog */}
          <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Network Inspection Details</DialogTitle>
                <DialogDescription>
                  Inspection performed on {selectedInspection 
                    ? (selectedInspection.date 
                       ? selectedInspection.date
                       : selectedInspection.createdAt && !isNaN(new Date(selectedInspection.createdAt).getTime())
                         ? new Date(selectedInspection.createdAt).toLocaleDateString()
                         : "today")
                    : ""}
                </DialogDescription>
              </DialogHeader>
              {selectedInspection && (
                <OverheadLineInspectionDetailsView
                  inspection={selectedInspection}
                  showHeader={false}
                  showBackButton={false}
                  onEdit={() => navigate(`/asset-management/overhead-line/edit/${selectedInspection.id}`)}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <DeleteConfirmationDialog
            isOpen={isOpen}
            onClose={closeDeleteDialog}
            onConfirm={() => confirmDelete(performDeleteInspection)}
            title="Delete Overhead Line Inspection"
            itemName={deleteItem?.name}
            itemType="overhead line inspection"
            isLoading={isDeleting}
            warningMessage="This action cannot be undone. This will permanently delete the inspection record and remove all associated data from the system."
          />
        </div>
      </Layout>
    </AccessControlWrapper>
  );
} 