import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { RegionalPerformanceView } from '@/components/performance/RegionalPerformanceView';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';

/**
 * Regional Performance Page
 * 
 * Accessible by:
 * - System Admins
 * - Global Engineers
 * - Regional Engineers
 * - Regional General Managers
 * 
 * Displays performance metrics for all districts in a region.
 */
export default function RegionalPerformancePage() {
  return (
    <AccessControlWrapper requiredRoles={['system_admin', 'global_engineer', 'regional_engineer', 'regional_general_manager']}>
      <Layout>
        <div className="container mx-auto py-6">
          <RegionalPerformanceView />
        </div>
      </Layout>
    </AccessControlWrapper>
  );
}

