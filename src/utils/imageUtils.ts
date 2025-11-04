export interface ImageMetadata {
  timestamp: string;
  gpsLocation?: string;
  accuracy?: number;
}

/**
 * Adds timestamp and GPS information overlay to an image
 * @param canvas - The canvas element to draw on
 * @param ctx - The canvas context
 * @param metadata - Object containing timestamp and optional GPS information
 * @returns Data URL of the processed image
 */
export const addImageMetadata = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  metadata: ImageMetadata
): string => {
  const { timestamp, gpsLocation, accuracy } = metadata;
  
  // Set font properties - reduced size for more compact display
  ctx.font = 'bold 14px Arial';
  ctx.textBaseline = 'bottom';
  
  // Create background for text - reduced padding and line height
  const padding = 4;
  const lineHeight = 16;
  const lines: string[] = [];
  
  // Add timestamp - more compact format
  const date = new Date(timestamp);
  const timeString = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  const dateString = date.toLocaleDateString('en-US', { 
    month: '2-digit', 
    day: '2-digit', 
    year: '2-digit' 
  });
  lines.push(`${dateString} ${timeString}`);
  
  // Add GPS information if available - more compact format
  if (gpsLocation) {
    // Shorten GPS coordinates to 4 decimal places
    const coords = gpsLocation.split(',');
    if (coords.length === 2) {
      const lat = parseFloat(coords[0].trim()).toFixed(4);
      const lng = parseFloat(coords[1].trim()).toFixed(4);
      lines.push(`${lat}, ${lng}`);
    } else {
      lines.push(gpsLocation);
    }
    
    if (accuracy) {
      lines.push(`±${accuracy.toFixed(0)}m`);
    }
  }
  
  // Calculate background dimensions
  let maxWidth = 0;
  lines.forEach(line => {
    const width = ctx.measureText(line).width;
    if (width > maxWidth) maxWidth = width;
  });
  
  const backgroundHeight = lines.length * lineHeight + padding * 2;
  const backgroundWidth = maxWidth + padding * 2;
  
  // Position in bottom-right corner
  const x = canvas.width - backgroundWidth - 8;
  const y = canvas.height - backgroundHeight - 8;
  
  // Draw semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(x, y, backgroundWidth, backgroundHeight);
  
  // Draw text
  ctx.fillStyle = 'white';
  lines.forEach((line, index) => {
    ctx.fillText(line, x + padding, y + padding + (index + 1) * lineHeight);
  });
  
  return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Processes an image (from camera or file upload) and adds metadata overlay
 * @param imageSrc - Base64 image data
 * @param gpsLocation - Optional GPS coordinates
 * @param accuracy - Optional GPS accuracy in meters
 * @returns Promise that resolves to the processed image data URL
 */
export const processImageWithMetadata = async (
  imageSrc: string,
  gpsLocation?: string,
  accuracy?: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log(`[processImageWithMetadata] Processing image, size:`, imageSrc.length, 'characters');
    
    const img = new Image();
    img.onload = () => {
      try {
        console.log(`[processImageWithMetadata] Image loaded, dimensions:`, img.width, 'x', img.height);
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error(`[processImageWithMetadata] Failed to get canvas context`);
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        console.log(`[processImageWithMetadata] Drawing image to canvas...`);
        // Draw the original image
        ctx.drawImage(img, 0, 0);
        
        // Add metadata overlay
        const metadata: ImageMetadata = {
          timestamp: new Date().toLocaleString(),
          gpsLocation,
          accuracy
        };
        
        console.log(`[processImageWithMetadata] Adding metadata overlay...`);
        const processedImage = addImageMetadata(canvas, ctx, metadata);
        console.log(`[processImageWithMetadata] Processing complete, result size:`, processedImage.length, 'characters');
        resolve(processedImage);
      } catch (error) {
        console.error(`[processImageWithMetadata] Error processing image:`, error);
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      console.error(`[processImageWithMetadata] Failed to load image:`, error);
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageSrc;
  });
};

/**
 * Captures image from video element and adds metadata overlay
 * @param videoElement - HTML video element
 * @param gpsLocation - Optional GPS coordinates
 * @param accuracy - Optional GPS accuracy in meters
 * @returns Processed image data URL
 */
export const captureImageWithMetadata = (
  videoElement: HTMLVideoElement,
  gpsLocation?: string,
  accuracy?: number
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Draw the video frame
  ctx.drawImage(videoElement, 0, 0);
  
  // Add metadata overlay
  const metadata: ImageMetadata = {
    timestamp: new Date().toLocaleString(),
    gpsLocation,
    accuracy
  };
  
  return addImageMetadata(canvas, ctx, metadata);
}; 

/**
 * Image Utilities for handling Azure Blob Storage and other image operations
 */

/**
 * Convert Azure Blob Storage URL to backend photo serve URL
 * This uses the existing photo serve system instead of the new image proxy
 */
export const getImageProxyUrl = (azureUrl: string): string => {
  try {
    // Parse Azure URL: https://faultmasterstorage.blob.core.windows.net/uploads/container/path
    const url = new URL(azureUrl);
    const pathParts = url.pathname.split('/');
    
    if (pathParts.length < 3) {
      console.warn('Invalid Azure URL format:', azureUrl);
      return azureUrl;
    }
    
    // pathParts[0] = '' (empty due to leading slash)
    // pathParts[1] = 'uploads' (container)
    // pathParts[2] = container name (e.g., 'overhead-inspections')
    // pathParts[3+] = blob path
    
    // Skip the first two parts (empty and 'uploads') and use the rest of the path
    const blobPath = pathParts.slice(2).join('/'); // e.g., 'overhead-inspections/temp-1754947288471-qzborg67o-before-0/images[1754947290751]-2025-08-11-21-21-30-751-.jpg'
    
    // Get the backend base URL from environment or use the working Azure backend
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'https://nmsbackend.azurewebsites.net';
    
    // Use the existing photo serve endpoint - it expects the full blob path without the container prefix
    return `${backendUrl}/api/photos/serve/${blobPath}`;
  } catch (error) {
    console.warn('Failed to parse Azure URL:', error);
    return azureUrl; // Return original URL on error
  }
};

/**
 * Validate if an image URL is accessible and returns actual image content
 */
export const validateImageUrl = async (url: string): Promise<{
  isValid: boolean;
  contentType?: string;
  size?: number;
  error?: string;
}> => {
  try {
    if (isAzureBlobUrl(url)) {
      // For Azure URLs, use our existing photo serve endpoint to validate
      const photoServeUrl = getImageProxyUrl(url);
      
      console.log('[validateImageUrl] Testing photo serve URL:', photoServeUrl);
      
      const response = await fetch(photoServeUrl, { 
        method: 'HEAD', // Use HEAD request to avoid downloading the full image
        // No auth headers needed for photo serve endpoint
      });
      
      console.log('[validateImageUrl] Response status:', response.status);
      
      if (!response.ok) {
        return {
          isValid: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      if (!contentType || !contentType.startsWith('image/')) {
        return {
          isValid: false,
          contentType,
          error: `Not an image file (got: ${contentType})`
        };
      }
      
      return {
        isValid: true,
        contentType,
        size: contentLength ? parseInt(contentLength) : undefined
      };
    } else {
      // For non-Azure URLs, try direct HEAD request
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        return {
          isValid: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.startsWith('image/')) {
        return {
          isValid: false,
          contentType,
          error: 'Not an image file'
        };
      }
      
      return {
        isValid: true,
        contentType
      };
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Check if URL is Azure Blob Storage URL
 */
export const isAzureBlobUrl = (url: string): boolean => {
  return url.includes('faultmasterstorage') && url.includes('.blob.core.windows.net');
};

/**
 * Fetch image with photo serve fallback for Azure URLs
 */
export const fetchImageWithProxy = async (url: string): Promise<Response> => {
  if (isAzureBlobUrl(url)) {
    const photoServeUrl = getImageProxyUrl(url);
    
    console.log('Using photo serve endpoint for Azure URL:', photoServeUrl);
    
    try {
      // No auth headers needed for photo serve endpoint
      const response = await fetch(photoServeUrl);
      if (response.ok) {
        return response;
      }
      console.warn('Photo serve failed, falling back to direct fetch');
    } catch (error) {
      console.warn('Photo serve error, falling back to direct fetch:', error);
    }
  }
  
  // Fallback to direct fetch
  return fetch(url);
}; 

/**
 * Safely convert image blob to base64 with validation
 */
export const safeImageToBase64 = async (blob: Blob): Promise<string | null> => {
  try {
    // Validate blob
    if (!blob || blob.size === 0) {
      console.warn('Invalid blob: empty or undefined');
      return null;
    }
    
    // Check if it's actually an image
    if (!blob.type.startsWith('image/')) {
      console.warn('Blob is not an image:', blob.type);
      return null;
    }
    
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onloadend = () => {
        try {
          if (reader.result && typeof reader.result === 'string') {
            // Validate the base64 result
            if (reader.result.length < 100) {
              reject(new Error('Generated base64 is too short'));
              return;
            }
            
            // Check if it starts with data:image/
            if (!reader.result.startsWith('data:image/')) {
              reject(new Error('Invalid base64 format: missing data:image/ prefix'));
              return;
            }
            
            resolve(reader.result);
          } else {
            reject(new Error('FileReader failed to convert blob to base64'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown error'}`));
      };
      
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('FileReader timeout'));
      }, 10000); // 10 second timeout
      
      reader.onloadend = () => {
        clearTimeout(timeout);
        if (reader.result && typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader failed to convert blob to base64'));
        }
      };
      
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}; 