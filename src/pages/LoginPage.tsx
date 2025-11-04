import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import AzureADLoginForm from "@/components/auth/AzureADLoginForm";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useNavigate } from "react-router-dom";

const LOGIN_BACKGROUND_CACHE_KEY = 'login_background_url';
const LOGIN_BACKGROUND_CACHE_TIMESTAMP = 'login_background_timestamp';
const LOGIN_BACKGROUND_CACHE_TIMESTAMP_UPLOADED = 'login_background_uploaded_at';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export default function LoginPage() {
  const { isAuthenticated, user, loading } = useAzureADAuth();
  const navigate = useNavigate();
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null); // Start with null instead of default
  const [isLoadingBackground, setIsLoadingBackground] = useState(true);
  
  console.log('LoginPage - isAuthenticated:', isAuthenticated, 'user:', user, 'loading:', loading);
  
  // Load custom login background (public endpoint, no auth needed)
  useEffect(() => {
    const loadLoginBackground = async () => {
      try {
        setIsLoadingBackground(true);
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
        
        // Check cache first
        const cachedUrl = localStorage.getItem(LOGIN_BACKGROUND_CACHE_KEY);
        const cachedTimestamp = localStorage.getItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP);
        const now = Date.now();
        
        // Use cached URL if it exists and is fresh (less than 24 hours old)
        if (cachedUrl && cachedTimestamp) {
          const cacheAge = now - parseInt(cachedTimestamp, 10);
          if (cacheAge < CACHE_DURATION) {
            console.log('[LoginPage] Using cached background URL:', cachedUrl);
            
            // ALWAYS check with server first to detect new uploads (even if cache is fresh)
            // This ensures we detect uploads immediately, not just on cache expiry
            // Use cache-busting to bypass browser HTTP cache and get fresh server data
            console.log('[LoginPage] Checking for background updates...', {
              cachedUrl,
              cachedUploadedAt: localStorage.getItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP_UPLOADED)
            });
            
            const freshData = await fetchFreshBackground(true);
            
            console.log('[LoginPage] Fresh data from server:', freshData);
            
              if (freshData && freshData.uploadedAt && freshData.backgroundUrl) {
              const cachedUploadedAt = localStorage.getItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP_UPLOADED);
              
              // Multiple ways to detect new upload:
              // 1. Timestamp mismatch
              // 2. URL mismatch (different blob filename)
              // 3. Extract timestamp from blob filename and compare
              const isNewUpload = cachedUploadedAt !== freshData.uploadedAt;
              const isDifferentUrl = cachedUrl !== freshData.backgroundUrl;
              
              // Extract timestamps from blob filenames as additional check
              // Format: login-bg-2025-11-01-09-14-08-006-.jpg
              const extractTimestampFromUrl = (url: string): string | null => {
                const match = url.match(/login-bg-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
                return match ? match[1] : null;
              };
              
              const cachedFileTimestamp = extractTimestampFromUrl(cachedUrl || '');
              const serverFileTimestamp = extractTimestampFromUrl(freshData.backgroundUrl);
              const isDifferentFile = cachedFileTimestamp !== serverFileTimestamp && cachedFileTimestamp !== null && serverFileTimestamp !== null;
              
              console.log('[LoginPage] Background check result:', {
                cachedUploadedAt,
                serverUploadedAt: freshData.uploadedAt,
                cachedUrl,
                serverUrl: freshData.backgroundUrl,
                cachedFileTimestamp,
                serverFileTimestamp,
                isNewUpload,
                isDifferentUrl,
                isDifferentFile,
                shouldUpdate: isNewUpload || isDifferentUrl || isDifferentFile
              });
              
              // Update if ANY indicator shows a new upload
              if (isNewUpload || isDifferentUrl || isDifferentFile) {
                console.log('[LoginPage] New upload detected, using new background with cache-busting');
                
                // Clear old cached image from service worker (for PWA installations)
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({
                    type: 'CLEAR_LOGIN_BACKGROUND_CACHE'
                  });
                  console.log('[LoginPage] Requested service worker to clear old login background cache');
                }
                
                // Update cache with new values
                localStorage.setItem(LOGIN_BACKGROUND_CACHE_KEY, freshData.backgroundUrl);
                localStorage.setItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP, Date.now().toString());
                localStorage.setItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP_UPLOADED, freshData.uploadedAt);
                
                // Build new URL with cache-busting
                let refreshUrl = freshData.backgroundUrl;
                if (refreshUrl.startsWith('/') && baseUrl && !refreshUrl.startsWith('http')) {
                  refreshUrl = `${baseUrl}${refreshUrl}`;
                }
                const refreshUrlWithBuster = refreshUrl + `?v=${Date.now()}`;
                
                // Load new image directly (don't show old cached one)
                const img = new Image();
                img.onload = () => {
                  setBackgroundUrl(refreshUrlWithBuster);
                  setIsLoadingBackground(false);
                };
                img.onerror = () => {
                  console.warn('[LoginPage] Failed to load new background, falling back to cached');
                  // Fallback to cached URL if new one fails
                  let fallbackUrl = cachedUrl;
                  if (fallbackUrl.startsWith('/') && baseUrl && !fallbackUrl.startsWith('http')) {
                    fallbackUrl = `${baseUrl}${fallbackUrl}`;
                  }
                  setBackgroundUrl(fallbackUrl);
                  setIsLoadingBackground(false);
                };
                img.src = refreshUrlWithBuster;
                return;
              }
            }
            
            // No new upload detected, use cached URL
            let url = cachedUrl;
            // Ensure URL is absolute
            if (url.startsWith('/') && baseUrl && !url.startsWith('http')) {
              url = `${baseUrl}${url}`;
            }
            
            // Load cached image
            const img = new Image();
            img.onload = () => {
              setBackgroundUrl(url);
              setIsLoadingBackground(false);
            };
            img.onerror = () => {
              console.warn('[LoginPage] Cached image failed to load, fetching fresh');
              // Cache invalid, fetch fresh
              localStorage.removeItem(LOGIN_BACKGROUND_CACHE_KEY);
              localStorage.removeItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP);
              localStorage.removeItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP_UPLOADED);
              fetchFreshBackground();
            };
            img.src = url; // Use URL without cache-busting to leverage browser cache
            return;
          } else {
            console.log('[LoginPage] Cache expired, fetching fresh background');
            // Cache expired, remove it
            localStorage.removeItem(LOGIN_BACKGROUND_CACHE_KEY);
            localStorage.removeItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP);
            localStorage.removeItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP_UPLOADED);
          }
        }
        
        // Fetch fresh background
        await fetchFreshBackground();
        
        async function fetchFreshBackground(silent = false) {
          try {
            // Use direct fetch instead of apiRequest to avoid token acquisition
            // Add cache-busting to ensure we get fresh data when checking for updates
            const cacheBuster = `?t=${Date.now()}`;
            const response = await fetch(`${baseUrl}/api/settings/login-background${cacheBuster}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache' // Force fresh fetch when checking for updates
              },
              cache: 'no-store' // Don't cache this request - we need fresh data to detect updates
            });

            if (!response.ok) {
              if (!silent) {
                console.log('[LoginPage] Background endpoint returned:', response.status);
                setBackgroundUrl('/images/ops.png');
                setIsLoadingBackground(false);
              }
              return null;
            }

            const data = await response.json();
            if (!silent) {
              console.log('[LoginPage] Background response:', data);
            }
            
            if (data.success && data.backgroundUrl) {
              // Convert relative URL to absolute if needed
              let url = data.backgroundUrl;
              const relativeUrl = data.backgroundUrl; // Store relative for cache
              
              if (url.startsWith('/')) {
                // Relative URL - prepend base URL if in production
                if (baseUrl && !url.startsWith('http')) {
                  url = `${baseUrl}${url}`;
                }
              }
              
              // Check if this is a new upload by comparing timestamps
              const cachedTimestamp = localStorage.getItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP_UPLOADED);
              const serverTimestamp = data.uploadedAt || data.timestamp;
              const isNewUpload = serverTimestamp && cachedTimestamp !== serverTimestamp;
              
              // Store the relative URL and server timestamp for future comparison
              localStorage.setItem(LOGIN_BACKGROUND_CACHE_KEY, relativeUrl);
              localStorage.setItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP, now.toString());
              if (serverTimestamp) {
                localStorage.setItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP_UPLOADED, serverTimestamp);
              }
              
              // Add cache-busting if this is a new upload or if explicitly requested
              // This ensures new uploads are seen immediately, but existing photos use browser cache
              const displayUrl = isNewUpload || data.timestamp ? url + `?v=${Date.now()}` : url;
              
              if (!silent) {
                console.log('[LoginPage] Setting background URL:', displayUrl);
                
                // Preload the image to ensure it's ready before displaying
                const img = new Image();
                img.onload = () => {
                  setBackgroundUrl(displayUrl);
                  setIsLoadingBackground(false);
                };
                img.onerror = () => {
                  console.warn('[LoginPage] Failed to load custom background, using default');
                  setBackgroundUrl('/images/ops.png');
                  setIsLoadingBackground(false);
                };
                img.src = displayUrl;
              }
            } else {
              if (!silent) {
                console.log('[LoginPage] No custom background, using default');
                setBackgroundUrl('/images/ops.png');
                setIsLoadingBackground(false);
              }
              // Cache null to avoid repeated API calls
              localStorage.setItem(LOGIN_BACKGROUND_CACHE_KEY, '/images/ops.png');
              localStorage.setItem(LOGIN_BACKGROUND_CACHE_TIMESTAMP, now.toString());
            }
            return data; // Return data for background refresh checks
          } catch (error) {
            if (!silent) {
              console.error('[LoginPage] Error loading background:', error);
              setBackgroundUrl('/images/ops.png');
              setIsLoadingBackground(false);
            }
            return null;
          }
        }
      } catch (error) {
        console.error('[LoginPage] Error in loadLoginBackground:', error);
        setBackgroundUrl('/images/ops.png');
        setIsLoadingBackground(false);
      }
    };

    loadLoginBackground();
  }, []);
  
  useEffect(() => {
    if (isAuthenticated) {
      console.log('User is authenticated, redirecting to dashboard');
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);
  
  // Use default only after loading completes or if explicitly set
  const displayBackground = backgroundUrl || (isLoadingBackground ? null : '/images/ops.png');
  
  return (
    <div className="relative min-h-screen">
      {/* Only show background after it's loaded (no default flash) */}
      {displayBackground && !isLoadingBackground && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-300"
          style={{ 
            backgroundImage: `url('${displayBackground}')`,
            zIndex: -1
          }}
        />
      )}
      <Layout>
        <div className="container mx-auto py-4 sm:py-10 px-4">
          <div className="max-w-[90%] sm:max-w-md mx-auto">
            <AzureADLoginForm />
          </div>
        </div>
      </Layout>
    </div>
  );
}
