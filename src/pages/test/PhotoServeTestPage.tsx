import React, { useState } from 'react';
import { getImageProxyUrl, isAzureBlobUrl } from '../../utils/imageUtils';

export default function PhotoServeTestPage() {
  const [testUrl, setTestUrl] = useState('');
  const [photoServeUrl, setPhotoServeUrl] = useState('');
  const [isAzure, setIsAzure] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');

  const handleTestUrl = () => {
    if (!testUrl) return;
    const azureCheck = isAzureBlobUrl(testUrl);
    setIsAzure(azureCheck);
    if (azureCheck) {
      const photoServe = getImageProxyUrl(testUrl);
      setPhotoServeUrl(photoServe);
      setTestResult('✅ Azure Blob Storage URL detected and converted to photo serve endpoint');
    } else {
      setPhotoServeUrl(testUrl);
      setTestResult('ℹ️ Not an Azure Blob Storage URL - no conversion needed');
    }
  };

  const testImageFetch = async () => {
    if (!testUrl) return;
    try {
      setTestResult('🔄 Testing image fetch via photo serve...');
      const photoServeUrl = getImageProxyUrl(testUrl);
      
      const response = await fetch(photoServeUrl);
      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setImagePreview(imageUrl);
        setTestResult(`✅ Image fetch successful! Status: ${response.status}, Size: ${blob.size} bytes`);
      } else {
        setTestResult(`❌ Image fetch failed! Status: ${response.status} - ${response.statusText}`);
        setImagePreview('');
      }
    } catch (error) {
      setTestResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setImagePreview('');
    }
  };

  const testImageValidation = async () => {
    if (!testUrl) return;
    try {
      setTestResult('🔄 Testing image validation...');
      const photoServeUrl = getImageProxyUrl(testUrl);
      
      const response = await fetch(photoServeUrl, { method: 'HEAD' });
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        setTestResult(`✅ Validation successful! Content-Type: ${contentType}, Size: ${contentLength} bytes`);
      } else {
        setTestResult(`❌ Validation failed! Status: ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      setTestResult(`❌ Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testBackendConnection = async () => {
    try {
      setTestResult('🔄 Testing backend Azure Storage connection...');
      const response = await fetch('/api/photos/test');
      if (response.ok) {
        const data = await response.json();
        setTestResult(`✅ Backend connection successful! Found ${data.blobCount} blobs in container '${data.container}'
        
Sample blobs:
${data.blobs.map((blob: any, index: number) => `${index + 1}. ${blob.name} (${blob.size} bytes)`).join('\n')}`);
      } else {
        const errorData = await response.json();
        setTestResult(`❌ Backend connection failed! Status: ${response.status} - ${errorData.error}`);
      }
    } catch (error) {
      setTestResult(`❌ Backend test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testDirectPhotoServe = async () => {
    if (!testUrl) return;
    try {
      setTestResult('🔄 Testing direct photo serve endpoint...');
      const photoServeUrl = getImageProxyUrl(testUrl);
      
      console.log('Testing photo serve URL:', photoServeUrl);
      
      const response = await fetch(photoServeUrl);
      console.log('Photo serve response:', response);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        setTestResult(`✅ Direct photo serve successful! Content-Type: ${contentType}, Size: ${contentLength} bytes`);
      } else {
        let errorDetails = `Status: ${response.status} - ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorDetails += ` | Details: ${JSON.stringify(errorData)}`;
        } catch {
          // If response is not JSON, that's fine
        }
        setTestResult(`❌ Direct photo serve failed! ${errorDetails}`);
      }
    } catch (error) {
      setTestResult(`❌ Direct photo serve error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const showBlobPathStructure = () => {
    if (!testUrl) return;
    try {
      const url = new URL(testUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      const container = pathParts[0]; // 'uploads'
      const subContainer = pathParts[1]; // 'overhead-inspections'
      const blobPath = pathParts.slice(2).join('/');
      
      const photoServePath = `/api/photos/serve/${subContainer}/${blobPath}`;
      
      setTestResult(`🔍 Blob Path Structure:
Container: ${container}
Sub-Container: ${subContainer}
Blob Path: ${blobPath}
Photo Serve URL: ${photoServePath}
Expected Azure Path: ${container}/${subContainer}/${blobPath}`);
    } catch (error) {
      setTestResult(`❌ Error parsing URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Photo Serve Test Page</h1>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">What This Tests:</h2>
        <p className="text-sm text-gray-700">
          This page tests the existing photo serve functionality that handles Azure Blob Storage images. 
          It converts Azure URLs to backend photo serve URLs using the existing system.
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
            placeholder="https://faultmasterstorage.blob.core.windows.net/uploads/overhead-inspections/..."
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
          <button
            onClick={testBackendConnection}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Test Backend Connection
          </button>
          <button
            onClick={showBlobPathStructure}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            Show Blob Path Structure
          </button>
          {isAzure && (
            <>
              <button
                onClick={testImageFetch}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Test Image Fetch
              </button>
              <button
                onClick={testImageValidation}
                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
              >
                Test Validation
              </button>
              <button
                onClick={testDirectPhotoServe}
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
              >
                Test Direct Photo Serve
              </button>
            </>
          )}
        </div>
        
        {photoServeUrl && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Results:</h3>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Original URL:</strong>
                <div className="break-all text-gray-600">{testUrl}</div>
              </div>
              <div>
                <strong>Photo Serve URL:</strong>
                <div className="break-all text-blue-600">{photoServeUrl}</div>
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
        
        {imagePreview && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Image Preview:</h3>
            <img 
              src={imagePreview} 
              alt="Test image" 
              className="max-w-full h-auto max-h-96 border border-gray-300 rounded"
            />
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
      
      <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold mb-2">How It Works:</h3>
        <div className="text-sm space-y-2 text-gray-700">
          <p>1. <strong>Azure URL</strong> → <strong>Photo Serve Endpoint</strong></p>
          <p>2. <strong>Backend fetches</strong> image from Azure Blob Storage</p>
          <p>3. <strong>No CORS issues</strong> - backend handles Azure communication</p>
          <p>4. <strong>Image served</strong> to frontend via existing photo routes</p>
        </div>
      </div>
    </div>
  );
}
