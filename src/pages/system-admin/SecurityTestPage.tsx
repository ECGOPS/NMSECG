import React, { useState, useEffect } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { PermissionService } from '@/services/PermissionService';
import { UserRole } from '@/lib/types';
import { toast } from '@/components/ui/sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Layout } from "@/components/layout/Layout";
import { HeaderTest } from "@/components/HeaderTest";
import { PageHeader } from "@/components/ui/page-header";

export default function SecurityTestPage() {
  const { user } = useAzureADAuth();
  const permissionService = PermissionService.getInstance();
  const [selectedRole, setSelectedRole] = useState<UserRole>('technician');
  const [selectedFeature, setSelectedFeature] = useState('asset_management');
  const [featurePermissions, setFeaturePermissions] = useState<{ [key: string]: UserRole[] }>({});

  // Available roles for testing
  const roles: UserRole[] = [
    'technician',
    'district_engineer',
    'district_manager',
    'regional_engineer',
    'regional_general_manager',
    'global_engineer',
    'system_admin'
  ];

  // Features to test
  const features = [
    'asset_management',
    'inspection_management',
    'load_monitoring',
    'user_management',
    'system_configuration'
  ];

  // Load current permissions
  useEffect(() => {
    const permissions = permissionService.getFeaturePermissions();
    setFeaturePermissions(permissions);
  }, []);

  // Test role hierarchy
  const testRoleHierarchy = () => {
    const hasAccess = permissionService.hasRequiredRole(selectedRole, user?.role || 'technician');
    toast[hasAccess ? 'success' : 'error'](
      `Role ${selectedRole} ${hasAccess ? 'has' : 'does not have'} required access level`
    );
  };

  // Test feature access
  const testFeatureAccess = () => {
    const hasAccess = permissionService.canAccessFeature(selectedRole, selectedFeature);
    toast[hasAccess ? 'success' : 'error'](
      `Role ${selectedRole} ${hasAccess ? 'can' : 'cannot'} access feature: ${selectedFeature}`
    );
  };

  // Test asset management permissions
  const testAssetPermissions = () => {
    const canView = permissionService.canViewAsset(
      selectedRole,
      'Region 1',
      'District 1',
      'Region 1',
      'District 1'
    );
    const canEdit = permissionService.canEditAsset(
      selectedRole,
      'Region 1',
      'District 1',
      'Region 1',
      'District 1'
    );
    const canDelete = permissionService.canDeleteAsset(
      selectedRole,
      'Region 1',
      'District 1',
      'Region 1',
      'District 1'
    );

    toast.info(
      `Asset Permissions for ${selectedRole}:\n` +
      `View: ${canView ? '✅' : '❌'}\n` +
      `Edit: ${canEdit ? '✅' : '❌'}\n` +
      `Delete: ${canDelete ? '✅' : '❌'}`
    );
  };

  // Test staff management permissions
  const testStaffPermissions = () => {
    const canManageStaff = permissionService.canManageStaffIds(selectedRole);
    const canManageDistrict = permissionService.canManageDistrictPopulation(selectedRole);

    toast.info(
      `Staff Management Permissions for ${selectedRole}:\n` +
      `Manage Staff IDs: ${canManageStaff ? '✅' : '❌'}\n` +
      `Manage District Population: ${canManageDistrict ? '✅' : '❌'}`
    );
  };

  return (
    <Layout>
      <PageHeader 
        title="Security Testing"
        description="Test various security aspects of the application"
      />
      <div className="container mx-auto py-6">
        <HeaderTest />
        <h1 className="text-3xl font-bold mb-6">Permission Testing Dashboard</h1>

        {/* Feature List Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Available Features and Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Allowed Roles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Asset Management</TableCell>
                  <TableCell>Manage and monitor system assets</TableCell>
                  <TableCell>
                    {featurePermissions['asset_management']?.map((role) => (
                      <Badge key={role} variant="outline" className="mr-2">
                        {role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    ))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Inspection Management</TableCell>
                  <TableCell>Handle system inspections and reports</TableCell>
                  <TableCell>
                    {featurePermissions['inspection_management']?.map((role) => (
                      <Badge key={role} variant="outline" className="mr-2">
                        {role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    ))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Load Monitoring</TableCell>
                  <TableCell>Monitor system load and performance</TableCell>
                  <TableCell>
                    {featurePermissions['load_monitoring']?.map((role) => (
                      <Badge key={role} variant="outline" className="mr-2">
                        {role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    ))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">User Management</TableCell>
                  <TableCell>Manage system users and roles</TableCell>
                  <TableCell>
                    {featurePermissions['user_management']?.map((role) => (
                      <Badge key={role} variant="outline" className="mr-2">
                        {role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    ))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">System Configuration</TableCell>
                  <TableCell>Configure system settings and permissions</TableCell>
                  <TableCell>
                    {featurePermissions['system_configuration']?.map((role) => (
                      <Badge key={role} variant="outline" className="mr-2">
                        {role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    ))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Select Role to Test</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Select Feature to Test</Label>
              <Select value={selectedFeature} onValueChange={setSelectedFeature}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a feature" />
                </SelectTrigger>
                <SelectContent>
                  {features.map((feature) => (
                    <SelectItem key={feature} value={feature}>
                      {feature.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Role Hierarchy Tests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testRoleHierarchy}
                className="w-full"
                variant="outline"
              >
                Test Role Hierarchy
              </Button>
              <Button 
                onClick={testFeatureAccess}
                className="w-full"
                variant="outline"
              >
                Test Feature Access
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permission Tests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testAssetPermissions}
                className="w-full"
                variant="outline"
              >
                Test Asset Permissions
              </Button>
              <Button 
                onClick={testStaffPermissions}
                className="w-full"
                variant="outline"
              >
                Test Staff Permissions
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current User Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto">
              {JSON.stringify(user, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}