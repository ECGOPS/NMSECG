# Image Proxy Fix: CORS and Azure Blob Storage Access

## Problem Description

Users were experiencing issues when trying to export Excel reports with embedded images:

```
Access to fetch at 'https://faultmasterstorage.blob.core.windows.net/uploads/...' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Additional Error:**
```
net::ERR_FAILED 409 (Public access is not permitted on this storage account.)
```

## Root Cause

The issue occurred because:

1. **CORS Policy Block**: Frontend cannot directly access Azure Blob Storage from browser
2. **Public Access Restricted**: Azure Storage account doesn't allow public access
3. **Authentication Required**: Images need proper authentication to access
4. **Direct URL Fetching**: Excel export was trying to fetch images directly from Azure URLs

## Solution Implemented

### 1. Backend Image Proxy Route

Created `/backend/routes/imageProxy.js` that:
- Acts as a secure proxy between frontend and Azure Blob Storage
- Handles authentication and authorization
- Streams images to frontend with proper headers
- Bypasses CORS restrictions

**Key Features:**
- ✅ **Secure Access**: Requires JWT authentication
- ✅ **CORS Headers**: Properly configured for frontend access
- ✅ **Streaming**: Efficiently streams large images
- ✅ **Error Handling**: Graceful fallbacks and logging
- ✅ **Caching**: Appropriate cache headers for performance

### 2. Frontend Image Utilities

Created `/src/utils/imageUtils.ts` with helper functions:

```typescript
// Convert Azure URLs to proxy URLs
export const getImageProxyUrl = (azureUrl: string): string

// Check if URL is Azure Blob Storage
export const isAzureBlobUrl = (url: string): boolean

// Get auth headers for proxy requests
export const getImageProxyHeaders = (): HeadersInit

// Fetch with proxy fallback
export const fetchImageWithProxy = async (url: string): Promise<Response>
```

### 3. Updated Excel Export

Modified `/src/utils/excelExport.ts` to:
- Use image proxy for Azure URLs
- Maintain fallback for non-Azure URLs
- Handle authentication properly
- Provide better error logging

### 4. Test Page

Created `/src/pages/test/ImageProxyTestPage.tsx` to:
- Test URL conversion logic
- Verify proxy functionality
- Debug image fetching issues
- Provide examples for testing

## How It Works

### Before (Problematic):
```
Frontend → Direct Fetch → Azure Blob Storage ❌ CORS Error
```

### After (Fixed):
```
Frontend → Backend Proxy → Azure Blob Storage ✅ Success
```

**Flow:**
1. Frontend detects Azure Blob Storage URL
2. Converts to backend proxy URL (`/api/images/{container}/{blobPath}`)
3. Backend authenticates request and fetches from Azure
4. Backend streams image to frontend with proper headers
5. Frontend receives image without CORS issues

## API Endpoints

### Image Proxy
- **GET** `/api/images/{container}/{blobPath}` - Fetch image from Azure
- **GET** `/api/images/health` - Health check for image proxy

### Authentication
- Requires valid JWT token in Authorization header
- Uses existing auth middleware

## Testing

### 1. Test URL Conversion
```typescript
const azureUrl = 'https://faultmasterstorage.blob.core.windows.net/uploads/overhead-inspections/photo.jpg';
const proxyUrl = getImageProxyUrl(azureUrl);
// Result: /api/images/uploads/overhead-inspections/photo.jpg
```

### 2. Test Image Fetch
```typescript
const response = await fetchImageWithProxy(azureUrl);
if (response.ok) {
  const blob = await response.blob();
  // Image fetched successfully!
}
```

### 3. Test Page
Navigate to `/test/image-proxy` to test the functionality interactively.

## Benefits

✅ **CORS Issues Resolved**: No more browser blocking
✅ **Secure Access**: Proper authentication required
✅ **Performance**: Efficient streaming and caching
✅ **Maintainable**: Clean separation of concerns
✅ **Scalable**: Works with any Azure Storage container
✅ **Fallback Support**: Graceful degradation for non-Azure URLs

## Deployment Notes

1. **Backend**: Ensure `@azure/storage-blob` package is installed
2. **Environment**: Verify `AZURE_STORAGE_CONNECTION_STRING` is set
3. **CORS**: Proxy route inherits main app CORS configuration
4. **Authentication**: Uses existing JWT middleware

## Troubleshooting

### Common Issues:

1. **401 Unauthorized**: Check JWT token and Azure credentials
2. **404 Not Found**: Verify container and blob path exist
3. **500 Internal Error**: Check Azure Storage connection string
4. **CORS Still Blocking**: Ensure proxy route is properly registered

### Debug Steps:

1. Check browser console for proxy URL conversion
2. Verify backend logs for image proxy requests
3. Test proxy endpoint directly with Postman/curl
4. Check Azure Storage account permissions

## Future Enhancements

- **Image Resizing**: Add thumbnail generation
- **Format Conversion**: Support multiple image formats
- **CDN Integration**: Add CDN caching for better performance
- **Rate Limiting**: Add request throttling for large images
