import { OverheadLineInspection } from "@/lib/types";
import { useData } from "@/contexts/DataContext";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PhotoService } from "@/services/PhotoService";

interface OverheadLineInspectionDetailsProps {
  inspection: OverheadLineInspection;
}

export function OverheadLineInspectionDetails({
  inspection,
}: OverheadLineInspectionDetailsProps) {
  const { regions, districts } = useData();

  const getRegionName = (regionId: string) => {
    const region = regions.find((r) => r.id === regionId);
    return region ? region.name : "Unknown";
  };

  const getDistrictName = (districtId: string) => {
    const district = districts.find((d) => d.id === districtId);
    return district ? district.name : "Unknown";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "in-progress":
        return <Badge className="bg-yellow-500">In Progress</Badge>;
      case "pending":
        return <Badge className="bg-gray-500">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Region</p>
            <p>{inspection.region || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">District</p>
            <p>{inspection.district || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Feeder Name</p>
            <p>{inspection.feederName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Voltage Level</p>
            <p>{inspection.voltageLevel}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Reference Pole</p>
            <p>{inspection.referencePole}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            {getStatusBadge(inspection.status)}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Created At</p>
            <p>{inspection.date 
              ? `${inspection.date}${inspection.time ? ` ${inspection.time}` : ''}`
              : inspection.createdAt && inspection.createdAt !== "" && !isNaN(new Date(inspection.createdAt).getTime())
              ? format(new Date(inspection.createdAt), "dd/MM/yyyy HH:mm")
              : new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
            <p>{inspection.updatedAt && inspection.updatedAt !== "" && !isNaN(new Date(inspection.updatedAt).getTime())
              ? format(new Date(inspection.updatedAt), "dd/MM/yyyy HH:mm")
              : new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Location</p>
            <p>{inspection.location || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pole Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pole ID</p>
            <p>{inspection.poleId}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pole Height</p>
            <p>{inspection.poleHeight}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pole Type</p>
            <p>{inspection.poleType}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ground Condition</p>
            <p>{inspection.groundCondition}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pole Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tilted</p>
              <p>{inspection.poleCondition?.tilted ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rotten</p>
              <p>{inspection.poleCondition?.rotten ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Burnt</p>
              <p>{inspection.poleCondition?.burnt ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Substandard</p>
              <p>{inspection.poleCondition?.substandard ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Conflict with LV</p>
              <p>{inspection.poleCondition?.conflictWithLV ? "Yes" : "No"}</p>
            </div>
          </div>
          {inspection.poleCondition?.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p>{inspection.poleCondition.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stay Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Required but not available</p>
              <p>{inspection.stayCondition?.requiredButNotAvailable ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cut</p>
              <p>{inspection.stayCondition?.cut ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Misaligned</p>
              <p>{inspection.stayCondition?.misaligned ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Defective Stay</p>
              <p>{inspection.stayCondition?.defectiveStay ? "Yes" : "No"}</p>
            </div>
          </div>
          {inspection.stayCondition?.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p>{inspection.stayCondition.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cross Arm Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Misaligned</p>
              <p>{inspection.crossArmCondition?.misaligned ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Bend</p>
              <p>{inspection.crossArmCondition?.bend ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Corroded</p>
              <p>{inspection.crossArmCondition?.corroded ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Substandard</p>
              <p>{inspection.crossArmCondition?.substandard ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Others</p>
              <p>{inspection.crossArmCondition?.others ? "Yes" : "No"}</p>
            </div>
          </div>
          {inspection.crossArmCondition?.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p>{inspection.crossArmCondition.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insulator Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Broken/Cracked</p>
              <p>{inspection.insulatorCondition?.brokenOrCracked ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Burnt/Flash over</p>
              <p>{inspection.insulatorCondition?.burntOrFlashOver ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Shattered</p>
              <p>{inspection.insulatorCondition?.shattered ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Defective Binding</p>
              <p>{inspection.insulatorCondition?.defectiveBinding ? "Yes" : "No"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Insulator Type</span>
            <span className="text-sm">{inspection.insulatorCondition?.insulatorType || 'N/A'}</span>
          </div>
          {inspection.insulatorCondition?.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p>{inspection.insulatorCondition.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conductor Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Loose Connectors</p>
              <p>{inspection.conductorCondition?.looseConnectors ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Weak Jumpers</p>
              <p>{inspection.conductorCondition?.weakJumpers ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Burnt Lugs</p>
              <p>{inspection.conductorCondition?.burntLugs ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sagged Line</p>
              <p>{inspection.conductorCondition?.saggedLine ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Undersized</p>
              <p>{inspection.conductorCondition?.undersized ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Linked</p>
              <p>{inspection.conductorCondition?.linked ? "Yes" : "No"}</p>
            </div>
          </div>
          {inspection.conductorCondition?.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p>{inspection.conductorCondition.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lightning Arrester Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Broken/Cracked</p>
              <p>{inspection.lightningArresterCondition?.brokenOrCracked ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Flash over</p>
              <p>{inspection.lightningArresterCondition?.flashOver ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Missing</p>
              <p>{inspection.lightningArresterCondition?.missing ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">No Earthing</p>
              <p>{inspection.lightningArresterCondition?.noEarthing ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">By-passed</p>
              <p>{inspection.lightningArresterCondition?.bypassed ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">No Arrester</p>
              <p>{inspection.lightningArresterCondition?.noArrester ? "Yes" : "No"}</p>
            </div>
            {inspection.lightningArresterCondition?.notes && (
              <div className="col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <p>{inspection.lightningArresterCondition.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Drop Out Fuse Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Broken/Cracked</p>
              <p>{inspection.dropOutFuseCondition?.brokenOrCracked ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Flash over</p>
              <p>{inspection.dropOutFuseCondition?.flashOver ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Insufficient Clearance</p>
              <p>{inspection.dropOutFuseCondition?.insufficientClearance ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Loose or No Earthing</p>
              <p>{inspection.dropOutFuseCondition?.looseOrNoEarthing ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Corroded</p>
              <p>{inspection.dropOutFuseCondition?.corroded ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Linked HV Fuses</p>
              <p>{inspection.dropOutFuseCondition?.linkedHVFuses ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Others</p>
              <p>{inspection.dropOutFuseCondition?.others ? "Yes" : "No"}</p>
            </div>
          </div>
          {inspection.dropOutFuseCondition?.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p>{inspection.dropOutFuseCondition.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transformer Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Leaking Oil</p>
              <p>{inspection.transformerCondition?.leakingOil ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Missing Earth leads</p>
              <p>{inspection.transformerCondition?.missingEarthLeads ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Linked HV Fuses</p>
              <p>{inspection.transformerCondition?.linkedHVFuses ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rusted Tank</p>
              <p>{inspection.transformerCondition?.rustedTank ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cracked Bushing</p>
              <p>{inspection.transformerCondition?.crackedBushing ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Others</p>
              <p>{inspection.transformerCondition?.others ? "Yes" : "No"}</p>
            </div>
          </div>
          {inspection.transformerCondition?.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p>{inspection.transformerCondition.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recloser Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Low Gas Level</p>
              <p>{inspection.recloserCondition?.lowGasLevel ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Low Battery Level</p>
              <p>{inspection.recloserCondition?.lowBatteryLevel ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Burnt Voltage Transformers</p>
              <p>{inspection.recloserCondition?.burntVoltageTransformers ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Protection Disabled</p>
              <p>{inspection.recloserCondition?.protectionDisabled ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">By-passed</p>
              <p>{inspection.recloserCondition?.bypassed ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Others</p>
              <p>{inspection.recloserCondition?.others ? "Yes" : "No"}</p>
            </div>
          </div>
          {inspection.recloserCondition?.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p>{inspection.recloserCondition.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">GPS</p>
              <p>{`${inspection.latitude}, ${inspection.longitude}`}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Additional Notes</p>
              <p>{inspection.additionalNotes || "No additional notes"}</p>
            </div>
          </div>
          {inspection.images && inspection.images.length > 0 && (
            <>
              <p className="text-sm font-medium text-muted-foreground">Images (Before Correction)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                                  {inspection.images.map((image, index) => (
                    <img key={index} src={PhotoService.getInstance().convertToProxyUrl(image)} alt={`Inspection image ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                  ))}
              </div>
            </>
          )}
          <p className="text-sm font-medium text-muted-foreground mt-4">After Inspection Correction Photos</p>
          {inspection.afterImages && inspection.afterImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                                {inspection.afterImages.map((image, index) => (
                    <img key={index} src={PhotoService.getInstance().convertToProxyUrl(image)} alt={`After Correction image ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                  ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No after-correction images available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 