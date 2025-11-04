import { Clock } from "lucide-react";
import { OP5Fault } from "@/lib/types";
import { calculateOutageDuration } from "@/lib/calculations";
import { formatDuration } from "@/utils/calculations";

interface OP5FaultCardProps {
  fault: {
    id: string;
    status: "pending" | "resolved";
    faultType: string;
    occurrenceDate: string;
    restorationDate?: string;
    faultLocation: string;
  };
}

export function OP5FaultCard({ fault }: OP5FaultCardProps) {
  const duration = calculateOutageDuration(fault.occurrenceDate, fault.restorationDate || new Date().toISOString());
  const formattedDuration = formatDuration(duration); // Duration is already in hours

  return (
    <div className="bg-card rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{fault.faultType}</h3>
        <span className={`px-2 py-1 rounded-full text-xs ${
          fault.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
        }`}>
          {fault.status}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Duration: {formattedDuration}
          </span>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Location: {fault.faultLocation}
        </div>
      </div>
    </div>
  );
} 