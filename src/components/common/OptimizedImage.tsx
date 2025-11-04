import React from 'react';
import { OptimizedImageProps, getImageUrl, getSrcSet, defaultSizes } from '@/utils/imageUtils';

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  loading = 'lazy',
  sizes = defaultSizes
}) => {
  // Get the original image URL
  const originalSrc = getImageUrl(src);
  
  // Generate srcset for responsive images
  const srcset = getSrcSet(src);

  return (
    <img
      src={originalSrc}
      srcSet={srcset}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      decoding="async"
    />
  );
}; 