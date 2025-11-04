import React, { useEffect, useState } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { VITAsset } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { apiRequest } from '@/lib/api';
import { Eye, Edit, MapPin, Zap } from 'lucide-react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LocationMap } from "./LocationMap";
import { PhotoService } from '@/services/PhotoService';
import { SafeText } from '@/components/ui/safe-display';

const formatDate = (timestamp: any) => {
  if (!timestamp) return "Not available";
  
  // Handle Firestore timestamp
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleString();
  }
  
  // Handle string date
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) ? date.toLocaleString() : "Invalid date";
};

interface AssetInfoCardProps {
  asset: VITAsset;
  getRegionName: (id: string) => string;
  getDistrictName: (id: string) => string;
}

export const AssetInfoCard = ({ asset, getRegionName, getDistrictName }: AssetInfoCardProps) => {
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const { users } = useAzureADAuth();
  const [creatorName, setCreatorName] = useState<string>(asset.createdBy || "Unknown");

  useEffect(() => {
    if (!asset?.createdBy) {
      setCreatorName("Unknown");
      return;
    }
    const found = (users || []).find(u => u.id === asset.createdBy || u.uid === asset.createdBy || u.email === asset.createdBy);
    if (found) {
      setCreatorName(found.name || found.displayName || found.email || asset.createdBy);
    } else {
      setCreatorName(asset.createdBy);
    }
  }, [asset?.createdBy, users]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-semibold">Region</h3>
              <p><SafeText content={asset.region} /></p>
            </div>
            <div>
              <h3 className="font-semibold">District</h3>
              <p><SafeText content={asset.district} /></p>
            </div>
            <div>
              <h3 className="font-semibold">Feeder Name</h3>
              <p><SafeText content={asset.feederName || "Not specified"} /></p>
            </div>
            <div>
              <h3 className="font-semibold">Voltage Level</h3>
              <p><SafeText content={asset.voltageLevel} /></p>
            </div>
            <div>
              <h3 className="font-semibold">Type of Unit</h3>
              <p><SafeText content={asset.typeOfUnit} /></p>
            </div>
            <div>
              <h3 className="font-semibold">Serial Number</h3>
              <p><SafeText content={asset.serialNumber} /></p>
            </div>
            <div>
              <h3 className="font-semibold">Location</h3>
              <p><SafeText content={asset.location} /></p>
            </div>
            <div>
              <h3 className="font-semibold">GPS Coordinates</h3>
              <p><SafeText content={asset.gpsCoordinates || "Not specified"} /></p>
            </div>
            <div>
              <h3 className="font-semibold">Status</h3>
              <p><SafeText content={asset.status} /></p>
            </div>
            <div>
              <h3 className="font-semibold">Protection</h3>
              <p><SafeText content={asset.protection || "Not specified"} /></p>
            </div>
            <div>
              <h3 className="font-semibold">Created By</h3>
              <p>{creatorName || "Unknown"}</p>
            </div>
            <div>
              <h3 className="font-semibold">Created At</h3>
              <p>{formatDate(asset.createdAt)}</p>
            </div>
            <div>
              <h3 className="font-semibold">Last Updated</h3>
              <p>{formatDate(asset.updatedAt)}</p>
            </div>
          </div>

          {asset.gpsCoordinates && asset.gpsCoordinates.trim() !== '' && (
            <div className="mt-6">
              <p className="text-sm font-medium text-muted-foreground mb-2">Location Map</p>
              <LocationMap 
                coordinates={asset.gpsCoordinates} 
                assetName={`${asset.typeOfUnit} - ${asset.serialNumber}`} 
              />
            </div>
          )}
          
          {!asset.gpsCoordinates && (
            <div className="mt-6 p-4 bg-muted/50 rounded-md">
              <p className="text-sm text-muted-foreground">No location data available for this asset.</p>
            </div>
          )}
          
          {asset.photoUrl && (
            <div className="mt-6">
              <p className="text-sm font-medium text-muted-foreground mb-2">Asset Photo</p>
              <img 
                src={PhotoService.getInstance().convertToProxyUrl(asset.photoUrl)} 
                alt={`${asset.typeOfUnit} - ${asset.serialNumber}`}
                className="w-full h-auto rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setIsPhotoDialogOpen(true)}
              />
            </div>
          )}

          <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
            <DialogContent className="max-w-4xl">
              {asset.photoUrl && (
                <img 
                  src={PhotoService.getInstance().convertToProxyUrl(asset.photoUrl)} 
                  alt={`${asset.typeOfUnit} - ${asset.serialNumber}`}
                  className="w-full h-auto rounded-md"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};