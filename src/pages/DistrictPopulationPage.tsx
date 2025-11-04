import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DistrictPopulationForm } from '@/components/user-management/DistrictPopulationForm';
import { DistrictPopulationReset } from '@/components/admin/DistrictPopulationReset';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { PermissionService } from '@/services/PermissionService';

export default function DistrictPopulationPage() {
  const { user } = useAzureADAuth();
  const permissionService = PermissionService.getInstance();
  const canResetPopulation = permissionService.canResetDistrictPopulation(user?.role || null);

  return (
    <AccessControlWrapper type="district_population">
      <Layout>
        <div className="container py-8">
          <h1 className="text-3xl font-bold tracking-tight">District Population Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage population data for districts
          </p>
          <div className="mt-6 space-y-6">
            {canResetPopulation && <DistrictPopulationReset />}
            <DistrictPopulationForm />
          </div>
        </div>
      </Layout>
    </AccessControlWrapper>
  );
} 