import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SecondarySubstationInspection } from "@/lib/asset-types";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";
import { PhotoService } from '@/services/PhotoService';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Edit, 
  MapPin, 
  Calendar, 
  Clock, 
  Zap, 
  Hash, 
  Building2, 
  User, 
  FileText, 
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Layers
} from "lucide-react";

interface Props {
  inspection: SecondarySubstationInspection & { isOffline?: boolean; offlineId?: string; syncStatus?: string };
}

const checklistCategories = [
  { key: "siteCondition", label: "Site Condition" },
  { key: "transformer", label: "Transformer" },
  { key: "areaFuse", label: "Area Fuse" },
  { key: "arrestors", label: "Arrestors" },
  { key: "switchgear", label: "Switchgear" },
  { key: "distributionEquipment", label: "Distribution Equipment" },
  { key: "paintWork", label: "Paint Work" },
];

const getStatusBadge = (status: string) => {
  const statusLower = status?.toLowerCase() || '';
  if (statusLower === 'good' || statusLower === 'pass' || statusLower === 'ok') {
    return <Badge variant="default" className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Good</Badge>;
  } else if (statusLower === 'bad' || statusLower === 'fail' || statusLower === 'critical') {
    return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Requires Attention</Badge>;
  } else if (statusLower === 'fair' || statusLower === 'warning') {
    return <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50"><AlertCircle className="w-3 h-3 mr-1" />Fair</Badge>;
  }
  return <Badge variant="secondary">{status || 'N/A'}</Badge>;
};

export default function SecondarySubstationInspectionDetailsPage({ inspection }: Props) {
  const navigate = useNavigate();
  const [showFullImage, setShowFullImage] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/asset-management/inspection-management")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Inspections
          </Button>
          {inspection.isOffline && (
            <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50">
              <Layers className="w-3 h-3 mr-1" />
              Offline Inspection
            </Badge>
          )}
        </div>
        {!inspection.isOffline && (
          <Button
            onClick={() => navigate(`/asset-management/secondary-substation-inspection/${inspection.id}`)}
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Inspection
          </Button>
        )}
      </div>

      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Secondary Substation Inspection</h1>
        <p className="text-muted-foreground">
          Detailed inspection report for {inspection.substationName || inspection.substationNo}
        </p>
      </div>
      {/* Basic Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Basic Information
          </CardTitle>
          <CardDescription>Core details about the substation inspection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Region
                </Label>
                <p className="text-sm font-medium">{inspection.region}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  District/Section
                </Label>
                <p className="text-sm font-medium">{inspection.district}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Location
                </Label>
                <p className="text-sm font-medium">{inspection.location || "N/A"}</p>
              </div>
              {inspection.gpsLocation && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    GPS Coordinates
                  </Label>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inspection.gpsLocation)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1.5 group"
                  >
                    {inspection.gpsLocation}
                    <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </div>
              )}
            </div>

            {/* Middle Column */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  Substation Number
                </Label>
                <p className="text-sm font-medium">{inspection.substationNo}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Substation Name
                </Label>
                <p className="text-sm font-medium">{inspection.substationName}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Voltage Level
                </Label>
                <p className="text-sm font-medium">{inspection.voltageLevel || "N/A"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</Label>
                <Badge variant="secondary">Secondary</Badge>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Inspection Date
                </Label>
                <p className="text-sm font-medium">{inspection.date}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Inspection Time
                </Label>
                <p className="text-sm font-medium">{inspection.time || "N/A"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Inspected By
                </Label>
                <p className="text-sm font-medium">{inspection.inspectedBy}</p>
              </div>
              {inspection.status && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overall Status</Label>
                  <div>{getStatusBadge(inspection.status)}</div>
                </div>
              )}
              {inspection.updatedBy && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Updated By</Label>
                  <p className="text-sm font-medium">{inspection.updatedBy}</p>
                </div>
              )}
              {inspection.updatedAt && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Updated</Label>
                  <p className="text-sm font-medium">{new Date(inspection.updatedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Checklist Categories */}
      {checklistCategories.map(cat => {
        const items = (inspection as any)[cat.key];
        if (!items || items.length === 0) return null;
        
        return (
          <Card key={cat.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                {cat.label}
              </CardTitle>
              <CardDescription>
                {items.length} item{items.length !== 1 ? 's' : ''} inspected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item: any) => (
                  <div 
                    key={item.id} 
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-base mb-2">{item.name}</h4>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2.5 border-l-2 border-primary/20">
                            <span className="font-medium text-foreground">Remarks: </span>
                            {item.remarks}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {/* Additional Notes */}
      {inspection.remarks && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Additional Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-sm text-foreground whitespace-pre-line bg-muted/30 rounded-lg p-4 border">
              {inspection.remarks}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Before Photos Section */}
      {inspection.images && inspection.images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Before Inspection Photos
            </CardTitle>
            <CardDescription>
              {inspection.images.length} photo{inspection.images.length !== 1 ? 's' : ''} taken before inspection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {inspection.images.map((image, index) => (
                <div 
                  key={index} 
                  className="relative group aspect-square overflow-hidden rounded-lg border bg-muted cursor-pointer hover:border-primary transition-all hover:shadow-lg"
                  onClick={() => setShowFullImage(PhotoService.getInstance().convertToProxyUrl(image))}
                >
                  <img
                    src={PhotoService.getInstance().convertToProxyUrl(image)}
                    alt={`Before inspection image ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ImageIcon className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white font-medium">Photo {index + 1}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* After Photos Section */}
      {inspection.afterImages && inspection.afterImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              After Inspection Photos
            </CardTitle>
            <CardDescription>
              {inspection.afterImages.length} photo{inspection.afterImages.length !== 1 ? 's' : ''} taken after inspection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {inspection.afterImages.map((image, index) => (
                <div 
                  key={index} 
                  className="relative group aspect-square overflow-hidden rounded-lg border bg-muted cursor-pointer hover:border-primary transition-all hover:shadow-lg"
                  onClick={() => setShowFullImage(PhotoService.getInstance().convertToProxyUrl(image))}
                >
                  <img
                    src={PhotoService.getInstance().convertToProxyUrl(image)}
                    alt={`After inspection image ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ImageIcon className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white font-medium">Photo {index + 1}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Image Dialog */}
      <Dialog open={!!showFullImage} onOpenChange={(open) => !open && setShowFullImage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          {showFullImage && (
            <div className="relative">
              <img
                src={showFullImage}
                alt="Full size inspection image"
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 