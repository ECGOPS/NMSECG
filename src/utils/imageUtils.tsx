import { useState, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}

const defaultSizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';

export const getImageUrl = (path: string, width?: number): string => {
  if (!path) return '';
  
  // Check if the image is in a supported format
  const supportedFormats = ['.jpg', '.jpeg', '.png'];
  const isSupported = supportedFormats.some(format => path.toLowerCase().endsWith(format));
  
  if (!isSupported || !width) return path;
  
  // Convert to WebP format if supported
  const webpPath = path.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  return `${webpPath}?w=${width}`;
};

export const getSrcSet = (path: string, widths: number[]): string => {
  return widths
    .map(width => `${getImageUrl(path, width)} ${width}w`)
    .join(', ');
};

export const useImageLoad = (src: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    
    img.onload = () => setIsLoaded(true);
    img.onerror = (e) => setError(new Error('Failed to load image'));
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { isLoaded, error };
};

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  loading = 'lazy',
  sizes = defaultSizes
}) => {
  const { isLoaded, error } = useImageLoad(src);
  const [isWebPSupported, setIsWebPSupported] = useState(true);

  useEffect(() => {
    const checkWebPSupport = async () => {
      const webpImage = new Image();
      webpImage.onload = () => setIsWebPSupported(true);
      webpImage.onerror = () => setIsWebPSupported(false);
      webpImage.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
    };
    checkWebPSupport();
  }, []);

  const imageUrl = isWebPSupported ? getImageUrl(src, width) : src;
  const srcSet = getSrcSet(src, [320, 640, 960, 1280, 1920]);

  return (
    <img
      src={imageUrl}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      loading={loading}
      onError={(e) => {
        if (error) {
          console.error('Image load error:', error);
        }
      }}
    />
  );
}; 