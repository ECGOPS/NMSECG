export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  blobName?: string;
  error?: string;
}

export class PhotoService {
  private static instance: PhotoService;
  private apiBaseUrl: string;

  private constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  }

  public static getInstance(): PhotoService {
    if (!PhotoService.instance) {
      PhotoService.instance = new PhotoService();
    }
    return PhotoService.instance;
  }

  /**
   * Upload a photo to Azure Blob Storage via backend API (NO AUTH REQUIRED)
   * @param base64Data - Base64 encoded image data
   * @param assetId - ID of the asset
   * @param photoType - Type of photo (e.g., 'photo', 'before', 'after')
   * @returns Promise<PhotoUploadResult>
   */
  public async uploadPhoto(
    base64Data: string, 
    assetId: string, 
    photoType: string = 'photo'
  ): Promise<PhotoUploadResult> {
    try {
      console.log(`[PhotoService] Uploading photo:`, { assetId, photoType, base64DataLength: base64Data.length });
      
      const response = await fetch(`${this.apiBaseUrl}/api/photos/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Data,
          assetId,
          photoType
        })
      });

      console.log(`[PhotoService] Response status:`, response.status);
      
      const result = await response.json();
      console.log(`[PhotoService] Response result:`, result);
      
      if (response.ok && result.success) {
        console.log(`[PhotoService] Upload successful:`, result.url);
        return {
          success: true,
          url: result.url,
          blobName: result.blobName
        };
      } else {
        console.error(`[PhotoService] Upload failed:`, result.error);
        return {
          success: false,
          error: result.error || 'Upload failed'
        };
      }
      
    } catch (error) {
      console.error('[PhotoService] Error uploading photo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Upload a file to Azure Blob Storage via backend API (NO AUTH REQUIRED)
   * @param file - File object from input
   * @param assetId - ID of the asset
   * @param photoType - Type of photo (e.g., 'photo', 'before', 'after')
   * @returns Promise<PhotoUploadResult>
   */
  public async uploadFile(
    file: File, 
    assetId: string, 
    photoType: string = 'photo'
  ): Promise<PhotoUploadResult> {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('assetId', assetId);
      formData.append('photoType', photoType);

      const response = await fetch(`${this.apiBaseUrl}/api/photos/upload-file`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        return {
          success: true,
          url: result.url,
          blobName: result.blobName
        };
      } else {
        return {
          success: false,
          error: result.error || 'Upload failed'
        };
      }
      
    } catch (error) {
      console.error('[PhotoService] Error uploading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete a photo from Azure Blob Storage (NO AUTH REQUIRED)
   * @param photoUrl - URL of the photo to delete
   * @returns Promise<PhotoUploadResult>
   */
  public async deletePhoto(photoUrl: string): Promise<PhotoUploadResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/photos/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoUrl })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        return {
          success: true
        };
      } else {
        return {
          success: false,
          error: result.error || 'Delete failed'
        };
      }
      
    } catch (error) {
      console.error('[PhotoService] Error deleting photo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Convert blob URL to proxy URL for serving images
   * @param blobUrl - Original blob storage URL
   * @returns Proxy URL that goes through our backend
   */
  private convertBlobUrlToProxyUrl(blobUrl: string): string {
    try {
      const url = new URL(blobUrl);
      const pathParts = url.pathname.split('/');
      const blobName = pathParts.slice(2).join('/'); // Skip account and container
      return `${this.apiBaseUrl}/api/photos/serve/${blobName}`;
    } catch (error) {
      console.error('[PhotoService] Error converting blob URL to proxy URL:', error);
      return blobUrl; // Fallback to original URL
    }
  }

  /**
   * Convert any photo URL to use proxy if it's a blob URL
   * @param photoUrl - Photo URL (could be blob URL or already proxy URL)
   * @returns Proxy URL for blob URLs, original URL for others
   */
  public convertToProxyUrl(photoUrl: string): string {
    if (!photoUrl) return photoUrl;
    
    // If it's already a proxy URL, return as is
    if (photoUrl.includes('/api/photos/serve/')) {
      return photoUrl;
    }
    
    // If it's a blob URL, ALWAYS convert to proxy URL (never use direct blob URL)
    if (photoUrl.includes('.blob.core.windows.net/')) {
      try {
        const proxyUrl = this.convertBlobUrlToProxyUrl(photoUrl);
        console.log('[PhotoService] Converted blob URL to proxy:', {
          original: photoUrl.substring(0, 80),
          proxy: proxyUrl.substring(0, 80)
        });
        return proxyUrl;
      } catch (error) {
        console.error('[PhotoService] Failed to convert to proxy URL:', error, {
          url: photoUrl.substring(0, 100)
        });
        // Still try to return a proxy URL even if conversion failed
        // Extract blob name manually as fallback
        try {
          const match = photoUrl.match(/\.blob\.core\.windows\.net\/([^?]+)/);
          if (match && match[1]) {
            const blobName = match[1];
            const fallbackProxyUrl = `${this.apiBaseUrl}/api/photos/serve/${blobName}`;
            console.warn('[PhotoService] Using fallback conversion:', fallbackProxyUrl);
            return fallbackProxyUrl;
          }
        } catch (fallbackError) {
          console.error('[PhotoService] Fallback conversion also failed:', fallbackError);
        }
        // Last resort: return original but log warning
        console.warn('[PhotoService] Returning original blob URL (will likely fail):', photoUrl.substring(0, 100));
        return photoUrl;
      }
    }
    
    // Otherwise return as is (Firebase URLs, etc.)
    return photoUrl;
  }

  /**
   * Convert any photo URL to use proxy with error handling
   * @param photoUrl - Photo URL (could be blob URL or already proxy URL)
   * @returns Proxy URL for blob URLs, original URL for others
   */
  public convertToProxyUrlWithFallback(photoUrl: string): string {
    if (!photoUrl) return photoUrl;
    
    try {
      // If it's already a proxy URL, return as is
      if (photoUrl.includes('/api/photos/serve/')) {
        return photoUrl;
      }
      
      // If it's a blob URL, convert to proxy
      if (photoUrl.includes('.blob.core.windows.net/')) {
        return this.convertBlobUrlToProxyUrl(photoUrl);
      }
      
      // Otherwise return as is
      return photoUrl;
    } catch (error) {
      console.error('[PhotoService] Error converting URL:', error);
      return photoUrl; // Fallback to original URL
    }
  }
} 