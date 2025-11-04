import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useData } from '@/contexts/DataContext';
import { FeederService } from '@/services/FeederService';
import { apiRequest } from '@/lib/api';
import { toast } from '@/components/ui/sonner';

export const FeederAPITest: React.FC = () => {
  const { regions } = useData();
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const feederService = FeederService.getInstance();

  const addTestResult = (test: string, result: any, error?: any) => {
    setTestResults(prev => [...prev, {
      test,
      result,
      error,
      timestamp: new Date().toISOString()
    }]);
  };

  const testDirectAPI = async () => {
    setIsLoading(true);
    try {
      console.log('[FeederAPITest] Testing direct API call to /api/feeders');
      const result = await apiRequest('/api/feeders');
      console.log('[FeederAPITest] Direct API result:', result);
      addTestResult('Direct API Call', result);
      toast.success('Direct API test completed');
    } catch (error) {
      console.error('[FeederAPITest] Direct API error:', error);
      addTestResult('Direct API Call', null, error);
      toast.error('Direct API test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const testGetAllFeeders = async () => {
    setIsLoading(true);
    try {
      console.log('[FeederAPITest] Testing getAllFeeders()');
      const result = await feederService.getAllFeeders();
      console.log('[FeederAPITest] getAllFeeders result:', result);
      addTestResult('getAllFeeders()', result);
      toast.success('getAllFeeders test completed');
    } catch (error) {
      console.error('[FeederAPITest] getAllFeeders error:', error);
      addTestResult('getAllFeeders()', null, error);
      toast.error('getAllFeeders test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const testGetFeedersByRegion = async () => {
    if (!selectedRegion) {
      toast.error('Please select a region first');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[FeederAPITest] Testing getFeedersByRegion() with region:', selectedRegion);
      const result = await feederService.getFeedersByRegion(selectedRegion);
      console.log('[FeederAPITest] getFeedersByRegion result:', result);
      addTestResult('getFeedersByRegion()', result);
      toast.success('getFeedersByRegion test completed');
    } catch (error) {
      console.error('[FeederAPITest] getFeedersByRegion error:', error);
      addTestResult('getFeedersByRegion()', null, error);
      toast.error('getFeedersByRegion test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const testDirectRegionAPI = async () => {
    if (!selectedRegion) {
      toast.error('Please select a region first');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[FeederAPITest] Testing direct API call with regionId:', selectedRegion);
      const result = await apiRequest(`/api/feeders?regionId=${selectedRegion}`);
      console.log('[FeederAPITest] Direct region API result:', result);
      addTestResult('Direct Region API Call', result);
      toast.success('Direct region API test completed');
    } catch (error) {
      console.error('[FeederAPITest] Direct region API error:', error);
      addTestResult('Direct Region API Call', null, error);
      toast.error('Direct region API test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feeder API Test</CardTitle>
          <CardDescription>
            Test different feeder API calls to debug loading issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Region for Testing</Label>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger>
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={testDirectAPI} disabled={isLoading} variant="outline">
              Test Direct API
            </Button>
            <Button onClick={testGetAllFeeders} disabled={isLoading} variant="outline">
              Test getAllFeeders()
            </Button>
            <Button onClick={testGetFeedersByRegion} disabled={isLoading || !selectedRegion} variant="outline">
              Test getFeedersByRegion()
            </Button>
            <Button onClick={testDirectRegionAPI} disabled={isLoading || !selectedRegion} variant="outline">
              Test Direct Region API
            </Button>
            <Button onClick={clearResults} variant="destructive">
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="border rounded p-4">
                  <h4 className="font-semibold">{result.test}</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </p>
                  {result.error ? (
                    <div className="mt-2">
                      <p className="text-red-600 font-medium">Error:</p>
                      <pre className="text-sm bg-red-50 p-2 rounded">
                        {JSON.stringify(result.error, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-green-600 font-medium">Success:</p>
                      <pre className="text-sm bg-green-50 p-2 rounded">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 