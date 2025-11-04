import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubstationInspection } from "@/lib/asset-types";
import { useData } from "@/contexts/DataContext";
import { useOffline } from "@/contexts/OfflineContext";
import { toast } from "@/components/ui/sonner";
import { InspectionDetailsView } from "@/components/inspection/InspectionDetailsView";
import SecondarySubstationInspectionDetailsPage from "./SecondarySubstationInspectionDetailsPage";

export default function InspectionDetailsPage() {
  console.log('[InspectionDetailsPage] Component rendering...');
  
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoadingInitialData, isInitialDataLoaded, savedInspections, getSavedInspection } = useData();
  const { getOfflineInspections } = useOffline();
  const [inspection, setInspection] = useState<(SubstationInspection & { isOffline?: boolean; offlineId?: string; syncStatus?: string }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  console.log('[InspectionDetailsPage] Component state:', { id, isLoadingInitialData, isInitialDataLoaded, savedInspectionsType: typeof savedInspections, isArray: Array.isArray(savedInspections) });

  // Use getSavedInspection from DataContext when data is ready
  useEffect(() => {
    console.log('[InspectionDetailsPage] useEffect triggered with:', { 
      id, 
      isLoadingInitialData, 
      isInitialDataLoaded, 
      savedInspectionsType: typeof savedInspections, 
      isArray: Array.isArray(savedInspections),
      savedInspectionsLength: Array.isArray(savedInspections) ? savedInspections.length : 'N/A'
    });
    
    if (!id) return;
    
    // Always try to fetch from API first
    console.log('[InspectionDetailsPage] ==========================================');
    console.log('[InspectionDetailsPage] Fetching inspection from API:', id);
    console.log('[InspectionDetailsPage] ==========================================');
    
    // Fetch directly from API
    (async () => {
      try {
        const { apiRequest } = await import('@/lib/api');
        console.log('[InspectionDetailsPage] About to call API for ID:', id);
        const response = await apiRequest(`/api/substations/${id}`);
        console.log('[InspectionDetailsPage] API response received:', response);
        console.log('[InspectionDetailsPage] Response type:', typeof response);
        console.log('[InspectionDetailsPage] Response keys:', response ? Object.keys(response) : 'null');
        
        if (response && response.id) {
          console.log('[InspectionDetailsPage] Found inspection from API with ID:', response.id);
          console.log('[InspectionDetailsPage] Inspection data before setting:', {
            id: response.id,
            updatedBy: response.updatedBy,
            updatedAt: response.updatedAt,
            createdBy: response.createdBy,
            createdAt: response.createdAt
          });
          setInspection(response as SubstationInspection & { isOffline?: boolean; offlineId?: string; syncStatus?: string });
          setIsLoading(false);
          console.log('[InspectionDetailsPage] Inspection set, isLoading=false');
          return;
        } else {
          console.log('[InspectionDetailsPage] No valid response from API');
        }
      } catch (error) {
        console.error('[InspectionDetailsPage] Error fetching from API:', error);
        console.error('[InspectionDetailsPage] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      
      // If API fetch failed, check saved inspections
      if (isLoadingInitialData || !isInitialDataLoaded || !Array.isArray(savedInspections)) {
        console.log('[InspectionDetailsPage] Data not ready yet, waiting...');
        return;
      }
      
      const foundInspection = getSavedInspection(id);
      if (foundInspection) {
        console.log('[InspectionDetailsPage] Found in savedInspections:', foundInspection);
        setInspection(foundInspection);
        setIsLoading(false);
        return;
      }
      
      // If still not found, check offline storage
      console.log('[InspectionDetailsPage] Checking offline storage...');
      
      try {
        const offlineInspections = await getOfflineInspections();
        if (Array.isArray(offlineInspections)) {
          const offlineInspection = offlineInspections.find(offline => offline.id === id);
          
          if (offlineInspection) {
            console.log('[InspectionDetailsPage] Found offline inspection:', offlineInspection);
            const formattedInspection = {
              ...offlineInspection.data,
              id: offlineInspection.id,
              isOffline: true,
              offlineId: offlineInspection.id,
              syncStatus: offlineInspection.data.syncStatus,
              substationNo: offlineInspection.data.substationNo || 'Offline',
              region: offlineInspection.data.region || 'Offline',
              district: offlineInspection.data.district || 'Offline',
              date: offlineInspection.data.date || offlineInspection.data.createdAt?.split('T')[0] || 'Offline',
              status: offlineInspection.data.status || 'Pending',
              type: offlineInspection.data.type || 'primary',
              substationType: offlineInspection.data.substationType || 'primary',
              items: offlineInspection.data.items || []
            } as SubstationInspection & { isOffline: boolean; offlineId: string; syncStatus: string };
            
            setInspection(formattedInspection);
            setIsLoading(false);
            return;
          }
        } else {
          console.warn('[InspectionDetailsPage] Offline inspections is not an array');
        }
      } catch (error) {
        console.error('[InspectionDetailsPage] Error checking offline storage:', error);
      }
      
      // If all checks fail
      console.log('[InspectionDetailsPage] Inspection not found anywhere');
      toast.error("Inspection not found");
      navigate("/asset-management/inspection-management");
    })();
  }, [id, savedInspections, isLoadingInitialData, isInitialDataLoaded, getOfflineInspections, navigate, getSavedInspection]);

  // Listen for inspection sync completion to handle ID mapping
  useEffect(() => {
    const handleInspectionSynced = (event: CustomEvent) => {
      const { offlineId, serverId } = event.detail;
      
      // If the current inspection ID matches the offline ID that was just synced
      if (id === offlineId) {
        console.log('[InspectionDetailsPage] Current offline inspection was synced, redirecting to server ID:', serverId);
        
        // Show success message
        toast.success("Inspection synced successfully! Redirecting to synced version.");
        
        // Redirect to the server ID version
        setTimeout(() => {
          navigate(`/asset-management/inspection-details/${serverId}`);
        }, 1000);
      }
    };

    // Add event listener for inspection sync completion
    window.addEventListener('inspectionSynced', handleInspectionSynced as EventListener);

    // Cleanup event listener
    return () => {
      window.removeEventListener('inspectionSynced', handleInspectionSynced as EventListener);
    };
  }, [id, navigate]);

  // Debug: Log when component mounts and data changes
  useEffect(() => {
    console.log('[InspectionDetailsPage] Component mounted/updated:', {
      id,
      isLoadingInitialData,
      isInitialDataLoaded,
      savedInspectionsLength: Array.isArray(savedInspections) ? savedInspections.length : 'N/A',
      savedInspectionsType: typeof savedInspections,
      savedInspectionsIsArray: Array.isArray(savedInspections)
    });
  }, [id, isLoadingInitialData, isInitialDataLoaded, savedInspections]);

  // Show loading state while initial data is being loaded or while searching
  console.log('[InspectionDetailsPage] Render check:', { 
    isLoadingInitialData, 
    isInitialDataLoaded, 
    savedInspectionsIsArray: Array.isArray(savedInspections),
    isLoading,
    hasInspection: !!inspection,
    whyLoading: {
      isLoadingInitialData,
      notLoaded: !isInitialDataLoaded,
      notArray: !Array.isArray(savedInspections),
      isLoading
    }
  });
  
  if (isLoadingInitialData || !isInitialDataLoaded || !Array.isArray(savedInspections) || isLoading) {
    console.log('[InspectionDetailsPage] Showing loading screen because of conditions above');
    return (
      <Layout>
        <div className="container py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {isLoadingInitialData || !isInitialDataLoaded 
                ? 'Loading inspection data...' 
                : isLoading
                ? 'Searching for inspection...'
                : 'Waiting for data to be ready...'
              }
            </p>
            {!Array.isArray(savedInspections) && (
              <p className="text-sm text-muted-foreground mt-2">
                Data type: {typeof savedInspections} 
                {savedInspections && typeof savedInspections === 'object' && (
                  ` (${Object.keys(savedInspections).length} keys)`
                )}
              </p>
            )}
            {Array.isArray(savedInspections) && isLoading && (
              <p className="text-sm text-muted-foreground mt-2">
                Searching through {savedInspections.length} inspections...
              </p>
            )}
            <div className="mt-4">
              <Button 
                onClick={() => {
                  console.log('[InspectionDetailsPage] Manual refresh clicked');
                  window.location.reload();
                }}
                variant="outline"
              >
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if we have an ID
  if (!id) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="text-center">
            <p className="text-lg text-muted-foreground mb-4">No inspection ID provided</p>
            <Button onClick={() => navigate("/asset-management/inspection-management")}>
              Back to Inspections
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="pt-6">
              <p>Loading inspection details...</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!inspection) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="pt-6">
              <p>Inspection not found</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        {String(inspection.type) === "secondary" ? (
          <SecondarySubstationInspectionDetailsPage inspection={inspection as any} />
        ) : (
          <InspectionDetailsView
            inspection={inspection}
            showHeader={true}
            showBackButton={true}
            onBack={() => navigate("/asset-management/inspection-management")}
            onEdit={inspection.isOffline ? undefined : () => navigate(`/asset-management/edit-inspection/${id}`)}
          />
        )}
      </div>
    </Layout>
  );
}
