import { sanitizeInput, sanitizeHTML, XSSProtection } from './security';
import { z } from 'zod';

/**
 * Comprehensive input sanitization utilities using existing DOMPurify infrastructure
 */

// Enhanced sanitization for different input types
export const sanitizeTextInput = (value: string): string => {
  if (!value || typeof value !== 'string') return '';
  
  // Use existing DOMPurify sanitization
  return sanitizeInput(value).trim();
};

export const sanitizeTextareaInput = (value: string): string => {
  if (!value || typeof value !== 'string') return '';
  
  // For textarea, allow some basic formatting but remove dangerous content
  return XSSProtection.sanitizeHTML(value, ['br', 'p'], ['class']).trim();
};

export const sanitizeNumberInput = (value: string | number): string => {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  // Remove any non-numeric characters except decimal point and minus sign
  const sanitized = stringValue.replace(/[^0-9.-]/g, '');
  
  // Ensure only one decimal point
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  return sanitized;
};

export const sanitizeEmailInput = (value: string): string => {
  if (!value || typeof value !== 'string') return '';
  
  // Basic email sanitization - remove dangerous characters but keep email format
  const sanitized = value
    .replace(/[<>\"'&]/g, '') // Remove dangerous characters
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
  
  return sanitized;
};

export const sanitizeUrlInput = (value: string): string => {
  if (!value || typeof value !== 'string') return '';
  
  // Remove dangerous protocols and characters
  const sanitized = value
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/[<>\"']/g, '')
    .trim();
  
  return sanitized;
};

// Generic form data sanitization
export const sanitizeFormData = <T extends Record<string, any>>(data: T): T => {
  const sanitized = { ...data };
  
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      // Determine sanitization method based on field name
      if (key.toLowerCase().includes('email')) {
        sanitized[key] = sanitizeEmailInput(value);
      } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
        sanitized[key] = sanitizeUrlInput(value);
      } else if (key.toLowerCase().includes('substationnumber') || key.toLowerCase().includes('substation_code') || key.toLowerCase().includes('substation_id')) {
        // Allow letters, numbers, and common special characters for substation identifiers
        sanitized[key] = sanitizeTextInput(value);
      } else if (key.toLowerCase().includes('number') || key.toLowerCase().includes('count') || key.toLowerCase().includes('amount')) {
        sanitized[key] = sanitizeNumberInput(value);
      } else if (key.toLowerCase().includes('description') || key.toLowerCase().includes('remarks') || key.toLowerCase().includes('notes')) {
        sanitized[key] = sanitizeTextareaInput(value);
      } else {
        sanitized[key] = sanitizeTextInput(value);
      }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeTextInput(item) : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeFormData(value);
    }
  }
  
  return sanitized;
};

// Zod schema for input validation with sanitization
export const createSanitizedStringSchema = (minLength = 0, maxLength = 1000) => {
  return z.string()
    .transform(sanitizeTextInput)
    .refine(val => val.length >= minLength, {
      message: `Must be at least ${minLength} characters long`
    })
    .refine(val => val.length <= maxLength, {
      message: `Must be no more than ${maxLength} characters long`
    });
};

export const createSanitizedEmailSchema = () => {
  return z.string()
    .transform(sanitizeEmailInput)
    .refine(val => val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Must be a valid email address'
    });
};

export const createSanitizedUrlSchema = () => {
  return z.string()
    .transform(sanitizeUrlInput)
    .refine(val => val === '' || /^https?:\/\/.+/.test(val), {
      message: 'Must be a valid URL starting with http:// or https://'
    });
};

export const createSanitizedNumberSchema = () => {
  return z.union([z.string(), z.number()])
    .transform(val => sanitizeNumberInput(val))
    .refine(val => val === '' || !isNaN(Number(val)), {
      message: 'Must be a valid number'
    });
};

// Enhanced input change handler with sanitization
export const createSanitizedInputHandler = <T>(
  setter: (value: T) => void,
  sanitizer: (value: string) => string = sanitizeTextInput
) => {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const sanitizedValue = sanitizer(e.target.value);
    setter(sanitizedValue as T);
  };
};

// Enhanced form submission handler with sanitization
export const createSanitizedSubmitHandler = <T>(
  originalHandler: (data: T) => void | Promise<void>,
  sanitizer: (data: T) => T = sanitizeFormData
) => {
  return (data: T) => {
    const sanitizedData = sanitizer(data);
    return originalHandler(sanitizedData);
  };
};

// Validation and sanitization combined
export const validateAndSanitize = <T>(
  data: T,
  schema: z.ZodSchema<T>
): { success: boolean; data?: T; errors?: z.ZodError } => {
  try {
    // First sanitize the data
    const sanitizedData = sanitizeFormData(data);
    
    // Then validate with Zod
    const result = schema.safeParse(sanitizedData);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, errors: result.error };
    }
  } catch (error) {
    return { success: false, errors: error as z.ZodError };
  }
};
