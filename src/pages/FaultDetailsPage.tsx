import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useData } from "@/contexts/DataContext";
import { FaultService } from "@/services/FaultService";
import { Fault } from "@/types/fault";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { PermissionService } from "@/services/PermissionService";
import { LoggingService } from "@/services/LoggingService";
import { DeleteConfirmationDialog, useDeleteConfirmation } from "@/components/common/DeleteConfirmationDialog";

export default function FaultDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAzureADAuth();
  const { regions, districts } = useData();
  const [fault, setFault] = useState<Fault | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const permissionService = PermissionService.getInstance();
  const { isOpen, deleteItem, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteConfirmation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    // Check if user has permission to view faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }

    const fetchFault = async () => {
      if (!id) return;
      
      try {
        const faultData = await FaultService.getFaultById(id);
        setFault(faultData);
      } catch (err) {
        setError("Failed to load fault details");
        console.error("Error loading fault:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFault();
  }, [id, isAuthenticated, navigate, user]);

  const handleEdit = () => {
    if (!fault) return;
    
    // Check if user has permission to edit faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting_update')) {
      navigate("/unauthorized");
      return;
    }
    
    navigate(`/faults/${fault.id}/edit`);
  };

  const handleDelete = () => {
    if (!fault) return;
    
    // Check if user has permission to delete faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting_delete')) {
      navigate("/unauthorized");
      return;
    }
    
    // Open confirmation dialog
    const faultName = fault.faultType || fault.id;
    openDeleteDialog(fault.id, faultName, 'fault', fault);
  };

  const performDelete = async (id: string, data: any) => {
    const faultData = data as Fault;
    
    try {
      // Log the delete action before deleting
      await LoggingService.getInstance().logDeleteAction(
        user?.id || 'unknown',
        user?.name || 'unknown',
        user?.role || 'unknown',
        'fault',
        faultData.id,
        faultData, // deleted data
        `Deleted fault: ${faultData.faultType || faultData.id}`,
        faultData.region,
        faultData.district
      );

      await FaultService.deleteFault(faultData.id);
      navigate("/faults");
    } catch (err) {
      setError("Failed to delete fault");
      console.error("Error deleting fault:", err);
    }
  };

  if (!isAuthenticated || loading) {
    return null;
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-red-500">{error}</div>
        </div>
      </Layout>
    );
  }

  if (!fault) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div>Fault not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Fault Details</h1>
              <p className="text-muted-foreground mt-1">
                View and manage fault information
              </p>
            </div>
            <div className="flex gap-2">
              {permissionService.canAccessFeature(user?.role || '', 'fault_reporting_update') && (
                <Button onClick={handleEdit}>Edit Fault</Button>
              )}
              {permissionService.canAccessFeature(user?.role || '', 'fault_reporting_delete') && (
                <Button variant="destructive" onClick={handleDelete}>
                  Delete Fault
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fault Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Status</h3>
                  <Badge variant={fault.status === "open" ? "destructive" : "default"}>
                    {fault.status}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-semibold">Type</h3>
                  <p>{fault.type}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Region</h3>
                  <p>{regions.find(r => r.id === fault.regionId)?.name || "Unknown"}</p>
                </div>
                <div>
                  <h3 className="font-semibold">District</h3>
                  <p>{districts.find(d => d.id === fault.districtId)?.name || "Unknown"}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Reported By</h3>
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={fault.reportedBy.avatar} />
                      <AvatarFallback>
                        {fault.reportedBy.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span>{fault.reportedBy.name}</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">Reported At</h3>
                  <p>{format(new Date(fault.reportedAt), "PPpp")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{fault.description}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={isOpen}
        onClose={closeDeleteDialog}
        onConfirm={() => confirmDelete(performDelete)}
        title="Delete Fault"
        itemName={deleteItem?.name}
        itemType="fault"
        isLoading={isDeleting}
        warningMessage="This action cannot be undone. This will permanently delete the fault record and remove all associated data from the system."
      />
    </Layout>
  );
} 