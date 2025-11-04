import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useData } from "@/contexts/DataContext";
import { LoadMonitoringData } from "@/lib/asset-types";
import { LoggingService } from "@/services/LoggingService";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  regionId: z.string().min(1, "Region is required"),
  districtId: z.string().min(1, "District is required"),
  peakLoad: z.string().min(1, "Peak load is required"),
});

interface LoadMonitoringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: LoadMonitoringData | null;
  onSuccess: () => void;
}

export function LoadMonitoringDialog({
  open,
  onOpenChange,
  record,
  onSuccess,
}: LoadMonitoringDialogProps) {
  const { regions, districts, saveLoadMonitoringRecord, updateLoadMonitoringRecord } = useData();
  const { user } = useAzureADAuth();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: record?.date || new Date().toISOString().split("T")[0],
      regionId: record?.regionId || "",
      districtId: record?.districtId || "",
      peakLoad: record?.peakLoad?.toString() || "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (record) {
        // Log the edit action before updating
        await LoggingService.getInstance().logEditAction(
          user?.id || 'unknown',
          user?.name || 'unknown',
          user?.role || 'unknown',
          'load_monitoring',
          record.id,
          record, // old values
          { ...record, ...values }, // new values
          `Updated load monitoring record: ${record.substationName || record.substationNumber || record.id}`,
          record.region,
          record.district
        );

        await updateLoadMonitoringRecord(record.id, values);
        toast.success("Record updated successfully");
      } else {
        // Log the create action
        await LoggingService.getInstance().logAction(
          user?.id || 'unknown',
          user?.name || 'unknown',
          user?.role || 'unknown',
          'create',
          'load_monitoring',
          'unknown', // ID will be assigned by backend
          `Created new load monitoring record`,
          user?.region,
          user?.district
        );

        await saveLoadMonitoringRecord(values);
        toast.success("Record added successfully");
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving record:", error);
      toast.error("Failed to save record");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {record ? "Edit Load Monitoring Record" : "Add Load Monitoring Record"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="regionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Region" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="districtId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>District/Section</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select District" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {districts
                        .filter(
                          (district) =>
                            !form.getValues("regionId") ||
                            district.regionId === form.getValues("regionId")
                        )
                        .map((district) => (
                          <SelectItem key={district.id} value={district.id}>
                            {district.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="peakLoad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peak Load (MW)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {record ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 