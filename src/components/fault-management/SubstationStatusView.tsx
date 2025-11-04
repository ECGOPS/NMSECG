import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubstationStatus } from "@/lib/types";
import { PhotoDisplay } from "@/components/common/PhotoDisplay";
import { MapPin, Calendar, Clock, User, Database, Zap, Shield, Wrench } from "lucide-react";

interface SubstationStatusViewProps {
  substationStatus: SubstationStatus;
  className?: string;
}

export function SubstationStatusView({ substationStatus, className = "" }: SubstationStatusViewProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Substation Status Inspection</CardTitle>
              <CardDescription>
                {substationStatus.substationName} - {substationStatus.substationNumber}
              </CardDescription>
            </div>
            <Badge className={getStatusColor(substationStatus.status)}>
              {substationStatus.status.replace('-', ' ').toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Date:</span> {formatDate(substationStatus.date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Time:</span> {formatTime(substationStatus.time)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Inspector:</span> {substationStatus.inspector.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Region:</span> {substationStatus.region}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">District:</span> {substationStatus.district}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Rating:</span> {substationStatus.rating}
              </span>
            </div>
            {substationStatus.updatedBy && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">Last Updated By:</span> {substationStatus.updatedBy}
                </span>
              </div>
            )}
            {substationStatus.updatedAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">Last Updated:</span> {new Date(substationStatus.updatedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* GPS Coordinates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium">Latitude:</span>
              <span className="ml-2 text-sm text-muted-foreground">
                {substationStatus.latitude.toFixed(6)}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium">Longitude:</span>
              <span className="ml-2 text-sm text-muted-foreground">
                {substationStatus.longitude.toFixed(6)}
              </span>
            </div>
          </div>

          {substationStatus.location && (
            <div>
              <span className="text-sm font-medium">Location Description:</span>
              <p className="text-sm text-muted-foreground mt-1">{substationStatus.location}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transformer Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Transformer Conditions
          </CardTitle>
          <CardDescription>Assessment of transformer status and conditions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium">Name Plate:</span>
              <Badge variant={substationStatus.transformerConditions.namePlate ? "default" : "secondary"} className="ml-2">
                {substationStatus.transformerConditions.namePlate ? "Present" : "Missing"}
              </Badge>
            </div>
            <div>
              <span className="text-sm font-medium">Oil Leakage:</span>
              <Badge 
                variant={substationStatus.transformerConditions.oilLeakage === "yes" ? "destructive" : "default"} 
                className="ml-2"
              >
                {substationStatus.transformerConditions.oilLeakage === "yes" ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <span className="text-sm font-medium">Bushing Condition:</span>
              <Badge 
                variant={
                  substationStatus.transformerConditions.bushing === "intact" ? "default" : "destructive"
                } 
                className="ml-2"
              >
                {substationStatus.transformerConditions.bushing.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>

          {substationStatus.transformerConditions.notes && (
            <div>
              <span className="text-sm font-medium">Notes:</span>
              <p className="text-sm text-muted-foreground mt-1">{substationStatus.transformerConditions.notes}</p>
            </div>
          )}

          {/* Name Plate Photos */}
          {substationStatus.transformerConditions.namePlatePhotos && substationStatus.transformerConditions.namePlatePhotos.length > 0 && (
            <PhotoDisplay
              title="Name Plate Photos"
              description="Photos documenting the name plate details"
              photos={substationStatus.transformerConditions.namePlatePhotos}
              section="name plate"
              showTitle={false}
            />
          )}

          {/* Transformer Conditions Photos */}
          {substationStatus.transformerConditions.photos && substationStatus.transformerConditions.photos.length > 0 && (
            <PhotoDisplay
              title="Transformer Conditions Photos"
              description="Photos documenting transformer conditions and oil leakage"
              photos={substationStatus.transformerConditions.photos}
              section="transformer conditions"
              showTitle={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Fuse Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Fuse Conditions
          </CardTitle>
          <CardDescription>Assessment of fuse status and holder conditions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
               <span className="text-sm font-medium">Fuse Status:</span>
               <Badge variant="outline" className="ml-2">
                 {substationStatus.fuseConditions.fuseType.toUpperCase()}
               </Badge>
             </div>
            <div>
              <span className="text-sm font-medium">Fuse Holder:</span>
              <Badge 
                variant={
                  substationStatus.fuseConditions.fuseHolder === "intact" ? "default" : "destructive"
                } 
                className="ml-2"
              >
                {substationStatus.fuseConditions.fuseHolder.toUpperCase()}
              </Badge>
            </div>
          </div>

          {substationStatus.fuseConditions.notes && (
            <div>
              <span className="text-sm font-medium">Notes:</span>
              <p className="text-sm text-muted-foreground mt-1">{substationStatus.fuseConditions.notes}</p>
            </div>
          )}

          {/* Fuse Conditions Photos */}
          {substationStatus.fuseConditions.photos && substationStatus.fuseConditions.photos.length > 0 && (
            <PhotoDisplay
              title="Fuse Conditions Photos"
              description="Photos documenting fuse conditions and holder status"
              photos={substationStatus.fuseConditions.photos}
              section="fuse conditions"
              showTitle={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Earthing Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Earthing Conditions
          </CardTitle>
          <CardDescription>Assessment of earthing system status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="text-sm font-medium">Earthing Status:</span>
            <Badge 
              variant={
                substationStatus.earthingConditions.earthingStatus === "intact" ? "default" : "destructive"
              } 
              className="ml-2"
            >
              {substationStatus.earthingConditions.earthingStatus.toUpperCase()}
            </Badge>
          </div>

          {substationStatus.earthingConditions.notes && (
            <div>
              <span className="text-sm font-medium">Notes:</span>
              <p className="text-sm text-muted-foreground mt-1">{substationStatus.earthingConditions.notes}</p>
            </div>
          )}

          {/* Earthing Conditions Photos */}
          {substationStatus.earthingConditions.photos && substationStatus.earthingConditions.photos.length > 0 && (
            <PhotoDisplay
              title="Earthing Conditions Photos"
              description="Photos documenting earthing system status"
              photos={substationStatus.earthingConditions.photos}
              section="earthing conditions"
              showTitle={false}
            />
          )}
        </CardContent>
      </Card>

      {/* General Notes */}
      {substationStatus.generalNotes && (
        <Card>
          <CardHeader>
            <CardTitle>General Notes</CardTitle>
            <CardDescription>Additional observations and recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{substationStatus.generalNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* General Photos */}
      {substationStatus.images && substationStatus.images.length > 0 && (
        <PhotoDisplay
          title="General Inspection Photos"
          description="Photos documenting the overall inspection"
          photos={substationStatus.images}
          section="general inspection"
        />
      )}

      {/* After Images */}
      {substationStatus.afterImages && substationStatus.afterImages.length > 0 && (
        <PhotoDisplay
          title="After Inspection Photos"
          description="Photos taken after completion of work"
          photos={substationStatus.afterImages}
          section="after inspection"
        />
      )}
    </div>
  );
}
