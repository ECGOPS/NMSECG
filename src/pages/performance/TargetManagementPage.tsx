import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdminTargetManager } from '@/components/performance/AdminTargetManager';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';

/**
 * Target Management Page
 * 
 * Accessible by system admins and global engineers.
 * Allows users to set and manage performance targets.
 */
export default function TargetManagementPage() {
  return (
    <AccessControlWrapper requiredRoles={['system_admin', 'global_engineer']}>
      <Layout>
        <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4 lg:px-6">
          <AdminTargetManager />
        </div>
      </Layout>
    </AccessControlWrapper>
  );
}

