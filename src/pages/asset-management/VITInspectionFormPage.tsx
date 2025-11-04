import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useData } from "@/contexts/DataContext";
import { VITInspectionForm } from "@/components/vit/VITInspectionForm";
import { toast } from "@/components/ui/sonner";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VITAsset } from "@/lib/types";
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';

export default function VITInspectionFormPage() {
  const { id: assetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vitAssets } = useData();
  const [asset, setAsset] = useState<VITAsset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assetId) {
      const foundAsset = vitAssets.find(a => a.id === assetId);
      if (foundAsset) {
        setAsset(foundAsset);
        setLoading(false);
      } else {
        toast.error("Asset not found");
        navigate("/asset-management/vit-inspection");
      }
    }
  }, [assetId, vitAssets, navigate]);

  const handleSubmit = () => {
    toast.success("Inspection submitted successfully");
    navigate(`/asset-management/vit-inspection-details/${assetId}`);
  };

  const handleCancel = () => {
    navigate(`/asset-management/vit-inspection-details/${assetId}`);
  };

  if (loading || !asset) {
    return (
      <AccessControlWrapper type="inspection">
        <Layout>
          <div className="container py-8">
            <p>Loading asset data...</p>
          </div>
        </Layout>
      </AccessControlWrapper>
    );
  }

  return (
    <AccessControlWrapper type="inspection">
      <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(`/asset-management/vit-inspection-details/${assetId}`)}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Asset Details
        </Button>
        
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New VIT Inspection</h1>
          <p className="text-muted-foreground mt-1">
            Complete the inspection checklist for {asset.serialNumber}
          </p>
        </div>
        
        <div className="bg-card text-card-foreground rounded-lg border shadow-sm">
          <VITInspectionForm
            onClose={handleCancel}
            onSuccess={handleSubmit}
            preSelectedAssetId={assetId}
          />
        </div>
      </div>
    </Layout>
    </AccessControlWrapper>
  );
} 