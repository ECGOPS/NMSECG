import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VITAssetsTable } from '@/components/vit/VITAssetsTable';
import { RefreshCw, User, Shield, Database } from 'lucide-react';

export default function UserRoleTestPage() {
  const [selectedRole, setSelectedRole] = useState('district_engineer');
  const [selectedRegion, setSelectedRegion] = useState('CENTRAL REGION');
  const [selectedDistrict, setSelectedDistrict] = useState('AJUMAKO');
  const [testAssets, setTestAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const roleOptions = [
    { value: 'system_admin', label: 'System Admin', description: 'Can see all assets' },
    { value: 'global_engineer', label: 'Global Engineer', description: 'Can see all assets' },
    { value: 'regional_engineer', label: 'Regional Engineer', description: 'Can see assets in assigned region' },
    { value: 'district_engineer', label: 'District Engineer', description: 'Can see assets in assigned district' },
    { value: 'technician', label: 'Technician', description: 'Can see assets in assigned district' },
    { value: 'district_manager', label: 'District Manager', description: 'Can see assets in assigned district' },
    { value: 'regional_general_manager', label: 'Regional General Manager', description: 'Can see assets in assigned region' },
    { value: 'project_engineer', label: 'Project Engineer', description: 'Can see assets in assigned region' }
  ];

  const regionOptions = [
    'CENTRAL REGION',
    'WESTERN REGION', 
    'EASTERN REGION',
    'NORTHERN REGION',
    'SOUTHERN REGION'
  ];

  const districtOptions = [
    'AJUMAKO',
    'ASIKUMA',
    'AGONA',
    'CAPE COAST',
    'KOMENDA',
    'SALT POND'
  ];

  const testUserRole = async () => {
    setLoading(true);
    try {
      // Test the API with different user roles
      const response = await fetch(`/api/vitAssets?testRole=${selectedRole}&testRegion=${selectedRegion}&testDistrict=${selectedDistrict}&limit=10`);
      const data = await response.json();
      
      setTestAssets(data);
      console.log(`[TEST] Role: ${selectedRole}, Region: ${selectedRegion}, District: ${selectedDistrict}`);
      console.log(`[TEST] Assets returned: ${data.length}`);
    } catch (error) {
      console.error('Error testing user role:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Role Testing</h1>
            <p className="text-muted-foreground mt-1">
              Test how different user roles see switchgear assets
            </p>
          </div>
          <Button onClick={testUserRole} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Test Role
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Role Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Role
              </CardTitle>
              <CardDescription>Select a role to test</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-sm text-muted-foreground">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Region Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Region
              </CardTitle>
              <CardDescription>User's assigned region</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {regionOptions.map(region => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* District Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                District
              </CardTitle>
              <CardDescription>User's assigned district</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {districtOptions.map(district => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Current Test Configuration */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Test Configuration</CardTitle>
            <CardDescription>How the backend will filter data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div>
                <strong>Role:</strong> 
                <Badge variant="secondary" className="ml-2">
                  {roleOptions.find(r => r.value === selectedRole)?.label}
                </Badge>
              </div>
              <div>
                <strong>Region:</strong> {selectedRegion}
              </div>
              <div>
                <strong>District:</strong> {selectedDistrict}
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {selectedRole === 'system_admin' || selectedRole === 'global_engineer' 
                ? 'Will see ALL assets (no filtering)'
                : selectedRole.includes('regional') || selectedRole === 'project_engineer'
                ? `Will see assets from region: ${selectedRegion}`
                : `Will see assets from district: ${selectedDistrict}`
              }
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testAssets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Assets returned for the selected role configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <strong>Total assets returned:</strong> {testAssets.length}
              </div>
              <div className="space-y-2">
                {testAssets.slice(0, 5).map((asset, index) => (
                  <div key={index} className="border rounded p-2 text-sm">
                    <div><strong>ID:</strong> {asset.id}</div>
                    <div><strong>Serial:</strong> {asset.serialNumber}</div>
                    <div><strong>Region:</strong> {asset.region}</div>
                    <div><strong>District:</strong> {asset.district}</div>
                    <div><strong>Type:</strong> {asset.typeOfUnit}</div>
                  </div>
                ))}
                {testAssets.length > 5 && (
                  <div className="text-muted-foreground text-sm">
                    ... and {testAssets.length - 5} more assets
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How to Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>1. <strong>Select a role</strong> from the dropdown above</div>
              <div>2. <strong>Choose region/district</strong> if applicable</div>
              <div>3. <strong>Click "Test Role"</strong> to see what data that user would see</div>
              <div>4. <strong>Check browser console</strong> (F12) for detailed backend logs</div>
              <div>5. <strong>Compare results</strong> - different roles should see different amounts of data</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 