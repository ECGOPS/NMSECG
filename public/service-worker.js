const CACHE_NAME = 'ecg-nms-cache-v7';
const STATIC_CACHE = 'ecg-nms-static-v7';
const DYNAMIC_CACHE = 'ecg-nms-dynamic-v7';

// IMPORTANT: Photo serve endpoints (/api/photos/serve/*) are treated as IMAGE requests,
// not API requests, to ensure proper caching and offline handling.

// App shell files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ecg-images/ecg-logo.png',
  '/favicon.ico'
];

// Common routes to cache for offline navigation
const ROUTES_TO_CACHE = [
  '/asset-management',
  '/asset-management/overhead-line-inspection',
  '/asset-management/substation-inspection',
  '/asset-management/vit-assets',
  '/asset-management/vit-inspections',
  '/load-monitoring',
  '/analytics',
  '/dashboard'
];

// Dynamic files to cache on first visit
const DYNAMIC_FILES = [
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/App.css'
];

// Install event - cache app shell and routes
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v7...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching app shell and routes');
        // Cache static files first
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
        // Cache common routes for offline navigation
        return cacheRoutes();
      })
      .then(() => {
        console.log('[SW] Routes cached successfully');
        // Force immediate activation
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache app shell:', error);
      })
  );
  
  // Force immediate activation
  self.skipWaiting();
});

// Function to cache common routes
async function cacheRoutes() {
  const cache = await caches.open(STATIC_CACHE);
  const routePromises = ROUTES_TO_CACHE.map(async (route) => {
    try {
      const response = await fetch(route);
      if (response.ok) {
        await cache.put(route, response.clone());
        console.log(`[SW] Cached route: ${route}`);
      }
    } catch (error) {
      console.log(`[SW] Failed to cache route ${route}:`, error);
    }
  });
  
  await Promise.all(routePromises);
}

// Function to cache a route when visited
async function cacheRouteOnVisit(url) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const response = await fetch(url);
    if (response.ok) {
      await cache.put(url, response.clone());
      console.log(`[SW] Cached route on visit: ${url}`);
    }
  } catch (error) {
    console.log(`[SW] Failed to cache route on visit ${url}:`, error);
  }
}

// Listen for messages from the main app to cache routes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_ROUTE') {
    console.log('[SW] Received route cache request:', event.data.url);
    cacheRouteOnVisit(event.data.url);
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v7...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        console.log('[SW] Found caches:', cacheNames);
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete ALL old caches (not just non-matching ones)
            if (!cacheName.includes('v7')) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker v7 activated, claiming all clients');
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients about the update
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_UPDATED',
              data: { version: 'v7' }
            });
          });
        });
      })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (url.pathname === '/' || url.pathname === '/index.html') {
    // App shell - serve from cache first
    event.respondWith(handleAppShell(request));
  } else if (ROUTES_TO_CACHE.includes(url.pathname)) {
    // Cached routes - serve from cache first, network fallback
    event.respondWith(handleCachedRoute(request));
  } else if (url.pathname.startsWith('/api/photos/serve/')) {
    // Photo serve endpoints - treat as images, not API calls
    event.respondWith(handleImages(request));
  } else if (url.pathname.startsWith('/api/settings/login-background')) {
    // Login background settings - always fetch fresh (don't cache)
    // This ensures new uploads are detected immediately
    console.log('[SW] Login background settings endpoint, fetching fresh:', url.pathname);
    event.respondWith(fetch(request));
  } else if (url.pathname.startsWith('/api/roles') || url.pathname.startsWith('/api/features')) {
    // Critical API endpoints - always pass through without service worker interference
    console.log('[SW] Critical API endpoint, passing through:', url.pathname);
    event.respondWith(fetch(request));
  } else if (url.pathname.startsWith('/api/')) {
    // Other API requests - network first, cache fallback
    event.respondWith(handleAPI(request));
  } else if (url.pathname.startsWith('/src/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.tsx')) {
    // JavaScript files - cache first, network fallback
    event.respondWith(handleJavaScript(request));
  } else if (url.pathname.startsWith('/ecg-images/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg') || url.pathname.endsWith('.gif') || url.pathname.endsWith('.webp')) {
    // Images - cache first, network fallback
    event.respondWith(handleImages(request));
  } else {
    // Other static assets - cache first, network fallback
    event.respondWith(handleStaticAssets(request));
  }
});

