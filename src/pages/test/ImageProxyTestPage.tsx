import React, { useState } from 'react';
import { getImageProxyUrl, isAzureBlobUrl } from '../../utils/imageUtils';

export default function ImageProxyTestPage() {
  const [testUrl, setTestUrl] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');
  const [isAzure, setIsAzure] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const handleTestUrl = () => {
    if (!testUrl) return;
    
    const azureCheck = isAzureBlobUrl(testUrl);
    setIsAzure(azureCheck);
    
    if (azureCheck) {
      const proxy = getImageProxyUrl(testUrl);
      setProxyUrl(proxy);
      setTestResult('✅ Azure Blob Storage URL detected and converted to proxy');
    } else {
      setProxyUrl(testUrl);
      setTestResult('ℹ️ Not an Azure Blob Storage URL - no proxy needed');
    }
  };

  const testImageFetch = async () => {
    if (!testUrl) return;
    
    try {
      setTestResult('🔄 Testing image fetch...');
      
      const proxyUrl = getImageProxyUrl(testUrl);
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(proxyUrl, { headers });
      
      if (response.ok) {
        setTestResult(`✅ Image fetch successful! Status: ${response.status}`);
      } else {
        setTestResult(`❌ Image fetch failed! Status: ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      setTestResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Image Proxy Test Page</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">What This Tests:</h2>
        <p className="text-sm text-gray-700">
          This page tests the image proxy functionality that bypasses CORS issues when accessing 
          Azure Blob Storage images from the frontend. It converts Azure URLs to backend proxy URLs.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Test Azure Blob Storage URL:
          </label>
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="https://faultmasterstorage.blob.core.windows.net/uploads/..."
            className="w-full p-3 border border-gray-300 rounded-md"
          />
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleTestUrl}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Test URL Conversion
          </button>
          
          {isAzure && (
            <button
              onClick={testImageFetch}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Test Image Fetch
            </button>
          )}
        </div>

        {proxyUrl && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Results:</h3>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Original URL:</strong>
                <div className="break-all text-gray-600">{testUrl}</div>
              </div>
              <div>
                <strong>Proxy URL:</strong>
                <div className="break-all text-blue-600">{proxyUrl}</div>
              </div>
              <div>
                <strong>Azure Blob Storage:</strong>
                <span className={isAzure ? 'text-green-600' : 'text-gray-600'}>
                  {isAzure ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {testResult && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Test Result:</h3>
            <div className="text-sm">{testResult}</div>
          </div>
        )}
      </div>

      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Example URLs to Test:</h3>
        <div className="text-sm space-y-1">
          <div className="break-all text-gray-700">
            https://faultmasterstorage.blob.core.windows.net/uploads/overhead-inspections/temp-1754947288471-qzborg67o-before-0/images[1754947290751]-2025-08-11-21-21-30-751-.jpg
          </div>
          <div className="break-all text-gray-700">
            https://faultmasterstorage.blob.core.windows.net/uploads/vit-assets/asset-123/photo.jpg
          </div>
        </div>
      </div>
    </div>
  );
}
