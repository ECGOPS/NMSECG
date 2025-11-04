import { useState, useMemo, useEffect, useCallback } from "react";
import { useData } from "@/contexts/DataContext";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { apiRequest } from "@/lib/api";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VITAssetsTable } from "@/components/vit/VITAssetsTable";
import { VITAssetForm } from "@/components/vit/VITAssetForm";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VITAsset, VITStatus, VoltageLevel, VITInspectionChecklist } from "@/lib/types";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { VITOfflineService } from '@/services/VITOfflineService';
import { Card } from "@/components/ui/card";
import { Info, Database, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VITMapView } from '@/components/vit/VITMapView';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { Loader2 } from "lucide-react";

export default function VITInspectionPage() {
  let dataContext;
  try {
    dataContext = useData();
  } catch (error) {
    console.error('DataContext not ready yet:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  const { vitAssets, regions, districts } = dataContext;
  const { user } = useAzureADAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("assets");
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<VITAsset | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState(false);
  
  // Local state for VIT inspections with pagination
  const [vitInspections, setVitInspections] = useState<VITInspectionChecklist[]>([]);
  const [totalInspections, setTotalInspections] = useState(0);
  const [currentInspectionPage, setCurrentInspectionPage] = useState(1);
  const [inspectionPageSize, setInspectionPageSize] = useState(50);
  const [isLoadingInspections, setIsLoadingInspections] = useState(false);
  
  // Load VIT inspections from API with pagination
  const loadVITInspections = async (page = 1, pageSize = 50) => {
    if (isLoadingInspections) return;
    
    setIsLoadingInspections(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', pageSize.toString());
      params.append('offset', ((page - 1) * pageSize).toString());
      params.append('sort', 'createdAt');
      params.append('order', 'desc');
      
      // Get total count first
      const countParams = new URLSearchParams(params);
      countParams.append('countOnly', 'true');
      const countRes = await apiRequest(`/api/vitInspections?${countParams.toString()}`);
      setTotalInspections(countRes.total || 0);
      
      // Fetch paginated data
      const res = await apiRequest(`/api/vitInspections?${params.toString()}`);
      const inspectionsData = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : []);
      
      if (page === 1) {
        // First page - replace all inspections
        setVitInspections(inspectionsData);
      } else {
        // Subsequent pages - append to existing inspections
        setVitInspections(prev => [...prev, ...inspectionsData]);
      }
      
      setCurrentInspectionPage(page);
      
      console.log('[VITInspectionPage] Loaded VIT inspections:', {
        page,
        pageSize,
        loadedCount: inspectionsData.length,
        totalInspections: countRes.total || 0,
        currentTotal: vitInspections.length + inspectionsData.length
      });
      
    } catch (error) {
      console.error('Error loading VIT inspections:', error);
    } finally {
      setIsLoadingInspections(false);
    }
  };
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [offlineAssets, setOfflineAssets] = useState<VITAsset[]>([]);
  const [inspectionSearchTerm, setInspectionSearchTerm] = useState("");
  const [inspectionSelectedRegion, setInspectionSelectedRegion] = useState<string>("all");
  const [inspectionSelectedDistrict, setInspectionSelectedDistrict] = useState<string>("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [tableUpdateTrigger, setTableUpdateTrigger] = useState(0);
  
  // Load VIT inspections on component mount
  useEffect(() => {
    loadVITInspections(1, inspectionPageSize);
  }, []);
  
  // Pagination state for VIT assets
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalAssets, setTotalAssets] = useState(0);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [hasMoreAssets, setHasMoreAssets] = useState(true);
  
  const vitOfflineService = VITOfflineService.getInstance();
  
  // Helper function to check if an inspection is offline
  const isOfflineInspection = (inspectionId: string): boolean => {
    return inspectionId.startsWith('inspection_');
  };
  
  // Initialize database and load offline data
  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        const pendingAssets = await vitOfflineService.getPendingAssets();
        setOfflineAssets(pendingAssets.map(item => ({ ...item.asset, id: item.key })));
      } catch (error) {
        console.error('Error loading offline assets:', error);
      }
    };

    loadOfflineData();
  }, []);

  // Network status listener
  useEffect(() => {
    const handleOnline = () => {
      console.log('Device came online');
      setIsOnline(true);
      // Refresh offline data when coming back online
      loadOfflineData();
    };

    const handleOffline = () => {
      console.log('Device went offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for offline asset and inspection events
  useEffect(() => {
    const handleAssetAdded = (event: CustomEvent) => {
      if (event.detail.type === 'vit') {
        console.log('VIT asset added:', event.detail.asset);
        
        if (event.detail.status === 'offline') {
          // Asset saved offline - add to offline assets only
          const newAsset = { ...event.detail.asset, id: event.detail.asset.id };
          console.log('Adding offline asset to offline state:', newAsset);
          
          setOfflineAssets(prev => {
            const updated = [...prev, newAsset];
            console.log('Updated offline assets:', updated);
            return updated;
          });
          
          // Don't add to main vitAssets - let dedupe handle it
          // Force table update to trigger re-render
          setTableUpdateTrigger(prev => prev + 1);
        } else if (event.detail.status === 'success') {
          // Asset saved online - refresh data to get the latest from server
          console.log('Asset saved online, refreshing data');
          loadVITAssets(1, pageSize);
          
          // Force table update
          setTableUpdateTrigger(prev => prev + 1);
        }
      }
    };

    const handleInspectionAdded = (event: CustomEvent) => {
      if (event.detail.type === 'vit') {
        console.log('VIT inspection added:', event.detail.inspection);
        
        if (event.detail.status === 'offline') {
          // Inspection saved offline - could refresh inspections list here if needed
          // For now, just log it since we're focusing on assets table
          console.log('Inspection saved offline');
          
          // Force table update for inspections tab
          setTableUpdateTrigger(prev => prev + 1);
        } else if (event.detail.status === 'success') {
          // Inspection saved online - refresh data to get the latest from server
          console.log('Inspection saved online, refreshing data');
          loadVITAssets(1, pageSize);
          
          // Force table update
          setTableUpdateTrigger(prev => prev + 1);
        }
      }
    };

    const handleVITOfflineDataUpdated = (event: CustomEvent) => {
      console.log('VIT offline data updated:', event.detail);
      const updatedOfflineAssets = event.detail.assets;
      console.log('Setting offline assets:', updatedOfflineAssets);
      setOfflineAssets(updatedOfflineAssets);
      
      // Force table update to trigger re-render with new offline data
      setTableUpdateTrigger(prev => prev + 1);
    };

    // Listen for asset synced events (when offline data gets synced to server)
    const handleAssetSynced = (event: CustomEvent) => {
      if (event.detail.type === 'vit') {
        console.log('VIT asset synced:', event.detail.asset);
        // Refresh data to get the latest from server
        loadVITAssets(1, pageSize);
        
        // Force table update
        setTableUpdateTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('assetAdded', handleAssetAdded as EventListener);
    window.addEventListener('inspectionAdded', handleInspectionAdded as EventListener);
    window.addEventListener('vitOfflineDataUpdated', handleVITOfflineDataUpdated as EventListener);
    window.addEventListener('assetSynced', handleAssetSynced as EventListener);

    return () => {
      window.removeEventListener('assetAdded', handleAssetAdded as EventListener);
      window.removeEventListener('inspectionAdded', handleInspectionAdded as EventListener);
      window.removeEventListener('vitOfflineDataUpdated', handleVITOfflineDataUpdated as EventListener);
      window.removeEventListener('assetSynced', handleAssetSynced as EventListener);
    };
  }, [dataContext.vitAssets, dataContext.setVitAssets, pageSize]);

  // Reload offline data function
  const loadOfflineData = async () => {
    try {
      const pendingAssets = await vitOfflineService.getPendingAssets();
      setOfflineAssets(pendingAssets.map(item => ({ ...item.asset, id: item.key })));
    } catch (error) {
      console.error('Error loading offline assets:', error);
    }
  };

  // Load VIT assets with pagination
  const loadVITAssets = async (page = 1, size = pageSize) => {
    if (isLoadingAssets) return;
    
    // Check if user is authenticated
    if (!user || !user.id) {
      console.log('[VITInspectionPage] User not authenticated, skipping VIT assets load');
      return;
    }
    
    setIsLoadingAssets(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', size.toString());
      params.append('offset', ((page - 1) * size).toString());
      params.append('sort', 'createdAt');
      params.append('order', 'desc');
      
      // Get total count first using apiRequest for proper authentication
      const countParams = new URLSearchParams(params);
      countParams.append('countOnly', 'true');
      const countUrl = `/api/vitAssets?${countParams.toString()}`;
      console.log('[VITInspectionPage] Getting count from:', countUrl);
      
      const countData = await dataContext.apiRequest(countUrl);
      console.log('[VITInspectionPage] Count response:', countData);
      setTotalAssets(countData.count || countData.total || 0);
      
      // Fetch paginated data using apiRequest for proper authentication
      const dataUrl = `/api/vitAssets?${params.toString()}`;
      console.log('[VITInspectionPage] Loading data from:', dataUrl);
      
      const data = await dataContext.apiRequest(dataUrl);
      console.log('[VITInspectionPage] Data response:', data);
      
      if (page === 1) {
        // First page - replace all assets
        dataContext.setVitAssets(data);
      } else {
        // Subsequent pages - append to existing assets
        dataContext.setVitAssets(prev => [...prev, ...data]);
      }
      
      setHasMoreAssets(data.length === size);
      setCurrentPage(page);
      
      console.log('[VITInspectionPage] Successfully loaded VIT assets:', {
        page,
        size,
        loadedCount: data.length,
        totalAssets: dataContext.vitAssets.length,
        hasMore: data.length === size
      });
      
    } catch (error) {
      console.error('Error loading VIT assets:', error);
      
      // Check if it's an authentication error
      if (error.message && error.message.includes('<!DOCTYPE')) {
        toast.error('Authentication required. Please log in again.');
        // Redirect to login or refresh auth
        window.location.reload();
      } else if (error.status === 401 || error.status === 403) {
        toast.error('Access denied. Please check your permissions.');
      } else {
        toast.error('Failed to load VIT assets. Please try again.');
      }
    } finally {
      setIsLoadingAssets(false);
    }
  };

  // Load more assets
  const loadMoreAssets = () => {
    if (!isLoadingAssets && hasMoreAssets) {
      loadVITAssets(currentPage + 1, pageSize);
    }
  };

  // Refresh assets
  const refreshAssets = () => {
    setCurrentPage(1);
    setHasMoreAssets(true);
    loadVITAssets(1, pageSize);
  };

  // Load initial VIT assets
  useEffect(() => {
    if (user && !isLoadingAssets && user.id) {
      console.log('[VITInspectionPage] User authenticated, loading VIT assets...');
      loadVITAssets(1, pageSize);
    } else if (!user) {
      console.log('[VITInspectionPage] No user, skipping VIT assets load');
    }
  }, [user, user?.id]);

  // Add effect to handle online/offline status changes from offline context
  useEffect(() => {
    if (isOnline && offlineAssets.length > 0) {
      // Auto-sync when coming back online with pending items
      handleManualSync();
    }
  }, [isOnline, offlineAssets.length]);

  // Handle force sync events from table
  useEffect(() => {
    const handleForceSync = async (event: CustomEvent) => {
      const { offlineId } = event.detail;
      if (offlineId && isOnline) {
        try {
          await handleManualSync();
          toast.success('Force sync completed successfully');
        } catch (error) {
          console.error('Force sync failed:', error);
          toast.error('Force sync failed. Please try again.');
        }
      }
    };

    window.addEventListener('forceSync', handleForceSync as EventListener);
    return () => {
      window.removeEventListener('forceSync', handleForceSync as EventListener);
    };
  }, [isOnline]);

  // Add effect to handle asset added events
  useEffect(() => {
    const handleAssetAdded = (event: CustomEvent) => {
      if (event.detail.type === 'vit') {
        // Add the new asset to offline assets immediately
        setOfflineAssets(prev => [...prev, event.detail.asset]);
      }
    };

    window.addEventListener('assetAdded', handleAssetAdded as EventListener);
    return () => {
      window.removeEventListener('assetAdded', handleAssetAdded as EventListener);
    };
  }, []);

  // Add effect to handle online/offline status changes
  useEffect(() => {
    const handleOnlineStatusChange = async () => {
      const isOnlineNow = navigator.onLine;
      setIsOnline(isOnlineNow);
      
      if (isOnlineNow) {
        try {
          // Trigger sync when coming back online
          await vitOfflineService.syncPendingData();
          setForceUpdate(prev => !prev);
          setPendingSync(false);
        } catch (error) {
          console.error('Error syncing data:', error);
          setPendingSync(true);
        }
      }
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  // Handle manual sync
  const handleSync = async () => {
    try {
      await vitOfflineService.syncPendingData();
      setForceUpdate(prev => !prev);
      setPendingSync(false);
    } catch (error) {
      console.error('Error syncing data:', error);
      toast.error('Failed to synchronize data');
    }
  };

  const handleManualSync = async () => {
    setPendingSync(true);
    try {
      await vitOfflineService.syncPendingData();
      setForceUpdate(prev => !prev);
      toast.success('Offline data synchronized successfully');
    } catch (error) {
      console.error('Error syncing offline data:', error);
      toast.error('Failed to synchronize offline data');
    } finally {
      setPendingSync(false);
    }
  };

  // Dedupe function that merges assets by stable keys
  const dedupeAssets = useCallback((onlineAssets: VITAsset[], offlineAssets: VITAsset[]) => {
    const assetMap = new Map<string, VITAsset>();
    
    console.log('[VITInspectionPage] Dedupe - Starting with:', {
      onlineCount: onlineAssets.length,
      offlineCount: offlineAssets.length
    });
    
    // First, add all online assets using their stable id
    onlineAssets.forEach(asset => {
      const key = asset.id;
      assetMap.set(key, asset);
      console.log('[VITInspectionPage] Dedupe - Added online asset:', { key, serialNumber: asset.serialNumber });
    });
    
    // Then, add offline assets using their offlineId, but only if not already present
    offlineAssets.forEach(offlineAsset => {
      const offlineKey = offlineAsset.id; // This is the offlineId from VITOfflineService
      
      // If we don't have this asset yet, add it
      if (!assetMap.has(offlineKey)) {
        assetMap.set(offlineKey, offlineAsset);
        console.log('[VITInspectionPage] Dedupe - Added offline asset:', { key: offlineKey, serialNumber: offlineAsset.serialNumber });
      } else {
        console.log('[VITInspectionPage] Dedupe - Skipped duplicate offline asset:', { key: offlineKey, serialNumber: offlineAsset.serialNumber });
      }
    });
    
    const result = Array.from(assetMap.values());
    console.log('[VITInspectionPage] Dedupe - Final result:', {
      inputOnline: onlineAssets.length,
      inputOffline: offlineAssets.length,
      outputTotal: result.length,
      uniqueKeys: Array.from(assetMap.keys())
    });
    
    return result;
  }, []);

  // Combine online and offline assets with proper deduplication
  const allAssets = useMemo(() => {
    const onlineAssets = vitAssets || [];
    
    console.log('[VITInspectionPage] Debug - User info:', {
      user: user ? {
        id: user.id,
        role: user.role,
        region: user.region,
        district: user.district
      } : null
    });
    
    console.log('[VITInspectionPage] Debug - VIT Assets:', {
      totalAssets: onlineAssets.length,
      assets: onlineAssets.slice(0, 3).map(a => ({
        id: a.id,
        serialNumber: a.serialNumber,
        region: a.region,
        district: a.district
      }))
    });
    
    console.log('[VITInspectionPage] Debug - Offline Assets:', {
      totalOffline: offlineAssets.length,
      assets: offlineAssets.slice(0, 3).map(a => ({
        id: a.id,
        serialNumber: a.serialNumber,
        region: a.region,
        district: a.district
      }))
    });
    
    // Use dedupe function to merge assets
    const dedupedAssets = dedupeAssets(onlineAssets, offlineAssets);
    
    console.log('[VITInspectionPage] Debug - Combined Assets:', {
      onlineCount: onlineAssets.length,
      offlineCount: offlineAssets.length,
      dedupedCount: dedupedAssets.length,
      tableUpdateTrigger
    });

    return dedupedAssets;
  }, [vitAssets, offlineAssets, tableUpdateTrigger, dedupeAssets]);

  // Filter assets based on user role
  const filteredAssets = useMemo(() => {
    if (!user) return [];
    
    console.log('[VITInspectionPage] Debug - Filtering assets for user:', {
      role: user.role,
      region: user.region,
      district: user.district,
      totalAssets: vitAssets.length
    });
    
    // Use a Map to ensure unique assets by ID
    const uniqueAssets = new Map<string, VITAsset>();
    
    if (user.role === "system_admin" || user.role === "global_engineer") {
      vitAssets.forEach(asset => {
        if (!uniqueAssets.has(asset.id)) {
          uniqueAssets.set(asset.id, asset);
        }
      });
      console.log('[VITInspectionPage] Debug - System admin/global engineer: showing all assets');
    } else if (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") {
      if (user.region) {
        const filteredByRegion = vitAssets.filter(asset => asset.region === user.region);
        console.log('[VITInspectionPage] Debug - Regional role filtering:', {
          userRegion: user.region,
          totalAssets: vitAssets.length,
          filteredCount: filteredByRegion.length,
          sampleAssets: filteredByRegion.slice(0, 3).map(a => ({
            id: a.id,
            serialNumber: a.serialNumber,
            region: a.region,
            district: a.district
          }))
        });
        filteredByRegion.forEach(asset => {
          if (!uniqueAssets.has(asset.id)) {
            uniqueAssets.set(asset.id, asset);
          }
        });
      } else {
        console.log('[VITInspectionPage] Debug - Regional role but no region assigned, showing all assets');
        vitAssets.forEach(asset => {
          if (!uniqueAssets.has(asset.id)) {
            uniqueAssets.set(asset.id, asset);
          }
        });
      }
    } else if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
      if (user.district && user.region) {
        const filteredByDistrict = vitAssets.filter(asset => asset.district === user.district && asset.region === user.region);
        console.log('[VITInspectionPage] Debug - District role filtering:', {
          userRegion: user.region,
          userDistrict: user.district,
          totalAssets: vitAssets.length,
          filteredCount: filteredByDistrict.length,
          sampleAssets: filteredByDistrict.slice(0, 3).map(a => ({
            id: a.id,
            serialNumber: a.serialNumber,
            region: a.region,
            district: a.district
          }))
        });
        filteredByDistrict.forEach(asset => {
          if (!uniqueAssets.has(asset.id)) {
            uniqueAssets.set(asset.id, asset);
          }
        });
      } else {
        console.log('[VITInspectionPage] Debug - District role but no district/region assigned, showing all assets');
        vitAssets.forEach(asset => {
          if (!uniqueAssets.has(asset.id)) {
            uniqueAssets.set(asset.id, asset);
          }
        });
      }
    } else {
      // For any other role, show all assets
      console.log('[VITInspectionPage] Debug - Unknown role, showing all assets');
      vitAssets.forEach(asset => {
        if (!uniqueAssets.has(asset.id)) {
          uniqueAssets.set(asset.id, asset);
        }
      });
    }
    
    const result = Array.from(uniqueAssets.values());
    console.log('[VITInspectionPage] Debug - Final filtered assets count:', result.length);
    return result;
  }, [vitAssets, user]);

  // Apply frontend filters only (role-based filtering is handled by backend)
  const filteredInspections = useMemo(() => {
    if (!Array.isArray(vitInspections)) {
      console.warn('[VITInspectionPage] vitInspections is not an array:', vitInspections);
      return [];
    }
    
    let filtered = [...vitInspections];
    
    // Apply additional filters
    if (inspectionSelectedRegion && inspectionSelectedRegion !== "all") {
      filtered = filtered.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        return asset?.region === inspectionSelectedRegion;
      });
    }
    
    if (inspectionSelectedDistrict && inspectionSelectedDistrict !== "all") {
      filtered = filtered.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        return asset?.district === inspectionSelectedDistrict;
      });
    }
    
    if (inspectionSearchTerm) {
      filtered = filtered.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        if (!asset) return false;
        
        return (
          asset.serialNumber.toLowerCase().includes(inspectionSearchTerm.toLowerCase()) ||
          inspection.inspectedBy.toLowerCase().includes(inspectionSearchTerm.toLowerCase()) ||
          asset.region.toLowerCase().includes(inspectionSearchTerm.toLowerCase()) ||
          asset.district.toLowerCase().includes(inspectionSearchTerm.toLowerCase())
        );
      });
    }
    
    return filtered;
  }, [vitInspections, vitAssets, inspectionSearchTerm, inspectionSelectedRegion, inspectionSelectedDistrict]);

  // Add effect to handle asset added events
  useEffect(() => {
    const handleAssetAdded = (event: CustomEvent) => {
      if (event.detail.type === 'vit') {
        // Add the new asset to offline assets immediately
        setOfflineAssets(prev => [...prev, event.detail.asset]);
      }
    };

    window.addEventListener('assetAdded', handleAssetAdded as EventListener);
    return () => {
      window.removeEventListener('assetAdded', handleAssetAdded as EventListener);
    };
  }, []);

  const handleAddAsset = () => {
    setSelectedAsset(null);
    setIsAssetFormOpen(true);
  };
  
  const handleEditAsset = (asset: VITAsset) => {
    navigate(`/asset-management/edit-vit-asset/${asset.id}`);
  };
  
  const handleAssetFormClose = () => {
    setIsAssetFormOpen(false);
    setSelectedAsset(null);
  };
  
  const handleViewInspections = (assetId: string) => {
    navigate(`/asset-management/vit-inspection-details/${assetId}`);
  };

  const clearInspectionFilters = () => {
    setInspectionSearchTerm("");
    setInspectionSelectedRegion("all");
    setInspectionSelectedDistrict("all");
  };

  const clearAssetFilters = () => {
    setSelectedRegion("all");
    setSelectedDistrict("all");
  };

  return (
    <AccessControlWrapper type="asset">
      <Layout>
        <div className="container py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
                      <h1 className="text-3xl font-bold text-gray-900">Outdoor Switchgear Asset Management</h1>
          <p className="text-gray-600 mt-2">Manage switchgear assets and inspections</p>
            
            {/* Offline Status Indicator */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              
              {offlineAssets.length > 0 && (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1">
                  <Database className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800 font-medium">
                    {offlineAssets.length} offline asset{offlineAssets.length !== 1 ? 's' : ''}
                  </span>
                  {isOnline && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleManualSync}
                      disabled={pendingSync}
                      className="h-6 px-2 text-xs"
                    >
                      {pendingSync ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        'Sync Now'
                      )}
                    </Button>
                  )}
                </div>
              )}
              
              {/* Manual Refresh Button - Hidden */}
              {/* <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTableUpdateTrigger(prev => prev + 1);
                  toast.success('Table refreshed successfully!');
                }}
                className="h-8 px-3 text-xs"
              >
                <Search className="w-3 h-3 mr-1" />
                Refresh Table
              </Button> */}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            {/* Add VIT Asset button hidden */}
            {/* <Button
              onClick={() => setIsAssetFormOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
                                Add Switchgear Asset
            </Button> */}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
                            <TabsTrigger value="assets">Switchgear Assets</TabsTrigger>
            <TabsTrigger value="inspections">Inspection Records</TabsTrigger>
            <TabsTrigger value="map">Map View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="assets" className="space-y-6">
            {/* Data Status Summary */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Online: {vitAssets?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Offline: {offlineAssets.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Total: {allAssets.length}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
            
            <VITAssetsTable 
              assets={allAssets}
              onAddAsset={handleAddAsset} 
              onEditAsset={handleEditAsset}
              selectedRegion={selectedRegion}
              selectedDistrict={selectedDistrict}
              onRegionChange={setSelectedRegion}
              onDistrictChange={setSelectedDistrict}
            />
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {isLoadingAssets ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
                    Loading...
                  </span>
                ) : (
                  `Showing ${allAssets.length} of ${totalAssets} total assets`
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={pageSize.toString()} onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                  loadVITAssets(1, parseInt(value));
                }}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
                
                <span className="text-sm text-muted-foreground">per page</span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshAssets}
                  disabled={isLoadingAssets}
                >
                  {isLoadingAssets ? 'Loading...' : 'Refresh'}
                </Button>
                
                {hasMoreAssets && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreAssets}
                    disabled={isLoadingAssets}
                  >
                    {isLoadingAssets ? 'Loading...' : 'Load More'}
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="inspections">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Inspection Records</h2>
                <Button onClick={() => navigate("/asset-management/vit-inspection-management")}>
                  View All Inspections
                </Button>
              </div>
              
              {/* Inspection Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search inspections..."
                    value={inspectionSearchTerm}
                    onChange={(e) => setInspectionSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Select value={inspectionSelectedRegion} onValueChange={setInspectionSelectedRegion}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {regions?.map((region) => (
                        <SelectItem key={region.id} value={region.name}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={inspectionSelectedDistrict} onValueChange={setInspectionSelectedDistrict}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Districts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts?.map((district) => (
                        <SelectItem key={district.id} value={district.name}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {(inspectionSearchTerm || (inspectionSelectedRegion && inspectionSelectedRegion !== "all") || (inspectionSelectedDistrict && inspectionSelectedDistrict !== "all")) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearInspectionFilters}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Filter Summary */}
              {(inspectionSearchTerm || (inspectionSelectedRegion && inspectionSelectedRegion !== "all") || (inspectionSelectedDistrict && inspectionSelectedDistrict !== "all")) && (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-md">
                  <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
                  {inspectionSearchTerm && (
                    <Badge variant="secondary" className="text-xs">
                      Search: "{inspectionSearchTerm}"
                    </Badge>
                  )}
                  {inspectionSelectedRegion && inspectionSelectedRegion !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Region: {inspectionSelectedRegion}
                    </Badge>
                  )}
                  {inspectionSelectedDistrict && inspectionSelectedDistrict !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      District: {inspectionSelectedDistrict}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearInspectionFilters}
                    className="h-6 px-2 text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              )}
              
              <div className="rounded-md border overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Asset</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Feeder</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Feeder Alias</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Region</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">District</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Inspector</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {!Array.isArray(filteredInspections) || filteredInspections.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">
                          {(inspectionSearchTerm || (inspectionSelectedRegion && inspectionSelectedRegion !== "all") || (inspectionSelectedDistrict && inspectionSelectedDistrict !== "all"))
                            ? "No inspection records found matching your filter criteria. Try adjusting your filters."
                            : "No inspection records found"}
                        </td>
                      </tr>
                    ) : (
                      Array.isArray(filteredInspections) ? filteredInspections.map(inspection => {
                        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
                        if (!asset) return null;
                        
                        const region = regions.find(r => r.name === asset.region)?.name || "Unknown";
                        const district = districts.find(d => d.name === asset.district)?.name || "Unknown";
                        
                        return (
                          <tr key={`inspection-${inspection.id}`} className="hover:bg-muted/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {new Date(inspection.inspectionDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                {asset.serialNumber}
                                {isOfflineInspection(inspection.id) && (
                                  <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                                    Offline
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {inspection.feederName || asset.feederName || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {inspection.feederAlias || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {region}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {district}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {inspection.inspectedBy}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewInspections(asset.id)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">
                            Error: Inspections data is not available
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls for Inspections */}
              {Array.isArray(filteredInspections) && filteredInspections.length > 0 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <span>
                      Showing {vitInspections.length} of {totalInspections} inspections
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadVITInspections(currentInspectionPage + 1, inspectionPageSize)}
                      disabled={isLoadingInspections || vitInspections.length >= totalInspections}
                    >
                      {isLoadingInspections ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="map" className="space-y-6">
            <VITMapView 
              assets={allAssets}
              selectedRegion={selectedRegion}
              selectedDistrict={selectedDistrict}
            />
          </TabsContent>
        </Tabs>

        {/* Asset Form Sheet */}
        <Sheet open={isAssetFormOpen} onOpenChange={(open) => {
          if (!open) {
            handleAssetFormClose();
          }
        }}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
                              <SheetTitle>{selectedAsset ? "Edit Switchgear Asset" : "Add New Switchgear Asset"}</SheetTitle>
                <SheetDescription>
                  {selectedAsset
                    ? "Update the information for this switchgear asset"
                    : "Fill in the details to add a new switchgear asset"}
                </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <VITAssetForm 
                asset={selectedAsset || undefined} 
                onSubmit={() => {
                  handleAssetFormClose();
                  setIsAssetFormOpen(false);
                }}
                onCancel={() => {
                  handleAssetFormClose();
                  setIsAssetFormOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
    </AccessControlWrapper>
  );
}
