# Offline Handling Improvements

This document describes the offline handling improvements implemented to resolve the "Failed to fetch dynamically imported module" error when opening pages offline.

## Problem Description

When the application was offline, users encountered the error:
```
Failed to fetch dynamically imported module: http://localhost:5173/src/pages/asset-management/InspectionDetailsPage.tsx
```

This occurred because:
1. Vite's dynamic imports couldn't fetch module files when offline
2. The service worker wasn't properly caching JavaScript modules
3. No graceful offline fallback was provided

## Solution Overview

### 1. Enhanced Service Worker (`public/sw.js`)

- **Improved Caching Strategy**: Now caches JavaScript modules and route chunks
- **Module Error Handling**: Provides fallback responses for offline module requests
- **Better Cache Management**: Includes cache versioning and cleanup

Key improvements:
```javascript
// Handle JavaScript module requests
if (request.destination === 'script' || url.pathname.endsWith('.tsx') || url.pathname.endsWith('.ts')) {
  // Cache successful responses and provide offline fallbacks
}
```

### 2. Enhanced Route Utilities (`src/utils/routeUtils.tsx`)

- **Offline Detection**: Automatically detects offline state
- **Graceful Fallbacks**: Shows offline indicator instead of crashing
- **Retry Functionality**: Allows users to retry when connection is restored

### 3. Offline Indicator Component (`src/components/common/OfflineIndicator.tsx`)

- **Visual Feedback**: Clear indication of offline status
- **Connection Testing**: Built-in connection test functionality
- **User Guidance**: Helpful messages and retry options

### 4. Enhanced Error Boundary (`src/components/ErrorBoundary.tsx`)

- **Offline-Aware**: Detects and handles offline scenarios
- **Module Error Detection**: Specifically identifies module loading errors
- **Better User Experience**: Provides context-appropriate error messages

### 5. Health Check API (`backend/routes/health.js`)

- **Connection Testing**: Endpoint for testing connectivity
- **No Authentication Required**: Accessible even when offline
- **Lightweight**: HEAD method for efficient connection checks

## Usage

### Basic Offline Detection

```typescript
import { useOfflineState, isOffline } from '@/utils/offlineUtils';

function MyComponent() {
  const offlineState = useOfflineState();
  
  if (offlineState.isOffline) {
    return <div>You're offline!</div>;
  }
  
  return <div>You're online!</div>;
}
```

### Adding Offline Indicator

```typescript
import { OfflineIndicator } from '@/components/common/OfflineIndicator';

function MyPage() {
  return (
    <div>
      <OfflineIndicator showBanner={true} showRetry={true} />
      {/* Your page content */}
    </div>
  );
}
```

### Custom Offline Handling

```typescript
import { offlineManager } from '@/utils/offlineUtils';

// Subscribe to offline state changes
const unsubscribe = offlineManager.subscribe((state) => {
  if (state.isOffline) {
    console.log('App went offline at:', state.lastOffline);
  } else {
    console.log('App came back online at:', state.lastOnline);
  }
});

// Test connection
const isConnected = await offlineManager.testConnection();
```

## Configuration

### Service Worker

The service worker automatically:
- Caches essential app shell files
- Caches JavaScript modules when available
- Provides offline fallbacks for module requests
- Manages cache versions and cleanup

### Cache Strategy

- **App Shell**: Cache-first for HTML, CSS, and basic assets
- **JavaScript Modules**: Cache-first with offline fallbacks
- **API Requests**: Network-first (bypasses cache)
- **Photos/Media**: Cache-first for better performance

## Testing Offline Functionality

### 1. Simulate Offline Mode

**Chrome DevTools:**
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox

**Firefox DevTools:**
1. Open DevTools (F12)
2. Go to Network tab
3. Click "Offline" button

### 2. Test Module Loading

1. Go offline
2. Navigate to a page that uses dynamic imports
3. Verify offline indicator appears instead of error
4. Go back online and verify page loads normally

### 3. Test Connection Recovery

1. Go offline
2. Click "Test Connection" button
3. Verify error message appears
4. Go back online
5. Click "Test Connection" again
6. Verify success message appears

## Troubleshooting

### Common Issues

1. **Service Worker Not Updating**
   - Clear browser cache and reload
   - Check browser console for service worker errors
   - Verify `sw.js` file is accessible

2. **Offline Detection Not Working**
   - Check browser console for errors
   - Verify `navigator.onLine` is supported
   - Check event listener registration

3. **Module Caching Issues**
   - Check service worker cache in DevTools
   - Verify module files are being cached
   - Check network tab for failed requests

### Debug Mode

Enable debug logging by setting:
```javascript
localStorage.setItem('debug', 'offline:*');
```

## Performance Considerations

- **Cache Size**: Monitor service worker cache usage
- **Module Preloading**: Consider preloading critical modules
- **Offline Storage**: Use IndexedDB for larger offline data
- **Connection Quality**: Adapt behavior based on connection type

## Future Improvements

1. **Progressive Module Loading**: Load modules in background when online
2. **Smart Caching**: Cache based on user behavior patterns
3. **Offline Sync**: Queue actions for when connection is restored
4. **Connection Quality**: Adapt UI based on connection speed

## Support

For issues or questions about offline functionality:
1. Check browser console for error messages
2. Verify service worker registration
3. Test with different network conditions
4. Review this documentation
