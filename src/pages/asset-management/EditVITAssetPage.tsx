import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useData } from "@/contexts/DataContext";
import { VITAssetForm } from "@/components/vit/VITAssetForm";
import { toast } from "@/components/ui/sonner";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VITAsset } from "@/lib/types";
import { VITSyncService } from "@/services/VITSyncService";
import { getVITAsset } from "@/lib/api";

export default function EditVITAssetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vitAssets } = useData();
  const [asset, setAsset] = useState<VITAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const vitSyncService = VITSyncService.getInstance();
  
  useEffect(() => {
    const loadAsset = async () => {
      if (id) {
        try {
          // First check online assets from local state
          const foundAsset = vitAssets.find(a => a.id === id);
          if (foundAsset) {
            setAsset(foundAsset);
            setIsLoading(false);
            return;
          }

          // If not found in local state, try to fetch from API
          try {
            const apiAsset = await getVITAsset(id);
            if (apiAsset) {
              setAsset(apiAsset);
              setIsLoading(false);
              return;
            }
          } catch (apiError) {
            console.log('Asset not found via API, checking offline assets...');
          }

          // If not found via API, check offline assets
          const offlineAssets = await vitSyncService.getPendingVITAssets();
          const offlineAsset = offlineAssets.find(a => a.id === id);
          if (offlineAsset) {
            setAsset(offlineAsset);
            setIsLoading(false);
            return;
          }

          // If still not found, show error
          toast.error("Asset not found");
          navigate("/asset-management/vit-inspection");
        } catch (error) {
          console.error("Error loading asset:", error);
          toast.error("Failed to load asset");
          navigate("/asset-management/vit-inspection");
        }
      }
    };

    loadAsset();
  }, [id, vitAssets, navigate]);
  
  const handleSubmit = () => {
    toast.success("Asset updated successfully");
    navigate(`/asset-management/vit-inspection-details/${id}`);
  };
  
  const handleCancel = () => {
    navigate(`/asset-management/vit-inspection-details/${id}`);
  };
  
  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <p>Loading asset data...</p>
        </div>
      </Layout>
    );
  }
  
  if (!asset) {
    return (
      <Layout>
        <div className="container py-8">
          <p>Asset not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/asset-management/vit-inspection-details/${id}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit Switchgear Asset</h1>
        </div>
        
        <VITAssetForm
          asset={asset}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </Layout>
  );
} 