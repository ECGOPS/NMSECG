import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { DistrictPerformanceCard } from '@/components/performance/DistrictPerformanceCard';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';

/**
 * District Performance Page
 * 
 * Accessible by:
 * - System Admins
 * - Global Engineers
 * - District Engineers
 * - District Managers
 * - Technicians
 * 
 * Displays performance metrics for the logged-in user's district.
 */
export default function DistrictPerformancePage() {
  return (
    <AccessControlWrapper requiredRoles={['system_admin', 'global_engineer', 'district_engineer', 'district_manager', 'technician']}>
      <Layout>
        <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4 lg:px-6">
          <DistrictPerformanceCard />
        </div>
      </Layout>
    </AccessControlWrapper>
  );
}

