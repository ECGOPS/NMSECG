import { SubstationInspection } from "@/lib/asset-types";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  XCircle,
  AlertCircle, 
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
  ExternalLink,
  Layers,
  Settings,
  Home,
  Gauge,
  Battery,
  Cloud
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PhotoService } from '@/services/PhotoService';

interface InspectionDetailsViewProps {
  inspection: SubstationInspection & { isOffline?: boolean; offlineId?: string; syncStatus?: string };
  showHeader?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
}

const checklistCategories = [
  { key: "siteCondition", label: "Site Condition", icon: MapPin },
  { key: "generalBuilding", label: "General Building", icon: Home },
  { key: "controlEquipment", label: "Control Equipment", icon: Settings },
  { key: "basement", label: "Basement", icon: Building2 },
  { key: "powerTransformer", label: "Power Transformer", icon: Zap },
  { key: "outdoorEquipment", label: "Outdoor Equipment", icon: Cloud },
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

export function InspectionDetailsView({
  inspection,
  showHeader = true,
  showBackButton = false,
  onBack,
  onEdit
}: InspectionDetailsViewProps) {
  const [showFullImage, setShowFullImage] = useState<string | null>(null);

  const getStatusSummary = () => {
    if (!inspection) return { good: 0, requiresAttention: 0, total: 0 };
    
    // Get all items from category-specific arrays
    const allItems = [
      ...(inspection.siteCondition || []),
      ...(inspection.generalBuilding || []),
      ...(inspection.controlEquipment || []),
      ...(inspection.powerTransformer || []),
      ...(inspection.outdoorEquipment || []),
      ...(inspection.basement || [])
    ].filter(item => item && item.status);
    
    const goodItems = allItems.filter(item => item.status === "good").length;
    const badItems = allItems.filter(item => item.status === "bad").length;
    
    return { good: goodItems, requiresAttention: badItems, total: allItems.length };
  };

  const statusSummary = getStatusSummary();

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header Section */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-4">
            {showBackButton && onBack && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Inspections
              </Button>
            )}
            {inspection.isOffline && (
              <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50">
                <Layers className="w-3 h-3 mr-1" />
                Offline Inspection
              </Badge>
            )}
          </div>
          {onEdit && (
            <Button onClick={onEdit} className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Edit Inspection
            </Button>
          )}
        </div>
      )}

      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {inspection.type === "indoor" ? "Indoor" : "Outdoor"} Substation Inspection
        </h1>
        <p className="text-muted-foreground">
          Detailed inspection report for {inspection.substationName || inspection.substationNo}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 border shadow-sm hover:shadow-md transition-all duration-200 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-blue-700 dark:text-blue-300">Total Items</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{statusSummary.total}</div>
          </CardContent>
        </Card>
        <Card className="p-4 border shadow-sm hover:shadow-md transition-all duration-200 bg-green-50/50 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-green-700 dark:text-green-300">Good Condition</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{statusSummary.good}</div>
          </CardContent>
        </Card>
        <Card className="p-4 border shadow-sm hover:shadow-md transition-all duration-200 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-red-700 dark:text-red-300">Requires Attention</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{statusSummary.requiresAttention}</div>
          </CardContent>
        </Card>
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
              {inspection.location && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Location
                  </Label>
                  <p className="text-sm font-medium">{inspection.location}</p>
                </div>
              )}
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
                <p className="text-sm font-medium">{inspection.substationName || "N/A"}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</Label>
                <Badge variant="secondary" className="capitalize">{inspection.type}</Badge>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Voltage Level
                </Label>
                <p className="text-sm font-medium">{inspection.voltageLevel || "N/A"}</p>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Inspection Date
                </Label>
                <p className="text-sm font-medium">
                  {inspection.date && !isNaN(new Date(inspection.date).getTime()) 
                    ? format(new Date(inspection.date), "PPP") 
                    : inspection.date || "N/A"}
                </p>
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
                <p className="text-sm font-medium">{inspection.inspectedBy || inspection.createdBy || "N/A"}</p>
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
        
        const Icon = cat.icon;
        return (
          <Card key={cat.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
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