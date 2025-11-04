import { z } from 'zod';

// GPS coordinate validation utilities
export interface GPSCoordinate {
  latitude: number;
  longitude: number;
}

export interface GPSValidationResult {
  isValid: boolean;
  error?: string;
  coordinates?: GPSCoordinate;
}

/**
 * Validates and parses GPS coordinates from string format
 * @param value - GPS coordinates string in format "lat,lng" or "lat, lng"
 * @returns GPSValidationResult with validation status and parsed coordinates
 */
export function validateGPSCoordinates(value: string): GPSValidationResult {
  // Allow empty values for optional fields
  if (!value || value.trim() === '') {
    return { isValid: true };
  }

  const trimmedValue = value.trim();
  
  // Check format: should be "lat,lng" or "lat, lng"
  const coordinatePattern = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
  if (!coordinatePattern.test(trimmedValue)) {
    return {
      isValid: false,
      error: "Invalid format. Use 'latitude,longitude' (e.g., '5.603717, -0.186964')"
    };
  }

  // Parse coordinates
  const [latStr, lngStr] = trimmedValue.split(',').map(s => s.trim());
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lngStr);

  // Check if parsing was successful
  if (isNaN(latitude) || isNaN(longitude)) {
    return {
      isValid: false,
      error: "Invalid coordinates. Please enter valid numbers."
    };
  }

  // Check latitude range
  if (latitude < -90 || latitude > 90) {
    return {
      isValid: false,
      error: "Latitude must be between -90 and 90 degrees."
    };
  }

  // Check longitude range
  if (longitude < -180 || longitude > 180) {
    return {
      isValid: false,
      error: "Longitude must be between -180 and 180 degrees."
    };
  }

  // Check precision (max 6 decimal places)
  const latDecimalPlaces = (latStr.split('.')[1] || '').length;
  const lngDecimalPlaces = (lngStr.split('.')[1] || '').length;
  if (latDecimalPlaces > 6 || lngDecimalPlaces > 6) {
    return {
      isValid: false,
      error: "Coordinates can have maximum 6 decimal places."
    };
  }

  return {
    isValid: true,
    coordinates: { latitude, longitude }
  };
}

/**
 * Sanitizes GPS coordinate input to prevent XSS and injection attacks
 * @param value - Raw GPS coordinate string
 * @returns Sanitized GPS coordinate string
 */
export function sanitizeGPSCoordinates(value: string): string {
  if (!value) return '';
  
  // Remove any non-numeric characters except comma, decimal point, minus sign, and spaces
  const sanitized = value.replace(/[^0-9.,\-\s]/g, '');
  
  // Remove extra spaces and normalize format
  return sanitized.replace(/\s+/g, ' ').trim();
}

/**
 * Formats GPS coordinates to standard format
 * @param latitude - Latitude value
 * @param longitude - Longitude value
 * @param precision - Number of decimal places (default: 6)
 * @returns Formatted coordinate string
 */
export function formatGPSCoordinates(
  latitude: number, 
  longitude: number, 
  precision: number = 6
): string {
  const lat = latitude.toFixed(precision);
  const lng = longitude.toFixed(precision);
  return `${lat},${lng}`;
}

/**
 * Parses GPS coordinates from string format
 * @param value - GPS coordinates string
 * @returns Parsed coordinates or null if invalid
 */
export function parseGPSCoordinates(value: string): GPSCoordinate | null {
  const validation = validateGPSCoordinates(value);
  return validation.isValid ? validation.coordinates || null : null;
}

// Zod schema for GPS coordinates validation
export const gpsCoordinatesZodSchema = z.string()
  .refine((value) => {
    const validation = validateGPSCoordinates(value);
    return validation.isValid;
  }, {
    message: "GPS coordinates must be in format 'latitude,longitude' (e.g., '5.603717, -0.186964'). Latitude must be between -90 and 90, longitude between -180 and 180, with max 6 decimal places."
  });