// Handle cached route requests
async function handleCachedRoute(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log(`[SW] Serving cached route: ${request.url}`);
      return cachedResponse;
    }
    
    // If not in cache, try network and cache it
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
      console.log(`[SW] Cached new route: ${request.url}`);
    }
    return networkResponse;
  } catch (error) {
    console.error(`[SW] Error handling cached route ${request.url}:`, error);
    // Return a fallback response for offline
    return new Response('Route not available offline', {
      status: 503,
      statusText: 'Service Unavailable - Offline'
    });
  }
}

// Handle app shell requests
async function handleAppShell(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving app shell from cache');
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to handle app shell:', error);
    // Return cached version if available
    const cachedResponse = await caches.match('/');
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline page
    return new Response(
      '<html><body><h1>ECG NMS</h1><p>You are offline. Please check your connection.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Handle API requests
async function handleAPI(request) {
  console.log('[SW] Handling API request:', request.url, 'Method:', request.method);
  
  try {
    // Try network first with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const networkResponse = await fetch(request, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (networkResponse.ok) {
      console.log('[SW] API request successful:', request.url, 'Status:', networkResponse.status);
      return networkResponse;
    }
    
    // If response is not ok but we got a response, return it
    // Don't treat 4xx/5xx responses as offline - let the app handle them
    console.log('[SW] API returned non-200 status:', request.url, 'Status:', networkResponse.status);
    return networkResponse;
    
  } catch (error) {
    // Only treat network errors as offline, not timeout or abort errors
    if (error.name === 'AbortError') {
      console.log('[SW] API request timed out, letting it pass through');
      // Let the request pass through to the network without service worker interference
      return fetch(request);
    }
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.log('[SW] Network error, serving offline response:', error);
      
      // Return appropriate offline response based on API endpoint
      if (request.url.includes('/api/inspections')) {
        return new Response(
          JSON.stringify({ message: 'Offline mode - data will sync when connection returns' }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Service unavailable offline' }),
        { 
          status: 503, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // For other errors, let the request pass through
    console.log('[SW] Unknown error, letting request pass through:', error);
    return fetch(request);
  }
}

// Handle JavaScript files
async function handleJavaScript(request) {
  try {
    // Check cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving JavaScript from cache:', request.url);
      return cachedResponse;
    }
    
    // Try network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache for future use
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Cached JavaScript:', request.url);
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch JavaScript:', request.url, error);
    
    // Check if this is a React chunk file
    const isReactChunk = request.url.includes('chunk-') || request.url.includes('src/');
    
    if (isReactChunk) {
      // Return a proper ES module fallback for React chunks
      return new Response(
        `// Offline fallback for ${request.url}
        console.warn('Module ${request.url} not available offline');
        
        // Export a default component that handles offline state
        const OfflineFallback = () => {
          return React.createElement('div', {
            style: {
              padding: '20px',
              textAlign: 'center',
              color: '#666',
              backgroundColor: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '8px',
              margin: '20px'
            }
          }, [
            React.createElement('h3', { key: 'title' }, 'Offline Mode'),
            React.createElement('p', { key: 'message' }, 'This component is not available offline. Please check your internet connection.')
          ]);
        };
        
        export default OfflineFallback;
        `,
        {
          status: 200,
          headers: { 
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-cache'
          }
        }
      );
    }
    
    // For other JS files, return a simple fallback
    return new Response(
      `console.log('Module ${request.url} not available offline');`,
      {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      }
    );
  }
}

// Handle images
async function handleImages(request) {
  const url = new URL(request.url);
  const isPhotoServe = url.pathname.startsWith('/api/photos/serve/');
  const isLoginBackground = url.pathname.includes('login-backgrounds');
  const hasCacheBuster = url.searchParams.has('v'); // Check for cache-busting parameter
  
  try {
    // For login backgrounds with cache-busting, always fetch from network first
    // This ensures new uploads are immediately visible
    if (isLoginBackground && hasCacheBuster) {
      console.log('[SW] Login background with cache-buster, fetching from network:', url.pathname);
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        // Update cache with new image
        const cache = await caches.open(DYNAMIC_CACHE);
        // Store both with and without query params for compatibility
        await cache.put(request, networkResponse.clone());
        // Also cache without query params for faster future loads
        const urlWithoutParams = new URL(url.pathname, url.origin);
        await cache.put(urlWithoutParams, networkResponse.clone());
      }
      return networkResponse;
    }
    
    // For other images, check cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      if (isPhotoServe) {
        console.log('[SW] Serving photo from cache:', url.pathname);
      }
      // For cached images, also try to update in background (stale-while-revalidate)
      if (isLoginBackground) {
        fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Silently fail background update
        });
      }
      return cachedResponse;
    }
    
    // Try network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache for future use
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      if (isPhotoServe) {
        console.log('[SW] Cached photo serve response:', url.pathname);
      }
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch image:', request.url, error);
    
    // For photo serve endpoints, return a more specific error
    if (isPhotoServe) {
      console.error('[SW] Photo serve request failed:', url.pathname, error);
    }
    
    // Return placeholder image or null
    return new Response(
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// Handle other static assets
async function handleStaticAssets(request) {
  try {
    // Check cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Try network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache for future use
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', request.url, error);
    return new Response('', { status: 404 });
  }
}

// Handle background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when connection returns
async function syncOfflineData() {
  try {
    console.log('[SW] Starting background sync of offline data...');
    
    // Get all clients
    const clients = await self.clients.matchAll();
    
    // Send sync message to all clients
    clients.forEach(client => {
      client.postMessage({
        type: 'START_SYNC',
        data: { source: 'service-worker' }
      });
    });
    
    console.log('[SW] Background sync message sent to clients');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  const options = {
    body: 'ECG NMS - New notification',
    icon: '/ecg-images/ecg-logo.png',
    badge: '/ecg-images/ecg-logo.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/ecg-images/ecg-logo.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/ecg-images/ecg-logo.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('ECG Network Management System', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    // Focus or open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  console.log('[SW] Message received from client:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_URLS') {
    // Cache specific URLs
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  } else if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    // Return cache status to client
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        event.ports[0].postMessage({
          type: 'CACHE_STATUS',
          data: { cacheNames, cacheName: CACHE_NAME }
        });
      })
    );
  } else if (event.data && event.data.type === 'CLEAR_LOGIN_BACKGROUND_CACHE') {
    // Clear all cached login background images
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(async (cache) => {
        const keys = await cache.keys();
        const loginBackgroundKeys = keys.filter((request) => {
          const url = new URL(request.url);
          return url.pathname.includes('login-backgrounds');
        });
        console.log('[SW] Clearing login background cache:', loginBackgroundKeys.length, 'items');
        await Promise.all(loginBackgroundKeys.map((key) => cache.delete(key)));
        console.log('[SW] Login background cache cleared');
      })
    );
  }
});

// Handle offline/online events
self.addEventListener('online', () => {
  console.log('[SW] Network connection restored');
  
  // Trigger background sync
  self.registration.sync.register('sync-offline-data')
    .then(() => {
      console.log('[SW] Background sync registered');
    })
    .catch((error) => {
      console.error('[SW] Failed to register background sync:', error);
    });
});

self.addEventListener('offline', () => {
  console.log('[SW] Network connection lost');
}); 