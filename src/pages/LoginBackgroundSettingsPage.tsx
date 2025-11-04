import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { apiRequest } from "@/lib/api";
import { PermissionService } from "@/services/PermissionService";

export default function LoginBackgroundSettingsPage() {
  const { isAuthenticated, user } = useAzureADAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  
  const [currentBackground, setCurrentBackground] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if user has admin access
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const hasAccess = user?.role === "system_admin" || user?.role === "global_engineer";
    if (!hasAccess) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
      return;
    }
  }, [isAuthenticated, user, navigate]);

  // Load current background
  useEffect(() => {
    if (isAuthenticated && (user?.role === "system_admin" || user?.role === "global_engineer")) {
      loadCurrentBackground(true); // Always force refresh on mount to show latest
    }
  }, [isAuthenticated, user]);

  const loadCurrentBackground = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      
      // Use direct fetch with cache-busting to ensure fresh data (similar to LoginPage)
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(`${baseUrl}/api/settings/login-background${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store' // Force fresh fetch, don't use browser cache
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch background: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('[LoginBackgroundSettings] Background response:', responseData);
      
      if (responseData.success && responseData.backgroundUrl) {
        // Convert relative URL to absolute for preview
        let url = responseData.backgroundUrl;
        if (url.startsWith('/')) {
          if (baseUrl && !url.startsWith('http')) {
            url = `${baseUrl}${url}`;
          }
        }
        
        // Add cache-busting to preview URL to ensure fresh image display
        // Especially important when forceRefresh is true (after upload)
        const previewCacheBuster = forceRefresh ? `?v=${Date.now()}` : `?v=${Date.now()}`;
        const urlWithCacheBuster = url + previewCacheBuster;
        
        console.log('[LoginBackgroundSettings] Setting background URL:', urlWithCacheBuster);
        setCurrentBackground(responseData.backgroundUrl); // Store original (relative) URL
        setPreviewUrl(urlWithCacheBuster); // Use absolute URL with cache-busting for preview
      } else {
        console.log('[LoginBackgroundSettings] No custom background');
        setCurrentBackground(null);
        setPreviewUrl('/images/ops.png');
      }
    } catch (error) {
      console.error('[LoginBackgroundSettings] Error loading background:', error);
      setCurrentBackground(null);
      setPreviewUrl('/images/ops.png');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB.');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an image file first.');
      return;
    }

    try {
      setIsUploading(true);
      
      // Create form data
      const formData = new FormData();
      formData.append('background', selectedFile);

      // Upload using fetch with proper headers
      const { acquireToken } = await import('@/config/azure-ad');
      const token = await acquireToken();
      
      if (!token) {
        console.error('[LoginBackgroundSettings] No token acquired');
        toast.error('Authentication token not available. Please log in again.');
        return;
      }
      
      console.log('[LoginBackgroundSettings] Token acquired, length:', token.length);
      
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/settings/login-background/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type - browser will set it automatically with boundary for FormData
        },
        body: formData
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            // If not JSON, try to get text but limit it to avoid huge HTML pages
            const text = await response.text();
            // If it looks like HTML, provide a generic message
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
              if (response.status === 401) {
                errorMessage = 'Unauthorized. Please log in again or check your permissions.';
              } else if (response.status === 403) {
                errorMessage = 'Forbidden. You do not have permission to upload login backgrounds.';
              } else {
                errorMessage = `Server error (${response.status}). Please try again later.`;
              }
            } else {
              errorMessage = text.substring(0, 200); // Limit error text length
            }
          }
        } catch (parseError) {
          console.error('[LoginBackgroundSettings] Error parsing error response:', parseError);
          if (response.status === 401) {
            errorMessage = 'Unauthorized. Please log in again.';
          } else if (response.status === 403) {
            errorMessage = 'Forbidden. Admin privileges required.';
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Login background uploaded successfully!');
        
        // Clear localStorage cache immediately so new background loads right away
        localStorage.removeItem('login_background_url');
        localStorage.removeItem('login_background_timestamp');
        localStorage.removeItem('login_background_uploaded_at'); // Clear uploaded timestamp to force refresh
        
        // Clear service worker cache for login backgrounds (for PWA installations)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CLEAR_LOGIN_BACKGROUND_CACHE'
          });
          console.log('[LoginBackgroundSettings] Requested service worker to clear login background cache');
        }
        
        // Convert relative URL to absolute for immediate preview
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
        let url = data.url;
        if (url.startsWith('/')) {
          if (baseUrl && !url.startsWith('http')) {
            url = `${baseUrl}${url}`;
          }
        }
        
        // Add cache-busting query parameter to force immediate refresh
        const cacheBuster = `?v=${Date.now()}`;
        const urlWithCacheBuster = url + cacheBuster;
        
        // Update state immediately with new URL (don't wait for image load)
        setCurrentBackground(data.url);
        setPreviewUrl(urlWithCacheBuster);
        setSelectedFile(null);
        setIsUploading(false);
        
        // Reload the current background to refresh the preview display
        // This ensures the preview shows the newly uploaded image even if there was a cache issue
        setTimeout(() => {
          loadCurrentBackground(true); // Force refresh
        }, 500); // Small delay to ensure upload is complete
        
        // Preload the new image in background to ensure it's cached for login page
        const img = new Image();
        img.onload = () => {
          console.log('[LoginBackgroundSettings] New background image preloaded successfully');
        };
        img.onerror = () => {
          console.warn('[LoginBackgroundSettings] Failed to preload uploaded image');
        };
        img.src = urlWithCacheBuster;
      } else {
        toast.error(data.error || 'Failed to upload background');
      }
    } catch (error: any) {
      console.error('[LoginBackgroundSettings] Error uploading:', error);
      toast.error(error.message || 'Failed to upload background. Please check your authentication and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to reset the login background to the default? This cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await apiRequest('/api/settings/login-background', {
        method: 'DELETE'
      });

      if (response.success) {
        toast.success('Login background reset to default');
        setCurrentBackground(null);
        setPreviewUrl('/images/ops.png');
        setSelectedFile(null);
        
        // Clear cache so the default background loads immediately
        localStorage.removeItem('login_background_url');
        localStorage.removeItem('login_background_timestamp');
      } else {
        toast.error(response.error || 'Failed to reset background');
      }
    } catch (error: any) {
      console.error('[LoginBackgroundSettings] Error deleting:', error);
      toast.error(error.message || 'Failed to reset background');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    if (currentBackground) {
      setPreviewUrl(currentBackground);
    } else {
      setPreviewUrl('/images/ops.png');
    }
  };

  if (!isAuthenticated || (user?.role !== "system_admin" && user?.role !== "global_engineer")) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Login Background Settings</h1>
          <p className="text-muted-foreground">
            Manage the background image displayed on the login page
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Preview Section */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>How the login page will look</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="relative h-64 rounded-lg overflow-hidden border bg-muted">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Login background preview"
                      className="w-full h-full object-cover"
                      onError={() => {
                        // Fallback if image fails to load
                        setPreviewUrl('/images/ops.png');
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-4 text-sm text-muted-foreground">
                {currentBackground ? (
                  <p>✓ Custom background is active</p>
                ) : (
                  <p>Using default background</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Upload New Background</CardTitle>
              <CardDescription>
                Upload a new image to replace the current background
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="background-upload">Select Image</Label>
                <Input
                  id="background-upload"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Supported formats: JPEG, PNG, WebP. Max size: 10MB
                </p>
              </div>

              {selectedFile && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCancel}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Background
                    </>
                  )}
                </Button>

                {currentBackground && (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting || isUploading}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Reset to Default
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Note:</strong> The background image will be displayed on the login page. 
                  Choose an image that works well with the login form overlay.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
