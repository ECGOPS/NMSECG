import React, { useState, useEffect } from 'react';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { PermissionService } from '@/services/PermissionService';
import { DynamicRoleService, DynamicRole } from '@/services/DynamicRoleService';
import { MapPin, Shield, Users, Building, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function RegionBasedAccessDemo() {
  const { user } = useAzureADAuth();
  const { regions, districts } = useData();
  const [roles, setRoles] = useState<DynamicRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [testResults, setTestResults] = useState<any>(null);
  
  const permissionService = PermissionService.getInstance();
  const dynamicRoleService = DynamicRoleService.getInstance();

  useEffect(() => {
    if (user) {
      loadRoles();
    }
  }, [user]);

  const loadRoles = async () => {
    try {
      const rolesData = await dynamicRoleService.getRoles(true);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error loading roles:', error);
      toast.error('Failed to load roles');
    }
  };

  const runAccessTest = async () => {
    if (!selectedRole || !selectedRegion) {
      toast.error('Please select both a role and region');
      return;
    }

    try {
      const role = roles.find(r => r.id === selectedRole);
      if (!role) {
        toast.error('Role not found');
        return;
      }

      const results = {
        role: role.displayName || role.name,
        region: regions.find(r => r.id === selectedRegion)?.name || selectedRegion,
        district: selectedDistrict ? districts.find(d => d.id === selectedDistrict)?.name || selectedDistrict : 'N/A',
        tests: {
          canAccessRegion: permissionService.canAccessRegion(role.name, selectedRegion),
          canAccessDistrict: selectedDistrict ? permissionService.canAccessDistrict(role.name, selectedDistrict) : 'N/A',
          canAccessFeature: await permissionService.canAccessFeature(role.name, 'asset_management'),
          canAccessFeatureInRegion: await permissionService.canAccessFeatureInRegion(role.name, 'asset_management', selectedRegion),
          canAccessFeatureInDistrict: selectedDistrict ? 
            await permissionService.canAccessFeatureInDistrict(role.name, 'asset_management', selectedDistrict) : 'N/A'
        },
        roleDetails: {
          accessLevel: role.accessLevel || 'global',
          allowedRegions: role.allowedRegions || [],
          allowedDistricts: role.allowedDistricts || [],
          priority: role.priority,
          permissions: role.permissions || []
        }
      };

      setTestResults(results);
    } catch (error) {
      console.error('Error running access test:', error);
      toast.error('Failed to run access test');
    }
  };

  const getResultIcon = (result: boolean | string) => {
    if (result === 'N/A') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (result === true) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getResultColor = (result: boolean | string) => {
    if (result === 'N/A') return 'text-yellow-600';
    if (result === true) return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Shield className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Region-Based Access Control Demo</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>Test Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role to test" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center space-x-2">
                        <span>{role.displayName || role.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {role.accessLevel || 'global'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Region</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a region to test" />
                </SelectTrigger>
                <SelectContent>
                  {regions?.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select District (Optional)</Label>
              <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a district to test (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Districts</SelectItem>
                  {districts?.map((district) => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={runAccessTest} 
              disabled={!selectedRole || !selectedRegion}
              className="w-full"
            >
              Run Access Test
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Test Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResults ? (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Test Configuration</h3>
                  <div className="space-y-1 text-sm">
                    <div><strong>Role:</strong> {testResults.role}</div>
                    <div><strong>Region:</strong> {testResults.region}</div>
                    <div><strong>District:</strong> {testResults.district}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Access Control Results</h3>
                  
                  <div className="space-y-2">
                    {Object.entries(testResults.tests).map(([test, result]) => (
                      <div key={test} className="flex items-center justify-between p-2 bg-white border rounded">
                        <span className="text-sm font-medium capitalize">
                          {test.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <div className="flex items-center space-x-2">
                          {getResultIcon(result)}
                          <span className={`text-sm font-medium ${getResultColor(result)}`}>
                            {result === true ? 'Allowed' : result === false ? 'Denied' : 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold mb-2 text-blue-800">Role Details</h3>
                  <div className="space-y-1 text-sm text-blue-700">
                    <div><strong>Access Level:</strong> {testResults.roleDetails.accessLevel}</div>
                    <div><strong>Priority:</strong> {testResults.roleDetails.priority}</div>
                    <div><strong>Allowed Regions:</strong> {testResults.roleDetails.allowedRegions.length}</div>
                    <div><strong>Allowed Districts:</strong> {testResults.roleDetails.allowedDistricts.length}</div>
                    <div><strong>Permissions:</strong> {testResults.roleDetails.permissions.length}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Run a test to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5 text-blue-600" />
            <span>How Region-Based Access Control Works</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2 text-blue-600">1. Access Level</h4>
              <p className="text-sm text-gray-600">
                Each role has an access level: <strong>Global</strong>, <strong>Regional</strong>, or <strong>District</strong>.
                This determines the scope of their access.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2 text-green-600">2. Region/District Assignment</h4>
              <p className="text-sm text-gray-600">
                Regional roles can only access specific regions. District roles can only access specific districts.
                Global roles have access to everything.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2 text-purple-600">3. Permission Check</h4>
              <p className="text-sm text-gray-600">
                The system checks both <strong>location access</strong> and <strong>feature permissions</strong>.
                Both must be true for access to be granted.
              </p>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold mb-2 text-yellow-800">Example Scenarios</h4>
            <div className="space-y-2 text-sm text-yellow-700">
              <div><strong>North Region Manager:</strong> Can access asset management in North Region only</div>
              <div><strong>South District Technician:</strong> Can access inspections in South District only</div>
              <div><strong>Global Engineer:</strong> Can access everything in all regions and districts</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
