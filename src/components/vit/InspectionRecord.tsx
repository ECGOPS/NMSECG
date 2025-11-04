import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Edit, Download, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { VITInspectionChecklist, VITAsset } from "@/lib/types";
import { formatDate } from "@/utils/calculations";
import { InspectionChecklistItem } from "./InspectionChecklistItem";
import { toast } from "@/components/ui/sonner";
import { exportInspectionToCsv, exportInspectionToPDF } from "@/utils/pdfExport";

type InspectionRecordProps = {
  inspection: VITInspectionChecklist;
  asset: VITAsset | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  getRegionName: (id: string) => string;
  getDistrictName: (id: string) => string;
};

export const InspectionRecord = ({ 
  inspection, 
  asset, 
  onEdit, 
  onDelete, 
  getRegionName,
  getDistrictName 
}: InspectionRecordProps) => {
  
  const handleExportToCsv = () => {
    exportInspectionToCsv(inspection, asset, getRegionName, getDistrictName);
  };
  
  const handleExportToPdf = async () => {
    try {
      await exportInspectionToPDF(inspection, asset, getRegionName, getDistrictName);
      toast.success("Comprehensive report generated successfully");
    } catch (error) {
      toast.error("Failed to generate PDF report");
      console.error("Error generating PDF:", error);
    }
  };
  
  // Helper function to determine if a value represents a positive status
  const isGoodValue = (value: string, key: string): boolean => {
    if (key === 'rodentTermiteEncroachment' || key === 'batteryPowerLow' || key === 'gasLevelLow') {
      return value === "No";
    } else if (key === 'silicaGelCondition') {
      return value === "Good";
    } else {
      return value === "Yes";
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium">
            Inspection on {formatDate(inspection.inspectionDate)}
          </h3>
          <p className="text-sm text-muted-foreground">
            Conducted by {inspection.inspectedBy}
          </p>
        </div>
        
        <div className="mt-2 md:mt-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-sm font-semibold">Actions</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(inspection.id)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportToCsv}>
                <Download className="mr-2 h-4 w-4" />
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportToPdf}>
                <FileText className="mr-2 h-4 w-4" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600"
                onClick={() => onDelete(inspection.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="text-sm font-medium mb-2">General Condition</h4>
          <ul className="space-y-2">
            <InspectionChecklistItem 
              label="Rodent/Termite Encroachment" 
              value={inspection.rodentTermiteEncroachment} 
              isPositive={(val) => val === "No"} 
            />
            <InspectionChecklistItem 
              label="Clean & Dust Free" 
              value={inspection.cleanDustFree} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="Silica Gel Condition" 
              value={inspection.silicaGelCondition} 
              isPositive={(val) => val === "Good"} 
            />
            <InspectionChecklistItem 
              label="No Corrosion" 
              value={inspection.noCorrosion} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="Paintwork Adequate" 
              value={inspection.paintworkAdequate} 
              isPositive={(val) => val === "Yes"} 
            />
          </ul>
        </div>
        
        <div>
          <h4 className="text-sm font-medium mb-2">Operational Status</h4>
          <ul className="space-y-2">
            <InspectionChecklistItem 
              label="Protection Button Enabled" 
              value={inspection.protectionButtonEnabled} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="Recloser Button Enabled" 
              value={inspection.recloserButtonEnabled} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="AC Power On" 
              value={inspection.acPowerOn} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="Battery Power Low" 
              value={inspection.batteryPowerLow} 
              isPositive={(val) => val === "No"} 
            />
            <InspectionChecklistItem 
              label="Remote Button Enabled" 
              value={inspection.remoteButtonEnabled} 
              isPositive={(val) => val === "Yes"} 
            />
          </ul>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Safety & Protection</h4>
          <ul className="space-y-2">
            <InspectionChecklistItem 
              label="Ground/Earth Button Enabled" 
              value={inspection.groundEarthButtonEnabled} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="Handle Lock On" 
              value={inspection.handleLockOn} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="Earthing Arrangement Adequate" 
              value={inspection.earthingArrangementAdequate} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="Gas Level Low" 
              value={inspection.gasLevelLow} 
              isPositive={(val) => val === "No"} 
            />
            <InspectionChecklistItem 
              label="Correct Labelling" 
              value={inspection.correctLabelling} 
              isPositive={(val) => val === "Yes"} 
            />
          </ul>
        </div>
        
        <div>
          <h4 className="text-sm font-medium mb-2">Component Condition</h4>
          <ul className="space-y-2">
            <InspectionChecklistItem 
              label="No Fuses Blown" 
              value={inspection.noFusesBlown} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="No Damage to Bushings" 
              value={inspection.noDamageToBushings} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="No Damage to HV Connections" 
              value={inspection.noDamageToHVConnections} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="Insulators Clean" 
              value={inspection.insulatorsClean} 
              isPositive={(val) => val === "Yes"} 
            />
            <InspectionChecklistItem 
              label="PT Fuse Link Intact" 
              value={inspection.ptFuseLinkIntact} 
              isPositive={(val) => val === "Yes"} 
            />
          </ul>
        </div>
      </div>
      
      {inspection.remarks && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Remarks</h4>
          <p className="text-sm bg-muted/50 p-3 rounded-md">{inspection.remarks}</p>
        </div>
      )}
    </div>
  );
};
