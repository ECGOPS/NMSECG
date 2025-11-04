import { ColumnDef } from "@tanstack/react-table";
import { LoadMonitoringData } from "@/lib/asset-types";
import { Button } from "@/components/ui/button";
import { Edit, Trash } from "lucide-react";
import { format } from "date-fns";

export const columns: ColumnDef<LoadMonitoringData>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => {
      const date = row.getValue("date") as string;
      return format(new Date(date), "yyyy-MM-dd");
    },
  },
  {
    accessorKey: "regionId",
    header: "Region",
    cell: ({ row }) => {
      const regionId = row.getValue("regionId") as string;
      // You'll need to get the region name from your context
      return regionId;
    },
  },
  {
    accessorKey: "districtId",
    header: "District",
    cell: ({ row }) => {
      const districtId = row.getValue("districtId") as string;
      // You'll need to get the district name from your context
      return districtId;
    },
  },
  {
    accessorKey: "peakLoad",
    header: "Peak Load (MW)",
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const record = row.original;
      const meta = table.options.meta as {
        onEdit?: (record: LoadMonitoringData) => void;
        onDelete?: (record: LoadMonitoringData) => void;
      };

      return (
        <div className="flex items-center gap-2">
          {meta.onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => meta.onEdit?.(record)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {meta.onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => meta.onDelete?.(record)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    },
  },
]; 