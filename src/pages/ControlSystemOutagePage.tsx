import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ControlSystemOutageForm } from '@/components/faults/ControlSystemOutageForm';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getUserRegionAndDistrict } from '@/utils/user-utils';
import { PermissionService } from '@/services/PermissionService';
import { Loader2 } from 'lucide-react';

export default function ControlSystemOutagePage() {
  const { regions, districts, regionsLoading, districtsLoading } = useData();
  const { user, isAuthenticated } = useAzureADAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();

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

  if (regionsLoading || districtsLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 md:space-y-8 max-w-[90rem] px-4 sm:px-6 md:px-8">
          <Card className="border border-border/50 bg-card/50 shadow-sm">
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading regions and districts...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 md:space-y-8 max-w-[90rem] px-4 sm:px-6 md:px-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif">HT Outage Log</h1>
              <p className="text-muted-foreground">Report HT outages and equipment failures</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {user?.role?.replace(/_/g, ' ').toUpperCase()}
              </Badge>
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        <Card className="border border-border/50 bg-card/50 shadow-sm">
          <CardContent className="p-6">
            <ControlSystemOutageForm 
              defaultRegionId={defaultRegionId || ""} 
              defaultDistrictId={defaultDistrictId || ""}
            />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
