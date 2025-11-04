import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationState<T> {
  errors: ValidationError[];
  isValid: boolean;
  touched: Set<keyof T>;
  validateField: (field: keyof T, value: any) => ValidationError | null;
  validateForm: (data: T) => ValidationError[];
  markFieldTouched: (field: keyof T) => void;
  clearErrors: () => void;
  clearFieldError: (field: keyof T) => void;
  sanitizeAndValidate: (data: T) => { sanitizedData: T; errors: ValidationError[] };
}

// Input sanitization utilities
const sanitizeString = (value: string): string => {
  if (typeof value !== 'string') return value;
  
  // Remove HTML tags
  const noHtml = value.replace(/<[^>]*>/g, '');
  
  // Remove potentially dangerous characters
  const sanitized = noHtml
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '');
  
  return sanitized.trim();
};

const sanitizeValue = (value: any): any => {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  
  if (value && typeof value === 'object') {
    const sanitized: any = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  
  return value;
};

export function useFormValidation<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  initialData?: Partial<T>
): ValidationState<T> {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());

  // Sanitize and validate a single field
  const validateField = useCallback((field: keyof T, value: any): ValidationError | null => {
    try {
      // Sanitize the value first
      const sanitizedValue = sanitizeValue(value);
      
      // Create a partial object with just the field to validate
      const partialData = { [field]: sanitizedValue } as Partial<T>;
      
      // Use Zod's safeParse to validate just this field
      const result = schema.safeParse(partialData);
      
      if (!result.success) {
        const fieldError = result.error.errors.find(err => 
          err.path.includes(field as string)
        );
        
        if (fieldError) {
          return {
            field: field as string,
            message: fieldError.message
          };
        }
      }
      
      return null;
    } catch (error) {
      return {
        field: field as string,
        message: 'Validation error occurred'
      };
    }
  }, [schema]);

  // Sanitize and validate entire form
  const sanitizeAndValidate = useCallback((data: T): { sanitizedData: T; errors: ValidationError[] } => {
    try {
      // First sanitize all input data
      const sanitizedData = sanitizeValue(data) as T;
      
      // Then validate the sanitized data
      const result = schema.safeParse(sanitizedData);
      
      if (!result.success) {
        const validationErrors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return { sanitizedData, errors: validationErrors };
      }
      
      return { sanitizedData, errors: [] };
    } catch (error) {
      return { 
        sanitizedData: data, 
        errors: [{
          field: 'general',
          message: 'Sanitization or validation error occurred'
        }]
      };
    }
  }, [schema]);

  // Validate entire form (legacy method - use sanitizeAndValidate for new code)
  const validateForm = useCallback((data: T): ValidationError[] => {
    const { errors } = sanitizeAndValidate(data);
    return errors;
  }, [sanitizeAndValidate]);

  // Mark a field as touched
  const markFieldTouched = useCallback((field: keyof T) => {
    setTouched(prev => new Set(prev).add(field));
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Clear error for a specific field
  const clearFieldError = useCallback((field: keyof T) => {
    setErrors(prev => prev.filter(err => err.field !== field));
  }, []);

  // Validate form on data changes
  useEffect(() => {
    if (initialData) {
      const { errors: validationErrors } = sanitizeAndValidate(initialData as T);
      setErrors(validationErrors);
    }
  }, [initialData, sanitizeAndValidate]);

  // Check if form is valid
  const isValid = errors.length === 0;

  return {
    errors,
    isValid,
    touched,
    validateField,
    validateForm,
    markFieldTouched,
    clearErrors,
    clearFieldError,
    sanitizeAndValidate
  };
}

// Hook for real-time field validation with sanitization
export function useFieldValidation<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  field: keyof T,
  value: any,
  touched: boolean = false
) {
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [sanitizedValue, setSanitizedValue] = useState<any>(value);

  useEffect(() => {
    if (touched && value !== undefined && value !== null) {
      setIsValidating(true);
      
      // Debounce validation to avoid excessive validation calls
      const timeoutId = setTimeout(() => {
        try {
          // Sanitize the value first
          const sanitized = sanitizeValue(value);
          setSanitizedValue(sanitized);
          
          const partialData = { [field]: sanitized } as Partial<T>;
          const result = schema.safeParse(partialData);
          
          if (!result.success) {
            const fieldError = result.error.errors.find(err => 
              err.path.includes(field as string)
            );
            
            setError(fieldError?.message || null);
          } else {
            setError(null);
          }
        } catch (error) {
          setError('Validation error occurred');
        } finally {
          setIsValidating(false);
        }
      }, 300); // 300ms debounce

      return () => clearTimeout(timeoutId);
    } else {
      setError(null);
    }
  }, [schema, field, value, touched]);

  return {
    error,
    isValidating,
    isValid: !error,
    sanitizedValue
  };
}

// Hook for form submission with sanitization and validation
export function useFormSubmission<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  onSubmit: (data: T) => Promise<void> | void
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const handleSubmit = useCallback(async (data: T) => {
    try {
      setIsSubmitting(true);
      setErrors([]);

      // Sanitize and validate the data
      const { sanitizedData, errors: validationErrors } = sanitizeAndValidate(data, schema);
      
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return { success: false, errors: validationErrors, sanitizedData };
      }

      // Submit the sanitized and validated data
      await onSubmit(sanitizedData);
      
      return { success: true, errors: [], sanitizedData };
    } catch (error) {
      const submissionError = {
        field: 'general',
        message: error instanceof Error ? error.message : 'Submission failed'
      };
      
      setErrors([submissionError]);
      return { success: false, errors: [submissionError], sanitizedData: data };
    } finally {
      setIsSubmitting(false);
    }
  }, [schema, onSubmit]);

  return {
    handleSubmit,
    isSubmitting,
    errors,
    clearErrors: () => setErrors([])
  };
}

// Helper function for sanitization and validation
function sanitizeAndValidate<T>(data: T, schema: z.ZodSchema<T>): { sanitizedData: T; errors: ValidationError[] } {
  try {
    // First sanitize all input data
    const sanitizedData = sanitizeValue(data) as T;
    
    // Then validate the sanitized data
    const result = schema.safeParse(sanitizedData);
    
    if (!result.success) {
      const validationErrors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      return { sanitizedData, errors: validationErrors };
    }
    
    return { sanitizedData, errors: [] };
  } catch (error) {
    return { 
      sanitizedData: data, 
      errors: [{
        field: 'general',
        message: 'Sanitization or validation error occurred'
      }]
    };
  }
}
