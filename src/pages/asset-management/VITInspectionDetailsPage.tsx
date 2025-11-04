import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { apiRequest } from "@/lib/api";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ChevronLeft } from "lucide-react";
import { VITAsset, VITInspectionChecklist } from "@/lib/types";
import { AssetInfoCard } from "@/components/vit/AssetInfoCard";
import { InspectionRecord } from "@/components/vit/InspectionRecord";
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { DeleteConfirmationDialog, useDeleteConfirmation } from "@/components/common/DeleteConfirmationDialog";

export default function VITInspectionDetailsPage() {
  const { id: assetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vitAssets, regions, districts, deleteVITInspection, isLoadingVITAssets } = useData();
  const { isOpen, deleteItem, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation();
  
  const [asset, setAsset] = useState<VITAsset | null>(null);
  const [inspections, setInspections] = useState<VITInspectionChecklist[]>([]);
  const [vitInspections, setVitInspections] = useState<VITInspectionChecklist[]>([]);
  
  // Load VIT inspections for this asset
  const loadVITInspections = async () => {
    try {
      console.log('[VITInspectionDetailsPage] Loading inspections for asset:', assetId);
      const res = await apiRequest(`/api/vitInspections?vitAssetId=${assetId}`);
      console.log('[VITInspectionDetailsPage] API response:', res);
      
      const inspectionsData = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : []);
      console.log('[VITInspectionDetailsPage] Processed inspections data:', inspectionsData);
      
      setVitInspections(inspectionsData);
      
      // No need to filter again since backend already filters by vitAssetId
      setInspections(inspectionsData);
      
      console.log('[VITInspectionDetailsPage] Set inspections:', inspectionsData.length, 'records');
    } catch (error) {
      console.error('Error loading VIT inspections:', error);
    }
  };
  
  // Simple effect to load asset when assetId changes
  useEffect(() => {
    if (assetId && vitAssets && vitAssets.length > 0) {
      console.log('[VITInspectionDetailsPage] Looking for asset:', assetId);
      console.log('[VITInspectionDetailsPage] Available assets:', vitAssets.length);
      
      const foundAsset = vitAssets.find(a => a.id === assetId);
      if (foundAsset) {
        console.log('[VITInspectionDetailsPage] Found asset:', foundAsset);
        setAsset(foundAsset);
        
        // Load VIT inspections for this asset
        loadVITInspections();
      } else {
        console.log('[VITInspectionDetailsPage] Asset not found:', assetId);
        toast.error("Asset not found");
        navigate("/asset-management/vit-inspection");
      }
    }
  }, [assetId, vitAssets, navigate]);


  // Listen for inspection added events
  useEffect(() => {
    const handleInspectionAdded = (event: CustomEvent) => {
      console.log('[VITInspectionDetailsPage] Inspection added event received:', event.detail);
      
      if (event.detail.type === 'vit' && event.detail.inspection.vitAssetId === assetId) {
        const newInspection = event.detail.inspection;
        
        // Add the new inspection to local state immediately
        setInspections(prev => {
          // Ensure prev is always an array
          const currentInspections = Array.isArray(prev) ? prev : [];
          
          console.log('[VITInspectionDetailsPage] Adding inspection to state:', {
            currentInspectionsLength: currentInspections.length,
            newInspection: newInspection,
            timestamp: new Date().toISOString()
          });
          
          // Check if inspection already exists (avoid duplicates)
          const exists = currentInspections.some(inspection => inspection.id === newInspection.id);
          if (exists) {
            console.log('[VITInspectionDetailsPage] Inspection already exists, skipping');
            return currentInspections;
          }
          
          // Add new inspection to the beginning of the list
          const updatedInspections = [newInspection, ...currentInspections];
          console.log('[VITInspectionDetailsPage] Updated inspections state:', {
            newLength: updatedInspections.length,
            timestamp: new Date().toISOString()
          });
          
          return updatedInspections;
        });
        
        // Reload inspections to get the latest data
        loadVITInspections();
        
        // Show success message
        if (event.detail.status === 'offline') {
          toast.success("Inspection saved offline and added to the list");
        } else {
          toast.success("Inspection added successfully");
        }
      }
    };

    // Add event listener
    window.addEventListener('inspectionAdded', handleInspectionAdded as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('inspectionAdded', handleInspectionAdded as EventListener);
    };
  }, [assetId, toast]);
  
  const getRegionName = (regionId: string) => {
    const region = (regions || []).find(r => r.id === regionId);
    return region ? region.name : "Unknown";
  };
  
  const getDistrictName = (districtId: string) => {
    const district = (districts || []).find(d => d.id === districtId);
    return district ? district.name : "Unknown";
  };
  
  const handleEdit = (inspectionId: string) => {
    navigate(`/asset-management/edit-vit-inspection/${inspectionId}`);
  };
  
  const handleDelete = (inspectionId: string) => {
    // Find the inspection to get details for confirmation
    const inspectionToDelete = inspections.find(i => i.id === inspectionId);
    
    if (!inspectionToDelete) return;

    // Open confirmation dialog
    const inspectionName = inspectionToDelete.inspectionDate || inspectionId;
    openDeleteDialog(inspectionId, inspectionName, 'VIT inspection record', inspectionToDelete);
  };

  const performDelete = async (inspectionId: string, data: any) => {
    deleteVITInspection(inspectionId);
    // Update the local state to reflect the deletion
    setInspections(prev => prev.filter(i => i.id !== inspectionId));
    toast.success("Inspection record deleted successfully");
  };
  
  // Show loading only when VIT assets are still loading
  if (isLoadingVITAssets || !vitAssets || vitAssets.length === 0) {
    return (
      <AccessControlWrapper type="asset">
        <Layout>
          <div className="container py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">
                {isLoadingVITAssets ? 'Loading switchgear data...' : 'Waiting for switchgear assets...'}
              </p>
            </div>
          </div>
        </Layout>
      </AccessControlWrapper>
    );
  }
  
  // Show asset not found if we have assets but couldn't find the specific one
  if (!asset) {
    return (
      <AccessControlWrapper type="asset">
        <Layout>
          <div className="container py-8">
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-4">Asset not found</p>
              <Button onClick={() => navigate("/asset-management/vit-inspection")}>
                Back to Switchgear Assets
              </Button>
            </div>
          </div>
        </Layout>
      </AccessControlWrapper>
    );
  }

  return (
    <AccessControlWrapper type="asset">
      <Layout>
        <div className="container py-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/asset-management/vit-inspection")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Switchgear Asset Details</h1>
          </div>
          
          <div className="space-y-6">
            <AssetInfoCard
              asset={asset}
              getRegionName={getRegionName}
              getDistrictName={getDistrictName}
            />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Inspection Records</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()}
                    className="text-sm"
                  >
                    Refresh
                  </Button>
                  <Button onClick={() => navigate(`/asset-management/vit-inspection-form/${assetId}`)}>
                    Add Inspection
                  </Button>
                </div>
              </div>
              
              {inspections.length === 0 ? (
                <p className="text-muted-foreground">No inspection records found</p>
              ) : (
                <div className="space-y-4">
                  {inspections.map((inspection) => (
                    <InspectionRecord
                      key={inspection.id}
                      inspection={inspection}
                      asset={asset}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      getRegionName={getRegionName}
                      getDistrictName={getDistrictName}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={isOpen}
          onClose={closeDeleteDialog}
          onConfirm={() => confirmDelete(performDelete)}
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
