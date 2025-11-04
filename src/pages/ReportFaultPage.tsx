import React, { useState, useEffect } from 'react';
import { Layout } from "@/components/layout/Layout";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardList, User, Building2 } from "lucide-react";
import { OP5Form } from "@/components/faults/OP5Form";
import { Card, CardContent } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { PermissionService } from "@/services/PermissionService";

export default function ReportFaultPage() {
  const { isAuthenticated, user } = useAzureADAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  const { regions, districts } = useData();

  // Get default region and district based on user role
  let defaultRegionId = undefined;
  let defaultDistrictId = undefined;
  if (user) {
    if (user.role !== 'system_admin' && user.role !== 'global_engineer') {
      const userRegionDistrict = getUserRegionAndDistrict(user, regions, districts);
      defaultRegionId = userRegionDistrict.regionId;
      defaultDistrictId = userRegionDistrict.districtId;
    }
  }

  // Check if user has permission to report faults
  useEffect(() => {
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
  }, [user, navigate]);

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 md:space-y-8 max-w-[90rem] px-4 sm:px-6 md:px-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif">LV Outage Log</h1>
              <p className="text-muted-foreground">Create a new LV outage report</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {user?.role?.replace(/_/g, ' ').toUpperCase()}
              </Badge>
              <Avatar className="h-8 w-8">
                {/* No photoURL property available on User type, so only show fallback */}
                <AvatarFallback>
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        <Card className="border border-border/50 bg-card/50 shadow-sm">
          <CardContent className="p-6">
            <OP5Form 
              defaultRegionId={defaultRegionId || ""} 
              defaultDistrictId={defaultDistrictId || ""}
            />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
