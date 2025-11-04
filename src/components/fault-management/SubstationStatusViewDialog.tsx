import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { SubstationStatus } from "@/lib/types";
import { SubstationStatusView } from "./SubstationStatusView";

interface SubstationStatusViewDialogProps {
  substationStatus: SubstationStatus | null;
  isOpen: boolean;
  onClose: () => void;
  regions?: { id: string; name: string }[];
  districts?: { id: string; name: string; regionId: string }[];
}

export function SubstationStatusViewDialog({
  substationStatus,
  isOpen,
  onClose,
  regions = [],
  districts = []
}: SubstationStatusViewDialogProps) {
  if (!substationStatus) return null;



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Substation Status Details
          </DialogTitle>
          <DialogDescription>
            Comprehensive view of substation inspection and status information
          </DialogDescription>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <SubstationStatusView 
          substationStatus={substationStatus}
          className="pb-4"
        />

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
