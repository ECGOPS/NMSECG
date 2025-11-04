import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Layout } from "@/components/layout/Layout";
import { VITInspectionForm } from "@/components/vit/VITInspectionForm";
import { VITAssetsTable } from "@/components/vit/VITAssetsTable";
import { VITAssetForm } from "@/components/vit/VITAssetForm";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { exportInspectionToPDF } from "@/utils/pdfExport";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PlusCircle, Eye, Pencil, Download, FileText, Trash2, MoreHorizontal, Edit
} from "lucide-react";
import { VITAsset, VITInspectionChecklist } from "@/lib/types";
import { DeleteConfirmationDialog, useDeleteConfirmation } from "@/components/common/DeleteConfirmationDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { apiRequest } from '@/lib/api';
import { debounce } from 'lodash';
import { LoggingService } from '@/services/LoggingService';

// Add type declaration for jsPDF with autotable extensions
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY?: number;
    };
    autoTable: (options: any) => jsPDF;
  }
}

export default function VITInspectionManagementPage() {
  const navigate = useNavigate();
  const { user } = useAzureADAuth();
  const { vitAssets, regions, districts, deleteVITInspection } = useData();
  const { isOpen, deleteItem, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation();
  const [activeTab, setActiveTab] = useState("assets");
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [isInspectionFormOpen, setIsInspectionFormOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<VITAsset | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<VITInspectionChecklist | null>(null);

  // Local state for VIT inspections (following load monitoring pattern)
  const [vitInspections, setVitInspections] = useState<VITInspectionChecklist[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for frequently accessed data
  const [dataCache, setDataCache] = useState<{ [key: string]: any[] }>({});
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${selectedRegion}-${selectedDistrict}-${selectedStatus}-${searchTerm}-${user?.role}-${user?.region}-${user?.district}`;
  }, [selectedRegion, selectedDistrict, selectedStatus, searchTerm, user]);

  // Optimize data loading with pagination and caching
  const loadData = useCallback(async (resetPagination = false) => {
    setIsLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (user?.role === 'global_engineer' || user?.role === 'system_admin') {
        // No filtering for global engineers or system admins
      } else if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
        if (user.region) {
          params.append('region', user.region);
        }
      } else if (user?.role === 'district_engineer' || user?.role === 'technician' || user?.role === 'district_manager') {
        if (user.district && user.region) {
          params.append('district', user.district);
          params.append('region', user.region);
        }
      }
      if (selectedRegion) params.append('region', selectedRegion);
      if (selectedDistrict) params.append('district', selectedDistrict);
      if (searchTerm) params.append('inspectedBy', searchTerm);
      params.append('sort', 'inspectionDate');
      params.append('order', 'desc');
      params.append('limit', pageSize.toString());
      params.append('offset', ((currentPage - 1) * pageSize).toString());

      // Get total count
      const countParams = new URLSearchParams(params);
      countParams.append('countOnly', 'true');
      const countRes = await apiRequest(`/api/vitInspections?${countParams.toString()}`);
      setTotalItems(countRes.count || 0);

      // Fetch data
      const res = await apiRequest(`/api/vitInspections?${params.toString()}`);
      
      // Debug logging for API response
      console.log('[VITInspectionManagementPage] API response:', {
        response: res,
        responseType: typeof res,
        isArray: Array.isArray(res),
        length: res?.length,
        hasData: 'data' in res,
        dataLength: res?.data?.length
      });
      
      // Ensure we always set an array
      const inspectionsData = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : []);
      
      console.log('[VITInspectionManagementPage] Setting vitInspections:', {
        inspectionsData,
        length: inspectionsData.length,
        isArray: Array.isArray(inspectionsData),
        timestamp: new Date().toISOString()
      });
      
       // Set local state directly (following load monitoring pattern)
       setVitInspections(inspectionsData);
       setHasMore(inspectionsData.length === pageSize);
    } catch (error) {
      setError('Failed to load inspections');
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedRegion, selectedDistrict, searchTerm, pageSize, currentPage]);

  // Load data on mount and when filters change
  useEffect(() => {
    loadData(true);
  }, [selectedRegion, selectedDistrict, selectedStatus, searchTerm, loadData]);

  // Listen for inspection added events (both online and offline)
  useEffect(() => {
    const handleInspectionAdded = (event: CustomEvent) => {
      console.log('[VITInspectionManagementPage] Inspection added event received:', event.detail);
      
      if (event.detail.type === 'vit') {
        const newInspection = event.detail.inspection;
        
        // Add the new inspection to local state immediately
        setVitInspections(prev => {
          // Ensure prev is always an array
          const currentInspections = Array.isArray(prev) ? prev : [];
          
          console.log('[VITInspectionManagementPage] Adding inspection to state:', {
            currentInspectionsLength: currentInspections.length,
            newInspection: newInspection,
            timestamp: new Date().toISOString()
          });
          
          // Check if inspection already exists (avoid duplicates)
          const exists = currentInspections.some(inspection => inspection.id === newInspection.id);
          if (exists) {
            console.log('[VITInspectionManagementPage] Inspection already exists, skipping');
            return currentInspections;
          }
          
          // Add new inspection to the beginning of the list
          const updatedInspections = [newInspection, ...currentInspections];
          console.log('[VITInspectionManagementPage] Updated inspections state:', {
            newLength: updatedInspections.length,
            timestamp: new Date().toISOString()
          });
          
          return updatedInspections;
        });
        
        // Show success message
        if (event.detail.status === 'offline') {
          toast.success("Inspection saved offline and added to the table");
        } else {
          toast.success("Inspection added successfully");
        }
        
        // Switch to inspections tab to show the new inspection
        setActiveTab("inspections");
        
        // Add a small delay before reloading data to ensure backend has processed the save
        // Note: The event handler will handle adding the inspection to state immediately
        // This timeout is just a backup to ensure data consistency
        setTimeout(() => {
          loadData(true);
        }, 1000); // Increased delay to avoid conflicts with event handler
      }
    };

    // Add event listener
    window.addEventListener('inspectionAdded', handleInspectionAdded as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('inspectionAdded', handleInspectionAdded as EventListener);
    };
  }, [loadData]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadData();
    }
  }, [isLoading, hasMore, loadData]);

  // Optimize filtered inspections with useMemo and virtual scrolling
  const filteredInspections = useMemo(() => {
    // Debug logging to help identify the issue
    console.log('[VITInspectionManagementPage] filteredInspections useMemo:', {
      vitInspections,
      vitInspectionsType: typeof vitInspections,
      isArray: Array.isArray(vitInspections),
      length: vitInspections?.length
    });
    
    if (!vitInspections || !Array.isArray(vitInspections)) {
      console.warn('[VITInspectionManagementPage] vitInspections is not an array:', vitInspections);
      return [];
    }
    
    let filtered = [...vitInspections]; // Create a copy to avoid mutating original
    
    // Apply role-based filtering
    if (user?.role === 'global_engineer' || user?.role === 'system_admin') {
      // See all - no filtering needed
    } else if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
      if (user.region) {
        filtered = filtered.filter(inspection => inspection.region === user.region);
      } else {
        console.warn("Regional/project engineer missing region assignment", user);
        return []; // Return early if missing required data
      }
    } else if (user?.role === 'district_engineer' || user?.role === 'technician' || user?.role === 'district_manager') {
      if (user.district && user.region) {
        filtered = filtered.filter(inspection => inspection.district === user.district && inspection.region === user.region);
      } else {
        console.warn("District role missing district or region assignment", user);
        return []; // Return early if missing required data
      }
    }
    
    // Apply region filter
    if (selectedRegion && Array.isArray(filtered)) {
      filtered = filtered.filter(inspection => inspection.region === selectedRegion);
    }
    
    // Apply district filter
    if (selectedDistrict && Array.isArray(filtered)) {
      filtered = filtered.filter(inspection => inspection.district === selectedDistrict);
    }
    
    // Apply search term
    if (searchTerm && Array.isArray(filtered)) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(inspection => 
        inspection.inspectedBy?.toLowerCase().includes(lowerCaseSearchTerm) ||
        inspection.remarks?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }
    
    // Ensure we always return an array
    const result = Array.isArray(filtered) ? filtered : [];
    console.log('[VITInspectionManagementPage] filteredInspections result:', {
      resultLength: result.length,
      resultType: typeof result,
      isArray: Array.isArray(result)
    });
    return result;
  }, [vitInspections, user, selectedRegion, selectedDistrict, searchTerm]);

  // Add debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  // Add infinite scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (
      target.scrollHeight - target.scrollTop === target.clientHeight &&
      !isLoading &&
      hasMore
    ) {
      handleLoadMore();
    }
  }, [isLoading, hasMore, handleLoadMore]);

  // Add cleanup for debounced search
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleAddAsset = () => {
    setSelectedAsset(null);
    setIsAssetFormOpen(true);
  };

  const handleEditAsset = (asset: VITAsset) => {
    setSelectedAsset(asset);
    setIsAssetFormOpen(true);
  };

  const handleAddInspection = (assetId: string) => {
    setSelectedAssetId(assetId);
    setSelectedInspection(null);
    setIsInspectionFormOpen(true);
  };

  const handleCloseAssetForm = () => {
    setIsAssetFormOpen(false);
    setSelectedAsset(null);
  };

  const handleCloseInspectionForm = () => {
    setIsInspectionFormOpen(false);
    setSelectedInspection(null);
    setSelectedAssetId("");
  };

  const handleInspectionSubmit = (data: Partial<VITInspectionChecklist>) => {
    // Close the form first
    handleCloseInspectionForm();
    
    // The context functions will handle updating the global state
    // The event handler will also update the local state
    console.log('[VITInspectionManagementPage] Inspection submitted:', data);
  };

  const handleViewDetails = (inspection: VITInspectionChecklist) => {
    setSelectedInspection(inspection);
    setIsDetailsDialogOpen(true);
  };

  const handleEditInspection = (inspection: VITInspectionChecklist) => {
    setSelectedInspection(inspection);
    setSelectedAssetId(inspection.vitAssetId);
    setIsInspectionFormOpen(true);
  };
  
  const handleViewAsset = (assetId: string) => {
    navigate(`/asset-management/vit-inspection-details/${assetId}`);
  };

  const performDeleteInspection = async (id: string, data: any) => {
    const inspectionToDelete = data as VITInspectionChecklist;
    
    // Log the delete action before deleting
    LoggingService.getInstance().logDeleteAction(
      user?.id || 'unknown',
      user?.name || 'unknown',
      user?.role || 'unknown',
      'vit_inspection',
      id,
      inspectionToDelete, // deleted data
      `Deleted VIT inspection record: ${inspectionToDelete.inspectionDate || id}`,
      user?.region,
      user?.district
    ).catch(error => {
      console.error('Error logging delete action:', error);
    });

    deleteVITInspection(id);
    toast.success("Inspection record deleted successfully");
  };

  return (
    <AccessControlWrapper type="inspection">
      <Layout>
        <div className="container py-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">VIT Inspection Management</h1>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="assets">Assets Management</TabsTrigger>
                <TabsTrigger value="inspections">Inspection Records</TabsTrigger>
              </TabsList>
              
              <TabsContent value="assets" className="space-y-4">
                <VITAssetsTable 
                  onAddAsset={handleAddAsset}
                  onEditAsset={handleEditAsset}
                  onInspect={handleAddInspection}
                />
                
                <Button
                  onClick={handleAddAsset}
                  className="mt-4"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New Switchgear Asset
                </Button>
              </TabsContent>
              
              <TabsContent value="inspections" className="space-y-4 bg-card p-6 rounded-md">
                <InspectionRecordsTable 
                  onViewDetails={handleViewDetails} 
                  onEditInspection={handleEditInspection}
                  onViewAsset={handleViewAsset}
                  onDeleteInspection={openDeleteDialog}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Asset Form Sheet */}
        <Sheet open={isAssetFormOpen} onOpenChange={setIsAssetFormOpen}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
                              <SheetTitle>{selectedAsset ? "Edit Switchgear Asset" : "Add New Switchgear Asset"}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <VITAssetForm
                asset={selectedAsset ?? undefined}
                onSubmit={handleCloseAssetForm}
                onCancel={handleCloseAssetForm}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Inspection Form Sheet - Used for both Add and Edit */}
        <Sheet 
          open={isInspectionFormOpen} 
          onOpenChange={(open) => {
            if (!open) {
              handleCloseInspectionForm();
            }
          }}
        >
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selectedInspection ? "Edit VIT Inspection" : "Add VIT Inspection"}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <VITInspectionForm
                inspection={selectedInspection}
                onClose={handleCloseInspectionForm}
                onSuccess={handleInspectionSubmit}
                preSelectedAssetId={selectedAssetId}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Inspection Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>VIT Inspection Details</DialogTitle>
              <DialogDescription>
                Inspection performed on {selectedInspection ? new Date(selectedInspection.inspectionDate).toLocaleDateString() : ""}
              </DialogDescription>
            </DialogHeader>
            {selectedInspection && <InspectionDetailsView inspection={selectedInspection} />}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={isOpen}
          onClose={closeDeleteDialog}
          onConfirm={() => confirmDelete(performDeleteInspection)}
          title="Delete VIT Inspection Record"
          itemName={deleteItem?.name}
          itemType="VIT inspection record"
          isLoading={isDeleting}
          warningMessage="This action cannot be undone. This will permanently delete the VIT inspection record and remove all associated data from the system."
        />
      </Layout>
    </AccessControlWrapper>
  );
}

// Internal component for inspection details view
function InspectionDetailsView({ inspection }: { inspection: VITInspectionChecklist }) {
  const { vitAssets, regions, districts } = useData();
  const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
  const region = asset?.region || "Unknown";
  const district = asset?.district || "Unknown";

  const getStatusDisplay = (value: string) => {
    if (value === "Yes") return <span className="text-green-600 font-medium">Yes</span>;
    if (value === "No") return <span className="text-red-600 font-medium">No</span>;
    if (value === "Good") return <span className="text-green-600 font-medium">Good</span>;
    if (value === "Bad") return <span className="text-red-600 font-medium">Bad</span>;
    return value;
  };

  const checklistItems = [
    { label: "Rodent/Termite Encroachment", value: inspection.rodentTermiteEncroachment, isIssue: inspection.rodentTermiteEncroachment === "Yes" },
    { label: "Clean and Dust Free", value: inspection.cleanDustFree, isIssue: inspection.cleanDustFree === "No" },
    { label: "Protection Button Enabled", value: inspection.protectionButtonEnabled, isIssue: inspection.protectionButtonEnabled === "No" },
    { label: "Recloser Button Enabled", value: inspection.recloserButtonEnabled, isIssue: inspection.recloserButtonEnabled === "No" },
    { label: "Ground Earth Button Enabled", value: inspection.groundEarthButtonEnabled, isIssue: inspection.groundEarthButtonEnabled === "No" },
    { label: "AC Power On", value: inspection.acPowerOn, isIssue: inspection.acPowerOn === "No" },
    { label: "Battery Power Low", value: inspection.batteryPowerLow, isIssue: inspection.batteryPowerLow === "Yes" },
    { label: "Handle Lock On", value: inspection.handleLockOn, isIssue: inspection.handleLockOn === "No" },
    { label: "Remote Button Enabled", value: inspection.remoteButtonEnabled, isIssue: inspection.remoteButtonEnabled === "No" },
    { label: "Gas Level Low", value: inspection.gasLevelLow, isIssue: inspection.gasLevelLow === "Yes" },
    { label: "Earthing Arrangement Adequate", value: inspection.earthingArrangementAdequate, isIssue: inspection.earthingArrangementAdequate === "No" },
    { label: "No Fuses Blown", value: inspection.noFusesBlown, isIssue: inspection.noFusesBlown === "No" },
    { label: "No Damage to Bushings", value: inspection.noDamageToBushings, isIssue: inspection.noDamageToBushings === "No" },
    { label: "No Damage to HV Connections", value: inspection.noDamageToHVConnections, isIssue: inspection.noDamageToHVConnections === "No" },
    { label: "Insulators Clean", value: inspection.insulatorsClean, isIssue: inspection.insulatorsClean === "No" },
    { label: "Paintwork Adequate", value: inspection.paintworkAdequate, isIssue: inspection.paintworkAdequate === "No" },
    { label: "PT Fuse Link Intact", value: inspection.ptFuseLinkIntact, isIssue: inspection.ptFuseLinkIntact === "No" },
    { label: "No Corrosion", value: inspection.noCorrosion, isIssue: inspection.noCorrosion === "No" },
    { label: "Silica Gel Condition", value: inspection.silicaGelCondition, isIssue: inspection.silicaGelCondition === "Bad" },
    { label: "Correct Labelling", value: inspection.correctLabelling, isIssue: inspection.correctLabelling === "No" },
  ];

  // Debug logging for issues calculation
  console.log('[VITInspectionDetailsView] Inspection data for issues calculation:', {
    inspection,
    checklistItems: checklistItems.map(item => ({
      label: item.label,
      value: item.value,
      isIssue: item.isIssue,
      fieldName: Object.keys(inspection).find(key => inspection[key] === item.value)
    })),
    allInspectionKeys: Object.keys(inspection),
    allInspectionValues: Object.values(inspection)
  });

  // Manual field-by-field check for debugging
  const manualIssuesCheck = {
    rodentTermiteEncroachment: { value: inspection.rodentTermiteEncroachment, isIssue: inspection.rodentTermiteEncroachment === "Yes", expected: "Yes" },
    cleanDustFree: { value: inspection.cleanDustFree, isIssue: inspection.cleanDustFree === "No", expected: "No" },
    protectionButtonEnabled: { value: inspection.protectionButtonEnabled, isIssue: inspection.protectionButtonEnabled === "No", expected: "No" },
    recloserButtonEnabled: { value: inspection.recloserButtonEnabled, isIssue: inspection.recloserButtonEnabled === "No", expected: "No" },
    groundEarthButtonEnabled: { value: inspection.groundEarthButtonEnabled, isIssue: inspection.groundEarthButtonEnabled === "No", expected: "No" },
    acPowerOn: { value: inspection.acPowerOn, isIssue: inspection.acPowerOn === "No", expected: "No" },
    batteryPowerLow: { value: inspection.batteryPowerLow, isIssue: inspection.batteryPowerLow === "Yes", expected: "Yes" },
    handleLockOn: { value: inspection.handleLockOn, isIssue: inspection.handleLockOn === "No", expected: "No" },
    remoteButtonEnabled: { value: inspection.remoteButtonEnabled, isIssue: inspection.remoteButtonEnabled === "No", expected: "No" },
    gasLevelLow: { value: inspection.gasLevelLow, isIssue: inspection.gasLevelLow === "Yes", expected: "Yes" },
    earthingArrangementAdequate: { value: inspection.earthingArrangementAdequate, isIssue: inspection.earthingArrangementAdequate === "No", expected: "No" },
    noFusesBlown: { value: inspection.noFusesBlown, isIssue: inspection.noFusesBlown === "No", expected: "No" },
    noDamageToBushings: { value: inspection.noDamageToBushings, isIssue: inspection.noDamageToBushings === "No", expected: "No" },
    noDamageToHVConnections: { value: inspection.noDamageToHVConnections, isIssue: inspection.noDamageToHVConnections === "No", expected: "No" },
    insulatorsClean: { value: inspection.insulatorsClean, isIssue: inspection.insulatorsClean === "No", expected: "No" },
    paintworkAdequate: { value: inspection.paintworkAdequate, isIssue: inspection.paintworkAdequate === "No", expected: "No" },
    ptFuseLinkIntact: { value: inspection.ptFuseLinkIntact, isIssue: inspection.ptFuseLinkIntact === "No", expected: "No" },
    noCorrosion: { value: inspection.noCorrosion, isIssue: inspection.noCorrosion === "No", expected: "No" },
    silicaGelCondition: { value: inspection.silicaGelCondition, isIssue: inspection.silicaGelCondition === "Bad", expected: "Bad" },
    correctLabelling: { value: inspection.correctLabelling, isIssue: inspection.correctLabelling === "No", expected: "No" }
  };

  console.log('[VITInspectionDetailsView] Manual issues check:', manualIssuesCheck);

  const issuesCount = checklistItems.filter(item => item.isIssue).length;
  
  console.log('[VITInspectionDetailsView] Issues count calculation:', {
    totalItems: checklistItems.length,
    itemsWithIssues: checklistItems.filter(item => item.isIssue),
    issuesCount,
    timestamp: new Date().toISOString()
  });

  return (
    <div className="space-y-6 py-4">
      {/* Asset Information */}
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-medium mb-2">Asset Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
            <p className="text-base">{asset?.serialNumber || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Type</p>
            <p className="text-base">{asset?.typeOfUnit || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Region</p>
            <p className="text-base">{region}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">District</p>
            <p className="text-base">{district}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Location</p>
            <p className="text-base">{asset?.location || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Feeder Name</p>
            <p className="text-base">{inspection.feederName || asset?.feederName || "Not specified"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Feeder Alias</p>
            <p className="text-base">{inspection.feederAlias || "Not specified"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <p className="text-base">{asset?.status || "Unknown"}</p>
          </div>
        </div>
      </div>

      {/* Inspection Information */}
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-3">Inspection Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Date</p>
            <p className="text-base">{new Date(inspection.inspectionDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Inspector</p>
            <p className="text-base">{inspection.inspectedBy}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Issues Found</p>
            <p className={`text-base ${issuesCount > 0 ? "text-red-600" : "text-green-600"}`}>
              {issuesCount} {issuesCount === 1 ? "issue" : "issues"}
            </p>
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inspection Item</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {checklistItems.map((item, index) => (
                <tr key={index} className={item.isIssue ? "bg-red-50" : ""}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.label}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusDisplay(item.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remarks */}
      {inspection.remarks && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Remarks</h3>
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm">{inspection.remarks}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Internal component for inspection records table with standardized actions matching the asset table
function InspectionRecordsTable({ onViewDetails, onEditInspection, onViewAsset, onDeleteInspection }: { 
  onViewDetails: (inspection: VITInspectionChecklist) => void;
  onEditInspection: (inspection: VITInspectionChecklist) => void;
  onViewAsset: (assetId: string) => void;
  onDeleteInspection: (id: string, name: string, type: string, data: any) => void;
}) {
  const { vitInspections, vitAssets, regions, districts, deleteVITInspection } = useData();
  const { user } = useAzureADAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  // Filter inspections based on user role and search term
  const filteredInspections = (Array.isArray(vitInspections) ? vitInspections : []).filter(inspection => {
    const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
    if (!asset) return false;

    // First apply role-based filtering
    let roleBasedAccess = true;
    if (user?.role === "global_engineer") {
      roleBasedAccess = true;
    } else if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager") {
      const userRegion = regions.find(r => r.name === user.region);
      roleBasedAccess = userRegion ? asset.region === userRegion.id : false;
    } else if ((user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.region && user.district) {
      const userRegion = regions.find(r => r.name === user.region);
      const userDistrict = districts.find(d => d.name === user.district);
      roleBasedAccess = userRegion && userDistrict ? 
        asset.region === userRegion.id && asset.district === userDistrict.id : false;
    }

    if (!roleBasedAccess) return false;

    // Then apply search filtering if there's a search term
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      const region = regions.find(r => r.id === asset.region)?.name || "";
      const district = districts.find(d => d.id === asset.district)?.name || "";
      
      return (
        asset.serialNumber.toLowerCase().includes(lowercaseSearch) ||
        asset.location.toLowerCase().includes(lowercaseSearch) ||
        region.toLowerCase().includes(lowercaseSearch) ||
        district.toLowerCase().includes(lowercaseSearch) ||
        inspection.inspectedBy.toLowerCase().includes(lowercaseSearch) ||
        (inspection.feederName && inspection.feederName.toLowerCase().includes(lowercaseSearch)) ||
        (inspection.feederAlias && inspection.feederAlias.toLowerCase().includes(lowercaseSearch)) ||
        (asset.feederName && asset.feederName.toLowerCase().includes(lowercaseSearch))
      );
    }

    return true;
  });

  const handleDeleteInspection = (id: string) => {
    // Find the inspection to get details for confirmation
    const inspectionToDelete = (Array.isArray(vitInspections) ? vitInspections : []).find(inspection => inspection.id === id);
    
    if (!inspectionToDelete) return;

    // Open confirmation dialog
    const inspectionName = inspectionToDelete.inspectionDate || id;
    onDeleteInspection(id, inspectionName, 'VIT inspection record', inspectionToDelete);
  };

  const exportToPDF = async (inspection: VITInspectionChecklist) => {
    const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
    if (!asset) {
      toast.error("Asset information not found");
      return;
    }
    
    console.log('[VITManagementPage] Exporting PDF for inspection:', {
      inspectionId: inspection.id,
      photoUrls: inspection.photoUrls,
      photoUrlsLength: inspection.photoUrls?.length,
      photoUrlsType: typeof inspection.photoUrls,
      photoUrlsIsArray: Array.isArray(inspection.photoUrls)
    });
    
    try {
      // Use the comprehensive PDF export function that includes photos
      await exportInspectionToPDF(
        inspection,
        asset,
        (regionId: string) => regions.find(r => r.id === regionId)?.name || "Unknown",
        (districtId: string) => districts.find(d => d.id === districtId)?.name || "Unknown"
      );
      toast.success("PDF report generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF report");
    }
  };

  const exportToCSV = (inspection: VITInspectionChecklist) => {
    const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
    if (!asset) {
      toast.error("Asset information not found");
      return;
    }
    
    const region = regions.find(r => r.id === asset.region)?.name || "Unknown";
    const district = districts.find(d => d.id === asset.district)?.name || "Unknown";
    
    // Create CSV content
    const csvContent = [
      ["VIT Inspection Report"],
      ["Date", format(new Date(inspection.inspectionDate), "dd/MM/yyyy")],
      ["Inspector", inspection.inspectedBy],
      [],
      ["Asset Information"],
      ["Serial Number", asset.serialNumber],
      ["Type of Unit", asset.typeOfUnit],
      ["Voltage Level", asset.voltageLevel],
      ["Region", region],
      ["District", district],
      ["Location", asset.location],
      [],
      ["Inspection Checklist"],
      ["Item", "Status"],
      ["Rodent/Termite Encroachment", inspection.rodentTermiteEncroachment],
      ["Clean and Dust Free", inspection.cleanDustFree],
      ["Protection Button Enabled", inspection.protectionButtonEnabled],
      ["Recloser Button Enabled", inspection.recloserButtonEnabled],
      ["Ground Earth Button Enabled", inspection.groundEarthButtonEnabled],
      ["AC Power On", inspection.acPowerOn],
      ["Battery Power Low", inspection.batteryPowerLow],
      ["Handle Lock On", inspection.handleLockOn],
      ["Remote Button Enabled", inspection.remoteButtonEnabled],
      ["Gas Level Low", inspection.gasLevelLow],
      ["Earthing Arrangement Adequate", inspection.earthingArrangementAdequate],
      ["No Fuses Blown", inspection.noFusesBlown],
      ["No Damage to Bushings", inspection.noDamageToBushings],
      ["No Damage to HV Connections", inspection.noDamageToHVConnections],
      ["Insulators Clean", inspection.insulatorsClean],
      ["Paintwork Adequate", inspection.paintworkAdequate],
      ["PT Fuse Link Intact", inspection.ptFuseLinkIntact],
      ["No Corrosion", inspection.noCorrosion],
      ["Silica Gel Condition", inspection.silicaGelCondition],
      ["Correct Labelling", inspection.correctLabelling]
    ];
    
    if (inspection.remarks) {
      csvContent.push([], ["Remarks"], [inspection.remarks]);
    }
    
    // Convert to CSV string
    const csvString = csvContent.map(row => row.join(",")).join("\n");
    
    // Create and download file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `vit-inspection-${asset.serialNumber}-${format(new Date(inspection.inspectionDate), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV report generated successfully");
  };
  
  const handleViewInspectionDetails = (inspection: VITInspectionChecklist) => {
    onViewAsset(inspection.vitAssetId);
  };

  const handleEditInspectionDetails = (inspection: VITInspectionChecklist) => {
    navigate(`/asset-management/edit-vit-inspection/${inspection.id}`);
  };
  
  return (
    <div>
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search inspections by serial number, location, region or district..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 border rounded-md w-full"
        />
      </div>

      <div className="rounded-md border">
        <div className="relative">
          <div className="overflow-x-auto">
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Asset</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Feeder</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Feeder Alias</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Region</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">District</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Inspector</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Issues</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider sticky right-0 bg-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredInspections.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-4 text-center text-sm text-muted-foreground">
                        {searchTerm ? "No inspections found matching your search" : "No inspection records found"}
                      </td>
                    </tr>
                  ) : (
                    filteredInspections.map(inspection => {
                      const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
                      if (!asset) return null;
                      
                      const region = asset.region || "Unknown";
                      const district = asset.district || "Unknown";
                      
                      // Count issues
                      const issuesCount = Object.entries(inspection).reduce((count, [key, value]) => {
                        // Check only Yes/No fields for issues (Yes for negative fields, No for positive fields)
                        if (key === 'rodentTermiteEncroachment' && value === 'Yes') return count + 1;
                        if (key === 'batteryPowerLow' && value === 'Yes') return count + 1;
                        if (key === 'gasLevelLow' && value === 'Yes') return count + 1;
                        if (key === 'silicaGelCondition' && value === 'Bad') return count + 1;
                        
                        // All other boolean fields where "No" is an issue
                        if (
                          ['cleanDustFree', 'protectionButtonEnabled', 'recloserButtonEnabled', 
                           'groundEarthButtonEnabled', 'acPowerOn', 'handleLockOn', 'remoteButtonEnabled', 
                           'earthingArrangementAdequate', 'noFusesBlown', 'noDamageToBushings', 
                           'noDamageToHVConnections', 'insulatorsClean', 'paintworkAdequate', 
                           'ptFuseLinkIntact', 'noCorrosion', 'correctLabelling'].includes(key) && 
                           value === 'No'
                        ) {
                          return count + 1;
                        }
                        
                        return count;
                      }, 0);
                      
                      return (
                        <tr
                          key={inspection.id}
                          onClick={e => {
                            // Prevent row click if clicking inside the Actions cell
                            if ((e.target as HTMLElement).closest('td')?.classList.contains('actions-cell')) return;
                            onViewDetails(inspection);
                          }}
                          className="cursor-pointer hover:bg-muted transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground sticky left-0 bg-card">
                            {new Date(inspection.inspectionDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground bg-card">
                            {asset.serialNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            {inspection.feederName || asset.feederName || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            {inspection.feederAlias || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            {region}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            {district}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            {inspection.inspectedBy}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              issuesCount > 0 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                            }`}>
                              {issuesCount} {issuesCount === 1 ? "issue" : "issues"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-card actions-cell">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onViewDetails(inspection)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onViewAsset(asset.id)}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Asset
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEditInspection(inspection)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportToPDF(inspection)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Export PDF
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteInspection(inspection.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

