import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { ReportDashboard } from '@/components/reports/ReportDashboard';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';

/**
 * Reports Page
 * 
 * Accessible by all authenticated users with role-based access:
 * - Admin: View and manage all reports
 * - Regional Admin: View and manage region reports
 * - District User: View and manage district reports
 */
export default function ReportsPage() {
  return (
    <AccessControlWrapper>
      <Layout>
        <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4 lg:px-6">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold">Report Management</h1>
            <p className="text-muted-foreground mt-1">
              Upload and manage weekly and monthly reports
            </p>
          </div>
          <ReportDashboard />
        </div>
      </Layout>
    </AccessControlWrapper>
  );
}

