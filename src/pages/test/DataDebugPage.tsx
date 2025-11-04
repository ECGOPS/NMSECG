import React from 'react';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { DataLoadingDebugger } from '@/components/debug/DataLoadingDebugger';
import { useData } from '@/contexts/DataContext';
import { useAzureADAuth } from '@/contexts/AzureADAuthContext';
import { Button } from '@/components/ui/button';

export function DataDebugPage() {
  const { testCache, vitAssets } = useData();
  const { user, loading } = useAzureADAuth();

  // Simple authentication check
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Required</h1>
          <p className="text-gray-600">Please log in to access the debug page.</p>
        </div>
      </div>
    );
  }

  const handleTestCache = async () => {
    console.log('🧪 Testing cache...');
    const result = await testCache();
    console.log('🧪 Cache test result:', result);
    
    // Show results in alert for easy viewing
    const message = `
Cache Test Results:

IndexedDB Cache:
- Has data: ${result.indexedDB ? 'Yes' : 'No'}
- Data length: ${result.indexedDB?.data?.length || 0}
- Age: ${result.indexedDB ? Date.now() - result.indexedDB.timestamp : 'N/A'}ms

Memory Cache:
- Has data: ${result.memory.data.length > 0 ? 'Yes' : 'No'}
- Data length: ${result.memory.data.length}
- Age: ${Date.now() - result.memory.timestamp}ms

Cache Info:
${result.cacheInfo.map(info => `- ${info.key}: ${info.valid ? 'Valid' : 'Invalid'} (${info.age}ms old, ${info.size} bytes)`).join('\n')}
    `;
    
    alert(message);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Data Loading Debugger</h1>
        <p className="text-gray-600 mb-4">
          This page helps you monitor data loading states and cache information.
        </p>
        
        <div className="flex gap-2 mb-4">
          <Button onClick={handleTestCache} variant="outline">
            🧪 Test Cache
          </Button>
          <Button 
            onClick={() => {
              console.log('Current user:', user);
              console.log('Switchgear Assets count:', vitAssets?.length || 0);
              alert(`User: ${user?.displayName}\nRole: ${user?.role}\nSwitchgear Assets: ${vitAssets?.length || 0}`);
            }} 
            variant="outline"
          >
            👤 User Info
          </Button>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Troubleshooting Guide:</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Check if data is loading from API or cache</li>
            <li>• Verify cache age and validity</li>
            <li>• Monitor IndexedDB storage</li>
            <li>• Test cache clearing functionality</li>
          </ul>
        </div>
      </div>
      
      <DataLoadingDebugger />
    </div>
  );
}

export default DataDebugPage; 